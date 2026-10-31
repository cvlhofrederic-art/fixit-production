// @vitest-environment node
// tests/api/syndic-lea-documents-storage.test.ts
//
// Chemins Storage relus en base par les routes Léa Documents (lot 2 Aikido, issue 11) :
//   - GET et DELETE /api/syndic/lea-documents/[id], POST /api/syndic/lea-documents/process,
//     POST /api/syndic/lea-pdf-generate, DELETE /api/syndic/lea-pdf-templates/[id] ;
//   - préfixe imposé = dossier du cabinet ({cabinet}/…, format depuis le 25/05/2026) ou dossier de
//     l'uploadeur / créateur (dépôts du 21 au 25/05/2026, {user}/…) seulement s'il est membre du cabinet
//     (syndic_team_members) : uploaded_by / created_by sont des colonnes que le cabinet écrit lui-même
//     avec son JWT, elles ne valent pas preuve ;
//   - chemin refusé : 400 invalid_storage_path (GET, génération), ligne en erreur (process), ligne
//     supprimée et objet laissé (DELETE) ; le chemin n'est jamais journalisé.
// Supabase (tables) en mémoire via syndic-supabase-memoire ; Storage simulé ici (appels journalisés).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'
import { viderCacheDossiersStorage } from '@/lib/syndic/dossiers-storage'

const h = vi.hoisted(() => ({
  CABINET: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
  base: null as unknown as BaseMemoire,
  telechargements: [] as Array<{ bucket: string; chemin: string }>,
  suppressions: [] as Array<{ bucket: string; chemins: string[] }>,
  urlsSignees: [] as Array<{ bucket: string; chemin: string }>,
  depots: [] as Array<{ bucket: string; chemin: string; options: unknown }>,
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: h.loggerWarn, info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({ id: h.CABINET, email: 'syndic@exemple.fr', app_metadata: { role: 'syndic' } })),
  isSyndicRole: vi.fn(() => true),
  isSuperAdmin: vi.fn(() => false),
  resolveCabinetId: vi.fn(async () => h.CABINET),
}))
vi.mock('@/lib/langfuse', () => ({ traceAgent: vi.fn(async (_p: unknown, fn: () => Promise<unknown>) => fn()) }))
vi.mock('@/lib/syndic/lea-documents-extract', () => ({
  extractPdfText: vi.fn(async () => ({ text: 'Texte extrait du document, assez long pour en tirer des métadonnées.' })),
  extractMetadataFromText: vi.fn(async () => ({ montant: 120 })),
}))
vi.mock('@/lib/syndic/embed', () => ({ embedText: vi.fn(async () => [0.1, 0.2]) }))
vi.mock('@/lib/syndic/lea-pdf-generator', () => ({
  generatePdfFromTemplate: vi.fn(async () => ({ bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), filled_fields: ['nom'], unfilled_fields: [] })),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => clientMemoire(h.base).from(table),
    storage: {
      from: (bucket: string) => ({
        download: async (chemin: string) => {
          h.telechargements.push({ bucket, chemin })
          const octets = new Uint8Array([0x25, 0x50, 0x44, 0x46])
          return { data: { arrayBuffer: async () => octets.buffer, text: async () => '' }, error: null }
        },
        remove: async (chemins: string[]) => { h.suppressions.push({ bucket, chemins }); return { data: [], error: null } },
        createSignedUrl: async (chemin: string) => {
          h.urlsSignees.push({ bucket, chemin })
          return { data: { signedUrl: `https://stockage.test/${bucket}/${chemin}?token=signe` }, error: null }
        },
        upload: async (chemin: string, _corps: unknown, options: unknown) => {
          h.depots.push({ bucket, chemin, options })
          return { data: { path: chemin }, error: null }
        },
      }),
    },
  },
}))

const { GET: GET_DOCUMENT, DELETE: DELETE_DOCUMENT } = await import('@/app/api/syndic/lea-documents/[id]/route')
const { POST: POST_PROCESS } = await import('@/app/api/syndic/lea-documents/process/route')
const { POST: POST_GENERATE } = await import('@/app/api/syndic/lea-pdf-generate/route')
const { DELETE: DELETE_MODELE } = await import('@/app/api/syndic/lea-pdf-templates/[id]/route')

// ── Jeu de données ───────────────────────────────────────────────────────────

const CABINET = h.CABINET
const AUTRE_CABINET = '11111111-2222-4333-8444-555555555555'
const MEMBRE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
const DOC_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
const TPL_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

