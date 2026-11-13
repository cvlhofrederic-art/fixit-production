// Totaux des documents artisan (lib/totaux-artisan.ts) : ventilation de la TVA du formulaire (PDF V2) et
// montants d'un document au rendu complet (liste, messagerie, base). Pour un même document, formulaire,
// PDF, liste et base doivent trouver les mêmes HT, TVA et TTC, matériaux et frais annexes compris.
import { describe, it, expect } from 'vitest'
import {
  lignesTvaCompletes, regimeTvaDocument, totauxDocumentComplet, ventilationTvaArtisan, ventilationTvaDocumentArtisan,
  lignesRemisablesArtisan, lignesDocumentArtisan,
} from '@/lib/totaux-artisan'
import { appliquerRemiseGlobale } from '@/lib/remise-commerciale'
import { mulMoney, round2, sumMoney } from '@/lib/money'
import { montantTtcDocumentEnregistre } from '@/components/dashboard/messagerie/documents-enregistres'
import type { CustomTable, FraisAnnexeItem, ProductLine } from '@/lib/devis-types'

const ligne = (id: number, totalHT: number, tvaRate: number, description = `Ligne ${id}`): ProductLine =>
  ({ id, description, qty: 1, unit: 'u', priceHT: totalHT, tvaRate, totalHT })
const frais = (id: number, total_ht: number, tva_applicable: number): FraisAnnexeItem =>
  ({ id, designation: `Frais ${id}`, categorie: 'deplacement', quantite: 1, unite: 'forfait', prix_unitaire_ht: total_ht, tva_applicable, total_ht })

// 1 000 € de main-d'œuvre à 10 %, 300 € de matériaux à 20 %, 45 € de déplacement à 20 %, une table à 5,5 %.
const DOC = {
  id: 'a1', docType: 'devis', docNumber: 'DEV-2026-070', tvaEnabled: true, versionRendu: 2,
  lines: [ligne(1, 1000, 10)],
  materialLines: [ligne(2, 300, 20)],
  fraisAnnexes: [frais(3, 45, 20)],
  customTables: [{ id: 't1', name: 'Isolation', lines: [ligne(4, 200, 5.5)] }] as CustomTable[],
}

describe('ventilationTvaArtisan', () => {
  it('toutes les lignes du formulaire, taux du plus fort au plus faible, frais à leur taux', () => {
    const lignes = lignesDocumentArtisan(DOC)
    const remise = appliquerRemiseGlobale(lignesRemisablesArtisan(lignes), undefined)
    expect(ventilationTvaArtisan({ ...lignes, tvaEnabled: true, remise })).toEqual([
      { rate: 20, base: 345, amount: 69 },
      { rate: 10, base: 1000, amount: 100 },
      { rate: 5.5, base: 200, amount: 11 },
    ])
  })

  it('sans TVA (franchise) : aucune ligne', () => {
    expect(ventilationTvaDocumentArtisan(DOC, false)).toEqual([])
  })

  it('remise globale : bases remisées au prorata', () => {
    const v = ventilationTvaDocumentArtisan({ ...DOC, remiseGlobale: { type: 'pourcentage', valeur: 10 } }, true)
    expect(v.map((l) => l.rate)).toEqual([20, 10, 5.5])
    expect(sumMoney(v.map((l) => l.base))).toBe(round2(1545 * 0.9))
  })
})

describe('lignesTvaCompletes et regimeTvaDocument', () => {
  it('frais annexe : montant total_ht et taux tva_applicable', () => {
    const lignes = lignesTvaCompletes(DOC)
    expect(lignes).toHaveLength(4)
    expect(lignes).toContainEqual({ totalHT: 45, tvaRate: 20, horsRemise: false })
  })

  it('régime : drapeau explicite, sinon tvaEnabled', () => {
    expect(regimeTvaDocument({ tvaEnabled: true })).toBe('classique')
    expect(regimeTvaDocument({ tvaEnabled: false })).toBe('franchise_293b')
    expect(regimeTvaDocument({})).toBe('classique')
    expect(regimeTvaDocument({ regimeTva: 'autoliquidation_btp', tvaEnabled: true })).toBe('autoliquidation_btp')
    expect(regimeTvaDocument({ autoliquidationBTP: true })).toBe('autoliquidation_btp')
  })
})

describe('totauxDocumentComplet', () => {
  it('HT, TVA et TTC sur toutes les lignes', () => {
    const t = totauxDocumentComplet(DOC)
    expect(t.totalHT).toBe(1545)
    expect(t.totalTVA).toBe(180)
    expect(t.totalTTC).toBe(1725)
  })

  it('franchise en base : TTC = HT, même si des lignes portent encore un taux', () => {
    const t = totauxDocumentComplet({ ...DOC, tvaEnabled: false })
    expect(t.totalTVA).toBe(0)
    expect(t.totalTTC).toBe(1545)
  })
})

