// tests/components/pointage-geo-enregistrement.test.tsx — écran Pointage du BTP pro : ce qui part vers /api/btp
// (constat donnees-btp-6 de l'audit du 11/11/2026).
//
// Avant : un pointage GPS partait comme un pointage manuel, sans chantier, sans coordonnées ni distance, avec un départ
// à 17:00 et 0 heure jamais saisis ; un pointage manuel ne gardait le chantier et le salarié que sous forme de texte.
// Maintenant : le chantier, le salarié choisi, le mode, la position et la distance sont enregistrés dans leurs colonnes ;
// un pointage GPS d'arrivée n'a ni heure de départ ni heures travaillées.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Artisan } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr', useTranslation: () => ({ t: (cle: string) => cle }) }))

import { PointageGeoSection } from '@/components/dashboard/PointageGeoSection'

const CHANTIER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const MEMBRE = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

let envois: Array<{ table: string; action: string; data?: Record<string, unknown> }>
let reponseEcriture: () => Response

beforeEach(() => {
  envois = []
  reponseEcriture = () => json({ row: { id: 'p-1' } }, 201)
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') {
      envois.push(JSON.parse(String(init.body)))
      return reponseEcriture()
    }
    const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
    if (table === 'settings') return json({ settings: { geo_pointage_enabled: true } })
    if (table === 'chantiers') return json({ chantiers: [{ id: CHANTIER, titre: 'Villa Dupré', statut: 'En cours', latitude: 43.29, longitude: 5.37, geo_rayon_m: 100 }] })
    if (table === 'membres') return json({ membres: [{ id: MEMBRE, prenom: 'Paul', nom: 'Durand', type_compte: 'ouvrier' }] })
    return json({ [table]: [] })
  })
  // Position GPS à une quinzaine de mètres du chantier.
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) => { ok({ coords: { latitude: 43.2901, longitude: 5.3701 } }); return 1 },
      clearWatch: vi.fn(),
    },
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Un compte par rendu : le hook garde ses lectures en cache par compte.
let rendus = 0
async function afficher() {
  rendus += 1
  const artisan = { id: `fiche-${rendus}`, user_id: `compte-pointage-${rendus}`, company_name: 'Société d’essai' } as unknown as Artisan
  render(<PointageGeoSection artisan={artisan} orgRole="pro_societe" />)
  await screen.findByText(/proDash\.pointage\.pointerManuellement/)
}

const selectAvecOption = (option: string) => {
  const select = screen.getAllByRole('option', { name: option })[0].closest('select')
  if (!select) throw new Error(`liste « ${option} » introuvable`)
  return select
}

describe('Pointage manuel', () => {
  it('le salarié et le chantier choisis partent avec leurs identifiants', async () => {
    await afficher()
    fireEvent.click(screen.getByText(/proDash\.pointage\.pointerManuellement/))
    await waitFor(() => expect(screen.getAllByRole('option', { name: 'Paul Durand' }).length).toBeGreaterThan(0))
    fireEvent.change(selectAvecOption('Paul Durand'), { target: { value: 'Paul Durand' } })
    fireEvent.change(selectAvecOption('Villa Dupré'), { target: { value: 'Villa Dupré' } })
    fireEvent.click(screen.getByText(/proDash\.pointage\.enregistrer/))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({
      table: 'pointages_btp', action: 'insert',
      data: { employe: 'Paul Durand', membre_id: MEMBRE, chantier_nom: 'Villa Dupré', chantier_id: CHANTIER, mode: 'manuel', heure_depart: '17:00', heures_travaillees: 8 },
    })
  })
})

describe('Pointage GPS', () => {
  async function pointerSurLeChantier() {
    await afficher()
    fireEvent.click(screen.getByRole('button', { name: 'GPS' }))
    fireEvent.click(screen.getByText(/proDash\.pointage\.activerGPS/))
    fireEvent.click(await screen.findByText(/proDash\.pointage\.pointerSur Villa Dupré/))
    await waitFor(() => expect(envois).toHaveLength(1))
  }

  it('chantier, mode, position et distance enregistrés ; ni départ ni heures inventés', async () => {
    await pointerSurLeChantier()
    const data = envois[0].data ?? {}
    expect(envois[0]).toMatchObject({ table: 'pointages_btp', action: 'insert' })
    expect(data).toMatchObject({ chantier_id: CHANTIER, chantier_nom: 'Villa Dupré', mode: 'geo_confirme', arrivee_lat: 43.2901, arrivee_lng: 5.3701, heure_depart: null, heures_travaillees: null })
    expect(typeof data.distance_m).toBe('number')
  })
})
