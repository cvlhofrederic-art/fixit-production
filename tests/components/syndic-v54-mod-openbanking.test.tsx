import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModOpenBanking from '@/components/syndic-dashboard/v54/modules/ModOpenBanking'

/** Étape d (batch d37) — ModOpenBanking : rendu byte-exact de Open Banking. */

describe('ModOpenBanking', () => {
  it('rend le titre, l\'Empty et les bancos suportados', () => {
    render(<ModOpenBanking />)
    expect(screen.getByRole('heading', { name: 'Open Banking — Reconciliação Automática', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma conta conectada')).toBeInTheDocument()
    expect(screen.getByText('Caixa Geral')).toBeInTheDocument()
    expect(screen.getByText('Banco CTT')).toBeInTheDocument()
  })
})
