// CRM du secrétariat : bouton « Installer l'application » (components/crm/BoutonInstaller.tsx, installation.ts).
// L'événement beforeinstallprompt de Chrome et Edge est simulé ; le navigateur n'est pas installé pour de vrai.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TEXTES_CRM } from '@/lib/crm/libelles'

const h = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('sonner', () => ({ toast: h.toast }))

const { BoutonInstaller } = await import('@/components/crm/BoutonInstaller')

type Reponse = 'accepted' | 'dismissed'

/** Événement tel que l'émet Chrome quand la page est installable. */
function proposerInstallation(reponse: Reponse = 'accepted', prompt = vi.fn(async () => {})) {
  const evenement = new Event('beforeinstallprompt', { cancelable: true })
  Object.assign(evenement, { prompt, userChoice: Promise.resolve({ outcome: reponse }) })
  act(() => {
    window.dispatchEvent(evenement)
  })
  return { evenement, prompt }
}

/** Poste simulé : souris (pointer: fine) sur ordinateur, doigt (pointer: coarse) sur téléphone. jsdom n'a pas matchMedia. */
function simulerPoste(pointeurFin: boolean) {
  window.matchMedia = vi.fn((requete: string) => ({
    matches: requete === '(pointer: fine)' ? pointeurFin : false,
    media: requete,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })) as unknown as typeof window.matchMedia
}

const matchMediaOrigine = window.matchMedia

beforeEach(() => {
  simulerPoste(true)
})

afterEach(() => {
  // Oublie tout événement gardé d'un test à l'autre.
  act(() => {
    window.dispatchEvent(new Event('appinstalled'))
  })
  window.matchMedia = matchMediaOrigine
  Reflect.deleteProperty(navigator, 'userAgentData')
  vi.clearAllMocks()
})

describe('bouton « Installer l’application » du CRM', () => {
  it('n’apparaît pas tant que le navigateur ne propose pas l’installation', () => {
    render(<BoutonInstaller textes={TEXTES_CRM.fr} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('ignore un événement sans fenêtre d’installation (navigateur qui ne sait pas installer)', () => {
    render(<BoutonInstaller textes={TEXTES_CRM.fr} />)
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('apparaît quand Chrome ou Edge propose l’installation, et retient la bannière du navigateur', () => {
    render(<BoutonInstaller textes={TEXTES_CRM.fr} />)
    const { evenement } = proposerInstallation()
    expect(evenement.defaultPrevented).toBe(true)
    expect(screen.getByRole('button', { name: 'Installer l’application' })).toBeTruthy()
  })

  it('ouvre la fenêtre d’installation du navigateur, une seule fois, puis disparaît', async () => {
    render(<BoutonInstaller textes={TEXTES_CRM.fr} />)
    const { prompt } = proposerInstallation('accepted')
    fireEvent.click(screen.getByRole('button', { name: 'Installer l’application' }))
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith(TEXTES_CRM.fr.installation.reussie))
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('installation refusée : aucun message de réussite, bouton retiré jusqu’au prochain chargement', async () => {
    render(<BoutonInstaller textes={TEXTES_CRM.fr} />)
    const { prompt } = proposerInstallation('dismissed')
    fireEvent.click(screen.getByRole('button', { name: 'Installer l’application' }))
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(h.toast.success).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('fenêtre d’installation qui échoue : message d’erreur, rien d’autre', async () => {
    render(<BoutonInstaller textes={TEXTES_CRM.fr} />)
    proposerInstallation('accepted', vi.fn(async () => Promise.reject(new Error('NotAllowedError'))))
    fireEvent.click(screen.getByRole('button', { name: 'Installer l’application' }))
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(TEXTES_CRM.fr.installation.impossible))
    expect(h.toast.success).not.toHaveBeenCalled()
  })

  it('disparaît quand l’application est installée autrement (menu du navigateur)', () => {
    render(<BoutonInstaller textes={TEXTES_CRM.fr} />)
    proposerInstallation()
    expect(screen.getByRole('button')).toBeTruthy()
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('sur un téléphone (écran tactile), aucun bouton : le texte parle du bureau d’un ordinateur', () => {
    simulerPoste(false)
    render(<BoutonInstaller textes={TEXTES_CRM.fr} />)
    const { evenement } = proposerInstallation()
    expect(evenement.defaultPrevented).toBe(true)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('navigateur qui se déclare mobile (tablette avec souris) : aucun bouton', () => {
    Object.defineProperty(navigator, 'userAgentData', { value: { mobile: true }, configurable: true })
    render(<BoutonInstaller textes={TEXTES_CRM.fr} />)
    proposerInstallation()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('suit la langue de l’écran', () => {
    render(<BoutonInstaller textes={TEXTES_CRM.pt} />)
    proposerInstallation()
    const bouton = screen.getByRole('button', { name: 'Instalar a aplicação' })
    expect(bouton.getAttribute('title')).toBe(TEXTES_CRM.pt.installation.aide)
  })
})
