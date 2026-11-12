// ADMIN_EMAIL / ADMIN_EMAIL_2 rognés (lib/auth-helpers.ts, hasSuperAdminEmail et isSuperAdmin), comme les lit
// l'espace copropriétaire (estSuperAdmin, lib/coproprietaire/acces.ts) : un secret Cloudflare saisi avec un espace ou
// un retour à la ligne final ne doit pas retirer l'accès au super admin ; une valeur vide ou faite d'espaces n'entre
// pas dans la liste ; l'e-mail du compte est comparé rogné et en minuscules. Rien d'autre ne change : liste vide →
// false, adresse voisine → false, rôle toujours exigé par isSuperAdmin. Adresses fictives (@vitfix.test, @exemple.test).

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

describe('hasSuperAdminEmail : secrets rognés', () => {
  it.each([
    ['retour à la ligne final', 'admin@vitfix.test\n'],
    ['CRLF final', 'admin@vitfix.test\r\n'],
    ['espaces autour', '  admin@vitfix.test  '],
    ['tabulation et majuscules', '\tAdmin@Vitfix.TEST'],
  ])('ADMIN_EMAIL avec %s → reconnu', async (_cas, valeur) => {
    const { hasSuperAdminEmail } = await chargerAvecListe(valeur, '')
    expect(hasSuperAdminEmail(compte({ email: 'admin@vitfix.test' }))).toBe(true)
  })

  it('ADMIN_EMAIL_2 avec espaces et retour à la ligne → reconnu', async () => {
    const { hasSuperAdminEmail } = await chargerAvecListe('admin@vitfix.test', ' second@vitfix.test\n')
    expect(hasSuperAdminEmail(compte({ email: 'second@vitfix.test' }))).toBe(true)
    expect(hasSuperAdminEmail(compte({ email: 'admin@vitfix.test' }))).toBe(true)
  })

  it('valeur vide ou faite d’espaces : ignorée (jamais une entrée « blanche » de la liste)', async () => {
    const espaces = await chargerAvecListe('   ', '\n')
    expect(espaces.hasSuperAdminEmail(compte({ email: '   ' }))).toBe(false)
    expect(espaces.hasSuperAdminEmail(compte({ email: '\n' }))).toBe(false)
    expect(espaces.hasSuperAdminEmail(compte({ email: 'admin@vitfix.test' }))).toBe(false)
    expect(espaces.hasSuperAdminEmail(compte({ email: '' }))).toBe(false)

    const uneSeule = await chargerAvecListe('  ', 'second@vitfix.test')
    expect(uneSeule.hasSuperAdminEmail(compte({ email: 'second@vitfix.test' }))).toBe(true)
    expect(uneSeule.hasSuperAdminEmail(compte({ email: '  ' }))).toBe(false)
  })

  it('e-mail du compte avec majuscules et espaces : comparé rogné et en minuscules', async () => {
    const { hasSuperAdminEmail } = await chargerAvecListe('admin@vitfix.test', '')
    expect(hasSuperAdminEmail(compte({ email: 'Admin@Vitfix.TEST' }))).toBe(true)
    expect(hasSuperAdminEmail(compte({ email: ' ADMIN@vitfix.test\n' }))).toBe(true)
  })

  it('seuls les espaces parasites sont tolérés : adresse voisine, préfixe ou suffixe → false', async () => {
    const { hasSuperAdminEmail } = await chargerAvecListe(' admin@vitfix.test\n', '')
    for (const email of ['xadmin@vitfix.test', 'admin@vitfix.test.exemple.test', 'admin@vitfix', 'admin @vitfix.test', 'autre@exemple.test']) {
      expect(hasSuperAdminEmail(compte({ email }))).toBe(false)
    }
    expect(hasSuperAdminEmail(compte({}))).toBe(false)
  })
})

describe('isSuperAdmin : secrets rognés, rôle toujours exigé', () => {
  it('rôle super_admin + ADMIN_EMAIL avec retour à la ligne → true', async () => {
    const { isSuperAdmin } = await chargerAvecListe('admin@vitfix.test\n', '')
    expect(isSuperAdmin(compte({ email: 'admin@vitfix.test', role: 'super_admin' }))).toBe(true)
  })

  it('sans le rôle super_admin (ou en « vue en tant que ») → false, même e-mail', async () => {
    const { isSuperAdmin } = await chargerAvecListe('admin@vitfix.test\n', '')
    expect(isSuperAdmin(compte({ email: 'admin@vitfix.test', role: 'syndic' }))).toBe(false)
    expect(isSuperAdmin(compte({ email: 'admin@vitfix.test', role: 'artisan', appMetadata: { _original_role: 'super_admin' } }))).toBe(false)
  })

  it('liste faite d’espaces seulement → false même avec le rôle', async () => {
    const { isSuperAdmin } = await chargerAvecListe(' ', '\n')
    expect(isSuperAdmin(compte({ email: 'admin@vitfix.test', role: 'super_admin' }))).toBe(false)
  })
})

describe('même lecture de la liste que l’espace copropriétaire (estSuperAdmin)', () => {
  it.each([
    'admin@vitfix.test',
    'Admin@Vitfix.test',
    'admin@vitfix.test\n',
    'admin@vitfix.test ',
    ' admin@vitfix.test\r\n',
  ])('ADMIN_EMAIL %j : même verdict pour le super admin', async (valeur) => {
    const helpers = await chargerAvecListe(valeur, '')
    const acces = await import('@/lib/coproprietaire/acces')
    const superAdmin = compte({ email: 'admin@vitfix.test', role: 'super_admin' })
    expect(helpers.isSuperAdmin(superAdmin)).toBe(acces.estSuperAdmin(superAdmin))
    expect(helpers.isSuperAdmin(superAdmin)).toBe(true)
  })
})
