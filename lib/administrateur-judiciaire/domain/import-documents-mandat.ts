import type { Tantiemes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  analyserTexteOrdonnance,
  extraireDateEnTexte,
  type ChampObligatoireOrdonnance,
  type LectureOrdonnance,
} from '@/lib/administrateur-judiciaire/domain/fixy/lecture-ordonnance'
import { normaliserTexteLibre } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Nouveau mandat à partir de documents importés : ordonnance de désignation, règlement de copropriété / état
 * descriptif de division (EDD), fiche cadastrale (relevé de propriété). Règles LOCALES, sans IA : rien ne quitte le
 * poste. Chaque document est classé, lu, puis les lectures sont fusionnées en un BROUILLON de mandat. Un champ absent
 * reste null : il est à compléter, jamais deviné. Fonctions pures.
 */

export type TypeDocumentMandat = 'ordonnance' | 'reglement' | 'cadastre' | 'inconnu'

const INDICES: Record<Exclude<TypeDocumentMandat, 'inconnu'>, RegExp[]> = {
  ordonnance: [/ordonnance/, /tribunal judiciaire/, /administrat\w* provisoire|syndic judiciaire/, /\brg\b/],
  reglement: [/reglement de copropriete/, /etat descriptif de division/, /tantiemes|milliemes|\/\d{3,5}\s*emes/, /parties communes/],
  cadastre: [/cadastr/, /releve de propriete|matrice/, /section [a-z]{1,2} n/, /contenance/],
}

