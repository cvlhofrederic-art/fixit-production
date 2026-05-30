// tests/components/syndic-v54-mod-relgestao.test.tsx
//
// Module d19 : ModRelGestao (Alert + formulaire période + aperçu PDF).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModRelGestao from '@/components/syndic-dashboard/v54/modules/ModRelGestao'

afterEach(cleanup)

describe('syndic v54 — ModRelGestao', () => {
  it('rend titre, formulaire période et aperçu', () => {
    render(<ModRelGestao />)
    expect(screen.getByRole('heading', { name: 'Relatório de Gestão' })).toBeTruthy()
    expect(screen.getByText('Dados do período — Abril 2026')).toBeTruthy()
    expect(screen.getByLabelText('Edifícios geridos')).toBeTruthy()
    expect(screen.getByLabelText('Observações')).toBeTruthy()
    expect(screen.getByText('Preencha os dados acima para gerar o relatório de gestão de Abril 2026')).toBeTruthy()
  })
})
