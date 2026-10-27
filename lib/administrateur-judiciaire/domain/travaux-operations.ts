import { ajouterMois, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
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
 * - montant à appeler = budget TTC − part financée par le fonds de travaux (dont l'affectation est contrôlée par
 *   fonds-travaux.ts, J4) ; tranches en % de ce montant, au centime près ;
 * - retenue de garantie : 5 % au plus (loi n° 71-584 du 16 juillet 1971, art. 1er), libérée un an après la réception
 *   sauf opposition motivée. 🔴 Délai et conditions de libération à confirmer avant d'en faire une échéance.
 * 🔵 Compte de contrepartie des appels de travaux : 70200 par défaut (voir repartition-appels.ts).
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
  tranches: TrancheAppel[]
}

export interface OperationTravaux extends SaisieOperationTravaux {
  montantAAppelerCentimes: number
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
  for (const t of saisie.tranches) {
    if (!estDateIsoValide(t.date)) throw new Error(`Date de tranche invalide (${t.date}) : AAAA-MM-JJ attendu.`)
    if (!(t.tauxPct > 0)) throw new Error(`Taux de tranche invalide (${t.tauxPct}) : strictement positif attendu.`)
  }
  const total = saisie.tranches.reduce((s, t) => s + t.tauxPct, 0)
  if (total > 100 + 1e-9) throw new Error(`Tranches à ${total} % : 100 % au plus.`)
  return { ...saisie, montantAAppelerCentimes: saisie.budgetTtcCentimes - saisie.financementFondsTravauxCentimes }
}

/** Échéances « travaux » des tranches (entrée de repartition-appels.avisDAppel) ; exige la décision d'assemblée. */
export function echeancesTravaux(operation: OperationTravaux): EcheanceAppel[] {
  if (!operation.decision) throw new Error(`Opération ${operation.numero} : pas d'appel de travaux sans décision d'assemblée.`)
  const montants = operation.tranches.map((t) => Math.round((operation.montantAAppelerCentimes * t.tauxPct) / 100))
  const total = operation.tranches.reduce((s, t) => s + t.tauxPct, 0)
  if (Math.abs(total - 100) < 1e-9 && montants.length > 0)
    montants[montants.length - 1] += operation.montantAAppelerCentimes - montants.reduce((s, m) => s + m, 0)
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
