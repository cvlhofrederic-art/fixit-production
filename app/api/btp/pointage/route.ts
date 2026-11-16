import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole, isProGerant, resolveCompanyId } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  chantierPourTelephone,
  chantiersAffectes,
  cloturer,
  fuseauValide,
  heureLocale,
  instantRetenu,
  membreDuCompte,
  normaliserEmail,
  STATUT_EN_COURS,
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
//        par chantiers_btp.membres_ids ou par son équipe, equipes_btp.chantier_id), son pointage en cours, ses
//        pointages des 31 derniers jours et l'interrupteur du pointage automatique de la société ; pour le gérant,
//        l'état des comptes de connexion de ses employés.
// POST : { action: 'arrivee' | 'depart' } — pointage de l'employé connecté, sur un chantier qui lui est affecté.
//
// Ni position ni distance ne sont reçues ou conservées : le téléphone décide seul de l'arrivée et du départ, le
// serveur n'enregistre que le chantier, l'heure et le mode (automatique ou à la main). Le mode automatique est
// refusé tant que le gérant ne l'a pas activé (settings_btp.geo_pointage_enabled, faux par défaut).
// Toutes les écritures visent la société résolue côté serveur (resolveCompanyId), jamais une société désignée par
// le client. Aucun pointage existant n'est réécrit, sauf la clôture d'un pointage ouvert de l'employé lui-même.
// ═══════════════════════════════════════════════════════════════════════════════

const JOURS_HISTORIQUE = 31
const champsCommuns = {
  mode: z.enum(['geo_auto', 'manuel']),
  observeA: z.number().optional(),
  fuseau: z.string().max(64).optional(),
}
const corpsSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('arrivee'), chantierId: z.string().uuid(), ...champsCommuns }),
  z.object({ action: z.literal('depart'), ...champsCommuns }),
])

type Ligne = Record<string, unknown>

interface Contexte {
  societeId: string
  gerant: boolean
  membres: MembreBtp[]
  chantiersEnCours: ChantierBtp[]
  equipes: EquipeBtp[]
  pointageAutoActive: boolean
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
  const [membresRes, chantiersRes, equipesRes, reglagesRes] = await Promise.all([
    supabaseAdmin.from('membres_btp').select('*').eq('owner_id', societeId).limit(500),
    supabaseAdmin.from('chantiers_btp').select('*').eq('owner_id', societeId).eq('statut', STATUT_EN_COURS).limit(200),
    supabaseAdmin.from('equipes_btp').select('*, equipe_membres_btp(membre_id)').eq('owner_id', societeId).limit(200),
    supabaseAdmin.from('settings_btp').select('*').eq('owner_id', societeId).limit(1),
  ])
  const erreur = membresRes.error || chantiersRes.error || equipesRes.error
  if (erreur) throw new Error(`lecture du contexte : ${erreur.message}`)
  // Réglages illisibles : le pointage automatique reste coupé (valeur par défaut de la colonne).
  if (reglagesRes.error) logger.warn('[btp/pointage] réglages de la société illisibles', { error: reglagesRes.error.message })
  const membres = (membresRes.data ?? []) as MembreBtp[]
  return {
    societeId,
    gerant: isProGerant(user),
    membres,
    chantiersEnCours: (chantiersRes.data ?? []) as ChantierBtp[],
    equipes: (equipesRes.data ?? []) as EquipeBtp[],
    pointageAutoActive: (reglagesRes.data?.[0] as Ligne | undefined)?.geo_pointage_enabled === true,
    resolution: membreDuCompte(membres, user.email),
  }
}

/** Pointage ouvert (sans heure de départ) de l'employé, le plus récent. */
async function pointageOuvert(societeId: string, membreId: string): Promise<Ligne | null> {
  const { data, error } = await supabaseAdmin
    .from('pointages_btp')
    .select('*')
    .eq('owner_id', societeId)
    .eq('membre_id', membreId)
    .is('heure_depart', null)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`lecture du pointage ouvert : ${error.message}`)
  return (data?.[0] as Ligne | undefined) ?? null
}

