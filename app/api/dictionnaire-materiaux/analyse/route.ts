// app/api/dictionnaire-materiaux/analyse/route.ts
//
// Mode « langage naturel » du Dictionnaire matériaux (tableau de bord pro) : l'artisan décrit une
// situation de chantier, avec des photos s'il veut ; le modèle répond par des matériaux du catalogue de
// son pays. Tout identifiant hors catalogue est écarté avant la réponse (lib/dictionnaire-materiaux/ia).
//
// Modèles, dans l'ordre d'essai ; le suivant prend la main si le précédent échoue ou rend une réponse illisible :
// 1. Workers AI (lib/workers-ai.ts, binding du Worker, sans clé), gratuit dans la limite du quota quotidien du compte
//    Cloudflare : Gemma 4 26B, puis Qwen 3.8 27B ; catalogue entier, photos comprises ;
// 2. Claude (lib/claude.ts), s'il a une clé : catalogue entier mis en cache, photos comprises ;
// 3. Groq, sans photo, sur un catalogue réduit aux fiches et matériaux proches du message : le catalogue entier dépasse
//    la limite par minute de l'offre Groq du compte.
// Les photos ne sont ni enregistrées ni journalisées ; e-mails, téléphones (dont l'écriture portugaise à neuf chiffres,
// sans +351) et IBAN de la description sont masqués avant le modèle et rétablis dans la réponse.
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isArtisanRole, isProSocieteRole, unauthorizedResponse } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getCfEnv, getSecret } from '@/lib/env'
import { CLAUDE_MODEL_AGENTS } from '@/lib/constants'
import { callClaudeWithRetry, ErreurClaude, hasAnthropicKey } from '@/lib/claude'
import { callGroqWithRetry, type GroqResponse } from '@/lib/groq'
import { bindingWorkersAI, callWorkersAI, ErreurWorkersAI, type ReponseWorkersAI } from '@/lib/workers-ai'
import { traceAgent } from '@/lib/langfuse'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'
import { dictionnairePour, type Dictionnaire } from '@/lib/dictionnaire-materiaux'
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  TOURS_HISTORIQUE_MAX,
  analyseVide,
  construireMessages,
  dictionnaireReduit,
  lireAnalyse,
  type AnalyseIA,
  type LectureAnalyse,
  type TourHistorique,
} from '@/lib/dictionnaire-materiaux/ia/analyse'
import { PHOTOS_MAX, TAILLE_MAX_PHOTO, verifierPhoto } from '@/lib/dictionnaire-materiaux/ia/photos'
import { masquerTelephonesPortugais } from '@/lib/dictionnaire-materiaux/ia/telephones'

/** Corps de requête maximal (caractères) : les photos au plus lourd, la description et les tours précédents. */
const TAILLE_MAX_CORPS = PHOTOS_MAX * TAILLE_MAX_PHOTO + 64_000

/**
 * Budget de réponse, hors réflexion (ajoutée par lib/claude pour Claude ; coupée chez Workers AI). Chez gpt-oss
 * (secours Groq), le raisonnement s'y décompte : une marge évite une réponse tronquée.
 */
const MAX_TOKENS = 4000

/**
 * Modèles de Workers AI, dans l'ordre d'essai (choix du 16/11/2026, prix de la page tarifs de Cloudflare). Gratuits
 * dans la limite de 10 000 neurones par jour du compte, facturés au-delà (compte Workers Paid) :
 * - Gemma 4 26B A4B (Google, Apache 2.0) : lit les photos, 256 000 jetons de contexte ; environ 220 neurones par analyse
 *   avec le catalogue entier, soit une quarantaine d'analyses par jour sans frais, puis environ 0,0025 $ l'analyse ;
 * - Qwen 3.8 27B (Alibaba, Apache 2.0) : lit les photos, 262 144 jetons ; environ cinq fois plus cher (sortie à
 *   3,20 $ le million de jetons), en relais seulement.
 * Workers AI n'aura plus de Nemotron après le 20/11/2026, et Cloudflare retire souvent des modèles (24 ce jour-là) : le
 * relais couvre un retrait, puis Claude et Groq.
 */
