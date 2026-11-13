// Remise commerciale et escompte sur les PDF : artisan (V2, via buildV2Input) et BTP (V3).
// Le texte est lu dans le PDF produit (jsPDF n'en compresse pas le contenu) : colonne Remise
// seulement si une ligne est remisée, lignes « Remise commerciale (x %) » et « Total HT net »,
// escompte saisi imprimé à la place de « Aucun escompte accordé ».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildV2Input, type BuildV2InputParams } from '@/lib/pdf/build-v2-input'
import { generateDevisPdfV2 } from '@/lib/pdf/devis-generator-v2'
import { generateDevisPdfV3, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import fr from '@/locales/fr.json'
import { embedFacturX } from '@/lib/facturx'

// Factur-X : l'intégration réelle (pdf-lib) est remplacée ; on vérifie seulement si le PDF BTP la demande.
vi.mock('@/lib/facturx', () => ({ embedFacturX: vi.fn(async (octets: Uint8Array) => octets) }))
vi.mock('@/lib/facturx-mapper', () => ({ generateFacturXML: vi.fn(() => '<rsm:CrossIndustryInvoice/>') }))

const texte = (octets: ArrayBuffer | Uint8Array): string => Buffer.from(octets as ArrayBuffer).toString('latin1')

function parametresV2(surcharges: Partial<BuildV2InputParams> = {}): BuildV2InputParams {
  return {
    logoUrl: null, companyName: 'Test EI', companySiret: '12345678901234', companyAddress: '1 rue test',
    // Assurance RC Pro : sans elle, le générateur V2 refuse le document (art. L243-2 C. assurances).
    companyPhone: '0600000000', companyEmail: 'test@example.com', insuranceName: 'AXA', insuranceNumber: 'RC-1',
    insuranceCoverage: 'France', insuranceType: 'rc_pro', tvaEnabled: true, paymentMode: 'Virement', paymentCondition: '',
    clientName: 'Client', clientSiret: null, clientAddress: null, clientPhone: null, clientEmail: null,
    interventionAddress: null, interventionBatiment: null, interventionEtage: null, interventionEspacesCommuns: null,
    interventionExterieur: null, docType: 'facture', docNumber: 'FACT-001', docTitle: 'Test', docDate: '2026-11-13',
    docValidity: 30, executionDelay: '3 jours', prestationDate: '',
    lines: [
      { id: 1, description: 'Pose carrelage', qty: 10, unit: 'm2', priceHT: 50, tvaRate: 10, totalHT: 450, remise: { type: 'pourcentage', valeur: 10 } },
      { id: 2, description: 'Fournitures', qty: 1, unit: 'u', priceHT: 500, tvaRate: 20, totalHT: 500 },
    ],
    acomptesEnabled: false, acomptes: [], notes: '', mediatorName: '', mediatorUrl: '', isHorsEtablissement: false,
    ...surcharges,
  }
}

describe('buildV2Input — remise commerciale', () => {
  it('texte de la colonne Remise, montant et libellé de la remise globale', () => {
    const entree = buildV2Input(parametresV2({ remiseGlobale: { type: 'pourcentage', valeur: 10 } }))
    expect(entree.lignes.map((l) => l.remise)).toEqual(['-10 %', undefined])
    expect(entree.remiseGlobale).toEqual({ montantHT: 95, libelle: 'Remise commerciale (10 %)' })
  })

  it('acomptes calculés sur le total remisé', () => {
    const entree = buildV2Input(parametresV2({
      remiseGlobale: { type: 'montant', valeur: 150 },
      acomptesEnabled: true,
      acomptes: [{ id: 'a', ordre: 1, label: 'Signature', pourcentage: 30, declencheur: 'À la signature' }],
    }))
    expect(entree.acomptes?.[0].montant).toBe(240) // 30 % de (950 − 150)
  })

  it('sans remise ni escompte : aucun champ ajouté', () => {
    const entree = buildV2Input(parametresV2({ lines: [{ id: 1, description: 'Pose', qty: 1, unit: 'u', priceHT: 100, tvaRate: 10, totalHT: 100 }] }))
    expect(entree.remiseGlobale).toBeUndefined()
    expect(entree.escompte).toBeUndefined()
    expect(entree.lignes[0].remise).toBeUndefined()
  })
})

describe('PDF artisan (V2)', () => {
  const tvaRemisee = [{ rate: 20, base: 450, amount: 90 }, { rate: 10, base: 405, amount: 40.5 }]

  it('colonne Remise, remise globale et total HT net', async () => {
    const entree = buildV2Input(parametresV2({ remiseGlobale: { type: 'pourcentage', valeur: 10 }, tvaBreakdown: tvaRemisee }))
    const contenu = texte((await generateDevisPdfV2(entree)).output('arraybuffer'))
    expect(contenu).toContain('(REMISE)')
    expect(contenu).toContain('(-10 %)')
    expect(contenu).toContain('(Remise commerciale \\(10 %\\))')
    expect(contenu).toContain('(Total HT net)')
    expect(contenu).toContain('-95,00') // montant de la remise (10 % de 950)
  })

  it('sans remise : ni colonne Remise ni ligne de remise', async () => {
    const entree = buildV2Input(parametresV2({ lines: [{ id: 1, description: 'Pose', qty: 1, unit: 'u', priceHT: 100, tvaRate: 10, totalHT: 100 }] }))
    const contenu = texte((await generateDevisPdfV2(entree)).output('arraybuffer'))
    expect(contenu).not.toContain('(REMISE)')
    expect(contenu).not.toContain('Remise commerciale')
    expect(contenu).toContain('Aucun escompte accord')
  })

  it('escompte saisi : imprimé à la place de « Aucun escompte accordé »', async () => {
    const entree = buildV2Input(parametresV2({ escompte: '2 % si paiement sous 8 jours' }))
    const contenu = texte((await generateDevisPdfV2(entree)).output('arraybuffer'))
    expect(contenu).toContain('Escompte pour paiement anticip')
    expect(contenu).toContain('8 jours')
    expect(contenu).not.toContain('Aucun escompte accord')
  })
})

const t = (cle: string): string => {
  const valeur = cle.split('.').reduce<unknown>((noeud, part) => (noeud as Record<string, unknown> | undefined)?.[part], fr)
  return typeof valeur === 'string' ? valeur : cle
}

function entreeV3(surcharges: Partial<PdfV3Input> = {}): PdfV3Input {
  const ligne = { id: 1, description: 'Ravalement de façade', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 10, totalHT: 1000 }
  return {
    action: 'fichier', locale: 'fr',
    localeFormats: { currencyFormat: (n: number) => `${n.toFixed(2).replace('.', ',')} €`, taxLabel: 'TVA' },
    t, docType: 'devis', docNumber: 'DEV-2026-040', docTitle: 'Ravalement', docDate: '2026-11-13',
    docValidity: 30, prestationDate: '', executionDelay: '', companyStatus: 'sas', companyName: 'BATIR TEST SAS',
    companySiret: '', companyAddress: '1 rue A 13001 Marseille', companyRCS: '', companyCapital: '', companyPhone: '',
    companyEmail: '', tvaEnabled: true, tvaNumber: '', insuranceName: '', insuranceNumber: '', insuranceCoverage: '',
    insuranceType: 'rc_pro', decennaleEligibility: 'never', mediatorName: '', mediatorUrl: '', isHorsEtablissement: false,
    clientName: 'Jean Dupont', clientEmail: '', clientAddress: '3 impasse des Lilas 13008 Marseille', clientPhone: '',
    clientSiret: '', clientType: 'particulier', interventionAddress: '12 rue de la Paix 13001 Marseille',
    interventionBatiment: '', interventionEtage: '', interventionEspacesCommuns: '', interventionExterieur: '',
    companyAPE: '', paymentMode: 'Virement bancaire', paymentDue: '30 jours', paymentCondition: '', discount: '',
    penaltyRate: '', recoveryFee: '40 €', iban: '', bic: '',
    lines: [ligne], laborLines: [ligne], materialLines: [], fraisLines: [], linesName: 'Travaux', customTables: [],
    subtotalHT: 1000, totalTTC: 1100, tvaBreakdown: [{ rate: 10, base: 1000, amount: 100 }], regimeTva: 'classique',
    acomptesEnabled: false, acomptes: [], notes: '', sourceDevisRef: null, signatureData: null,
    attachedRapport: null, selectedPhotos: [], artisan: null, ptFiscalData: null,
    svgToImageDataUrl: async () => '', fetchFreshLogo: async () => null,
    ...surcharges,
  } as PdfV3Input
}

describe('PDF BTP (V3)', () => {
  const createObjectURL = URL.createObjectURL
  beforeEach(() => { URL.createObjectURL = vi.fn(() => 'blob:test') })
  afterEach(() => { URL.createObjectURL = createObjectURL })

  it('colonne Remise, remise globale et total HT net', async () => {
    const ligne = { id: 1, description: 'Ravalement de façade', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 10, totalHT: 900, remise: { type: 'pourcentage' as const, valeur: 10 } }
    const resultat = await generateDevisPdfV3(entreeV3({
      lines: [ligne], laborLines: [ligne],
      totalHTBrut: 900, remiseGlobale: { montantHT: 90, libelle: 'Remise commerciale (10 %)' },
      subtotalHT: 810, totalTTC: 891, tvaBreakdown: [{ rate: 10, base: 810, amount: 81 }],
    }))
    const contenu = texte(resultat.fichier)
    expect(contenu).toContain('(Remise)')
    expect(contenu).toContain('(-10 %)')
    expect(contenu).toContain('(Remise commerciale \\(10 %\\))')
    expect(contenu).toContain('(Total HT net)')
    expect(contenu).toContain('810,00') // total HT net
    expect(contenu).toContain('-90,00') // montant de la remise globale
  })

  it('sans remise : tableau et totaux d origine', async () => {
    const contenu = texte((await generateDevisPdfV3(entreeV3())).fichier)
    expect(contenu).not.toContain('(Remise)')
    expect(contenu).not.toContain('Remise commerciale')
    expect(contenu).not.toContain('Total HT net')
  })
})

describe('PDF BTP (V3) — grands montants, avoir de facture de solde, Factur-X', () => {
  // Format réel du formulaire BTP : séparateur de milliers fr-FR, espaces insécables remplacés.
  const eurosBTP = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ')} €`
  const formatsBTP = { currencyFormat: eurosBTP, taxLabel: 'TVA' }
  const createObjectURL = URL.createObjectURL
  beforeEach(() => { URL.createObjectURL = vi.fn(() => 'blob:test') })
  afterEach(() => {
    URL.createObjectURL = createObjectURL
    vi.unstubAllEnvs()
    vi.mocked(embedFacturX).mockClear()
  })

  it('une remise de ligne à cinq chiffres tient sur une seule ligne de la colonne Remise', async () => {
    const ligne = { id: 1, description: 'Ravalement de façade', qty: 1, unit: 'f', priceHT: 50000, tvaRate: 10, totalHT: 37654.33, remise: { type: 'montant' as const, valeur: 12345.67 } }
    const contenu = texte((await generateDevisPdfV3(entreeV3({
      localeFormats: formatsBTP, lines: [ligne], laborLines: [ligne],
      subtotalHT: 37654.33, totalTTC: 41419.76, tvaBreakdown: [{ rate: 10, base: 37654.33, amount: 3765.43 }],
    }))).fichier)
    // Une seule chaîne de texte « -12 345,67 € » : la cellule n'est pas coupée en « -12 » / « 345,67 € ».
    expect(contenu).toMatch(/\(-12 345,67 .\)/)
    expect(contenu).toContain('37 654,33')
  })

  it('avoir d une facture de solde : base de la remise imprimée en valeur absolue', async () => {
    // Avoir total : travaux −10 000 €, acompte déduit rendu +3 000 €, remise de 10 % sur les seuls travaux.
    const travaux = { id: 1, description: 'Ravalement de façade', qty: 1, unit: 'f', priceHT: -10000, tvaRate: 10, totalHT: -10000 }
    const acompte = { id: 2, description: 'Acompte n° 1', qty: 1, unit: 'u', priceHT: 3000, tvaRate: 10, totalHT: 3000 }
    const contenu = texte((await generateDevisPdfV3(entreeV3({
      docType: 'facture', factureSubType: 'avoir', parentInvoiceNumber: 'FACT-2026-050', localeFormats: formatsBTP,
      lines: [travaux], laborLines: [travaux],
      customTables: [{ id: 'acomptes-deduits', name: 'Acomptes déjà facturés (à déduire)', lines: [acompte] }],
      totalHTBrut: -7000, remiseGlobale: { montantHT: -1000, libelle: 'Remise commerciale (10 %)', base: -10000 },
      subtotalHT: -6000, totalTTC: -6600, tvaBreakdown: [{ rate: 10, base: -6000, amount: -600 }],
    }))).fichier)
    expect(contenu).toContain('(sur 10 000,00 ')
    expect(contenu).not.toContain('sur -10')
    expect(contenu).toContain('1 000,00') // remise rendue (signe de l'avoir)
  })

  describe('Factur-X (facture B2B en régime classique)', () => {
    const factureB2B = (surcharges: Partial<PdfV3Input> = {}) => entreeV3({
      docType: 'facture', clientType: 'professionnel', clientSiret: '12345678900011', companySiret: '98765432100019', ...surcharges,
    })

    it('sans remise : XML joint (contrôle du montage du test)', async () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_FACTURX', 'true')
      await generateDevisPdfV3(factureB2B())
      expect(embedFacturX).toHaveBeenCalledTimes(1)
    })

    it('remise globale : PDF simple, pas de XML aux montants faux', async () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_FACTURX', 'true')
      await generateDevisPdfV3(factureB2B({
        totalHTBrut: 1000, remiseGlobale: { montantHT: 100, libelle: 'Remise commerciale (10 %)' },
        subtotalHT: 900, totalTTC: 990, tvaBreakdown: [{ rate: 10, base: 900, amount: 90 }],
      }))
      expect(embedFacturX).not.toHaveBeenCalled()
    })

    it('remise de ligne seule : PDF simple aussi', async () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_FACTURX', 'true')
      const ligne = { id: 1, description: 'Ravalement de façade', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 10, totalHT: 900, remise: { type: 'pourcentage' as const, valeur: 10 } }
      await generateDevisPdfV3(factureB2B({
        lines: [ligne], laborLines: [ligne], subtotalHT: 900, totalTTC: 990, tvaBreakdown: [{ rate: 10, base: 900, amount: 90 }],
      }))
      expect(embedFacturX).not.toHaveBeenCalled()
    })
  })
})
