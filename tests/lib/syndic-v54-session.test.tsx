import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'

/**
 * Session v54 : `authed` pour les rôles acceptés par isSyndicRole côté serveur
 * (syndic, syndic_*, super_admin). Le super_admin (compte de démo de Frédéric)
 * voit les données réelles de son cabinet (son id) et les agents IA branchés.
 */

const h = vi.hoisted(() => ({
  session: null as null | { access_token: string; user: { id: string; app_metadata: { role?: string } } },
  unsubscribe: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: h.session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: h.unsubscribe } } })),
    },
  },
}))

import { useSyndicSession } from '@/lib/syndic/v54/session'

const sessionAvecRole = (role?: string) => ({
  access_token: `jeton-${role ?? 'sans-role'}`,
  user: { id: `id-${role ?? 'sans-role'}`, app_metadata: role ? { role } : {} },
})

async function statutFinal() {
  const { result } = renderHook(() => useSyndicSession())
  await waitFor(() => expect(result.current.status).not.toBe('loading'))
  return result.current
}

beforeEach(() => { h.session = null })
afterEach(cleanup)

describe('useSyndicSession — rôles authentifiés', () => {
  it('super_admin → authed, avec son jeton et son id (cabinet = son id côté serveur)', async () => {
    h.session = sessionAvecRole('super_admin')
    expect(await statutFinal()).toEqual({ status: 'authed', token: 'jeton-super_admin', userId: 'id-super_admin', role: 'super_admin' })
  })

  it.each(['syndic', 'syndic_tech', 'syndic_comptable'])('%s → authed (inchangé)', async (role) => {
    h.session = sessionAvecRole(role)
    const s = await statutFinal()
    expect(s.status).toBe('authed')
    expect(s.token).toBe(`jeton-${role}`)
  })
})

describe('useSyndicSession — rôles anonymes (données mock)', () => {
  it.each(['admin', 'artisan', 'client', undefined])('%s → anon (refusé par isSyndicRole côté serveur)', async (role) => {
    h.session = sessionAvecRole(role)
    expect(await statutFinal()).toEqual({ status: 'anon', token: null, userId: null, role: null })
  })

  it('pas de session → anon', async () => {
    expect((await statutFinal()).status).toBe('anon')
  })
})
