import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModSinistros from '@/components/syndic-dashboard/v54/modules/ModSinistros'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Sinistro } from '@/lib/syndic/v54/api'

/** Phase 3 — ModSinistros : vrais sinistres du cabinet (authentifié) vs empty (preview). */

afterEach(cleanup)

const sinistro = (over: Partial<Sinistro>): Sinistro => ({
  id: 'x1', immeuble: 'Edifício Aurora', tipo: 'Inundação', descricao: 'Cave alagada', seguradora: 'Fidelidade',
  statut: 'declarado', montanteEstimado: 5000, indemnizacao: 0, dataDeclaracao: '2026-05-01', urgente: true, notes: '',
  ...over,
})

describe('ModSinistros (Phase 3)', () => {
  it('preview (non authentifié) : pipeline + état vide byte-exact', () => {
    render(<ModSinistros />)
    expect(screen.getByRole('heading', { name: 'Pipeline Sinistros', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum sinistro')).toBeInTheDocument()
    cleanup()
  })

  it('affiche les vrais sinistres du cabinet quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [],
      sinistros: [sinistro({ tipo: 'Incêndio Real' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModSinistros /></SyndicDataContext.Provider>)
    expect(screen.getByText(/Incêndio Real/)).toBeInTheDocument()
    expect(screen.queryByText('Nenhum sinistro')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « + Novo sinistro » → POST /api/syndic/sinistros + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ sinistro: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [],
      sinistros: [], token: 'tok-x', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModSinistros /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Novo sinistro/ }))
    fireEvent.change(screen.getByPlaceholderText('Ex.: Inundação, Incêndio…'), { target: { value: 'Roubo garagem' } })
    fireEvent.click(screen.getByRole('button', { name: 'Declarar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/sinistros', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/sinistros')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ tipo: 'Roubo garagem', statut: 'declarado' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
