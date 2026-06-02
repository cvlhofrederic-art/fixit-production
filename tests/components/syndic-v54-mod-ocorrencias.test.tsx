import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModOcorrencias from '@/components/syndic-dashboard/v54/modules/ModOcorrencias'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Signalement } from '@/lib/syndic/v54/api'

/** Étape d (batch d48) — byte-exact + Phase 3 : signalements réels (lecture). */

afterEach(cleanup)

describe('ModOcorrencias', () => {
  it('rend le titre, la distribution et la liste (mock/preview)', () => {
    render(<ModOcorrencias />)
    expect(screen.getByRole('heading', { name: 'Ocorrências e Manutenção', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Distribuição por prioridade')).toBeInTheDocument()
    expect(screen.getByText('Conformidade SLA')).toBeInTheDocument()
    expect(screen.getByText('Infiltração no teto da garagem B2')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 : affiche les vrais signalements du cabinet quand authentifié', () => {
    const sig: Signalement = {
      id: 'sg1', immeuble: 'Edifício Aurora', demandeurNom: 'João Real', typeIntervention: 'Canalização',
      description: 'Fuga real na garagem', priorite: 'urgente', statut: 'en_attente',
    }
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [],
      signalements: [sig],
    }
    render(<SyndicDataContext.Provider value={d}><ModOcorrencias /></SyndicDataContext.Provider>)
    expect(screen.getByText('Fuga real na garagem')).toBeInTheDocument()
    expect(screen.queryByText('Infiltração no teto da garagem B2')).toBeNull()
    cleanup()
  })
})
