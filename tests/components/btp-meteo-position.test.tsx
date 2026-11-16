// tests/components/btp-meteo-position.test.tsx — Météo chantiers (components/dashboard/btp/MeteoChantierSection.tsx,
// 16/11/2026). La page géocodait la seule ville et enregistrait ce centre de commune dans chantiers_btp : le pointage
// automatique se déclenchait ensuite au mauvais endroit. Désormais elle n'enregistre AUCUNE position (seul un geste du
// gérant en règle une) ; ses géocodages servent à la météo seulement, gardés sur le téléphone et espacés d'au moins une
// seconde (politique d'utilisation de Nominatim). Réseau et données simulés ; adresses fictives.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

type Position = { latitude: number; longitude: number; precise: boolean }

const etat = vi.hoisted(() => ({
  chantiers: [] as Array<Record<string, unknown>>,
  ecritures: [] as Array<{ id: string; changes: Record<string, unknown> }>,
  geocodage: (async () => null) as (adresse: Record<string, unknown>) => Promise<Position | null>,
}))

vi.mock('@/lib/hooks/use-btp-data', () => ({
  useBTPData: () => ({
    items: etat.chantiers,
    loading: false,
    error: null,
    update: async (id: string, changes: Record<string, unknown>) => { etat.ecritures.push({ id, changes }); return true },
  }),
}))
vi.mock('@/lib/btp/geocodage', async (original) => ({
  ...(await original<typeof import('@/lib/btp/geocodage')>()),
  geocoderAdresse: vi.fn(async (adresse: Record<string, unknown>) => etat.geocodage(adresse)),
}))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) } } }))

import { geocoderAdresse } from '@/lib/btp/geocodage'
import { MeteoChantierSection } from '@/components/dashboard/btp/MeteoChantierSection'

const VILLA = { id: 'c-villa', titre: 'Villa', adresse: '1 rue des Lilas', codePostal: '13008', ville: 'Marseille', statut: 'En cours', latitude: null, longitude: null }
let appels: string[]

// Hôte comparé exactement (une recherche de sous-chaîne dans l'adresse est signalée par CodeQL).
const hote = (adresse: string) => new URL(adresse, 'http://localhost').hostname
const previsions = () => appels.filter(a => a.startsWith('https://api.open-meteo.com/v1/forecast'))
const attendrePrevisions = async (nombre = 1) => { await waitFor(() => expect(previsions()).toHaveLength(nombre), { timeout: 4000 }) }

beforeEach(() => {
  appels = []
  etat.chantiers = [VILLA]
  etat.ecritures = []
  etat.geocodage = async () => null
  localStorage.clear()
  vi.mocked(geocoderAdresse).mockClear()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const adresse = String(url)
    appels.push(adresse)
    if (hote(adresse) === 'geocoding-api.open-meteo.com') {
      return new Response(JSON.stringify({ results: [
        { name: 'Porto', latitude: 42.27, longitude: 8.69, country_code: 'FR' }, // Porto, Corse : le piège
        { name: 'Porto', latitude: 41.15, longitude: -8.61, country_code: 'PT' },
      ] }))
    }
    return new Response(JSON.stringify({
      daily: { time: ['2026-11-16'], temperature_2m_max: [15], temperature_2m_min: [8], precipitation_sum: [0], wind_speed_10m_max: [10], weather_code: [1] },
    }))
  })
})
afterEach(() => { vi.restoreAllMocks() })

describe('Météo chantiers — aucune position enregistrée dans la fiche', () => {
  it('adresse trouvée, même précisément : sert à la météo, jamais écrite dans la fiche', async () => {
    etat.geocodage = async () => ({ latitude: 43.251, longitude: 5.381, precise: true })
    render(<MeteoChantierSection userId="u1" authUserId="u1" isPt={false} />)
    await attendrePrevisions()
    expect(geocoderAdresse).toHaveBeenCalledWith(expect.objectContaining({ adresse: '1 rue des Lilas', codePostal: '13008', ville: 'Marseille' }), 'FR')
    expect(previsions()[0]).toContain('latitude=43.251')
    expect(etat.ecritures).toEqual([])
    // La page n'interroge plus elle-même la BAN ni Nominatim (le géocodage passe par lib/btp/geocodage).
    expect(appels.some(a => ['api-adresse.data.gouv.fr', 'nominatim.openstreetmap.org'].includes(hote(a)))).toBe(false)
  })

  it('adresse approximative (centre de la commune) : bonne pour la météo, rien n’est écrit', async () => {
    etat.geocodage = async () => ({ latitude: 43.29, longitude: 5.37, precise: false })
    render(<MeteoChantierSection userId="u1" authUserId="u1" isPt={false} />)
    await attendrePrevisions()
    expect(previsions()[0]).toContain('latitude=43.29')
    expect(etat.ecritures).toEqual([])
    expect((await screen.findAllByText(/Villa/)).length).toBeGreaterThan(0)
  })

  it('position gardée sur le téléphone : une seconde visite ne géocode pas de nouveau', async () => {
    etat.geocodage = async () => ({ latitude: 43.29, longitude: 5.37, precise: false })
    const premiere = render(<MeteoChantierSection userId="u1" authUserId="u1" isPt={false} />)
    await attendrePrevisions()
    premiere.unmount()
    render(<MeteoChantierSection userId="u1" authUserId="u1" isPt={false} />)
    await attendrePrevisions(2)
    expect(geocoderAdresse).toHaveBeenCalledTimes(1)
    expect(previsions()[1]).toContain('latitude=43.29')
  })

  it('Portugal, adresse introuvable : Open-Meteo par la ville, en préférant le Portugal (« Porto » n’est pas en Corse)', async () => {
    etat.chantiers = [{ ...VILLA, adresse: 'Rua X', codePostal: '', ville: 'Porto' }]
    render(<MeteoChantierSection userId="u1" authUserId="u1" isPt />)
    await attendrePrevisions()
    expect(geocoderAdresse).toHaveBeenCalledWith(expect.objectContaining({ ville: 'Porto' }), 'PT')
    expect(previsions()[0]).toContain('latitude=41.15')
    expect(etat.ecritures).toEqual([])
  })

  it('plusieurs chantiers sans position : géocodés un par un, à au moins une seconde d’intervalle', async () => {
    etat.chantiers = [VILLA, { ...VILLA, id: 'c-garage', titre: 'Garage', adresse: '2 rue des Roses' }]
    const instants: number[] = []
    etat.geocodage = async () => { instants.push(Date.now()); return { latitude: 43.29, longitude: 5.37, precise: false } }
    render(<MeteoChantierSection userId="u1" authUserId="u1" isPt={false} />)
    await attendrePrevisions(2)
    expect(instants).toHaveLength(2)
    expect(instants[1] - instants[0]).toBeGreaterThanOrEqual(1000)
  })
})
