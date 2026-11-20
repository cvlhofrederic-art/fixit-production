// tests/components/marches-actions-session.test.tsx
//
// Tableau de bord, « Bourse aux Marchés » (écran partagé artisan / société BTP) : les actions sur un marché appellent
// des routes qui exigent le jeton de la session (getAuthUser ne lit que l'en-tête Authorization) :
//   - candidater (POST /api/marches/[id]/candidature) ;
//   - lire et écrire les messages d'une candidature (/api/marches/[id]/messages) ;
//   - évaluer le donneur d'ordre et lire son évaluation (/api/marches/[id]/evaluation).
// Audit des fondations BTP du 11/11/2026 : ces appels partaient sans jeton et la route répondait toujours 401.
// Société BTP : la session est envoyée, et l'évaluation reçue est lue dans la liste que rend la route.
// Artisan : comportement inchangé (règle artisan / BTP) ; le même défaut y reste, signalé.

import React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

type Props = Record<string, unknown>
const h = vi.hoisted(() => ({ jeton: 'jeton-de-session', vues: {} as Record<string, Props> }))

vi.mock('@/lib/supabase', () => {
  const canal = { on: () => canal, subscribe: () => canal, unsubscribe: () => {} }
  return {
    supabase: {
      auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: h.jeton } } })) },
      channel: () => canal,
      removeChannel: () => {},
    },
  }
})
vi.mock('@/lib/realtime-reconnect', () => ({ subscribeWithReconnect: (canal: unknown) => canal }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
// Vues chargées à la demande : rendues dès leur chargement, pour que le test lise leurs propriétés.
vi.mock('next/dynamic', async () => {
  const R = await import('react')
  return {
    default: (chargeur: () => Promise<{ default: React.ComponentType<Props> }>) => {
      let Vue: React.ComponentType<Props> | null = null
      const charge = chargeur().then(module => { Vue = module.default })
      return function VueDynamique(props: Props) {
        const [, rafraichir] = R.useState(0)
        R.useEffect(() => {
          let actif = true
          void charge.then(() => { if (actif) rafraichir(1) })
          return () => { actif = false }
        }, [])
        return Vue ? R.createElement(Vue, props) : null
      }
    },
  }
})
// Hissée avec les simulations : le chargeur simulé de next/dynamic importe les vues dès l'import de l'écran, avant la
// suite du fichier.
const { vueFactice } = vi.hoisted(() => ({
  vueFactice: (nom: string) => ({ default: (props: Record<string, unknown>) => { h.vues[nom] = props; return null } }),
}))
vi.mock('@/components/marches/views/BrowseTabView', () => vueFactice('parcourir'))
vi.mock('@/components/marches/views/MyBidsTabView', () => vueFactice('candidatures'))
vi.mock('@/components/marches/views/WonContractsTabView', () => vueFactice('gagnes'))
vi.mock('@/components/marches/views/SettingsTabView', () => vueFactice('parametres'))
vi.mock('@/components/marches/views/DetailModalView', () => vueFactice('fiche'))

import BourseAuxMarchesSection from '@/components/marches/BourseAuxMarchesSection'
import { LanguageProvider } from '@/lib/i18n/context'

/** Écran monté avec l'interface en français : il suit la langue de l'interface (portugais par défaut sans fournisseur). */
const enFrancais = (element: React.ReactElement) => <LanguageProvider initialLocale="fr">{element}</LanguageProvider>

const COMPTE = '11111111-1111-4111-8111-111111111111'
const FICHE = '33333333-3333-4333-8333-333333333333'
const MARCHE = '44444444-4444-4444-8444-444444444444'
const CANDIDATURE = '66666666-6666-4666-8666-666666666666'
const SOCIETE = { id: FICHE, user_id: COMPTE, company_name: 'Bâtiment du Banc SARL', categories: [] }

type AppelReseau = { url: string; methode: string; autorisation: string | undefined }
let appels: AppelReseau[] = []

const reponse = (url: string, methode: string): unknown => {
  if (url.includes('/evaluation') && methode === 'GET') {
    return {
      evaluations: [
        { id: 'e1', evaluator_type: 'artisan', note_globale: 5, commentaire: 'Paiement rapide', candidature_id: CANDIDATURE },
        { id: 'e2', evaluator_type: 'publisher', note_globale: 4, commentaire: 'Travail soigné', candidature_id: CANDIDATURE },
      ],
    }
  }
  return { marches: [], candidatures: [], messages: [], candidature: { id: CANDIDATURE } }
}

beforeEach(() => {
  appels = []
  h.vues = {}
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const entetes = (options?.headers ?? {}) as Record<string, string>
    const methode = options?.method ?? 'GET'
    appels.push({ url: String(url), methode, autorisation: entetes.Authorization })
    return new Response(JSON.stringify(reponse(String(url), methode)), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

const vue = (nom: string) => h.vues[nom] as Record<string, (...args: unknown[]) => unknown>
const appelVers = (debut: string, methode: string) => appels.find(a => a.url.startsWith(debut) && a.methode === methode)

/** Ouvre la fiche d'un marché depuis la liste, comme un clic sur une carte. */
async function ouvrirLaFiche(orgRole: 'pro_societe' | 'artisan') {
  await act(async () => { render(enFrancais(<BourseAuxMarchesSection artisan={SOCIETE} orgRole={orgRole} navigateTo={vi.fn()} />)) })
  await vi.waitFor(() => expect(h.vues.parcourir).toBeDefined())
  await act(async () => { vue('parcourir').onSelectMarche({ id: MARCHE, title: 'Ravalement', my_candidature_id: CANDIDATURE }) })
  await vi.waitFor(() => expect(h.vues.fiche).toBeDefined())
}

async function candidater() {
  await act(async () => {
    vue('fiche').onBidPriceChange('5000')
    vue('fiche').onBidTimelineChange('1_mois')
    vue('fiche').onBidDescriptionChange('Pose de plaques de plâtre, deux équipes.')
  })
  await act(async () => { await vue('fiche').onSubmitBid({ preventDefault: () => {} }) })
}

async function ecrire() {
  await act(async () => { await vue('fiche').onLoadMessages(MARCHE, CANDIDATURE) })
  await act(async () => { vue('fiche').onMsgInputChange('Pouvons-nous commencer lundi ?') })
  await act(async () => { await vue('fiche').onSendMessage(MARCHE, CANDIDATURE) })
}

async function evaluer(orgRole: 'pro_societe' | 'artisan') {
  await act(async () => { render(enFrancais(<BourseAuxMarchesSection artisan={SOCIETE} orgRole={orgRole} navigateTo={vi.fn()} />)) })
  await act(async () => { fireEvent.click(screen.getByText('Gagnés')) })
  await vi.waitFor(() => expect(h.vues.gagnes).toBeDefined())
  await act(async () => { await vue('gagnes').onSubmitEvaluation(MARCHE, CANDIDATURE, 4, 'Très bonne collaboration') })
  await act(async () => { await vue('gagnes').onLoadReceivedEvaluation(MARCHE) })
}

describe('Bourse aux Marchés — société BTP : les actions sur un marché envoient la session', () => {
  it('candidater part avec le jeton de la session', async () => {
    await ouvrirLaFiche('pro_societe')
    await candidater()
    expect(appelVers(`/api/marches/${MARCHE}/candidature`, 'POST')).toEqual({
      url: `/api/marches/${MARCHE}/candidature`, methode: 'POST', autorisation: 'Bearer jeton-de-session',
    })
  })

  it('lire et écrire les messages d’une candidature partent avec le jeton de la session', async () => {
    await ouvrirLaFiche('pro_societe')
    await ecrire()
    expect(appelVers(`/api/marches/${MARCHE}/messages?`, 'GET')?.autorisation).toBe('Bearer jeton-de-session')
    expect(appelVers(`/api/marches/${MARCHE}/messages`, 'POST')?.autorisation).toBe('Bearer jeton-de-session')
  })

  it('évaluer le donneur d’ordre et lire son évaluation partent avec le jeton ; l’évaluation reçue s’affiche', async () => {
    await evaluer('pro_societe')
    expect(appelVers(`/api/marches/${MARCHE}/evaluation`, 'POST')?.autorisation).toBe('Bearer jeton-de-session')
    expect(appelVers(`/api/marches/${MARCHE}/evaluation?`, 'GET')?.autorisation).toBe('Bearer jeton-de-session')
    // Celle du donneur d'ordre, prise dans la liste que rend la route ; son commentaire sous le nom attendu par la vue.
    await vi.waitFor(() => expect((h.vues.gagnes.receivedEval as Record<string, unknown>)[MARCHE]).toMatchObject({
      evaluator_type: 'publisher', note_globale: 4, comment: 'Travail soigné',
    }))
  })
})

describe('Bourse aux Marchés — artisan : comportement inchangé', () => {
  it('candidater, écrire et évaluer partent comme avant, sans jeton', async () => {
    await ouvrirLaFiche('artisan')
    await candidater()
    await ecrire()
    expect(appelVers(`/api/marches/${MARCHE}/candidature`, 'POST')?.autorisation).toBeUndefined()
    expect(appelVers(`/api/marches/${MARCHE}/messages?`, 'GET')?.autorisation).toBeUndefined()
    expect(appelVers(`/api/marches/${MARCHE}/messages`, 'POST')?.autorisation).toBeUndefined()
  })

  it('évaluer et lire l’évaluation reçue partent comme avant, sans jeton', async () => {
    await evaluer('artisan')
    expect(appelVers(`/api/marches/${MARCHE}/evaluation`, 'POST')?.autorisation).toBeUndefined()
    expect(appelVers(`/api/marches/${MARCHE}/evaluation?`, 'GET')?.autorisation).toBeUndefined()
    expect(h.vues.gagnes.receivedEval).toEqual({})
  })
})
