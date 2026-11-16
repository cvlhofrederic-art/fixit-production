/**
 * Pages publiques qui lisent profiles_artisan avec la clé publique du site : fiche (app/fr/artisan/[id]/page.tsx,
 * partagée par /fr/artisan, /fr/societe, /pt/profissional et /pt/empresa), recherche, réservation, confirmation.
 * Chacune ne lit plus que les colonnes qu'elle affiche (lib/fiche-publique.ts), jamais `select('*')`, et ces
 * colonnes existent toutes en production (une colonne absente ferait échouer la lecture). Les lectures serveur avec
 * la même clé (métadonnées, JSON-LD, sitemap) restent dans la liste que la migration 20261115 laisse au rôle anon.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ArtisanProfilePage from '@/app/fr/artisan/[id]/page'
import {
  COLONNES_CONFIRMATION_PUBLIQUE,
  COLONNES_FICHE_PUBLIQUE,
  COLONNES_LECTURE_ANONYME,
  COLONNES_RECHERCHE_PUBLIQUE,
  COLONNES_RESERVATION_PUBLIQUE,
  SELECT_FICHE_PUBLIQUE,
} from '@/lib/fiche-publique'
import { COLONNES_PROFILES_ARTISAN_PRIVEES, COLONNES_PROFILES_ARTISAN_PRODUCTION } from '../helpers/colonnes-profiles-artisan'

const etat = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  fiche: null as Record<string, unknown> | null,
  selections: [] as Array<{ table: string; colonnes: string }>,
}))

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useParams: () => etat.params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

vi.mock('@/lib/i18n/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/i18n/context')>()),
  useLocale: () => 'fr',
}))

// Client simulé qui, comme PostgREST, ne renvoie que les colonnes demandées (toutes pour « * »).
vi.mock('@/lib/supabase', () => {
  const garder = (ligne: Record<string, unknown>, colonnes: string) => colonnes.trim() === '*'
    ? ligne
    : Object.fromEntries(colonnes.split(',').map((c) => c.trim()).map((c) => [c, ligne[c] ?? null]))
  return {
    supabase: {
      from: (table: string) => {
        const requete = { table, colonnes: '' }
        etat.selections.push(requete)
        const chaine = {
          select: (colonnes: string) => {
            requete.colonnes = colonnes
            return chaine
          },
          eq: () => chaine,
          single: async () => (table === 'profiles_artisan' && etat.fiche
            ? { data: garder(etat.fiche, requete.colonnes), error: null }
            : { data: null, error: { code: 'PGRST116' } }),
          then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(ok, ko),
        }
        return chaine
      },
      auth: { getSession: async () => ({ data: { session: null } }) },
    },
  }
})

const FICHE = {
  id: '4f0b7c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b',
  slug: 'batiment-sud-exemple',
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  company_name: 'BATIMENT SUD EXEMPLE',
  bio: 'Maçonnerie générale',
  categories: ['maconnerie'],
  legal_form: 'SAS',
  siret: '12345678900012',
  naf_code: '4120A',
  naf_label: 'Construction de maisons individuelles',
  company_address: '1 rue du Port',
  company_city: 'Marseille',
  company_postal_code: '13002',
  phone: '04 00 00 00 00',
  email: 'contact@batiment-sud.test',
  profile_photo_url: null,
  rating_avg: 4.5,
  rating_count: 3,
  verified: true,
  active: true,
  zone_radius_km: 30,
  intervention_zones: null,
  // Colonnes privées : la page ne doit pas les recevoir.
  kbis_url: '550e8400-e29b-41d4-a716-446655440000/kbis/exemple.pdf',
  id_document_verso_url: '550e8400-e29b-41d4-a716-446655440000/identity-verso/exemple.png',
  paiement_modes: [{ type: 'virement', iban: 'IBAN-EXEMPLE' }],
  kyc_status: 'approved',
  kyc_score: 80,
}

const colonnesDe = (selection: string) => selection.split(',').map((c) => c.trim()).filter(Boolean)
const lireSource = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

/** Arguments des `.select(...)` qui suivent un `.from('profiles_artisan')` dans un fichier source. */
function selectionsProfiles(source: string): string[] {
  return [...source.matchAll(/\.from\(\s*['"]profiles_artisan['"]\s*\)\s*\.select\(([^)]*)\)/g)].map((m) => m[1].trim())
}

beforeEach(() => {
  etat.selections = []
  etat.fiche = null
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }))))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listes de colonnes des pages publiques (lib/fiche-publique.ts)', () => {
  it.each([
    ['fiche', COLONNES_FICHE_PUBLIQUE],
    ['recherche', COLONNES_RECHERCHE_PUBLIQUE],
    ['réservation', COLONNES_RESERVATION_PUBLIQUE],
    ['confirmation', COLONNES_CONFIRMATION_PUBLIQUE],
    ['lecture anonyme (migration)', COLONNES_LECTURE_ANONYME],
  ] as Array<[string, readonly string[]]>)('%s : colonnes présentes en production, aucune colonne privée', (_page, liste) => {
    expect(liste.filter((c) => !COLONNES_PROFILES_ARTISAN_PRODUCTION.includes(c))).toEqual([])
    expect(liste.filter((c) => COLONNES_PROFILES_ARTISAN_PRIVEES.includes(c))).toEqual([])
  })
})

