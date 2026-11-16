/**
 * Tableau de bord BTP (pro_societe) : adresse de section (?p=…) que la société ne peut pas ouvrir (constats coquille-9
 * et coquille-14 de l'audit du 11/11/2026). Un identifiant inconnu laissait la zone centrale vide ; un écran d'un
 * autre métier (conciergerie, gestionnaire, chantiers de l'artisan) s'ouvrait par son adresse. La société revient
 * désormais à l'accueil, l'adresse remplacée (le bouton Retour ne ramène pas sur l'adresse fautive). L'artisan est
 * inchangé.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { simulerLocation, type LocationSimulee } from '../helpers/simulations-dashboard'

const mocks = vi.hoisted(() => ({
  etat: {
    fiche: { data: null, error: null } as { data: unknown; error: unknown },
    sectionQuiPlante: null as string | null,
    recherche: '',
    proprietes: new Map<string, Record<string, unknown>>(),
  },
  getSession: vi.fn(),
  rappels: [] as Array<(event: string, session: unknown) => unknown>,
  push: vi.fn(),
}))

vi.mock('@/lib/supabase', async () => {
  const { moduleSupabaseSimule } = await import('../helpers/simulations-dashboard')
  const { fromSimule } = await import('../helpers/tableau-de-bord-pro-simule')
  return moduleSupabaseSimule({ auth: { getSession: mocks.getSession, signOut: vi.fn() }, rappels: mocks.rappels, from: fromSimule(mocks.etat) })
})
vi.mock('next/navigation', async () => (await import('../helpers/tableau-de-bord-pro-simule')).moduleNavigationSimule(mocks.etat, mocks.push))
vi.mock('next/dynamic', async () => (await import('../helpers/tableau-de-bord-pro-simule')).moduleDynamicSimule(mocks.etat))
vi.mock('@/lib/i18n/context', async () => (await import('../helpers/simulations-dashboard')).moduleI18nSimule())
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/hooks/dashboard', async () => (await import('../helpers/tableau-de-bord-pro-simule')).moduleHooksDashboardSimule())
vi.mock('@/hooks/useDashboardMessaging', async () => ({ useDashboardMessaging: (await import('../helpers/tableau-de-bord-pro-simule')).hooksConfigurationSimules().useDashboardMessaging }))
vi.mock('@/hooks/useModulesConfig', async () => ({ useModulesConfig: (await import('../helpers/tableau-de-bord-pro-simule')).hooksConfigurationSimules().useModulesConfig }))
vi.mock('@/hooks/useModuleCategories', () => ({ useModuleCategories: () => ({ categories: [], setCategories: () => {} }) }))
vi.mock('@/hooks/usePermissions', async () => ({ usePermissions: (await import('../helpers/tableau-de-bord-pro-simule')).hooksConfigurationSimules().usePermissions }))
vi.mock('@/hooks/useNotifications', async () => ({ useNotifications: (await import('../helpers/tableau-de-bord-pro-simule')).hooksConfigurationSimules().useNotifications }))
vi.mock('@/lib/hooks/use-btp-data', () => ({ prefetchBTPTables: vi.fn() }))
vi.mock('@/lib/bookings-fetch', () => ({ fetchAllBookings: vi.fn(async () => ({ data: [] })) }))
vi.mock('@/lib/document-sync', () => ({ fetchDocumentsFromSupabase: vi.fn(async () => []), persistEmittedDocsToCache: vi.fn() }))
vi.mock('@/lib/devis-utils', () => ({ dedupeDocsByIdentity: (docs: unknown[]) => docs }))
vi.mock('@/lib/seed-demo-localStorage', () => ({ seedDemoLocalStorage: vi.fn() }))
vi.mock('@/lib/service-utils', () => ({ getPriceRangeLabel: vi.fn(), getPricingUnit: vi.fn(), getCleanDescription: vi.fn() }))
vi.mock('@/lib/messagerie-pro', () => ({ notificationOuvreMessagerie: vi.fn() }))

import DashboardPageWrapper from '@/app/(commun)/pro/dashboard/page'
import { proprietesRecues } from '../helpers/tableau-de-bord-pro-simule'

const FICHE = { id: 'fiche-1', user_id: 'compte-1', company_name: 'Société Exemple', legal_form: 'SAS' }
const utilisateur = (role: string) => ({
  id: 'compte-1',
  email: 'gerant@example.com',
  app_metadata: { role },
  user_metadata: { company_name: 'Société Exemple' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
})

let lieu: LocationSimulee
let pushState: ReturnType<typeof vi.spyOn>
let replaceState: ReturnType<typeof vi.spyOn>

/** Composants dynamiques rendus dans la zone centrale (repères `data-dynamique` du module next/dynamic simulé). */
function sectionsAffichees(container: HTMLElement): string[] {
  const zone = container.querySelector('main')
  return zone ? [...zone.querySelectorAll('[data-dynamique]')].map((e) => e.getAttribute('data-dynamique') ?? '') : []
}

