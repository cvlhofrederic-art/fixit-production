import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { refusEffacementGestionnaireQr } from '@/lib/aj-signalement/serveur-compte'
import { lireParValeursQr, lirePagesQr, tableAbsenteQr } from '@/lib/aj-signalement/serveur'

const log = logger.withTenant('api/user/delete-account')

const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT'),
})

/** Refus d'un compte qui détient des devis ou des factures : la loi impose de les conserver dix ans. */
const MESSAGE_DOCUMENTS_A_CONSERVER =
  'Votre compte détient des documents comptables (devis ou factures) que la loi impose de conserver : contactez le support pour supprimer votre compte.'
/** La base a refusé de supprimer le compte (une référence l'en empêche) : rien n'a été effacé. */
const MESSAGE_SUPPRESSION_IMPOSSIBLE =
  'La suppression de votre compte n’a pas pu aboutir et aucune donnée n’a été effacée : contactez le support.'

/** Clés de la sauvegarde du stockage du navigateur (user_storage) qui portent des devis et des factures, brouillons compris. */
const PREFIXES_DOCUMENTS_STOCKAGE = ['fixit_documents_', 'fixit_drafts_']

/** Une valeur vide (liste vide, texte vide) ne porte aucun document ; toute autre valeur, par prudence, en porte. */
function porteDesDocuments(valeur: unknown): boolean {
  if (valeur === null || valeur === undefined) return false
  if (Array.isArray(valeur)) return valeur.length > 0
  if (typeof valeur === 'string') return !['', '[]'].includes(valeur.trim())
  return true
}

type VerificationDocuments = { ok: true; documents: boolean } | { ok: false }

/**
 * Le compte détient-il au moins un devis ou une facture ? En base : devis et factures de son compte ou de sa fiche
 * (ceux d'un sous-compte d'une société portent la fiche de la société), factures reçues, documents fiscaux portugais,
 * quel que soit leur statut (brouillon, annulé, masqué compris) ; ou dans la sauvegarde du stockage du navigateur.
 * Lecture seule, par des lectures bornées à une ligne (GET) et non par des comptages (HEAD) : la réponse à une requête
 * HEAD n'a pas de corps, et le client Supabase y rend une table absente sans erreur ni nombre. Une table absente
 * (PGRST205 ou 42P01) ne contient rien ; toute autre erreur de lecture rend { ok: false } : la suppression est alors
 * refusée et rien n'est effacé.
 */
/**
 * La sauvegarde du stockage du navigateur (user_storage) porte-t-elle des devis ou des factures ?
 *
 * Deuxième source, distincte de la base : un artisan garde ses documents dans le stockage de son navigateur, dont
 * `lib/storage-sync.ts` tient un miroir ici. Une table absente ne contient rien ; toute autre erreur de lecture
 * rend { ok: false } et la suppression est refusée.
 */
async function sauvegardeNavigateurPorteDesDocuments(userId: string): Promise<VerificationDocuments> {
  const cles = await lirePagesQr<{ key: string }>(() =>
    supabaseAdmin.from('user_storage').select('key').eq('user_id', userId).order('key', { ascending: true }))
  if (!cles.ok) {
    if (tableAbsenteQr(cles.erreur)) return { ok: true, documents: false }
    log.warn('Sauvegarde du stockage non vérifiée : suppression refusée, rien n’est effacé', { code: cles.erreur.code })
    return { ok: false }
  }
  const clesDocuments = cles.valeur.map((l) => l.key).filter((cle) => PREFIXES_DOCUMENTS_STOCKAGE.some((p) => cle.startsWith(p)))
  if (clesDocuments.length === 0) return { ok: true, documents: false }
  const valeurs = await lireParValeursQr<{ key: string; value: unknown }>(clesDocuments, (lot) =>
    supabaseAdmin.from('user_storage').select('key, value').eq('user_id', userId).in('key', lot).order('key', { ascending: true }))
  if (!valeurs.ok) {
    log.warn('Sauvegarde du stockage non vérifiée : suppression refusée, rien n’est effacé', { code: valeurs.erreur.code })
    return { ok: false }
  }
  return { ok: true, documents: valeurs.valeur.some((l) => porteDesDocuments(l.value)) }
}

