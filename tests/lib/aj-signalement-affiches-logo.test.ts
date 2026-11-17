// tests/lib/aj-signalement-affiches-logo.test.ts
//
// Logo du cabinet sur les affiches PDF (demande de Hugo du 13/11/2026 ; lib/aj-signalement/qr.ts) :
//   - SANS logo, l'affiche est identique au pixel près à celle d'avant : la suite COMPLÈTE des appels jsPDF (méthode et
//     arguments) est comparée à celle relevée sur le code d'avant le logo (instantané écrit sur ce code-là) ;
//   - AVEC logo : le logo est posé dans une zone BLANCHE sous le bandeau bleu nuit (un logo sombre y reste lisible), au-
//     dessus du nom de la copropriété, centré, proportions gardées, hauteur bornée ; le reste de la page descend de la
//     hauteur de cette zone, le QR code reste dans la page, au-dessus de l'adresse du lien et du pied de page (fixes) ;
//   - toutes les affiches d'un import : le logo sur chaque page, incorporé une seule fois (même alias jsPDF).
// jsPDF est simulé (chaque appel relevé) ; le canvas aussi (QR code rendu en « data URL » déterministe).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pngSynthetique } from '../helpers/png-synthetique'

type AppelPdf = [string, ...unknown[]]
const documents: AppelPdf[][] = []

/** Arguments relevés : une image (octets) est réduite à sa taille, le reste gardé tel quel. */
const relever = (v: unknown): unknown => (v instanceof Uint8Array ? `octets:${v.length}` : v)

vi.mock('jspdf', () => ({
  jsPDF: class {
    appels: AppelPdf[] = []
    constructor(options: unknown) {
      documents.push(this.appels)
      this.appels.push(['constructeur', options])
      return new Proxy(this, {
        get: (cible, nom) => {
          if (nom === 'appels' || typeof nom === 'symbol') return Reflect.get(cible, nom)
          return (...args: unknown[]) => {
            cible.appels.push([String(nom), ...args.map(relever)])
            return nom === 'output' ? new Blob(['%PDF-simule'], { type: 'application/pdf' }) : undefined
          }
        },
      })
    }
  },
}))

const { affichePdfQr, affichesPdfQr, matriceQr } = await import('@/lib/aj-signalement/qr')

beforeEach(() => {
  documents.length = 0
  // Canvas simulé : le QR code devient une data URL qui dit sa taille (rendu déterministe, sans dessin).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ fillStyle: '', fillRect: () => undefined }) as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (this: HTMLCanvasElement) {
    return `data:image/png;base64,QR-${this.width}x${this.height}`
  })
})
afterEach(() => vi.restoreAllMocks())

const COPRO = { nom: 'Résidence Exemple', adresse: '12 rue Exemple, 13001 Marseille', url: `https://vitfix.io/cabinet-exemple/signalement/${'a'.repeat(32)}/` }
const DEUX = [COPRO, { nom: 'Parc Exemple', adresse: '', url: `https://vitfix.io/cabinet-exemple/signalement/${'b'.repeat(32)}/` }]