async function ouvrir(role: string, adresse: string) {
  mocks.etat.recherche = adresse
  mocks.getSession.mockResolvedValue({ data: { session: { user: utilisateur(role), access_token: 'jeton' } }, error: null })
  const rendu = render(<DashboardPageWrapper />)
  await waitFor(() => expect(rendu.container.querySelector('main')).not.toBeNull())
  await act(async () => { await new Promise((r) => setTimeout(r, 10)) })
  return rendu
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rappels.length = 0
  mocks.etat.fiche = { data: FICHE, error: null }
  mocks.etat.proprietes.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  pushState = vi.spyOn(window.history, 'pushState')
  replaceState = vi.spyOn(window.history, 'replaceState')
  lieu = simulerLocation('/fr/pro/dashboard/')
})

afterEach(() => {
  vi.restoreAllMocks()
  lieu.restaurer()
})

describe('tableau de bord BTP — adresse de section que la société ne peut pas ouvrir', () => {
  it.each([
    ['identifiant inconnu', 'facture'],
    ['écran de la conciergerie', 'proprietes'],
    ['écran du gestionnaire', 'missions'],
    ['chantiers de l’artisan', 'chantiers_v22'],
  ])('%s (?p=%s) : retour à l’accueil, adresse remplacée sans entrée d’historique', async (_cas, section) => {
    const { container } = await ouvrir('pro_societe', `p=${section}`)

    // Nom exporté ou module de la section rendue (le texte complet du chargeur est long).
    const noms = () => sectionsAffichees(container).map((s) => s.match(/mod\.(\w+)/)?.[1] ?? s.match(/dashboard\/(\w+)/)?.[1] ?? s)
    await waitFor(() => expect(noms()).toEqual(['HomeSection']))
    expect(replaceState).toHaveBeenCalledWith(expect.anything(), '', '/fr/pro/dashboard')
    expect(pushState).not.toHaveBeenCalled()
  })

  it('section BTP connue (?p=chantiers) : affichée telle quelle, adresse inchangée', async () => {
    const { container } = await ouvrir('pro_societe', 'p=chantiers')

    expect(sectionsAffichees(container)).toEqual([expect.stringContaining('ChantiersBTPV2')])
    expect(replaceState).not.toHaveBeenCalled()
    expect(pushState).not.toHaveBeenCalled()
  })

  it('lien interne vers une section inconnue : l’accueil s’affiche, l’entrée ajoutée mène à l’accueil', async () => {
    const { container } = await ouvrir('pro_societe', '')
    const navigateTo = proprietesRecues(mocks.etat, 'V5Sidebar')?.navigateTo as (page: string) => void
    expect(navigateTo).toBeTypeOf('function')

    act(() => { navigateTo('tarifs') })

    await waitFor(() => expect(replaceState).toHaveBeenCalledWith(expect.anything(), '', '/fr/pro/dashboard'))
    expect(pushState).toHaveBeenCalledTimes(1)
    expect(pushState).toHaveBeenCalledWith(expect.anything(), '', '/fr/pro/dashboard?p=tarifs')
    expect(sectionsAffichees(container)).toEqual([expect.stringContaining('HomeSection')])
  })
})

describe('tableau de bord artisan — inchangé', () => {
  it('adresse de section inconnue : ni redirection ni remplacement d’adresse (comme avant)', async () => {
    const { container } = await ouvrir('artisan', 'p=facture')

    expect(sectionsAffichees(container)).toEqual([])
    expect(replaceState).not.toHaveBeenCalled()
    expect(pushState).not.toHaveBeenCalled()
  })
})
