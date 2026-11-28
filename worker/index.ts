/**
 * Point d'entrée du Worker Cloudflare (wrangler.toml → main) : cache HTML des pages publiques et en-têtes de
 * mesure autour du Worker généré par `npx @opennextjs/cloudflare build` (.open-next/worker.js), et tâches
 * planifiées (Cron Triggers de wrangler.toml, handler `scheduled`).
 * Logique et tests : worker/cache-pages-publiques.ts, tests/worker/cache-pages-publiques.test.ts,
 * worker/taches-planifiees.ts, tests/worker/taches-planifiees.test.ts.
 */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore — généré par le build OpenNext, absent du dépôt
import openNext from '../.open-next/worker.js'
// @ts-ignore — classes Durable Object exportées par le Worker généré (inutilisées sans binding, gardées telles quelles)
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from '../.open-next/worker.js'
/* eslint-enable @typescript-eslint/ban-ts-comment */
import { creerGestionnaireAvecCache, type CacheMinimal, type EnvCache, type Gestionnaire } from './cache-pages-publiques'
import { creerTachesPlanifiees, type EnvTaches } from './taches-planifiees'

declare const caches: { default: CacheMinimal }

const gestionnaire = creerGestionnaireAvecCache(openNext as Gestionnaire<EnvCache & EnvTaches>, () => caches.default)

const worker = {
  fetch: gestionnaire.fetch,
  // Les tâches passent par le même gestionnaire que les requêtes (cache contourné pour /api, comme pour un appel reçu).
  scheduled: creerTachesPlanifiees(gestionnaire),
}

export default worker
