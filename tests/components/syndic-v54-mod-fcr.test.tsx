import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import ModFCR from '@/components/syndic-dashboard/v54/modules/ModFCR'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { FcrEdificio } from '@/lib/syndic/v54/api'

/** Étape d (batch d43) — ModFCR : rendu byte-exact + ouverture des 2 modals (stateful).
 *  Phase 3 slice 15 — édifices & mouvements FCR réels + écriture POST (2 entités). */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [],
})

const edif = (over: Partial<FcrEdificio>): FcrEdificio => ({
  id: 'e1', nome: 'Residência Pinheiros', endereco: 'Rua X', orcamentoAnual: 50000, percentagemFCR: 12, saldoInicial: 8000,
  ...over,
})

describe('ModFCR', () => {
  it('rend l\'état vide, les KPIs et la conformité', () => {
    render(<ModFCR />)
    expect(screen.getByRole('heading', { name: 'Fundo Comum de Reserva', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum edifício configurado')).toBeInTheDocument()
    expect(screen.getByText('Conformidade Legal')).toBeInTheDocument()
  })

  it('ouvre le modal edifício', () => {
    render(<ModFCR />)
    fireEvent.click(screen.getAllByRole('button', { name: /Novo Edifício/ })[0])
    expect(screen.getByText('Adicionar edifício ao FCR')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome do edifício/)).toBeInTheDocument()
  })

  it('ouvre le modal movimento', () => {
    render(<ModFCR />)
    fireEvent.click(screen.getAllByRole('button', { name: /Registar Movimento/ })[0])
    expect(screen.getByText('Registar movimento no FCR')).toBeInTheDocument()
    expect(screen.getByLabelText(/Montante/)).toBeInTheDocument()
  })

  it('Phase 3 : affiche les édifices FCR réels quand authentifié', () => {
    const d: SyndicData = { ...base(), fcrEdificios: [edif({ nome: 'EDIF-REAL-FCR' })] }
    render(<SyndicDataContext.Provider value={d}><ModFCR /></SyndicDataContext.Provider>)
    expect(screen.getByText('EDIF-REAL-FCR')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum edifício configurado')).toBeNull()
  })

  it('Phase 3 écriture : « Novo Edifício » → POST /api/syndic/fcr-edificios + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ edificio: {} }), { status: 200 }))
    const d: SyndicData = { ...base(), token: 'tok-fcr', refresh }
    render(<SyndicDataContext.Provider value={d}><ModFCR /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Novo Edifício/ })[0])
    fireEvent.change(screen.getByPlaceholderText('Residência Os Pinheiros'), { target: { value: 'Edifício Teste FCR' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar edifício' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/fcr-edificios', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/fcr-edificios')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ nome: 'Edifício Teste FCR' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
  })

  it('Phase 3 écriture : « Registar Movimento » → POST /api/syndic/fcr-movimentos + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ movimento: {} }), { status: 200 }))
    const d: SyndicData = { ...base(), token: 'tok-fcr', refresh }
    render(<SyndicDataContext.Provider value={d}><ModFCR /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Registar Movimento/ })[0])
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '500' } })
    fireEvent.change(screen.getByPlaceholderText('Origem do movimento, justificação…'), { target: { value: 'Quota trimestral' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/fcr-movimentos', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/fcr-movimentos')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ montante: 500, descricao: 'Quota trimestral' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
  })
})
