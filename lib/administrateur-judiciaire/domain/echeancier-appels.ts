import { dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Exercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import { numeroCompteCoproprietaire, type CompteCoproprietaire } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { soldePoste, type PosteDette } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import {
  codeContrepartie,
  planDuCompteBudget,
  type AvisAppels,
  type EcheanceAppel,
  type SousComptes450,
} from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import {
  creerTraitement,
  type LigneMouvement,
  type OptionsTraitement,
  type SensMouvement,
  type Traitement,
} from '@/lib/administrateur-judiciaire/domain/traitements'

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
 *   (« Annulation d'appel de fonds », R6), ou de ses seules lignes pour une seule échéance (F104, ci-dessous) ; Annulé
 *   est définitif ; jamais Appelé → Prévu ;
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
 *   (repartition-appels.traitementAppelDeFonds) : elle s'appelle avec les échéances de l'appel ; seule, elle attend le
 *   suivant (aucune écriture ne peut la porter), sauf si l'emploi du fonds qui la finance est autorisé : elle passe
 *   alors « Appelé » sans écriture (F108, ci-dessous) ;
 * - un appel déjà réglé en partie ne s'annule pas : le règlement imputé sur ses postes serait perdu sans bruit ;
 * - suivi par défaut : « Prévu », relançable ; la date d'envoi ne se pose que sur une échéance appelée, une seule fois ;
 *   un envoi le jour de l'exigibilité ou après est enregistré tel quel (avis-appel.ts signale la diffusion tardive) ;
 * - relance : poste échu (exigible AVANT le jour de la relance : le jour de l'exigibilité, le versement est encore à
 *   temps, art. 19-2), non soldé, d'un appel émis et relançable, hors contentieux (le contentieux suit sa propre
 *   procédure ; inclusion à la main, motivée : F106, ci-dessous) ; une dette sans appel (reprise de solde) reste
 *   relançable ; tout écart est signalé avec son motif ;
 * - postes imputables : jamais ceux d'un appel annulé (son écriture contraire a soldé le 450).
 *
 * Décision de Hugo du 17/11/2026 (registre des décisions juridiques, J67, R96 ; décret n° 2005-240, art. 3, al. 2, et
 * art. 4, relus le 17/11/2026) : date comptable = date d'exigibilité de l'échéance (dateComptableAppel la propose) ; la
 * date d'émission reste une information (date de l'avis). controlerDateComptableAppel : une date comptable dans un autre
 * exercice que celui de l'exigibilité est un refus (bloquant ; marquerAppelees exige les exercices du syndicat et le
 * lève toujours) ; une date autre que l'exigibilité dans le même exercice, un avertissement. Gestéam date le traitement
 * de l'émission (tranche 43 § 8) : à la reprise, le même contrôle signale l'écart, sans effet sur les montants
 * (branchement de la reprise des appels : à faire).
 *
 * Décisions du 20/11/2026 (partie C, recommandations acceptées par le responsable du projet) :
 * - Décision du 20/11/2026 (partie C, F104) : une seule échéance non réglée d'un appel qui en compte plusieurs s'annule
 *   par une écriture contraire limitée à ses lignes (annulerEcheanceAppelee) : débit du compte de produit ou de
 *   provision de l'appel, crédit du 450 (ou du 450-1 qui a porté le budget : J67, R104), compte par compte, datée du jour
 *   de l'annulation, avec un motif (motifAnnulation). L'arrêté du 14/03/2005, art. 5, demande seulement qu'une écriture
 *   erronée soit annulée « par une écriture contraire » : elle peut être partielle, comme le rejet d'une seule ligne de
 *   virement (J9). Les autres échéances gardent leur exigibilité, leurs règlements et leurs relances. Refus si
 *   l'échéance est réglée, même en partie, ou en contentieux. Une échéance à 0 centime n'a aucune ligne : elle s'annule
 *   seule sans écriture. Ensuite, l'écriture contraire de tout l'appel est refusée (elle contre-passerait deux fois la
 *   part déjà annulée) : les autres échéances s'annulent une à une ;
 * - Décision du 20/11/2026 (partie C, F105) : un appel réglé en partie ne s'annule pas aujourd'hui (refus gardé dans
 *   annulerAppelees et annulerEcheanceAppelee : sans désimputation, le règlement disparaîtrait des comptes). Plus tard,
 *   avec la désimputation : l'annulation défait d'abord l'imputation, le règlement devient un crédit « à imputer » du 450,
 *   puis il est réimputé sur les dettes échues, selon l'indication du copropriétaire, à défaut sur la plus ancienne
 *   (arrêté du 14/03/2005, art. 9 ; C. civ. art. 1342-10), avec une trace ; le copropriétaire le voit sur l'avis suivant.
 *   La désimputation existe depuis le chèque impayé (F110 : imputation-encaissements.desimputerEncaissement) ; cette
 *   seconde étape (réimputation de l'art. 9) reste à faire ;
 * - Décision du 20/11/2026 (partie C, F106) : un poste en contentieux est exclu par défaut de la relance ordinaire (sa
 *   procédure propre : mise en demeure, délai de trente jours, J3) ; inclusion à la main possible, avec un motif
 *   (postesARelancer, inclusionsContentieux). Les autres postes du même copropriétaire restent relancés ;
 * - Décision du 20/11/2026 (partie C, F107) : aucune échéance négative ; la régularisation passe, à l'arrêté des comptes,
 *   par le 450 et la contrepartie du 701 (arrêté du 14/03/2005, art. 10 ; point 25). À la reprise de Gestéam, chaque
 *   ligne négative « REGUL CH. » ou « SOLDE AU » devient un solde repris du compte, avec son exercice, et non une
 *   échéance (repriseLigneNegativeGesteam). La lecture de l'échéancier Gestéam reste à écrire : elle passe chaque ligne
 *   avec le compte qu'elle vise ;
 * - Décision du 20/11/2026 (partie C, F108) : une échéance à 0 € appelée seule passe « Appelé » sans écriture
 *   (marquerAppeleeSansEcriture) : aucun produit à constater (décret n° 2005-240, art. 3 et 4). Seulement si son total
 *   est exactement 0 et si l'emploi du fonds qui la finance est autorisé (R82 : aucun emploi sans autorisation) :
 *   emploisFondsAutorises, que l'appelant établit par fonds-travaux.controlerAffectationFondsTravaux. La trace « échéance
 *   à 0 €, financée par le fonds de travaux » est portée par l'échéance (appelSansEcriture) : un traitement comptable
 *   exige au moins un débit et un crédit. L'avis suivant la mentionne pour information (avis-appel.ts,
 *   echeancesFinanceesParLeFonds).
 *
 * 🔴 Non établi (questions pour Frédéric ou Hugo) :
 * - « Une échéance "En attente" est-elle une échéance suspendue avant son appel (par exemple des travaux pendant le
 *   délai de contestation de l'art. 42, al. 3, qui suspend l'exécution des travaux et non l'appel), et peut-on l'appeler
 *   sans la repasser "Prévu" ? » (VitFix : non, la reprendre d'abord) ;
 * - « Que regroupe le "Regroupement (n)" de la fiche appel : des échéances appelées sur un même avis, ou la "banque du
 *   regroupement" du journal (tranche 43 § 2) ? » (VitFix : simple donnée, entier ≥ 1) ;
 * - « "Relançable" vaut-il oui par défaut ? » (VitFix : oui, modifiable par échéance) ;
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
  /**
   * Décision du 20/11/2026 (partie C, F104) : motif de l'annulation de cette seule échéance (annulerEcheanceAppelee) ;
   * absent ou null : annulée avec tout son appel, ou pas annulée.
   */
  motifAnnulation?: string | null
  /** Décision du 20/11/2026 (partie C, F108) : appelée sans écriture (échéance à 0 € financée par le fonds) ; absent sinon. */
  appelSansEcriture?: AppelSansEcriture | null
}

/** Décision du 20/11/2026 (partie C, F108) : trace d'une échéance à 0 € passée « Appelé » sans écriture. */
export interface AppelSansEcriture {
  /** Jour du passage à « Appelé » (AAAA-MM-JJ). */
  le: string
  trace: string
}

export type EcheanceAppelSuivie = EcheanceAppel & SuiviEcheanceAppel

/** Décision du 20/11/2026 (partie C, F108) : trace d'une échéance à 0 € appelée seule. */
export const TRACE_APPEL_SANS_ECRITURE = 'échéance à 0 €, financée par le fonds de travaux'

/** Décision du 20/11/2026 (partie C, F107) : libellés Gestéam des lignes négatives repris en solde du compte. */
export const LIBELLES_REPRISE_SOLDE_GESTEAM = ['REGUL CH.', 'SOLDE AU'] as const

/**
 * Transitions admises (🔵 déduites). Appelé → Annulé passe seulement par annulerAppelees (écriture contraire de l'appel)
 * ou annulerEcheanceAppelee (ses seules lignes, F104).
 */
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
        `Échéance « ${e.id} » : montant invalide (${e.montantCentimes}), centimes entiers positifs ou nuls attendus ; jamais d'échéance négative : une annulation est l'écriture contraire de l'appel (annulerAppelees), une régularisation négative (Gestéam « REGUL CH. », « SOLDE AU ») passe par la répartition des charges (point 25) ; à la reprise, une telle ligne devient un solde repris du compte, avec son exercice (repriseLigneNegativeGesteam ; décision du 20/11/2026, partie C, F107).`,
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
 * échéance à appeler ; seule, elle n'est retenue que si l'emploi du fonds qui la finance est autorisé
 * (emploisFondsAutorises, établi par l'appelant) : elle passe alors « Appelé » sans écriture (marquerAppeleeSansEcriture ;
 * décision du 20/11/2026, partie C, F108) ; sinon elle attend l'appel suivant.
 */
export function echeancesAAppeler<E extends EcheanceAppelSuivie>(
  echeances: E[],
  { jusquAu, emploisFondsAutorises }: { jusquAu: string; emploisFondsAutorises?: ReadonlySet<string> },
): E[] {
  verifierDate(jusquAu, "Horizon de l'appel")
  indexer(echeances)
  const retenues = echeances
    .filter((e) => e.statut === 'Prévu' && e.exigibilite <= jusquAu)
    .sort((a, b) => a.exigibilite.localeCompare(b.exigibilite) || a.id.localeCompare(b.id))
  if (retenues.some((e) => e.montantCentimes > 0)) return retenues
  return retenues.filter((e) => emploisFondsAutorises?.has(e.id) === true)
}

/**
 * Décision du 20/11/2026 (partie C, F108) — échéances à 0 € appelées seules : « Prévu » → « Appelé » sans écriture
 * (aucun produit à constater : décret n° 2005-240, art. 3 et 4), avec la trace TRACE_APPEL_SANS_ECRITURE et le jour du
 * passage. Refuse une échéance inconnue, désignée deux fois, dont le total n'est pas exactement 0, dont l'emploi du fonds
 * n'est pas autorisé (emploisFondsAutorises : l'appelant le contrôle par fonds-travaux.controlerAffectationFondsTravaux ;
 * J67, R82), ou qui n'est pas « Prévu ». Les autres échéances sont inchangées.
 */
export function marquerAppeleeSansEcriture<E extends EcheanceAppelSuivie>(
  echeances: E[],
  { ids, le, emploisFondsAutorises }: { ids: readonly string[]; le: string; emploisFondsAutorises: ReadonlySet<string> },
): E[] {
  verifierDate(le, "Jour de l'appel sans écriture")
  const index = indexerSuivies(echeances)
  const cibles = new Set(ids)
  if (cibles.size !== ids.length) throw new Error("Échéance désignée en double pour l'appel sans écriture.")
  for (const id of cibles) {
    const e = index.get(id)
    if (!e) throw new Error(`Échéance « ${id} » inconnue.`)
    if (e.montantCentimes !== 0)
      throw new Error(`Échéance « ${id} » de ${e.montantCentimes} centimes : seule une échéance dont le total est exactement 0 s'appelle sans écriture.`)
    if (!emploisFondsAutorises.has(id))
      throw new Error(`Échéance « ${id} » à 0 € : l'emploi du fonds de travaux qui la finance n'est pas autorisé (J67, R82) ; elle attend l'appel suivant.`)
    verifierTransition(e, 'Appelé')
  }
  const appel: AppelSansEcriture = { le, trace: TRACE_APPEL_SANS_ECRITURE }
  return echeances.map((e): E => (cibles.has(e.id) ? { ...e, statut: 'Appelé', echeancesDeLAppel: [e.id], appelSansEcriture: { ...appel } } : e))
}

/** Ligne négative de l'échéancier Gestéam, avec le compte qu'elle vise (reprise ; décision du 20/11/2026, partie C, F107). */
export interface LigneNegativeGesteam {
  compteId: string
  exercice: string
  /** Date de la ligne (AAAA-MM-JJ). */
  date: string
  libelle: string
  /** Montant de la ligne, négatif. */
  montantCentimes: number
}

/** Solde repris d'un compte copropriétaire, avec son exercice : jamais une échéance (F107). */
export interface SoldeReprisCompte {
  type: 'solde_repris'
  compteId: string
  exercice: string
  date: string
  libelle: string
  /** Négatif : crédit du compte. */
  montantCentimes: number
  motif: string
}

const MOTIF_REPRISE_SOLDE =
  "ligne négative de l'échéancier Gestéam reprise en solde du compte, jamais une échéance négative : la régularisation passe par le 450 et la contrepartie du 701 à l'arrêté des comptes (arrêté du 14/03/2005, art. 10 ; décision du 20/11/2026, partie C, F107)"

/**
 * Décision du 20/11/2026 (partie C, F107) — reprise d'une ligne négative « REGUL CH. » ou « SOLDE AU » de l'échéancier
 * Gestéam : elle devient un solde repris du compte, avec son exercice. Refuse une ligne qui n'est pas négative (elle se
 * reprend en échéance, suivreEcheances), un autre libellé (ligne à examiner, jamais une échéance négative), un compte ou
 * un exercice manquants, une date invalide.
 */
export function repriseLigneNegativeGesteam(ligne: LigneNegativeGesteam): SoldeReprisCompte {
  const libelle = ligne.libelle.trim()
  if (!Number.isInteger(ligne.montantCentimes) || ligne.montantCentimes >= 0)
    throw new Error(`Ligne « ${libelle} » de ${ligne.montantCentimes} centimes : seule une ligne négative se reprend en solde ; les autres sont des échéances (suivreEcheances).`)
  const reconnue = LIBELLES_REPRISE_SOLDE_GESTEAM.some((l) => libelle.toUpperCase().startsWith(l))
  if (!reconnue)
    throw new Error(`Ligne négative « ${libelle} » : seules « REGUL CH. » et « SOLDE AU » se reprennent en solde du compte ; ligne à examiner, jamais une échéance négative.`)
  if (!ligne.compteId.trim()) throw new Error(`Ligne « ${libelle} » : compte copropriétaire attendu.`)
  if (!ligne.exercice.trim()) throw new Error(`Ligne « ${libelle} » : exercice attendu.`)
  verifierDate(ligne.date, `Ligne « ${libelle} »`)
  return {
    type: 'solde_repris',
    compteId: ligne.compteId.trim(),
    exercice: ligne.exercice.trim(),
    date: ligne.date,
    libelle,
    montantCentimes: ligne.montantCentimes,
    motif: MOTIF_REPRISE_SOLDE,
  }
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
  // Par compte copropriétaire (série, 3e segment) : le budget peut être au 450-1 et le reste au 450 (J67, R104).
  const debitsParSerie = cumulerParCle(
    traitement.mouvements.filter((m) => m.sens === 'debit'),
    (m) => m.compte.split('.')[2] ?? m.compte,
    (m) => m.montantCentimes,
  )
  const debits = [...debitsParSerie.values()]
  const attendus = avis.parCompte.map((c) => c.totalAppeleCentimes).filter((m) => m > 0)
  if (listeMontants(debits) !== listeMontants(attendus))
    throw new Error(
      `Appel ${traitement.id} : débits des comptes 450 (${listeMontants(debits)}) autres que ceux de l'avis (${listeMontants(attendus)}) ; passer l'avis qui a produit ce traitement.`,
    )
}

// ─── Date comptable de l'appel (J67, R96) ─────────────────────────────────────────────────────

/** Bornes d'un exercice du syndicat (exercices-budgets.ts). */
export type BornesExercice = Pick<Exercice, 'nom' | 'ouverture' | 'cloture'>

export interface AnomalieDateComptableAppel {
  code: 'date_hors_exercice' | 'date_autre_que_exigibilite' | 'exigibilite_hors_exercice'
  gravite: 'bloquant' | 'avertissement'
  echeanceId: string
  message: string
  fondement: string
}

const FONDEMENT_DATE_COMPTABLE_APPEL = "décret n° 2005-240, art. 3, al. 2 ; art. 4 ; J67, R96"

/** Échéances écrites par l'appel (une échéance à 0 centime n'écrit aucune ligne). */
const echeancesEcrites = (avis: Pick<AvisAppels, 'echeances'>): EcheanceAppel[] => avis.echeances.filter((e) => e.montantCentimes > 0)

/**
 * Date comptable proposée pour l'écriture de l'appel : l'exigibilité de ses échéances (décret n° 2005-240, art. 3, al. 2 :
 * produits « enregistrées à la date d'exigibilité »). Plusieurs exigibilités : la plus ancienne, les autres sont
 * signalées par controlerDateComptableAppel.
 */
export function dateComptableAppel(avis: Pick<AvisAppels, 'echeances'>): string {
  const dates = echeancesEcrites(avis).map((e) => e.exigibilite).sort((a, b) => a.localeCompare(b))
  if (dates.length === 0) throw new Error("Appel sans échéance à écrire : aucune date comptable à proposer.")
  return dates[0]
}

const exerciceDe = (exercices: readonly BornesExercice[], date: string): BornesExercice | null =>
  exercices.find((x) => x.ouverture <= date && date <= x.cloture) ?? null

function anomalieDateEcheance(date: string, e: EcheanceAppel, exercices: readonly BornesExercice[]): AnomalieDateComptableAppel | null {
  const base = { echeanceId: e.id, fondement: FONDEMENT_DATE_COMPTABLE_APPEL }
  const exercice = exerciceDe(exercices, e.exigibilite)
  if (!exercice)
    return { ...base, code: 'exigibilite_hors_exercice', gravite: 'bloquant', message: `Échéance « ${e.id} » exigible le ${dateIsoVersFr(e.exigibilite)}, hors des exercices fournis : son exercice est à ouvrir avant d'écrire l'appel.` }
  if (date === e.exigibilite) return null
  if (exerciceDe([exercice], date) === null)
    return {
      ...base,
      code: 'date_hors_exercice',
      gravite: 'bloquant',
      message: `Appel daté du ${dateIsoVersFr(date)} (exercice ${exerciceDe(exercices, date)?.nom ?? 'inconnu'}) alors que « ${e.id} » est exigible le ${dateIsoVersFr(e.exigibilite)} (exercice ${exercice.nom}) : un produit se constate dans l'exercice de son exigibilité ; dater l'écriture de l'exigibilité, un appel par exercice.`,
    }
  return {
    ...base,
    code: 'date_autre_que_exigibilite',
    gravite: 'avertissement',
    message: `Appel daté du ${dateIsoVersFr(date)}, « ${e.id} » est exigible le ${dateIsoVersFr(e.exigibilite)} : la date comptable est l'exigibilité, la date d'émission n'est qu'une information.`,
  }
}

/**
 * Contrôle de la date comptable de l'écriture de l'appel (J67, R96) : pour chaque échéance écrite, refus (bloquant) d'une
 * date dans un autre exercice que celui de son exigibilité, ou d'une exigibilité hors des exercices fournis ;
 * avertissement d'une date autre que l'exigibilité dans le même exercice. Le même contrôle sert à la reprise des appels
 * Gestéam, datés de l'émission (tranche 43 § 8).
 */
export function controlerDateComptableAppel(
  traitement: Pick<Traitement, 'date'>,
  avis: Pick<AvisAppels, 'echeances'>,
  exercices: readonly BornesExercice[],
): AnomalieDateComptableAppel[] {
  verifierDate(traitement.date, "Date de l'appel")
  return echeancesEcrites(avis).flatMap((e) => anomalieDateEcheance(traitement.date, e, exercices) ?? [])
}

/**
 * Appel par un traitement « Appel de fonds » (repartition-appels.traitementAppelDeFonds), avec l'avis qui l'a produit
 * (repartition-appels.avisDAppel), sur la LISTE COMPLÈTE des échéances suivies : celles de l'avis (mêmes identifiants,
 * mêmes montants), du même syndicat (D1), toutes « Prévu », passent « Appelé » avec l'identifiant du traitement et la
 * composition de l'appel ; les autres sont inchangées. Refuse un traitement qui porte déjà sur une échéance de la liste
 * (il n'appelle qu'un lot, une fois), un avis qui ne concorde pas avec lui (crédits par contrepartie, débits des comptes
 * 450) et une date comptable refusée par controlerDateComptableAppel (J67, R96) : les exercices du syndicat sont
 * obligatoires, le refus n'est jamais facultatif.
 */
export function marquerAppelees<E extends EcheanceAppelSuivie>(
  echeances: E[],
  traitement: Traitement,
  avis: AvisAppels,
  { exercices }: { exercices: readonly BornesExercice[] },
): E[] {
  // Appelant non typé (donnée reprise, JavaScript) : sans les exercices, le contrôle de la date comptable serait sauté.
  if (!Array.isArray(exercices))
    throw new Error(`Appel ${traitement.id} : exercices du syndicat attendus, pour contrôler la date comptable de l'appel (J67, R96).`)
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
  const refus = controlerDateComptableAppel(traitement, avis, exercices).filter((a) => a.gravite === 'bloquant')
  if (refus.length > 0) throw new Error(`Appel ${traitement.id} refusé : ${refus.map((a) => a.message).join(' ; ')}`)
  const lot = appelees.map((e) => e.id)
  const ids = new Set(lot)
  return echeances.map((e): E => (ids.has(e.id) ? { ...e, statut: 'Appelé', traitementId: traitement.id, echeancesDeLAppel: [...lot] } : e))
}

/** Décision du 20/11/2026 (partie C, F105) : sans désimputation, le règlement disparaîtrait des comptes. */
const MOTIF_REGLE_REFUSE =
  "déjà réglé(s), même en partie : l'annulation reste refusée tant que la désimputation n'est pas branchée, sans quoi le règlement disparaîtrait des comptes (décision du 20/11/2026, partie C, F105)."

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
    if (e.statut === 'Annulé' && e.motifAnnulation)
      throw new Error(
        `Échéance « ${e.id} » de l'appel ${appel} déjà annulée seule (${e.annulationTraitementId ?? 'sans écriture'}) : l'écriture contraire de tout l'appel contre-passerait deux fois sa part ; annuler les autres échéances une à une (annulerEcheanceAppelee ; décision du 20/11/2026, partie C, F104).`,
      )
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
 * déjà annulée (seule, F104 : les autres s'annulent alors une à une), une somme autre que celle contre-passée, et tout
 * poste de ces échéances déjà réglé, même en partie (décision du 20/11/2026, partie C, F105 : refus gardé tant que la
 * désimputation n'est pas branchée). Les postes passés doivent être tous ceux de l'appel.
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
  if (regles.length > 0) throw new Error(`Annulation ${annulation.id} refusée : poste(s) ${regles.join(', ')} ${MOTIF_REGLE_REFUSE}`)
  return echeances.map((e): E => (ids.has(e.id) ? { ...e, statut: 'Annulé', annulationTraitementId: annulation.id } : e))
}

// ─── Annulation d'une seule échéance (décision du 20/11/2026, partie C, F104) ──────────────────

export interface AnnulationEcheanceSeule {
  /** Identifiant du traitement « Annulation d'appel de fonds ». */
  id: string
  /** Jour de l'annulation : date de l'écriture contraire (AAAA-MM-JJ). */
  date: string
  motif: string
}

export interface OptionsAnnulationEcheance extends OptionsTraitement {
  echeanceId: string
  /** Traitement « Appel de fonds » qui a appelé l'échéance. */
  appel: Traitement
  /** Avis qui a produit cet appel (repartition-appels.avisDAppel). */
  avis: AvisAppels
  /** Postes de l'échéance (postesDepuisAvis), dans leur état courant : réglé, contentieux. */
  postes: readonly PosteDette[]
  annulation: AnnulationEcheanceSeule
  segmentSyndicat: string
  comptes: readonly CompteCoproprietaire[]
  /** J67, R104 : sous-comptes du 450 créés par l'AG, comme à l'appel ; absent : tout au 45000. */
  sousComptes450?: SousComptes450 | null
}

/** L'échéance est appelée par cet appel, et l'avis fourni est celui qui l'a produit. */
function verifierEcheanceDeLAppel(e: EcheanceAppelSuivie, { appel, avis }: OptionsAnnulationEcheance): void {
  if (appel.famille !== 'Appel de fonds') throw new Error(`Traitement ${appel.id} de la famille « ${appel.famille} » : seul un « Appel de fonds » appelle des échéances.`)
  if (e.statut === 'Annulé') throw new Error(`Échéance « ${e.id} » déjà annulée par ${e.annulationTraitementId ?? 'une annulation sans écriture'}.`)
  if (e.statut !== 'Appelé') throw new Error(`Échéance « ${e.id} » « ${e.statut} » : seule une échéance appelée s'annule par une écriture contraire ; avant l'appel, annulerAvantAppel.`)
  if (e.traitementId !== appel.id) throw new Error(`Échéance « ${e.id} » appelée par ${e.traitementId ?? 'aucun traitement'}, pas par ${appel.id}.`)
  if (composition(avis.echeances.map((a) => a.id)) !== composition(e.echeancesDeLAppel))
    throw new Error(`Appel ${appel.id} : l'avis fourni n'est pas celui de l'appel (échéances ${composition(e.echeancesDeLAppel)} attendues).`)
  verifierAvisDuTraitement(avis, appel)
}

/** Postes de l'échéance : tous fournis (leur total est celui de l'échéance), aucun réglé, même en partie, ni en contentieux. */
function verifierPostesNonRegles(e: EcheanceAppelSuivie, postes: readonly PosteDette[]): void {
  const siens = postes.filter((p) => p.appelId === e.id)
  const total = siens.reduce((s, p) => s + p.montantCentimes, 0)
  if (total !== e.montantCentimes)
    throw new Error(`Échéance « ${e.id} » : postes fournis pour ${total} centimes, l'échéance en compte ${e.montantCentimes} ; passer tous les postes de l'échéance.`)
  const regles = siens.filter((p) => p.regleCentimes > 0).map((p) => p.id)
  if (regles.length > 0) throw new Error(`Échéance « ${e.id} » : poste(s) ${regles.join(', ')} ${MOTIF_REGLE_REFUSE}`)
  const contentieux = siens.filter((p) => p.contentieux).map((p) => p.id)
  if (contentieux.length > 0)
    throw new Error(`Échéance « ${e.id} » : poste(s) ${contentieux.join(', ')} en contentieux : annulation refusée (décision du 20/11/2026, partie C, F104).`)
}

/**
 * Lignes de l'écriture contraire de la seule échéance : débit du compte de produit ou de provision de l'appel, crédit du
 * 450 de chaque compte (le 450-1 pour le budget si l'AG l'a créé : J67, R104), pour les quotes-parts de l'avis.
 */
function lignesContrairesDeLEcheance(e: EcheanceAppelSuivie, options: OptionsAnnulationEcheance): LigneMouvement[] {
  const { avis, comptes, segmentSyndicat, sousComptes450 = null } = options
  const plan = e.nature === 'budget' && sousComptes450 ? planDuCompteBudget(sousComptes450) : '45000'
  const credits = avis.parCompte.flatMap((a): LigneMouvement[] => {
    const part = a.lignes.filter((l) => l.echeanceId === e.id).reduce((s, l) => s + l.centimes, 0)
    if (part === 0) return []
    const compte = comptes.find((c) => c.id === a.compteId)
    if (!compte) throw new Error(`Compte copropriétaire introuvable : « ${a.compteId} ».`)
    return [{ compte: numeroCompteCoproprietaire(compte, segmentSyndicat, plan), sens: 'credit', montantCentimes: part }]
  })
  return [{ compte: `${segmentSyndicat}.${codeContrepartie(e)}.00000.0`, sens: 'debit', montantCentimes: e.montantCentimes }, ...credits]
}

/**
 * Décision du 20/11/2026 (partie C, F104) — annulation d'une seule échéance appelée, non réglée, d'un appel qui en compte
 * plusieurs : écriture contraire limitée à ses lignes (famille « Annulation d'appel de fonds », renvoi à l'appel), datée
 * du jour de l'annulation, avec un motif (arrêté du 14/03/2005, art. 5). L'échéance passe « Annulé » avec l'identifiant
 * de l'annulation et son motif ; les autres sont inchangées et gardent leur appel. Une échéance à 0 centime n'a aucune
 * ligne : elle s'annule sans écriture (traitement null). Refuse un appel d'une autre famille, une échéance inconnue, pas
 * appelée par cet appel, déjà annulée, un avis qui n'est pas celui de l'appel, des postes incomplets, un poste réglé,
 * même en partie (F105), ou en contentieux, un motif vide, une date antérieure à l'appel ; le verrou de saisie s'applique
 * à la date de l'annulation (traitements.creerTraitement).
 */
export function annulerEcheanceAppelee<E extends EcheanceAppelSuivie>(
  echeances: E[],
  options: OptionsAnnulationEcheance,
): { traitement: Traitement | null; echeances: E[] } {
  const { echeanceId, appel, annulation, verrou } = options
  const e = indexerSuivies(echeances).get(echeanceId)
  if (!e) throw new Error(`Échéance « ${echeanceId} » inconnue.`)
  verifierEcheanceDeLAppel(e, options)
  verifierPostesNonRegles(e, options.postes)
  const motif = annulation.motif.trim()
  if (!motif) throw new Error(`Échéance « ${e.id} » : motif de l'annulation attendu (décision du 20/11/2026, partie C, F104).`)
  verifierDate(annulation.date, "Date de l'annulation")
  if (annulation.date < appel.date)
    throw new Error(`Annulation du ${dateIsoVersFr(annulation.date)} antérieure à l'appel ${appel.id} du ${dateIsoVersFr(appel.date)} : l'écriture contraire suit l'écriture qu'elle annule.`)
  const traitement =
    e.montantCentimes === 0
      ? null
      : creerTraitement(
          { id: annulation.id, famille: "Annulation d'appel de fonds", date: annulation.date, annule: appel.id, mouvements: lignesContrairesDeLEcheance(e, options) },
          { verrou },
        )
  const annulee = { statut: 'Annulé' as const, annulationTraitementId: traitement?.id ?? null, motifAnnulation: motif }
  return { traitement, echeances: echeances.map((x): E => (x.id === e.id ? { ...x, ...annulee } : x)) }
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

function motifEcartRelance(
  poste: PosteDette,
  index: ReadonlyMap<string, EcheanceAppelSuivie>,
  inclusions: ReadonlyMap<string, string>,
): MotifEcartRelance | null {
  const etat = etatAppel(poste, index)
  const motif = MOTIF_PAR_ETAT[etat]
  if (motif) return motif
  if (poste.contentieux && !inclusions.has(poste.id)) return 'contentieux'
  const echeance = poste.appelId === null ? undefined : index.get(poste.appelId)
  return echeance?.relancable === false ? 'non_relancable' : null
}

/** Décision du 20/11/2026 (partie C, F106) : poste en contentieux inclus à la main dans la relance ordinaire, avec son motif. */
export interface InclusionContentieux {
  posteId: string
  motif: string
}

/** Inclusions contrôlées : poste connu, en contentieux, une fois, motif non vide (F106). */
function indexerInclusions(postes: readonly PosteDette[], inclusions: readonly InclusionContentieux[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const { posteId, motif } of inclusions) {
    const poste = postes.find((p) => p.id === posteId)
    if (!poste) throw new Error(`Inclusion dans la relance : poste « ${posteId} » inconnu.`)
    if (!poste.contentieux) throw new Error(`Inclusion dans la relance : poste « ${posteId} » pas en contentieux ; il est déjà relancé.`)
    if (index.has(posteId)) throw new Error(`Inclusion dans la relance : poste « ${posteId} » en double.`)
    const texte = motif.trim()
    if (!texte) throw new Error(`Inclusion du poste « ${posteId} » en contentieux dans la relance ordinaire : motif attendu (décision du 20/11/2026, partie C, F106).`)
    index.set(posteId, texte)
  }
  return index
}

/**
 * Postes à relancer le jour `le` (base de la campagne de relance, tranche 27) : échus (exigibles avant ce jour), non
 * soldés ; parmi eux, ceux d'un appel annulé, non émis ou inconnu, en contentieux ou d'une échéance non relançable sont
 * écartés avec leur motif. Un poste en contentieux est exclu par défaut, sauf inclusion à la main, motivée
 * (inclusionsContentieux ; décision du 20/11/2026, partie C, F106) : il est alors relancé et inclusContentieux rend son
 * motif. Une dette sans appel (reprise de solde) reste relançable. L'ordre reçu est conservé. Refuse un traitement marqué
 * sur deux avis, une inclusion sans motif, d'un poste inconnu, hors contentieux ou en double.
 */
export function postesARelancer(
  postes: PosteDette[],
  echeances: EcheanceAppelSuivie[],
  { le, inclusionsContentieux = [] }: { le: string; inclusionsContentieux?: readonly InclusionContentieux[] },
): { relancables: PosteDette[]; ecartes: { posteId: string; motif: MotifEcartRelance }[]; inclusContentieux?: InclusionContentieux[] } {
  verifierDate(le, 'Date de la relance')
  const index = indexerSuivies(echeances)
  const inclusions = indexerInclusions(postes, inclusionsContentieux)
  const relancables: PosteDette[] = []
  const ecartes: { posteId: string; motif: MotifEcartRelance }[] = []
  for (const p of postes) {
    verifierDate(p.exigibilite, `Poste ${p.id}`)
    if (p.exigibilite >= le || soldePoste(p) <= 0) continue
    const motif = motifEcartRelance(p, index, inclusions)
    if (motif) ecartes.push({ posteId: p.id, motif })
    else relancables.push(p)
  }
  if (inclusions.size === 0) return { relancables, ecartes }
  const inclusContentieux = relancables.flatMap((p) => {
    const motif = inclusions.get(p.id)
    return motif === undefined ? [] : [{ posteId: p.id, motif }]
  })
  return { relancables, ecartes, inclusContentieux }
}
