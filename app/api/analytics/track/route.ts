// ── POST /api/analytics/track — Batched event ingestion ─────────────────────
// Receives client-side analytics events, validates with Zod, inserts into Supabase.
// Rate limited: 50 events/min per session. No auth required (anonymous tracking).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import type { Json } from '@/lib/database-types'

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

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Distribué via lib/rate-limit (Upstash Redis). L'ancien Map en mémoire était
// sans effet sur Cloudflare Workers (un compteur par isolate → contournable par
// distribution naturelle des requêtes ; audit 2026-06-10, Vague 3). Double clé :
// session_id (fourni par le client, forgeable) + IP (non forgeable) pour borner
// le flood de la table analytics_events. 50 événements/min par session et par IP.

const RATE_LIMIT = 50

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
  // NB : checkRateLimit compte par requête (sliding window) ; un batch peut
  // contenir jusqu'à 100 événements, donc on consomme ceil(n/10) jetons pour
  // garder une borne proportionnelle au volume réel.
  const sessionId = events[0].session_id
  const ip = getClientIP(req)
  const tokens = Math.max(1, Math.ceil(events.length / 10))
  const checks = await Promise.all([
    ...Array.from({ length: tokens }, () => checkRateLimit(`analytics_track_${sessionId}`, RATE_LIMIT, 60_000)),
    ...Array.from({ length: tokens }, () => checkRateLimit(`analytics_track_ip_${ip}`, RATE_LIMIT * 2, 60_000)),
  ])
  if (checks.some((ok) => !ok)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // Map to DB rows
  const rows = events.map((e) => ({
    event_type: e.event_type,
    user_id: e.user_id ?? null,
    session_id: e.session_id,
    // Cast documenté métier → jsonb : properties sort d'un body JSON parsé
    // (z.record), donc JSON-sérialisable par construction.
    properties: e.properties as Json,
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
