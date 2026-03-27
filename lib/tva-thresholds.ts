/**
 * lib/tva-thresholds.ts
 * Logique TVA/IVA — seuils d'exonération France & Portugal 2026
 * Source FR : art. 293B CGI (seuils révisés au 1er jan 2025)
 * Source PT : art. 53.º CIVA
 */

export type TvaCountry = 'FR' | 'PT'
export type TvaStatus = 'safe' | 'warning' | 'exceeded' | 'exceeded_majore'
export type TvaNotifiedLevel = 'warning' | 'exceeded' | 'exceeded_majore' | null

export interface TvaStatusResult {
  status: TvaStatus
  percent: number
  caHT: number
  seuil: number
  seuilMajore?: number
  taux: number
  title: { fr: string; pt: string }
  message: { fr: string; pt: string }
  badge: { fr: string; pt: string }
  color: string
  bgColor: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Seuils 2026
// FR : prestations de services (artisans/BTP)
//   seuil de base   37 500 €
//   seuil majoré    41 250 €  (tolérance 2 ans consécutifs)
// PT : art. 53 CIVA — exonération si VN ≤ 14 500 € (taux arrondi à 15 000 dans l'UI)
// ─────────────────────────────────────────────────────────────────────────────
const THRESHOLDS: Record<TvaCountry, { seuil: number; seuilMajore?: number; taux: number }> = {
  FR: { seuil: 37_500, seuilMajore: 41_250, taux: 0.20 },
  PT: { seuil: 14_500, taux: 0.23 },
}

function fmtEur(v: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}

export function getTvaStatus(caHT: number, country: TvaCountry): TvaStatusResult {
  const t = THRESHOLDS[country]
  const rawPct = caHT / t.seuil
  const percent = Math.min(Math.round(rawPct * 100), 999)

  if (country === 'FR') {
    const { seuil, taux } = t
    const seuilMajore = t.seuilMajore ?? 41_250

    if (caHT >= seuilMajore) {
      return {
        status: 'exceeded_majore', percent, caHT, seuil, seuilMajore, taux,
        color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)',
        badge: { fr: 'SEUIL MAJORÉ DÉPASSÉ', pt: 'LIMITE MAJORADO ULTRAPASSADO' },
        title: { fr: '🚨 Seuil majoré TVA dépassé', pt: '🚨 Limite majorado de IVA ultrapassado' },
        message: {
          fr: `Votre CA HT (${fmtEur(caHT)}) dépasse le seuil majoré (${fmtEur(seuilMajore)}). Vous devez facturer la TVA à 20 % dès maintenant et déposer une déclaration auprès des impôts. Consultez un expert-comptable immédiatement.`,
          pt: `O seu volume de negócios (${fmtEur(caHT)}) ultrapassa o limite majorado (${fmtEur(seuilMajore)}). Deve faturar IVA a 20 % imediatamente. Consulte um contabilista.`,
        },
      }
    }

    if (caHT >= seuil) {
      return {
        status: 'exceeded', percent, caHT, seuil, seuilMajore, taux,
        color: '#f97316', bgColor: 'rgba(249,115,22,0.08)',
        badge: { fr: 'SEUIL DÉPASSÉ', pt: 'LIMITE ULTRAPASSADO' },
        title: { fr: '⚠️ Seuil TVA dépassé', pt: '⚠️ Limite de IVA ultrapassado' },
        message: {
          fr: `Votre CA HT (${fmtEur(caHT)}) dépasse le seuil de franchise TVA (${fmtEur(seuil)}). Vous bénéficiez d'une tolérance jusqu'à ${fmtEur(seuilMajore)} (seuil majoré) mais devez anticiper votre passage à la TVA. Au-delà, vous devrez facturer la TVA à 20 %.`,
          pt: `O seu volume de negócios (${fmtEur(caHT)}) ultrapassa o limite de ${fmtEur(seuil)}. Prepare a transição para o regime de IVA com o seu contabilista.`,
        },
      }
    }

    if (caHT >= seuil * 0.8) {
      return {
        status: 'warning', percent, caHT, seuil, seuilMajore, taux,
        color: '#eab308', bgColor: 'rgba(234,179,8,0.08)',
        badge: { fr: 'APPROCHE DU SEUIL', pt: 'A APROXIMAR DO LIMITE' },
        title: { fr: `📊 ${percent}% du seuil TVA atteint`, pt: `📊 ${percent}% do limite de IVA atingido` },
        message: {
          fr: `Vous approchez du seuil de franchise TVA (${fmtEur(seuil)}). À ce rythme, anticipez votre passage à la TVA pour éviter une régularisation en cours d'année. Parlez-en à votre expert-comptable.`,
          pt: `Está a aproximar-se do limite de isenção de IVA (${fmtEur(seuil)}). Prepare o seu registo nas Finanças com antecedência.`,
        },
      }
    }

    return {
      status: 'safe', percent, caHT, seuil, seuilMajore, taux,
      color: '#22c55e', bgColor: 'rgba(34,197,94,0.08)',
      badge: { fr: 'EXONÉRÉ TVA', pt: 'ISENTO DE IVA' },
      title: { fr: '✅ Exonéré de TVA', pt: '✅ Isento de IVA' },
      message: {
        fr: `Votre CA HT (${fmtEur(caHT)}) est sous le seuil de franchise TVA (${fmtEur(seuil)}). Mentionnez sur vos factures : "TVA non applicable, art. 293B du CGI".`,
        pt: `O seu volume de negócios (${fmtEur(caHT)}) está abaixo do limite de isenção (${fmtEur(seuil)}).`,
      },
    }
  }

