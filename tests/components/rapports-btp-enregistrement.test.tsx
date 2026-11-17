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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
/** Durée de chaque écriture côté serveur (réseau lent), en millisecondes. */
let delaiEcriture: number
/** La création est enregistrée en base, mais sa réponse n'arrive jamais (coupure réseau). */
let reponsePerdue: boolean

beforeEach(() => {
  // Horloge figée : le numéro d'un nouveau rapport (RAP-<année>-…) dépend de l'année en cours.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-15T10:00:00Z'))
  localStorage.clear()
  ecrituresDirectes.length = 0
  envois = []
  enBase = []
  ecritureRefusee = false
  delaiEcriture = 0
  reponsePerdue = false
  vi.mocked(toast.error).mockClear()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const adresse = String(url)
    if (init?.method === 'POST' && adresse.startsWith('/api/btp')) {
      const corps = JSON.parse(String(init.body))
      envois.push(corps)
      // Refus décidé à l'envoi : une écriture déjà partie n'est pas touchée par un refus posé ensuite.
      const refusee = ecritureRefusee
      if (delaiEcriture > 0) await new Promise(resolve => setTimeout(resolve, delaiEcriture))
      if (refusee) return json({ error: 'Les données n\'ont pas pu être enregistrées.' }, 500)
      if (corps.action === 'insert') {
        const ligne = { id: UUID_BASE, ...corps.data }
        enBase.push(ligne)
        if (reponsePerdue) throw new TypeError('Failed to fetch')
        return json({ row: ligne }, 201)
      }
      if (corps.action === 'delete') {
        enBase = enBase.filter(l => l.id !== corps.id)
        return json({ deleted: true })
      }
      // Modification : comme la base, chaque colonne envoyée remplace la précédente (le contenu entier).
      const enregistree = enBase.find(l => l.id === corps.id)
      if (enregistree) Object.assign(enregistree, corps.data)
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
  vi.useRealTimers()
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

  // Relecture adverse du 15/11/2026 : un rapport supprimé avant la réponse de sa création (ou après une réponse perdue)
  // gardait son identifiant local ; seule la copie de l'appareil était supprimée, la ligne restait en base et revenait
  // au chargement suivant.
  async function rechargerLaPage() {
    cleanup()
    render(<RapportsSection artisan={artisan} bookings={[]} services={[]} orgRole="pro_societe" />)
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  it('supprimé avant la réponse de sa création : supprimé en base aussi, il ne revient pas au chargement suivant', async () => {
    delaiEcriture = 300
    await creerRapport('pro_societe')
    fireEvent.click(await screen.findByRole('button', { name: '🗑️' }))

    await waitFor(() => expect(envois.map(e => e.action)).toEqual(['insert', 'delete']), { timeout: 3000 })
    expect(envois[1]).toEqual({ table: 'rapports_btp', action: 'delete', id: UUID_BASE })
    await waitFor(() => expect(rapportsLocaux()).toEqual([]), { timeout: 3000 })
    expect(enBase).toEqual([])

    await rechargerLaPage()
    expect(rapportsLocaux()).toEqual([])
    expect(screen.queryByText('RAP-2026-001')).toBeNull()
  })

  it('réponse de création perdue, puis suppression : la ligne enregistrée est retrouvée et supprimée en base', async () => {
    reponsePerdue = true
    await creerRapport('pro_societe')
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(enBase).toHaveLength(1)
    expect(String(rapportsLocaux()[0].id)).toMatch(/^rap_/)

    reponsePerdue = false
    fireEvent.click(screen.getByRole('button', { name: '🗑️' }))
    await waitFor(() => expect(envois.map(e => e.action)).toEqual(['insert', 'delete']), { timeout: 3000 })
    expect(envois[1]).toEqual({ table: 'rapports_btp', action: 'delete', id: UUID_BASE })
    await waitFor(() => expect(rapportsLocaux()).toEqual([]), { timeout: 3000 })
    expect(enBase).toEqual([])

    await rechargerLaPage()
    expect(rapportsLocaux()).toEqual([])
  })

  it('modifié avant la réponse de sa création : la modification part vers sa ligne en base', async () => {
    delaiEcriture = 300
    await creerRapport('pro_societe')
    fireEvent.click(await screen.findByRole('button', { name: 'Marquer envoyé' }))

    await waitFor(() => expect(envois.map(e => e.action)).toEqual(['insert', 'update']), { timeout: 3000 })
    expect(envois[1]).toMatchObject({ table: 'rapports_btp', action: 'update', id: UUID_BASE })
    expect(envois[1].data?.contenu).toMatchObject({ sentStatus: 'envoye', clientName: 'Mme Dupré' })
    await waitFor(() => expect(rapportsLocaux()[0]).toMatchObject({ id: UUID_BASE, sentStatus: 'envoye' }), { timeout: 3000 })
  })

  // Relecture adverse du 16/11/2026 : on quitte la section Rapports puis on y revient avant la réponse d'une écriture.
  // 1. La section rouverte connaît encore le nouveau rapport sous son identifiant local ; sa modification partait vers la
  //    ligne en base sans le lien avec cet identifiant (idLocal) : au chargement suivant, le rapport apparaissait deux
  //    fois sous le même numéro.
  // 2. L'écriture lancée par la section quittée réécrivait l'appareil avec SA liste : un rapport créé entre-temps dans la
  //    section rouverte, dont l'envoi échouait, disparaissait au chargement suivant.
  function rouvrirLaSection() {
    cleanup()
    render(<RapportsSection artisan={artisan} bookings={[]} services={[]} orgRole="pro_societe" />)
  }

  it('section rouverte avant la réponse de sa création, puis modifié : un seul rapport au chargement suivant', async () => {
    delaiEcriture = 300
    await creerRapport('pro_societe')
    await waitFor(() => expect(envois.map(e => e.action)).toEqual(['insert']))
    rouvrirLaSection()
    const marquer = await screen.findByRole('button', { name: 'Marquer envoyé' })
    // La création aboutit pendant que la section rouverte est affichée.
    await waitFor(() => expect(rapportsLocaux().map(r => r.id)).toEqual([UUID_BASE]), { timeout: 3000 })

    fireEvent.click(marquer)
    await waitFor(() => expect(envois.map(e => e.action)).toEqual(['insert', 'update']), { timeout: 3000 })
    expect(envois[1]).toMatchObject({ table: 'rapports_btp', action: 'update', id: UUID_BASE })
    expect(envois[1].data?.contenu).toMatchObject({ sentStatus: 'envoye', idLocal: expect.stringMatching(/^rap_/) })
    await waitFor(() => expect(enBase[0].contenu).toMatchObject({ sentStatus: 'envoye' }), { timeout: 3000 })

    await rechargerLaPage()
    expect(rapportsLocaux().map(r => r.id)).toEqual([UUID_BASE])
    expect(rapportsLocaux()[0]).toMatchObject({ rapportNumber: 'RAP-2026-001', sentStatus: 'envoye' })
    expect(screen.getAllByText('RAP-2026-001')).toHaveLength(1)
  })

  it('section rouverte pendant une création : un rapport créé entre-temps reste sur l’appareil, même si son envoi échoue', async () => {
    delaiEcriture = 300
    await creerRapport('pro_societe')
    await waitFor(() => expect(envois).toHaveLength(1))
    cleanup()
    // Second rapport créé dans la section rouverte, une seconde plus tard (autre identifiant local) ; son envoi est refusé.
    vi.setSystemTime(new Date('2026-11-15T10:00:01Z'))
    ecritureRefusee = true
    await creerRapport('pro_societe')
    await waitFor(() => expect(envois.map(e => e.action)).toEqual(['insert', 'insert']))
    await waitFor(() => expect(toast.error).toHaveBeenCalled(), { timeout: 3000 })
    expect(enBase).toHaveLength(1)

    await rechargerLaPage()
    expect(rapportsLocaux().map(r => r.rapportNumber)).toEqual(['RAP-2026-002', 'RAP-2026-001'])
    expect(rapportsLocaux().map(r => r.id)).toEqual(['rap_1794736801000', UUID_BASE])
    expect(screen.getByText('RAP-2026-002')).toBeInTheDocument()
  })

  it('section rouverte pendant une suppression : un rapport créé entre-temps reste sur l’appareil, même si son envoi échoue', async () => {
    const existant = { ...ANCIEN, id: UUID_EXISTANT, rapportNumber: 'RAP-2026-005' }
    localStorage.setItem(CLE, JSON.stringify([existant]))
    enBase = [{ id: UUID_EXISTANT, titre: 'RAP-2026-005', date: '2026-03-02', contenu: { clientName: 'M. Ancien' }, photos: [], status: 'termine' }]
    delaiEcriture = 300
    render(<RapportsSection artisan={artisan} bookings={[]} services={[]} orgRole="pro_societe" />)
    fireEvent.click(await screen.findByRole('button', { name: '🗑️' }))
    await waitFor(() => expect(envois.map(e => e.action)).toEqual(['delete']))
    cleanup()
    ecritureRefusee = true
    await creerRapport('pro_societe')
    await waitFor(() => expect(envois.map(e => e.action)).toEqual(['delete', 'insert']))
    await waitFor(() => expect(toast.error).toHaveBeenCalled(), { timeout: 3000 })
    expect(enBase).toEqual([])

    await rechargerLaPage()
    expect(rapportsLocaux().map(r => r.rapportNumber)).toEqual(['RAP-2026-006'])
    expect(screen.queryByText('RAP-2026-005')).toBeNull()
  })
})

describe('Rapports de l’artisan — comportement d’avant (témoin)', () => {
  it('la sauvegarde écrit encore directement dans la base, sans passer par /api/btp', async () => {
    await creerRapport('artisan')
    await waitFor(() => expect(ecrituresDirectes.some(e => e.action === 'insert')).toBe(true))
    expect(envois).toEqual([])
  })
})
