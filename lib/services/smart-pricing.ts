/**
 * Smart Pricing Engine — BTP Pro Analytics
 *
 * Optimal price = cost + margin + market position.
 * Combines payroll output, market data, and target margin.
 * Pure functions, no React.
 */

import type { Country } from '@/lib/config/companyTypes'
import type { PricingRecommendation } from './pipeline-types'
import { findClosestTrade } from '@/lib/config/market-rates'

// ════════════════════════════════════════════
//  MAIN PRICING ENGINE
// ════════════════════════════════════════════

export interface SmartPricingInput {
  // From payroll engine
  cost_per_hour: number         // Employer cost/h (from PayrollBreakdown)
  cost_per_day: number          // Employer cost/day

  // Overhead
  overhead_per_day?: number     // Frais fixes / nb jours travaillés
  frais_fixes_mensuel?: number  // If overhead_per_day not provided, we calculate it
  nb_workers?: number           // To split overhead

  // Target
  target_margin_pct: number     // 20 = 20%

  // Market reference
  trade: string
  country: Country
}

export function calculateSmartPricing(input: SmartPricingInput): PricingRecommendation {
  const {
    cost_per_hour,
    cost_per_day,
    target_margin_pct,
    trade,
    country,
  } = input

  // Calculate overhead per day
  const workingDaysMonth = 21.67
  let overheadPerDay = input.overhead_per_day ?? 0
  if (!overheadPerDay && input.frais_fixes_mensuel) {
    const nbWorkers = Math.max(1, input.nb_workers ?? 1)
    overheadPerDay = input.frais_fixes_mensuel / workingDaysMonth / nbWorkers
  }
  overheadPerDay = Math.round(overheadPerDay * 100) / 100

  // Daily cost = employee cost/day + overhead share
  const dailyCost = cost_per_day + overheadPerDay

  // Market rates
  const market = findClosestTrade(trade, country)
  const marketMin = market.min_day
  const marketMax = market.max_day

  // Target margin
  const marginFraction = target_margin_pct / 100

  // Optimal price = cost / (1 - margin)
  const optimalPriceDay = marginFraction < 1
    ? Math.round(dailyCost / (1 - marginFraction))
    : dailyCost * 2

  const hoursPerDay = 7
  const optimalPriceHour = Math.round((optimalPriceDay / hoursPerDay) * 100) / 100

  // Price corridor
  const minCompetitive = Math.max(
    Math.round(dailyCost * 1.05), // At least 5% above cost
    Math.round(marketMin * 0.9)    // Not more than 10% below market min
  )

  const recommended = optimalPriceDay

  const premium = Math.round(
    Math.min(
      dailyCost / (1 - Math.min(marginFraction + 0.10, 0.50)), // margin + 10 pts
      marketMax * 1.1 // cap at 10% above market max
    )
  )

  // Strategy
  const strategy = determineStrategy(optimalPriceDay, marketMin, marketMax, market.avg_day)

  return {
    daily_cost: Math.round(dailyCost),
    overhead_per_day: overheadPerDay,
    target_margin: target_margin_pct,
    market_min: marketMin,
    market_max: marketMax,
    optimal_price_day: optimalPriceDay,
    optimal_price_hour: optimalPriceHour,
    price_corridor: {
      min_competitive: minCompetitive,
      recommended,
      premium,
    },
    strategy,
  }
}

function determineStrategy(
  optimal: number,
  marketMin: number,
  marketMax: number,
  marketAvg: number
): 'increase' | 'reduce' | 'ok' {
  // If optimal price is below market min, room to increase
  if (optimal < marketMin) return 'increase'
  // If optimal price is above market max, might need to reduce margin or cost
  if (optimal > marketMax) return 'reduce'
  return 'ok'
}

// ════════════════════════════════════════════
//  SCENARIO SIMULATION
// ════════════════════════════════════════════

export interface PricingScenario {
  label: string
  margin_pct: number
  price_day: number
  price_hour: number
  monthly_revenue_per_worker: number
  annual_revenue_per_worker: number
}

/**
 * Generate 3 scenarios: conservative, target, aggressive
 */
export function generateScenarios(
  dailyCost: number,
  targetMarginPct: number
): PricingScenario[] {
  const hoursPerDay = 7
  const workDaysMonth = 21.67

  const margins = [
    { label: 'Prudent', pct: Math.max(5, targetMarginPct - 10) },
    { label: 'Objectif', pct: targetMarginPct },
    { label: 'Ambitieux', pct: Math.min(50, targetMarginPct + 10) },
  ]

  return margins.map(m => {
    const fraction = m.pct / 100
    const priceDay = fraction < 1 ? Math.round(dailyCost / (1 - fraction)) : dailyCost * 2
    const priceHour = Math.round((priceDay / hoursPerDay) * 100) / 100
    const monthlyRev = Math.round(priceDay * workDaysMonth)
    const annualRev = monthlyRev * 12

    return {
      label: m.label,
      margin_pct: m.pct,
      price_day: priceDay,
      price_hour: priceHour,
      monthly_revenue_per_worker: monthlyRev,
      annual_revenue_per_worker: annualRev,
    }
  })
}
