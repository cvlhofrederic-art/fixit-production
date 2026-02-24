import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── POST /api/syndic/extract-pdf ─────────────────────────────────────────────
// Reçoit un fichier PDF en multipart/form-data
// Retourne le texte extrait — pdf-parse v2 (API PDFParse class + getText())

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

    // pdf-parse v2 : API classe PDFParse
    const { PDFParse } = await import('pdf-parse')

    // Configurer le worker pdfjs pour Node.js
    PDFParse.setWorker()

    const parser = new PDFParse({ data: buffer })
    // Sans paramètres = toutes les pages par défaut
    const result = await parser.getText()

    const text: string = (result as any).text || ''

    if (!text.trim()) {
      return NextResponse.json({
        error: "Le PDF ne contient pas de texte extractible. Il s'agit peut-être d'un PDF scanné. Utilisez l'onglet 'Saisir le texte'.",
        isScanned: true,
      }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      text: text.trim(),
      pages: (result as any).pages?.length ?? 0,
      filename: file.name,
      chars: text.trim().length,
    })
  } catch (err: any) {
    console.error('[EXTRACT-PDF]', err?.message || err)
    return NextResponse.json({
      error: "Erreur lors de l'extraction. Vérifiez que le PDF n'est pas protégé par mot de passe.",
    }, { status: 500 })
  }
}
