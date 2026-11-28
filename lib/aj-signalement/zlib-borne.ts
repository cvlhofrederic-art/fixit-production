// ── Décompression zlib BORNÉE et STRICTE (logo d'un cabinet, AJ Signalement) ─────────────────────────────────────────
//
// Relecture de sécurité du 13/11/2026 : la revérification du logo (lib/aj-signalement/logo.ts, analyserPngQr) ne
// regardait que la forme du PNG ; le contenu de ses morceaux IDAT (un flux zlib, RFC 1950 et 1951) pouvait porter des
// octets cachés après la fin du flux, ne pas être du zlib du tout (jsPDF ne pouvait plus faire l'affiche), ou se
// décompresser en 150 Mo (« bombe »). Ce module lit ce flux avec les règles de zlib et des bornes :
//   - en-tête zlib : méthode 8 (deflate), fenêtre de 32 Kio au plus, somme de contrôle de l'en-tête, aucun dictionnaire ;
//   - blocs stockés (LEN = complément de NLEN), à codes fixes ou dynamiques (codes de Huffman ni sur-remplis, ni
//     incomplets — sauf un code unique d'un bit, comme zlib —, code de fin de bloc présent, symboles et distances dans
//     la norme, aucune distance qui remonte avant le début) ;
//   - taille EXACTE attendue (celle que l'en-tête IHDR impose) : la lecture s'arrête dès qu'un octet de plus serait
//     produit (une bombe coûte au plus la taille attendue, jamais plus) ;
//   - somme Adler-32 juste, et RIEN après elle.
// Module pur, sans dépendance (navigateur, serveur, Workers), synchrone ; ne lève jamais : null au moindre écart.

const BITS_MAX = 15

/** Ordre des longueurs des codes de longueurs (RFC 1951, § 3.2.7). */
const ORDRE_LONGUEURS = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15] as const
const BASE_LONGUEUR = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258] as const
const EXTRA_LONGUEUR = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0] as const
const BASE_DISTANCE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193,
  12289, 16385, 24577,
] as const
const EXTRA_DISTANCE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13] as const

/** Table de décodage : index = bits lus (poids faible d'abord), entrée = symbole × 16 + longueur du code ; 0 : invalide. */
interface TableHuffman {
  table: Uint16Array
  bits: number
}

/** Flux illisible ou hors des bornes : interrompt la lecture (attrapé par decompresserZlibBorneQr, jamais au-delà). */
class FluxRefuse extends Error {}

/**
 * Table d'un code de Huffman canonique d'après les longueurs des symboles debut … debut + n − 1 ; null : code
 * sur-rempli, ou incomplet (admis seulement pour un code unique d'un bit, et jamais pour les codes de longueurs — règle
 * de zlib, inflate_table). Aucun code : table vide (tout décodage est refusé).
 */
function tableHuffman(longueurs: Uint8Array, debut: number, n: number, codesDeLongueurs: boolean): TableHuffman | null {
  const compte = new Uint16Array(BITS_MAX + 1)
  let max = 0
  for (let s = 0; s < n; s++) {
    const l = longueurs[debut + s]
    compte[l]++
    if (l > max) max = l
  }
  const table = new Uint16Array(1 << Math.max(1, max))
  if (max === 0) return { table, bits: 1 }
  let reste = 1
  for (let l = 1; l <= BITS_MAX; l++) {
    reste = (reste << 1) - compte[l]
    if (reste < 0) return null
  }
  if (reste > 0 && (codesDeLongueurs || max !== 1)) return null
  const prochain = new Uint16Array(BITS_MAX + 2)
  let code = 0
  compte[0] = 0
  for (let l = 1; l <= BITS_MAX; l++) {
    code = (code + compte[l - 1]) << 1
    prochain[l] = code
  }
  for (let s = 0; s < n; s++) {
    const l = longueurs[debut + s]
    if (l === 0) continue
    const c = prochain[l]++
    // Le code se lit du bit de poids fort ; le flux, du bit de poids faible : index = code renversé.
    let renverse = 0
    for (let k = 0; k < l; k++) renverse |= ((c >> k) & 1) << (l - 1 - k)
    const entree = (s << 4) | l
    for (let i = renverse; i < table.length; i += 1 << l) table[i] = entree
  }
  return { table, bits: max }
}

let tablesFixes: { litterales: TableHuffman; distances: TableHuffman } | null = null

