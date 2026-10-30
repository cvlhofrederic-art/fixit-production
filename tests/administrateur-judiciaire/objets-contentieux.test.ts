import { describe, expect, it } from 'vitest'
import {
  OBJETS_CONTENTIEUX_OBSERVES,
  reconnaitreObjetContentieux,
} from '@/lib/administrateur-judiciaire/domain/objets-contentieux'

/**
 * Point 57 du bilan Gestéam — Objet d'un contentieux. La liste Gestéam n'a jamais été ouverte (tranches 28 et 42) :
 * seules deux valeurs ont été lues sur des fiches (tranche 42 ; tranche 43, § 5). Liste PARTIELLE, tenue hors du
 * référentiel du point 29 ; l'objet saisi reste un texte libre, reconnu seulement pour un futur import Gestéam.
 */

describe('objets de contentieux observés dans Gestéam', () => {
  it('reprend les deux libellés lus, à l’identique', () => {
    expect(OBJETS_CONTENTIEUX_OBSERVES).toEqual(['Précontentieux (suivi, relance etc..)', 'Procédure en recouvrement de charges'])
  })

  it('reconnaît un libellé malgré la casse, les accents et les espaces', () => {
    expect(reconnaitreObjetContentieux('  précontentieux (suivi,  relance etc..) ')).toBe('Précontentieux (suivi, relance etc..)')
    expect(reconnaitreObjetContentieux('PROCEDURE EN RECOUVREMENT DE CHARGES')).toBe('Procédure en recouvrement de charges')
  })

  it('un autre texte reste libre : non reconnu, rien n’est imposé', () => {
    expect(reconnaitreObjetContentieux('Charges impayées 2025')).toBeNull()
    expect(reconnaitreObjetContentieux('Précontentieux')).toBeNull()
    expect(reconnaitreObjetContentieux('')).toBeNull()
  })
})
