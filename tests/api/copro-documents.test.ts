// tests/api/copro-documents.test.ts
//
// URLs signées (10 minutes) demandées au moment de l'ouverture, bucket privé `syndic-documents` :
//   - GET /api/coproprietaire/documents/[id] : document du cabinet de ma fiche, rattaché à MON immeuble,
//     publié sur l'extranet, d'un type consultable, compte propriétaire ; sinon 404 sans dire s'il existe ;
//   - GET /api/coproprietaire/factures/[id]/pdf : facture de l'une de MES fiches ; pdf_url doit être un
//     chemin de stockage (une URL http stockée par le syndic n'est jamais relayée), préfixe du bucket retiré.
// Les routes sont testées par leur GET exporté ; Supabase (tables et stockage) est simulé en mémoire.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => {
  type LigneH = Record<string, unknown>
  type FiltreH = { op: string; colonne: string; valeur: unknown }
  type Requete = { table: string; filtres: FiltreH[]; limite: number | null }

  const etat = {
    user: null as null | LigneH,
    tables: {} as Record<string, LigneH[]>,
    erreurs: {} as Record<string, { code: string; message: string }>,
    requetes: [] as Requete[],
    urlsSignees: [] as Array<{ bucket: string; chemin: string; duree: number }>,
    erreurSignature: null as null | { message: string },
  }

  const motifVersRegex = (motif: string): RegExp => {
    let source = ''
    for (let i = 0; i < motif.length; i++) {
      const c = motif[i]
      if (c === '\\' && i + 1 < motif.length) { source += motif[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue }
      if (c === '%' || c === '*') source += '.*'
      else if (c === '_') source += '.'
      else source += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    return new RegExp(`^${source}$`, 'i')
  }

  const passe = (ligne: LigneH, f: FiltreH): boolean => {
    const v = ligne[f.colonne]
    switch (f.op) {
      case 'eq': return v === f.valeur
      case 'neq': return v !== f.valeur
      case 'is': return f.valeur === null ? v === null || v === undefined : v === f.valeur
      case 'in': return Array.isArray(f.valeur) && f.valeur.includes(v)
      case 'ilike': return typeof v === 'string' && motifVersRegex(String(f.valeur)).test(v)
      default: return true
    }
  }

  const from = (table: string) => {
    const requete: Requete = { table, filtres: [], limite: null }
    etat.requetes.push(requete)
    let unique = false
    const resultat = () => {
      const erreur = etat.erreurs[table]
      if (erreur) return { data: null, error: erreur }
      let data = (etat.tables[table] ?? []).filter(l => requete.filtres.every(f => passe(l, f)))
      if (requete.limite !== null) data = data.slice(0, requete.limite)
      return unique ? { data: data[0] ?? null, error: null } : { data, error: null }
    }
    const q: Record<string, unknown> = {}
    q.select = () => q
    for (const op of ['eq', 'neq', 'ilike', 'in', 'is']) {
      q[op] = (colonne: string, valeur: unknown) => { requete.filtres.push({ op, colonne, valeur }); return q }
    }
    q.order = () => q
    q.limit = (n: number) => { requete.limite = n; return q }
    q.maybeSingle = () => { unique = true; return q }
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat()).then(ok, ko)
    return q
  }

  const storage = {
    from: (bucket: string) => ({
      createSignedUrl: async (chemin: string, duree: number) => {
        etat.urlsSignees.push({ bucket, chemin, duree })
        if (etat.erreurSignature) return { data: null, error: etat.erreurSignature }
        return { data: { signedUrl: `https://stockage.test/${bucket}/${chemin}?token=signe` }, error: null }
      },
    }),
  }

  return { etat, from, storage, loggerError: vi.fn() }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.etat.user),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => h.from(table), storage: h.storage } }))

const { GET: GET_DOCUMENT } = await import('@/app/api/coproprietaire/documents/[id]/route')
const { GET: GET_FACTURE_PDF } = await import('@/app/api/coproprietaire/factures/[id]/pdf/route')

// ── Jeu de données ───────────────────────────────────────────────────────────

const CABINET = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const AUTRE_CABINET = '11111111-2222-4333-8444-555555555555'
const ID_FICHE_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const ID_FICHE_2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const ID_FICHE_VOISIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9'
const IMMEUBLE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
const AUTRE_IMMEUBLE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
const DOC_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
const FACTURE_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
const EMAIL_MOI = 'geraldine.xavier@email.com'

