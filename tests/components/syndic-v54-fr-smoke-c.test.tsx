import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { RoleProvider } from '@/components/syndic-dashboard/v54-fr/lib/role-context'
import ModNotifJud from '@/components/syndic-dashboard/v54-fr/modules/ModNotifJud'
import ModJournal from '@/components/syndic-dashboard/v54-fr/modules/ModJournal'
import ModPortefeuille from '@/components/syndic-dashboard/v54-fr/modules/ModPortefeuille'
import ModCharge from '@/components/syndic-dashboard/v54-fr/modules/ModCharge'
import ModValidation from '@/components/syndic-dashboard/v54-fr/modules/ModValidation'
import ModPlanning from '@/components/syndic-dashboard/v54-fr/modules/ModPlanning'
import ModEquipe from '@/components/syndic-dashboard/v54-fr/modules/ModEquipe'
import ModImpayes from '@/components/syndic-dashboard/v54-fr/modules/ModImpayes'

/** Lot C (v54-fr) — smoke test des 8 modules Pilotage judiciaire 2 +
 * Cabinet & supervision + gestion : chaque module rend son PageHead (h1)
 * et au moins un élément signature de ses données mock. */

const wrap = (ui: React.ReactElement) =>
  render(
    <ToastProvider>
      <RoleProvider role="Direction">{ui}</RoleProvider>
    </ToastProvider>
  )

type Case = [string, ComponentType, string, string]

const CASES: Case[] = [
  ['ModNotifJud', ModNotifJud, 'Registre des notifications', 'Ordonnance de désignation'],
  ['ModJournal', ModJournal, "Journal d'activité", "Tenue de l'assemblée générale"],
  ['ModPortefeuille', ModPortefeuille, 'Portefeuille des mandats', 'Tour Montreuil'],
  ['ModCharge', ModCharge, 'Charge des collaborateurs', 'Julien Marchand'],
  ['ModValidation', ModValidation, 'Circuit de validation', 'Requête en prorogation — Les Tilleuls'],
  ['ModPlanning', ModPlanning, 'Planning', 'Convocation AG — Le Clos des Vignes'],
  ['ModEquipe', ModEquipe, 'Équipe du cabinet', 'a.diallo@cabinet-delaunay.fr'],
  ['ModImpayes', ModImpayes, 'Impayés & recouvrement', 'SCI Belvédère'],
]

describe('syndic v54-fr — lot C (smoke)', () => {
  it.each(CASES)('%s rend son titre et ses données', (_name, Mod, h1, signature) => {
    wrap(<Mod />)
    expect(screen.getByRole('heading', { name: h1, level: 1 })).toBeInTheDocument()
    expect(screen.getAllByText(signature).length).toBeGreaterThanOrEqual(1)
  })
})
