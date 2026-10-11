import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchMissions, fetchImmeubles, fetchArtisans, fetchCoproprios, askAgent, type MessageHistorique } from '@/lib/syndic/v54/api'
import { syndicMaxAiSchema } from '@/lib/validation'

/** Phase 2 — couche data v54 : fetchers typés sur /api/syndic/* (auth Bearer). */

afterEach(() => { vi.restoreAllMocks() })

describe('syndic v54 — api fetchers (Phase 2)', () => {
  it('fetchMissions : envoie le Bearer token et parse { missions }', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ missions: [{ id: '1' }, { id: '2' }] }), { status: 200 }),
    )
    const res = await fetchMissions('tok123')
    expect(res).toHaveLength(2)
    expect(spy).toHaveBeenCalledWith('/api/syndic/missions', { headers: { Authorization: 'Bearer tok123' }, cache: 'no-store' })
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

  it('texte de secours d’une IA injoignable (HTTP 200, fallback + error) → rejet, pas une réponse', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ response: '⚠️ Le service IA est temporairement surchargé.', fallback: true, error: 'llm_unreachable' }), { status: 200 }))
    await expect(askAgent('fixy', 'salut', 'tok', 'fr-FR')).rejects.toThrow(/llm_unreachable/)
  })

  it('réponse vide → message de repli dans la langue du dashboard', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 }))
    expect(await askAgent('max', 'oi', 'tok', 'pt-PT')).toBe('Sem resposta.')
    expect(await askAgent('max', 'salut', 'tok', 'fr-FR')).toBe('Pas de réponse.')
  })
})

/**
 * Mémoire de conversation : l'historique affiché par AgentChatPage part sous
 * `conversation_history` (nom lu par les 5 routes), borné à 20 messages de
 * 3000 caractères, sous les limites des schémas serveur (Max : syndicMaxAiSchema).
 */
describe('syndic v54 — askAgent transmet l\'historique de conversation', () => {
  const corpsEnvoye = (spy: { mock: { calls: unknown[][] } }) =>
    JSON.parse(String((spy.mock.calls[0][1] as RequestInit).body)) as Record<string, unknown>
  const repondre = () =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ response: 'ok' }), { status: 200 }))

  it('corps : message, langue et conversation_history (rôles user/assistant)', async () => {
    const spy = repondre()
    const historique: MessageHistorique[] = [
      { role: 'user', content: 'Quel est le délai de convocation ?' },
      { role: 'assistant', content: '**21 jours** avant l’AG.' },
    ]
    await askAgent('fixy', 'Et pour une AG extraordinaire ?', 'tok', 'fr-FR', historique)
    expect(corpsEnvoye(spy)).toEqual({
      message: 'Et pour une AG extraordinaire ?',
      locale: 'fr',
      conversation_history: historique,
    })
  })

  it('garde les 20 derniers messages et tronque chacun à 3000 caractères', async () => {
    const spy = repondre()
    const historique: MessageHistorique[] = Array.from({ length: 30 }, (_, i): MessageHistorique => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i} ` + 'x'.repeat(4000),
    }))
    await askAgent('lea', 'Suite', 'tok', 'fr-FR', historique)
    const envoye = corpsEnvoye(spy).conversation_history as MessageHistorique[]
    expect(envoye).toHaveLength(20)
    expect(envoye[0].content.startsWith('m10 ')).toBe(true)
    expect(envoye[19].content.startsWith('m29 ')).toBe(true)
    expect(envoye.every((m) => m.content.length === 3000)).toBe(true)
  })

  it('ne coupe pas un emoji en deux à la limite de 3000 caractères', async () => {
    const spy = repondre()
    await askAgent('fixy', 'Suite', 'tok', 'fr-FR', [{ role: 'assistant', content: 'a'.repeat(2999) + '😀b' }])
    const [m] = corpsEnvoye(spy).conversation_history as MessageHistorique[]
    // '😀' occupe les unités UTF-16 3000 et 3001 : retiré entier plutôt que coupé.
    expect(m.content).toBe('a'.repeat(2999))
  })

  it('ignore les messages vides ; historique vide → corps inchangé (sans conversation_history)', async () => {
    const spy = repondre()
    await askAgent('tempo', 'Bonjour', 'tok', 'fr-FR', [{ role: 'assistant', content: '   ' }])
    expect(corpsEnvoye(spy)).toEqual({ message: 'Bonjour', locale: 'fr' })
  })

  it('le corps envoyé passe le schéma Zod de Max (le plus strict) même avec un long historique', async () => {
    const spy = repondre()
    const historique: MessageHistorique[] = Array.from({ length: 60 }, (_, i): MessageHistorique => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'y'.repeat(12000),
    }))
    await askAgent('max', 'Qui paie le ravalement ?', 'tok', 'fr-FR', historique)
    expect(spy.mock.calls[0][0]).toBe('/api/syndic/max-ai')
    const verdict = syndicMaxAiSchema.safeParse(corpsEnvoye(spy))
    expect(verdict.success).toBe(true)
  })
})
