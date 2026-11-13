// tests/lib/aj-signalement-logo-conversion.test.ts
//
// Conversion du logo d'un cabinet DANS LE NAVIGATEUR (demande de Hugo du 13/11/2026) : l'image choisie par le super admin
// (SVG, PNG, JPEG ou WebP, 5 Mo au plus) est dessinée sur un canvas et rendue en PNG borné (800 × 400 px au plus,
// proportions gardées, fond transparent conservé, 200 Kio au plus : dimensions réduites tant qu'il le faut). Un SVG
// chargé comme image n'exécute aucun script ; seul le PNG part au serveur. Le PNG du canvas est nettoyé de ses morceaux
// accessoires non admis (texte, métadonnées propres à un navigateur) avant l'envoi.
//   - règles pures : lib/aj-signalement/logo-conversion.ts (type d'après les octets, dimensions d'un SVG, cible, réduction)
//     et nettoyerPngQr (lib/aj-signalement/logo.ts) ;
//   - adaptateur : convertirLogoQr (lib/aj-signalement/logo-navigateur.ts), outils du navigateur simulés (le canvas de
//     jsdom ne dessine pas) : chargement d'image, dessin, adresses blob.
// Images SYNTHÉTIQUES (tests/helpers/png-synthetique.ts) ; aucun logo réel.

import { describe, expect, it, vi } from 'vitest'
import {
  LOGO_FICHIER_MAX_QR, dimensionsCibleLogoQr, dimensionsSvgQr, reductionLogoQr, typeImageLogoQr,
} from '@/lib/aj-signalement/logo-conversion'
import { LOGO_OCTETS_MAX_QR, analyserPngQr, nettoyerPngQr } from '@/lib/aj-signalement/logo'
import { convertirLogoQr, type OutilsConversionLogoQr } from '@/lib/aj-signalement/logo-navigateur'
import { pngSynthetique } from '../helpers/png-synthetique'

const texte = (s: string) => new TextEncoder().encode(s)
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="502" height="186" viewBox="0 0 502 186"><path d="M0 0h10v10z" fill="#123456"/></svg>'

describe('typeImageLogoQr : le type d’après les octets, jamais d’après le nom du fichier', () => {
  it.each([
    ['PNG', pngSynthetique(4, 4), 'png'],
    ['JPEG', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]), 'jpeg'],
    ['WebP', texte('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '), 'webp'],
    ['SVG', texte(SVG), 'svg'],
    ['SVG avec prologue XML, commentaire et DOCTYPE', texte(`<?xml version="1.0" encoding="UTF-8"?>\n<!-- logo -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">\n${SVG}`), 'svg'],
    ['SVG avec BOM et espaces', texte(`﻿  \n${SVG}`), 'svg'],
  ])('%s → %s', (_cas, octets, type) => {
    expect(typeImageLogoQr(octets)).toBe(type)
  })

  it.each([
    ['GIF', texte('GIF89a......')],
    ['HTML qui contient un SVG', texte(`<html><body>${SVG}</body></html>`)],
    ['texte', texte('bonjour')],
    ['vide', new Uint8Array()],
    ['RIFF qui n’est pas du WebP (WAV)', texte('RIFF\u0000\u0000\u0000\u0000WAVEfmt ')],
  ])('%s → refusé', (_cas, octets) => {
    expect(typeImageLogoQr(octets)).toBeNull()
  })
})

