import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModNPSPosIntervencao from '@/components/syndic-dashboard/v54/modules/ModNPSPosIntervencao'

/** Étape d (batch d36) — ModNPSPosIntervencao : rendu byte-exact de NPS Pós-Intervenção. */

describe('ModNPSPosIntervencao', () => {
  it('rend le titre, l\'alerte loop fermé et l\'Empty', () => {
    render(<ModNPSPosIntervencao />)
    expect(screen.getByRole('heading', { name: 'NPS Pós-Intervenção', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Loop fechado qualidade prestadores')).toBeInTheDocument()
    expect(screen.getByText('Nenhum inquérito enviado ainda')).toBeInTheDocument()
  })
})
