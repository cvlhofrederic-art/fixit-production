import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModEquipa from '@/components/syndic-dashboard/v54/modules/ModEquipa'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { TeamMember } from '@/components/syndic-dashboard/types'

/** Phase 2 — ModEquipa : vraie équipe du cabinet (authentifié) vs mock (preview). */

afterEach(cleanup)

const member = (over: Partial<TeamMember>): TeamMember => ({
  id: 't1', email: 'real@gab.pt', full_name: 'Real Membro', role: 'syndic_tech',
  invite_token: null, invite_sent_at: null, accepted_at: null, is_active: true,
  created_at: '', custom_modules: null,
  ...over,
} as unknown as TeamMember)

const realData: SyndicData = {
  authenticated: true,
  loading: false,
  missions: [],
  immeubles: [],
  artisans: [],
  coproprios: [],
  team: [member({ full_name: 'Real Membro', role: 'syndic_admin' })],
}

describe('ModEquipa (Phase 2)', () => {
  it('affiche le mock par défaut (preview)', () => {
    render(<ModEquipa />)
    expect(screen.getByText('Helena Carvalho')).toBeInTheDocument()
    cleanup()
  })

  it('affiche la vraie équipe quand le cabinet est authentifié', () => {
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModEquipa />
      </SyndicDataContext.Provider>,
    )
    expect(screen.getByText('Real Membro')).toBeInTheDocument()
    expect(screen.getByText('real@gab.pt')).toBeInTheDocument()
    expect(screen.queryByText('Helena Carvalho')).toBeNull()
    cleanup()
  })

  it('reflète le statut réel : membre inactif → « Suspenso »', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], coproprios: [],
      team: [member({ full_name: 'Inativo X', is_active: false })],
    }
    render(<SyndicDataContext.Provider value={d}><ModEquipa /></SyndicDataContext.Provider>)
    expect(screen.getByText('Suspenso')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 2 écriture : « Suspender » → PATCH /api/syndic/team {is_active:false} + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ member: {} }), { status: 200 }))
    const susData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], coproprios: [],
      team: [member({ id: 't-sus', full_name: 'Sus Membro' })],
      token: 'tok-s', refresh,
    }
    render(<SyndicDataContext.Provider value={susData}><ModEquipa /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: 'Suspender' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/team', expect.objectContaining({ method: 'PATCH' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] !== '/api/user-storage' && (c[1] as RequestInit)?.body)![1] as RequestInit).body as string)
    expect(body).toMatchObject({ member_id: 't-sus', is_active: false })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 2 écriture : « Eliminar » → confirmation → DELETE /api/syndic/team + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const delData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], coproprios: [],
      team: [member({ id: 't-del', full_name: 'Del Membro' })],
      token: 'tok-d', refresh,
    }
    render(<SyndicDataContext.Provider value={delData}><ModEquipa /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]) // bouton de la ligne → ouvre le modal
    const btns = screen.getAllByRole('button', { name: 'Eliminar' })
    fireEvent.click(btns[btns.length - 1]) // bouton de confirmation (modal)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/syndic/team?member_id=t-del'),
      expect.objectContaining({ method: 'DELETE' }),
    ))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 2 écriture : « Convidar um membro » → POST /api/syndic/team + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ member: {} }), { status: 200 }))
    const inviteData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], coproprios: [],
      team: [], token: 'tok-i', refresh,
    }
    render(<SyndicDataContext.Provider value={inviteData}><ModEquipa /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Convidar um membro/ }))
    fireEvent.change(screen.getByPlaceholderText('Nome do membro'), { target: { value: 'Nova Secretária' } })
    fireEvent.change(screen.getByPlaceholderText('nome@gabinete.pt'), { target: { value: 'nova@gab.pt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/team', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] !== '/api/user-storage' && (c[1] as RequestInit)?.body)![1] as RequestInit).body as string)
    expect(body).toMatchObject({ full_name: 'Nova Secretária', email: 'nova@gab.pt', memberRole: 'syndic_tech' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
