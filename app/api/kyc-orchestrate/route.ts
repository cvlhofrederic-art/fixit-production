import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import {
  computeKycScore,
  decideKycStatus,
  buildKycDetails,
  nameMatchScore,
  type KycMarket,
  type KycChecks,
} from '@/lib/kyc-verification'
import type { Json } from '@/lib/database-types'

// KycChecks (structure métier, uniquement booléens/nombres) → colonne jsonb kyc_checks.
// Cast documenté : exception jsonb↔métier autorisée, la structure est sérialisable telle quelle.
function checksToJson(checks: KycChecks): Json {
  return checks as unknown as Json
}

// ---------------------------------------------------------------------------
// Identifiant validators
// ---------------------------------------------------------------------------

function validateSiretFormat(siret: string): boolean {
  const clean = siret.replace(/\s/g, '')
  if (!/^\d{14}$/.test(clean)) return false
  // Exception La Poste
  if (clean.startsWith('356000000')) return true
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(clean[i], 10)
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

function validateNifFormat(nif: string): boolean {
  const clean = nif.replace(/\s/g, '')
  if (!/^\d{9}$/.test(clean)) return false
  let sum = 0
  for (let i = 0; i < 8; i++) sum += parseInt(clean[i], 10) * (9 - i)
  const check = 11 - (sum % 11)
  const digit = check >= 10 ? 0 : check
  return digit === parseInt(clean[8], 10)
}

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

async function downloadBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function ocrBuffer(
  buffer: Buffer,
  lang: string,
): Promise<{ text: string; confidence: number }> {
  try {
    const { callGroqWithRetry } = await import('@/lib/groq')
    const base64 = buffer.toString('base64')
    const imageUrl = `data:image/jpeg;base64,${base64}`
    const prompt = lang === 'por'
      ? 'Extrai todo o texto visível neste documento. Devolve o texto em bruto sem formatação JSON.'
      : 'Extrais tout le texte visible sur ce document. Retourne le texte brut sans formatage JSON.'
    const groqData = await callGroqWithRetry({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      }],
      temperature: 0.1,
      max_tokens: 3000,
    })
    const text = groqData.choices?.[0]?.message?.content || ''
    const confidence = text.length > 100 ? 75 : text.length > 30 ? 50 : 15
    return { text, confidence }
  } catch {
    return { text: '', confidence: 0 }
  }
}

// ---------------------------------------------------------------------------
// OCR field extractors
// ---------------------------------------------------------------------------

function extractSiretFromOcr(text: string): string | null {
  const m = text.match(/siret\s*[:.]?\s*([\d\s]{14,17})/i)
  return m ? m[1].replace(/\s/g, '').slice(0, 14) : null
}

function extractNifFromOcr(text: string): string | null {
  const m = text.match(
    /(?:NIF|NIPC|N[uú]mero de Identifica[cç][aã]o)\s*[:.]?\s*(\d{9})/i,
  )
  return m ? m[1] : null
}

function extractDenominationFromOcr(text: string, market: KycMarket): string | null {
  if (market === 'pt_artisan') {
    const m = text.match(
      /(?:denomina[cç][aã]o|firma|raz[aã]o social)\s*[:.]?\s*([^\n]{3,80})/i,
    )
    return m ? m[1].trim() : null
  }
  const m = text.match(
    /(?:d[eé]nomination|raison sociale)\s*[:.]?\s*([^\n]{3,80})/i,
  )
  return m ? m[1].trim() : null
}

function extractRepresentantFromOcr(text: string, market: KycMarket): string | null {
  if (market === 'pt_artisan') {
    const m = text.match(
      /(?:gerente|s[oó]cio.gerente|administrador|representante)\s*[:.]?\s*([A-ZÀ-Ü][a-zA-ZÀ-ü\s\-]{3,60})/i,
    )
    return m ? m[1].split('\n')[0].trim() : null
  }
  const m = text.match(
    /(?:g[eé]rant|pr[eé]sident|directeur g[eé]n[eé]ral|associ[eé] unique)\s*[:.]?\s*([A-ZÀ-Ÿ][a-zA-ZÀ-ÿ\s\-]{3,60})/i,
  )
  return m ? m[1].split('\n')[0].trim() : null
}

// ---------------------------------------------------------------------------
// Registry checks
// ---------------------------------------------------------------------------

