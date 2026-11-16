/**
 * Tableau de bord BTP (pro_societe) : filet d'erreur sur chaque écran (constat coquille-11 de l'audit du 11/11/2026).
 * Sans filet, une panne d'un écran (Chantiers, Équipes, Pointage…) remplaçait tout le tableau de bord, menu compris,
 * par la page d'erreur générale. Désormais la panne reste dans la zone de l'écran, sous un titre qui le nomme, et le
 * reste du tableau de bord (menu, en-tête) reste affiché. Les écrans partagés avec l'artisan ne reçoivent ce filet que
 * pour la société BTP : le tableau de bord artisan est inchangé.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { simulerLocation, type LocationSimulee } from '../helpers/simulations-dashboard'

const mocks = vi.hoisted(() => ({
  etat: { fiche: { data: null, error: null } as { data: unknown; error: unknown }, sectionQuiPlante: null as string | null, recherche: '' },
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

const utilisateur = (role: string) => ({
  id: 'compte-1',
  email: 'gerant@example.com',
  app_metadata: { role },
  user_metadata: { company_name: 'Société Exemple' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
})

let lieu: LocationSimulee

async function ouvrir(role: string, section: string, composantQuiPlante: string) {
  mocks.etat.recherche = section === 'home' ? '' : `p=${section}`
  mocks.etat.sectionQuiPlante = composantQuiPlante
  mocks.getSession.mockResolvedValue({ data: { session: { user: utilisateur(role), access_token: 'jeton' } }, error: null })
  let rendu: ReturnType<typeof render> | undefined
  // Sans filet, la panne remonte jusqu'à la racine : React démonte tout l'arbre et act() la relance.
  let panneRemontee: unknown
  try {
    await act(async () => {
      rendu = render(<DashboardPageWrapper />)
      await new Promise((r) => setTimeout(r, 30))
    })
  } catch (erreur) {
    panneRemontee = erreur
  }
  return { container: (rendu as ReturnType<typeof render>).container, panneRemontee }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rappels.length = 0
  mocks.etat.fiche = { data: { id: 'fiche-1', user_id: 'compte-1', company_name: 'Société Exemple', legal_form: 'SAS' }, error: null }
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  lieu = simulerLocation('/fr/pro/dashboard/')
})

afterEach(() => {
  vi.restoreAllMocks()
  lieu.restaurer()
})

const ECRANS_BTP: Array<[string, string, string]> = [
  ['equipes', 'EquipesBTPV2', 'Erreur dans les équipes'],
  ['chantiers', 'ChantiersBTPV2', 'Erreur dans les chantiers'],
  ['gantt', 'GanttSection', 'Erreur dans le planning Gantt'],
  ['situations', 'SituationsTravaux', 'Erreur dans les situations de travaux'],
  ['garanties', 'RetenuesGarantieSection', 'Erreur dans les retenues de garantie'],
  ['pointage', 'PointageGeoSection', 'Erreur dans le pointage'],
  ['sous_traitance', 'SousTraitanceDC4Section', 'Erreur dans la sous-traitance'],
  ['rentabilite', 'RentabiliteChantierSection', 'Erreur dans la rentabilité'],
  ['compta_btp', 'ComptaBTPSection', 'Erreur dans la comptabilité IA'],
  ['sous_traitance_offres', 'SousTraitanceOffresSection', 'Erreur dans le recrutement de sous-traitants'],
  ['dpgf', 'DPGFSection', 'Erreur dans les appels d’offres'],
  // Écrans partagés avec l'artisan : filet posé pour la société BTP seulement.
  ['messages', 'MessagerieArtisan', 'Erreur dans la messagerie'],
  ['wallet', 'WalletConformiteSection', 'Erreur dans la conformité'],
  ['portfolio', 'CarnetDeVisiteSection', 'Erreur dans les références'],
  ['photos_chantier', 'PhotosChantierSection', 'Erreur dans les photos de chantier'],
  ['help', 'AideSection', 'Erreur dans l’aide'],
]

describe('tableau de bord BTP — une panne d’écran reste dans son écran', () => {
  it.each(ECRANS_BTP)('%s : panne de %s → « %s », menu et en-tête toujours affichés', async (section, composant, titre) => {
    const { container, panneRemontee } = await ouvrir('pro_societe', section, composant)

    expect(panneRemontee).toBeUndefined()
    await waitFor(() => expect(screen.getByText(titre)).toBeInTheDocument())
    expect(container.querySelector('#artisan-dashboard-v5')).not.toBeNull()
    expect(container.querySelector('[data-dynamique*="V5Sidebar"]')).not.toBeNull()
    expect(container.querySelector('[data-dynamique*="V5Header"]')).not.toBeNull()
  })

  it('assistant Fixy en panne : son filet le dit, l’accueil reste affiché', async () => {
    const { container, panneRemontee } = await ouvrir('pro_societe', 'home', 'AiChatBot')

    expect(panneRemontee).toBeUndefined()
    await waitFor(() => expect(screen.getByText('Erreur dans l’assistant Fixy')).toBeInTheDocument())
    expect(container.querySelector('main [data-dynamique*="HomeSection"]')).not.toBeNull()
  })
})

describe('tableau de bord artisan — aucun filet ajouté', () => {
  it('aide en panne : pas de filet BTP, la panne remonte comme avant', async () => {
    const { container, panneRemontee } = await ouvrir('artisan', 'help', 'AideSection')

    expect((panneRemontee as Error | undefined)?.message).toBe('panne simulée de la section')
    expect(screen.queryByText('Erreur dans l’aide')).toBeNull()
    expect(container.querySelector('#artisan-dashboard-v5')).toBeNull()
  })
})
