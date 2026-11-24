// @vitest-environment node
// tests/api/btp-modification-equipe.test.ts — POST /api/btp, action `update` sur une équipe (11/11/2026).
//
// Depuis que useBTPData n'envoie plus que les champs modifiés, une équipe peut arriver avec ses seuls membres
// (`data: { membreIds }`) : il ne reste alors aucune colonne à écrire, et PostgREST ne renvoie aucune ligne pour un
// UPDATE vide. La route lit la ligne à la place — ce qui garde le contrôle d'appartenance avant de toucher aux
// membres. Un renommage sans `membreIds` ne détache plus personne.
//
// 15/11/2026 (constat api-coeur-9) : la route vérifie désormais que chaque membre cité appartient au compte. Les
// données du test ont suivi, pas ses attentes : identifiants de membres au format réel (M1, M2 au lieu de « m1 »,
// « m2 », que la base refuserait), membres présents dans membres_btp, et filtre `in` dans le faux client.
// 15/11/2026 (relecture adverse) : les membres ne sont plus « tout supprimés puis tout réinsérés ». La route lit les
// liens enregistrés et n'écrit que la différence (liens retirés supprimés, nouveaux liens ajoutés) : les suites
// d'opérations attendues ont suivi, les garanties du test sont les mêmes.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>
interface Operation { table: string; operation: 'select' | 'insert' | 'update' | 'delete'; valeur?: unknown; filtres: Ligne }

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | { id: string },
    equipes: [] as Array<Record<string, unknown>>,
    membres: [] as Array<Record<string, unknown>>,
    liens: [] as Array<Record<string, unknown>>,
    operations: [] as Array<{ table: string; operation: string; valeur?: unknown; filtres: Record<string, unknown> }>,
  }
  const from = (table: string) => {
    const op = { table, operation: 'select', valeur: undefined as unknown, filtres: {} as Record<string, unknown> }
    etat.operations.push(op)
    const correspond = (valeur: unknown, filtre: unknown) =>
      filtre && typeof filtre === 'object' && 'in' in filtre ? (filtre as { in: unknown[] }).in.includes(valeur) : valeur === filtre
    const lignesDeLaTable = (): Array<Record<string, unknown>> =>
      ({ equipes_btp: etat.equipes, membres_btp: etat.membres, equipe_membres_btp: etat.liens } as Record<string, Array<Record<string, unknown>>>)[table] ?? []
    const trouvees = () => lignesDeLaTable()
      .filter(ligne => Object.entries(op.filtres).every(([colonne, filtre]) => correspond(ligne[colonne], filtre)))
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = (colonne: string, valeur: unknown) => { op.filtres[colonne] = valeur; return b }
    b.in = (colonne: string, valeurs: unknown[]) => { op.filtres[colonne] = { in: valeurs }; return b }
    b.insert = (valeur: unknown) => { op.operation = 'insert'; op.valeur = valeur; return b }
    b.update = (valeur: unknown) => { op.operation = 'update'; op.valeur = valeur; return b }
    b.delete = () => { op.operation = 'delete'; return b }
    b.single = async () => {
      // Comme PostgREST : un UPDATE sans colonne ne renvoie aucune ligne, `.single()` échoue (PGRST116).
      const ecrit = op.operation === 'update' ? (op.valeur as Record<string, unknown>) : null
      const ligne = ecrit && Object.keys(ecrit).length === 0 ? undefined : trouvees()[0]
      return ligne
        ? { data: { ...ligne, ...ecrit }, error: null }
        : { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
    }
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve({ data: trouvees(), error: null }).then(ok, ko)
    return b
  }
  return { etat, from }
})

// Seul getAuthUser est simulé : la route lit aussi getUserRole, isProGerant et resolveCompanyId pour établir le
// périmètre de la société (lib/btp/perimetre-compte.ts, 24/11/2026), et c'est bien ce vrai code qu'on éprouve ici.
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.etat.user),
}))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.from(t) } }))

const { POST } = await import('@/app/api/btp/route')

const SOCIETE_A = '550e8400-e29b-41d4-a716-446655440000'
const SOCIETE_B = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const M1 = 'd4d4d4d4-0000-4000-8000-000000000001'
const M2 = 'd4d4d4d4-0000-4000-8000-000000000002'

