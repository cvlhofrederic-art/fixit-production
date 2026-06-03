import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import ModAGDigit from '@/components/syndic-dashboard/v54/modules/ModAGDigit'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { AgV54 } from '@/lib/syndic/v54/api'

/** Étape d (batch d49) — ModAGDigit : rendu byte-exact + ouverture du modal (stateful).
 *  Phase 3 slice 16 — AG réelles (table syndic_assemblees, route v54 PT↔FR) + écriture POST. */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [],
})

const ag = (over: Partial<AgV54>): AgV54 => ({
  id: 'a1', titulo: 'AG Anual 2026', edificio: 'Residência Pinheiros', dataHora: '2026-06-10T14:30:00Z',
  tipo: 'ordinaria', local: 'Sala', quorum: 50, milesimos: 10000, ordem: 'Contas\nOrçamento', estado: 'em-curso',
  ...over,
})

describe('ModAGDigit', () => {
  it('rend l\'état vide et les KPIs', () => {
    render(<ModAGDigit />)
    expect(screen.getByRole('heading', { name: 'AG Digitais', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma AG')).toBeInTheDocument()
    expect(screen.getByText('Resoluções totais')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Nova AG »', () => {
    render(<ModAGDigit />)
    fireEvent.click(screen.getAllByRole('button', { name: /Nova AG/ })[0])
    expect(screen.getByText('Nova Assembleia Geral')).toBeInTheDocument()
    expect(screen.getByLabelText(/Título/)).toBeInTheDocument()
  })

  it('Phase 3 : affiche les AG réelles quand authentifié', () => {
    const d: SyndicData = { ...base(), assembleias: [ag({ titulo: 'AG-REAL-2026' })] }
    render(<SyndicDataContext.Provider value={d}><ModAGDigit /></SyndicDataContext.Provider>)
    expect(screen.getByText('AG-REAL-2026')).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma AG')).toBeNull()
  })

  it('Phase 3 écriture : « Nova AG » → POST /api/syndic/ag-v54 + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ assembleia: {} }), { status: 200 }))
    const d: SyndicData = { ...base(), token: 'tok-ag', refresh }
    render(<SyndicDataContext.Provider value={d}><ModAGDigit /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Nova AG/ })[0])
    fireEvent.change(screen.getByPlaceholderText(/AG Anual 2026/), { target: { value: 'AG Teste 2026' } })
    fireEvent.change(screen.getByLabelText(/Data e hora/), { target: { value: '2026-06-10T14:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar a AG' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/ag-v54', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/ag-v54')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ titulo: 'AG Teste 2026', tipo: 'ordinaria' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
  })
})
