// tests/components/btp-alertes-meteo-telephone.test.tsx — composant qui programme l'alerte météo de la veille dans
// l'appli Vitfix Pro (26/11/2026) : rien hors de l'appli ; une fois les chantiers chargés (jamais sur une lecture en
// échec) ; de nouveau au retour au premier plan, au plus une fois par heure, avec la liste RELUE à ce moment-là ;
// écouteurs retirés au démontage ; aucun message à l'écran (options du hook).

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

type Chantier = { id: string; titre?: string; statut?: string; alerteMeteo?: boolean; alerte_meteo?: boolean }

const h = vi.hoisted(() => ({
  appli: true,
  chargement: false,
  erreur: null as string | null,
  chantiers: [{ id: 'c-dalle', titre: 'Dalle', statut: 'En cours', alerteMeteo: true }] as Chantier[],
  /** Liste rendue par refresh() (lignes de la base), ou null : lecture en échec. */
  frais: [{ id: 'c-dalle', titre: 'Dalle', statut: 'Terminé', alerte_meteo: true }] as Chantier[] | null,
  options: null as Record<string, unknown> | null,
  refresh: vi.fn(),
  programmer: vi.fn(async () => ({ programmees: 0, affichees: 0, annulees: 0, ignorees: 0 })),
  reprise: null as null | (() => void),
  retirerReprise: vi.fn(async () => {}),
}))

vi.mock('@/lib/app-mobile', () => ({ estAppMobile: () => h.appli }))
vi.mock('@/lib/hooks/use-btp-data', () => ({
  useBTPData: (options: Record<string, unknown>) => {
    h.options = options
    return { items: h.chantiers, loading: h.chargement, error: h.erreur, refresh: h.refresh }
  },
}))
vi.mock('@/lib/btp/alerte-meteo-telephone', () => ({ programmerAlertesMeteo: h.programmer }))
vi.mock('@/lib/notifications', () => ({ programmerNotification: vi.fn(), annulerNotification: vi.fn(), notificationEnAttente: vi.fn() }))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_evenement: string, rappel: () => void) => {
      h.reprise = rappel
      return { remove: h.retirerReprise }
    }),
  },
}))

const { default: AlertesMeteoTelephone, INTERVALLE_RELECTURE_MS } = await import('@/components/dashboard/btp/AlertesMeteoTelephone')

const DEBUT = new Date(2026, 10, 26, 8, 0).getTime()
const visibilite = (etat: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: etat, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}
/** Monte le composant et laisse l'écouteur de l'appli s'installer (import dynamique). */
async function monter(isPt = false) {
  const rendu = render(<AlertesMeteoTelephone artisanId="fiche-1" userId="u1" isPt={isPt} />)
  await act(async () => {})
  return rendu
}
const plusTard = (ms: number) => vi.setSystemTime(DEBUT + ms)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(DEBUT)
  Object.assign(h, {
    appli: true, chargement: false, erreur: null, options: null, reprise: null,
    chantiers: [{ id: 'c-dalle', titre: 'Dalle', statut: 'En cours', alerteMeteo: true }],
    frais: [{ id: 'c-dalle', titre: 'Dalle', statut: 'Terminé', alerte_meteo: true }],
  })
  h.refresh.mockReset()
  h.refresh.mockImplementation(async () => h.frais)
  h.programmer.mockClear()
  h.retirerReprise.mockClear()
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})
afterEach(() => { vi.useRealTimers() })

describe('alerte météo dans l’appli', () => {
  it('hors de l’appli (navigateur) : rien n’est lu ni programmé', async () => {
    h.appli = false
    await monter()
    expect(h.options).toBeNull()
    expect(h.programmer).not.toHaveBeenCalled()
  })

  it('dans l’appli : programmée une fois les chantiers chargés, dans la langue de l’écran, sans message ni reprise', async () => {
    await monter(true)
    expect(h.programmer).toHaveBeenCalledTimes(1)
    expect(h.programmer).toHaveBeenCalledWith(h.chantiers, true, expect.objectContaining({
      programmer: expect.any(Function), annuler: expect.any(Function), enAttente: expect.any(Function),
    }))
    expect(h.refresh).not.toHaveBeenCalled()
    expect(h.options).toMatchObject({ table: 'chantiers', autoImport: false, annoncerEchecs: false })
  })

  it('chantiers encore en chargement : attend, puis programme une fois chargés', async () => {
    h.chargement = true
    const { rerender } = await monter()
    expect(h.programmer).not.toHaveBeenCalled()
    h.chargement = false
    rerender(<AlertesMeteoTelephone artisanId="fiche-1" userId="u1" isPt={false} />)
    expect(h.programmer).toHaveBeenCalledTimes(1)
  })

  it('lecture en échec au chargement : rien n’est programmé ni annulé ; le premier retour au premier plan relit', async () => {
    h.erreur = 'Erreur de chargement'
    await monter()
    expect(h.programmer).not.toHaveBeenCalled()
    await act(async () => { visibilite('visible') })
    expect(h.refresh).toHaveBeenCalledTimes(1)
    expect(h.programmer).toHaveBeenCalledWith(h.frais, false, expect.anything())
  })
})

describe('retour au premier plan', () => {
  it('au-delà d’une heure : la liste est relue, et c’est elle qui est programmée', async () => {
    await monter()
    await act(async () => { visibilite('visible') })
    expect(h.refresh).not.toHaveBeenCalled()
    expect(h.programmer).toHaveBeenCalledTimes(1)
    plusTard(INTERVALLE_RELECTURE_MS + 1)
    await act(async () => { visibilite('visible') })
    expect(h.refresh).toHaveBeenCalledTimes(1)
    expect(h.programmer).toHaveBeenCalledTimes(2)
    expect(h.programmer).toHaveBeenLastCalledWith(h.frais, false, expect.anything())
  })

  it('relecture en échec : rien n’est programmé (ni annulé) avec une liste vide', async () => {
    await monter()
    h.frais = null
    plusTard(INTERVALLE_RELECTURE_MS + 1)
    await act(async () => { visibilite('visible') })
    expect(h.refresh).toHaveBeenCalledTimes(1)
    expect(h.programmer).toHaveBeenCalledTimes(1)
  })

  it('appli passée en arrière-plan : rien', async () => {
    await monter()
    plusTard(INTERVALLE_RELECTURE_MS + 1)
    await act(async () => { visibilite('hidden') })
    expect(h.refresh).not.toHaveBeenCalled()
  })

  it('reprise signalée par l’appli (@capacitor/app) : même relecture', async () => {
    await monter()
    expect(h.reprise).toBeTypeOf('function')
    plusTard(INTERVALLE_RELECTURE_MS + 1)
    await act(async () => { h.reprise?.() })
    expect(h.refresh).toHaveBeenCalledTimes(1)
    expect(h.programmer).toHaveBeenCalledTimes(2)
  })

  it('démonté : plus aucun écouteur', async () => {
    const { unmount } = await monter()
    unmount()
    expect(h.retirerReprise).toHaveBeenCalledTimes(1)
    plusTard(INTERVALLE_RELECTURE_MS + 1)
    await act(async () => { visibilite('visible') })
    expect(h.refresh).not.toHaveBeenCalled()
  })
})
