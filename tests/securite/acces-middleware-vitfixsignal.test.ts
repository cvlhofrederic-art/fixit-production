/**
 * Espace « Vitfix Signal » (/fr/vitfixsignal/, demandes du 10 et du 11/11/2026) : contrôle d'accès du
 * middleware, avec la page de connexion professionnelle de l'espace (/fr/vitfixsignal/connexion/).
 *
 * - sans session : 307 vers la page de connexion de l'espace dans la langue (la requête d'origine n'est pas reprise) ;
 * - tout autre compte : même 307 vers la page de connexion de l'espace (message neutre là-bas), jamais l'espace du
 *   compte ni la page de connexion générale, plus de 403 ;
 * - super admin : page servie ; depuis /en/, /nl/ ou /es/ (aucune page dans ces langues), renvoi vers
 *   /pt/vitfixsignal/. La « vue en tant que » (_original_role) est refusée depuis le 11/11/2026, comme par les
 *   routes de l'API (isSuperAdmin, #650) ;
 * - page de connexion de l'espace : servie sans session et à un compte sans accès (aucune boucle) ; un compte admis
 *   est envoyé dans l'espace ;
 * - chaque redirection qui part de l'espace (302 de langue, 307) porte X-Robots-Tag (OpenNext n'ajoute pas les
 *   headers() de next.config.ts aux réponses du middleware) ;
 * - la page publique du QR code (/fr/signalement/<jeton>/) et la route /api/vitfixsignal/* restent sans contrôle
 *   ni appel à Supabase ; la page de connexion générale (/fr/auth/login/) n'est pas touchée.
 * Le client Supabase est simulé : seule la décision de routage est testée. Seul app_metadata compte.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Utilisateur = { app_metadata: Record<string, unknown>; user_metadata?: Record<string, unknown> }

let utilisateurCourant: Utilisateur | null = null
let appelsGetUser = 0
/** Cookies que Supabase « rafraîchit » pendant getUser (setAll du patron officiel), pour vérifier leur recopie. */
type CookieSupabase = { name: string; value: string; options: Record<string, unknown> }
let cookiesRafraichis: CookieSupabase[] = []
let getUserLeve = false

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _cle: string, options: { cookies: { setAll: (c: CookieSupabase[]) => void } }) => ({
    auth: {
      getUser: async () => {
        appelsGetUser += 1
        if (getUserLeve) throw new Error('Supabase injoignable')
        if (cookiesRafraichis.length) options.cookies.setAll(cookiesRafraichis)
        return { data: { user: utilisateurCourant } }
      },
    },
  }),
}))

const { middleware } = await import('@/middleware')

const NOINDEX = 'noindex, nofollow, noarchive'
const JETON = '0123456789abcdef0123456789abcdef'

