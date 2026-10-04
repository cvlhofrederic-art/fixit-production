// Exploration des interactions : pour chaque écran, clique chaque élément interactif (dans l'ordre du DOM),
// sur une page fraîche, et enregistre l'effet (modale, toasts, ancre, texte de l'écran).
// Usage : node explore.mjs <url-de-base-sans-hash> <dossier-sortie> [routes séparées par des virgules] [max-clics-par-écran=25]
// Sortie : <dossier>/<route>.interactions.json = [{ i, cible, effet: { hash, modale, toasts, ecranHash, erreurs } }]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const [base, out, only, maxArg] = process.argv.slice(2)
const MAX = Number(maxArg || 25)
const ROUTES = only ? only.split(',') : JSON.parse(fs.readFileSync(new URL('./routes.json', import.meta.url), 'utf8'))
fs.mkdirSync(out, { recursive: true })
const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}nextjs-portal{display:none!important}`
const SELECTEUR = 'main .content :is(button, [role="button"], [role="tab"], a[href], .list-row, tbody tr, summary, input[type="checkbox"], label.toggle)'
const h = (s) => crypto.createHash('sha1').update(s || '').digest('hex').slice(0, 12)

const browser = await chromium.launch()
// Contexte NEUF pour chaque clic : IndexedDB, localStorage et modales repartent de zéro (état déterministe).
async function nouvellePage(erreurs) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', bypassCSP: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('vitfix_cookie_consent', JSON.stringify({ performance: false, personalization: false, timestamp: 1 })) } catch { /* stockage indisponible */ }
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)))
  page.on('dialog', (d) => d.dismiss().catch(() => {}))
  return page
}
async function ouvrir(page, r) {
  await page.goto(`${base}#${r}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.addStyleTag({ content: FREEZE })
  await page.waitForSelector('main .content', { timeout: 30000 })
  await page.waitForTimeout(400)
}
for (const r of ROUTES) {
  const erreurs = []
  let page = await nouvellePage(erreurs)
  const resultats = []
  try {
    await ouvrir(page, r)
    const cibles = await page.$$eval(SELECTEUR, (els) => els.map((e) => `${e.tagName.toLowerCase()}|${(e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60)}`))
    const n = Math.min(cibles.length, MAX)
    for (let i = 0; i < n; i++) {
      erreurs.length = 0
      if (i > 0) { await page.context().close(); page = await nouvellePage(erreurs); await ouvrir(page, r) }
      const els = await page.$$(SELECTEUR)
      let effet
      try {
        await els[i].scrollIntoViewIfNeeded({ timeout: 2000 })
        await els[i].click({ timeout: 3000 })
        await page.waitForTimeout(350)
        effet = await page.evaluate(() => {
          const t = (s) => [...document.querySelectorAll(s)].map((e) => e.innerText.trim().replace(/\s+/g, ' ')).join(' ‖ ')
          return {
            hash: location.hash,
            modale: t('.modal, [role="dialog"][aria-modal="true"]').slice(0, 1500),
            toasts: t('.vfx-toast-viewport .vfx-toast, .vfx-toast').slice(0, 600),
            ecran: (document.querySelector('main .content')?.innerText || '').slice(0, 100000),
          }
        })
        effet.ecranHash = h(effet.ecran)
        delete effet.ecran
      } catch (e) {
        effet = { clicImpossible: String(e).split('\n')[0].slice(0, 160) }
      }
      effet.erreurs = [...erreurs]
      resultats.push({ i, cible: cibles[i], effet })
    }
    fs.writeFileSync(path.join(out, `${r}.interactions.json`), JSON.stringify({ total: cibles.length, explores: n, resultats }, null, 1))
    process.stdout.write(`${r}(${n}/${cibles.length}) `)
  } catch (e) {
    fs.writeFileSync(path.join(out, `${r}.interactions.json`), JSON.stringify({ echec: String(e).slice(0, 300) }))
    process.stdout.write(`${r}✗ `)
  }
  await page.context().close()
}
await browser.close()
console.log('\nterminé')
