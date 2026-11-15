import { NextResponse, type NextRequest } from 'next/server'
import { appelerVision, MAX_OCTETS_DOCUMENT, typeDocument } from '@/lib/ai/relais'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, verifyKbisFormSchema } from '@/lib/validation'
import { buildExtracted } from '@/lib/kbis-extractors'

// ─── OCR prompts (image lue par Workers AI, PDF par sa couche de texte : lib/ai/relais.ts) ──

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

  // Session exigée : la lecture d'une image consomme le quota Workers AI du compte (payant au-delà), et l'application
  // n'appelle plus cette route
  // (l'inscription lit le Kbis dans lib/kyc-orchestrate.ts).
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
    }

    // Poids maximal d'un document lu par un modèle (lib/ai/relais.ts)
    if (file.size > MAX_OCTETS_DOCUMENT) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 5 Mo)' }, { status: 400 })
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

    // Convertir en base64 (image lue par Workers AI, PDF par sa couche de texte)
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    // Type réel d'après les premiers octets (un type déclaré faux fait refuser le document)
    const mimeType = typeDocument(new Uint8Array(arrayBuffer)) ?? (file.type || 'image/jpeg')
    const imageUrl = `data:${mimeType};base64,${base64}`

    const prompt = market === 'pt_artisan' ? KBIS_PROMPT_PT : KBIS_PROMPT_FR

    let ocrText = ''
    let confidence = 0
    try {
      const ocrData = await appelerVision({
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        }],
        max_tokens: 3000,
      }, { contexte: 'verify-kbis', pdf: true, maxPagesPdf: 10 })
      ocrText = ocrData.choices?.[0]?.message?.content || ''
      confidence = ocrText.length > 100 ? 75 : ocrText.length > 30 ? 50 : 15
      if (ocrText.trim() === 'ILLISIBLE' || ocrText.trim() === 'ILEGÍVEL') confidence = 5
    } catch (err) {
      logger.warn('[verify-kbis] OCR error', err)
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
