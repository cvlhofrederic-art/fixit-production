// tests/lib/aj-signalement-doublons.test.ts
//
// Doublons de copropriétés (SPEC § 1.6, RG-08), règles pures de lib/aj-signalement/doublons.ts partagées par la saisie,
// la modification et l'import (navigateur et serveur) : comparaison à TOUTES les copropriétés du cabinet, actives ou
// non, clé du nom recalculée ici (cle_nom est NULL pour les lignes antérieures, dont Parc Belle Ombre).
//   certain  : même immatriculation, même référence du cabinet (index uniques : jamais forçable) ;
//              même nom normalisé + même code postal (forçable par le super admin seul : « Ce n'est pas un doublon ») ;
//   probable : même adresse normalisée + même code postal ; même nom, code postal différent ou absent (confirmation).

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  LONGUEUR_MAX_CLE_NOM_QR, cleAdresseQr, cleNomCoproQr, cleTexteQr, decisionDoublonsQr, doublonsCoproprieteQr,
} from '@/lib/aj-signalement/doublons'
import type { CoproprieteDoublonQr, FicheDoublonQr } from '@/lib/aj-signalement/types'

const fiche = (champs: Partial<FicheDoublonQr> = {}): FicheDoublonQr => ({
  nom: 'Résidence Exemple', adresse: '12 rue de l’Exemple', codePostal: '75011', immatriculation: null, referenceCabinet: null, ...champs,
})
const existante = (id: string, champs: Partial<CoproprieteDoublonQr> = {}): CoproprieteDoublonQr => ({
  id, ville: 'Paris', ...fiche(), ...champs,
})

describe('clés de comparaison', () => {
  it('cleTexteQr : minuscules sans accents, ponctuation → espace, espaces réduits, ligatures développées', () => {
    expect(cleTexteQr('  Belle-Ombre,  L’Orée  ')).toBe('belle ombre l oree')
    expect(cleTexteQr('Cœur ÆTHER')).toBe('coeur aether')
    expect(cleTexteQr('—')).toBe('')
  })

  it('cleNomCoproQr : « Résidence Le Parc » = « LE PARC » ; « Résidence Parc Belle-Ombre » → « parc belle ombre »', () => {
    expect(cleNomCoproQr('Résidence Le Parc')).toBe(cleNomCoproQr('LE PARC'))
    expect(cleNomCoproQr('Résidence Le Parc')).toBe('parc')
    expect(cleNomCoproQr('Résidence Parc Belle-Ombre')).toBe('parc belle ombre')
    expect(cleNomCoproQr('Parc Belle Ombre')).toBe('parc belle ombre')
  })

  it('cleNomCoproQr : mots vides retirés en tête comme isolés au milieu, jamais à l’intérieur d’un mot', () => {
    expect(cleNomCoproQr('Syndicat des copropriétaires de la Résidence Les Pins')).toBe('pins')
    expect(cleNomCoproQr('Copro. du Clos de l’Exemple')).toBe('clos exemple')
    expect(cleNomCoproQr('Immeuble Lescure')).toBe('lescure')
    expect(cleNomCoproQr('Rés. Delarue')).toBe('delarue')
  })

  it('cleNomCoproQr : un nom fait seulement de mots vides garde ses mots (« La Résidence » ≠ vide)', () => {
    expect(cleNomCoproQr('La Résidence')).toBe('la residence')
    expect(cleNomCoproQr('')).toBe('')
  })

  it('cleNomCoproQr : 200 caractères au plus (CHECK cle_nom de la migration)', () => {
    expect(LONGUEUR_MAX_CLE_NOM_QR).toBe(200)
    expect(cleNomCoproQr('œ'.repeat(200)).length).toBeLessThanOrEqual(200)
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261111_signalements_qr_gestionnaires.sql'), 'utf-8')
    expect(sql).toMatch(/cle_nom IS NULL OR char_length\(cle_nom\) <= 200/)
  })

  it('cleAdresseQr : abréviations développées (bd, av, r, pl…), numéro séparé de son indice', () => {
    expect(cleAdresseQr('12 bd Exemple')).toBe(cleAdresseQr('12, Boulevard Exemple'))
    expect(cleAdresseQr('3 av. de l’Exemple')).toBe(cleAdresseQr('3 Avenue de l’Exemple'))
    expect(cleAdresseQr('7 r. Exemple')).toBe('7 rue exemple')
    expect(cleAdresseQr('1 pl. Exemple')).toBe('1 place exemple')
    expect(cleAdresseQr('12bis rue Exemple')).toBe(cleAdresseQr('12 BIS rue Exemple'))
    expect(cleAdresseQr('5 rue St Exemple')).toBe(cleAdresseQr('5 rue Saint-Exemple'))
  })
})

