// @vitest-environment node
// POST /api/pro/register/finalize-artisan — Kbis, pièce d'identité, assurance et KYC
// de l'inscription artisan, sans session (confirmation d'e-mail active : signUp
// ne renvoie pas de jeton).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const PROFIL_ID = 'profil-artisan-1'

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49])

const mocks = vi.hoisted(() => ({
  authUser: null as Record<string, unknown> | null,
  profil: null as Record<string, unknown> | null,
  profilError: null as { message: string } | null,
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  runKycPipeline: vi.fn(),
  checkRateLimit: vi.fn(),
  afterTasks: [] as Array<() => Promise<void>>,
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, after: (task: () => Promise<void>) => { mocks.afterTasks.push(task) } }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(() => new Response(null, { status: 429 })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/kyc-orchestrate', () => ({ runKycPipeline: mocks.runKycPipeline }))

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: vi.fn(async () => (
          mocks.authUser
            ? { data: { user: mocks.authUser }, error: null }
            : { data: { user: null }, error: { message: 'User not found' } }
        )),
      },
    },
    from: (table: string) => {
      if (table !== 'profiles_artisan') throw new Error(`table inattendue : ${table}`)
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: mocks.profil, error: mocks.profilError }) }),
        }),
        update: mocks.update,
      }
    },
    storage: {
      from: () => ({
        upload: mocks.upload,
        createSignedUrl: mocks.createSignedUrl,
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://public/${p}` } }),
      }),
    },
  },
}))

function utilisateur(surcharge: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: 'artisan@exemple.fr',
    created_at: new Date().toISOString(),
    app_metadata: { role: 'artisan' },
    user_metadata: { role: 'artisan', full_name: 'Paul Durand' },
    ...surcharge,
  }
}

function requete(champs: Record<string, string | File>) {
  const fd = new FormData()
  for (const [cle, valeur] of Object.entries(champs)) fd.append(cle, valeur)
  // Aucun en-tête Authorization : c'est tout l'objet de la route.
  return new Request('http://localhost/api/pro/register/finalize-artisan', { method: 'POST', body: fd })
}

const kbis = () => new File([PDF], 'kbis.pdf', { type: 'application/pdf' })
const identite = () => new File([PNG], 'cni.png', { type: 'image/png' })
const verso = () => new File([PNG], 'cni-verso.png', { type: 'image/png' })
const assurance = () => new File([JPG], 'decennale.jpg', { type: 'image/jpeg' })

async function appeler(champs: Record<string, string | File>) {
  const { POST } = await import('@/app/api/pro/register/finalize-artisan/route')
  return POST(requete(champs) as never)
}

async function terminerAfter() {
  const taches = mocks.afterTasks.splice(0)
  for (const tache of taches) await tache()
}

beforeEach(() => {
  mocks.authUser = utilisateur()
  mocks.profil = { id: PROFIL_ID, kbis_url: null, id_document_url: null, id_document_verso_url: null, insurance_url: null }
  mocks.profilError = null
  mocks.afterTasks.length = 0
  mocks.checkRateLimit.mockReset().mockResolvedValue(true)
  mocks.upload.mockReset().mockImplementation(async (chemin: string) => ({ data: { path: chemin }, error: null }))
  mocks.createSignedUrl.mockReset().mockImplementation(async (p: string) => ({ data: { signedUrl: `https://signee/${p}` } }))
  mocks.updateEq.mockReset().mockResolvedValue({ error: null })
  mocks.update.mockReset().mockReturnValue({ eq: mocks.updateEq })
  mocks.runKycPipeline.mockReset().mockResolvedValue({ ok: true, result: { score: 80 } })
})

