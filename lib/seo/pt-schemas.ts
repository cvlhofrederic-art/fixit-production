// Nœuds JSON-LD des pages PT (phase 1 du plan SEO PT, point 1.6).
//
// Un seul nœud entreprise pour tout le site (`#business`, app/layout.tsx) : les pages
// métier x ville décrivent un `Service` fourni par cette entité et servi dans une ville
// (`areaServed`), jamais un `LocalBusiness` avec une adresse de ville. Pas de `FAQPage`
// (résultat enrichi retiré par Google le 07/05/2026) ni de `HowTo` (retiré en 2023), pas
// d'`Offer` ou de `PriceSpecification` sans prix réel visible, pas d'avis auto-attribués.

import { CITIES, type CityData } from '@/lib/data/seo-pages-data'
import { ENTITE_PT } from './entite-pt'
import { nomeDistrito } from './pt-meta'

export const ID_WEBSITE = 'https://vitfix.io/#website'

export function noCidade(city: Pick<CityData, 'name' | 'distrito'>) {
  return {
    '@type': 'City',
    name: city.name,
    containedInPlace: { '@type': 'AdministrativeArea', name: `Distrito ${nomeDistrito(city.distrito)}` },
  }
}

/** Les 22 concelhos couverts, pour `areaServed` du nœud entreprise et des hubs métier. */
export function areaServidaPt() {
  return CITIES.map(noCidade)
}

interface ServicoOptions {
  url: string
  nome: string
  serviceType: string
  descricao: string
}

/** Service d'un métier dans une ville : provider = entité unique, areaServed = la ville. */
export function noServicoLocal(options: ServicoOptions & { city: CityData }) {
  return {
    '@type': 'Service',
    '@id': `${options.url}#service`,
    name: options.nome,
    serviceType: options.serviceType,
    description: options.descricao,
    url: options.url,
    inLanguage: 'pt-PT',
    provider: { '@id': ENTITE_PT.id },
    areaServed: noCidade(options.city),
  }
}

/** Service d'un métier sur toute la zone (hubs métier). */
export function noServicoRegional(options: ServicoOptions) {
  return {
    '@type': 'Service',
    '@id': `${options.url}#service`,
    name: options.nome,
    serviceType: options.serviceType,
    description: options.descricao,
    url: options.url,
    inLanguage: 'pt-PT',
    provider: { '@id': ENTITE_PT.id },
    areaServed: areaServidaPt(),
  }
}

/** Service d'une page de district : areaServed = le distrito (AdministrativeArea), comme `containedInPlace` des villes. */
export function noServicoDistrito(options: ServicoOptions & { distrito: string }) {
  return {
    '@type': 'Service',
    '@id': `${options.url}#service`,
    name: options.nome,
    serviceType: options.serviceType,
    description: options.descricao,
    url: options.url,
    inLanguage: 'pt-PT',
    provider: { '@id': ENTITE_PT.id },
    areaServed: { '@type': 'AdministrativeArea', name: `Distrito ${nomeDistrito(options.distrito)}` },
  }
}

export function noWebPage(options: { url: string; nome: string; descricao?: string }) {
  return {
    '@type': 'WebPage',
    '@id': `${options.url}#webpage`,
    url: options.url,
    name: options.nome,
    ...(options.descricao ? { description: options.descricao } : {}),
    inLanguage: 'pt-PT',
    isPartOf: { '@id': ID_WEBSITE },
    publisher: { '@id': ENTITE_PT.id },
  }
}

export function noFilAriane(items: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: item.url })),
  }
}

export function grafo(...nos: Record<string, unknown>[]) {
  return { '@context': 'https://schema.org', '@graph': nos }
}
