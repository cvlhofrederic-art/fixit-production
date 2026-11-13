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

import { sumMoney, toCents, round2, mulMoney } from '@/lib/money'
import { appliquerRemiseGlobale, lireRemise, remiseEnPourcentageExact } from '@/lib/remise-commerciale'

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
  /** Remise de la ligne (lib/remise-commerciale.ts) — déjà déduite de totalHT. */
  remise?: unknown
  /** Ligne exclue de la base de la remise globale (déduction d'acompte). */
  horsRemise?: boolean
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
/**
 * Table des acomptes déjà facturés d'une facture de solde (lib/facture-depuis-devis.ts). Ses lignes
 * sont toutes hors de la base de la remise globale : la remise porte sur les travaux, l'acompte se
 * déduit ensuite — y compris pour une déduction ajoutée à la main dans le formulaire.
 */
export const ID_TABLE_ACOMPTES_DEDUITS = 'acomptes-deduits'

/**
 * Le document porte une remise globale : seules ses lignes de déduction sont alors marquées hors
 * remise. Sans remise, les lignes rendues sont exactement celles d'avant (aucune donnée changée).
 */
const remiseGlobaleActive = (doc: DocumentWithLines): boolean => lireRemise(doc.remiseGlobale) !== null

export function buildDocumentLines(
  doc: DocumentWithLines | null | undefined,
  /**
   * `deductionsHorsRemise` : lignes de déduction marquées hors remise même sans remise posée. Sert
   * au champ de la remise globale, qui calcule sur la base qu'aura une remise active (sans quoi cette
   * base changerait à la première frappe). Par défaut, rendu inchangé.
   */
  options: { deductionsHorsRemise?: boolean } = {},
): ProductLineLike[] {
  if (!doc || typeof doc !== 'object') return []
  const laborRaw = safeLines(doc.laborLines)
  const lines = safeLines(doc.lines)
  const material = doc.materialLinesEnabled === false ? [] : safeLines(doc.materialLines)
  const frais = doc.fraisLinesEnabled === false ? [] : safeLines(doc.fraisLines)
  const fraisAnnexes = safeLines(doc.fraisAnnexes)
  const customTablesRaw = Array.isArray(doc.customTables) ? doc.customTables : []
  const customLines = customTablesRaw
    .filter((t): t is { id?: unknown; lines?: ProductLineLike[] } => t !== null && typeof t === 'object')
    .flatMap(t => (t.id === ID_TABLE_ACOMPTES_DEDUITS && (options?.deductionsHorsRemise === true || remiseGlobaleActive(doc))
      ? safeLines(t.lines).map(l => (l.horsRemise === true ? l : { ...l, horsRemise: true }))
      : safeLines(t.lines)))
  const labor = laborRaw.length > 0 ? laborRaw : lines
  return [...labor, ...material, ...frais, ...fraisAnnexes, ...customLines]
}

/**
 * Total HT du document, remise globale (`remiseGlobale`) déduite : c'est le HT facturé, celui des
 * listes, des statistiques et de `total_ht_cents`. Sans remise globale : somme des lignes, inchangée.
 */
export function computeDocumentTotalHT(doc: DocumentWithLines | null | undefined): number {
  const lignes = buildDocumentLines(doc)
  const brut = sumMoney(lignes.map(lineHT))
  if (!lireRemise(doc?.remiseGlobale)) return brut
  // Document remisé : même calcul que computeTva (centimes ligne par ligne), pour que
  // total_ht_cents + total_tax_cents = total_ttc_cents même avec des totaux de ligne non arrondis.
  const remise = appliquerRemiseGlobale(
    lignes.map(l => ({ totalHT: Number(lineHT(l)) || 0, tvaRate: Number(l.tvaRate ?? l.tva_rate ?? 0) || 0, horsRemise: l.horsRemise === true })),
    doc?.remiseGlobale,
  )
  return remise.remiseHT !== 0 ? remise.totalHT : brut
}

/**
 * Total HT en centimes (BIGINT). Pour les colonnes total_ht_cents des
 * tables Supabase devis et factures.
 */
export function computeDocumentTotalHtCents(doc: DocumentWithLines | null | undefined): number {
  return toCents(computeDocumentTotalHT(doc))
}

// Champs monétaires d'une ligne (toutes formes confondues : ProductLine BTP
// `priceHT/totalHT`, FraisAnnexeItem artisan `prix_unitaire_ht/total_ht`,
// shape legacy `total`). qty / tvaRate / description ne sont JAMAIS mis à l'échelle.
const MONEY_LINE_KEYS = ['priceHT', 'totalHT', 'total_ht', 'prix_unitaire_ht', 'total'] as const

/**
 * Met à l'échelle (× ratio) TOUTES les collections monétaires d'un document —
 * lines, laborLines, materialLines, fraisLines, fraisAnnexes et customTables[].lines —
 * c.-à-d. exactement les sources additionnées par `buildDocumentLines`.
 *
 * Garantit : computeDocumentTotalHT(scaleDocumentLines(doc, r)) ≈ r × computeDocumentTotalHT(doc)
 * (égalité à l'arrondi près, chaque ligne étant arrondie au centime). Préserve
 * qty / tvaRate / description / étapes (seuls les montants sont mis à l'échelle)
 * et ne mute jamais le document source (copie profonde des lignes et des tables).
 *
 * Usage : flux « → Acompte » du BTP Pro (FacturesSection). Sans cette source
 * unique, seules `lines`+`materialLines` étaient mises à l'échelle, laissant
 * `customTables` et `fraisLines` à 100 % → acompte BTP surfacturé (incident
 * Aractingi 2026-06-05 : 42 012 € ≈ 92 % au lieu de 13 706 € pour un acompte 30 %).
 */