function fiche(surcharge: Ligne = {}): Ligne {
  return {
    id: ID_FICHE_1, cabinet_id: CABINET, immeuble: 'Résidence Le Prado', batiment: 'D', etage: 4, numero_porte: '12',
    nom_proprietaire: 'Xavier', prenom_proprietaire: 'Géraldine', email_proprietaire: 'Geraldine.Xavier@Email.com',
    tel_proprietaire: null, nom_locataire: 'Durand', prenom_locataire: 'Paul', email_locataire: 'paul.durand@exemple.fr',
    tel_locataire: null, est_occupe: true, tantieme: 450, solde: 0, acces_portail: true, acces_portail_locataire: true,
    ...surcharge,
  }
}

function document(surcharge: Ligne = {}): Ligne {
  return {
    id: DOC_ID, cabinet_id: CABINET, immeuble_id: IMMEUBLE_ID, type: 'pv_assemblee', status: 'ready',
    storage_path: `${CABINET}/pv/pv-ag-2025.pdf`, filename: 'PV AG 2025.pdf', mime_type: 'application/pdf',
    publie_extranet: true, espace_extranet: 'commun', coproprio_id: null,
    ...surcharge,
  }
}

function facture(surcharge: Ligne = {}): Ligne {
  return { id: FACTURE_ID, cabinet_id: CABINET, coproprio_id: ID_FICHE_1, numero_facture: 'F-2026-001', pdf_url: 'syndic-documents/factures/2026/F-2026-001.pdf', ...surcharge }
}

const utilisateur = (role: string, email = EMAIL_MOI): Ligne =>
  ({ id: 'u-copro', email, email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { role } })

const ouvrirDocument = (id: string) =>
  GET_DOCUMENT(new NextRequest(`https://vitfix.io/api/coproprietaire/documents/${id}`, { headers: { Authorization: 'Bearer jeton-test' } }), { params: Promise.resolve({ id }) })
const ouvrirFacture = (id: string) =>
  GET_FACTURE_PDF(new NextRequest(`https://vitfix.io/api/coproprietaire/factures/${id}/pdf`, { headers: { Authorization: 'Bearer jeton-test' } }), { params: Promise.resolve({ id }) })

const requetesSur = (table: string) => h.etat.requetes.filter(r => r.table === table)
const filtres = (table: string): Array<[string, string, unknown]> =>
  (requetesSur(table)[0]?.filtres ?? []).map(f => [f.op, f.colonne, f.valeur] as [string, string, unknown])

beforeEach(() => {
  h.etat.user = utilisateur('coproprio')
  h.etat.tables = {
    syndic_coproprios: [fiche()],
    syndic_immeubles: [
      { id: IMMEUBLE_ID, cabinet_id: CABINET, nom: 'Résidence Le Prado' },
      { id: AUTRE_IMMEUBLE_ID, cabinet_id: CABINET, nom: 'Résidence Bellecour' },
    ],
    syndic_documents: [document()],
    syndic_factures_copro: [facture()],
  }
  h.etat.erreurs = {}
  h.etat.requetes = []
  h.etat.urlsSignees = []
  h.etat.erreurSignature = null
  h.loggerError.mockClear()
})

