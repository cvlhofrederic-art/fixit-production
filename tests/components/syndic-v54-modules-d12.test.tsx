// tests/components/syndic-v54-modules-d12.test.tsx
//
// Modules d12 : ModSinistros + ModPreparadorAG + ModLancamentoFat + ModEmailsFixy.

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModSinistros from '@/components/syndic-dashboard/v54/modules/ModSinistros'
import ModPreparadorAG from '@/components/syndic-dashboard/v54/modules/ModPreparadorAG'
import ModLancamentoFat from '@/components/syndic-dashboard/v54/modules/ModLancamentoFat'
import ModEmailsFixy from '@/components/syndic-dashboard/v54/modules/ModEmailsFixy'

afterEach(cleanup)

describe('syndic v54 — ModSinistros', () => {
  it('rend titre, pipeline et état vide', () => {
    render(<ModSinistros />)
    expect(screen.getByRole('heading', { name: 'Pipeline Sinistros' })).toBeTruthy()
    expect(screen.getByText('VISTA DO PIPELINE')).toBeTruthy()
    expect(screen.getByText('Declarado')).toBeTruthy()
    expect(screen.getByText('Nenhum sinistro')).toBeTruthy()
  })
})

describe('syndic v54 — ModPreparadorAG', () => {
  it('rend titre et état vide', () => {
    render(<ModPreparadorAG />)
    expect(screen.getByRole('heading', { name: 'Preparador AG' })).toBeTruthy()
    expect(screen.getByText('Nenhuma AG preparada')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Começar a preparação' })).toBeTruthy()
  })
})

describe('syndic v54 — ModLancamentoFat', () => {
  it('rend titre, KPIs et zone de dépôt', () => {
    render(<ModLancamentoFat />)
    expect(screen.getByRole('heading', { name: 'Lançamento IA de Faturas' })).toBeTruthy()
    expect(screen.getByText('Total faturas')).toBeTruthy()
    expect(screen.getByText('Arraste e largue as suas faturas aqui')).toBeTruthy()
  })
})

describe('syndic v54 — ModEmailsFixy', () => {
  it('rend titre, état initial et action Gmail', () => {
    render(<ModEmailsFixy />)
    expect(screen.getByRole('heading', { name: 'Emails Fixy' })).toBeTruthy()
    expect(screen.getByText('Ligue a sua caixa Gmail')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ligar Gmail' })).toBeTruthy()
  })
})
