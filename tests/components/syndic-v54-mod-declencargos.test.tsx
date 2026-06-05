import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import ModDeclEncargos from '@/components/syndic-dashboard/v54/modules/ModDeclEncargos'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { DeclEncargo } from '@/lib/syndic/v54/api'

/** Étape d (batch d42) — ModDeclEncargos : rendu byte-exact + ouverture du modal (stateful).
 *  Phase 3 slice 14 — déclarations d'encargos réelles + écriture POST. */

afterEach(cleanup)

const decl = (over: Partial<DeclEncargo>): DeclEncargo => ({
  id: 'd1', fracao: 'Apt 3.º E', condomino: 'João Silva', edificio: 'Edifício Aurora',
  dataPedido: '2026-05-01', prazoLimite: '2026-05-11', encargosCorrentes: 320, divida: 0,
  estado: 'pendente', notas: '',
  ...over,
})

describe('ModDeclEncargos', () => {
  it('rend l\'état vide, l\'alerte Lei 8/2022 et les KPIs', () => {
    render(<ModDeclEncargos />)
    expect(screen.getByRole('heading', { name: 'Declaração de Encargos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma declaração registada')).toBeInTheDocument()
    expect(screen.getByText('Total de declarações')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Nova declaração »', () => {
    render(<ModDeclEncargos />)
    fireEvent.click(screen.getAllByRole('button', { name: /Nova declaração/ })[0])
    expect(screen.getByText('Nova declaração de encargos')).toBeInTheDocument()
    expect(screen.getByLabelText(/Fração/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Condómino/)).toBeInTheDocument()
  })

  it('Phase 3 : affiche les déclarations réelles quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [],
      declaracoes: [decl({ fracao: 'FRAC-REAL-9' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModDeclEncargos /></SyndicDataContext.Provider>)
    expect(screen.getByText('FRAC-REAL-9')).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma declaração registada')).toBeNull()
  })

  it('Phase 3 écriture : « + Nova declaração » → POST /api/syndic/decl-encargos + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ declaracao: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [],
      declaracoes: [], token: 'tok-de', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModDeclEncargos /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Nova declaração/ })[0])
    fireEvent.change(screen.getByPlaceholderText('Apt 3.º E'), { target: { value: 'Apt 5.º D' } })
    fireEvent.change(screen.getByPlaceholderText('Nome do proprietário'), { target: { value: 'Maria Costa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/decl-encargos', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/decl-encargos')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ fracao: 'Apt 5.º D', condomino: 'Maria Costa' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
  })
})