const modifier = async (id: string, data: Ligne) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/btp', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 'equipes_btp', action: 'update', id, data }),
  }))
  return { status: res.status, json: await res.json() }
}

const operations = (table: string) => (h.etat.operations as Operation[]).filter(o => o.table === table)

beforeEach(() => {
  h.etat.user = { id: SOCIETE_A }
  h.etat.operations = []
  h.etat.equipes = [
    { id: 'equipe-a', owner_id: SOCIETE_A, nom: 'Maçons', metier: 'Maçonnerie' },
    { id: 'equipe-b', owner_id: SOCIETE_B, nom: 'Couvreurs', metier: 'Couverture' },
  ]
  h.etat.membres = [
    { id: M1, owner_id: SOCIETE_A, prenom: 'Paul', nom: 'Durand' },
    { id: M2, owner_id: SOCIETE_A, prenom: 'Léa', nom: 'Martin' },
  ]
  h.etat.liens = []
})

describe('POST /api/btp — modifier une équipe', () => {
  it('seuls les membres changent : aucun UPDATE vide, la ligne est lue, les membres sont mis à jour', async () => {
    const res = await modifier('equipe-a', { membreIds: [M1, M2] })

    expect(res.status).toBe(200)
    expect(res.json.row).toMatchObject({ id: 'equipe-a', nom: 'Maçons' })
    expect(operations('equipes_btp')).toEqual([
      { table: 'equipes_btp', operation: 'select', valeur: undefined, filtres: { id: 'equipe-a', owner_id: SOCIETE_A } },
    ])
    // Liens enregistrés lus (aucun ici), puis seuls les nouveaux liens ajoutés.
    expect(operations('equipe_membres_btp')).toEqual([
      { table: 'equipe_membres_btp', operation: 'select', valeur: undefined, filtres: { equipe_id: 'equipe-a' } },
      { table: 'equipe_membres_btp', operation: 'insert', valeur: [{ equipe_id: 'equipe-a', membre_id: M1 }, { equipe_id: 'equipe-a', membre_id: M2 }], filtres: {} },
    ])
  })

  it('équipe d’une autre société : refus, ses membres ne sont pas touchés', async () => {
    const res = await modifier('equipe-b', { membreIds: [M1] })

    // Refus inchangé. Seul son message change (constat api-coeur-15, 15/11/2026) : 500 « Erreur serveur » présentait
    // comme une panne une équipe qui n'existe tout simplement pas pour ce compte.
    expect(res.status).toBe(404)
    expect(res.json).toEqual({ error: 'Fiche introuvable : elle a peut-être été supprimée entre-temps.' })
    expect(operations('equipe_membres_btp')).toEqual([])
  })

  it('renommage seul : une seule colonne écrite, personne n’est détaché', async () => {
    const res = await modifier('equipe-a', { nom: 'Maçons — équipe 1' })

    expect(res.status).toBe(200)
    expect(operations('equipes_btp')).toEqual([
      { table: 'equipes_btp', operation: 'update', valeur: { nom: 'Maçons — équipe 1' }, filtres: { id: 'equipe-a', owner_id: SOCIETE_A } },
    ])
    expect(operations('equipe_membres_btp')).toEqual([])
  })

  it('formulaire complet : colonnes écrites sans `membreIds`, puis membres mis à jour (vidés si la liste est vide)', async () => {
    h.etat.liens = [{ equipe_id: 'equipe-a', membre_id: M1 }]

    const res = await modifier('equipe-a', { nom: 'Maçons', metier: 'Gros œuvre', membreIds: [], owner_id: SOCIETE_B, id: 'equipe-b' })

    expect(res.status).toBe(200)
    expect(operations('equipes_btp')).toEqual([
      { table: 'equipes_btp', operation: 'update', valeur: { nom: 'Maçons', metier: 'Gros œuvre' }, filtres: { id: 'equipe-a', owner_id: SOCIETE_A } },
    ])
    expect(operations('equipe_membres_btp')).toEqual([
      { table: 'equipe_membres_btp', operation: 'select', valeur: undefined, filtres: { equipe_id: 'equipe-a' } },
      { table: 'equipe_membres_btp', operation: 'delete', valeur: undefined, filtres: { equipe_id: 'equipe-a', membre_id: { in: [M1] } } },
    ])
  })
})
