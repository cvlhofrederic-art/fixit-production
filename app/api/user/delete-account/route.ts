import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const log = logger.withTenant('api/user/delete-account')

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

  const userId = user.id
  const errors: string[] = []
  const deleted: string[] = []

  // Helper : supprime de manière sécurisée et log le résultat
  const safeDelete = async (table: string, column: string, id: string) => {
    try {
      const { error } = await supabaseAdmin.from(table).delete().eq(column, id)
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
    await safeDelete('booking_messages', 'sender_id', userId)

    // 2b. Bookings (en tant que client)
    await safeDelete('bookings', 'client_id', userId)

    // 2c. Artisan-specific tables (si artisan)
    if (artisanId) {
      // Documents fiscaux PT (avant les séries à cause des FK)
      await safeDelete('pt_fiscal_documents', 'artisan_id', artisanId)
      await safeDelete('pt_fiscal_series', 'artisan_id', artisanId)

      // Factures et devis
      await safeDelete('factures', 'artisan_user_id', userId)
      await safeDelete('devis', 'artisan_user_id', userId)

      // Services (avant profil à cause des FK)
      await safeDelete('services', 'artisan_id', artisanId)

      // Photos artisan
      await safeDelete('artisan_photos', 'artisan_id', artisanId)

      // Disponibilité et absences
      await safeDelete('availability_services', 'artisan_id', artisanId)
      await safeDelete('artisan_absences', 'artisan_id', artisanId)
      await safeDelete('artisan_notifications', 'artisan_id', artisanId)

      // Bookings (en tant qu'artisan)
      await safeDelete('bookings', 'artisan_id', artisanId)

      // Profil artisan
      await safeDelete('profiles_artisan', 'user_id', userId)
    }

    // 2d. Profil client
    await safeDelete('profiles_client', 'user_id', userId)

    // 2e. Syndic tables (si syndic/admin)
    // Supprimer d'abord les tables dépendantes
    await safeDelete('syndic_signalement_messages', 'syndic_id', userId)
    await safeDelete('syndic_signalements', 'cabinet_id', userId)
    await safeDelete('syndic_missions', 'cabinet_id', userId)
    await safeDelete('syndic_messages', 'cabinet_id', userId)
    await safeDelete('syndic_planning_events', 'cabinet_id', userId)
    await safeDelete('syndic_notifications', 'syndic_id', userId)
    await safeDelete('syndic_artisans', 'cabinet_id', userId)
    await safeDelete('syndic_immeubles', 'cabinet_id', userId)
    await safeDelete('syndic_team_members', 'cabinet_id', userId)

    // Tokens OAuth et emails analysés
    await safeDelete('syndic_oauth_tokens', 'syndic_id', userId)
    await safeDelete('syndic_emails_analysed', 'syndic_id', userId)

    // 2f. Subscriptions
    await safeDelete('subscriptions', 'user_id', userId)

    // 2g. Tracking sessions
    await safeDelete('tracking_sessions', 'artisan_id', userId)

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
