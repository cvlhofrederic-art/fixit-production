// @vitest-environment node
// tests/api/admin-kyc-decision-societe.test.ts — décision KYC du panneau d'administration (PATCH /api/admin/kyc)
// sur le dossier d'une société BTP française (constat inscription-profil-10 de l'audit du 11/11/2026).
//
// Défaut corrigé : la décision était écrite puis relue avec first_name et last_name, colonnes absentes de
// profiles_artisan en production (relevé du 31/10/2026, tests/seo/sitemap-fiches-artisans.test.ts). PostgREST refuse
// alors la requête entière : le statut ne changeait pas. L'e-mail de décision partait sans être attendu, avec un nom
// vide que /api/send-kyc-email refuse : la société n'était jamais prévenue.
// Faux client : colonnes de production ; une colonne inconnue, lue ou relue, donne l'erreur 42703 sans rien écrire.
// Les dossiers qui ne sont pas ceux d'une société BTP française gardent le chemin d'avant (témoins).

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { definirListeSuperAdmin, superAdminAutorise } from './super-admin-test-utils'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => {
  // Extrait des colonnes de public.profiles_artisan en production (ni first_name, ni last_name)
  const colonnes = new Set([
    'id', 'user_id', 'email', 'company_name', 'language', 'kyc_market', 'kyc_status', 'kyc_reviewed_at',
    'kyc_reviewed_by', 'kyc_rejection_reason', 'created_at',
  ])
  const etat = { user: null as User | null, fiches: [] as Ligne[] }
  const erreurColonne = (nom: string) => ({ code: '42703', message: `column profiles_artisan.${nom} does not exist` })
  const from = (table: string) => {
    if (table !== 'profiles_artisan') throw new Error(`table inattendue : ${table}`)
    const filtres: Array<[string, unknown]> = []
    let lecture: string[] | null = null
    let valeurs: Ligne | null = null
    const b: Record<string, unknown> = {}
    b.select = (c = '*') => { lecture = c === '*' ? null : c.split(',').map((x) => x.trim()); return b }
    b.eq = (col: string, val: unknown) => { filtres.push([col, val]); return b }
    b.update = (v: Ligne) => { valeurs = v; return b }
    b.single = async () => {
      const inconnue = [...(lecture ?? []), ...Object.keys(valeurs ?? {})].find((c) => !colonnes.has(c))
      if (inconnue) return { data: null, error: erreurColonne(inconnue) }
      const [ligne] = etat.fiches.filter((l) => filtres.every(([c, v]) => l[c] === v))
      if (!ligne) return { data: null, error: { code: 'PGRST116', message: 'aucune ligne' } }
      if (valeurs) Object.assign(ligne, valeurs)
      return { data: lecture ? Object.fromEntries(lecture.map((c) => [c, ligne[c] ?? null])) : { ...ligne }, error: null }
    }
    return b
  }
  return { etat, from }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.etat.user),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.from(t) } }))

definirListeSuperAdmin()
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.test')
vi.stubEnv('INTERNAL_API_SECRET', 'secret-de-test')
const { PATCH } = await import('@/app/api/admin/kyc/route')

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const ID_SOCIETE = '3f2b8c1e-5d4a-4b6f-9e7d-1a2b3c4d5e6f'
const ID_ARTISAN = '7a1c9e2b-4d3f-4a5b-8c6d-9e0f1a2b3c4d'

const fetchEmail = vi.fn()