/** Clôt le pointage ouvert à l'instant donné ; renvoie la ligne close (ou telle qu'un autre appel l'a close). */
async function cloturerPointage(societeId: string, ouvert: Ligne, instant: number, fuseau: string): Promise<Ligne> {
  const { heureDepart, heuresTravaillees, clotureForcee } = cloturer(
    { date: String(ouvert.date), heure: String(ouvert.heure_arrivee) },
    heureLocale(instant, fuseau),
    Number(ouvert.pause_minutes) || 0,
  )
  const changements: Ligne = { heure_depart: heureDepart, heures_travaillees: heuresTravaillees }
  if (clotureForcee) {
    const note = 'Départ non pointé le jour même : clôturé à 23:59.'
    changements.notes = ouvert.notes ? `${String(ouvert.notes)} ${note}` : note
  }
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

    let enCours: Ligne | null = null
    let historique: Ligne[] = []
    if (membre) {
      const fuseau = fuseauValide(request.nextUrl.searchParams.get('fuseau'))
      const depuis = heureLocale(Date.now() - JOURS_HISTORIQUE * 86_400_000, fuseau).date
      const [ouvert, histo] = await Promise.all([
        pointageOuvert(ctx.societeId, membre.id),
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
      enCours = ouvert
      historique = (histo.data ?? []) as Ligne[]
    }

    const corps: ContextePointage = {
      gerant: ctx.gerant,
      rattachement: ctx.resolution.statut,
      moi: membre ? { id: membre.id, nom: [membre.prenom, membre.nom].filter(Boolean).join(' ') } : null,
      chantiers: chantiers.map(chantierPourTelephone),
      pointageEnCours: enCours ? pointagePourEcran(enCours) : null,
      historique: historique.map(pointagePourEcran),
      pointageAutoActive: ctx.pointageAutoActive,
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
    if (ctx.resolution.statut !== 'relie') return refus(409, ctx.resolution.statut === 'ambigu' ? 'fiche_ambigue' : 'fiche_absente')
    if (corps.mode === 'geo_auto' && !ctx.pointageAutoActive) return refus(403, 'pointage_auto_desactive')
    const membre = ctx.resolution.membre
    const fuseau = fuseauValide(corps.fuseau)
    const instant = instantRetenu(corps.observeA, Date.now())

    if (corps.action === 'depart') {
      const ouvert = await pointageOuvert(ctx.societeId, membre.id)
      if (!ouvert) return refus(404, 'aucun_pointage_en_cours')
      const clos = await cloturerPointage(ctx.societeId, ouvert, instant, fuseau)
      return NextResponse.json({ pointage: pointagePourEcran(clos) })
    }

    const chantier = chantiersAffectes(membre, ctx.chantiersEnCours, ctx.equipes).find(c => c.id === corps.chantierId)
    if (!chantier) return refus(403, 'chantier_non_affecte')
    if (corps.mode === 'geo_auto' && chantierPourTelephone(chantier).latitude === null) {
      return refus(422, 'chantier_sans_position')
    }

    const ouvert = await pointageOuvert(ctx.societeId, membre.id)
    if (ouvert && ouvert.chantier_id === chantier.id) {
      return NextResponse.json({ pointage: pointagePourEcran(ouvert), deja: true })
    }
    // Un seul pointage ouvert par employé : arriver sur un autre chantier clôt le précédent.
    if (ouvert) await cloturerPointage(ctx.societeId, ouvert, instant, fuseau)

    const arrivee = heureLocale(instant, fuseau)
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
      })
      .select()
      .single()
    if (error) {
      // Index « un pointage ouvert par employé » (migration 20261116) : un double envoi simultané a déjà ouvert le pointage.
      if (error.code === '23505') {
        const existant = await pointageOuvert(ctx.societeId, membre.id)
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
