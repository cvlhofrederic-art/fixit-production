import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, resetPasswordSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const v = validateBody(resetPasswordSchema, body)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  const { email } = v.data

  // Rate limit: 3 requests per 5 minutes per IP (prevent brute force / email spam)
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`reset_pwd_${ip}`, 3, 300_000)
  if (!allowed) return rateLimitResponse()

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c) {
          try {
            c.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch { /* read-only in some contexts */ }
        },
      },
    }
  )

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${new URL(request.url).origin}/auth/update-password`,
  })

  if (error) {
    logger.error('[RESET-PASSWORD]', error.message)
    return NextResponse.json({ error: 'Erreur lors de l\'envoi' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Email envoyé' })
}
