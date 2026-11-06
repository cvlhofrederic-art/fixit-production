import {
  estDateIsoValide,
  messagePlausibilite,
  plausibiliteDate,
  verifierAujourdhui,
  type PlausibiliteDate,
} from '@/lib/administrateur-judiciaire/domain/dates'
import {
  creerAssuranceImpayes,
  type AssuranceImpayesContentieux,
} from '@/lib/administrateur-judiciaire/domain/contentieux-assurance-impayes'
import {
  creerDecisionContentieux,
  creerVoiesExecution,
  executionEngagee,
  exigerAutorisationVente,
  type SourceDecisionContentieux,
  type VoiesExecutionContentieux,
} from '@/lib/administrateur-judiciaire/domain/contentieux-voies-execution'
import type { SuiviEcheancier } from '@/lib/administrateur-judiciaire/domain/decompte-contentieux'
import type { EtapeRecouvrement } from '@/lib/administrateur-judiciaire/domain/recouvrement'
import {
  PHASE_CONTENTIEUX,
  TYPE_CONTENTIEUX,
  type PhaseContentieux,
  type TypeContentieux,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Contentieux d'une copropriété (cartographie Gestéam, tranches 20, 27 et 28). Fonctions pures, dates ISO
 * (AAAA-MM-JJ), montants en CENTIMES ENTIERS, sans écran.
 *
 * Gestéam — fiche : date, n°, type, objet, phase, clos le ; immeuble, mandat, débiteur, montant demandé ; huissier,
 * avocat, expert (chacun : référence, transmis le) ; dates de procédure : mise en demeure, commandement, référé,
 * assignation, audience, ordonnance, jugement, signification. Type, phase, particularité : référentiels complets (la
 * particularité n'est pas reprise dans VitFix : décision J44).
 *
 * La PHASE est saisie par le gestionnaire. VitFix en suggère une d'après les faits datés et signale l'écart : il ne la
 * remplace jamais. « Règlement amiable » et « Déclaration Assurance » ne se déduisent d'aucune date.
 * Stades et groupes de relance : listes du paramétrage cabinet (tranche 27) ; leur correspondance avec les étapes de
 * recouvrement est 🔵 DÉDUITE, à valider avec le cabinet.
 *
 * Point 57 du bilan Gestéam — assurance impayés et échéancier actif :
 * - 🟢 tranche 42, fiche réelle, onglet Règlements : bloc Assurance (couverture impayés, déclaré le, sinistre lié) et bloc
 *   Échéancier (N fois, montant, périodicité, prochain le ; grille Date · Statut · Montant), sans origine affichée et sans
 *   Particularité. Bloc Voie d'exécution : une case « Échéancier » voisine des saisies (mobilière, attribution, arrêt sur
 *   salaire ou loyer).
 * - 🟢 tranches 20 § 3 et 28 : la Particularité (deux valeurs, « Contentieux avec / sans échéancier ») est un critère de la
 *   recherche des contentieux. Son champ n'a été vu sur aucune fiche (tranche 28 : en-tête Date, N°, Type, Statut, Objet,
 *   Phase, Clos le ; onglet Règlements non ouvert ; tranche 42 : absente de la fiche réelle). VitFix ne la reprend pas
 *   (décision J44, ci-dessous).
 * - L'assurance impayés est FACULTATIVE sur la saisie et normalisée à la création (contentieux-assurance-impayes.ts, qui
 *   porte aussi ses contrôles et la lecture des indemnités sur le sinistre). L'objet reste un texte libre (décision
 *   J34 : champ de saisie libre dans Gestéam ; objets-contentieux.ts reconnaît les libellés Gestéam observés).
 * - 🟢 Le droit, lu sur Légifrance le 29/10/2026 : aucun texte de la loi n° 65-557 ni du décret n° 67-223 ne fixe la forme ni
 *   la durée d'un échéancier amiable conclu par un syndic (recherche limitée à ces deux textes). Ils prévoient en revanche
 *   d'autres échelonnements de la dette d'un copropriétaire envers le syndicat, notamment : les échéanciers individualisés
 *   que conclut l'administrateur provisoire (loi art. 29-5, V) ; le paiement par annuités égales au dixième de sa part
 *   des travaux pour le copropriétaire qui n'a pas donné son accord à la décision, s'il le notifie au syndic dans les deux
 *   mois de la notification du procès-verbal, la somme devenant immédiatement exigible à la première mutation entre vifs
 *   de son lot, hors travaux imposés par une obligation légale ou réglementaire (loi art. 33). Les autres textes lus
 *   prévoient aussi les
 *   délais de grâce du juge (C. civ. art. 1343-5), l'accord de la procédure simplifiée de recouvrement des petites créances
 *   (CPCE art. L. 125-1) et le plan conventionnel de redressement du surendettement, prévu à l'art. L. 732-1 selon C. consom.
 *   art. L. 722-3 (L. 732-1 non relu) ; C. consom. art. L. 722-5, al. 3 cite en outre, pour les créances locatives, les
 *   délais de paiement de la loi n° 89-462, art. 24, V et VI (non relus). Les effets d'un terme accordé relèvent de
 *   C. civ. art. 1305-2 à 1305-4 : ce qui n'est dû qu'à terme ne peut être exigé avant l'échéance (1305-2) ; le terme
 *   profite au débiteur, sauf s'il a été établi en faveur du créancier ou des deux parties (1305-3) ; le débiteur perd le
 *   bénéfice du terme s'il ne fournit pas les sûretés promises ou diminue celles qui garantissent l'obligation (1305-4).
 * - 🔵 Le groupe de relance 6 (protocole d'accord) se DÉDUIT de l'échéancier du débiteur : la grille
 *   (decompte-contentieux.suivreEcheancier), active tant qu'une échéance n'est pas soldée, échue ou non, QUELLE QUE SOIT
 *   l'origine de l'échéancier (non lue, 🔴 ci-dessous), ou la case « Échéancier » du bloc Voie d'exécution (J33,
 *   ci-dessous).
 * - 🔴 (Frédéric) Une échéance échue restée impayée laisse-t-elle le débiteur en groupe 6 « avec échéancier » jusqu'à ce
 *   que le gestionnaire dénonce l'échéancier, ou le dossier repasse-t-il « sans échéancier » (groupe 9 en procédure) ?
 * - 🔴 (Frédéric) La grille n'est pas seulement amiable : decompte-contentieux.ts qualifie l'échéancier par
 *   `DecisionEcheancier.origine`, dans ORIGINES_ECHEANCIER (amiable, accord_homologue, delais_grace, surendettement).
 *   Quelles origines mettent le débiteur au groupe 6 « Protocole d'accord » ? Aujourd'hui `echeancierActif` ne lit que
 *   la grille (`SuiviEcheancier`), et `echeancierDuContentieux` et `relanceDuContentieux` la grille et la case
 *   « Échéancier » (J33) : des délais de grâce du juge ou un plan de surendettement donnent aussi le groupe 6 (un test le
 *   montre). Si la réponse dépend de
 *   l'origine, ces trois fonctions recevront l'origine (ou la `DecisionEcheancier`) en paramètre facultatif. Le
 *   paiement par annuités de la loi art. 33 n'a pas d'origine dans ORIGINES_ECHEANCIER : faut-il l'ajouter, et met-il le
 *   débiteur au groupe 6 ?
 * - 🔴 (Frédéric) Un dossier de surendettement déclaré recevable interdit au débiteur de payer ses dettes antérieures et
 *   suspend les exécutions (C. consom. art. L. 722-2 et L. 722-5) : un échéancier d'une autre origine que
 *   'surendettement' devrait alors cesser d'être actif. La recevabilité n'est pas le plan (origine 'surendettement') :
 *   faut-il, en plus de l'origine, un fait daté « recevabilité du surendettement » sur le contentieux ?
 * - 🔴 (Frédéric) Un échéancier amiable en cours n'écarte pas, selon les textes lus, l'exigibilité des provisions qui
 *   échoient ensuite (loi art. 14-1 et 19-2) : le groupe 6 ne bloque donc pas l'étape « exigibilite ». À valider.
 * - 🔴 (Frédéric) Faut-il que `phaseSuggeree` propose « Déclaration Assurance » dès qu'une déclaration à l'assureur
 *   impayés est datée sur un dossier de recouvrement ? Aujourd'hui cette phase ne se déduit d'aucune date (un test le
 *   garde) : la date « Déclaré le » n'est pas lue par `phaseSuggeree`.
 *
 * Décisions de Hugo du 03/11/2026 (registre des décisions juridiques, J33 ; question 26 de la liste) :
 * - J33 : la case « Échéancier » du bloc Voie d'exécution (tranche 42) désigne l'échéancier fixé par décision du juge
 *   (délais de grâce, C. civ. art. 1343-5). 🟢 Art. 1343-5 relu sur Légifrance le 03/11/2026 (bandeau « En vigueur au
 *   03/11/2026 » ; créé par l'ordonnance n° 2016-131 du 10 février 2016, art. 3, en vigueur depuis le 01/10/2016, sans
 *   modification depuis) : le juge peut, compte tenu de la situation du débiteur et des besoins du créancier, reporter ou
 *   échelonner le paiement des sommes dues « dans la limite de deux années » (al. 1) ; sa décision suspend les
 *   procédures d'exécution engagées par le créancier (al. 4) ; l'article ne vaut pas pour les dettes d'aliment (al. 6).
 *   Cochée, la case rend l'échéancier actif, source « décision du juge » (`echeancierDuContentieux`), avec ou sans
 *   grille ; `relanceDuContentieux` la lit (groupe 6). Décochée, seule la grille compte, comme avant (source « grille »).
 *   🔵 Cochée, la case l'emporte sur une grille soldée ou absente (`grilleActive` le montre) : elle se décoche quand les
 *   délais prennent fin. Les deux ans de l'al. 1 se contrôlent sur la grille (decompte-contentieux.controlerEcheancier,
 *   origine 'delais_grace'). La « Particularité » (question 25) est supprimée : J44, ci-dessous.
 *
 * Décisions de Hugo du 06/11/2026 (registre des décisions juridiques, J43 et J44 ; PR #643, J33, et question 25 de la
 * liste) :
 * - J43 : case « Échéancier » cochée (échéancier fixé par décision du juge, C. civ. art. 1343-5) et exécution déjà
 *   engagée sur le même dossier (saisie cochée, saisie immobilière engagée, expulsion datée : executionEngagee) :
 *   signalée par contentieux-voies-execution.controlerExecutionSousEcheancierDuJuge, avertissement non bloquant (gravité
 *   justifiée et art. 1343-5 relu sur Légifrance le 06/11/2026 : en-tête de contentieux-voies-execution.ts). C. civ.
 *   art. 1343-5, al. 4 : la décision du juge suspend les procédures d'exécution qui auraient été engagées par le
 *   créancier. La question 🔴 correspondante disparaît ; la phase suggérée n'en dépend toujours pas.
 * - J44 : la « Particularité » du contentieux est supprimée : plus de champ sur le dossier (SaisieContentieux), plus de
 *   contrôle à la création, plus de particularité suggérée. Le comportement de l'échéancier du juge (J33) est
 *   identique, sans passer par elle : echeancierDuContentieux et relanceDuContentieux lisent la grille et la case
 *   « Échéancier ». La question 🔴 de son lieu de saisie disparaît. La liste relevée dans Gestéam reste dans le
 *   référentiel généré (lib/data/referentiels-gesteam-judiciaire.ts), comme trace du relevé ; aucun module ne la lit.
 *
 * Point 56 du bilan Gestéam — voies d'exécution, hypothèque, mise à prix et décision liée (🟢 tranche 42, onglet
 * Règlements ; détail, droit et questions 🔴 dans contentieux-voies-execution.ts) :
 * - champs FACULTATIFS, absents quand rien n'est saisi : `voiesExecution` (saisies, saisie immobilière, expulsion,
 *   hypothèque, mise à prix et sommes estimées définitivement perdues), `decision` (assemblée + résolution, ou décision de
 *   l'administrateur provisoire), `mandatId` et `compteId` (compte copropriétaire débiteur, D2 : clé de
 *   PosteDette.contentieux et de reglementsSurContentieux, branchement à faire) ;
 * - `creerDossierContentieux` refuse une saisie immobilière engagée sans décision liée, ou sans les deux montants du
 *   projet de résolution (D. 1967 art. 55, al. 3 ; art. 11, I, 11°) ;
 * - 🔵 une mesure d'exécution engagée (saisie cochée, saisie immobilière engagée, expulsion datée) donne, comme le
 *   commandement, la phase suggérée « Exécution en cours ».
 */

