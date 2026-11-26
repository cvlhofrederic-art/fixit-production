import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { exportGestionnaireDuCompteQr } from '@/lib/aj-signalement/serveur-compte'
import { lireParValeursQr, lirePagesQr, tableAbsenteQr } from '@/lib/aj-signalement/serveur'

export const maxDuration = 60

type Ligne = Record<string, unknown>

/** Toutes les lignes d'une lecture ordonnée, page par page ; une table absente n'a rien à exporter, toute autre erreur lève. */
async function lireTout(table: string, fabrique: Parameters<typeof lirePagesQr>[0]): Promise<Ligne[]> {
  const r = await lirePagesQr<Ligne>(fabrique)
  if (r.ok) return r.valeur
  if (tableAbsenteQr(r.erreur)) return []
  throw new Error(`Export RGPD : lecture de ${table} impossible (${r.erreur.code ?? 'code inconnu'})`)
}

/** Tables du BTP rattachées à la société par owner_id (colonnes réelles relevées en production le 11/11/2026). */
const TABLES_BTP_PAR_PROPRIETAIRE: ReadonlyArray<readonly [section: string, table: string]> = [
  ['chantiers', 'chantiers_btp'],
  ['membres', 'membres_btp'],
  ['equipes', 'equipes_btp'],
  ['pointages', 'pointages_btp'],
  ['situations', 'situations_btp'],
  ['retenues', 'retenues_btp'],
  ['dc4', 'dc4_btp'],
  ['dpgf', 'dpgf_btp'],
  ['depenses', 'depenses_btp'],
  ['dce_analyses', 'dce_analyses_btp'],
  ['rapports', 'rapports_btp'],
  ['charges_fixes', 'charges_fixes'],
  // Outillage et vérifications du vendredi (migration 20261126).
  ['outillage', 'outillage_btp'],
  ['verifications_outillage', 'verifications_outillage_btp'],
]

/** Équipe de la société (ou fiche d'équipe d'un sous-compte), sans le jeton d'invitation, qui n'est jamais exporté. */
const COLONNES_EQUIPE_BTP =
  'id, company_id, user_id, email, full_name, phone, role, job_title, assigned_chantiers, invite_sent_at, accepted_at, last_login_at, is_active, created_at, updated_at'

/**
 * Compte BTP (pro_societe) : sauvegarde du stockage du navigateur (user_storage) et tables du BTP de la société, en
 * entier (lecture page par page). Lecture seule. Une table absente donne une liste vide ; toute autre erreur lève :
 * l'export échoue plutôt que de rendre un fichier incomplet présenté comme complet.
 */
async function exporterDonneesBtp(userId: string): Promise<{ userStorage: Ligne[]; btp: Record<string, Ligne[]> }> {
  const parProprietaire = await Promise.all(TABLES_BTP_PAR_PROPRIETAIRE.map(async ([section, table]) => [
    section,
    await lireTout(table, () => supabaseAdmin.from(table).select('*').eq('owner_id', userId).order('id', { ascending: true })),
  ] as const))
  const btp: Record<string, Ligne[]> = Object.fromEntries(parProprietaire)
  const [settings, reglagesPointage, team, marchesCandidatures, userStorage] = await Promise.all([
    lireTout('settings_btp', () => supabaseAdmin.from('settings_btp').select('*').eq('owner_id', userId).order('owner_id', { ascending: true })),
    // Pointage automatique de la société (migration 20261116) : clé primaire owner_id, pas de colonne id (un tri sur id
    // ferait échouer tout l'export), d'où la lecture à part, comme settings_btp.
    lireTout('pointage_reglages_btp', () => supabaseAdmin.from('pointage_reglages_btp').select('*').eq('owner_id', userId)
      .order('owner_id', { ascending: true })),
    lireTout('pro_team_members', () => supabaseAdmin.from('pro_team_members').select(COLONNES_EQUIPE_BTP)
      .or(`company_id.eq.${userId},user_id.eq.${userId}`).order('id', { ascending: true })),
    lireTout('marches_candidatures', () => supabaseAdmin.from('marches_candidatures').select('*').eq('artisan_user_id', userId)
      .order('id', { ascending: true })),
    lireTout('user_storage', () => supabaseAdmin.from('user_storage').select('key, value, updated_at').eq('user_id', userId)
      .order('key', { ascending: true })),
  ])
  // Composition des équipes : table de liaison sans propriétaire, lue par les équipes de la société.
  const liens = await lireParValeursQr<Ligne>(btp.equipes.map((e) => String(e.id)), (lot) => supabaseAdmin.from('equipe_membres_btp')
    .select('*').in('equipe_id', lot).order('equipe_id', { ascending: true }).order('membre_id', { ascending: true }))
  if (!liens.ok && !tableAbsenteQr(liens.erreur)) {
    throw new Error(`Export RGPD : lecture de equipe_membres_btp impossible (${liens.erreur.code ?? 'code inconnu'})`)
  }
  return {
    userStorage,
    btp: {
      ...btp, equipe_membres: liens.ok ? liens.valeur : [], settings, pointage_reglages: reglagesPointage, team,
      marches_candidatures: marchesCandidatures,
    },
  }
}

// GET /api/user/export-data
// RGPD Art. 20 — Droit à la portabilité des données
// Retourne TOUTES les données personnelles de l'utilisateur en JSON ; pour une société BTP (pro_societe), aussi la
// sauvegarde du stockage du navigateur et les tables du BTP de la société.
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

    // 12 bis. AJ Signalement (PR 2, SPEC § 2.10) : fiche (avec son bureau), attributions et journal d'un gestionnaire d'un
    // cabinet client ; section omise pour tout autre compte (export inchangé), et tant que les migrations manquent.
    // Bureau non lu (autre cause que la migration absente) : 503 au message générique, rien d'exporté ni journalisé.
    const ajSignalement = await exportGestionnaireDuCompteQr(user)
    if (!ajSignalement.ok) return ajSignalement.reponse

    // 12 ter. Société BTP (pro_societe) : sauvegarde du stockage du navigateur et tables du BTP. Les autres rôles gardent
    // leur export (règle n° 1 artisan / BTP).
    const donneesBtp = user.app_metadata?.role === 'pro_societe' ? await exporterDonneesBtp(userId) : null

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
      ...ajSignalement.champ,
      ...(donneesBtp ? { user_storage: donneesBtp.userStorage, btp: donneesBtp.btp } : {}),
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
