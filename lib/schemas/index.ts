/**
 * Centralized JSON-LD schema factories for SEO structured data.
 * Use these instead of inline schema objects in page files.
 */

import { PHONE_FR, PHONE_PT, PT_NIF_EMPRESA } from '@/lib/constants'

// ── Shared data ──

const COMPANY = {
  name: 'VITFIX',
  url: 'https://vitfix.io',
  logo: 'https://vitfix.io/og-fr.png',
  image: 'https://vitfix.io/og-fr.png',
}

// AggregateRating : N'EST PLUS HARDCODÉ.
//
// Les ratings 4.9/127 PT et 4.8/47 FR étaient des placeholders non
// reliés à des reviews réels. Google peut pénaliser pour
// "AggregateRating may be flagged as fake" si les chiffres ne sont pas
// supportés par des reviews vérifiables sur le site (Trustpilot, Google
// Business Profile, ou tableau de reviews on-page liées au schema).
//
// Comportement actuel : `buildBusinessSchema()` n'inclut PAS de
// aggregateRating par défaut. À réactiver quand on a une source de
// vérité fiable :
//   - Trustpilot widget on-page + leur Verified Reviews schema
//   - Reviews on-page avec Review schema individuel agrégé
//   - Google Business Profile rating exposé via API
//
// En attendant, les pages restent indexables et éligibles à tous les
// rich results SAUF le star-rating dans la SERP. Honnêteté > stars.

export interface AggregateRatingInput {
  ratingValue: number | string
  reviewCount: number | string
  bestRating?: number | string
  worstRating?: number | string
}

function formatAggregateRating(input: AggregateRatingInput) {
  return {
    '@type': 'AggregateRating' as const,
    ratingValue: String(input.ratingValue),
    reviewCount: String(input.reviewCount),
    bestRating: String(input.bestRating ?? 5),
    worstRating: String(input.worstRating ?? 1),
  }
}

// ── Business schema ──

interface BusinessSchemaOptions {
  locale: 'fr' | 'pt' | 'en'
  city?: { name: string; postalCode?: string; lat?: number; lng?: number }
  serviceTypes?: string[]
  description?: string
  isEmergency?: boolean
  /**
   * AggregateRating à afficher. NON FOURNI par défaut : on n'invente plus de
   * notes. À passer UNIQUEMENT depuis une source de vérité (Trustpilot,
   * reviews vérifiées on-page, GBP API) sinon laisser undefined.
   */
  aggregateRating?: AggregateRatingInput
}

export function buildBusinessSchema(options: BusinessSchemaOptions) {
  const { locale, city, serviceTypes, description, isEmergency, aggregateRating } = options

  const isFr = locale === 'fr'
  const phone = isFr ? PHONE_FR : PHONE_PT

  const hours = isEmergency
    ? { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '00:00', closes: '23:59' }
    : { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: isFr ? '07:00' : '08:00', closes: isFr ? '22:00' : '20:00' }

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': isEmergency ? 'EmergencyService' : 'HomeAndConstructionBusiness',
    ...COMPANY,
    description: description || (isFr
      ? 'Artisans vérifiés à Marseille et en PACA. Devis gratuit, réponse rapide.'
      : 'Profissionais verificados na região do Tâmega e Sousa. Orçamento grátis.'),
    telephone: phone,
    openingHoursSpecification: hours,
    priceRange: '€€',
  }

  if (!isFr) {
    schema.taxID = `PT${PT_NIF_EMPRESA}`
  }

  if (aggregateRating) {
    schema.aggregateRating = formatAggregateRating(aggregateRating)
  }

  if (city) {
    schema.address = {
      '@type': 'PostalAddress',
      addressLocality: city.name,
      addressRegion: isFr ? 'Provence-Alpes-Côte d\'Azur' : 'Porto',
      ...(city.postalCode && { postalCode: city.postalCode }),
      addressCountry: isFr ? 'FR' : 'PT',
    }
    if (city.lat && city.lng) {
      schema.geo = { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lng }
    }
    schema.areaServed = { '@type': 'City', name: city.name }
  }

  if (serviceTypes) {
    schema.serviceType = serviceTypes
  }

  return schema
}

// ── Breadcrumb schema ──

