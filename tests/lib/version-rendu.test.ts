// Marque « rendu complet » des documents artisan (lib/version-rendu.ts) : posée sur un document nouveau,
// jamais sur un document d'avant la correction (qui se réimprime à l'identique) ; un document tiré d'un
// autre suit son document d'origine ; un duplicata est un document nouveau.
import { describe, it, expect } from 'vitest'
import {
  champVersionRendu, renduComplet, versionRenduAuDepart, VERSION_RENDU_COMPLET, VERSION_RENDU_ORIGINE,
} from '@/lib/version-rendu'
import { buildAcomptePrefill } from '@/lib/acompte-prefill'

const ANCIEN_DEVIS = {
  id: '6f1c2a34-0000-4000-8000-00000000b001', docType: 'devis', docNumber: 'DEV-2026-010', status: 'envoye',
  savedAt: '2026-10-02T10:00:00.000Z', clientName: 'M. Test',
  lines: [{ id: 1, description: 'Pose', qty: 1, unit: 'u', priceHT: 1000, tvaRate: 10, totalHT: 1000 }],
}
const DEVIS_COMPLET = { ...ANCIEN_DEVIS, versionRendu: VERSION_RENDU_COMPLET }

describe('versionRenduAuDepart', () => {
  it('document nouveau (création) : rendu complet', () => {
    expect(versionRenduAuDepart(undefined)).toBe(VERSION_RENDU_COMPLET)
    expect(versionRenduAuDepart({})).toBe(VERSION_RENDU_COMPLET)
    expect(versionRenduAuDepart({ docNumber: '' })).toBe(VERSION_RENDU_COMPLET)
  })

  it('document d avant la correction (identifiant, horodatage ou numéro) : rendu d origine', () => {
    expect(versionRenduAuDepart({ id: 'x' })).toBe(VERSION_RENDU_ORIGINE)
    expect(versionRenduAuDepart({ savedAt: '2026-10-02T10:00:00.000Z' })).toBe(VERSION_RENDU_ORIGINE)
    expect(versionRenduAuDepart({ docNumber: 'FACT-2026-001' })).toBe(VERSION_RENDU_ORIGINE)
  })

  it('la marque d un document est gardée', () => {
    expect(versionRenduAuDepart(DEVIS_COMPLET)).toBe(VERSION_RENDU_COMPLET)
    expect(versionRenduAuDepart({ versionRendu: VERSION_RENDU_ORIGINE })).toBe(VERSION_RENDU_ORIGINE)
  })

  it('duplicata : document nouveau, rendu complet, même tiré d un document marqué « origine »', () => {
    expect(versionRenduAuDepart({ ...ANCIEN_DEVIS, isDuplicate: true })).toBe(VERSION_RENDU_COMPLET)
    expect(versionRenduAuDepart({ id: 'y', versionRendu: VERSION_RENDU_ORIGINE, isDuplicate: true })).toBe(VERSION_RENDU_COMPLET)
  })

  it('document tiré d un document sans marque (facture d un devis, acompte, avoir) : rendu d origine', () => {
    expect(versionRenduAuDepart({ docType: 'facture', sourceDevisNumber: 'DEV-2026-010' })).toBe(VERSION_RENDU_ORIGINE)
    expect(versionRenduAuDepart({ docType: 'facture', sourceDevisId: ANCIEN_DEVIS.id })).toBe(VERSION_RENDU_ORIGINE)
    expect(versionRenduAuDepart({ docType: 'facture', acompteDeFactureId: 'f1' })).toBe(VERSION_RENDU_ORIGINE)
    expect(versionRenduAuDepart({ docType: 'facture', avoirDeFactureId: 'f1', parentInvoiceNumber: 'FACT-2026-001' })).toBe(VERSION_RENDU_ORIGINE)
  })

  it('document tiré d un document au rendu complet : il en recopie la marque', () => {
    expect(versionRenduAuDepart({ docType: 'facture', sourceDevisNumber: 'DEV-2026-011', versionRendu: VERSION_RENDU_COMPLET }))
      .toBe(VERSION_RENDU_COMPLET)
  })

  it('acompte préparé depuis un devis (lib/acompte-prefill.ts) : suit son devis', () => {
    const p = { percentage: 30, ordre: 1, total: 2, declencheur: 'À la signature' }
    expect(versionRenduAuDepart(buildAcomptePrefill(ANCIEN_DEVIS, p))).toBe(VERSION_RENDU_ORIGINE)
    expect(versionRenduAuDepart(buildAcomptePrefill(DEVIS_COMPLET, p))).toBe(VERSION_RENDU_COMPLET)
  })
})

describe('champVersionRendu (valeur enregistrée)', () => {
  it('document au rendu complet : marque posée', () => {
    expect(champVersionRendu(undefined, VERSION_RENDU_COMPLET)).toBe(VERSION_RENDU_COMPLET)
    expect(champVersionRendu({ versionRendu: VERSION_RENDU_ORIGINE }, VERSION_RENDU_COMPLET)).toBe(VERSION_RENDU_COMPLET)
  })

  it('document d avant la correction : aucun champ ajouté (données inchangées)', () => {
    expect(champVersionRendu(ANCIEN_DEVIS, VERSION_RENDU_ORIGINE)).toBeUndefined()
    expect(champVersionRendu({ sourceDevisNumber: 'DEV-2026-010' } as never, VERSION_RENDU_ORIGINE)).toBeUndefined()
  })

  it('marque « origine » déjà posée : gardée telle quelle', () => {
    expect(champVersionRendu({ versionRendu: VERSION_RENDU_ORIGINE }, VERSION_RENDU_ORIGINE)).toBe(VERSION_RENDU_ORIGINE)
  })
})

describe('renduComplet', () => {
  it('vrai seulement pour une marque numérique d au moins 2', () => {
    expect(renduComplet(DEVIS_COMPLET)).toBe(true)
    expect(renduComplet({ versionRendu: 3 })).toBe(true)
    expect(renduComplet(ANCIEN_DEVIS)).toBe(false)
    expect(renduComplet({ versionRendu: VERSION_RENDU_ORIGINE })).toBe(false)
    expect(renduComplet({ versionRendu: '2' })).toBe(false)
    expect(renduComplet(null)).toBe(false)
  })
})
