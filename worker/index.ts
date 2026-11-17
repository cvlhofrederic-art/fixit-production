/**
 * Point d'entrée du Worker Cloudflare (wrangler.toml → main) : cache HTML des pages publiques et en-têtes de
 * mesure autour du Worker généré par `npx @opennextjs/cloudflare build` (.open-next/worker.js).
 * Logique et tests : worker/cache-pages-publiques.ts, tests/worker/cache-pages-publiques.test.ts.
 */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore — généré par le build OpenNext, absent du dépôt
import openNext from '../.open-next/worker.js'
// @ts-ignore — classes Durable Object exportées par le Worker généré (inutilisées sans binding, gardées telles quelles)
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from '../.open-next/worker.js'
/* eslint-enable @typescript-eslint/ban-ts-comment */
import { creerGestionnaireAvecCache, type CacheMinimal, type EnvCache, type Gestionnaire } from './cache-pages-publiques'

declare const caches: { default: CacheMinimal }

export default creerGestionnaireAvecCache(openNext as Gestionnaire<EnvCache>, () => caches.default)
