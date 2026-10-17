// Encadré « DESTINATAIRE » du PDF BTP (lib/pdf/devis-pdf-v3.ts) : sa hauteur est
// mesurée sur les lignes réellement dessinées. Avant, une adresse longue (coupée
// sur 2 lignes) ou la TVA intra de l'autoliquidation faisait déborder le texte
// sous l'encadré, et « Lieu : … » disparaissait sans adresse d'intervention.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { generateDevisPdfV3, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import fr from '@/locales/fr.json'

const t = (cle: string): string => {
  const valeur = cle.split('.').reduce<unknown>((noeud, part) => (noeud as Record<string, unknown> | undefined)?.[part], fr)
  return typeof valeur === 'string' ? valeur : cle
}

beforeAll(() => {
  vi.stubGlobal('open', vi.fn())
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
})

const SIRET_CLIENT = '13119725300019'
const ligne = { id: 1, description: 'Ravalement de façade', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 0, totalHT: 1000 }

function entree(surcharge: Partial<PdfV3Input> = {}): PdfV3Input {
  return {
    action: 'preview', locale: 'fr',
    localeFormats: { currencyFormat: (n: number) => `${n.toFixed(2)} €`, taxLabel: 'TVA' },
    t, docType: 'facture', docNumber: 'FACT-2026-040', docTitle: 'Ravalement', docDate: '2026-10-17',
    docValidity: 30, prestationDate: '', executionDelay: '', companyStatus: 'sas', companyName: 'SOUS-TRAITANT BTP',
    companySiret: '', companyAddress: '1 rue A 13001 Marseille', companyRCS: '', companyCapital: '', companyPhone: '',
    companyEmail: '', tvaEnabled: true, tvaNumber: '', insuranceName: '', insuranceNumber: '', insuranceCoverage: '',
    insuranceType: 'rc_pro', decennaleEligibility: 'never', mediatorName: '', mediatorUrl: '', isHorsEtablissement: false,
    clientName: 'Entreprise Générale du Sud', clientEmail: 'travaux@entreprise-generale-du-sud.fr',
    clientAddress: 'Cabinet Ajassociés, service des copropriétés, 54 cours Pierre Puget 13006 Marseille',
    clientPhone: '04 91 00 00 00', clientSiret: SIRET_CLIENT, clientType: 'professionnel',
    interventionAddress: 'Résidence Les Terrasses du Vieux-Port, 12 boulevard Charles Livon 13007 Marseille',
    interventionBatiment: 'B', interventionEtage: '3', interventionEspacesCommuns: 'hall et cage d\'escalier',
    interventionExterieur: 'façade sur cour',
    companyAPE: '', paymentMode: 'Virement bancaire', paymentDue: '30 jours', paymentCondition: '', discount: '',
    penaltyRate: '', recoveryFee: '40 €', iban: '', bic: '',
    lines: [ligne], laborLines: [ligne], materialLines: [], fraisLines: [], linesName: 'Travaux', customTables: [],
    subtotalHT: 1000, totalTTC: 1000, tvaBreakdown: [], regimeTva: 'autoliquidation_btp',
    acomptesEnabled: false, acomptes: [], notes: '', sourceDevisRef: null, signatureData: null,
    attachedRapport: null, selectedPhotos: [], artisan: null, ptFiscalData: null,
    svgToImageDataUrl: async () => '', fetchFreshLogo: async () => null,
    ...surcharge,
  } as PdfV3Input
}

/** Flux de contenu de la page 1 (PDF jsPDF non compressé). */
async function page1(input: PdfV3Input): Promise<string> {
  const { pdfArrayBuffer } = await generateDevisPdfV3(input)
  const pdf = Buffer.from(pdfArrayBuffer).toString('latin1')
  const contenu = pdf.match(/\/Type \/Page\b[^>]*?\/Contents (\d+) 0 R/)?.[1]
    ?? pdf.match(/\/Contents (\d+) 0 R/)?.[1]
  const objet = pdf.match(new RegExp(`\\n${contenu} 0 obj[\\s\\S]*?stream\\r?\\n([\\s\\S]*?)endstream`))
  return objet?.[1] ?? ''
}

