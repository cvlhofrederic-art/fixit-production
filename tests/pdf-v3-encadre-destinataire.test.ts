// Encadrés « DESTINATAIRE » et « ÉMETTEUR » du PDF BTP (lib/pdf/devis-pdf-v3.ts) :
// leur hauteur est mesurée sur les lignes réellement dessinées. Avant, une adresse
// longue (coupée sur 2 lignes) ou la TVA intra de l'autoliquidation faisait déborder
// le texte sous l'encadré, et « Lieu : … » disparaissait sans adresse d'intervention.
// Côté émetteur, une adresse trop longue sortait de l'encadré (28/11/2026), et une
// fatura portugaise y répétait registo et capital, déjà dans le pied légal.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { generateDevisPdfV3, mentionRegistoPt, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
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
    clientAddress: 'Cabinet Exemplaire, service des copropriétés, 10 cours Jean Exemple 13006 Marseille',
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
    expect(page).toMatch(/\(Adresse : Cabinet Exemplaire[^)]*\) Tj\s*T\*/)
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
      clientAddress: '10 cours Jean Exemple 13006 Marseille', interventionAddress: '', interventionBatiment: '',
      interventionEtage: '', interventionEspacesCommuns: '', interventionExterieur: '', regimeTva: 'classique',
    }))
    expect(page).toContain('(Adresse : 10 cours Jean Exemple) Tj')
    expect(page).not.toContain('Lieu :')
  })
})

/** Encadré émetteur : le premier rectangle gris (rempli et bordé) du bloc émetteur / destinataire. */
function encadreEmetteur(page: string): { haut: number; bas: number } {
  const [em] = [...page.matchAll(/^([\d.]+) ([\d.]+) ([\d.]+) (-[\d.]+) re\nB$/gm)].map(m => m.slice(1, 5).map(Number))
  return { haut: em[1], bas: em[1] + em[3] }
}

/** Taille de police (Tf) en vigueur au texte qui contient `fragment`. */
function taillePolice(page: string, fragment: string): number {
  const i = page.indexOf(fragment)
  return Number([...page.slice(0, i).matchAll(/\/F\d+ ([\d.]+) Tf/g)].pop()?.[1])
}

