/**
 * Rentabilité d'une obra, telle que l'écran Chantiers (Obras) l'affiche sous la liste — HORS IVA de bout en bout.
 *
 * Demande de Frédéric du 28/11/2026 : « LE calcul de rentabilité on doit pouvoir indiquer combien on a dépensé en
 * matériaux et le IVA doit pas être pris en compte dans le résultat car il fait pas partie des lucros », puis « Fait au
 * mieux méthode pro » sur les trois questions laissées ouvertes (pointages réels, autres dépenses, jours fériés).
 *
 * Résultat = valeur de l'obra − matériaux − autres dépenses de l'obra − main-d'œuvre, tout hors IVA :
 *   - VALEUR : « Valor s/ IVA » (colonne budget) ;
 *   - MATÉRIAUX : achats saisis pour l'obra (dépenses « materiaux », enregistrées hors IVA) ; sans aucun achat saisi,
 *     estimation de 15 % de la valeur, dite comme telle (`materiauxEstimes`) ;
 *   - AUTRES DÉPENSES : location de matériel, carburant, transport, autres (sous-traitance, déchets…) saisies pour
 *     l'obra, hors IVA ;
 *   - MAIN-D'ŒUVRE, jour par jour : un jour passé où quelqu'un a pointé sur l'obra compte le POINTAGE RÉEL (heures
 *     pointées × coût horaire chargé de chacun ; un pointage sans heures, une journée) ; sinon l'équipe prévue de ce jour
 *     (lib/btp/equipe-par-jour.ts) × le coût journalier de chacun. L'équipe habituelle ne travaille ni le week-end ni
 *     les jours fériés nationaux (lib/btp/jours-feries.ts), sauf jour retouché.
 * L'IVA payée au fournisseur se récupère et l'IVA facturée au client se reverse : ni l'une ni l'autre n'est un coût ou
 * un bénéfice.
 *
 * Module pur : aucune requête, aucune date lue en cachette (« aujourd'hui » est un paramètre).
 */

import {
  equipeDuJour, estJourOuvre, jourRetouche, jourSuivant, joursEntre, jourValide, periodeTronquee,
  type EquipeParJour, type JourOuvre,
} from '@/lib/btp/equipe-par-jour'

/** Part du budget comptée en matériaux tant qu'aucun achat n'est saisi (valeur de l'ancien calcul). */
export const TAUX_MATERIAUX_ESTIME_PCT = 15

/** Catégories de dépense comptées comme matériaux (les mêmes que l'écran Rentabilité). */
export const CATEGORIES_MATERIAUX = ['materiaux', 'materiel'] as const

/** Catégorie posée sur un achat de matériaux saisi depuis la fiche de l'obra. */
export const CATEGORIE_MATERIAUX = 'materiaux'

/**
 * Catégories proposées dans la fiche de l'obra : les matériaux, puis les autres dépenses directes. Toutes connues de
 * l'écran Rentabilité (EXPENSE_CATEGORIES_MATERIAUX / _AUTRES de components/dashboard/RentabiliteChantierSection.tsx).
 */
export const CATEGORIES_DEPENSE_OBRA = ['materiaux', 'location', 'carburant', 'transport', 'autre'] as const

/** Heures d'une journée de travail quand le coût horaire d'un employé n'est pas connu (35 h sur 5 jours). */
const HEURES_JOUR_PAR_DEFAUT = 7

const arrondi2 = (n: number) => Math.round(n * 100) / 100

/**
 * Montant hors IVA d'un montant payé IVA comprise : 123 € à 23 % → 100 €. Taux nul ou invalide : le montant tel quel.
 * Arrondi au centime.
 */
export function montantHorsIva(montant: number, tauxIvaPct: number): number {
  if (!Number.isFinite(montant)) return 0
  const taux = Number.isFinite(tauxIvaPct) && tauxIvaPct > 0 ? tauxIvaPct : 0
  return arrondi2(montant / (1 + taux / 100))
}

