// @vitest-environment node
// lib/syndic/dossiers-storage.ts — préfixes Storage autorisés pour un objet d'un cabinet syndic :
// toujours le dossier du cabinet ; celui de l'uploadeur (uploaded_by / created_by, colonnes que le
// cabinet écrit lui-même) seulement s'il désigne le cabinet ou un compte de syndic_team_members.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const h = vi.hoisted(() => ({
  membres: [] as Array<{ cabinet_id: string; user_id: string }>,
  erreur: null as null | { message: string },
  requetes: [] as Array<Array<[string, unknown]>>,
  loggerWarn: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: { warn: h.loggerWarn, error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

const { prefixesStorageCabinet, viderCacheDossiersStorage } = await import('@/lib/syndic/dossiers-storage')

const CABINET = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const AUTRE_CABINET = '11111111-2222-4333-8444-555555555555'
const MEMBRE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'

// Client Supabase simulé : from('syndic_team_members').select().eq().eq().limit().maybeSingle()
const sb = {
  from: (table: string) => {
    if (table !== 'syndic_team_members') throw new Error(`table inattendue : ${table}`)
    const filtres: Array<[string, unknown]> = []
    h.requetes.push(filtres)
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.limit = () => q
    q.eq = (colonne: string, valeur: unknown) => { filtres.push([colonne, valeur]); return q }
    q.maybeSingle = async () => {
      if (h.erreur) return { data: null, error: h.erreur }
      const ligne = h.membres.find(m => filtres.every(([c, v]) => (m as Record<string, unknown>)[c] === v))
      return { data: ligne ? { id: 'tm' } : null, error: null }
    }
    return q
  },
} as unknown as SupabaseClient

beforeEach(() => {
  h.membres = []
  h.erreur = null
  h.requetes = []
  h.loggerWarn.mockClear()
  viderCacheDossiersStorage()
})

describe('prefixesStorageCabinet', () => {
  it.each([[null], [undefined], ['']])('sans uploadeur (%s) : seul le dossier du cabinet, sans lecture en base', async (uploadeur) => {
    expect(await prefixesStorageCabinet(sb, CABINET, uploadeur)).toEqual([CABINET])
    expect(h.requetes).toHaveLength(0)
  })

  it('uploadeur = cabinet : seul le dossier du cabinet, sans lecture en base', async () => {
    expect(await prefixesStorageCabinet(sb, CABINET, CABINET)).toEqual([CABINET])
    expect(h.requetes).toHaveLength(0)
  })

  it('uploadeur membre du cabinet : son dossier s’ajoute, lu dans syndic_team_members pour CE cabinet', async () => {
    h.membres = [{ cabinet_id: CABINET, user_id: MEMBRE }]
    expect(await prefixesStorageCabinet(sb, CABINET, MEMBRE)).toEqual([CABINET, MEMBRE])
    expect(h.requetes).toEqual([[['cabinet_id', CABINET], ['user_id', MEMBRE]]])
  })

  it('uploadeur étranger au cabinet (ou membre d’un autre cabinet) : seul le dossier du cabinet', async () => {
    h.membres = [{ cabinet_id: AUTRE_CABINET, user_id: MEMBRE }]
    expect(await prefixesStorageCabinet(sb, CABINET, MEMBRE)).toEqual([CABINET])
    expect(await prefixesStorageCabinet(sb, CABINET, AUTRE_CABINET)).toEqual([CABINET])
  })

  it('l’appartenance est mise en cache par couple cabinet/uploadeur', async () => {
    h.membres = [{ cabinet_id: CABINET, user_id: MEMBRE }]
    await prefixesStorageCabinet(sb, CABINET, MEMBRE)
    await prefixesStorageCabinet(sb, CABINET, MEMBRE)
    expect(h.requetes).toHaveLength(1)
    // Autre cabinet : nouvelle lecture, et le membre du premier n'est pas accepté pour le second
    expect(await prefixesStorageCabinet(sb, AUTRE_CABINET, MEMBRE)).toEqual([AUTRE_CABINET])
    expect(h.requetes).toHaveLength(2)
    viderCacheDossiersStorage()
    await prefixesStorageCabinet(sb, CABINET, MEMBRE)
    expect(h.requetes).toHaveLength(3)
  })

  it('lecture en erreur : refus fermé (dossier du cabinet seul), avertissement journalisé, rien en cache', async () => {
    h.membres = [{ cabinet_id: CABINET, user_id: MEMBRE }]
    h.erreur = { message: 'timeout' }
    expect(await prefixesStorageCabinet(sb, CABINET, MEMBRE)).toEqual([CABINET])
    expect(h.loggerWarn).toHaveBeenCalledWith('[dossiers-storage] lecture syndic_team_members', { message: 'timeout' })
    h.erreur = null
    expect(await prefixesStorageCabinet(sb, CABINET, MEMBRE)).toEqual([CABINET, MEMBRE])
    expect(h.requetes).toHaveLength(2)
  })
})
