import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── POST /api/client/extract-pdf ────────────────────────────────────────────
// Extraction de texte PDF côté client — même logique que syndic sans restriction de rôle

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

    return NextResponse.json({ success: true, text: text.trim(), pages: numPages, filename: file.name, chars: text.trim().length })
  } catch (err: any) {
    console.error('[EXTRACT-PDF-CLIENT] Error:', err?.message || err)
    return NextResponse.json({ error: 'Erreur inattendue. Réessayez.' }, { status: 500 })
  }
}
