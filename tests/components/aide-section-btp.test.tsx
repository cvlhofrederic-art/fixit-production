/**
 * Aide du tableau de bord BTP (pro_societe), constat coquille-6 de l'audit du 11/11/2026 : le téléphone affiché était
 * un numéro d'exemple, l'adresse n'était pas celle du site, et « Ouvrir un ticket » annonçait « Ticket créé — réponse
 * sous 24h » sans rien transmettre. Pour une société BTP, l'Aide donne l'adresse de contact du site
 * (lib/constants.ts) et le bouton ouvre un e-mail vers elle. L'artisan, qui reçoit le même écran, est inchangé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { simulerLocation, type LocationSimulee } from '../helpers/simulations-dashboard'

const mocks = vi.hoisted(() => ({ locale: 'fr', toastInfo: vi.fn() }))

vi.mock('@/lib/i18n/context', () => ({ useLocale: () => mocks.locale }))
vi.mock('sonner', () => ({ toast: { info: mocks.toastInfo, error: vi.fn(), success: vi.fn() } }))

import AideSection from '@/components/dashboard/AideSection'
import { CONTACT_EMAIL } from '@/lib/constants'

let lieu: LocationSimulee

beforeEach(() => {
  vi.clearAllMocks()
  mocks.locale = 'fr'
  lieu = simulerLocation('/fr/pro/dashboard/')
})

afterEach(() => {
  lieu.restaurer()
})

function ouvrirToutesLesQuestions() {
  for (const question of document.querySelectorAll<HTMLElement>('.v5-faq-q')) {
    fireEvent.click(question)
  }
}

describe('Aide — société BTP', () => {
  it('affiche l’adresse de contact du site, sans numéro d’exemple, et « Ouvrir un ticket » écrit à cette adresse', () => {
    const { container } = render(<AideSection navigateTo={vi.fn()} orgRole="pro_societe" />)

    expect(CONTACT_EMAIL).toBe('contact@vitfix.io')
    expect(container.textContent).toContain(CONTACT_EMAIL)
    expect(container.textContent).not.toContain('04 91 00 00 00')
    expect(container.textContent).not.toContain('support@vitfix.io')

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir un ticket' }))
    expect(mocks.toastInfo).not.toHaveBeenCalled()
    expect(lieu.navigations).toHaveLength(1)
    const lien = new URL(lieu.navigations[0])
    expect(lien.protocol).toBe('mailto:')
    expect(lien.pathname).toBe(CONTACT_EMAIL)
    expect(lien.searchParams.get('subject')).toBe('Demande d’assistance — Société BTP')
  })

  it('la réponse « Comment contacter le support ? » donne la même adresse, sans téléphone', () => {
    const { container } = render(<AideSection navigateTo={vi.fn()} orgRole="pro_societe" />)
    fireEvent.click(screen.getByText('Comment contacter le support ?'))
    const reponse = container.querySelector('.v5-faq-a')
    expect(reponse?.textContent).toContain(CONTACT_EMAIL)
    expect(reponse?.textContent).not.toMatch(/Tél|04 91|support@/)
    // Aucune autre réponse ne porte de numéro d'exemple.
    ouvrirToutesLesQuestions()
    expect(container.textContent).not.toContain('04 91 00 00 00')
  })

  it('en portugais : même adresse, et l’e-mail s’ouvre avec un objet en portugais', () => {
    mocks.locale = 'pt'
    const { container } = render(<AideSection navigateTo={vi.fn()} orgRole="pro_societe" />)
    expect(container.textContent).toContain(CONTACT_EMAIL)
    expect(container.textContent).not.toContain('support@vitfix.io')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir pedido de suporte' }))
    expect(mocks.toastInfo).not.toHaveBeenCalled()
    const lien = new URL(lieu.navigations[0])
    expect(lien.pathname).toBe(CONTACT_EMAIL)
    expect(lien.searchParams.get('subject')).toBe('Pedido de assistência: empresa de construção')
  })
})

describe('Aide — artisan (même écran), inchangée', () => {
  it('garde son contenu et son bouton tels quels', () => {
    const { container } = render(<AideSection navigateTo={vi.fn()} orgRole="artisan" />)
    expect(container.textContent).toContain('support@vitfix.io')
    expect(container.textContent).toContain('04 91 00 00 00')
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir un ticket' }))
    expect(mocks.toastInfo).toHaveBeenCalledWith('Ticket créé — réponse sous 24h')
    expect(lieu.navigations).toEqual([])
  })
})
