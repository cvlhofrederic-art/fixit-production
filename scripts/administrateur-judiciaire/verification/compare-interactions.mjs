// Compare les explorations d'interactions (maquette vs portage), clic par clic.
// Usage : node compare-interactions.mjs <dossier-ref> <dossier-candidat> [route]
import fs from 'node:fs'
import path from 'node:path'
const [refDir, candDir, seule] = process.argv.slice(2)
const routes = fs.readdirSync(refDir).filter((f) => f.endsWith('.interactions.json')).map((f) => f.replace('.interactions.json', '')).filter((r) => !seule || r === seule)
const rapport = {}
let ok = 0
for (const r of routes) {
  const a = JSON.parse(fs.readFileSync(path.join(refDir, `${r}.interactions.json`), 'utf8'))
  const pc = path.join(candDir, `${r}.interactions.json`)
  if (!fs.existsSync(pc)) { rapport[r] = { manquant: true }; continue }
  const b = JSON.parse(fs.readFileSync(pc, 'utf8'))
  if (a.echec || b.echec) { rapport[r] = { echecRef: a.echec, echecCand: b.echec }; continue }
  const ecarts = []
  if (a.total !== b.total) ecarts.push({ type: 'nombre-de-cibles', ref: a.total, cand: b.total })
  for (let i = 0; i < Math.min(a.resultats.length, b.resultats.length); i++) {
    const x = a.resultats[i], y = b.resultats[i]
    const champs = ['cible', 'hash', 'modale', 'toasts', 'ecranHash', 'clicImpossible']
    const diff = {}
    for (const c of champs) {
      const vx = c === 'cible' ? x.cible : x.effet[c], vy = c === 'cible' ? y.cible : y.effet[c]
      if (JSON.stringify(vx ?? null) !== JSON.stringify(vy ?? null)) diff[c] = { ref: vx ?? null, cand: vy ?? null }
    }
    if (y.effet.erreurs && y.effet.erreurs.length) diff.erreursPortage = y.effet.erreurs
    if (Object.keys(diff).length) ecarts.push({ i, ...diff })
  }
  rapport[r] = { clics: a.resultats.length, ecarts }
  if (!ecarts.length) ok++
  console.log(`${r.padEnd(16)} clics ${String(a.resultats.length).padStart(3)}  écarts ${ecarts.length}`)
}
fs.writeFileSync(path.join(candDir, '_rapport-interactions.json'), JSON.stringify(rapport, null, 1))
console.log(`\nécrans sans écart d'interaction : ${ok}/${routes.length}`)
