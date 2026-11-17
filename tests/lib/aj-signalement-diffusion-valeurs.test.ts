// tests/lib/aj-signalement-diffusion-valeurs.test.ts
//
// PR 3 (diffusion aux déclarants), lot 2 — bâtiment et étage saisis librement (cahier § 3.6, § 10.1) :
//   - normaliserEtageQr : « RDC », « rez-de-chaussée », « r/c », « rés-do-chão », « 0 », « 00 » → 0 ; « SS »,
//     « sous-sol », « s/sol », « cave », « -1 » → -1 ; « -2 », « ss2 » → -2 ; nombre en tête avec suffixe ordinal
//     suivi au plus d'un mot de position → le nombre ; « premier » à « dixième », « primeiro » à « décimo » → le
//     nombre ; tout le reste → la saisie nettoyée (« mezzanine ») ;
//   - regroupement des bâtiments par normaliserBatimentQr (existante) et noms de la fiche ; variantes ; « sans
//     bâtiment » ; portée par défaut (au moins deux groupes présents → bâtiment ; la liste de la fiche ne compte pas) ;
//   - clé → valeurs brutes EXACTES (le SQL ne compare que des valeurs exactes) ; clé inconnue → null ;
//   - libellés FR et PT ; libellé écrit dans l'e-mail : nom de la fiche s'il correspond, sinon la variante la plus
//     fréquente qui passe le contrôle du texte ; aucune → libelleASaisir.

import { describe, it, expect } from 'vitest'
import {
  libelleEtageDiffusionQr, libellePerimetreDiffusionQr, nettoyerLibelleDiffusionQr, normaliserEtageQr,
  porteeParDefautDiffusionQr, valeursBrutesDiffusionQr, valeursCiblablesQr, type CoupleValeursQr,
} from '@/lib/aj-signalement/diffusion-valeurs'

describe('normaliserEtageQr : rez-de-chaussée', () => {
  it.each(['RDC', 'rdc', 'Rdc.', 'rez-de-chaussée', 'Rez de chaussée', 'r/c', 'R/C Esq.', 'rés-do-chão', 'RDC droite', '0', '00', 'Étage 0'])(
    '« %s » → 0', (saisie) => {
      expect(normaliserEtageQr(saisie)).toBe('0')
    })
})

describe('normaliserEtageQr : sous-sols', () => {
  it.each(['-1', 'SS', 'ss', 'sous-sol', 'Sous sol', 's/sol', 'cave', 'Cave', '1er sous-sol', 'piso -1', '−1'])('« %s » → -1', (saisie) => {
    expect(normaliserEtageQr(saisie)).toBe('-1')
  })
  it.each(['-2', 'ss2', 'SS-2', 'sous-sol 2', '2e sous-sol'])('« %s » → -2', (saisie) => {
    expect(normaliserEtageQr(saisie)).toBe('-2')
  })
})

describe('normaliserEtageQr : nombre en tête, suffixe ordinal, un mot de position au plus', () => {
  it.each([
    ['1er', '1'], ['1ère', '1'], ['1', '1'], ['01', '1'], ['1°', '1'], ['1 G', '1'],
    ['2ème', '2'], ['2e', '2'], ['2 D', '2'], ['2 esq.', '2'], ['2ème étage droite', '2'],
    ['3e gauche', '3'], ['3º', '3'], ['3 dto.', '3'], ['Étage 3', '3'], ['３', '3'],
    ['4.º andar', '4'], ['4e fond', '4'], ['5 piso', '5'], ['12', '12'],
  ])('« %s » → %s', (saisie, cle) => {
    expect(normaliserEtageQr(saisie)).toBe(cle)
  })
})

describe('normaliserEtageQr : nombres écrits en lettres', () => {
  it.each([
    ['premier', '1'], ['Premier étage', '1'], ['première', '1'], ['deuxième', '2'], ['troisième gauche', '3'],
    ['dixième', '10'], ['primeiro', '1'], ['segundo andar', '2'], ['terceiro esq.', '3'], ['décimo', '10'],
  ])('« %s » → %s', (saisie, cle) => {
    expect(normaliserEtageQr(saisie)).toBe(cle)
  })
})

describe('normaliserEtageQr : tout le reste est sa propre clé (saisie nettoyée)', () => {
  it.each([
    ['mezzanine', 'mezzanine'], ['Mezzanine', 'mezzanine'], ['  Mezzanine !  ', 'mezzanine'],
    ['Combles (sous toit)', 'combles sous toit'], ['3 bis', '3 bis'], ['3e gauche fond', '3e gauche fond'],
  ])('« %s » → « %s »', (saisie, cle) => {
    expect(normaliserEtageQr(saisie)).toBe(cle)
  })
  it.each(['', '   ', '—', '!!!'])('« %s » (rien à lire) → clé vide', (saisie) => {
    expect(normaliserEtageQr(saisie)).toBe('')
  })
  it('clé de 60 caractères au plus (limite du schéma de la route)', () => {
    expect(normaliserEtageQr('a'.repeat(80)).length).toBeLessThanOrEqual(60)
  })
})