describe('POST /api/pro/register/finalize-artisan — pièces sans session', () => {
  it("dépose les quatre pièces, les écrit dans le profil et lance le KYC après la réponse", async () => {
    const res = await appeler({
      user_id: USER_ID, kbis: kbis(), identity: identite(), identity_verso: verso(), insurance: assurance(),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true, documents: { kbis: true, identity: true, identity_verso: true, insurance: true },
    })

    expect(mocks.upload).toHaveBeenCalledTimes(4)
    const chemins = mocks.upload.mock.calls.map(([chemin]) => chemin as string)
    expect(chemins[0]).toMatch(/^kbis\/\d+_[0-9a-f]{8}\.pdf$/)
    expect(chemins[1]).toMatch(/^identity\/\d+_[0-9a-f]{8}\.png$/)
    expect(chemins[2]).toMatch(/^identity-verso\/\d+_[0-9a-f]{8}\.png$/)
    expect(chemins[3]).toMatch(/^insurance\/\d+_[0-9a-f]{8}\.jpg$/)
    expect(mocks.upload.mock.calls[0][2]).toEqual({ contentType: 'application/pdf', upsert: false })
    expect(mocks.upload.mock.calls[3][2]).toEqual({ contentType: 'image/jpeg', upsert: false })

    expect(mocks.update).toHaveBeenCalledWith({
      kbis_url: `https://signee/${chemins[0]}`,
      id_document_url: `https://signee/${chemins[1]}`,
      id_document_verso_url: `https://signee/${chemins[2]}`,
      insurance_url: `https://signee/${chemins[3]}`,
    })
    expect(mocks.updateEq).toHaveBeenCalledWith('id', PROFIL_ID)

    // KYC enregistré via after(), pas exécuté avant la réponse
    expect(mocks.runKycPipeline).not.toHaveBeenCalled()
    await terminerAfter()
    expect(mocks.runKycPipeline).toHaveBeenCalledWith(PROFIL_ID, USER_ID)
  })

  it("enregistre l'assurance seule (pièce facultative du formulaire)", async () => {
    const res = await appeler({ user_id: USER_ID, insurance: assurance() })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true, documents: { kbis: false, identity: false, identity_verso: false, insurance: true },
    })
    expect(mocks.update).toHaveBeenCalledWith({ insurance_url: expect.stringMatching(/^https:\/\/signee\/insurance\//) })
  })

  it('lance le KYC même sans pièce jointe (contrôle du SIRET et du registre)', async () => {
    const res = await appeler({ user_id: USER_ID })

    expect(res.status).toBe(200)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    await terminerAfter()
    expect(mocks.runKycPipeline).toHaveBeenCalledWith(PROFIL_ID, USER_ID)
  })

  it('ne remplace jamais une pièce déjà déposée', async () => {
    mocks.profil = { ...mocks.profil, kbis_url: 'https://signee/kbis/ancien.pdf' }

    const res = await appeler({ user_id: USER_ID, kbis: kbis(), identity: identite() })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true, documents: { kbis: false, identity: true, identity_verso: false, insurance: false },
    })
    expect(mocks.upload).toHaveBeenCalledTimes(1)
    expect(mocks.upload.mock.calls[0][0]).toMatch(/^identity\//)
    expect(mocks.update).toHaveBeenCalledWith({ id_document_url: expect.stringMatching(/^https:\/\/signee\/identity\//) })
  })

  it("ignore le verso tant que sa colonne n'existe pas en base, sans gêner les autres pièces", async () => {
    // Prod avant la migration 20261016 : select('*') ne renvoie pas id_document_verso_url
    mocks.profil = { id: PROFIL_ID, kbis_url: null, id_document_url: null, insurance_url: null }

    const res = await appeler({
      user_id: USER_ID, kbis: kbis(), identity: identite(), identity_verso: verso(), insurance: assurance(),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true, documents: { kbis: true, identity: true, identity_verso: false, insurance: true },
    })
    expect(mocks.upload).toHaveBeenCalledTimes(3) // aucun dépôt orphelin pour le verso
    expect(mocks.update).toHaveBeenCalledWith({
      kbis_url: expect.stringMatching(/^https:\/\/signee\/kbis\//),
      id_document_url: expect.stringMatching(/^https:\/\/signee\/identity\//),
      insurance_url: expect.stringMatching(/^https:\/\/signee\/insurance\//),
    })
  })

  it("garde la pièce déposée et le KYC quand l'autre dépôt échoue", async () => {
    mocks.upload
      .mockImplementationOnce(async (chemin: string) => ({ data: { path: chemin }, error: null }))
      .mockImplementationOnce(async () => ({ data: null, error: { message: 'storage down' } }))

    const res = await appeler({ user_id: USER_ID, kbis: kbis(), identity: identite() })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: "Erreur lors de l'envoi des pièces",
      documents: { kbis: true, identity: false, identity_verso: false, insurance: false },
    })
    expect(mocks.update).toHaveBeenCalledWith({ kbis_url: expect.stringMatching(/^https:\/\/signee\/kbis\//) })
    await terminerAfter()
    expect(mocks.runKycPipeline).toHaveBeenCalledWith(PROFIL_ID, USER_ID)
  })

  it("signale l'échec quand le profil ne peut pas être mis à jour", async () => {
    mocks.updateEq.mockResolvedValue({ error: { message: 'boom' } })

    const res = await appeler({ user_id: USER_ID, kbis: kbis() })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: "Erreur lors de l'envoi des pièces",
      documents: { kbis: false, identity: false, identity_verso: false, insurance: false },
    })
  })
})

describe('POST /api/pro/register/finalize-artisan — gardes', () => {
  it('429 au-delà de la limite de requêtes', async () => {
    mocks.checkRateLimit.mockResolvedValue(false)
    const res = await appeler({ user_id: USER_ID, kbis: kbis() })
    expect(res.status).toBe(429)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('400 sans user_id', async () => {
    const res = await appeler({ kbis: kbis() })
    expect(res.status).toBe(400)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('404 pour un utilisateur inconnu', async () => {
    mocks.authUser = null
    const res = await appeler({ user_id: USER_ID, kbis: kbis() })
    expect(res.status).toBe(404)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('403 quand le compte a plus de 10 minutes', async () => {
    mocks.authUser = utilisateur({ created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString() })
    const res = await appeler({ user_id: USER_ID, kbis: kbis() })
    expect(res.status).toBe(403)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.afterTasks).toHaveLength(0)
  })

  it("403 pour une société BTP : elle a sa propre route", async () => {
    mocks.authUser = utilisateur({ app_metadata: { role: 'pro_societe' } })
    const res = await appeler({ user_id: USER_ID, kbis: kbis() })
    expect(res.status).toBe(403)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.afterTasks).toHaveLength(0)
  })

  it('403 hors artisan, même si user_metadata (modifiable par le client) dit artisan', async () => {
    mocks.authUser = utilisateur({ app_metadata: { role: 'client' } })
    const res = await appeler({ user_id: USER_ID, kbis: kbis() })
    expect(res.status).toBe(403)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.afterTasks).toHaveLength(0)
  })

  it("400 pour un fichier dont le contenu n'est ni PDF, ni JPG, ni PNG (type MIME ignoré)", async () => {
    const faux = new File(['<script>alert(1)</script>'], 'assurance.pdf', { type: 'application/pdf' })
    const res = await appeler({ user_id: USER_ID, kbis: kbis(), insurance: faux })
    expect(res.status).toBe(400)
    expect(mocks.upload).not.toHaveBeenCalled() // rien n'est déposé, pas même le Kbis valide
  })

  it('400 pour un fichier de plus de 10 Mo', async () => {
    const gros = new File([PDF, new Uint8Array(10 * 1024 * 1024)], 'assurance.pdf', { type: 'application/pdf' })
    const res = await appeler({ user_id: USER_ID, insurance: gros })
    expect(res.status).toBe(400)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('400 pour un champ fichier envoyé en texte', async () => {
    const res = await appeler({ user_id: USER_ID, insurance: 'https://ailleurs/fichier.pdf' })
    expect(res.status).toBe(400)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('404 sans profil (create-profile pas encore passé) : aucun dépôt orphelin', async () => {
    mocks.profil = null
    const res = await appeler({ user_id: USER_ID, kbis: kbis() })
    expect(res.status).toBe(404)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.afterTasks).toHaveLength(0)
  })

  it('500 sans détail interne quand la lecture du profil échoue', async () => {
    mocks.profilError = { message: 'column profiles_artisan.secret does not exist' }
    const res = await appeler({ user_id: USER_ID, kbis: kbis() })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Erreur serveur' })
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})
