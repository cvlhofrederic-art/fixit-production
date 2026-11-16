/**
 * Tableau de bord BTP (pro_societe) : lecture de la fiche société au chargement (constats coquille-2,
 * stockage-local-miroir-11, acces-session-4 de l'audit du 11/11/2026).
 *
 * - Lecture en échec (réseau, serveur) : plus de tableau de bord ouvert sur une société de secours « SARL » ; un écran
 *   dit que la société n'a pas pu être chargée et propose de réessayer. Rien n'est lu ni préchargé sous un autre
 *   identifiant.
 * - Fiche absente (aucune ligne) : le tableau de bord s'ouvre comme avant (mêmes clés, documents existants visibles),
 *   mais un message clair le dit au lieu de le taire. Le compte de démonstration (super_admin en vue BTP) n'a pas ce
 *   message.
 * - Artisan : comportement inchangé (renvoi vers la connexion sans fiche lisible).
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { simulerLocation, type LocationSimulee } from '../helpers/simulations-dashboard'

const mocks = vi.hoisted(() => ({
  etat: { fiche: { data: null, error: null } as { data: unknown; error: unknown }, sectionQuiPlante: null as string | null, recherche: '' },
  getSession: vi.fn(),
  rappels: [] as Array<(event: string, session: unknown) => unknown>,
  push: vi.fn(),
  toastError: vi.fn(),
  prefetchBTPTables: vi.fn(),
  seedDemoLocalStorage: vi.fn(),
  fetchDocumentsFromSupabase: vi.fn(async () => []),
}))

vi.mock('@/lib/supabase', async () => {
  const { moduleSupabaseSimule } = await import('../helpers/simulations-dashboard')
  const { fromSimule } = await import('../helpers/tableau-de-bord-pro-simule')
  return moduleSupabaseSimule({ auth: { getSession: mocks.getSession, signOut: vi.fn() }, rappels: mocks.rappels, from: fromSimule(mocks.etat) })
})
vi.mock('next/navigation', async () => (await import('../helpers/tableau-de-bord-pro-simule')).moduleNavigationSimule(mocks.etat, mocks.push))
vi.mock('next/dynamic', async () => (await import('../helpers/tableau-de-bord-pro-simule')).moduleDynamicSimule(mocks.etat))
vi.mock('@/lib/i18n/context', async () => (await import('../helpers/simulations-dashboard')).moduleI18nSimule())
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: vi.fn(), info: vi.fn() } }))
vi.mock('@/hooks/dashboard', async () => (await import('../helpers/tableau-de-bord-pro-simule')).moduleHooksDashboardSimule())
vi.mock('@/hooks/useDashboardMessaging', async () => ({ useDashboardMessaging: (await import('../helpers/tableau-de-bord-pro-simule')).hooksConfigurationSimules().useDashboardMessaging }))
vi.mock('@/hooks/useModulesConfig', async () => ({ useModulesConfig: (await import('../helpers/tableau-de-bord-pro-simule')).hooksConfigurationSimules().useModulesConfig }))
vi.mock('@/hooks/useModuleCategories', () => ({ useModuleCategories: () => ({ categories: [], setCategories: () => {} }) }))
vi.mock('@/hooks/usePermissions', async () => ({ usePermissions: (await import('../helpers/tableau-de-bord-pro-simule')).hooksConfigurationSimules().usePermissions }))
vi.mock('@/hooks/useNotifications', async () => ({ useNotifications: (await import('../helpers/tableau-de-bord-pro-simule')).hooksConfigurationSimules().useNotifications }))
vi.mock('@/lib/hooks/use-btp-data', () => ({ prefetchBTPTables: mocks.prefetchBTPTables }))
vi.mock('@/lib/bookings-fetch', () => ({ fetchAllBookings: vi.fn(async () => ({ data: [] })) }))
vi.mock('@/lib/document-sync', () => ({ fetchDocumentsFromSupabase: mocks.fetchDocumentsFromSupabase, persistEmittedDocsToCache: vi.fn() }))
vi.mock('@/lib/devis-utils', () => ({ dedupeDocsByIdentity: (docs: unknown[]) => docs }))
vi.mock('@/lib/seed-demo-localStorage', () => ({ seedDemoLocalStorage: mocks.seedDemoLocalStorage }))
vi.mock('@/lib/service-utils', () => ({ getPriceRangeLabel: vi.fn(), getPricingUnit: vi.fn(), getCleanDescription: vi.fn() }))
vi.mock('@/lib/messagerie-pro', () => ({ notificationOuvreMessagerie: vi.fn() }))

import DashboardPageWrapper from '@/app/(commun)/pro/dashboard/page'

const COMPTE_BTP = {
  id: 'compte-btp-1',
  email: 'gerant@example.com',
  app_metadata: { role: 'pro_societe' },
  user_metadata: { company_name: 'Société Exemple' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
}
const ECHEC_RESEAU = { code: '', message: 'TypeError: Failed to fetch', details: '', hint: '' }
const AUCUNE_LIGNE = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows', hint: null }

let lieu: LocationSimulee

function ouvrir(utilisateur: Record<string, unknown>) {
  mocks.getSession.mockResolvedValue({ data: { session: { user: utilisateur, access_token: 'jeton' } }, error: null })
  return render(<DashboardPageWrapper />)
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rappels.length = 0
  mocks.etat.fiche = { data: null, error: null }
  mocks.etat.sectionQuiPlante = null
  mocks.etat.recherche = ''
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  lieu = simulerLocation('/fr/pro/dashboard/')
})

afterEach(() => {
  vi.restoreAllMocks()
  lieu.restaurer()
})

describe('tableau de bord BTP — fiche société au chargement', () => {
  it('lecture en échec : écran « impossible de charger » avec Réessayer, aucune société de secours ouverte', async () => {
    mocks.etat.fiche = { data: null, error: ECHEC_RESEAU }
    const { container } = ouvrir(COMPTE_BTP)

    expect(await screen.findByText('Impossible de charger votre société')).toBeInTheDocument()
    // Rien n'est ouvert ni préchargé sous l'identifiant de connexion, aucune donnée de démonstration posée.
    expect(container.querySelector('#artisan-dashboard-v5')).toBeNull()
    expect(mocks.prefetchBTPTables).not.toHaveBeenCalled()
    expect(mocks.seedDemoLocalStorage).not.toHaveBeenCalled()
    expect(mocks.fetchDocumentsFromSupabase).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(lieu.rechargements).toBe(1)
  })

  it('fiche absente : le tableau de bord s’ouvre comme avant, et un message durable le signale', async () => {
    mocks.etat.fiche = { data: null, error: AUCUNE_LIGNE }
    const { container } = ouvrir(COMPTE_BTP)

    await waitFor(() => expect(container.querySelector('#artisan-dashboard-v5')).not.toBeNull())
    // Même ouverture qu'avant : identifiant de connexion, documents du navigateur relus, données BTP préchargées.
    expect(mocks.prefetchBTPTables).toHaveBeenCalledWith(expect.any(Array), 'compte-btp-1')
    expect(screen.queryByText('Impossible de charger votre société')).toBeNull()
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
    const [message, options] = mocks.toastError.mock.calls[0]
    expect(message).toContain('Fiche société introuvable')
    expect(message).toContain('contact@vitfix.io')
    expect(options).toMatchObject({ duration: Infinity })
  })

  it('démonstration (super_admin en vue BTP) sans fiche : tableau de bord de démonstration, sans message', async () => {
    mocks.etat.fiche = { data: null, error: AUCUNE_LIGNE }
    const { container } = ouvrir({ ...COMPTE_BTP, app_metadata: { role: 'pro_societe', _admin_override: true, _original_role: 'super_admin' } })

    await waitFor(() => expect(container.querySelector('#artisan-dashboard-v5')).not.toBeNull())
    await act(async () => { await attendre(10) })
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('fiche lue : ni écran d’erreur ni message', async () => {
    mocks.etat.fiche = { data: { id: 'fiche-1', user_id: 'compte-btp-1', company_name: 'Société Exemple', legal_form: 'SAS' }, error: null }
    const { container } = ouvrir(COMPTE_BTP)

    await waitFor(() => expect(container.querySelector('#artisan-dashboard-v5')).not.toBeNull())
    await act(async () => { await attendre(10) })
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(screen.queryByText('Impossible de charger votre société')).toBeNull()
    expect(mocks.prefetchBTPTables).toHaveBeenCalledWith(expect.any(Array), 'compte-btp-1')
  })

  it('artisan : fiche illisible → renvoi vers la connexion, comme avant (aucun écran BTP)', async () => {
    mocks.etat.fiche = { data: null, error: ECHEC_RESEAU }
    ouvrir({ ...COMPTE_BTP, app_metadata: { role: 'artisan' } })

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/fr/auth/login'))
    expect(screen.queryByText('Impossible de charger votre société')).toBeNull()
    expect(mocks.toastError).not.toHaveBeenCalled()
  })
})
