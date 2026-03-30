/**
 * Productivity Rates — BTP Reference Data
 *
 * m²/day/worker by trade for duration estimation.
 * Sources: DTU, REX artisan, FFB 2024
 *
 * Each range has min/avg/max to handle varying conditions
 * (complexity, site access, weather, experience).
 */

import type { Country } from '@/lib/config/companyTypes'

export interface ProductivityRate {
  task_type: string
  label_fr: string
  label_pt: string
  unit: 'm2' | 'ml' | 'u'    // m², mètre linéaire, unité
  min: number                  // m²/day/worker (easy conditions)
  avg: number                  // m²/day/worker (normal)
  max: number                  // m²/day/worker (fast/experienced)
  country: Country | 'all'
}

// ════════════════════════════════════════════
//  GROS OEUVRE
// ════════════════════════════════════════════

const GROS_OEUVRE: ProductivityRate[] = [
  { task_type: 'maconnerie_mur', label_fr: 'Maçonnerie murs', label_pt: 'Alvenaria paredes', unit: 'm2', min: 3, avg: 5, max: 8, country: 'all' },
  { task_type: 'maconnerie_dalle', label_fr: 'Dalle béton', label_pt: 'Laje de betão', unit: 'm2', min: 10, avg: 15, max: 25, country: 'all' },
  { task_type: 'fondations', label_fr: 'Fondations', label_pt: 'Fundações', unit: 'ml', min: 2, avg: 4, max: 6, country: 'all' },
  { task_type: 'demolition', label_fr: 'Démolition intérieure', label_pt: 'Demolição interior', unit: 'm2', min: 15, avg: 25, max: 40, country: 'all' },
  { task_type: 'charpente_bois', label_fr: 'Charpente bois', label_pt: 'Estrutura madeira', unit: 'm2', min: 4, avg: 6, max: 10, country: 'all' },
]

// ════════════════════════════════════════════
//  SECOND OEUVRE
// ════════════════════════════════════════════

const SECOND_OEUVRE: ProductivityRate[] = [
  { task_type: 'placo_pose', label_fr: 'Placo / BA13', label_pt: 'Pladur / Gesso cartonado', unit: 'm2', min: 10, avg: 15, max: 22, country: 'all' },
  { task_type: 'enduit_interieur', label_fr: 'Enduit intérieur', label_pt: 'Reboco interior', unit: 'm2', min: 8, avg: 12, max: 18, country: 'all' },
  { task_type: 'enduit_exterieur', label_fr: 'Enduit extérieur / ravalement', label_pt: 'Reboco exterior', unit: 'm2', min: 5, avg: 8, max: 12, country: 'all' },
  { task_type: 'isolation_interieure', label_fr: 'Isolation intérieure', label_pt: 'Isolamento interior', unit: 'm2', min: 10, avg: 15, max: 20, country: 'all' },
  { task_type: 'isolation_exterieure', label_fr: 'ITE (Isolation extérieure)', label_pt: 'ETICS (Isolamento exterior)', unit: 'm2', min: 4, avg: 6, max: 10, country: 'all' },
]

// ════════════════════════════════════════════
//  FINITIONS
// ════════════════════════════════════════════

const FINITIONS: ProductivityRate[] = [
  { task_type: 'peinture_interieure', label_fr: 'Peinture intérieure (2 couches)', label_pt: 'Pintura interior (2 demãos)', unit: 'm2', min: 15, avg: 25, max: 40, country: 'all' },
  { task_type: 'peinture_exterieure', label_fr: 'Peinture extérieure', label_pt: 'Pintura exterior', unit: 'm2', min: 8, avg: 12, max: 20, country: 'all' },
  { task_type: 'carrelage_sol', label_fr: 'Carrelage sol', label_pt: 'Azulejo pavimento', unit: 'm2', min: 6, avg: 10, max: 15, country: 'all' },
  { task_type: 'carrelage_mural', label_fr: 'Carrelage mural', label_pt: 'Azulejo parede', unit: 'm2', min: 4, avg: 7, max: 12, country: 'all' },
  { task_type: 'parquet_pose', label_fr: 'Parquet / sol stratifié', label_pt: 'Pavimento flutuante', unit: 'm2', min: 12, avg: 18, max: 25, country: 'all' },
  { task_type: 'faience_sdb', label_fr: 'Faïence salle de bain', label_pt: 'Azulejo casa de banho', unit: 'm2', min: 3, avg: 5, max: 8, country: 'all' },
]

