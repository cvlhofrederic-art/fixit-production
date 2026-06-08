// tests/lib/doc-number.test.ts
//
// Numérotation légale partagée (art. 242 nonies A I 2° CGI : séquence continue).
// fetchNextDocNumber : 3 niveaux de fallback (API /api/doc-number → RPC
// next_doc_number → compteur localStorage). localFallbackDocNumber : préfixes
// par série (DEV-/FACT-/AC-/AV-). Utilisé par le flux « Émettre l'acompte ».

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok', user: { id: 'uid-auth' } } } }) },
    rpc: vi.fn(),
  },
}))

import { fetchNextDocNumber, localFallbackDocNumber } from '../../lib/doc-number'
import { supabase } from '@/lib/supabase'

const ART = 'art-1'
const YEAR = new Date().getFullYear()

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  ;(supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: { access_token: 'tok', user: { id: 'uid-auth' } } } })
})

describe('localFallbackDocNumber', () => {
  it('préfixe AC- pour un acompte et démarre à 001', () => {
    expect(localFallbackDocNumber(ART, 'acompte')).toBe(`AC-${YEAR}-001`)
  })
  it('incrémente à partir du max existant (docs + brouillons)', () => {
    localStorage.setItem(`fixit_documents_${ART}`, JSON.stringify([{ docNumber: `AC-${YEAR}-004` }]))
    localStorage.setItem(`fixit_drafts_${ART}`, JSON.stringify([{ docNumber: `AC-${YEAR}-002` }]))
    expect(localFallbackDocNumber(ART, 'acompte')).toBe(`AC-${YEAR}-005`)
  })
  it('série dédiée par type (AC- ≠ FACT-)', () => {
    localStorage.setItem(`fixit_documents_${ART}`, JSON.stringify([{ docNumber: `FACT-${YEAR}-010` }]))
    expect(localFallbackDocNumber(ART, 'acompte')).toBe(`AC-${YEAR}-001`)
  })
})

describe('fetchNextDocNumber', () => {
  it('1) utilise /api/doc-number quand l\'API répond', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve({ number: `AC-${YEAR}-007` }),
    }))
    await expect(fetchNextDocNumber('acompte', ART)).resolves.toBe(`AC-${YEAR}-007`)
    vi.unstubAllGlobals()
  })

  it('2) bascule sur la RPC next_doc_number si l\'API échoue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: `AC-${YEAR}-008`, error: null })
    await expect(fetchNextDocNumber('acompte', ART)).resolves.toBe(`AC-${YEAR}-008`)
    vi.unstubAllGlobals()
  })

  it('2b) la RPC reçoit l\'auth uid (session.user.id), PAS l\'id profil passé pour le localStorage', async () => {
    // Bug cross-device : l'ancien code passait l'id PROFIL (artisan.id) au RPC
    // next_doc_number, qui exige auth.uid() = p_artisan_user_id → 'unauthorized'
    // systématique → fallback localStorage → collisions selon l'ordinateur.
    // L'uid d'auth doit venir de la session, l'id profil ne sert qu'à la clé localStorage.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))
    ;(supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { session: { access_token: 'tok', user: { id: 'uid-auth' } } },
    })
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: `AC-${YEAR}-008`, error: null })
    await fetchNextDocNumber('acompte', 'profil-id-different')
    expect(supabase.rpc).toHaveBeenCalledWith('next_doc_number', expect.objectContaining({ p_artisan_user_id: 'uid-auth' }))
    vi.unstubAllGlobals()
  })

  it('3) fallback localStorage si API et RPC échouent (jamais de numéro vide)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'down' } })
    await expect(fetchNextDocNumber('acompte', ART)).resolves.toBe(`AC-${YEAR}-001`)
    vi.unstubAllGlobals()
  })
})
