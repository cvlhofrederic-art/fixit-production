// app/api/dictionnaire-materiaux/analyse/route.ts
//
// Mode « langage naturel » du Dictionnaire matériaux (tableau de bord pro) : l'artisan décrit une
// situation de chantier, avec des photos s'il veut ; le modèle répond par des matériaux du catalogue de
// son pays. Tout identifiant hors catalogue est écarté avant la réponse (lib/dictionnaire-materiaux/ia).
//
// Modèle : Claude (lib/claude.ts), avec le catalogue entier, seul à lire les photos. Sans photo, s'il échoue ou s'il
// n'a pas de clé, secours Groq sur un catalogue réduit aux fiches et matériaux proches du message (le catalogue
// entier dépasse la limite par minute de l'offre Groq du compte). Les photos ne sont ni enregistrées ni
// journalisées ; e-mails, téléphones (dont l'écriture
// portugaise à neuf chiffres, sans +351) et IBAN de la description sont masqués avant le modèle et rétablis
// dans la réponse.
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isArtisanRole, isProSocieteRole, unauthorizedResponse } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getSecret } from '@/lib/env'
import { callClaudeWithRetry, ErreurClaude, hasAnthropicKey } from '@/lib/claude'
import { callGroqWithRetry, type GroqResponse } from '@/lib/groq'
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
  type TourHistorique,
} from '@/lib/dictionnaire-materiaux/ia/analyse'
import { PHOTOS_MAX, TAILLE_MAX_PHOTO, verifierPhoto } from '@/lib/dictionnaire-materiaux/ia/photos'
import { masquerTelephonesPortugais } from '@/lib/dictionnaire-materiaux/ia/telephones'

/** Corps de requête maximal (caractères) : les photos au plus lourd, la description et les tours précédents. */
const TAILLE_MAX_CORPS = PHOTOS_MAX * TAILLE_MAX_PHOTO + 64_000

/**
 * Budget de réponse, hors réflexion (ajoutée par lib/claude pour Claude). Le secours Groq le partage, et chez gpt-oss
 * le raisonnement s'y décompte : une marge évite une réponse tronquée.
 */
const MAX_TOKENS = 4000

/**
 * Secours texte quand Claude est indisponible (sans photo seulement) : le remplaçant indiqué par Groq des modèles
 * Llama retirés en 2026. Sans lui, lib/groq prendrait ses modèles par défaut, retirés, puis Cerebras, disparu aussi.
 */
const MODELE_SECOURS_TEXTE = 'openai/gpt-oss-120b'

/** Tours précédents envoyés au secours Groq : le dernier échange (question de l'artisan, réponse résumée). */
const TOURS_SECOURS = 2

/** Erreurs passagères de Claude (surcharge, limite de débit) : simple avertissement ; les autres partent dans Sentry. */
const STATUTS_PASSAGERS: ReadonlySet<number> = new Set([429, 500, 502, 503, 529])

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

/** Réponse du modèle relue : analyse limitée au catalogue, textes rétablis ; sinon le refus. */
function reponseDeLAnalyse(contenu: string, dico: Dictionnaire, pays: string, tokenMap: Map<string, string>) {
  if (!contenu) return erreur('reponse_vide', 502)
  const lecture = lireAnalyse(contenu, dico)
  if (!lecture || analyseVide(lecture.analyse)) {
    logger.warn('[dictionnaire-materiaux/analyse] réponse du modèle illisible', { longueur: contenu.length })
    return erreur('reponse_invalide', 502)
  }
  if (lecture.idsInconnus.length > 0) {
    logger.warn('[dictionnaire-materiaux/analyse] identifiants hors dictionnaire écartés', {
      pays,
      nombre: lecture.idsInconnus.length,
      exemples: lecture.idsInconnus.slice(0, 5),
    })
  }
  // Le modèle qui a répondu reste côté serveur (journaux, trace) : l'écran n'en a pas besoin.
  return NextResponse.json({ analyse: retablirTextes(lecture.analyse, tokenMap) })
}

/**
 * Claude refuse ou ne répond pas : une clé refusée, un compte sans crédit ou un paramètre rejeté part dans Sentry (le
 * secours ne doit pas masquer une panne de configuration, comme la clé refusée du 15/11/2026) ; une surcharge reste
 * un avertissement.
 */
function signalerSecours(err: unknown) {
  if (err instanceof ErreurClaude && !STATUTS_PASSAGERS.has(err.statut)) {
    logger.error('[dictionnaire-materiaux/analyse] Claude refuse la demande, secours Groq', { module: 'dictionnaire-materiaux', statut: err.statut }, err)
  } else {
    logger.warn('[dictionnaire-materiaux/analyse] Claude indisponible, secours Groq', { erreur: (err instanceof Error ? err.message : String(err)).slice(0, 200) })
  }
}

let cleAbsenteSignalee = false

/** Clé Claude absente : tout part sur le secours. Signalé une fois par instance du Worker (Sentry), pas à chaque demande. */
function signalerCleAbsente() {
  if (cleAbsenteSignalee) return
  cleAbsenteSignalee = true
  logger.error('[dictionnaire-materiaux/analyse] ANTHROPIC_API_KEY absente : analyses sur le secours Groq', { module: 'dictionnaire-materiaux' }, new Error('ANTHROPIC_API_KEY absente'))
}

