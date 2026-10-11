// Fournisseurs de boîte d'Alfredo (lib/email-agent/fournisseurs) : Gmail / Google Workspace
// et Outlook / Microsoft 365 (Microsoft Graph). Adresses d'autorisation, échange du code,
// rafraîchissement (rotation du refresh_token Microsoft), relève normalisée, erreurs.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import {
  ErreurFournisseur,
  FOURNISSEURS,
  codeErreurMicrosoft,
  fournisseurDeLigne,
  fournisseurGmail,
  fournisseurMicrosoft,
} from '@/lib/email-agent/fournisseurs'
import { normaliserMessageGmail, requeteReleveGmail } from '@/lib/email-agent/fournisseurs/gmail'
import { normaliserMessageGraph, urlReleveMicrosoft } from '@/lib/email-agent/fournisseurs/microsoft'

const MAINTENANT = Date.parse('2026-10-11T12:00:00.000Z')
const JOUR = 86_400_000

type Appel = { url: string; init?: RequestInit }

/** fetch simulé : chaque réponse est choisie par une fonction de l'URL. */
function stubFetch(repondre: (url: string, init?: RequestInit) => { status?: number; body: unknown }) {
  const appels: Appel[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, init })
    const { status = 200, body } = repondre(url, init)
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  }))
  return appels
}

const corpsFormulaire = (init?: RequestInit) => new URLSearchParams(String(init?.body))
const entete = (init: RequestInit | undefined, nom: string) => (init?.headers as Record<string, string>)[nom]

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-id')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret')
  vi.stubEnv('MICROSOFT_CLIENT_ID', 'ms-client-id')
  vi.stubEnv('MICROSOFT_CLIENT_SECRET', 'ms-secret')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('registre des fournisseurs', () => {
  it('provider vide = gmail (défaut de la colonne), microsoft reconnu, valeur inconnue = null', () => {
    expect(fournisseurDeLigne(null)).toBe(fournisseurGmail)
    expect(fournisseurDeLigne('')).toBe(fournisseurGmail)
    expect(fournisseurDeLigne('gmail')).toBe(fournisseurGmail)
    expect(fournisseurDeLigne('microsoft')).toBe(fournisseurMicrosoft)
    expect(fournisseurDeLigne('exchange-ews')).toBeNull()
    expect(fournisseurDeLigne('toString')).toBeNull()
    expect(Object.keys(FOURNISSEURS)).toEqual(['gmail', 'microsoft', 'imap'])
  })

  it('configuration manquante nommée par fournisseur', () => {
    expect(fournisseurMicrosoft.configurationManquante()).toEqual([])
    vi.stubEnv('MICROSOFT_CLIENT_SECRET', '')
    expect(fournisseurMicrosoft.configurationManquante()).toEqual(['MICROSOFT_CLIENT_SECRET'])
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    expect(fournisseurGmail.configurationManquante()).toEqual(['GOOGLE_CLIENT_ID', 'NEXT_PUBLIC_APP_URL'])
  })
})

