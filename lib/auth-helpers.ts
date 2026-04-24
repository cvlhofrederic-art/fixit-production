import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Helper d'authentification pour les routes API ────────────────────────────
// Usage côté API route : const user = await getAuthUser(request)
// Usage côté client : passer le token dans Authorization: Bearer <token>

// Cache serveur pour éviter un round-trip Supabase par requête API
const _userCache = new Map<string, { user: User; ts: number }>()
const AUTH_CACHE_TTL = 15_000 // F19: réduit de 30s à 15s pour fenêtre de révocation plus courte

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

// ── Récupère le rôle de l'utilisateur ────────────────────────────────────────
// SÉCURITÉ : lit UNIQUEMENT app_metadata (server-only, non forgeable).
// Le fallback vers user_metadata a été retiré car user_metadata est
// client-writable via supabase.auth.updateUser() → vuln privilege escalation.
// Les users existants ont été migrés via scripts/migrate-role-to-app-metadata.ts
// Les nouveaux signups doivent appeler POST /api/auth/init-role après inscription.
export function getUserRole(user: User): string {
  return user?.app_metadata?.role || ''
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
const CABINET_CACHE_TTL = 60 * 1000 // F12: réduit à 60s pour limiter la fenêtre après retrait d'un membre

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

// ── Vérifie qu'un utilisateur est pro_societe (gérant ou sous-compte) ────────
export function isProSocieteRole(user: User): boolean {
  const role = getUserRole(user)
  return role === 'pro_societe' || role === 'super_admin'
}

// ── Vérifie qu'un utilisateur est gérant pro_societe ─────────────────────────
// Le gérant est l'utilisateur sans company_id dans ses metadata (il EST la company)
// ou avec pro_team_role === 'GERANT'
export function isProGerant(user: User): boolean {
  const role = getUserRole(user)
  if (role === 'super_admin') return true
  if (role !== 'pro_societe') return false
  const teamRole = user.user_metadata?.pro_team_role
  return !teamRole || teamRole === 'GERANT'
}

// ── Cache company_id en mémoire (TTL 5min) ──────────────────────────────────
const companyIdCache = new Map<string, { value: string; expiresAt: number }>()
const COMPANY_CACHE_TTL = 5 * 60 * 1000

// ── Résout le company_id d'un utilisateur pro_societe ────────────────────────
// Si gérant → son propre id. Si sous-compte → company_id depuis pro_team_members.
export async function resolveCompanyId(user: User, supabaseAdminClient: SupabaseClient): Promise<string | null> {
  const role = getUserRole(user)

  // Gérant ou super_admin : son propre ID est la company
  if (role === 'super_admin') return user.id
  if (role === 'pro_societe' && isProGerant(user)) return user.id

  // Sous-compte pro_societe : résoudre via pro_team_members
  if (role === 'pro_societe') {
    const cached = companyIdCache.get(user.id)
    if (cached && cached.expiresAt > Date.now()) return cached.value

    try {
      const { data: membership } = await supabaseAdminClient
        .from('pro_team_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (membership?.company_id) {
        companyIdCache.set(user.id, { value: membership.company_id, expiresAt: Date.now() + COMPANY_CACHE_TTL })
        return membership.company_id
      }
    } catch (error) {
      console.error('[auth-helpers] resolveCompanyId team lookup failed:', error instanceof Error ? error.message : error)
    }
  }

  // Fallback
  return user.id
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
