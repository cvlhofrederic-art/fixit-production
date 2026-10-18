// app/api/syndic/coproprios/[id]/acces/route.ts
//
// POST — le syndic ouvre l'accès au portail copropriétaire à l'occupant d'un lot (propriétaire ou
// locataire) : création du compte Supabase par invitation (ou rattachement du compte existant),
// rôle `coproprio` / `locataire` dans app_metadata (non forgeable), puis drapeau d'accès sur la
// fiche syndic_coproprios (acces_portail / acces_portail_locataire, migration 20261017).
// Un compte qui a déjà un autre rôle (syndic, artisan, super_admin, client…) n'est jamais réécrit.
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { User } from '@supabase/supabase-js'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const IdSchema = z.string().uuid()

const BodySchema = z.object({
  occupant: z.enum(['proprietaire', 'locataire']),
})

type Occupant = z.infer<typeof BodySchema>['occupant']
type RolePortail = 'coproprio' | 'locataire'

/** Rôles que l'activation peut poser ou remplacer ; tout autre rôle existant est conservé (409). */
const ROLES_PORTAIL: ReadonlySet<string> = new Set<RolePortail>(['coproprio', 'locataire'])

/** Colonnes de la fiche utilisées ici (select('*') : tolère les écarts de schéma). */
interface FicheOccupant {
  id: string
  nom_proprietaire: string | null
  prenom_proprietaire: string | null
  email_proprietaire: string | null
  nom_locataire: string | null
  prenom_locataire: string | null
  email_locataire: string | null
}

const PAGE_LISTE = 100
const MAX_PAGES_LISTE = 50

/** Compte Supabase ayant cet e-mail (listUsers paginé — l'API admin n'a pas de recherche par e-mail). */
async function trouverCompte(email: string): Promise<User | null> {
  for (let page = 1; page <= MAX_PAGES_LISTE; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PAGE_LISTE })
    if (error) {
      logger.error('[coproprios/acces] listUsers failed:', error)
      return null
    }
    const users = data?.users ?? []
    const trouve = users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (trouve) return trouve
    if (users.length < PAGE_LISTE) break
  }
  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const ip = getClientIP(request)
    if (!(await checkRateLimit(`copros_acces_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Cabinet non résolu' }, { status: 403 })

    const { id } = await params
    const parsedId = IdSchema.safeParse(id)
    if (!parsedId.success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

    const corps: unknown = await request.json().catch(() => null)
    const parsed = BodySchema.safeParse(corps)
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
    }
    const occupant: Occupant = parsed.data.occupant

    const { data: ligne, error: ficheError } = await supabaseAdmin
      .from('syndic_coproprios')
      .select('*')
      .eq('id', parsedId.data)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (ficheError) {
      logger.error('[coproprios/acces] lecture de la fiche échouée:', ficheError)
      return NextResponse.json({ error: 'db_query_failed' }, { status: 500 })
    }
    if (!ligne) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const fiche = ligne as FicheOccupant

    const email = (occupant === 'proprietaire' ? fiche.email_proprietaire : fiche.email_locataire)?.trim().toLowerCase() ?? ''
    if (!email) return NextResponse.json({ error: 'email_manquant', occupant }, { status: 400 })
    const fullName = (occupant === 'proprietaire'
      ? [fiche.prenom_proprietaire, fiche.nom_proprietaire]
      : [fiche.prenom_locataire, fiche.nom_locataire]).filter(Boolean).join(' ').trim()
    const roleCible: RolePortail = occupant === 'proprietaire' ? 'coproprio' : 'locataire'

    // ── Compte : invitation (nouveau) ou compte existant retrouvé ──
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'}/coproprietaire/dashboard`
    let compte: User | null = null
    let invite = false
    const { data: invitation, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: fullName ? { full_name: fullName } : {},
      redirectTo,
    })
    if (inviteError) {
      if (!/already/i.test(inviteError.message ?? '')) {
        logger.error('[coproprios/acces] invitation échouée:', { message: inviteError.message, status: inviteError.status, cabinetId, coproprioId: fiche.id })
        return NextResponse.json({ error: 'invitation_impossible' }, { status: 500 })
      }
      compte = await trouverCompte(email)
      if (!compte) {
        logger.error('[coproprios/acces] compte existant introuvable après « already »', { cabinetId, coproprioId: fiche.id })
        return NextResponse.json({ error: 'compte_introuvable' }, { status: 500 })
      }
    } else {
      compte = invitation?.user ?? null
      invite = true
      if (!compte) {
        logger.error('[coproprios/acces] invitation sans utilisateur renvoyé', { cabinetId, coproprioId: fiche.id })
        return NextResponse.json({ error: 'invitation_impossible' }, { status: 500 })
      }
    }

    // ── Rôle : jamais réécrire un rôle d'un autre espace (syndic, artisan, super_admin, client…) ──
    const roleActuel = typeof compte.app_metadata?.role === 'string' ? compte.app_metadata.role : ''
    if (roleActuel && !ROLES_PORTAIL.has(roleActuel)) {
      logger.warn('[coproprios/acces] compte avec un autre rôle, accès non activé', { cabinetId, coproprioId: fiche.id, role: roleActuel })
      return NextResponse.json({ error: 'compte_autre_role', role: roleActuel }, { status: 409 })
    }
    // Un compte déjà propriétaire (coproprio) n'est pas rétrogradé en locataire : il garderait
    // sinon l'accès à aucun de ses lots de propriétaire.
    const roleFinal: RolePortail = roleActuel === 'coproprio' ? 'coproprio' : roleCible
    if (roleActuel !== roleFinal) {
      const { error: roleError } = await supabaseAdmin.auth.admin.updateUserById(compte.id, {
        app_metadata: { ...(compte.app_metadata ?? {}), role: roleFinal },
      })
      if (roleError) {
        logger.error('[coproprios/acces] attribution du rôle échouée:', { message: roleError.message, cabinetId, coproprioId: fiche.id })
        return NextResponse.json({ error: 'role_impossible' }, { status: 500 })
      }
    }

    // ── Fiche : drapeau d'accès de l'occupant ──
    const drapeau = occupant === 'proprietaire' ? { acces_portail: true } : { acces_portail_locataire: true }
    const { error: updateError } = await supabaseAdmin
      .from('syndic_coproprios')
      .update(drapeau)
      .eq('id', fiche.id)
      .eq('cabinet_id', cabinetId)
    if (updateError) {
      if (updateError.code === '42703') {
        logger.warn('[coproprios/acces] colonne acces_portail_locataire absente (migration 20261017 non appliquée)', { cabinetId, coproprioId: fiche.id })
        return NextResponse.json({ error: 'migration_requise' }, { status: 409 })
      }
      logger.error('[coproprios/acces] mise à jour de la fiche échouée:', updateError)
      return NextResponse.json({ error: 'db_update_failed' }, { status: 500 })
    }

    logger.info('[coproprios/acces] accès au portail activé', { cabinetId, coproprioId: fiche.id, occupant, role: roleFinal, invite })
    return NextResponse.json({ ok: true, invite, email })
  } catch (err) {
    logger.error('[coproprios/acces] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
