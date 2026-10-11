import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within, renderHook } from '@testing-library/react'
import ModCanal from '@/components/syndic-dashboard/v54/modules/ModCanal'
import ModProfissionais from '@/components/syndic-dashboard/v54/modules/ModProfissionais'
import { usePolling } from '@/components/syndic-dashboard/v54/modules/canal/use-polling'
import { DashboardShell } from '@/components/syndic-dashboard/v54/shell'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n'
import type { Artisan } from '@/components/syndic-dashboard/types'
import type { ConversationCanalPro, Signalement } from '@/lib/syndic/v54/api'

/**
 * Canal de communication v54 en données réelles (syndic connecté, version FR de la démo) :
 * demandes des copropriétaires → « Valider la mission » (choix parmi TOUS les prestataires du cabinet)
 * → conversations prestataires (ordre de mission, devis, réponse). Sans connexion : démonstration inchangée.
 */

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })

const SIG: Signalement = {
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  immeuble: 'Résidence Le Prado',
  demandeurNom: 'Marie Coste',
  demandeurRole: 'coproprio',
  demandeurEmail: 'marie@example.fr',
  typeIntervention: 'Plomberie',
  description: "Fuite d'eau sous l'évier de la cuisine",
  priorite: 'urgente',
  statut: 'en_attente',
  batiment: 'A',
  etage: '3',
  numLot: '12',
  createdAt: '2026-10-12T07:30:00Z',
  messages: [],
}

const artisan = (id: string, nom: string, metier: string, compte: string | null): Artisan => ({
  id, nom, metier, telephone: '', email: `${id}@example.fr`, siret: '', rcProValide: true, rcProExpiration: '', decennaleValide: true,
  decennaleExpiration: '', note: 5, nbInterventions: 0, statut: 'actif', vitfixCertifie: true, artisan_user_id: compte,
})
const ARTISANS = [
  artisan('bbbbbbbb-cccc-4ddd-8eee-000000000000', 'Thomas Ménard', 'Peintre', null),
  artisan('bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', 'Damien Perrin', 'Plombier', '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'),
]

const CONVERSATION: ConversationCanalPro = {
  id: 'cccccccc-dddd-4eee-8fff-000000000001',
  artisanUserId: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
  prestataire: { nom: 'Damien Perrin', metier: 'Plombier' },
  derniereActivite: '2026-10-12T09:00:00Z',
  apercu: 'Devis',
  ordre: { messageId: 'm1', titre: 'Plomberie', adresse: 'Résidence Le Prado, lot 12', dateSouhaitee: '2026-10-13', description: 'Fuite', urgence: 'urgente', statut: 'accepte', heureArrivee: '09:30', signalementId: SIG.id, syndicMissionId: 'mi1' },
  messages: [
    { id: 'm1', type: 'ordre_mission', contenu: 'Fuite', creeLe: '2026-10-12T08:00:00Z', cote: 'donneur_ordre', document: null, ordreMission: { titre: 'Plomberie', adresse: 'Résidence Le Prado, lot 12', dateSouhaitee: '2026-10-13', description: 'Fuite', urgence: 'urgente', statut: 'accepte', heureArrivee: '09:30', signalementId: SIG.id, syndicMissionId: 'mi1' } },
    { id: 'm2', type: 'system', contenu: '✅ Mission acceptée — Damien Perrin sera sur place à 09:30', creeLe: '2026-10-12T08:05:00Z', cote: 'artisan', document: null, ordreMission: null },
    { id: 'm3', type: 'text', contenu: '📄 Devis D-2026-014 — 640,00 € TTC — Remplacement colonne EF', creeLe: '2026-10-12T08:10:00Z', cote: 'artisan', ordreMission: null, document: { type: 'devis', reference: 'D-2026-014', montant_ttc: 640, description: 'Remplacement colonne EF', date: '2026-10-12' } },
  ],
}

const authed = (over: Partial<SyndicData> = {}): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: ARTISANS, team: [], coproprios: [],
  signalements: [SIG], token: 'tok', refresh: vi.fn(), ...over,
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

