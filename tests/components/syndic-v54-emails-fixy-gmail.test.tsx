import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import ModEmailsFixy from '@/components/syndic-dashboard/v54/modules/ModEmailsFixy'
import ModDefinicoes from '@/components/syndic-dashboard/v54/modules/ModDefinicoes'
import { RetourConnexionBoite } from '@/components/syndic-dashboard/v54/RetourConnexionBoite'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'

/**
 * E-mails Fixy branché sur la boîte e-mail du cabinet — Outlook / Microsoft 365 ou
 * Gmail / Google Workspace (connexion, relève, liste, déconnexion). Locale par défaut : pt-PT.
 */

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const authed = (over: Partial<SyndicData> = {}): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], token: 'tok', ...over })

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const NON_CONNECTEE = { cabinetId: 'cab', connecte: false, provider: null, email: null, misAJour: null, brouillonsEnAttente: 0, emails: [] }

const CONNECTEE_OUTLOOK = {
  cabinetId: 'cab-1', connecte: true, provider: 'microsoft', email: 'h.carvalho@ajassocies.fr', misAJour: null, brouillonsEnAttente: 1,
  emails: [{ id: 'e1', from_email: 'julien.rousseau@example.fr', subject: 'Fuite colonne', resume_ia: 'Fuite persistante au 3e', received_at: '2026-10-12T04:42:00Z', urgence: 'urgente', type_demande: 'sinistre', draft_status: 'pending_review', draft_subject: 'Re: Fuite' }],
}

function rendre(data: SyndicData, ui = <ModEmailsFixy />) {
  return render(<ToastProvider><SyndicDataContext.Provider value={data}>{ui}</SyndicDataContext.Provider></ToastProvider>)
}

