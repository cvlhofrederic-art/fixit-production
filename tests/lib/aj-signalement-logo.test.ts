// tests/lib/aj-signalement-logo.test.ts
//
// Logo d'un cabinet client (demande de Hugo du 13/11/2026) : règles de l'image communes au navigateur et au serveur
// (lib/aj-signalement/logo.ts). Le serveur ne stocke qu'un PNG, revérifié ici avant la base : signature, morceaux
// (longueur, CRC, ordre, IHDR d'abord, IEND en dernier et rien après), aucun morceau de texte ou de métadonnées,
// dimensions lues dans l'en-tête IHDR (800 × 400 px au plus), poids (200 Kio au plus). Mêmes bornes que la contrainte de
// la migration 20261114 (comparées au texte SQL). Images SYNTHÉTIQUES (tests/helpers/png-synthetique.ts).

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { constants as zlibConstantes, deflateSync } from 'zlib'
import {
  LOGO_BASE64_MAX_QR, LOGO_HAUTEUR_MAX_QR, LOGO_LARGEUR_MAX_QR, LOGO_OCTETS_MAX_QR, analyserPngQr, base64DepuisOctetsQr,
  byteaDepuisOctetsQr, cheminLogoCabinetQr, metaLogoDepuisLigneQr, octetsDepuisBase64Qr, octetsDepuisByteaQr,
} from '@/lib/aj-signalement/logo'
import {
  avecOctet, base64Png, hexBytea, ihdrPng, lignesBrutes, morceauPng, pngDeMorceaux, pngSynthetique,
} from '../helpers/png-synthetique'

const texte = (s: string) => new TextEncoder().encode(s)
const PNG_10 = pngSynthetique(10, 10)

