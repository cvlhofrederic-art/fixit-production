// tests/components/syndic-v54-modules-d2.test.tsx
//
// Étape d (batch d2) — modules ModOrdens + ModProfissionais. Structure + données.

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModOrdens from '@/components/syndic-dashboard/v54/modules/ModOrdens'
import ModProfissionais from '@/components/syndic-dashboard/v54/modules/ModProfissionais'

afterEach(cleanup)

describe('syndic v54 — ModOrdens', () => {
  it('rend le titre, les chips de filtre et les ordres', () => {
    render(<ModOrdens />)
    expect(screen.getByRole('heading', { name: 'Ordens de serviço' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Todas/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Em curso/ })).toBeTruthy()
    expect(screen.getByText('Canalização · Fuga de água apartamento')).toBeTruthy()
    expect(screen.getAllByText('Normal').length).toBe(9) // un Pill "Normal" par ordre
  })
})

describe('syndic v54 — ModProfissionais', () => {
  it('rend le titre, la grille et les profissionais', () => {
    render(<ModProfissionais />)
    expect(screen.getByRole('heading', { name: 'Profissionais' })).toBeTruthy()
    expect(screen.getByText('Silva')).toBeTruthy()
    expect(screen.getByText('Canalizador')).toBeTruthy()
    expect(screen.getAllByText('Ativo').length).toBe(9) // un Pill "Ativo" par pro
  })
})
