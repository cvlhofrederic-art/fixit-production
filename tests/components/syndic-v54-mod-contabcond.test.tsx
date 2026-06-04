import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import ModContabCond from '@/components/syndic-dashboard/v54/modules/ModContabCond'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { ContabChamada } from '@/lib/syndic/v54/api'

/** Étape d (batch d54) — ModContabCond : comptabilité condomínio byte-exact (7 onglets + 4 modals).
 *  Phase 3 slice 19 — 4 entités réelles via /api/syndic/contab + écriture POST. */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [],
  contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] },
})

const chamada = (over: Partial<ContabChamada>): ContabChamada => ({
  id: 'c1', titulo: 'Q1 2026', edificio: 'Aurora', dataEmissao: '2026-01-01', dataVencimento: '2026-02-01',
  montante: 4800, distribuicao: 'milesimos', notas: '', liquidadas: 0,
  ...over,
})

describe('ModContabCond', () => {
  it('rend le painel + KPIs', () => {
    render(<ModContabCond />)
    expect(screen.getByRole('heading', { name: 'Contabilidade Condomínio', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Frações geridas')).toBeInTheDocument()
    expect(screen.getByText('Saldo tesouraria')).toBeInTheDocument()
    cleanup()
  })

  it('ouvre l\'onglet Frações et le modal d\'ajout', () => {
    render(<ModContabCond />)
    fireEvent.click(screen.getByRole('tab', { name: /Frações & Permilagem/ }))
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar fração|primeira fração/ })[0])
    expect(screen.getAllByText('Adicionar fração').length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/Permilagem/)).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 : affiche les données réelles du cabinet (painel — chamadas)', () => {
    const d: SyndicData = { ...base(), contab: { fracoes: [], chamadas: [chamada({ titulo: 'CH-REAL-CONTAB' })], diario: [], orcamentos: [] } }
    render(<SyndicDataContext.Provider value={d}><ModContabCond /></SyndicDataContext.Provider>)
    expect(screen.getByText('CH-REAL-CONTAB')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 écriture : ajout fração → POST /api/syndic/contab (entity=frac) + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ item: {} }), { status: 200 }))
    const d: SyndicData = { ...base(), token: 'tok-cc', refresh }
    render(<SyndicDataContext.Provider value={d}><ModContabCond /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('tab', { name: /Frações & Permilagem/ }))
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar fração|primeira fração/ })[0])
    fireEvent.change(screen.getByPlaceholderText(/Apt 3/), { target: { value: 'Apt 7.º F' } })
    fireEvent.change(screen.getByLabelText(/Permilagem/), { target: { value: '125' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/contab', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/contab')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ entity: 'frac', identificacao: 'Apt 7.º F', permilagem: 125 })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
