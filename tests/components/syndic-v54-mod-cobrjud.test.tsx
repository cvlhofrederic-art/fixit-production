import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModCobrJud from '@/components/syndic-dashboard/v54/modules/ModCobrJud'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Recouvrement } from '@/lib/syndic/v54/api'

/** Phase 3 — ModCobrJud : pipeline réel (table syndic_recouvrement) — kanban, ouverture (POST), avancement (PATCH). */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [], contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] }, impayes: [], recouvrements: [],
})

const rec = (over: Partial<Recouvrement>): Recouvrement => ({
  id: 'rc1', immeubleId: '', coproprioId: '', impayeId: '', procedure: 'amiable', statut: 'en_cours',
  montantInitial: 2450, montantRecouvre: 0, dateOuverture: '2026-01-01', dateCloture: '', avocatHuissier: '', prochaineEcheance: '', notes: '',
  ...over,
})

describe('ModCobrJud', () => {
  it('rend le pipeline byte-exact (preview) avec colonnes légales', () => {
    render(<ModCobrJud />)
    expect(screen.getByRole('heading', { name: 'Cobrança Judicial' })).toBeInTheDocument()
    expect(screen.getByText('Injunção / Tribunal')).toBeInTheDocument()
    expect(screen.getAllByText('Sem processos').length).toBeGreaterThan(0)
  })

  it('Phase 3 : affiche les processus réels groupés par étape', () => {
    const d: SyndicData = { ...base(), recouvrements: [rec({ procedure: 'tribunal' })] }
    render(<SyndicDataContext.Provider value={d}><ModCobrJud /></SyndicDataContext.Provider>)
    expect(screen.getByText('Em curso')).toBeInTheDocument() // statut label, présent seulement avec data
    cleanup()
  })

  it('Phase 3 écriture : « Novo processo » → POST /api/syndic/recouvrement + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ recouvrement: {} }), { status: 200 }))
    const d: SyndicData = { ...base(), token: 'tok-rc', refresh }
    render(<SyndicDataContext.Provider value={d}><ModCobrJud /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Novo processo/ })[0])
    fireEvent.change(screen.getByLabelText(/Montante em dívida/), { target: { value: '3200' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir processo' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/recouvrement', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/recouvrement')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ montantInitial: 3200, procedure: 'amiable' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 3 avancement : « Avançar » → PATCH procedure étape suivante + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ recouvrement: {} }), { status: 200 }))
    const d: SyndicData = { ...base(), token: 'tok-rc', refresh, recouvrements: [rec({ id: 'rcX', procedure: 'amiable' })] }
    render(<SyndicDataContext.Provider value={d}><ModCobrJud /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Avançar/ }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/recouvrement', expect.objectContaining({ method: 'PATCH' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/recouvrement')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ id: 'rcX', procedure: 'mise_en_demeure' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
