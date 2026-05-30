import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModWhatsapp from '@/components/syndic-dashboard/v54/modules/ModWhatsapp'

/** Étape d (batch d47) — ModWhatsapp : rendu byte-exact de Comunicação com Condóminos. */

describe('ModWhatsapp', () => {
  it('rend le titre, la liste des condóminos et l\'état vide', () => {
    render(<ModWhatsapp />)
    expect(screen.getByRole('heading', { name: 'Comunicação com Condóminos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('Sofia Oliveira')).toBeInTheDocument()
    expect(screen.getByText('Selecione um condómino para ver as mensagens')).toBeInTheDocument()
  })
})
