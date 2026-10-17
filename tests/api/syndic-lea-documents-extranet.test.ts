// tests/api/syndic-lea-documents-extranet.test.ts
//
// Publication des documents Léa sur le portail copropriétaire (migration 20261017) :
//   - GET /api/syndic/lea-documents renvoie publie_extranet / espace_extranet / coproprio_id /
//     categorie_extranet et, si la base ne les a pas encore (42703), relit sans elles : aucun
//     document n'est alors publié (publie_extranet: false) et un avertissement est journalisé ;
//   - PATCH /api/syndic/lea-documents/[id] : document du cabinet seulement, immeuble obligatoire
//     pour publier, espace personnel ⇒ coproprio_id d'une fiche du même cabinet, 42703 ⇒ 409.
// Supabase est simulé ; isSyndicRole / resolveCabinetId sont les vrais.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Resultat = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number }

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | Record<string, unknown>,
    resultats: [] as Resultat[],
    selects: [] as string[],
    tables: [] as string[],
    filtres: [] as Array<[string, string, unknown]>,
    updates: [] as unknown[],
  }
  const suivant = () => Promise.resolve(etat.resultats.shift() ?? { data: null, error: null })
  const from = (table: string) => {
    etat.tables.push(table)
    const q: Record<string, unknown> = {}
    for (const m of ['order', 'range', 'gte', 'lte']) q[m] = () => q
    q.select = (colonnes?: string) => { etat.selects.push(colonnes ?? '*'); return q }
    q.update = (valeurs: unknown) => { etat.updates.push(valeurs); return q }
    q.eq = (col: string, val: unknown) => { etat.filtres.push([table, col, val]); return q }
    q.maybeSingle = suivant
    q.single = suivant
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => suivant().then(ok, ko)
    return q
  }
  return { etat, from, loggerError: vi.fn(), loggerWarn: vi.fn(), loggerInfo: vi.fn() }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: h.loggerWarn, info: h.loggerInfo, debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.etat.user),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => h.from(table) } }))

const liste = await import('@/app/api/syndic/lea-documents/route')
const detail = await import('@/app/api/syndic/lea-documents/[id]/route')

const ID_CABINET = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const ID_DOC = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const ID_COPRO = '0b6d2c1e-5f1a-4b7e-9c3d-2a1b3c4d5e6f'
const SYNDIC = { id: ID_CABINET, email: 'syndic@exemple.fr', app_metadata: { role: 'syndic' } }

const DOC = { id: ID_DOC, filename: 'pv-ag-2026.pdf', type: 'pv_assemblee', status: 'processed', immeuble_id: 'imm-1' }

const lire = () => liste.GET(new NextRequest('https://vitfix.io/api/syndic/lea-documents?limit=50', { headers: { Authorization: 'Bearer jeton' } }))

