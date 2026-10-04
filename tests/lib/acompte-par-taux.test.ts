// tests/lib/acompte-par-taux.test.ts
//
// Facture d'acompte BTP : UNE ligne de synthèse par taux de TVA (lib/acompte-par-taux.ts).
// La somme des lignes vaut exactement le pourcentage du total HT du parent, au centime ;
// autoliquidation et franchise : une seule ligne, sans taux. Côté artisan, c'est toujours
// buildAcomptePrefill (mise à l'échelle des lignes) qui s'applique.

import { describe, it, expect } from 'vitest'
import {
  additionnerBases,
  basesHtParTaux,
  buildAcompteLinesParTaux,
  buildAcompteParTauxPrefill,
  dateDuJourLocale,
  recalculerTotauxLignes,
  repartirPourcentageParTaux,
} from '../../lib/acompte-par-taux'
import { buildAcomptePrefill } from '../../lib/acompte-prefill'
import { computeDocumentTotalHT, negateDocumentLines } from '../../lib/devis-totals'
import { computeTva } from '../../lib/tva-calculator'

const ligne = (id: number, totalHT: number, tvaRate: number, description = `Ligne ${id}`) => ({
  id, description, qty: 1, unit: 'u', priceHT: totalHT, tvaRate, totalHT,
})

// Devis multi-taux : travaux 10 %, fournitures 20 %, rénovation énergétique 5,5 % (lot).
const DEVIS_MULTI_TAUX = {
  id: 'dev-1', docType: 'devis', docNumber: 'DEV-2026-009', docDate: '2026-09-12', docTitle: 'Rénovation appartement',
  clientName: 'Marie Dubois',
  lines: [ligne(1, 10000, 10, 'Main d\'œuvre rénovation'), ligne(2, 4000, 20, 'Fournitures')],
  customTables: [{ id: 't', name: 'Isolation', lines: [ligne(3, 6000, 5.5, 'Isolation thermique')] }],
}

const PARAMS_30 = { percentage: 30, ordre: 1, total: 3, declencheur: 'À la signature' }

const montants = (lignes: { totalHT: number }[]) => lignes.map((l) => l.totalHT)
const tva = (lignes: { totalHT: number; tvaRate: number }[], regime: 'classique' | 'franchise_293b' | 'autoliquidation_btp' = 'classique') =>
  computeTva({ regime, lines: lignes })

