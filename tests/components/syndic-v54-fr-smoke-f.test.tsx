import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { RoleProvider } from '@/components/syndic-dashboard/v54-fr/lib/role-context'
import ModObligations from '@/components/syndic-dashboard/v54-fr/modules/ModObligations'
import ModCalendrier from '@/components/syndic-dashboard/v54-fr/modules/ModCalendrier'
import ModImmat from '@/components/syndic-dashboard/v54-fr/modules/ModImmat'
import ModAssurance from '@/components/syndic-dashboard/v54-fr/modules/ModAssurance'
import ModDPE from '@/components/syndic-dashboard/v54-fr/modules/ModDPE'
import ModAccessibilite from '@/components/syndic-dashboard/v54-fr/modules/ModAccessibilite'
import ModPrepAG from '@/components/syndic-dashboard/v54-fr/modules/ModPrepAG'
import ModDelibs from '@/components/syndic-dashboard/v54-fr/modules/ModDelibs'
import ModProcurations from '@/components/syndic-dashboard/v54-fr/modules/ModProcurations'
import ModRGPD from '@/components/syndic-dashboard/v54-fr/modules/ModRGPD'
import ModSecIncendie from '@/components/syndic-dashboard/v54-fr/modules/ModSecIncendie'

/** Lot F — Conformité légale : smoke test des 11 modules (h1 + élément signature). */

const CASES: ReadonlyArray<[string, ComponentType, string, string]> = [
  ['ModObligations', ModObligations, 'Obligations & échéances', 'Convocation AG élective'],
  ['ModCalendrier', ModCalendrier, 'Calendrier réglementaire', 'Assemblée générale annuelle'],
  ['ModImmat', ModImmat, 'Immatriculation au registre national', 'AA-1234-567'],
  ['ModAssurance', ModAssurance, 'Assurances', 'Multirisque immeuble'],
  ['ModDPE', ModDPE, 'Performance énergétique (DPE)', 'Classe A'],
  ['ModAccessibilite', ModAccessibilite, 'Accessibilité', 'Rampes extérieures (pente ≤ 6 %)'],
  ['ModPrepAG', ModPrepAG, "Préparateur d'assemblée générale", 'Envoyer la convocation en LRAR'],
  ['ModDelibs', ModDelibs, 'Suivi des délibérations', 'Travaux de ravalement'],
  ['ModProcurations', ModProcurations, 'Procurations & pouvoirs', 'Limite de 3 pouvoirs'],
  ['ModRGPD', ModRGPD, 'Centre RGPD', 'Droit à la portabilité'],
  ['ModSecIncendie', ModSecIncendie, 'Sécurité incendie', 'Désenfumage des circulations'],
]

describe('Lot F — modules conformité légale (smoke)', () => {
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
