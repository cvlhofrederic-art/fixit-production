// tests/components/photos-chantier-liaison-rapport.test.tsx — Photos chantier : lier une photo à un rapport
// d'intervention du BTP pro (constat donnees-btp-13, autres emplacements ; relecture adverse du 16/11/2026).
//
// Avant : la liaison mettait à jour l'appareil pour tous les rapports (la photo quitte l'ancien rapport, rejoint le
// nouveau), mais n'écrivait en base que le rapport choisi, directement et sans lire la réponse. Depuis que les nouveaux
// rapports du BTP pro sont enregistrés dans rapports_btp, l'écran Photos (qui relit la base) pouvait montrer la photo
// encore liée à l'ancien rapport. Maintenant, pour le BTP pro : chaque rapport en base dont la liste de photos change
// est enregistré par /api/btp, et un échec est annoncé. Un rapport encore seulement sur l'appareil n'est pas envoyé.
// L'artisan garde le comportement d'avant.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Artisan } from '@/lib/types'

const ecrituresDirectes = vi.hoisted(() => [] as Array<{ table: string; ligne: unknown; id: unknown }>)

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      update: (ligne: unknown) => ({
        eq: (_colonne: string, id: unknown) => {
          ecrituresDirectes.push({ table, ligne, id })
          return Promise.resolve({ data: null, error: null })
        },
      }),
    }),
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) },
  },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr', useTranslation: () => ({ t: (cle: string) => cle }) }))
vi.mock('next/image', () => ({ default: () => null }))

import { toast } from 'sonner'
import PhotosChantierSection from '@/components/dashboard/PhotosChantierSection'

const UUID_A = 'a7b8c9d0-e1f2-4a3b-8c4d-5e6f7a8b9c01'
const UUID_B = 'b8c9d0e1-f2a3-4b4c-9d5e-6f7a8b9c0d12'
const ID_LOCAL = 'rap_1794736800000'
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

const artisan = { id: 'fiche-photos', user_id: 'compte-photos', company_name: 'Société d’essai' } as unknown as Artisan
const CLE = 'fixit_rapports_fiche-photos'
const rapportsLocaux = () => JSON.parse(localStorage.getItem(CLE) || '[]') as Array<{ id: string; linkedPhotoIds?: string[] }>
const photosDe = (id: string) => rapportsLocaux().find(r => r.id === id)?.linkedPhotoIds

let envois: Array<{ table: string; action: string; id?: string; data?: Record<string, unknown> }>
let ecritureRefusee: boolean

beforeEach(() => {
  localStorage.clear()
  ecrituresDirectes.length = 0
  envois = []
  ecritureRefusee = false
  vi.mocked(toast.error).mockClear()
  // La photo est liée au rapport A ; B est en base, le troisième n'est encore que sur l'appareil.
  localStorage.setItem(CLE, JSON.stringify([
    { id: UUID_A, rapportNumber: 'RAP-2026-001', clientName: 'M. Martin', interventionDate: '2026-11-10', linkedPhotoIds: ['photo-1'] },
    { id: UUID_B, rapportNumber: 'RAP-2026-002', clientName: 'Mme Petit', interventionDate: '2026-11-12', linkedPhotoIds: [] },
    { id: ID_LOCAL, rapportNumber: 'RAP-2026-003', clientName: 'M. Local', interventionDate: '2026-11-14', linkedPhotoIds: [] },
  ]))
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const adresse = String(url)
    if (init?.method === 'POST' && adresse.startsWith('/api/btp')) {
      const corps = JSON.parse(String(init.body))
      envois.push(corps)
      if (ecritureRefusee) return json({ error: 'Les données n\'ont pas pu être enregistrées.' }, 500)
      return json({ row: { id: corps.id, ...corps.data } })
    }
    if (adresse.startsWith('/api/btp')) {
      return json({ rapports: [
        { id: UUID_A, titre: 'RAP-2026-001', date: '2026-11-10', contenu: { clientName: 'M. Martin' }, photos: ['photo-1'], status: 'termine' },
        { id: UUID_B, titre: 'RAP-2026-002', date: '2026-11-12', contenu: { clientName: 'Mme Petit' }, photos: [], status: 'termine' },
      ] })
    }
    if (adresse.startsWith('/api/artisan-photos')) {
      return json({ data: [{ id: 'photo-1', url: 'https://example.test/photo-1.jpg', taken_at: '2026-11-15T09:00:00Z' }] })
    }
    return json({})
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Ouvre le choix du rapport de la photo et choisit `rapportId`. */
async function lierLaPhotoAuRapport(orgRole: string, rapportId: string) {
  render(<PhotosChantierSection artisan={artisan} bookings={[]} orgRole={orgRole} />)
  fireEvent.click(await screen.findByRole('button', { name: /proDash\.photos\.rapport$/ }))
  const choix = screen.getByRole('combobox')
  await waitFor(() => expect(choix.querySelector(`option[value="${rapportId}"]`)).not.toBeNull())
  fireEvent.change(choix, { target: { value: rapportId } })
}

describe('Photos chantier du BTP pro — liaison d’une photo à un rapport', () => {
  it('chaque rapport en base dont les photos changent est enregistré par /api/btp : celui choisi et celui que la photo quitte', async () => {
    await lierLaPhotoAuRapport('pro_societe', UUID_B)

    await waitFor(() => expect(envois).toHaveLength(2))
    expect(envois).toEqual([
      { table: 'rapports_btp', action: 'update', id: UUID_A, data: { photos: [] } },
      { table: 'rapports_btp', action: 'update', id: UUID_B, data: { photos: ['photo-1'] } },
    ])
    expect(ecrituresDirectes).toEqual([])
    expect(photosDe(UUID_A)).toEqual([])
    expect(photosDe(UUID_B)).toEqual(['photo-1'])
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('rapport choisi encore seulement sur l’appareil : seul le rapport en base que la photo quitte est envoyé', async () => {
    await lierLaPhotoAuRapport('pro_societe', ID_LOCAL)

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toEqual({ table: 'rapports_btp', action: 'update', id: UUID_A, data: { photos: [] } })
    expect(photosDe(ID_LOCAL)).toEqual(['photo-1'])
  })

  it('enregistrement refusé : un message le dit, la liaison reste sur l’appareil', async () => {
    ecritureRefusee = true
    await lierLaPhotoAuRapport('pro_societe', UUID_B)

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(vi.mocked(toast.error).mock.calls[0][0]).toBe('Modification gardée sur cet appareil : la copie en ligne du rapport n\'a pas pu être mise à jour.')
    expect(photosDe(UUID_B)).toEqual(['photo-1'])
  })
})

describe('Photos chantier de l’artisan — comportement d’avant (témoin)', () => {
  it('seul le rapport choisi est écrit, directement dans la base, sans passer par /api/btp', async () => {
    await lierLaPhotoAuRapport('artisan', UUID_B)

    await waitFor(() => expect(ecrituresDirectes).toHaveLength(1))
    expect(ecrituresDirectes[0]).toEqual({ table: 'rapports_btp', ligne: { photos: ['photo-1'] }, id: UUID_B })
    expect(envois).toEqual([])
  })
})
