/**
 * Résolveur des fichiers lus par les scripts SEO (lot 7 du brief Aikido du 28/10/2026, issue 9,
 * corrections de relecture) : fabriquerAbsolu(out) n'accepte un chemin que dans le dépôt ou dans le
 * dossier de sortie --out (où pt-audit écrit le JSON que pt-tests relit avec --audit) ; tout autre
 * chemin lève une ErreurChemin dont le message nomme l'option, le chemin et les dossiers autorisés.
 * Chemins construits avec path et os.tmpdir(), jamais en dur : valable sous Windows et Linux.
 * Aucun accès réseau, aucun fichier lu.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { RACINE, dossierSortie, fabriquerAbsolu, ErreurChemin } from '../../scripts/seo/pt-audit/lib/chemins.mjs'

const DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.resolve(os.tmpdir(), 'vitfix-lot7-seo')
const HORS = /hors des dossiers autorisés/

describe('RACINE et dossierSortie', () => {
  it('RACINE est la racine du dépôt', () => {
    expect(RACINE).toBe(DEPOT)
  })

  it('dossierSortie : relatif à la racine du dépôt, ou absolu tel quel', () => {
    expect(dossierSortie('reports/seo')).toBe(path.join(DEPOT, 'reports', 'seo'))
    expect(dossierSortie(OUT)).toBe(OUT)
  })
})

describe('fabriquerAbsolu — fichiers lus par pt-audit et pt-tests', () => {
  const absolu = fabriquerAbsolu(OUT)

  it('accepte un chemin relatif à la racine du dépôt', () => {
    expect(absolu('data/seo/pt-redirects.csv', '--redirections')).toBe(path.join(DEPOT, 'data', 'seo', 'pt-redirects.csv'))
    expect(absolu('a/../data/seo/x.csv')).toBe(path.join(DEPOT, 'data', 'seo', 'x.csv'))
  })

  it('accepte un chemin absolu dans le dépôt', () => {
    const fichier = path.join(DEPOT, 'reports', 'seo', 'pt-audit-2026-10-28.json')
    expect(absolu(fichier, '--audit')).toBe(fichier)
  })

  it('accepte un chemin absolu dans le dossier --out (audit écrit par pt-audit, relu par pt-tests)', () => {
    const fichier = path.join(OUT, 'pt-audit-2026-10-28.json')
    expect(absolu(fichier, '--audit')).toBe(fichier)
  })

  it('refuse une remontée « ../x » hors du dépôt, en nommant l’option, le chemin et les dossiers autorisés', () => {
    let erreur: unknown
    try {
      absolu('../x.json', '--audit')
    } catch (e) {
      erreur = e
    }
    expect(erreur).toBeInstanceOf(ErreurChemin)
    expect(erreur).toBeInstanceOf(Error)
    const message = (erreur as Error).message
    expect(message).toMatch(HORS)
    expect(message).toContain('--audit')
    expect(message).toContain('../x.json')
    expect(message).toContain(DEPOT)
    expect(message).toContain(OUT)
    expect((erreur as Error).name).toBe('ErreurChemin')
  })

  it('refuse un chemin absolu hors du dépôt et hors de --out', () => {
    expect(() => absolu(path.join(os.tmpdir(), 'ailleurs.csv'), '--csv')).toThrow(ErreurChemin)
    expect(() => absolu(path.dirname(DEPOT), '--lot')).toThrow(HORS)
  })

  it('refuse le piège de préfixe sur le dossier --out (« …-seo2 » n’est pas dans « …-seo »)', () => {
    expect(() => absolu(path.join(OUT + '2', 'pt-audit.json'), '--audit')).toThrow(HORS)
  })

  it('nomme « fichier » quand aucune option n’est donnée', () => {
    expect(() => absolu('../x.json')).toThrow(/^fichier : /)
  })

  it('avec le --out par défaut (reports/seo, dans le dépôt), rien hors du dépôt ne passe', () => {
    const parDefaut = fabriquerAbsolu('reports/seo')
    expect(parDefaut('reports/seo/pt-audit-2026-10-28.json', '--audit')).toBe(path.join(DEPOT, 'reports', 'seo', 'pt-audit-2026-10-28.json'))
    expect(() => parDefaut(path.join(OUT, 'pt-audit-2026-10-28.json'), '--audit')).toThrow(HORS)
  })
})
