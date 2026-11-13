// tests/lib/aj-signalement-zlib-borne.test.ts
//
// Décompression zlib bornée et stricte du logo d'un cabinet (lib/aj-signalement/zlib-borne.ts ; relecture de sécurité
// du 13/11/2026). Comparée au zlib de Node, qui sert de référence :
//   - tout flux produit par zlib (niveaux 0 à 9, stratégies, données unies, bruitées, vides) est rendu à l'identique ;
//   - flux abîmés au hasard (graine fixe) : jamais d'exception, et chaque flux accepté l'est aussi par zlib, avec les
//     mêmes octets (aucune lecture plus permissive que zlib) ;
//   - taille exacte, rien après la somme Adler-32, en-tête, dictionnaire, blocs stockés, distances : refus ;
//   - bombe : la lecture s'arrête à la taille attendue.
// Données synthétiques seulement.

import { describe, expect, it } from 'vitest'
import { constants as Z, deflateRawSync, deflateSync, inflateSync } from 'zlib'
import { adler32Qr, decompresserZlibBorneQr } from '@/lib/aj-signalement/zlib-borne'

/** Générateur pseudo-aléatoire à graine fixe (reproductible). */
function hasard(graine: number): () => number {
  let s = graine >>> 0
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    return s >>> 8
  }
}

function donnees(taille: number, graine: number, alphabet = 256): Buffer {
  const h = hasard(graine)
  const b = Buffer.alloc(taille)
  for (let i = 0; i < taille; i++) b[i] = h() % alphabet
  return b
}

/** Données « de logo » : longues plages unies et quelques motifs répétés (distances courtes et longues). */
function plages(taille: number, graine: number): Buffer {
  const h = hasard(graine)
  const b = Buffer.alloc(taille)
  for (let i = 0; i < taille;) {
    const n = 1 + (h() % 300)
    const v = h() % 256
    if (h() % 4 === 0 && i > 40_000) b.copy(b, i, i - 40_000, Math.min(taille, i - 40_000 + n))
    else b.fill(v, i, Math.min(taille, i + n))
    i += n
  }
  return b
}

const zlibAccepte = (flux: Uint8Array): Buffer | null => {
  try {
    return inflateSync(flux)
  } catch {
    // Référence : zlib refuse ce flux (attendu pour une partie des flux abîmés).
    return null
  }
}

describe('decompresserZlibBorneQr : flux produits par zlib rendus à l’identique', () => {
  const sources: Array<[string, Buffer]> = [
    ['vide', Buffer.alloc(0)],
    ['un octet', Buffer.from([7])],
    ['uni de 1,28 Mo', Buffer.alloc(1_280_400, 0x1d)],
    ['bruité de 64 Kio', donnees(65_536, 1)],
    ['petit alphabet de 100 Kio', donnees(100_000, 2, 4)],
    ['plages et motifs de 300 Kio', plages(300_000, 3)],
  ]
  const reglages: Array<[string, Parameters<typeof deflateSync>[1]]> = [
    ['niveau 0', { level: 0 }], ['niveau 1', { level: 1 }], ['niveau 6', { level: 6 }], ['niveau 9', { level: 9 }],
    ['Z_FIXED', { strategy: Z.Z_FIXED }], ['Z_HUFFMAN_ONLY', { strategy: Z.Z_HUFFMAN_ONLY }], ['Z_RLE', { strategy: Z.Z_RLE }],
    ['Z_FILTERED', { strategy: Z.Z_FILTERED }], ['fenêtre de 512 octets', { windowBits: 9 }], ['mémoire minimale', { memLevel: 1 }],
  ]
  for (const [nomSource, source] of sources) {
    it.each(reglages)(`${nomSource}, %s`, (_reglage, options) => {
      const flux = deflateSync(source, options)
      const sortie = decompresserZlibBorneQr(flux, source.length)
      expect(sortie).not.toBeNull()
      expect(Buffer.from(sortie as Uint8Array).equals(source)).toBe(true)
    })
  }
})

