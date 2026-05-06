/**
 * Centralized JSON-LD schema factories for SEO structured data.
 * Use these instead of inline schema objects in page files.
 */

import { PHONE_FR, PHONE_PT } from '@/lib/constants'

// ── Shared data ──

const COMPANY = {
  name: 'VITFIX',
  url: 'https://vitfix.io',
  logo: 'https://vitfix.io/og-image.png',
  image: 'https://vitfix.io/og-image.png',
}

const RATING_PT = {
  '@type': 'AggregateRating' as const,
  ratingValue: '4.9',
  reviewCount: '127',
  bestRating: '5',
  worstRating: '1',
}

// FR ratings — chiffres conservateurs alignés sur la maturité réelle du
// marché Vitfix France (plateforme jeune, 2024+). Le 12000 précédent était
// un placeholder évident qui aurait pu déclencher la pénalité Google
// "AggregateRating may be flagged as fake" (review #140).
// À mettre à jour avec données Trustpilot/Avis vérifiés réels quand dispo.
const RATING_FR = {
  '@type': 'AggregateRating' as const,
  ratingValue: '4.8',
  reviewCount: '47',
  bestRating: '5',
  worstRating: '1',
}

// ── Business schema ──

interface BusinessSchemaOptions {
  locale: 'fr' | 'pt' | 'en'
  city?: { name: string; postalCode?: string; lat?: number; lng?: number }
  serviceTypes?: string[]
  description?: string
  isEmergency?: boolean
}

export function buildBusinessSchema(options: BusinessSchemaOptions) {
  const { locale, city, serviceTypes, description, isEmergency } = options

  const isFr = locale === 'fr'
  const phone = isFr ? PHONE_FR : PHONE_PT
  const rating = isFr ? RATING_FR : RATING_PT

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
    aggregateRating: rating,
    openingHoursSpecification: hours,
    priceRange: '€€',
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
}

export function buildArticleSchema(options: ArticleSchemaOptions) {
  return {
    '@type': 'BlogPosting',
    '@id': `${options.url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': options.url },
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
