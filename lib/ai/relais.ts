// ── Agents artisan / BTP : Groq d'abord, Workers AI en relais ; lecture des documents ──
//
// Constat des 14-15/11/2026 : Groq a retiré les modèles Llama de ses offres gratuite et développeur (16/08/2026,
// 17/07/2026 pour la vision) et le secours Cerebras nommait un modèle retiré lui aussi. Tous les agents qui en
// dépendaient répondaient en erreur, sans que personne ne le voie pendant trois mois. Ce module évite qu'un retrait
// de modèle ou la panne d'un fournisseur coupe de nouveau un agent, et le signale :
// - texte : Groq (lib/groq.ts : modèle principal, puis son repli), puis Workers AI (lib/workers-ai.ts, binding du
//   Worker : Gemma 4, puis Qwen 3.8) si Groq échoue ou rend une réponse vide ; en flux, la réponse de Workers AI
//   arrive d'un bloc. Une seule échéance pour toute la chaîne : Groq n'en prend que la moitié quand le relais est
//   possible, Workers AI le reste ;
// - documents (pièce d'identité, Kbis, ticket de caisse, facture fournisseur) : images lues par Workers AI ; PDF lus
//   par leur couche de texte (unpdf), sans modèle. Groq n'a plus de modèle de vision hors préversion, et Groq demande
//   de ne pas utiliser ses préversions en production ;
// - pannes durables (clé refusée, modèle retiré, sortie inattendue) : Sentry (logger.error, module « ia-relais ») ;
//   pannes passagères (quota, capacité, délai) : simple avertissement.
// Ni Cerebras ni Claude ici : ce ne sont pas des sous-traitants déclarés, et la clé Anthropic est refusée en
// production depuis le 15/11/2026. Cloudflare l'est déjà (hébergement). Workers AI est gratuit dans la limite de
// 10 000 neurones par jour pour le compte, facturé au-delà : une demande trop longue n'est pas relayée, et un document
// est borné en poids, en type et en nombre de pages avant tout appel.
// Messages au client : à la charge des routes, sans nom de fournisseur, de modèle ni de clé.

import { GROQ_MODEL_PRIMARY, WORKERS_AI_MODELES } from '@/lib/constants'
import { callGroqStreaming, callGroqWithRetry, type GroqCallOptions, type GroqMessage, type GroqResponse } from '@/lib/groq'
import { bindingWorkersAI, callWorkersAI, ErreurWorkersAI } from '@/lib/workers-ai'
import { getSecret } from '@/lib/env'
import { logger } from '@/lib/logger'

export interface ConfigRelais {
  /** Route ou agent appelant, pour les journaux. */
  contexte: string
  /**
   * Nouveaux essais Groq après un 429 (cf. `callGroqWithRetry`). Par défaut : aucun quand Workers AI peut prendre le
   * relais (attendre le quota de Groq faisait abandonner l'écran avant le relais), 2 sinon.
   */
  maxRetries?: number
  fallbackModel?: string
  /** Temps total de l'appel, Groq et relais compris (défaut : `BUDGET_MS`). */
  budgetMs?: number
}

export interface ConfigVision {
  /** Route ou agent appelant, pour les journaux. */
  contexte: string
  /** Temps laissé à Workers AI, ses deux modèles compris (défaut : `BUDGET_MS`). */
  budgetMs?: number
  /** Poids maximal de chaque document, décodé (défaut : `MAX_OCTETS_DOCUMENT`). */
  maxOctets?: number
  /** PDF admis (défaut : non, images seulement). Un PDF est lu par sa couche de texte, sans modèle. */
  pdf?: boolean
  /** Pages au plus par PDF admis (défaut : `MAX_PAGES_PDF`). */
  maxPagesPdf?: number
}

export interface FluxIA {
  /** Flux SSE `data: {"text": …}` terminé par `data: [DONE]`, identique pour chaque fournisseur. */
  flux: ReadableStream<Uint8Array>
  /** Modèle qui a répondu : le modèle Groq principal, son repli, ou celui de Workers AI. */
  modele: string
}

