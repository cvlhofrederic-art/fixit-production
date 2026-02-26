import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── POST /api/syndic/extract-pdf ─────────────────────────────────────────────
// Reçoit un fichier PDF en multipart/form-data
// Retourne le texte extrait — utilise unpdf (Vercel/Node.js compatible, sans binaires natifs)

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const ok = await checkRateLimit(`extract-pdf:${ip}`, 15, 60)
  if (!ok) return rateLimitResponse()

  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo)' }, { status: 400 })

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) return NextResponse.json({ error: 'Format non supporté. Utilisez un fichier PDF.' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Vérifier les magic bytes %PDF
    if (buffer.length < 5 || buffer.slice(0, 4).toString('ascii') !== '%PDF') {
      return NextResponse.json({
        error: 'Le fichier ne semble pas être un PDF valide.',
        isCorrupt: true,
      }, { status: 422 })
    }

    // Extraction via unpdf — compatible Vercel serverless, pas de binaires natifs
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
      const errName = parseErr?.name || ''

      // PDF protégé par mot de passe
      if (
        errMsg.includes('password') ||
        errMsg.includes('encrypted') ||
        errMsg.includes('encrypt') ||
        errName === 'PasswordException'
      ) {
        return NextResponse.json({
          error: 'Ce PDF est protégé par un mot de passe. Veuillez le déverrouiller avant de l\'importer.',
          isPasswordProtected: true,
        }, { status: 422 })
      }

      // PDF corrompu
      if (
        errMsg.includes('invalid') ||
        errMsg.includes('corrupt') ||
        errMsg.includes('malformed') ||
        errMsg.includes('not a pdf') ||
        errMsg.includes('invalid pdf')
      ) {
        return NextResponse.json({
          error: 'Le fichier PDF semble corrompu ou invalide.',
          isCorrupt: true,
        }, { status: 422 })
      }

      // Autres erreurs → probablement PDF scanné
      console.error('[EXTRACT-PDF] Parse error:', parseErr?.message || parseErr)
      return NextResponse.json({
        error: 'Impossible d\'extraire le texte. Ce PDF est peut-être scanné (image). Utilisez l\'onglet "Saisir le texte" pour saisir manuellement.',
        isScanned: true,
      }, { status: 422 })
    }

    // PDF sans texte extractible → probablement scanné
    if (!text.trim()) {
      return NextResponse.json({
        error: 'Ce PDF ne contient pas de texte extractible. Il s\'agit probablement d\'un PDF scanné (image). Utilisez l\'onglet "Saisir le texte".',
        isScanned: true,
      }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      text: text.trim(),
      pages: numPages,
      filename: file.name,
      chars: text.trim().length,
    })

  } catch (err: any) {
    console.error('[EXTRACT-PDF] Unexpected error:', err?.message || err)
    return NextResponse.json({
      error: 'Une erreur inattendue s\'est produite. Réessayez ou utilisez l\'onglet "Saisir le texte".',
    }, { status: 500 })
  }
}
