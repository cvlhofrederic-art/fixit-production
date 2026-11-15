// @vitest-environment node
// lib/storage/liens-stockage.ts : la base garde le chemin d'un fichier, le lien signé se crée à la lecture.
// - cheminStockage retrouve le chemin dans toute valeur déjà enregistrée : chemin nu, lien signé (valable ou
//   expiré), lien signé dont le jeton a été retiré, lien public ; rien pour un autre site ou un autre seau.
// - signerValeurs ne signe qu'un chemin contrôlé (pas de traversée, dossier du titulaire quand il est demandé),
//   en une seule requête au stockage, et rend null pour le reste.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const PROJET = 'https://projet-test.supabase.co'
const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const AUTRE_ID = 'ffffffff-0000-4000-8000-000000000001'
const CHEMIN = `${USER_ID}/kbis/0f8fad5b-d9cb-469f-a165-70867728950e.pdf`

const mocks = vi.hoisted(() => ({
  createSignedUrls: vi.fn(),
  warn: vi.fn(),
  seaux: [] as string[],
}))

vi.mock('@/lib/logger', () => ({ logger: { warn: mocks.warn, error: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    storage: {
      from: (seau: string) => {
        mocks.seaux.push(seau)
        return { createSignedUrls: mocks.createSignedUrls }
      },
    },
  },
}))

import { cheminStockage, signerValeurs } from '@/lib/storage/liens-stockage'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', PROJET)
  mocks.warn.mockReset()
  mocks.seaux.length = 0
  mocks.createSignedUrls.mockReset().mockImplementation(async (chemins: string[], duree: number) => ({
    data: chemins.map((path) => ({ path, error: null, signedUrl: `${PROJET}/storage/v1/object/sign/artisan-documents/${path}?token=frais-${duree}` })),
    error: null,
  }))
})

describe('cheminStockage — ancienne ou nouvelle valeur', () => {
  it.each([
    ['chemin nu (nouvelles lignes)', CHEMIN],
    ['lien signé', `${PROJET}/storage/v1/object/sign/artisan-documents/${CHEMIN}?token=eyJhbGciOi.exp`],
    ['lien signé dont le jeton a été retiré', `${PROJET}/storage/v1/object/sign/artisan-documents/${CHEMIN}`],
    ['lien public', `${PROJET}/storage/v1/object/public/artisan-documents/${CHEMIN}`],
    ['lien authentifié', `${PROJET}/storage/v1/object/authenticated/artisan-documents/${CHEMIN}`],
    ['lien de miniature signé', `${PROJET}/storage/v1/render/image/sign/artisan-documents/${CHEMIN}?token=x&width=200`],
  ])('%s → chemin', (_cas, valeur) => {
    expect(cheminStockage(valeur, 'artisan-documents')).toBe(CHEMIN)
  })

  it('décode un ancien nom encodé dans le lien (espaces, accents)', () => {
    const valeur = `${PROJET}/storage/v1/object/sign/artisan-documents/wallet/fiche-1/rc_pro/Attestation%20d%C3%A9cennale.pdf?token=x`
    expect(cheminStockage(valeur, 'artisan-documents')).toBe('wallet/fiche-1/rc_pro/Attestation décennale.pdf')
  })

  it.each([
    ['vide', ''],
    ['espaces', '   '],
    ['nul', null],
    ['nombre', 42],
    ['autre site', `https://exemple.org/storage/v1/object/sign/artisan-documents/${CHEMIN}?token=x`],
    ['http', `http://projet-test.supabase.co/storage/v1/object/sign/artisan-documents/${CHEMIN}`],
    ['autre seau', `${PROJET}/storage/v1/object/public/profile-photos/${CHEMIN}`],
    ['URL du projet hors stockage', `${PROJET}/rest/v1/profiles_artisan`],
    ['schéma javascript', 'javascript:alert(1)'],
    ['schéma data', 'data:image/png;base64,AAAA'],
    ['remontée normalisée vers un autre seau', `${PROJET}/storage/v1/object/sign/artisan-documents/../profile-photos/x.png`],
  ])('%s → null', (_cas, valeur) => {
    expect(cheminStockage(valeur, 'artisan-documents')).toBeNull()
  })

  it('aucune URL reconnue quand l’adresse du projet manque (jamais de contrôle sauté)', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(cheminStockage(`${PROJET}/storage/v1/object/sign/artisan-documents/${CHEMIN}?token=x`, 'artisan-documents')).toBeNull()
    expect(cheminStockage(CHEMIN, 'artisan-documents')).toBe(CHEMIN)
  })
})

