// tests/components/syndic-v54-mod-checklists.test.tsx
//
// Module d22 : ModChecklists (KPIs lblFirst + 3 panneaux).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModChecklists from '@/components/syndic-dashboard/v54/modules/ModChecklists'

afterEach(cleanup)

describe('syndic v54 — ModChecklists', () => {
  it('rend titre, KPIs et panneaux (état vide)', () => {
    render(<ModChecklists />)
    expect(screen.getByRole('heading', { name: 'Checklists Inteligentes com IA' })).toBeTruthy()
    expect(screen.getByText('Total')).toBeTruthy()
    expect(screen.getByText('Modelos')).toBeTruthy()
    expect(screen.getByText('Nenhuma checklist em curso')).toBeTruthy()
  })
})
