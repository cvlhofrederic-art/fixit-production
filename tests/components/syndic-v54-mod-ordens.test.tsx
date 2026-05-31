import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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
})
