import {
  ajouterJours,
  ajouterMois,
  composerDateIso,
  decomposerDateIso,
  estDateIsoValide,
  joursDansMois,
  verifierAujourdhui,
} from '@/lib/administrateur-judiciaire/domain/dates'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  CATEGORIES_ELEMENT,
  QUALIFICATIONS_ELEMENT,
  categorieDe,
  estFacturable,
  htParCategorie,
  montantFixePour,
  qualificationDe,
  totalElement,
  type CategorieElement,
  type ElementAFacturer,
  type FactureHonoraires,
  type QualificationElement,
  type TotauxElement,
} from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import {
  droitsTaxes,
  montantsFixesPar,
  type MandatRemunere,
  type MontantsFixes,
  type OrdonnanceRemuneration,
  type TypeOrdonnanceRemuneration,
} from '@/lib/administrateur-judiciaire/domain/ordonnances-remuneration'
import { portefeuille, ROLES_MANDAT, type AffectationMandat } from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'

/**
 * Tableau des honoraires (point 67 du bilan 2) : état des éléments d'honoraires d'une période, regroupés par mandat ou
 * par responsable du mandat, cumulés par qualification et, pour les facturables, par étape du cycle, par catégorie
 * (rémunération ou frais) et par destinataire.
 * Fonctions pures, montants en CENTIMES ENTIERS (totalElement), dates ISO, sans écran ni table.
 *
 * Sources Gestéam :
 * - 🟢 Tranche 43 § 13 : entrée « 8 - Tableau des honoraires », écran de paramètres d'une édition, fermé sans rien
 *   exécuter. Paramètres : Source · Cabinet · Compte du / au · Libellé · « Pas de mandat exclu » · Collaborateur ·
 *   Période (mois précédent par défaut) · Regroupement Mandat / Responsable · « Liste de contrôle » · « Produire une
 *   liste de … » · Titre · Test. 🔵 C'est l'état de contrôle mensuel des honoraires. ⚪ Les colonnes du résultat n'ont
 *   pas été observées : celles d'ici sont déduites des deux axes de l'élément (🔵).
 * - 🟢 Tranche 43 § 13 : Statut d'un élément (À facturer · Non facturé · Facturé · Imputé · Non imputé) et Traitement
 *   (Facturable · Offert · Contrôle coûts). 🔵 D'où trois étapes disjointes du cycle : « A facturer », « Facturé, non
 *   imputé » et « Imputé » ; un élément est imputé quand sa facture l'est (cycle de la facture, tranche 27).
 * - 🟢 Tranche 27 : l'entrée 8 est sous Syndic → Finances → Honoraires → 1 Honoraires de GESTION ; la recherche des
 *   éléments a un critère « Collaborateur + Portefeuille ». 🔵 Le filtre Collaborateur retient les mandats de son
 *   portefeuille (les trois rôles de RolesMandat, suivi-a-faire.ts) ; le regroupement Responsable lit le responsable
 *   du mandat. Un mandat sans responsable, ou absent des affectations, forme la ligne « null », en dernier.
 * - 🔵 Les offerts et le contrôle des coûts sont valorisés au prix de l'élément, à part des facturables ; seuls les
 *   facturables ont une étape du cycle, une catégorie et un destinataire.
 * - 🟢 Tranche 27 : la facture d'honoraires a un Type, « Facture » ou « Remboursement de frais » ; le plan observé lie
 *   62111 ↔ 901 « HONORAIRES ADMINSTRATEUR PROV » et 62120 ↔ 951 « DEBOURS ». 🔵 Gestéam sépare donc la rémunération
 *   et les frais : d'où les facturables par catégorie (categorieDe, honoraires-facturation.ts), rémunération (Vacations,
 *   Honoraires, Prestations) et frais (timbre, AR, copie, envois, diffuseurs) à part.
 *
 * Droit (relevé sur Légifrance) :
 * - Aucun texte lu n'impose un état mensuel des honoraires, ni un regroupement par responsable. Administration
 *   provisoire : le président du tribunal judiciaire fixe chaque année les acomptes « sur justification des diligences
 *   accomplies et au vu d'un compte provisoire détaillé des émoluments » (D. 1967 art. 61-1-5, II), et arrête la
 *   rémunération en fin de mission (III), le cas échéant « en considération des frais engagés, des prestations
 *   effectuées et de leur efficacité » (III, al. 2, qui ne joue que lorsque les droits proportionnels des art. 11 à 13
 *   de l'arrêté du 8 octobre 2015 dépassent 75 000 € HT : arrêté, art. 15 ; correction de J67, R5). 🔵 La période est
 *   libre (du / au), pour qu'un tableau puisse couvrir
 *   l'année de ce compte ; le mois précédent n'est que le défaut Gestéam. 🔵 Le tableau n'est pas ce compte : le texte
 *   parle d'émoluments, et un timbre ou un AR n'en est pas un. Les facturables par catégorie (facturablesParCategorie)
 *   séparent la rémunération des frais ; le compte ne reprend que les émoluments, les frais vont en annexe (J67, R5,
 *   ci-dessous).
 * - 🟢 L'administrateur provisoire exécute personnellement sa mission ; un tiers qui l'assiste est rétribué sur sa
 *   rémunération (L. 1965 art. 29-1, I, al. 2). 🔵 Le regroupement par responsable est un contrôle interne.
 * - 🟢 Règles professionnelles des AJ (arrêté du 18 juillet 2018, règle 810.4) : « un tableau de contrôle des
 *   émoluments » par affaire. 🔵 C'est le regroupement par mandat.
 * - 🟢 Les frais et honoraires du syndic afférents aux prestations faites au profit d'un copropriétaire sont à sa seule
 *   charge (L. 1965 art. 10-1, b ; contrat type, point 9). D'où le cumul des facturables par destinataire.
 * - 🟢 La désignation d'un AP met fin de plein droit au contrat de syndic (contrat type, point 10). 🔵 Par mandat, une
 *   ligne relève d'un seul régime ; par responsable, une ligne peut mêler syndic et administration provisoire.
 *
 * Décision de Hugo du 17/11/2026 (registre des décisions juridiques, J67 : recommandations validées en bloc) :
 * - J67, R4 : par prudence, les règles 810.4, 900.2 et 900.3 valent en administration provisoire. Elles « régissent
 *   l'activité de tous » les AJ et leurs missions de C. com. L. 811-1 ; la loi impose à l'administrateur provisoire non
 *   AJ « les mêmes obligations que celles qui s'imposent aux administrateurs judiciaires » (L. 1965 art. 29-1, III,
 *   dernier al.) ; le décret appelle « émoluments » sa rémunération (D. 1967 art. 61-1-5, II) et prévoit un compte rendu
 *   de fin de mission (art. 62-11, I, al. 2). suiviDesEmoluments tient, par mandat et par catégorie, les émoluments
 *   taxés (ordonnances d'acompte, de provision ou de fin de mission : ordonnances-remuneration.ts), le droit fixe, le
 *   perçu (factures imputées) et le restant à percevoir ; etatDeFinDeMission sort la synthèse par catégorie, les
 *   rétributions versées aux tiers (le tiers désigné par le juge pour assister l'administrateur, L. 1965 art. 29-1, I,
 *   al. 2) avec les ordonnances qui les ont fixées (règle 900.2), et le restant à percevoir (règle 900.3). Limites : les
 *   règles 900.x emploient le vocabulaire des procédures collectives, et l'arrêté n'a été lu qu'en version initiale.
 *   🔵 Les catégories sont celles du code (rémunération, frais), pas les droits du tarif (fixe, gestion courante,
 *   proportionnels, hors tarif), que les éléments ne portent pas. Enregistrement des ordonnances et des rétributions :
 *   à brancher (écrans : Frédéric).
 * - J67, R5 (recommandation L1-09) : administration provisoire, les frais (natures Timbre, AR, Copie, envois,
 *   diffuseurs) ne sont pas remboursés automatiquement au cabinet : le tarif ne parle que de droits fixes, de droits
 *   proportionnels et d'actes hors tarif (D. 1967 art. 61-1-5, I ; arrêté du 8 octobre 2015), et ne cite les frais que
 *   comme critère de fixation par le juge (arrêté, art. 3 et 8, III, dernier al. ; art. 15 et D. 1967 art. 61-1-5, III,
 *   al. 2, pour les seuls droits proportionnels au-delà de 75 000 € HT). Choix actuel confirmé : le tableau les cumule à
 *   part de la rémunération (facturablesParCategorie), sans rien en déduire. Ils ne sont jamais facturés sans une
 *   ordonnance qui les couvre (preparerFacture, J67, R3). Ils ne vont pas au compte provisoire détaillé des émoluments
 *   (61-1-5, II, qui ne vise que les émoluments) : ils iront dans son annexe « frais et débours exposés », demandés au
 *   juge avec la rémunération (Cass. 3e civ., 21 mai 2026, n° 24-20.377 ; Cass. 2e civ., 3 mars 2016, n° 15-12.129).
 *   L'annexe viendra avec le compte provisoire, qui n'existe pas encore dans le code. J72 (décision de Hugo du
 *   18/11/2026) : (a) l'envoi de la mise en demeure ou d'une relance d'un copropriétaire en retard est une dépense du
 *   syndicat, payée sur la pièce du prestataire postal et imputée au copropriétaire (L. 1965 art. 10-1, a ; R6) : pas
 *   un élément facturable du cabinet ; sa trace éventuelle, en Contrôle coûts (etapes-courrier.ts), reste hors des
 *   facturables ; (b) les autres envois sont des frais du cabinet, comme ci-dessus : annexe « frais et débours »,
 *   payés en vertu de l'ordonnance (C. com. R. 814-27 ; R5), signalés « à présenter au juge » dans honoraires-sinistre.ts.
 *   Le tableau ne change pas.
 *
 * Partie C des questions ouvertes du code (pratique du cabinet ; recommandations acceptées le 20/11/2026) :
 * - Décision du 20/11/2026 (partie C, F3) : le compte provisoire détaillé des émoluments présenté au juge couvre, par
 *   défaut, l'année de mission, comptée depuis la date de désignation enregistrée sur le mandat, avec une période
 *   modifiable : periodeAnneeDeMission (année n, du / au) et anneeDeMissionAu (rang de l'année qui contient une date) ;
 *   toute autre période reste possible (du / au libres). Le tableau mensuel reste un contrôle interne
 *   (MENTION_TABLEAU_HONORAIRES) : periodeMoisPrecedent reste son défaut. Si le tribunal pratique l'année civile, on
 *   change le défaut. Fondements : aucun texte ne fixe la période ; le président fixe les acomptes « chaque année »
 *   (D. 1967 art. 61-1-5, II) ; l'administrateur rend compte « au moins une fois par an », le décret comptant « la
 *   première année de la mission » (art. 62-11, I) ; le tarif ne parle d'« année de gestion » que pour 2 à 15 lots
 *   (arrêté du 8 octobre 2015, art. 5, al. 2) ; aucun texte n'impose un état mensuel (la seule assiette mensuelle du
 *   tarif est le droit fixe de gestion courante, art. 5). Anniversaires comptés depuis la désignation (dates.ajouterMois) :
 *   une désignation du 29 février a son anniversaire le 28 février des années non bissextiles, comme le devis de la
 *   décision du 17/11/2026 (Q3). La date de désignation est la date de l'ordonnance enregistrée sur le mandat
 *   (MandatEnregistre.ordonnance ; dateOrdonnance du moteur de délais, construireContexteMandat), passée par l'appelant
 *   en ISO : jamais la date de création de la copropriété, que la vue prend à défaut de mandat (fusionnerCoproMandat).
 *   Le compte provisoire lui-même n'existe pas encore dans le code.
 *
 * Questions ouvertes :
 * - 🔴 (Frédéric) Sur quoi porte le tableau : la date de l'élément (choix actuel), celle de la facture ou celle de
 *   l'imputation ? Et sa source : les éléments (choix actuel), les factures, ou les comptes (critère « Compte du / au ») ?
 * - 🔴 (Frédéric ou Hugo) Le regroupement « Responsable » vise-t-il le responsable du mandat (choix actuel, RolesMandat)
 *   ou le Collaborateur de la fiche élément (tranche 27) ? Est-il réservé au contrôle interne, sans jamais être présenté
 *   au juge (L. 1965 art. 29-1, I, al. 2) ? Faut-il y séparer syndic et administration provisoire ?
 * - 🔴 (Frédéric) Sens de « Pas de mandat exclu », « Liste de contrôle », « Produire une liste de … », Source, Cabinet
 *   et Libellé : non modélisés.
 * - 🔴 (Frédéric) Statut du mandat (point 55, statut-mandat.ts) : le tableau garde-t-il les éléments des mandats
 *   Prospect et Archivé ? Choix actuel : oui, avec ou sans filtre Collaborateur (portefeuille en portée « tous ») : les
 *   honoraires d'un mandat archivé datés de la période restent à contrôler (🔵). « Pas de mandat exclu » pourrait être ce
 *   réglage ; son sens n'est pas établi (question précédente).
 * - 🔴 (Frédéric) Le contrôle des coûts doit-il être valorisé au prix de l'élément ? Choix actuel : oui.
 * - 🔴 (Frédéric) Les échéances du scénario de gestion courante (echeancesScenario) entrent-elles dans le tableau ?
 *   Choix actuel : non, seuls les éléments.
 * - 🔴 (Frédéric ou Hugo) Les déductions (réduction de 25 % après un mandat ad hoc, arrêté du 8 octobre 2015, art. 2 ;
 *   sommes de l'assureur et pénalités du contrat type, 6.1, 6.2, 7.2.4) doivent-elles figurer au tableau ? Non modélisé.
 *
 * Branchements à faire plus tard (fichiers hors de ce point) : etats-comptables.ts, « Tableau des honoraires » passe à
 * calcule: true (et son test) ; db/schema.ts, champ qualification de la future table des éléments ; écrans des
 * paramètres et du rendu (Frédéric).
 */

