import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

interface SendKycEmailBody {
  to: string
  name: string
  company: string
  action: 'approve' | 'reject'
  rejection_reason?: string
  market?: string
}

function buildHtml(body: SendKycEmailBody): { subject: string; html: string } {
  const { name, company, action, rejection_reason, market } = body
  const isPt = market === 'pt_artisan'

  if (isPt) {
    if (action === 'approve') {
      return {
        subject: `Conta verificada — ${company}`,
        html: `
<h2>Parabéns ${name}!</h2>
<p>A sua conta <strong>${company}</strong> foi verificada e ativada no Vitfix.</p>
<p>Já pode aceder ao seu espaço profissional.</p>
<a href="https://vitfix.io/pro/dashboard" style="background:#FFC107;padding:12px 24px;border-radius:8px;text-decoration:none;color:#000;font-weight:bold;">Aceder ao meu espaço</a>
`,
      }
    }
    return {
      subject: `Registo não validado — ${company}`,
      html: `
<h2>Olá ${name},</h2>
<p>O registo para <strong>${company}</strong> não pôde ser validado.</p>
<p><strong>Motivo:</strong> ${rejection_reason ?? ''}</p>
<p>Contacte-nos em <a href="mailto:support@vitfix.io">support@vitfix.io</a> ou submeta novamente os seus documentos.</p>
`,
    }
  }

  // French (default)
  if (action === 'approve') {
    return {
      subject: `Votre compte ${company} est activé sur Vitfix`,
      html: `
<h2>Félicitations ${name} !</h2>
<p>Votre compte <strong>${company}</strong> a été vérifié et activé sur Vitfix.</p>
<p>Vous pouvez dès maintenant accéder à votre espace professionnel.</p>
<a href="https://vitfix.io/pro/dashboard" style="background:#FFC107;padding:12px 24px;border-radius:8px;text-decoration:none;color:#000;font-weight:bold;">Accéder à mon espace</a>
`,
    }
  }
  return {
    subject: `Inscription non validée — ${company}`,
    html: `
<h2>Bonjour ${name},</h2>
<p>Votre inscription pour <strong>${company}</strong> n'a pas pu être validée.</p>
<p><strong>Motif :</strong> ${rejection_reason ?? ''}</p>
<p>Contactez-nous à <a href="mailto:support@vitfix.io">support@vitfix.io</a> ou soumettez à nouveau vos documents.</p>
`,
  }
}

// POST /api/send-kyc-email — Internal endpoint (protected by x-internal-secret)
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Partial<SendKycEmailBody>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { to, name, company, action, rejection_reason, market } = body

  if (!to || !name || !company || !action) {
    return NextResponse.json({ error: 'Missing required fields: to, name, company, action' }, { status: 400 })
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    logger.warn('[send-kyc-email] RESEND_API_KEY not set — email not sent', { to, action })
    return NextResponse.json({ success: true })
  }

  const { subject, html } = buildHtml({ to, name, company, action, rejection_reason, market })

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Vitfix <noreply@vitfix.io>',
        to,
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      logger.error('[send-kyc-email] Resend API error', { status: res.status, detail, to })
      return NextResponse.json({ error: 'Email sending failed', detail }, { status: 502 })
    }

    logger.info('[send-kyc-email] Email sent', { to, action, market })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    logger.error('[send-kyc-email] Fetch to Resend failed', { to }, err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'Email sending failed' }, { status: 502 })
  }
}