/** Encadré destinataire : le rectangle gris (rempli et bordé) de droite du bloc émetteur / destinataire. */
function encadreDestinataire(page: string): { haut: number; bas: number; gauche: number; droite: number } {
  const rects = [...page.matchAll(/^([\d.]+) ([\d.]+) ([\d.]+) (-[\d.]+) re\nB$/gm)].map(m => m.slice(1, 5).map(Number))
  // Le premier couple de rectangles de même hauteur posés côte à côte = émetteur puis destinataire
  const [, dest] = rects
  return { haut: dest[1], bas: dest[1] + dest[3], gauche: dest[0], droite: dest[0] + dest[2] }
}

/** Ordonnée PDF (points) du texte qui contient `fragment`. */
function ordonnee(page: string, fragment: string): number {
  const i = page.indexOf(fragment)
  if (i < 0) return NaN
  const td = [...page.slice(0, i).matchAll(/(-?[\d.]+) (-?[\d.]+) Td/g)].pop()
  return Number(td?.[2])
}

describe('PDF V3 — encadré destinataire', () => {
  it('adresses longues + autoliquidation : la dernière ligne (TVA intra) reste dans l\'encadré', async () => {
    const page = await page1(entree())
    const cadre = encadreDestinataire(page)
    const yTva = ordonnee(page, '(TVA Intra. : FR')
    // Dernière ligne = 14 pt d'interligne + 12 pt de marge au-dessus du bord bas (y PDF vers le haut) :
    // une seule ligne oubliée dans la mesure ramènerait l'écart à 12 pt
    expect(yTva - cadre.bas).toBeCloseTo(26, 0)
    expect(yTva).toBeLessThan(cadre.haut)
    // Pas de chevauchement : la ligne précédente (SIRET) est 14 pt plus haut
    expect(ordonnee(page, '(SIRET : ') - yTva).toBeCloseTo(14, 0)
    // Les deux adresses longues sont bien coupées sur plusieurs lignes
    expect(page).toMatch(/\(Adresse : Cabinet Ajassoci[^)]*\) Tj\s*T\*/)
    expect(page).toMatch(/\(Intervention : R[^)]*\) Tj\s*T\*/)
  })

  it('« Lieu : … » est imprimé même sans adresse d\'intervention', async () => {
    const page = await page1(entree({ interventionAddress: '', interventionBatiment: '', interventionEtage: '' }))
    expect(page).toContain('(Lieu : Espaces communs, hall et cage d\'escalier) Tj')
    expect(page).toContain('Lieu : Ext')
    const cadre = encadreDestinataire(page)
    expect(ordonnee(page, '(TVA Intra. : FR') - cadre.bas).toBeCloseTo(26, 0)
  })

  it('« Lieu : … » trop long est coupé à la largeur de l\'encadré', async () => {
    const page = await page1(entree({
      interventionEspacesCommuns: 'hall d\'entrée, cage d\'escalier A et B, local vélos et local poubelles du rez-de-chaussée',
    }))
    expect(page).toMatch(/\(Lieu : Espaces communs, hall[^)]*\) Tj\s*T\*/)
    const cadre = encadreDestinataire(page)
    expect(ordonnee(page, '(TVA Intra. : FR') - cadre.bas).toBeCloseTo(26, 0)
  })

  it('un nom de client trop long est coupé au lieu de sortir de l\'encadré', async () => {
    const nom = 'Syndicat des copropriétaires de la Résidence Les Terrasses du Vieux-Port'
    const page = await page1(entree({ clientName: nom }))
    expect(page).not.toContain(`(${nom}) Tj`)
    expect(page).toMatch(/\(Syndicat des copropri[^)]*\) Tj\s*T\*/)
  })

  it('destinataire ordinaire : encadré inchangé (une ligne par champ)', async () => {
    const page = await page1(entree({
      clientAddress: '54 cours Pierre Puget 13006 Marseille', interventionAddress: '', interventionBatiment: '',
      interventionEtage: '', interventionEspacesCommuns: '', interventionExterieur: '', regimeTva: 'classique',
    }))
    expect(page).toContain('(Adresse : 54 cours Pierre Puget) Tj')
    expect(page).not.toContain('Lieu :')
  })
})
