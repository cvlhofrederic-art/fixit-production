/**
 * lib/tva-calculator.ts — Régimes de TVA et calculs centralisés.
 *
 * Trois régimes légaux supportés :
 *   - classique         : Assujetti normal, TVA collectée par taux
 *   - franchise_293b    : Franchise en base — CGI art. 293 B
 *                         (abrogé au 1er septembre 2026, ord. n°2025-1247 du 17/12/2025)
 *   - autoliquidation_btp : Sous-traitance BTP — CGI art. 283, 2 nonies
 *                         (la TVA est due par le preneur, pas par le sous-traitant)
 *
 * Source unique de vérité pour :
 *   - le calcul du breakdown TVA par taux
 *   - les totaux HT / TVA / TTC
 *   - les libellés et colonnes PDF
 *   - les mentions légales obligatoires
 *   - les garde-fous de cohérence (validateRegime)
 *
 * Branché par :
 *   - components/DevisFactureFormBTP.tsx (V3 BTP pro)
 *   - lib/pdf/devis-pdf-v3.ts (PDF V3)
 *   - lib/validation.ts (Zod sync)
 *   - app/api/devis/sync/route.ts, app/api/factures/sync/route.ts
 */

import { mulMoney, round2, sumMoney, assertInvoiceInvariant } from '@/lib/money'

export const TVA_REGIMES = ['classique', 'franchise_293b', 'autoliquidation_btp'] as const

export type TvaRegime = typeof TVA_REGIMES[number]

export type TvaLocale = 'fr' | 'pt'

/**
 * Mentions légales obligatoires à apposer sur la facture selon le régime et la locale.
 *
 * Wording conforme aux sources officielles (vérifié 2026-05-12) :
 *
 * **France (locale='fr') :**
 *   - art. 293 B CGI         : "TVA non applicable, article 293 B du CGI."
 *   - art. 283, 2 nonies CGI : "Autoliquidation — Article 283, 2 nonies du CGI..."
 *     (BOFiP impose au minimum "Autoliquidation" — wording étendu retenu pour rigueur)
 *
 * **Portugal (locale='pt') :**
 *   - art. 53.º CIVA                       : "IVA não aplicável, artigo 53.º do CIVA."
 *   - art. 2.º n.º 1 al. j) CIVA           : "IVA - autoliquidação..." (forme courte
 *     obligatoire selon Portal das Finanças, wording étendu cite l'article)
 *
 * Note : `franchise_293b` est un nom français mais le code couvre aussi son équivalent PT
 * (art. 53.º CIVA = régime de isenção). Idem `autoliquidation_btp` ↔ inversão do sujeito
 * passivo. Renommer l'enum imposerait une migration DB ; on garde le nom FR et on adapte
 * juste le wording rendu.
 */
const MENTIONS_BY_LOCALE: Record<TvaLocale, Record<TvaRegime, string | null>> = {
  fr: {
    classique: null,
    franchise_293b: 'TVA non applicable, article 293 B du CGI.',
    autoliquidation_btp: 'Autoliquidation — Article 283, 2 nonies du CGI. TVA due par le preneur.',
  },
  pt: {
    classique: null,
    franchise_293b: 'IVA não aplicável, artigo 53.º do CIVA.',
    autoliquidation_btp: 'IVA - autoliquidação, alínea j) do n.º 1 do artigo 2.º do CIVA.',
  },
}

/** Retourne la mention légale officielle pour le régime + locale. */
export function getMentionLegale(regime: TvaRegime, locale: TvaLocale = 'fr'): string | null {
  return MENTIONS_BY_LOCALE[locale][regime]
}

/**
 * Rétro-compat : alias de MENTIONS_BY_LOCALE.fr pour les callers existants
 * qui ne sont pas locale-aware. Préférer getMentionLegale() pour le nouveau code.
 */
export const MENTIONS_LEGALES: Record<TvaRegime, string | null> = MENTIONS_BY_LOCALE.fr

export interface TvaLineInput {
  totalHT: number
  tvaRate: number
}

export interface TvaBreakdownEntry {
  rate: number
  base: number
  amount: number
}

export interface TvaComputation {
  regime: TvaRegime
  breakdown: TvaBreakdownEntry[]
  totalHT: number
  totalTVA: number
  totalTTC: number
  totalLabel: 'TOTAL TTC' | 'TOTAL NET'
  mention: string | null
  showsTvaBreakdown: boolean
  invariantOk: boolean
  requiresClientSiren: boolean
  requiresEmitterTvaIntra: boolean
}