/** Type du document d'après ses indices ; le plus d'indices l'emporte ; aucun indice → « inconnu ». */
export function classerDocument(texte: string): { type: TypeDocumentMandat; indices: number } {
  const normalise = normaliserTexteLibre(texte.replace(/\//g, ' / ')).replace(/ \/ /g, '/')
  const brut = texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  let meilleur: { type: TypeDocumentMandat; indices: number } = { type: 'inconnu', indices: 0 }
  for (const [type, motifs] of Object.entries(INDICES) as [Exclude<TypeDocumentMandat, 'inconnu'>, RegExp[]][]) {
    const indices = motifs.filter((motif) => motif.test(normalise) || motif.test(brut)).length
    if (indices > meilleur.indices) meilleur = { type, indices }
  }
  return meilleur.indices >= 2 ? meilleur : { type: 'inconnu', indices: meilleur.indices }
}

const NOM_COPRO = /\b((?:R[ée]sidence|Copropri[ée]t[ée]|Immeuble|Villa|Domaine)\s+[^\n,;:.«»"]{2,60})/
const ADRESSE = /(\d{1,4}\s*(?:bis|ter)?,?\s+(?:rue|avenue|av\.|boulevard|bd|place|all[ée]e|chemin|impasse|quai|cours|route|square)\b[^\n;]*?\d{5}\s+[A-ZÉÈa-zéèêàç' -]+?)(?=[\n.;]|$)/i

export interface LotLu {
  numero: string
  tantiemes: Tantiemes
}

export interface LectureReglement {
  nom: string | null
  adresse: string | null
  dateReglement: string | null
  notaire: string | null
  lots: LotLu[]
}

export function lireReglement(texte: string): LectureReglement {
  const lots: LotLu[] = []
  for (const ligne of texte.split(/\r?\n/)) {
    const lot = /lot\s*(?:n[°o]|num[ée]ro)?\s*(\d+)\b[^\n]*?\b(\d+)\s*\/\s*(\d+)/i.exec(ligne)
    if (lot && !lots.some((l) => l.numero === lot[1]))
      lots.push({ numero: lot[1], tantiemes: { numerateur: Number(lot[2]), denominateur: Number(lot[3]) } })
  }
  const acte = /(?:re[çc]u|dress[ée]|[ée]tabli)[^\n]*?(Ma[iî]tre\s+[A-ZÉ][\w'-]+(?:\s+[A-ZÉ][\w'-]+)?)[^\n]*?notaire[^\n]*/i.exec(texte)
  return {
    nom: NOM_COPRO.exec(texte)?.[1].trim() ?? null,
    adresse: ADRESSE.exec(texte)?.[1].trim() ?? null,
    dateReglement: acte ? extraireDateEnTexte(acte[0]) : null,
    notaire: acte?.[1] ?? null,
    lots,
  }
}

export interface Parcelle {
  section: string
  numero: string
  contenanceM2: number | null
}

export interface LectureCadastre {
  commune: string | null
  codeCommune: string | null
  parcelles: Parcelle[]
}

export function lireFicheCadastrale(texte: string): LectureCadastre {
  const commune = /commune\s*:?\s*(\d{5})?\s*([A-ZÉÈ][A-ZÉÈ' -]+[A-ZÉÈ])/i.exec(texte)
  const parcelles: Parcelle[] = []
  for (const ligne of texte.split(/\r?\n/)) {
    const ref = /section\s+([A-Z]{1,2})\s*(?:n[°o]|num[ée]ro|parcelle)?\s*(\d{1,4})\b/i.exec(ligne)
    if (!ref || parcelles.some((p) => p.section === ref[1].toUpperCase() && p.numero === ref[2])) continue
    const c = /contenance\s*:?\s*(?:(\d+)\s*ha)?\s*(?:(\d+)\s*a)?\s*(?:(\d+)\s*ca)?/i.exec(ligne)
    const m2 = /(\d[\d ]*)\s*m(?:²|2)\b/i.exec(ligne)
    const contenance =
      c && (c[1] || c[2] || c[3])
        ? Number(c[1] ?? 0) * 10_000 + Number(c[2] ?? 0) * 100 + Number(c[3] ?? 0)
        : m2
          ? Number(m2[1].replace(/ /g, ''))
          : null
    parcelles.push({ section: ref[1].toUpperCase(), numero: ref[2], contenanceM2: contenance })
  }
  return { commune: commune?.[2].trim() ?? null, codeCommune: commune?.[1] ?? null, parcelles }
}

export type LectureDocument =
  | { fichier: string; type: 'ordonnance'; lecture: LectureOrdonnance }
  | { fichier: string; type: 'reglement'; lecture: LectureReglement }
  | { fichier: string; type: 'cadastre'; lecture: LectureCadastre }
  | { fichier: string; type: 'inconnu' }

export function lireDocument(fichier: string, texte: string): LectureDocument {
  const { type } = classerDocument(texte)
  if (type === 'ordonnance') return { fichier, type, lecture: analyserTexteOrdonnance(texte) }
  if (type === 'reglement') return { fichier, type, lecture: lireReglement(texte) }
  if (type === 'cadastre') return { fichier, type, lecture: lireFicheCadastrale(texte) }
  return { fichier, type }
}

export interface BrouillonMandat {
  nom: string | null
  adresse: string | null
  tribunal: string | null
  rg: string | null
  date: string | null
  fondement: string | null
  dureeMois: number | null
  motif: string | null
  nbLots: number | null
  lots: LotLu[]
  parcelles: Parcelle[]
  commune: string | null
  codeCommune: string | null
  dateReglement: string | null
  notaire: string | null
  sources: { fichier: string; type: TypeDocumentMandat }[]
  /** Champs obligatoires du mandat encore vides (mêmes champs que la création depuis une ordonnance). */
  manquants: ChampObligatoireOrdonnance[]
  conflits: string[]
}

const CHAMPS_OBLIGATOIRES: ChampObligatoireOrdonnance[] = ['nom', 'adresse', 'tribunal', 'rg', 'date', 'fondement', 'dureeMois']

/**
 * Fusion des lectures. Priorité : ordonnance (acte du juge) > règlement > cadastre pour le nom et l'adresse ;
 * le mandat (tribunal, RG, date, fondement, durée) ne vient QUE d'une ordonnance. Un désaccord est signalé.
 */
export function fusionnerDocuments(documents: LectureDocument[]): BrouillonMandat {
  const ordonnance = documents.find((d) => d.type === 'ordonnance')?.lecture ?? null
  const reglement = documents.find((d) => d.type === 'reglement')?.lecture ?? null
  const cadastre = documents.find((d) => d.type === 'cadastre')?.lecture ?? null
  const conflits: string[] = []
  const choisir = (champ: string, valeurs: (string | null | undefined)[]): string | null => {
    const presentes = valeurs.filter((v): v is string => Boolean(v))
    const distinctes = new Set(presentes.map((v) => normaliserTexteLibre(v)))
    if (distinctes.size > 1) conflits.push(`${champ} : ${presentes.map((v) => `« ${v} »`).join(' / ')}`)
    return presentes[0] ?? null
  }
  const brouillon: Omit<BrouillonMandat, 'manquants'> = {
    nom: choisir('nom', [ordonnance?.nom, reglement?.nom]),
    adresse: choisir('adresse', [ordonnance?.adresse, reglement?.adresse]),
    tribunal: ordonnance?.tribunal ?? null,
    rg: ordonnance?.rg ?? null,
    date: ordonnance?.date ?? null,
    fondement: ordonnance?.fondement ?? null,
    dureeMois: ordonnance?.dureeMois ?? null,
    motif: ordonnance?.motif ?? null,
    nbLots: reglement?.lots.length || ordonnance?.lots || null,
    lots: reglement?.lots ?? [],
    parcelles: cadastre?.parcelles ?? [],
    commune: cadastre?.commune ?? null,
    codeCommune: cadastre?.codeCommune ?? null,
    dateReglement: reglement?.dateReglement ?? null,
    notaire: reglement?.notaire ?? null,
    sources: documents.map((d) => ({ fichier: d.fichier, type: d.type })),
    conflits,
  }
  return { ...brouillon, manquants: CHAMPS_OBLIGATOIRES.filter((champ) => brouillon[champ] === null || brouillon[champ] === '') }
}
