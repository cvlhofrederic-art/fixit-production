// lib/rentabilite/types.ts
// Shared types for the profitability calculation engine

// ── Legal Forms ──

export type FormeJuridiqueFR =
  | 'auto_entrepreneur' | 'micro_bic' | 'micro_bnc'
  | 'ei' | 'eurl_is' | 'eurl_ir'
  | 'sarl' | 'sasu' | 'sas' | 'sa_fr'

export type FormeJuridiquePT =
  | 'eni' | 'trabalhador_independente'
  | 'unipessoal_lda' | 'lda' | 'sa_pt'

export type FormeJuridique = FormeJuridiqueFR | FormeJuridiquePT

export type Juridiction = 'FR' | 'PT'

export const FORMES_ARTISAN: FormeJuridique[] = [
  'auto_entrepreneur', 'micro_bic', 'micro_bnc', 'ei',
  'eni', 'trabalhador_independente',
]

export const FORMES_PRO_BTP: FormeJuridique[] = [
  'eurl_is', 'eurl_ir', 'sarl', 'sasu', 'sas', 'sa_fr',
  'unipessoal_lda', 'lda', 'sa_pt',
]

// ── Reference Rate ──

export interface RefTaux {
  id: string
  juridiction: Juridiction
  type_charge: string
  regime: string
  taux: number
  seuil_min: number | null
  seuil_max: number | null
  date_debut_validite: string
  date_fin_validite: string | null
  source_reglementaire: string
  description: string | null
}

// ── Fixed Charge ──

export type CategorieChargeFix =
  | 'decennale' | 'rc_pro' | 'loyer' | 'leasing'
  | 'comptabilite' | 'vehicule' | 'telephone'
  | 'logiciel' | 'formation' | 'autre'

export interface ChargeFixe {
  id: string
  label: string
  montant: number
  frequence: 'mensuel' | 'trimestriel' | 'annuel'
  categorie: CategorieChargeFix
  date_debut: string | null
  date_fin: string | null
}

// ── Frais Annexe (devis/facture) ──

export interface FraisAnnexeItem {
  id: string
  designation: string
  categorie: 'deplacement' | 'location_materiel' | 'hebergement' | 'peage' | 'carburant' | 'autre'
  quantite: number
  unite: 'forfait' | 'km' | 'jour' | 'heure'
  prix_unitaire_ht: number
  tva_applicable: number
  total_ht: number
}

// ── Engine Input ──

export interface CoutsChantier {
  materiaux: number
  main_oeuvre: number
  sous_traitance: number
  frais_annexes: number
}

export interface CalculRentabiliteInput {
  chantier_id: string
  montant_facture_ht: number
  montant_devis_ht: number
  couts: CoutsChantier
  devis_detail?: CoutsChantier
  masse_salariale_brute: number
  juridiction: Juridiction
  forme_juridique: FormeJuridique
  regime_tva: string
  periode: Date
  sous_traitance_autoliquidation?: boolean
}

// ── Engine Output ──

export type StatutRentabilite = 'rentable' | 'juste' | 'perte'

export interface EcartPoste {
  prevu: number
  reel: number
  ecart_pct: number
}

export interface TauxApplique {
  type: string
  taux: number
  source: string
}

export interface ResultatRentabilite {
  // Level 1 — headline
  benefice_net: number
  taux_marge_nette: number
  statut: StatutRentabilite

  // Level 2 — charge breakdown
  marge_brute: number
  taux_marge_brute: number
  charges_sociales: number
  charges_fiscales: number
  quote_part_fixes: number
  total_charges: number

  // Level 3 — devis vs réalisé
  ecart_devis: {
    materiaux: EcartPoste
    main_oeuvre: EcartPoste
    sous_traitance: EcartPoste
    frais_annexes: EcartPoste
    total: EcartPoste
  }

  // Audit trail
  taux_appliques: TauxApplique[]
  date_calcul: Date
}

// ── Repartition mode ──

export type ModeRepartition = 'prorata_ca' | 'prorata_temps'

export interface ContexteRepartition {
  mode: ModeRepartition
  ca_chantier: number
  ca_total_periode: number
  jours_chantier: number
  jours_total_periode: number
  charges_fixes_mensuelles: number
  duree_mois: number
}