describe('buildAcompteLinesParTaux — une ligne par taux de TVA', () => {
  it('devis à trois taux : trois lignes, taux décroissants, libellé officiel', () => {
    const lignes = buildAcompteLinesParTaux(DEVIS_MULTI_TAUX, 20)
    expect(lignes.map((l) => l.tvaRate)).toEqual([20, 10, 5.5])
    expect(montants(lignes)).toEqual([800, 2000, 1200])
    expect(lignes[0].description).toBe('Acompte de 20 % sur travaux soumis à la TVA au taux de 20 %')
    expect(lignes[1].description).toBe('Acompte de 20 % sur travaux soumis à la TVA au taux de 10 %')
    expect(lignes[2].description).toBe('Acompte de 20 % sur travaux soumis à la TVA au taux de 5,5 %')
    expect(lignes[1].lineDetail).toBe('Devis n° DEV-2026-009 du 12/09/2026\nBase HT à ce taux : 10 000,00 €')
    const total = tva(lignes)
    expect(total.totalHT).toBe(4000)
    expect(total.totalTVA).toBe(426)
    expect(total.totalTTC).toBe(4426)
  })

  it.each([
    [30, [1200, 3000, 1800], 639, 6639],
    [50, [2000, 5000, 3000], 1065, 11065],
  ])('à %s %% : bases %j, TVA %s, TTC %s', (pourcentage, attendus, totalTva, totalTtc) => {
    const lignes = buildAcompteLinesParTaux(DEVIS_MULTI_TAUX, pourcentage)
    expect(montants(lignes)).toEqual(attendus)
    expect(tva(lignes).totalTVA).toBe(totalTva)
    expect(tva(lignes).totalTTC).toBe(totalTtc)
  })

  it('chaque ligne : quantité 1, forfait, prix unitaire = total', () => {
    for (const l of buildAcompteLinesParTaux(DEVIS_MULTI_TAUX, 30)) {
      expect(l.qty).toBe(1)
      expect(l.unit).toBe('f')
      expect(l.priceHT).toBe(l.totalHT)
    }
  })

  it('mono-taux : une seule ligne (5 250 + 40 437 à 20 %, acompte 30 % = 13 706,10)', () => {
    const devis = { docType: 'devis', docNumber: 'DEV-2026-010', lines: [ligne(1, 5250, 20)], customTables: [{ id: 't', name: 'Gros œuvre', lines: [ligne(2, 40437, 20)] }] }
    const lignes = buildAcompteLinesParTaux(devis, 30)
    expect(montants(lignes)).toEqual([13706.1])
    expect(tva(lignes).totalTVA).toBe(2741.22)
    expect(tva(lignes).totalTTC).toBe(16447.32)
  })

  it('lignes à quantités : la base par taux est la somme des totaux de ligne', () => {
    const devis = {
      docType: 'devis', docNumber: 'DEV-2026-011',
      lines: [
        { id: 1, description: 'Pose', qty: 7, unit: 'u', priceHT: 12.35, tvaRate: 10, totalHT: 86.45 },
        { id: 2, description: 'Fourniture', qty: 13, unit: 'u', priceHT: 4.99, tvaRate: 10, totalHT: 64.87 },
        { id: 3, description: 'Divers', qty: 3, unit: 'u', priceHT: 33.33, tvaRate: 20, totalHT: 99.99 },
      ],
    }
    const lignes = buildAcompteLinesParTaux(devis, 30)
    expect(montants(lignes)).toEqual([30, 45.39])
    expect(tva(lignes).totalHT).toBe(75.39)
    expect(tva(lignes).totalTVA).toBe(10.54)
    expect(tva(lignes).totalTTC).toBe(85.93)
  })

  it('ligne à 0 % en régime classique : ligne distincte, sans taux dans le libellé', () => {
    const devis = { docType: 'devis', docNumber: 'DEV-2026-012', lines: [ligne(1, 1000, 20), ligne(2, 200, 0, 'Débours')] }
    const lignes = buildAcompteLinesParTaux(devis, 40)
    expect(montants(lignes)).toEqual([400, 80])
    expect(lignes[1].tvaRate).toBe(0)
    expect(lignes[1].description).toBe('Acompte de 40 % sur prestations facturées sans TVA')
    expect(tva(lignes).totalTVA).toBe(80)
    expect(tva(lignes).totalTTC).toBe(560)
  })

  it('lots seuls, ligne vide et matériaux masqués : seules les sections affichées comptent', () => {
    const devis = {
      docType: 'devis', docNumber: 'DEV-2026-013',
      lines: [{ id: 1, description: '', qty: 1, unit: 'u', priceHT: 0, tvaRate: 20, totalHT: 0 }],
      materialLines: [ligne(2, 999, 20, 'Matériaux masqués')],
      materialLinesEnabled: false,
      customTables: [
        { id: 'a', name: 'Lot électricité', lines: [ligne(3, 3500, 10)] },
        { id: 'b', name: 'Lot plomberie', lines: [ligne(4, 8200, 20)] },
      ],
    }
    const lignes = buildAcompteLinesParTaux(devis, 20)
    expect(lignes.map((l) => [l.tvaRate, l.totalHT])).toEqual([[20, 1640], [10, 700]])
    expect(tva(lignes).totalTTC).toBe(2738)
  })

  it('devis sans montant : aucune ligne', () => {
    expect(buildAcompteLinesParTaux({ docType: 'devis', docNumber: 'DEV-2026-014', lines: [ligne(1, 0, 20)] }, 30)).toEqual([])
    expect(buildAcompteLinesParTaux({ docType: 'devis' }, 30)).toEqual([])
  })
})

