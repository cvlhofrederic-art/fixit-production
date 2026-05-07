/**
 * Sources Wikipedia auditables pour le contenu enrichi des villes du distrito de Aveiro.
 * Pro SEO 2026 / E-E-A-T : citer les sources renforce l'autorité éditoriale et permet
 * la révision factuelle (anti-hallucination AI).
 *
 * @since 2026-aveiro
 */

export interface CitySource {
  slug: string
  name: string
  wikipediaPt: string
  fetchedAt: string
  censusPopulation2021: number
  coordinates: { lat: number, lng: number }
  freguesiasCount: number
}

export const AVEIRO_CITY_SOURCES: CitySource[] = [
  {
    slug: 'aveiro',
    name: 'Aveiro',
    wikipediaPt: 'https://pt.wikipedia.org/wiki/Aveiro',
    fetchedAt: '2026-05-07',
    censusPopulation2021: 80978,
    coordinates: { lat: 40.6443, lng: -8.6455 },
    freguesiasCount: 10,
  },
  {
    slug: 'agueda',
    name: 'Águeda',
    wikipediaPt: 'https://pt.wikipedia.org/wiki/%C3%81gueda',
    fetchedAt: '2026-05-07',
    censusPopulation2021: 46131,
    coordinates: { lat: 40.5747, lng: -8.4404 },
    freguesiasCount: 15,
  },
  {
    slug: 'ovar',
    name: 'Ovar',
    wikipediaPt: 'https://pt.wikipedia.org/wiki/Ovar',
    fetchedAt: '2026-05-07',
    censusPopulation2021: 54953,
    coordinates: { lat: 40.8593, lng: -8.6262 },
    freguesiasCount: 5,
  },
]
