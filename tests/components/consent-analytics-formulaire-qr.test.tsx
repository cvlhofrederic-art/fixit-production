// tests/components/consent-analytics-formulaire-qr.test.tsx
//
// D24 (et D10) — décision de Hugo du 17/11/2026, au nom de VitFix, point 4 : « mesure d'audience retirée du formulaire ».
// La mesure d'audience de VitFix (components/common/ConsentAnalytics.tsx : balise Cloudflare Web Analytics, Google
// Analytics 4, page vue envoyée à /api/analytics/track) ne se charge JAMAIS sur le formulaire public de Vitfix Signal,
// même après « Tout accepter » : adresse affichée (/<identifiant>/signalement/<jeton>/, ancienne /fr/signalement/<jeton>/)
// comme page interne de la réécriture (/cabinet/<identifiant>/signalement/<jeton>, /signalement/<jeton>), selon ce que
// rend usePathname. Les autres pages du site gardent la mesure, toujours soumise au consentement.
// Le bandeau de cookies n'est pas touché (D10 : écran, à décider par Frédéric). Jetons et identifiant fictifs.
// React 19 range les <script async> dans <head> : la page entière (head et conteneur) est relue.

import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const etat = vi.hoisted(() => ({ chemin: '/fr/' as string | null, consentement: true }))
const trackPageView = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({ usePathname: () => etat.chemin }))
vi.mock('@/components/common/CookieConsent', () => ({ isAnalyticsAllowed: () => etat.consentement }))
vi.mock('@/lib/analytics', () => ({ trackPageView }))

const { default: ConsentAnalytics } = await import('@/components/common/ConsentAnalytics')
const { estFormulaireSignalementQr } = await import('@/lib/vitfixsignal/chemin-cabinet')

const JETON = '0123456789abcdef0123456789abcdef'
const GA4 = 'https://www.googletagmanager.com/gtag/js?id='
const BALISE_CLOUDFLARE = 'https://static.cloudflareinsights.com/beacon.min.js'

/** Tout le document rendu : <head> (scripts async rangés par React) et <body>. */
const pageRendue = () => document.documentElement.innerHTML

const FORMULAIRES = [
  `/cabinet-exemple/signalement/${JETON}/`,
  `/cabinet-exemple/signalement/${JETON}`,
  `/cabinet/cabinet-exemple/signalement/${JETON}`,
  `/cabinet/cabinet-exemple/signalement/${JETON}/`,
  `/fr/signalement/${JETON}/`,
  `/pt/signalement/${JETON}/`,
  `/signalement/${JETON}`,
  `/signalement/${JETON}/`,
]

const AUTRES_PAGES = [
  '/fr/', '/', '/fr/confidentialite/', '/cabinet-exemple/suivi/', '/cabinet-exemple/connexion/',
  '/cabinet-exemple/desinscription/', '/cabinet-exemple/confirmation-adresse/', '/vitfixsignal/connexion/',
  '/fr/signalement/', '/blog/signalement-fuite/', null,
]

beforeEach(() => {
  etat.chemin = '/fr/'
  etat.consentement = true
  trackPageView.mockClear()
  for (const script of document.querySelectorAll('script')) script.remove()
})

describe('estFormulaireSignalementQr', () => {
  it('reconnaît le formulaire public, sous l’adresse affichée comme sous la page interne', () => {
    for (const chemin of FORMULAIRES) expect(estFormulaireSignalementQr(chemin), chemin).toBe(true)
  })

  it('aucune autre page (espace du cabinet, désinscription, confirmation, pages du site)', () => {
    for (const chemin of AUTRES_PAGES) expect(estFormulaireSignalementQr(chemin), String(chemin)).toBe(false)
  })
})

describe('ConsentAnalytics sur le formulaire public', () => {
  it('consentement donné : aucun script de mesure et aucune page vue, sur chaque forme du chemin', () => {
    for (const chemin of FORMULAIRES) {
      etat.chemin = chemin
      const { container, unmount } = render(<ConsentAnalytics />)
      expect(container.innerHTML, chemin).toBe('')
      expect(pageRendue(), chemin).not.toContain(GA4)
      expect(pageRendue(), chemin).not.toContain(BALISE_CLOUDFLARE)
      unmount()
    }
    expect(trackPageView).not.toHaveBeenCalled()
  })

  it('le consentement donné plus tard, sur le formulaire, ne charge rien non plus', () => {
    vi.useFakeTimers()
    try {
      etat.chemin = FORMULAIRES[0]
      etat.consentement = false
      const { container } = render(<ConsentAnalytics />)
      etat.consentement = true
      act(() => { vi.advanceTimersByTime(10_000) })
      expect(container.innerHTML).toBe('')
      expect(pageRendue()).not.toContain(GA4)
      expect(trackPageView).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('autres pages : la mesure se charge après consentement, comme avant (GA4 et balise Cloudflare, une page vue)', () => {
    render(<ConsentAnalytics />)
    expect(pageRendue()).toContain(GA4)
    expect(pageRendue()).toContain(BALISE_CLOUDFLARE)
    expect(trackPageView).toHaveBeenCalledTimes(1)
  })

  it('autres pages, sans consentement : rien, comme avant', () => {
    etat.consentement = false
    const { container } = render(<ConsentAnalytics />)
    expect(container.innerHTML).toBe('')
    expect(pageRendue()).not.toContain(GA4)
    expect(trackPageView).not.toHaveBeenCalled()
  })
})
