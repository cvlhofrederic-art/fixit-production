import { ajouterMois, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  controlerAffectationFondsTravaux,
  type ObjetDecaissementFondsTravaux,
  type ResultatAffectation,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import type { EmploiFondsEcheance } from '@/lib/administrateur-judiciaire/domain/avis-appel'
import type { EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Opération de travaux d'un syndicat (cartographie Gestéam, tranche 32). Fonctions pures, montants en CENTIMES ENTIERS,
 * sans écran.
 *
 * Gestéam — fiche travaux : n° d'opération (repris dans comptes et analytique), décision le … par l'assemblée,
 * résolution, budget TTC, clé de répartition, grille des appels (Dates d'appel · Libellé « Appel n° 1 » · Taux % ·
 * Montant · Statut) ; onglet Budget : fonds de travaux (« Ne pas utiliser les fonds travaux »), garantie par marché.
 *
 * Règles :
 * - pas d'appel de travaux sans décision d'assemblée (date et résolution) ;
 * - montant à appeler = budget TTC − part financée par le fonds de travaux ; tranches en % de ce montant, au centime
 *   près ;
 * - part du fonds de travaux (J4, fonds-travaux.ts) : son affectation est exigée dès qu'elle est positive ; un objet
 *   exclu du fonds est refusé dès la création ; l'appel exige la décision d'assemblée qui affecte le fonds (ou, pour
 *   l'usage judiciaire de l'art. 29-14, 2°, l'ordonnance du juge). Une opération pas encore votée peut prévoir le fonds ;
 * - retenue de garantie : 5 % au plus (loi n° 71-584 du 16 juillet 1971, art. 1er), libérée un an après la réception
 *   sauf opposition motivée. 🔴 Délai et conditions de libération à confirmer avant d'en faire une échéance.
 * 🔵 Compte de contrepartie des appels de travaux : 70200 par défaut (voir repartition-appels.ts).
 * Point 17 du bilan 2 — plafond d'emploi du fonds par tranche (Gestéam, tranche 30 : « Montant € maximum d'emploi des
 * fonds travaux » de l'échéance) : la part du fonds répartie comme les appels (emploisFondsTravauxDesTranches), entrée
 * de l'avis d'appel (avis-appel.ts).
 */

export interface TrancheAppel {
  date: string
  tauxPct: number
}

export interface SaisieOperationTravaux {
  /** N° d'opération, 5 caractères (segment repris dans les comptes de travaux). */
  numero: string
  coproprieteId: string
  libelle: string
  cleId: string
  decision: { date: string; resolution: string } | null
  budgetTtcCentimes: number
  financementFondsTravauxCentimes: number
  /**
   * Affectation de la part du fonds de travaux (J4) ; exigée dès que cette part est positive. `decisionAg` : référence
   * d'une décision d'affectation distincte ; à défaut, la résolution qui vote les travaux en tient lieu (🔵).
   */
  affectationFonds?: { objet: ObjetDecaissementFondsTravaux; decisionAg?: string | null; autorisationJuge?: string | null } | null
  tranches: TrancheAppel[]
}

export interface OperationTravaux extends SaisieOperationTravaux {
  montantAAppelerCentimes: number
}

const MOTIF_AFFECTATION_ABSENTE =
  "préciser l'affectation de la part du fonds de travaux (art. 14-2-1, I, 1° à 4°, ou art. 29-14, 2°)."

/** Décision qui affecte le fonds : la décision distincte, à défaut la résolution qui vote les travaux (🔵). */
function decisionAffectationFonds({ affectationFonds, decision }: SaisieOperationTravaux): string | null {
  const distincte = affectationFonds?.decisionAg?.trim()
  return distincte || (decision ? `${decision.resolution} (AG du ${dateIsoVersFr(decision.date)})` : null)
}

/** Contrôle d'affectation de la part (positive) du fonds ; null si l'affectation n'est pas précisée. */
function controlerPartFonds(operation: SaisieOperationTravaux): ResultatAffectation | null {
  const { affectationFonds } = operation
  if (!affectationFonds) return null
  return controlerAffectationFondsTravaux({
    objet: affectationFonds.objet,
    montantCentimes: operation.financementFondsTravauxCentimes,
    decisionAg: decisionAffectationFonds(operation),
    autorisationJuge: affectationFonds.autorisationJuge ?? null,
  })
}

/**
 * État de la part du fonds de travaux d'une opération, sans lever d'erreur : null sans part du fonds ; sinon, si les
 * appels peuvent la prendre en compte, et pourquoi pas. Sert aux listes (suivi « à faire ») qu'une opération en attente
 * d'une décision ou d'une ordonnance ne doit pas interrompre.
 */
export function etatPartFondsTravaux(operation: SaisieOperationTravaux): { autorise: boolean; motif: string } | null {
  if (operation.financementFondsTravauxCentimes <= 0) return null
  const controle = controlerPartFonds(operation)
  return controle ? { autorise: controle.autorise, motif: controle.motif } : { autorise: false, motif: MOTIF_AFFECTATION_ABSENTE }
}

export function creerOperationTravaux(saisie: SaisieOperationTravaux): OperationTravaux {
  if (!/^[0-9A-Z]{5}$/.test(saisie.numero)) throw new Error(`Numéro d'opération « ${saisie.numero} » : 5 caractères attendus.`)
  if (!Number.isInteger(saisie.budgetTtcCentimes) || saisie.budgetTtcCentimes <= 0)
    throw new Error(`Budget invalide (${saisie.budgetTtcCentimes}) : centimes entiers strictement positifs attendus.`)
  if (!Number.isInteger(saisie.financementFondsTravauxCentimes) || saisie.financementFondsTravauxCentimes < 0)
    throw new Error('Part du fonds de travaux invalide : centimes entiers positifs attendus.')
  if (saisie.financementFondsTravauxCentimes > saisie.budgetTtcCentimes)
    throw new Error('Part du fonds de travaux supérieure au budget de l’opération.')
  if (saisie.decision && (!estDateIsoValide(saisie.decision.date) || !saisie.decision.resolution.trim()))
    throw new Error('Décision d’assemblée incomplète : date (AAAA-MM-JJ) et résolution attendues.')
  if (saisie.financementFondsTravauxCentimes > 0) {
    const controle = controlerPartFonds(saisie)
    if (!controle) throw new Error(`Opération ${saisie.numero} : ${MOTIF_AFFECTATION_ABSENTE}`)
    if (controle.cause === 'exclu') throw new Error(`Opération ${saisie.numero} : ${controle.motif}`)
  }
  for (const t of saisie.tranches) {
    if (!estDateIsoValide(t.date)) throw new Error(`Date de tranche invalide (${t.date}) : AAAA-MM-JJ attendu.`)
    if (!(t.tauxPct > 0)) throw new Error(`Taux de tranche invalide (${t.tauxPct}) : strictement positif attendu.`)
  }
  const total = saisie.tranches.reduce((s, t) => s + t.tauxPct, 0)
  if (total > 100 + 1e-9) throw new Error(`Tranches à ${total} % : 100 % au plus.`)
  return { ...saisie, montantAAppelerCentimes: saisie.budgetTtcCentimes - saisie.financementFondsTravauxCentimes }
}

/** Montant réparti sur les tranches, au centime ; quand elles font 100 %, la dernière absorbe l'arrondi. */
function montantsDesTranches(montantCentimes: number, tranches: TrancheAppel[]): number[] {
  const montants = tranches.map((t) => Math.round((montantCentimes * t.tauxPct) / 100))
  const total = tranches.reduce((s, t) => s + t.tauxPct, 0)
  if (Math.abs(total - 100) < 1e-9 && montants.length > 0)
    montants[montants.length - 1] += montantCentimes - montants.reduce((s, m) => s + m, 0)
  return montants
}

/**
 * Échéances « travaux » des tranches (entrée de repartition-appels.avisDAppel) ; exige la décision d'assemblée et,
 * quand le fonds de travaux finance une part, une affectation admise.
 */
export function echeancesTravaux(operation: OperationTravaux): EcheanceAppel[] {
  if (!operation.decision) throw new Error(`Opération ${operation.numero} : pas d'appel de travaux sans décision d'assemblée.`)
  const etatFonds = etatPartFondsTravaux(operation)
  if (etatFonds && !etatFonds.autorise) throw new Error(`Opération ${operation.numero} : ${etatFonds.motif}`)
  const montants = montantsDesTranches(operation.montantAAppelerCentimes, operation.tranches)
  return operation.tranches.map((t, i) => ({
    id: `${operation.numero}-T${i + 1}`,
    coproprieteId: operation.coproprieteId,
    cleId: operation.cleId,
    exigibilite: t.date,
    libelle: `${operation.libelle} — appel n° ${i + 1} (${t.tauxPct} %)`,
    montantCentimes: montants[i],
    nature: 'travaux' as const,
    compteContrepartie: '70200',
  }))
}

/**
 * Plafond d'emploi du fonds de travaux de chaque tranche (Gestéam « Montant € maximum d'emploi des fonds travaux ») : la
 * part du fonds de l'opération répartie comme les appels, avec la même affectation (décision distincte, à défaut la
 * résolution des travaux). Mêmes exigences que echeancesTravaux ; [] sans part du fonds ; une tranche dont le plafond
 * s'arrondit à zéro n'emploie pas le fonds.
 */
export function emploisFondsTravauxDesTranches(operation: OperationTravaux): EmploiFondsEcheance[] {
  if (operation.financementFondsTravauxCentimes <= 0) return []
  const echeances = echeancesTravaux(operation)
  const { affectationFonds } = operation
  if (!affectationFonds) throw new Error(`Opération ${operation.numero} : ${MOTIF_AFFECTATION_ABSENTE}`)
  const affectation = {
    objet: affectationFonds.objet,
    decisionAg: decisionAffectationFonds(operation),
    autorisationJuge: affectationFonds.autorisationJuge ?? null,
  }
  const plafonds = montantsDesTranches(operation.financementFondsTravauxCentimes, operation.tranches)
  return echeances
    .map((e, i) => ({ echeanceId: e.id, plafondCentimes: plafonds[i], affectation }))
    .filter((emploi) => emploi.plafondCentimes > 0)
}

/** Retenue de garantie sur un règlement de travaux : 5 % au plus, libérée un an après la réception. */
export function retenueGarantie({
  montantTtcCentimes,
  tauxPct,
  dateReception,
}: {
  montantTtcCentimes: number
  tauxPct: number
  dateReception: string | null
}): { retenueCentimes: number; netAPayerCentimes: number; liberationLe: string | null } {
  if (tauxPct < 0 || tauxPct > 5) throw new Error(`Retenue de garantie à ${tauxPct} % : 5 % au plus (loi n° 71-584, art. 1er).`)
  if (!Number.isInteger(montantTtcCentimes) || montantTtcCentimes <= 0) throw new Error('Montant invalide : centimes entiers positifs attendus.')
  if (dateReception !== null && !estDateIsoValide(dateReception)) throw new Error(`Date de réception invalide (${dateReception}).`)
  const retenueCentimes = Math.round((montantTtcCentimes * tauxPct) / 100)
  return {
    retenueCentimes,
    netAPayerCentimes: montantTtcCentimes - retenueCentimes,
    liberationLe: dateReception ? ajouterMois(dateReception, 12) : null,
  }
}
