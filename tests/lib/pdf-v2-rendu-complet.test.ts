// PDF artisan (V2) d'un document au rendu complet (lib/version-rendu.ts) : matériaux et frais annexes
// imprimés et comptés, en-têtes « PRIX U. HT / TOTAL HT », lignes de TVA qui ne chevauchent plus leur
// montant, nombres à virgule. Un document sans marque garde le PDF d'origine (paramètres identiques).
// Le texte est lu dans le PDF produit (jsPDF n'en compresse pas le contenu).
import { describe, it, expect } from 'vitest'
import { jsPDF } from 'jspdf'
import { buildV2Input, type BuildV2InputParams } from '@/lib/pdf/build-v2-input'
import { generateDevisPdfV2 } from '@/lib/pdf/devis-generator-v2'
import { buildSubTypeLabel } from '@/lib/pdf/subtype-label'
import { dateIsoLocale } from '@/lib/pdf/payment-due'
import { ventilationTvaDocumentArtisan } from '@/lib/totaux-artisan'
import type { FraisAnnexeItem, ProductLine } from '@/lib/devis-types'

const texte = (octets: ArrayBuffer): string => Buffer.from(octets).toString('latin1')
const mmEnPt = (mm: number): number => (mm * 72) / 25.4

const PRESTATION: ProductLine = { id: 1, description: 'Pose carrelage', qty: 1.5, unit: 'm2', priceHT: 400, tvaRate: 10, totalHT: 600 }
const MATERIAU: ProductLine = { id: 2, description: 'Carrelage grès', qty: 10, unit: 'm2', priceHT: 30, tvaRate: 20, totalHT: 300 }
const DEPLACEMENT: FraisAnnexeItem = {
  id: 3, designation: 'Déplacement', categorie: 'deplacement', quantite: 1, unite: 'forfait', prix_unitaire_ht: 45, tva_applicable: 20, total_ht: 45,
}
const ISOLATION: ProductLine = { id: 4, description: 'Isolant', qty: 1, unit: 'u', priceHT: 200, tvaRate: 5.5, totalHT: 200 }

function parametres(surcharges: Partial<BuildV2InputParams> = {}): BuildV2InputParams {
  return {
    logoUrl: null, companyName: 'Test EI', companySiret: '12345678901234', companyAddress: '1 rue test',
    companyPhone: '0600000000', companyEmail: 'test@example.com', insuranceName: 'AXA', insuranceNumber: 'RC-1',
    insuranceCoverage: 'France', insuranceType: 'rc_pro', tvaEnabled: true, paymentMode: 'Virement', paymentCondition: '',
    clientName: 'Client', clientSiret: null, clientAddress: null, clientPhone: null, clientEmail: null,
    interventionAddress: null, interventionBatiment: null, interventionEtage: null, interventionEspacesCommuns: null,
    interventionExterieur: null, docType: 'devis', docNumber: 'DEV-2026-080', docTitle: 'Salle de bain', docDate: '2026-11-13',
    docValidity: 30, executionDelay: '3 jours', prestationDate: '',
    lines: [PRESTATION], materialLines: [MATERIAU], fraisAnnexes: [DEPLACEMENT],
    acomptesEnabled: false, acomptes: [], notes: '', mediatorName: '', mediatorUrl: '', isHorsEtablissement: false,
    ...surcharges,
  }
}

// Ventilation du formulaire pour ces lignes (prestation à 10 %, matériau et déplacement à 20 %).
const VENTILATION = ventilationTvaDocumentArtisan({ lines: [PRESTATION], materialLines: [MATERIAU], fraisAnnexes: [DEPLACEMENT] }, true)

