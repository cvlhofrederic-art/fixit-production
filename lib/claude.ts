// ── Claude (Anthropic) pour les agents Syndic, Administrateur judiciaire et Copropriétaire ──
//
// Les agents de ces trois espaces tournent sur Claude Sonnet 5.5. Ce module
// garde les mêmes formes d'entrée et de sortie que `lib/groq.ts` (messages au
// format OpenAI, réponse `choices[0].message.content`, flux SSE
// `data: {"text": …}` terminé par `data: [DONE]`) : une route passe de Groq à
// Claude en changeant seulement la fonction appelée.
//
// Appel REST direct (fetch), comme Groq et Cerebras : pas de SDK tiers
// (.claude/rules/ai-agents.md), et rien de plus dans le Worker Cloudflare,
// déjà proche de sa taille maximale.
//
// Les deux fonctions lisent la réponse de l'API en flux (SSE) : le délai porte
// sur l'attente des en-têtes puis sur l'inactivité du flux, jamais sur la durée
// totale d'une longue réponse.
//
// Secours : si ANTHROPIC_API_KEY est absente, ou si Claude échoue avant le
// premier mot de réponse (clé refusée, surcharge, refus de sécurité, flux
// muet…), la requête repart telle quelle sur Groq (puis Cerebras, cf.
// `lib/groq.ts`). Un appel non streamé bascule aussi si le flux casse en cours
// de route (rien n'a encore été rendu à l'appelant).
// Le côté artisan / BTP n'utilise pas ce module : il reste sur Groq.

import { ANTHROPIC_API_URL, CLAUDE_MODEL_AGENTS } from '@/lib/constants'
import { getSecret } from '@/lib/env'
import {
  callGroqStreaming,
  callGroqWithRetry,
  type GroqCallOptions,
  type GroqMessage,
  type GroqResponse,
} from '@/lib/groq'
import { logger } from '@/lib/logger'

type Effort = 'low' | 'medium' | 'high'

/**
 * Les champs `apiKey`, `maxRetries`, `fallbackModel` et
 * `disableCerebrasFallback` sont ceux de `callGroqWithRetry` : ils ne servent
 * qu'au secours Groq, ce qui permet de remplacer l'appel sans rien d'autre.
 */
export interface ClaudeCallConfig {
  /** Profondeur de réflexion. `low` (défaut) : conversation, extraction, classement. */
  effort?: Effort
  /** Pas de bascule vers Groq en cas d'échec de Claude (tests, évaluations). */
  disableGroqFallback?: boolean
  /** Délai d'attente des en-têtes de réponse, en millisecondes (défaut 30 s). */
  timeoutMs?: number
  /** Délai maximal sans aucun octet reçu pendant le flux (défaut 45 s ; l'API envoie des `ping`). */
  inactiviteMs?: number
  /**
   * Met le prompt système en cache (lectures à 10 % du prix, écriture à 125 %).
   * À réserver aux prompts identiques d'une question à l'autre (conversation
   * sur les mêmes données) ; inutile si le prompt change à chaque appel (RAG).
   */
  cacheSysteme?: boolean
  /** Clé Groq du secours (défaut : secret GROQ_API_KEY). */
  apiKey?: string
  maxRetries?: number
  fallbackModel?: string
  disableCerebrasFallback?: boolean
}

const VERSION_API = '2023-06-01'

// Bêta du repli côté serveur : si Claude Sonnet 5.5 décline une demande
// (catégories `cyber`, `frontier_llm`), l'API la rejoue sur le modèle de repli
// prévu par Anthropic dans le même appel.
const BETA_REPLI_SERVEUR = 'server-side-fallback-2026-07-01'

// La réflexion compte dans max_tokens : marge ajoutée au budget de réponse
// demandé par la route (calibré à l'origine pour Llama, sans réflexion).
const MARGE_REFLEXION: Record<Effort, number> = { low: 2_048, medium: 8_192, high: 16_384 }

// Surcharge ou limite de débit : un seul nouvel essai, puis secours Groq.
const STATUTS_REESSAYABLES = new Set([429, 500, 502, 503, 529])

