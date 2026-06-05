// Revenu HT d'un document pour le dashboard Revenus (StatsRevenusSection).
//
// Pourquoi ce helper : les colonnes `total_ht_cents` / `total_ttc_cents` ne sont
// JAMAIS persistées par buildPayload/buildData (seul le seed démo les pose), donc
// le dashboard affichait 0 € partout pour les vrais comptes. On recalcule le HT
// depuis les lignes du document (source de vérité, identique au PDF et aux totaux
// devis/facture), avec repli sur total_ht_cents uniquement pour le seed démo.
//
// HT et non TTC : le « chiffre d'affaires » est par convention comptable hors
// taxes. Pour un artisan en franchise 293 B (tvaEnabled=false), HT = TTC de toute
// façon. Un avoir porte des lignes négatives (negateDocumentLines) → HT négatif,
// donc il se soustrait naturellement du CA.

import { computeDocumentTotalHT } from './devis-totals'

export function docRevenueHT(doc: object | null | undefined): number {
  // `object` : accepte aussi bien l'interface LocalDoc des consommateurs que des
  // littéraux de test, sans contrôle de propriétés excédentaires. computeDocumentTotalHT
  // attend un DocumentWithLines (non exporté) et ne lit que les collections de lignes,
  // d'où le cast.
  const fromLines = computeDocumentTotalHT(doc as unknown as Parameters<typeof computeDocumentTotalHT>[0])
  if (fromLines) return fromLines
  const cents = (doc as { total_ht_cents?: number } | null | undefined)?.total_ht_cents
  return (cents ?? 0) / 100
}
