// Entrée d'exemple du générateur PDF BTP (lib/pdf/devis-pdf-v3.ts), commune aux tests qui produisent un PDF V3 :
// un devis de ravalement d'une société en SAS, une ligne à 1 000 € HT et TVA à 10 %. Chaque test ne surcharge que ce
// qui le concerne (numéro, date, société, client, images…).
import { generateDevisPdfV3, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import fr from '@/locales/fr.json'
import pt from '@/locales/pt.json'

/** Traduction d'une clé du générateur dans un dictionnaire (la clé elle-même si elle n'existe pas). */
const traductionDans = (dictionnaire: unknown) => (cle: string): string => {
  const valeur = cle.split('.').reduce<unknown>((noeud, part) => (noeud as Record<string, unknown> | undefined)?.[part], dictionnaire)
  return typeof valeur === 'string' ? valeur : cle
}

/** Traduction française d'une clé du générateur (la clé elle-même si elle n'existe pas). */
export const traductionFr = traductionDans(fr)

/** Traduction portugaise d'une clé du générateur (la clé elle-même si elle n'existe pas). */
export const traductionPt = traductionDans(pt)

/**
 * Textes dessinés dans le PDF produit, toutes pages, dans l'ordre, échappements jsPDF retirés (le contenu
 * n'est pas compressé : chaque chaîne est un opérateur « (…) Tj »).
 */
export async function textesPdfV3(input: PdfV3Input): Promise<string[]> {
  const { pdfArrayBuffer } = await generateDevisPdfV3(input)
  const pdf = Buffer.from(pdfArrayBuffer).toString('latin1')
  return [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(m => m[1].replaceAll(/\\(.)/g, '$1'))
}

/** Ligne de devis de l'exemple : 1 000 € HT, TVA à 10 %. */
export const LIGNE_V3 = { id: 1, description: 'Ravalement de façade', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 10, totalHT: 1000 }

export function entreePdfV3(surcharge: Partial<PdfV3Input> = {}): PdfV3Input {
  return {
    action: 'fichier', locale: 'fr',
    localeFormats: { currencyFormat: (n: number) => `${n.toFixed(2)} €`, taxLabel: 'TVA' },
    t: traductionFr, docType: 'devis', docNumber: 'DEV-2026-030', docTitle: 'Ravalement', docDate: '2026-10-17',
    docValidity: 30, prestationDate: '', executionDelay: '', companyStatus: 'sas', companyName: 'SUD TRAVAUX',
    companySiret: '', companyAddress: '1 rue A 13001 Marseille', companyRCS: '', companyCapital: '', companyPhone: '',
    companyEmail: '', tvaEnabled: true, tvaNumber: '', insuranceName: '', insuranceNumber: '', insuranceCoverage: '',
    insuranceType: 'rc_pro', decennaleEligibility: 'never', mediatorName: '', mediatorUrl: '', isHorsEtablissement: false,
    clientName: 'Jean Dupont', clientEmail: '', clientAddress: '3 impasse des Lilas 13008 Marseille', clientPhone: '',
    clientSiret: '', clientType: 'particulier', interventionAddress: '12 rue de la Paix 13001 Marseille',
    interventionBatiment: '', interventionEtage: '', interventionEspacesCommuns: '', interventionExterieur: '',
    companyAPE: '', paymentMode: 'Virement bancaire', paymentDue: '30 jours', paymentCondition: '', discount: '',
    penaltyRate: '', recoveryFee: '40 €', iban: '', bic: '',
    lines: [LIGNE_V3], laborLines: [LIGNE_V3], materialLines: [], fraisLines: [], linesName: 'Travaux', customTables: [],
    subtotalHT: 1000, totalTTC: 1100, tvaBreakdown: [{ rate: 10, base: 1000, amount: 100 }], regimeTva: 'classique',
    acomptesEnabled: false, acomptes: [], notes: '', sourceDevisRef: null, signatureData: null,
    attachedRapport: null, selectedPhotos: [], artisan: null, ptFiscalData: null,
    svgToImageDataUrl: async () => '', fetchFreshLogo: async () => null,
    ...surcharge,
  } as PdfV3Input
}