async function decider(corps: Record<string, unknown>) {
  const res = await PATCH(new NextRequest('https://vitfix.test/api/admin/kyc', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer jeton', 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

const fiche = (id: string) => h.etat.fiches.find((f) => f.id === id) as Ligne
const corpsEmail = () => JSON.parse(String((fetchEmail.mock.calls[0]?.[1] as RequestInit | undefined)?.body))

beforeEach(() => {
  h.etat.user = superAdminAutorise()
  h.etat.fiches = [
    { id: ID_SOCIETE, user_id: 'compte-societe', email: 'contact@exemple.fr', company_name: 'BÂTIMENT EXEMPLE', language: 'fr', kyc_market: 'fr_btp', kyc_status: 'pending' },
    { id: ID_ARTISAN, user_id: 'compte-artisan', email: 'artisan@exemple.fr', company_name: 'Plomberie Exemple', language: 'fr', kyc_market: 'fr_artisan', kyc_status: 'pending' },
  ]
  fetchEmail.mockReset().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
  vi.stubGlobal('fetch', fetchEmail)
})

describe('Décision KYC sur le dossier d’une société BTP française', () => {
  it('« Approuver » enregistre le statut et prévient la société par e-mail, à son nom', async () => {
    const { status, json } = await decider({ artisan_id: ID_SOCIETE, action: 'approve' })

    expect(status).toBe(200)
    expect(json).toEqual({ success: true, status: 'approved', email_envoye: true })
    // Auteur noté par l'identifiant du compte de l'administrateur, jamais par son e-mail (fiche lisible par la société).
    const admin = superAdminAutorise()
    expect(fiche(ID_SOCIETE)).toMatchObject({ kyc_status: 'approved', kyc_reviewed_by: admin.id })
    expect(JSON.stringify(fiche(ID_SOCIETE))).not.toContain(String(admin.email))
    expect(fetchEmail).toHaveBeenCalledTimes(1)
    expect(fetchEmail.mock.calls[0][0]).toBe('https://vitfix.test/api/send-kyc-email')
    expect(corpsEmail()).toEqual({
      to: 'contact@exemple.fr', name: 'BÂTIMENT EXEMPLE', company: 'BÂTIMENT EXEMPLE', action: 'approve', market: 'fr_btp',
    })
  })

  it('« Rejeter » enregistre le statut et le motif, et l’e-mail porte le motif', async () => {
    const { status } = await decider({ artisan_id: ID_SOCIETE, action: 'reject', rejection_reason: 'Kbis illisible' })

    expect(status).toBe(200)
    expect(fiche(ID_SOCIETE)).toMatchObject({ kyc_status: 'rejected', kyc_rejection_reason: 'Kbis illisible' })
    expect(corpsEmail()).toMatchObject({ action: 'reject', rejection_reason: 'Kbis illisible', name: 'BÂTIMENT EXEMPLE' })
  })

  it('e-mail refusé : la décision reste enregistrée et la réponse le signale', async () => {
    fetchEmail.mockResolvedValue(new Response(JSON.stringify({ error: 'Données invalides' }), { status: 400 }))

    const { status, json } = await decider({ artisan_id: ID_SOCIETE, action: 'approve' })

    expect(status).toBe(200)
    expect(json).toEqual({ success: true, status: 'approved', email_envoye: false })
    expect(fiche(ID_SOCIETE).kyc_status).toBe('approved')
  })

  it('envoi coupé (réseau) : la décision reste enregistrée et la réponse le signale', async () => {
    fetchEmail.mockRejectedValue(new TypeError('fetch failed'))

    const { status, json } = await decider({ artisan_id: ID_SOCIETE, action: 'approve' })

    expect(status).toBe(200)
    expect(json.email_envoye).toBe(false)
    expect(fiche(ID_SOCIETE).kyc_status).toBe('approved')
  })

  // Une fiche dont la langue n'est pas posée est celle d'une société française : seul le portugais en sort
  it.each([
    ['nulle', (ligne: Ligne) => { ligne.language = null }],
    ['absente', (ligne: Ligne) => { delete ligne.language }],
  ])('fiche sans langue posée (langue %s) : la décision est enregistrée et la société prévenue', async (_cas, retirerLangue) => {
    retirerLangue(fiche(ID_SOCIETE))

    const { status, json } = await decider({ artisan_id: ID_SOCIETE, action: 'approve' })

    expect(status).toBe(200)
    expect(json).toEqual({ success: true, status: 'approved', email_envoye: true })
    expect(fiche(ID_SOCIETE).kyc_status).toBe('approved')
    expect(corpsEmail()).toMatchObject({ to: 'contact@exemple.fr', name: 'BÂTIMENT EXEMPLE' })
  })
})

describe('Autres dossiers : chemin d’avant, inchangé (témoins)', () => {
  it('dossier d’artisan : même relecture qu’avant (first_name, last_name), toujours refusée par la base de production', async () => {
    const { status } = await decider({ artisan_id: ID_ARTISAN, action: 'approve' })

    // Défaut identique côté artisan, signalé à Frédéric et laissé hors de ce lot (règle artisan / BTP)
    expect(status).toBe(500)
    expect(fiche(ID_ARTISAN).kyc_status).toBe('pending')
    expect(fetchEmail).not.toHaveBeenCalled()
  })

  it('société inscrite en portugais : chemin d’avant (Portugal hors de ce lot)', async () => {
    fiche(ID_SOCIETE).language = 'pt'

    const { status } = await decider({ artisan_id: ID_SOCIETE, action: 'approve' })

    expect(status).toBe(500)
    expect(fiche(ID_SOCIETE).kyc_status).toBe('pending')
  })
})
