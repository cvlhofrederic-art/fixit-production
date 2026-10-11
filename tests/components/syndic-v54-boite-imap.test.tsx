import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import ModEmailsFixy from '@/components/syndic-dashboard/v54/modules/ModEmailsFixy'
import ModDefinicoes from '@/components/syndic-dashboard/v54/modules/ModDefinicoes'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n'

/**
 * E-mails Fixy — troisième bouton « Autre messagerie (IMAP) » : formulaire (adresse, mot
 * de passe d'application, serveur), POST /api/email-agent/connect-imap, erreurs expliquées,
 * boîte IMAP affichée une fois connectée. Écran en français (démonstration du 12/10).
 */

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const authed = (over: Partial<SyndicData> = {}): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], token: 'tok', ...over })

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const NON_CONNECTEE = { cabinetId: 'cab-1', connecte: false, provider: null, email: null, misAJour: null, brouillonsEnAttente: 0, emails: [] }
const CONNECTEE_IMAP = { ...NON_CONNECTEE, connecte: true, provider: 'imap', email: 'gestion@cabinet-exemple.fr' }

function rendre(data: SyndicData, ui = <ModEmailsFixy />) {
  return render(
    <V54LocaleProvider locale="fr-FR">
      <ToastProvider><SyndicDataContext.Provider value={data}>{ui}</SyndicDataContext.Provider></ToastProvider>
    </V54LocaleProvider>,
  )
}

async function ouvrirFormulaire() {
  fireEvent.click(await screen.findByRole('button', { name: 'Autre messagerie (IMAP)' }))
  return screen.findByRole('dialog', { name: 'Connecter une autre messagerie (IMAP)' })
}

function remplir(fenetre: HTMLElement, champs: { email?: string; motDePasse?: string; serveur?: string }) {
  if (champs.email !== undefined) fireEvent.change(within(fenetre).getByLabelText(/Adresse e-mail/), { target: { value: champs.email } })
  if (champs.motDePasse !== undefined) fireEvent.change(within(fenetre).getByLabelText(/Mot de passe/), { target: { value: champs.motDePasse } })
  if (champs.serveur !== undefined) fireEvent.change(within(fenetre).getByLabelText(/Serveur IMAP/), { target: { value: champs.serveur } })
}

describe('E-mails Fixy — autre messagerie (IMAP)', () => {
  it('non connectée : trois boutons ; le troisième ouvre le formulaire IMAP avec l’explication', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(NON_CONNECTEE)))
    rendre(authed())
    expect(await screen.findByRole('button', { name: 'Outlook / Microsoft 365' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gmail / Google Workspace' })).toBeInTheDocument()
    const fenetre = await ouvrirFormulaire()
    expect(within(fenetre).getByText(/Gmail, iCloud, Yahoo : créez un mot de passe d’application/)).toBeInTheDocument()
    expect(within(fenetre).getByText(/Microsoft 365 : utilisez plutôt le bouton « Outlook \/ Microsoft 365 »/)).toBeInTheDocument()
    expect(within(fenetre).getByLabelText(/Mot de passe/)).toHaveAttribute('type', 'password')
  })

  it('serveur pré-rempli depuis le domaine de l’adresse ; adresse Outlook.com signalée', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(NON_CONNECTEE)))
    rendre(authed())
    const fenetre = await ouvrirFormulaire()
    remplir(fenetre, { email: 'cabinet.martin@gmail.com' })
    expect(within(fenetre).getByLabelText(/Serveur IMAP/)).toHaveValue('imap.gmail.com')
    remplir(fenetre, { email: 'cabinet.martin@icloud.com' })
    expect(within(fenetre).getByLabelText(/Serveur IMAP/)).toHaveValue('imap.mail.me.com')
    remplir(fenetre, { email: 'cabinet.martin@hotmail.fr' })
    expect(within(fenetre).getByText('Adresse Microsoft : utilisez le bouton « Outlook / Microsoft 365 ».')).toBeInTheDocument()
  })

  it('champs manquants : message, aucun appel', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json(NON_CONNECTEE))
    vi.stubGlobal('fetch', fetchMock)
    rendre(authed())
    const fenetre = await ouvrirFormulaire()
    remplir(fenetre, { email: 'gestion@cabinet-exemple.fr' })
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Connecter la boîte' }))
    expect(await within(fenetre).findByText('Renseignez l’adresse, le mot de passe et le serveur IMAP.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/email-agent/connect-imap')).toBe(false)
  })

  it('connexion : POST connect-imap (jeton en en-tête, port 993), toast, fenêtre fermée, boîte IMAP affichée', async () => {
    let etat: Record<string, unknown> = NON_CONNECTEE
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === '/api/email-agent/status') return json(etat)
      if (url === '/api/email-agent/connect-imap') {
        etat = CONNECTEE_IMAP
        return json({ connecte: true, provider: 'imap', email: 'gestion@cabinet-exemple.fr' })
      }
      return json({}, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    rendre(authed())
    const fenetre = await ouvrirFormulaire()
    remplir(fenetre, { email: 'gestion@cabinet-exemple.fr', motDePasse: 'mdp-application', serveur: 'ssl0.ovh.net' })
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Connecter la boîte' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const [, init] = fetchMock.mock.calls.find(([u]) => u === '/api/email-agent/connect-imap') as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(JSON.parse(String(init.body))).toEqual({ email: 'gestion@cabinet-exemple.fr', motDePasse: 'mdp-application', hote: 'ssl0.ovh.net', port: 993 })
    expect(await screen.findByText('Boîte e-mail connectée')).toBeInTheDocument()
    expect(await screen.findByText(/gestion@cabinet-exemple\.fr \(IMAP\)/)).toBeInTheDocument()
  })

  it('identifiants refusés : explication dans la fenêtre, qui reste ouverte', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/email-agent/status') return json(NON_CONNECTEE)
      return json({ error: 'refus', code: 'mot_de_passe_application' }, 400)
    }))
    rendre(authed())
    const fenetre = await ouvrirFormulaire()
    remplir(fenetre, { email: 'cabinet.martin@gmail.com', motDePasse: 'mot-de-passe-habituel' })
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Connecter la boîte' }))
    expect(await within(fenetre).findByText(/Ce fournisseur exige un mot de passe d’application/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('boîte IMAP connectée dont le mot de passe a changé : la relève demande de reconnecter', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/email-agent/status') return json(CONNECTEE_IMAP)
      if (url === '/api/email-agent/poll') {
        return json({ success: true, results: [{ syndic_id: 'cab-1', provider: 'imap', code: 'identifiants_refuses', error: 'Lecture de la boîte e-mail impossible' }] })
      }
      return json({}, 404)
    }))
    rendre(authed())
    fireEvent.click(await screen.findByRole('button', { name: /Analyser maintenant/ }))
    expect(await screen.findByText('Analyse impossible')).toBeInTheDocument()
    expect(screen.getByText('La connexion à la boîte e-mail a expiré : reconnectez-la.')).toBeInTheDocument()
  })
})

describe('Paramètres — panneau « Agent e-mail »', () => {
  it('troisième bouton « Autre messagerie (IMAP) » : même formulaire', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(NON_CONNECTEE)))
    rendre(authed(), <ModDefinicoes />)
    expect(await ouvrirFormulaire()).toBeInTheDocument()
  })
})
