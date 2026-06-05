import { describe, it, expect, vi } from 'vitest'
import { toCsv, downloadCsv } from '@/lib/syndic/v54/export-csv'

/** Export CSV syndic v54 — sérialisation + déclenchement téléchargement navigateur. */

describe('toCsv', () => {
  it('sérialise avec « ; », CRLF et échappe guillemets/délimiteurs', () => {
    expect(toCsv(['A', 'B'], [['x', 'y;z'], [1, 'a"b']])).toBe('A;B\r\nx;"y;z"\r\n1;"a""b"')
  })
  it('gère null/undefined comme cellule vide', () => {
    expect(toCsv(['A', 'B'], [[null, undefined]])).toBe('A;B\r\n;')
  })
})

describe('downloadCsv', () => {
  it('déclenche un téléchargement (createObjectURL + click + revoke)', () => {
    const createURL = vi.fn(() => 'blob:csv')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: createURL, revokeObjectURL: revoke })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadCsv('mapa.csv', ['Categoria'], [['Limpezas']])
    expect(createURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledTimes(1)
    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})
