// IndexNow integration - Bing/Yandex/Naver instant indexation
// Doc : https://www.indexnow.org/documentation
//
// La clé IndexNow n'est plus dans le dépôt (lot 1 Aikido, 28/10/2026) : elle est lue dans
// l'environnement (INDEXNOW_KEY, posée par `wrangler secret put INDEXNOW_KEY` ; process.env
// d'abord, puis le contexte Cloudflare — getSecret de lib/env.ts) et servie publiquement par
// app/indexnow-key.txt/route.ts à https://vitfix.io/indexnow-key.txt (keyLocation).
// Sans clé : avertissement en log et retour { ok: false }, jamais de throw (SEO best-effort,
// un déploiement ne doit pas casser pour un ping d'indexation).
// Active aussi le toggle Cloudflare > Crawler Hints pour automatisation
// auto sur les pages mises à jour (95 % du gain).
//
// Cette fonction sert pour les automatisations explicites (cron, webhook
// post-deploy, revalidatePath manuel) qui veulent forcer le ping IndexNow
// sur des URLs spécifiques.

import { getSecret } from '@/lib/env'
import { logger } from '@/lib/logger'

const INDEXNOW_HOST = 'vitfix.io'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
/** Emplacement public de la clé : app/indexnow-key.txt/route.ts la sert depuis INDEXNOW_KEY. */
export const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/indexnow-key.txt`
// Timeout pour ne jamais bloquer un Worker Cloudflare (limite 30s CPU)
const INDEXNOW_TIMEOUT_MS = 10_000

export interface IndexNowResult {
  ok: boolean
  status: number
  message?: string
}

/**
 * Soumet une ou plusieurs URLs à IndexNow (Bing, Yandex, Naver, Seznam).
 * Cas d'usage : déclencher après un revalidatePath ou un cron de mise à jour.
 * Toujours en POST JSON, même pour une seule URL : la clé ne transite jamais dans une
 * chaîne de requête (journaux, proxys) et chaque appel porte keyLocation.
 *
 * @param urls Liste d'URLs absolues à soumettre (max 10000 par appel)
 * @returns Résultat avec statut HTTP de l'API
 */
export async function submitIndexNow(urls: string[]): Promise<IndexNowResult> {
  if (urls.length === 0) {
    return { ok: false, status: 0, message: 'No URLs provided' }
  }
  // .trim() : un retour à la ligne final (echo … | wrangler secret put, collage dans GitHub) ferait
  // diverger la clé envoyée ici du corps servi à keyLocation → 403/422 silencieux côté IndexNow.
  const key = (await getSecret('INDEXNOW_KEY')).trim()
  if (!key) {
    logger.warn('[indexnow] INDEXNOW_KEY absente : ping IndexNow ignoré', { urls: urls.length })
    return { ok: false, status: 0, message: 'INDEXNOW_KEY is not set' }
  }
  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key,
        keyLocation: INDEXNOW_KEY_LOCATION,
        urlList: urls,
      }),
      signal: AbortSignal.timeout(INDEXNOW_TIMEOUT_MS),
    })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.warn('[indexnow] appel IndexNow en échec', { message, urls: urls.length })
    return { ok: false, status: 0, message }
  }
}

/**
 * Helper : soumettre toutes les URLs d'un sub-sitemap.
 * Pratique pour rafraîchir l'index après une release majeure.
 */
export async function submitSubSitemap(sitemapId: 0 | 1 | 2 | 3 | 4): Promise<IndexNowResult> {
  try {
    const res = await fetch(`https://${INDEXNOW_HOST}/sitemap/${sitemapId}.xml`, {
      signal: AbortSignal.timeout(INDEXNOW_TIMEOUT_MS),
    })
    if (!res.ok) return { ok: false, status: res.status, message: 'Sitemap fetch failed' }
    const xml = await res.text()
    const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1])
    return await submitIndexNow(urls)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.warn('[indexnow] lecture du sub-sitemap en échec', { sitemapId, message })
    return { ok: false, status: 0, message }
  }
}
