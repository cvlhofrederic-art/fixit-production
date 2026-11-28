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

const estMateriau = (d: DepenseObra) => (CATEGORIES_MATERIAUX as readonly string[]).includes(d.category ?? '')
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

/** Un pointage sur l'obra, réduit à ce qui compte pour le coût. */
export interface PointageObra {
  /** Fiche de l'employé (membres_btp) ; vide pour un ancien pointage saisi au nom seul. */
  membreId: string
  /** Nom porté par le pointage (sert de repère quand la fiche manque). */
  employe?: string
  date: string
  /** Heures travaillées ; null : pointage sans heures (départ non enregistré). */
  heures: number | null
}

/** Pointages d'une obra, depuis les lignes de pointages_btp (brutes ou mises en forme par le hook). */
export function pointagesDeLObra(lignes: readonly Record<string, unknown>[], chantierId: string): PointageObra[] {
  return lignes
    .filter(l => (l.chantier_id ?? l.chantierId) === chantierId && typeof l.date === 'string')
    .map(l => {
      const brut = l.heures_travaillees
      const heures = typeof brut === 'number' ? brut : Number.parseFloat(String(brut))
      return {
        membreId: String(l.membre_id ?? l.membreId ?? ''),
        employe: typeof l.employe === 'string' ? l.employe : undefined,
        date: l.date as string,
        heures: Number.isFinite(heures) ? heures : null,
      }
    })
}

/** Clé d'un employé pointé : sa fiche, ou à défaut son nom. */
const clePointee = (p: PointageObra) => (p.membreId ? p.membreId.toLowerCase() : `nom:${(p.employe ?? '').trim().toLowerCase()}`)

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
  /** Coût d'une journée d'ouvrier quand celui d'un employé est inconnu, et pour l'estimation sans équipe. */
  coutJourParDefaut: number
  /** Ancienne fiche sans aucun employé désigné : nombre d'ouvriers saisi (colonne equipe), 1 à défaut. */
  nbEmployesSansEquipe: number
  /** Total des achats de matériaux hors IVA ; null : aucun achat saisi. */
  materiauxHT: number | null
  /** Total des autres dépenses de l'obra hors IVA (0 par défaut). */
  autresDepensesHT?: number
  /** Pointages de l'obra (pointagesDeLObra) : ils font foi pour les jours passés où il y en a. */
  pointages?: readonly PointageObra[]
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
  /** « pointage » : jour passé compté sur les pointages réels ; « prevu » : équipe prévue. */
  source: 'pointage' | 'prevu'
  /** Jour pointé : heures de chacun (null : pointage sans heures, compté une journée). */
  heures?: Record<string, number | null>
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
  /** Aucun employé désigné, retouche ni pointage : main-d'œuvre estimée (ancien calcul, jours ouvrés seulement). */
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

/** Pointages passés de l'obra, par jour puis par employé : heures cumulées (null si aucune heure n'est connue). */
export function pointagesParJour(pointages: readonly PointageObra[], aujourdhui: string): Map<string, Map<string, number | null>> {
  const parJour = new Map<string, Map<string, number | null>>()
  for (const p of pointages) {
    if (!jourValide(p.date) || !(p.date < aujourdhui)) continue
    const jour = parJour.get(p.date) ?? new Map<string, number | null>()
    const cle = clePointee(p)
    const deja = jour.get(cle) ?? null
    const heures = p.heures !== null && p.heures > 0 ? p.heures : null
    jour.set(cle, heures === null ? deja : (deja ?? 0) + heures)
    parJour.set(p.date, jour)
  }
  return parJour
}

/** Rentabilité de l'obra, hors IVA ; null sans valeur ou sans dates valides (comme l'ancien calcul). */
export function rentabiliteObra(e: EntreeRentabiliteObra): ResultatRentabiliteObra | null {
  const valeurHT = Number.isFinite(e.valeurHT) ? e.valeurHT : 0
  if (valeurHT <= 0 || !jourValide(e.dateDebut) || !jourValide(e.dateFin) || e.dateFin < e.dateDebut) return null

  const ouvre = e.ouvre ?? estJourOuvre
  const pointes = pointagesParJour(e.pointages ?? [], e.aujourdhui)
  const membresIds = e.membresIds.map(id => id.toLowerCase())
  const equipeEstimee = membresIds.length === 0 && pointes.size === 0
    && Object.values(e.equipeParJour).every(m => m.length === 0)
  // Sans aucun employé désigné : l'ancienne estimation (nombre d'ouvriers × coût par défaut), les jours travaillés.
  const estimation = Array.from({ length: Math.max(1, Math.floor(e.nbEmployesSansEquipe) || 1) }, (_, i) => `estimation-${i}`)
  const membresHabituels = equipeEstimee ? estimation : membresIds
  // Équipe habituelle d'aujourd'hui et des jours à venir : sans les employés partis (désactivés ou supprimés).
  const habituelsAVenir = equipeEstimee || !e.actifs ? membresHabituels : membresHabituels.filter(id => e.actifs?.has(id))
  const equipeParJour = equipeEstimee ? {} : e.equipeParJour

  const coutJour = (id: string) => e.coutJourParMembre.get(id) ?? e.coutJourParDefaut
  const coutHeure = (id: string) => e.coutHeureParMembre?.get(id) ?? coutJour(id) / HEURES_JOUR_PAR_DEFAUT
  let coutsParDefaut = false
  const connu = (id: string) => e.coutJourParMembre.has(id)

  const enCours = e.statut === 'En cours'
  const finDepassee = enCours && jourValide(e.aujourdhui) && e.aujourdhui > e.dateFin
  const fin = finDepassee ? e.aujourdhui : e.dateFin

  const jours: JourObra[] = joursEntre(e.dateDebut, fin).map(jour => {
    const enRetard = jour > e.dateFin
    const pointe = pointes.get(jour)
    if (pointe) {
      // Jour passé pointé : ce qui s'est réellement passé fait foi (heures × coût horaire ; sans heures, une journée).
      const heures = Object.fromEntries(pointe)
      const cout = [...pointe].reduce((s, [id, h]) => s + (h === null ? coutJour(id) : h * coutHeure(id)), 0)
      if ([...pointe.keys()].some(id => !connu(id))) coutsParDefaut = true
      return { jour, membres: [...pointe.keys()], cout: arrondi2(cout), retouche: false, enRetard, source: 'pointage', heures }
    }
    const habituels = jourValide(e.aujourdhui) && jour >= e.aujourdhui ? habituelsAVenir : membresHabituels
    const membres = equipeDuJour(jour, habituels, equipeParJour, ouvre)
    if (!equipeEstimee && membres.some(id => !connu(id))) coutsParDefaut = true
    return {
      jour,
      membres: equipeEstimee ? [] : membres,
      cout: arrondi2(membres.reduce((s, id) => s + coutJour(id), 0)),
      retouche: !equipeEstimee && jourRetouche(jour, habituels, equipeParJour, ouvre),
      enRetard,
      source: 'prevu',
    }
  })

  const prevus = jours.filter(j => !j.enRetard)
  const retard = jours.filter(j => j.enRetard)
  const coutMOPrevu = prevus.reduce((s, j) => s + j.cout, 0)
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
    joursTravailles: prevus.filter(j => (equipeEstimee ? j.cout > 0 : j.membres.length > 0)).length,
    joursPointes: prevus.filter(j => j.source === 'pointage').length,
    coutJourEquipe: Math.round(habituelsAVenir.reduce((s, id) => s + coutJour(id), 0)),
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