const MODELES_WORKERS_AI = ['@cf/google/gemma-4-26b-a4b-it', '@cf/qwen/qwen3.8-27b'] as const

/**
 * Temps accordé à Workers AI pour une demande, ses deux modèles compris : un modèle n'est lancé qu'avec au moins
 * 20 s devant lui. Au-delà, Claude et Groq prennent la main (l'écran attend la réponse sans délai à lui).
 */
const BUDGET_WORKERS_AI_MS = 70_000
const DELAI_MIN_WORKERS_AI_MS = 20_000

/**
 * Secours texte (sans photo) : le remplaçant indiqué par Groq des modèles Llama retirés en 2026. Sans lui, lib/groq
 * prendrait ses modèles par défaut, retirés, puis Cerebras, disparu aussi.
 */
const MODELE_SECOURS_TEXTE = 'openai/gpt-oss-120b'

/** Tours précédents envoyés au secours Groq : le dernier échange (question de l'artisan, réponse résumée). */
const TOURS_SECOURS = 2

/** Erreurs passagères de Claude (surcharge, limite de débit) : simple avertissement ; les autres partent dans Sentry. */
const STATUTS_PASSAGERS: ReadonlySet<number> = new Set([429, 500, 502, 503, 529])

/** Quota gratuit de Workers AI épuisé : n'arrive que sur l'offre Free (l'offre Paid facture au-delà). */
const CODE_QUOTA_WORKERS_AI = 3036

/** Requête trop grosse pour Workers AI (seuil non publié) : avec des photos, c'est elles qui pèsent. */
const CODE_TROP_VOLUMINEUX = 3006

/** Échecs qui valent pour tous les modèles de Workers AI : quota du compte, même requête trop grosse. */
const CODES_COMMUNS_WORKERS_AI: ReadonlySet<number> = new Set([CODE_QUOTA_WORKERS_AI, CODE_TROP_VOLUMINEUX])

/** Erreurs passagères de Workers AI : quota épuisé, capacité dépassée, délais de Cloudflare. */
const CODES_PASSAGERS_WORKERS_AI: ReadonlySet<number> = new Set([CODE_QUOTA_WORKERS_AI, 3040, 3007, 3008])

const BodySchema = z.object({
  pays: z.enum(['PT', 'FR']),
  description: z.string().trim().min(DESCRIPTION_MIN).max(DESCRIPTION_MAX),
  // Format et poids de chaque photo : contrôlés plus bas (verifierPhoto), pour une erreur qui dit laquelle des deux.
  photos: z.array(z.string().min(1)).max(PHOTOS_MAX).default([]),
  historique: z
    .array(z.object({ role: z.enum(['user', 'assistant']), texte: z.string().trim().min(1).max(DESCRIPTION_MAX) }))
    .max(TOURS_HISTORIQUE_MAX)
    .default([]),
})

const erreur = (code: string, status: number) => NextResponse.json({ error: code }, { status })

const messageDe = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 200)

/**
 * Corps de la requête, lu sans dépasser `max` octets : un envoi par morceaux, sans Content-Length, n'est pas chargé
 * en entier avant d'être refusé. `null` au-delà de la limite.
 */
async function lireCorpsBorne(request: NextRequest, max: number): Promise<string | null> {
  if (!request.body) return ''
  const lecteur = request.body.getReader()
  const morceaux: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await lecteur.cancel()
      return null
    }
    morceaux.push(value)
  }
  const corps = new Uint8Array(total)
  let position = 0
  for (const morceau of morceaux) {
    corps.set(morceau, position)
    position += morceau.byteLength
  }
  return new TextDecoder().decode(corps)
}

/**
 * Refus de Claude qui vise une photo (image illisible, format annoncé faux) : l'artisan peut y remédier. Toute autre
 * erreur 400 est une panne de configuration (modèle renommé, paramètre refusé), à signaler.
 */
function photoRefusee(err: unknown, nombrePhotos: number): boolean {
  return nombrePhotos > 0 && err instanceof ErreurClaude && err.statut === 400 && /\bimage\b/i.test(err.message)
}

