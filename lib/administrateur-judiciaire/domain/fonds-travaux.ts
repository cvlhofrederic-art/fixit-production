import { citerFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import { refLoi1965 } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import type { NaturePlanComptable } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Fonds de travaux (décision J4 du 09/10/2026). Fonctions pures, montants en CENTIMES ENTIERS, sans écran.
 *
 * Le droit — L. 1965 art. 14-2-1 (depuis la loi Climat et Résilience de 2021 ; l'art. 14-2 porte le PPT) : le fonds
 * est EXCLUSIVEMENT affecté aux travaux. Aucun texte n'impose d'y conserver un solde minimum : les seuls seuils légaux
 * sont des planchers de cotisation annuelle et une suspension quand le fonds est bien doté (un plafond, pas un
 * plancher). Le fonds peut légitimement tomber à zéro après un chantier.
 *
 * Gestéam — champ « Montant bloqué € », onglet Réglages d'un compte de nature « Fonds travaux » (tranches 25 et 26).
 * Sens DÉDUIT, non observé : très probablement l'amélioration 5.4.20 « Fonds travaux : Trésorerie mini ». L'écran
 * n'emploie jamais ce terme et aucune aide n'a été obtenue. Dans VitFix : paramètre de GESTION, modifiable, jamais
 * présenté comme une règle légale.
 *
 * 🔴 Non établi : la rédaction exactement en vigueur de l'art. 14-2-1 et le sort de la dispense des petites
 *    copropriétés (sources contradictoires) — à confirmer sur Légifrance avant de figer une règle de cotisation.
 * 🔴 Non observé : l'effet du champ dans Gestéam (blocage à la saisie, simple alerte, ou affichage).
 */

const FONDEMENT_AFFECTATION = citerFondement(refLoi1965('14-2-1'))

/**
 * Les cinq natures de fonds du plan comptable (NATURE_PLAN_COMPTABLE, bloc Copropriété) : cinq natures distinctes,
 * à ne jamais fusionner sous un seul « fonds ». « Comptes bloqués » est une autre nature, sans lien avec le fonds.
 */
export const NATURES_FONDS = [
  'Fonds, avance de trésorerie',
  'Fonds de prévoyance',
  'Fonds de réserve',
  'Fonds de solidarité',
  'Fonds travaux',
] as const satisfies readonly NaturePlanComptable[]
export type NatureFonds = (typeof NATURES_FONDS)[number]

/** Objet d'un décaissement imputé au fonds de travaux : quatre affectations admises, quatre exclusions. */
export const AFFECTATION_FONDS_TRAVAUX = {
  travaux_prescrits: { libelle: 'Travaux prescrits par les lois et règlements', admis: true, decisionAgRequise: false },
  travaux_votes_ag: { libelle: "Travaux votés en assemblée générale", admis: true, decisionAgRequise: true },
  travaux_ppt: { libelle: 'Travaux du plan pluriannuel de travaux adopté', admis: true, decisionAgRequise: true },
  travaux_urgents: { libelle: "Travaux urgents nécessaires à la sauvegarde de l'immeuble", admis: true, decisionAgRequise: false },
  charges_courantes: { libelle: 'Charges courantes', admis: false, decisionAgRequise: false },
  compensation_impaye: { libelle: "Compensation d'un impayé de copropriétaire", admis: false, decisionAgRequise: false },
  frais_contentieux: { libelle: 'Frais de contentieux du syndicat', admis: false, decisionAgRequise: false },
  travaux_privatifs: { libelle: 'Travaux privatifs', admis: false, decisionAgRequise: false },
} as const satisfies Record<string, { libelle: string; admis: boolean; decisionAgRequise: boolean }>
export type ObjetDecaissementFondsTravaux = keyof typeof AFFECTATION_FONDS_TRAVAUX

export interface DecaissementFondsTravaux {
  objet: ObjetDecaissementFondsTravaux
  montantCentimes: number
  /** Référence de la décision d'assemblée qui vote les travaux (ou adopte le PPT) ; null si sans objet. */
  decisionAg: string | null
}

export interface ResultatAffectation {
  autorise: boolean
  motif: string
  fondement: string
}

const verifierCentimes = (montant: number, strictementPositif: boolean): void => {
  if (!Number.isInteger(montant) || montant < 0 || (strictementPositif && montant === 0))
    throw new Error(
      `Montant invalide (${montant}) : centimes entiers ${strictementPositif ? 'strictement positifs' : 'positifs ou nuls'} attendus.`,
    )
}

/**
 * Contrôle d'affectation (J4, le droit) : un décaissement imputé au fonds de travaux n'est admis que pour des travaux
 * éligibles ; les travaux votés et ceux du PPT doivent porter leur décision d'assemblée. Lève une erreur sur une
 * saisie invalide (montant, objet inconnu) ; renvoie un refus motivé sur un objet exclu.
 */
export function controlerAffectationFondsTravaux(decaissement: DecaissementFondsTravaux): ResultatAffectation {
  verifierCentimes(decaissement.montantCentimes, true)
  if (!Object.hasOwn(AFFECTATION_FONDS_TRAVAUX, decaissement.objet))
    throw new Error(`Objet de décaissement inconnu : « ${decaissement.objet} ».`)
  const affectation = AFFECTATION_FONDS_TRAVAUX[decaissement.objet]
  const resultat = (autorise: boolean, motif: string): ResultatAffectation => ({
    autorise,
    motif,
    fondement: FONDEMENT_AFFECTATION,
  })
  if (!affectation.admis)
    return resultat(
      false,
      `${affectation.libelle} : dépense exclue du fonds de travaux, affecté exclusivement aux travaux. À imputer sur un autre compte.`,
    )
  if (affectation.decisionAgRequise && !decaissement.decisionAg?.trim())
    return resultat(false, `${affectation.libelle} : rattacher la décision d'assemblée avant de décaisser sur le fonds de travaux.`)
  return resultat(true, `${affectation.libelle} : affectation admise.`)
}

/** Paramétrage de gestion du compte fonds travaux (reprise du « Montant bloqué € » de Gestéam). */
export interface ReglagesFondsTravaux {
  /** Plancher de gestion en centimes ; 0 = pas de plancher. Sens DÉDUIT (trésorerie minimale), aucune portée légale. */
  montantBloqueCentimes: number
}

export function creerReglagesFondsTravaux(saisie: Partial<ReglagesFondsTravaux>): ReglagesFondsTravaux {
  const montantBloqueCentimes = saisie.montantBloqueCentimes ?? 0
  verifierCentimes(montantBloqueCentimes, false)
  return { montantBloqueCentimes }
}

/** Alerte de GESTION : sans champ `fondement`, et son message ne cite aucun texte. */
export interface AlerteSeuilFondsTravaux {
  code: 'sous_montant_bloque'
  ecartCentimes: number
  message: string
}

/** Signale un solde du fonds de travaux passé sous le plancher fixé par le cabinet ; null sans plancher ou au-dessus. */
export function controlerSeuilFondsTravaux(
  soldeCentimes: number,
  reglages: ReglagesFondsTravaux,
): AlerteSeuilFondsTravaux | null {
  const { montantBloqueCentimes } = reglages
  if (montantBloqueCentimes === 0 || soldeCentimes >= montantBloqueCentimes) return null
  return {
    code: 'sous_montant_bloque',
    ecartCentimes: montantBloqueCentimes - soldeCentimes,
    message:
      "Solde du fonds de travaux sous le montant bloqué fixé par le cabinet. C'est un garde-fou de gestion interne, modifiable : aucun texte n'impose de solde minimum sur ce fonds.",
  }
}
