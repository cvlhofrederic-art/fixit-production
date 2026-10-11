/**
 * Fournisseur Outlook / Microsoft 365 (plateforme d'identité Microsoft v2 + Microsoft
 * Graph), lecture seule.
 *
 * Autorité « common » : tout locataire Entra ID (Microsoft 365 professionnel, ex.
 * ajassocies.fr) et les comptes Outlook.com personnels. L'inscription d'application doit
 * donc être multilocataire + comptes personnels, plateforme « Web » (client confidentiel :
 * le code est échangé côté serveur avec le secret).
 */

import { logger } from '@/lib/logger'
import {
  ErreurFournisseur,
  LONGUEUR_CORPS,
  MAX_MESSAGES_RELEVE,
  debutFenetreReleve,
  expirationDepuis,
  urlApplication,
  type FournisseurBoite,
  type JetonsFournisseur,
  type MessageNormalise,
  type OptionsReleve,
} from './types'

const AUTORITE = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const URL_AUTORISATION = `${AUTORITE}/authorize`
const URL_JETON = `${AUTORITE}/token`
const GRAPH = 'https://graph.microsoft.com/v1.0'

/** offline_access : refresh_token ; User.Read : adresse du compte ; Mail.Read : lecture de la boîte. */
export const SCOPES_MICROSOFT = 'offline_access User.Read Mail.Read'

/** Adresse de retour OAuth Microsoft (à déclarer dans l'inscription d'application Entra). */
export function redirectUriMicrosoft(): string {
  return `${urlApplication()}/api/email-agent/callback/microsoft`
}

function identifiants(): { clientId: string; clientSecret: string } {
  return {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  }
}

// ── Erreurs Microsoft → codes courts ─────────────────────────────────────────

/**
 * Codes AADSTS connus → code court pour ?email_error=. Les autres erreurs donnent le
 * code OAuth s'il est simple (access_denied, invalid_grant…), sinon « microsoft_error ».
 */
const CODES_AADSTS: ReadonlyArray<[number, string]> = [
  [65001, 'consent_required'], // consentement manquant (utilisateur ou administrateur)
  [65004, 'consent_declined'], // l'utilisateur a refusé le consentement
  [90094, 'admin_approval_required'], // l'autorisation exige un administrateur du locataire
  [90095, 'admin_approval_required'], // consentement administrateur requis (flux de demande)
  [90099, 'admin_approval_required'], // application non autorisée dans le locataire
  [50011, 'redirect_uri_mismatch'], // adresse de retour non déclarée dans l'inscription
  [700016, 'app_not_found'], // MICROSOFT_CLIENT_ID inconnu
  [50194, 'app_not_multitenant'], // inscription monolocataire : /common refusé
  [50020, 'account_not_in_tenant'], // compte d'un autre locataire / personnel refusé
  [7000215, 'invalid_client_secret'], // secret erroné
  [7000222, 'invalid_client_secret'], // secret expiré
  [70000, 'invalid_grant'],
  [70008, 'invalid_grant'], // code ou jeton expiré
  [54005, 'invalid_grant'], // code déjà utilisé
  [9002327, 'spa_platform'], // plateforme « Application monopage » au lieu de « Web »
  [50105, 'user_not_assigned'], // affectation des utilisateurs exigée par l'application
  [53003, 'conditional_access'], // bloqué par l'accès conditionnel du locataire
]

export interface ErreurOAuthMicrosoft {
  error?: unknown
  error_description?: unknown
  error_codes?: unknown
}

/** Code court d'une erreur OAuth Microsoft (paramètres de retour ou réponse du jeton). */
export function codeErreurMicrosoft(e: ErreurOAuthMicrosoft): string {
  const codes = new Set<number>()
  if (Array.isArray(e.error_codes)) {
    for (const c of e.error_codes) if (typeof c === 'number') codes.add(c)
  }
  const description = typeof e.error_description === 'string' ? e.error_description : ''
  for (const m of description.matchAll(/AADSTS(\d+)/g)) codes.add(Number(m[1]))
  for (const [aadsts, code] of CODES_AADSTS) {
    if (codes.has(aadsts)) return code
  }
  const erreur = typeof e.error === 'string' ? e.error : ''
  return /^[a-z_]{1,40}$/.test(erreur) ? erreur : 'microsoft_error'
}

