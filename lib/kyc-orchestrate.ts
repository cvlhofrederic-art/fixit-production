import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { SEAU_DOCUMENTS, signerValeurs } from '@/lib/storage/liens-stockage'
import { lireCertidaoPermanente } from '@/lib/kyc-certidao-permanente'
import {
  computeKycScore,
  decideKycStatus,
  buildKycDetails,
  nameMatchScore,
  type KycMarket,
  type KycChecks,
  type KycResult,
} from '@/lib/kyc-verification'

// Pipeline KYC anti-fraude (format de l'identifiant, registre, OCR du Kbis /
// de la Certidão et de la pièce d'identité, score, écriture dans profiles_artisan).
// Appelé par /api/kyc-orchestrate (session de l'artisan) et par
// /api/pro/register/finalize (inscription BTP, sans session).

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

const DUREE_LIEN_KYC_S = 5 * 60

/**
 * Liens de téléchargement des pièces de la fiche, dans l'ordre reçu (une seule requête au stockage). La fiche garde
 * le chemin de chaque pièce dans le seau privé (ou, pour une fiche ancienne, un lien signé peut-être expiré, ou dont
 * le jeton a été retiré) : un lien frais est créé à partir de ce chemin, s'il est rangé dans un dossier du
 * titulaire. Toute autre adresse est lue comme avant ; une valeur sans lien possible devient null.
 */
