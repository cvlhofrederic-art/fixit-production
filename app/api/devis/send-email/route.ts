import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { sendEmail } from '@/lib/email'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

// POST /api/devis/send-email — Envoie un devis/facture PDF par email via Resend
// Attend : { to, docType, docNumber, docTitle, totalStr, clientName, companyName, companyPhone?, pdfBase64 }
export async function POST(request: NextRequest) {
  let user = await getAuthUser(request)
  if (!user) {
    try {
      const serverClient = await createServerSupabaseClient()
      const { data } = await serverClient.auth.getUser()
      user = data.user
    } catch { /* noop */ }
  }
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  if (!(await checkRateLimit(`send_devis_${user.id}`, 20, 60_000))) return rateLimitResponse()

  let body: {
    to?: string
    docType?: 'devis' | 'facture'
    docNumber?: string
    docTitle?: string
    totalStr?: string
    clientName?: string
    companyName?: string
    companyPhone?: string
    pdfBase64?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { to, docType, docNumber, docTitle, totalStr, clientName, companyName, companyPhone, pdfBase64 } = body

  if (!to || !docType || !docNumber || !pdfBase64) {
    return NextResponse.json({ error: 'Champs requis manquants (to, docType, docNumber, pdfBase64)' }, { status: 400 })
  }

  const typeLabel = docType === 'devis' ? 'Devis' : 'Facture'
  const subject = `${typeLabel} ${docNumber}${companyName ? ' — ' + companyName : ''}`

  const signature = `${companyName || ''}${companyPhone ? `<br>${companyPhone}` : ''}`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.5;">
      <p>Bonjour ${clientName || ''},</p>
      <p>Veuillez trouver ci-joint votre ${typeLabel.toLowerCase()} N°${docNumber}${docTitle ? ` — ${docTitle}` : ''}${totalStr ? ` d'un montant de ${totalStr}` : ''}.</p>
      <p>À votre disposition pour toute question.</p>
      <p>Cordialement,<br>${signature}</p>
    </div>
  `.trim()

  const filename = `${docNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`

  const result = await sendEmail({
    to,
    subject,
    html,
    attachments: [{ filename, content: pdfBase64 }],
    tags: [
      { name: 'doc_type', value: docType },
      { name: 'artisan_id', value: user.id },
    ],
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Erreur envoi' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: result.id })
}
