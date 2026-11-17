// tests/helpers/png-synthetique.ts — images PNG SYNTHÉTIQUES pour les tests du logo d'un cabinet (AJ Signalement).
//
// Dépôt public : aucun logo ni nom de client réel dans les tests ; chaque image est fabriquée ici, octet par octet
// (signature, IHDR, IDAT compressé par zlib, IEND, CRC de chaque morceau), sans dépendre du module testé
// (lib/aj-signalement/logo.ts) : un défaut de son analyse ne peut pas se cacher dans la fabrique.
// Variantes de défaut (signature, CRC, queue après IEND, morceau de texte…) pour les cas refusés ; depuis la relecture de
// sécurité du 13/11/2026, variantes du CONTENU des IDAT (options de zlib, découpage en plusieurs IDAT, données brutes
// choisies, filtre de ligne, morceaux après les IDAT) et RVB (3 octets par pixel).

import { crc32, deflateSync, type ZlibOptions } from 'zlib'

/** Signature des 8 premiers octets de tout fichier PNG. */
export const SIGNATURE_PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export interface MorceauSynthetique {
  /** Type de 4 lettres (« tEXt », « sRGB »…). */
  type: string
  donnees?: Uint8Array
  /** Faux CRC (morceau abîmé). */
  crcFaux?: boolean
}

export interface OptionsPngSynthetique {
  /** Morceaux ajoutés entre IHDR et IDAT. */
  morceaux?: readonly MorceauSynthetique[]
  /** Octets ajoutés après IEND (fichier « polyglotte »). */
  queue?: Uint8Array
  /** Pixels pseudo-aléatoires (graine fixe) : l'image se compresse mal, pour atteindre un poids donné. */
  bruit?: boolean
  /** Couleur RGBA de chaque pixel (sans bruit) ; transparent par défaut. */
  couleur?: readonly [number, number, number, number]
  /** Type de couleur de l'IHDR (6 = RGBA, défaut). */
  typeCouleur?: number
  /** Profondeur de l'IHDR (8 par défaut). */
  profondeur?: number
  /** Supprime le morceau IEND (fichier tronqué). */
  sansFin?: boolean
  /** Options de zlib pour les données de l'image (niveau, stratégie). */
  zlib?: ZlibOptions
  /** Données des IDAT, à la place du flux zlib des pixels (contenu choisi). */
  idat?: Uint8Array
  /** Flux zlib découpé en IDAT de cette taille (un seul IDAT par défaut). */
  tailleIdat?: number
  /** Type de filtre de chaque ligne (0 par défaut). */
  filtre?: number
  /** Morceaux ajoutés entre les IDAT et IEND. */
  apresIdat?: readonly MorceauSynthetique[]
}

function morceau(type: string, donnees: Uint8Array, crcFaux = false): Buffer {
  const longueur = Buffer.alloc(4)
  longueur.writeUInt32BE(donnees.length)
  const typeEtDonnees = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(donnees)])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE((crc32(typeEtDonnees) ^ (crcFaux ? 1 : 0)) >>> 0)
  return Buffer.concat([longueur, typeEtDonnees, crc])
}

/** Un morceau PNG (longueur, type, données, CRC juste) : pour assembler une suite de morceaux choisie. */
export const morceauPng = (type: string, donnees: Uint8Array = new Uint8Array()): Buffer => morceau(type, donnees)

/** En-tête IHDR choisi (profondeur, type de couleur, entrelacement). */
export function ihdrPng(largeur: number, hauteur: number, profondeur = 8, typeCouleur = 6, entrelacement = 0): Buffer {
  const donnees = Buffer.alloc(13)
  donnees.writeUInt32BE(largeur, 0)
  donnees.writeUInt32BE(hauteur, 4)
  donnees[8] = profondeur
  donnees[9] = typeCouleur
  donnees[12] = entrelacement
  return morceau('IHDR', donnees)
}

/** Fichier PNG d'une suite de morceaux donnée (signature + morceaux, tels quels). */
export const pngDeMorceaux = (...morceaux: Buffer[]): Uint8Array<ArrayBuffer> => new Uint8Array(Buffer.concat([Buffer.from(SIGNATURE_PNG), ...morceaux]))

/** Lignes brutes d'une image unie (filtre 0) : 3 ou 4 octets par pixel. */
export function lignesBrutes(largeur: number, hauteur: number, octetsParPixel: number, valeur = 0x40): Buffer {
  const ligne = 1 + largeur * octetsParPixel
  const brut = Buffer.alloc(ligne * hauteur, valeur)
  for (let y = 0; y < hauteur; y++) brut[y * ligne] = 0
  return brut
}

/** PNG valide (par défaut) de largeur × hauteur pixels, RGBA 8 bits, non entrelacé. */
export function pngSynthetique(largeur: number, hauteur: number, options: OptionsPngSynthetique = {}): Uint8Array<ArrayBuffer> {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largeur, 0)
  ihdr.writeUInt32BE(hauteur, 4)
  ihdr[8] = options.profondeur ?? 8
  ihdr[9] = options.typeCouleur ?? 6
  // RVB (type 2) : 3 octets par pixel ; tous les autres types : 4 (seuls les cas refusés en utilisent d'autres).
  const octetsParPixel = ihdr[9] === 2 ? 3 : 4
  const ligne = 1 + largeur * octetsParPixel
  const brut = Buffer.alloc(ligne * hauteur)
  let graine = 0x2545f491
  const [r, v, b, a] = options.couleur ?? [0, 0, 0, 0]
  for (let y = 0; y < hauteur; y++) {
    brut[y * ligne] = options.filtre ?? 0
    for (let x = 0; x < largeur; x++) {
      const i = y * ligne + 1 + x * octetsParPixel
      if (options.bruit) {
        for (let k = 0; k < octetsParPixel; k++) {
          graine = (Math.imul(graine, 1103515245) + 12345) >>> 0
          brut[i + k] = graine >>> 24
        }
      } else {
        brut[i] = r
        brut[i + 1] = v
        brut[i + 2] = b
        if (octetsParPixel === 4) brut[i + 3] = a
      }
    }
  }
  const parties: Buffer[] = [Buffer.from(SIGNATURE_PNG), morceau('IHDR', ihdr)]
  for (const m of options.morceaux ?? []) parties.push(morceau(m.type, m.donnees ?? new Uint8Array(), m.crcFaux))
  const flux = options.idat ?? deflateSync(brut, options.zlib)
  const taille = options.tailleIdat ?? Math.max(1, flux.length)
  for (let debut = 0; debut < flux.length || debut === 0; debut += taille) parties.push(morceau('IDAT', flux.subarray(debut, debut + taille)))
  for (const m of options.apresIdat ?? []) parties.push(morceau(m.type, m.donnees ?? new Uint8Array(), m.crcFaux))
  if (!options.sansFin) parties.push(morceau('IEND', new Uint8Array()))
  if (options.queue) parties.push(Buffer.from(options.queue))
  return new Uint8Array(Buffer.concat(parties))
}

/** Copie de l'image avec un octet remplacé (signature abîmée, dimension changée…). */
export function avecOctet(png: Uint8Array, position: number, valeur: number): Uint8Array<ArrayBuffer> {
  const copie = Uint8Array.from(png)
  copie[position] = valeur
  return copie
}

/** Texte hexadécimal d'une image, au format bytea de PostgREST (« \x89504e47… »). */
export const hexBytea = (octets: Uint8Array): string => `\\x${Buffer.from(octets).toString('hex')}`

/** Base64 d'une image (corps de l'envoi du logo). */
export const base64Png = (octets: Uint8Array): string => Buffer.from(octets).toString('base64')
