import { dateFrVersIso } from '@/lib/administrateur-judiciaire/domain/dates'
import { normaliserTexteLibre } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Lecture d'une ordonnance de désignation collée en texte : Fixy en extrait les champs du mandat.
 * Certains motifs s'appliquent au texte brut (espaces compactés), d'autres au texte normalisé
 * (normaliserTexteLibre : sans accents ni ponctuation) : chaque motif garde le texte de la maquette.
 */

/** Mois en lettres, sans accents (appliqués au texte normalisé). */
export const MOIS_EN_LETTRES: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
}

/** Première date « JJ/MM/AAAA » du texte, sinon « 1er mars 2026 » (texte normalisé) ; ISO validée, ou null. */
export function extraireDateEnTexte(texte: string): string | null {
  const numerique = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(texte)
  if (numerique) return dateFrVersIso(`${numerique[1]}/${numerique[2]}/${numerique[3]}`)
  const enLettres =
    /(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/.exec(
      normaliserTexteLibre(texte),
    )
  return enLettres ? dateFrVersIso(`${enLettres[1]}/${MOIS_EN_LETTRES[enLettres[2]]}/${enLettres[3]}`) : null
}

/** Champs sans lesquels le mandat ne peut pas être créé (lots et motif sont facultatifs). */
export type ChampObligatoireOrdonnance = 'nom' | 'adresse' | 'tribunal' | 'rg' | 'date' | 'fondement' | 'dureeMois'

export const CHAMPS_OBLIGATOIRES_ORDONNANCE: ChampObligatoireOrdonnance[] = [
  'nom',
  'adresse',
  'tribunal',
  'rg',
  'date',
  'fondement',
  'dureeMois',
]

export interface LectureOrdonnance {
  nom: string | null
  adresse: string | null
  tribunal: string | null
  rg: string | null
  /** Date de l'ordonnance, ISO. */
  date: string | null
  /** « Administration provisoire (art. 29-1) », « Administrateur provisoire (art. 47) » ou « Syndic judiciaire (art. 46) ». */
  fondement: string | null
  dureeMois: number | null
  lots: number | null
  motif: string | null
  manquants: ChampObligatoireOrdonnance[]
}

/** Extrait les champs du mandat du texte d'une ordonnance ; `manquants` liste les champs obligatoires non trouvés. */
export function analyserTexteOrdonnance(texte: string): LectureOrdonnance {
  const brut = texte.replace(/\s+/g, ' ').trim(),
    normalise = normaliserTexteLibre(brut),
    rg = (/(?:rg|n°\s*rg|repertoire general)\s*:?\s*(\d{2}\/\d{4,6})/i.exec(brut) || [])[1] || null,
    tribunal =
      (/(tribunal judiciaire d[e']\s?[A-ZÉÈ][\w'\- ]+?)(?=[,.;\s]+(?:statuant|siegeant|siégeant|ordonnance|vu|rg|n°|en la|le \d)|$)/i.exec(
        brut,
      ) || [])[1] || null
  let fondement: string | null = null
  if (/\b29[ -]?1\b/.test(normalise)) fondement = 'Administration provisoire (art. 29-1)'
  else if (/article 47|art\.? 47|dépourvu de syndic|depourvu de syndic/.test(normalise))
    fondement = 'Administrateur provisoire (art. 47)'
  else if (/article 46|art\.? 46|carence|syndic judiciaire/.test(normalise)) fondement = 'Syndic judiciaire (art. 46)'
  const duree = (/(?:pour une duree de|duree de|pendant)\s*(\d{1,2})\s*mois/.exec(normalise) ||
      /(\d{1,2})\s*mois/.exec(normalise) ||
      [])[1],
    lots = (/(\d{1,4})\s*lots?/.exec(normalise) || [])[1],
    nom =
      /(?:copropri[eé]t[eé]|syndicat des copropri[eé]taires|r[eé]sidence|immeuble)\s+(?:de l'|de la|du|des|de|d')?\s*(?:immeuble\s+)?(?:sis(?:e)?\s+)?(?:«|")?\s*([A-ZÉ][^,.;«»"]{2,60}?)(?:»|")?(?=[,.;]| sis| situ| dont| repr| \d)/.exec(
        brut,
      ),
    adresse =
      /(?:sis(?:e)?|situ[eé]e?)\s+(?:au\s+|à\s+|a\s+)?(\d{1,4}[^,.;]{4,80}?\d{5}\s+[A-ZÉ][\w'\- ]+)/i.exec(brut) ||
      /(\d{1,4}\s*(?:bis|ter)?,?\s*(?:rue|avenue|boulevard|bd|allee|allée|place|chemin|impasse)[^,.;]{2,60},?\s*\d{5}\s+[A-ZÉ][\w'\- ]+)/i.exec(
        brut,
      ),
    mentionDate = /(?:ordonnance|rendue|en date)\s+(?:du|le|en date du)?\s*([^,.;]{4,40})/i.exec(brut),
    date = (mentionDate ? extraireDateEnTexte(mentionDate[1]) : null) || extraireDateEnTexte(brut),
    motif = /(?:motif|attendu que|considerant que|en raison de)\s*:?\s*([^.;]{10,160})/i.exec(brut),
    lecture: LectureOrdonnance = {
      nom: nom ? nom[1].trim() : null,
      adresse: adresse ? adresse[1].trim() : null,
      tribunal: tribunal ? tribunal.trim() : null,
      rg,
      date,
      fondement,
      dureeMois: duree ? Number(duree) : null,
      lots: lots ? Number(lots) : null,
      motif: motif ? motif[1].trim() : null,
      manquants: [],
    }
  lecture.manquants = CHAMPS_OBLIGATOIRES_ORDONNANCE.filter((champ) => lecture[champ] == null)
  return lecture
}
