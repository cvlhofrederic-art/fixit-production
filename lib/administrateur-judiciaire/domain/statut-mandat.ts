import { normaliserEspaces } from '@/lib/administrateur-judiciaire/domain/texte'
import { STATUT_MANDAT, type StatutMandat } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Statut du mandat (point 55 du bilan 2) : lecture typée de la valeur libre `Mandat.statut` sur le référentiel
 * STATUT_MANDAT, et borne du portefeuille, du suivi « à faire » et de la balance âgée (suivi-a-faire.ts). Fonctions
 * pures, sans date, sans écran ni table : db/schema.ts garde `statut: string`, ce module le lit.
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
 *   écarté.
 * - 🔵 En clôture reste SUIVI et visible (enCloture) : la mission prend fin, des diligences de sortie peuvent rester dues
 *   selon le régime (voir le droit ci-dessous). La 5e valeur, « En gestion, en clôture », reste une valeur CONNUE :
 *   suivie, lue comme une clôture en cours (enCloture), sans être convertie ; 🔴 à confirmer par Hugo (ci-dessous).
 * - Valeur inconnue (vide, casse ou libellé hors référentiel, états hérités de la maquette « En cours », « Échéance
 *   proche », « Prorogation demandée », « Notification en cours ») : jamais rejetée en silence. Le mandat reste SUIVI
 *   (on ne cache pas un mandat dont on ignore le statut) et une anomalie le signale (bilanStatutsMandats). Seuls les
 *   espaces superflus et la forme Unicode sont normalisés ; aucune correspondance n'est devinée.
 * - Statut non transmis (null ou absent, appelants antérieurs au point 55) : mandat suivi, sans anomalie.
 * - Un même mandat transmis avec deux statuts différents : anomalie, et le mandat reste suivi.
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
 * - Hugo : quand un mandat passe-t-il « En clôture » puis « Archivé » (fin de la mission, dépôt du compte rendu de fin
 *   de mission, ordonnance arrêtant la rémunération, remise des archives) ? Aucun texte ne date l'archivage ; aucune
 *   transition n'est codée. Seul repère légal daté, pour le syndic désigné par le juge : les délais de remise de
 *   l'art. 18-2 (quinze jours, un mois, puis deux mois suivants, à compter de la cessation des fonctions) ; faut-il
 *   attendre leur expiration, ou la remise effective, avant d'archiver, et s'en servir aussi pour un administrateur
 *   provisoire, qu'aucun texte n'y soumet à sa sortie ?
 * - Hugo : un mandat judiciaire peut-il être « Prospect » au cabinet (ordonnance reçue, mission pas encore acceptée) ? Si
 *   oui, ses échéances légales doivent-elles rester au suivi ? VitFix applique la règle du bilan : il sort du suivi, des
 *   échéances du portefeuille et des rappels de Fixy (branchements ci-dessus).
 * - Hugo : une balance âgée datée du passé doit-elle encore compter un mandat archivé depuis ? Le statut n'a pas
 *   d'historique (seul le statut courant est lu) : il n'est plus compté.
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

/** Lit la valeur libre de `Mandat.statut` : statut du référentiel, valeur inconnue (signalée) ou statut absent. */
export function lireStatutMandat(valeur: string | null | undefined): LectureStatutMandat {
  if (valeur === null || valeur === undefined) return { etat: 'absent', suivi: true, enCloture: false }
  const normalisee = normaliserEspaces(valeur)
  const statut = STATUTS_CONNUS.get(normalisee)
  if (statut === undefined) return { etat: 'inconnu', valeur: normalisee, suivi: true, enCloture: false }
  return { etat: 'connu', statut, suivi: !STATUTS_HORS_SUIVI.has(statut), enCloture: STATUTS_EN_CLOTURE.has(statut) }
}

/** Le mandat de ce statut est-il suivi ? Faux pour Prospect et Archivé ; vrai pour une valeur absente ou inconnue. */
export const estMandatSuivi = (statut: string | null | undefined): boolean => lireStatutMandat(statut).suivi

/** « suivis » : sans les mandats Prospect ni Archivé ; « tous » : quel que soit le statut du mandat. */
export type PorteeStatuts = 'suivis' | 'tous'

/** Mandat et valeur libre de son statut (AffectationMandat du suivi, ou { mandatId: mandat.id, statut: mandat.statut }). */
export interface StatutDeMandat {
  mandatId: string
  statut?: string | null
}

