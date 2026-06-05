import { describe, it, expect } from 'vitest'
import {
  ALFREDO_DATA_ACCESS_POLICY,
  canAccessSource,
  filterContextByRole,
} from '@/lib/syndic/alfredo-data-access-policy'

describe('Alfredo data access policy', () => {
  it('syndic et syndic_admin ont accès à toutes les sources', () => {
    const sources = ALFREDO_DATA_ACCESS_POLICY.sources
    for (const source of sources) {
      expect(canAccessSource('syndic', source)).toBe(true)
      expect(canAccessSource('syndic_admin', source)).toBe(true)
    }
  })

  it('syndic_comptable a accès aux sources financières', () => {
    expect(canAccessSource('syndic_comptable', 'syndic_appels_charges')).toBe(true)
    expect(canAccessSource('syndic_comptable', 'syndic_impayes')).toBe(true)
    expect(canAccessSource('syndic_comptable', 'syndic_factures')).toBe(true)
  })

  it('syndic_juriste a accès aux sources juridiques et contentieux', () => {
    expect(canAccessSource('syndic_juriste', 'syndic_recouvrement')).toBe(true)
    expect(canAccessSource('syndic_juriste', 'syndic_sinistres')).toBe(true)
  })

  it('syndic_tech n\'a PAS accès aux données financières', () => {
    expect(canAccessSource('syndic_tech', 'syndic_appels_charges')).toBe(false)
    expect(canAccessSource('syndic_tech', 'syndic_impayes')).toBe(false)
    expect(canAccessSource('syndic_tech', 'syndic_recouvrement')).toBe(false)
  })

  it('syndic_juriste n\'a PAS accès aux détails financiers granulaires', () => {
    expect(canAccessSource('syndic_juriste', 'syndic_appels_charges')).toBe(false)
  })

  it('filterContextByRole supprime les champs non autorisés', () => {
    const fullContext = {
      identity: { lot_ref_anonymized: 'L42', tantiemes: 250 },
      financial: { impayes: [], statut_paiement: 'a_jour' as const, derniers_appels: [] },
      open_items: { missions: [], devis_en_cours: [], sinistres: [], signalements: [] },
    }
    const filtered = filterContextByRole('syndic_tech', fullContext)
    expect(filtered.identity).toBeDefined()
    expect(filtered.financial).toBeUndefined()
    expect(filtered.open_items).toBeDefined()
    expect(filtered.rbac_omitted_fields).toContain('financial')
  })

  it('rbac_omitted_fields documente les omissions pour debug', () => {
    const filtered = filterContextByRole('syndic_tech', {
      financial: { statut_paiement: 'en_retard' as const, impayes: [], derniers_appels: [] }
    })
    expect(filtered.rbac_omitted_fields).toEqual(expect.arrayContaining(['financial']))
  })
})
