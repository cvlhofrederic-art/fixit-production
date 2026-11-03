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
import type { SuiviEcheancier } from '@/lib/administrateur-judiciaire/domain/decompte-contentieux'
import type { EtapeRecouvrement } from '@/lib/administrateur-judiciaire/domain/recouvrement'
import {
  PARTICULARITE_CONTENTIEUX,
  PHASE_CONTENTIEUX,
  TYPE_CONTENTIEUX,
  type ParticulariteContentieux,
  type PhaseContentieux,
  type TypeContentieux,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Contentieux d'une copropriété (cartographie Gestéam, tranches 20, 27 et 28). Fonctions pures, dates ISO
 * (AAAA-MM-JJ), montants en CENTIMES ENTIERS, sans écran.
 *
 * Gestéam — fiche : date, n°, type, objet, phase, clos le ; immeuble, mandat, débiteur, montant demandé ; huissier,
 * avocat, expert (chacun : référence, transmis le) ; dates de procédure : mise en demeure, commandement, référé,
 * assignation, audience, ordonnance, jugement, signification. Type, phase, particularité : référentiels complets.
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
 *   recherche des contentieux. 🔵 Elle est donc portée par chaque dossier, mais son champ n'a été vu sur aucune fiche
 *   (tranche 28 : en-tête Date, N°, Type, Statut, Objet, Phase, Clos le ; onglet Règlements non ouvert ; tranche 42 : absente
 *   de la fiche réelle). Saisie à la main ou calculée depuis la grille : non établi (🔴 Hugo ci-dessous).
 * - L'assurance impayés est FACULTATIVE sur la saisie et normalisée à la création (contentieux-assurance-impayes.ts, qui
 *   porte aussi ses contrôles et la lecture des indemnités sur le sinistre). L'objet reste un texte libre
 *   (objets-contentieux.ts reconnaît les libellés Gestéam observés).
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
 * - 🔵 La particularité et le groupe de relance 6 (protocole d'accord) se DÉDUISENT de la grille du débiteur
 *   (decompte-contentieux.suivreEcheancier) : actif tant qu'une échéance n'est pas soldée, échue ou non, QUELLE QUE SOIT
 *   l'origine de l'échéancier (non lue, 🔴 ci-dessous). La particularité portée par le dossier n'est jamais écrasée :
 *   l'écart est signalé (`particulariteSuggeree`).
 * - 🔴 (Frédéric) Une échéance échue restée impayée laisse-t-elle le débiteur en groupe 6 « avec échéancier » jusqu'à ce
 *   que le gestionnaire dénonce l'échéancier, ou le dossier repasse-t-il « sans échéancier » (groupe 9 en procédure) ?
 * - 🔴 (Frédéric) La grille n'est pas seulement amiable : decompte-contentieux.ts qualifie l'échéancier par
 *   `DecisionEcheancier.origine`, dans ORIGINES_ECHEANCIER (amiable, accord_homologue, delais_grace, surendettement).
 *   Quelles origines mettent le débiteur au groupe 6 « Protocole d'accord » ? Aujourd'hui `echeancierActif`,
 *   `particulariteSuggeree` et `relanceDuContentieux` ne lisent que la grille (`SuiviEcheancier`) : des délais de grâce
 *   du juge ou un plan de surendettement donnent aussi le groupe 6 (un test le montre). Si la réponse dépend de
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
 * - 🔴 (Hugo) Où se saisit la Particularité d'un contentieux, et Gestéam la déduit-il de la grille du bloc Échéancier ?
 *   Tant que ce n'est pas établi, VitFix la traite comme une donnée du dossier et signale l'écart avec la grille.
 * - 🔴 (Hugo) La case « Échéancier » du bloc Voie d'exécution (tranche 42) désigne-t-elle les délais de grâce accordés par
 *   le juge (C. civ. art. 1343-5), que la grille du bloc Échéancier peut aussi porter avec l'origine 'delais_grace', ou
 *   autre chose ? Tant que ce n'est pas établi, seule la grille (`SuiviEcheancier`) rend l'échéancier actif.
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
  particularite: ParticulariteContentieux
  dateOuverture: string
  dateCloture: string | null
  objet: string
  montantDemandeCentimes: number
  intervenants: Record<RoleIntervenant, IntervenantContentieux>
  jalons: Partial<Record<JalonProcedure, string>>
  /** Bloc Assurance (tranche 42) ; absent : aucune saisie. Les indemnités se lisent sur le sinistre lié. */
  assuranceImpayes?: AssuranceImpayesContentieux
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

export function creerDossierContentieux(saisie: SaisieContentieux): DossierContentieux {
  if (!contient(TYPE_CONTENTIEUX, saisie.type)) throw new Error(`Type de contentieux inconnu : « ${saisie.type} ».`)
  if (!contient(PHASE_CONTENTIEUX, saisie.phase)) throw new Error(`Phase de contentieux inconnue : « ${saisie.phase} ».`)
  if (!contient(PARTICULARITE_CONTENTIEUX, saisie.particularite))
    throw new Error(`Particularité de contentieux inconnue : « ${saisie.particularite} ».`)
  if (!estDateIsoValide(saisie.dateOuverture)) throw new Error(`Date d'ouverture invalide (${saisie.dateOuverture}) : AAAA-MM-JJ attendu.`)
  verifierDate('dateCloture', saisie.dateCloture)
  if (!Number.isInteger(saisie.montantDemandeCentimes) || saisie.montantDemandeCentimes < 0)
    throw new Error(`Montant demandé invalide (${saisie.montantDemandeCentimes}) : centimes entiers positifs attendus.`)
  for (const [cle, date] of Object.entries(saisie.jalons)) {
    if (!CLES_JALONS.includes(cle)) throw new Error(`Jalon de procédure inconnu : « ${cle} ».`)
    verifierDate(cle, date)
  }
  for (const [role, intervenant] of Object.entries(saisie.intervenants)) verifierDate(`${role}.transmisLe`, intervenant.transmisLe)
  return { ...saisie, objet: saisie.objet.replace(/\s+/g, ' ').trim(), ...assuranceNormalisee(saisie.assuranceImpayes) }
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
  if (dossier.jalons.commandement) return 'Exécution en cours'
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
 * Échéancier du débiteur en cours (🔵) : au moins une échéance non soldée, échue ou non (🔴 voir l'en-tête). Aucun
 * échéancier, ou toutes les échéances payées : inactif.
 */
export function echeancierActif(suivi: SuiviEcheancier | null | undefined): boolean {
  return suivi?.echeances.some((echeance) => echeance.statut !== 'payee') ?? false
}

/** Particularité cohérente avec l'échéancier ; `ecart` si elle diffère de celle du dossier, jamais écrasée (🔴 Hugo). */
export function particulariteSuggeree(
  dossier: DossierContentieux,
  suivi: SuiviEcheancier | null | undefined,
): { particularite: ParticulariteContentieux; ecart: boolean } {
  const particularite: ParticulariteContentieux = echeancierActif(suivi)
    ? 'Contentieux avec échéancier'
    : 'Contentieux sans échéancier'
  return { particularite, ecart: particularite !== dossier.particularite }
}

/**
 * Stade et groupe de relance d'un dossier de recouvrement : étape déduite des faits datés, protocole d'accord (groupe 6)
 * tant que l'échéancier est actif. Lit l'échéancier, pas la particularité du dossier. null pour un autre type de contentieux.
 */
export function relanceDuContentieux(
  dossier: DossierContentieux,
  suivi: SuiviEcheancier | null | undefined,
): { stade: CodeStadeRelance; groupe: CodeGroupeRelance } | null {
  const etape = etapeRecouvrementContentieux(dossier)
  return etape === null ? null : relanceDepuisEtape(etape, echeancierActif(suivi))
}
