// Capture de tous les écrans (maquette ou portage) : capture pleine page + texte + structure DOM.
// Usage : node capture.mjs <url-de-base-sans-hash> <dossier-sortie> [route1,route2,... | ""] [largeur, ex. 390]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const [base, out, only, largeur] = process.argv.slice(2)
const VIEWPORT = largeur ? { width: Number(largeur), height: Number(largeur) < 768 ? 844 : 900 } : { width: 1440, height: 900 }
const ROUTES = JSON.parse(fs.readFileSync(new URL('./routes.json', import.meta.url), 'utf8'))
const routes = only ? only.split(',') : ROUTES
fs.mkdirSync(out, { recursive: true })
const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
nextjs-portal{display:none!important}`

const browser = await chromium.launch()
const resume = {}
for (const r of routes) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, reducedMotion: 'reduce', bypassCSP: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  // Choix cookies déjà fait : sinon le bandeau du site recouvre le bas de l'écran porté.
  await ctx.addInitScript(() => {
    try { localStorage.setItem('vitfix_cookie_consent', JSON.stringify({ performance: false, personalization: false, timestamp: 1 })) } catch { /* stockage indisponible */ }
  })
  const page = await ctx.newPage()
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()) })
  try {
    await page.goto(`${base}#${r}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.addStyleTag({ content: FREEZE })
    await page.waitForSelector('main .content', { timeout: 30000 })
    await page.waitForTimeout(800)
    const texte = await page.evaluate(() => document.querySelector('main .content')?.innerText ?? '')
    const structure = await page.evaluate(() => {
      const c = document.querySelector('main .content')
      if (!c) return ''
      const lignes = []
      const walk = (el, d) => {
        if (d > 7) return
        for (const k of el.children) {
          const cls = (k.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).sort().join('.')
          lignes.push(`${'  '.repeat(d)}${k.tagName.toLowerCase()}${cls ? '.' + cls : ''}`)
          walk(k, d + 1)
        }
      }
      walk(c, 0)
      return lignes.join('\n')
    })
    await page.screenshot({ path: path.join(out, `${r}.png`), fullPage: true })
    fs.writeFileSync(path.join(out, `${r}.txt`), texte)
    fs.writeFileSync(path.join(out, `${r}.dom.txt`), structure)
    resume[r] = { ok: true, erreurs }
  } catch (e) {
    resume[r] = { ok: false, erreur: String(e).slice(0, 300), erreurs }
  }
  await ctx.close()
  process.stdout.write(`${r}${resume[r].ok ? '' : ' ✗'} `)
}
await browser.close()
fs.writeFileSync(path.join(out, '_resume.json'), JSON.stringify(resume, null, 1))
console.log('\nterminé :', Object.values(resume).filter((x) => x.ok).length, '/', routes.length)