export const MOTIFS_ANOMALIE_STATUT = ['valeur_inconnue', 'statuts_contradictoires'] as const
export type MotifAnomalieStatut = (typeof MOTIFS_ANOMALIE_STATUT)[number]

export interface AnomalieStatutMandat {
  mandatId: string
  motif: MotifAnomalieStatut
  /** Valeurs lues (normalisées), dans l'ordre d'arrivée. */
  valeurs: string[]
  message: string
}

export interface BilanStatutsMandats {
  /** Mandats Prospect ou Archivé, sans contradiction : hors portefeuille, hors suivi, hors balance âgée. */
  horsSuivi: Set<string>
  /** Mandats suivis dont la clôture est en cours (En clôture, En gestion, en clôture). */
  enCloture: Set<string>
  /** Valeurs inconnues et statuts contradictoires : mandats gardés au suivi, à faire qualifier. */
  anomalies: AnomalieStatutMandat[]
}

const LISTE_STATUTS = STATUT_MANDAT.map((statut) => `« ${statut} »`).join(', ')

const messageAnomalie = (mandatId: string, motif: MotifAnomalieStatut, valeurs: string[]): string =>
  motif === 'valeur_inconnue'
    ? `Mandat ${mandatId} : statut « ${valeurs[0]} » hors du référentiel (${LISTE_STATUTS}) ; mandat gardé au suivi, statut à qualifier.`
    : `Mandat ${mandatId} : statuts contradictoires (${valeurs.map((v) => `« ${v} »`).join(', ')}) ; mandat gardé au suivi, statut à qualifier.`

const anomalie = (mandatId: string, motif: MotifAnomalieStatut, valeurs: string[]): AnomalieStatutMandat => ({
  mandatId,
  motif,
  valeurs,
  message: messageAnomalie(mandatId, motif, valeurs),
})

type LectureTransmise = Exclude<LectureStatutMandat, { etat: 'absent' }>

const valeurLue = (lecture: LectureTransmise): string => (lecture.etat === 'connu' ? lecture.statut : lecture.valeur)

/** Lectures par mandat, une par valeur (normalisée), dans l'ordre d'arrivée ; les statuts absents n'y sont pas. */
function lecturesParMandat(mandats: readonly StatutDeMandat[]): Map<string, Map<string, LectureTransmise>> {
  const parMandat = new Map<string, Map<string, LectureTransmise>>()
  for (const { mandatId, statut } of mandats) {
    const lecture = lireStatutMandat(statut)
    if (lecture.etat === 'absent') continue
    const lectures = parMandat.get(mandatId) ?? new Map<string, LectureTransmise>()
    if (!lectures.has(valeurLue(lecture))) lectures.set(valeurLue(lecture), lecture)
    parMandat.set(mandatId, lectures)
  }
  return parMandat
}

/**
 * Lit le statut de chaque mandat transmis : mandats hors suivi (Prospect, Archivé), mandats en clôture, anomalies
 * (valeur inconnue, ou deux statuts différents pour le même mandat). Un mandat en anomalie reste suivi.
 */
export function bilanStatutsMandats(mandats: readonly StatutDeMandat[]): BilanStatutsMandats {
  const bilan: BilanStatutsMandats = { horsSuivi: new Set(), enCloture: new Set(), anomalies: [] }
  for (const [mandatId, parValeur] of lecturesParMandat(mandats)) {
    const [lecture, ...autres] = parValeur.values()
    if (autres.length > 0) bilan.anomalies.push(anomalie(mandatId, 'statuts_contradictoires', [...parValeur.keys()]))
    else if (lecture.etat === 'inconnu') bilan.anomalies.push(anomalie(mandatId, 'valeur_inconnue', [lecture.valeur]))
    else if (!lecture.suivi) bilan.horsSuivi.add(mandatId)
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

/** Mandats que l'écran du portefeuille garde : tous sauf Prospect et Archivé ; les anomalies sont à afficher. */
export function filtrerMandatsSuivis<T extends { id: string; statut?: string | null }>(
  mandats: readonly T[],
): { suivis: T[]; horsSuivi: T[]; anomalies: AnomalieStatutMandat[] } {
  const { horsSuivi, anomalies } = bilanStatutsMandats(mandats.map((m) => ({ mandatId: m.id, statut: m.statut })))
  return {
    suivis: mandats.filter((m) => !horsSuivi.has(m.id)),
    horsSuivi: mandats.filter((m) => horsSuivi.has(m.id)),
    anomalies,
  }
}
