// tests/lib/equipe-categorie-professionnelle.test.ts
//
// Catégorie professionnelle d'un membre d'équipe BTP (titre libre affiché, sans effet sur les droits) : forme
// enregistrée, « aucune catégorie », valeurs refusées. Voir lib/equipe/categorie-professionnelle.ts.

import { describe, expect, it } from 'vitest'
import { CATEGORIES_PROPOSEES, LONGUEUR_MAX_CATEGORIE, normaliserCategorie } from '@/lib/equipe/categorie-professionnelle'

describe('normaliserCategorie', () => {
  it.each([
    ['Encarregado geral', 'Encarregado geral'],
    ['  Chefe   de\tequipa \n', 'Chefe de equipa'],
    ['Oficial de 1.ª', 'Oficial de 1.ª'],
  ])('« %s » est enregistrée « %s »', (recue, enregistree) => {
    expect(normaliserCategorie(recue)).toBe(enregistree)
  })

  it.each([[null], [''], ['   '], ['\n\t']])('%j : aucune catégorie (null)', (recue) => {
    expect(normaliserCategorie(recue)).toBeNull()
  })

  it('80 caractères passent, 81 sont refusés (contrainte CHECK de la colonne)', () => {
    expect(LONGUEUR_MAX_CATEGORIE).toBe(80)
    expect(normaliserCategorie('a'.repeat(80))).toBe('a'.repeat(80))
    expect(normaliserCategorie('a'.repeat(81))).toBeUndefined()
    // Les blancs en trop ne comptent pas.
    expect(normaliserCategorie(` ${'a'.repeat(80)} `)).toBe('a'.repeat(80))
  })

  it.each([
    ['nombre', 3],
    ['booléen', true],
    ['objet', { titre: 'Servente' }],
    ['undefined', undefined],
    ['caractère de contrôle', `Servente${String.fromCodePoint(0)}`],
    ['DEL', `Servente${String.fromCodePoint(0x7f)}`],
    ['échappement', `${String.fromCodePoint(0x1b)}[31mServente`],
  ])('%s : refusé (undefined)', (_cas, recue) => {
    expect(normaliserCategorie(recue)).toBeUndefined()
  })

  it('chaque catégorie proposée est déjà sous sa forme enregistrée', () => {
    for (const categorie of [...CATEGORIES_PROPOSEES.pt, ...CATEGORIES_PROPOSEES.fr]) {
      expect(normaliserCategorie(categorie)).toBe(categorie)
    }
    expect(CATEGORIES_PROPOSEES.pt).toEqual(expect.arrayContaining(['Encarregado geral', 'Chefe de equipa', 'Servente', 'Oficial']))
  })
})
