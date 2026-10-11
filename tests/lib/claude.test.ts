// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { callClaudeStreaming, callClaudeWithRetry, nettoyerJson, versMessagesClaude } from '@/lib/claude'
import { CLAUDE_MODEL_AGENTS, GROQ_API_URL, GROQ_MODEL_PRIMARY } from '@/lib/constants'
import { logger } from '@/lib/logger'

const URL_ANTHROPIC = 'https://api.anthropic.com/v1/messages'

type Appel = { url: string; init?: RequestInit }
type Ev = Record<string, unknown>

function sse(evenements: Ev[]): string {
  return evenements.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
}

const debut = (): Ev => ({
  type: 'message_start',
  message: {
    id: 'msg_test', type: 'message', role: 'assistant', model: CLAUDE_MODEL_AGENTS, content: [], stop_reason: null,
    usage: { input_tokens: 12, output_tokens: 1, cache_read_input_tokens: 3, cache_creation_input_tokens: 0 },
  },
})
const reflexion = (): Ev[] => [
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_stop', index: 0 },
]
const morceau = (text: string, index = 1): Ev => ({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } })
const fin = (stop_reason = 'end_turn', extra: Ev = {}): Ev[] => [
  { type: 'message_delta', delta: { stop_reason, stop_sequence: null, ...extra }, usage: { output_tokens: 7 } },
  { type: 'message_stop' },
]

/** Réponse complète de l'API en flux : réflexion vide puis texte (découpé en morceaux). */
function flux(...textes: string[]): Response {
  return new Response(sse([debut(), ...reflexion(), ...textes.map(t => morceau(t)), ...fin()]), {
    headers: { 'content-type': 'text/event-stream' },
  })
}

function evenementsBruts(evenements: Ev[]): Response {
  return new Response(sse(evenements), { headers: { 'content-type': 'text/event-stream' } })
}

const erreurHttp = (status: number, type: string, headers: Record<string, string> = {}) =>
  Response.json({ type: 'error', error: { type, message: type } }, { status, headers })

async function lireFlux(f: ReadableStream<Uint8Array>): Promise<string> {
  const reader = f.getReader()
  const decoder = new TextDecoder()
  let sortie = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) return sortie
    sortie += decoder.decode(value)
  }
}

function installerFetch(reponse: (url: string, init?: RequestInit) => Response) {
  const appels: Appel[] = []
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    appels.push({ url, init })
    return reponse(url, init)
  })
  globalThis.fetch = mock as unknown as typeof fetch
  return appels
}

const corps = (appel: Appel): Record<string, unknown> => JSON.parse(String(appel.init?.body))
const entete = (appel: Appel, nom: string): string | null => new Headers(appel.init?.headers).get(nom)
const groqJson = (content: string) => Response.json({ choices: [{ message: { content } }], model: GROQ_MODEL_PRIMARY })
const groqSse = (text: string) => new Response(
  `data: {"choices":[{"delta":{"content":${JSON.stringify(text)}}}]}\n\ndata: [DONE]\n\n`,
  { headers: { 'content-type': 'text/event-stream' } },
)

describe('lib/claude — conversion des messages', () => {
  it('regroupe les messages système de tête et garde l’ordre utilisateur / assistant', () => {
    const { system, messages } = versMessagesClaude([
      { role: 'system', content: 'Tu es Max.' },
      { role: 'system', content: 'Contexte : 12 lots.' },
      { role: 'user', content: 'Bonjour' },
      { role: 'assistant', content: 'Bonjour, que puis-je faire ?' },
      { role: 'user', content: 'Les impayés ?' },
    ])
    expect(system).toBe('Tu es Max.\n\nContexte : 12 lots.')
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant', 'user'])
  })

  it('une consigne système placée après la réponse de l’assistant devient un tour utilisateur', () => {
    const { system, messages } = versMessagesClaude([
      { role: 'system', content: 'Tu es Alfredo.' },
      { role: 'user', content: 'Cherche le mail de M. Durand' },
      { role: 'assistant', content: '##TOOL##{"name":"search_emails"}##' },
      { role: 'system', content: 'Résultat de l’outil : 2 mails. Reformule.' },
    ])
    expect(system).toBe('Tu es Alfredo.')
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(messages[2].content).toBe('Résultat de l’outil : 2 mails. Reformule.')
  })

  it('convertit les images et PDF en base64 et les place avant la consigne', () => {
    const { messages } = versMessagesClaude([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Lis cette facture' },
          { type: 'image_url', image_url: { url: 'data:image/jpg;base64,AAAA' } },
          { type: 'image_url', image_url: { url: 'data:application/pdf;base64,BBBB' } },
        ],
      },
    ])
    expect(messages[0].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'BBBB' } },
      { type: 'text', text: 'Lis cette facture' },
    ])
  })

  it('commence toujours par l’utilisateur et ne finit jamais par l’assistant', () => {
    const { messages } = versMessagesClaude([
      { role: 'assistant', content: 'Bienvenue !' },
      { role: 'user', content: '' },
      { role: 'user', content: 'Question' },
      { role: 'assistant', content: 'Réponse partielle' },
    ])
    expect(messages[0].role).toBe('user')
    expect(messages[messages.length - 1].role).toBe('user')
    expect(messages.filter(m => m.content === '')).toHaveLength(0)
  })
})