describe('GET /api/coproprietaire/documents/[id] — refus', () => {
  it('sans utilisateur → 401', async () => {
    h.etat.user = null
    const res = await ouvrirDocument(DOC_ID)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'non_authentifie' })
  })

  it('rôle artisan → 403', async () => {
    h.etat.user = utilisateur('artisan', 'artisan@exemple.fr')
    expect((await ouvrirDocument(DOC_ID)).status).toBe(403)
  })

  it('locataire → 403 role_interdit, aucun document lu, aucune URL signée', async () => {
    h.etat.user = utilisateur('locataire', 'paul.durand@exemple.fr')
    const res = await ouvrirDocument(DOC_ID)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'role_interdit' })
    expect(requetesSur('syndic_documents')).toHaveLength(0)
    expect(h.etat.urlsSignees).toHaveLength(0)
  })

  it('id mal formé → 400 invalid_id, sans lecture', async () => {
    const res = await ouvrirDocument('pas-un-uuid')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_id' })
    expect(requetesSur('syndic_documents')).toHaveLength(0)
  })

  it.each([
    ['d’un autre immeuble', { immeuble_id: AUTRE_IMMEUBLE_ID }],
    ['sans immeuble', { immeuble_id: null }],
    ['non publié', { publie_extranet: false }],
    ['de type rib', { type: 'rib' }],
    ['de type releve_bancaire', { type: 'releve_bancaire' }],
    ['en erreur de traitement', { status: 'error' }],
    ['de l’espace personnel d’un voisin', { espace_extranet: 'personnel', coproprio_id: ID_FICHE_VOISIN }],
  ])('document %s → 404 not_found, aucune URL signée', async (_cas, surcharge) => {
    h.etat.tables.syndic_documents = [document(surcharge)]
    const res = await ouvrirDocument(DOC_ID)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
    expect(h.etat.urlsSignees).toHaveLength(0)
  })

  it('document d’un autre cabinet → 404 (lecture filtrée sur mon cabinet)', async () => {
    h.etat.tables.syndic_documents = [document({ cabinet_id: AUTRE_CABINET })]
    const res = await ouvrirDocument(DOC_ID)
    expect(res.status).toBe(404)
    expect(filtres('syndic_documents')).toContainEqual(['eq', 'cabinet_id', CABINET])
    expect(filtres('syndic_documents')).toContainEqual(['eq', 'id', DOC_ID])
  })

  it('immeuble de la fiche inconnu de syndic_immeubles → 404', async () => {
    h.etat.tables.syndic_coproprios = [fiche({ immeuble: 'Résidence Inconnue' })]
    const res = await ouvrirDocument(DOC_ID)
    expect(res.status).toBe(404)
    expect(filtres('syndic_immeubles')).toContainEqual(['ilike', 'nom', 'Résidence Inconnue'])
    expect(h.etat.urlsSignees).toHaveLength(0)
  })

  it('lecture en erreur (colonne de publication absente) → 404 et erreur journalisée', async () => {
    h.etat.erreurs.syndic_documents = { code: '42703', message: 'column "publie_extranet" does not exist' }
    const res = await ouvrirDocument(DOC_ID)
    expect(res.status).toBe(404)
    expect(h.loggerError).toHaveBeenCalledWith('[COPRO DOCUMENT] lecture', expect.objectContaining({ document: 'column "publie_extranet" does not exist' }))
  })

  it.each([
    ['remontant hors du bucket', `${CABINET}/../../profile-photos/x.jpg`],
    ['absolu', `/${CABINET}/pv/pv-ag-2025.pdf`],
    ['coupé par un « ? »', `${AUTRE_CABINET}/pv.pdf?x=${CABINET}`],
  ])('storage_path %s → 404, aucune URL signée, erreur journalisée', async (_cas, chemin) => {
    h.etat.tables.syndic_documents = [document({ storage_path: chemin })]
    const res = await ouvrirDocument(DOC_ID)
    expect(res.status).toBe(404)
    expect(h.etat.urlsSignees).toHaveLength(0)
    expect(h.loggerError).toHaveBeenCalledWith('[COPRO DOCUMENT] chemin de stockage refusé', { document: DOC_ID })
  })

  it('URL signée en échec → 500 sans détail, erreur journalisée', async () => {
    h.etat.erreurSignature = { message: 'Object not found' }
    const res = await ouvrirDocument(DOC_ID)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Une erreur interne est survenue' })
    expect(h.loggerError).toHaveBeenCalledWith('[COPRO DOCUMENT] URL signée', { message: 'Object not found' })
  })
})

describe('GET /api/coproprietaire/documents/[id] — ouverture', () => {
  it('document publié de mon immeuble → URL signée 10 minutes sur le bucket syndic-documents, jamais de cache', async () => {
    const res = await ouvrirDocument(DOC_ID)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const corps = await res.json()
    expect(corps).toEqual({
      url: `https://stockage.test/syndic-documents/${CABINET}/pv/pv-ag-2025.pdf?token=signe`,
      expiresInSeconds: 600,
      nom: 'PV AG 2025.pdf',
      mimeType: 'application/pdf',
    })
    expect(h.etat.urlsSignees).toEqual([{ bucket: 'syndic-documents', chemin: `${CABINET}/pv/pv-ag-2025.pdf`, duree: 600 }])
    // L'immeuble est cherché dans mon cabinet, par le nom de ma fiche.
    expect(filtres('syndic_immeubles')).toContainEqual(['eq', 'cabinet_id', CABINET])
    expect(filtres('syndic_immeubles')).toContainEqual(['ilike', 'nom', 'Résidence Le Prado'])
  })

  it('document de MON espace personnel → 200 ; celui d’une autre de mes fiches aussi', async () => {
    h.etat.tables.syndic_coproprios = [fiche(), fiche({ id: ID_FICHE_2, batiment: 'A', numero_porte: '3' })]
    h.etat.tables.syndic_documents = [document({ espace_extranet: 'personnel', coproprio_id: ID_FICHE_2 })]
    expect((await ouvrirDocument(DOC_ID)).status).toBe(200)
  })

  it('le nom de l’immeuble est comparé sans tenir compte de la casse', async () => {
    h.etat.tables.syndic_immeubles = [{ id: IMMEUBLE_ID, cabinet_id: CABINET, nom: 'RÉSIDENCE LE PRADO' }]
    expect((await ouvrirDocument(DOC_ID)).status).toBe(200)
  })
})