export const REGROUPEMENTS_TABLEAU_HONORAIRES = ['Mandat', 'Responsable'] as const
export type RegroupementTableauHonoraires = (typeof REGROUPEMENTS_TABLEAU_HONORAIRES)[number]
const REGROUPEMENTS_CONNUS: ReadonlySet<string> = new Set(REGROUPEMENTS_TABLEAU_HONORAIRES)

/** 🔵 Étapes disjointes du cycle d'un élément (statuts de la tranche 43 § 13). */
export const ETAPES_CYCLE_ELEMENT = ['A facturer', 'Facturé, non imputé', 'Imputé'] as const
export type EtapeCycleElement = (typeof ETAPES_CYCLE_ELEMENT)[number]

export interface CumulHonoraires {
  nombre: number
  htCentimes: number
  tvaCentimes: number
  ttcCentimes: number
}

export interface CumulDestinataire {
  destinataire: string
  cumul: CumulHonoraires
}

export interface CumulsHonoraires {
  /** Tous les éléments, par qualification : les offerts et le contrôle des coûts sont valorisés à part. */
  parQualification: Record<QualificationElement, CumulHonoraires>
  /** Éléments facturables seulement, par étape du cycle. */
  facturablesParEtape: Record<EtapeCycleElement, CumulHonoraires>
  /** Éléments facturables seulement, rémunération (émoluments, honoraires) et frais à part (categorieDe). */
  facturablesParCategorie: Record<CategorieElement, CumulHonoraires>
  /** Éléments facturables seulement, par destinataire (L. 1965 art. 10-1, b), dans l'ordre alphabétique. */
  facturablesParDestinataire: CumulDestinataire[]
}

