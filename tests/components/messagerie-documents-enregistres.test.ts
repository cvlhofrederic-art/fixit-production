// tests/components/messagerie-documents-enregistres.test.ts
//
// « Envoyer un document » (Messagerie Pro) : pré-remplissage depuis les devis / factures
// enregistrés. Montant TTC = même calcul que la liste Factures V5 (Artisan : lines +
// customTables ; BTP : toutes sections via buildDocumentLines ; régimes TVA).

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))

import {
  documentsPourPreRemplissage,
  montantTtcDocumentEnregistre,
  type DocumentEnregistre,
} from '@/components/dashboard/messagerie/documents-enregistres'

const ligne = (totalHT: number, tvaRate = 20, description = 'Poste') => ({ description, totalHT, tvaRate })

describe('montantTtcDocumentEnregistre', () => {
  it('Artisan, TVA classique : HT + TVA par taux', () => {
    expect(montantTtcDocumentEnregistre({ docType: 'devis', lines: [ligne(1000), ligne(100, 10)] }, 'artisan')).toBe(1310)
  })

  it('franchise 293 B (tvaEnabled false) ou autoliquidation : TTC = HT', () => {
    expect(montantTtcDocumentEnregistre({ docType: 'devis', tvaEnabled: false, lines: [ligne(500)] }, 'artisan')).toBe(500)
    expect(montantTtcDocumentEnregistre({ docType: 'devis', regimeTva: 'autoliquidation_btp', lines: [ligne(500)] }, 'pro_societe')).toBe(500)
  })

  it('BTP : sections Matériaux / Frais / corps d\'état comprises, sections masquées exclues', () => {
    const doc = {
      docType: 'devis',
      lines: [ligne(1000)],
      materialLines: [ligne(200)],
      fraisLines: [ligne(50)],
      fraisLinesEnabled: false,
      customTables: [{ lines: [ligne(300)] }],
    } as DocumentEnregistre
    expect(montantTtcDocumentEnregistre(doc, 'pro_societe')).toBe(1800) // (1000 + 200 + 300) × 1,2
    // Artisan : calcul historique (lines + customTables)
    expect(montantTtcDocumentEnregistre(doc, 'artisan')).toBe(1560) // (1000 + 300) × 1,2
  })
})

describe('documentsPourPreRemplissage', () => {
  const docs: DocumentEnregistre[] = [
    { id: 'a', docType: 'devis', docNumber: 'D-2026-013', docTitle: 'Peinture hall', docDate: '2026-10-01', status: 'envoye', lines: [ligne(100)] },
    { id: 'b', docType: 'devis', docNumber: 'D-2026-014', docTitle: '', docDate: '2026-10-12', status: 'sent', lines: [ligne(533.33, 20, 'Remplacement colonne EF')] },
    { id: 'c', docType: 'devis', docNumber: 'D-2026-015', status: 'brouillon', lines: [ligne(1)] },
    { id: 'd', docType: 'devis', docNumber: 'D-2026-012', status: 'annule', lines: [ligne(1)] },
    { id: 'e', docType: 'devis', status: 'envoye', lines: [ligne(1)] },
    { id: 'f', docType: 'facture', docNumber: 'F-2026-003', docTitle: 'Colonne EF', status: 'pending', lines: [ligne(1000)] },
  ]

  it('devis émis et numérotés seulement (ni brouillon, ni annulé), du plus récent au plus ancien', () => {
    const liste = documentsPourPreRemplissage(docs, 'devis', 'artisan')
    expect(liste.map(d => d.reference)).toEqual(['D-2026-014', 'D-2026-013'])
    expect(liste[0]).toEqual({ cle: 'b', reference: 'D-2026-014', montant_ttc: 640, description: 'Remplacement colonne EF', date: '2026-10-12' })
    expect(liste[1]).toMatchObject({ description: 'Peinture hall', montant_ttc: 120, date: '2026-10-01' })
  })

  it('factures pour le type facture ; liste vide sans documents', () => {
    expect(documentsPourPreRemplissage(docs, 'facture', 'pro_societe')).toEqual([
      { cle: 'f', reference: 'F-2026-003', montant_ttc: 1200, description: 'Colonne EF', date: '' },
    ])
    expect(documentsPourPreRemplissage(undefined, 'devis')).toEqual([])
  })
})
