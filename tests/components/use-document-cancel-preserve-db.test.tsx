// tests/components/use-document-cancel-preserve-db.test.tsx
//
// Régression incident Sud travaux 2026-05-26 :
//   Après annulation/suppression d'un document, 10 factures émises (présentes
//   en DB Supabase mais pas dans localStorage du navigateur) disparaissaient
//   de la liste UI. Refresh manuel (F5) les ramenait.
//
// Cause racine : `useDocumentCancel.handleRemoveDoc` et `handleCancelled`
//   appelaient `setSavedDocuments([...localStorageDocs, ...localStorageDrafts])`
//   ce qui ÉCRASAIT le state React avec UNIQUEMENT le contenu localStorage,
//   perdant les entrées DB-only mergées au mount par fetchDocumentsFromSupabase().
//
// Fix : functional update `setSavedDocuments(prev => prev.filter/map(...))` qui
//   opère sur `prev` (= state mergé DB + localStorage) au lieu d'écraser.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDocumentCancel, type CancellableDoc } from '@/components/dashboard/useDocumentCancel'

const ARTISAN_ID = 'art-sudtravaux-001'

interface TestDoc extends CancellableDoc {
  docNumber: string
  client?: string
  _fromDB?: boolean
}

// Mix réaliste : 3 factures DB-only (créées sur d'autres appareils ou avant un
// purge localStorage) + 2 factures localStorage (créées récemment sur ce device).
const DB_ONLY_DOCS: TestDoc[] = [
  { docNumber: 'FACT-2026-003', client: 'Aureliane CHELLES', status: 'pending', _fromDB: true },
  { docNumber: 'FACT-2026-004', client: 'Evo travaux', status: 'pending', _fromDB: true },
  { docNumber: 'FACT-2026-005', client: 'Anne Guillaume', status: 'pending', _fromDB: true },
]
const LOCAL_DOCS: TestDoc[] = [
  { docNumber: 'FACT-2026-010', client: 'Arnaud Plessis', status: 'envoye' },
  { docNumber: 'BR-1779800000001', client: 'Evo travaux', status: 'brouillon' },
]
const INITIAL_STATE: TestDoc[] = [...DB_ONLY_DOCS, ...LOCAL_DOCS]

describe('useDocumentCancel — préserve les entrées DB-only', () => {
  beforeEach(() => {
    localStorage.clear()
    // localStorage ne contient QUE les 2 docs récents (les 3 DB-only n'y sont pas)
    localStorage.setItem(`fixit_documents_${ARTISAN_ID}`, JSON.stringify([LOCAL_DOCS[0]]))
    localStorage.setItem(`fixit_drafts_${ARTISAN_ID}`, JSON.stringify([LOCAL_DOCS[1]]))
  })

  it('handleRemoveDoc (brouillon) : retire le brouillon ciblé SANS perdre les DB-only', () => {
    const setSavedDocuments = vi.fn()
    let currentState = INITIAL_STATE

    setSavedDocuments.mockImplementation((updater: unknown) => {
      currentState = typeof updater === 'function'
        ? (updater as (prev: TestDoc[]) => TestDoc[])(currentState)
        : (updater as TestDoc[])
    })

    const confirmDraftDelete = vi.fn(() => true)

    const { result } = renderHook(() => useDocumentCancel<TestDoc>({
      artisanId: ARTISAN_ID,
      docType: 'facture',
      confirmDraftDelete,
      setSavedDocuments,
    }))

    // Suppression du brouillon BR-1779800000001 (présent en localStorage)
    act(() => {
      result.current.handleRemoveDoc(LOCAL_DOCS[1])
    })

    expect(confirmDraftDelete).toHaveBeenCalledTimes(1)

    // CRITIQUE : les 3 entrées DB-only doivent persister dans le state
    const dbNumbers = currentState.map(d => d.docNumber)
    expect(dbNumbers).toContain('FACT-2026-003')
    expect(dbNumbers).toContain('FACT-2026-004')
    expect(dbNumbers).toContain('FACT-2026-005')

    // Le brouillon doit avoir disparu
    expect(dbNumbers).not.toContain('BR-1779800000001')

    // La facture localStorage non ciblée reste
    expect(dbNumbers).toContain('FACT-2026-010')

    // Total : 5 - 1 brouillon supprimé = 4
    expect(currentState).toHaveLength(4)

    // localStorage côté write-through aussi mis à jour
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${ARTISAN_ID}`) || '[]')
    expect(drafts).toHaveLength(0)
  })

  it('handleCancelled (facture émise → annulée) : marque le doc + préserve DB-only', () => {
    const setSavedDocuments = vi.fn()
    let currentState = INITIAL_STATE

    setSavedDocuments.mockImplementation((updater: unknown) => {
      currentState = typeof updater === 'function'
        ? (updater as (prev: TestDoc[]) => TestDoc[])(currentState)
        : (updater as TestDoc[])
    })

    const { result } = renderHook(() => useDocumentCancel<TestDoc>({
      artisanId: ARTISAN_ID,
      docType: 'facture',
      confirmDraftDelete: vi.fn(() => true),
      setSavedDocuments,
    }))

    // Setup : la modal d'annulation s'est ouverte sur FACT-2026-010
    act(() => {
      result.current.setCancellingDoc(LOCAL_DOCS[0])
    })

    // L'API a confirmé l'annulation → handleCancelled marque le doc
    act(() => {
      result.current.handleCancelled()
    })

    // Les 3 DB-only doivent toujours être là, intactes
    const dbOnly = currentState.filter(d => d._fromDB)
    expect(dbOnly).toHaveLength(3)
    expect(dbOnly.every(d => d.status === 'pending')).toBe(true)

    // Le doc cancelled a son status à 'annule'
    const fact010 = currentState.find(d => d.docNumber === 'FACT-2026-010')
    expect(fact010?.status).toBe('annule')

    // Total : 5 (rien n'est supprimé, juste marqué)
    expect(currentState).toHaveLength(5)
  })
})
