// tests/lib/aj-signalement-ecritures-gestionnaire.test.ts
//
// Règles pures des écritures d'un gestionnaire connecté (PR 2, lot 2 ; SPEC § 2.5, RG-06 bis, RG-22, Q4) :
//   - refusAdressesAjouteesQr : une adresse AJOUTÉE est dans un domaine de SON cabinet (liste vide : aucun ajout) et n'est
//     jamais l'adresse d'une fiche, la sienne comprise (même message pour les deux : rien ne distingue un collègue) ;
//   - saisiesEcritesGestionnaireQr : liste écrite = adresses envoyées ∪ adresses MASQUÉES existantes (celles d'une autre
//     fiche, qu'il ne voit pas et ne peut pas renvoyer), dans l'ordre existant, les ajouts à la fin ;
//   - doublonVuGestionnaireQr : la copropriété en doublon n'est nommée que si elle est dans sa portée.
// Aucune donnée réelle (@exemple.test, @externe.test).

import { describe, it, expect } from 'vitest'
import {
  MESSAGES_ADRESSES_GESTIONNAIRE_QR as M, doublonVuGestionnaireQr, refusAdressesAjouteesQr, saisiesEcritesGestionnaireQr,
} from '@/lib/aj-signalement/ecritures-gestionnaire'
import type { DoublonQr } from '@/lib/aj-signalement/types'

const MOI = 'a0000000-0000-4000-8000-000000000001'
const COLLEGUE = 'a0000000-0000-4000-8000-000000000002'
const FICHES = [
  { id: MOI, email: 'marie@exemple.test' },
  { id: COLLEGUE, email: 'paul@exemple.test' },
]

describe('refusAdressesAjouteesQr', () => {
  it('aucune adresse ajoutée : aucun refus, même sans domaine', () => {
    expect(refusAdressesAjouteesQr([], [], FICHES)).toBeNull()
  })

  it('adresse du domaine de son cabinet, qui n’est pas une fiche : acceptée (casse et espaces ignorés)', () => {
    expect(refusAdressesAjouteesQr([' Conseil@Exemple.TEST '], ['exemple.test'], FICHES)).toBeNull()
  })

  it('aucun domaine déclaré : aucun ajout possible', () => {
    expect(refusAdressesAjouteesQr(['conseil@exemple.test'], [], FICHES)).toBe(M.aucunDomaine)
  })

  it.each([
    ['domaine extérieur', 'conseil@externe.test'],
    ['sous-domaine', 'conseil@sous.exemple.test'],
    ['domaine voisin', 'conseil@exemple.test.fr'],
    ['adresse illisible', 'pas-une-adresse'],
  ])('%s : hors des domaines', (_cas, email) => {
    expect(refusAdressesAjouteesQr([email], ['exemple.test'], FICHES)).toBe(M.horsDomaine)
  })

  it('sa propre adresse et celle d’un collègue : même refus (rien ne nomme le collègue)', () => {
    expect(refusAdressesAjouteesQr(['marie@exemple.test'], ['exemple.test'], FICHES)).toBe(M.adresseDeFiche)
    expect(refusAdressesAjouteesQr(['PAUL@exemple.test'], ['exemple.test'], FICHES)).toBe(M.adresseDeFiche)
  })

  it('sous-adresse « + » de sa propre boîte ou de celle d’un collègue : même refus (relecture 2 du lot 6)', () => {
    expect(refusAdressesAjouteesQr(['marie+suivi@exemple.test'], ['exemple.test'], FICHES)).toBe(M.adresseDeFiche)
    expect(refusAdressesAjouteesQr([' Paul+Copro@Exemple.test'], ['exemple.test'], FICHES)).toBe(M.adresseDeFiche)
    expect(refusAdressesAjouteesQr(['accueil+copro@exemple.test'], ['exemple.test'], FICHES)).toBeNull()
  })

  it('le domaine est contrôlé avant la fiche (aucune fiche d’un autre cabinet n’est révélée)', () => {
    expect(refusAdressesAjouteesQr(['luc@autre-exemple.test'], ['exemple.test'], [...FICHES, { id: 'x', email: 'luc@autre-exemple.test' }])).toBe(M.horsDomaine)
  })

  it('messages : nom du champ en tête, aucune adresse dedans', () => {
    for (const message of Object.values(M)) {
      expect(message.startsWith('emailsDestinataires: ')).toBe(true)
      expect(message).not.toContain('@')
    }
  })
})