/** Jetons de masquage rétablis dans tous les textes de l'analyse. */
function retablirTextes(analyse: AnalyseIA, tokenMap: Map<string, string>): AnalyseIA {
  if (tokenMap.size === 0) return analyse
  const retablir = (texte: string) => resolveSanitizedToken(texte, tokenMap) ?? texte
  return {
    ...analyse,
    resume: retablir(analyse.resume),
    etapes: analyse.etapes.map((etape) => ({
      titre: retablir(etape.titre),
      materiaux: etape.materiaux.map((m) => ({ id: m.id, raison: retablir(m.raison) })),
    })),
    conseils: analyse.conseils.map(retablir),
    attention: analyse.attention.map(retablir),
    questions: analyse.questions.map(retablir),
    horsCatalogue: analyse.horsCatalogue.map(retablir),
  }
}

/** Compte pro connecté, sous ses limites de débit ; sinon la réponse de refus. */
async function verifierAppelant(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()
  // Module du tableau de bord pro : artisans et sociétés (le super admin est couvert par isProSocieteRole).
  if (!isArtisanRole(user) && !isProSocieteRole(user)) return erreur('acces_reserve_aux_professionnels', 403)
  // Chaque appel déclenche un appel au modèle, parfois avec des photos : limite par adresse et par compte.
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`dico_ia_${ip}`, 10, 60_000))) return rateLimitResponse()
  if (!(await checkRateLimit(`dico_ia_compte_${user.id}`, 40, 3_600_000))) return rateLimitResponse()
  return user
}

/** Corps de requête en JSON, ou null (journalisé) s'il est illisible. */
function lireJson(brut: string): unknown {
  try {
    return JSON.parse(brut)
  } catch (err) {
    logger.warn('[dictionnaire-materiaux/analyse] corps JSON illisible', { erreur: err instanceof Error ? err.message.slice(0, 120) : '' })
    return null
  }
}

/** Demande lue dans la limite de taille, validée, avec le dictionnaire du pays et ses photos contrôlées ; sinon le refus. */
async function lireDemande(request: NextRequest) {
  if (Number(request.headers.get('content-length') ?? 0) > TAILLE_MAX_CORPS) return erreur('demande_trop_volumineuse', 413)
  let brut: string | null
  try {
    brut = await lireCorpsBorne(request, TAILLE_MAX_CORPS)
  } catch (err) {
    logger.warn('[dictionnaire-materiaux/analyse] corps interrompu', { erreur: err instanceof Error ? err.message.slice(0, 120) : '' })
    return erreur('requete_invalide', 400)
  }
  if (brut === null) return erreur('demande_trop_volumineuse', 413)
  const parsed = BodySchema.safeParse(lireJson(brut))
  if (!parsed.success) return erreur('requete_invalide', 400)
  const dico = dictionnairePour(parsed.data.pays)
  if (!dico) return erreur('pays_non_disponible', 400)
  for (const photo of parsed.data.photos) {
    const controle = verifierPhoto(photo)
    if (!controle.ok) {
      return controle.raison === 'taille' ? erreur('photo_trop_volumineuse', 413) : erreur('photo_format_non_pris_en_charge', 400)
    }
  }
  return { ...parsed.data, dico }
}

/**
 * Description et tours précédents sans les coordonnées d'un client (e-mails, téléphones, IBAN), qui n'ont rien à faire
 * dans un diagnostic, avec les jetons qui les rétablissent dans la réponse.
 */
function masquerCoordonnees(demande: { pays: string; description: string; historique: TourHistorique[] }) {
  const { sanitized, tokenMap } = sanitizeContextForLLM(
    { description: demande.description, historique: demande.historique },
    { types: ['email', 'phone', 'iban'] },
  )
  // Au Portugal, un numéro s'écrit le plus souvent sans indicatif (« 912 345 678 ») : le masquage commun ne le voit pas.
  const masquer = (texte: string) => (demande.pays === 'PT' ? masquerTelephonesPortugais(texte, tokenMap) : texte)
  return {
    description: masquer(sanitized.description),
    historique: sanitized.historique.map((tour) => ({ role: tour.role, texte: masquer(tour.texte) })),
    tokenMap,
  }
}

interface Demande {
  dico: Dictionnaire
  description: string
  photos: string[]
  historique: TourHistorique[]
}

type Fournisseur = 'workers-ai' | 'claude' | 'groq'

