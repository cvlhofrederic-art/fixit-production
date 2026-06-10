// tests/components/syndic-v54-fr-smoke-e.test.tsx
//
// Lot E FR — Patrimoine + Technique & travaux (10 modules). Smoke : chaque
// module rend son PageHead (h1) + un élément signature (KPI, donnée mock…).
// Modèle : syndic-v54-mod-cctv.test.tsx + brief tmp-v54fr-brief.md.

import React, { type ComponentType } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { RoleProvider } from '@/components/syndic-dashboard/v54-fr/lib/role-context'
import ModCopros from '@/components/syndic-dashboard/v54-fr/modules/ModCopros'
import ModLots from '@/components/syndic-dashboard/v54-fr/modules/ModLots'
import ModContrats from '@/components/syndic-dashboard/v54-fr/modules/ModContrats'
import ModSinistres from '@/components/syndic-dashboard/v54-fr/modules/ModSinistres'
import ModAscenseurs from '@/components/syndic-dashboard/v54-fr/modules/ModAscenseurs'
import ModCCTV from '@/components/syndic-dashboard/v54-fr/modules/ModCCTV'
import ModDocsInterv from '@/components/syndic-dashboard/v54-fr/modules/ModDocsInterv'
import ModVisite from '@/components/syndic-dashboard/v54-fr/modules/ModVisite'
import ModDTG from '@/components/syndic-dashboard/v54-fr/modules/ModDTG'
import ModCarnet from '@/components/syndic-dashboard/v54-fr/modules/ModCarnet'

afterEach(cleanup)

type Case = [string, ComponentType<{ onNavigate?: (id: string) => void }>, string, string]

// [nom, Composant, titre h1 (PageHead), élément signature (texte unique au rendu)]
const CASES: Case[] = [
  ['ModCopros', ModCopros, 'Copropriétés', 'Budgets cumulés'],
  ['ModLots', ModLots, 'Lots & copropriétaires', 'Laurent Mercier'],
  ['ModContrats', ModContrats, 'Contrats avec les prestataires', 'Maintenance ascenseur'],
  ['ModSinistres', ModSinistres, 'Sinistres', 'Dégât des eaux — 4e étage'],
  ['ModAscenseurs', ModAscenseurs, 'Gestion des ascenseurs', 'Schindler'],
  ['ModCCTV', ModCCTV, 'Vidéoprotection', 'Local vélos'],
  ['ModDocsInterv', ModDocsInterv, "Documents d'intervention", 'Facture FAC-2026-044'],
  ['ModVisite', ModVisite, 'Visites techniques', 'Tuiles déplacées, infiltration'],
  ['ModDTG', ModDTG, 'DTG & plan pluriannuel de travaux', 'PPT approuvés en AG'],
  ['ModCarnet', ModCarnet, "Carnet d'entretien & technique", 'Réfection étanchéité terrasse'],
]

describe('syndic v54-fr — lot E (Patrimoine + Technique & travaux)', () => {
  it.each(CASES)('%s : rend le h1 (PageHead) + un élément signature', (_nom, Comp, h1, signature) => {
    render(
      <ToastProvider>
        <RoleProvider role="Direction">
          <Comp />
        </RoleProvider>
      </ToastProvider>,
    )
    expect(screen.getByRole('heading', { name: h1, level: 1 })).toBeInTheDocument()
    expect(screen.getAllByText(signature).length).toBeGreaterThan(0)
  })
})