describe('libellés d’étage FR et PT', () => {
  it.each([
    ['0', 'rez-de-chaussée', 'rés-do-chão'], ['1', '1er étage', '1.º andar'], ['2', '2e étage', '2.º andar'],
    ['12', '12e étage', '12.º andar'], ['-1', 'sous-sol (-1)', 'piso -1'], ['-2', 'sous-sol (-2)', 'piso -2'],
  ])('clé %s → « %s » / « %s »', (cle, fr, pt) => {
    expect(libelleEtageDiffusionQr(cle, 'fr')).toBe(fr)
    expect(libelleEtageDiffusionQr(cle, 'pt')).toBe(pt)
  })
  it('une clé non reconnue n’a pas de libellé calculé (il vient de la saisie, contrôlée)', () => {
    expect(libelleEtageDiffusionQr('mezzanine', 'fr')).toBeNull()
  })
})

describe('nettoyerLibelleDiffusionQr', () => {
  it('contrôles et invisibles retirés, espaces réduits, 50 caractères au plus', () => {
    expect(nettoyerLibelleDiffusionQr('  Bât.\u200B  B\n ')).toBe('Bât. B')
    expect(nettoyerLibelleDiffusionQr('B\u00ADâ\u2028t')).toBe('Bâ t')
    expect([...nettoyerLibelleDiffusionQr('x'.repeat(80))].length).toBe(50)
  })
})

// Couples (bâtiment, étage) tels que les rend signalements_qr_diffusion_valeurs : distincts, rognés par btrim, avec le
// nombre d'adresses de chaque couple (nb_adresses) qui sert à classer les variantes.
const COUPLES: CoupleValeursQr[] = [
  { batiment: 'Bât. B', etage: '3e gauche', nb_adresses: 4 },
  { batiment: 'bloc B', etage: '3', nb_adresses: 2 },
  { batiment: 'B', etage: 'RDC', nb_adresses: 1 },
  { batiment: 'A', etage: '1er', nb_adresses: 3 },
  { batiment: 'A', etage: 'premier', nb_adresses: 1 },
  { batiment: 'A', etage: '', nb_adresses: 2 },
  { batiment: '', etage: '2', nb_adresses: 2 },
  { batiment: null, etage: null, nb_adresses: 1 },
]

describe('valeursCiblablesQr : regroupement des bâtiments', () => {
  const valeurs = valeursCiblablesQr(COUPLES, [], 'fr')

  it('un groupe par clé normaliserBatimentQr (« Bât. B » = « bloc B » = « B »), triés', () => {
    expect(valeurs.batiments.map((b) => b.cle)).toEqual(['a', 'b'])
  })
  it('variantes : valeurs brutes distinctes, de la plus fréquente à la moins fréquente', () => {
    const b = valeurs.batiments.find((g) => g.cle === 'b')
    expect(b?.variantes).toEqual(['Bât. B', 'bloc B', 'B'])
  })
  it('libellé sans fiche : la variante la plus fréquente qui passe le contrôle', () => {
    const b = valeurs.batiments.find((g) => g.cle === 'b')
    expect(b).toMatchObject({ libelle: 'Bât. B', libelleASaisir: false })
  })
  it('« sans bâtiment » : bâtiment vide ou absent, compté à part (seulement pour toute la copropriété)', () => {
    expect(valeurs.sansBatiment).toBe(3)
    expect(valeurs.batiments.some((b) => b.cle === '')).toBe(false)
  })
  it('étages regroupés dans leur bâtiment, avec libellés et variantes ; étage vide compté à part', () => {
    const a = valeurs.batiments.find((g) => g.cle === 'a')
    expect(a?.etages).toEqual([
      { cle: '1', libelle: '1er étage', libelleASaisir: false, variantes: ['1er', 'premier'] },
    ])
    expect(a?.sansEtage).toBe(2)
    const b = valeurs.batiments.find((g) => g.cle === 'b')
    expect(b?.etages.map((e) => [e.cle, e.libelle])).toEqual([['0', 'rez-de-chaussée'], ['3', '3e étage']])
    expect(b?.etages.find((e) => e.cle === '3')?.variantes).toEqual(['3e gauche', '3'])
  })
  it('libellés portugais', () => {
    const pt = valeursCiblablesQr(COUPLES, [], 'pt')
    const b = pt.batiments.find((g) => g.cle === 'b')
    expect(b?.etages.map((e) => e.libelle)).toEqual(['rés-do-chão', '3.º andar'])
  })
  it('« nb_adresses » lu en texte (bigint) accepté ; valeur illisible → 1', () => {
    const valeurs = valeursCiblablesQr([
      { batiment: 'Bât D', etage: '1', nb_adresses: 2 }, { batiment: 'D', etage: '2', nb_adresses: '3' },
      { batiment: 'bloc D', etage: '3', nb_adresses: 'x' }, { batiment: 'Bloc D', etage: '4', nb_adresses: null },
    ], [], 'fr')
    expect(valeurs.batiments[0].variantes).toEqual(['D', 'Bât D', 'bloc D', 'Bloc D'])
  })
  it('sans « nb_adresses » (couples seulement), chaque couple compte pour un', () => {
    const sansNb = valeursCiblablesQr([{ batiment: 'bloc C', etage: '1' }, { batiment: 'C', etage: '2' }, { batiment: 'C', etage: '3' }], [], 'fr')
    expect(sansNb.batiments[0]).toMatchObject({ cle: 'c', variantes: ['C', 'bloc C'], libelle: 'C' })
  })
})