export interface LigneTableauHonoraires extends CumulsHonoraires {
  /** Le mandat, ou le responsable du mandat ; null : mandat sans responsable ou sans affectation. */
  cle: string | null
  mandatIds: string[]
}

export interface ParametresTableauHonoraires {
  /** Bornes incluses, sur la date de l'élément (🔴 question). */
  du: string
  au: string
  regroupement: RegroupementTableauHonoraires
  /** Seuls les mandats de son portefeuille (les trois rôles) ; tous les mandats si absent. */
  collaborateurId?: string
}

export interface TableauHonoraires {
  du: string
  au: string
  regroupement: RegroupementTableauHonoraires
  collaborateurId: string | null
  lignes: LigneTableauHonoraires[]
  /** Somme des lignes. */
  total: CumulsHonoraires
}

/** 🟢 Période par défaut du tableau : le mois précédent, du premier au dernier jour. */
export function periodeMoisPrecedent(aujourdhui: string): { du: string; au: string } {
  verifierAujourdhui(aujourdhui)
  const { a, m } = decomposerDateIso(aujourdhui)
  const precedent = decomposerDateIso(ajouterMois(composerDateIso(a, m, 1), -1))
  return {
    du: composerDateIso(precedent.a, precedent.m, 1),
    au: composerDateIso(precedent.a, precedent.m, joursDansMois(precedent.a, precedent.m)),
  }
}

