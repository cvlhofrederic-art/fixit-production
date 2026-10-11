// tests/components/copro-signalement-envoi.test.tsx
//
// Espace copropriétaire, écran Signalement (page + CoproSignalementSection) :
// - le signalement part vers POST /api/coproprietaire/signalement avec le jeton de session en Bearer ;
// - minimum de 10 caractères appliqué dans l'écran, avec un message clair ;
// - échec : toast d'erreur, PAS d'écran « Signalement envoyé », formulaire conservé ;
// - « Mes signalements » : chargé au montage, rechargé après un envoi et sur « Actualiser »,
//   statuts traduits (« Reçu par le syndic », « Mission confiée à … »).
// Supabase, sonner et fetch sont simulés ; les sections sont chargées par React.lazy.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  toastError: vi.fn(),
  getSession: vi.fn(async () => ({ data: { session: { access_token: 'jeton-copro' } } })),
}))

vi.mock('sonner', () => ({ toast: { error: h.toastError, success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr' }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn(async () => ({ data: {}, error: null })),
      getUser: vi.fn(async () => ({
        data: { user: { id: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4', email: 'frederic@exemple.fr', app_metadata: { role: 'super_admin' } } },
      })),
      getSession: h.getSession,
      signOut: vi.fn(),
    },
  },
}))
vi.mock('@/lib/dashboard-section-loader', async () => {
  const React = await import('react')
  return {
    createDynamicSection: (loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
      const Section = React.lazy(loader)
      return function SectionChargee(props: Record<string, unknown>) {
        return React.createElement(React.Suspense, { fallback: null }, React.createElement(Section, props))
      }
    },
  }
})

import CoproprietaireDashboard from '@/app/coproprietaire/dashboard/page'
import { oublierSuiviSignalements } from '@/lib/copro-signalement'

type Appel = { url: string; init?: RequestInit }
let appels: Appel[] = []
let reponsePost: () => Response
let listeSuivi: Array<Record<string, unknown>> = []

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

const appelsPost = () => appels.filter(a => a.init?.method === 'POST')
const appelsSuivi = () => appels.filter(a => a.url.startsWith('/api/coproprietaire/signalement?email='))

beforeEach(() => {
  localStorage.clear()
  oublierSuiviSignalements()
  h.toastError.mockClear()
  appels = []
  listeSuivi = []
  reponsePost = () => json({ signalement: { id: 'sig-nouveau' } })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, init })
    if (init?.method === 'POST') return reponsePost()
    return json({ signalements: listeSuivi })
  }))
})

// Sections chargées à la demande (React.lazy) : modules importés une fois d'avance, pour que le premier
// test ne dépende pas du temps de transformation (CI chargée).
beforeAll(async () => {
  await import('@/components/coproprietaire-dashboard/pages/CoproAccueilSection')
  await import('@/components/coproprietaire-dashboard/pages/CoproSignalementSection')
})

const ATTENTE = { timeout: 10_000 }

async function ouvrirSignalement() {
  render(<CoproprietaireDashboard />)
  fireEvent.click(await screen.findByRole('button', { name: /^🔔\s*Signalement$/ }, ATTENTE))
  await screen.findByText('🔔 Nouveau signalement', {}, ATTENTE)
}

function remplir(description: string) {
  fireEvent.change(screen.getByLabelText('Type d\'intervention *'), { target: { value: '🔧 Plomberie (fuite, colonne, robinetterie)' } })
  fireEvent.change(screen.getByLabelText('Description du problème *'), { target: { value: description } })
}

const boutonEnvoyer = () => screen.getByRole('button', { name: '📤 Envoyer le signalement au syndic' })

