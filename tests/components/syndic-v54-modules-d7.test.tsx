// tests/components/syndic-v54-modules-d7.test.tsx
//
// Modules d7 : ModRelatorioMensal (aperçu PDF) + ModAnaliseOrc (analyse devis).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModRelatorioMensal from '@/components/syndic-dashboard/v54/modules/ModRelatorioMensal'
import ModAnaliseOrc from '@/components/syndic-dashboard/v54/modules/ModAnaliseOrc'

afterEach(cleanup)

describe('syndic v54 — ModRelatorioMensal', () => {
  it('rend titre, actions et aperçu du rapport', () => {
    render(<ModRelatorioMensal />)
    expect(screen.getByRole('heading', { name: 'Relatório Mensal' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Enviar aos condóminos/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Descarregar PDF/ })).toBeTruthy()
    expect(screen.getByText('Relatório Mensal de Gestão')).toBeTruthy()
    expect(screen.getByText('Orçamento consumido')).toBeTruthy()
  })
})

describe('syndic v54 — ModAnaliseOrc', () => {
  it('rend titre, cartes, zone de dépôt et bouton désactivé', () => {
    render(<ModAnaliseOrc />)
    expect(screen.getByRole('heading', { name: 'Análise Orçamentos & Faturas' })).toBeTruthy()
    expect(screen.getByText('Referência de preços de mercado')).toBeTruthy()
    expect(screen.getByText('Arraste o seu PDF aqui')).toBeTruthy()
    const analisar = screen.getByRole('button', { name: /Analisar o documento/ }) as HTMLButtonElement
    expect(analisar.disabled).toBe(true)
  })
})
