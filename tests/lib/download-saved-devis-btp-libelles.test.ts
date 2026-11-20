// Téléchargement BTP depuis la liste (downloadSavedDevis → generateDevisPdfV3) :
// délai, titre par défaut et type de client suivent les mêmes règles que
// l'aperçu du formulaire BTP (lib/devis-btp-libelles.ts).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const recu = vi.hoisted(() => ({
  entrees: [] as Array<Record<string, unknown>>,
  fiche: {} as Record<string, unknown>,
}))

vi.mock('@/lib/supabase', () => {
  const chaine: Record<string, unknown> = {}
  let colonnes: string[] = []
  // Comme PostgREST : seules les colonnes demandées par le select reviennent
  chaine.select = (liste: string) => { colonnes = liste.split(',').map((c) => c.trim()); return chaine }
  chaine.eq = () => chaine
  chaine.single = async () => {
    const fiche: Record<string, unknown> = { paiement_modes: [], categories: null, type_activite: null, logo_url: null, ...recu.fiche }
    return { data: Object.fromEntries(Object.entries(fiche).filter(([cle]) => colonnes.includes(cle))), error: null }
  }
  return { supabase: { from: () => chaine } }
})

vi.mock('@/lib/pdf/devis-pdf-v3', () => ({
  generateDevisPdfV3: vi.fn(async (entree: Record<string, unknown>) => {
    recu.entrees.push(entree)
    return { filename: 'x.pdf', pdfArrayBuffer: new ArrayBuffer(0) }
  }),
}))

const SIRET_VALIDE = '13119725300019'

function document(surcharge: Record<string, unknown> = {}) {
  return {
    docType: 'devis',
    docNumber: 'DEV-2026-030',
    docTitle: 'Ravalement',
    docDate: '2026-10-17',
    clientName: 'M. Client',
    clientType: 'particulier',
    clientSiret: '',
    isHorsEtablissement: true,
    lines: [{ id: 1, description: 'Lavage', qty: 1, unit: 'f', priceHT: 100, tvaRate: 10, totalHT: 100 }],
    ...surcharge,
  }
}

async function telecharger(doc: Record<string, unknown>, locale: 'fr' | 'pt' = 'fr') {
  const { downloadSavedDevis } = await import('@/lib/pdf/download-saved-devis')
  await downloadSavedDevis(doc as never, {
    locale, t: (k: string) => k, artisan: { id: '11111111-2222-3333-4444-555555555555' }, useBtpDesign: true,
  })
  return recu.entrees[recu.entrees.length - 1]
}

beforeEach(() => { recu.entrees.length = 0; recu.fiche = {} })