export const JALONS_PROCEDURE = [
  { cle: 'miseEnDemeure', libelle: 'Mise en demeure' },
  { cle: 'commandement', libelle: 'Commandement' },
  { cle: 'refere', libelle: 'Référé' },
  { cle: 'assignation', libelle: 'Assignation' },
  { cle: 'audience', libelle: 'Audience' },
  { cle: 'ordonnance', libelle: 'Ordonnance' },
  { cle: 'jugement', libelle: 'Jugement' },
  { cle: 'signification', libelle: 'Signification' },
] as const
export type JalonProcedure = (typeof JALONS_PROCEDURE)[number]['cle']

/** Stades de relance du compte copropriétaire (Gestéam, paramétrage cabinet). */
export const STADES_RELANCE = [
  { code: '0', libelle: 'Compte à jour' },
  { code: '1', libelle: '1re relance' },
  { code: '2', libelle: 'Mise en demeure' },
  { code: '3', libelle: 'Relance après mise en demeure' },
  { code: '9', libelle: 'Dossier contentieux' },
] as const
export type CodeStadeRelance = (typeof STADES_RELANCE)[number]['code']

/** Groupes de relance (Gestéam, paramétrage cabinet). */
export const GROUPES_RELANCE = [
  { code: '0', libelle: 'Relance' },
  { code: '1', libelle: 'Prélèvement' },
  { code: '6', libelle: 'Protocole d’accord' },
  { code: '9', libelle: 'Contentieux' },
] as const
export type CodeGroupeRelance = (typeof GROUPES_RELANCE)[number]['code']

