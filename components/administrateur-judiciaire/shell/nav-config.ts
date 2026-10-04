import { DEMO_TACHES } from '@/components/administrateur-judiciaire/data/taches'
import { joursAvantDateFr } from '@/lib/administrateur-judiciaire/domain/dates'

/**
 * Configuration de la navigation : sections de la barre latérale, libellés des routes (fil d'Ariane)
 * et libellés des groupes de la palette de commandes.
 */

/** Libellés des groupes de la palette : types d'entrée de l'index de recherche, puis groupes propres à la palette. */
export const LIBELLES_GROUPES_PALETTE: Record<string, string> = {
  modules: 'Modules',
  copro: 'Copropriétés',
  personne: 'Personnes',
  lot: 'Lots',
  prestataire: 'Prestataires',
  echeance: 'Échéances légales',
  acte: 'Actes pré-rédigés',
  recents: 'Récents',
  favorites: 'Favoris',
  all: 'Tous les modules',
  results: 'Résultats',
}

/**
 * Pastille par défaut de l'entrée « Aujourd'hui » : tâches de démonstration dont l'échéance tombe dans 3 jours ou
 * moins, retards compris. Constante de chargement ; en mode réel, les tâches de démonstration sont quand même comptées
 * par rapport à la date du jour (comportement de la maquette).
 */
export const NB_TACHES_ECHEANCE_PROCHE: number = DEMO_TACHES.filter((tache) => {
  const jours = joursAvantDateFr(tache.due)
  return jours != null && jours <= 3
}).length

/** Pseudo-route des sous-titres de section (« Obligations », « Assurances & énergie »…). */
export const ROUTE_SOUS_TITRE = '__H__'

/**
 * Entrée de la barre latérale : [route, libellé, icône, compteur, état]. Un sous-titre n'a que deux éléments
 * ([ROUTE_SOUS_TITRE, libellé]) ; l'état (« sage ») affiche le point « État actif ».
 */
export type EntreeNavigation = [route: string, libelle: string, icone?: string, compteur?: number | null, etat?: string]

export interface SectionNavigation {
  title: string
  items: EntreeNavigation[]
}

