// lib/workers-ai.ts
//
// Génération de texte par Cloudflare Workers AI, à travers le binding « AI » du Worker (wrangler.toml, section [ai]) :
// ni clé, ni SDK, ni dépendance, le binding est fourni par le runtime et le Worker ne grossit pas. Entrées et sortie
// au format de lib/groq (messages OpenAI, réponse `choices`) : une route passe d'un fournisseur à l'autre sans changer
// ses consignes ni sa relecture.
//
// Modèles visés : ceux qui parlent le format « chat completions » de Workers AI (Gemma 4, Qwen 3.8…), photos comprises
// en parties image_url (data URL). La réflexion, active par défaut chez ces modèles, est coupée
// (chat_template_kwargs.enable_thinking) : elle ralentit la réponse et se paie en jetons de sortie.
//
// Coût : 10 000 neurones gratuits par jour pour tout le compte Cloudflare (embeddings du syndic compris), remis à zéro
// à 00:00 UTC ; au-delà, facturé sur l'offre Workers Paid (refusé, code 3036, sur l'offre Free). Données : Cloudflare
// ne conserve pas les contenus et ne s'en sert pas pour entraîner ses modèles (page « Data usage », 16/10/2026).
//
// Hors d'un Worker (next dev, tests, scripts), pas de binding : `bindingWorkersAI` rend null.

import { getCfEnv } from '@/lib/env'
import { nettoyerJson } from '@/lib/claude'
import type { GroqMessage, GroqResponse } from '@/lib/groq'

/** Ce que ce module utilise du binding : `run(modèle, entrées, options)`. */
interface BindingAI {
  run(modele: string, entrees: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>
}

/** Délai d'un appel, au-delà duquel il est abandonné : une analyse lit environ 20 000 jetons de consignes. */
const DELAI_DEFAUT_MS = 60_000

/** Code de Cloudflare en tête d'un message d'erreur du binding : « 3040: Capacity… », « InferenceUpstreamError: 5006: … ». */
const PREFIXE_CODE = /^\s*(?:\w*Error:\s*)?(\d{4}):\s*/

/**
 * Erreur de Workers AI, avec le code interne de Cloudflare quand le message en porte un en tête (3036 : quota gratuit
 * épuisé sur l'offre Free ; 3040 : capacité dépassée ; 3006 : requête trop grosse ; 5028 : modèle retiré…).
 * `expire` : pas de réponse dans le délai.
 */
export class ErreurWorkersAI extends Error {
  constructor(
    readonly code: number | null,
    detail: string,
    readonly expire = false,
  ) {
    super(`Workers AI${code === null ? '' : ` ${code}`}: ${detail.slice(0, 200)}`)
    this.name = 'ErreurWorkersAI'
  }
}

/** Erreur levée par le binding → ErreurWorkersAI, son code relevé et retiré du texte (pas de « 3040: 3040: »). */
function versErreur(err: unknown): ErreurWorkersAI {
  if (err instanceof ErreurWorkersAI) return err
  const message = err instanceof Error ? err.message : String(err)
  const code = PREFIXE_CODE.exec(message)
  return code ? new ErreurWorkersAI(Number(code[1]), message.slice(code[0].length)) : new ErreurWorkersAI(null, message)
}

/** Binding Workers AI du Worker, ou null hors Worker. */
export async function bindingWorkersAI(): Promise<BindingAI | null> {
  const env: Record<string, unknown> = await getCfEnv()
  const ai = env.AI as Partial<BindingAI> | undefined
  return ai && typeof ai.run === 'function' ? (ai as BindingAI) : null
}

export interface AppelWorkersAI {
  /** Identifiant Workers AI du modèle (« @cf/google/gemma-4-26b-a4b-it »). */
  modele: string
  messages: GroqMessage[]
  /** Budget de la réponse, en jetons. */
  max_tokens: number
  /** Réponse attendue en un objet JSON : mode JSON de Workers AI, puis nettoyage du texte rendu. */
  json?: boolean
  delaiMs?: number
}

/** Réponse au format de lib/groq, avec de quoi vérifier en production que la réflexion est bien coupée. */
export interface ReponseWorkersAI extends GroqResponse {
  diagnostic: {
    duree_ms: number
    /** Jetons de réflexion facturés (0 attendu). */
    reasoning_tokens?: number
    /** Longueur d'une réflexion rendue à part (reasoning_content), 0 attendu. */
    reflexion: number
  }
}

interface MessageChat {
  content?: unknown
  reasoning_content?: unknown
  reasoning?: unknown
}

interface SortieChat {
  choices?: Array<{ message?: MessageChat; finish_reason?: string }>
  /** Format des anciens modèles de Workers AI, texte ou objet déjà décodé. */
  response?: unknown
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    completion_tokens_details?: { reasoning_tokens?: number }
  }
}