// Relecture de sécurité du 13/11/2026 : l'expression du prologue d'un SVG (deux groupes de commentaires répétés autour
// d'un DOCTYPE facultatif, contenu paresseux qui pouvait franchir « --> ») revenait en arrière de façon exponentielle :
// 22 commentaires vides sans racine <svg> prenaient près d'une seconde, 35 figeaient l'onglet. Le prologue est
// désormais lu en un seul passage.
describe('typeImageLogoQr : prologue d’un SVG lu en temps linéaire (relecture de sécurité)', () => {
  const chrono = (octets: Uint8Array) => {
    const debut = performance.now()
    const type = typeImageLogoQr(octets)
    return { type, ms: performance.now() - debut }
  }

  it.each([10, 22, 40, 585])('%i commentaires vides sans racine <svg> : refus en moins de 50 ms', (n) => {
    const r = chrono(texte(`${'<!---->'.repeat(n)}<x`))
    expect(r.type).toBeNull()
    expect(r.ms).toBeLessThan(50)
  })

  it('les mêmes commentaires, de part et d’autre d’un DOCTYPE, puis la racine <svg> : reconnu en moins de 50 ms', () => {
    const r = chrono(texte(`${'<!---->'.repeat(40)}<!DOCTYPE svg>${'<!---->\n'.repeat(40)}${SVG}`))
    expect(r.type).toBe('svg')
    expect(r.ms).toBeLessThan(50)
  })

  it.each([
    ['déclaration XML minimale', '<?xml?><svg>'],
    ['déclaration et DOCTYPE en majuscules et minuscules mêlées', '<?XML version="1.0"?>\n<!doctype SVG>\n<SVG width="1">'],
    ['DOCTYPE avec sous-ensemble interne (« ] » dans une entité)', '<!DOCTYPE svg [ <!ENTITY x "]"> ]>\n<svg/>'],
    ['commentaire contenant du balisage', '<!-- <html> --><svg>'],
    ['racine auto-fermante', '<svg/>'],
    ['espaces Unicode et BOM', '  <svg\t>'],
  ])('%s → svg', (_cas, contenu) => {
    expect(typeImageLogoQr(texte(contenu))).toBe('svg')
  })

  it.each([
    ['commentaire non fermé', '<!-- <svg>'],
    ['« --> » qui chevauche l’ouverture', '<!---><svg>'],
    ['texte après un commentaire (hors balisage)', '<!-- a --> b --><svg>'],
    ['racine <svg> annoncée dans un commentaire seulement', '<!-- <svg> --><html>'],
    ['déclaration XML non fermée par « ?> »', '<?xml version="1.0"><svg>'],
    ['DOCTYPE non fermé', '<!DOCTYPE svg [ <svg>'],
    ['deux DOCTYPE', '<!DOCTYPE svg><!DOCTYPE svg><svg>'],
    ['balise qui commence par svg sans en être une', '<svgx>'],
    ['« <svg » au bout de la fenêtre lue', '<svg'],
    ['prologue au-delà des 4096 premiers octets', `${' '.repeat(4096)}<svg>`],
  ])('%s → refusé', (_cas, contenu) => {
    expect(typeImageLogoQr(texte(contenu))).toBeNull()
  })
})

describe('dimensionsSvgQr : largeur et hauteur du dessin', () => {
  it.each([
    ['largeur et hauteur', { width: '502', height: '186', viewBox: null }, { largeur: 502, hauteur: 186 }],
    ['en px', { width: '502px', height: '186.5px', viewBox: '0 0 1 1' }, { largeur: 502, hauteur: 186.5 }],
    ['viewBox seul', { width: null, height: null, viewBox: '0 0 300 100' }, { largeur: 300, hauteur: 100 }],
    ['viewBox avec virgules', { width: null, height: null, viewBox: '0,0,300,100' }, { largeur: 300, hauteur: 100 }],
    ['largeur et viewBox', { width: '600', height: null, viewBox: '0 0 300 100' }, { largeur: 600, hauteur: 200 }],
    ['hauteur et viewBox', { width: null, height: '50', viewBox: '0 0 300 100' }, { largeur: 150, hauteur: 50 }],
    ['pourcentages : viewBox', { width: '100%', height: '100%', viewBox: '0 0 300 100' }, { largeur: 300, hauteur: 100 }],
  ])('%s', (_cas, attributs, attendu) => {
    expect(dimensionsSvgQr(attributs)).toEqual(attendu)
  })

  it.each([
    ['rien', { width: null, height: null, viewBox: null }],
    ['unités physiques sans viewBox', { width: '10cm', height: '4cm', viewBox: null }],
    ['viewBox nul', { width: null, height: null, viewBox: '0 0 0 100' }],
    ['viewBox incomplet', { width: null, height: null, viewBox: '0 0 100' }],
    ['largeur négative', { width: '-5', height: '10', viewBox: null }],
  ])('%s → null', (_cas, attributs) => {
    expect(dimensionsSvgQr(attributs)).toBeNull()
  })
})

