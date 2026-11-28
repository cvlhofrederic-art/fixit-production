// tests/lib/storage-path.test.ts
//
// Chemins Supabase Storage manipulés en service role (lib/security/storage-path.ts) :
// - safeSegment / buildStoragePath : segments générés par le serveur, liste blanche stricte ;
// - assertStoragePath : chemins relus en base (storage_path, pdf_url) ou renvoyés par Storage, avant
//   download / createSignedUrl / remove. Les chemins produits par le serveur passent, les anciens noms
//   avec espaces ou accents aussi ; ce qui sortirait du dossier ou du bucket, ou viserait un autre objet,
//   est refusé. Reprend tous les cas de l'ancien lib/storage/chemin-sur.ts (PR #537).

import { describe, it, expect } from 'vitest'
import { StoragePathError, assertStoragePath, buildStoragePath, safeSegment } from '@/lib/security/storage-path'

const CABINET = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const AUTRE_CABINET = 'ab12cd34-0000-4000-8000-000000000001'
const UPLOADEUR = 'c0ffee00-1111-4222-8333-444455556666'

describe('StoragePathError', () => {
  it('est une Error nommée, au message générique par défaut', () => {
    const erreur = new StoragePathError()
    expect(erreur).toBeInstanceOf(Error)
    expect(erreur.name).toBe('StoragePathError')
    expect(erreur.message).toBe('Chemin de stockage invalide')
  })
})

describe('safeSegment', () => {
  it.each([
    [CABINET],
    ['wallet'],
    ['rc_pro'],
    ['identity-verso'],
    ['backup_389c1c99_2026-10-28.json'],
    ['TRK-MH6V0ABC-X9ZQ.json'],
    ['rapport_1761680000000'],
    ['avant_1.jpg'],
    ['a'],
    ['0'],
    [`a${'b'.repeat(127)}`],
  ])('accepte %s', (segment) => {
    expect(safeSegment(segment)).toBe(segment)
  })

  it.each([
    ['vide', ''],
    ['« . »', '.'],
    ['« .. »', '..'],
    ['nom caché', '.emptyFolderPlaceholder'],
    ['deux points consécutifs', 'a..b'],
    ['barre oblique', 'a/b'],
    ['barre inverse', 'a\\b'],
    ['espace', 'a b'],
    ['accent', 'relevé.pdf'],
    ['tiret en tête', '-x'],
    ['point d’interrogation', 'a?b'],
    ['dièse', 'a#b'],
    ['pourcentage', '%2e%2e'],
    ['caractère NUL', 'a\u0000b'],
    ['trop long', `a${'b'.repeat(128)}`],
  ])('refuse un segment %s', (_cas, segment) => {
    expect(() => safeSegment(segment)).toThrow(StoragePathError)
  })

  it.each([[null], [undefined], [42], [{ path: 'a' }], [['a']]])('refuse une valeur non textuelle (%s)', (valeur) => {
    expect(() => safeSegment(valeur)).toThrow(StoragePathError)
  })
})

