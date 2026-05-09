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

function resolveDate(input: string | undefined, fallback: Date): Date {
  if (!input) return fallback
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? fallback : d
}

function articleLastMod(
  article: { dateModified?: string; datePublished: string },
  fallback: Date,
): Date {
  return resolveDate(article.dateModified ?? article.datePublished, fallback)
}

/**
 * Pages statiques PT (hubs éditoriaux + pages légales + onboarding).
 * Toutes sous /pt/*. Utilisé uniquement par le sitemap PT dédié — le master
 * index garde ses pages statiques séparées dans `staticAndHubPages` pour
 * éviter la duplication entre sub-sitemaps.
 */
export function ptStaticPages(baseUrl: string, lastMod: Date): SitemapUrl[] {
  const url = (path: string, lm: Date = lastMod): SitemapUrl => ({
    url: `${baseUrl}${path}`,
    lastModified: lm,
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
export function ptProgrammaticPages(
  baseUrl: string,
  fallback: Date,
): SitemapUrl[] {
  const result: SitemapUrl[] = []

  // Services × cidade combos
  for (const combo of getAllPageCombos()) {
    result.push({
      url: `${baseUrl}/pt/servicos/${combo.slug}/`,
      lastModified: resolveDate(combo.city.contentUpdatedAt, fallback),
    })
  }

  // Urgência combos
  for (const combo of getAllUrgencyCombos()) {
    result.push({
      url: `${baseUrl}/pt/urgencia/${combo.slug}/`,
      lastModified: resolveDate(combo.city.contentUpdatedAt, fallback),
    })
  }

  // Cidade hubs
  for (const city of CITIES) {
    result.push({
      url: `${baseUrl}/pt/cidade/${city.slug}/`,
      lastModified: resolveDate(city.contentUpdatedAt, fallback),
    })
  }

  // Perto de mim génériques (par service)
  for (const service of SERVICES) {
    result.push({
      url: `${baseUrl}/pt/perto-de-mim/${service.slug}/`,
      lastModified: fallback,
    })
  }

  // Perto de mim service × cidade
  for (const service of SERVICES) {
    for (const city of CITIES) {
      result.push({
        url: `${baseUrl}/pt/perto-de-mim/${service.slug}-${city.slug}/`,
        lastModified: resolveDate(city.contentUpdatedAt, fallback),
      })
    }
  }

  // Picheleiro alias (canalizador) — variante lexicale Norte
  result.push({
    url: `${baseUrl}/pt/perto-de-mim/picheleiro/`,
    lastModified: fallback,
  })
  for (const city of CITIES) {
    result.push({
      url: `${baseUrl}/pt/perto-de-mim/picheleiro-${city.slug}/`,
      lastModified: resolveDate(city.contentUpdatedAt, fallback),
    })
  }

  // Preços hub + 3 services tarifés
  result.push({ url: `${baseUrl}/pt/precos/`, lastModified: fallback })
  for (const slug of ['canalizador', 'eletricista', 'pintor']) {
    result.push({
      url: `${baseUrl}/pt/precos/${slug}/`,
      lastModified: fallback,
    })
  }

  // Blog
  for (const article of BLOG_ARTICLES) {
    result.push({
      url: `${baseUrl}/pt/blog/${article.slug}/`,
      lastModified: articleLastMod(article, fallback),
    })
  }

  return result
}

/** Sitemap PT complet (statiques + programmatiques). Soumis à la propriété GSC PT. */
export function getAllPtSitemapUrls(
  baseUrl: string,
  fallback: Date,
): SitemapUrl[] {
  return [
    ...ptStaticPages(baseUrl, fallback),
    ...ptProgrammaticPages(baseUrl, fallback),
  ]
}
