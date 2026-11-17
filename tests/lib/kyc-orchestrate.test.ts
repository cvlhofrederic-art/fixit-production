// @vitest-environment node
// runKycPipeline (lib/kyc-orchestrate.ts) : propriété du profil et rejet immédiat
// d'un identifiant au mauvais format, sans appel réseau ; lecture du Kbis et de la pièce d'identité.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  installerFetchIA,
  installerWorkersAI,
  pdfSynthetique,
  poserCles,
  retirerWorkersAI,
  sortieWorkersAI,
} from '../helpers/faux-fournisseurs-ia'
import { logger } from '@/lib/logger'

vi.mock('@/lib/env', async () => (await import('../helpers/faux-fournisseurs-ia')).envAvecWorkersAI())

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

const mocks = vi.hoisted(() => ({
  artisan: null as Record<string, unknown> | null,
  colonnes: '' as string,
  update: vi.fn(),
  updateEq: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: () => ({
      select: (colonnes: string) => {
        mocks.colonnes = colonnes
        return {
          eq: () => ({
            single: async () => (mocks.artisan
              ? { data: mocks.artisan, error: null }
              : { data: null, error: { message: 'not found' } }),
          }),
        }
      },
      update: mocks.update,
    }),
  },
}))

beforeEach(() => {
  mocks.artisan = {
    id: 'profil-1',
    user_id: USER_ID,
    siret: '123',
    company_name: 'PROVENCE PRO',
    kbis_url: null,
    id_document_url: null,
    kyc_market: 'fr_btp',
  }
  mocks.updateEq.mockReset().mockResolvedValue({ error: null })
  mocks.update.mockReset().mockReturnValue({ eq: mocks.updateEq })
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('aucun appel réseau attendu') }))
})

