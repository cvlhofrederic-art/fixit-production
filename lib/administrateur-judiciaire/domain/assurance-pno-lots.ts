import { dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { OCCUPATIONS_LOT, type FicheLot, type OccupationLot } from '@/lib/administrateur-judiciaire/domain/fiche-lot'
import { normaliserEspaces } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Assurance propriétaire non occupant (PNO) des lots (point 71 du bilan 2) : statut et échéance de l'assurance d'un
 * lot, contrôle des attestations et alerte d'échéance (branchée au suivi « à faire » par
 * suivi-a-faire.depuisAssurancesPno). Fonctions pures, dates AAAA-MM-JJ, sans écran ni table, sans donnée personnelle
 * (identifiant et n° du lot seulement). db/schema.ts n'est pas modifié : `AssurancePnoLot` est un type du domaine.
 *
 * Sources Gestéam :
 * - 🟢 Tranche 43 § 17 (`Gestion → Mandats`, recherche de mandats) : sélecteur PNO « Sélectionnez le statut des lots » :
 *   Cabinet · Extérieure · Sans échéance · Extérieure + sans contrat · Pas de PNO, avec une Échéance. 🔵 Lecture de la
 *   tranche : souscrite par le cabinet, extérieure (attestation fournie), sans échéance connue, extérieure sans contrat,
 *   ou absente. Apport retenu par la tranche : `Lot.assurancePno { statut, echeance }` pour le contrôle des attestations.
 * - 🟢 Tranche 16 § 3 (recherche de mandats) : critère « PNO + Échéance » (🔵 la tranche y lisait un suivi au niveau du
 *   mandat, champ non déroulé). Tranche 37 § Lots : critères de recherche « PNO, Échéance » des lots ; fiche lot, onglet
 *   Charges et équipements : « Échéance PNO » (déjà dans fiche-lot.ts : `echeancePno`). La tranche 43 situe le statut
 *   sur les lots (« statut des lots »).
 * - 🟢 Tranche 38 (onglet Réglage du suivi) : aucun critère PNO dans les blocs du syndic ; seul le bloc « Baux »
 *   (gérance) suit des « Attestations Assurance ». 🔵 La famille « lots » du suivi VitFix est donc un AJOUT.
 *
 * Saisie : statut et échéance sont les valeurs brutes saisies ou reprises (chaînes, comme AffectationMandat.statut) ; le
 * statut est lu par lireStatutPno. Une clé absente (reprise, futur `Lot.assurancePno`) vaut null : non renseignée.
 *
 * Règles du module (contrôle d'un lot, une alerte au plus), dans cet ordre, la première qui s'applique l'emporte :
 * 1. « Pas de PNO » : aucun contrôle (rien à contrôler), même avec une échéance saisie, lisible ou non ; le lot figure
 *    au bilan (bilanAssurancesPno), sans être qualifié de manquement (décision du 20/11/2026, partie C, F55 : seule une
 *    alerte non bloquante, alertesPnoLotsNonOccupes, pour un lot connu comme loué ou vacant), et l'échéance saisie y est
 *    signalée (contradictoire, et illisible le cas échéant).
 * 2. « Extérieure + sans contrat » : attestation à obtenir, même avec une échéance saisie (reprise au contrôle si elle
 *    est lisible, mais non suivie comme date) ; lecture du statut à confirmer (🔴 sens du statut non établi : lu, comme
 *    la tranche, « extérieure sans contrat au dossier »).
 * 3. Échéance saisie illisible (pas AAAA-MM-JJ) : à ressaisir, signalée comme une attestation à obtenir.
 * 4. Échéance saisie lisible : attestation à renouveler à cette date, même dépassée (le suivi applique son horizon), pour
 *    tout statut hors « Pas de PNO » (aucun contrôle) et « Extérieure + sans contrat » (attestation à obtenir, échéance
 *    non suivie), y compris un statut absent, inconnu ou « Sans échéance ».
 * 5. Sans échéance : « Cabinet » ou « Extérieure » → échéance à obtenir ; « Sans échéance » → échéance à obtenir,
 *    lecture du statut à confirmer (🔵 « sans échéance connue », lecture de la tranche ; s'il s'agit d'un contrat sans
 *    terme, l'alerte est sans objet) ; statut absent ou inconnu → aucun contrôle.
 * - Bilan (le sélecteur « statut des lots » de Gestéam), indépendant de cet ordre : lots par statut, lots non
 *   renseignés, anomalies — statut hors référentiel (jamais deviné : seuls espaces et forme Unicode sont normalisés),
 *   échéance illisible, échéance saisie avec « Sans échéance » ou « Pas de PNO ».
 * - `lectureStatutAConfirmer` qualifie la LECTURE d'un statut Gestéam non confirmée, reprise dans le message
 *   (« lecture du statut à confirmer ») ; ce n'est pas un repère juridique : aucun délai n'est légal, et le suivi « à
 *   faire » (depuisAssurancesPno) laisse son `aConfirmer` à faux.
 *
 * Droit — 🟢 lu sur Légifrance le 04/11/2026 (versions en vigueur au 03/11/2026) :
 * - L. 1965 art. 9-1 (créé par la loi n° 2014-366 du 24/03/2014, art. 58, en vigueur depuis le 27/03/2014, seule
 *   version) : « Chaque copropriétaire est tenu de s'assurer contre les risques de responsabilité civile dont il doit
 *   répondre en sa qualité soit de copropriétaire occupant, soit de copropriétaire non-occupant. Chaque syndicat de
 *   copropriétaires est tenu de s'assurer contre les risques de responsabilité civile dont il doit répondre. » Le texte
 *   oblige le copropriétaire (occupant OU non occupant) et le syndicat ; il ne nomme ni le syndic ni l'administrateur
 *   provisoire, ne prévoit ni attestation, ni contrôle, ni délai, ni sanction.
 * - L. 1965 art. 18, I, 3e tiret : le syndic soumet au vote de l'assemblée (majorité de l'art. 24) la souscription de
 *   l'assurance de responsabilité civile DU SYNDICAT ; en cas de refus, il peut la contracter pour le compte du syndicat
 *   (C. assur. L. 112-1, non lu). 🔵 L'administrateur provisoire, qui reçoit « tous les pouvoirs du syndic » (art. 29-1,
 *   I, al. 2), en est chargé de même. Cela vise l'assurance du syndicat, pas celle des copropriétaires.
 * - D. 1967, annexe 1 (contrat type de syndic, en vigueur depuis le 25/12/2025), liste des prestations du forfait,
 *   « V. - Assurances » : souscription des polices au nom du syndicat, déclaration des sinistres, règlement des
 *   indemnités — aucun contrôle des attestations des copropriétaires. D. 1967 art. 61-1-3 : l'administrateur provisoire
 *   justifie de SA propre assurance de responsabilité civile (sans rapport avec la PNO des lots).
 * - Conclusion : AUCUN TEXTE lu n'impose au syndic ni à l'administrateur provisoire de recueillir ou de contrôler les
 *   attestations d'assurance des copropriétaires. Le contrôle des attestations PNO est une RÈGLE DE GESTION du cabinet,
 *   reprise de Gestéam. Les échéances suivies sont celles des contrats, jamais des délais légaux.
 *
 * Branchements à faire (schéma et écrans non modifiés) :
 * - Frédéric : stocker `Lot.assurancePno?: AssurancePnoLot` (statut en chaîne brute) non indexé (sans changement de
 *   version), ou un champ `statutPno` à côté de `FicheLot.echeancePno` ; d'ici là, assurancePnoDepuisFicheLot lit
 *   l'échéance déjà saisie (LotsCoproprietairesModule, statut absent).
 * - Appelant du suivi : passer à suivi-a-faire.depuisAssurancesPno chaque lot avec le mandat de sa copropriété.
 * - Écran : liste des attestations à contrôler à une date (attestationsPnoAControler) et bilan par statut.
 * - Occupation du lot (F55) et date de reprise du lot (F59) : aucun champ enregistré ne les porte ; paramètres de
 *   l'appelant (LotAssurancePno.occupation, LotAssurancePno.repriseLe), enregistrement et saisie à brancher.
 *
 * Décisions du 20/11/2026 (partie C ; règles de gestion, aucun texte n'impose au syndic de contrôler ces assurances) :
 * - Décision du 20/11/2026 (partie C, F55) : « Pas de PNO » n'est pas un manquement en soi : rien ne change si
 *   l'occupation est inconnue ou si le propriétaire occupe le lot (règle 1 inchangée : aucun contrôle, rien au suivi).
 *   Pour un lot connu comme « loué » ou « vacant », une alerte jamais bloquante (alertesPnoLotsNonOccupes,
 *   MESSAGE_PNO_LOT_NON_OCCUPE) : « lot non occupé par son propriétaire, sans PNO renseignée : l'art. 9-1 impose une
 *   assurance de responsabilité civile ; aucun texte n'impose au syndic de la contrôler ». L. 1965 art. 9-1 (relu le
 *   17/11/2026) oblige le copropriétaire occupant à sa propre assurance d'occupant, pas à une PNO. L'alerte ne vise que
 *   le statut « Pas de PNO » ; elle n'entre ni dans les contrôles ni dans le suivi « à faire » (rien à obtenir).
 * - Décision du 20/11/2026 (partie C, F56) : non par défaut : VitFix ne recueille pas les attestations des
 *   copropriétaires occupants (art. 9-1 oblige le copropriétaire ; le contrat type, D. 1967 annexe 1, V, 16° à 18°, ne
 *   cite aucun contrôle des attestations). Un réglage du cabinet, désactivé par défaut
 *   (REGLAGES_PNO_CABINET_PAR_DEFAUT.suivreAttestationsOccupants), permettra plus tard de les suivre avec le même
 *   contrôle que la PNO ; aucun contrôle ne le lit encore.
 * - Décision du 20/11/2026 (partie C, F57) : relancer 30 jours avant l'échéance
 *   (REGLAGES_PNO_CABINET_PAR_DEFAUT.relanceJoursAvantEcheance, valeur réglable par le cabinet), puis rappeler à
 *   l'échéance si rien n'est reçu ; le réglage du collaborateur, s'il existe, reste prioritaire. Aucun texte ne fixe ce
 *   délai ; 30 jours est aussi l'anticipation par défaut des contrats à résilier (contrats-a-resilier.ts). La relance
 *   passe par l'horizon du suivi (suivi-a-faire.HORIZONS_CABINET_PAR_DEFAUT, qui remplace « Maintenant », horizon par
 *   défaut de tout collaborateur) ; le rappel, par le libellé du contrôle fait à une date (`rappel`) : échéance
 *   atteinte sans nouvelle échéance saisie (le domaine ne sait pas autrement qu'une attestation est reçue).
 * - Décision du 20/11/2026 (partie C, F58) : garder l'échéance au suivi, comme aujourd'hui, avec un libellé propre au
 *   statut « Cabinet » : « renouveler le contrat PNO souscrit par le cabinet », au lieu de « obtenir l'attestation ».
 *   Le libellé vise l'échéance (motif a_renouveler) ; « Cabinet » sans échéance saisie garde son libellé.
 * - Décision du 20/11/2026 (partie C, F59) : garder « Maintenant » (date du jour du calcul) pour une attestation à
 *   obtenir, comme aujourd'hui ; ajouter, quand elle est connue, la date depuis laquelle l'attestation manque
 *   (`aObtenirDepuis`, « à obtenir depuis le … ») : échéance lisible dépassée (« Extérieure + sans contrat »), à défaut
 *   date de reprise du lot ; jamais une date postérieure au jour du calcul. Sans date du calcul (controlesAssurancesPno
 *   appelé sans `aujourdhui`), ni rappel ni « depuis ».
 *
 * 🔴 Non établi (questions) :
 * - Référent métier : sens exact de « Sans échéance » (échéance inconnue, à obtenir — retenu — ou contrat sans terme ?) et de
 *   « Extérieure + sans contrat » (attestation extérieure non fournie ?) ; le statut est-il saisi sur le lot, ou calculé
 *   par Gestéam (contrat d'abonnement du lot, échéance) ?
 */

/** Statuts du sélecteur PNO de Gestéam (tranche 43 § 17), dans l'ordre relevé. */
export const STATUTS_PNO = ['Cabinet', 'Extérieure', 'Sans échéance', 'Extérieure + sans contrat', 'Pas de PNO'] as const
export type StatutPno = (typeof STATUTS_PNO)[number]

/** Statuts qui excluent une échéance : une échéance saisie avec eux est contradictoire. */
const STATUTS_SANS_ECHEANCE: ReadonlySet<StatutPno> = new Set<StatutPno>(['Sans échéance', 'Pas de PNO'])

const STATUTS_CONNUS: ReadonlyMap<string, StatutPno> = new Map(STATUTS_PNO.map((statut) => [normaliserEspaces(statut), statut]))

/** Statut du référentiel, ou null (absent, ou valeur hors référentiel : signalée par bilanAssurancesPno). */
export const lireStatutPno = (valeur: string | null | undefined): StatutPno | null =>
  valeur === null || valeur === undefined ? null : (STATUTS_CONNUS.get(normaliserEspaces(valeur)) ?? null)

/** Assurance PNO d'un lot (type du domaine ; db/schema.ts inchangé), valeurs brutes saisies ou reprises. */
export interface AssurancePnoLot {
  /**
   * Statut Gestéam, valeur brute (comme AffectationMandat.statut), lue par lireStatutPno ; absent ou null : non
   * renseigné. Une valeur hors référentiel (reprise) est signalée par bilanAssurancesPno, jamais devinée.
   */
  statut?: string | null
  /** Échéance de l'attestation (AAAA-MM-JJ), valeur brute ; absente ou null : non saisie. */
  echeance?: string | null
}

/** Lot à contrôler : identifiant et n° (libellés), sans donnée personnelle. */
export interface LotAssurancePno {
  lotId: string
  numero: string
  /** null : aucune information PNO sur le lot. */
  assurancePno: AssurancePnoLot | null
  /**
   * Occupation du lot (décision du 20/11/2026, partie C, F55) ; absente ou null : inconnue. Aucun champ enregistré ne la
   * porte (FicheLot n'a que « occupeDepuis ») : paramètre de l'appelant.
   */
  occupation?: OccupationLot | null
  /**
   * Date de reprise du lot, AAAA-MM-JJ (décision du 20/11/2026, partie C, F59) : à défaut d'échéance dépassée, date
   * depuis laquelle une attestation à obtenir manque ; absente ou null : inconnue. Aucun champ enregistré ne la porte :
   * paramètre de l'appelant.
   */
  repriseLe?: string | null
}

/** Réglages du cabinet pour l'assurance des lots (décisions du 20/11/2026, partie C, F56 et F57). */
export interface ReglagesPnoCabinet {
  /** F57 : relance n jours avant l'échéance (horizon du suivi tant que le collaborateur n'a pas choisi le sien). */
  relanceJoursAvantEcheance: number
  /** F56 : suivre les attestations d'assurance des copropriétaires occupants ; aucun contrôle ne le lit encore. */
  suivreAttestationsOccupants: boolean
}

/** F57 : 30 jours, réglables par le cabinet ; F56 : attestations des occupants non recueillies. */
export const REGLAGES_PNO_CABINET_PAR_DEFAUT: Readonly<ReglagesPnoCabinet> = Object.freeze({
  relanceJoursAvantEcheance: 30,
  suivreAttestationsOccupants: false,
})

/** Lit l'échéance déjà saisie sur la fiche lot (FicheLot.echeancePno) ; statut absent, faute de champ. */
export const assurancePnoDepuisFicheLot = (fiche: Pick<FicheLot, 'echeancePno'>): AssurancePnoLot | null =>
  fiche.echeancePno === null ? null : { statut: null, echeance: fiche.echeancePno }

export const MOTIFS_CONTROLE_PNO = ['a_renouveler', 'echeance_absente', 'echeance_illisible', 'attestation_absente'] as const
export type MotifControlePno = (typeof MOTIFS_CONTROLE_PNO)[number]

export interface ControlePno {
  lotId: string
  numero: string
  statut: StatutPno | null
  /** Échéance lisible du lot ; null : absente ou illisible. */
  echeance: string | null
  motif: MotifControlePno
  /** Date du renouvellement (l'échéance) ; null : attestation ou échéance à obtenir dès maintenant. */
  date: string | null
  /**
   * Lecture du statut Gestéam non confirmée (🔴 « Sans échéance », « Extérieure + sans contrat ») : reprise dans le
   * message ; ce n'est pas un repère juridique.
   */
  lectureStatutAConfirmer: boolean
  /**
   * Échéance atteinte au jour du calcul, sans nouvelle échéance saisie (décision du 20/11/2026, partie C, F57) : rappel,
   * dit dans le message ; faux avant l'échéance ou sans date du calcul.
   */
  rappel: boolean
  /**
   * Attestation à obtenir : date depuis laquelle elle manque, quand elle est connue (décision du 20/11/2026, partie C,
   * F59) : échéance lisible dépassée, à défaut date de reprise du lot ; null sinon, toujours pour une attestation à
   * renouveler, et sans date du calcul.
   */
  aObtenirDepuis: string | null
  message: string
}

/** Jour du calcul des contrôles. */
export interface OptionsControlesPno {
  /** AAAA-MM-JJ : rappel à l'échéance (F57) et « à obtenir depuis » (F59) ; absent : ni l'un ni l'autre. */
  aujourdhui?: string
}

const MENTION_A_CONFIRMER = ' (lecture du statut à confirmer)'

/** Statuts dont la lecture, à l'origine du contrôle, n'est pas confirmée (🔴). */
const STATUTS_A_CONFIRMER: ReadonlySet<StatutPno> = new Set<StatutPno>(['Sans échéance', 'Extérieure + sans contrat'])

/** Motifs qui découlent du seul statut (sans échéance lue) : ce sont eux que la lecture du statut met en doute. */
const MOTIFS_TIRES_DU_STATUT: ReadonlySet<MotifControlePno> = new Set<MotifControlePno>(['attestation_absente', 'echeance_absente'])

interface ChampsControle {
  statut: StatutPno | null
  motif: MotifControlePno
  echeance: string | null
  /** Suite du message, après « Lot n : ». */
  texte: string
  /** Échéance atteinte au jour du calcul (attestation à renouveler, F57) ; absent : non. */
  rappel?: boolean
}

/** F59 : date depuis laquelle une attestation à obtenir manque ; jamais après le jour du calcul. */
function dateAObtenirDepuis(echeance: string | null, reprise: string | null, aujourdhui: string): string | null {
  if (echeance !== null && echeance < aujourdhui) return echeance
  return reprise !== null && reprise <= aujourdhui ? reprise : null
}

/** « à obtenir depuis le … » (F59) : l'échéance illisible n'a pas de « à obtenir » dans son texte, on l'y ajoute. */
function mentionDepuis(motif: MotifControlePno, depuis: string | null): string {
  if (depuis === null) return ''
  const le = `depuis le ${dateIsoVersFr(depuis)}`
  return motif === 'echeance_illisible' ? ` ; attestation à obtenir ${le}` : ` ${le}`
}

function controle(lot: LotAssurancePno, champs: ChampsControle, aujourdhui: string | null): ControlePno {
  const { statut, motif, echeance, texte } = champs
  const lectureStatutAConfirmer = MOTIFS_TIRES_DU_STATUT.has(motif) && statut !== null && STATUTS_A_CONFIRMER.has(statut)
  const aObtenirDepuis =
    motif === 'a_renouveler' || aujourdhui === null ? null : dateAObtenirDepuis(echeance, lot.repriseLe ?? null, aujourdhui)
  return {
    lotId: lot.lotId,
    numero: lot.numero,
    statut,
    echeance,
    motif,
    date: motif === 'a_renouveler' ? echeance : null,
    lectureStatutAConfirmer,
    rappel: champs.rappel ?? false,
    aObtenirDepuis,
    message: `Lot ${lot.numero} : ${texte}${mentionDepuis(motif, aObtenirDepuis)}${lectureStatutAConfirmer ? MENTION_A_CONFIRMER : ''}.`,
  }
}

/**
 * Attestation à renouveler : relance avant l'échéance, rappel une fois l'échéance atteinte (F57) ; statut « Cabinet » :
 * le contrat souscrit par le cabinet à renouveler (F58).
 */
function texteARenouveler(statut: StatutPno | null, echeance: string, rappel: boolean): string {
  const le = dateIsoVersFr(echeance)
  if (statut === 'Cabinet')
    return rappel
      ? `rappel : renouveler le contrat PNO souscrit par le cabinet, échéance du ${le} atteinte sans nouvelle échéance saisie`
      : `renouveler le contrat PNO souscrit par le cabinet, échéance du ${le}`
  return rappel
    ? `rappel : attestation PNO à renouveler, échéance du ${le} atteinte sans nouvelle attestation saisie`
    : `attestation PNO à renouveler à l'échéance du ${le}`
}

/** Contrôle d'un lot (règles de l'en-tête) au jour du calcul, s'il est donné ; null : rien à contrôler. */
function controleDuLot(lot: LotAssurancePno, aujourdhui: string | null): ControlePno | null {
  const assurance = lot.assurancePno
  if (!assurance) return null
  const statut = lireStatutPno(assurance.statut)
  if (statut === 'Pas de PNO') return null
  const saisie = assurance.echeance ?? null
  const echeance = estDateIsoValide(saisie) ? saisie : null
  if (statut === 'Extérieure + sans contrat')
    return controle(
      lot,
      { statut, motif: 'attestation_absente', echeance, texte: 'PNO extérieure sans contrat ; attestation à obtenir' },
      aujourdhui,
    )
  if (saisie !== null && echeance === null)
    return controle(
      lot,
      { statut, motif: 'echeance_illisible', echeance, texte: `échéance PNO illisible (« ${saisie} ») ; à ressaisir (AAAA-MM-JJ)` },
      aujourdhui,
    )
  if (echeance !== null) {
    const rappel = aujourdhui !== null && echeance <= aujourdhui
    return controle(lot, { statut, motif: 'a_renouveler', echeance, rappel, texte: texteARenouveler(statut, echeance, rappel) }, aujourdhui)
  }
  if (statut === null) return null
  return controle(
    lot,
    { statut, motif: 'echeance_absente', echeance, texte: `PNO « ${statut} » sans échéance saisie ; attestation à obtenir` },
    aujourdhui,
  )
}

/** Date de reprise du lot (F59) : paramètre de l'appelant, AAAA-MM-JJ s'il est renseigné. */
function verifierRepriseLot({ numero, repriseLe }: LotAssurancePno): void {
  if (repriseLe !== undefined && repriseLe !== null && !estDateIsoValide(repriseLe))
    throw new Error(`Date de reprise du lot ${numero} invalide (${repriseLe}) : AAAA-MM-JJ attendu.`)
}

/**
 * Contrôles des attestations PNO : pour chaque lot, au plus un contrôle — à renouveler à l'échéance (même dépassée),
 * échéance ou attestation à obtenir, échéance à ressaisir. Ordre des lots conservé ; « Pas de PNO » et les lots sans
 * information n'en produisent aucun. Avec le jour du calcul : rappel à l'échéance atteinte (F57) et « à obtenir depuis
 * le … » (F59). Lève une erreur si le jour du calcul ou une date de reprise n'est pas AAAA-MM-JJ.
 */
export function controlesAssurancesPno(lots: readonly LotAssurancePno[], { aujourdhui }: OptionsControlesPno = {}): ControlePno[] {
  if (aujourdhui !== undefined && !estDateIsoValide(aujourdhui))
    throw new Error(`Date du calcul invalide : « ${aujourdhui} » (attendu AAAA-MM-JJ).`)
  return lots.flatMap((lot) => {
    verifierRepriseLot(lot)
    const resultat = controleDuLot(lot, aujourdhui ?? null)
    return resultat ? [resultat] : []
  })
}

/**
 * Attestations à contrôler à la date donnée (comme attestationsEntreprisesAControler) : échéance antérieure ou égale à
 * la date, ou attestation / échéance à obtenir ; contrôles faits à cette date (rappel, « depuis »). Lève une erreur si la
 * date n'est pas AAAA-MM-JJ.
 */
export function attestationsPnoAControler(lots: readonly LotAssurancePno[], dateIso: string): ControlePno[] {
  if (!estDateIsoValide(dateIso)) throw new Error(`Date invalide : « ${dateIso} » (attendu AAAA-MM-JJ).`)
  return controlesAssurancesPno(lots, { aujourdhui: dateIso }).filter((c) => c.date === null || c.date <= dateIso)
}

/** Décision du 20/11/2026 (partie C, F55), mot pour mot. */
export const MESSAGE_PNO_LOT_NON_OCCUPE =
  "lot non occupé par son propriétaire, sans PNO renseignée : l'art. 9-1 impose une assurance de responsabilité civile ; aucun texte n'impose au syndic de la contrôler"

/** Occupations qui font signaler « Pas de PNO » (F55). */
const OCCUPATIONS_SANS_PROPRIETAIRE: ReadonlySet<OccupationLot> = new Set<OccupationLot>(['loue', 'vacant'])

export interface AlertePnoLotNonOccupe {
  lotId: string
  numero: string
  occupation: OccupationLot
  /** Jamais bloquante (F55). */
  bloquant: false
  message: string
  fondement: string
}

function verifierOccupation({ numero }: LotAssurancePno, occupation: OccupationLot | null): void {
  if (occupation !== null && !(OCCUPATIONS_LOT as readonly string[]).includes(occupation))
    throw new Error(`Occupation du lot ${numero} inconnue (« ${String(occupation)} ») : ${OCCUPATIONS_LOT.join(', ')} attendu.`)
}

/**
 * Lots « Pas de PNO » connus comme loués ou vacants (décision du 20/11/2026, partie C, F55) : une alerte non bloquante
 * par lot, ordre des lots conservé. Occupation inconnue, propriétaire occupant ou autre statut : rien. Hors contrôles et
 * hors suivi « à faire ». Lève une erreur pour une occupation hors liste.
 */
export function alertesPnoLotsNonOccupes(lots: readonly LotAssurancePno[]): AlertePnoLotNonOccupe[] {
  return lots.flatMap((lot): AlertePnoLotNonOccupe[] => {
    const occupation = lot.occupation ?? null
    verifierOccupation(lot, occupation)
    if (occupation === null || !OCCUPATIONS_SANS_PROPRIETAIRE.has(occupation)) return []
    if (lireStatutPno(lot.assurancePno?.statut) !== 'Pas de PNO') return []
    return [
      {
        lotId: lot.lotId,
        numero: lot.numero,
        occupation,
        bloquant: false,
        message: `Lot ${lot.numero} : ${MESSAGE_PNO_LOT_NON_OCCUPE}.`,
        fondement: 'L. 1965 art. 9-1',
      },
    ]
  })
}

export const MOTIFS_ANOMALIE_PNO = ['statut_inconnu', 'echeance_illisible', 'echeance_contradictoire'] as const
export type MotifAnomaliePno = (typeof MOTIFS_ANOMALIE_PNO)[number]

export interface AnomaliePno {
  lotId: string
  motif: MotifAnomaliePno
  message: string
}

export interface BilanAssurancesPno {
  /** Lots par statut (le sélecteur « statut des lots » de Gestéam), dans l'ordre reçu. */
  parStatut: Record<StatutPno, string[]>
  /** Lots sans statut (aucune information, ou valeur hors référentiel). */
  nonRenseignes: string[]
  anomalies: AnomaliePno[]
}

function anomaliesDuLot({ lotId, numero }: LotAssurancePno, assurance: AssurancePnoLot, statut: StatutPno | null): AnomaliePno[] {
  const anomalies: AnomaliePno[] = []
  const anomalie = (motif: MotifAnomaliePno, texte: string): void => {
    anomalies.push({ lotId, motif, message: `Lot ${numero} : ${texte}.` })
  }
  const brut = assurance.statut ?? null
  const saisie = assurance.echeance ?? null
  if (brut !== null && statut === null)
    anomalie('statut_inconnu', `statut PNO « ${normaliserEspaces(brut)} » hors du référentiel (${STATUTS_PNO.join(', ')}) ; à qualifier`)
  if (saisie !== null && !estDateIsoValide(saisie)) anomalie('echeance_illisible', `échéance PNO illisible (« ${saisie} »)`)
  if (saisie !== null && statut !== null && STATUTS_SANS_ECHEANCE.has(statut))
    anomalie('echeance_contradictoire', `échéance PNO saisie avec le statut « ${statut} » ; statut ou échéance à corriger`)
  return anomalies
}

/** Bilan des lots par statut PNO, lots non renseignés et anomalies (rien n'est écarté ni corrigé). */
export function bilanAssurancesPno(lots: readonly LotAssurancePno[]): BilanAssurancesPno {
  const parStatut: Record<StatutPno, string[]> = {
    Cabinet: [],
    Extérieure: [],
    'Sans échéance': [],
    'Extérieure + sans contrat': [],
    'Pas de PNO': [],
  }
  const bilan: BilanAssurancesPno = { parStatut, nonRenseignes: [], anomalies: [] }
  for (const lot of lots) {
    const statut = lireStatutPno(lot.assurancePno?.statut)
    if (statut === null) bilan.nonRenseignes.push(lot.lotId)
    else bilan.parStatut[statut].push(lot.lotId)
    if (lot.assurancePno) bilan.anomalies.push(...anomaliesDuLot(lot, lot.assurancePno, statut))
  }
  return bilan
}
