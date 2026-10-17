// Modèle de devis et de facture de PROVENCE PRO (lib/pdf/modele-provence-pro.ts) : modèle BTP
// par défaut + logo vectoriel centré, contenu décalé de 22,9 pt et filet rouge brique.
// Le générateur V3 tourne ici pour de vrai (jsPDF dans jsdom) : on vérifie le
// texte du PDF produit, pour Provence Pro comme pour une autre société BTP.
// Avec PDF_SORTIE=<dossier>, les PDF sont aussi écrits sur disque pour un
// contrôle visuel.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateDevisPdfV3, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import { modeleDocumentSociete } from '@/lib/pdf/modele-provence-pro'
import {
  LOGO_PROVENCE_PRO_CHEMINS,
  LOGO_PROVENCE_PRO_HAUT_PT,
  LOGO_PROVENCE_PRO_LARGEUR_PT,
} from '@/lib/pdf/provence-pro-logo'
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

/** Flux de contenu de chaque page, dans l'ordre (PDF jsPDF non compressé). */
function pages(pdf: string): string[] {
  const objets = new Map<string, string>()
  for (const m of pdf.matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g)) objets.set(m[1], m[2])
  const kids = (pdf.match(/\/Kids \[([^\]]*)\]/) || [])[1]?.match(/\d+(?= 0 R)/g) ?? []
  return kids.map((k) => {
    const contenu = (objets.get(k) ?? '').match(/\/Contents (\d+) 0 R/)?.[1] ?? ''
    return (objets.get(contenu) ?? '').split(/stream\r?\n/)[1] ?? ''
  })
}

const compter = (texte: string, motif: RegExp) => (texte.match(motif) ?? []).length
const COURBES = /^.+ c$/gm
// Couleurs telles que jsPDF les écrit (2 décimales)
const ORANGE = /^0\.91 0\.63 0\.13 rg$/m    // #E8A020 : orange du modèle par défaut
const LOGO_PROVENCE = /^0\.1 0\.11 0\.12 rg$/m
const LOGO_SLOGAN = /^0\.48 0\.44 0\.4 rg$/m
// Filet sous le numéro : rectangle plein de 3 pt de haut sur toute la largeur utile
const filet = (couleur: string) => new RegExp(`^${couleur} rg\\n51\\.02\\d* ([\\d.]+) 493\\.23\\d* -2\\.99\\d* re\\nf$`, 'm')
const FILET_ROUGE = filet('0\\.76 0\\.25 0\\.05')   // #c2410c
const FILET_ORANGE = filet('0\\.91 0\\.63 0\\.13')  // #E8A020

/** Ordonnée PDF (points) du premier texte de la page qui contient `fragment`. */
function ordonnee(page: string, fragment: string): number {
  const i = page.indexOf(fragment)
  if (i < 0) return NaN
  const td = [...page.slice(0, i).matchAll(/(-?[\d.]+) (-?[\d.]+) Td/g)].pop()
  return Number(td?.[2])
}

/** Ordonnée PDF (points) du premier texte de la page. */
function premiereOrdonnee(page: string): number {
  return Number(page.match(/(-?[\d.]+) (-?[\d.]+) Td/)?.[2])
}

/** Points (m, l, c) du logo tels qu'écrits dans la page, en points PDF. */
function pointsLogo(page: string): number[][] {
  const debut = page.search(LOGO_PROVENCE)
  const fin = page.indexOf('\nf\n', page.search(LOGO_SLOGAN))
  return page.slice(debut, fin).split('\n').filter(l => / [mlc]$/.test(l)).map(l => l.split(' ').slice(0, -1).map(Number))
}

/** Points attendus du logo, centré sur une page A4 (595,28 × 841,89 pt). */
function pointsLogoAttendus(): number[][] {
  const x0 = 595.28 / 2 - LOGO_PROVENCE_PRO_LARGEUR_PT / 2
  const points: number[][] = []
  for (const { chemin } of LOGO_PROVENCE_PRO_CHEMINS) {
    for (const segment of chemin.match(/[MLC][^MLCZ]*/g) ?? []) {
      const n = segment.slice(1).trim().split(' ').map(Number)
      const p: number[] = []
      for (let i = 0; i < n.length; i += 2) p.push(x0 + n[i], 841.89 - LOGO_PROVENCE_PRO_HAUT_PT - n[i + 1])
      points.push(p)
    }
  }
  return points
}

const NOTES = [
  'Base du devis : visite technique du 10/10/2026',
  'Non compris : peinture du plafond, sur devis séparé',
].join('\n')

