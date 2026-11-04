import { describe, expect, it } from 'vitest'
import {
  OBJETS_CONTENTIEUX_OBSERVES,
  reconnaitreObjetContentieux,
} from '@/lib/administrateur-judiciaire/domain/objets-contentieux'
import { enTeteDuModule } from './en-tete-module'

/**
 * Point 57 du bilan Gestéam — Objet d'un contentieux. Décision J34 de Hugo (03/11/2026), sur le relevé fait le même jour
 * dans Gestéam 5.4.23 (Contentieux → Recherche de contentieux) : le critère « Objet » est un champ de saisie libre, sans
 * liste de valeurs. L'objet reste un texte libre dans VitFix ; seuls les deux libellés lus sur des fiches (tranche 42 ;
 * tranche 43, § 5) sont reconnus, pour un futur import Gestéam.
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

describe('objets de contentieux — en-tête : décision J34', () => {
  const { texte: entete } = enTeteDuModule('objets-contentieux')

  it('rubrique « Décisions de Hugo du 03/11/2026 » : J34, champ de saisie libre relevé dans Gestéam 5.4.23', () => {
    const decisions = entete.slice(entete.indexOf('Décisions de Hugo du 03/11/2026'))
    expect(decisions).toMatch(/J34/)
    expect(decisions).toMatch(/Gestéam 5\.4\.23/)
    expect(decisions).toMatch(/Contentieux → Recherche de contentieux/)
    expect(decisions).toMatch(/champ de saisie libre/)
    expect(decisions).toMatch(/l'objet reste un texte libre/)
  })

  it('la liste complète n’est plus une question : aucun 🔴', () => {
    expect(entete).not.toMatch(/🔴/)
    expect(entete).not.toMatch(/peut-on relever la liste complète/)
  })
})
