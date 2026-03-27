/**
 * lib/marketplace-btp-types.ts
 * Types pour la Marketplace PRO BTP — location/vente de matériel entre professionnels
 */

export type MarketplaceCategorieId =
  // ── PRO uniquement ──────────────────────────────────────────────────────
  | 'engins_tp'           // Pelleteuse, bulldozer, compacteur, finisseur…
  | 'grues_levage'        // Grue mobile, chariot élévateur, nacelle, palan…
  | 'camions'             // Benne, plateau, semi-remorque, fourgon grand volume…
  | 'echafaudages'        // Tubes, plateaux, biquilles, tréteaux…
  | 'outillage_pro'       // Scie de sol, pompe haute pression, groupe électrogène…
  | 'materiaux_gros'      // Béton prêt, acier, bois de structure, parpaings big-bag…
  | 'materiaux_second'    // Carrelage palettes, plâtre sac, isolant rouleau…
  | 'materiel_electro'    // Armoires TGBT, câbles, tubes IRL, appareillage PRO…
  | 'autre_pro'
  // ── Accessibles aux artisans indépendants ───────────────────────────────
  | 'mini_engins'         // Minipelle <2T, mini-chargeur, débroussailleuse portée…
  | 'materiel_leger'      // Bétonnière 150L, compresseur 50L, vibreur béton…

export interface MarketplaceCategorie {
  id: MarketplaceCategorieId
  labelFr: string
  labelPt: string
  emoji: string
  accessibleAE: boolean   // accessible aux artisans indépendants
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategorie[] = [
  // PRO only
  { id: 'engins_tp',       labelFr: 'Engins de terrassement', labelPt: 'Máquinas de terraplanagem', emoji: '🏗️', accessibleAE: false },
  { id: 'grues_levage',    labelFr: 'Grues & levage',         labelPt: 'Gruas & elevação',           emoji: '🏗️', accessibleAE: false },
  { id: 'camions',         labelFr: 'Camions & véhicules',    labelPt: 'Camiões & veículos',          emoji: '🚛', accessibleAE: false },
  { id: 'echafaudages',    labelFr: 'Échafaudages & accès',   labelPt: 'Andaimes & acessos',          emoji: '🔩', accessibleAE: false },
  { id: 'outillage_pro',   labelFr: 'Outillage PRO',          labelPt: 'Ferramentas PRO',             emoji: '⚙️', accessibleAE: false },
  { id: 'materiaux_gros',  labelFr: 'Matériaux gros œuvre',   labelPt: 'Materiais estruturais',       emoji: '🧱', accessibleAE: false },
  { id: 'materiaux_second',labelFr: 'Matériaux second œuvre', labelPt: 'Materiais de acabamento',     emoji: '📦', accessibleAE: false },
  { id: 'materiel_electro',labelFr: 'Matériel électrique/plomberie PRO', labelPt: 'Material elétrico/canalização PRO', emoji: '⚡', accessibleAE: false },
  { id: 'autre_pro',       labelFr: 'Autre PRO',              labelPt: 'Outro PRO',                   emoji: '📋', accessibleAE: false },
  // AE accessible
  { id: 'mini_engins',     labelFr: 'Mini-engins',            labelPt: 'Mini-máquinas',               emoji: '🔧', accessibleAE: true },
  { id: 'materiel_leger',  labelFr: 'Matériel léger',         labelPt: 'Material leve',               emoji: '🛠️', accessibleAE: true },
]

export type TypeAnnonce = 'vente' | 'location' | 'vente_location'
export type EtatMateriel = 'neuf' | 'bon' | 'correct' | 'use'
export type StatusAnnonce = 'active' | 'paused' | 'vendu' | 'loue' | 'deleted'
export type StatusDemande = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled'

export interface MarketplaceListing {
  id: string
  user_id: string
  title: string
  description?: string
  categorie: MarketplaceCategorieId
  type_annonce: TypeAnnonce
  prix_vente?: number
  prix_location_jour?: number
  prix_location_semaine?: number
  prix_location_mois?: number
  disponible_de?: string
  disponible_jusqu?: string
  localisation?: string
  latitude?: number
  longitude?: number
  country: string
  marque?: string
  modele?: string
  annee?: number
  etat: EtatMateriel
  caracteristiques?: Record<string, string>
  photos?: string[]
  vendeur_nom?: string
  vendeur_phone?: string
  accessible_ae: boolean
  status: StatusAnnonce
  vues: number
  created_at: string
  updated_at: string
  // joints
  demandes?: MarketplaceDemande[]
}

export interface MarketplaceDemande {
  id: string
  listing_id: string
  buyer_user_id: string
  type_demande: 'achat' | 'location'
  date_debut?: string
  date_fin?: string
  message?: string
  prix_propose?: number
  status: StatusDemande
  reponse_vendeur?: string
  created_at: string
  updated_at: string
  // joints
  listing?: Pick<MarketplaceListing, 'id' | 'title' | 'categorie' | 'localisation' | 'photos'>
}

export interface CreateListingPayload {
  title: string
  description?: string
  categorie: MarketplaceCategorieId
  type_annonce: TypeAnnonce
  prix_vente?: number
  prix_location_jour?: number
  prix_location_semaine?: number
  prix_location_mois?: number
  disponible_de?: string
  disponible_jusqu?: string
  localisation?: string
  country?: string
  marque?: string
  modele?: string
  annee?: number
  etat: EtatMateriel
  caracteristiques?: Record<string, string>
  vendeur_nom?: string
  vendeur_phone?: string
}
