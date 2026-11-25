// POST /api/devis/sync — filet « numéro en double » pour les sociétés BTP (constat api-coeur-11 de l'audit des
// fondations BTP du 11/11/2026, suite de documents-cycle-1).
//
// Avant : quand le document arrivait avec son identifiant stable, la ligne existante était cherchée par cet
// identifiant ; une AUTRE ligne du compte portant le même numéro n'était jamais vue. Le test d'origine
// (tests/api/devis-sync.test.ts) passait grâce à une recherche simulée qui ignorait les filtres. L'enregistrement
// échouait ensuite sur la contrainte UNIQUE (numero, artisan_user_id) : erreur 500 « Sync failed ».
// Désormais (société BTP) : le nouveau document est refusé (409 numero_collision, message en français), le document
// qui porte déjà le numéro n'est ni écrasé ni renuméroté, et rien n'est écrit.
//
// Base simulée fidèle : chaque filtre (eq, neq, in, limit) est appliqué, et l'upsert respecte la clé de conflit et la
// contrainte UNIQUE (numero, artisan_user_id) des tables devis et factures (migration 087).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'

type Ligne = Record<string, unknown>

const simu = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  ecritures: [] as Array<{ table: string; ligne: Record<string, unknown> }>,
  utilisateur: null as null | { id: string; app_metadata: Record<string, unknown> },
  // Course : écriture d'un autre envoi, faite entre le contrôle du numéro et l'enregistrement.
  avantEcriture: null as null | (() => void),
}))