describe('arrondi au centime — la somme des lignes vaut le pourcentage du total', () => {
  const troisTaux = (montant: number) => ({ docType: 'devis', docNumber: 'DEV-2026-020', lines: [ligne(1, montant, 20), ligne(2, montant, 10), ligne(3, montant, 5.5)] })

  it.each([
    [333.35, 30, [100.01, 100.01, 100], 300.02],
    [333.35, 50, [166.68, 166.68, 166.67], 500.03],
    [100.01, 50, [50.01, 50.01, 50], 150.02],
    [100.01, 33.33, [33.34, 33.33, 33.33], 100],
  ])('3 × %s à %s %% → %j (somme %s)', (montant, pourcentage, attendus, somme) => {
    const lignes = buildAcompteLinesParTaux(troisTaux(montant), pourcentage)
    expect(montants(lignes)).toEqual(attendus)
    expect(computeDocumentTotalHT({ lines: lignes })).toBe(somme)
  })

  it('invariant : somme des parts = arrondi du total × pourcentage, pour une grille de devis', () => {
    const grilles = [
      [{ taux: 20, baseCents: 1 }, { taux: 10, baseCents: 1 }],
      [{ taux: 20, baseCents: 33335 }, { taux: 10, baseCents: 33335 }, { taux: 5.5, baseCents: 33335 }],
      [{ taux: 20, baseCents: 1234567 }, { taux: 10, baseCents: 7654321 }, { taux: 0, baseCents: 999 }],
      [{ taux: 20, baseCents: 500000 }, { taux: 10, baseCents: -12345 }],
    ]
    for (const bases of grilles) {
      const total = bases.reduce((s, b) => s + b.baseCents, 0)
      for (const pourcentage of [1, 20, 30, 33.33, 50, 66.67, 100]) {
        const parts = repartirPourcentageParTaux(bases, pourcentage)
        const attendu = Math.sign(total) * Math.floor((2 * Math.abs(total) * Math.round(pourcentage * 100) + 10000) / 20000)
        expect(parts.reduce((s, p) => s + p.baseCents, 0)).toBe(attendu)
      }
      expect(repartirPourcentageParTaux(bases, 100)).toEqual(bases)
    }
  })
})

describe('montants du devis tels que le formulaire les affiche', () => {
  it('total de ligne périmé sur un devis : la base est quantité × prix unitaire', () => {
    // Prestation changée après saisie de la quantité : le formulaire stockait 1 × prix.
    const devis = { docType: 'devis', docNumber: 'DEV-2026-040', lines: [{ id: 1, description: 'Faïence', qty: 12, unit: 'm2', priceHT: 85, tvaRate: 10, totalHT: 85 }] }
    expect(basesHtParTaux(devis)).toEqual([{ taux: 10, baseCents: 102000 }])
    expect(montants(buildAcompteLinesParTaux(devis, 30))).toEqual([306])
  })

  it('facture émise : le total de ligne facturé fait foi (pas de recalcul)', () => {
    // Ancien acompte mis à l'échelle : 5 × 114,55 ≠ 572,73 facturés.
    const facture = { docType: 'facture', docNumber: 'AC-2026-001', lines: [{ id: 1, description: 'Pose', qty: 5, unit: 'u', priceHT: 114.55, tvaRate: 20, totalHT: 572.73 }] }
    expect(basesHtParTaux(facture)).toEqual([{ taux: 20, baseCents: 57273 }])
  })

  it('recalculerTotauxLignes : toutes les sections, sans modifier le devis', () => {
    const devis = {
      lines: [{ id: 1, description: 'A', qty: 3, priceHT: 0.335, tvaRate: 20, totalHT: 1.005 }],
      materialLines: [{ id: 2, description: 'B', qty: 2, priceHT: 10, tvaRate: 20, totalHT: 10 }],
      customTables: [{ id: 't', name: 'Lot', lines: [{ id: 3, description: 'C', qty: 4, priceHT: 25, tvaRate: 10, totalHT: 25 }] }],
    }
    const avant = JSON.stringify(devis)
    const recalcule = recalculerTotauxLignes(devis)
    expect(recalcule.lines[0].totalHT).toBe(1.01)
    expect(recalcule.materialLines[0].totalHT).toBe(20)
    expect(recalcule.customTables[0].lines[0].totalHT).toBe(100)
    expect(JSON.stringify(devis)).toBe(avant)
  })
})

