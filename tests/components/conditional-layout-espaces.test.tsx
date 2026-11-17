// tests/components/conditional-layout-espaces.test.tsx
//
// ConditionalLayout : les espaces qui ont leur propre coquille (tableaux de bord, succursale AJ, espace AJ Signalement)
// ne reçoivent ni l'en-tête ni le pied marketing, ni SiteProtection, ni le décalage pt-[68px] de l'en-tête.

import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ chemin: '/' as string | null }))

vi.mock('next/navigation', () => ({ usePathname: () => h.chemin }))
vi.mock('@/components/common/Header', () => ({ default: () => <header data-testid="entete-marketing" /> }))
vi.mock('@/components/common/Footer', () => ({ default: () => <footer data-testid="pied-marketing" /> }))
vi.mock('@/components/common/SiteProtection', () => ({ default: () => <div data-testid="site-protection" /> }))
vi.mock('@/components/common/WhatsAppFloatingButton', () => ({ default: () => <div data-testid="whatsapp" /> }))

const { default: ConditionalLayout } = await import('@/components/common/ConditionalLayout')

function rendre(chemin: string) {
  h.chemin = chemin
  return render(<ConditionalLayout><p>contenu</p></ConditionalLayout>)
}

beforeEach(() => {
  h.chemin = '/'
})

describe('ConditionalLayout — espace AJ Signalement', () => {
  it.each([
    '/fr/aj-signalement/', '/fr/aj-signalement', '/pt/aj-signalement/',
    // Page de connexion professionnelle de l'espace (11/11/2026) : sans en-tête ni pied marketing.
    '/fr/aj-signalement/connexion/', '/pt/aj-signalement/connexion/',
  ])('%s : contenu seul, sans habillage marketing', (chemin) => {
    const { container } = rendre(chemin)
    expect(screen.getByText('contenu')).toBeInTheDocument()
    expect(screen.queryByTestId('entete-marketing')).toBeNull()
    expect(screen.queryByTestId('pied-marketing')).toBeNull()
    expect(screen.queryByTestId('site-protection')).toBeNull()
    expect(container.querySelector('.pt-\\[68px\\]')).toBeNull()
  })

  it('la succursale AJ garde le même traitement', () => {
    rendre('/fr/administrateur-judiciaire/')
    expect(screen.queryByTestId('entete-marketing')).toBeNull()
  })

  it('une page publique garde l’en-tête et le pied marketing (ex. /fr/a-propos/)', () => {
    rendre('/fr/a-propos/')
    expect(screen.getByTestId('entete-marketing')).toBeInTheDocument()
    expect(screen.getByTestId('pied-marketing')).toBeInTheDocument()
  })
})

// Espace de chaque cabinet (PR 2, lot 4) : connexion professionnelle et suivi du gestionnaire, sans habillage marketing,
// comme l'espace global. usePathname peut rendre l'adresse affichée (/<id>/suivi/) ou la page interne de la réécriture
// (/cabinet/<id>/suivi/) : les deux formes sont reconnues (à vérifier sur l'aperçu, plan § 8).
describe('ConditionalLayout — espace d’un cabinet', () => {
  it.each([
    '/cabinet-exemple/connexion/', '/cabinet-exemple/suivi/', '/cabinet-exemple/suivi',
    '/cabinet/cabinet-exemple/connexion/', '/cabinet/cabinet-exemple/suivi/',
  ])('%s : contenu seul, sans habillage marketing', (chemin) => {
    const { container } = rendre(chemin)
    expect(screen.getByText('contenu')).toBeInTheDocument()
    expect(screen.queryByTestId('entete-marketing')).toBeNull()
    expect(screen.queryByTestId('pied-marketing')).toBeNull()
    expect(screen.queryByTestId('site-protection')).toBeNull()
    expect(container.querySelector('.pt-\\[68px\\]')).toBeNull()
  })

  it.each(['/cabinet-exemple/invitation/', '/cabinet-exemple/confirmation-adresse/', '/blog/suivi/'])(
    '%s : habillage inchangé (pages publiques de la PR 1 et du lot 3)',
    (chemin) => {
      rendre(chemin)
      expect(screen.getByTestId('entete-marketing')).toBeInTheDocument()
    },
  )
})
