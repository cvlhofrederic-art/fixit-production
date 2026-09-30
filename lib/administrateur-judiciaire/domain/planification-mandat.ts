import {
  ajouterJours,
  ajouterMois,
  dateFrVersIso,
  dateIsoVersFr,
  estDateIsoValide,
} from '@/lib/administrateur-judiciaire/domain/dates'
import {
  calculerDateFinMission,
  calculerEcheancesLegales,
  controlerContexteMandat,
  type AnomalieContexte,
  type CertitudeRegle,
  type ContexteMandat,
  type NatureRegle,
} from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { LIBELLES_REGIMES, regimeDepuisFondement, type Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import type { RoleCabinet } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'

/** Planification d'un nouveau mandat depuis l'assistant (« Assistant de mandat — auto-planification »). */

export type ServiceCabinet = Extract<RoleCabinet, 'Secrétariat' | 'Juridique' | 'Comptabilité' | 'Direction'>

/** Service responsable de chaque règle du moteur de délais (clés = identifiants de règle ; « Juridique » par défaut). */
export const SERVICE_RESPONSABLE_PAR_REGLE: Record<string, ServiceCabinet> = {
  'notification-ordonnance-46-47': 'Secrétariat',
  'information-coproprietaires-ap291': 'Secrétariat',
  'refere-coproprietaires-46-47': 'Juridique',
  'refere-ordonnance-requete-ap291': 'Juridique',
  'compte-separe-sj': 'Comptabilité',
  'convocation-ag-sj': 'Juridique',
  'convocation-ag-ap47': 'Juridique',
  'remise-documents-ap47': 'Direction',
  'publicite-creanciers-ap291': 'Juridique',
  'rapport-intermediaire-ap291': 'Direction',
  'fin-suspension-exigibilite-ap291': 'Comptabilité',
  'declaration-creances-ap291': 'Comptabilité',
  'releve-forclusion-ap291': 'Juridique',
  'contestation-liste-creances-ap291': 'Juridique',
  'observations-echeancier-ap291': 'Comptabilité',
  'contestation-plan-ap291': 'Juridique',
  'ancien-syndic-tresorerie': 'Comptabilité',
  'ancien-syndic-archives': 'Secrétariat',
  'ancien-syndic-etat-comptes': 'Comptabilité',
  'fin-mission-sj': 'Direction',
  'fin-mission-ap47': 'Direction',
  'fin-mission-ap291': 'Direction',
}

/** Saisie de l'assistant : seuls `ordonnance` (« JJ/MM/AAAA »), `duree` (mois) et `fondement` sont lus. */
export interface SaisieAssistantMandat {
  copro?: string
  tribunal?: string
  rg?: string
  ordonnance: string
  duree: string
  fondement: string
}

export interface EcheancePlanifiee {
  id: string
  label: string
  /** « JJ/MM/AAAA ». */
  date: string
  basis: string
  role: ServiceCabinet
  certitude: CertitudeRegle
  nature: NatureRegle
  note: string
  aVerifier: string[]
  /** « légal JJ/MM/AAAA, reporté (CPC art. 642) » si la date a été reportée, sinon chaîne vide. */
  report: string
}

export interface EcheanceEnAttente {
  id: string
  label: string
  basis: string
  role: ServiceCabinet
  certitude: CertitudeRegle
  note: string
  aVerifier: string[]
  quand: string
}

export interface TachePlanifiee {
  label: string
  date: string
  basis: string
  role: ServiceCabinet
}

interface PlanMandatBase {
  /** Fin de mission « JJ/MM/AAAA », chaîne vide si inconnue. */
  ech: string
  calendar: EcheancePlanifiee[]
  pending: EcheanceEnAttente[]
  taches: TachePlanifiee[]
  docs: string[]
  anomalies: AnomalieContexte[]
}

export interface PlanMandatReussi extends PlanMandatBase {
  regime: Regime
  regimeLibelle: string
}

export interface PlanMandatEnErreur extends PlanMandatBase {
  erreur: string
}

export type PlanMandat = PlanMandatReussi | PlanMandatEnErreur

const ERREUR_ORDONNANCE_INVALIDE = "Date d'ordonnance invalide : format JJ/MM/AAAA attendu."

/** Erreur levée par dates.ts sur une date qui n'est pas une date ISO valide (année au-delà de 9999…). */
const estErreurDateIso = (erreur: unknown): boolean =>
  erreur instanceof Error && erreur.message.startsWith('Date ISO invalide')

/**
 * Plan d'un nouveau mandat : échéances datées (calendrier), échéances en attente d'un événement ou d'un délai
 * de l'ordonnance, tâches du cabinet et actes à préparer.
 * Le calcul ne lève pas quand il sort du calendrier ISO (année au-delà de 9999) : une durée dont la fin de mission
 * en sort est écartée comme une durée illisible (durée inconnue) ; une ordonnance dont les délais en sortent
 * (fin 9999) est rejetée comme une date d'ordonnance invalide.
 */
export function planifierMandat(saisie: SaisieAssistantMandat): PlanMandat {
  const planVide: PlanMandatBase = {
      ech: '',
      calendar: [],
      pending: [],
      taches: [],
      docs: [],
      anomalies: [],
    },
    dateOrdonnance = dateFrVersIso(saisie.ordonnance)
  if (!dateOrdonnance)
    return {
      ...planVide,
      erreur: ERREUR_ORDONNANCE_INVALIDE,
    }
  const regime = regimeDepuisFondement(saisie.fondement)
  if (!regime)
    return {
      ...planVide,
      erreur: 'Fondement non couvert par le moteur de délais légaux.',
    }
  const duree = parseInt(saisie.duree, 10)
  try {
    return composerPlanMandat(
      regime,
      dateOrdonnance,
      duree > 0 && estDateIsoValide(ajouterMois(dateOrdonnance, duree)) ? duree : null,
    )
  } catch (erreur) {
    // Seul un débordement du calendrier (délai compté depuis une ordonnance de fin 9999) est converti en rejet de
    // l'ordonnance ; toute autre erreur remonte.
    if (!estErreurDateIso(erreur)) throw erreur
    return {
      ...planVide,
      erreur: ERREUR_ORDONNANCE_INVALIDE,
    }
  }
}

/** Plan d'un mandat dont l'ordonnance et le fondement sont valides (durée null : durée inconnue). */
function composerPlanMandat(regime: Regime, dateOrdonnance: string, dureeMissionMois: number | null): PlanMandatReussi {
  const contexte: ContexteMandat = {
      regime,
      dateOrdonnance,
      dureeMissionMois,
    },
    echeances = calculerEcheancesLegales(contexte),
    finMission = calculerDateFinMission(contexte),
    serviceResponsable = (regleId: string): ServiceCabinet => SERVICE_RESPONSABLE_PAR_REGLE[regleId] || 'Juridique',
    calendar: EcheancePlanifiee[] = echeances
      .filter((echeance) => echeance.dateRetenue)
      .map((echeance) => ({
        id: echeance.regleId,
        label: echeance.libelle,
        date: dateIsoVersFr(echeance.dateRetenue as string),
        basis: echeance.fondements.join(' · '),
        role: serviceResponsable(echeance.regleId),
        certitude: echeance.certitude,
        nature: echeance.nature,
        note: echeance.note,
        aVerifier: echeance.aVerifier,
        // Une date reportée suppose une date légale.
        report: echeance.dateProrogee ? `légal ${dateIsoVersFr(echeance.dateLegale as string)}, reporté (CPC art. 642)` : '',
      })),
    pending: EcheanceEnAttente[] = echeances
      .filter((echeance) => !echeance.dateRetenue && echeance.statut !== 'NON_APPLICABLE')
      .map((echeance) => ({
        id: echeance.regleId,
        label: echeance.libelle,
        basis: echeance.fondements.join(' · '),
        role: serviceResponsable(echeance.regleId),
        certitude: echeance.certitude,
        note: echeance.note,
        aVerifier: echeance.aVerifier,
        quand:
          echeance.statut === 'DELAI_A_SAISIR' ? "Délai fixé par l'ordonnance : à reporter" : echeance.delaiLibelle,
      })),
    taches: TachePlanifiee[] = [
      {
        label: 'Mettre à jour le registre des copropriétés',
        date: dateIsoVersFr(ajouterJours(dateOrdonnance, 30)),
        basis: 'loi ALUR · L.711-2 CCH',
        role: 'Juridique',
      },
      ...(regime === 'sj'
        ? []
        : [
            {
              label: 'Vérifier le compte bancaire séparé',
              date: dateIsoVersFr(ajouterJours(dateOrdonnance, 15)),
              basis: 'art. 18 L. 1965',
              role: 'Comptabilité' as const,
            },
          ]),
      ...(finMission
        ? [
            {
              label: 'Établir la reddition de comptes',
              date: dateIsoVersFr(ajouterMois(finMission, -1)),
              basis: regime === 'ap291' ? 'art. 29-1 L. 1965' : 'art. 18-2 L. 1965',
              role: 'Comptabilité' as const,
            },
            regime === 'ap291'
              ? {
                  label: "Soumettre l'état de frais et de rémunération au juge",
                  date: dateIsoVersFr(finMission),
                  basis: 'art. 29-1 II L. 1965 · arrêté du 8 octobre 2015',
                  role: 'Comptabilité' as const,
                }
              : {
                  label: "Soumettre l'état de frais à taxation",
                  date: dateIsoVersFr(finMission),
                  basis: 'CPC art. 704 et s. (auxiliaire de justice)',
                  role: 'Comptabilité' as const,
                },
          ]
        : []),
    ],
    docs = ["Notification d'ordonnance", 'Convocation AG élective'].concat(
      regime === 'ap291' ? ['Requête art. 29-1 (suivi)'] : [],
    )
  return {
    regime,
    regimeLibelle: LIBELLES_REGIMES[regime].libelle,
    ech: finMission ? dateIsoVersFr(finMission) : '',
    calendar,
    pending,
    taches,
    docs,
    anomalies: controlerContexteMandat(contexte),
  }
}
