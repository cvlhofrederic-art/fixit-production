// tests/components/rapports-btp-enregistrement.test.tsx — rapports d'intervention du BTP pro enregistrés dans leur
// table (constats donnees-btp-13, stockage-local-miroir-14 et base-de-donnees-7 de l'audit du 11/11/2026).
//
// Avant : chaque sauvegarde envoyait tous les rapports directement à la base, sans propriétaire : la base refusait en
// silence (owner_id obligatoire, sans valeur par défaut en production), la table restait vide et les rapports ne
// vivaient que dans le navigateur et son miroir. Maintenant, pour le BTP pro : un NOUVEAU rapport part par /api/btp,
// qui pose le propriétaire ; son identifiant en base remplace l'identifiant local ; ses modifications et sa suppression
// suivent ; un échec est annoncé. Les rapports déjà présents dans le navigateur n'y sont ni envoyés ni modifiés.
// L'artisan garde le comportement d'avant.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Artisan } from '@/lib/types'

const ecrituresDirectes = vi.hoisted(() => [] as Array<{ action: string; ligne?: unknown }>)

vi.mock('@/lib/supabase', () => ({
  supabase: {
    // Ancienne écriture directe dans rapports_btp (refusée par la base faute de propriétaire).
    from: () => ({
      insert: (ligne: unknown) => { ecrituresDirectes.push({ action: 'insert', ligne }); return Promise.resolve({ data: null, error: { code: '23502' } }) },
      upsert: (ligne: unknown) => { ecrituresDirectes.push({ action: 'upsert', ligne }); return Promise.resolve({ data: null, error: { code: '23502' } }) },
      delete: () => ({ eq: () => { ecrituresDirectes.push({ action: 'delete' }); return Promise.resolve({ data: null, error: null }) } }),
    }),
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) },
  },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr', useTranslation: () => ({ t: (cle: string) => cle }) }))
vi.mock('@/lib/rapport-pdf', () => ({ generateRapportPDF: vi.fn() }))
vi.mock('@/components/dashboard/rapports/RapportPDFPreview', () => ({ default: () => null }))
vi.mock('next/image', () => ({ default: () => null }))

import { toast } from 'sonner'
import RapportsSection from '@/components/dashboard/RapportsSection'

const UUID_BASE = 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f70'
const UUID_EXISTANT = 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081'
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

let envois: Array<{ table: string; action: string; id?: string; data?: Record<string, unknown> }>
let enBase: Array<Record<string, unknown>>
let ecritureRefusee: boolean

beforeEach(() => {
  localStorage.clear()
  ecrituresDirectes.length = 0
  envois = []
  enBase = []
  ecritureRefusee = false
  vi.mocked(toast.error).mockClear()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const adresse = String(url)
    if (init?.method === 'POST' && adresse.startsWith('/api/btp')) {
      const corps = JSON.parse(String(init.body))
      envois.push(corps)
      if (ecritureRefusee) return json({ error: 'Les données n\'ont pas pu être enregistrées.' }, 500)
      if (corps.action === 'insert') {
        const ligne = { id: UUID_BASE, ...corps.data }
        enBase.push(ligne)
        return json({ row: ligne }, 201)
      }
      if (corps.action === 'delete') {
        enBase = enBase.filter(l => l.id !== corps.id)
        return json({ deleted: true })
      }
      return json({ row: { id: corps.id, ...corps.data } })
    }
    if (adresse.startsWith('/api/btp')) return json({ rapports: enBase })
    if (adresse.startsWith('/api/artisan-company')) return json({ company: {} })
    return json({ data: [] })
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

const artisan = { id: 'fiche-rapports', user_id: 'compte-rapports', company_name: 'Société d’essai' } as unknown as Artisan
const CLE = 'fixit_rapports_fiche-rapports'
const rapportsLocaux = () => JSON.parse(localStorage.getItem(CLE) || '[]') as Array<Record<string, unknown>>
const ANCIEN = { id: 'rap_1700000000000', rapportNumber: 'RAP-2026-001', clientName: 'M. Ancien', interventionDate: '2026-03-02', motif: 'Fuite', travaux: [], materiaux: [], status: 'termine' }

async function creerRapport(orgRole: string) {
  render(<RapportsSection artisan={artisan} bookings={[]} services={[]} orgRole={orgRole} />)
  fireEvent.click(screen.getByRole('button', { name: '+ Nouveau rapport' }))
  fireEvent.change(screen.getByPlaceholderText('Jean Dupont'), { target: { value: 'Mme Dupré' } })
  fireEvent.change(screen.getByPlaceholderText(/Fuite sous evier cuisine/), { target: { value: 'Reprise de la toiture' } })
  fireEvent.click(screen.getByRole('button', { name: 'Creer le rapport' }))
}

describe('Rapports du BTP pro — enregistrement en base', () => {
  it('un nouveau rapport part par /api/btp (propriétaire posé par le serveur) et prend l’identifiant de la base', async () => {
    localStorage.setItem(CLE, JSON.stringify([ANCIEN]))
    await creerRapport('pro_societe')

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ table: 'rapports_btp', action: 'insert', data: { titre: 'RAP-2026-002', status: 'termine', photos: [] } })
    expect(envois[0].data?.contenu).toMatchObject({ clientName: 'Mme Dupré', motif: 'Reprise de la toiture' })
    expect(envois[0].data).not.toHaveProperty('owner_id')
    await waitFor(() => expect(rapportsLocaux()[0].id).toBe(UUID_BASE))
    // L'ancien rapport du navigateur n'est ni envoyé ni modifié.
    expect(rapportsLocaux()[1]).toEqual(ANCIEN)
    expect(ecrituresDirectes).toEqual([])
  })

  it('création refusée : le rapport reste sur l’appareil et un message le dit', async () => {
    ecritureRefusee = true
    await creerRapport('pro_societe')

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(rapportsLocaux()).toHaveLength(1)
    expect(String(rapportsLocaux()[0].id)).toMatch(/^rap_/)
  })

  it('un rapport déjà en base : sa modification et sa suppression suivent', async () => {
    const existant = { ...ANCIEN, id: UUID_EXISTANT, rapportNumber: 'RAP-2026-005' }
    localStorage.setItem(CLE, JSON.stringify([existant]))
    enBase = [{ id: UUID_EXISTANT, titre: 'RAP-2026-005', date: '2026-03-02', contenu: { clientName: 'M. Ancien', motif: 'Fuite' }, photos: [], status: 'termine' }]
    render(<RapportsSection artisan={artisan} bookings={[]} services={[]} orgRole="pro_societe" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Marquer envoyé' }))
    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ table: 'rapports_btp', action: 'update', id: UUID_EXISTANT, data: { titre: 'RAP-2026-005' } })
    expect(envois[0].data?.contenu).toMatchObject({ sentStatus: 'envoye' })

    fireEvent.click(screen.getByRole('button', { name: '🗑️' }))
    await waitFor(() => expect(envois).toHaveLength(2))
    expect(envois[1]).toEqual({ table: 'rapports_btp', action: 'delete', id: UUID_EXISTANT })
    await waitFor(() => expect(rapportsLocaux()).toEqual([]))
  })

  it('suppression refusée : le rapport reste affiché et un message le dit', async () => {
    const existant = { ...ANCIEN, id: UUID_EXISTANT, rapportNumber: 'RAP-2026-005' }
    localStorage.setItem(CLE, JSON.stringify([existant]))
    ecritureRefusee = true
    render(<RapportsSection artisan={artisan} bookings={[]} services={[]} orgRole="pro_societe" />)

    fireEvent.click(await screen.findByRole('button', { name: '🗑️' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(rapportsLocaux()).toHaveLength(1)
    expect(screen.getByText('RAP-2026-005')).toBeInTheDocument()
  })

  it('réponse perdue après une création réussie : au chargement suivant, un seul rapport (pas de doublon)', async () => {
    const local = { ...ANCIEN, id: 'rap_1763200000000', rapportNumber: 'RAP-2026-003' }
    localStorage.setItem(CLE, JSON.stringify([local]))
    enBase = [{ id: UUID_BASE, titre: 'RAP-2026-003', date: '2026-03-02', contenu: { clientName: 'M. Ancien', idLocal: 'rap_1763200000000' }, photos: [], status: 'termine' }]
    render(<RapportsSection artisan={artisan} bookings={[]} services={[]} orgRole="pro_societe" />)

    await waitFor(() => expect(rapportsLocaux().map(r => r.id)).toEqual([UUID_BASE]))
    expect(rapportsLocaux()[0]).toMatchObject({ rapportNumber: 'RAP-2026-003', clientName: 'M. Ancien' })
    expect(screen.getAllByText('RAP-2026-003')).toHaveLength(1)
  })
})

describe('Rapports de l’artisan — comportement d’avant (témoin)', () => {
  it('la sauvegarde écrit encore directement dans la base, sans passer par /api/btp', async () => {
    await creerRapport('artisan')
    await waitFor(() => expect(ecrituresDirectes.some(e => e.action === 'insert')).toBe(true))
    expect(envois).toEqual([])
  })
})
