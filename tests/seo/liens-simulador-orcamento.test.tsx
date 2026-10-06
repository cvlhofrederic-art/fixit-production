// tests/seo/liens-simulador-orcamento.test.tsx
//
// Simulador de orçamento PT (app/pt/simulador-orcamento/SimuladorOrcamentoClient.tsx), jumeau du simulateur FR
// (tests/seo/liens-simulateur-devis.test.tsx). Le CTA « Ver profissionais disponíveis » visait /pesquisar… :
// un 308 (règle racine) puis la barre finale avant /pt/pesquisar/, et, sans cidade détectée, un chemin mal formé
// /pesquisar&cat=… (pas de « ? »), en 404.

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import SimuladorOrcamentoClient from '@/app/pt/simulador-orcamento/SimuladorOrcamentoClient'

function procurar(container: HTMLElement, pedido: string, cidade: string) {
  fireEvent.change(container.querySelector('textarea') as HTMLTextAreaElement, { target: { value: pedido } })
  fireEvent.change(screen.getByPlaceholderText('A sua cidade (ex: Marco de Canaveses)'), { target: { value: cidade } })
  fireEvent.click(screen.getByRole('button', { name: /Procurar/ }))
}

const hrefDoCta = () => screen.getByText(/Ver profissionais disponíveis/).closest('a')?.getAttribute('href')

describe('simulador de orçamento PT : CTA de pesquisa', () => {
  it('sem cidade : URL bem formada (« ? » antes de cat), na pesquisa PT', () => {
    const { container } = render(<SimuladorOrcamentoClient />)
    procurar(container, 'Tenho uma fuga de água na casa de banho', '')
    expect(hrefDoCta()).toBe('/pt/pesquisar/?cat=canalizador')
  })

  it('com cidade : loc e cat, na pesquisa PT', () => {
    const { container } = render(<SimuladorOrcamentoClient />)
    procurar(container, 'Tenho uma fuga de água na casa de banho', 'Porto')
    expect(hrefDoCta()).toBe('/pt/pesquisar/?loc=Porto&cat=canalizador')
  })
})
