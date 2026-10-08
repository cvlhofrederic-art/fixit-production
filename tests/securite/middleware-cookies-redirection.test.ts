/**
 * Cookies Supabase sur les redirections du middleware (localeRedirect).
 *
 * getUser() peut rafraîchir la session : @supabase/ssr appelle alors setAll avec les options de chaque cookie
 * (path, sameSite, httpOnly, maxAge de 400 jours ; maxAge 0 pour supprimer un fragment devenu inutile ou une session
 * refusée). Sur une réponse sans redirection, le middleware les transmet telles quelles. Avant ce correctif, une
 * redirection ne recopiait que { path, sameSite, secure } : le jeton rafraîchi devenait un cookie de session, et une
 * suppression (valeur vide, Max-Age=0) devenait un cookie vide qui survivait jusqu'à la fermeture du navigateur.
 * Le client Supabase est simulé : on ne teste que les en-têtes Set-Cookie produits par le middleware.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type CookieAPoser = { name: string; value: string; options: Record<string, unknown> }
type OptionsClient = { cookies: { setAll: (cookies: CookieAPoser[]) => void } }

// Options par défaut de @supabase/ssr 0.8 (DEFAULT_COOKIE_OPTIONS) : ni Secure ni Domain.
const QUATRE_CENTS_JOURS = 400 * 24 * 60 * 60
const POSE = { path: '/', sameSite: 'lax', httpOnly: false, maxAge: QUATRE_CENTS_JOURS }
const SUPPRESSION = { path: '/', sameSite: 'lax', httpOnly: false, maxAge: 0 }

let utilisateurCourant: { app_metadata: { role?: string } } | null = null
let cookiesRafraichis: CookieAPoser[] = []

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _cle: string, options: OptionsClient) => ({
    auth: {
      getUser: async () => {
        // Comme @supabase/ssr après un rafraîchissement ou un refus de session : un appel à setAll.
        if (cookiesRafraichis.length > 0) options.cookies.setAll(cookiesRafraichis)
        return { data: { user: utilisateurCourant } }
      },
    },
  }),
}))

const { middleware } = await import('@/middleware')

// Chemins avec barre finale et trailingSlash: true, comme en production (cf. acces-middleware-dashboards.test.ts).
async function visiter(chemin: string) {
  const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`, { nextConfig: { trailingSlash: true } }))
  return { statut: reponse.status, location: reponse.headers.get('location'), setCookie: reponse.headers.getSetCookie() }
}

/** Attributs d'un Set-Cookie, clés en minuscules (« Secure » → secure: ''). */
function cookiePose(setCookie: string[], nom: string) {
  const brut = setCookie.find((ligne) => ligne.startsWith(`${nom}=`))
  if (!brut) return null
  const [paire, ...attributs] = brut.split(/;\s*/)
  const valeur = decodeURIComponent(paire.slice(nom.length + 1))
  const attr: Record<string, string> = {}
  for (const a of attributs) {
    const i = a.indexOf('=')
    attr[(i === -1 ? a : a.slice(0, i)).toLowerCase()] = i === -1 ? '' : a.slice(i + 1)
  }
  return { valeur, attr }
}

const JETON = 'sb-projet-auth-token'

