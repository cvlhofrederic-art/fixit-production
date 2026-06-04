import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModMarketplace from '@/components/syndic-dashboard/v54/modules/ModMarketplace'

/** Étape d (batch d30) — ModMarketplace : rendu byte-exact du Marketplace de Profissionais. */

describe('ModMarketplace', () => {
  it('rend le titre, les filtres et les cartes prestataires', () => {
    render(<ModMarketplace />)
    expect(screen.getByRole('heading', { name: 'Marketplace de Profissionais', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
    expect(screen.getByText('CanalFix Lda')).toBeInTheDocument()
    expect(screen.getByText('ASAE Elevadores · ISO 9001')).toBeInTheDocument()
    expect(screen.getAllByText('DESTAQUE')).toHaveLength(3)
  })
})