export interface ComputeTvaOptions {
  regime: TvaRegime
  lines: TvaLineInput[]
  /** Locale pour les mentions légales — 'fr' (défaut) ou 'pt'. */
  locale?: TvaLocale
}

export function computeTva({ regime, lines, locale = 'fr' }: ComputeTvaOptions): TvaComputation {
  const safeLines: TvaLineInput[] = (lines || [])
    .filter(l => l && Number.isFinite(l.totalHT))
    .map(l => ({ totalHT: l.totalHT, tvaRate: Number.isFinite(l.tvaRate) ? l.tvaRate : 0 }))

  const totalHT = sumMoney(safeLines.map(l => l.totalHT))

  if (regime === 'franchise_293b' || regime === 'autoliquidation_btp') {
    return {
      regime,
      breakdown: [],
      totalHT,
      totalTVA: 0,
      totalTTC: totalHT,
      totalLabel: 'TOTAL NET',
      mention: getMentionLegale(regime, locale),
      showsTvaBreakdown: false,
      invariantOk: true,
      requiresClientSiren: regime === 'autoliquidation_btp',
      requiresEmitterTvaIntra: regime === 'autoliquidation_btp',
    }
  }

  const byRate = new Map<number, number>()
  for (const l of safeLines) {
    if (l.tvaRate <= 0) continue
    byRate.set(l.tvaRate, round2((byRate.get(l.tvaRate) || 0) + l.totalHT))
  }

  const breakdown: TvaBreakdownEntry[] = Array.from(byRate.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, base]) => ({
      rate,
      base,
      amount: mulMoney(base, rate / 100),
    }))

  const totalTVA = sumMoney(breakdown.map(b => b.amount))
  const totalTTC = round2(totalHT + totalTVA)
  const invariant = assertInvoiceInvariant(totalHT, totalTVA, totalTTC)

  return {
    regime: 'classique',
    breakdown,
    totalHT,
    totalTVA,
    totalTTC,
    totalLabel: 'TOTAL TTC',
    mention: null,
    showsTvaBreakdown: true,
    invariantOk: invariant.ok,
    requiresClientSiren: false,
    requiresEmitterTvaIntra: false,
  }
}

export type TvaRegimeError =
  | 'issuer_franchise_cannot_charge_tva'
  | 'issuer_franchise_cannot_autoliquidate'
  | 'client_particulier_cannot_autoliquidate'
  | 'autoliquidation_requires_client_siren'
  | 'autoliquidation_requires_emitter_tva_intra'

export interface ValidateRegimeContext {
  regime: TvaRegime
  issuerRegime?: 'assujetti_normal' | 'franchise_base'
  clientType?: 'particulier' | 'professionnel'
  clientSiren?: string | null
  emitterTvaIntra?: string | null
}

export function validateRegime(ctx: ValidateRegimeContext): TvaRegimeError[] {
  const errors: TvaRegimeError[] = []

  if (ctx.regime === 'classique' && ctx.issuerRegime === 'franchise_base') {
    errors.push('issuer_franchise_cannot_charge_tva')
  }

  if (ctx.regime === 'autoliquidation_btp') {
    if (ctx.issuerRegime === 'franchise_base') {
      errors.push('issuer_franchise_cannot_autoliquidate')
    }
    if (ctx.clientType === 'particulier') {
      errors.push('client_particulier_cannot_autoliquidate')
    }
    if (!ctx.clientSiren || ctx.clientSiren.trim() === '') {
      errors.push('autoliquidation_requires_client_siren')
    }
    if (!ctx.emitterTvaIntra || ctx.emitterTvaIntra.trim() === '') {
      errors.push('autoliquidation_requires_emitter_tva_intra')
    }
  }

  return errors
}

export const REGIME_ERROR_MESSAGES: Record<TvaRegimeError, string> = {
  issuer_franchise_cannot_charge_tva:
    'Société en franchise en base (art. 293 B) — facturation avec TVA interdite. Article 283-3 du CGI : la TVA mentionnée serait due.',
  issuer_franchise_cannot_autoliquidate:
    'Société en franchise en base — l\'autoliquidation BTP nécessite d\'être assujetti à la TVA.',
  client_particulier_cannot_autoliquidate:
    'L\'autoliquidation BTP ne s\'applique qu\'entre professionnels assujettis (art. 283, 2 nonies).',
  autoliquidation_requires_client_siren:
    'SIREN du donneur d\'ordre obligatoire pour l\'autoliquidation BTP.',
  autoliquidation_requires_emitter_tva_intra:
    'N° de TVA intracommunautaire émetteur obligatoire pour l\'autoliquidation BTP.',
}