describe('sans logo : affiche identique à celle d’avant (même suite d’appels jsPDF)', () => {
  it('affiche seule', async () => {
    await affichePdfQr({ ...COPRO, matrice: await matriceQr(COPRO.url) })
    expect(documents).toHaveLength(1)
    expect(documents[0]).toMatchInlineSnapshot(`
      [
        [
          "constructeur",
          {
            "format": "a4",
            "unit": "mm",
          },
        ],
        [
          "setFillColor",
          13,
          27,
          46,
        ],
        [
          "rect",
          0,
          0,
          210,
          42,
          "F",
        ],
        [
          "setTextColor",
          201,
          168,
          76,
        ],
        [
          "setFont",
          "helvetica",
          "bold",
        ],
        [
          "setFontSize",
          13,
        ],
        [
          "text",
          "AJ SIGNALEMENT",
          105,
          16,
          {
            "align": "center",
          },
        ],
        [
          "setTextColor",
          255,
          255,
          255,
        ],
        [
          "setFontSize",
          24,
        ],
        [
          "text",
          "Un problème dans la copropriété ?",
          105,
          30,
          {
            "align": "center",
          },
        ],
        [
          "setTextColor",
          13,
          27,
          46,
        ],
        [
          "setFontSize",
          22,
        ],
        [
          "text",
          "Résidence Exemple",
          105,
          60,
          {
            "align": "center",
            "maxWidth": 180,
          },
        ],
        [
          "setFont",
          "helvetica",
          "normal",
        ],
        [
          "setFontSize",
          13,
        ],
        [
          "setTextColor",
          74,
          94,
          120,
        ],
        [
          "text",
          "12 rue Exemple, 13001 Marseille",
          105,
          70,
          {
            "align": "center",
            "maxWidth": 180,
          },
        ],
        [
          "addImage",
          "data:image/png;base64,QR-656x656",
          "PNG",
          52.5,
          80,
          105,
          105,
        ],
        [
          "setFont",
          "helvetica",
          "bold",
        ],
        [
          "setFontSize",
          16,
        ],
        [
          "setTextColor",
          13,
          27,
          46,
        ],
        [
          "text",
          "Scannez ce QR code avec l'appareil photo de votre téléphone",
          105,
          199,
          {
            "align": "center",
            "maxWidth": 180,
          },
        ],
        [
          "setFont",
          "helvetica",
          "normal",
        ],
        [
          "setFontSize",
          12.5,
        ],
        [
          "setTextColor",
          31,
          45,
          61,
        ],
        [
          "text",
          "Décrivez le problème (fuite, panne, ascenseur, parties communes...) et laissez vos coordonnées : l'administrateur de la copropriété reçoit votre signalement immédiatement.",
          105,
          209,
          {
            "align": "center",
            "maxWidth": 170,
          },
        ],
        [
          "setFontSize",
          10,
        ],
        [
          "setTextColor",
          74,
          94,
          120,
        ],
        [
          "text",
          "https://vitfix.io/cabinet-exemple/signalement/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/",
          105,
          272,
          {
            "align": "center",
          },
        ],
        [
          "setFontSize",
          9,
        ],
        [
          "text",
          "AJ Signalement - un service VITFIX",
          105,
          284,
          {
            "align": "center",
          },
        ],
        [
          "output",
          "blob",
        ],
      ]
    `)
  })

  it('toutes les affiches d’un import (deux pages, la seconde sans adresse)', async () => {
    await affichesPdfQr(DEUX)
    expect(documents).toHaveLength(1)
    expect(documents[0]).toMatchInlineSnapshot(`
      [
        [
          "constructeur",
          {
            "format": "a4",
            "unit": "mm",
          },
        ],
        [
          "setFillColor",
          13,
          27,
          46,
        ],
        [
          "rect",
          0,
          0,
          210,
          42,
          "F",
        ],
        [
          "setTextColor",
          201,
          168,
          76,
        ],
        [
          "setFont",
          "helvetica",
          "bold",
        ],
        [
          "setFontSize",
          13,
        ],
        [
          "text",
          "AJ SIGNALEMENT",
          105,
          16,
          {
            "align": "center",
          },
        ],
        [
          "setTextColor",
          255,
          255,
          255,
        ],
        [
          "setFontSize",
          24,
        ],
        [
          "text",
          "Un problème dans la copropriété ?",
          105,
          30,
          {
            "align": "center",
          },
        ],
        [
          "setTextColor",
          13,
          27,
          46,
        ],
        [
          "setFontSize",
          22,
        ],
        [
          "text",
          "Résidence Exemple",
          105,
          60,
          {
            "align": "center",
            "maxWidth": 180,
          },
        ],
        [
          "setFont",
          "helvetica",
          "normal",
        ],
        [
          "setFontSize",
          13,
        ],
        [
          "setTextColor",
          74,
          94,
          120,
        ],
        [
          "text",
          "12 rue Exemple, 13001 Marseille",
          105,
          70,
          {
            "align": "center",
            "maxWidth": 180,
          },
        ],
        [
          "addImage",
          "data:image/png;base64,QR-656x656",
          "PNG",
          52.5,
          80,
          105,
          105,
        ],
        [
          "setFont",
          "helvetica",
          "bold",
        ],
        [
          "setFontSize",
          16,
        ],
        [
          "setTextColor",
          13,
          27,
          46,
        ],
        [
          "text",
          "Scannez ce QR code avec l'appareil photo de votre téléphone",
          105,
          199,
          {
            "align": "center",
            "maxWidth": 180,
          },
        ],
        [
          "setFont",
          "helvetica",
          "normal",
        ],
        [
          "setFontSize",
          12.5,
        ],
        [
          "setTextColor",
          31,
          45,
          61,
        ],
        [
          "text",
          "Décrivez le problème (fuite, panne, ascenseur, parties communes...) et laissez vos coordonnées : l'administrateur de la copropriété reçoit votre signalement immédiatement.",
          105,
          209,
          {
            "align": "center",
            "maxWidth": 170,
          },
        ],
        [
          "setFontSize",
          10,
        ],
        [
          "setTextColor",
          74,
          94,
          120,
        ],
        [
          "text",
          "https://vitfix.io/cabinet-exemple/signalement/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/",
          105,
          272,
          {
            "align": "center",
          },
        ],
        [
          "setFontSize",
          9,
        ],
        [
          "text",
          "AJ Signalement - un service VITFIX",
          105,
          284,
          {
            "align": "center",
          },
        ],
        [
          "addPage",
        ],
        [
          "setFillColor",
          13,
          27,
          46,
        ],
        [
          "rect",
          0,
          0,
          210,
          42,
          "F",
        ],
        [
          "setTextColor",
          201,
          168,
          76,
        ],
        [
          "setFont",
          "helvetica",
          "bold",
        ],
        [
          "setFontSize",
          13,
        ],
        [
          "text",
          "AJ SIGNALEMENT",
          105,
          16,
          {
            "align": "center",
          },
        ],
        [
          "setTextColor",
          255,
          255,
          255,
        ],
        [
          "setFontSize",
          24,
        ],
        [
          "text",
          "Un problème dans la copropriété ?",
          105,
          30,
          {
            "align": "center",
          },
        ],
        [
          "setTextColor",
          13,
          27,
          46,
        ],
        [
          "setFontSize",
          22,
        ],
        [
          "text",
          "Parc Exemple",
          105,
          60,
          {
            "align": "center",
            "maxWidth": 180,
          },
        ],
        [
          "addImage",
          "data:image/png;base64,QR-656x656",
          "PNG",
          52.5,
          80,
          105,
          105,
        ],
        [
          "setFont",
          "helvetica",
          "bold",
        ],
        [
          "setFontSize",
          16,
        ],
        [
          "setTextColor",
          13,
          27,
          46,
        ],
        [
          "text",
          "Scannez ce QR code avec l'appareil photo de votre téléphone",
          105,
          199,
          {
            "align": "center",
            "maxWidth": 180,
          },
        ],
        [
          "setFont",
          "helvetica",
          "normal",
        ],
        [
          "setFontSize",
          12.5,
        ],
        [
          "setTextColor",
          31,
          45,
          61,
        ],
        [
          "text",
          "Décrivez le problème (fuite, panne, ascenseur, parties communes...) et laissez vos coordonnées : l'administrateur de la copropriété reçoit votre signalement immédiatement.",
          105,
          209,
          {
            "align": "center",
            "maxWidth": 170,
          },
        ],
        [
          "setFontSize",
          10,
        ],
        [
          "setTextColor",
          74,
          94,
          120,
        ],
        [
          "text",
          "https://vitfix.io/cabinet-exemple/signalement/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/",
          105,
          272,
          {
            "align": "center",
          },
        ],
        [
          "setFontSize",
          9,
        ],
        [
          "text",
          "AJ Signalement - un service VITFIX",
          105,
          284,
          {
            "align": "center",
          },
        ],
        [
          "output",
          "blob",
        ],
      ]
    `)
  })
})

