// Génère app/icon.png + autres tailles à partir d'une définition SVG inline.
// Run: node scripts/generate-favicon.mjs
//
// Pourquoi pas app/icon.tsx (next/og) ? Le config trailingSlash: true de
// next.config.ts redirige /icon → /icon/ qui n'existe pas. Solution =
// fichiers statiques avec extension (pas affectés par le redirect).

import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// SVG source : squircle blanc + V noir + F jaune brand
// Géométrie identique à ce qui était dans app/icon.svg (cohérent design).
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect x="0" y="0" width="64" height="64" rx="14" ry="14" fill="#ffffff"/>
  <path d="M11 18 L19 18 L23 42 L27 18 L35 18 L26 50 L20 50 Z" fill="#111110"/>
  <path d="M35 18 L53 18 L53 25 L41 25 L41 32 L51 32 L51 39 L41 39 L41 50 L35 50 Z" fill="#FFD600"/>
</svg>`

const targets = [
  { path: 'app/icon.png', size: 64 },
  { path: 'app/apple-icon.png', size: 180 },
  { path: 'public/icon-192.png', size: 192 },
  { path: 'public/icon-512.png', size: 512 },
]

for (const t of targets) {
  const buf = await sharp(Buffer.from(SVG))
    .resize(t.size, t.size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  const outPath = join(ROOT, t.path)
  writeFileSync(outPath, buf)
  console.log(`✓ ${t.path} (${t.size}×${t.size}, ${buf.length} bytes)`)
}

console.log('\nDone. Commit the new PNG files.')
