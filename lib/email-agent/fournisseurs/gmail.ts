/**
 * Fournisseur Gmail / Google Workspace (OAuth Google + API Gmail), lecture seule.
 * Code déplacé des routes connect / callback / poll : comportement inchangé, sauf la
 * relève (in:inbox, lus ou non — voir recupererMessages).
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

const URL_AUTORISATION = 'https://accounts.google.com/o/oauth2/v2/auth'
const URL_JETON = 'https://oauth2.googleapis.com/token'
const URL_PROFIL = 'https://www.googleapis.com/oauth2/v2/userinfo'
const URL_MESSAGES = 'https://gmail.googleapis.com/gmail/v1/users/me/messages'

export const SCOPES_GMAIL = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

/** Adresse de retour OAuth Google (inchangée : déclarée dans la console Google Cloud). */
export function redirectUriGmail(): string {
  return `${urlApplication()}/api/email-agent/callback`
}

function identifiants(): { clientId: string; clientSecret: string } {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  }
}

// ── Message Gmail (format=full) ──────────────────────────────────────────────

interface PartieGmail {
  mimeType?: string
  body?: { data?: string }
  parts?: PartieGmail[]
  headers?: { name: string; value: string }[]
}

interface MessageGmail {
  id: string
  threadId?: string
  internalDate?: string
  payload?: PartieGmail
}

/** En-têtes utiles d'un message Gmail. */
function extraireEntetes(headers: { name: string; value: string }[]) {
  const get = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
  return { from: get('From'), subject: get('Subject') }
}

/** Corps texte d'un message Gmail : corps simple, sinon text/plain, sinon text/html nettoyé. */
export function extraireCorpsGmail(payload: PartieGmail | undefined): string {
  if (!payload) return ''

  // Message simple
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8').substring(0, LONGUEUR_CORPS)
  }

  // Message multipart — chercher text/plain en priorité
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8').substring(0, LONGUEUR_CORPS)
      }
    }
    // Repli sur text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64url').toString('utf-8')
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, LONGUEUR_CORPS)
      }
    }
  }

  return ''
}

/** Message Gmail → forme commune. */
export function normaliserMessageGmail(msg: MessageGmail): MessageNormalise {
  const entetes = extraireEntetes(msg.payload?.headers || [])
  const recu = new Date(Number.parseInt(msg.internalDate ?? '', 10))
  return {
    id: msg.id,
    threadId: msg.threadId ?? null,
    from: entetes.from,
    subject: entetes.subject,
    bodyText: extraireCorpsGmail(msg.payload),
    receivedAt: Number.isNaN(recu.getTime()) ? new Date().toISOString() : recu.toISOString(),
  }
}

/**
 * Requête de relève : boîte de réception, e-mails LUS OU NON depuis le début de la
 * fenêtre. Un gestionnaire lit son courrier au fil de la journée : « is:unread »
 * n'aurait rien montré. L'idempotence vient de la déduplication du poll
 * (gmail_message_id déjà en base = ignoré), pas du libellé UNREAD.
 */
export function requeteReleveGmail(premiereReleve: boolean, maintenant = Date.now()): string {
  const apres = Math.floor(debutFenetreReleve(premiereReleve, maintenant).getTime() / 1000)
  return `in:inbox after:${apres}`
}

async function lireJetons(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch((err: unknown) => {
    logger.warn('[email-agent/gmail] réponse OAuth illisible', { status: res.status, erreur: err instanceof Error ? err.message : String(err) })
    return {}
  })) as Record<string, unknown>
}

