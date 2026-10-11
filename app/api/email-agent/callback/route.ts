import { NextResponse, type NextRequest } from 'next/server'
import { validateBody, emailAgentCallbackSchema } from '@/lib/validation'
import { fournisseurGmail } from '@/lib/email-agent/fournisseurs'
import { traiterRetourOAuth } from '@/lib/email-agent/retour-oauth'

// ── Retour OAuth Google : échange du code, jetons rangés (provider 'gmail') ──
// Adresse inchangée (déclarée dans la console Google Cloud). Microsoft : ./microsoft.
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams)
  const v = validateBody(emailAgentCallbackSchema, params)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

  const { code, state, error } = v.data
  return traiterRetourOAuth({
    fournisseur: fournisseurGmail,
    code,
    state,
    codeErreur: codeErreurGoogle(error),
    origine: request.nextUrl.origin,
  })
}

/** Code d'erreur Google (access_denied…) gardé tel quel s'il est simple. */
function codeErreurGoogle(error: string | undefined): string | undefined {
  if (!error) return undefined
  return /^[a-z_]{1,40}$/.test(error) ? error : 'oauth_error'
}
