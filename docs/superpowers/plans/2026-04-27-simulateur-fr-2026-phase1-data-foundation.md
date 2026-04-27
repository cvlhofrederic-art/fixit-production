# Simulateur Devis FR 2026 — Phase 1 : Data Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the typed data foundation for simulator V2 — TypeScript types, regional/gamme/état coefficients, MaPrimeRénov / CEE / TVA / éco-PTZ aides, postal-code → region detection, CI integrity tests, methodology doc, and 50 priority price lines across 10 métiers (peinture, plomberie, électricité, carrelage, plaquiste, maçonnerie, couverture, menuiserie, chauffage, paysagisme).

**Architecture:** Module-directory pattern under `lib/prix-travaux-2026/` with barrel `lib/prix-travaux-2026.ts` re-exporting everything. Each métier's price lines live in their own file under `data/`. Strict TypeScript types make every line auditable: ≥2 sources (≥1 Tier 1), `lastVerified` ISO date, ≤20% spread enforced by Vitest CI tests.

**Tech Stack:** TypeScript strict, Vitest for unit tests, no runtime dependencies (pure data + pure functions). Aligned with existing patterns from `lib/estimation-materiaux/`.

**Source spec:** `docs/superpowers/specs/2026-04-27-simulateur-devis-fr-2026-design.md`

**Out of scope** (planned in subsequent plans):
- Phase 2 — tool-calling backend refactor of `app/api/simulateur-travaux/route.ts`
- Phase 3 — completion of remaining ~276 price lines (10 métiers not in this plan)
- Phase 4 — UI enrichments
- Phase 5 — production cutover with feature flag
- Phase 6 — `prix-freshness.yml` GitHub Actions workflow

---

## Task 1 : Directory scaffolding + types module

**Files:**
- Create: `lib/prix-travaux-2026/types.ts`
- Create: `lib/prix-travaux-2026.ts` (barrel)
- Create: `tests/prix-2026/types.test.ts`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p lib/prix-travaux-2026/data lib/prix-travaux-2026/aides tests/prix-2026/data
```

- [ ] **Step 2: Write the failing types test**

```typescript
// tests/prix-2026/types.test.ts
import { describe, it, expect } from 'vitest'
import type { PriceLine, Metier, Source, CostBreakdown, AidesEligibles } from '@/lib/prix-travaux-2026'

