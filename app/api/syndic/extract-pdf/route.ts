import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── POST /api/syndic/extract-pdf ─────────────────────────────────────────────
// Reçoit un fichier PDF en multipart/form-data
// Retourne le texte extrait du PDF

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getClientIP(req)
  const ok = await checkRateLimit(`extract-pdf:${ip}`, 15, 60)
  if (!ok) return rateLimitResponse()

  // Auth
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo)' }, { status: 400 })

    const mimeOk = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!mimeOk) return NextResponse.json({ error: 'Format non supporté. Utilisez un fichier PDF.' }, { status: 400 })

    // Lire le buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extraction texte via pdf-parse
    // Import dynamique pour éviter problèmes SSR avec le module
    const pdfModule = await import('pdf-parse')
    const pdfParse = (pdfModule as any).default || pdfModule
    const pdfData = await pdfParse(buffer, {
      // Options pour maximiser l'extraction
      max: 0, // toutes les pages
    })

    const text = pdfData.text || ''

    if (!text.trim()) {
      return NextResponse.json({
        error: 'Le PDF ne contient pas de texte extractible. Il s\'agit peut-être d\'un PDF scanné (image). Essayez de copier-coller le texte manuellement.',
        isScanned: true,
      }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      text: text.trim(),
      pages: pdfData.numpages,
      filename: file.name,
      chars: text.trim().length,
    })
  } catch (err: any) {
    console.error('[EXTRACT-PDF]', err)
    return NextResponse.json({ error: 'Erreur lors de l\'extraction du PDF' }, { status: 500 })
  }
}
