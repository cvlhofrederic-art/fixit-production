import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { isValidNif, validateBody, verifyNifQuerySchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`verify_nif_${ip}`, 10, 60_000))) return rateLimitResponse()

    const params = Object.fromEntries(request.nextUrl.searchParams)
    const v = validateBody(verifyNifQuerySchema, params)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

    const cleanNif = v.data.nif.replace(/\s/g, '')

    // 1. Format: 9 chiffres
    if (!/^\d{9}$/.test(cleanNif)) {
      return NextResponse.json({ verified: false, error: 'O NIF deve conter exatamente 9 dígitos' })
    }

    // 2. Checksum mod 11
    if (!isValidNif(cleanNif)) {
      return NextResponse.json({ verified: false, error: 'NIF inválido (dígito de controlo incorreto)' })
    }

    // 3. VIES — vérification réelle auprès du registre fiscal européen
    try {
      const viesRes = await fetch('https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: 'PT', vatNumber: cleanNif }),
        signal: AbortSignal.timeout(8000),
      })

      if (viesRes.ok) {
        const vies = await viesRes.json()

        if (vies.valid) {
          // Nettoyer le nom (VIES renvoie souvent en majuscules)
          const rawName = (vies.name || '').trim()
          const name = rawName === '---' || !rawName
            ? ''
            : rawName.split(' ').map((w: string) =>
                w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
              ).join(' ')

          const rawAddress = (vies.address || '').trim()
          const address = rawAddress === '---' ? '' : rawAddress

          return NextResponse.json({
            verified: true,
            company: {
              name: name || `Empresa NIF ${cleanNif}`,
              nif: cleanNif,
              address,
              viesValid: true,
            },
          })
        } else {
          // NIF valide (checksum ok) mais pas enregistré à la TVA
          // Peut être un ENI sans TVA — on accepte quand même
          return NextResponse.json({
            verified: true,
            company: {
              name: '',
              nif: cleanNif,
              viesValid: false,
            },
            warning: 'NIF válido mas não registado no VIES (pode ser isento de IVA)',
          })
        }
      }
    } catch {
      // VIES indisponible — fallback checksum only
    }

    // 4. Fallback si VIES down: checksum ok = on accepte
    return NextResponse.json({
      verified: true,
      company: {
        name: '',
        nif: cleanNif,
        viesValid: false,
      },
      warning: 'Verificação VIES indisponível. NIF aceite por validação local.',
    })
  } catch (err) {
    console.error('[verify-nif/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