type Ligne = Record<string, unknown>

const document = (surcharge: Ligne = {}): Ligne => ({
  id: DOC_ID, cabinet_id: CABINET, storage_path: `${CABINET}/${DOC_ID}.pdf`, uploaded_by: CABINET,
  filename: 'facture-eau.pdf', mime_type: 'application/pdf', type: 'facture', status: 'ready', ...surcharge,
})
const modele = (surcharge: Ligne = {}): Ligne => ({
  id: TPL_ID, cabinet_id: CABINET, name: 'Convocation AG', storage_path: `${CABINET}/${TPL_ID}.pdf`, created_by: CABINET,
  placeholders: {}, locale: 'fr', type: 'convocation', ...surcharge,
})
const membre = (): Ligne => ({ id: 'tm-1', cabinet_id: CABINET, user_id: MEMBRE, is_active: true })

/** Cas de refus communs : (uploadeur ou créateur, chemin). Le chemin porte « secret » pour vérifier les journaux. */
const CAS_REFUSES: Array<[string, string, string]> = [
  ['uploadeur étranger au cabinet (ligne forgeable par le cabinet, policy cabinet_id = auth.uid())', AUTRE_CABINET, `${AUTRE_CABINET}/secret-${DOC_ID}.pdf`],
  ['uploadeur = cabinet mais chemin dans le dossier d’un membre', CABINET, `${MEMBRE}/secret-${DOC_ID}.pdf`],
  ['uploadeur membre mais chemin dans le dossier d’un autre cabinet', MEMBRE, `${AUTRE_CABINET}/secret-${DOC_ID}.pdf`],
  ['traversée sous le bon préfixe', CABINET, `${CABINET}/../${AUTRE_CABINET}/secret-${DOC_ID}.pdf`],
  ['traversée encodée', CABINET, `${CABINET}/%2e%2e/${AUTRE_CABINET}/secret-${DOC_ID}.pdf`],
]

const entetes = { Authorization: 'Bearer jeton-test' }
const lireDocument = (id = DOC_ID) =>
  GET_DOCUMENT(new NextRequest(`https://vitfix.io/api/syndic/lea-documents/${id}`, { headers: entetes }), { params: Promise.resolve({ id }) })
const supprimerDocument = (id = DOC_ID) =>
  DELETE_DOCUMENT(new NextRequest(`https://vitfix.io/api/syndic/lea-documents/${id}`, { method: 'DELETE', headers: entetes }), { params: Promise.resolve({ id }) })
const traiter = () =>
  POST_PROCESS(new NextRequest('https://vitfix.io/api/syndic/lea-documents/process', { method: 'POST', headers: entetes }))
const generer = () =>
  POST_GENERATE(new NextRequest('https://vitfix.io/api/syndic/lea-pdf-generate', {
    method: 'POST', headers: { ...entetes, 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: TPL_ID, field_values: { nom: 'Résidence Le Prado' } }),
  }))
const supprimerModele = (id = TPL_ID) =>
  DELETE_MODELE(new NextRequest(`https://vitfix.io/api/syndic/lea-pdf-templates/${id}`, { method: 'DELETE', headers: entetes }), { params: Promise.resolve({ id }) })

const journauxSansLeChemin = () => {
  const journaux = JSON.stringify([...h.loggerError.mock.calls, ...h.loggerWarn.mock.calls])
  expect(journaux).not.toContain('secret-')
}

beforeEach(() => {
  h.base = nouvelleBase()
  h.base.lignes = { syndic_documents: [document()], syndic_pdf_templates: [modele()], syndic_team_members: [membre()] }
  h.telechargements = []
  h.suppressions = []
  h.urlsSignees = []
  h.depots = []
  h.loggerError.mockClear()
  h.loggerWarn.mockClear()
  viderCacheDossiersStorage()
})