export interface IntervenantContentieux {
  nom: string | null
  reference: string | null
  transmisLe: string | null
}

export type RoleIntervenant = 'huissier' | 'avocat' | 'expert'

export interface SaisieContentieux {
  coproprieteId: string
  type: TypeContentieux
  phase: PhaseContentieux
  dateOuverture: string
  dateCloture: string | null
  objet: string
  montantDemandeCentimes: number
  intervenants: Record<RoleIntervenant, IntervenantContentieux>
  jalons: Partial<Record<JalonProcedure, string>>
  /** Bloc Assurance (tranche 42) ; absent : aucune saisie. Les indemnités se lisent sur le sinistre lié. */
  assuranceImpayes?: AssuranceImpayesContentieux
  /** Mandat (tranche 28) ; absent : non renseigné. */
  mandatId?: string | null
  /** Compte copropriétaire débiteur (D2) ; absent : non renseigné. */
  compteId?: string | null
  /** Listes Assemblée + Résolution (tranche 42), ou décision de l'administrateur provisoire ; absent : aucune. */
  decision?: SourceDecisionContentieux | null
  /** Blocs Voie d'exécution et Hypothèque (tranche 42) ; absent : aucune saisie. */
  voiesExecution?: VoiesExecutionContentieux
}

export type DossierContentieux = SaisieContentieux

