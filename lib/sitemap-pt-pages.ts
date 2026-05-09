// Helper SEO PT — pages /pt/* à inclure dans le sitemap dédié PT.
// Source de vérité unique pour le sitemap PT : utilisé à la fois par
// `app/pt/sitemap.xml/route.ts` (sitemap dédié, soumis à la propriété GSC PT)
// et par `app/sitemap/[id]/route.ts` case 1 (sub-sitemap PT du master index).
//
// Pourquoi un sitemap dédié PT ?
// - Lancement marché PT en premier → reporting GSC PT-only (queries, clicks
//   au Portugal) sur la propriété URL prefix `https://vitfix.io/pt/`.
// - Stats indexation PT séparées (combien de URLs PT indexées vs soumises).
// - Crawl priority renforcé pour les URLs PT (Googlebot voit l'urgence).

import { type SitemapUrl } from './sitemap-helpers'
import {
  getAllPageCombos,
  getAllUrgencyCombos,
  BLOG_ARTICLES,
  CITIES,
  SERVICES,
} from './data/seo-pages-data'

/**
 * Pro SEO 2026 : lastmod uniquement quand on a une vraie date (cf. John
 * Mueller 2023). Si la donnée n'est pas datée à la source, on omet le tag
 * plutôt que d'envoyer un fallback factice à Google.
 */
function resolveDateOrUndefined(input: string | undefined): Date | undefined {
  if (!input) return undefined
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function articleLastMod(
  article: { dateModified?: string; datePublished: string },
): Date | undefined {
  return resolveDateOrUndefined(article.dateModified ?? article.datePublished)
}

/**
 * Pages statiques PT (hubs éditoriaux + pages légales + onboarding).
 * Toutes sous /pt/*. Pas de lastmod : le contenu de ces pages est
 * éditorial et ne suit pas une cadence prévisible — préférable d'omettre
 * le signal plutôt que d'envoyer une date factice.
 */
export function ptStaticPages(baseUrl: string): SitemapUrl[] {
  const url = (path: string): SitemapUrl => ({
    url: `${baseUrl}${path}`,
    // pas de lastModified — Google sera invité à crawler à sa cadence
  })
  return [
    url('/pt/'),
    url('/pt/pesquisar/'),
    url('/pt/avaliacoes/'),
    url('/pt/servicos/'),
    url('/pt/blog/'),
    url('/pt/urgencia/'),
    url('/pt/perto-de-mim/'),
    url('/pt/como-funciona/'),
    url('/pt/torne-se-parceiro/'),
    url('/pt/profissionais-verificados/'),
    url('/pt/especialidades/'),
    url('/pt/condominio/'),
    url('/pt/simulador-orcamento/'),
    url('/pt/mercados/publicar/'),
    url('/pt/mercados/gerir/'),
    url('/pt/mapa-do-site/'),
    url('/pt/sobre/'),
    url('/pt/termos/'),
    url('/pt/avisos-legais/'),
    url('/pt/privacidade/'),
    url('/pt/politica-cookies/'),
  ]
}

/**
 * Pages programmatiques PT : cidade × service combos, urgência, hubs cidade,
 * "perto de mim" (générique + service × cidade), preços, blog. Picheleiro
 * (alias de canalizador) inclus pour capter les variantes lexicales du nord.
 */
export function ptProgrammaticPages(baseUrl: string): SitemapUrl[] {
  const result: SitemapUrl[] = []

  // Services × cidade combos — lastmod uniquement quand city.contentUpdatedAt
  for (const combo of getAllPageCombos()) {
    result.push({
      url: `${baseUrl}/pt/servicos/${combo.slug}/`,
      lastModified: resolveDateOrUndefined(combo.city.contentUpdatedAt),
    })
  }

  // Urgência combos
  for (const combo of getAllUrgencyCombos()) {
    result.push({
      url: `${baseUrl}/pt/urgencia/${combo.slug}/`,
      lastModified: resolveDateOrUndefined(combo.city.contentUpdatedAt),
    })
  }

  // Cidade hubs
  for (const city of CITIES) {
    result.push({
      url: `${baseUrl}/pt/cidade/${city.slug}/`,
      lastModified: resolveDateOrUndefined(city.contentUpdatedAt),
    })
  }

  // Perto de mim génériques (par service) — éditorial, pas de lastmod
  for (const service of SERVICES) {
    result.push({ url: `${baseUrl}/pt/perto-de-mim/${service.slug}/` })
  }

  // Perto de mim service × cidade
  for (const service of SERVICES) {
    for (const city of CITIES) {
      result.push({
        url: `${baseUrl}/pt/perto-de-mim/${service.slug}-${city.slug}/`,
        lastModified: resolveDateOrUndefined(city.contentUpdatedAt),
      })
    }
  }

  // Picheleiro alias (canalizador) — variante lexicale Norte
  result.push({ url: `${baseUrl}/pt/perto-de-mim/picheleiro/` })
  for (const city of CITIES) {
    result.push({
      url: `${baseUrl}/pt/perto-de-mim/picheleiro-${city.slug}/`,
      lastModified: resolveDateOrUndefined(city.contentUpdatedAt),
    })
  }

  // Preços hub + 3 services tarifés
  result.push({ url: `${baseUrl}/pt/precos/` })
  for (const slug of ['canalizador', 'eletricista', 'pintor']) {
    result.push({ url: `${baseUrl}/pt/precos/${slug}/` })
  }

  // Blog — lastmod uniquement si l'article a une vraie date
  for (const article of BLOG_ARTICLES) {
    result.push({
      url: `${baseUrl}/pt/blog/${article.slug}/`,
      lastModified: articleLastMod(article),
    })
  }

  return result
}

/** Sitemap PT complet (statiques + programmatiques). Soumis à la propriété GSC PT. */
export function getAllPtSitemapUrls(baseUrl: string): SitemapUrl[] {
  return [
    ...ptStaticPages(baseUrl),
    ...ptProgrammaticPages(baseUrl),
  ]
}
