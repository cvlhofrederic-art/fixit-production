// tests/components/syndic-v54-modules-d11.test.tsx
//
// Modules d11 : ModPredicao + ModQRCode + ModDashCond.

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModPredicao from '@/components/syndic-dashboard/v54/modules/ModPredicao'
import ModQRCode from '@/components/syndic-dashboard/v54/modules/ModQRCode'
import ModDashCond from '@/components/syndic-dashboard/v54/modules/ModDashCond'

afterEach(cleanup)

describe('syndic v54 — ModPredicao', () => {
  it('rend titre, KPIs et distribution de risque', () => {
    render(<ModPredicao />)
    expect(screen.getByRole('heading', { name: 'Predição de Manutenção' })).toBeTruthy()
    expect(screen.getByText('Distribuição de Risco')).toBeTruthy()
    expect(screen.getByText('Crítico (>80%)')).toBeTruthy()
    expect(screen.getByText('Risco por Edifício')).toBeTruthy()
  })
})

describe('syndic v54 — ModQRCode', () => {
  it('rend titre, KPIs et état vide', () => {
    render(<ModQRCode />)
    expect(screen.getByRole('heading', { name: 'QR Code por Fração' })).toBeTruthy()
    expect(screen.getByText('QR Codes ativos')).toBeTruthy()
    expect(screen.getByText('Nenhum QR Code criado')).toBeTruthy()
  })
})

describe('syndic v54 — ModDashCond', () => {
  it('rend titre, KPIs et recherche', () => {
    render(<ModDashCond />)
    expect(screen.getByRole('heading', { name: 'Dashboard Condómino — Tempo Real' })).toBeTruthy()
    expect(screen.getByText('Total condóminos')).toBeTruthy()
    expect(screen.getByLabelText('Pesquisar condómino')).toBeTruthy()
  })
})
