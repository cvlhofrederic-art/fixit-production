// tests/devis-reconcile.test.ts — Nettoyage one-shot des doublons localStorage
// devis/facture déjà présents (copie locale id-horodaté vs cloud UUID de même
// numéro ; brouillon non purgé après émission). Pur → testable.

import { describe, it, expect } from 'vitest'
import { reconcileDocLists } from '../lib/devis-utils'

const UUID = '50e30094-3af7-442b-b2b0-4e8c8fc12b64'

describe('reconcileDocLists', () => {
  it('replie une copie locale (id horodaté) et cloud (UUID) de même numéro, garde l\'UUID', () => {
    const docs = [
      { id: '1779539827817', docNumber: 'FACT-2026-009', clientName: 'A' },
      { id: UUID, docNumber: 'FACT-2026-009', clientName: 'A', total: 100 },
    ]
    const r = reconcileDocLists(docs, [])
    expect(r.documents).toHaveLength(1)
    expect(r.documents[0].id).toBe(UUID)
    expect(r.removed).toBe(1)
  })

  it('retire un brouillon dont le numéro est déjà émis (l\'émis prime — bug #6 historique)', () => {
    const docs = [{ id: UUID, docNumber: 'DEV-2026-010', clientName: 'X' }]
    const drafts = [{ id: '1780325624194', docNumber: 'DEV-2026-010', clientName: 'X' }]
    const r = reconcileDocLists(docs, drafts)
    expect(r.documents).toHaveLength(1)
    expect(r.drafts).toHaveLength(0)
    expect(r.removed).toBe(1)
  })

  it('préserve les brouillons SANS numéro (jamais fusionnés)', () => {
    const drafts = [
      { id: 'a', docNumber: '', clientName: 'D1' },
      { id: 'b', docNumber: '', clientName: 'D2' },
    ]
    const r = reconcileDocLists([], drafts)
    expect(r.drafts).toHaveLength(2)
    expect(r.removed).toBe(0)
  })

  it('n\'altère rien en l\'absence de doublon (removed = 0)', () => {
    const docs = [{ id: UUID, docNumber: 'FACT-2026-001' }]
    const drafts = [{ id: 'x', docNumber: 'BR-2026-001' }]
    const r = reconcileDocLists(docs, drafts)
    expect(r.removed).toBe(0)
    expect(r.documents).toHaveLength(1)
    expect(r.drafts).toHaveLength(1)
  })
})
