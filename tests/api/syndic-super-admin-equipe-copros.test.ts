// tests/api/syndic-super-admin-equipe-copros.test.ts
//
// Démo Marseille avec le compte super_admin : le tableau de bord v54 le traite comme un syndic
// (cabinet = son id). /api/syndic/team et /api/syndic/coproprios refusaient pourtant ses écritures
// (403), et GET /api/syndic/team renvoyait 500 sur une base sans la colonne custom_modules.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Resultat = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number }

const h = vi.hoisted(() => {
  const etat = {
    role: 'super_admin',
    resultats: [] as Resultat[],
    selects: [] as string[],
    inserts: [] as unknown[],
    filtres: [] as Array<[string, unknown]>,
  }
  const suivant = () => Promise.resolve(etat.resultats.shift() ?? { data: null, error: null })
  const requete: Record<string, unknown> = {}
  for (const m of ['order', 'range', 'update', 'delete', 'or', 'limit']) requete[m] = vi.fn(() => requete)
  requete.select = vi.fn((colonnes?: string) => { etat.selects.push(colonnes ?? '*'); return requete })
  requete.insert = vi.fn((valeurs: unknown) => { etat.inserts.push(valeurs); return requete })
  requete.eq = vi.fn((col: string, val: unknown) => { etat.filtres.push([col, val]); return requete })
  requete.maybeSingle = vi.fn(suivant)
  requete.single = vi.fn(suivant)
  requete.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => suivant().then(ok, ko)
  return { etat, requete }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
  templateTeamInvite: vi.fn(() => ({ subject: 'Invitation', html: '<p>Invitation</p>' })),
}))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({ id: 'id-super-admin', email: 'admin@exemple.fr', app_metadata: { role: h.etat.role }, user_metadata: {} })),
  getUserRole: vi.fn(() => h.etat.role),
  isSyndicRole: vi.fn(() => true),
  resolveCabinetId: vi.fn(async () => 'id-super-admin'),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: vi.fn(() => h.requete) } }))

const equipe = await import('@/app/api/syndic/team/route')
const copros = await import('@/app/api/syndic/coproprios/route')

const requete = (url: string, init: { method?: string; body?: unknown } = {}) =>
  new NextRequest(url, {
    method: init.method ?? 'GET',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  })

beforeEach(() => {
  h.etat.role = 'super_admin'
  h.etat.resultats = []
  h.etat.selects = []
  h.etat.inserts = []
  h.etat.filtres = []
})

describe('GET /api/syndic/team — colonne custom_modules absente', () => {
  it('relit sans la colonne et renvoie quand même les membres', async () => {
    const membre = { id: 'm1', email: 'claire@cabinet.fr', full_name: 'Claire Martin', role: 'syndic_gestionnaire' }
    h.etat.resultats = [
      { data: null, error: { code: '42703', message: 'column syndic_team_members.custom_modules does not exist' } },
      { data: [membre], error: null },
    ]
    const res = await equipe.GET(requete('https://vitfix.io/api/syndic/team'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ members: [membre] })
    expect(h.etat.selects).toHaveLength(2)
    expect(h.etat.selects[0]).toContain('custom_modules')
    expect(h.etat.selects[1]).not.toContain('custom_modules')
    expect(h.etat.filtres).toContainEqual(['cabinet_id', 'id-super-admin'])
  })

  it('colonne présente : une seule lecture, modules personnalisés compris', async () => {
    h.etat.resultats = [{ data: [{ id: 'm1', custom_modules: ['ordens'] }], error: null }]
    const res = await equipe.GET(requete('https://vitfix.io/api/syndic/team'))
    expect(res.status).toBe(200)
    expect(h.etat.selects).toHaveLength(1)
  })

  it('autre erreur de base : 500, sans seconde lecture', async () => {
    h.etat.resultats = [{ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }]
    const res = await equipe.GET(requete('https://vitfix.io/api/syndic/team'))
    expect(res.status).toBe(500)
    expect(h.etat.selects).toHaveLength(1)
  })
})

describe('/api/syndic/team — écritures du super_admin sur son cabinet', () => {
  it('POST : invitation acceptée (plus de 403) dans le cabinet du super_admin', async () => {
    h.etat.resultats = [{ data: null, error: null }, { data: { id: 'm2' }, error: null }]
    const res = await equipe.POST(requete('https://vitfix.io/api/syndic/team', {
      method: 'POST', body: { email: 'claire@cabinet.fr', full_name: 'Claire Martin', memberRole: 'syndic_gestionnaire' },
    }))
    expect(res.status).toBe(200)
    expect(h.etat.inserts[0]).toMatchObject({ cabinet_id: 'id-super-admin', role: 'syndic_gestionnaire' })
  })

  it('PATCH : modification acceptée', async () => {
    h.etat.resultats = [{ data: { id: 'm1', user_id: null }, error: null }, { data: { id: 'm1', is_active: false }, error: null }]
    const res = await equipe.PATCH(requete('https://vitfix.io/api/syndic/team', { method: 'PATCH', body: { member_id: 'm1', is_active: false } }))
    expect(res.status).toBe(200)
  })

  it('DELETE : suppression acceptée, limitée au cabinet', async () => {
    h.etat.resultats = [{ data: null, error: null }]
    const res = await equipe.DELETE(requete('https://vitfix.io/api/syndic/team?member_id=m1', { method: 'DELETE' }))
    expect(res.status).toBe(200)
    expect(h.etat.filtres).toContainEqual(['cabinet_id', 'id-super-admin'])
  })

  it('un employé (syndic_tech) reste refusé', async () => {
    h.etat.role = 'syndic_tech'
    const res = await equipe.DELETE(requete('https://vitfix.io/api/syndic/team?member_id=m1', { method: 'DELETE' }))
    expect(res.status).toBe(403)
  })
})

describe('/api/syndic/coproprios — écritures du super_admin sur son cabinet', () => {
  it('POST : création acceptée dans le cabinet du super_admin', async () => {
    h.etat.resultats = [{ data: [{ id: 'c1' }], error: null }]
    const res = await copros.POST(requete('https://vitfix.io/api/syndic/coproprios', {
      method: 'POST', body: { coproprio: { immeuble: 'Résidence Le Prado', numeroPorte: '4B', nomProprietaire: 'Martin' } },
    }))
    expect(res.status).toBe(200)
    expect((h.etat.inserts[0] as Array<Record<string, unknown>>)[0]).toMatchObject({ cabinet_id: 'id-super-admin', nom_proprietaire: 'Martin' })
  })

  it('DELETE : suppression acceptée, limitée au cabinet', async () => {
    h.etat.resultats = [{ data: null, error: null }]
    const res = await copros.DELETE(requete('https://vitfix.io/api/syndic/coproprios?id=c1', { method: 'DELETE' }))
    expect(res.status).toBe(200)
    expect(h.etat.filtres).toContainEqual(['cabinet_id', 'id-super-admin'])
  })

  it('un employé (syndic_comptable) reste refusé en écriture', async () => {
    h.etat.role = 'syndic_comptable'
    const res = await copros.POST(requete('https://vitfix.io/api/syndic/coproprios', { method: 'POST', body: { coproprio: { immeuble: 'X' } } }))
    expect(res.status).toBe(403)
  })
})
