// Échafaudage partagé des tests de contrôle d'accès super_admin.
//
// isSuperAdmin (lib/auth-helpers.ts) exige app_metadata.role === 'super_admin' ET un e-mail
// de la liste ADMIN_EMAIL / ADMIN_EMAIL_2. Cette liste est lue au chargement du module :
// appeler definirListeSuperAdmin() au niveau du fichier de test, AVANT l'import dynamique de
// la route testée (ce module n'importe pas lib/auth-helpers).

import { vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

export const EMAIL_SUPER_ADMIN = 'admin@vitfix.test'
export const EMAIL_SUPER_ADMIN_2 = 'admin2@vitfix.test'
export const EMAIL_HORS_LISTE = 'compte@exemple.test'

export const ID_COMPTE = '00000000-0000-4000-8000-000000000001'
export const ID_AUTRE_COMPTE = '00000000-0000-4000-8000-000000000002'

export function definirListeSuperAdmin(): void {
  vi.stubEnv('ADMIN_EMAIL', EMAIL_SUPER_ADMIN)
  vi.stubEnv('ADMIN_EMAIL_2', EMAIL_SUPER_ADMIN_2)
}

interface OptionsCompte {
  id?: string
  email?: string
  role?: string
  appMetadata?: Record<string, unknown>
}

/** Compte Supabase minimal : rôle et marqueurs dans app_metadata, comme posés par le serveur. */
export function compte({ id = ID_COMPTE, email, role, appMetadata = {} }: OptionsCompte): User {
  return {
    id,
    email,
    app_metadata: { ...(role ? { role } : {}), ...appMetadata },
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
  } as User
}

/** super_admin dont l'e-mail est dans la liste. */
export const superAdminAutorise = (id?: string): User =>
  compte({ id, email: EMAIL_SUPER_ADMIN, role: 'super_admin' })

/** Rôle super_admin sans e-mail de la liste : isSuperAdmin le refuse. */
export const superAdminHorsListe = (id?: string): User =>
  compte({ id, email: EMAIL_HORS_LISTE, role: 'super_admin' })