async function checkFrRegistry(
  siret: string,
): Promise<{ found: boolean; isActive: boolean; denomination: string | null }> {
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&mtm_campaign=fixit-kyc`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      },
    )
    if (!res.ok) return { found: false, isActive: false, denomination: null }
    const data = await res.json() as {
      results?: Array<{
        etat_administratif?: string
        nom_complet?: string
        nom_raison_sociale?: string
      }>
    }
    if (!data.results?.length) return { found: false, isActive: false, denomination: null }
    const e = data.results[0]
    return {
      found: true,
      isActive: e.etat_administratif === 'A',
      denomination: e.nom_complet ?? e.nom_raison_sociale ?? null,
    }
  } catch {
    return { found: false, isActive: false, denomination: null }
  }
}

async function checkPtRegistry(
  nif: string,
): Promise<{ found: boolean; isActive: boolean; denomination: string | null }> {
  try {
    const res = await fetch(`https://www.nif.pt/?json=1&q=${nif}&key=demo`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { found: false, isActive: false, denomination: null }
    const data = await res.json() as {
      result?: string
      records?: Record<string, {
        title?: string
        activity?: boolean | string
        situation?: string
      }>
    }
    if (data.result !== 'success' || !data.records) {
      return { found: false, isActive: false, denomination: null }
    }
    const record = data.records[Object.keys(data.records)[0]]
    return {
      found: true,
      isActive:
        record.activity === true ||
        record.activity === 'true' ||
        record.situation === 'Ativa',
      denomination: record.title ?? null,
    }
  } catch {
    return { found: false, isActive: false, denomination: null }
  }
}

// ---------------------------------------------------------------------------
// Market determination
// ---------------------------------------------------------------------------

