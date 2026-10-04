// Compare deux séries de captures (référence = maquette, candidat = portage).
// Usage : node compare.mjs <dossier-ref> <dossier-candidat> [dossier-diff]
// Sortie : tableau par écran (écart pixels %, hauteur, texte identique, structure DOM identique) + fichiers diff.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')
const pixelmatch = require('pixelmatch').default || require('pixelmatch')

const [refDir, candDir, diffDir = path.join(candDir, '_diff')] = process.argv.slice(2)
fs.mkdirSync(diffDir, { recursive: true })
const routes = fs.readdirSync(refDir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4))
const lignes = []
const rapport = {}
for (const r of routes) {
  const cand = path.join(candDir, `${r}.png`)
  if (!fs.existsSync(cand)) { rapport[r] = { manquant: true }; lignes.push(`${r.padEnd(16)} MANQUANT`); continue }
  const a = PNG.sync.read(fs.readFileSync(path.join(refDir, `${r}.png`)))
  const b = PNG.sync.read(fs.readFileSync(cand))
  const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height)
  const pad = (img) => { const o = new PNG({ width: w, height: h }); o.data.fill(255); PNG.bitblt(img, o, 0, 0, img.width, img.height, 0, 0); return o }
  const A = pad(a), B = pad(b), D = new PNG({ width: w, height: h })
  const n = pixelmatch(A.data, B.data, D.data, w, h, { threshold: 0.1 })
  fs.writeFileSync(path.join(diffDir, `${r}.png`), PNG.sync.write(D))
  const tRef = fs.readFileSync(path.join(refDir, `${r}.txt`), 'utf8')
  const tCand = fs.existsSync(path.join(candDir, `${r}.txt`)) ? fs.readFileSync(path.join(candDir, `${r}.txt`), 'utf8') : ''
  const dRef = fs.readFileSync(path.join(refDir, `${r}.dom.txt`), 'utf8')
  const dCand = fs.existsSync(path.join(candDir, `${r}.dom.txt`)) ? fs.readFileSync(path.join(candDir, `${r}.dom.txt`), 'utf8') : ''
  // première ligne de texte divergente, pour diagnostic rapide
  const lr = tRef.split('\n'), lc = tCand.split('\n')
  let premiere = -1
  for (let i = 0; i < Math.max(lr.length, lc.length); i++) if (lr[i] !== lc[i]) { premiere = i; break }
  const pct = (100 * n) / (w * h)
  rapport[r] = { pixelsPct: +pct.toFixed(3), hRef: a.height, hCand: b.height, texteIdentique: tRef === tCand, domIdentique: dRef === dCand,
    premiereDivergence: premiere < 0 ? null : { ligne: premiere, ref: lr[premiere] ?? null, cand: lc[premiere] ?? null } }
  lignes.push(`${r.padEnd(16)} px ${pct.toFixed(2).padStart(6)}%  h ${String(a.height).padStart(5)}/${String(b.height).padEnd(5)} texte ${tRef === tCand ? 'OK ' : 'KO '} dom ${dRef === dCand ? 'OK' : 'KO'}`)
}
fs.writeFileSync(path.join(diffDir, '_rapport.json'), JSON.stringify(rapport, null, 1))
console.log(lignes.join('\n'))
const ok = Object.values(rapport).filter((x) => x.texteIdentique && x.domIdentique && x.pixelsPct < 0.5).length
console.log(`\nidentiques (texte+DOM, <0.5% px) : ${ok}/${routes.length}`)
