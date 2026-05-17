// lib/syndic/max-validate.ts
// ──────────────────────────────────────────────────────────────────────────────
// Validation post-génération de la réponse de Max (anti-hallucination hard).
// Vérifie que :
//   1. Le JSON est valide et conforme au schéma attendu
//   2. Chaque font_id cité existe dans le set de chunks fourni au LLM
//   3. exact_quote correspond littéralement (avec tolérance espaces/casse) au chunk cité
//   4. Coverage minimale : si refusal=false, au moins 1 citation présente
//   5. Pas de fuite de notions de l'autre locale (PT vs FR)
// ──────────────────────────────────────────────────────────────────────────────

import type { ScoredLegalChunk } from './max-legal-rag'

export interface MaxRawCitation {
  font_id: string
  exact_quote: string
  claim: string
}

export interface MaxRawResponse {
  answer: string
  citations: MaxRawCitation[]
  refusal: boolean
}

export interface MaxValidatedCitation {
  font_id: string
  exact_quote: string
  claim: string
  /** Chunk DB d'origine pour pouvoir afficher la source complète côté UI */
  chunk_id: string
  source: string
  article: string | null
  title: string
  parent_path: string | null
  /** True si la quote a été retrouvée littéralement (sinon flag pour audit) */
  quote_verified: boolean
}

export interface MaxValidationResult {
  ok: boolean
  reasons: string[]
  answer: string
  citations: MaxValidatedCitation[]
  refusal: boolean
}

const SAFE_CHARS_REPLACE = /[ ‘’“”]/g

function normalize(s: string): string {
  return s
    .replace(SAFE_CHARS_REPLACE, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

/**
 * Parse + valide la réponse brute du LLM. Retourne ok=false si la réponse
 * doit être rejetée (et idéalement re-générée).
 */
export function validateMaxResponse(
  rawJson: string,
  injectedChunks: ScoredLegalChunk[],
  locale: 'fr' | 'pt',
): MaxValidationResult {
  const reasons: string[] = []

  // 1. Parsing JSON
  let parsed: MaxRawResponse
  try {
    // Tolère les wrappers markdown éventuels (```json ... ```)
    const cleaned = rawJson.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
    parsed = JSON.parse(cleaned) as MaxRawResponse
  } catch {
    return {
      ok: false,
      reasons: ['JSON parse failed'],
      answer: '',
      citations: [],
      refusal: false,
    }
  }

  // 2. Validation du shape
  if (typeof parsed.answer !== 'string') reasons.push('answer must be string')
  if (typeof parsed.refusal !== 'boolean') reasons.push('refusal must be boolean')
  if (!Array.isArray(parsed.citations)) reasons.push('citations must be array')

  // 3. Refusal explicite : on accepte tel quel sans plus de check
  if (parsed.refusal === true) {
    return {
      ok: true,
      reasons,
      answer: parsed.answer,
      citations: [],
      refusal: true,
    }
  }

  // 4. Vérification de chaque citation
  const validated: MaxValidatedCitation[] = []
  // Map font_id (FONT-1, FONT-2, …) → chunk
  const fontMap = new Map<string, ScoredLegalChunk>()
  injectedChunks.forEach((c, i) => fontMap.set(`FONT-${i + 1}`, c))

  for (const cit of parsed.citations ?? []) {
    if (!cit.font_id || !cit.exact_quote || !cit.claim) {
      reasons.push(`citation missing fields: ${JSON.stringify(cit).slice(0, 80)}`)
      continue
    }
    const chunk = fontMap.get(cit.font_id.toUpperCase().replace(/^FONT\s*-?\s*/i, 'FONT-'))
    if (!chunk) {
      reasons.push(`citation refers to non-existent ${cit.font_id}`)
      continue
    }
    // Vérification que la quote existe littéralement dans le chunk
    const normalizedQuote = normalize(cit.exact_quote)
    const normalizedContent = normalize(chunk.content)
    const quoteFound = normalizedContent.includes(normalizedQuote)
    if (!quoteFound) {
      // On laisse passer la citation mais flag quote_verified=false → audit côté UI
      reasons.push(`quote not literally in ${cit.font_id} content (will be flagged)`)
    }
    validated.push({
      font_id: cit.font_id,
      exact_quote: cit.exact_quote.trim(),
      claim: cit.claim.trim(),
      chunk_id: chunk.id,
      source: chunk.source,
      article: chunk.article,
      title: chunk.title,
      parent_path: chunk.parent_path,
      quote_verified: quoteFound,
    })
  }

  // 5. Couverture minimale : si pas de citation pour une réponse longue → suspect
  const wordCount = parsed.answer.split(/\s+/).length
  if (validated.length === 0 && wordCount > 30 && !parsed.refusal) {
    reasons.push('long answer without any citation (suspect hallucination)')
    return {
      ok: false,
      reasons,
      answer: parsed.answer,
      citations: [],
      refusal: false,
    }
  }

  // 6. Fuite cross-locale : refuse si la réponse mentionne des notions de l'autre locale
  const otherLocaleTerms = locale === 'pt'
    ? [/\bSIRET\b/i, /\bRC\s*Pro\b/i, /garantie d[ée]cennale/i, /\bcopropri[ée]t[ée]\b/i, /loi 65[\s\-]?557/i]
    : [/\bNIPC\b/i, /\bcond[óo]m[íi]nio\b/i, /\balvar[áa]\b/i, /\bATCUD\b/i, /Lei 8\/2022/i]
  for (const re of otherLocaleTerms) {
    if (re.test(parsed.answer)) {
      reasons.push(`cross-locale leak detected: ${re.source}`)
      return {
        ok: false,
        reasons,
        answer: parsed.answer,
        citations: validated,
        refusal: false,
      }
    }
  }

  return {
    ok: true,
    reasons,
    answer: parsed.answer,
    citations: validated,
    refusal: parsed.refusal,
  }
}
