/**
 * Espace « AJ Signalement » (/fr/aj-signalement/, demandes de Hugo du 10 et du 11/11/2026) : contrôle d'accès du
 * middleware, avec la page de connexion professionnelle de l'espace (/fr/aj-signalement/connexion/).
 *
 * - sans session : 307 vers la page de connexion de l'espace dans la langue (la requête d'origine n'est pas reprise) ;
 * - tout autre compte : même 307 vers la page de connexion de l'espace (message neutre là-bas), jamais l'espace du
 *   compte ni la page de connexion générale, plus de 403 ;
 * - super admin : page servie ; depuis /en/, /nl/ ou /es/ (aucune page dans ces langues), renvoi vers
 *   /pt/aj-signalement/. La « vue en tant que » (_original_role) est refusée depuis le 11/11/2026, comme par les
 *   routes de l'API (isSuperAdmin, #650) ;
 * - page de connexion de l'espace : servie sans session et à un compte sans accès (aucune boucle) ; un compte admis
 *   est envoyé dans l'espace ;
 * - chaque redirection qui part de l'espace (302 de langue, 307) porte X-Robots-Tag (OpenNext n'ajoute pas les
 *   headers() de next.config.ts aux réponses du middleware) ;
 * - la page publique du QR code (/fr/signalement/<jeton>/) et la route /api/aj-signalement/* restent sans contrôle
 *   ni appel à Supabase ; la page de connexion générale (/fr/auth/login/) n'est pas touchée.
 * Le client Supabase est simulé : seule la décision de routage est testée. Seul app_metadata compte.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Utilisateur = { app_metadata: Record<string, unknown>; user_metadata?: Record<string, unknown> }

let utilisateurCourant: Utilisateur | null = null
let appelsGetUser = 0

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => {
        appelsGetUser += 1
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
})

describe('espace, sans session : page de connexion de l’espace', () => {
  it.each([
    ['/fr/aj-signalement/', '/fr/aj-signalement/connexion'],
    ['/fr/aj-signalement', '/fr/aj-signalement/connexion'],
    ['/pt/aj-signalement/', '/pt/aj-signalement/connexion'],
    ['/en/aj-signalement/', '/pt/aj-signalement/connexion'],
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
    const r = await visiter('/fr/aj-signalement/?jeton=abc&redirect=//evil.example')
    expect(cheminDe(r)).toBe('/fr/aj-signalement/connexion')
    expect(r.vers?.search).toBe('')
    expect(r.vers?.origin).toBe('https://vitfix.io')
  })

  it('jamais la page de connexion générale', async () => {
    const r = await visiter('/fr/aj-signalement/')
    expect(cheminDe(r)).not.toBe('/fr/auth/login')
    expect(r.vers?.searchParams.has('retour')).toBe(false)
  })

  it('URL sans langue : d’abord la langue (302), déjà marquée non indexable', async () => {
    const r = await visiter('/aj-signalement/')
    expect(r.statut).toBe(302)
    expect(r.vers?.pathname).toMatch(/^\/(fr|pt|en|nl|es)\/aj-signalement\/$/)
    expect(r.robots).toBe(NOINDEX)
  })
})

describe('espace, autre compte connecté : page de connexion de l’espace (message neutre), plus de 403', () => {
  it.each(['syndic', 'syndic_gestionnaire', 'syndic_admin', 'coproprio', 'locataire', 'artisan', 'pro_societe', 'client', undefined])(
    'compte %s : 307 vers /fr/aj-signalement/connexion/, jamais l’espace du compte, non indexable',
    async (role) => {
      connecte({ role })
      const r = await visiter('/fr/aj-signalement/')
      expect(r.statut).toBe(307)
      expect(cheminDe(r)).toBe('/fr/aj-signalement/connexion')
      expect(r.vers?.search).toBe('')
      expect(r.robots).toBe(NOINDEX)
      expect(r.csp).toBeTruthy()
    },
  )

  it('user_metadata trafiqué : même renvoi (seul app_metadata compte)', async () => {
    connecte({ role: 'coproprio' }, { role: 'super_admin', _original_role: 'super_admin' })
    expect(cheminDe(await visiter('/fr/aj-signalement/'))).toBe('/fr/aj-signalement/connexion')
  })

  it('/fr/aj-signalement/<sous-chemin>/ : même contrôle', async () => {
    connecte({ role: 'syndic' })
    const r = await visiter('/fr/aj-signalement/gestionnaires/')
    expect(r.statut).toBe(307)
    expect(cheminDe(r)).toBe('/fr/aj-signalement/connexion')
  })

  it('en portugais et depuis /en/ : connexion de l’espace sous /pt/', async () => {
    connecte({ role: 'syndic' })
    expect(cheminDe(await visiter('/pt/aj-signalement/'))).toBe('/pt/aj-signalement/connexion')
    expect(cheminDe(await visiter('/en/aj-signalement/'))).toBe('/pt/aj-signalement/connexion')
  })
})

describe('espace, super admin', () => {
  it('page servie, réponse privée (aucun cache partagé)', async () => {
    connecte({ role: 'super_admin' })
    const r = await visiter('/fr/aj-signalement/')
    expect(r).toMatchObject({ statut: 200, vers: null })
    expect(r.cache).toContain('no-store')
    expect(r.cache).toContain('private')
  })

  it('« vue en tant que » ouverte par un super admin (_original_role) : refusée comme les routes, donc envoyée à la connexion', async () => {
    connecte({ role: 'coproprio', _original_role: 'super_admin', _admin_override: true })
    const r = await visiter('/fr/aj-signalement/')
    expect(r.statut).toBe(307)
    expect(r.vers?.pathname.replace(/\/$/, '')).toBe('/fr/aj-signalement/connexion')
    expect(r.vers?.search).toBe('')
  })

  it('en portugais aussi', async () => {
    connecte({ role: 'super_admin' })
    expect(await visiter('/pt/aj-signalement/')).toMatchObject({ statut: 200, vers: null })
  })

  it.each(['en', 'nl', 'es'])('/%s/aj-signalement/ (aucune page dans cette langue) : renvoi vers /pt/aj-signalement/, non indexable', async (langue) => {
    connecte({ role: 'super_admin' })
    const r = await visiter(`/${langue}/aj-signalement/?x=1`)
    expect(r.statut).toBe(307)
    expect(r.vers?.pathname).toBe('/pt/aj-signalement/')
    expect(r.vers?.search).toBe('')
    expect(r.robots).toBe(NOINDEX)
  })

  it('« vue en tant que » depuis /en/ : refusée, envoyée à la connexion portugaise', async () => {
    connecte({ role: 'coproprio', _original_role: 'super_admin' })
    const r = await visiter('/en/aj-signalement/')
    expect(r.statut).toBe(307)
    expect(r.vers?.pathname.replace(/\/$/, '')).toBe('/pt/aj-signalement/connexion')
  })
})

describe('page de connexion de l’espace (/fr/aj-signalement/connexion/)', () => {
  it.each(['/fr/aj-signalement/connexion/', '/fr/aj-signalement/connexion', '/pt/aj-signalement/connexion/'])(
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
    const r = await visiter('/fr/aj-signalement/connexion/')
    expect(r).toMatchObject({ statut: 200, vers: null })
    expect(r.cache).toContain('no-store')
  })

  it('« vue en tant que » : page servie, jamais l’espace (refusée depuis le 11/11/2026, comme les routes)', async () => {
    connecte({ role: 'coproprio', _original_role: 'super_admin' })
    const r = await visiter('/fr/aj-signalement/connexion/')
    expect(r).toMatchObject({ statut: 200, vers: null })
  })

  it.each([
    ['super admin', { role: 'super_admin' }],
  ])('%s : 307 vers l’espace, non indexable', async (_cas, app) => {
    connecte(app)
    const fr = await visiter('/fr/aj-signalement/connexion/')
    expect(fr.statut).toBe(307)
    expect(fr.vers?.pathname).toBe('/fr/aj-signalement/')
    expect(fr.vers?.search).toBe('')
    expect(fr.robots).toBe(NOINDEX)
    const pt = await visiter('/pt/aj-signalement/connexion/')
    expect(pt.vers?.pathname).toBe('/pt/aj-signalement/')
  })

  it('/en/aj-signalement/connexion/ : sans session vers /pt/aj-signalement/connexion/, super admin vers /pt/aj-signalement/', async () => {
    const sans = await visiter('/en/aj-signalement/connexion/')
    expect(sans.statut).toBe(307)
    expect(cheminDe(sans)).toBe('/pt/aj-signalement/connexion')
    expect(sans.robots).toBe(NOINDEX)
    connecte({ role: 'super_admin' })
    expect((await visiter('/en/aj-signalement/connexion/')).vers?.pathname).toBe('/pt/aj-signalement/')
  })

  it('un segment voisin (/fr/aj-signalement/connexionx/) n’est pas la page de connexion : renvoi vers elle', async () => {
    const r = await visiter('/fr/aj-signalement/connexionx/')
    expect(r.statut).toBe(307)
    expect(cheminDe(r)).toBe('/fr/aj-signalement/connexion')
  })
})

describe('chemins voisins inchangés', () => {
  it('page publique du QR code : servie sans session, sans appel à Supabase, sans X-Robots-Tag du middleware', async () => {
    const r = await visiter(`/fr/signalement/${JETON}/`)
    expect(r).toMatchObject({ statut: 200, vers: null, robots: null })
    expect(appelsGetUser).toBe(0)
  })

  it('/fr/aj-signalements/ (autre segment) : aucun contrôle', async () => {
    const r = await visiter('/fr/aj-signalements/')
    expect(r).toMatchObject({ statut: 200, vers: null })
    expect(appelsGetUser).toBe(0)
  })

  it('route /api/aj-signalement/tableau : aucun contrôle du middleware (la route vérifie le super admin), aucun getUser', async () => {
    const r = await visiter('/api/aj-signalement/tableau')
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
// (lib/aj-signalement/chemin-cabinet.ts) : ni base, ni Supabase, ni cookie ; noindex et réponse privée.
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
    connecte({ role: 'gestionnaire_signalement', aj_signalement_cabinet: 'autre-cabinet' })
    expect((await document('/cabinet-exemple/invitation/')).statut).toBe(200)
    expect(appelsGetUser).toBe(0)
  })

  it.each([
    '/cabinet-exemple/',
    '/blog/',
    `/cabinet-exemple/signalement/${JETON}/autre/`,
    `/cabinet-exemple/signalement/${JETON.slice(1)}/`,
    `/cabinet-exemple/signalement/${JETON.toUpperCase()}/`,
    '/Cabinet-Exemple/confirmation-adresse/',
    `/ab/signalement/${JETON}/`,
    '/cabinet-exemple/suivi/',
    '/cabinet-exemple/invitation/autre/',
    '/Cabinet-Exemple/invitation/',
    // Pages internes de la réécriture : jamais servies directement.
    '/cabinet/cabinet-exemple/invitation/',
    `/cabinet/cabinet-exemple/signalement/${JETON}/`,
  ])('%s : hors du motif, 302 de langue comme avant (puis 404 s’il n’y a pas de page)', async (chemin) => {
    const r = await document(chemin)
    expect(r.statut).toBe(302)
    expect(new URL(r.location ?? '', 'https://vitfix.io').pathname).toBe(`/pt${chemin}`)
    expect(r.robots).toBeNull()
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
