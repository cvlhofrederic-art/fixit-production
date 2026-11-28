// ── Polices de l'image Open Graph (/api/og) ──────────────────────────────────
// L'origine est une constante du dépôt et les fichiers forment une liste fermée : rien ne
// vient de la requête (Aikido : SSRF via `${origin}/fonts/${file}`, l'origine dérivée de
// request.url pouvait être choisie par l'appelant). Sur Cloudflare, le binding ASSETS sert
// le fichier statique sans sortir du Worker ; ailleurs (dev, tests), fetch vers le site.

import { SITE_URL } from '@/lib/constants'
import { getCfEnv } from '@/lib/env'

export const POLICES_OG = {
  black: 'Montserrat-900.woff',
  medium: 'Montserrat-500.woff',
} as const

export type PoliceOg = keyof typeof POLICES_OG

/** URL absolue d'une police, construite uniquement à partir de constantes du dépôt. */
export function urlPoliceOg(police: PoliceOg): string {
  return `${SITE_URL}/fonts/${POLICES_OG[police]}`
}

export type FetcherPolice = (url: string) => Promise<Response>

interface BindingAssets {
  fetch(entree: Request | string): Promise<Response>
}

/** Binding ASSETS de Cloudflare (wrangler.toml [assets]) quand le code tourne dans le Worker. */
async function fetcherAssets(): Promise<FetcherPolice | null> {
  const env = await getCfEnv()
  const assets = env.ASSETS as unknown as BindingAssets | undefined
  if (!assets || typeof assets.fetch !== 'function') return null
  return (url) => assets.fetch(new Request(url))
}

/**
 * Charge une police de la liste fermée. `fetcher` est injectable pour les tests ; sinon le
 * binding ASSETS quand il existe, puis le fetch global vers l'origine constante.
 * Lève une erreur si le fichier est indisponible : l'appelant retombe sur la police par défaut.
 */
export async function chargerPoliceOg(police: PoliceOg, fetcher?: FetcherPolice): Promise<ArrayBuffer> {
  if (!Object.prototype.hasOwnProperty.call(POLICES_OG, police)) {
    throw new Error('Police OG inconnue')
  }
  const url = urlPoliceOg(police)
  const f = fetcher ?? (await fetcherAssets()) ?? ((u: string) => fetch(u))
  const r = await f(url)
  if (!r.ok) throw new Error(`font ${POLICES_OG[police]} ${r.status}`)
  return r.arrayBuffer()
}