describe('dimensionsCibleLogoQr et reductionLogoQr', () => {
  it('image matricielle : jamais agrandie ; réduite dans 800 × 400, proportions gardées', () => {
    expect(dimensionsCibleLogoQr({ largeur: 320, hauteur: 120 }, false)).toEqual({ largeur: 320, hauteur: 120 })
    expect(dimensionsCibleLogoQr({ largeur: 1600, hauteur: 800 }, false)).toEqual({ largeur: 800, hauteur: 400 })
    expect(dimensionsCibleLogoQr({ largeur: 1000, hauteur: 1000 }, false)).toEqual({ largeur: 400, hauteur: 400 })
    expect(dimensionsCibleLogoQr({ largeur: 5000, hauteur: 10 }, false)).toEqual({ largeur: 800, hauteur: 2 })
  })

  it('SVG (vectoriel) : dessiné à la plus grande taille qui tient dans 800 × 400', () => {
    expect(dimensionsCibleLogoQr({ largeur: 502, hauteur: 186 }, true)).toEqual({ largeur: 800, hauteur: 296 })
    expect(dimensionsCibleLogoQr({ largeur: 24, hauteur: 48 }, true)).toEqual({ largeur: 200, hauteur: 400 })
  })

  it('réduction de 20 % à chaque essai, jusqu’à 48 px sur le plus grand côté', () => {
    expect(reductionLogoQr({ largeur: 800, hauteur: 400 })).toEqual({ largeur: 640, hauteur: 320 })
    expect(reductionLogoQr({ largeur: 60, hauteur: 30 })).toEqual({ largeur: 48, hauteur: 24 })
    expect(reductionLogoQr({ largeur: 48, hauteur: 24 })).toBeNull()
    let d: { largeur: number; hauteur: number } | null = { largeur: 800, hauteur: 400 }
    let essais = 0
    while (d) { d = reductionLogoQr(d); essais += 1 }
    expect(essais).toBeLessThan(15)
  })
})

describe('nettoyerPngQr : morceaux accessoires non admis retirés (texte, métadonnées d’un navigateur)', () => {
  it('tEXt et iDOT retirés ; image identique à celle sans eux ; morceaux admis gardés', () => {
    const propre = pngSynthetique(12, 6, { morceaux: [{ type: 'sRGB', donnees: Uint8Array.from([0]) }] })
    const chargee = pngSynthetique(12, 6, {
      morceaux: [{ type: 'sRGB', donnees: Uint8Array.from([0]) }, { type: 'tEXt', donnees: texte('Software\0X') }, { type: 'iDOT', donnees: new Uint8Array(28) }],
    })
    expect(analyserPngQr(chargee)).toEqual({ ok: false, raison: 'morceau_interdit' })
    const nettoyee = nettoyerPngQr(chargee)
    expect(nettoyee).toEqual(propre)
    expect(analyserPngQr(nettoyee as Uint8Array)).toEqual({ ok: true, largeur: 12, hauteur: 6 })
  })

  it('PNG déjà propre : rendu tel quel ; morceau critique inconnu, fichier abîmé ou autre format : null', () => {
    const png = pngSynthetique(5, 5)
    expect(nettoyerPngQr(png)).toEqual(png)
    expect(nettoyerPngQr(pngSynthetique(5, 5, { morceaux: [{ type: 'ABCD' }] }))).toBeNull()
    expect(nettoyerPngQr(pngSynthetique(5, 5, { sansFin: true }))).toBeNull()
    expect(nettoyerPngQr(pngSynthetique(5, 5, { queue: texte('x') }))).toBeNull()
    expect(nettoyerPngQr(texte(SVG))).toBeNull()
  })
})

// ── Adaptateur du navigateur, outils simulés ─────────────────────────────────

