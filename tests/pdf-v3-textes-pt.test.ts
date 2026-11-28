// Documents BTP portugais au modèle par défaut (lib/pdf/devis-pdf-v3.ts) : plus aucun texte français.
// Constat de Frédéric du 28/11/2026 sur la fatura FA-2026-001 : « Virement bancaire », « Aucun escompte accordé
// pour paiement anticipé », « SIRET », « Unida/de »… Les valeurs que le formulaire enregistre en français sont
// traduites (lib/pdf/textes-pdf-v3-pt.ts) et les textes fixes du générateur ont leur version portugaise.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { generateDevisPdfV3, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import {
  descontoPt, libellesPt, modoPagamentoPt, penalidadePt, prazoExecucaoPt, quandoPt, remisePt, seccaoPt, tituloPt,
  unidadeCurta,
} from '@/lib/pdf/textes-pdf-v3-pt'
import pt from '@/locales/pt.json'
import { entreePdfV3 } from './helpers/entree-pdf-v3'

const traductionPt = (cle: string): string => {
  const valeur = cle.split('.').reduce<unknown>((noeud, part) => (noeud as Record<string, unknown> | undefined)?.[part], pt)
  return typeof valeur === 'string' ? valeur : cle
}

beforeAll(() => {
  vi.stubGlobal('open', vi.fn())
})

describe('valeurs enregistrées en français → portugais', () => {
  it('mode, escompte, pénalités, délai, déclencheur', () => {
    expect(modoPagamentoPt('Virement bancaire')).toBe('Transferência bancária')
    expect(modoPagamentoPt('Espèces (selon plafond légal applicable)')).toBe('Numerário')
    expect(descontoPt('Aucun escompte accordé pour paiement anticipé')).toBe('Sem desconto por pagamento antecipado.')
    expect(descontoPt('1 % pour paiement à 10 jours')).toBe('Desconto de 1 % para pagamento a 10 dias.')
    expect(penalidadePt("3 × taux d'intérêt légal")).toBe('Taxa de juro legal em vigor')
    expect(prazoExecucaoPt('3 semaines')).toBe('3 semanas')
    expect(prazoExecucaoPt('10 jours ouvrés')).toBe('10 dias úteis')
    expect(quandoPt('À la signature')).toBe('na adjudicação')
    expect(quandoPt('À mi-chantier')).toBe('a meio dos trabalhos')
  })

  it('sections, titres, remise, unités, libellés rédigés par Vitfix', () => {
    expect(seccaoPt("Main d'œuvre")).toBe('Mão de obra')
    expect(seccaoPt('Acomptes déjà facturés (à déduire)')).toBe('Adiantamentos já faturados (a deduzir)')
    expect(tituloPt('Acompte n° 1 sur 3 (50 %) — Reparação do beirado')).toBe('Adiantamento n.º 1 de 3 (50 %) — Reparação do beirado')
    expect(tituloPt('Facture de solde — Reparação do beirado')).toBe('Fatura de saldo — Reparação do beirado')
    expect(tituloPt('Facture n° FT-2026-001')).toBe('Fatura n.º FT-2026-001')
    expect(tituloPt('AVOIR sur facture FT-2026-001 (annulation partielle)')).toBe('Nota de crédito sobre a fatura FT-2026-001 (anulação parcial)')
    expect(remisePt('Remise commerciale (5 %)')).toBe('Desconto comercial (5 %)')
    expect(['f', 'u', 'benne', 'palette', 'm2'].map(unidadeCurta)).toEqual(['vg', 'un', 'cont.', 'pal.', 'm2'])
    expect(libellesPt('Acompte de 50 % sur travaux soumis à la TVA au taux de 23 %'))
      .toBe('Adiantamento de 50 % por conta dos trabalhos sujeitos a IVA à taxa de 23 %')
    expect(libellesPt('Réf. devis : ORC-2026-005')).toBe('Ref. orçamento: ORC-2026-005')
  })

  it('un texte saisi librement reste tel quel (tirets longs compris)', () => {
    expect(modoPagamentoPt('MB WAY')).toBe('MB WAY')
    expect(descontoPt('Desconto de 3 % — a combinar')).toBe('Desconto de 3 % — a combinar')
    expect(prazoExecucaoPt('Até ao fim de janeiro')).toBe('Até ao fim de janeiro')
    expect(seccaoPt('Cobertura — fase 1')).toBe('Cobertura — fase 1')
    expect(tituloPt('Reparação do beirado — Porto')).toBe('Reparação do beirado — Porto')
    expect(libellesPt('Limpeza do telhado — 120 m²\nRetirada de musgo')).toBe('Limpeza do telhado — 120 m²\nRetirada de musgo')
  })
})