describe('saisiesEcritesGestionnaireQr', () => {
  it('liste inchangée : la même, rien d’ajouté', () => {
    expect(saisiesEcritesGestionnaireQr(['cs@externe.test'], ['cs@externe.test'], FICHES, MOI)).toEqual({ ecrites: ['cs@externe.test'], ajoutees: [] })
  })

  it('adresse masquée (autre fiche) conservée à sa place, adresses retirées, ajouts à la fin', () => {
    expect(saisiesEcritesGestionnaireQr(['cs@externe.test', 'paul@exemple.test', 'vieux@externe.test'], ['nouveau@exemple.test'], FICHES, MOI))
      .toEqual({ ecrites: ['paul@exemple.test', 'nouveau@exemple.test'], ajoutees: ['nouveau@exemple.test'] })
  })

  it('sous-adresse d’un collègue (masquée pour lui) : conservée à sa place', () => {
    expect(saisiesEcritesGestionnaireQr(['paul+copro@exemple.test', 'cs@externe.test'], [], FICHES, MOI)).toEqual({ ecrites: ['paul+copro@exemple.test'], ajoutees: [] })
  })

  it('liste vide envoyée : seules les adresses masquées restent', () => {
    expect(saisiesEcritesGestionnaireQr(['paul@exemple.test', 'cs@externe.test'], [], FICHES, MOI)).toEqual({ ecrites: ['paul@exemple.test'], ajoutees: [] })
  })

  it('sa propre adresse déjà présente : visible pour lui, donc retirable (jamais masquée pour lui)', () => {
    expect(saisiesEcritesGestionnaireQr(['marie@exemple.test'], [], FICHES, MOI)).toEqual({ ecrites: [], ajoutees: [] })
    expect(saisiesEcritesGestionnaireQr(['marie@exemple.test'], ['marie@exemple.test'], FICHES, MOI)).toEqual({ ecrites: ['marie@exemple.test'], ajoutees: [] })
  })

  it('adresse masquée renvoyée (devinée) : gardée à sa place, jamais comptée comme un ajout', () => {
    expect(saisiesEcritesGestionnaireQr(['paul@exemple.test'], ['paul@exemple.test'], FICHES, MOI)).toEqual({ ecrites: ['paul@exemple.test'], ajoutees: [] })
  })

  it('ordre changé par l’écran : ordre existant gardé (aucune modification fantôme)', () => {
    expect(saisiesEcritesGestionnaireQr(['a@externe.test', 'b@externe.test'], ['b@externe.test', 'a@externe.test'], FICHES, MOI).ecrites)
      .toEqual(['a@externe.test', 'b@externe.test'])
  })

  it('adresses canoniques et dédoublonnées', () => {
    expect(saisiesEcritesGestionnaireQr(['CS@externe.test', 'cs@externe.test'], [' cs@EXTERNE.test', 'Neuf@Exemple.test', 'neuf@exemple.test'], FICHES, MOI))
      .toEqual({ ecrites: ['cs@externe.test', 'neuf@exemple.test'], ajoutees: ['neuf@exemple.test'] })
  })
})

describe('doublonVuGestionnaireQr', () => {
  const doublon: DoublonQr = { certitude: 'certain', critere: 'nom_code_postal', forcable: true, copropriete: { id: 'c1', nom: 'Résidence Une', ville: 'Marseille' } }

  it('dans sa portée : la copropriété est nommée ; jamais « forcable »', () => {
    expect(doublonVuGestionnaireQr(doublon, new Set(['c1']))).toEqual({
      certitude: 'certain', critere: 'nom_code_postal', copropriete: { id: 'c1', nom: 'Résidence Une', ville: 'Marseille' },
    })
  })

  it('hors de sa portée : ni nom, ni identifiant, ni ville', () => {
    expect(doublonVuGestionnaireQr(doublon, new Set(['c2']))).toEqual({ certitude: 'certain', critere: 'nom_code_postal' })
  })
})
