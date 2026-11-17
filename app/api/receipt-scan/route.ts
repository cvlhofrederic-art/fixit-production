import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { appelerVision, dataUrlDocument, MAX_OCTETS_DOCUMENT, visionDisponible } from '@/lib/ai/relais'
import { logger } from '@/lib/logger'

// ── Receipt/Ticket OCR (lecture de l'image par Workers AI, lib/ai/relais.ts) ──
// Scans a receipt photo and extracts line items for devis injection

export interface ReceiptLine {
  name: string
  qty: number
  unit: string
  unitPrice: number
  totalPrice: number
}

export interface ReceiptScanResult {
  store: string
  date: string
  lines: ReceiptLine[]
  totalHT?: number
  totalTTC: number
  confidence: 'haute' | 'moyenne' | 'basse'
}

const RECEIPT_PROMPT = `Tu es un expert en lecture de tickets de caisse et factures de magasins de bricolage/matériaux (Leroy Merlin, Castorama, Point P, Brico Dépôt, Bricomarché, etc.).

Analyse cette image de ticket de caisse et extrais TOUTES les lignes d'articles achetés.

Retourne UNIQUEMENT un objet JSON valide, sans markdown :
{
  "store": "nom du magasin (ex: Leroy Merlin, Castorama) ou null",
  "date": "date d'achat au format YYYY-MM-DD ou null",
  "lines": [
    {
      "name": "description courte et claire de l'article (max 60 chars)",
      "qty": 1,
      "unit": "u",
      "unitPrice": 12.50,
      "totalPrice": 12.50
    }
  ],
  "totalHT": null,
  "totalTTC": 125.50,
  "confidence": "haute"
}

Règles :
- Extrais CHAQUE ligne d'article individuellement
- Pour qty, utilise le nombre exact sur le ticket (défaut: 1)
- Pour unit, utilise : "u" (unité), "m" (mètre), "m²", "kg", "l" (litre), "lot", "sac"
- unitPrice = prix unitaire HT si disponible, sinon prix TTC
- totalPrice = qty × unitPrice
- Si le ticket montre des prix TTC, indique-les tels quels (on gère la TVA côté app)
- Ignore les lignes de sous-total, TVA, remises globales, paiement CB
- confidence "haute" = texte net et lisible
- confidence "moyenne" = partiellement lisible
- confidence "basse" = flou ou incomplet
- Si tu ne peux pas lire le ticket, retourne { "store": null, "date": null, "lines": [], "totalTTC": 0, "confidence": "basse" }`

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(ip, 10, 60_000))) return rateLimitResponse()

    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { image_base64, mime_type = 'image/jpeg' } = body

    if (!image_base64) {
      return NextResponse.json({ error: 'image_base64 requis' }, { status: 400 })
    }

    // Poids maximal d'un document lu par un modèle (lib/ai/relais.ts), en caractères base64 (en-tête compris).
    if (image_base64.length > Math.ceil(MAX_OCTETS_DOCUMENT / 3) * 4 + 100) {
      return NextResponse.json({ error: 'Image trop grande (5 Mo maximum)' }, { status: 400 })
    }

    if (!(await visionDisponible())) {
      return NextResponse.json({ error: 'Analyse indisponible pour le moment. Réessayez plus tard.' }, { status: 503 })
    }

    // Vrai type d'après les premiers octets : une image dont le type déclaré ne correspond pas serait refusée.
    const imageUrl = dataUrlDocument(image_base64, mime_type)

    let ocrData
    try {
      ocrData = await appelerVision({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: RECEIPT_PROMPT + '\n\nAnalyse ce ticket de caisse :' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }, { contexte: 'receipt-scan' })
    } catch (ocrErr: unknown) {
      logger.error('Receipt scan vision error', { module: 'receipt-scan' }, ocrErr)
      return NextResponse.json({
        result: { store: '', date: '', lines: [], totalTTC: 0, confidence: 'basse' } satisfies ReceiptScanResult,
        error: 'Analyse vision échouée',
      })
    }

    const rawContent = ocrData.choices?.[0]?.message?.content || '{}'

    let result: ReceiptScanResult
    try {
      result = JSON.parse(rawContent)
    } catch {
      result = { store: '', date: '', lines: [], totalTTC: 0, confidence: 'basse' }
    }

    // Validate and clean lines
    if (Array.isArray(result.lines)) {
      result.lines = result.lines
        .filter(l => l && l.name && typeof l.unitPrice === 'number')
        .map(l => ({
          name: String(l.name).slice(0, 80),
          qty: Math.max(0.01, Number(l.qty) || 1),
          unit: l.unit || 'u',
          unitPrice: Math.max(0, Number(l.unitPrice) || 0),
          totalPrice: Math.max(0, Number(l.totalPrice) || (Number(l.qty || 1) * Number(l.unitPrice || 0))),
        }))
    } else {
      result.lines = []
    }

    result.confidence = ['haute', 'moyenne', 'basse'].includes(result.confidence)
      ? result.confidence
      : 'basse'

    return NextResponse.json({ result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Receipt scan route error:', msg)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}