interface Demande {
  dico: Dictionnaire
  description: string
  photos: string[]
  historique: TourHistorique[]
}

type ReponseModele = { reponse: GroqResponse; dico: Dictionnaire }

/** Claude, catalogue entier mis en cache, photos comprises ; sans le secours générique de lib/claude (catalogue entier). */
async function appelerClaude({ dico, description, photos, historique }: Demande): Promise<ReponseModele> {
  const reponse = await callClaudeWithRetry(
    { messages: construireMessages(dico, { description, photos, historique }), max_tokens: MAX_TOKENS, response_format: { type: 'json_object' } },
    { effort: 'medium', cacheSysteme: true, disableGroqFallback: true },
  )
  return { reponse, dico }
}

/**
 * Groq sur un catalogue réduit (sans photo) : cherché sur le message et les questions précédentes de l'artisan, avec
 * les matériaux de la réponse précédente ; le dernier échange seulement, pour rester sous la limite par minute.
 * L'usage est journalisé (marge réelle face à la limite) ; une réponse coupée par le budget l'est en avertissement.
 */
async function appelerGroq({ dico, description, historique }: Demande, cleGroq: string): Promise<ReponseModele> {
  const questions = historique.filter((tour) => tour.role === 'user').map((tour) => tour.texte)
  const reponsePrecedente = historique.filter((tour) => tour.role === 'assistant').at(-1)?.texte ?? ''
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
  const fin = reponse.choices?.[0]?.finish_reason
  const usage = { finish_reason: fin, prompt_tokens: reponse.usage?.prompt_tokens, completion_tokens: reponse.usage?.completion_tokens, materiaux: reduit.materiaux.length }
  if (fin === 'length') logger.warn('[dictionnaire-materiaux/analyse] secours Groq : réponse coupée par le budget de jetons', usage)
  else logger.info('[dictionnaire-materiaux/analyse] secours Groq', usage)
  return { reponse, dico: reduit }
}

/**
 * Appel du modèle. Claude d'abord, avec le catalogue entier (mis en cache) : lui seul lit les photos. S'il échoue sur
 * une demande sans photo, ou s'il n'a pas de clé, Groq prend le relais sur un catalogue réduit : le catalogue entier,
 * environ 19 000 jetons, dépasse les 8 000 par minute de l'offre Groq du compte (refus 413 constaté le 15/11/2026).
 * Rend aussi le dictionnaire des consignes : la réponse se relit avec lui.
 */
async function appelerModele(demande: Demande): Promise<ReponseModele> {
  if (!(await hasAnthropicKey())) {
    // La route a déjà refusé (503) les photos et l'absence de clé Groq.
    signalerCleAbsente()
    return appelerGroq(demande, (await getSecret('GROQ_API_KEY')) ?? '')
  }
  try {
    return await appelerClaude(demande)
  } catch (err) {
    const cleGroq = demande.photos.length > 0 ? '' : await getSecret('GROQ_API_KEY')
    if (!cleGroq) throw err
    signalerSecours(err)
    return appelerGroq(demande, cleGroq)
  }
}

/** Échec de l'appel : photo refusée par le modèle (l'artisan peut y remédier), sinon panne signalée à Sentry. */
function reponseDEchec(err: unknown, pays: string, nombrePhotos: number) {
  if (photoRefusee(err, nombrePhotos)) {
    logger.warn('[dictionnaire-materiaux/analyse] photo refusée par le modèle', { erreur: (err as Error).message.slice(0, 200) })
    return erreur('photo_illisible', 422)
  }
  // L'erreur en troisième argument : c'est elle qui part dans Sentry.
  logger.error('[dictionnaire-materiaux/analyse] échec de l’appel au modèle', { module: 'dictionnaire-materiaux', pays, photos: nombrePhotos }, err)
  return erreur('ia_indisponible', 502)
}

export async function POST(request: NextRequest) {
  const appelant = await verifierAppelant(request)
  if (appelant instanceof Response) return appelant
  const demande = await lireDemande(request)
  if (demande instanceof Response) return demande
  const { pays, photos, dico } = demande

  // Une photo n'a pas de secours possible : seul Claude la lit.
  if (!(await hasAnthropicKey()) && (photos.length > 0 || !(await getSecret('GROQ_API_KEY')))) return erreur('ia_indisponible', 503)

  const { description, historique, tokenMap } = masquerCoordonnees(demande)
  try {
    const { reponse, dico: dicoConsignes } = await traceAgent(
      {
        agent_id: 'dictionnaire-materiaux',
        user_id: appelant.id,
        // Ni la description ni les photos ne partent dans la trace : seulement leur taille.
        prompt: `Dictionnaire matériaux ${pays} : ${demande.description.length} caractères, ${photos.length} photo(s), ${demande.historique.length} tour(s) précédent(s)`,
        metadata: { module: 'dictionnaire-materiaux', pays, photos: photos.length },
      },
      () => appelerModele({ dico, description, photos, historique }),
    )
    return reponseDeLAnalyse(reponse.choices?.[0]?.message?.content?.trim() ?? '', dicoConsignes, pays, tokenMap)
  } catch (err) {
    return reponseDEchec(err, pays, photos.length)
  }
}
