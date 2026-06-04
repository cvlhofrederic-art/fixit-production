import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ModHistEdificio from '@/components/syndic-dashboard/v54/modules/ModHistEdificio'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Mission, Immeuble } from '@/components/syndic-dashboard/types'
import type { Elevador, Contrato } from '@/lib/syndic/v54/api'

/** Phase 3 — ModHistEdificio : vue consolidée par édifice (lecture seule) depuis missions/elevadores/contratos. */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [], contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] }, impayes: [], recouvrements: [], faturas: [],
})

const imm = (over: Partial<Immeuble>): Immeuble => ({
  id: 'b1', nom: 'EDIF-HIST', adresse: 'Rua X', ville: 'Porto', codePostal: '4000', nbLots: 10,
  anneeConstruction: 2000, typeImmeuble: 'habitacional', gestionnaire: '', nbInterventions: 0,
  budgetAnnuel: 10000, depensesAnnee: 5000, ...over,
})
const mission = (over: Partial<Mission>): Mission => ({
  id: 'm1', immeuble: 'EDIF-HIST', artisan: 'ProReal', type: 'Intervenção REAL', description: '',
  priorite: 'normale', statut: 'terminee', dateCreation: '2026-05-01', montantFacture: 480, ...over,
})
const elev = (over: Partial<Elevador>): Elevador => ({
  id: 'e1', immeuble: 'EDIF-HIST', marca: 'OTIS REAL', categoria: 'habitacional', ema: '',
  ultimaInspecao: '2026-04-28', proximaInspecao: '2028-04', estado: 'conforme', notes: '', ...over,
})
const contrato = (over: Partial<Contrato>): Contrato => ({
  id: 'ct1', immeuble: 'EDIF-HIST', fornecedor: 'ElevaTech', categoria: 'elevadores', custoMensal: 0,
  custoAnual: 1250, dataInicio: '2026-01-01', dataFim: '2027-12', statut: 'ativo', notes: '', ...over,
})

describe('ModHistEdificio', () => {
  it('rend le titre et les 3 panneaux preview illustratifs (anonyme)', () => {
    render(<ModHistEdificio />)
    expect(screen.getByRole('heading', { name: 'Histórico Edifício', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Reparação canalização garagem')).toBeInTheDocument()
    expect(screen.getByText('Elevador OTIS A')).toBeInTheDocument()
  })

  it('Phase 3 : consolide missions/elevadores/contratos du bâtiment sélectionné', () => {
    const d: SyndicData = {
      ...base(), immeubles: [imm({})],
      missions: [mission({})], elevadores: [elev({})], contratos: [contrato({})],
    }
    render(<SyndicDataContext.Provider value={d}><ModHistEdificio /></SyndicDataContext.Provider>)
    expect(screen.getByText('Intervenção REAL')).toBeInTheDocument()
    expect(screen.getByText('OTIS REAL')).toBeInTheDocument()
    expect(screen.getByText('Manutenção de elevadores')).toBeInTheDocument() // CAT_LABEL[elevadores]
    expect(screen.queryByText('Reparação canalização garagem')).toBeNull() // preview masqué
    cleanup()
  })

  it('Phase 3 : le sélecteur d\'édifice filtre les interventions', () => {
    const d: SyndicData = {
      ...base(),
      immeubles: [imm({ id: 'a', nom: 'EDIF-A' }), imm({ id: 'b', nom: 'EDIF-B' })],
      missions: [mission({ id: 'ma', immeuble: 'EDIF-A', type: 'Missão A' }), mission({ id: 'mb', immeuble: 'EDIF-B', type: 'Missão B' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModHistEdificio /></SyndicDataContext.Provider>)
    // défaut = 1er édifice (EDIF-A)
    expect(screen.getByText('Missão A')).toBeInTheDocument()
    expect(screen.queryByText('Missão B')).toBeNull()
    // bascule sur EDIF-B
    fireEvent.click(screen.getByRole('tab', { name: /EDIF-B/ }))
    expect(screen.getByText('Missão B')).toBeInTheDocument()
    expect(screen.queryByText('Missão A')).toBeNull()
    cleanup()
  })
})