describe('dernière échéance — la somme des acomptes égale le devis au centime', () => {
  const emettre = (devis: Record<string, unknown>, pourcentages: number[]) => {
    const emis: { pourcentage: number; lignes: { tvaRate: number; totalHT: number }[] }[] = []
    for (const pourcentage of pourcentages) {
      const dejaFacture = {
        pourcentageCumule: emis.reduce((s, a) => s + a.pourcentage, 0),
        basesParTaux: additionnerBases(...emis.map((a) => a.lignes.map((l) => ({ taux: l.tvaRate, baseCents: Math.round(l.totalHT * 100) })))),
      }
      emis.push({ pourcentage, lignes: buildAcompteLinesParTaux(devis, pourcentage, { dejaFacture }) })
    }
    return emis.map((a) => a.lignes)
  }

  it.each([
    [9304.95, [4652.48, 2791.49, 1860.98]], // arrondis un à un : 1 860,99, soit 9 304,96 au total
    [100.03, [50.02, 30.01, 20]],
  ])('devis de %s € en 50 / 30 / 20 : %j', (montant, attendus) => {
    const acomptes = emettre({ docType: 'devis', docNumber: 'DEV-2026-050', lines: [ligne(1, montant, 20)] }, [50, 30, 20])
    expect(acomptes.map((lignes) => lignes[0].totalHT)).toEqual(attendus)
    expect(Math.round(acomptes.reduce((s, lignes) => s + lignes[0].totalHT, 0) * 100)).toBe(Math.round(montant * 100))
  })

  it('exact taux par taux sur un devis à trois taux', () => {
    const devis = { docType: 'devis', docNumber: 'DEV-2026-051', lines: [ligne(1, 333.35, 20), ligne(2, 333.35, 10), ligne(3, 333.35, 5.5)] }
    const acomptes = emettre(devis, [50, 30, 20])
    for (const taux of [20, 10, 5.5]) {
      const cumul = acomptes.reduce((s, lignes) => s + Math.round((lignes.find((l) => l.tvaRate === taux)?.totalHT ?? 0) * 100), 0)
      expect(cumul).toBe(33335)
    }
  })

  it('sans cumul à 100 %, ou si le devis a changé de taux : calcul direct', () => {
    const devis = { docType: 'devis', docNumber: 'DEV-2026-052', lines: [ligne(1, 100.03, 20)] }
    const dejaFacture = { pourcentageCumule: 50, basesParTaux: [{ taux: 20, baseCents: 5002 }] }
    expect(montants(buildAcompteLinesParTaux(devis, 30, { dejaFacture }))).toEqual([30.01]) // cumul 80 %
    const autreTaux = { pourcentageCumule: 80, basesParTaux: [{ taux: 10, baseCents: 8002 }] }
    expect(montants(buildAcompteLinesParTaux(devis, 20, { dejaFacture: autreTaux }))).toEqual([20.01])
  })

  it('devis modifié entre deux acomptes : le libellé « 70 % » reste vrai, pas de reliquat', () => {
    // Acompte de 30 % émis sur 10 000 € (3 000 €), puis devis porté à 12 000 €.
    const devis = { docType: 'devis', docNumber: 'DEV-2026-053', docDate: '2026-09-12', lines: [ligne(1, 12000, 10)] }
    const dejaFacture = { pourcentageCumule: 30, basesParTaux: [{ taux: 10, baseCents: 300000 }], nombre: 1 }
    const lignes = buildAcompteLinesParTaux(devis, 70, { dejaFacture })
    expect(montants(lignes)).toEqual([8400]) // 70 % de 12 000, et non 12 000 − 3 000 = 9 000
    expect(lignes[0].lineDetail).toContain('Base HT à ce taux : 12 000,00 €')
  })

  it('avoir partiel sur le premier acompte : la dernière échéance garde son pourcentage', () => {
    // Acompte de 30 % (3 000 €) réduit à 2 500 € par un avoir : l'échéance « 70 % » vaut 7 000 €.
    const devis = { docType: 'devis', docNumber: 'DEV-2026-054', lines: [ligne(1, 10000, 10)] }
    const dejaFacture = { pourcentageCumule: 30, basesParTaux: [{ taux: 10, baseCents: 250000 }], nombre: 1 }
    expect(montants(buildAcompteLinesParTaux(devis, 70, { dejaFacture }))).toEqual([7000])
  })

  it('écart d\'arrondi seulement : le reliquat est pris (un centime par acompte déjà émis)', () => {
    const devis = { docType: 'devis', docNumber: 'DEV-2026-055', lines: [ligne(1, 100.03, 20)] }
    const dejaFacture = { pourcentageCumule: 80, basesParTaux: [{ taux: 20, baseCents: 8003 }], nombre: 2 }
    expect(montants(buildAcompteLinesParTaux(devis, 20, { dejaFacture }))).toEqual([20]) // 100,03 − 80,03, et non 20,01
  })

  it('anciens acomptes arrondis ligne à ligne (avant ce module) : la dernière échéance solde quand même le devis', () => {
    // 20 lignes à centime impair : chaque ancien acompte de 50 % ou 30 % arrondit chaque ligne
    // vers le haut, d'où plusieurs centimes de trop au cumul.
    const lignes = Array.from({ length: 20 }, (_, i) => ligne(i + 1, 100.01 + i * 2.02, i < 14 ? 10 : 20))
    const devis = { docType: 'devis', docNumber: 'DEV-2026-056', lines: lignes }
    const anciens = [50, 30].map((percentage, i) => buildAcomptePrefill(devis, { percentage, ordre: i + 1, total: 3, declencheur: '' }))
    const dejaFacture = { pourcentageCumule: 80, basesParTaux: additionnerBases(...anciens.map((a) => basesHtParTaux({ ...a, docType: 'facture' }))), nombre: 2 }
    const directes = repartirPourcentageParTaux(basesHtParTaux(devis), 20)
    const derniere = buildAcompteLinesParTaux(devis, 20, { dejaFacture })
    const totalDevis = basesHtParTaux(devis).reduce((s, b) => s + b.baseCents, 0)
    const dejaCents = dejaFacture.basesParTaux.reduce((s, b) => s + b.baseCents, 0)
    const derniereCents = derniere.reduce((s, l) => s + Math.round(l.totalHT * 100), 0)
    expect(dejaCents + derniereCents).toBe(totalDevis) // soldé au centime
    expect(dejaCents + directes.reduce((s, b) => s + b.baseCents, 0)).toBeGreaterThan(totalDevis) // le calcul direct dépasserait
  })
})

