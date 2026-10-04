import { DEMO_OBLIGATIONS, type ObligationDemo } from '@/components/administrateur-judiciaire/data/obligations'
import { dateFrVersIso, dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { CertitudeRegle } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { badgeStatutEcheance, type TonPastille } from '@/lib/administrateur-judiciaire/domain/echeances-affichage'
import type { EcheancePortefeuille } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import { ECHEANCES_SUIVI_DOUBLONS_MOTEUR } from '@/lib/administrateur-judiciaire/domain/fiche-360'

/** Échéancier des obligations (écran Obligations & échéances) : moteur de délais + suivi du cabinet. */

/** Doublon exact de ECHEANCES_SUIVI_DOUBLONS_MOTEUR dans la maquette : obligations suivies que le moteur remplace. */
export const OBLIGATIONS_SUIVI_REMPLACEES_PAR_MOTEUR = ECHEANCES_SUIVI_DOUBLONS_MOTEUR

export type SourceObligation = 'moteur' | 'suivi'

export const LIBELLES_SOURCE_OBLIGATION: Record<SourceObligation, string> = {
  moteur: 'Moteur de délais légaux',
  suivi: 'Suivi du cabinet (indicatif, sans délai légal vérifié)',
}

export interface LigneObligationMoteur {
  id: string
  objet: string
  copro: string
  base: string
  /** « JJ/MM/AAAA », ou le libellé du délai si la date n'est pas connue. */
  date: string
  statut: string
  pill: TonPastille
  note: string
  source: 'moteur'
  certitude: CertitudeRegle
  /** Clé de tri : date ISO ou « 9999 ». */
  tri: string
}

export type LigneObligationSuivi = ObligationDemo & {
  source: 'suivi'
  tri: string
}

export type LigneObligation = LigneObligationMoteur | LigneObligationSuivi

/**
 * Lignes du moteur (une par échéance du portefeuille) puis obligations suivies de démonstration (hors doublons du moteur),
 * triées par date ISO ; les lignes sans date (« 9999 ») viennent en dernier.
 */
export function construireEcheancierObligations(
  items: EcheancePortefeuille<{ code: string; nom: string }>[],
  referenceIso: string,
): LigneObligation[] {
  const lignesMoteur: LigneObligation[] = items.map(({ copro, echeance }) => {
      const pastille = badgeStatutEcheance(echeance, referenceIso)
      return {
        id: `${copro.code}-${echeance.regleId}`,
        objet: echeance.libelle,
        copro: copro.nom,
        base: echeance.fondements.join(' · '),
        date: echeance.dateRetenue ? dateIsoVersFr(echeance.dateRetenue) : echeance.delaiLibelle,
        statut: pastille.label,
        pill: pastille.kind,
        note: echeance.note,
        source: 'moteur',
        certitude: echeance.certitude,
        tri: echeance.dateRetenue || '9999',
      }
    }),
    lignesSuivi: LigneObligation[] = DEMO_OBLIGATIONS.filter(
      (obligation) => !OBLIGATIONS_SUIVI_REMPLACEES_PAR_MOTEUR.includes(obligation.id),
    ).map((obligation) => ({
      ...obligation,
      source: 'suivi',
      tri: dateFrVersIso(obligation.date) || '9999',
    }))
  return [...lignesMoteur, ...lignesSuivi].sort((a, b) => a.tri.localeCompare(b.tri))
}
