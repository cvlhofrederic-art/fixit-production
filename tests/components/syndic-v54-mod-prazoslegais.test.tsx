import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModPrazosLegais from '@/components/syndic-dashboard/v54/modules/ModPrazosLegais'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { PrazoLegal } from '@/lib/syndic/v54/api'

/** Étape d (batch d29) — byte-exact + Phase 3 : obligations réelles (CRUD). */

afterEach(cleanup)

const prazo = (over: Partial<PrazoLegal>): PrazoLegal => ({
  id: 'p1', immeuble: 'Edifício Aurora', titulo: 'Inspeção elevador', tipo: 'Manutenção',
  dataLimite: '2027-01-01', statut: 'pendente', notes: '',
  ...over,
})

describe('ModPrazosLegais', () => {
  it('rend le titre, les KPIs et la liste mock (preview)', () => {
    render(<ModPrazosLegais />)
    expect(screen.getByRole('heading', { name: 'Prazos Legais', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByText('Limpeza de chaminés').length).toBeGreaterThan(0)
    expect(screen.getByText('AG anual')).toBeInTheDocument()
    expect(screen.getByText('Todos os edifícios')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 : affiche les vraies obrigações du cabinet quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [],
      prazos: [prazo({ titulo: 'Certificação SCIE Real' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModPrazosLegais /></SyndicDataContext.Provider>)
    expect(screen.getByText('Certificação SCIE Real')).toBeInTheDocument()
    expect(screen.queryByText('AG anual')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « + Adicionar » → POST /api/syndic/prazos + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ prazo: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [],
      prazos: [], token: 'tok-p', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModPrazosLegais /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    fireEvent.change(screen.getByPlaceholderText('Ex.: Inspeção elevador'), { target: { value: 'Limpeza chaminés 2027' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/prazos', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/prazos')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ titulo: 'Limpeza chaminés 2027' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 3 écriture : « Marcar como realizado » → PATCH /api/syndic/prazos + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ prazo: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [],
      prazos: [prazo({ id: 'p-mark' })], token: 'tok-p', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModPrazosLegais /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como realizado' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/prazos', expect.objectContaining({ method: 'PATCH' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/prazos')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ id: 'p-mark', statut: 'realizado' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 3 écriture : « Eliminar » → DELETE /api/syndic/prazos + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [],
      prazos: [prazo({ id: 'p-del' })], token: 'tok-p', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModPrazosLegais /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar prazo legal' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/syndic/prazos?id=p-del'),
      expect.objectContaining({ method: 'DELETE' }),
    ))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
