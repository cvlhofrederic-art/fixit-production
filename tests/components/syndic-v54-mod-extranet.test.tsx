import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import ModExtranet from '@/components/syndic-dashboard/v54/modules/ModExtranet'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Coprop } from '@/lib/syndic/v54/api'

/** Étape d (batch d46) — ModExtranet : byte-exact + modal. + Phase 2 : condóminos réels. */

afterEach(cleanup)

describe('ModExtranet', () => {
  it('rend l\'état vide, le portail et les KPIs', () => {
    render(<ModExtranet />)
    expect(screen.getByRole('heading', { name: 'Extranet Condóminos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Registo vazio')).toBeInTheDocument()
    expect(screen.getByText('Portal Condóminos')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://vitfix.io/coproprietaire/portail')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Condómino »', () => {
    render(<ModExtranet />)
    fireEvent.click(screen.getAllByRole('button', { name: /Condómino/ })[0])
    expect(screen.getByText('Adicionar condómino')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome/)).toBeInTheDocument()
  })

  it('Phase 2 : liste les vrais condóminos du cabinet', () => {
    const realData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [],
      coproprios: [
        { id: 'c1', immeuble: 'Edifício Aurora', batiment: 'A', etage: 2, numeroPorte: '2B', proprietario: 'Condómino Real', email: 'cr@x.pt', telefone: '910', ocupado: true, acessoPortal: true, solde: -50 } as Coprop,
      ],
    }
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModExtranet />
      </SyndicDataContext.Provider>,
    )
    expect(screen.getByText('Condómino Real')).toBeInTheDocument()
    expect(screen.queryByText('Registo vazio')).toBeNull()
    cleanup()
  })

  it('Phase 2 : écriture réelle → POST /api/syndic/coproprios + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    const realData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], token: 'tok-123', refresh,
    }
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModExtranet />
      </SyndicDataContext.Provider>,
    )
    fireEvent.click(screen.getAllByRole('button', { name: /Condómino/ })[0])
    fireEvent.change(screen.getByPlaceholderText('Nome completo'), { target: { value: 'Novo Condómino Real' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/coproprios', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 2 : bouton « Adicionar » désactivé pendant le POST (anti double-soumission)', async () => {
    // fetch jamais résolu → la requête reste en cours → busy reste vrai.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>(() => {}))
    const realData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], token: 'tok-123', refresh: vi.fn(),
    }
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModExtranet />
      </SyndicDataContext.Provider>,
    )
    fireEvent.click(screen.getAllByRole('button', { name: /Condómino/ })[0])
    fireEvent.change(screen.getByPlaceholderText('Nome completo'), { target: { value: 'Condómino Único' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    // une seule requête, et le bouton est désormais désactivé → pas de doublon possible
    await waitFor(() => expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled())
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
    cleanup()
  })
})
