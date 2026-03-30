// ── Scoring de pertinence marchés publics ────────────────────────────────────
// Score /100 = CPV match (40pts) + Keywords match (30pts) + Geo match (15pts) + Budget match (15pts)
// Seuil affichage : > 40 (relaxé pour ne pas rater d'opportunités)
// Priorité : 🔥 > 80 | ⚖️ 50-80 | ℹ️ 40-50

import { METIER_CPV_MAP, findMetiersByText } from './marches-cpv-mapping'

export interface ScoringInput {
  title: string
  description: string
  cpvCodes: string[]
  location?: string
  budget?: number
  country: 'FR' | 'PT'
}

export interface ScoringPrefs {
  metiers: string[]        // ex: ['couvreur', 'chauffagiste']
  location?: string        // ex: 'Marseille' ou 'Porto'
  budgetMin?: number
  budgetMax?: number
  country?: 'FR' | 'PT'
}

export interface ScoringResult {
  scoreTotal: number       // /100
  scoreCPV: number         // /40
  scoreKeywords: number    // /30
  scoreGeo: number         // /15
  scoreBudget: number      // /15
  matchedMetiers: string[]
  priority: 'high' | 'medium' | 'low'
  recommendation: 'respond' | 'review' | 'skip'
}

// ── Score CPV (40 pts max) ──────────────────────────────────────────────────
function scoreCPV(inputCPVs: string[], metiers: string[]): { score: number; matched: string[] } {
  if (!inputCPVs.length || !metiers.length) return { score: 0, matched: [] }

  const matched: string[] = []
  let bestScore = 0

  for (const metier of metiers) {
    const mapping = METIER_CPV_MAP[metier]
    if (!mapping) continue

    for (const inputCPV of inputCPVs) {
      for (const metierCPV of mapping.cpv) {
        // Exact match = 40pts
        if (inputCPV === metierCPV) {
          matched.push(metier)
          bestScore = 40
          break
        }
        // Prefix match (ex: 45261 matches 45261210) = 30pts
        if (inputCPV.startsWith(metierCPV.substring(0, 5)) || metierCPV.startsWith(inputCPV.substring(0, 5))) {
          if (!matched.includes(metier)) matched.push(metier)
          bestScore = Math.max(bestScore, 30)
        }
        // Same group (first 3 digits) = 15pts
        if (inputCPV.substring(0, 3) === metierCPV.substring(0, 3)) {
          if (!matched.includes(metier)) matched.push(metier)
          bestScore = Math.max(bestScore, 15)
        }
      }
    }
  }

  return { score: bestScore, matched: [...new Set(matched)] }
}

// ── Score Keywords (30 pts max) ─────────────────────────────────────────────
function scoreKeywords(title: string, description: string, metiers: string[], country: 'FR' | 'PT'): number {
  const text = `${title} ${description}`
  const matches = findMetiersByText(text, country)

  if (!matches.length) return 0

  // Check if any of the user's metiers are in the matches
  const userMatch = matches.find(m => metiers.includes(m.metier))
  if (userMatch) {
    // Direct metier match: scale 0-30 based on keyword density
    return Math.min(Math.round(userMatch.score * 0.3), 30)
  }

  // Partial related match: max 10pts
  return Math.min(Math.round(matches[0].score * 0.1), 10)
}

// ── Score Géo (15 pts max) ──────────────────────────────────────────────────
function scoreGeo(marcheLocation: string | undefined, userLocation: string | undefined): number {
  if (!marcheLocation || !userLocation) return 8 // Neutral if unknown

  const ml = marcheLocation.toLowerCase()
  const ul = userLocation.toLowerCase()

  // Same city = 15pts
  if (ml.includes(ul) || ul.includes(ml)) return 15

  // Same department / region heuristic
  const frRegions: Record<string, string[]> = {
    'paca': ['marseille', 'aix-en-provence', 'toulon', 'nice', 'avignon', 'aubagne', 'la ciotat', 'arles', 'gap', 'digne'],
    'idf': ['paris', 'boulogne', 'nanterre', 'versailles', 'créteil', 'bobigny', 'evry', 'cergy', 'melun'],
    'lyon': ['lyon', 'villeurbanne', 'vénissieux', 'saint-étienne', 'grenoble', 'valence'],
    'nord': ['lille', 'roubaix', 'tourcoing', 'dunkerque', 'valenciennes', 'douai'],
  }
  const ptRegions: Record<string, string[]> = {
    'norte': ['porto', 'braga', 'guimarães', 'vila nova de gaia', 'matosinhos', 'marco de canaveses', 'penafiel', 'amarante'],
    'centro': ['coimbra', 'aveiro', 'leiria', 'viseu', 'castelo branco'],
    'lisboa': ['lisboa', 'sintra', 'cascais', 'amadora', 'oeiras', 'almada', 'setúbal'],
  }

  const allRegions = { ...frRegions, ...ptRegions }
  for (const cities of Object.values(allRegions)) {
    const marcheInRegion = cities.some(c => ml.includes(c))
    const userInRegion = cities.some(c => ul.includes(c))
    if (marcheInRegion && userInRegion) return 12 // Same region
  }

  return 3 // Different region
}

// ── Score Budget (15 pts max) ────────────────────────────────────────────────
function scoreBudget(marcheBudget: number | undefined, prefs: ScoringPrefs): number {
  if (!marcheBudget) return 8 // Neutral if unknown

  if (prefs.budgetMin && marcheBudget < prefs.budgetMin) return 2 // Too small
  if (prefs.budgetMax && marcheBudget > prefs.budgetMax) return 5 // Too big but still viable

  // In range
  return 15
}

// ── Main scoring function ───────────────────────────────────────────────────
export function scoreMarche(input: ScoringInput, prefs: ScoringPrefs): ScoringResult {
  const cpvResult = scoreCPV(input.cpvCodes, prefs.metiers)
  const kwScore = scoreKeywords(input.title, input.description, prefs.metiers, input.country)
  const geoScore = scoreGeo(input.location, prefs.location)
  const budgetScore = scoreBudget(input.budget, prefs)

  const total = cpvResult.score + kwScore + geoScore + budgetScore

  let priority: 'high' | 'medium' | 'low'
  let recommendation: 'respond' | 'review' | 'skip'

  if (total >= 80) {
    priority = 'high'
    recommendation = 'respond'
  } else if (total >= 50) {
    priority = 'medium'
    recommendation = 'review'
  } else {
    priority = 'low'
    recommendation = 'skip'
  }

  return {
    scoreTotal: total,
    scoreCPV: cpvResult.score,
    scoreKeywords: kwScore,
    scoreGeo: geoScore,
    scoreBudget: budgetScore,
    matchedMetiers: cpvResult.matched,
    priority,
    recommendation,
  }
}

// ── Batch scoring ───────────────────────────────────────────────────────────
export function scoreMarches(inputs: ScoringInput[], prefs: ScoringPrefs): (ScoringInput & ScoringResult)[] {
  return inputs
    .map(input => ({ ...input, ...scoreMarche(input, prefs) }))
    .filter(m => m.scoreTotal >= 40)
    .sort((a, b) => b.scoreTotal - a.scoreTotal)
}