describe('buildV2Input — document au rendu complet', () => {
  it('matériaux et frais annexes imprimés, chacun dans sa section, dans l ordre du formulaire', () => {
    const entree = buildV2Input(parametres({ versionRendu: 2, customTables: [{ id: 't1', name: 'Isolation', lines: [ISOLATION] }] }))
    expect(entree.mode_affichage).toBe('sections')
    expect(entree.lignes.map((l) => [l.designation, l.section, l.total])).toEqual([
      ['Pose carrelage', 'labor', 600],
      ['Carrelage grès', 'materiaux', 300],
      ['Déplacement', 'frais_annexes', 45],
      ['Isolant', 'custom_t1', 200],
    ])
    // Frais au forfait : unité « f » (imprimée « Forfait », comme une prestation).
    expect(entree.lignes[2]).toMatchObject({ quantite: 1, unite: 'f', prix_unitaire: 45 })
    expect(entree.versionRendu).toBe(2)
  })

  it('sans matériaux, frais ni table : un seul tableau, comme avant', () => {
    const entree = buildV2Input(parametres({ versionRendu: 2, materialLines: [], fraisAnnexes: [] }))
    expect(entree.mode_affichage).toBe('bloc')
    expect(entree.lignes.map((l) => l.section)).toEqual([null])
  })

  it('ligne chiffrée sans désignation : imprimée sous un libellé de repli (comptée partout ailleurs)', () => {
    const entree = buildV2Input(parametres({
      versionRendu: 2,
      lines: [{ ...PRESTATION, description: '' }, { id: 9, description: '', qty: 1, unit: 'u', priceHT: 0, tvaRate: 10, totalHT: 0 }],
      materialLines: [{ ...MATERIAU, description: '  ' }],
      fraisAnnexes: [{ ...DEPLACEMENT, designation: '', categorie: 'peage' }],
    }))
    // La ligne vide à 0 € (ligne de saisie restée vierge) n'est pas imprimée.
    expect(entree.lignes.map((l) => [l.designation, l.total])).toEqual([['Prestation', 600], ['Matériau', 300], ['Péage', 45]])
  })

  it('document d avant : ligne sans désignation omise, comme avant', () => {
    const entree = buildV2Input(parametres({ lines: [{ ...PRESTATION, description: '' }, { ...ISOLATION }] }))
    expect(entree.lignes.map((l) => l.designation)).toEqual(['Isolant'])
  })

  it('document d avant la correction : ni matériaux ni frais, aucun champ ajouté (PDF d origine)', () => {
    const entree = buildV2Input(parametres())
    expect(entree.mode_affichage).toBe('bloc')
    expect(entree.lignes.map((l) => l.designation)).toEqual(['Pose carrelage'])
    expect('versionRendu' in entree).toBe(false)
  })
})

