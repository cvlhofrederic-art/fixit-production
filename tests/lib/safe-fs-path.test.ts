/**
 * resolveInside (lot 7 du brief Aikido du 28/10/2026, issue 9) : le chemin produit reste dans le
 * dossier racine quelle que soit l'entrée (remontée « .. », chemin absolu externe, préfixe trompeur
 * « data2 » pour la racine « data »). Les deux copies, lib/security/safe-fs-path.ts (application) et
 * scripts/lib/safe-fs-path.mjs (scripts CLI), doivent se comporter à l'identique : la même suite
 * tourne sur chacune. Chemins construits avec path.resolve / path.sep, jamais en dur : valable sous
 * Windows (séparateur « \ ») comme sous Linux.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { resolveInside as resolveInsideApplication } from '@/lib/security/safe-fs-path'
import { resolveInside as resolveInsideScripts } from '../../scripts/lib/safe-fs-path.mjs'

const RACINE = path.resolve(os.tmpdir(), 'vitfix-lot7', 'data')
const HORS = /hors du dossier/

describe.each([
  ['lib/security/safe-fs-path.ts', resolveInsideApplication],
  ['scripts/lib/safe-fs-path.mjs', resolveInsideScripts],
])('resolveInside — %s', (_copie, resolveInside) => {
  it('résout un fichier du dossier', () => {
    expect(resolveInside(RACINE, 'tenders-13.json')).toBe(path.join(RACINE, 'tenders-13.json'))
  })

  it('résout un fichier d’un sous-dossier', () => {
    expect(resolveInside(RACINE, path.join('seo', 'pt-redirects.csv'))).toBe(path.join(RACINE, 'seo', 'pt-redirects.csv'))
  })

  it('accepte un chemin absolu situé dans le dossier', () => {
    const absolu = path.join(RACINE, 'x.json')
    expect(resolveInside(RACINE, absolu)).toBe(absolu)
  })

  it('accepte « a/../b », qui reste dans le dossier', () => {
    expect(resolveInside(RACINE, ['a', '..', 'b'].join(path.sep))).toBe(path.join(RACINE, 'b'))
    expect(resolveInside(RACINE, 'a/../b')).toBe(path.join(RACINE, 'b'))
  })

  it('accepte la racine elle-même', () => {
    expect(resolveInside(RACINE, '')).toBe(RACINE)
    expect(resolveInside(RACINE, '.')).toBe(RACINE)
    expect(resolveInside(RACINE, ['a', '..'].join(path.sep))).toBe(RACINE)
    expect(resolveInside(RACINE, RACINE)).toBe(RACINE)
  })

  it('normalise une racine relative et une racine à séparateur final', () => {
    expect(resolveInside('data', 'x.json')).toBe(path.resolve('data', 'x.json'))
    expect(resolveInside(RACINE + path.sep, 'x.json')).toBe(path.join(RACINE, 'x.json'))
  })

  it('accepte la racine du système de fichiers comme dossier', () => {
    const racineFs = path.parse(RACINE).root
    expect(resolveInside(racineFs, 'x')).toBe(path.join(racineFs, 'x'))
    expect(() => resolveInside(racineFs, '..')).not.toThrow()
  })

  it('refuse une remontée « ../x »', () => {
    expect(() => resolveInside(RACINE, '../x')).toThrow(HORS)
    expect(() => resolveInside(RACINE, ['..', 'x'].join(path.sep))).toThrow(HORS)
    expect(() => resolveInside(RACINE, '..')).toThrow(HORS)
  })

  it('refuse une remontée cachée dans un sous-chemin', () => {
    expect(() => resolveInside(RACINE, 'a/../../x')).toThrow(HORS)
    expect(() => resolveInside(RACINE, ['a', 'b', '..', '..', '..', 'x'].join(path.sep))).toThrow(HORS)
  })

  it('refuse un chemin absolu hors du dossier', () => {
    expect(() => resolveInside(RACINE, path.resolve(RACINE, '..', 'autre', 'x.json'))).toThrow(HORS)
    expect(() => resolveInside(RACINE, os.tmpdir())).toThrow(HORS)
    expect(() => resolveInside(RACINE, path.dirname(RACINE))).toThrow(HORS)
  })

  it('refuse le piège de préfixe : « data2 » n’est pas dans « data »', () => {
    const data2 = RACINE + '2'
    expect(() => resolveInside(RACINE, data2)).toThrow(HORS)
    expect(() => resolveInside(RACINE, path.join(data2, 'x.json'))).toThrow(HORS)
    expect(() => resolveInside(RACINE, '../data2/x.json')).toThrow(HORS)
  })

  it.runIf(process.platform === 'win32')('Windows : refuse une remontée écrite avec la barre oblique inverse', () => {
    expect(() => resolveInside(RACINE, '..\\x')).toThrow(HORS)
    expect(() => resolveInside(RACINE, 'a\\..\\..\\x')).toThrow(HORS)
    expect(() => resolveInside(RACINE, 'C:\\Windows\\win.ini')).toThrow(HORS)
  })

  it.runIf(process.platform !== 'win32')('Linux : la barre oblique inverse est un caractère ordinaire, pas un séparateur', () => {
    expect(resolveInside(RACINE, '..\\x')).toBe(path.join(RACINE, '..\\x'))
  })
})