describe('Gmail / Google Workspace', () => {
  it('adresse d’autorisation inchangée (lecture seule, refresh_token forcé, retour /callback)', () => {
    const url = new URL(fournisseurGmail.urlAutorisation('cab:nonce'))
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('google-id')
    expect(url.searchParams.get('redirect_uri')).toBe('https://vitfix.io/api/email-agent/callback')
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('state')).toBe('cab:nonce')
  })

  it('relève : boîte de réception, lus OU non (plus de is:unread), 30 jours la première fois, 7 ensuite', () => {
    expect(requeteReleveGmail(true, MAINTENANT)).toBe(`in:inbox after:${(MAINTENANT - 30 * JOUR) / 1000}`)
    expect(requeteReleveGmail(false, MAINTENANT)).toBe(`in:inbox after:${(MAINTENANT - 7 * JOUR) / 1000}`)
    expect(requeteReleveGmail(true, MAINTENANT)).not.toContain('is:unread')
  })

  it('recupererMessages : 20 au plus, requête encodée, messages normalisés', async () => {
    vi.useFakeTimers({ now: MAINTENANT, toFake: ['Date'] })
    const html = Buffer.from('<p>Bonjour,</p><p>fuite   au 3e</p>').toString('base64url')
    const appels = stubFetch((url) => {
      if (url.includes('/users/me/messages?')) return { body: { messages: [{ id: 'm1', threadId: 't1' }, { id: 'm2', threadId: 't2' }] } }
      if (url.includes('/users/me/messages/m1?')) {
        return { body: { id: 'm1', threadId: 't1', internalDate: '1760176800000', payload: { headers: [{ name: 'From', value: '"Julien Rousseau" <j.rousseau@example.fr>' }, { name: 'Subject', value: 'Fuite' }], body: { data: Buffer.from('Fuite au 3e').toString('base64url') } } } }
      }
      return { body: { id: 'm2', threadId: 't2', internalDate: '1760176800000', payload: { headers: [], parts: [{ mimeType: 'text/html', body: { data: html } }] } } }
    })
    const messages = await fournisseurGmail.recupererMessages('ya29', { premiereReleve: true })
    const liste = new URL(appels[0].url)
    expect(liste.searchParams.get('maxResults')).toBe('20')
    expect(liste.searchParams.get('q')).toBe(`in:inbox after:${(MAINTENANT - 30 * JOUR) / 1000}`)
    expect(entete(appels[0].init, 'Authorization')).toBe('Bearer ya29')
    expect(messages).toEqual([
      { id: 'm1', threadId: 't1', from: '"Julien Rousseau" <j.rousseau@example.fr>', subject: 'Fuite', bodyText: 'Fuite au 3e', receivedAt: new Date(1760176800000).toISOString() },
      { id: 'm2', threadId: 't2', from: '', subject: '', bodyText: 'Bonjour, fuite au 3e', receivedAt: new Date(1760176800000).toISOString() },
    ])
  })

  it('liste refusée par Gmail : ErreurFournisseur lecture_impossible', async () => {
    stubFetch(() => ({ status: 401, body: { error: { message: 'Invalid Credentials' } } }))
    await expect(fournisseurGmail.recupererMessages('ya29', { premiereReleve: false })).rejects.toMatchObject({ code: 'lecture_impossible' })
  })

  it('normalisation : text/plain prioritaire, corps tronqué à 1000 caractères, date absente = maintenant', () => {
    const long = 'x'.repeat(1500)
    const msg = normaliserMessageGmail({
      id: 'm', payload: { parts: [{ mimeType: 'text/html', body: { data: Buffer.from('<b>html</b>').toString('base64url') } }, { mimeType: 'text/plain', body: { data: Buffer.from(long).toString('base64url') } }] },
    })
    expect(msg.bodyText).toHaveLength(1000)
    expect(msg.threadId).toBeNull()
    expect(Number.isNaN(Date.parse(msg.receivedAt))).toBe(false)
  })

  it('échange du code : jetons + adresse du profil Google', async () => {
    const appels = stubFetch((url) => {
      if (url === 'https://oauth2.googleapis.com/token') return { body: { access_token: 'ya29', refresh_token: '1//r', expires_in: 3599, scope: 'gmail.readonly' } }
      return { body: { email: 'frederic@gmail.com' } }
    })
    const jetons = await fournisseurGmail.echangerCode('code-g')
    const corps = corpsFormulaire(appels[0].init)
    expect(corps.get('grant_type')).toBe('authorization_code')
    expect(corps.get('code')).toBe('code-g')
    expect(corps.get('redirect_uri')).toBe('https://vitfix.io/api/email-agent/callback')
    expect(jetons).toMatchObject({ accessToken: 'ya29', refreshToken: '1//r', email: 'frederic@gmail.com', scope: 'gmail.readonly' })
  })

  it('échange refusé : ErreurFournisseur token_exchange', async () => {
    stubFetch(() => ({ status: 400, body: { error: 'invalid_grant', error_description: 'Bad Request' } }))
    await expect(fournisseurGmail.echangerCode('x')).rejects.toMatchObject({ code: 'token_exchange' })
  })

  it('rafraîchissement : pas de nouveau refresh_token chez Google (null = garder l’ancien) ; refus = refresh_failed', async () => {
    stubFetch(() => ({ body: { access_token: 'ya29-neuf', expires_in: 3600 } }))
    expect(await fournisseurGmail.rafraichir('1//r')).toMatchObject({ accessToken: 'ya29-neuf', refreshToken: null })
    stubFetch(() => ({ status: 400, body: { error: 'invalid_grant' } }))
    const err = await fournisseurGmail.rafraichir('1//r').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ErreurFournisseur)
    expect(err).toMatchObject({ code: 'refresh_failed' })
  })
})