// ── Message Graph ────────────────────────────────────────────────────────────

export interface MessageGraph {
  id: string
  conversationId?: string | null
  subject?: string | null
  from?: { emailAddress?: { name?: string | null; address?: string | null } | null } | null
  receivedDateTime?: string | null
  body?: { contentType?: string | null; content?: string | null } | null
  bodyPreview?: string | null
}

/** Message Graph → forme commune (expéditeur au format « Nom <adresse> » comme l'en-tête Gmail). */
export function normaliserMessageGraph(msg: MessageGraph): MessageNormalise {
  const adresse = (msg.from?.emailAddress?.address || '').trim()
  const nom = (msg.from?.emailAddress?.name || '').replace(/["<>]/g, '').trim()
  let from = adresse
  if (adresse && nom && nom.toLowerCase() !== adresse.toLowerCase()) from = `${nom} <${adresse}>`
  else if (!adresse) from = nom

  let corps = msg.body?.content || ''
  // En-tête Prefer ignoré (rare) : corps HTML nettoyé comme le repli Gmail.
  if (msg.body?.contentType?.toLowerCase() === 'html') {
    corps = corps.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  }
  corps = corps.trim() || (msg.bodyPreview || '').trim()

  const recu = new Date(msg.receivedDateTime || '')
  return {
    id: msg.id,
    threadId: msg.conversationId || null,
    from,
    subject: msg.subject || '',
    bodyText: corps.substring(0, LONGUEUR_CORPS),
    receivedAt: Number.isNaN(recu.getTime()) ? new Date().toISOString() : recu.toISOString(),
  }
}

/** Requête Graph de relève : boîte de réception, lus ou non, du plus récent au plus ancien. */
export function urlReleveMicrosoft(premiereReleve: boolean, maintenant = Date.now()): string {
  // Littéral DateTimeOffset OData sans millisecondes (2026-09-11T08:00:00Z).
  const debut = debutFenetreReleve(premiereReleve, maintenant).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const params = [
    `$top=${MAX_MESSAGES_RELEVE}`,
    `$orderby=${encodeURIComponent('receivedDateTime desc')}`,
    `$filter=${encodeURIComponent(`receivedDateTime ge ${debut}`)}`,
    `$select=${['id', 'conversationId', 'subject', 'from', 'receivedDateTime', 'body', 'bodyPreview'].join(',')}`,
  ]
  return `${GRAPH}/me/mailFolders/inbox/messages?${params.join('&')}`
}

async function lireJson(res: Response, contexte: string): Promise<Record<string, unknown>> {
  return (await res.json().catch((err: unknown) => {
    logger.warn(`[email-agent/microsoft] ${contexte} : réponse illisible`, { status: res.status, erreur: err instanceof Error ? err.message : String(err) })
    return {}
  })) as Record<string, unknown>
}

/** Appel du point de terminaison de jeton (code d'autorisation ou refresh_token). */
async function demanderJetons(
  parametres: Record<string, string>,
  codeParDefaut: string,
): Promise<{ data: Record<string, unknown>; accessToken: string }> {
  const { clientId, clientSecret } = identifiants()
  const res = await fetch(URL_JETON, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: SCOPES_MICROSOFT,
      ...parametres,
    }),
  })
  const data = await lireJson(res, 'jeton')
  if (!res.ok || typeof data.access_token !== 'string' || !data.access_token) {
    const code = data.error ? codeErreurMicrosoft(data) : codeParDefaut
    throw new ErreurFournisseur(code, 'Jeton Microsoft refusé', {
      status: res.status,
      error: data.error,
      error_codes: data.error_codes,
      error_description: typeof data.error_description === 'string' ? data.error_description.slice(0, 500) : undefined,
      correlation_id: data.correlation_id,
    })
  }
  return { data, accessToken: data.access_token }
}

