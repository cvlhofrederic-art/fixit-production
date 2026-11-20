// tests/lib/btp-catalogue-exemple-ancien.test.ts
//
// Référence de l'ancien catalogue d'exemple du module Prestations BTP (lib/btp/catalogue-exemple-ancien.ts), gardée
// seulement pour reconnaître ses éléments jamais modifiés et les retirer à la demande de la société. Le 20/11/2026, elle
// a été vérifiée contre l'ancien code (avant #718 : les 40 éléments écrits par le module et par le formulaire de devis,
// un à un) et contre les catalogues enregistrés en production (tous reconnus en entier).

import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import {
  empreinteElement, estElementExempleIntact, exempleAncienTelQuEnregistre, separerExempleAncien,
} from '@/lib/btp/catalogue-exemple-ancien'

const FORMES = ['module', 'formulaire'] as const

describe('ancien catalogue d\'exemple — forme', () => {
  it('40 éléments par forme : 31 prestations puis 9 matériaux, identifiants 1 à 40', () => {
    for (const forme of FORMES) {
      const exemple = exempleAncienTelQuEnregistre(forme)
      expect(exemple.map((e) => e.id)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1))
      expect(exemple.slice(0, 31).every((e) => e.type === 'prest')).toBe(true)
      expect(exemple.slice(31).every((e) => e.type === 'mat')).toBe(true)
      expect(exemple[0].name).toBe('Démolition cloisons + évacuation gravats')
      expect(exemple[30].name).toBe('Main d\'œuvre qualifiée')
      expect(exemple[39].name).toBe('Béton prêt à l\'emploi C25/30')
    }
  })

  it('module : étapes chiffrées (part du prix médian, unité de la prestation) ; formulaire : étapes nues', () => {
    const libelles = ['Protection des sols et du mobilier voisin', 'Démolition mécanique des cloisons', 'Tri et évacuation des gravats en déchèterie agréée']
    expect(exempleAncienTelQuEnregistre('module')[0].etapes).toEqual([
      { label: libelles[0], price: 812.5, unit: 'forfait' },
      { label: libelles[1], price: 1625, unit: 'forfait' },
      { label: libelles[2], price: 812.5, unit: 'forfait' },
    ])
    expect(exempleAncienTelQuEnregistre('formulaire')[0].etapes).toEqual(libelles.map((label) => ({ label })))
  })

  it('contenu figé : empreinte des deux formes, telles que vérifiées le 20/11/2026 contre l\'ancien code', () => {
    // Une retouche de la référence (un prix, un libellé) ferait « oublier » l'élément correspondant chez les sociétés.
    const empreinte = (forme: 'module' | 'formulaire') =>
      createHash('sha256').update(JSON.stringify(exempleAncienTelQuEnregistre(forme))).digest('hex')
    expect(empreinte('module')).toBe('11c4f1340403b111b27deb69525bca60755e1cd7e42c0ae7edabea3b305422d2')
    expect(empreinte('formulaire')).toBe('5d80d9d330646848d06a6a05b382e2e8d654cee7dc930507465250035e3f14f9')
  })

  it('chaque appel rend une copie : la modifier ne change pas la référence', () => {
    const copie = exempleAncienTelQuEnregistre('module')
    copie[0].name = 'Modifiée'
    expect(exempleAncienTelQuEnregistre('module')[0].name).toBe('Démolition cloisons + évacuation gravats')
  })
})

describe('ancien catalogue d\'exemple — reconnaissance', () => {
  it('chaque élément des deux formes est reconnu, même relu depuis le stockage ; supabase_id et _dirty ne comptent pas', () => {
    for (const forme of FORMES) {
      const relu = JSON.parse(JSON.stringify(exempleAncienTelQuEnregistre(forme))) as Array<Record<string, unknown>>
      expect(relu.filter(estElementExempleIntact)).toHaveLength(40)
      expect(relu.map((e) => ({ ...e, supabase_id: 'svc-1', _dirty: true })).filter(estElementExempleIntact)).toHaveLength(40)
    }
  })

  it('la moindre modification, ou un autre identifiant : non reconnu', () => {
    const [e] = exempleAncienTelQuEnregistre('module')
    const etapes = e.etapes!
    const variantes = [
      { ...e, id: 2 },
      { ...e, name: `${e.name} ` },
      { ...e, description: 'Autre description' },
      { ...e, unit: 'm²' },
      { ...e, lot: 'peinture' },
      { ...e, price: { min: 2500, max: 4001 } },
      { ...e, priceAchat: null },
      { ...e, etapes: etapes.slice(1) },
      { ...e, etapes: [{ ...etapes[0], label: 'Protection des sols' }, ...etapes.slice(1)] },
      { ...e, etapes: [{ ...etapes[0], price: 800 }, ...etapes.slice(1)] },
    ]
    for (const v of variantes) expect(estElementExempleIntact(v)).toBe(false)
  })

  it('une valeur qui n\'est pas un élément n\'est pas reconnue', () => {
    for (const v of [null, undefined, 'Dalle béton', 42, [], {}]) expect(estElementExempleIntact(v)).toBe(false)
  })

  it('l\'empreinte ne dépend ni de l\'ordre des clés ni des valeurs indéfinies', () => {
    expect(empreinteElement({ b: 1, a: { d: 2, c: [3, { f: 4, e: undefined }] } })).toBe(empreinteElement({ a: { c: [3, { f: 4 }], d: 2 }, b: 1 }))
  })

  it('séparation : éléments gardés et éléments d\'exemple, chacun dans son ordre, sans rien modifier', () => {
    const [premier, second] = exempleAncienTelQuEnregistre('module')
    const aElle = { id: 41, name: 'Ma prestation', type: 'prest' }
    const modifie = { ...second, price: { min: 1, max: 1 } }
    const { gardes, exemples } = separerExempleAncien([aElle, premier, modifie, second])
    expect(gardes).toEqual([aElle, modifie])
    expect(exemples).toEqual([premier, second])
    expect(gardes[0]).toBe(aElle)
  })
})
