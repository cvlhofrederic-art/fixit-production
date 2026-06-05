// tests/components/use-document-cancel-softdelete.test.ts
//
// Suppression d'un brouillon : si le brouillon est aussi persisté en base
// (id UUID stable), on doit le SOFT-DELETE en DB (deleted_at), sinon il
// réapparaît au rechargement (fetchDocumentsFromSupabase filtre deleted_at IS
// NULL, sans filtre de statut). Incident DEV-2026-010 (brouillon en base,
// supprimé en local mais re-fetché). RLS owner_update autorise l'UPDATE.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const { from, update, updateEq } = vi.hoisted(() => {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq: updateEq }))
  const from = vi.fn(() => ({ update }))
  return { from, update, updateEq }
})
vi.mock('@/lib/supabase', () => ({ supabase: { from } }))

import { useDocumentCancel } from '@/components/dashboard/useDocumentCancel'

const STABLE_ID = '50e30094-3af7-442b-b2b0-4e8c8fc12b64'

beforeEach(() => {
  localStorage.clear()
  from.mockClear()
  update.mockClear()
  updateEq.mockClear()
})

describe('useDocumentCancel — soft-delete DB des brouillons persistés', () => {
  it('brouillon DEVIS avec id stable → UPDATE deleted_at sur table devis', () => {
    const { result } = renderHook(() => useDocumentCancel<{ id?: string; docNumber?: string; status?: string }>({
      artisanId: 'art-1', docType: 'devis', confirmDraftDelete: () => true, setSavedDocuments: vi.fn(),
    }))
    result.current.handleRemoveDoc({ id: STABLE_ID, docNumber: 'DEV-2026-010', status: 'brouillon' })

    expect(from).toHaveBeenCalledWith('devis')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(String) }))
    expect(updateEq).toHaveBeenCalledWith('id', STABLE_ID)
  })

  it('brouillon FACTURE avec id stable → table factures', () => {
    const { result } = renderHook(() => useDocumentCancel<{ id?: string; docNumber?: string; status?: string }>({
      artisanId: 'art-1', docType: 'facture', confirmDraftDelete: () => true, setSavedDocuments: vi.fn(),
    }))
    result.current.handleRemoveDoc({ id: STABLE_ID, docNumber: 'BR-2026-001', status: 'brouillon' })
    expect(from).toHaveBeenCalledWith('factures')
  })

  it('brouillon SANS id stable (localStorage pur) → aucun appel DB', () => {
    const { result } = renderHook(() => useDocumentCancel<{ id?: string; docNumber?: string; status?: string }>({
      artisanId: 'art-1', docType: 'devis', confirmDraftDelete: () => true, setSavedDocuments: vi.fn(),
    }))
    result.current.handleRemoveDoc({ docNumber: 'BR-2026-002', status: 'brouillon' })
    expect(from).not.toHaveBeenCalled()
  })

  it('document ÉMIS (non brouillon) → pas de soft-delete ici (passe par la modale d\'annulation)', () => {
    const { result } = renderHook(() => useDocumentCancel<{ id?: string; docNumber?: string; status?: string }>({
      artisanId: 'art-1', docType: 'devis', confirmDraftDelete: () => true, setSavedDocuments: vi.fn(),
    }))
    result.current.handleRemoveDoc({ id: STABLE_ID, docNumber: 'DEV-2026-011', status: 'envoye' })
    expect(from).not.toHaveBeenCalled()
  })
})