async function compteDetientDesDocuments(
  userId: string,
  ficheId: string | null,
  sousCompteSociete = false,
): Promise<VerificationDocuments> {
  const proprietaire = ficheId ? `artisan_user_id.eq.${userId},artisan_id.eq.${ficheId}` : `artisan_user_id.eq.${userId}`
  const lectures = await Promise.all([
    supabaseAdmin.from('devis').select('id').or(proprietaire).limit(1).then((r) => ({ table: 'devis', ...r })),
    supabaseAdmin.from('factures').select('id').or(proprietaire).limit(1).then((r) => ({ table: 'factures', ...r })),
    supabaseAdmin.from('factures_recues').select('id').eq('artisan_user_id', userId).limit(1)
      .then((r) => ({ table: 'factures_recues', ...r })),
    supabaseAdmin.from('pt_fiscal_documents').select('id').in('artisan_id', ficheId ? [userId, ficheId] : [userId]).limit(1)
      .then((r) => ({ table: 'pt_fiscal_documents', ...r })),
  ])
  for (const { table, data, error } of lectures) {
    if (error && tableAbsenteQr(error)) continue
    if (error || !Array.isArray(data)) {
      log.warn('Documents du compte non vérifiés : suppression refusée, rien n’est effacé', { table, code: error?.code })
      return { ok: false }
    }
    if (data.length > 0) return { ok: true, documents: true }
  }

  // Salarié invité d'une société : depuis le 25/11/2026, les devis et factures qu'il crée appartiennent à la
  // SOCIÉTÉ (`artisan_user_id` = le compte du gérant), et son navigateur n'en garde qu'un cache de travail. Les
  // lectures en base ci-dessus sont donc le seul juge : le retenir pour une clé `fixit_documents_*` lui refuserait
  // l'effacement de son compte (RGPD art. 17) au nom de documents qui ne sont pas les siens et que la société
  // conserve de toute façon.
  if (sousCompteSociete) return { ok: true, documents: false }

  return sauvegardeNavigateurPorteDesDocuments(userId)
}

