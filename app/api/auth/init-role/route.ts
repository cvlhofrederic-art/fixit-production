import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/init-role
// Initialise app_metadata.role pour le caller. Utilisé après supabase.auth.signUp
// (qui ne peut écrire que dans user_metadata) pour promouvoir le rôle dans
// app_metadata (server-only, non forgeable côté client).
//
// Sécurité :
//   - Auth obligatoire (Bearer token)
//   - Le caller ne peut initialiser QUE son propre rôle
//   - Refus si app_metadata.role est déjà défini (évite une re-promotion)
//   - Les rôles privilégiés (super_admin, admin, pro_*) ne sont PAS assignables
//     via cet endpoint — ils doivent passer par les flows server-to-server
//     (admin/setup, pro/invite, syndic/invite, set-pro-role)
// ──────────────────────────────────────────────────────────────────────────────

// Rôles assignables via self-init après signup. Les rôles privilégiés
// (super_admin, admin, syndic_admin, etc.) NE sont PAS dans cette liste :
// ils ne peuvent être attribués qu'en server-to-server via /api/admin/setup,
// /api/syndic/team, /api/syndic/invite, /api/pro/invite.
const ALLOWED_SELF_ROLES = new Set([
  'client',
  'artisan',
  'coproprio',
  'locataire',
  'particulier',
  'syndic',
  'pro_societe',
  'pro_conciergerie',
  'pro_gestionnaire',
])

const initRoleSchema = z.object({
  role: z.string().min(1).max(50),
})

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  if (!(await checkRateLimit(`init_role_${ip}`, 10, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = initRoleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })

  const { role } = parsed.data

  if (!ALLOWED_SELF_ROLES.has(role)) {
    return NextResponse.json({ error: 'Rôle non autorisé via self-init' }, { status: 403 })
  }

  // Refus si app_metadata.role est déjà défini — évite la ré-attribution.
  // L'utilisateur qui veut changer de rôle doit passer par un flow admin.
  if (user.app_metadata?.role) {
    return NextResponse.json({ success: true, already: true, role: user.app_metadata.role })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata || {}), role },
  })

  if (error) {
    console.error('[init-role] update error:', error.message)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ success: true, role })
}
