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

// ---------------------------------------------------------------------------
// Marchés et registres (22/11/2026) : réseau simulé commun aux deux blocs suivants.
// ---------------------------------------------------------------------------

// NIF / NIPC fictif, de chiffre de contrôle valide (modulo 11).
const NIF = '512345678'
const URL_PIECE = 'https://stockage.test/piece'
const IMAGE = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])

type Simulation = { piece?: Uint8Array<ArrayBuffer>; vies?: () => Response | Promise<Response> }

/**
 * Pièce stockée et registres : français (actif), nif.pt (réponse réelle à la clé « demo » le 22/11/2026), VIES (seulement
 * quand le test le simule).
 */
const reseau = ({ piece = IMAGE, vies }: Simulation) => (url: string) => {
  if (url === URL_PIECE) return new Response(piece)
  const origine = new URL(url).origin
  if (origine === 'https://recherche-entreprises.api.gouv.fr') {
    return Response.json({ results: [{ etat_administratif: 'A', nom_complet: 'MACONNERIE TEST' }] })
  }
  if (origine === 'https://www.nif.pt') return Response.json({ result: 'error', message: 'Key not valid' })
  if (origine === 'https://ec.europa.eu' && vies) return vies()
  throw new Error('appel inattendu : ' + url)
}

/** Lance le KYC de la fiche (pièce lue par le faux Workers AI, qui rend `texteDocument`) et rend ce qu'il a écrit et appelé. */
async function lancerAvec(fiche: Record<string, unknown>, texteDocument: string, simulation: Simulation = {}) {
  mocks.artisan = { id: 'profil-1', user_id: USER_ID, kbis_url: URL_PIECE, id_document_url: null, ...fiche }
  const lectures = installerWorkersAI(() => sortieWorkersAI(texteDocument))
  const appels = installerFetchIA(reseau(simulation))
  const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
  const issue = await runKycPipeline('profil-1', USER_ID)
  return { issue, ecrit: mocks.update.mock.calls[0]?.[0], appels, lectures, origines: appels.map((a) => new URL(a.url).origin) }
}

/** Clés factices posées avant chaque test du bloc, fournisseurs simulés retirés après. */
function preparerFournisseurs() {
  let remettreCles: () => void = () => undefined
  beforeEach(() => {
    remettreCles = poserCles()
  })
  afterEach(() => {
    remettreCles()
    retirerWorkersAI()
    vi.unstubAllGlobals()
  })
}

