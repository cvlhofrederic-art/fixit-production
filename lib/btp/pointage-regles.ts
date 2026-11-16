// Règles du pointage BTP, pures (sans base ni réseau) : quelle fiche employé correspond au compte connecté, quels
// chantiers lui sont affectés, heure locale du pointage, clôture d'un pointage et export CSV.
// Cadre légal (recherche du 16/11/2026, sources officielles) : en France, la géolocalisation ne contrôle le temps de
// travail que faute d'autre moyen (CE 15/12/2017 n° 403776) et doit rester désactivable par le salarié (CNIL) ; au
// Portugal, la CNPD tient la géolocalisation des téléphones pour une surveillance à distance (art. 20 du Código do
// Trabalho, délibération 7680/2014). D'où : pointage automatique désactivé tant que le gérant ne l'a pas activé,
// activé par l'employé lui-même, pointage à la main de même valeur, et ni position ni distance enregistrées.
// Utilisées par app/api/btp/pointage/route.ts et l'écran Pointage ; tests : tests/lib/btp-pointage-regles.test.ts.

import { coordonneesValides, rayonEffectifM, type ChantierPointable } from './pointage-geo'

/** Fuseau retenu quand le téléphone n'en annonce pas de valable. */
export const FUSEAU_PAR_DEFAUT = 'Europe/Paris'
/** Écart toléré entre l'horloge du téléphone et celle du serveur (envoi retardé faute de réseau sur le chantier). */
export const TOLERANCE_HORLOGE_MS = 10 * 60_000
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
  pointageEnCours: PointageEcran | null
  historique: PointageEcran[]
  /** Pointage automatique activé par le gérant pour la société (settings_btp.geo_pointage_enabled, faux par défaut). */
  pointageAutoActive: boolean
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

/** Fuseau IANA annoncé par le téléphone s'il est reconnu, sinon FUSEAU_PAR_DEFAUT. */
export function fuseauValide(fuseau: unknown): string {
  if (typeof fuseau !== 'string' || fuseau.length === 0 || fuseau.length > 64) return FUSEAU_PAR_DEFAUT
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau })
    return fuseau
  } catch {
    // Fuseau inconnu de l'environnement : on retombe sur celui de la France métropolitaine.
    return FUSEAU_PAR_DEFAUT
  }
}

/**
 * Instant retenu pour un pointage : celui que le téléphone a observé s'il est à moins de TOLERANCE_HORLOGE_MS de
 * l'horloge du serveur (envoi retardé par le réseau), sinon celui du serveur (horloge du téléphone fausse ou modifiée).
 */
export function instantRetenu(observeA: unknown, maintenant: number): number {
  if (typeof observeA !== 'number' || !Number.isFinite(observeA)) return maintenant
  return Math.abs(maintenant - observeA) <= TOLERANCE_HORLOGE_MS ? Math.round(observeA) : maintenant
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

/** Secondes écoulées depuis minuit pour « HH:MM » ou « HH:MM:SS », null si l'heure est illisible. */
export function secondesDepuisMinuit(heure: unknown): number | null {
  if (typeof heure !== 'string') return null
  const morceaux = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(heure)
  if (!morceaux) return null
  const [h, m, s] = [Number(morceaux[1]), Number(morceaux[2]), Number(morceaux[3] ?? '0')]
  if (h > 23 || m > 59 || s > 59) return null
  return h * 3600 + m * 60 + s
}

const DERNIERE_SECONDE = '23:59:59'

/**
 * Clôture d'un pointage ouvert le jour `arrivee.date` : heure de départ et heures travaillées (pause déduite).
 * Un départ constaté un autre jour (pointage oublié la veille) est ramené à 23:59:59 du jour d'arrivée et signalé.
 */
export function cloturer(
  arrivee: { date: string; heure: string },
  depart: { date: string; heure: string },
  pauseMinutes: number,
): { heureDepart: string; heuresTravaillees: number; clotureForcee: boolean } {
  const debut = secondesDepuisMinuit(arrivee.heure) ?? 0
  let heureDepart = depart.heure
  let fin = secondesDepuisMinuit(depart.heure) ?? debut
  let clotureForcee = false
  if (depart.date > arrivee.date) {
    heureDepart = DERNIERE_SECONDE
    fin = 86_399
    clotureForcee = true
  } else if (depart.date < arrivee.date || fin < debut) {
    heureDepart = arrivee.heure
    fin = debut
  }
  const pause = Number.isFinite(pauseMinutes) && pauseMinutes > 0 ? pauseMinutes * 60 : 0
  const secondes = Math.max(0, fin - debut - pause)
  return { heureDepart, heuresTravaillees: Math.round((secondes / 3600) * 100) / 100, clotureForcee }
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
