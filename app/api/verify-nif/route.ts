import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { isValidNif } from '@/lib/validation'

export async function GET(request: NextRequest) {
  // Rate limit anti-énumération NIF : 10 req/min par IP
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`verify_nif_${ip}`, 10, 60_000))) return rateLimitResponse()

  const nif = request.nextUrl.searchParams.get('nif')

  if (!nif) {
    return NextResponse.json({ error: 'NIF obrigatório' }, { status: 400 })
  }

  const cleanNif = nif.replace(/\s/g, '')

  // 1. Validate format: exactly 9 digits
  if (!/^\d{9}$/.test(cleanNif)) {
    return NextResponse.json({
      verified: false,
      error: 'O NIF deve conter exatamente 9 dígitos',
      step: 'format',
    })
  }

  // 2. Validate check digit (mod 11 algorithm)
  if (!isValidNif(cleanNif)) {
    return NextResponse.json({
      verified: false,
      error: 'NIF inválido (dígito de controlo incorreto)',
      step: 'checksum',
    })
  }

  // 3. Valid NIF — return success
  return NextResponse.json({
    verified: true,
    company: {
      name: 'NIF Válido',
      nif: cleanNif,
    },
  })
}
