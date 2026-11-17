/**
 * Coquille du tableau de bord BTP (pro_societe) : page app/(commun)/pro/dashboard/page.tsx montée sous jsdom au-delà de
 * son écran de chargement (banc tests/helpers/tableau-de-bord-pro-simule.ts). Lot « robustesse de la coquille » de
 * l'audit du 11/11/2026 ; chaque sujet vérifie aussi que le tableau de bord artisan est inchangé.
 *
 * - Fiche société au chargement (constats coquille-2, stockage-local-miroir-11, acces-session-4) : une lecture en échec
 *   (réseau, serveur) n'ouvre plus de société de secours « SARL » ; un écran dit que la société n'a pas pu être chargée
 *   et propose de réessayer, sans rien lire ni précharger sous un autre identifiant. Une fiche absente (aucune ligne)
 *   ouvre le tableau de bord comme avant, et un message clair le dit au compte de la société ; ni la démonstration
 *   (super_admin en vue BTP) ni un compte invité dans l'équipe d'une société (salarié ou co-gérant), qui n'a pas de
 *   fiche à lui, n'ont ce message.
 * - Adresse de section (?p=…) que la société ne peut pas ouvrir (coquille-9, coquille-14) : un identifiant inconnu ou un
 *   écran d'un autre métier ramène à l'accueil, l'adresse remplacée (Retour ne ramène pas sur l'adresse fautive).
 * - Filet d'erreur sur chaque écran (coquille-11) : une panne reste dans la zone de l'écran, sous un titre qui le nomme,
 *   et le menu comme l'en-tête restent affichés. Ce filet n'est posé que pour la société BTP, et seulement dans la zone
 *   centrale : l'assistant Fixy n'en a pas (l'affichage de sa panne reste à choisir).
 * - Organisation du menu (coquille-10) : la page donne à useModuleCategories l'identifiant de la fiche pour une société
 *   BTP (clé propre au compte), aucun pour l'artisan (clé commune, comportement inchangé).
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  toastError: vi.fn(),
  prefetchBTPTables: vi.fn(),
  seedDemoLocalStorage: vi.fn(),
  fetchDocumentsFromSupabase: vi.fn(async () => []),
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
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: vi.fn(), info: vi.fn() } }))
vi.mock('@/hooks/dashboard', async () => (await import('../helpers/tableau-de-bord-pro-simule')).moduleHooksDashboardSimule())
vi.mock('@/hooks/useDashboardMessaging', async () => ({ useDashboardMessaging: (await import('../helpers/tableau-de-bord-pro-simule')).hooksConfigurationSimules().useDashboardMessaging }))
vi.mock('@/hooks/useModulesConfig', async () => ({ useModulesConfig: (await import('../helpers/tableau-de-bord-pro-simule')).hooksConfigurationSimules().useModulesConfig }))
vi.mock('@/hooks/useModuleCategories', () => ({ useModuleCategories: mocks.useModuleCategories }))
vi.mock('@/hooks/usePermissions', async () => ({ usePermissions: (await import('../helpers/tableau-de-bord-pro-simule')).hooksConfigurationSimules().usePermissions }))
vi.mock('@/hooks/useNotifications', async () => ({ useNotifications: (await import('../helpers/tableau-de-bord-pro-simule')).hooksConfigurationSimules().useNotifications }))
vi.mock('@/lib/hooks/use-btp-data', () => ({ prefetchBTPTables: mocks.prefetchBTPTables }))
vi.mock('@/lib/bookings-fetch', () => ({ fetchAllBookings: vi.fn(async () => ({ data: [] })) }))
// page.tsx fusionne les documents de la base par fusionnerDocumentsDeLaBase(…, optionsFusionPourRole(role)) : les deux
// fonctions sont simulées, pour qu'un cas qui rend des documents ne bute pas sur un export absent de la simulation.
vi.mock('@/lib/document-sync', () => ({
  fetchDocumentsFromSupabase: mocks.fetchDocumentsFromSupabase,
  persistEmittedDocsToCache: vi.fn(),
  fusionnerDocumentsDeLaBase: vi.fn((_id: string, liste: unknown[]) => liste),
}))
vi.mock('@/lib/devis-utils', () => ({
  dedupeDocsByIdentity: (docs: unknown[]) => docs,
  optionsFusionPourRole: vi.fn(() => undefined),
}))
vi.mock('@/lib/seed-demo-localStorage', () => ({ seedDemoLocalStorage: mocks.seedDemoLocalStorage }))
vi.mock('@/lib/service-utils', () => ({ getPriceRangeLabel: vi.fn(), getPricingUnit: vi.fn(), getCleanDescription: vi.fn() }))
vi.mock('@/lib/messagerie-pro', () => ({ notificationOuvreMessagerie: vi.fn() }))

import DashboardPageWrapper from '@/app/(commun)/pro/dashboard/page'
import { proprietesRecues } from '../helpers/tableau-de-bord-pro-simule'

const FICHE = { id: 'fiche-1', user_id: 'compte-1', company_name: 'Société Exemple', legal_form: 'SAS' }
const ECHEC_RESEAU = { code: '', message: 'TypeError: Failed to fetch', details: '', hint: '' }
const AUCUNE_LIGNE = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows', hint: null }
const ECRAN_ECHEC = 'Impossible de charger votre société'
/** Démonstration : compte super_admin en vue BTP. */
const DEMONSTRATION = { _admin_override: true, _original_role: 'super_admin' }
/** Salarié invité dans l'équipe d'une société (app_metadata posé à l'acceptation de l'invitation). */
const SALARIE_INVITE = { pro_team_role: 'CHEF_CHANTIER', company_id: 'compte-gerant' }
/** Invité avec le rôle Gérant, ou promu Gérant ensuite : rattaché lui aussi à la société d'un autre compte. */
const CO_GERANT_INVITE = { pro_team_role: 'GERANT', company_id: 'compte-gerant' }