/**
 * Taille, en caractères, au-delà de laquelle une demande n'est pas relayée à Workers AI (de l'ordre de 40 000
 * jetons) : borne la part du quota du compte qu'une seule demande consomme. Les routes n'imposent pas toutes une
 * longueur maximale à ce qu'elles reçoivent.
 */
export const PLAFOND_RELAIS_CARACTERES = 150_000

/** Temps total par défaut d'un appel (Groq et relais) : l'écran de Fixy AI abandonne au bout de 30 s. */
export const BUDGET_MS = 28_000

/** Un modèle de Workers AI n'est lancé qu'avec au moins ce temps devant lui. */
const DELAI_MIN_WORKERS_AI_MS = 8_000

/** Poids maximal d'un document envoyé à un modèle, décodé. */
export const MAX_OCTETS_DOCUMENT = 5 * 1024 * 1024

/** Pages au plus d'un PDF, sauf limite plus basse donnée par la route. */
export const MAX_PAGES_PDF = 10

/** Caractères (hors blancs) au-dessous desquels un PDF est tenu pour scanné, sans couche de texte. */
const MIN_CARACTERES_PDF = 50

/** Quota gratuit du compte épuisé (offre Free) et requête trop grosse : valent pour tous les modèles de Workers AI. */
const CODES_COMMUNS_WORKERS_AI: ReadonlySet<number> = new Set([3036, 3006])

/** Erreurs passagères de Workers AI : quota, capacité, délais et annulations de Cloudflare, requête trop grosse. */
const CODES_PASSAGERS_WORKERS_AI: ReadonlySet<number> = new Set([3036, 3040, 3007, 3008, 3006])

/** Étiquette `module` des alertes (Sentry). */
const MODULE_JOURNAL = 'ia-relais'

/** Un agent texte peut répondre : Groq est configuré, ou Workers AI est présent (binding du Worker). */
export async function iaTexteDisponible(): Promise<boolean> {
  if (await getSecret('GROQ_API_KEY')) return true
  return (await bindingWorkersAI()) !== null
}

/** La lecture des images est possible : Workers AI est présent. */
export async function visionDisponible(): Promise<boolean> {
  return (await bindingWorkersAI()) !== null
}

function resume(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 200)
}

// ── Alertes ──────────────────────────────────────────────────────────────────

/** La journalisation (Sentry) ne doit jamais faire échouer la réponse de l'agent. */
function journaliser(ecrire: () => void): void {
  try {
    ecrire()
  } catch (e) {
    console.warn('[ia] journalisation impossible', e)
  }
}

/** Statut HTTP d'une erreur levée par lib/groq (« Groq 404: … », « Groq stream 429 on … ») ; undefined sinon. */
function statutGroq(err: unknown): number | undefined {
  const statut = err instanceof Error ? /^Groq(?: stream| tools)? (\d{3})\b/.exec(err.message)?.[1] : undefined
  return statut === undefined ? undefined : Number(statut)
}

/**
 * Échec passager de Groq : requête trop grosse pour la limite par minute de l'offre gratuite (413), quota (429),
 * panne (5xx), délai ou échéance, réseau. Tout le reste est durable : clé refusée (401, 403), modèle retiré (404),
 * requête invalide (400), clé absente.
 */
function echecPassagerGroq(err: unknown): boolean {
  const statut = statutGroq(err)
  if (statut !== undefined) return statut === 413 || statut === 429 || statut >= 500
  if (!(err instanceof Error)) return false
  return err instanceof TypeError || err.name === 'TimeoutError' || err.name === 'AbortError'
    || /attempts failed|échéance/i.test(err.message)
}

let cleGroqAbsenteSignalee = false

