import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ModValoresDivida from '@/components/syndic-dashboard/v54/modules/ModValoresDivida'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Coprop } from '@/lib/syndic/v54/api'

/** Étape d (batch d50) — ModValoresDivida : byte-exact + modal. + Phase 2 : débiteurs réels. */

afterEach(cleanup)

describe('ModValoresDivida', () => {
  it('rend l\'état vide et les KPIs', () => {
    render(<ModValoresDivida />)
    expect(screen.getByRole('heading', { name: 'Valores em dívida', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum incumprimento')).toBeInTheDocument()
    expect(screen.getByText('Total de incumprimentos em curso')).toBeInTheDocument()
    expect(screen.getByText('Contencioso')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Incumprimento »', () => {
    render(<ModValoresDivida />)
    fireEvent.click(screen.getAllByRole('button', { name: /\+ Incumprimento/ })[0])
    expect(screen.getByText('Registar um incumprimento')).toBeInTheDocument()
    expect(screen.getByLabelText(/Condómino/)).toBeInTheDocument()
  })

  it('Phase 2 : liste les vrais débiteurs (solde < 0) du cabinet', () => {
    const coprop = (over: Partial<Coprop>): Coprop => ({
      id: 'c1', immeuble: 'Edifício Aurora', batiment: 'A', etage: 1, numeroPorte: '1A',
      proprietario: 'X', email: '', telefone: '', ocupado: true, tantieme: 0, solde: 0, ...over,
    })
    const realData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [],
      coproprios: [coprop({ proprietario: 'Bom Pagador', solde: 100 }), coprop({ id: 'c2', proprietario: 'Devedor Real', solde: -800 })],
    }
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModValoresDivida />
      </SyndicDataContext.Provider>,
    )
    expect(screen.getByText('Devedor Real')).toBeInTheDocument()
    expect(screen.queryByText('Bom Pagador')).toBeNull() // pas en dívida → pas listé
    expect(screen.queryByText('Nenhum incumprimento')).toBeNull()
    cleanup()
  })
})
