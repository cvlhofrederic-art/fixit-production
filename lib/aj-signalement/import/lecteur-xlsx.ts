// ── AJ Signalement : lecteur de classeur Excel (.xlsx) pour l'import des copropriétés (NAVIGATEUR seulement) ────
//
// SPEC § 1.9.2 et § 1.9.4. fflate 0.8.3 (déjà en production, dépendance de jsPDF) est chargé par await import() au moment
// où le super admin choisit un fichier : jamais dans le bundle du Worker ni dans le premier chargement de l'espace. Ce
// module n'est lui-même importé que par await import() (components/aj-signalement/AssistantImportQr.tsx).
//   - unzipSync avec filtre : seuls xl/workbook.xml, xl/_rels/workbook.xml.rels, xl/sharedStrings.xml et la feuille
//     choisie sont décompressés ; la taille ANNONCÉE de chaque entrée est contrôlée avant (10 Mo par entrée, 30 Mo au
//     total) : bombe ZIP refusée. Une taille annoncée mensongère ne fait pas grossir la mémoire (fflate écrit dans un
//     tampon de la taille annoncée), le XML tronqué est alors illisible ;
//   - XML par DOMParser (aucune entité externe chargée) ; cellules : chaînes partagées (texte riche concaténé, sans la
//     phonétique), inlineStr, str, nombres, booléens ; formules : valeur en cache <v>, jamais évaluées ; cellules
//     fusionnées : avertissement ; au plus 2 000 lignes et 30 colonnes lues ;
//   - ancien format .xls et classeur protégé (conteneur OLE) : refusés (« enregistrez une copie en .xlsx ou CSV »).
// Aucun texte de la bibliothèque n'atteint l'écran : un code seulement.

import { COLONNES_LUES_MAX_QR, LIGNES_LUES_MAX_QR, TAILLE_FICHIER_IMPORT_MAX_QR } from '@/lib/aj-signalement/import/ligne'
import type { FeuilleClasseurQr, LectureTableurQr } from '@/lib/aj-signalement/types'

/** Taille décompressée annoncée d'une entrée lue, et de toutes les entrées lues ensemble. */
export const TAILLE_ENTREE_XLSX_MAX_QR = 10 * 1024 * 1024
export const TAILLE_TOTALE_XLSX_MAX_QR = 30 * 1024 * 1024

const CLASSEUR = 'xl/workbook.xml'
const RELATIONS = 'xl/_rels/workbook.xml.rels'
const CHAINES = 'xl/sharedStrings.xml'

/** Nature d'un fichier d'après ses premiers octets : archive ZIP (.xlsx), conteneur OLE (.xls, classeur protégé), autre. */
export function natureFichierImportQr(octets: Uint8Array): 'zip' | 'ole' | 'autre' {
  if (octets.length >= 4 && octets[0] === 0x50 && octets[1] === 0x4b && octets[2] === 0x03 && octets[3] === 0x04) return 'zip'
  if (octets.length >= 8 && [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((o, i) => octets[i] === o)) return 'ole'
  return 'autre'
}

class BombeZipQr extends Error {}

type Fichiers = Record<string, Uint8Array>
type Decompresser = typeof import('fflate').unzipSync

/**
 * Inventaire de l'archive SANS rien décompresser (le filtre refuse tout) : taille annoncée de chaque entrée, et nombre
 * d'occurrences de chaque nom (une entrée répétée serait décompressée autant de fois : refusée).
 */
function inventaire(unzipSync: Decompresser, octets: Uint8Array): { tailles: Map<string, number>; repetees: Set<string> } {
  const tailles = new Map<string, number>()
  const repetees = new Set<string>()
  unzipSync(octets, {
    filter: (entree) => {
      if (tailles.has(entree.name)) repetees.add(entree.name)
      tailles.set(entree.name, entree.originalSize)
      return false
    },
  })
  return { tailles, repetees }
}

/** Décompresse ces entrées si leurs tailles annoncées, et celles déjà lues, restent sous les bornes ; sinon bombe ZIP. */
function extraire(
  unzipSync: Decompresser, octets: Uint8Array, archive: ReturnType<typeof inventaire>, voulues: readonly string[], dejaLues: readonly string[],
): Fichiers {
  const taille = (nom: string) => archive.tailles.get(nom) ?? 0
  if (voulues.some((nom) => archive.repetees.has(nom) || taille(nom) > TAILLE_ENTREE_XLSX_MAX_QR)) throw new BombeZipQr()
  if ([...dejaLues, ...voulues].reduce((somme, nom) => somme + taille(nom), 0) > TAILLE_TOTALE_XLSX_MAX_QR) throw new BombeZipQr()
  return unzipSync(octets, { filter: (entree) => voulues.includes(entree.name) })
}

function xml(octets: Uint8Array | undefined): Document | null {
  if (!octets) return null
  const doc = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(octets), 'application/xml')
  return doc.getElementsByTagName('parsererror').length > 0 ? null : doc
}

/** Éléments d'un nom local, quel que soit l'espace de noms (préfixé ou non). */
const elements = (racine: Document | Element, nom: string): Element[] => Array.from(racine.getElementsByTagNameNS('*', nom))
const enfants = (parent: Element, nom: string): Element[] => Array.from(parent.children).filter((e) => e.localName === nom)

/** Vrai si l'élément est dans une partie phonétique <rPh> de la chaîne `racine`. */
function dansPhonetique(t: Element, racine: Element): boolean {
  for (let e = t.parentElement; e && e !== racine; e = e.parentElement) if (e.localName === 'rPh') return true
  return false
}

/** Texte d'une chaîne riche (<si> ou <is>) : les <t> des parties <r> (ou le <t> direct), sans la phonétique <rPh>. */
function texteRiche(element: Element): string {
  return elements(element, 't').filter((t) => !dansPhonetique(t, element)).map((t) => t.textContent ?? '').join('')
}

