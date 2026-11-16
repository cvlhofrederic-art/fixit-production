// Règles du pointage BTP, pures (sans base ni réseau) : quelle fiche employé correspond au compte connecté, quels
// chantiers lui sont affectés, heure locale du pointage, clôture d'un pointage et export CSV.
// Cadre légal (recherche du 16/11/2026, sources officielles) : en France, la géolocalisation ne contrôle le temps de
// travail que faute d'autre moyen (CE 15/12/2017 n° 403776) et doit rester désactivable par le salarié (CNIL) ; au
// Portugal, la CNPD tient la géolocalisation des téléphones pour une surveillance à distance (art. 20 du Código do
// Trabalho, délibération 7680/2014). D'où : pointage automatique désactivé tant que le gérant ne l'a pas activé,
// activé par l'employé lui-même, pointage à la main de même valeur, et ni position ni distance enregistrées.
// Utilisées par app/api/btp/pointage/route.ts et l'écran Pointage ; tests : tests/lib/btp-pointage-regles.test.ts.

import { coordonneesValides, rayonEffectifM, type ChantierPointable } from './pointage-geo'

/** Fuseau retenu quand le téléphone n'en annonce pas un de la liste. */
export const FUSEAU_PAR_DEFAUT = 'Europe/Paris'
/**
 * Fuseaux acceptés : France métropolitaine et d'outre-mer, Portugal continental et îles. Le fuseau ne sert qu'à écrire
 * la date et l'heure murales du pointage ; les heures travaillées se calculent sur des instants UTC (cloture), si bien
 * que changer le fuseau du téléphone entre l'arrivée et le départ ne change pas la durée.
 */
export const FUSEAUX_AUTORISES: readonly string[] = [
  'Europe/Paris', 'Europe/Lisbon', 'Atlantic/Madeira', 'Atlantic/Azores',
  'America/Guadeloupe', 'America/Martinique', 'America/Cayenne', 'Indian/Reunion', 'Indian/Mayotte',
]
/** Âge maximal de l'instant d'entrée dans la zone annoncé par le téléphone pour une arrivée automatique. */
export const TOLERANCE_HORLOGE_MS = 10 * 60_000
/** Note posée sur un pointage dont le départ n'a pas été pointé le jour même (refermé sans heures). */
export const NOTE_A_REGULARISER = 'Départ non pointé : à régulariser.'
/** Note posée sur un pointage ouvert en double le même jour (sans la migration 20261116), refermé sans heures. */
export const NOTE_DOUBLON = 'Pointage en double : à vérifier.'
/** Statut des chantiers sur lesquels on pointe. */
export const STATUT_EN_COURS = 'En cours'

export interface MembreBtp {
  id: string
  prenom?: string | null
  nom?: string | null
  email?: string | null
  actif?: boolean | null
  equipe_id?: string | null
  type_compte?: string | null
}

export interface ChantierBtp {
  id: string
  titre?: string | null
  adresse?: string | null
  ville?: string | null
  code_postal?: string | null
  statut?: string | null
  latitude?: number | null
  longitude?: number | null
  geo_rayon_m?: number | null
  membres_ids?: string[] | null
}

export interface EquipeBtp {
  id: string
  nom?: string | null
  chantier_id?: string | null
  equipe_membres_btp?: Array<{ membre_id: string }> | null
}

/** Chantier tel qu'il part vers le téléphone de l'employé : rien d'autre que ce qu'il faut pour pointer. */
export interface ChantierDuTelephone {
  id: string
  titre: string
  adresse: string
  latitude: number | null
  longitude: number | null
  rayonM: number
}

export type ResolutionMembre =
  | { statut: 'relie'; membre: MembreBtp }
  | { statut: 'aucun' }
  | { statut: 'ambigu' }

/** Pointage tel que l'écran le reçoit : ni position, ni distance, ni identifiant de société. */
export interface PointageEcran {
  id: string
  chantierId: string | null
  chantierNom: string
  date: string
  heureArrivee: string
  heureDepart: string | null
  heuresTravaillees: number
  mode: string
}

/** Compte de connexion d'un employé : actif (il peut pointer depuis son téléphone), invitation en attente, aucun. */
export type StatutCompte = 'actif' | 'invitation' | 'aucun'

