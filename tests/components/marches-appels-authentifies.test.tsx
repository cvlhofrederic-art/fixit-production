// tests/components/marches-appels-authentifies.test.tsx
//
// Les écrans qui lisent les modes personnels des routes /api/marches envoient le jeton de la session
// (ces routes ne répondent plus sans : tests/api/marches-acces.test.ts) :
//   - espace client, « Bourse aux Marchés » : ses offres publiées (?publisher_user_id=…) ;
//   - tableau de bord artisan / BTP, « Bourse aux Marchés » : ses candidatures (?my_bids=true&artisan_id=…) ;
//   - tableau de bord BTP, « Recruter sous-traitants » : ses offres (sous-traitance?btp_company_id=…).
// Sans l'en-tête, ces listes resteraient vides en silence.
// Un refus du serveur (session expirée, limite de débit, panne) est dit par un message dans l'espace client et,
// côté société BTP, dans les deux écrans du tableau de bord ; côté artisan, le comportement n'est pas modifié.

import React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

// `refuser` : fragment d'adresse auquel le faux serveur répond 401, les autres appels gardant `statut`.
const h = vi.hoisted(() => ({ jeton: 'jeton-de-session' as string | null, statut: 200, refuser: null as string | null }))

vi.mock('@/lib/supabase', () => {
  const canal = { on: () => canal, subscribe: () => canal, unsubscribe: () => {} }
  return {
    supabase: {
      auth: { getSession: vi.fn(async () => ({ data: { session: h.jeton ? { access_token: h.jeton } : null } })) },
      channel: () => canal,
      removeChannel: () => {},
    },
  }
})
vi.mock('@/lib/realtime-reconnect', () => ({ subscribeWithReconnect: (canal: unknown) => canal }))
// Vues chargées à la demande : seul le chargement des données compte ici.
vi.mock('next/dynamic', () => ({ default: () => function VueFactice() { return null } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { toast } from 'sonner'
import ClientMarchesSection from '@/components/client-dashboard/pages/ClientMarchesSection'
import BourseAuxMarchesSection from '@/components/marches/BourseAuxMarchesSection'
import { LanguageProvider } from '@/lib/i18n/context'
import SousTraitanceOffresSection from '@/components/dashboard/SousTraitanceOffresSection'

const COMPTE = '11111111-1111-4111-8111-111111111111'
const AUTRE_COMPTE = '22222222-2222-4222-8222-222222222222'
const FICHE = '33333333-3333-4333-8333-333333333333'
const SOCIETE = { id: FICHE, user_id: COMPTE, company_name: 'Bâtiment du Banc SARL', categories: [] }

type AppelReseau = { url: string; autorisation: string | undefined }
let appels: AppelReseau[] = []

beforeEach(() => {
  appels = []
  h.jeton = 'jeton-de-session'
  h.statut = 200
  h.refuser = null
  vi.mocked(toast.error).mockClear()
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const entetes = (options?.headers ?? {}) as Record<string, string>
    appels.push({ url: String(url), autorisation: entetes.Authorization })
    const statut = h.refuser !== null && String(url).includes(h.refuser) ? 401 : h.statut
    return new Response(JSON.stringify({ marches: [], candidatures: [], offers: [] }), { status: statut, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

const appelsVers = (fragment: string) => appels.filter(a => a.url.includes(fragment))
/** Laisse aux effets le temps de se rejouer. */
const laisserPasser = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 50)) })

describe('Espace client — mes appels d’offres publiés', () => {
  it('la lecture part avec le jeton de la session', async () => {
    await act(async () => { render(<ClientMarchesSection userId={COMPTE} locale="fr" />) })
    await vi.waitFor(() => expect(appelsVers('publisher_user_id=')).toHaveLength(1))
    expect(appelsVers('publisher_user_id=')[0]).toEqual({
      url: `/api/marches?publisher_user_id=${COMPTE}`,
      autorisation: 'Bearer jeton-de-session',
    })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('une liste vide ne relance pas la lecture (un seul appel, pas de boucle)', async () => {
    await act(async () => { render(<ClientMarchesSection userId={COMPTE} locale="fr" />) })
    await vi.waitFor(() => expect(appelsVers('publisher_user_id=')).toHaveLength(1))
    // Avant correction, chaque réponse vide relançait un appel.
    await laisserPasser()
    expect(appelsVers('publisher_user_id=')).toHaveLength(1)
  })

  it('un refus du serveur (session expirée) est dit à l’utilisateur, sans relance', async () => {
    h.jeton = null
    h.statut = 401
    await act(async () => { render(<ClientMarchesSection userId={COMPTE} locale="fr" />) })
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Impossible de charger vos marchés'))
    await laisserPasser()
    expect(appelsVers('publisher_user_id=')).toEqual([{ url: `/api/marches?publisher_user_id=${COMPTE}`, autorisation: undefined }])
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('pas de compte : aucun appel ; changement de compte : nouvelle lecture pour le nouveau compte', async () => {
    let rendu!: ReturnType<typeof render>
    await act(async () => { rendu = render(<ClientMarchesSection userId={undefined} locale="fr" />) })
    await laisserPasser()
    expect(appels).toHaveLength(0)
    await act(async () => { rendu.rerender(<ClientMarchesSection userId={COMPTE} locale="fr" />) })
    await vi.waitFor(() => expect(appelsVers('publisher_user_id=')).toHaveLength(1))
    await act(async () => { rendu.rerender(<ClientMarchesSection userId={AUTRE_COMPTE} locale="fr" />) })
    await vi.waitFor(() => expect(appelsVers('publisher_user_id=')).toHaveLength(2))
    expect(appelsVers('publisher_user_id=')[1].url).toBe(`/api/marches?publisher_user_id=${AUTRE_COMPTE}`)
  })
})

describe('Tableau de bord artisan / BTP — mes candidatures', () => {
  for (const orgRole of ['pro_societe', 'artisan'] as const) {
    it(`${orgRole} : la lecture des candidatures part avec le jeton de la session`, async () => {
      await act(async () => { render(<LanguageProvider initialLocale="fr"><BourseAuxMarchesSection artisan={SOCIETE} orgRole={orgRole} navigateTo={vi.fn()} /></LanguageProvider>) })
      await vi.waitFor(() => expect(appelsVers('my_bids=true')).not.toHaveLength(0))
      expect(appelsVers('my_bids=true')[0]).toEqual({
        url: `/api/marches?my_bids=true&artisan_id=${FICHE}`,
        autorisation: 'Bearer jeton-de-session',
      })
      // La liste publique des marchés, elle, part sans jeton.
      const listePublique = appels.filter(a => a.url.startsWith('/api/marches?') && a.url.includes('pays=FR') && !a.url.includes('my_bids'))
      expect(listePublique.length).toBeGreaterThan(0)
      expect(listePublique.every(a => a.autorisation === undefined)).toBe(true)
      expect(toast.error).not.toHaveBeenCalled()
    })
  }

  it('pro_societe : un refus du serveur est dit, pas montré comme « aucune candidature »', async () => {
    h.refuser = 'my_bids=true'
    await act(async () => { render(<LanguageProvider initialLocale="fr"><BourseAuxMarchesSection artisan={SOCIETE} orgRole="pro_societe" navigateTo={vi.fn()} /></LanguageProvider>) })
    // Identifiant fixe : une relance (changement de filtre, notification) remplace le message au lieu de l'empiler.
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Impossible de charger vos candidatures', { id: 'marches-mes-candidatures' }))
    // La liste publique, elle, s'est chargée : aucun autre message.
    await laisserPasser()
    expect(vi.mocked(toast.error).mock.calls.every(([message]) => message === 'Impossible de charger vos candidatures')).toBe(true)
  })

  it('artisan : comportement inchangé, le refus reste sans message', async () => {
    h.refuser = 'my_bids=true'
    await act(async () => { render(<LanguageProvider initialLocale="fr"><BourseAuxMarchesSection artisan={SOCIETE} orgRole="artisan" navigateTo={vi.fn()} /></LanguageProvider>) })
    await vi.waitFor(() => expect(appelsVers('my_bids=true')).not.toHaveLength(0))
    await laisserPasser()
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('Tableau de bord BTP — mes offres de sous-traitance', () => {
  it('la lecture des offres de la société part avec le jeton de la session', async () => {
    await act(async () => { render(<LanguageProvider initialLocale="fr"><SousTraitanceOffresSection artisan={SOCIETE as never} orgRole="pro_societe" /></LanguageProvider>) })
    await vi.waitFor(() => expect(appelsVers('sous-traitance?btp_company_id=')).not.toHaveLength(0))
    expect(appelsVers('sous-traitance?btp_company_id=')[0]).toEqual({
      url: `/api/marches/sous-traitance?btp_company_id=${FICHE}`,
      autorisation: 'Bearer jeton-de-session',
    })
    expect(screen.queryByText('Session expirée')).toBeNull()
    await laisserPasser()
    expect(screen.queryByText('Impossible de charger vos annonces')).toBeNull()
  })

  it('un refus du serveur est dit, pas montré seulement comme « aucune annonce »', async () => {
    h.refuser = 'sous-traitance?btp_company_id='
    await act(async () => { render(<LanguageProvider initialLocale="fr"><SousTraitanceOffresSection artisan={SOCIETE as never} orgRole="pro_societe" /></LanguageProvider>) })
    expect(await screen.findByText('Impossible de charger vos annonces')).toBeInTheDocument()
  })

  it('hors société BTP : comportement inchangé, le refus reste sans message', async () => {
    h.refuser = 'sous-traitance?btp_company_id='
    await act(async () => { render(<LanguageProvider initialLocale="fr"><SousTraitanceOffresSection artisan={SOCIETE as never} orgRole="artisan" /></LanguageProvider>) })
    await vi.waitFor(() => expect(appelsVers('sous-traitance?btp_company_id=')).not.toHaveLength(0))
    await laisserPasser()
    expect(screen.queryByText('Impossible de charger vos annonces')).toBeNull()
  })
})
