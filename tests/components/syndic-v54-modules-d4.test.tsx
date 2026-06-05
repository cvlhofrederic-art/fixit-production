// tests/components/syndic-v54-modules-d4.test.tsx
//
// Modules d4b : ModEquipa (table + avatars) et ModCondominos (KPIs + tabs + empty).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModEquipa from '@/components/syndic-dashboard/v54/modules/ModEquipa'
import ModCondominos from '@/components/syndic-dashboard/v54/modules/ModCondominos'

afterEach(cleanup)

describe('syndic v54 — ModEquipa', () => {
  it('rend titre, table des membres, actions et descriptions des fonctions', () => {
    render(<ModEquipa />)
    expect(screen.getByRole('heading', { name: 'A Minha Equipa' })).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    // 7 membres : noms + initiales d'avatar
    expect(screen.getByText('Helena Carvalho')).toBeTruthy()
    expect(screen.getByText('Inês Monteiro')).toBeTruthy()
    expect(screen.getByText('HC')).toBeTruthy()
    // une action Suspender + Eliminar par membre
    expect(screen.getAllByRole('button', { name: 'Suspender' }).length).toBe(7)
    expect(screen.getAllByRole('button', { name: 'Eliminar' }).length).toBe(7)
    expect(screen.getByRole('button', { name: 'Convidar um membro' })).toBeTruthy()
    expect(screen.getByText('Descrição das funções')).toBeTruthy()
  })
})

describe('syndic v54 — ModCondominos', () => {
  it('rend titre, KPIs, onglets, état vide et actions', () => {
    render(<ModCondominos />)
    expect(screen.getByRole('heading', { name: 'Condóminos & Inquilinos' })).toBeTruthy()
    expect(screen.getByText('Frações total')).toBeTruthy()
    expect(screen.getByText('Vagos')).toBeTruthy()
    expect(screen.getByText('Proprietários')).toBeTruthy()
    expect(screen.getByText('Nenhum condómino encontrado')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Import Gecond' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy()
  })
})
