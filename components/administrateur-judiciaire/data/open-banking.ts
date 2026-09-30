/** Mouvement bancaire synchronisé : montant signé en chaîne, tiret ASCII « - » pour les débits. */
export type TransactionOpenBanking = [
  date: string,
  libelle: string,
  montant: string,
  compte: string,
  rapprochement: 'rapprochée' | 'à revoir',
]

export const DEMO_TRANSACTIONS_OPEN_BANKING: TransactionOpenBanking[] = [
  ['04/06/2026', 'Virement charges — M. Bernard', '+340 €', 'Compte séparé Le Méridien', 'rapprochée'],
  ['03/06/2026', 'Facture Plomberie Centrale', '-620 €', 'Compte séparé Le Méridien', 'rapprochée'],
  ['02/06/2026', 'Prélèvement inconnu', '-49 €', 'Compte séparé Les Tilleuls', 'à revoir'],
  ['01/06/2026', 'Cotisation fonds travaux', '+1 200 €', 'Compte séparé Villa Montaigne', 'rapprochée'],
]
