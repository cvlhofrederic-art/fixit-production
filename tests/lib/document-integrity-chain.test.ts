import { describe, it, expect, vi } from 'vitest'
import {
  fetchPreviousContentHash,
  pickLatestSignedRow,
  type SignedRowRef,
  type ChainQueryClient,
} from '@/lib/document-integrity'

// Bug #2 (hardening) — buildHashChainFields sélectionnait le « document
// précédent » par signed_at DESC SEUL, sans filtre deleted_at IS NULL et sans
// tie-break sur id. Les vues SQL d'audit (v_devis_chain_check /
// v_factures_chain_check) utilisent LAG(content_hash) OVER (PARTITION BY
// artisan ORDER BY signed_at, id) ... WHERE deleted_at IS NULL.
//
// Conséquences du bug :
//  (a) un doc signé puis soft-deleté restait sélectionné comme previous_hash →
//      la vue (qui l'exclut) reporte un faux « broken ».
//  (b) égalité signed_at à la même milliseconde → le DESC seul pouvait choisir
//      un « précédent » différent de celui que la vue chaîne via (signed_at,id).
//
// On teste ici la pure logique de sélection (pickLatestSignedRow) + la
// construction de requête (fetchPreviousContentHash) sans toucher à l'algo de
// hash.

// ── pickLatestSignedRow : comparateur pur (ordre (signed_at, id) ASC → on veut
//    le DERNIER, donc le max lexical sur (signed_at, id)). ──────────────────────
describe('pickLatestSignedRow — ordre (signed_at, id)', () => {
  it('renvoie null sur liste vide', () => {
    expect(pickLatestSignedRow([])).toBeNull()
  })

  it('départage deux signed_at identiques (même milliseconde) par id le plus grand', () => {
    const rows: SignedRowRef[] = [
      { id: 'aaaa', signed_at: '2026-05-05T12:00:00.000Z', content_hash: 'hashA' },
      { id: 'bbbb', signed_at: '2026-05-05T12:00:00.000Z', content_hash: 'hashB' },
    ]
    // (signed_at, id) ASC → dernier = id le plus grand 'bbbb'
    expect(pickLatestSignedRow(rows)?.content_hash).toBe('hashB')
  })

  it('choisit le signed_at le plus récent quand ils diffèrent', () => {
    const rows: SignedRowRef[] = [
      { id: 'zzzz', signed_at: '2026-05-05T10:00:00.000Z', content_hash: 'old' },
      { id: 'aaaa', signed_at: '2026-05-05T18:00:00.000Z', content_hash: 'recent' },
    ]
    expect(pickLatestSignedRow(rows)?.content_hash).toBe('recent')
  })
})

// ── fetchPreviousContentHash : doit appliquer eq(artisan) + not(signed_at null)
//    + is(deleted_at null) + order(signed_at desc) + order(id desc) + limit(1).
//    On injecte un faux query-builder qui enregistre les appels. ──────────────
function makeFakeClient(opts: {
  rows?: SignedRowRef[]
  error?: { message: string } | null
  // si fourni, la 1re exécution renvoie cette erreur (simulate missing column),
  // puis les exécutions suivantes renvoient `rows`.
  firstError?: { message: string }
}): { client: ChainQueryClient; calls: string[]; isCalls: Array<[string, unknown]> } {
  const calls: string[] = []
  const isCalls: Array<[string, unknown]> = []
  let executions = 0

  const builder: Record<string, unknown> = {}
  const chain = (name: string, ...args: unknown[]) => {
    calls.push(name)
    if (name === 'is') isCalls.push([args[0] as string, args[1]])
    return builder
  }
  builder.select = (...a: unknown[]) => chain('select', ...a)
  builder.eq = (...a: unknown[]) => chain('eq', ...a)
  builder.not = (...a: unknown[]) => chain('not', ...a)
  builder.is = (...a: unknown[]) => chain('is', ...a)
  builder.order = (...a: unknown[]) => chain('order', ...a)
  // limit() est terminal (awaitable / thenable)
  builder.limit = (...a: unknown[]) => {
    chain('limit', ...a)
    executions += 1
    if (opts.firstError && executions === 1) {
      return Promise.resolve({ data: null, error: opts.firstError })
    }
    return Promise.resolve({ data: opts.rows ?? [], error: opts.error ?? null })
  }

  const client: ChainQueryClient = {
    from: (table: string) => {
      calls.push(`from:${table}`)
      return builder as unknown as ReturnType<ChainQueryClient['from']>
    },
  }
  return { client, calls, isCalls }
}

describe('fetchPreviousContentHash — requête alignée sur les vues SQL', () => {
  it("filtre deleted_at IS NULL et ordonne par (signed_at desc, id desc) avec limit(1)", async () => {
    const { client, calls, isCalls } = makeFakeClient({
      rows: [{ id: 'b', signed_at: '2026-05-05T12:00:00.000Z', content_hash: 'prevHash' }],
    })
    const hash = await fetchPreviousContentHash(
      'devis',
      '550e8400-e29b-41d4-a716-446655440000',
      client,
    )
    expect(hash).toBe('prevHash')
    // deleted_at IS NULL appliqué (alignement vue WHERE deleted_at IS NULL)
    expect(isCalls).toContainEqual(['deleted_at', null])
    // double order : signed_at puis id (alignement vue ORDER BY signed_at, id)
    const orderCount = calls.filter(c => c === 'order').length
    expect(orderCount).toBe(2)
    expect(calls).toContain('limit')
  })

  it('renvoie null quand aucun doc signé', async () => {
    const { client } = makeFakeClient({ rows: [] })
    const hash = await fetchPreviousContentHash('factures', 'artisan-1', client)
    expect(hash).toBeNull()
  })

  it("retombe sur une requête sans filtre deleted_at si la colonne n'existe pas", async () => {
    // 1re exécution : erreur « column deleted_at does not exist » → fallback
    const { client, isCalls } = makeFakeClient({
      firstError: { message: 'column "deleted_at" does not exist' },
      rows: [{ id: 'x', signed_at: '2026-05-05T09:00:00.000Z', content_hash: 'fallbackHash' }],
    })
    const hash = await fetchPreviousContentHash('devis', 'artisan-2', client)
    expect(hash).toBe('fallbackHash')
    // Le 1er essai a tenté is(deleted_at,null) ; le fallback ne doit pas relancer
    // is(deleted_at,null) une 2e fois.
    const deletedAtCalls = isCalls.filter(([col]) => col === 'deleted_at')
    expect(deletedAtCalls.length).toBe(1)
  })

  it('propage une vraie erreur DB (non liée à deleted_at) en lançant', async () => {
    const { client } = makeFakeClient({
      error: { message: 'connection reset by peer' },
    })
    await expect(
      fetchPreviousContentHash('devis', 'artisan-3', client),
    ).rejects.toThrow(/previous document hash|connection reset/i)
  })
})
