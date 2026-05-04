// Calcul du total HT d'un document devis ou facture, en sommant
// TOUTES les sources de lignes possibles selon le formulaire utilise :
//
//   - DevisFactureForm (artisan)   : lines + fraisAnnexes
//   - DevisFactureFormBTP (BTP)    : lines + materialLines + fraisLines + customTables
//
// Ce helper est la source unique de verite pour tout l'affichage des
// montants HT. Sans lui, les vues affichent des sommes partielles
// (typiquement la somme de `lines` seul) qui ne reflete pas le total reel
// d'un devis BTP enrichi de corps d'etat (customTables).
//
// HOTFIX AUDIT INTERNE 04/05/2026 :
//   Le BTP form sauvegarde `lines: validLines.length > 0 ? validLines : lines`
//   où validLines est l'UNION (laborLines + materialLines + fraisLines +
//   customLines). Le BTP doc en localStorage / DB peut donc avoir :
//     - `lines` = union (legacy)
//     - `materialLines`, `fraisLines`, `customTables` = sections séparées
//   Sommer les deux donne un total × 2 sur la dashboard et `total_ht_cents`.
//   Fix : si une section non vide existe, on ignore `lines` (qui est l'union)
//   et on somme uniquement les sections séparées. Mirror logique V3.

import { sumMoney, toCents } from '@/lib/money'

interface ProductLineLike {
  totalHT?: number
  total_ht?: number
  total?: number
  description?: string
}

interface DocumentWithLines {
  lines?: ProductLineLike[]
  laborLines?: ProductLineLike[]
  materialLines?: ProductLineLike[]
  fraisLines?: ProductLineLike[]
  fraisAnnexes?: ProductLineLike[]
  customTables?: { lines?: ProductLineLike[] }[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

const lineHT = (l: ProductLineLike): number =>
  (l.totalHT ?? l.total_ht ?? l.total ?? 0)

/**
 * Total HT en euros (décimaux). Couvre les 4 sources de lignes possibles.
 *
 * Anti double-comptage : si des sections séparées existent (laborLines /
 * materialLines / fraisLines / customTables avec contenu), on ignore `lines`
 * (potentiellement l'union legacy) et on somme uniquement les sections.
 * Sinon fallback sur `lines` directement.
 */
export function computeDocumentTotalHT(doc: DocumentWithLines | null | undefined): number {
  if (!doc) return 0
  const labor = (doc.laborLines || []) as ProductLineLike[]
  const material = (doc.materialLines || []) as ProductLineLike[]
  const frais = (doc.fraisLines || []) as ProductLineLike[]
  const fraisAnnexes = (doc.fraisAnnexes || []) as ProductLineLike[]
  const customLines = (doc.customTables || []).flatMap(t => t.lines || [])
  const hasSections =
    labor.length > 0 || material.length > 0 || frais.length > 0
    || fraisAnnexes.length > 0 || customLines.length > 0
  if (hasSections) {
    // Sections séparées présentes → ne PAS additionner `lines` (union legacy)
    return sumMoney([
      ...labor.map(lineHT),
      ...material.map(lineHT),
      ...frais.map(lineHT),
      ...fraisAnnexes.map(lineHT),
      ...customLines.map(lineHT),
    ])
  }
  // Pas de sections → `lines` est la source unique
  return sumMoney((doc.lines || []).map(lineHT))
}

/**
 * Total HT en centimes (BIGINT). Pour les colonnes total_ht_cents des
 * tables Supabase devis et factures.
 */
export function computeDocumentTotalHtCents(doc: DocumentWithLines | null | undefined): number {
  return toCents(computeDocumentTotalHT(doc))
}
