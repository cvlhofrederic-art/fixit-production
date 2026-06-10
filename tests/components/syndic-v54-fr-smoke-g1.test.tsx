import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { RoleProvider } from '@/components/syndic-dashboard/v54-fr/lib/role-context'
import ModCompta from '@/components/syndic-dashboard/v54-fr/modules/ModCompta'
import ModAppels from '@/components/syndic-dashboard/v54-fr/modules/ModAppels'
import ModFondsTravaux from '@/components/syndic-dashboard/v54-fr/modules/ModFondsTravaux'
import ModOpenBanking from '@/components/syndic-dashboard/v54-fr/modules/ModOpenBanking'
import ModBudget from '@/components/syndic-dashboard/v54-fr/modules/ModBudget'
import ModSaisieFactures from '@/components/syndic-dashboard/v54-fr/modules/ModSaisieFactures'

/** Lot G1 — Comptabilité & finances : smoke test des 6 modules FR
 * (titre PageHead niveau 1 + un élément signature par module). */

const CASES: [string, ComponentType, string, string][] = [
  ['ModCompta', ModCompta, 'Comptabilité', 'Journal des écritures'],
  ['ModAppels', ModAppels, 'Appels de fonds', 'Quotes-parts par copropriété'],
  ['ModFondsTravaux', ModFondsTravaux, 'Fonds travaux', 'Fonds insuffisant'],
  ['ModOpenBanking', ModOpenBanking, 'Open banking — rapprochement automatique', 'Prélèvement inconnu'],
  ['ModBudget', ModBudget, 'Budget prévisionnel', 'Entretien & maintenance'],
  ['ModSaisieFactures', ModSaisieFactures, 'Saisie de factures', 'Plomberie Centrale'],
]

describe('Modules FR — lot G1 (Comptabilité & finances)', () => {
  it.each(CASES)('%s rend son titre et un élément signature', (_nom, Component, titre, signature) => {
    render(
      <ToastProvider>
        <RoleProvider role="Direction">
          <Component />
        </RoleProvider>
      </ToastProvider>,
    )
    expect(screen.getByRole('heading', { name: titre, level: 1 })).toBeInTheDocument()
    expect(screen.getByText(signature)).toBeInTheDocument()
  })
})