describe('Signalement copropriétaire — envoi au syndic', () => {
  it('moins de 10 caractères : message clair et envoi impossible', async () => {
    await ouvrirSignalement()
    remplir('Fuite')
    expect(screen.getByText(/Encore 5 caractère\(s\) : 10 caractères minimum/)).toBeInTheDocument()
    expect(boutonEnvoyer()).toBeDisabled()
    fireEvent.click(boutonEnvoyer())
    expect(appelsPost()).toHaveLength(0)
  })

  it('envoi réussi : POST avec le jeton en Bearer, écran de confirmation, suivi rechargé', async () => {
    await ouvrirSignalement()
    await waitFor(() => expect(appelsSuivi()).toHaveLength(1), ATTENTE)
    remplir('Fuite d’eau au plafond de la salle de bain')
    expect(boutonEnvoyer()).toBeEnabled()

    listeSuivi = [{ id: 'sig-nouveau', statut: 'en_attente', typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite d’eau au plafond de la salle de bain', createdAt: '2026-10-12T09:00:00Z' }]
    fireEvent.click(boutonEnvoyer())

    expect(await screen.findByText('Signalement envoyé !', {}, ATTENTE)).toBeInTheDocument()
    const [post] = appelsPost()
    expect(post.url).toBe('/api/coproprietaire/signalement')
    expect((post.init?.headers as Record<string, string>).Authorization).toBe('Bearer jeton-copro')
    expect(JSON.parse(post.init?.body as string)).toMatchObject({
      description: 'Fuite d’eau au plafond de la salle de bain',
      demandeurNom: 'Géraldine Xavier',
      demandeurEmail: 'geraldine.xavier@email.com',
      demandeurRole: 'coproprio',
      immeuble: 'Résidence Le Prado',
      typeIntervention: 'Plomberie (fuite, colonne, robinetterie)',
      priorite: 'normale',
      estPartieCommune: false,
    })
    // Rechargé après l'envoi malgré la mémoire de 30 s : le nouveau signalement apparaît.
    await waitFor(() => expect(appelsSuivi()).toHaveLength(2), ATTENTE)
    expect(await screen.findByText('📨 Reçu par le syndic', {}, ATTENTE)).toBeInTheDocument()
    expect(h.toastError).not.toHaveBeenCalled()
  })

  it('échec de l’envoi : toast d’erreur, pas d’écran de confirmation, formulaire conservé', async () => {
    reponsePost = () => json({ error: 'Une erreur interne est survenue' }, 500)
    await ouvrirSignalement()
    remplir('Fuite d’eau au plafond de la salle de bain')
    fireEvent.click(boutonEnvoyer())

    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith('Le signalement n\'a pas pu être envoyé. Réessayez dans un instant.'), ATTENTE)
    expect(screen.queryByText('Signalement envoyé !')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Description du problème *')).toHaveValue('Fuite d’eau au plafond de la salle de bain')
    expect(boutonEnvoyer()).toBeEnabled()
  })

  it('sans session : envoi public, sans en-tête Authorization', async () => {
    h.getSession.mockResolvedValueOnce({ data: { session: null } } as never)
    await ouvrirSignalement()
    remplir('Fuite d’eau au plafond de la salle de bain')
    fireEvent.click(boutonEnvoyer())
    await screen.findByText('Signalement envoyé !', {}, ATTENTE)
    expect(appelsPost()[0].init?.headers).not.toHaveProperty('Authorization')
  })
})

describe('Signalement copropriétaire — Mes signalements', () => {
  it('statut et prestataire missionné par le syndic ; « Actualiser » relance la lecture', async () => {
    listeSuivi = [{ id: 'sig-1', statut: 'acceptee', artisanAssigne: 'Plomberie du Vieux-Port', typeIntervention: 'Plomberie', description: 'Fuite colonne', createdAt: '2026-10-12T09:00:00Z' }]
    await ouvrirSignalement()
    expect(await screen.findByText('👷 Mission confiée à Plomberie du Vieux-Port', {}, ATTENTE)).toBeInTheDocument()
    expect(appelsSuivi()[0].url).toBe('/api/coproprietaire/signalement?email=geraldine.xavier%40email.com')

    listeSuivi = [{ ...listeSuivi[0], statut: 'terminee' }]
    fireEvent.click(screen.getByRole('button', { name: '↻ Actualiser' }))
    expect(await screen.findByText('✅ Intervention terminée', {}, ATTENTE)).toBeInTheDocument()
    expect(appelsSuivi()).toHaveLength(2)
  })

  it('aucun signalement : message vide explicite', async () => {
    await ouvrirSignalement()
    expect(await screen.findByText('Aucun signalement envoyé pour le moment.', {}, ATTENTE)).toBeInTheDocument()
  })
})