/** Faux serveur : état des demandes / conversations, journal des appels. */
function brancherServeur(opts: { notification?: boolean; signalements?: Signalement[]; conversations?: ConversationCanalPro[] } = {}) {
  const etat = { signalements: opts.signalements ?? [SIG], conversations: opts.conversations ?? [] }
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const methode = init?.method ?? 'GET'
    if (url === '/api/syndic/signalements' && methode === 'GET') return json({ signalements: etat.signalements })
    if (url === '/api/syndic/canal-pro' && methode === 'GET') return json({ conversations: etat.conversations })
    if (url === '/api/syndic/canal-interne' && methode === 'GET') return json({ messages: [] })
    if (url === '/api/syndic/demandes/valider') {
      etat.signalements = etat.signalements.map((s) => ({ ...s, statut: 'acceptee', artisanAssigne: 'Damien Perrin' }))
      return json({ mission_id: 'mi1', conversation_id: 'conv-1', notification: opts.notification ?? true })
    }
    if (url === '/api/syndic/canal-pro' && methode === 'POST') {
      return json({ message: { id: 'm9', type: 'text', contenu: JSON.parse(String(init?.body)).content, creeLe: '2026-10-12T11:00:00Z', cote: 'donneur_ordre', ordreMission: null, document: null } })
    }
    return json({}, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  const appels = (url: string, methode = 'GET') => fetchMock.mock.calls.filter(([u, i]) => u === url && (i?.method ?? 'GET') === methode)
  return { fetchMock, appels, etat }
}

function rendre(data: SyndicData, ui = <ModCanal />) {
  return render(<V54LocaleProvider locale="fr-FR"><ToastProvider><SyndicDataContext.Provider value={data}>{ui}</SyndicDataContext.Provider></ToastProvider></V54LocaleProvider>)
}

describe('Canal de communication — onglet Demandes (données réelles)', () => {
  it('ouvre sur la demande en attente, sans cache navigateur', async () => {
    const { appels } = brancherServeur()
    rendre(authed())
    expect(screen.getByRole('heading', { name: 'Canal de communication', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('DEMANDES')).toBeInTheDocument()
    expect(screen.getByText("Fuite d'eau sous l'évier de la cuisine")).toBeInTheDocument()
    expect(screen.getByText('Bâtiment A · Étage 3 · Lot 12')).toBeInTheDocument()
    await waitFor(() => expect(appels('/api/syndic/signalements')).toHaveLength(1))
    const [, init] = appels('/api/syndic/signalements')[0]
    expect(init).toMatchObject({ cache: 'no-store', headers: { Authorization: 'Bearer tok' } })
    expect(appels('/api/syndic/canal-pro')).toHaveLength(1)
  })

  it('« Valider la mission » : tous les prestataires, sans compte non sélectionnables, envoi et rafraîchissement', async () => {
    const { appels } = brancherServeur()
    const data = authed()
    rendre(data)
    fireEvent.click(screen.getByRole('button', { name: /Valider la mission/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Valider la mission' })

    const damien = within(dialog).getByRole('radio', { name: /Damien Perrin/ })
    const thomas = within(dialog).getByRole('radio', { name: /Thomas Ménard/ })
    expect(damien).toBeEnabled()
    expect(thomas).toBeDisabled()
    expect(within(dialog).getByText('Pas de compte Vitfix — pas de notification')).toBeInTheDocument()
    expect(within(dialog).getByText('Compte Vitfix lié')).toBeInTheDocument()
    const confirmer = within(dialog).getByRole('button', { name: 'Confirmer et envoyer' })
    expect(confirmer).toBeDisabled()

    fireEvent.click(damien)
    fireEvent.change(within(dialog).getByLabelText("Date d'intervention"), { target: { value: '2026-10-13' } })
    fireEvent.change(within(dialog).getByLabelText('Note pour le prestataire'), { target: { value: 'Clé chez la gardienne' } })
    fireEvent.click(confirmer)

    await waitFor(() => expect(appels('/api/syndic/demandes/valider', 'POST')).toHaveLength(1))
    const [, init] = appels('/api/syndic/demandes/valider', 'POST')[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      signalement_id: SIG.id,
      syndic_artisan_id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
      date_intervention: '2026-10-13',
      note: 'Clé chez la gardienne',
    })
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(await screen.findByText('Mission confiée à Damien Perrin')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(data.refresh).toHaveBeenCalled()
    // Rechargement : la demande apparaît confiée, le bouton disparaît.
    expect(await screen.findByText('Confiée à Damien Perrin')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Valider la mission/ })).toBeNull()
  })

  it('notification non délivrée : avertissement', async () => {
    brancherServeur({ notification: false })
    rendre(authed())
    fireEvent.click(screen.getByRole('button', { name: /Valider la mission/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Valider la mission' })
    fireEvent.click(within(dialog).getByRole('radio', { name: /Damien Perrin/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer et envoyer' }))
    expect(await screen.findByText('Mission créée, notification non délivrée')).toBeInTheDocument()
  })

  it('« Rafraîchir » recharge demandes et conversations', async () => {
    const { appels } = brancherServeur()
    rendre(authed())
    await waitFor(() => expect(appels('/api/syndic/canal-pro')).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: /Rafraîchir/ }))
    await waitFor(() => expect(appels('/api/syndic/canal-pro')).toHaveLength(2))
    expect(appels('/api/syndic/signalements')).toHaveLength(2)
    expect(await screen.findByText('Canal à jour')).toBeInTheDocument()
  })
})

describe('Canal de communication — onglet Professionnels (données réelles)', () => {
  it('ordre de mission avec son statut, devis du prestataire, réponse du syndic', async () => {
    const { appels } = brancherServeur({ signalements: [], conversations: [CONVERSATION] })
    rendre(authed({ signalements: [] }))
    // Aucune demande en attente : ouverture sur « Professionnels ».
    expect(await screen.findByText('Ordre de mission — Plomberie')).toBeInTheDocument()
    expect(screen.getAllByText('Acceptée').length).toBeGreaterThan(0)
    expect(screen.getByText('✅ Mission acceptée — Damien Perrin sera sur place à 09:30')).toBeInTheDocument()
    expect(screen.getAllByText('D-2026-014').length).toBeGreaterThan(0)
    expect(screen.getByText('Remplacement colonne EF')).toBeInTheDocument()
    expect(screen.getAllByText(/640,00/).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByPlaceholderText('Répondre à Damien Perrin…'), { target: { value: 'Devis validé, merci' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    await waitFor(() => expect(appels('/api/syndic/canal-pro', 'POST')).toHaveLength(1))
    expect(JSON.parse(String(appels('/api/syndic/canal-pro', 'POST')[0][1]?.body))).toEqual({ conversation_id: CONVERSATION.id, content: 'Devis validé, merci' })
    expect(await screen.findByText('Message envoyé')).toBeInTheDocument()
  })

  it('aucune conversation : invitation à valider une demande', async () => {
    brancherServeur({ signalements: [], conversations: [] })
    rendre(authed({ signalements: [] }))
    expect((await screen.findAllByText(/Validez une demande pour envoyer un premier ordre de mission/)).length).toBeGreaterThan(0)
  })
})

describe('Canal de communication — sans connexion', () => {
  it('démonstration inchangée, aucun appel réseau', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<ModCanal />)
    expect(screen.getByRole('heading', { name: 'Canal de Comunicações', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Residencial Cedofeita — Bloco A')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('usePolling', () => {
  it('charge au montage, toutes les 15 s si la page est visible, et au retour sur la page (focus / visibilité)', () => {
    vi.useFakeTimers()
    const charger = vi.fn()
    const { unmount } = renderHook(() => usePolling(charger, 15_000))
    expect(charger).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(15_000)
    expect(charger).toHaveBeenCalledTimes(2)

    const visibilite = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    vi.advanceTimersByTime(30_000)
    expect(charger).toHaveBeenCalledTimes(2)

    visibilite.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(charger).toHaveBeenCalledTimes(3)
    // focus émis avec visibilitychange : un seul rechargement.
    window.dispatchEvent(new Event('focus'))
    expect(charger).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(2_000)
    window.dispatchEvent(new Event('focus'))
    expect(charger).toHaveBeenCalledTimes(4)

    unmount()
    vi.advanceTimersByTime(30_000)
    expect(charger).toHaveBeenCalledTimes(4)
  })
})

describe('Prestataires et barre latérale (données réelles)', () => {
  it('« Compte Vitfix lié » quand la fiche a un artisan_user_id', () => {
    rendre(authed(), <ModProfissionais />)
    expect(screen.getByRole('button', { name: /Compte Vitfix lié/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aucun compte lié/ })).toBeInTheDocument()
  })

  it('compteur du Canal de communication = demandes en attente', () => {
    rendre(authed({ signalements: [SIG, { ...SIG, id: 's2' }, { ...SIG, id: 's3', statut: 'acceptee' }] }), <DashboardShell />)
    expect(screen.getByRole('button', { name: /Canal de communication/ })).toHaveTextContent('Canal de communication2')
  })
})
