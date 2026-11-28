// @vitest-environment node
// tests/api/user-storage.test.ts — /api/user-storage, retours de la relecture du miroir du stockage (14/11/2026).
//   - GET d'un espace vide : la réponse donne les identifiants sous lesquels le compte range ses clés (le sien et
//     celui de sa fiche), pour que le navigateur ne recopie vers le serveur que ses propres clés ; un espace qui
//     détient déjà des valeurs ne les donne pas, et la fiche n'est alors pas lue ;
//   - POST : quand la base refuse le contenu d'une valeur, 422 (le navigateur met alors cette valeur à part) ; toute
//     autre erreur de la base reste un 500 (panne : l'envoi sera retenté).
// Relecture du 15/11/2026 : fiche illisible, aucun identifiant n'est donné (la liste serait incomplète) ; et chaque
// lecture ou suppression est limitée au compte connecté (filtre user_id vérifié, le double les enregistre).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>
interface ErreurBase { code?: string; message: string }

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | { id: string },
    stockage: [] as Ligne[],
    fiches: [] as Ligne[],
    erreurFiches: null as null | ErreurBase,
    erreurUpsert: null as null | ErreurBase,
    tablesLues: [] as string[],
    upserts: [] as Ligne[][],
    /** Filtres posés sur chaque requête : [table, colonne, valeur]. */
    filtres: [] as Array<[string, string, unknown]>,
  }
  const from = (table: string) => {
    etat.tablesLues.push(table)
    let resultat: { data: unknown; error: unknown } = table === 'profiles_artisan'
      ? { data: etat.erreurFiches ? null : etat.fiches, error: etat.erreurFiches }
      : { data: etat.stockage, error: null }
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = (colonne: string, valeur: unknown) => {
      etat.filtres.push([table, colonne, valeur])
      return b
    }
    b.in = (colonne: string, valeurs: unknown) => {
      etat.filtres.push([table, colonne, valeurs])
      return b
    }
    b.limit = () => b
    b.delete = () => b
    b.upsert = (lignes: Ligne[]) => {
      etat.upserts.push(lignes)
      resultat = { data: null, error: etat.erreurUpsert }
      return b
    }
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat).then(ok, ko)
    return b
  }
  return { etat, from }
})

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.etat.user) }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.from(t) } }))

const { GET, POST, DELETE } = await import('@/app/api/user-storage/route')

const COMPTE = '550e8400-e29b-41d4-a716-446655440000'
const FICHE = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const URL_ROUTE = 'https://vitfix.io/api/user-storage'

const lire = async () => {
  const res = await GET(new NextRequest(URL_ROUTE, { headers: { Authorization: 'Bearer tok' } }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

const poster = async (entries: Array<{ key: string; value: unknown }>) => {
  const res = await POST(new NextRequest(URL_ROUTE, {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

beforeEach(() => {
  h.etat.user = { id: COMPTE }
  h.etat.stockage = []
  h.etat.fiches = [{ id: FICHE }]
  h.etat.erreurFiches = null
  h.etat.erreurUpsert = null
  h.etat.tablesLues = []
  h.etat.upserts = []
  h.etat.filtres = []
})

describe('GET /api/user-storage — identifiants du compte quand son espace est vide', () => {
  it('espace vide : le compte et sa fiche sont donnés avec la liste (vide) des valeurs', async () => {
    const res = await lire()
    expect(res.status).toBe(200)
    expect(res.json.entries).toEqual({})
    expect(res.json.identifiants).toEqual([COMPTE, FICHE])
    // Les deux lectures sont limitées au compte connecté : sans ce filtre, la route donnerait les fiches de tous.
    expect(h.etat.filtres).toEqual([['user_storage', 'user_id', COMPTE], ['profiles_artisan', 'user_id', COMPTE]])
  })

  it('compte sans fiche (syndic, client) : seul son identifiant est donné', async () => {
    h.etat.fiches = []
    const res = await lire()
    expect(res.json.identifiants).toEqual([COMPTE])
  })

  // Relecture du 15/11/2026 : la liste réduite au seul compte faisait recopier ses drapeaux sans les clés de sa fiche, et
  // Providers tenait alors la migration pour faite.
  it('fiche illisible : la restauration répond quand même, sans identifiants (la liste serait incomplète)', async () => {
    h.etat.erreurFiches = { message: 'délai dépassé' }
    const res = await lire()
    expect(res.status).toBe(200)
    expect(res.json.entries).toEqual({})
    expect(res.json).not.toHaveProperty('identifiants')
  })

  it('espace qui détient déjà des valeurs : pas d’identifiants, et la fiche n’est pas lue', async () => {
    h.etat.stockage = [{ key: 'fixit_clients_a', value: [{ id: 1 }], updated_at: '2026-11-14T10:00:00.000Z' }]
    const res = await lire()
    expect(res.status).toBe(200)
    expect(res.json.entries).toEqual({ fixit_clients_a: [{ id: 1 }] })
    expect(res.json).not.toHaveProperty('identifiants')
    expect(h.etat.tablesLues).toEqual(['user_storage'])
    expect(h.etat.filtres).toEqual([['user_storage', 'user_id', COMPTE]])
  })

  it('sans session : 401, rien n’est lu', async () => {
    h.etat.user = null
    const res = await lire()
    expect(res.status).toBe(401)
    expect(h.etat.tablesLues).toEqual([])
  })
})

describe('POST /api/user-storage — valeur que la base refuse', () => {
  const ENTREES = [{ key: 'fixit_clients_a', value: [{ id: 1 }] }, { key: 'fixit_note_a', value: 'texte' }]

  it('témoin : un envoi accepté répond 200 et enregistre sous le compte connecté', async () => {
    const res = await poster(ENTREES)
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ success: true, count: 2 })
    expect(h.etat.upserts[0].map(l => [l.user_id, l.key])).toEqual([[COMPTE, 'fixit_clients_a'], [COMPTE, 'fixit_note_a']])
  })

  it.each([
    ['texte que la base ne sait pas enregistrer', '22P05'],
    ['JSON que la base ne sait pas lire', '22P02'],
    ['valeur nulle', '23502'],
    ['valeur hors contrainte', '23514'],
    ['valeur au-delà des limites de la base', '54000'],
  ])('%s (code %s) : 422, sans détail interne', async (_cas, code) => {
    h.etat.erreurUpsert = { code, message: 'détail interne de la base' }
    const res = await poster(ENTREES)
    expect(res.status).toBe(422)
    expect(res.json).toEqual({ error: 'Erreur lors de la sauvegarde' })
  })

  it.each([
    ['requête annulée pour délai', '57014'],
    ['compte inconnu de la base', '23503'],
    ['erreur sans code', undefined],
  ])('%s : 500, la panne n’est pas prise pour un refus', async (_cas, code) => {
    h.etat.erreurUpsert = { code, message: 'détail interne de la base' }
    const res = await poster(ENTREES)
    expect(res.status).toBe(500)
    expect(res.json).toEqual({ error: 'Erreur lors de la sauvegarde' })
  })
})

describe('DELETE /api/user-storage — suppression limitée au compte connecté', () => {
  it('seules les clés demandées, et seulement dans l’espace du compte connecté', async () => {
    const res = await DELETE(new NextRequest(URL_ROUTE, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: ['fixit_note_a'] }),
    }))
    expect(res.status).toBe(200)
    expect(h.etat.filtres).toEqual([['user_storage', 'user_id', COMPTE], ['user_storage', 'key', ['fixit_note_a']]])
  })
})
