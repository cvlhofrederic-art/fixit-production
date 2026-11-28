// Documents BTP portugais au modèle par défaut (lib/pdf/devis-pdf-v3.ts) : plus aucun texte français.
// Constat de Frédéric du 28/11/2026 sur la fatura FA-2026-001 : « Virement bancaire », « Aucun escompte accordé
// pour paiement anticipé », « SIRET », « Unida/de »… Les valeurs que le formulaire enregistre en français sont
// traduites (lib/pdf/textes-pdf-v3-pt.ts) et les textes fixes du générateur ont leur version portugaise.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import {
  descontoPt, escompteDaLista, libellesPt, modoPagamentoPt, prazoExecucaoPt, quandoPt, remisePt, seccaoPt, tituloPt,
  unidadeCurta, valeurParDefautPt,
} from '@/lib/pdf/textes-pdf-v3-pt'
import { entreePdfV3, textesPdfV3, traductionPt } from './helpers/entree-pdf-v3'

beforeAll(() => {
  vi.stubGlobal('open', vi.fn())
})

describe('valeurs enregistrées en français → portugais', () => {
  it('valeurs des listes du formulaire : le libellé portugais du formulaire, à l\'identique', () => {
    expect(modoPagamentoPt('Virement bancaire')).toBe('Transferência bancária')
    expect(modoPagamentoPt('Espèces (selon plafond légal applicable)')).toBe('Numerário (dentro do limite legal aplicável)')
    expect(descontoPt('Aucun escompte accordé pour paiement anticipé')).toBe('Sem desconto por pagamento antecipado')
    expect(descontoPt('1 % pour paiement à 10 jours')).toBe('1 % para pagamento a 10 dias')
    expect(quandoPt('À la signature')).toBe('na adjudicação')
    expect(quandoPt('À mi-chantier')).toBe('a meio dos trabalhos')
    // Pas le libellé du gabarit Method (« no final, contra auto de receção provisória ») : trop long pour la
    // ligne de l'échéancier, où il recouvrait le montant, et il ajoutait une condition non choisie
    expect(quandoPt('À la livraison')).toBe('no final dos trabalhos')
    expect(valeurParDefautPt("3 × taux d'intérêt légal en vigueur")).toBe('Taxa de juro legal em vigor')
    expect(valeurParDefautPt('40 € (BtoB uniquement)')).toBe('40 € (apenas B2B)')
    expect(prazoExecucaoPt('3 semaines')).toBe('3 semanas')
    expect(prazoExecucaoPt('10 jours ouvrés')).toBe('10 dias úteis')
    expect(escompteDaLista('Sem desconto por pagamento antecipado')).toBe('aucun')
    expect(escompteDaLista('2 % para pagamento a pronto')).toBe('accorde')
    expect(escompteDaLista('Pagamento em duas prestações')).toBeNull()
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

  it('un texte saisi librement reste tel quel (tirets longs compris), même s\'il commence comme une valeur connue', () => {
    expect(modoPagamentoPt('MB WAY')).toBe('MB WAY')
    expect(modoPagamentoPt('Transferência bancária (IBAN abaixo)')).toBe('Transferência bancária (IBAN abaixo)')
    expect(modoPagamentoPt('Cheque à ordem de Exemplo')).toBe('Cheque à ordem de Exemplo')
    expect(descontoPt('Aucun escompte, sauf accord écrit')).toBe('Aucun escompte, sauf accord écrit')
    expect(descontoPt('Desconto de 3 % — a combinar')).toBe('Desconto de 3 % — a combinar')
    expect(valeurParDefautPt("3 x taux d'intérêt légal + 10 points")).toBe("3 x taux d'intérêt légal + 10 points")
    expect(quandoPt('À la fin du mois')).toBe('À la fin du mois')
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
    paymentCondition: 'Aucun escompte accordé pour paiement anticipé', penaltyRate: "3 × taux d'intérêt légal en vigueur",
    recoveryFee: '40 € (BtoB uniquement)',
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

/** Tout le texte dessiné, une chaîne par ligne. */
const texte = async (input: PdfV3Input): Promise<string> => (await textesPdfV3(input)).join('\n')

/** Textes français vus sur les documents portugais avant la correction. */
const FRANCAIS = [
  'Virement', 'Aucun escompte', 'semaines', 'jours', "Main d'", 'Matériaux', 'Frais annexes', 'Remise commerciale',
  'CONDITIONS', 'BON POUR ACCORD', 'Signature :', 'Date :', 'Pénalités', 'taux d', 'Indemnité', 'BtoB', 'uniquement',
  'Acompte', 'signature', 'mi-chantier', 'livraison', 'Espèces', 'Facture', 'Motif :', '(AVOIR)', 'N°', 'TVA Intra',
  'SIRET', 'APE :', 'RESOLUCAO', 'Unida\nde',
]

const sansFrancais = (t: string) => FRANCAIS.filter(f => t.includes(f))

const DOCUMENTS: Array<[string, Partial<PdfV3Input>]> = [
  ['orçamento avec échéancier et remise', {
    docType: 'devis', docNumber: 'ORC-2026-001', docTitle: '', acomptesEnabled: true,
    acomptes: [{ id: 'a1', ordre: 1, label: 'Acompte 1', pourcentage: 30, declencheur: 'À la signature' },
      { id: 'a2', ordre: 2, label: 'Acompte 2', pourcentage: 40, declencheur: 'À mi-chantier' },
      { id: 'a3', ordre: 3, label: 'Acompte 3', pourcentage: 30, declencheur: 'À la livraison' }],
    remiseGlobale: { montantHT: 100, libelle: 'Remise commerciale' }, totalHTBrut: 900,
  }],
  ['orçamento pour un client professionnel, paiement en espèces', {
    docType: 'devis', docNumber: 'ORC-2026-002', docTitle: '', clientType: 'professionnel', clientSiret: '500000000',
    paymentMode: 'Espèces (selon plafond légal applicable)', isHorsEtablissement: false,
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
      'Meio de pagamento: Transferência bancária.', 'Sem desconto por pagamento antecipado', 'Prazo de execução: 3 semanas.',
      'Penalidades por atraso : Taxa de juro legal em vigor', 'CONDIÇÕES', 'ACEITAÇÃO DO ORÇAMENTO', 'Assinatura :',
      'Adiantamento 1 : 30% na adjudicação', 'Adiantamento 2 : 40% a meio dos trabalhos',
      'Adiantamento 3 : 30% no final dos trabalhos', 'Mão de obra', 'Materiais', 'Despesas acessórias',
      'Desconto comercial', 'Unid.', 'DIREITO DE LIVRE RESOLUÇÃO', 'Não.',
    ]) expect(t).toContain(attendu)
    expect(t.split('\n')).toEqual(expect.arrayContaining(['vg', 'un', 'cont.']))
  })

  it('orçamento d\'un professionnel : frais de recouvrement et mode de paiement du formulaire portugais', async () => {
    // Lignes de la colonne CONDIÇÕES coupées à sa largeur : texte lu bout à bout (« € » absent de la police de test)
    const t = (await textesPdfV3(entreePt(DOCUMENTS[1][1]))).join(' ')
    expect(t).toMatch(/Indemnização forfetária por despesas de cobrança : 40 \S* ?\(apenas B2B\)/)
    expect(t).toContain('Numerário (dentro do limite legal aplicável)')
  })

  it('fatura : l\'escompte n\'est plus imprimé deux fois', async () => {
    const t = await texte(entreePt(DOCUMENTS[2][1]))
    expect(t.match(/Sem desconto/g)).toHaveLength(1)
    expect(t).toContain('Fatura n.º FT-2026-001')
    expect(t).toContain('Transferência bancária')
  })

  it('fatura : un escompte accordé n\'est plus suivi de la phrase « sem desconto » qui le contredit', async () => {
    const t = await texte(entreePt({ ...DOCUMENTS[2][1], paymentCondition: '1 % pour paiement à 10 jours' }))
    expect(t).toContain('1 % para pagamento a 10 dias')
    expect(t).not.toContain('Sem desconto')
  })

  it('fatura : une condition libre reste imprimée, avec la phrase par défaut, comme avant', async () => {
    const t = await texte(entreePt({ ...DOCUMENTS[2][1], paymentCondition: 'Pagamento em duas prestações' }))
    expect(t).toContain('Pagamento em duas prestações')
    expect(t).toContain('Sem desconto por pagamento antecipado, salvo acordo prévio.')
  })

  it('une ligne absente (null) ne fait pas échouer la traduction', async () => {
    const lignes = [linha(1, 'Limpeza do telhado', 'm2'), null] as unknown as PdfV3Input['laborLines']
    await expect(texte(entreePt({ docType: 'facture', docNumber: 'FT-2026-009', docTitle: '', materialLinesEnabled: false, materialLines: lignes })))
      .resolves.toContain('Limpeza do telhado')
  })

  it('adiantamento, situação, nota de crédito : numéro et libellés portugais', async () => {
    expect(await texte(entreePt(DOCUMENTS[3][1]))).toContain('FATURA DE ADIANTAMENTO N.º 1 de 3')
    expect(await texte(entreePt(DOCUMENTS[4][1]))).toContain('FATURA DE SITUAÇÃO N.º 2')
    const nc = await texte(entreePt(DOCUMENTS[6][1]))
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
