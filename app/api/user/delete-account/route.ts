import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const log = logger.withTenant('api/user/delete-account')

const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT'),
})

// DELETE /api/user/delete-account
// RGPD Art. 17 — Droit à l'effacement
// Supprime toutes les données personnelles de l'utilisateur connecté
// Couvre TOUTES les tables : artisan, syndic, client, booking, fiscal, etc.
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  // Rate limit par user (pas IP) — un seul user ne peut tenter que 3 suppressions/min
  if (!(await checkRateLimit(`delete_account_${user.id}`, 3, 60_000))) return rateLimitResponse()

  let body: unknown
  try { body = await request.json() } catch { body = {} }
  const parsed = deleteAccountSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })

  const userId = user.id
  const errors: string[] = []
  const deleted: string[] = []

  // Helper : supprime de manière sécurisée et log le résultat.
  // La requête delete est construite TYPÉE au call-site ; le helper ne fait que
  // collecter succès/échecs. Les tables absentes du schéma live (pt_fiscal_*,
  // availability_services, tracking_sessions — audit P2 data layer) ne sont
  // plus visées : il n'y a rien à supprimer dedans, et leurs échecs permanents
  // forçaient un 207 « suppression partielle » systématique.
  const safeDelete = async (
    table: string,
    run: () => PromiseLike<{ error: { message: string } | null }>,
  ) => {
    try {
      const { error } = await run()
      if (error) {
        errors.push(`${table}: ${error.message}`)
      } else {
        deleted.push(table)
      }
    } catch (e: unknown) {
      errors.push(`${table}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  try {
    // ── Phase 1 : Récupérer les IDs nécessaires AVANT suppression ──
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    const artisanId = artisan?.id

    // ── Phase 2 : Supprimer dans l'ordre des dépendances (FK) ──

    // 2a. Messages de booking (anonymiser)
    await safeDelete('booking_messages', () => supabaseAdmin.from('booking_messages').delete().eq('sender_id', userId))

    // 2b. Bookings (en tant que client)
    await safeDelete('bookings', () => supabaseAdmin.from('bookings').delete().eq('client_id', userId))

    // 2c. Artisan-specific tables (si artisan)
    if (artisanId) {
      // Documents fiscaux PT : tables pt_fiscal_documents / pt_fiscal_series
      // ABSENTES du schéma live (lockdown fiscal volontaire, audit FNC-08) —
      // rien à supprimer, plus de tentative.

      // Factures et devis
      await safeDelete('factures', () => supabaseAdmin.from('factures').delete().eq('artisan_user_id', userId))
      await safeDelete('devis', () => supabaseAdmin.from('devis').delete().eq('artisan_user_id', userId))

      // Services (avant profil à cause des FK)
      await safeDelete('services', () => supabaseAdmin.from('services').delete().eq('artisan_id', artisanId))

      // Photos artisan
      await safeDelete('artisan_photos', () => supabaseAdmin.from('artisan_photos').delete().eq('artisan_id', artisanId))

      // Disponibilité et absences (availability_services n'existe pas en live — retiré)
      await safeDelete('artisan_absences', () => supabaseAdmin.from('artisan_absences').delete().eq('artisan_id', artisanId))
      await safeDelete('artisan_notifications', () => supabaseAdmin.from('artisan_notifications').delete().eq('artisan_id', artisanId))

      // Bookings (en tant qu'artisan)
      await safeDelete('bookings', () => supabaseAdmin.from('bookings').delete().eq('artisan_id', artisanId))

      // Profil artisan
      await safeDelete('profiles_artisan', () => supabaseAdmin.from('profiles_artisan').delete().eq('user_id', userId))
    }

    // 2d. Profil client
    await safeDelete('profiles_client', () => supabaseAdmin.from('profiles_client').delete().eq('user_id', userId))

    // 2e. Syndic tables (si syndic/admin)
    // Supprimer d'abord les tables dépendantes.
    // NB : syndic_signalement_messages n'a PAS de colonne syndic_id (l'ancien
    // delete échouait toujours) — on passe par les signalements du cabinet
    // (FK signalement_id), AVANT la suppression des signalements eux-mêmes.
    {
      const { data: ownSignalements } = await supabaseAdmin
        .from('syndic_signalements')
        .select('id')
        .eq('cabinet_id', userId)
      const signalementIds = (ownSignalements || []).map(s => s.id)
      if (signalementIds.length > 0) {
        await safeDelete('syndic_signalement_messages', () =>
          supabaseAdmin.from('syndic_signalement_messages').delete().in('signalement_id', signalementIds))
      }
    }
    await safeDelete('syndic_signalements', () => supabaseAdmin.from('syndic_signalements').delete().eq('cabinet_id', userId))
    await safeDelete('syndic_missions', () => supabaseAdmin.from('syndic_missions').delete().eq('cabinet_id', userId))
    await safeDelete('syndic_messages', () => supabaseAdmin.from('syndic_messages').delete().eq('cabinet_id', userId))
    await safeDelete('syndic_planning_events', () => supabaseAdmin.from('syndic_planning_events').delete().eq('cabinet_id', userId))
    await safeDelete('syndic_notifications', () => supabaseAdmin.from('syndic_notifications').delete().eq('syndic_id', userId))
    await safeDelete('syndic_artisans', () => supabaseAdmin.from('syndic_artisans').delete().eq('cabinet_id', userId))
    await safeDelete('syndic_immeubles', () => supabaseAdmin.from('syndic_immeubles').delete().eq('cabinet_id', userId))
    await safeDelete('syndic_team_members', () => supabaseAdmin.from('syndic_team_members').delete().eq('cabinet_id', userId))

    // Tokens OAuth et emails analysés
    await safeDelete('syndic_oauth_tokens', () => supabaseAdmin.from('syndic_oauth_tokens').delete().eq('syndic_id', userId))
    await safeDelete('syndic_emails_analysed', () => supabaseAdmin.from('syndic_emails_analysed').delete().eq('syndic_id', userId))

    // 2f. Subscriptions
    await safeDelete('subscriptions', () => supabaseAdmin.from('subscriptions').delete().eq('user_id', userId))

    // 2g. Tracking sessions : table tracking_sessions absente du schéma live
    // (audit P2 data layer) — rien à supprimer, plus de tentative.

    // 2h. Audit log de la suppression (avant suppression du user auth)
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: userId,
        action: 'DELETE_ACCOUNT',
        table_name: 'auth.users',
        details: { deleted_tables: deleted, errors, rgpd_article: 'Art. 17' },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      })
    } catch { /* audit_logs may not exist yet */ }

    // 2i. Supprimer l'utilisateur auth (cascade les données restantes)
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authErr) errors.push(`auth.users: ${authErr.message}`)
    else deleted.push('auth.users')

    log.info('Account deletion completed', {
      userId: userId.substring(0, 8),
      deletedTables: deleted.length,
      errors: errors.length,
    })

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Suppression partielle — certaines tables ont échoué',
        deleted,
        errors,
      }, { status: 207 })
    }

    return NextResponse.json({
      success: true,
      message: 'Toutes vos données personnelles ont été supprimées conformément au RGPD Art. 17',
      deleted_at: new Date().toISOString(),
      deleted_tables: deleted.length,
    })

  } catch (err: unknown) {
    log.error('Account deletion failed', { userId: userId.substring(0, 8) }, err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