interface BreadcrumbItem {
  name: string
  url: string
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

// ── FAQ schema ──

interface FaqItem {
  question: string
  answer: string
}

export function buildFaqSchema(items: FaqItem[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

// ── Person / Author schema (E-E-A-T signal sur articles) ──
// Référence : https://developers.google.com/search/docs/appearance/structured-data/article
// 2026 : Person schema renforce l'autorité et le Knowledge Graph
// linking pour les auteurs cités. Doit pointer vers une page profil
// réelle pour être valide (sinon Google ignore le signal).

interface PersonSchemaOptions {
  name: string
  url?: string
  jobTitle?: string
  description?: string
  image?: string
  sameAs?: string[]
}

export function buildPersonSchema(options: PersonSchemaOptions) {
  const schema: Record<string, unknown> = {
    '@type': 'Person',
    name: options.name,
  }
  if (options.url) {
    schema['@id'] = `${options.url}#person`
    schema.url = options.url
  }
  if (options.jobTitle) schema.jobTitle = options.jobTitle
  if (options.description) schema.description = options.description
  if (options.image) schema.image = options.image
  if (options.sameAs && options.sameAs.length > 0) schema.sameAs = options.sameAs
  return schema
}

// ── Article / BlogPosting schema (autorité éditoriale + entity linking) ──

interface ArticleSchemaOptions {
  url: string
  headline: string
  description: string
  image?: string
  datePublished: string // ISO 8601
  dateModified?: string
  author: PersonSchemaOptions
  inLanguage?: string
  articleSection?: string
  keywords?: string[]
  wordCount?: number
  articleBody?: string
  speakableSelectors?: string[]
}

export function buildArticleSchema(options: ArticleSchemaOptions) {
  return {
    '@type': 'BlogPosting',
    '@id': `${options.url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': options.url },
    url: options.url,
    headline: options.headline,
    description: options.description,
    ...(options.image && { image: options.image }),
    datePublished: options.datePublished,
    dateModified: options.dateModified || options.datePublished,
    author: buildPersonSchema(options.author),
    publisher: {
      '@type': 'Organization',
      '@id': 'https://vitfix.io/#business',
      name: COMPANY.name,
      logo: { '@type': 'ImageObject', url: COMPANY.logo },
    },
    ...(options.inLanguage && { inLanguage: options.inLanguage }),
    ...(options.articleSection && { articleSection: options.articleSection }),
    ...(options.wordCount && { wordCount: options.wordCount }),
    ...(options.articleBody && { articleBody: options.articleBody }),
    ...(options.speakableSelectors && {
      speakable: { '@type': 'SpeakableSpecification', cssSelector: options.speakableSelectors },
    }),
    ...(options.keywords && { keywords: options.keywords.join(', ') }),
  }
}

// ── HowTo schema (cité par AI Overviews / Perplexity / ChatGPT) ──
// Référence : https://schema.org/HowTo
// 2026 : Google a déprécié le rich result HowTo classique, MAIS le
// schema reste valable pour Answer Engines (Perplexity, ChatGPT,
// Claude) qui cherchent du contenu structuré actionnable.

interface HowToStep {
  name: string
  text: string
  image?: string
}

interface HowToSchemaOptions {
  name: string
  description: string
  totalTime?: string // ISO 8601 duration (ex: "PT30M")
  estimatedCost?: { currency: string; value: string }
  supply?: string[]
  tool?: string[]
  steps: HowToStep[]
  image?: string
}

export function buildHowToSchema(options: HowToSchemaOptions) {
  const schema: Record<string, unknown> = {
    '@type': 'HowTo',
    name: options.name,
    description: options.description,
    step: options.steps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
      ...(step.image && { image: step.image }),
    })),
  }
  if (options.totalTime) schema.totalTime = options.totalTime
  if (options.estimatedCost) {
    schema.estimatedCost = {
      '@type': 'MonetaryAmount',
      currency: options.estimatedCost.currency,
      value: options.estimatedCost.value,
    }
  }
  if (options.supply) {
    schema.supply = options.supply.map((s) => ({ '@type': 'HowToSupply', name: s }))
  }
  if (options.tool) {
    schema.tool = options.tool.map((t) => ({ '@type': 'HowToTool', name: t }))
  }
  if (options.image) schema.image = options.image
  return schema
}

// ── AboutPage schema ──
// Centralise la construction du schema /a-propos/ et /sobre/ pour éviter
// la duplication entre les locales (Sonar duplication detection).

interface AboutPageSchemaOptions {
  locale: 'fr' | 'pt' | 'en'
  url: string
  homeUrl: string
  homeLabel: string
  pageLabel: string
}

export function buildAboutPageSchema(options: AboutPageSchemaOptions) {
  const inLanguage = options.locale === 'pt' ? 'pt-PT' : options.locale === 'en' ? 'en' : 'fr-FR'
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${options.url}#aboutpage`,
    url: options.url,
    inLanguage,
    mainEntity: { '@id': 'https://vitfix.io/#business' },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: options.homeLabel, item: options.homeUrl },
        { '@type': 'ListItem', position: 2, name: options.pageLabel, item: options.url },
      ],
    },
  }
}

// ── Speakable (voice search / AI assistants) ──
// Référence : https://developers.google.com/search/docs/appearance/structured-data/speakable
// Identifie les sections lisibles à voix haute par Google Assistant /
// Bixby / agents IA. Utile sur articles + FAQs en 2026.

export function buildSpeakableSchema(cssSelectors: string[]) {
  return {
    '@type': 'SpeakableSpecification',
    cssSelector: cssSelectors,
  }
}

// ── Graph wrapper ──

export function buildSchemaGraph(...schemas: Record<string, unknown>[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': schemas,
  }
}
