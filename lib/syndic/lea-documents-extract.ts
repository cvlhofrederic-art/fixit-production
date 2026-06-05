// P2 Léa Documents — OCR + extraction métadonnées
// PDFs : unpdf (déjà utilisé pour extract-pdf, Cloudflare Workers compat).
// Images : OCR différé en P2.1 (Tesseract trop lourd pour Workers, Workers AI vision = follow-up).
// Métadonnées : Groq llama-3.3-70b-versatile avec JSON mode strict.
import { callGroqWithRetry } from '@/lib/groq'
import { logger } from '@/lib/logger'

const MAX_TEXT_FOR_LLM = 8000

export type DocType =
  | 'facture_artisan' | 'facture_syndic' | 'devis' | 'contrat'
  | 'rib' | 'ata_ag' | 'releve_bancaire' | 'pv_assemblee' | 'autre'

export interface ExtractedMetadata {
  date_doc?: string | null
  montant_ttc?: number | null
  montant_ht?: number | null
  fournisseur?: string | null
  numero_facture?: string | null
  iban?: string | null
  type_detected?: DocType | null
  summary_short?: string | null
  raw_llm?: string
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<{ text: string; pages: number }> {
  const u8 = new Uint8Array(buffer)
  // Magic bytes %PDF
  if (u8.length < 5 || String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== '%PDF') {
    throw new Error('not_a_pdf')
  }
  const { extractText } = await import('unpdf')
  const res = await extractText(u8, { mergePages: true })
  const text = Array.isArray(res.text) ? res.text.join('\n\n') : (res.text || '')
  return { text, pages: res.totalPages || 0 }
}

const PROMPT_FR = `Tu es un assistant d'extraction de métadonnées comptables. À partir du texte extrait d'un document, renvoie un JSON strict avec les clés suivantes (toutes nullables si non trouvées) :
- date_doc : date du document au format ISO 8601 (YYYY-MM-DD) — privilégier la date de facture/devis, sinon date d'émission
- montant_ttc : montant TTC en EUR (nombre, point décimal)
- montant_ht : montant HT en EUR (nombre, point décimal)
- fournisseur : nom de l'entreprise émettrice (chaîne)
- numero_facture : numéro de facture/devis (chaîne)
- iban : IBAN si présent (chaîne sans espaces)
- type_detected : un de [facture_artisan, facture_syndic, devis, contrat, rib, ata_ag, releve_bancaire, pv_assemblee, autre]
- summary_short : résumé en 1 ligne (≤ 80 caractères, langue du document)

Ne renvoie QUE le JSON, rien d'autre. Pas de markdown, pas de commentaire.`

const PROMPT_PT = `És um assistente de extração de metadados contabilísticos. A partir do texto extraído de um documento, devolve um JSON estrito com as chaves seguintes (todas nullable se não encontradas) :
- date_doc : data do documento em ISO 8601 (YYYY-MM-DD)
- montant_ttc : montante com IVA em EUR (número, ponto decimal)
- montant_ht : montante sem IVA em EUR (número, ponto decimal)
- fournisseur : nome da empresa emitente (string)
- numero_facture : número de fatura/orçamento (string)
- iban : IBAN se presente (string sem espaços)
- type_detected : um de [facture_artisan, facture_syndic, devis, contrat, rib, ata_ag, releve_bancaire, pv_assemblee, autre]
- summary_short : resumo em 1 linha (≤ 80 caracteres, língua do documento)

Devolve APENAS o JSON, nada mais. Sem markdown, sem comentário.`

const VALID_TYPES = new Set<DocType>([
  'facture_artisan', 'facture_syndic', 'devis', 'contrat',
  'rib', 'ata_ag', 'releve_bancaire', 'pv_assemblee', 'autre',
])

function parseLLMOutput(raw: string): ExtractedMetadata {
  // Tolère les fences markdown éventuelles
  const cleaned = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  try {
    const parsed = JSON.parse(cleaned)
    const type = parsed.type_detected
    return {
      date_doc: typeof parsed.date_doc === 'string' ? parsed.date_doc : null,
      montant_ttc: typeof parsed.montant_ttc === 'number' ? parsed.montant_ttc : null,
      montant_ht: typeof parsed.montant_ht === 'number' ? parsed.montant_ht : null,
      fournisseur: typeof parsed.fournisseur === 'string' ? parsed.fournisseur : null,
      numero_facture: typeof parsed.numero_facture === 'string' ? parsed.numero_facture : null,
      iban: typeof parsed.iban === 'string' ? parsed.iban.replace(/\s+/g, '') : null,
      type_detected: typeof type === 'string' && VALID_TYPES.has(type as DocType) ? (type as DocType) : null,
      summary_short: typeof parsed.summary_short === 'string' ? parsed.summary_short.slice(0, 200) : null,
      raw_llm: raw.slice(0, 1000),
    }
  } catch (err) {
    logger.warn('[lea-documents/extract] JSON parse failed, returning empty metadata', err)
    return { raw_llm: raw.slice(0, 1000) }
  }
}

export async function extractMetadataFromText(
  text: string,
  locale: 'fr' | 'pt' = 'fr',
): Promise<ExtractedMetadata> {
  if (!text || text.trim().length < 20) {
    return { summary_short: null, raw_llm: '' }
  }

  const truncated = text.slice(0, MAX_TEXT_FOR_LLM)
  const system = locale === 'pt' ? PROMPT_PT : PROMPT_FR

  try {
    const completion = await callGroqWithRetry({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: truncated },
      ],
      temperature: 0.1,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    })
    const raw = completion?.choices?.[0]?.message?.content ?? ''
    return parseLLMOutput(raw)
  } catch (err) {
    logger.error('[lea-documents/extract] Groq call failed:', err)
    return {}
  }
}
