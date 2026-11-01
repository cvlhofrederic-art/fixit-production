/**
 * Page client partagée des fiches (app/fr/artisan/[id]/page.tsx) : /fr/societe/[slug] et /pt/empresa/[slug] nomment leur
 * segment « slug », /fr/artisan/[id] et /pt/profissional/[id] « id ». La page ne lisait que params.id : sur une fiche
 * de société, elle cherchait slug=eq.undefined et affichait « Artisan non trouvé » même pour une société existante.
 *
 * La page est montée avec un client Supabase simulé qui ne trouve aucune fiche : le test lit la requête envoyée.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ArtisanProfilePage from '@/app/fr/artisan/[id]/page'

const etat = vi.hoisted(() => ({ params: {} as Record<string, string> }))
const requete = vi.hoisted(() => ({ eq: vi.fn() }))

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useParams: () => etat.params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

vi.mock('@/lib/i18n/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/i18n/context')>()),
  useLocale: () => 'fr',
}))

vi.mock('@/lib/supabase', () => {
  const chaine = {
    select: () => chaine,
    eq: (colonne: string, valeur: unknown) => {
      requete.eq(colonne, valeur)
      return chaine
    },
    single: async () => ({ data: null, error: { code: 'PGRST116' } }),
  }
  return { supabase: { from: () => chaine, auth: { getSession: async () => ({ data: { session: null } }) } } }
})

beforeEach(() => {
  requete.eq.mockClear()
})

describe('fiche partagée : identifiant lu dans le segment de la route', () => {
  it.each([
    ['/fr/societe/[slug]', { slug: 'plomberie-durand-sarl' }, ['slug', 'plomberie-durand-sarl']],
    ['/pt/empresa/[slug]', { slug: 'canalizacoes-silva-lda' }, ['slug', 'canalizacoes-silva-lda']],
    ['/fr/artisan/[id], slug', { id: 'plomberie-durand' }, ['slug', 'plomberie-durand']],
    ['/fr/artisan/[id], UUID', { id: '4f0b7c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b' }, ['id', '4f0b7c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b']],
  ] as Array<[string, Record<string, string>, [string, string]]>)('%s', async (_route, params, [colonne, valeur]) => {
    etat.params = params
    render(<ArtisanProfilePage />)
    expect(await screen.findByText('Artisan non trouvé')).toBeInTheDocument()
    expect(requete.eq).toHaveBeenCalledTimes(1)
    expect(requete.eq).toHaveBeenCalledWith(colonne, valeur)
  })
})
