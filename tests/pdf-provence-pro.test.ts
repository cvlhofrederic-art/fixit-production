// Modèle de devis et de facture propre à PROVENCE PRO (lib/pdf/modele-provence-pro.ts).
// Le générateur V3 tourne ici pour de vrai (jsPDF dans jsdom) : on vérifie le
// texte du PDF produit, pour Provence Pro comme pour une autre société BTP.
// Avec PDF_SORTIE=<dossier>, les PDF sont aussi écrits sur disque pour un
// contrôle visuel.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateDevisPdfV3, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import { modeleDocumentSociete } from '@/lib/pdf/modele-provence-pro'
import type { ProductLine } from '@/lib/devis-types'
import fr from '@/locales/fr.json'

// Même résolution de clé que l'application (libellés réels dans le PDF)
const t = (cle: string): string => {
  const valeur = cle.split('.').reduce<unknown>((noeud, part) => (noeud as Record<string, unknown> | undefined)?.[part], fr)
  return typeof valeur === 'string' ? valeur : cle
}

const PROVENCE_PRO_ID = '4397dc9e-d115-47cc-ae6b-cfeedc971eb5'
const AUTRE_SOCIETE_ID = '11111111-2222-3333-4444-555555555555'

const DOSSIER_SORTIE = process.env.PDF_SORTIE

beforeAll(() => {
  // action 'preview' : le générateur ouvre un onglet avec un blob ; jsdom n'a ni l'un ni l'autre.
  vi.stubGlobal('open', vi.fn())
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
  if (DOSSIER_SORTIE) mkdirSync(DOSSIER_SORTIE, { recursive: true })
})

const euros = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ') + ' €'

let idLigne = 1
function ligne(description: string, qty: number, unit: string, priceHT: number, tvaRate: number, extra: Partial<ProductLine> = {}): ProductLine {
  return { id: idLigne++, description, qty, unit, priceHT, tvaRate, totalHT: Math.round(qty * priceHT * 100) / 100, ...extra }
}

const demolition: ProductLine[] = [
  ligne('Dépose de la faïence murale', 18.5, 'm2', 22, 10, {
    lineDetail: 'Dépose soignée, évacuation en sacs. Mesurage : surface réelle déposée, ouvertures déduites.',
    etapes: [
      { id: 'e1', ordre: 1, designation: 'Protection des sols' },
      { id: 'e2', ordre: 2, designation: 'Dépose au burin' },
    ] as ProductLine['etapes'],
  }),
  ligne('Dépose de la baignoire et du lavabo', 1, 'f', 280, 10),
]
const plomberie: ProductLine[] = [
  ligne('Création d\'une douche à l\'italienne', 1, 'ens', 2450, 10, {
    lineDetail: 'Receveur extra-plat, siphon de sol, étanchéité sous carrelage (SPEC).',
  }),
  ligne('Fourniture et pose d\'un meuble vasque', 1, 'u', 690, 20),
]
const toutes = [...demolition, ...plomberie]
const totalHT = Math.round(toutes.reduce((s, l) => s + l.totalHT, 0) * 100) / 100
const base10 = Math.round(toutes.filter(l => l.tvaRate === 10).reduce((s, l) => s + l.totalHT, 0) * 100) / 100
const base20 = Math.round(toutes.filter(l => l.tvaRate === 20).reduce((s, l) => s + l.totalHT, 0) * 100) / 100
const tva10 = Math.round(base10 * 10) / 100
const tva20 = Math.round(base20 * 20) / 100
const totalTTC = Math.round((totalHT + tva10 + tva20) * 100) / 100

