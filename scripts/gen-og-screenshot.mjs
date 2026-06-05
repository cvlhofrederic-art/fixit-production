// Capture d'écran RÉELLE de la landing page → image Open Graph (1200×630).
// Rend la vraie page (app/page.tsx) au format og, plutôt qu'une reproduction.
// Usage : node scripts/gen-og-screenshot.mjs <pt|fr|en> [sortie.png]
//   BASE (env) : origine du serveur (défaut http://127.0.0.1:3001)
import { chromium } from 'playwright'
import sharp from 'sharp'

const locale = (process.argv[2] || 'pt').toLowerCase()
const out = process.argv[3] || `/tmp/shot-${locale}.png`
const BASE = process.env.BASE || 'http://127.0.0.1:3001'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 })
await page.goto(`${BASE}/${locale}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForSelector('h1', { timeout: 120000 })

// Force l'affichage des éléments à apparition différée (reveal on scroll)
await page.evaluate(() => {
  document.querySelectorAll('[data-reveal-id]').forEach((e) => {
    e.style.opacity = '1'
    e.style.transform = 'none'
    e.classList.add('revealed', 'is-visible', 'in-view')
  })
})
await page.waitForTimeout(1200)

const buf = await page.screenshot({ type: 'png' })
await sharp(buf).resize(1200, 630).png().toFile(out)
await browser.close()
console.log(`OK [${locale}] → ${out} (${buf.length} octets bruts @2x)`)
