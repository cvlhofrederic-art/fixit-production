import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

// ── Helper d'authentification pour les routes API ────────────────────────────
// Usage côté API route : const user = await getAuthUser(request)
// Usage côté client : passer le token dans Authorization: Bearer <token>

export async function getAuthUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null

    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

// ── Vérifie qu'un utilisateur est authentifié et retourne une erreur 401 si non ──
export function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Vérifie qu'un utilisateur a un rôle syndic ────────────────────────────────
export function isSyndicRole(user: any): boolean {
  const role = user?.user_metadata?.role || ''
  return role === 'syndic' || role.startsWith('syndic_')
}

// ── Vérifie qu'un utilisateur est un artisan ─────────────────────────────────
export function isArtisanRole(user: any): boolean {
  return user?.user_metadata?.role === 'artisan'
}

// ── Vérifie qu'un utilisateur est propriétaire d'un profil artisan ───────────
// Retourne l'artisan_id si ownership confirmé, null sinon
export async function verifyArtisanOwnership(
  userId: string,
  artisanId: string,
  supabaseAdmin: any
): Promise<string | null> {
  const { data: artisan } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, user_id')
    .eq('id', artisanId)
    .single()
  if (!artisan || artisan.user_id !== userId) return null
  return artisan.id
}

// ── Récupère l'artisan_id d'un utilisateur connecté ─────────────────────────
export async function getArtisanIdForUser(
  userId: string,
  supabaseAdmin: any
): Promise<string | null> {
  const { data: artisan } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id')
    .eq('user_id', userId)
    .single()
  return artisan?.id || null
}