/** Réponse de GET /api/btp/pointage. */
export interface ContextePointage {
  gerant: boolean
  rattachement: ResolutionMembre['statut']
  moi: { id: string; nom: string } | null
  chantiers: ChantierDuTelephone[]
  /** Pointage ouvert aujourd'hui (le plus récent), null sinon. */
  pointageEnCours: PointageEcran | null
  /** Pointages restés ouverts un jour précédent (départ oublié) : refermés sans heures au prochain pointage. */
  pointagesOublies: PointageEcran[]
  historique: PointageEcran[]
  /** Pointage automatique activé par le gérant pour la société (pointage_reglages_btp, coupé par défaut). */
  pointageAutoActive: boolean
  /** Faux tant que la migration 20261116 (table pointage_reglages_btp) n'est pas appliquée : le mode automatique attend. */
  reglageDisponible: boolean
  /** Gérant seulement : état du compte de connexion de chaque employé actif. */
  comptes?: Record<string, StatutCompte>
  /** Gérant seulement : false tant que la migration 20261116 (chantiers_btp.membres_ids) n'est pas appliquée. */
  affectationIndividuelle?: boolean
}

export const normaliserEmail = (email: unknown): string => (typeof email === 'string' ? email.trim().toLowerCase() : '')

/**
 * Fiche employé (membres_btp, société du compte) qui porte l'adresse e-mail du compte connecté. Une fiche inactive ne
 * compte pas ; deux fiches actives à la même adresse rendent le rattachement ambigu (aucune n'est choisie).
 */
export function membreDuCompte(membres: readonly MembreBtp[], email: unknown): ResolutionMembre {
  const cible = normaliserEmail(email)
  if (!cible) return { statut: 'aucun' }
  const trouves = membres.filter(m => m.actif !== false && normaliserEmail(m.email) === cible)
  if (trouves.length === 1) return { statut: 'relie', membre: trouves[0] }
  return trouves.length === 0 ? { statut: 'aucun' } : { statut: 'ambigu' }
}

/** Équipes du membre : table de liaison equipe_membres_btp, ou ancienne colonne membres_btp.equipe_id. */
export function equipesDuMembre(membre: MembreBtp, equipes: readonly EquipeBtp[]): Set<string> {
  const ids = new Set<string>()
  for (const equipe of equipes) {
    if ((equipe.equipe_membres_btp ?? []).some(lien => lien.membre_id === membre.id)) ids.add(equipe.id)
  }
  if (membre.equipe_id && equipes.some(e => e.id === membre.equipe_id)) ids.add(membre.equipe_id)
  return ids
}

/** Chantiers « En cours » affectés au membre : directement (membres_ids) ou par l'une de ses équipes (chantier_id). */
export function chantiersAffectes(
  membre: MembreBtp,
  chantiers: readonly ChantierBtp[],
  equipes: readonly EquipeBtp[],
): ChantierBtp[] {
  const sesEquipes = equipesDuMembre(membre, equipes)
  const parEquipe = new Set(
    equipes.filter(e => sesEquipes.has(e.id) && e.chantier_id).map(e => e.chantier_id as string),
  )
  return chantiers.filter(c =>
    c.statut === STATUT_EN_COURS && ((c.membres_ids ?? []).includes(membre.id) || parEquipe.has(c.id)),
  )
}

