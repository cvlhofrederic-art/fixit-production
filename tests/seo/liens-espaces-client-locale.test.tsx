// tests/seo/liens-espaces-client-locale.test.tsx
//
// Liens des espaces client qui envoyaient un client vers une URL d'une autre
// locale ou vers un chemin redirigé :
// - « Re-réserver » (tableau de bord client, ClientBookingsSection) visait
//   /recherche?artisan=<id>, redirigé sans condition vers /fr/recherche/ ;
//   le cookie de locale d'un client PT basculait en fr ;
// - « Trouver un artisan » (même section, aucune réservation à venir) confiait
//   le slug FR /recherche à LocaleLink : /pt/recherche/ côté PT, puis 308 ;
// - « Ver perfil » de /pt/mercados/gerir/ (GererMarcheClient, isPt) visait
//   /artisan/<id>, redirigé sans condition vers /fr/artisan/<id>/ ;
// - « Republier ce marché » (branche FR de GererMarcheClient) visait le chemin
//   racine /marches/publier?clone=…, 302 du middleware dont la locale vient du
//   cookie, du pays ou de la langue (un cookie pt menait côté PT).
// Chaque lien doit viser l'URL finale de la locale du client.

import React from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// next.config.ts déclare trailingSlash: true ; next/link lit cette variable
// (injectée au build) pour normaliser les href rendus comme en production.
vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('id=marche-1&token=jeton-1'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
}))

import ClientBookingsSection from '@/components/client-dashboard/pages/ClientBookingsSection'
import GererMarcheClient from '@/app/fr/marches/gerer/GererMarcheClient'
import { LanguageProvider } from '@/lib/i18n/context'

// ── Tableau de bord client : réservations ───────────────────────────────────

const reservationTerminee = {
  id: 'resa-1',
  booking_date: '2026-09-01',
  booking_time: '10:00',
  status: 'completed',
  address: '1 rua do Teste, Porto',
  notes: '',
  price_ttc: 0,
  duration_minutes: 60,
  artisan_id: 'artisan-42',
  services: { name: 'Canalização' },
  profiles_artisan: { company_name: 'Canalizador Teste', rating_avg: 4.8 },
}

// La locale arrive par la prop (textes) et par le contexte (préfixe ajouté
// par LocaleLink) : dans app/client/dashboard, les deux viennent de useLocale().
function rendreReservations(locale: 'fr' | 'pt', activeTab: 'upcoming' | 'past' = 'past') {
  const rien = () => undefined
  return render(
    <LanguageProvider initialLocale={locale}>
      <ClientBookingsSection
        activeTab={activeTab}
        upcomingBookings={[]}
        pastBookings={[reservationTerminee]}
        ratings={{}}
        favoris={[]}
        unreadCounts={{}}
        locale={locale}
        t={(cle: string) => cle}
        setActiveTab={rien}
        openMessages={rien}
        toggleFavori={rien}
        loadTracking={rien}
        setCancelConfirm={rien}
        setRatingModal={rien}
        setRatingVal={rien}
        setRatingComment={rien}
        getStatusBadge={() => null}
        formatPrice={(n: number) => `${n} €`}
        formatDateLocal={(d: string) => d}
        getPonctualiteScore={() => null}
      />
    </LanguageProvider>,
  )
}

describe('« Re-réserver » du tableau de bord client', () => {
  it.each([
    ['pt', '/pt/pesquisar/?artisan=artisan-42'],
    ['fr', '/fr/recherche/?artisan=artisan-42'],
  ] as const)('client %s : vise %s', (locale, attendu) => {
    rendreReservations(locale)
    const lien = screen.getByText('clientDash.bookings.rebook').closest('a')
    expect(lien?.getAttribute('href')).toBe(attendu)
  })
})

