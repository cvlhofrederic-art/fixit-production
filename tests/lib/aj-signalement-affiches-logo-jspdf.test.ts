// tests/lib/aj-signalement-affiches-logo-jspdf.test.ts
//
// Logo du cabinet sur les affiches, avec le VRAI jsPDF (celui du navigateur ; seul le canvas du QR code manque à jsdom,
// qui ne dessine pas) : le PNG du logo (RGBA, fond transparent) est lu par jsPDF (CRC vérifiés), incorporé UNE fois pour
// toutes les pages d'un import, avec sa transparence (masque doux /SMask) et compressé (FlateDecode). Image synthétique.

import { describe, expect, it } from 'vitest'
import { pngSynthetique } from '../helpers/png-synthetique'

const { affichesPdfQr } = await import('@/lib/aj-signalement/qr')

const LISTE = [1, 2, 3].map((n) => ({
  nom: `Résidence Exemple ${n}`, adresse: `${n} rue Exemple`, url: `https://vitfix.io/cabinet-exemple/signalement/${String(n).repeat(32)}/`,
}))

/** Texte d'un PDF (latin1 : les flux binaires restent lisibles octet pour octet). */
const textePdf = async (pdf: Blob) => Buffer.from(await pdf.arrayBuffer()).toString('latin1')
const compter = (texte: string, motif: RegExp) => (texte.match(motif) ?? []).length

describe('logo sur les affiches, jsPDF réel', () => {
  it('trois pages, un seul objet image pour le logo (et son masque de transparence), compressé', async () => {
    // Pixels semi-transparents (comme les bords lissés d'un logo sur fond transparent) : masque de transparence requis.
    const logo = { png: pngSynthetique(800, 296, { couleur: [29, 65, 100, 128] }), largeur: 800, hauteur: 296 }
    const texte = await textePdf(await affichesPdfQr(LISTE, undefined, { logo }))
    expect(compter(texte, /\/Type \/Page\b/g)).toBe(3)
    // Logo + son masque /SMask : deux objets image en tout, quelle que soit la page (le QR code n'est pas dessiné ici).
    expect(compter(texte, /\/Subtype \/Image/g)).toBe(2)
    expect(texte).toMatch(/\/SMask \d+ 0 R/)
    expect(texte).toMatch(/\/Width 800\s*\/Height 296/)
    expect(texte).toMatch(/\/Filter \/FlateDecode/)
    // Chaque page dessine le logo (appel de l'image dans son contenu).
    expect(compter(texte, /\/I\d+ Do/g)).toBe(3)
  })

  it('logo entièrement opaque : un seul objet image, sans masque', async () => {
    const logo = { png: pngSynthetique(320, 120, { couleur: [29, 65, 100, 255] }), largeur: 320, hauteur: 120 }
    const texte = await textePdf(await affichesPdfQr(LISTE.slice(0, 1), undefined, { logo }))
    expect(compter(texte, /\/Subtype \/Image/g)).toBe(1)
    expect(texte).not.toMatch(/\/SMask/)
  })

  it('sans logo : aucune image', async () => {
    const texte = await textePdf(await affichesPdfQr(LISTE))
    expect(compter(texte, /\/Subtype \/Image/g)).toBe(0)
  })
})
