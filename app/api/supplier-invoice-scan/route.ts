import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { appelerVision, dataUrlDocument, MAX_OCTETS_DOCUMENT, visionDisponible } from '@/lib/ai/relais'
import { logger } from '@/lib/logger'

// ── Supplier Invoice / Devis Fournisseur OCR (lecture par Workers AI, lib/ai/relais.ts) ──
// Extracts material lines from a supplier quote/invoice (PDF rendered as image)

export interface SupplierLine {
  name: string
  qty: number
  unit: string
  unitPriceHT: number
  tvaRate: number
}

export interface SupplierScanResult {
  supplier: string | null
  invoiceRef: string | null
  date: string | null
  lines: SupplierLine[]
  totalHT: number | null
  totalTTC: number | null
  confidence: 'haute' | 'moyenne' | 'basse'
}

const SUPPLIER_PROMPT = `Tu es un expert en lecture de devis et factures de fournisseurs matériaux BTP (Point P, Cedeo, Rexel, BigMat, Brossette, Prolians, etc.).

Analyse cette image de devis/facture fournisseur et extrais TOUTES les lignes de matériaux.

Retourne UNIQUEMENT un objet JSON valide, sans markdown :
{
  "supplier": "nom du fournisseur ou null",
  "invoiceRef": "référence du document ou null",
  "date": "date au format YYYY-MM-DD ou null",
  "lines": [
    {
      "name": "description claire du matériau (max 80 chars)",
      "qty": 1,
      "unit": "u",
      "unitPriceHT": 12.50,
      "tvaRate": 20
    }
  ],
  "totalHT": 125.50,
  "totalTTC": 150.60,
  "confidence": "haute"
}

Règles :
- Extrais CHAQUE ligne de matériau individuellement
- Pour qty, utilise le nombre exact sur le document (défaut: 1)
- Pour unit, utilise : "u" (unité), "m" (mètre), "ml" (mètre linéaire), "m2" (m²), "m3" (m³), "kg", "l" (litre), "lot", "sac", "rl" (rouleau), "bte" (boîte), "pl" (plaque)
- unitPriceHT = prix unitaire HT. Si seul le TTC est visible, divise par (1 + tvaRate/100)
- tvaRate = taux TVA applicable (20, 10, 5.5 ou 0). Par défaut 20
- Ignore les lignes de sous-total, frais de port, remises globales, conditions de paiement
- confidence "haute" = texte net, toutes les colonnes lisibles
- confidence "moyenne" = partiellement lisible ou colonnes manquantes
- confidence "basse" = flou, tronqué ou illisible
- Si tu ne peux pas lire le document, retourne { "supplier": null, "invoiceRef": null, "date": null, "lines": [], "totalHT": null, "totalTTC": null, "confidence": "basse" }`

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(ip, 8, 60_000))) return rateLimitResponse()

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
              { type: 'text', text: SUPPLIER_PROMPT + '\n\nAnalyse ce devis/facture fournisseur :' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }, { contexte: 'supplier-invoice-scan' })
    } catch (ocrErr: unknown) {
      logger.error('Supplier invoice scan vision error', { module: 'supplier-invoice-scan' }, ocrErr)
      return NextResponse.json({
        result: { supplier: null, invoiceRef: null, date: null, lines: [], totalHT: null, totalTTC: null, confidence: 'basse' } satisfies SupplierScanResult,
        error: 'Analyse vision échouée',
      })
    }

    const rawContent = ocrData.choices?.[0]?.message?.content || '{}'

    let result: SupplierScanResult
    try {
      result = JSON.parse(rawContent)
    } catch {
      result = { supplier: null, invoiceRef: null, date: null, lines: [], totalHT: null, totalTTC: null, confidence: 'basse' }
    }

    // Validate and clean lines
    if (Array.isArray(result.lines)) {
      result.lines = result.lines
        .filter(l => l && l.name && typeof l.unitPriceHT === 'number')
        .map(l => ({
          name: String(l.name).slice(0, 100),
          qty: Math.max(0.01, Number(l.qty) || 1),
          unit: l.unit || 'u',
          unitPriceHT: Math.max(0, Number(l.unitPriceHT) || 0),
          tvaRate: [20, 10, 5.5, 0].includes(Number(l.tvaRate)) ? Number(l.tvaRate) : 20,
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
    logger.error('Supplier invoice scan route error:', msg)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}
