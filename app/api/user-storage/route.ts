// API generique pour la table user_storage : miroir des cles localStorage
// `fixit_*` afin de rendre toutes les donnees applicatives portables entre
// appareils, navigateurs et apres nettoyage des donnees du site.
//
//   GET  /api/user-storage          -> { entries: { [key]: value } }
//   POST /api/user-storage          -> upsert { entries: [{key, value}, ...] }
//   DELETE /api/user-storage        -> body { keys: string[] }
//
// Le client (lib/storage-sync.ts) appelle GET au login pour hydrater le
// localStorage, puis intercepte chaque setItem/removeItem pour mirroir
// debounce vers la DB.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'

// 5 MB par valeur pour absorber les cas legacy ou des fichiers sont
// stockes en base64 directement dans le localStorage (logo cabinet syndic,
// signature scannée, justificatifs Wallet : KBis, RC Pro, décennale).
// Migration vers Supabase Storage prevue (phase 2) ; en attendant,
// on accepte ces payloads pour ne perdre aucune donnee.
const MAX_VALUE_BYTES = 5_000_000
// Batch reduit a 10 entrees pour limiter le request body a ~50 MB max.
const MAX_ENTRIES_PER_REQUEST = 10

const upsertSchema = z.object({
  entries: z.array(z.object({
    key: z.string().regex(/^fixit_[a-z0-9_-]+$/i, 'Cle invalide').max(120),
    value: z.unknown(),
  })).min(1).max(MAX_ENTRIES_PER_REQUEST).refine(
    (entries) => entries.every(e => JSON.stringify(e.value).length <= MAX_VALUE_BYTES),
    `Au moins une valeur depasse ${MAX_VALUE_BYTES} octets`
  ),
})

const deleteSchema = z.object({
  keys: z.array(z.string().regex(/^fixit_[a-z0-9_-]+$/i).max(120)).min(1).max(MAX_ENTRIES_PER_REQUEST),
})

// ─── GET — toutes les entrees de l'utilisateur ───────────────────────────
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`user_storage_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('user_storage')
    .select('key, value, updated_at')
    .eq('user_id', user.id)
    .limit(2000)

  if (error) {
    logger.error('[user-storage/GET] Failed:', error)
    return NextResponse.json({ error: 'Erreur lors du chargement' }, { status: 500 })
  }

  // Format pratique pour le client : map key -> value (objets JSONB)
  const entries: Record<string, unknown> = {}
  for (const row of data || []) {
    entries[row.key as string] = row.value
  }

  return NextResponse.json({ entries, updatedAt: new Date().toISOString() })
}

// ─── POST — batch upsert ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  // Rate-limit relativement large car un user peut emettre 10-20 ecritures
  // sur une session de saisie meme avec le debounce client.
  if (!(await checkRateLimit(`user_storage_post_${ip}`, 120, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })

  const v = validateBody(upsertSchema, body)
  if (!v.success) {
    return NextResponse.json({ error: 'Données invalides', details: v.error }, { status: 400 })
  }

  const rows = v.data.entries.map(e => ({
    user_id: user.id,
    key: e.key,
    value: e.value,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabaseAdmin
    .from('user_storage')
    .upsert(rows, { onConflict: 'user_id,key' })

  if (error) {
    logger.error('[user-storage/POST] Failed:', error)
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: rows.length })
}

// ─── DELETE — batch delete par cles ─────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`user_storage_del_${ip}`, 60, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const v = validateBody(deleteSchema, body)
  if (!v.success) {
    return NextResponse.json({ error: 'Données invalides', details: v.error }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('user_storage')
    .delete()
    .eq('user_id', user.id)
    .in('key', v.data.keys)

  if (error) {
    logger.error('[user-storage/DELETE] Failed:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
