/**
 * Gardes du middleware sur /{locale}/artisan/dashboard et /admin/dashboard.
 *
 * Avant : ces deux routes n'entraient jamais dans le contrôle d'accès du middleware (/artisan/dashboard absent de
 * needsAuth, /admin/ exclu comme route interne) ; elles répondaient 200 sans session, alors que /pro/dashboard (même
 * composant) redirige vers la connexion.
 * Le rôle absent (app_metadata.role vide) reste servi sur /artisan/dashboard : un artisan peut s'y trouver (init-role
 * appelé sans session quand la confirmation e-mail est active ; /auth/confirmed l'y envoie via user_metadata.role) et
 * la page le traite comme artisan (`app_metadata.role || 'artisan'`).
 * Plus bas : la matrice complète rôle × tableau de bord, et la page de connexion, que le middleware ne redirige jamais.
 * Le client Supabase est simulé : on ne teste que la décision de routage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Utilisateur = { app_metadata: { role?: string; _original_role?: string } }

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

async function visiter(chemin: string) {
  const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`))
  const location = reponse.headers.get('location')
  // Le site est en trailingSlash : on compare les chemins sans la barre finale.
  return {
    statut: reponse.status,
    vers: location ? new URL(location).pathname.replace(/(.)\/$/, '$1') : null,
    cookieLocale: reponse.cookies.get('locale')?.value ?? null,
    csp: reponse.headers.get('content-security-policy'),
  }
}

// En production (next.config.ts : trailingSlash: true), Next répond 308 vers l'URL avec barre finale AVANT le
// middleware : celui-ci ne reçoit que des chemins terminés par « / », et sa redirection garde la barre finale.
async function visiterEnProduction(chemin: string) {
  if (!new URL(chemin, 'https://vitfix.io').pathname.endsWith('/')) {
    throw new Error(`${chemin} : en production, le middleware ne reçoit que des chemins avec barre finale`)
  }
  const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`, { nextConfig: { trailingSlash: true } }))
  return { statut: reponse.status, location: reponse.headers.get('location') }
}

const connecte = (role?: string, metadonnees: Partial<Utilisateur['app_metadata']> = {}) => {
  utilisateurCourant = { app_metadata: { role, ...metadonnees } }
}

// Comptes couverts : `null` = visiteur sans session ; sinon la valeur de app_metadata.role (undefined = rôle absent).
const COMPTES: Array<[libelle: string, role: string | undefined | null]> = [
  ['non connecté', null],
  ['rôle absent', undefined],
  ['rôle vide', ''],
  ['rôle inconnu', 'role_inconnu'],
  ['client', 'client'],
  ['particulier', 'particulier'],
  ['locataire', 'locataire'],
  ['coproprio', 'coproprio'],
  ['artisan', 'artisan'],
  ['pro_societe', 'pro_societe'],
  ['pro_conciergerie', 'pro_conciergerie'],
  ['pro_gestionnaire', 'pro_gestionnaire'],
  ['syndic', 'syndic'],
  ['syndic_admin', 'syndic_admin'],
  ['super_admin', 'super_admin'],
]

const ouvrirSession = (role: string | undefined | null) => {
  if (role === null) utilisateurCourant = null
  else connecte(role)
}

beforeEach(() => {
  utilisateurCourant = null
  appelsGetUser = 0
})

describe('/{locale}/artisan/dashboard', () => {
  it('redirige un visiteur non connecté vers la connexion, comme /pro/dashboard', async () => {
    expect(await visiter('/fr/artisan/dashboard/')).toMatchObject({ statut: 307, vers: '/fr/auth/login' })
    expect(await visiter('/fr/pro/dashboard/')).toMatchObject({ statut: 307, vers: '/fr/auth/login' })
  })

  it('garde la langue de l’URL dans la redirection', async () => {
    expect(await visiter('/pt/artisan/dashboard/')).toMatchObject({ vers: '/pt/auth/login' })
  })

  it('couvre les sous-chemins et le chemin sans barre finale', async () => {
    expect(await visiter('/fr/artisan/dashboard/devis/')).toMatchObject({ vers: '/fr/auth/login' })
    expect(await visiter('/fr/artisan/dashboard')).toMatchObject({ vers: '/fr/auth/login' })
  })

  it('laisse passer un artisan', async () => {
    connecte('artisan')
    expect(await visiter('/fr/artisan/dashboard/')).toMatchObject({ statut: 200, vers: null })
  })

  it('laisse passer un compte sans rôle (la page le traite comme artisan)', async () => {
    connecte(undefined)
    expect(await visiter('/fr/artisan/dashboard/')).toMatchObject({ statut: 200, vers: null })
    connecte('')
    expect(await visiter('/fr/artisan/dashboard/')).toMatchObject({ statut: 200, vers: null })
  })

  it('laisse passer le super_admin, y compris en impersonation artisan', async () => {
    connecte('super_admin')
    expect(await visiter('/fr/artisan/dashboard/')).toMatchObject({ statut: 200, vers: null })
    connecte('artisan', { _original_role: 'super_admin' })
    expect(await visiter('/fr/artisan/dashboard/')).toMatchObject({ statut: 200, vers: null })
  })

  it.each(['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'])('renvoie un compte %s vers /pro/dashboard', async (role) => {
    connecte(role)
    expect(await visiter('/fr/artisan/dashboard/')).toMatchObject({ vers: '/fr/pro/dashboard' })
  })

  it.each(['client', 'particulier'])('renvoie un compte %s vers /client/dashboard', async (role) => {
    connecte(role)
    expect(await visiter('/fr/artisan/dashboard/')).toMatchObject({ vers: '/fr/client/dashboard' })
  })

  it('renvoie les rôles syndic et copropriété vers leur espace', async () => {
    connecte('syndic')
    expect(await visiter('/fr/artisan/dashboard/')).toMatchObject({ vers: '/fr/syndic/dashboard' })
    connecte('coproprio')
    expect(await visiter('/fr/artisan/dashboard/')).toMatchObject({ vers: '/fr/coproprietaire/dashboard' })
  })

  it('pose la CSP sur la redirection', async () => {
    const reponse = await visiter('/fr/artisan/dashboard/')
    expect(reponse).toMatchObject({ statut: 307, vers: '/fr/auth/login' })
    expect(reponse.csp).toContain("default-src 'self'")
  })
})

describe('/pro/dashboard (inchangé)', () => {
  it('renvoie toujours un artisan vers /artisan/dashboard', async () => {
    connecte('artisan')
    expect(await visiter('/fr/pro/dashboard/')).toMatchObject({ vers: '/fr/artisan/dashboard' })
  })

  it('laisse passer un compte pro_societe', async () => {
    connecte('pro_societe')
    expect(await visiter('/fr/pro/dashboard/')).toMatchObject({ statut: 200, vers: null })
  })

  // L'exemption « rôle absent » vaut pour /artisan/dashboard seulement : ici, pas d'accès au tableau de bord BTP.
  it('renvoie toujours un compte sans rôle vers /client/dashboard', async () => {
    connecte(undefined)
    expect(await visiter('/fr/pro/dashboard/')).toMatchObject({ statut: 307, vers: '/fr/client/dashboard' })
    connecte('')
    expect(await visiter('/fr/pro/dashboard/')).toMatchObject({ statut: 307, vers: '/fr/client/dashboard' })
  })
})

describe('/admin/dashboard', () => {
  it('redirige un visiteur non connecté vers /admin/login, sans préfixe de langue', async () => {
    expect(await visiter('/admin/dashboard/')).toMatchObject({ statut: 307, vers: '/admin/login' })
  })

  it('laisse passer le super_admin sans réécrire son cookie de langue', async () => {
    connecte('super_admin')
    expect(await visiter('/admin/dashboard/')).toMatchObject({ statut: 200, vers: null, cookieLocale: null })
  })

  it.each(['artisan', 'pro_societe', 'client', undefined])(
    'laisse la page décider pour un compte %s (elle renvoie vers /admin/login, qui gère la sortie d’impersonation)',
    async (role) => {
      connecte(role, role === 'artisan' ? { _original_role: 'super_admin' } : {})
      expect(await visiter('/admin/dashboard/')).toMatchObject({ statut: 200, vers: null })
    },
  )

  it.each(['/admin/login/', '/admin/exit/'])('laisse %s accessible sans session (pas de boucle)', async (chemin) => {
    expect(await visiter(chemin)).toMatchObject({ statut: 200, vers: null })
  })

  it('ne pose pas de cookie de langue sur les routes /admin/', async () => {
    connecte('artisan')
    expect(await visiter('/admin/dashboard/')).toMatchObject({ cookieLocale: null })
  })
})

describe('routes non concernées', () => {
  it('n’interroge pas Supabase pour les routes /api/', async () => {
    connecte('artisan')
    expect(await visiter('/api/health/')).toMatchObject({ statut: 200, vers: null })
    expect(appelsGetUser).toBe(0)
  })

  it('laisse publique la fiche artisan SEO /fr/artisan/:id', async () => {
    expect(await visiter('/fr/artisan/abc123/')).toMatchObject({ statut: 200, vers: null })
    expect(appelsGetUser).toBe(0)
  })

  // Slug tiré du nom de l'entreprise (lib/utils.ts generateSlug) : « Dashboard Plomberie » → dashboard-plomberie.
  // Seul le segment exact « dashboard » est le tableau de bord (réécritures de next.config.ts).
  it('laisse publique une fiche artisan dont le slug commence par « dashboard »', async () => {
    connecte('client')
    expect(await visiter('/fr/artisan/dashboard-plomberie/')).toMatchObject({ statut: 200, vers: null })
    expect(await visiter('/fr/artisan/dashboard-plomberie')).toMatchObject({ statut: 200, vers: null })
    expect(appelsGetUser).toBe(0)
  })
})

/**
 * Matrice complète des gardes, telle que servie en production (barre finale) : chaque compte garde exactement ses
 * redirections. `null` = 200 sans redirection. Toute modification du middleware doit laisser cette table intacte.
 */