describe('doublonsCoproprieteQr : niveaux certain / probable', () => {
  it('même immatriculation (espaces, points, casse ignorés) : certain, jamais forçable', () => {
    const d = doublonsCoproprieteQr(fiche({ nom: 'Autre nom', immatriculation: 'ab.123 45' }), [existante('c1', { nom: 'Tout autre', immatriculation: 'AB12345', codePostal: '13001' })])
    expect(d).toEqual([{ certitude: 'certain', critere: 'immatriculation', forcable: false, copropriete: { id: 'c1', nom: 'Tout autre', ville: 'Paris' } }])
  })

  it('même référence du cabinet : certain, jamais forçable (comparaison exacte, comme l’index unique)', () => {
    const d = doublonsCoproprieteQr(fiche({ nom: 'Autre nom', referenceCabinet: ' REF-01 ' }), [existante('c1', { nom: 'Tout autre', referenceCabinet: 'REF-01', codePostal: '13001' })])
    expect(d.map((x) => [x.certitude, x.critere, x.forcable])).toEqual([['certain', 'reference_cabinet', false]])
    expect(doublonsCoproprieteQr(fiche({ nom: 'Autre nom', referenceCabinet: 'ref-01' }), [existante('c1', { nom: 'Tout autre', referenceCabinet: 'REF-01', codePostal: '13001' })])).toEqual([])
  })

  it('même nom normalisé + même code postal : certain, forçable', () => {
    const d = doublonsCoproprieteQr(fiche({ nom: 'Le Parc Exemple', adresse: '' }), [existante('c1', { nom: 'Résidence du Parc Exemple', adresse: '1 rue Ailleurs' })])
    expect(d.map((x) => [x.certitude, x.critere, x.forcable])).toEqual([['certain', 'nom_code_postal', true]])
  })

  it('même adresse normalisée + même code postal (deux syndicats peuvent partager une adresse) : probable', () => {
    const d = doublonsCoproprieteQr(fiche({ nom: 'Bâtiment A Exemple', adresse: '12 bd Exemple' }), [existante('c1', { nom: 'Bâtiment B Exemple', adresse: '12 boulevard Exemple' })])
    expect(d.map((x) => [x.certitude, x.critere, x.forcable])).toEqual([['probable', 'adresse_code_postal', false]])
  })

  it('même nom, code postal différent ou absent : probable', () => {
    expect(doublonsCoproprieteQr(fiche({ codePostal: '13001' }), [existante('c1')]).map((x) => x.critere)).toEqual(['nom'])
    expect(doublonsCoproprieteQr(fiche({ codePostal: '' }), [existante('c1')]).map((x) => [x.certitude, x.critere])).toEqual([['probable', 'nom']])
  })

  it('code postal vide des deux côtés : jamais « certain » sur le nom (comme la fonction SQL), seulement probable', () => {
    const d = doublonsCoproprieteQr(fiche({ codePostal: '' }), [existante('c1', { codePostal: '' })])
    expect(d.map((x) => [x.certitude, x.critere])).toEqual([['probable', 'nom']])
  })

  it('le critère le plus sûr l’emporte pour une même copropriété ; une seule entrée par copropriété', () => {
    const d = doublonsCoproprieteQr(fiche({ immatriculation: 'AB1' }), [existante('c1', { immatriculation: 'AB1' })])
    expect(d).toHaveLength(1)
    expect(d[0].critere).toBe('immatriculation')
  })

  it('tri : certains non forçables, puis certains forçables, puis probables', () => {
    const d = doublonsCoproprieteQr(fiche({ referenceCabinet: 'R1' }), [
      existante('probable', { nom: 'Exemple Autre', codePostal: '75011' }),
      existante('nom-cp', { adresse: 'ailleurs' }),
      existante('reference', { nom: 'Rien à voir', adresse: 'ailleurs', codePostal: '13001', referenceCabinet: 'R1' }),
    ].map((e) => (e.id === 'probable' ? { ...e, adresse: '12 rue de l’Exemple' } : e)))
    expect(d.map((x) => x.copropriete.id)).toEqual(['reference', 'nom-cp', 'probable'])
  })

  it('comparaison aux copropriétés désactivées comme aux actives', () => {
    const desactivee = { ...existante('c1'), actif: false }
    expect(doublonsCoproprieteQr(fiche(), [desactivee])).toHaveLength(1)
  })

  it('ligne antérieure à cle_nom NULL (comme Parc Belle Ombre) : couverte, la clé est recalculée depuis le nom', () => {
    const ancienne = { ...existante('pbo', { nom: 'Parc Belle Ombre', adresse: '', codePostal: '' }), cle_nom: null }
    const d = doublonsCoproprieteQr(fiche({ nom: 'Résidence Parc Belle-Ombre', codePostal: '' }), [ancienne])
    expect(d.map((x) => [x.copropriete.id, x.critere])).toEqual([['pbo', 'nom']])
  })

  it('modification : la copropriété elle-même est ignorée (ignorerId)', () => {
    expect(doublonsCoproprieteQr(fiche(), [existante('c1')], { ignorerId: 'c1' })).toEqual([])
  })

  it('aucune ressemblance : aucun doublon ; champs vides jamais comparés', () => {
    expect(doublonsCoproprieteQr(fiche({ nom: 'Tout autre', adresse: '' }), [existante('c1', { adresse: '' })])).toEqual([])
    expect(doublonsCoproprieteQr(fiche({ nom: '—', adresse: '', codePostal: '' }), [existante('c1', { nom: '—', adresse: '', codePostal: '' })])).toEqual([])
  })
})

