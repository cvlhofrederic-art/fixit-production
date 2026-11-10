// @vitest-environment node
// tests/api/aj-signalement-similaires.test.ts
//
// GET /api/aj-signalement/similaires — signalements déjà faits au même endroit (demande de Hugo du 06/11/2026) :
// même copropriété (celle du jeton, QR code actif), parties communes, même bâtiment (normalisé) et même zone (FR ou
// PT), encore ouverts et de moins de 60 jours ; au plus 5, du plus récent au plus ancien.
// La réponse ne porte que le numéro, le type, la zone, la date (jour de Paris, sans l'heure) et le statut : ni
// identifiant, ni bâtiment, ni nom, ni coordonnées, ni description, ni heure du dépôt. La requête ne nomme que des colonnes de la migration 20261104 (aucun repli à prévoir).
// Supabase est simulé par un petit moteur qui applique les filtres eq / in / gte reçus.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  type Ligne = Record<string, unknown>
  const etat = {
    copropriete: null as null | Ligne,
    erreurLecture: null as null | { code: string; message: string },
    erreurSemblables: null as null | { code: string; message: string },
    signalements: [] as Ligne[],
    requete: null as null | { colonnes: string; filtres: Array<[string, string, unknown]>; ordre: unknown; limite: unknown },
    limites: [] as string[],
    refuser: [] as string[],
  }
  const from = (table: string) => {
    const filtres: Array<[string, string, unknown]> = []
    let colonnes = ''
    let ordre: unknown = null
    let limite: unknown = null
    const q: Record<string, unknown> = {}
    q.select = (c: string) => { colonnes = c; return q }
    q.eq = (col: string, val: unknown) => { filtres.push(['eq', col, val]); return q }
    q.in = (col: string, val: unknown[]) => { filtres.push(['in', col, val]); return q }
    q.gte = (col: string, val: unknown) => { filtres.push(['gte', col, val]); return q }
    q.order = (col: string, opts: unknown) => { ordre = [col, opts]; return q }
    q.limit = (n: number) => { limite = n; return q }
    q.maybeSingle = async () => (etat.erreurLecture ? { data: null, error: etat.erreurLecture } : { data: etat.copropriete, error: null })
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      if (table === 'signalements_qr') etat.requete = { colonnes, filtres: [...filtres], ordre, limite }
      if (etat.erreurSemblables) return Promise.resolve({ data: null, error: etat.erreurSemblables }).then(ok, ko)
      const lignes = etat.signalements.filter((l) => filtres.every(([op, col, val]) => {
        if (op === 'eq') return l[col] === val
        if (op === 'in') return (val as unknown[]).includes(l[col])
        return String(l[col]) >= String(val)
      }))
      return Promise.resolve({ data: lignes, error: null }).then(ok, ko)
    }
    return q
  }
  return { etat, from, warn: vi.fn(), error: vi.fn() }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.error, warn: h.warn, info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async (cle: string) => {
    h.etat.limites.push(cle)
    return !h.etat.refuser.some((prefixe) => cle.startsWith(prefixe))
  }),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => h.from(table) } }))
vi.mock('@/lib/supabase-server-component', () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } })) }))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => null) }))

const { GET } = await import('@/app/api/aj-signalement/similaires/route')

const JETON = '0123456789abcdef0123456789abcdef'
const ID_COPRO = 'c0000000-0000-4000-8000-000000000001'
const COPRO = { id: ID_COPRO, nom: 'Parc Belle Ombre', adresse: '', jeton: JETON, emails_destinataires: [], actif: true, created_at: '2026-11-04T10:00:00.000Z' }

const ilYa = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString()

/** Ligne complète, comme en base : la route ne doit rien en laisser sortir d'autre que la fiche publique. */
function signalement(id: string, sur: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, copropriete_id: ID_COPRO, prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie.durand@example.com',
    batiment: 'Bât. B', etage: '4', num_lot: '12', est_partie_commune: true, zone_signalee: 'Escalier',
    type_intervention: 'Éclairage des parties communes', description: 'Plus de lumière au 3e, chez Mme Durand',
    priorite: 'normale', statut: 'en_attente', langue: 'fr', created_at: ilYa(1), ...sur,
  }
}