describe('GET /api/syndic/lea-documents/[id] — chemin relu en base', () => {
  it('chemin dans le dossier du cabinet → 200, URL signée 10 minutes sur ce chemin', async () => {
    const res = await lireDocument()
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.signed_url).toBe(`https://stockage.test/syndic-documents/${CABINET}/${DOC_ID}.pdf?token=signe`)
    expect(corps.expires_in_seconds).toBe(600)
    expect(h.urlsSignees).toEqual([{ bucket: 'syndic-documents', chemin: `${CABINET}/${DOC_ID}.pdf` }])
    // uploaded_by = cabinet : aucune lecture de syndic_team_members
    expect(appelsDe(h.base, 'syndic_team_members')).toHaveLength(0)
  })

  it('dépôt du 21 au 25/05/2026 (dossier de l’uploadeur, membre du cabinet) → 200, appartenance lue en base', async () => {
    h.base.lignes.syndic_documents = [document({ storage_path: `${MEMBRE}/${DOC_ID}.pdf`, uploaded_by: MEMBRE })]
    const res = await lireDocument()
    expect(res.status).toBe(200)
    expect(h.urlsSignees).toEqual([{ bucket: 'syndic-documents', chemin: `${MEMBRE}/${DOC_ID}.pdf` }])
    const lecture = appelsDe(h.base, 'syndic_team_members', 'select')[0]
    expect(lecture.eq).toContainEqual(['cabinet_id', CABINET])
    expect(lecture.eq).toContainEqual(['user_id', MEMBRE])
  })

  it.each(CAS_REFUSES)('%s → 400 invalid_storage_path, aucune URL signée, journal sans le chemin', async (_cas, uploadeur, chemin) => {
    h.base.lignes.syndic_documents = [document({ storage_path: chemin, uploaded_by: uploadeur })]
    const res = await lireDocument()
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_storage_path' })
    expect(h.urlsSignees).toHaveLength(0)
    expect(h.loggerError).toHaveBeenCalledWith('[lea-documents/get] storage_path refusé:', { id: DOC_ID })
    journauxSansLeChemin()
  })

  it('document d’un autre cabinet → 404, lecture filtrée sur mon cabinet', async () => {
    h.base.lignes.syndic_documents = [document({ cabinet_id: AUTRE_CABINET })]
    const res = await lireDocument()
    expect(res.status).toBe(404)
    expect(appelsDe(h.base, 'syndic_documents', 'select')[0].eq).toContainEqual(['cabinet_id', CABINET])
    expect(h.urlsSignees).toHaveLength(0)
  })
})

describe('DELETE /api/syndic/lea-documents/[id] — objet et ligne', () => {
  it('chemin accepté → objet supprimé puis ligne supprimée (filtrée sur le cabinet)', async () => {
    const res = await supprimerDocument()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true, id: DOC_ID })
    expect(h.suppressions).toEqual([{ bucket: 'syndic-documents', chemins: [`${CABINET}/${DOC_ID}.pdf`] }])
    const suppression = appelsDe(h.base, 'syndic_documents', 'delete')
    expect(suppression).toHaveLength(1)
    expect(suppression[0].eq).toContainEqual(['id', DOC_ID])
    expect(suppression[0].eq).toContainEqual(['cabinet_id', CABINET])
  })

  it('chemin refusé (uploadeur étranger) → objet laissé, ligne supprimée quand même, avertissement sans le chemin', async () => {
    h.base.lignes.syndic_documents = [document({ storage_path: `${AUTRE_CABINET}/secret-${DOC_ID}.pdf`, uploaded_by: AUTRE_CABINET })]
    const res = await supprimerDocument()
    expect(res.status).toBe(200)
    expect(h.suppressions).toHaveLength(0)
    expect(appelsDe(h.base, 'syndic_documents', 'delete')).toHaveLength(1)
    expect(h.loggerWarn).toHaveBeenCalledWith('[lea-documents/delete] storage remove failed (continuing with DB delete):', expect.anything())
    journauxSansLeChemin()
  })
})

