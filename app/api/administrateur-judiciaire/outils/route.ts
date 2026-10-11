// app/api/administrateur-judiciaire/outils/route.ts
//
// Outils IA de la succursale Administrateur judiciaire sur Claude Sonnet 5.5 :
// - « analyse-devis » : contrôle d'un devis ou d'une facture collé(e) en texte (Technique & travaux) ;
// - « redaction-pv » : projet de procès-verbal d'assemblée générale (Outils IA › Rédaction de PV) ;
// - « saisie-facture » : lecture d'une facture fournisseur, image ou PDF de 4 Mo au plus (Outils IA › Saisie de factures).
// Même garde que la route des agents (app/api/administrateur-judiciaire/agent) : session Supabase avec rôle syndic,
// limite de débit, données personnelles masquées avant le modèle et rétablies dans la réponse. Le fichier de la
// facture n'est pas masqué (le base64 serait altéré) ; il ne part ni dans les journaux ni dans Langfuse.
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getSecret } from '@/lib/env'
import { callClaudeWithRetry, ErreurClaude, hasAnthropicKey, type ClaudeCallConfig } from '@/lib/claude'
import type { GroqCallOptions } from '@/lib/groq'
import { traceAgent } from '@/lib/langfuse'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'
import {
  TAILLE_MAX_TEXTE_DEVIS,
  normaliserFactureExtraite,
  verifierDataUrlFacture,
  type FactureExtraite,
  type TacheOutilAJ,
} from '@/lib/administrateur-judiciaire/ia/outils'
import {
  construireDemandeAnalyseDevis,
  construireDemandePv,
  construireDemandeSaisieFacture,
  construirePromptAnalyseDevis,
  construirePromptRedactionPv,
  construirePromptSaisieFacture,
} from '@/lib/administrateur-judiciaire/ia/prompts-outils'

/** Corps de requête maximal (octets) : facture de 4 Mo encodée en base64 (≈ 5,6 Mo) et le reste de la demande. */
const TAILLE_MAX_CORPS = 6_000_000

/** Contexte du PV sérialisé (caractères) : copropriété et mandat, quelques centaines de caractères en pratique. */
const TAILLE_MAX_CONTEXTE = 20_000

/** Budget de réponse (hors réflexion, ajoutée par lib/claude) : le PV est le plus long. */
const MAX_TOKENS: Record<TacheOutilAJ, number> = { 'analyse-devis': 2500, 'redaction-pv': 4000, 'saisie-facture': 800 }

/** Ajoutée à une réponse coupée par max_tokens (italique en astérisques : seule forme rendue par MarkdownIA). */
const MENTION_TRONQUEE = '\n\n*(Réponse interrompue : longueur maximale atteinte. Relancez la demande.)*'

const DateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const BodySchema = z.discriminatedUnion('tache', [
  z.object({
    tache: z.literal('analyse-devis'),
    texte: z.string().trim().min(1).max(TAILLE_MAX_TEXTE_DEVIS),
    dateDuJour: DateIso.optional(),
  }),
  z.object({
    tache: z.literal('redaction-pv'),
    copropriete: z.string().trim().min(1).max(200),
    resolutions: z.array(z.string().trim().min(1).max(300)).min(1).max(30),
    dateDuJour: DateIso.optional(),
    contexte: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    tache: z.literal('saisie-facture'),
    fichier: z.string().min(1).max(TAILLE_MAX_CORPS),
    nomFichier: z.string().trim().max(200).default(''),
    coproprietes: z
      .array(z.object({ nom: z.string().trim().max(200), adresse: z.string().trim().optional() }))
      .default([])
      .transform((liste) =>
        liste
          .filter((c) => c.nom)
          .slice(0, 50)
          .map((c) => ({ nom: c.nom, ...(c.adresse ? { adresse: c.adresse.slice(0, 300) } : {}) })),
      ),
  }),
])

type Corps = z.infer<typeof BodySchema>

/** Requête prête pour Claude : messages, configuration, table des jetons PII et libellé de trace (sans le document). */
interface Demande {
  opts: GroqCallOptions
  config: ClaudeCallConfig
  tokenMap: Map<string, string>
  trace: string
}

const erreur = (code: string, status: number) => NextResponse.json({ error: code }, { status })

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  if (!(await checkRateLimit(`aj-outils:${ip}`, 20, 60_000))) return rateLimitResponse()

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isSyndicRole(user)) return erreur('non_autorise', 401)

  if (Number(req.headers.get('content-length') ?? 0) > TAILLE_MAX_CORPS) return erreur('fichier_trop_volumineux', 413)
  const brut = await req.text().catch(() => '')
  if (brut.length > TAILLE_MAX_CORPS) return erreur('fichier_trop_volumineux', 413)
  let json: unknown = null
  try {
    json = JSON.parse(brut)
  } catch (err) {
    logger.warn('[administrateur-judiciaire/outils] corps JSON illisible', { erreur: err instanceof Error ? err.message.slice(0, 120) : '' })
  }

  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) return erreur('requete_invalide', 400)
  const corps = parsed.data

  const demande = construireDemande(corps)
  if (demande instanceof NextResponse) return demande

  // La lecture d'un fichier n'a pas de secours possible (Llama, sur Groq, ne lit ni image ni PDF).
  const claudeDisponible = await hasAnthropicKey()
  if (!claudeDisponible && (corps.tache === 'saisie-facture' || !(await getSecret('GROQ_API_KEY')))) {
    return erreur('ia_indisponible', 503)
  }

  try {
    const reponse = await traceAgent(
      { agent_id: `aj-${corps.tache}`, user_id: user.id, prompt: demande.trace, metadata: { succursale: 'administrateur-judiciaire' } },
      () => callClaudeWithRetry(demande.opts, demande.config),
    )
    const choix = reponse.choices?.[0]
    const brut = choix?.message?.content?.trim() ?? ''
    if (!brut) return erreur('reponse_vide', 502)

    if (corps.tache === 'saisie-facture') {
      const facture = lireFacture(brut, demande.tokenMap)
      if (!facture) {
        logger.warn('[administrateur-judiciaire/outils] réponse de saisie illisible', { longueur: brut.length })
        return erreur('reponse_invalide', 502)
      }
      return NextResponse.json({ facture, modele: reponse.model ?? null })
    }

    const texte = (resolveSanitizedToken(brut, demande.tokenMap) ?? brut) + (choix?.finish_reason === 'length' ? MENTION_TRONQUEE : '')
    return NextResponse.json({ text: texte, modele: reponse.model ?? null })
  } catch (err) {
    if (corps.tache === 'saisie-facture' && err instanceof ErreurClaude && err.statut === 400) {
      logger.warn('[administrateur-judiciaire/outils] fichier refusé par le modèle', { erreur: err.message.slice(0, 200) })
      return erreur('fichier_illisible', 422)
    }
    logger.error('[administrateur-judiciaire/outils] échec de l’appel IA', {
      tache: corps.tache,
      erreur: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    })
    return erreur('ia_indisponible', 502)
  }
}

