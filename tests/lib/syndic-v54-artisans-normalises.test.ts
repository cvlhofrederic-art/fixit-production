import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchArtisans, normaliserArtisan } from '@/lib/syndic/v54/api'
import type { Artisan } from '@/components/syndic-dashboard/types'

/**
 * GET /api/syndic/artisans renvoie les colonnes Supabase en snake_case. Les modules v54
 * (Alertes, Tableau de bord, Prestataires) lisent rcProValide / vitfixCertifie : sans
 * normalisation, tous les prestataires apparaissaient sans RC valide et non certifiés.
 */

const brut = {
  id: 'a1', nom: 'Silva', prenom: 'João', metier: 'Canalizador', telephone: '', email: '', siret: '', note: 4.8, statut: 'actif',
  vitfix_certifie: true, rc_pro_valide: true, rc_pro_expiration: '2027-12-31',
  assurance_decennale_valide: false, assurance_decennale_expiration: null, nb_interventions: 12,
} as unknown as Artisan

afterEach(() => vi.restoreAllMocks())

describe('normaliserArtisan', () => {
  it('reprend les champs snake_case de la route en camelCase', () => {
    const a = normaliserArtisan(brut)
    expect(a.vitfixCertifie).toBe(true)
    expect(a.rcProValide).toBe(true)
    expect(a.rcProExpiration).toBe('2027-12-31')
    expect(a.decennaleValide).toBe(false)
    expect(a.decennaleExpiration).toBe('')
    expect(a.nbInterventions).toBe(12)
  })

  it('garde les champs camelCase déjà présents', () => {
    const a = normaliserArtisan({ ...brut, rcProValide: false, vitfixCertifie: false } as Artisan)
    expect(a.rcProValide).toBe(false)
    expect(a.vitfixCertifie).toBe(false)
  })

  it('valeurs absentes : faux, chaîne vide ou zéro', () => {
    const a = normaliserArtisan({ id: 'a2', nom: 'X', metier: '', telephone: '', email: '', siret: '', note: 0, statut: 'actif' } as unknown as Artisan)
    expect(a.rcProValide).toBe(false)
    expect(a.vitfixCertifie).toBe(false)
    expect(a.nbInterventions).toBe(0)
    expect(a.rcProExpiration).toBe('')
  })
})

describe('fetchArtisans', () => {
  it('renvoie des artisans normalisés', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ artisans: [brut] }), { status: 200 }))
    const [a] = await fetchArtisans('jeton')
    expect(a.rcProValide).toBe(true)
    expect(a.vitfixCertifie).toBe(true)
    expect(a.nbInterventions).toBe(12)
  })
})