describe('buildStoragePath', () => {
  it('joint des segments valides par des barres obliques', () => {
    expect(buildStoragePath(CABINET, 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1.pdf')).toBe(`${CABINET}/cccccccc-cccc-4ccc-8ccc-ccccccccccc1.pdf`)
    expect(buildStoragePath('wallet', CABINET, 'rc_pro')).toBe(`wallet/${CABINET}/rc_pro`)
    expect(buildStoragePath('TRK-MH6V0ABC-X9ZQ.json')).toBe('TRK-MH6V0ABC-X9ZQ.json')
  })

  it('refuse un chemin sans segment', () => {
    expect(() => buildStoragePath()).toThrow(StoragePathError)
  })

  it.each([
    ['« .. » parmi les segments', [CABINET, '..', 'x.pdf']],
    ['segment avec barre oblique', [CABINET, 'a/b.pdf']],
    ['segment vide', [CABINET, '']],
    ['segment non textuel', [CABINET, undefined]],
    ['nom de fichier client', ['kbis', '../../profile-photos/x.jpg']],
  ])('refuse un chemin dont un segment est invalide (%s)', (_cas, segments) => {
    expect(() => buildStoragePath(...segments)).toThrow(StoragePathError)
  })

  it('le résultat passe assertStoragePath avec le préfixe du premier segment', () => {
    const chemin = buildStoragePath(CABINET, 'doc.pdf')
    expect(assertStoragePath(chemin, CABINET)).toBe(chemin)
  })
})

describe('assertStoragePath — sans préfixe', () => {
  it.each([
    [`${CABINET}/cccccccc-cccc-4ccc-8ccc-ccccccccccc1.pdf`],
    [`${CABINET}/pv/pv-ag-2025.pdf`],
    ['factures/2026/F-2026-001.pdf'],
    ['dossier/fichier.v2.final.pdf'],
    ['dossier/Relevé de charges 2025.pdf'],
    ['TRK-MH6V0ABC-X9ZQ.json'],
    ['a'],
  ])('accepte %s et le renvoie tel quel', (chemin) => {
    expect(assertStoragePath(chemin)).toBe(chemin)
  })

  it.each([
    ['vide', ''],
    ['remontant', '../x'],
    ['remontant au milieu', 'a/../b'],
    ['absolu', '/abs'],
    ['absolu avec cabinet', `/${CABINET}/pv/pv-ag-2025.pdf`],
    ['barre inverse', 'a\\b'],
    ['barre inverse remontante', 'cabinet\\..\\doc.pdf'],
    ['« %2e%2e » encodé', '%2e%2e/x'],
    ['« %2e%2e » au milieu', 'cabinet/%2e%2e/autre/doc.pdf'],
    ['« %2E. »', 'cabinet/%2E./doc.pdf'],
    ['« .%2e »', 'cabinet/.%2e/doc.pdf'],
    ['« %2F » encodant une remontée', 'cabinet%2F..%2Fautre.pdf'],
    ['segment vide', 'a//b'],
    ['barre finale', 'cabinet/'],
    ['« . »', 'cabinet/./doc.pdf'],
    ['« .. » seul', '..'],
    ['« ? »', 'cabinet/doc.pdf?download=autre'],
    ['« # »', 'cabinet/doc.pdf#autre'],
    ['retour à la ligne', 'cabinet/doc\n.pdf'],
    ['caractère NUL', 'cabinet/doc.pdf\u0000.png'],
    ['encodage invalide', 'cabinet/doc%zz.pdf'],
    ['trop long', `a/${'b'.repeat(1100)}`],
  ])('refuse un chemin %s', (_cas, chemin) => {
    expect(() => assertStoragePath(chemin)).toThrow(StoragePathError)
  })

  it.each([[null], [undefined], [42], [{ path: 'a/b' }]])('refuse une valeur non textuelle (%s)', (valeur) => {
    expect(() => assertStoragePath(valeur)).toThrow(StoragePathError)
  })

  it('ne met jamais le chemin dans le message d’erreur', () => {
    const chemin = `${AUTRE_CABINET}/../secret-${Date.now()}.pdf`
    let message = ''
    try {
      assertStoragePath(chemin, CABINET)
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).not.toBe('')
    expect(message).not.toContain('secret')
    expect(message).not.toContain(AUTRE_CABINET)
  })
})

describe('assertStoragePath — préfixe du propriétaire', () => {
  it('accepte un chemin dans le dossier attendu, avec ou sans barre finale sur le préfixe', () => {
    expect(assertStoragePath(`${CABINET}/doc.pdf`, CABINET)).toBe(`${CABINET}/doc.pdf`)
    expect(assertStoragePath(`${CABINET}/pv/doc.pdf`, `${CABINET}/`)).toBe(`${CABINET}/pv/doc.pdf`)
  })

  it.each([
    ['préfixe d’un autre tenant', `${AUTRE_CABINET}/doc.pdf`],
    ['dossier dont le nom commence comme le préfixe', `${CABINET}2/doc.pdf`],
    ['chemin réduit au nom du dossier', CABINET],
    ['barre oblique encodée après le préfixe', `${CABINET}%2Fdoc.pdf`],
  ])('refuse un chemin %s', (_cas, chemin) => {
    expect(() => assertStoragePath(chemin, CABINET)).toThrow(StoragePathError)
  })

  it('refuse toujours la traversée, même sous le bon préfixe', () => {
    expect(() => assertStoragePath(`${CABINET}/../${AUTRE_CABINET}/doc.pdf`, CABINET)).toThrow(StoragePathError)
    expect(() => assertStoragePath(`${CABINET}/%2e%2e/doc.pdf`, CABINET)).toThrow(StoragePathError)
  })

  it('accepte l’un des préfixes d’une liste (cabinet actuel ou uploadeur des anciens dépôts)', () => {
    expect(assertStoragePath(`${CABINET}/doc.pdf`, [CABINET, UPLOADEUR])).toBe(`${CABINET}/doc.pdf`)
    expect(assertStoragePath(`${UPLOADEUR}/doc.pdf`, [CABINET, UPLOADEUR])).toBe(`${UPLOADEUR}/doc.pdf`)
    expect(assertStoragePath(`${UPLOADEUR}/doc.pdf`, [CABINET, null, UPLOADEUR, undefined])).toBe(`${UPLOADEUR}/doc.pdf`)
    expect(() => assertStoragePath(`${AUTRE_CABINET}/doc.pdf`, [CABINET, UPLOADEUR])).toThrow(StoragePathError)
  })

  it('refuse tout quand le préfixe demandé est vide : le contrôle n’est jamais sauté en silence', () => {
    expect(() => assertStoragePath(`${CABINET}/doc.pdf`, '')).toThrow(StoragePathError)
    expect(() => assertStoragePath(`${CABINET}/doc.pdf`, [])).toThrow(StoragePathError)
    expect(() => assertStoragePath(`${CABINET}/doc.pdf`, [null, undefined, ''])).toThrow(StoragePathError)
  })

  it('sans préfixe (undefined), aucun dossier n’est imposé', () => {
    expect(assertStoragePath(`${AUTRE_CABINET}/doc.pdf`, undefined)).toBe(`${AUTRE_CABINET}/doc.pdf`)
  })
})
