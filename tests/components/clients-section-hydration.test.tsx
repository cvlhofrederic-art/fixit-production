// tests/components/clients-section-hydration.test.tsx
//
// Régression incident Sud travaux (BTP PRO) — 2026-05-25 :
//   La liste "base clients" et "factures" disparaissait à l'ouverture du
//   dashboard, puis revenait au refresh.
//
// Cause racine identifiée dans ClientsSection.tsx :
//   - manualClients utilisait un lazy initializer `useState(() => ...)` qui
//     lisait `localStorage[fixit_manual_clients_${artisan?.id}]` UNE SEULE FOIS
//     au premier render.
//   - Quand `artisan` était encore `null` à ce moment (hydratation), la clé
//     devenait `fixit_manual_clients_undefined` → liste vide.
//   - Le useEffect qui aurait pu re-lire au changement de `artisan?.id`
//     n'existait pas → état figé jusqu'à refresh manuel.
//
//   Fix : remplacer le lazy initializer par `useState([])` + un useEffect
//   dépendant de `artisan?.id` qui re-lit localStorage à chaque changement.
//
// Ce test mocke toutes les dépendances lourdes (contexte i18n, Supabase,
// thème) pour isoler la logique de chargement manuel.

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ── Mocks des dépendances ────────────────────────────────────────────────
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'fr',
  }),
  useLocale: () => 'fr',
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}))

vi.mock('@/components/dashboard/useThemeVars', () => ({
  useThemeVars: () => ({
    bg: '#fff', surface: '#fff', surfaceAlt: '#f5f5f5',
    border: '#e5e5e5', text: '#000', textMuted: '#666',
    accent: '#000', accentText: '#fff',
  }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import ClientsSection from '@/components/dashboard/ClientsSection'
import type { Artisan } from '@/lib/types'

const SUDTRAVAUX_ARTISAN: Artisan = {
  id: 'art-sudtravaux-001',
  user_id: 'user-sudtravaux',
  company_name: 'SUD TRAVAUX',
  email: 'sudtravaux@test.fr',
  phone: '',
  bio: '',
} as unknown as Artisan

const MANUAL_CLIENT = {
  id: 'cli-1',
  name: 'Evo travaux',
  type: 'societe',
  siret: '92010210000012',
  mainAddress: '108 Avenue de Colmar, 68200 Mulhouse',
}

describe('ClientsSection — incident Sud travaux (lazy useState race)', () => {
  beforeEach(() => {
    localStorage.clear()
    mockFetch.mockReset()
    // Fetch d'auth-clients renvoie liste vide par défaut (Sud travaux n'a pas
    // de bookings, ses clients sont 100% manuels en localStorage)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ clients: [] }),
    })
  })

  it('charge les clients manuels même quand le prop `artisan` est null au mount, puis hydraté', async () => {
    // Setup : un client manuel déjà persisté en localStorage sous la clé du
    // VRAI artisan id (celui qui arrivera après hydratation)
    localStorage.setItem(
      `fixit_manual_clients_${SUDTRAVAUX_ARTISAN.id}`,
      JSON.stringify([MANUAL_CLIENT])
    )

    // 1er render : artisan = null (cas hydratation en cours)
    const { rerender } = render(
      <ClientsSection
        artisan={null}
        bookings={[]}
        services={[]}
        onNewRdv={() => {}}
        onNewDevis={() => {}}
        orgRole="pro_societe"
      />
    )

    // Évite l'erreur "act" en attendant un tick
    await waitFor(() => {
      // Le composant a monté, mais le client manuel ne peut pas encore
      // s'afficher tant que artisan?.id n'est pas connu (clé inconnue).
      expect(screen.queryByText('Evo travaux')).toBeNull()
    })

    // 2nd render : artisan hydraté avec son vrai id
    rerender(
      <ClientsSection
        artisan={SUDTRAVAUX_ARTISAN}
        bookings={[]}
        services={[]}
        onNewRdv={() => {}}
        onNewDevis={() => {}}
        orgRole="pro_societe"
      />
    )

    // Le useEffect dépendant de artisan?.id doit re-lire localStorage et
    // afficher le client manuel. AVANT le fix, ce test échouait : le lazy
    // useState ne se ré-évaluait jamais.
    await waitFor(() => {
      expect(screen.getByText('Evo travaux')).toBeInTheDocument()
    })
  })

  it("conserve les clients manuels lus depuis localStorage quand le fetch auth échoue", async () => {
    localStorage.setItem(
      `fixit_manual_clients_${SUDTRAVAUX_ARTISAN.id}`,
      JSON.stringify([MANUAL_CLIENT])
    )

    // Le fetch auth-clients échoue (token expiré / réseau)
    mockFetch.mockRejectedValue(new Error('401 Unauthorized'))

    render(
      <ClientsSection
        artisan={SUDTRAVAUX_ARTISAN}
        bookings={[]}
        services={[]}
        onNewRdv={() => {}}
        onNewDevis={() => {}}
        orgRole="pro_societe"
      />
    )

    // Le client manuel doit s'afficher même si le fetch auth a planté.
    // AVANT le fix : `setAuthClients([])` dans le .catch écrasait potentiellement
    // l'état affiché si une fusion avait eu lieu. Le test garantit que le
    // localStorage reste la source de vérité robuste pour les clients manuels.
    await waitFor(() => {
      expect(screen.getByText('Evo travaux')).toBeInTheDocument()
    })
  })
})
