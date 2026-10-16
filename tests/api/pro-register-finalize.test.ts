// @vitest-environment node
// POST /api/pro/register/finalize — Kbis, pièce d'identité et KYC de l'inscription
// BTP, sans session (confirmation d'e-mail active : signUp ne renvoie pas de jeton).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const PROFIL_ID = 'profil-btp-1'

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

const mocks = vi.hoisted(() => ({
  authUser: null as Record<string, unknown> | null,
  profil: null as Record<string, unknown> | null,
  profilError: null as { message: string } | null,
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  runKycPipeline: vi.fn(),
  afterTasks: [] as Array<() => Promise<void>>,
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, after: (task: () => Promise<void>) => { mocks.afterTasks.push(task) } }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(),
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
    email: 'gerant@provence-pro.fr',
    created_at: new Date().toISOString(),
    app_metadata: { role: 'pro_societe' },
    user_metadata: { role: 'pro_societe', full_name: 'Jean Martin' },
    ...surcharge,
  }
}

function requete(champs: Record<string, string | File>) {
  const fd = new FormData()
  for (const [cle, valeur] of Object.entries(champs)) fd.append(cle, valeur)
  // Aucun en-tête Authorization : c'est tout l'objet de la route.
  return new Request('http://localhost/api/pro/register/finalize', { method: 'POST', body: fd })
}

const kbis = () => new File([PDF], 'kbis.pdf', { type: 'application/pdf' })
const identite = () => new File([PNG], 'cni.png', { type: 'image/png' })

async function appeler(champs: Record<string, string | File>) {
  const { POST } = await import('@/app/api/pro/register/finalize/route')
  return POST(requete(champs) as never)
}

async function terminerAfter() {
  const taches = mocks.afterTasks.splice(0)
  for (const tache of taches) await tache()
}

beforeEach(() => {
  mocks.authUser = utilisateur()
  mocks.profil = { id: PROFIL_ID, kbis_url: null, id_document_url: null }
  mocks.profilError = null
  mocks.afterTasks.length = 0
  mocks.upload.mockReset().mockImplementation(async (chemin: string) => ({ data: { path: chemin }, error: null }))
  mocks.createSignedUrl.mockReset().mockImplementation(async (p: string) => ({ data: { signedUrl: `https://signee/${p}` } }))
  mocks.updateEq.mockReset().mockResolvedValue({ error: null })
  mocks.update.mockReset().mockReturnValue({ eq: mocks.updateEq })
  mocks.runKycPipeline.mockReset().mockResolvedValue({ ok: true, result: { score: 80 } })
})

describe('POST /api/pro/register/finalize — pièces sans session', () => {
  it('dépose le Kbis et la pièce d\'identité, les écrit dans le profil et lance le KYC après la réponse', async () => {
    const res = await appeler({ user_id: USER_ID, kbis: kbis(), identity: identite() })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, documents: { kbis: true, identity: true } })

    expect(mocks.upload).toHaveBeenCalledTimes(2)
    const [cheminKbis, , optionsKbis] = mocks.upload.mock.calls[0]
    const [cheminId, , optionsId] = mocks.upload.mock.calls[1]
    expect(cheminKbis).toMatch(/^kbis\/\d+_[0-9a-f]{8}\.pdf$/)
    expect(optionsKbis).toEqual({ contentType: 'application/pdf', upsert: false })
    expect(cheminId).toMatch(/^identity\/\d+_[0-9a-f]{8}\.png$/)
    expect(optionsId).toEqual({ contentType: 'image/png', upsert: false })

    expect(mocks.update).toHaveBeenCalledWith({
      kbis_url: `https://signee/${cheminKbis}`,
      id_document_url: `https://signee/${cheminId}`,
    })
    expect(mocks.updateEq).toHaveBeenCalledWith('id', PROFIL_ID)

    // KYC enregistré via after(), pas exécuté avant la réponse
    expect(mocks.runKycPipeline).not.toHaveBeenCalled()
    await terminerAfter()
    expect(mocks.runKycPipeline).toHaveBeenCalledWith(PROFIL_ID, USER_ID)
  })

  it('lance le KYC même sans pièce jointe (contrôle du SIRET et du registre)', async () => {
    const res = await appeler({ user_id: USER_ID })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, documents: { kbis: false, identity: false } })
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    await terminerAfter()
    expect(mocks.runKycPipeline).toHaveBeenCalledWith(PROFIL_ID, USER_ID)
  })

  it('ne remplace jamais une pièce déjà déposée', async () => {
    mocks.profil = { id: PROFIL_ID, kbis_url: 'https://signee/kbis/ancien.pdf', id_document_url: null }

    const res = await appeler({ user_id: USER_ID, kbis: kbis(), identity: identite() })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, documents: { kbis: false, identity: true } })
    expect(mocks.upload).toHaveBeenCalledTimes(1)
    expect(mocks.upload.mock.calls[0][0]).toMatch(/^identity\//)
    expect(mocks.update).toHaveBeenCalledWith({ id_document_url: expect.stringMatching(/^https:\/\/signee\/identity\//) })
  })

  it('garde la pièce déposée et le KYC quand l\'autre dépôt échoue', async () => {
    mocks.upload
      .mockImplementationOnce(async (chemin: string) => ({ data: { path: chemin }, error: null }))
      .mockImplementationOnce(async () => ({ data: null, error: { message: 'storage down' } }))

    const res = await appeler({ user_id: USER_ID, kbis: kbis(), identity: identite() })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Erreur lors de l'envoi des pièces", documents: { kbis: true, identity: false } })
    expect(mocks.update).toHaveBeenCalledWith({ kbis_url: expect.stringMatching(/^https:\/\/signee\/kbis\//) })
    await terminerAfter()
    expect(mocks.runKycPipeline).toHaveBeenCalledWith(PROFIL_ID, USER_ID)
  })
})

describe('POST /api/pro/register/finalize — gardes', () => {
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

  it('403 hors société BTP, même si user_metadata (modifiable par le client) dit pro_societe', async () => {
    mocks.authUser = utilisateur({ app_metadata: { role: 'artisan' } })
    const res = await appeler({ user_id: USER_ID, kbis: kbis() })
    expect(res.status).toBe(403)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.afterTasks).toHaveLength(0)
  })

  it('400 pour un fichier dont le contenu n\'est ni PDF, ni JPG, ni PNG (type MIME ignoré)', async () => {
    const faux = new File(['<script>alert(1)</script>'], 'kbis.pdf', { type: 'application/pdf' })
    const res = await appeler({ user_id: USER_ID, kbis: faux })
    expect(res.status).toBe(400)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('400 pour un fichier de plus de 10 Mo', async () => {
    const gros = new File([PDF, new Uint8Array(10 * 1024 * 1024)], 'kbis.pdf', { type: 'application/pdf' })
    const res = await appeler({ user_id: USER_ID, kbis: gros })
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
})
