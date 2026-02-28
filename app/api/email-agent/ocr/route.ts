import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry } from '@/lib/groq'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── OCR via Groq Llama 3.2 Vision ─────────────────────────────────────────────
// Extrait les métadonnées d'une facture/rapport/devis depuis une image

export interface OCRResult {
  montant?: string
  artisan?: string
  date?: string
  immeuble?: string
  type_document?: string
  numero_doc?: string
  locataire?: string
  emetteur?: string
  description?: string
  confidence: 'haute' | 'moyenne' | 'basse'
}

const SYSTEM_PROMPT = `Tu es un expert en lecture de documents immobiliers et de copropriété.
Analyse cette image de document (facture, devis, rapport d'intervention, bon de travaux) et extrais les informations structurées.

Retourne UNIQUEMENT un objet JSON valide, sans markdown :
{
  "montant": "montant total avec devise (ex: 850,00 €) ou null",
  "artisan": "nom de l'artisan/entreprise émettrice ou null",
  "date": "date du document au format DD/MM/YYYY ou null",
  "immeuble": "nom ou adresse de l'immeuble/bien concerné ou null",
  "type_document": "facture" | "devis" | "rapport" | "bon_intervention" | "contrat" | "autre",
  "numero_doc": "numéro de facture/devis ou null",
  "locataire": "nom du propriétaire ou locataire concerné ou null",
  "emetteur": "nom complet de l'entreprise émettrice ou null",
  "description": "description courte des travaux/prestations (max 80 chars) ou null",
  "confidence": "haute" | "moyenne" | "basse"
}

Règles :
- confidence "haute" : infos clairement lisibles
- confidence "moyenne" : infos partiellement lisibles
- confidence "basse" : image floue ou infos peu claires
- Pour les montants, inclure le symbole € et les centimes
- Dates au format DD/MM/YYYY
- Si une info est absente du document, mets null (pas de chaîne vide)`

export async function POST(request: NextRequest) {
  try {
    // Rate limiting — 10 req/min (OCR = appel vision coûteux)
    const ip = getClientIP(request)
    if (!checkRateLimit(ip, 10, 60_000)) return rateLimitResponse()

    // Auth — doit être syndic ou artisan authentifié
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { image_base64, mime_type = 'image/jpeg' } = body

    if (!image_base64) {
      return NextResponse.json({ error: 'image_base64 requis' }, { status: 400 })
    }

    // Limiter la taille de l'image (max ~10MB base64)
    if (image_base64.length > 14_000_000) {
      return NextResponse.json({ error: 'Image trop grande (max 10MB)' }, { status: 400 })
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'Groq API non configurée' }, { status: 500 })
    }

    // Construire l'URL data ou utiliser directement le base64
    const imageUrl = image_base64.startsWith('data:')
      ? image_base64
      : `data:${mime_type};base64,${image_base64}`

    let groqData
    try {
      groqData = await callGroqWithRetry({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: SYSTEM_PROMPT + '\n\nAnalyse ce document :',
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }, { fallbackModel: 'meta-llama/llama-4-scout-17b-16e-instruct' })
    } catch (groqErr: any) {
      console.error('Groq Vision error:', groqErr.message)
      return NextResponse.json({
        result: { confidence: 'basse' } as OCRResult,
        error: 'Analyse vision échouée',
      })
    }

    const rawContent = groqData.choices?.[0]?.message?.content || '{}'

    let result: OCRResult
    try {
      result = JSON.parse(rawContent)
    } catch {
      result = { confidence: 'basse' }
    }

    // Valider confidence
    result.confidence = ['haute', 'moyenne', 'basse'].includes(result.confidence)
      ? result.confidence
      : 'basse'

    return NextResponse.json({ result })

  } catch (err: any) {
    console.error('OCR route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