/**
 * Décision du 20/11/2026 (partie C, F3) : le tableau mensuel reste un contrôle interne ; le compte provisoire présenté
 * au juge couvre par défaut l'année de mission. Mention à afficher avec l'écran du tableau.
 */
export const MENTION_TABLEAU_HONORAIRES =
  "Tableau de contrôle interne du cabinet : ce n'est pas le compte provisoire détaillé des émoluments présenté au juge " +
  "(D. 1967 art. 61-1-5, II), qui couvre par défaut l'année de mission, comptée depuis la date de désignation."

function verifierDateDesignation(dateDesignation: string): void {
  if (!estDateIsoValide(dateDesignation)) throw new Error(`Date de désignation invalide (${dateDesignation}) : AAAA-MM-JJ attendu.`)
}

/**
 * Année de mission n (décision du 20/11/2026, partie C, F3), période par défaut du compte provisoire : du (n − 1)-ième
 * anniversaire de la désignation (la désignation elle-même pour n = 1) à la veille du n-ième. Chaque anniversaire est
 * compté depuis la désignation (dates.ajouterMois) : les années se suivent sans trou ni chevauchement.
 */
export function periodeAnneeDeMission(dateDesignation: string, n: number): { du: string; au: string } {
  verifierDateDesignation(dateDesignation)
  if (!Number.isInteger(n) || n < 1) throw new Error(`Année de mission invalide (${n}) : entier à partir de 1 attendu.`)
  return { du: ajouterMois(dateDesignation, 12 * (n - 1)), au: ajouterJours(ajouterMois(dateDesignation, 12 * n), -1) }
}