const DELAI_EN_TETES_MS = 30_000
const DELAI_INACTIVITE_MS = 45_000

const CONSIGNE_JSON =
  'Format de sortie : réponds uniquement par un objet JSON valide, sans texte avant ni après et sans bloc de code Markdown.'

const REPONSE_INTERROMPUE = "\n\n_(Réponse interrompue. Réessayez dans un instant.)_"

/** Clé Anthropic : process.env ou contexte Cloudflare (cf. `getSecret`). */
export async function hasAnthropicKey(): Promise<boolean> {
  return !!(await getSecret('ANTHROPIC_API_KEY'))
}

async function configGroq(config: ClaudeCallConfig) {
  return {
    apiKey: config.apiKey || (await getSecret('GROQ_API_KEY')) || undefined,
    maxRetries: config.maxRetries,
    fallbackModel: config.fallbackModel,
    disableCerebrasFallback: config.disableCerebrasFallback,
  }
}

// ── Formes de l'API Messages (sous-ensemble utilisé ici) ─────────────────────

type SourceBase64 = { type: 'base64'; media_type: string; data: string }
type Bloc =
  | { type: 'text'; text: string }
  | { type: 'image'; source: SourceBase64 | { type: 'url'; url: string } }
  | { type: 'document'; source: SourceBase64 }
type MessageClaude = { role: 'user' | 'assistant'; content: string | Bloc[] }

