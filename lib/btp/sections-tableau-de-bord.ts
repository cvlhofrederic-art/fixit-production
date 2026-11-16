/**
 * Sections que la zone centrale du tableau de bord pro (app/(commun)/pro/dashboard/page.tsx) affiche à une société
 * BTP (pro_societe). Toute autre adresse de section (?p=…) ramène la société à l'accueil : un identifiant inconnu
 * laissait la zone centrale vide, et un écran d'un autre métier rendu par la même page s'ouvrait par son adresse
 * (constats coquille-9 et coquille-14 de l'audit du 11/11/2026).
 *
 * Les deux listes couvrent exactement les blocs `activePage === '…'` de la page : un test les compare.
 */

/** Écrans d'autres métiers rendus par la même page, jamais ouverts à une société BTP. */
export const SECTIONS_AUTRES_METIERS: ReadonlySet<string> = new Set([
  // Conciergerie
  'proprietes', 'acces', 'channel_manager', 'tarification', 'checkinout', 'livret', 'menage', 'revpar',
  // Gestionnaire
  'immeubles', 'missions',
  // Chantiers de l'artisan (la société BTP a les siens : « chantiers »)
  'chantiers_v22',
])

/** Sections ouvertes à une société BTP : son menu, ses écrans, et ceux qu'elle partage avec l'artisan. */
export const SECTIONS_SOCIETE_BTP: ReadonlySet<string> = new Set([
  'home', 'gestion_comptes', 'stats', 'revenus',
  'chantiers', 'gantt', 'equipes', 'pointage', 'estimation_materiaux', 'dictionnaire_materiaux', 'calendar', 'meteo',
  'photos_chantier', 'rapports',
  'pipeline', 'devis', 'dpgf', 'marches',
  'factures', 'situations', 'garanties',
  'sous_traitance', 'sous_traitance_offres', 'rfq_btp', 'materiaux', 'marketplace_btp',
  'compta_btp', 'rentabilite', 'comptabilite',
  'messages', 'comm_pro', 'clients', 'portail_client', 'canal',
  'wallet', 'contrats', 'bibliotheque', 'motifs', 'prestations', 'horaires',
  'portfolio', 'parrainage',
  'settings', 'modules', 'help',
])
