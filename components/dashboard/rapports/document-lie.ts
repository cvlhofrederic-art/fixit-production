// Le document (devis ou facture) auquel un rapport d'intervention est rattaché.
//
// Les deux écrans qui l'affichent — la ligne du tableau et le gabarit PDF — cherchaient chacun le document par son
// identifiant dans `fixit_documents_<artisanId>`, et chacun pour les deux liens (devis et facture). Soit, pour une
// liste de N rapports, 2N lectures du stockage et 2N parcours de la liste à chaque rendu. Depuis qu'un salarié
// invité d'une société lit les documents de la SOCIÉTÉ, qui arrivent du serveur dans une liste déjà en mémoire,
// c'était 2N copies complètes de ce tableau.
//
// La carte est donc construite UNE fois par l'écran parent et passée aux deux enfants, qui n'ont plus qu'à y
// chercher une clé. Au passage, le type et la mise en forme du libellé vivent ici au lieu d'être recopiés dans les
// deux fichiers.

import { documentsPourSynthese } from '@/lib/documents/liste-effective'

/**
 * Ce qu'on lit d'un document lié : de quoi le retrouver et le nommer.
 *
 * `id` est optionnel parce que les types partiels des écrans ne le déclarent pas tous (celui des rapports le tient
 * d'une signature d'index) ; la recherche reste sûre, l'appelant vérifiant d'abord que la référence est non vide.
 */
export interface DocumentLie {
  id?: string
  docNumber?: string
  status?: string
  service?: string
  clientName?: string
}

/** Documents rangés par identifiant. Un document sans identifiant n'est pas retrouvable : il n'y entre pas. */
export function carteDocumentsLies(
  documents: readonly DocumentLie[] | undefined,
  idStockage: string | undefined,
): Map<string, DocumentLie> {
  const carte = new Map<string, DocumentLie>()
  // `avecBrouillons: true` : un rapport peut être rattaché à un devis encore en brouillon, et il faut pouvoir le
  // nommer. C'est un libellé, pas un chiffre.
  for (const doc of documentsPourSynthese<DocumentLie>(documents, idStockage, true)) {
    if (typeof doc.id === 'string' && doc.id !== '') carte.set(doc.id, doc)
  }
  return carte
}

/**
 * Libellé d'un lien : le document retrouvé s'il l'est, la référence enregistrée sinon.
 *
 * `reference` est ce que le rapport a gardé au moment du rattachement (`linkedDevisRef`) : elle survit à la
 * suppression du document, et reste le meilleur repli.
 */
export function libelleDocumentLie(
  carte: Map<string, DocumentLie>,
  identifiant: string | null | undefined,
  reference: string | null | undefined,
  type: 'devis' | 'facture',
  isPt: boolean,
): string {
  const mot = type === 'devis' ? (isPt ? 'Orçamento' : 'Devis') : (isPt ? 'Fatura' : 'Facture')
  const doc = identifiant ? carte.get(identifiant) : undefined
  if (doc) return `${mot} ${doc.service || doc.clientName || doc.id}`
  return reference || ''
}
