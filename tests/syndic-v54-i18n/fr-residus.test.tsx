/**
 * Version française du dashboard syndic v54 : aucun texte portugais ne doit
 * apparaître, ni à l'ouverture d'un écran, ni après un clic.
 *
 * Par défaut : chaque écran, puis chaque clic (sans entrer dans les boîtes de dialogue).
 * Options :
 *   SYNDIC_I18N_PROFONDEUR=2       → clique aussi dans chaque boîte de dialogue ouverte
 *   SYNDIC_I18N_REF_PT=<dossier>   → signale aussi toute chaîne identique à l'instantané PT
 *   SYNDIC_I18N_ROUTES=a,b  SYNDIC_I18N_SHARD=k/n
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MASQUES_FR } from '@/components/syndic-dashboard/v54/shell/sidebar-config.fr'
import { installCrawlEnvironment } from './crawl'
import { capturerEcran, capturerShell, navIds, routesACapturer, tousLesTextes } from './ecrans'
import { residusPortugais } from './residus-pt'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))

const ONLY = process.env.SYNDIC_I18N_ROUTES?.split(',').map((s) => s.trim()).filter(Boolean)
const SHARD = process.env.SYNDIC_I18N_SHARD
const PROFONDEUR = process.env.SYNDIC_I18N_PROFONDEUR === '2'
const REF_PT = process.env.SYNDIC_I18N_REF_PT

function referencePt(): ReadonlySet<string> | undefined {
  if (!REF_PT) return undefined
  const out = new Set<string>()
  for (const f of fs.readdirSync(REF_PT).filter((n) => n.endsWith('.json'))) {
    const r = JSON.parse(fs.readFileSync(path.join(REF_PT, f), 'utf8'))
    for (const s of tousLesTextes(r)) out.add(s)
  }
  return out
}

function selectedRoutes(): string[] {
  let routes = routesACapturer('fr-FR')
  if (ONLY) routes = routes.filter((r) => ONLY.includes(r))
  if (SHARD) {
    const [k, n] = SHARD.split('/').map(Number)
    routes = routes.filter((_, i) => i % n === k - 1)
  }
  return routes
}

describe('Version française — aucun texte portugais', () => {
  const ref = referencePt()
  beforeEach(() => installCrawlEnvironment())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('les modules sans objet en France sont absents de la sidebar FR', () => {
    for (const id of MASQUES_FR) expect(navIds('fr-FR')).not.toContain(id)
  })

  for (const route of selectedRoutes()) {
    it(route, async () => {
      const r = route === '__shell__'
        ? { route, shell: await capturerShell('fr-FR') }
        : await capturerEcran(route, 'fr-FR', { dialogs: PROFONDEUR })
      expect(residusPortugais(tousLesTextes(r), ref)).toEqual([])
    }, 600_000)
  }
})
