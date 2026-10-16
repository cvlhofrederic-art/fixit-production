// @vitest-environment node
// POST /api/pro/register/motifs-artisan — motifs par défaut de l'inscription artisan,
// sans session (confirmation d'e-mail active : signUp ne renvoie pas de jeton).
// Métiers lus dans le profil créé par create-profile ; Supabase en mémoire.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import defaultMotifs from '@/lib/default-motifs.json'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const PROFIL_ID = 'profil-artisan-1'

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  authUser: null as Record<string, unknown> | null,
  checkRateLimit: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: h.checkRateLimit,
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(() => new Response(null, { status: 429 })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: vi.fn(async () => (
          h.authUser
            ? { data: { user: h.authUser }, error: null }
            : { data: { user: null }, error: { message: 'User not found' } }
        )),
      },
    },
    from: (t: string) => clientMemoire(h.base).from(t),
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

async function appeler(body: unknown) {
  const { POST } = await import('@/app/api/pro/register/motifs-artisan/route')
  // Aucun en-tête Authorization : c'est tout l'objet de la route.
  return POST(new Request('http://localhost/api/pro/register/motifs-artisan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as never)
}

const motifsDe = (metier: string) => defaultMotifs.metiers.find((m) => m.id === metier)!.motifs
const servicesInseres = () => appelsDe(h.base, 'services', 'insert')[0]?.donnees as Array<Record<string, unknown>> | undefined

beforeEach(() => {
  h.base = nouvelleBase()
  h.base.lignes.profiles_artisan = [
    { id: PROFIL_ID, user_id: USER_ID, categories: ['plomberie', 'espaces-verts'] },
    { id: 'profil-autre', user_id: 'autre-user', categories: ['peinture'] },
  ]
  h.authUser = utilisateur()
  h.checkRateLimit.mockReset().mockResolvedValue(true)
})

describe('POST /api/pro/register/motifs-artisan — motifs sans session', () => {
  it('insère les motifs des métiers du profil, avec leurs étapes', async () => {
    const tonte = motifsDe('jardinier').find((m) => m.nom === 'Tonte pelouse') as unknown as { nom: string; etapes: string[] }
    h.base.inserts.services = { id: 'svc-tonte', name: tonte.nom }

    const res = await appeler({ user_id: USER_ID })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true, count: 1, etapes_count: tonte.etapes.length, metiers: ['plombier', 'jardinier'],
    })

    const lignes = servicesInseres()!
    const attendus = new Set([...motifsDe('plombier'), ...motifsDe('jardinier')].map((m) => m.nom))
    expect(lignes).toHaveLength(attendus.size)
    expect(new Set(lignes.map((l) => l.name))).toEqual(attendus)
    for (const l of lignes) {
      expect(l).toMatchObject({ artisan_id: PROFIL_ID, price_ht: 0, price_ttc: 0, active: true, validation_auto: false })
    }

    const etapes = appelsDe(h.base, 'service_etapes', 'insert')[0].donnees as Array<Record<string, unknown>>
    expect(etapes).toEqual(tonte.etapes.map((d, i) => ({ service_id: 'svc-tonte', ordre: i + 1, designation: d })))
  })

  it('lit les métiers dans le profil, jamais dans la requête (artisan_id et categories ignorés)', async () => {
    const res = await appeler({ user_id: USER_ID, artisan_id: 'profil-autre', categories: ['peinture'] })

    expect(res.status).toBe(200)
    expect((await res.json()).metiers).toEqual(['plombier', 'jardinier'])
    expect(servicesInseres()!.every((l) => l.artisan_id === PROFIL_ID)).toBe(true)
  })

  it("ne double jamais les motifs d'un artisan qui en a déjà", async () => {
    h.base.lignes.services = [{ id: 'svc-existant', artisan_id: PROFIL_ID }]

    const res = await appeler({ user_id: USER_ID })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ skipped: true, reason: 'Motifs déjà existants' })
    expect(servicesInseres()).toBeUndefined()
  })

  it("n'insère rien quand aucun métier du profil n'est reconnu", async () => {
    h.base.lignes.profiles_artisan[0].categories = ['metier-inconnu']

    const res = await appeler({ user_id: USER_ID })

    expect(await res.json()).toEqual({ skipped: true, reason: 'Aucun métier reconnu' })
    expect(servicesInseres()).toBeUndefined()
  })

  it("n'insère rien quand le profil n'a pas de métier enregistré", async () => {
    h.base.lignes.profiles_artisan[0].categories = null

    const res = await appeler({ user_id: USER_ID })

    expect(await res.json()).toEqual({ skipped: true, reason: 'Aucun métier reconnu' })
    expect(servicesInseres()).toBeUndefined()
  })

  it("500 sans détail interne quand l'insertion échoue", async () => {
    h.base.erreurs['services.insert'] = { message: 'relation "services" violates constraint' }

    const res = await appeler({ user_id: USER_ID })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Erreur serveur' })
  })
})

describe('POST /api/pro/register/motifs-artisan — gardes', () => {
  it('429 au-delà de la limite de requêtes', async () => {
    h.checkRateLimit.mockResolvedValue(false)
    const res = await appeler({ user_id: USER_ID })
    expect(res.status).toBe(429)
    expect(servicesInseres()).toBeUndefined()
  })

  it('400 sans user_id, avec un user_id qui n\'est pas un UUID ou un corps illisible', async () => {
    expect((await appeler({})).status).toBe(400)
    expect((await appeler({ user_id: 'pas-un-uuid' })).status).toBe(400)
    expect((await appeler('{pas du json')).status).toBe(400)
    expect(servicesInseres()).toBeUndefined()
  })

  it('404 pour un utilisateur inconnu', async () => {
    h.authUser = null
    const res = await appeler({ user_id: USER_ID })
    expect(res.status).toBe(404)
    expect(servicesInseres()).toBeUndefined()
  })

  it('403 quand le compte a plus de 10 minutes', async () => {
    h.authUser = utilisateur({ created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString() })
    const res = await appeler({ user_id: USER_ID })
    expect(res.status).toBe(403)
    expect(servicesInseres()).toBeUndefined()
  })

  it('403 pour une société BTP', async () => {
    h.authUser = utilisateur({ app_metadata: { role: 'pro_societe' } })
    const res = await appeler({ user_id: USER_ID })
    expect(res.status).toBe(403)
    expect(servicesInseres()).toBeUndefined()
  })

  it('403 hors artisan, même si user_metadata (modifiable par le client) dit artisan', async () => {
    h.authUser = utilisateur({ app_metadata: {}, user_metadata: { role: 'artisan' } })
    const res = await appeler({ user_id: USER_ID })
    expect(res.status).toBe(403)
    expect(servicesInseres()).toBeUndefined()
  })

  it('404 sans profil (create-profile pas encore passé)', async () => {
    h.base.lignes.profiles_artisan = []
    const res = await appeler({ user_id: USER_ID })
    expect(res.status).toBe(404)
    expect(servicesInseres()).toBeUndefined()
  })

  it('500 sans détail interne quand la lecture du profil échoue', async () => {
    h.base.erreurs['profiles_artisan.select'] = { message: 'column "country" does not exist' }
    const res = await appeler({ user_id: USER_ID })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Erreur serveur' })
  })
})
