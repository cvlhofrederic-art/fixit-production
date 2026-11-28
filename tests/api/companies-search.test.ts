// tests/api/companies-search.test.ts
//
// GET /api/companies/search — recherche publique par métier :
//   - specialty obligatoire (400), slug inconnu (404), métier sans profil (200, liste vide) ;
//   - select explicite de colonnes qui existent toutes en production : l'ancien select nommait first_name et
//     last_name, absentes de la prod (500 « Search failed » avant le correctif) ;
//   - seuls les champs publics sortent (réponse publique et mise en cache) : ni e-mail, ni téléphone, ni identité
//     du gérant, ni statut KYC (décision de Frédéric du 28/11/2026) ;
//   - KYC approuvé et fiche active seulement, verified_source lu dans profile_specialties, filtres
//     verified_source et city, limite entre 1 et 50 (20 par défaut).
// Supabase en mémoire ; colonnes de production : tests/helpers/colonnes-profiles-artisan.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'
import {
  COLONNES_PROFILES_ARTISAN_PRIVEES,
  COLONNES_PROFILES_ARTISAN_PRODUCTION,
} from '../helpers/colonnes-profiles-artisan'

const h = vi.hoisted(() => ({ base: null as unknown as BaseMemoire }))

vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => clientMemoire(h.base).from(t) } }))

const { GET } = await import('@/app/api/companies/search/route')

const chercher = (query: string) => GET(new NextRequest(`https://vitfix.io/api/companies/search${query}`))

const COLONNES_LUES = ['id', 'user_id', 'company_name', 'company_city', 'naf_code', 'naf_label', 'verified', 'categories']
const CHAMPS_REPONSE = [...COLONNES_LUES, 'verified_source', 'profile_type']
const parOrdre = (a: string, b: string) => a.localeCompare(b)

// Ligne complète de la table : des colonnes qui ne doivent pas sortir de la réponse publique.
const profil = (id: string, extra: Record<string, unknown> = {}) => ({
  id: `art-${id}`, user_id: `user-${id}`, company_name: `Entreprise ${id}`, email: `${id}@exemple.fr`,
  phone: '0600000000', company_city: 'Marseille', naf_code: '4322A', naf_label: 'Travaux de plomberie',
  verified: true, kyc_status: 'approved', active: true, categories: ['plomberie'], siret: '12345678900011',
  bio: 'Bio interne', kyc_market: 'fr_artisan', company_address: '1 rue du Port', ...extra,
})

beforeEach(() => {
  h.base = nouvelleBase()
  // Absentes en production (relevé du 31/10/2026) : les nommer dans un select fait échouer la requête.
  h.base.colonnesAbsentes = { profiles_artisan: ['first_name', 'last_name'] }
  h.base.lignes.specialties = [
    { id: 'spec-plomberie', slug: 'plomberie', label_fr: 'Plomberie' },
    { id: 'spec-piscine', slug: 'piscine', label_fr: 'Piscine' },
  ]
  h.base.lignes.profile_specialties = [
    { specialty_id: 'spec-plomberie', user_id: 'user-1', verified_source: 'kbis' },
    { specialty_id: 'spec-plomberie', user_id: 'user-2', verified_source: 'self_declared' },
    { specialty_id: 'spec-plomberie', user_id: 'user-3', verified_source: 'kbis' },
    { specialty_id: 'spec-plomberie', user_id: 'user-4', verified_source: 'kbis' },
  ]
  h.base.lignes.profiles_artisan = [
    profil('1'),
    profil('2', { company_city: 'Aix-en-Provence', verified: false }),
    profil('3', { kyc_status: 'pending' }),
    profil('4', { active: false }),
  ]
})