describe('decisionDoublonsQr : forçage réservé au super admin', () => {
  const certainNonForcable = doublonsCoproprieteQr(fiche({ immatriculation: 'AB1' }), [existante('c1', { nom: 'Autre', immatriculation: 'AB1', codePostal: '13001' })])
  const certainForcable = doublonsCoproprieteQr(fiche({ adresse: '' }), [existante('c1', { adresse: 'ailleurs' })])
  const probable = doublonsCoproprieteQr(fiche({ codePostal: '13001' }), [existante('c1')])
  const sansDrapeau = { forcerDoublon: false, confirmerDoublonProbable: false }

  it('aucun doublon : accepté, rien de forcé', () => {
    expect(decisionDoublonsQr([], { profil: 'super_admin', ...sansDrapeau })).toEqual({ ok: true, doublonForce: false, probableConfirme: false })
  })

  it('immatriculation ou référence : refusé, même forcé par le super admin', () => {
    const d = decisionDoublonsQr(certainNonForcable, { profil: 'super_admin', forcerDoublon: true, confirmerDoublonProbable: true })
    expect(d).toEqual({ ok: false, doublon: certainNonForcable[0] })
  })

  it('nom + code postal : refusé sans forçage ; forcé par le super admin → accepté, doublonForce (journal doublon.force)', () => {
    expect(decisionDoublonsQr(certainForcable, { profil: 'super_admin', ...sansDrapeau })).toEqual({ ok: false, doublon: certainForcable[0] })
    expect(decisionDoublonsQr(certainForcable, { profil: 'super_admin', forcerDoublon: true, confirmerDoublonProbable: false }))
      .toEqual({ ok: true, doublonForce: true, probableConfirme: false })
  })

  it('nom + code postal : jamais forçable par un gestionnaire (PR 2), même avec le drapeau', () => {
    expect(decisionDoublonsQr(certainForcable, { profil: 'gestionnaire', forcerDoublon: true, confirmerDoublonProbable: true }))
      .toEqual({ ok: false, doublon: certainForcable[0] })
  })

  it('probable : refusé sans confirmation ; confirmé → accepté (super admin comme gestionnaire)', () => {
    expect(decisionDoublonsQr(probable, { profil: 'gestionnaire', ...sansDrapeau })).toEqual({ ok: false, doublon: probable[0] })
    for (const profil of ['super_admin', 'gestionnaire'] as const) {
      expect(decisionDoublonsQr(probable, { profil, forcerDoublon: false, confirmerDoublonProbable: true }))
        .toEqual({ ok: true, doublonForce: false, probableConfirme: true })
    }
  })

  it('le forçage du super admin vaut aussi confirmation des probables (une seule question à l’écran)', () => {
    expect(decisionDoublonsQr([...certainForcable, ...probable.map((p) => ({ ...p, copropriete: { ...p.copropriete, id: 'c2' } }))],
      { profil: 'super_admin', forcerDoublon: true, confirmerDoublonProbable: false }))
      .toEqual({ ok: true, doublonForce: true, probableConfirme: true })
  })
})
