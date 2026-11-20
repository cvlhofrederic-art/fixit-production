// @vitest-environment node
// tests/api/devis-sign-entreprise.test.ts
//
// POST /api/devis-sign — signature d'un devis par le client, depuis la messagerie de la réservation.
//   - Quand le message du devis ne porte ni le délai d'exécution ni la date de prestation, le serveur les cherche
//     dans le devis enregistré : il doit lire celui de l'entreprise de la réservation. Chaque entreprise a sa propre
//     série de numéros (DEV-2026-001…) : le même numéro existe chez plusieurs.
//   - La signature dessinée est enregistrée nettoyée aux deux endroits (message du devis, message de confirmation
//     repris dans la notification du professionnel).
// Aucune donnée réelle : comptes, fiches et devis d'exemple.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>
type Appel = { table: string; op: 'select' | 'insert' | 'update'; eq: Array<[string, unknown]>; donnees?: Ligne }

const CLIENT = '11111111-1111-4111-8111-111111111111'
const COMPTE_PRO = '22222222-2222-4222-8222-222222222222'
const FICHE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const FICHE_AUTRE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const RESERVATION = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const MESSAGE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const NUMERO = 'DEV-2026-001'

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | { id: string; email: string; user_metadata: Record<string, unknown> },
    tables: {} as Record<string, Ligne[]>,
    appels: [] as Appel[],
  }
  const from = (table: string) => {
    const appel: Appel = { table, op: 'select', eq: [] }
    etat.appels.push(appel)
    const lignes = () => (etat.tables[table] ?? []).filter((l) => appel.eq.every(([c, v]) => l[c] === v))
    const resultat = (unique: boolean) => {
      if (appel.op === 'insert') return { data: unique ? { id: 'message-signe', ...appel.donnees } : [{ id: 'message-signe' }], error: null }
      if (appel.op === 'update') return { data: [{ id: MESSAGE }], error: null }
      const l = lignes()
      return { data: unique ? l[0] ?? null : l, error: null }
    }
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.eq = (c: string, v: unknown) => { appel.eq.push([c, v]); return q }
    q.is = () => q
    q.limit = () => q
    q.insert = (d: Ligne) => { appel.op = 'insert'; appel.donnees = d; return q }
    q.update = (d: Ligne) => { appel.op = 'update'; appel.donnees = d; return q }
    q.single = async () => resultat(true)
    q.maybeSingle = async () => resultat(true)
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat(false)).then(ok, ko)
    return q
  }
  return { etat, from }
})

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.etat.user) }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.from(t) } }))

const { POST } = await import('@/app/api/devis-sign/route')

const SIGNATURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><script>alert(1)</script><path d="M10 80 C 40 10, 65 10, 95 80" stroke="#000" fill="none" onclick="alert(2)"/></svg>'

const signer = async (corps: Record<string, unknown> = {}) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/devis-sign', {
    method: 'POST',
    headers: { Authorization: 'Bearer jeton', 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking_id: RESERVATION, message_id: MESSAGE, signer_name: 'Marie Exemple', ...corps }),
  }))
  return { status: res.status, json: await res.json() as { success?: boolean; error?: string; missing?: Record<string, boolean> } }
}

const appels = (table: string, op: Appel['op']) => h.etat.appels.filter((a) => a.table === table && a.op === op)

/** Devis complet (délai et date) et devis incomplet, tels qu'enregistrés par la synchronisation. */
const devisComplet = (ficheId: string): Ligne => ({ numero: NUMERO, artisan_id: ficheId, raw_data: { executionDelay: '15 jours', prestationDate: '2027-01-10' } })
const devisIncomplet = (ficheId: string): Ligne => ({ numero: NUMERO, artisan_id: ficheId, raw_data: {} })