const contient = (liste: readonly string[], valeur: string) => liste.includes(valeur)
const CLES_JALONS = JALONS_PROCEDURE.map((j) => j.cle) as readonly string[]

const verifierDate = (champ: string, valeur: string | null | undefined): void => {
  if (valeur != null && !estDateIsoValide(valeur)) throw new Error(`Date invalide pour ${champ} (${valeur}) : AAAA-MM-JJ attendu.`)
}

/** Assurance impayés normalisée si elle est saisie ; rien sinon (le champ reste absent). */
const assuranceNormalisee = (
  assurance: AssuranceImpayesContentieux | undefined,
): { assuranceImpayes?: AssuranceImpayesContentieux } =>
  assurance === undefined ? {} : { assuranceImpayes: creerAssuranceImpayes(assurance) }

/** Identifiant rogné s'il est saisi ; refuse une chaîne vide. */
function identifiantFacultatif(libelle: string, valeur: string | null | undefined): string | undefined {
  if (valeur === undefined || valeur === null) return undefined
  const id = valeur.trim()
  if (id === '') throw new Error(`${libelle} du contentieux vide : identifiant attendu, ou rien.`)
  return id
}

type ChampsPoint56 = Pick<SaisieContentieux, 'mandatId' | 'compteId' | 'decision' | 'voiesExecution'>

