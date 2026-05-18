// tests/lib/devis-totals.test.ts — Robustesse de computeDocumentTotalHT
// face à du localStorage corrompu (null lines, customTables invalides, etc.).
//
// Régression : avant le plan magical-mapping-karp, un draftFacture créé via
// handleGoToConvertedFacture puis interrompu laissait du `null` dans
// `customTables` / `lines`, faisant crasher FacturesSection (BTP V5) à
// chaque chargement de la section factures.

import { describe, it, expect } from 'vitest'
import { computeDocumentTotalHT, computeDocumentTotalHtCents } from '@/lib/devis-totals'

describe('computeDocumentTotalHT — robustesse nullish', () => {
  it('retourne 0 si doc est null', () => {
    expect(computeDocumentTotalHT(null)).toBe(0)
  })

  it('retourne 0 si doc est undefined', () => {
    expect(computeDocumentTotalHT(undefined)).toBe(0)
  })

  it('ignore les lignes null dans `lines`', () => {
    const doc = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lines: [null as any, { totalHT: 100 }, undefined as any, { totalHT: 50 }],
    }
    expect(computeDocumentTotalHT(doc)).toBe(150)
  })

  it('ignore les entrées null dans customTables (cas crash BTP V5)', () => {
    const doc = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customTables: [null as any, { lines: [{ totalHT: 200 }] }],
    }
    expect(computeDocumentTotalHT(doc)).toBe(200)
  })

  it('ignore customTables[i].lines null', () => {
    const doc = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customTables: [{ lines: null as any }, { lines: [{ totalHT: 80 }, null as any] }],
    }
    expect(computeDocumentTotalHT(doc)).toBe(80)
  })

  it('somme labor + material + frais + custom + fraisAnnexes en ignorant les null à chaque niveau', () => {
    const doc = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lines: [null as any, { totalHT: 10 }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      materialLines: [{ totalHT: 20 }, null as any],
      fraisLines: [{ totalHT: 30 }],
      fraisAnnexes: [{ totalHT: 5 }],
      customTables: [
        { lines: [{ totalHT: 40 }] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any,
        { lines: [{ totalHT: 50 }] },
      ],
    }
    expect(computeDocumentTotalHT(doc)).toBe(155)
  })

  it('respecte la priorité laborLines > lines (legacy BTP)', () => {
    const doc = {
      laborLines: [{ totalHT: 100 }],
      lines: [{ totalHT: 999 }], // doit être ignoré car laborLines présent
      materialLines: [{ totalHT: 50 }],
    }
    expect(computeDocumentTotalHT(doc)).toBe(150)
  })

  it('ne crash jamais sur structure totalement bizarre', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = { lines: 'not-an-array' as any, customTables: 42 as any }
    expect(computeDocumentTotalHT(doc)).toBe(0)
  })

  it('computeDocumentTotalHtCents convertit en centimes sans crash sur null', () => {
    const doc = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lines: [null as any, { totalHT: 12.34 }],
    }
    expect(computeDocumentTotalHtCents(doc)).toBe(1234)
  })
})

// Invariant : pour tout devis BTP, la somme des sous-totaux des sections
// effectivement rendues dans le PDF (rendu V3 : `devis-pdf-v3.ts:1109,1112`
// filtre `materialLinesEnabled` / `fraisLinesEnabled` à false) doit être
// égale au sous-total HT global. Sans ce filtre, des « lignes phantom »
// survivant dans `materialLines` / `fraisLines` après masquage UI gonflent
// silencieusement le total côté `download-saved-devis.ts:326` — le PDF
// affichait alors 46 225 € pour un devis dont les 9 lignes visibles sommaient
// à 43 425 € (régression DEV-2026-005, 2026-05-18, +2 800 € phantom).
describe('computeDocumentTotalHT — invariant rendu == total (flags Enabled)', () => {
  it('exclut materialLines quand materialLinesEnabled === false (phantom masqué)', () => {
    const doc = {
      lines: [{ totalHT: 17425 }],
      materialLines: [{ totalHT: 2800 }], // phantom survivant à un masquage UI
      materialLinesEnabled: false,
      customTables: [{ lines: [{ totalHT: 26000 }] }],
    }
    // Avant fix : sommait 17425 + 2800 + 26000 = 46225 (phantom compté).
    // Après fix : 17425 + 0 + 26000 = 43425 (phantom exclu).
    expect(computeDocumentTotalHT(doc)).toBe(43425)
  })

  it('exclut fraisLines quand fraisLinesEnabled === false', () => {
    const doc = {
      lines: [{ totalHT: 100 }],
      fraisLines: [{ totalHT: 50 }],
      fraisLinesEnabled: false,
    }
    expect(computeDocumentTotalHT(doc)).toBe(100)
  })

  it('inclut materialLines par défaut (flag absent ou true)', () => {
    const docDefaut = {
      lines: [{ totalHT: 100 }],
      materialLines: [{ totalHT: 50 }],
    }
    expect(computeDocumentTotalHT(docDefaut)).toBe(150)

    const docTrue = { ...docDefaut, materialLinesEnabled: true }
    expect(computeDocumentTotalHT(docTrue)).toBe(150)
  })
})