beforeEach(() => {
  h.etat.user = { id: CLIENT, email: 'marie@exemple.test', user_metadata: { full_name: 'Marie Exemple' } }
  h.etat.appels = []
  h.etat.tables = {
    bookings: [{ id: RESERVATION, client_id: CLIENT, artisan_id: FICHE, notes: '' }],
    // Message du devis sans délai ni date : le serveur doit les lire dans le devis enregistré.
    booking_messages: [{ id: MESSAGE, booking_id: RESERVATION, type: 'devis_sent', metadata: { docNumber: NUMERO, totalStr: '1 200,00 €' }, content: '', sender_id: COMPTE_PRO }],
    profiles_artisan: [{ id: FICHE, user_id: COMPTE_PRO }],
    devis: [],
  }
})

describe('POST /api/devis-sign — le devis vérifié est celui de l’entreprise de la réservation', () => {
  it('même numéro chez une autre entreprise (complet) et devis de l’entreprise incomplet : signature refusée (422)', async () => {
    // L'autre entreprise est lue en premier par une recherche sur le seul numéro.
    h.etat.tables.devis = [devisComplet(FICHE_AUTRE), devisIncomplet(FICHE)]
    const res = await signer()
    expect(res.status).toBe(422)
    expect(res.json.missing).toEqual({ executionDelay: true, prestationDate: true })
    expect(appels('booking_messages', 'update')).toHaveLength(0)
    expect(appels('booking_messages', 'insert')).toHaveLength(0)
  })

  it('même numéro chez une autre entreprise (incomplet) et devis de l’entreprise complet : signature acceptée', async () => {
    h.etat.tables.devis = [devisIncomplet(FICHE_AUTRE), devisComplet(FICHE)]
    const res = await signer()
    expect(res.status).toBe(200)
    expect(res.json.success).toBe(true)
  })

  it('la recherche du devis porte sur le numéro ET sur la fiche de la réservation', async () => {
    h.etat.tables.devis = [devisComplet(FICHE)]
    await signer()
    const [recherche] = appels('devis', 'select')
    expect(recherche.eq).toEqual(expect.arrayContaining([['numero', NUMERO], ['artisan_id', FICHE]]))
  })

  it('délai et date déjà dans le message du devis : aucune lecture du devis enregistré, signature acceptée', async () => {
    h.etat.tables.booking_messages[0].metadata = { docNumber: NUMERO, totalStr: '1 200,00 €', executionDelay: '15 jours', prestationDate: '2027-01-10' }
    const res = await signer()
    expect(res.status).toBe(200)
    expect(appels('devis', 'select')).toHaveLength(0)
  })
})

describe('POST /api/devis-sign — signature dessinée nettoyée aux deux endroits', () => {
  beforeEach(() => { h.etat.tables.devis = [devisComplet(FICHE)] })

  it('message du devis et message de confirmation portent la même signature, sans script ni gestionnaire', async () => {
    const res = await signer({ signature_svg: SIGNATURE, signature_hash: 'empreinte-exemple' })
    expect(res.status).toBe(200)
    const duDevis = (appels('booking_messages', 'update')[0].donnees?.metadata as Ligne).signature_svg as string
    const deConfirmation = (appels('booking_messages', 'insert')[0].donnees?.metadata as Ligne).signature_svg as string
    expect(duDevis).toContain('<path')
    expect(duDevis).not.toMatch(/<script|onclick/i)
    expect(deConfirmation).toBe(duDevis)
    // La notification du professionnel reprend le message de confirmation.
    const notification = appels('artisan_notifications', 'insert')[0].donnees as Ligne
    expect(JSON.stringify(notification)).not.toMatch(/<script|onclick/i)
  })

  it('sans signature dessinée : aucun champ signature_svg n’est ajouté', async () => {
    const res = await signer()
    expect(res.status).toBe(200)
    expect(appels('booking_messages', 'insert')[0].donnees?.metadata).not.toHaveProperty('signature_svg')
  })
})

describe('POST /api/devis-sign — contrôles inchangés', () => {
  it('403 si le compte n’est pas le client de la réservation ; 401 sans session', async () => {
    h.etat.user = { id: COMPTE_PRO, email: 'pro@exemple.test', user_metadata: {} }
    expect((await signer()).status).toBe(403)
    h.etat.user = null
    expect((await signer()).status).toBe(401)
  })
})
