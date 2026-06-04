import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModContabTec from '@/components/syndic-dashboard/v54/modules/ModContabTec'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Mission } from '@/components/syndic-dashboard/types'

/** Phase 3 — ModContabTec : suivi des interventions calculé (lecture seule) depuis data.missions. */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [], contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] }, impayes: [], recouvrements: [], faturas: [],
})

const mission = (over: Partial<Mission>): Mission => ({
  id: 'm1', immeuble: 'Aurora', artisan: 'João Real', type: 'Canalização', description: '',
  priorite: 'urgente', statut: 'en_cours', dateCreation: '2026-05-01', montantFacture: 500,
  ...over,
})

describe('ModContabTec', () => {
  it('rend le titre et le tableau preview byte-exact (anonyme)', () => {
    render(<ModContabTec />)
    expect(screen.getByRole('heading', { name: 'Contabilidade Técnica', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Por profissional')).toBeInTheDocument()
    expect(screen.getAllByText('Bruno Tavares').length).toBeGreaterThan(0) // preview hardcodé
  })

  it('Phase 3 : calcule les interventions depuis data.missions', () => {
    const d: SyndicData = { ...base(), missions: [mission({ immeuble: 'EDIF-CT-REAL', artisan: 'João Real' })] }
    render(<SyndicDataContext.Provider value={d}><ModContabTec /></SyndicDataContext.Provider>)
    expect(screen.getByText('EDIF-CT-REAL')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Tavares')).toBeNull() // preview masqué en mode réel
    cleanup()
  })
})