/** Échec de Groq : durable → Sentry (une fois par instance pour une clé absente) ; passager → avertissement. */
function signalerEchecGroq(contexte: string, err: unknown, suite: string): void {
  journaliser(() => {
    if (err instanceof Error && err.message === 'GROQ_API_KEY not configured') {
      if (cleGroqAbsenteSignalee) return
      cleGroqAbsenteSignalee = true
      logger.error('[ia] GROQ_API_KEY absente : agents artisan / BTP sur le seul relais', { module: MODULE_JOURNAL }, err)
      return
    }
    if (echecPassagerGroq(err)) {
      logger.warn(`[ia] ${contexte} : Groq en échec passager, ${suite}`, { erreur: resume(err) })
      return
    }
    logger.error(
      `[ia] ${contexte} : échec durable de Groq (clé refusée, modèle retiré, requête invalide), ${suite}`,
      { module: MODULE_JOURNAL, statut: statutGroq(err) ?? null },
      err,
    )
  })
}

/** Échec d'un modèle de Workers AI : durable (modèle retiré, sortie inattendue…) → Sentry ; passager → avertissement. */
function signalerEchecWorkersAI(contexte: string, modele: string, err: unknown): void {
  journaliser(() => {
    const passager = err instanceof ErreurWorkersAI && (err.expire || (err.code !== null && CODES_PASSAGERS_WORKERS_AI.has(err.code)))
    if (passager) {
      logger.warn(`[ia] ${contexte} : Workers AI ${modele} en échec passager`, { erreur: resume(err) })
      return
    }
    logger.error(
      `[ia] ${contexte} : échec durable de Workers AI ${modele} (modèle retiré, sortie inattendue…)`,
      { module: MODULE_JOURNAL, code: err instanceof ErreurWorkersAI ? err.code : null },
      err,
    )
  })
}

// ── Texte ────────────────────────────────────────────────────────────────────

/** Nombre de caractères de texte d'une demande (consignes, historique, message). */
function tailleDemande(opts: GroqCallOptions): number {
  let total = 0
  for (const m of opts.messages) {
    if (typeof m.content === 'string') total += m.content.length
    else if (Array.isArray(m.content)) for (const p of m.content) total += p.text?.length ?? 0
  }
  return total
}

/** Workers AI peut prendre le relais de cette demande : binding présent et demande sous le plafond. */
async function relaisPossible(opts: GroqCallOptions, contexte: string): Promise<boolean> {
  if (!(await bindingWorkersAI())) return false
  const taille = tailleDemande(opts)
  if (taille <= PLAFOND_RELAIS_CARACTERES) return true
  logger.warn(`[ia] ${contexte} : demande trop longue pour le relais par Workers AI`, { caracteres: taille })
  return false
}

/** Options de l'appel à Groq ; `echeance` : moitié du budget quand le relais est possible, tout le budget sinon. */
async function configGroq(config: ConfigRelais, relais: boolean, debut: number) {
  const budget = config.budgetMs ?? BUDGET_MS
  return {
    apiKey: (await getSecret('GROQ_API_KEY')) || undefined,
    maxRetries: config.maxRetries ?? (relais ? 0 : undefined),
    fallbackModel: config.fallbackModel,
    // Cerebras n'est pas un sous-traitant déclaré : Workers AI le remplace sur ces routes.
    disableCerebrasFallback: true,
    echeance: debut + (relais ? budget / 2 : budget),
  }
}

/** Contenu d'un message en parties (texte et images). */
function parties(content: GroqMessage['content']): Array<{ type: string; text?: string; image_url?: { url: string } }> {
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  return content ?? []
}

/**
 * Messages pour Workers AI : les tours consécutifs d'un même rôle sont fusionnés et un message répété à l'identique
 * n'est gardé qu'une fois (Fixy AI et Fixy Chat envoient le dernier message dans l'historique puis à nouveau) ; les
 * gabarits de conversation de ces modèles attendent des rôles alternés.
 */
function messagesAlternes(messages: GroqMessage[]): GroqMessage[] {
  const sortie: GroqMessage[] = []
  for (const message of messages) {
    const precedent = sortie[sortie.length - 1]
    if (!precedent || precedent.role !== message.role) {
      sortie.push(message)
      continue
    }
    if (JSON.stringify(precedent.content) === JSON.stringify(message.content)) continue
    const fusion = typeof precedent.content === 'string' && typeof message.content === 'string'
      ? `${precedent.content}\n\n${message.content}`
      : [...parties(precedent.content), ...parties(message.content)]
    sortie[sortie.length - 1] = { ...precedent, content: fusion }
  }
  return sortie
}