interface Simulation {
  outils: OutilsConversionLogoQr
  sources: Blob[]
  dessins: Array<{ largeur: number; hauteur: number }>
  revoquees: string[]
}

/** Outils simulés : l'image chargée a les dimensions données (ou celles du SVG préparé) ; chaque dessin rend un PNG. */
function simuler(options: {
  naturelles?: { largeur: number; hauteur: number }
  rendus?: Array<(largeur: number, hauteur: number) => Blob | null>
  chargementRefuse?: boolean
} = {}): Simulation {
  const s: Simulation = { outils: {} as OutilsConversionLogoQr, sources: [], dessins: [], revoquees: [] }
  const rendus = [...(options.rendus ?? [])]
  s.outils = {
    creerUrl: (source) => { s.sources.push(source); return `blob:essai-${s.sources.length}` },
    revoquerUrl: (url) => { s.revoquees.push(url) },
    charger: async () => {
      if (options.chargementRefuse) throw new Error('image illisible')
      const source = s.sources.at(-1) as Blob
      let { largeur, hauteur } = options.naturelles ?? { largeur: 0, hauteur: 0 }
      if (source.type === 'image/svg+xml') {
        const racine = new DOMParser().parseFromString(await source.text(), 'image/svg+xml').documentElement
        largeur = Number(racine.getAttribute('width'))
        hauteur = Number(racine.getAttribute('height'))
      }
      return { naturalWidth: largeur, naturalHeight: hauteur } as unknown as HTMLImageElement
    },
    dessiner: async (_image, largeur, hauteur) => {
      s.dessins.push({ largeur, hauteur })
      const rendu = rendus.shift()
      if (rendu) return rendu(largeur, hauteur)
      return new Blob([pngSynthetique(largeur, hauteur)], { type: 'image/png' })
    },
  }
  return s
}

const fichier = (octets: Uint8Array<ArrayBuffer>, nom: string, type = '') => new File([octets], nom, { type })

