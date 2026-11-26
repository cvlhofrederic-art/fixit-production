// tests/components/mes-donnees-rgpd-suppression.test.tsx
//
// Page « mes données » (components/legal/MesDonneesRgpd.tsx) reliée à DELETE /api/user/delete-account — lot RGPD du BTP
// pro (audit du 11/11/2026, constat stockage-local-miroir-12 : le bouton « Supprimer mon compte » échouait toujours,
// la requête partait sans la confirmation que la route exige). La requête de la page est rejouée telle quelle dans la
// route (base simulée) :
// - compte BTP (pro_societe) : la confirmation part dans le corps, la route l'accepte et applique ses contrôles (ici,
//   refus d'un compte qui détient une facture, message affiché, rien d'effacé) ;
// - autres rôles, et administrateur en « vue en tant que » : requête inchangée (règle n° 1 artisan / BTP).
// Données fictives : @exemple.test.
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sessionSimulee = vi.hoisted(() => ({ id: '', role: 'pro_societe', roleOriginal: null as string | null }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            access_token: 'jeton',
            user: {
              id: sessionSimulee.id,
              email: 'societe@exemple.test',
              created_at: '2026-01-15T10:00:00Z',
              app_metadata: { role: sessionSimulee.role, ...(sessionSimulee.roleOriginal ? { _original_role: sessionSimulee.roleOriginal } : {}) },
              user_metadata: { full_name: 'Société Exemple' },
            },
          },
        },
      }),
      signOut: async () => ({}),
    },
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/vitfixsignal-invitation')).clientInvitationQr }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/vitfixsignal-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/vitfixsignal-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/vitfixsignal-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/vitfixsignal-routes')).mockEmail())
vi.mock('@/lib/logger', async () => {
  const { simulQr } = await import('../helpers/vitfixsignal-routes')
  return { logger: { ...simulQr.logger, withTenant: () => simulQr.logger } }
})

const { LanguageProvider } = await import('@/lib/i18n/context')
const { default: MesDonneesRgpd } = await import('@/components/legal/MesDonneesRgpd')
const { DELETE } = await import('@/app/api/user/delete-account/route')
const { baseQr } = await import('../helpers/vitfixsignal-base')
const { reinitialiserSimulQr, simulQr } = await import('../helpers/vitfixsignal-routes')
const { authQr, reinitialiserAuthQr } = await import('../helpers/vitfixsignal-invitation')
const { reinitialiserReplisQr } = await import('@/lib/vitfixsignal/serveur')

const MESSAGE_DOCUMENTS = 'Votre compte détient des documents comptables (devis ou factures) que la loi impose de conserver : contactez le support pour supprimer votre compte.'
const SOCIETE = '0d000000-0000-4000-8000-000000000001'
const FICHE = '0d000000-0000-4000-8000-0000000000f1'

/** Requêtes parties de la page, rejouées dans la route ; la réponse de la route revient à la page. */
const requetes: Array<{ url: string; init: RequestInit }> = []

function connecter(role: string, roleOriginal: string | null = null): void {
  sessionSimulee.id = SOCIETE
  sessionSimulee.role = role
  sessionSimulee.roleOriginal = roleOriginal
  simulQr.user = { id: SOCIETE, email: 'societe@exemple.test', app_metadata: { role, ...(roleOriginal ? { _original_role: roleOriginal } : {}) } }
  authQr.comptes = [{ id: SOCIETE, email: 'societe@exemple.test', app_metadata: { role }, user_metadata: {} }]
}

async function demanderLaSuppression(): Promise<void> {
  render(
    <LanguageProvider initialLocale="fr">
      <MesDonneesRgpd />
    </LanguageProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))
  fireEvent.change(screen.getByLabelText('Tapez SUPPRIMER pour confirmer'), { target: { value: 'SUPPRIMER' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))
}

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  reinitialiserAuthQr()
  baseQr.reinitialiser()
  requetes.length = 0
  baseQr.etat.tables.profiles_artisan = [{ id: FICHE, user_id: SOCIETE }]
  baseQr.etat.tables.factures = [{ id: 'f1', artisan_user_id: SOCIETE, artisan_id: FICHE, numero: 'FACT-2026-0001', status: 'sent' }]
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    requetes.push({ url, init })
    return DELETE(new NextRequest(`https://vitfix.io${url}`, { ...init, signal: init.signal ?? undefined }))
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MesDonneesRgpd — suppression du compte reliée à la route', () => {
  it('compte BTP : la confirmation part dans le corps, la route l’accepte et refuse ici un compte qui détient une facture', async () => {
    connecter('pro_societe')
    await demanderLaSuppression()
    expect(await screen.findByText(MESSAGE_DOCUMENTS)).toBeTruthy()
    expect(requetes).toHaveLength(1)
    const { url, init } = requetes[0]
    expect(url).toBe('/api/user/delete-account')
    expect(init.method).toBe('DELETE')
    expect(init.headers).toEqual({ Authorization: 'Bearer jeton', 'Content-Type': 'application/json' })
    expect(init.body).toBe(JSON.stringify({ confirmation: 'DELETE_MY_ACCOUNT' }))
    expect(baseQr.etat.ecritures).toEqual([])
    expect(authQr.appels.filter((a) => a.methode === 'deleteUser')).toEqual([])
    expect(baseQr.table('factures')).toHaveLength(1)
  })

  it.each([
    ['compte artisan', 'artisan', null],
    ['compte particulier', 'particulier', null],
    ['administrateur en « vue en tant que » société BTP', 'pro_societe', 'super_admin'],
  ])('%s : requête inchangée (sans corps), rien n’est supprimé', async (_cas, role, roleOriginal) => {
    connecter(role, roleOriginal)
    await demanderLaSuppression()
    expect(await screen.findByText('Données invalides')).toBeTruthy()
    expect(requetes).toHaveLength(1)
    expect(requetes[0].init).toEqual({ method: 'DELETE', headers: { Authorization: 'Bearer jeton' } })
    expect(baseQr.etat.ecritures).toEqual([])
    expect(authQr.appels.filter((a) => a.methode === 'deleteUser')).toEqual([])
  })
})
