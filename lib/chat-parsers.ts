// ══════════════ Chat Parser Utilities ══════════════
// Extracted from components/chat/AiChatBot.tsx

export interface ClientData {
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  siret: string
  source: 'auth' | 'booking_notes'
  bookings?: { id: string; date: string; service: string; status: string }[]
}

export interface ServiceItem {
  id: string
  name: string
  price_ht?: number
  price_ttc?: number
  duration_minutes?: number
  virtual?: boolean
  [key: string]: unknown
}

export type Intent = 'create_rdv' | 'create_devis' | 'create_facture' | 'list_rdv' | 'help' | 'unknown'

// ══════════════ DATE / TIME / TEXT PARSERS ══════════════

export function parseDate(text: string): string | null {
  const lower = text.toLowerCase()
  const now = new Date()

  // "aujourd'hui"
  if (lower.includes("aujourd'hui") || lower.includes('ajd') || lower.includes('today')) {
    return now.toISOString().split('T')[0]
  }

  // "demain"
  if (lower.includes('demain')) {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  // "après-demain"
  if (lower.includes('après-demain') || lower.includes('apres-demain') || lower.includes('après demain')) {
    const d = new Date(now)
    d.setDate(d.getDate() + 2)
    return d.toISOString().split('T')[0]
  }

  // Jours de la semaine
  const jours: Record<string, number> = {
    'lundi': 1, 'mardi': 2, 'mercredi': 3, 'jeudi': 4,
    'vendredi': 5, 'samedi': 6, 'dimanche': 0
  }
  for (const [jour, idx] of Object.entries(jours)) {
    if (lower.includes(jour)) {
      const d = new Date(now)
      const currentDay = d.getDay()
      let diff = idx - currentDay
      if (diff <= 0) diff += 7
      d.setDate(d.getDate() + diff)
      return d.toISOString().split('T')[0]
    }
  }

  // Date explicite: "17 mars", "17/03", "17-03-2025"
  const moisNoms: Record<string, number> = {
    'janvier': 0, 'février': 1, 'fevrier': 1, 'mars': 2, 'avril': 3,
    'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7, 'aout': 7,
    'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11, 'decembre': 11
  }

  // "17 mars" or "17 mars 2025"
  const dateTextMatch = lower.match(/(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)(?:\s+(\d{4}))?/)
  if (dateTextMatch) {
    const day = parseInt(dateTextMatch[1])
    const monthStr = dateTextMatch[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const month = moisNoms[monthStr] ?? moisNoms[Object.keys(moisNoms).find(k => k.startsWith(monthStr.slice(0, 3))) || ''] ?? 0
    const year = dateTextMatch[3] ? parseInt(dateTextMatch[3]) : now.getFullYear()
    const d = new Date(year, month, day)
    if (d < now) d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().split('T')[0]
  }

  // "17/03" or "17/03/2025"
  const dateSlashMatch = lower.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/)
  if (dateSlashMatch) {
    const day = parseInt(dateSlashMatch[1])
    const month = parseInt(dateSlashMatch[2]) - 1
    let year = dateSlashMatch[3] ? parseInt(dateSlashMatch[3]) : now.getFullYear()
    if (year < 100) year += 2000
    return new Date(year, month, day).toISOString().split('T')[0]
  }

  return null
}

export function parseTime(text: string): string | null {
  const lower = text.toLowerCase()

  // "17h", "17h30", "17H00", "9h", "9h30"
  const hMatch = lower.match(/(\d{1,2})\s*h\s*(\d{0,2})/)
  if (hMatch) {
    const h = parseInt(hMatch[1])
    const m = hMatch[2] ? parseInt(hMatch[2]) : 0
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  // "17:30"
  const colonMatch = lower.match(/(\d{1,2}):(\d{2})/)
  if (colonMatch) {
    const h = parseInt(colonMatch[1])
    const m = parseInt(colonMatch[2])
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  // "midi"
  if (lower.includes('midi')) return '12:00'
  // Approximations
  if (lower.includes('matin')) return '09:00'
  if (lower.includes('après-midi') || lower.includes('aprem')) return '14:00'
  if (lower.includes('soir')) return '18:00'

  return null
}

export function parseClientName(text: string): string | null {
  // "Madame X", "Mme X", "Monsieur X", "M. X", "Mr X", "client X", "chez X"
  // Support multi-word names like "Frédéric Neiva Carvalho"
  const patterns = [
    /(?:madame|mme\.?|mme)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
    /(?:monsieur|mr\.?|m\.)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
    /(?:client[e]?|chez)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
    // "pour le client X Y Z" — match name after "client"
    /(?:pour\s+le\s+client|pour\s+la\s+cliente)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
    /(?:pour|avec)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
  ]

  // Common words that aren't names (expanded)
  const excluded = [
    'intervention', 'devis', 'facture', 'rendez', 'demain', 'mardi', 'mercredi',
    'jeudi', 'vendredi', 'samedi', 'dimanche', 'lundi', 'plomberie', 'electricite',
    'motif', 'prix', 'montant', 'service', 'prestation', 'travaux',
  ]

  for (const pat of patterns) {
    const match = text.match(pat)
    if (match) {
      let name = match[1].trim()
      // Remove trailing common words that got captured
      const nameWords = name.split(/\s+/)
      const cleanWords: string[] = []
      for (const w of nameWords) {
        if (excluded.some(e => w.toLowerCase().startsWith(e))) break
        cleanWords.push(w)
      }
      name = cleanWords.join(' ')
      if (name && !excluded.some(e => name.toLowerCase().startsWith(e))) {
        return name
      }
    }
  }

  return null
}

export function parseServiceMatch(text: string, services: ServiceItem[]): ServiceItem | null {
  const lower = text.toLowerCase()

  // First try to extract service from "motif X" pattern
  const motifMatch = lower.match(/motif\s+([a-zà-ÿéèêë\s]+?)(?:\s+prix|\s+pour|\s+client|\s*,|\s*$)/i)
  const motifText = motifMatch ? motifMatch[1].trim() : null

  for (const svc of services) {
    const svcLower = svc.name.toLowerCase()
    // Check if service name or keywords appear in the text
    if (lower.includes(svcLower)) return svc
    // Check if motif matches service
    if (motifText && svcLower.includes(motifText)) return svc
    if (motifText && motifText.includes(svcLower)) return svc
    // Check individual words (at least 4 chars)
    const words = svcLower.split(/\s+/).filter((w: string) => w.length >= 4)
    for (const w of words) {
      if (lower.includes(w)) return svc
      if (motifText && motifText.includes(w)) return svc
    }
  }

  // If motif was found but no matching service, create a virtual service entry
  if (motifText) {
    return { id: `virtual_${Date.now()}`, name: motifText.charAt(0).toUpperCase() + motifText.slice(1), price_ht: 0, price_ttc: 0, virtual: true }
  }

  return null
}

export function parseAmount(text: string): number | null {
  // "150€", "150 euros", "150,50€"
  const match = text.match(/(\d+(?:[,\.]\d{1,2})?)\s*(?:€|euros?)/i)
  if (match) {
    return parseFloat(match[1].replace(',', '.'))
  }
  return null
}

export function parseAddress(text: string): string | null {
  // "au 123 rue X" or "à 123 avenue Y"
  const match = text.match(/(?:au|à|chez|adresse)\s+(\d+.*?)(?:\s*,\s*|\s+(?:à|pour|le|mardi|lundi|mercredi|jeudi|vendredi|samedi|dimanche|demain|aujourd)|\s*$)/i)
  if (match) return match[1].trim()
  return null
}

// ══════════════ INTENT DETECTION ══════════════

export function detectIntent(text: string): Intent {
  const lower = text.toLowerCase()

  if (
    lower.includes('rdv') || lower.includes('rendez-vous') || lower.includes('rendez vous') ||
    lower.includes('prend') || lower.includes('programme') || lower.includes('ajoute') ||
    lower.includes('planifie') || lower.includes('met') && (lower.includes('rdv') || lower.includes('rendez'))
  ) {
    return 'create_rdv'
  }

  if (lower.includes('devis') || lower.includes('fait un devis') || lower.includes('faire un devis') || lower.includes('créer un devis') || lower.includes('crée un devis') || lower.includes('cree un devis') || lower.includes('crée le devis') || lower.includes('cree le devis')) {
    return 'create_devis'
  }

  if (lower.includes('facture') || lower.includes('fait une facture') || lower.includes('faire une facture') || lower.includes('créer une facture') || lower.includes('crée une facture')) {
    return 'create_facture'
  }

  if (lower.includes('agenda') || lower.includes('planning') || lower.includes('prochain') || lower.includes('liste')) {
    return 'list_rdv'
  }

  if (lower.includes('aide') || lower.includes('help') || lower.includes('quoi') || lower.includes('comment') || lower.includes('bonjour') || lower.includes('salut')) {
    return 'help'
  }

  // If there's a date + time + name, assume it's a RDV
  if (parseDate(text) && parseTime(text) && parseClientName(text)) {
    return 'create_rdv'
  }

  return 'unknown'
}

// ══════════════ FORMAT HELPERS ══════════════

export function formatDateFr(dateStr: string, fmtLocale: string = 'fr-FR'): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString(fmtLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatRecordingTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ══════════════ SIMILARITY (Levenshtein) ══════════════

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

export function normalizeForSearch(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

export function similarity(a: string, b: string): number {
  const na = normalizeForSearch(a), nb = normalizeForSearch(b)
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(na, nb) / maxLen
}

// ══════════════ CLIENT MATCHER ══════════════

export function findClientByName(name: string, clients: ClientData[]): ClientData | null {
  if (!name || clients.length === 0) return null
  const searchName = normalizeForSearch(name)

  // 1. Exact match (après normalisation)
  const exact = clients.find(c => normalizeForSearch(c.name) === searchName)
  if (exact) return exact

  // 2. Name contains search (or search contains name)
  const contains = clients.find(c => {
    const cn = normalizeForSearch(c.name)
    return cn.includes(searchName) || searchName.includes(cn)
  })
  if (contains) return contains

  // 3. Partial match — all search words appear in client name
  const searchWords = searchName.split(/\s+/).filter(w => w.length >= 2)
  if (searchWords.length > 0) {
    const partial = clients.find(c => {
      const cn = normalizeForSearch(c.name)
      return searchWords.every(sw => cn.includes(sw))
    })
    if (partial) return partial

    // 4. Last name match (last word)
    const lastName = searchWords[searchWords.length - 1]
    if (lastName.length >= 3) {
      const lastNameMatch = clients.find(c => {
        const cnWords = normalizeForSearch(c.name).split(/\s+/)
        return cnWords.some(w => w === lastName || w.includes(lastName) || lastName.includes(w))
      })
      if (lastNameMatch) return lastNameMatch
    }
  }

  // 5. Similarité Levenshtein >= 80% (tolérance aux déformations vocales)
  let bestMatch: ClientData | null = null
  let bestScore = 0
  for (const c of clients) {
    const score = similarity(name, c.name)
    if (score >= 0.8 && score > bestScore) {
      bestScore = score
      bestMatch = c
    }
    // Vérifier aussi chaque mot individuellement (nom de famille)
    const cWords = normalizeForSearch(c.name).split(/\s+/)
    for (const sw of searchWords) {
      for (const cw of cWords) {
        if (cw.length >= 3 && sw.length >= 3) {
          const wordScore = similarity(sw, cw)
          if (wordScore >= 0.8 && wordScore > bestScore) {
            bestScore = wordScore
            bestMatch = c
          }
        }
      }
    }
  }
  if (bestMatch) return bestMatch

  // 6. Début de mot (mots partiels vocaux : "lep" -> "lepore")
  if (searchWords.length > 0) {
    const prefixMatch = clients.find(c => {
      const cnWords = normalizeForSearch(c.name).split(/\s+/)
      return searchWords.some(sw => sw.length >= 3 && cnWords.some(cw => cw.startsWith(sw)))
    })
    if (prefixMatch) return prefixMatch
  }

  return null
}

// ══════════════ SERVICE/MOTIF MATCHER ══════════════

export function findServiceByVoice(text: string, services: ServiceItem[]): ServiceItem | null {
  if (!text || services.length === 0) return null
  const searchText = normalizeForSearch(text)

  // 1. Correspondance exacte
  const exact = services.find(s => normalizeForSearch(s.name) === searchText)
  if (exact) return exact

  // 2. Contient le mot-clé complet
  const contains = services.find(s => {
    const sn = normalizeForSearch(s.name)
    return sn.includes(searchText) || searchText.includes(sn)
  })
  if (contains) return contains

  // 3. Correspondance sémantique par mots-clés
  const searchWords = searchText.split(/\s+/).filter(w => w.length >= 3)
  if (searchWords.length > 0) {
    // Tous les mots du search trouvés dans le nom du service
    const allWords = services.find(s => {
      const sn = normalizeForSearch(s.name)
      return searchWords.every(sw => sn.includes(sw))
    })
    if (allWords) return allWords

    // Au moins un mot significatif matche
    const anyWord = services.find(s => {
      const sn = normalizeForSearch(s.name)
      return searchWords.some(sw => sn.includes(sw))
    })
    if (anyWord) return anyWord
  }

  // 4. Similarité Levenshtein >= 80%
  let bestMatch: ServiceItem | null = null
  let bestScore = 0
  for (const s of services) {
    // Score global
    const score = similarity(text, s.name)
    if (score >= 0.8 && score > bestScore) {
      bestScore = score
      bestMatch = s
    }
    // Score par mots (ex: "élag" vs "élagage")
    const sWords = normalizeForSearch(s.name).split(/\s+/)
    for (const sw of searchWords) {
      for (const sWord of sWords) {
        if (sWord.length >= 3 && sw.length >= 3) {
          const wordScore = similarity(sw, sWord)
          if (wordScore >= 0.75 && wordScore > bestScore) {
            bestScore = wordScore
            bestMatch = s
          }
        }
      }
    }
  }
  if (bestMatch) return bestMatch

  // 5. Préfixe (mots partiels vocaux : "élag" -> "élagage", "nettoy" -> "nettoyage")
  if (searchWords.length > 0) {
    const prefixMatch = services.find(s => {
      const sWords = normalizeForSearch(s.name).split(/\s+/)
      return searchWords.some(sw => sw.length >= 3 && sWords.some(sWord => sWord.startsWith(sw) || sw.startsWith(sWord)))
    })
    if (prefixMatch) return prefixMatch
  }

  return null
}
