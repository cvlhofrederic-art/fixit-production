// Catalogue de prestations BTP (lib/btp/catalogue-prestations.ts) : lecture du navigateur par le formulaire de
// devis et facture. Constat stockage-local-miroir-10 de l'audit du 11/11/2026.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  cleCatalogueBTP, cleCatalogueBTPAncienne, lireCatalogueBTPNavigateur, lireCatalogueLocal,
} from '@/lib/btp/catalogue-prestations'

const FICHE = 'fiche-btp-lib'
const CLE = cleCatalogueBTP(FICHE)
const prest = (id: number, name: string, supabase_id?: string) => ({ id, name, type: 'prest', ...(supabase_id ? { supabase_id } : {}) })

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('clés du catalogue', () => {
  it('module : v5 ; ancienne copie : v4', () => {
    expect(CLE).toBe('fixit_prestations_btp_v5_fiche-btp-lib')
    expect(cleCatalogueBTPAncienne(FICHE)).toBe('fixit_prestations_btp_v4_fiche-btp-lib')
  })
})

describe('lireCatalogueLocal', () => {
  it('présent, absent, ou illisible (pas une liste, JSON invalide)', () => {
    expect(lireCatalogueLocal(CLE)).toEqual({ etat: 'absent' })
    localStorage.setItem(CLE, '[]')
    expect(lireCatalogueLocal(CLE)).toEqual({ etat: 'present', catalogue: [] })
    localStorage.setItem(CLE, '{"a":1}')
    expect(lireCatalogueLocal(CLE)).toEqual({ etat: 'illisible' })
    localStorage.setItem(CLE, '[{')
    expect(lireCatalogueLocal(CLE)).toEqual({ etat: 'illisible' })
  })
})

describe('lireCatalogueBTPNavigateur (formulaire)', () => {
  const parDefaut = () => [prest(1, 'Par défaut')]

  it('le module d\'abord, puis l\'ancienne copie, puis le jeu par défaut ; rien n\'est écrit', () => {
    expect(lireCatalogueBTPNavigateur(FICHE, parDefaut)).toEqual(parDefaut())
    localStorage.setItem(cleCatalogueBTPAncienne(FICHE), JSON.stringify([prest(2, 'Ancienne')]))
    expect(lireCatalogueBTPNavigateur(FICHE, parDefaut)).toEqual([prest(2, 'Ancienne')])
    localStorage.setItem(CLE, JSON.stringify([prest(3, 'Module')]))
    expect(lireCatalogueBTPNavigateur(FICHE, parDefaut)).toEqual([prest(3, 'Module')])
    expect(localStorage).toHaveLength(2)
  })

  it('sans fiche, ou valeur du module illisible : aucun catalogue', () => {
    expect(lireCatalogueBTPNavigateur(undefined, parDefaut)).toEqual([])
    localStorage.setItem(CLE, 'pas du JSON')
    localStorage.setItem(cleCatalogueBTPAncienne(FICHE), JSON.stringify([prest(2, 'Ancienne')]))
    expect(lireCatalogueBTPNavigateur(FICHE, parDefaut)).toEqual([])
  })

  it('un élément qui n\'est pas un objet est écarté', () => {
    localStorage.setItem(CLE, JSON.stringify([null, 'texte', prest(4, 'Gardée')]))
    expect(lireCatalogueBTPNavigateur(FICHE, parDefaut)).toEqual([prest(4, 'Gardée')])
  })
})