describe('valeursCiblablesQr : libellé écrit dans l’e-mail', () => {
  it('nom de la fiche dont la clé correspond, avant toute variante', () => {
    const valeurs = valeursCiblablesQr(COUPLES, ['Bâtiment B', 'Bâtiment C'], 'fr')
    expect(valeurs.batiments.find((g) => g.cle === 'b')).toMatchObject({ libelle: 'Bâtiment B', libelleASaisir: false })
    // Un bâtiment de la fiche sans signalement ne crée pas de groupe.
    expect(valeurs.batiments.some((g) => g.cle === 'c')).toBe(false)
  })
  it('« B !!! » plus fréquent que « B » : « B » retenu, « B !!! » ne passant pas le contrôle', () => {
    const valeurs = valeursCiblablesQr([{ batiment: 'B !!!', etage: '1', nb_adresses: 5 }, { batiment: 'B', etage: '1', nb_adresses: 1 }], [], 'fr')
    expect(valeurs.batiments[0]).toMatchObject({ cle: 'b', libelle: 'B', libelleASaisir: false, variantes: ['B !!!', 'B'] })
  })
  it('« B www.exemple.immo » n’est jamais retenu : aucune variante affichable → libelleASaisir', () => {
    const valeurs = valeursCiblablesQr([{ batiment: 'B www.exemple.immo', etage: '1', nb_adresses: 9 }], [], 'fr')
    expect(valeurs.batiments[0]).toMatchObject({ libelle: null, libelleASaisir: true })
    expect(JSON.stringify(valeurs.batiments[0].libelle)).not.toContain('exemple')
  })
  it('numéro de téléphone non déclaré dans un nom de bâtiment → non retenu ; déclaré → retenu', () => {
    const couples = [{ batiment: 'Bât 0612345678', etage: '1' }]
    expect(valeursCiblablesQr(couples, [], 'fr').batiments[0].libelleASaisir).toBe(true)
    expect(valeursCiblablesQr(couples, [], 'fr', { telephonesAutorises: ['0612345678'] }).batiments[0].libelle).toBe('Bât 0612345678')
  })
  it('libellé nettoyé (contrôles et invisibles retirés, espaces réduits)', () => {
    const valeurs = valeursCiblablesQr([{ batiment: 'Bât.\u200B  D', etage: '1' }], [], 'fr')
    expect(valeurs.batiments[0].libelle).toBe('Bât. D')
  })
  it('étage non reconnu : la saisie nettoyée, contrôlée ; aucune variante affichable → libelleASaisir', () => {
    const ok = valeursCiblablesQr([{ batiment: 'A', etage: 'Mezzanine' }], [], 'fr')
    expect(ok.batiments[0].etages[0]).toMatchObject({ cle: 'mezzanine', libelle: 'Mezzanine', libelleASaisir: false })
    const refuse = valeursCiblablesQr([{ batiment: 'A', etage: 'Mezzanine !!!' }], [], 'fr')
    expect(refuse.batiments[0].etages[0]).toMatchObject({ cle: 'mezzanine', libelle: null, libelleASaisir: true })
  })
})