/** Tout le texte dessiné, toutes pages, échappements jsPDF retirés, chaînes mises bout à bout. */
async function texteComplet(input: PdfV3Input): Promise<string> {
  const { pdfArrayBuffer } = await generateDevisPdfV3(input)
  const pdf = Buffer.from(pdfArrayBuffer).toString('latin1')
  return [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(m => m[1].replaceAll(/\\(.)/g, '$1')).join(' ')
}

// Fatura d'une société portugaise (données fictives) : la morada de l'émetteur est plus large que l'encadré.
const MORADA_LONGA = 'Avenida do Exemplo Imaginario, 109, Bloco B, 6.o Dto. Frente, 4000-000 Porto'
const REGISTO = 'CRC do Porto, matricula n.o 123456789'

function entreePt(surcharge: Partial<PdfV3Input> = {}): PdfV3Input {
  return entree({
    locale: 'pt', docNumber: 'FA-2026-001', docTitle: 'Reparacao do beirado', companyStatus: 'lda',
    companyName: 'CONSTRUCOES EXEMPLO, LDA', companyAddress: MORADA_LONGA, companySiret: '123456789',
    companyRCS: REGISTO, companyAPE: '41000-R4', companyCapital: '5.000,00', companyPhone: '+351 900 000 000',
    companyEmail: 'geral@exemplo.pt', clientName: 'Cliente Exemplo', clientAddress: 'Rua Exemplo, 1, 4000-000 Porto',
    clientEmail: '', clientPhone: '', clientSiret: '', clientType: 'particulier', interventionAddress: '',
    interventionBatiment: '', interventionEtage: '', interventionEspacesCommuns: '', interventionExterieur: '',
    regimeTva: 'classique',
    ...surcharge,
  })
}

describe('PDF V3 — encadré émetteur', () => {
  it('une morada trop longue va à la ligne, en 10 pt, au lieu de sortir de l\'encadré', async () => {
    const page = await page1(entreePt())
    expect(page).not.toContain(`(Morada : ${MORADA_LONGA}) Tj`)
    expect(page).toMatch(/\(Morada : Avenida do Exemplo[^)]*\) Tj\s*T\*\s*\([^)]*Porto\) Tj/)
    // Avant : rétrécie jusqu'à 8 pt, puis débordement sur la colonne du destinataire
    expect(taillePolice(page, '(Morada : Avenida')).toBe(10)
    // La hauteur de l'encadré compte les deux lignes : la dernière ligne (CAE) garde 14 pt d'interligne
    // + 12 pt de marge au-dessus du bord bas
    const cadre = encadreEmetteur(page)
    expect(ordonnee(page, '(CAE : 41000-R4) Tj') - cadre.bas).toBeCloseTo(26, 0)
  })

  it('document portugais : ni registo ni capital dans l\'encadré, tous deux dans le pied légal', async () => {
    const texte = await texteComplet(entreePt())
    const encadre = texte.slice(texte.indexOf('EMITENTE'), texte.indexOf('DESTINAT'))
    expect(encadre).not.toContain('CRC do Porto')
    expect(encadre).not.toContain('Capital')
    expect(encadre).toContain('NIF : 123456789')
    expect(encadre).toContain('CAE : 41000-R4')
    expect(texte).toContain(`Registo comercial : ${REGISTO}.`)
    expect(texte).toContain('Capital social : 5.000,00 EUR.')
  })

  it('document portugais : le pied légal dit NIF et CAE, pas SIRET ni APE', async () => {
    const texte = await texteComplet(entreePt())
    expect(texte).toContain(' NIF : 123456789. CAE : 41000-R4.')
    expect(texte).not.toMatch(/SIRET|APE :/)
  })

  it('registo du pied légal : cas limites', () => {
    expect(mentionRegistoPt('')).toBe('')
    expect(mentionRegistoPt(' . ')).toBe('')
    expect(mentionRegistoPt('...')).toBe('')
    expect(mentionRegistoPt('Porto 123 .')).toBe('Registo comercial : Porto 123.')
    expect(mentionRegistoPt('CRC do Porto 123..')).toBe('Registo comercial : CRC do Porto 123.')
    expect(mentionRegistoPt('RM CRC do Porto 123')).toBe('Registo comercial : CRC do Porto 123.')
    expect(mentionRegistoPt('CRC Lisboa, Alvara 999')).toBe('Registo comercial : CRC Lisboa, Alvara 999.')
    expect(mentionRegistoPt('IMPIC 12345')).toBe('Alvará : IMPIC 12345.')
    expect(mentionRegistoPt('Conservatória do Porto 12345')).toBe('Conservatória do Porto 12345.')
    // Linéaire : une longue suite de points ne bloque pas (l'ancienne regex /\.+$/ était quadratique)
    expect(mentionRegistoPt(`${'.'.repeat(50_000)}x`)).toMatch(/^Registo comercial : \.+x\.$/)
  })

  it('un alvará saisi à la place du registo garde son libellé dans le pied légal', async () => {
    const texte = await texteComplet(entreePt({ companyRCS: 'Alvara n.o 12345-PUB' }))
    expect(texte).toContain(' Alvara n.o 12345-PUB.')
    expect(texte).not.toContain('Registo comercial :')
  })

  it('document français : RCS et capital restent dans l\'encadré, adresse courte sur une ligne', async () => {
    const page = await page1(entree({ companyRCS: 'RCS Marseille 123 456 789', companyCapital: '10 000' }))
    expect(page).toContain('(RCS Marseille : 123456789) Tj')
    expect(page).toContain('(Capital : 10 000 EUR) Tj')
    expect(page).toContain('(Adresse : 1 rue A) Tj')
    expect(page).toContain('(Ville : 13001 Marseille) Tj')
  })

  it('document français : une adresse un peu large est rétrécie sur une ligne, comme avant', async () => {
    const page = await page1(entree({ companyAddress: '1234 avenue du Marechal de Lattre de Tassigny 13001 Marseille' }))
    expect(page).toContain('(Adresse : 1234 avenue du Marechal de Lattre de Tassigny) Tj')
    expect(taillePolice(page, '(Adresse : 1234')).toBeLessThan(10)
  })

  it('document français : une adresse trop large même en 8 pt va à la ligne en 10 pt', async () => {
    const page = await page1(entree({
      companyAddress: 'Zone artisanale des Exemples, batiment C, lot 12, 1250 chemin du Vallon des Exemples 13001 Marseille',
    }))
    expect(page).toMatch(/\(Adresse : Zone artisanale[^)]*\) Tj\s*T\*/)
    expect(taillePolice(page, '(Adresse : Zone')).toBe(10)
  })

  it('un nom de société sur trois lignes agrandit l\'encadré au lieu de déborder', async () => {
    const page = await page1(entreePt({
      companyName: 'CONSTRUCOES E REABILITACAO DO EXEMPLO IMAGINARIO DO NORTE E CENTRO, UNIPESSOAL, LDA',
      companyAddress: 'Rua A, 1', companyPhone: '', companyEmail: '', companySiret: '', companyAPE: '41000-R4',
    }))
    const cadre = encadreEmetteur(page)
    expect(ordonnee(page, '(CAE : 41000-R4) Tj') - cadre.bas).toBeGreaterThanOrEqual(25.5)
  })
})
