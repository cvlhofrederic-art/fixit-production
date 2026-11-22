// KYC anti-fraud scoring engine — purely functional, no I/O, no network calls

// pt_btp : société BTP inscrite en portugais (NIPC, VIES, certidão permanente), depuis le 22/11/2026.
export type KycMarket = 'fr_artisan' | 'fr_btp' | 'pt_artisan' | 'pt_btp'

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
  /** Correspondance de la dénomination comptée à partir de ce taux seulement (0 si absent : dès le premier point). */
  nameMatchDocVsApiMin?: number
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
  // Société BTP portugaise. Aucune comparaison automatique avec la pièce d'identité : la fiche d'une société n'a pas
  // le nom de son gérant (ni first_name ni last_name en production). Une approbation automatique (80) exige, comme
  // pour une société française, le registre (VIES), la certidão lue, son NIPC (celui de la matrícula) et une firma
  // ressemblant au nom du registre à 64 % au moins : sans l'un d'eux, le score reste à 75 au plus.
  pt_btp: {
    identifiantFormatValid: 10,
    identifiantActiveInRegistry: 30,
    docOcrSuccess: 10,
    identifiantMatchDocVsApi: 25,
    nameMatchDocVsApiMax: 25,
    nameMatchDocVsApiMin: 64,
    nameMatchDocVsIdMax: 0,
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
  const denomination = checks.nameMatchDocVsApi >= (w.nameMatchDocVsApiMin ?? 0) ? checks.nameMatchDocVsApi : 0
  score += Math.round((denomination / 100) * w.nameMatchDocVsApiMax)
  score += Math.round((checks.nameMatchDocVsId / 100) * w.nameMatchDocVsIdMax)

  return Math.min(100, Math.max(0, score))
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export function decideKycStatus(score: number, market?: KycMarket): KycResult['decision'] {
  if (score >= 80) return 'approved'
  // Société BTP portugaise : seul un NIPC invalide (score 0, contrôle bloquant) est rejeté d'office. VIES ignore une
  // société exonérée de TVA et peut être indisponible, et une certidão en PDF n'est pas lue : le reste va en revue
  // manuelle, au lieu de sortir la société de la liste « En attente » du panneau d'administration.
  if (market === 'pt_btp' && score > 0) return 'manual_review'
  if (score < 40) return 'rejected'
  return 'manual_review'
}

// ---------------------------------------------------------------------------
// Human-readable details
// ---------------------------------------------------------------------------

const LIBELLES_DECISION_PT: Record<KycResult['decision'], string> = {
  approved: 'aprovado',
  manual_review: 'revisão manual',
  rejected: 'rejeitado',
}

/** Messages du KYC d'une société BTP portugaise (marché pt_btp), en portugais comme ceux de l'artisan portugais. */
function detailsSocieteBtpPortugaise(checks: KycChecks, score: number): string[] {
  return [
    checks.identifiantFormatValid ? 'NIPC válido' : 'NIPC inválido (formato ou dígito de controlo)',
    checks.identifiantActiveInRegistry
      ? 'Empresa ativa no VIES (registo de IVA)'
      : 'Empresa não confirmada no VIES (sem registo de IVA, ou serviço indisponível)',
    checks.docOcrSuccess
      ? 'Certidão Permanente lida por OCR'
      : 'Certidão Permanente não lida (PDF ou imagem ilegível) — revisão manual',
    checks.identifiantMatchDocVsApi
      ? 'NIPC da matrícula idêntico ao declarado'
      : 'NIPC da matrícula diferente do declarado, ou não lido',
    `Correspondência firma Certidão/registo : ${checks.nameMatchDocVsApi}% (contada a partir de ${WEIGHTS.pt_btp.nameMatchDocVsApiMin}%)`,
    'Cartão de Cidadão do gerente : verificação manual',
    `Score KYC : ${score}/100 — ${LIBELLES_DECISION_PT[decideKycStatus(score, 'pt_btp')]}`,
  ]
}

export function buildKycDetails(
  checks: KycChecks,
  score: number,
  market: KycMarket,
): string[] {
  if (market === 'pt_btp') return detailsSocieteBtpPortugaise(checks, score)

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
