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

/**
 * Langue du message, celle de l'interface. Le français est lu comme avant ; le portugais (Fixy en /pt/, repli sans IA)
 * a ses propres règles et n'est jamais essayé sur un message français.
 */
export type LangueMessage = 'fr' | 'pt'

// ══════════════ DATE / TIME / TEXT PARSERS ══════════════

/**
 * AAAA-MM-JJ d'après la date LOCALE. toISOString passait en UTC : une date explicite (minuit local) tombait la veille
 * en France et au Portugal l'été, comme un message envoyé peu après minuit.
 */
function jourLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dansNJours(base: Date, n: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return jourLocal(d)
}

/** Prochain jour de la semaine donné (0 = dimanche), jamais le jour même. */
function prochainJour(now: Date, jourSemaine: number): string {
  let diff = jourSemaine - now.getDay()
  if (diff <= 0) diff += 7
  return dansNJours(now, diff)
}

function parseDateFr(lower: string, now: Date): string | null {
  // "aujourd'hui"
  if (lower.includes("aujourd'hui") || lower.includes('ajd') || lower.includes('today')) return jourLocal(now)

  // "après-demain" avant "demain", qu'il contient (avant : « après-demain » donnait demain)
  if (lower.includes('après-demain') || lower.includes('apres-demain') || lower.includes('après demain')) return dansNJours(now, 2)

  // "demain"
  if (lower.includes('demain')) return dansNJours(now, 1)

  // Jours de la semaine
  const jours: Record<string, number> = {
    'lundi': 1, 'mardi': 2, 'mercredi': 3, 'jeudi': 4,
    'vendredi': 5, 'samedi': 6, 'dimanche': 0
  }
  for (const [jour, idx] of Object.entries(jours)) {
    if (lower.includes(jour)) return prochainJour(now, idx)
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
    return jourLocal(d)
  }

  // "17/03" or "17/03/2025"
  const dateSlashMatch = lower.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/)
  if (dateSlashMatch) {
    const day = parseInt(dateSlashMatch[1])
    const month = parseInt(dateSlashMatch[2]) - 1
    let year = dateSlashMatch[3] ? parseInt(dateSlashMatch[3]) : now.getFullYear()
    if (year < 100) year += 2000
    return jourLocal(new Date(year, month, day))
  }

  return null
}

// Jours de la semaine en portugais, mot entier (« segunda » ou « segunda-feira »).
const DIAS_PT: ReadonlyArray<[RegExp, number]> = [
  [/(?:^|[^a-zà-ÿ])segunda(?![a-zà-ÿ])/, 1],
  [/(?:^|[^a-zà-ÿ])ter[çc]a(?![a-zà-ÿ])/, 2],
  [/(?:^|[^a-zà-ÿ])quarta(?![a-zà-ÿ])/, 3],
  [/(?:^|[^a-zà-ÿ])quinta(?![a-zà-ÿ])/, 4],
  [/(?:^|[^a-zà-ÿ])sexta(?![a-zà-ÿ])/, 5],
  [/(?:^|[^a-zà-ÿ])s[áa]bado(?![a-zà-ÿ])/, 6],
  [/(?:^|[^a-zà-ÿ])domingo(?![a-zà-ÿ])/, 0],
]
const MESES_PT: Record<string, number> = {
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
}

/**
 * Jour donné (mois de 0 à 11). Sans année, une date déjà passée (avant aujourd'hui, pas avant l'heure qu'il est)
 * passe à l'année suivante. Jour ou mois impossible (« 31/13 », « 31/04 ») : pas de date.
 */
