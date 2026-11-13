// @vitest-environment node
/**
 * GET /auth/callback (app/(commun)/auth/callback/route.ts) : fin de connexion Google.
 *
 * La route échange le code PKCE contre la session, puis aiguille selon le rôle. Depuis le 13/11/2026 elle
 * emprunte la table de destinations de la page de connexion (lib/auth/destination-par-role) au lieu d'en
 * tenir une seconde, et accepte `app=1` : l'appli Vitfix Pro, qui ouvre Google dans une fenêtre du
 * navigateur du système, y ramène l'artisan sur son espace mobile.
 *
 * Supabase est simulé : on ne teste que la décision d'aiguillage et le fait qu'un code absent ou refusé
 * n'ouvre aucune session.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  echanger: vi.fn(),
  cookies: new Map<string, string>(),
  poses: [] as string[],
  adaptateur: null as null | {
    getAll(): Array<{ name: string; value: string }>
    setAll(cookies: Array<{ name: string; value: string; options?: unknown }>): void
  },
  journal: [] as Array<[string, unknown]>,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (m: string, d: unknown) => { h.journal.push([m, d]) },
    warn: (m: string, d: unknown) => { h.journal.push([m, d]) },
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (nom: string) => (h.cookies.has(nom) ? { name: nom, value: h.cookies.get(nom) } : undefined),
    getAll: () => [...h.cookies].map(([name, value]) => ({ name, value })),
    set: (nom: string) => { h.poses.push(nom) },
  }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _cle: string, options: { cookies: NonNullable<typeof h.adaptateur> }) => {
    h.adaptateur = options.cookies
    return { auth: { exchangeCodeForSession: h.echanger } }
  },
}))

const { GET } = await import('@/app/(commun)/auth/callback/route')

const connecte = (role?: string) => {
  h.echanger.mockResolvedValue({ data: { user: { app_metadata: role ? { role } : {} } }, error: null })
}

async function visiter(recherche: string): Promise<string> {
  const reponse = await GET(new NextRequest(`https://vitfix.io/auth/callback${recherche}`))
  expect(reponse.status).toBe(307)
  return reponse.headers.get('location') ?? ''
}

beforeEach(() => {
  h.echanger.mockReset()
  h.cookies.clear()
  h.poses.length = 0
  h.journal.length = 0
  h.adaptateur = null
})

describe('GET /auth/callback — aiguillage après connexion Google', () => {
  it('artisan : tableau de bord sur le web, espace mobile dans l’appli', async () => {
    connecte('artisan')
    expect(await visiter('?code=abc')).toBe('https://vitfix.io/fr/artisan/dashboard')
    expect(await visiter('?code=abc&app=1')).toBe('https://vitfix.io/fr/pro/mobile')
  })

  // Règle n° 1 artisan / BTP : l'espace mobile ne s'ouvre pas à une société, même depuis l'appli.
  it.each(['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'])('%s reste sur son tableau de bord', async (role) => {
    connecte(role)
    expect(await visiter('?code=abc')).toBe('https://vitfix.io/fr/pro/dashboard')
    expect(await visiter('?code=abc&app=1')).toBe('https://vitfix.io/fr/pro/dashboard')
  })

  it('les autres rôles suivent la table commune', async () => {
    connecte('syndic_gestionnaire')
    expect(await visiter('?code=abc')).toBe('https://vitfix.io/fr/syndic/dashboard')
    connecte('gestionnaire_signalement')
    expect(await visiter('?code=abc')).toBe('https://vitfix.io/fr/aj-signalement/')
    connecte(undefined)
    expect(await visiter('?code=abc')).toBe('https://vitfix.io/fr/client/dashboard')
  })

  it('garde la langue du cookie', async () => {
    h.cookies.set('locale', 'pt')
    connecte('artisan')
    expect(await visiter('?code=abc&app=1')).toBe('https://vitfix.io/pt/pro/mobile')
    h.cookies.set('locale', 'en')
    expect(await visiter('?code=abc')).toBe('https://vitfix.io/fr/artisan/dashboard')
  })

  it('transmet le code tel quel, une seule fois', async () => {
    connecte('artisan')
    await visiter('?code=a%26b%3Dc&app=1')
    expect(h.echanger).toHaveBeenCalledTimes(1)
    expect(h.echanger).toHaveBeenCalledWith('a&b=c')
  })

  it('code refusé (expiré, déjà utilisé, vérificateur absent) → formulaire de connexion', async () => {
    h.echanger.mockResolvedValue({ data: { user: null }, error: { message: 'invalid flow state' } })
    expect(await visiter('?code=abc&app=1')).toBe('https://vitfix.io/fr/auth/login')
  })

  it('sans code : aucun échange tenté', async () => {
    expect(await visiter('')).toBe('https://vitfix.io/fr/auth/login')
    expect(await visiter('?error=access_denied')).toBe('https://vitfix.io/fr/auth/login')
    expect(h.echanger).not.toHaveBeenCalled()
  })

  // Sans ce filet, une erreur levée par Supabase remontait en 500 : dans l'appli, Android remplace une page
  // en erreur par la page « hors connexion », d'où un cul-de-sac au lieu du formulaire de connexion.
  it('échange qui lève (réseau, Supabase indisponible) → formulaire, et c’est journalisé', async () => {
    h.echanger.mockRejectedValue(new Error('fetch failed'))
    expect(await visiter('?code=abc&app=1')).toBe('https://vitfix.io/fr/auth/login')
    expect(h.journal.map(([m]) => m)).toContain('[auth/callback] échange impossible')
  })

  it('un refus de Supabase laisse une trace, sans jamais écrire le code', async () => {
    h.echanger.mockResolvedValue({ data: { user: null }, error: { message: 'invalid flow state' } })
    await visiter('?code=secret-a-ne-pas-journaliser&app=1')

    expect(h.journal.map(([m]) => m)).toContain('[auth/callback] échange refusé')
    expect(JSON.stringify(h.journal)).toContain('invalid flow state')
    expect(JSON.stringify(h.journal)).not.toContain('secret-a-ne-pas-journaliser')
  })

  // Le vérificateur PKCE vit dans un cookie de la WebView : si la route ne donnait pas les cookies de la
  // requête à Supabase, l'échange échouerait toujours, et aucune destination ne serait jamais atteinte.
  it('donne à Supabase les cookies de la requête, et lui laisse poser ceux de la session', async () => {
    h.cookies.set('sb-projet-auth-token-code-verifier', 'verificateur-pkce')
    connecte('artisan')
    await visiter('?code=abc&app=1')

    expect(h.adaptateur, 'aucun adaptateur de cookies passé à createServerClient').not.toBeNull()
    expect(h.adaptateur!.getAll()).toContainEqual({
      name: 'sb-projet-auth-token-code-verifier',
      value: 'verificateur-pkce',
    })

    h.adaptateur!.setAll([{ name: 'sb-projet-auth-token', value: 'session', options: {} }])
    expect(h.poses).toContain('sb-projet-auth-token')
  })
})
