import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchMissions, fetchImmeubles, fetchArtisans, fetchCoproprios } from '@/lib/syndic/v54/api'

/** Phase 2 — couche data v54 : fetchers typés sur /api/syndic/* (auth Bearer). */

afterEach(() => { vi.restoreAllMocks() })

describe('syndic v54 — api fetchers (Phase 2)', () => {
  it('fetchMissions : envoie le Bearer token et parse { missions }', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ missions: [{ id: '1' }, { id: '2' }] }), { status: 200 }),
    )
    const res = await fetchMissions('tok123')
    expect(res).toHaveLength(2)
    expect(spy).toHaveBeenCalledWith('/api/syndic/missions', { headers: { Authorization: 'Bearer tok123' } })
  })

  it('fetchImmeubles : retourne [] si la clé est absente', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    expect(await fetchImmeubles('t')).toEqual([])
  })

  it('fetchArtisans : lève si la réponse HTTP est non-ok (ex. 401)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Non autorisé', { status: 401 }))
    await expect(fetchArtisans('t')).rejects.toThrow()
  })

  it('fetchCoproprios : mappe le snake_case Supabase → Coprop (camelCase)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ coproprios: [{
        id: 'x1', immeuble: 'Edifício Aurora', batiment: 'A', etage: 2, numero_porte: '2B',
        nom_proprietaire: 'Silva', prenom_proprietaire: 'Ana', email_proprietaire: 'ana@x.pt',
        tel_proprietaire: '910000000', est_occupe: true,
      }] }), { status: 200 }),
    )
    const res = await fetchCoproprios('tok')
    expect(res[0].proprietario).toBe('Ana Silva')
    expect(res[0].numeroPorte).toBe('2B')
    expect(res[0].ocupado).toBe(true)
  })
})
