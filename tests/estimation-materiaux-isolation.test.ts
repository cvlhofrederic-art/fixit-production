/**
 * Tests d'ISOLATION PAYS — Estimation matériaux
 *
 * Garantit que :
 * 1. Aucun fichier de `recipes/fr/` n'importe depuis `recipes/pt/` (et réciproquement)
 * 2. Toute recette de `recipes/fr/` déclare `country: 'FR'` (ou omet, default FR)
 *    Toute recette de `recipes/pt/` déclare `country: 'PT'`
 * 3. Le guard `assertSameCountry` lève sur mismatch
 * 4. `getRecipesByCountry` sépare strictement les deux ensembles
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  allRecipes,
  getRecipesByCountry,
  assertSameCountry,
  CountryMismatchError,
} from '@/lib/estimation-materiaux'

const recipesRoot = join(process.cwd(), 'lib/estimation-materiaux/recipes')
const frDir = join(recipesRoot, 'fr')
const ptDir = join(recipesRoot, 'pt')

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => f.endsWith('.ts')).map(f => join(dir, f))
}

// ════════════════════════════════════════════════════════════
//  1. ISOLATION FILESYSTEM — pas d'imports croisés
// ════════════════════════════════════════════════════════════

describe('Isolation filesystem FR/PT', () => {

  it('aucun fichier recipes/fr/*.ts n\'importe depuis recipes/pt/', () => {
    const frFiles = listTsFiles(frDir)
    expect(frFiles.length).toBeGreaterThan(0)
    for (const file of frFiles) {
      const content = readFileSync(file, 'utf-8')
      // Import depuis '../pt/...' ou '../../pt/...' interdit
      expect(content).not.toMatch(/from\s+['"][.\/]*\.\.\/pt\//)
      expect(content).not.toMatch(/from\s+['"][.\/]*recipes\/pt\//)
    }
  })

  it('aucun fichier recipes/pt/*.ts n\'importe depuis recipes/fr/', () => {
    const ptFiles = listTsFiles(ptDir)
    for (const file of ptFiles) {
      const content = readFileSync(file, 'utf-8')
      expect(content).not.toMatch(/from\s+['"][.\/]*\.\.\/fr\//)
      expect(content).not.toMatch(/from\s+['"][.\/]*recipes\/fr\//)
    }
  })

  it('recipes/fr/ contient bien les 28 fichiers de corps de métier', () => {
    const frFiles = listTsFiles(frDir)
    expect(frFiles.length).toBe(28)
  })
})

// ════════════════════════════════════════════════════════════
//  2. COHÉRENCE DU TAGGING country
// ════════════════════════════════════════════════════════════

describe('Tagging country strict sur toutes les recettes', () => {

  it('toutes les recettes ont un country défini après normalisation', () => {
    for (const r of allRecipes) {
      expect(r.country).toBeDefined()
      expect(['FR', 'PT']).toContain(r.country)
    }
  })

  it('getRecipesByCountry(FR) + getRecipesByCountry(PT) = allRecipes', () => {
    const fr = getRecipesByCountry('FR').length
    const pt = getRecipesByCountry('PT').length
    expect(fr + pt).toBe(allRecipes.length)
  })

  it('aucune recette FR dans le résultat PT', () => {
    const ptRecipes = getRecipesByCountry('PT')
    for (const r of ptRecipes) expect(r.country).toBe('PT')
  })

  it('aucune recette PT dans le résultat FR', () => {
    const frRecipes = getRecipesByCountry('FR')
    for (const r of frRecipes) expect(r.country).toBe('FR')
  })
})

// ════════════════════════════════════════════════════════════
//  3. GUARD RUNTIME — rejet du mélange
// ════════════════════════════════════════════════════════════

describe('Guard runtime assertSameCountry', () => {

  it('lève CountryMismatchError sur mélange FR dans projet PT', () => {
    const frRecipes = getRecipesByCountry('FR').slice(0, 2)
    expect(frRecipes.length).toBeGreaterThan(0)
    expect(() => assertSameCountry('PT', frRecipes)).toThrow(CountryMismatchError)
  })

  it('laisse passer un projet FR avec recettes FR uniquement', () => {
    const frRecipes = getRecipesByCountry('FR').slice(0, 3)
    expect(() => assertSameCountry('FR', frRecipes)).not.toThrow()
  })
})
