// tests/components/btp-fiche-chantier-gps.test.tsx — bouton GPS de la fiche chantier (components/dashboard/ChantiersBTPV2.tsx,
// 16/11/2026). Le bouton géocodait « ville || adresse » : la ville seule donnait le centre de la commune, et le pointage
// automatique se déclenchait au mauvais endroit. Il géocode maintenant l'adresse complète et refuse une position
// seulement approximative. Réseau, géocodage et données BTP simulés ; adresse fictive.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const etat = vi.hoisted(() => ({ geocodage: null as null | { latitude: number; longitude: number; precise: boolean } }))

// Comme les vrais hooks (état React), les simulations rendent les mêmes objets d'un rendu à l'autre : des objets neufs
// à chaque rendu relanceraient sans fin les effets de la fiche.
vi.mock('@/lib/hooks/use-btp-data', () => {
  const donnees = { items: [] as unknown[], loading: false, add: async () => null, update: async () => true, remove: async () => true }
  const reglages = { settings: { country: 'FR', company_type: 'sarl', cout_horaire_ouvrier: 22, charges_patronales_pct: 45, objectif_marge_pct: 20 } }
  return { useBTPData: () => donnees, useBTPSettings: () => reglages }
})
vi.mock('@/lib/btp/geocodage', async (original) => ({
  ...(await original<typeof import('@/lib/btp/geocodage')>()),
  geocoderAdresse: vi.fn(async () => etat.geocodage),
}))
vi.mock('@/lib/supabase', () => {
  const chaine: Record<string, unknown> = {}
  for (const methode of ['select', 'eq', 'is', 'in', 'order', 'limit']) chaine[methode] = () => chaine
  chaine.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
  return { supabase: { from: () => chaine, auth: { getSession: async () => ({ data: { session: null } }) } } }
})
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr', useTranslation: () => ({ t: (c: string) => c }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import { toast } from 'sonner'
import { geocoderAdresse } from '@/lib/btp/geocodage'
import { ChantiersBTPV2 } from '@/components/dashboard/ChantiersBTPV2'

const artisan = { id: 'art-1', user_id: 'soc-a' } as unknown as React.ComponentProps<typeof ChantiersBTPV2>['artisan']

beforeEach(() => {
  etat.geocodage = null
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ membres: [] })))
})
afterEach(() => { vi.restoreAllMocks() })

const ouvrirFiche = async () => {
  render(<ChantiersBTPV2 artisan={artisan} orgRole="pro_societe" />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Nouveau chantier/ })) })
  fireEvent.change(screen.getByPlaceholderText('N°, rue...'), { target: { value: '1 rue des Lilas' } })
  fireEvent.change(screen.getByPlaceholderText('13001'), { target: { value: '13008' } })
  fireEvent.change(screen.getByPlaceholderText('Marseille, Lyon...'), { target: { value: 'Marseille' } })
}

describe('fiche chantier — bouton GPS', () => {
  it('géocode l’adresse complète ; une position seulement approximative est refusée, avec un avertissement', async () => {
    etat.geocodage = { latitude: 43.29, longitude: 5.37, precise: false }
    await ouvrirFiche()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /GPS/ })) })
    expect(geocoderAdresse).toHaveBeenLastCalledWith('1 rue des Lilas 13008 Marseille', 'FR')
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('indiquez le numéro et la rue'))
    expect(screen.queryByText(/GPS : /)).toBeNull()
  })

  it('position précise : enregistrée dans la fiche', async () => {
    etat.geocodage = { latitude: 43.25, longitude: 5.38, precise: true }
    await ouvrirFiche()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /GPS/ })) })
    expect(screen.getByText(/GPS : 43\.25000, 5\.38000/)).toBeTruthy()
  })
})
