import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole, isProGerant, resolveCompanyId } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  NOTE_A_REGULARISER,
  NOTE_DOUBLON,
  STATUT_EN_COURS,
  ajouterNote,
  chantierPourTelephone,
  chantiersAffectes,
  cloture,
  estOublie,
  fuseauValide,
  heureLocale,
  instantArrivee,
  instantDepart,
  membreDuCompte,
  normaliserEmail,
  noteDepartApresCoupure,
  reperesArrivee,
  type ChantierBtp,
  type ContextePointage,
  type EquipeBtp,
  type MembreBtp,
  type PointageEcran,
  type ResolutionMembre,
  type StatutCompte,
} from '@/lib/btp/pointage-regles'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/btp/pointage — pointage des employés d'une société BTP (pro_societe) sur leurs chantiers en cours.
//
// GET  : ce dont l'écran Pointage a besoin pour le compte connecté (gérant ou sous-compte de l'équipe) : sa fiche
//        employé (membres_btp, même adresse e-mail que le compte), ses chantiers « En cours » affectés (directement
//        par chantiers_btp.membres_ids ou par son équipe, equipes_btp.chantier_id), son pointage du jour, ses départs
//        oubliés, ses pointages des 31 derniers jours, l'interrupteur du pointage automatique de la société ; pour le
//        gérant, l'état des comptes de connexion de ses employés. Aucune écriture.
// POST : { action: 'arrivee' | 'depart' } — pointage de l'employé connecté, sur un chantier qui lui est affecté ;
//        { action: 'reglage_auto' } — le gérant active ou coupe le pointage automatique (après confirmation).
//
// Ni position ni distance ne sont reçues ou conservées : le téléphone décide seul de l'arrivée et du départ, le
// serveur n'enregistre que le chantier, l'heure et le mode. Les heures se calculent sur des instants UTC (arrivée
// gardée dans created_at) : changer le fuseau du téléphone ne change pas une durée. Un départ oublié un jour précédent
// est refermé sans heures, « à régulariser » par le gérant. Le mode automatique est refusé tant que le gérant ne l'a pas
// activé (pointage_reglages_btp, migration 20261116).
// Toutes les écritures visent la société résolue côté serveur (resolveCompanyId), jamais une société désignée par
// le client. Aucun pointage existant n'est réécrit, sauf la clôture des pointages ouverts de l'employé lui-même.
// ═══════════════════════════════════════════════════════════════════════════════

const JOURS_HISTORIQUE = 31
/** Table absente (migration 20261116 non appliquée) : PostgreSQL 42P01, PostgREST PGRST205 (cache du schéma). */
const TABLE_ABSENTE = new Set(['42P01', 'PGRST205'])

const champsPointage = {
  mode: z.enum(['geo_auto', 'manuel']),
  observeA: z.number().optional(),
  fuseau: z.string().max(64).optional(),
}
const corpsSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('arrivee'), chantierId: z.string().uuid(), ...champsPointage }),
  // derniereVue : fin à la main après une coupure du suivi automatique (instant de la dernière présence vue sur place).
  z.object({ action: z.literal('depart'), chantierId: z.string().uuid().optional(), derniereVue: z.number().optional(), ...champsPointage }),
  z.object({ action: z.literal('reglage_auto'), actif: z.boolean(), confirmation: z.boolean().optional() }),
])

type Ligne = Record<string, unknown>

interface Contexte {
  societeId: string
  gerant: boolean
  membres: MembreBtp[]
  chantiersEnCours: ChantierBtp[]
  equipes: EquipeBtp[]
  pointageAutoActive: boolean
  reglageDisponible: boolean
  resolution: ResolutionMembre
}

const refus = (status: number, error: string) => NextResponse.json({ error }, { status })

/**
 * Société du compte (gérant : lui-même ; sous-compte actif : sa société), ses employés, chantiers en cours, équipes
 * et l'interrupteur du pointage automatique. null pour un compte qui n'est pas une société BTP.
 */