describe('downloadSavedDevis (BTP) — libellés alignés sur le formulaire', () => {
  it("délai en semaines ou en mois : l'unité est gardée", async () => {
    expect((await telecharger(document({ executionDelayDays: 5, executionDelayType: 'semaines' }))).executionDelay).toBe('5 semaines')
    expect((await telecharger(document({ executionDelayDays: 2, executionDelayType: 'mois' }))).executionDelay).toBe('2 mois')
    expect((await telecharger(document({ executionDelayDays: 10, executionDelayType: 'ouvres' }))).executionDelay).toBe('10 jours ouvrés')
    expect((await telecharger(document({ executionDelayDays: 3, executionDelayType: 'semaines' }), 'pt')).executionDelay).toBe('3 semanas')
  })

  it('un délai déjà rédigé (ancien format) est repris tel quel', async () => {
    const e = await telecharger(document({ executionDelay: '3 à 4 semaines', executionDelayDays: 5, executionDelayType: 'ouvres' }))
    expect(e.executionDelay).toBe('3 à 4 semaines')
  })

  it('facture sans titre : « Facture N° », en portugais « Fatura N° »', async () => {
    expect((await telecharger(document({ docType: 'facture', docNumber: 'FACT-2026-009', docTitle: '' }))).docTitle).toBe('Facture FACT-2026-009')
    expect((await telecharger(document({ docType: 'facture', docNumber: 'FT-9', docTitle: '' }), 'pt')).docTitle).toBe('Fatura FT-9')
    expect((await telecharger(document({ docTitle: '' }))).docTitle).toBe('Devis DEV-2026-030')
  })

  it('particulier avec un SIRET valide : traité en professionnel, sans rétractation hors établissement', async () => {
    const e = await telecharger(document({ clientType: 'particulier', clientSiret: SIRET_VALIDE, isHorsEtablissement: true }))
    expect(e.clientType).toBe('professionnel')
    expect(e.isHorsEtablissement).toBe(false)
  })

  it('particulier sans SIRET valide : inchangé', async () => {
    const e = await telecharger(document({ clientType: 'particulier', clientSiret: '12345678901234', isHorsEtablissement: true }))
    expect(e.clientType).toBe('particulier')
    expect(e.isHorsEtablissement).toBe(true)
    const ancien = await telecharger(document({ clientType: 'particulier', isHorsEtablissement: undefined }))
    expect(ancien.isHorsEtablissement).toBe(true)
  })

  it('ancien devis sans type de client ni rétractation enregistrée (démo) : pas de rétractation, comme avant', async () => {
    const e = await telecharger(document({ clientType: undefined, isHorsEtablissement: undefined }))
    expect(e.clientType).toBe('particulier')
    expect(e.isHorsEtablissement).toBe(false)
  })

  it('avoir sans titre : « Avoir N° »', async () => {
    const e = await telecharger(document({ docType: 'facture', factureSubType: 'avoir', docNumber: 'AV-2026-001', docTitle: '' }))
    expect(e.docTitle).toBe('Avoir AV-2026-001')
  })

  it('sans délai : chaîne vide (le PDF affiche lui-même « À convenir »)', async () => {
    expect((await telecharger(document({ executionDelayDays: 0 }))).executionDelay).toBe('')
  })

  it('identité légale vide dans le devis : reprise de la fiche société, comme le formulaire', async () => {
    recu.fiche = {
      siret: '13119725300019', company_address: '205 Chemin du Haut des Plaines 13650 Meyrargues',
      rcs_number: 'RCS Aix-en-Provence 131 197 253', share_capital: '600', tva_intra: 'FR12131197253', ape_code: '4120A',
    }
    const e = await telecharger(document())
    expect(e).toMatchObject({
      companySiret: '13119725300019', companyAddress: '205 Chemin du Haut des Plaines 13650 Meyrargues',
      companyRCS: 'RCS Aix-en-Provence 131 197 253', companyCapital: '600', tvaNumber: 'FR12131197253', companyAPE: '4120A',
    })
  })

  it('identité légale enregistrée dans le devis : prioritaire sur la fiche', async () => {
    recu.fiche = { rcs_number: 'RCS Marseille 999 999 999', share_capital: '5000' }
    const e = await telecharger(document({ companyRCS: 'RCS Aix-en-Provence 131 197 253', companyCapital: '600' }))
    expect(e).toMatchObject({ companyRCS: 'RCS Aix-en-Provence 131 197 253', companyCapital: '600' })
  })
})

// Demande de Frédéric du 20/11/2026 : orçamentos d'une société portugaise émis le 17/11 avant le correctif des formes
// portugaises, enregistrés en « Entreprise Individuelle (EI) » avec la couverture française par défaut de la fiche.
describe('downloadSavedDevis (BTP) — anciens documents d\'une société portugaise', () => {
  const ANCIEN = { companyStatus: 'Entreprise Individuelle (EI)', insuranceName: 'Seguradora Exemplo', insuranceNumber: 'RC-2026-000123' }

  it('forme portugaise de la fiche à la place de l\'EI, couverture française remplacée par le défaut portugais', async () => {
    recu.fiche = { legal_form: 'Sociedade por Quotas (Lda.)' }
    const e = await telecharger(document({ ...ANCIEN, insuranceCoverage: 'France metropolitaine' }), 'pt')
    expect(e).toMatchObject({ companyStatus: 'lda', insuranceCoverage: 'Portugal continental' })
    // Sur /fr aussi : le modèle V3 n'imprime pas son défaut « France métropolitaine »
    expect(await telecharger(document({ ...ANCIEN, insuranceCoverage: '' }))).toMatchObject({ companyStatus: 'lda', insuranceCoverage: 'Portugal continental' })
  })

  it('forme portugaise déjà enregistrée et couverture portugaise : gardées', async () => {
    recu.fiche = { legal_form: 'Sociedade por Quotas (Lda.)' }
    const e = await telecharger(document({ ...ANCIEN, companyStatus: 'Sociedade Anónima (SA)', insuranceCoverage: 'Portugal' }), 'pt')
    expect(e).toMatchObject({ companyStatus: 'sa', insuranceCoverage: 'Portugal' })
  })

  it('société française : EI et « France métropolitaine » du document gardés, comme avant', async () => {
    recu.fiche = { legal_form: 'SAS' }
    const e = await telecharger(document({ ...ANCIEN, insuranceCoverage: 'France métropolitaine' }))
    expect(e).toMatchObject({ companyStatus: 'ei', insuranceCoverage: 'France métropolitaine' })
    recu.fiche = {}
    expect(await telecharger(document({ ...ANCIEN, companyStatus: '', insuranceCoverage: undefined }))).toMatchObject({ companyStatus: 'ei', insuranceCoverage: '' })
  })
})
