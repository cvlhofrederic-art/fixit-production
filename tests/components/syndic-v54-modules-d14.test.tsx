// tests/components/syndic-v54-modules-d14.test.tsx
//
// Modules d14 : ModCobrJud (pipeline + alerte) + ModCarregamentoVE (cartes + Progress).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModCobrJud from '@/components/syndic-dashboard/v54/modules/ModCobrJud'
import ModCarregamentoVE from '@/components/syndic-dashboard/v54/modules/ModCarregamentoVE'

afterEach(cleanup)

describe('syndic v54 — ModCobrJud', () => {
  it('rend titre, KPIs, pipeline et processus', () => {
    render(<ModCobrJud />)
    expect(screen.getByRole('heading', { name: 'Cobrança Judicial' })).toBeTruthy()
    expect(screen.getByText('Total em dívida')).toBeTruthy()
    expect(screen.getByText('Pipeline de cobranca')).toBeTruthy()
    expect(screen.getByText('Carlos Miguel Pinto')).toBeTruthy()
  })
})

describe('syndic v54 — ModCarregamentoVE', () => {
  it('rend titre, KPIs, pedidos et barres de progression', () => {
    render(<ModCarregamentoVE />)
    expect(screen.getByRole('heading', { name: 'Carregamento de Veículos Elétricos' })).toBeTruthy()
    expect(screen.getByText('Pedidos Ativos')).toBeTruthy()
    expect(screen.getByText('Carlos Ferreira')).toBeTruthy()
    expect(screen.getAllByRole('progressbar').length).toBe(3)
  })
})
