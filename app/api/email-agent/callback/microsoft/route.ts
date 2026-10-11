import type { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { validateBody, emailAgentCallbackMicrosoftSchema } from '@/lib/validation'
import { codeErreurMicrosoft, fournisseurMicrosoft } from '@/lib/email-agent/fournisseurs'
import { redirectionTableauDeBord, traiterRetourOAuth } from '@/lib/email-agent/retour-oauth'

/**
 * Retour OAuth Microsoft (Outlook / Microsoft 365, autorité « common ») : échange du
 * code, jetons rangés avec provider 'microsoft', première relève du cabinet.
 *
 * Erreurs Microsoft (?error=…&error_description=AADSTS…) → ?email_error=<code court>
 * (consent_required, admin_approval_required, consent_declined…), détail dans les journaux.
 * Retour du consentement administrateur (…/adminconsent → ?admin_consent=True, sans code)
 * → ?email_admin_consent=true : la boîte se connecte ensuite normalement.
 */
export async function GET(request: NextRequest) {
  const origine = request.nextUrl.origin
  const params = Object.fromEntries(request.nextUrl.searchParams)
  const v = validateBody(emailAgentCallbackMicrosoftSchema, params)
  if (!v.success) {
    logger.warn('[email-agent/callback/microsoft] paramètres de retour invalides', { erreur: v.error })
    return redirectionTableauDeBord(origine, { email_error: 'invalid_request' })
  }

  const { code, state, error, error_description, admin_consent, tenant } = v.data

  if (error) {
    const codeCourt = codeErreurMicrosoft({ error, error_description })
    logger.error('[email-agent/callback/microsoft] connexion refusée par Microsoft', {
      code: codeCourt, error, error_description: error_description?.slice(0, 500), tenant,
    })
    return redirectionTableauDeBord(origine, { email_error: codeCourt })
  }

  if (!code && admin_consent?.toLowerCase() === 'true') {
    logger.info('[email-agent/callback/microsoft] consentement administrateur accordé', { tenant })
    return redirectionTableauDeBord(origine, { email_admin_consent: 'true' })
  }

  return traiterRetourOAuth({ fournisseur: fournisseurMicrosoft, code, state, origine })
}
