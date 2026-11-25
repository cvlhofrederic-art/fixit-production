/**
 * Tableau de bord pro (app/(commun)/pro/dashboard/page.tsx) monté sous jsdom au-delà de son écran de chargement :
 * - lecture de la fiche société (`profiles_artisan … .single()`) pilotée par le test ;
 * - hooks du tableau de bord neutralisés, avec des fonctions espionnes stables (mêmes objets à chaque rendu) ;
 * - sections, barres et assistant chargés par next/dynamic remplacés par des composants vides — ou par un composant
 *   qui plante au rendu, pour éprouver les filets d'erreur (`sectionQuiPlante` : fragment de son chemin d'import).
 * À appeler depuis une fabrique de vi.mock, par import dynamique (comme tests/helpers/simulations-dashboard.ts).
 */
import { createElement } from 'react'
import { vi } from 'vitest'

export interface EtatTableauDeBordSimule {
  /** Réponse de la lecture de la fiche société. */
  fiche: { data: unknown; error: unknown }
  /** Fragment du chemin d'import de la section (next/dynamic) qui doit planter au rendu ; null : aucune. */
  sectionQuiPlante: string | null
  /** Paramètres d'adresse de la page (ex. `p=chantiers`). */
  recherche: string
  /** Dernières propriétés reçues par chaque composant chargé par next/dynamic, rangées par son chargeur. */
  proprietes?: Map<string, Record<string, unknown>>
}

/**
 * `supabase.from` simulé : fiche société lue dans l'état, autres lectures et mises à jour vides. Comme le vrai client,
 * une requête s'attend directement (`await`, `.then()`) : chacune est ici une vraie promesse, augmentée de `single()`
 * pour la lecture (pas d'objet maison portant `then`).
 */
export function fromSimule(etat: EtatTableauDeBordSimule) {
  return vi.fn((table: string) => ({
    select: () => ({
      eq: () => Object.assign(Promise.resolve({ data: [], error: null }), {
        single: async () => (table === 'profiles_artisan' ? etat.fiche : { data: null, error: null }),
      }),
    }),
    // La page lance la mise à jour de last_seen_at par un `.then()` sans argument.
    update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
  }))
}

/**
 * Module next/dynamic simulé : chaque composant rend un repère vide `data-dynamique` portant le texte de son chargeur
 * (chemin d'import, nom exporté), sauf celui dont le chargeur contient `sectionQuiPlante`, qui plante au rendu.
 */
export function moduleDynamicSimule(etat: EtatTableauDeBordSimule) {
  return {
    default: (chargeur: () => unknown) => {
      const source = String(chargeur)
      return function ComposantDynamiqueSimule(props: Record<string, unknown>) {
        etat.proprietes?.set(source, props)
        if (etat.sectionQuiPlante && source.includes(etat.sectionQuiPlante)) throw new Error('panne simulée de la section')
        return createElement('div', { 'data-dynamique': source })
      }
    },
  }
}

/** Dernières propriétés reçues par le composant dynamique dont le chargeur contient `fragment`. */
export function proprietesRecues(etat: EtatTableauDeBordSimule, fragment: string): Record<string, unknown> | undefined {
  for (const [source, props] of etat.proprietes ?? []) if (source.includes(fragment)) return props
  return undefined
}

/** Module next/navigation simulé : adresse lue dans l'état, navigation du routeur enregistrée par `push`. */
export function moduleNavigationSimule(etat: EtatTableauDeBordSimule, push: (url: string) => void) {
  return {
    useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
    usePathname: () => '/fr/pro/dashboard',
    useSearchParams: () => new URLSearchParams(etat.recherche),
  }
}

/** Module @/hooks/dashboard simulé : états vides, fonctions espionnes, mêmes objets à chaque rendu. */
export function moduleHooksDashboardSimule() {
  const services = { services: [], setServices: vi.fn() }
  const absences = { absences: [], setAbsences: vi.fn() }
  const disponibilites = { setDayServices: vi.fn(), setAutoAccept: vi.fn(), loadCalendarData: vi.fn(async () => []) }
  const calendrier = {}
  const reglages = { initSettingsForm: vi.fn() }
  const reservations = {
    bookings: [], setBookings: vi.fn(), savedDocuments: [], setSavedDocuments: vi.fn(),
    pendingBookings: [], completedBookings: [], totalRevenue: 0,
    setShowDevisForm: vi.fn(), setShowFactureForm: vi.fn(), setConvertingDevis: vi.fn(),
    autoAddClientFromBooking: vi.fn(), transformBookingToDevis: vi.fn(), convertDevisToFacture: vi.fn(),
  }
  return {
    useServices: () => services,
    useAbsences: () => absences,
    useAvailability: () => disponibilites,
    useCalendar: () => calendrier,
    useSettings: () => reglages,
    useBookings: () => reservations,
  }
}

/**
 * Droits d'équipe simulés (usePermissions) : le compte de la société par défaut. Un test peut les changer pour monter
 * le tableau de bord d'un salarié ; remettreDroitsSimules() (beforeEach) les rend au compte de la société.
 */
export const droitsSimules = {
  permissions: {} as Record<string, string>,
  isGerant: true,
  proTeamRole: null as string | null,
  /** Dérogations du gérant en cours de lecture (usePermissions) : la garde des sections attend leur réponse. */
  loading: false,
  canAccess: (_module: string) => true,
  canWrite: (_module: string) => true,
}

export function remettreDroitsSimules(): void {
  Object.assign(droitsSimules, {
    permissions: {}, isGerant: true, proTeamRole: null, loading: false, canAccess: () => true, canWrite: () => true,
  })
}

/** Hooks de configuration et d'équipe simulés : mêmes objets à chaque rendu. */
export function hooksConfigurationSimules() {
  const modules = { ALL_MODULES: [], modulesConfig: [], isModuleEnabled: () => true }
  const permissions = droitsSimules
  const notifications = {
    notifications: [], setNotifications: vi.fn(), showNotifDropdown: false, setShowNotifDropdown: vi.fn(),
    unreadNotifCount: 0, setUnreadNotifCount: vi.fn(), unreadMsgCount: 0, refreshUnreadMsgCount: vi.fn(),
  }
  const messagerie = {}
  return {
    useModulesConfig: () => modules,
    usePermissions: () => permissions,
    useNotifications: () => notifications,
    useDashboardMessaging: () => messagerie,
  }
}