describe('POST /api/syndic/lea-documents/process — téléchargement du document', () => {
  const miseAJour = (statut: string) =>
    appelsDe(h.base, 'syndic_documents', 'update').find(a => (a.donnees as { status?: string }).status === statut)

  it('document en attente du cabinet → téléchargé depuis son dossier, marqué processed', async () => {
    h.base.lignes.syndic_documents = [document({ status: 'pending' })]
    const res = await traiter()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ processed: 1, ok: 1, error: 0 })
    expect(h.telechargements).toEqual([{ bucket: 'syndic-documents', chemin: `${CABINET}/${DOC_ID}.pdf` }])
    expect(miseAJour('processed')).toBeDefined()
  })

  it('dépôt du 21 au 25/05/2026 d’un membre du cabinet → téléchargé depuis le dossier du membre', async () => {
    h.base.lignes.syndic_documents = [document({ status: 'pending', storage_path: `${MEMBRE}/${DOC_ID}.pdf`, uploaded_by: MEMBRE })]
    const res = await traiter()
    expect(await res.json()).toMatchObject({ processed: 1, ok: 1, error: 0 })
    expect(h.telechargements).toEqual([{ bucket: 'syndic-documents', chemin: `${MEMBRE}/${DOC_ID}.pdf` }])
  })

  it('uploadeur étranger au cabinet → rien téléchargé, ligne en erreur, message et journaux sans le chemin', async () => {
    h.base.lignes.syndic_documents = [document({ status: 'pending', storage_path: `${AUTRE_CABINET}/secret-${DOC_ID}.pdf`, uploaded_by: AUTRE_CABINET })]
    const res = await traiter()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ processed: 1, ok: 0, error: 1 })
    expect(h.telechargements).toHaveLength(0)
    const erreur = miseAJour('error')
    expect(erreur).toBeDefined()
    expect(String((erreur!.donnees as { error_message: string }).error_message)).not.toContain('secret-')
    journauxSansLeChemin()
  })
})

describe('POST /api/syndic/lea-pdf-generate — modèle relu en base', () => {
  it('modèle du cabinet → 201, modèle téléchargé depuis le dossier du cabinet, PDF déposé sous {cabinet}/{uuid}.pdf', async () => {
    const res = await generer()
    expect(res.status).toBe(201)
    expect(h.telechargements).toEqual([{ bucket: 'syndic-pdf-templates', chemin: `${CABINET}/${TPL_ID}.pdf` }])
    expect(h.depots).toHaveLength(1)
    expect(h.depots[0].bucket).toBe('syndic-pdf-generated')
    expect(h.depots[0].chemin).toMatch(new RegExp(`^${CABINET}/${UUID}\\.pdf$`))
    expect(h.depots[0].options).toEqual({ contentType: 'application/pdf', upsert: false })
    expect(h.urlsSignees).toEqual([{ bucket: 'syndic-pdf-generated', chemin: h.depots[0].chemin }])
    expect((await res.json()).signed_url).toContain(h.depots[0].chemin)
  })

  it('modèle créé du 21 au 25/05/2026 par un membre du cabinet (dossier du créateur) → 201', async () => {
    h.base.lignes.syndic_pdf_templates = [modele({ storage_path: `${MEMBRE}/${TPL_ID}.pdf`, created_by: MEMBRE })]
    const res = await generer()
    expect(res.status).toBe(201)
    expect(h.telechargements).toEqual([{ bucket: 'syndic-pdf-templates', chemin: `${MEMBRE}/${TPL_ID}.pdf` }])
  })

  it.each(CAS_REFUSES)('%s → 400 invalid_storage_path, rien téléchargé ni déposé', async (_cas, createur, chemin) => {
    h.base.lignes.syndic_pdf_templates = [modele({ storage_path: chemin, created_by: createur })]
    const res = await generer()
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_storage_path' })
    expect(h.telechargements).toHaveLength(0)
    expect(h.depots).toHaveLength(0)
    expect(h.loggerError).toHaveBeenCalledWith('[lea-pdf-generate] storage_path refusé:', { template: TPL_ID })
    journauxSansLeChemin()
  })
})

describe('DELETE /api/syndic/lea-pdf-templates/[id] — objet et ligne', () => {
  it('chemin accepté → objet supprimé puis ligne supprimée', async () => {
    const res = await supprimerModele()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true, id: TPL_ID })
    expect(h.suppressions).toEqual([{ bucket: 'syndic-pdf-templates', chemins: [`${CABINET}/${TPL_ID}.pdf`] }])
    expect(appelsDe(h.base, 'syndic_pdf_templates', 'delete')).toHaveLength(1)
  })

  it('créateur étranger au cabinet → objet laissé, ligne supprimée, avertissement sans le chemin', async () => {
    h.base.lignes.syndic_pdf_templates = [modele({ storage_path: `${AUTRE_CABINET}/secret-${TPL_ID}.pdf`, created_by: AUTRE_CABINET })]
    const res = await supprimerModele()
    expect(res.status).toBe(200)
    expect(h.suppressions).toHaveLength(0)
    expect(appelsDe(h.base, 'syndic_pdf_templates', 'delete')).toHaveLength(1)
    expect(h.loggerWarn).toHaveBeenCalledWith('[lea-pdf-templates/delete] storage remove failed (continuing):', expect.anything())
    journauxSansLeChemin()
  })
})
