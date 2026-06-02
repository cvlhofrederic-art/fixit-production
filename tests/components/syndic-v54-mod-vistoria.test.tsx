import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModVistoria from '@/components/syndic-dashboard/v54/modules/ModVistoria'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Vistoria } from '@/lib/syndic/v54/api'

/** Phase 3 — ModVistoria : vraies vistorias du cabinet (authentifié) vs empty (preview). */

afterEach(cleanup)

const vistoria = (over: Partial<Vistoria>): Vistoria => ({
  id: 'v1', immeuble: 'Edifício Aurora', titulo: 'Vistoria anual', statut: 'em_curso',
  pontosVigiar: 3, pontosDeficientes: 1, dataVistoria: '2026-05-01', notes: '',
  ...over,
})

describe('ModVistoria (Phase 3)', () => {
  it('preview (non authentifié) : état vide byte-exact', () => {
    render(<ModVistoria />)
    expect(screen.getByText('Nenhuma vistoria registada')).toBeInTheDocument()
    cleanup()
  })

  it('affiche les vraies vistorias quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [],
      vistorias: [vistoria({ titulo: 'Vistoria Fachada Real' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModVistoria /></SyndicDataContext.Provider>)
    expect(screen.getByText('Vistoria Fachada Real')).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma vistoria registada')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « + Nova vistoria » → POST /api/syndic/vistorias + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ vistoria: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [],
      vistorias: [], token: 'tok-v', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModVistoria /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Nova vistoria/ })[0])
    fireEvent.change(screen.getByPlaceholderText('Ex.: Vistoria anual partes comuns'), { target: { value: 'Vistoria Telhado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/vistorias', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/vistorias')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ titulo: 'Vistoria Telhado', statut: 'em_curso' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