/**
 * Champs du point 56, normalisés s'ils sont saisis, absents sinon (null vaut absence) ; refuse une saisie immobilière
 * engagée sans décision liée, ou sans les deux montants (contentieux-voies-execution.exigerAutorisationVente).
 */
function champsVoiesExecution(saisie: ChampsPoint56): ChampsPoint56 {
  const champs: ChampsPoint56 = {}
  const mandatId = identifiantFacultatif('Mandat', saisie.mandatId)
  const compteId = identifiantFacultatif('Compte débiteur', saisie.compteId)
  if (mandatId !== undefined) champs.mandatId = mandatId
  if (compteId !== undefined) champs.compteId = compteId
  if (saisie.decision !== undefined && saisie.decision !== null) champs.decision = creerDecisionContentieux(saisie.decision)
  if (saisie.voiesExecution !== undefined) champs.voiesExecution = creerVoiesExecution(saisie.voiesExecution)
  exigerAutorisationVente(champs.voiesExecution, champs.decision)
  return champs
}

export function creerDossierContentieux(saisie: SaisieContentieux): DossierContentieux {
  if (!contient(TYPE_CONTENTIEUX, saisie.type)) throw new Error(`Type de contentieux inconnu : « ${saisie.type} ».`)
  if (!contient(PHASE_CONTENTIEUX, saisie.phase)) throw new Error(`Phase de contentieux inconnue : « ${saisie.phase} ».`)
  if (!estDateIsoValide(saisie.dateOuverture)) throw new Error(`Date d'ouverture invalide (${saisie.dateOuverture}) : AAAA-MM-JJ attendu.`)
  verifierDate('dateCloture', saisie.dateCloture)
  if (!Number.isInteger(saisie.montantDemandeCentimes) || saisie.montantDemandeCentimes < 0)
    throw new Error(`Montant demandé invalide (${saisie.montantDemandeCentimes}) : centimes entiers positifs attendus.`)
  for (const [cle, date] of Object.entries(saisie.jalons)) {
    if (!CLES_JALONS.includes(cle)) throw new Error(`Jalon de procédure inconnu : « ${cle} ».`)
    verifierDate(cle, date)
  }
  for (const [role, intervenant] of Object.entries(saisie.intervenants)) verifierDate(`${role}.transmisLe`, intervenant.transmisLe)
  const { mandatId, compteId, decision, voiesExecution, ...reste } = saisie
  return {
    ...reste,
    objet: saisie.objet.replace(/\s+/g, ' ').trim(),
    ...assuranceNormalisee(saisie.assuranceImpayes),
    ...champsVoiesExecution({ mandatId, compteId, decision, voiesExecution }),
  }
}

export interface AnomalieContentieux {
  jalon: JalonProcedure | RoleIntervenant
  message: string
}

/** Paires (avant, après) dont l'ordre s'impose quand les deux dates existent. */
const ORDRE_JALONS: [JalonProcedure, JalonProcedure][] = [
  ['miseEnDemeure', 'assignation'],
  ['refere', 'ordonnance'],
  ['assignation', 'audience'],
  ['audience', 'jugement'],
  ['jugement', 'signification'],
  ['signification', 'commandement'],
]

const libelleJalon = (cle: JalonProcedure) => JALONS_PROCEDURE.find((j) => j.cle === cle)?.libelle ?? cle

/** Ordre de la procédure et transmissions postérieures à l'ouverture ; une anomalie par date en cause. */
export function controlerChronologieContentieux(dossier: DossierContentieux): AnomalieContentieux[] {
  const anomalies: AnomalieContentieux[] = []
  for (const [avant, apres] of ORDRE_JALONS) {
    const dAvant = dossier.jalons[avant]
    const dApres = dossier.jalons[apres]
    if (dAvant && dApres && dApres < dAvant && !anomalies.some((a) => a.jalon === apres))
      anomalies.push({ jalon: apres, message: `${DATEE[apres]} avant : ${libelleJalon(avant).toLowerCase()}.` })
  }
  for (const role of ['huissier', 'avocat', 'expert'] as const) {
    const transmis = dossier.intervenants[role].transmisLe
    if (transmis && transmis < dossier.dateOuverture)
      anomalies.push({ jalon: role, message: `Transmission (${role}) datée avant l'ouverture du dossier.` })
  }
  return anomalies
}

