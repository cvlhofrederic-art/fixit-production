/**
 * Mouvement bancaire synchronisé : montant signé en chaîne, tiret ASCII « - » pour les débits ; code de la
 * copropriété du compte (le nom n'apparaît que dans le libellé du compte), pour le filtre du sélecteur du haut de page.
 */
export type TransactionOpenBanking = [
  date: string,
  libelle: string,
  montant: string,
  compte: string,
  rapprochement: 'rapprochée' | 'à revoir',
  codeCopropriete: string,
]

export const DEMO_TRANSACTIONS_OPEN_BANKING: TransactionOpenBanking[] = [
  ['04/06/2026', 'Virement charges — M. Bernard', '+340 €', 'Compte séparé Le Méridien', 'rapprochée', 'LM'],
  ['03/06/2026', 'Facture Plomberie Centrale', '-620 €', 'Compte séparé Le Méridien', 'rapprochée', 'LM'],
  ['02/06/2026', 'Prélèvement inconnu', '-49 €', 'Compte séparé Les Tilleuls', 'à revoir', 'TL'],
  ['01/06/2026', 'Cotisation fonds travaux', '+1 200 €', 'Compte séparé Villa Montaigne', 'rapprochée', 'VM'],
]
