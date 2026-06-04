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
  tvaRate?: number
  tva_rate?: number
  qty?: number
  priceHT?: number
  unit?: string
  id?: string | number
}

interface DocumentWithLines {
  lines?: ProductLineLike[]
  laborLines?: ProductLineLike[]
  materialLines?: ProductLineLike[]
  fraisLines?: ProductLineLike[]
  fraisAnnexes?: ProductLineLike[]
  customTables?: { lines?: ProductLineLike[] }[]
  // Flags de visibilité BTP : quand une section est masquée par l'utilisateur
  // (« Masquer cette section »), ses lignes doivent être ignorées dans le total.
  // Sinon le montant sauvegardé inclut des sections cachées et diverge du
  // RÉSUMÉ affiché dans le formulaire.
  materialLinesEnabled?: boolean
  fraisLinesEnabled?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

// Garde nullish : si la ligne est null/undefined (localStorage corrompu après
// un flow Facturer interrompu), on traite comme 0 au lieu de throw
// `Cannot read properties of null`.
const lineHT = (l: ProductLineLike | null | undefined): number => {
  if (!l || typeof l !== 'object') return 0
  return (l.totalHT ?? l.total_ht ?? l.total ?? 0)
}

const safeLines = (arr: unknown): ProductLineLike[] => {
  if (!Array.isArray(arr)) return []
  return arr.filter((l): l is ProductLineLike => l !== null && typeof l === 'object')
}

/**
 * Total HT en euros (décimaux). Couvre les 4 sources de lignes possibles.
 *
 * Logique corrigée (post-fix bug DÉMOLITION 04/05/2026) :
 *   Dans le BTP `buildPayload`, `lines` est la section labor (PAS une union).
 *   `laborLines` n'est généralement pas dans le storage. Donc :
 *     - laborLines (storage explicite) priorité 1
 *     - sinon `lines` agit comme labor section
 *   Puis on additionne materialLines + fraisLines + fraisAnnexes + customLines.
 *
 *   Le fix précédent (H5) excluait `lines` quand des sections existaient,
 *   ce qui faisait disparaître la section DÉMOLITION du dashboard car elle
 *   est stockée dans `lines` (pas `laborLines`).
 */
/**
 * Source unique de vérité pour la collection de lignes effective d'un devis
 * ou d'une facture (BTP ou artisan). Applique toutes les règles de filtrage :
 *
 *   - laborLines (storage explicite) priorité sur `lines` (fallback legacy)
 *   - materialLines / fraisLines exclus si leur flag `Enabled` === false
 *     (section masquée par l'utilisateur, ses lignes ne sont jamais sommées)
 *   - customTables aplatis, entrées null filtrées (corruption localStorage)
 *   - safeLines à chaque niveau (null-safe)
 *
 * Tout site qui calcule un sous-total HT, somme la TVA, ou itère les postes
 * d'un document persisté DOIT passer par ce helper. Sans cette source unique,
 * un patch sur un seul des chemins (form, dashboard, API, PDF download)
 * laisserait les autres divergents — régression DEV-2026-005, +2 800 €.
 */
export function buildDocumentLines(doc: DocumentWithLines | null | undefined): ProductLineLike[] {
  if (!doc || typeof doc !== 'object') return []
  const laborRaw = safeLines(doc.laborLines)
  const lines = safeLines(doc.lines)
  const material = doc.materialLinesEnabled === false ? [] : safeLines(doc.materialLines)
  const frais = doc.fraisLinesEnabled === false ? [] : safeLines(doc.fraisLines)
  const fraisAnnexes = safeLines(doc.fraisAnnexes)
  const customTablesRaw = Array.isArray(doc.customTables) ? doc.customTables : []
  const customLines = customTablesRaw
    .filter((t): t is { lines?: ProductLineLike[] } => t !== null && typeof t === 'object')
    .flatMap(t => safeLines(t.lines))
  const labor = laborRaw.length > 0 ? laborRaw : lines
  return [...labor, ...material, ...frais, ...fraisAnnexes, ...customLines]
}

export function computeDocumentTotalHT(doc: DocumentWithLines | null | undefined): number {
  return sumMoney(buildDocumentLines(doc).map(lineHT))
}

/**
 * Total HT en centimes (BIGINT). Pour les colonnes total_ht_cents des
 * tables Supabase devis et factures.
 */
export function computeDocumentTotalHtCents(doc: DocumentWithLines | null | undefined): number {
  return toCents(computeDocumentTotalHT(doc))
}