/** Une dépense telle que la route la renvoie (colonnes de depenses_btp), ou telle que le hook la met en forme. */
export interface DepenseObra {
  id?: string
  chantier_id?: string | null
  chantierId?: string | null
  category?: string | null
  amount?: number | string | null
  label?: string | null
  date?: string | null
  notes?: string | null
}

/** Montant d'une dépense, en nombre (la base peut le rendre en texte). */
export function montantDepense(d: DepenseObra): number {
  const n = typeof d.amount === 'string' ? Number.parseFloat(d.amount) : d.amount
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

/** Dépense comptée comme matériaux. */
export const estMateriau = (d: DepenseObra) => (CATEGORIES_MATERIAUX as readonly string[]).includes(d.category ?? '')
const deLObra = (d: DepenseObra, chantierId: string) => (d.chantier_id || d.chantierId) === chantierId

/** Dépenses rattachées à l'obra (toutes catégories), les plus récentes d'abord. */
export function depensesDeLObra(depenses: readonly DepenseObra[], chantierId: string): DepenseObra[] {
  return depenses.filter(d => deLObra(d, chantierId)).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

/** Achats de matériaux rattachés à l'obra, les plus récents d'abord. */
export function achatsMateriaux(depenses: readonly DepenseObra[], chantierId: string): DepenseObra[] {
  return depensesDeLObra(depenses, chantierId).filter(estMateriau)
}

/** Total hors IVA des achats de matériaux de l'obra ; null s'il n'y en a aucun (le calcul estimera alors). */
export function totalMateriauxHT(depenses: readonly DepenseObra[], chantierId: string): number | null {
  const achats = achatsMateriaux(depenses, chantierId)
  return achats.length === 0 ? null : arrondi2(achats.reduce((s, d) => s + montantDepense(d), 0))
}

/** Total hors IVA des autres dépenses de l'obra (location, carburant, transport, autres). */
export function totalAutresDepensesHT(depenses: readonly DepenseObra[], chantierId: string): number {
  return arrondi2(depensesDeLObra(depenses, chantierId).filter(d => !estMateriau(d)).reduce((s, d) => s + montantDepense(d), 0))
}

/** Un pointage, réduit à ce qui compte pour le coût. */
export interface PointageObra {
  /** Obra du pointage. */
  chantierId: string
  /** Fiche de l'employé (membres_btp) ; vide pour un ancien pointage saisi au nom seul. */
  membreId: string
  /** Nom porté par le pointage (sert de repère quand la fiche manque). */
  employe?: string
  date: string
  /** Heures travaillées ; null : pointage sans heures (départ non enregistré). 0 : clos sans heures (doublon, oubli). */
  heures: number | null
}

/** Pointages de la société, depuis les lignes de pointages_btp (brutes ou mises en forme par le hook). */
export function lirePointages(lignes: readonly Record<string, unknown>[]): PointageObra[] {
  return lignes
    .filter(l => typeof l.date === 'string')
    .map(l => {
      const brut = l.heures_travaillees
      const heures = typeof brut === 'number' ? brut : Number.parseFloat(String(brut))
      return {
        chantierId: String(l.chantier_id ?? l.chantierId ?? ''),
        membreId: String(l.membre_id ?? l.membreId ?? ''),
        employe: typeof l.employe === 'string' ? l.employe : undefined,
        date: l.date as string,
        heures: Number.isFinite(heures) ? heures : null,
      }
    })
}

/** Pointages d'une obra (lirePointages, filtrés sur l'obra). */
export function pointagesDeLObra(lignes: readonly Record<string, unknown>[], chantierId: string): PointageObra[] {
  return lirePointages(lignes).filter(p => p.chantierId === chantierId)
}

/** Clé d'un employé pointé : sa fiche, ou à défaut son nom (sans la casse). */
export const clePointee = (p: Pick<PointageObra, 'membreId' | 'employe'>) =>
  (p.membreId ? p.membreId.toLowerCase() : `nom:${(p.employe ?? '').trim().toLowerCase()}`)

/** Nom à afficher pour une clé « nom:… » : le nom tel que le pointage l'écrit. */
export function nomsDesPointes(pointages: readonly PointageObra[]): Map<string, string> {
  return new Map(pointages.filter(p => !p.membreId).map(p => [clePointee(p), (p.employe ?? '').trim()]))
}

/** Pour chaque jour, pour chaque employé : heures pointées cumulées, ou null si aucune heure positive n'est connue. */
export type PointesParJour = ReadonlyMap<string, ReadonlyMap<string, number | null>>

/**
 * Pointages par jour puis par employé, pour les jours PASSÉS (avant `aujourdhui`) et, si la liste est coupée par le
 * plafond de lecture, seulement après `depuis` : le jour le plus ancien d'une liste coupée peut être incomplet, et les
 * jours plus anciens n'y sont pas du tout ; ils retombent sur l'équipe prévue.
 */
export function pointagesParJour(pointages: readonly PointageObra[], aujourdhui: string, depuis?: string | null): PointesParJour {
  const parJour = new Map<string, Map<string, number | null>>()
  for (const p of pointages) {
    if (!jourValide(p.date) || !(p.date < aujourdhui) || (depuis && p.date <= depuis)) continue
    const jour = parJour.get(p.date) ?? new Map<string, number | null>()
    const cle = clePointee(p)
    const deja = jour.has(cle) ? (jour.get(cle) as number | null) : null
    const heures = p.heures !== null && p.heures > 0 ? p.heures : null
    jour.set(cle, heures === null ? deja : (deja ?? 0) + heures)
    parJour.set(p.date, jour)
  }
  return parJour
}

/** Jour le plus ancien d'une liste de pointages coupée par le plafond (ses jours ne sont fiables qu'APRÈS lui). */
export function debutPointagesFiables(pointages: readonly PointageObra[], coupee: boolean): string | null {
  if (!coupee || pointages.length === 0) return null
  return pointages.reduce((min, p) => (p.date < min ? p.date : min), pointages[0].date)
}

/** Composition d'un jour pointé : les pointés (à leurs heures) et les prévus qui n'ont pointé nulle part ce jour-là. */
export interface CompositionJour {
  pointes: Array<{ id: string; heures: number | null }>
  prevus: string[]
}

/**
 * Qui compte un jour où quelqu'un a pointé sur l'obra (relecture adverse du 28/11/2026 : un seul pointé ne doit pas
 * effacer ses collègues sans l'appli) :
 *   - chaque employé pointé ici, à ses heures ; sans heures positives ici, une journée, sauf s'il a des heures ailleurs
 *     ce jour-là (pointage fermé sans heures en doublon) ;
 *   - chaque employé PRÉVU ce jour-là (équipe du jour) qui n'a pointé NULLE PART ce jour-là, une journée.
 * `ici` : pointages de l'obra ce jour-là ; `societe` : ceux de toute la société ce jour-là (à défaut, `ici`).
 */
export function compositionDuJour(
  prevus: readonly string[],
  ici: ReadonlyMap<string, number | null>,
  societe?: ReadonlyMap<string, number | null>,
): CompositionJour {
  const partout = societe ?? ici
  const pointes: CompositionJour['pointes'] = []
  for (const [id, heures] of ici) {
    if (heures === null && (partout.get(id) ?? null) !== null) continue
    pointes.push({ id, heures })
  }
  return { pointes, prevus: prevus.filter(id => !partout.has(id) && !ici.has(id)) }
}

export interface EntreeRentabiliteObra {
  /** Valeur de l'obra hors IVA (« Valor s/ IVA », colonne budget). */
  valeurHT: number
  dateDebut: string
  dateFin: string
  statut: string
  /** Équipe habituelle (membres_ids). */
  membresIds: readonly string[]
  equipeParJour: EquipeParJour
  /** Coût journalier de chaque employé, actifs ou non (un ancien employé a coûté les jours où il était là). */
  coutJourParMembre: ReadonlyMap<string, number>
  /** Coût horaire chargé de chaque employé (pour les heures pointées) ; à défaut, coût journalier ÷ 7. */
  coutHeureParMembre?: ReadonlyMap<string, number>
  /**
   * Indemnités d'une journée de chaque employé (panier, trajet) : le coût horaire du moteur de paie ne les contient pas
   * (lib/payroll/engine.ts), elles s'ajoutent une fois par jour pointé à ses heures.
   */
  indemniteJourParMembre?: ReadonlyMap<string, number>
  /** Coût d'une journée d'ouvrier quand celui d'un employé est inconnu, et pour l'estimation sans équipe. */
  coutJourParDefaut: number
  /** Ancienne fiche sans aucun employé désigné : nombre d'ouvriers saisi (colonne equipe), 1 à défaut. */
  nbEmployesSansEquipe: number
  /** Total des achats de matériaux hors IVA ; null : aucun achat saisi. */
  materiauxHT: number | null
  /** Total des autres dépenses de l'obra hors IVA (0 par défaut). */
  autresDepensesHT?: number
  /** Pointages de l'obra par jour (pointagesParJour) : ils font foi pour les jours passés où il y en a. */
  pointesIci?: PointesParJour
  /** Pointages de toute la société par jour : un prévu qui a pointé ailleurs ce jour-là n'est pas compté ici. */
  pointesSociete?: PointesParJour
  /** Jours travaillés par l'équipe habituelle (week-end et fériés exclus) ; du lundi au vendredi par défaut. */
  ouvre?: JourOuvre
  /**
   * Employés actifs (fiches Équipes). Donné, l'équipe habituelle ne compte plus un employé désactivé ou supprimé à
   * partir d'aujourd'hui : il est parti, il ne coûtera plus rien. Les jours passés le gardent (il était là), comme
   * tout jour où il est inscrit nommément. Absent (fiches pas encore chargées, ou rôle sans accès aux Équipes) : aucun
   * filtre (relecture adverse du 28/11/2026 ; l'ancien calcul ne comptait que les actifs, pour tous les jours).
   */
  actifs?: ReadonlySet<string>
  /** « AAAA-MM-JJ » du jour (dans le fuseau du navigateur ; fourni par l'appelant). */
  aujourdhui: string
}

export interface JourObra {
  jour: string
  /** Employés comptés ce jour-là (identifiants ; « nom:… » pour un pointage sans fiche). */
  membres: string[]
  cout: number
  retouche: boolean
  /** Jour après la date de fin prévue (retard). */
  enRetard: boolean
  /** « pointage » : jour passé compté sur les pointages réels (et les prévus sans pointage) ; « prevu » : équipe prévue. */
  source: 'pointage' | 'prevu'
  /** Jour pointé : qui a pointé et ses heures, et les prévus comptés faute de pointage. */
  composition?: CompositionJour
}

export interface ResultatRentabiliteObra {
  valeurHT: number
  /** Jours de calendrier de la date de début à la date de fin, inclus. */
  joursCalendrier: number
  /** Jours prévus où au moins un employé travaille. */
  joursTravailles: number
  /** Parmi eux, jours comptés sur les pointages réels. */
  joursPointes: number
  /** Coût d'une journée de l'équipe habituelle à partir d'aujourd'hui (ou de l'estimation sans équipe). */
  coutJourEquipe: number
  coutMOPrevu: number
  materiauxHT: number
  materiauxEstimes: boolean
  autresDepensesHT: number
  /** Aucun employé désigné ni retouche : main-d'œuvre estimée les jours non pointés (ancien calcul, jours ouvrés). */
  equipeEstimee: boolean
  /** Au moins un employé compté sans coût connu (fiche absente ou illisible) : coût d'un ouvrier par défaut. */
  coutsParDefaut: boolean
  coutTotalPrevu: number
  beneficePrevu: number
  margePrevuePct: number
  enRetard: boolean
  /** Jours de calendrier écoulés après la date de fin (chantier en cours seulement). */
  joursRetard: number
  coutRetard: number
  beneficeActuel: number
  status: 'profit' | 'warning' | 'loss'
  finDepassee: boolean
  /** Jours de l'obra, du début à la fin prévue puis jusqu'à aujourd'hui en cas de retard. */
  jours: JourObra[]
  /** La période dépasse JOURS_MAX_PAR_CHANTIER : seuls les premiers jours sont comptés. */
  tronque: boolean
}

function statut(beneficeActuel: number, margePrevuePct: number): ResultatRentabiliteObra['status'] {
  if (beneficeActuel <= 0) return 'loss'
  return margePrevuePct >= 25 ? 'profit' : 'warning'
}

/** Coûts d'un employé : journée, heure chargée, indemnités ; et s'il est connu. */
function coutsDe(e: EntreeRentabiliteObra) {
  const jour = (id: string) => e.coutJourParMembre.get(id) ?? e.coutJourParDefaut
  const indemnite = (id: string) => e.indemniteJourParMembre?.get(id) ?? 0
  const heure = (id: string) => e.coutHeureParMembre?.get(id) ?? (jour(id) - indemnite(id)) / HEURES_JOUR_PAR_DEFAUT
  return { jour, heure, indemnite, connu: (id: string) => e.coutJourParMembre.has(id) }
}

/** Coût d'un jour pointé : chaque pointé à ses heures (plus ses indemnités du jour), chaque prévu sans pointage une journée. */
function coutJourPointe(c: CompositionJour, couts: ReturnType<typeof coutsDe>): number {
  const pointes = c.pointes.reduce((s, p) => s + (p.heures === null ? couts.jour(p.id) : p.heures * couts.heure(p.id) + couts.indemnite(p.id)), 0)
  return pointes + c.prevus.reduce((s, id) => s + couts.jour(id), 0)
}

/** Rentabilité de l'obra, hors IVA ; null sans valeur ou sans dates valides (comme l'ancien calcul). */
export function rentabiliteObra(e: EntreeRentabiliteObra): ResultatRentabiliteObra | null {
  const valeurHT = Number.isFinite(e.valeurHT) ? e.valeurHT : 0
  if (valeurHT <= 0 || !jourValide(e.dateDebut) || !jourValide(e.dateFin) || e.dateFin < e.dateDebut) return null

  const ouvre = e.ouvre ?? estJourOuvre
  const membresIds = e.membresIds.map(id => id.toLowerCase())
  // Estimation (ancienne fiche sans aucun employé désigné) : elle vaut pour les jours NON pointés ; un pointage ne
  // l'efface pas (relecture adverse du 28/11/2026 : un seul pointage ramenait la main-d'œuvre presque à zéro).
  const equipeEstimee = membresIds.length === 0 && Object.values(e.equipeParJour).every(m => m.length === 0)
  const estimation = Array.from({ length: Math.max(1, Math.floor(e.nbEmployesSansEquipe) || 1) }, (_, i) => `estimation-${i}`)
  const membresHabituels = equipeEstimee ? estimation : membresIds
  // Équipe habituelle d'aujourd'hui et des jours à venir : sans les employés partis (désactivés ou supprimés).
  const habituelsAVenir = equipeEstimee || !e.actifs ? membresHabituels : membresHabituels.filter(id => e.actifs?.has(id))
  const equipeParJour = equipeEstimee ? {} : e.equipeParJour
  const couts = coutsDe(e)
  let coutsParDefaut = false
  const signalerInconnus = (ids: readonly string[]) => {
    if (ids.some(id => !id.startsWith('estimation-') && !couts.connu(id))) coutsParDefaut = true
  }

  const enCours = e.statut === 'En cours'
  const finDepassee = enCours && jourValide(e.aujourdhui) && e.aujourdhui > e.dateFin
  const fin = finDepassee ? e.aujourdhui : e.dateFin

  // Seuls les jours de la période de l'obra : un pointage hors période ne compte pas.
  const jours: JourObra[] = joursEntre(e.dateDebut, fin).map(jour => {
    const enRetard = jour > e.dateFin
    const habituels = jourValide(e.aujourdhui) && jour >= e.aujourdhui ? habituelsAVenir : membresHabituels
    const prevus = equipeDuJour(jour, habituels, equipeParJour, ouvre)
    const retouche = !equipeEstimee && jourRetouche(jour, habituels, equipeParJour, ouvre)
    const ici = e.pointesIci?.get(jour)
    if (ici && ici.size > 0) {
      const composition = compositionDuJour(equipeEstimee ? [] : prevus, ici, e.pointesSociete?.get(jour))
      const membres = [...composition.pointes.map(p => p.id), ...composition.prevus]
      signalerInconnus(membres)
      return { jour, membres, cout: arrondi2(coutJourPointe(composition, couts)), retouche, enRetard, source: 'pointage', composition }
    }
    if (!equipeEstimee) signalerInconnus(prevus)
    return {
      jour,
      membres: equipeEstimee ? [] : prevus,
      cout: arrondi2(prevus.reduce((s, id) => s + couts.jour(id), 0)),
      retouche,
      enRetard,
      source: 'prevu',
    }
  })

  const prevusJours = jours.filter(j => !j.enRetard)
  const retard = jours.filter(j => j.enRetard)
  const coutMOPrevu = prevusJours.reduce((s, j) => s + j.cout, 0)
  const coutRetard = retard.reduce((s, j) => s + j.cout, 0)
  const materiauxEstimes = e.materiauxHT === null
  const materiauxHT = materiauxEstimes ? valeurHT * TAUX_MATERIAUX_ESTIME_PCT / 100 : (e.materiauxHT as number)
  const autresDepensesHT = Number.isFinite(e.autresDepensesHT) ? (e.autresDepensesHT as number) : 0
  const coutTotalPrevu = coutMOPrevu + materiauxHT + autresDepensesHT
  const beneficePrevu = valeurHT - coutTotalPrevu
  const margePrevuePct = (beneficePrevu / valeurHT) * 100
  const beneficeActuel = beneficePrevu - coutRetard

  // Nombre de jours de retard : de la date de fin (exclue) à aujourd'hui, sans plafond.
  const joursRetard = finDepassee
    ? Math.round((Date.parse(`${e.aujourdhui}T00:00:00Z`) - Date.parse(`${e.dateFin}T00:00:00Z`)) / 86_400_000)
    : 0

  return {
    valeurHT: Math.round(valeurHT),
    joursCalendrier: joursEntre(e.dateDebut, e.dateFin).length,
    joursTravailles: prevusJours.filter(j => (j.source === 'pointage' || !equipeEstimee ? j.membres.length > 0 : j.cout > 0)).length,
    joursPointes: prevusJours.filter(j => j.source === 'pointage').length,
    coutJourEquipe: Math.round(habituelsAVenir.reduce((s, id) => s + couts.jour(id), 0)),
    coutMOPrevu: Math.round(coutMOPrevu),
    materiauxHT: Math.round(materiauxHT),
    materiauxEstimes,
    autresDepensesHT: Math.round(autresDepensesHT),
    equipeEstimee,
    coutsParDefaut,
    coutTotalPrevu: Math.round(coutTotalPrevu),
    beneficePrevu: Math.round(beneficePrevu),
    margePrevuePct: Math.round(margePrevuePct * 10) / 10,
    enRetard: finDepassee,
    joursRetard,
    coutRetard: Math.round(coutRetard),
    beneficeActuel: Math.round(beneficeActuel),
    status: statut(beneficeActuel, margePrevuePct),
    finDepassee,
    jours,
    tronque: periodeTronquee(e.dateDebut, fin),
  }
}

/**
 * Date de fin repoussée de `jours` jours de calendrier (fenêtre « Prolonger » : « Non, estimer les jours
 * supplémentaires »). Fin déjà dépassée : les jours s'ajoutent à AUJOURD'HUI. Avant le 28/11/2026 ils s'ajoutaient à
 * l'ancienne date de fin : sur une obra en retard de 7 jours, « +2 jours » laissait une fin encore dans le passé.
 */
export function dateFinProlongee(dateFin: string, jours: number, aujourdhui: string): string {
  let fin = jourValide(aujourdhui) && aujourdhui > dateFin ? aujourdhui : dateFin
  for (let i = 0; i < Math.max(0, Math.floor(jours)); i++) fin = jourSuivant(fin)
  return fin
}