describe('lib/claude — nettoyerJson', () => {
  it('retire le bloc de code autour du JSON', () => {
    expect(nettoyerJson('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(nettoyerJson('Voici : {"b":[1,2]} — fin')).toBe('{"b":[1,2]}')
  })
  it('ignore les crochets du texte autour et prend la première valeur JSON valide', () => {
    expect(nettoyerJson('{"categorie":"fuite"}\nRemarque : voir [art. 14].')).toBe('{"categorie":"fuite"}')
    expect(nettoyerJson('Voici le résultat [JSON] : {"a":1}')).toBe('{"a":1}')
    expect(nettoyerJson('```json\n{"a":1}\n```\n```json\n{"b":2}\n```')).toBe('{"a":1}')
    expect(nettoyerJson('{"texte":"accolade } dans une chaîne"} suite')).toBe('{"texte":"accolade } dans une chaîne"}')
  })
  it('laisse une réponse non JSON intacte', () => {
    expect(nettoyerJson('pas de JSON ici')).toBe('pas de JSON ici')
  })
})

describe('lib/claude — callClaudeWithRetry', () => {
  const cleAnthropic = process.env.ANTHROPIC_API_KEY
  const cleGroq = process.env.GROQ_API_KEY
  const cleCerebras = process.env.CEREBRAS_API_KEY
  const fetchOriginal = globalThis.fetch

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    process.env.GROQ_API_KEY = 'gsk-test'
    delete process.env.CEREBRAS_API_KEY
  })

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = cleAnthropic
    process.env.GROQ_API_KEY = cleGroq
    process.env.CEREBRAS_API_KEY = cleCerebras
    globalThis.fetch = fetchOriginal
    vi.restoreAllMocks()
  })

  it('appelle Claude Sonnet 5.5 en flux et renvoie la réponse au format Groq', async () => {
    const appels = installerFetch(() => flux('Il reste ', '3 impayés.'))
    const r = await callClaudeWithRetry({
      messages: [{ role: 'system', content: 'Tu es Max.' }, { role: 'user', content: 'Impayés ?' }],
      temperature: 0.3,
      max_tokens: 800,
    })

    expect(r.choices[0].message.content).toBe('Il reste 3 impayés.')
    expect(r.choices[0].finish_reason).toBe('stop')
    expect(r.model).toBe('claude-sonnet-5-5')
    expect(r.usage).toEqual({ prompt_tokens: 15, completion_tokens: 7, total_tokens: 22 })
    expect(appels).toHaveLength(1)
    expect(appels[0].url).toBe(URL_ANTHROPIC)
    const body = corps(appels[0])
    expect(body.model).toBe('claude-sonnet-5-5')
    expect(body.stream).toBe(true)
    expect(body.temperature).toBeUndefined()
    expect(body.thinking).toEqual({ type: 'adaptive' })
    expect(body.output_config).toEqual({ effort: 'low' })
    expect(body.fallbacks).toBe('default')
    expect(body.max_tokens).toBe(800 + 2048)
    expect(body.system).toEqual([{ type: 'text', text: 'Tu es Max.' }])
    expect(entete(appels[0], 'anthropic-beta')).toBe('server-side-fallback-2026-07-01')
    expect(entete(appels[0], 'anthropic-version')).toBe('2023-06-01')
    expect(entete(appels[0], 'x-api-key')).toBe('sk-ant-test')
  })

  it('cache du prompt système seulement sur demande', async () => {
    const appels = installerFetch(() => flux('ok'))
    const opts = { messages: [{ role: 'system', content: 'x'.repeat(5000) }, { role: 'user', content: 'q' }] }
    await callClaudeWithRetry(opts)
    await callClaudeWithRetry(opts, { cacheSysteme: true })
    expect((corps(appels[0]).system as Array<Record<string, unknown>>)[0].cache_control).toBeUndefined()
    expect((corps(appels[1]).system as Array<Record<string, unknown>>)[0].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('mode JSON : consigne ajoutée et réponse nettoyée', async () => {
    const appels = installerFetch(() => flux('```json\n{"categorie":', '"fuite"}\n```'))
    const r = await callClaudeWithRetry({
      messages: [{ role: 'user', content: 'Classe ce signalement' }],
      response_format: { type: 'json_object' },
    })
    expect(r.choices[0].message.content).toBe('{"categorie":"fuite"}')
    expect((corps(appels[0]).system as Array<{ text: string }>)[0].text).toMatch(/objet JSON valide/)
  })

  it('effort transmis tel que demandé par la route', async () => {
    const appels = installerFetch(() => flux('ok'))
    await callClaudeWithRetry({ messages: [{ role: 'user', content: 'q' }], max_tokens: 1000 }, { effort: 'medium' })
    expect(corps(appels[0]).output_config).toEqual({ effort: 'medium' })
    expect(corps(appels[0]).max_tokens).toBe(1000 + 8192)
  })

  it('sans clé Anthropic : passe directement par Groq', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const appels = installerFetch(() => groqJson('groq'))
    const r = await callClaudeWithRetry({ messages: [{ role: 'user', content: 'q' }] })
    expect(r.choices[0].message.content).toBe('groq')
    expect(appels.every(a => a.url === GROQ_API_URL)).toBe(true)
  })

  it('clé refusée (401) : bascule sur Groq avec la requête d’origine, et alerte Sentry (logger.error)', async () => {
    const erreur = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const appels = installerFetch(url => (url === URL_ANTHROPIC ? erreurHttp(401, 'authentication_error') : groqJson('groq secours')))
    const r = await callClaudeWithRetry({ messages: [{ role: 'user', content: 'q' }], temperature: 0.2 })
    expect(r.choices[0].message.content).toBe('groq secours')
    expect(r.model).toBe(GROQ_MODEL_PRIMARY)
    const groq = appels.find(a => a.url === GROQ_API_URL)
    expect(groq && corps(groq).temperature).toBe(0.2)
    expect(groq && corps(groq).model).toBe('openai/gpt-oss-120b')
    expect(groq && corps(groq).reasoning_effort).toBe('low')
    expect(erreur).toHaveBeenCalledTimes(1)
  })

  it('refus de sécurité : bascule sur Groq (simple avertissement)', async () => {
    const avertissement = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    installerFetch(url =>
      url === URL_ANTHROPIC
        ? evenementsBruts([debut(), ...fin('refusal', { stop_details: { type: 'refusal', category: 'general_harms', explanation: null } })])
        : groqJson('groq secours'),
    )
    const r = await callClaudeWithRetry({ messages: [{ role: 'user', content: 'q' }] })
    expect(r.choices[0].message.content).toBe('groq secours')
    expect(avertissement).toHaveBeenCalled()
  })

  it('surcharge en cours de flux (événement error) : bascule sur Groq', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    installerFetch(url =>
      url === URL_ANTHROPIC
        ? evenementsBruts([debut(), morceau('Déb'), { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }])
        : groqJson('groq secours'),
    )
    const r = await callClaudeWithRetry({ messages: [{ role: 'user', content: 'q' }] })
    expect(r.choices[0].message.content).toBe('groq secours')
  })

  it('surcharge HTTP (529) : un nouvel essai, sans passer par Groq', async () => {
    let n = 0
    const appels = installerFetch(() => (n++ === 0 ? erreurHttp(529, 'overloaded_error', { 'retry-after': '0' }) : flux('après surcharge')))
    const r = await callClaudeWithRetry({ messages: [{ role: 'user', content: 'q' }] })
    expect(r.choices[0].message.content).toBe('après surcharge')
    expect(appels.filter(a => a.url === URL_ANTHROPIC)).toHaveLength(2)
    expect(appels.some(a => a.url === GROQ_API_URL)).toBe(false)
  })

  it('une longue réponse n’est pas coupée par un délai total : seule l’inactivité compte', async () => {
    const encodeur = new TextEncoder()
    const evenements = [debut(), morceau('Un '), morceau('long '), morceau('rapport.'), ...fin()]
    installerFetch(() => new Response(new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const ev of evenements) {
          await new Promise(r => setTimeout(r, 30))
          controller.enqueue(encodeur.encode(sse([ev])))
        }
        controller.close()
      },
    }), { headers: { 'content-type': 'text/event-stream' } }))
    // Délai d'en-têtes très court et inactivité de 100 ms : le flux dure plus de 150 ms au total mais reste actif.
    const r = await callClaudeWithRetry({ messages: [{ role: 'user', content: 'q' }] }, { timeoutMs: 20, inactiviteMs: 100, disableGroqFallback: true })
    expect(r.choices[0].message.content).toBe('Un long rapport.')
  })

  it('flux muet : abandon après le délai d’inactivité puis Groq', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    installerFetch(url =>
      url === URL_ANTHROPIC
        ? new Response(new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(sse([debut()]))) } }), { headers: { 'content-type': 'text/event-stream' } })
        : groqJson('groq secours'),
    )
    const r = await callClaudeWithRetry({ messages: [{ role: 'user', content: 'q' }] }, { inactiviteMs: 50 })
    expect(r.choices[0].message.content).toBe('groq secours')
  })

  it('disableGroqFallback : l’erreur Claude remonte', async () => {
    installerFetch(() => erreurHttp(400, 'invalid_request_error'))
    await expect(
      callClaudeWithRetry({ messages: [{ role: 'user', content: 'q' }] }, { disableGroqFallback: true }),
    ).rejects.toThrow(/Claude 400/)
  })
})

