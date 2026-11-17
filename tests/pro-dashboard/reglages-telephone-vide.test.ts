/**
 * Tableau de bord pro (artisan et société BTP `pro_societe`) : réglages « Mon profil » d'un professionnel sans
 * téléphone (hooks/dashboard/useSettings.ts, partagé par tous les rôles du tableau de bord).
 *
 * Défaut corrigé le 15/11/2026 : initSettingsForm préremplissait le champ téléphone avec un vrai numéro quand
 * profiles_artisan.phone était vide, et saveSettings l'envoyait à POST /api/artisan-settings dès le premier
 * enregistrement de n'importe quel réglage (réponse automatique, bio…) : le numéro finissait sur les devis, les
 * factures et la fiche publique du professionnel. Contrat vérifié ici :
 * - profil sans téléphone (null, absent ou vide) → champ vide, et l'enregistrement envoie un téléphone vide ;
 * - aucun champ texte envoyé ne contient de numéro de téléphone qui ne vienne pas du profil ;
 * - profil avec téléphone → son numéro est repris et renvoyé tel quel (pas de régression).
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

const t = (cle: string) => cle

/** Monte le hook, initialise le formulaire avec `profil`, enregistre, puis rend le corps envoyé à l'API. */
async function initialiserPuisEnregistrer(profil: Profil) {
  const setArtisan = vi.fn()
  const { result } = renderHook(() => useSettings(profil, setArtisan, {}, false, t))
  act(() => { result.current.initSettingsForm(profil, 'contact@exemple.fr') })
  const champTelephone = result.current.settingsForm.phone
  await act(async () => { await result.current.saveSettings() })

  const appelsReglages = mocks.authFetch.mock.calls.filter(([url]) => url === '/api/artisan-settings')
  expect(appelsReglages).toHaveLength(1)
  const [, jeton, options] = appelsReglages[0] as [string, string, { method: string; body: string }]
  expect(jeton).toBe('jeton-de-test')
  expect(options.method).toBe('POST')
  return { champTelephone, corps: JSON.parse(options.body) as Record<string, unknown>, setArtisan }
}

/** Valeurs texte du corps qui contiennent au moins 9 chiffres une fois les séparateurs retirés (un numéro). */
function champsAvecNumero(corps: Record<string, unknown>): string[] {
  return Object.entries(corps)
    .filter(([, valeur]) => typeof valeur === 'string' && /\d{9,}/.test(valeur.replace(/[\s.\-+()/]/g, '')))
    .map(([cle]) => cle)
}

beforeEach(() => {
  mocks.getSession.mockReset()
  mocks.authFetch.mockReset()
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'jeton-de-test' } } })
  mocks.authFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
})

describe('useSettings : téléphone d’un professionnel sans numéro', () => {
  const profilBase: Profil = {
    id: 'profil-de-test',
    company_name: 'Entreprise Exemple',
    bio: 'Plomberie et chauffage',
    auto_reply_message: 'Je vous rappelle dans la journée.',
  }

  it.each([
    ['null', { ...profilBase, phone: null }],
    ['absent', { ...profilBase }],
    ['vide', { ...profilBase, phone: '' }],
  ])('téléphone %s : champ vide et enregistrement sans numéro', async (_cas, profil) => {
    const { champTelephone, corps, setArtisan } = await initialiserPuisEnregistrer(profil)

    expect(champTelephone).toBe('')
    expect(corps.phone).toBe('')
    expect(champsAvecNumero(corps)).toEqual([])
    expect(setArtisan).toHaveBeenCalledWith(expect.objectContaining({ phone: '' }))
  })

  it('téléphone renseigné : le numéro du profil est repris et renvoyé tel quel', async () => {
    const { champTelephone, corps, setArtisan } = await initialiserPuisEnregistrer({ ...profilBase, phone: '01 02 03 04 05' })

    expect(champTelephone).toBe('01 02 03 04 05')
    expect(corps.phone).toBe('01 02 03 04 05')
    expect(champsAvecNumero(corps)).toEqual(['phone'])
    expect(setArtisan).toHaveBeenCalledWith(expect.objectContaining({ phone: '01 02 03 04 05' }))
  })
})
