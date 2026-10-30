// Garde du rendu statique des pages SEO, lancée après `next build` (.github/workflows/ci.yml et deploy-cloudflare.yml).
//
// Les layouts par langue (app/{pt,fr,en,nl,es}/layout.tsx) ne lisent ni cookies() ni headers() : leurs pages sont
// pré-rendues au build, puis servies telles quelles par le Worker (cache OpenNext en assets statiques, en lecture seule).
// Une API dynamique ajoutée dans une page, un layout ou un helper qu'ils importent (getServerTranslation lit cookies()),
// un `revalidate` ou un `force-dynamic` ne font échouer ni le build ni les tests : la page repasserait en rendu à la
// demande sans bruit. Ce script croise .next/prerender-manifest.json avec les fichiers page de app/{pt,fr,en,nl,es} :
// - chaque page est pré-rendue (route statique, ou gabarit dynamique dont au moins une page est pré-rendue), sauf celles
//   de RENDUES_A_LA_DEMANDE, liste tenue exacte : une page listée qui devient pré-rendue est aussi une erreur ;
// - planchers de routes pré-rendues par section et pages témoins (un gabarit qui perd ses pages) ;
// - aucune route avec `revalidate` (le cache en lecture seule ne peut pas enregistrer une revalidation).
//
// Usage, depuis la racine du dépôt : node scripts/seo/verifier-prerendu.mjs [chemin/vers/prerender-manifest.json]
import { readdirSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SECTIONS = ['pt', 'fr', 'en', 'nl', 'es']

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

// Pages des sections rendues à la demande, comme sur main, avec la raison. Toute autre page doit être pré-rendue.
/** @type {Record<string, string>} */
export const RENDUES_A_LA_DEMANDE = {
  // Lisent l'URL (useSearchParams) ou la date au rendu : export const dynamic = 'force-dynamic'.
  '/pt/pesquisar': 'recherche, useSearchParams (layout force-dynamic)',
  '/fr/recherche': 'recherche, useSearchParams (layout force-dynamic)',
  '/fr/reserver': 'réservation, useSearchParams (layout force-dynamic)',
  '/pt/mercados/gerir': 'gestion du pedido par lien à jeton, useSearchParams (force-dynamic)',
  '/pt/mercados/publicar': 'date minimale du formulaire calculée au rendu (force-dynamic)',
  // Lisent les cookies de session.
  '/fr/marches/gerer': 'session du marché, cookies()',
  '/fr/marches/publier': 'session du marché, cookies()',
  // getServerTranslation() lit cookies() (lib/i18n/server.ts), même avec une langue forcée.
  '/pt/avaliacoes': 'getServerTranslation()',
  '/fr/avis': 'réexport de /pt/avaliacoes, getServerTranslation()',
  '/pt/termos': 'getServerTranslation()',
  '/pt/privacidade': 'getServerTranslation()',
  '/pt/politica-cookies': 'getServerTranslation()',
  '/pt/avisos-legais': 'getServerTranslation()',
  '/fr/cgu': 'getServerTranslation()',
  '/fr/mentions-legales': 'getServerTranslation()',
  '/en/terms': 'getServerTranslation()',
  '/en/privacy': 'getServerTranslation()',
  '/en/cookie-policy': 'getServerTranslation()',
  '/en/legal-notices': 'getServerTranslation()',
  // Fiches d'artisan lues en base : segment dynamique sans generateStaticParams.
  '/fr/artisan/[id]': 'fiche artisan (page client, useParams), sans generateStaticParams',
  '/fr/societe/[slug]': 'réexport de /fr/artisan/[id]',
  '/pt/empresa/[slug]': 'réexport de /fr/artisan/[id]',
  '/pt/profissional/[id]': 'réexport de /fr/artisan/[id]',
}

/**
 * Routes des fichiers page de app/{pt,fr,en,nl,es} (« /pt/servicos/[slug] »), groupes de routes omis.
 * @param {string} [racine] racine du dépôt
 * @returns {string[]}
 */
export function pagesDesSections(racine = process.cwd()) {
  /** @type {string[]} */
  const pages = []
  /** @param {string[]} segments */
  const parcourir = (segments) => {
    for (const entree of readdirSync(path.join(racine, 'app', ...segments), { withFileTypes: true })) {
      if (entree.isDirectory()) parcourir([...segments, entree.name])
      else if (/^page\.(tsx|ts|jsx|js|mdx)$/.test(entree.name)) {
        pages.push('/' + segments.filter((s) => !(s.startsWith('(') && s.endsWith(')'))).join('/'))
      }
    }
  }
  for (const section of SECTIONS) parcourir([section])
  return pages.sort()
}

/**
 * Erreurs relevées en croisant un prerender-manifest et les pages des sections, et nombre de routes par section.
 * @param {{ routes?: Record<string, { initialRevalidateSeconds?: number | false, srcRoute?: string | null }>, dynamicRoutes?: Record<string, unknown> }} manifeste
 * @param {string[]} pages routes des fichiers page des sections (pagesDesSections)
 * @returns {{ erreurs: string[], parSection: Record<string, number>, total: number }}
 */
export function verifierPrerendu({ routes = {}, dynamicRoutes = {} }, pages) {
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
  const avecRevalidate = chemins.filter((c) => typeof routes[c].initialRevalidateSeconds === 'number')
  if (avecRevalidate.length) {
    erreurs.push(`${avecRevalidate.length} route(s) avec revalidate (cache en lecture seule) : ${avecRevalidate.slice(0, 5).join(', ')}`)
  }
  const gabaritsPrerendus = new Set(Object.values(routes).map((route) => route.srcRoute))
  for (const page of pages) {
    const prerendue = page in routes || (page in dynamicRoutes && gabaritsPrerendus.has(page))
    const listee = Object.hasOwn(RENDUES_A_LA_DEMANDE, page)
    if (!prerendue && !listee) {
      erreurs.push(`page rendue à la demande : ${page} (API dynamique dans la page, son layout ou un helper ? sinon, l'ajouter à RENDUES_A_LA_DEMANDE avec la raison)`)
    }
    if (prerendue && listee) erreurs.push(`page pré-rendue encore listée dans RENDUES_A_LA_DEMANDE : ${page} (la retirer de la liste)`)
  }
  for (const page of Object.keys(RENDUES_A_LA_DEMANDE)) {
    if (!pages.includes(page)) erreurs.push(`RENDUES_A_LA_DEMANDE cite une page qui n'existe plus : ${page}`)
  }
  return { erreurs, parSection, total: chemins.length }
}

// Chemins réels des deux côtés : Node donne au module principal son chemin réel, pas celui d'argv[1] (lien, jonction).
const appelDirect = process.argv[1] !== undefined
  && realpathSync.native(path.resolve(process.argv[1])) === realpathSync.native(fileURLToPath(import.meta.url))

if (appelDirect) {
  const fichier = process.argv[2] ?? '.next/prerender-manifest.json'
  const pages = pagesDesSections()
  const { erreurs, parSection, total } = verifierPrerendu(JSON.parse(readFileSync(fichier, 'utf8')), pages)
  for (const [prefixe, nombre] of Object.entries(parSection)) {
    console.log(`${prefixe.padEnd(5)} ${String(nombre).padStart(5)} routes pré-rendues (plancher ${PLANCHERS[prefixe]})`)
  }
  console.log(`${pages.length} pages de section examinées, dont ${Object.keys(RENDUES_A_LA_DEMANDE).length} rendues à la demande par choix`)
  console.log(`${total} routes pré-rendues au total`)
  if (erreurs.length) {
    for (const e of erreurs) console.log(`::error::${e}`)
    console.log('Voir CLAUDE.md (Architecture, app/{fr,pt,en,es,nl}/) et tests/seo/layouts-racine-statiques.test.tsx.')
    process.exitCode = 1
  }
}
