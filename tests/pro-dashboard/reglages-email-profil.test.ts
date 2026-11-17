/**
 * Tableau de bord pro (artisan et société BTP `pro_societe`) : e-mail professionnel de « Mon profil »
 * (hooks/dashboard/useSettings.ts, partagé par tous les rôles du tableau de bord).
 *
 * Défaut corrigé le 17/11/2026 : initSettingsForm remplissait le champ e-mail avec l'adresse de connexion, jamais
 * avec profiles_artisan.email. Tout enregistrement d'un réglage (profil, réponse automatique) renvoyait donc
 * l'adresse de connexion à POST /api/artisan-settings, qui l'écrivait dans le profil : l'e-mail professionnel
 * choisi par le pro disparaissait des devis, des factures et de la fiche publique. Contrat vérifié ici :
 * - profil avec un e-mail professionnel → le champ le reprend et l'enregistrement le renvoie tel quel ;
 * - profil sans e-mail (null, absent ou vide) → l'adresse de connexion sert de valeur de départ.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authFetch: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: mocks.getSession } } }))
vi.mock('@/lib/api-client', () => ({ authFetch: mocks.authFetch }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))

import { useSettings } from '@/hooks/dashboard/useSettings'

type Profil = Record<string, unknown>

const ADRESSE_CONNEXION = 'connexion@exemple.fr'
const EMAIL_PROFESSIONNEL = 'contact@entreprise-exemple.fr'
const t = (cle: string) => cle

/** Monte le hook, initialise le formulaire avec `profil`, enregistre, puis rend le corps envoyé à l'API. */
async function initialiserPuisEnregistrer(profil: Profil) {
  const setArtisan = vi.fn()
  const { result } = renderHook(() => useSettings(profil, setArtisan, {}, false, t))
  act(() => { result.current.initSettingsForm(profil, ADRESSE_CONNEXION) })
  const champEmail = result.current.settingsForm.email
  await act(async () => { await result.current.saveSettings() })

  const appelsReglages = mocks.authFetch.mock.calls.filter(([url]) => url === '/api/artisan-settings')
  expect(appelsReglages).toHaveLength(1)
  const [, , options] = appelsReglages[0] as [string, string, { method: string; body: string }]
  expect(options.method).toBe('POST')
  return { champEmail, corps: JSON.parse(options.body) as Record<string, unknown>, setArtisan }
}

beforeEach(() => {
  mocks.getSession.mockReset()
  mocks.authFetch.mockReset()
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'jeton-de-test' } } })
  mocks.authFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
})

describe('useSettings : e-mail professionnel de « Mon profil »', () => {
  const profilBase: Profil = {
    id: 'profil-de-test',
    company_name: 'Entreprise Exemple',
    phone: '',
    bio: 'Plomberie et chauffage',
    auto_reply_message: 'Je vous rappelle dans la journée.',
  }

  it('e-mail professionnel enregistré : repris dans le champ et renvoyé tel quel, jamais remplacé par l’adresse de connexion', async () => {
    const { champEmail, corps, setArtisan } = await initialiserPuisEnregistrer({ ...profilBase, email: EMAIL_PROFESSIONNEL })

    expect(champEmail).toBe(EMAIL_PROFESSIONNEL)
    expect(corps.email).toBe(EMAIL_PROFESSIONNEL)
    expect(setArtisan).toHaveBeenCalledWith(expect.objectContaining({ email: EMAIL_PROFESSIONNEL }))
  })

  it.each([
    ['null', { ...profilBase, email: null }],
    ['absent', { ...profilBase }],
    ['vide', { ...profilBase, email: '' }],
  ])('e-mail du profil %s : l’adresse de connexion sert de valeur de départ', async (_cas, profil) => {
    const { champEmail, corps } = await initialiserPuisEnregistrer(profil)

    expect(champEmail).toBe(ADRESSE_CONNEXION)
    expect(corps.email).toBe(ADRESSE_CONNEXION)
  })
})
