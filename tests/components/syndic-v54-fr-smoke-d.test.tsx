import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { RoleProvider } from '@/components/syndic-dashboard/v54-fr/lib/role-context'
import ModCanal from '@/components/syndic-dashboard/v54-fr/modules/ModCanal'
import ModReservation from '@/components/syndic-dashboard/v54-fr/modules/ModReservation'
import ModAffichage from '@/components/syndic-dashboard/v54-fr/modules/ModAffichage'
import ModSondages from '@/components/syndic-dashboard/v54-fr/modules/ModSondages'
import ModDoleances from '@/components/syndic-dashboard/v54-fr/modules/ModDoleances'
import ModExtranet from '@/components/syndic-dashboard/v54-fr/modules/ModExtranet'
import ModSMS from '@/components/syndic-dashboard/v54-fr/modules/ModSMS'
import ModNPS from '@/components/syndic-dashboard/v54-fr/modules/ModNPS'
import ModRemboursements from '@/components/syndic-dashboard/v54-fr/modules/ModRemboursements'

/** Lot D (v54-fr) — Canal + Extranet copropriétaires : smoke test des 9 modules.
 * Chaque module doit rendre son PageHead (h1) + un élément signature de ses données mock. */

const CASES: [string, ComponentType, string, string][] = [
  ['ModCanal', ModCanal, 'Canal de communication', 'Le Méridien — Conseil syndical'],
  ['ModReservation', ModReservation, 'Réservation des espaces communs', 'Juin 2026'],
  ['ModAffichage', ModAffichage, 'Panneau d\'affichage', 'Convocation à l\'assemblée générale élective'],
  ['ModSondages', ModSondages, 'Sondages & consultations', 'Choix de l\'entreprise de ravalement'],
  ['ModDoleances', ModDoleances, 'Doléances & réclamations', 'Fuite en sous-sol (parking)'],
  ['ModExtranet', ModExtranet, 'Extranet copropriétaires', 'M. Bernard'],
  ['ModSMS', ModSMS, 'Messages aux copropriétaires', 'Convocation AG'],
  ['ModNPS', ModNPS, 'NPS post-intervention', 'Otis (ascenseurs)'],
  ['ModRemboursements', ModRemboursements, 'Remboursements', 'M. Lefèvre'],
]

describe('syndic v54-fr — lot D (canal + extranet copropriétaires)', () => {
  it.each(CASES)('%s rend son titre et un élément signature', (_name, Comp, h1, signature) => {
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
