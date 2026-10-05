// tests/lib/rib-profil.test.ts
//
// RIB courant du profil pour les documents BTP émis sans formulaire (lib/rib-profil.ts) :
// la facture ou l'acompte émis en un clic depuis un devis ne doit pas recopier le RIB figé
// dans ce devis.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession } } }))

import { appliquerRibCourant, chargerRibProfil } from '../../lib/rib-profil'

const reponse = (corps: unknown, ok = true) => ({ ok, json: () => Promise.resolve(corps) }) as unknown as Response

describe('chargerRibProfil', () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'jeton' } } })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('premier mode « virement » actif avec IBAN, espaces retirés', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse({
      paiement_modes: [
        { type: 'cheque', actif: true },
        { type: 'virement', actif: false, iban: 'FR76 INACTIF' },
        { type: 'virement', actif: true, iban: '  FR76 3000 4000 0312 3456 7890 143 ', bic: ' BNPAFRPP ' },
      ],
    }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await chargerRibProfil()).toEqual({ iban: 'FR76 3000 4000 0312 3456 7890 143', bic: 'BNPAFRPP' })
    expect(fetchMock).toHaveBeenCalledWith('/api/artisan-payment-info', expect.objectContaining({ headers: { Authorization: 'Bearer jeton' } }))
  })

  it('aucun virement, réponse en erreur, session absente ou réseau coupé : null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({ paiement_modes: [{ type: 'cheque' }] })))
    expect(await chargerRibProfil()).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({}, false)))
    expect(await chargerRibProfil()).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('hors ligne')))
    expect(await chargerRibProfil()).toBeNull()
    getSession.mockResolvedValue({ data: { session: null } })
    const sansSession = vi.fn()
    vi.stubGlobal('fetch', sansSession)
    expect(await chargerRibProfil()).toBeNull()
    expect(sansSession).not.toHaveBeenCalled()
  })

  it('le délai borne toute la lecture, session comprise : l\'émission n\'attend jamais plus', async () => {
    vi.useFakeTimers()
    try {
      // Session qui ne répond pas (verrou, rafraîchissement du jeton sur réseau lent).
      getSession.mockReturnValue(new Promise(() => {}))
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const lecture = chargerRibProfil(300)
      await vi.advanceTimersByTimeAsync(300)
      expect(await lecture).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()

      // Session lente mais dans le délai : le RIB est lu.
      getSession.mockReturnValue(new Promise((resolve) => setTimeout(() => resolve({ data: { session: { access_token: 'jeton' } } }), 200)))
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({ paiement_modes: [{ type: 'virement', iban: 'FR76 OK', bic: 'BIC' }] })))
      const seconde = chargerRibProfil(300)
      await vi.advanceTimersByTimeAsync(200)
      expect(await seconde).toEqual({ iban: 'FR76 OK', bic: 'BIC' })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('appliquerRibCourant', () => {
  const facture = { docType: 'facture', clientName: 'Marie Dubois', iban: 'FR76 ANCIEN', bic: 'ANCIENBIC' }

  it('RIB lu : il remplace celui hérité du devis', () => {
    expect(appliquerRibCourant(facture, { iban: 'FR76 NOUVEAU', bic: 'NOUVEAUBIC' })).toEqual({ docType: 'facture', clientName: 'Marie Dubois', iban: 'FR76 NOUVEAU', bic: 'NOUVEAUBIC' })
  })

  it('RIB illisible : le RIB hérité est retiré (le téléchargement relit le profil), sans modifier l\'original', () => {
    expect(appliquerRibCourant(facture, null)).toEqual({ docType: 'facture', clientName: 'Marie Dubois' })
    expect(facture.iban).toBe('FR76 ANCIEN')
  })
})