// Document portugais aux valeurs d'un formulaire resté en français (données fictives).
const linha = (id: number, description: string, unit: string) => ({ id, description, qty: 2, unit, priceHT: 100, tvaRate: 23, totalHT: 200 })

function entreePt(surcharge: Partial<PdfV3Input> = {}): PdfV3Input {
  return entreePdfV3({
    t: traductionPt, locale: 'pt', docDate: '2026-11-28', companyStatus: 'lda', companyName: 'CONSTRUCOES EXEMPLO, LDA',
    companyAddress: 'Rua Exemplo, 1, 4000-000 Porto', companySiret: '123456789', companyRCS: 'CRC do Porto, matricula 123',
    companyAPE: '41000', companyCapital: '5.000,00',
    clientName: 'Cliente Exemplo', clientAddress: 'Rua Cliente, 2, 4000-000 Porto', clientType: 'particulier',
    interventionAddress: 'Rua Obra, 3, 4000-000 Porto', paymentMode: 'Virement bancaire', paymentDue: '30 jours',
    paymentCondition: 'Aucun escompte accordé pour paiement anticipé', penaltyRate: "3 × taux d'intérêt légal",
    iban: 'PT50 0000 0000 0000 0000 0000 0', bic: 'EXEMPTPL',
    localeFormats: { currencyFormat: (n: number) => `${n.toFixed(2).replace('.', ',')} €`, taxLabel: 'IVA' },
    linesName: "Main d'œuvre", materialLinesName: 'Matériaux', fraisLinesName: 'Frais annexes',
    laborLines: [linha(1, 'Limpeza do telhado', 'm2'), linha(2, 'Montagem de andaime', 'f')],
    materialLines: [linha(3, 'Telhas', 'u')], fraisLines: [linha(4, 'Contentor', 'benne')],
    materialLinesEnabled: true, fraisLinesEnabled: true, lines: [linha(1, 'Limpeza do telhado', 'm2')],
    subtotalHT: 800, totalTTC: 984, tvaBreakdown: [{ rate: 23, base: 800, amount: 184 }],
    executionDelay: '3 semaines', isHorsEtablissement: true,
    ...surcharge,
  })
}