function dataPt(dia: number, mes: number, ano: number | null, now: Date): string | null {
  if (mes < 0 || mes > 11 || dia < 1 || dia > 31) return null
  const d = new Date(ano ?? now.getFullYear(), mes, dia)
  if (d.getMonth() !== mes) return null
  if (ano === null && d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setFullYear(d.getFullYear() + 1)
  return jourLocal(d)
}

function parseDatePt(lower: string, now: Date): string | null {
  if (/(?:^|[^a-zà-ÿ])hoje(?![a-zà-ÿ])/.test(lower)) return jourLocal(now)
  // « depois de amanhã » avant « amanhã », qu'il contient.
  if (/depois de amanh[ãa]/.test(lower)) return dansNJours(now, 2)
  if (/(?:^|[^a-zà-ÿ])amanh[ãa](?![a-zà-ÿ])/.test(lower)) return dansNJours(now, 1)
  // Date chiffrée avant les jours de la semaine (« 17/03 às 15h, Quinta do Lago » : c'est le 17/03).
  const numerique = /(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/.exec(lower)
  if (numerique) {
    let ano = numerique[3] ? Number.parseInt(numerique[3], 10) : null
    if (ano !== null && ano < 100) ano += 2000
    const data = dataPt(Number.parseInt(numerique[1], 10), Number.parseInt(numerique[2], 10) - 1, ano, now)
    if (data) return data
  }
  // « 17 de março », « 17 março 2027 »
  const m = /(\d{1,2})\s+(?:de\s+)?(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+(?:de\s+)?(\d{4}))?/.exec(lower)
  if (m) {
    const data = dataPt(Number.parseInt(m[1], 10), MESES_PT[m[2].replace('ç', 'c')], m[3] ? Number.parseInt(m[3], 10) : null, now)
    if (data) return data
  }
  for (const [motif, idx] of DIAS_PT) {
    if (motif.test(lower)) return prochainJour(now, idx)
  }
  return null
}

export function parseDate(text: string, langue: LangueMessage = 'fr'): string | null {
  const lower = text.toLowerCase()
  const now = new Date()
  if (langue !== 'pt') return parseDateFr(lower, now)
  // La morada est retirée d'abord : « Avenida 25 de Abril », « Rua 5 de Outubro » ne sont pas des dates.
  const morada = moradaPtTrecho(lower)
  return parseDatePt(morada ? `${lower.slice(0, morada.inicio)} ${lower.slice(morada.fim)}` : lower, now)
}

export function parseTime(text: string, langue: LangueMessage = 'fr'): string | null {
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

  if (langue === 'pt') {
    // meio-dia, de manhã (pas « amanhã »), à tarde, à noite
    if (/meio[\s-]dia/.test(lower)) return '12:00'
    if (/(?:^|[^a-zà-ÿ])manh[ãa](?![a-zà-ÿ])/.test(lower)) return '09:00'
    if (/(?:^|[^a-zà-ÿ])tarde(?![a-zà-ÿ])/.test(lower)) return '14:00'
    if (/(?:^|[^a-zà-ÿ])noite(?![a-zà-ÿ])/.test(lower)) return '18:00'
    return null
  }

  // "midi"
  if (lower.includes('midi')) return '12:00'
  // Approximations
  if (lower.includes('matin')) return '09:00'
  if (lower.includes('après-midi') || lower.includes('aprem')) return '14:00'
  if (lower.includes('soir')) return '18:00'

  return null
}

// Mots qui ne sont pas des noms : français comparés par début de mot (comme avant), portugais par mot entier
// (« Sr. Domingos », « Sra. Quintas » restent des noms).
const EXCLUS_NOM_FR = [
  'intervention', 'devis', 'facture', 'rendez', 'demain', 'mardi', 'mercredi',
  'jeudi', 'vendredi', 'samedi', 'dimanche', 'lundi', 'plomberie', 'electricite',
  'motif', 'prix', 'montant', 'service', 'prestation', 'travaux',
]
const EXCLUS_NOM_PT = new Set([
  'intervenção', 'intervencao', 'orçamento', 'orcamento', 'fatura', 'marcação', 'marcacao', 'hoje', 'amanhã', 'amanha',
  'segunda', 'terça', 'terca', 'quarta', 'quinta', 'sexta', 'sábado', 'sabado', 'domingo', 'motivo', 'serviço',
  'servico', 'preço', 'preco', 'valor', 'obra', 'canalização', 'canalizacao', 'eletricidade', 'para', 'com', 'cliente',
  'na', 'no', 'em', 'às', 'as', 'ao', 'à', 'manhã', 'manha', 'tarde', 'noite', 'meio', 'morada', 'rua', 'avenida',
  'travessa', 'largo', 'praça', 'praca', 'estrada', 'alameda',
])
// Particules des noms portugais (« Maria da Silva ») : gardées au milieu, retirées en fin (« Sr. Silva de manhã »).
const PARTICULES_NOM_PT = new Set(['de', 'do', 'da', 'dos', 'das', 'e'])

const NOMS_FR = [
  /(?:madame|mme\.?|mme)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
  /(?:monsieur|mr\.?|m\.)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
  /(?:client[e]?|chez)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
  // "pour le client X Y Z" — match name after "client"
  /(?:pour\s+le\s+client|pour\s+la\s+cliente)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
  /(?:pour|avec)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
]
// Portugais : mots entiers seulement (« sr » n'est pas cherché au milieu d'un mot).
const NOMS_PT = [
  /(?:^|[^a-zà-ÿ])(?:senhora|sra\.?)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
  /(?:^|[^a-zà-ÿ])(?:senhor|sr\.?)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
  /(?:^|[^a-zà-ÿ])para\s+[oa]\s+cliente\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
  /(?:^|[^a-zà-ÿ])cliente\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
  /(?:^|[^a-zà-ÿ])(?:para|com)\s+(?:[oa]\s+)?([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
]

export function parseClientName(text: string, langue: LangueMessage = 'fr'): string | null {
  // FR : "Madame X", "Mme X", "Monsieur X", "M. X", "Mr X", "client X", "chez X", noms en plusieurs mots
  // ("Jean Pierre Martin"). PT : "Sra. X", "Senhora X", "Sr. X", "Senhor X", "para o cliente X", "para X", "com X".
  const pt = langue === 'pt'
  const exclu = (mot: string) => (pt ? EXCLUS_NOM_PT.has(mot.toLowerCase()) : EXCLUS_NOM_FR.some(e => mot.toLowerCase().startsWith(e)))

  for (const pat of pt ? NOMS_PT : NOMS_FR) {
    const match = text.match(pat)
    if (match) {
      let name = match[1].trim()
      // Remove trailing common words that got captured
      const nameWords = name.split(/\s+/)
      const cleanWords: string[] = []
      for (const w of nameWords) {
        if (exclu(w)) break
        cleanWords.push(w)
      }
      while (pt && cleanWords.length > 0 && PARTICULES_NOM_PT.has(cleanWords[cleanWords.length - 1].toLowerCase())) {
        cleanWords.pop()
      }
      name = cleanWords.join(' ')
      if (name && (pt || !EXCLUS_NOM_FR.some(e => name.toLowerCase().startsWith(e)))) {
        return name
      }
    }
  }

  return null
}

// « motivo X » / « serviço X » (portugais) : mots qui suivent, jusqu'à « preço », « para », « cliente », « valor »,
// une virgule ou un mot qui n'est pas fait que de lettres. Découpe mot par mot (pas de regex à retour arrière).
const FIN_MOTIVO_PT = new Set(['preço', 'preco', 'para', 'cliente', 'valor'])
function motivoPt(lower: string): string | null {
  const debut = /(?:^|[^a-zà-ÿ])(?:motivo|servi[çc]o)\s/.exec(lower)
  if (!debut) return null
  const mots: string[] = []
  for (const mot of lower.slice(debut.index + debut[0].length).split(/\s+/)) {
    if (!mot) continue
    const virgule = mot.endsWith(',')
    const propre = virgule ? mot.slice(0, -1) : mot
    if (FIN_MOTIVO_PT.has(propre) || !/^[a-zà-ÿ]+$/.test(propre)) break
    mots.push(propre)
    if (virgule) break
  }
  return mots.length > 0 ? mots.join(' ') : null
}

export function parseServiceMatch(text: string, services: ServiceItem[], langue: LangueMessage = 'fr'): ServiceItem | null {
  const lower = text.toLowerCase()

  // First try to extract service from "motif X" pattern (« motivo X » / « serviço X » en portugais)
  let motifText: string | null
  if (langue === 'pt') {
    motifText = motivoPt(lower)
  } else {
    const motifMatch = lower.match(/motif\s+([a-zà-ÿéèêë\s]+?)(?:\s+prix|\s+pour|\s+client|\s*,|\s*$)/i)
    motifText = motifMatch ? motifMatch[1].trim() : null
  }

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

// Morada (portugais) : « na Rua das Flores 12 », « morada Avenida da Boavista 100 ». Mots qui suivent le type de voie,
// jusqu'à « às », « hoje », « amanhã », « para », « Sr. », une heure (« 10h ») ou une virgule. Un jour de la semaine ne
// coupe qu'après un numéro (« Rua das Flores 12 sexta ») : « Rua da Quinta » reste entière. Découpe mot par mot (pas de
// regex à retour arrière) ; la position sert à retirer la morada avant de chercher la date.
const FIN_MORADA_PT = new Set([
  'às', 'as', 'hoje', 'amanhã', 'amanha', 'depois', 'para', 'com', 'sr', 'sr.', 'sra', 'sra.', 'senhor', 'senhora', 'cliente',
])
const DIA_SEMANA_PT = /^(?:(?:segunda|ter[çc]a|quarta|quinta|sexta)(?:-feira)?|s[áa]bado|domingo)$/
function moradaPtTrecho(text: string): { valor: string; inicio: number; fim: number } | null {
  const debut = /(?:^|[^A-Za-zÀ-ÿ])(?:na|no|em|morada:?)\s+(?=(?:rua|avenida|av\.|travessa|largo|pra[çc]a|estrada|alameda)\s)/i.exec(text)
  if (!debut) return null
  const inicio = debut.index + debut[0].length
  const mots: string[] = []
  let fim = inicio
  for (const m of text.slice(inicio).matchAll(/\S+/g)) {
    const mot = m[0]
    const virgule = mot.endsWith(',')
    const propre = virgule ? mot.slice(0, -1) : mot
    const bas = propre.toLowerCase()
    const apresNumero = mots.length > 0 && /\d$/.test(mots[mots.length - 1])
    if (FIN_MORADA_PT.has(bas) || /^\d{1,2}h\d{0,2}$/.test(bas) || (apresNumero && DIA_SEMANA_PT.test(bas))) break
    mots.push(propre)
    fim = inicio + (m.index ?? 0) + propre.length
    if (virgule) break
  }
  return mots.length > 0 ? { valor: mots.join(' '), inicio, fim } : null
}

export function parseAddress(text: string, langue: LangueMessage = 'fr'): string | null {
  if (langue === 'pt') return moradaPtTrecho(text)?.valor ?? null
  // "au 123 rue X" or "à 123 avenue Y"
  const match = text.match(/(?:au|à|chez|adresse)\s+(\d+.*?)(?:\s*,\s*|\s+(?:à|pour|le|mardi|lundi|mercredi|jeudi|vendredi|samedi|dimanche|demain|aujourd)|\s*$)/i)
  if (match) return match[1].trim()
  return null
}

// ══════════════ INTENT DETECTION ══════════════

function detectIntentPt(text: string, lower: string): Intent {
  // « as minhas (próximas) marcações », « a minha agenda », « marcações » listent ; « marcação », « marcar »,
  // « agendar », « visita » créent.
  const liste = /(?:pr[óo]xim[ao]s?|minhas)\s+marca[çc](?:[õo]es|[ãa]o)|minha agenda|ver (?:a )?agenda|(?:^|[^a-zà-ÿ])marca[çc][õo]es(?![a-zà-ÿ])/.test(lower)
  if (liste) return 'list_rdv'
  if (/marca[çc][ãa]o|(?:^|[^a-zà-ÿ])(?:marcar|agendar|visita)(?![a-zà-ÿ])/.test(lower)) return 'create_rdv'
  if (/or[çc]amento/.test(lower)) return 'create_devis'
  if (/(?:^|[^a-zà-ÿ])fatura(?![a-zà-ÿ])/.test(lower)) return 'create_facture'
  if (/(?:^|[^a-zà-ÿ])(?:agenda|planeamento|lista)(?![a-zà-ÿ])/.test(lower)) return 'list_rdv'
  if (/(?:^|[^a-zà-ÿ])(?:ajuda|ol[áa]|como|bom dia|boa tarde|o que)(?![a-zà-ÿ])/.test(lower)) return 'help'
  // Une date, une heure et un nom : une marcação
  if (parseDate(text, 'pt') && parseTime(text, 'pt') && parseClientName(text, 'pt')) return 'create_rdv'
  return 'unknown'
}

export function detectIntent(text: string, langue: LangueMessage = 'fr'): Intent {
  const lower = text.toLowerCase()
  if (langue === 'pt') return detectIntentPt(text, lower)

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
