#!/usr/bin/env tsx
// ═══════════════════════════════════════════════════════════════════════════
// Script d'ingestion du corpus juridique PT (Régime du condomínio Portugal)
// ═══════════════════════════════════════════════════════════════════════════
// Pipeline :
//   1. Lit le fichier MD
//   2. Parse hiérarchiquement (# PARTE > ## Secção > ### Artigo)
//   3. Pour chaque chunk : génère un hash, vérifie l'idempotence DB
//   4. Si nouveau : embed via BGE-M3 (Cloudflare Workers AI)
//   5. Insert dans syndic_legal_corpus_pt avec toutes les métadonnées
//
// Usage :
//   CLOUDFLARE_API_TOKEN=xxx SUPABASE_SERVICE_ROLE_KEY=xxx \
//   npx tsx scripts/ingest-legal-corpus-pt.ts <chemin-vers-md>
//
// Variables d'env requises :
//   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (Workers AI scope)
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Idempotent : peut être relancé sans danger — les chunks déjà ingérés
// (même chunk_hash) sont skippés.

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { embedBatch, formatVectorLiteral } from '../lib/syndic/embed'

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedChunk {
  language: 'pt'
  source: string             // ex: "Código Civil", "DL 268/94"
  article: string | null     // ex: "1432.º" ou null pour les sections de prose
  title: string              // ex: "Convocação e funcionamento da assembleia"
  content: string            // le texte intégral de l'article ou de la section
  theme: string | null       // ex: "Administração das partes comuns"
  parent_path: string        // ex: "Parte B > Secção IV > Artigo 1432.º"
  chunk_index: number        // ordre dans le fichier
}

// ── Parser MD ────────────────────────────────────────────────────────────────

const PARTE_RE = /^#\s+PARTE\s+([A-Z])\s+[—\-–]\s+(.+?)\s*$/
const SECCAO_RE = /^##\s+Secção\s+([IVXLC]+)\s+[—\-–]\s+(.+?)\s*$/
const ARTIGO_RE = /^###\s+Artigo\s+([\d.ºª\-A-Z]+)\s*[—\-–]\s+(.+?)\s*(?:`[^`]*`)?\s*$/
const H2_RE = /^##\s+(.+?)\s*$/
const H3_RE = /^###\s+(.+?)\s*(?:`[^`]*`)?\s*$/

/**
 * Détermine la "source" légale à partir du titre de la Parte.
 * Ex: "PARTE B — CÓDIGO CIVIL: REGIME DA PROPRIEDADE HORIZONTAL" → "Código Civil"
 *     "PARTE C — DECRETO-LEI N.º 268/94, DE 25 DE OUTUBRO" → "DL 268/94"
 *     "PARTE D — DECRETO-LEI N.º 269/94, DE 25 DE OUTUBRO" → "DL 269/94"
 *     "PARTE E — CÓDIGO DO NOTARIADO, ARTIGO 54.º" → "Código do Notariado"
 *     "PARTE F — QUADRO PROCESSUAL DA COBRANÇA DE DÍVIDAS" → "Cobrança de dívidas"
 *     "PARTE G — JURISPRUDÊNCIA ESSENCIAL" → "Jurisprudência"
 *     "PARTE H — ENQUADRAMENTO PROFISSIONAL" → "Enquadramento profissional"
 *     "PARTE I — LEGISLAÇÃO CONEXA" → "Legislação conexa"
 *     "PARTE J — GLOSSÁRIO" → "Glossário"
 */
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
  // Fallback : le titre brut tronqué
  return parteTitle.split(/[:—,]/)[0].trim().slice(0, 50)
}

/**
 * Normalise un numéro d'article pour stockage uniforme.
 * Ex: "1432.º" reste tel quel, "1.º-A" reste tel quel.
 */
function normalizeArticleNumber(raw: string): string {
  return raw.trim()
}

/**
 * Parse le MD en chunks structurés.
 */
