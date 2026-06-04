// tests/components/syndic-v54-mod-definicoes.test.tsx
//
// Module d20 : ModDefinicoes (subscrição, perfil, gabinete, notificações).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModDefinicoes from '@/components/syndic-dashboard/v54/modules/ModDefinicoes'

afterEach(cleanup)

describe('syndic v54 — ModDefinicoes', () => {
  it('rend titre, panneaux, profil et toggles de notificações', () => {
    render(<ModDefinicoes />)
    expect(screen.getByRole('heading', { name: 'Definições' })).toBeTruthy()
    expect(screen.getByText('Subscrição')).toBeTruthy()
    expect(screen.getByText('Super Admin VitFix')).toBeTruthy()
    expect(screen.getByLabelText('Nome do gabinete')).toBeTruthy()
    // 5 interrupteurs de notification
    expect(screen.getAllByRole('checkbox').length).toBe(5)
  })
})
