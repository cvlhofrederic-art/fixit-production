#!/usr/bin/env node
// Lighthouse audit automation pour la sandbox syndic v54.
//
// Cible : les pages /syndic/dev/* (gated notFound() en prod — ce script
// tourne uniquement en CI preview deployment ou en local dev).
//
// Pour chaque URL, lance Lighthouse avec categories performance +
// best-practices, vérifie les audits critiques (font-display, unused-css),
// et fail le process si un seuil est dépassé. Les rapports JSON complets
// sont archivés dans tmp/lighthouse-v54/ pour artefacts CI.
//
// Usage :
//   node scripts/lighthouse-syndic-v54.mjs                          # default base http://localhost:3000
//   node scripts/lighthouse-syndic-v54.mjs --base https://preview-pr238.workers.dev
//   node scripts/lighthouse-syndic-v54.mjs --pages tokens,primitives
//
// Exit code 0 si tous les seuils OK, 1 si au moins une page fail.

import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '')
    args[key] = argv[i + 1]
  }
  return args
}

const args = parseArgs(process.argv)
const base = args.base || 'http://localhost:3000'
const pagesArg = args.pages || 'tokens'
const outDir = args.outDir || join(__dirname, '../tmp/lighthouse-v54')

mkdirSync(outDir, { recursive: true })

// Seuils Phase 1 — ajuster selon les retours Claude Chat
const THRESHOLDS = {
  'font-display-insight': { type: 'score', min: 1.0 },
  'unused-css-rules': { type: 'score', min: 0.9 },
  'unminified-css': { type: 'score', min: 1.0 },
  'total-byte-weight': { type: 'numericValue', max: 200_000 }, // < 200 KB pour les pages dev
}

const PAGES = pagesArg.split(',').map((p) => ({
  name: p.trim(),
  url: `${base}/syndic/dev/${p.trim()}/`,
}))

function runLighthouse(url, outJson) {
  return new Promise((resolve, reject) => {
    const args = [
      'lighthouse',
      url,
      '--only-categories=performance,best-practices',
      '--output=json',
      `--output-path=${outJson}`,
      '--chrome-flags=--headless --no-sandbox',
      '--quiet',
      '--max-wait-for-load=60000',
    ]
    const proc = spawn('npx', args, { stdio: ['ignore', 'inherit', 'inherit'] })
    proc.on('error', reject)
    proc.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`lighthouse exited with code ${code}`))
    })
  })
}

async function auditPage(page) {
  const outJson = join(outDir, `${page.name}.json`)
  console.error(`[lighthouse-v54] auditing ${page.url}`)
  try {
    await runLighthouse(page.url, outJson)
  } catch (err) {
    console.error(`[lighthouse-v54] FAIL ${page.name} — lighthouse error: ${err.message}`)
    return { name: page.name, ok: false, errors: [`lighthouse-runner: ${err.message}`] }
  }

  const report = JSON.parse(await import('node:fs').then((m) => m.readFileSync(outJson, 'utf8')))
  const audits = report.audits || {}
  const errors = []
  const results = {}

  for (const [key, rule] of Object.entries(THRESHOLDS)) {
    const audit = audits[key]
    if (!audit) {
      results[key] = 'audit not produced'
      continue
    }
    if (rule.type === 'score') {
      results[key] = `score=${audit.score}`
      if (audit.score === null || audit.score === undefined) continue
      if (audit.score < rule.min) {
        errors.push(`${key} score=${audit.score} < ${rule.min}`)
      }
    } else if (rule.type === 'numericValue') {
      const v = audit.numericValue
      results[key] = `value=${v}`
      if (typeof v !== 'number') continue
      if (v > rule.max) {
        errors.push(`${key} ${v} > ${rule.max}`)
      }
    }
  }

  const ok = errors.length === 0
  console.error(`[lighthouse-v54] ${ok ? '✅ PASS' : '❌ FAIL'} ${page.name}`)
  for (const [k, v] of Object.entries(results)) console.error(`    - ${k}: ${v}`)
  return { name: page.name, ok, errors, results }
}

const out = []
for (const page of PAGES) {
  const r = await auditPage(page)
  out.push(r)
}

const summaryPath = join(outDir, 'summary.json')
writeFileSync(summaryPath, JSON.stringify(out, null, 2))
console.error(`[lighthouse-v54] summary written to ${summaryPath}`)

const failed = out.filter((r) => !r.ok)
if (failed.length) {
  console.error(`[lighthouse-v54] ${failed.length}/${out.length} pages failed thresholds`)
  for (const f of failed) console.error(`  - ${f.name}: ${f.errors.join('; ')}`)
  process.exit(1)
}
console.error(`[lighthouse-v54] all ${out.length} pages pass thresholds`)
