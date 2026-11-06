// isSuperAdmin / hasSuperAdminEmail (lib/auth-helpers.ts) : rôle app_metadata ET e-mail de la
// liste ADMIN_EMAIL / ADMIN_EMAIL_2. La liste est lue au chargement du module : chaque cas
// recharge le module après avoir posé l'environnement voulu.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { compte } from '../api/super-admin-test-utils'

async function chargerAvecListe(admin1: string, admin2: string) {
  vi.resetModules()
  vi.stubEnv('ADMIN_EMAIL', admin1)
  vi.stubEnv('ADMIN_EMAIL_2', admin2)
  return import('@/lib/auth-helpers')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('hasSuperAdminEmail', () => {
  it('e-mail de la liste, casse ignorée → true', async () => {
    const { hasSuperAdminEmail } = await chargerAvecListe('Admin@Vitfix.test', 'second@vitfix.test')
    expect(hasSuperAdminEmail(compte({ email: 'admin@vitfix.TEST' }))).toBe(true)
    expect(hasSuperAdminEmail(compte({ email: 'second@vitfix.test' }))).toBe(true)
  })

  it('e-mail hors liste ou compte sans e-mail → false', async () => {
    const { hasSuperAdminEmail } = await chargerAvecListe('admin@vitfix.test', '')
    expect(hasSuperAdminEmail(compte({ email: 'autre@exemple.test' }))).toBe(false)
    expect(hasSuperAdminEmail(compte({}))).toBe(false)
  })

  it('liste vide (variables absentes) → false', async () => {
    const { hasSuperAdminEmail } = await chargerAvecListe('', '')
    expect(hasSuperAdminEmail(compte({ email: 'admin@vitfix.test' }))).toBe(false)
  })
})

describe('isSuperAdmin', () => {
  it('rôle super_admin + e-mail de la liste → true', async () => {
    const { isSuperAdmin } = await chargerAvecListe('admin@vitfix.test', '')
    expect(isSuperAdmin(compte({ email: 'admin@vitfix.test', role: 'super_admin' }))).toBe(true)
  })

  it('rôle super_admin + e-mail hors liste → false', async () => {
    const { isSuperAdmin } = await chargerAvecListe('admin@vitfix.test', '')
    expect(isSuperAdmin(compte({ email: 'autre@exemple.test', role: 'super_admin' }))).toBe(false)
  })

  it('e-mail de la liste sans le rôle super_admin → false', async () => {
    const { isSuperAdmin } = await chargerAvecListe('admin@vitfix.test', '')
    expect(isSuperAdmin(compte({ email: 'admin@vitfix.test', role: 'syndic' }))).toBe(false)
    expect(
      isSuperAdmin(compte({ email: 'admin@vitfix.test', role: 'artisan', appMetadata: { _original_role: 'super_admin' } })),
    ).toBe(false)
  })

  it('rôle lu dans app_metadata seulement, jamais user_metadata', async () => {
    const { isSuperAdmin } = await chargerAvecListe('admin@vitfix.test', '')
    const user = { ...compte({ email: 'admin@vitfix.test' }), user_metadata: { role: 'super_admin' } }
    expect(isSuperAdmin(user)).toBe(false)
  })

  it('liste vide → false même avec le rôle', async () => {
    const { isSuperAdmin } = await chargerAvecListe('', '')
    expect(isSuperAdmin(compte({ email: 'admin@vitfix.test', role: 'super_admin' }))).toBe(false)
  })
})