describe('gardes du middleware : chaque rôle garde exactement ses redirections', () => {
  const ROUTES = [
    '/fr/',
    '/fr/client/dashboard/',
    '/fr/pro/dashboard/',
    '/fr/pro/mobile/',
    '/fr/artisan/dashboard/',
    '/fr/syndic/dashboard/',
    '/fr/coproprietaire/dashboard/',
    '/fr/administrateur-judiciaire/',
    '/admin/dashboard/',
  ] as const

  const CONNEXION = '/fr/auth/login'
  const CLIENT = '/fr/client/dashboard'
  const PRO = '/fr/pro/dashboard'
  const ARTISAN = '/fr/artisan/dashboard'
  const SYNDIC = '/fr/syndic/dashboard'
  const COPRO = '/fr/coproprietaire/dashboard'
  const PASSE = null

  // Destinations dans l'ordre de ROUTES.
  const DESTINATIONS: Record<string, Array<string | null>> = {
    'non connecté': [PASSE, CONNEXION, CONNEXION, CONNEXION, CONNEXION, '/fr/syndic/login', '/fr/coproprietaire/portail', '/fr/syndic/login', '/admin/login'],
    'rôle absent': [CLIENT, PASSE, CLIENT, CLIENT, PASSE, CONNEXION, PASSE, CONNEXION, PASSE],
    'rôle vide': [CLIENT, PASSE, CLIENT, CLIENT, PASSE, CONNEXION, PASSE, CONNEXION, PASSE],
    'rôle inconnu': [CLIENT, PASSE, CLIENT, CLIENT, CLIENT, CONNEXION, PASSE, CONNEXION, PASSE],
    client: [CLIENT, PASSE, CLIENT, CLIENT, CLIENT, CONNEXION, PASSE, CONNEXION, PASSE],
    particulier: [CLIENT, PASSE, CLIENT, CLIENT, CLIENT, CONNEXION, PASSE, CONNEXION, PASSE],
    locataire: [CLIENT, PASSE, COPRO, COPRO, COPRO, COPRO, PASSE, CONNEXION, PASSE],
    coproprio: [COPRO, PASSE, COPRO, COPRO, COPRO, COPRO, PASSE, CONNEXION, PASSE],
    artisan: [ARTISAN, ARTISAN, ARTISAN, PASSE, PASSE, ARTISAN, PASSE, CONNEXION, PASSE],
    pro_societe: [PRO, PRO, PASSE, PASSE, PRO, PRO, PASSE, CONNEXION, PASSE],
    pro_conciergerie: [PRO, PRO, PASSE, PASSE, PRO, PRO, PASSE, CONNEXION, PASSE],
    pro_gestionnaire: [PRO, PRO, PASSE, PASSE, PRO, PRO, PASSE, CONNEXION, PASSE],
    syndic: [SYNDIC, SYNDIC, SYNDIC, SYNDIC, SYNDIC, PASSE, PASSE, PASSE, PASSE],
    syndic_admin: [SYNDIC, SYNDIC, SYNDIC, SYNDIC, SYNDIC, PASSE, PASSE, PASSE, PASSE],
    super_admin: [PASSE, PASSE, PASSE, PASSE, PASSE, PASSE, PASSE, PASSE, PASSE],
  }

  const CAS = COMPTES.flatMap(([libelle, role]) =>
    ROUTES.map((route, i) => [libelle, route, DESTINATIONS[libelle][i], role] as const),
  )

  it('couvre chaque compte de COMPTES', () => {
    expect(Object.keys(DESTINATIONS).sort()).toEqual(COMPTES.map(([libelle]) => libelle).sort())
  })

  it.each(CAS)('%s sur %s → %s', async (_libelle, route, destination, role) => {
    ouvrirSession(role)
    const { statut, location } = await visiterEnProduction(route)
    if (destination === null) {
      expect({ statut, location }).toEqual({ statut: 200, location: null })
    } else {
      // 307 (temporaire), destination avec la barre finale : pas de 308 supplémentaire côté Next.
      expect({ statut, location }).toEqual({ statut: 307, location: `https://vitfix.io${destination}/` })
    }
  })
})