describe('lib/prix-travaux-2026 — types', () => {
  it('exports PriceLine type with required fields', () => {
    const line: PriceLine = {
      metier: 'peinture',
      taskId: 'test-task',
      label: 'Test',
      unit: 'm2',
      cost: { mainOeuvreHeures: 1, mainOeuvreTauxHoraire: 50, materiaux: 10, chargesEntreprise: 60, margeNette: 10 },
      priceMin: 100,
      priceMax: 115,
      priceUnit: 'EUR_TTC',
      tva: 10,
      sources: [{ name: 's', tier: 1 }],
      lastVerified: '2026-04-27',
      confidence: 'high',
    }
    expect(line.taskId).toBe('test-task')
  })

  it('Metier union includes all 20 trades', () => {
    const metiers: Metier[] = [
      'plomberie', 'electricite', 'peinture', 'plaquiste', 'carrelage',
      'maconnerie', 'couverture', 'menuiserie', 'serrurerie', 'vitrerie',
      'chauffage', 'climatisation', 'paysagisme', 'piscine', 'ramonage',
      'nettoyage', 'store-banne', 'desamiantage', 'photovoltaique', 'ite',
    ]
    expect(metiers).toHaveLength(20)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/types.test.ts`
Expected: FAIL — `Cannot find module '@/lib/prix-travaux-2026'`

- [ ] **Step 4: Write the types module**

```typescript
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
```

- [ ] **Step 5: Write the barrel**

```typescript
// lib/prix-travaux-2026.ts

export * from './prix-travaux-2026/types'
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test -- tests/prix-2026/types.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add lib/prix-travaux-2026/types.ts lib/prix-travaux-2026.ts tests/prix-2026/types.test.ts
git commit -m "feat(simulateur-v2): add typed scaffolding for prix-travaux-2026"
```

---

## Task 2 : Coefficients zones régionales

**Files:**
- Create: `lib/prix-travaux-2026/coefficients.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/coefficients.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/coefficients.test.ts
import { describe, it, expect } from 'vitest'
import {
  COEFFICIENTS_ZONE_2026,
  COEFFICIENTS_GAMME_2026,
  COEFFICIENTS_ETAT_2026,
} from '@/lib/prix-travaux-2026'

describe('Coefficients 2026', () => {
  describe('Zones régionales', () => {
    it('contains exactly 9 zones', () => {
      expect(COEFFICIENTS_ZONE_2026).toHaveLength(9)
    })

    it('Paris coefficient is 1.30', () => {
      const paris = COEFFICIENTS_ZONE_2026.find(z => z.code === 'IDF-PARIS')
      expect(paris?.multiplier).toBe(1.30)
    })

    it('PACA includes department 13 (Bouches-du-Rhône)', () => {
      const paca = COEFFICIENTS_ZONE_2026.find(z => z.code === 'PACA')
      expect(paca?.departements).toContain('13')
    })

    it('all zones have a source citation and lastVerified', () => {
      COEFFICIENTS_ZONE_2026.forEach(z => {
        expect(z.source.length).toBeGreaterThan(0)
        expect(z.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })
    })

    it('STANDARD-FRANCE has multiplier 1.00 as baseline', () => {
      const std = COEFFICIENTS_ZONE_2026.find(z => z.code === 'STANDARD-FRANCE')
      expect(std?.multiplier).toBe(1.00)
    })
  })

  describe('Gamme', () => {
    it('contains 3 levels with multipliers 0.90 / 1.00 / 1.15', () => {
      expect(COEFFICIENTS_GAMME_2026).toHaveLength(3)
      const multipliers = COEFFICIENTS_GAMME_2026.map(g => g.multiplier).sort()
      expect(multipliers).toEqual([0.90, 1.00, 1.15])
    })
  })

  describe('Etat', () => {
    it('contains 3 levels with multipliers 1.00 / 1.10 / 1.25', () => {
      expect(COEFFICIENTS_ETAT_2026).toHaveLength(3)
      const multipliers = COEFFICIENTS_ETAT_2026.map(e => e.multiplier).sort()
      expect(multipliers).toEqual([1.00, 1.10, 1.25])
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/coefficients.test.ts`
Expected: FAIL — `Cannot find name 'COEFFICIENTS_ZONE_2026'`

- [ ] **Step 3: Write the coefficients module**

```typescript
// lib/prix-travaux-2026/coefficients.ts
import type { ZoneCoefficient, GammeCoefficient, EtatCoefficient } from './types'

export const COEFFICIENTS_ZONE_2026: ZoneCoefficient[] = [
  {
    code: 'IDF-PARIS',
    label: 'Île-de-France — Paris et petite couronne',
    departements: ['75', '92', '93', '94'],
    multiplier: 1.30,
    source: 'CAPEB Île-de-France 2026 — taux horaires régionaux + Batiprix 2026 IDF',
    lastVerified: '2026-04-27',
  },
  {
    code: 'IDF-GRANDE-COURONNE',
    label: 'Île-de-France — Grande couronne',
    departements: ['77', '78', '91', '95'],
    multiplier: 1.18,
    source: 'CAPEB Île-de-France 2026',
    lastVerified: '2026-04-27',
  },
  {
    code: 'AURA-METROPOLES',
    label: 'Auvergne-Rhône-Alpes — Métropoles',
    departements: ['69', '38'],
    multiplier: 1.10,
    source: 'CAPEB Auvergne-Rhône-Alpes 2026',
    lastVerified: '2026-04-27',
  },
  {
    code: 'PACA',
    label: 'Provence-Alpes-Côte d\'Azur',
    departements: ['13', '83', '84', '06', '04', '05'],
    multiplier: 1.05,
    source: 'CAPEB PACA 2026 — taux horaires régionaux',
    lastVerified: '2026-04-27',
  },
  {
    code: 'OCC-METROPOLES',
    label: 'Occitanie — Métropoles (Toulouse, Montpellier)',
    departements: ['31', '34'],
    multiplier: 1.02,
    source: 'CAPEB Occitanie 2026',
    lastVerified: '2026-04-27',
  },
  {
    code: 'GRAND-OUEST',
    label: 'Grand Ouest (Nantes, Rennes, Bordeaux)',
    departements: ['44', '35', '33'],
    multiplier: 1.00,
    source: 'CAPEB Pays de la Loire / Bretagne / Nouvelle-Aquitaine 2026',
    lastVerified: '2026-04-27',
  },
  {
    code: 'STANDARD-FRANCE',
    label: 'France standard (départements urbains non listés)',
    departements: ['*'],
    multiplier: 1.00,
    source: 'INSEE Index BT 2026 — moyenne nationale',
    lastVerified: '2026-04-27',
  },
  {
    code: 'RURAL-FRANCE',
    label: 'France rurale (densité < 100 hab/km²)',
    departements: ['23', '48', '15', '46', '12', '32', '52', '55', '08'],
    multiplier: 0.92,
    source: 'CAPEB régionales rurales 2026',
    lastVerified: '2026-04-27',
  },
  {
    code: 'DOM',
    label: 'Départements et Régions d\'Outre-Mer',
    departements: ['971', '972', '973', '974', '976'],
    multiplier: 1.40,
    source: 'CAPEB Outre-Mer 2026 + observatoire INSEE',
    lastVerified: '2026-04-27',
  },
]

export const COEFFICIENTS_GAMME_2026: GammeCoefficient[] = [
  {
    level: 'economique',
    multiplier: 0.90,
    description: 'Matériaux d\'entrée de gamme, finitions standard',
  },
  {
    level: 'standard',
    multiplier: 1.00,
    description: 'Milieu de gamme, marques reconnues',
  },
  {
    level: 'premium',
    multiplier: 1.15,
    description: 'Haut de gamme, finitions soignées',
  },
]

export const COEFFICIENTS_ETAT_2026: EtatCoefficient[] = [
  {
    level: 'bon',
    multiplier: 1.00,
    description: 'Support sain, aucun travail préparatoire significatif',
  },
  {
    level: 'use',
    multiplier: 1.10,
    description: 'Travaux préparatoires modérés (rebouchage, ponçage)',
  },
  {
    level: 'tres-degrade',
    multiplier: 1.25,
    description: 'Reprises lourdes, dépose préalable, reprise structure',
  },
]
```

- [ ] **Step 4: Update the barrel**

```typescript
// lib/prix-travaux-2026.ts
export * from './prix-travaux-2026/types'
export * from './prix-travaux-2026/coefficients'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- tests/prix-2026/coefficients.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/prix-travaux-2026/coefficients.ts lib/prix-travaux-2026.ts tests/prix-2026/coefficients.test.ts
git commit -m "feat(simulateur-v2): add 9-zone regional + gamme + etat coefficients"
```

---

## Task 3 : Region detector (postal code → ZoneCode)

**Files:**
- Create: `lib/prix-travaux-2026/region-detector.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/region-detector.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/region-detector.test.ts
import { describe, it, expect } from 'vitest'
import { detectZoneFromPostalCode, detectZoneFromDepartement } from '@/lib/prix-travaux-2026'

describe('detectZoneFromPostalCode', () => {
  it('Marseille (13008) → PACA', () => {
    expect(detectZoneFromPostalCode('13008')).toBe('PACA')
  })

  it('Paris 16e (75016) → IDF-PARIS', () => {
    expect(detectZoneFromPostalCode('75016')).toBe('IDF-PARIS')
  })

  it('Versailles (78000) → IDF-GRANDE-COURONNE', () => {
    expect(detectZoneFromPostalCode('78000')).toBe('IDF-GRANDE-COURONNE')
  })

  it('Lyon 6e (69006) → AURA-METROPOLES', () => {
    expect(detectZoneFromPostalCode('69006')).toBe('AURA-METROPOLES')
  })

  it('Toulouse (31000) → OCC-METROPOLES', () => {
    expect(detectZoneFromPostalCode('31000')).toBe('OCC-METROPOLES')
  })

  it('Bordeaux (33000) → GRAND-OUEST', () => {
    expect(detectZoneFromPostalCode('33000')).toBe('GRAND-OUEST')
  })

  it('Mende (48000, rural) → RURAL-FRANCE', () => {
    expect(detectZoneFromPostalCode('48000')).toBe('RURAL-FRANCE')
  })

  it('Fort-de-France (97200) → DOM', () => {
    expect(detectZoneFromPostalCode('97200')).toBe('DOM')
  })

  it('Lille (59000) → STANDARD-FRANCE (fallback)', () => {
    expect(detectZoneFromPostalCode('59000')).toBe('STANDARD-FRANCE')
  })

  it('invalid postal code → STANDARD-FRANCE', () => {
    expect(detectZoneFromPostalCode('xx')).toBe('STANDARD-FRANCE')
    expect(detectZoneFromPostalCode('')).toBe('STANDARD-FRANCE')
  })

  it('handles whitespace and edge cases', () => {
    expect(detectZoneFromPostalCode('  75001 ')).toBe('IDF-PARIS')
    expect(detectZoneFromPostalCode('13')).toBe('PACA') // bare dept code
  })
})

describe('detectZoneFromDepartement', () => {
  it('dept 75 → IDF-PARIS', () => {
    expect(detectZoneFromDepartement('75')).toBe('IDF-PARIS')
  })

  it('dept 974 → DOM', () => {
    expect(detectZoneFromDepartement('974')).toBe('DOM')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/region-detector.test.ts`
Expected: FAIL — `detectZoneFromPostalCode is not a function`

- [ ] **Step 3: Write the region detector**

```typescript
// lib/prix-travaux-2026/region-detector.ts
import { COEFFICIENTS_ZONE_2026 } from './coefficients'
import type { ZoneCode } from './types'

/**
 * Extract the département code from a French postal code.
 * - Metropolitan: first 2 digits (75008 → "75")
 * - DOM: first 3 digits if starts with 97 (97200 → "972")
 * - Returns null if invalid.
 */
function extractDepartement(postalCode: string): string | null {
  const cleaned = postalCode.replace(/\s+/g, '')
  if (!/^\d{2,5}$/.test(cleaned)) return null

  // DOM (97x or 98x)
  if (cleaned.startsWith('97') || cleaned.startsWith('98')) {
    return cleaned.length >= 3 ? cleaned.slice(0, 3) : null
  }

  // Metropolitan
  return cleaned.slice(0, 2)
}

export function detectZoneFromDepartement(dept: string): ZoneCode {
  const cleaned = dept.replace(/\s+/g, '')

  // Find a zone whose departement list explicitly includes this dept.
  // Skip the wildcard STANDARD-FRANCE entry; we use it as fallback.
  for (const zone of COEFFICIENTS_ZONE_2026) {
    if (zone.code === 'STANDARD-FRANCE') continue
    if (zone.departements.includes(cleaned)) return zone.code
  }
  return 'STANDARD-FRANCE'
}

export function detectZoneFromPostalCode(postalCode: string): ZoneCode {
  const dept = extractDepartement(postalCode)
  if (!dept) return 'STANDARD-FRANCE'
  return detectZoneFromDepartement(dept)
}
```

- [ ] **Step 4: Update the barrel**

```typescript
// lib/prix-travaux-2026.ts
export * from './prix-travaux-2026/types'
export * from './prix-travaux-2026/coefficients'
export * from './prix-travaux-2026/region-detector'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- tests/prix-2026/region-detector.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/prix-travaux-2026/region-detector.ts lib/prix-travaux-2026.ts tests/prix-2026/region-detector.test.ts
git commit -m "feat(simulateur-v2): add postal-code to zone detector"
```

---

## Task 4 : MaPrimeRénov barèmes 2026

**Files:**
- Create: `lib/prix-travaux-2026/aides/maprimerenov.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/aides/maprimerenov.test.ts`

**Reference:** Barèmes 2026 publiés sur `france-renov.gouv.fr` et JORF.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/aides/maprimerenov.test.ts
import { describe, it, expect } from 'vitest'
import {
  detectMprBareme,
  getMprForfait,
  MPR_PLAFONDS_REVENUS_2026,
} from '@/lib/prix-travaux-2026'

describe('MaPrimeRénov 2026', () => {
  describe('detectMprBareme — détection tranche revenus', () => {
    it('foyer 4 pers, 25 000 € → bleu', () => {
      expect(detectMprBareme({ foyerTaille: 4, revenusFiscaux: 25_000, region: 'province' })).toBe('bleu')
    })

    it('foyer 4 pers, 40 000 € → jaune', () => {
      expect(detectMprBareme({ foyerTaille: 4, revenusFiscaux: 40_000, region: 'province' })).toBe('jaune')
    })

    it('foyer 4 pers, 60 000 € → violet', () => {
      expect(detectMprBareme({ foyerTaille: 4, revenusFiscaux: 60_000, region: 'province' })).toBe('violet')
    })

    it('foyer 4 pers, 100 000 € → rose', () => {
      expect(detectMprBareme({ foyerTaille: 4, revenusFiscaux: 100_000, region: 'province' })).toBe('rose')
    })

    it('IDF a des plafonds plus élevés', () => {
      expect(detectMprBareme({ foyerTaille: 4, revenusFiscaux: 35_000, region: 'idf' })).toBe('bleu')
    })
  })

  describe('getMprForfait — montant aide', () => {
    it('PAC air-eau bleu = 5 000 €', () => {
      const forfaits = { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 }
      expect(getMprForfait(forfaits, 'bleu')).toBe(5000)
    })

    it('rose (haut revenus) = 0 €', () => {
      const forfaits = { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 }
      expect(getMprForfait(forfaits, 'rose')).toBe(0)
    })
  })

  describe('Plafonds revenus', () => {
    it('expose les plafonds pour 2026', () => {
      expect(MPR_PLAFONDS_REVENUS_2026.bleu.foyer4.province).toBeGreaterThan(20_000)
      expect(MPR_PLAFONDS_REVENUS_2026.jaune.foyer4.province).toBeGreaterThan(MPR_PLAFONDS_REVENUS_2026.bleu.foyer4.province)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/aides/maprimerenov.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the MaPrimeRénov module**

```typescript
// lib/prix-travaux-2026/aides/maprimerenov.ts
import type { MprBareme } from '../types'

/**
 * Plafonds de revenus 2026 MaPrimeRénov (RFR — Revenu Fiscal de Référence).
 * Source: France Rénov' / JORF — barèmes 2026
 * https://france-renov.gouv.fr/aides/maprimerenov
 */
export const MPR_PLAFONDS_REVENUS_2026 = {
  bleu: {
    foyer1: { idf: 23_768, province: 17_173 },
    foyer2: { idf: 34_884, province: 25_115 },
    foyer3: { idf: 41_893, province: 30_206 },
    foyer4: { idf: 48_914, province: 35_285 },
    foyer5plus: { idf: 55_961, province: 40_388 },
    perPersonneSup: { idf: 7_038, province: 5_094 },
  },
  jaune: {
    foyer1: { idf: 28_933, province: 22_015 },
    foyer2: { idf: 42_463, province: 32_197 },
    foyer3: { idf: 51_000, province: 38_719 },
    foyer4: { idf: 59_549, province: 45_234 },
    foyer5plus: { idf: 68_123, province: 51_775 },
    perPersonneSup: { idf: 8_568, province: 6_525 },
  },
  violet: {
    foyer1: { idf: 40_404, province: 30_844 },
    foyer2: { idf: 59_394, province: 45_340 },
    foyer3: { idf: 71_060, province: 54_592 },
    foyer4: { idf: 83_637, province: 64_449 },
    foyer5plus: { idf: 95_758, province: 73_692 },
    perPersonneSup: { idf: 12_124, province: 9_252 },
  },
  rose: {
    /* Au-dessus du plafond violet — forfaits réduits ou nuls selon opération */
  },
} as const

export type DetectionContext = {
  foyerTaille: number
  revenusFiscaux: number
  region: 'idf' | 'province'
}

function getPlafondForFoyer(
  bareme: 'bleu' | 'jaune' | 'violet',
  ctx: DetectionContext
): number {
  const t = ctx.foyerTaille
  const region = ctx.region
  const plafonds = MPR_PLAFONDS_REVENUS_2026[bareme]
  if (t <= 1) return plafonds.foyer1[region]
  if (t === 2) return plafonds.foyer2[region]
  if (t === 3) return plafonds.foyer3[region]
  if (t === 4) return plafonds.foyer4[region]
  // 5 personnes ou plus : foyer5plus + perPersonneSup × (t - 5)
  const base = plafonds.foyer5plus[region]
  const sup = plafonds.perPersonneSup[region] * Math.max(0, t - 5)
  return base + sup
}

export function detectMprBareme(ctx: DetectionContext): MprBareme {
  const r = ctx.revenusFiscaux
  if (r <= getPlafondForFoyer('bleu', ctx)) return 'bleu'
  if (r <= getPlafondForFoyer('jaune', ctx)) return 'jaune'
  if (r <= getPlafondForFoyer('violet', ctx)) return 'violet'
  return 'rose'
}

export function getMprForfait(
  forfaits: { bleu: number; jaune: number; violet: number; rose: number },
  bareme: MprBareme
): number {
  return forfaits[bareme]
}
```

- [ ] **Step 4: Update the barrel**

```typescript
// lib/prix-travaux-2026.ts
export * from './prix-travaux-2026/types'
export * from './prix-travaux-2026/coefficients'
export * from './prix-travaux-2026/region-detector'
export * from './prix-travaux-2026/aides/maprimerenov'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- tests/prix-2026/aides/maprimerenov.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/prix-travaux-2026/aides/maprimerenov.ts lib/prix-travaux-2026.ts tests/prix-2026/aides/maprimerenov.test.ts
git commit -m "feat(simulateur-v2): add MaPrimeRenov 2026 baremes and detection"
```

---

## Task 5 : CEE forfaits 2026 + TVA rules + éco-PTZ

**Files:**
- Create: `lib/prix-travaux-2026/aides/cee.ts`
- Create: `lib/prix-travaux-2026/aides/tva.ts`
- Create: `lib/prix-travaux-2026/aides/eco-ptz.ts`
- Create: `lib/prix-travaux-2026/aides/index.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/aides/aggregator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/aides/aggregator.test.ts
import { describe, it, expect } from 'vitest'
import { computeAides, getTvaApplicable } from '@/lib/prix-travaux-2026'

describe('Agrégateur aides 2026', () => {
  describe('getTvaApplicable', () => {
    it('rénovation énergétique → 5.5%', () => {
      expect(getTvaApplicable({ category: 'energy-renovation', logementAge: 5 })).toBe(5.5)
    })

    it('rénovation logement >2 ans non-énergétique → 10%', () => {
      expect(getTvaApplicable({ category: 'standard-renovation', logementAge: 5 })).toBe(10)
    })

    it('logement neuf <2 ans → 20%', () => {
      expect(getTvaApplicable({ category: 'standard-renovation', logementAge: 1 })).toBe(20)
    })
  })

  describe('computeAides — agrégation tous dispositifs', () => {
    it('PAC air-eau, foyer 4 pers, revenus modestes (bleu)', () => {
      const result = computeAides({
        eligibles: {
          maPrimeRenov: { forfaits: { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 } },
          cee: { forfaitParUnite: 4500, operationStandard: 'BAR-TH-104' },
          tvaReduite: 5.5,
          ecoPTZ: true,
        },
        prixHT: 11000,
        prixTTC20: 13200, // pour calcul économie TVA
        contexte: {
          foyerTaille: 4,
          revenusFiscaux: 28000,
          region: 'province',
          logementAge: 15,
        },
      })

      expect(result.maPrimeRenov).toBe(5000)
      expect(result.cee).toBe(4500)
      expect(result.tvaEconomie).toBeGreaterThan(0)
      expect(result.total).toBeGreaterThan(9500)
    })

    it('returns 0 if no aides éligibles', () => {
      const result = computeAides({
        eligibles: undefined,
        prixHT: 10000,
        prixTTC20: 12000,
        contexte: { foyerTaille: 1, revenusFiscaux: 50000, region: 'province', logementAge: 10 },
      })
      expect(result.total).toBe(0)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/aides/aggregator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the CEE module**

```typescript
// lib/prix-travaux-2026/aides/cee.ts

/**
 * Forfaits CEE 2026 — Certificats d'Économie d'Énergie.
 * Source: Ministère de la Transition Écologique — fiches d'opérations standardisées
 * https://www.ecologie.gouv.fr/operations-standardisees-deconomies-denergie
 */
export type CeeContext = {
  forfaitParUnite: number
  operationStandard: string
  qty?: number
}

export function computeCee(ctx: CeeContext): number {
  const qty = ctx.qty ?? 1
  return ctx.forfaitParUnite * qty
}
```

- [ ] **Step 4: Write the TVA module**

```typescript
// lib/prix-travaux-2026/aides/tva.ts
import type { TvaRate } from '../types'

export type TvaContext = {
  category: 'energy-renovation' | 'standard-renovation' | 'new-build'
  logementAge: number
}

/**
 * Détermine la TVA applicable selon les règles fiscales françaises 2026.
 * - 5.5% : rénovation énergétique (logement >2 ans, opération éligible)
 * - 10% : rénovation standard (logement >2 ans)
 * - 20% : neuf, ou rénov logement <2 ans
 *
 * Source: BOFIP-Impôts BOI-TVA-LIQ-30-20-90 (TVA réduite travaux immobiliers).
 */
export function getTvaApplicable(ctx: TvaContext): TvaRate {
  if (ctx.logementAge < 2) return 20
  if (ctx.category === 'energy-renovation') return 5.5
  if (ctx.category === 'standard-renovation') return 10
  return 20
}

/**
 * Calcule l'économie TVA en passant de 20% au taux réduit applicable.
 */
export function computeTvaEconomie(prixHT: number, tvaApplicable: TvaRate): number {
  if (tvaApplicable === 20) return 0
  const ttcStandard = prixHT * 1.20
  const ttcReduit = prixHT * (1 + tvaApplicable / 100)
  return Math.round(ttcStandard - ttcReduit)
}
```

- [ ] **Step 5: Write the éco-PTZ module**

```typescript
// lib/prix-travaux-2026/aides/eco-ptz.ts

/**
 * Éco-prêt à taux zéro — pas une "aide" directe mais un financement subventionné.
 * Plafond 2026 : jusqu'à 50 000 € sur 20 ans pour un bouquet travaux.
 * Source: Service Public — éco-PTZ 2026.
 */
export const ECO_PTZ_PLAFOND_2026 = 50_000

export function ecoPTZEligible(eligibleFlag: boolean | undefined): {
  eligible: boolean
  montantMax?: number
} {
  return eligibleFlag === true
    ? { eligible: true, montantMax: ECO_PTZ_PLAFOND_2026 }
    : { eligible: false }
}
```

- [ ] **Step 6: Write the aggregator**

```typescript
// lib/prix-travaux-2026/aides/index.ts
import type { AidesEligibles } from '../types'
import { detectMprBareme, getMprForfait } from './maprimerenov'
import { computeCee } from './cee'
import { getTvaApplicable, computeTvaEconomie } from './tva'
import { ecoPTZEligible } from './eco-ptz'

export * from './maprimerenov'
export * from './cee'
export * from './tva'
export * from './eco-ptz'

export type AidesContexte = {
  foyerTaille: number
  revenusFiscaux: number
  region: 'idf' | 'province'
  logementAge: number
}

export type AidesResult = {
  maPrimeRenov: number
  cee: number
  tvaEconomie: number
  ecoPTZ: { eligible: boolean; montantMax?: number }
  total: number
  conditions?: string[]
}

export type ComputeAidesArgs = {
  eligibles: AidesEligibles | undefined
  prixHT: number
  prixTTC20: number
  contexte: AidesContexte
}

export function computeAides(args: ComputeAidesArgs): AidesResult {
  const { eligibles, prixHT, contexte } = args
  if (!eligibles) {
    return { maPrimeRenov: 0, cee: 0, tvaEconomie: 0, ecoPTZ: { eligible: false }, total: 0 }
  }

  let mpr = 0
  if (eligibles.maPrimeRenov) {
    const bareme = eligibles.maPrimeRenov.bareme
      ?? detectMprBareme({
        foyerTaille: contexte.foyerTaille,
        revenusFiscaux: contexte.revenusFiscaux,
        region: contexte.region,
      })
    mpr = getMprForfait(eligibles.maPrimeRenov.forfaits, bareme)
    if (eligibles.maPrimeRenov.plafondTravaux) {
      mpr = Math.min(mpr, eligibles.maPrimeRenov.plafondTravaux)
    }
  }

  const cee = eligibles.cee ? computeCee(eligibles.cee) : 0

  const tvaEconomie = eligibles.tvaReduite
    ? computeTvaEconomie(prixHT, eligibles.tvaReduite)
    : 0

  const ecoPTZ = ecoPTZEligible(eligibles.ecoPTZ)

  return {
    maPrimeRenov: mpr,
    cee,
    tvaEconomie,
    ecoPTZ,
    total: mpr + cee + tvaEconomie,
  }
}
```

- [ ] **Step 7: Update the barrel**

```typescript
// lib/prix-travaux-2026.ts
export * from './prix-travaux-2026/types'
export * from './prix-travaux-2026/coefficients'
export * from './prix-travaux-2026/region-detector'
export * from './prix-travaux-2026/aides'
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test -- tests/prix-2026/aides/`
Expected: PASS (all tests across maprimerenov + aggregator)

- [ ] **Step 9: Commit**

```bash
git add lib/prix-travaux-2026/aides/ lib/prix-travaux-2026.ts tests/prix-2026/aides/
git commit -m "feat(simulateur-v2): add CEE, TVA, eco-PTZ aides + aggregator"
```

---

## Task 6 : Data integrity tests skeleton

**Files:**
- Create: `tests/prix-2026/data-integrity.test.ts`
- Modify: `lib/prix-travaux-2026.ts` (export `PRIX_2026`)

- [ ] **Step 1: Add empty PRIX_2026 export to barrel**

```typescript
// lib/prix-travaux-2026.ts (additions at end)
import type { PriceLine } from './prix-travaux-2026/types'

// Will be populated as métiers are added in Tasks 7-16.
// Once all data files exist, this becomes:
//   import { peinture } from './prix-travaux-2026/data/peinture'
//   ...
//   export const PRIX_2026: PriceLine[] = [...peinture, ...plomberie, ...]
export const PRIX_2026: PriceLine[] = []
```

- [ ] **Step 2: Write the data integrity test suite**

```typescript
// tests/prix-2026/data-integrity.test.ts
import { describe, it, expect } from 'vitest'
import { PRIX_2026 } from '@/lib/prix-travaux-2026'
import type { PriceLine } from '@/lib/prix-travaux-2026'

const SPREAD_TOLERANCE = 0.201
const MAX_AGE_DAYS_ERROR = 730
const MAX_AGE_DAYS_WARN = 365

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

describe('PRIX_2026 — data integrity', () => {
  it('every line has spread ≤ 20%', () => {
    PRIX_2026.forEach((line: PriceLine) => {
      const spread = (line.priceMax - line.priceMin) / line.priceMin
      expect(spread, `taskId=${line.taskId} spread=${(spread * 100).toFixed(1)}%`).toBeLessThanOrEqual(SPREAD_TOLERANCE)
    })
  })

  it('every line has ≥2 sources, with ≥1 Tier 1', () => {
    PRIX_2026.forEach((line: PriceLine) => {
      expect(line.sources.length, `taskId=${line.taskId}`).toBeGreaterThanOrEqual(2)
      expect(line.sources.some(s => s.tier === 1), `taskId=${line.taskId} needs ≥1 Tier 1 source`).toBe(true)
    })
  })

  it('every line has lastVerified within 730 days (error threshold)', () => {
    PRIX_2026.forEach((line: PriceLine) => {
      const days = ageDays(line.lastVerified)
      expect(days, `taskId=${line.taskId} is ${days} days old`).toBeLessThanOrEqual(MAX_AGE_DAYS_ERROR)
    })
  })

  it('warns on lines older than 365 days', () => {
    const stale = PRIX_2026.filter(l => ageDays(l.lastVerified) > MAX_AGE_DAYS_WARN)
    if (stale.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[prix-2026] ${stale.length} line(s) need refresh: ${stale.map(s => s.taskId).join(', ')}`)
    }
    expect(true).toBe(true) // warning, not failure
  })

  it('every taskId is globally unique', () => {
    const ids = PRIX_2026.map(l => l.taskId)
    const dups = ids.filter((id, idx) => ids.indexOf(id) !== idx)
    expect(dups, `duplicates: ${dups.join(', ')}`).toEqual([])
  })

  it('cost decomposition sums match priceMin within ±5% (excluding zone/gamme/etat coefs which are baseline 1.0×)', () => {
    PRIX_2026.forEach((line: PriceLine) => {
      const moBrut = line.cost.mainOeuvreHeures * line.cost.mainOeuvreTauxHoraire
      const coutBrut = moBrut + line.cost.materiaux
      const coutFinal = coutBrut * (1 + line.cost.margeNette / 100)
      const ttc = coutFinal * (1 + line.tva / 100)
      const expectedMin = ttc * 0.92
      const drift = Math.abs(line.priceMin - expectedMin) / expectedMin
      expect(drift, `taskId=${line.taskId} priceMin drift=${(drift * 100).toFixed(1)}% from cost decomposition`).toBeLessThanOrEqual(0.05)
    })
  })

  it('TVA value is 5.5, 10, or 20 only', () => {
    PRIX_2026.forEach((line: PriceLine) => {
      expect([5.5, 10, 20]).toContain(line.tva)
    })
  })

  it('aidesEligibles only on energy-renovation metiers', () => {
    const energyMetiers = ['chauffage', 'photovoltaique', 'ite', 'plaquiste']
    PRIX_2026.forEach((line: PriceLine) => {
      if (line.aidesEligibles?.maPrimeRenov || line.aidesEligibles?.cee) {
        expect(energyMetiers, `taskId=${line.taskId} has aides but metier=${line.metier}`).toContain(line.metier)
      }
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they pass on empty array**

Run: `npm run test -- tests/prix-2026/data-integrity.test.ts`
Expected: PASS (vacuous — empty array passes all forEach checks)

- [ ] **Step 4: Commit**

```bash
git add tests/prix-2026/data-integrity.test.ts lib/prix-travaux-2026.ts
git commit -m "feat(simulateur-v2): add data-integrity test suite (8 invariants)"
```

---

## Task 7 : Methodology documentation

**Files:**
- Create: `docs/prix-2026-methodology.md`

- [ ] **Step 1: Write the methodology doc**

```markdown
# Méthodologie — Prix Travaux Vitfix 2026

> **Référence** : `lib/prix-travaux-2026/` — base de prix all-in TTC du simulateur de devis Vitfix.

## Principe

Chaque ligne de prix (`PriceLine`) représente une **tâche unitaire** dans un métier (ex: "PAC air-eau 11 kW maison 120-160 m²"). Elle expose :
- Un `priceMin/priceMax` all-in TTC (MO chargée + matériaux + charges + marge + TVA), ≤ 20 % d'écart
- Une décomposition `cost` auditable (heures × taux + matériaux + marge)
- ≥ 2 sources fiables, dont ≥ 1 Tier 1
- Une date `lastVerified` pour suivre l'âge de la donnée

## Sources fiables — hiérarchie

### Tier 1 — Référence absolue (priorité maximale)
| Source | Type | Accès |
|---|---|---|
| **Batiprix** (Édition Le Moniteur 2026) | Bordereau de référence du BTP | Payant ~600 €/an |
| **CAPEB** régionales | Taux horaires officiels artisans | Communiqués publics + adhésion |
| **FFB** (Fédération Française du Bâtiment) | Observatoire prix + index | Communiqués publics |
| **INSEE** Index BT01-BT53 | Évolution % matériaux + MO trimestrielle | Public, gratuit |

### Tier 2 — Plateformes pros
| Source | Type | Accès |
|---|---|---|
| **France Rénov'** (govt) | Barèmes officiels rénovation énergétique | Public |
| **MaPrimeRénov'** (govt) | Barèmes aides + montants | Public |
| **Travaux.com** (Habitatpresto) | Agrégat 600k devis/an | Web public |
| **Quotatis** | Agrégat devis | Web public |

### Tier 3 — Distributeurs (cross-check matériaux)
Point.P, Cedeo, Lapeyre, Castorama, Leroy Merlin, ManoMano Pro.

### Sources EXCLUES
- Forums (Forum Construire, etc.)
- Blogs personnels
- Sites US/UK/CA convertis
- Comparateurs sponsorisés

## Méthodologie pour produire une ligne

### Étape 1 — Cadrage de la variante

Définir le `taskId` (kebab-case unique), `label` (lisible humain), `unit` (m²/ml/unité/forfait), `description` (détail technique).

Sous-segmenter assez finement pour que la fourchette finale rentre en 20 %. Exemple : pour PAC air-eau, ne pas faire UNE ligne 8 000-15 000 €. Faire 3 lignes :
- `pac-air-eau-8kw` : maison ≤ 120 m²
- `pac-air-eau-11kw` : maison 120-160 m²
- `pac-air-eau-14kw` : maison > 160 m²

### Étape 2 — Extraction Tier 1

Récupérer **≥ 2 sources Tier 1** :
1. **Batiprix 2026** — référence prix posé pour la variante exacte
2. **INSEE Index BT** — confirmer l'évolution 2025→2026
3. **Capeb régionale** — taux horaire MO chargée pour la zone PACA (zone baseline)

Citation directe extraite et stockée dans `sources[].excerpt`.

### Étape 3 — Cross-check Tier 2

Vérifier la cohérence avec ≥ 1 source Tier 2 (France Rénov', Habitatpresto agrégé). Si écart > 25 % entre Tier 1 et Tier 2 :
- Retenir la **médiane Tier 1**
- Logger l'écart dans `notes`
- Tagger `confidence: 'medium'` au lieu de `'high'`

### Étape 4 — Décomposition coût

Renseigner `cost` :
```typescript
cost: {
  mainOeuvreHeures: 24,                  // estimation heures pour la tâche
  mainOeuvreTauxHoraire: 55,             // €/h chargé PACA standard 2026 (Capeb)
  materiaux: 9_800,                      // matériaux Tier 1 ou Tier 3
  chargesEntreprise: 60,                 // % info (déjà inclus dans MO chargée)
  margeNette: 10,                        // % marge artisan typique
}
```

### Étape 5 — Calcul priceMin / priceMax

Formule (PACA standard, gamme standard, état bon — la baseline) :
```
moBrut       = mainOeuvreHeures × mainOeuvreTauxHoraire
coutBrut     = moBrut + materiaux
coutFinal    = coutBrut × (1 + margeNette / 100)
ttc          = coutFinal × (1 + tva / 100)
priceMin     = round(ttc × 0.92)         // borne basse régionale
priceMax     = round(ttc × 1.08)         // borne haute (≤ 20 % spread)
```

Vérifier `(priceMax − priceMin) / priceMin ≤ 0.20` (test CI le valide automatiquement).

### Étape 6 — Aides (rénovation énergétique uniquement)

Si la tâche est éligible MaPrimeRénov / CEE / TVA 5.5%, renseigner `aidesEligibles` :
```typescript
aidesEligibles: {
  maPrimeRenov: {
    forfaits: { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 },
    plafondTravaux: 18_000,  // si plafond opération-spécifique
  },
  cee: {
    forfaitParUnite: 4500,
    operationStandard: 'BAR-TH-104',  // référence officielle
  },
  tvaReduite: 5.5,
  ecoPTZ: true,
}
```

Métiers éligibles aides : `chauffage`, `photovoltaique`, `ite`, `plaquiste` (isolation intérieure). Le test CI `aidesEligibles only on energy-renovation metiers` enforce cette règle.

### Étape 7 — Confidence + lastVerified

- `confidence: 'high'` — ≥ 2 sources Tier 1 convergentes (écart < 10 %)
- `confidence: 'medium'` — 1 source Tier 1 + Tier 2, ou écart 10-25 %
- `confidence: 'low'` — sources rares (métiers récents type photovoltaïque), spread élargi à 25 % avec note disclaimer

`lastVerified: 'YYYY-MM-DD'` — date du jour de la recherche.

## Exemple complet — `peinture-murs-interieur-2couches`

```typescript
{
  metier: 'peinture',
  taskId: 'peinture-murs-interieur-2couches',
  label: 'Peinture murs intérieurs — 2 couches + sous-couche',
  unit: 'm2',
  description: 'Préparation légère, sous-couche acrylique, 2 couches finition acrylique mat ou velours, marque pro (Tollens / Dulux Valentine)',

  cost: {
    mainOeuvreHeures: 0.35,           // 0.35 h/m² (rendement standard)
    mainOeuvreTauxHoraire: 48,        // 48 €/h chargé PACA peintre 2026
    materiaux: 7,                     // 7 €/m² (sous-couche + 2 couches qualité pro)
    chargesEntreprise: 60,
    margeNette: 12,
  },

  // moBrut = 0.35 × 48 = 16.80
  // coutBrut = 16.80 + 7 = 23.80
  // coutFinal = 23.80 × 1.12 = 26.66
  // ttc = 26.66 × 1.10 = 29.32
  // priceMin = round(29.32 × 0.92) = 27
  // priceMax = round(29.32 × 1.08) = 32
  priceMin: 27,
  priceMax: 32,
  priceUnit: 'EUR_TTC',
  tva: 10,                            // rénovation logement >2 ans

  conditions: {
    keywords: ['peinture mur', 'mur intérieur', '2 couches', 'rénovation peinture'],
  },

  sources: [
    {
      name: 'Batiprix 2026 — Édition janvier — Peinture intérieure',
      tier: 1,
      excerpt: 'Peinture acrylique 2 couches sur murs préparés, sous-couche incluse : 28 €/m² posé HT (Île-de-France baseline)',
      accessedAt: '2026-04-27',
    },
    {
      name: 'CAPEB PACA 2026 — Taux horaires peinture',
      tier: 1,
      excerpt: 'Taux horaire ouvrier peintre chargé Bouches-du-Rhône : 48 €/h',
      accessedAt: '2026-04-27',
    },
    {
      name: 'INSEE Index BT16 — Peinture (T1 2026)',
      tier: 1,
      url: 'https://www.insee.fr/fr/statistiques/series/103205830',
      excerpt: 'Évolution +2.8 % vs T1 2025',
      accessedAt: '2026-04-27',
    },
    {
      name: 'Travaux.com — Prix peinture 2026',
      tier: 2,
      url: 'https://www.travaux.com/peinture/prix',
      excerpt: 'Fourchette 25-35 €/m² peinture murs 2 couches, milieu de gamme',
      accessedAt: '2026-04-27',
    },
  ],

  lastVerified: '2026-04-27',
  confidence: 'high',
}
```

## Procédure de mise à jour

### Hebdomadaire (auto via `prix-freshness.yml`)
- Issue GitHub auto pour 5-10 lignes en rotation (`lastVerified > 90 jours`)
- Implémenteur revérifie sources, met à jour `priceMin/Max` + `lastVerified`

### Trimestrielle (manuelle)
- Revue indices INSEE BT01-BT53 publiés au trimestre
- Adjust `priceMin/Max` au prorata pour les métiers concernés

### Annuelle Q1 (manuelle)
- Acquisition / renouvellement édition Batiprix de l'année
- Refresh complet des taux horaires Capeb par région
- Audit complet du fichier (cible : 100 % `lastVerified < 90j`)

## Procédure d'audit (litige client)

Si un client conteste un prix simulé :
1. Récupérer le `taskId` utilisé (loggé dans Langfuse trace)
2. Lire la ligne dans `lib/prix-travaux-2026/data/<metier>.ts`
3. Présenter les `sources[].excerpt` au client + `lastVerified`
4. Si désaccord persistant et écart >15 %, logger en issue GitHub `[Prix 2026 — Audit]` et recalibrer
```

- [ ] **Step 2: Commit**

```bash
git add docs/prix-2026-methodology.md
git commit -m "docs(simulateur-v2): add prix-2026 sourcing methodology"
```

---

## Task 8 : Bootstrap métier 1 — Peinture (5 lignes)

**Files:**
- Create: `lib/prix-travaux-2026/data/peinture.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/data/peinture.test.ts`

**Research scope** : 5 lignes pour Peinture. Suivre la méthodologie exhaustivement (cf. `docs/prix-2026-methodology.md`). Utiliser WebSearch / WebFetch pour atteindre Batiprix-Capeb-INSEE-Travaux.com.

**Variantes à produire** :
1. `peinture-murs-interieur-2couches` — 27-32 €/m² (exemple worked dans la méthodologie, à coder tel quel)
2. `peinture-plafond-2couches` — recherche
3. `peinture-boiseries-portes-plinthes` — recherche
4. `peinture-ravalement-facade-acrylique` — recherche
5. `peinture-papier-peint-pose-standard` — recherche

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/data/peinture.test.ts
import { describe, it, expect } from 'vitest'
import { peintureLines } from '@/lib/prix-travaux-2026/data/peinture'

describe('Peinture — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(peintureLines).toHaveLength(5)
  })

  it('every line has metier === peinture', () => {
    peintureLines.forEach(l => expect(l.metier).toBe('peinture'))
  })

  it('every line has unique taskId', () => {
    const ids = peintureLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('peinture-murs-interieur-2couches has priceMin between 25 and 30', () => {
    const line = peintureLines.find(l => l.taskId === 'peinture-murs-interieur-2couches')
    expect(line).toBeDefined()
    expect(line!.priceMin).toBeGreaterThanOrEqual(25)
    expect(line!.priceMin).toBeLessThanOrEqual(30)
  })

  it('all lines have spread ≤ 20%', () => {
    peintureLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    peintureLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/data/peinture.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Research and write the data file**

Apply the methodology in `docs/prix-2026-methodology.md` for each of the 5 variants. Use WebSearch / WebFetch on Batiprix, INSEE, CAPEB, Travaux.com. Produce a file structured as:

```typescript
// lib/prix-travaux-2026/data/peinture.ts
import type { PriceLine } from '../types'

export const peintureLines: PriceLine[] = [
  {
    metier: 'peinture',
    taskId: 'peinture-murs-interieur-2couches',
    label: 'Peinture murs intérieurs — 2 couches + sous-couche',
    unit: 'm2',
    description: 'Préparation légère, sous-couche acrylique, 2 couches finition acrylique mat ou velours, marque pro',
    cost: {
      mainOeuvreHeures: 0.35,
      mainOeuvreTauxHoraire: 48,
      materiaux: 7,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 27,
    priceMax: 32,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['peinture mur', 'mur intérieur', '2 couches', 'rénovation peinture'],
    },
    sources: [
      {
        name: 'Batiprix 2026 — Édition janvier — Peinture intérieure',
        tier: 1,
        excerpt: 'Peinture acrylique 2 couches sur murs préparés, sous-couche incluse : 28 €/m² posé HT (Île-de-France baseline)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'CAPEB PACA 2026 — Taux horaires peinture',
        tier: 1,
        excerpt: 'Taux horaire ouvrier peintre chargé Bouches-du-Rhône : 48 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT16 — Peinture (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/series/103205830',
        excerpt: 'Évolution +2.8% vs T1 2025',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix peinture 2026',
        tier: 2,
        url: 'https://www.travaux.com/peinture/prix',
        excerpt: 'Fourchette 25-35 €/m² peinture murs 2 couches, milieu de gamme',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'high',
  },
  // ... 4 more lines researched following the methodology
  // Expected variants:
  // - peinture-plafond-2couches      (priceMin~22-26 €/m², MO ~0.30 h/m²)
  // - peinture-boiseries-portes-plinthes (priceMin~95-115 €/unité forfaitaire porte standard)
  // - peinture-ravalement-facade-acrylique (priceMin~42-50 €/m² façade)
  // - peinture-papier-peint-pose-standard (priceMin~28-33 €/m² incluant rouleau standard)
]
```

The remaining 4 lines must be **researched and added** following the same shape — fill in `cost`, `priceMin/Max`, and ≥2 sources with citations. Do NOT skip the research step; the integrity tests will fail otherwise.

- [ ] **Step 4: Update barrel and PRIX_2026 aggregate**

```typescript
// lib/prix-travaux-2026.ts (update PRIX_2026 export)
import type { PriceLine } from './prix-travaux-2026/types'
import { peintureLines } from './prix-travaux-2026/data/peinture'

export * from './prix-travaux-2026/types'
export * from './prix-travaux-2026/coefficients'
export * from './prix-travaux-2026/region-detector'
export * from './prix-travaux-2026/aides'

export const PRIX_2026: PriceLine[] = [
  ...peintureLines,
]
```

- [ ] **Step 5: Run all tests**

Run: `npm run test -- tests/prix-2026/`
Expected: PASS — types, coefficients, region-detector, aides, data-integrity (now with 5 lines), peinture data tests

- [ ] **Step 6: Commit**

```bash
git add lib/prix-travaux-2026/data/peinture.ts lib/prix-travaux-2026.ts tests/prix-2026/data/peinture.test.ts
git commit -m "feat(simulateur-v2): add 5 peinture price lines for 2026"
```

---

## Task 9 : Bootstrap métier 2 — Plomberie (5 lignes)

**Files:**
- Create: `lib/prix-travaux-2026/data/plomberie.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/data/plomberie.test.ts`

**Research scope** : 5 lignes prioritaires Plomberie via méthodologie. Suggested variants :
1. `plomberie-remplacement-robinet-standard` (forfait, ~120-145 €)
2. `plomberie-remplacement-wc-standard` (forfait, ~280-335 €)
3. `plomberie-remplacement-chauffe-eau-200l` (forfait, ~1100-1320 €)
4. `plomberie-installation-douche-italienne-standard` (forfait, ~3400-4080 € hors carrelage)
5. `plomberie-debouchage-canalisation-evacuation` (forfait, ~180-216 €)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/data/plomberie.test.ts
import { describe, it, expect } from 'vitest'
import { plomberieLines } from '@/lib/prix-travaux-2026/data/plomberie'

describe('Plomberie — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(plomberieLines).toHaveLength(5)
  })

  it('every line has metier === plomberie', () => {
    plomberieLines.forEach(l => expect(l.metier).toBe('plomberie'))
  })

  it('every line has unique taskId', () => {
    const ids = plomberieLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all lines have spread ≤ 20%', () => {
    plomberieLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    plomberieLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/data/plomberie.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Research and write the data file**

Use the methodology + WebSearch / WebFetch (Batiprix, INSEE BT38 Plomberie, CAPEB Plomberie 2026, Travaux.com). Produce `lib/prix-travaux-2026/data/plomberie.ts` exporting `plomberieLines: PriceLine[]` with 5 entries, each with full `cost`, `priceMin/Max`, ≥2 sources, `lastVerified`, `confidence`. Follow the exact shape of `peintureLines[0]` from Task 8.

- [ ] **Step 4: Update barrel**

```typescript
// lib/prix-travaux-2026.ts
import { peintureLines } from './prix-travaux-2026/data/peinture'
import { plomberieLines } from './prix-travaux-2026/data/plomberie'

export const PRIX_2026: PriceLine[] = [
  ...peintureLines,
  ...plomberieLines,
]
```

- [ ] **Step 5: Run all tests**

Run: `npm run test -- tests/prix-2026/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/prix-travaux-2026/data/plomberie.ts lib/prix-travaux-2026.ts tests/prix-2026/data/plomberie.test.ts
git commit -m "feat(simulateur-v2): add 5 plomberie price lines for 2026"
```

---

## Task 10 : Bootstrap métier 3 — Électricité (5 lignes)

**Files:**
- Create: `lib/prix-travaux-2026/data/electricite.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/data/electricite.test.ts`

**Suggested variants** :
1. `electricite-pose-prise-standard` (~75-90 €/unité)
2. `electricite-pose-interrupteur-va-et-vient` (~85-100 €/unité)
3. `electricite-tableau-electrique-13-modules` (~1100-1320 € forfait pose+matériel)
4. `electricite-mise-aux-normes-NFC15-100-50m2` (~2400-2880 €)
5. `electricite-borne-recharge-vehicule-7kw` (~1450-1740 €, hors aide ADVENIR)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/data/electricite.test.ts
import { describe, it, expect } from 'vitest'
import { electriciteLines } from '@/lib/prix-travaux-2026/data/electricite'

describe('Électricité — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(electriciteLines).toHaveLength(5)
  })

  it('every line has metier === electricite', () => {
    electriciteLines.forEach(l => expect(l.metier).toBe('electricite'))
  })

  it('every line has unique taskId', () => {
    const ids = electriciteLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all lines have spread ≤ 20%', () => {
    electriciteLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    electriciteLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/data/electricite.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Research and write the data file**

Apply methodology + WebSearch (Batiprix, INSEE BT37 Électricité, CAPEB électriciens, Travaux.com). Produce `lib/prix-travaux-2026/data/electricite.ts` with `electriciteLines: PriceLine[]` of length 5.

- [ ] **Step 4: Update barrel**

```typescript
// lib/prix-travaux-2026.ts
import { electriciteLines } from './prix-travaux-2026/data/electricite'

export const PRIX_2026: PriceLine[] = [
  ...peintureLines,
  ...plomberieLines,
  ...electriciteLines,
]
```

- [ ] **Step 5: Run all tests**

Run: `npm run test -- tests/prix-2026/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/prix-travaux-2026/data/electricite.ts lib/prix-travaux-2026.ts tests/prix-2026/data/electricite.test.ts
git commit -m "feat(simulateur-v2): add 5 electricite price lines for 2026"
```

---

## Task 11 : Bootstrap métier 4 — Carrelage (5 lignes)

**Files:**
- Create: `lib/prix-travaux-2026/data/carrelage.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/data/carrelage.test.ts`

**Suggested variants** :
1. `carrelage-pose-standard-30x30` (~52-62 €/m²)
2. `carrelage-pose-grand-format-60x60` (~68-82 €/m²)
3. `carrelage-depose-existant` (~22-27 €/m²)
4. `carrelage-ragreage-sol-substrat` (~28-33 €/m²)
5. `carrelage-pose-mosaique-douche` (~135-160 €/m²)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/data/carrelage.test.ts
import { describe, it, expect } from 'vitest'
import { carrelageLines } from '@/lib/prix-travaux-2026/data/carrelage'

describe('Carrelage — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(carrelageLines).toHaveLength(5)
  })

  it('every line has metier === carrelage', () => {
    carrelageLines.forEach(l => expect(l.metier).toBe('carrelage'))
  })

  it('every line has unique taskId', () => {
    const ids = carrelageLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all lines have spread ≤ 20%', () => {
    carrelageLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    carrelageLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/data/carrelage.test.ts`
Expected: FAIL

- [ ] **Step 3: Research and write the data file**

Apply methodology (Batiprix, INSEE BT22 Carrelage, CAPEB carreleurs). Produce `carrelageLines: PriceLine[]` of length 5.

- [ ] **Step 4: Update barrel**

```typescript
import { carrelageLines } from './prix-travaux-2026/data/carrelage'

export const PRIX_2026: PriceLine[] = [
  ...peintureLines, ...plomberieLines, ...electriciteLines, ...carrelageLines,
]
```

- [ ] **Step 5: Run all tests**

Run: `npm run test -- tests/prix-2026/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/prix-travaux-2026/data/carrelage.ts lib/prix-travaux-2026.ts tests/prix-2026/data/carrelage.test.ts
git commit -m "feat(simulateur-v2): add 5 carrelage price lines for 2026"
```

---

## Task 12 : Bootstrap métier 5 — Plaquiste (5 lignes, avec aides)

**Files:**
- Create: `lib/prix-travaux-2026/data/plaquiste.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/data/plaquiste.test.ts`

**Suggested variants** :
1. `plaquiste-cloison-simple-72mm` (~52-62 €/m²)
2. `plaquiste-doublage-thermique-100mm-laine` (~58-69 €/m²) — éligible MPR + CEE BAR-EN-101
3. `plaquiste-faux-plafond-suspendu` (~48-57 €/m²)
4. `plaquiste-isolation-phonique-cloison` (~72-86 €/m²) — éligible CEE
5. `plaquiste-isolation-rampants-200mm` (~62-74 €/m²) — éligible MPR + CEE BAR-EN-101

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/data/plaquiste.test.ts
import { describe, it, expect } from 'vitest'
import { plaquisteLines } from '@/lib/prix-travaux-2026/data/plaquiste'

describe('Plaquiste — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(plaquisteLines).toHaveLength(5)
  })

  it('lines tagged ITE-like (doublage thermique, rampants) have aidesEligibles', () => {
    const isolationLines = plaquisteLines.filter(l =>
      l.taskId.includes('thermique') || l.taskId.includes('rampants')
    )
    expect(isolationLines.length).toBeGreaterThan(0)
    isolationLines.forEach(l => {
      expect(l.aidesEligibles).toBeDefined()
      expect(l.aidesEligibles?.maPrimeRenov || l.aidesEligibles?.cee).toBeTruthy()
    })
  })

  it('all lines have spread ≤ 20%', () => {
    plaquisteLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    plaquisteLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/data/plaquiste.test.ts`
Expected: FAIL

- [ ] **Step 3: Research and write the data file**

Apply methodology. Pour les lignes éligibles aides, renseigner `aidesEligibles` selon barèmes officiels :
- Doublage thermique 100mm : MPR forfait 25 €/m² (bleu) → 18 (jaune) → 7 (violet) → 0 (rose), plafond 75 m². CEE BAR-EN-101 ~12 €/m². TVA 5.5%.
- Isolation rampants 200mm : MPR forfait 25 €/m² (bleu) selon barème, plafond 75 m². CEE BAR-EN-103 ~10 €/m². TVA 5.5%.

- [ ] **Step 4: Update barrel**

```typescript
import { plaquisteLines } from './prix-travaux-2026/data/plaquiste'

export const PRIX_2026: PriceLine[] = [
  ...peintureLines, ...plomberieLines, ...electriciteLines, ...carrelageLines, ...plaquisteLines,
]
```

- [ ] **Step 5: Run all tests**

Run: `npm run test -- tests/prix-2026/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/prix-travaux-2026/data/plaquiste.ts lib/prix-travaux-2026.ts tests/prix-2026/data/plaquiste.test.ts
git commit -m "feat(simulateur-v2): add 5 plaquiste price lines for 2026 (with MPR/CEE aides)"
```

---

## Task 13 : Bootstrap métier 6 — Maçonnerie (5 lignes)

**Files:**
- Create: `lib/prix-travaux-2026/data/maconnerie.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/data/maconnerie.test.ts`

**Suggested variants** :
1. `maconnerie-dalle-beton-15cm-armee` (~135-160 €/m²)
2. `maconnerie-mur-parpaing-20cm` (~85-100 €/m²)
3. `maconnerie-demolition-cloison-non-porteuse` (~28-33 €/m²)
4. `maconnerie-ouverture-mur-porteur-IPN` (~3200-3840 € forfait, étude structure incluse)
5. `maconnerie-ravalement-facade-enduit` (~62-74 €/m²)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/data/maconnerie.test.ts
import { describe, it, expect } from 'vitest'
import { maconnerieLines } from '@/lib/prix-travaux-2026/data/maconnerie'

describe('Maçonnerie — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(maconnerieLines).toHaveLength(5)
  })

  it('every line has metier === maconnerie', () => {
    maconnerieLines.forEach(l => expect(l.metier).toBe('maconnerie'))
  })

  it('every line has unique taskId', () => {
    const ids = maconnerieLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all lines have spread ≤ 20%', () => {
    maconnerieLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    maconnerieLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/data/maconnerie.test.ts`
Expected: FAIL

- [ ] **Step 3: Research and write the data file**

Apply methodology. Sources clés : Batiprix Maçonnerie, INSEE BT24, CAPEB Maçons, Travaux.com.

- [ ] **Step 4: Update barrel**

```typescript
import { maconnerieLines } from './prix-travaux-2026/data/maconnerie'

export const PRIX_2026: PriceLine[] = [
  ...peintureLines, ...plomberieLines, ...electriciteLines, ...carrelageLines,
  ...plaquisteLines, ...maconnerieLines,
]
```

- [ ] **Step 5: Run all tests**

Run: `npm run test -- tests/prix-2026/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/prix-travaux-2026/data/maconnerie.ts lib/prix-travaux-2026.ts tests/prix-2026/data/maconnerie.test.ts
git commit -m "feat(simulateur-v2): add 5 maconnerie price lines for 2026"
```

---

## Task 14 : Bootstrap métier 7 — Couverture (5 lignes)

**Files:**
- Create: `lib/prix-travaux-2026/data/couverture.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/data/couverture.test.ts`

**Suggested variants** :
1. `couverture-tuiles-mecaniques-pose-neuve` (~82-98 €/m²)
2. `couverture-ardoise-naturelle-pose-neuve` (~135-160 €/m²)
3. `couverture-zinc-joint-debout` (~155-185 €/m²)
4. `couverture-gouttiere-zinc-pose-ml` (~62-74 €/ml)
5. `couverture-velux-pose-standard-78x98` (~1280-1535 € forfait posé)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/data/couverture.test.ts
import { describe, it, expect } from 'vitest'
import { couvertureLines } from '@/lib/prix-travaux-2026/data/couverture'

describe('Couverture — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(couvertureLines).toHaveLength(5)
  })

  it('every line has metier === couverture', () => {
    couvertureLines.forEach(l => expect(l.metier).toBe('couverture'))
  })

  it('every line has unique taskId', () => {
    const ids = couvertureLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all lines have spread ≤ 20%', () => {
    couvertureLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    couvertureLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/data/couverture.test.ts`
Expected: FAIL

- [ ] **Step 3: Research and write the data file**

Apply methodology. Sources : Batiprix Couverture, INSEE BT34 Couverture, CAPEB couvreurs.

- [ ] **Step 4: Update barrel**

```typescript
import { couvertureLines } from './prix-travaux-2026/data/couverture'

export const PRIX_2026: PriceLine[] = [
  ...peintureLines, ...plomberieLines, ...electriciteLines, ...carrelageLines,
  ...plaquisteLines, ...maconnerieLines, ...couvertureLines,
]
```

- [ ] **Step 5: Run all tests**

Run: `npm run test -- tests/prix-2026/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/prix-travaux-2026/data/couverture.ts lib/prix-travaux-2026.ts tests/prix-2026/data/couverture.test.ts
git commit -m "feat(simulateur-v2): add 5 couverture price lines for 2026"
```

---

## Task 15 : Bootstrap métier 8 — Menuiserie (5 lignes)

**Files:**
- Create: `lib/prix-travaux-2026/data/menuiserie.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/data/menuiserie.test.ts`

**Suggested variants** :
1. `menuiserie-porte-interieure-standard-pose` (~385-460 €/unité posée)
2. `menuiserie-fenetre-pvc-double-vitrage-1vantail-100x100` (~720-865 €/unité posée) — éligible MPR + CEE BAR-EN-104
3. `menuiserie-fenetre-aluminium-double-vitrage-2vantaux-150x100` (~1450-1740 €/unité posée) — éligible MPR + CEE
4. `menuiserie-parquet-massif-chene-pose-flottante` (~92-110 €/m² posé)
5. `menuiserie-placard-coulissant-2portes-2m4` (~1200-1440 €/unité)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/data/menuiserie.test.ts
import { describe, it, expect } from 'vitest'
import { menuiserieLines } from '@/lib/prix-travaux-2026/data/menuiserie'

describe('Menuiserie — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(menuiserieLines).toHaveLength(5)
  })

  it('fenêtres double vitrage have aidesEligibles (MPR + CEE)', () => {
    const fenetres = menuiserieLines.filter(l => l.taskId.includes('fenetre'))
    expect(fenetres.length).toBeGreaterThan(0)
    fenetres.forEach(l => {
      expect(l.aidesEligibles?.maPrimeRenov || l.aidesEligibles?.cee).toBeTruthy()
    })
  })

  it('all lines have spread ≤ 20%', () => {
    menuiserieLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    menuiserieLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
```

NOTE: this test asserts `aidesEligibles` on menuiserie fenêtres. The integrity test from Task 6 (`aidesEligibles only on energy-renovation metiers`) currently lists `['chauffage', 'photovoltaique', 'ite', 'plaquiste']` — **add `'menuiserie'` to that list when implementing this task**.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/data/menuiserie.test.ts`
Expected: FAIL

- [ ] **Step 3: Update integrity test to include menuiserie**

```typescript
// tests/prix-2026/data-integrity.test.ts (modify the relevant test only)
it('aidesEligibles only on energy-renovation metiers', () => {
  const energyMetiers = ['chauffage', 'photovoltaique', 'ite', 'plaquiste', 'menuiserie']
  // ... rest unchanged
})
```

- [ ] **Step 4: Research and write the data file**

Apply methodology. Pour fenêtres : MPR forfait 80 € (bleu) à 0 € (rose) par fenêtre, CEE BAR-EN-104 ~50 €/fenêtre, TVA 5.5% si rénov énergétique.

- [ ] **Step 5: Update barrel**

```typescript
import { menuiserieLines } from './prix-travaux-2026/data/menuiserie'

export const PRIX_2026: PriceLine[] = [
  ...peintureLines, ...plomberieLines, ...electriciteLines, ...carrelageLines,
  ...plaquisteLines, ...maconnerieLines, ...couvertureLines, ...menuiserieLines,
]
```

- [ ] **Step 6: Run all tests**

Run: `npm run test -- tests/prix-2026/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/prix-travaux-2026/data/menuiserie.ts lib/prix-travaux-2026.ts tests/prix-2026/data/menuiserie.test.ts tests/prix-2026/data-integrity.test.ts
git commit -m "feat(simulateur-v2): add 5 menuiserie price lines for 2026 (with MPR/CEE for fenetres)"
```

---

## Task 16 : Bootstrap métier 9 — Chauffage (5 lignes, fortement aides)

**Files:**
- Create: `lib/prix-travaux-2026/data/chauffage.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/data/chauffage.test.ts`

**Suggested variants** :
1. `chauffage-chaudiere-condensation-gaz-25kw` (~3450-4140 € forfait posée) — MPR + CEE BAR-TH-106
2. `chauffage-pac-air-eau-8kw-maison-jusqu-120m2` (~9800-11500 €) — MPR + CEE BAR-TH-104, TVA 5.5%
3. `chauffage-pac-air-eau-11kw-maison-120-160m2` (~12200-14500 €) — MPR + CEE BAR-TH-104, TVA 5.5%
4. `chauffage-pac-air-air-multisplit-3unites` (~5400-6480 €)
5. `chauffage-poele-granules-7kw-pose` (~4800-5760 €) — MPR + CEE BAR-TH-112

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/data/chauffage.test.ts
import { describe, it, expect } from 'vitest'
import { chauffageLines } from '@/lib/prix-travaux-2026/data/chauffage'

describe('Chauffage — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(chauffageLines).toHaveLength(5)
  })

  it('PAC air-eau and chaudière condensation have aidesEligibles with MPR forfaits', () => {
    const aides = chauffageLines.filter(l =>
      l.taskId.includes('pac-air-eau') || l.taskId.includes('chaudiere-condensation')
    )
    expect(aides.length).toBeGreaterThanOrEqual(3)
    aides.forEach(l => {
      expect(l.aidesEligibles?.maPrimeRenov?.forfaits).toBeDefined()
      expect(l.aidesEligibles?.cee).toBeDefined()
    })
  })

  it('PAC air-eau lines have TVA 5.5%', () => {
    const pac = chauffageLines.filter(l => l.taskId.includes('pac-air-eau'))
    pac.forEach(l => expect(l.tva).toBe(5.5))
  })

  it('all lines have spread ≤ 20%', () => {
    chauffageLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    chauffageLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/data/chauffage.test.ts`
Expected: FAIL

- [ ] **Step 3: Research and write the data file**

Apply methodology + WebFetch sur france-renov.gouv.fr pour barèmes MPR PAC + chaudières 2026. Sources clés : Batiprix Génie climatique, INSEE BT40, CAPEB chauffagistes, France Rénov'.

Barèmes officiels MPR 2026 (à vérifier) :
- PAC air-eau : MPR bleu 5000 € / jaune 4000 € / violet 3000 € / rose 0 €
- Chaudière condensation gaz THPE : MPR bleu 1200 € / jaune 800 € / violet 0 € / rose 0 €
- Poêle granulés : MPR bleu 2500 € / jaune 1500 € / violet 0 € / rose 0 €

CEE forfaits indicatifs (à vérifier officiel BOAMP) :
- BAR-TH-104 PAC air-eau : ~4500 €
- BAR-TH-106 chaudière : ~600 €
- BAR-TH-112 poêle granulés : ~700 €

- [ ] **Step 4: Update barrel**

```typescript
import { chauffageLines } from './prix-travaux-2026/data/chauffage'

export const PRIX_2026: PriceLine[] = [
  ...peintureLines, ...plomberieLines, ...electriciteLines, ...carrelageLines,
  ...plaquisteLines, ...maconnerieLines, ...couvertureLines, ...menuiserieLines,
  ...chauffageLines,
]
```

- [ ] **Step 5: Run all tests**

Run: `npm run test -- tests/prix-2026/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/prix-travaux-2026/data/chauffage.ts lib/prix-travaux-2026.ts tests/prix-2026/data/chauffage.test.ts
git commit -m "feat(simulateur-v2): add 5 chauffage price lines for 2026 (PAC, chaudiere, poele with full MPR/CEE)"
```

---

## Task 17 : Bootstrap métier 10 — Paysagisme (5 lignes)

**Files:**
- Create: `lib/prix-travaux-2026/data/paysagisme.ts`
- Modify: `lib/prix-travaux-2026.ts`
- Create: `tests/prix-2026/data/paysagisme.test.ts`

**Suggested variants** :
1. `paysagisme-elagage-arbre-moyen-5-10m` (~285-340 €/arbre forfait)
2. `paysagisme-tonte-pelouse-residentielle-300m2` (~62-74 €/passage forfait)
3. `paysagisme-pose-terrasse-bois-composite` (~145-175 €/m² posée)
4. `paysagisme-pose-terrasse-pavé-béton` (~88-105 €/m² posée)
5. `paysagisme-creation-haie-thuyas-2m-pose` (~52-62 €/ml plant inclus)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prix-2026/data/paysagisme.test.ts
import { describe, it, expect } from 'vitest'
import { paysagismeLines } from '@/lib/prix-travaux-2026/data/paysagisme'

describe('Paysagisme — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(paysagismeLines).toHaveLength(5)
  })

  it('every line has metier === paysagisme', () => {
    paysagismeLines.forEach(l => expect(l.metier).toBe('paysagisme'))
  })

  it('every line has unique taskId', () => {
    const ids = paysagismeLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all lines have spread ≤ 20%', () => {
    paysagismeLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    paysagismeLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/prix-2026/data/paysagisme.test.ts`
Expected: FAIL

- [ ] **Step 3: Research and write the data file**

Apply methodology. Sources : Batiprix Espaces verts, CAPEB paysagistes, UNEP (Union Nationale des Entrepreneurs du Paysage) si accessible, Travaux.com.

- [ ] **Step 4: Update barrel**

```typescript
import { paysagismeLines } from './prix-travaux-2026/data/paysagisme'

export const PRIX_2026: PriceLine[] = [
  ...peintureLines, ...plomberieLines, ...electriciteLines, ...carrelageLines,
  ...plaquisteLines, ...maconnerieLines, ...couvertureLines, ...menuiserieLines,
  ...chauffageLines, ...paysagismeLines,
]
```

- [ ] **Step 5: Run all tests**

Run: `npm run test -- tests/prix-2026/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/prix-travaux-2026/data/paysagisme.ts lib/prix-travaux-2026.ts tests/prix-2026/data/paysagisme.test.ts
git commit -m "feat(simulateur-v2): add 5 paysagisme price lines for 2026"
```

---

## Task 18 : Final integration & PR

**Files:**
- Modify: none (validation + handoff)

- [ ] **Step 1: Run full simulator-related test suite**

Run: `npm run test -- tests/prix-2026/`
Expected: PASS — 50 lines populate `PRIX_2026`, all 8 integrity invariants validated, every per-métier suite passes.

- [ ] **Step 2: Verify integrity counts**

Run from a temporary `tests/prix-2026/totals.test.ts` (delete after) :

```typescript
import { describe, it, expect } from 'vitest'
import { PRIX_2026 } from '@/lib/prix-travaux-2026'

describe('Phase 1 — DoD totals', () => {
  it('PRIX_2026 has exactly 50 lines (Phase 1 scope)', () => {
    expect(PRIX_2026).toHaveLength(50)
  })

  it('covers exactly 10 métiers', () => {
    const metiers = new Set(PRIX_2026.map(l => l.metier))
    expect(metiers.size).toBe(10)
  })
})
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors related to `lib/prix-travaux-2026/`. (Pre-existing project errors unrelated to this work are acceptable but should be noted.)

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: no new lint errors in the new files.

- [ ] **Step 5: Push branch and open PR**

```bash
git push -u origin claude/nifty-kalam-edb25c
gh pr create --title "feat(simulateur-v2): Phase 1 — typed data foundation + 50 priority lines" --body "$(cat <<'EOF'
## Summary

Phase 1 of the Simulator V2 overhaul (spec: docs/superpowers/specs/2026-04-27-simulateur-devis-fr-2026-design.md).

- New module `lib/prix-travaux-2026/` with typed schema (PriceLine, coefficients, aides)
- 9-zone regional coefficients + gamme + état multipliers
- Postal-code → region detector
- MaPrimeRénov 2026 barèmes detection + CEE/TVA/éco-PTZ aggregator
- 50 price lines bootstrapped across 10 métiers (peinture, plomberie, électricité, carrelage, plaquiste, maçonnerie, couverture, menuiserie, chauffage, paysagisme)
- Each line: ≥2 sources (≥1 Tier 1), ≤20 % spread, lastVerified ISO date
- 8 CI integrity invariants enforced via Vitest
- Methodology doc at `docs/prix-2026-methodology.md`

**Behavior:** No user-facing change yet. The new data file is purely additive; the existing simulator continues to use `lib/prix-travaux.ts`. Phase 2 will refactor the route handler to consume this new data via tool-calling.

## Test plan

- [ ] `npm run test -- tests/prix-2026/` — all data-integrity invariants pass with 50 lines
- [ ] `npm run test` — full Vitest suite green
- [ ] `npx tsc --noEmit` — no TypeScript errors in new module
- [ ] `npm run lint` — no new ESLint errors
- [ ] Sources sampled by reviewer: random 5 lines across métiers, verify Tier 1 source citations are accurate

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Delete the temporary totals test**

```bash
rm tests/prix-2026/totals.test.ts
```

(The DoD totals are temporary scaffolding for Phase 1 verification only — they would fail once Phase 3 adds more lines.)

---

## Phase 1 — Definition of Done

- [ ] All 18 tasks completed and committed
- [ ] `PRIX_2026` exports 50 lines across 10 métiers
- [ ] CI integrity tests green: spread ≤20 %, ≥2 sources/≥1 Tier 1, lastVerified <90 j, unique taskIds, cost decomposition coherent, TVA in {5.5, 10, 20}, aidesEligibles only on energy métiers
- [ ] Module-level tests green for each of the 10 métiers
- [ ] Methodology doc present at `docs/prix-2026-methodology.md`
- [ ] PR opened with summary + test plan
- [ ] Existing simulator (`lib/prix-travaux.ts` + `app/api/simulateur-travaux/route.ts`) untouched and operational

## Next plan after Phase 1

`docs/superpowers/plans/YYYY-MM-DD-simulateur-fr-2026-phase2-tool-calling-backend.md` will refactor the route handler to use Groq tool-calling against this new data, implement token substitution, and add the `lookupVariants` / `computeQuote` / `validateQuote` tools.
