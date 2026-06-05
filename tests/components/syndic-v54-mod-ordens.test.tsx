import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModOrdens from '@/components/syndic-dashboard/v54/modules/ModOrdens'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Mission } from '@/components/syndic-dashboard/types'

/** Phase 2 — ModOrdens : vraies missions du cabinet (authentifié) vs mock (preview). */

afterEach(cleanup)

const mission = (over: Partial<Mission>): Mission => ({
  id: 'abc12345-0000', immeuble: 'Edifício Real Teste', artisan: 'João Silva', type: 'Canalização',
  description: 'Fuga de água na garagem', priorite: 'urgente', statut: 'en_cours', dateCreation: '01/05/2026',
  ...over,
} as unknown as Mission)

const realData: SyndicData = {
  authenticated: true,
  loading: false,
  missions: [mission({})],
  immeubles: [],
  artisans: [],
}

describe('ModOrdens (Phase 2)', () => {
  it('affiche le mock par défaut (preview)', () => {
    render(<ModOrdens />)
    expect(screen.getAllByText('Edifício Foz Douro').length).toBeGreaterThan(0)
    cleanup()
  })

  it('affiche les vraies missions quand le cabinet est authentifié', () => {
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModOrdens />
      </SyndicDataContext.Provider>,
    )
    expect(screen.getByText('Edifício Real Teste')).toBeInTheDocument()
    expect(screen.getByText('Canalização · Fuga de água na garagem')).toBeInTheDocument()
    expect(screen.queryByText('Edifício Foz Douro')).toBeNull()
    cleanup()
  })

  it('Phase 2 écriture : « Nova missão » → POST /api/syndic/missions + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ mission: {} }), { status: 200 }))
    const writeData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], token: 'tok-x', refresh,
    }
    render(
      <SyndicDataContext.Provider value={writeData}>
        <ModOrdens />
      </SyndicDataContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Nova missão/ }))
    fireEvent.change(screen.getByPlaceholderText('Nome do edifício'), { target: { value: 'Edifício X' } })
    fireEvent.change(screen.getByPlaceholderText('Ex.: Canalização'), { target: { value: 'Eletricidade' } })
    fireEvent.change(screen.getByPlaceholderText('Descreva a intervenção…'), { target: { value: 'Curto-circuito' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar missão' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/missions', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 2 écriture : « Abrir » → édition statut → PATCH /api/syndic/missions + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ mission: {} }), { status: 200 }))
    const editData: SyndicData = {
      authenticated: true, loading: false,
      missions: [mission({ id: 'm-777', statut: 'en_attente' })],
      immeubles: [], artisans: [], team: [], coproprios: [], token: 'tok-z', refresh,
    }
    render(
      <SyndicDataContext.Provider value={editData}>
        <ModOrdens />
      </SyndicDataContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'terminee' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/missions', expect.objectContaining({ method: 'PATCH' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] !== '/api/user-storage' && (c[1] as RequestInit)?.body)![1] as RequestInit).body as string)
    expect(body).toMatchObject({ id: 'm-777', statut: 'terminee' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
