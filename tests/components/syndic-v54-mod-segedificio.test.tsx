import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModSegEdificio from '@/components/syndic-dashboard/v54/modules/ModSegEdificio'

/** Étape d (batch d34) — ModSegEdificio : rendu byte-exact de Segurança Contra Incêndio. */

describe('ModSegEdificio', () => {
  it('rend le titre, l\'Empty et les catégories de risque', () => {
    render(<ModSegEdificio />)
    expect(screen.getByRole('heading', { name: 'Segurança Contra Incêndio', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum edifício classificado')).toBeInTheDocument()
    expect(screen.getByText('Categoria 1 — Reduzido')).toBeInTheDocument()
    expect(screen.getByText('Categoria 4 — Muito Elevado')).toBeInTheDocument()
  })
})