async function visiter(chemin: string) {
  const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`))
  const location = reponse.headers.get('location')
  return {
    statut: reponse.status,
    vers: location ? new URL(location) : null,
    robots: reponse.headers.get('x-robots-tag'),
    cache: reponse.headers.get('cache-control'),
    csp: reponse.headers.get('content-security-policy'),
  }
}

/** nextUrl.clone() reprend la barre finale de la requête (en production, le 308 de trailingSlash passe avant). */
const cheminDe = (r: { vers: URL | null }) => r.vers?.pathname.replace(/\/$/, '')

const connecte = (app_metadata: Record<string, unknown>, user_metadata: Record<string, unknown> = {}) => {
  utilisateurCourant = { app_metadata, user_metadata }
}

beforeEach(() => {
  utilisateurCourant = null
  appelsGetUser = 0
  cookiesRafraichis = []
  getUserLeve = false
})

describe('espace, sans session : page de connexion de l’espace', () => {
  it.each([
    ['/fr/vitfixsignal/', '/fr/vitfixsignal/connexion'],
    ['/fr/vitfixsignal', '/fr/vitfixsignal/connexion'],
    ['/pt/vitfixsignal/', '/pt/vitfixsignal/connexion'],
    ['/en/vitfixsignal/', '/pt/vitfixsignal/connexion'],
  ])('%s : 307 vers %s/, non indexable', async (chemin, connexion) => {
    const r = await visiter(chemin)
    expect(r.statut).toBe(307)
    expect(cheminDe(r)).toBe(connexion)
    expect(r.vers?.search).toBe('')
    expect(r.robots).toBe(NOINDEX)
    expect(r.csp).toBeTruthy()
    expect(appelsGetUser).toBe(1)
  })

  it('la requête d’origine n’est pas reprise (ni jeton, ni redirection)', async () => {
    const r = await visiter('/fr/vitfixsignal/?jeton=abc&redirect=//evil.example')
    expect(cheminDe(r)).toBe('/fr/vitfixsignal/connexion')
    expect(r.vers?.search).toBe('')
    expect(r.vers?.origin).toBe('https://vitfix.io')
  })

  it('jamais la page de connexion générale', async () => {
    const r = await visiter('/fr/vitfixsignal/')
    expect(cheminDe(r)).not.toBe('/fr/auth/login')
    expect(r.vers?.searchParams.has('retour')).toBe(false)
  })

  it('URL sans langue : d’abord la langue (302), déjà marquée non indexable', async () => {
    const r = await visiter('/vitfixsignal/')
    expect(r.statut).toBe(302)
    expect(r.vers?.pathname).toMatch(/^\/(fr|pt|en|nl|es)\/vitfixsignal\/$/)
    expect(r.robots).toBe(NOINDEX)
  })
})

describe('espace, autre compte connecté : page de connexion de l’espace (message neutre), plus de 403', () => {
  it.each(['syndic', 'syndic_gestionnaire', 'syndic_admin', 'coproprio', 'locataire', 'artisan', 'pro_societe', 'client', undefined])(
    'compte %s : 307 vers /fr/vitfixsignal/connexion/, jamais l’espace du compte, non indexable',
    async (role) => {
      connecte({ role })
      const r = await visiter('/fr/vitfixsignal/')
      expect(r.statut).toBe(307)
      expect(cheminDe(r)).toBe('/fr/vitfixsignal/connexion')
      expect(r.vers?.search).toBe('')
      expect(r.robots).toBe(NOINDEX)
      expect(r.csp).toBeTruthy()
    },
  )

  it('user_metadata trafiqué : même renvoi (seul app_metadata compte)', async () => {
    connecte({ role: 'coproprio' }, { role: 'super_admin', _original_role: 'super_admin' })
    expect(cheminDe(await visiter('/fr/vitfixsignal/'))).toBe('/fr/vitfixsignal/connexion')
  })

  it('/fr/vitfixsignal/<sous-chemin>/ : même contrôle', async () => {
    connecte({ role: 'syndic' })
    const r = await visiter('/fr/vitfixsignal/gestionnaires/')
    expect(r.statut).toBe(307)
    expect(cheminDe(r)).toBe('/fr/vitfixsignal/connexion')
  })

  it('en portugais et depuis /en/ : connexion de l’espace sous /pt/', async () => {
    connecte({ role: 'syndic' })
    expect(cheminDe(await visiter('/pt/vitfixsignal/'))).toBe('/pt/vitfixsignal/connexion')
    expect(cheminDe(await visiter('/en/vitfixsignal/'))).toBe('/pt/vitfixsignal/connexion')
  })
})

describe('espace, super admin', () => {
  it('page servie, réponse privée (aucun cache partagé)', async () => {
    connecte({ role: 'super_admin' })
    const r = await visiter('/fr/vitfixsignal/')
    expect(r).toMatchObject({ statut: 200, vers: null })
    expect(r.cache).toContain('no-store')
    expect(r.cache).toContain('private')
  })

  it('« vue en tant que » ouverte par un super admin (_original_role) : refusée comme les routes, donc envoyée à la connexion', async () => {
    connecte({ role: 'coproprio', _original_role: 'super_admin', _admin_override: true })
    const r = await visiter('/fr/vitfixsignal/')
    expect(r.statut).toBe(307)
    expect(r.vers?.pathname.replace(/\/$/, '')).toBe('/fr/vitfixsignal/connexion')
    expect(r.vers?.search).toBe('')
  })

  it('en portugais aussi', async () => {
    connecte({ role: 'super_admin' })
    expect(await visiter('/pt/vitfixsignal/')).toMatchObject({ statut: 200, vers: null })
  })

  it.each(['en', 'nl', 'es'])('/%s/vitfixsignal/ (aucune page dans cette langue) : renvoi vers /pt/vitfixsignal/, non indexable', async (langue) => {
    connecte({ role: 'super_admin' })
    const r = await visiter(`/${langue}/vitfixsignal/?x=1`)
    expect(r.statut).toBe(307)
    expect(r.vers?.pathname).toBe('/pt/vitfixsignal/')
    expect(r.vers?.search).toBe('')
    expect(r.robots).toBe(NOINDEX)
  })

  it('« vue en tant que » depuis /en/ : refusée, envoyée à la connexion portugaise', async () => {
    connecte({ role: 'coproprio', _original_role: 'super_admin' })
    const r = await visiter('/en/vitfixsignal/')
    expect(r.statut).toBe(307)
    expect(r.vers?.pathname.replace(/\/$/, '')).toBe('/pt/vitfixsignal/connexion')
  })
})

describe('page de connexion de l’espace (/fr/vitfixsignal/connexion/)', () => {
  it.each(['/fr/vitfixsignal/connexion/', '/fr/vitfixsignal/connexion', '/pt/vitfixsignal/connexion/'])(
    '%s sans session : page servie (aucune boucle), réponse privée, un seul getUser',
    async (chemin) => {
      const r = await visiter(chemin)
      expect(r).toMatchObject({ statut: 200, vers: null })
      expect(r.cache).toContain('private')
      expect(r.cache).toContain('no-store')
      expect(r.csp).toBeTruthy()
      expect(appelsGetUser).toBe(1)
    },
  )

  it.each(['syndic', 'coproprio', 'artisan', 'client', undefined])('compte %s sans accès : page servie (message neutre, aucune boucle)', async (role) => {
    connecte({ role })
    const r = await visiter('/fr/vitfixsignal/connexion/')
    expect(r).toMatchObject({ statut: 200, vers: null })
    expect(r.cache).toContain('no-store')
  })

  it('« vue en tant que » : page servie, jamais l’espace (refusée depuis le 11/11/2026, comme les routes)', async () => {
    connecte({ role: 'coproprio', _original_role: 'super_admin' })
    const r = await visiter('/fr/vitfixsignal/connexion/')
    expect(r).toMatchObject({ statut: 200, vers: null })
  })

  it.each([
    ['super admin', { role: 'super_admin' }],
  ])('%s : 307 vers l’espace, non indexable', async (_cas, app) => {
    connecte(app)
    const fr = await visiter('/fr/vitfixsignal/connexion/')
    expect(fr.statut).toBe(307)
    expect(fr.vers?.pathname).toBe('/fr/vitfixsignal/')
    expect(fr.vers?.search).toBe('')
    expect(fr.robots).toBe(NOINDEX)
    const pt = await visiter('/pt/vitfixsignal/connexion/')
    expect(pt.vers?.pathname).toBe('/pt/vitfixsignal/')
  })

  it('/en/vitfixsignal/connexion/ : sans session vers /pt/vitfixsignal/connexion/, super admin vers /pt/vitfixsignal/', async () => {
    const sans = await visiter('/en/vitfixsignal/connexion/')
    expect(sans.statut).toBe(307)
    expect(cheminDe(sans)).toBe('/pt/vitfixsignal/connexion')
    expect(sans.robots).toBe(NOINDEX)
    connecte({ role: 'super_admin' })
    expect((await visiter('/en/vitfixsignal/connexion/')).vers?.pathname).toBe('/pt/vitfixsignal/')
  })

  it('un segment voisin (/fr/vitfixsignal/connexionx/) n’est pas la page de connexion : renvoi vers elle', async () => {
    const r = await visiter('/fr/vitfixsignal/connexionx/')
    expect(r.statut).toBe(307)
    expect(cheminDe(r)).toBe('/fr/vitfixsignal/connexion')
  })
})

describe('chemins voisins inchangés', () => {
  it('page publique du QR code : servie sans session, sans appel à Supabase, sans X-Robots-Tag du middleware', async () => {
    const r = await visiter(`/fr/signalement/${JETON}/`)
    expect(r).toMatchObject({ statut: 200, vers: null, robots: null })
    expect(appelsGetUser).toBe(0)
  })

  it('/fr/vitfixsignals/ (autre segment) : aucun contrôle', async () => {
    const r = await visiter('/fr/vitfixsignals/')
    expect(r).toMatchObject({ statut: 200, vers: null })
    expect(appelsGetUser).toBe(0)
  })

  it('route /api/vitfixsignal/tableau : aucun contrôle du middleware (la route vérifie le super admin), aucun getUser', async () => {
    const r = await visiter('/api/vitfixsignal/tableau')
    expect(r).toMatchObject({ statut: 200, vers: null })
    expect(appelsGetUser).toBe(0)
  })

  it('page de connexion générale (/fr/auth/login/) sans session : servie, sans X-Robots-Tag', async () => {
    const r = await visiter('/fr/auth/login/')
    expect(r).toMatchObject({ statut: 200, vers: null, robots: null })
  })

  it('la succursale AJ garde ses règles (un coproprio est renvoyé vers /auth/login, sans paramètre)', async () => {
    connecte({ role: 'coproprio' })
    const r = await visiter('/fr/administrateur-judiciaire/')
    expect(r.statut).toBe(307)
    expect(cheminDe(r)).toBe('/fr/auth/login')
    expect(r.vers?.searchParams.has('retour')).toBe(false)
  })

  it('les redirections des autres espaces ne sont pas marquées', async () => {
    const r = await visiter('/fr/pro/dashboard/')
    expect(r).toMatchObject({ statut: 307, robots: null })
    expect(r.vers?.searchParams.has('retour')).toBe(false)
  })
})

// ── Chemin public d'un cabinet client (vitfix.io/<identifiant>/…, choix de Hugo du 10/11/2026) ──
// Reconnu AVANT la détection de langue (sinon 302 vers /fr/<identifiant>/… puis 404), par un motif figé
// (lib/vitfixsignal/chemin-cabinet.ts) : ni base, ni Supabase, ni cookie ; noindex et réponse privée.
describe('chemin public d’un cabinet client', () => {
  /** Navigation de document (Sec-Fetch-Dest: document) : c'est le cas où le cookie de langue serait posé. */
  async function document(chemin: string) {
    const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`, { headers: { 'sec-fetch-dest': 'document', 'accept-language': 'pt-PT' } }))
    return {
      statut: reponse.status,
      location: reponse.headers.get('location'),
      suite: reponse.headers.get('x-middleware-next'),
      langue: reponse.headers.get('x-middleware-request-x-locale'),
      robots: reponse.headers.get('x-robots-tag'),
      cache: reponse.headers.get('cache-control'),
      csp: reponse.headers.get('content-security-policy'),
      cookies: reponse.headers.get('set-cookie'),
    }
  }

  it.each([
    `/cabinet-exemple/signalement/${JETON}/`,
    `/cabinet-exemple/signalement/${JETON}`,
    '/cabinet-exemple/confirmation-adresse/',
    '/cabinet-exemple/confirmation-adresse',
    // Ouverture de l'accès d'un gestionnaire (PR 2, lot 3) : lien de l'e-mail, publique comme la confirmation.
    '/cabinet-exemple/invitation/',
    '/cabinet-exemple/invitation',
    // Désinscription des messages de diffusion (PR 3, lot 6) : lien de l'e-mail, publique SANS session même si l'espace du
    // cabinet est sous session (PR 2).
    '/cabinet-exemple/desinscription/',
    '/cabinet-exemple/desinscription',
  ])('%s : servie telle quelle (réécriture ensuite), sans Supabase ni cookie de langue, non indexable, privée', async (chemin) => {
    const r = await document(chemin)
    expect(r.statut).toBe(200)
    expect(r.location).toBeNull()
    expect(r.suite).toBe('1')
    // Coquille déterministe en français ; la page pose la langue du cabinet.
    expect(r.langue).toBe('fr')
    expect(r.robots).toBe(NOINDEX)
    expect(r.cache).toContain('no-store')
    expect(r.cache).toContain('private')
    expect(r.csp).toBeTruthy()
    expect(r.cookies).toBeNull()
    expect(appelsGetUser).toBe(0)
  })

  it('même avec une session ouverte : aucun appel à Supabase (aucun rôle ne change rien)', async () => {
    connecte({ role: 'super_admin' })
    expect((await document(`/cabinet-exemple/signalement/${JETON}/`)).statut).toBe(200)
    connecte({ role: 'syndic' })
    expect((await document('/cabinet-exemple/confirmation-adresse/')).statut).toBe(200)
    connecte({ role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'autre-cabinet' })
    expect((await document('/cabinet-exemple/invitation/')).statut).toBe(200)
    // Désinscription (lot 6) : ni la session du gestionnaire de CE cabinet ni celle d'un autre ne change rien.
    connecte({ role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'cabinet-exemple' })
    expect((await document('/cabinet-exemple/desinscription/')).statut).toBe(200)
    connecte({ role: 'super_admin' })
    expect((await document('/cabinet-exemple/desinscription/')).statut).toBe(200)
    expect(appelsGetUser).toBe(0)
  })

  it.each([
    '/blog/',
    `/cabinet-exemple/signalement/${JETON}/autre/`,
    `/cabinet-exemple/signalement/${JETON.slice(1)}/`,
    `/cabinet-exemple/signalement/${JETON.toUpperCase()}/`,
    '/Cabinet-Exemple/confirmation-adresse/',
    `/ab/signalement/${JETON}/`,
    '/cabinet-exemple/invitation/autre/',
    '/Cabinet-Exemple/invitation/',
    // Espace du cabinet (lot 4) : sous-chemin, casse ou nom réservé ne sont jamais pris pour lui.
    '/cabinet-exemple/suivi/autre/',
    '/Cabinet-Exemple/suivi/',
    '/Cabinet-Exemple/',
    '/plumber-porto/',
    // Pages internes de la réécriture : jamais servies directement.
    '/cabinet/cabinet-exemple/invitation/',
    '/cabinet/cabinet-exemple/suivi/',
    `/cabinet/cabinet-exemple/signalement/${JETON}/`,
    // Désinscription (lot 6) : sous-chemin, casse, page interne jamais servie directement.
    '/cabinet-exemple/desinscription/autre/',
    '/Cabinet-Exemple/desinscription/',
    '/cabinet/cabinet-exemple/desinscription/',
  ])('%s : hors du motif, 302 de langue comme avant (puis 404 s’il n’y a pas de page)', async (chemin) => {
    const r = await document(chemin)
    expect(r.statut).toBe(302)
    expect(new URL(r.location ?? '', 'https://vitfix.io').pathname).toBe(`/pt${chemin}`)
    expect(r.robots).toBeNull()
    expect(appelsGetUser).toBe(0)
  })

  it('/fr/signalement/<jeton>/ (anciens QR codes) : inchangé, sans Supabase', async () => {
    const r = await document(`/fr/signalement/${JETON}/`)
    expect(r).toMatchObject({ statut: 200, location: null, robots: null, langue: 'fr' })
    expect(appelsGetUser).toBe(0)
  })

  it('/api/… n’est jamais pris pour un cabinet', async () => {
    const reponse = await middleware(new NextRequest(`https://vitfix.io/api/signalement/${JETON}/`))
    expect(reponse.headers.get('x-robots-tag')).toBeNull()
    expect(reponse.headers.get('location')).toBeNull()
  })
})

