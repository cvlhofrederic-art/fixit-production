// ── POST /api/analytics/track — Batched event ingestion ─────────────────────
// Receives client-side analytics events, validates with Zod, inserts into Supabase.
// Rate limited: 50 events/min per session. No auth required (anonymous tracking).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// ── Zod schema ───────────────────────────────────────────────────────────────

const eventTypeEnum = z.enum([
  'page_view', 'signup_started', 'signup_completed', 'profile_completed',
  'booking_created', 'booking_confirmed', 'booking_completed',
  'review_submitted', 'search_performed', 'devis_generated',
  'subscription_started', 'subscription_upgraded', 'feature_used', 'error_occurred',
])

const eventSchema = z.object({
  event_type: eventTypeEnum,
  user_id: z.string().uuid().optional(),
  session_id: z.string().uuid(),
  properties: z.record(z.string(), z.unknown()).default({}),
  timestamp: z.string().datetime(),
  page_url: z.string().url().max(2048),
  user_agent: z.string().max(1024),
})

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
})

// ── In-memory rate limiter (per session, 50 events/min) ─────────────────────

const rateLimitMap = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT = 50
const WINDOW_MS = 60_000

function checkRateLimit(sessionId: string, eventCount: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(sessionId)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(sessionId, { count: eventCount, windowStart: now })
    return true
  }

  if (entry.count + eventCount > RATE_LIMIT) return false
  entry.count += eventCount
  return true
}

// Periodically prune stale entries (every 5 min, keep map small)
if (typeof globalThis !== 'undefined') {
  const PRUNE_INTERVAL = 5 * 60_000
  setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS * 2
    for (const [key, val] of rateLimitMap) {
      if (val.windowStart < cutoff) rateLimitMap.delete(key)
    }
  }, PRUNE_INTERVAL).unref?.()
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { events } = parsed.data

  // All events in a batch share the same session_id (first event's)
  const sessionId = events[0].session_id
  if (!checkRateLimit(sessionId, events.length)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // Map to DB rows
  const rows = events.map((e) => ({
    event_type: e.event_type,
    user_id: e.user_id ?? null,
    session_id: e.session_id,
    properties: e.properties,
    page_url: e.page_url,
    user_agent: e.user_agent,
    created_at: e.timestamp,
  }))

  const { error } = await supabaseAdmin.from('analytics_events').insert(rows)

  if (error) {
    logger.error('Analytics insert failed', { error: error.message, count: rows.length })
    return NextResponse.json({ error: 'Storage error' }, { status: 500 })
  }

  return NextResponse.json({ accepted: rows.length }, { status: 202 })
}
