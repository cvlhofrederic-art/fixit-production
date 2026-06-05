import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import ModObrigPrazos from '@/components/syndic-dashboard/v54/modules/ModObrigPrazos'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { PrazoLegal } from '@/lib/syndic/v54/api'

/** Étape d (batch d44) — ModObrigPrazos : rendu byte-exact + ouverture du modal (stateful).
 *  Phase 3 slice 17 — réutilise la table syndic_prazos (dataset data.prazos) + écriture POST. */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [],
})

const prazo = (over: Partial<PrazoLegal>): PrazoLegal => ({
  id: 'p1', immeuble: 'Edifício Aurora', titulo: 'Inspeção elevador bloco A', tipo: 'elevador',
  dataLimite: '2027-01-15', statut: 'pendente', notes: '',
  ...over,
})

describe('ModObrigPrazos', () => {
  it('rend l\'état vide, l\'alerte et les références légales', () => {
    render(<ModObrigPrazos />)
    expect(screen.getByRole('heading', { name: 'Obrigações Legais', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/Nenhuma obrigação registada/)).toBeInTheDocument()
    expect(screen.getByText('Inspeção de gás')).toBeInTheDocument()
    expect(screen.getByText('Segurança contra incêndios')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Adicionar »', () => {
    render(<ModObrigPrazos />)
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar/ })[0])
    expect(screen.getByText('Adicionar obrigação legal')).toBeInTheDocument()
    expect(screen.getByLabelText(/Tipo de obrigação/)).toBeInTheDocument()
  })

  it('Phase 3 : mappe les prazos réels en obligations (tipo hors map → fallback)', () => {
    const d: SyndicData = { ...base(), prazos: [prazo({ immeuble: 'EDIF-OBRIG-9', tipo: 'autre-x' })] }
    render(<SyndicDataContext.Provider value={d}><ModObrigPrazos /></SyndicDataContext.Provider>)
    expect(screen.getByText('EDIF-OBRIG-9')).toBeInTheDocument()
    expect(screen.getByText('Inspeção elevador bloco A')).toBeInTheDocument()
    expect(screen.getByText('autre-x')).toBeInTheDocument() // guard TIPO_LABEL[t] || t
    expect(screen.queryByText(/Nenhuma obrigação registada/)).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « Adicionar » → POST /api/syndic/prazos + refresh (mapping obligation→prazo)', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ prazo: {} }), { status: 200 }))
    const d: SyndicData = { ...base(), token: 'tok-op', refresh }
    render(<SyndicDataContext.Provider value={d}><ModObrigPrazos /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar/ })[0])
    fireEvent.change(screen.getByPlaceholderText('Residência…'), { target: { value: 'Edifício Teste OP' } })
    fireEvent.change(screen.getByPlaceholderText(/Inspeção de elevador do bloco A/), { target: { value: 'Conservação 8 anos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/prazos', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/prazos')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ immeuble: 'Edifício Teste OP', titulo: 'Conservação 8 anos' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
