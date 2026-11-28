/**
 * Page de connexion et alerte météo du téléphone (27/11/2026) : arrivé sur la page de connexion sans session dans
 * l'appli Vitfix Pro (session révoquée ou expirée, démarrage sans session, déconnexion depuis un autre appareil), les
 * notifications encore programmées sont annulées : un téléphone déconnecté n'affiche plus le titre des chantiers.
 * Session valide ou seulement indisponible (réseau) : rien n'est annulé. Hors de l'appli : rien.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AuthApiError } from '@supabase/supabase-js'

const h = vi.hoisted(() => ({ appli: true, annuler: vi.fn(async () => {}) }))

vi.mock('@/lib/supabase', async () => (await import('../helpers/page-connexion')).supabaseFactice())
vi.mock('@/lib/app-mobile', () => ({ estAppMobile: () => h.appli }))
vi.mock('@/lib/btp/alerte-meteo-telephone', () => ({ annulerAlertesProgrammees: h.annuler }))
vi.mock('@/lib/i18n/context', async () => (await import('../helpers/page-connexion')).i18nFrancais())
vi.mock('@/components/common/LocaleLink', async () => (await import('../helpers/page-connexion')).localeLinkSimple())

import LoginPage from '@/app/(commun)/auth/login/page'
import { annulerNotification } from '@/lib/notifications'
import { authSimulee as simul, installerLocationFactice } from '../helpers/page-connexion'

let restaurerLocation: () => void = () => {}
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  vi.clearAllMocks()
  h.appli = true
  simul.getSession.mockResolvedValue({ data: { session: null }, error: null })
  simul.signOut.mockResolvedValue({ error: null })
  ;({ restaurer: restaurerLocation } = installerLocationFactice())
})

afterEach(() => {
  restaurerLocation()
})

describe('page de connexion — alertes météo programmées sur le téléphone', () => {
  it('dans l’appli, aucune session : les alertes programmées sont annulées', async () => {
    simul.getUser.mockResolvedValue({ data: { user: null }, error: null })
    render(<LoginPage />)
    await waitFor(() => expect(h.annuler).toHaveBeenCalledWith(annulerNotification))
  })

  it('dans l’appli, session refusée (401) : annulées aussi', async () => {
    simul.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('invalid JWT', 401, 'bad_jwt') })
    render(<LoginPage />)
    await waitFor(() => expect(h.annuler).toHaveBeenCalledTimes(1))
  })

  it('session valide, ou seulement indisponible (réseau) : rien n’est annulé', async () => {
    simul.getUser.mockResolvedValue({ data: { user: { id: 'u1', app_metadata: { role: 'pro_societe' }, user_metadata: {} } }, error: null })
    render(<LoginPage />)
    await attendre(30)
    simul.getUser.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<LoginPage />)
    await attendre(30)
    expect(h.annuler).not.toHaveBeenCalled()
  })

  it('hors de l’appli (navigateur) : rien n’est annulé', async () => {
    h.appli = false
    simul.getUser.mockResolvedValue({ data: { user: null }, error: null })
    render(<LoginPage />)
    await attendre(30)
    expect(h.annuler).not.toHaveBeenCalled()
  })
})
