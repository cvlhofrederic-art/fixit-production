// Remise commerciale dans les calculs partagés des documents : TVA (computeTva), total HT des
// listes et de la base (computeDocumentTotalHT), acomptes (artisan mis à l'échelle, BTP une ligne
// par taux), avoir (négation), facture de solde depuis un devis BTP (acomptes déduits après la
// remise). Les documents sans remise sont couverts par les tests existants de chaque module.

import { describe, it, expect } from 'vitest'
import { computeTva } from '../../lib/tva-calculator'
import { buildDocumentLines, computeDocumentTotalHT, ID_TABLE_ACOMPTES_DEDUITS as ID_DEDUCTIONS, negateDocumentLines, remisesEnPourcentage, scaleDocumentLines } from '../../lib/devis-totals'
import { montantNetLigne } from '../../lib/remise-commerciale'
import { montantTtcDocumentEnregistre } from '../../components/dashboard/messagerie/documents-enregistres'
import { buildAcomptePrefill } from '../../lib/acompte-prefill'
import { basesHtParTaux, buildAcompteParTauxPrefill } from '../../lib/acompte-par-taux'
import { buildFactureDepuisDevis, ID_TABLE_ACOMPTES_DEDUITS } from '../../lib/facture-depuis-devis'

type Doc = Record<string, unknown>

const ligne = (id: number, totalHT: number, tvaRate: number, extra: Doc = {}) => ({
  id, description: `Ligne ${id}`, qty: 1, unit: 'u', priceHT: totalHT, tvaRate, totalHT, ...extra,
})
const totalHT = (doc: Doc) => computeDocumentTotalHT(doc as Parameters<typeof computeDocumentTotalHT>[0])

// Devis BTP : 6 200 € HT (4 500 € à 10 %, 1 700 € à 20 %), remise globale de 10 %.
const DEVIS: Doc = {
  id: '6f1c2a34-0000-4000-8000-000000000009', docType: 'devis', docNumber: 'DEV-2026-020', docDate: '2026-09-12',
  docTitle: 'Rénovation', status: 'envoye', clientName: 'Marie Dubois', clientType: 'particulier',
  regimeTva: 'classique', tvaEnabled: true,
  lines: [ligne(1, 3000, 10), ligne(2, 1200, 20)],
  materialLines: [ligne(3, 420, 20)],
  fraisLines: [ligne(4, 80, 20)],
  customTables: [{ id: 'lot-1', name: 'Lot électricité', lines: [ligne(5, 1500, 10)] }],
  remiseGlobale: { type: 'pourcentage', valeur: 10 },
}

describe('computeTva avec remise globale', () => {
  const lignes = [{ totalHT: 1000, tvaRate: 20 }, { totalHT: 500, tvaRate: 10 }]

  it('la TVA de chaque taux porte sur sa base remisée', () => {
    const r = computeTva({ regime: 'classique', lines: lignes, remiseGlobale: { type: 'pourcentage', valeur: 10 } })
    expect(r.totalHTBrut).toBe(1500)
    expect(r.remiseHT).toBe(150)
    expect(r.totalHT).toBe(1350)
    expect(r.breakdown).toEqual([{ rate: 10, base: 450, amount: 45 }, { rate: 20, base: 900, amount: 180 }])
    expect(r.totalTVA).toBe(225)
    expect(r.totalTTC).toBe(1575)
    expect(r.invariantOk).toBe(true)
  })

  it('franchise et autoliquidation : total net remisé, sans TVA', () => {
    for (const regime of ['franchise_293b', 'autoliquidation_btp'] as const) {
      const r = computeTva({ regime, lines: lignes, remiseGlobale: { type: 'montant', valeur: 100 } })
      expect(r.totalHT).toBe(1400)
      expect(r.totalTTC).toBe(1400)
      expect(r.totalTVA).toBe(0)
      expect(r.remiseHT).toBe(100)
    }
  })

  it('sans remise : mêmes totaux qu avant, remise nulle', () => {
    const sans = computeTva({ regime: 'classique', lines: lignes })
    const nulle = computeTva({ regime: 'classique', lines: lignes, remiseGlobale: { type: 'pourcentage', valeur: 0 } })
    expect(nulle).toEqual(sans)
    expect(sans.totalHTBrut).toBe(sans.totalHT)
    expect(sans.remiseHT).toBe(0)
    expect(sans.totalTTC).toBe(1750)
  })

  it('un avoir remisé solde sa facture taux par taux, au centime', () => {
    const facture = [{ totalHT: 333.33, tvaRate: 20 }, { totalHT: 333.33, tvaRate: 10 }, { totalHT: 333.34, tvaRate: 5.5 }]
    const avoir = facture.map((l) => ({ ...l, totalHT: -l.totalHT }))
    const remise = { type: 'montant', valeur: 100 }
    const f = computeTva({ regime: 'classique', lines: facture, remiseGlobale: remise })
    const a = computeTva({ regime: 'classique', lines: avoir, remiseGlobale: remise })
    expect(a.totalTTC).toBe(-f.totalTTC)
    expect(a.breakdown.map((b) => [b.rate, -b.base, -b.amount])).toEqual(f.breakdown.map((b) => [b.rate, b.base, b.amount]))
  })
})

