import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ComponentType, ReactNode } from 'react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { RoleProvider } from '@/components/syndic-dashboard/v54-fr/lib/role-context'
import ModFixy from '@/components/syndic-dashboard/v54-fr/modules/ModFixy'
import ModMax from '@/components/syndic-dashboard/v54-fr/modules/ModMax'
import ModLea from '@/components/syndic-dashboard/v54-fr/modules/ModLea'
import ModAlfredo from '@/components/syndic-dashboard/v54-fr/modules/ModAlfredo'
import ModTempo from '@/components/syndic-dashboard/v54-fr/modules/ModTempo'
import ModDashboard from '@/components/syndic-dashboard/v54-fr/modules/ModDashboard'
import ModAGElective from '@/components/syndic-dashboard/v54-fr/modules/ModAGElective'
import ModReddition from '@/components/syndic-dashboard/v54-fr/modules/ModReddition'
import ModHonoraires from '@/components/syndic-dashboard/v54-fr/modules/ModHonoraires'

/** Lot A — smoke des 9 modules FR : agents IA + section Mandat judiciaire. */

const wrap = (ui: ReactNode) =>
  render(
    <ToastProvider>
      <RoleProvider role="Direction">{ui}</RoleProvider>
    </ToastProvider>,
  )

describe('syndic v54-fr — lot A (agents IA + mandat judiciaire)', () => {
  // Agents IA : AgentChatPage n'a pas de h1 — le nom de l'agent est le h2.
  it.each<[string, ComponentType, RegExp, string]>([
    ['ModFixy', ModFixy, /Fixy — Assistant du mandat/, 'Génère un ordre de service pour la fuite du 4e'],
    ['ModMax', ModMax, /Max — Expert juridique/, 'Quelle majorité pour désigner le syndic en AG ?'],
    ['ModLea', ModLea, /Léa — Comptable/, 'Prépare la reddition de comptes des Tilleuls'],
    ['ModAlfredo', ModAlfredo, /Alfredo — Courriers/, "Rédige la convocation de l'AG élective"],
    ['ModTempo', ModTempo, /Tempo — Échéances/, 'Quelles automatisations sont actives en ce moment ?'],
  ])('%s : rend le nom de l\'agent (h2), les libellés FR et une suggestion', (_nom, Comp, h2, suggestion) => {
    wrap(<Comp />)
    expect(screen.getByRole('heading', { level: 2, name: h2 })).toBeInTheDocument()
    expect(screen.getByText(suggestion)).toBeInTheDocument()
    // Libellés FR (prop labels) appliqués — pas les défauts PT.
    expect(screen.getByRole('heading', { level: 3, name: 'CONVERSATIONS' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Nouvelle conversation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument()
  })

  it('ModDashboard : hero (h1), stats portefeuille et état des mandats', () => {
    wrap(<ModDashboard />)
    expect(screen.getByRole('heading', { level: 1, name: /Bonjour, Cabinet Delaunay/ })).toBeInTheDocument()
    expect(screen.getByText('Lots sous mandat')).toBeInTheDocument()
    expect(screen.getByText('Suivi budgétaire cumulé — Exercice 2026')).toBeInTheDocument()
    // Une copro signature (panel État des mandats + légende budgétaire).
    expect(screen.getAllByText(/Résidence Le Méridien/).length).toBeGreaterThan(0)
  })

  it.each<[string, ComponentType, string, string]>([
    ['ModAGElective', ModAGElective, 'Assemblée générale élective', 'Copropriétaires à convoquer'],
    ['ModReddition', ModReddition, 'Reddition de comptes', 'Comptes par copropriété'],
    ['ModHonoraires', ModHonoraires, 'Honoraires & taxation', 'Relevé des diligences'],
  ])('%s : rend le titre (h1 PageHead) et un élément signature', (_nom, Comp, h1, signature) => {
    wrap(<Comp />)
    expect(screen.getByRole('heading', { level: 1, name: h1 })).toBeInTheDocument()
    expect(screen.getByText(signature)).toBeInTheDocument()
  })

  it('ModReddition : liste les 4 copropriétés sous mandat', () => {
    wrap(<ModReddition />)
    expect(screen.getByText('Résidence Le Méridien')).toBeInTheDocument()
    expect(screen.getByText('Le Clos des Vignes')).toBeInTheDocument()
    expect(screen.getByText('Copropriété Les Tilleuls')).toBeInTheDocument()
    expect(screen.getByText('Villa Montaigne')).toBeInTheDocument()
  })

  it('ModHonoraires : relevé des diligences et cycle de taxation', () => {
    wrap(<ModHonoraires />)
    expect(screen.getByText('Reprise comptable et ouverture du compte séparé')).toBeInTheDocument()
    expect(screen.getByText('Requête en taxation')).toBeInTheDocument()
  })
})