describe('runKycPipeline', () => {
  it('404 quand le profil est introuvable', async () => {
    mocks.artisan = null
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    expect(await runKycPipeline('profil-x', USER_ID)).toEqual({ ok: false, status: 404 })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('403 quand le profil appartient à un autre utilisateur', async () => {
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    expect(await runKycPipeline('profil-1', 'autre-utilisateur')).toEqual({ ok: false, status: 403 })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('ne nomme aucune colonne : un profil sans `country` (prod au 16/10/2026) passe quand même', async () => {
    // mocks.artisan n'a ni country, ni first_name, ni last_name
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    const issue = await runKycPipeline('profil-1', USER_ID)

    expect(mocks.colonnes).toBe('*')
    expect(issue.ok).toBe(true)
  })

  it('sans kyc_market ni country, retombe sur le marché fr_artisan', async () => {
    mocks.artisan = { ...mocks.artisan, kyc_market: null }
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    const issue = await runKycPipeline('profil-1', USER_ID)

    expect(issue.ok && issue.result.market).toBe('fr_artisan')
  })

  it('rejette un SIRET au mauvais format et écrit le résultat dans le profil', async () => {
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    const issue = await runKycPipeline('profil-1', USER_ID)

    expect(issue.ok).toBe(true)
    if (!issue.ok) return
    expect(issue.result.decision).toBe('rejected')
    expect(issue.result.market).toBe('fr_btp')
    expect(issue.result.checks.identifiantFormatValid).toBe(false)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      kyc_status: 'rejected',
      kyc_market: 'fr_btp',
      kyc_score: issue.result.score,
    }))
    expect(mocks.updateEq).toHaveBeenCalledWith('id', 'profil-1')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

// Le modèle de vision de Groq a été retiré le 17/07/2026 : l'OCR échouait, le KYC tombait à un score bas (rejet).
// Les images (Kbis photographié, pièce d'identité) sont lues par Workers AI, avec leur vrai type. Un Kbis en PDF n'est
// pas lu, comme avant ce retrait : sa couche de texte se rédige à la main, l'approbation sur cette seule preuve reste
// à décider.
describe('runKycPipeline — lecture du Kbis et de la pièce d’identité', () => {
  // SIRET fictif, de clé de Luhn valide.
  const SIRET = '12345678900015'
  const URL_KBIS = 'https://stockage.test/kbis'
  const URL_IDENTITE = 'https://stockage.test/identite'
  const KBIS_JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4b, 0x42])
  const PIECE_JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x49, 0x44])
  const TEXTE_KBIS = ['Extrait Kbis', 'Dénomination : MACONNERIE TEST', 'SIRET : 123 456 789 00015', 'Gérant : Jean Test'].join('\n')
  const TEXTE_PIECE = ['CARTE NATIONALE D’IDENTITÉ', 'Nom : TEST', 'Prénom : JEAN', 'Né le 01.01.1980'].join('\n')
  let remettreCles: () => void

  beforeEach(() => {
    remettreCles = poserCles()
    mocks.artisan = { ...mocks.artisan, siret: SIRET, company_name: 'MACONNERIE TEST', kbis_url: URL_KBIS }
  })

  afterEach(() => {
    remettreCles()
    retirerWorkersAI()
    vi.unstubAllGlobals()
  })

  const registre = () => Response.json({ results: [{ etat_administratif: 'A', nom_complet: 'MACONNERIE TEST' }] })
  /** Stockage simulé : registre, Kbis et pièce d'identité ; tout autre appel réseau est une erreur. */
  const stockage = (kbis: Uint8Array<ArrayBuffer>) => (url: string) => {
    if (url === URL_KBIS) return new Response(kbis)
    if (url === URL_IDENTITE) return new Response(PIECE_JPEG)
    // Origine (schéma, hôte, port) lue sur l'adresse analysée : un test sur le début de la chaîne accepterait aussi un autre hôte.
    if (new URL(url).origin === 'https://recherche-entreprises.api.gouv.fr') return registre()
    throw new Error('appel inattendu : ' + url)
  }
  const imageDe = (entrees: Record<string, unknown>) =>
    (entrees.messages as Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>)[0].content
      .find(p => p.type === 'image_url')?.image_url?.url ?? ''
  const estLaPiece = (entrees: Record<string, unknown>) => imageDe(entrees).endsWith(Buffer.from(PIECE_JPEG).toString('base64'))

  it('Kbis photographié : lu par Workers AI (vrai type), identifiant et dénomination retrouvés', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI(TEXTE_KBIS))
    installerFetchIA(stockage(KBIS_JPEG))
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    const issue = await runKycPipeline('profil-1', USER_ID)

    expect(issue.ok).toBe(true)
    if (!issue.ok) return
    expect(issue.result.checks.docOcrSuccess).toBe(true)
    expect(issue.result.checks.identifiantMatchDocVsApi).toBe(true)
    // Le registre a bien été consulté : une erreur d'appel est avalée par le KYC et ne se verrait pas autrement.
    expect(issue.result.checks.identifiantActiveInRegistry).toBe(true)
    expect(workersAI).toHaveLength(1)
    expect(imageDe(workersAI[0].entrees)).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('Kbis en PDF : non lu, comme avant (une couche de texte se rédige à la main), aucun modèle appelé', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
    installerFetchIA(stockage(pdfSynthetique(1, 1, ['Denomination : MACONNERIE TEST', 'SIRET : 123 456 789 00015', 'Greffe du tribunal de commerce'])))
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    const issue = await runKycPipeline('profil-1', USER_ID)

    expect(issue.ok && issue.result.checks.docOcrSuccess).toBe(false)
    expect(issue.ok && issue.result.decision).not.toBe('approved')
    expect(workersAI).toHaveLength(0)
  })

  it('Kbis et pièce d’identité lus EN MÊME TEMPS, nom du gérant rapproché de la pièce', async () => {
    mocks.artisan = { ...mocks.artisan, id_document_url: URL_IDENTITE, first_name: 'Jean', last_name: 'Test' }
    // La première lecture attend que la seconde ait commencé : en série, elle attendrait en vain (2 s), et l'ordre
    // des événements le montrerait.
    let liberer: () => void = () => undefined
    const secondeLancee = new Promise<void>(resoudre => { liberer = resoudre })
    const evenements: string[] = []
    const workersAI = installerWorkersAI(async (_modele, entrees) => {
      const quoi = estLaPiece(entrees) ? 'piece' : 'kbis'
      evenements.push(`debut-${quoi}`)
      if (evenements.length === 1) await Promise.race([secondeLancee, new Promise(r => setTimeout(r, 2_000))])
      else liberer()
      evenements.push(`fin-${quoi}`)
      return sortieWorkersAI(quoi === 'piece' ? TEXTE_PIECE : TEXTE_KBIS)
    })
    installerFetchIA(stockage(KBIS_JPEG))
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    const issue = await runKycPipeline('profil-1', USER_ID)

    expect(workersAI).toHaveLength(2)
    expect(evenements.slice(0, 2).sort()).toEqual(['debut-kbis', 'debut-piece'])
    expect(issue.ok && issue.result.checks.nameMatchDocVsId).toBeGreaterThan(0)
  })

  it('sans nom à comparer : la pièce d’identité n’est ni téléchargée ni envoyée à un modèle', async () => {
    mocks.artisan = { ...mocks.artisan, id_document_url: URL_IDENTITE }
    const workersAI = installerWorkersAI(() => sortieWorkersAI(TEXTE_KBIS))
    const appels = installerFetchIA(stockage(KBIS_JPEG))
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    await runKycPipeline('profil-1', USER_ID)

    expect(appels.some(a => a.url === URL_IDENTITE)).toBe(false)
    expect(workersAI).toHaveLength(1)
    expect(estLaPiece(workersAI[0].entrees)).toBe(false)
  })

  it('format illisible (HEIC) : aucun appel de modèle, OCR non réussi, rien ne casse', async () => {
    const heic = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])
    const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
    installerFetchIA(stockage(heic))
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    const issue = await runKycPipeline('profil-1', USER_ID)

    expect(issue.ok && issue.result.checks.docOcrSuccess).toBe(false)
    expect(workersAI).toHaveLength(0)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('format de document non pris en charge'))
  })
})
