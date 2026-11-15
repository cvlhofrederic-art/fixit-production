// @vitest-environment node
// tests/api/artisan-absences-lecture-publique.test.ts
//
// GET /api/artisan-absences — lecture publique des absences d'une fiche (la prise de rendez-vous n'a besoin que des
// dates). Le motif (« Maladie », « Formation »…) et le libellé libre, qui peut porter le nom d'un client, ne sont
// renvoyés qu'au propriétaire de la fiche, avec sa session : son tableau de bord les affiche dans l'agenda.
// Le faux Supabase applique la liste de colonnes demandée, comme la base. Aucune donnée réelle.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>

const PROPRIETAIRE = '11111111-1111-4111-8111-111111111111'
const AUTRE_COMPTE = '22222222-2222-4222-8222-222222222222'
const FICHE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | { id: string },
    fiches: [] as Ligne[],
    absences: [] as Ligne[],
  }
  const from = (table: string) => {
    let colonnes: string[] = []
    const filtres: Array<[string, unknown]> = []
    const source = (): Ligne[] => (table === 'profiles_artisan' ? etat.fiches : table === 'artisan_absences' ? etat.absences : [])
    const lignes = () => source()
      .filter((l) => filtres.every(([c, v]) => l[c] === v))
      .map((l) => Object.fromEntries(colonnes.map((c) => [c, l[c] ?? null])))
    const q: Record<string, unknown> = {}
    q.select = (liste: string) => { colonnes = liste.split(',').map((c) => c.trim()); return q }
    q.eq = (c: string, v: unknown) => { filtres.push([c, v]); return q }
    q.order = () => q
    q.limit = () => q
    q.single = async () => ({ data: lignes()[0] ?? null, error: null })
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: lignes(), error: null }).then(ok, ko)
    return q
  }
  return { etat, from }
})

// Comme la vraie lecture de session : sans en-tête Authorization, personne n'est reconnu.
vi.mock('@/lib/auth-helpers', async (original) => ({
  ...(await original<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async (requete: NextRequest) => (requete.headers.get('Authorization') ? h.etat.user : null)),
}))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.from(t) } }))

const { GET } = await import('@/app/api/artisan-absences/route')

/** `avecJeton` : la requête porte un en-tête Authorization (reconnu ou non selon `h.etat.user`). */
const lire = async ({ requete = `?artisan_id=${FICHE}`, avecJeton = false }: { requete?: string; avecJeton?: boolean } = {}) => {
  const res = await GET(new NextRequest(`https://vitfix.io/api/artisan-absences${requete}`, avecJeton ? { headers: { Authorization: 'Bearer jeton' } } : undefined))
  return { status: res.status, entetes: res.headers, json: await res.json() as { data?: Ligne[]; error?: string } }
}

const PUBLIC_EN_CACHE = 'public, s-maxage=300, stale-while-revalidate=600'
const JAMAIS_EN_CACHE = 'private, no-store'

const DATES_SEULES = [
  { id: 'abs-1', artisan_id: FICHE, start_date: '2026-12-01', end_date: '2026-12-05' },
  { id: 'abs-2', artisan_id: FICHE, start_date: '2026-12-20', end_date: '2026-12-22' },
]

beforeEach(() => {
  h.etat.user = null
  h.etat.fiches = [{ id: FICHE, user_id: PROPRIETAIRE }]
  h.etat.absences = [
    { id: 'abs-1', artisan_id: FICHE, start_date: '2026-12-01', end_date: '2026-12-05', reason: 'Maladie', label: '', created_at: '2026-11-10T08:00:00Z' },
    { id: 'abs-2', artisan_id: FICHE, start_date: '2026-12-20', end_date: '2026-12-22', reason: 'Intervention devis', label: 'Marie Exemple - Rénovation salle de bain', created_at: '2026-11-12T08:00:00Z' },
  ]
})

describe('GET /api/artisan-absences — le public ne reçoit que les dates', () => {
  it('visiteur sans session : dates des absences, ni motif ni libellé, réponse publique mise en cache comme avant', async () => {
    const res = await lire()
    expect(res.status).toBe(200)
    expect(res.json.data).toEqual(DATES_SEULES)
    expect(JSON.stringify(res.json)).not.toMatch(/Maladie|Marie Exemple|reason|label/)
    expect(res.entetes.get('Cache-Control')).toBe(PUBLIC_EN_CACHE)
  })

  it('compte connecté qui n’est pas le propriétaire de la fiche : dates seules aussi, réponse jamais mise en cache', async () => {
    h.etat.user = { id: AUTRE_COMPTE }
    const res = await lire({ avecJeton: true })
    expect(res.status).toBe(200)
    expect(res.json.data).toEqual(DATES_SEULES)
    expect(res.entetes.get('Cache-Control')).toBe(JAMAIS_EN_CACHE)
  })

  it('jeton présenté mais non reconnu (session expirée) : dates seules, réponse jamais mise en cache', async () => {
    // Sans cela, la réponse « dates seules » pourrait être resservie au propriétaire une fois sa session relue.
    h.etat.user = null
    const res = await lire({ avecJeton: true })
    expect(res.status).toBe(200)
    expect(res.json.data).toEqual(DATES_SEULES)
    expect(res.entetes.get('Cache-Control')).toBe(JAMAIS_EN_CACHE)
  })

  it('400 sans artisan_id', async () => {
    expect((await lire({ requete: '' })).status).toBe(400)
  })
})

describe('GET /api/artisan-absences — le propriétaire garde le détail de son agenda', () => {
  it('avec sa session : motif et libellé renvoyés, réponse jamais mise en cache', async () => {
    h.etat.user = { id: PROPRIETAIRE }
    const res = await lire({ avecJeton: true })
    expect(res.status).toBe(200)
    expect(res.json.data).toEqual(h.etat.absences)
    expect(res.entetes.get('Cache-Control')).toBe(JAMAIS_EN_CACHE)
  })

  it('les réponses dépendent de la session : Vary: Authorization', async () => {
    expect((await lire()).entetes.get('Vary')).toBe('Authorization')
    h.etat.user = { id: PROPRIETAIRE }
    expect((await lire({ avecJeton: true })).entetes.get('Vary')).toBe('Authorization')
  })
})
