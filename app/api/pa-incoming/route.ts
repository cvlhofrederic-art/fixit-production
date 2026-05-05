// ══════════════════════════════════════════════════════════════════════════════
// POST /api/pa-incoming — Webhook réception PA (FR-V6 stub)
// ══════════════════════════════════════════════════════════════════════════════
// Réforme e-invoicing FR (1er sept 2026) : toutes les entreprises doivent
// pouvoir RECEVOIR des factures électroniques via une PA (Plateforme Agréée).
//
// Cet endpoint est un STUB :
//   - Il valide la signature HMAC d'une requête entrante (X-PA-Signature header)
//   - Il insère la facture reçue dans table factures_recues
//   - Il notifie l'artisan via Sentry breadcrumb
//
// À configurer post-merge :
//   - Choisir une PA (Docaposte recommandé — cf. docs/conformite/pa-reception-roadmap.md)
//   - Définir PA_INBOUND_SECRET via wrangler secret put
//   - Configurer côté PA : URL = https://vitfix.io/api/pa-incoming + secret HMAC partagé
//   - Implémenter le parsing Factur-X CII complet (lib/facturx-parser.ts à créer)
//
// L'endpoint retourne 200 OK en stub mais ne traite pas le contenu Factur-X
// pour l'instant. Il loggue chaque appel pour traçabilité.

import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const maxDuration = 30

async function verifyHmac(secret: string, body: string, signatureHex: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const expected = Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('')
  // Constant-time compare
  if (expected.length !== signatureHex.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signatureHex.charCodeAt(i)
  }
  return mismatch === 0
}

export async function POST(request: NextRequest) {
  const secret = process.env.PA_INBOUND_SECRET
  if (!secret) {
    logger.warn('[pa-incoming] PA_INBOUND_SECRET not set — endpoint not configured')
    return NextResponse.json({ error: 'PA reception not configured', stage: 'no-secret' }, { status: 503 })
  }

  // ── 1. Auth via HMAC signature ──
  const signature = request.headers.get('x-pa-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing X-PA-Signature header' }, { status: 401 })
  }

  const body = await request.text()
  const valid = await verifyHmac(secret, body, signature)
  if (!valid) {
    Sentry.captureMessage('PA inbound webhook: HMAC signature mismatch', {
      level: 'warning',
      tags: { agent_type: 'pa-incoming', stage: 'hmac-verify' },
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // ── 2. Parse payload ──
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    pa_message_id,
    source_pa,
    artisan_siret,
    emetteur_siret,
    emetteur_name,
    emetteur_email,
    numero,
    date_emission,
    date_echeance,
    total_ht_cents,
    total_tva_cents,
    total_ttc_cents,
    currency,
    format,
    raw_xml,
    pdf_url,
  } = payload as Record<string, string | number | undefined>

  // Validation minimale (à étoffer avec Zod côté FR-V2d full implementation)
  if (!pa_message_id || !source_pa || !artisan_siret || !numero || !date_emission) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // ── 3. Résoudre l'artisan destinataire via SIRET ──
  const { data: artisan, error: artisanErr } = await supabaseAdmin
    .from('profiles_artisan')
    .select('user_id')
    .eq('siret', artisan_siret)
    .maybeSingle()

  if (artisanErr) {
    logger.error('[pa-incoming] artisan lookup failed:', artisanErr.message)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  if (!artisan?.user_id) {
    Sentry.captureMessage(`PA inbound: unknown artisan SIRET ${artisan_siret}`, {
      level: 'warning',
      tags: { agent_type: 'pa-incoming', stage: 'artisan-resolve' },
      extra: { numero, source_pa },
    })
    return NextResponse.json({ error: 'Artisan not found for SIRET' }, { status: 404 })
  }

  // ── 4. Insertion idempotente (UNIQUE source_pa+pa_message_id) ──
  const { data: existing } = await supabaseAdmin
    .from('factures_recues')
    .select('id')
    .eq('source_pa', source_pa)
    .eq('pa_message_id', pa_message_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ id: existing.id, idempotent: true }, { status: 200 })
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('factures_recues')
    .insert({
      artisan_user_id: artisan.user_id,
      emetteur_siret,
      emetteur_name: emetteur_name || '',
      emetteur_email: emetteur_email || null,
      numero,
      date_emission,
      date_echeance: date_echeance || null,
      total_ht_cents: Number(total_ht_cents) || 0,
      total_tva_cents: Number(total_tva_cents) || 0,
      total_ttc_cents: Number(total_ttc_cents) || 0,
      currency: currency || 'EUR',
      format,
      source_pa,
      pa_message_id,
      raw_xml: raw_xml || null,
      pdf_url: pdf_url || null,
      status: 'received',
    })
    .select('id')
    .single()

  if (insErr) {
    logger.error(`[pa-incoming] insert failed for ${numero}:`, insErr.message)
    Sentry.captureException(insErr, {
      tags: { agent_type: 'pa-incoming', stage: 'insert' },
      extra: { numero, source_pa, pa_message_id },
    })
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }

  Sentry.addBreadcrumb({
    category: 'pa-incoming',
    message: `Received facture ${numero} from ${emetteur_name}`,
    data: { source_pa, artisan_siret, total_ttc_cents },
    level: 'info',
  })

  return NextResponse.json({
    id: (inserted as { id: string }).id,
    received_at: new Date().toISOString(),
  })
}