describe('signerValeurs', () => {
  it('signe un chemin nu et un lien expiré en une seule requête, dans l’ordre reçu', async () => {
    const autre = `${USER_ID}/identity-verso/1b4e28ba-2fa1-11d2-883f-0016d3cca427.png`
    const liens = await signerValeurs('artisan-documents', [
      CHEMIN,
      null,
      `${PROJET}/storage/v1/object/sign/artisan-documents/${autre}?token=perime`,
    ], { dossiers: [`${USER_ID}/`], dureeS: 600, origine: '[test]' })

    expect(liens).toEqual([
      `${PROJET}/storage/v1/object/sign/artisan-documents/${CHEMIN}?token=frais-600`,
      null,
      `${PROJET}/storage/v1/object/sign/artisan-documents/${autre}?token=frais-600`,
    ])
    expect(mocks.createSignedUrls).toHaveBeenCalledTimes(1)
    expect(mocks.createSignedUrls).toHaveBeenCalledWith([CHEMIN, autre], 600)
    expect(mocks.seaux).toEqual(['artisan-documents'])
  })

  it('refuse un chemin hors du dossier du titulaire, sans le signer', async () => {
    const liens = await signerValeurs('artisan-documents', [`${AUTRE_ID}/kbis/x.pdf`], {
      dossiers: [`${USER_ID}/`], dureeS: 600, origine: '[test]',
    })
    expect(liens).toEqual([null])
    expect(mocks.createSignedUrls).not.toHaveBeenCalled()
    expect(mocks.warn).toHaveBeenCalledWith('[test] chemin de stockage refusé', { raison: 'Hors du dossier autorisé' })
  })

  it('refuse une traversée même pour l’administration (tout le seau)', async () => {
    const liens = await signerValeurs('artisan-documents', [`${USER_ID}/../${AUTRE_ID}/kbis/x.pdf`, CHEMIN], {
      dossiers: 'tout-le-seau', dureeS: 3600, origine: '[test]',
    })
    expect(liens[0]).toBeNull()
    expect(liens[1]).toMatch(/token=frais-3600$/)
    expect(mocks.createSignedUrls).toHaveBeenCalledWith([CHEMIN], 3600)
  })

  it('échec du stockage : aucun lien, échec journalisé', async () => {
    mocks.createSignedUrls.mockResolvedValueOnce({ data: null, error: { message: 'storage down' } })
    const liens = await signerValeurs('artisan-documents', [CHEMIN], { dossiers: 'tout-le-seau', dureeS: 60, origine: '[test]' })
    expect(liens).toEqual([null])
    expect(mocks.warn).toHaveBeenCalledWith('[test] signature des liens en échec', { message: 'storage down' })
  })

  it('fichier absent du seau : null pour lui seul', async () => {
    const autre = `${USER_ID}/kbis/absent.pdf`
    mocks.createSignedUrls.mockResolvedValueOnce({
      data: [
        { path: CHEMIN, error: null, signedUrl: 'https://lien-frais' },
        { path: autre, error: 'Either the object does not exist or you do not have access to it', signedUrl: null },
      ],
      error: null,
    })
    const liens = await signerValeurs('artisan-documents', [CHEMIN, autre], { dossiers: 'tout-le-seau', dureeS: 60, origine: '[test]' })
    expect(liens).toEqual(['https://lien-frais', null])
    expect(mocks.warn).toHaveBeenCalledWith('[test] liens non signés', { nombre: 1 })
  })

  it('rien à signer : aucune requête au stockage', async () => {
    expect(await signerValeurs('artisan-documents', [null, '', 'https://exemple.org/x.pdf'], {
      dossiers: 'tout-le-seau', dureeS: 60, origine: '[test]',
    })).toEqual([null, null, null])
    expect(mocks.createSignedUrls).not.toHaveBeenCalled()
  })
})
