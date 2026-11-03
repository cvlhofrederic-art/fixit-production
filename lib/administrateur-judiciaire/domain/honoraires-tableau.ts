import {
  ajouterMois,
  composerDateIso,
  decomposerDateIso,
  estDateIsoValide,
  joursDansMois,
  verifierAujourdhui,
} from '@/lib/administrateur-judiciaire/domain/dates'
import {
  CATEGORIES_ELEMENT,
  QUALIFICATIONS_ELEMENT,
  categorieDe,
  estFacturable,
  qualificationDe,
  totalElement,
  type CategorieElement,
  type ElementAFacturer,
  type FactureHonoraires,
  type QualificationElement,
  type TotauxElement,
} from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import { portefeuille, type AffectationMandat } from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'

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
 *   effectuées et de leur efficacité » (III, al. 2). 🔵 La période est libre (du / au), pour qu'un tableau puisse couvrir
 *   l'année de ce compte ; le mois précédent n'est que le défaut Gestéam. 🔵 Le tableau n'est pas ce compte : le texte
 *   parle d'émoluments, et un timbre ou un AR n'en est pas un. Les facturables par catégorie (facturablesParCategorie)
 *   séparent la rémunération des frais ; ce que le compte reprend reste à trancher (🔴 ci-dessous).
 * - 🟢 L'administrateur provisoire exécute personnellement sa mission ; un tiers qui l'assiste est rétribué sur sa
 *   rémunération (L. 1965 art. 29-1, I, al. 2). 🔵 Le regroupement par responsable est un contrôle interne.
 * - 🟢 Règles professionnelles des AJ (arrêté du 18 juillet 2018, règle 810.4) : « un tableau de contrôle des
 *   émoluments » par affaire. 🔵 C'est le regroupement par mandat.
 * - 🟢 Les frais et honoraires du syndic afférents aux prestations faites au profit d'un copropriétaire sont à sa seule
 *   charge (L. 1965 art. 10-1, b ; contrat type, point 9). D'où le cumul des facturables par destinataire.
 * - 🟢 La désignation d'un AP met fin de plein droit au contrat de syndic (contrat type, point 10). 🔵 Par mandat, une
 *   ligne relève d'un seul régime ; par responsable, une ligne peut mêler syndic et administration provisoire.
 *
 * Questions ouvertes :
 * - 🔴 (Frédéric) Sur quoi porte le tableau : la date de l'élément (choix actuel), celle de la facture ou celle de
 *   l'imputation ? Et sa source : les éléments (choix actuel), les factures, ou les comptes (critère « Compte du / au ») ?
 * - 🔴 (Frédéric ou Hugo) Le regroupement « Responsable » vise-t-il le responsable du mandat (choix actuel, RolesMandat)
 *   ou le Collaborateur de la fiche élément (tranche 27) ? Est-il réservé au contrôle interne, sans jamais être présenté
 *   au juge (L. 1965 art. 29-1, I, al. 2) ? Faut-il y séparer syndic et administration provisoire ?
 * - 🔴 (Frédéric) Sens de « Pas de mandat exclu », « Liste de contrôle », « Produire une liste de … », Source, Cabinet
 *   et Libellé : non modélisés.
 * - 🔴 (Frédéric) Le contrôle des coûts doit-il être valorisé au prix de l'élément ? Choix actuel : oui.
 * - 🔴 (Frédéric) Les échéances du scénario de gestion courante (echeancesScenario) entrent-elles dans le tableau ?
 *   Choix actuel : non, seuls les éléments.
 * - 🔴 (Frédéric ou Hugo) Quelle période le cabinet présente-t-il au juge dans le compte provisoire détaillé des
 *   émoluments (annuel, D. 1967 art. 61-1-5, II) : année civile, ou année de mission ? Le tableau mensuel est-il un
 *   contrôle interne seulement (la seule assiette mensuelle du tarif est le droit fixe de gestion courante, arrêté du
 *   8 octobre 2015, art. 5) ?
 * - 🔴 (Frédéric ou Hugo) Le cabinet applique-t-il à l'administration provisoire de copropriété les règles 810.4 et
 *   900.2 / 900.3 (synthèse par catégorie, émoluments taxés restant à percevoir) ? Si oui, il faudrait distinguer taxé,
 *   perçu et restant à percevoir, ce que les étapes du cycle ne font pas (émoluments et frais, eux, sont séparés). Leur
 *   rédaction vise surtout les procédures collectives ; l'arrêté du 18 juillet 2018 n'a été lu qu'en version initiale.
 * - 🔴 (Frédéric ou Hugo) Administration provisoire : les frais (natures Timbre, AR, Copie, envois, diffuseurs) sont-ils
 *   remboursés au cabinet à part de sa rémunération, ou seulement pris en compte par le juge pour la fixer (D. 1967
 *   art. 61-1-5, III, al. 2 ; à 500 lots et plus, arrêté du 8 octobre 2015, art. 3) ? Figurent-ils au compte provisoire
 *   détaillé des émoluments (II), à part ou pas du tout ? Choix actuel : le tableau les cumule à part
 *   (facturablesParCategorie), sans rien en déduire ; la liste des natures de rémunération est déduite (🔵).
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

/** Mandats retenus : le portefeuille du collaborateur (les trois rôles), ou tous s'il n'est pas donné. */
function filtreDesMandats(collaborateurId: string | null, affectations: readonly AffectationMandat[]): (mandatId: string) => boolean {
  if (collaborateurId === null) return () => true
  const mandats = portefeuille(collaborateurId, [...affectations])
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
