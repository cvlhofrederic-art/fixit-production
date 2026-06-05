import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModContratos from '@/components/syndic-dashboard/v54/modules/ModContratos'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Contrato } from '@/lib/syndic/v54/api'

/** Étape d (batch d35) — byte-exact + Phase 3 : contrats réels du cabinet. */

afterEach(cleanup)

const contrato = (over: Partial<Contrato>): Contrato => ({
  id: 'k1', immeuble: 'Edifício Aurora', fornecedor: 'Limpezas Norte', categoria: 'limpezas',
  custoMensal: 300, custoAnual: 3600, dataInicio: '2026-01-01', dataFim: '2026-12-31', statut: 'ativo', notes: '',
  ...over,
})

describe('ModContratos', () => {
  it('rend le titre, l\'Empty et le lifecycle', () => {
    render(<ModContratos />)
    expect(screen.getByRole('heading', { name: 'Contratos com Prestadores', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum contrato centralizado')).toBeInTheDocument()
    expect(screen.getByText('Alerta J-90')).toBeInTheDocument()
    expect(screen.getByText('Renovação/Substituição')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 : affiche les vrais contrats du cabinet quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [],
      contratos: [contrato({ fornecedor: 'Elevadores Porto', categoria: 'elevadores' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModContratos /></SyndicDataContext.Provider>)
    expect(screen.getByText('Elevadores Porto')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum contrato centralizado')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « + Novo contrato » → POST /api/syndic/contratos + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ contrato: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [],
      contratos: [], token: 'tok-k', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModContratos /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Novo contrato/ }))
    fireEvent.change(screen.getByPlaceholderText('Ex.: Limpezas Norte, Lda.'), { target: { value: 'Segurança 24/7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/contratos', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/contratos')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ fornecedor: 'Segurança 24/7', categoria: 'limpezas' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
