import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ModExtranet from '@/components/syndic-dashboard/v54/modules/ModExtranet'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Coprop } from '@/lib/syndic/v54/api'

/** Étape d (batch d46) — ModExtranet : byte-exact + modal. + Phase 2 : condóminos réels. */

afterEach(cleanup)

describe('ModExtranet', () => {
  it('rend l\'état vide, le portail et les KPIs', () => {
    render(<ModExtranet />)
    expect(screen.getByRole('heading', { name: 'Extranet Condóminos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Registo vazio')).toBeInTheDocument()
    expect(screen.getByText('Portal Condóminos')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://vitfix.io/coproprietaire/portail')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Condómino »', () => {
    render(<ModExtranet />)
    fireEvent.click(screen.getAllByRole('button', { name: /Condómino/ })[0])
    expect(screen.getByText('Adicionar condómino')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome/)).toBeInTheDocument()
  })

  it('Phase 2 : liste les vrais condóminos du cabinet', () => {
    const realData: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [],
      coproprios: [
        { id: 'c1', immeuble: 'Edifício Aurora', batiment: 'A', etage: 2, numeroPorte: '2B', proprietario: 'Condómino Real', email: 'cr@x.pt', telefone: '910', ocupado: true, acessoPortal: true, solde: -50 } as Coprop,
      ],
    }
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModExtranet />
      </SyndicDataContext.Provider>,
    )
    expect(screen.getByText('Condómino Real')).toBeInTheDocument()
    expect(screen.queryByText('Registo vazio')).toBeNull()
    cleanup()
  })
})