describe('messagerie (montantTtcDocumentEnregistre)', () => {
  it('artisan, document au rendu complet : matériaux et frais compris', () => {
    expect(montantTtcDocumentEnregistre(DOC as never, 'artisan')).toBe(1725)
  })

  it('artisan, document d avant la correction : calcul d origine (prestations et tables seulement)', () => {
    const { versionRendu: _v, ...ancien } = DOC
    // 1 000 € à 10 % + 200 € à 5,5 % = 1 311 € : matériaux et frais oubliés, comme avant.
    expect(montantTtcDocumentEnregistre(ancien as never, 'artisan')).toBe(1311)
  })

  it('BTP : calcul inchangé, marque ou non', () => {
    const btp = { ...DOC, materialLines: [ligne(2, 300, 20)], fraisAnnexes: undefined }
    const { versionRendu: _v, ...sansMarque } = btp
    expect(montantTtcDocumentEnregistre(btp as never, 'pro_societe')).toBe(montantTtcDocumentEnregistre(sansMarque as never, 'pro_societe'))
  })
})

// Générateur pseudo-aléatoire reproductible (mulberry32).
function hasard(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('formulaire, PDF, liste et base trouvent les mêmes montants (5 000 documents)', () => {
  it('HT, TVA et TTC identiques au centime, avec ou sans remise globale', () => {
    const r = hasard(20261113)
    const taux = [0, 2.1, 5.5, 10, 20]
    const prix = () => round2(r() * 4000 - (r() < 0.05 ? 2000 : 0))
    const qte = () => [1, 2, 3, 0.5, 1.5, 2.25, 7][Math.floor(r() * 7)]
    for (let n = 0; n < 5000; n++) {
      const produit = (id: number): ProductLine => {
        const q = qte(); const pu = prix()
        return { id, description: `L${id}`, qty: q, unit: 'u', priceHT: pu, tvaRate: taux[Math.floor(r() * 5)], totalHT: mulMoney(q, pu) }
      }
      const fraisAleatoire = (id: number): FraisAnnexeItem => {
        const q = qte(); const pu = prix()
        // Document au rendu complet : montant d'un frais arrondi au centime (formulaire).
        return { ...frais(id, mulMoney(q, pu), taux[Math.floor(r() * 5)]), quantite: q, prix_unitaire_ht: pu }
      }
      const doc: Record<string, unknown> = {
        tvaEnabled: r() < 0.8, versionRendu: 2,
        lines: Array.from({ length: 1 + Math.floor(r() * 4) }, (_, i) => produit(i)),
        materialLines: Array.from({ length: Math.floor(r() * 3) }, (_, i) => produit(100 + i)),
        fraisAnnexes: Array.from({ length: Math.floor(r() * 3) }, (_, i) => fraisAleatoire(200 + i)),
        customTables: r() < 0.5 ? [{ id: 't', name: 'T', lines: [produit(300)] }] : [],
        ...(r() < 0.3 ? { remiseGlobale: r() < 0.5 ? { type: 'pourcentage', valeur: Math.floor(r() * 30) } : { type: 'montant', valeur: round2(r() * 500) } } : {}),
      }
      // Formulaire (DevisFactureForm) : sous-total, ventilation, TTC.
      const lignes = lignesDocumentArtisan(doc)
      const remise = appliquerRemiseGlobale(lignesRemisablesArtisan(lignes), doc.remiseGlobale)
      const sousTotalBrut = round2(
        sumMoney(lignes.lines.map((l) => l.totalHT)) + sumMoney(lignes.materialLines.map((l) => l.totalHT))
        + lignes.fraisAnnexes.reduce((s, f) => s + f.total_ht, 0)
        + lignes.customTables.reduce((s, t) => s + t.lines.reduce((x, l) => x + l.totalHT, 0), 0),
      )
      const htFormulaire = remise.remiseHT !== 0 ? remise.totalHT : sousTotalBrut
      const ventilation = ventilationTvaArtisan({ ...lignes, tvaEnabled: doc.tvaEnabled as boolean, remise })
      const tvaFormulaire = sumMoney(ventilation.map((v) => v.amount))
      const ttcFormulaire = round2(htFormulaire + tvaFormulaire)
      // PDF V2 : sous-total = somme des lignes imprimées, remise déduite, TVA de la ventilation.
      const htPdf = remise.remiseHT !== 0 ? round2(sumMoney(lignesTvaCompletes(doc).map((l) => l.totalHT)) - remise.remiseHT) : sumMoney(lignesTvaCompletes(doc).map((l) => l.totalHT))
      // Liste, messagerie et base : totauxDocumentComplet.
      const base = totauxDocumentComplet(doc)
      expect(base.totalHT, `HT doc ${n}`).toBe(htFormulaire)
      expect(htPdf, `HT PDF doc ${n}`).toBe(htFormulaire)
      expect(base.totalTVA, `TVA doc ${n}`).toBe(tvaFormulaire)
      expect(base.totalTTC, `TTC doc ${n}`).toBe(ttcFormulaire)
    }
  })
})