describe('analyserPngQr : seul un PNG conforme passe', () => {
  it('PNG RGBA valide : largeur et hauteur lues dans l’en-tête', () => {
    expect(analyserPngQr(pngSynthetique(320, 120))).toEqual({ ok: true, largeur: 320, hauteur: 120 })
    expect(analyserPngQr(pngSynthetique(LOGO_LARGEUR_MAX_QR, LOGO_HAUTEUR_MAX_QR))).toEqual({ ok: true, largeur: 800, hauteur: 400 })
    expect(analyserPngQr(pngSynthetique(1, 1))).toEqual({ ok: true, largeur: 1, hauteur: 1 })
  })

  it('morceaux accessoires sans texte admis (sRGB, gAMA, pHYs) : ceux d’un canvas', () => {
    const png = pngSynthetique(10, 10, { morceaux: [{ type: 'sRGB', donnees: Uint8Array.from([0]) }, { type: 'pHYs', donnees: new Uint8Array(9) }] })
    expect(analyserPngQr(png)).toEqual({ ok: true, largeur: 10, hauteur: 10 })
  })

  it.each([
    ['vide', new Uint8Array(), 'structure'],
    ['JPEG', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(60).fill(0)]), 'signature'],
    ['SVG (texte)', texte(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${' '.repeat(60)}</svg>`), 'signature'],
    ['signature abîmée', avecOctet(pngSynthetique(10, 10), 1, 0x51), 'signature'],
    ['CRC de l’IHDR faux', avecOctet(PNG_10, 29, PNG_10[29] ^ 0xff), 'structure'],
    ['morceau abîmé (CRC)', pngSynthetique(10, 10, { morceaux: [{ type: 'sRGB', donnees: Uint8Array.from([0]), crcFaux: true }] }), 'structure'],
    ['tronqué (sans IEND)', pngSynthetique(10, 10, { sansFin: true }), 'structure'],
    ['octets après IEND (fichier polyglotte)', pngSynthetique(10, 10, { queue: texte('<script>alert(1)</script>') }), 'structure'],
    ['longueur de morceau hors du fichier', avecOctet(pngSynthetique(10, 10), 8, 0x7f), 'structure'],
    ['texte (tEXt : métadonnées)', pngSynthetique(10, 10, { morceaux: [{ type: 'tEXt', donnees: texte('Author\0Exemple') }] }), 'morceau_interdit'],
    ['texte compressé (zTXt)', pngSynthetique(10, 10, { morceaux: [{ type: 'zTXt', donnees: texte('k\0\0x') }] }), 'morceau_interdit'],
    ['texte international (iTXt)', pngSynthetique(10, 10, { morceaux: [{ type: 'iTXt', donnees: texte('k\0\0\0\0\0x') }] }), 'morceau_interdit'],
    ['EXIF', pngSynthetique(10, 10, { morceaux: [{ type: 'eXIf', donnees: texte('MM') }] }), 'morceau_interdit'],
    ['PNG animé (acTL)', pngSynthetique(10, 10, { morceaux: [{ type: 'acTL', donnees: new Uint8Array(8) }] }), 'morceau_interdit'],
    ['profondeur impossible', pngSynthetique(10, 10, { profondeur: 3 }), 'structure'],
    ['type de couleur impossible', pngSynthetique(10, 10, { typeCouleur: 5 }), 'structure'],
    ['palette sans PLTE', pngSynthetique(10, 10, { typeCouleur: 3 }), 'structure'],
    ['plus de 800 px de large', pngSynthetique(801, 10), 'dimensions'],
    ['plus de 400 px de haut', pngSynthetique(10, 401), 'dimensions'],
    ['plus de 200 Kio', pngSynthetique(240, 240, { bruit: true }), 'poids'],
  ])('%s → %s', (_cas, image, raison) => {
    expect(analyserPngQr(image)).toEqual({ ok: false, raison })
  })

  it('le refus du poids ne lit pas l’image (trop lourde d’abord)', () => {
    const lourde = new Uint8Array(LOGO_OCTETS_MAX_QR + 1)
    expect(analyserPngQr(lourde)).toEqual({ ok: false, raison: 'poids' })
  })
})

// Relecture de sécurité du 13/11/2026 : la revérification ne regardait que la FORME du fichier. Un appel direct de la
// route d'envoi (session super admin, sans le canvas) faisait stocker puis servir un texte libre dans iCCP, des octets
// cachés après le flux zlib des IDAT, une bombe de décompression (145 Kio → 150 Mo), ou un IDAT qui n'était pas du zlib
// (jsPDF ne pouvait plus faire l'affiche). Seul passe désormais un PNG tel qu'un canvas le produit, contenu compris.
describe('analyserPngQr : un PNG tel qu’un canvas le produit, contenu compris (relecture de sécurité)', () => {
  const RVBA = 4
  const texteIccp = Buffer.concat([Buffer.from('%PDF-1.7 profil', 'latin1'), Buffer.from([0, 0]),
    deflateSync(Buffer.from('Contact : jean.exemple@exemple.test — texte libre caché dans le logo', 'utf8'))])
  const fluxDe = (l: number, h: number, octetsParPixel = RVBA) => deflateSync(lignesBrutes(l, h, octetsParPixel))
  const accessoire = (type: string, n: number) => ({ type, donnees: new Uint8Array(n) })

  it.each([
    ['RVB (type 2)', pngSynthetique(30, 10, { typeCouleur: 2, couleur: [29, 65, 100, 255] })],
    ['IDAT découpé en morceaux de 7 octets', pngSynthetique(40, 20, { bruit: true, tailleIdat: 7 })],
    ['zlib sans compression (blocs stockés)', pngSynthetique(100, 100, { bruit: true, zlib: { level: 0 } })],
    ['zlib niveau 1', pngSynthetique(120, 60, { bruit: true, zlib: { level: 1 } })],
    ['zlib niveau 9', pngSynthetique(800, 400, { couleur: [29, 65, 100, 128], zlib: { level: 9 } })],
    ['codes fixes (Z_FIXED)', pngSynthetique(64, 32, { bruit: true, zlib: { strategy: zlibConstantes.Z_FIXED } })],
    ['Huffman seul (Z_HUFFMAN_ONLY)', pngSynthetique(64, 32, { bruit: true, zlib: { strategy: zlibConstantes.Z_HUFFMAN_ONLY } })],
    ['répétitions (Z_RLE)', pngSynthetique(64, 32, { couleur: [1, 2, 3, 4], zlib: { strategy: zlibConstantes.Z_RLE } })],
    ['filtre de ligne 4 (Paeth)', pngSynthetique(16, 8, { filtre: 4 })],
    ['accessoires de longueur fixe (sRGB, gAMA, cHRM, sBIT, pHYs, bKGD)', pngSynthetique(10, 10, {
      morceaux: [accessoire('sRGB', 1), accessoire('gAMA', 4), accessoire('cHRM', 32), accessoire('sBIT', 4), accessoire('pHYs', 9), accessoire('bKGD', 6)],
    })],
    ['tRNS d’une couleur en RVB', pngSynthetique(10, 10, { typeCouleur: 2, morceaux: [accessoire('tRNS', 6)] })],
  ])('%s : accepté', (_cas, image) => {
    expect(analyserPngQr(image).ok).toBe(true)
  })

  it.each([
    ['texte libre dans iCCP (profil ICC)', pngSynthetique(64, 32, { morceaux: [{ type: 'iCCP', donnees: texteIccp }] }), 'morceau_interdit'],
    ['palette suggérée (PLTE) en RVBA', pngSynthetique(10, 10, { morceaux: [accessoire('PLTE', 9)] }), 'morceau_interdit'],
    ['tRNS en RVBA', pngSynthetique(10, 10, { morceaux: [accessoire('tRNS', 6)] }), 'morceau_interdit'],
    ['accessoire de longueur fausse (sRGB de 2 octets)', pngSynthetique(10, 10, { morceaux: [accessoire('sRGB', 2)] }), 'structure'],
    ['accessoire répété', pngSynthetique(10, 10, { morceaux: [accessoire('gAMA', 4), accessoire('gAMA', 4)] }), 'structure'],
    ['accessoire après les IDAT', pngSynthetique(10, 10, { apresIdat: [accessoire('pHYs', 9)] }), 'structure'],
    ['IDAT séparés par un accessoire', pngDeMorceaux(ihdrPng(10, 10), morceauPng('IDAT', fluxDe(10, 10).subarray(0, 5)),
      morceauPng('sRGB', new Uint8Array(1)), morceauPng('IDAT', fluxDe(10, 10).subarray(5)), morceauPng('IEND')), 'structure'],
    ['16 bits par composante', pngDeMorceaux(ihdrPng(4, 4, 16, 6), morceauPng('IDAT', fluxDe(4, 4, 8)), morceauPng('IEND')), 'structure'],
    ['entrelacé (Adam7)', pngDeMorceaux(ihdrPng(4, 4, 8, 6, 1), morceauPng('IDAT', fluxDe(4, 4)), morceauPng('IEND')), 'structure'],
    ['niveaux de gris', pngDeMorceaux(ihdrPng(4, 4, 8, 0), morceauPng('IDAT', fluxDe(4, 4, 1)), morceauPng('IEND')), 'structure'],
    ['niveaux de gris avec transparence', pngDeMorceaux(ihdrPng(4, 4, 8, 4), morceauPng('IDAT', fluxDe(4, 4, 2)), morceauPng('IEND')), 'structure'],
    ['octets après le flux zlib, dans l’IDAT', pngSynthetique(64, 32, {
      idat: Buffer.concat([fluxDe(64, 32), Buffer.from('PK\u0003\u0004<html><script>alert(1)</script></html>', 'latin1')]),
    }), 'contenu'],
    ['IDAT qui n’est pas du zlib', pngSynthetique(64, 32, { idat: Buffer.from('ceci n est pas du zlib, juste des octets', 'latin1') }), 'contenu'],
    ['IDAT vide', pngSynthetique(4, 4, { idat: new Uint8Array() }), 'contenu'],
    ['flux trop court (lignes manquantes)', pngSynthetique(64, 32, { idat: fluxDe(64, 31) }), 'contenu'],
    ['flux trop long (une ligne de trop)', pngSynthetique(64, 32, { idat: fluxDe(64, 33) }), 'contenu'],
    ['filtre de ligne inconnu (5)', pngSynthetique(16, 8, { filtre: 5 }), 'contenu'],
    ['somme Adler-32 fausse', pngSynthetique(16, 8, { idat: (() => { const f = Buffer.from(fluxDe(16, 8)); f[f.length - 1] ^= 1; return f })() }), 'contenu'],
    ['flux tronqué (sans sa somme Adler-32)', pngSynthetique(16, 8, { idat: fluxDe(16, 8).subarray(0, -4) }), 'contenu'],
  ])('%s : refusé', (_cas, image, raison) => {
    expect(analyserPngQr(image)).toEqual({ ok: false, raison })
  })

  it('bombe de décompression (800 × 400, flux de ~145 Kio qui donnerait 150 Mo) : refusée sans tout décompresser', () => {
    const bombe = pngSynthetique(800, 400, { idat: deflateSync(Buffer.alloc(150_000_000), { level: 9 }) })
    expect(bombe.length).toBeLessThan(LOGO_OCTETS_MAX_QR)
    const debut = performance.now()
    expect(analyserPngQr(bombe)).toEqual({ ok: false, raison: 'contenu' })
    expect(performance.now() - debut).toBeLessThan(500)
  })
})

describe('mêmes bornes que la contrainte de la migration 20261114', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261114_signalements_qr_logo_cabinet.sql'), 'utf-8')
  it('800 × 400 px, 204 800 octets ; base64 au plus 4/3 du poids', () => {
    expect([LOGO_LARGEUR_MAX_QR, LOGO_HAUTEUR_MAX_QR, LOGO_OCTETS_MAX_QR]).toEqual([800, 400, 204_800])
    expect(sql).toContain(`logo_largeur BETWEEN 1 AND ${LOGO_LARGEUR_MAX_QR}`)
    expect(sql).toContain(`logo_hauteur BETWEEN 1 AND ${LOGO_HAUTEUR_MAX_QR}`)
    expect(sql).toMatch(new RegExp(`octet_length\\(logo_png\\) BETWEEN \\d+ AND ${LOGO_OCTETS_MAX_QR}`))
    expect(LOGO_BASE64_MAX_QR).toBe(4 * Math.ceil(LOGO_OCTETS_MAX_QR / 3))
  })
})

describe('transport de l’image', () => {
  const png = pngSynthetique(30, 12)

  it('bytea de PostgREST (« \\x… ») ⇄ octets', () => {
    expect(byteaDepuisOctetsQr(png)).toBe(hexBytea(png))
    expect(octetsDepuisByteaQr(hexBytea(png))).toEqual(png)
    expect(octetsDepuisByteaQr(`\\X${hexBytea(png).slice(2).toUpperCase()}`)).toEqual(png)
    for (const faux of ['', '\\x', '\\x0', '\\xzz', '89504e47', 42, null, undefined]) expect(octetsDepuisByteaQr(faux)).toBeNull()
    // Décodage par table (relecture de sécurité du 13/11/2026) : chiffres hors de l'alphabet, non ASCII, espaces, préfixe.
    for (const faux of ['\\x0g', '\\x8\u00e9', '\\x\u0660\u0661', '\\x89 5', '/x8950', '\\y8950']) expect(octetsDepuisByteaQr(faux)).toBeNull()
    expect(octetsDepuisByteaQr('\\xFFaB00')).toEqual(Uint8Array.from([0xff, 0xab, 0x00]))
  })

  it('base64 ⇄ octets (corps de l’envoi, pièce jointe d’un e-mail)', () => {
    expect(base64DepuisOctetsQr(png)).toBe(base64Png(png))
    expect(octetsDepuisBase64Qr(base64Png(png))).toEqual(png)
    const grand = pngSynthetique(200, 200, { bruit: true })
    expect(octetsDepuisBase64Qr(base64DepuisOctetsQr(grand))).toEqual(grand)
    for (const faux of ['', 'abc', 'a b=', '====', '%%%%']) expect(octetsDepuisBase64Qr(faux)).toBeNull()
  })
})

describe('métadonnées et adresse de lecture', () => {
  it('ligne de la base → { version, largeur, hauteur } ; incomplète ou hors bornes → null', () => {
    expect(metaLogoDepuisLigneQr({ logo_version: '0123456789abcdef', logo_largeur: 320, logo_hauteur: 120 }))
      .toEqual({ version: '0123456789abcdef', largeur: 320, hauteur: 120 })
    for (const ligne of [
      {}, { logo_version: null, logo_largeur: null, logo_hauteur: null },
      { logo_version: '0123456789ABCDEF', logo_largeur: 320, logo_hauteur: 120 },
      { logo_version: '0123456789abcde', logo_largeur: 320, logo_hauteur: 120 },
      { logo_version: '0123456789abcdef', logo_largeur: 801, logo_hauteur: 120 },
      { logo_version: '0123456789abcdef', logo_largeur: 320, logo_hauteur: 0 },
      { logo_version: '0123456789abcdef', logo_largeur: '320', logo_hauteur: 120 },
    ]) expect(metaLogoDepuisLigneQr(ligne)).toBeNull()
  })

  it('adresse publique : identifiant du cabinet et version seulement (aucune donnée personnelle) ; barre finale', () => {
    // Site en trailingSlash (next.config.ts) : sans barre finale, chaque lecture coûterait une redirection 308.
    expect(cheminLogoCabinetQr('cabinet-exemple', '0123456789abcdef')).toBe('/api/aj-signalement/logo/cabinet-exemple/?v=0123456789abcdef')
  })
})
