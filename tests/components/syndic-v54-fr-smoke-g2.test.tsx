// tests/components/syndic-v54-fr-smoke-g2.test.tsx
//
// Lot G2 FR — smoke test des 8 modules « Technique IA + Outils IA + Compte » :
// analyseDevis, redactionPV, comDigitale, signature, ppt, ged, modules, parametres.
// Modèle : syndic-v54-mod-cctv.test.tsx — on vérifie le H1 (PageHead) + un
// élément signature par module (KPI, donnée mock, nom de copro…).

import React from 'react'
import type { ComponentType } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { RoleProvider } from '@/components/syndic-dashboard/v54-fr/lib/role-context'
import ModAnalyseDevis from '@/components/syndic-dashboard/v54-fr/modules/ModAnalyseDevis'
import ModRedactionPV from '@/components/syndic-dashboard/v54-fr/modules/ModRedactionPV'
import ModComDigitale from '@/components/syndic-dashboard/v54-fr/modules/ModComDigitale'
import ModSignature from '@/components/syndic-dashboard/v54-fr/modules/ModSignature'
import ModPPT from '@/components/syndic-dashboard/v54-fr/modules/ModPPT'
import ModGED from '@/components/syndic-dashboard/v54-fr/modules/ModGED'
import ModMesModules from '@/components/syndic-dashboard/v54-fr/modules/ModMesModules'
import ModParametres from '@/components/syndic-dashboard/v54-fr/modules/ModParametres'

afterEach(cleanup)

/** [nom, Composant, titre H1, élément signature (peut apparaître plusieurs fois)] */
const MODULES: [string, ComponentType, string, string][] = [
  ['ModAnalyseDevis', ModAnalyseDevis, 'Analyse de devis & factures', 'Devis toiture — Ent. Toitures Nord'],
  ['ModRedactionPV', ModRedactionPV, 'Rédaction de procès-verbaux', 'Quitus au syndic'],
  ['ModComDigitale', ModComDigitale, 'Communication digitale', 'Conseil syndical — Le Méridien'],
  ['ModSignature', ModSignature, 'Signature électronique', "Contrat d'entretien ascenseur"],
  ['ModPPT', ModPPT, 'Rapport mensuel', 'Avancement du mandat judiciaire'],
  ['ModGED', ModGED, 'Documents (GED)', 'Ordonnance de désignation'],
  ['ModMesModules', ModMesModules, 'Mes modules', 'Cockpit du jour'],
  ['ModParametres', ModParametres, 'Paramètres', 'Double authentification (2FA)'],
]

describe('syndic v54-fr — smoke lot G2 (IA + outils + compte)', () => {
  it.each(MODULES)('%s : rend le H1 et un élément signature', (_name, Component, h1, signature) => {
    render(
      <ToastProvider>
        <RoleProvider role="Direction">
          <Component />
        </RoleProvider>
      </ToastProvider>,
    )
    expect(screen.getByRole('heading', { name: h1, level: 1 })).toBeTruthy()
    expect(screen.getAllByText(signature).length).toBeGreaterThan(0)
  })
})