// ── PR 2, lot 4 : espace de chaque cabinet (vitfix.io/<identifiant>/, /connexion/, /suivi/), plan § 1.3 et § 1.5 ──
// Reconnu AVANT la langue, seulement pour un identifiant valable (validerIdentifiantCabinetQr) ; session lue par le
// patron officiel @supabase/ssr ; décision pure (redirectionEspaceCabinetQr) ; chaque 3xx porte lui-même noindex, la
// CSP et un cache privé (OpenNext n'ajoute pas les headers() de next.config.ts aux réponses du middleware) et recopie
// les cookies de session rafraîchis ; aucune langue dans les adresses du cabinet (x-locale: fr pour la coquille).
describe('espace d’un cabinet', () => {
  const G_DU_CABINET = { role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'cabinet-exemple' }
  const G_AUTRE_CABINET = { role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'autre-cabinet' }

  async function document(chemin: string) {
    const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`, { headers: { 'sec-fetch-dest': 'document', 'accept-language': 'pt-PT' } }))
    const location = reponse.headers.get('location')
    return {
      reponse,
      statut: reponse.status,
      vers: location ? new URL(location) : null,
      suite: reponse.headers.get('x-middleware-next'),
      langue: reponse.headers.get('x-middleware-request-x-locale'),
      robots: reponse.headers.get('x-robots-tag'),
      cache: reponse.headers.get('cache-control'),
      csp: reponse.headers.get('content-security-policy'),
      cookieLangue: reponse.cookies.get('locale')?.value ?? null,
    }
  }

  /** En-têtes d'une réponse de l'espace du cabinet (servie ou redirigée). */
  const privee = (r: Awaited<ReturnType<typeof document>>) => {
    expect(r.robots).toBe(NOINDEX)
    expect(r.cache).toContain('no-store')
    expect(r.cache).toContain('private')
    expect(r.csp).toBeTruthy()
    expect(r.cookieLangue).toBeNull()
  }

  it.each(['/cabinet-exemple/', '/cabinet-exemple', '/cabinet-exemple/?x=1&redirect=//evil.example'])(
    '%s : 307 vers /cabinet-exemple/suivi/, requête vidée, sans Supabase',
    async (chemin) => {
      connecte(G_DU_CABINET)
      const r = await document(chemin)
      expect(r.statut).toBe(307)
      expect(r.vers?.pathname).toBe('/cabinet-exemple/suivi/')
      expect(r.vers?.search).toBe('')
      expect(r.vers?.origin).toBe('https://vitfix.io')
      privee(r)
      expect(appelsGetUser).toBe(0)
    },
  )

  describe('/<id>/connexion/', () => {
    it.each([
      ['sans session', null],
      ['compte client', { role: 'client' }],
      ['compte syndic', { role: 'syndic' }],
      ['« vue en tant que »', { role: 'coproprio', _original_role: 'super_admin' }],
      ['gestionnaire sans repère', { role: 'gestionnaire_signalement' }],
      ['gestionnaire d’un autre cabinet', G_AUTRE_CABINET],
    ])('%s : page servie (réécriture ensuite), x-locale fr, un seul getUser', async (_cas, app) => {
      if (app) connecte(app)
      const r = await document('/cabinet-exemple/connexion/')
      expect(r).toMatchObject({ statut: 200, vers: null, suite: '1', langue: 'fr' })
      privee(r)
      expect(appelsGetUser).toBe(1)
    })

    it('gestionnaire de CE cabinet : 307 vers /cabinet-exemple/suivi/ (requête vidée)', async () => {
      connecte(G_DU_CABINET)
      const r = await document('/cabinet-exemple/connexion/?retour=/admin/')
      expect(r.statut).toBe(307)
      expect(r.vers?.pathname).toBe('/cabinet-exemple/suivi/')
      expect(r.vers?.search).toBe('')
      privee(r)
    })

    it('super admin : 307 vers son espace global /fr/vitfixsignal/ (jamais /pt/)', async () => {
      connecte({ role: 'super_admin' })
      const r = await document('/cabinet-exemple/connexion')
      expect(r.statut).toBe(307)
      expect(r.vers?.pathname).toBe('/fr/vitfixsignal/')
      privee(r)
    })
  })

  describe('/<id>/suivi/', () => {
    it.each([
      ['sans session', null],
      ['compte client', { role: 'client' }],
      ['« vue en tant que »', { role: 'artisan', _original_role: 'super_admin' }],
      ['gestionnaire sans repère', { role: 'gestionnaire_signalement' }],
      ['gestionnaire d’un autre cabinet', G_AUTRE_CABINET],
      ['repère sans le rôle', { role: 'client', vitfixsignal_cabinet: 'cabinet-exemple' }],
    ])('%s : 307 vers /cabinet-exemple/connexion/ (message neutre là-bas), non indexable', async (_cas, app) => {
      if (app) connecte(app)
      const r = await document('/cabinet-exemple/suivi/?x=1')
      expect(r.statut).toBe(307)
      expect(r.vers?.pathname).toBe('/cabinet-exemple/connexion/')
      expect(r.vers?.search).toBe('')
      privee(r)
    })

    it('user_metadata trafiqué (rôle et repère) : même renvoi, seul app_metadata compte', async () => {
      connecte({ role: 'client' }, G_DU_CABINET)
      expect((await document('/cabinet-exemple/suivi/')).vers?.pathname).toBe('/cabinet-exemple/connexion/')
    })

    it('gestionnaire de CE cabinet : page servie, x-locale fr, privée', async () => {
      connecte(G_DU_CABINET)
      for (const chemin of ['/cabinet-exemple/suivi/', '/cabinet-exemple/suivi']) {
        const r = await document(chemin)
        expect(r).toMatchObject({ statut: 200, vers: null, suite: '1', langue: 'fr' })
        privee(r)
      }
    })

    it('super admin : 307 vers /fr/vitfixsignal/', async () => {
      connecte({ role: 'super_admin' })
      const r = await document('/cabinet-exemple/suivi/')
      expect(r.statut).toBe(307)
      expect(r.vers?.pathname).toBe('/fr/vitfixsignal/')
      privee(r)
    })

    it('Supabase injoignable : traité comme sans session (renvoi vers la connexion du cabinet), jamais une erreur', async () => {
      getUserLeve = true
      const r = await document('/cabinet-exemple/suivi/')
      expect(r.statut).toBe(307)
      expect(r.vers?.pathname).toBe('/cabinet-exemple/connexion/')
    })
  })

  it('cookies de session rafraîchis par Supabase : recopiés sur la redirection et sur la page servie, options comprises', async () => {
    cookiesRafraichis = [{ name: 'sb-projet-auth-token', value: 'jeton-rafraichi', options: { path: '/', maxAge: 3600, httpOnly: true, sameSite: 'lax' } }]
    connecte(G_DU_CABINET)
    const servie = await document('/cabinet-exemple/suivi/')
    expect(servie.statut).toBe(200)
    expect(servie.reponse.cookies.get('sb-projet-auth-token')).toMatchObject({ value: 'jeton-rafraichi', maxAge: 3600, httpOnly: true, path: '/' })
    const redirigee = await document('/cabinet-exemple/connexion/')
    expect(redirigee.statut).toBe(307)
    expect(redirigee.reponse.cookies.get('sb-projet-auth-token')).toMatchObject({ value: 'jeton-rafraichi', maxAge: 3600, httpOnly: true, path: '/' })
  })

  it('identifiant réservé : jamais l’espace d’un cabinet (/vitfixsignal/connexion/ part en 302 de langue, sans Supabase)', async () => {
    for (const chemin of ['/vitfixsignal/connexion/', '/blog/', '/syndic/connexion/', '/servicos/']) {
      const r = await document(chemin)
      expect(r.statut, chemin).toBe(302)
      expect(r.vers?.pathname, chemin).toBe(`/pt${chemin}`)
    }
    expect(appelsGetUser).toBe(0)
  })
})

describe('aiguillage d’un gestionnaire vers l’espace de SON cabinet (plan § 1.3, repère de routage)', () => {
  const G = { role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'cabinet-exemple' }

  it.each(['/fr/vitfixsignal/', '/pt/vitfixsignal/', '/fr/vitfixsignal/connexion/', '/pt/vitfixsignal/connexion/', '/en/vitfixsignal/'])(
    'espace global %s avec une session de gestionnaire → /cabinet-exemple/suivi/ (jamais /pt/<id>/), non indexable',
    async (chemin) => {
      connecte(G)
      const r = await visiter(`${chemin}?x=1`)
      expect(r.statut).toBe(307)
      expect(r.vers?.pathname).toBe('/cabinet-exemple/suivi/')
      expect(r.vers?.search).toBe('')
      expect(r.robots).toBe(NOINDEX)
      expect(r.cache).toContain('no-store')
      expect(r.csp).toBeTruthy()
    },
  )

  it('gestionnaire sans repère sur l’espace global : connexion de l’espace (message neutre), page de connexion servie (aucune boucle)', async () => {
    connecte({ role: 'gestionnaire_signalement' })
    expect(cheminDe(await visiter('/fr/vitfixsignal/'))).toBe('/fr/vitfixsignal/connexion')
    expect(await visiter('/fr/vitfixsignal/connexion/')).toMatchObject({ statut: 200, vers: null })
  })

  it('cookies rafraîchis recopiés sur l’aiguillage', async () => {
    cookiesRafraichis = [{ name: 'sb-projet-auth-token', value: 'jeton-rafraichi', options: { path: '/', maxAge: 3600 } }]
    connecte(G)
    const reponse = await middleware(new NextRequest('https://vitfix.io/fr/vitfixsignal/'))
    expect(reponse.status).toBe(307)
    expect(reponse.cookies.get('sb-projet-auth-token')).toMatchObject({ value: 'jeton-rafraichi', maxAge: 3600 })
  })
})

// ── PR 3, lot 6 : contrôle d'Origin des requêtes mutantes sur /api/ (CSRF), cahier § 8.2, décision F3 ──────────────
// Le POST « un clic » de désinscription (RFC 8058, en-tête List-Unsubscribe-Post) vient de la messagerie de la personne :
// un service qui l'envoie depuis une page web porte un Origin étranger (ou « null »). Ce seul chemin, en POST seulement et
// pour un jeton au format exact, est exempté : son effet est borné par le jeton signé (une opposition, idempotente) et la
// route vérifie la signature avant tout. Tout autre POST, PATCH, PUT ou DELETE sur /api/ avec un Origin étranger : 403.
describe('contrôle d’Origin des requêtes mutantes sur /api/ : seule exception, le POST « un clic » de désinscription', () => {
  const JETON_UN_CLIC = `${'a'.repeat(32)}.${'b'.repeat(64)}`
  const UN_CLIC = `/api/vitfixsignal/desinscription/un-clic/${JETON_UN_CLIC}`

  async function envoyer(chemin: string, methode: string, origine?: string) {
    const headers: Record<string, string> = origine === undefined ? {} : { origin: origine }
    const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`, { method: methode, headers }))
    return { statut: reponse.status, suite: reponse.headers.get('x-middleware-next'), corps: reponse.status === 403 ? await reponse.text() : '' }
  }

  it.each(['https://mail.exemple.test', 'https://webmail.exemple.test:8443', 'null'])(
    'POST un clic avec l’Origin %s : laissé à la route (qui vérifie la signature), jamais 403',
    async (origine) => {
      const r = await envoyer(UN_CLIC, 'POST', origine)
      expect(r.statut).toBe(200)
      expect(r.suite).toBe('1')
      expect(appelsGetUser).toBe(0)
    },
  )

  it('POST un clic sans Origin (serveur de la messagerie) ou depuis le site : laissé à la route, comme avant', async () => {
    expect((await envoyer(UN_CLIC, 'POST')).suite).toBe('1')
    expect((await envoyer(UN_CLIC, 'POST', 'https://vitfix.io')).suite).toBe('1')
  })

  it.each([
    '/api/vitfixsignal/desinscription',
    '/api/vitfixsignal/desinscription/lecture',
    '/api/vitfixsignal/desinscription/reprendre',
    '/api/vitfixsignal/desinscription/adresse',
    `${UN_CLIC}/autre`,
    `/api/vitfixsignal/desinscription/un-clic/${JETON_UN_CLIC.toUpperCase()}`,
    `/api/vitfixsignal/desinscription/un-clic/${'a'.repeat(32)}`,
    '/api/vitfixsignal/desinscription/un-clic/pas-un-jeton',
    `/api/vitfixsignal/desinscription/un-clic/${JETON_UN_CLIC}x`,
    `/api/vitfixsignal/autre/un-clic/${JETON_UN_CLIC}`,
    `/api/x/api/vitfixsignal/desinscription/un-clic/${JETON_UN_CLIC}`,
    '/api/vitfixsignal/signalements',
    '/api/cron/vitfixsignal-diffusion-reprise',
  ])('POST %s avec un Origin étranger : toujours 403', async (chemin) => {
    const r = await envoyer(chemin, 'POST', 'https://mail.exemple.test')
    expect(r.statut).toBe(403)
    expect(r.corps).toContain('CSRF')
  })

  it.each(['PATCH', 'PUT', 'DELETE'])('%s sur le chemin un clic avec un Origin étranger : 403 (seul le POST est exempté)', async (methode) => {
    expect((await envoyer(UN_CLIC, methode, 'https://mail.exemple.test')).statut).toBe(403)
  })

  it('GET du lien un clic ouvert dans le navigateur (D-P5b) : aucun contrôle d’Origin, comme tout GET', async () => {
    expect((await envoyer(UN_CLIC, 'GET', 'https://mail.exemple.test')).suite).toBe('1')
  })
})