/** Rang de l'année de mission qui contient `date` (décision du 20/11/2026, partie C, F3) ; avant la désignation : refus. */
export function anneeDeMissionAu(dateDesignation: string, date: string): number {
  verifierDateDesignation(dateDesignation)
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (date < dateDesignation) throw new Error(`Date ${date} antérieure à la désignation (${dateDesignation}) : hors de la mission.`)
  const ecartAnnees = decomposerDateIso(date).a - decomposerDateIso(dateDesignation).a
  return date >= ajouterMois(dateDesignation, 12 * ecartAnnees) ? ecartAnnees + 1 : ecartAnnees
}

/** Éléments des factures imputées. */
export function elementsImputes(factures: readonly FactureHonoraires[]): Set<string> {
  return new Set(factures.filter((f) => f.statut === 'Imputée').flatMap((f) => f.lignes.map((l) => l.elementId)))
}

export function etapeCycleElement(element: ElementAFacturer, imputes: ReadonlySet<string>): EtapeCycleElement {
  if (element.statut === 'A facturer') return 'A facturer'
  return imputes.has(element.id) ? 'Imputé' : 'Facturé, non imputé'
}

const cumulVide = (): CumulHonoraires => ({ nombre: 0, htCentimes: 0, tvaCentimes: 0, ttcCentimes: 0 })

const ajouterAuCumul = (cumul: CumulHonoraires, totaux: TotauxElement): CumulHonoraires => ({
  nombre: cumul.nombre + 1,
  htCentimes: cumul.htCentimes + totaux.htCentimes,
  tvaCentimes: cumul.tvaCentimes + totaux.tvaCentimes,
  ttcCentimes: cumul.ttcCentimes + totaux.ttcCentimes,
})

const cumulsVides = <C extends string>(cles: readonly C[]): Record<C, CumulHonoraires> =>
  Object.fromEntries(cles.map((cle) => [cle, cumulVide()])) as Record<C, CumulHonoraires>

/** Cumuls d'une ligne ou du total, propres au calcul (jamais rendus tels quels). */
interface Accumulateur {
  mandatIds: Set<string>
  parQualification: Record<QualificationElement, CumulHonoraires>
  facturablesParEtape: Record<EtapeCycleElement, CumulHonoraires>
  facturablesParCategorie: Record<CategorieElement, CumulHonoraires>
  parDestinataire: Map<string, CumulHonoraires>
}

const accumulateurVide = (): Accumulateur => ({
  mandatIds: new Set(),
  parQualification: cumulsVides(QUALIFICATIONS_ELEMENT),
  facturablesParEtape: cumulsVides(ETAPES_CYCLE_ELEMENT),
  facturablesParCategorie: cumulsVides(CATEGORIES_ELEMENT),
  parDestinataire: new Map(),
})

