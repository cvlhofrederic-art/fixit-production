// tests/lib/rapport-pdf-langue.test.ts
//
// PDF des rapports (lib/rapport-pdf.ts) : en portugais, plus aucun libellé français (« Rapport d'intervention »,
// « Établi le », « SIRET », « PRESTATAIRE »…), titre « Relatório de obra » pour une société BTP ; en français, les
// libellés d'avant au caractère près. jsPDF est simulé : on relève chaque texte écrit (titres de section en capitales).

import { beforeEach, describe, expect, it, vi } from 'vitest'

const ecrits = vi.hoisted(() => ({ textes: [] as string[] }))

vi.mock('jspdf', () => {
  class FauxPdf {
    pages = 1
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    setLineWidth() {}
    setFillColor() {}
    line() {}
    rect() {}
    circle() {}
    addImage() {}
    save() {}
    setPage() {}
    addPage() { this.pages++ }
    getNumberOfPages() { return this.pages }
    getTextWidth(t: string) { return t.length * 4 }
    splitTextToSize(t: string) { return [t] }
    text(t: string | string[]) { ecrits.textes.push(...(Array.isArray(t) ? t : [t])) }
  }
  return { jsPDF: FauxPdf }
})

import { generateRapportPDF, type RapportPDFData } from '@/lib/rapport-pdf'

const RAPPORT = {
  id: 'rap_1', rapportNumber: 'RAP-2026-001', createdAt: '2026-11-10T10:00:00Z', linkedBookingId: null, linkedPhotoIds: [],
  refDevisFact: 'DEV-2026-004', artisanName: 'Construções Ribeiro, Lda', artisanAddress: 'Rua do Almada, 10, Porto',
  artisanPhone: '912 000 000', artisanEmail: 'geral@exemplo.pt', artisanSiret: '509999999', artisanInsurance: 'Seguradora X',
  clientName: 'Ana Costa', clientPhone: '913 000 000', clientEmail: 'ana@exemplo.pt', clientAddress: 'Rua de Cedofeita, 20, Porto',
  interventionDate: '2026-11-10', startTime: '09:00', endTime: '11:30', siteAddress: 'Rua de Cedofeita, 20, Porto',
  motif: 'Fuga de água', travaux: ['Substituição da torneira'], materiaux: ['Torneira (1 u)'],
  observations: 'Sem outras fugas', recommendations: 'Rever a pressão', status: 'termine',
} as unknown as RapportPDFData

beforeEach(() => { ecrits.textes = [] })

describe('PDF des rapports selon la langue', () => {
  it('portugais, société BTP : textes portugais, titre « Relatório de obra », NIF au lieu de SIRET', async () => {
    await generateRapportPDF(RAPPORT, [], 'pt-PT', 'pro_societe')
    const tout = ecrits.textes.join(' | ')
    for (const attendu of ['Relatório de obra', 'Emitido em', 'Estado', 'Concluído', 'Associado a: DEV-2026-004', 'PRESTADOR', 'CLIENTE',
      'Tel.: 912 000 000', 'NIF: 509999999', 'Seguro: Seguradora X', 'DETALHES DA INTERVENÇÃO', 'HORA DE INÍCIO', 'Morada da obra: ',
      'MOTIVO DA INTERVENÇÃO', 'TRABALHOS REALIZADOS', 'MATERIAIS UTILIZADOS', 'DESIGNAÇÃO', 'QUANTIDADE', 'Observações', 'Recomendações',
      'FOTOS DA OBRA', 'Nenhuma foto associada.', 'VALIDAÇÃO E ASSINATURAS', 'ASSINATURA DO PRESTADOR', 'ASSINATURA DO CLIENTE',
      'Documento gerado pelo Vitfix Pro', 'Página 1 / 2']) {
      expect(tout).toContain(attendu)
    }
    expect(tout).not.toMatch(/Rapport|Établi|SIRET|PRESTATAIRE|Statut|Lié à|Tél|Adresse|Matériaux|Photos|Signature|Document généré|—/)
  })

  it('portugais, artisan : titre « Relatório de intervenção »', async () => {
    await generateRapportPDF(RAPPORT, [], 'pt-PT', 'artisan')
    expect(ecrits.textes).toContain('Relatório de intervenção')
    expect(ecrits.textes).not.toContain('Relatório de obra')
  })

  it('français : libellés d’avant, au caractère près', async () => {
    await generateRapportPDF(RAPPORT, [], 'fr-FR', 'pro_societe')
    const tout = ecrits.textes.join(' | ')
    for (const attendu of ["Rapport d'intervention", 'Établi le', 'Statut', 'Terminé', 'Lié à : DEV-2026-004', 'PRESTATAIRE', 'CLIENT',
      'Tél : 912 000 000', 'E-mail : geral@exemplo.pt', 'SIRET : 509999999', 'Assurance : Seguradora X', "DÉTAILS DE L'INTERVENTION",
      'HEURE DÉBUT', 'HEURE FIN', 'DURÉE', 'Adresse chantier : ', "MOTIF D'INTERVENTION", 'TRAVAUX RÉALISÉS', 'MATÉRIAUX UTILISÉS',
      'DÉSIGNATION', 'QUANTITÉ', 'OBSERVATIONS / RECOMMANDATIONS', 'Recommandations', 'PHOTOS CHANTIER', 'Aucune photo liée.',
      'Ajoutez des photos depuis le module pour les inclure dans le rapport.', 'VALIDATION ET SIGNATURES', 'SIGNATURE PRESTATAIRE',
      'SIGNATURE CLIENT', 'Date  ___ / ___ / ______', 'RAP-2026-001  —  Construções Ribeiro, Lda', 'Page 1 / 2']) {
      expect(tout).toContain(attendu)
    }
    expect(ecrits.textes.some(t => /^Construções Ribeiro, Lda — SIRET 509999999 — Document généré par Vitfix Pro — \d{2}\/\d{2}\/\d{4}$/.test(t))).toBe(true)
  })
})
