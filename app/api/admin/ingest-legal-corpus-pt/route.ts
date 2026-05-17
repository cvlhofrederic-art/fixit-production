// One-shot d'ingestion du corpus juridique PT depuis le Worker Cloudflare,
// utilisant le binding AI (zéro token requis) pour BGE-M3 embeddings.
//
// Auth : super_admin uniquement (defense-in-depth + email allowlist).
//
// Usage :
//   curl -X POST https://vitfix.io/api/admin/ingest-legal-corpus-pt \
//        -H "Authorization: Bearer <super_admin_access_token>"
//
// Idempotent : skip les chunks déjà ingérés (chunk_hash UNIQUE).

import { NextResponse, type NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { getAuthUser, isSuperAdmin } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { embedBatch, formatVectorLiteral } from '@/lib/syndic/embed'
import { decodeCorpusMd } from '@/lib/syndic/legal-corpus-pt-md'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { logger } from '@/lib/logger'

export const maxDuration = 30

// ── Types parser (réutilise la logique du script Node) ──────────────────────

interface ParsedChunk {
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
const ARTIGO_RE = /^###\s+Artigo\s+([\d.ºª\-A-Z]+)\s*[—\-–]\s+(.+?)\s*(?:`[^`]*`)?\s*$/
const H2_RE = /^##\s+(.+?)\s*$/
const H3_RE = /^###\s+(.+?)\s*(?:`[^`]*`)?\s*$/

function deriveSource(parteTitle: string): string {
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

function parseLegalMarkdown(markdown: string): ParsedChunk[] {
  const lines = markdown.split('\n')
  const chunks: ParsedChunk[] = []
  let chunkIndex = 0
  let currentParteLetter = ''
  let currentParteTitle = ''
  let currentSource = ''
  let currentSeccaoTitle: string | null = null
  let currentTheme: string | null = null
  let pendingChunk: ParsedChunk | null = null
  let pendingBody: string[] = []

  const flushPending = () => {
    if (pendingChunk && pendingBody.length > 0) {
      pendingChunk.content = pendingBody.join('\n').trim()
      if (pendingChunk.content.length >= 30) {
        chunks.push(pendingChunk)
        chunkIndex++
      }
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
      currentSeccaoTitle = null
      currentTheme = null
      continue
    }
    const seccaoMatch = line.match(SECCAO_RE)
    if (seccaoMatch) {
      flushPending()
      currentSeccaoTitle = `Secção ${seccaoMatch[1]} — ${seccaoMatch[2]}`
      currentTheme = seccaoMatch[2]
      continue
    }
    const artigoMatch = line.match(ARTIGO_RE)
    if (artigoMatch) {
      flushPending()
      const articleNum = artigoMatch[1].trim()
      const articleTitle = artigoMatch[2].trim().replace(/`[^`]*`\s*$/, '').trim()
      const pathParts = [`Parte ${currentParteLetter}`]
      if (currentSeccaoTitle) pathParts.push(currentSeccaoTitle)
      pathParts.push(`Artigo ${articleNum}`)
      pendingChunk = {
        language: 'pt',
        source: currentSource,
        article: articleNum,
        title: articleTitle,
        content: '',
        theme: currentTheme,
        parent_path: pathParts.join(' > '),
        chunk_index: chunkIndex,
      }
      pendingBody = []
      continue
    }
    if (!currentSeccaoTitle && !pendingChunk) {
      const h2Match = line.match(H2_RE)
      if (h2Match && currentParteLetter && !line.startsWith('## Secção')) {
        flushPending()
        const sectionTitle = h2Match[1].trim().replace(/`[^`]*`\s*$/, '').trim()
        pendingChunk = {
          language: 'pt',
          source: currentSource,
          article: null,
          title: sectionTitle,
          content: '',
          theme: sectionTitle,
          parent_path: `Parte ${currentParteLetter} > ${sectionTitle}`,
          chunk_index: chunkIndex,
        }
        pendingBody = []
        continue
      }
    }
    if (!pendingChunk?.article) {
      const h3Match = line.match(H3_RE)
      if (h3Match && currentParteLetter && !line.startsWith('### Artigo')) {
        if (pendingChunk) flushPending()
        const subTitle = h3Match[1].trim()
        pendingChunk = {
          language: 'pt',
          source: currentSource,
          article: null,
          title: subTitle,
          content: '',
          theme: currentTheme,
          parent_path: `Parte ${currentParteLetter} > ${subTitle}`,
          chunk_index: chunkIndex,
        }
        pendingBody = []
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
  return result
}

function chunkHash(c: ParsedChunk): string {
  const normalized = `${c.source}|${c.article ?? ''}|${c.title}|${c.content.trim().replace(/\s+/g, ' ')}`
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

function buildHypotheticalQuestion(c: ParsedChunk): string {
  if (c.article) return `O que diz o ${c.source} no Artigo ${c.article} sobre ${c.title}?`
  return `O que diz a legislação portuguesa sobre ${c.title}?`
}

// ─────────────────────────────────────────────────────────────────────────────
// Route POST — ingestion idempotente
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'super_admin_required' }, { status: 403 })
  }

  // Récupère le binding AI (zéro token requis au runtime Worker)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aiBinding: any = null
  try {
    const ctx = await getCloudflareContext({ async: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aiBinding = (ctx as any)?.env?.AI ?? null
  } catch (err) {
    logger.warn('[ingest-legal-corpus-pt] no CF context, will use REST fallback', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // Parse le MD inline
  const md = decodeCorpusMd()
  const chunks = parseLegalMarkdown(md)

  // Filtre les chunks déjà présents (idempotence)
  const hashes = chunks.map(chunkHash)
  const { data: existing } = await supabaseAdmin
    .from('syndic_legal_corpus_pt')
    .select('chunk_hash')
    .in('chunk_hash', hashes)
  const existingSet = new Set((existing ?? []).map((r) => r.chunk_hash as string))
  const toInsert = chunks.filter((_, i) => !existingSet.has(hashes[i]))

  if (toInsert.length === 0) {
    return NextResponse.json({
      ok: true,
      total: chunks.length,
      inserted: 0,
      skipped: chunks.length,
      message: 'Tous les chunks sont déjà ingérés',
    })
  }

  let inserted = 0
  const errors: string[] = []
  const BATCH_SIZE = 16

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE)
    try {
      const contentVecs = await embedBatch(
        batch.map((c) => `${c.title}\n\n${c.content}`),
        { aiBinding },
      )
      const questionVecs = await embedBatch(
        batch.map(buildHypotheticalQuestion),
        { aiBinding },
      )
      const rows = batch.map((c, j) => ({
        source: c.source,
        article: c.article,
        title: c.title,
        content: c.content,
        theme: c.theme,
        parent_path: c.parent_path,
        chunk_index: c.chunk_index,
        language: 'pt' as const,
        chunk_hash: chunkHash(c),
        embedding: formatVectorLiteral(contentVecs[j]),
        question_embedding: formatVectorLiteral(questionVecs[j]),
        version: 1,
      }))
      const { error } = await supabaseAdmin
        .from('syndic_legal_corpus_pt')
        .upsert(rows, { onConflict: 'chunk_hash' })
      if (error) {
        errors.push(`batch ${i / BATCH_SIZE + 1}: ${error.message}`)
      } else {
        inserted += batch.length
      }
    } catch (err) {
      errors.push(`batch ${i / BATCH_SIZE + 1}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    total: chunks.length,
    inserted,
    skipped: chunks.length - toInsert.length,
    errors,
  })
}

// Handler GET pour vérifier la couverture (audit + monitoring)
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'super_admin_required' }, { status: 403 })
  }
  const { count } = await supabaseAdmin
    .from('syndic_legal_corpus_pt')
    .select('*', { count: 'exact', head: true })
  const { data: withEmbedding } = await supabaseAdmin
    .from('syndic_legal_corpus_pt')
    .select('id', { count: 'exact', head: true })
    .not('embedding', 'is', null)
  return NextResponse.json({
    total_chunks: count ?? 0,
    chunks_with_embedding: (withEmbedding as unknown as { count?: number })?.count ?? 0,
  })
}
