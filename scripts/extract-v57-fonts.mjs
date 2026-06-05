// Extract the 4 variable-font woff2 files used by the V5.4 syndic dashboard
// out of the V5.7 mockup bundle.
//
// Input  : decoded mockup HTML (template) produced by decode-v57-bundle.mjs
//          at .claude/v57-decoded.html.
// Output : public/fonts/syndic-v54/<family>.woff2 (4 files)
//
// Why a custom extractor rather than next/font/google : the project deploys to
// Cloudflare Workers, which forbid fetching Google Fonts at request time. We
// self-host the exact subset we need so next/font/local can serve them.
//
// Manrope / Cormorant Garamond / JetBrains Mono are all delivered by Google
// Fonts as variable fonts (one woff2 per family, all weights inside). The
// Anthropic Artifact bundle deduplicates accordingly, so we end up with 4
// physical files :
//   - manrope.woff2                    (weight axis 200-800)
//   - cormorant-garamond.woff2         (weight axis 300-700)
//   - cormorant-garamond-italic.woff2  (italic variant, same axis)
//   - jetbrains-mono.woff2             (weight axis 100-800)
//
// Latin subset only (covers Portuguese : á, ã, ç, ê, ô, …).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const inputPath = process.argv[2] || join(__dirname, '../.claude/v57-decoded.html')
const outputDir = process.argv[3] || join(__dirname, '../public/fonts/syndic-v54')

// (family, italic) → output filename
const FAMILIES = [
  { family: 'Manrope',            italic: false, out: 'manrope.woff2' },
  { family: 'Cormorant Garamond', italic: false, out: 'cormorant-garamond.woff2' },
  { family: 'Cormorant Garamond', italic: true,  out: 'cormorant-garamond-italic.woff2' },
  { family: 'JetBrains Mono',     italic: false, out: 'jetbrains-mono.woff2' },
]

const html = readFileSync(inputPath, 'utf8')

mkdirSync(outputDir, { recursive: true })

// latin range covers ASCII + Latin-1 Supplement (U+0000-00FF), which contains
// all base Portuguese characters.
const LATIN_RANGE_HINT = /U\+0000-00FF|U\+00A0-00FF/i

const blocks = []
const re = /@font-face\s*\{([^}]*)\}/g
let match
while ((match = re.exec(html)) !== null) blocks.push(match[1])
console.error(`[fonts] parsed ${blocks.length} @font-face blocks`)

// Group by family+italic, keep one variable-font woff2 per group (latin range
// preferred). Deduplicate by MD5 since the bundle already collapsed weights.
const picked = new Map()

for (const body of blocks) {
  const familyMatch = body.match(/font-family:\s*'([^']+)'/)
  const styleMatch = body.match(/font-style:\s*(\w+)/)
  const rangeMatch = body.match(/unicode-range:\s*([^;]+);?/)
  const srcMatch = body.match(/src:\s*url\("data:font\/woff2;base64,([^"]+)"/)
  if (!familyMatch || !styleMatch || !srcMatch) continue

  const family = familyMatch[1]
  const italic = styleMatch[1] === 'italic'
  const range = rangeMatch ? rangeMatch[1].trim() : ''
  const base64 = srcMatch[1]

  const target = FAMILIES.find((f) => f.family === family && f.italic === italic)
  if (!target) continue

  const key = `${family}|${italic}`
  const existing = picked.get(key)
  const isLatin = LATIN_RANGE_HINT.test(range)

  if (!existing || (isLatin && !existing.isLatin)) {
    picked.set(key, { target, base64, range, isLatin })
  }
}

console.error(`[fonts] matched ${picked.size}/${FAMILIES.length} required families`)

const missing = FAMILIES.filter((f) => !picked.has(`${f.family}|${f.italic}`))
if (missing.length) {
  console.error(`[fonts] WARNING: missing ${missing.length} families:`)
  for (const m of missing) console.error(`  - ${m.family}${m.italic ? ' italic' : ''}`)
  process.exitCode = 1
}

const md5s = new Set()
let totalBytes = 0

for (const { target, base64, isLatin } of picked.values()) {
  const bytes = Buffer.from(base64, 'base64')
  const md5 = createHash('md5').update(bytes).digest('hex')
  const outPath = join(outputDir, target.out)
  writeFileSync(outPath, bytes)
  md5s.add(md5)
  totalBytes += bytes.length
  console.error(`[fonts] wrote ${target.out} (${bytes.length}B, md5=${md5.slice(0, 8)}, latin=${isLatin})`)
}

console.error(`[fonts] total ${totalBytes}B (${(totalBytes / 1024).toFixed(1)} KB), unique md5s=${md5s.size}`)