interface Usage {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

/** Événement SSE de l'API Messages (champs utilisés ici). */
interface EvenementClaude {
  type: string
  message?: { model?: string; usage?: Usage }
  delta?: { type?: string; text?: string; stop_reason?: string | null; stop_details?: { category?: string | null } | null }
  usage?: Usage
  error?: { type?: string; message?: string }
}

/** Erreur de l'API Anthropic (HTTP, ou événement `error` dans le flux). */
export class ErreurClaude extends Error {
  constructor(readonly statut: number, detail: string) {
    super(`Claude ${statut}: ${detail.slice(0, 160)}`)
    this.name = 'ErreurClaude'
  }
}

class RefusClaude extends Error {
  constructor(categorie: string | null | undefined) {
    super(`Claude a décliné la demande (${categorie ?? 'catégorie inconnue'})`)
    this.name = 'RefusClaude'
  }
}

// ── Conversion des messages OpenAI → Claude ─────────────────────────────────

const TYPES_IMAGE = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function blocImage(url: string): Bloc | null {
  const data = /^data:([^;,]+);base64,([\s\S]*)$/.exec(url)
  if (data) {
    const type = data[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : data[1].toLowerCase()
    if (type === 'application/pdf') {
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: data[2] } }
    }
    if (TYPES_IMAGE.has(type)) return { type: 'image', source: { type: 'base64', media_type: type, data: data[2] } }
    return null
  }
  if (/^https?:\/\//i.test(url)) return { type: 'image', source: { type: 'url', url } }
  return null
}

function texteDe(content: GroqMessage['content']): string {
  if (typeof content === 'string') return content
  if (!content) return ''
  return content.map(p => (p.type === 'text' && p.text ? p.text : '')).filter(Boolean).join('\n')
}

function blocsUtilisateur(content: GroqMessage['content']): string | Bloc[] {
  if (typeof content === 'string' || !content) return content ?? ''
  const blocs: Bloc[] = []
  for (const part of content) {
    if (part.type === 'text' && part.text?.trim()) blocs.push({ type: 'text', text: part.text })
    else if (part.type === 'image_url' && part.image_url?.url) {
      const bloc = blocImage(part.image_url.url)
      if (bloc) blocs.push(bloc)
    }
  }
  // Claude veut le document ou l'image avant la consigne qui s'y rapporte.
  return [...blocs.filter(b => b.type !== 'text'), ...blocs.filter(b => b.type === 'text')]
}

function estVide(content: string | Bloc[]): boolean {
  return typeof content === 'string' ? !content.trim() : content.length === 0
}

/** Messages au format OpenAI → prompt système + messages Claude. Exporté pour les tests. */
export function versMessagesClaude(messages: GroqMessage[]): { system: string; messages: MessageClaude[] } {
  const systeme: string[] = []
  const sortie: MessageClaude[] = []

  for (const m of messages) {
    if (m.role === 'system' && sortie.length === 0) {
      const t = texteDe(m.content).trim()
      if (t) systeme.push(t)
    } else if (m.role === 'assistant') {
      const t = texteDe(m.content)
      if (t.trim()) sortie.push({ role: 'assistant', content: t })
    } else {
      // 'user', rôle inconnu ('tool' en texte simple) et consigne système
      // insérée en cours de conversation (ex. résultat d'outil d'Alfredo, placé
      // après la réponse de l'assistant : un message système Claude ne peut pas
      // suivre l'assistant, il devient un tour utilisateur).
      const content = blocsUtilisateur(m.content)
      if (!estVide(content)) sortie.push({ role: 'user', content })
    }
  }

  // Claude exige un premier message utilisateur et refuse de compléter un
  // message assistant final (pas de « prefill » sur Sonnet 5.5).
  if (sortie[0]?.role !== 'user') sortie.unshift({ role: 'user', content: '(Début de la conversation.)' })
  if (sortie[sortie.length - 1].role === 'assistant') {
    sortie.push({ role: 'user', content: '(Poursuis la conversation.)' })
  }
  return { system: systeme.join('\n\n'), messages: sortie }
}

function parseOuNull(candidat: string): string | null {
  try {
    JSON.parse(candidat)
    return candidat
  } catch {
    return null
  }
}

/**
 * Extrait l'objet (ou le tableau) JSON d'une réponse : réponse entière, premier
 * bloc ```json, puis la première valeur JSON équilibrée trouvée dans le texte.
 * Réponse non JSON : rendue telle quelle (la route gère son propre repli).
 * Exporté pour les tests.
 */
export function nettoyerJson(texte: string): string {
  const t = texte.trim()
  const entier = parseOuNull(t)
  if (entier !== null) return entier

  const bloc = /```(?:json)?\s*([\s\S]*?)```/i.exec(t)
  const dansBloc = bloc ? parseOuNull(bloc[1].trim()) : null
  if (dansBloc !== null) return dansBloc

  // Première valeur JSON équilibrée (accolades et crochets comptés hors chaînes).
  for (let debut = 0; debut < t.length; debut++) {
    if (t[debut] !== '{' && t[debut] !== '[') continue
    const fin = finValeurEquilibree(t, debut)
    const candidat = fin > debut ? parseOuNull(t.slice(debut, fin + 1)) : null
    if (candidat !== null) return candidat
  }
  return t
}

/** Indice de la fermeture qui équilibre l'ouverture en `debut`, ou -1. */
function finValeurEquilibree(t: string, debut: number): number {
  let profondeur = 0
  let dansChaine = false
  for (let i = debut; i < t.length; i++) {
    const c = t[i]
    if (dansChaine) {
      if (c === '\\') i++
      else if (c === '"') dansChaine = false
    } else if (c === '"') dansChaine = true
    else if (c === '{' || c === '[') profondeur++
    else if ((c === '}' || c === ']') && --profondeur === 0) return i
  }
  return -1
}

function corpsRequete(opts: GroqCallOptions, config: ClaudeCallConfig) {
  const effort = config.effort ?? 'low'
  const { system, messages } = versMessagesClaude(opts.messages)
  const json = opts.response_format?.type === 'json_object' || opts.response_format?.type === 'json_schema'
  const texteSysteme = [system, json ? CONSIGNE_JSON : ''].filter(Boolean).join('\n\n')
  return {
    json,
    corps: {
      model: CLAUDE_MODEL_AGENTS,
      max_tokens: (opts.max_tokens ?? 3000) + MARGE_REFLEXION[effort],
      ...(texteSysteme
        ? {
            system: [{
              type: 'text',
              text: texteSysteme,
              ...(config.cacheSysteme ? { cache_control: { type: 'ephemeral' } } : {}),
            }],
          }
        : {}),
      messages,
      // Sonnet 5.5 refuse une température autre que celle par défaut : on ne
      // transmet pas `opts.temperature` (calibrée pour Llama).
      thinking: { type: 'adaptive' },
      output_config: { effort },
      fallbacks: 'default',
      stream: true,
    },
  }
}

// ── Transport ────────────────────────────────────────────────────────────────

/** POST vers l'API ; un seul nouvel essai sur surcharge / limite de débit. Le délai ne couvre que les en-têtes. */
async function envoyer(apiKey: string, corps: object, delaiEnTetesMs: number): Promise<Response> {
  let derniere: Error | null = null
  for (let essai = 0; essai < 2; essai++) {
    const controleur = new AbortController()
    const minuteur = setTimeout(() => controleur.abort(new Error('Claude: délai de réponse dépassé')), delaiEnTetesMs)
    let res: Response
    try {
      res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': VERSION_API,
          'anthropic-beta': BETA_REPLI_SERVEUR,
        },
        body: JSON.stringify(corps),
        signal: controleur.signal,
      })
    } finally {
      clearTimeout(minuteur)
    }
    if (res.ok && res.body) return res
    const detail = await res.text().catch(() => '')
    derniere = new ErreurClaude(res.status, detail)
    if (!STATUTS_REESSAYABLES.has(res.status) || essai === 1) break
    const retryAfter = Number(res.headers.get('retry-after') ?? Number.NaN)
    const attente = Number.isFinite(retryAfter) ? retryAfter * 1000 : 1_500
    await new Promise(r => setTimeout(r, Math.min(attente, 5_000)))
  }
  throw derniere ?? new Error('Claude: aucune réponse')
}

