/**
 * Content-Security-Policy : une seule politique, celle de middleware.ts.
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
import configurationNext from '@/next.config'

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}))

const { middleware } = await import('@/middleware')

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

describe('Content-Security-Policy', () => {
  it('next.config.ts ne déclare aucune CSP dans headers() : middleware.ts est la seule source', async () => {
    const declarations = (await reglesEntetes()).flatMap((regle) =>
      regle.headers.filter(({ key }) => CLES_CSP.has(key.toLowerCase())).map(({ key }) => `${regle.source} : ${key}`),
    )
    expect(declarations).toEqual([])
  })

  it.each(['/fr/', '/pt/', '/fr/pro/register/', '/api/health/'])(
    '%s : une seule politique après la fusion OpenNext, celle du middleware',
    async (chemin) => {
      const duMiddleware = await entetesMiddleware(chemin)
      const fusion = { ...duMiddleware, ...(await entetesConfig(chemin)) }
      const politiques = Object.entries(fusion).filter(([cle]) => CLES_CSP.has(cle.toLowerCase()))
      expect(politiques).toHaveLength(1)
      expect(politiques[0][1]).toBe(duMiddleware['content-security-policy'])
    },
  )

  it('la politique du middleware autorise GA4 après consentement et le repli SIRET de l’inscription', async () => {
    const politique = (await entetesMiddleware('/fr/'))['content-security-policy']
    // components/common/ConsentAnalytics.tsx : script gtag.js, puis envoi des mesures.
    expect(directive(politique, 'script-src')).toContain('https://www.googletagmanager.com')
    expect(directive(politique, 'connect-src')).toContain('https://www.google-analytics.com')
    // app/pro/register/page.tsx : repli navigateur quand /api/verify-siret répond api_error.
    expect(directive(politique, 'connect-src')).toContain('https://recherche-entreprises.api.gouv.fr')
    expect(directive(politique, 'frame-ancestors')).toEqual(["'none'"])
  })
})