describe('decompresserZlibBorneQr : bornes et fin du flux', () => {
  const source = plages(50_000, 9)
  const flux = deflateSync(source)

  it('taille attendue plus petite ou plus grande que le contenu : refus', () => {
    expect(decompresserZlibBorneQr(flux, source.length - 1)).toBeNull()
    expect(decompresserZlibBorneQr(flux, source.length + 1)).toBeNull()
    expect(decompresserZlibBorneQr(flux, 0)).toBeNull()
  })

  it('un octet, ou un flux zlib entier, après la somme Adler-32 : refus', () => {
    expect(decompresserZlibBorneQr(Buffer.concat([flux, Buffer.from([0])]), source.length)).toBeNull()
    expect(decompresserZlibBorneQr(Buffer.concat([flux, deflateSync(Buffer.alloc(0))]), source.length)).toBeNull()
  })

  it('somme Adler-32 fausse, absente ou tronquée : refus', () => {
    const faux = Buffer.from(flux)
    faux[faux.length - 2] ^= 0x10
    expect(decompresserZlibBorneQr(faux, source.length)).toBeNull()
    expect(decompresserZlibBorneQr(flux.subarray(0, -4), source.length)).toBeNull()
    expect(decompresserZlibBorneQr(flux.subarray(0, -1), source.length)).toBeNull()
  })

  it('en-tête : autre méthode, fenêtre trop grande, somme de l’en-tête fausse, dictionnaire, deflate brut : refus', () => {
    const avec = (cmf: number, flg: number) => Buffer.concat([Buffer.from([cmf, flg]), flux.subarray(2)])
    expect(decompresserZlibBorneQr(avec(0x79, 0x9c - 3), source.length)).toBeNull()
    expect(decompresserZlibBorneQr(avec(0x88, 0x1c), source.length)).toBeNull()
    expect(decompresserZlibBorneQr(avec(0x78, 0x9d), source.length)).toBeNull()
    expect(decompresserZlibBorneQr(deflateSync(source, { dictionary: Buffer.from('dictionnaire') }), source.length)).toBeNull()
    expect(decompresserZlibBorneQr(deflateRawSync(source), source.length)).toBeNull()
  })

  it('bloc stocké dont NLEN n’est pas le complément de LEN : refus', () => {
    const stocke = Buffer.from(deflateSync(Buffer.from('abcdef'), { level: 0 }))
    // Octet 2 : BFINAL + type 0 ; 3-4 : LEN ; 5-6 : NLEN.
    stocke[5] ^= 1
    expect(decompresserZlibBorneQr(stocke, 6)).toBeNull()
  })

  it('distance qui remonte avant le début de la sortie : refus', () => {
    // Bloc à codes fixes : symbole 257 (longueur 3) puis distance 0 (1 octet en arrière) sur une sortie vide.
    // Bits (poids faible d'abord) : BFINAL=1, type=01, code 257 = 0000001 (7 bits), distance 0 = 00000 (5 bits), fin 256.
    const bits = [1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const octets = Buffer.alloc(Math.ceil(bits.length / 8))
    bits.forEach((b, i) => { octets[i >> 3] |= b << (i & 7) })
    const corps = Buffer.concat([Buffer.from([0x78, 0x01]), octets, Buffer.alloc(4)])
    expect(decompresserZlibBorneQr(corps, 3)).toBeNull()
  })

  it('bombe : 150 Mo de zéros compressés, taille attendue de 1,28 Mo : refus rapide (lecture arrêtée à la borne)', () => {
    const bombe = deflateSync(Buffer.alloc(150_000_000), { level: 9 })
    const debut = performance.now()
    expect(decompresserZlibBorneQr(bombe, 1_280_400)).toBeNull()
    expect(performance.now() - debut).toBeLessThan(500)
  })

  it('taille attendue invalide (négative, fractionnaire) : refus sans lecture', () => {
    expect(decompresserZlibBorneQr(flux, -1)).toBeNull()
    expect(decompresserZlibBorneQr(flux, 1.5)).toBeNull()
  })
})

describe('decompresserZlibBorneQr : flux abîmés au hasard, comparés à zlib', () => {
  it('2 000 flux abîmés : aucune exception, et tout flux accepté l’est par zlib avec les mêmes octets', () => {
    const h = hasard(42)
    const bases = [deflateSync(plages(20_000, 5)), deflateSync(donnees(3000, 6, 16), { strategy: Z.Z_FIXED }), deflateSync(Buffer.alloc(5000, 3), { level: 0 })]
    let acceptes = 0
    for (let essai = 0; essai < 2000; essai++) {
      const base = bases[essai % bases.length]
      const flux = Buffer.from(base)
      const nombre = 1 + (h() % 3)
      for (let k = 0; k < nombre; k++) flux[2 + (h() % (flux.length - 2))] ^= 1 << (h() % 8)
      const attendu = inflateSync(base).length
      const sortie = decompresserZlibBorneQr(flux, attendu)
      if (sortie) {
        acceptes++
        const reference = zlibAccepte(flux)
        expect(reference).not.toBeNull()
        expect(Buffer.from(sortie).equals(reference as Buffer)).toBe(true)
      }
    }
    // Quelques flux abîmés restent valides (bit d'un littéral changé et somme rattrapée : rarissime) ; la plupart sont refusés.
    expect(acceptes).toBeLessThan(50)
  })

  it('octets quelconques (2 000 essais) : aucune exception', () => {
    const h = hasard(7)
    for (let essai = 0; essai < 2000; essai++) {
      const flux = donnees(6 + (h() % 300), essai)
      flux[0] = 0x78
      flux[1] = 0x9c
      expect(() => decompresserZlibBorneQr(flux, h() % 5000)).not.toThrow()
    }
  })
})

describe('adler32Qr', () => {
  it('valeurs de référence (RFC 1950) et longues données (sommes repliées tous les 2 048 octets)', () => {
    expect(adler32Qr(new Uint8Array())).toBe(1)
    expect(adler32Qr(Buffer.from('Wikipedia', 'ascii'))).toBe(0x11e60398)
    const long = Buffer.alloc(1_000_000, 0xff)
    const flux = deflateSync(long)
    expect(adler32Qr(long)).toBe(flux.readUInt32BE(flux.length - 4))
  })
})
