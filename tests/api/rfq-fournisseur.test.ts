// tests/api/rfq-fournisseur.test.ts
//
// Devis Fournisseurs (demandes de prix d'une société BTP), audit des fondations BTP du 11/11/2026, constat
// api-peripherie-10.
//   - /api/rfq/offer/[jeton] (lien envoyé au fournisseur) : le jeton était validé comme un UUID, alors que la base le
//     crée en 64 caractères hexadécimaux (025_rfq_btp.sql) — le lien répondait toujours « Invalid token ». La réponse
//     du fournisseur écrivait un statut que la contrainte de la table refuse (« answered ») : elle n'était jamais
//     enregistrée. Une offre répondue garde le statut « pending » avec son prix, comme l'attend l'écran de la
//     société (boutons Accepter / Refuser). Le lien, annoncé « valable 7 jours » dans l'e-mail, n'expirait jamais.
//   - PATCH /api/rfq (décision de la société) : accepter ou refuser une offre passait par le navigateur, alors que la
//     table des offres n'accorde que la lecture à l'utilisateur — l'écran annonçait « Offre acceptée » sans que rien
//     ne change. La décision passe par le serveur, qui vérifie que la demande est bien celle du compte.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Appel, FauxSupabase, Reponse } from '../helpers/faux-supabase-marches'

const h = vi.hoisted(() => ({ base: null as null | FauxSupabase, user: { id: '11111111-1111-4111-8111-111111111111' } }))

vi.mock('@supabase/supabase-js', async () => {
  const { creerFauxSupabase } = await import('../helpers/faux-supabase-marches')
  h.base = creerFauxSupabase()
  const auth = {
    getUser: async (jeton: string) => (jeton === 'jeton-de-session'
      ? { data: { user: h.user }, error: null }
      : { data: { user: null }, error: { message: 'jeton invalide' } }),
  }
  return { createClient: () => ({ ...(h.base as FauxSupabase).client, auth }) }
})
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/email-rfq', () => ({ sendRFQToSuppliers: vi.fn(async () => undefined) }))

const { GET: LIRE_OFFRE, POST: REPONDRE } = await import('@/app/api/rfq/offer/[token]/route')
const ROUTE_RFQ = await import('@/app/api/rfq/route')

const MOI = '11111111-1111-4111-8111-111111111111'
const AUTRE = '22222222-2222-4222-8222-222222222222'
const DEMANDE = '44444444-4444-4444-8444-444444444444'
const OFFRE = '55555555-5555-4555-8555-555555555555'
const AUTRE_OFFRE = '66666666-6666-4666-8666-666666666666'
// Jeton au format de la base : encode(gen_random_bytes(32), 'hex').
const JETON = 'a3f1c2d4e5b6978812ab34cd56ef7890a1b2c3d4e5f60718293a4b5c6d7e8f90'
const STATUTS_OFFRE = ['pending', 'accepted', 'rejected']
const base = () => h.base as FauxSupabase
// Horloge figée (beforeEach) : la route compare la date d'envoi à Date.now(), le test ne lit jamais l'horloge réelle.
const MAINTENANT = new Date('2026-11-16T12:00:00.000Z')
const JOUR_MS = 86_400_000
const ilYAMs = (ms: number) => new Date(MAINTENANT.getTime() - ms).toISOString()
const ilYA = (jours: number) => ilYAMs(jours * JOUR_MS)

/** Une offre envoyée il y a 2 jours, sans réponse ; la contrainte de statut de la table est appliquée. */
const enBase = (surcharge: (appel: Appel) => Reponse | undefined = () => undefined) => (appel: Appel): Reponse => {
  const special = surcharge(appel)
  if (special) return special
  const statut = (appel.donnees as { status?: string } | undefined)?.status
  if (appel.table === 'offers' && appel.operation === 'update' && statut && !STATUTS_OFFRE.includes(statut)) {
    return { data: null, error: { code: '23514', message: 'new row for relation "offers" violates check constraint "offers_status_check"' } }
  }
  if (appel.table === 'offers' && appel.operation === 'select') {
    return {
      data: {
        id: OFFRE, rfq_id: DEMANDE, status: 'pending', total_price: null, created_at: ilYA(2), supplier_name: 'Fournisseur',
        rfqs: { id: DEMANDE, title: 'Plaques de plâtre', country: 'FR', rfq_items: [] },
      },
      error: null,
    }
  }
  if (appel.table === 'offers' && appel.operation === 'update') return { data: { id: OFFRE, rfq_id: DEMANDE }, error: null }
  if (appel.table === 'rfqs' && appel.operation === 'select') return { data: { id: DEMANDE, status: 'answered' }, error: null }
  return { data: null, error: null }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAINTENANT)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projet.supabase.test')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'cle-publique-de-test')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'cle-service-de-test')
  base().vider()
  base().repondre = enBase()
  h.user = { id: MOI }
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