// ════════════════════════════════════════════
//  PLOMBERIE / ELECTRICITE
// ════════════════════════════════════════════

const TECHNIQUE: ProductivityRate[] = [
  { task_type: 'plomberie_point', label_fr: 'Point de plomberie', label_pt: 'Ponto de canalização', unit: 'u', min: 1, avg: 2, max: 3, country: 'all' },
  { task_type: 'electricite_point', label_fr: 'Point électrique', label_pt: 'Ponto elétrico', unit: 'u', min: 4, avg: 6, max: 10, country: 'all' },
  { task_type: 'chauffage_radiateur', label_fr: 'Pose radiateur', label_pt: 'Instalação radiador', unit: 'u', min: 2, avg: 3, max: 5, country: 'all' },
  { task_type: 'climatisation_split', label_fr: 'Pose climatisation split', label_pt: 'Instalação ar condicionado split', unit: 'u', min: 0.5, avg: 1, max: 1.5, country: 'all' },
]

// ════════════════════════════════════════════
//  TOITURE / COUVERTURE
// ════════════════════════════════════════════

const TOITURE: ProductivityRate[] = [
  { task_type: 'couverture_tuiles', label_fr: 'Couverture tuiles', label_pt: 'Cobertura telha', unit: 'm2', min: 5, avg: 8, max: 12, country: 'all' },
  { task_type: 'etancheite_toiture', label_fr: 'Étanchéité toiture terrasse', label_pt: 'Impermeabilização terraço', unit: 'm2', min: 8, avg: 12, max: 18, country: 'all' },
  { task_type: 'zinguerie', label_fr: 'Zinguerie (gouttières)', label_pt: 'Caleiras / Rufos', unit: 'ml', min: 6, avg: 10, max: 15, country: 'all' },
]

// ════════════════════════════════════════════
//  MENUISERIE
// ════════════════════════════════════════════

const MENUISERIE: ProductivityRate[] = [
  { task_type: 'pose_fenetre', label_fr: 'Pose fenêtre', label_pt: 'Instalação janela', unit: 'u', min: 2, avg: 3, max: 5, country: 'all' },
  { task_type: 'pose_porte_int', label_fr: 'Pose porte intérieure', label_pt: 'Instalação porta interior', unit: 'u', min: 3, avg: 4, max: 6, country: 'all' },
  { task_type: 'pose_cuisine', label_fr: 'Pose cuisine équipée', label_pt: 'Instalação cozinha equipada', unit: 'ml', min: 1, avg: 2, max: 3, country: 'all' },
]

// ════════════════════════════════════════════
//  EXPORTS
// ════════════════════════════════════════════

export const ALL_PRODUCTIVITY_RATES: ProductivityRate[] = [
  ...GROS_OEUVRE,
  ...SECOND_OEUVRE,
  ...FINITIONS,
  ...TECHNIQUE,
  ...TOITURE,
  ...MENUISERIE,
]

/** Get rate by task_type */
export function getProductivityRate(taskType: string): ProductivityRate | undefined {
  return ALL_PRODUCTIVITY_RATES.find(r => r.task_type === taskType)
}

/** Get rates filtered by country (includes 'all') */
export function getProductivityRatesForCountry(country: Country): ProductivityRate[] {
  return ALL_PRODUCTIVITY_RATES.filter(r => r.country === 'all' || r.country === country)
}

/** Group rates by category for UI display */
export function getProductivityRatesGrouped(): Record<string, ProductivityRate[]> {
  return {
    'Gros œuvre': GROS_OEUVRE,
    'Second œuvre': SECOND_OEUVRE,
    'Finitions': FINITIONS,
    'Technique': TECHNIQUE,
    'Toiture': TOITURE,
    'Menuiserie': MENUISERIE,
  }
}