describe('computeDocumentTotalHT et mise à l échelle', () => {
  it('le total HT du document déduit la remise globale', () => {
    expect(totalHT(DEVIS)).toBe(5580)
    expect(totalHT({ ...DEVIS, remiseGlobale: { type: 'montant', valeur: 200 } })).toBe(6000)
    expect(totalHT({ ...DEVIS, remiseGlobale: undefined })).toBe(6200)
  })

  it('les lignes hors remise restent hors de la base de la remise', () => {
    const doc = { lines: [ligne(1, 1000, 20), ligne(2, -300, 20, { horsRemise: true })], remiseGlobale: { type: 'pourcentage', valeur: 10 } }
    expect(totalHT(doc)).toBe(600)
  })

  it('acompte artisan : la remise en euros suit le pourcentage, celle en % ne bouge pas', () => {
    const doc = { lines: [ligne(1, 1000, 20, { remise: { type: 'montant', valeur: 50 }, totalHT: 950 })], remiseGlobale: { type: 'montant', valeur: 300 } }
    const acompte = scaleDocumentLines(doc as Parameters<typeof scaleDocumentLines>[0], 0.3) as Doc
    expect(acompte.remiseGlobale).toEqual({ type: 'montant', valeur: 90 })
    expect((acompte.lines as Doc[])[0].remise).toEqual({ type: 'montant', valeur: 15 })
    expect(totalHT(acompte)).toBe(195) // 30 % de (950 − 300)
    const enPourcentage = scaleDocumentLines({ ...doc, remiseGlobale: { type: 'pourcentage', valeur: 5 } } as Parameters<typeof scaleDocumentLines>[0], 0.3) as Doc
    expect(enPourcentage.remiseGlobale).toEqual({ type: 'pourcentage', valeur: 5 })
  })

  it('avoir : la remise reste positive et le total est exactement l opposé', () => {
    const facture = { ...DEVIS, docType: 'facture', remiseGlobale: { type: 'montant', valeur: 123.45 } }
    const avoir = negateDocumentLines(facture as Parameters<typeof negateDocumentLines>[0]) as Doc
    expect(avoir.remiseGlobale).toEqual({ type: 'montant', valeur: 123.45 })
    expect(totalHT(avoir)).toBe(-totalHT(facture))
  })

  it('buildAcomptePrefill (artisan) : acompte = pourcentage du total remisé', () => {
    const acompte = buildAcomptePrefill(DEVIS, { percentage: 30, ordre: 1, total: 3, declencheur: 'À la signature' })
    expect(totalHT(acompte)).toBe(1674)
  })
})

