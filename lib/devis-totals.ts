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

interface ProductLineLike {
  totalHT?: number
  total_ht?: number
  total?: number
}

interface DocumentWithLines {
  lines?: ProductLineLike[]
  materialLines?: ProductLineLike[]
  fraisLines?: ProductLineLike[]
  fraisAnnexes?: ProductLineLike[]
  customTables?: { lines?: ProductLineLike[] }[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

const sumLines = (arr?: ProductLineLike[]): number =>
  (arr || []).reduce((s, l) => s + (l.totalHT ?? l.total_ht ?? l.total ?? 0), 0)

/**
 * Total HT en euros (decimaux). Couvre les 4 sources de lignes possibles.
 */
export function computeDocumentTotalHT(doc: DocumentWithLines | null | undefined): number {
  if (!doc) return 0
  const customLines = (doc.customTables || []).flatMap(t => t.lines || [])
  return (
    sumLines(doc.lines)
    + sumLines(doc.materialLines)
    + sumLines(doc.fraisLines)
    + sumLines(doc.fraisAnnexes)
    + sumLines(customLines)
  )
}

/**
 * Total HT en centimes (BIGINT). Pour les colonnes total_ht_cents des
 * tables Supabase devis et factures.
 */
export function computeDocumentTotalHtCents(doc: DocumentWithLines | null | undefined): number {
  return Math.round(computeDocumentTotalHT(doc) * 100)
}
