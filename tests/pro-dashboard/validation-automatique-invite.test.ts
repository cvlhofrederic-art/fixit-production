/**
 * Interrupteur « Validation automatique des RDV » de Mon profil (hooks/dashboard/useAvailability.ts), relecture adverse
 * du 26/11/2026.
 *
 * Pour un compte invité dans une société BTP, l'interrupteur écrivait `profiles_artisan.auto_accept` depuis le
 * navigateur, par `artisan.id` — son propre compte, qui n'est la ligne d'aucune fiche : la RLS filtrait sans erreur et
 * l'interrupteur basculait quand même. Contrat vérifié ici : le compte invité passe par le serveur et l'interrupteur ne
 * bascule qu'une fois l'enregistrement fait ; un refus se dit. L'artisan et le gérant écrivent comme avant.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const m = vi.hoisted(() => ({
  ecrituresNavigateur: [] as unknown[],
  authFetch: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'jeton-de-test' } } }) },
    from: () => ({ update: (valeur: unknown) => { m.ecrituresNavigateur.push(valeur); return { eq: async () => ({ error: null }) } } }),
  },
}))
vi.mock('@/lib/api-client', () => ({ authFetch: m.authFetch }))
vi.mock('sonner', () => ({ toast: { error: m.toastError, success: vi.fn(), warning: vi.fn() } }))

import { useAvailability } from '@/hooks/dashboard/useAvailability'

const INVITE = { id: 'compte-du-salarie', user_id: 'compte-du-gerant', fiche_societe_id: 'fiche-de-la-societe' }
const TITULAIRE = { id: 'fiche-du-gerant', user_id: 'compte-du-gerant' }

const basculer = async (artisan: Record<string, unknown>) => {
  const rendu = renderHook(() => useAvailability(artisan, vi.fn()))
  await act(async () => { await rendu.result.current.toggleAutoAccept() })
  return rendu
}

beforeEach(() => {
  m.ecrituresNavigateur = []
  m.authFetch.mockReset()
  m.toastError.mockReset()
})

describe('« Validation automatique » d’un compte invité', () => {
  it('enregistrée par le serveur sur la fiche de la société ; l’interrupteur bascule ensuite', async () => {
    m.authFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })

    const rendu = await basculer(INVITE)

    expect(m.authFetch).toHaveBeenCalledWith('/api/artisan-settings', 'jeton-de-test', expect.objectContaining({ method: 'POST', body: JSON.stringify({ auto_accept: true }) }))
    expect(rendu.result.current.autoAccept).toBe(true)
    expect(m.ecrituresNavigateur).toEqual([])
  })

  it('refusée par le serveur : l’interrupteur ne bouge pas, le motif s’affiche', async () => {
    m.authFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'refus', code: 'aucun_droit_fiche' }) })

    const rendu = await basculer(INVITE)

    expect(rendu.result.current.autoAccept).toBe(false)
    expect(m.toastError).toHaveBeenCalledWith("Votre rôle dans l'entreprise ne permet pas de modifier la fiche de la société.")
    expect(m.ecrituresNavigateur).toEqual([])
  })
})

describe('« Validation automatique » du gérant ou d’un artisan : inchangée', () => {
  it('écrite depuis le navigateur, sans passer par le serveur', async () => {
    const rendu = await basculer(TITULAIRE)

    expect(rendu.result.current.autoAccept).toBe(true)
    expect(m.ecrituresNavigateur).toEqual([{ auto_accept: true }])
    expect(m.authFetch).not.toHaveBeenCalled()
  })
})
