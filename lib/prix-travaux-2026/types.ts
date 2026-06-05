// lib/prix-travaux-2026/types.ts

export type Metier =
  | 'plomberie' | 'electricite' | 'peinture' | 'plaquiste' | 'carrelage'
  | 'maconnerie' | 'couverture' | 'menuiserie' | 'serrurerie' | 'vitrerie'
  | 'chauffage' | 'climatisation' | 'paysagisme' | 'piscine' | 'ramonage'
  | 'nettoyage' | 'store-banne' | 'desamiantage' | 'photovoltaique' | 'ite'

export type Unit = 'm2' | 'ml' | 'unite' | 'forfait' | 'jour' | 'm3' | 'heure'

export type Gamme = 'economique' | 'standard' | 'premium'
export type Etat = 'bon' | 'use' | 'tres-degrade'
export type TvaRate = 5.5 | 10 | 20

export type Source = {
  name: string
  tier: 1 | 2 | 3
  url?: string
  excerpt?: string
  accessedAt?: string
}

export type CostBreakdown = {
  mainOeuvreHeures: number
  mainOeuvreTauxHoraire: number
  materiaux: number
  chargesEntreprise: number
  margeNette: number
}

export type MprBareme = 'bleu' | 'jaune' | 'violet' | 'rose'

export type AidesEligibles = {
  maPrimeRenov?: {
    bareme?: MprBareme
    forfaits: { bleu: number; jaune: number; violet: number; rose: number }
    plafondTravaux?: number
  }
  cee?: {
    forfaitParUnite: number
    operationStandard: string
  }
  tvaReduite?: 5.5 | 10
  ecoPTZ?: boolean
}

export type PriceLineConditions = {
  surfaceMin?: number
  surfaceMax?: number
  keywords?: string[]
  requiresFollowUp?: string[]
}

export type Confidence = 'high' | 'medium' | 'low'

export type PriceLine = {
  metier: Metier
  taskId: string
  label: string
  unit: Unit
  description?: string
  cost: CostBreakdown
  priceMin: number
  priceMax: number
  priceUnit: 'EUR_HT' | 'EUR_TTC'
  tva: TvaRate
  conditions?: PriceLineConditions
  aidesEligibles?: AidesEligibles
  sources: Source[]
  lastVerified: string
  confidence: Confidence
  notes?: string
}

export type ZoneCode =
  | 'IDF-PARIS' | 'IDF-GRANDE-COURONNE' | 'PACA' | 'AURA-METROPOLES'
  | 'OCC-METROPOLES' | 'GRAND-OUEST' | 'RURAL-FRANCE' | 'DOM' | 'STANDARD-FRANCE'

export type ZoneCoefficient = {
  code: ZoneCode
  label: string
  departements: string[]
  multiplier: number
  source: string
  lastVerified: string
}

export type GammeCoefficient = {
  level: Gamme
  multiplier: 0.90 | 1.00 | 1.15
  description: string
}

export type EtatCoefficient = {
  level: Etat
  multiplier: 1.00 | 1.10 | 1.25
  description: string
}