describe('BTP : acompte par taux et facture de solde', () => {
  it('les bases par taux du devis sont remisées', () => {
    expect(basesHtParTaux(DEVIS)).toEqual([{ taux: 20, baseCents: 153000 }, { taux: 10, baseCents: 405000 }])
  })

  it('remise de ligne : le devis est recalculé avec la remise de la ligne', () => {
    const devis = { ...DEVIS, remiseGlobale: undefined, lines: [ligne(1, 3000, 10), ligne(2, 1200, 20, { remise: { type: 'pourcentage', valeur: 50 } })] }
    expect(basesHtParTaux(devis)).toEqual([{ taux: 20, baseCents: 110000 }, { taux: 10, baseCents: 450000 }])
  })

  it('l acompte porte 30 % des bases remisées et ne garde pas la remise globale', () => {
    const acompte = buildAcompteParTauxPrefill(DEVIS, { percentage: 30, ordre: 1, total: 3, declencheur: 'À la signature' })
    expect(acompte.remiseGlobale).toBeUndefined()
    expect((acompte.lines as Doc[]).map((l) => [l.tvaRate, l.totalHT])).toEqual([[20, 459], [10, 1215]])
    expect(totalHT(acompte)).toBe(1674)
  })

  it('facture de solde : la remise porte sur les travaux, l acompte se déduit ensuite', () => {
    const acompte = {
      ...buildAcompteParTauxPrefill(DEVIS, { percentage: 30, ordre: 1, total: 3, declencheur: 'À la signature' }),
      id: 'ac-FA-1', docNumber: 'FA-2026-001', status: 'envoye', docDate: '2026-09-15',
    }
    const resultat = buildFactureDepuisDevis(DEVIS, { factures: [acompte], aujourdHui: '2026-10-04' })
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    const facture = resultat.payload
    expect(facture.remiseGlobale).toEqual({ type: 'pourcentage', valeur: 10 })
    const deduction = (facture.customTables as Array<{ id: string; lines: Doc[] }>).find((t) => t.id === ID_TABLE_ACOMPTES_DEDUITS)
    expect(deduction?.lines.every((l) => l.horsRemise === true)).toBe(true)
    expect(totalHT(facture)).toBe(3906) // 5 580 − 1 674
    expect(resultat.totalHtCents).toBe(390600)
    const lignes = [
      ...(facture.lines as Doc[]), ...(facture.materialLines as Doc[]), ...(facture.fraisLines as Doc[]),
      ...(facture.customTables as Array<{ lines: Doc[] }>).flatMap((t) => t.lines),
    ].map((l) => ({ totalHT: Number(l.totalHT), tvaRate: Number(l.tvaRate), horsRemise: l.horsRemise === true }))
    const tva = computeTva({ regime: 'classique', lines: lignes, remiseGlobale: facture.remiseGlobale })
    expect(tva.breakdown.map((b) => [b.rate, b.base])).toEqual([[10, 2835], [20, 1071]])
  })
})

describe('avoir : remises en euros converties en pourcentages', () => {
  // Facture : A 1 000 € (remise de ligne 150 €, net 850) + B 100 € ; remise globale 200 € sur 950 → 750 € HT.
  const FACTURE: Doc = {
    docType: 'facture', regimeTva: 'classique', tvaEnabled: true,
    lines: [
      ligne(1, 850, 20, { priceHT: 1000, remise: { type: 'montant', valeur: 150 } }),
      ligne(2, 100, 20),
    ],
    remiseGlobale: { type: 'montant', valeur: 200 },
  }
  const avoirDe = (facture: Doc) => remisesEnPourcentage(negateDocumentLines(facture as Parameters<typeof negateDocumentLines>[0])) as Doc
  const tvaDe = (doc: Doc) => computeTva({
    regime: 'classique',
    lines: (doc.lines as Doc[]).map((l) => ({ totalHT: Number(l.totalHT), tvaRate: Number(l.tvaRate) })),
    remiseGlobale: doc.remiseGlobale,
  })

  it('avoir total : exactement l opposé de la facture, au centime et taux par taux', () => {
    const avoir = avoirDe(FACTURE)
    expect(totalHT(FACTURE)).toBe(750)
    expect(totalHT(avoir)).toBe(-750)
    expect(tvaDe(avoir).totalTTC).toBe(-tvaDe(FACTURE).totalTTC)
    expect((avoir.remiseGlobale as { type: string }).type).toBe('pourcentage')
    expect(((avoir.lines as Doc[])[0].remise as { type: string }).type).toBe('pourcentage')
  })

  it('avoir partiel (ligne A retirée) : la remise suit, au lieu de tout annuler', () => {
    const avoir = avoirDe(FACTURE)
    const partiel = { ...avoir, lines: [(avoir.lines as Doc[])[1]] }
    // B seul : -100 € moins 200/950 de remise globale = -78,95 € HT (avant : 0 €, remise plafonnée à la base).
    expect(totalHT(partiel)).toBe(-78.95)
  })

  it('avoir partiel (quantité réduite) : la remise de ligne suit la quantité', () => {
    const facture: Doc = { docType: 'facture', lines: [ligne(1, 850, 20, { qty: 10, priceHT: 100, remise: { type: 'montant', valeur: 150 } })] }
    const avoir = avoirDe(facture)
    const l = (avoir.lines as Doc[])[0]
    // 5 unités sur 10 : -500 € moins 15 % = -425 € (avant : -500 + 150 = -350 €).
    expect(montantNetLigne(5, Number(l.priceHT), l.remise)).toBe(-425)
  })

  it('sans remise en euros : document rendu tel quel', () => {
    const doc = { lines: [ligne(1, 100, 20)], remiseGlobale: { type: 'pourcentage', valeur: 5 } }
    expect(remisesEnPourcentage(doc as Parameters<typeof remisesEnPourcentage>[0])).toEqual(doc)
  })
})