/** Sections de la barre latérale, dans l'ordre d'affichage. La section « Compte » contient la pseudo-route « logout ». */
export const SECTIONS_NAVIGATION: SectionNavigation[] = [
  {
    title: 'Agents IA',
    items: [
      ['fixy', 'Fixy', 'bot', null, 'sage'],
      ['max', 'Max — Juridique', 'grad'],
      ['lea', 'Léa — Comptable', 'sparkle'],
      ['alfredo', 'Alfredo — Courriers', 'mail'],
      ['tempo', 'Tempo — Échéances', 'clock'],
    ],
  },
  {
    title: 'Mandat judiciaire',
    items: [
      ['cockpit', "Aujourd'hui", 'lightning', NB_TACHES_ECHEANCE_PROCHE],
      ['dashboard', 'Tableau de bord', 'grid'],
      ['mandats', 'Ordonnances & missions', 'scale', 4],
      ['dossierJuge', 'Dossier du juge', 'doc'],
      ['agElective', 'AG élective', 'bank'],
      ['reddition', 'Reddition de comptes', 'doc'],
      ['honoraires', 'Honoraires & taxation', 'coin'],
    ],
  },
  {
    title: 'Pilotage judiciaire',
    items: [
      ['fiche360', 'Fiche 360 · copropriété', 'building'],
      ['personne360', 'Fiche 360 · personne', 'users'],
      ['reprise', 'Reprise judiciaire', 'upload'],
      ['priseFonction', 'Prise de fonction', 'clipboard'],
      ['dossierJud', 'Dossier juridictionnel', 'scale'],
      ['pouvoirs', 'Étendue des pouvoirs', 'shield'],
      ['redressement', 'Redressement (art. 29-1)', 'siren'],
      ['notifJud', 'Registre des notifications', 'mail', 2],
      ['journal', "Journal d'activité", 'clock'],
    ],
  },
  {
    title: 'Cabinet & supervision',
    items: [
      ['portefeuille', 'Portefeuille des mandats', 'grid', 14],
      ['charge', 'Charge des collaborateurs', 'users'],
      ['pointage', 'Pointage terrain', 'pin'],
      ['tempsDossiers', 'Suivi des dossiers', 'clock'],
      ['validation', 'Circuit de validation', 'check', 3],
    ],
  },
  {
    title: 'Gestion courante',
    items: [
      ['interventions', 'Ordres de service', 'clipboard', 4],
      ['canal', 'Canal de communication', 'chat', 1],
      ['planning', 'Planning', 'calendar'],
      ['equipe', 'Mon cabinet', 'team'],
    ],
  },
  {
    title: 'Patrimoine',
    items: [
      ['copros', 'Copropriétés', 'building', 4],
      ['lots', 'Lots & copropriétaires', 'users'],
      ['prestataires', 'Prestataires', 'wrench', 9],
      ['contrats', 'Contrats', 'handshake'],
      ['ascenseurs', 'Ascenseurs', 'monitor'],
      ['cctv', 'Vidéosurveillance', 'monitor'],
    ],
  },
  {
    title: 'Comptabilité & finances',
    items: [
      ['tresorerie', 'Banque & recouvrement', 'bank'],
      ['compta', 'Comptabilité copropriété', 'chart'],
      ['appels', 'Appels de fonds', 'coin'],
      ['impayes', 'Impayés & recouvrement', 'alert', 3],
      ['fondsTravaux', 'Fonds de travaux (ALUR)', 'bank'],
      ['openBanking', 'Open Banking', 'bank'],
      ['budget', 'Budget prévisionnel', 'fact'],
    ],
  },
  {
    title: 'Copropriétaires (Extranet)',
    items: [
      ['extranet', 'Espace copropriétaire', 'home'],
      ['affichage', "Tableau d'affichage", 'pin'],
      ['sondages', 'Sondages', 'poll'],
      ['reservation', 'Réservation parties communes', 'calendar'],
      ['doleances', 'Doléances', 'wrench'],
      ['sms', 'WhatsApp / SMS', 'chat'],
      ['remboursements', 'Remboursements', 'refresh'],
      ['nps', 'Enquête de satisfaction', 'heart'],
    ],
  },
  {
    title: 'Technique & travaux',
    items: [
      ['docsInterv', "Documents d'intervention", 'folder'],
      ['analyseDevis', 'Analyse devis / factures', 'search'],
      ['ppt', 'Plan pluriannuel (PPT)', 'construction'],
      ['carnet', "Carnet d'entretien", 'book'],
      ['visite', 'Visite technique / état daté', 'clipboard'],
      ['dtg', 'Diagnostic technique (DTG)', 'fact'],
      ['sinistres', 'Sinistres', 'shield', 1],
    ],
  },
  {
    title: 'Conformité légale',
    items: [
      [ROUTE_SOUS_TITRE, 'Obligations'],
      ['obligations', 'Obligations & échéances', 'scale'],
      ['calendrier', 'Calendrier réglementaire', 'calendar'],
      ['immat', 'Registre des copropriétés', 'archive'],
      [ROUTE_SOUS_TITRE, 'Assurances & énergie'],
      ['assurance', 'Assurance obligatoire', 'shield'],
      ['dpe', 'DPE & audit énergétique', 'bolt'],
      ['accessibilite', 'Accessibilité', 'target'],
      [ROUTE_SOUS_TITRE, 'AG & gouvernance'],
      ['prepAG', "Préparateur d'AG", 'pencil'],
      ['delibs', 'Tracker des délibérations', 'bot'],
      ['procurations', 'Procurations & présences', 'doc'],
      [ROUTE_SOUS_TITRE, 'Données & sécurité'],
      ['rgpd', 'RGPD', 'lock'],
      ['secIncendie', 'Sécurité incendie', 'flame'],
    ],
  },
  {
    title: 'Outils IA',
    items: [
      ['saisieFactures', 'Saisie IA factures', 'sparkle'],
      ['redactionPV', 'Rédaction de PV (IA)', 'pencil'],
      ['comDigitale', 'Communication digitale', 'chat'],
      ['signature', 'Signature électronique', 'stamp'],
      ['ged', 'Coffre-fort numérique', 'archive'],
    ],
  },
  {
    title: 'Compte',
    items: [
      ['modules', 'Mes modules', 'puzzle'],
      ['parametres', 'Paramètres', 'cog'],
      ['logout', 'Déconnexion', 'logout'],
    ],
  },
]

/**
 * Route → libellé de navigation (fil d'Ariane), sous-titres exclus : 77 routes, « logout » compris.
 * En cas de doublon, la dernière occurrence l'emporterait (il n'y en a aucun).
 */
export const LIBELLES_ROUTES: Record<string, string> = Object.fromEntries(
  SECTIONS_NAVIGATION.flatMap((section) =>
    section.items.filter((entree) => entree[0] !== ROUTE_SOUS_TITRE).map((entree) => [entree[0], entree[1]]),
  ),
)
