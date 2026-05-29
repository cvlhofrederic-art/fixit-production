// tests/components/syndic-v54-modules-d10.test.tsx
//
// Modules d10 : ModPrepAss + ModPlanoMan + ModVistoria + ModContacto.

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModPrepAss from '@/components/syndic-dashboard/v54/modules/ModPrepAss'
import ModPlanoMan from '@/components/syndic-dashboard/v54/modules/ModPlanoMan'
import ModVistoria from '@/components/syndic-dashboard/v54/modules/ModVistoria'
import ModContacto from '@/components/syndic-dashboard/v54/modules/ModContacto'

afterEach(cleanup)

describe('syndic v54 — ModPrepAss', () => {
  it('rend titre, alerte légale et état vide', () => {
    render(<ModPrepAss />)
    expect(screen.getByRole('heading', { name: 'Preparador de Assembleia' })).toBeTruthy()
    expect(screen.getByText('Nenhuma assembleia preparada')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Iniciar preparação' })).toBeTruthy()
  })
})

describe('syndic v54 — ModPlanoMan', () => {
  it('rend titre, KPIs et état vide', () => {
    render(<ModPlanoMan />)
    expect(screen.getByRole('heading', { name: 'Plano de Manutenção' })).toBeTruthy()
    expect(screen.getByText('Planos criados')).toBeTruthy()
    expect(screen.getByText('Nenhum plano de manutenção')).toBeTruthy()
  })
})

describe('syndic v54 — ModVistoria', () => {
  it('rend titre, KPIs, onglets et état vide', () => {
    render(<ModVistoria />)
    expect(screen.getByRole('heading', { name: 'Vistoria Técnica' })).toBeTruthy()
    expect(screen.getByText('Vistorias realizadas')).toBeTruthy()
    expect(screen.getByText('Nenhuma vistoria registada')).toBeTruthy()
  })
})

describe('syndic v54 — ModContacto', () => {
  it('rend titre, KPIs et état vide', () => {
    render(<ModContacto />)
    expect(screen.getByRole('heading', { name: 'Contacto Proativo IA' })).toBeTruthy()
    expect(screen.getByText('Campanhas Criadas')).toBeTruthy()
    expect(screen.getByText('Sem campanhas')).toBeTruthy()
  })
})