/** Réponse d'un modèle, avec le dictionnaire de ses consignes : la réponse se relit avec lui (numéros des matériaux). */
type ReponseModele = { reponse: GroqResponse; dico: Dictionnaire }

/** Un modèle à essayer : fournisseur et identifiant (journaux), appel. */
interface Tentative {
  fournisseur: Fournisseur
  modele: string
  /** `delaiMs` : temps laissé à Workers AI ; Claude et Groq ont leurs propres délais et l'ignorent. */
  appeler: (delaiMs: number) => Promise<ReponseModele>
}

/** Réponse vide ou illisible d'un modèle : le suivant est essayé ; celle du dernier fait la réponse d'erreur. */
class ReponseIllisible extends Error {
  constructor(
    readonly code: 'reponse_vide' | 'reponse_invalide',
    fournisseur: Fournisseur,
  ) {
    super(`${fournisseur} : ${code}`)
    this.name = 'ReponseIllisible'
  }
}

/** Aucun modèle n'a rendu d'analyse : la dernière erreur, et le refus d'une photo s'il y en a eu un. */
class EchecDeLaChaine extends Error {
  constructor(
    readonly derniere: unknown,
    readonly refusPhoto: unknown,
  ) {
    super('aucun modèle n’a rendu d’analyse')
    this.name = 'EchecDeLaChaine'
  }
}

/**
 * Usage d'un appel (marge face aux quotas ; pour Workers AI, durée et jetons de réflexion, 0 attendu) ; une réponse
 * coupée par le budget de jetons l'est en avertissement.
 */
function journaliserUsage(fournisseur: Fournisseur, modele: string, reponse: GroqResponse, dico: Dictionnaire, diagnostic = {}) {
  const fin = reponse.choices?.[0]?.finish_reason
  const usage = {
    fournisseur,
    modele,
    finish_reason: fin,
    prompt_tokens: reponse.usage?.prompt_tokens,
    completion_tokens: reponse.usage?.completion_tokens,
    materiaux: dico.materiaux.length,
    ...diagnostic,
  }
  if (fin === 'length') logger.warn('[dictionnaire-materiaux/analyse] réponse coupée par le budget de jetons', usage)
  else logger.info('[dictionnaire-materiaux/analyse] usage du modèle', usage)
}

/** Workers AI, catalogue entier, photos comprises, réflexion coupée (lib/workers-ai). */
async function appelerWorkersAI(modele: string, { dico, description, photos, historique }: Demande, delaiMs: number): Promise<ReponseModele> {
  const reponse: ReponseWorkersAI = await callWorkersAI({
    modele,
    messages: construireMessages(dico, { description, photos, historique }),
    max_tokens: MAX_TOKENS,
    json: true,
    delaiMs,
  })
  journaliserUsage('workers-ai', modele, reponse, dico, reponse.diagnostic)
  return { reponse, dico }
}

/** Claude, catalogue entier mis en cache, photos comprises ; sans le secours générique de lib/claude (catalogue entier). */
async function appelerClaude({ dico, description, photos, historique }: Demande): Promise<ReponseModele> {
  const reponse = await callClaudeWithRetry(
    { messages: construireMessages(dico, { description, photos, historique }), max_tokens: MAX_TOKENS, response_format: { type: 'json_object' } },
    { effort: 'medium', cacheSysteme: true, disableGroqFallback: true },
  )
  journaliserUsage('claude', CLAUDE_MODEL_AGENTS, reponse, dico)
  return { reponse, dico }
}

/**
 * Groq sur un catalogue réduit (sans photo) : cherché sur le message et les questions précédentes de l'artisan, avec
 * les matériaux de la réponse précédente ; le dernier échange seulement, pour rester sous la limite par minute
 * (le catalogue entier, environ 19 000 jetons, dépasse les 8 000 par minute de l'offre du compte : refus 413 du
 * 15/11/2026).
 */