/** Compte connecté : rôle et autres métadonnées posées par le serveur (app_metadata). */
const utilisateur = (role: string, metadonnees: Record<string, unknown> = {}) => ({
  id: 'compte-1',
  email: 'gerant@example.com',
  app_metadata: { role, ...metadonnees },
  user_metadata: { company_name: 'Société Exemple' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
})

let lieu: LocationSimulee
let pushState: ReturnType<typeof vi.spyOn>
let replaceState: ReturnType<typeof vi.spyOn>

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Monte le tableau de bord pour `compte` à l'adresse `?{adresse}` ; la section dont le chargeur contient
 * `sectionQuiPlante` plante au rendu. Sans filet, cette panne remonte jusqu'à la racine (React démonte tout l'arbre et
 * act() la relance) : elle est rendue dans `panneRemontee`. Toute autre erreur fait échouer le test.
 */
async function ouvrir(compte: ReturnType<typeof utilisateur>, options: { adresse?: string; sectionQuiPlante?: string } = {}) {
  mocks.etat.recherche = options.adresse ?? ''
  mocks.etat.sectionQuiPlante = options.sectionQuiPlante ?? null
  mocks.getSession.mockResolvedValue({ data: { session: { user: compte, access_token: 'jeton' } }, error: null })
  let rendu: ReturnType<typeof render> | undefined
  let panneRemontee: unknown
  try {
    await act(async () => {
      rendu = render(<DashboardPageWrapper />)
      await attendre(30)
    })
  } catch (erreur) {
    if (!options.sectionQuiPlante) throw erreur
    panneRemontee = erreur
  }
  return { container: (rendu as ReturnType<typeof render>).container, panneRemontee }
}

