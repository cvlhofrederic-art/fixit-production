import { ajouterMois, ecartJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { appliquerDelai } from '@/lib/administrateur-judiciaire/domain/delais-legaux'

/**
 * Recouvrement des charges impayées (L. 1965 art. 19-2, 19-1, 20 et 42). Le statut d'un dossier est stocké sous la forme
 * « étape:AAAA-MM-JJ » (ex. « mise_en_demeure:2026-05-12 »).
 */

export type EtapeRecouvrement = 'amiable' | 'mise_en_demeure' | 'exigibilite' | 'procedure' | 'solde'

export interface DefinitionEtapeRecouvrement {
  etape: EtapeRecouvrement
  libelle: string
  base: string
  conseil: string
}

export const ETAPES_RECOUVREMENT: DefinitionEtapeRecouvrement[] = [
  {
    etape: 'amiable',
    libelle: 'Relance amiable',
    base: 'gestion',
    conseil: 'Relance simple, puis mise en demeure si elle reste sans effet.',
  },
  {
    etape: 'mise_en_demeure',
    libelle: 'Mise en demeure',
    base: 'L. 1965 art. 19-2',
    conseil: 'Lettre recommandée, nature et montant de chaque provision impayée par exercice. Trente jours courent.',
  },
  {
    etape: 'exigibilite',
    libelle: 'Exigibilité anticipée',
    base: 'L. 1965 art. 19-2',
    conseil: 'Passé trente jours, les provisions non échues et les sommes dues des exercices précédents sont exigibles.',
  },
  {
    etape: 'procedure',
    libelle: 'Action en justice',
    base: 'L. 1965 art. 19-2, 19-1, 20',
    conseil:
      'Procédure accélérée au fond devant le président du tribunal judiciaire ; hypothèque légale ; opposition sur le prix en cas de vente.',
  },
  {
    etape: 'solde',
    libelle: 'Soldé',
    base: 'gestion',
    conseil: 'Dossier clos.',
  },
]

export interface StatutRecouvrement {
  etape: EtapeRecouvrement
  /** Date ISO de passage à l'étape, si elle est lisible. */
  depuis: string | null
}

const estEtapeRecouvrement = (valeur: string): valeur is EtapeRecouvrement =>
  ETAPES_RECOUVREMENT.some((definition) => definition.etape === valeur)

/** Lit « étape:date » ; étape inconnue ou statut vide → « amiable », date invalide → null. */
export function lireStatutRecouvrement(statut: string | null | undefined): StatutRecouvrement {
  const [etape, depuis] = (statut || 'amiable').split(':')
  return {
    etape: estEtapeRecouvrement(etape) ? etape : 'amiable',
    depuis: depuis && estDateIsoValide(depuis) ? depuis : null,
  }
}

export const ecrireStatutRecouvrement = (etape: string, dateIso: string): string => `${etape}:${dateIso}`

export interface AnalyseRecouvrement extends StatutRecouvrement {
  libelle: string
  base: string
  conseil: string
  /** Mise en demeure + 30 jours (exigibilité anticipée, art. 19-2). */
  exigibiliteLe: string | null
  joursAvantExigibilite: number | null
  /** Ouverture du dossier + 60 mois (prescription quinquennale, art. 42). */
  prescriptionLe: string | null
  prochaine: EtapeRecouvrement | null
}

/**
 * Analyse d'un dossier de recouvrement au jour `aujourdhuiIso`. `dateOuverture` = date de création du dossier (ISO).
 */
export function analyserRecouvrement(
  statut: string | null | undefined,
  aujourdhuiIso: string,
  dateOuverture?: string | null,
): AnalyseRecouvrement {
  const lu = lireStatutRecouvrement(statut),
    // Toujours trouvée : lireStatutRecouvrement ne renvoie que des étapes connues.
    definition = ETAPES_RECOUVREMENT.find((d) => d.etape === lu.etape) as DefinitionEtapeRecouvrement,
    exigibiliteLe =
      lu.etape === 'mise_en_demeure' && lu.depuis
        ? appliquerDelai(lu.depuis, {
            valeur: 30,
            unite: 'jours',
          })
        : null,
    ordre: EtapeRecouvrement[] = ['amiable', 'mise_en_demeure', 'exigibilite', 'procedure', 'solde'],
    rang = ordre.indexOf(lu.etape)
  return {
    ...lu,
    libelle: definition.libelle,
    base: definition.base,
    conseil: definition.conseil,
    exigibiliteLe,
    joursAvantExigibilite: exigibiliteLe ? ecartJours(aujourdhuiIso, exigibiliteLe) : null,
    prescriptionLe: dateOuverture && estDateIsoValide(dateOuverture) ? ajouterMois(dateOuverture, 60) : null,
    prochaine: rang >= 0 && rang < ordre.length - 1 ? ordre[rang + 1] : null,
  }
}

export interface EtapeParcoursRecouvrement {
  etape: string
  base: string
  note: string
}

/** Parcours de recouvrement présenté pour un copropriétaire débiteur (fiche personne, réponses de Fixy). */
export const PARCOURS_RECOUVREMENT_DEBITEUR: EtapeParcoursRecouvrement[] = [
  {
    etape: 'Mise en demeure',
    base: 'L. 1965 art. 19-2',
    note: 'Lettre recommandée, nature et montant de chaque provision impayée par exercice (avis Cass. 12 déc. 2024).',
  },
  {
    etape: 'Exigibilité anticipée',
    base: 'L. 1965 art. 19-2',
    note: 'Passé trente jours sans paiement, les provisions non échues et les sommes dues des exercices précédents deviennent exigibles.',
  },
  {
    etape: 'Procédure accélérée au fond',
    base: 'L. 1965 art. 19-2',
    note: 'Président du tribunal judiciaire ; à défaut, injonction de payer ou assignation au fond.',
  },
  {
    etape: 'Garanties et exécution',
    base: 'L. 1965 art. 19-1 et 20',
    note: "Hypothèque légale du syndicat ; opposition sur le prix en cas de vente (15 jours de l'avis de mutation) ; saisie des loyers.",
  },
  {
    etape: 'Prescription',
    base: 'L. 1965 art. 42',
    note: 'Cinq ans pour les charges : surveiller les créances les plus anciennes.',
  },
]
