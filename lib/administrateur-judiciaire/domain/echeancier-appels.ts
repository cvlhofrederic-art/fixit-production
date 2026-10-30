import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { soldePoste, type PosteDette } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { codeContrepartie, type AvisAppels, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import type { SensMouvement, Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Échéancier des appels : statut, traitement d'appel et d'annulation, date d'envoi, relançable, regroupement (point 16
 * du bilan 2). Fonctions pures, montants en CENTIMES ENTIERS, dates ISO, sans écran ni table : les tables des appels, des
 * échéances et des postes restent à faire (Frédéric).
 *
 * Gestéam — 🟢 tranche 30 § Échéancier des appels : liste Date (exigibilité) · Mandat · Clé · Libellé · Montant · Statut ;
 * libellés vus « APPEL DE FONDS … », « REGUL CH. … », « SOLDE AU … », montants négatifs = régularisations ; fiche :
 * Type, Statut, Exigible, Traitement, bloc Suivi « Envoyé le · Relançable · Règlement priorité (n) · Regroupement (n) » ;
 * une échéance est rattachée au traitement « Appel de fonds » qui l'a produite ; tranche 43 § 23 (cotisations au fonds
 * de travaux) : statuts Appelé · Prévu · Annulé · En attente, montants négatifs = annulations ; § 8 : le traitement
 * « Appel de fonds » est émis une dizaine de jours avant l'exigibilité. ⚪ Non observé : transitions entre statuts, sens
 * de « En attente » et de « Regroupement (n) », valeur par défaut de « Relançable ».
 *
 * Le suivi s'ajoute à l'échéance (EcheanceAppelSuivie = EcheanceAppel + SuiviEcheanceAppel) sans changer les producteurs
 * (appels-budget, travaux-operations, fonds-travaux) ni repartition-appels : avisDAppel reçoit les échéances que
 * echeancesAAppeler retient, le filtre des statuts vit ici.
 *
 * 🟢 Lu sur Légifrance (versions en vigueur au 29/10/2026) :
 * - L. 1965 art. 14-1 : « La provision est exigible le premier jour de chaque trimestre ou le premier jour de la période
 *   fixée par l'assemblée générale » ; art. 14-3, al. 2 : charges et produits « enregistrés dès leur engagement juridique
 *   [...] indépendamment de leur règlement. L'engagement est soldé par le règlement » → l'appel crée la créance (écriture
 *   « Appel de fonds »), l'encaissement la solde ;
 * - D. 2005-240 art. 3 : les produits constatés pour les opérations courantes comprennent les « sommes reçues ou à
 *   recevoir de chaque copropriétaire en vertu de l'obligation leur incombant, enregistrées à la date d'exigibilité » ;
 *   art. 4 : produits des travaux « à constater au titre de l'exercice de leur exigibilité » ;
 * - D. 1967 art. 35-2 : l'avis part « préalablement à la date d'exigibilité » ; aucun délai minimal n'est fixé ;
 * - arrêté du 14 mars 2005, art. 5 : « Une écriture erronée est annulée par une écriture contraire » ;
 * - L. 1965 art. 19-2 : la déchéance du terme suit une mise en demeure restée infructueuse trente jours, sans relance
 *   préalable exigée ; aucun texte ne fixe de statut d'appel ni de procédure d'annulation d'un appel.
 * 🔵 Déduit :
 * - cycle : Prévu → En attente (motif exigé) → Prévu ; Prévu → Appelé (par un traitement « Appel de fonds ») ; Prévu ou
 *   En attente → Annulé sans écriture (rien n'a été appelé) ; Appelé → Annulé par l'écriture contraire de son appel
 *   (« Annulation d'appel de fonds », R6) ; Annulé est définitif ; jamais Appelé → Prévu ;
 * - une échéance « En attente » n'est pas appelée tant qu'elle n'est pas reprise (« Prévu ») : marquerAppelees la refuse ;
 * - jamais d'échéance négative : l'annulation contre-passe l'appel (arrêté, art. 5) au lieu des lignes négatives
 *   d'annulation de Gestéam ; la régularisation négative (excédent rendu, « REGUL CH. », « SOLDE AU ») passe par la
 *   répartition des charges (point 25 : remboursement des provisions au crédit du 450), comme l'appel de régularisation
 *   (appels-budget.ts) ; annulerTraitement contre-passe le traitement entier, donc toutes ses échéances passent
 *   « Annulé » ensemble ;
 * - le traitement « Appel de fonds » ne porte pas l'identifiant des échéances : crédits cumulés par compte de
 *   contrepartie, un débit par compte 450, rien pour une échéance à 0 centime ; l'origine R8 d'un mouvement existe
 *   (traitements.ts, LigneMouvement.origine { type: 'appel', appelId, typeAppel }), mais traitementAppelDeFonds ne la pose
 *   pas. Les échéances appelées se lisent donc dans l'avis qui l'a produit, recoupé avec l'écriture (crédits par
 *   contrepartie, débits des comptes 450) ;
 * - marquerAppelees et annulerAppelees reçoivent la LISTE COMPLÈTE des échéances suivies du syndicat et en déduisent
 *   elles-mêmes celles de l'appel : un traitement n'appelle qu'un lot d'échéances, une seule fois (refusé s'il porte déjà
 *   sur une échéance de la liste, même annulée) ; chaque échéance appelée retient la composition de son appel
 *   (echeancesDeLAppel, tirée de l'avis), et l'annulation exige toute cette composition, échéances à 0 centime comprises ;
 *   limite : une liste incomplète au marquage (sans les échéances que le traitement a déjà appelées) ne se voit pas à ce
 *   moment ; les deux compositions d'un même traitement se signalent ensuite (annulation, postes imputables, relance) ;
 * - une échéance à 0 centime (tranche entièrement financée par le fonds de travaux) n'écrit aucune ligne
 *   (repartition-appels.traitementAppelDeFonds) : elle s'appelle avec les échéances de l'appel, et seule elle attend le
 *   suivant (aucune écriture ne peut la porter) ;
 * - un appel déjà réglé en partie ne s'annule pas : le règlement imputé sur ses postes serait perdu sans bruit ;
 * - suivi par défaut : « Prévu », relançable ; la date d'envoi ne se pose que sur une échéance appelée, une seule fois ;
 *   un envoi le jour de l'exigibilité ou après est enregistré tel quel (avis-appel.ts signale la diffusion tardive) ;
 * - relance : poste échu (exigible AVANT le jour de la relance : le jour de l'exigibilité, le versement est encore à
 *   temps, art. 19-2), non soldé, d'un appel émis et relançable, hors contentieux (le contentieux suit sa propre
 *   procédure) ; une dette sans appel (reprise de solde) reste relançable ; tout écart est signalé avec son motif ;
 * - postes imputables : jamais ceux d'un appel annulé (son écriture contraire a soldé le 450).
 * 🔴 Non établi (questions pour Frédéric ou Hugo) :
 * - « Une échéance "En attente" est-elle une échéance suspendue avant son appel (par exemple des travaux pendant le
 *   délai de contestation de l'art. 42, al. 3, qui suspend l'exécution des travaux et non l'appel), et peut-on l'appeler
 *   sans la repasser "Prévu" ? » (VitFix : non, la reprendre d'abord) ;
 * - « Que regroupe le "Regroupement (n)" de la fiche appel : des échéances appelées sur un même avis, ou la "banque du
 *   regroupement" du journal (tranche 43 § 2) ? » (VitFix : simple donnée, entier ≥ 1) ;
 * - « "Relançable" vaut-il oui par défaut ? » (VitFix : oui, modifiable par échéance) ;
 * - « Faut-il pouvoir annuler une seule échéance d'un appel qui en porte plusieurs (contre-passation partielle, comme le
 *   rejet de virement J9), ou annuler tout l'appel puis rappeler les autres ? » (VitFix : tout l'appel) ;
 * - « Appel déjà réglé en partie : à son annulation, le règlement imputé devient-il un crédit "à imputer" du compte ? »
 *   (VitFix : annulation refusée, aucune désimputation dans le domaine) ;
 * - « Date comptable du traitement "Appel de fonds" : l'exigibilité (D. 2005-240 art. 3) ou la date d'émission
 *   (Gestéam, tranche 43 § 8) ? » (VitFix : non contrôlée) ;
 * - « Un poste en contentieux reste-t-il dans la campagne de relance (tranche 27) ? » (VitFix : non) ;
 * - « Les lignes négatives de régularisation de l'échéancier Gestéam ("REGUL CH.", "SOLDE AU") se reprennent-elles en
 *   VitFix par la répartition des charges (point 25), ou faut-il admettre une échéance négative ? » (VitFix : point 25,
 *   aucune échéance négative) ;
 * - « Une échéance à 0 centime appelée seule (dernière tranche entièrement financée par le fonds de travaux) passe-t-elle
 *   "Appelé" sans écriture, ou attend-elle l'appel suivant ? » (VitFix : elle attend ; echeancesAAppeler ne la retient
 *   pas seule) ;
 * - « Faut-il, dans l'écriture de l'appel, un débit 450 par compte ET par échéance, portant son origine R8
 *   (LigneMouvement.origine { type: 'appel', appelId, typeAppel }), pour que le traitement désigne lui-même ses
 *   échéances ? Cela modifie repartition-appels.traitementAppelDeFonds et ses tests, et une échéance à 0 centime n'y
 *   figurerait toujours pas (aucune ligne nulle). » (VitFix : non ; liste complète et composition retenue par chaque
 *   échéance, voir ci-dessus).
 * Non repris : « Règlement priorité » (l'ordre légal d'imputation le remplace, bilan n° 15) ; part d'honoraires, montant
 * non réparti, % base, TVA ; plafond d'emploi du fonds de travaux (point 17) ; régularisation des charges, positive ou
 * négative, après la répartition (point 25).
 */

