/**
 * Simulations partagées par les tests d'initialisation d'auth des tableaux de bord
 * (tests/client-dashboard/init-auth.test.tsx, tests/pro-dashboard/init-auth.test.tsx) : client Supabase dont
 * onAuthStateChange garde les rappels pour que le test émette les événements, navigation Next et i18n.
 * À appeler depuis une fabrique de vi.mock, par import dynamique.
 */
import { vi } from 'vitest'

export type RappelAuth = (event: string, session: unknown) => unknown

/** Module @/lib/supabase simulé : méthodes d'auth fournies, rappels onAuthStateChange rangés dans `rappels`. */
export function moduleSupabaseSimule(options: { auth: Record<string, unknown>; rappels: RappelAuth[]; from: unknown }) {
  return {
    supabase: {
      auth: {
        ...options.auth,
        onAuthStateChange: (rappel: RappelAuth) => {
          options.rappels.push(rappel)
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        },
      },
      from: options.from,
    },
  }
}

/** Module next/navigation simulé sur `chemin`. */
export function moduleNavigationSimule(chemin: string, push: (url: string) => void = vi.fn()) {
  return {
    useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
    usePathname: () => chemin,
    useSearchParams: () => new URLSearchParams(),
  }
}

/** Module @/lib/i18n/context simulé : clés rendues telles quelles, locale fr. */
export function moduleI18nSimule() {
  return {
    useTranslation: () => ({ t: (cle: string) => cle, locale: 'fr', setLocale: () => {} }),
    useLocale: () => 'fr',
  }
}

/** window.location simulée : navigations et rechargements enregistrés au lieu d'être exécutés. */
export interface LocationSimulee {
  navigations: string[]
  rechargements: number
  /** Remet la window.location d'origine (afterEach). */
  restaurer: () => void
}

/** Remplace window.location par une version qui enregistre chaque navigation, page courante `chemin`. */
export function simulerLocation(chemin: string): LocationSimulee {
  const descripteur = Object.getOwnPropertyDescriptor(window, 'location')
  const lieu: LocationSimulee = {
    navigations: [],
    rechargements: 0,
    restaurer: () => {
      if (descripteur) Object.defineProperty(window, 'location', descripteur)
    },
  }
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'https://vitfix.io',
      pathname: chemin,
      search: '',
      hash: '',
      get href() { return `https://vitfix.io${chemin}` },
      set href(valeur: string) { lieu.navigations.push(valeur) },
      assign: (valeur: string) => { lieu.navigations.push(valeur) },
      replace: (valeur: string) => { lieu.navigations.push(valeur) },
      reload: () => { lieu.rechargements += 1 },
    },
  })
  return lieu
}