describe('convertirLogoQr (navigateur)', () => {
  it('SVG : agrandi à 800 × 296 dans le SVG lui-même (largeur et hauteur posées, viewBox gardée), dessiné, PNG rendu', async () => {
    const s = simuler()
    const r = await convertirLogoQr(fichier(texte(SVG), 'logo.svg', 'image/svg+xml'), s.outils)
    expect(r).toMatchObject({ ok: true, largeur: 800, hauteur: 296 })
    if (r.ok) expect(analyserPngQr(r.png)).toEqual({ ok: true, largeur: 800, hauteur: 296 })
    expect(s.sources).toHaveLength(1)
    const prepare = new DOMParser().parseFromString(await s.sources[0].text(), 'image/svg+xml').documentElement
    expect([prepare.getAttribute('width'), prepare.getAttribute('height'), prepare.getAttribute('viewBox')]).toEqual(['800', '296', '0 0 502 186'])
    expect(s.dessins).toEqual([{ largeur: 800, hauteur: 296 }])
    expect(s.revoquees).toEqual(['blob:essai-1'])
  })

  it('SVG sans viewBox : viewBox posée d’après sa taille d’origine (le dessin est mis à l’échelle, pas rogné)', async () => {
    const s = simuler()
    const r = await convertirLogoQr(fichier(texte('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50"/></svg>'), 'l.svg'), s.outils)
    expect(r).toMatchObject({ ok: true, largeur: 800, hauteur: 400 })
    const prepare = new DOMParser().parseFromString(await s.sources[0].text(), 'image/svg+xml').documentElement
    expect(prepare.getAttribute('viewBox')).toBe('0 0 100 50')
  })

  it('SVG mal formé, ou sans taille lisible : illisible ; aucun dessin', async () => {
    for (const contenu of ['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>']) {
      const s = simuler()
      expect(await convertirLogoQr(fichier(texte(contenu), 'l.svg'), s.outils)).toEqual({ ok: false, raison: 'illisible' })
      expect(s.dessins).toEqual([])
    }
  })

  it('PNG, JPEG ou WebP plus grand que 800 × 400 : réduit, proportions gardées ; plus petit : taille d’origine', async () => {
    const grand = simuler({ naturelles: { largeur: 1600, hauteur: 800 } })
    expect(await convertirLogoQr(fichier(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]), 'photo.jpg'), grand.outils)).toMatchObject({ ok: true, largeur: 800, hauteur: 400 })
    expect(grand.sources[0].type).toBe('image/jpeg')
    const petit = simuler({ naturelles: { largeur: 320, hauteur: 120 } })
    expect(await convertirLogoQr(fichier(pngSynthetique(320, 120), 'logo.png'), petit.outils)).toMatchObject({ ok: true, largeur: 320, hauteur: 120 })
    expect(petit.dessins).toEqual([{ largeur: 320, hauteur: 120 }])
  })

  it('PNG du canvas trop lourd : redessiné plus petit (−20 %) jusqu’à tenir dans 200 Kio', async () => {
    const lourd = () => new Blob([new Uint8Array(LOGO_OCTETS_MAX_QR + 1)], { type: 'image/png' })
    const s = simuler({ naturelles: { largeur: 800, hauteur: 400 }, rendus: [lourd, lourd] })
    const r = await convertirLogoQr(fichier(pngSynthetique(800, 400), 'logo.png'), s.outils)
    expect(r).toMatchObject({ ok: true, largeur: 512, hauteur: 256 })
    expect(s.dessins).toEqual([{ largeur: 800, hauteur: 400 }, { largeur: 640, hauteur: 320 }, { largeur: 512, hauteur: 256 }])
  })

  it('toujours trop lourd : trop_lourd, après un nombre borné d’essais', async () => {
    const s = simuler({ naturelles: { largeur: 800, hauteur: 400 }, rendus: new Array(50).fill(() => new Blob([new Uint8Array(LOGO_OCTETS_MAX_QR + 1)])) })
    expect(await convertirLogoQr(fichier(pngSynthetique(800, 400), 'logo.png'), s.outils)).toEqual({ ok: false, raison: 'trop_lourd' })
    expect(s.dessins.length).toBeLessThan(15)
    expect(s.revoquees).toEqual(['blob:essai-1'])
  })

  it('PNG du canvas avec métadonnées propres au navigateur : nettoyé avant l’envoi', async () => {
    const avecTexte = (l: number, h: number) => new Blob([pngSynthetique(l, h, { morceaux: [{ type: 'tEXt', donnees: texte('Software\0Navigateur') }] })])
    const s = simuler({ naturelles: { largeur: 40, hauteur: 20 }, rendus: [avecTexte] })
    const r = await convertirLogoQr(fichier(pngSynthetique(40, 20), 'logo.png'), s.outils)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.png).toEqual(pngSynthetique(40, 20))
  })

  it('fichier de plus de 5 Mo : refusé sans rien lire ; format inconnu (GIF, PDF, HTML) : format', async () => {
    const s = simuler()
    const enorme = { size: LOGO_FICHIER_MAX_QR + 1, arrayBuffer: vi.fn(), type: 'image/png' } as unknown as Blob
    expect(await convertirLogoQr(enorme, s.outils)).toEqual({ ok: false, raison: 'fichier_trop_lourd' })
    expect((enorme as unknown as { arrayBuffer: ReturnType<typeof vi.fn> }).arrayBuffer).not.toHaveBeenCalled()
    for (const contenu of ['GIF89a....', '%PDF-1.7', `<html>${SVG}</html>`]) {
      expect(await convertirLogoQr(fichier(texte(contenu), 'logo.png', 'image/png'), s.outils)).toEqual({ ok: false, raison: 'format' })
    }
    expect(s.sources).toEqual([])
  })

  it('image que le navigateur ne charge pas : illisible ; canvas sans rendu : navigateur ; adresse blob toujours libérée', async () => {
    const refus = simuler({ chargementRefuse: true })
    expect(await convertirLogoQr(fichier(pngSynthetique(10, 10), 'logo.png'), refus.outils)).toEqual({ ok: false, raison: 'illisible' })
    expect(refus.revoquees).toEqual(['blob:essai-1'])
    const sansRendu = simuler({ naturelles: { largeur: 10, hauteur: 10 }, rendus: [() => null] })
    expect(await convertirLogoQr(fichier(pngSynthetique(10, 10), 'logo.png'), sansRendu.outils)).toEqual({ ok: false, raison: 'navigateur' })
    expect(sansRendu.revoquees).toEqual(['blob:essai-1'])
    const nul = simuler({ naturelles: { largeur: 0, hauteur: 0 } })
    expect(await convertirLogoQr(fichier(pngSynthetique(10, 10), 'logo.png'), nul.outils)).toEqual({ ok: false, raison: 'illisible' })
  })
})