function accumuler(accumulateur: Accumulateur, element: ElementAFacturer, imputes: ReadonlySet<string>): void {
  const totaux = totalElement(element)
  const qualification = qualificationDe(element)
  accumulateur.mandatIds.add(element.mandatId)
  accumulateur.parQualification[qualification] = ajouterAuCumul(accumulateur.parQualification[qualification], totaux)
  if (!estFacturable(element)) return
  const etape = etapeCycleElement(element, imputes)
  accumulateur.facturablesParEtape[etape] = ajouterAuCumul(accumulateur.facturablesParEtape[etape], totaux)
  const categorie = categorieDe(element)
  accumulateur.facturablesParCategorie[categorie] = ajouterAuCumul(accumulateur.facturablesParCategorie[categorie], totaux)
  const parDestinataire = accumulateur.parDestinataire.get(element.destinataire) ?? cumulVide()
  accumulateur.parDestinataire.set(element.destinataire, ajouterAuCumul(parDestinataire, totaux))
}

const comparerTextes = (a: string, b: string): number => a.localeCompare(b, 'fr')

/** Clés croissantes, null en dernier. */
function comparerCles(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return comparerTextes(a, b)
}

function cumulsDe(accumulateur: Accumulateur): CumulsHonoraires {
  return {
    parQualification: accumulateur.parQualification,
    facturablesParEtape: accumulateur.facturablesParEtape,
    facturablesParCategorie: accumulateur.facturablesParCategorie,
    facturablesParDestinataire: [...accumulateur.parDestinataire.entries()]
      .sort(([a], [b]) => comparerTextes(a, b))
      .map(([destinataire, cumul]) => ({ destinataire, cumul })),
  }
}

function verifierParametres({ du, au, regroupement, collaborateurId }: ParametresTableauHonoraires): void {
  for (const date of [du, au]) if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (du > au) throw new Error(`Période invalide : du ${du} au ${au}.`)
  if (!REGROUPEMENTS_CONNUS.has(regroupement)) throw new Error(`Regroupement inconnu : « ${regroupement} ».`)
  if (collaborateurId?.trim() === '') throw new Error('Collaborateur : identifiant vide.')
}

/** Responsable de chaque mandat affecté ; un mandat affecté deux fois est refusé. */
function responsablesParMandat(affectations: readonly AffectationMandat[]): Map<string, string | null> {
  const responsables = new Map<string, string | null>()
  for (const { mandatId, responsableId } of affectations) {
    if (responsables.has(mandatId)) throw new Error(`Mandat ${mandatId} : affecté deux fois.`)
    responsables.set(mandatId, responsableId)
  }
  return responsables
}

/**
 * Mandats retenus : le portefeuille du collaborateur (les trois rôles), ou tous s'il n'est pas donné. Quel que soit le
 * statut du mandat (portée « tous », point 55) : les honoraires d'un mandat archivé, datés de la période, restent à
 * contrôler (🔵 ; 🔴 à confirmer par Frédéric, question « Statut du mandat » de l'en-tête).
 */
function filtreDesMandats(collaborateurId: string | null, affectations: readonly AffectationMandat[]): (mandatId: string) => boolean {
  if (collaborateurId === null) return () => true
  const mandats = portefeuille(collaborateurId, [...affectations], ROLES_MANDAT, 'tous')
  return (mandatId) => mandats.has(mandatId)
}

/**
 * Tableau des honoraires de la période : éléments datés du `du` au `au` inclus (et du portefeuille du collaborateur
 * s'il est donné), une ligne par mandat ou par responsable du mandat. `factures` sert à reconnaître les éléments
 * imputés ; sans elle, un élément facturé est « Facturé, non imputé ».
 */