/** Événements SSE de la réponse ; rejette si aucun octet n'arrive pendant `inactiviteMs`. */
async function* lireEvenements(res: Response, inactiviteMs: number): AsyncGenerator<EvenementClaude> {
  const reader = (res.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let tampon = ''
  const decoder_ligne = (ligne: string): EvenementClaude | null => {
    const l = ligne.trim()
    if (!l.startsWith('data:')) return null
    try {
      return JSON.parse(l.slice(5).trim()) as EvenementClaude
    } catch {
      return null
    }
  }
  try {
    while (true) {
      let minuteur: ReturnType<typeof setTimeout> | undefined
      const delai = new Promise<never>((_, rejeter) => {
        minuteur = setTimeout(() => rejeter(new Error('Claude: flux inactif')), inactiviteMs)
      })
      const lecture = await Promise.race([reader.read(), delai]).finally(() => clearTimeout(minuteur))
      if (lecture.done) break
      tampon += decoder.decode(lecture.value, { stream: true })
      const lignes = tampon.split('\n')
      tampon = lignes.pop() ?? ''
      for (const ligne of lignes) {
        const ev = decoder_ligne(ligne)
        if (ev) yield ev
      }
    }
    const ev = decoder_ligne(tampon)
    if (ev) yield ev
  } finally {
    reader.cancel().catch(() => { /* flux déjà fermé */ })
  }
}

function finishReason(stop: string | null | undefined): string {
  if (stop === 'max_tokens') return 'length'
  if (stop === 'tool_use') return 'tool_calls'
  return 'stop'
}

function descriptionErreur(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 200)
}

/**
 * Trace d'une bascule vers Groq. Les erreurs de configuration (clé refusée,
 * modèle inconnu, requête invalide) partent dans Sentry : sinon la démo
 * tournerait sur Llama sans que personne ne le voie. Surcharge et refus : avertissement.
 */
function signalerBascule(contexte: string, err: unknown) {
  const configuration = err instanceof ErreurClaude && !STATUTS_REESSAYABLES.has(err.statut)
  journaliser(() => {
    if (configuration) logger.error(`[claude] ${contexte} : requête refusée par l’API, bascule sur Groq`, { statut: (err as ErreurClaude).statut }, err)
    else logger.warn(`[claude] ${contexte} : bascule sur Groq`, { erreur: descriptionErreur(err) })
  })
}