function jsonLisible(texte: string): boolean {
  try {
    JSON.parse(texte)
    return true
  } catch {
    return false
  }
}

/**
 * La demande à Workers AI : Gemma 4, puis Qwen 3.8 si le premier échoue, rend une réponse vide ou un JSON illisible
 * (mode JSON demandé), avant l'échéance. Rejette avec la dernière erreur.
 */
async function demanderAWorkersAI(opts: GroqCallOptions, contexte: string, echeance: number): Promise<GroqResponse> {
  const json = opts.response_format?.type === 'json_object'
  const messages = messagesAlternes(opts.messages)
  let derniere: unknown = new ErreurWorkersAI(null, 'aucun modèle essayé (temps écoulé)')
  for (const modele of WORKERS_AI_MODELES) {
    const reste = echeance - Date.now()
    if (reste < DELAI_MIN_WORKERS_AI_MS) break
    try {
      const reponse = await callWorkersAI({ modele, messages, max_tokens: opts.max_tokens ?? 3000, json, delaiMs: reste })
      const contenu = reponse.choices?.[0]?.message?.content ?? ''
      if (contenu.trim() && (!json || jsonLisible(contenu))) return reponse
      derniere = new ErreurWorkersAI(null, `${modele} : réponse ${contenu.trim() ? 'JSON illisible' : 'vide'}`)
      logger.warn(`[ia] ${contexte} : Workers AI ${modele} a rendu une réponse inutilisable`, { erreur: resume(derniere) })
    } catch (e) {
      derniere = e
      signalerEchecWorkersAI(contexte, modele, e)
      if (e instanceof ErreurWorkersAI && (e.expire || (e.code !== null && CODES_COMMUNS_WORKERS_AI.has(e.code)))) break
    }
  }
  throw derniere
}

/**
 * Appel non streamé, même réponse que `callGroqWithRetry` (`model` : le modèle qui a répondu). Groq d'abord ; si
 * l'appel échoue ou rend une réponse vide (budget épuisé par le raisonnement, par exemple) et que Workers AI peut
 * prendre le relais, il reprend la même demande dans le temps qui reste. Sans relais possible, ou si le relais
 * échoue après une réponse vide de Groq : la réponse de Groq, comme avant (la route garde son propre repli) ; sinon
 * l'erreur.
 */
export async function appelerIA(opts: GroqCallOptions, config: ConfigRelais): Promise<GroqResponse> {
  const debut = Date.now()
  const relais = await relaisPossible(opts, config.contexte)
  let reponseGroq: GroqResponse | null = null
  let erreurGroq: unknown = null
  try {
    reponseGroq = await callGroqWithRetry(opts, await configGroq(config, relais, debut))
    if (reponseGroq.choices?.[0]?.message?.content?.trim()) return reponseGroq
  } catch (e) {
    erreurGroq = e
  }

  const suite = relais ? 'relais par Workers AI' : 'sans relais'
  if (erreurGroq) signalerEchecGroq(config.contexte, erreurGroq, suite)
  else logger.warn(`[ia] ${config.contexte} : réponse vide de Groq, ${suite}`, { finish_reason: reponseGroq?.choices?.[0]?.finish_reason ?? null })

  if (!relais) {
    if (reponseGroq) return reponseGroq
    throw erreurGroq
  }
  try {
    return await demanderAWorkersAI(opts, config.contexte, debut + (config.budgetMs ?? BUDGET_MS))
  } catch (erreurRelais) {
    if (!reponseGroq) throw erreurRelais
    logger.warn(`[ia] ${config.contexte} : relais en échec, réponse vide de Groq rendue`, { erreur: resume(erreurRelais) })
    return reponseGroq
  }
}

