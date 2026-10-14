// tests/recherche/vitfix-destaque.test.tsx
//
// Fiche VITFIX épinglée sur /pt/pesquisar/ (demande du propriétaire du 14/10/2026) : toujours
// première, pour tout métier et toute localité, numéro visible à la place de « Agendar visita »,
// badge « Profissional certificado ». Partie PT seulement.

import React from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ArtisanCard, type Artisan } from '@/components/recherche/ArtisanCard'
import { cartaoVitfix, comVitfixPrimeiro, semFichaVitfix, VITFIX_DESTAQUE_ID } from '@/lib/recherche/vitfix-destaque'
import { PHONE_PT } from '@/lib/constants'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

const artisan = (id: string, company_name: string, source: Artisan['source'] = 'registered'): Artisan => ({
  id,
  company_name,
  bio: null,
  categories: ['plomberie'],
  hourly_rate: null,
  rating_avg: 0,
  rating_count: 0,
  verified: false,
  active: true,
  zone_radius_km: 20,
  source,
})

describe('lib/recherche/vitfix-destaque', () => {
  it('la fiche VITFIX est toujours première, les autres gardent leur ordre', () => {
    const lista = comVitfixPrimeiro([artisan('a', 'Alpha'), artisan('b', 'Beta', 'catalogue')], 'plomberie')
    expect(lista.map((a) => a.id)).toEqual([VITFIX_DESTAQUE_ID, 'a', 'b'])
    expect(lista[0].source).toBe('vitfix')
    expect(lista[0].verified).toBe(true)
    expect(lista[0].company_name).toBe('VITFIX')
    expect(lista[0].telephone_pro).toBe('+351 912 014 971')
    expect(lista[0].city).toBe('Marco de Canaveses')
  })

  it('même sans résultat, la fiche VITFIX est affichée', () => {
    expect(comVitfixPrimeiro([]).map((a) => a.id)).toEqual([VITFIX_DESTAQUE_ID])
  })

  it('le métier recherché est repris quand il est un des métiers PT de VITFIX, sinon aucune ligne de métier', () => {
    expect(cartaoVitfix('electricite').categories).toEqual(['electricite'])
    expect(cartaoVitfix('plomberie').categories).toEqual(['plomberie'])
    // Catégories de recherche sans métier PT publié par VITFIX : la fiche ne revendique pas le service.
    for (const hors of ['demenagement', 'traitement-nuisibles', 'chauffage', 'piscine', 'ramonage', 'diagnostic', 'nettoyage-industriel', 'amenagement-exterieur', 'nettoyage-travaux']) {
      expect(cartaoVitfix(hors).categories, hors).toEqual([])
    }
    expect(cartaoVitfix(null).categories).toEqual([])
    expect(cartaoVitfix().categories).toEqual([])
  })

  it('les catégories reconnues existent toutes dans lib/categories.ts', async () => {
    const { CATEGORIES } = await import('@/lib/categories')
    const slugs = new Set(CATEGORIES.map((c) => c.slug))
    const { CATEGORIAS_VITFIX_PT } = await import('@/lib/recherche/vitfix-destaque')
    for (const slug of CATEGORIAS_VITFIX_PT) expect(slugs.has(slug), slug).toBe(true)
  })

  it('une fiche VITFIX venue de la base n’est pas doublée', () => {
    const lista = [artisan('x', 'Vitfix Construções, Lda'), artisan('y', 'VITFIX', 'catalogue'), artisan('z', 'Zeta')]
    expect(semFichaVitfix(lista).map((a) => a.id)).toEqual(['z'])
    expect(comVitfixPrimeiro(lista).map((a) => a.id)).toEqual([VITFIX_DESTAQUE_ID, 'z'])
  })
})

describe('ArtisanCard : fiche VITFIX (PT)', () => {
  it('affiche le badge certifié et le numéro cliquable, sans « Agendar visita » ni lien de profil', () => {
    const { getByText, queryByText, container } = render(
      <ArtisanCard artisan={cartaoVitfix('plomberie')} availability={[]} bookings={[]} locale="pt" />,
    )
    expect(getByText('VITFIX')).toBeTruthy()
    expect(getByText('Profissional certificado')).toBeTruthy()
    expect(getByText('Canalizador')).toBeTruthy()
    const tel = container.querySelector(`a[href="tel:${PHONE_PT}"]`)
    expect(tel).not.toBeNull()
    expect(tel?.textContent).toContain('+351 912 014 971')
    expect(queryByText('Agendar visita')).toBeNull()
    expect(queryByText('Telefone não disponível')).toBeNull()
    expect(container.querySelector('a[href^="/pt/profissional/"]')).toBeNull()
    expect(container.querySelector('a[href^="/pt/empresa/"]')).toBeNull()
  })

  it('un inscrit ordinaire garde « Agendar visita » (rendu inchangé)', () => {
    const { getByText, container } = render(
      <ArtisanCard artisan={artisan('a', 'Alpha')} availability={[]} bookings={[]} locale="pt" />,
    )
    expect(getByText('Agendar visita')).toBeTruthy()
    expect(container.querySelector('a[href^="tel:"]')).toBeNull()
  })
})

describe('app/fr/recherche/page.tsx : partie PT seulement', () => {
  const source = readFileSync(join(process.cwd(), 'app/fr/recherche/page.tsx'), 'utf8')

  it('la fiche VITFIX n’est ajoutée que pour siteLocale pt', () => {
    expect(source).toContain("if (siteLocale !== 'pt') return filteredArtisans")
    expect(source).toContain('comVitfixPrimeiro(filteredArtisans, categoria)')
  })

  it('le compteur, l’état vide et la liste rendue utilisent la liste avec VITFIX', () => {
    expect(source).toContain('listaExibida.map((artisan) => (')
    expect(source).toContain('listaExibida.length === 0 ? (')
    expect(source).toContain("{listaExibida.length} {listaExibida.length !== 1 ? 'profissionais disponíveis'")
    expect(source).not.toContain('filteredArtisans.map((artisan) => (')
    expect(source).not.toContain('filteredArtisans.length')
  })
})
