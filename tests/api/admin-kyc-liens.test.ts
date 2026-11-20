// GET /api/admin/kyc — liens des pièces (Kbis, pièce d'identité) dans le panneau d'administration.
// La fiche garde le chemin du fichier (seau privé) ; la route crée pour l'administrateur un lien frais à chaque
// lecture. Une ancienne valeur (lien signé expiré, ou dont le jeton a été retiré) se rouvre de la même façon,
// sans que la fiche soit réécrite.
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { definirListeSuperAdmin, superAdminAutorise } from './super-admin-test-utils'

const PROJET = 'https://projet-test.supabase.co'
const USER_A = '550e8400-e29b-41d4-a716-446655440000'
const USER_B = 'ffffffff-0000-4000-8000-000000000001'
const KBIS_A = `${USER_A}/kbis/0f8fad5b-d9cb-469f-a165-70867728950e.pdf`
const VERSO_A = `${USER_A}/identity-verso/1b4e28ba-2fa1-11d2-883f-0016d3cca427.png`
const KBIS_B = `${USER_B}/kbis/6ba7b810-9dad-11d1-80b4-00c04fd430c8.pdf`
const lienFrais = (chemin: string) => `${PROJET}/storage/v1/object/sign/artisan-documents/${chemin}?token=frais`

const h = vi.hoisted(() => ({
  user: null as User | null,
  lignes: [] as Array<Record<string, unknown>>,
  createSignedUrls: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.user),
}))
vi.mock('@/lib/supabase-server', () => {
  const chaine: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order']) chaine[m] = () => chaine
  chaine.range = async () => ({ data: h.lignes, error: null, count: h.lignes.length })
  chaine.update = h.update
  return {
    supabaseAdmin: {
      from: () => chaine,
      storage: { from: () => ({ createSignedUrls: h.createSignedUrls }) },
    },
  }
})

definirListeSuperAdmin()
const { GET } = await import('@/app/api/admin/kyc/route')

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', PROJET)
  h.user = superAdminAutorise()
  h.update.mockReset()
  h.createSignedUrls.mockReset().mockImplementation(async (chemins: string[]) => ({
    data: chemins.map((path) => ({ path, error: null, signedUrl: lienFrais(path) })),
    error: null,
  }))
  h.lignes = [
    { id: 'fiche-a', user_id: USER_A, kyc_status: 'pending', kbis_url: KBIS_A, id_document_verso_url: VERSO_A },
    {
      id: 'fiche-b',
      user_id: USER_B,
      kyc_status: 'pending',
      // Ancien lien signé dont le jeton a été retiré.
      kbis_url: `${PROJET}/storage/v1/object/sign/artisan-documents/${KBIS_B}`,
      id_document_url: null,
    },
  ]
})

async function lire() {
  const res = await GET(new NextRequest('http://localhost:3000/api/admin/kyc?status=pending', { headers: { Authorization: 'Bearer jeton' } }))
  expect(res.status).toBe(200)
  return (await res.json()) as { data: Array<Record<string, unknown>> }
}

describe('GET /api/admin/kyc — liens des pièces signés à la lecture', () => {
  it('rend un lien frais pour un chemin enregistré et pour un ancien lien sans jeton', async () => {
    const { data } = await lire()

    expect(data[0].kbis_url).toBe(lienFrais(KBIS_A))
    expect(data[0].id_document_verso_url).toBe(lienFrais(VERSO_A))
    expect(data[1].kbis_url).toBe(lienFrais(KBIS_B))
    expect(data[1].id_document_url).toBeNull()
    // Une seule requête au stockage pour toute la page, aucune écriture dans les fiches.
    expect(h.createSignedUrls).toHaveBeenCalledTimes(1)
    expect(h.update).not.toHaveBeenCalled()
  })

  it('stockage indisponible : la valeur enregistrée est rendue telle quelle (comme avant)', async () => {
    h.createSignedUrls.mockResolvedValueOnce({ data: null, error: { message: 'storage down' } })

    const { data } = await lire()

    expect(data[0].kbis_url).toBe(KBIS_A)
    expect(data[1].kbis_url).toBe(`${PROJET}/storage/v1/object/sign/artisan-documents/${KBIS_B}`)
  })
})