function patcher(corps: unknown, id = ID_DOC) {
  const req = new NextRequest(`https://vitfix.io/api/syndic/lea-documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jeton' },
    body: typeof corps === 'string' ? corps : JSON.stringify(corps),
  })
  return detail.PATCH(req, { params: Promise.resolve({ id }) })
}

beforeEach(() => {
  Object.assign(h.etat, { user: SYNDIC, resultats: [], selects: [], tables: [], filtres: [], updates: [] })
  h.loggerError.mockClear()
  h.loggerWarn.mockClear()
  h.loggerInfo.mockClear()
})

describe('GET /api/syndic/lea-documents — colonnes du portail', () => {
  it('renvoie les quatre colonnes de publication', async () => {
    h.etat.resultats = [{ data: [{ ...DOC, publie_extranet: true, espace_extranet: 'commun', coproprio_id: null, categorie_extranet: 'pv_ag' }], error: null, count: 1 }]
    const res = await lire()
    expect(res.status).toBe(200)
    expect(h.etat.selects).toHaveLength(1)
    expect(h.etat.selects[0]).toContain('publie_extranet, espace_extranet, coproprio_id, categorie_extranet')
    const corps = await res.json()
    expect(corps.documents[0]).toMatchObject({ id: ID_DOC, publie_extranet: true, categorie_extranet: 'pv_ag' })
    expect(corps.total).toBe(1)
    expect(h.loggerWarn).not.toHaveBeenCalled()
  })

  it('migration non appliquée (42703) : relecture sans les colonnes, aucun document publié, avertissement journalisé', async () => {
    h.etat.resultats = [
      { data: null, error: { code: '42703', message: 'column syndic_documents.publie_extranet does not exist' } },
      { data: [DOC], error: null, count: 1 },
    ]
    const res = await lire()
    expect(res.status).toBe(200)
    expect(h.etat.selects).toHaveLength(2)
    expect(h.etat.selects[1]).not.toContain('publie_extranet')
    const corps = await res.json()
    expect(corps.documents).toEqual([{ ...DOC, publie_extranet: false, espace_extranet: 'commun', coproprio_id: null, categorie_extranet: null }])
    expect(h.loggerWarn).toHaveBeenCalledWith(expect.stringContaining('migration'), expect.objectContaining({ code: '42703' }))
    expect(h.loggerError).not.toHaveBeenCalled()
  })

  it('autre erreur : 500 journalisé, pas de relecture', async () => {
    h.etat.resultats = [{ data: null, error: { code: '57014', message: 'timeout' } }]
    expect((await lire()).status).toBe(500)
    expect(h.etat.selects).toHaveLength(1)
    expect(h.loggerError).toHaveBeenCalled()
  })
})

describe('PATCH /api/syndic/lea-documents/[id] — publication', () => {
  it('sans jeton : 401 ; id invalide : 400 ; corps vide ou rubrique inconnue : 400', async () => {
    h.etat.user = null
    expect((await patcher({ publie_extranet: true })).status).toBe(401)
    h.etat.user = SYNDIC
    expect((await patcher({ publie_extranet: true }, 'pas-un-uuid')).status).toBe(400)
    expect((await patcher({})).status).toBe(400)
    expect((await patcher({ categorie_extranet: 'inconnue' })).status).toBe(400)
    expect((await patcher({ espace_extranet: 'public' })).status).toBe(400)
    expect(h.etat.updates).toHaveLength(0)
  })

  it('document d’un autre cabinet (introuvable avec le filtre cabinet_id) : 404', async () => {
    h.etat.resultats = [{ data: null, error: null }]
    expect((await patcher({ publie_extranet: true })).status).toBe(404)
    expect(h.etat.filtres).toEqual(expect.arrayContaining([['syndic_documents', 'id', ID_DOC], ['syndic_documents', 'cabinet_id', ID_CABINET]]))
    expect(h.etat.updates).toHaveLength(0)
  })

  it('publier un document sans immeuble : 400 immeuble_requis, rien n’est écrit', async () => {
    h.etat.resultats = [{ data: { ...DOC, immeuble_id: null, publie_extranet: false, espace_extranet: 'commun', coproprio_id: null }, error: null }]
    const res = await patcher({ publie_extranet: true })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'immeuble_requis' })
    expect(h.etat.updates).toHaveLength(0)
  })

  it('publier dans l’espace commun : mise à jour filtrée par cabinet, document renvoyé', async () => {
    const publie = { ...DOC, publie_extranet: true, espace_extranet: 'commun', coproprio_id: null, categorie_extranet: null }
    h.etat.resultats = [
      { data: { ...DOC, publie_extranet: false, espace_extranet: 'commun', coproprio_id: null }, error: null },
      { data: publie, error: null },
    ]
    const res = await patcher({ publie_extranet: true })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ document: publie })
    expect(h.etat.updates).toEqual([{ publie_extranet: true }])
    expect(h.etat.filtres.filter(f => f[0] === 'syndic_documents')).toEqual([
      ['syndic_documents', 'id', ID_DOC], ['syndic_documents', 'cabinet_id', ID_CABINET],
      ['syndic_documents', 'id', ID_DOC], ['syndic_documents', 'cabinet_id', ID_CABINET],
    ])
    expect(h.etat.selects[1]).toContain('publie_extranet, espace_extranet, coproprio_id, categorie_extranet')
    expect(h.loggerInfo).toHaveBeenCalled()
  })

  it('rubrique seule (document déjà publié) : seule la rubrique est écrite', async () => {
    h.etat.resultats = [
      { data: { ...DOC, publie_extranet: true, espace_extranet: 'commun', coproprio_id: null }, error: null },
      { data: { ...DOC, publie_extranet: true, categorie_extranet: 'pv_ag' }, error: null },
    ]
    const res = await patcher({ categorie_extranet: 'pv_ag' })
    expect(res.status).toBe(200)
    expect(h.etat.updates).toEqual([{ categorie_extranet: 'pv_ag' }])
  })

  it('espace personnel sans copropriétaire : 400 coproprio_requis', async () => {
    h.etat.resultats = [{ data: { ...DOC, publie_extranet: true, espace_extranet: 'commun', coproprio_id: null }, error: null }]
    const res = await patcher({ espace_extranet: 'personnel' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'coproprio_requis' })
    expect(h.etat.updates).toHaveLength(0)
  })

  it('espace personnel avec une fiche d’un autre cabinet : 404 coproprio_not_found', async () => {
    h.etat.resultats = [
      { data: { ...DOC, publie_extranet: true, espace_extranet: 'commun', coproprio_id: null }, error: null },
      { data: null, error: null },
    ]
    const res = await patcher({ espace_extranet: 'personnel', coproprio_id: ID_COPRO })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'coproprio_not_found' })
    expect(h.etat.filtres).toEqual(expect.arrayContaining([['syndic_coproprios', 'id', ID_COPRO], ['syndic_coproprios', 'cabinet_id', ID_CABINET]]))
    expect(h.etat.updates).toHaveLength(0)
  })

  it('espace personnel avec une fiche du cabinet : écrit', async () => {
    const perso = { ...DOC, publie_extranet: true, espace_extranet: 'personnel', coproprio_id: ID_COPRO }
    h.etat.resultats = [
      { data: { ...DOC, publie_extranet: true, espace_extranet: 'commun', coproprio_id: null }, error: null },
      { data: { id: ID_COPRO }, error: null },
      { data: perso, error: null },
    ]
    const res = await patcher({ espace_extranet: 'personnel', coproprio_id: ID_COPRO })
    expect(res.status).toBe(200)
    expect(h.etat.updates).toEqual([{ espace_extranet: 'personnel', coproprio_id: ID_COPRO }])
  })

  it('migration non appliquée (42703 à la lecture) : 409 migration_requise', async () => {
    h.etat.resultats = [{ data: null, error: { code: '42703', message: 'column does not exist' } }]
    const res = await patcher({ publie_extranet: true })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'migration_requise' })
    expect(h.loggerWarn).toHaveBeenCalled()
  })

  it('écriture en erreur : 500 journalisé', async () => {
    h.etat.resultats = [
      { data: { ...DOC, publie_extranet: false, espace_extranet: 'commun', coproprio_id: null }, error: null },
      { data: null, error: { code: '23514', message: 'check constraint' } },
    ]
    expect((await patcher({ publie_extranet: true })).status).toBe(500)
    expect(h.loggerError).toHaveBeenCalledWith(expect.stringContaining('update'), expect.objectContaining({ code: '23514' }))
  })
})