export const STATUTS_ECHEANCE_APPEL = ['Prévu', 'En attente', 'Appelé', 'Annulé'] as const
export type StatutEcheanceAppel = (typeof STATUTS_ECHEANCE_APPEL)[number]

export interface SuiviEcheanceAppel {
  statut: StatutEcheanceAppel
  /** Traitement « Appel de fonds » qui a appelé l'échéance ; null tant qu'elle n'est pas appelée. */
  traitementId: string | null
  /** Traitement « Annulation d'appel de fonds » qui contre-passe l'appel ; null sinon. */
  annulationTraitementId: string | null
  /** Motif de la mise en attente ; gardé à l'annulation d'une échéance en attente. */
  motifAttente: string | null
  /** Gestéam « Regroupement (n) » : 🔴 sens non observé, entier ≥ 1. */
  regroupement: number | null
  /** Gestéam « Relançable » : ses postes entrent dans la relance (postesARelancer). */
  relancable: boolean
  /** Gestéam « Envoyé le » : jour d'envoi de l'avis (AAAA-MM-JJ). */
  envoyeLe: string | null
  /**
   * Composition de l'appel : identifiants des échéances que le même traitement a appelées (celles de son avis), elle
   * comprise ; vide tant qu'elle n'est pas appelée. Le traitement ne les porte pas (🔵 voir l'en-tête).
   */
  echeancesDeLAppel: string[]
}

