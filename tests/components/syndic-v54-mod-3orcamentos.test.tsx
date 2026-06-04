import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModMod3Orcamentos from '@/components/syndic-dashboard/v54/modules/ModMod3Orcamentos'

/** Étape d (batch d28) — ModMod3Orcamentos : rendu byte-exact du kanban Orçamentos & Obras. */

describe('ModMod3Orcamentos', () => {
  it('rend le titre, les colonnes kanban et les obras', () => {
    render(<ModMod3Orcamentos />)
    expect(screen.getByRole('heading', { name: 'Orçamentos & Obras', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Impermeabilização da cobertura')).toBeInTheDocument()
    expect(screen.getByText('Renovação da fachada exterior')).toBeInTheDocument()
    expect(screen.getByText('ConstruPT Lda.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Comparar/ })).toBeInTheDocument()
    expect(screen.getAllByText('Nenhuma obra')).toHaveLength(2)
  })
})
