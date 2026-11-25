// @vitest-environment node
// tests/api/erreurs-journal-serveur.test.ts
//
// Quatre routes écrivaient leurs erreurs internes par console.error, en dehors du journal du projet
// (lib/logger.ts, une ligne JSON horodatée par événement, comme les autres routes) :
//   - POST /api/doc-number (numéro du prochain devis, de la prochaine facture) ;
//   - POST /api/tva/check, GET et PATCH /api/tva/settings (seuil et réglages de TVA de l'écran Comptabilité) ;
//   - GET et POST /api/declaration-sociale (déclaration des cotisations).
// Le détail part désormais dans ce journal ; la réponse au navigateur reste le message générique d'avant.
// Aucune donnée réelle : compte et message d'erreur d'exemple.

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const compte = '11111111-1111-4111-8111-111111111111'
  const erreur = new Error('exemple : connexion à la base interrompue')
  // Base d'exemple en panne : l'authentification répond, toute lecture ou écriture échoue.
  const client = {
    from: () => { throw erreur },
    rpc: async () => ({ data: null, error: { message: erreur.message } }),
    auth: { getUser: async () => ({ data: { user: { id: compte } }, error: null }) },
  }
  return { compte, erreur, client, journal: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }
})

vi.mock('@supabase/supabase-js', () => ({ createClient: () => h.client }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => h.client }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: h.client }))
vi.mock('@/lib/supabase-server-component', () => ({ createServerSupabaseClient: async () => h.client }))
// Simulation PARTIELLE du module, héritée du vrai : depuis le 25/11/2026 les routes des documents résolvent
// aussi le périmètre de la société (lib/btp/perimetre-compte), qui importe getUserRole, isProGerant,
// societeDunAutreCompte et resolveCompanyId du même fichier. Les omettre les ferait disparaître du module simulé.
// Pour un compte artisan comme pour un gérant, lirePerimetreBtp sort sans toucher la base.
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: async () => ({ id: h.compte }),
}))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', () => ({ logger: h.journal }))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://base.exemple.test'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'cle-publique-de-test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-serveur-de-test'

const { POST: numeroDocument } = await import('@/app/api/doc-number/route')
const { POST: verifierSeuilTva } = await import('@/app/api/tva/check/route')
const { GET: lireReglagesTva, PATCH: modifierReglagesTva } = await import('@/app/api/tva/settings/route')
const { GET: lireDeclaration, POST: enregistrerDeclaration } = await import('@/app/api/declaration-sociale/route')

const requete = (url: string, methode = 'GET', corps?: unknown) => new NextRequest(url, {
  method: methode,
  headers: { Authorization: 'Bearer jeton-exemple', 'Content-Type': 'application/json' },
  ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
})

let consoleError: MockInstance<typeof console.error>

beforeEach(() => {
  h.journal.error.mockClear()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleError.mockRestore()
})

/** Réponse générique inchangée ; détail dans le journal du projet, plus rien d'écrit directement dans la console. */
async function verifier(res: Response, messageGenerique: string, etiquette: string, detail: unknown) {
  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ error: messageGenerique })
  expect(h.journal.error).toHaveBeenCalledTimes(1)
  expect(h.journal.error).toHaveBeenCalledWith(etiquette, detail)
  expect(consoleError).not.toHaveBeenCalled()
}

describe('erreurs internes : journal du projet, réponse au navigateur inchangée', () => {
  it('POST /api/doc-number : échec de la numérotation', async () => {
    const res = await numeroDocument(requete('https://vitfix.io/api/doc-number', 'POST', { docType: 'devis' }))
    await verifier(res, 'Erreur de génération du numéro', '[doc-number] RPC error:', { error: h.erreur.message })
  })

  it('POST /api/tva/check : échec de la lecture de la fiche', async () => {
    const res = await verifierSeuilTva(requete('https://vitfix.io/api/tva/check', 'POST', { ca_ht: 30000, country: 'FR' }))
    await verifier(res, 'Internal error', '[TVA CHECK]', h.erreur)
  })

  it('GET /api/tva/settings : échec de la lecture des réglages', async () => {
    const res = await lireReglagesTva(requete('https://vitfix.io/api/tva/settings'))
    await verifier(res, 'Internal error', '[TVA SETTINGS GET]', h.erreur)
  })

  it('PATCH /api/tva/settings : échec de l’enregistrement des réglages', async () => {
    const res = await modifierReglagesTva(requete('https://vitfix.io/api/tva/settings', 'PATCH', { tva_auto_activate: true }))
    await verifier(res, 'Internal error', '[TVA SETTINGS PATCH]', h.erreur)
  })

  it('GET /api/declaration-sociale : échec de la lecture de la fiche', async () => {
    const res = await lireDeclaration(requete('https://vitfix.io/api/declaration-sociale'))
    await verifier(res, 'Erreur serveur', '[declaration-sociale] GET error:', h.erreur)
  })

  it('POST /api/declaration-sociale : échec de la lecture de la fiche', async () => {
    const res = await enregistrerDeclaration(requete('https://vitfix.io/api/declaration-sociale', 'POST', { action: 'configurer' }))
    await verifier(res, 'Erreur serveur', '[declaration-sociale] POST error:', h.erreur)
  })
})