describe('PDF V2 — document au rendu complet', () => {
  it('sections Matériaux et Frais annexes, total qui les compte (TTC = HT + TVA de toutes les lignes)', async () => {
    const entree = buildV2Input(parametres({ versionRendu: 2, tvaBreakdown: VENTILATION }))
    const contenu = texte((await generateDevisPdfV2(entree)).output('arraybuffer'))
    expect(contenu).toContain('RIAUX)') // MATÉRIAUX
    expect(contenu).toContain('(FRAIS ANNEXES)')
    expect(contenu).toContain('(Forfait)')
    // HT 945 (600 + 300 + 45), TVA 60 + 69 = 129, TTC 1 074.
    expect(contenu).toContain('(945,00')
    expect(contenu).toContain('(1 074,00')
  })

  it('artisan à TVA : en-têtes hors taxe ; document d avant : en-têtes d origine', async () => {
    const complet = texte((await generateDevisPdfV2(buildV2Input(parametres({ versionRendu: 2, tvaBreakdown: VENTILATION })))).output('arraybuffer'))
    expect(complet).toContain('(PRIX U. HT)')
    expect(complet).toContain('(TOTAL HT)')
    expect(complet).not.toContain('PRIX U. TTC')
    const ancien = texte((await generateDevisPdfV2(buildV2Input(parametres({ tvaBreakdown: VENTILATION })))).output('arraybuffer'))
    expect(ancien).toContain('(PRIX U. TTC)')
    expect(ancien).not.toContain('PRIX U. HT')
  })

  it('franchise en base : en-têtes « PRIX U. / TOTAL » inchangés', async () => {
    const contenu = texte((await generateDevisPdfV2(buildV2Input(parametres({ versionRendu: 2, tvaEnabled: false })))).output('arraybuffer'))
    expect(contenu).toContain('(PRIX U.)')
    expect(contenu).not.toContain('PRIX U. HT')
  })

  it('lignes de TVA : libellé à 118 mm et taux à virgule ; quantité à virgule', async () => {
    const lignes = [{ ...PRESTATION, tvaRate: 5.5 }]
    const tva = ventilationTvaDocumentArtisan({ lines: lignes }, true)
    const contenu = texte((await generateDevisPdfV2(buildV2Input(parametres({
      versionRendu: 2, lines: lignes, materialLines: [], fraisAnnexes: [], tvaBreakdown: tva,
    })))).output('arraybuffer'))
    const position = /([\d.]+) [\d.]+ Td\s*\(TVA 5,5 % sur 600,00/.exec(contenu)
    expect(position).not.toBeNull()
    expect(Number(position![1])).toBeCloseTo(mmEnPt(118), 1)
    expect(contenu).toContain('(1,5)')
    expect(contenu).not.toContain('(1.5)')
  })

  it('document d avant : libellé TVA et quantité d origine', async () => {
    const lignes = [{ ...PRESTATION, tvaRate: 5.5 }]
    const tva = ventilationTvaDocumentArtisan({ lines: lignes }, true)
    const contenu = texte((await generateDevisPdfV2(buildV2Input(parametres({
      lines: lignes, materialLines: [], fraisAnnexes: [], tvaBreakdown: tva,
    })))).output('arraybuffer'))
    const position = /([\d.]+) [\d.]+ Td\s*\(TVA 5\.5% sur 600,00/.exec(contenu)
    expect(position).not.toBeNull()
    expect(Number(position![1])).toBeCloseTo(mmEnPt(148.15), 1)
    expect(contenu).toContain('(1.5)')
  })

  it('le libellé TVA ne touche plus le montant, même à six chiffres', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8)
    const libelle = pdf.getTextWidth('TVA 5,5 % sur 999 999,99 €')
    pdf.setFont('helvetica', 'bold')
    const montant = pdf.getTextWidth('55 000,00 €')
    expect(118 + libelle).toBeLessThan(188.71 - montant)
    // Avant (libellé à 148,15 mm) : chevauchement dès « TVA 20% sur 1 000,00 € ».
    pdf.setFont('helvetica', 'normal')
    const ancien = pdf.getTextWidth('TVA 20% sur 1 000,00 €')
    pdf.setFont('helvetica', 'bold')
    expect(148.15 + ancien).toBeGreaterThan(188.71 - pdf.getTextWidth('200,00 €'))
  })
})

describe('échéance « fin de mois » : date du calendrier local (dateIsoLocale)', () => {
  it('en heure de Paris, le 31/12 reste le 31/12 (toISOString donnait la veille)', () => {
    const fuseau = process.env.TZ
    process.env.TZ = 'Europe/Paris'
    try {
      const finDeMois = new Date(2026, 11, 31)
      expect(finDeMois.toISOString().slice(0, 10)).toBe('2026-12-30')
      expect(dateIsoLocale(finDeMois)).toBe('2026-12-31')
      expect(dateIsoLocale(new Date(2026, 0, 5))).toBe('2026-01-05')
    } finally {
      process.env.TZ = fuseau
    }
  })
})

describe('libellé de sous-type : pourcentages à virgule pour un document au rendu complet', () => {
  const acompte = { docType: 'facture' as const, factureSubType: 'acompte' as const, acompteOrdre: 1, acompteTotal: 3, acomptePourcentage: 33.33 }
  it('rendu complet : « 33,33 % »', () => {
    expect(buildSubTypeLabel(acompte, false, (n) => String(n).replace('.', ','))).toBe('FACTURE D\'ACOMPTE N°1 sur 3 — 33,33 %')
  })
  it('document d avant : libellé d origine', () => {
    expect(buildSubTypeLabel(acompte, false)).toBe('FACTURE D\'ACOMPTE N°1 sur 3 — 33.33%')
  })
})