export type EcheanceAppelSuivie = EcheanceAppel & SuiviEcheanceAppel

/** Transitions admises (🔵 déduites). Appelé → Annulé passe seulement par annulerAppelees (écriture contraire). */
const TRANSITIONS: Record<StatutEcheanceAppel, readonly StatutEcheanceAppel[]> = {
  Prévu: ['En attente', 'Appelé', 'Annulé'],
  'En attente': ['Prévu', 'Annulé'],
  Appelé: ['Annulé'],
  Annulé: [],
}

function verifierTransition(e: EcheanceAppelSuivie, nouveau: StatutEcheanceAppel): void {
  if (!(STATUTS_ECHEANCE_APPEL as readonly string[]).includes(e.statut)) throw new Error(`Échéance « ${e.id} » : statut inconnu « ${e.statut} ».`)
  if (!TRANSITIONS[e.statut].includes(nouveau)) throw new Error(`Échéance « ${e.id} » : passage « ${e.statut} » → « ${nouveau} » refusé.`)
}

function verifierDate(date: string, objet: string): void {
  if (!estDateIsoValide(date)) throw new Error(`${objet} : date invalide (${date}), AAAA-MM-JJ attendu.`)
}

function indexer<E extends { id: string }>(echeances: E[]): Map<string, E> {
  const index = new Map<string, E>()
  for (const e of echeances) {
    if (index.has(e.id)) throw new Error(`Échéance « ${e.id} » en double.`)
    index.set(e.id, e)
  }
  return index
}