function upsert(table: string, ligne: Ligne, onConflict: string): { data: { id: unknown } | null; error: { code: string; message: string } | null } {
  simu.avantEcriture?.()
  simu.avantEcriture = null
  const lignes = (simu.tables[table] ??= [])
  const cles = onConflict.split(',')
  const existante = lignes.find((l) => cles.every((c) => ligne[c] !== undefined && l[c] === ligne[c]))
  const resultat: Ligne = existante ? { ...existante, ...ligne } : { id: ligne.id ?? randomUUID(), ...ligne }
  const doublon = resultat.numero != null && lignes.some((l) =>
    l !== existante && l.numero === resultat.numero && l.artisan_user_id === resultat.artisan_user_id)
  if (doublon) {
    return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint "${table}_numero_artisan_user_unique"` } }
  }
  if (existante) Object.assign(existante, ligne)
  else lignes.push(resultat)
  simu.ecritures.push({ table, ligne })
  return { data: { id: resultat.id }, error: null }
}

function requete(table: string) {
  const filtres: Array<(l: Ligne) => boolean> = []
  let borne = Number.POSITIVE_INFINITY
  const lignes = () => (simu.tables[table] ?? []).filter((l) => filtres.every((f) => f(l))).slice(0, borne)
  const q = {
    select: () => q,
    eq: (c: string, v: unknown) => { filtres.push((l) => l[c] === v); return q },
    neq: (c: string, v: unknown) => { filtres.push((l) => l[c] !== v); return q },
    in: (c: string, vs: unknown[]) => { filtres.push((l) => vs.includes(l[c])); return q },
    limit: (n: number) => { borne = n; return q },
    maybeSingle: async () => {
      const r = lignes()
      return r.length > 1 ? { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } } : { data: r[0] ?? null, error: null }
    },
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: lignes(), error: null }).then(ok, ko),
    upsert: (ligne: Ligne, opts: { onConflict: string }) => ({ select: () => ({ single: async () => upsert(table, ligne, opts.onConflict) }) }),
  }
  return q
}

vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => requete(table) } }))
// Simulation PARTIELLE du module, héritée du vrai : depuis le 25/11/2026 les routes des documents résolvent
// aussi le périmètre de la société (lib/btp/perimetre-compte), qui importe getUserRole, isProGerant,
// societeDunAutreCompte et resolveCompanyId du même fichier. Les omettre les ferait disparaître du module simulé.
// Pour un compte artisan comme pour un gérant, lirePerimetreBtp sort sans toucher la base.
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: async () => simu.utilisateur,
}))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())

const COMPTE = '00000000-0000-4000-8000-0000000000c1'
const FICHE = '00000000-0000-4000-8000-0000000000c2'
const ID_EXISTANT = '6f1c2a34-0000-4000-8000-0000000000b1'
const ID_NOUVEAU = '6f1c2a34-0000-4000-8000-0000000000a1'
const NUMERO = 'FACT-2026-012'

const FACTURE_EXISTANTE: Ligne = {
  id: ID_EXISTANT, artisan_user_id: COMPTE, artisan_id: FICHE, numero: NUMERO, status: 'pending',
  client_name: 'Client B', raw_data: { id: ID_EXISTANT, docNumber: NUMERO, clientName: 'Client B' }, content_hash: null,
}

const facture = (sur: Ligne = {}): Ligne => ({
  id: ID_NOUVEAU, docType: 'facture', docNumber: NUMERO, status: 'envoye', clientName: 'Client A',
  lines: [{ id: 1, description: 'Ravalement', qty: 1, unit: 'f', priceHT: 2000, tvaRate: 20, totalHT: 2000 }],
  ...sur,
})

async function synchroniser(docType: 'facture' | 'devis', doc: Ligne) {
  const { POST } = await import('@/app/api/devis/sync/route')
  const res = await POST(new Request('http://localhost:3000/api/devis/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
    body: JSON.stringify({ docType, artisanId: FICHE, doc }),
  }) as never)
  return { status: res.status, corps: await res.json() as Record<string, unknown> }
}

beforeEach(() => {
  delete process.env.DOC_HASH_SECRET
  simu.ecritures.length = 0
  simu.tables = {
    profiles_artisan: [{ id: FICHE, user_id: COMPTE }],
    pro_team_members: [],
    factures: [structuredClone(FACTURE_EXISTANTE)],
    devis: [],
  }
  simu.utilisateur = { id: COMPTE, app_metadata: { role: 'pro_societe' } }
})

describe('synchro BTP — numéro déjà porté par un autre document du compte', () => {
  it('facture d\'un autre identifiant au même numéro : refusée (409), la facture existante intacte, rien d\'écrit', async () => {
    const { status, corps } = await synchroniser('facture', facture())
    expect(status).toBe(409)
    expect(corps.error).toBe('numero_collision')
    expect(String(corps.message)).toMatch(/déjà/)
    expect(simu.tables.factures).toEqual([FACTURE_EXISTANTE])
    expect(simu.ecritures).toEqual([])
  })

  it('même refus quand la ligne qui porte le numéro est une facture supprimée (le numéro reste pris)', async () => {
    simu.tables.factures[0].deleted_at = '2026-10-01T10:00:00.000Z'
    const { status, corps } = await synchroniser('facture', facture())
    expect(status).toBe(409)
    expect(corps.error).toBe('numero_collision')
    expect(simu.ecritures).toEqual([])
  })

  it('devis : même filet sur la table devis', async () => {
    simu.tables.devis = [{ id: ID_EXISTANT, artisan_user_id: COMPTE, artisan_id: FICHE, numero: 'DEV-2026-007', status: 'sent', content_hash: null }]
    const { status, corps } = await synchroniser('devis', facture({ docType: 'devis', docNumber: 'DEV-2026-007' }))
    expect(status).toBe(409)
    expect(corps.error).toBe('numero_collision')
    expect(simu.tables.devis).toHaveLength(1)
  })

  it('le document lui-même (même identifiant) se réenregistre normalement : pas de faux doublon', async () => {
    const { status } = await synchroniser('facture', facture({ id: ID_EXISTANT, clientName: 'Client B' }))
    expect(status).toBe(200)
    expect(simu.tables.factures).toHaveLength(1)
  })

  it('brouillon sans numéro : enregistré, aucun contrôle de numéro', async () => {
    const { status } = await synchroniser('facture', facture({ docNumber: '', status: 'brouillon' }))
    expect(status).toBe(200)
    expect(simu.tables.factures).toHaveLength(2)
  })

  it('course : l\'autre document arrive entre le contrôle et l\'enregistrement → même refus (409), rien d\'écrit', async () => {
    simu.tables.factures = []
    simu.avantEcriture = () => { simu.tables.factures.push(structuredClone(FACTURE_EXISTANTE)) }
    const { status, corps } = await synchroniser('facture', facture())
    expect(status).toBe(409)
    expect(corps.error).toBe('numero_collision')
    expect(simu.tables.factures).toEqual([FACTURE_EXISTANTE])
    expect(simu.ecritures).toEqual([])
  })

  it('numéro libre : la facture émise est enregistrée', async () => {
    const { status } = await synchroniser('facture', facture({ docNumber: 'FACT-2026-013' }))
    expect(status).toBe(200)
    expect(simu.tables.factures.map((l) => l.numero)).toEqual([NUMERO, 'FACT-2026-013'])
  })
})

describe('synchro artisan — hors du périmètre de ce lot', () => {
  it('compte artisan : réponse d\'origine inchangée (erreur de la contrainte, rien d\'écrit)', async () => {
    simu.utilisateur = { id: COMPTE, app_metadata: { role: 'artisan' } }
    const { status, corps } = await synchroniser('facture', facture())
    expect(status).toBe(500)
    expect(corps.error).toBe('Sync failed')
    expect(simu.tables.factures).toEqual([FACTURE_EXISTANTE])
  })
})