  // ── Portugal ──────────────────────────────────────────────────────────────
  const { seuil, taux } = t

  if (caHT >= seuil) {
    return {
      status: 'exceeded', percent, caHT, seuil, taux,
      color: '#f97316', bgColor: 'rgba(249,115,22,0.08)',
      badge: { fr: 'SEUIL IVA DÉPASSÉ', pt: 'LIMITE IVA ULTRAPASSADO' },
      title: { fr: '⚠️ Seuil IVA Portugal dépassé', pt: '⚠️ Limite de isenção IVA ultrapassado' },
      message: {
        fr: `Votre CA HT (${fmtEur(caHT)}) dépasse le seuil d'exonération portugais (${fmtEur(seuil)}, art. 53 CIVA). Vous devez vous enregistrer à l'IVA auprès des Finanças et appliquer un taux de 23 %.`,
        pt: `O seu volume de negócios (${fmtEur(caHT)}) ultrapassa o limite de isenção de IVA (${fmtEur(seuil)}, art.º 53.º CIVA). É obrigatório registar-se no IVA junto das Finanças e aplicar a taxa de 23 %.`,
      },
    }
  }

  if (caHT >= seuil * 0.8) {
    return {
      status: 'warning', percent, caHT, seuil, taux,
      color: '#eab308', bgColor: 'rgba(234,179,8,0.08)',
      badge: { fr: 'APPROCHE DU SEUIL IVA', pt: 'A APROXIMAR DO LIMITE IVA' },
      title: { fr: `📊 ${percent}% du seuil IVA Portugal`, pt: `📊 ${percent}% do limite de IVA` },
      message: {
        fr: `Vous approchez du seuil d'exonération IVA portugais (${fmtEur(seuil)}). Préparez votre enregistrement auprès des Finanças pour éviter une régularisation.`,
        pt: `Está a aproximar-se do limite de isenção de IVA (${fmtEur(seuil)}). Prepare o seu registo junto das Finanças portuguesas para evitar regularizações.`,
      },
    }
  }

  return {
    status: 'safe', percent, caHT, seuil, taux,
    color: '#22c55e', bgColor: 'rgba(34,197,94,0.08)',
    badge: { fr: 'EXONÉRÉ IVA', pt: 'ISENTO DE IVA' },
    title: { fr: '✅ Exonéré de TVA (Portugal)', pt: '✅ Isento de IVA (art.º 53.º CIVA)' },
    message: {
      fr: `Votre CA HT (${fmtEur(caHT)}) est sous le seuil d'exonération IVA (${fmtEur(seuil)}).`,
      pt: `O seu volume de negócios (${fmtEur(caHT)}) está abaixo do limite de isenção de IVA (${fmtEur(seuil)}).`,
    },
  }
}

/** Détermine si une nouvelle notification doit être envoyée */
export function shouldNotify(
  newStatus: TvaStatus,
  lastNotifiedLevel: TvaNotifiedLevel
): boolean {
  if (newStatus === 'safe') return false
  const rankMap: Record<string, number> = { warning: 1, exceeded: 2, exceeded_majore: 3 }
  const newRank = rankMap[newStatus] ?? 0
  const lastRank = lastNotifiedLevel ? (rankMap[lastNotifiedLevel] ?? 0) : 0
  return newRank > lastRank
}
