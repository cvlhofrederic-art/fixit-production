// lib/syndic/max-parser.ts
// ──────────────────────────────────────────────────────────────────────────────
// Parser markdown du corpus juridique PT pour Max v1.1.
// Découpe par sous-section (1 chunk minimum par article ou par bullet H/J),
// préserve les Parties H et J (bullets), enrichit la `source` avec le code du
// diplôme pour la Partie I, et émet un chunk spécial `__TOC__` pour la
// stratégie hybride Anthropic (TOC pré-chargée + chunks à la demande).
// Réutilisable par la route HTTP d'ingestion et par les tests unitaires.
// ──────────────────────────────────────────────────────────────────────────────

export interface ParsedChunk {
  language: 'pt'
  source: string
  article: string | null
  title: string
  content: string
  theme: string | null
  parent_path: string
  chunk_index: number
}

const PARTE_RE = /^#\s+PARTE\s+([A-Z])\s+[—\-–]\s+(.+?)\s*$/
const SECCAO_RE = /^##\s+Secção\s+([IVXLC]+)\s+[—\-–]\s+(.+?)\s*$/
// ARTIGO_RE — titre optionnel : certains articles courts du DL 269/94 n'ont pas
// de titre après le numéro (`### Artigo 1.º`, sans tiret ni titre).
const ARTIGO_RE = /^###\s+Artigo\s+([\d.ºª\-A-Z]+)(?:\s*[—\-–]\s+(.+?))?\s*(?:`[^`]*`)?\s*$/
const H2_RE = /^##\s+(.+?)\s*$/
const H3_RE = /^###\s+(.+?)\s*(?:`[^`]*`)?\s*$/
// Pour la Partie I : extrait le code du diplôme depuis un titre comme
// « I.3 — Ascensores (Decreto-Lei n.º 320/2002) » ou
// « I.6.2 — Ruído (Decreto-Lei n.º 9/2007 — Regulamento Geral do Ruído) ».
// On accepte du texte additionnel après le numéro jusqu'à la parenthèse fermante.
const DIPLOMA_IN_TITLE_RE = /\((Decreto-Lei|Lei|Portaria)\s+n\.[ºª]\s*([\d-]+\/\d+(?:\/\d+)?)[^)]*\)/
// Bullets de la Partie H : « - **Atividade não regulada.** Texte... »
const BULLET_H_RE = /^-\s+\*\*([^*]+?)\.\*\*\s+(.+)$/
// Bullets de la Partie J (glossário) : « - **EMA** — Empresa de... »
const BULLET_J_RE = /^-\s+\*\*([^*]+?)\*\*\s*[—\-–]\s*(.+)$/

/**
 * Dérive l'identifiant `source` à partir du titre d'une `# PARTE`.
 * Ex.: "CÓDIGO CIVIL: REGIME DA PROPRIEDADE HORIZONTAL" → "Código Civil"
 *      "DECRETO-LEI N.º 268/94, DE 25 DE OUTUBRO" → "DL 268/94"
 *      "LEGISLAÇÃO CONEXA" → "Legislação conexa" (override possible par section, cf. extractDiplomaSource)
 */
export function deriveSource(parteTitle: string): string {
  const upper = parteTitle.toUpperCase()
  if (upper.startsWith('CÓDIGO CIVIL')) return 'Código Civil'
  if (upper.startsWith('CÓDIGO DO NOTARIADO')) return 'Código do Notariado'
  const decretoLei = upper.match(/DECRETO-LEI\s+N\.[ºª]\s*(\d+\/\d+)/)
  if (decretoLei) return `DL ${decretoLei[1]}`
  const lei = upper.match(/^LEI\s+N\.[ºª]\s*(\d+\/\d+)/)
  if (lei) return `Lei ${lei[1]}`
  if (upper.includes('JURISPRUDÊNCIA')) return 'Jurisprudência'
  if (upper.includes('COBRANÇA DE DÍVIDAS')) return 'Cobrança de dívidas'
  if (upper.includes('ENQUADRAMENTO PROFISSIONAL')) return 'Enquadramento profissional'
  if (upper.includes('LEGISLAÇÃO CONEXA')) return 'Legislação conexa'
  if (upper.includes('GLOSSÁRIO')) return 'Glossário'
  if (upper.includes('ENQUADRAMENTO E REFORMAS')) return 'Enquadramento geral'
  return parteTitle.split(/[:—,]/)[0].trim().slice(0, 50)
}

