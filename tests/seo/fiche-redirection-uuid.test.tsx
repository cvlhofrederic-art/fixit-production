/**
 * Page client partagée des fiches (app/fr/artisan/[id]/page.tsx) : un accès par UUID est redirigé vers l'adresse
 * publique de la fiche dans la langue de la route (getProfilePath). Sous la locale fr : /fr/artisan/<slug>, quelle que
 * soit la fiche (société ou fiche pt comprises ; /fr/societe/ n'a pas les métadonnées d'une fiche), l'adresse du
 * sitemap 4 pour une fiche FR. Sous la locale pt : /pt/empresa/<slug> ou /pt/profissional/<slug> ; aucune fiche PT
 * n'est dans un sitemap. Un accès par slug, ou une fiche sans slug, n'est jamais redirigé : pas de boucle entre deux
 * routes de fiche.
 *
 * La page est montée avec un client Supabase simulé qui renvoie la fiche ; les appels réseau qui suivent la lecture
 * (disponibilités, réservations) restent en attente : la page ne dépasse pas le chargement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import ArtisanProfilePage from '@/app/fr/artisan/[id]/page'

const UUID = '4f0b7c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b'

const etat = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  locale: 'fr',
  fiche: null as Record<string, unknown> | null,
  tables: [] as string[],
}))
const remplacer = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useParams: () => etat.params,
  useRouter: () => ({ push: vi.fn(), replace: remplacer, back: vi.fn() }),
}))

vi.mock('@/lib/i18n/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/i18n/context')>()),
  useLocale: () => etat.locale,
}))

vi.mock('@/lib/supabase', () => {
  const chaine = {
    select: () => chaine,
    eq: () => chaine,
    single: async () => ({ data: etat.fiche, error: null }),
  }
  return {
    supabase: {
      from: (table: string) => {
        etat.tables.push(table)
        return chaine
      },
      auth: { getSession: async () => ({ data: { session: null } }) },
    },
  }
})

beforeEach(() => {
  remplacer.mockClear()
  etat.tables = []
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fiche ouverte par UUID : redirection vers l’adresse publique (getProfilePath)', () => {
  it.each([
    ['FR, société', '/fr/artisan/batiment-sud-aix-en-provence', 'fr', 'SARL'],
    ['FR, artisan individuel', '/fr/artisan/batiment-sud-aix-en-provence', 'fr', 'Entrepreneur individuel'],
    ['PT, société', '/pt/empresa/batiment-sud-aix-en-provence', 'pt', 'Lda'],
    ['PT, individuel', '/pt/profissional/batiment-sud-aix-en-provence', 'pt', 'ENI'],
  ])('%s → %s', async (_cas, cible, locale, legalForm) => {
    etat.params = { id: UUID }
    etat.locale = locale
    etat.fiche = { id: UUID, slug: 'batiment-sud-aix-en-provence', legal_form: legalForm }
    render(<ArtisanProfilePage />)
    await waitFor(() => expect(remplacer).toHaveBeenCalledWith(cible))
    expect(remplacer).toHaveBeenCalledTimes(1)
  })

  it('fiche pt sous la locale fr : la redirection suit la langue de la route, /fr/artisan/<slug>', async () => {
    etat.params = { id: UUID }
    etat.locale = 'fr'
    etat.fiche = { id: UUID, slug: 'construcoes-ribeiro', language: 'pt', legal_form: 'Lda' }
    render(<ArtisanProfilePage />)
    await waitFor(() => expect(remplacer).toHaveBeenCalledWith('/fr/artisan/construcoes-ribeiro'))
    expect(remplacer).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['accès par slug', { id: 'batiment-sud-aix-en-provence' }, 'batiment-sud-aix-en-provence'],
    ['fiche sans slug', { id: UUID }, null],
  ])('%s : aucune redirection', async (_cas, params, slug) => {
    etat.params = params
    etat.locale = 'fr'
    etat.fiche = { id: UUID, slug, legal_form: 'SARL' }
    render(<ArtisanProfilePage />)
    // La page passe à la lecture des prestations : la fiche est lue et la redirection a été écartée.
    await waitFor(() => expect(etat.tables).toContain('services'))
    expect(remplacer).not.toHaveBeenCalled()
  })
})