const composition = (ids: readonly string[]): string => [...ids].sort((a, b) => a.localeCompare(b)).join(', ')

/**
 * Chaque échéance appelée retient la composition de son appel, elle comprise, et deux échéances d'un même traitement
 * retiennent la même : un traitement n'appelle qu'un lot d'échéances (🔵 voir l'en-tête).
 */
function verifierCompositions(echeances: EcheanceAppelSuivie[]): void {
  const parTraitement = new Map<string, string>()
  for (const e of echeances) {
    if (e.traitementId === null) continue
    if (!e.echeancesDeLAppel.includes(e.id)) throw new Error(`Échéance « ${e.id} » appelée par ${e.traitementId} sans la composition de son appel.`)
    const lot = composition(e.echeancesDeLAppel)
    const autre = parTraitement.get(e.traitementId)
    if (autre !== undefined && autre !== lot)
      throw new Error(
        `Appel ${e.traitementId} : échéances marquées sur deux avis (${autre} | ${lot}) ; un traitement n'appelle qu'un lot d'échéances, celles de son avis.`,
      )
    parTraitement.set(e.traitementId, lot)
  }
}

/** Index des échéances suivies, après contrôle des compositions d'appel. */
function indexerSuivies<E extends EcheanceAppelSuivie>(echeances: E[]): Map<string, E> {
  const index = indexer(echeances)
  verifierCompositions(echeances)
  return index
}

const somme = (echeances: EcheanceAppel[]): number => echeances.reduce((s, e) => s + e.montantCentimes, 0)

const totalDuSens = (traitement: Traitement, sens: SensMouvement): number =>
  traitement.mouvements.filter((m) => m.sens === sens).reduce((s, m) => s + m.montantCentimes, 0)

/**
 * Pose le suivi par défaut sur les échéances des producteurs : « Prévu », ni traitement ni envoi, relançable (option).
 * Refuse un identifiant vide ou en double, une exigibilité invalide, un montant négatif ou non entier (une annulation est
 * l'écriture contraire de l'appel, une régularisation négative passe par la répartition des charges, point 25), une
 * échéance déjà suivie. Les échéances reçues sont inchangées.
 */
export function suivreEcheances(echeances: EcheanceAppel[], { relancable = true }: { relancable?: boolean } = {}): EcheanceAppelSuivie[] {
  indexer(echeances)
  return echeances.map((e): EcheanceAppelSuivie => {
    if (!e.id.trim()) throw new Error('Échéance sans identifiant.')
    if ('statut' in e) throw new Error(`Échéance « ${e.id} » déjà suivie (statut « ${String(e.statut)} »).`)
    verifierDate(e.exigibilite, `Échéance « ${e.id} »`)
    if (!Number.isInteger(e.montantCentimes) || e.montantCentimes < 0)
      throw new Error(
        `Échéance « ${e.id} » : montant invalide (${e.montantCentimes}), centimes entiers positifs ou nuls attendus ; jamais d'échéance négative : une annulation est l'écriture contraire de l'appel (annulerAppelees), une régularisation négative (Gestéam « REGUL CH. », « SOLDE AU ») passe par la répartition des charges (point 25).`,
      )
    return {
      ...e,
      statut: 'Prévu',
      traitementId: null,
      annulationTraitementId: null,
      motifAttente: null,
      regroupement: null,
      relancable,
      envoyeLe: null,
      echeancesDeLAppel: [],
    }
  })
}

/** Prévu → En attente, avec son motif ; l'échéance n'est plus retenue pour l'appel. */
export function mettreEnAttente<E extends EcheanceAppelSuivie>(e: E, motif: string): E {
  verifierTransition(e, 'En attente')
  const texte = motif.trim()
  if (!texte) throw new Error(`Échéance « ${e.id} » : motif de la mise en attente attendu.`)
  return { ...e, statut: 'En attente', motifAttente: texte }
}

/** En attente → Prévu : l'échéance redevient appelable ; le motif est effacé. */
export function reprendreEcheance<E extends EcheanceAppelSuivie>(e: E): E {
  verifierTransition(e, 'Prévu')
  return { ...e, statut: 'Prévu', motifAttente: null }
}

