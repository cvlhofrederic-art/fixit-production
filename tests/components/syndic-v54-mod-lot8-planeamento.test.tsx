import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SyndicDataContext } from '@/lib/syndic/v54/data-context'
import type { SyndicData } from '@/lib/syndic/v54/data-context'
import ModPlaneamento from '@/components/syndic-dashboard/v54/modules/ModPlaneamento'

/** Lot 8 — ModPlaneamento : événements réels (data.eventos) sur la grille hebdo.
 * Anonyme → preview byte-exact couvert par mod-planeamento. */

afterEach(cleanup)

const wrap = (value: Partial<SyndicData>, ui: ReactNode) =>
  render(<SyndicDataContext.Provider value={{ authenticated: true, loading: false, token: 't', refresh: vi.fn(), ...value } as SyndicData}>{ui}</SyndicDataContext.Provider>)

describe('Lot 8 — ModPlaneamento câblage réel', () => {
  it('place les événements réels sur la grille (pas la preview) + modal', () => {
    wrap({ eventos: [{ id: 'e1', titulo: 'Vistoria telhado', dia: 'wed', horaInicio: '10:00', horaFim: '11:00', tipo: 'amber', responsavel: 'Bruno', edificio: 'Ed. A' }] }, <ModPlaneamento />)
    expect(screen.getAllByText('Vistoria telhado').length).toBeGreaterThan(0)
    expect(screen.queryByText('Reunião AG Atlântico')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    expect(screen.getByLabelText(/Título/)).toBeInTheDocument()
  })
})
