import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModEdificios from '@/components/syndic-dashboard/v54/modules/ModEdificios'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Immeuble } from '@/components/syndic-dashboard/types'

/** Suspender / Reativar un edifício : confirmation → PATCH statut + état visuel. */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const im = (over: Partial<Immeuble>): Immeuble => ({ id: 'im1', nom: 'Edifício Aurora', adresse: 'Rua X', ville: 'Porto', codePostal: '4000', nbLots: 10, anneeConstruction: 2010, typeImmeuble: 'Copropriété', gestionnaire: '', nbInterventions: 0, budgetAnnuel: 48000, depensesAnnee: 0, statut: 'ativo', ...over } as Immeuble)

const data = (immeubles: Immeuble[]): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles, artisans: [], team: [], coproprios: [], token: 'tok', refresh: vi.fn() })

describe('Edifícios — Suspender / Reativar', () => {
  it('Suspender → confirmation → PATCH statut suspenso', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ immeuble: {} }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ToastProvider><SyndicDataContext.Provider value={data([im({})])}><ModEdificios /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Suspender edifício' }))
    expect(await screen.findByText(/da gestão ativa/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Suspender' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/syndic/immeubles', expect.objectContaining({ method: 'PATCH' })))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toMatchObject({ id: 'im1', statut: 'suspenso' })
  })

  it('edifício suspenso → Pill « Suspenso » + bouton Reativar', () => {
    render(<ToastProvider><SyndicDataContext.Provider value={data([im({ statut: 'suspenso' })])}><ModEdificios /></SyndicDataContext.Provider></ToastProvider>)
    expect(screen.getByText('Suspenso')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reativar edifício' })).toBeInTheDocument()
  })
})
