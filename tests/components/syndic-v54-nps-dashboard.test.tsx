import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ModNPSPosIntervencao from '@/components/syndic-dashboard/v54/modules/ModNPSPosIntervencao'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Nps } from '@/lib/syndic/v54/api'

/** Les onglets NPS switchent vers de vraies agrégations + le bouton ouvre le dashboard prestador. */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const nps = (over: Partial<Nps>): Nps => ({ id: 'n1', prestador: 'HidroPro', condomino: 'Ana', intervencao: 'Fuga', tipo: 'Canalização', nota: 10, comentario: '', ...over } as unknown as Nps)

const data = (rows: Nps[]): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], nps: rows })

describe('NPS — dashboard prestadores', () => {
  it('« Ver dashboard prestadores » agrège par prestador', () => {
    render(<SyndicDataContext.Provider value={data([
      nps({ id: 'a', prestador: 'HidroPro', nota: 10 }),
      nps({ id: 'b', prestador: 'HidroPro', nota: 8 }),
      nps({ id: 'c', prestador: 'ElevaTech', nota: 4 }),
    ])}><ModNPSPosIntervencao /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Ver dashboard prestadores/ }))
    expect(screen.getByText('Nota média')).toBeInTheDocument()
    expect(screen.getByText('HidroPro')).toBeInTheDocument()
    expect(screen.getByText('ElevaTech')).toBeInTheDocument()
  })

  it('onglet « Por tipo intervenção » agrège par tipo', () => {
    render(<SyndicDataContext.Provider value={data([
      nps({ id: 'a', tipo: 'Canalização', nota: 9 }),
      nps({ id: 'b', tipo: 'Elétrica', nota: 5 }),
    ])}><ModNPSPosIntervencao /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByText('Por tipo intervenção'))
    expect(screen.getByText('Canalização')).toBeInTheDocument()
    expect(screen.getByText('Elétrica')).toBeInTheDocument()
  })
})
