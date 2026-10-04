// Joue un scénario d'étapes identiques sur la maquette et sur le portage, capture l'état après chaque étape
// marquée, puis compare. Usage : node scenario.mjs <scenario.json> <sortie-dir>
// Étapes : {aller:"route"} | {clic:"Texte exact"} | {clicContient:"texte"} | {remplir:{champ:"Libellé", valeur}}
//          | {choisir:{champ, valeur}} | {saisir:{selecteur, valeur}} | {attendre:ms} | {rechargement:true}
//          | {capture:"nom"} | {fichier:{nom, contenu}} (premier input[type=file] de l'écran)
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const [scenarioPath, out] = process.argv.slice(2)
const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'))
const CIBLES = {
  maquette: process.env.URL_MAQUETTE || 'http://127.0.0.1:4173/',
  portage: process.env.URL_PORTAGE || 'http://localhost:3001/fr/administrateur-judiciaire/',
}
const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}nextjs-portal{display:none!important}`
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
fs.mkdirSync(out, { recursive: true })

async function jouer(nomCible) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', bypassCSP: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('vitfix_cookie_consent', JSON.stringify({ performance: false, personalization: false, timestamp: 1 })) } catch { /* stockage indisponible */ }
  })
  const page = await ctx.newPage()
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)))
  page.on('dialog', (d) => d.accept().catch(() => {}))
  const figer = async () => { await page.addStyleTag({ content: FREEZE }).catch(() => {}) }
  await page.goto(CIBLES[nomCible] + '#cockpit', { waitUntil: 'networkidle', timeout: 60000 })
  await figer()
  await page.waitForSelector('main .content', { timeout: 30000 })
  const captures = {}
  const journal = []
  for (const [n, e] of scenario.etapes.entries()) {
    try {
      if (e.aller) { await page.evaluate((r) => { location.hash = r }, e.aller); await page.waitForTimeout(700) }
      else if (e.clic) { await page.locator('button, [role="button"], [role="tab"], a').filter({ hasText: new RegExp('^\\s*' + echapper(e.clic) + '\\s*$') }).first().click({ timeout: 5000 }); await page.waitForTimeout(500) }
      else if (e.clicContient) { await page.locator('button, [role="button"], [role="tab"], a, tr').filter({ hasText: e.clicContient }).first().click({ timeout: 5000 }); await page.waitForTimeout(500) }
      else if (e.remplir) { await page.getByLabel(e.remplir.champ, { exact: true }).first().fill(e.remplir.valeur, { timeout: 5000 }) }
      else if (e.remplirContient) { await page.getByLabel(e.remplirContient.champ).first().fill(e.remplirContient.valeur, { timeout: 5000 }) }
      else if (e.choisirDans) { await page.locator(e.choisirDans.selecteur).first().selectOption({ label: e.choisirDans.valeur }, { timeout: 5000 }); await page.waitForTimeout(400) }
      else if (e.choisir) { await page.getByLabel(e.choisir.champ, { exact: true }).first().selectOption({ label: e.choisir.valeur }, { timeout: 5000 }) }
      else if (e.saisir) { await page.locator(e.saisir.selecteur).first().fill(e.saisir.valeur, { timeout: 5000 }) }
      else if (e.fichier) { await page.locator('main .content input[type="file"]').first().setInputFiles({ name: e.fichier.nom, mimeType: 'text/csv', buffer: Buffer.from(e.fichier.contenu, 'utf8') }); await page.waitForTimeout(700) }
      else if (e.attendre) { await page.waitForTimeout(e.attendre) }
      else if (e.rechargement) { await page.waitForLoadState('networkidle'); await page.waitForSelector('main .content', { timeout: 30000 }); await figer(); await page.waitForTimeout(800) }
      else if (e.capture) {
        captures[e.capture] = await page.evaluate(() => {
          const t = (s) => [...document.querySelectorAll(s)].map((x) => x.innerText.trim()).join('\n‖\n')
          return {
            hash: location.hash,
            ecran: document.querySelector('main .content')?.innerText ?? '',
            bandeau: document.querySelector('.vfx-demo-banner')?.innerText ?? '',
            modale: t('.modal'),
            toasts: t('.vfx-toast'),
          }
        })
      }
      journal.push(`${n} ok`)
    } catch (err) {
      journal.push(`${n} ÉCHEC ${JSON.stringify(e).slice(0, 80)} : ${String(err).split('\n')[0].slice(0, 160)}`)
    }
  }
  await browser.close()
  return { captures, journal, erreurs }
}

const res = {}
for (const c of Object.keys(CIBLES)) res[c] = await jouer(c)
fs.writeFileSync(path.join(out, `${scenario.nom}.json`), JSON.stringify(res, null, 1))
let ecarts = 0
for (const nom of Object.keys(res.maquette.captures)) {
  const a = res.maquette.captures[nom], b = res.portage.captures[nom] || {}
  for (const k of ['hash', 'ecran', 'bandeau', 'modale', 'toasts']) {
    if (a[k] !== b[k]) {
      ecarts++
      const la = (a[k] || '').split('\n'), lb = (b[k] || '').split('\n')
      let i = 0; while (i < Math.max(la.length, lb.length) && la[i] === lb[i]) i++
      console.log(`ÉCART ${nom}.${k} ligne ${i} :\n   maquette : ${JSON.stringify(la[i])}\n   portage  : ${JSON.stringify(lb[i])}`)
    }
  }
}
const echecs = (c) => res[c].journal.filter((l) => l.includes('ÉCHEC'))
console.log(`scénario « ${scenario.nom} » : ${Object.keys(res.maquette.captures).length} captures, ${ecarts} écart(s)`)
console.log('étapes en échec — maquette :', echecs('maquette'), ' portage :', echecs('portage'))
console.log('erreurs JS — maquette :', res.maquette.erreurs, ' portage :', res.portage.erreurs)
