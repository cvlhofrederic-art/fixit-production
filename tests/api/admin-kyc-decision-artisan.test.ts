// @vitest-environment node
// tests/api/admin-kyc-decision-artisan.test.ts — décision KYC du panneau d'administration (PATCH /api/admin/kyc) sur
// le dossier d'un artisan.
//
// Défaut corrigé : la décision était écrite puis relue, dans la même requête, avec first_name et last_name, colonnes
// absentes de profiles_artisan en production (relevé du 17/11/2026 : 90 colonnes, aucune fiche avec kyc_reviewed_by).
// PostgREST refusait la requête entière : rien n'était écrit, la route répondait 500 et aucun e-mail ne partait. Même
// atteint, l'envoi n'était pas attendu et portait un nom vide, que /api/send-kyc-email refuse.
// Faux client (tests/helpers/faux-postgrest.ts) : colonnes de production ; une colonne inconnue, lue, filtrée ou écrite,
// fait échouer la requête entière sans rien écrire. L'e-mail passe par la vraie route /api/send-kyc-email (secret,
// schéma zod ; sans clé Resend, rien ne part réellement).
// Dossiers d'une société BTP (marché fr_btp) : hors de ce correctif (règle artisan / BTP), témoins en fin de fichier.

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { FauxPostgrest } from '../helpers/faux-postgrest'
import { COLONNES_PROFILES_ARTISAN, creerFauxPostgrest } from '../helpers/faux-postgrest'
import { ID_COMPTE, definirListeSuperAdmin, superAdminAutorise } from './super-admin-test-utils'

type Compte = { id: string; user_metadata: Record<string, unknown> }

const h = vi.hoisted(() => {
  // Comptes Supabase Auth (auth.admin.getUserById) : le nom de la personne vit dans user_metadata.full_name
  const comptes = new Map<string, Compte>()
  return {
    user: null as User | null,
    base: null as FauxPostgrest | null,
    comptes,
    getUserById: vi.fn(async (id: string) => {
      const compte = comptes.get(id)
      return compte
        ? { data: { user: compte }, error: null }
        : { data: { user: null }, error: { message: 'User not found', status: 404 } }
    }),
  }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async () => true,
  getClientIP: () => '127.0.0.1',
  rateLimitResponse: () => new Response(null, { status: 429 }),
}))
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.user),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => h.base?.from(table),
    auth: { admin: { getUserById: (id: string) => h.getUserById(id) } },
  },
}))

definirListeSuperAdmin()
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.test')
vi.stubEnv('INTERNAL_API_SECRET', 'secret-de-test')
vi.stubEnv('RESEND_API_KEY', '')
const { PATCH } = await import('@/app/api/admin/kyc/route')
const { POST: routeEmailKyc } = await import('@/app/api/send-kyc-email/route')

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const ID_ARTISAN_FR = '7a1c9e2b-4d3f-4a5b-8c6d-9e0f1a2b3c4d'
const ID_ARTISAN_PT = '1b2c3d4e-5f60-4a71-8b92-a3b4c5d6e7f8'
const ID_FICHE_SANS_COMPTE = '2c3d4e5f-6071-4b82-9ca3-b4c5d6e7f809'
const ID_SOCIETE_BTP_FR = '3f2b8c1e-5d4a-4b6f-9e7d-1a2b3c4d5e6f'
const ID_SOCIETE_BTP_PT = '4d5e6f70-8192-4ca3-8db4-c5d6e7f8091a'

const fetchEmail = vi.fn()

