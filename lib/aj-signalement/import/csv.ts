// ── AJ Signalement : lecture d'un fichier CSV d'import (navigateur ; pur, sans bibliothèque) ─────────────────────
//
// SPEC § 1.9.4 : séparateur détecté sur la première ligne (detecterSeparateurCsv, partagé avec l'import de l'AJ) ;
// découpage RFC 4180 sur TOUT le texte, pas ligne à ligne : une adresse saisie sur deux lignes dans Excel est une seule
// cellule entre guillemets (decouperLigneCsv, qui travaille ligne par ligne, la casserait en deux enregistrements) ;
// BOM retiré ; UTF-8 strict (TextDecoder fatal), puis windows-1252 en cas d'échec (Excel « CSV (séparateur : point-
// virgule) ») ; UTF-16 reconnu par son BOM (« Texte Unicode »). Au plus 2 000 lignes et 30 colonnes lues. Le fichier
// n'est ni envoyé ni conservé : ces fonctions rendent des cellules en texte.

import { detecterSeparateurCsv } from '@/lib/administrateur-judiciaire/domain/import/csv'
import { COLONNES_LUES_MAX_QR, LIGNES_LUES_MAX_QR, TAILLE_FICHIER_IMPORT_MAX_QR } from '@/lib/aj-signalement/import/ligne'
import type { LectureTableurQr } from '@/lib/aj-signalement/types'

/**
 * Octets 0x80 à 0x9F de windows-1252 (table WHATWG : € ‚ ƒ „ … † ‡ ˆ ‰ Š ‹ Œ Ž ‘ ’ “ ” • – — ˜ ™ š › œ ž Ÿ) ; les
 * autres octets valent leur point de code (latin-1). Décodé ici plutôt que par TextDecoder('windows-1252'), que certains
 * moteurs JavaScript lisent comme du latin-1 (l'apostrophe typographique ’ et le « € » y seraient perdus).
 */
const WINDOWS_1252_80_9F = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
]

function decoderWindows1252(octets: Uint8Array): string {
  const morceaux: string[] = []
  for (let debut = 0; debut < octets.length; debut += 8192) {
    const codes = Array.from(octets.subarray(debut, debut + 8192), (o) => (o >= 0x80 && o <= 0x9f ? WINDOWS_1252_80_9F[o - 0x80] : o))
    morceaux.push(String.fromCharCode(...codes))
  }
  return morceaux.join('')
}

/** Texte d'un fichier : BOM UTF-8 retiré ; UTF-8 strict, sinon windows-1252 ; UTF-16 (LE ou BE) d'après son BOM. */
export function decoderTexteImportQr(octets: Uint8Array): string {
  if (octets.length >= 2 && octets[0] === 0xff && octets[1] === 0xfe) return new TextDecoder('utf-16le').decode(octets.subarray(2))
  if (octets.length >= 2 && octets[0] === 0xfe && octets[1] === 0xff) return new TextDecoder('utf-16be').decode(octets.subarray(2))
  const sansBom = octets.length >= 3 && octets[0] === 0xef && octets[1] === 0xbb && octets[2] === 0xbf ? octets.subarray(3) : octets
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(sansBom)
  } catch (e) {
    // Octets hors UTF-8 : fichier enregistré par Excel en « windows-1252 » (é = 0xE9). Relecture, rien n'est perdu.
    if (!(e instanceof TypeError)) throw e
    return decoderWindows1252(sansBom)
  }
}

/**
 * Découpage RFC 4180 : guillemets doublés échappés, séparateur et retours à la ligne (CRLF, LF, CR) gardés dans une
 * cellule entre guillemets ; pas d'enregistrement vide final. Cellules non rognées (la normalisation le fait).
 */
export function decouperCsvQr(texte: string, separateur?: string): { lignes: string[][]; tronque: boolean } {
  const sep = separateur ?? detecterSeparateurCsv(texte.split(/\r\n|\n|\r/, 1)[0] ?? '')
  const lignes: string[][] = []
  let ligne: string[] = []
  let cellule = ''
  let entreGuillemets = false
  let tronque = false
  const finCellule = () => {
    if (ligne.length < COLONNES_LUES_MAX_QR) ligne.push(cellule)
    else tronque = true
    cellule = ''
  }
  const finLigne = (): boolean => {
    finCellule()
    lignes.push(ligne)
    ligne = []
    if (lignes.length >= LIGNES_LUES_MAX_QR) return false
    return true
  }
  let i = 0
  for (; i < texte.length; i++) {
    const c = texte[i]
    if (entreGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') { cellule += '"'; i++ } else entreGuillemets = false
      } else cellule += c
      continue
    }
    if (c === '"' && cellule === '') entreGuillemets = true
    else if (c === sep) finCellule()
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && texte[i + 1] === '\n') i++
      if (!finLigne()) { i++; break }
    } else cellule += c
  }
  if (lignes.length >= LIGNES_LUES_MAX_QR) {
    if (i < texte.length && texte.slice(i).trim() !== '') tronque = true
  } else if (cellule !== '' || ligne.length > 0 || entreGuillemets) {
    finLigne()
  }
  return { lignes, tronque }
}

/** Fichier CSV choisi → cellules (une seule « feuille », sans nom). */
export function lireCsvQr(octets: Uint8Array): LectureTableurQr {
  if (octets.length > TAILLE_FICHIER_IMPORT_MAX_QR) return { ok: false, code: 'trop_gros' }
  const texte = decoderTexteImportQr(octets)
  if (texte.trim() === '') return { ok: false, code: 'vide' }
  const { lignes, tronque } = decouperCsvQr(texte)
  return { ok: true, feuilles: [], feuille: null, lignes, avertissements: [], tronque }
}
