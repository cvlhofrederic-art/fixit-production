import { repartirAuxPlusFortsRestes } from '@/lib/administrateur-judiciaire/domain/arrondis'
import {
  numeroCompteCoproprietaire,
  positionsEnPlace,
  estQualiteCopropriete,
  type CompteCoproprietaire,
  type Position,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { creerTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Répartition des charges et avis d'appel (cartographie Gestéam, tranches 21, 25 et 30). Fonctions pures, montants en
 * CENTIMES ENTIERS, sans écran.
 *
 * D1 — clés, échéances et comptes appartiennent au SYNDICAT. D2 — l'avis d'appel s'adresse au COMPTE copropriétaire qui
 * détient les droits de propriété du lot à la date d'exigibilité (positions en place).
 *
 * Gestéam — l'échéance d'appel porte (mandat, clé, exercice ou travaux / tranche, exigibilité) ; l'avis d'appel d'un
 * copropriétaire liste, par clé, sa quote-part (tantièmes du lot / total de la clé), le solde antérieur et le total.
 * Arrondi : plus forts restes, la somme des quotes-parts égale exactement l'échéance (aucun centime perdu ni créé).
 * 🔵 Comptes de contrepartie par défaut : 70100 (provisions, budget), 70200 (travaux), 10500 (fonds de travaux, compte
 *    observé tranche 25) ; remplaçables par échéance.
 */

export interface LotCle {
  lotId: string
  tantiemes: number
}

export interface CleRepartition {
  id: string
  coproprieteId: string
  code: string
  libelle: string
  lots: LotCle[]
  totalTantiemes: number
}

export function creerCleRepartition(saisie: Omit<CleRepartition, 'totalTantiemes'>): CleRepartition {
  if (saisie.lots.length === 0) throw new Error(`Clé ${saisie.code} : aucun lot.`)
  const vus = new Set<string>()
  for (const l of saisie.lots) {
    if (vus.has(l.lotId)) throw new Error(`Clé ${saisie.code} : lot ${l.lotId} en double.`)
    vus.add(l.lotId)
    if (!Number.isInteger(l.tantiemes) || l.tantiemes <= 0) throw new Error(`Clé ${saisie.code} : tantièmes invalides pour le lot ${l.lotId}.`)
  }
  return { ...saisie, totalTantiemes: saisie.lots.reduce((s, l) => s + l.tantiemes, 0) }
}

/** Répartit un montant au tantième, au centime près (plus forts restes, départage par l'ordre des lots de la clé). */
export function repartir(montantCentimes: number, cle: CleRepartition): { lotId: string; centimes: number }[] {
  if (!Number.isInteger(montantCentimes) || montantCentimes < 0)
    throw new Error(`Montant invalide (${montantCentimes}) : centimes entiers positifs attendus.`)
  const parts = repartirAuxPlusFortsRestes(montantCentimes, cle.lots.map((l) => l.tantiemes))
  return cle.lots.map((l, i) => ({ lotId: l.lotId, centimes: parts[i] }))
}

export type NatureEcheance = 'budget' | 'travaux' | 'fonds_travaux'

const CONTREPARTIE_PAR_DEFAUT: Record<NatureEcheance, string> = { budget: '70100', travaux: '70200', fonds_travaux: '10500' }

export interface EcheanceAppel {
  id: string
  coproprieteId: string
  cleId: string
  exigibilite: string
  libelle: string
  montantCentimes: number
  nature: NatureEcheance
  /** Code du plan crédité (5 caractères) ; à défaut, celui de la nature. */
  compteContrepartie?: string
}

export interface LigneAvis {
  echeanceId: string
  lotId: string
  cle: string
  centimes: number
}

export interface AvisCompte {
  compteId: string
  lignes: LigneAvis[]
  totalAppeleCentimes: number
  soldeAnterieurCentimes: number
  totalAPayerCentimes: number
}

export interface AnomalieAppel {
  code: 'cle_inconnue' | 'lot_sans_compte' | 'comptes_multiples'
  echeanceId: string
  lotId: string | null
}

export interface AvisAppels {
  echeances: EcheanceAppel[]
  parCompte: AvisCompte[]
  anomalies: AnomalieAppel[]
}

/** Avis d'appel par compte : quotes-parts des lots détenus à chaque exigibilité, solde antérieur, total à payer. */
export function avisDAppel({
  echeances,
  cles,
  positions,
  comptes,
  soldesAnterieurs = {},
}: {
  echeances: EcheanceAppel[]
  cles: CleRepartition[]
  positions: Position[]
  comptes: CompteCoproprietaire[]
  soldesAnterieurs?: Record<string, number>
}): AvisAppels {
  const lignes = new Map<string, LigneAvis[]>()
  const anomalies: AnomalieAppel[] = []
  for (const echeance of echeances) {
    const cle = cles.find((c) => c.id === echeance.cleId)
    if (!cle) {
      anomalies.push({ code: 'cle_inconnue', echeanceId: echeance.id, lotId: null })
      continue
    }
    for (const part of repartir(echeance.montantCentimes, cle)) {
      const titulaires = new Set(
        positionsEnPlace(positions, part.lotId, echeance.exigibilite)
          .filter((p) => estQualiteCopropriete(p.qualite))
          .map((p) => p.compteId as string),
      )
      if (titulaires.size !== 1) {
        anomalies.push({ code: titulaires.size === 0 ? 'lot_sans_compte' : 'comptes_multiples', echeanceId: echeance.id, lotId: part.lotId })
        continue
      }
      const [compteId] = titulaires
      lignes.set(compteId, [...(lignes.get(compteId) ?? []), { echeanceId: echeance.id, lotId: part.lotId, cle: cle.code, centimes: part.centimes }])
    }
  }
  const ordre = (id: string) => comptes.find((c) => c.id === id)?.serie ?? id
  const parCompte = [...lignes.entries()]
    .sort(([a], [b]) => ordre(a).localeCompare(ordre(b)))
    .map(([compteId, l]) => {
      const totalAppeleCentimes = l.reduce((s, x) => s + x.centimes, 0)
      const soldeAnterieurCentimes = soldesAnterieurs[compteId] ?? 0
      return { compteId, lignes: l, totalAppeleCentimes, soldeAnterieurCentimes, totalAPayerCentimes: totalAppeleCentimes + soldeAnterieurCentimes }
    })
  return { echeances, parCompte, anomalies }
}

/** Écriture de l'appel (famille « Appel de fonds ») : débit des comptes 450, crédit des comptes de contrepartie. */
export function traitementAppelDeFonds(
  avis: AvisAppels,
  { id, date, segmentSyndicat, comptes }: { id: string; date: string; segmentSyndicat: string; comptes: CompteCoproprietaire[] },
): Traitement {
  if (avis.anomalies.length > 0) throw new Error(`Appel non écrit : ${avis.anomalies.length} anomalie(s) à lever d'abord.`)
  const debits = avis.parCompte.map((a) => {
    const compte = comptes.find((c) => c.id === a.compteId)
    if (!compte) throw new Error(`Compte copropriétaire introuvable : « ${a.compteId} ».`)
    return { compte: numeroCompteCoproprietaire(compte, segmentSyndicat), sens: 'debit' as const, montantCentimes: a.totalAppeleCentimes }
  })
  const credits = new Map<string, number>()
  for (const e of avis.echeances) {
    const code = e.compteContrepartie ?? CONTREPARTIE_PAR_DEFAUT[e.nature]
    credits.set(code, (credits.get(code) ?? 0) + e.montantCentimes)
  }
  return creerTraitement({
    id,
    famille: 'Appel de fonds',
    date,
    mouvements: [
      ...debits.filter((d) => d.montantCentimes > 0),
      ...[...credits.entries()].map(([code, montantCentimes]) => ({
        compte: `${segmentSyndicat}.${code}.00000.0`,
        sens: 'credit' as const,
        montantCentimes,
      })),
    ],
  })
}