beforeEach(() => {
  utilisateurCourant = null
  cookiesRafraichis = []
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('redirection après un rafraîchissement de session (production)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    utilisateurCourant = { app_metadata: { role: 'client' } }
    // Le jeton rafraîchi tient désormais en un seul cookie : l'ancien fragment .1 est supprimé.
    cookiesRafraichis = [
      { name: JETON, value: 'base64-jeton-rafraichi', options: POSE },
      { name: `${JETON}.1`, value: '', options: SUPPRESSION },
    ]
  })

  it('redirige toujours l’accueil vers le tableau de bord du rôle', async () => {
    expect(await visiter('/fr/')).toMatchObject({ statut: 307, location: 'https://vitfix.io/fr/client/dashboard/' })
  })

  it('garde la durée de 400 jours du jeton rafraîchi', async () => {
    const { setCookie } = await visiter('/fr/')
    const jeton = cookiePose(setCookie, JETON)
    expect(jeton?.valeur).toBe('base64-jeton-rafraichi')
    expect(jeton?.attr['max-age']).toBe(String(QUATRE_CENTS_JOURS))
    expect(jeton?.attr.expires).toBeDefined()
    expect(jeton?.attr.path).toBe('/')
    expect(jeton?.attr.samesite?.toLowerCase()).toBe('lax')
    expect(jeton?.attr).toHaveProperty('secure')
    expect(jeton?.attr).not.toHaveProperty('domain')
  })

  it('transmet la suppression du fragment devenu inutile (Max-Age=0), au lieu d’un cookie vide de session', async () => {
    const { setCookie } = await visiter('/fr/')
    const fragment = cookiePose(setCookie, `${JETON}.1`)
    expect(fragment?.valeur).toBe('')
    expect(fragment?.attr['max-age']).toBe('0')
    expect(fragment?.attr.path).toBe('/')
    expect(fragment?.attr).toHaveProperty('secure')
    expect(fragment?.attr).not.toHaveProperty('domain')
  })

  it('ne touche pas au cookie de langue de la redirection', async () => {
    const { setCookie } = await visiter('/pt/')
    const langue = cookiePose(setCookie, 'locale')
    expect(langue?.valeur).toBe('pt')
    expect(langue?.attr['max-age']).toBe(String(365 * 24 * 60 * 60))
    expect(langue?.attr).toHaveProperty('secure')
    // Un seul Set-Cookie par nom.
    expect(setCookie.filter((ligne) => ligne.startsWith('locale='))).toHaveLength(1)
    expect(setCookie.filter((ligne) => ligne.startsWith(`${JETON}=`))).toHaveLength(1)
  })
})

describe('redirection vers la connexion quand le serveur refuse la session', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    utilisateurCourant = null
    cookiesRafraichis = [
      { name: `${JETON}.0`, value: '', options: SUPPRESSION },
      { name: `${JETON}.1`, value: '', options: SUPPRESSION },
    ]
  })

  it('supprime les cookies de session sur la redirection d’un tableau de bord vers /auth/login/', async () => {
    const { statut, location, setCookie } = await visiter('/fr/client/dashboard/')
    expect({ statut, location }).toEqual({ statut: 307, location: 'https://vitfix.io/fr/auth/login/' })
    for (const nom of [`${JETON}.0`, `${JETON}.1`]) {
      expect(cookiePose(setCookie, nom)).toMatchObject({ valeur: '', attr: { 'max-age': '0', path: '/' } })
    }
  })

  it('fait de même sur une route interne (/admin/), sans cookie de langue', async () => {
    const { statut, location, setCookie } = await visiter('/admin/dashboard/')
    expect({ statut, location }).toEqual({ statut: 307, location: 'https://vitfix.io/admin/login/' })
    expect(cookiePose(setCookie, `${JETON}.0`)).toMatchObject({ valeur: '', attr: { 'max-age': '0' } })
    expect(cookiePose(setCookie, 'locale')).toBeNull()
  })
})

describe('hors production', () => {
  beforeEach(() => {
    utilisateurCourant = { app_metadata: { role: 'client' } }
    cookiesRafraichis = [
      { name: JETON, value: 'base64-jeton-rafraichi', options: POSE },
      { name: `${JETON}.1`, value: '', options: SUPPRESSION },
    ]
  })

  it('n’ajoute pas Secure (localhost en http), comme avant', async () => {
    const { setCookie } = await visiter('/fr/')
    expect(cookiePose(setCookie, JETON)?.attr).not.toHaveProperty('secure')
  })

  it('la redirection porte les mêmes cookies Supabase que la réponse sans redirection', async () => {
    // Expires dépend de l'heure de pose : on compare tout le reste.
    const sansExpires = (setCookie: string[], nom: string) => {
      const c = cookiePose(setCookie, nom)
      if (!c) return null
      return { valeur: c.valeur, attr: Object.fromEntries(Object.entries(c.attr).filter(([cle]) => cle !== 'expires')) }
    }
    const redirection = await visiter('/fr/')
    const passage = await visiter('/fr/client/dashboard/')
    expect(redirection.statut).toBe(307)
    expect(passage.statut).toBe(200)
    for (const nom of [JETON, `${JETON}.1`]) {
      expect(sansExpires(redirection.setCookie, nom)).not.toBeNull()
      expect(sansExpires(redirection.setCookie, nom)).toEqual(sansExpires(passage.setCookie, nom))
    }
  })
})
