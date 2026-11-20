// tests/lib/langfuse-metadonnees-seules.test.ts
//
// Option « metadonneesSeules » de traceAgent (agents et outils IA du module Administrateur judiciaire) : la trace
// Langfuse ne reçoit ni la question, ni la réponse, ni le texte d'une erreur ; seulement des métadonnées (jetons,
// modèle, latence, statut, type d'erreur). Sans l'option, les traces des autres agents ne changent pas.
// Le SDK Langfuse est simulé ; aucun appel réseau.

import { describe, it, expect, vi, beforeEach } from 'vitest'

type CorpsTrace = { input?: unknown; output?: unknown; metadata?: Record<string, unknown> }

const h = vi.hoisted(() => ({
  trace: vi.fn((_corps: CorpsTrace) => ({ update: vi.fn() })),
}))

vi.mock('langfuse', () => ({
  Langfuse: class {
    trace = h.trace
  },
}))

const { traceAgent } = await import('@/lib/langfuse')

/** Erreur d'un fournisseur d'IA dont le texte recopie une partie de la demande (cas à ne pas tracer). */
class ErreurFournisseur extends Error {
  constructor(readonly statut: number, detail: string) {
    super(`Claude ${statut}: ${detail}`)
    this.name = 'ErreurClaude'
  }
}

const QUESTION = 'Le RIB de M. Durand : FR76 3000 6000 0112 3456 7890 189, il doit 9 200 €. Écrire à durand@exemple.fr'
const REPONSE = {
  choices: [{ message: { content: 'M. Durand doit 9 200 € (RIB FR76 3000 6000 0112 3456 7890 189).' } }],
  usage: { prompt_tokens: 1200, completion_tokens: 80, total_tokens: 1280 },
  model: 'claude-sonnet-5-5',
}
const DONNEES_PERSONNELLES = /Durand|FR76|9 200|exemple\.fr/

const derniereTrace = (): CorpsTrace => h.trace.mock.calls.at(-1)?.[0] ?? {}

describe('traceAgent — option metadonneesSeules', () => {
  beforeEach(() => {
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-test')
    vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-test')
    h.trace.mockClear()
  })

  it('sans l’option, la question et le texte de l’erreur partent comme avant (autres agents inchangés)', async () => {
    await traceAgent({ agent_id: 'fixy', user_id: 'u1', prompt: 'Bonjour, écrire à a@b.fr' }, async () => 'ok')
    expect(derniereTrace().input).toBe('Bonjour, écrire à [email]')

    await expect(traceAgent({ agent_id: 'fixy', user_id: 'u1' }, async () => { throw new Error('Groq 500: panne') })).rejects.toThrow()
    expect(derniereTrace().metadata?.error).toBe('Groq 500: panne')
  })

  it('avec l’option, ni question ni réponse : seulement les métadonnées, les jetons et le modèle', async () => {
    const resultat = await traceAgent(
      {
        agent_id: 'aj-lea',
        user_id: 'u1',
        prompt: QUESTION,
        response: REPONSE.choices[0].message.content,
        metadonneesSeules: true,
        metadata: { succursale: 'administrateur-judiciaire', longueurQuestion: QUESTION.length },
      },
      async () => REPONSE,
    )
    expect(resultat).toBe(REPONSE)

    const trace = derniereTrace()
    expect(trace.input).toBeUndefined()
    expect(trace.output).toBeUndefined()
    expect(trace.metadata).toMatchObject({
      succursale: 'administrateur-judiciaire',
      longueurQuestion: QUESTION.length,
      success: true,
      modele: 'claude-sonnet-5-5',
      jetons: { entree: 1200, sortie: 80, total: 1280 },
    })
    expect(typeof trace.metadata?.latency_ms).toBe('number')
    expect(JSON.stringify(h.trace.mock.calls)).not.toMatch(DONNEES_PERSONNELLES)
  })

  it('avec l’option, une erreur n’est tracée que par son type et son statut HTTP, jamais par son texte', async () => {
    await expect(
      traceAgent(
        { agent_id: 'aj-fixy', user_id: 'u1', metadonneesSeules: true },
        async () => { throw new ErreurFournisseur(400, `contenu refusé : « ${QUESTION} »`) },
      ),
    ).rejects.toThrow(ErreurFournisseur)
    expect(derniereTrace().metadata).toMatchObject({ success: false, error: 'ErreurClaude 400' })

    await expect(
      traceAgent({ agent_id: 'aj-fixy', user_id: 'u1', metadonneesSeules: true }, async () => { throw new Error(QUESTION) }),
    ).rejects.toThrow()
    expect(derniereTrace().metadata).toMatchObject({ success: false, error: 'Error' })
    expect(JSON.stringify(h.trace.mock.calls)).not.toMatch(DONNEES_PERSONNELLES)
  })

  it('avec l’option, un résultat sans jetons ni modèle ne casse pas la trace', async () => {
    expect(await traceAgent({ agent_id: 'aj-tempo', user_id: 'u1', metadonneesSeules: true }, async () => 'texte libre')).toBe('texte libre')
    const metadata = derniereTrace().metadata
    expect(metadata?.success).toBe(true)
    expect(metadata?.jetons).toBeUndefined()
    expect(metadata?.modele).toBeUndefined()
  })
})
