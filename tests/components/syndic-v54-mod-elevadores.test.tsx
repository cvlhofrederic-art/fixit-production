import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModElevadores from '@/components/syndic-dashboard/v54/modules/ModElevadores'

/** Étape d (batch d34) — ModElevadores : rendu byte-exact de Gestão de Elevadores. */

describe('ModElevadores', () => {
  it('rend le titre, le tableau vide et le workflow risco grave', () => {
    render(<ModElevadores />)
    expect(screen.getByRole('heading', { name: 'Gestão de Elevadores', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum elevador registado. Registe o primeiro elevador.')).toBeInTheDocument()
    expect(screen.getByText('EMA deteta risco grave')).toBeInTheDocument()
    expect(screen.getByText('Administrador notifica Câmara')).toBeInTheDocument()
  })
})
