// tests/lib/numerotation-btp-sans-serveur.test.ts
//
// Numérotation des devis et factures BTP sans réponse du serveur (constats documents-cycle-1,
// stockage-local-miroir-9 et documents-cycle-14 de l'audit des fondations BTP du 11/11/2026).
//
// - fetchNextDocNumber avec { repliLocal: false } (actions BTP en un clic) : si ni /api/doc-number ni la
//   fonction next_doc_number ne répondent, aucun numéro n'est fabriqué à partir d'un compteur du navigateur
//   (deux appareils pouvaient tirer le même) : l'appel échoue, rien n'est émis.
// - Sans l'option (formulaire et actions artisan), le repli local d'origine reste inchangé.
// - emitDocument avec { verifierPlaceAvantNumero: true } : quand le stockage du navigateur est plein, l'émission
//   s'arrête AVANT de consommer un numéro du serveur (avant : numéro tiré, puis écriture refusée, numéro perdu).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'jeton', user: { id: 'uid-auth' } } } }) },
    rpc: vi.fn(),
  },
}))

import { fetchNextDocNumber } from '../../lib/doc-number'
import { emitDocument } from '../../lib/emit-document'
import { supabase } from '@/lib/supabase'
import { remplirLeStockage } from '../helpers/stockage-navigateur-plein'

const ART = 'art-btp-1'
// Horloge figée : le repli local de l'artisan lit l'année au moment de l'appel (lib/doc-number.ts).
const ANNEE = 2026
const CLE_DOCS = `fixit_documents_${ART}`
const CLE_BROUILLONS = `fixit_drafts_${ART}`

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T10:00:00Z'))
  localStorage.clear()
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  ;(supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: { access_token: 'jeton', user: { id: 'uid-auth' } } } })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('fetchNextDocNumber — serveur muet', () => {
  beforeEach(() => {
    // Réseau coupé : /api/doc-number injoignable, next_doc_number en erreur.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    // Documents déjà émis sur cet appareil : le compteur local aurait donné AC-…-005.
    localStorage.setItem(CLE_DOCS, JSON.stringify([{ id: 'a', docNumber: `AC-${ANNEE}-004` }]))
  })

  it('BTP (repliLocal: false) : aucun numéro tiré du compteur du navigateur, l\'appel échoue', async () => {
    await expect(fetchNextDocNumber('acompte', ART, { repliLocal: false })).rejects.toMatchObject({
      name: 'NumerotationIndisponibleError',
    })
    // Rien n'a été écrit ni réservé dans le navigateur.
    expect(JSON.parse(localStorage.getItem(CLE_DOCS)!)).toEqual([{ id: 'a', docNumber: `AC-${ANNEE}-004` }])
  })

  it('artisan (sans option) : repli local d\'origine inchangé', async () => {
    await expect(fetchNextDocNumber('acompte', ART)).resolves.toBe(`AC-${ANNEE}-005`)
  })

  it('BTP : un numéro du serveur est toujours rendu tel quel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ number: `AC-${ANNEE}-031` }) }))
    await expect(fetchNextDocNumber('acompte', ART, { repliLocal: false })).resolves.toBe(`AC-${ANNEE}-031`)
  })

  it('BTP : la fonction next_doc_number prend le relais de la route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: `AC-${ANNEE}-032`, error: null })
    await expect(fetchNextDocNumber('acompte', ART, { repliLocal: false })).resolves.toBe(`AC-${ANNEE}-032`)
  })
})

describe('emitDocument — stockage du navigateur plein', () => {
  const acompte = () => ({
    docType: 'facture', docNumber: '', factureSubType: 'acompte', clientName: 'SCI Test',
    lines: [{ description: 'Acompte 30 %', qty: 1, priceHT: 1500, tvaRate: 20 }],
  })

  it('BTP (verifierPlaceAvantNumero) : aucun numéro consommé, rien d\'écrit, rien d\'envoyé', async () => {
    localStorage.setItem(CLE_DOCS, JSON.stringify([{ id: 'a', docNumber: `FACT-${ANNEE}-010`, status: 'envoye' }]))
    localStorage.setItem(CLE_BROUILLONS, JSON.stringify([]))
    const docsAvant = localStorage.getItem(CLE_DOCS)
    remplirLeStockage()
    const getNumber = vi.fn().mockResolvedValue(`AC-${ANNEE}-040`)
    const sync = vi.fn()

    await expect(emitDocument({ payload: acompte(), artisanId: ART, getNumber, sync, verifierPlaceAvantNumero: true }))
      .rejects.toMatchObject({ name: 'StockageNavigateurPleinError' })

    expect(getNumber).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
    expect(localStorage.getItem(CLE_DOCS)).toBe(docsAvant)
  })

  it('BTP : avec de la place, l\'émission se fait comme avant (numéro tiré, document écrit puis envoyé)', async () => {
    const getNumber = vi.fn().mockResolvedValue(`AC-${ANNEE}-041`)
    const sync = vi.fn()
    const emis = await emitDocument({ payload: acompte(), artisanId: ART, getNumber, sync, verifierPlaceAvantNumero: true })
    expect(getNumber).toHaveBeenCalledTimes(1)
    expect(emis.docNumber).toBe(`AC-${ANNEE}-041`)
    expect(JSON.parse(localStorage.getItem(CLE_DOCS)!)).toEqual([emis])
    expect(sync).toHaveBeenCalledWith(emis, ART)
    // La sonde de place ne laisse rien derrière elle.
    expect(Object.keys(localStorage).filter((cle) => !cle.startsWith('fixit_'))).toEqual([])
  })

  it('artisan (sans option) : comportement d\'origine, le numéro est tiré avant l\'écriture', async () => {
    remplirLeStockage()
    const getNumber = vi.fn().mockResolvedValue(`AC-${ANNEE}-042`)
    await expect(emitDocument({ payload: acompte(), artisanId: ART, getNumber })).rejects.toMatchObject({ name: 'QuotaExceededError' })
    expect(getNumber).toHaveBeenCalledTimes(1)
  })
})
