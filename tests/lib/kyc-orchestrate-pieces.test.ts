// @vitest-environment node
// runKycPipeline (lib/kyc-orchestrate.ts) : lecture du Kbis et de la pièce d'identité enregistrés dans la fiche.
// Depuis que la fiche garde le chemin du fichier (et plus un lien signé), le KYC crée un lien frais pour
// télécharger la pièce ; un ancien lien expiré ou dont le jeton a été retiré se relit de la même façon.
// Seuls les liens créés et les téléchargements depuis le stockage sont vérifiés : le résultat de la lecture du
// document (OCR) dépend de son fournisseur, simulé ici ou absent, et n'est pas l'objet de ce test.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const PROJET = 'https://projet-test.supabase.co'
const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const AUTRE_ID = 'ffffffff-0000-4000-8000-000000000001'
const SIRET = '35600000000048' // format valide (exception La Poste du contrôle de Luhn)
const CHEMIN_KBIS = `${USER_ID}/kbis/0f8fad5b-d9cb-469f-a165-70867728950e.pdf`
const lienFrais = (chemin: string) => `${PROJET}/storage/v1/object/sign/artisan-documents/${chemin}?token=frais`

const mocks = vi.hoisted(() => ({
  artisan: null as Record<string, unknown> | null,
  createSignedUrls: vi.fn(),
  ocr: vi.fn(),
  telecharges: [] as string[],
}))

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))
// Lecteur de documents du KYC (Workers AI par lib/ai/relais depuis le retrait des modèles de Groq), simulé pour un
// test rapide et sans réseau (sa réponse n'est pas vérifiée).
vi.mock('@/lib/ai/relais', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/relais')>()),
  appelerVision: mocks.ocr,
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: mocks.artisan, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
    storage: { from: () => ({ createSignedUrls: mocks.createSignedUrls }) },
  },
}))

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', PROJET)
  mocks.telecharges.length = 0
  mocks.artisan = {
    id: 'profil-1',
    user_id: USER_ID,
    siret: SIRET,
    company_name: 'BATIMENT SUD EXEMPLE',
    kyc_market: 'fr_btp',
    kbis_url: CHEMIN_KBIS,
  }
  mocks.createSignedUrls.mockReset().mockImplementation(async (chemins: string[]) => ({
    data: chemins.map((path) => ({ path, error: null, signedUrl: lienFrais(path) })),
    error: null,
  }))
  mocks.ocr.mockReset().mockResolvedValue({
    choices: [{ message: { content: `EXTRAIT KBIS\nSIRET : ${SIRET}\nDénomination : BATIMENT SUD EXEMPLE\nGérant : Jean Exemple\n${'texte '.repeat(30)}` } }],
  })
  vi.stubGlobal('fetch', vi.fn(async (entree: string | URL) => {
    const url = String(entree)
    if (url.startsWith('https://recherche-entreprises.api.gouv.fr/')) {
      return new Response(JSON.stringify({ results: [{ etat_administratif: 'A', nom_complet: 'BATIMENT SUD EXEMPLE' }] }))
    }
    // Tout autre service que le stockage (lecture du document, par exemple) : indisponible, et non relevé.
    if (!url.startsWith(`${PROJET}/storage/`)) return new Response('{}', { status: 503 })
    mocks.telecharges.push(url)
    // Le stockage n'ouvre que les liens portant un jeton valable.
    if (url.includes('token=frais')) return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]))
    return new Response('{"error":"InvalidJWT"}', { status: 400 })
  }))
})

async function lancer() {
  const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
  const issue = await runKycPipeline('profil-1', USER_ID)
  if (!issue.ok) throw new Error(`KYC non lancé : ${issue.status}`)
  return issue.result
}

describe('runKycPipeline — pièces enregistrées par leur chemin', () => {
  it('télécharge le Kbis par un lien frais créé à partir du chemin enregistré', async () => {
    await lancer()

    expect(mocks.createSignedUrls).toHaveBeenCalledTimes(1)
    expect(mocks.createSignedUrls).toHaveBeenCalledWith([CHEMIN_KBIS], expect.any(Number))
    expect(mocks.telecharges).toEqual([lienFrais(CHEMIN_KBIS)])
  })

  it('relit un ancien lien dont le jeton a été retiré', async () => {
    mocks.artisan = { ...mocks.artisan, kbis_url: `${PROJET}/storage/v1/object/sign/artisan-documents/${CHEMIN_KBIS}` }

    await lancer()

    expect(mocks.createSignedUrls).toHaveBeenCalledWith([CHEMIN_KBIS], expect.any(Number))
    expect(mocks.telecharges).toEqual([lienFrais(CHEMIN_KBIS)])
  })

  it('Kbis et pièce d’identité : liens frais créés en une seule requête, avant les lectures', async () => {
    const cheminIdentite = `${USER_ID}/identity/1b4e28ba-2fa1-11d2-883f-0016d3cca427.png`
    // La pièce d'identité n'est lue que s'il y a un nom à y chercher (lib/kyc-orchestrate.ts).
    mocks.artisan = { ...mocks.artisan, id_document_url: cheminIdentite, first_name: 'Jean', last_name: 'Exemple' }

    await lancer()

    expect(mocks.createSignedUrls).toHaveBeenCalledTimes(1)
    expect(mocks.createSignedUrls).toHaveBeenCalledWith([CHEMIN_KBIS, cheminIdentite], expect.any(Number))
    expect(mocks.telecharges).toEqual([lienFrais(CHEMIN_KBIS), lienFrais(cheminIdentite)])
  })

  it('sans nom à chercher : la pièce d’identité a son lien frais, mais elle n’est pas téléchargée', async () => {
    const cheminIdentite = `${USER_ID}/identity/1b4e28ba-2fa1-11d2-883f-0016d3cca427.png`
    mocks.artisan = { ...mocks.artisan, id_document_url: cheminIdentite }

    await lancer()

    expect(mocks.createSignedUrls).toHaveBeenCalledTimes(1)
    expect(mocks.createSignedUrls).toHaveBeenCalledWith([CHEMIN_KBIS, cheminIdentite], expect.any(Number))
    expect(mocks.telecharges).toEqual([lienFrais(CHEMIN_KBIS)])
  })

  it('panne du stockage pendant la création des liens : le contrôle continue, pièces non lues', async () => {
    mocks.createSignedUrls.mockRejectedValueOnce(new Error('stockage indisponible'))

    const resultat = await lancer()

    expect(mocks.telecharges).toEqual([])
    expect(resultat.checks.identifiantFormatValid).toBe(true)
    expect(resultat.checks.identifiantActiveInRegistry).toBe(true)
    expect(resultat.checks.docOcrSuccess).toBe(false)
  })

  it('ne signe pas une pièce rangée hors du dossier du titulaire', async () => {
    mocks.artisan = { ...mocks.artisan, kbis_url: `${AUTRE_ID}/kbis/x.pdf` }

    const resultat = await lancer()

    expect(mocks.createSignedUrls).not.toHaveBeenCalled()
    expect(mocks.telecharges).toEqual([])
    expect(resultat.checks.docOcrSuccess).toBe(false)
  })
})
