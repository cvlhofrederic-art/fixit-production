import { ajouterJours, ajouterMois, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import { normaliserEspaces } from '@/lib/administrateur-judiciaire/domain/texte'
import { STATUT_MANDAT, type StatutMandat } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Statut du mandat (point 55 du bilan 2) : lecture typée de la valeur libre `Mandat.statut` sur le référentiel
 * STATUT_MANDAT, et borne du portefeuille, du suivi « à faire » et de la balance âgée (suivi-a-faire.ts). Fonctions
 * pures, dates ISO (AAAA-MM-JJ) données par l'appelant, sans écran ni table : db/schema.ts garde `statut: string`, ce
 * module le lit.
 *
 * Sources Gestéam :
 * - 🟢 Tranche 18 § 2 et tranche 24 § 1 (recherche de mandats) : Statut, cinq valeurs — Prospect · En gestion ·
 *   En clôture · En gestion, en clôture · Archivé. Tranche 18 : la valeur composite dit qu'un mandat peut être à la fois
 *   en gestion et en cours de clôture (une transition, pas un état exclusif).
 * - 🟢 Tranche 41 (liste des mandats, ≈ 650 fiches) : statuts vus Prospect · En gestion · En clôture · Archivé ; la
 *   valeur composite n'y a pas été vue. 🔵 Apport de la même tranche : le statut borne la balance âgée et le suivi, un
 *   mandat archivé ne produit plus d'« à faire » (déduit, non observé à l'écran).
 * - 🟢 Tranche 43 § 9 (« En gestion » sur la recherche relevée) et tranche 27 (recherche des exercices, critère
 *   « Statut du mandat ») : Gestéam filtre lui-même ses listes sur ce statut.
 * - 🟢 Tranche 38 : le suivi se filtre « de mon portefeuille » ou sur tout le cabinet, la balance âgée se calcule par rôle
 *   sur le mandat ; ⚪ aucun filtre de statut n'y a été relevé à l'écran.
 * - 🔵 Tranche 39 : la « fiche de prospect » (opération de gérance) est une autre fiche que le statut Prospect d'un
 *   mandat ; elle n'est pas lue ici.
 *
 * Règles du module :
 * - 🔵 Prospect et Archivé sont HORS SUIVI : ni portefeuille, ni « à faire », ni balance âgée, ni demandes en cours d'une
 *   entreprise (suivi-a-faire.depuisDemandes), ni échéances légales du portefeuille, ni rappels de Fixy, ni réponses de
 *   Fixy sur le portefeuille. Prospect : mandat pas encore en gestion (aucune mission en cours) ; Archivé : mandat
 *   terminé. Une copropriété citée par son nom reste interrogeable quel que soit son statut. Un élément désigné à un
 *   collaborateur ou suivi sur tout le cabinet ne fait pas exception ; un élément du cabinet (sans mandat) n'est jamais
 *   écarté. Exception pour Prospect : ci-dessous (F32).
 * - Décision du 20/11/2026 (partie C, F32) : « Prospect » seulement tant qu'aucune ordonnance n'a désigné le cabinet
 *   (simple sollicitation). Un mandat judiciaire « Prospect » dont l'appelant donne la date de l'ordonnance
 *   (ordonnanceLe) reste SUIVI (portefeuille, « à faire », balance âgée, demandes, échéances du portefeuille, rappels et
 *   réponses de Fixy) et une anomalie le signale (prospect_ordonnance_datee), car des délais légaux courent dès la
 *   décision (textes cités par la décision) : portée à la connaissance des copropriétaires dans le mois de son prononcé
 *   (D. 1967 art. 62-5), rapport intermédiaire au plus tard à l'issue des six premiers mois (L. 1965 art. 29-1, I,
 *   al. 3), délais fixés par l'ordonnance pour l'administrateur de l'art. 47 (D. 1967 art. 47). Sans date
 *   d'ordonnance, il reste hors suivi. Donnée : l'appelant passe ordonnanceLe (StatutDeMandat, AffectationMandat) ; les
 *   échéances du portefeuille et Fixy la lisent dans la vue (Date de Mandat.ordonnance ; une valeur qui n'est pas une
 *   Date vaut absence). Aucun champ ne distingue aujourd'hui une ordonnance saisie d'une valeur par défaut :
 *   Mandat.ordonnance est obligatoire au schéma (à voir avec l'écran de création).
 * - 🔵 En clôture reste SUIVI et visible (enCloture) : la mission prend fin, des diligences de sortie peuvent rester dues
 *   selon le régime (voir le droit ci-dessous). La 5e valeur, « En gestion, en clôture », reste une valeur CONNUE :
 *   suivie, lue comme une clôture en cours (enCloture), sans être convertie ; 🔴 à confirmer par Hugo (ci-dessous).
 * - Valeur inconnue (vide, casse ou libellé hors référentiel, états hérités de la maquette « En cours », « Échéance
 *   proche », « Prorogation demandée », « Notification en cours ») : jamais rejetée en silence. Le mandat reste SUIVI
 *   (on ne cache pas un mandat dont on ignore le statut) et une anomalie le signale (bilanStatutsMandats). Seuls les
 *   espaces superflus et la forme Unicode sont normalisés ; aucune correspondance n'est devinée.
 * - Statut non transmis (null ou absent, appelants antérieurs au point 55) : mandat suivi, sans anomalie.
 * - Un même mandat transmis avec deux statuts différents : anomalie, et le mandat reste suivi.
 * - Décision du 20/11/2026 (partie C, F33) : une balance âgée datée du passé compte les mandats qui n'étaient pas encore
 *   archivés à cette date, ce qui demande la date d'archivage (au minimum « archivé le », mieux l'historique daté des
 *   statuts). Aucun champ ne la porte aujourd'hui : paramètre explicite archiveLe (StatutDeMandat, AffectationMandat),
 *   lu par bilanStatutsMandats(mandats, { dateReference }) ; un mandat « Archivé » le lendemain de la date de référence
 *   ou plus tard y est encore compté, archivé ce jour-là ou avant, il ne l'est pas. Sans date d'archivage, le calcul
 *   actuel reste (mandat exclu) et balanceAgee écrit sous la balance « mandats archivés depuis : exclus »
 *   (mentionArchivesExclus, quand un dossier ouvert à la date est écarté ainsi). Le suivi du jour (portefeuille,
 *   « à faire », demandes, échéances, Fixy) lit le statut courant, sans date de référence. La date de fin de mission sert
 *   aussi à la règle des cinq ans (L. 1965 art. 29-1, IV).
 *
 * Droit (relevé Légifrance du 03/11/2026, loi n° 65-557 et décret n° 67-223 en vigueur à cette date) :
 * - AUCUN TEXTE ne définit un statut du mandat ni ne règle sa borne du suivi : recherches « statut du mandat »,
 *   « prospect », « en gestion », « fin de la mission » sans occurrence dans les deux textes. C'est une RÈGLE DE GESTION
 *   du cabinet, reprise du référentiel Gestéam.
 * - Pour situer « En clôture » seulement, régime par régime (aucun de ces textes ne règle le statut). 🔵 « En clôture »
 *   reste au suivi dans tous les régimes : des diligences de sortie sont écrites pour ap291 et sj ; pour ap47, aucune ne
 *   l'est, le mandat reste suivi par prudence (règle de gestion).
 * - « En clôture », administrateur provisoire de l'art. 29-1 (régime ap291) : la décision fixe la durée de la mission et
 *   le président du tribunal judiciaire peut y mettre fin (L. 1965 art. 29-1, I, al. 3) ; au compte rendu de fin de
 *   mission sont jointes les annexes comptables (D. 1967 art. 62-11, I, al. 2), les observations sont formulées dans le
 *   mois de leur réception (art. 62-11, III) ; à l'issue de la mission, le président du tribunal judiciaire arrête sa
 *   rémunération (art. 61-1-5, III). Ces textes ne visent que l'administrateur provisoire de l'art. 29-1 : l'art. 61-1-5,
 *   I le nomme, l'art. 62-11 relève de la procédure d'administration provisoire (D. 1967 art. 62-1 à 62-15).
 * - « En clôture », syndic désigné par le président du tribunal judiciaire (régime sj) : il administre la copropriété dans
 *   les conditions prévues par les art. 18 à 18-2 de la loi (D. 1967 art. 46, al. 3, en vigueur depuis le 01/01/2020) ;
 *   sa mission cesse de plein droit à l'acceptation de son mandat par le syndic désigné par l'assemblée générale
 *   (art. 46, al. 4). 🔵 Il est alors l'ancien syndic de l'art. 18-2 : à compter de la cessation de ses fonctions, il
 *   remet la situation de trésorerie, les références des comptes bancaires et les coordonnées de la banque dans les
 *   quinze jours, les documents et archives du syndicat dans le mois (L. 1965 art. 18-2, al. 1), avec un bordereau
 *   récapitulatif dont copie est remise au conseil syndical (D. 1967 art. 33-1), puis l'état des comptes des
 *   copropriétaires et du syndicat, après apurement et clôture, dans les deux mois suivant l'expiration de ce délai
 *   (L. 1965 art. 18-2, al. 2 ; lu, comme dans delais-legaux.ts, depuis le délai d'un mois, soit cessation + 3 mois ;
 *   lecture depuis les quinze jours à trancher).
 * - « En clôture », administrateur provisoire de l'art. 47 (régime ap47) : ses fonctions cessent de plein droit à
 *   l'acceptation de son mandat par le syndic désigné par l'assemblée générale (D. 1967 art. 47, al. 2) ; aucun texte
 *   lu ne lui impose de diligence de sortie. Aucun texte n'applique l'art. 18-2 à la SORTIE d'un administrateur
 *   provisoire (art. 29-1 ou 47) : l'art. 62-6, qui tient l'ancien syndic des obligations de l'art. 18-2 à son égard,
 *   joue à l'ENTRÉE de sa mission.
 * - Archivé ne retire le mandat que du suivi, rien n'est effacé : l'administrateur provisoire ne peut être désigné syndic
 *   de la copropriété dans les cinq ans de l'issue de sa mission (L. 1965 art. 29-1, IV), la date de fin de mission d'un
 *   mandat archivé doit donc rester lisible (fiche du mandat, hors de ce module).
 * - Décision du 20/11/2026 (partie C, F31) : aucune transition automatique ; VitFix propose, le responsable du mandat
 *   décide. « En gestion » → « En clôture » : proposé à la fin de la mission (proposerPassageEnCloture) : terme fixé par
 *   l'ordonnance atteint sans prorogation, ordonnance qui y met fin (L. 1965 art. 29-1, I, al. 3), ou acceptation de son
 *   mandat par le syndic élu (D. 1967 art. 46, al. 4 pour le syndic désigné par le juge ; art. 47, al. 2 pour
 *   l'administrateur de l'art. 47). « En clôture » → « Archivé » : seulement à la main, après la remise effective et pas
 *   seulement la fin des délais, avec une liste de contrôle propre au régime (listeControleArchivage,
 *   controlerPassageArchive) : administrateur de l'art. 29-1, compte rendu de fin de mission déposé avec ses annexes
 *   comptables (D. 1967 art. 62-11, I et II), délai d'observations d'un mois passé (art. 62-11, III : il court de la
 *   réception du compte rendu ; refusé sans compte rendu déposé, ou daté avant le lendemain d'un mois après le dépôt),
 *   ordonnance arrêtant la rémunération reçue (art. 61-1-5, III), fonds et documents remis au successeur ; syndic
 *   désigné par le juge : remises de l'art. 18-2 faites (trésorerie et banque sous quinze jours, documents et archives
 *   sous un mois, avec bordereau, D. 1967 art. 33-1 ; état des comptes dans les deux mois suivants) ; administrateur de
 *   l'art. 47 : fonds et documents remis au syndic élu. Aucun texte n'impose l'art. 18-2 à la sortie d'un administrateur
 *   provisoire : ses délais servent de simple rappel (echeanceImposee faux). La date de fin de mission doit être saisie
 *   avant l'archivage et reste lisible après (L. 1965 art. 29-1, IV). Données : la fin de mission, l'ordonnance qui y met
 *   fin, l'acceptation du syndic élu et les dates des remises sont des paramètres explicites, qu'aucune table
 *   n'enregistre aujourd'hui (écran : à voir).
 *
 * Branchements (les écrans et les modules en lecture seule ne sont pas modifiés ici) :
 * - Faits dans le domaine : portefeuille, selectionnerAFaire, balanceAgee et depuisDemandes (suivi-a-faire.ts) ;
 *   listerEcheancesPortefeuille (echeances-mandat.ts, portée « suivis » par défaut), donc les écrans Cockpit, Calendrier
 *   réglementaire et Obligations & échéances par use-echeances.ts ; calculerVeilleFixy (fixy/veille.ts), donc les rappels
 *   de Fixy (useFixy.ts) ; repondreDemandeFixy (fixy/reponses.ts), sans copropriété citée : échéances et débiteurs du
 *   portefeuille (« Qu'est-ce que j'ai à faire ? », « Quelles échéances sont en retard ? », « Qui sont les débiteurs ? »),
 *   dont une dernière ligne compte les copropriétés écartées. Une valeur absente ou inconnue garde le mandat partout.
 * - Restent sur tous les mandats, faute d'être des listes d'« à faire » : la recherche globale (recherche.ts, portée
 *   « tous »), la fiche 360 et les échéances d'une seule copropriété (calculerEcheancesCopropriete), la réponse de Fixy
 *   sur une copropriété citée (fiche, échéances, débiteurs, comptes) ou sur une personne, l'état des comptes demandé sans
 *   copropriété citée (il porte sur une seule copropriété, nommée dans le titre), les interventions de Fixy (ordres de
 *   service de démonstration, sans mandat), le tableau des honoraires (portée « tous » ; question 🔴 de l'en-tête de
 *   honoraires-tableau.ts).
 * - À brancher, écrans : PortefeuilleMandatsModule et ChargeCollaborateursModule (données de démonstration à ce jour)
 *   appliquent filtrerMandatsSuivis quand ils lisent la base et affichent ses anomalies ; l'appelant de
 *   selectionnerAFaire et de balanceAgee renseigne `statut: mandat.statut` dans chaque AffectationMandat.
 * - À brancher, relance-demandes.ts (point 46, lecture seule) : l'appelant de controlerPlafondAvantAttribution, de
 *   chargesEntreprises et d'alertesChargeEntreprises leur passe demandesDesMandatsSuivis(items, statuts), pour compter
 *   les demandes en cours comme depuisDemandes (sans quoi le suivi et l'attribution donnent deux comptes différents).
 *
 * 🔴 Non établi (questions) :
 * - Hugo : « En gestion, en clôture » est-elle encore employée au cabinet (non vue en tranche 41) ? VitFix la garde telle
 *   quelle, suivie et lue comme une clôture en cours ; faut-il plutôt la convertir en « En clôture » à l'import ?
 * - Frédéric et Hugo : `Mandat.statut` porte aujourd'hui des états d'affichage de la maquette (« En cours » à la création,
 *   db/donnees-store.ts ; démonstration, components/administrateur-judiciaire/data/coproprietes.ts), tous signalés
 *   inconnus ici. Faut-il un champ distinct pour le statut Gestéam, ou convertir ces états en « En gestion » ? (schéma et
 *   écrans : hors de ce module.)
 * - Hugo : faut-il refuser d'archiver un mandat qui a encore des dossiers ouverts (contentieux, sinistre) ou des demandes
 *   en cours, puisqu'ils sortent du suivi ? Aucun contrôle n'est codé.
 */

/** Statuts qui sortent le mandat du portefeuille, du suivi « à faire » et de la balance âgée. */
export const STATUTS_HORS_SUIVI: ReadonlySet<StatutMandat> = new Set<StatutMandat>(['Prospect', 'Archivé'])

/** Statuts d'un mandat dont la clôture est en cours : suivi, à afficher comme tel. */
export const STATUTS_EN_CLOTURE: ReadonlySet<StatutMandat> = new Set<StatutMandat>(['En clôture', 'En gestion, en clôture'])

export type LectureStatutMandat =
  | { etat: 'connu'; statut: StatutMandat; suivi: boolean; enCloture: boolean }
  /** Valeur hors référentiel (normalisée) : mandat suivi, à signaler. */
  | { etat: 'inconnu'; valeur: string; suivi: true; enCloture: false }
  /** Statut non transmis : mandat suivi, sans anomalie. */
  | { etat: 'absent'; suivi: true; enCloture: false }

const STATUTS_CONNUS: ReadonlyMap<string, StatutMandat> = new Map(STATUT_MANDAT.map((statut) => [normaliserEspaces(statut), statut]))

/** Lecture du statut avec la date de l'ordonnance qui a désigné le cabinet (décision du 20/11/2026, partie C, F32). */
export interface OptionsLectureStatut {
  /** Date ISO de l'ordonnance (mandat de justice) ; absente ou null : aucune ordonnance (simple sollicitation). */
  ordonnanceLe?: string | null
}

/** Une date d'ordonnance est donnée (et valide) ; une date mal formée est refusée. */
function ordonnanceDatee(ordonnanceLe: string | null | undefined): boolean {
  if (ordonnanceLe === null || ordonnanceLe === undefined) return false
  if (!estDateIsoValide(ordonnanceLe)) throw new Error(`Date de l'ordonnance invalide (${ordonnanceLe}) : AAAA-MM-JJ attendu.`)
  return true
}

/**
 * Lit la valeur libre de `Mandat.statut` : statut du référentiel, valeur inconnue (signalée) ou statut absent. F32 :
 * un « Prospect » dont la date de l'ordonnance est donnée est suivi.
 */
export function lireStatutMandat(valeur: string | null | undefined, { ordonnanceLe }: OptionsLectureStatut = {}): LectureStatutMandat {
  const datee = ordonnanceDatee(ordonnanceLe)
  if (valeur === null || valeur === undefined) return { etat: 'absent', suivi: true, enCloture: false }
  const normalisee = normaliserEspaces(valeur)
  const statut = STATUTS_CONNUS.get(normalisee)
  if (statut === undefined) return { etat: 'inconnu', valeur: normalisee, suivi: true, enCloture: false }
  const suivi = !STATUTS_HORS_SUIVI.has(statut) || (statut === 'Prospect' && datee)
  return { etat: 'connu', statut, suivi, enCloture: STATUTS_EN_CLOTURE.has(statut) }
}

/** Le mandat de ce statut est-il suivi ? Faux pour Prospect et Archivé ; vrai pour une valeur absente ou inconnue. */
export const estMandatSuivi = (statut: string | null | undefined): boolean => lireStatutMandat(statut).suivi

/**
 * Même question avec la date de l'ordonnance (F32) : un « Prospect » dont l'ordonnance est datée est suivi. Pour les
 * échéances du portefeuille et la veille de Fixy, qui lisent la vue de la copropriété.
 */
export const estMandatSuiviAvecOrdonnance = (statut: string | null | undefined, ordonnanceLe: string | null): boolean =>
  lireStatutMandat(statut, { ordonnanceLe }).suivi

/** « suivis » : sans les mandats Prospect ni Archivé ; « tous » : quel que soit le statut du mandat. */
export type PorteeStatuts = 'suivis' | 'tous'

/** Mandat et valeur libre de son statut (AffectationMandat du suivi, ou { mandatId: mandat.id, statut: mandat.statut }). */
export interface StatutDeMandat {
  mandatId: string
  statut?: string | null
  /** Date ISO de l'ordonnance qui a désigné le cabinet ; absente ou null : aucune (F32 : « Prospect » hors suivi). */
  ordonnanceLe?: string | null
  /** Date ISO d'archivage (« archivé le ») ; absente ou null : non enregistrée (F33 : exclu à toute date). */
  archiveLe?: string | null
}

export const MOTIFS_ANOMALIE_STATUT = ['valeur_inconnue', 'statuts_contradictoires', 'prospect_ordonnance_datee'] as const
export type MotifAnomalieStatut = (typeof MOTIFS_ANOMALIE_STATUT)[number]

export interface AnomalieStatutMandat {
  mandatId: string
  motif: MotifAnomalieStatut
  /** Valeurs lues (normalisées), dans l'ordre d'arrivée. */
  valeurs: string[]
  message: string
}

export interface BilanStatutsMandats {
  /** Mandats Prospect (sans ordonnance datée) ou Archivé, sans contradiction : hors portefeuille, hors suivi, hors balance âgée. */
  horsSuivi: Set<string>
  /** Mandats suivis dont la clôture est en cours (En clôture, En gestion, en clôture). */
  enCloture: Set<string>
  /** Valeurs inconnues, statuts contradictoires, « Prospect » dont l'ordonnance est datée : mandats gardés au suivi, à faire qualifier. */
  anomalies: AnomalieStatutMandat[]
  /** Mandats « Archivé » sans date d'archivage : exclus à toute date de référence (F33, mention sous la balance âgée). */
  archivesSansDate: Set<string>
}

/** Bilan à une date passée (balance âgée) : un mandat archivé après cette date y est encore compté (F33). */
export interface OptionsBilanStatuts {
  /** Date ISO de référence ; absente : statut courant (suivi du jour). */
  dateReference?: string
}

/**
 * Mention sous une balance âgée quand un mandat archivé sans date d'archivage en est écarté (décision du 20/11/2026,
 * partie C, F33 : « mandats archivés depuis : exclus »).
 */
export const mentionArchivesExclus = (dateReference: string): string =>
  `Mandats archivés depuis le ${dateIsoVersFr(dateReference)} : exclus (date d'archivage non enregistrée).`

const LISTE_STATUTS = STATUT_MANDAT.map((statut) => `« ${statut} »`).join(', ')

type MotifValeurLue = Exclude<MotifAnomalieStatut, 'prospect_ordonnance_datee'>

const messageAnomalie = (mandatId: string, motif: MotifValeurLue, valeurs: string[]): string =>
  motif === 'valeur_inconnue'
    ? `Mandat ${mandatId} : statut « ${valeurs[0]} » hors du référentiel (${LISTE_STATUTS}) ; mandat gardé au suivi, statut à qualifier.`
    : `Mandat ${mandatId} : statuts contradictoires (${valeurs.map((v) => `« ${v} »`).join(', ')}) ; mandat gardé au suivi, statut à qualifier.`

const anomalie = (mandatId: string, motif: MotifValeurLue, valeurs: string[]): AnomalieStatutMandat => ({
  mandatId,
  motif,
  valeurs,
  message: messageAnomalie(mandatId, motif, valeurs),
})

/** Décision du 20/11/2026 (partie C, F32) : « Prospect » dont l'ordonnance est datée, gardé au suivi. */
const anomalieProspect = (mandatId: string, ordonnanceLe: string): AnomalieStatutMandat => ({
  mandatId,
  motif: 'prospect_ordonnance_datee',
  valeurs: ['Prospect'],
  message: `Mandat ${mandatId} : « Prospect » alors que l'ordonnance du ${dateIsoVersFr(ordonnanceLe)} a désigné le cabinet ; mandat gardé au suivi (échéances du portefeuille, rappels de Fixy), statut à qualifier.`,
})

type LectureTransmise = Exclude<LectureStatutMandat, { etat: 'absent' }>

const valeurLue = (lecture: LectureTransmise): string => (lecture.etat === 'connu' ? lecture.statut : lecture.valeur)

/** Dates données pour un mandat : la première non nulle de ses lignes. */
interface ReperesMandat {
  ordonnanceLe: string | null
  archiveLe: string | null
}

function reperesParMandat(mandats: readonly StatutDeMandat[]): Map<string, ReperesMandat> {
  const reperes = new Map<string, ReperesMandat>()
  for (const { mandatId, ordonnanceLe, archiveLe } of mandats) {
    if (archiveLe !== null && archiveLe !== undefined && !estDateIsoValide(archiveLe))
      throw new Error(`Date d'archivage du mandat ${mandatId} invalide (${archiveLe}) : AAAA-MM-JJ attendu.`)
    const repere = reperes.get(mandatId) ?? { ordonnanceLe: null, archiveLe: null }
    repere.ordonnanceLe ??= ordonnanceLe ?? null
    repere.archiveLe ??= archiveLe ?? null
    reperes.set(mandatId, repere)
  }
  return reperes
}

/**
 * F33 : un mandat hors suivi l'est à la date de référence, sauf un « Archivé » dont l'archivage est postérieur à cette
 * date ; un « Archivé » sans date d'archivage est exclu et noté (archivesSansDate).
 */
function rangerHorsSuivi(bilan: BilanStatutsMandats, mandatId: string, statut: StatutMandat, archiveLe: string | null, dateReference: string | null): void {
  if (statut === 'Archivé' && archiveLe === null) bilan.archivesSansDate.add(mandatId)
  const pasEncoreArchive = statut === 'Archivé' && archiveLe !== null && dateReference !== null && archiveLe > dateReference
  if (!pasEncoreArchive) bilan.horsSuivi.add(mandatId)
}

/** Lectures par mandat, une par valeur (normalisée), dans l'ordre d'arrivée ; les statuts absents n'y sont pas. */
function lecturesParMandat(mandats: readonly StatutDeMandat[], reperes: ReadonlyMap<string, ReperesMandat>): Map<string, Map<string, LectureTransmise>> {
  const parMandat = new Map<string, Map<string, LectureTransmise>>()
  for (const { mandatId, statut } of mandats) {
    const lecture = lireStatutMandat(statut, reperes.get(mandatId))
    if (lecture.etat === 'absent') continue
    const lectures = parMandat.get(mandatId) ?? new Map<string, LectureTransmise>()
    if (!lectures.has(valeurLue(lecture))) lectures.set(valeurLue(lecture), lecture)
    parMandat.set(mandatId, lectures)
  }
  return parMandat
}

/**
 * Lit le statut de chaque mandat transmis : mandats hors suivi (Prospect sans ordonnance datée, Archivé), mandats en
 * clôture, anomalies (valeur inconnue, deux statuts différents pour le même mandat, « Prospect » dont l'ordonnance est
 * datée : F32). Un mandat en anomalie reste suivi. Avec une date de référence (F33), un mandat archivé après elle
 * (archiveLe) n'est pas hors suivi à cette date.
 */
export function bilanStatutsMandats(mandats: readonly StatutDeMandat[], { dateReference }: OptionsBilanStatuts = {}): BilanStatutsMandats {
  if (dateReference !== undefined && !estDateIsoValide(dateReference))
    throw new Error(`Date de référence invalide (${dateReference}) : AAAA-MM-JJ attendu.`)
  const bilan: BilanStatutsMandats = { horsSuivi: new Set(), enCloture: new Set(), anomalies: [], archivesSansDate: new Set() }
  const reperes = reperesParMandat(mandats)
  for (const [mandatId, parValeur] of lecturesParMandat(mandats, reperes)) {
    const [lecture, ...autres] = parValeur.values()
    const { ordonnanceLe, archiveLe } = reperes.get(mandatId) ?? { ordonnanceLe: null, archiveLe: null }
    if (autres.length > 0) bilan.anomalies.push(anomalie(mandatId, 'statuts_contradictoires', [...parValeur.keys()]))
    else if (lecture.etat === 'inconnu') bilan.anomalies.push(anomalie(mandatId, 'valeur_inconnue', [lecture.valeur]))
    else if (lecture.statut === 'Prospect' && ordonnanceLe !== null) bilan.anomalies.push(anomalieProspect(mandatId, ordonnanceLe))
    else if (!lecture.suivi) rangerHorsSuivi(bilan, mandatId, lecture.statut, archiveLe, dateReference ?? null)
    else if (lecture.enCloture) bilan.enCloture.add(mandatId)
  }
  return bilan
}

/** Élément ou dossier d'un mandat hors suivi (Prospect, Archivé) ; un élément du cabinet (sans mandat) n'en est jamais. */
export const mandatHorsSuivi = (mandatId: string | null, horsSuivi: ReadonlySet<string>): boolean =>
  mandatId !== null && horsSuivi.has(mandatId)

/**
 * Demandes rattachées à un mandat suivi ou à aucun mandat : celles d'un mandat Prospect ou Archivé sont écartées. Même
 * filtre pour le suivi (suivi-a-faire.depuisDemandes) et pour l'appelant de relance-demandes.ts
 * (controlerPlafondAvantAttribution, chargesEntreprises) : le plafond d'une entreprise se compte de la même façon partout.
 * Ordre conservé ; sans statut transmis, rien n'est écarté.
 */
export function demandesDesMandatsSuivis<T extends { demande: { mandatId: string | null } }>(
  items: readonly T[],
  statutsMandats: readonly StatutDeMandat[],
): T[] {
  const { horsSuivi } = bilanStatutsMandats(statutsMandats)
  return items.filter((item) => !mandatHorsSuivi(item.demande.mandatId, horsSuivi))
}

/**
 * Mandats que l'écran du portefeuille garde : tous sauf Prospect (sans ordonnance datée, F32) et Archivé ; les anomalies
 * sont à afficher.
 */
export function filtrerMandatsSuivis<T extends { id: string; statut?: string | null; ordonnanceLe?: string | null }>(
  mandats: readonly T[],
): { suivis: T[]; horsSuivi: T[]; anomalies: AnomalieStatutMandat[] } {
  const { horsSuivi, anomalies } = bilanStatutsMandats(mandats.map((m) => ({ mandatId: m.id, statut: m.statut, ordonnanceLe: m.ordonnanceLe })))
  return {
    suivis: mandats.filter((m) => !horsSuivi.has(m.id)),
    horsSuivi: mandats.filter((m) => horsSuivi.has(m.id)),
    anomalies,
  }
}

// ─── Passages « En clôture » et « Archivé » (décision du 20/11/2026, partie C, F31) ─────────────

function verifierDateIso(valeur: string, quoi: string): void {
  if (!estDateIsoValide(valeur)) throw new Error(`${quoi} invalide (${valeur}) : AAAA-MM-JJ attendu.`)
}

const verifierDateFacultative = (valeur: string | null | undefined, quoi: string): void => {
  if (valeur !== null && valeur !== undefined) verifierDateIso(valeur, quoi)
}

/** Faits qui mettent fin à la mission : terme de l'ordonnance, ordonnance qui y met fin, acceptation du syndic élu. */
export const MOTIFS_FIN_MISSION = ['terme_atteint', 'ordonnance_fin_mission', 'acceptation_syndic_elu'] as const
export type MotifFinMission = (typeof MOTIFS_FIN_MISSION)[number]

const LIBELLES_FIN_MISSION: Readonly<Record<MotifFinMission, string>> = {
  terme_atteint: "terme fixé par l'ordonnance atteint, sans prorogation",
  ordonnance_fin_mission: 'ordonnance qui met fin à la mission',
  acceptation_syndic_elu: 'acceptation de son mandat par le syndic élu',
}

/** Texte qui fixe la durée de la mission selon le régime. */
const FONDEMENT_DUREE_MISSION: Readonly<Record<Regime, string>> = {
  sj: 'D. 1967 art. 46',
  ap47: 'D. 1967 art. 47',
  ap291: 'L. 1965 art. 29-1, I, al. 3',
}

/** Fin de plein droit à l'acceptation du syndic élu : syndic désigné par le juge et administrateur de l'art. 47 seulement. */
const FONDEMENT_ACCEPTATION_SYNDIC_ELU: Readonly<Partial<Record<Regime, string>>> = {
  sj: 'D. 1967 art. 46, al. 4',
  ap47: 'D. 1967 art. 47, al. 2',
}

const FONDEMENT_ORDONNANCE_INCONNU = 'ordonnance de désignation (régime du mandat inconnu)'

/** Terme atteint ou ordonnance qui met fin : texte de la mission du régime ; acceptation du syndic élu : art. 46 ou 47. */
function fondementFinMission(motif: MotifFinMission, regime: Regime | null): string {
  if (regime === null) return FONDEMENT_ORDONNANCE_INCONNU
  if (motif === 'acceptation_syndic_elu') return FONDEMENT_ACCEPTATION_SYNDIC_ELU[regime] ?? FONDEMENT_DUREE_MISSION[regime]
  return FONDEMENT_DUREE_MISSION[regime]
}

export interface EntreeFinMission {
  /** Valeur libre de `Mandat.statut`. */
  statut: string | null | undefined
  /** Régime du mandat de justice ; null : inconnu. */
  regime: Regime | null
  /** Terme de la mission fixé par l'ordonnance, prorogations comprises ; null : non saisi. */
  termeMissionLe: string | null
  /** Ordonnance qui met fin à la mission (L. 1965 art. 29-1, I, al. 3) ; absente ou null : aucune. */
  ordonnanceFinMissionLe?: string | null
  /** Acceptation de son mandat par le syndic élu (D. 1967 art. 46, al. 4 ; art. 47, al. 2) ; absente ou null : aucune. */
  acceptationSyndicEluLe?: string | null
}

export interface PropositionEnCloture {
  statutPropose: 'En clôture'
  motif: MotifFinMission
  /** Date de fin de la mission : à garder lisible, y compris après l'archivage (L. 1965 art. 29-1, IV). */
  finMissionLe: string
  fondement: string
  message: string
}

function verifierEntreeFinMission(entree: EntreeFinMission, aujourdhui: string): void {
  verifierDateIso(aujourdhui, 'Date du jour')
  verifierDateFacultative(entree.termeMissionLe, 'Date du terme de la mission')
  verifierDateFacultative(entree.ordonnanceFinMissionLe, "Date de l'ordonnance qui met fin à la mission")
  verifierDateFacultative(entree.acceptationSyndicEluLe, "Date d'acceptation du syndic élu")
  const acceptation = entree.acceptationSyndicEluLe ?? null
  if (acceptation !== null && (entree.regime === null || FONDEMENT_ACCEPTATION_SYNDIC_ELU[entree.regime] === undefined))
    throw new Error(
      "Acceptation du syndic élu : elle met fin de plein droit à la mission du syndic désigné par le juge (D. 1967 art. 46, al. 4) ou de l'administrateur de l'art. 47 (art. 47, al. 2) seulement.",
    )
}

/** « En clôture » se propose depuis « En gestion », ou un statut inconnu ou absent ; jamais depuis Prospect, En clôture ou Archivé. */
function peutPasserEnCloture(statut: string | null | undefined): boolean {
  const lecture = lireStatutMandat(statut)
  return lecture.etat !== 'connu' || lecture.statut === 'En gestion'
}

/**
 * Décision du 20/11/2026 (partie C, F31) : propose « En clôture » quand la mission a pris fin au jour du contrôle (le
 * plus tôt des faits datés au plus tard ce jour) ; null : rien à proposer. Aucun passage n'est appliqué : le responsable
 * du mandat décide.
 */
export function proposerPassageEnCloture(entree: EntreeFinMission, aujourdhui: string): PropositionEnCloture | null {
  verifierEntreeFinMission(entree, aujourdhui)
  if (!peutPasserEnCloture(entree.statut)) return null
  const faits: [MotifFinMission, string | null][] = [
    ['terme_atteint', entree.termeMissionLe],
    ['ordonnance_fin_mission', entree.ordonnanceFinMissionLe ?? null],
    ['acceptation_syndic_elu', entree.acceptationSyndicEluLe ?? null],
  ]
  const echus = faits.filter((fait): fait is [MotifFinMission, string] => fait[1] !== null && fait[1] <= aujourdhui)
  if (echus.length === 0) return null
  const [motif, finMissionLe] = echus.reduce((a, b) => (b[1] < a[1] ? b : a))
  return {
    statutPropose: 'En clôture',
    motif,
    finMissionLe,
    fondement: fondementFinMission(motif, entree.regime),
    message: `Fin de la mission le ${dateIsoVersFr(finMissionLe)} (${LIBELLES_FIN_MISSION[motif]}) : passage à « En clôture » proposé ; le responsable du mandat décide, aucun passage n'est automatique.`,
  }
}

/** Points de la liste de contrôle avant « Archivé », par régime. */
export const CONTROLES_ARCHIVAGE = [
  'compte_rendu_fin_mission',
  'delai_observations',
  'remuneration_arretee',
  'fonds_documents_successeur',
  'tresorerie_banque',
  'documents_archives',
  'etat_comptes',
  'fonds_documents_syndic_elu',
] as const
export type ControleArchivage = (typeof CONTROLES_ARCHIVAGE)[number]

interface DefinitionControleArchivage {
  libelle: string
  fondement: string
  /** Délai compté depuis la fin de mission ; imposé (syndic désigné par le juge) ou simple rappel ; null : aucun. */
  delai: { nombre: number; unite: 'jours' | 'mois'; impose: boolean } | null
}

const RAPPEL_18_2 = "aucun texte n'impose l'art. 18-2 à sa sortie : délais de L. 1965 art. 18-2, al. 1 en simple rappel"

const DEFINITIONS_CONTROLES_ARCHIVAGE: Readonly<Record<ControleArchivage, DefinitionControleArchivage>> = {
  compte_rendu_fin_mission: {
    libelle: 'Compte rendu de fin de mission déposé, avec ses annexes comptables',
    fondement: 'D. 1967 art. 62-11, I et II',
    delai: null,
  },
  delai_observations: {
    libelle: "Délai d'observations d'un mois sur le compte rendu de fin de mission passé",
    fondement: 'D. 1967 art. 62-11, III',
    delai: null,
  },
  remuneration_arretee: {
    libelle: "Ordonnance arrêtant la rémunération de l'administrateur provisoire reçue",
    fondement: 'D. 1967 art. 61-1-5, III',
    delai: null,
  },
  fonds_documents_successeur: {
    libelle: 'Fonds et documents remis au successeur',
    fondement: `Administrateur provisoire de l'art. 29-1 : ${RAPPEL_18_2}`,
    delai: { nombre: 15, unite: 'jours', impose: false },
  },
  tresorerie_banque: {
    libelle: 'Situation de trésorerie, références des comptes bancaires et coordonnées de la banque remises (quinze jours)',
    fondement: 'L. 1965 art. 18-2, al. 1',
    delai: { nombre: 15, unite: 'jours', impose: true },
  },
  documents_archives: {
    libelle: 'Documents et archives du syndicat remis (un mois), avec un bordereau récapitulatif dont copie au conseil syndical',
    fondement: 'L. 1965 art. 18-2, al. 1 ; D. 1967 art. 33-1',
    delai: { nombre: 1, unite: 'mois', impose: true },
  },
  etat_comptes: {
    // Deux mois suivant le délai d'un mois, comme delais-legaux.ts : fin de mission + 3 mois
    libelle: 'État des comptes des copropriétaires et du syndicat, après apurement et clôture, remis (deux mois suivants)',
    fondement: 'L. 1965 art. 18-2, al. 2',
    delai: { nombre: 3, unite: 'mois', impose: true },
  },
  fonds_documents_syndic_elu: {
    libelle: 'Fonds et documents remis au syndic élu',
    fondement: `D. 1967 art. 47, al. 2 ; ${RAPPEL_18_2}`,
    delai: { nombre: 15, unite: 'jours', impose: false },
  },
}

const CONTROLES_PAR_REGIME: Readonly<Record<Regime, readonly ControleArchivage[]>> = {
  ap291: ['compte_rendu_fin_mission', 'delai_observations', 'remuneration_arretee', 'fonds_documents_successeur'],
  sj: ['tresorerie_banque', 'documents_archives', 'etat_comptes'],
  ap47: ['fonds_documents_syndic_elu'],
}

export interface PointControleArchivage {
  code: ControleArchivage
  libelle: string
  fondement: string
  /** Date de la remise, du dépôt ou de la réception effective ; null : pas encore faite. */
  faitLe: string | null
  /** Échéance comptée depuis la fin de mission ; null : aucun délai, ou fin de mission inconnue. */
  echeanceLe: string | null
  /** Échéance imposée par le texte (syndic désigné par le juge) ; faux : aucune, ou simple rappel. */
  echeanceImposee: boolean
}

/** Liste de contrôle du régime, sans dates (F31). */
export const listeControleArchivage = (regime: Regime): Omit<PointControleArchivage, 'faitLe' | 'echeanceLe'>[] =>
  CONTROLES_PAR_REGIME[regime].map((code) => {
    const { libelle, fondement, delai } = DEFINITIONS_CONTROLES_ARCHIVAGE[code]
    return { code, libelle, fondement, echeanceImposee: delai?.impose ?? false }
  })

export const MOTIFS_REFUS_ARCHIVAGE = ['pas_en_cloture', 'fin_mission_inconnue', 'regime_inconnu', 'controle_non_fait'] as const
export type MotifRefusArchivage = (typeof MOTIFS_REFUS_ARCHIVAGE)[number]

export interface EntreeArchivage {
  /** Valeur libre de `Mandat.statut`. */
  statut: string | null | undefined
  /** Régime du mandat de justice ; null : inconnu. */
  regime: Regime | null
  /** Date de fin de la mission ; null : non saisie. */
  finMissionLe: string | null
  /** Points faits, avec la date de la remise, du dépôt ou de la réception effective ; absent : non fait. */
  faits?: Partial<Record<ControleArchivage, string>>
}

export interface ControleAvantArchivage {
  /** Rien ne s'oppose à l'archivage, qui reste une décision prise à la main par le responsable du mandat. */
  archivable: boolean
  regime: Regime | null
  /** Date de fin de mission, lisible après l'archivage (L. 1965 art. 29-1, IV). */
  finMissionLe: string | null
  points: PointControleArchivage[]
  /** Ce qui empêche d'archiver ; vide : archivable. */
  motifs: { code: MotifRefusArchivage; message: string }[]
}

function verifierEntreeArchivage({ regime, finMissionLe, faits = {} }: EntreeArchivage, aujourdhui: string): void {
  verifierDateIso(aujourdhui, 'Date du jour')
  verifierDateFacultative(finMissionLe, 'Date de fin de mission')
  const prevus: readonly ControleArchivage[] = regime === null ? [] : CONTROLES_PAR_REGIME[regime]
  for (const [code, faitLe] of Object.entries(faits) as [ControleArchivage, string][]) {
    if (!prevus.includes(code)) throw new Error(`Point de contrôle « ${code} » sans objet pour le régime ${regime ?? 'inconnu'}.`)
    verifierDateIso(faitLe, `Date du point « ${code} »`)
    if (faitLe > aujourdhui)
      throw new Error(`Point « ${code} » daté du ${dateIsoVersFr(faitLe)}, après le jour du contrôle : la remise n'est pas encore effective.`)
  }
  verifierDelaiObservations(faits)
}

/**
 * F31 : le délai d'observations d'un mois court de la réception du compte rendu de fin de mission (D. 1967 art. 62-11,
 * III), qui suit son dépôt : il n'est pas passé sans compte rendu déposé, ni avant le lendemain d'un mois après le dépôt.
 */
function verifierDelaiObservations(faits: Partial<Record<ControleArchivage, string>>): void {
  const passeLe = faits.delai_observations
  if (passeLe === undefined) return
  const prefixe = `Délai d'observations (D. 1967 art. 62-11, III) dit passé le ${dateIsoVersFr(passeLe)}`
  const depot = faits.compte_rendu_fin_mission
  if (depot === undefined)
    throw new Error(`${prefixe}, sans compte rendu de fin de mission déposé : il court de la réception de ce compte rendu.`)
  const auPlusTot = ajouterJours(ajouterMois(depot, 1), 1)
  if (passeLe < auPlusTot)
    throw new Error(
      `${prefixe} : il court d'un mois à compter de la réception du compte rendu de fin de mission, déposé le ${dateIsoVersFr(depot)}, et n'est pas passé avant le ${dateIsoVersFr(auPlusTot)}.`,
    )
}

function echeanceDepuisFin(finMissionLe: string | null, delai: DefinitionControleArchivage['delai']): string | null {
  if (finMissionLe === null || delai === null) return null
  return delai.unite === 'jours' ? ajouterJours(finMissionLe, delai.nombre) : ajouterMois(finMissionLe, delai.nombre)
}

function motifsRefusArchivage(entree: EntreeArchivage, points: readonly PointControleArchivage[]): ControleAvantArchivage['motifs'] {
  const motifs: ControleAvantArchivage['motifs'] = []
  if (!lireStatutMandat(entree.statut).enCloture)
    motifs.push({ code: 'pas_en_cloture', message: `Statut « ${entree.statut ?? 'non transmis'} » : « Archivé » ne se décide qu'après « En clôture ».` })
  if (entree.finMissionLe === null)
    motifs.push({
      code: 'fin_mission_inconnue',
      message:
        "Date de fin de mission à saisir : elle reste lisible après l'archivage (L. 1965 art. 29-1, IV : l'administrateur provisoire ne peut être désigné syndic de la copropriété dans les cinq ans de l'issue de sa mission).",
    })
  if (entree.regime === null) motifs.push({ code: 'regime_inconnu', message: 'Régime du mandat inconnu : liste de contrôle avant archivage non établie.' })
  const aFaire = points.filter((p) => p.faitLe === null).map((p) => p.libelle)
  if (aFaire.length > 0)
    motifs.push({
      code: 'controle_non_fait',
      message: `Points à faire avant « Archivé » (remise effective, pas seulement la fin des délais) : ${aFaire.join(' ; ')}.`,
    })
  return motifs
}

/**
 * Décision du 20/11/2026 (partie C, F31) : liste de contrôle avant « Archivé », propre au régime, chaque point fait à la
 * date de sa remise effective (l'expiration d'un délai ne suffit pas). Archivable : mandat en clôture, date de fin de
 * mission saisie, régime connu, chaque point fait. Rien n'est appliqué : l'archivage reste une décision à la main.
 */
export function controlerPassageArchive(entree: EntreeArchivage, aujourdhui: string): ControleAvantArchivage {
  verifierEntreeArchivage(entree, aujourdhui)
  const codes = entree.regime === null ? [] : CONTROLES_PAR_REGIME[entree.regime]
  const points = codes.map((code): PointControleArchivage => {
    const { libelle, fondement, delai } = DEFINITIONS_CONTROLES_ARCHIVAGE[code]
    return {
      code,
      libelle,
      fondement,
      faitLe: entree.faits?.[code] ?? null,
      echeanceLe: echeanceDepuisFin(entree.finMissionLe, delai),
      echeanceImposee: delai?.impose ?? false,
    }
  })
  const motifs = motifsRefusArchivage(entree, points)
  return { archivable: motifs.length === 0, regime: entree.regime, finMissionLe: entree.finMissionLe, points, motifs }
}