function entree(docType: 'devis' | 'facture', artisanId: string, surcharge: Partial<PdfV3Input> = {}): PdfV3Input {
  return {
    action: 'preview',
    locale: 'fr',
    localeFormats: { currencyFormat: euros, taxLabel: 'TVA' },
    t,
    docType,
    docNumber: docType === 'devis' ? 'DEV-2026-014' : 'FACT-2026-009',
    docTitle: 'Rénovation de la salle de bain',
    docDate: '2026-10-16',
    docValidity: 30,
    prestationDate: '',
    executionDelay: '10 jours ouvrés',
    companyStatus: 'sas',
    companyName: 'PROVENCE PRO',
    companySiret: '13119725300012',
    companyAddress: '205 Chemin du Haut des Plaines 13650 Meyrargues',
    companyRCS: 'Aix-en-Provence 131 197 253',
    companyCapital: '1 000',
    companyPhone: '06 13 84 22 89',
    companyEmail: 'secretariat.provencepro@gmail.com',
    tvaEnabled: true,
    tvaNumber: 'FR12131197253',
    insuranceName: 'MAAF Pro',
    insuranceNumber: 'DEC-123456',
    insuranceCoverage: 'France métropolitaine',
    insuranceType: 'both',
    decennaleEligibility: 'always',
    mediatorName: '',
    mediatorUrl: '',
    isHorsEtablissement: false,
    clientName: 'Mme Claire Martin',
    clientEmail: 'claire.martin@example.fr',
    clientAddress: '12 rue des Lices 13100 Aix-en-Provence',
    clientPhone: '',
    clientSiret: '',
    clientType: 'particulier',
    interventionAddress: '12 rue des Lices 13100 Aix-en-Provence',
    interventionBatiment: '',
    interventionEtage: '',
    interventionEspacesCommuns: '',
    interventionExterieur: '',
    companyAPE: '4399C',
    paymentMode: 'Virement bancaire',
    paymentDue: '30 jours',
    paymentCondition: '',
    discount: '',
    penaltyRate: '',
    recoveryFee: '40 €',
    iban: 'FR76 3000 4000 0500 0012 3456 789',
    bic: 'BNPAFRPPXXX',
    lines: toutes,
    laborLines: demolition,
    materialLines: [],
    fraisLines: [],
    linesName: 'Démolition',
    customTables: [{ id: 'ct1', name: 'Plomberie et sanitaires', lines: plomberie }],
    subtotalHT: totalHT,
    totalTTC,
    tvaBreakdown: [
      { rate: 20, base: base20, amount: tva20 },
      { rate: 10, base: base10, amount: tva10 },
    ],
    regimeTva: 'classique',
    acomptesEnabled: docType === 'devis',
    acomptes: docType === 'devis'
      ? [
          { id: 'a1', ordre: 1, label: 'Acompte', pourcentage: 50, declencheur: 'à la signature du devis' },
          { id: 'a2', ordre: 2, label: 'Situation', pourcentage: 30, declencheur: 'à mi-chantier' },
          { id: 'a3', ordre: 3, label: 'Solde', pourcentage: 20, declencheur: 'à la réception des travaux' },
        ] as PdfV3Input['acomptes']
      : [],
    notes: '',
    sourceDevisRef: docType === 'facture' ? 'DEV-2026-014' : null,
    signatureData: null,
    attachedRapport: null,
    selectedPhotos: [],
    artisan: { id: artisanId, company_name: 'PROVENCE PRO' },
    ptFiscalData: null,
    svgToImageDataUrl: async () => '',
    fetchFreshLogo: async () => null,
    ...surcharge,
  }
}

async function generer(nom: string, input: PdfV3Input): Promise<string> {
  const { pdfArrayBuffer } = await generateDevisPdfV3(input)
  const octets = Buffer.from(pdfArrayBuffer)
  if (DOSSIER_SORTIE) writeFileSync(join(DOSSIER_SORTIE, `${nom}.pdf`), octets)
  return octets.toString('latin1')
}

const NOTES_RESERVES = [
  'Références : visite du 10/10/2026, photos du client',
  'Base du devis : visite technique du 10/10/2026',
  'Non compris : peinture du plafond, sur devis séparé',
  'Accès par le portail côté jardin.',
].join('\n')