describe('GET /api/coproprietaire/factures/[id]/pdf', () => {
  it('sans utilisateur → 401 ; locataire → 403 ; id mal formé → 400', async () => {
    h.etat.user = null
    expect((await ouvrirFacture(FACTURE_ID)).status).toBe(401)
    h.etat.user = utilisateur('locataire', 'paul.durand@exemple.fr')
    expect((await ouvrirFacture(FACTURE_ID)).status).toBe(403)
    h.etat.user = utilisateur('coproprio')
    expect((await ouvrirFacture('123')).status).toBe(400)
    expect(requetesSur('syndic_factures_copro')).toHaveLength(0)
    expect(h.etat.urlsSignees).toHaveLength(0)
  })

  it('pdf_url est une URL http stockée par le syndic → 404, jamais relayée', async () => {
    h.etat.tables.syndic_factures_copro = [facture({ pdf_url: 'https://drive.exemple.fr/facture.pdf' })]
    const res = await ouvrirFacture(FACTURE_ID)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
    expect(h.etat.urlsSignees).toHaveLength(0)
  })

  it('pdf_url vide ou absent → 404', async () => {
    h.etat.tables.syndic_factures_copro = [facture({ pdf_url: null })]
    expect((await ouvrirFacture(FACTURE_ID)).status).toBe(404)
    h.etat.tables.syndic_factures_copro = [facture({ pdf_url: '   ' })]
    expect((await ouvrirFacture(FACTURE_ID)).status).toBe(404)
  })

  it('facture d’un autre copropriétaire → 404 ; la lecture est filtrée sur mon cabinet et MES fiches', async () => {
    h.etat.tables.syndic_coproprios = [fiche(), fiche({ id: ID_FICHE_2, batiment: 'A', numero_porte: '3' })]
    h.etat.tables.syndic_factures_copro = [facture({ coproprio_id: ID_FICHE_VOISIN })]
    const res = await ouvrirFacture(FACTURE_ID)
    expect(res.status).toBe(404)
    expect(filtres('syndic_factures_copro')).toContainEqual(['eq', 'id', FACTURE_ID])
    expect(filtres('syndic_factures_copro')).toContainEqual(['eq', 'cabinet_id', CABINET])
    expect(filtres('syndic_factures_copro')).toContainEqual(['in', 'coproprio_id', [ID_FICHE_1, ID_FICHE_2]])
    expect(h.etat.urlsSignees).toHaveLength(0)
  })

  it('facture d’une autre de mes fiches → 200', async () => {
    h.etat.tables.syndic_coproprios = [fiche(), fiche({ id: ID_FICHE_2, batiment: 'A', numero_porte: '3' })]
    h.etat.tables.syndic_factures_copro = [facture({ coproprio_id: ID_FICHE_2 })]
    expect((await ouvrirFacture(FACTURE_ID)).status).toBe(200)
  })

  it('chemin de stockage avec le préfixe du bucket → préfixe retiré, URL signée 10 minutes', async () => {
    const res = await ouvrirFacture(FACTURE_ID)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await res.json()).toEqual({
      url: 'https://stockage.test/syndic-documents/factures/2026/F-2026-001.pdf?token=signe',
      expiresInSeconds: 600,
      nom: 'F-2026-001',
    })
    expect(h.etat.urlsSignees).toEqual([{ bucket: 'syndic-documents', chemin: 'factures/2026/F-2026-001.pdf', duree: 600 }])
  })

  it('chemin sans préfixe, avec barre oblique en tête → nettoyé', async () => {
    h.etat.tables.syndic_factures_copro = [facture({ pdf_url: '/factures/2026/F-2026-001.pdf' })]
    expect((await ouvrirFacture(FACTURE_ID)).status).toBe(200)
    expect(h.etat.urlsSignees[0].chemin).toBe('factures/2026/F-2026-001.pdf')
  })

  it('lecture en erreur → 500 et erreur journalisée', async () => {
    h.etat.erreurs.syndic_factures_copro = { code: '57014', message: 'timeout' }
    const res = await ouvrirFacture(FACTURE_ID)
    expect(res.status).toBe(500)
    expect(h.loggerError).toHaveBeenCalledWith('[COPRO FACTURE PDF] lecture', expect.objectContaining({ code: '57014' }))
  })

  it('URL signée en échec → 500', async () => {
    h.etat.erreurSignature = { message: 'Object not found' }
    expect((await ouvrirFacture(FACTURE_ID)).status).toBe(500)
    expect(h.loggerError).toHaveBeenCalledWith('[COPRO FACTURE PDF] URL signée', { message: 'Object not found' })
  })
})
