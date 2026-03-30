/**
 * Quote Generator — BTP Pro Analytics
 *
 * Generates structured quote lines from smart pricing + duration + payroll.
 * Output feeds directly into DevisFactureForm.
 * Pure functions, no React.
 */

import type {
  QuoteLine,
  GeneratedQuote,
  DurationEstimate,
} from './pipeline-types'
import type { PricingRecommendation } from './pipeline-types'

// ════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════

export interface QuoteInput {
  // Task info
  description: string
  task_type: string
  surface_m2?: number
  quantity?: number
  unite: string                // m², ml, h, j, f, lot

  // Pricing source
  pricing: PricingRecommendation
  duration?: DurationEstimate

  // Materials
  materiaux?: MaterialLine[]

  // Options
  tva_rate?: number           // Default: 0.20 (FR) or 0.23 (PT)
  target_margin_pct?: number  // Override pricing margin
  include_fournitures?: boolean
}

export interface MaterialLine {
  description: string
  quantite: number
  prix_unitaire_ht: number
  unite: string
}

// ════════════════════════════════════════════
//  MAIN GENERATOR
// ════════════════════════════════════════════

export function generateQuote(input: QuoteInput): GeneratedQuote {
  const {
    description,
    surface_m2,
    quantity,
    unite,
    pricing,
    duration,
    materiaux = [],
    tva_rate = 0.20,
  } = input

  const lines: QuoteLine[] = []

  // ── Main d'oeuvre line ──
  const qty = surface_m2 || quantity || 1

  if (duration && duration.duration_days > 0) {
    // Price based on duration (jours)
    lines.push({
      description: `Main d'œuvre — ${description}`,
      unite: 'j',
      quantite: duration.duration_days * duration.nb_workers,
      prix_unitaire_ht: pricing.optimal_price_day,
      tva_rate,
      montant_ht: Math.round(duration.duration_days * duration.nb_workers * pricing.optimal_price_day),
      category: 'main_oeuvre',
    })
  } else {
    // Price per unit
    const prixUnitaire = calculateUnitPrice(pricing, unite, qty)
    lines.push({
      description: `Main d'œuvre — ${description}`,
      unite,
      quantite: qty,
      prix_unitaire_ht: prixUnitaire,
      tva_rate,
      montant_ht: Math.round(qty * prixUnitaire),
      category: 'main_oeuvre',
    })
  }

  // ── Matériaux lines ──
  for (const mat of materiaux) {
    const montant = Math.round(mat.quantite * mat.prix_unitaire_ht)
    lines.push({
      description: mat.description,
      unite: mat.unite,
      quantite: mat.quantite,
      prix_unitaire_ht: mat.prix_unitaire_ht,
      tva_rate,
      montant_ht: montant,
      category: 'materiaux',
    })
  }

  // ── Fournitures (small consumables, % of main d'oeuvre) ──
  if (input.include_fournitures !== false) {
    const moTotal = lines
      .filter(l => l.category === 'main_oeuvre')
      .reduce((s, l) => s + l.montant_ht, 0)

    if (moTotal > 0) {
      const fournituresPct = 0.03 // 3% of labor
      const fournituresMontant = Math.round(moTotal * fournituresPct)
      if (fournituresMontant > 0) {
        lines.push({
          description: 'Fournitures et consommables',
          unite: 'f',
          quantite: 1,
          prix_unitaire_ht: fournituresMontant,
          tva_rate,
          montant_ht: fournituresMontant,
          category: 'fournitures',
        })
      }
    }
  }

  // ── Totals ──
  const totalHT = lines.reduce((s, l) => s + l.montant_ht, 0)
  const totalTVA = Math.round(totalHT * tva_rate)
  const totalTTC = totalHT + totalTVA

  // Marge effective
  const costMO = duration
    ? duration.duration_days * duration.nb_workers * pricing.daily_cost
    : qty * pricing.daily_cost / 7 // approximate
  const totalCost = costMO + materiaux.reduce((s, m) => s + m.quantite * m.prix_unitaire_ht, 0)
  const margePrevue = totalHT > 0 ? ((totalHT - totalCost) / totalHT) * 100 : 0

  return {
    lines,
    total_ht: totalHT,
    total_tva: totalTVA,
    total_ttc: totalTTC,
    marge_prevue_pct: Math.round(margePrevue * 10) / 10,
    duration_estimate: duration,
    pricing_source: 'engine',
  }
}

function calculateUnitPrice(
  pricing: PricingRecommendation,
  unite: string,
  _qty: number
): number {
  switch (unite) {
    case 'h':
      return pricing.optimal_price_hour
    case 'j':
      return pricing.optimal_price_day
    case 'm2':
    case 'ml':
      // Price per m² = daily price / avg productivity (assume 10 m²/day as fallback)
      return Math.round((pricing.optimal_price_day / 10) * 100) / 100
    default:
      return pricing.optimal_price_hour
  }
}

// ════════════════════════════════════════════
//  QUOTE FROM TEMPLATE
// ════════════════════════════════════════════

export interface QuoteTemplate {
  label_fr: string
  label_pt: string
  lines: Array<{
    description_fr: string
    description_pt: string
    unite: string
    category: QuoteLine['category']
    price_factor: number // Multiplier of daily rate
  }>
}

/**
 * Apply a template to generate a full quote.
 * Templates define standard line items for common BTP jobs.
 */
export function applyTemplate(
  template: QuoteTemplate,
  pricing: PricingRecommendation,
  quantity: number,
  tvaRate: number,
  locale: 'fr' | 'pt' = 'fr'
): GeneratedQuote {
  const lines: QuoteLine[] = template.lines.map(tl => {
    const prixUnitaire = Math.round(pricing.optimal_price_day * tl.price_factor * 100) / 100
    const montant = Math.round(quantity * prixUnitaire)
    return {
      description: locale === 'pt' ? tl.description_pt : tl.description_fr,
      unite: tl.unite,
      quantite: quantity,
      prix_unitaire_ht: prixUnitaire,
      tva_rate: tvaRate,
      montant_ht: montant,
      category: tl.category,
    }
  })

  const totalHT = lines.reduce((s, l) => s + l.montant_ht, 0)
  const totalTVA = Math.round(totalHT * tvaRate)

  return {
    lines,
    total_ht: totalHT,
    total_tva: totalTVA,
    total_ttc: totalHT + totalTVA,
    marge_prevue_pct: pricing.target_margin,
    pricing_source: 'engine',
  }
}
