/**
 * Version française du dashboard syndic v54 : aucun texte portugais ne doit
 * apparaître, ni à l'ouverture d'un écran, ni après un clic.
 *
 * La suite est découpée en quarts (fr-residus.1.test.tsx … .4.test.tsx) pour que
 * vitest les exécute en parallèle. Le fichier appelant doit simuler '@/lib/supabase'.
 *
 * Par défaut : chaque écran, puis chaque clic (sans entrer dans les boîtes de dialogue).
 * Options :
 *   SYNDIC_I18N_PROFONDEUR=2       → clique aussi dans chaque boîte de dialogue ouverte
 *   SYNDIC_I18N_REF_PT=<dossier>   → signale aussi toute chaîne identique à l'instantané PT
 *   SYNDIC_I18N_ROUTES=a,b         → sous-ensemble de routes (réparti entre les quarts)
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MASQUES_FR } from '@/components/syndic-dashboard/v54/shell/sidebar-config.fr'
import { installCrawlEnvironment } from './crawl'
import { AGENT_ROUTES, capturerEcran, capturerShell, navIds, routesACapturer, tousLesTextes } from './ecrans'
import { MODULE_ENTRIES } from './modules'
import { residusPortugais } from './residus-pt'

const ONLY = process.env.SYNDIC_I18N_ROUTES?.split(',').map((s) => s.trim()).filter(Boolean)
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

function routesDuQuart(quart: number, quarts: number): string[] {
  let routes = routesACapturer('fr-FR')
  if (ONLY) routes = routes.filter((r) => ONLY.includes(r))
  return routes.filter((_, i) => i % quarts === quart - 1)
}

/** Déclare la suite pour le quart `quart` (1 à `quarts`) des routes FR. */
export function suiteResidusFr(quart: number, quarts: number): void {
  describe(`Version française — aucun texte portugais (${quart}/${quarts})`, () => {
    const ref = referencePt()
    beforeEach(() => installCrawlEnvironment())
    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    if (quart === 1) {
      it('les modules sans objet en France sont absents de la sidebar FR', () => {
        for (const id of MASQUES_FR) expect(navIds('fr-FR')).not.toContain(id)
      })

      it('le registre du parcours couvre chaque entrée de la sidebar (et inversement)', () => {
        const modules = new Set(MODULE_ENTRIES.map((e) => e.route))
        const nav = navIds('pt-PT').filter((id) => id !== 'logout' && !AGENT_ROUTES.includes(id))
        expect(nav.filter((id) => !modules.has(id))).toEqual([])
        expect([...modules].filter((r) => !nav.includes(r))).toEqual([])
      })
    }

    for (const route of routesDuQuart(quart, quarts)) {
      it(route, async () => {
        const r = route === '__shell__'
          ? { route, shell: await capturerShell('fr-FR') }
          : await capturerEcran(route, 'fr-FR', { dialogs: PROFONDEUR })
        expect(residusPortugais(tousLesTextes(r), ref)).toEqual([])
      }, 600_000)
    }
  })
}
