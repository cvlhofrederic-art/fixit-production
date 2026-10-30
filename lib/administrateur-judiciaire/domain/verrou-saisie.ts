import { ajouterJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Exercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import type { PlanComptable } from '@/lib/administrateur-judiciaire/domain/plan-comptable'
import type { FamilleTraitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { FAMILLE_TRAITEMENT } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Verrouillage de la saisie comptable (point 27 du bilan). Fonctions pures, dates ISO, sans écran ni table. Une BORNE
 * verrouille toutes les dates comptables jusqu'à `jusquAu` INCLUS, pour les écritures qu'elle vise ; creerTraitement et
 * annulerTraitement (traitements.ts) refusent une écriture couverte par une borne. Les bornes se recalculent à chaque
 * appel à partir de leur source (édition figée, exercice clos, fiche du plan), jamais stockées. Rien ici ne lève une
 * borne : aucune fonction ne défige une édition, et la borne de l'arrêté ne se lève pas (arrêté du 14 mars 2005, art. 5 :
 * la clôture garantit « l'intangibilité des enregistrements » ; réouverture d'un exercice clos : 🔴 ci-dessous). Seule la
 * limite du plan suit sa fiche.
 *
 * Gestéam — 🟢 lu dans la cartographie :
 * - tranche 37 § Mouvements : onglet Statut « Inclus dans une édition », « Éditable » ; recherche « Édition », « Déjà
 *   inclus dans une édition » ; en-tête « Ne pas éditer » ; les apports y lisent l'inclusion comme un verrouillage ;
 * - tranche 13 : fiche du plan comptable, « Limite inférieure de saisie de mouvement » (PlanComptable.limiteInferieureSaisie) ;
 *   fiche du journal, bloc « Limite inférieure de date » (date + « Contrôler ») = verrouillage de période (R2), confirmé
 *   en usage réel en tranche 24.
 *
 * Spécification d’intégration VitFix — 🟢 lu dans 03_LOT2_COMPTABILITE.md, T24 (texte VitFix, pas la cartographie) : un
 * journal dont controlerDateLimite est vrai refuse toute date comptable antérieure à dateLimiteSaisie ; le refus dit quelle
 * date limite s'applique ; le verrou porte sur la date comptable, pas sur la date d'enregistrement.
 *
 * Le droit — 🟢 lu sur Légifrance le 29/10/2026 :
 * - loi n° 65-557, art. 14-3, al. 1 : « Les comptes du syndicat comprenant le budget prévisionnel, les charges et produits
 *   de l'exercice, la situation de trésorerie, ainsi que les annexes au budget prévisionnel sont établis conformément à
 *   des règles comptables spécifiques fixées par décret » ; al. 3 : les articles 1er à 5 de la loi n° 98-261 du 6 avril
 *   1998 « ne sont pas applicables aux syndicats de copropriétaires » (loi n° 98-261 elle-même non lue) ;
 * - arrêté du 14 mars 2005 relatif aux comptes du syndicat, art. 5 : documents tenus « sans altération et sans blanc » ;
 *   « Une écriture erronée est annulée par une écriture contraire » ; « Une procédure de clôture destinée à figer la
 *   chronologie et à garantir l'intangibilité des enregistrements est mise en oeuvre à la date d'arrêté des comptes » ;
 * - décret n° 2005-240 du 14 mars 2005, art. 5 : « Les comptes sont arrêtés à la date de clôture de l'exercice » ;
 * - arrêté du 14 mars 2005, art. 2 : livre journal et grand livre « cotés sans discontinuité », « numérotés et datés dès
 *   leur établissement » ; le seul « édite » vise les deux balances générales ;
 * - arrêté du 14 mars 2005, art. 8 : les règles du plan comptable général « ne peuvent pas être appliquées pour détailler
 *   les comptes retenus par le présent plan comptable » ;
 * - plan comptable général (PCG, règlement ANC n° 2014-03) dans sa VERSION INITIALE seulement (arrêté d'homologation du
 *   8 septembre 2014, publié au JO ; Légifrance n'en a pas de version consolidée ; règlements modificatifs non lus) :
 *   art. 111-1, il s'applique à toute personne « soumise à l'obligation légale d'établir des comptes annuels comprenant
 *   le bilan, le compte de résultat et une annexe » ; art. 921-4, al. 3 : en comptabilité informatisée, l'opération
 *   d'une période déjà figée par la clôture est enregistrée au premier jour de la période non encore clôturée, avec
 *   mention expresse de sa date de survenance.
 *
 * 🔵 Déduit :
 * - PCG, art. 921-4 : non repris. Les comptes du syndicat suivent des règles spécifiques fixées par décret (loi,
 *   art. 14-3, al. 1) et ne sont pas les comptes annuels « bilan, compte de résultat, annexe » du PCG, art. 111-1.
 *   L'arrêté, art. 8, n'écarte le PCG que pour détailler les comptes : il ne fonde pas seul ce choix ;
 * - borne de l'ARRÊTÉ = date de clôture de l'exercice (« date d'arrêté des comptes » de l'arrêté = « date de clôture » du
 *   décret), INCLUSE ; elle n'est posée qu'une fois la procédure de clôture exécutée, car les écritures d'inventaire
 *   (rattachements, compte 47, compte 12, répartition 450/701) se passent après coup en date de fin d'exercice ;
 * - LIMITE DU PLAN : T24, écrite pour la limite du journal, est appliquée à la limite du plan ; la date L elle-même est
 *   donc acceptée (seul ce qui lui est antérieur est refusé), d'où une borne à la veille de L, limitée au code du plan
 *   (segment 2 du compte, y compris sur un compte « ____ ») ;
 * - borne d'ÉDITION = fin de la période éditée, INCLUSE, limitée aux comptes et aux familles de l'édition ; les dates
 *   antérieures au début de la période sont verrouillées aussi (chronologie figée ; le report du grand livre en dépend) ;
 * - ANNULATION : la contre-passation est contrôlée sur SA date ; un traitement d'une période verrouillée reste annulable
 *   par une écriture contraire datée après la borne (arrêté, art. 5) ;
 * - refus atomique : une seule ligne visée suffit à refuser tout le traitement ; une écriture mal formée (montant, compte)
 *   est refusée pour ce motif avant tout contrôle du verrou ;
 * - périmètre : une liste absente vise tout ; une liste vide, une famille inconnue ou une plage de comptes inversée sont
 *   refusées (elles donneraient une borne qui ne verrouille rien sans le dire) ;
 * - le verrou passé est celui du syndicat du traitement (l'appelant le compose).
 *
 * 🔴 Non établi (question pour Hugo ou Frédéric ; « non trouvé » = cherché sans résultat dans les textes lus ci-dessus,
 * les annexes 1 à 5 du décret n° 2005-240 et le PCG consolidé n'ayant pas été lus) :
 * - non trouvé : aucun texte propre au syndicat ne rattache un verrou à une édition ; le marquage « inclus dans une
 *   édition » est une pratique du logiciel (tranche 37) ;
 * - « Un exercice dont la procédure de clôture est exécutée peut-il être rouvert, et par quel acte tracé ? » (non
 *   trouvé ; en attendant la réponse, la borne de l'arrêté ne se lève pas) ;
 * - « Quel acte pose la borne de l'arrêté : le passage de l'exercice au statut « Réparti », l'approbation des comptes par
 *   l'AG, ou une action explicite « Clôturer l'exercice » ? » (borneArreteDesComptes ne se prononce pas : l'appelant ne la
 *   compose que pour un exercice clos) ;
 * - « La lecture stricte du bilan (« ni annulé ») doit-elle aussi refuser l'annulation d'un traitement dont la date est
 *   verrouillée, même par une contre-passation datée dans la période ouverte ? » (non retenu : l'art. 5 de l'arrêté impose
 *   de corriger par une écriture contraire) ;
 * - « À quelle date enregistrer une opération qui se rapporte à une période close (rejet de prélèvement, facture
 *   tardive) ? » (non trouvé dans les textes propres au syndicat ; ici, l'appelant choisit une date hors verrou) ;
 * - « Quelle édition Gestéam pose « Inclus dans une édition » : définitive seulement, ou aussi provisoire ? Que veulent
 *   dire « Éditable » et « Ne pas éditer » ? » (non repris) ;
 * - verrou du JOURNAL (R2 : dateLimiteSaisie, controlerDateLimite) : Traitement ne porte pas de journal ; à brancher avec
 *   la table des journaux (Frédéric, D-BANQUE) par une nouvelle origine.
 * L'« arrêté » d'un rapprochement bancaire (rapprochement-bancaire.ts) est un homonyme : il ne pose aucune borne ici.
 */

export const ORIGINES_VERROU = ['edition', 'arrete', 'plan'] as const
export type OrigineVerrou = (typeof ORIGINES_VERROU)[number]

/** Ce que vise une borne, ou l'édition qui la fonde : une liste ou une plage absente vise tout. */
export interface PerimetreVerrou {
  /** Codes du plan visés (segment 2 du compte) ; absent : tous. */
  plans?: readonly string[]
  /** Plage de comptes visée, bornes incluses (numéro complet) ; absente : tous. */
  compteDu?: string
  compteAu?: string
  /** Familles de traitement visées ; absent : toutes. */
  familles?: readonly FamilleTraitement[]
}

export interface BorneVerrou extends PerimetreVerrou {
  /** Dernière date comptable verrouillée, INCLUSE (AAAA-MM-JJ). */
  jusquAu: string
  origine: OrigineVerrou
  /** Identifiant de l'édition, nom de l'exercice ou code du plan : cité dans le refus. */
  reference: string
}

export type VerrouSaisie = readonly BorneVerrou[]

/** Ce que le verrou contrôle d'une écriture : sa date comptable, sa famille et les comptes qu'elle mouvemente. */
export interface EcritureControlee {
  date: string
  famille: FamilleTraitement
  comptes: readonly string[]
}

/** Code du plan d'un compte « <syndicat>.<plan>.<auxiliaire>.0 », ou le compte lui-même s'il n'a pas de segment. */
export const planDuCompte = (compte: string): string => compte.split('.')[1] ?? compte

const DESIGNATION: Record<OrigineVerrou, string> = {
  edition: "l'édition",
  arrete: "l'arrêté des comptes de l'exercice",
  plan: 'la limite inférieure de saisie du plan',
}

const FAMILLES_CONNUES: ReadonlySet<string> = new Set(Object.values(FAMILLE_TRAITEMENT).flat())

/**
 * Défaut d'un périmètre, ou null. Une liste VIDE (qui ne viserait rien, alors qu'une liste absente vise tout), une famille
 * inconnue ou une plage de comptes inversée feraient une borne qui ne verrouille rien sans le dire : chacune est un
 * défaut. Sert à la borne (borneApplicable) et à l'édition qui la fonde (figerEdition, etats-comptables.ts).
 */
export function defautDuPerimetre({ plans, compteDu, compteAu, familles }: PerimetreVerrou): string | null {
  if (plans?.length === 0) return 'liste des plans vide'
  if (familles?.length === 0) return 'liste des familles vide'
  const inconnue = familles?.find((famille) => !FAMILLES_CONNUES.has(famille))
  if (inconnue !== undefined) return `famille inconnue « ${inconnue} »`
  if (compteDu !== undefined && compteAu !== undefined && compteDu > compteAu)
    return `plage de comptes inversée (du ${compteDu} au ${compteAu})`
  return null
}

function verifierBorne(borne: BorneVerrou): void {
  const probleme =
    [
      !(ORIGINES_VERROU as readonly string[]).includes(borne.origine) && `origine inconnue « ${borne.origine} »`,
      !estDateIsoValide(borne.jusquAu) && `date « ${borne.jusquAu} » (AAAA-MM-JJ attendu)`,
      (typeof borne.reference !== 'string' || !borne.reference.trim()) && 'référence absente',
    ].find(Boolean) || defautDuPerimetre(borne)
  if (probleme) throw new Error(`Borne de verrou invalide (${borne.origine} « ${borne.reference} ») : ${probleme}.`)
}

const viseLeCompte = (borne: BorneVerrou, compte: string): boolean =>
  (!borne.plans || borne.plans.includes(planDuCompte(compte))) &&
  (borne.compteDu === undefined || compte >= borne.compteDu) &&
  (borne.compteAu === undefined || compte <= borne.compteAu)

const couvre = (borne: BorneVerrou, { date, famille, comptes }: EcritureControlee): boolean =>
  date <= borne.jusquAu &&
  (!borne.familles || borne.familles.includes(famille)) &&
  comptes.some((compte) => viseLeCompte(borne, compte))

/**
 * Borne qui verrouille l'écriture, ou null : la plus tardive de celles qui couvrent sa date et visent sa famille et l'un de
 * ses comptes. Toute borne mal formée (origine, date, référence, périmètre : defautDuPerimetre) est refusée, même si elle
 * ne couvre pas la date.
 */
export function borneApplicable(verrou: VerrouSaisie, ecriture: EcritureControlee): BorneVerrou | null {
  if (!estDateIsoValide(ecriture.date)) throw new Error(`Date comptable invalide : « ${ecriture.date} » (AAAA-MM-JJ).`)
  let retenue: BorneVerrou | null = null
  for (const borne of verrou) {
    verifierBorne(borne)
    if (couvre(borne, ecriture) && (retenue === null || borne.jusquAu > retenue.jusquAu)) retenue = borne
  }
  return retenue
}

/** Refus qui dit quelle limite s'applique (critère T24). */
export const messageVerrou = (date: string, { jusquAu, origine, reference }: BorneVerrou): string =>
  `Date comptable ${date} verrouillée jusqu'au ${jusquAu} inclus par ${DESIGNATION[origine]} « ${reference} » : ` +
  `saisie possible à partir du ${ajouterJours(jusquAu, 1)}.`

/** Lève le refus si une borne verrouille l'écriture. */
export function controlerVerrou(verrou: VerrouSaisie, ecriture: EcritureControlee): void {
  const borne = borneApplicable(verrou, ecriture)
  if (borne) throw new Error(messageVerrou(ecriture.date, borne))
}

/**
 * Bornes tirées de la « Limite inférieure de saisie de mouvement » du plan comptable : une par entrée qui en porte une,
 * jusqu'à la veille de la limite, limitée au code de l'entrée. Une limite vide est une absence de limite.
 */
export function bornesDuPlan(entrees: readonly Pick<PlanComptable, 'code' | 'limiteInferieureSaisie'>[]): BorneVerrou[] {
  return entrees
    .filter((entree) => Boolean(entree.limiteInferieureSaisie))
    .map(({ code, limiteInferieureSaisie: limite = '' }): BorneVerrou => {
      if (!estDateIsoValide(limite))
        throw new Error(`Limite inférieure de saisie invalide pour le plan « ${code} » : « ${limite} » (AAAA-MM-JJ).`)
      return { jusquAu: ajouterJours(limite, -1), origine: 'plan', reference: code, plans: [code] }
    })
}

/**
 * Borne de l'arrêté des comptes d'un exercice (Exercice du domaine, exercices-budgets.ts) : sa date de clôture, incluse.
 * L'exercice est désigné par son nom (l'année chez Gestéam), comme dans les autres refus du domaine (appels-budget.ts).
 * 🔴 À composer seulement pour un exercice dont la procédure de clôture est exécutée ; elle ne se lève pas (voir l'en-tête).
 */
export function borneArreteDesComptes({ nom, cloture }: Pick<Exercice, 'nom' | 'cloture'>): BorneVerrou {
  const designation = nom.trim()
  if (!designation) throw new Error("Exercice sans nom : borne de l'arrêté des comptes impossible.")
  if (!estDateIsoValide(cloture))
    throw new Error(`Date de clôture invalide pour l'exercice « ${designation} » : « ${cloture} » (AAAA-MM-JJ).`)
  return { jusquAu: cloture, origine: 'arrete', reference: designation }
}
