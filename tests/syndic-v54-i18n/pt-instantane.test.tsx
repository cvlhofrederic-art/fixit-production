/**
 * Instantané des textes PT du dashboard syndic v54 — outil de non-régression
 * pour la déclinaison française : la version PT doit rester strictement identique.
 *
 * Désactivé par défaut (lent : chaque clic de chaque écran est rejoué).
 *   SYNDIC_I18N_INSTANTANE=ecrire  SYNDIC_I18N_DIR=<dossier>  → écrit un fichier JSON par route
 *   SYNDIC_I18N_INSTANTANE=comparer SYNDIC_I18N_DIR=<dossier> → compare à ces fichiers
 * Options : SYNDIC_I18N_ROUTES=dashboard,ordens (sous-ensemble), SYNDIC_I18N_SHARD=1/4.
 *
 * Chaque relevé garde l'ordre du document et les doublons, l'état des contrôles et ce
 * qui disparaît après un clic (voir crawl.tsx) : un libellé qui se multiplie, se
 * déplace ou disparaît est une différence. Un relevé d'un format antérieur
 * (FORMAT_RELEVE) n'est pas comparable : le reprendre avec `ecrire` sur la référence.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FORMAT_RELEVE, installCrawlEnvironment } from './crawl'
import { AGENT_ROUTES, capturerEcran, capturerShell, navIds, routesACapturer } from './ecrans'
import { MODULE_ENTRIES } from './modules'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))

const MODE = process.env.SYNDIC_I18N_INSTANTANE
const DIR = process.env.SYNDIC_I18N_DIR ?? ''
const ONLY = process.env.SYNDIC_I18N_ROUTES?.split(',').map((s) => s.trim()).filter(Boolean)
const SHARD = process.env.SYNDIC_I18N_SHARD

function selectedRoutes(): string[] {
  let routes = routesACapturer('pt-PT')
  if (ONLY) routes = routes.filter((r) => ONLY.includes(r))
  if (SHARD) {
    const [k, n] = SHARD.split('/').map(Number)
    routes = routes.filter((_, i) => i % n === k - 1)
  }
  return routes
}

const fileFor = (route: string): string => path.join(DIR, `${route}.json`)

describe.skipIf(!MODE)('Instantané des textes PT — syndic v54', () => {
  beforeEach(() => installCrawlEnvironment())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  for (const route of selectedRoutes()) {
    it(route, async () => {
      const capture = route === '__shell__' ? { route, shell: await capturerShell('pt-PT') } : await capturerEcran(route, 'pt-PT')
      const json = JSON.stringify({ format: FORMAT_RELEVE, ...capture }, null, 1)
      if (MODE === 'ecrire') {
        fs.mkdirSync(DIR, { recursive: true })
        fs.writeFileSync(fileFor(route), json)
        return
      }
      const expected = JSON.parse(fs.readFileSync(fileFor(route), 'utf8'))
      expect(expected.format ?? 1, `relevé de référence au format ${expected.format ?? 1} : le reprendre avec SYNDIC_I18N_INSTANTANE=ecrire`).toBe(FORMAT_RELEVE)
      expect(JSON.parse(json)).toEqual(expected)
    }, 600_000)
  }

  it('couvre toutes les routes de la sidebar et tous les modules', () => {
    const routes = new Set(navIds('pt-PT'))
    for (const e of MODULE_ENTRIES) expect(routes.has(e.route)).toBe(true)
    for (const a of AGENT_ROUTES) expect(routes.has(a)).toBe(true)
  })
})