export function parseLegalMarkdown(markdown: string): ParsedChunk[] {
  const lines = markdown.split('\n')
  const chunks: ParsedChunk[] = []
  let chunkIndex = 0

  let currentParteLetter = ''
  let currentParteTitle = ''
  let currentSource = ''
  let currentSeccaoTitle: string | null = null
  let currentTheme: string | null = null

  // Buffer pour le chunk en cours de construction
  let pendingChunk: ParsedChunk | null = null
  let pendingBody: string[] = []

  const flushPending = () => {
    if (pendingChunk && pendingBody.length > 0) {
      pendingChunk.content = pendingBody.join('\n').trim()
      // On ne stocke que si le contenu est non trivial (> 30 chars)
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

    // ── # PARTE — changement de partie ──
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

    // ── ## Secção — sous-section avec articles ──
    const seccaoMatch = line.match(SECCAO_RE)
    if (seccaoMatch) {
      flushPending()
      currentSeccaoTitle = `Secção ${seccaoMatch[1]} — ${seccaoMatch[2]}`
      currentTheme = seccaoMatch[2]
      continue
    }

    // ── ### Artigo — article (chunk principal) ──
    const artigoMatch = line.match(ARTIGO_RE)
    if (artigoMatch) {
      flushPending()
      const articleNum = normalizeArticleNumber(artigoMatch[1])
      const articleTitle = artigoMatch[2].trim().replace(/`[^`]*`\s*$/, '').trim()
      const pathParts: string[] = [`Parte ${currentParteLetter}`]
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

    // ── ## autre header H2 (PARTE A, F, G, H, I, J — sections de prose) ──
    if (!currentSeccaoTitle && !pendingChunk) {
      const h2Match = line.match(H2_RE)
      // Filtre les ## déjà gérés (Secção et noterais déjà capturés ci-dessus)
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

    // ── ### header H3 hors article (rare) — nouveau sub-chunk dans une prose ──
    if (!pendingChunk?.article) {
      const h3Match = line.match(H3_RE)
      if (h3Match && currentParteLetter && !line.startsWith('### Artigo')) {
        // Si on est dans un chunk de prose, on flush et démarre un nouveau sub-chunk
        if (pendingChunk) {
          flushPending()
        }
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

    // ── Lignes de contenu : ajout au buffer du chunk en cours ──
    if (pendingChunk) {
      pendingBody.push(line)
    }
  }

  flushPending()

  // Découpage final : pour les chunks de prose trop longs (> 4000 chars),
  // on split par paragraphes pour rester gérable côté retrieval.
  return splitOversizedChunks(chunks)
}

/**
 * Sépare les chunks de plus de 4000 chars en sub-chunks par paragraphes,
 * en préservant la métadonnée parent. Les articles juridiques sont rarement
 * concernés (les plus longs font ~2500 chars).
 */
function splitOversizedChunks(chunks: ParsedChunk[]): ParsedChunk[] {
  const MAX_CHARS = 4000
  const result: ParsedChunk[] = []
  let idx = 0
  for (const c of chunks) {
    if (c.content.length <= MAX_CHARS) {
      result.push({ ...c, chunk_index: idx++ })
      continue
    }
    const paragraphs = c.content.split(/\n\n+/)
    let current = ''
    let subPart = 1
    const flushSub = () => {
      if (current.trim().length >= 30) {
        result.push({
          ...c,
          content: current.trim(),
          title: subPart === 1 ? c.title : `${c.title} (parte ${subPart})`,
          parent_path: subPart === 1 ? c.parent_path : `${c.parent_path} (parte ${subPart})`,
          chunk_index: idx++,
        })
        subPart++
      }
      current = ''
    }
    for (const p of paragraphs) {
      if ((current + '\n\n' + p).length > MAX_CHARS && current.length > 0) {
        flushSub()
      }
      current = current ? `${current}\n\n${p}` : p
    }
    flushSub()
  }
  return result
}

// ── Hash de contenu pour idempotence ─────────────────────────────────────────

function chunkHash(c: ParsedChunk): string {
  // Hash basé sur source + article + title + content normalisé
  const normalized = `${c.source}|${c.article ?? ''}|${c.title}|${c.content.trim().replace(/\s+/g, ' ')}`
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

// ── Génération de question hypothétique pour dual embedding ──────────────────
// Pour booster le recall on génère 1-2 questions types qu'un syndic poserait
// pour ce chunk, et on embed CES questions en parallèle du contenu brut.
// Heuristique sans LLM call : pour les articles, on construit une question
// canonique à partir du titre + n° d'article.

function buildHypotheticalQuestion(c: ParsedChunk): string {
  if (c.article) {
    return `O que diz o ${c.source} no Artigo ${c.article} sobre ${c.title}?`
  }
  return `O que diz a legislação portuguesa sobre ${c.title}?`
}

// ── Ingestion ────────────────────────────────────────────────────────────────

interface IngestionStats {
  total: number
  inserted: number
  skipped: number
  errors: number
}

async function ingest(filePath: string): Promise<IngestionStats> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis')
  }
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_API_TOKEN requis')
  }

  console.log(`[ingest-pt] Lecture du fichier ${filePath}`)
  const md = readFileSync(filePath, 'utf-8')
  console.log(`[ingest-pt] ${md.length} caractères, ${md.split('\n').length} lignes`)

  const chunks = parseLegalMarkdown(md)
  console.log(`[ingest-pt] ${chunks.length} chunks parsés`)
  console.log(`[ingest-pt]   - Articles : ${chunks.filter((c) => c.article).length}`)
  console.log(`[ingest-pt]   - Sections prose : ${chunks.filter((c) => !c.article).length}`)

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const stats: IngestionStats = { total: chunks.length, inserted: 0, skipped: 0, errors: 0 }

  // 1. Identifier les chunks à insérer (idempotence)
  const hashes = chunks.map(chunkHash)
  const { data: existing, error: lookupErr } = await supabase
    .from('syndic_legal_corpus_pt')
    .select('chunk_hash')
    .in('chunk_hash', hashes)
  if (lookupErr) throw new Error(`lookup chunk_hashes failed: ${lookupErr.message}`)
  const existingSet = new Set((existing ?? []).map((r) => r.chunk_hash as string))
  const toInsert = chunks.filter((c, i) => !existingSet.has(hashes[i]))
  stats.skipped = chunks.length - toInsert.length
  console.log(`[ingest-pt] ${stats.skipped} chunks déjà présents (skip), ${toInsert.length} à insérer`)

  if (toInsert.length === 0) {
    console.log('[ingest-pt] ✓ Rien à faire')
    return stats
  }

  // 2. Embed par batch (BGE-M3 supporte le batching)
  const BATCH_SIZE = 16
  const batches: ParsedChunk[][] = []
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    batches.push(toInsert.slice(i, i + BATCH_SIZE))
  }

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batch = batches[bIdx]
    console.log(`[ingest-pt] Batch ${bIdx + 1}/${batches.length} (${batch.length} chunks)…`)

    try {
      // Embed du contenu
      const contentVecs = await embedBatch(batch.map((c) => `${c.title}\n\n${c.content}`))
      // Embed des questions hypothétiques (dual embedding)
      const questionVecs = await embedBatch(batch.map(buildHypotheticalQuestion))

      const rows = batch.map((c, i) => ({
        source: c.source,
        article: c.article,
        title: c.title,
        content: c.content,
        theme: c.theme,
        parent_path: c.parent_path,
        chunk_index: c.chunk_index,
        language: 'pt' as const,
        chunk_hash: chunkHash(c),
        embedding: formatVectorLiteral(contentVecs[i]),
        question_embedding: formatVectorLiteral(questionVecs[i]),
        version: 1,
      }))

      const { error: insertErr } = await supabase
        .from('syndic_legal_corpus_pt')
        .upsert(rows, { onConflict: 'chunk_hash' })

      if (insertErr) {
        console.error(`[ingest-pt] Insert batch ${bIdx + 1} failed:`, insertErr.message)
        stats.errors += batch.length
      } else {
        stats.inserted += batch.length
      }
    } catch (err) {
      console.error(`[ingest-pt] Batch ${bIdx + 1} error:`, err instanceof Error ? err.message : err)
      stats.errors += batch.length
    }

    // Pause courte entre batches pour ne pas saturer Workers AI
    if (bIdx < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  console.log('[ingest-pt] ════════════════════════════════════════')
  console.log(`[ingest-pt] Total chunks  : ${stats.total}`)
  console.log(`[ingest-pt] Insérés       : ${stats.inserted}`)
  console.log(`[ingest-pt] Déjà présents : ${stats.skipped}`)
  console.log(`[ingest-pt] Erreurs       : ${stats.errors}`)
  console.log('[ingest-pt] ════════════════════════════════════════')
  return stats
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: tsx scripts/ingest-legal-corpus-pt.ts <chemin-vers-md>')
    process.exit(1)
  }
  ingest(filePath)
    .then((stats) => process.exit(stats.errors > 0 ? 1 : 0))
    .catch((err) => {
      console.error('[ingest-pt] FATAL:', err)
      process.exit(1)
    })
}