async function liensPieces(valeurs: unknown[], ownerUserId: string): Promise<Array<string | null>> {
  const liens = await signerValeurs(SEAU_DOCUMENTS, valeurs, {
    dossiers: [`${ownerUserId}/`, `kbis/${ownerUserId}/`, `insurance/${ownerUserId}/`, `misc/${ownerUserId}/`],
    dureeS: DUREE_LIEN_KYC_S,
    origine: '[kyc-orchestrate]',
  })
  return valeurs.map((valeur, i) =>
    liens[i] ?? (typeof valeur === 'string' && /^https?:\/\//i.test(valeur) ? valeur : null))
}

async function downloadBuffer(url: string): Promise<Buffer | null> {
  try {
    // 10 s : téléchargement et lecture doivent tenir dans les 30 s que Cloudflare laisse après la réponse.
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

// Lecture du document par Workers AI (lib/ai/relais.ts) : le modèle de vision de Groq a été retiré le 17/07/2026.
// Images seulement, 5 Mo au plus. Un PDF n'est pas lu, comme avant ce retrait (il partait déclaré en image et
// échouait) : sa couche de texte se rédige à la main, et l'approuver sur cette seule preuve reste à décider.
async function ocrBuffer(
  buffer: Buffer,
  lang: string,
): Promise<{ text: string; confidence: number }> {
  try {
    const { appelerVision, typeDocument } = await import('@/lib/ai/relais')
    // Type réel du fichier, pas une image JPEG supposée : un modèle refuse une image dont le type déclaré ne
    // correspond pas au contenu.
    const type = typeDocument(buffer)
    if (!type) {
      logger.warn('[kyc-orchestrate] OCR : format de document non pris en charge')
      return { text: '', confidence: 0 }
    }
    const documentUrl = `data:${type};base64,${buffer.toString('base64')}`
    const prompt = lang === 'por'
      ? 'Extrai todo o texto visível neste documento. Devolve o texto em bruto sem formatação JSON.'
      : 'Extrais tout le texte visible sur ce document. Retourne le texte brut sans formatage JSON.'
    const ocrData = await appelerVision({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: documentUrl } },
        ],
      }],
      max_tokens: 3000,
      // 18 s au plus (téléchargement : 10 s) : tout doit tenir dans les 30 s que Cloudflare laisse après la réponse.
    }, { contexte: 'kyc-orchestrate', budgetMs: 18_000 })
    const text = ocrData.choices?.[0]?.message?.content || ''
    const confidence = text.length > 100 ? 75 : text.length > 30 ? 50 : 15
    return { text, confidence }
  } catch (err) {
    // Non bloquant : le score KYC en tient compte (docOcrSuccess reste faux).
    logger.warn('[kyc-orchestrate] OCR indisponible', err)
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

interface DocumentSocieteLu {
  identifiant: string | null
  denomination: string | null
  representant: string | null
  /** Champs propres à la certidão permanente d'une société portugaise : código de acesso et fin de validité. */
  complements: Record<string, string | null>
}

/**
 * Champs lus sur le document de l'entreprise : Kbis (marchés français), Certidão de l'artisan portugais, certidão
 * permanente de la société BTP portugaise (lib/kyc-certidao-permanente.ts : NIPC de la matrícula, firma, gérance,
 * código de acesso, validité).
 */
function lireDocumentSociete(texte: string, market: KycMarket, identifiantDeclare: string): DocumentSocieteLu {
  if (market === 'pt_btp') {
    const certidao = lireCertidaoPermanente(texte, identifiantDeclare)
    return {
      identifiant: certidao.nipc,
      denomination: certidao.firma,
      representant: certidao.gerente,
      complements: { codigo_acesso: certidao.codigoAcesso, valida_ate: certidao.validaAte },
    }
  }
  const isFr = market === 'fr_artisan' || market === 'fr_btp'
  return {
    identifiant: isFr ? extractSiretFromOcr(texte) : extractNifFromOcr(texte),
    denomination: extractDenominationFromOcr(texte, market),
    representant: extractRepresentantFromOcr(texte, market),
    complements: {},
  }
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

const URL_VIES = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number'

/**
 * Registre d'une société BTP portugaise (marché pt_btp) : VIES, le service de la Commission européenne que l'étape 1
 * de l'inscription interroge déjà (/api/verify-nif). nif.pt, lu pour l'artisan portugais, répond « Key not valid » à
 * la clé « demo » (constaté le 22/11/2026) et ne confirme donc jamais une entreprise. NIPC valide au VIES : société
 * assujettie à la TVA, en activité, avec la firma enregistrée. Absence (société exonérée ou cessée) ou panne du
 * service : contrôle non réussi, sans rejet d'office (decideKycStatus).
 */
async function checkViesRegistry(
  nipc: string,
): Promise<{ found: boolean; isActive: boolean; denomination: string | null }> {
  try {
    const res = await fetch(URL_VIES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ countryCode: 'PT', vatNumber: nipc }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      logger.warn('[kyc-orchestrate] VIES indisponible', { status: res.status })
      return { found: false, isActive: false, denomination: null }
    }
    const data = await res.json() as { valid?: unknown; name?: unknown }
    if (data.valid !== true) return { found: false, isActive: false, denomination: null }
    const nom = typeof data.name === 'string' ? data.name.trim() : ''
    return { found: true, isActive: true, denomination: nom && nom !== '---' ? nom : null }
  } catch (err) {
    logger.warn('[kyc-orchestrate] VIES indisponible', { erreur: err instanceof Error ? err.name : 'inconnue' })
    return { found: false, isActive: false, denomination: null }
  }
}

// ---------------------------------------------------------------------------
// Market determination
// ---------------------------------------------------------------------------

function determineMarket(artisan: {
  country?: string | null
  kyc_market?: string | null
}): KycMarket {
  if (artisan.kyc_market === 'fr_artisan') return 'fr_artisan'
  if (artisan.kyc_market === 'fr_btp') return 'fr_btp'
  if (artisan.kyc_market === 'pt_artisan') return 'pt_artisan'
  // Société BTP inscrite en portugais (formulaire société, depuis le 22/11/2026). Une société inscrite avant garde le
  // marché fr_btp que le formulaire posait alors : son KYC ne repasse pas ici sans nouvelle demande.
  if (artisan.kyc_market === 'pt_btp') return 'pt_btp'
  if (
    artisan.country === 'PT' ||
    artisan.country === 'pt'
  ) return 'pt_artisan'
  return 'fr_artisan'
}


// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export type KycPipelineOutcome =
  | { ok: true; result: KycResult }
  | { ok: false; status: 404 | 403 }

/**
 * Lance le KYC du profil `artisan_id`, qui doit appartenir à `ownerUserId`
 * (404 si le profil est introuvable, 403 s'il appartient à quelqu'un d'autre).
 */
export async function runKycPipeline(
  artisan_id: string,
  ownerUserId: string,
): Promise<KycPipelineOutcome> {
  const start = Date.now()

  // Fetch artisan profile
  // '*' plutôt que la liste des colonnes lues (id, user_id, siret, first_name,
  // last_name, company_name, kbis_url, id_document_url, country, kyc_market) :
  // le schéma de prod ne suit pas toujours les migrations (pas de `country` au
  // 16/10/2026), et une colonne absente dans la liste fait échouer la requête
  // — le KYC répondait alors « Artisan not found » pour tout le monde.
  // Une colonne absente vaut ici undefined, traité comme null.
  const { data: artisan, error: fetchError } = await supabaseAdmin
    .from('profiles_artisan')
    .select('*')
    .eq('id', artisan_id)
    .single()

  if (fetchError || !artisan) {
    logger.warn('[kyc-orchestrate] artisan not found', { artisan_id })
    return { ok: false, status: 404 }
  }

  // Ownership check
  if (artisan.user_id !== ownerUserId) {
    logger.warn('[kyc-orchestrate] ownership mismatch', {
      artisan_id,
      userId: ownerUserId,
    })
    return { ok: false, status: 403 }
  }

  // Pièces à lire (Kbis ou Certidão, pièce d'identité) : la fiche garde leur chemin dans le seau privé, pas un lien
  // signé. Les étapes suivantes les téléchargent par un lien frais de quelques minutes, posé ici sur la copie lue
  // de la fiche (jamais réécrite en base : la mise à jour finale ne porte que les colonnes kyc_* et *_extracted).
  let liens: Array<string | null> = [null, null]
  try {
    liens = await liensPieces([artisan.kbis_url, artisan.id_document_url], ownerUserId)
  } catch (err) {
    // Non bloquant, comme un téléchargement en échec : le score tient compte des pièces non lues.
    logger.warn('[kyc-orchestrate] liens des pièces non créés', { artisan_id, erreur: err instanceof Error ? err.name : 'inconnue' })
  }
  artisan.kbis_url = liens[0]
  artisan.id_document_url = liens[1]

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
  // Marchés portugais (artisan, société BTP) : NIF ou NIPC, lecture en portugais, Certidão rangée dans certidao_extracted.
  const ocrLang = isFr ? 'fra' : 'por'

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
      kyc_checks: checks,
      kyc_status: 'rejected',
      kyc_verified_at: new Date().toISOString(),
      kyc_market: market,
    }).eq('id', artisan_id)

    logger.info('[kyc-orchestrate] rejected — invalid identifiant format', {
      artisan_id,
      market,
      score,
    })

    return { ok: true, result: { score, decision: 'rejected', checks, details, market } }
  }

  // Lectures du Kbis et de la pièce d'identité lancées tout de suite, en parallèle entre elles et avec la
  // vérification au registre : deux lectures par un modèle à la suite (plusieurs secondes chacune) risquaient de
  // dépasser les 30 s que Cloudflare laisse au travail lancé après la réponse (after() des routes d'inscription).
  // Ni le téléchargement ni la lecture ne rejettent : un échec donne null ou un texte vide.
  const lireDocument = async (url: string | null | undefined) => {
    if (!url) return null
    const buffer = await downloadBuffer(url)
    return buffer ? ocrBuffer(buffer, ocrLang) : null
  }
  // La pièce d'identité ne sert qu'à retrouver le nom de l'artisan : sans nom à comparer, elle n'est pas envoyée.
  const nomArtisan = [artisan.first_name, artisan.last_name].filter(Boolean).join(' ').trim()
  const lectureKbis = lireDocument(artisan.kbis_url)
  const lectureIdentite = nomArtisan ? lireDocument(artisan.id_document_url) : Promise.resolve(null)

  // Step 2 — registry check
  let registryDenomination: string | null = null
  try {
    if (isFr) {
      const reg = await checkFrRegistry(declaredIdentifiant)
      checks.identifiantActiveInRegistry = reg.isActive
      registryDenomination = reg.denomination
    } else {
      // Société BTP portugaise : VIES ; artisan portugais : nif.pt, comme avant.
      const verifierRegistre = market === 'pt_btp' ? checkViesRegistry : checkPtRegistry
      const reg = await verifierRegistre(declaredIdentifiant)
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
      const ocr = await lectureKbis
      if (ocr) {
        if (ocr.confidence > 30 || ocr.text.length > 50) {
          checks.docOcrSuccess = true

          const lu = lireDocumentSociete(ocr.text, market, declaredIdentifiant)
          ocrIdentifiant = lu.identifiant
          ocrDenomination = lu.denomination
          ocrRepresentant = lu.representant

          kbisExtracted = {
            identifiant: ocrIdentifiant,
            denomination: ocrDenomination,
            representant: ocrRepresentant,
            confidence: String(ocr.confidence),
            ...lu.complements,
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
          } else if (ocrDenomination && artisan.company_name && market !== 'pt_btp') {
            // Fallback: compare with declared company name. Société portugaise : la firma ne se compare qu'au nom du
            // registre (VIES) ; la raison sociale vient de l'inscrit, comme le texte de la certidão qu'il dépose.
            checks.nameMatchDocVsApi = nameMatchScore(
              ocrDenomination,
              artisan.company_name,
            )
          }
        }
      }
    } catch (err) {
      // OCR failure is non-blocking
      checks.docOcrSuccess = false
      logger.warn('[kyc-orchestrate] lecture du Kbis en échec', { artisan_id, erreur: err instanceof Error ? err.name : 'inconnue' })
    }
  }

  // Step 6 — ID document OCR
  if (artisan.id_document_url) {
    try {
      const ocr = await lectureIdentite
      if (ocr) {
        if (ocr.text.length > 20) {
          // Build full name to search in OCR text
          const fullName = [artisan.first_name, artisan.last_name]
            .filter(Boolean)
            .join(' ')
            .trim()

          if (fullName && ocrRepresentant) {
            // Compare representant from KBIS vs ID document
            checks.nameMatchDocVsId = nameMatchScore(ocrRepresentant, fullName)
          } else if (fullName) {
            // Fallback: check if name appears in ID text at all
            const idText = ocr.text.toLowerCase()
            const nameParts = fullName.toLowerCase().split(' ').filter(p => p.length > 1)
            const foundParts = nameParts.filter(p => idText.includes(p))
            checks.nameMatchDocVsId = nameParts.length > 0
              ? Math.round((foundParts.length / nameParts.length) * 75)
              : 0
          }
        }
      }
    } catch (err) {
      // ID OCR failure is non-blocking
      logger.warn('[kyc-orchestrate] lecture de la pièce d’identité en échec', { artisan_id, erreur: err instanceof Error ? err.name : 'inconnue' })
    }
  }

  // Step 7 — compute score and decision
  const score = computeKycScore(checks, market)
  const decision = decideKycStatus(score, market)
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
    kyc_checks: checks,
    kyc_status: kycStatus,
    kyc_verified_at: new Date().toISOString(),
    kyc_market: market,
  }

  if (kbisExtracted) {
    if (isFr) {
      updatePayload.kbis_extracted = kbisExtracted
    } else {
      updatePayload.certidao_extracted = kbisExtracted
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

  return { ok: true, result: { score, decision, checks, details, market } }
}