// ── Avec le logo du cabinet ─────────────────────────────────────────────────

const LOGO = { png: pngSynthetique(800, 296), largeur: 800, hauteur: 296 }
const BANDEAU_BAS = 42

/** Appels addImage d'un document : image (data URL du QR code, ou taille des octets du logo) et position. */
const images = (appels: AppelPdf[]) => appels.filter((a) => a[0] === 'addImage').map(([, image, format, x, y, l, h, alias, compression]) => ({
  image, format, x: x as number, y: y as number, l: l as number, h: h as number, alias, compression,
}))
const textes = (appels: AppelPdf[]) => appels.filter((a) => a[0] === 'text').map(([, t, x, y]) => ({ t: t as string, x: x as number, y: y as number }))
const proche = (a: number, b: number) => Math.abs(a - b) < 1e-9

describe('avec logo : zone blanche sous le bandeau, au-dessus du nom de la copropriété', () => {
  it('logo centré, proportions gardées, au plus 80 × 20 mm, sous le bandeau, en PNG compressé', async () => {
    await affichePdfQr({ ...COPRO, matrice: await matriceQr(COPRO.url) }, { logo: LOGO })
    const [logo, qr] = images(documents[0])
    expect(logo.image).toBe(`octets:${LOGO.png.length}`)
    expect(logo.format).toBe('PNG')
    expect(logo.compression).toBe('FAST')
    expect(logo.h).toBeLessThanOrEqual(20)
    expect(logo.l).toBeLessThanOrEqual(80)
    expect(proche(logo.l / logo.h, 800 / 296)).toBe(true)
    expect(proche(logo.x + logo.l / 2, 105)).toBe(true)
    expect(logo.y).toBeGreaterThan(BANDEAU_BAS)
    expect(qr.image).toBe('data:image/png;base64,QR-656x656')
    // Le logo est dessiné après le bandeau (dans la zone blanche), avant le nom de la copropriété.
    const ordre = documents[0].map((a) => a[0] === 'addImage' ? `image:${String(a[1]).slice(0, 6)}` : a[0] === 'text' ? `texte:${String(a[1])}` : a[0])
    expect(ordre.indexOf('rect')).toBeLessThan(ordre.indexOf(`image:octets`))
    expect(ordre.indexOf(`image:octets`)).toBeLessThan(ordre.indexOf(`texte:${COPRO.nom}`))
  })

  it('le nom, l’adresse, le QR code et la consigne descendent de la hauteur de la zone ; QR dans la page, lien et pied fixes', async () => {
    await affichePdfQr({ ...COPRO, matrice: await matriceQr(COPRO.url) })
    const sans = { images: images(documents[0]), textes: textes(documents[0]) }
    await affichePdfQr({ ...COPRO, matrice: await matriceQr(COPRO.url) }, { logo: LOGO })
    const avec = { images: images(documents[1]), textes: textes(documents[1]) }
    const [logo, qr] = avec.images
    const decalage = qr.y - sans.images[0].y
    expect(decalage).toBeGreaterThan(logo.h)
    expect(decalage).toBeLessThanOrEqual(logo.h + 4)
    // Nom de la copropriété sous le logo, avec de l'espace.
    const nom = avec.textes.find((t) => t.t === COPRO.nom)
    expect(nom?.y).toBeGreaterThan(logo.y + logo.h + 5)
    for (const t of sans.textes) {
      const homologue = avec.textes.find((x) => x.t === t.t)
      const fixe = t.y <= 30 || t.y >= 272
      expect(homologue?.y, t.t).toBe(fixe ? t.y : t.y + decalage)
    }
    // QR code entier dans la page, au-dessus de la consigne, elle-même au-dessus de l'adresse du lien (272 mm).
    expect(qr.y + qr.h).toBeLessThan(avec.textes.find((t) => t.t.startsWith('Scannez'))?.y ?? 0)
    expect((avec.textes.find((t) => t.t.startsWith('Décrivez'))?.y ?? 999) + 20).toBeLessThan(272)
    expect(qr.y + qr.h).toBeLessThan(297)
  })

  it('logo très large (800 × 40 px) : 80 mm de large, zone basse ; logo carré : 20 mm de haut', async () => {
    await affichePdfQr({ ...COPRO, matrice: await matriceQr(COPRO.url) }, { logo: { png: pngSynthetique(800, 40), largeur: 800, hauteur: 40 } })
    const [large] = images(documents[0])
    expect([large.l, large.h]).toEqual([80, 4])
    await affichePdfQr({ ...COPRO, matrice: await matriceQr(COPRO.url) }, { logo: { png: pngSynthetique(400, 400), largeur: 400, hauteur: 400 } })
    const [carre] = images(documents[1])
    expect([carre.l, carre.h]).toEqual([20, 20])
  })

  it('toutes les affiches d’un import : le logo sur chaque page, même alias (image incorporée une seule fois)', async () => {
    await affichesPdfQr(DEUX, undefined, { logo: LOGO })
    const logos = images(documents[0]).filter((i) => String(i.image).startsWith('octets:'))
    expect(logos).toHaveLength(2)
    expect(logos[0].alias).toBeTruthy()
    expect(logos[1]).toEqual(logos[0])
    expect(documents[0].filter((a) => a[0] === 'addPage')).toHaveLength(1)
  })

  it('logo null ou absent : exactement l’affiche sans logo', async () => {
    await affichePdfQr({ ...COPRO, matrice: await matriceQr(COPRO.url) })
    await affichePdfQr({ ...COPRO, matrice: await matriceQr(COPRO.url) }, { logo: null })
    await affichesPdfQr([COPRO], undefined, {})
    await affichesPdfQr([COPRO])
    expect(documents[1]).toEqual(documents[0])
    expect(documents[3]).toEqual(documents[2])
  })
})
