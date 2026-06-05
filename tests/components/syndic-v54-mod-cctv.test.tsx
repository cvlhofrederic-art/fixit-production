import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModCCTV from '@/components/syndic-dashboard/v54/modules/ModCCTV'

/** Étape d (batch d36) — ModCCTV : rendu byte-exact de Câmaras de Vigilância. */

describe('ModCCTV', () => {
  it('rend le titre, l\'alerte RGPD et le tableau vide', () => {
    render(<ModCCTV />)
    expect(screen.getByRole('heading', { name: 'Câmaras de Vigilância', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Videovigilância em condomínio — regras')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma câmara registada.')).toBeInTheDocument()
  })
})