/** Un texte entier en flux SSE au format de lib/groq : un seul morceau, puis la fin. */
function fluxDuTexte(texte: string): ReadableStream<Uint8Array> {
  const encodeur = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controleur) {
      controleur.enqueue(encodeur.encode(`data: ${JSON.stringify({ text: texte })}\n\n`))
      controleur.enqueue(encodeur.encode('data: [DONE]\n\n'))
      controleur.close()
    },
  })
}

/**
 * Appel streamé, même flux que `callGroqStreaming`. Groq d'abord ; s'il échoue avant de répondre et que Workers AI
 * peut prendre le relais, sa réponse arrive d'un bloc, au même format.
 */
export async function fluxIA(opts: GroqCallOptions, config: ConfigRelais): Promise<FluxIA> {
  const debut = Date.now()
  const relais = await relaisPossible(opts, config.contexte)
  try {
    const { apiKey, maxRetries, fallbackModel, echeance } = await configGroq(config, relais, debut)
    let modele = opts.model || GROQ_MODEL_PRIMARY
    const flux = await callGroqStreaming(opts, { apiKey, maxRetries, fallbackModel, echeance, onModel: m => { modele = m } })
    return { flux, modele }
  } catch (erreurGroq) {
    signalerEchecGroq(config.contexte, erreurGroq, relais ? 'relais par Workers AI' : 'sans relais')
    if (!relais) throw erreurGroq
    const reponse = await demanderAWorkersAI(opts, config.contexte, debut + (config.budgetMs ?? BUDGET_MS))
    return { flux: fluxDuTexte(reponse.choices[0].message.content), modele: reponse.model ?? WORKERS_AI_MODELES[0] }
  }
}

// ── Documents ────────────────────────────────────────────────────────────────

/** Images que les modèles lisent. */
const TYPES_IMAGE = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

interface Document {
  type: string
  base64: string
}

/** Document d'une data URL `data:<type>;base64,<contenu>`, ou `null` si ce n'en est pas une. */
function decouperDataUrl(url: string): Document | null {
  const virgule = url.indexOf(',')
  if (!url.startsWith('data:') || virgule < 0) return null
  const entete = url.slice(5, virgule).toLowerCase()
  if (!entete.endsWith(';base64')) return null
  const type = entete.slice(0, -';base64'.length)
  return { type: type === 'image/jpg' ? 'image/jpeg' : type, base64: url.slice(virgule + 1) }
}

/** Poids décodé d'un contenu base64. */
function octetsBase64(base64: string): number {
  const remplissage = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - remplissage
}

/**
 * Pages d'un PDF, selon pdf.js : ce sont celles que la lecture du texte parcourt (un objet page d'une ancienne
 * révision, ou non relié à l'arborescence, n'est pas lu). PDF illisible : rejet.
 */
async function pagesPdf(octets: Buffer): Promise<number> {
  try {
    const { getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(octets))
    const pages = pdf.numPages
    // Libération des ressources de pdf.js quand la version d'unpdf l'expose.
    const liberer = (pdf as { destroy?: () => Promise<void> }).destroy
    if (typeof liberer === 'function') await liberer.call(pdf)
    return pages
  } catch (e) {
    throw new Error('PDF illisible', { cause: e })
  }
}

/** Texte d'un PDF (couche de texte, sauts de ligne gardés : les routes y cherchent « libellé : valeur »). */
async function textePdf(octets: Buffer): Promise<string> {
  const { extractText } = await import('unpdf')
  const { text } = await extractText(new Uint8Array(octets), { mergePages: true })
  return (Array.isArray(text) ? text.join('\n') : text).trim()
}

/**
 * Contrôle des documents d'une demande avant toute lecture : data URL seulement, image (ou PDF si la route l'admet),
 * poids et nombre de pages bornés. Rejette sans rien appeler ; rend les documents.
 */