/**
 * Extrait un identifiant de diplôme depuis un titre H2 de la Partie I qui le
 * mentionne entre parenthèses. Retourne null sinon.
 * Ex.: "I.3 — Ascensores (Decreto-Lei n.º 320/2002)" → "DL 320/2002"
 */
export function extractDiplomaSource(sectionTitle: string): string | null {
  const m = sectionTitle.match(DIPLOMA_IN_TITLE_RE)
  if (!m) return null
  const kind = m[1]
  const num = m[2]
  if (kind === 'Decreto-Lei') return `DL ${num}`
  if (kind === 'Portaria') return `Portaria ${num}`
  return `Lei ${num}`
}

/**
 * Parse le corpus juridique PT en chunks indexables. Émet en dernier un chunk
 * spécial `parent_path='__TOC__'` contenant la table des matières (à utiliser
 * pour le pré-chargement dans le system prompt — exclu du retrieval par RPC).
 */
export function parseLegalMarkdown(markdown: string): ParsedChunk[] {
  const lines = markdown.split('\n')
  const chunks: ParsedChunk[] = []
  const tocEntries: Array<{ level: number; label: string }> = []
  let chunkIndex = 0
  let currentParteLetter = ''
  let currentParteTitle = ''
  let currentSource = ''
  let currentDiplomaSource: string | null = null
  let currentSeccaoTitle: string | null = null
  let currentTheme: string | null = null
  let pendingChunk: ParsedChunk | null = null
  let pendingBody: string[] = []
  let inUnstructuredParte = false

  const resolveSource = () => currentDiplomaSource || currentSource

  const flushPending = () => {
    if (pendingChunk && pendingBody.length > 0) {
      pendingChunk.content = pendingBody.join('\n').trim()
      if (pendingChunk.content.length >= 30) {
        chunks.push(pendingChunk)
        chunkIndex++
      }
    } else if (pendingChunk && pendingChunk.content && pendingChunk.content.length >= 30) {
      chunks.push(pendingChunk)
      chunkIndex++
    }
    pendingChunk = null
    pendingBody = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const parteMatch = line.match(PARTE_RE)
    if (parteMatch) {
      flushPending()
      currentParteLetter = parteMatch[1]
      currentParteTitle = parteMatch[2]
      currentSource = deriveSource(currentParteTitle)
      currentDiplomaSource = null
      currentSeccaoTitle = null
      currentTheme = null
      inUnstructuredParte = currentParteLetter === 'H' || currentParteLetter === 'J'
      tocEntries.push({ level: 1, label: `PARTE ${currentParteLetter} — ${currentParteTitle}` })
      continue
    }

    const seccaoMatch = line.match(SECCAO_RE)
    if (seccaoMatch) {
      flushPending()
      currentSeccaoTitle = `Secção ${seccaoMatch[1]} — ${seccaoMatch[2]}`
      currentTheme = seccaoMatch[2]
      tocEntries.push({ level: 2, label: currentSeccaoTitle })
      continue
    }

    const artigoMatch = line.match(ARTIGO_RE)
    if (artigoMatch) {
      flushPending()
      const articleNum = artigoMatch[1].trim()
      const rawTitle = artigoMatch[2]?.trim().replace(/`[^`]*`\s*$/, '').trim()
      const articleTitle = rawTitle && rawTitle.length > 0 ? rawTitle : `Artigo ${articleNum}`
      const pathParts = [`Parte ${currentParteLetter}`]
      if (currentSeccaoTitle) pathParts.push(currentSeccaoTitle)
      pathParts.push(`Artigo ${articleNum}`)
      pendingChunk = {
        language: 'pt',
        source: resolveSource(),
        article: articleNum,
        title: articleTitle,
        content: '',
        theme: currentTheme,
        parent_path: pathParts.join(' > '),
        chunk_index: chunkIndex,
      }
      pendingBody = []
      tocEntries.push({ level: 3, label: `Artigo ${articleNum} — ${articleTitle}` })
      continue
    }

    if (inUnstructuredParte) {
      const bulletH = line.match(BULLET_H_RE)
      const bulletJ = line.match(BULLET_J_RE)
      const bulletMatch = bulletH || bulletJ
      if (bulletMatch) {
        flushPending()
        const bTitle = bulletMatch[1].trim()
        const bContent = bulletMatch[2].trim()
        const theme = currentParteLetter === 'J' ? 'Glossário' : 'Enquadramento profissional'
        pendingChunk = {
          language: 'pt',
          source: currentSource,
          article: null,
          title: bTitle,
          content: bContent,
          theme,
          parent_path: `Parte ${currentParteLetter} > ${bTitle}`,
          chunk_index: chunkIndex,
        }
        pendingBody = []
        continue
      }
      if (pendingChunk) {
        pendingChunk.content = (pendingChunk.content + '\n' + line).trim()
      }
      continue
    }

    const h2Match = line.match(H2_RE)
    if (h2Match && currentParteLetter && !line.startsWith('## Secção')) {
      flushPending()
      const sectionTitle = h2Match[1].trim().replace(/`[^`]*`\s*$/, '').trim()
      currentDiplomaSource = null
      if (currentParteLetter === 'I') {
        const diplomaSource = extractDiplomaSource(sectionTitle)
        if (diplomaSource) currentDiplomaSource = diplomaSource
      }
      pendingChunk = {
        language: 'pt',
        source: resolveSource(),
        article: null,
        title: sectionTitle,
        content: '',
        theme: sectionTitle,
        parent_path: `Parte ${currentParteLetter} > ${sectionTitle}`,
        chunk_index: chunkIndex,
      }
      pendingBody = []
      tocEntries.push({ level: 2, label: sectionTitle })
      continue
    }

    if (!pendingChunk?.article) {
      const h3Match = line.match(H3_RE)
      if (h3Match && currentParteLetter && !line.startsWith('### Artigo')) {
        if (pendingChunk) flushPending()
        const subTitle = h3Match[1].trim()
        // Pour la Partie I, certains H3 portent le code du diplôme dans leur
        // titre (ex.: `### I.6.1 — Alojamento local (Decreto-Lei n.º 128/2014)`).
        // On override currentDiplomaSource le temps de cette section.
        if (currentParteLetter === 'I') {
          const diplomaSource = extractDiplomaSource(subTitle)
          if (diplomaSource) {
            currentDiplomaSource = diplomaSource
          }
          // Si le H3 n'a pas de code, on garde le code éventuel du H2 parent
          // (utile pour les sous-sections sans parenthèses comme I.3.1, I.3.2).
        }
        pendingChunk = {
          language: 'pt',
          source: resolveSource(),
          article: null,
          title: subTitle,
          content: '',
          theme: currentTheme,
          parent_path: `Parte ${currentParteLetter} > ${subTitle}`,
          chunk_index: chunkIndex,
        }
        pendingBody = []
        tocEntries.push({ level: 3, label: subTitle })
        continue
      }
    }

    if (pendingChunk) pendingBody.push(line)
  }
  flushPending()

  // Split oversized
  const MAX = 4000
  const result: ParsedChunk[] = []
  let idx = 0
  for (const c of chunks) {
    if (c.content.length <= MAX) {
      result.push({ ...c, chunk_index: idx++ })
      continue
    }
    const paragraphs = c.content.split(/\n\n+/)
    let cur = ''
    let subPart = 1
    const flushSub = () => {
      if (cur.trim().length >= 30) {
        result.push({
          ...c,
          content: cur.trim(),
          title: subPart === 1 ? c.title : `${c.title} (parte ${subPart})`,
          parent_path: subPart === 1 ? c.parent_path : `${c.parent_path} (parte ${subPart})`,
          chunk_index: idx++,
        })
        subPart++
      }
      cur = ''
    }
    for (const p of paragraphs) {
      if ((cur + '\n\n' + p).length > MAX && cur.length > 0) flushSub()
      cur = cur ? `${cur}\n\n${p}` : p
    }
    flushSub()
  }

  // TOC chunk — parent_path='__TOC__' permet le filtrage côté RPC (cf. migration 20260521)
  if (tocEntries.length > 0) {
    const tocContent = tocEntries
      .map((e) => '  '.repeat(e.level - 1) + '- ' + e.label)
      .join('\n')
    result.push({
      language: 'pt',
      source: 'Índice',
      article: null,
      title: 'Índice da base de conhecimento',
      content: tocContent,
      theme: 'Índice',
      parent_path: '__TOC__',
      chunk_index: idx++,
    })
  }

  return result
}
