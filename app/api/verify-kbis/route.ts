import { NextResponse, type NextRequest } from 'next/server'
import { callGroqWithRetry } from '@/lib/groq'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, verifyKbisFormSchema } from '@/lib/validation'
import { buildExtracted } from '@/lib/kbis-extract'

// ─── Groq Vision OCR prompts ─────────────────────────────────────────────────

const KBIS_PROMPT_FR = `Tu es un système OCR spécialisé dans les documents d'entreprise français (KBIS, extrait RCS).
Extrais TOUT le texte visible sur ce document : raison sociale, SIRET, SIREN, adresse du siège, gérant, date de constitution, forme juridique.
Retourne le texte brut extrait, sans formatage JSON.
Si le document est illisible, retourne "ILLISIBLE".`

const KBIS_PROMPT_PT = `És um sistema OCR especializado em documentos de empresa portugueses (Certidão Permanente, Registo Comercial).
Extrai TODO o texto visível neste documento: denominação, NIF/NIPC, morada da sede, gerente, data de constituição, forma jurídica.
Devolve o texto extraído em bruto, sem formatação JSON.
Se o documento for ilegível, devolve "ILEGÍVEL".`

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Rate limit : 5 requêtes/min par IP
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`verify_kbis_${ip}`, 5, 60_000)
  if (!allowed) return rateLimitResponse()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      const rawMarket = formData.get('market') as string | null
      return NextResponse.json(
        { error: rawMarket === 'pt_artisan'
            ? 'Formato não suportado. Use JPG, PNG ou PDF.'
            : 'Format non supporté. Utilisez JPG, PNG ou PDF.' },
        { status: 400 }
      )
    }

    const v = validateBody(verifyKbisFormSchema, { market: formData.get('market') })
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const market = v.data.market

    // Convertir en base64 pour Groq Vision
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const imageUrl = `data:${mimeType};base64,${base64}`

    const prompt = market === 'pt_artisan' ? KBIS_PROMPT_PT : KBIS_PROMPT_FR

    let ocrText = ''
    let confidence = 0
    try {
      const groqData = await callGroqWithRetry({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        }],
        temperature: 0.1,
        max_tokens: 3000,
      })
      ocrText = groqData.choices?.[0]?.message?.content || ''
      confidence = ocrText.length > 100 ? 75 : ocrText.length > 30 ? 50 : 15
      if (ocrText.trim() === 'ILLISIBLE' || ocrText.trim() === 'ILEGÍVEL') confidence = 5
    } catch (err) {
      logger.warn('[verify-kbis] Groq Vision error', err)
      confidence = 0
    }

    const extracted = buildExtracted(ocrText, market, confidence)

    // Échec OCR : confiance trop faible et aucun identifiant extrait
    if (confidence < 30 && extracted.identifiant === null) {
      const message =
        market === 'pt_artisan'
          ? 'Documento ilegível ou qualidade insuficiente. Verifique que a Certidão está legível.'
          : 'Document illisible ou qualité insuffisante. Vérifiez que le KBIS est net.'

      return NextResponse.json({ success: false, message }, { status: 422 })
    }

    return NextResponse.json({ success: true, extracted })
  } catch (error: unknown) {
    logger.error('[verify-kbis] Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la vérification du document' }, { status: 500 })
  }
}
