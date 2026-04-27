// lib/prix-travaux-2026.ts

export * from './prix-travaux-2026/types'
export * from './prix-travaux-2026/coefficients'
export * from './prix-travaux-2026/region-detector'
export * from './prix-travaux-2026/aides'

import type { PriceLine } from './prix-travaux-2026/types'
import { peintureLines } from './prix-travaux-2026/data/peinture'
import { plomberieLines } from './prix-travaux-2026/data/plomberie'

export const PRIX_2026: PriceLine[] = [
  ...peintureLines,
  ...plomberieLines,
]