describe('pourcentage saisi', () => {
  it('ramené à deux décimales partout : montant, libellé et pourcentage enregistré', () => {
    const devis = { docType: 'devis', docNumber: 'DEV-2026-060', lines: [ligne(1, 10000, 20)] }
    const acompte = buildAcompteParTauxPrefill(devis, { ...PARAMS_30, percentage: 33.333 })
    expect(acompte.acomptePourcentage).toBe(33.33)
    expect((acompte.lines as { totalHT: number; description: string }[])[0]).toMatchObject({ totalHT: 3333, description: 'Acompte de 33,33 % sur travaux soumis à la TVA au taux de 20 %' })
    expect(acompte.docTitle).toBe('Acompte n° 1 sur 3 (33,33 %) — DEV-2026-060')
  })
})

describe('régimes sans TVA facturée', () => {
  it('autoliquidation : une seule ligne HT, sans taux, mention d\'autoliquidation', () => {
    const devis = {
      docType: 'devis', docNumber: 'DEV-2026-030', docDate: '2026-09-01', regimeTva: 'autoliquidation_btp',
      lines: [ligne(1, 12000, 20), ligne(2, 8000, 10)],
    }
    const lignes = buildAcompteLinesParTaux(devis, 30)
    expect(lignes).toHaveLength(1)
    expect(lignes[0].tvaRate).toBe(0)
    expect(lignes[0].totalHT).toBe(6000)
    expect(lignes[0].description).toBe('Acompte de 30 % sur travaux sous-traités — autoliquidation de la TVA')
    const acompte = buildAcompteParTauxPrefill(devis, PARAMS_30)
    expect(acompte.regimeTva).toBe('autoliquidation_btp')
    expect(String(acompte.notes)).toContain('Autoliquidation — Article 283, 2 nonies du CGI')
    expect(String(acompte.notes)).not.toContain('exigible')
  })

  it('franchise en base : une seule ligne, aucun taux, mention 293 B', () => {
    const devis = { docType: 'devis', docNumber: 'DEV-2026-031', tvaEnabled: false, lines: [ligne(1, 1000, 20), ligne(2, 500, 10)] }
    const lignes = buildAcompteLinesParTaux(devis, 30)
    expect(lignes).toHaveLength(1)
    expect(lignes[0].tvaRate).toBe(0)
    expect(lignes[0].totalHT).toBe(450)
    expect(lignes[0].description).toBe('Acompte de 30 % sur travaux')
    // Ni « HT » ni taux en franchise : aucune TVA n'est facturée.
    expect(lignes[0].lineDetail).toBe('Devis n° DEV-2026-031\nMontant des travaux : 1 500,00 €')
    expect(String(buildAcompteParTauxPrefill(devis, PARAMS_30).notes)).toContain('TVA non applicable, article 293 B du CGI')
  })

  it('ancien document sans regimeTva mais marqué autoliquidationBTP : traité en autoliquidation', () => {
    const devis = { docType: 'devis', docNumber: 'DEV-2026-032', autoliquidationBTP: true, lines: [ligne(1, 1000, 20)] }
    expect(basesHtParTaux(devis)).toEqual([{ taux: 0, baseCents: 100000 }])
  })
})

