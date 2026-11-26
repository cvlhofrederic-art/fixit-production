// tests/components/btp-alertes-meteo-telephone.test.tsx — composant qui programme l'alerte météo de la veille dans
// l'appli Vitfix Pro (26/11/2026) : rien hors de l'appli ; une fois au chargement des chantiers ; de nouveau au retour
// au premier plan, au plus toutes les trois heures.

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

const h = vi.hoisted(() => ({
  appli: true,
  chargement: false,
  chantiers: [{ id: 'c-dalle', titre: 'Dalle', statut: 'En cours', alerteMeteo: true, latitude: 43.3, longitude: 5.38 }],
  programmer: vi.fn(async () => ({ programmees: 0, affichees: 0, annulees: 0, ignorees: 0 })),
}))

vi.mock('@/lib/app-mobile', () => ({ estAppMobile: () => h.appli }))
vi.mock('@/lib/hooks/use-btp-data', () => ({ useBTPData: () => ({ items: h.chantiers, loading: h.chargement }) }))
vi.mock('@/lib/btp/alerte-meteo-telephone', () => ({ programmerAlertesMeteo: h.programmer }))
vi.mock('@/lib/notifications', () => ({ programmerNotification: vi.fn(), annulerNotification: vi.fn() }))

const { default: AlertesMeteoTelephone, INTERVALLE_RELECTURE_MS } = await import('@/components/dashboard/btp/AlertesMeteoTelephone')

const premierPlan = () => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  h.appli = true
  h.chargement = false
  h.programmer.mockClear()
})
afterEach(() => { vi.useRealTimers() })

describe('alerte météo dans l’appli', () => {
  it('hors de l’appli (navigateur) : rien n’est programmé', () => {
    h.appli = false
    render(<AlertesMeteoTelephone artisanId="fiche-1" userId="u1" isPt={false} />)
    expect(h.programmer).not.toHaveBeenCalled()
  })

  it('dans l’appli : programmée une fois les chantiers chargés, avec la langue de l’écran', () => {
    render(<AlertesMeteoTelephone artisanId="fiche-1" userId="u1" isPt />)
    expect(h.programmer).toHaveBeenCalledTimes(1)
    expect(h.programmer).toHaveBeenCalledWith(h.chantiers, true, expect.objectContaining({ programmer: expect.any(Function), annuler: expect.any(Function) }))
  })

  it('chantiers encore en chargement : attend', () => {
    h.chargement = true
    render(<AlertesMeteoTelephone artisanId="fiche-1" userId="u1" isPt={false} />)
    expect(h.programmer).not.toHaveBeenCalled()
  })

  it('retour au premier plan : relue seulement si la dernière lecture a plus de trois heures', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 26, 8, 0))
    render(<AlertesMeteoTelephone artisanId="fiche-1" userId="u1" isPt={false} />)
    act(() => premierPlan())
    expect(h.programmer).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date(2026, 10, 26, 8, 0).getTime() + INTERVALLE_RELECTURE_MS + 1)
    act(() => premierPlan())
    expect(h.programmer).toHaveBeenCalledTimes(2)
  })
})