describe('cohérence au centime des totaux enregistrés', () => {
  it('lignes au total non arrondi + remise : HT + TVA = TTC entre computeDocumentTotalHT et computeTva', () => {
    const doc = { lines: [ligne(1, 4.005, 20), ligne(2, 4.005, 20)], remiseGlobale: { type: 'pourcentage', valeur: 10 } }
    const tva = computeTva({ regime: 'classique', lines: doc.lines.map((l) => ({ totalHT: l.totalHT, tvaRate: l.tvaRate })), remiseGlobale: doc.remiseGlobale })
    expect(totalHT(doc)).toBe(tva.totalHT)
    expect(Math.round(tva.totalHT * 100) + Math.round(tva.totalTVA * 100)).toBe(Math.round(tva.totalTTC * 100))
  })
})

describe('messagerie : montant TTC d un document remisé', () => {
  it('même calcul que la liste des factures', () => {
    const doc = {
      docType: 'devis', regimeTva: 'classique' as const,
      lines: [ligne(1, 1000, 20), ligne(2, 500, 10)],
      remiseGlobale: { type: 'pourcentage', valeur: 10 },
    }
    expect(montantTtcDocumentEnregistre(doc, 'pro_societe')).toBe(1575)
    expect(montantTtcDocumentEnregistre(doc, 'artisan')).toBe(1575)
    expect(montantTtcDocumentEnregistre({ ...doc, remiseGlobale: undefined }, 'pro_societe')).toBe(1750)
  })
})

describe('facture de solde : table des acomptes déduits hors de la base de la remise', () => {
  const solde = (remiseGlobale?: unknown): Doc => ({
    docType: 'facture', regimeTva: 'classique', tvaEnabled: true,
    lines: [ligne(1, 10000, 20)],
    customTables: [{ id: ID_DEDUCTIONS, name: 'Acomptes déjà facturés (à déduire)', lines: [
      // Déduction ajoutée à la main dans le formulaire : sans marque horsRemise.
      ligne(101, -3000, 20),
    ] }],
    remiseGlobale,
  })

  it('une déduction ajoutée à la main reste hors de la base de la remise', () => {
    // 10 000 − 10 % = 9 000, puis − 3 000 d'acompte = 6 000 € HT (et non 10 % de 7 000).
    expect(totalHT(solde({ type: 'pourcentage', valeur: 10 }))).toBe(6000)
    const lignes = buildDocumentLines(solde({ type: 'pourcentage', valeur: 10 }) as Parameters<typeof buildDocumentLines>[0])
    expect(lignes.map((l) => l.horsRemise === true)).toEqual([false, true])
  })

  it('sans remise globale : lignes rendues telles quelles (aucune donnée changée)', () => {
    const doc = solde(undefined)
    const lignes = buildDocumentLines(doc as Parameters<typeof buildDocumentLines>[0])
    expect(lignes[1]).toBe((doc.customTables as Array<{ lines: Doc[] }>)[0].lines[0])
    expect('horsRemise' in lignes[1]).toBe(false)
  })
})

describe('escompte du PDF artisan : acompte et avoir reprennent la marque du parent', () => {
  it('acompte tiré d un document non marqué : pas d escompte', () => {
    expect(buildAcomptePrefill({ ...DEVIS, escompteSurPdf: undefined }, { percentage: 30, ordre: 1, total: 3, declencheur: 'Signature' }).escompteSurPdf).toBe(false)
    expect(buildAcomptePrefill({ ...DEVIS, escompteSurPdf: true }, { percentage: 30, ordre: 1, total: 3, declencheur: 'Signature' }).escompteSurPdf).toBe(true)
  })
})
