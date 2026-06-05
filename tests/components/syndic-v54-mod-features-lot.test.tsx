import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SyndicDataContext } from '@/lib/syndic/v54/data-context'
import type { SyndicData } from '@/lib/syndic/v54/data-context'
import ModInfracoes from '@/components/syndic-dashboard/v54/modules/ModInfracoes'
import ModReservaEsp from '@/components/syndic-dashboard/v54/modules/ModReservaEsp'
import ModEnquetes from '@/components/syndic-dashboard/v54/modules/ModEnquetes'
import ModChecklists from '@/components/syndic-dashboard/v54/modules/ModChecklists'

/** Lot features net-new (Reservas, Infrações, Enquetes, Checklists) — câblage data réel.
 * Vérifie : connecté → vraies données du cabinet (pas la preview) ; état vide ; modal de création.
 * (Anonyme → preview byte-exact : couvert par les tests mod-{reservaesp,enquetes,checklists} + d57.) */

afterEach(cleanup)

const wrap = (value: Partial<SyndicData>, ui: ReactNode) =>
  render(<SyndicDataContext.Provider value={{ authenticated: true, loading: false, token: 't', refresh: vi.fn(), ...value } as SyndicData}>{ui}</SyndicDataContext.Provider>)

describe('Lot features net-new — câblage data réel', () => {
  it('ModInfracoes : affiche les vraies infractions, pas la preview', () => {
    wrap({ infracoes: [{ id: 'r1', tipo: 'Cão sem trela', condomino: 'X — 1A', edificio: 'Ed. Teste', etapa: 'analise', multa: 30, descricao: '' }] }, <ModInfracoes />)
    expect(screen.getByText('Cão sem trela')).toBeInTheDocument()
    expect(screen.queryByText('Ruído fora de horas')).not.toBeInTheDocument()
  })

  it('ModInfracoes : état vide + ouverture du modal Nova infração', () => {
    wrap({ infracoes: [] }, <ModInfracoes />)
    expect(screen.getByText('Sem infrações registadas')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /Nova infração/ })[0])
    expect(screen.getByLabelText(/Tipo de infração/)).toBeInTheDocument()
  })

  it('ModReservaEsp : vraies reservas + état vide', () => {
    wrap({ reservas: [{ id: 'r1', espaco: 'Piscina Coberta', quem: 'Y · 3A', data: '2026-06-10', hora: '10:00', estado: 'confirmada', notes: '' }] }, <ModReservaEsp />)
    expect(screen.getByText('Piscina Coberta')).toBeInTheDocument()
    cleanup()
    wrap({ reservas: [] }, <ModReservaEsp />)
    expect(screen.getByText('Sem reservas')).toBeInTheDocument()
  })

  it('ModEnquetes : vraies enquêtes + participation dérivée des votes', () => {
    wrap({ enquetes: [{ id: 'e1', titulo: 'Cor da fachada', descricao: '', estado: 'ativa', tipo: 'Sim / Não', edificio: '', prazo: '', total: 10, options: [{ label: 'Azul', votes: 3 }, { label: 'Verde', votes: 2 }], anonima: false }] }, <ModEnquetes />)
    expect(screen.getByText('Cor da fachada')).toBeInTheDocument()
    expect(screen.getByText('5/10 frações responderam')).toBeInTheDocument()
  })

  it('ModChecklists : vraies checklists em curso + progressão', () => {
    wrap({ checklists: [{ id: 'c1', titulo: 'Inspeção telhado', tipo: 'Inspeção', edificio: 'Ed. A', estado: 'em_curso', items: [{ label: 'a', done: true }, { label: 'b', done: false }] }] }, <ModChecklists />)
    expect(screen.getByText('Inspeção telhado')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })
})
