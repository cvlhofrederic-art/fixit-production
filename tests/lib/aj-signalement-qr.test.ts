// tests/lib/aj-signalement-qr.test.ts
//
// QR code d'une copropriété : matrice tirée de la bibliothèque `qrcode` (carrée, motifs de repérage sombres),
// chemin SVG (un carré par module sombre, décalé de la marge), nom de fichier sûr, téléchargement par un lien.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cheminSvgQr, coteSvgQr, matriceQr, nomFichierQr, pngQr, telechargerFichier } from '@/lib/aj-signalement/qr'
import { urlSignalementQr } from '@/lib/aj-signalement/types'

const URL_TEST = 'https://vitfix.io/fr/signalement/0123456789abcdef0123456789abcdef/'
const JETON = '0123456789abcdef0123456789abcdef'

describe('adresse encodée dans le QR code (chemin par client, choix de Hugo du 10/11/2026)', () => {
  it('copropriété rattachée à un cabinet : vitfix.io/<identifiant>/signalement/<jeton>/', () => {
    expect(urlSignalementQr(JETON, 'https://vitfix.io', 'cabinet-exemple')).toBe(`https://vitfix.io/cabinet-exemple/signalement/${JETON}/`)
    expect(urlSignalementQr(JETON, 'https://vitfix.io/', 'cabinet-exemple')).toBe(`https://vitfix.io/cabinet-exemple/signalement/${JETON}/`)
  })

  it('sans cabinet : l’ancienne adresse /fr/signalement/<jeton>/ (affiches déjà imprimées)', () => {
    expect(urlSignalementQr(JETON, 'https://vitfix.io')).toBe(URL_TEST)
    expect(urlSignalementQr(JETON, 'https://vitfix.io', null)).toBe(URL_TEST)
    expect(urlSignalementQr(JETON, 'https://vitfix.io', '')).toBe(URL_TEST)
    expect(urlSignalementQr(JETON)).toBe(URL_TEST)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('matrice et SVG', () => {
  it('la matrice est carrée et commence par le motif de repérage (module sombre en haut à gauche)', async () => {
    const m = await matriceQr(URL_TEST)
    expect(m.taille).toBeGreaterThanOrEqual(21)
    expect(m.taille % 4).toBe(1)
    expect(m.sombres).toHaveLength(m.taille * m.taille)
    expect(m.sombres[0]).toBe(true)
    // Le motif de repérage fait 7 modules : la 8e colonne de la première ligne est claire.
    expect(m.sombres[7]).toBe(false)
  })

  it('le chemin SVG place un carré par module sombre, décalé de la marge', async () => {
    const m = await matriceQr(URL_TEST)
    const chemin = cheminSvgQr(m, 2)
    expect(chemin.startsWith('M2 2h1v1h-1z')).toBe(true)
    expect((chemin.match(/h1v1h-1z/g) ?? []).length).toBe(m.sombres.filter(Boolean).length)
    expect(coteSvgQr(m, 2)).toBe(m.taille + 4)
    expect(cheminSvgQr({ taille: 2, sombres: [true, false, false, true] }, 0)).toBe('M0 0h1v1h-1zM1 1h1v1h-1z')
  })

  it('le PNG rend null sans canvas (jsdom) au lieu de lever', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(pngQr({ taille: 2, sombres: [true, false, false, true] })).toBeNull()
  })
})

describe('fichiers', () => {
  it('nom de fichier sans accent ni espace, « copropriete » si rien ne reste', () => {
    expect(nomFichierQr('Parc Belle Ombre')).toBe('parc-belle-ombre')
    expect(nomFichierQr('Résidence Les Oliviers — bât. A')).toBe('residence-les-oliviers-bat-a')
    expect(nomFichierQr('   ')).toBe('copropriete')
  })

  it('le téléchargement passe par un lien cliqué puis retiré ; un Blob reçoit une adresse temporaire', () => {
    const clics: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clics.push(`${this.download}|${this.getAttribute('href')}`)
    })
    const creer = vi.fn(() => 'blob:vitfix/1')
    const revoquer = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: creer, revokeObjectURL: revoquer }))
    vi.useFakeTimers()
    telechargerFichier('qr.png', 'data:image/png;base64,AAAA')
    telechargerFichier('affiche.pdf', new Blob(['%PDF'], { type: 'application/pdf' }))
    expect(clics).toEqual(['qr.png|data:image/png;base64,AAAA', 'affiche.pdf|blob:vitfix/1'])
    expect(document.querySelectorAll('a[download]')).toHaveLength(0)
    vi.runAllTimers()
    expect(revoquer).toHaveBeenCalledWith('blob:vitfix/1')
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})
