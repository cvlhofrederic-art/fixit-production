// tests/lib/aj-signalement-acces.test.ts
//
// Portée d'un gestionnaire et droits sur une copropriété (SPEC § 1.5, RG-05, Q1 et Q2 tranchées par Hugo le
// 10/11/2026) : fonctions pures ajoutées à lib/aj-signalement/acces-espace.ts (aucune fonction d'accès concurrente).
//   - portée = attributions explicites ∪ copropriétés « attribuées à tous » de SON cabinet ; fiche inactive : rien ;
//   - modifiables = attributions explicites seulement (origine « creation » comprise) ; « à tous » ne donne jamais la
//     modification de la fiche ;
//   - les droits suivent l'attribution : retirée, elle ne donne plus rien.
// En PR 1, seul le super admin entre (la page de suivi qu'il voit pour un gestionnaire utilise cette portée) ; les
// colonnes « gestionnaire » de la matrice sont câblées et testées ici dès la PR 1.

import { describe, expect, it } from 'vitest'
import { droitsSurCoproprieteQr, porteeGestionnaireQr, porteeVideQr } from '@/lib/aj-signalement/acces-espace'
import type { CoproDroitsQr, FicheDroitsQr } from '@/lib/aj-signalement/types'

const CABINET = '11111111-1111-4111-8111-111111111111'
const AUTRE_CABINET = '22222222-2222-4222-8222-222222222222'

const copro = (id: string, cabinetId: string | null, attribueeATous = false): CoproDroitsQr => ({ id, cabinetId, attribueeATous })

const ATTRIBUEE = copro('copro-attribuee', CABINET)
const A_TOUS = copro('copro-a-tous', CABINET, true)
const A_TOUS_ATTRIBUEE = copro('copro-a-tous-attribuee', CABINET, true)
const AUTRE = copro('copro-autre', CABINET)
const A_TOUS_AUTRE_CABINET = copro('copro-a-tous-autre-cabinet', AUTRE_CABINET, true)
const ATTRIBUEE_AUTRE_CABINET = copro('copro-attribuee-autre-cabinet', AUTRE_CABINET)
const SANS_CABINET = copro('copro-sans-cabinet', null)
const SANS_CABINET_A_TOUS = { ...copro('copro-sans-cabinet-a-tous', null), attribueeATous: true }
const COPROS = [ATTRIBUEE, A_TOUS, A_TOUS_ATTRIBUEE, AUTRE, A_TOUS_AUTRE_CABINET, ATTRIBUEE_AUTRE_CABINET, SANS_CABINET, SANS_CABINET_A_TOUS]

const fiche = (actif = true): FicheDroitsQr => ({ id: 'gestionnaire-1', cabinetId: CABINET, actif })
const attributions = new Set([ATTRIBUEE.id, A_TOUS_ATTRIBUEE.id])

const trie = (ensemble: ReadonlySet<string>) => [...ensemble].sort()

