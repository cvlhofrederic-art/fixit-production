import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole, isProGerant, resolveCompanyId } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  NOTE_DOUBLON,
  ajouterNote,
  chantierPourTelephone,
  chantiersAffectes,
  estOublie,
  fuseauValide,
  heureLocale,
  instantArrivee,
  instantDepart,
  membreDuCompte,
  normaliserEmail,
  noteDepartApresCoupure,
  reperesArrivee,
  type ContextePointage,
  type MembreBtp,
  type ResolutionMembre,
  type StatutCompte,
} from '@/lib/btp/pointage-regles'
import {
  TABLE_ABSENTE,
  changementsCloture,
  changementsSansHeures,
  clore,
  lireDonneesSociete,
  ouvrirPointage,
  pointagePourEcran,
  pointagesOuverts,
  regulariserOublis,
  type DonneesSociete,
  type Ligne,
} from '@/lib/btp/pointage-serveur'
import { empreinteJeton, nouveauJeton } from '@/lib/btp/pointage-arriere-plan'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/btp/pointage — pointage des employés d'une société BTP (pro_societe) sur leurs chantiers en cours.
//
// GET  : ce dont l'écran Pointage a besoin pour le compte connecté (gérant ou sous-compte de l'équipe) : sa fiche
//        employé (membres_btp, même adresse e-mail que le compte), ses chantiers « En cours » affectés (directement
//        par chantiers_btp.membres_ids ou par son équipe, equipes_btp.chantier_id), son pointage du jour, ses départs
//        oubliés, ses pointages des 31 derniers jours, l'interrupteur du pointage automatique de la société, et si un
//        téléphone de ce compte pointe en arrière-plan ; pour le gérant, l'état des comptes de connexion de ses
//        employés. Aucune écriture.
// POST : { action: 'arrivee' | 'depart' } — pointage de l'employé connecté, sur un chantier qui lui est affecté ;
//        { action: 'reglage_auto' } — le gérant active ou coupe le pointage automatique (après confirmation) ;
//        { action: 'appareil' | 'appareil_retirer' } — l'employé enregistre ce téléphone pour le pointage en arrière-plan
//        (appli Vitfix Pro, téléphone en poche) ou le retire. Le jeton rendu ne sert qu'à /api/btp/pointage/evenement,
//        où l'appli envoie les arrivées et départs détectés par le système. Les pointages faits ici (ou modifiés)
//        priment sur ce que le téléphone envoie (voir la route des événements).
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
  z.object({ action: z.literal('appareil'), plateforme: z.enum(['android', 'ios']), fuseau: z.string().max(64).optional() }),
  z.object({ action: z.literal('appareil_retirer'), appareil: z.string().uuid() }),
])

