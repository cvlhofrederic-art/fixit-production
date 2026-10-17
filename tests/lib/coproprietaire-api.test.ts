// tests/lib/coproprietaire-api.test.ts
//
// lib/coproprietaire/api.ts — appels du portail vers /api/coproprietaire/*, fetch injecté :
//   - chaque appel porte le jeton Bearer, la bonne URL (paramètres encodés) et le bon corps JSON ;
//   - aucune fonction ne lève : un échec devient un code (codeDepuisReponse : code d'accès renvoyé
//     par le serveur, sinon 401 / 403 / 404 / 429 / 4xx / 5xx ; exception → reseau) ;
//   - dateLimiteVote (trois jours avant la séance) et voteOuvert.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  chargerEspace, codeDepuisReponse, dateLimiteVote, envoyerMessageDemande, ouvrirDocument, voteOuvert, voterResolution,
} from '@/lib/coproprietaire/api'
import { espaceDemo } from '@/lib/coproprietaire/demo'

type Appel = { url: string; init: RequestInit | undefined }

/** fetch simulé : enregistre l'appel, répond avec le statut et le corps donnés (ou lève). */
function fetchSimule(status: number, corps: unknown, options: { lever?: Error; texteBrut?: string } = {}) {
  const appels: Appel[] = []
  const fetchImpl = vi.fn(async (entree: string | URL | Request, init?: RequestInit): Promise<Response> => {
    appels.push({ url: String(entree), init })
    if (options.lever) throw options.lever
    const body = options.texteBrut !== undefined ? options.texteBrut : JSON.stringify(corps)
    return new Response(body, { status, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
  return { fetchImpl, appels, dernier: () => appels[appels.length - 1] }
}

const JETON = 'jeton-de-test'
const entetes = (appel: Appel): Record<string, string> => (appel.init?.headers ?? {}) as Record<string, string>
const corpsJson = (appel: Appel): unknown => JSON.parse(String(appel.init?.body))

let avertir: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  // Les échecs réseau sont signalés par console.warn : on le neutralise et on le vérifie.
  avertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  avertir.mockRestore()
})

describe('codeDepuisReponse', () => {
  it('reprend le code d’accès renvoyé par le serveur, quel que soit le statut', () => {
    expect(codeDepuisReponse(403, { error: 'acces_non_active' })).toBe('acces_non_active')
    expect(codeDepuisReponse(404, { error: 'fiche_introuvable' })).toBe('fiche_introuvable')
    expect(codeDepuisReponse(401, { error: 'non_authentifie' })).toBe('non_authentifie')
    expect(codeDepuisReponse(403, { error: 'role_interdit' })).toBe('role_interdit')
    expect(codeDepuisReponse(403, { error: 'email_non_confirme' })).toBe('email_non_confirme')
    expect(codeDepuisReponse(500, { error: 'acces_non_active' })).toBe('acces_non_active')
  })

  it('sinon, déduit le code du statut HTTP', () => {
    expect(codeDepuisReponse(401, null)).toBe('non_authentifie')
    expect(codeDepuisReponse(403, { error: 'interdit' })).toBe('role_interdit')
    expect(codeDepuisReponse(404, { error: 'not_found' })).toBe('fiche_introuvable')
    expect(codeDepuisReponse(429, { error: 'rate' })).toBe('trop_de_demandes')
    expect(codeDepuisReponse(400, { error: 'Données invalides' })).toBe('invalide')
    expect(codeDepuisReponse(409, { error: 'vote_clos' })).toBe('vote_clos')
    expect(codeDepuisReponse(422, 'texte')).toBe('invalide')
    expect(codeDepuisReponse(500, { error: 'Une erreur interne est survenue' })).toBe('serveur')
    expect(codeDepuisReponse(502, undefined)).toBe('serveur')
  })
})

describe('chargerEspace', () => {
  it('GET /api/coproprietaire/espace avec le jeton, sans cache ; espace rendu tel quel', async () => {
    const espace = espaceDemo()
    const f = fetchSimule(200, { espace })
    const r = await chargerEspace(JETON, { fetchImpl: f.fetchImpl })
    expect(r).toEqual({ ok: true, espace })
    expect(f.dernier().url).toBe('/api/coproprietaire/espace')
    expect(entetes(f.dernier())).toEqual({ Authorization: `Bearer ${JETON}` })
    expect(f.dernier().init?.cache).toBe('no-store')
    expect(f.dernier().init?.method).toBeUndefined()
  })

  it('lot et e-mail passés en paramètres d’URL, encodés ; valeurs vides ignorées', async () => {
    const f = fetchSimule(200, { espace: espaceDemo() })
    await chargerEspace(JETON, { lot: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', email: 'Géraldine.Xavier@Email.com', fetchImpl: f.fetchImpl })
    expect(f.dernier().url).toBe('/api/coproprietaire/espace?lot=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2&email=G%C3%A9raldine.Xavier%40Email.com')

    await chargerEspace(JETON, { lot: '', email: null, fetchImpl: f.fetchImpl })
    expect(f.dernier().url).toBe('/api/coproprietaire/espace')
  })

  it('réponse 200 sans profil → serveur (la page ne doit pas afficher un espace vide)', async () => {
    const f = fetchSimule(200, { espace: { source: 'reel' } })
    expect(await chargerEspace(JETON, { fetchImpl: f.fetchImpl })).toEqual({ ok: false, code: 'serveur' })
    const g = fetchSimule(200, {})
    expect(await chargerEspace(JETON, { fetchImpl: g.fetchImpl })).toEqual({ ok: false, code: 'serveur' })
  })

  it.each([
    [403, { error: 'acces_non_active' }, 'acces_non_active'],
    [404, { error: 'fiche_introuvable' }, 'fiche_introuvable'],
    [401, { error: 'non_authentifie' }, 'non_authentifie'],
    [403, { error: 'role_interdit' }, 'role_interdit'],
    [429, { error: 'rate' }, 'trop_de_demandes'],
    [500, { error: 'Une erreur interne est survenue' }, 'serveur'],
  ])('statut %i avec %o → code %s', async (status, corps, code) => {
    const f = fetchSimule(status, corps)
    expect(await chargerEspace(JETON, { fetchImpl: f.fetchImpl })).toEqual({ ok: false, code })
  })

  it('corps non JSON sur une erreur : le code vient du statut', async () => {
    const f = fetchSimule(503, null, { texteBrut: '<html>Service Unavailable</html>' })
    expect(await chargerEspace(JETON, { fetchImpl: f.fetchImpl })).toEqual({ ok: false, code: 'serveur' })
  })

  it('exception de fetch → reseau, avertissement en console', async () => {
    const f = fetchSimule(200, null, { lever: new TypeError('Failed to fetch') })
    expect(await chargerEspace(JETON, { fetchImpl: f.fetchImpl })).toEqual({ ok: false, code: 'reseau' })
    expect(avertir).toHaveBeenCalledWith(expect.stringContaining('[copro]'), expect.any(TypeError))
  })
})

describe('ouvrirDocument', () => {
  it('GET /api/coproprietaire/documents/{id}, id encodé, jeton, sans cache ; URL https rendue', async () => {
    const f = fetchSimule(200, { url: 'https://stockage.test/syndic-documents/pv.pdf?token=x', expiresInSeconds: 600 })
    const r = await ouvrirDocument(JETON, 'doc/1 ?', f.fetchImpl)
    expect(r).toEqual({ ok: true, url: 'https://stockage.test/syndic-documents/pv.pdf?token=x' })
    expect(f.dernier().url).toBe('/api/coproprietaire/documents/doc%2F1%20%3F')
    expect(entetes(f.dernier())).toEqual({ Authorization: `Bearer ${JETON}` })
    expect(f.dernier().init?.cache).toBe('no-store')
  })

  it('URL absente ou qui n’est pas http(s) → serveur (jamais ouverte)', async () => {
    expect(await ouvrirDocument(JETON, 'd', fetchSimule(200, { url: 'javascript:alert(1)' }).fetchImpl)).toEqual({ ok: false, code: 'serveur' })
    expect(await ouvrirDocument(JETON, 'd', fetchSimule(200, {}).fetchImpl)).toEqual({ ok: false, code: 'serveur' })
  })

  it('404 not_found → fiche_introuvable ; 403 role_interdit (locataire) → role_interdit ; exception → reseau', async () => {
    expect(await ouvrirDocument(JETON, 'd', fetchSimule(404, { error: 'not_found' }).fetchImpl)).toEqual({ ok: false, code: 'fiche_introuvable' })
    expect(await ouvrirDocument(JETON, 'd', fetchSimule(403, { error: 'role_interdit' }).fetchImpl)).toEqual({ ok: false, code: 'role_interdit' })
    expect(await ouvrirDocument(JETON, 'd', fetchSimule(200, null, { lever: new Error('hors ligne') }).fetchImpl)).toEqual({ ok: false, code: 'reseau' })
  })
})

describe('envoyerMessageDemande', () => {
  it('POST JSON avec le jeton ; texte débarrassé des espaces de bord et limité à 5000 caractères', async () => {
    const f = fetchSimule(200, { message: { id: 'msg-1', date: '2026-10-17T10:00:00.000Z', deMoi: true } })
    const r = await envoyerMessageDemande(JETON, 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '  Merci.  ', f.fetchImpl)
    expect(r).toEqual({ ok: true, id: 'msg-1', date: '2026-10-17T10:00:00.000Z' })
    expect(f.dernier().url).toBe('/api/coproprietaire/signalement/message')
    expect(f.dernier().init?.method).toBe('POST')
    expect(entetes(f.dernier())).toEqual({ Authorization: `Bearer ${JETON}`, 'Content-Type': 'application/json' })
    expect(corpsJson(f.dernier())).toEqual({ signalementId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', texte: 'Merci.' })

    await envoyerMessageDemande(JETON, 'sig', 'x'.repeat(6000), f.fetchImpl)
    expect((corpsJson(f.dernier()) as { texte: string }).texte).toHaveLength(5000)
  })

  it('réponse sans message : id vide et date du moment (ISO)', async () => {
    const r = await envoyerMessageDemande(JETON, 'sig', 'Bonjour', fetchSimule(200, {}).fetchImpl)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.id).toBe('')
    expect(new Date(r.date).toISOString()).toBe(r.date)
  })

  it('400 → invalide ; 404 → fiche_introuvable ; 429 → trop_de_demandes ; exception → reseau', async () => {
    expect(await envoyerMessageDemande(JETON, 's', 't', fetchSimule(400, { error: 'Données invalides' }).fetchImpl)).toEqual({ ok: false, code: 'invalide' })
    expect(await envoyerMessageDemande(JETON, 's', 't', fetchSimule(404, { error: 'not_found' }).fetchImpl)).toEqual({ ok: false, code: 'fiche_introuvable' })
    expect(await envoyerMessageDemande(JETON, 's', 't', fetchSimule(429, { error: 'rate' }).fetchImpl)).toEqual({ ok: false, code: 'trop_de_demandes' })
    expect(await envoyerMessageDemande(JETON, 's', 't', fetchSimule(200, null, { lever: new Error('x') }).fetchImpl)).toEqual({ ok: false, code: 'reseau' })
  })
})

describe('voterResolution', () => {
  it('POST JSON { resolutionId, vote } avec le jeton ; choix et date rendus par le serveur', async () => {
    const f = fetchSimule(200, { vote: { resolutionId: 'r1', vote: 'contre', enregistreLe: '2026-11-10T10:00:00.000Z', modifie: false } })
    const r = await voterResolution(JETON, 'r1', 'contre', f.fetchImpl)
    expect(r).toEqual({ ok: true, choix: 'contre', enregistreLe: '2026-11-10T10:00:00.000Z' })
    expect(f.dernier().url).toBe('/api/coproprietaire/assemblees/vote')
    expect(f.dernier().init?.method).toBe('POST')
    expect(entetes(f.dernier())).toEqual({ Authorization: `Bearer ${JETON}`, 'Content-Type': 'application/json' })
    expect(corpsJson(f.dernier())).toEqual({ resolutionId: 'r1', vote: 'contre' })
  })

  it('réponse incomplète : le choix demandé est repris, la date est celle du moment', async () => {
    const r = await voterResolution(JETON, 'r1', 'abstention', fetchSimule(200, { vote: { vote: 'peut-être' } }).fetchImpl)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.choix).toBe('abstention')
    expect(new Date(r.enregistreLe).toISOString()).toBe(r.enregistreLe)
  })

  it('409 vote_clos / vote_ferme → codes dédiés ; 403 locataire → role_interdit ; 404 → fiche_introuvable ; exception → reseau', async () => {
    expect(await voterResolution(JETON, 'r', 'pour', fetchSimule(409, { error: 'vote_clos' }).fetchImpl)).toEqual({ ok: false, code: 'vote_clos' })
    expect(await voterResolution(JETON, 'r', 'pour', fetchSimule(409, { error: 'vote_ferme' }).fetchImpl)).toEqual({ ok: false, code: 'vote_ferme' })
    expect(await voterResolution(JETON, 'r', 'pour', fetchSimule(403, { error: 'role_interdit' }).fetchImpl)).toEqual({ ok: false, code: 'role_interdit' })
    expect(await voterResolution(JETON, 'r', 'pour', fetchSimule(404, { error: 'not_found' }).fetchImpl)).toEqual({ ok: false, code: 'fiche_introuvable' })
    expect(await voterResolution(JETON, 'r', 'pour', fetchSimule(200, null, { lever: new Error('x') }).fetchImpl)).toEqual({ ok: false, code: 'reseau' })
  })
})

describe('dateLimiteVote et voteOuvert', () => {
  // Séance le 20 novembre à 18 h (UTC), loin des changements d'heure.
  const SEANCE = '2026-11-20T18:00:00Z'

  it('la date limite est trois jours avant la séance, à la même heure', () => {
    expect(dateLimiteVote(SEANCE)?.toISOString()).toBe('2026-11-17T18:00:00.000Z')
    expect(dateLimiteVote('2026-11-20')?.getTime()).toBe(new Date('2026-11-20').getTime() - 3 * 24 * 3600 * 1000)
  })

  it('date illisible → null, vote fermé', () => {
    expect(dateLimiteVote('pas une date')).toBeNull()
    expect(dateLimiteVote('')).toBeNull()
    expect(voteOuvert('pas une date', new Date(SEANCE))).toBe(false)
  })

  it('ouvert jusqu’à la date limite incluse, fermé ensuite', () => {
    expect(voteOuvert(SEANCE, new Date('2026-11-10T10:00:00Z'))).toBe(true)
    expect(voteOuvert(SEANCE, new Date('2026-11-17T18:00:00Z'))).toBe(true)
    expect(voteOuvert(SEANCE, new Date('2026-11-17T18:00:01Z'))).toBe(false)
    expect(voteOuvert(SEANCE, new Date('2026-11-18T10:00:00Z'))).toBe(false)
    expect(voteOuvert(SEANCE, new Date('2026-11-21T10:00:00Z'))).toBe(false)
  })

  it('sans instant donné, compare à maintenant', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-11-10T10:00:00Z'))
      expect(voteOuvert(SEANCE)).toBe(true)
      vi.setSystemTime(new Date('2026-11-19T10:00:00Z'))
      expect(voteOuvert(SEANCE)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
