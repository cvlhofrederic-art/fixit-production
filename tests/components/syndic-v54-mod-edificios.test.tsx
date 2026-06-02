import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModEdificios from '@/components/syndic-dashboard/v54/modules/ModEdificios'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Immeuble } from '@/components/syndic-dashboard/types'

/** Phase 2 — ModEdificios : vraies données du cabinet (authentifié) vs mock (preview). */

afterEach(cleanup)

const immeuble = (over: Partial<Immeuble>): Immeuble => ({
  id: '1', nom: 'Edifício Teste Real', adresse: 'Rua de Teste, 1', ville: 'Porto', codePostal: '4000-001',
  nbLots: 7, anneeConstruction: 2010, nbInterventions: 2, budgetAnnuel: 10000, depensesAnnee: 5000,
  ...over,
} as unknown as Immeuble)

const realData: SyndicData = {
  authenticated: true,
  loading: false,
  immeubles: [immeuble({ nom: 'Edifício Teste Real' })],
  missions: [],
  artisans: [],
}

describe('ModEdificios (Phase 2)', () => {
  it('affiche le mock par défaut (hors provider authentifié → preview)', () => {
    render(<ModEdificios />)
    expect(screen.getByText('Edifício Atlântico')).toBeInTheDocument()
    cleanup()
  })

  it('affiche les vrais immeubles quand le cabinet est authentifié', () => {
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModEdificios />
      </SyndicDataContext.Provider>,
    )
    expect(screen.getByText('Edifício Teste Real')).toBeInTheDocument()
    // le mock ne doit PLUS apparaître
    expect(screen.queryByText('Edifício Atlântico')).toBeNull()
    cleanup()
  })

  it('Phase 2 écriture : Adicionar edifício → POST /api/syndic/immeubles + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ immeuble: {} }), { status: 200 }))
    const writeData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], token: 'tok-y', refresh,
    }
    render(
      <SyndicDataContext.Provider value={writeData}>
        <ModEdificios />
      </SyndicDataContext.Provider>,
    )
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar um edifício/ })[0])
    fireEvent.change(screen.getByPlaceholderText('Ex.: Edifício Aurora'), { target: { value: 'Edifício Novo Real' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/immeubles', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 2 écriture : « Editar » → PATCH /api/syndic/immeubles {id} + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ immeuble: {} }), { status: 200 }))
    const editData: SyndicData = {
      authenticated: true, loading: false, missions: [], artisans: [], team: [], coproprios: [],
      immeubles: [immeuble({ id: 'b-55', nom: 'Edifício a Editar', nbLots: 9 })],
      token: 'tok-e', refresh,
    }
    render(
      <SyndicDataContext.Provider value={editData}>
        <ModEdificios />
      </SyndicDataContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    // le modal s'ouvre pré-rempli avec le nom existant
    expect((screen.getByPlaceholderText('Ex.: Edifício Aurora') as HTMLInputElement).value).toBe('Edifício a Editar')
    fireEvent.change(screen.getByPlaceholderText('Ex.: Edifício Aurora'), { target: { value: 'Edifício Renovado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/immeubles', expect.objectContaining({ method: 'PATCH' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] !== '/api/user-storage' && (c[1] as RequestInit)?.body)![1] as RequestInit).body as string)
    expect(body).toMatchObject({ id: 'b-55', nom: 'Edifício Renovado' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 2 raccourci : « Nova missão » sur une carte → POST /api/syndic/missions {immeuble verrouillé} + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ mission: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], artisans: [], team: [], coproprios: [],
      immeubles: [immeuble({ id: 'b-9', nom: 'Edifício Z' })],
      token: 'tok-m', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModEdificios /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: 'Nova missão' })) // bouton de la carte
    fireEvent.change(screen.getByPlaceholderText('Ex.: Canalização'), { target: { value: 'Telhado' } })
    fireEvent.change(screen.getByPlaceholderText('Descreva a intervenção…'), { target: { value: 'Infiltração' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar missão' })) // submit du modal
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/missions', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] !== '/api/user-storage' && (c[1] as RequestInit)?.body)![1] as RequestInit).body as string)
    expect(body).toMatchObject({ immeuble: 'Edifício Z', type: 'Telhado' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
