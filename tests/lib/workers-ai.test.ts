// @vitest-environment node
// lib/workers-ai.ts : appel d'un modèle de Workers AI par le binding du Worker (simulé ici par getCfEnv), réponse
// rendue au format de lib/groq. Aucun appel réseau.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  run: vi.fn(async (_modele: string, _entrees: unknown, _options?: { signal?: AbortSignal }): Promise<unknown> => ({})),
}))

vi.mock('@/lib/env', () => ({ getCfEnv: vi.fn(async () => h.env), getSecret: vi.fn(async () => '') }))

const { bindingWorkersAI, callWorkersAI } = await import('@/lib/workers-ai')

const GEMMA = '@cf/google/gemma-4-26b-a4b-it'
const MESSAGES = [
  { role: 'system', content: 'Consignes.' },
  { role: 'user', content: 'Parede húmida.' },
]
const APPEL = { modele: GEMMA, messages: MESSAGES, max_tokens: 1000 }

/** Sortie du binding pour Gemma 4 et Qwen 3.8 : un objet chat.completion. */
const chat = (content: unknown, extra: Record<string, unknown> = {}) => ({
  object: 'chat.completion',
  choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
  ...extra,
})

describe('lib/workers-ai', () => {
  beforeEach(() => {
    h.env = { AI: { run: h.run } }
    h.run.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hors Worker, sans binding : ni binding ni appel', async () => {
    h.env = {}
    expect(await bindingWorkersAI()).toBeNull()
    await expect(callWorkersAI(APPEL)).rejects.toMatchObject({ name: 'ErreurWorkersAI', code: null })
    h.env = { AI: { pasDeRun: true } }
    expect(await bindingWorkersAI()).toBeNull()
    expect(h.run).not.toHaveBeenCalled()
  })

  it('appelle le modèle sans réflexion, avec le budget de jetons et un signal d’annulation', async () => {
    h.run.mockResolvedValueOnce(chat('Bom dia.'))
    const reponse = await callWorkersAI(APPEL)
    const [modele, entrees, options] = h.run.mock.calls[0]
    expect(modele).toBe(GEMMA)
    // Sans `json`, pas de mode JSON.
    expect(entrees).toEqual({ messages: MESSAGES, max_completion_tokens: 1000, chat_template_kwargs: { enable_thinking: false } })
    expect(options?.signal).toBeInstanceOf(AbortSignal)
    expect(reponse.choices[0]).toEqual({ message: { content: 'Bom dia.' }, finish_reason: 'stop' })
    expect(reponse.model).toBe(GEMMA)
  })

  it('en JSON : demande le mode JSON et extrait l’objet d’un bloc de code', async () => {
    h.run.mockResolvedValueOnce(chat('Aqui está:\n```json\n{"resume":"ok"}\n```'))
    const reponse = await callWorkersAI({ ...APPEL, json: true })
    expect(h.run.mock.calls[0][1]).toMatchObject({ response_format: { type: 'json_object' } })
    expect(JSON.parse(reponse.choices[0].message.content)).toEqual({ resume: 'ok' })
  })

  it('retire une réflexion écrite dans la réponse, fermée ou coupée par le budget', async () => {
    h.run.mockResolvedValueOnce(chat('<think>A parede…</think>\n{"resume":"ok"}'))
    expect((await callWorkersAI({ ...APPEL, json: true })).choices[0].message.content).toBe('{"resume":"ok"}')
    h.run.mockResolvedValueOnce(chat('<think>A parede tem fissuras e'))
    expect((await callWorkersAI(APPEL)).choices[0].message.content).toBe('')
  })

  it('reprend l’usage, et lit l’ancien format { response }, en texte ou déjà décodé', async () => {
    h.run.mockResolvedValueOnce(chat('{"resume":"ok"}', { usage: { prompt_tokens: 20000, completion_tokens: 800, total_tokens: 20800 } }))
    expect((await callWorkersAI(APPEL)).usage).toEqual({ prompt_tokens: 20000, completion_tokens: 800, total_tokens: 20800 })
    h.run.mockResolvedValueOnce({ response: 'Texto simples.' })
    expect((await callWorkersAI(APPEL)).choices[0].message.content).toBe('Texto simples.')
    h.run.mockResolvedValueOnce({ response: { resume: 'ok' } })
    expect(JSON.parse((await callWorkersAI({ ...APPEL, json: true })).choices[0].message.content)).toEqual({ resume: 'ok' })
  })

  it('rend de quoi vérifier en production que la réflexion est coupée : durée, jetons et texte de réflexion', async () => {
    h.run.mockResolvedValueOnce(chat('{"resume":"ok"}', { usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, completion_tokens_details: { reasoning_tokens: 0 } } }))
    const { diagnostic } = await callWorkersAI(APPEL)
    expect(diagnostic).toEqual({ duree_ms: expect.any(Number), reasoning_tokens: 0, reflexion: 0 })
  })

  it('reprend une réponse rangée comme réflexion quand le contenu est vide', async () => {
    h.run.mockResolvedValueOnce({ choices: [{ message: { content: null, reasoning_content: '{"resume":"ok"}' }, finish_reason: 'stop' }] })
    const reponse = await callWorkersAI({ ...APPEL, json: true })
    expect(JSON.parse(reponse.choices[0].message.content)).toEqual({ resume: 'ok' })
    expect(reponse.diagnostic.reflexion).toBe('{"resume":"ok"}'.length)
  })

  it('retire le canal de réflexion de Gemma 4, fermé ou non', async () => {
    h.run.mockResolvedValueOnce(chat('<|channel>thought\nVer [1] e [2].<channel|>{"resume":"ok"}'))
    expect((await callWorkersAI({ ...APPEL, json: true })).choices[0].message.content).toBe('{"resume":"ok"}')
    h.run.mockResolvedValueOnce(chat('<channel|>{"resume":"ok"}'))
    expect((await callWorkersAI({ ...APPEL, json: true })).choices[0].message.content).toBe('{"resume":"ok"}')
  })

  it('refuse une sortie de forme inattendue (vide, flux, enveloppe REST) au lieu de la lire comme vide', async () => {
    for (const sortie of [null, 'texte', new ReadableStream(), { result: { response: 'x' }, success: true }]) {
      h.run.mockResolvedValueOnce(sortie)
      await expect(callWorkersAI(APPEL), String(sortie)).rejects.toMatchObject({ name: 'ErreurWorkersAI', code: null, message: expect.stringContaining('sortie inattendue') })
    }
  })

  it('lit le code de Cloudflare en tête du message d’erreur, et seulement là', async () => {
    const cas: Array<[string, number | null]> = [
      ['3036: You have used up your daily free allocation of 10,000 neurons.', 3036],
      ['AiError: 5028: This model has been deprecated.', 5028],
      ['InferenceUpstreamError: 3040: Capacity temporarily exceeded', 3040],
      ['Network connection lost.', null],
      ['Les 10,000 neurones 3036 du jour', null],
    ]
    for (const [message, code] of cas) {
      h.run.mockRejectedValueOnce(new Error(message))
      await expect(callWorkersAI(APPEL), message).rejects.toMatchObject({ name: 'ErreurWorkersAI', code, expire: false })
    }
    // Le code n'est écrit qu'une fois dans le message, et une date en tête n'en est pas un.
    h.run.mockRejectedValueOnce(new Error('3040: Capacity temporarily exceeded'))
    await expect(callWorkersAI(APPEL)).rejects.toThrow(/^Workers AI 3040: Capacity temporarily exceeded$/)
    h.run.mockRejectedValueOnce(new Error('2026-11-16 erreur amont'))
    await expect(callWorkersAI(APPEL)).rejects.toMatchObject({ code: null })
  })

  it('abandonne un appel sans réponse au-delà du délai, et l’annule', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    h.run.mockImplementationOnce((_modele, _entrees, options) => {
      signal = options?.signal
      return new Promise(() => {})
    })
    const verdict = expect(callWorkersAI({ ...APPEL, delaiMs: 5_000 })).rejects.toMatchObject({ name: 'ErreurWorkersAI', expire: true })
    await vi.advanceTimersByTimeAsync(5_000)
    await verdict
    expect(signal?.aborted).toBe(true)
  })
})
