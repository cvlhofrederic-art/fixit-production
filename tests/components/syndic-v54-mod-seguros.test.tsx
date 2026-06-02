import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModSeguros from '@/components/syndic-dashboard/v54/modules/ModSeguros'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Seguro } from '@/lib/syndic/v54/api'

/** Phase 3 — ModSeguros : vraies apólices du cabinet (authentifié) vs empty (preview). */

afterEach(cleanup)

const seguro = (over: Partial<Seguro>): Seguro => ({
  id: 's1', immeuble: 'Edifício Aurora', seguradora: 'Fidelidade', tipo: 'multirriscos', apolice: 'AP-001',
  premioAnual: 1200, capital: 500000, dataInicio: '2026-01-01', dataFim: '2026-12-31', statut: 'ativa', notes: '',
  ...over,
})

describe('ModSeguros (Phase 3)', () => {
  it('preview (non authentifié) : état vide byte-exact', () => {
    render(<ModSeguros />)
    expect(screen.getByText('Nenhum edifício registado')).toBeInTheDocument()
    cleanup()
  })

  it('affiche les vraies apólices du cabinet quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [],
      seguros: [seguro({ seguradora: 'Tranquilidade Seguros' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModSeguros /></SyndicDataContext.Provider>)
    expect(screen.getByText('Tranquilidade Seguros')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum edifício registado')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « + Nova Apólice » → POST /api/syndic/seguros + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ seguro: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [],
      seguros: [], token: 'tok-s', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModSeguros /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Nova Apólice/ }))
    fireEvent.change(screen.getByPlaceholderText('Ex.: Fidelidade, Tranquilidade…'), { target: { value: 'Açoreana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/seguros', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/seguros')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ seguradora: 'Açoreana', tipo: 'multirriscos' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
