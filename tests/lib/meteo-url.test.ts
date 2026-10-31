// tests/lib/meteo-url.test.ts
//
// URL Open-Meteo de la section Météo chantier (BTP) : coordonnées converties en nombre,
// bornées et passées en paramètres d'URL, jamais interpolées (Aikido : SSRF).

import { describe, it, expect } from 'vitest'
import { OPEN_METEO_FORECAST, coordonneesValides, urlPrevisionsMeteo } from '@/lib/btp/meteo-url'

const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code'

describe('urlPrevisionsMeteo', () => {
  it('construit une URL Open-Meteo avec les coordonnées en paramètres', () => {
    const url = urlPrevisionsMeteo(43.2965, 5.3698)
    expect(url).not.toBeNull()
    const u = new URL(url as string)
    expect(u.origin + u.pathname).toBe(OPEN_METEO_FORECAST)
    expect(u.searchParams.get('latitude')).toBe('43.2965')
    expect(u.searchParams.get('longitude')).toBe('5.3698')
    expect(u.searchParams.get('daily')).toBe(DAILY)
    expect(u.searchParams.get('timezone')).toBe('auto')
    expect(u.searchParams.get('forecast_days')).toBe('7')
    expect([...u.searchParams.keys()]).toHaveLength(5)
  })

  it('accepte des coordonnées en chaîne (colonnes numeric lues en base) et les bornes exactes', () => {
    expect(coordonneesValides('41.15', '-8.61')).toEqual({ latitude: 41.15, longitude: -8.61 })
    expect(coordonneesValides(90, 180)).toEqual({ latitude: 90, longitude: 180 })
    expect(coordonneesValides(-90, -180)).toEqual({ latitude: -90, longitude: -180 })
    expect(coordonneesValides(0, 0)).toEqual({ latitude: 0, longitude: 0 })
  })

  it.each([
    ['latitude > 90', 90.0001, 5],
    ['latitude < -90', -91, 5],
    ['longitude > 180', 43, 180.5],
    ['longitude < -180', 43, -181],
    ['NaN', Number.NaN, 5],
    ['Infinity', 43, Number.POSITIVE_INFINITY],
    ['chaîne vide', '', '5'],
    ['texte', 'abc', '5'],
    ['null', null, 5],
    ['undefined', undefined, 5],
    ['objet', {}, 5],
    ['tableau', [43], 5],
    ['booléen', true, 5],
  ])('refuse %s', (_cas, lat, lng) => {
    expect(coordonneesValides(lat, lng)).toBeNull()
    expect(urlPrevisionsMeteo(lat, lng)).toBeNull()
  })

  it("neutralise une valeur qui tenterait d'injecter d'autres paramètres ou un autre hôte", () => {
    expect(urlPrevisionsMeteo('43.2&longitude=1&hourly=x', 5)).toBeNull()
    expect(urlPrevisionsMeteo('43.2/../../admin', 5)).toBeNull()
    expect(urlPrevisionsMeteo('43.2#evil', 5)).toBeNull()
    const url = urlPrevisionsMeteo(' 43.2 ', ' 5.1 ')
    expect(url).not.toBeNull()
    expect(new URL(url as string).hostname).toBe('api.open-meteo.com')
  })
})
