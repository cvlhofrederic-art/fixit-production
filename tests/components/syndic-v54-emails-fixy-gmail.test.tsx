import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModEmailsFixy from '@/components/syndic-dashboard/v54/modules/ModEmailsFixy'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'

/** E-mails Fixy branché sur la boîte Gmail du cabinet (connexion, relève, liste). Locale par défaut : pt-PT. */

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const authed = (over: Partial<SyndicData> = {}): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], token: 'tok', ...over })

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function rendre(data: SyndicData) {
  return render(<ToastProvider><SyndicDataContext.Provider value={data}><ModEmailsFixy /></SyndicDataContext.Provider></ToastProvider>)
}

describe('E-mails Fixy — boîte Gmail du cabinet', () => {
  it('non connectée : « Ligar Gmail » demande l’adresse Google avec le jeton en en-tête et y redirige', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/email-agent/status') return json({ cabinetId: 'cab', connecte: false, email: null, misAJour: null, brouillonsEnAttente: 0, emails: [] })
      if (url === '/api/email-agent/connect?format=json') return json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x' })
      return json({}, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    rendre(authed())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/email-agent/status', expect.anything()))
    fireEvent.click(screen.getByRole('button', { name: 'Ligar Gmail' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?client_id=x'))
    const [, init] = fetchMock.mock.calls.find(([u]) => u === '/api/email-agent/connect?format=json') as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('connectée : adresse, e-mails analysés et brouillon à valider ; « Analisar agora » relève la boîte', async () => {
    let releves = 0
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/email-agent/status') {
        return json({
          cabinetId: 'cab-1', connecte: true, email: 'frederic@gmail.com', misAJour: null, brouillonsEnAttente: 1,
          emails: [{ id: 'e1', from_email: 'julien.rousseau@example.fr', subject: 'Fuite colonne', resume_ia: 'Fuite persistante au 3e', received_at: '2026-10-12T04:42:00Z', urgence: 'urgente', type_demande: 'sinistre', draft_status: 'pending_review', draft_subject: 'Re: Fuite' }],
        })
      }
      if (url === '/api/email-agent/poll') {
        releves++
        expect(JSON.parse(String(init?.body))).toEqual({ syndic_id: 'cab-1', first_run: true })
        return json({ success: true, results: [{ syndic_id: 'cab-1', emails_processed: 3, new_emails: 2 }] })
      }
      return json({}, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    rendre(authed())
    expect(await screen.findByText('Fuite colonne')).toBeInTheDocument()
    expect(screen.getByText('Fuite persistante au 3e')).toBeInTheDocument()
    expect(screen.getByText('Rascunho a validar')).toBeInTheDocument()
    expect(screen.getByText(/frederic@gmail\.com/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Analisar agora/ }))
    await waitFor(() => expect(releves).toBe(1))
    expect(await screen.findByText('Caixa analisada')).toBeInTheDocument()
  })

  it('hors connexion au dashboard : écran d’origine, aucun appel réseau', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    rendre({ authenticated: false, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [] } as SyndicData)
    expect(screen.getByRole('button', { name: 'Ligar Gmail' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