/** Codes fixes (RFC 1951, § 3.2.6) : 288 symboles de longueur 7 à 9 ; 32 distances de 5 bits (30 et 31 refusées). */
function codesFixes(): { litterales: TableHuffman; distances: TableHuffman } {
  if (!tablesFixes) {
    const l = new Uint8Array(288)
    l.fill(8, 0, 144)
    l.fill(9, 144, 256)
    l.fill(7, 256, 280)
    l.fill(8, 280, 288)
    const litterales = tableHuffman(l, 0, 288, false)
    const distances = tableHuffman(new Uint8Array(32).fill(5), 0, 32, false)
    if (!litterales || !distances) throw new Error('codes fixes invalides')
    tablesFixes = { litterales, distances }
  }
  return tablesFixes
}

/**
 * Adler-32 (RFC 1950) des `n` premiers octets. Sommes repliées tous les 2 048 octets (et non 5 552 comme zlib en C) :
 * elles restent ainsi sous 2³⁰, entiers que le moteur JavaScript calcule sans passer en flottants (6 fois plus vite).
 */
export function adler32Qr(octets: Uint8Array, n = octets.length): number {
  let a = 1
  let b = 0
  for (let i = 0; i < n;) {
    const fin = Math.min(n, i + 2048)
    for (; i < fin; i++) {
      a += octets[i]
      b += a
    }
    a %= 65521
    b %= 65521
  }
  return ((b << 16) | a) >>> 0
}

/** Lecture du flux bit à bit, poids faible d'abord ; au-delà de la fin des données : FluxRefuse. */
class LecteurBitsQr {
  position = 16
  private readonly total: number

  constructor(private readonly octets: Uint8Array) {
    this.total = octets.length * 8
  }

  /** 24 bits à partir de la position (0 au-delà de la fin : la position est contrôlée ensuite). */
  private fenetre(): number {
    const o = this.position >> 3
    const d = this.octets
    const n = d.length
    return ((o < n ? d[o] : 0) | (o + 1 < n ? d[o + 1] << 8 : 0) | (o + 2 < n ? d[o + 2] << 16 : 0)) >>> (this.position & 7)
  }

  /** `n` bits (16 au plus). */
  lire(n: number): number {
    const v = this.fenetre() & ((1 << n) - 1)
    this.position += n
    if (this.position > this.total) throw new FluxRefuse()
    return v
  }

  /** Symbole suivant d'un code de Huffman. */
  symbole(h: TableHuffman): number {
    const entree = h.table[this.fenetre() & ((1 << h.bits) - 1)]
    if (entree === 0) throw new FluxRefuse()
    this.position += entree & 15
    if (this.position > this.total) throw new FluxRefuse()
    return entree >> 4
  }

  /** Aller au début de l'octet suivant (s'il n'y est pas déjà) ; rend l'index de cet octet. */
  octetSuivant(): number {
    this.position = (this.position + 7) & ~7
    return this.position >> 3
  }
}

/** Bloc à codes de Huffman (fixes ou dynamiques) écrit dans `sortie` à partir de `produits` ; rend la nouvelle fin. */
function blocHuffmanQr(lecteur: LecteurBitsQr, sortie: Uint8Array, depart: number, litterales: TableHuffman, distances: TableHuffman): number {
  const taille = sortie.length
  let produits = depart
  for (;;) {
    const s = lecteur.symbole(litterales)
    if (s < 256) {
      if (produits >= taille) throw new FluxRefuse()
      sortie[produits++] = s
    } else if (s === 256) {
      return produits
    } else {
      const k = s - 257
      if (k >= 29) throw new FluxRefuse()
      const longueur = BASE_LONGUEUR[k] + lecteur.lire(EXTRA_LONGUEUR[k])
      const d = lecteur.symbole(distances)
      if (d >= 30) throw new FluxRefuse()
      const distance = BASE_DISTANCE[d] + lecteur.lire(EXTRA_DISTANCE[d])
      const fin = produits + longueur
      if (distance > produits || fin > taille) throw new FluxRefuse()
      if (distance >= longueur) {
        sortie.copyWithin(produits, produits - distance, fin - distance)
        produits = fin
      } else {
        for (; produits < fin; produits++) sortie[produits] = sortie[produits - distance]
      }
    }
  }
}

