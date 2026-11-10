/**
 * Espace « AJ Signalement » (/fr/aj-signalement/, demande de Hugo du 10/11/2026) : contrôle d'accès du middleware.
 *
 * - sans session : 307 vers la page de connexion de la langue, avec ?retour=<adresse de l'espace> (la requête
 *   d'origine n'est pas reprise) ;
 * - super admin, ou « vue en tant que » ouverte par un super admin (_original_role) : page servie ; depuis /en/, /nl/
 *   ou /es/ (aucune page dans ces langues), renvoi vers /pt/aj-signalement/, comme sans session ;
 * - tout autre compte : 403 neutre rendu par le middleware lui-même (HTML minimal, aucune donnée), jamais une
 *   redirection vers l'espace du compte ;
 * - chaque réponse qui part de l'espace (302 de langue, 307, 403) porte X-Robots-Tag (OpenNext n'ajoute pas les
 *   headers() de next.config.ts aux réponses du middleware) ;
 * - la page publique du QR code (/fr/signalement/<jeton>/) reste sans contrôle ni appel à Supabase.
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
    type: reponse.headers.get('content-type'),
    corps: await reponse.text(),
  }
}

const connecte = (app_metadata: Record<string, unknown>, user_metadata: Record<string, unknown> = {}) => {
  utilisateurCourant = { app_metadata, user_metadata }
}

beforeEach(() => {
  utilisateurCourant = null
  appelsGetUser = 0
})

describe('sans session', () => {
  it.each([
    ['/fr/aj-signalement/', '/fr/auth/login', '/fr/aj-signalement/'],
    ['/fr/aj-signalement', '/fr/auth/login', '/fr/aj-signalement/'],
    ['/pt/aj-signalement/', '/pt/auth/login', '/pt/aj-signalement/'],
  ])('%s : 307 vers %s avec retour=%s, non indexable', async (chemin, connexion, retour) => {
    const r = await visiter(chemin)
    expect(r.statut).toBe(307)
    // nextUrl.clone() reprend la barre finale de la requête (en production, le 308 de trailingSlash passe avant).
    expect(r.vers?.pathname.replace(/\/$/, '')).toBe(connexion)
    expect(r.vers?.searchParams.get('retour')).toBe(retour)
    expect(r.robots).toBe(NOINDEX)
    expect(r.csp).toBeTruthy()
    expect(appelsGetUser).toBe(1)
  })

  it('la requête d’origine n’est pas reprise : seul le retour est posé', async () => {
    const r = await visiter('/fr/aj-signalement/?jeton=abc&redirect=//evil.example')
    expect(r.vers?.search).toBe('?retour=%2Ffr%2Faj-signalement%2F')
  })

  it('URL sans langue : d’abord la langue (302), déjà marquée non indexable', async () => {
    const r = await visiter('/aj-signalement/')
    expect(r.statut).toBe(302)
    expect(r.vers?.pathname).toMatch(/^\/(fr|pt|en|nl|es)\/aj-signalement\/$/)
    expect(r.robots).toBe(NOINDEX)
  })
})

describe('super admin', () => {
  it('page servie, réponse privée (aucun cache partagé)', async () => {
    connecte({ role: 'super_admin' })
    const r = await visiter('/fr/aj-signalement/')
    expect(r).toMatchObject({ statut: 200, vers: null })
    expect(r.cache).toContain('no-store')
    expect(r.cache).toContain('private')
  })

  it('« vue en tant que » ouverte par un super admin (_original_role) : page servie', async () => {
    connecte({ role: 'coproprio', _original_role: 'super_admin', _admin_override: true })
    const r = await visiter('/fr/aj-signalement/')
    expect(r).toMatchObject({ statut: 200, vers: null })
    expect(r.cache).toContain('no-store')
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

  it('« vue en tant que » depuis /en/ : même renvoi vers /pt/aj-signalement/', async () => {
    connecte({ role: 'coproprio', _original_role: 'super_admin' })
    const r = await visiter('/en/aj-signalement/')
    expect(r.statut).toBe(307)
    expect(r.vers?.pathname).toBe('/pt/aj-signalement/')
  })
})

describe('langues sans page (en, nl, es) : même destination avec ou sans session', () => {
  it('sans session : connexion /pt/ avec retour vers /pt/aj-signalement/', async () => {
    const r = await visiter('/en/aj-signalement/')
    expect(r.statut).toBe(307)
    expect(r.vers?.pathname.replace(/\/$/, '')).toBe('/pt/auth/login')
    expect(r.vers?.searchParams.get('retour')).toBe('/pt/aj-signalement/')
  })

  it('autre compte : refus neutre (403), sans renvoi', async () => {
    connecte({ role: 'syndic' })
    expect(await visiter('/en/aj-signalement/')).toMatchObject({ statut: 403, vers: null })
  })
})

describe('autre compte connecté : refus neutre', () => {
  it.each(['syndic', 'syndic_gestionnaire', 'syndic_admin', 'coproprio', 'locataire', 'artisan', 'pro_societe', 'client', undefined])(
    'compte %s : 403 HTML neutre, sans redirection ni donnée, non indexable, jamais en cache',
    async (role) => {
      connecte({ role })
      const r = await visiter('/fr/aj-signalement/')
      expect(r.statut).toBe(403)
      expect(r.vers).toBeNull()
      expect(r.type).toContain('text/html')
      expect(r.corps).toContain('<html lang="fr">')
      expect(r.corps).toContain('Accès réservé')
      expect(r.corps).not.toContain('aj-signalement')
      expect(r.corps.toLowerCase()).not.toContain('super')
      expect(r.robots).toBe(NOINDEX)
      expect(r.cache).toContain('no-store')
      expect(r.csp).toBeTruthy()
    },
  )

  it('user_metadata trafiqué : refus (seul app_metadata compte)', async () => {
    connecte({ role: 'coproprio' }, { role: 'super_admin', _original_role: 'super_admin' })
    expect((await visiter('/fr/aj-signalement/')).statut).toBe(403)
  })

  it('/fr/aj-signalement/<sous-chemin>/ : même contrôle', async () => {
    connecte({ role: 'syndic' })
    expect((await visiter('/fr/aj-signalement/gestionnaires/')).statut).toBe(403)
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

  it('la succursale AJ garde ses règles (un coproprio est renvoyé vers /auth/login)', async () => {
    connecte({ role: 'coproprio' })
    const r = await visiter('/fr/administrateur-judiciaire/')
    expect(r.statut).toBe(307)
    expect(r.vers?.pathname.replace(/\/$/, '')).toBe('/fr/auth/login')
    expect(r.vers?.searchParams.has('retour')).toBe(false)
  })

  it('les redirections des autres espaces ne sont pas marquées', async () => {
    const r = await visiter('/fr/pro/dashboard/')
    expect(r).toMatchObject({ statut: 307, robots: null })
    expect(r.vers?.searchParams.has('retour')).toBe(false)
  })
})
