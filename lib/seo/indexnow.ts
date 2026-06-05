// IndexNow integration - Bing/Yandex/Naver instant indexation
// Doc : https://www.indexnow.org/documentation
//
// La clé doit être disponible publiquement à
// https://vitfix.io/{KEY}.txt (file statique dans public/).
// Active aussi le toggle Cloudflare > Crawler Hints pour automatisation
// auto sur les pages mises à jour (95 % du gain).
//
// Cette fonction sert pour les automatisations explicites (cron, webhook
// post-deploy, revalidatePath manuel) qui veulent forcer le ping IndexNow
// sur des URLs spécifiques.

const INDEXNOW_KEY = 'f35626783ac34c45b8aed85303d1f5a8'
const INDEXNOW_HOST = 'vitfix.io'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
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
 *
 * @param urls Liste d'URLs absolues à soumettre (max 10000 par appel)
 * @returns Résultat avec statut HTTP de l'API
 */
export async function submitIndexNow(urls: string[]): Promise<IndexNowResult> {
  if (urls.length === 0) {
    return { ok: false, status: 0, message: 'No URLs provided' }
  }
  // IndexNow accepte 1 URL via GET, ou bulk via POST
  const isBulk = urls.length > 1
  try {
    const signal = AbortSignal.timeout(INDEXNOW_TIMEOUT_MS)
    if (isBulk) {
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: INDEXNOW_HOST,
          key: INDEXNOW_KEY,
          keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
          urlList: urls,
        }),
        signal,
      })
      return { ok: res.ok, status: res.status }
    }
    const url = encodeURIComponent(urls[0])
    const res = await fetch(`${INDEXNOW_ENDPOINT}?url=${url}&key=${INDEXNOW_KEY}`, { signal })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : 'Unknown error',
    }
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
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export const INDEXNOW_KEY_PUBLIC = INDEXNOW_KEY
