#!/usr/bin/env node
// Comparaison pixel-perfect ad-hoc entre deux PNG (par défaut : un
// screenshot live de la v54 dev sandbox vs le baseline V5.7 mockup).
//
// Usage :
//   node scripts/visual-regression-v54.mjs --live ./tokens-1440.png \
//        --baseline ./baselines/v57-tokens-1440.png \
//        --diff ./tokens-1440-diff.png \
//        --threshold 0.005
//
// Threshold par défaut : 0.5 % de pixels différents (< 0.5% = pass selon
// le brief Claude Chat). Affiche le pourcentage exact et exit code 0 si
// pass, 1 si fail.
//
// pixelmatch est aussi utilisé en interne par Playwright `toHaveScreenshot`.
// Ce script sert pour les QA ad-hoc et les comparisons CI manuelles
// (preview Cloudflare vs bundle V5.7 décodé), pas pour les tests CI auto
// (ceux-là sont dans e2e/*.spec.ts).

import { readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '')
    args[key] = argv[i + 1]
  }
  return args
}

const args = parseArgs(process.argv)
const livePath = args.live
const baselinePath = args.baseline
const diffPath = args.diff || livePath?.replace(/\.png$/, '-diff.png')
const threshold = parseFloat(args.threshold ?? '0.005')

if (!livePath || !baselinePath) {
  console.error('Usage: visual-regression-v54.mjs --live <png> --baseline <png> [--diff <png>] [--threshold 0.005]')
  process.exit(2)
}

const live = PNG.sync.read(readFileSync(livePath))
const baseline = PNG.sync.read(readFileSync(baselinePath))

if (live.width !== baseline.width || live.height !== baseline.height) {
  console.error(`[visual-regression] dimensions mismatch — live=${live.width}x${live.height} baseline=${baseline.width}x${baseline.height}`)
  console.error('  Re-capture les screenshots aux mêmes dimensions avant de comparer.')
  process.exit(2)
}

const { width, height } = live
const diff = new PNG({ width, height })
const numDiffPixels = pixelmatch(live.data, baseline.data, diff.data, width, height, {
  threshold: 0.1, // pixelmatch threshold per pixel (anti-aliasing tolerance)
  alpha: 0.3,
  diffColor: [255, 0, 0],
  diffMask: false,
})

const totalPixels = width * height
const diffRatio = numDiffPixels / totalPixels

writeFileSync(diffPath, PNG.sync.write(diff))

const pct = (diffRatio * 100).toFixed(3)
const verdict = diffRatio <= threshold ? '✅ PASS' : '❌ FAIL'

console.log(`[visual-regression] ${verdict}  diff = ${numDiffPixels}/${totalPixels} pixels (${pct}%) — threshold ${(threshold * 100).toFixed(3)}%`)
console.log(`[visual-regression] diff image written to ${diffPath}`)

process.exit(diffRatio <= threshold ? 0 : 1)
