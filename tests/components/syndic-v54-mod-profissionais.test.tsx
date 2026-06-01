import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModProfissionais from '@/components/syndic-dashboard/v54/modules/ModProfissionais'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Artisan } from '@/components/syndic-dashboard/types'

/** Phase 2 — ModProfissionais : vrais artisans du cabinet (authentifié) vs mock (preview). */

afterEach(cleanup)

const artisan = (over: Partial<Artisan>): Artisan => ({
  id: 'a1', nom: 'Real Canalizador', metier: 'Canalizador', telephone: '910000000', email: 'real@teste.pt',
  rcProValide: true, rcProExpiration: '31/12/2027', decennaleValide: false, decennaleExpiration: '',
  note: 4.9, nbInterventions: 5, statut: 'actif', vitfixCertifie: true,
  ...over,
} as unknown as Artisan)

const realData: SyndicData = {
  authenticated: true,
  loading: false,
  artisans: [artisan({})],
  missions: [],
  immeubles: [],
}

describe('ModProfissionais (Phase 2)', () => {
  it('affiche le mock par défaut (preview)', () => {
    render(<ModProfissionais />)
    expect(screen.getByText('Serralheiro')).toBeInTheDocument()
    cleanup()
  })

  it('affiche les vrais artisans quand le cabinet est authentifié', () => {
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModProfissionais />
      </SyndicDataContext.Provider>,
    )
    expect(screen.getByText('Real Canalizador')).toBeInTheDocument()
    expect(screen.queryByText('Serralheiro')).toBeNull()
    cleanup()
  })

  it('Phase 2 écriture : « Eliminar » → confirmation → DELETE /api/syndic/artisans + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const delData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], team: [], coproprios: [],
      artisans: [artisan({ id: 'a-del', nom: 'Apagar Silva' })],
      token: 'tok-d', refresh,
    }
    render(
      <SyndicDataContext.Provider value={delData}>
        <ModProfissionais />
      </SyndicDataContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar profissional' }))
    // le modal de confirmation s'ouvre
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/syndic/artisans?artisan_id=a-del'),
      expect.objectContaining({ method: 'DELETE' }),
    ))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 2 écriture : « Adicionar um profissional » → POST /api/syndic/artisans + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ artisan: {} }), { status: 200 }))
    const writeData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [],
      token: 'tok-c', refresh,
    }
    render(
      <SyndicDataContext.Provider value={writeData}>
        <ModProfissionais />
      </SyndicDataContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Adicionar um profissional/ }))
    fireEvent.change(screen.getByPlaceholderText('Apelido / empresa'), { target: { value: 'Novo Canalizador' } })
    fireEvent.change(screen.getByPlaceholderText('nome@exemplo.pt'), { target: { value: 'novo@teste.pt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/artisans', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toMatchObject({ nom: 'Novo Canalizador', email: 'novo@teste.pt', action: 'create' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 2 raccourci : « Criar missão » sur une carte → POST /api/syndic/missions {artisan} + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ mission: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], team: [], coproprios: [],
      artisans: [artisan({ id: 'a9', nom: 'Silva Pro' })],
      token: 'tok-m', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModProfissionais /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: 'Criar missão' })) // bouton de la carte
    fireEvent.change(screen.getByPlaceholderText('Nome do edifício'), { target: { value: 'Edifício K' } })
    fireEvent.change(screen.getByPlaceholderText('Ex.: Canalização'), { target: { value: 'Eletricidade' } })
    fireEvent.change(screen.getByPlaceholderText('Descreva a intervenção…'), { target: { value: 'Quadro elétrico' } })
    const btns = screen.getAllByRole('button', { name: 'Criar missão' })
    fireEvent.click(btns[btns.length - 1]) // bouton submit du modal
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/missions', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toMatchObject({ artisan: 'Silva Pro', immeuble: 'Edifício K', type: 'Eletricidade' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