/** Prévu ou En attente → Annulé, sans écriture (rien n'a été appelé). Une échéance appelée s'annule par annulerAppelees. */
export function annulerAvantAppel<E extends EcheanceAppelSuivie>(e: E): E {
  if (e.statut === 'Appelé')
    throw new Error(`Échéance « ${e.id} » déjà appelée (${e.traitementId}) : l'annuler par l'écriture contraire de son appel (annulerAppelees).`)
  verifierTransition(e, 'Annulé')
  return { ...e, statut: 'Annulé' }
}

/**
 * Échéances à appeler jusqu'à une date : « Prévu », exigibles au plus tard ce jour-là, triées par exigibilité puis
 * identifiant. C'est l'entrée de repartition-appels.avisDAppel. Une échéance à 0 centime n'est retenue qu'avec une
 * échéance à appeler : seule, aucune écriture ne peut la porter, elle attend l'appel suivant (🔴 voir l'en-tête).
 */
export function echeancesAAppeler<E extends EcheanceAppelSuivie>(echeances: E[], { jusquAu }: { jusquAu: string }): E[] {
  verifierDate(jusquAu, "Horizon de l'appel")
  indexer(echeances)
  const retenues = echeances
    .filter((e) => e.statut === 'Prévu' && e.exigibilite <= jusquAu)
    .sort((a, b) => a.exigibilite.localeCompare(b.exigibilite) || a.id.localeCompare(b.id))
  return retenues.some((e) => e.montantCentimes > 0) ? retenues : []
}

/** Montants cumulés par clé, sans les montants nuls (une ligne nulle n'est pas écrite). */
function cumulerParCle<T>(elements: T[], cle: (t: T) => string, montant: (t: T) => number): Map<string, number> {
  const cumuls = new Map<string, number>()
  for (const t of elements) if (montant(t) !== 0) cumuls.set(cle(t), (cumuls.get(cle(t)) ?? 0) + montant(t))
  return cumuls
}

/** Échéances de la liste suivie que l'avis appelle, dans l'ordre de l'avis : toutes présentes, aux montants de l'avis. */
function echeancesDeLAvis<E extends EcheanceAppelSuivie>(index: ReadonlyMap<string, E>, avis: AvisAppels, appel: string): E[] {
  if (avis.echeances.length === 0) throw new Error(`Appel ${appel} : aucune échéance dans l'avis.`)
  indexer(avis.echeances)
  const retenues: E[] = []
  const absentes: string[] = []
  for (const a of avis.echeances) {
    const e = index.get(a.id)
    if (!e) absentes.push(a.id)
    else if (e.montantCentimes === a.montantCentimes) retenues.push(e)
    else throw new Error(`Appel ${appel} : échéance ${a.id} : ${e.montantCentimes} centimes, l'avis porte ${a.montantCentimes}.`)
  }
  if (absentes.length > 0)
    throw new Error(`Appel ${appel} : échéance(s) ${absentes.join(', ')} de l'avis absente(s) de la liste ; passer la liste complète des échéances suivies.`)
  return retenues
}

const listeMontants = (montants: number[]): string => [...montants].sort((a, b) => a - b).join(', ')

/**
 * L'avis est celui du traitement : crédits par compte de contrepartie et débits des comptes 450 concordent (le
 * traitement ne porte pas l'identifiant des échéances, 🔵 voir l'en-tête).
 */
function verifierAvisDuTraitement(avis: AvisAppels, traitement: Traitement): void {
  const credits = traitement.mouvements.filter((m) => m.sens === 'credit')
  const ecrits = cumulerParCle(credits, (m) => m.compte.split('.')[1] ?? m.compte, (m) => m.montantCentimes)
  const appeles = cumulerParCle(avis.echeances, codeContrepartie, (e) => e.montantCentimes)
  for (const code of new Set([...appeles.keys(), ...ecrits.keys()]))
    if ((ecrits.get(code) ?? 0) !== (appeles.get(code) ?? 0))
      throw new Error(
        `Appel ${traitement.id} : contrepartie ${code} : ${ecrits.get(code) ?? 0} centimes crédités, l'avis en appelle ${appeles.get(code) ?? 0} ; passer l'avis qui a produit ce traitement.`,
      )
  const debits = traitement.mouvements.filter((m) => m.sens === 'debit').map((m) => m.montantCentimes)
  const attendus = avis.parCompte.map((c) => c.totalAppeleCentimes).filter((m) => m > 0)
  if (listeMontants(debits) !== listeMontants(attendus))
    throw new Error(
      `Appel ${traitement.id} : débits des comptes 450 (${listeMontants(debits)}) autres que ceux de l'avis (${listeMontants(attendus)}) ; passer l'avis qui a produit ce traitement.`,
    )
}