// DELETE /api/user/delete-account
// RGPD Art. 17 — Droit à l'effacement
// Supprime les données personnelles de l'utilisateur connecté, sauf les documents que la loi impose de conserver : un
// compte qui détient au moins un devis ou une facture est refusé AVANT toute suppression (409), et la route n'efface
// jamais un devis ni une facture. Le compte (auth) est supprimé EN PREMIER, en une seule opération de la base : si une
// référence restante l'en empêche, rien n'est effacé (jamais un compte à moitié vidé) ; ses données sans lien de
// cascade (fiche, réservations, tables syndic, équipe d'une société BTP…) sont effacées ensuite, et un échec à ce stade
// rend 207 avec une alerte au journal d'erreur (Sentry).
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

  // AJ Signalement (PR 2, SPEC § 2.10) : le compte d'un gestionnaire d'un cabinet client est géré par son employeur
  // (responsable de traitement) : refus AVANT toute suppression (403 demande_au_cabinet), la demande est transmise au
  // super admin. Tout autre compte : null, parcours inchangé (y compris avant les migrations d'AJ Signalement).
  const refusGestionnaire = await refusEffacementGestionnaireQr(user)
  if (refusGestionnaire) return refusGestionnaire

  const userId = user.id
  const errors: string[] = []
  const deleted: string[] = []

  // Helper : supprime de manière sécurisée et log le résultat. Une table absente de la base (migration non appliquée)
  // ne contient rien : ce n'est pas un échec (sinon chaque suppression finirait en 207 et l'alerte perdrait son sens).
  const safeDelete = async (table: string, column: string, id: string) => {
    try {
      const { error } = await supabaseAdmin.from(table).delete().eq(column, id)
      if (!error) {
        deleted.push(table)
      } else if (!tableAbsenteQr(error)) {
        errors.push(`${table}: ${error.message}`)
      }
    } catch (e: unknown) {
      errors.push(`${table}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  try {
    // ── Phase 1 : lecture seule, AVANT toute suppression ──
    const { data: artisan, error: erreurFiche } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    if (erreurFiche) {
      log.warn('Fiche du compte non relue : suppression refusée, rien n’est effacé', { code: erreurFiche.code })
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
    const artisanId: string | null = artisan?.id ?? null

    // Rattachement posé par le serveur à l'acceptation de l'invitation : app_metadata seulement, jamais
    // user_metadata (modifiable par le client).
    const rattachement = user.app_metadata?.company_id
    const sousCompteSociete = user.app_metadata?.role === 'pro_societe'
      && typeof rattachement === 'string' && rattachement !== '' && rattachement !== userId
    const verification = await compteDetientDesDocuments(userId, artisanId, sousCompteSociete)
    if (!verification.ok) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    if (verification.documents) {
      return NextResponse.json({ error: MESSAGE_DOCUMENTS_A_CONSERVER, code: 'documents_a_conserver' }, { status: 409 })
    }

    // ── Phase 2 : journal d'audit (avant que le compte n'existe plus), puis suppression du compte EN PREMIER ──
    try {
      const { error: erreurJournal } = await supabaseAdmin.from('audit_logs').insert({
        user_id: userId,
        action: 'DELETE_ACCOUNT',
        table_name: 'auth.users',
        details: { rgpd_article: 'Art. 17' },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      })
      if (erreurJournal) log.warn('Journal d’audit de la suppression non écrit', { code: erreurJournal.code })
    } catch (e: unknown) {
      log.warn('Journal d’audit de la suppression non écrit', { message: e instanceof Error ? e.name : 'inconnue' })
    }

    // Une seule opération de la base, qui emporte les données rattachées au compte par cascade : si une référence
    // restante l'en empêche (charges fixes, candidatures…), rien n'est effacé.
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authErr) {
      log.warn('Suppression du compte refusée par la base : aucune donnée effacée', { userId: userId.substring(0, 8), status: authErr.status })
      return NextResponse.json({ error: MESSAGE_SUPPRESSION_IMPOSSIBLE, code: 'suppression_impossible' }, { status: 500 })
    }
    deleted.push('auth.users')

    // ── Phase 3 : données sans lien de cascade avec le compte (jamais un devis ni une facture : il n'y en a aucun) ──

    // 3a. Messages de booking
    await safeDelete('booking_messages', 'sender_id', userId)

    // 3b. Bookings (en tant que client)
    await safeDelete('bookings', 'client_id', userId)

    // 3c. Tables de la fiche artisan ou société (fiche lue en phase 1)
    if (artisanId) {
      await safeDelete('pt_fiscal_series', 'artisan_id', artisanId)

      // Photos artisan
      await safeDelete('artisan_photos', 'artisan_id', artisanId)

      // Disponibilité et absences
      await safeDelete('availability_services', 'artisan_id', artisanId)
      await safeDelete('artisan_absences', 'artisan_id', artisanId)
      await safeDelete('artisan_notifications', 'artisan_id', artisanId)

      // Bookings (en tant qu'artisan), avant les services : une réservation pointe son service
      await safeDelete('bookings', 'artisan_id', artisanId)

      // Services, après les réservations et avant la fiche
      await safeDelete('services', 'artisan_id', artisanId)

      // Profil artisan, par son identifiant (lu en phase 1 : retrouvé même si son lien au compte a été vidé)
      await safeDelete('profiles_artisan', 'id', artisanId)
    }

    // 3d. Profil client
    await safeDelete('profiles_client', 'user_id', userId)

    // 3e. Syndic tables (si syndic/admin)
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

    // 3f. Subscriptions
    await safeDelete('subscriptions', 'user_id', userId)

    // 3g. Tracking sessions
    await safeDelete('tracking_sessions', 'artisan_id', userId)

    // 3h. BTP : équipe de la société (company_id n'a aucun lien vers le compte) et charges fixes restantes
    await safeDelete('pro_team_members', 'company_id', userId)
    await safeDelete('charges_fixes', 'owner_id', userId)

    log.info('Account deletion completed', {
      userId: userId.substring(0, 8),
      deletedTables: deleted.length,
      errors: errors.length,
    })

    if (errors.length > 0) {
      // Le compte est supprimé ; les tables restées en échec sont à effacer par le support. L'objet Error (sans donnée
      // personnelle) fait partir l'alerte Sentry de lib/logger.ts ; seuls les noms des tables vont au contexte.
      log.error('Compte supprimé, données restantes non effacées', {
        userId: userId.substring(0, 8),
        tables: errors.map((e) => e.split(':')[0]),
      }, new Error('Suppression de compte RGPD incomplète'))
      return NextResponse.json({
        success: false,
        message: 'Compte supprimé ; certaines données n’ont pas pu être effacées (suppression partielle)',
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
