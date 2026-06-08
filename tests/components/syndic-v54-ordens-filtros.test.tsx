import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ModOrdens from '@/components/syndic-dashboard/v54/modules/ModOrdens'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Mission } from '@/components/syndic-dashboard/types'

/** Les onglets statut filtrent vraiment la liste + « Filtros » ouvre une recherche texte. */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const mission = (over: Partial<Mission>): Mission => ({
  id: 'm1', immeuble: 'Edifício A', type: 'Canalização', description: 'Fuga', priorite: 'normale', statut: 'en_attente', dateCreation: '01/05/2026', artisan: '—',
  ...over,
} as unknown as Mission)

const data = (missions: Mission[]): SyndicData => ({ authenticated: true, loading: false, missions, immeubles: [], artisans: [], team: [], coproprios: [] })

describe('Ordens — filtres', () => {
  it('l’onglet « Em curso » ne montre que les missions en cours', () => {
    render(<SyndicDataContext.Provider value={data([
      mission({ id: 'a', immeuble: 'Bloco Curso', statut: 'en_cours' }),
      mission({ id: 'b', immeuble: 'Bloco Pendente', statut: 'en_attente' }),
    ])}><ModOrdens /></SyndicDataContext.Provider>)
    expect(screen.getByText('Bloco Curso')).toBeInTheDocument()
    expect(screen.getByText('Bloco Pendente')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Em curso/ }))
    expect(screen.getByText('Bloco Curso')).toBeInTheDocument()
    expect(screen.queryByText('Bloco Pendente')).toBeNull()
  })

  it('« Filtros » ouvre une recherche qui filtre par texte', () => {
    render(<SyndicDataContext.Provider value={data([
      mission({ id: 'a', immeuble: 'Edifício Aurora', statut: 'en_attente' }),
      mission({ id: 'b', immeuble: 'Residencial Cedofeita', statut: 'en_attente' }),
    ])}><ModOrdens /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }))
    fireEvent.change(screen.getByLabelText('Pesquisar ordens'), { target: { value: 'aurora' } })
    expect(screen.getByText('Edifício Aurora')).toBeInTheDocument()
    expect(screen.queryByText('Residencial Cedofeita')).toBeNull()
  })
})
