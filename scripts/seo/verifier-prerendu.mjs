// Garde du rendu statique des pages SEO, lancée après `next build` (CI : .github/workflows/ci.yml).
//
// Les layouts par langue (app/{pt,fr,en,nl,es}/layout.tsx) ne lisent ni cookies() ni headers() : leurs pages sont
// pré-rendues au build, puis servies telles quelles par le Worker (cache OpenNext en assets statiques, en lecture seule).
// Une API dynamique ajoutée dans un layout, une page ou un helper qu'ils importent, un `revalidate` ou un `force-dynamic`
// en trop ne font échouer ni le build ni les tests : les pages repasseraient en rendu à la demande sans bruit. Ce script
// lit .next/prerender-manifest.json et échoue si une section perd ses pages pré-rendues, si une page témoin manque, ou si
// une route a un `revalidate` (le cache en lecture seule ne peut pas enregistrer une revalidation).
//
// Usage : node scripts/seo/verifier-prerendu.mjs [chemin/vers/prerender-manifest.json]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Planchers par section (comptes du 30/10/2026 : /pt 556, /fr 1 536, /en 11), marge pour quelques pages retirées.
/** @type {Record<string, number>} */
export const PLANCHERS = { '/pt/': 540, '/fr/': 1500, '/en/': 10 }
// Pages témoins : accueils ; grille PT, page de district, hub, blog, ville, prix ; services et villes FR ; service EN.
export const TEMOINS = [
  '/pt', '/fr', '/en',
  '/pt/servicos/canalizador-porto', '/pt/servicos/limpeza-de-telhados', '/pt/perto-de-mim/canalizador',
  '/pt/blog/cano-entupido-como-resolver', '/pt/cidade/porto', '/pt/precos/canalizador',
  '/fr/services/plombier-marseille', '/fr/ville/marseille', '/en/plumber-porto',
]

/**
 * Erreurs relevées dans les routes d'un prerender-manifest (objet `routes`), et nombre de routes par section.
 * @param {Record<string, { initialRevalidateSeconds: number | false }>} routes
 * @returns {{ erreurs: string[], parSection: Record<string, number>, total: number }}
 */
export function verifierPrerendu(routes) {
  const chemins = Object.keys(routes)
  /** @type {string[]} */
  const erreurs = []
  /** @type {Record<string, number>} */
  const parSection = {}
  for (const [prefixe, plancher] of Object.entries(PLANCHERS)) {
    const nombre = chemins.filter((c) => c.startsWith(prefixe)).length
    parSection[prefixe] = nombre
    if (nombre < plancher) erreurs.push(`${prefixe} : ${nombre} routes pré-rendues, plancher ${plancher}`)
  }
  for (const temoin of TEMOINS) if (!(temoin in routes)) erreurs.push(`page témoin absente du pré-rendu : ${temoin}`)
  const avecRevalidate = chemins.filter((c) => routes[c].initialRevalidateSeconds !== false)
  if (avecRevalidate.length) {
    erreurs.push(`${avecRevalidate.length} route(s) avec revalidate (cache en lecture seule) : ${avecRevalidate.slice(0, 5).join(', ')}`)
  }
  return { erreurs, parSection, total: chemins.length }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fichier = process.argv[2] ?? '.next/prerender-manifest.json'
  const { erreurs, parSection, total } = verifierPrerendu(JSON.parse(readFileSync(fichier, 'utf8')).routes ?? {})
  for (const [prefixe, nombre] of Object.entries(parSection)) {
    console.log(`${prefixe.padEnd(5)} ${String(nombre).padStart(5)} routes pré-rendues (plancher ${PLANCHERS[prefixe]})`)
  }
  console.log(`${total} routes pré-rendues au total`)
  if (erreurs.length) {
    for (const e of erreurs) console.log(`::error::${e}`)
    console.log('Voir CLAUDE.md (Architecture, app/{fr,pt,en,es,nl}/) et tests/seo/layouts-racine-statiques.test.tsx.')
    process.exitCode = 1
  }
}
