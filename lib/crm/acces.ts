// ── CRM du secrétariat : qui peut s'en servir (serveur) ─────────────────────
// Seul juge de l'accès aux routes app/api/crm/* : le super admin (rôle + liste d'e-mails, isSuperAdmin) et le compte de
// la secrétaire (app_metadata.role === 'secretariat'). app_metadata seulement, jamais user_metadata (modifiable par le
// navigateur). L'écran /admin/crm ne fait qu'en tirer l'affichage : il ne voit rien sans ces routes.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getAuthUser, getUserRole, isSuperAdmin } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { ROLE_SECRETARIAT } from './types'

/** Requêtes par minute et par compte : une saisie au fil des appels reste loin de cette limite. */
const LIMITE_PAR_MINUTE = 240

export function peutUtiliserCrm(user: User | null | undefined): boolean {
  if (!user) return false
  return isSuperAdmin(user) || getUserRole(user) === ROLE_SECRETARIAT
}

export type ControleCrm = { ok: true; user: User } | { ok: false; reponse: Response }

export function reponseErreurCrm(status: number, code: string): Response {
  return NextResponse.json({ error: code }, { status })
}

/** Session (Bearer) → compte admis, ou la réponse à renvoyer (401 sans session, 403 sans droit, 429). */
export async function controlerAccesCrm(request: NextRequest): Promise<ControleCrm> {
  const user = await getAuthUser(request)
  if (!user) return { ok: false, reponse: reponseErreurCrm(401, 'non_connecte') }
  if (!peutUtiliserCrm(user)) return { ok: false, reponse: reponseErreurCrm(403, 'acces_refuse') }
  if (!(await checkRateLimit(`crm_${user.id}`, LIMITE_PAR_MINUTE, 60_000))) return { ok: false, reponse: rateLimitResponse() }
  return { ok: true, user }
}

/** Nom affiché dans l'historique : le nom du compte, sinon la partie avant @ de son e-mail. */
export function nomAuteur(user: User): string {
  const nom = user.user_metadata?.full_name
  if (typeof nom === 'string' && nom.trim() !== '') return nom.trim().slice(0, 120)
  return (user.email ?? '').split('@')[0].slice(0, 120)
}
