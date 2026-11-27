// Téléchargement BTP depuis la liste (downloadSavedDevis → generateDevisPdfV3) : le PDF est dans la langue de la
// SOCIÉTÉ (fiche relue au téléchargement, lib/btp/langue-documents.ts), plus dans celle de l'écran.
// Constat du 27/11/2026 : facture d'acompte AC-2026-030 de SUD TRAVAUX (société française) téléchargée depuis /pt →
// « FATURA DE ADIANTAMENTO », « EMITENTE », « Sociedade Anónima », DL 62/2013 et Código Civil.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const recu = vi.hoisted(() => ({
  entrees: [] as Array<Record<string, unknown>>,
  fiche: {} as Record<string, unknown>,
  echec: false,
}))

vi.mock('@/lib/supabase', async () => {
  const { COLONNES_PROFILES_ARTISAN_PRODUCTION } = await import('../helpers/colonnes-profiles-artisan')
  const colonnesProduction = new Set(COLONNES_PROFILES_ARTISAN_PRODUCTION)
  const chaine: Record<string, unknown> = {}
  let colonnes: string[] = []
  // Comme PostgREST : seules les colonnes demandées reviennent, toujours présentes (null si vides) ; une colonne absente
  // de la production fait échouer tout le select (42703).
  chaine.select = (liste: string) => { colonnes = liste.split(',').map((c) => c.trim()); return chaine }
  chaine.eq = () => chaine
  chaine.single = async () => {
    if (recu.echec) return { data: null, error: { code: 'PGRST000', message: 'réseau' } }
    const absente = colonnes.find((c) => !colonnesProduction.has(c))
    if (absente) return { data: null, error: { code: '42703', message: `column profiles_artisan.${absente} does not exist` } }
    const fiche: Record<string, unknown> = { paiement_modes: [], ...recu.fiche }
    return { data: Object.fromEntries(colonnes.map((c) => [c, fiche[c] ?? null])), error: null }
  }
  return { supabase: { from: () => chaine } }
})

vi.mock('@/lib/pdf/devis-pdf-v3', () => ({
  generateDevisPdfV3: vi.fn(async (entree: Record<string, unknown>) => {
    recu.entrees.push(entree)
    return { filename: 'x.pdf', pdfArrayBuffer: new ArrayBuffer(0) }
  }),
}))

const ACOMPTE = {
  docType: 'facture',
  docNumber: 'AC-2026-030',
  docTitle: '',
  docDate: '2026-11-27',
  factureSubType: 'acompte',
  clientName: 'SIGA',
  clientType: 'professionnel',
  clientSiret: '30523385000059',
  regimeTva: 'classique',
  lines: [{ id: 1, description: 'Acompte de 20 % sur travaux soumis à la TVA au taux de 10 %', qty: 1, unit: 'f', priceHT: 7538, tvaRate: 10, totalHT: 7538 }],
}

const ecranT = (k: string) => `écran:${k}`

async function telecharger(locale: 'fr' | 'pt') {
  const { downloadSavedDevis } = await import('@/lib/pdf/download-saved-devis')
  await downloadSavedDevis(ACOMPTE as never, {
    locale, t: ecranT, artisan: { id: '11111111-2222-3333-4444-555555555555' }, useBtpDesign: true,
  })
  const entree = recu.entrees[recu.entrees.length - 1]
  const t = entree.t as (k: string) => string
  const formats = entree.localeFormats as { taxLabel: string; currencyFormat: (n: number) => string }
  return { entree, t, formats }
}

beforeEach(() => { recu.entrees.length = 0; recu.fiche = {}; recu.echec = false })

describe('downloadSavedDevis (BTP) — langue de la société', () => {
  it('société française téléchargée depuis /pt : PDF français (cas AC-2026-030)', async () => {
    recu.fiche = { language: 'fr' }
    const { entree, t, formats } = await telecharger('pt')
    expect(entree.locale).toBe('fr')
    expect(t('devis.designation')).toBe('Désignation')
    expect(formats.taxLabel).toBe('TVA')
    expect(entree.docTitle).toBe('Facture AC-2026-030')
  })

  it('fiche sans langue (null) : société française, comme la série de numérotation du serveur', async () => {
    recu.fiche = { language: null }
    const { entree, t } = await telecharger('pt')
    expect(entree.locale).toBe('fr')
    expect(t('devis.unitPrice')).toBe('Prix U.')
  })

  it('société portugaise téléchargée depuis /fr : PDF portugais', async () => {
    recu.fiche = { language: 'pt' }
    const { entree, t, formats } = await telecharger('fr')
    expect(entree.locale).toBe('pt')
    expect(t('devis.designation')).toBe('Designação')
    expect(formats.taxLabel).toBe('IVA')
    expect(entree.docTitle).toBe('Fatura AC-2026-030')
  })

  it('même langue que l\'écran : traductions de l\'écran, comme avant', async () => {
    recu.fiche = { language: 'pt' }
    const { entree, t } = await telecharger('pt')
    expect(entree.locale).toBe('pt')
    expect(t('devis.designation')).toBe('écran:devis.designation')
  })

  it('fiche illisible (réseau) : langue de l\'écran, comme avant', async () => {
    recu.echec = true
    const { entree, t } = await telecharger('pt')
    expect(entree.locale).toBe('pt')
    expect(t('devis.designation')).toBe('écran:devis.designation')
  })
})
