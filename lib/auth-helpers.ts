import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Helper d'authentification pour les routes API ────────────────────────────
// Usage côté API route : const user = await getAuthUser(request)
// Usage côté client : passer le token dans Authorization: Bearer <token>

// Cache serveur pour éviter un round-trip Supabase par requête API
const _userCache = new Map<string, { user: User; ts: number }>()
const AUTH_CACHE_TTL = 30_000 // 30s

export async function getAuthUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return null

    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return null

    // Vérifier le cache (même token = même user pendant 30s)
    const cacheKey = token.slice(-16) // suffixe unique du token
    const cached = _userCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < AUTH_CACHE_TTL) {
      return cached.user
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null

    // Mettre en cache
    _userCache.set(cacheKey, { user, ts: Date.now() })
    // Nettoyage périodique (max 50 entrées)
    if (_userCache.size > 50) {
      const now = Date.now()
      for (const [k, v] of _userCache) {
        if (now - v.ts > AUTH_CACHE_TTL) _userCache.delete(k)
      }
    }

    return user
  } catch (error) {
    console.error('[auth-helpers] getAuthUser failed:', error instanceof Error ? error.message : error)
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

// ── Récupère le rôle de l'utilisateur (app_metadata prioritaire, fallback user_metadata) ──
// app_metadata ne peut être modifié que côté serveur (non forgeable côté client)
export function getUserRole(user: User): string {
  return user?.app_metadata?.role || user?.user_metadata?.role || ''
}

// ── Vérifie qu'un utilisateur a un rôle syndic (ou super_admin) ───────────────
// SÉCURITÉ : ne fait confiance qu'à app_metadata (non modifiable côté client)
// _admin_override est un concept client-side UNIQUEMENT, JAMAIS utilisé en server-side
export function isSyndicRole(user: User): boolean {
  const role = getUserRole(user)
  return role === 'syndic' || role.startsWith('syndic_') || role === 'super_admin'
}

// ── Vérifie si l'utilisateur est super_admin ─────────────────────────────────
// SÉCURITÉ : seul app_metadata.role est consulté (non forgeable côté client)
export function isSuperAdmin(user: User): boolean {
  return getUserRole(user) === 'super_admin'
}

// ── Cache cabinet_id en mémoire (TTL 5min) pour éviter les requêtes DB répétées ──
// Chaque requête API syndic appelle resolveCabinetId() → sans cache, c'est 1 query DB / requête
const cabinetIdCache = new Map<string, { value: string; expiresAt: number }>()
const CABINET_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ── Résout le cabinet_id d'un utilisateur syndic de façon sécurisée ──────────
// Ne fait PAS confiance à user_metadata (modifiable côté client).
// Pour un admin syndic (role=syndic), cabinet_id = user.id.
// Pour un employé (syndic_*), on cherche dans syndic_team_members côté serveur.
export async function resolveCabinetId(user: User, supabaseAdmin: SupabaseClient): Promise<string | null> {
  const role = getUserRole(user)

  // Admin syndic principal : son propre ID est le cabinet (pas besoin de cache)
  if (role === 'syndic' || role === 'super_admin') {
    return user.id
  }

  // Employé syndic : vérifier le cache avant de requêter la DB
  if (role.startsWith('syndic_')) {
    const cached = cabinetIdCache.get(user.id)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    try {
      const { data: membership } = await supabaseAdmin
        .from('syndic_team_members')
        .select('cabinet_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (membership?.cabinet_id) {
        // Mettre en cache pour 5 minutes
        cabinetIdCache.set(user.id, { value: membership.cabinet_id, expiresAt: Date.now() + CABINET_CACHE_TTL })
        return membership.cabinet_id
      }
    } catch (error) {
      console.error('[auth-helpers] resolveCabinetId team lookup failed:', error instanceof Error ? error.message : error)
    }
  }

  // Fallback : l'utilisateur est lui-même le cabinet
  return user.id
}

// ── Vérifie qu'un utilisateur est un artisan ─────────────────────────────────
export function isArtisanRole(user: User): boolean {
  return getUserRole(user) === 'artisan'
}

// ── Vérifie qu'un utilisateur est propriétaire d'un profil artisan ───────────
// Retourne l'artisan_id si ownership confirmé, null sinon
export async function verifyArtisanOwnership(
  userId: string,
  artisanId: string,
  supabaseAdmin: SupabaseClient
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
  supabaseAdmin: SupabaseClient
): Promise<string | null> {
  const { data: artisan } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id')
    .eq('user_id', userId)
    .single()
  return artisan?.id || null
}

// ── Vérifie qu'une ressource appartient au cabinet de l'utilisateur ──────────
// Défense en profondeur : même sans RLS Supabase activée, cette vérification
// empêche l'accès cross-tenant dans les routes API.
// Usage : if (!await verifyCabinetOwnership(user, resourceCabinetId, supabaseAdmin)) return 403
export async function verifyCabinetOwnership(
  user: User,
  resourceCabinetId: string,
  supabaseAdmin: SupabaseClient
): Promise<boolean> {
  const userCabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!userCabinetId) return false
  return userCabinetId === resourceCabinetId
}

// ── Rafraîchit un access_token Gmail via OAuth2 refresh_token ─────────────
export async function refreshGmailAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  return res.json()
}
