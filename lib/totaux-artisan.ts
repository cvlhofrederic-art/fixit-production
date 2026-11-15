/**
 * Totaux des documents artisan (formulaire components/DevisFactureForm.tsx, PDF V2).
 *
 *   - `ventilationTvaArtisan` : détail de la TVA par taux du formulaire, transmis au PDF V2. Le
 *     téléchargement depuis la liste le recalcule à l'identique pour un document au rendu complet
 *     (lib/version-rendu.ts), au lieu de rendre un PDF sans TVA.
 *   - `totauxDocumentComplet` : montants d'un document au rendu complet pour la liste des factures, la
 *     messagerie et la base, sur toutes ses lignes (prestations, matériaux, frais annexes, tables),
 *     comme le formulaire et le PDF.
 *
 * Un frais annexe artisan (FraisAnnexeItem) porte son montant dans `total_ht` et son taux dans
 * `tva_applicable`.
 */
import type { CustomTable, FraisAnnexeItem, ProductLine } from '@/lib/devis-types'
import { buildDocumentLines } from '@/lib/devis-totals'
import { mulMoney, round2 } from '@/lib/money'
import { appliquerRemiseGlobale, type LigneRemisable, type ResultatRemiseGlobale } from '@/lib/remise-commerciale'
import { computeTva, type TvaComputation, type TvaLineInput, type TvaRegime } from '@/lib/tva-calculator'

export interface LigneVentilationTva {
  rate: number
  base: number
  amount: number
}

/** Les quatre sources de lignes du formulaire artisan. */
export interface LignesArtisan {
  lines: ProductLine[]
  materialLines: ProductLine[]
  fraisAnnexes: FraisAnnexeItem[]
  customTables: CustomTable[]
}

/** Lignes soumises à la remise globale : toutes les lignes du document, comme le formulaire. */
export function lignesRemisablesArtisan({ lines, materialLines, fraisAnnexes, customTables }: LignesArtisan): LigneRemisable[] {
  return [
    ...lines.map(l => ({ totalHT: l.totalHT || 0, tvaRate: l.tvaRate || 0 })),
    ...materialLines.map(l => ({ totalHT: l.totalHT || 0, tvaRate: l.tvaRate || 0 })),
    ...fraisAnnexes.map(f => ({ totalHT: f.total_ht || 0, tvaRate: f.tva_applicable || 0 })),
    ...customTables.flatMap(t => t.lines.map(l => ({ totalHT: l.totalHT || 0, tvaRate: l.tvaRate || 0 }))),
  ]
}

/**
 * Ventilation de la TVA par taux du formulaire artisan (arrondie par taux après agrégation des bases :
 * sous-total HT + Σ TVA = TTC à 0,01 € près). Document remisé : bases par taux après répartition de la
 * remise globale. Taux du plus fort au plus faible, comme les lignes TVA du PDF.
 */
export function ventilationTvaArtisan(
  p: LignesArtisan & { tvaEnabled: boolean; remise: ResultatRemiseGlobale },
): LigneVentilationTva[] {
  if (!p.tvaEnabled) return []
  if (p.remise.remiseHT !== 0) {
    return p.remise.bases
      .map(b => ({ rate: b.taux, base: b.base, amount: mulMoney(b.base, b.taux / 100) }))
      .sort((a, b) => b.rate - a.rate)
  }
  const map = new Map<number, { base: number; amount: number }>()
  const acc = (ht: number, taux: number) => {
    const cur = map.get(taux) || { base: 0, amount: 0 }
    cur.base = round2(cur.base + ht)
    map.set(taux, cur)
  }
  p.lines.forEach(l => acc(l.totalHT || 0, l.tvaRate || 0))
  p.materialLines.forEach(l => acc(l.totalHT || 0, l.tvaRate || 0))
  p.fraisAnnexes.forEach(f => acc(f.total_ht || 0, f.tva_applicable || 0))
  p.customTables.forEach(t => t.lines.forEach(l => acc(l.totalHT || 0, l.tvaRate || 0)))
  map.forEach((v, taux) => { v.amount = mulMoney(v.base, taux / 100) })
  return Array.from(map.entries())
    .map(([rate, { base, amount }]) => ({ rate, base, amount }))
    .sort((a, b) => b.rate - a.rate)
}

const objets = <T>(valeur: unknown): T[] =>
  (Array.isArray(valeur) ? valeur.filter((v): v is T => v !== null && typeof v === 'object') : [])

/** Les lignes d'un document artisan enregistré, entrées nulles écartées (stockage local abîmé). */
export function lignesDocumentArtisan(document: Record<string, unknown>): LignesArtisan {
  return {
    lines: objets<ProductLine>(document.lines),
    materialLines: objets<ProductLine>(document.materialLines),
    fraisAnnexes: objets<FraisAnnexeItem>(document.fraisAnnexes),
    customTables: objets<CustomTable>(document.customTables).map(t => ({ ...t, lines: objets<ProductLine>(t.lines) })),
  }
}

/** Même ventilation que le formulaire, pour un document enregistré (téléchargement depuis la liste). */
export function ventilationTvaDocumentArtisan(document: Record<string, unknown>, tvaEnabled: boolean): LigneVentilationTva[] {
  const lignes = lignesDocumentArtisan(document)
  const remise = appliquerRemiseGlobale(lignesRemisablesArtisan(lignes), document.remiseGlobale)
  return ventilationTvaArtisan({ ...lignes, tvaEnabled, remise })
}

/**
 * Toutes les lignes d'un document au format du calcul de TVA (lib/devis-totals.ts, buildDocumentLines) :
 * le montant d'un frais annexe artisan est `total_ht`, son taux `tva_applicable`.
 */
export function lignesTvaCompletes(document: Record<string, unknown>): TvaLineInput[] {
  return buildDocumentLines(document as Parameters<typeof buildDocumentLines>[0]).map(ligne => {
    const l = ligne as Record<string, unknown>
    return {
      totalHT: Number(l.totalHT ?? l.total_ht ?? l.total ?? 0) || 0,
      tvaRate: Number(l.tvaRate ?? l.tva_rate ?? l.tva_applicable ?? 0) || 0,
      horsRemise: l.horsRemise === true,
    }
  })
}

/**
 * Régime de TVA d'un document enregistré : `regimeTva` s'il est posé, sinon l'ancien drapeau
 * d'autoliquidation, sinon `tvaEnabled` (franchise en base quand il vaut false).
 */
export function regimeTvaDocument(document: Record<string, unknown>): TvaRegime {
  const explicite = (document.regimeTva ?? document.regime_tva) as TvaRegime | undefined
  if (explicite) return explicite
  if (document.autoliquidationBTP === true) return 'autoliquidation_btp'
  return document.tvaEnabled === false ? 'franchise_293b' : 'classique'
}

/**
 * Totaux d'un document au rendu complet (liste des factures, messagerie, base) : mêmes lignes, même
 * régime et même remise que le formulaire et le PDF.
 */
export function totauxDocumentComplet(document: Record<string, unknown>): TvaComputation {
  return computeTva({
    regime: regimeTvaDocument(document),
    lines: lignesTvaCompletes(document),
    remiseGlobale: document.remiseGlobale,
  })
}