async function lireContexte(user: User): Promise<Contexte | null> {
  const role = getUserRole(user)
  if (role !== 'pro_societe' && role !== 'super_admin') return null
  const societeId = await resolveCompanyId(user, supabaseAdmin)
  if (!societeId) return null
  const [membresRes, chantiersRes, equipesRes, reglageRes] = await Promise.all([
    supabaseAdmin.from('membres_btp').select('*').eq('owner_id', societeId).limit(500),
    supabaseAdmin.from('chantiers_btp').select('*').eq('owner_id', societeId).eq('statut', STATUT_EN_COURS).limit(200),
    supabaseAdmin.from('equipes_btp').select('*, equipe_membres_btp(membre_id)').eq('owner_id', societeId).limit(200),
    supabaseAdmin.from('pointage_reglages_btp').select('*').eq('owner_id', societeId).limit(1),
  ])
  const erreur = membresRes.error || chantiersRes.error || equipesRes.error
  if (erreur) throw new Error(`lecture du contexte : ${erreur.message}`)
  const reglageDisponible = !reglageRes.error || !TABLE_ABSENTE.has(String(reglageRes.error.code))
  // Réglage illisible : le pointage automatique reste coupé (valeur par défaut).
  if (reglageRes.error && reglageDisponible) logger.warn('[btp/pointage] réglage de la société illisible', { error: reglageRes.error.message })
  const membres = (membresRes.data ?? []) as MembreBtp[]
  return {
    societeId,
    gerant: isProGerant(user),
    membres,
    chantiersEnCours: (chantiersRes.data ?? []) as ChantierBtp[],
    equipes: (equipesRes.data ?? []) as EquipeBtp[],
    pointageAutoActive: !reglageRes.error && (reglageRes.data?.[0] as Ligne | undefined)?.auto_active === true,
    reglageDisponible,
    resolution: membreDuCompte(membres, user.email),
  }
}

/** Pointages ouverts (sans heure de départ) de l'employé, du plus ancien au plus récent. */
async function pointagesOuverts(societeId: string, membreId: string): Promise<Ligne[]> {
  const { data, error } = await supabaseAdmin
    .from('pointages_btp')
    .select('*')
    .eq('owner_id', societeId)
    .eq('membre_id', membreId)
    .is('heure_depart', null)
    .order('created_at', { ascending: true })
    .limit(20)
  if (error) throw new Error(`lecture des pointages ouverts : ${error.message}`)
  return (data ?? []) as Ligne[]
}

/** Écrit la clôture d'un pointage encore ouvert ; renvoie la ligne close (ou telle qu'un autre appel l'a close). */
async function clore(societeId: string, ouvert: Ligne, changements: Ligne): Promise<Ligne> {
  const { data, error } = await supabaseAdmin
    .from('pointages_btp')
    .update(changements)
    .eq('id', String(ouvert.id))
    .eq('owner_id', societeId)
    .is('heure_depart', null)
    .select()
  if (error) throw new Error(`clôture du pointage : ${error.message}`)
  if (data && data.length > 0) return data[0] as Ligne
  // Déjà clos par un autre appel (double envoi) : on renvoie l'état enregistré.
  const relu = await supabaseAdmin.from('pointages_btp').select('*').eq('id', String(ouvert.id)).eq('owner_id', societeId).limit(1)
  return (relu.data?.[0] as Ligne | undefined) ?? { ...ouvert, ...changements }
}

/** Clôture au départ `depart` : heures calculées, ou 0 h « à régulariser » si le départ tombe un autre jour. */
function changementsCloture(ouvert: Ligne, depart: number): Ligne {
  const { heureDepart, heuresTravaillees, aRegulariser } = cloture(ouvert, depart)
  const changements: Ligne = { heure_depart: heureDepart, heures_travaillees: heuresTravaillees }
  if (aRegulariser) changements.notes = ajouterNote(ouvert.notes, NOTE_A_REGULARISER)
  return changements
}