describe('fiche publique : seules les colonnes affichées sont demandées', () => {
  it('ne demande jamais la fiche entière', async () => {
    etat.params = { id: 'batiment-sud-exemple' }
    render(<ArtisanProfilePage />)
    expect(await screen.findByText('Artisan non trouvé')).toBeInTheDocument()

    const lecture = etat.selections.find((s) => s.table === 'profiles_artisan')
    expect(lecture?.colonnes).not.toBe('*')
    expect(colonnesDe(lecture?.colonnes ?? '').filter((c) => COLONNES_PROFILES_ARTISAN_PRIVEES.includes(c))).toEqual([])
    expect(lecture?.colonnes).toBe(SELECT_FICHE_PUBLIQUE)
  })

  it('affiche toujours la carte de visite (SIRET, NAF, adresse, téléphone, e-mail) avec ces seules colonnes', async () => {
    etat.params = { id: 'batiment-sud-exemple' }
    etat.fiche = FICHE
    render(<ArtisanProfilePage />)

    expect(await screen.findByText('12345678900012')).toBeInTheDocument()
    expect(screen.getByText('4120A, Construction de maisons individuelles')).toBeInTheDocument()
    expect(screen.getByText('1 rue du Port')).toBeInTheDocument()
    expect(screen.getByText('13002 Marseille')).toBeInTheDocument()
    expect(screen.getByText('04 00 00 00 00')).toBeInTheDocument()
    expect(screen.getByText('contact@batiment-sud.test')).toBeInTheDocument()
    expect(screen.getByText('SAS')).toBeInTheDocument()
    // Après la fiche, la page passe aux prestations : la lecture de profiles_artisan reste la liste publique.
    await waitFor(() => expect(etat.selections.some((s) => s.table === 'services')).toBe(true))
    expect(etat.selections.filter((s) => s.table === 'profiles_artisan').map((s) => s.colonnes)).toEqual([SELECT_FICHE_PUBLIQUE])
  })
})

describe('recherche, réservation, confirmation : aucune lecture de la fiche entière', () => {
  it.each([
    ['app/fr/recherche/page.tsx', 'SELECT_RECHERCHE_PUBLIQUE'],
    ['app/fr/reserver/page.tsx', 'SELECT_RESERVATION_PUBLIQUE'],
    ['app/(commun)/confirmation/page.tsx', 'SELECT_CONFIRMATION_PUBLIQUE'],
    ['app/fr/artisan/[id]/page.tsx', 'SELECT_FICHE_PUBLIQUE'],
  ])('%s lit profiles_artisan avec %s', (chemin, constante) => {
    const selections = selectionsProfiles(lireSource(chemin))
    expect(selections.length).toBeGreaterThan(0)
    expect(selections.every((s) => s === constante)).toBe(true)
  })
})

describe('lectures serveur avec la clé publique : couvertes par la liste du rôle anon', () => {
  it('métadonnées, JSON-LD et existence des fiches (layout, lib/seo/fiche-artisan.ts)', () => {
    const champs = ['app/fr/artisan/[id]/layout.tsx', 'lib/seo/fiche-artisan.ts']
      .flatMap((chemin) => [...lireSource(chemin).matchAll(/fetchArtisanProfile<\w+>\(\s*id,\s*'([^']+)'/g)])
      .flatMap((m) => m[1].split(','))
    expect(champs.length).toBeGreaterThan(10)
    expect(champs.filter((c) => !COLONNES_LECTURE_ANONYME.includes(c))).toEqual([])
  })

  it('sitemap des fiches : colonnes lues et filtrées', () => {
    const source = lireSource('lib/sitemap-fiches-artisans.ts')
    const lues = selectionsProfiles(source).flatMap((s) => colonnesDe(s.replace(/['"]/g, '')))
    const filtrees = [...source.matchAll(/\.eq\(\s*'(\w+)'/g)].map((m) => m[1])
    expect(lues).toEqual(['id', 'slug', 'language'])
    expect([...lues, ...filtrees].filter((c) => !COLONNES_LECTURE_ANONYME.includes(c))).toEqual([])
  })
})