export function scaleDocumentLines<T extends DocumentWithLines>(doc: T, ratio: number): T {
  if (!doc || typeof doc !== 'object') return doc
  // Remise en euros (ligne ou globale) : mise à la même échelle, en valeur absolue (le signe
  // d'une remise suit celui de sa base, cf. lib/remise-commerciale.ts). Une remise en % ne bouge pas.
  const scaleRemise = (remise: unknown): unknown => {
    const r = lireRemise(remise)
    return r && r.type === 'montant' ? { ...(remise as object), valeur: Math.abs(round2(r.valeur * ratio)) } : remise
  }
  const scaleLine = (l: ProductLineLike | null | undefined): ProductLineLike | null | undefined => {
    if (!l || typeof l !== 'object') return l
    const out = { ...l } as Record<string, unknown>
    for (const k of MONEY_LINE_KEYS) {
      const v = out[k]
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = round2(v * ratio)
    }
    if (out.remise !== undefined) out.remise = scaleRemise(out.remise)
    return out as ProductLineLike
  }
  const scaleArr = (arr: unknown): ProductLineLike[] | undefined =>
    Array.isArray(arr) ? arr.map(scaleLine).filter((l): l is ProductLineLike => l != null) : undefined

  const out: T = { ...doc }
  const o = out as DocumentWithLines
  if (doc.remiseGlobale !== undefined) o.remiseGlobale = scaleRemise(doc.remiseGlobale)
  if (Array.isArray(doc.lines)) o.lines = scaleArr(doc.lines)
  if (Array.isArray(doc.laborLines)) o.laborLines = scaleArr(doc.laborLines)
  if (Array.isArray(doc.materialLines)) o.materialLines = scaleArr(doc.materialLines)
  if (Array.isArray(doc.fraisLines)) o.fraisLines = scaleArr(doc.fraisLines)
  if (Array.isArray(doc.fraisAnnexes)) o.fraisAnnexes = scaleArr(doc.fraisAnnexes)
  if (Array.isArray(doc.customTables)) {
    o.customTables = doc.customTables.map(t =>
      t && typeof t === 'object' && Array.isArray(t.lines) ? { ...t, lines: scaleArr(t.lines) } : t,
    )
  }
  return out
}

/**
 * Négative (× -1) TOUTES les collections monétaires d'un document — pour un
 * AVOIR (note de crédit) qui doit solder entièrement une facture, customTables
 * (corps d'état BTP) et fraisLines compris. Sucre au-dessus de scaleDocumentLines.
 *
 * Garantit : computeDocumentTotalHT(negateDocumentLines(doc)) === -computeDocumentTotalHT(doc).
 * Sans cela, buildAvoirPrefill ne négativait que lines+materialLines → un avoir
 * BTP affichait un total faux, voire positif (-5 250 + 40 437 = +35 187 €).
 */
export function negateDocumentLines<T extends DocumentWithLines>(doc: T): T {
  return scaleDocumentLines(doc, -1)
}

/**
 * Remises en euros d'un document (lignes et remise globale) converties en pourcentages exacts
 * équivalents. Pour un AVOIR : l'utilisateur y retire des lignes ou réduit des quantités (avoir
 * partiel) ; une remise en euros resterait entière et fausserait l'avoir (jusqu'à zéro), alors
 * qu'un pourcentage suit les montants. Montants inchangés au centime : l'avoir total reste
 * l'opposé exact de la facture. Sans remise en euros, document rendu tel quel.
 */
export function remisesEnPourcentage<T extends DocumentWithLines>(doc: T): T {
  if (!doc || typeof doc !== 'object') return doc
  const convertirLigne = (l: ProductLineLike | null | undefined): ProductLineLike | null | undefined => {
    if (!l || typeof l !== 'object' || lireRemise(l.remise)?.type !== 'montant') return l
    const brut = mulMoney(Number(l.qty) || 0, Number(l.priceHT) || 0)
    return { ...l, remise: remiseEnPourcentageExact(l.remise, brut) ?? undefined }
  }
  const convertirListe = (arr: unknown): ProductLineLike[] | undefined =>
    Array.isArray(arr) ? arr.map(convertirLigne).filter((l): l is ProductLineLike => l != null) : undefined
  const out: T = { ...doc }
  const o = out as DocumentWithLines
  for (const cle of ['lines', 'laborLines', 'materialLines', 'fraisLines', 'fraisAnnexes'] as const) {
    if (Array.isArray(doc[cle])) o[cle] = convertirListe(doc[cle])
  }
  if (Array.isArray(doc.customTables)) {
    o.customTables = doc.customTables.map(t =>
      t && typeof t === 'object' && Array.isArray(t.lines) ? { ...t, lines: convertirListe(t.lines) } : t,
    )
  }
  if (lireRemise(doc.remiseGlobale)?.type === 'montant') {
    const { baseRemiseHT } = appliquerRemiseGlobale(
      buildDocumentLines(o).map(l => ({ totalHT: Number(lineHT(l)) || 0, tvaRate: Number(l.tvaRate ?? l.tva_rate ?? 0) || 0, horsRemise: l.horsRemise === true })),
      null,
    )
    o.remiseGlobale = remiseEnPourcentageExact(doc.remiseGlobale, baseRemiseHT) ?? undefined
  }
  return out
}