/** Clôture sans heures (départ = arrivée) avec une note pour le gérant. */
function changementsSansHeures(ouvert: Ligne, note: string): Ligne {
  return { heure_depart: ouvert.heure_arrivee, heures_travaillees: 0, notes: ajouterNote(ouvert.notes, note) }
}

/** Referme sans heures les pointages oubliés un jour précédent ; renvoie ceux qui restent ouverts aujourd'hui. */
async function regulariserOublis(societeId: string, ouverts: Ligne[], maintenant: number): Promise<Ligne[]> {
  const duJour: Ligne[] = []
  for (const ouvert of ouverts) {
    if (estOublie(ouvert, maintenant)) await clore(societeId, ouvert, changementsSansHeures(ouvert, NOTE_A_REGULARISER))
    else duJour.push(ouvert)
  }
  return duJour
}

/** Pointage tel qu'il part vers l'écran : ni position, ni distance, ni identifiant de société. */
function pointagePourEcran(ligne: Ligne): PointageEcran {
  return {
    id: String(ligne.id),
    chantierId: (ligne.chantier_id as string | null) ?? null,
    chantierNom: (ligne.chantier_nom as string | null) ?? '',
    date: String(ligne.date ?? ''),
    heureArrivee: String(ligne.heure_arrivee ?? ''),
    heureDepart: (ligne.heure_depart as string | null) ?? null,
    heuresTravaillees: Number(ligne.heures_travaillees) || 0,
    mode: (ligne.mode as string | null) ?? 'manuel',
  }
}

/** Pour le gérant : chaque employé actif a-t-il un compte de connexion actif, une invitation en attente, ou rien ? */
async function etatDesComptes(ctx: Contexte, emailGerant: string): Promise<Record<string, StatutCompte>> {
  const { data, error } = await supabaseAdmin.from('pro_team_members').select('*').eq('company_id', ctx.societeId).limit(500)
  if (error) logger.warn('[btp/pointage] lecture des comptes de l’équipe impossible', { error: error.message })
  const actifs = new Set<string>([normaliserEmail(emailGerant)])
  const invites = new Set<string>()
  for (const compte of (data ?? []) as Ligne[]) {
    if (compte.is_active === false) continue
    const email = normaliserEmail(compte.email)
    if (compte.user_id) actifs.add(email)
    else invites.add(email)
  }
  const etats: Record<string, StatutCompte> = {}
  for (const membre of ctx.membres) {
    if (membre.actif === false) continue
    const email = normaliserEmail(membre.email)
    if (email && actifs.has(email)) etats[membre.id] = 'actif'
    else if (email && invites.has(email)) etats[membre.id] = 'invitation'
    else etats[membre.id] = 'aucun'
  }
  return etats
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return refus(401, 'Non autorisé')
  if (!(await checkRateLimit(`btp_pointage_get_${user.id}`, 60, 60_000))) return rateLimitResponse()

  try {
    const ctx = await lireContexte(user)
    if (!ctx) return refus(403, 'Accès réservé aux sociétés BTP')
    const membre = ctx.resolution.statut === 'relie' ? ctx.resolution.membre : null
    const chantiers = membre ? chantiersAffectes(membre, ctx.chantiersEnCours, ctx.equipes) : []
    const maintenant = Date.now()

    let ouverts: Ligne[] = []
    let historique: Ligne[] = []
    if (membre) {
      const depuis = heureLocale(maintenant - JOURS_HISTORIQUE * 86_400_000, fuseauValide(request.nextUrl.searchParams.get('fuseau'))).date
      const [lus, histo] = await Promise.all([
        pointagesOuverts(ctx.societeId, membre.id),
        supabaseAdmin
          .from('pointages_btp')
          .select('*')
          .eq('owner_id', ctx.societeId)
          .eq('membre_id', membre.id)
          .gte('date', depuis)
          .order('date', { ascending: false })
          .order('heure_arrivee', { ascending: false })
          .limit(100),
      ])
      if (histo.error) throw new Error(`lecture de l’historique : ${histo.error.message}`)
      ouverts = lus
      historique = (histo.data ?? []) as Ligne[]
    }
    const duJour = ouverts.filter(o => !estOublie(o, maintenant))

    const corps: ContextePointage = {
      gerant: ctx.gerant,
      rattachement: ctx.resolution.statut,
      moi: membre ? { id: membre.id, nom: [membre.prenom, membre.nom].filter(Boolean).join(' ') } : null,
      chantiers: chantiers.map(chantierPourTelephone),
      pointageEnCours: duJour.length > 0 ? pointagePourEcran(duJour[duJour.length - 1]) : null,
      pointagesOublies: ouverts.filter(o => estOublie(o, maintenant)).map(pointagePourEcran),
      historique: historique.map(pointagePourEcran),
      pointageAutoActive: ctx.pointageAutoActive,
      reglageDisponible: ctx.reglageDisponible,
    }
    if (ctx.gerant) {
      corps.comptes = await etatDesComptes(ctx, user.email ?? '')
      // La colonne chantiers_btp.membres_ids vient de la migration 20261116 : sans elle, seules les équipes s'affectent.
      corps.affectationIndividuelle = ctx.chantiersEnCours.length === 0 || ctx.chantiersEnCours.some(c => 'membres_ids' in c)
    }
    return NextResponse.json(corps)
  } catch (err) {
    logger.error('[btp/pointage] GET', { error: err instanceof Error ? err.message : err })
    return refus(500, 'Erreur serveur')
  }
}

