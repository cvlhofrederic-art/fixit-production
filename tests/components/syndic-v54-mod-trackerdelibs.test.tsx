import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModTrackerDelibs from '@/components/syndic-dashboard/v54/modules/ModTrackerDelibs'

/** Étape d (batch d31) — ModTrackerDelibs : rendu byte-exact du Tracker de Deliberações. */

describe('ModTrackerDelibs', () => {
  it('rend le titre, l\'alerte légale et le pipeline IA', () => {
    render(<ModTrackerDelibs />)
    expect(screen.getByRole('heading', { name: 'Tracker de Deliberações', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma deliberação para acompanhar')).toBeInTheDocument()
    expect(screen.getByText('Análise semântica')).toBeInTheDocument()
    expect(screen.getByText('Cálculo prazo')).toBeInTheDocument()
    expect(screen.getByText('Escalation alertas')).toBeInTheDocument()
  })
})
