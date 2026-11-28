// tests/components/comptabilite-iva-sociedade-pt.test.tsx
//
// Comptabilité (components/dashboard/ComptabiliteSection.tsx, partagée artisan / société BTP) : une société portugaise
// est au regime normal d'IVA, le seuil d'isenção de l'art. 53.º du CIVA ne la concerne pas. La vérification du seuil
// (POST /api/tva/check, qui crée des notifications) ne part donc pas pour elle ; elle part comme avant pour une société
// française et pour un artisan portugais (relecture du 17/11/2026, rapport i18n PT-PT).

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'

const etat = vi.hoisted(() => ({ locale: 'pt' as 'pt' | 'fr' }))

vi.mock('@/lib/i18n/context', () => ({ useLocale: () => etat.locale }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'jeton-de-test' } } }) } },
}))
vi.mock('@/components/common/RobotAvatars', () => ({ LeaAvatar: () => null }))

import ComptabiliteSection from '@/components/dashboard/ComptabiliteSection'
import type { Artisan, Booking, Service } from '@/lib/types'

// Horloge figée : mardi 17/11/2026, 10 h locale. Un rendez-vous terminé cette année-là : chiffre d'affaires non nul,
// la vérification peut partir.
const MAINTENANT = new Date(2026, 10, 17, 10, 0, 0)
const bookings = [
  { id: 'b1', booking_date: '2026-03-10', status: 'completed', price_ttc: 1230, price_ht: 1000 },
] as unknown as Booking[]
const artisan = { id: 'pro-essai', company_name: 'Essai Lda' } as unknown as Artisan

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({}) }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: MAINTENANT })
  localStorage.clear()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Rend la section, attend le chargement des réglages d'IVA (premier appel), laisse finir les effets, rend les URL. */
async function appelsApres(orgRole: 'pro_societe' | 'artisan', locale: 'pt' | 'fr') {
  etat.locale = locale
  render(<ComptabiliteSection bookings={bookings} artisan={artisan} services={[] as Service[]} orgRole={orgRole} />)
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === '/api/tva/settings')).toBe(true))
  await act(async () => { await Promise.resolve() })
  return fetchMock.mock.calls
}

describe('Comptabilidade : vérification du seuil d\'IVA', () => {
  it('société portugaise : aucun appel à /api/tva/check', async () => {
    const appels = await appelsApres('pro_societe', 'pt')
    expect(appels.map(([url]) => url)).not.toContain('/api/tva/check')
  })

  it('société française : appel inchangé (pays FR)', async () => {
    const appels = await appelsApres('pro_societe', 'fr')
    const check = appels.find(([url]) => url === '/api/tva/check')
    expect(check).toBeDefined()
    expect(JSON.parse(String(check?.[1]?.body))).toEqual({ ca_ht: 1000, country: 'FR' })
  })

  it('artisan portugais : appel maintenu (pays PT, seuil de l\'art. 53.º)', async () => {
    const appels = await appelsApres('artisan', 'pt')
    const check = appels.find(([url]) => url === '/api/tva/check')
    expect(check).toBeDefined()
    expect(JSON.parse(String(check?.[1]?.body))).toEqual({ ca_ht: 1000, country: 'PT' })
  })
})
