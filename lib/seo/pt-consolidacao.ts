// Consolidation de la grille PT (phase 2 du plan SEO PT, point 2.1, DECISION PROPRIETAIRE 1 option A) :
// une seule URL par couple métier x ville, le modèle servicos. Les 946 pages urgencia et
// perto-de-mim métier x ville et le hub picheleiro sont redirigées en 301, un seul saut, par le
// middleware (middleware.ts). Table de référence : data/seo/pt-redirects.csv (test T8).
//
// Pourquoi le middleware et non `redirects` de next.config.ts : avec deux paramètres séparés par un
// tiret (`:metier-:ville`), path-to-regexp refuse à la compilation les valeurs qui contiennent un
// tiret (« ar-condicionado », « marco-de-canaveses ») et OpenNext compile la destination avec cette
// validation ; un calcul explicite est sûr sur Node comme sur Cloudflare Workers.
//
// Module volontairement minuscule (edge) : seules les listes de slugs de lib/seo/pt-grelha.ts.

import { CIDADES_PT_SLUGS, METIERS_PT_SLUGS } from './pt-grelha'

const METIERS = new Set<string>(METIERS_PT_SLUGS)
const CIDADES: readonly string[] = CIDADES_PT_SLUGS

/**
 * Destination 301 d'une URL de la grille consolidée, ou null si l'URL n'est pas concernée :
 * - /pt/urgencia/{metier}-urgente-{ville}/   -> /pt/servicos/{metier}-{ville}/
 * - /pt/perto-de-mim/{metier}-{ville}/        -> /pt/servicos/{metier}-{ville}/
 * - /pt/perto-de-mim/picheleiro-{ville}/      -> /pt/servicos/canalizador-{ville}/
 * - /pt/perto-de-mim/picheleiro/              -> /pt/perto-de-mim/canalizador/
 * Un métier ou une ville inconnus ne sont pas redirigés (404 propre, jamais un 200 générique).
 */
export function destinoConsolidado(pathname: string): string | null {
  const m = pathname.match(/^\/pt\/(urgencia|perto-de-mim)\/([a-z0-9-]+)\/?$/)
  if (!m) return null
  const [, modelo, slug] = m
  if (modelo === 'perto-de-mim' && slug === 'picheleiro') return '/pt/perto-de-mim/canalizador/'
  for (const cidade of CIDADES) {
    const sufixo = `-${cidade}`
    if (!slug.endsWith(sufixo)) continue
    let metier = slug.slice(0, -sufixo.length)
    if (modelo === 'urgencia') {
      if (!metier.endsWith('-urgente')) continue
      metier = metier.slice(0, -'-urgente'.length)
    }
    if (metier === 'picheleiro') metier = 'canalizador'
    if (METIERS.has(metier)) return `/pt/servicos/${metier}-${cidade}/`
  }
  return null
}
