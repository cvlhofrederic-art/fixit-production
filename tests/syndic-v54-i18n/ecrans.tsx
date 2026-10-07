/**
 * Capture des écrans du dashboard syndic v54, dans une langue donnée :
 *  - « demo » : le dashboard complet (shell + module), en preview anonyme, ouvert
 *    par un clic sur l'entrée de la sidebar ; on parcourt la zone de contenu ;
 *  - « auth » : le module seul, pour un cabinet connecté sans données (états vides,
 *    formulaires réels) ; on parcourt tout le module.
 * Le PT se capture sans fournisseur de langue, exactement comme en production avant
 * la déclinaison française.
 */
import { fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'
import SyndicDashboardV54 from '@/components/syndic-dashboard/v54/SyndicDashboardV54'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SIDEBAR, isItem } from '@/components/syndic-dashboard/v54/shell/sidebar-config'
import { SIDEBAR_FR } from '@/components/syndic-dashboard/v54/shell/sidebar-config.fr'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n/context'
import type { V54Locale } from '@/lib/syndic/v54/i18n/locale'
import { crawl, unionScope, type CrawlResult } from './crawl'
import { MODULE_ENTRIES } from './modules'

export const AGENT_ROUTES = ['fixy', 'max', 'lea', 'alfredo', 'tempo']

const sidebarDe = (locale: V54Locale) => (locale === 'fr-FR' ? SIDEBAR_FR : SIDEBAR)

/** Ids des entrées cliquables de la sidebar, dans l'ordre d'affichage. */
export const navIds = (locale: V54Locale): string[] =>
  sidebarDe(locale).flatMap((s) => s.entries.filter(isItem).map((e) => e.id))

/** Routes à capturer : shell + toutes les entrées de la sidebar sauf la déconnexion. */
export const routesACapturer = (locale: V54Locale): string[] => ['__shell__', ...navIds(locale).filter((id) => id !== 'logout')]

const LISTES = [
  'missions', 'immeubles', 'artisans', 'coproprios', 'team', 'contratos', 'seguros', 'signalements', 'elevadores',
  'sinistros', 'vistorias', 'prazos', 'avisos', 'reembolsos', 'procuracoes', 'segEdificios', 'caderneta', 'certificados',
  'declaracoes', 'fcrEdificios', 'fcrMovimentos', 'assembleias', 'impayes', 'recouvrements', 'faturas', 'reservas',
  'infracoes', 'enquetes', 'checklists', 'planosMan', 'deliberacoes', 'processosJud', 'obrigacoes', 'campanhas',
  'votacoes', 'nps', 'obras', 'eventos', 'orcamentos',
]

/** Cabinet connecté sans données : affiche les états vides et formulaires réels (pas la démo). */
const AUTH_VIDE = {
  ...Object.fromEntries(LISTES.map((k) => [k, []])),
  contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] },
  authenticated: true,
  loading: false,
  token: 'jeton-instantane',
  refresh: () => {},
} as unknown as SyndicData

function dansLaLangue(locale: V54Locale, el: ReactElement): ReactElement {
  return locale === 'pt-PT' ? el : <V54LocaleProvider locale={locale}>{el}</V54LocaleProvider>
}

function boutonDeSidebar(route: string, locale: V54Locale): HTMLElement {
  const aside = document.querySelector('aside')
  if (!aside) throw new Error('sidebar absente')
  const items = [...aside.querySelectorAll<HTMLElement>('button:not([aria-expanded]):not([aria-label])')]
  const btn = items[navIds(locale).indexOf(route)]
  if (!btn) throw new Error(`entrée de sidebar introuvable : ${route}`)
  return btn
}

const zoneDeContenu = (): ParentNode => document.querySelector('main > section') ?? document.body

export interface Instantane {
  route: string
  demo: CrawlResult
  auth?: CrawlResult
}

export interface OptionsCapture {
  /** Profondeur 2 : cliquer aussi dans la boîte de dialogue ouverte (défaut : oui). */
  dialogs?: boolean
}

export async function capturerEcran(route: string, locale: V54Locale, opts: OptionsCapture = {}): Promise<Instantane> {
  const dialogs = opts.dialogs ?? true
  const demo = await crawl({
    mount: () => dansLaLangue(locale, <SyndicDashboardV54 />),
    prepare: () => {
      if (route !== 'dashboard') fireEvent.click(boutonDeSidebar(route, locale))
    },
    scope: zoneDeContenu,
    dialogs,
  })
  const entry = MODULE_ENTRIES.find((e) => e.route === route)
  if (!entry) return { route, demo }
  const { Comp } = entry
  const auth = await crawl({
    mount: () =>
      dansLaLangue(
        locale,
        <ToastProvider>
          <SyndicDataContext.Provider value={AUTH_VIDE}>
            <Comp onNavigate={() => {}} />
          </SyndicDataContext.Provider>
        </ToastProvider>,
      ),
    dialogs,
  })
  return { route, demo, auth }
}

/** Shell seul : sidebar, barre du haut, et ce qui change en cliquant chaque entrée. */
export function capturerShell(locale: V54Locale): Promise<CrawlResult> {
  return crawl({
    mount: () => dansLaLangue(locale, <SyndicDashboardV54 />),
    scope: unionScope(['aside', 'main > header']),
    dialogs: false,
  })
}

/** Tous les textes d'un relevé (état initial + ce qui apparaît à chaque clic). */
export function tousLesTextes(r: Instantane | { route: string; shell: CrawlResult }): string[] {
  const parties: CrawlResult[] = 'shell' in r ? [r.shell] : [r.demo, ...(r.auth ? [r.auth] : [])]
  return [...new Set(parties.flatMap((p) => [...p.initial, ...p.clicks.flatMap((c) => c.added)]))]
}
