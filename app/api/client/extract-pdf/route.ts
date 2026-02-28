import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── POST /api/client/extract-pdf ────────────────────────────────────────────
// Extraction de texte PDF côté client avec nettoyage post-extraction

// Regex prix : gère "1 800,00 €", "800,00€", "1800.00", etc.
const PRICE_REGEX = /\d[\d\s]*[.,]\d{2}\s*€/g

function cleanExtractedText(raw: string): string {
  let text = raw
  // Fix mots coupés par tiret en fin de ligne
  text = text.replace(/(\w)-\n(\w)/g, '$1$2')
  // Supprimer caractères de contrôle (sauf newline et tab)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')

  // Séparer les blocs fusionnés par unpdf :
  // "Prix unitaire HT Quantité Total HT" → détecte les headers de colonnes fusionnés
  text = text.replace(/(Prix unitaire\s*HT|Quantité|Total\s*HT|Montant\s*HT|Montant\s*TTC|Taux\s*TVA|Unité)/gi, '\n$1')

  // Séparer les lignes numérotées fusionnées : "1) ... 2) ... 3) ..."
  text = text.replace(/(\S)\s+(\d+\))/g, '$1\n$2')

  // Séparer les blocs "Émetteur" / "Destinataire" / "Conditions" qui sont souvent collés
  text = text.replace(/(Émetteur|Destinataire|Conditions|Détail|Bon pour accord)/gi, '\n\n$1')

  // Ajouter un saut de ligne avant les prix pour les séparer des descriptions
  // Seulement quand un prix est collé à du texte sans chiffre avant
  text = text.replace(/([a-zéèêëàâùûôîïç])\s{2,}(\d[\d\s]*[.,]\d{2}\s*€)/gi, '$1\n$2')

  // Collapse espaces multiples restants (mais préserve les sauts de ligne)
  text = text.replace(/[ \t]{3,}/g, '  ')
  // Supprimer lignes vides en excès (max 2 consécutives)
  text = text.replace(/\n{4,}/g, '\n\n\n')
  // Supprimer lignes ne contenant que des underscores ou tirets (séparateurs PDF)
  text = text.replace(/^[_\-=]{5,}$/gm, '---')
  // Supprimer "Page X sur Y" répétés
  text = text.replace(/Page\s+\d+\s+sur\s+\d+/gi, '')
  return text.trim()
}

function assessQuality(text: string): 'good' | 'mediocre' | 'poor' {
  const pricePatterns = (text.match(PRICE_REGEX) || []).length
  const lines = text.split('\n').filter(l => l.trim().length > 0).length
  const avgLineLen = text.length / Math.max(lines, 1)
  const hasKeywords = /siret|tva|ht|ttc|devis|facture/i.test(text)

  if (pricePatterns >= 3 && avgLineLen > 15 && hasKeywords) return 'good'
  if (pricePatterns >= 1 || hasKeywords) return 'mediocre'
  return 'poor'
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const ok = await checkRateLimit(`extract-pdf-client:${ip}`, 10, 60)
  if (!ok) return rateLimitResponse()

  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo)' }, { status: 400 })

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) return NextResponse.json({ error: 'Format non supporté. Utilisez un fichier PDF.' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length < 5 || buffer.slice(0, 4).toString('ascii') !== '%PDF') {
      return NextResponse.json({ error: 'Le fichier ne semble pas être un PDF valide.', isCorrupt: true }, { status: 422 })
    }

    const { extractText } = await import('unpdf')
    let text = ''
    let numPages = 0

    try {
      const uint8 = new Uint8Array(buffer)
      const result = await extractText(uint8, { mergePages: true })
      text = result.text || ''
      numPages = result.totalPages || 0
    } catch (parseErr: any) {
      const errMsg = (parseErr?.message || '').toLowerCase()
      if (errMsg.includes('password') || errMsg.includes('encrypted')) {
        return NextResponse.json({ error: 'Ce PDF est protégé par un mot de passe.', isPasswordProtected: true }, { status: 422 })
      }
      if (errMsg.includes('invalid') || errMsg.includes('corrupt')) {
        return NextResponse.json({ error: 'Le fichier PDF semble corrompu.', isCorrupt: true }, { status: 422 })
      }
      return NextResponse.json({ error: 'Impossible d\'extraire le texte. Essayez de coller le texte manuellement.', isScanned: true }, { status: 422 })
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'Ce PDF ne contient pas de texte. Collez le texte manuellement.', isScanned: true }, { status: 422 })
    }

    const cleaned = cleanExtractedText(text)
    const quality = assessQuality(cleaned)

    // Détecter si c'est un PDF Vitfix (contient le marqueur metadata)
    const isVitfix = cleaned.includes('[VITFIX-DEVIS-METADATA]')

    return NextResponse.json({
      success: true,
      text: cleaned,
      pages: numPages,
      filename: file.name,
      chars: cleaned.length,
      quality: isVitfix ? 'good' : quality,
      isVitfix,
    })
  } catch (err: any) {
    console.error('[EXTRACT-PDF-CLIENT] Error:', err?.message || err)
    return NextResponse.json({ error: 'Erreur inattendue. Réessayez.' }, { status: 500 })
  }
}
