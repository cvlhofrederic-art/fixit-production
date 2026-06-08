// tests/dashboard-hydration.test.ts
// Task (d) — Hydratation des docs DB dans le cache localStorage au chargement
// du dashboard. Le fallback de numérotation localStorage (localFallbackDocNumber)
// calcule max(seq)+1 sur `fixit_documents_<artisanId>`. Si un device neuf n'a
// jamais vu les docs DB, ce fallback redémarre à -001 et entre en collision avec
// un FACT-2026-001 déjà émis en base (cause racine du bug « doc qui disparaît »).
//
// `persistEmittedDocsToCache` réécrit le résultat fusionné (DB + local), DÉDUPÉ
// par identité (réutilise dedupeDocsByIdentity — invariant anti-doublons de
// l'incident factures 2026-06-05), dans `fixit_documents_*`, en n'y écrivant QUE
// les documents émis (les brouillons restent dans `fixit_drafts_*`).

import { describe, it, expect, beforeEach } from 'vitest'
import { persistEmittedDocsToCache } from '../lib/document-sync'

const ARTISAN = 'artisan-hydrate-1'
const KEY = `fixit_documents_${ARTISAN}`

describe('persistEmittedDocsToCache — hydratation DB → localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('écrit les docs DB absents en local dans fixit_documents_<id>', () => {
    // Local : un seul doc émis déjà connu
    localStorage.setItem(KEY, JSON.stringify([
      { id: 'local-uuid-1', docType: 'facture', docNumber: 'FACT-2026-001', status: 'envoye' },
    ]))

    // Liste fusionnée (résultat de dedupeDocsByIdentity côté dashboard) : contient
    // le doc local + deux docs DB-only.
    const merged = [
      { id: 'local-uuid-1', docType: 'facture', docNumber: 'FACT-2026-001', status: 'envoye' },
      { id: 'db-uuid-2', docType: 'facture', docNumber: 'FACT-2026-002', status: 'paye', _fromSupabase: true },
      { id: 'db-uuid-3', docType: 'devis', docNumber: 'DEV-2026-005', status: 'envoye', _fromSupabase: true },
    ]

    persistEmittedDocsToCache(ARTISAN, merged)

    const stored = JSON.parse(localStorage.getItem(KEY) || '[]') as Array<{ docNumber: string }>
    const numbers = stored.map(d => d.docNumber).sort()
    expect(numbers).toEqual(['DEV-2026-005', 'FACT-2026-001', 'FACT-2026-002'])
  })

  it('ne duplique pas un doc déjà présent en local (dédup par identité)', () => {
    // Même document : id legacy horodaté en local, UUID DB — MÊME numéro légal.
    // dedupeDocsByIdentity doit les fusionner en UNE entrée (incident 2026-06-05).
    localStorage.setItem(KEY, JSON.stringify([
      { id: '1779539827817', docType: 'facture', docNumber: 'FACT-2026-009', status: 'envoye' },
    ]))
    const merged = [
      { id: '1779539827817', docType: 'facture', docNumber: 'FACT-2026-009', status: 'envoye' },
      { id: 'db-uuid-9', docType: 'facture', docNumber: 'FACT-2026-009', status: 'paye', _fromSupabase: true },
    ]

    persistEmittedDocsToCache(ARTISAN, merged)

    const stored = JSON.parse(localStorage.getItem(KEY) || '[]') as Array<{ docNumber: string }>
    expect(stored).toHaveLength(1)
    expect(stored[0].docNumber).toBe('FACT-2026-009')
  })

  it('n\'écrit PAS les brouillons dans fixit_documents_ (ils restent dans fixit_drafts_)', () => {
    const merged = [
      { id: 'emit-1', docType: 'facture', docNumber: 'FACT-2026-010', status: 'envoye' },
      { id: 'draft-fr', docType: 'devis', docNumber: 'BR-123', status: 'brouillon' },
      { id: 'draft-en', docType: 'devis', docNumber: '', status: 'draft', _fromSupabase: true },
    ]

    persistEmittedDocsToCache(ARTISAN, merged)

    const stored = JSON.parse(localStorage.getItem(KEY) || '[]') as Array<{ id: string; status: string }>
    const ids = stored.map(d => d.id)
    expect(ids).toContain('emit-1')
    expect(ids).not.toContain('draft-fr')
    expect(ids).not.toContain('draft-en')
    // Le cache drafts n'a pas été touché par ce helper
    expect(localStorage.getItem(`fixit_drafts_${ARTISAN}`)).toBeNull()
  })

  it('no-op silencieux si la liste fusionnée ne contient aucun doc émis', () => {
    localStorage.setItem(KEY, JSON.stringify([
      { id: 'keep-1', docType: 'facture', docNumber: 'FACT-2026-001', status: 'envoye' },
    ]))
    // Seulement des brouillons en entrée → on n'écrase pas le cache émis existant.
    persistEmittedDocsToCache(ARTISAN, [
      { id: 'd1', docType: 'devis', docNumber: 'BR-1', status: 'brouillon' },
    ])
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]') as Array<{ id: string }>
    expect(stored.map(d => d.id)).toEqual(['keep-1'])
  })
})
