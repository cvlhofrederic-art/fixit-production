/**
 * Tests Vitest — Moteur Estimation matériaux : cas d'erreur et comportements défensifs
 *
 * Couvre :
 *  - Dimensions manquantes (thickness, height, perimeter) → multiplier 0 + warning
 *  - Ouvertures invalides (≥ surface) → erreur bloquante
 *  - Bonus ChantierProfile (difficile, petit, apprenti, complexShapes, pistolet peinture)
 *  - extraWaste (pertes supplémentaires saisies manuellement)
 *  - Coats peinture par défaut (DTU 59.1 classe B)
 *  - openings > 40% → warning
 */

import { describe, it, expect } from 'vitest'
import {
  estimateProject,
  recipeRegistry,
} from '@/lib/estimation-materiaux'
import type { EstimationInput, ChantierProfile } from '@/lib/estimation-materiaux'

// ════════════════════════════════════════════════════════════
//  1. DIMENSIONS MANQUANTES — le moteur doit renvoyer 0 + warning
// ════════════════════════════════════════════════════════════

describe('Moteur — dimensions manquantes', () => {

  it('épaisseur absente sur dalle m² → ciment/sable/gravier = 0 + warning', () => {
    const input: EstimationInput = {
      items: [{
        recipeId: 'dalle-ba-armee-st25c',
        geometry: { length: 8, width: 5 }, // pas de thickness
        label: 'Dalle sans épaisseur',
      }],
    }
    const result = estimateProject(input, recipeRegistry)
    const ciment = result.items[0].materials.find(m => m.id === 'ciment-cem2-325r')
    expect(ciment).toBeDefined()
    expect(ciment!.quantityWithWaste).toBe(0)
    const warnings = result.items[0].warnings.join(' ')
    expect(warnings).toMatch(/[ÉE]PAISSEUR MANQUANTE/i)
  })

  it('ouvertures ≥ surface → erreur globale + item ignoré', () => {
    const input: EstimationInput = {
      items: [{
        recipeId: 'mur-parpaing-20',
        geometry: { length: 4, height: 2.5, openings: 15 }, // 10m² < 15m² openings
        label: 'Mur impossible',
      }],
    }
    const result = estimateProject(input, recipeRegistry)
    expect(result.items.length).toBe(0)
    expect(result.warnings.join(' ')).toMatch(/Ouvertures/i)
  })

  it('ouvertures > 40% de la surface → warning (non bloquant)', () => {
    const input: EstimationInput = {
      items: [{
        recipeId: 'mur-parpaing-20',
        geometry: { length: 10, height: 2.5, openings: 12 }, // 48% ouvertures
        label: 'Mur très ouvert',
      }],
    }
    const result = estimateProject(input, recipeRegistry)
    expect(result.items.length).toBe(1)
    expect(result.items[0].warnings.some(w => /%/.test(w))).toBe(true)
  })

  it('recipe inconnue → item ignoré + warning global', () => {
    const input: EstimationInput = {
      items: [{
        recipeId: 'recette-totalement-fake',
        geometry: { area: 10 },
      }],
    }
    const result = estimateProject(input, recipeRegistry)
    expect(result.items.length).toBe(0)
    expect(result.warnings.some(w => /introuvable/i.test(w))).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════
//  2. BONUS CHANTIER PROFILE — transparence des pertes
// ════════════════════════════════════════════════════════════

describe('Moteur — bonus ChantierProfile', () => {

  const baseInput = {
    items: [{
      recipeId: 'dalle-ba-armee-st25c',
      geometry: { length: 8, width: 5, thickness: 0.12 },
      label: 'Dalle témoin',
    }],
  }

  it('profil standard sans bonus → profileBonusPercent = 0', () => {
    const result = estimateProject(baseInput, recipeRegistry)
    const ciment = result.aggregated.find(m => m.id === 'ciment-cem2-325r' && m.phase === 'principal')
    expect(ciment!.wasteBreakdown.profileBonusPercent).toBe(0)
  })

  it('chantier difficile → +5% profile bonus', () => {
    const profile: ChantierProfile = {
      difficulty: 'difficile', size: 'moyen', workforceLevel: 'mixte',
      complexShapes: false, isPistoletPainting: false,
    }
    const result = estimateProject({ ...baseInput, chantierProfile: profile }, recipeRegistry)
    const ciment = result.aggregated.find(m => m.id === 'ciment-cem2-325r' && m.phase === 'principal')
    expect(ciment!.wasteBreakdown.profileBonusPercent).toBe(5)
    expect(ciment!.wasteBreakdown.profileBonusReason).toMatch(/difficile/i)
  })

  it('cumul max (difficile + petit + apprenti + complexShapes) → +18% bonus', () => {
    const profile: ChantierProfile = {
      difficulty: 'difficile', size: 'petit', workforceLevel: 'apprenti',
      complexShapes: true, isPistoletPainting: false,
    }
    const result = estimateProject({ ...baseInput, chantierProfile: profile }, recipeRegistry)
    const ciment = result.aggregated.find(m => m.id === 'ciment-cem2-325r' && m.phase === 'principal')
    expect(ciment!.wasteBreakdown.profileBonusPercent).toBe(18)
  })

  it('pistolet peinture ne s\'applique QU\'à la catégorie peinture', () => {
    const input: EstimationInput = {
      items: [{
        recipeId: 'peinture-murs-neuf-acryl',
        geometry: { length: 5, height: 2.5, openings: 0 },
      }],
      chantierProfile: {
        difficulty: 'standard', size: 'moyen', workforceLevel: 'mixte',
        complexShapes: false, isPistoletPainting: true,
      },
    }
    const result = estimateProject(input, recipeRegistry)
    const peintureMat = result.aggregated.find(m => m.category === 'peinture')
    expect(peintureMat).toBeDefined()
    // Peinture : +10% pistolet seul (pas d'autres bonus activés)
    expect(peintureMat!.wasteBreakdown.profileBonusPercent).toBe(10)
  })
})

// ════════════════════════════════════════════════════════════
//  3. EXTRA WASTE — pertes supplémentaires saisies manuellement
// ════════════════════════════════════════════════════════════

describe('Moteur — extraWaste (pertes manuelles)', () => {

  it('extraWaste = 0.10 → ajoute 10% au wasteFactor de base', () => {
    const input: EstimationInput = {
      items: [{
        recipeId: 'dalle-ba-armee-st25c',
        geometry: { length: 8, width: 5, thickness: 0.12 },
        extraWaste: 0.10,
      }],
    }
    const result = estimateProject(input, recipeRegistry)
    const ciment = result.aggregated.find(m => m.id === 'ciment-cem2-325r' && m.phase === 'principal')
    // Ciment base 1.03 × extraWaste 1.10 = 1.133 → ~+13.3%
    expect(ciment!.wasteBreakdown.totalPercent).toBeGreaterThan(12)
    expect(ciment!.wasteBreakdown.totalPercent).toBeLessThan(15)
  })

  it('extraWaste = 0 → identique à extraWaste omis (pas de régression)', () => {
    const geometry = { length: 8, width: 5, thickness: 0.12 }
    const r1 = estimateProject(
      { items: [{ recipeId: 'dalle-ba-armee-st25c', geometry }] },
      recipeRegistry
    )
    const r2 = estimateProject(
      { items: [{ recipeId: 'dalle-ba-armee-st25c', geometry, extraWaste: 0 }] },
      recipeRegistry
    )
    const c1 = r1.aggregated.find(m => m.id === 'ciment-cem2-325r')!.quantityWithWaste
    const c2 = r2.aggregated.find(m => m.id === 'ciment-cem2-325r')!.quantityWithWaste
    expect(c1).toBe(c2)
  })
})

// ════════════════════════════════════════════════════════════
//  4. COATS — multiplier peinture (recettes PT seules l'utilisent)
// ════════════════════════════════════════════════════════════

describe('Moteur — coats (geometryMultiplier)', () => {

  // ⚠️ OBSERVATION AUDIT : côté FR, AUCUNE recette peinture n'utilise
  // `geometryMultiplier: 'coats'`. Les recettes FR intègrent le nombre de
  // couches dans `quantityPerBase` (ex: 0,30 L/m² = 2 couches acryl). Seules
  // les recettes PT (pintura.ts) activent le multiplicateur `coats`.
  // À implémenter côté FR dans un correctif pré-déploiement (voir CHUNK FINAL).

  it('coats absent sur recette PT utilisant multiplier → défaut 2 (DTU 59.1)', () => {
    const input: EstimationInput = {
      items: [{
        recipeId: 'pintura-interior-paredes-pt',
        geometry: { area: 20 }, // pas de coats
      }],
    }
    const result = estimateProject(input, recipeRegistry)
    const tinta = result.items[0].materials.find(m => m.id === 'tinta-aquosa-interior-pt')
    expect(tinta).toBeDefined()
    // 20 m² × 0.18 L/m² × 2 couches × 1.08 pertes = 7.776 L
    expect(tinta!.quantityWithWaste).toBeGreaterThan(7)
    expect(tinta!.quantityWithWaste).toBeLessThan(9)
    expect(result.items[0].warnings.join(' ')).toMatch(/DTU 59\.1|couches par d[ée]faut/i)
  })

  it('coats = 1 (monocouche) → multiplier 1, pas de warning défaut', () => {
    const input: EstimationInput = {
      items: [{
        recipeId: 'pintura-interior-paredes-pt',
        geometry: { area: 20, coats: 1 },
      }],
    }
    const result = estimateProject(input, recipeRegistry)
    const tinta = result.items[0].materials.find(m => m.id === 'tinta-aquosa-interior-pt')
    // 20 m² × 0.18 × 1 × 1.08 = 3.888 L (moitié du défaut 2 couches)
    expect(tinta!.quantityWithWaste).toBeGreaterThan(3.5)
    expect(tinta!.quantityWithWaste).toBeLessThan(4.3)
  })
})

// ════════════════════════════════════════════════════════════
//  5. PÉRIMÈTRE — anti-double-multiplication (bug v2.0 corrigé)
// ════════════════════════════════════════════════════════════

describe('Moteur — périmètre (effectiveBase=1)', () => {

  it('matériau linéique sur recette m² ne double-multiplie PAS aire × périmètre', () => {
    const input: EstimationInput = {
      items: [{
        recipeId: 'dalle-ba-armee-st25c',
        geometry: { length: 10, width: 5, thickness: 0.12 },
      }],
    }
    const result = estimateProject(input, recipeRegistry)
    // Bande résiliente (phase préparation, matériau périphérique) doit
    // correspondre au périmètre 2(10+5)=30 ml × wasteFactor, PAS 30 × 50 m²
    const bande = result.aggregated.find(m =>
      /bande|r[ée]siliente|joint/i.test(m.name) && m.unit === 'ml'
    )
    if (bande) {
      expect(bande.quantityWithWaste).toBeLessThan(50) // pas ×50 = 1500+
      expect(bande.quantityWithWaste).toBeGreaterThan(25)
    }
  })
})
