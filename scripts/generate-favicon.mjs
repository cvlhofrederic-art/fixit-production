// Génère tous les assets favicon depuis le PNG source brand assets/source-favicon-vf.png.
// Run : node scripts/generate-favicon.mjs
//
// Sortie 100% pro 2026 :
// - app/favicon.ico (multi-size 16+32+48, PNG-in-ICO)
// - app/icon.png (64×64) + app/apple-icon.png (180×180) — Next.js conventions
// - public/icon-16.png, icon-32.png (browser tabs petites tailles)
// - public/icon-192.png, icon-512.png (PWA manifest)
// - public/safari-pinned-tab.svg (silhouette noire macOS pinned tabs)
//
// Pourquoi pas dynamic next/og ? next.config.ts trailingSlash: true
// redirige /icon → /icon/ qui n'existe pas. Files statiques avec extension
// (.png, .ico, .svg) bypassent ce redirect.
//
// Pipeline : trim whitespace → fit dans un carré → resize → squircle mask
// (cohérent SaaS 2026 : Linear, Notion, Stripe, Apple). Source = PNG brand
// fourni par l'utilisateur, garantit fidélité 100% au design original.

import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE_PNG = join(ROOT, 'assets/source-favicon-vf.png')

// Padding intérieur autour du logo (% de la taille finale).
// Le source PNG a déjà du whitespace, on trim d'abord puis on ajoute notre
// propre padding standard pour respirer dans le squircle.
// Padding pour cercle (vs squircle) : un rectangle wide doit tenir dans le
// DISQUE inscrit, pas le carré. 22% = sweet spot lisible meme a 16x16 tout
// en preservant la rondeur visible. Style favicon Meta/Wikipedia/FB.
const INNER_PADDING_RATIO = 0.22
const SQUIRCLE_RADIUS_RATIO = 0.5 // 50% = cercle parfait

/**
 * Génère un PNG carré squircle à la taille demandée à partir du PNG brand.
 */
async function buildSquireIcon(size) {
  // 1. Trim le whitespace autour du logo + récupère bbox
  const trimmed = await sharp(SOURCE_PNG)
    .trim({ background: { r: 255, g: 255, b: 255 }, threshold: 10 })
    .toBuffer({ resolveWithObject: true })

  const trimmedW = trimmed.info.width
  const trimmedH = trimmed.info.height
  const ratio = trimmedW / trimmedH

  // 2. Resize le logo trim pour qu'il rentre dans (size - 2*padding) en respectant ratio
  const padding = Math.round(size * INNER_PADDING_RATIO)
  const innerSize = size - 2 * padding
  let logoW, logoH
  if (ratio >= 1) {
    logoW = innerSize
    logoH = Math.round(innerSize / ratio)
  } else {
    logoH = innerSize
    logoW = Math.round(innerSize * ratio)
  }
  const logo = await sharp(trimmed.data)
    .resize(logoW, logoH, { fit: 'contain' })
    .png()
    .toBuffer()

  // 3. Crée le canvas blanc carré + composite le logo centré
  const offsetX = Math.round((size - logoW) / 2)
  const offsetY = Math.round((size - logoH) / 2)
  const composed = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, left: offsetX, top: offsetY }])
    .png()
    .toBuffer()

  // 4. Applique le mask circle via SVG composite (cercle parfait, alpha mask)
  const cx = size / 2
  const r = size / 2
  const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="#fff"/>
  </svg>`

  return sharp(composed)
    .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

// ── Génération PNG ──
const pngTargets = [
  { path: 'public/icon-16.png', size: 16 },
  { path: 'public/icon-32.png', size: 32 },
  { path: 'app/icon.png', size: 64 },
  { path: 'app/apple-icon.png', size: 180 },
  { path: 'public/icon-192.png', size: 192 },
  { path: 'public/icon-512.png', size: 512 },
]

const pngBuffers = {}
for (const t of pngTargets) {
  const buf = await buildSquireIcon(t.size)
  writeFileSync(join(ROOT, t.path), buf)
  pngBuffers[t.size] = buf
  console.log(`✓ ${t.path} (${t.size}×${t.size}, ${buf.length}B)`)
}

// ── Génération favicon.ico (multi-size 16+32+48) ──
// Format ICO : header (6B) + N × directory entries (16B chacune) + PNG data.
// Reférence : https://en.wikipedia.org/wiki/ICO_(file_format)
const ico48 = await buildSquireIcon(48)

const icoEntries = [
  { size: 16, png: pngBuffers[16] },
  { size: 32, png: pngBuffers[32] },
  { size: 48, png: ico48 },
]

const HEADER_SIZE = 6
const ENTRY_SIZE = 16
const headerOffset = HEADER_SIZE + ENTRY_SIZE * icoEntries.length

const header = Buffer.alloc(HEADER_SIZE)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(icoEntries.length, 4)

let currentOffset = headerOffset
const entriesBuffer = Buffer.alloc(ENTRY_SIZE * icoEntries.length)
icoEntries.forEach((entry, i) => {
  const off = i * ENTRY_SIZE
  entriesBuffer.writeUInt8(entry.size === 256 ? 0 : entry.size, off + 0)
  entriesBuffer.writeUInt8(entry.size === 256 ? 0 : entry.size, off + 1)
  entriesBuffer.writeUInt8(0, off + 2)
  entriesBuffer.writeUInt8(0, off + 3)
  entriesBuffer.writeUInt16LE(1, off + 4)
  entriesBuffer.writeUInt16LE(32, off + 6)
  entriesBuffer.writeUInt32LE(entry.png.length, off + 8)
  entriesBuffer.writeUInt32LE(currentOffset, off + 12)
  currentOffset += entry.png.length
})

const icoBuffer = Buffer.concat([header, entriesBuffer, ...icoEntries.map(e => e.png)])
writeFileSync(join(ROOT, 'app/favicon.ico'), icoBuffer)
console.log(`✓ app/favicon.ico (16+32+48 multi-size, ${icoBuffer.length}B)`)

// ── Safari pinned tab SVG (mask noir) ──
// Pour le mask-icon Safari macOS pinned tabs : silhouette noire qui sera
// recolorée par le navigateur via l'attribut color="#FFD600" du link.
// On ne peut pas auto-générer une silhouette propre depuis le PNG source,
// donc fallback simple : on garde une silhouette VF géométrique en noir.
const SVG_MASK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <path d="M11 18 L19 18 L23 42 L27 18 L35 18 L26 50 L20 50 Z" fill="#000000"/>
  <path d="M35 18 L53 18 L53 25 L41 25 L41 32 L51 32 L51 39 L41 39 L41 50 L35 50 Z" fill="#000000"/>
</svg>`
writeFileSync(join(ROOT, 'public/safari-pinned-tab.svg'), SVG_MASK)
console.log(`✓ public/safari-pinned-tab.svg (mask noir, ${SVG_MASK.length}B)`)

console.log('\nDone. Source : assets/source-favicon-vf.png')
