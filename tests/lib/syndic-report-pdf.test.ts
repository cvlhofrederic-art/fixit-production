import { describe, it, expect } from 'vitest'
import { renderReportPdf, safe, type ReportModel } from '@/lib/syndic/v54/report-pdf'

/** Générateur PDF rapports syndic v54 — encode WinAnsi (accents PT + montants Intl pt-PT). */

const model = (rows: ReportModel['rows']): ReportModel => ({
  docTitle: 'Relatório Mensal de Gestão',
  periodLabel: 'Maio 2026',
  geradoA: '04/06/2026',
  stats: [
    { value: '4', label: 'Edifícios', tone: 'gold' },
    { value: '2', label: 'Intervenções do mês', tone: 'gold' },
    { value: '0 €', label: 'Montante obras', tone: 'sage' },
    { value: '55%', label: 'Orçamento consumido', tone: 'sage' },
  ],
  sectionTitle: 'Intervenções do mês',
  rows,
  legal: 'Documento gerado por Vitfix.io · Art.º 1436.º CC',
})

describe('safe', () => {
  it('normalise les espaces fines/insecables (U+202F, U+00A0) en espace ordinaire', () => {
    const NNBSP = String.fromCharCode(0x202f)
    const NBSP = String.fromCharCode(0x00a0)
    const THIN = String.fromCharCode(0x2009)
    expect(safe(`1${NNBSP}000`)).toBe('1 000')
    expect(safe(`a${NBSP}b${THIN}c`)).toBe('a b c')
    expect(safe(`x${NNBSP}y`)).not.toContain(NNBSP)
  })
  it('normalise les guillemets typographiques', () => {
    const LDQUO = String.fromCharCode(0x201c), RDQUO = String.fromCharCode(0x201d)
    const LSQUO = String.fromCharCode(0x2018), RSQUO = String.fromCharCode(0x2019)
    expect(safe(`${LDQUO}Aviso${RDQUO} ${LSQUO}x${RSQUO}`)).toBe('"Aviso" \'x\'')
  })
})

describe('renderReportPdf', () => {
  it('produit un PDF valide avec accents PT + montants € (Intl pt-PT, sans throw d\'encodage)', async () => {
    const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(1250) // contient U+202F
    const bytes = await renderReportPdf(model([
      { label: 'Edifício Aurora — Manutenção corrente', sub: 'Bruno Tavares · 12/04/2026', montante: eur },
    ]))
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(800)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('gère l\'état vide sans erreur', async () => {
    const bytes = await renderReportPdf(model([]))
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('pagine quand les lignes dépassent une page (60 lignes)', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ label: `Intervenção ${i}`, sub: 'Profissional · 01/05/2026', montante: '0 €' }))
    const bytes = await renderReportPdf(model(many))
    expect(bytes.length).toBeGreaterThan(2000)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })
})