/** La journalisation (Sentry) ne doit jamais faire échouer la réponse de l’agent. */
function journaliser(ecrire: () => void) {
  try {
    ecrire()
  } catch (e) {
    console.warn("[claude] journalisation impossible", e)
  }
}

let cleAbsenteSignalee = false

/** Clé absente : les agents tournent sur Llama. Signalé une fois par instance du Worker (Sentry). */
function signalerCleAbsente() {
  if (cleAbsenteSignalee) return
  cleAbsenteSignalee = true
  journaliser(() => logger.error('[claude] ANTHROPIC_API_KEY absente : agents Syndic / Administrateur judiciaire / Copropriétaire sur Groq', {}, new Error('ANTHROPIC_API_KEY absente')))
}

// ── Appel non streamé ────────────────────────────────────────────────────────

async function appelClaude(apiKey: string, opts: GroqCallOptions, config: ClaudeCallConfig): Promise<GroqResponse> {
  const { json, corps } = corpsRequete(opts, config)
  const res = await envoyer(apiKey, corps, config.timeoutMs ?? DELAI_EN_TETES_MS)
  let texte = ''
  let modele: string = CLAUDE_MODEL_AGENTS
  let stop: string | null | undefined = null
  let categorieRefus: string | null | undefined = null
  let entree = 0
  let sortie = 0
  let termine = false
  for await (const ev of lireEvenements(res, config.inactiviteMs ?? DELAI_INACTIVITE_MS)) {
    if (ev.type === 'message_start') {
      modele = ev.message?.model ?? modele
      const u = ev.message?.usage ?? {}
      entree = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
    } else if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
      texte += ev.delta.text ?? ''
    } else if (ev.type === 'message_delta') {
      stop = ev.delta?.stop_reason ?? stop
      categorieRefus = ev.delta?.stop_details?.category ?? categorieRefus
      sortie = ev.usage?.output_tokens ?? sortie
    } else if (ev.type === 'error') {
      throw new ErreurClaude(ev.error?.type === 'overloaded_error' ? 529 : 500, ev.error?.message ?? 'erreur dans le flux')
    } else if (ev.type === 'message_stop') {
      termine = true
    }
  }
  if (stop === 'refusal') throw new RefusClaude(categorieRefus)
  if (!termine) throw new Error('Claude: flux interrompu avant la fin')
  return {
    choices: [{ message: { content: json ? nettoyerJson(texte) : texte }, finish_reason: finishReason(stop) }],
    usage: { prompt_tokens: entree, completion_tokens: sortie, total_tokens: entree + sortie },
    model: modele,
  }
}

/**
 * Appel non streamé : même signature et même réponse que `callGroqWithRetry`
 * (`model` indique le modèle qui a réellement répondu : Claude ou Llama).
 * Claude Sonnet 5.5 si la clé est configurée, sinon (ou en cas d'échec) Groq.
 */
export async function callClaudeWithRetry(
  opts: GroqCallOptions,
  config: ClaudeCallConfig = {},
): Promise<GroqResponse> {
  const apiKey = await getSecret('ANTHROPIC_API_KEY')
  if (!apiKey) {
    if (config.disableGroqFallback) throw new Error('ANTHROPIC_API_KEY not configured')
    signalerCleAbsente()
    return callGroqWithRetry(opts, await configGroq(config))
  }
  try {
    return await appelClaude(apiKey, opts, config)
  } catch (err) {
    if (config.disableGroqFallback) throw err
    signalerBascule('appel', err)
    return callGroqWithRetry(opts, await configGroq(config))
  }
}

// ── Streaming ────────────────────────────────────────────────────────────────

/**
 * Appel streamé : même flux SSE que `callGroqStreaming`
 * (`data: {"text": "…"}` puis `data: [DONE]`).
 *
 * La fonction ne rend le flux qu'une fois le premier mot de Claude reçu : avant,
 * toute défaillance (HTTP, surcharge, refus, flux muet) bascule sur le flux
 * Groq. Après, on ne change plus de fournisseur ; une coupure ajoute une
 * mention « Réponse interrompue ».
 */