/**
 * Jalons qui constatent un fait accompli : jamais datés après aujourd'hui. L'audience et le référé se fixent à l'avance
 * (date d'audience) et peuvent être futurs.
 */
export const JALONS_ACCOMPLIS: readonly JalonProcedure[] = [
  'miseEnDemeure',
  'commandement',
  'assignation',
  'ordonnance',
  'jugement',
  'signification',
]

/** Libellé accordé de chaque date du dossier, pour les messages (« Jugement daté », « Audience datée »). */
const DATEE: Record<JalonProcedure | RoleIntervenant | 'dateOuverture' | 'dateCloture', string> = {
  dateOuverture: 'Ouverture datée',
  dateCloture: 'Clôture datée',
  miseEnDemeure: 'Mise en demeure datée',
  commandement: 'Commandement daté',
  refere: 'Référé daté',
  assignation: 'Assignation datée',
  audience: 'Audience datée',
  ordonnance: 'Ordonnance datée',
  jugement: 'Jugement daté',
  signification: 'Signification datée',
  huissier: "Transmission à l'huissier datée",
  avocat: "Transmission à l'avocat datée",
  expert: "Transmission à l'expert datée",
}

export interface AnomalieDateContentieux {
  champ: keyof typeof DATEE
  nature: PlausibiliteDate
  message: string
}

/**
 * Plausibilité des dates par rapport à `aujourdhui` (tranche 42 : Gestéam accepte un jugement en 2028, une mise en
 * demeure en 2525). Complète `controlerChronologieContentieux`, qui ne contrôle que l'ordre. Signale, ne refuse pas.
 */
export function controlerPlausibiliteDatesContentieux(
  dossier: DossierContentieux,
  aujourdhui: string,
): AnomalieDateContentieux[] {
  const dates: [keyof typeof DATEE, string | null | undefined, boolean][] = [
    ['dateOuverture', dossier.dateOuverture, false],
    ['dateCloture', dossier.dateCloture, false],
    ...JALONS_PROCEDURE.map((j): [JalonProcedure, string | undefined, boolean] => [
      j.cle,
      dossier.jalons[j.cle],
      !JALONS_ACCOMPLIS.includes(j.cle),
    ]),
    ...(['huissier', 'avocat', 'expert'] as const).map((role): [RoleIntervenant, string | null, boolean] => [
      role,
      dossier.intervenants[role].transmisLe,
      false,
    ]),
  ]
  verifierAujourdhui(aujourdhui)
  const anomalies: AnomalieDateContentieux[] = []
  for (const [champ, date, futurAdmis] of dates) {
    const nature = date ? plausibiliteDate(date, aujourdhui, { futurAdmis }) : null
    if (date && nature) anomalies.push({ champ, nature, message: messagePlausibilite(DATEE[champ], date, nature) })
  }
  return anomalies
}

const RANG_PHASE = (phase: PhaseContentieux) => PHASE_CONTENTIEUX.indexOf(phase)
const PHASES_NON_DEDUCTIBLES: PhaseContentieux[] = ['Règlement amiable', 'Déclaration Assurance']
const JALONS_JUDICIAIRES: JalonProcedure[] = ['refere', 'assignation', 'audience', 'ordonnance', 'jugement', 'signification']

function phaseDesFaits(dossier: DossierContentieux): PhaseContentieux {
  if (dossier.dateCloture) return 'Clos'
  if (dossier.jalons.commandement || executionEngagee(dossier.voiesExecution)) return 'Exécution en cours'
  if (JALONS_JUDICIAIRES.some((j) => dossier.jalons[j])) return 'Procédure Judiciaire'
  if (dossier.intervenants.avocat.transmisLe) return "Transmis à l'avocat"
  if (dossier.intervenants.huissier.transmisLe) return "Transmis à l'huissier"
  if (dossier.jalons.miseEnDemeure) return 'Mise en demeure'
  return 'Ouverture'
}

/** Phase cohérente avec les faits datés ; `ecart` si elle diffère de la phase saisie. */
export function phaseSuggeree(dossier: DossierContentieux): { phase: PhaseContentieux; ecart: boolean } {
  const deduite = phaseDesFaits(dossier)
  const phase =
    PHASES_NON_DEDUCTIBLES.includes(dossier.phase) && RANG_PHASE(deduite) < RANG_PHASE(dossier.phase) ? dossier.phase : deduite
  return { phase, ecart: phase !== dossier.phase }
}