const contexte = (jeton = JETON) => ({ params: Promise.resolve({ token: jeton }) })
const lire = (jeton = JETON) => LIRE_OFFRE(new NextRequest(`https://vitfix.io/api/rfq/offer/${jeton}`), contexte(jeton))
const repondre = (corps: Record<string, unknown>, jeton = JETON) => REPONDRE(
  new NextRequest(`https://vitfix.io/api/rfq/offer/${jeton}`, { method: 'POST', body: JSON.stringify(corps), headers: { 'Content-Type': 'application/json' } }),
  contexte(jeton),
)
const REPONSE = { total_price: 1250.5, delivery_days: 5, comment: 'Livraison sur chantier comprise' }

describe('Lien du fournisseur — /api/rfq/offer/[jeton]', () => {
  it('le jeton créé par la base (64 caractères hexadécimaux) ouvre la demande', async () => {
    const res = await lire()
    expect(res.status).toBe(200)
    expect((await res.json()).offer).toMatchObject({ id: OFFRE, rfqs: { title: 'Plaques de plâtre' } })
    expect(base().sur('offers')[0].filtres).toContainEqual(['eq', 'token', JETON])
  })

  it('un jeton mal formé est refusé sans lecture en base', async () => {
    const res = await lire('pas-un-jeton')
    expect(res.status).toBe(400)
    expect(base().appels).toHaveLength(0)
  })

  it('la réponse est enregistrée : prix, délai et commentaire, sans statut refusé par la table', async () => {
    const res = await repondre(REPONSE)
    expect(res.status).toBe(200)
    const [ecriture] = base().sur('offers', 'update')
    expect(ecriture.donnees).toEqual({ total_price: 1250.5, delivery_days: 5, comment: 'Livraison sur chantier comprise' })
    // Une seule réponse par offre : seulement si elle attend encore et n'a pas de prix.
    expect(ecriture.filtres).toEqual(expect.arrayContaining([['eq', 'token', JETON], ['eq', 'status', 'pending'], ['is', 'total_price', null]]))
    // La demande de la société passe à « Réponse(s) reçue(s) ».
    expect(base().sur('rfqs', 'update')[0].donnees).toMatchObject({ status: 'answered' })
  })

  it('une offre déjà répondue : 409, rien n’est réécrit', async () => {
    base().repondre = enBase(appel => (appel.table === 'offers' && appel.operation === 'update'
      ? { data: null, error: { code: 'PGRST116', message: 'no rows' } }
      : undefined))
    const res = await repondre(REPONSE)
    expect(res.status).toBe(409)
    expect(base().sur('rfqs', 'update')).toHaveLength(0)
  })

  it('après 7 jours, le lien a expiré : lecture et réponse refusées avec un message clair, rien n’est écrit', async () => {
    base().repondre = enBase(appel => (appel.table === 'offers' && appel.operation === 'select'
      ? { data: { id: OFFRE, rfq_id: DEMANDE, status: 'pending', total_price: null, created_at: ilYA(8) }, error: null }
      : undefined))
    const lecture = await lire()
    expect(lecture.status).toBe(410)
    expect((await lecture.json()).error).toBe('Ce lien a expiré : il était valable 7 jours.')
    expect((await repondre(REPONSE)).status).toBe(410)
    expect(base().sur('offers', 'update')).toHaveLength(0)
  })

  it('limite exacte : 7 jours pile après l’envoi, le lien est encore valable ; 1 ms de plus, il a expiré', async () => {
    const envoyeeIlYA = (ms: number) => enBase(appel => (appel.table === 'offers' && appel.operation === 'select'
      ? { data: { id: OFFRE, rfq_id: DEMANDE, status: 'pending', total_price: null, created_at: ilYAMs(ms) }, error: null }
      : undefined))
    base().repondre = envoyeeIlYA(7 * JOUR_MS)
    expect((await lire()).status).toBe(200)
    base().repondre = envoyeeIlYA(7 * JOUR_MS + 1)
    expect((await lire()).status).toBe(410)
  })
})

