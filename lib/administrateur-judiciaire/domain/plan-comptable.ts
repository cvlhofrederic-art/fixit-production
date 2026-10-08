import type {
  NaturePlanComptable,
  RegleNumeroCompte,
  SourceComptable,
  TypeSru,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Plan comptable (intégration Gestéam, T20) : la NOMENCLATURE qui génère les comptes — 710 entrées chez Gestéam.
 * Ne pas confondre avec la table `comptes` (les instances) : Règle 5.
 * Annotations : @observe (lu à l'écran) · @deduit · @aconfirmer (référentiel non déroulé ou effet non observé).
 * Source : reference/code/types-comptabilite.ts et cartographie tranches 13 et 21.
 */
export interface PlanComptable {
  id: string
  /** @observe 5 caractères, alphanumérique (`10240`, `512CB`, `512P0`) : une chaîne, jamais un entier. */
  code: string
  /** @observe */
  libelle: string
  /** @observe */
  source: SourceComptable
  /** @observe case « Hors service » */
  horsService: boolean
  /** @aconfirmer référentiel « Type de plan » non déroulé */
  type?: string
  /** @observe NATURE_PLAN_COMPTABLE, 69 valeurs (tranche 24) ; distincte de `type` (Règle 5) */
  nature: NaturePlanComptable
  /** @observe objet métier rattaché */
  lien?: string
  /** @aconfirmer libellés observés (CATEGORIE_PLAN_COMPTABLE) mais rattachement par entrée non vérifié */
  categorie?: string
  /** @observe nomenclature des annexes comptables (décret du 14 mars 2005) */
  typeSru?: TypeSru
  /** @observe « Libre » par défaut */
  analytique: 'libre' | 'imposee' | 'interdite'
  /** @observe règle R5 : quel objet métier alimente le segment auxiliaire du numéro de compte */
  regleNumeroCompte: RegleNumeroCompte
  /** @observe champ « Ajouter des 0 » — @aconfirmer son effet exact (complément à gauche jusqu'à 5 caractères retenu) */
  ajouterDesZeros?: number
  /** @observe « N° Sous compte » */
  regleSousCompte?: RegleNumeroCompte
  /** @observe « Identique plan » par défaut */
  libelleCompteIdentiquePlan: boolean
  /** @observe */
  lettrageActif: boolean
  /** @observe */
  ajoutManuelActif: boolean
  /** @observe « Par défaut si nouveaux mandats » */
  parDefautSiNouveauMandat: boolean
  /** @observe « Limite inférieure de saisie de mouvement » (AAAA-MM-JJ) */
  limiteInferieureSaisie?: string
  /** @observe */
  ordre?: number
  /** @observe */
  notes?: string
}

/**
 * Valeur fournie pour le segment auxiliaire, selon la règle de l'entrée de plan. La fonction n'invente aucune valeur :
 * seul « A zéro » est déterminé par la règle elle-même (`00000`, observé sur de nombreux comptes). Pour les autres,
 * l'appelant fournit la valeur — saisie (Libre), valeur déclarée (Fixe), suivant de la série (Série), numéro de
 * l'objet métier (identité, entreprise, travaux, lot, indivisaire). Leur source exacte n'est pas observée.
 */
export type SourceSegmentAuxiliaire =
  | { regle: 'A zéro' }
  | { regle: Exclude<RegleNumeroCompte, 'A zéro'>; valeur: string }

const LONGUEUR_AUXILIAIRE = 5

/** Segment auxiliaire (5 caractères) du numéro de compte, selon la règle R5 déclarée sur l'entrée de plan. */
export function genererSegmentAuxiliaire(entree: Pick<PlanComptable, 'regleNumeroCompte' | 'ajouterDesZeros'>, source: SourceSegmentAuxiliaire): string {
  if (source.regle !== entree.regleNumeroCompte)
    throw new Error(
      `L'entrée de plan déclare la règle « ${entree.regleNumeroCompte} » ; valeur fournie pour « ${source.regle} ».`,
    )
  if (source.regle === 'A zéro') return '0'.repeat(LONGUEUR_AUXILIAIRE)
  const valeur = entree.ajouterDesZeros ? source.valeur.padStart(LONGUEUR_AUXILIAIRE, '0') : source.valeur
  if (valeur.length !== LONGUEUR_AUXILIAIRE)
    throw new Error(
      `Segment auxiliaire « ${source.valeur} » : 5 caractères attendus${entree.ajouterDesZeros ? '' : " (l'entrée de plan n'active pas « Ajouter des 0 »)"}.`,
    )
  return valeur
}

export interface SegmentsNumeroCompte {
  /** 4 caractères ; absent → « ____ », comme sur les contreparties de journaux observées. Dépend de D1. */
  mandat?: string
  /** Code de l'entrée de plan, 5 caractères. */
  planCode: string
  /** Segment auxiliaire, 5 caractères (genererSegmentAuxiliaire). */
  auxiliaire: string
  /** 1 caractère ; « 0 » partout dans l'observation — sens non établi. */
  repere?: string
}

/** Numéro de compte au format observé `<Mandat(4)>.<Plan(5)>.<Auxiliaire(5)>.<Repère(1)>`. */
export function formaterNumeroCompte({ mandat = '____', planCode, auxiliaire, repere = '0' }: SegmentsNumeroCompte): string {
  const verifier = (nom: string, valeur: string, longueur: number) => {
    if (valeur.length !== longueur) throw new Error(`Segment ${nom} « ${valeur} » : ${longueur} caractères attendus.`)
  }
  verifier('Mandat', mandat, 4)
  verifier('Plan', planCode, 5)
  verifier('Auxiliaire', auxiliaire, 5)
  verifier('Repère', repere, 1)
  return `${mandat}.${planCode}.${auxiliaire}.${repere}`
}
