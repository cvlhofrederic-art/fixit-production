import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModNotificJud from '@/components/syndic-dashboard/v54/modules/ModNotificJud'

/** Étape d (batch d33) — ModNotificJud : rendu byte-exact du Centro de Notificações Judiciais. */

describe('ModNotificJud', () => {
  it('rend le titre, l\'alerte Lei 8/2022 et les tipos de comunicação', () => {
    render(<ModNotificJud />)
    expect(screen.getByRole('heading', { name: 'Centro de Notificações Judiciais', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum processo judicial em curso')).toBeInTheDocument()
    expect(screen.getByText('Citação tribunal')).toBeInTheDocument()
    expect(screen.getByText('Update semestral')).toBeInTheDocument()
  })
})