describe('Décision de la société — PATCH /api/rfq', () => {
  /** `corps` en texte : envoyé tel quel (corps qui n'est pas du JSON). */
  const decider = (corps: Record<string, unknown> | string, autorisation: string | null = 'Bearer jeton-de-session') => {
    const PATCH = (ROUTE_RFQ as Record<string, unknown>).PATCH as ((req: NextRequest) => Promise<Response>) | undefined
    if (!PATCH) throw new Error('PATCH /api/rfq n’existe pas')
    return PATCH(new NextRequest('https://vitfix.io/api/rfq', {
      method: 'PATCH',
      body: typeof corps === 'string' ? corps : JSON.stringify(corps),
      headers: { 'Content-Type': 'application/json', ...(autorisation ? { Authorization: autorisation } : {}) },
    }))
  }
  /** L'offre a reçu une réponse (prix) ; la demande DEMANDE appartient à MOI. */
  const repondue = (appel: Appel): Reponse | undefined => {
    if (appel.table === 'offers' && appel.operation === 'select') {
      return { data: { id: OFFRE, rfq_id: DEMANDE, status: 'pending', total_price: 1250.5 }, error: null }
    }
    if (appel.table === 'rfqs' && appel.operation === 'select') {
      const proprietaire = appel.filtres.find(([, c]) => c === 'user_id')?.[2]
      return { data: proprietaire === MOI ? { id: DEMANDE, status: 'answered' } : null, error: null }
    }
    return undefined
  }

  it('accepter : l’offre passe à « acceptée », les autres à « refusée », la demande est close', async () => {
    base().repondre = enBase(repondue)
    const res = await decider({ offer_id: OFFRE, status: 'accepted' })
    expect(res.status).toBe(200)
    const [acceptation, refusDesAutres] = base().sur('offers', 'update')
    expect(acceptation.donnees).toEqual({ status: 'accepted' })
    expect(acceptation.filtres).toContainEqual(['eq', 'id', OFFRE])
    expect(refusDesAutres.donnees).toEqual({ status: 'rejected' })
    expect(refusDesAutres.filtres).toEqual(expect.arrayContaining([['eq', 'rfq_id', DEMANDE], ['neq', 'id', OFFRE]]))
    expect(base().sur('rfqs', 'update')[0].donnees).toMatchObject({ status: 'closed' })
  })

  it('refuser : seule l’offre passe à « refusée », la demande reste ouverte', async () => {
    base().repondre = enBase(repondue)
    const res = await decider({ offer_id: OFFRE, status: 'rejected' })
    expect(res.status).toBe(200)
    expect(base().sur('offers', 'update').map(a => a.donnees)).toEqual([{ status: 'rejected' }])
    expect(base().sur('rfqs', 'update')).toHaveLength(0)
  })

  it('l’offre d’une demande d’un autre compte : 404, rien n’est écrit', async () => {
    h.user = { id: AUTRE }
    base().repondre = enBase(repondue)
    expect((await decider({ offer_id: OFFRE, status: 'accepted' })).status).toBe(404)
    expect(base().appels.filter(a => a.operation === 'update')).toHaveLength(0)
  })

  it('une offre sans réponse du fournisseur : 409, rien n’est écrit', async () => {
    base().repondre = enBase(appel => (appel.table === 'offers' && appel.operation === 'select'
      ? { data: { id: AUTRE_OFFRE, rfq_id: DEMANDE, status: 'pending', total_price: null }, error: null }
      : repondue(appel)))
    expect((await decider({ offer_id: AUTRE_OFFRE, status: 'accepted' })).status).toBe(409)
    expect(base().appels.filter(a => a.operation === 'update')).toHaveLength(0)
  })

  it('sans session : 401 ; décision inconnue : 400 ; rien n’est écrit', async () => {
    base().repondre = enBase(repondue)
    expect((await decider({ offer_id: OFFRE, status: 'accepted' }, null)).status).toBe(401)
    expect((await decider({ offer_id: OFFRE, status: 'answered' })).status).toBe(400)
    expect(base().appels.filter(a => a.operation === 'update')).toHaveLength(0)
  })

  it.each([['mal formé', '{"offer_id": '], ['vide', '']])(
    'corps %s (pas du JSON) : 400 « Données invalides », sans erreur journalisée, rien n’est lu ni écrit',
    async (_cas, corps) => {
      const { logger } = await import('@/lib/logger')
      vi.mocked(logger.error).mockClear()
      base().repondre = enBase(repondue)
      const res = await decider(corps)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Données invalides' })
      expect(logger.error).not.toHaveBeenCalled()
      expect(base().appels).toHaveLength(0)
    },
  )
})