describe('locale portugaise', () => {
  it('taux réels des lignes, libellés en portugais', () => {
    const devis = {
      docType: 'devis', docNumber: 'ORC-2026-004', docDate: '2026-09-12', docTitle: 'Remodelação',
      lines: [ligne(1, 5000, 6), ligne(2, 2499.99, 23), ligne(3, 1200.5, 13)],
    }
    const lignes = buildAcompteLinesParTaux(devis, 30, { locale: 'pt' })
    expect(lignes.map((l) => [l.tvaRate, l.totalHT])).toEqual([[23, 750], [13, 360.15], [6, 1500]])
    expect(lignes[0].description).toBe('Adiantamento de 30 % por conta dos trabalhos sujeitos a IVA à taxa de 23 %')
    expect(lignes[0].lineDetail).toBe('Orçamento n.º ORC-2026-004 de 12/09/2026\nBase tributável a esta taxa: 2 499,99 €')
    expect(tva(lignes).totalHT).toBe(2610.15)
    expect(tva(lignes).totalTVA).toBe(309.32)
    expect(tva(lignes).totalTTC).toBe(2919.47)
    const acompte = buildAcompteParTauxPrefill(devis, PARAMS_30, { locale: 'pt' })
    expect(acompte.docTitle).toBe('Adiantamento n.º 1 de 3 (30 %) — Remodelação')
    expect(acompte.linesName).toBe('Adiantamento')
  })
})

