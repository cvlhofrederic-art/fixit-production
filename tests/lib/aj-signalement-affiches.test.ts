// tests/lib/aj-signalement-affiches.test.ts
//
// « Télécharger toutes les affiches (un PDF, une page par copropriété) » après un import (SPEC § 1.9.7) : affichesPdfQr
// à côté d'affichePdfQr, même mise en page, jsPDF et qrcode chargés au clic, génération séquentielle avec avancement.
// jsPDF est simulé (pages et textes relevés) ; le canvas de jsdom ne dessine pas (pngQr → null, aucune image).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const documents: Array<{ pages: string[][] }> = []

vi.mock('jspdf', () => ({
  jsPDF: class {
    pages: string[][] = [[]]
    constructor() { documents.push(this) }
    setFillColor() { return this }
    rect() { return this }
    setTextColor() { return this }
    setFont() { return this }
    setFontSize() { return this }
    addImage() { return this }
    text(texte: string) { this.pages[this.pages.length - 1].push(String(texte)); return this }
    addPage() { this.pages.push([]); return this }
    output() { return new Blob(['%PDF-simule'], { type: 'application/pdf' }) }
  },
}))

const { affichePdfQr, affichesPdfQr, matriceQr } = await import('@/lib/aj-signalement/qr')

const liste = [1, 2, 3].map((n) => ({
  nom: `Résidence Exemple ${n}`, adresse: `${n} rue Exemple`, url: `https://vitfix.io/cabinet-exemple/signalement/${String(n).repeat(32)}/`,
}))

beforeEach(() => {
  documents.length = 0
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => vi.restoreAllMocks())

describe('affiches en lot', () => {
  it('un seul PDF, une page par copropriété, chacune avec son nom, son adresse et son lien', async () => {
    const avancement = vi.fn()
    const pdf = await affichesPdfQr(liste, avancement)
    expect(pdf).toBeInstanceOf(Blob)
    expect(documents).toHaveLength(1)
    const { pages } = documents[0]
    expect(pages).toHaveLength(3)
    pages.forEach((textes, i) => {
      expect(textes).toContain(liste[i].nom)
      expect(textes).toContain(liste[i].adresse)
      expect(textes).toContain(liste[i].url)
    })
    expect(avancement.mock.calls).toEqual([[1, 3], [2, 3], [3, 3]])
  })

  it('même mise en page que l’affiche seule (mêmes textes sur la page)', async () => {
    const [premiere] = liste
    await affichePdfQr({ ...premiere, matrice: await matriceQr(premiere.url) })
    await affichesPdfQr([premiere])
    expect(documents).toHaveLength(2)
    expect(documents[0].pages).toEqual(documents[1].pages)
  })

  it('liste vide : refusée (rien à imprimer)', async () => {
    await expect(affichesPdfQr([])).rejects.toThrow()
  })
})