/**
 * Appel par un traitement « Appel de fonds » (repartition-appels.traitementAppelDeFonds), avec l'avis qui l'a produit
 * (repartition-appels.avisDAppel), sur la LISTE COMPLÈTE des échéances suivies : celles de l'avis (mêmes identifiants,
 * mêmes montants), du même syndicat (D1), toutes « Prévu », passent « Appelé » avec l'identifiant du traitement et la
 * composition de l'appel ; les autres sont inchangées. Refuse un traitement qui porte déjà sur une échéance de la liste
 * (il n'appelle qu'un lot, une fois) et un avis qui ne concorde pas avec lui (crédits par contrepartie, débits des
 * comptes 450).
 */
export function marquerAppelees<E extends EcheanceAppelSuivie>(echeances: E[], traitement: Traitement, avis: AvisAppels): E[] {
  if (traitement.famille !== 'Appel de fonds')
    throw new Error(`Traitement ${traitement.id} de la famille « ${traitement.famille} » : seul un « Appel de fonds » appelle des échéances.`)
  const index = indexerSuivies(echeances)
  const dejaAppelees = echeances.filter((e) => e.traitementId === traitement.id).map((e) => e.id)
  if (dejaAppelees.length > 0)
    throw new Error(
      `Appel ${traitement.id} : il a déjà appelé ${dejaAppelees.join(', ')} ; un traitement n'appelle qu'un lot d'échéances (celles de son avis), une seule fois.`,
    )
  const appelees = echeancesDeLAvis(index, avis, traitement.id)
  if (new Set(appelees.map((e) => e.coproprieteId)).size > 1)
    throw new Error(`Appel ${traitement.id} : échéances de plusieurs syndicats ; un traitement ne mouvemente qu'un syndicat (D1).`)
  for (const e of appelees) {
    if (e.statut === 'En attente') throw new Error(`Échéance « ${e.id} » en attente (${e.motifAttente}) : la reprendre (« Prévu ») avant de l'appeler.`)
    verifierTransition(e, 'Appelé')
  }
  verifierAvisDuTraitement(avis, traitement)
  const lot = appelees.map((e) => e.id)
  const ids = new Set(lot)
  return echeances.map((e): E => (ids.has(e.id) ? { ...e, statut: 'Appelé', traitementId: traitement.id, echeancesDeLAppel: [...lot] } : e))
}

/** La liste porte toute la composition de l'appel, échéances à 0 centime comprises (aucune ligne ne les écrit). */
function verifierCompositionAnnulee(visees: EcheanceAppelSuivie[], annulation: Traitement, appel: string): void {
  const portees = new Set(visees.map((e) => e.id))
  const absentes = visees[0].echeancesDeLAppel.filter((id) => !portees.has(id))
  if (absentes.length > 0)
    throw new Error(
      `Annulation ${annulation.id} : échéance(s) ${absentes.join(', ')} de l'appel ${appel} absente(s) de la liste ; l'écriture contraire annule tout l'appel : passer la liste complète des échéances suivies (une échéance à 0 centime n'apparaît pas dans l'écriture).`,
    )
}

/** Échéances de l'appel annulé : toutes « Appelé » ; leur somme égale ce que l'écriture contraire contre-passe. */
function verifierEcheancesAnnulees(visees: EcheanceAppelSuivie[], annulation: Traitement, appel: string): void {
  for (const e of visees) {
    if (e.statut === 'Annulé') throw new Error(`Échéance « ${e.id} » déjà annulée par ${e.annulationTraitementId ?? 'une annulation avant appel'}.`)
    if (e.statut !== 'Appelé') throw new Error(`Échéance « ${e.id} » « ${e.statut} » : seule une échéance appelée s'annule par l'écriture contraire de son appel.`)
  }
  const contrePasse = totalDuSens(annulation, 'debit')
  const fournies = somme(visees)
  if (contrePasse !== fournies)
    throw new Error(
      `Annulation ${annulation.id} : ${contrePasse} centimes contre-passés, échéances de l'appel ${appel} fournies ${fournies} centimes ; l'écriture contraire annule tout l'appel : passer toutes ses échéances.`,
    )
}

