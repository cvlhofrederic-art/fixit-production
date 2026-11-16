// tests/components/btp-meteo-position.test.tsx — Météo chantiers (components/dashboard/btp/MeteoChantierSection.tsx) et
// position GPS de la fiche chantier (16/11/2026). La page géocodait la seule ville et enregistrait ce centre de
// commune dans chantiers_btp : le pointage automatique se déclenchait ensuite au mauvais endroit. Désormais elle
// n'enregistre qu'une position précise de l'adresse complète ; la ville sert encore à la météo, sans être enregistrée.
// Réseau et données simulés ; adresses fictives.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const etat = vi.hoisted(() => ({
  update: null as null | ((id: string, changes: Record<string, unknown>) => Promise<boolean>),
  geocodage: null as null | { latitude: number; longitude: number; precise: boolean },
}))

vi.mock('@/lib/hooks/use-btp-data', () => {
  const chantiers = [{ id: 'c-villa', titre: 'Villa', adresse: '1 rue des Lilas', codePostal: '13008', ville: 'Marseille', statut: 'En cours', latitude: null, longitude: null }]
  return { useBTPData: () => ({ items: chantiers, loading: false, error: null, update: (id: string, c: Record<string, unknown>) => etat.update?.(id, c) }) }
})
vi.mock('@/lib/btp/geocodage', async (original) => ({
  ...(await original<typeof import('@/lib/btp/geocodage')>()),
  geocoderAdresse: vi.fn(async () => etat.geocodage),
}))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) } } }))

import { geocoderAdresse } from '@/lib/btp/geocodage'
import { MeteoChantierSection } from '@/components/dashboard/btp/MeteoChantierSection'

let appels: string[]
let ecritures: Array<{ id: string; changes: Record<string, unknown> }>

beforeEach(() => {
  appels = []
  ecritures = []
  etat.update = async (id, changes) => { ecritures.push({ id, changes }); return true }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const adresse = String(url)
    appels.push(adresse)
    if (adresse.includes('api-adresse.data.gouv.fr')) {
      return new Response(JSON.stringify({ features: [{ geometry: { coordinates: [5.37, 43.29] }, properties: { type: 'municipality', score: 0.9 } }] }))
    }
    return new Response(JSON.stringify({
      daily: { time: ['2026-11-16'], temperature_2m_max: [15], temperature_2m_min: [8], precipitation_sum: [0], wind_speed_10m_max: [10], weather_code: [1] },
    }))
  })
})
afterEach(() => { vi.restoreAllMocks() })

describe('Météo chantiers — position enregistrée dans la fiche', () => {
  it('adresse complète trouvée précisément : la position est enregistrée (le pointage s’en sert) et sert à la météo', async () => {
    etat.geocodage = { latitude: 43.251, longitude: 5.381, precise: true }
    render(<MeteoChantierSection userId="u1" authUserId="u1" isPt={false} />)
    await waitFor(() => expect(appels.some(a => a.includes('open-meteo'))).toBe(true))
    expect(geocoderAdresse).toHaveBeenCalledWith('1 rue des Lilas 13008 Marseille', 'FR')
    expect(ecritures).toEqual([{ id: 'c-villa', changes: { latitude: 43.251, longitude: 5.381 } }])
    expect(appels.some(a => a.includes('api-adresse.data.gouv.fr'))).toBe(false)
  })

  it('adresse seulement approximative : météo de la ville, mais rien n’est enregistré dans la fiche', async () => {
    etat.geocodage = { latitude: 43.29, longitude: 5.37, precise: false }
    render(<MeteoChantierSection userId="u1" authUserId="u1" isPt={false} />)
    await waitFor(() => expect(appels.some(a => a.includes('open-meteo'))).toBe(true))
    expect(appels.find(a => a.includes('api-adresse.data.gouv.fr'))).toContain('Marseille')
    expect(ecritures).toEqual([])
    expect((await screen.findAllByText(/Villa/)).length).toBeGreaterThan(0)
  })
})
