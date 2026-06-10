import { describe, it, expect } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { isProGerant } from '@/lib/auth-helpers'

// Régression sécurité (audit 2026-06-10) : isProGerant doit lire pro_team_role
// dans app_metadata (server-only, non forgeable) et JAMAIS dans user_metadata
// (modifiable côté client via supabase.auth.updateUser → escalade de privilège).

function makeUser(app: Record<string, unknown>, userMeta: Record<string, unknown> = {}): User {
  return {
    id: '00000000-0000-4000-8000-000000000000',
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    app_metadata: app,
    user_metadata: userMeta,
  } as unknown as User
}

describe('isProGerant — source de vérité app_metadata (anti-escalade)', () => {
  it('pro_societe sans pro_team_role → gérant (le propriétaire EST la société)', () => {
    expect(isProGerant(makeUser({ role: 'pro_societe' }))).toBe(true)
  })

  it('pro_societe avec app_metadata.pro_team_role=GERANT → gérant', () => {
    expect(isProGerant(makeUser({ role: 'pro_societe', pro_team_role: 'GERANT' }))).toBe(true)
  })

  it('sous-compte (app_metadata.pro_team_role=TECHNICIEN) → PAS gérant', () => {
    expect(isProGerant(makeUser({ role: 'pro_societe', pro_team_role: 'TECHNICIEN' }))).toBe(false)
  })

  it('SÉCURITÉ : user_metadata.pro_team_role=GERANT forgé ne doit PAS élever un sous-compte', () => {
    expect(
      isProGerant(makeUser({ role: 'pro_societe', pro_team_role: 'TECHNICIEN' }, { pro_team_role: 'GERANT' }))
    ).toBe(false)
  })

  it('SÉCURITÉ : user_metadata seul (sans app_metadata) ne fait pas autorité', () => {
    expect(isProGerant(makeUser({ role: 'pro_societe', pro_team_role: 'OUVRIER' }, { pro_team_role: 'GERANT' }))).toBe(false)
  })

  it('super_admin → gérant', () => {
    expect(isProGerant(makeUser({ role: 'super_admin' }))).toBe(true)
  })

  it('artisan → PAS gérant', () => {
    expect(isProGerant(makeUser({ role: 'artisan' }))).toBe(false)
  })
})
