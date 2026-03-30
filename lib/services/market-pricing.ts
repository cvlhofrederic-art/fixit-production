/**
 * Market Pricing Service — BTP Pro Analytics
 *
 * Compares your rates against market benchmarks.
 * Pure functions, no React.
 */

import type { Country } from '@/lib/config/companyTypes'
import type { MarketComparison } from './pipeline-types'
import { findClosestTrade, getMarketRatesForCountry } from '@/lib/config/market-rates'

// ════════════════════════════════════════════
//  SINGLE TRADE COMPARISON
// ════════════════════════════════════════════

export interface MarketPricingInput {
  trade: string
  your_rate_hour: number    // Your actual selling price €/h HT
  country: Country
}

export function compareToMarket(input: MarketPricingInput): MarketComparison {
  const { trade, your_rate_hour, country } = input
  const marketRate = findClosestTrade(trade, country)

  // Calculate percentile (0-100)
  const range = marketRate.max_hour - marketRate.min_hour
  const percentile = range > 0
    ? Math.round(Math.min(100, Math.max(0, ((your_rate_hour - marketRate.min_hour) / range) * 100)))
    : 50

  // Strategy
  const strategy = determineStrategy(percentile, your_rate_hour, marketRate.avg_hour)

  return {
    trade: marketRate.trade,
    your_rate_hour,
    market_min: marketRate.min_hour,
    market_avg: marketRate.avg_hour,
    market_max: marketRate.max_hour,
    percentile,
    strategy,
    country,
  }
}

function determineStrategy(
  percentile: number,
  yourRate: number,
  avgRate: number
): 'increase' | 'reduce' | 'ok' {
  // Below 25th percentile: you're underpriced
  if (percentile < 25) return 'increase'
  // Above 85th percentile: you might be overpriced
  if (percentile > 85) return 'reduce'
  return 'ok'
}

// ════════════════════════════════════════════
//  BATCH COMPARISON (all trades for a company)
// ════════════════════════════════════════════

export interface TradeRate {
  trade: string
  rate_hour: number
}

export function compareAllTrades(
  trades: TradeRate[],
  country: Country
): MarketComparison[] {
  return trades.map(t =>
    compareToMarket({ trade: t.trade, your_rate_hour: t.rate_hour, country })
  )
}

// ════════════════════════════════════════════
//  RATE FROM COST (derive selling price from cost)
// ════════════════════════════════════════════

/**
 * Given an employee cost/hour, calculate what you'd need to charge
 * to achieve a target margin.
 *
 * selling_price = cost / (1 - target_margin)
 */
export function sellingPriceFromCost(
  costPerHour: number,
  targetMarginPct: number  // 20 = 20%
): number {
  const margin = targetMarginPct / 100
  if (margin >= 1) return costPerHour * 10 // safety
  return Math.round((costPerHour / (1 - margin)) * 100) / 100
}

/**
 * Given a selling price and cost, what's the actual margin?
 */
export function actualMargin(sellingPrice: number, costPerHour: number): number {
  if (sellingPrice <= 0) return 0
  return Math.round(((sellingPrice - costPerHour) / sellingPrice) * 1000) / 10
}