// ── Compatibilité avec l'ancien nom du produit (décision du 26/11/2026, lib/vitfixsignal/ancien-nom.ts) ──────────────
// Tout ce qui existait en production sous l'ancien nom continue de marcher :
//   - anciennes adresses des pages de l'espace (favoris, liens des e-mails déjà reçus) : UNE redirection permanente
//     (308) vers la même page sous le nouveau segment, décidée AVANT tout le reste (langue, cabinet, session), jamais
//     indexable, jamais gardée en cache (un 308 sans Cache-Control reste dans le navigateur) ;
//   - anciennes routes d'API : laissées passer telles quelles (next.config.ts les réécrit ensuite vers les nouvelles),
//     jamais redirigées ; le POST « un clic » de l'en-tête List-Unsubscribe des messages déjà envoyés reste exempté du
//     contrôle d'Origin sous son ancienne adresse ;
//   - comptes ouverts avant le renommage : l'ancienne clé du repère de routage est encore lue.
describe('compatibilité avec l’ancien nom du produit', () => {
  describe('anciennes adresses des pages : redirection permanente vers la nouvelle', () => {
    it.each([
      ['/fr/aj-signalement/', '/fr/vitfixsignal/'],
      ['/fr/aj-signalement', '/fr/vitfixsignal'],
      ['/fr/aj-signalement/connexion/', '/fr/vitfixsignal/connexion/'],
      ['/pt/aj-signalement/', '/pt/vitfixsignal/'],
      ['/pt/aj-signalement/connexion/', '/pt/vitfixsignal/connexion/'],
      ['/en/aj-signalement/', '/en/vitfixsignal/'],
      ['/nl/aj-signalement/connexion/', '/nl/vitfixsignal/connexion/'],
      ['/es/aj-signalement/', '/es/vitfixsignal/'],
      ['/aj-signalement/', '/vitfixsignal/'],
      ['/aj-signalement/connexion/', '/vitfixsignal/connexion/'],
    ])('%s : 308 vers %s, non indexable, privée, sans appel à Supabase', async (ancienne, nouvelle) => {
      const r = await visiter(ancienne)
      expect(r.statut).toBe(308)
      expect(r.vers?.origin).toBe('https://vitfix.io')
      expect(r.vers?.pathname).toBe(nouvelle)
      expect(r.vers?.search).toBe('')
      expect(r.robots).toBe(NOINDEX)
      expect(r.cache).toBe('private, no-cache, no-store, max-age=0, must-revalidate')
      expect(r.csp).toBeTruthy()
      expect(appelsGetUser).toBe(0)
    })

    it('la requête est gardée (elle suit la page), sans jamais changer d’origine', async () => {
      const r = await visiter('/fr/aj-signalement/connexion/?x=1&redirect=//evil.example')
      expect(r.statut).toBe(308)
      expect(r.vers?.origin).toBe('https://vitfix.io')
      expect(r.vers?.pathname).toBe('/fr/vitfixsignal/connexion/')
      expect(r.vers?.search).toBe('?x=1&redirect=//evil.example')
    })

    it('même redirection avec ou sans session, quel que soit le compte (aucun contrôle ici : la nouvelle page le fait)', async () => {
      for (const app of [{ role: 'super_admin' }, { role: 'client' }, { role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'cabinet-exemple' }]) {
        connecte(app)
        const r = await visiter('/fr/aj-signalement/')
        expect(r.statut).toBe(308)
        expect(r.vers?.pathname).toBe('/fr/vitfixsignal/')
      }
      expect(appelsGetUser).toBe(0)
    })

    it('aucun cookie posé par la redirection (ni langue, ni session)', async () => {
      const reponse = await middleware(new NextRequest('https://vitfix.io/aj-signalement/'))
      expect(reponse.status).toBe(308)
      expect(reponse.headers.getSetCookie()).toEqual([])
    })

    it('la nouvelle adresse suit ensuite son parcours habituel (une seule redirection permanente, aucune boucle)', async () => {
      expect((await visiter('/fr/vitfixsignal/connexion/')).statut).toBe(200)
      expect((await visiter('/vitfixsignal/')).statut).toBe(302)
    })

    it('l’ancien segment n’est jamais pris pour l’espace d’un cabinet (identifiant réservé)', async () => {
      for (const chemin of ['/aj-signalement/connexion/', '/aj-signalement/suivi/', '/aj-signalement/']) {
        const r = await visiter(chemin)
        expect(r.statut, chemin).toBe(308)
        expect(r.vers?.pathname, chemin).toBe(chemin.replace('/aj-signalement', '/vitfixsignal'))
      }
      expect(appelsGetUser).toBe(0)
    })

    it.each(['/fr/aj-signalements/', '/fr/blog/aj-signalement/'])('%s (segment voisin) : aucune redirection permanente', async (chemin) => {
      expect((await visiter(chemin)).statut).not.toBe(308)
    })
  })

  describe('anciennes routes d’API : jamais redirigées (la réécriture de next.config.ts mène à la nouvelle route)', () => {
    const JETON_UN_CLIC = `${'a'.repeat(32)}.${'b'.repeat(64)}`
    const ANCIEN_UN_CLIC = `/api/aj-signalement/desinscription/un-clic/${JETON_UN_CLIC}`

    async function envoyer(chemin: string, methode: string, origine?: string) {
      const headers: Record<string, string> = origine === undefined ? {} : { origin: origine }
      const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`, { method: methode, headers }))
      return { statut: reponse.status, suite: reponse.headers.get('x-middleware-next'), vers: reponse.headers.get('location') }
    }

    it.each(['https://mail.exemple.test', 'null', undefined])(
      'POST « un clic » d’un message déjà envoyé, Origin %s : laissé à la route, ni 403 ni redirection',
      async (origine) => {
        const r = await envoyer(ANCIEN_UN_CLIC, 'POST', origine)
        expect(r).toEqual({ statut: 200, suite: '1', vers: null })
        expect(appelsGetUser).toBe(0)
      },
    )

    it.each([
      ['/api/aj-signalement/tableau', 'GET'],
      ['/api/aj-signalement/signalements', 'POST'],
      ['/api/cron/aj-diffusion-reprise', 'POST'],
      [ANCIEN_UN_CLIC, 'GET'],
    ])('%s (%s, sans Origin étranger) : laissé passer, jamais redirigé', async (chemin, methode) => {
      expect(await envoyer(chemin, methode)).toEqual({ statut: 200, suite: '1', vers: null })
    })

    it.each([
      '/api/aj-signalement/desinscription',
      '/api/aj-signalement/signalements',
      `${ANCIEN_UN_CLIC}/autre`,
      '/api/aj-signalement/desinscription/un-clic/pas-un-jeton',
      '/api/cron/aj-diffusion-reprise',
    ])('POST %s avec un Origin étranger : toujours 403 (le contrôle d’Origin vaut aussi sous l’ancien préfixe)', async (chemin) => {
      expect((await envoyer(chemin, 'POST', 'https://mail.exemple.test')).statut).toBe(403)
    })

    it.each(['PATCH', 'PUT', 'DELETE'])('%s sur l’ancien chemin un clic avec un Origin étranger : 403', async (methode) => {
      expect((await envoyer(ANCIEN_UN_CLIC, methode, 'https://mail.exemple.test')).statut).toBe(403)
    })
  })

  describe('compte ouvert avant le renommage : ancienne clé du repère de routage', () => {
    const G_D_AVANT = { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'cabinet-exemple' }

    it('espace de SON cabinet : servi', async () => {
      connecte(G_D_AVANT)
      const reponse = await middleware(new NextRequest('https://vitfix.io/cabinet-exemple/suivi/'))
      expect(reponse.status).toBe(200)
      expect(reponse.headers.get('location')).toBeNull()
    })

    it('espace d’un autre cabinet : renvoyé à la connexion de cet autre cabinet (message neutre)', async () => {
      connecte(G_D_AVANT)
      const r = await visiter('/autre-cabinet/suivi/')
      expect(r.statut).toBe(307)
      expect(r.vers?.pathname).toBe('/autre-cabinet/connexion/')
    })

    it.each(['/fr/', '/fr/auth/login', '/fr/vitfixsignal/', '/fr/vitfixsignal/connexion/', '/fr/client/dashboard/'])(
      'depuis %s : aiguillé vers /cabinet-exemple/suivi/', async (chemin) => {
        connecte(G_D_AVANT)
        const r = await visiter(chemin)
        expect(r.statut).toBe(307)
        expect(r.vers?.pathname).toBe('/cabinet-exemple/suivi/')
      })
  })
})