describe('Outlook / Microsoft 365 (Microsoft Graph)', () => {
  it('adresse d’autorisation : autorité common, code en query, lecture seule + offline_access, choix du compte', () => {
    const url = new URL(fournisseurMicrosoft.urlAutorisation('cab:nonce'))
    expect(`${url.origin}${url.pathname}`).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'ms-client-id',
      response_type: 'code',
      redirect_uri: 'https://vitfix.io/api/email-agent/callback/microsoft',
      response_mode: 'query',
      scope: 'offline_access User.Read Mail.Read',
      prompt: 'select_account',
      state: 'cab:nonce',
    })
  })

  it('échange du code : POST au point de jeton common (secret, scopes, redirect_uri) puis /me → mail', async () => {
    vi.useFakeTimers({ now: MAINTENANT, toFake: ['Date'] })
    const appels = stubFetch((url) => {
      if (url === 'https://login.microsoftonline.com/common/oauth2/v2.0/token') {
        return { body: { access_token: 'eyJ-acces', refresh_token: 'M.R3-refresh', expires_in: 4205, scope: 'Mail.Read User.Read' } }
      }
      return { body: { mail: 'h.carvalho@ajassocies.fr', userPrincipalName: 'h.carvalho@ajassocies.onmicrosoft.com' } }
    })
    const jetons = await fournisseurMicrosoft.echangerCode('code-ms')
    expect(appels[0].init?.method).toBe('POST')
    expect(Object.fromEntries(corpsFormulaire(appels[0].init))).toEqual({
      client_id: 'ms-client-id',
      client_secret: 'ms-secret',
      scope: 'offline_access User.Read Mail.Read',
      grant_type: 'authorization_code',
      code: 'code-ms',
      redirect_uri: 'https://vitfix.io/api/email-agent/callback/microsoft',
    })
    expect(appels[1].url).toBe('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName')
    expect(entete(appels[1].init, 'Authorization')).toBe('Bearer eyJ-acces')
    expect(jetons).toEqual({
      accessToken: 'eyJ-acces',
      refreshToken: 'M.R3-refresh',
      expiresAt: new Date(MAINTENANT + 4205 * 1000).toISOString(),
      email: 'h.carvalho@ajassocies.fr',
      scope: 'Mail.Read User.Read',
    })
  })

  it('compte sans mail (compte personnel) : userPrincipalName', async () => {
    stubFetch((url) => (url.includes('/token')
      ? { body: { access_token: 'a', refresh_token: 'r', expires_in: 3600 } }
      : { body: { mail: null, userPrincipalName: 'frederic@outlook.fr' } }))
    expect((await fournisseurMicrosoft.echangerCode('c')).email).toBe('frederic@outlook.fr')
  })

  it('rafraîchissement : grant refresh_token et NOUVEAU refresh_token renvoyé (rotation)', async () => {
    const appels = stubFetch(() => ({ body: { access_token: 'acces-2', refresh_token: 'refresh-2', expires_in: 3600 } }))
    const jetons = await fournisseurMicrosoft.rafraichir('refresh-1')
    const corps = corpsFormulaire(appels[0].init)
    expect(corps.get('grant_type')).toBe('refresh_token')
    expect(corps.get('refresh_token')).toBe('refresh-1')
    expect(corps.get('scope')).toBe('offline_access User.Read Mail.Read')
    expect(corps.get('client_secret')).toBe('ms-secret')
    expect(jetons).toMatchObject({ accessToken: 'acces-2', refreshToken: 'refresh-2' })
  })

  it('rafraîchissement refusé (invalid_grant) : ErreurFournisseur avec code court', async () => {
    stubFetch(() => ({ status: 400, body: { error: 'invalid_grant', error_description: 'AADSTS70008: The refresh token has expired.', error_codes: [70008] } }))
    await expect(fournisseurMicrosoft.rafraichir('r')).rejects.toMatchObject({ code: 'invalid_grant' })
  })

  it('échange refusé faute de consentement (AADSTS65001) : code consent_required, détail conservé pour les journaux', async () => {
    stubFetch(() => ({
      status: 400,
      body: { error: 'invalid_grant', error_description: 'AADSTS65001: The user or administrator has not consented to use the application.', error_codes: [65001], correlation_id: 'corr-1' },
    }))
    const err = await fournisseurMicrosoft.echangerCode('c').catch((e: unknown) => e) as ErreurFournisseur
    expect(err).toBeInstanceOf(ErreurFournisseur)
    expect(err.code).toBe('consent_required')
    expect(err.details).toMatchObject({ status: 400, error_codes: [65001], correlation_id: 'corr-1' })
  })

  it('codes d’erreur Microsoft → codes courts', () => {
    expect(codeErreurMicrosoft({ error: 'access_denied', error_description: 'AADSTS65004: User declined to consent to access the app.' })).toBe('consent_declined')
    expect(codeErreurMicrosoft({ error: 'access_denied', error_description: 'AADSTS90094: The grant requires admin permission.' })).toBe('admin_approval_required')
    expect(codeErreurMicrosoft({ error: 'invalid_request', error_description: 'AADSTS50011: The redirect URI specified in the request does not match.' })).toBe('redirect_uri_mismatch')
    expect(codeErreurMicrosoft({ error: 'invalid_request', error_description: 'AADSTS50194: Application is not configured as a multi-tenant application.' })).toBe('app_not_multitenant')
    expect(codeErreurMicrosoft({ error: 'invalid_client', error_codes: [7000215] })).toBe('invalid_client_secret')
    expect(codeErreurMicrosoft({ error: 'access_denied' })).toBe('access_denied')
    expect(codeErreurMicrosoft({ error: 'Something <weird>' })).toBe('microsoft_error')
    expect(codeErreurMicrosoft({})).toBe('microsoft_error')
  })

  it('relève : boîte de réception, 20 plus récents, filtre de date OData sans millisecondes, corps en texte', async () => {
    expect(urlReleveMicrosoft(true, MAINTENANT)).toBe(
      'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages'
      + '?$top=20'
      + '&$orderby=receivedDateTime%20desc'
      + '&$filter=receivedDateTime%20ge%202026-09-11T12%3A00%3A00Z'
      + '&$select=id,conversationId,subject,from,receivedDateTime,body,bodyPreview',
    )
    expect(urlReleveMicrosoft(false, MAINTENANT)).toContain('ge%202026-10-04T12%3A00%3A00Z')

    vi.useFakeTimers({ now: MAINTENANT, toFake: ['Date'] })
    const appels = stubFetch(() => ({
      body: {
        value: [{
          id: 'AAMkAGI2-1', conversationId: 'AAQkAGI2-c1', subject: 'Fuite colonne', receivedDateTime: '2026-10-11T08:15:00Z',
          from: { emailAddress: { name: 'Julien Rousseau', address: 'j.rousseau@example.fr' } },
          body: { contentType: 'text', content: '  Bonjour, fuite au 3e.  ' }, bodyPreview: 'Bonjour, fuite au 3e.',
        }],
      },
    }))
    const messages = await fournisseurMicrosoft.recupererMessages('eyJ', { premiereReleve: true })
    expect(appels[0].url).toBe(urlReleveMicrosoft(true, MAINTENANT))
    expect(entete(appels[0].init, 'Authorization')).toBe('Bearer eyJ')
    expect(entete(appels[0].init, 'Prefer')).toBe('outlook.body-content-type="text"')
    expect(messages).toEqual([{
      id: 'AAMkAGI2-1', threadId: 'AAQkAGI2-c1', from: 'Julien Rousseau <j.rousseau@example.fr>', subject: 'Fuite colonne',
      bodyText: 'Bonjour, fuite au 3e.', receivedAt: '2026-10-11T08:15:00.000Z',
    }])
  })

  it('normalisation Graph : nom nettoyé, HTML repli, aperçu si corps vide, troncature à 1000', () => {
    expect(normaliserMessageGraph({ id: '1', from: { emailAddress: { name: 'A "B" <C>', address: 'x@y.fr' } } }).from).toBe('A B C <x@y.fr>')
    expect(normaliserMessageGraph({ id: '2', from: { emailAddress: { name: 'x@y.fr', address: 'x@y.fr' } } }).from).toBe('x@y.fr')
    expect(normaliserMessageGraph({ id: '3', from: null }).from).toBe('')
    expect(normaliserMessageGraph({ id: '4', body: { contentType: 'html', content: '<p>Bonjour</p>\n<p>Madame</p>' } }).bodyText).toBe('Bonjour Madame')
    expect(normaliserMessageGraph({ id: '5', body: { contentType: 'text', content: '' }, bodyPreview: 'Aperçu' }).bodyText).toBe('Aperçu')
    expect(normaliserMessageGraph({ id: '6', body: { contentType: 'text', content: 'y'.repeat(2000) } }).bodyText).toHaveLength(1000)
    const sansDate = normaliserMessageGraph({ id: '7' })
    expect(sansDate.subject).toBe('')
    expect(sansDate.threadId).toBeNull()
    expect(Number.isNaN(Date.parse(sansDate.receivedAt))).toBe(false)
  })

  it('boîte sans Exchange Online (MailboxNotEnabledForRESTAPI) : boite_indisponible ; 401 : lecture_impossible', async () => {
    stubFetch(() => ({ status: 404, body: { error: { code: 'MailboxNotEnabledForRESTAPI', message: 'The mailbox is either inactive, soft-deleted, or is hosted on-premise.' } } }))
    await expect(fournisseurMicrosoft.recupererMessages('eyJ', { premiereReleve: false })).rejects.toMatchObject({ code: 'boite_indisponible' })
    stubFetch(() => ({ status: 401, body: { error: { code: 'InvalidAuthenticationToken', message: 'Access token has expired.' } } }))
    await expect(fournisseurMicrosoft.recupererMessages('eyJ', { premiereReleve: false })).rejects.toMatchObject({ code: 'lecture_impossible' })
  })
})