// Garde d'invariance (marché pt_btp ajouté le 22/11/2026) : ce que le KYC des marchés existants écrit dans la fiche et
// rend, relevé en instantané sur le code d'avant (main 09bf286a). Registres et lecture du document simulés.
describe('runKycPipeline — marchés existants inchangés par le marché pt_btp', () => {
  preparerFournisseurs()

  it('société française (fr_btp) : Kbis lu, registre français, écriture et résultat d’avant', async () => {
    const { issue, ecrit } = await lancerAvec(
      { siret: '12345678900015', company_name: 'MACONNERIE TEST', kyc_market: 'fr_btp' },
      ['Extrait Kbis', 'Dénomination : MACONNERIE TEST', 'SIRET : 123 456 789 00015', 'Gérant : Jean Test'].join('\n'),
    )

    expect({ issue, ecrit }).toMatchInlineSnapshot({ ecrit: { kyc_verified_at: expect.any(String) } }, `
      {
        "ecrit": {
          "kbis_extracted": {
            "confidence": "50",
            "denomination": "MACONNERIE TEST",
            "identifiant": "12345678900015",
            "representant": "Jean Test",
          },
          "kyc_checks": {
            "addressMatchDocVsApi": false,
            "docOcrSuccess": true,
            "identifiantActiveInRegistry": true,
            "identifiantFormatValid": true,
            "identifiantMatchDocVsApi": true,
            "nameMatchDocVsApi": 100,
            "nameMatchDocVsId": 0,
          },
          "kyc_market": "fr_btp",
          "kyc_score": 85,
          "kyc_status": "approved",
          "kyc_verified_at": Any<String>,
        },
        "issue": {
          "ok": true,
          "result": {
            "checks": {
              "addressMatchDocVsApi": false,
              "docOcrSuccess": true,
              "identifiantActiveInRegistry": true,
              "identifiantFormatValid": true,
              "identifiantMatchDocVsApi": true,
              "nameMatchDocVsApi": 100,
              "nameMatchDocVsId": 0,
            },
            "decision": "approved",
            "details": [
              "SIRET valide (format et clé de Luhn)",
              "Entreprise active dans le registre INSEE/Sirene",
              "KBIS analysé avec succès par OCR",
              "SIRET identique entre KBIS et registre",
              "Correspondance dénomination KBIS/registre : 100%",
              "Correspondance représentant KBIS/CNI : 0%",
              "Score KYC : 85/100 — approuvé",
            ],
            "market": "fr_btp",
            "score": 85,
          },
        },
      }
    `)
  })

  it('société inscrite en fr_btp avec un NIPC (cas du 17/11/2026) : toujours rejetée d’office sur ce marché', async () => {
    const { issue, ecrit, origines } = await lancerAvec(
      { siret: NIF, company_name: 'CONSTRUÇÕES EXEMPLO, LDA', kyc_market: 'fr_btp' },
      'ne doit pas servir',
    )

    expect(origines).toEqual([])
    expect({ issue, ecrit }).toMatchInlineSnapshot({ ecrit: { kyc_verified_at: expect.any(String) } }, `
      {
        "ecrit": {
          "kyc_checks": {
            "addressMatchDocVsApi": false,
            "docOcrSuccess": false,
            "identifiantActiveInRegistry": false,
            "identifiantFormatValid": false,
            "identifiantMatchDocVsApi": false,
            "nameMatchDocVsApi": 0,
            "nameMatchDocVsId": 0,
          },
          "kyc_market": "fr_btp",
          "kyc_score": 0,
          "kyc_status": "rejected",
          "kyc_verified_at": Any<String>,
        },
        "issue": {
          "ok": true,
          "result": {
            "checks": {
              "addressMatchDocVsApi": false,
              "docOcrSuccess": false,
              "identifiantActiveInRegistry": false,
              "identifiantFormatValid": false,
              "identifiantMatchDocVsApi": false,
              "nameMatchDocVsApi": 0,
              "nameMatchDocVsId": 0,
            },
            "decision": "rejected",
            "details": [
              "SIRET invalide (format ou clé de contrôle)",
              "Entreprise non trouvée ou radiée dans le registre INSEE/Sirene",
              "OCR du KBIS partiel ou échoué — révision manuelle recommandée",
              "SIRET extrait du KBIS ne correspond pas au registre",
              "Correspondance dénomination KBIS/registre : 0%",
              "Correspondance représentant KBIS/CNI : 0%",
              "Score KYC : 0/100 — rejeté",
            ],
            "market": "fr_btp",
            "score": 0,
          },
        },
      }
    `)
  })

  it('artisan portugais (pt_artisan) : nif.pt consulté, Certidão lue, écriture et résultat d’avant', async () => {
    const { issue, ecrit, origines } = await lancerAvec(
      { siret: NIF, company_name: 'Canalizações Exemplo', kyc_market: 'pt_artisan' },
      ['Certidão Permanente', `NIPC: ${NIF}`, 'Firma: Canalizações Exemplo', 'Gerente: Rui Exemplo'].join('\n'),
    )

    expect(origines).toContain('https://www.nif.pt')
    expect(origines).not.toContain('https://ec.europa.eu')
    expect({ issue, ecrit }).toMatchInlineSnapshot({ ecrit: { kyc_verified_at: expect.any(String) } }, `
      {
        "ecrit": {
          "certidao_extracted": {
            "confidence": "50",
            "denomination": "Canalizações Exemplo",
            "identifiant": "512345678",
            "representant": "Rui Exemplo",
          },
          "kyc_checks": {
            "addressMatchDocVsApi": false,
            "docOcrSuccess": true,
            "identifiantActiveInRegistry": false,
            "identifiantFormatValid": true,
            "identifiantMatchDocVsApi": true,
            "nameMatchDocVsApi": 100,
            "nameMatchDocVsId": 0,
          },
          "kyc_market": "pt_artisan",
          "kyc_score": 65,
          "kyc_status": "pending",
          "kyc_verified_at": Any<String>,
        },
        "issue": {
          "ok": true,
          "result": {
            "checks": {
              "addressMatchDocVsApi": false,
              "docOcrSuccess": true,
              "identifiantActiveInRegistry": false,
              "identifiantFormatValid": true,
              "identifiantMatchDocVsApi": true,
              "nameMatchDocVsApi": 100,
              "nameMatchDocVsId": 0,
            },
            "decision": "manual_review",
            "details": [
              "NIF válido",
              "Empresa não encontrada ou cessada no registo",
              "Certidão Permanente analisada com sucesso por OCR",
              "NIF idêntico entre Certidão e registo",
              "Correspondência denominação Certidão/registo : 100%",
              "Correspondência gerente Certidão/CC : 0%",
              "Score KYC : 65/100 — revisão manual",
            ],
            "market": "pt_artisan",
            "score": 65,
          },
        },
      }
    `)
  })
})

