// @vitest-environment node
// Textes de l'écran du Dictionnaire matériaux : mêmes clés dans les deux langues, et un message pour chaque
// code d'erreur que la route peut rendre (sinon l'artisan lirait « A análise falhou » sans savoir pourquoi).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LIBELLES, libellesPour } from '@/lib/dictionnaire-materiaux/libelles'

describe('libellés du Dictionnaire matériaux', () => {
  it('ont les mêmes clés en portugais et en français', () => {
    expect(Object.keys(LIBELLES.fr).sort((a, b) => a.localeCompare(b))).toEqual(Object.keys(LIBELLES.pt).sort((a, b) => a.localeCompare(b)))
    expect(Object.keys(LIBELLES.fr.erreurs).sort((a, b) => a.localeCompare(b))).toEqual(
      Object.keys(LIBELLES.pt.erreurs).sort((a, b) => a.localeCompare(b)),
    )
  })

  it('n’ont aucun texte vide', () => {
    for (const libelles of Object.values(LIBELLES)) {
      for (const [cle, valeur] of Object.entries(libelles)) {
        if (typeof valeur === 'string') expect(valeur.trim(), cle).not.toBe('')
        else if (typeof valeur === 'function') expect(String((valeur as (x: never) => string)(2 as never)).trim(), cle).not.toBe('')
      }
      for (const [code, message] of Object.entries(libelles.erreurs)) expect(message.trim(), code).not.toBe('')
    }
  })

  it('couvrent chaque code d’erreur de la route', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/dictionnaire-materiaux/analyse/route.ts'), 'utf8')
    const codes = [...route.matchAll(/erreur\('([a-z_]+)'/g)].map((m) => m[1])
    expect(codes.length).toBeGreaterThanOrEqual(9)
    for (const code of codes) {
      expect(LIBELLES.pt.erreurs[code], code).toBeTruthy()
      expect(LIBELLES.fr.erreurs[code], code).toBeTruthy()
    }
  })

  it('accordent singulier et pluriel', () => {
    expect(LIBELLES.pt.nombreSituations(1)).toBe('1 situação')
    expect(LIBELLES.pt.nombreSituations(3)).toBe('3 situações')
    expect(LIBELLES.pt.nombreMateriaux(1)).toBe('1 material')
    expect(LIBELLES.pt.nombreMateriaux(12)).toBe('12 materiais')
    expect(LIBELLES.fr.nombreMateriaux(1)).toBe('1 matériau')
    expect(LIBELLES.fr.nombreMateriaux(2)).toBe('2 matériaux')
  })

  it('servent le portugais au Portugal et le français partout ailleurs', () => {
    expect(libellesPour('pt')).toBe(LIBELLES.pt)
    expect(libellesPour('fr')).toBe(LIBELLES.fr)
    expect(libellesPour('en')).toBe(LIBELLES.fr)
  })
})