async function appelerGroq({ dico, description, historique }: Demande, cleGroq: string): Promise<ReponseModele> {
  const questions = historique.filter((tour) => tour.role === 'user').map((tour) => tour.texte)
  const reponsePrecedente = historique.findLast((tour) => tour.role === 'assistant')?.texte ?? ''
  const reduit = dictionnaireReduit(dico, [description, ...questions].join('\n'), reponsePrecedente)
  const reponse = await callGroqWithRetry(
    {
      messages: construireMessages(reduit, { description, photos: [], historique: historique.slice(-TOURS_SECOURS) }),
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
      model: MODELE_SECOURS_TEXTE,
    },
    { apiKey: cleGroq, fallbackModel: MODELE_SECOURS_TEXTE, disableCerebrasFallback: true },
  )
  journaliserUsage('groq', MODELE_SECOURS_TEXTE, reponse, reduit)
  return { reponse, dico: reduit }
}

let bindingAbsentSignale = false

/**
 * Dans un Worker (environnement non vide) sans binding AI : configuration cassée (wrangler.toml), qui priverait le
 * module de son modèle gratuit sans bruit. Signalée une fois par instance du Worker. Hors Worker, rien d'anormal.
 */
async function signalerBindingAbsent() {
  if (bindingAbsentSignale || Object.keys(await getCfEnv()).length === 0) return
  bindingAbsentSignale = true
  logger.error(
    '[dictionnaire-materiaux/analyse] binding Workers AI absent du Worker : analyses sans le modèle gratuit',
    { module: 'dictionnaire-materiaux' },
    new Error('binding AI absent'),
  )
}

/** Modèles disponibles pour cette demande, dans l'ordre d'essai ; vide si aucun ne l'est. */
async function tentativesPour(demande: Demande): Promise<Tentative[]> {
  const tentatives: Tentative[] = []
  if (await bindingWorkersAI()) {
    for (const modele of MODELES_WORKERS_AI) {
      tentatives.push({ fournisseur: 'workers-ai', modele, appeler: (delaiMs) => appelerWorkersAI(modele, demande, delaiMs) })
    }
  } else {
    await signalerBindingAbsent()
  }
  if (await hasAnthropicKey()) {
    tentatives.push({ fournisseur: 'claude', modele: CLAUDE_MODEL_AGENTS, appeler: () => appelerClaude(demande) })
  }
  // Groq ne lit pas les photos.
  const cleGroq = demande.photos.length > 0 ? '' : await getSecret('GROQ_API_KEY')
  if (cleGroq) {
    tentatives.push({ fournisseur: 'groq', modele: MODELE_SECOURS_TEXTE, appeler: () => appelerGroq(demande, cleGroq) })
  }
  return tentatives
}

/** Panne passagère (surcharge, quota, délai, coupure réseau) : avertissement ; toute autre est une panne de configuration. */
function pannePassagere(err: unknown): boolean {
  if (err instanceof ErreurClaude) return STATUTS_PASSAGERS.has(err.statut)
  if (!(err instanceof ErreurWorkersAI)) return false
  return err.expire || (err.code !== null && CODES_PASSAGERS_WORKERS_AI.has(err.code)) || /network connection lost/i.test(err.message)
}

/**
 * Échec d'un modèle suivi d'un autre essai. Une clé refusée, un modèle retiré ou un paramètre rejeté (code inconnu
 * compris) part dans Sentry, même si le suivant répond : un relais ne doit pas masquer une panne de configuration (clé
 * Claude refusée le 15/11/2026). Une surcharge ou le refus d'une photo reste un avertissement ; une réponse illisible
 * l'a déjà été.
 */
function signalerEchec(tentative: Tentative, err: unknown, refusPhoto: boolean) {
  if (err instanceof ReponseIllisible) return
  const { fournisseur, modele } = tentative
  if (refusPhoto || pannePassagere(err)) {
    logger.warn('[dictionnaire-materiaux/analyse] modèle indisponible, essai du suivant', { fournisseur, modele, erreur: messageDe(err) })
  } else {
    const statut = err instanceof ErreurClaude ? { statut: err.statut } : {}
    logger.error('[dictionnaire-materiaux/analyse] modèle en échec, essai du suivant', { module: 'dictionnaire-materiaux', fournisseur, modele, ...statut }, err)
  }
}

