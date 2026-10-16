import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SECTEURS_BTP_FR, SECTEURS_BTP_PT, secteursToSlugs } from '@/lib/btp-secteurs'

// Slugs réellement présents en base (seed de la table specialties)
const seed = readFileSync(join(process.cwd(), 'supabase/migrations/035_specialties.sql'), 'utf8')
const SLUGS_EN_BASE = new Set(Array.from(seed.matchAll(/^\s*\('([a-z0-9-]+)',/gm), m => m[1]))

// Secteurs volontairement sans spécialité bâtiment
const SANS_SPECIALITE = new Set([
  'Électroménager', 'Dératisation', 'Bricolage', 'Autre secteur',
  'Eletrodomésticos', 'Controlo de pragas', 'Bricolagem', 'Outro setor',
])

describe('secteurs BTP → spécialités', () => {
  it('lit bien les slugs du seed', () => {
    expect(SLUGS_EN_BASE.size).toBeGreaterThanOrEqual(26)
    expect(SLUGS_EN_BASE.has('gros-oeuvre')).toBe(true)
  })

  it.each([
    ['FR', SECTEURS_BTP_FR],
    ['PT', SECTEURS_BTP_PT],
  ])('chaque secteur %s pointe vers un slug existant, sauf les hors-bâtiment', (_pays, secteurs) => {
    for (const s of secteurs) {
      if (SANS_SPECIALITE.has(s.label)) {
        expect(s.slug, s.label).toBeNull()
      } else {
        expect(s.slug, s.label).not.toBeNull()
        expect(SLUGS_EN_BASE.has(s.slug as string), `${s.label} → ${s.slug}`).toBe(true)
      }
    }
  })

  it('traduit les libellés accentués qui étaient perdus', () => {
    expect(secteursToSlugs(['Maçonnerie', 'Électricité', 'Rénovation générale', 'Étanchéité']))
      .toEqual(['gros-oeuvre', 'electricite', 'renovation-generale', 'etancheite'])
  })

  it('traduit les libellés portugais', () => {
    expect(secteursToSlugs(['Alvenaria', 'Renovação geral'])).toEqual(['gros-oeuvre', 'renovation-generale'])
  })

  it('supprime les doublons', () => {
    expect(secteursToSlugs(['Revêtements muraux', 'Revêtements de sols'])).toEqual(['carrelage'])
  })

  it('ignore les secteurs sans spécialité et les libellés inconnus', () => {
    expect(secteursToSlugs(['Autre secteur', 'Libellé inconnu'])).toEqual([])
  })
})
