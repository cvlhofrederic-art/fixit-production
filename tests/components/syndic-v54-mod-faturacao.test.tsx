import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModFaturacao from '@/components/syndic-dashboard/v54/modules/ModFaturacao'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { FaturaCopro } from '@/lib/syndic/v54/api'

/** Phase 3 — ModFaturacao : factures condomínio réelles (table syndic_factures_copro) — liste + émission. */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [], contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] }, impayes: [], recouvrements: [], faturas: [],
})

const fat = (over: Partial<FaturaCopro>): FaturaCopro => ({
  id: 'f1', coproprioId: '', immeubleId: '', numeroFatura: 'FT-2026-001', emiseLe: '2026-02-01', echeance: '2026-03-01',
  montantHt: 1000, tvaTaux: 23, montantTtc: 1230, description: '', statut: 'a_regler', pdfUrl: '',
  ...over,
})

describe('ModFaturacao', () => {
  it('rend l\'état vide (preview anonyme)', () => {
    render(<ModFaturacao />)
    expect(screen.getByRole('heading', { name: /Faturação & Recibos Verdes/ })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma fatura emitida')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 : affiche les factures réelles quand authentifié', () => {
    const d: SyndicData = { ...base(), faturas: [fat({ numeroFatura: 'FT-REAL-77' })] }
    render(<SyndicDataContext.Provider value={d}><ModFaturacao /></SyndicDataContext.Provider>)
    expect(screen.getByText('FT-REAL-77')).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma fatura emitida')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « Emitir fatura » → POST /api/syndic/factures-copro + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ fatura: {} }), { status: 200 }))
    const d: SyndicData = { ...base(), token: 'tok-ft', refresh }
    render(<SyndicDataContext.Provider value={d}><ModFaturacao /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Emitir fatura/ })[0])
    fireEvent.change(screen.getByLabelText(/Montante HT/), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Emitir fatura' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/factures-copro', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/factures-copro')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ montantHt: 500 })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
