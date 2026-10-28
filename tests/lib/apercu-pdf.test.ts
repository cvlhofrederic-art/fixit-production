// tests/lib/apercu-pdf.test.ts — lib/pdf/apercu-pdf.ts (lot 6 Sentry du 28/10/2026, issue Y).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DELAI_REVOCATION_APERCU_MS,
  DELAI_REVOCATION_TELECHARGEMENT_MS,
  ouvrirApercuOuTelecharger,
  telechargerParLien,
} from '@/lib/pdf/apercu-pdf'

const fichier = () => new Blob(['%PDF-1.4'], { type: 'application/pdf' })
let clics: Array<{ href: string; download: string }>

beforeEach(() => {
  vi.useFakeTimers()
  clics = []
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // jsdom ne gère pas les URL blob : on simule createObjectURL et on enregistre les clics sur les liens <a download>.
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:https://vitfix.io/apercu'),
    revokeObjectURL: vi.fn(),
  }))
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clics.push({ href: this.href, download: this.download })
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('telechargerParLien', () => {
  it('crée un lien <a download>, le clique puis le retire du document', () => {
    telechargerParLien('blob:https://vitfix.io/x', 'devis-2026-001.pdf')
    expect(clics).toEqual([{ href: 'blob:https://vitfix.io/x', download: 'devis-2026-001.pdf' }])
    expect(document.querySelectorAll('a').length).toBe(0)
  })
})

describe('ouvrirApercuOuTelecharger', () => {
  it('fenêtre ouverte : aperçu, aucun téléchargement, URL révoquée après 60 s', () => {
    const ouvrir = vi.fn(() => ({ closed: false }))
    const revoquer = vi.fn()
    expect(ouvrirApercuOuTelecharger(fichier(), 'devis.pdf', { ouvrir, revoquer })).toBe('apercu')
    expect(ouvrir).toHaveBeenCalledWith('blob:https://vitfix.io/apercu')
    expect(clics).toEqual([])
    vi.advanceTimersByTime(DELAI_REVOCATION_APERCU_MS - 1)
    expect(revoquer).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(revoquer).toHaveBeenCalledWith('blob:https://vitfix.io/apercu')
  })

  it('fenêtre bloquée (window.open rend null) : téléchargement par lien, URL révoquée après 5 s', () => {
    const revoquer = vi.fn()
    expect(ouvrirApercuOuTelecharger(fichier(), 'devis.pdf', { ouvrir: () => null, revoquer })).toBe('telechargement')
    expect(clics).toEqual([{ href: 'blob:https://vitfix.io/apercu', download: 'devis.pdf' }])
    vi.advanceTimersByTime(DELAI_REVOCATION_TELECHARGEMENT_MS)
    expect(revoquer).toHaveBeenCalledTimes(1)
  })

  it('window.open remplacé par une fonction qui lève : téléchargement, aucune exception', () => {
    const ouvrir = () => { throw new TypeError('Failed to fetch ()') }
    expect(ouvrirApercuOuTelecharger(fichier(), 'devis.pdf', { ouvrir, revoquer: vi.fn() })).toBe('telechargement')
    expect(clics).toHaveLength(1)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('aperçu impossible'), 'Failed to fetch ()')
  })

  it('window.open remplacé par une fonction asynchrone qui rejette : rejet géré, téléchargement', async () => {
    const ouvrir = () => Promise.reject(new TypeError('Failed to fetch ()'))
    expect(ouvrirApercuOuTelecharger(fichier(), 'devis.pdf', { ouvrir, revoquer: vi.fn() })).toBe('apercu')
    await vi.advanceTimersByTimeAsync(0)
    expect(clics).toEqual([{ href: 'blob:https://vitfix.io/apercu', download: 'devis.pdf' }])
  })

  it('window.open asynchrone qui réussit : aucun téléchargement', async () => {
    const ouvrir = () => Promise.resolve({ closed: false })
    ouvrirApercuOuTelecharger(fichier(), 'devis.pdf', { ouvrir, revoquer: vi.fn() })
    await vi.advanceTimersByTimeAsync(0)
    expect(clics).toEqual([])
  })

  it('par défaut, utilise window.open(url, "_blank")', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window)
    ouvrirApercuOuTelecharger(fichier(), 'devis.pdf')
    expect(open).toHaveBeenCalledWith('blob:https://vitfix.io/apercu', '_blank')
  })
})
