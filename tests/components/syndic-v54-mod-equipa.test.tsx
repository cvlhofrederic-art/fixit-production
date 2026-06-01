import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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
})
