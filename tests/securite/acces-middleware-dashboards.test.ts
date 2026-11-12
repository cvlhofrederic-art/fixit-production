/**
 * Gardes du middleware sur /{locale}/artisan/dashboard et /admin/dashboard.
 *
 * Avant : ces deux routes n'entraient jamais dans le contrôle d'accès du middleware (/artisan/dashboard absent de
 * needsAuth, /admin/ exclu comme route interne) ; elles répondaient 200 sans session, alors que /pro/dashboard (même
 * composant) redirige vers la connexion.
 * Le rôle absent (app_metadata.role vide) reste servi sur /artisan/dashboard : un artisan peut s'y trouver (init-role
 * appelé sans session quand la confirmation e-mail est active ; /auth/confirmed l'y envoie via user_metadata.role) et
 * la page le traite comme artisan (`app_metadata.role || 'artisan'`).
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

const connecte = (role?: string, metadonnees: Partial<Utilisateur['app_metadata']> = {}) => {
  utilisateurCourant = { app_metadata: { role, ...metadonnees } }
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

// Pages communes (connexion, tableaux de bord) réécrites sous /fr/ et /pt/ seulement (next.config.ts) : depuis /en/,
// /nl/ ou /es/, les redirections visaient /en/artisan/dashboard/… en 404 (logo, « Find a professional », avis et
// contact des pages EN mènent à /en/, que le middleware renvoie vers l'espace d'un compte connecté).
describe('redirections depuis EN, NL et ES : vers les pages PT', () => {
  it.each([
    ['/en/', 'artisan', '/pt/artisan/dashboard'],
    ['/nl/', 'client', '/pt/client/dashboard'],
    ['/es/', 'pro_societe', '/pt/pro/dashboard'],
    ['/en/', 'syndic', '/pt/syndic/dashboard'],
    ['/nl/', 'coproprio', '/pt/coproprietaire/dashboard'],
    ['/en/auth/login', 'artisan', '/pt/artisan/dashboard'],
  ])('compte connecté sur %s (%s) → %s', async (chemin, role, attendu) => {
    connecte(role)
    expect(await visiter(chemin)).toMatchObject({ statut: 307, vers: attendu })
  })

  it('espace d’un autre rôle : vers le sien, sous /pt/', async () => {
    connecte('artisan')
    expect(await visiter('/en/client/dashboard/')).toMatchObject({ statut: 307, vers: '/pt/artisan/dashboard' })
  })

  it.each([
    ['/en/artisan/dashboard/', '/pt/auth/login'],
    ['/nl/syndic/dashboard/', '/pt/syndic/login'],
    ['/es/coproprietaire/dashboard/', '/pt/coproprietaire/portail'],
  ])('sans session, %s → %s', async (chemin, attendu) => {
    expect(await visiter(chemin)).toMatchObject({ statut: 307, vers: attendu })
  })

  it('FR et PT gardent leur langue', async () => {
    connecte('artisan')
    expect(await visiter('/fr/')).toMatchObject({ statut: 307, vers: '/fr/artisan/dashboard' })
    expect(await visiter('/pt/')).toMatchObject({ statut: 307, vers: '/pt/artisan/dashboard' })
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

// Départ de l'appli Vitfix Pro (capacitor.config.ts : server.url + appStartPath '/pro/mobile/').
describe('/{locale}/pro/mobile — espace mobile des artisans', () => {
  it('départ sans langue : redirige vers la langue du pays', async () => {
    for (const [pays, attendu] of [['FR', '/fr/pro/mobile/'], ['PT', '/pt/pro/mobile/']]) {
      const reponse = await middleware(new NextRequest('https://vitfix.io/pro/mobile/', { headers: { 'cf-ipcountry': pays } }))
      expect(reponse.status).toBe(302)
      expect(new URL(reponse.headers.get('location') ?? '').pathname).toBe(attendu)
    }
  })

  it('redirige un visiteur non connecté vers la connexion', async () => {
    expect(await visiter('/fr/pro/mobile/')).toMatchObject({ statut: 307, vers: '/fr/auth/login' })
  })

  it('laisse passer un artisan', async () => {
    connecte('artisan')
    expect(await visiter('/fr/pro/mobile/')).toMatchObject({ statut: 200, vers: null })
  })

  // Règle n° 1 artisan / BTP : une société BTP a aussi une fiche profiles_artisan, seule vérification de la page.
  it.each(['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'])('renvoie un compte %s vers /pro/dashboard', async (role) => {
    connecte(role)
    expect(await visiter('/fr/pro/mobile/')).toMatchObject({ statut: 307, vers: '/fr/pro/dashboard' })
    expect(await visiter('/pt/pro/mobile')).toMatchObject({ statut: 307, vers: '/pt/pro/dashboard' })
  })

  it('renvoie client, syndic et copropriétaire vers leur espace', async () => {
    connecte('client')
    expect(await visiter('/fr/pro/mobile/')).toMatchObject({ vers: '/fr/client/dashboard' })
    connecte('syndic')
    expect(await visiter('/fr/pro/mobile/')).toMatchObject({ vers: '/fr/syndic/dashboard' })
    connecte('coproprio')
    expect(await visiter('/fr/pro/mobile/')).toMatchObject({ vers: '/fr/coproprietaire/dashboard' })
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
