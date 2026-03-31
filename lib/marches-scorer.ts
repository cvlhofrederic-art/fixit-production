// ── Scoring de pertinence marchés publics ────────────────────────────────────
// Score /100 = CPV match (40pts) + Keywords match (30pts) + Geo match (15pts) + Budget match (15pts)
// Seuil affichage : > 40 (relaxé pour ne pas rater d'opportunités)
// Priorité : 🔥 > 80 | ⚖️ 50-80 | ℹ️ 40-50

import { METIER_CPV_MAP } from './marches-cpv-mapping'

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
// Uses strong/weak keyword distinction: strong matches score higher than weak-only matches
function scoreKeywords(title: string, description: string, metiers: string[], country: 'FR' | 'PT'): number {
  const text = `${title} ${description}`.toLowerCase()

  let bestScore = 0

  for (const metier of metiers) {
    const mapping = METIER_CPV_MAP[metier]
    if (!mapping) continue

    let strongHits = 0
    let weakHits = 0

    // Count strong keyword matches
    for (const kw of mapping.strongKeywords) {
      if (text.includes(kw.toLowerCase())) strongHits++
    }

    // Count weak keyword matches
    for (const kw of mapping.weakKeywords) {
      if (text.includes(kw.toLowerCase())) weakHits++
    }

    // PT keywords
    if (country === 'PT') {
      for (const kw of mapping.keywordsPt) {
        if (text.includes(kw.toLowerCase())) strongHits++
      }
    }

    if (strongHits === 0 && weakHits === 0) continue

    // Strong matches: 8pts per hit (max 24), weak: 3pts per hit (max 6)
    // But weak-only matches cap at 8pts total (low confidence)
    let score: number
    if (strongHits > 0) {
      score = Math.min(strongHits * 8, 24) + Math.min(weakHits * 3, 6)
    } else {
      score = Math.min(weakHits * 3, 8) // Weak-only: capped at 8/30
    }

    bestScore = Math.max(bestScore, Math.min(score, 30))
  }

  return bestScore
}

// ── Score Géo (15 pts max) ──────────────────────────────────────────────────

// Mapping ville → code département (pour comparer "Dept. 13" avec "Marseille")
const CITY_DEPT_MAP: Record<string, string> = {
  'marseille': '13', 'aix-en-provence': '13', 'aubagne': '13', 'la ciotat': '13',
  'arles': '13', 'martigues': '13', 'salon-de-provence': '13', 'istres': '13',
  'toulon': '83', 'nice': '06', 'cannes': '06', 'antibes': '06', 'avignon': '84',
  'paris': '75', 'lyon': '69', 'toulouse': '31', 'bordeaux': '33', 'lille': '59',
  'nantes': '44', 'strasbourg': '67', 'montpellier': '34', 'rennes': '35',
  'grenoble': '38', 'saint-étienne': '42',
}

// Départements dans la même région
const DEPT_REGIONS: Record<string, string[]> = {
  'paca': ['04', '05', '06', '13', '83', '84'],
  'idf': ['75', '77', '78', '91', '92', '93', '94', '95'],
  'aura': ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
  'hdf': ['02', '59', '60', '62', '80'],
  'occitanie': ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
}

function scoreGeo(marcheLocation: string | undefined, userLocation: string | undefined): number {
  if (!marcheLocation || !userLocation) return 8 // Neutral if unknown

  const ml = marcheLocation.toLowerCase()
  const ul = userLocation.toLowerCase()

  // Direct text match
  if (ml.includes(ul) || ul.includes(ml)) return 15

  // Extract dept code from BOAMP-style "Dept. 13" format
  const deptMatch = ml.match(/dept\.?\s*(\d{1,3})/)
  const marcheDept = deptMatch ? deptMatch[1] : null

  // Get user's dept from city name
  const userDept = CITY_DEPT_MAP[ul] || null

  if (marcheDept && userDept) {
    // Same département = 15pts
    if (marcheDept === userDept) return 15

    // Same region = 12pts
    for (const depts of Object.values(DEPT_REGIONS)) {
      if (depts.includes(marcheDept) && depts.includes(userDept)) return 12
    }

    return 3 // Different region
  }

  // Fallback: region heuristic by city name
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
    if (marcheInRegion && userInRegion) return 12
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
