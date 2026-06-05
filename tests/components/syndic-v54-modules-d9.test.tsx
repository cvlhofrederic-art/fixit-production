// tests/components/syndic-v54-modules-d9.test.tsx
//
// Modules d9 : ModAtasIA + ModPagDigitais + ModVotacaoOnline.

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModAtasIA from '@/components/syndic-dashboard/v54/modules/ModAtasIA'
import ModPagDigitais from '@/components/syndic-dashboard/v54/modules/ModPagDigitais'
import ModVotacaoOnline from '@/components/syndic-dashboard/v54/modules/ModVotacaoOnline'

afterEach(cleanup)

describe('syndic v54 — ModAtasIA', () => {
  it('rend titre, onglets et état initial avec actions', () => {
    render(<ModAtasIA />)
    expect(screen.getByRole('heading', { name: 'Atas com IA — Atas de Assembleia' })).toBeTruthy()
    expect(screen.getByText('Gerar uma nova ata')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Começar do zero/ })).toBeTruthy()
  })
})

describe('syndic v54 — ModPagDigitais', () => {
  it('rend titre, KPIs, barres et table des paiements', () => {
    render(<ModPagDigitais />)
    expect(screen.getByRole('heading', { name: 'Pagamentos Digitais' })).toBeTruthy()
    expect(screen.getByText('Total cobrado este mês')).toBeTruthy()
    expect(screen.getByText('Últimos 10 pagamentos recebidos')).toBeTruthy()
    expect(screen.getByText('Ana Silva')).toBeTruthy()
    expect(screen.getAllByRole('progressbar').length).toBe(2)
  })
})

describe('syndic v54 — ModVotacaoOnline', () => {
  it('rend titre, deliberações et barres de progression', () => {
    render(<ModVotacaoOnline />)
    expect(screen.getByRole('heading', { name: 'Votação Online AG' })).toBeTruthy()
    expect(screen.getByText('Deliberações em curso')).toBeTruthy()
    expect(screen.getByText('Aprovação do orçamento anual 2026')).toBeTruthy()
    expect(screen.getAllByRole('progressbar').length).toBe(2)
  })
})
