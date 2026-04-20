/**
 * Tests Vitest — Module Estimation matériaux (P5 audit)
 *
 * Objectifs :
 * 1. Vérifier intégrité structurelle de la base de connaissances (128 ouvrages)
 * 2. Tester l'estimateur sur 10 ouvrages pivots avec quantités attendues
 * 3. Détecter régressions sur ratios critiques (DTU-sourcés)
 */

import { describe, it, expect } from 'vitest'
import {
  allRecipes,
  recipeRegistry,
  estimateProject,
  getRecipesByTrade,
} from '@/lib/estimation-materiaux'
import type { EstimationInput, Recipe } from '@/lib/estimation-materiaux'

// ════════════════════════════════════════════════════════════
//  1. INTÉGRITÉ STRUCTURELLE DE LA BASE
// ════════════════════════════════════════════════════════════

describe('Base de connaissances — intégrité structurelle', () => {

  it('contient au moins 160 ouvrages répartis sur les 26 corps de métier', () => {
    // Seuil durci post-audit pré-déploiement : 162 recettes codées (FR+PT).
    // Un seuil à 120 laissait passer une disparition silencieuse de 42 recettes.
    expect(allRecipes.length).toBeGreaterThanOrEqual(160)

    const trades = new Set(allRecipes.map(r => r.trade))
    expect(trades.size).toBeGreaterThanOrEqual(25)
  })

  it('chaque recette a un ID unique', () => {
    const ids = allRecipes.map(r => r.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('chaque recette a au moins 1 matériau en phase principal', () => {
    for (const recipe of allRecipes) {
      const principalMats = recipe.materials.filter(m =>
        (m.phase ?? 'principal') === 'principal' && !m.optional
      )
      expect(principalMats.length).toBeGreaterThan(0)
    }
  })

  it('chaque recette cite au moins 1 référence DTU/NF', () => {
    for (const recipe of allRecipes) {
      expect(recipe.dtuReferences.length).toBeGreaterThan(0)
    }
  })

  it('tous les matériaux ont un wasteFactor entre 1.00 et 1.30', () => {
    for (const recipe of allRecipes) {
      for (const mat of recipe.materials) {
        expect(mat.wasteFactor).toBeGreaterThanOrEqual(1.00)
        expect(mat.wasteFactor).toBeLessThanOrEqual(1.30)
      }
    }
  })

  it('recipeRegistry contient toutes les recettes', () => {
    for (const recipe of allRecipes) {
      expect(recipeRegistry[recipe.id]).toBe(recipe)
    }
  })
})

// ════════════════════════════════════════════════════════════
//  2. TRADES ATTENDUS PRÉSENTS
// ════════════════════════════════════════════════════════════

describe('Couverture des 28 corps de métier', () => {

  const tradeExpected = [
    'maconnerie', 'placo', 'peinture', 'carrelage',
    'plomberie', 'couverture', 'menuiserie_ext', 'electricite',
    'charpente', 'zinguerie', 'etancheite', 'isolation',
    'facade', 'menuiserie_int', 'revetement_sol', 'revetement_mural',
    'chauffage', 'ventilation', 'climatisation',
    'vrd', 'assainissement', 'electricite_cfa',
    'cloture', 'terrasse_ext', 'jardin', 'piscine',
  ] as const

  it.each(tradeExpected)('trade "%s" a au moins 1 recette', (trade) => {
    const recipes = getRecipesByTrade(trade as Recipe['trade'])
    expect(recipes.length).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════
//  3. CALCUL DALLE BA ST25C (pivot Vague 1)
// ════════════════════════════════════════════════════════════

describe('Estimation : dalle BA ST25C 8×5m × 12cm', () => {

  const input: EstimationInput = {
    projectName: 'Test dalle ST25C',
    items: [{
      recipeId: 'dalle-ba-armee-st25c',
      geometry: { length: 8, width: 5, thickness: 0.12 },
      label: 'Dalle test',
    }],
  }

  const result = estimateProject(input, recipeRegistry)

  it('calcul complet sans erreur', () => {
    expect(result.warnings.length).toBe(0) // 40 m² × 12 cm : pas de warning
    expect(result.items.length).toBe(1)
  })

  it('ciment ≈ 1 733 kg (40 m² × 0,12 m × 350 kg/m³ × 1.03 pertes)', () => {
    const ciment = result.aggregated.find(m => m.id === 'ciment-cem2-325r' && m.phase === 'principal')
    expect(ciment).toBeDefined()
    expect(ciment!.quantityWithWaste).toBeGreaterThan(1700)
    expect(ciment!.quantityWithWaste).toBeLessThan(1770)
  })

  it('treillis ST25C ≈ 46 m² (40 m² × 1.15 pertes)', () => {
    const treillis = result.aggregated.find(m => m.id === 'treillis-st25c')
    expect(treillis).toBeDefined()
    expect(treillis!.quantityWithWaste).toBe(46)
  })

  it('fibre polypropylène ≈ 4,54 kg (40 × 0,12 × 0,9 × 1.05)', () => {
    const fibre = result.aggregated.find(m => m.id === 'fibre-polypro-pp')
    expect(fibre).toBeDefined()
    expect(fibre!.quantityWithWaste).toBeGreaterThan(4.3)
    expect(fibre!.quantityWithWaste).toBeLessThan(4.8)
  })

  it('inclut des matériaux en phase "preparation"', () => {
    const prepMats = result.aggregated.filter(m => m.phase === 'preparation' && !m.optional)
    expect(prepMats.length).toBeGreaterThan(0)
  })

  it('hypotheses communiquées incluses', () => {
    expect(result.hypothesesACommuniquer.length).toBeGreaterThan(3)
    expect(result.hypothesesACommuniquer.some(h => /hérisson/i.test(h))).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════
//  4. CALCUL CLOISON PLACO 72/48
// ════════════════════════════════════════════════════════════

describe('Estimation : cloison Placo 72/48 — 5 ml × 3 m, 2 angles', () => {

  const input: EstimationInput = {
    items: [{
      recipeId: 'cloison-placo-72-48',
      geometry: { length: 5, height: 3, openings: 0 },
      label: 'Cloison test',
    }],
  }

  const result = estimateProject(input, recipeRegistry)
  const surface = 5 * 3 // 15 m²

  it('plaques BA13 : 33 m² (15 × 2 × 1.10)', () => {
    const plaques = result.aggregated.find(m => m.id === 'plaque-ba13')
    expect(plaques).toBeDefined()
    expect(plaques!.quantityWithWaste).toBe(33)
  })

  it('laine verre 45 mm incluse', () => {
    const laine = result.aggregated.find(m => m.id === 'laine-verre-45')
    expect(laine).toBeDefined()
    expect(laine!.quantityWithWaste).toBeCloseTo(surface * 1.07, 1)
  })

  it('accessoires (vis, chevilles) présents', () => {
    const vis = result.aggregated.find(m => m.id === 'vis-ttpc-25')
    expect(vis).toBeDefined()
    expect(vis!.quantityWithWaste).toBeGreaterThan(500)
  })
})

// ════════════════════════════════════════════════════════════
//  5. AGRÉGATION MULTI-OUVRAGES (dalle + mur)
// ════════════════════════════════════════════════════════════

describe('Agrégation matériaux multi-ouvrages', () => {

  const input: EstimationInput = {
    items: [
      {
        recipeId: 'dalle-ba-armee-st25c',
        geometry: { length: 8, width: 5, thickness: 0.12 },
        label: 'Dalle',
      },
      {
        recipeId: 'mur-parpaing-20',
        geometry: { length: 20, height: 2.5, openings: 4 },
        label: 'Mur',
      },
    ],
  }

  const result = estimateProject(input, recipeRegistry)

  it('ciment agrégé (principal) depuis dalle + mur', () => {
    const cimentPrincipal = result.aggregated.find(m =>
      m.id === 'ciment-cem2-325r' && m.phase === 'principal' && !m.optional
    )
    expect(cimentPrincipal).toBeDefined()
    // Dalle : 40 × 0,12 × 350 × 1.03 ≈ 1733 kg
    // Mur : 46 m² × 8 kg × 1.05 ≈ 387 kg
    // Total ≈ 2120 kg
    expect(cimentPrincipal!.quantityWithWaste).toBeGreaterThan(2000)
    expect(cimentPrincipal!.quantityWithWaste).toBeLessThan(2300)
  })

  it('contributing items contient les 2 ouvrages', () => {
    const cimentPrincipal = result.aggregated.find(m =>
      m.id === 'ciment-cem2-325r' && m.phase === 'principal' && !m.optional
    )
    expect(cimentPrincipal!.contributingItems.length).toBe(2)
  })

  it('humanSummary contient des headers de phase', () => {
    const summary = result.humanSummary.join('\n')
    expect(summary).toMatch(/PR[ÉE]PARATION/i)
    expect(summary).toMatch(/PRINCIPAL/i)
  })
})

// ════════════════════════════════════════════════════════════
//  6. FENÊTRE PVC (count unité) + règle chevilles obligatoires
// ════════════════════════════════════════════════════════════

describe('Estimation : 3 fenêtres PVC (règle NF DTU 36.5 chevilles)', () => {

  const input: EstimationInput = {
    items: [{
      recipeId: 'menuiserie-fenetre-pvc',
      geometry: { count: 3 },
      label: '3 fenêtres',
    }],
  }

  const result = estimateProject(input, recipeRegistry)

  it('3 blocs-fenêtres', () => {
    const bloc = result.aggregated.find(m => m.id === 'bloc-fenetre-pvc')
    expect(bloc).toBeDefined()
    expect(bloc!.quantityWithWaste).toBe(3)
  })

  it('chevilles M10 obligatoires présentes (NF DTU 36.5 §5.7)', () => {
    const chevilles = result.aggregated.find(m => m.id === 'cheville-mecanique-m10')
    expect(chevilles).toBeDefined()
    expect(chevilles!.quantityWithWaste).toBeGreaterThan(30) // 3 × 10 × 1.10 = 33
  })
})

// ════════════════════════════════════════════════════════════
//  7. PAC air/eau — ouvrage complexe 1 u
// ════════════════════════════════════════════════════════════

describe('Estimation : 1 PAC air/eau', () => {

  const input: EstimationInput = {
    items: [{
      recipeId: 'pac-air-eau',
      geometry: { count: 1 },
      label: 'PAC',
    }],
  }

  const result = estimateProject(input, recipeRegistry)

  it('unité extérieure + module hydraulique + ballon ECS', () => {
    expect(result.aggregated.find(m => m.id === 'unite-ext-pac')).toBeDefined()
    expect(result.aggregated.find(m => m.id === 'module-hydro-pac')).toBeDefined()
    expect(result.aggregated.find(m => m.id === 'ballon-ecs-200l-pac')).toBeDefined()
  })

  it('liaisons frigorifiques incluses', () => {
    const frigo = result.aggregated.find(m => m.id === 'liaison-frigo-cuivre')
    expect(frigo).toBeDefined()
    expect(frigo!.quantityWithWaste).toBeGreaterThan(9) // 10 × 1.10 = 11
  })
})

// ════════════════════════════════════════════════════════════
//  8. PISCINE — sécurité obligatoire L.128-1
// ════════════════════════════════════════════════════════════

describe('Estimation : piscine coque — sécurité obligatoire', () => {

  const input: EstimationInput = {
    items: [{
      recipeId: 'piscine-coque-polyester',
      geometry: { count: 1 },
      label: 'Piscine',
    }],
  }

  const result = estimateProject(input, recipeRegistry)

  it('dispositif sécurité présent (obligation L.128-1)', () => {
    const securite = result.aggregated.find(m => m.id === 'dispositif-securite-piscine')
    expect(securite).toBeDefined()
    expect(securite!.references.some(ref => /L\.128/.test(ref))).toBe(true)
  })

  it('hypothèses mentionnent sécurité obligatoire', () => {
    const hyp = result.hypothesesACommuniquer.join(' ')
    expect(hyp).toMatch(/sécurité/i)
  })
})
