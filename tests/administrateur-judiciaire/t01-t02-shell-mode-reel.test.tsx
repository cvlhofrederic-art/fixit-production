import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'

/**
 * T01 / T02 — rendu du cadre commun (Shell) EN MODE RÉEL : la cloche, le formulaire « Nouvelle intervention » et
 * l'alerte de lecture ne montrent aucune donnée de démonstration, et une erreur de lecture de la base est visible.
 * Le mode est lu au chargement des modules : il est posé dans le stockage, puis les modules sont rechargés.
 */

vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return <div data-testid="ecran-registre" />
    },
}))

const CLE_STOCKAGE_MODE = 'vitfix.aj.mode'

let Shell: ComponentType
let ToastProvider: ComponentType<{ children?: React.ReactNode }>
let DEMO_NOTIFICATIONS: { title: string }[]
let DEMO_NOMS_COPROPRIETES: string[]
let DEMO_PRESTATAIRES: { nom: string }[]
let useDonneesStore: typeof import('@/lib/administrateur-judiciaire/db/donnees-store').useDonneesStore
let repoNotifications: typeof import('@/lib/administrateur-judiciaire/db/repositories').repoNotifications
let viderBaseLocale: () => Promise<void>

beforeAll(async () => {
  localStorage.setItem(CLE_STOCKAGE_MODE, 'reel')
  vi.resetModules()
  ;({ Shell } = await import('@/components/administrateur-judiciaire/shell/Shell'))
  ;({ ToastProvider } = await import('@/components/administrateur-judiciaire/ui/toast'))
  ;({ DEMO_NOTIFICATIONS } = await import('@/components/administrateur-judiciaire/data/notifications'))
  ;({ DEMO_NOMS_COPROPRIETES } = await import('@/components/administrateur-judiciaire/data/coproprietes'))
  ;({ DEMO_PRESTATAIRES } = await import('@/components/administrateur-judiciaire/data/prestataires'))
  ;({ useDonneesStore } = await import('@/lib/administrateur-judiciaire/db/donnees-store'))
  ;({ repoNotifications } = await import('@/lib/administrateur-judiciaire/db/repositories'))
  ;({ viderBaseLocale } = await import('@/lib/administrateur-judiciaire/db/reset'))
  const { MODE_ACTIF } = await import('@/lib/administrateur-judiciaire/mode')
  expect(MODE_ACTIF).toBe('reel')
})

afterAll(() => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
})

beforeEach(async () => {
  await viderBaseLocale()
  useDonneesStore.setState({ loaded: false, erreur: null, notifications: [], coproprietes: [], prestataires: [] })
  window.history.replaceState(null, '', window.location.pathname)
})

afterEach(() => cleanup())

async function monterShell(): Promise<RenderResult> {
  let rendu: RenderResult | undefined
  await act(async () => {
    rendu = render(
      <ToastProvider>
        <Shell />
      </ToastProvider>,
    )
  })
  // Laisse le chargement de la base (déclenché en mode réel) se terminer.
  await act(async () => {
    await new Promise((resoudre) => setTimeout(resoudre, 50))
  })
  return rendu as RenderResult
}

const ouvrirCloche = async (rendu: RenderResult) => {
  const bouton = rendu.container.querySelector<HTMLButtonElement>('button[aria-label^="Voir les notifications"]')
  expect(bouton).not.toBeNull()
  await act(async () => {
    fireEvent.click(bouton as HTMLButtonElement)
  })
}

describe('Shell en mode réel — cloche de notifications', () => {
  it('base vide : aucune notification de démonstration, « Tout est à jour »', async () => {
    const rendu = await monterShell()
    await ouvrirCloche(rendu)
    const panneau = rendu.container.querySelector('.notifs-panel')
    expect(panneau?.textContent).toContain('Tout est à jour')
    expect(panneau?.querySelectorAll('.notifs-item')).toHaveLength(0)
    for (const notification of DEMO_NOTIFICATIONS) expect(panneau?.textContent).not.toContain(notification.title)
  })

  it('base avec une notification : c’est elle qui s’affiche, non lue', async () => {
    await repoNotifications.create(
      { kind: 'note', titre: 'Note réelle du cabinet', description: 'Détail', date: new Date(), lu: false, coproprieteId: null },
      { actor: null },
    )
    const rendu = await monterShell()
    await ouvrirCloche(rendu)
    const panneau = rendu.container.querySelector('.notifs-panel')
    expect(panneau?.querySelectorAll('.notifs-item')).toHaveLength(1)
    expect(panneau?.textContent).toContain('Note réelle du cabinet')
    expect(panneau?.textContent).toContain('1 non lue')
  })
})

describe('Shell en mode réel — formulaire « Nouvelle intervention »', () => {
  it('aucune copropriété ni aucun prestataire de démonstration dans les listes', async () => {
    const rendu = await monterShell()
    const bouton = Array.from(rendu.container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Nouvelle intervention'),
    )
    await act(async () => {
      fireEvent.click(bouton as HTMLButtonElement)
    })
    const options = Array.from(document.querySelectorAll('select option')).map((option) => option.textContent)
    for (const nom of DEMO_NOMS_COPROPRIETES) expect(options).not.toContain(nom)
    for (const prestataire of DEMO_PRESTATAIRES) expect(options).not.toContain(prestataire.nom)
  })
})

describe('Shell en mode réel — erreur de lecture de la base (T02)', () => {
  it('l’erreur de lecture est affichée au lieu d’être avalée', async () => {
    const rendu = await monterShell()
    await act(async () => {
      useDonneesStore.setState({ erreur: 'IndexedDB indisponible' })
    })
    const alerte = Array.from(rendu.container.querySelectorAll('[role="alert"]')).find((element) =>
      element.textContent?.includes('Lecture de la base impossible'),
    )
    expect(alerte?.textContent).toContain('IndexedDB indisponible')
  })
})
