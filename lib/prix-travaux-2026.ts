// lib/prix-travaux-2026.ts

export * from './prix-travaux-2026/types'
export * from './prix-travaux-2026/coefficients'
export * from './prix-travaux-2026/region-detector'
export * from './prix-travaux-2026/aides'

import type { PriceLine } from './prix-travaux-2026/types'

// Will be populated as métiers are added in Tasks 8-17.
// Once all data files exist, this becomes:
//   import { peintureLines } from './prix-travaux-2026/data/peinture'
//   ...
//   export const PRIX_2026: PriceLine[] = [...peintureLines, ...plomberieLines, ...]
export const PRIX_2026: PriceLine[] = []