/** Le gérant active ou coupe le pointage automatique de sa société ; l'activation garde qui l'a confirmée et quand. */
async function reglerPointageAuto(ctx: Contexte, user: User, actif: boolean, confirmation: boolean | undefined) {
  if (!ctx.gerant) return refus(403, 'reserve_au_gerant')
  if (actif && confirmation !== true) return refus(422, 'confirmation_requise')
  const maintenant = new Date().toISOString()
  const ligne: Ligne = { owner_id: ctx.societeId, auto_active: actif, modifie_le: maintenant }
  if (actif) {
    ligne.confirme_le = maintenant
    ligne.confirme_par = user.id
  }
  const { error } = await supabaseAdmin.from('pointage_reglages_btp').upsert(ligne, { onConflict: 'owner_id' })
  if (error) {
    if (TABLE_ABSENTE.has(String(error.code))) return refus(409, 'migration_requise')
    throw new Error(`réglage du pointage automatique : ${error.message}`)
  }
  return NextResponse.json({ pointageAutoActive: actif })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return refus(401, 'Non autorisé')
  if (!(await checkRateLimit(`btp_pointage_post_${user.id}`, 30, 60_000))) return rateLimitResponse()

  let brut: unknown
  try { brut = await request.json() } catch {
    return refus(400, 'Corps invalide')
  }
  const lu = corpsSchema.safeParse(brut)
  if (!lu.success) return refus(400, 'Données invalides')
  const corps = lu.data

  try {
    const ctx = await lireContexte(user)
    if (!ctx) return refus(403, 'Accès réservé aux sociétés BTP')
    if (corps.action === 'reglage_auto') return await reglerPointageAuto(ctx, user, corps.actif, corps.confirmation)

    if (ctx.resolution.statut !== 'relie') return refus(409, ctx.resolution.statut === 'ambigu' ? 'fiche_ambigue' : 'fiche_absente')
    if (corps.mode === 'geo_auto' && !ctx.pointageAutoActive) return refus(403, 'pointage_auto_desactive')
    const membre = ctx.resolution.membre
    const maintenant = Date.now()
    const duJour = await regulariserOublis(ctx.societeId, await pointagesOuverts(ctx.societeId, membre.id), maintenant)

    if (corps.action === 'depart') {
      if (duJour.length === 0) return refus(404, 'aucun_pointage_en_cours')
      // Le plus ancien pointage ouvert sur le chantier du plus récent porte la vraie heure d'arrivée ; les autres pointages
      // ouverts du jour (doublons d'un double envoi sans l'index de la migration) sont refermés sans heures.
      const recent = duJour[duJour.length - 1]
      const principal = duJour.find(o => o.chantier_id === recent.chantier_id) ?? recent
      // Le téléphone ne termine tout seul qu'un pointage automatique, et seulement sur le chantier qu'il a quitté.
      if (corps.mode === 'geo_auto' && (principal.mode !== 'geo_auto' || principal.chantier_id !== corps.chantierId)) {
        return refus(409, 'pointage_different')
      }
      const depart = instantDepart(corps.mode, corps.observeA, maintenant, reperesArrivee(principal).instant)
      const changements = changementsCloture(principal, depart)
      // Sortie que le téléphone n'a pas pu dater (veille) : le gérant voit l'heure de la dernière présence sur place.
      const note = noteDepartApresCoupure(principal, corps.derniereVue, depart)
      if (note) changements.notes = ajouterNote(changements.notes ?? principal.notes, note)
      const clos = await clore(ctx.societeId, principal, changements)
      for (const autre of duJour) {
        if (autre !== principal) await clore(ctx.societeId, autre, changementsSansHeures(autre, NOTE_DOUBLON))
      }
      return NextResponse.json({ pointage: pointagePourEcran(clos) })
    }

    const chantier = chantiersAffectes(membre, ctx.chantiersEnCours, ctx.equipes).find(c => c.id === corps.chantierId)
    if (!chantier) return refus(403, 'chantier_non_affecte')
    if (corps.mode === 'geo_auto' && chantierPourTelephone(chantier).latitude === null) {
      return refus(422, 'chantier_sans_position')
    }

    const surCeChantier = duJour.find(o => o.chantier_id === chantier.id)
    if (surCeChantier) return NextResponse.json({ pointage: pointagePourEcran(surCeChantier), deja: true })
    // Le téléphone ne termine jamais tout seul un autre pointage (commencé à la main, ou sur un chantier dont il n'a pas
    // vu la sortie) : c'est à l'employé de le terminer.
    if (corps.mode === 'geo_auto' && duJour.length > 0) return refus(409, 'pointage_different')

    const instant = instantArrivee(corps.mode, corps.observeA, maintenant)
    // Un seul pointage ouvert par employé : arriver à la main sur un autre chantier clôt le précédent à cette heure.
    for (const ouvert of duJour) await clore(ctx.societeId, ouvert, changementsCloture(ouvert, Math.max(instant, reperesArrivee(ouvert).instant)))

    const arrivee = heureLocale(instant, fuseauValide(corps.fuseau))
    const { data, error } = await supabaseAdmin
      .from('pointages_btp')
      .insert({
        owner_id: ctx.societeId,
        membre_id: membre.id,
        chantier_id: chantier.id,
        employe: [membre.prenom, membre.nom].filter(Boolean).join(' ') || normaliserEmail(membre.email),
        poste: membre.type_compte ?? null,
        chantier_nom: chantier.titre ?? null,
        date: arrivee.date,
        heure_arrivee: arrivee.heure,
        heure_depart: null,
        pause_minutes: 0,
        heures_travaillees: null,
        notes: null,
        mode: corps.mode,
        // Instant de l'arrivée : la durée se calculera dessus au départ, quel que soit le fuseau annoncé alors.
        created_at: new Date(instant).toISOString(),
      })
      .select()
      .single()
    if (error) {
      // Index « un pointage ouvert par employé » (migration 20261116) : un double envoi simultané a déjà ouvert le pointage.
      if (error.code === '23505') {
        const existants = await pointagesOuverts(ctx.societeId, membre.id)
        const existant = existants[existants.length - 1]
        if (existant) return NextResponse.json({ pointage: pointagePourEcran(existant), deja: true })
      }
      throw new Error(`création du pointage : ${error.message}`)
    }
    return NextResponse.json({ pointage: pointagePourEcran(data as Ligne) }, { status: 201 })
  } catch (err) {
    logger.error('[btp/pointage] POST', { action: corps.action, error: err instanceof Error ? err.message : err })
    return refus(500, 'Erreur serveur')
  }
}
