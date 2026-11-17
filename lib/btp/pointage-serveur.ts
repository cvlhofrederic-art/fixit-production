// Pointage BTP — lectures et écritures communes aux routes serveur : /api/btp/pointage (écran Pointage, compte
// connecté) et /api/btp/pointage/evenement (arrivées et départs envoyés par l'appli, téléphone en poche).
// Toujours la société résolue côté serveur, jamais une société désignée par le client. Aucun pointage existant n'est
// réécrit, sauf la clôture des pointages ouverts de l'employé lui-même.

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import {
  NOTE_A_REGULARISER,
  STATUT_EN_COURS,
  ajouterNote,
  cloture,
  estOublie,
  heureLocale,
  normaliserEmail,
  type ChantierBtp,
  type EquipeBtp,
  type MembreBtp,
  type PointageEcran,
} from '@/lib/btp/pointage-regles'

export type Ligne = Record<string, unknown>

/** Table absente (migration non appliquée) : PostgreSQL 42P01, PostgREST PGRST205 (cache du schéma). */
export const TABLE_ABSENTE = new Set(['42P01', 'PGRST205'])

export interface DonneesSociete {
  societeId: string
  membres: MembreBtp[]
  chantiersEnCours: ChantierBtp[]
  equipes: EquipeBtp[]
  pointageAutoActive: boolean
  reglageDisponible: boolean
  /** Faux si le réglage n'a pas pu être lu (panne passagère) : rien ne se décide alors sur le mode automatique. */
  reglageLu: boolean
}

/** Employés, chantiers en cours, équipes et interrupteur du pointage automatique de la société. */
export async function lireDonneesSociete(societeId: string): Promise<DonneesSociete> {
  const [membresRes, chantiersRes, equipesRes, reglageRes] = await Promise.all([
    supabaseAdmin.from('membres_btp').select('*').eq('owner_id', societeId).limit(500),
    supabaseAdmin.from('chantiers_btp').select('*').eq('owner_id', societeId).eq('statut', STATUT_EN_COURS).limit(200),
    supabaseAdmin.from('equipes_btp').select('*, equipe_membres_btp(membre_id)').eq('owner_id', societeId).limit(200),
    supabaseAdmin.from('pointage_reglages_btp').select('*').eq('owner_id', societeId).limit(1),
  ])
  const erreur = membresRes.error || chantiersRes.error || equipesRes.error
  if (erreur) throw new Error(`lecture du contexte : ${erreur.message}`)
  const reglageDisponible = !reglageRes.error || !TABLE_ABSENTE.has(String(reglageRes.error.code))
  const reglageLu = !reglageRes.error || !reglageDisponible
  // Réglage illisible : le pointage automatique reste coupé (valeur par défaut).
  if (reglageRes.error && reglageDisponible) logger.warn('[btp/pointage] réglage de la société illisible', { error: reglageRes.error.message })
  return {
    societeId,
    membres: (membresRes.data ?? []) as MembreBtp[],
    chantiersEnCours: (chantiersRes.data ?? []) as ChantierBtp[],
    equipes: (equipesRes.data ?? []) as EquipeBtp[],
    pointageAutoActive: !reglageRes.error && (reglageRes.data?.[0] as Ligne | undefined)?.auto_active === true,
    reglageDisponible,
    reglageLu,
  }
}

/** Pointages ouverts (sans heure de départ) de l'employé, du plus ancien au plus récent. */
export async function pointagesOuverts(societeId: string, membreId: string): Promise<Ligne[]> {
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
export async function clore(societeId: string, ouvert: Ligne, changements: Ligne): Promise<Ligne> {
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
export function changementsCloture(ouvert: Ligne, depart: number): Ligne {
  const { heureDepart, heuresTravaillees, aRegulariser } = cloture(ouvert, depart)
  const changements: Ligne = { heure_depart: heureDepart, heures_travaillees: heuresTravaillees }
  if (aRegulariser) changements.notes = ajouterNote(ouvert.notes, NOTE_A_REGULARISER)
  return changements
}

/** Clôture sans heures (départ = arrivée) avec une note pour le gérant. */
export function changementsSansHeures(ouvert: Ligne, note: string): Ligne {
  return { heure_depart: ouvert.heure_arrivee, heures_travaillees: 0, notes: ajouterNote(ouvert.notes, note) }
}

/** Referme sans heures les pointages oubliés un jour précédent ; renvoie ceux qui restent ouverts aujourd'hui. */
export async function regulariserOublis(societeId: string, ouverts: Ligne[], maintenant: number): Promise<Ligne[]> {
  const duJour: Ligne[] = []
  for (const ouvert of ouverts) {
    if (estOublie(ouvert, maintenant)) await clore(societeId, ouvert, changementsSansHeures(ouvert, NOTE_A_REGULARISER))
    else duJour.push(ouvert)
  }
  return duJour
}

/** Pointage tel qu'il part vers l'écran : ni position, ni distance, ni identifiant de société. */
export function pointagePourEcran(ligne: Ligne): PointageEcran {
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

/**
 * Ouvre un pointage de l'employé sur le chantier à l'instant donné (date et heure murales dans le fuseau donné).
 * Si un autre envoi l'a déjà ouvert (index « un pointage ouvert par employé », migration 20261116), renvoie celui-là
 * avec `deja`.
 */
export async function ouvrirPointage(params: {
  societeId: string
  membre: MembreBtp
  chantier: ChantierBtp
  instant: number
  fuseau: string
  mode: 'geo_auto' | 'manuel'
  /** Note pour le gérant posée dès l'ouverture (arrivée reçue tard, par exemple). */
  notes?: string | null
}): Promise<{ ligne: Ligne; deja: boolean }> {
  const { societeId, membre, chantier, instant, fuseau, mode, notes = null } = params
  const arrivee = heureLocale(instant, fuseau)
  const { data, error } = await supabaseAdmin
    .from('pointages_btp')
    .insert({
      owner_id: societeId,
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
      notes,
      mode,
      // Instant de l'arrivée : la durée se calculera dessus au départ, quel que soit le fuseau annoncé alors.
      created_at: new Date(instant).toISOString(),
    })
    .select()
    .single()
  if (!error) return { ligne: data as Ligne, deja: false }
  if (error.code === '23505') {
    const existants = await pointagesOuverts(societeId, membre.id)
    const existant = existants.at(-1)
    if (existant) return { ligne: existant, deja: true }
  }
  throw new Error(`création du pointage : ${error.message}`)
}
