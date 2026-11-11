// Mode « fichier » du générateur PDF BTP (lib/pdf/devis-pdf-v3.ts), utilisé par le téléchargement groupé des
// listes Devis et Factures : le PDF est le même qu'en « download », mais rien n'est ouvert ni téléchargé —
// le fichier final est rendu à l'appelant, qui le range dans l'archive ZIP.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import { generateDevisPdfV3, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import fr from '@/locales/fr.json'

const t = (cle: string): string => {
  const valeur = cle.split('.').reduce<unknown>((noeud, part) => (noeud as Record<string, unknown> | undefined)?.[part], fr)
  return typeof valeur === 'string' ? valeur : cle
}

const ligne = { id: 1, description: 'Ravalement de façade', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 10, totalHT: 1000 }

function entree(action: PdfV3Input['action']): PdfV3Input {
  return {
    action, locale: 'fr',
    localeFormats: { currencyFormat: (n: number) => `${n.toFixed(2)} €`, taxLabel: 'TVA' },
    t, docType: 'devis', docNumber: 'DEV-2026-030', docTitle: 'Ravalement', docDate: '2026-10-17',
    docValidity: 30, prestationDate: '', executionDelay: '', companyStatus: 'sas', companyName: 'SUD TRAVAUX',
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
  } as PdfV3Input
}

/** PDF sans ce qui change d'une génération à l'autre (dates de création, identifiant du fichier). */
const sansHorodatage = (octets: Uint8Array): string =>
  Buffer.from(octets).toString('latin1')
    .replace(/\/(CreationDate|ModDate) \(D:[^)]*\)/g, '')
    .replace(/\/ID \[[^\]]*\]/g, '')

const createObjectURL = URL.createObjectURL
const revokeObjectURL = URL.revokeObjectURL
let clic: { mockRestore: () => void } | null = null
// Enregistrement jsPDF (pdf.save) : c'est par lui que le mode « download » télécharge un PDF sans Factur-X.
// Sous Vitest, jsPDF est sa version Node, dont save() écrit le fichier sur le disque (fs.writeFileSync) :
// l'écriture d'un .pdf est interceptée (ni fichier laissé dans le dépôt, ni téléchargement manqué).
const ecrireFichier = fs.writeFileSync
let enregistrement: ReturnType<typeof vi.spyOn> | null = null
const ouvrir = vi.fn()

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
  vi.stubGlobal('open', ouvrir)
  ouvrir.mockClear()
  clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  enregistrement = vi.spyOn(fs, 'writeFileSync').mockImplementation(((chemin: unknown, ...reste: unknown[]) => {
    if (typeof chemin === 'string' && chemin.toLowerCase().endsWith('.pdf')) return undefined
    return (ecrireFichier as (...args: unknown[]) => void)(chemin, ...reste)
  }) as typeof fs.writeFileSync)
})
afterEach(() => {
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
  clic?.mockRestore()
  enregistrement?.mockRestore()
  vi.unstubAllGlobals()
})

describe('generateDevisPdfV3 — mode « fichier »', () => {
  it('rend le PDF sans rien ouvrir ni télécharger', async () => {
    const resultat = await generateDevisPdfV3(entree('fichier'))
    expect(resultat.filename).toBe('Devis_DEV-2026-030_Jean_Dupont.pdf')
    expect(Buffer.from(resultat.fichier.slice(0, 5)).toString('latin1')).toBe('%PDF-')
    expect(enregistrement).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(ouvrir).not.toHaveBeenCalled()
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  })

  it('même PDF qu\'en « download » (qui, lui, déclenche un téléchargement)', async () => {
    const telechargement = await generateDevisPdfV3(entree('download'))
    expect(enregistrement).toHaveBeenCalledTimes(1)
    expect(enregistrement?.mock.calls[0][0]).toBe('Devis_DEV-2026-030_Jean_Dupont.pdf')
    const groupe = await generateDevisPdfV3(entree('fichier'))
    expect(enregistrement).toHaveBeenCalledTimes(1)
    expect(sansHorodatage(groupe.fichier)).toBe(sansHorodatage(telechargement.fichier))
    expect(groupe.filename).toBe(telechargement.filename)
  })
})