export async function callClaudeStreaming(
  opts: GroqCallOptions,
  config: ClaudeCallConfig = {},
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = await getSecret('ANTHROPIC_API_KEY')
  if (!apiKey) {
    if (config.disableGroqFallback) throw new Error('ANTHROPIC_API_KEY not configured')
    signalerCleAbsente()
    return callGroqStreaming(opts, await configGroq(config))
  }

  let evenements: AsyncGenerator<EvenementClaude>
  let premierTexte: string
  try {
    const { corps } = corpsRequete(opts, config)
    const res = await envoyer(apiKey, corps, config.timeoutMs ?? DELAI_EN_TETES_MS)
    evenements = lireEvenements(res, config.inactiviteMs ?? DELAI_INACTIVITE_MS)
    premierTexte = await attendrePremierTexte(evenements)
  } catch (err) {
    if (config.disableGroqFallback) throw err
    signalerBascule('flux', err)
    return callGroqStreaming(opts, await configGroq(config))
  }

  const encoder = new TextEncoder()
  const evenement = (data: string) => encoder.encode(`data: ${data}\n\n`)
  const texte = (t: string) => evenement(JSON.stringify({ text: t }))
  let premierEnvoye = false
  let stopRecu = false
  let termine = false

  const terminer = (controller: ReadableStreamDefaultController<Uint8Array>, mention?: string) => {
    if (termine) return
    termine = true
    if (mention) controller.enqueue(texte(mention))
    controller.enqueue(evenement('[DONE]'))
    controller.close()
    evenements.return(undefined).catch(() => { /* flux déjà fermé */ })
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!premierEnvoye) {
        premierEnvoye = true
        controller.enqueue(texte(premierTexte))
        return
      }
      try {
        while (!termine) {
          const { done, value: ev } = await evenements.next()
          if (done) {
            // Fin sans `message_stop` : réponse incomplète, on le dit.
            terminer(controller, stopRecu ? undefined : REPONSE_INTERROMPUE)
            return
          }
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
            controller.enqueue(texte(ev.delta.text))
            return
          }
          if (ev.type === 'message_delta' && ev.delta?.stop_reason === 'refusal') {
            terminer(controller, REPONSE_INTERROMPUE)
            return
          }
          if (ev.type === 'error') {
            logger.error('[claude] erreur dans le flux', { erreur: ev.error?.message?.slice(0, 200) })
            terminer(controller, REPONSE_INTERROMPUE)
            return
          }
          if (ev.type === 'message_stop') {
            stopRecu = true
            terminer(controller)
            return
          }
        }
      } catch (err) {
        logger.error('[claude] flux interrompu', { erreur: descriptionErreur(err) }, err)
        terminer(controller, REPONSE_INTERROMPUE)
      }
    },
    cancel() {
      termine = true
      evenements.return(undefined).catch(() => { /* client parti */ })
    },
  })
}

/** Lit le flux jusqu'au premier mot de réponse ; rejette sur erreur, refus ou fin sans texte. */
async function attendrePremierTexte(evenements: AsyncGenerator<EvenementClaude>): Promise<string> {
  while (true) {
    const { done, value: ev } = await evenements.next()
    if (done) throw new Error('Claude: flux terminé sans réponse')
    if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) return ev.delta.text
    if (ev.type === 'message_delta' && ev.delta?.stop_reason === 'refusal') {
      await evenements.return(undefined).catch(() => undefined)
      throw new RefusClaude(ev.delta.stop_details?.category)
    }
    if (ev.type === 'error') {
      await evenements.return(undefined).catch(() => undefined)
      throw new ErreurClaude(ev.error?.type === 'overloaded_error' ? 529 : 500, ev.error?.message ?? 'erreur dans le flux')
    }
    if (ev.type === 'message_stop') throw new Error('Claude: flux terminé sans réponse')
  }
}

