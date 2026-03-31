// ── Tenders Scanner — Configuration ─────────────────────────────────────────

import type { DepartmentConfig } from './types'

// Department configs — extensible to any French department
export const DEPARTMENTS: Record<string, DepartmentConfig> = {
  '13': {
    code: '13',
    name: 'Bouches-du-Rhône',
    region: 'PACA',
    region_code: '93',
    neighboring_depts: ['04', '05', '06', '83', '84'],
  },
  // Add more departments here when scaling
}

// ── BTP Trade classification ────────────────────────────────────────────────

export interface TradeDefinition {
  id: string
  label: string
  keywords: string[]
}

export const BTP_TRADES: TradeDefinition[] = [
  {
    id: 'gros_oeuvre',
    label: 'Gros œuvre',
    keywords: ['gros œuvre', 'gros oeuvre', 'fondation', 'structure béton', 'coffrage', 'ferraillage', 'dallage', 'terrassement'],
  },
  {
    id: 'maconnerie',
    label: 'Maçonnerie',
    keywords: ['maçonnerie', 'maconnerie', 'mur', 'parpaing', 'brique', 'enduit', 'mortier', 'cloison'],
  },
  {
    id: 'electricite',
    label: 'Électricité',
    keywords: ['électricité', 'electricite', 'électrique', 'electrique', 'courant', 'câblage', 'cablage', 'tableau électrique', 'éclairage', 'eclairage', 'basse tension', 'haute tension'],
  },
  {
    id: 'plomberie',
    label: 'Plomberie',
    keywords: ['plomberie', 'sanitaire', 'canalisation', 'tuyauterie', 'robinetterie', 'assainissement', 'eau potable', 'eaux usées', 'eaux pluviales'],
  },
  {
    id: 'chauffage_cvc',
    label: 'Chauffage / CVC',
    keywords: ['chauffage', 'climatisation', 'ventilation', 'cvc', 'hvac', 'chaudière', 'chaudiere', 'pompe à chaleur', 'pac', 'thermique', 'géothermie', 'radiateur'],
  },
  {
    id: 'menuiserie',
    label: 'Menuiserie',
    keywords: ['menuiserie', 'huisserie', 'fenêtre', 'fenetre', 'porte', 'volet', 'store', 'vitrage', 'boiserie', 'agencement'],
  },
  {
    id: 'toiture',
    label: 'Toiture / Couverture',
    keywords: ['toiture', 'couverture', 'charpente', 'tuile', 'ardoise', 'zinc', 'étanchéité toiture', 'zinguerie', 'gouttière', 'gouttiere'],
  },
  {
    id: 'peinture',
    label: 'Peinture',
    keywords: ['peinture', 'ravalement', 'façade', 'facade', 'revêtement mural', 'revetement mural', 'papier peint', 'enduit décoratif', 'lasure'],
  },
  {
    id: 'carrelage',
    label: 'Carrelage',
    keywords: ['carrelage', 'faïence', 'faience', 'sol', 'revêtement de sol', 'revetement de sol', 'mosaïque', 'dallage intérieur'],
  },
  {
    id: 'vrd',
    label: 'VRD / Voirie',
    keywords: ['vrd', 'voirie', 'réseaux divers', 'reseaux divers', 'enrobé', 'enrobe', 'bitume', 'trottoir', 'bordure', 'chaussée', 'chaussee', 'assainissement', 'réseau'],
  },
  {
    id: 'renovation',
    label: 'Rénovation / Réhabilitation',
    keywords: ['rénovation', 'renovation', 'réhabilitation', 'rehabilitation', 'restructuration', 'mise aux normes', 'réfection', 'refection', 'restauration'],
  },
  {
    id: 'maintenance',
    label: 'Maintenance bâtiment',
    keywords: ['maintenance', 'entretien', 'bâtiment', 'batiment', 'multi-technique', 'multitechnique', 'dépannage', 'depannage', 'contrat entretien'],
  },
  {
    id: 'demolition',
    label: 'Démolition',
    keywords: ['démolition', 'demolition', 'déconstruction', 'deconstruction', 'désamiantage', 'desamiantage', 'curage'],
  },
  {
    id: 'isolation',
    label: 'Isolation',
    keywords: ['isolation', 'ite', 'iti', 'isolant', 'thermique', 'acoustique', 'laine de verre', 'laine de roche', 'polystyrène', 'polyurethane'],
  },
  {
    id: 'serrurerie',
    label: 'Serrurerie / Métallerie',
    keywords: ['serrurerie', 'métallerie', 'metallerie', 'garde-corps', 'escalier métallique', 'grille', 'portail', 'clôture', 'cloture'],
  },
  {
    id: 'espaces_verts',
    label: 'Espaces verts',
    keywords: ['espaces verts', 'paysager', 'plantation', 'arrosage', 'élagage', 'elagage', 'engazonnement', 'jardin'],
  },
]

// Flat list of all BTP keywords for quick matching
export const ALL_BTP_KEYWORDS: string[] = BTP_TRADES.flatMap(t => t.keywords)

// Generic BTP indicator keywords (broader matching)
export const BTP_INDICATOR_KEYWORDS = [
  'travaux', 'chantier', 'ouvrage', 'construction', 'bâtiment', 'batiment',
  'génie civil', 'genie civil', 'marché de travaux', 'lot technique',
  'entreprise générale', 'entreprise generale', 'sous-traitance',
  'maître d\'ouvrage', 'maitre d\'ouvrage', 'maîtrise d\'œuvre',
]

// Keywords that indicate NON-BTP tenders (exclusion filter)
export const EXCLUDE_KEYWORDS = [
  'informatique', 'logiciel', 'prestations intellectuelles', 'audit',
  'consulting', 'fourniture de bureau', 'papeterie', 'imprimerie',
  'restauration collective', 'traiteur', 'gardiennage',
  'transport scolaire', 'assurance', 'formation professionnelle',
  'communication', 'agence de publicité', 'nettoyage de locaux',
  'contrôle technique automobile', 'véhicule', 'carburant',
]

// Mairie page detection keywords
export const MARCHES_PAGE_KEYWORDS = [
  'marchés publics', 'marches publics', 'marches-publics',
  'appels d\'offres', 'appels-d-offres', 'appel-offre',
  'consultations en cours', 'consultations-en-cours',
  'commande publique', 'commande-publique',
  'avis de marché', 'avis-de-marche',
  'dématérialisation', 'dematerialisation',
  'profil acheteur', 'profil-acheteur',
]

// Known BTP-related CPV prefixes
export const BTP_CPV_PREFIXES = [
  '45', // Construction
  '44', // Construction structures & materials
  '43', // Machinery for mining/quarrying/construction
  '71', // Architectural, construction, engineering (related services)
]

// Scanner config
export const SCANNER_CONFIG = {
  max_concurrent_requests: 5,
  request_delay_ms: 1500,
  request_timeout_ms: 10000,
  retry_count: 2,
  retry_delay_ms: 3000,
  max_pages_per_site: 3,
  cache_communes_hours: 168, // 7 days
  tender_retention_days: 30,
  boamp_days_back: 7,
  user_agent: 'VitfixTenderScanner/1.0 (+https://vitfix.io/bot)',
}