describe('PDF V3 — modèle Provence Pro (devis de référence du 16/10/2026)', () => {
  it('devis : logo vectoriel centré, filet rouge, contenu décalé de 22,9 pt, reste identique', async () => {
    const fetchFreshLogo = vi.fn(async () => null)
    const pdf = await generer('provence-pro-devis', entree('devis', PROVENCE_PRO_ID, {
      modele: modeleDocumentSociete(PROVENCE_PRO_ID),
      notes: NOTES,
      fetchFreshLogo,
    }))
    const defaut = await generer('defaut-devis-comparaison', entree('devis', PROVENCE_PRO_ID, { notes: NOTES }))
    const [p1, p2] = pages(pdf)
    const [d1, d2] = pages(defaut)

    // Logo vectoriel : 568 courbes en trois couleurs, en plus de la page par défaut
    expect(compter(p1, COURBES) - compter(d1, COURBES)).toBe(568)
    expect(p1).toMatch(LOGO_PROVENCE)
    expect(p1).toMatch(LOGO_SLOGAN)
    // … à la place, à la taille et dans le sens de la référence (centré, 38,7 pt sous le haut de page)
    const points = pointsLogo(p1)
    const attendus = pointsLogoAttendus()
    expect(points.length).toBe(attendus.length)
    const ecartMax = Math.max(...points.flatMap((p, i) => p.map((v, j) => Math.abs(v - attendus[i][j]))))
    expect(ecartMax).toBeLessThan(0.01)
    // Pas de logo image en haut à droite : le logo de la fiche n'est même pas chargé
    expect(fetchFreshLogo).not.toHaveBeenCalled()
    expect(pdf).not.toContain('/Subtype /Image')
    // Filet rouge brique, plus aucun orange
    expect(p1).toMatch(FILET_ROUGE)
    expect(pdf).not.toMatch(ORANGE)
    expect(d1).toMatch(FILET_ORANGE)
    // Titre, numéro et filet descendent de 22,9 pt sous le logo…
    expect(ordonnee(d1, 'DEV-2026-014') - ordonnee(p1, 'DEV-2026-014')).toBeCloseTo(22.9, 2)
    expect(Number(d1.match(FILET_ORANGE)?.[1]) - Number(p1.match(FILET_ROUGE)?.[1])).toBeCloseTo(22.9, 2)
    // … mais la page 2 commence au même endroit que dans le modèle par défaut
    expect(ordonnee(p2, 'Sous-total HT')).toBeCloseTo(ordonnee(d2, 'Sous-total HT'), 2)
    expect(premiereOrdonnee(p2)).toBeCloseTo(premiereOrdonnee(d2), 2)
    // Le reste est le modèle BTP par défaut : encadré émetteur complet, notes, pied de page
    expect(pdf).toContain('(PROVENCE PRO \\(SAS\\))')
    expect(pdf).toContain('Base du devis : visite technique')
    expect(pdf).toContain('Document g')
  })

  it('facture : même habillage', async () => {
    const fetchFreshLogo = vi.fn(async () => null)
    const pdf = await generer('provence-pro-facture', entree('facture', PROVENCE_PRO_ID, {
      modele: modeleDocumentSociete(PROVENCE_PRO_ID),
      fetchFreshLogo,
    }))
    const [p1] = pages(pdf)
    expect(compter(p1, COURBES)).toBeGreaterThanOrEqual(568)
    expect(p1).toMatch(LOGO_PROVENCE)
    expect(p1).toMatch(FILET_ROUGE)
    expect(pdf).not.toMatch(ORANGE)
    expect(fetchFreshLogo).not.toHaveBeenCalled()
    expect(pdf).toContain('FACT-2026-009')
    expect(pdf).toContain('DEV-2026-014')
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
    expect(pdf).not.toMatch(ORANGE)
    // Ordre de haut en bas (ordonnées PDF décroissantes) : numéro, type de facture, filet
    const [p1] = pages(pdf)
    const yNumero = ordonnee(p1, '(FACT-2026-009) Tj')
    const yType = ordonnee(p1, 'ACOMPTE N')
    const yFilet = Number(p1.match(FILET_ROUGE)?.[1])
    expect(yNumero).toBeGreaterThan(yType)
    expect(yType).toBeGreaterThan(yFilet)
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
    // Le logo n'est dessiné qu'en première page, et les pages suivantes ne sont pas
    // décalées : leur premier texte reste dans les 30 premiers mm (22,9 pt de plus l'en sortiraient)
    const [p1, ...suite] = pages(pdf)
    expect(p1).toMatch(LOGO_PROVENCE)
    expect(suite.length).toBeGreaterThan(0)
    for (const p of suite) {
      expect(p).not.toMatch(LOGO_PROVENCE)
      expect(premiereOrdonnee(p)).toBeGreaterThan(841.89 - 30 * 72 / 25.4)
    }
  })
})

describe('PDF V3 — sociétés autres que Provence Pro (modèle par défaut)', () => {
  it("le modèle n'est attribué qu'à la fiche Provence Pro", () => {
    expect(modeleDocumentSociete(PROVENCE_PRO_ID)).toBe('provence-pro')
    expect(modeleDocumentSociete(AUTRE_SOCIETE_ID)).toBeUndefined()
    expect(modeleDocumentSociete(undefined)).toBeUndefined()
    expect(modeleDocumentSociete(null)).toBeUndefined()
  })

  it('devis : filet orange, logo image de la fiche, pas de logo vectoriel', async () => {
    const fetchFreshLogo = vi.fn(async () => null)
    const pdf = await generer('defaut-devis', entree('devis', AUTRE_SOCIETE_ID, {
      modele: modeleDocumentSociete(AUTRE_SOCIETE_ID),
      fetchFreshLogo,
    }))
    expect(fetchFreshLogo).toHaveBeenCalledTimes(1)
    expect(pdf).toMatch(FILET_ORANGE)
    expect(pdf).not.toMatch(FILET_ROUGE)
    expect(pdf).not.toMatch(LOGO_PROVENCE)
    expect(pdf).toContain('Document g')
    expect(pdf).toContain('PROVENCE PRO \\(SAS\\)')
  })

  it('facture : modèle par défaut', async () => {
    const pdf = await generer('defaut-facture', entree('facture', AUTRE_SOCIETE_ID))
    expect(pdf).toMatch(FILET_ORANGE)
    expect(pdf).not.toMatch(LOGO_PROVENCE)
    expect(pdf).toContain('Document g')
  })
})