/**
 * Annulation d'un appel par son écriture contraire (traitements.annulerTraitement, famille « Annulation d'appel de
 * fonds »), sur la LISTE COMPLÈTE des échéances suivies : toutes les échéances du traitement annulé passent « Annulé »,
 * avec l'identifiant de l'annulation ; les autres sont inchangées. Refuse une autre famille, une annulation qui ne
 * renvoie à aucun appel, une liste sans toute la composition de l'appel (échéances à 0 centime comprises), une échéance
 * déjà annulée, une somme autre que celle contre-passée, et tout poste de ces échéances déjà réglé, même en partie
 * (🔴 aucune désimputation dans le domaine). Les postes passés doivent être tous ceux de l'appel.
 */
export function annulerAppelees<E extends EcheanceAppelSuivie>(echeances: E[], annulation: Traitement, postes: PosteDette[]): E[] {
  if (annulation.famille !== "Annulation d'appel de fonds")
    throw new Error(`Traitement ${annulation.id} de la famille « ${annulation.famille} » : seule une « Annulation d'appel de fonds » annule un appel.`)
  const appel = annulation.annule
  if (!appel) throw new Error(`Annulation ${annulation.id} sans traitement annulé (annule) : elle ne contre-passe aucun appel.`)
  indexerSuivies(echeances)
  const visees = echeances.filter((e) => e.traitementId === appel)
  if (visees.length === 0) throw new Error(`Annulation ${annulation.id} : aucune échéance de l'appel ${appel} fournie.`)
  verifierCompositionAnnulee(visees, annulation, appel)
  verifierEcheancesAnnulees(visees, annulation, appel)
  const ids = new Set(visees.map((e) => e.id))
  const regles = postes.filter((p) => p.appelId !== null && ids.has(p.appelId) && p.regleCentimes > 0).map((p) => p.id)
  if (regles.length > 0)
    throw new Error(`Annulation ${annulation.id} refusée : poste(s) ${regles.join(', ')} déjà réglé(s) ; désimputer d'abord les encaissements.`)
  return echeances.map((e): E => (ids.has(e.id) ? { ...e, statut: 'Annulé', annulationTraitementId: annulation.id } : e))
}

/** Pose la date d'envoi de l'avis sur des échéances appelées ; une date déjà posée ne se réécrit pas (même date : sans effet). */
export function marquerEnvoyees<E extends EcheanceAppelSuivie>(echeances: E[], { ids, le }: { ids: string[]; le: string }): E[] {
  verifierDate(le, "Date d'envoi")
  const index = indexer(echeances)
  const cibles = new Set(ids)
  if (cibles.size !== ids.length) throw new Error('Échéance désignée en double pour l’envoi.')
  for (const id of cibles) {
    const e = index.get(id)
    if (!e) throw new Error(`Échéance « ${id} » inconnue.`)
    if (e.statut !== 'Appelé') throw new Error(`Échéance « ${id} » « ${e.statut} » : seule une échéance appelée est envoyée.`)
    if (e.envoyeLe !== null && e.envoyeLe !== le) throw new Error(`Échéance « ${id} » déjà envoyée le ${e.envoyeLe} : la date d'envoi ne se réécrit pas.`)
  }
  return echeances.map((e): E => (cibles.has(e.id) ? { ...e, envoyeLe: le } : e))
}

function verifierModifiable(e: EcheanceAppelSuivie): void {
  if (e.statut === 'Annulé') throw new Error(`Échéance « ${e.id} » annulée : son suivi ne se modifie plus.`)
}

/** Fixe ou retire le regroupement (🔴 sens non observé) : entier ≥ 1, ou null. */
export function fixerRegroupement<E extends EcheanceAppelSuivie>(e: E, regroupement: number | null): E {
  verifierModifiable(e)
  if (regroupement !== null && (!Number.isInteger(regroupement) || regroupement < 1))
    throw new Error(`Échéance « ${e.id} » : regroupement invalide (${regroupement}), entier ≥ 1 attendu, ou aucun.`)
  return { ...e, regroupement }
}

