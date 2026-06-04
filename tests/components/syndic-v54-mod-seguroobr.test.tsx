import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import ModSeguroObr from '@/components/syndic-dashboard/v54/modules/ModSeguroObr'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Seguro } from '@/lib/syndic/v54/api'

/** Étape d (batch d45) — ModSeguroObr : rendu byte-exact + ouverture des 2 modals (stateful).
 *  Phase 3 slice 18 — réutilise syndic_seguros (filtre incendio) + syndic_sinistros + écriture POST. */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [],
})

const seguro = (over: Partial<Seguro>): Seguro => ({
  id: 's1', immeuble: 'Edifício Aurora', seguradora: 'Fidelidade', tipo: 'incendio', apolice: 'AP-INC-1',
  premioAnual: 850, capital: 500000, dataInicio: '2026-01-01', dataFim: '2027-01-01', statut: 'ativa', notes: '',
  ...over,
})

describe('ModSeguroObr', () => {
  it('rend l\'état vide et les KPIs', () => {
    render(<ModSeguroObr />)
    expect(screen.getByRole('heading', { name: 'Seguro Obrigatório de Condomínio', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma apólice registada')).toBeInTheDocument()
    expect(screen.getByText('Apólices Ativas')).toBeInTheDocument()
  })

  it('ouvre le modal apólice', () => {
    render(<ModSeguroObr />)
    fireEvent.click(screen.getAllByRole('button', { name: /Nova Apólice/ })[0])
    expect(screen.getByText('Nova apólice de seguro')).toBeInTheDocument()
    expect(screen.getByLabelText(/Seguradora/)).toBeInTheDocument()
  })

  it('ouvre le modal sinistro', () => {
    render(<ModSeguroObr />)
    fireEvent.click(screen.getAllByRole('button', { name: /Participar Sinistro/ })[0])
    expect(screen.getByText('Participar sinistro')).toBeInTheDocument()
    expect(screen.getByLabelText(/Montante estimado/)).toBeInTheDocument()
  })

  it('Phase 3 : affiche les apólices incendio réelles, filtre les autres tipos', () => {
    const d: SyndicData = { ...base(), seguros: [
      seguro({ apolice: 'AP-INC-OK', tipo: 'incendio' }),
      seguro({ id: 's2', apolice: 'AP-MR-NO', tipo: 'multirriscos' }),
    ] }
    render(<SyndicDataContext.Provider value={d}><ModSeguroObr /></SyndicDataContext.Provider>)
    expect(screen.getByText('AP-INC-OK')).toBeInTheDocument()
    expect(screen.queryByText('AP-MR-NO')).toBeNull() // multirriscos reste dans ModSeguros
    expect(screen.queryByText('Nenhuma apólice registada')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « Nova Apólice » → POST /api/syndic/seguros (tipo=incendio) + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ seguro: {} }), { status: 200 }))
    const d: SyndicData = { ...base(), token: 'tok-so', refresh }
    render(<SyndicDataContext.Provider value={d}><ModSeguroObr /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Nova Apólice/ })[0])
    fireEvent.change(screen.getByPlaceholderText(/Fidelidade/), { target: { value: 'Tranquilidade' } })
    fireEvent.change(screen.getByPlaceholderText(/AP-2026/), { target: { value: 'AP-INC-NEW' } })
    fireEvent.change(screen.getByPlaceholderText('Residência…'), { target: { value: 'Edifício SO Teste' } })
    fireEvent.change(screen.getByLabelText(/Prémio anual/), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registar apólice' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/seguros', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/seguros')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ seguradora: 'Tranquilidade', apolice: 'AP-INC-NEW', tipo: 'incendio' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 3 écriture : « Participar Sinistro » → POST /api/syndic/sinistros + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ sinistro: {} }), { status: 200 }))
    const d: SyndicData = { ...base(), token: 'tok-so', refresh }
    render(<SyndicDataContext.Provider value={d}><ModSeguroObr /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Participar Sinistro/ })[0])
    fireEvent.change(screen.getByLabelText(/Montante estimado/), { target: { value: '1200' } })
    fireEvent.change(screen.getByPlaceholderText(/Descreva os factos/), { target: { value: 'Inundação cave bloco B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Participar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/sinistros', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/sinistros')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ descricao: 'Inundação cave bloco B', montanteEstimado: 1200 })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