function versJetons(data: Record<string, unknown>, accessToken: string, email: string | null): JetonsFournisseur {
  return {
    accessToken,
    refreshToken: typeof data.refresh_token === 'string' && data.refresh_token ? data.refresh_token : null,
    expiresAt: expirationDepuis(data.expires_in),
    email,
    scope: typeof data.scope === 'string' ? data.scope : '',
  }
}

export const fournisseurMicrosoft: FournisseurBoite = {
  id: 'microsoft',
  nom: 'Outlook / Microsoft 365',

  configurationManquante() {
    const manquants: string[] = []
    const { clientId, clientSecret } = identifiants()
    if (!clientId) manquants.push('MICROSOFT_CLIENT_ID')
    if (!clientSecret) manquants.push('MICROSOFT_CLIENT_SECRET')
    if (!urlApplication()) manquants.push('NEXT_PUBLIC_APP_URL')
    return manquants
  },

  urlAutorisation(state: string) {
    const url = new URL(URL_AUTORISATION)
    url.searchParams.set('client_id', identifiants().clientId)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('redirect_uri', redirectUriMicrosoft())
    url.searchParams.set('response_mode', 'query')
    url.searchParams.set('scope', SCOPES_MICROSOFT)
    url.searchParams.set('prompt', 'select_account')
    url.searchParams.set('state', state)
    return url.toString()
  },

  async echangerCode(code: string): Promise<JetonsFournisseur> {
    const { data, accessToken } = await demanderJetons(
      { grant_type: 'authorization_code', code, redirect_uri: redirectUriMicrosoft() },
      'token_exchange',
    )

    // Adresse de la boîte : mail (Microsoft 365), sinon userPrincipalName (compte personnel).
    let email: string | null = null
    try {
      const profilRes = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (profilRes.ok) {
        const profil = (await profilRes.json()) as { mail?: string | null; userPrincipalName?: string | null }
        email = profil.mail || profil.userPrincipalName || null
      } else {
        logger.warn('[email-agent/microsoft] profil Graph refusé', { status: profilRes.status })
      }
    } catch (err) {
      logger.warn('[email-agent/microsoft] profil Graph illisible', { erreur: err instanceof Error ? err.message : String(err) })
    }

    return versJetons(data, accessToken, email)
  },

  async rafraichir(refreshToken: string): Promise<JetonsFournisseur> {
    // Microsoft renvoie un NOUVEAU refresh_token à chaque rafraîchissement : à ranger.
    const { data, accessToken } = await demanderJetons(
      { grant_type: 'refresh_token', refresh_token: refreshToken },
      'refresh_failed',
    )
    return versJetons(data, accessToken, null)
  },

  async recupererMessages(accessToken: string, { premiereReleve }: OptionsReleve): Promise<MessageNormalise[]> {
    const res = await fetch(urlReleveMicrosoft(premiereReleve), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Corps en texte brut (Graph convertit le HTML).
        Prefer: 'outlook.body-content-type="text"',
      },
    })
    if (!res.ok) {
      const data = await lireJson(res, 'relève')
      const erreur = (data.error ?? {}) as { code?: unknown; message?: unknown }
      // MailboxNotEnabledForRESTAPI : compte sans boîte Exchange Online (ou boîte sur site).
      const code = erreur.code === 'MailboxNotEnabledForRESTAPI' ? 'boite_indisponible' : 'lecture_impossible'
      throw new ErreurFournisseur(code, 'Lecture de la boîte Outlook impossible', {
        status: res.status,
        graph_code: erreur.code,
        message: typeof erreur.message === 'string' ? erreur.message.slice(0, 300) : undefined,
      })
    }
    const data = (await res.json()) as { value?: MessageGraph[] }
    return (data.value || []).slice(0, MAX_MESSAGES_RELEVE).map(normaliserMessageGraph)
  },
}
