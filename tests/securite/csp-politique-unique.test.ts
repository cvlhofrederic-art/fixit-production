/**
 * Content-Security-Policy : une seule politique par réponse, définie dans lib/securite/csp.ts. Le middleware la pose
 * sur ses réponses, next.config.ts headers() seulement sur les chemins exclus du matcher (jamais les deux).
 *
 * En production (OpenNext sur Cloudflare), les en-têtes de headers() (next.config.ts) s'AJOUTENT à ceux du middleware :
 * @opennextjs/aws (core/routingHandler.js) fusionne `{ ...en-têtes du middleware, ...en-têtes de la config }`. La clé
 * du middleware est en minuscules (Headers.set) et celle de la config garde sa casse : les deux sont conservées, puis
 * envoyées jointes par « , ». Le navigateur applique alors les deux politiques, la plus stricte l'emporte : GA4 après
 * consentement (www.googletagmanager.com) et le repli navigateur du SIRET à l'inscription
 * (recherche-entreprises.api.gouv.fr) étaient bloqués. `next start` n'envoie que celle du middleware (setHeader).
 * On rejoue ici cette fusion sur les vraies règles de next.config.ts et les vraies réponses du middleware.
 */
import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { buildCustomRoute } from 'next/dist/lib/build-custom-route'
import type { Header } from 'next/dist/lib/load-custom-routes'
import { createRequire } from 'node:module'
import configurationNext from '@/next.config'
import { EXTENSIONS_HORS_MIDDLEWARE, POLITIQUE_CSP } from '@/lib/securite/csp'

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}))

const { middleware, config } = await import('@/middleware')

const CLES_CSP = new Set(['content-security-policy', 'content-security-policy-report-only'])

async function reglesEntetes(): Promise<Header[]> {
  return (await configurationNext.headers?.()) ?? []
}

/**
 * En-têtes de la config pour un chemin, comme getNextConfigHeaders d'OpenNext (core/routing/matcher.js) : chaque règle
 * du routes-manifest porte une `regex`, que `next build` calcule avec buildCustomRoute (build/generate-routes-manifest.js),
 * et OpenNext la teste par `new RegExp(regex).test(chemin)`. Les conditions has/missing ne sont pas évaluées : une
 * règle conditionnelle est comptée comme appliquée (cas le plus défavorable pour l'unicité de la CSP).
 */
async function entetesConfig(chemin: string): Promise<Record<string, string>> {
  const entetes: Record<string, string> = {}
  for (const regle of await reglesEntetes()) {
    const { regex } = buildCustomRoute('header', regle)
    if (!new RegExp(regex).test(chemin)) continue
    for (const { key, value } of regle.headers) entetes[key] = value
  }
  return entetes
}

async function entetesMiddleware(chemin: string): Promise<Record<string, string>> {
  const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`, { headers: { cookie: 'locale=fr' } }))
  return Object.fromEntries(reponse.headers.entries())
}

/** Sources d'une directive de la politique (ex. « script-src »). */
function directive(politique: string, nom: string): string[] {
  const trouvee = politique
    .split(';')
    .map((partie) => partie.trim().split(/\s+/))
    .find(([premier]) => premier === nom)
  return trouvee ? trouvee.slice(1) : []
}

// path-to-regexp embarqué par Next (sans déclaration de types), celui qui compile le matcher du middleware.
const { pathToRegexp } = createRequire(import.meta.url)('next/dist/compiled/path-to-regexp') as {
  pathToRegexp: (motif: string) => RegExp
}

/** Le middleware traite-t-il ce chemin ? Son matcher (littéral, analysé au build) compilé comme le fait Next. */
function middlewareTraite(chemin: string): boolean {
  const [motif] = config.matcher as string[]
  return pathToRegexp(motif).test(chemin)
}

describe('Content-Security-Policy', () => {
  it('headers() ne pose que la politique partagée, et seulement hors du matcher du middleware', async () => {
    const declarations = (await reglesEntetes()).flatMap((regle) =>
      regle.headers.filter(({ key }) => CLES_CSP.has(key.toLowerCase())).map(({ value }) => ({ source: regle.source, value })),
    )
    expect(declarations.map(({ source }) => source)).toEqual([
      `/(.*)\\.(${EXTENSIONS_HORS_MIDDLEWARE})`,
      '/manifest.json',
      '/.well-known/:path*',
    ])
    expect(declarations.every(({ value }) => value === POLITIQUE_CSP)).toBe(true)
  })

  it('les extensions exclues par le matcher du middleware sont celles de lib/securite/csp.ts', () => {
    const [motif] = config.matcher as string[]
    expect(motif).toContain(`.*\\.(?:${EXTENSIONS_HORS_MIDDLEWARE})$`)
  })

  it.each([
    ['/fr/', true],
    ['/pt/', true],
    ['/fr/pro/register/', true],
    ['/api/health/', true],
    // Hors matcher : des routes dynamiques servent du HTML malgré l'extension, et robots/sitemaps/manifest.
    ['/fr/artisan/foo.png', false],
    ['/fr/inexistant.txt', false],
    ['/robots.txt', false],
    ['/sitemap/0.xml', false],
    ['/manifest.json', false],
    ['/.well-known/security.txt', false],
  ])('%s : exactement une politique après la fusion OpenNext, la politique partagée', async (chemin, traite) => {
    expect(middlewareTraite(chemin)).toBe(traite)
    const duMiddleware = traite ? await entetesMiddleware(chemin) : {}
    const fusion = { ...duMiddleware, ...(await entetesConfig(chemin)) }
    const politiques = Object.entries(fusion).filter(([cle]) => CLES_CSP.has(cle.toLowerCase()))
    expect(politiques).toHaveLength(1)
    expect(politiques[0][1]).toBe(POLITIQUE_CSP)
  })

  it('la politique du middleware autorise GA4 après consentement et le repli SIRET de l’inscription', async () => {
    const politique = (await entetesMiddleware('/fr/'))['content-security-policy']
    // components/common/ConsentAnalytics.tsx : script gtag.js, puis envoi des mesures ; le conteneur envoie les
    // mesures des visiteurs de l'UE vers region1.google-analytics.com.
    expect(directive(politique, 'script-src')).toContain('https://www.googletagmanager.com')
    expect(directive(politique, 'connect-src')).toContain('https://*.google-analytics.com')
    // app/pro/register/page.tsx : repli navigateur quand /api/verify-siret répond api_error.
    expect(directive(politique, 'connect-src')).toContain('https://recherche-entreprises.api.gouv.fr')
    expect(directive(politique, 'frame-ancestors')).toEqual(["'none'"])
  })
})
