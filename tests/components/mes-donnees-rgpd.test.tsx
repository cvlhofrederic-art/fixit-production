// tests/components/mes-donnees-rgpd.test.tsx
//
// Page « mes données » commune (components/legal/MesDonneesRgpd.tsx) à /fr/confidentialite/mes-donnees/,
// /pt/privacidade/meus-dados/ (variante fr) et /en/privacy/my-data/ (variante en). La variante EN garde les textes, le rôle
// et le mot de confirmation anglais de l'ancienne page EN, dont les huit clés rgpd.* ajoutées à locales/en.json ; la
// variante FR garde les siens.
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/lib/i18n/context'
import MesDonneesRgpd from '@/components/legal/MesDonneesRgpd'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            access_token: 'jeton',
            user: {
              id: 'u1',
              email: 'ana@exemple.pt',
              created_at: '2026-01-15T10:00:00Z',
              app_metadata: { role: 'particulier' },
              user_metadata: { full_name: 'Ana' },
            },
          },
        },
      }),
      signOut: async () => ({}),
    },
  },
}))

afterEach(() => {
  cleanup()
})

describe('MesDonneesRgpd', () => {
  it('variante EN : textes anglais (clés ajoutées à locales/en.json), rôle et mot de confirmation DELETE', async () => {
    render(
      <LanguageProvider initialLocale="en">
        <MesDonneesRgpd variante="en" />
      </LanguageProvider>,
    )
    expect(await screen.findByText('Stored data')).toBeTruthy()
    expect(screen.getByText('Account type')).toBeTruthy()
    expect(screen.getByText('Individual')).toBeTruthy()
    expect(screen.getByText('For any questions about your data, contact our DPO:')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    expect(screen.getByText('Type DELETE to confirm permanent deletion:')).toBeTruthy()
    expect(screen.getByPlaceholderText('DELETE')).toBeTruthy()
    expect(screen.getByLabelText('Type DELETE to confirm')).toBeTruthy()
  })

  it('variante FR (pages FR et PT) : textes, rôle et mot de confirmation SUPPRIMER', async () => {
    render(
      <LanguageProvider initialLocale="fr">
        <MesDonneesRgpd />
      </LanguageProvider>,
    )
    expect(await screen.findByText('Données stockées')).toBeTruthy()
    expect(screen.getByText('Particulier')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }))
    expect(screen.getByText('Tapez SUPPRIMER pour confirmer la suppression définitive :')).toBeTruthy()
    expect(screen.getByPlaceholderText('SUPPRIMER')).toBeTruthy()
    expect(screen.getByLabelText('Tapez SUPPRIMER pour confirmer')).toBeTruthy()
  })
})