/**
 * Réflexion écrite dans la réponse malgré la consigne, fermée ou coupée par le budget : balises <think> (Qwen) ou canal
 * de réflexion de Gemma 4 (<|channel>thought…<channel|>), retirées avant la lecture.
 */
function sansReflexion(texte: string): string {
  return texte
    .replace(/<\|channel>thought[\s\S]*?(?:<channel\|>|$)|<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/^\s*<channel\|>/i, '')
    .trim()
}

function texteDe(valeur: unknown): string {
  if (typeof valeur === 'string') return valeur
  return valeur && typeof valeur === 'object' ? JSON.stringify(valeur) : ''
}

/** Une sortie de chat (choices) ou de l'ancien format (response) ; sinon un flux, une enveloppe REST, rien… */
function sortieLisible(brut: unknown): brut is SortieChat {
  if (!brut || typeof brut !== 'object') return false
  return Array.isArray((brut as SortieChat).choices) || 'response' in brut
}

/**
 * Texte de la réponse. Si `content` est vide, la réponse a pu être rangée comme réflexion (reasoning_content) par
 * l'analyseur de Cloudflare : elle est reprise, la relecture de la route la validera.
 */
function texteDeLaSortie(sortie: SortieChat): string {
  const message = sortie.choices?.[0]?.message
  if (!message) return sansReflexion(texteDe(sortie.response))
  const contenu = sansReflexion(texteDe(message.content))
  return contenu || sansReflexion(texteDe(message.reasoning_content ?? message.reasoning))
}

/** Sortie du binding → réponse au format de lib/groq ; une sortie de forme inattendue est une erreur, pas un vide. */
function versReponse(brut: unknown, appel: AppelWorkersAI, duree_ms: number): ReponseWorkersAI {
  if (!sortieLisible(brut)) {
    const forme = brut && typeof brut === 'object' ? Object.keys(brut).slice(0, 5).join(', ') || brut.constructor?.name : typeof brut
    throw new ErreurWorkersAI(null, `sortie inattendue (${forme})`)
  }
  const texte = texteDeLaSortie(brut)
  const message = brut.choices?.[0]?.message
  const u = brut.usage
  return {
    choices: [{ message: { content: appel.json ? nettoyerJson(texte) : texte }, finish_reason: brut.choices?.[0]?.finish_reason }],
    ...(u
      ? { usage: { prompt_tokens: u.prompt_tokens ?? 0, completion_tokens: u.completion_tokens ?? 0, total_tokens: u.total_tokens ?? 0 } }
      : {}),
    model: appel.modele,
    diagnostic: {
      duree_ms,
      reasoning_tokens: u?.completion_tokens_details?.reasoning_tokens,
      reflexion: texteDe(message?.reasoning_content ?? message?.reasoning).length,
    },
  }
}

/**
 * Appel d'un modèle de Workers AI au format de lib/groq. Lève `ErreurWorkersAI` hors Worker, sur un refus du binding,
 * sur une sortie de forme inattendue ou au-delà du délai (l'appel est alors annulé).
 */
export async function callWorkersAI(appel: AppelWorkersAI): Promise<ReponseWorkersAI> {
  const ai = await bindingWorkersAI()
  if (!ai) throw new ErreurWorkersAI(null, 'binding AI absent (hors Worker)')
  const delai = appel.delaiMs ?? DELAI_DEFAUT_MS
  const controleur = new AbortController()
  let minuterie: ReturnType<typeof setTimeout> | undefined
  const expiration = new Promise<never>((_, rejeter) => {
    minuterie = setTimeout(() => {
      controleur.abort()
      rejeter(new ErreurWorkersAI(null, `pas de réponse en ${Math.round(delai / 1000)} s`, true))
    }, delai)
  })
  const debut = Date.now()
  try {
    const brut = await Promise.race([
      ai.run(
        appel.modele,
        {
          messages: appel.messages,
          max_completion_tokens: appel.max_tokens,
          chat_template_kwargs: { enable_thinking: false },
          ...(appel.json ? { response_format: { type: 'json_object' } } : {}),
        },
        { signal: controleur.signal },
      ),
      expiration,
    ])
    return versReponse(brut, appel, Date.now() - debut)
  } catch (err) {
    throw versErreur(err)
  } finally {
    clearTimeout(minuterie)
  }
}