/** État de la chaîne pendant une demande. */
interface EtatChaine {
  /** Début du premier essai Workers AI : le budget vaut pour ses deux modèles. */
  debutWorkersAI: number | null
  /** Plus d'essai Workers AI : délai dépassé, quota du compte, requête trop grosse. */
  workersAIClos: boolean
  /** Premier refus qui vise une photo : il fait la réponse si tout échoue (l'artisan peut y remédier). */
  refusPhoto: unknown
}

/** Temps à laisser à un essai Workers AI, ou null s'il ne faut plus en lancer. */
function delaiWorkersAI(etat: EtatChaine): number | null {
  if (etat.workersAIClos) return null
  const reste = BUDGET_WORKERS_AI_MS - (etat.debutWorkersAI === null ? 0 : Date.now() - etat.debutWorkersAI)
  return reste >= DELAI_MIN_WORKERS_AI_MS ? reste : null
}

function essaiPossible(tentative: Tentative, etat: EtatChaine): boolean {
  return tentative.fournisseur !== 'workers-ai' || delaiWorkersAI(etat) !== null
}

/** Temps à laisser à cet essai (0 hors Workers AI : Claude et Groq ont leurs délais), ou null s'il faut le sauter. */
function delaiPour(tentative: Tentative, etat: EtatChaine): number | null {
  if (tentative.fournisseur !== 'workers-ai') return 0
  const delai = delaiWorkersAI(etat)
  if (delai !== null) etat.debutWorkersAI ??= Date.now()
  return delai
}

/** Échec qui vaut pour tous les modèles de Workers AI : délai dépassé (même infrastructure), quota, requête trop grosse. */
function fermeWorkersAI(err: unknown): boolean {
  if (!(err instanceof ErreurWorkersAI)) return false
  return err.expire || (err.code !== null && CODES_COMMUNS_WORKERS_AI.has(err.code))
}

/** Refus qui vise une photo : image illisible pour Claude, requête trop grosse pour Workers AI. */
function refusDePhoto(err: unknown, nombrePhotos: number): boolean {
  if (nombrePhotos === 0) return false
  return photoRefusee(err, nombrePhotos) || (err instanceof ErreurWorkersAI && err.code === CODE_TROP_VOLUMINEUX)
}

/** Ce qu'un échec change pour la suite (fin des essais Workers AI) ; vrai s'il est le premier refus d'une photo. */
function noterEchec(etat: EtatChaine, tentative: Tentative, echec: unknown, nombrePhotos: number): boolean {
  if (tentative.fournisseur === 'workers-ai' && fermeWorkersAI(echec)) etat.workersAIClos = true
  if (etat.refusPhoto !== null || !refusDePhoto(echec, nombrePhotos)) return false
  etat.refusPhoto = echec
  return true
}

/** « JSON Mode couldn't be met » : Workers AI n'a pas tenu le format, comme une réponse illisible. */
function jsonModeNonTenu(err: unknown): boolean {
  return err instanceof ErreurWorkersAI && /JSON Mode couldn.t be met/i.test(err.message)
}

type Issue = { lecture: LectureAnalyse } | { echec: unknown }

/** Un essai : l'analyse lisible (au moins un diagnostic, un matériau ou une question), ou l'échec. */
async function essayer(tentative: Tentative, delaiMs: number): Promise<Issue> {
  const { fournisseur, modele } = tentative
  try {
    const { reponse, dico } = await tentative.appeler(delaiMs)
    const contenu = reponse.choices?.[0]?.message?.content?.trim() ?? ''
    const lecture = contenu ? lireAnalyse(contenu, dico) : null
    if (lecture && !analyseVide(lecture.analyse)) return { lecture }
    logger.warn('[dictionnaire-materiaux/analyse] réponse du modèle illisible', { fournisseur, modele, longueur: contenu.length })
    return { echec: new ReponseIllisible(contenu ? 'reponse_invalide' : 'reponse_vide', fournisseur) }
  } catch (err) {
    if (!jsonModeNonTenu(err)) return { echec: err }
    logger.warn('[dictionnaire-materiaux/analyse] réponse du modèle illisible (format JSON non tenu)', { fournisseur, modele })
    return { echec: new ReponseIllisible('reponse_invalide', fournisseur) }
  }
}