export function chantierPourTelephone(chantier: ChantierBtp): ChantierDuTelephone {
  const positionValide = coordonneesValides(chantier.latitude, chantier.longitude)
  return {
    id: chantier.id,
    titre: chantier.titre || '',
    adresse: [chantier.adresse, [chantier.code_postal, chantier.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    latitude: positionValide ? (chantier.latitude as number) : null,
    longitude: positionValide ? (chantier.longitude as number) : null,
    rayonM: rayonEffectifM(chantier.geo_rayon_m),
  }
}

/** Chantier utilisable par la détection automatique (position valable), ou null. */
export function chantierPointable(chantier: ChantierDuTelephone): ChantierPointable | null {
  if (chantier.latitude === null || chantier.longitude === null) return null
  return { id: chantier.id, titre: chantier.titre, latitude: chantier.latitude, longitude: chantier.longitude, rayonM: chantier.rayonM }
}

/** Fuseau de la liste annoncé par le téléphone, sinon FUSEAU_PAR_DEFAUT. */
export function fuseauValide(fuseau: unknown): string {
  return typeof fuseau === 'string' && FUSEAUX_AUTORISES.includes(fuseau) ? fuseau : FUSEAU_PAR_DEFAUT
}

/**
 * Instant d'une arrivée : celui du serveur. En mode automatique seulement, celui de l'entrée dans la zone annoncé par
 * le téléphone, s'il est dans le passé et à moins de TOLERANCE_HORLOGE_MS (envoi retardé de la confirmation, réseau).
 */
export function instantArrivee(mode: string, observeA: unknown, maintenant: number): number {
  if (mode !== 'geo_auto' || typeof observeA !== 'number' || !Number.isFinite(observeA)) return maintenant
  return observeA <= maintenant && maintenant - observeA <= TOLERANCE_HORLOGE_MS ? Math.round(observeA) : maintenant
}

/**
 * Instant d'un départ : celui du serveur. En mode automatique seulement, la dernière présence connue sur le chantier
 * annoncée par le téléphone (départ daté avant une mise en veille), bornée entre l'arrivée et maintenant : avancer un
 * départ ne peut que retirer des heures, jamais en ajouter.
 */
export function instantDepart(mode: string, observeA: unknown, maintenant: number, arrivee: number): number {
  if (mode !== 'geo_auto' || typeof observeA !== 'number' || !Number.isFinite(observeA)) return maintenant
  return Math.min(maintenant, Math.max(arrivee, Math.round(observeA)))
}

/** Date (AAAA-MM-JJ) et heure (HH:MM:SS) de l'instant dans le fuseau donné. */
export function heureLocale(instant: number, fuseau: string): { date: string; heure: string } {
  const parties = new Intl.DateTimeFormat('en-GB', {
    timeZone: fuseau,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant))
  const valeur = (type: string) => parties.find(p => p.type === type)?.value ?? '00'
  return {
    date: `${valeur('year')}-${valeur('month')}-${valeur('day')}`,
    heure: `${valeur('hour')}:${valeur('minute')}:${valeur('second')}`,
  }
}

const deux = (n: number) => String(n).padStart(2, '0')

/** Date et heure murales d'un instant décalé d'un écart fixe (celui de l'arrivée du pointage). */
export function murale(instant: number, decalageMs: number): { date: string; heure: string } {
  const d = new Date(instant + decalageMs)
  return {
    date: `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}`,
    heure: `${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())}:${deux(d.getUTCSeconds())}`,
  }
}

/** Pointage tel que lu en base, réduit à ce que la clôture lit. */
export interface PointageOuvert {
  date?: unknown
  heure_arrivee?: unknown
  created_at?: unknown
  pause_minutes?: unknown
}

const ECART_MAX_FUSEAU_MS = 14 * 3_600_000

/**
 * Instant (UTC) de l'arrivée et écart entre l'heure murale et UTC à ce moment. Les pointages ouverts par
 * /api/btp/pointage ont `created_at` = instant de l'arrivée ; à défaut (ligne d'une autre origine, horodatage
 * incohérent), l'heure murale est lue dans le fuseau de la France métropolitaine.
 */
export function reperesArrivee(ligne: PointageOuvert): { instant: number; decalageMs: number } {
  const morceaux = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ligne.date))
  const heure = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(ligne.heure_arrivee))
  const mural = morceaux && heure
    ? Date.UTC(Number(morceaux[1]), Number(morceaux[2]) - 1, Number(morceaux[3]), Number(heure[1]), Number(heure[2]), Number(heure[3] ?? '0'))
    : Number.NaN
  const cree = typeof ligne.created_at === 'string' ? Date.parse(ligne.created_at) : Number.NaN
  if (Number.isFinite(mural) && Number.isFinite(cree)) {
    const decalageMs = Math.round((mural - cree) / 60_000) * 60_000
    if (Math.abs(decalageMs) <= ECART_MAX_FUSEAU_MS) return { instant: cree, decalageMs }
  }
  if (!Number.isFinite(mural)) return { instant: Number.isFinite(cree) ? cree : 0, decalageMs: 0 }
  // Écart de Paris à cet instant (deux passes : l'écart dépend de l'instant, heure d'été comprise).
  const ecartParis = (instant: number) => {
    const { date, heure } = heureLocale(instant, FUSEAU_PAR_DEFAUT)
    const [a, mo, j] = date.split('-').map(Number)
    const [h, mi, s] = heure.split(':').map(Number)
    return Date.UTC(a, mo - 1, j, h, mi, s) - instant
  }
  const premier = mural - ecartParis(mural)
  const decalageMs = ecartParis(premier)
  return { instant: mural - decalageMs, decalageMs }
}