const COLONNES_NOUVELLES = ['confirmation_envoyee_le', 'confirmation_erreur', 'qualite_declarant', 'adresse_proposee', 'signalement_lie_id']

function lire(params: Record<string, string>) {
  return GET(new NextRequest(`https://vitfix.io/api/aj-signalement/similaires?${new URLSearchParams(params)}`))
}
const PARAMS = { jeton: JETON, batiment: 'b', zone: 'Escalier', langue: 'fr' }

beforeEach(() => {
  h.etat.copropriete = { ...COPRO }
  h.etat.erreurLecture = null
  h.etat.erreurSemblables = null
  h.etat.requete = null
  h.etat.limites = []
  h.etat.refuser = []
  h.warn.mockClear()
  h.error.mockClear()
  h.etat.signalements = [
    signalement('1a2b3c4d-0000-4000-8000-000000000001', { created_at: ilYa(3) }),
    signalement('2b3c4d5e-0000-4000-8000-000000000002', { created_at: ilYa(1), zone_signalee: 'Escadas', batiment: 'b', statut: 'acceptee', langue: 'pt', type_intervention: 'Elevador' }),
    signalement('3c4d5e6f-0000-4000-8000-000000000003', { batiment: 'A' }),
    signalement('4d5e6f70-0000-4000-8000-000000000004', { statut: 'terminee' }),
    signalement('5e6f7081-0000-4000-8000-000000000005', { est_partie_commune: false }),
    signalement('6f708192-0000-4000-8000-000000000006', { created_at: ilYa(61) }),
    signalement('708192a3-0000-4000-8000-000000000007', { copropriete_id: 'c0000000-0000-4000-8000-000000000002' }),
    signalement('8192a3b4-0000-4000-8000-000000000008', { zone_signalee: 'Ascenseur' }),
    signalement('92a3b4c5-0000-4000-8000-000000000009', { type_intervention: 'Appelez Marie au 06 12 34 56 78', created_at: ilYa(10) }),
  ]
})

describe('validation et copropriété', () => {
  it.each([
    ['sans bâtiment', { jeton: JETON, zone: 'Escalier' }],
    ['bâtiment vide', { ...PARAMS, batiment: '  ' }],
    ['sans zone', { jeton: JETON, batiment: 'B' }],
    ['jeton mal formé', { ...PARAMS, jeton: 'abc' }],
    ['langue inconnue', { ...PARAMS, langue: 'de' }],
  ])('400 : %s', async (_cas, params) => {
    const res = await lire(params as Record<string, string>)
    expect(res.status).toBe(400)
    expect(h.etat.requete).toBeNull()
  })

  it('404 quand le QR code est inconnu ou désactivé', async () => {
    h.etat.copropriete = null
    const res = await lire(PARAMS)
    expect(res.status).toBe(404)
    expect(h.etat.requete).toBeNull()
  })

  it('429 au-delà de la limite par adresse IP (sondage bâtiment par bâtiment)', async () => {
    h.etat.refuser = ['qr_similaires_']
    expect((await lire(PARAMS)).status).toBe(429)
    expect(h.etat.requete).toBeNull()
  })

  it('503 base_absente ; 500 si la lecture des signalements échoue', async () => {
    h.etat.erreurLecture = { code: '42P01', message: 'relation does not exist' }
    expect((await lire(PARAMS)).status).toBe(503)
    h.etat.erreurLecture = null
    h.etat.erreurSemblables = { code: 'XX000', message: 'panne' }
    const res = await lire(PARAMS)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'serveur' })
  })
})