/**
 * /{locale}/auth/login/ n'est jamais redirigée côté serveur : c'est la seule porte pour changer de compte, la page
 * décide d'après getUser. En production, c'était déjà le cas (barre finale : la comparaison exacte à '/auth/login'
 * ne correspondait jamais) ; sans barre finale (tests, requête directe au middleware), le middleware renvoyait un
 * compte connecté vers son tableau de bord.
 */
describe('/{locale}/auth/login : jamais redirigée par le middleware', () => {
  it.each(COMPTES)('URL de production (barre finale), compte %s : 200, sans appel à Supabase', async (_libelle, role) => {
    ouvrirSession(role)
    expect(await visiterEnProduction('/fr/auth/login/')).toEqual({ statut: 200, location: null })
    expect(await visiterEnProduction('/pt/auth/login/')).toEqual({ statut: 200, location: null })
    expect(await visiterEnProduction('/fr/auth/login/?session=echec')).toEqual({ statut: 200, location: null })
    expect(appelsGetUser).toBe(0)
  })

  it.each(COMPTES)('chemin sans barre finale, compte %s : même décision qu’avec la barre finale', async (_libelle, role) => {
    ouvrirSession(role)
    expect(await visiter('/fr/auth/login')).toMatchObject({ statut: 200, vers: null })
    expect(await visiter('/pt/auth/login')).toMatchObject({ statut: 200, vers: null })
    expect(appelsGetUser).toBe(0)
  })

  it('les redirections vers la connexion s’arrêtent sur la page de connexion (pas de boucle côté serveur)', async () => {
    connecte('client')
    expect(await visiterEnProduction('/fr/syndic/dashboard/')).toEqual({ statut: 307, location: 'https://vitfix.io/fr/auth/login/' })
    expect(await visiterEnProduction('/fr/auth/login/')).toEqual({ statut: 200, location: null })
  })

  it('la page de connexion reçoit la CSP et le cookie de langue manquant', async () => {
    connecte('client')
    const reponse = await visiter('/pt/auth/login/')
    expect(reponse.csp).toContain("default-src 'self'")
    expect(reponse.cookieLocale).toBe('pt')
  })
})
