#!/usr/bin/env tsx
// Dry-run du parser corpus juridique PT — pas d'embedding, pas d'insert DB.
// Sortie : stats + sample chunks pour audit visuel de la qualité du chunking.

import { readFileSync } from 'node:fs'
import { parseLegalMarkdown } from './ingest-legal-corpus-pt'

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: tsx scripts/test-parse-corpus-pt.ts <chemin-md>')
  process.exit(1)
}

const md = readFileSync(filePath, 'utf-8')
const chunks = parseLegalMarkdown(md)

const articles = chunks.filter((c) => c.article)
const proseChunks = chunks.filter((c) => !c.article)

console.log(`Total chunks      : ${chunks.length}`)
console.log(`Articles (B/C/D/E): ${articles.length}`)
console.log(`Prose sections    : ${proseChunks.length}`)
console.log()
console.log('── Distribution par source ────────────────')
const bySource = new Map<string, number>()
for (const c of chunks) bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1)
for (const [src, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${src.padEnd(35)} ${n}`)
}
console.log()
console.log('── Tailles des chunks ────────────────────')
const sizes = chunks.map((c) => c.content.length).sort((a, b) => a - b)
const median = sizes[Math.floor(sizes.length / 2)]
const p95 = sizes[Math.floor(sizes.length * 0.95)]
console.log(`  min    : ${sizes[0]}`)
console.log(`  median : ${median}`)
console.log(`  p95    : ${p95}`)
console.log(`  max    : ${sizes[sizes.length - 1]}`)
console.log()
console.log('── Sample : 3 premiers articles ──────────')
for (const c of articles.slice(0, 3)) {
  console.log()
  console.log(`▸ ${c.parent_path}`)
  console.log(`  source: ${c.source} | article: ${c.article} | theme: ${c.theme ?? '-'}`)
  console.log(`  title: ${c.title}`)
  console.log(`  content (${c.content.length} chars):`)
  console.log(c.content.split('\n').map((l) => `    ${l}`).join('\n'))
}
console.log()
console.log('── Sample : article du milieu (Art. 1432.º Convocação) ──')
const art1432 = articles.find((c) => c.article?.startsWith('1432'))
if (art1432) {
  console.log(`▸ ${art1432.parent_path}`)
  console.log(`  title: ${art1432.title}`)
  console.log(`  content (${art1432.content.length} chars):`)
  console.log(art1432.content.split('\n').map((l) => `    ${l}`).join('\n').slice(0, 1500))
}
console.log()
console.log('── Sample : 2 chunks de prose ────────────')
for (const c of proseChunks.slice(0, 2)) {
  console.log()
  console.log(`▸ ${c.parent_path}`)
  console.log(`  source: ${c.source} | theme: ${c.theme ?? '-'}`)
  console.log(`  content (${c.content.length} chars, premier extrait):`)
  console.log(c.content.split('\n').slice(0, 8).map((l) => `    ${l}`).join('\n'))
}
