import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModProcuracoes from '@/components/syndic-dashboard/v54/modules/ModProcuracoes'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Procuracao } from '@/lib/syndic/v54/api'

/** Étape d (batch d32) — byte-exact + Phase 3 : procurations réelles. */

afterEach(cleanup)

const procuracao = (over: Partial<Procuracao>): Procuracao => ({
  id: 'pc1', immeuble: 'Edifício Aurora', condomino: 'Ana Silva', procurador: 'João Costa', fracao: '2C',
  dataValidade: '2026-12-31', agRef: 'AG 2026', statut: 'valida', notes: '',
  ...over,
})

describe('ModProcuracoes', () => {
  it('rend le titre, l\'alerte légale et le pipeline OCR (preview)', () => {
    render(<ModProcuracoes />)
    expect(screen.getByRole('heading', { name: 'Procurações & Lista de Presenças', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma procuração arquivada')).toBeInTheDocument()
    expect(screen.getByText('Pipeline OCR Léa')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 : affiche les vraies procurations du cabinet quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [],
      procuracoes: [procuracao({ condomino: 'Condómino Representado X' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModProcuracoes /></SyndicDataContext.Provider>)
    expect(screen.getByText(/Condómino Representado X/)).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma procuração arquivada')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « Registar procuração » → POST /api/syndic/procuracoes + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ procuracao: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [],
      procuracoes: [], token: 'tok-pc', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModProcuracoes /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Registar procuração/ })[0])
    fireEvent.change(screen.getByPlaceholderText('Nome do condómino'), { target: { value: 'Pedro Representado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/procuracoes', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/procuracoes')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ condomino: 'Pedro Representado' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