describe('signalements semblables', () => {
  it('filtres envoyés : copropriété du jeton, parties communes, statuts ouverts, 60 jours, zone FR et PT ; colonnes d’origine seulement', async () => {
    const res = await lire(PARAMS)
    expect(res.status).toBe(200)
    const r = h.etat.requete
    expect(r?.filtres).toContainEqual(['eq', 'copropriete_id', ID_COPRO])
    expect(r?.filtres).toContainEqual(['eq', 'est_partie_commune', true])
    expect(r?.filtres).toContainEqual(['in', 'statut', ['en_attente', 'acceptee', 'en_cours']])
    expect(r?.filtres).toContainEqual(['in', 'zone_signalee', ['Escalier', 'Escadas']])
    const depuis = r?.filtres.find(([op, col]) => op === 'gte' && col === 'created_at')?.[2]
    expect(Math.abs(Date.parse(String(depuis)) - (Date.now() - 60 * 86_400_000))).toBeLessThan(60_000)
    expect(r?.ordre).toEqual(['created_at', { ascending: false }])
    for (const colonne of COLONNES_NOUVELLES) expect(r?.colonnes).not.toContain(colonne)
    for (const colonne of ['prenom', 'nom', 'telephone', 'email', 'description']) expect(r?.colonnes.split(/,\s*/)).not.toContain(colonne)
  })

  it('« Bât. B » est retrouvé par « b » ; fiches publiques seulement, du plus récent au plus ancien', async () => {
    const res = await lire(PARAMS)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const { semblables } = await res.json()
    const jour = expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    expect(semblables).toEqual([
      { numero: '2B3C4D5E', typeIntervention: 'Ascenseur', zone: 'Escalier', creeLe: jour, statut: 'acceptee' },
      { numero: '1A2B3C4D', typeIntervention: 'Éclairage des parties communes', zone: 'Escalier', creeLe: jour, statut: 'en_attente' },
      { numero: '92A3B4C5', typeIntervention: 'Autre', zone: 'Escalier', creeLe: jour, statut: 'en_attente' },
    ])
  })

  it('date du jour de Paris seulement, jamais l’heure du dépôt (minimisation : l’heure aiderait à deviner qui a signalé)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-06T12:00:00.000Z'))
    try {
      h.etat.signalements = [
        signalement('1a2b3c4d-0000-4000-8000-000000000001', { created_at: '2026-11-05T13:32:07.123456+00:00' }),
        // 23 h 32 UTC le 5 = 0 h 32 le 6 à Paris : le jour rendu est celui de Paris.
        signalement('2b3c4d5e-0000-4000-8000-000000000002', { created_at: '2026-11-05T23:32:07.123456+00:00' }),
      ]
      const res = await lire(PARAMS)
      const texte = await res.text()
      expect(JSON.parse(texte).semblables.map((s: { numero: string; creeLe: string }) => [s.numero, s.creeLe])).toEqual([
        ['2B3C4D5E', '2026-11-06'], ['1A2B3C4D', '2026-11-05'],
      ])
      for (const interdit of ['13:32', '23:32', '123456', '+00:00']) expect(texte, interdit).not.toContain(interdit)
      expect(texte).not.toMatch(/\d{2}:\d{2}|\dT\d/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('aucune donnée personnelle ni texte libre : ni identifiant, ni bâtiment, ni nom, ni contact, ni description', async () => {
    const texte = JSON.stringify(await (await lire({ ...PARAMS, batiment: 'Bâtiment B' })).json())
    for (const interdit of ['Marie', 'Durand', '@', '06 12', 'lumière', 'Bât', '-0000-', 'Appelez', 'copropriete_id']) {
      expect(texte, interdit).not.toContain(interdit)
    }
  })

  it('page en portugais : type et zone dans la liste portugaise', async () => {
    const { semblables } = await (await lire({ ...PARAMS, langue: 'pt', zone: 'Escadas', batiment: 'Bloco B' })).json()
    expect(semblables.map((s: { typeIntervention: string; zone: string }) => [s.typeIntervention, s.zone])).toEqual([
      ['Elevador', 'Escadas'], ['Iluminação das partes comuns', 'Escadas'], ['Outro', 'Escadas'],
    ])
  })

  it('au plus 5', async () => {
    h.etat.signalements = Array.from({ length: 8 }, (_, i) => signalement(`${String(i + 1).repeat(8)}-0000-4000-8000-00000000000${i}`, { created_at: ilYa(i + 1) }))
    const { semblables } = await (await lire(PARAMS)).json()
    expect(semblables.map((s: { numero: string }) => s.numero)).toEqual(['11111111', '22222222', '33333333', '44444444', '55555555'])
  })

  it('aucun semblable : liste vide', async () => {
    const { semblables } = await (await lire({ ...PARAMS, batiment: 'Z' })).json()
    expect(semblables).toEqual([])
  })
})
