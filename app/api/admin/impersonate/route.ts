import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/admin/impersonate
// Permet à un super_admin de se "switcher" temporairement vers un autre rôle
// pour inspecter les dashboards artisan/pro/syndic/copro sans quitter son compte.
//
// Remplace l'ancien pattern client `supabase.auth.updateUser({ data: { role: 'super_admin' } })`
// qui était vulnérable (toute session client pouvait se promouvoir super_admin).
//
// Sécurité :
//   - Auth obligatoire
//   - Rôle caller vérifié UNIQUEMENT via app_metadata (non forgeable)
//   - Écrit le rôle cible dans app_metadata.role avec marqueur _admin_override
//   - Le caller ne peut impersonner que son propre compte
//
// POST body : { role: 'artisan' | 'pro_societe' | ... | 'super_admin' }
//   role='super_admin' → retour en mode admin normal (clear override)
// ──────────────────────────────────────────────────────────────────────────────

const IMPERSONATION_ROLES = new Set([
  'artisan',
  'pro_societe',
  'pro_conciergerie',
  'pro_gestionnaire',
  'syndic',
  'syndic_admin',
  'syndic_gestionnaire',
  'syndic_secretaire',
  'coproprio',
  'locataire',
  'client',
  'super_admin', // retour au rôle réel
])

const impersonateSchema = z.object({
  role: z.string().min(1).max(50),
})

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  if (!(await checkRateLimit(`impersonate_${ip}`, 20, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  // Lecture du rôle RÉEL : soit app_metadata.role (normal) soit _original_role (déjà en override)
  const currentRole = getUserRole(user)
  const originalRole = (user.app_metadata?._original_role as string | undefined) || currentRole
  if (originalRole !== 'super_admin') {
    return NextResponse.json({ error: 'Accès réservé aux super_admin' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = impersonateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  const { role } = parsed.data

  if (!IMPERSONATION_ROLES.has(role)) {
    return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 400 })
  }

  // Écriture dans app_metadata (server-only)
  const nextMetadata: Record<string, unknown> = { ...(user.app_metadata || {}) }
  if (role === 'super_admin') {
    // Retour à admin : clear markers
    nextMetadata.role = 'super_admin'
    delete nextMetadata._admin_override
    delete nextMetadata._original_role
  } else {
    nextMetadata.role = role
    nextMetadata._admin_override = true
    nextMetadata._original_role = 'super_admin'
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: nextMetadata,
  })
  if (error) {
    console.error('[impersonate] update error:', error.message)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ success: true, role })
}