/** Rend l'échéance relançable ou non. */
export function fixerRelancable<E extends EcheanceAppelSuivie>(e: E, relancable: boolean): E {
  verifierModifiable(e)
  if (typeof relancable !== 'boolean') throw new Error(`Échéance « ${e.id} » : relançable, oui ou non attendu.`)
  return { ...e, relancable }
}

// ─── Postes de terme selon le statut de leur échéance ─────────────────────────────────────────

type EtatAppelPoste = 'sans_appel' | 'appele' | 'annule' | 'non_appele' | 'inconnu'

function etatAppel(poste: PosteDette, index: ReadonlyMap<string, EcheanceAppelSuivie>): EtatAppelPoste {
  if (poste.appelId === null) return 'sans_appel'
  const e = index.get(poste.appelId)
  if (!e) return 'inconnu'
  if (e.statut === 'Appelé') return 'appele'
  return e.statut === 'Annulé' ? 'annule' : 'non_appele'
}

/**
 * Postes sur lesquels un encaissement peut s'imputer (entrée de imputation-encaissements.imputerEncaissement) : dettes
 * sans appel et postes des échéances appelées, dans l'ordre reçu ; les postes d'un appel annulé sont écartés (son
 * écriture contraire a soldé le 450). Refuse un poste d'échéance inconnue ou pas appelée (un poste naît de l'appel), le
 * poste réglé d'un appel annulé (le règlement serait perdu sans bruit), et un traitement marqué sur deux avis.
 */
export function postesImputables(postes: PosteDette[], echeances: EcheanceAppelSuivie[]): PosteDette[] {
  const index = indexerSuivies(echeances)
  return postes.filter((p) => {
    const etat = etatAppel(p, index)
    if (etat === 'inconnu') throw new Error(`Poste ${p.id} : échéance « ${p.appelId} » inconnue ; passer les échéances de tous les postes.`)
    if (etat === 'non_appele') throw new Error(`Poste ${p.id} : échéance « ${p.appelId} » pas appelée ; un poste ne naît que de l'appel.`)
    if (etat === 'annule' && p.regleCentimes > 0)
      throw new Error(`Poste ${p.id} : appel « ${p.appelId} » annulé alors que le poste est réglé de ${p.regleCentimes} centimes.`)
    return etat !== 'annule'
  })
}

export type MotifEcartRelance = 'appel_annule' | 'appel_non_emis' | 'echeance_inconnue' | 'contentieux' | 'non_relancable'

const MOTIF_PAR_ETAT: Partial<Record<EtatAppelPoste, MotifEcartRelance>> = {
  annule: 'appel_annule',
  non_appele: 'appel_non_emis',
  inconnu: 'echeance_inconnue',
}

function motifEcartRelance(poste: PosteDette, index: ReadonlyMap<string, EcheanceAppelSuivie>): MotifEcartRelance | null {
  const etat = etatAppel(poste, index)
  const motif = MOTIF_PAR_ETAT[etat]
  if (motif) return motif
  if (poste.contentieux) return 'contentieux'
  const echeance = poste.appelId === null ? undefined : index.get(poste.appelId)
  return echeance?.relancable === false ? 'non_relancable' : null
}

/**
 * Postes à relancer le jour `le` (base de la campagne de relance, tranche 27) : échus (exigibles avant ce jour), non
 * soldés ; parmi eux, ceux d'un appel annulé, non émis ou inconnu, en contentieux ou d'une échéance non relançable sont
 * écartés avec leur motif. Une dette sans appel (reprise de solde) reste relançable. L'ordre reçu est conservé. Refuse
 * un traitement marqué sur deux avis.
 */
export function postesARelancer(
  postes: PosteDette[],
  echeances: EcheanceAppelSuivie[],
  { le }: { le: string },
): { relancables: PosteDette[]; ecartes: { posteId: string; motif: MotifEcartRelance }[] } {
  verifierDate(le, 'Date de la relance')
  const index = indexerSuivies(echeances)
  const relancables: PosteDette[] = []
  const ecartes: { posteId: string; motif: MotifEcartRelance }[] = []
  for (const p of postes) {
    verifierDate(p.exigibilite, `Poste ${p.id}`)
    if (p.exigibilite >= le || soldePoste(p) <= 0) continue
    const motif = motifEcartRelance(p, index)
    if (motif) ecartes.push({ posteId: p.id, motif })
    else relancables.push(p)
  }
  return { relancables, ecartes }
}