async function controlerDocuments(opts: GroqCallOptions, config: ConfigVision): Promise<Document[]> {
  const urls = opts.messages.flatMap(m =>
    Array.isArray(m.content) ? m.content.filter(p => p.type === 'image_url').map(p => p.image_url?.url ?? '') : [],
  )
  const refus = (motif: string) => new Error(`[ia] ${config.contexte} : ${motif}`)
  if (urls.length === 0) throw refus('aucun document')
  const documents: Document[] = []
  for (const url of urls) {
    const document = decouperDataUrl(url)
    const pdf = document?.type === 'application/pdf'
    if (!document || !(TYPES_IMAGE.has(document.type) || (pdf && config.pdf))) throw refus('format de document non pris en charge')
    if (octetsBase64(document.base64) > (config.maxOctets ?? MAX_OCTETS_DOCUMENT)) throw refus('document trop volumineux')
    if (pdf && (await pagesPdf(Buffer.from(document.base64, 'base64'))) > (config.maxPagesPdf ?? MAX_PAGES_PDF)) throw refus('PDF trop long')
    documents.push(document)
  }
  if (documents.length > 1 && documents.some(d => d.type === 'application/pdf')) throw refus('un PDF se lit seul')
  return documents
}

/**
 * Lecture d'un document (messages au format OpenAI, document en `image_url` data URL), réponse au format de lib/groq :
 * - PDF : sa couche de texte, rendue telle quelle, sans modèle (gratuit, exact) ; un PDF scanné, sans texte, est
 *   rejeté (aucun modèle à disposition ne lit les PDF) ;
 * - image : Workers AI (Gemma 4, puis Qwen 3.8). Pas de secours Groq : aucun de ses modèles de production ne lit les
 *   images.
 * Rejette sans rien appeler un document refusé par `controlerDocuments`.
 */
export async function appelerVision(opts: GroqCallOptions, config: ConfigVision): Promise<GroqResponse> {
  const debut = Date.now()
  const documents = await controlerDocuments(opts, config)
  if (documents[0].type === 'application/pdf') {
    const texte = await textePdf(Buffer.from(documents[0].base64, 'base64'))
    if (texte.replace(/\s/g, '').length < MIN_CARACTERES_PDF) throw new Error(`[ia] ${config.contexte} : PDF sans texte (scanné), non lu`)
    return { choices: [{ message: { content: texte }, finish_reason: 'stop' }], model: 'texte-pdf' }
  }
  if (!(await bindingWorkersAI())) {
    const absent = new Error(`[ia] ${config.contexte} : lecture des images indisponible (Workers AI absent)`)
    journaliser(() => logger.error(absent.message, { module: MODULE_JOURNAL }, absent))
    throw absent
  }
  return demanderAWorkersAI(opts, config.contexte, debut + (config.budgetMs ?? BUDGET_MS))
}

/**
 * Type réel d'un fichier d'après ses premiers octets (le nom ou l'en-tête d'un téléchargement peuvent mentir) :
 * PDF, PNG, JPEG, GIF ou WebP ; `null` pour tout autre format.
 */
export function typeDocument(octets: Uint8Array): string | null {
  const debut = (...attendus: number[]) => attendus.every((o, i) => octets[i] === o)
  if (debut(0x25, 0x50, 0x44, 0x46)) return 'application/pdf'
  if (debut(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (debut(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (debut(0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  const webp = [0x57, 0x45, 0x42, 0x50].every((o, i) => octets[8 + i] === o)
  if (debut(0x52, 0x49, 0x46, 0x46) && webp) return 'image/webp'
  return null
}

/**
 * Data URL d'une image envoyée par le navigateur (data URL complète ou base64 seul), avec son vrai type d'après
 * ses premiers octets ; le type déclaré est gardé si le contenu n'est pas reconnu.
 */
export function dataUrlDocument(entree: string, typeDeclare = 'image/jpeg'): string {
  const document = decouperDataUrl(entree)
  const base64 = document ? document.base64 : entree
  const reel = typeDocument(Buffer.from(base64.slice(0, 32), 'base64'))
  return `data:${reel ?? document?.type ?? typeDeclare};base64,${base64}`
}