export function tableauDesHonoraires(
  elements: readonly ElementAFacturer[],
  affectations: readonly AffectationMandat[],
  parametres: ParametresTableauHonoraires,
  factures: readonly FactureHonoraires[] = [],
): TableauHonoraires {
  verifierParametres(parametres)
  const { du, au, regroupement } = parametres
  const collaborateurId = parametres.collaborateurId ?? null
  const responsables = responsablesParMandat(affectations)
  const mandatRetenu = filtreDesMandats(collaborateurId, affectations)
  const cleDe = (mandatId: string): string | null => (regroupement === 'Mandat' ? mandatId : (responsables.get(mandatId) ?? null))
  const imputes = elementsImputes(factures)
  const lignes = new Map<string | null, Accumulateur>()
  const total = accumulateurVide()
  for (const element of elements.filter((e) => e.date >= du && e.date <= au && mandatRetenu(e.mandatId))) {
    const cle = cleDe(element.mandatId)
    const ligne = lignes.get(cle) ?? accumulateurVide()
    lignes.set(cle, ligne)
    accumuler(ligne, element, imputes)
    accumuler(total, element, imputes)
  }
  return {
    du,
    au,
    regroupement,
    collaborateurId,
    lignes: [...lignes.entries()]
      .sort(([a], [b]) => comparerCles(a, b))
      .map(([cle, accumulateur]) => ({ cle, mandatIds: [...accumulateur.mandatIds].sort(comparerTextes), ...cumulsDe(accumulateur) })),
    total: cumulsDe(total),
  }
}

/** Émoluments d'une catégorie d'un mandat (J67, R4 ; règles professionnelles 810.4 et 900.3). Montants HT en centimes. */
export interface SuiviCategorieEmoluments {
  /** Fixé par les ordonnances (acomptes, provisions ; ou fin de mission, qui arrête tout), décision sur recours comprise. */
  taxeHtCentimes: number
  /** Droit fixe de l'AP de l'art. 29-1 sous 500 lots, dû sans ordonnance ; 0 dès que la fin de mission est rendue (🔵). */
  droitFixeHtCentimes: number
  /** HT des factures imputées. */
  percuHtCentimes: number
  /** Taxé + droit fixe − perçu ; négatif : perçu au-delà du taxé, à vérifier. */
  resteAPercevoirHtCentimes: number
}

export interface SuiviEmolumentsMandat {
  mandatId: string
  parCategorie: Record<CategorieElement, SuiviCategorieEmoluments>
  /** Ordonnances retenues pour le taxé (la seule fin de mission, quand elle est rendue). */
  ordonnanceIds: string[]
}

/**
 * Émoluments taxés, perçus et restant à percevoir d'un mandat, par catégorie (J67, R4) : taxé par toutes les ordonnances
 * rendues (droitsTaxes), perçu par les factures imputées du mandat (honoraires-facturation.ts, htParCategorie).
 */
export function suiviDesEmoluments(
  mandatId: string,
  mandat: MandatRemunere,
  ordonnances: readonly OrdonnanceRemuneration[],
  factures: readonly FactureHonoraires[],
): SuiviEmolumentsMandat {
  const droits = droitsTaxes(mandatId, mandat, ordonnances)
  const percu = htParCategorie(factures.filter((f) => f.mandatId === mandatId && f.statut === 'Imputée'))
  const suivi = (categorie: CategorieElement): SuiviCategorieEmoluments => {
    const fixe = montantFixePour(categorie, droits)
    const droitFixeHtCentimes = categorie === 'Rémunération' ? droits.droitFixeHtCentimes : 0
    return {
      taxeHtCentimes: fixe - droitFixeHtCentimes,
      droitFixeHtCentimes,
      percuHtCentimes: percu[categorie],
      resteAPercevoirHtCentimes: fixe - percu[categorie],
    }
  }
  return {
    mandatId,
    parCategorie: Object.fromEntries(CATEGORIES_ELEMENT.map((c) => [c, suivi(c)])) as Record<CategorieElement, SuiviCategorieEmoluments>,
    ordonnanceIds: droits.ordonnanceIds,
  }
}

/**
 * Rétribution d'un tiers désigné par le juge pour assister l'administrateur provisoire, payée sur sa rémunération
 * (L. 1965 art. 29-1, I, al. 2 ; règle professionnelle 900.2). Enregistrement : à brancher.
 */
export interface RetributionTiers {
  id: string
  mandatId: string
  /** Qualité du tiers (sa fonction dans la mission). */
  tiers: string
  date: string
  montantHtCentimes: number
  /** Référence de l'ordonnance qui l'a fixée ; null : aucune enregistrée (signalée). */
  ordonnance: string | null
}

