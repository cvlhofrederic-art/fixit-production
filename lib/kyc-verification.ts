// KYC anti-fraud scoring engine — purely functional, no I/O, no network calls

export type KycMarket = 'fr_artisan' | 'fr_btp' | 'pt_artisan'

export interface KycChecks {
  // Identifiant fiscal
  identifiantFormatValid: boolean
  identifiantActiveInRegistry: boolean
  // Document entreprise (KBIS ou Certidão)
  docOcrSuccess: boolean
  identifiantMatchDocVsApi: boolean
  nameMatchDocVsApi: number // 0-100
  // Carte d'identité
  nameMatchDocVsId: number // 0-100
  // Adresse (bonus informatif)
  addressMatchDocVsApi: boolean
}

export interface KycResult {
  score: number
  decision: 'approved' | 'manual_review' | 'rejected'
  checks: KycChecks
  details: string[]
  market: KycMarket
}

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ')    // remove punctuation
    .replace(/\s+/g, ' ')            // collapse whitespace
    .trim()
}

// ---------------------------------------------------------------------------
// Name similarity
// ---------------------------------------------------------------------------

export function nameMatchScore(a: string, b: string): number {
  const na = normalizeText(a)
  const nb = normalizeText(b)

  if (!na || !nb) return 0

  // Exact normalized match
  if (na === nb) return 100

  // Containment: one string contains the other
  const minLen = Math.min(na.length, nb.length)
  const maxLen = Math.max(na.length, nb.length)
  if (na.includes(nb) || nb.includes(na)) {
    return Math.round(90 * (minLen / maxLen))
  }

  // Jaccard on words longer than 2 chars
  const wordsA = new Set(na.split(' ').filter(w => w.length > 2))
  const wordsB = new Set(nb.split(' ').filter(w => w.length > 2))

  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let intersection = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++
  }

  if (intersection === 0) return 0

  const union = wordsA.size + wordsB.size - intersection
  const jaccard = intersection / union

  return Math.round(jaccard * 80)
}

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

interface MarketWeights {
  identifiantFormatValid: number
  identifiantActiveInRegistry: number
  docOcrSuccess: number
  identifiantMatchDocVsApi: number
  nameMatchDocVsApiMax: number
  nameMatchDocVsIdMax: number
}

const WEIGHTS: Record<KycMarket, MarketWeights> = {
  fr_artisan: {
    identifiantFormatValid: 10,
    identifiantActiveInRegistry: 30,
    docOcrSuccess: 10,
    identifiantMatchDocVsApi: 20,
    nameMatchDocVsApiMax: 15,
    nameMatchDocVsIdMax: 15,
  },
  fr_btp: {
    identifiantFormatValid: 10,
    identifiantActiveInRegistry: 30,
    docOcrSuccess: 10,
    identifiantMatchDocVsApi: 20,
    nameMatchDocVsApiMax: 15,
    nameMatchDocVsIdMax: 15,
  },
  pt_artisan: {
    identifiantFormatValid: 15,
    identifiantActiveInRegistry: 20,
    docOcrSuccess: 15,
    identifiantMatchDocVsApi: 15,
    nameMatchDocVsApiMax: 20,
    nameMatchDocVsIdMax: 15,
  },
}

export function computeKycScore(checks: KycChecks, market: KycMarket): number {
  // Blocking check
  if (!checks.identifiantFormatValid) return 0

  const w = WEIGHTS[market]
  let score = 0

  score += w.identifiantFormatValid
  if (checks.identifiantActiveInRegistry) score += w.identifiantActiveInRegistry
  if (checks.docOcrSuccess) score += w.docOcrSuccess
  if (checks.identifiantMatchDocVsApi) score += w.identifiantMatchDocVsApi
  score += Math.round((checks.nameMatchDocVsApi / 100) * w.nameMatchDocVsApiMax)
  score += Math.round((checks.nameMatchDocVsId / 100) * w.nameMatchDocVsIdMax)

  return Math.min(100, Math.max(0, score))
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export function decideKycStatus(score: number): KycResult['decision'] {
  if (score >= 80) return 'approved'
  if (score < 40) return 'rejected'
  return 'manual_review'
}

// ---------------------------------------------------------------------------
// Human-readable details
// ---------------------------------------------------------------------------

export function buildKycDetails(
  checks: KycChecks,
  score: number,
  market: KycMarket,
): string[] {
  const details: string[] = []
  const isPt = market === 'pt_artisan'

  if (isPt) {
    details.push(
      checks.identifiantFormatValid
        ? 'NIF válido'
        : 'NIF inválido (formato ou dígito de controlo)',
    )
    details.push(
      checks.identifiantActiveInRegistry
        ? 'Empresa ativa no registo português'
        : 'Empresa não encontrada ou cessada no registo',
    )
    details.push(
      checks.docOcrSuccess
        ? 'Certidão Permanente analisada com sucesso por OCR'
        : 'OCR da Certidão parcial ou falhou — revisão manual recomendada',
    )
    details.push(
      checks.identifiantMatchDocVsApi
        ? 'NIF idêntico entre Certidão e registo'
        : 'NIF extraído da Certidão não corresponde ao registo',
    )
    details.push(
      `Correspondência denominação Certidão/registo : ${checks.nameMatchDocVsApi}%`,
    )
    details.push(
      `Correspondência gerente Certidão/CC : ${checks.nameMatchDocVsId}%`,
    )
  } else {
    // fr_artisan and fr_btp
    const docLabel = market === 'fr_btp' ? 'KBIS' : 'KBIS'
    const idLabel = market === 'fr_btp' ? 'SIRET' : 'SIRET'

    details.push(
      checks.identifiantFormatValid
        ? `${idLabel} valide (format et clé de Luhn)`
        : `${idLabel} invalide (format ou clé de contrôle)`,
    )
    details.push(
      checks.identifiantActiveInRegistry
        ? 'Entreprise active dans le registre INSEE/Sirene'
        : 'Entreprise non trouvée ou radiée dans le registre INSEE/Sirene',
    )
    details.push(
      checks.docOcrSuccess
        ? `${docLabel} analysé avec succès par OCR`
        : `OCR du ${docLabel} partiel ou échoué — révision manuelle recommandée`,
    )
    details.push(
      checks.identifiantMatchDocVsApi
        ? `${idLabel} identique entre ${docLabel} et registre`
        : `${idLabel} extrait du ${docLabel} ne correspond pas au registre`,
    )
    details.push(
      `Correspondance dénomination ${docLabel}/registre : ${checks.nameMatchDocVsApi}%`,
    )
    details.push(
      `Correspondance représentant ${docLabel}/CNI : ${checks.nameMatchDocVsId}%`,
    )
  }

  // Score summary
  const decision = decideKycStatus(score)
  if (isPt) {
    const decisionLabel =
      decision === 'approved'
        ? 'aprovado'
        : decision === 'rejected'
          ? 'rejeitado'
          : 'revisão manual'
    details.push(`Score KYC : ${score}/100 — ${decisionLabel}`)
  } else {
    const decisionLabel =
      decision === 'approved'
        ? 'approuvé'
        : decision === 'rejected'
          ? 'rejeté'
          : 'révision manuelle'
    details.push(`Score KYC : ${score}/100 — ${decisionLabel}`)
  }

  return details
}
