import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// GET /api/user/export-data
// RGPD Art. 20 — Droit à la portabilité des données
// Retourne TOUTES les données personnelles de l'utilisateur en JSON
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  // Rate limit par user (pas IP) — un seul user ne peut exporter que 5x/min
  if (!(await checkRateLimit(`export_data_${user.id}`, 5, 60_000))) return rateLimitResponse()

  const userId = user.id

  // Helper : récupérer silencieusement (table peut ne pas exister)
  const safeSelect = async (table: string, column: string, id: string): Promise<Record<string, unknown>[]> => {
    try {
      const { data } = await supabaseAdmin.from(table).select('*').eq(column, id)
      return data || []
    } catch { return [] }
  }

  try {
    // 1. Données utilisateur (auth)
    const userData = {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      user_metadata: user.user_metadata,
    }

    // 2. Profil artisan
    const { data: artisanProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // 3. Services artisan
    let services: Record<string, unknown>[] = []
    if (artisanProfile) {
      const { data } = await supabaseAdmin.from('services').select('*').eq('artisan_id', artisanProfile.id)
      services = data || []
    }

    // 4. Bookings (en tant que client)
    const clientBookings = await safeSelect('bookings', 'client_id', userId)

    // 5. Bookings (en tant qu'artisan)
    let artisanBookings: Record<string, unknown>[] = []
    if (artisanProfile) {
      artisanBookings = await safeSelect('bookings', 'artisan_id', artisanProfile.id)
    }

    // 6. Messages de booking
    const messages = await safeSelect('booking_messages', 'sender_id', userId)

    // 7. Profil client
    const { data: clientProfile } = await supabaseAdmin
      .from('profiles_client')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // 8. Devis et factures
    const devis = await safeSelect('devis', 'artisan_user_id', userId)
    const factures = await safeSelect('factures', 'artisan_user_id', userId)

    // 9. Documents fiscaux PT
    let ptFiscalSeries: Record<string, unknown>[] = []
    let ptFiscalDocuments: Record<string, unknown>[] = []
    if (artisanProfile) {
      ptFiscalSeries = await safeSelect('pt_fiscal_series', 'artisan_id', artisanProfile.id)
      ptFiscalDocuments = await safeSelect('pt_fiscal_documents', 'artisan_id', artisanProfile.id)
    }

    // 10. Photos artisan
    let artisanPhotos: Record<string, unknown>[] = []
    if (artisanProfile) {
      artisanPhotos = await safeSelect('artisan_photos', 'artisan_id', artisanProfile.id)
    }

    // 11. Syndic data (si syndic)
    const syndicEmails = await safeSelect('syndic_emails_analysed', 'syndic_id', userId)
    const syndicMissions = await safeSelect('syndic_missions', 'cabinet_id', userId)
    const syndicImmeubles = await safeSelect('syndic_immeubles', 'cabinet_id', userId)
    const syndicArtisans = await safeSelect('syndic_artisans', 'cabinet_id', userId)
    const syndicTeam = await safeSelect('syndic_team_members', 'cabinet_id', userId)
    const syndicMessages = await safeSelect('syndic_messages', 'cabinet_id', userId)
    const syndicSignalements = await safeSelect('syndic_signalements', 'cabinet_id', userId)
    const syndicPlanningEvents = await safeSelect('syndic_planning_events', 'cabinet_id', userId)

    // 12. Subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // 13. Audit log export (RGPD transparency)
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: userId,
        action: 'EXPORT_DATA',
        table_name: 'all',
        details: { rgpd_article: 'Art. 20' },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      })
    } catch { /* audit_logs may not exist yet */ }

    const exportData = {
      exported_at: new Date().toISOString(),
      rgpd_article: 'Art. 20 — Droit à la portabilité',
      user: userData,
      client_profile: clientProfile || null,
      artisan_profile: artisanProfile || null,
      services,
      devis,
      factures,
      artisan_photos: artisanPhotos,
      pt_fiscal_series: ptFiscalSeries,
      pt_fiscal_documents: ptFiscalDocuments,
      bookings_as_client: clientBookings,
      bookings_as_artisan: artisanBookings,
      messages,
      subscription: subscription || null,
      syndic: {
        emails: syndicEmails,
        missions: syndicMissions,
        immeubles: syndicImmeubles,
        artisans: syndicArtisans,
        team: syndicTeam,
        messages: syndicMessages,
        signalements: syndicSignalements,
        planning_events: syndicPlanningEvents,
      },
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="vitfix-export-${userId.slice(0, 8)}-${Date.now()}.json"`,
      },
    })

  } catch (err: unknown) {
    logger.error('[EXPORT-DATA] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
