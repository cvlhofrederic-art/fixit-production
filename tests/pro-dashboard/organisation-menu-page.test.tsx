/**
 * Tableau de bord pro : la page donne à useModuleCategories l'identifiant de la fiche pour une société BTP (clé
 * d'organisation du menu propre au compte, constat coquille-10), et aucun identifiant pour l'artisan (clé commune,
 * comportement inchangé).
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { simulerLocation, type LocationSimulee } from '../helpers/simulations-dashboard'

const mocks = vi.hoisted(() => ({
  etat: { fiche: { data: null, error: null } as { data: unknown; error: unknown }, sectionQuiPlante: null as string | null, recherche: '' },
  getSession: vi.fn(),
  rappels: [] as Array<(event: string, session: unknown) => unknown>,
  push: vi.fn(),
  useModuleCategories: vi.fn(),
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
vi.mock('@/hooks/useModuleCategories', () => ({ useModuleCategories: mocks.useModuleCategories }))
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

const CATEGORIES = { categories: [], setCategories: () => {} }
const utilisateur = (role: string) => ({
  id: 'compte-1',
  email: 'gerant@example.com',
  app_metadata: { role },
  user_metadata: { company_name: 'Société Exemple' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
})

let lieu: LocationSimulee

async function ouvrir(role: string) {
  mocks.getSession.mockResolvedValue({ data: { session: { user: utilisateur(role), access_token: 'jeton' } }, error: null })
  const rendu = render(<DashboardPageWrapper />)
  await waitFor(() => expect(rendu.container.querySelector('main')).not.toBeNull())
  await act(async () => { await new Promise((r) => setTimeout(r, 10)) })
  return rendu
}

/** Identifiant de compte donné au dernier appel de useModuleCategories. */
const dernierIdentifiant = () => mocks.useModuleCategories.mock.calls.at(-1)?.[1]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rappels.length = 0
  mocks.etat.fiche = { data: { id: 'fiche-1', user_id: 'compte-1', company_name: 'Société Exemple', legal_form: 'SAS' }, error: null }
  mocks.useModuleCategories.mockReturnValue(CATEGORIES)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  lieu = simulerLocation('/fr/pro/dashboard/')
})

afterEach(() => {
  vi.restoreAllMocks()
  lieu.restaurer()
})

describe('tableau de bord — organisation du menu', () => {
  it('société BTP : l’organisation du menu est rangée sous l’identifiant de sa fiche', async () => {
    await ouvrir('pro_societe')
    expect(dernierIdentifiant()).toBe('fiche-1')
  })

  it('artisan : aucun identifiant, la clé commune reste celle d’avant', async () => {
    await ouvrir('artisan')
    expect(mocks.useModuleCategories).toHaveBeenCalled()
    expect(mocks.useModuleCategories.mock.calls.every((appel) => appel[1] === undefined)).toBe(true)
  })
})
