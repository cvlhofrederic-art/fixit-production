import { ajouterJours, ajouterMois, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { PosteCreance } from '@/lib/administrateur-judiciaire/domain/postes-creance'

/**
 * Décompte et échéancier d'un dossier contentieux (cartographie Gestéam, tranche 42 : onglet Règlements). Fonctions
 * pures, montants en CENTIMES ENTIERS, dates ISO (AAAA-MM-JJ), sans écran.
 *
 * Gestéam — Jugement : montant demandé · indemnités · principal · dépens · article 700 · intérêts légaux · dommages
 * int. → montant dû ; total règlement → solde dû ; chèques à disposition, chèques promis. Échéancier : en N fois,
 * montant, tous les N <unité>, prochain le ; grille Date · Statut · Montant.
 *
 * Le montant demandé se reconstitue depuis les postes de la créance (`PosteCreance`, décision J3) : ce module ne recrée
 * pas le principal. Tant qu'aucune condamnation n'est saisie (`jugement: null`), le montant dû est le montant demandé ;
 * ensuite, la somme des postes du jugement (🔵 déduit de l'écran Gestéam, non observé sur un dossier jugé chiffré).
 * Le décompte est DATÉ : la demande ou la condamnation est arrêtée à une date ; les règlements datés de ce jour ou avant
 * sont réputés déjà pris en compte (par le juge, ou dans la demande) et ne sont pas déduits une seconde fois — ils sont
 * listés à part, à vérifier. Le montant dû n'inclut pas ce qui court après l'arrêté (intérêts postérieurs, frais
 * d'exécution) : ce n'est ni une assiette d'intérêts ni un décompte d'exécution.
 * Les règlements s'imputent globalement : l'imputation poste par poste (C. civ. art. 1342-10 et 1343-1) n'est pas faite ici.
 * 🔵 Unités de périodicité de l'échéancier : la liste Gestéam n'a pas été ouverte (jours, semaines, mois retenus).
 */

/** Postes du jugement, dans l'ordre de la fiche Gestéam. */
export const POSTES_JUGEMENT = [
  { cle: 'indemnites', libelle: 'Indemnités' },
  { cle: 'principal', libelle: 'Principal' },
  { cle: 'depens', libelle: 'Dépens' },
  { cle: 'article700', libelle: 'Article 700 du CPC' },
  { cle: 'interetsLegaux', libelle: 'Intérêts légaux' },
  { cle: 'dommagesInterets', libelle: 'Dommages-intérêts' },
] as const
export type PosteJugement = (typeof POSTES_JUGEMENT)[number]['cle']
export type CondamnationCentimes = Record<PosteJugement, number>

export interface ReglementDebiteur {
  id: string
  date: string
  montantCentimes: number
}

export interface Condamnation {
  postes: CondamnationCentimes
  /** Date d'arrêté du décompte retenue par la décision ; à défaut, date de la décision. */
  arreteLe: string
}

export interface SaisieDecompte {
  montantDemandeCentimes: number
  /** Date d'arrêté du montant demandé (mise en demeure, assignation) ; null : tous les règlements s'en déduisent. */
  demandeArreteeLe: string | null
  /** Condamnation ; null tant qu'aucune n'est saisie. */
  jugement: Condamnation | null
  reglements: ReglementDebiteur[]
  chequesADispositionCentimes: number
  chequesPromisCentimes: number
}

export interface Decompte {
  base: 'demande' | 'jugement'
  /** Date d'arrêté de la base ; null pour une demande non datée. */
  arreteLe: string | null
  montantDemandeCentimes: number
  montantDuCentimes: number
  /** Règlements postérieurs à l'arrêté, seuls déduits. */
  totalReglementsCentimes: number
  /** Règlements datés de l'arrêté ou avant : réputés déjà pris en compte, non déduits, à vérifier. */
  reglementsAnterieurs: ReglementDebiteur[]
  /** Négatif : excédent sur la créance du dossier (à imputer sur le compte du copropriétaire). */
  soldeDuCentimes: number
  chequesADispositionCentimes: number
  chequesPromisCentimes: number
  /** 🔵 Solde restant une fois encaissés les chèques à disposition et promis. */
  soldeApresChequesCentimes: number
}

const verifierCentimes = (libelle: string, montant: number): void => {
  if (!Number.isInteger(montant) || montant < 0)
    throw new Error(`${libelle} invalide (${montant}) : centimes entiers positifs attendus.`)
}

const verifierDate = (libelle: string, date: string): void => {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide pour ${libelle} (${date}) : AAAA-MM-JJ attendu.`)
}

const somme = (montants: number[]): number => montants.reduce((total, montant) => total + montant, 0)

/** Contrôle TOUS les règlements (identifiant unique, date ISO, montant > 0), avant tout tri par date. */
function verifierReglements(reglements: ReglementDebiteur[]): void {
  const vus = new Set<string>()
  for (const reglement of reglements) {
    if (vus.has(reglement.id)) throw new Error(`Règlement compté deux fois (id=${reglement.id}).`)
    vus.add(reglement.id)
    verifierDate(`le règlement ${reglement.id}`, reglement.date)
    if (!Number.isInteger(reglement.montantCentimes) || reglement.montantCentimes <= 0)
      throw new Error(`Montant du règlement ${reglement.id} invalide (${reglement.montantCentimes}) : centimes entiers > 0 attendus.`)
  }
}

const totalReglements = (reglements: ReglementDebiteur[]): number => somme(reglements.map((r) => r.montantCentimes))

/** Montant demandé reconstitué depuis les postes de la créance (décision J3). */
export const totalPostesCreance = (postes: PosteCreance[]): number => somme(postes.map((poste) => poste.montantCentimes))

/** Écart entre le montant demandé du dossier et ses postes de créance : positif si le dossier demande davantage. */
export const ecartMontantDemande = (montantDemandeCentimes: number, postes: PosteCreance[]): number =>
  montantDemandeCentimes - totalPostesCreance(postes)

function verifierSaisieDecompte(saisie: SaisieDecompte): void {
  verifierCentimes('Montant demandé', saisie.montantDemandeCentimes)
  verifierCentimes('Montant des chèques à disposition', saisie.chequesADispositionCentimes)
  verifierCentimes('Montant des chèques promis', saisie.chequesPromisCentimes)
  if (saisie.demandeArreteeLe !== null) verifierDate("l'arrêté de la demande", saisie.demandeArreteeLe)
  if (saisie.jugement) {
    verifierDate("l'arrêté du jugement", saisie.jugement.arreteLe)
    for (const { cle, libelle } of POSTES_JUGEMENT) verifierCentimes(`Poste « ${libelle} »`, saisie.jugement.postes[cle])
  }
  verifierReglements(saisie.reglements)
}

/**
 * Décompte du dossier : montant dû (demande ou condamnation) arrêté à sa date, règlements postérieurs déduits,
 * règlements antérieurs listés à part, solde, projection des chèques.
 */
export function calculerDecompte(saisie: SaisieDecompte): Decompte {
  verifierSaisieDecompte(saisie)
  const { jugement } = saisie
  const montantDuCentimes = jugement
    ? somme(POSTES_JUGEMENT.map(({ cle }) => jugement.postes[cle]))
    : saisie.montantDemandeCentimes
  const arreteLe = jugement ? jugement.arreteLe : saisie.demandeArreteeLe
  const anterieur = (r: ReglementDebiteur) => arreteLe !== null && r.date <= arreteLe
  const totalReglementsCentimes = totalReglements(saisie.reglements.filter((r) => !anterieur(r)))
  const soldeDuCentimes = montantDuCentimes - totalReglementsCentimes
  return {
    base: jugement ? 'jugement' : 'demande',
    arreteLe,
    montantDemandeCentimes: saisie.montantDemandeCentimes,
    montantDuCentimes,
    totalReglementsCentimes,
    reglementsAnterieurs: saisie.reglements.filter(anterieur),
    soldeDuCentimes,
    chequesADispositionCentimes: saisie.chequesADispositionCentimes,
    chequesPromisCentimes: saisie.chequesPromisCentimes,
    soldeApresChequesCentimes: soldeDuCentimes - saisie.chequesADispositionCentimes - saisie.chequesPromisCentimes,
  }
}

export const UNITES_PERIODICITE = ['jours', 'semaines', 'mois'] as const
export type UnitePeriodicite = (typeof UNITES_PERIODICITE)[number]

export interface Periodicite {
  nombre: number
  tousLes: number
  unite: UnitePeriodicite
  premiereLe: string
}

export interface PlanEcheancier extends Periodicite {
  /** Montant de chaque échéance. */
  montantCentimes: number
}

export interface EcheanceDebiteur {
  rang: number
  date: string
  montantCentimes: number
}

function verifierPeriodicite(periodicite: Periodicite): void {
  if (!Number.isInteger(periodicite.nombre) || periodicite.nombre < 1)
    throw new Error(`Nombre d'échéances invalide (${periodicite.nombre}) : entier ≥ 1 attendu.`)
  if (!Number.isInteger(periodicite.tousLes) || periodicite.tousLes < 1)
    throw new Error(`Périodicité invalide (tous les ${periodicite.tousLes}) : entier ≥ 1 attendu.`)
  if (!(UNITES_PERIODICITE as readonly string[]).includes(periodicite.unite))
    throw new Error(`Unité de périodicité inconnue : « ${periodicite.unite} ».`)
  verifierDate('la première échéance', periodicite.premiereLe)
}

/** Date de l'échéance de rang `rang` (1 = la première), calculée depuis la première pour éviter toute dérive. */
function dateEcheance(periodicite: Periodicite, rang: number): string {
  const pas = periodicite.tousLes * (rang - 1)
  if (periodicite.unite === 'mois') return ajouterMois(periodicite.premiereLe, pas)
  return ajouterJours(periodicite.premiereLe, periodicite.unite === 'semaines' ? pas * 7 : pas)
}

/** Échéancier Gestéam : N échéances d'un même montant, tous les N jours, semaines ou mois. */
export function genererEcheancier(plan: PlanEcheancier): EcheanceDebiteur[] {
  verifierPeriodicite(plan)
  if (!Number.isInteger(plan.montantCentimes) || plan.montantCentimes <= 0)
    throw new Error(`Montant d'échéance invalide (${plan.montantCentimes}) : centimes entiers > 0 attendus.`)
  return Array.from({ length: plan.nombre }, (_, index) => ({
    rang: index + 1,
    date: dateEcheance(plan, index + 1),
    montantCentimes: plan.montantCentimes,
  }))
}

/** Échelonne un solde en N échéances égales ; l'arrondi va sur la dernière. */
export function echelonner(totalCentimes: number, periodicite: Periodicite): EcheanceDebiteur[] {
  verifierPeriodicite(periodicite)
  verifierCentimes('Montant à échelonner', totalCentimes)
  const courant = Math.floor(totalCentimes / periodicite.nombre)
  if (courant < 1)
    throw new Error(`Impossible d'échelonner ${totalCentimes} centimes en ${periodicite.nombre} fois : échéance inférieure à 1 centime.`)
  return Array.from({ length: periodicite.nombre }, (_, index) => ({
    rang: index + 1,
    date: dateEcheance(periodicite, index + 1),
    montantCentimes: index === periodicite.nombre - 1 ? totalCentimes - courant * (periodicite.nombre - 1) : courant,
  }))
}

export type StatutEcheance = 'payee' | 'partielle' | 'impayee' | 'a_venir'

export interface EcheanceSuivie extends EcheanceDebiteur {
  payeCentimes: number
  statut: StatutEcheance
}

export interface SuiviEcheancier {
  echeances: EcheanceSuivie[]
  /** Première échéance non soldée qui n'est pas encore échue ; null si toutes sont soldées ou échues. */
  prochaine: EcheanceSuivie | null
  /** Reste dû sur les échéances échues (date antérieure à aujourd'hui). */
  impayesCentimes: number
  /** Vrai si aucune échéance échue ne reste à payer. */
  respecte: boolean
  /** Règlements au-delà du total de l'échéancier. */
  excedentCentimes: number
}

const statutEcheance = (montant: number, paye: number, echue: boolean): StatutEcheance => {
  if (paye >= montant) return 'payee'
  if (paye > 0) return 'partielle'
  return echue ? 'impayee' : 'a_venir'
}

/** Contrôle des échéances reçues : rang entier unique, date ISO, montant entier > 0. */
function verifierEcheances(echeances: EcheanceDebiteur[]): void {
  const rangs = new Set<number>()
  for (const echeance of echeances) {
    if (!Number.isInteger(echeance.rang) || rangs.has(echeance.rang))
      throw new Error(`Rang d'échéance invalide ou en double (${echeance.rang}).`)
    rangs.add(echeance.rang)
    verifierDate(`l'échéance ${echeance.rang}`, echeance.date)
    if (!Number.isInteger(echeance.montantCentimes) || echeance.montantCentimes <= 0)
      throw new Error(`Montant de l'échéance ${echeance.rang} invalide (${echeance.montantCentimes}) : centimes entiers > 0 attendus.`)
  }
}

/**
 * Suivi de l'échéancier à `aujourdhui` : les règlements reçus jusqu'à ce jour (à passer : ceux faits au titre de
 * l'échéancier) s'imputent dans l'ordre des échéances. Une échéance du jour n'est pas encore impayée. Tous les
 * règlements sont contrôlés avant d'écarter ceux datés après aujourd'hui.
 */
export function suivreEcheancier(
  echeances: EcheanceDebiteur[],
  reglements: ReglementDebiteur[],
  aujourdhui: string,
): SuiviEcheancier {
  verifierDate("aujourd'hui", aujourdhui)
  verifierEcheances(echeances)
  verifierReglements(reglements)
  let disponible = totalReglements(reglements.filter((reglement) => reglement.date <= aujourdhui))
  const suivies = [...echeances]
    .sort((a, b) => a.rang - b.rang)
    .map((echeance): EcheanceSuivie => {
      const payeCentimes = Math.min(disponible, echeance.montantCentimes)
      disponible -= payeCentimes
      return { ...echeance, payeCentimes, statut: statutEcheance(echeance.montantCentimes, payeCentimes, echeance.date < aujourdhui) }
    })
  const impayesCentimes = somme(
    suivies.filter((e) => e.date < aujourdhui).map((e) => e.montantCentimes - e.payeCentimes),
  )
  return {
    echeances: suivies,
    prochaine: suivies.find((e) => e.statut !== 'payee' && e.date >= aujourdhui) ?? null,
    impayesCentimes,
    respecte: impayesCentimes === 0,
    excedentCentimes: disponible,
  }
}

/** Délais de grâce : report ou échelonnement « dans la limite de deux années » (C. civ. art. 1343-5). */
export const DUREE_MAX_DELAIS_GRACE_MOIS = 24

/**
 * Origine de l'échéancier. Seuls les délais de grâce accordés par le juge sont bornés à deux ans ; un protocole
 * amiable, un accord homologué ou un plan de surendettement (régime propre, C. consom.) ne le sont pas ici.
 */
export const ORIGINES_ECHEANCIER = ['amiable', 'accord_homologue', 'delais_grace', 'surendettement'] as const
export type OrigineEcheancier = (typeof ORIGINES_ECHEANCIER)[number]

export interface DecisionEcheancier {
  origine: OrigineEcheancier
  decideLe: string
  /** Délais de grâce : jugement contradictoire (délai compté du jugement) ; sinon, de la notification (CPC art. 511). */
  contradictoire?: boolean
  notifieeLe?: string | null
}

export interface AlerteEcheancier {
  code: 'delais_grace_depasses' | 'premiere_avant_decision' | 'point_de_depart_inconnu'
  message: string
}

/** Point de départ des délais de grâce : le jugement s'il est contradictoire, sinon sa notification ; null si inconnu. */
function departDelaisGrace(decision: DecisionEcheancier): string | null {
  if (decision.contradictoire === true) return decision.decideLe
  return decision.notifieeLe ?? null
}

/**
 * Contrôles d'un échéancier : première échéance postérieure à la décision qui le fixe ; pour des délais de grâce,
 * dernière échéance au plus tard DUREE_MAX_DELAIS_GRACE_MOIS mois après leur point de départ (jugement contradictoire,
 * sinon notification ; alerte si ce point de départ est inconnu).
 */
export function controlerEcheancier(echeances: EcheanceDebiteur[], decision: DecisionEcheancier): AlerteEcheancier[] {
  if (!(ORIGINES_ECHEANCIER as readonly string[]).includes(decision.origine))
    throw new Error(`Origine d'échéancier inconnue : « ${decision.origine} ».`)
  verifierDate('la décision', decision.decideLe)
  if (decision.notifieeLe) verifierDate('la notification', decision.notifieeLe)
  verifierEcheances(echeances)
  const dates = echeances.map((e) => e.date).sort((a, b) => a.localeCompare(b))
  const premiere = dates[0]
  const derniere = dates.at(-1)
  if (premiere === undefined || derniere === undefined) return []
  const alertes: AlerteEcheancier[] = []
  if (premiere < decision.decideLe)
    alertes.push({ code: 'premiere_avant_decision', message: "Première échéance antérieure à la décision qui fixe l'échéancier." })
  if (decision.origine !== 'delais_grace') return alertes
  const depart = departDelaisGrace(decision)
  if (depart === null)
    alertes.push({
      code: 'point_de_depart_inconnu',
      message: 'Délais de grâce : jugement non contradictoire sans date de notification, point de départ inconnu (CPC art. 511).',
    })
  else if (derniere > ajouterMois(depart, DUREE_MAX_DELAIS_GRACE_MOIS))
    alertes.push({
      code: 'delais_grace_depasses',
      message: `Dernière échéance au-delà de ${DUREE_MAX_DELAIS_GRACE_MOIS} mois après le point de départ : délais de grâce limités à deux ans (C. civ. art. 1343-5).`,
    })
  return alertes
}