// La colonne `country` n'existe pas sur profiles_artisan (schéma live, audit P2) :
// l'ancienne branche PT était morte → tout artisan PT (NIF 9 chiffres) tombait en
// validateSiretFormat et finissait auto-rejeté. Le marché dérive désormais de
// `language` ('fr' | 'pt'), colonne live posée à l'inscription.
function determineMarket(artisan: {
  language?: string | null
  kyc_market?: string | null
}): KycMarket {
  if (artisan.kyc_market === 'fr_artisan') return 'fr_artisan'
  if (artisan.kyc_market === 'fr_btp') return 'fr_btp'
  if (artisan.kyc_market === 'pt_artisan') return 'pt_artisan'
  if (artisan.language === 'pt') return 'pt_artisan'
  return 'fr_artisan'
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const start = Date.now()

  // Rate limit: 5 req/min per IP
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`kyc_orchestrate_${ip}`, 5, 60_000)
  if (!allowed) return rateLimitResponse()

  // Auth
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let artisan_id: string
  try {
    const body = await request.json() as { artisan_id?: unknown }
    if (!body.artisan_id || typeof body.artisan_id !== 'string') {
      return NextResponse.json({ error: 'artisan_id required' }, { status: 400 })
    }
    artisan_id = body.artisan_id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Fetch artisan profile
  // NB : les colonnes first_name / last_name / id_document_url / country n'existent
  // pas dans le schéma live de profiles_artisan (audit P2 data layer). Les requêter
  // faisait échouer tout le select (400 PostgREST) → la route répondait toujours 404.
  const { data: artisan, error: fetchError } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, user_id, siret, company_name, kbis_url, kyc_market, language')
    .eq('id', artisan_id)
    .single()

  if (fetchError || !artisan) {
    logger.warn('[kyc-orchestrate] artisan not found', { artisan_id })
    return NextResponse.json({ error: 'Artisan not found' }, { status: 404 })
  }

  // Ownership check
  if (artisan.user_id !== user.id) {
    logger.warn('[kyc-orchestrate] ownership mismatch', {
      artisan_id,
      userId: user.id,
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Determine market
  const market = determineMarket(artisan)

  // Initialize checks
  const checks: KycChecks = {
    identifiantFormatValid: false,
    identifiantActiveInRegistry: false,
    docOcrSuccess: false,
    identifiantMatchDocVsApi: false,
    nameMatchDocVsApi: 0,
    nameMatchDocVsId: 0,
    addressMatchDocVsApi: false,
  }

  const isFr = market === 'fr_artisan' || market === 'fr_btp'
  const isPt = market === 'pt_artisan'
  const ocrLang = isPt ? 'por' : 'fra'

  // Normalize declared identifiant
  const declaredIdentifiant = (artisan.siret ?? '').replace(/\s/g, '')

  // Step 1 — validate format
  if (isFr) {
    checks.identifiantFormatValid = validateSiretFormat(declaredIdentifiant)
  } else {
    checks.identifiantFormatValid = validateNifFormat(declaredIdentifiant)
  }

  // Early exit on invalid format
  if (!checks.identifiantFormatValid) {
    const score = computeKycScore(checks, market)
    const details = buildKycDetails(checks, score, market)

    await supabaseAdmin.from('profiles_artisan').update({
      kyc_score: score,
      kyc_checks: checksToJson(checks),
      kyc_status: 'rejected',
      kyc_verified_at: new Date().toISOString(),
      kyc_market: market,
    }).eq('id', artisan_id)

    logger.info('[kyc-orchestrate] rejected — invalid identifiant format', {
      artisan_id,
      market,
      score,
    })

    logger.api('/api/kyc-orchestrate', 'POST', 200, Date.now() - start)
    return NextResponse.json({ score, decision: 'rejected', checks, details, market })
  }

  // Step 2 — registry check
  let registryDenomination: string | null = null
  try {
    if (isFr) {
      const reg = await checkFrRegistry(declaredIdentifiant)
      checks.identifiantActiveInRegistry = reg.isActive
      registryDenomination = reg.denomination
    } else {
      const reg = await checkPtRegistry(declaredIdentifiant)
      checks.identifiantActiveInRegistry = reg.isActive
      registryDenomination = reg.denomination
    }
  } catch {
    // Registry check failure is non-blocking
    checks.identifiantActiveInRegistry = false
  }

  // Step 3 — KBIS / Certidão OCR
  let kbisExtracted: Record<string, string | null> | null = null
  let ocrDenomination: string | null = null
  let ocrIdentifiant: string | null = null
  let ocrRepresentant: string | null = null

  if (artisan.kbis_url) {
    try {
      const buffer = await downloadBuffer(artisan.kbis_url)
      if (buffer) {
        const ocr = await ocrBuffer(buffer, ocrLang)
        if (ocr.confidence > 30 || ocr.text.length > 50) {
          checks.docOcrSuccess = true

          ocrIdentifiant = isFr
            ? extractSiretFromOcr(ocr.text)
            : extractNifFromOcr(ocr.text)

          ocrDenomination = extractDenominationFromOcr(ocr.text, market)
          ocrRepresentant = extractRepresentantFromOcr(ocr.text, market)

          kbisExtracted = {
            identifiant: ocrIdentifiant,
            denomination: ocrDenomination,
            representant: ocrRepresentant,
            confidence: String(ocr.confidence),
          }

          // Step 4 — cross-check identifiant doc vs declared
          if (ocrIdentifiant && ocrIdentifiant === declaredIdentifiant) {
            checks.identifiantMatchDocVsApi = true
          }

          // Step 5 — cross-check denomination doc vs registry
          if (ocrDenomination && registryDenomination) {
            checks.nameMatchDocVsApi = nameMatchScore(
              ocrDenomination,
              registryDenomination,
            )
          } else if (ocrDenomination && artisan.company_name) {
            // Fallback: compare with declared company name
            checks.nameMatchDocVsApi = nameMatchScore(
              ocrDenomination,
              artisan.company_name,
            )
          }
        }
      }
    } catch {
      // OCR failure is non-blocking
      checks.docOcrSuccess = false
    }
  }

  // Step 6 — ID document OCR
  // DÉSACTIVÉ : les colonnes id_document_url / first_name / last_name n'existent pas
  // dans le schéma live de profiles_artisan (audit P2 data layer) — ce check n'a donc
  // jamais pu s'exécuter (le select échouait avant même d'arriver ici).
  // checks.nameMatchDocVsId reste à 0 (valeur d'initialisation), comme avant.
  // À réactiver quand les colonnes seront ajoutées par migration.

  // Step 7 — compute score and decision
  const score = computeKycScore(checks, market)
  const decision = decideKycStatus(score)
  const details = buildKycDetails(checks, score, market)

  // Map decision to DB status
  const kycStatus =
    decision === 'approved'
      ? 'approved'
      : decision === 'rejected'
        ? 'rejected'
        : 'pending'

  // Step 8 — persist to DB
  const updatePayload: Record<string, unknown> = {
    kyc_score: score,
    kyc_checks: checksToJson(checks),
    kyc_status: kycStatus,
    kyc_verified_at: new Date().toISOString(),
    kyc_market: market,
  }

  if (kbisExtracted) {
    if (isPt) {
      updatePayload.certidao_extracted = kbisExtracted
    } else {
      updatePayload.kbis_extracted = kbisExtracted
    }
  }

  try {
    await supabaseAdmin
      .from('profiles_artisan')
      .update(updatePayload)
      .eq('id', artisan_id)
  } catch (dbErr) {
    logger.error('[kyc-orchestrate] DB update failed', { artisan_id }, dbErr instanceof Error ? dbErr : new Error(String(dbErr)))
    // Non-blocking: still return the result
  }

  logger.info('[kyc-orchestrate] pipeline complete', {
    artisan_id,
    market,
    score,
    decision,
    kycStatus,
    durationMs: Date.now() - start,
  })

  logger.api('/api/kyc-orchestrate', 'POST', 200, Date.now() - start)

  return NextResponse.json({ score, decision, checks, details, market })
}
