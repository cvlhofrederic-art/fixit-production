import { ecartJours } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  calculerEtatEcheance,
  type CertitudeRegle,
  type EcheanceCalculee,
} from '@/lib/administrateur-judiciaire/domain/delais-legaux'

/** Variantes de couleur des pastilles (classes CSS de Pill). */
export type TonPastille = 'sage' | 'amber' | 'rust' | 'gold' | 'navy'

export interface PastilleEcheance {
  kind: TonPastille
  label: string
}

/**
 * Pastille de certitude d'une règle ; une certitude absente de la table (« TEXTE ») n'affiche rien.
 * Même table que PILL_PAR_CERTITUDE de l'assistant de mandat (doublon exact dans la maquette).
 */
export const BADGES_CERTITUDE_ECHEANCE: Partial<Record<CertitudeRegle, PastilleEcheance>> = {
  A_CONFIRMER: {
    kind: 'amber',
    label: 'À confirmer',
  },
  SOURCE_SECONDAIRE: {
    kind: 'gold',
    label: 'Source secondaire',
  },
}

/**
 * Pastille de statut d'une échéance à une date de référence, selon sa nature :
 * fenêtre des tiers (Close / Ouverte · J-n), effet ou repère (Passée, Expirée depuis n j, J-n, Aujourd'hui),
 * obligation (Échue depuis n j, Aujourd'hui, J-n).
 */
export function badgeStatutEcheance(
  echeance: Pick<EcheanceCalculee, 'accomplie' | 'dateRetenue' | 'statut' | 'nature'>,
  referenceIso: string,
): PastilleEcheance {
  const etat = calculerEtatEcheance(echeance, referenceIso)
  if (etat === 'accomplie')
    return {
      kind: 'sage',
      label: 'Accomplie',
    }
  // `!echeance.dateRetenue` équivaut ici à l'état « sans_date » (seule une échéance accomplie y échappe).
  if (etat === 'sans_date' || !echeance.dateRetenue)
    return {
      kind: 'navy',
      label: echeance.statut === 'DELAI_A_SAISIR' ? 'Délai à reporter' : 'À déclencher',
    }
  const jours = ecartJours(referenceIso, echeance.dateRetenue)
  return echeance.nature === 'fenetre_tiers'
    ? etat === 'depassee'
      ? {
          kind: 'navy',
          label: 'Close',
        }
      : {
          kind: 'amber',
          label: `Ouverte · J-${jours}`,
        }
    : echeance.nature === 'effet' || echeance.nature === 'repere'
      ? etat === 'depassee'
        ? echeance.nature === 'repere'
          ? {
              kind: 'rust',
              label: `Expirée depuis ${-jours} j`,
            }
          : {
              kind: 'navy',
              label: 'Passée',
            }
        : {
            kind: etat === 'a_venir' ? 'sage' : 'amber',
            label: jours === 0 ? "Aujourd'hui" : `J-${jours}`,
          }
      : etat === 'depassee'
        ? {
            kind: 'rust',
            label: `Échue depuis ${-jours} j`,
          }
        : etat === 'aujourdhui'
          ? {
              kind: 'rust',
              label: "Aujourd'hui",
            }
          : {
              kind: etat === 'imminente' ? 'amber' : 'sage',
              label: `J-${jours}`,
            }
}

/**
 * Échéance à ranger dans le groupe « accomplies ou révolues » : accomplie, ou fenêtre des tiers / effet dépassés.
 * Une obligation dépassée n'est pas rangée (elle reste visible en rouge).
 */
export function estEcheanceAccomplieOuRevolue(
  echeance: Pick<EcheanceCalculee, 'accomplie' | 'dateRetenue' | 'nature'>,
  referenceIso: string,
): boolean {
  const etat = calculerEtatEcheance(echeance, referenceIso)
  return etat === 'accomplie' || (etat === 'depassee' && (echeance.nature === 'fenetre_tiers' || echeance.nature === 'effet'))
}
