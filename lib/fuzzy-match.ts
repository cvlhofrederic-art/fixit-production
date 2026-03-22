/**
 * Fuzzy matching utilities for voice-tolerant search
 * Used by Fixy voice commands, RapportsSection, and DevisForm
 */

export function normalizeForSearch(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export function similarity(a: string, b: string): number {
  const na = normalizeForSearch(a), nb = normalizeForSearch(b)
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(na, nb) / maxLen
}

/**
 * Fuzzy-match a search term against a list of items
 * Returns the best match with score >= threshold, or null
 */
export function fuzzyFind<T>(
  search: string,
  items: T[],
  getName: (item: T) => string,
  threshold = 0.8
): T | null {
  if (!search || items.length === 0) return null
  const searchNorm = normalizeForSearch(search)
  const searchWords = searchNorm.split(/\s+/).filter(w => w.length >= 2)

  // 1. Exact match
  const exact = items.find(item => normalizeForSearch(getName(item)) === searchNorm)
  if (exact) return exact

  // 2. Contains
  const contains = items.find(item => {
    const n = normalizeForSearch(getName(item))
    return n.includes(searchNorm) || searchNorm.includes(n)
  })
  if (contains) return contains

  // 3. All words match
  if (searchWords.length > 0) {
    const allWords = items.find(item => {
      const n = normalizeForSearch(getName(item))
      return searchWords.every(sw => n.includes(sw))
    })
    if (allWords) return allWords

    // Any word match
    const anyWord = items.find(item => {
      const n = normalizeForSearch(getName(item))
      return searchWords.some(sw => n.includes(sw))
    })
    if (anyWord) return anyWord
  }

  // 4. Levenshtein similarity
  let bestMatch: T | null = null
  let bestScore = 0
  for (const item of items) {
    const name = getName(item)
    const score = similarity(search, name)
    if (score >= threshold && score > bestScore) {
      bestScore = score
      bestMatch = item
    }
    // Word-level matching
    const itemWords = normalizeForSearch(name).split(/\s+/)
    for (const sw of searchWords) {
      for (const iw of itemWords) {
        if (iw.length >= 3 && sw.length >= 3) {
          const ws = similarity(sw, iw)
          if (ws >= threshold && ws > bestScore) {
            bestScore = ws
            bestMatch = item
          }
        }
      }
    }
  }
  if (bestMatch) return bestMatch

  // 5. Prefix match (partial words from voice: "élag" → "élagage")
  if (searchWords.length > 0) {
    const prefix = items.find(item => {
      const iWords = normalizeForSearch(getName(item)).split(/\s+/)
      return searchWords.some(sw => sw.length >= 3 && iWords.some(iw => iw.startsWith(sw) || sw.startsWith(iw)))
    })
    if (prefix) return prefix
  }

  return null
}