/**
 * Modèles essayés dans l'ordre jusqu'à une analyse lisible ; sinon `EchecDeLaChaine`. Workers AI a un budget de temps
 * commun à ses modèles, et un échec qui vaut pour tous (délai, quota, requête trop grosse) saute les suivants.
 */
async function analyser(tentatives: Tentative[], nombrePhotos: number): Promise<{ lecture: LectureAnalyse; tentative: Tentative }> {
  const etat: EtatChaine = { debutWorkersAI: null, workersAIClos: false, refusPhoto: null }
  let derniere: unknown = null
  for (const [rang, tentative] of tentatives.entries()) {
    const delai = delaiPour(tentative, etat)
    if (delai === null) continue
    const issue = await essayer(tentative, delai)
    if ('lecture' in issue) return { lecture: issue.lecture, tentative }
    derniere = issue.echec
    const refusPhoto = noterEchec(etat, tentative, issue.echec, nombrePhotos)
    if (tentatives.slice(rang + 1).some((t) => essaiPossible(t, etat))) signalerEchec(tentative, issue.echec, refusPhoto)
  }
  throw new EchecDeLaChaine(derniere, etat.refusPhoto)
}

/**
 * Échec de toute la chaîne : refus d'une photo (l'artisan peut y remédier : 422 illisible, 413 trop lourde), réponse
 * illisible (502 avec son code), sinon panne signalée à Sentry avec la dernière erreur.
 */
function reponseDEchec(err: unknown, pays: string, nombrePhotos: number) {
  const echec = err instanceof EchecDeLaChaine ? err : new EchecDeLaChaine(err, null)
  if (echec.refusPhoto !== null) {
    logger.warn('[dictionnaire-materiaux/analyse] photo refusée par le modèle', { erreur: messageDe(echec.refusPhoto) })
    const tropLourde = echec.refusPhoto instanceof ErreurWorkersAI && echec.refusPhoto.code === CODE_TROP_VOLUMINEUX
    return tropLourde ? erreur('photo_trop_volumineuse', 413) : erreur('photo_illisible', 422)
  }
  if (echec.derniere instanceof ReponseIllisible) return erreur(echec.derniere.code, 502)
  // L'erreur en troisième argument : c'est elle qui part dans Sentry.
  logger.error('[dictionnaire-materiaux/analyse] échec de l’appel au modèle', { module: 'dictionnaire-materiaux', pays, photos: nombrePhotos }, echec.derniere)
  return erreur('ia_indisponible', 502)
}

export async function POST(request: NextRequest) {
  const appelant = await verifierAppelant(request)
  if (appelant instanceof Response) return appelant
  const demande = await lireDemande(request)
  if (demande instanceof Response) return demande
  const { pays, photos, dico } = demande

  const { description, historique, tokenMap } = masquerCoordonnees(demande)
  const tentatives = await tentativesPour({ dico, description, photos, historique })
  // Aucun modèle : ni Workers AI (hors Worker), ni clé Claude, ni secours Groq possible (clé absente, ou photos).
  if (tentatives.length === 0) return erreur('ia_indisponible', 503)

  try {
    const { lecture, tentative } = await traceAgent(
      {
        agent_id: 'dictionnaire-materiaux',
        user_id: appelant.id,
        // Ni la description ni les photos ne partent dans la trace : seulement leur taille.
        prompt: `Dictionnaire matériaux ${pays} : ${demande.description.length} caractères, ${photos.length} photo(s), ${demande.historique.length} tour(s) précédent(s)`,
        metadata: { module: 'dictionnaire-materiaux', pays, photos: photos.length },
      },
      () => analyser(tentatives, photos.length),
    )
    if (lecture.idsInconnus.length > 0) {
      logger.warn('[dictionnaire-materiaux/analyse] identifiants hors dictionnaire écartés', {
        pays,
        fournisseur: tentative.fournisseur,
        modele: tentative.modele,
        nombre: lecture.idsInconnus.length,
        exemples: lecture.idsInconnus.slice(0, 5),
      })
    }
    // Le modèle qui a répondu reste côté serveur (journaux, trace) : l'écran n'en a pas besoin.
    return NextResponse.json({ analyse: retablirTextes(lecture.analyse, tokenMap) })
  } catch (err) {
    return reponseDEchec(err, pays, photos.length)
  }
}
