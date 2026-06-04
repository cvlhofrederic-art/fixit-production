import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModOsMeusModulos from '@/components/syndic-dashboard/v54/modules/ModOsMeusModulos'

/** Étape d (batch d39) — ModOsMeusModulos : rendu byte-exact du catalogue Os Meus Módulos. */

describe('ModOsMeusModulos', () => {
  it('rend le titre, le compteur, les sections et l\'ordre du menu', () => {
    render(<ModOsMeusModulos />)
    expect(screen.getByRole('heading', { name: 'Os meus módulos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('90/90 ativos')).toBeInTheDocument()
    expect(screen.getByText('GESTÃO CORRENTE')).toBeInTheDocument()
    expect(screen.getByText('FERRAMENTAS PT')).toBeInTheDocument()
    expect(screen.getByText('Ordem do menu')).toBeInTheDocument()
    expect(screen.getByText('Despacho imediato para o profissional VITFIX disponível')).toBeInTheDocument()
  })
})
