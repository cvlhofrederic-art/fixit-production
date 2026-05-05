import { describe, it, expect } from 'vitest'
import { canTransition, isTerminalStatus, documentCancelSchema, validateBody } from '@/lib/validation'

// FR-V1 — Vérifie la matrice de transitions de statut (cf. migration 079).

describe('canTransition — devis', () => {
  it('allows draft → sent', () => {
    expect(canTransition('draft', 'sent', 'devis')).toBe(true)
  })
  it('allows draft → cancelled', () => {
    expect(canTransition('draft', 'cancelled', 'devis')).toBe(true)
  })
  it('allows sent → signed', () => {
    expect(canTransition('sent', 'signed', 'devis')).toBe(true)
  })
  it('allows sent → expired', () => {
    expect(canTransition('sent', 'expired', 'devis')).toBe(true)
  })
  it('allows sent → cancelled', () => {
    expect(canTransition('sent', 'cancelled', 'devis')).toBe(true)
  })
  it('allows signed → cancelled', () => {
    expect(canTransition('signed', 'cancelled', 'devis')).toBe(true)
  })
  it('forbids signed → draft', () => {
    expect(canTransition('signed', 'draft', 'devis')).toBe(false)
  })
  it('forbids sent → draft', () => {
    expect(canTransition('sent', 'draft', 'devis')).toBe(false)
  })
  it('forbids cancelled → anything', () => {
    expect(canTransition('cancelled', 'sent', 'devis')).toBe(false)
    expect(canTransition('cancelled', 'draft', 'devis')).toBe(false)
    expect(canTransition('cancelled', 'signed', 'devis')).toBe(false)
  })
  // FR-V7 : nouveaux statuts accepted + rejected
  it('allows sent → accepted', () => {
    expect(canTransition('sent', 'accepted', 'devis')).toBe(true)
  })
  it('allows sent → rejected', () => {
    expect(canTransition('sent', 'rejected', 'devis')).toBe(true)
  })
  it('allows accepted → cancelled', () => {
    expect(canTransition('accepted', 'cancelled', 'devis')).toBe(true)
  })
  it('forbids accepted → sent (no going back)', () => {
    expect(canTransition('accepted', 'sent', 'devis')).toBe(false)
  })
  it('forbids rejected → anything (terminal)', () => {
    expect(canTransition('rejected', 'sent', 'devis')).toBe(false)
    expect(canTransition('rejected', 'cancelled', 'devis')).toBe(false)
    expect(canTransition('rejected', 'accepted', 'devis')).toBe(false)
  })
  it('forbids draft → accepted (must pass via sent)', () => {
    expect(canTransition('draft', 'accepted', 'devis')).toBe(false)
  })
  it('forbids expired → sent', () => {
    expect(canTransition('expired', 'sent', 'devis')).toBe(false)
  })
  it('allows same status (idempotent)', () => {
    expect(canTransition('sent', 'sent', 'devis')).toBe(true)
    expect(canTransition('cancelled', 'cancelled', 'devis')).toBe(true)
  })
})

describe('canTransition — facture', () => {
  it('allows pending → paid', () => {
    expect(canTransition('pending', 'paid', 'facture')).toBe(true)
  })
  it('allows pending → overdue', () => {
    expect(canTransition('pending', 'overdue', 'facture')).toBe(true)
  })
  it('allows pending → cancelled', () => {
    expect(canTransition('pending', 'cancelled', 'facture')).toBe(true)
  })
  it('allows paid → refunded', () => {
    expect(canTransition('paid', 'refunded', 'facture')).toBe(true)
  })
  it('allows paid → cancelled', () => {
    expect(canTransition('paid', 'cancelled', 'facture')).toBe(true)
  })
  it('allows overdue → paid', () => {
    expect(canTransition('overdue', 'paid', 'facture')).toBe(true)
  })
  it('forbids paid → pending (back-flow critical)', () => {
    expect(canTransition('paid', 'pending', 'facture')).toBe(false)
  })
  it('forbids refunded → anything', () => {
    expect(canTransition('refunded', 'pending', 'facture')).toBe(false)
    expect(canTransition('refunded', 'paid', 'facture')).toBe(false)
    expect(canTransition('refunded', 'cancelled', 'facture')).toBe(false)
  })
  it('forbids cancelled → anything', () => {
    expect(canTransition('cancelled', 'pending', 'facture')).toBe(false)
    expect(canTransition('cancelled', 'paid', 'facture')).toBe(false)
  })
})

describe('isTerminalStatus', () => {
  it('detects terminal devis statuses', () => {
    expect(isTerminalStatus('expired', 'devis')).toBe(true)
    expect(isTerminalStatus('cancelled', 'devis')).toBe(true)
    expect(isTerminalStatus('draft', 'devis')).toBe(false)
    expect(isTerminalStatus('sent', 'devis')).toBe(false)
    expect(isTerminalStatus('signed', 'devis')).toBe(false)
  })
  it('detects terminal facture statuses', () => {
    expect(isTerminalStatus('refunded', 'facture')).toBe(true)
    expect(isTerminalStatus('cancelled', 'facture')).toBe(true)
    expect(isTerminalStatus('pending', 'facture')).toBe(false)
    expect(isTerminalStatus('paid', 'facture')).toBe(false)
    expect(isTerminalStatus('overdue', 'facture')).toBe(false)
  })
})

describe('documentCancelSchema', () => {
  it('accepts valid cancellation payload', () => {
    const r = validateBody(documentCancelSchema, {
      docType: 'devis',
      numero: 'DEV-2026-001',
      reason: 'Erreur de client, à refaire',
    })
    expect(r.success).toBe(true)
  })
  it('rejects too-short reason', () => {
    const r = validateBody(documentCancelSchema, {
      docType: 'devis',
      numero: 'DEV-2026-001',
      reason: 'oops',
    })
    expect(r.success).toBe(false)
  })
  it('rejects too-long reason', () => {
    const r = validateBody(documentCancelSchema, {
      docType: 'devis',
      numero: 'DEV-2026-001',
      reason: 'x'.repeat(501),
    })
    expect(r.success).toBe(false)
  })
  it('rejects unknown docType', () => {
    const r = validateBody(documentCancelSchema, {
      docType: 'avoir',
      numero: 'AV-2026-001',
      reason: 'Test rejection',
    })
    expect(r.success).toBe(false)
  })
  it('rejects empty numero', () => {
    const r = validateBody(documentCancelSchema, {
      docType: 'facture',
      numero: '',
      reason: 'Test rejection',
    })
    expect(r.success).toBe(false)
  })
})
