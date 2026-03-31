// ── Tenders Alert System ─────────────────────────────────────────────────────

import type { Tender, AlertRule } from './types'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

interface AlertMatch {
  artisan_id: string
  tenders: Tender[]
  rule: AlertRule
}

/**
 * Check new tenders against alert rules. Returns matches grouped by artisan.
 */
export async function checkAlerts(
  newTenders: Tender[],
  rules: AlertRule[]
): Promise<AlertMatch[]> {
  const matches: AlertMatch[] = []

  for (const rule of rules) {
    const matched = newTenders.filter((tender) => {
      // Trade match — at least one rule trade matches the tender
      const tradeOk =
        rule.trades.length === 0 ||
        rule.trades.some((t) => {
          const lower = t.toLowerCase()
          return (
            tender.trade?.toLowerCase() === lower ||
            tender.trade_keywords?.some((kw) => kw.toLowerCase().includes(lower)) ||
            tender.title.toLowerCase().includes(lower) ||
            tender.description.toLowerCase().includes(lower)
          )
        })

      // City match — case-insensitive
      const cityOk =
        rule.cities.length === 0 ||
        rule.cities.some(
          (c) => tender.city.toLowerCase() === c.toLowerCase()
        )

      // Budget range
      const budgetOk = checkBudgetRange(
        tender.estimated_budget,
        rule.min_budget,
        rule.max_budget
      )

      return tradeOk && cityOk && budgetOk
    })

    if (matched.length > 0) {
      matches.push({
        artisan_id: rule.artisan_id,
        tenders: matched,
        rule,
      })
    }
  }

  return matches
}

/**
 * Convert artisan marches preferences into an AlertRule.
 */
export function createAlertsFromPrefs(
  artisanId: string,
  prefs: Record<string, unknown>
): AlertRule {
  const categories = Array.isArray(prefs.marches_categories)
    ? (prefs.marches_categories as string[])
    : []

  const cities: string[] = []
  if (typeof prefs.city === 'string' && prefs.city) {
    cities.push(prefs.city)
  }
  if (Array.isArray(prefs.cities)) {
    cities.push(...(prefs.cities as string[]))
  }

  return {
    artisan_id: artisanId,
    trades: categories,
    cities: [...new Set(cities)],
    min_budget:
      typeof prefs.min_budget === 'number' ? prefs.min_budget : undefined,
    max_budget:
      typeof prefs.max_budget === 'number' ? prefs.max_budget : undefined,
    notify_email: prefs.marches_opt_in === true || prefs.notify_email === true,
    notify_push: prefs.notify_push === true,
  }
}

/**
 * Insert notifications into artisan_notifications for each match.
 */
export async function sendAlertNotifications(
  matches: { artisan_id: string; tenders: Tender[] }[]
): Promise<void> {
  if (matches.length === 0) return

  const notifications = matches.map(({ artisan_id, tenders }) => {
    const cities = [...new Set(tenders.map((t) => t.city).filter(Boolean))]
    const trades = [...new Set(tenders.map((t) => t.trade).filter(Boolean))]
    const count = tenders.length

    const cityStr = cities.length > 0 ? cities.slice(0, 3).join(', ') : 'votre zone'
    const tradeStr = trades.length > 0 ? trades.slice(0, 3).join(', ') : 'BTP'

    return {
      artisan_id,
      type: 'tender_alert',
      title: `${count} nouveau${count > 1 ? 'x' : ''} marché${count > 1 ? 's' : ''} BTP`,
      body: `${tradeStr} à ${cityStr}`,
      metadata: {
        tender_ids: tenders.map((t) => t.id),
        cities,
        trades,
        count,
      },
      read: false,
      created_at: new Date().toISOString(),
    }
  })

  const { error } = await supabase
    .from('artisan_notifications')
    .insert(notifications)

  if (error) {
    logger.error('Failed to insert tender alert notifications', {
      error: error.message,
      count: notifications.length,
    })
    return
  }

  logger.info('Tender alert notifications sent', {
    artisans: notifications.length,
    total_tenders: matches.reduce((sum, m) => sum + m.tenders.length, 0),
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function checkBudgetRange(
  estimated?: number,
  min?: number,
  max?: number
): boolean {
  if (min !== undefined && (estimated === undefined || estimated < min)) {
    return false
  }
  if (max !== undefined && (estimated === undefined || estimated > max)) {
    return false
  }
  return true
}
