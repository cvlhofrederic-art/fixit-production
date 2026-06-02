import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModReembolsos from '@/components/syndic-dashboard/v54/modules/ModReembolsos'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Reembolso } from '@/lib/syndic/v54/api'

/** Étape d (batch d37) — byte-exact + Phase 3 : reembolsos réels. */

afterEach(cleanup)

const reembolso = (over: Partial<Reembolso>): Reembolso => ({
  id: 'r1', immeuble: 'Edifício Aurora', antigoProprietario: 'Ana Silva', fracao: '4B', dataVenda: '2026-06-01',
  quotasPagas: 600, montanteReembolso: 250, metodo: 'Open Banking', statut: 'pendente', notes: '',
  ...over,
})

describe('ModReembolsos', () => {
  it('rend le titre, le tableau vide et le pipeline (preview)', () => {
    render(<ModReembolsos />)
    expect(screen.getByRole('heading', { name: 'Reembolsos Automáticos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum reembolso em curso.')).toBeInTheDocument()
    expect(screen.getByText('Execução Open Banking')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 : affiche les vrais reembolsos du cabinet quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [],
      reembolsos: [reembolso({ antigoProprietario: 'Carlos Vendedor Real' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModReembolsos /></SyndicDataContext.Provider>)
    expect(screen.getByText('Carlos Vendedor Real')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum reembolso em curso.')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « Registar mudança proprietário » → POST /api/syndic/reembolsos + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ reembolso: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [],
      reembolsos: [], token: 'tok-r', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModReembolsos /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Registar mudança proprietário/ }))
    fireEvent.change(screen.getByPlaceholderText('Nome do vendedor'), { target: { value: 'Maria Antiga' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/reembolsos', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/reembolsos')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ antigoProprietario: 'Maria Antiga' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