/** Tout le texte dessiné, échappements jsPDF retirés, une chaîne par ligne. */
async function texte(input: PdfV3Input): Promise<string> {
  const { pdfArrayBuffer } = await generateDevisPdfV3(input)
  const pdf = Buffer.from(pdfArrayBuffer).toString('latin1')
  return [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(m => m[1].replaceAll(/\\(.)/g, '$1')).join('\n')
}

/** Textes français vus sur les documents portugais avant la correction. */
const FRANCAIS = [
  'Virement', 'Aucun escompte', 'semaines', "Main d'", 'Matériaux', 'Frais annexes', 'Remise commerciale', 'CONDITIONS',
  'BON POUR ACCORD', 'Signature :', 'Date :', 'Pénalités', 'Acompte', 'signature', 'mi-chantier', 'Facture', 'Motif :',
  '(AVOIR)', 'N°', 'TVA Intra', 'SIRET', 'APE :', 'RESOLUCAO', 'Unida\nde',
]

const sansFrancais = (t: string) => FRANCAIS.filter(f => t.includes(f))

const DOCUMENTS: Array<[string, Partial<PdfV3Input>]> = [
  ['orçamento avec échéancier et remise', {
    docType: 'devis', docNumber: 'ORC-2026-001', docTitle: '', acomptesEnabled: true,
    acomptes: [{ id: 'a1', ordre: 1, label: 'Acompte 1', pourcentage: 30, declencheur: 'À la signature' },
      { id: 'a2', ordre: 2, label: 'Acompte 2', pourcentage: 40, declencheur: 'À mi-chantier' }],
    remiseGlobale: { montantHT: 100, libelle: 'Remise commerciale' }, totalHTBrut: 900,
  }],
  ['fatura', { docType: 'facture', docNumber: 'FT-2026-001', docTitle: 'Facture n° FT-2026-001', sourceDevisRef: 'ORC-2026-001' }],
  ['fatura de adiantamento', {
    docType: 'facture', factureSubType: 'acompte', acompteOrdre: 1, acompteTotal: 3, acomptePourcentage: 50,
    parentInvoiceNumber: 'ORC-2026-005', docNumber: 'FA-2026-001', docTitle: 'Acompte n° 1 sur 3 (50 %) — Reparação do beirado',
    linesName: 'Acompte', laborLines: [linha(1, 'Acompte de 50 % sur travaux soumis à la TVA au taux de 23 %', 'f')],
    materialLines: [], fraisLines: [], materialLinesEnabled: false, fraisLinesEnabled: false,
  }],
  ['fatura de situação', { docType: 'facture', factureSubType: 'situation', situationNumber: 2, situationAvancement: 60, docNumber: 'FT-2026-002', docTitle: '' }],
  ['fatura de saldo', {
    docType: 'facture', docNumber: 'FT-2026-003', docTitle: 'Facture de solde — Reparação do beirado',
    customTables: [{ id: 'd', name: 'Acomptes déjà facturés (à déduire)', lines: [linha(9, 'Acompte déjà facturé - facture n° FA-2026-001 du 28/11/2026 - TVA 23 %', 'f')] }],
  }],
  ['nota de crédito', { docType: 'facture', factureSubType: 'avoir', docNumber: 'NC-2026-001', docTitle: 'AVOIR sur facture FT-2026-001', avoirMotif: 'Erro de faturação', parentInvoiceNumber: 'FT-2026-001' }],
  ['fatura em autoliquidação', { docType: 'facture', docNumber: 'FT-2026-004', docTitle: '', clientType: 'professionnel', clientSiret: '500000000', regimeTva: 'autoliquidation_btp', tvaNumber: 'PT123456789', tvaIntraPreneur: 'PT500000000' }],
]

describe('PDF V3 portugais : aucun texte français', () => {
  it.each(DOCUMENTS)('%s', async (_nom, surcharge) => {
    expect(sansFrancais(await texte(entreePt(surcharge)))).toEqual([])
  })

  it('orçamento : valeurs traduites et textes fixes en portugais', async () => {
    const t = await texte(entreePt(DOCUMENTS[0][1]))
    for (const attendu of [
      'Meio de pagamento: Transferência bancária.', 'Sem desconto por pagamento antecipado.', 'Prazo de execução: 3 semanas.',
      'Penalidades por atraso : Taxa de juro legal em vigor', 'CONDIÇÕES', 'ACEITAÇÃO DO ORÇAMENTO', 'Assinatura :',
      'Adiantamento 1 : 30% na adjudicação', 'Mão de obra', 'Materiais', 'Despesas acessórias', 'Desconto comercial', 'Unid.',
      'DIREITO DE LIVRE RESOLUÇÃO', 'Não.',
    ]) expect(t).toContain(attendu)
    expect(t.split('\n')).toEqual(expect.arrayContaining(['vg', 'un', 'cont.']))
  })

  it('fatura : l\'escompte n\'est plus imprimé deux fois', async () => {
    const t = await texte(entreePt(DOCUMENTS[1][1]))
    expect(t.match(/Sem desconto/g)).toHaveLength(1)
    expect(t).toContain('Fatura n.º FT-2026-001')
    expect(t).toContain('Transferência bancária')
  })

  it('fatura : un escompte réel remplace la phrase « sem desconto »', async () => {
    const t = await texte(entreePt({ ...DOCUMENTS[1][1], paymentCondition: '1 % pour paiement à 10 jours' }))
    expect(t).toContain('Desconto de 1 % para pagamento a 10 dias.')
    expect(t).not.toContain('Sem desconto')
  })

  it('adiantamento, situação, nota de crédito : numéro et libellés portugais', async () => {
    expect(await texte(entreePt(DOCUMENTS[2][1]))).toContain('FATURA DE ADIANTAMENTO N.º 1 de 3')
    expect(await texte(entreePt(DOCUMENTS[3][1]))).toContain('FATURA DE SITUAÇÃO N.º 2')
    const nc = await texte(entreePt(DOCUMENTS[5][1]))
    expect(nc).toContain('NOTA DE CRÉDITO sobre fatura FT-2026-001')
    expect(nc).toContain('Motivo : Erro de faturação')
  })
})

describe('PDF V3 français : textes inchangés', () => {
  it('mêmes valeurs, document français : rien n\'est traduit', async () => {
    const t = await texte(entreePdfV3({
      docType: 'devis', paymentCondition: 'Aucun escompte accordé pour paiement anticipé', executionDelay: '3 semaines',
      acomptesEnabled: true, acomptes: [{ id: 'a1', ordre: 1, label: 'Acompte 1', pourcentage: 30, declencheur: 'À la signature' }],
      linesName: "Main d'œuvre",
    }))
    for (const attendu of ['CONDITIONS', 'BON POUR ACCORD', 'Signature :', 'Aucun escompte accordé pour paiement anticipé', 'Acompte 1 : 30% À la signature', 'Virement bancaire']) {
      expect(t).toContain(attendu)
    }
    expect(t).toContain('3 semaines')
  })
})
