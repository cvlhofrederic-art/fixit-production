// @vitest-environment node
// tests/lib/equipe-session-invite.test.ts
//
// Connexion de l'invité d'une équipe pro (lib/equipe/session-invite.ts) et règle du mot de passe neuf
// (lib/equipe/mot-de-passe-invitation.ts), lues par /api/pro/invite (28/11/2026) :
// - un mauvais mot de passe (400 de Supabase Auth) est un refus ; une panne du service n'en est pas un : la route
//   ne dit pas « mot de passe incorrect » quand elle n'en sait rien ;
// - la session de vérification est refermée aussitôt ;
// - la session de l'invité n'est renvoyée que si la connexion réussit.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  options: [] as unknown[],
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((_url: string, _cle: string, options: unknown) => {
    h.options.push(options)
    return { auth: { signInWithPassword: h.signInWithPassword, signOut: h.signOut } }
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { verifierMotDePasseDuCompte, ouvrirSessionInvite } = await import('@/lib/equipe/session-invite')
const { defautsMotDePasseNeuf } = await import('@/lib/equipe/mot-de-passe-invitation')

const SESSION = { access_token: 'a', refresh_token: 'r', expires_in: 3600, token_type: 'bearer', user: { id: 'u' } }

beforeEach(() => {
  h.signInWithPassword.mockReset().mockResolvedValue({ data: { session: SESSION, user: { id: 'u' } }, error: null })
  h.signOut.mockReset().mockResolvedValue({ error: null })
  h.options = []
})

describe('verifierMotDePasseDuCompte', () => {
  it('bon mot de passe : « valide », session de vérification refermée, rien de conservé', async () => {
    expect(await verifierMotDePasseDuCompte('claire@exemple.fr', 'AncienMdp')).toBe('valide')
    expect(h.signInWithPassword).toHaveBeenCalledWith({ email: 'claire@exemple.fr', password: 'AncienMdp' })
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(h.options[0]).toMatchObject({ auth: { persistSession: false, autoRefreshToken: false } })
  })

  it.each([
    ['invalid_credentials', { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }, 'refuse'],
    ['serveur sans code, « Invalid login credentials »', { status: 400, message: 'Invalid login credentials' }, 'refuse'],
    ['email_not_confirmed', { status: 400, code: 'email_not_confirmed', message: 'Email not confirmed' }, 'non_confirme'],
    ['user_banned', { status: 400, code: 'user_banned', message: 'User is banned' }, 'erreur'],
    ['400 sans code, autre message', { status: 400, message: 'Bad request' }, 'erreur'],
  ])('refus %s : « %s »', async (_cas, erreur, attendu) => {
    h.signInWithPassword.mockResolvedValue({ data: { session: null }, error: erreur })
    expect(await verifierMotDePasseDuCompte('claire@exemple.fr', 'Mauvais1')).toBe(attendu)
    expect(h.signOut).not.toHaveBeenCalled()
  })

  it.each([
    ['service en panne (500)', () => h.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { status: 500, message: 'panne' } })],
    ['trop de demandes (429)', () => h.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { status: 429, message: 'rate' } })],
    ['exception réseau', () => h.signInWithPassword.mockRejectedValue(new Error('réseau'))],
  ])('%s : « erreur », jamais « refuse »', async (_cas, preparer) => {
    preparer()
    expect(await verifierMotDePasseDuCompte('claire@exemple.fr', 'AncienMdp')).toBe('erreur')
  })
})

describe('ouvrirSessionInvite', () => {
  it('connexion réussie : jetons de la session', async () => {
    expect(await ouvrirSessionInvite('claire@exemple.fr', 'MotDePasse1')).toEqual({ access_token: 'a', refresh_token: 'r', expires_in: 3600 })
  })

  it('connexion refusée ou en panne : null', async () => {
    h.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { status: 400 } })
    expect(await ouvrirSessionInvite('claire@exemple.fr', 'x')).toBeNull()
    h.signInWithPassword.mockRejectedValue(new Error('réseau'))
    expect(await ouvrirSessionInvite('claire@exemple.fr', 'x')).toBeNull()
  })
})

describe('defautsMotDePasseNeuf', () => {
  it.each([
    ['MotDePasse1', []],
    ['motdepasse1', ['majuscule']],
    ['MotDePasse', ['chiffre']],
    ['Court1', ['longueur']],
    ['', ['longueur', 'majuscule', 'chiffre']],
  ])('%s → %j', (motDePasse, attendus) => {
    expect(defautsMotDePasseNeuf(motDePasse)).toEqual(attendus)
  })
})