// Société BTP inscrite en portugais (marché pt_btp, 22/11/2026). Avant : marché fr_btp, NIPC de 9 chiffres contrôlé
// comme un SIRET, rejet d'office à 0 sans motif (une société inscrite le 17/11/2026). Désormais : NIPC contrôlé comme
// un NIF, VIES pour registre, certidão permanente lue (image) et rapprochée du NIPC de la matrícula et de la firma.
describe('runKycPipeline — société BTP portugaise (pt_btp)', () => {
  preparerFournisseurs()

  const CERTIDAO = [
    'CERTIDÃO PERMANENTE',
    'Código de acesso: 1234-5678-9012',
    'Válida até: 2027-05-08',
    'NIPC: 512 345 678',
    'Firma: CONSTRUÇÕES EXEMPLO, LDA',
    'Gerente: Rui Exemplo',
  ].join('\n')
  const SOCIETE = { siret: NIF, company_name: 'CONSTRUÇÕES EXEMPLO, LDA', kyc_market: 'pt_btp' }
  const viesActif = () => Response.json({ valid: true, name: 'CONSTRUCOES EXEMPLO LDA', address: 'RUA DO EXEMPLO 1' })
  const certidaoPdf = () => pdfSynthetique(1, 1, ['Certidão Permanente', 'NIPC: 512 345 678'])

  it('NIPC invalide : rejet d’office, score 0, aucun appel réseau, marché pt_btp écrit', async () => {
    const { issue, ecrit, origines } = await lancerAvec({ ...SOCIETE, siret: '512345679' }, CERTIDAO, { vies: viesActif })

    expect(origines).toEqual([])
    expect(issue.ok && issue.result).toMatchObject({ decision: 'rejected', score: 0, market: 'pt_btp' })
    expect(ecrit).toMatchObject({ kyc_status: 'rejected', kyc_score: 0, kyc_market: 'pt_btp' })
  })

  it('certidão photographiée, VIES actif : approuvée ; VIES interrogé (pas nif.pt), certidão rangée à part', async () => {
    const { issue, ecrit, appels, lectures } = await lancerAvec(SOCIETE, CERTIDAO, { vies: viesActif })

    expect(appels.filter((a) => a.url.startsWith('https://ec.europa.eu/')).map((a) => a.corps)).toEqual([
      { countryCode: 'PT', vatNumber: NIF },
    ])
    expect(appels.some((a) => a.url.includes('nif.pt'))).toBe(false)
    // Lecture demandée en portugais
    expect(JSON.stringify(lectures[0].entrees)).toContain('Extrai todo o texto')
    expect(issue.ok && issue.result).toMatchObject({ decision: 'approved', score: 100, market: 'pt_btp' })
    expect(ecrit).toMatchObject({
      kyc_status: 'approved',
      kyc_score: 100,
      kyc_market: 'pt_btp',
      certidao_extracted: {
        identifiant: NIF,
        denomination: 'CONSTRUÇÕES EXEMPLO, LDA',
        representant: 'Rui Exemplo',
        codigo_acesso: '1234-5678-9012',
        valida_ate: '2027-05-08',
      },
    })
    expect(ecrit).not.toHaveProperty('kbis_extracted')
  })

  it('certidão en PDF (non lue), VIES actif : revue manuelle à 40, aucun modèle appelé', async () => {
    const { issue, ecrit, lectures } = await lancerAvec(SOCIETE, 'ne doit pas servir', { vies: viesActif, piece: certidaoPdf() })

    expect(lectures).toHaveLength(0)
    expect(issue.ok && issue.result).toMatchObject({ decision: 'manual_review', score: 40 })
    expect(ecrit).toMatchObject({ kyc_status: 'pending', kyc_score: 40, kyc_market: 'pt_btp' })
    expect(ecrit).not.toHaveProperty('certidao_extracted')
  })

  it.each([
    ['VIES indisponible (503)', () => new Response('Service Unavailable', { status: 503 })],
    ['VIES injoignable (réseau)', (): Response => { throw new TypeError('fetch failed') }],
    ['NIPC inconnu du VIES (société exonérée de TVA)', () => Response.json({ valid: false, name: '', address: '' })],
  ])('%s, certidão en PDF : revue manuelle à 10, jamais un rejet d’office', async (_cas, vies) => {
    const { issue, ecrit } = await lancerAvec(SOCIETE, 'ne doit pas servir', { vies, piece: certidaoPdf() })

    expect(issue.ok && issue.result).toMatchObject({ decision: 'manual_review', score: 10 })
    expect(ecrit).toMatchObject({ kyc_status: 'pending', kyc_score: 10 })
  })

  it.each([
    ['d’une autre société (autre NIPC, autre firma)', ['NIPC: 509 999 997', 'Firma: OUTRA EMPRESA, S.A.'], false],
    // Le NIPC déclaré n'y figure que comme associé, et la firma ressemble au nom du registre (plus de 64 %).
    [
      'd’une autre société dont la société déclarée est associée',
      ['NIPC: 509 999 997', 'Firma: BETA CONSTRUÇÕES EXEMPLO, LDA', 'Sócio: CONSTRUÇÕES EXEMPLO, LDA - NIPC 512 345 678'],
      false,
    ],
    // Bon NIPC, mais firma générique : seul « LDA » en commun avec le nom du registre.
    ['de la société, firma générique', ['NIPC: 512 345 678', 'Firma: XPTO, LDA'], true],
  ])('certidão %s, VIES actif : revue manuelle, jamais approuvée', async (_cas, lignes, nipcRetrouve) => {
    const { issue, ecrit } = await lancerAvec(SOCIETE, ['Certidão Permanente', ...lignes].join('\n'), { vies: viesActif })

    expect(issue.ok && issue.result).toMatchObject({ decision: 'manual_review' })
    expect(issue.ok && issue.result.checks.identifiantMatchDocVsApi).toBe(nipcRetrouve)
    expect(ecrit).toMatchObject({ kyc_status: 'pending', kyc_market: 'pt_btp' })
    expect(Number(ecrit.kyc_score)).toBeLessThan(80)
  })

  // VIES confirme le NIPC sans donner de nom : la firma n'est pas comparée à la raison sociale, saisie par l'inscrit
  // comme le texte de la certidão qu'il dépose.
  it('VIES actif sans nom (« --- ») : firma non comparée à la raison sociale déclarée, revue manuelle à 75', async () => {
    const viesSansNom = () => Response.json({ valid: true, name: '---', address: '---' })
    const { issue, ecrit } = await lancerAvec(SOCIETE, CERTIDAO, { vies: viesSansNom })

    expect(issue.ok && issue.result.checks).toMatchObject({ identifiantActiveInRegistry: true, identifiantMatchDocVsApi: true, nameMatchDocVsApi: 0 })
    expect(issue.ok && issue.result).toMatchObject({ decision: 'manual_review', score: 75 })
    expect(ecrit).toMatchObject({ kyc_status: 'pending', kyc_score: 75 })
  })
})
