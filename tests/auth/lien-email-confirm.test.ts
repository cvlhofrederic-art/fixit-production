// @vitest-environment node
/**
 * GET /auth/confirm/ (app/(commun)/auth/confirm/route.ts) : lien de l'e-mail « mot de passe oublié ».
 *
 * Constat du 09/11/2026 : demande faite sur le PC, lien ouvert sur le téléphone, « lien expiré » (le lien PKCE ne
 * marche que dans le navigateur de la demande). La route accepte le lien sur n'importe quel appareil SANS consommer le
 * jeton ni ouvrir de session : elle le range dans un cookie httpOnly réservé à /api/auth/ et renvoie vers le
 * formulaire. Une session ouverte par un simple GET permettrait de connecter la victime d'un lien piégé au compte de
 * l'attaquant (relecture adverse du 09/11/2026).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { cheminArrivee, jetonLienValide, langueArrivee, motDePasseConforme, typeLienEmail } from '@/lib/auth/lien-email'

const h = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn() }))

vi.mock('@/lib/logger', () => ({
  logger: { warn: h.warn, error: h.error, info: vi.fn(), debug: vi.fn() },
}))

const { GET } = await import('@/app/(commun)/auth/confirm/route')

const JETON = 'pkce_0b3c6c1f1d0e4a7c9f2e5d8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e'
const reseau = vi.fn()

beforeEach(() => {
  h.warn.mockClear()
  h.error.mockClear()
  reseau.mockReset()
  // Aucun appel réseau n'est permis : la route ne doit jamais parler à Supabase.
  reseau.mockImplementation(async (entree: unknown) => {
    throw new Error(`appel réseau inattendu : ${String(entree)}`)
  })
  vi.stubGlobal('fetch', reseau)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function requete(recherche: string, entetes: Record<string, string> = { 'x-locale': 'fr' }): NextRequest {
  return new NextRequest(`https://vitfix.io/auth/confirm/${recherche}`, { headers: entetes })
}

function redirection(reponse: Response): NextResponse {
  expect(reponse).toBeInstanceOf(NextResponse)
  expect(reponse.status).toBe(303)
  expect(reponse.headers.get('cache-control')).toBe('private, no-store')
  return reponse as NextResponse
}

describe('GET /auth/confirm/ — lien « mot de passe oublié » ouvert sur un autre appareil', () => {
  it('range le jeton dans un cookie httpOnly réservé à /api/auth/ et renvoie vers le formulaire, sans appeler Supabase', () => {
    const reponse = redirection(GET(requete(`?token_hash=${JETON}&type=recovery`)))

    expect(reponse.headers.get('location')).toBe('https://vitfix.io/fr/auth/update-password/?lien=1')
    expect(reponse.cookies.get('vitfix_reinit_mdp')).toMatchObject({
      value: JETON,
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/auth/',
      maxAge: 3600,
    })
    expect(reseau).not.toHaveBeenCalled()
  })

  it("n'ouvre ni ne touche aucune session : la session déjà présente dans le navigateur reste celle de son titulaire", () => {
    // Lien piégé : jeton d'un compte de l'attaquant, ouvert par une victime connectée à son propre compte.
    const reponse = redirection(
      GET(requete(`?token_hash=${JETON}&type=recovery`, { 'x-locale': 'fr', cookie: 'sb-projet-auth-token=base64-session-de-la-victime' })),
    )
    expect(reponse.cookies.getAll().filter(({ name }) => name.startsWith('sb-'))).toEqual([])
    expect(reponse.headers.getSetCookie().filter((ligne) => ligne.startsWith('sb-'))).toEqual([])
    expect(reseau).not.toHaveBeenCalled()
  })

  it.each([
    [{ 'x-locale': 'pt' }, 'pt'],
    // en, nl, es : pas de pages communes sous ces langues, renvoi vers /pt comme le fait le middleware.
    [{ 'x-locale': 'en' }, 'pt'],
    [{ 'x-locale': 'es' }, 'pt'],
    // La langue du chemin (posée par le middleware) prime sur le cookie.
    [{ 'x-locale': 'fr', cookie: 'locale=pt' }, 'fr'],
    [{ cookie: 'locale=pt' }, 'pt'],
    [{ cookie: 'locale=de' }, 'fr'],
    [{}, 'fr'],
  ])('choisit la langue de la page d’arrivée (%j → %s)', (entetes, langue) => {
    const reponse = redirection(GET(requete(`?token_hash=${JETON}&type=recovery`, entetes)))
    expect(reponse.headers.get('location')).toBe(`https://vitfix.io/${langue}/auth/update-password/?lien=1`)
  })
})

describe('GET /auth/confirm/ — lien refusé', () => {
  it.each([
    ['jeton absent', '?type=recovery'],
    ['jeton vide', '?token_hash=&type=recovery'],
    ['jeton avec point-virgule (injection de cookie)', `?token_hash=${JETON}%3B%20Path%3D%2F&type=recovery`],
    ['jeton avec espace', `?token_hash=${JETON}%20x&type=recovery`],
    ['jeton trop court', '?token_hash=abc&type=recovery'],
  ])('%s : formulaire refusé, aucun cookie', (_cas, recherche) => {
    const reponse = redirection(GET(requete(recherche)))
    expect(reponse.headers.get('location')).toBe('https://vitfix.io/fr/auth/update-password/?erreur=lien-invalide')
    expect(reponse.cookies.getAll().filter(({ value }) => value !== '')).toEqual([])
    expect(JSON.stringify(h.warn.mock.calls)).not.toContain(JETON)
  })

  it.each(['email', 'signup', 'invite', 'magiclink', 'email_change', 'toString', '__proto__', 'constructor', ''])(
    'type hors liste (%j) : renvoi vers la connexion, aucun cookie',
    (type) => {
      const reponse = redirection(GET(requete(`?token_hash=${JETON}&type=${type}`)))
      expect(reponse.headers.get('location')).toBe('https://vitfix.io/fr/auth/login/?erreur=lien-invalide')
      expect(reponse.cookies.getAll()).toEqual([])
    },
  )

  it('ignore toute destination fournie par le lien (pas de redirection ouverte)', () => {
    const recherche = `?token_hash=${JETON}&type=recovery&next=https://exemple-malveillant.test/&redirect_to=//exemple-malveillant.test`
    const reponse = redirection(GET(requete(recherche)))
    expect(reponse.headers.get('location')).toBe('https://vitfix.io/fr/auth/update-password/?lien=1')
  })
})

describe('lib/auth/lien-email', () => {
  it('ne reconnaît que le type recovery', () => {
    expect(typeLienEmail('recovery')).toBe('recovery')
    expect(typeLienEmail('RECOVERY')).toBeNull()
    expect(typeLienEmail('email')).toBeNull()
    expect(typeLienEmail('hasOwnProperty')).toBeNull()
    expect(typeLienEmail(null)).toBeNull()
  })

  it('accepte les jetons de GoTrue (avec ou sans « pkce_ »), refuse le reste', () => {
    expect(jetonLienValide(JETON)).toBe(true)
    expect(jetonLienValide(JETON.slice('pkce_'.length))).toBe(true)
    expect(jetonLienValide(null)).toBe(false)
    expect(jetonLienValide(`${JETON};`)).toBe(false)
    expect(jetonLienValide('x'.repeat(201))).toBe(false)
  })

  it('applique la règle du formulaire, plus la limite de 72 octets de GoTrue', () => {
    expect(motDePasseConforme('Abcdefg1')).toBe(true)
    expect(motDePasseConforme('Abcdef1')).toBe(false)
    expect(motDePasseConforme('abcdefg1')).toBe(false)
    expect(motDePasseConforme('ABCDEFG1')).toBe(false)
    expect(motDePasseConforme('Abcdefgh')).toBe(false)
    expect(motDePasseConforme(`Ab1${'x'.repeat(69)}`)).toBe(true)
    expect(motDePasseConforme(`Ab1${'x'.repeat(70)}`)).toBe(false)
    // 38 caractères mais 74 octets : refusé avant de consommer le jeton, comme GoTrue le refuserait après.
    expect(motDePasseConforme(`Àb1${'é'.repeat(35)}`)).toBe(false)
    expect(motDePasseConforme(`Ab1${'é'.repeat(34)}`)).toBe(true)
  })

  it('ramène toute langue aux pages communes /fr et /pt', () => {
    expect(langueArrivee('fr')).toBe('fr')
    expect(langueArrivee('pt')).toBe('pt')
    expect(langueArrivee('nl')).toBe('pt')
    expect(langueArrivee(null, undefined)).toBe('fr')
    expect(langueArrivee('xx', 'pt')).toBe('pt')
  })

  it('construit un chemin interne avec barre finale (site en trailingSlash)', () => {
    expect(cheminArrivee('recovery', 'pt', true)).toBe('/pt/auth/update-password/?lien=1')
    expect(cheminArrivee('recovery', 'fr', false)).toBe('/fr/auth/update-password/?erreur=lien-invalide')
    expect(cheminArrivee(null, 'fr', false)).toBe('/fr/auth/login/?erreur=lien-invalide')
  })
})
