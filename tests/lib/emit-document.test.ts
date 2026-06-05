// tests/lib/emit-document.test.ts
//
// emitDocument : émission directe d'un document (méthode pro 2026).
// Miroir de la logique saveAndSend du form BTP (numéro définitif tiré
// SEULEMENT à l'émission, persistance localStorage + sync DB, statut émis).
// Source unique pour le flux « Émettre l'acompte » de FacturesSection.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { emitDocument } from '../../lib/emit-document'

const ART = 'art-1'

beforeEach(() => { localStorage.clear() })

describe('emitDocument', () => {
  it('tire un numéro définitif quand le doc est en brouillon (docNumber vide)', async () => {
    const getNumber = vi.fn().mockResolvedValue('AC-2026-007')
    const out = await emitDocument({
      payload: { id: 'd1', docNumber: '', factureSubType: 'acompte', lines: [] },
      artisanId: ART,
      getNumber,
    })
    expect(getNumber).toHaveBeenCalledTimes(1)
    expect(out.docNumber).toBe('AC-2026-007')
    expect(out.status).toBe('envoye')
    expect(out.savedAt).toBeTruthy()
    expect(out.sentAt).toBeTruthy()
  })

  it('tire un numéro définitif quand le docNumber est provisoire (BR-)', async () => {
    const getNumber = vi.fn().mockResolvedValue('AC-2026-008')
    const out = await emitDocument({
      payload: { id: 'd2', docNumber: 'BR-2026-012' },
      artisanId: ART,
      getNumber,
    })
    expect(getNumber).toHaveBeenCalledTimes(1)
    expect(out.docNumber).toBe('AC-2026-008')
  })

  it('NE re-tire PAS de numéro si le doc a déjà un numéro définitif', async () => {
    const getNumber = vi.fn().mockResolvedValue('AC-2026-999')
    const out = await emitDocument({
      payload: { id: 'd3', docNumber: 'AC-2026-003' },
      artisanId: ART,
      getNumber,
    })
    expect(getNumber).not.toHaveBeenCalled()
    expect(out.docNumber).toBe('AC-2026-003')
  })

  it('persiste dans fixit_documents_<artisan> (dédup par id) et retire des brouillons', async () => {
    localStorage.setItem(`fixit_documents_${ART}`, JSON.stringify([{ id: 'old', docNumber: 'FACT-2026-001' }]))
    localStorage.setItem(`fixit_drafts_${ART}`, JSON.stringify([{ id: 'd4', docNumber: 'BR-2026-020' }]))
    await emitDocument({
      payload: { id: 'd4', docNumber: 'BR-2026-020' },
      artisanId: ART,
      getNumber: vi.fn().mockResolvedValue('AC-2026-010'),
    })
    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${ART}`)!)
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${ART}`)!)
    expect(docs).toHaveLength(2) // old + nouvel acompte
    expect(docs.find((d: { id: string }) => d.id === 'd4').docNumber).toBe('AC-2026-010')
    expect(drafts.find((d: { id: string }) => d.id === 'd4')).toBeUndefined() // retiré des brouillons
  })

  it('assigne un id stable (UUID) quand le document n\'en a pas', async () => {
    const out = await emitDocument({
      payload: { docNumber: '', factureSubType: 'acompte' }, // pas d'id (cas buildAcomptePrefill)
      artisanId: ART,
      getNumber: vi.fn().mockResolvedValue('AC-2026-030'),
    })
    expect(out.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('préserve l\'id existant du document', async () => {
    const out = await emitDocument({
      payload: { id: 'fixed-uuid-1234', docNumber: '' },
      artisanId: ART,
      getNumber: vi.fn().mockResolvedValue('AC-2026-031'),
    })
    expect(out.id).toBe('fixed-uuid-1234')
  })

  it('deux acomptes successifs (sans id) coexistent en localStorage (ids distincts)', async () => {
    const a = await emitDocument({ payload: { docNumber: '' }, artisanId: ART, getNumber: vi.fn().mockResolvedValue('AC-2026-040') })
    const b = await emitDocument({ payload: { docNumber: '' }, artisanId: ART, getNumber: vi.fn().mockResolvedValue('AC-2026-041') })
    expect(a.id).not.toBe(b.id)
    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${ART}`)!)
    // Les DEUX acomptes doivent rester (le 2e ne doit pas écraser le 1er)
    expect(docs.filter((d: { docNumber: string }) => d.docNumber?.startsWith('AC-')).length).toBe(2)
  })

  it('appelle sync(finalDoc, artisanId) avec le document émis', async () => {
    const sync = vi.fn()
    const out = await emitDocument({
      payload: { id: 'd5', docNumber: '' },
      artisanId: ART,
      getNumber: vi.fn().mockResolvedValue('AC-2026-011'),
      sync,
    })
    expect(sync).toHaveBeenCalledTimes(1)
    expect(sync).toHaveBeenCalledWith(out, ART)
    expect((sync.mock.calls[0][0] as { status: string }).status).toBe('envoye')
  })
})
