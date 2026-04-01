import { NextResponse, type NextRequest } from 'next/server'
import Tesseract from 'tesseract.js'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// ─── Types ───────────────────────────────────────────────────────────────────

export type KbisMarket = 'fr_artisan' | 'fr_btp' | 'pt_artisan'

export interface KbisExtracted {
  identifiant: string | null
  denomination: string | null
  representant: string | null
  adresse: string | null
  dateConstitution: string | null
  formeJuridique: string | null
  market: KbisMarket
  confidence: number
  // Champs spécifiques
  siret?: string | null
  siren?: string | null
  nif?: string | null
}

// ─── Extraction FR ────────────────────────────────────────────────────────────

export function extractIdentifiantFR(text: string): string | null {
  const match = text.match(/siret\s*[:.]?\s*([\d\s]{14,17})/i)
  if (!match) return null
  const clean = match[1].replace(/\s/g, '')
  return clean.length >= 14 ? clean.slice(0, 14) : null
}

export function extractDenominationFR(text: string): string | null {
  const match = text.match(/(?:dénomination|raison sociale)\s*[:.]\s*([^\n]{3,80})/i)
  if (!match) return null
  return match[1].trim() || null
}

export function extractRepresentantFR(text: string): string | null {
  const match = text.match(
    /(?:gérant|président|directeur général|associé unique)\s*[:.]\s*([A-ZÀ-Ÿ][a-zA-ZÀ-ÿ\s\-]{3,60})/i
  )
  if (!match) return null
  return match[1].trim() || null
}

export function extractAdresseFR(text: string): string | null {
  const match = text.match(/(?:siège social|adresse)\s*[:.]?\s*([^\n]{10,120})/i)
  if (!match) return null
  return match[1].trim() || null
}

export function extractDateFR(text: string): string | null {
  const match = text.match(
    /(?:date de constitution|immatriculée? le)\s*[:.]?\s*(\d{1,2}[\s\/\-]\w+[\s\/\-]\d{4})/i
  )
  if (!match) return null
  return match[1].trim() || null
}

const FORMES_JURIDIQUES_FR = ['SARL', 'SAS', 'SASU', 'EURL', 'SA', 'SCI', 'SELARL', 'EI', 'EIRL']

export function extractFormeJuridiqueFR(text: string): string | null {
  for (const forme of FORMES_JURIDIQUES_FR) {
    // Word boundary to avoid partial matches (e.g. SA inside SARL)
    const re = new RegExp(`\\b${forme}\\b`, 'i')
    if (re.test(text)) return forme
  }
  return null
}

// ─── Extraction PT ────────────────────────────────────────────────────────────

export function extractIdentifiantPT(text: string): string | null {
  const match = text.match(/(?:NIF|NIPC|Número de Identificação)\s*[:.]?\s*(\d{9})/i)
  if (!match) return null
  return match[1]
}

export function extractDenominationPT(text: string): string | null {
  const match = text.match(/(?:denominação|firma|razão social)\s*[:.]?\s*([^\n]{3,80})/i)
  if (!match) return null
  return match[1].trim() || null
}

export function extractRepresentantPT(text: string): string | null {
  const match = text.match(
    /(?:gerente|sócio.gerente|administrador|representante)\s*[:.]?\s*([A-ZÀ-Ü][a-zA-ZÀ-ü\s\-]{3,60})/i
  )
  if (!match) return null
  return match[1].trim() || null
}

export function extractAdressePT(text: string): string | null {
  const match = text.match(/(?:sede|morada|endereço)\s*[:.]?\s*([^\n]{10,120})/i)
  if (!match) return null
  return match[1].trim() || null
}

export function extractDatePT(text: string): string | null {
  const match = text.match(
    /(?:data de constituição|constituída em|data de registo)\s*[:.]?\s*(\d{1,2}[\s\/\-]\w+[\s\/\-]\d{4}|\d{4}-\d{2}-\d{2})/i
  )
  if (!match) return null
  return match[1].trim() || null
}

const FORMES_JURIDIQUES_PT = ['Unipessoal Lda', 'Lda', 'SA', 'SAS', 'EIRL', 'ENI']

export function extractFormeJuridiquePT(text: string): string | null {
  // Check multi-word forms first to avoid partial matches
  for (const forme of FORMES_JURIDIQUES_PT) {
    const re = new RegExp(`\\b${forme.replace(/\s/g, '\\s+')}\\b`, 'i')
    if (re.test(text)) return forme
  }
  return null
}

// ─── Assemblage par marché ────────────────────────────────────────────────────

export function buildExtracted(text: string, market: KbisMarket, confidence: number): KbisExtracted {
  if (market === 'pt_artisan') {
    const nif = extractIdentifiantPT(text)
    return {
      identifiant: nif,
      denomination: extractDenominationPT(text),
      representant: extractRepresentantPT(text),
      adresse: extractAdressePT(text),
      dateConstitution: extractDatePT(text),
      formeJuridique: extractFormeJuridiquePT(text),
      market,
      confidence: Math.round(confidence),
      nif,
    }
  }

  // fr_artisan | fr_btp
  const siret = extractIdentifiantFR(text)
  const siren = siret ? siret.slice(0, 9) : null
  return {
    identifiant: siret,
    denomination: extractDenominationFR(text),
    representant: extractRepresentantFR(text),
    adresse: extractAdresseFR(text),
    dateConstitution: extractDateFR(text),
    formeJuridique: extractFormeJuridiqueFR(text),
    market,
    confidence: Math.round(confidence),
    siret,
    siren,
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Rate limit : 3 requêtes/min par IP
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`verify_kbis_${ip}`, 3, 60_000)
  if (!allowed) return rateLimitResponse()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const market = formData.get('market') as KbisMarket | null

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: market === 'pt_artisan'
            ? 'Formato não suportado. Use JPG, PNG ou PDF.'
            : 'Format non supporté. Utilisez JPG, PNG ou PDF.' },
        { status: 400 }
      )
    }

    const validMarkets: KbisMarket[] = ['fr_artisan', 'fr_btp', 'pt_artisan']
    if (!market || !validMarkets.includes(market)) {
      return NextResponse.json(
        { error: 'Paramètre market invalide. Valeurs acceptées : fr_artisan, fr_btp, pt_artisan' },
        { status: 400 }
      )
    }

    // Langue OCR : français pour FR, portugais pour PT
    const ocrLang = market === 'pt_artisan' ? 'por' : 'fra'

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await Tesseract.recognize(buffer, ocrLang, {
      logger: () => {},
    })

    const ocrText = result.data.text
    const confidence = result.data.confidence

    const extracted = buildExtracted(ocrText, market, confidence)

    // Échec OCR : confiance trop faible et aucun identifiant extrait
    if (confidence < 30 && extracted.identifiant === null) {
      const message =
        market === 'pt_artisan'
          ? 'Documento ilegível ou qualidade insuficiente. Verifique que a Certidão está legível.'
          : 'Document illisible ou qualité insuffisante. Vérifiez que le KBIS est net.'

      return NextResponse.json({ success: false, message }, { status: 422 })
    }

    return NextResponse.json({ success: true, extracted })
  } catch (error: unknown) {
    logger.error('[verify-kbis] Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la vérification du document' }, { status: 500 })
  }
}