export const fournisseurGmail: FournisseurBoite = {
  id: 'gmail',
  nom: 'Gmail / Google Workspace',

  configurationManquante() {
    const manquants: string[] = []
    const { clientId, clientSecret } = identifiants()
    if (!clientId) manquants.push('GOOGLE_CLIENT_ID')
    if (!clientSecret) manquants.push('GOOGLE_CLIENT_SECRET')
    if (!urlApplication()) manquants.push('NEXT_PUBLIC_APP_URL')
    return manquants
  },

  urlAutorisation(state: string) {
    const url = new URL(URL_AUTORISATION)
    url.searchParams.set('client_id', identifiants().clientId)
    url.searchParams.set('redirect_uri', redirectUriGmail())
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', SCOPES_GMAIL)
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent') // Force le refresh_token
    url.searchParams.set('state', state)
    return url.toString()
  },

  async echangerCode(code: string): Promise<JetonsFournisseur> {
    const { clientId, clientSecret } = identifiants()
    const res = await fetch(URL_JETON, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUriGmail(),
        grant_type: 'authorization_code',
      }),
    })
    const data = await lireJetons(res)
    if (!res.ok || typeof data.access_token !== 'string' || !data.access_token) {
      throw new ErreurFournisseur('token_exchange', 'Échange du code Google refusé', {
        status: res.status, error: data.error, error_description: data.error_description,
      })
    }

    // Adresse du compte Gmail connecté
    let email: string | null = null
    try {
      const profilRes = await fetch(URL_PROFIL, { headers: { Authorization: `Bearer ${data.access_token}` } })
      const profil = (await profilRes.json()) as { email?: string }
      email = profil.email || null
    } catch (err) {
      logger.warn('[email-agent/gmail] profil Google illisible', { erreur: err instanceof Error ? err.message : String(err) })
    }

    return {
      accessToken: data.access_token,
      refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : null,
      expiresAt: expirationDepuis(data.expires_in),
      email,
      scope: typeof data.scope === 'string' ? data.scope : '',
    }
  },

  async rafraichir(refreshToken: string): Promise<JetonsFournisseur> {
    const { clientId, clientSecret } = identifiants()
    const res = await fetch(URL_JETON, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    })
    const data = await lireJetons(res)
    if (!res.ok || typeof data.access_token !== 'string' || !data.access_token) {
      throw new ErreurFournisseur('refresh_failed', 'Rafraîchissement du jeton Google refusé', {
        status: res.status, error: data.error, error_description: data.error_description,
      })
    }
    return {
      accessToken: data.access_token,
      // Google ne renvoie normalement pas de nouveau refresh_token : on garde l'ancien.
      refreshToken: typeof data.refresh_token === 'string' && data.refresh_token ? data.refresh_token : null,
      expiresAt: expirationDepuis(data.expires_in),
      email: null,
      scope: typeof data.scope === 'string' ? data.scope : '',
    }
  },

  async recupererMessages(accessToken: string, { premiereReleve }: OptionsReleve): Promise<MessageNormalise[]> {
    const q = requeteReleveGmail(premiereReleve)
    const listRes = await fetch(
      `${URL_MESSAGES}?maxResults=${MAX_MESSAGES_RELEVE}&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!listRes.ok) {
      const detail = await listRes.text().catch((err: unknown) => (err instanceof Error ? err.message : String(err)))
      throw new ErreurFournisseur('lecture_impossible', 'Lecture de la boîte Gmail impossible', {
        status: listRes.status, detail: detail.slice(0, 300),
      })
    }

    const listData = (await listRes.json()) as { messages?: { id: string; threadId: string }[] }
    const liste = (listData.messages || []).slice(0, MAX_MESSAGES_RELEVE)

    // Détail de chaque message, en parallèle ; un message illisible est ignoré.
    const details = await Promise.all(
      liste.map(async (msg) => {
        const msgRes = await fetch(`${URL_MESSAGES}/${msg.id}?format=full`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!msgRes.ok) {
          logger.warn('[email-agent/gmail] message illisible', { id: msg.id, status: msgRes.status })
          return null
        }
        return (await msgRes.json()) as MessageGmail
      }),
    )

    return details.filter((m): m is MessageGmail => !!m).map(normaliserMessageGmail)
  },
}
