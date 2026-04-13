import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Lazy init — avoid crash at build time when env var is missing (CI)
const getResend = () => new Resend(process.env.RESEND_API_KEY)

const contactSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(200),
  email: z.string().email('Email invalide'),
  sujet: z.string().min(1, 'Sujet requis').max(200),
  message: z.string().min(1, 'Message requis').max(5000),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const data = contactSchema.parse(body)

    await getResend().emails.send({
      from: 'VITFIX Contact <onboarding@resend.dev>',
      to: 'contact@vitfix.io',
      replyTo: data.email,
      subject: `[Contact] ${data.sujet}`,
      text: `Nom : ${data.nom}\nEmail : ${data.email}\nSujet : ${data.sujet}\n\n${data.message}`,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 })
    }
    console.error('Contact email failed:', err)
    return NextResponse.json({ error: 'Erreur d\'envoi' }, { status: 500 })
  }
}