interface Contexte extends DonneesSociete {
  gerant: boolean
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
  const donnees = await lireDonneesSociete(societeId)
  return { ...donnees, gerant: isProGerant(user), resolution: membreDuCompte(donnees.membres, user.email) }
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

/**
 * Téléphone de ce compte qui pointe en arrière-plan (enregistré et pas retiré) : son identifiant, ou null ; disponible
 * est faux tant que la table n'existe pas (migration 20261117) ; lu est faux sur une autre erreur (panne passagère).
 */
async function appareilActif(userId: string): Promise<{ id: string | null; disponible: boolean; lu: boolean }> {
  const { data, error } = await supabaseAdmin.from('pointage_appareils_btp').select('id').eq('user_id', userId).is('retire_le', null).limit(1)
  if (error) {
    const absente = TABLE_ABSENTE.has(String(error.code))
    if (!absente) logger.warn('[btp/pointage] téléphones du compte illisibles', { error: error.message })
    return { id: null, disponible: !absente, lu: absente }
  }
  const id = (data as Ligne[] | null)?.[0]?.id
  return { id: typeof id === 'string' ? id : null, disponible: true, lu: true }
}

/**
 * Retire les téléphones encore actifs (pointage en arrière-plan) qui répondent à tous les filtres : un téléphone d'un
 * compte (id + user_id), ceux d'un compte (user_id) ou de toute la société (owner_id). Renvoie combien ; table
 * absente : aucun.
 */
async function retirerAppareils(filtres: Partial<Record<'id' | 'user_id' | 'owner_id', string>>): Promise<number> {
  let requete = supabaseAdmin.from('pointage_appareils_btp').update({ retire_le: new Date().toISOString() }).is('retire_le', null)
  for (const [colonne, valeur] of Object.entries(filtres)) requete = requete.eq(colonne, valeur)
  const { data, error } = await requete.select('id')
  if (error) {
    if (TABLE_ABSENTE.has(String(error.code))) return 0
    throw new Error(`retrait des téléphones : ${error.message}`)
  }
  return (data ?? []).length
}


/**
 * Enregistre ce téléphone pour le pointage en arrière-plan de l'employé connecté : jeton neuf (seule son empreinte est
 * gardée), téléphones précédents du compte retirés (un seul téléphone pointe pour un compte).
 */
async function enregistrerAppareil(
  request: NextRequest, ctx: Contexte, user: User, membre: MembreBtp, plateforme: 'android' | 'ios', fuseau: string | undefined,
) {
  if (!ctx.pointageAutoActive) return refus(403, 'pointage_auto_desactive')
  await retirerAppareils({ user_id: user.id })
  const jeton = nouveauJeton()
  const appareil = crypto.randomUUID()
  const { error } = await supabaseAdmin.from('pointage_appareils_btp').insert({
    id: appareil,
    owner_id: ctx.societeId,
    membre_id: membre.id,
    user_id: user.id,
    empreinte: await empreinteJeton(jeton),
    plateforme,
    // Rattachement du compte à sa fiche (par l'adresse e-mail) : si elle change, le téléphone ne pointe plus.
    email_fiche: normaliserEmail(membre.email),
    fuseau: fuseauValide(fuseau),
  })
  if (error) {
    if (TABLE_ABSENTE.has(String(error.code))) return refus(409, 'migration_requise_appareils')
    // Index « un téléphone actif par compte » : une autre activation du même compte est passée entre-temps.
    if (String(error.code) === '23505') return refus(409, 'activation_en_cours')
    throw new Error(`enregistrement du téléphone : ${error.message}`)
  }
  return NextResponse.json({ appareil, jeton, url: `${request.nextUrl.origin}/api/btp/pointage/evenement` }, { status: 201 })
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
      pointageEnCours: duJour.length > 0 ? pointagePourEcran(duJour.at(-1) as Ligne) : null,
      pointagesOublies: ouverts.filter(o => estOublie(o, maintenant)).map(pointagePourEcran),
      historique: historique.map(pointagePourEcran),
      pointageAutoActive: ctx.pointageAutoActive,
      reglageDisponible: ctx.reglageDisponible,
      ...(await telephoneDuCompte(user.id, ctx.reglageLu)),
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

/**
 * Téléphone en arrière-plan du compte pour l'écran, disponibilité de la table, et incertitude : réglage ou téléphones
 * illisibles (panne passagère), l'appli ne retire rien sur la foi de cette réponse.
 */
async function telephoneDuCompte(
  userId: string, reglageLu: boolean,
): Promise<Pick<ContextePointage, 'appareilArrierePlan' | 'arrierePlanDisponible' | 'arrierePlanIncertain'>> {
  const { id, disponible, lu } = await appareilActif(userId)
  return { appareilArrierePlan: id, arrierePlanDisponible: disponible, arrierePlanIncertain: !lu || !reglageLu }
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
  if (!actif) {
    // Couper le mode automatique coupe aussi le téléphone en poche de tous les employés : chacun le réactivera s'il le
    // veut. Un échec ne bloque rien : le mode coupé, leurs envois sont de toute façon ignorés.
    await retirerAppareils({ owner_id: ctx.societeId }).catch((err: unknown) => {
      logger.warn('[btp/pointage] téléphones de la société non retirés', { error: err instanceof Error ? err.message : err })
    })
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
    // Couper le pointage en arrière-plan reste possible même sans fiche employé reliée (compte détaché entre-temps) ;
    // seulement ce téléphone-là, jamais un autre téléphone du compte.
    if (corps.action === 'appareil_retirer') {
      return NextResponse.json({ retires: await retirerAppareils({ id: corps.appareil, user_id: user.id }) })
    }

    if (ctx.resolution.statut !== 'relie') return refus(409, ctx.resolution.statut === 'ambigu' ? 'fiche_ambigue' : 'fiche_absente')
    const membre = ctx.resolution.membre
    if (corps.action === 'appareil') return await enregistrerAppareil(request, ctx, user, membre, corps.plateforme, corps.fuseau)
    if (corps.mode === 'geo_auto' && !ctx.pointageAutoActive) return refus(403, 'pointage_auto_desactive')
    const maintenant = Date.now()
    const duJour = await regulariserOublis(ctx.societeId, await pointagesOuverts(ctx.societeId, membre.id), maintenant)

    if (corps.action === 'depart') {
      if (duJour.length === 0) return refus(404, 'aucun_pointage_en_cours')
      // Le plus ancien pointage ouvert sur le chantier du plus récent porte la vraie heure d'arrivée ; les autres pointages
      // ouverts du jour (doublons d'un double envoi sans l'index de la migration) sont refermés sans heures.
      const recent = duJour.at(-1) as Ligne
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

    const { ligne, deja } = await ouvrirPointage({
      societeId: ctx.societeId, membre, chantier, instant, fuseau: fuseauValide(corps.fuseau), mode: corps.mode,
    })
    if (deja) return NextResponse.json({ pointage: pointagePourEcran(ligne), deja: true })
    return NextResponse.json({ pointage: pointagePourEcran(ligne) }, { status: 201 })
  } catch (err) {
    logger.error('[btp/pointage] POST', { action: corps.action, error: err instanceof Error ? err.message : err })
    return refus(500, 'Erreur serveur')
  }
}
