import { describe, expect, it } from 'vitest'
import {
  classeDpeMoyenne,
  enPremierPourCopro,
  prestataireDeLaCopro,
} from '@/lib/administrateur-judiciaire/domain/patrimoine-copropriete'

/**
 * Écrans du patrimoine et de la conformité affichés selon la copropriété choisie dans le sélecteur du haut de page
 * (demande de Hugo du 29/10/2026) : règles communes, sans React.
 */

const MERIDIEN = { id: 'C1', nom: 'Résidence Le Méridien' }
const TILLEULS = { id: 'C3', nom: 'Copropriété Les Tilleuls' }

describe('prestataireDeLaCopro', () => {
  it('vrai si un contrat lie le prestataire à la copropriété', () => {
    const contrats = [{ prestataireId: 'P1', coproprieteId: 'C1' }]
    expect(prestataireDeLaCopro({ id: 'P1' }, MERIDIEN, contrats)).toBe(true)
    expect(prestataireDeLaCopro({ id: 'P1' }, TILLEULS, contrats)).toBe(false)
    expect(prestataireDeLaCopro({ id: 'P2' }, MERIDIEN, contrats)).toBe(false)
  })

  it('vrai si sa fiche déclare qu’il intervient pour la copropriété (nom exact)', () => {
    const prestataire = { id: 'F1', fiche: { intervientPour: ['Résidence Le Méridien', 'Le Clos des Vignes'] } }
    expect(prestataireDeLaCopro(prestataire, MERIDIEN, [])).toBe(true)
    expect(prestataireDeLaCopro(prestataire, TILLEULS, [])).toBe(false)
  })

  it('faux sans contrat ni fiche', () => {
    expect(prestataireDeLaCopro({ id: 'P9', fiche: undefined }, MERIDIEN, [])).toBe(false)
    expect(prestataireDeLaCopro({ id: 'P9', fiche: null }, MERIDIEN, [])).toBe(false)
  })
})

describe('enPremierPourCopro', () => {
  const lignes = ['a', 'B', 'c', 'D', 'e']
  const majuscule = (ligne: string) => ligne === ligne.toUpperCase()

  it('les lignes retenues d’abord, puis les autres, chaque groupe dans son ordre', () => {
    expect(enPremierPourCopro(lignes, majuscule, false)).toEqual(['B', 'D', 'a', 'c', 'e'])
  })

  it('seulement les lignes retenues sur demande', () => {
    expect(enPremierPourCopro(lignes, majuscule, true)).toEqual(['B', 'D'])
  })

  it('renvoie un nouveau tableau, sans modifier l’original', () => {
    const resultat = enPremierPourCopro(lignes, () => false, false)
    expect(resultat).toEqual(lignes)
    expect(resultat).not.toBe(lignes)
  })
})

describe('classeDpeMoyenne', () => {
  it('moyenne des classes, arrondie vers la classe la plus performante à égalité', () => {
    expect(classeDpeMoyenne(['D', 'E', 'F', 'C'])).toBe('D')
    expect(classeDpeMoyenne(['A', 'C'])).toBe('B')
    expect(classeDpeMoyenne(['E', 'F', 'F'])).toBe('F')
  })

  it('la classe elle-même pour une seule copropriété', () => {
    expect(classeDpeMoyenne(['F'])).toBe('F')
  })

  it('ignore les classes inconnues (casse indifférente) ; null sans classe connue', () => {
    expect(classeDpeMoyenne(['d', '—', 'Z'])).toBe('D')
    expect(classeDpeMoyenne([])).toBeNull()
    expect(classeDpeMoyenne(['—'])).toBeNull()
  })
})
