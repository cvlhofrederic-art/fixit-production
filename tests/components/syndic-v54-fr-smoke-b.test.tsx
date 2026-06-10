import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ComponentType, ReactElement } from 'react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { RoleProvider } from '@/components/syndic-dashboard/v54-fr/lib/role-context'
import ModCockpit from '@/components/syndic-dashboard/v54-fr/modules/ModCockpit'
import ModMandats from '@/components/syndic-dashboard/v54-fr/modules/ModMandats'
import ModInterventions from '@/components/syndic-dashboard/v54-fr/modules/ModInterventions'
import ModPrestataires from '@/components/syndic-dashboard/v54-fr/modules/ModPrestataires'
import ModPriseFonction from '@/components/syndic-dashboard/v54-fr/modules/ModPriseFonction'
import ModDossierJud from '@/components/syndic-dashboard/v54-fr/modules/ModDossierJud'
import ModRedressement from '@/components/syndic-dashboard/v54-fr/modules/ModRedressement'
import ModPouvoirs from '@/components/syndic-dashboard/v54-fr/modules/ModPouvoirs'

/** Lot B — smoke des 8 modules FR : cockpit + ordonnances + pilotage judiciaire 1. */

const renderMod = (ui: ReactElement) =>
  render(
    <ToastProvider>
      <RoleProvider role="Direction">{ui}</RoleProvider>
    </ToastProvider>
  )

type ModComponent = ComponentType<{ onNavigate?: (id: string) => void }>

describe('Modules syndic v54-fr — lot B', () => {
  it.each<[string, ModComponent, string, string]>([
    ['ModMandats', ModMandats, 'Ordonnances & missions', 'RG 26/00892'],
    ['ModInterventions', ModInterventions, 'Ordres de service', 'OS-2026-051'],
    ['ModPrestataires', ModPrestataires, 'Prestataires', 'Atlantic Plomberie SARL'],
    ['ModPriseFonction', ModPriseFonction, 'Prise de fonction', 'Ouvrir le compte bancaire séparé au nom du syndicat'],
    ['ModDossierJud', ModDossierJud, 'Dossier juridictionnel', 'Requête en autorisation de travaux urgents'],
    ['ModRedressement', ModRedressement, 'Redressement — copropriété en difficulté', "Plan d'apurement des créanciers"],
    ['ModPouvoirs', ModPouvoirs, 'Étendue des pouvoirs', 'Puis-je décider seul ?'],
  ])('%s rend le titre H1 et un élément signature', (_nom, Comp, titre, signature) => {
    renderMod(<Comp />)
    expect(screen.getByRole('heading', { name: titre, level: 1 })).toBeInTheDocument()
    expect(screen.getAllByText(signature).length).toBeGreaterThan(0)
  })

  it('ModCockpit (rôle Direction) rend le hero et au moins une tâche de la file', () => {
    renderMod(<ModCockpit />)
    // Hero : h1 « Bonjour — Direction du cabinet » (TODAY épinglée à minuit → Bonjour).
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bonjour')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Direction du cabinet')
    // Au moins une tâche de TASKS s'affiche (Direction voit tout le cabinet).
    expect(screen.getByText("Convoquer l'assemblée générale élective")).toBeInTheDocument()
    expect(screen.getByText('Déposer la requête en prorogation de mission')).toBeInTheDocument()
    // Centre d'automatisation (BATCH) présent.
    expect(screen.getByText("Générer les convocations d'AG dues")).toBeInTheDocument()
  })
})
