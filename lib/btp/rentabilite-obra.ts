/**
 * Rentabilité d'une obra, telle que l'écran Chantiers (Obras) l'affiche sous la liste — HORS IVA de bout en bout.
 *
 * Demande de Frédéric du 28/11/2026 : « LE calcul de rentabilité on doit pouvoir indiquer combien on a dépensé en
 * matériaux et le IVA doit pas être pris en compte dans le résultat car il fait pas partie des lucros ».
 *
 * Ce qui a changé par rapport au calcul d'avant (getRenta de components/dashboard/ChantiersBTPV2.tsx) :
 *   - les MATÉRIAUX ne sont plus 15 % du budget d'office : ce sont les achats saisis pour l'obra (dépenses de catégorie
 *     « materiaux », montants enregistrés hors IVA). Sans aucun achat saisi, l'estimation de 15 % reste, mais elle est
 *     dite comme telle (`materiauxEstimes`) ;
 *   - la MAIN-D'ŒUVRE se compte jour par jour : l'équipe de chaque jour (lib/btp/equipe-par-jour.ts) multipliée par le
 *     coût journalier de chacun, au lieu de « équipe × nombre de jours de calendrier » (week-ends compris) ;
 *   - l'IVA n'entre nulle part : la valeur de l'obra est hors IVA (« Valor s/ IVA »), les matériaux sont ramenés hors
 *     IVA à la saisie (`montantHorsIva`). L'IVA payée au fournisseur se récupère et l'IVA facturée au client se
 *     reverse : ni l'une ni l'autre n'est un coût ou un bénéfice.
 *
 * Module pur : aucune requête, aucune date lue en cachette (« aujourd'hui » est un paramètre).
 */

import {
  equipeDuJour, jourRetouche, jourSuivant, joursEntre, jourValide, periodeTronquee, type EquipeParJour,
} from '@/lib/btp/equipe-par-jour'

/** Part du budget comptée en matériaux tant qu'aucun achat n'est saisi (valeur de l'ancien calcul). */
export const TAUX_MATERIAUX_ESTIME_PCT = 15

/** Catégories de dépense comptées comme matériaux (les mêmes que l'écran Rentabilité). */
export const CATEGORIES_MATERIAUX = ['materiaux', 'materiel'] as const

/** Catégorie posée sur un achat de matériaux saisi depuis la fiche de l'obra. */
export const CATEGORIE_MATERIAUX = 'materiaux'

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

