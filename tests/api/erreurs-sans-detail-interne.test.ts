// @vitest-environment node
// tests/api/erreurs-sans-detail-interne.test.ts
//
// Deux routes renvoyaient au navigateur le texte brut d'une erreur interne :
//   - POST /api/facturx/generate (export Factur-X) : champ « details » avec l'erreur du serveur ;
//   - POST /api/artisan-payment-info (informations de paiement des réglages) : message de la base de données.
// Le navigateur reçoit désormais un message générique ; le détail part dans le journal du serveur.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const COMPTE = '11111111-1111-4111-8111-111111111111'
const DETAIL_INTERNE = 'column "paiement_modes" of relation "profiles_artisan" does not exist'

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  user: null as null | { id: string },
  journal: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  genererXml: vi.fn((): string => '<xml/>'),
}))

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.user) }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', () => ({ logger: h.journal }))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => clientMemoire(h.base).from(t) } }))
vi.mock('@/lib/facturx-mapper', () => ({ generateFacturXML: h.genererXml }))
vi.mock('@/lib/facturx', () => ({ embedFacturX: vi.fn(async (pdf: Uint8Array) => pdf) }))

const { POST: enregistrerPaiement } = await import('@/app/api/artisan-payment-info/route')
const { POST: genererFacturX } = await import('@/app/api/facturx/generate/route')

const poster = (url: string, corps: unknown) => new NextRequest(url, {
  method: 'POST',
  headers: { Authorization: 'Bearer jeton', 'Content-Type': 'application/json' },
  body: JSON.stringify(corps),
})

beforeEach(() => {
  h.base = nouvelleBase()
  h.user = { id: COMPTE }
  h.journal.error.mockClear()
  h.genererXml.mockReset()
  h.genererXml.mockReturnValue('<xml/>')
  h.base.lignes.profiles_artisan = [{ id: 'fiche-1', user_id: COMPTE }]
})

describe('POST /api/artisan-payment-info — échec de l’enregistrement', () => {
  const modes = { paiement_modes: [{ type: 'virement', iban: '', bic: '', titulaire: '', actif: false }] }

  it('le message de la base n’est pas renvoyé au navigateur ; il est journalisé', async () => {
    h.base.erreurs['profiles_artisan.update'] = { message: DETAIL_INTERNE }
    const res = await enregistrerPaiement(poster('https://vitfix.io/api/artisan-payment-info', modes))
    expect(res.status).toBe(500)
    const corps = await res.json() as { error: string }
    expect(corps.error).toBe('Enregistrement impossible pour le moment. Réessayez dans quelques instants.')
    expect(JSON.stringify(corps)).not.toContain('profiles_artisan')
    expect(JSON.stringify(corps)).not.toContain('does not exist')
    expect(h.journal.error).toHaveBeenCalledWith('savePaymentInfo error:', expect.objectContaining({ message: DETAIL_INTERNE }))
  })

  it('enregistrement réussi : inchangé', async () => {
    const res = await enregistrerPaiement(poster('https://vitfix.io/api/artisan-payment-info', modes))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })
})

describe('POST /api/facturx/generate — échec de la génération', () => {
  const facture = {
    data: {
      docType: 'facture', docNumber: 'FACT-2026-001', companyName: 'Entreprise Exemple', companySiret: '00000000000000',
      companyAddress: '1 rue Exemple, 13000 Marseille', tvaEnabled: true, clientName: 'Marie Exemple',
      clientAddress: '2 rue Exemple, 13000 Marseille', docDate: '2026-11-14',
      lines: [{ id: 1, description: 'Pose', qty: 1, unit: 'u', priceHT: 100, tvaRate: 20, totalHT: 100 }],
    },
    pdfBase64: 'JVBERi0=',
  }

  it('l’erreur interne n’est pas renvoyée au navigateur (plus de champ « details ») ; elle est journalisée', async () => {
    const erreur = new Error('ENOENT: /srv/app/polices/introuvable.ttf')
    h.genererXml.mockImplementation(() => { throw erreur })
    const res = await genererFacturX(poster('https://vitfix.io/api/facturx/generate', facture))
    expect(res.status).toBe(500)
    const corps = await res.json() as Record<string, unknown>
    expect(corps).toEqual({ error: 'Erreur lors de la génération Factur-X' })
    expect(JSON.stringify(corps)).not.toContain('ENOENT')
    expect(h.journal.error).toHaveBeenCalledTimes(1)
    expect(h.journal.error.mock.calls[0]).toContain(erreur)
  })

  it('données invalides : le détail de validation (champs à corriger) reste renvoyé', async () => {
    const res = await genererFacturX(poster('https://vitfix.io/api/facturx/generate', { data: { docType: 'facture' } }))
    expect(res.status).toBe(400)
    const corps = await res.json() as { error: string; details?: unknown }
    expect(corps.error).toBe('Données invalides')
    expect(corps.details).toBeDefined()
  })

  it('génération réussie : le PDF est renvoyé comme avant', async () => {
    const res = await genererFacturX(poster('https://vitfix.io/api/facturx/generate', facture))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('X-Facturx-Profile')).toBe('BASIC')
  })
})