describe('buildAcompteParTauxPrefill — forme du document', () => {
  it('métadonnées de l\'acompte conservées, collections remplacées par les lignes par taux', () => {
    const parent = { ...DEVIS_MULTI_TAUX, materialLines: [ligne(9, 100, 20)], fraisLines: [ligne(10, 50, 20)], discount: '10', acomptesEnabled: true, acomptes: [{ id: 'a', ordre: 1, label: 'Signature', pourcentage: 30, declencheur: 'À la signature' }] }
    const avant = JSON.stringify(parent)
    const acompte = buildAcompteParTauxPrefill(parent, PARAMS_30)
    expect(JSON.stringify(parent)).toBe(avant) // parent non muté
    expect(acompte.docType).toBe('facture')
    expect(acompte.factureSubType).toBe('acompte')
    expect(acompte.docNumber).toBe('')
    expect(acompte.docDate).toBe(dateDuJourLocale()) // date du poste, pas la date UTC
    expect(acompte.docDate).not.toBe(parent.docDate)
    expect(acompte.acompteOrdre).toBe(1)
    expect(acompte.acompteTotal).toBe(3)
    expect(acompte.acomptePourcentage).toBe(30)
    expect(acompte.parentInvoiceNumber).toBe('DEV-2026-009')
    expect(acompte.sourceDevisNumber).toBe('DEV-2026-009')
    expect(acompte.acomptesEnabled).toBe(false)
    expect(acompte.acomptes).toEqual([])
    expect(acompte.laborLines).toBeUndefined()
    expect(acompte.materialLines).toEqual([])
    expect(acompte.fraisLines).toEqual([])
    expect(acompte.fraisAnnexes).toEqual([])
    expect(acompte.customTables).toEqual([])
    expect(acompte.discount).toBe('')
    expect(acompte.regimeTva).toBe('classique')
    expect(acompte.docTitle).toBe('Acompte n° 1 sur 3 (30 %) — Rénovation appartement')
    expect(acompte.notes).toBe('Acompte de 30 % (n° 1 sur 3) sur le devis n° DEV-2026-009 du 12/09/2026. Échéance : À la signature.')
    // 30 % de (10 000 + 4 000 + 6 000 + 100 + 50) = 6 045,00
    expect(computeDocumentTotalHT(acompte as Parameters<typeof computeDocumentTotalHT>[0])).toBe(6045)
  })

  it('texte des lignes : désignation sur une ligne, sans crochets ni espace insécable, 200 caractères au plus', () => {
    const acompte = buildAcompteParTauxPrefill(DEVIS_MULTI_TAUX, { ...PARAMS_30, percentage: 33.33 })
    for (const l of acompte.lines as { description: string; lineDetail: string }[]) {
      for (const texte of [l.description, l.lineDetail]) {
        expect(texte).not.toMatch(/[\[\]  ]/)
        expect(texte.length).toBeLessThanOrEqual(200)
      }
      // Le PDF ne garde que la première ligne d'une désignation ; le détail tient en deux lignes courtes.
      expect(l.description).not.toContain('\n')
      expect(l.lineDetail.split('\n')).toHaveLength(2)
      expect(l.description.startsWith('Acompte de 33,33 % sur travaux')).toBe(true)
    }
  })

  it('acompte tiré d\'une facture : la référence cite la facture', () => {
    const facture = { ...DEVIS_MULTI_TAUX, docType: 'facture', docNumber: 'FACT-2026-021' }
    const acompte = buildAcompteParTauxPrefill(facture, PARAMS_30)
    expect((acompte.lines as { lineDetail: string }[])[0].lineDetail).toContain('Facture n° FACT-2026-021 du 12/09/2026')
    expect(String(acompte.notes)).toContain('sur la facture n° FACT-2026-021')
  })

  it('avoir d\'un acompte par taux : une ligne négative par taux, total opposé', () => {
    const acompte = buildAcompteParTauxPrefill(DEVIS_MULTI_TAUX, PARAMS_30)
    const avoir = negateDocumentLines(acompte as Parameters<typeof negateDocumentLines>[0])
    expect((avoir.lines as { totalHT: number }[]).map((l) => l.totalHT)).toEqual([-1200, -3000, -1800])
    expect(computeDocumentTotalHT(avoir)).toBe(-6000)
  })
})

describe('règle n° 1 — le côté artisan n\'est pas concerné', () => {
  it('buildAcomptePrefill garde les lignes d\'origine mises à l\'échelle', () => {
    const acompte = buildAcomptePrefill(DEVIS_MULTI_TAUX, PARAMS_30)
    const lignes = acompte.lines as { description: string; totalHT: number }[]
    expect(lignes.map((l) => l.description)).toEqual(['Main d\'œuvre rénovation', 'Fournitures'])
    expect(lignes.map((l) => l.totalHT)).toEqual([3000, 1200])
    expect((acompte.customTables as unknown[]).length).toBe(1)
  })
})
