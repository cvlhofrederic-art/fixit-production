// Génère tous les assets favicon depuis une définition SVG inline.
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

import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// SVG source : squircle blanc + V noir + F jaune brand.
// Géométrie unique pour TOUS les formats — un seul point de vérité design.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect x="0" y="0" width="64" height="64" rx="14" ry="14" fill="#ffffff"/>
  <path d="M11 18 L19 18 L23 42 L27 18 L35 18 L26 50 L20 50 Z" fill="#111110"/>
  <path d="M35 18 L53 18 L53 25 L41 25 L41 32 L51 32 L51 39 L41 39 L41 50 L35 50 Z" fill="#FFD600"/>
</svg>`

// Variant noir-only pour Safari pinned tabs (mask-icon : silhouette noire,
// Safari recolore avec mask-icon color attribut).
const SVG_MASK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <path d="M11 18 L19 18 L23 42 L27 18 L35 18 L26 50 L20 50 Z" fill="#000000"/>
  <path d="M35 18 L53 18 L53 25 L41 25 L41 32 L51 32 L51 39 L41 39 L41 50 L35 50 Z" fill="#000000"/>
</svg>`

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
  const buf = await sharp(Buffer.from(SVG))
    .resize(t.size, t.size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  writeFileSync(join(ROOT, t.path), buf)
  pngBuffers[t.size] = buf
  console.log(`✓ ${t.path} (${t.size}×${t.size}, ${buf.length}B)`)
}

// ── Génération favicon.ico (multi-size 16+32+48) ──
// Format ICO : header (6B) + N × directory entries (16B chacune) + PNG data.
// Reférence : https://en.wikipedia.org/wiki/ICO_(file_format)#Outline
//
// Pour 48×48 on rajoute une taille intermédiaire (sharp resize).
const ico48 = await sharp(Buffer.from(SVG))
  .resize(48, 48, { fit: 'contain' })
  .png({ compressionLevel: 9 })
  .toBuffer()

const icoEntries = [
  { size: 16, png: pngBuffers[16] },
  { size: 32, png: pngBuffers[32] },
  { size: 48, png: ico48 },
]

const HEADER_SIZE = 6
const ENTRY_SIZE = 16
const headerOffset = HEADER_SIZE + ENTRY_SIZE * icoEntries.length

// Header ICO (6 bytes)
const header = Buffer.alloc(HEADER_SIZE)
header.writeUInt16LE(0, 0)              // Reserved
header.writeUInt16LE(1, 2)              // Type 1 = ICO
header.writeUInt16LE(icoEntries.length, 4) // Number of images

// Directory entries + offsets calculés
let currentOffset = headerOffset
const entriesBuffer = Buffer.alloc(ENTRY_SIZE * icoEntries.length)
icoEntries.forEach((entry, i) => {
  const off = i * ENTRY_SIZE
  // Width / Height (0 = 256, sinon valeur 1-255)
  entriesBuffer.writeUInt8(entry.size === 256 ? 0 : entry.size, off + 0)
  entriesBuffer.writeUInt8(entry.size === 256 ? 0 : entry.size, off + 1)
  entriesBuffer.writeUInt8(0, off + 2)  // Color count (0 pour PNG/32-bit)
  entriesBuffer.writeUInt8(0, off + 3)  // Reserved
  entriesBuffer.writeUInt16LE(1, off + 4)   // Color planes
  entriesBuffer.writeUInt16LE(32, off + 6)  // Bits per pixel
  entriesBuffer.writeUInt32LE(entry.png.length, off + 8)  // Image size
  entriesBuffer.writeUInt32LE(currentOffset, off + 12)    // Image offset
  currentOffset += entry.png.length
})

const icoBuffer = Buffer.concat([header, entriesBuffer, ...icoEntries.map(e => e.png)])
writeFileSync(join(ROOT, 'app/favicon.ico'), icoBuffer)
console.log(`✓ app/favicon.ico (16+32+48 multi-size, ${icoBuffer.length}B)`)

// ── Safari pinned tab SVG (mask noir) ──
writeFileSync(join(ROOT, 'public/safari-pinned-tab.svg'), SVG_MASK)
console.log(`✓ public/safari-pinned-tab.svg (mask noir, ${SVG_MASK.length}B)`)

console.log('\nDone. Commit the new files.')
