// Totaux des documents artisan (lib/totaux-artisan.ts) : ventilation de la TVA du formulaire (PDF V2) et
// montants d'un document au rendu complet (liste, messagerie, base). Pour un même document, formulaire,
// PDF, liste et base doivent trouver les mêmes HT, TVA et TTC, matériaux et frais annexes compris.
import { describe, it, expect } from 'vitest'
import {
  lignesTvaCompletes, regimeTvaDocument, totauxDocumentComplet, ventilationTvaArtisan, ventilationTvaDocumentArtisan,
  lignesRemisablesArtisan, lignesDocumentArtisan, type LignesArtisan, type LigneVentilationTva,
} from '@/lib/totaux-artisan'
import { buildV2Input, type BuildV2InputParams } from '@/lib/pdf/build-v2-input'
import { generateDevisPdfV2, type DevisGeneratorInput } from '@/lib/pdf/devis-generator-v2'
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

  it('BTP : calcul inchangé, marque ou non (un frais annexe artisan n y est pas lu)', () => {
    // Le calcul BTP ne lit ni `total_ht` ni `tva_applicable` (un document BTP n'a pas de frais annexes
    // artisan) : 1 500 € HT + 171 € de TVA. Le calcul complet compte le frais à 10 % : 1 720,50 €.
    const btp = { ...DOC, fraisAnnexes: [frais(3, 45, 10)] }
    const { versionRendu: _v, ...sansMarque } = btp
    expect(montantTtcDocumentEnregistre(btp as never, 'pro_societe')).toBe(1671)
    expect(montantTtcDocumentEnregistre(sansMarque as never, 'pro_societe')).toBe(1671)
    expect(montantTtcDocumentEnregistre(btp as never, 'artisan')).toBe(1720.5)
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

// Paramètres du PDF artisan tels que le formulaire les passe (getV2InputParams) ; seuls les champs qui
// comptent pour les totaux varient.
const parametresPdf = (doc: Record<string, unknown>, lignes: LignesArtisan, ventilation: LigneVentilationTva[]): BuildV2InputParams => ({
  logoUrl: null, companyName: 'Test EI', companySiret: '12345678901234', companyAddress: '1 rue test',
  companyPhone: '0600000000', companyEmail: 'test@example.com', insuranceName: 'AXA', insuranceNumber: 'RC-1',
  insuranceCoverage: 'France', insuranceType: 'rc_pro', tvaEnabled: doc.tvaEnabled as boolean, paymentMode: 'Virement',
  paymentCondition: '', clientName: 'Client', clientSiret: null, clientAddress: null, clientPhone: null, clientEmail: null,
  interventionAddress: null, interventionBatiment: null, interventionEtage: null, interventionEspacesCommuns: null,
  interventionExterieur: null, docType: 'devis', docNumber: 'DEV-2026-001', docTitle: 'Test', docDate: '2026-11-13',
  docValidity: 30, executionDelay: '', prestationDate: '', ...lignes,
  tvaBreakdown: doc.tvaEnabled ? ventilation : undefined, remiseGlobale: doc.remiseGlobale, versionRendu: 2,
  acomptesEnabled: false, acomptes: [], notes: '', mediatorName: '', mediatorUrl: '', isHorsEtablissement: false,
})
// Totaux du PDF V2 (lib/pdf/devis-generator-v2.ts) : sous-total = somme des lignes imprimées (document
// remisé : HT brut du calcul commun), remise déduite, TVA de la ventilation reçue. `imprime` : somme des
// lignes réellement imprimées, qui doit retomber sur le sous-total.
const totauxPdf = (entree: DevisGeneratorInput) => {
  const imprime = sumMoney(entree.lignes.map((l) => l.total))
  const remiseHT = entree.remiseGlobale?.montantHT || 0
  const brut = remiseHT && entree.remiseGlobale?.totalBrutHT !== undefined ? entree.remiseGlobale.totalBrutHT : imprime
  const ht = remiseHT ? (entree.remiseGlobale?.totalHT ?? round2(brut - remiseHT)) : brut
  return { imprime, brut, ht, ttc: round2(ht + (entree.tvaBreakdown ? sumMoney(entree.tvaBreakdown.map((t) => t.amount)) : 0)) }
}
// Montant du cadre « TOTAL TTC » / « TOTAL NET » imprimé dans le PDF (texte non compressé par jsPDF).
const montantFinalImprime = (octets: ArrayBuffer): string | undefined => {
  const contenu = Buffer.from(octets).toString('latin1')
  return Array.from(contenu.matchAll(/\(TOTAL (?:TTC|NET)\) Tj[^(]*\(([-\d ]+,\d{2})/g)).at(-1)?.[1]
}
const commeLePdf = (n: number): string => {
  const [entier, decimales] = n.toFixed(2).split('.')
  return `${entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${decimales}`
}

describe('formulaire, PDF, liste et base trouvent les mêmes montants (5 000 documents)', () => {
  it('HT, TVA et TTC identiques au centime, avec ou sans remise globale ni désignation', async () => {
    const r = hasard(20261113)
    const taux = [0, 2.1, 5.5, 10, 20]
    const prix = () => round2(r() * 4000 - (r() < 0.05 ? 2000 : 0))
    const qte = () => [1, 2, 3, 0.5, 1.5, 2.25, 7][Math.floor(r() * 7)]
    // Une ligne sur dix sans désignation : chiffrée, elle est comptée partout et imprimée sous un repli.
    const designation = (id: number) => (r() < 0.1 ? '' : `L${id}`)
    for (let n = 0; n < 5000; n++) {
      const produit = (id: number): ProductLine => {
        const q = qte(); const pu = prix()
        return { id, description: designation(id), qty: q, unit: 'u', priceHT: pu, tvaRate: taux[Math.floor(r() * 5)], totalHT: mulMoney(q, pu) }
      }
      const fraisAleatoire = (id: number): FraisAnnexeItem => {
        const q = qte(); const pu = prix()
        // Document au rendu complet : montant d'un frais arrondi au centime (formulaire).
        return { ...frais(id, mulMoney(q, pu), taux[Math.floor(r() * 5)]), designation: designation(id), quantite: q, prix_unitaire_ht: pu }
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
      // PDF V2 : lignes et remise construites par buildV2Input, comme le bouton « Télécharger ».
      const entree = buildV2Input(parametresPdf(doc, lignes, ventilation))
      const pdf = totauxPdf(entree)
      // Liste, messagerie et base : totauxDocumentComplet.
      const base = totauxDocumentComplet(doc)
      expect(base.totalHT, `HT doc ${n}`).toBe(htFormulaire)
      expect(pdf.imprime, `lignes imprimées doc ${n}`).toBe(pdf.brut)
      expect(pdf.ht, `HT PDF doc ${n}`).toBe(htFormulaire)
      expect(base.totalTVA, `TVA doc ${n}`).toBe(tvaFormulaire)
      expect(base.totalTTC, `TTC doc ${n}`).toBe(ttcFormulaire)
      expect(pdf.ttc, `TTC PDF doc ${n}`).toBe(ttcFormulaire)
      // 150 premiers documents : vrai PDF, montant final imprimé lu dans le fichier.
      if (n < 150) {
        const octets = (await generateDevisPdfV2(entree)).output('arraybuffer') as ArrayBuffer
        expect(montantFinalImprime(octets), `montant imprimé doc ${n}`).toBe(commeLePdf(base.totalTTC))
      }
    }
  })
})