/** « AB12 » → colonne 27 (index à partir de 0) ; null si la référence est illisible. */
function colonneDeReference(reference: string): number | null {
  const m = /^([A-Z]{1,3})\d+$/.exec(reference)
  if (!m) return null
  let n = 0
  for (const lettre of m[1]) n = n * 26 + (lettre.charCodeAt(0) - 64)
  return n - 1
}

function valeurCellule(c: Element, chaines: readonly string[]): string {
  const type = c.getAttribute('t') ?? 'n'
  const v = enfants(c, 'v')[0]?.textContent ?? ''
  switch (type) {
    case 's': return chaines[Number(v)] ?? ''
    case 'inlineStr': {
      const is = enfants(c, 'is')[0]
      return is ? texteRiche(is) : ''
    }
    case 'b': return v === '1' ? 'VRAI' : v === '0' ? 'FAUX' : ''
    case 'e': return ''
    default: return v   // nombre, str (résultat texte d'une formule), date en nombre : la valeur en cache, jamais calculée
  }
}

/** Cellules d'une feuille, ligne par ligne (index = n° de ligne - 1), bornées à 2 000 lignes et 30 colonnes. */
function lireFeuille(doc: Document, chaines: readonly string[]): { lignes: string[][]; tronque: boolean } {
  const lignes: string[][] = []
  let tronque = false
  let rangSuivant = 1
  for (const row of elements(doc, 'row')) {
    const rang = Number(row.getAttribute('r')) || rangSuivant
    rangSuivant = rang + 1
    if (rang > LIGNES_LUES_MAX_QR) { tronque = true; break }
    const cellules: string[] = []
    let colonneSuivante = 0
    for (const c of enfants(row, 'c')) {
      const colonne = colonneDeReference(c.getAttribute('r') ?? '') ?? colonneSuivante
      colonneSuivante = colonne + 1
      if (colonne >= COLONNES_LUES_MAX_QR) { tronque = true; continue }
      cellules[colonne] = valeurCellule(c, chaines)
    }
    while (lignes.length < rang - 1) lignes.push([])
    lignes[rang - 1] = Array.from(cellules, (v) => v ?? '')
  }
  return { lignes, tronque }
}

/** Chemin d'une feuille dans l'archive d'après la cible de sa relation (« worksheets/sheet1.xml » ou « /xl/… »). */
const cheminCible = (cible: string): string => (cible.startsWith('/') ? cible.slice(1) : `xl/${cible}`).replace(/\/\.\//g, '/')

/**
 * Lit un classeur .xlsx : feuilles (masquées signalées), cellules de la feuille demandée (par nom) ou de la première
 * feuille visible. Ne lève pas : un code d'échec sinon.
 */
export async function lireXlsxQr(octets: Uint8Array, feuilleVoulue?: string): Promise<LectureTableurQr> {
  if (octets.length > TAILLE_FICHIER_IMPORT_MAX_QR) return { ok: false, code: 'trop_gros' }
  const nature = natureFichierImportQr(octets)
  if (nature === 'ole') return { ok: false, code: 'format_ancien' }
  if (nature !== 'zip') return { ok: false, code: 'illisible' }
  try {
    const { unzipSync } = await import('fflate')
    const archive = inventaire(unzipSync, octets)
    const premiers = extraire(unzipSync, octets, archive, [CLASSEUR, RELATIONS], [])
    const classeur = xml(premiers[CLASSEUR])
    const relations = xml(premiers[RELATIONS])
    if (!classeur || !relations) return { ok: false, code: 'illisible' }

    const cibles = new Map(elements(relations, 'Relationship').map((r) => [r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '']))
    const feuilles = elements(classeur, 'sheet').map((s) => {
      const idRelation = Array.from(s.attributes).find((a) => a.localName === 'id')?.value ?? ''
      const etat = s.getAttribute('state')
      return { nom: s.getAttribute('name') ?? '', visible: etat !== 'hidden' && etat !== 'veryHidden', chemin: cheminCible(cibles.get(idRelation) ?? '') }
    })
    const choisie = feuilleVoulue !== undefined ? feuilles.find((f) => f.nom === feuilleVoulue) : feuilles.find((f) => f.visible) ?? feuilles[0]
    if (!choisie || !choisie.chemin.startsWith('xl/')) return { ok: false, code: 'illisible' }

    const suite = extraire(unzipSync, octets, archive, [CHAINES, choisie.chemin], [CLASSEUR, RELATIONS])
    const docChaines = xml(suite[CHAINES])
    const chaines = docChaines ? elements(docChaines, 'si').map(texteRiche) : []
    const docFeuille = xml(suite[choisie.chemin])
    if (!docFeuille) return { ok: false, code: 'illisible' }
    const { lignes, tronque } = lireFeuille(docFeuille, chaines)
    const avertissements = elements(docFeuille, 'mergeCell').length > 0
      ? ['Le fichier contient des cellules fusionnées : seule la première cellule de chaque groupe porte une valeur.']
      : []
    const liste: FeuilleClasseurQr[] = feuilles.map(({ nom, visible }) => ({ nom, visible }))
    return { ok: true, feuilles: liste, feuille: choisie.nom, lignes, avertissements, tronque }
  } catch (e) {
    if (e instanceof BombeZipQr) return { ok: false, code: 'bombe' }
    // Archive ou XML corrompu (fflate lève une erreur codée) : aucun détail à l'écran, un avertissement en console.
    console.warn('[aj-signalement] classeur illisible', e instanceof Error ? e.name : 'inconnue')
    return { ok: false, code: 'illisible' }
  }
}
