/**
 * Accueils et autres chemins needsAuth : jamais de cache partagé, comme avant le rendu statique.
 *
 * Depuis les layouts statiques par langue (components/common/CoquilleRacine.tsx), les accueils /{locale}/ sont des pages
 * statiques : Next leur enverrait `s-maxage=31536000` au lieu de `private, no-store`. Or leur réponse dépend de la session
 * (un utilisateur connecté est redirigé vers son espace, le middleware peut poser des cookies Supabase rafraîchis ou
 * effacés). Le middleware garde donc `private, no-store` sur toutes les réponses de page des chemins needsAuth. Le
 * service depuis le cache des pages pré-rendues (x-nextjs-cache: HIT) ne dépend pas de cet en-tête. Client Supabase simulé.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Utilisateur = { app_metadata: { role?: string } }
type CookieAEcrire = { name: string; value: string; options?: Record<string, unknown> }

const etat = vi.hoisted(() => ({
  utilisateur: null as Utilisateur | null,
  cookiesRafraichis: [] as CookieAEcrire[],
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _cle: string, options: { cookies: { setAll: (c: CookieAEcrire[]) => void } }) => ({
    auth: {
      getUser: async () => {
        // Rafraîchissement ou effacement du jeton : @supabase/ssr écrit les cookies par setAll.
        if (etat.cookiesRafraichis.length) options.cookies.setAll(etat.cookiesRafraichis)
        return { data: { user: etat.utilisateur } }
      },
    },
  }),
}))

const { middleware } = await import('@/middleware')

const PRIVE = 'private, no-cache, no-store, max-age=0, must-revalidate'
const COOKIE_SESSION = 'sb-irluhepekbqgquveaett-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJ4In0'

async function cacheControl(chemin: string, cookie?: string) {
  const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`, cookie ? { headers: { cookie } } : {}))
  return { statut: reponse.status, cacheControl: reponse.headers.get('cache-control') }
}

beforeEach(() => {
  etat.utilisateur = null
  etat.cookiesRafraichis = []
})

describe('accueils /{locale}/ (pages statiques sur un chemin needsAuth) : private, no-store', () => {
  it.each(['/pt/', '/fr/', '/en/', '/nl/', '/es/'])('%s visiteur anonyme sans cookie', async (chemin) => {
    expect(await cacheControl(chemin)).toEqual({ statut: 200, cacheControl: PRIVE })
  })

  it('cookie de session reçu (jeton expiré, utilisateur introuvable)', async () => {
    expect(await cacheControl('/pt/', `locale=pt; ${COOKIE_SESSION}`)).toEqual({ statut: 200, cacheControl: PRIVE })
  })

  it('cookie de session effacé par le middleware (jeton périmé)', async () => {
    etat.cookiesRafraichis = [{ name: 'sb-irluhepekbqgquveaett-auth-token', value: '', options: { maxAge: 0 } }]
    expect(await cacheControl('/fr/')).toEqual({ statut: 200, cacheControl: PRIVE })
  })

  it('super_admin servi sur l’accueil avec un jeton rafraîchi', async () => {
    etat.utilisateur = { app_metadata: { role: 'super_admin' } }
    etat.cookiesRafraichis = [{ name: 'sb-irluhepekbqgquveaett-auth-token', value: 'nouveau-jeton' }]
    expect(await cacheControl('/pt/', COOKIE_SESSION)).toEqual({ statut: 200, cacheControl: PRIVE })
  })

  it('utilisateur connecté (non super_admin) : redirigé vers son espace, sans page servie', async () => {
    etat.utilisateur = { app_metadata: { role: 'artisan' } }
    expect((await cacheControl('/pt/', COOKIE_SESSION)).statut).toBe(307)
  })
})

describe('autres chemins', () => {
  it('tableau de bord servi à un artisan connecté (needsAuth) : private, no-store', async () => {
    etat.utilisateur = { app_metadata: { role: 'artisan' } }
    expect(await cacheControl('/fr/artisan/dashboard/', COOKIE_SESSION)).toEqual({ statut: 200, cacheControl: PRIVE })
  })

  it('page SEO (hors needsAuth) : Cache-Control public du middleware, inchangé, même avec un cookie de session reçu', async () => {
    expect(await cacheControl('/pt/servicos/canalizador-porto/', COOKIE_SESSION)).toEqual({
      statut: 200,
      cacheControl: 'public, s-maxage=3600, stale-while-revalidate=86400',
    })
  })
})