describe('PDF V3 — modèle Provence Pro', () => {
  it('devis : en-tête, lots, réserves et mentions de la SAS', async () => {
    const pdf = await generer('provence-pro-devis', entree('devis', PROVENCE_PRO_ID, {
      modele: modeleDocumentSociete(PROVENCE_PRO_ID),
      notes: NOTES_RESERVES,
    }))
    expect(pdf).toContain('(ProvencePro)')
    expect(pdf).toContain('Sous-total lot A')
    expect(pdf).toContain('Sous-total lot B')
    expect(pdf).toContain('SERVES ET PR')
    expect(pdf).toContain('Base du devis')
    expect(pdf).toContain('Non compris')
    expect(pdf).toContain('BT01')
    expect(pdf).toContain('SAS \\(soci')
    expect(pdf).toContain('205 Chemin du Haut des Plaines, 13650 Meyrargues')
    expect(pdf).toContain('Acc')  // note libre conservée sous les conditions
    expect(pdf).not.toContain('Document g') // pas de « Document généré par Vitfix Pro »
    expect(pdf).not.toContain('(SAS)')      // l'encadré émetteur ne porte que le nom
  })

  it('facture : même habillage, sans réserves ni bon pour accord', async () => {
    const pdf = await generer('provence-pro-facture', entree('facture', PROVENCE_PRO_ID, {
      modele: modeleDocumentSociete(PROVENCE_PRO_ID),
    }))
    expect(pdf).toContain('(ProvencePro)')
    expect(pdf).toContain('Sous-total lot A')
    expect(pdf).toContain('DEV-2026-014')
    expect(pdf).toContain('SAS \\(soci')
    expect(pdf).not.toContain('SERVES ET PR')
    expect(pdf).not.toContain('BON POUR ACCORD')
  })

  it("facture d'acompte : le type de facture reste sous le numéro", async () => {
    const pdf = await generer('provence-pro-acompte', entree('facture', PROVENCE_PRO_ID, {
      modele: 'provence-pro',
      factureSubType: 'acompte',
      acompteOrdre: 1,
      acompteTotal: 3,
      acomptePourcentage: 50,
      parentInvoiceNumber: 'DEV-2026-014',
    }))
    expect(pdf).toContain('ACOMPTE N')
  })

  it('description plus longue qu\'une page : le PDF se termine sans perdre de texte', async () => {
    const longue = ligne('Reprise complète des enduits', 42, 'm2', 38, 10, {
      lineDetail: Array.from({ length: 160 }, (_, i) => `Phrase de descriptif numéro ${i + 1}.`).join(' '),
    })
    const pdf = await generer('provence-pro-long', entree('devis', PROVENCE_PRO_ID, {
      modele: 'provence-pro',
      laborLines: [longue],
      customTables: [],
      lines: [longue],
    }))
    expect(pdf).toContain('160.')
  })
})

describe('PDF V3 — sociétés autres que Provence Pro (modèle par défaut)', () => {
  it("le modèle n'est attribué qu'à la fiche Provence Pro", () => {
    expect(modeleDocumentSociete(PROVENCE_PRO_ID)).toBe('provence-pro')
    expect(modeleDocumentSociete(AUTRE_SOCIETE_ID)).toBeUndefined()
    expect(modeleDocumentSociete(undefined)).toBeUndefined()
    expect(modeleDocumentSociete(null)).toBeUndefined()
  })

  it('devis : modèle par défaut', async () => {
    const pdf = await generer('defaut-devis', entree('devis', AUTRE_SOCIETE_ID))
    expect(pdf).toContain('Document g')
    expect(pdf).toContain('PROVENCE PRO \\(SAS\\)')
    expect(pdf).not.toContain('Sous-total lot')
  })

  it('devis : les notes restent des notes, sans tableau de réserves', async () => {
    const pdf = await generer('defaut-devis-notes', entree('devis', AUTRE_SOCIETE_ID, { notes: NOTES_RESERVES }))
    expect(pdf).not.toContain('SERVES ET PR')
    expect(pdf).toContain('Base du devis : visite technique')
  })

  it('facture : modèle par défaut', async () => {
    const pdf = await generer('defaut-facture', entree('facture', AUTRE_SOCIETE_ID))
    expect(pdf).toContain('Document g')
    expect(pdf).not.toContain('Sous-total lot')
  })
})
