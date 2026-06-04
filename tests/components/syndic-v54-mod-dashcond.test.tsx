import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModDashCond from '@/components/syndic-dashboard/v54/modules/ModDashCond'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Coprop, Impaye } from '@/lib/syndic/v54/api'
import type { Mission } from '@/components/syndic-dashboard/types'

/** Phase 3 — ModDashCond : KPIs calculés (lecture seule) depuis coproprios + impayes + missions. */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [], contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] }, impayes: [], recouvrements: [], faturas: [],
})
const coprop = (over: Partial<Coprop>): Coprop => ({
  id: 'c1', immeuble: 'EDIF', batiment: 'A', etage: 1, numeroPorte: '1D', proprietario: 'X', email: '', telefone: '', ocupado: true, ...over,
})
const impaye = (over: Partial<Impaye>): Impaye => ({
  id: 'i1', immeubleId: '', coproprioId: 'c1', montant: 1000, nature: 'charges_courantes', depuis: '2026-01-01', derniereRelanceAt: '', nbRelances: 0, statut: 'ouvert', notes: '', ...over,
})
const mission = (over: Partial<Mission>): Mission => ({
  id: 'm1', immeuble: 'EDIF', artisan: '', type: 'X', description: '', priorite: 'normale', statut: 'en_cours', dateCreation: '2026-01-01', ...over,
})

describe('ModDashCond', () => {
  it('anonyme : KPIs à zéro (0,0k€)', () => {
    render(<ModDashCond />)
    expect(screen.getByRole('heading', { name: /Dashboard Condómino/ })).toBeInTheDocument()
    expect(screen.getByText('0,0k€')).toBeInTheDocument()
  })

  it('Phase 3 : calcule les KPIs depuis les données réelles', () => {
    const d: SyndicData = {
      ...base(),
      coproprios: [coprop({ id: 'c1', acessoPortal: true }), coprop({ id: 'c2', acessoPortal: false })], // 2 total · 1 ativo
      impayes: [impaye({ coproprioId: 'c1', statut: 'ouvert', montant: 1500 }), impaye({ coproprioId: 'c1', statut: 'ouvert', montant: 500 })], // 1 atraso · 2000 dívida
      missions: [mission({ statut: 'en_cours' }), mission({ statut: 'terminee' })], // 1 pendente
    }
    render(<SyndicDataContext.Provider value={d}><ModDashCond /></SyndicDataContext.Provider>)
    expect(screen.getByText('2,0k€')).toBeInTheDocument() // dívida réelle
    expect(screen.queryByText('0,0k€')).toBeNull() // plus l'état anonyme
    cleanup()
  })
})