/** Pointage resté ouvert un jour précédent (date murale de l'arrivée) : départ oublié. */
export function estOublie(ligne: PointageOuvert, maintenant: number): boolean {
  const { decalageMs } = reperesArrivee(ligne)
  return murale(maintenant, decalageMs).date > String(ligne.date)
}

/**
 * Clôture d'un pointage au départ `depart` (instant UTC) : heure de départ murale (même écart qu'à l'arrivée) et heures
 * travaillées calculées sur les instants, pause déduite. Un départ constaté un autre jour que l'arrivée (oubli, nuit)
 * n'est pas compté : départ = arrivée, 0 h, à régulariser par le gérant — plutôt qu'une journée de 16 h.
 */
export function cloture(
  ligne: PointageOuvert,
  depart: number,
): { heureDepart: string; heuresTravaillees: number; aRegulariser: boolean } {
  const { instant: arrivee, decalageMs } = reperesArrivee(ligne)
  const murDepart = murale(depart, decalageMs)
  if (murDepart.date > String(ligne.date)) {
    return { heureDepart: String(ligne.heure_arrivee), heuresTravaillees: 0, aRegulariser: true }
  }
  const pause = Number(ligne.pause_minutes)
  const secondes = Math.max(0, (depart - arrivee) / 1000 - (Number.isFinite(pause) && pause > 0 ? pause * 60 : 0))
  const heureDepart = depart <= arrivee ? String(ligne.heure_arrivee) : murDepart.heure
  return { heureDepart, heuresTravaillees: Math.round((secondes / 3600) * 100) / 100, aRegulariser: false }
}

/** Ajoute une note à celles d'un pointage (sans la répéter). */
export function ajouterNote(notes: unknown, note: string): string {
  const existantes = typeof notes === 'string' ? notes.trim() : ''
  if (existantes.includes(note)) return existantes
  return existantes ? `${existantes} ${note}` : note
}

// ── Export CSV (comme l'export de l'écran Pointage du Syndic) ───────────────────────────────────────────────────

export interface LignePointage {
  date: string
  employe: string
  chantier: string
  heureArrivee: string
  heureDepart: string
  heuresTravaillees: number
  mode: string
}

/** Libellé de la méthode de pointage. */
export function libelleMode(mode: unknown, isPt: boolean): string {
  if (mode === 'geo_auto') return isPt ? 'Automática (GPS)' : 'Automatique (GPS)'
  if (mode === 'geo_confirme') return isPt ? 'No local (GPS)' : 'Sur site (GPS)'
  return isPt ? 'Manual' : 'Manuel'
}

/** Cellule CSV : entre guillemets, guillemets doublés, formule neutralisée (=, +, -, @ en tête). */
export function celluleCsv(valeur: unknown): string {
  let texte = valeur === null || valeur === undefined ? '' : String(valeur)
  if (/^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`
  return `"${texte.replace(/"/g, '""')}"`
}

/** CSV séparé par des points-virgules (ouverture directe dans un tableur réglé en français ou en portugais). */
export function pointagesEnCsv(lignes: readonly LignePointage[], isPt: boolean): string {
  const entete = isPt
    ? ['Data', 'Colaborador', 'Obra', 'Chegada', 'Saída', 'Horas', 'Método']
    : ['Date', 'Employé', 'Chantier', 'Arrivée', 'Départ', 'Heures', 'Méthode']
  const corps = lignes.map(l => [
    l.date,
    l.employe,
    l.chantier,
    l.heureArrivee.slice(0, 5),
    l.heureDepart ? l.heureDepart.slice(0, 5) : (isPt ? 'Em curso' : 'En cours'),
    l.heuresTravaillees.toFixed(2).replace('.', ','),
    libelleMode(l.mode, isPt),
  ].map(celluleCsv).join(';'))
  return [entete.map(celluleCsv).join(';'), ...corps].join('\r\n')
}