function construireDemande(corps: Corps): Demande | NextResponse {
  const dateDuJour =
    ('dateDuJour' in corps && corps.dateDuJour) || new Date().toISOString().slice(0, 10)

  switch (corps.tache) {
    case 'analyse-devis': {
      // Seuls e-mails, téléphones et IBAN sont masqués : l'indice d'adresse rendrait illisibles des lignes de
      // devis (« 25 chemin de câble… ») et les coordonnées d'une entreprise ne sont pas des données personnelles.
      const { sanitized, tokenMap } = sanitizeContextForLLM({ texte: corps.texte }, { types: ['email', 'phone', 'iban'] })
      return {
        opts: {
          messages: [
            { role: 'system', content: construirePromptAnalyseDevis(dateDuJour) },
            { role: 'user', content: construireDemandeAnalyseDevis(sanitized.texte) },
          ],
          max_tokens: MAX_TOKENS['analyse-devis'],
        },
        config: { effort: 'medium' },
        tokenMap,
        trace: `Analyse d'un devis ou d'une facture (${corps.texte.length} caractères)`,
      }
    }
    case 'redaction-pv': {
      if (JSON.stringify(corps.contexte).length > TAILLE_MAX_CONTEXTE) return erreur('contexte_trop_volumineux', 413)
      // Contexte, copropriété et résolutions masqués ensemble (même table de jetons).
      const { sanitized, tokenMap } = sanitizeContextForLLM({
        contexte: corps.contexte,
        copropriete: corps.copropriete,
        resolutions: corps.resolutions,
      })
      return {
        opts: {
          messages: [
            { role: 'system', content: construirePromptRedactionPv(JSON.stringify(sanitized.contexte, null, 1), dateDuJour) },
            { role: 'user', content: construireDemandePv(sanitized.copropriete, sanitized.resolutions) },
          ],
          max_tokens: MAX_TOKENS['redaction-pv'],
        },
        config: { effort: 'medium' },
        tokenMap,
        trace: `Projet de PV : ${corps.resolutions.length} résolution(s)`,
      }
    }
    case 'saisie-facture': {
      const fichier = verifierDataUrlFacture(corps.fichier)
      if (!fichier.ok) {
        return fichier.raison === 'taille' ? erreur('fichier_trop_volumineux', 413) : erreur('format_non_pris_en_charge', 400)
      }
      // Adresses d'immeubles en clair : elles servent à reconnaître la copropriété sur la facture (ce ne sont pas des
      // données personnelles) ; seul le nom du fichier est masqué.
      const { sanitized: masque, tokenMap } = sanitizeContextForLLM({ nomFichier: corps.nomFichier })
      const sanitized = { coproprietes: corps.coproprietes, nomFichier: masque.nomFichier }
      return {
        opts: {
          messages: [
            { role: 'system', content: construirePromptSaisieFacture(JSON.stringify(sanitized.coproprietes, null, 1)) },
            {
              role: 'user',
              content: [
                // lib/claude convertit la data URL en bloc image (PNG, JPEG, WebP) ou document (PDF).
                { type: 'image_url', image_url: { url: corps.fichier } },
                { type: 'text', text: construireDemandeSaisieFacture(sanitized.nomFichier) },
              ],
            },
          ],
          max_tokens: MAX_TOKENS['saisie-facture'],
          response_format: { type: 'json_object' },
        },
        config: { effort: 'low', disableGroqFallback: true },
        tokenMap,
        trace: `Lecture d'une facture fournisseur (${fichier.type}, ${fichier.octets} octets)`,
      }
    }
  }
}

/** JSON de la réponse → facture normalisée, jetons PII rétablis dans les textes ; null si illisible. */
function lireFacture(brut: string, tokenMap: Map<string, string>): FactureExtraite | null {
  let objet: unknown
  try {
    objet = JSON.parse(brut)
  } catch (err) {
    logger.warn('[administrateur-judiciaire/outils] JSON de saisie invalide', { erreur: err instanceof Error ? err.message.slice(0, 120) : '' })
    return null
  }
  const facture = normaliserFactureExtraite(objet)
  if (!facture) return null
  const resolue = Object.entries(facture).map(([cle, valeur]) => [
    cle,
    typeof valeur === 'string' ? (resolveSanitizedToken(valeur, tokenMap) ?? valeur) : valeur,
  ])
  return Object.fromEntries(resolue) as FactureExtraite
}