/** fetch simulé : état de la boîte + adresse de connexion par fournisseur. */
function fetchConnexion() {
  return vi.fn(async (url: string, _init?: RequestInit) => {
    if (url === '/api/email-agent/status') return json(NON_CONNECTEE)
    if (url === '/api/email-agent/connect?format=json&provider=microsoft') return json({ url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=m' })
    if (url === '/api/email-agent/connect?format=json&provider=gmail') return json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x' })
    return json({}, 404)
  })
}

describe('E-mails Fixy — boîte e-mail du cabinet', () => {
  it('non connectée : titre générique et deux boutons, un par fournisseur', async () => {
    vi.stubGlobal('fetch', fetchConnexion())
    rendre(authed())
    expect(await screen.findByText('Ligue a sua caixa de email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Outlook / Microsoft 365' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gmail / Google Workspace' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desligar' })).not.toBeInTheDocument()
  })

  it('« Outlook / Microsoft 365 » demande l’adresse Microsoft (provider=microsoft, jeton en en-tête) et y redirige', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    const fetchMock = fetchConnexion()
    vi.stubGlobal('fetch', fetchMock)
    rendre(authed())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/email-agent/status', expect.anything()))
    fireEvent.click(screen.getByRole('button', { name: 'Outlook / Microsoft 365' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=m'))
    const [, init] = fetchMock.mock.calls.find(([u]) => u === '/api/email-agent/connect?format=json&provider=microsoft') as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('provider=gmail'))).toBe(false)
  })

  it('« Gmail / Google Workspace » demande l’adresse Google (provider=gmail) et y redirige', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    const fetchMock = fetchConnexion()
    vi.stubGlobal('fetch', fetchMock)
    rendre(authed())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/email-agent/status', expect.anything()))
    fireEvent.click(screen.getByRole('button', { name: 'Gmail / Google Workspace' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?client_id=x'))
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('provider=microsoft'))).toBe(false)
  })

  it('connexion refusée par le serveur (secret absent) : toast d’erreur avec le message de la route', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/email-agent/status') return json(NON_CONNECTEE)
      return json({ error: 'Connexion Outlook / Microsoft 365 non configurée sur le serveur : MICROSOFT_CLIENT_ID manquant.' }, 500)
    }))
    rendre(authed())
    fireEvent.click(await screen.findByRole('button', { name: 'Outlook / Microsoft 365' }))
    expect(await screen.findByText('Ligação da caixa de email impossível')).toBeInTheDocument()
    expect(screen.getByText(/MICROSOFT_CLIENT_ID manquant/)).toBeInTheDocument()
  })

  it('connectée : fournisseur + adresse, e-mails analysés, brouillon à valider ; « Analisar agora » relève la boîte', async () => {
    let releves = 0
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/email-agent/status') return json(CONNECTEE_OUTLOOK)
      if (url === '/api/email-agent/poll') {
        releves++
        expect(JSON.parse(String(init?.body))).toEqual({ syndic_id: 'cab-1', first_run: true })
        return json({ success: true, results: [{ syndic_id: 'cab-1', provider: 'microsoft', emails_processed: 3, new_emails: 2 }] })
      }
      return json({}, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    rendre(authed())
    expect(await screen.findByText('Fuite colonne')).toBeInTheDocument()
    expect(screen.getByText('Fuite persistante au 3e')).toBeInTheDocument()
    expect(screen.getByText('Rascunho a validar')).toBeInTheDocument()
    expect(screen.getByText(/h\.carvalho@ajassocies\.fr \(Outlook \/ Microsoft 365\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Analisar agora/ }))
    await waitFor(() => expect(releves).toBe(1))
    expect(await screen.findByText('Caixa analisada')).toBeInTheDocument()
  })

  it('relève interrompue par le budget de temps du serveur : nombre d’e-mails restants affiché', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/email-agent/status') return json(CONNECTEE_OUTLOOK)
      if (url === '/api/email-agent/poll') return json({ success: true, results: [{ syndic_id: 'cab-1', emails_processed: 20, new_emails: 12, deferred: 8 }] })
      return json({}, 404)
    }))
    rendre(authed())
    fireEvent.click(await screen.findByRole('button', { name: /Analisar agora/ }))
    expect(await screen.findByText('12 novos emails · 20 lidos · 8 por analisar — clique novamente')).toBeInTheDocument()
  })

  it('relève refusée (jeton expiré) : demande de reconnexion, la boîte reste affichée', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/email-agent/status') return json(CONNECTEE_OUTLOOK)
      if (url === '/api/email-agent/poll') {
        return json({ success: true, results: [{ syndic_id: 'cab-1', provider: 'microsoft', code: 'refresh_failed', error: 'Connexion à la boîte e-mail expirée : reconnectez la boîte' }] })
      }
      return json({}, 404)
    }))
    rendre(authed())
    fireEvent.click(await screen.findByRole('button', { name: /Analisar agora/ }))
    expect(await screen.findByText('Análise impossível')).toBeInTheDocument()
    expect(screen.getByText('A ligação à caixa de email expirou: volte a ligá-la.')).toBeInTheDocument()
    expect(screen.getByText('Fuite colonne')).toBeInTheDocument()
  })

  it('« Desligar » : confirmation dans une fenêtre, option d’effacement, DELETE ?purger=1 puis écran de connexion', async () => {
    let etat: Record<string, unknown> = CONNECTEE_OUTLOOK
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/email-agent/status') return json(etat)
      if (url.startsWith('/api/email-agent/connect') && init?.method === 'DELETE') {
        etat = NON_CONNECTEE
        return json({ boitesSupprimees: 1, emailsSupprimes: 4 })
      }
      return json({}, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    rendre(authed())
    fireEvent.click(await screen.findByRole('button', { name: 'Desligar' }))

    const fenetre = await screen.findByRole('dialog', { name: 'Desligar a caixa de email?' })
    // Rien n'est supprimé avant la confirmation.
    expect(fetchMock.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === 'DELETE')).toBe(false)
    fireEvent.click(within(fenetre).getByRole('checkbox', { name: 'Apagar também os emails analisados' }))
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Desligar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const [url, init] = fetchMock.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === 'DELETE') as [string, RequestInit]
    expect(url).toBe('/api/email-agent/connect?purger=1')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(await screen.findByText('Caixa desligada')).toBeInTheDocument()
    expect(screen.getByText('4 emails apagados')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Outlook / Microsoft 365' })).toBeInTheDocument()
  })

  it('« Desligar » puis « Cancelar » : aucune suppression', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => (url === '/api/email-agent/status' ? json(CONNECTEE_OUTLOOK) : json({}, 404)))
    vi.stubGlobal('fetch', fetchMock)
    rendre(authed())
    fireEvent.click(await screen.findByRole('button', { name: 'Desligar' }))
    const fenetre = await screen.findByRole('dialog')
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchMock.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === 'DELETE')).toBe(false)
  })

  it('déconnexion sans effacement : DELETE sans purger', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/email-agent/status') return json(CONNECTEE_OUTLOOK)
      if (init?.method === 'DELETE') return json({ boitesSupprimees: 1, emailsSupprimes: 0 })
      return json({}, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    rendre(authed())
    fireEvent.click(await screen.findByRole('button', { name: 'Desligar' }))
    const fenetre = await screen.findByRole('dialog')
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Desligar' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === 'DELETE')).toBe(true))
    const [url] = fetchMock.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === 'DELETE') as [string, RequestInit]
    expect(url).toBe('/api/email-agent/connect')
  })

  it('hors connexion au dashboard : écran d’origine, aucun appel réseau', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    rendre({ authenticated: false, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [] } as SyndicData)
    expect(screen.getByRole('button', { name: 'Outlook / Microsoft 365' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gmail / Google Workspace' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Outlook / Microsoft 365' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('Definições — panneau « Agente Email Fixy »', () => {
  it('deux boutons de connexion qui appellent chacun leur fournisseur', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    const fetchMock = fetchConnexion()
    vi.stubGlobal('fetch', fetchMock)
    rendre(authed(), <ModDefinicoes />)
    fireEvent.click(screen.getByRole('button', { name: 'Outlook / Microsoft 365' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=m'))
    fireEvent.click(screen.getByRole('button', { name: 'Gmail / Google Workspace' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?client_id=x'))
  })
})

describe('Retour de connexion de la boîte (RetourConnexionBoite)', () => {
  function retour(search: string) {
    window.history.replaceState(null, '', `/syndic/v54${search}`)
    rendre(authed(), <RetourConnexionBoite />)
  }
  afterEach(() => { window.history.replaceState(null, '', '/') })

  it('boîte connectée : message générique avec adresse et fournisseur', async () => {
    retour('?email_connected=true&email=h.carvalho%40ajassocies.fr&email_provider=microsoft')
    expect(await screen.findByText('Caixa de email ligada')).toBeInTheDocument()
    expect(screen.getByText(/h\.carvalho@ajassocies\.fr \(Outlook \/ Microsoft 365\)/)).toBeInTheDocument()
    await waitFor(() => expect(window.location.search).toBe(''))
  })

  it('consentement administrateur requis : explication au lieu du code', async () => {
    retour('?email_error=admin_approval_required')
    expect(await screen.findByText('Ligação da caixa de email impossível')).toBeInTheDocument()
    expect(screen.getByText(/administrador Microsoft 365 do gabinete/)).toBeInTheDocument()
  })

  it('consentement administrateur accordé : invitation à connecter la boîte', async () => {
    retour('?email_admin_consent=true')
    expect(await screen.findByText('Autorização de administrador concedida')).toBeInTheDocument()
  })
})