/** Codes d'un bloc dynamique (RFC 1951, § 3.2.7) : tables des littéraux et longueurs, et des distances. */
function codesDynamiquesQr(lecteur: LecteurBitsQr): { litterales: TableHuffman; distances: TableHuffman } {
  const nLitterales = lecteur.lire(5) + 257
  const nDistances = lecteur.lire(5) + 1
  const nCodes = lecteur.lire(4) + 4
  if (nLitterales > 286 || nDistances > 30) throw new FluxRefuse()
  const longueursCodes = new Uint8Array(19)
  for (let i = 0; i < nCodes; i++) longueursCodes[ORDRE_LONGUEURS[i]] = lecteur.lire(3)
  const codes = tableHuffman(longueursCodes, 0, 19, true)
  if (!codes) throw new FluxRefuse()
  const total = nLitterales + nDistances
  const longueurs = new Uint8Array(total)
  for (let i = 0; i < total;) {
    const s = lecteur.symbole(codes)
    if (s < 16) {
      longueurs[i++] = s
      continue
    }
    let valeur = 0
    let repetitions: number
    if (s === 16) {
      if (i === 0) throw new FluxRefuse()
      valeur = longueurs[i - 1]
      repetitions = 3 + lecteur.lire(2)
    } else if (s === 17) {
      repetitions = 3 + lecteur.lire(3)
    } else {
      repetitions = 11 + lecteur.lire(7)
    }
    if (i + repetitions > total) throw new FluxRefuse()
    longueurs.fill(valeur, i, i + repetitions)
    i += repetitions
  }
  // Code de fin de bloc obligatoire (zlib : « missing end-of-block »).
  if (longueurs[256] === 0) throw new FluxRefuse()
  const litterales = tableHuffman(longueurs, 0, nLitterales, false)
  const distances = tableHuffman(longueurs, nLitterales, nDistances, false)
  if (!litterales || !distances) throw new FluxRefuse()
  return { litterales, distances }
}

/** Blocs du flux, jusqu'au dernier ; rend le nombre d'octets produits et l'index de l'octet qui suit le dernier bloc. */
function blocsQr(lecteur: LecteurBitsQr, donnees: Uint8Array, sortie: Uint8Array): { produits: number; suite: number } {
  let produits = 0
  let dernier = 0
  do {
    dernier = lecteur.lire(1)
    const type = lecteur.lire(2)
    if (type === 0) {
      const o = lecteur.octetSuivant()
      if (o + 4 > donnees.length) throw new FluxRefuse()
      const longueur = donnees[o] | (donnees[o + 1] << 8)
      if ((longueur ^ 0xffff) !== (donnees[o + 2] | (donnees[o + 3] << 8))) throw new FluxRefuse()
      if (o + 4 + longueur > donnees.length || produits + longueur > sortie.length) throw new FluxRefuse()
      sortie.set(donnees.subarray(o + 4, o + 4 + longueur), produits)
      produits += longueur
      lecteur.position = (o + 4 + longueur) * 8
    } else if (type === 1) {
      const fixes = codesFixes()
      produits = blocHuffmanQr(lecteur, sortie, produits, fixes.litterales, fixes.distances)
    } else if (type === 2) {
      const dynamiques = codesDynamiquesQr(lecteur)
      produits = blocHuffmanQr(lecteur, sortie, produits, dynamiques.litterales, dynamiques.distances)
    } else {
      throw new FluxRefuse()
    }
  } while (!dernier)
  return { produits, suite: lecteur.octetSuivant() }
}

/**
 * Flux zlib `donnees` → ses `tailleAttendue` octets décompressés, ou null : en-tête, blocs, codes, distances, taille
 * (ni plus, ni moins), Adler-32 ou fin du flux (rien après la somme) hors des règles. Ne lève sur aucun flux.
 */
export function decompresserZlibBorneQr(donnees: Uint8Array, tailleAttendue: number): Uint8Array<ArrayBuffer> | null {
  if (!Number.isInteger(tailleAttendue) || tailleAttendue < 0 || donnees.length < 6) return null
  const cmf = donnees[0]
  const flg = donnees[1]
  if ((cmf & 0x0f) !== 8 || cmf >> 4 > 7 || ((cmf << 8) | flg) % 31 !== 0 || (flg & 0x20) !== 0) return null

  const sortie = new Uint8Array(tailleAttendue)
  let fin: { produits: number; suite: number }
  try {
    fin = blocsQr(new LecteurBitsQr(donnees), donnees, sortie)
  } catch (e) {
    // Flux refusé (FluxRefuse) : null ; toute autre erreur serait une erreur de programmation, remontée telle quelle.
    if (e instanceof FluxRefuse) return null
    throw e
  }
  // Fin du flux : à l'octet suivant le dernier bloc, Adler-32 (gros-boutiste), puis plus rien.
  const o = fin.suite
  if (fin.produits !== tailleAttendue || o + 4 !== donnees.length) return null
  const somme = ((donnees[o] << 24) | (donnees[o + 1] << 16) | (donnees[o + 2] << 8) | donnees[o + 3]) >>> 0
  return somme === adler32Qr(sortie) ? sortie : null
}
