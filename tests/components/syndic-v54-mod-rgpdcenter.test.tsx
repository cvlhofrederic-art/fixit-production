import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModRGPDCenter from '@/components/syndic-dashboard/v54/modules/ModRGPDCenter'

/** Étape d (batch d38) — ModRGPDCenter : rendu byte-exact du RGPD Compliance Center. */

describe('ModRGPDCenter', () => {
  it('rend le titre, l\'Empty et les direitos RGPD', () => {
    render(<ModRGPDCenter />)
    expect(screen.getByRole('heading', { name: 'RGPD Compliance Center', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma solicitação ativa')).toBeInTheDocument()
    expect(screen.getByText('Direito de esquecimento')).toBeInTheDocument()
    expect(screen.getByText('Direito de portabilidade')).toBeInTheDocument()
  })
})
