import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModCondominos from '@/components/syndic-dashboard/v54/modules/ModCondominos'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'

/** Phase 2 — ModCondominos : liste réelle des condóminos (authentifié) vs état vide (preview). */

afterEach(cleanup)

const realData: SyndicData = {
  authenticated: true,
  loading: false,
  missions: [],
  immeubles: [],
  artisans: [],
  coproprios: [
    { id: 'c1', immeuble: 'Edifício Aurora', batiment: 'A', etage: 2, numeroPorte: '2B', proprietario: 'Ana Silva', email: 'ana@x.pt', telefone: '910000000', ocupado: true },
    { id: 'c2', immeuble: 'Edifício Aurora', batiment: 'A', etage: 3, numeroPorte: '3A', proprietario: 'Carlos Mendes', email: 'carlos@x.pt', telefone: '911000000', ocupado: false },
  ],
}

describe('ModCondominos (Phase 2)', () => {
  it('affiche l\'état vide par défaut (preview/anonyme)', () => {
    render(<ModCondominos />)
    expect(screen.getByText('Nenhum condómino encontrado')).toBeInTheDocument()
    cleanup()
  })

  it('liste les vrais condóminos quand le cabinet est authentifié', () => {
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModCondominos />
      </SyndicDataContext.Provider>,
    )
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('Carlos Mendes')).toBeInTheDocument()
    expect(screen.getByText('Ocupado')).toBeInTheDocument()
    expect(screen.getByText('Vago')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum condómino encontrado')).toBeNull()
    cleanup()
  })
})