/** Étape de recouvrement (domain/recouvrement) d'un dossier de charges ; null pour les autres types. */
export function etapeRecouvrementContentieux(dossier: DossierContentieux): EtapeRecouvrement | null {
  if (dossier.type !== 'Recouvrement de charges/loyer') return null
  const phase = phaseDesFaits(dossier)
  if (phase === 'Clos') return 'solde'
  if (phase === 'Mise en demeure') return 'mise_en_demeure'
  if (phase === 'Ouverture') return 'amiable'
  return 'procedure'
}

const STADE_PAR_ETAPE: Record<EtapeRecouvrement, CodeStadeRelance> = {
  amiable: '1',
  mise_en_demeure: '2',
  exigibilite: '3',
  procedure: '9',
  solde: '0',
}

/** Stade et groupe de relance du compte (🔵 correspondance déduite) ; protocole d'accord si échéancier signé. */
export function relanceDepuisEtape(
  etape: EtapeRecouvrement,
  avecEcheancier: boolean,
): { stade: CodeStadeRelance; groupe: CodeGroupeRelance } {
  const stade = STADE_PAR_ETAPE[etape]
  if (etape === 'solde') return { stade, groupe: '0' }
  if (avecEcheancier) return { stade, groupe: '6' }
  return { stade, groupe: etape === 'procedure' ? '9' : '0' }
}

/**
 * Grille de l'échéancier du débiteur en cours (🔵) : au moins une échéance non soldée, échue ou non (🔴 voir l'en-tête).
 * Aucun échéancier, ou toutes les échéances payées : inactif. La grille seule : la case « Échéancier » (J33) se lit par
 * echeancierDuContentieux.
 */
export function echeancierActif(suivi: SuiviEcheancier | null | undefined): boolean {
  return suivi?.echeances.some((echeance) => echeance.statut !== 'payee') ?? false
}

/** D'où vient un échéancier actif (J33) : la grille du bloc Échéancier, ou la case « Échéancier » du bloc Voie d'exécution. */
export const SOURCES_ECHEANCIER = {
  grille: 'Grille du bloc Échéancier (origine non lue)',
  decision_du_juge:
    "Case « Échéancier » du bloc Voie d'exécution : échéancier fixé par décision du juge (délais de grâce, C. civ. art. 1343-5)",
} as const
export type SourceEcheancier = keyof typeof SOURCES_ECHEANCIER

export interface EcheancierDuContentieux {
  actif: boolean
  /** null : aucun échéancier actif. */
  source: SourceEcheancier | null
  /** La grille seule (echeancierActif), pour voir l'écart avec une case cochée. */
  grilleActive: boolean
}

/**
 * Échéancier du dossier (J33) : la case « Échéancier » cochée le rend actif, source « décision du juge », quelle que soit
 * la grille (🔵) ; sinon la grille seule, source « grille ».
 */
export function echeancierDuContentieux(
  dossier: Pick<DossierContentieux, 'voiesExecution'>,
  suivi: SuiviEcheancier | null | undefined,
): EcheancierDuContentieux {
  const grilleActive = echeancierActif(suivi)
  if (dossier.voiesExecution?.caseEcheancier === true) return { actif: true, source: 'decision_du_juge', grilleActive }
  return { actif: grilleActive, source: grilleActive ? 'grille' : null, grilleActive }
}

/**
 * Stade et groupe de relance d'un dossier de recouvrement : étape déduite des faits datés, protocole d'accord (groupe 6)
 * tant que l'échéancier est actif (grille ou case « Échéancier », J33 ; aucune Particularité : J44). null pour un autre
 * type de contentieux.
 */
export function relanceDuContentieux(
  dossier: DossierContentieux,
  suivi: SuiviEcheancier | null | undefined,
): { stade: CodeStadeRelance; groupe: CodeGroupeRelance } | null {
  const etape = etapeRecouvrementContentieux(dossier)
  return etape === null ? null : relanceDepuisEtape(etape, echeancierDuContentieux(dossier, suivi).actif)
}