describe('porteeGestionnaireQr', () => {
  it('visibles = ses attributions ∪ « à tous » de son cabinet ; modifiables = ses attributions seulement', () => {
    const portee = porteeGestionnaireQr(fiche(), COPROS, attributions)
    expect(trie(portee.visibles)).toEqual(trie(new Set([ATTRIBUEE.id, A_TOUS.id, A_TOUS_ATTRIBUEE.id])))
    expect(trie(portee.modifiables)).toEqual(trie(new Set([ATTRIBUEE.id, A_TOUS_ATTRIBUEE.id])))
  })

  it('« à tous » d’un AUTRE cabinet : rien (isolation entre cabinets clients)', () => {
    const portee = porteeGestionnaireQr(fiche(), COPROS, new Set())
    expect(portee.visibles.has(A_TOUS_AUTRE_CABINET.id)).toBe(false)
    expect(trie(portee.visibles)).toEqual([A_TOUS.id, A_TOUS_ATTRIBUEE.id].sort())
    expect(portee.modifiables.size).toBe(0)
  })

  it('une attribution vers une copropriété d’un autre cabinet ou sans cabinet ne donne rien (défense en profondeur)', () => {
    const portee = porteeGestionnaireQr(fiche(), COPROS, new Set([ATTRIBUEE_AUTRE_CABINET.id, SANS_CABINET.id]))
    expect(portee.visibles.has(ATTRIBUEE_AUTRE_CABINET.id)).toBe(false)
    expect(portee.visibles.has(SANS_CABINET.id)).toBe(false)
    expect(portee.modifiables.size).toBe(0)
  })

  it('copropriété sans cabinet, même marquée « à tous » (donnée impossible en base) : jamais dans la portée', () => {
    expect(porteeGestionnaireQr(fiche(), COPROS, new Set()).visibles.has(SANS_CABINET_A_TOUS.id)).toBe(false)
  })

  it('une attribution vers une copropriété inconnue (supprimée entre deux lectures) ne donne rien', () => {
    const portee = porteeGestionnaireQr(fiche(), COPROS, new Set(['copro-supprimee']))
    expect(portee.visibles.has('copro-supprimee')).toBe(false)
    expect(portee.modifiables.has('copro-supprimee')).toBe(false)
  })

  it('fiche désactivée : aucune copropriété, même « à tous », même attribuée', () => {
    const portee = porteeGestionnaireQr(fiche(false), COPROS, attributions)
    expect(portee.visibles.size).toBe(0)
    expect(portee.modifiables.size).toBe(0)
  })

  it('attribution retirée : ne donne plus rien (Q1 : les droits suivent l’attribution, même pour le créateur)', () => {
    const avant = porteeGestionnaireQr(fiche(), COPROS, new Set([AUTRE.id]))
    expect(avant.visibles.has(AUTRE.id)).toBe(true)
    expect(avant.modifiables.has(AUTRE.id)).toBe(true)
    const apres = porteeGestionnaireQr(fiche(), COPROS, new Set())
    expect(apres.visibles.has(AUTRE.id)).toBe(false)
    expect(apres.modifiables.has(AUTRE.id)).toBe(false)
  })

  it('modifiables ⊆ visibles, toujours', () => {
    const portee = porteeGestionnaireQr(fiche(), COPROS, new Set(COPROS.map((c) => c.id)))
    for (const id of portee.modifiables) expect(portee.visibles.has(id), id).toBe(true)
  })

  it('porteeVideQr : aucune copropriété, ensembles neufs à chaque appel', () => {
    const a = porteeVideQr()
    expect(a.visibles.size + a.modifiables.size).toBe(0)
    expect(porteeVideQr().visibles).not.toBe(a.visibles)
  })
})

describe('droitsSurCoproprieteQr : matrice SPEC § 1.5', () => {
  const portee = porteeGestionnaireQr(fiche(), COPROS, attributions)
  const tout = { voir: true, changerStatut: true, modifierFiche: true, administrer: true }
  const rien = { voir: false, changerStatut: false, modifierFiche: false, administrer: false }

  it('super admin : tout, sur toute copropriété (portée sans effet)', () => {
    for (const c of COPROS) expect(droitsSurCoproprieteQr('super_admin', c.id, porteeVideQr())).toEqual(tout)
  })

  it('gestionnaire, copropriété attribuée : voir, changer le statut, modifier la fiche ; jamais administrer', () => {
    expect(droitsSurCoproprieteQr('gestionnaire', ATTRIBUEE.id, portee))
      .toEqual({ voir: true, changerStatut: true, modifierFiche: true, administrer: false })
  })

  it('gestionnaire, copropriété « à tous » de son cabinet : voir et changer le statut, lecture seule pour la fiche (Q2)', () => {
    expect(droitsSurCoproprieteQr('gestionnaire', A_TOUS.id, portee))
      .toEqual({ voir: true, changerStatut: true, modifierFiche: false, administrer: false })
  })

  it('gestionnaire, « à tous » ET attribuée nommément : la fiche redevient modifiable (attribution explicite)', () => {
    expect(droitsSurCoproprieteQr('gestionnaire', A_TOUS_ATTRIBUEE.id, portee).modifierFiche).toBe(true)
  })

  it('gestionnaire, autre copropriété (même cabinet, autre cabinet, sans cabinet) : rien', () => {
    for (const c of [AUTRE, A_TOUS_AUTRE_CABINET, ATTRIBUEE_AUTRE_CABINET, SANS_CABINET]) {
      expect(droitsSurCoproprieteQr('gestionnaire', c.id, portee), c.id).toEqual(rien)
    }
  })

  it('gestionnaire à fiche désactivée : rien nulle part', () => {
    const vide = porteeGestionnaireQr(fiche(false), COPROS, attributions)
    for (const c of COPROS) expect(droitsSurCoproprieteQr('gestionnaire', c.id, vide)).toEqual(rien)
  })

  it('profil « aucun » : aucun droit, même avec une portée remplie', () => {
    for (const c of COPROS) expect(droitsSurCoproprieteQr('aucun', c.id, portee)).toEqual(rien)
  })

  it('une portée incohérente (modifiable sans être visible) ne donne pas la modification', () => {
    const incoherente = { visibles: new Set<string>(), modifiables: new Set([AUTRE.id]) }
    expect(droitsSurCoproprieteQr('gestionnaire', AUTRE.id, incoherente)).toEqual(rien)
  })
})
