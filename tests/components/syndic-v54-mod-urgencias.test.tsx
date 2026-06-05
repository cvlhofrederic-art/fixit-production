import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModUrgencias from '@/components/syndic-dashboard/v54/modules/ModUrgencias'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Mission } from '@/components/syndic-dashboard/types'

/** Phase 3 — ModUrgencias : urgences actives calculées (lecture seule) depuis data.missions. */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [], contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] }, impayes: [], recouvrements: [], faturas: [],
})

const mission = (over: Partial<Mission>): Mission => ({
  id: 'm1', immeuble: 'Aurora', artisan: 'ProReal', type: 'Fuga real', description: '',
  priorite: 'urgente', statut: 'en_cours', dateCreation: '2026-05-01',
  ...over,
})

describe('ModUrgencias', () => {
  it('rend le titre et le tableau preview illustratif (anonyme)', () => {
    render(<ModUrgencias />)
    expect(screen.getByRole('heading', { name: 'Urgências Técnicas', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Fuga de água na garagem B2')).toBeInTheDocument()
    expect(screen.getByText('HidroPro Lda')).toBeInTheDocument()
  })

  it('Phase 3 : calcule les urgences depuis data.missions (urgentes non clôturées uniquement)', () => {
    const d: SyndicData = {
      ...base(),
      missions: [
        mission({ id: 'u1', type: 'Fuga URG-REAL', priorite: 'urgente', statut: 'en_cours' }),
        mission({ id: 'n1', type: 'Manutenção banal', priorite: 'normale', statut: 'en_cours' }),
        mission({ id: 'd1', type: 'Já concluída', priorite: 'urgente', statut: 'terminee' }),
      ],
    }
    render(<SyndicDataContext.Provider value={d}><ModUrgencias /></SyndicDataContext.Provider>)
    expect(screen.getByText('Fuga URG-REAL')).toBeInTheDocument()
    expect(screen.queryByText('Manutenção banal')).toBeNull() // non urgente → exclue
    expect(screen.queryByText('Já concluída')).toBeNull() // terminée → exclue
    expect(screen.queryByText('HidroPro Lda')).toBeNull() // preview masqué en mode réel
    cleanup()
  })

  it('Phase 3 : état vide quand aucune urgence active', () => {
    const d: SyndicData = { ...base(), missions: [mission({ priorite: 'normale' })] }
    render(<SyndicDataContext.Provider value={d}><ModUrgencias /></SyndicDataContext.Provider>)
    expect(screen.getByText('Nenhuma urgência ativa.')).toBeInTheDocument()
    cleanup()
  })
})