describe('portée par défaut (J2 : bâtiment par défaut quand il est connu)', () => {
  it('au moins deux groupes de bâtiment présents → « batiment »', () => {
    expect(valeursCiblablesQr(COUPLES, [], 'fr').porteeParDefaut).toBe('batiment')
    expect(porteeParDefautDiffusionQr(valeursCiblablesQr(COUPLES, [], 'fr'))).toBe('batiment')
  })
  it('un seul groupe (« sans bâtiment » exclu) → « copropriete », même si la fiche liste plusieurs bâtiments', () => {
    const valeurs = valeursCiblablesQr([{ batiment: 'A', etage: '1' }, { batiment: 'Bât. A', etage: '2' }, { batiment: '', etage: '1' }], ['A', 'B', 'C'], 'fr')
    expect(valeurs.batiments).toHaveLength(1)
    expect(valeurs.porteeParDefaut).toBe('copropriete')
  })
  it('aucun signalement → « copropriete »', () => {
    expect(valeursCiblablesQr([], ['A', 'B'], 'fr')).toEqual({ batiments: [], sansBatiment: 0, porteeParDefaut: 'copropriete' })
  })
})

describe('valeursBrutesDiffusionQr : clé → valeurs brutes exactes', () => {
  it('bâtiment : toutes les valeurs brutes du groupe, à l’identique', () => {
    expect(valeursBrutesDiffusionQr(COUPLES, { portee: 'batiment', batiment: 'b' })).toEqual({ batiments: ['Bât. B', 'bloc B', 'B'], etages: [] })
  })
  it('étage : couples bruts du groupe (bâtiment, étage), en deux tableaux de même longueur', () => {
    expect(valeursBrutesDiffusionQr(COUPLES, { portee: 'etage', batiment: 'b', etage: '3' }))
      .toEqual({ batiments: ['Bât. B', 'bloc B'], etages: ['3e gauche', '3'] })
    expect(valeursBrutesDiffusionQr(COUPLES, { portee: 'etage', batiment: 'a', etage: '1' }))
      .toEqual({ batiments: ['A', 'A'], etages: ['1er', 'premier'] })
  })
  it('aucune transformation de la valeur reçue (espace insécable, casse, ponctuation gardées)', () => {
    const couples = [{ batiment: 'B\u00A0', etage: '2e\u00A0' }, { batiment: 'b.', etage: ' 2 ' }]
    expect(valeursBrutesDiffusionQr(couples, { portee: 'etage', batiment: 'b', etage: '2' }))
      .toEqual({ batiments: ['B\u00A0', 'b.'], etages: ['2e\u00A0', ' 2 '] })
  })
  it('clé inconnue → null (la route répond 409 perimetre_change)', () => {
    expect(valeursBrutesDiffusionQr(COUPLES, { portee: 'batiment', batiment: 'z' })).toBeNull()
    expect(valeursBrutesDiffusionQr(COUPLES, { portee: 'etage', batiment: 'b', etage: '7' })).toBeNull()
    expect(valeursBrutesDiffusionQr(COUPLES, { portee: 'etage', batiment: 'a', etage: '0' })).toBeNull()
  })
  it('« sans bâtiment » et « sans étage » ne se ciblent pas', () => {
    expect(valeursBrutesDiffusionQr(COUPLES, { portee: 'batiment', batiment: '' })).toBeNull()
    expect(valeursBrutesDiffusionQr(COUPLES, { portee: 'etage', batiment: 'a', etage: '' })).toBeNull()
  })
})

describe('libellePerimetreDiffusionQr', () => {
  it('FR', () => {
    expect(libellePerimetreDiffusionQr('fr', { portee: 'copropriete' })).toBe('Toute la copropriété')
    expect(libellePerimetreDiffusionQr('fr', { portee: 'batiment', batiment: 'B' })).toBe('Bâtiment B')
    expect(libellePerimetreDiffusionQr('fr', { portee: 'etage', batiment: 'B', etage: '3e étage' })).toBe('Bâtiment B · 3e étage')
    expect(libellePerimetreDiffusionQr('fr', { portee: 'signalement' })).toBe('Déclarants du signalement')
  })
  it('PT', () => {
    expect(libellePerimetreDiffusionQr('pt', { portee: 'copropriete' })).toBe('Todo o condomínio')
    expect(libellePerimetreDiffusionQr('pt', { portee: 'etage', batiment: 'B', etage: '3.º andar' })).toBe('Bloco B · 3.º andar')
    expect(libellePerimetreDiffusionQr('pt', { portee: 'signalement' })).toBe('Quem comunicou a ocorrência')
  })
  it('pas de « Bâtiment » devant un libellé qui nomme déjà le bâtiment', () => {
    expect(libellePerimetreDiffusionQr('fr', { portee: 'batiment', batiment: 'Bât. B' })).toBe('Bât. B')
    expect(libellePerimetreDiffusionQr('fr', { portee: 'batiment', batiment: 'Bâtiment B' })).toBe('Bâtiment B')
    expect(libellePerimetreDiffusionQr('fr', { portee: 'batiment', batiment: 'Tour Nord' })).toBe('Tour Nord')
    expect(libellePerimetreDiffusionQr('pt', { portee: 'batiment', batiment: 'Bloco 2' })).toBe('Bloco 2')
  })
})
