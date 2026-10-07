import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchMissions, fetchImmeubles, fetchArtisans, fetchCoproprios, askAgent } from '@/lib/syndic/v54/api'

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

  it('askAgent : POST le bon endpoint et lit la clé `response`', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ response: 'Olá!' }), { status: 200 }))
    const r = await askAgent('fixy', 'oi', 'tok')
    expect(r).toBe('Olá!')
    expect(spy).toHaveBeenCalledWith('/api/syndic/fixy-syndic', expect.objectContaining({ method: 'POST' }))
  })

  it('askAgent : lit la clé `content` (alfredo)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: 'Email tratado' }), { status: 200 }))
    expect(await askAgent('alfredo', 'oi', 'tok')).toBe('Email tratado')
  })
})

/**
 * Langue transmise aux agents : les routes prennent le français quand `locale`
 * manque, donc la version PT doit envoyer 'pt' (avant correctif : corps sans
 * langue → réponses en français sur /pt/syndic/v54).
 */
describe('syndic v54 — askAgent transmet la langue du dashboard', () => {
  const AGENTS = [
    ['fixy', '/api/syndic/fixy-syndic'],
    ['max', '/api/syndic/max-ai'],
    ['lea', '/api/syndic/lea-comptable'],
    ['alfredo', '/api/syndic/alfredo-chat'],
    ['tempo', '/api/syndic/tempo-ai'],
  ] as const

  const corpsEnvoye = (spy: { mock: { calls: unknown[][] } }) =>
    JSON.parse(String((spy.mock.calls[0][1] as RequestInit).body)) as Record<string, unknown>

  it.each(AGENTS)('%s : version PT (pt-PT) → locale « pt »', async (route, endpoint) => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ response: 'ok', content: 'ok' }), { status: 200 }))
    await askAgent(route, 'Olá', 'tok', 'pt-PT')
    expect(spy.mock.calls[0][0]).toBe(endpoint)
    expect(corpsEnvoye(spy)).toEqual({ message: 'Olá', locale: 'pt' })
  })

  it.each(AGENTS)('%s : version FR (fr-FR) → locale « fr »', async (route, endpoint) => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ response: 'ok', content: 'ok' }), { status: 200 }))
    await askAgent(route, 'Bonjour', 'tok', 'fr-FR')
    expect(spy.mock.calls[0][0]).toBe(endpoint)
    expect(corpsEnvoye(spy)).toEqual({ message: 'Bonjour', locale: 'fr' })
  })

  it('sans langue fournie → portugais, langue par défaut du dashboard', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ response: 'ok' }), { status: 200 }))
    await askAgent('fixy', 'oi', 'tok')
    expect(corpsEnvoye(spy)).toEqual({ message: 'oi', locale: 'pt' })
  })

  it('réponse vide → message de repli dans la langue du dashboard', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 }))
    expect(await askAgent('max', 'oi', 'tok', 'pt-PT')).toBe('Sem resposta.')
    expect(await askAgent('max', 'salut', 'tok', 'fr-FR')).toBe('Pas de réponse.')
  })
})