/** Composants dynamiques rendus dans la zone centrale (repères `data-dynamique` du module next/dynamic simulé). */
function sectionsAffichees(container: HTMLElement): string[] {
  const zone = container.querySelector('main')
  return zone ? [...zone.querySelectorAll('[data-dynamique]')].map((e) => e.getAttribute('data-dynamique') ?? '') : []
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.rappels.length = 0
  mocks.etat.fiche = { data: FICHE, error: null }
  mocks.etat.proprietes.clear()
  mocks.useModuleCategories.mockReturnValue({ categories: [], setCategories: () => {} })
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

describe('tableau de bord BTP — fiche société au chargement', () => {
  it('lecture en échec : écran « impossible de charger » avec Réessayer, aucune société de secours ouverte', async () => {
    mocks.etat.fiche = { data: null, error: ECHEC_RESEAU }
    const { container } = await ouvrir(utilisateur('pro_societe'))

    expect(await screen.findByText(ECRAN_ECHEC)).toBeInTheDocument()
    // Rien n'est ouvert ni préchargé sous l'identifiant de connexion, aucune donnée de démonstration posée.
    expect(container.querySelector('#artisan-dashboard-v5')).toBeNull()
    expect(mocks.prefetchBTPTables).not.toHaveBeenCalled()
    expect(mocks.seedDemoLocalStorage).not.toHaveBeenCalled()
    expect(mocks.fetchDocumentsFromSupabase).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()

    // Si la panne dure, l'écran donne l'adresse de contact du site.
    expect(screen.getByRole('alert').textContent).toContain('contact@vitfix.io')

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(lieu.rechargements).toBe(1)
  })

  it('démonstration (super_admin en vue BTP), lecture en échec : son tableau de bord de démonstration, comme avant', async () => {
    mocks.etat.fiche = { data: null, error: ECHEC_RESEAU }
    const { container } = await ouvrir(utilisateur('pro_societe', DEMONSTRATION))

    await waitFor(() => expect(container.querySelector('#artisan-dashboard-v5')).not.toBeNull())
    expect(screen.queryByText(ECRAN_ECHEC)).toBeNull()
    expect(mocks.prefetchBTPTables).toHaveBeenCalledWith(expect.any(Array), 'compte-1')
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it.each([
    ['compte de la société', {}],
    // Son propre identifiant en company_id (écrit dans le compte du gérant par une version antérieure du serveur) :
    // c'est toujours le compte de la société elle-même.
    ['compte de la société portant son propre identifiant de société', { pro_team_role: 'GERANT', company_id: 'compte-1' }],
  ])('fiche absente, %s : le tableau de bord s’ouvre comme avant, et un message durable le signale', async (_cas, metadonnees) => {
    mocks.etat.fiche = { data: null, error: AUCUNE_LIGNE }
    const { container } = await ouvrir(utilisateur('pro_societe', metadonnees))

    await waitFor(() => expect(container.querySelector('#artisan-dashboard-v5')).not.toBeNull())
    // Même ouverture qu'avant : identifiant de connexion, documents du navigateur relus, données BTP préchargées.
    expect(mocks.prefetchBTPTables).toHaveBeenCalledWith(expect.any(Array), 'compte-1')
    expect(screen.queryByText(ECRAN_ECHEC)).toBeNull()
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
    const [message, options] = mocks.toastError.mock.calls[0]
    expect(message).toContain('Fiche société introuvable')
    expect(message).toContain('contact@vitfix.io')
    expect(options).toMatchObject({ duration: Infinity })
  })

  it.each([
    ['démonstration (super_admin en vue BTP)', DEMONSTRATION],
    // Il n'a pas de fiche à lui : rien à « rétablir », il garde l'ouverture d'avant (ce qu'il doit voir reste à décider).
    ['salarié invité dans une équipe', SALARIE_INVITE],
    // Même cas avec le rôle Gérant : c'est le rattachement à la société d'un autre compte qui compte, pas le rôle.
    ['co-gérant invité dans une équipe', CO_GERANT_INVITE],
  ])('%s sans fiche : tableau de bord ouvert comme avant, sans message', async (_cas, metadonnees) => {
    mocks.etat.fiche = { data: null, error: AUCUNE_LIGNE }
    const { container } = await ouvrir(utilisateur('pro_societe', metadonnees))

    await waitFor(() => expect(container.querySelector('#artisan-dashboard-v5')).not.toBeNull())
    expect(mocks.prefetchBTPTables).toHaveBeenCalledWith(expect.any(Array), 'compte-1')
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('fiche lue : ni écran d’erreur ni message', async () => {
    const { container } = await ouvrir(utilisateur('pro_societe'))

    await waitFor(() => expect(container.querySelector('#artisan-dashboard-v5')).not.toBeNull())
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(screen.queryByText(ECRAN_ECHEC)).toBeNull()
    expect(mocks.prefetchBTPTables).toHaveBeenCalledWith(expect.any(Array), 'compte-1')
  })

  it('artisan : fiche illisible → renvoi vers la connexion, comme avant (aucun écran BTP)', async () => {
    mocks.etat.fiche = { data: null, error: ECHEC_RESEAU }
    await ouvrir(utilisateur('artisan'))

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/fr/auth/login'))
    expect(screen.queryByText(ECRAN_ECHEC)).toBeNull()
    expect(mocks.toastError).not.toHaveBeenCalled()
  })
})

describe('tableau de bord BTP — adresse de section que la société ne peut pas ouvrir', () => {
  it.each([
    ['identifiant inconnu', 'facture'],
    ['écran de la conciergerie', 'proprietes'],
    ['écran du gestionnaire', 'missions'],
    ['chantiers de l’artisan', 'chantiers_v22'],
  ])('%s (?p=%s) : retour à l’accueil, adresse remplacée sans entrée d’historique', async (_cas, section) => {
    const { container } = await ouvrir(utilisateur('pro_societe'), { adresse: `p=${section}` })

    // Nom exporté ou module de la section rendue (le texte complet du chargeur est long).
    const noms = () => sectionsAffichees(container).map((s) => s.match(/mod\.(\w+)/)?.[1] ?? s.match(/dashboard\/(\w+)/)?.[1] ?? s)
    await waitFor(() => expect(noms()).toEqual(['HomeSection']))
    expect(replaceState).toHaveBeenCalledWith(expect.anything(), '', '/fr/pro/dashboard')
    expect(pushState).not.toHaveBeenCalled()
  })

  it('section BTP connue (?p=chantiers) : affichée telle quelle, adresse inchangée', async () => {
    const { container } = await ouvrir(utilisateur('pro_societe'), { adresse: 'p=chantiers' })

    expect(sectionsAffichees(container)).toEqual([expect.stringContaining('ChantiersBTPV2')])
    expect(replaceState).not.toHaveBeenCalled()
    expect(pushState).not.toHaveBeenCalled()
  })

  it('lien interne vers une section inconnue : l’accueil s’affiche, l’entrée ajoutée mène à l’accueil', async () => {
    const { container } = await ouvrir(utilisateur('pro_societe'))
    const navigateTo = proprietesRecues(mocks.etat, 'V5Sidebar')?.navigateTo as (page: string) => void
    expect(navigateTo).toBeTypeOf('function')

    act(() => { navigateTo('tarifs') })

    await waitFor(() => expect(replaceState).toHaveBeenCalledWith(expect.anything(), '', '/fr/pro/dashboard'))
    expect(pushState).toHaveBeenCalledTimes(1)
    expect(pushState).toHaveBeenCalledWith(expect.anything(), '', '/fr/pro/dashboard?p=tarifs')
    expect(sectionsAffichees(container)).toEqual([expect.stringContaining('HomeSection')])
  })

  it('artisan : adresse de section inconnue, ni redirection ni remplacement d’adresse (comme avant)', async () => {
    const { container } = await ouvrir(utilisateur('artisan'), { adresse: 'p=facture' })

    expect(sectionsAffichees(container)).toEqual([])
    expect(replaceState).not.toHaveBeenCalled()
    expect(pushState).not.toHaveBeenCalled()
  })
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
  // Écrans partagés avec l'artisan (et Canal Pro, ouvert à la société par son adresse).
  ['messages', 'MessagerieArtisan', 'Erreur dans la messagerie'],
  ['wallet', 'WalletConformiteSection', 'Erreur dans la conformité'],
  ['portfolio', 'CarnetDeVisiteSection', 'Erreur dans les références'],
  ['photos_chantier', 'PhotosChantierSection', 'Erreur dans les photos de chantier'],
  ['help', 'AideSection', 'Erreur dans l’aide'],
  ['canal', 'CanalProSection', 'Erreur dans le Canal Pro'],
]

describe('tableau de bord BTP — une panne d’écran reste dans son écran', () => {
  it.each(ECRANS_BTP)('%s : panne de %s → « %s », menu et en-tête toujours affichés', async (section, composant, titre) => {
    const { container, panneRemontee } = await ouvrir(utilisateur('pro_societe'), { adresse: `p=${section}`, sectionQuiPlante: composant })

    expect(panneRemontee).toBeUndefined()
    await waitFor(() => expect(screen.getByText(titre)).toBeInTheDocument())
    expect(container.querySelector('#artisan-dashboard-v5')).not.toBeNull()
    expect(container.querySelector('[data-dynamique*="V5Sidebar"]')).not.toBeNull()
    expect(container.querySelector('[data-dynamique*="V5Header"]')).not.toBeNull()
  })

  // Fixy est rendu hors de la zone centrale : un filet y poserait son cadre d'erreur dans la rangée du tableau de bord,
  // à côté de la zone centrale qu'il rétrécirait. Comment afficher une panne de Fixy reste à choisir ; d'ici là, rien
  // n'est ajouté autour de lui.
  it('assistant Fixy en panne : aucun filet ajouté hors de la zone centrale, la panne remonte comme avant', async () => {
    const { container, panneRemontee } = await ouvrir(utilisateur('pro_societe'), { sectionQuiPlante: 'AiChatBot' })

    expect((panneRemontee as Error | undefined)?.message).toBe('panne simulée de la section')
    expect(screen.queryByText('Erreur dans l’assistant Fixy')).toBeNull()
    expect(container.querySelector('#artisan-dashboard-v5')).toBeNull()
  })

  it.each([
    ['aide', 'help', 'AideSection', 'Erreur dans l’aide'],
    ['écran propre au BTP ouvert par son adresse', 'chantiers', 'ChantiersBTPV2', 'Erreur dans les chantiers'],
  ])('artisan, %s en panne : aucun filet ajouté, la panne remonte comme avant', async (_cas, section, composant, titre) => {
    const { container, panneRemontee } = await ouvrir(utilisateur('artisan'), { adresse: `p=${section}`, sectionQuiPlante: composant })

    expect((panneRemontee as Error | undefined)?.message).toBe('panne simulée de la section')
    expect(screen.queryByText(titre)).toBeNull()
    expect(container.querySelector('#artisan-dashboard-v5')).toBeNull()
  })
})

describe('tableau de bord — identifiant donné à l’organisation du menu', () => {
  /** Identifiant de compte donné au dernier appel de useModuleCategories. */
  const dernierIdentifiant = () => mocks.useModuleCategories.mock.calls.at(-1)?.[1]

  it('société BTP : l’organisation du menu est rangée sous l’identifiant de sa fiche', async () => {
    await ouvrir(utilisateur('pro_societe'))
    expect(dernierIdentifiant()).toBe('fiche-1')
  })

  it('artisan : aucun identifiant, la clé commune reste celle d’avant', async () => {
    await ouvrir(utilisateur('artisan'))
    expect(mocks.useModuleCategories).toHaveBeenCalled()
    expect(mocks.useModuleCategories.mock.calls.every((appel) => appel[1] === undefined)).toBe(true)
  })
})
