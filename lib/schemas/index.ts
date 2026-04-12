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

const RATING_FR = {
  '@type': 'AggregateRating' as const,
  ratingValue: '4.9',
  reviewCount: '12000',
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

// ── Graph wrapper ──

export function buildSchemaGraph(...schemas: Record<string, unknown>[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': schemas,
  }
}