describe('GET /api/companies/search', () => {
  it('400 sans paramètre specialty', async () => {
    const res = await chercher('')
    expect(res.status).toBe(400)
  })

  it('404 pour un métier inconnu', async () => {
    const res = await chercher('?specialty=inconnu')
    expect(res.status).toBe(404)
  })

  it('200 et liste vide pour un métier sans profil', async () => {
    const res = await chercher('?specialty=piscine')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ results: [], specialty: 'Piscine', total: 0 })
    expect(appelsDe(h.base, 'profiles_artisan')).toHaveLength(0)
  })

  it('schéma de prod sans first_name / last_name : 200, profils lus par un select explicite', async () => {
    const res = await chercher('?specialty=plomberie')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('public')
    const json = await res.json()
    expect(json.specialty).toBe('Plomberie')
    expect(json.total).toBe(2)
    expect(json.results.map((r: { id: string }) => r.id)).toEqual(['art-1', 'art-2'])
    const colonnes = (appelsDe(h.base, 'profiles_artisan', 'select')[0].colonnes ?? '').split(',').map((c) => c.trim())
    expect([...colonnes].sort(parOrdre)).toEqual([...COLONNES_LUES].sort(parOrdre))
  })

  it('ne lit et ne filtre que des colonnes qui existent en production, aucune colonne privée lue', async () => {
    await chercher('?specialty=plomberie&city=marseille')
    const appel = appelsDe(h.base, 'profiles_artisan', 'select')[0]
    const lues = (appel.colonnes ?? '').split(',').map((c) => c.trim())
    const filtrees = [...appel.eq, ...appel.in, ...appel.ilike].map(([c]) => c)
    for (const c of [...lues, ...filtrees]) expect(COLONNES_PROFILES_ARTISAN_PRODUCTION).toContain(c)
    for (const c of lues) expect(COLONNES_PROFILES_ARTISAN_PRIVEES).not.toContain(c)
  })

  it('ne renvoie que les champs publics', async () => {
    const json = await (await chercher('?specialty=plomberie')).json()
    const premier = json.results[0]
    expect(Object.keys(premier).sort(parOrdre)).toEqual([...CHAMPS_REPONSE].sort(parOrdre))
    expect(premier).toMatchObject({
      id: 'art-1', company_name: 'Entreprise 1', naf_code: '4322A', naf_label: 'Travaux de plomberie',
      verified_source: 'kbis', profile_type: 'artisan',
    })
    for (const prive of ['siret', 'bio', 'company_address', 'kyc_status', 'kyc_market', 'first_name', 'last_name']) {
      expect(premier).not.toHaveProperty(prive)
    }
  })

  // email (celui de la connexion, saisi à l'inscription) et phone étaient dans le select depuis la création de
  // la route (13dd04a2, 01/04/2026) ; la prod répondait 500 et ne les servait donc pas. Décision de Frédéric
  // du 28/11/2026 : la réponse publique, sans authentification, ne les expose pas.
  it("ne renvoie ni l'e-mail ni le téléphone des profils", async () => {
    const res = await chercher('?specialty=plomberie')
    const corps = await res.text()
    const json = JSON.parse(corps)
    expect(json.results).toHaveLength(2)
    for (const r of json.results) {
      expect(r).not.toHaveProperty('email')
      expect(r).not.toHaveProperty('phone')
    }
    expect(corps).not.toContain('@exemple.fr')
    expect(corps).not.toContain('0600000000')
  })

  it('exclut les fiches inactives, même au KYC approuvé', async () => {
    const json = await (await chercher('?specialty=plomberie')).json()
    expect(json.results.map((r: { id: string }) => r.id)).not.toContain('art-4')
    expect(appelsDe(h.base, 'profiles_artisan', 'select')[0].eq).toContainEqual(['active', true])
  })

  it.each([
    ['', 20], ['&limit=7', 7], ['&limit=500', 50], ['&limit=abc', 20], ['&limit=-5', 20], ['&limit=0', 20],
  ])('limite %s → %i, sans erreur', async (parametre, attendue) => {
    const res = await chercher(`?specialty=plomberie${parametre}`)
    expect(res.status).toBe(200)
    expect(appelsDe(h.base, 'profiles_artisan', 'select')[0].limite).toBe(attendue)
  })

  it('filtre par verified_source et par ville', async () => {
    const parSource = await (await chercher('?specialty=plomberie&verified_source=self_declared')).json()
    expect(parSource.results.map((r: { id: string }) => r.id)).toEqual(['art-2'])
    const parVille = await (await chercher('?specialty=plomberie&city=aix')).json()
    expect(parVille.results.map((r: { id: string }) => r.id)).toEqual(['art-2'])
  })

  it('500 « Search failed » si la lecture des profils échoue', async () => {
    h.base.erreurs['profiles_artisan.select'] = { message: 'boom' }
    const res = await chercher('?specialty=plomberie')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Search failed' })
  })
})
