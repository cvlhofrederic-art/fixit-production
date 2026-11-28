// CRM du secrétariat, écran principal (components/crm/EcranCrm.tsx).
// Constats de la relecture du 22/11/2026 :
// - la réponse tardive de la demande A s'affichait alors que B était choisie, et « Résolue » modifiait B ;
// - consulter une demande démontait la fiche « Appel en cours » : la saisie de l'appel en cours était perdue.
// Données fictives ; Supabase et l'API du CRM sont simulés.

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { DemandeCrm } from '@/lib/crm/types'

const h = vi.hoisted(() => ({
  api: {
    listerDemandes: vi.fn(),
    lireDemande: vi.fn(),
    modifierDemande: vi.fn(),
    ajouterNote: vi.fn(),
    contactParTelephone: vi.fn(),
    creerDemande: vi.fn(),
    modifierContact: vi.fn(),
  },
  naviguer: vi.fn(),
}))

vi.mock('@/components/crm/api-crm', () => ({
  apiCrm: h.api,
  ErreurApiCrm: class ErreurApiCrm extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
    ) {
      super(code)
    }
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/security/safe-url', () => ({ safeNavigate: h.naviguer }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'jeton' } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}))

const { default: EcranCrm } = await import('@/components/crm/EcranCrm')
const { ErreurApiCrm } = await import('@/components/crm/api-crm')

const demande = (id: string, titre: string): DemandeCrm => ({
  id,
  numero: id === 'A' ? 1 : 2,
  contact_id: null,
  titre,
  description: '',
  motif: 'info',
  canal: 'appel',
  priorite: 'normale',
  statut: 'nouvelle',
  rappel_le: null,
  resolue_le: null,
  created_at: id === 'A' ? '2026-11-22T10:00:00Z' : '2026-11-22T09:00:00Z',
  updated_at: '2026-11-22T10:00:00Z',
  contact: null,
})
const detail = (id: string, titre: string) => ({ demande: demande(id, titre), contact: null, evenements: [] })

beforeEach(() => {
  window.localStorage.setItem('vitfix_crm_langue', 'fr')
  h.api.listerDemandes.mockResolvedValue({
    demandes: [demande('A', 'Demande A'), demande('B', 'Demande B')],
    compteurs: { aTraiterAujourdhui: 2, enRetard: 0, resoluesSemaine: 0 },
    tronquee: false,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

async function ouvrirEcran() {
  render(<EcranCrm />)
  await screen.findByText('Demande A')
}

describe('EcranCrm', () => {
  it('réponse tardive de A après le choix de B : le panneau montre B et « Résolue » modifie B', async () => {
    let libererA: (valeur: unknown) => void = () => {}
    h.api.lireDemande.mockImplementation((id: string) =>
      id === 'A'
        ? new Promise((resoudre) => {
            libererA = resoudre
          })
        : Promise.resolve(detail('B', 'Demande B')),
    )
    h.api.modifierDemande.mockResolvedValue({ demande: demande('B', 'Demande B') })
    await ouvrirEcran()

    fireEvent.click(screen.getByRole('button', { name: /Demande A/ }))
    fireEvent.click(screen.getByRole('button', { name: /Demande B/ }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Demande B' })).toBeInTheDocument())
    await act(async () => {
      libererA(detail('A', 'Demande A'))
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Demande B' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Demande A' })).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Résolue' }))
    })
    expect(h.api.modifierDemande).toHaveBeenCalledWith('B', { statut: 'resolue' })
  })

  it('la saisie de l’appel en cours survit à la consultation d’une autre demande', async () => {
    h.api.lireDemande.mockResolvedValue(detail('A', 'Demande A'))
    await ouvrirEcran()
    fireEvent.change(screen.getByLabelText('Ce que dit le client'), { target: { value: 'Fuite sous l’évier' } })

    fireEvent.click(screen.getByRole('button', { name: /Demande A/ }))
    await screen.findByRole('heading', { level: 2, name: 'Demande A' })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(screen.getByLabelText('Ce que dit le client')).toHaveValue('Fuite sous l’évier')
  })

  it('compte sans droit (403) : écran « Accès réservé », sans liste', async () => {
    h.api.listerDemandes.mockRejectedValue(new ErreurApiCrm(403, 'acces_refuse'))
    render(<EcranCrm />)
    expect(await screen.findByRole('heading', { name: 'Accès réservé' })).toBeInTheDocument()
    expect(screen.queryByText('Demande A')).not.toBeInTheDocument()
  })

  it('propose « Installer l’application » dans l’en-tête quand le navigateur sait installer (ordinateur)', async () => {
    const origine = window.matchMedia
    window.matchMedia = vi.fn((requete: string) => ({ matches: requete === '(pointer: fine)', media: requete })) as unknown as typeof window.matchMedia
    onTestFinished(() => {
      window.matchMedia = origine
    })
    await ouvrirEcran()
    expect(screen.queryByRole('button', { name: 'Installer l’application' })).not.toBeInTheDocument()
    const evenement = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    })
    act(() => {
      window.dispatchEvent(evenement)
    })
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Installer l’application' })).toBeInTheDocument()
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(screen.queryByRole('button', { name: 'Installer l’application' })).not.toBeInTheDocument()
  })

  it('session expirée (401) : vers la page de connexion dans la langue de l’écran', async () => {
    h.api.listerDemandes.mockRejectedValue(new ErreurApiCrm(401, 'non_connecte'))
    render(<EcranCrm />)
    await waitFor(() => expect(h.naviguer).toHaveBeenCalledWith('/fr/auth/login', { allowRelative: true }))
  })
})
