import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModMapaQuotas from '@/components/syndic-dashboard/v54/modules/ModMapaQuotas'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Coprop } from '@/lib/syndic/v54/api'

/** Étape d (batch d27) — ModMapaQuotas : rendu byte-exact (mock). + Phase 2 : données réelles. */

afterEach(cleanup)

describe('ModMapaQuotas', () => {
  it('rend le titre, les KPIs et le tableau des frações (mock/preview)', () => {
    render(<ModMapaQuotas />)
    expect(screen.getByRole('heading', { name: 'Mapa de Quotas', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Orçamento anual (EUR)')).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('Gabriela Almeida')).toBeInTheDocument()
    expect(screen.getByText('45d atraso | 185,00 €')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Permilagem' })).toBeInTheDocument()
    cleanup()
  })

  it('Phase 2 : vrais condóminos + statut dívida (solde < 0)', () => {
    const coprop = (over: Partial<Coprop>): Coprop => ({
      id: 'c1', immeuble: 'Edifício Aurora', batiment: 'A', etage: 1, numeroPorte: '1A',
      proprietario: 'Próprio Teste', email: '', telefone: '', ocupado: true, tantieme: 80, solde: 0,
      ...over,
    })
    const realData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [],
      coproprios: [coprop({ proprietario: 'Próprio Em Dia', solde: 0 }), coprop({ id: 'c2', proprietario: 'Devedor Real', solde: -1500 })],
    }
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModMapaQuotas />
      </SyndicDataContext.Provider>,
    )
    expect(screen.getByText('Devedor Real')).toBeInTheDocument()
    expect(screen.getByText(/em dívida/)).toBeInTheDocument()
    expect(screen.queryByText('Gabriela Almeida')).toBeNull()
    cleanup()
  })
})
