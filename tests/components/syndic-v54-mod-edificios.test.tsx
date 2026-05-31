import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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
})