export interface OrdonnanceDeLEtat {
  id: string
  type: TypeOrdonnanceRemuneration
  date: string
  /** Montants fixés, ou ceux de la décision sur le recours. */
  montants: MontantsFixes
  /** Retenue pour le taxé (une fin de mission rendue écarte les acomptes et les provisions). */
  retenue: boolean
}

/** État de fin de mission (J67, R4 ; règles professionnelles 900.2 et 900.3). */
export interface EtatFinDeMission {
  mandatId: string
  /** Synthèse par catégorie : taxé, droit fixe, perçu, restant à percevoir. */
  emoluments: Record<CategorieElement, SuiviCategorieEmoluments>
  /** Toutes les ordonnances du mandat, dans l'ordre reçu. */
  ordonnances: OrdonnanceDeLEtat[]
  retributionsTiers: RetributionTiers[]
  totalRetributionsTiersHtCentimes: number
  /** Restant à percevoir, toutes catégories (règle 900.3). */
  resteAPercevoirHtCentimes: number
  /** Rétribution sans ordonnance, perçu au-delà du taxé. */
  signalements: string[]
}

const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)

function verifierRetributions(mandatId: string, retributions: readonly RetributionTiers[]): void {
  const ids = new Set<string>()
  for (const r of retributions) {
    if (!r.id.trim()) throw new Error('Rétribution sans identifiant.')
    if (r.mandatId !== mandatId) throw new Error(`Rétribution ${r.id} : elle vise un autre mandat (${r.mandatId}).`)
    if (ids.has(r.id)) throw new Error(`Rétribution ${r.id} : fournie deux fois.`)
    ids.add(r.id)
    if (!r.tiers.trim()) throw new Error(`Rétribution ${r.id} : tiers non renseigné.`)
    // Une référence blanche passerait pour une ordonnance enregistrée et masquerait le signalement de la règle 900.2.
    if (r.ordonnance !== null && !r.ordonnance.trim())
      throw new Error(`Rétribution ${r.id} : référence d'ordonnance vide ; null attendu si aucune n'est enregistrée.`)
    if (!estDateIsoValide(r.date)) throw new Error(`Rétribution ${r.id} : date invalide (${r.date}), AAAA-MM-JJ attendu.`)
    if (!Number.isSafeInteger(r.montantHtCentimes) || r.montantHtCentimes < 0)
      throw new Error(`Rétribution ${r.id} : montant invalide (${r.montantHtCentimes}), centimes entiers positifs ou nuls attendus.`)
  }
}

/**
 * État de fin de mission d'un mandat (J67, R4) : émoluments par catégorie (taxés, perçus, restant à percevoir), toutes les
 * ordonnances, rétributions des tiers avec l'ordonnance qui les a fixées (règle 900.2), restant à percevoir (900.3).
 */
export function etatDeFinDeMission(
  mandatId: string,
  mandat: MandatRemunere,
  ordonnances: readonly OrdonnanceRemuneration[],
  factures: readonly FactureHonoraires[],
  retributions: readonly RetributionTiers[],
): EtatFinDeMission {
  verifierRetributions(mandatId, retributions)
  const { parCategorie, ordonnanceIds } = suiviDesEmoluments(mandatId, mandat, ordonnances, factures)
  const retenues = new Set(ordonnanceIds)
  const signalements = [
    ...retributions
      .filter((r) => r.ordonnance === null)
      .map((r) => `Rétribution ${r.id} (${r.tiers}) sans ordonnance enregistrée : la règle professionnelle 900.2 demande l'ordonnance qui l'a fixée.`),
    ...CATEGORIES_ELEMENT.filter((c) => parCategorie[c].resteAPercevoirHtCentimes < 0).map(
      (c) => `${c} : perçu au-delà du taxé (${euros(-parCategorie[c].resteAPercevoirHtCentimes)} HT), à vérifier.`,
    ),
  ]
  return {
    mandatId,
    emoluments: parCategorie,
    ordonnances: ordonnances.map((o) => ({ id: o.id, type: o.type, date: o.date, montants: montantsFixesPar(o), retenue: retenues.has(o.id) })),
    retributionsTiers: [...retributions],
    totalRetributionsTiersHtCentimes: retributions.reduce((s, r) => s + r.montantHtCentimes, 0),
    resteAPercevoirHtCentimes: CATEGORIES_ELEMENT.reduce((s, c) => s + parCategorie[c].resteAPercevoirHtCentimes, 0),
    signalements,
  }
}