describe('« Trouver un artisan » du tableau de bord client (aucune réservation à venir)', () => {
  it.each([
    ['pt', '/pt/pesquisar/'],
    ['fr', '/fr/recherche/'],
  ] as const)('client %s : vise %s', (locale, attendu) => {
    rendreReservations(locale, 'upcoming')
    const lien = screen.getByText('clientDash.bookings.findArtisan').closest('a')
    expect(lien?.getAttribute('href')).toBe(attendu)
  })
})

// ── Gestion d'appel d'offres (GererMarcheClient) ────────────────────────────

const marche = {
  id: 'marche-1',
  title: 'Remodelação de casa de banho',
  description: 'Substituir banheira por base de duche',
  category: 'canalizacao',
  publisher_name: 'Cliente Teste',
  publisher_email: 'cliente@example.com',
  publisher_phone: null,
  publisher_type: 'particulier',
  location_city: 'Porto',
  location_postal: '4000-001',
  budget_min: 1000,
  budget_max: 2500,
  deadline: '2026-12-31',
  urgency: 'normal',
  status: 'open',
  candidatures_count: 1,
  max_candidatures: 5,
  require_rc_pro: false,
  require_decennale: false,
  require_rge: false,
  require_qualibat: false,
  preferred_work_mode: null,
  created_at: '2026-09-01T10:00:00Z',
}

const candidature = {
  id: 'cand-1',
  marche_id: 'marche-1',
  artisan_id: 'artisan-uuid-7',
  artisan_name: 'Profissional Teste',
  artisan_city: 'Porto',
  price: 1800,
  timeline: '2 semanas',
  description: 'Proposta completa',
  materials_included: true,
  guarantee: null,
  status: 'pending',
  created_at: '2026-09-02T10:00:00Z',
}

function simulerApiMarche(statut: string) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const corps = url.startsWith('/api/marches/marche-1?')
      ? { is_publisher: true, marche: { ...marche, status: statut }, candidatures: [candidature] }
      : { messages: [] }
    return { ok: true, json: async () => corps } as Response
  }))
}

describe('« Ver perfil » de la gestion d\'appel d\'offres', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    [true, 'Ver perfil', '/pt/profissional/artisan-uuid-7/'],
    [false, 'Voir le profil', '/fr/artisan/artisan-uuid-7/'],
  ] as const)('isPt=%s : « %s » vise %s', async (isPt, libelle, attendu) => {
    simulerApiMarche('open')
    render(<GererMarcheClient isPt={isPt} />)
    const lien = (await screen.findByText(new RegExp(libelle))).closest('a')
    expect(lien?.getAttribute('href')).toBe(attendu)
  })
})

describe('« Republier ce marché » (marché attribué)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    [true, 'Republicar este mercado', '/pt/mercados/publicar/?clone=marche-1&token=jeton-1'],
    [false, 'Republier ce marché', '/fr/marches/publier/?clone=marche-1&token=jeton-1'],
  ] as const)('isPt=%s : « %s » vise %s', async (isPt, libelle, attendu) => {
    simulerApiMarche('awarded')
    render(<GererMarcheClient isPt={isPt} />)
    const lien = (await screen.findByText(libelle)).closest('a')
    expect(lien?.getAttribute('href')).toBe(attendu)
  })
})

describe('autres liens « Trouver un artisan » du tableau de bord client', () => {
  // Même motif que dans ClientBookingsSection : le slug FR /recherche confié à LocaleLink donne /pt/recherche/ côté PT,
  // puis un 308. Ces composants reçoivent la locale en props : le slug suit la locale (garde statique, rendu trop lourd).
  it.each([
    'components/client-dashboard/pages/ClientDashboardOverview.tsx',
    'components/client-dashboard/pages/ClientLogementSection.tsx',
  ])('%s ne confie pas le slug FR seul à LocaleLink', (fichier) => {
    const source = readFileSync(join(process.cwd(), fichier), 'utf8')
    expect(source).not.toMatch(/href(=|:\s*)["'`]\/recherche/)
    expect(source).toContain("locale === 'pt' ? '/pesquisar' : '/recherche'")
  })
})
