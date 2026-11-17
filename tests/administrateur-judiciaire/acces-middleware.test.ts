/**
 * Accès à la succursale Administrateur Judiciaire (middleware) : réservée aux comptes syndic et au super_admin.
 * Le client Supabase est simulé : on ne teste que la décision de routage et l'en-tête X-Robots-Tag des redirections
 * (OpenNext n'ajoute pas les headers() de next.config.ts aux réponses 3xx du middleware).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

let utilisateurCourant: { app_metadata: { role?: string } } | null = null

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: utilisateurCourant } }) },
  }),
}))

const { middleware } = await import('@/middleware')

async function visiter(chemin: string) {
  const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`))
  const location = reponse.headers.get('location')
  // Le site est en trailingSlash : on compare les chemins sans la barre finale.
  return {
    statut: reponse.status,
    vers: location ? new URL(location).pathname.replace(/(.)\/$/, '$1') : null,
    robots: reponse.headers.get('x-robots-tag'),
  }
}

const connecte = (role?: string) => {
  utilisateurCourant = { app_metadata: { role } }
}

describe('accès à /administrateur-judiciaire', () => {
  beforeEach(() => {
    utilisateurCourant = null
  })

  it('redirige un visiteur non connecté vers la connexion syndic', async () => {
    expect(await visiter('/fr/administrateur-judiciaire/')).toMatchObject({ vers: '/fr/syndic/login' })
  })

  it('garde la langue de l’URL dans la redirection', async () => {
    expect(await visiter('/pt/administrateur-judiciaire/')).toMatchObject({ vers: '/pt/syndic/login' })
  })

  it.each(['syndic', 'syndic_gestionnaire', 'syndic_admin'])('laisse passer un compte %s', async (role) => {
    connecte(role)
    expect(await visiter('/fr/administrateur-judiciaire/')).toMatchObject({ statut: 200, vers: null })
  })

  it('laisse passer le super_admin', async () => {
    connecte('super_admin')
    expect(await visiter('/fr/administrateur-judiciaire/')).toMatchObject({ statut: 200, vers: null })
  })

  it.each(['artisan', 'pro_societe', 'coproprio', 'locataire', undefined])(
    'renvoie un compte %s vers /auth/login (qui le redirige vers son espace)',
    async (role) => {
      connecte(role)
      expect(await visiter('/fr/administrateur-judiciaire/')).toMatchObject({ vers: '/fr/auth/login' })
    },
  )

  it('ajoute d’abord la langue quand l’URL n’en a pas', async () => {
    const { statut, vers } = await visiter('/administrateur-judiciaire/')
    expect(statut).toBe(302)
    expect(vers).toMatch(/^\/(fr|pt|en|nl|es)\/administrateur-judiciaire$/)
  })

  it('ne change rien aux routes voisines (/syndic/v54-fr reste publique)', async () => {
    expect(await visiter('/fr/syndic/v54-fr/')).toMatchObject({ statut: 200, vers: null })
  })
})

describe('X-Robots-Tag sur les redirections de la succursale', () => {
  const NOINDEX = 'noindex, nofollow, noarchive'

  beforeEach(() => {
    utilisateurCourant = null
  })

  it('redirection de langue (302) d’une URL sans langue', async () => {
    expect(await visiter('/administrateur-judiciaire/')).toMatchObject({ statut: 302, robots: NOINDEX })
  })

  it.each(['/fr/administrateur-judiciaire/', '/pt/administrateur-judiciaire/', '/fr/administrateur-judiciaire/dossiers/'])(
    'redirection vers la connexion syndic (307) d’un visiteur non connecté : %s',
    async (chemin) => {
      expect(await visiter(chemin)).toMatchObject({ statut: 307, robots: NOINDEX })
    },
  )

  it('redirection vers /auth/login (307) d’un compte non syndic', async () => {
    connecte('artisan')
    expect(await visiter('/fr/administrateur-judiciaire/')).toMatchObject({ statut: 307, vers: '/fr/auth/login', robots: NOINDEX })
  })

  it('ne marque pas les redirections des autres espaces', async () => {
    expect(await visiter('/fr/pro/dashboard/')).toMatchObject({ statut: 307, vers: '/fr/auth/login', robots: null })
    expect(await visiter('/fr/syndic/dashboard/')).toMatchObject({ statut: 307, vers: '/fr/syndic/login', robots: null })
    expect(await visiter('/pro/dashboard/')).toMatchObject({ statut: 302, robots: null })
  })
})