async function decider(corps: Record<string, unknown>) {
  const res = await PATCH(new NextRequest('https://vitfix.test/api/admin/kyc', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer jeton', 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

const base = () => h.base as FauxPostgrest
const fiche = (id: string) => base().tables.profiles_artisan.find((f) => f.id === id) as Record<string, unknown>
const corpsEmail = (n = 0) => JSON.parse(String((fetchEmail.mock.calls[n]?.[1] as RequestInit | undefined)?.body))

beforeEach(() => {
  h.user = superAdminAutorise()
  h.base = creerFauxPostgrest({ profiles_artisan: COLONNES_PROFILES_ARTISAN })
  base().tables.profiles_artisan.push(
    { id: ID_ARTISAN_FR, user_id: 'compte-artisan-fr', email: 'artisan@exemple.fr', company_name: 'Plomberie Exemple', language: 'fr', kyc_market: 'fr_artisan', kyc_status: 'pending' },
    // Inscription antérieure au marché KYC : marché non renseigné, fiche en portugais
    { id: ID_ARTISAN_PT, user_id: 'compte-artisan-pt', email: 'canalizador@exemplo.pt', company_name: 'Canalizações Exemplo', language: 'pt', kyc_market: null, kyc_status: 'pending' },
    // Fiche importée, sans compte ni adresse (755 fiches de ce type en production le 17/11/2026)
    { id: ID_FICHE_SANS_COMPTE, user_id: null, email: null, company_name: 'Telhados Exemplo', language: 'pt', kyc_market: null, kyc_status: 'pending' },
    { id: ID_SOCIETE_BTP_FR, user_id: 'compte-societe-fr', email: 'contact@batiment-exemple.fr', company_name: 'BÂTIMENT EXEMPLE', language: 'fr', kyc_market: 'fr_btp', kyc_status: 'pending' },
    { id: ID_SOCIETE_BTP_PT, user_id: 'compte-societe-pt', email: 'geral@construcoes-exemplo.pt', company_name: 'CONSTRUÇÕES EXEMPLO', language: 'pt', kyc_market: 'fr_btp', kyc_status: 'pending' },
  )
  h.comptes.clear()
  h.comptes.set('compte-artisan-fr', { id: 'compte-artisan-fr', user_metadata: { full_name: 'Jean Exemple' } })
  h.comptes.set('compte-artisan-pt', { id: 'compte-artisan-pt', user_metadata: { full_name: 'Maria Exemplo' } })
  h.comptes.set('compte-societe-fr', { id: 'compte-societe-fr', user_metadata: { full_name: 'Pierre Dirigeant' } })
  h.comptes.set('compte-societe-pt', { id: 'compte-societe-pt', user_metadata: { full_name: 'Rui Gerente' } })
  h.getUserById.mockClear()
  // L'appel interne aboutit à la vraie route d'envoi : un corps qu'elle refuse donne email_envoye: false
  fetchEmail.mockReset().mockImplementation(async (url: string, init: RequestInit) =>
    routeEmailKyc(new NextRequest(url, { method: init.method, headers: init.headers, body: init.body })))
  vi.stubGlobal('fetch', fetchEmail)
})

describe('Décision KYC sur le dossier d’un artisan', () => {
  it('« Approuver » enregistre la décision et prévient l’artisan à son nom', async () => {
    const { status, json } = await decider({ artisan_id: ID_ARTISAN_FR, action: 'approve' })

    expect(status).toBe(200)
    expect(json).toEqual({ success: true, status: 'approved', email_envoye: true })
    expect(fiche(ID_ARTISAN_FR)).toMatchObject({
      kyc_status: 'approved',
      kyc_reviewed_at: expect.any(String),
      // Identifiant du compte de l'administrateur, pas son e-mail : la fiche est lisible par l'artisan
      kyc_reviewed_by: ID_COMPTE,
    })
    expect(fetchEmail).toHaveBeenCalledTimes(1)
    expect(fetchEmail.mock.calls[0][0]).toBe('https://vitfix.test/api/send-kyc-email')
    expect(corpsEmail()).toEqual({
      to: 'artisan@exemple.fr', name: 'Jean Exemple', company: 'Plomberie Exemple', action: 'approve', market: 'fr_artisan',
    })
    // Aucune requête refusée : les colonnes lues et écrites sont toutes celles de la production
    expect(base().requetes.filter((r) => r.erreur)).toEqual([])
    expect(base().requetes.flatMap((r) => r.colonnes ?? [])).not.toContain('first_name')
  })

  it('« Rejeter » enregistre le statut et le motif, et l’e-mail porte le motif', async () => {
    const { status, json } = await decider({ artisan_id: ID_ARTISAN_FR, action: 'reject', rejection_reason: 'Kbis illisible' })

    expect(status).toBe(200)
    expect(json).toEqual({ success: true, status: 'rejected', email_envoye: true })
    expect(fiche(ID_ARTISAN_FR)).toMatchObject({ kyc_status: 'rejected', kyc_rejection_reason: 'Kbis illisible' })
    expect(corpsEmail()).toMatchObject({ action: 'reject', rejection_reason: 'Kbis illisible', name: 'Jean Exemple' })
  })

  it.each([
    ['non renseigné (null)', null],
    ['vide', ''],
    ['fr_artisan', 'fr_artisan'],
    ['pt_artisan', 'pt_artisan'],
  ])('marché KYC %s : dossier d’artisan, décision enregistrée et e-mail parti', async (_libelle, marche) => {
    fiche(ID_ARTISAN_FR).kyc_market = marche

    const { status, json } = await decider({ artisan_id: ID_ARTISAN_FR, action: 'approve' })

    expect(status).toBe(200)
    expect(json.email_envoye).toBe(true)
    expect(fiche(ID_ARTISAN_FR).kyc_status).toBe('approved')
    expect(h.getUserById).toHaveBeenCalledWith('compte-artisan-fr')
  })

  it('fiche en portugais, marché non renseigné : décision enregistrée, e-mail en portugais', async () => {
    const { status, json } = await decider({ artisan_id: ID_ARTISAN_PT, action: 'approve' })

    expect(status).toBe(200)
    expect(json.email_envoye).toBe(true)
    expect(fiche(ID_ARTISAN_PT).kyc_status).toBe('approved')
    expect(corpsEmail()).toEqual({
      to: 'canalizador@exemplo.pt', name: 'Maria Exemplo', company: 'Canalizações Exemplo', action: 'approve', market: 'pt_artisan',
    })
  })

  it('fiche en portugais dont le marché a été réécrit en fr_artisan par le KYC : e-mail en portugais', async () => {
    fiche(ID_ARTISAN_PT).kyc_market = 'fr_artisan'

    await decider({ artisan_id: ID_ARTISAN_PT, action: 'approve' })

    expect(corpsEmail().market).toBe('pt_artisan')
  })

  it('compte sans nom, ou illisible : l’e-mail part au nom de l’entreprise', async () => {
    h.comptes.set('compte-artisan-fr', { id: 'compte-artisan-fr', user_metadata: {} })
    await decider({ artisan_id: ID_ARTISAN_FR, action: 'approve' })
    expect(corpsEmail(0)).toMatchObject({ name: 'Plomberie Exemple', company: 'Plomberie Exemple' })

    h.comptes.delete('compte-artisan-fr')
    const { json } = await decider({ artisan_id: ID_ARTISAN_FR, action: 'approve' })
    expect(json.email_envoye).toBe(true)
    expect(corpsEmail(1)).toMatchObject({ name: 'Plomberie Exemple', company: 'Plomberie Exemple' })
  })

  it('entreprise vide : l’e-mail, accepté par la route d’envoi, porte le nom du compte', async () => {
    fiche(ID_ARTISAN_FR).company_name = '  '

    const { json } = await decider({ artisan_id: ID_ARTISAN_FR, action: 'approve' })

    expect(json.email_envoye).toBe(true)
    expect(corpsEmail()).toMatchObject({ name: 'Jean Exemple', company: 'Jean Exemple' })
  })

  it('fiche sans adresse (fiche importée, sans compte) : décision enregistrée, aucun e-mail', async () => {
    const { status, json } = await decider({ artisan_id: ID_FICHE_SANS_COMPTE, action: 'approve' })

    expect(status).toBe(200)
    expect(json).toEqual({ success: true, status: 'approved', email_envoye: false })
    expect(fiche(ID_FICHE_SANS_COMPTE).kyc_status).toBe('approved')
    expect(fetchEmail).not.toHaveBeenCalled()
    expect(h.getUserById).not.toHaveBeenCalled()
  })

  it('e-mail refusé : la décision reste enregistrée et la réponse le signale', async () => {
    fetchEmail.mockResolvedValue(new Response(JSON.stringify({ error: 'Données invalides' }), { status: 400 }))

    const { status, json } = await decider({ artisan_id: ID_ARTISAN_FR, action: 'approve' })

    expect(status).toBe(200)
    expect(json).toEqual({ success: true, status: 'approved', email_envoye: false })
    expect(fiche(ID_ARTISAN_FR).kyc_status).toBe('approved')
  })

  it('envoi coupé (réseau) : la décision reste enregistrée et la réponse le signale', async () => {
    fetchEmail.mockRejectedValue(new TypeError('fetch failed'))

    const { status, json } = await decider({ artisan_id: ID_ARTISAN_FR, action: 'approve' })

    expect(status).toBe(200)
    expect(json.email_envoye).toBe(false)
    expect(fiche(ID_ARTISAN_FR).kyc_status).toBe('approved')
  })

  it('dossier illisible : 500, rien n’est écrit ni envoyé', async () => {
    base().pannes.select = { code: '57014', message: 'canceling statement due to statement timeout' }

    const { status } = await decider({ artisan_id: ID_ARTISAN_FR, action: 'approve' })

    expect(status).toBe(500)
    expect(fiche(ID_ARTISAN_FR).kyc_status).toBe('pending')
    expect(base().requetes.filter((r) => r.operation === 'update')).toEqual([])
    expect(fetchEmail).not.toHaveBeenCalled()
  })

  it('écriture refusée : 500, aucun e-mail', async () => {
    base().pannes.update = { code: '57014', message: 'canceling statement due to statement timeout' }

    const { status } = await decider({ artisan_id: ID_ARTISAN_FR, action: 'approve' })

    expect(status).toBe(500)
    expect(fiche(ID_ARTISAN_FR).kyc_status).toBe('pending')
    expect(fetchEmail).not.toHaveBeenCalled()
  })
})

describe('Dossier d’une société BTP (marché fr_btp) : hors de ce correctif (témoins)', () => {
  it('société BTP française : pas traitée comme un dossier d’artisan (compte non lu, aucun e-mail au nom du dirigeant)', async () => {
    await decider({ artisan_id: ID_SOCIETE_BTP_FR, action: 'approve' })

    expect(h.getUserById).not.toHaveBeenCalled()
    for (let n = 0; n < fetchEmail.mock.calls.length; n++) expect(corpsEmail(n).name).not.toBe('Pierre Dirigeant')
  })

  it('société BTP inscrite en portugais : chemin d’avant, inchangé (Portugal BTP exclu)', async () => {
    const { status } = await decider({ artisan_id: ID_SOCIETE_BTP_PT, action: 'approve' })

    expect(status).toBe(500)
    expect(fiche(ID_SOCIETE_BTP_PT).kyc_status).toBe('pending')
    expect(fetchEmail).not.toHaveBeenCalled()
    expect(h.getUserById).not.toHaveBeenCalled()
  })

  it('marché KYC inconnu (par exemple un futur marché BTP) : chemin d’avant, pas celui de l’artisan', async () => {
    fiche(ID_ARTISAN_FR).kyc_market = 'pt_btp'

    const { status } = await decider({ artisan_id: ID_ARTISAN_FR, action: 'approve' })

    expect(status).toBe(500)
    expect(fiche(ID_ARTISAN_FR).kyc_status).toBe('pending')
    expect(h.getUserById).not.toHaveBeenCalled()
  })
})
