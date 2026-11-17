/**
 * Ce que la route /auth/confirm/ (app/(commun)/auth/confirm/route.ts) attend du middleware pour le lien des e-mails
 * Supabase, écrit sans langue (https://vitfix.io/auth/confirm/?token_hash=…&type=…) :
 * - préfixe par la langue du visiteur (pays, Accept-Language, cookie), token_hash et type conservés, en un seul saut ;
 * - sous /fr/ ou /pt/, langue du chemin transmise à la route par l'en-tête x-locale, sans appel à Supabase (pas de
 *   session à rafraîchir sur ce chemin, aucun cookie de session posé par le middleware).
 */
import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getUser = vi.hoisted(() => vi.fn(async () => ({ data: { user: null } })))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

const { middleware } = await import('@/middleware')

const RECHERCHE = '?token_hash=pkce_0b3c6c1f1d0e4a7c9f2e5d8b&type=recovery'
// Valeur de test, en constante : écrite en clair après la clé « password », gitleaks la prend pour un secret.
const MOT_DE_PASSE = 'NouveauMotDePasse2026'

describe('middleware et lien des e-mails Supabase', () => {
  it.each([
    [{ 'cf-ipcountry': 'PT' }, 'pt'],
    [{ 'cf-ipcountry': 'FR' }, 'fr'],
    [{ 'accept-language': 'pt-PT,pt;q=0.9' }, 'pt'],
    [{ cookie: 'locale=fr', 'cf-ipcountry': 'PT' }, 'fr'],
  ])('préfixe le lien par la langue du visiteur (%j → %s) en gardant le jeton', async (entetes, langue) => {
    const reponse = await middleware(new NextRequest(`https://vitfix.io/auth/confirm/${RECHERCHE}`, { headers: entetes }))
    expect(reponse.status).toBe(302)
    expect(reponse.headers.get('location')).toBe(`https://vitfix.io/${langue}/auth/confirm/${RECHERCHE}`)
  })

  it.each(['fr', 'pt'])('sous /%s/, transmet la langue à la route sans appeler Supabase', async (langue) => {
    getUser.mockClear()
    const reponse = await middleware(new NextRequest(`https://vitfix.io/${langue}/auth/confirm/${RECHERCHE}`))
    expect(reponse.headers.get('location')).toBeNull()
    expect(reponse.headers.get('x-middleware-request-x-locale')).toBe(langue)
    expect(reponse.headers.get('cache-control')).toContain('no-store')
    expect(getUser).not.toHaveBeenCalled()
  })
})

describe('middleware et POST /api/auth/update-password', () => {
  // Second rempart après le cookie SameSite=Lax du jeton (jamais envoyé par un POST venu d'un autre site) : un
  // formulaire d'un autre site ne change aucun mot de passe.
  const envoyer = (origine: string) =>
    middleware(new NextRequest('https://vitfix.io/api/auth/update-password/', {
      method: 'POST',
      headers: { origin: origine, 'content-type': 'application/json', cookie: 'vitfix_reinit_mdp=pkce_0b3c6c1f1d0e4a7c9f2e5d8b' },
      body: JSON.stringify({ password: MOT_DE_PASSE }),
    }))

  it('refuse un POST venu d’une autre origine', async () => {
    const reponse = await envoyer('https://exemple-malveillant.test')
    expect(reponse.status).toBe(403)
  })

  it('laisse passer le POST de la page vitfix.io', async () => {
    const reponse = await envoyer('https://vitfix.io')
    expect(reponse.status).toBe(200)
    expect(reponse.headers.get('location')).toBeNull()
  })
})