// Relecture de sécurité du 13/11/2026 : un SVG qui contient un <foreignObject> (texte HTML, export draw.io…) rend le
// canvas « tainted » dans Chrome et Safari : toBlob lève SecurityError, qui remontait de convertirLogoQr (la fenêtre
// restait sur « Préparation de l'image… »). Toute erreur du dessin devient un refus ; un foreignObject est refusé
// d'emblée, avec un message dédié, quel que soit le navigateur.
describe('convertirLogoQr : erreurs du navigateur pendant le dessin (relecture de sécurité)', () => {
  const securite = () => Object.assign(new Error("Failed to execute 'toBlob' on 'HTMLCanvasElement': Tainted canvases may not be exported."), { name: 'SecurityError' })

  it('dessin qui lève (canvas « tainted », mémoire…) : refus navigateur, jamais une exception ; adresse blob libérée', async () => {
    const s = simuler({ naturelles: { largeur: 40, hauteur: 20 }, rendus: [() => { throw securite() }] })
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await expect(convertirLogoQr(fichier(pngSynthetique(40, 20), 'logo.png'), s.outils)).resolves.toEqual({ ok: false, raison: 'navigateur' })
    expect(s.revoquees).toEqual(['blob:essai-1'])
    // Journal du navigateur : le nom de l'erreur seulement (jamais le contenu du fichier).
    expect(avertir).toHaveBeenCalledWith('[aj-signalement] logo non converti par le navigateur', 'SecurityError')
    avertir.mockRestore()
  })

  it('PNG rendu illisible par le navigateur (arrayBuffer qui lève) : refus navigateur', async () => {
    const casse = () => ({ size: 10, arrayBuffer: () => Promise.reject(new Error('lecture impossible')) }) as unknown as Blob
    const s = simuler({ naturelles: { largeur: 40, hauteur: 20 }, rendus: [casse] })
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await expect(convertirLogoQr(fichier(pngSynthetique(40, 20), 'logo.png'), s.outils)).resolves.toEqual({ ok: false, raison: 'navigateur' })
    avertir.mockRestore()
  })

  it.each([
    ['foreignObject seul', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><foreignObject width="200" height="80"><div xmlns="http://www.w3.org/1999/xhtml">Cabinet</div></foreignObject></svg>'],
    ['foreignObject dans un switch avec repli', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><switch><foreignObject width="200" height="80"><p xmlns="http://www.w3.org/1999/xhtml">x</p></foreignObject><text y="20">x</text></switch></svg>'],
    ['foreignObject profond', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><g><g><foreignObject width="1" height="1"/></g></g></svg>'],
  ])('SVG avec un %s : refus svg_html d’emblée, rien de chargé ni dessiné', async (_cas, contenu) => {
    const s = simuler()
    expect(await convertirLogoQr(fichier(texte(contenu), 'logo.svg'), s.outils)).toEqual({ ok: false, raison: 'svg_html' })
    expect(s.sources).toEqual([])
    expect(s.dessins).toEqual([])
  })

  it('SVG sans foreignObject (texte SVG, élément homonyme hors de l’espace SVG) : converti comme avant', async () => {
    const s = simuler()
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="urn:exemple" width="200" height="80"><text y="20">Cabinet</text><x:foreignObject/></svg>'
    expect(await convertirLogoQr(fichier(texte(svg), 'logo.svg'), s.outils)).toMatchObject({ ok: true, largeur: 800, hauteur: 320 })
  })
})