describe('lib/claude — callClaudeStreaming', () => {
  const cleAnthropic = process.env.ANTHROPIC_API_KEY
  const cleGroq = process.env.GROQ_API_KEY
  const fetchOriginal = globalThis.fetch

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    process.env.GROQ_API_KEY = 'gsk-test'
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    vi.spyOn(logger, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = cleAnthropic
    process.env.GROQ_API_KEY = cleGroq
    globalThis.fetch = fetchOriginal
    vi.restoreAllMocks()
  })

  it('restitue le flux Claude au format SSE de Groq', async () => {
    const appels = installerFetch(() => flux('Bonjour', ' Frédéric'))
    const texte = await lireFlux(await callClaudeStreaming({ messages: [{ role: 'user', content: 'Salut' }] }))
    expect(texte).toBe('data: {"text":"Bonjour"}\n\n' + 'data: {"text":" Frédéric"}\n\n' + 'data: [DONE]\n\n')
    expect(corps(appels[0]).stream).toBe(true)
  })

  it('accepte des paquets coupés au milieu d’une ligne', async () => {
    const brut = sse([debut(), morceau('é€'), morceau('ö'), ...fin()])
    const octets = new TextEncoder().encode(brut)
    installerFetch(() => new Response(new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < octets.length; i += 7) c.enqueue(octets.slice(i, i + 7))
        c.close()
      },
    }), { headers: { 'content-type': 'text/event-stream' } }))
    const texte = await lireFlux(await callClaudeStreaming({ messages: [{ role: 'user', content: 'q' }] }))
    expect(texte).toBe('data: {"text":"é€"}\n\ndata: {"text":"ö"}\n\ndata: [DONE]\n\n')
  })

  it('refus avant tout texte : bascule sur le flux Groq', async () => {
    installerFetch(url => (url === URL_ANTHROPIC ? evenementsBruts([debut(), ...fin('refusal')]) : groqSse('groq')))
    const texte = await lireFlux(await callClaudeStreaming({ messages: [{ role: 'user', content: 'q' }] }))
    expect(texte).toBe('data: {"text":"groq"}\n\ndata: [DONE]\n\n')
  })

  it('surcharge avant tout texte (événement error après HTTP 200) : bascule sur le flux Groq', async () => {
    installerFetch(url =>
      url === URL_ANTHROPIC
        ? evenementsBruts([debut(), { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }])
        : groqSse('groq'),
    )
    const texte = await lireFlux(await callClaudeStreaming({ messages: [{ role: 'user', content: 'q' }] }))
    expect(texte).toBe('data: {"text":"groq"}\n\ndata: [DONE]\n\n')
  })

  it('erreur au milieu du flux : texte déjà émis conservé, mention d’interruption, puis fin', async () => {
    installerFetch(() => new Response(
      'event: ping\ndata: {"type":"ping"}\n\n' + sse([debut(), morceau('Début'), { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]),
      { headers: { 'content-type': 'text/event-stream' } },
    ))
    const texte = await lireFlux(await callClaudeStreaming({ messages: [{ role: 'user', content: 'q' }] }))
    expect(texte.startsWith('data: {"text":"Début"}\n\n')).toBe(true)
    expect(texte).toMatch(/interrompue/)
    expect(texte.endsWith('data: [DONE]\n\n')).toBe(true)
  })

  it('refus ou fin sans message_stop après du texte : la réponse est signalée comme incomplète', async () => {
    installerFetch(() => evenementsBruts([debut(), morceau('Partiel'), ...fin('refusal')]))
    expect(await lireFlux(await callClaudeStreaming({ messages: [{ role: 'user', content: 'q' }] }))).toMatch(/Partiel[\s\S]*interrompue/)
    installerFetch(() => evenementsBruts([debut(), morceau('Partiel')]))
    expect(await lireFlux(await callClaudeStreaming({ messages: [{ role: 'user', content: 'q' }] }))).toMatch(/Partiel[\s\S]*interrompue/)
  })

  it('erreur HTTP avant le flux : bascule sur le flux Groq', async () => {
    installerFetch(url => (url === URL_ANTHROPIC ? erreurHttp(404, 'not_found_error') : groqSse('groq')))
    const texte = await lireFlux(await callClaudeStreaming({ messages: [{ role: 'user', content: 'q' }] }))
    expect(texte).toBe('data: {"text":"groq"}\n\ndata: [DONE]\n\n')
  })
})