/** Achats de matériaux rattachés à l'obra, les plus récents d'abord. */
export function achatsMateriaux(depenses: readonly DepenseObra[], chantierId: string): DepenseObra[] {
  return depenses
    .filter(d => (d.chantier_id || d.chantierId) === chantierId && (CATEGORIES_MATERIAUX as readonly string[]).includes(d.category ?? ''))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

/** Total hors IVA des achats de matériaux de l'obra ; null s'il n'y en a aucun (le calcul estimera alors). */
export function totalMateriauxHT(depenses: readonly DepenseObra[], chantierId: string): number | null {
  const achats = achatsMateriaux(depenses, chantierId)
  return achats.length === 0 ? null : arrondi2(achats.reduce((s, d) => s + montantDepense(d), 0))
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
  /** Coût d'une journée d'ouvrier quand celui d'un employé est inconnu, et pour l'estimation sans équipe. */
  coutJourParDefaut: number
  /** Ancienne fiche sans aucun employé désigné : nombre d'ouvriers saisi (colonne equipe), 1 à défaut. */
  nbEmployesSansEquipe: number
  /** Total des achats de matériaux hors IVA ; null : aucun achat saisi. */
  materiauxHT: number | null
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
  membres: string[]
  cout: number
  retouche: boolean
  /** Jour après la date de fin prévue (retard). */
  enRetard: boolean
}

export interface ResultatRentabiliteObra {
  valeurHT: number
  /** Jours de calendrier de la date de début à la date de fin, inclus. */
  joursCalendrier: number
  /** Jours prévus où au moins un employé travaille. */
  joursTravailles: number
  /** Coût d'une journée de l'équipe habituelle à partir d'aujourd'hui (ou de l'estimation sans équipe). */
  coutJourEquipe: number
  coutMOPrevu: number
  materiauxHT: number
  materiauxEstimes: boolean
  /** Aucun employé désigné ni retouche : main-d'œuvre estimée (ancien calcul, jours ouvrés seulement). */
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

function coutDesMembres(membres: readonly string[], e: EntreeRentabiliteObra): number {
  return membres.reduce((s, id) => s + (e.coutJourParMembre.get(id) ?? e.coutJourParDefaut), 0)
}

function statut(beneficeActuel: number, margePrevuePct: number): ResultatRentabiliteObra['status'] {
  if (beneficeActuel <= 0) return 'loss'
  return margePrevuePct >= 25 ? 'profit' : 'warning'
}

/** Rentabilité de l'obra, hors IVA ; null sans valeur ou sans dates valides (comme l'ancien calcul). */
export function rentabiliteObra(e: EntreeRentabiliteObra): ResultatRentabiliteObra | null {
  const valeurHT = Number.isFinite(e.valeurHT) ? e.valeurHT : 0
  if (valeurHT <= 0 || !jourValide(e.dateDebut) || !jourValide(e.dateFin) || e.dateFin < e.dateDebut) return null

  const membresIds = e.membresIds.map(id => id.toLowerCase())
  const equipeEstimee = membresIds.length === 0 && Object.values(e.equipeParJour).every(m => m.length === 0)
  // Sans aucun employé désigné : l'ancienne estimation (nombre d'ouvriers × coût par défaut), les jours ouvrés.
  const estimation = Array.from({ length: Math.max(1, Math.floor(e.nbEmployesSansEquipe) || 1) }, (_, i) => `estimation-${i}`)
  const membresHabituels = equipeEstimee ? estimation : membresIds
  // Équipe habituelle d'aujourd'hui et des jours à venir : sans les employés partis (désactivés ou supprimés).
  const habituelsAVenir = equipeEstimee || !e.actifs ? membresHabituels : membresHabituels.filter(id => e.actifs?.has(id))
  const equipeParJour = equipeEstimee ? {} : e.equipeParJour

  const enCours = e.statut === 'En cours'
  const finDepassee = enCours && jourValide(e.aujourdhui) && e.aujourdhui > e.dateFin
  const fin = finDepassee ? e.aujourdhui : e.dateFin
  const periode = joursEntre(e.dateDebut, fin)

  let coutsParDefaut = false
  const jours: JourObra[] = periode.map(jour => {
    const habituels = jourValide(e.aujourdhui) && jour >= e.aujourdhui ? habituelsAVenir : membresHabituels
    const membres = equipeDuJour(jour, habituels, equipeParJour)
    if (!equipeEstimee && membres.some(id => !e.coutJourParMembre.has(id))) coutsParDefaut = true
    return {
      jour,
      membres: equipeEstimee ? [] : membres,
      cout: arrondi2(coutDesMembres(membres, e)),
      retouche: !equipeEstimee && jourRetouche(jour, habituels, equipeParJour),
      enRetard: jour > e.dateFin,
    }
  })

  const prevus = jours.filter(j => !j.enRetard)
  const retard = jours.filter(j => j.enRetard)
  const coutMOPrevu = prevus.reduce((s, j) => s + j.cout, 0)
  const coutRetard = retard.reduce((s, j) => s + j.cout, 0)
  const materiauxEstimes = e.materiauxHT === null
  const materiauxHT = materiauxEstimes ? valeurHT * TAUX_MATERIAUX_ESTIME_PCT / 100 : (e.materiauxHT as number)
  const coutTotalPrevu = coutMOPrevu + materiauxHT
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
    coutJourEquipe: Math.round(coutDesMembres(habituelsAVenir, e)),
    coutMOPrevu: Math.round(coutMOPrevu),
    materiauxHT: Math.round(materiauxHT),
    materiauxEstimes,
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
