// API generique pour la table user_storage : miroir des cles localStorage
// `fixit_*` afin de rendre toutes les donnees applicatives portables entre
// appareils, navigateurs et apres nettoyage des donnees du site.
//
//   GET  /api/user-storage          -> { entries: { [key]: value } }, plus `identifiants` (compte, fiche) si l'espace est vide
//                                      et la fiche lisible
//   POST /api/user-storage          -> upsert { entries: [{key, value}, ...] } ; 422 si la base refuse une valeur
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
// 50 entrées par requête : le client (lib/storage-sync.ts) envoie toutes les clés modifiées en un seul POST et
// plafonne lui-même le volume à 4 Mo par requête (lot 8 Sentry du 28/10/2026 : 20 POST en 10 s avant).
const MAX_ENTRIES_PER_REQUEST = 50

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

/**
 * Codes d'erreur de la base (SQLSTATE) qui tiennent au contenu d'une valeur, pas à l'état du serveur : classe 22
 * (donnée que la base ne sait pas enregistrer : texte ou JSON invalide pour elle), 23502 (valeur nulle), 23514
 * (contrainte sur la valeur), classe 54 (valeur au-delà des limites de la base). La renvoyer telle quelle échouera
 * toujours.
 */
function estUnRefusDeContenu(code: unknown): boolean {
  if (typeof code !== 'string') return false
  return code.startsWith('22') || code === '23502' || code === '23514' || code.startsWith('54')
}

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

  // Espace vide : le navigateur peut y recopier ce qu'il détient déjà pour ce compte (premier passage). On lui donne
  // les identifiants sous lesquels ce compte range ses clés — le sien et celui de sa fiche — pour qu'il n'y recopie
  // que celles-là : sur un poste partagé, ce qu'un autre compte a laissé dans le navigateur n'a pas à le suivre.
  let identifiants: string[] | undefined
  if (Object.keys(entries).length === 0) {
    const { data: fiches, error: erreurFiches } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user.id)
    if (erreurFiches) {
      // Sans la fiche, la liste serait incomplète (une société range ses données sous l'identifiant de sa fiche) :
      // aucune n'est donnée, et le navigateur ne recopie rien. La restauration, elle, répond (relecture du 15/11/2026).
      logger.warn('[user-storage/GET] fiche du compte illisible :', erreurFiches)
    } else {
      identifiants = [user.id]
      for (const fiche of fiches || []) {
        if (typeof fiche.id === 'string' && fiche.id) identifiants.push(fiche.id)
      }
    }
  }

  return NextResponse.json({ entries, identifiants, updatedAt: new Date().toISOString() })
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
    // La base refuse le contenu d'une valeur : 422, pour que le navigateur la mette à part au lieu de renvoyer sans
    // fin tout l'envoi qui la contient. Toute autre erreur est une panne (500) : l'envoi sera retenté tel quel.
    const status = estUnRefusDeContenu(error.code) ? 422 : 500
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status })
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
