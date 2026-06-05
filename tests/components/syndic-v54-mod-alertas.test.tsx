import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModAlertas from '@/components/syndic-dashboard/v54/modules/ModAlertas'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Artisan, Immeuble } from '@/components/syndic-dashboard/types'

/** Phase 2 — ModAlertas : alertes dérivées des vraies données (authentifié) vs « tout traité » (preview). */

afterEach(cleanup)

const realData: SyndicData = {
  authenticated: true,
  loading: false,
  missions: [],
  coproprios: [],
  team: [],
  artisans: [
    { id: 'a', nom: 'Costa', metier: 'Canalizador', rcProValide: false, decennaleValide: true, statut: 'actif', vitfixCertifie: false, note: 4, nbInterventions: 0, telephone: '', email: '' } as unknown as Artisan,
  ],
  immeubles: [
    { id: 'i', nom: 'Edifício Sem Regulamento', nbLots: 1, anneeConstruction: 2000, nbInterventions: 0, budgetAnnuel: 0, depensesAnnee: 0 } as unknown as Immeuble,
  ],
}

describe('ModAlertas (Phase 2)', () => {
  it('affiche « tout traité » par défaut (preview)', () => {
    render(<ModAlertas />)
    expect(screen.getByText('Todos os alertas foram tratados!')).toBeInTheDocument()
    cleanup()
  })

  it('dérive les alertes des vraies données (RC invalide + regulamento em falta)', () => {
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModAlertas />
      </SyndicDataContext.Provider>,
    )
    expect(screen.getByText('Seguro RC Pro inválido ou em falta')).toBeInTheDocument()
    expect(screen.getByText('Regulamento de condomínio em falta')).toBeInTheDocument()
    expect(screen.queryByText('Todos os alertas foram tratados!')).toBeNull()
    cleanup()
  })
})
