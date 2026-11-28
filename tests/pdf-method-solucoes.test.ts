// Gabarit Method Soluções (lib/pdf/modele-method-solucoes.ts) : devis et factures de la société de la
// marque au gabarit qu'elle a fourni le 17/11/2026, remplis par les données du générateur BTP.
// Le générateur V3 tourne pour de vrai (jsPDF) ; le texte des PDF est relu avec pdf.js, page par page,
// avec sa position. Police et logo servis depuis public/ par un fetch simulé.
// Avec PDF_SORTIE=<dossier>, les PDF sont aussi écrits sur disque pour un contrôle visuel.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateDevisPdfV3, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import { METHOD_SOLUCOES_PROFIL_ID, modeleDocumentSociete } from '@/lib/pdf/modeles-societes'
import {
  URL_LOGO_METHOD,
  URL_POLICE_METHOD,
  URL_POLICE_METHOD_GRAS,
  datePt,
  descontoPagamento,
  eurosPt,
  insecables,
  jurosDeMora,
  modoPagamento,
  nomeCapitulo,
  nomFichierMethodSolucoes,
  nombrePt,
  pourcentPt,
  prazoExecucao,
  prazoPagamento,
  prestacoesDoDevis,
  quandoPrestacao,
  quantitePt,
  registoEmpresa,
  tituloPersonalizado,
  traduireLibellesGeneres,
  unidadePt,
  vencimentoFatura,
} from '@/lib/pdf/modele-method-solucoes'
import type { ProductLine } from '@/lib/devis-types'
import pt from '@/locales/pt.json'
import { NB, lirePdf as lire, lu, ordreDeLecture, type Texte } from './helpers/lecture-pdf'

const DOSSIER_SORTIE = process.env.PDF_SORTIE
const RACINE = process.cwd()
const RESSOURCES: Record<string, string> = {
  [URL_POLICE_METHOD]: join(RACINE, 'public/fonts/LiberationSans-Regular.ttf'),
  [URL_POLICE_METHOD_GRAS]: join(RACINE, 'public/fonts/LiberationSans-Bold.ttf'),
  [URL_LOGO_METHOD]: join(RACINE, 'public/images/modeles-pdf/method-solucoes-logo.png'),
}

/** Espace insécable : « nb('245_312,60') » = « 245 312,60 » avec U+00A0 à la place de « _ ». */
const nb = (s: string) => s.replace(/_/g, NB)

const t = (cle: string): string => {
  const valeur = cle.split('.').reduce<unknown>((noeud, part) => (noeud as Record<string, unknown> | undefined)?.[part], pt)
  return typeof valeur === 'string' ? valeur : cle
}

/** fetch du navigateur simulé : police et logo lus dans public/, tout le reste en 404. */
const fetchRessources = vi.fn(async (url: string) => {
  const chemin = RESSOURCES[url]
  if (!chemin) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }
  const octets = readFileSync(chemin)
  return { ok: true, status: 200, arrayBuffer: async () => octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) }
})

beforeAll(() => {
  vi.stubGlobal('open', vi.fn())
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
  if (DOSSIER_SORTIE) mkdirSync(DOSSIER_SORTIE, { recursive: true })
})

beforeEach(() => {
  fetchRessources.mockClear()
  vi.stubGlobal('fetch', fetchRessources)
})

let idLigne = 1
function ligne(description: string, qty: number, unit: string, priceHT: number, tvaRate: number, extra: Partial<ProductLine> = {}): ProductLine {
  return { id: idLigne++, description, qty, unit, priceHT, tvaRate, totalHT: Math.round(qty * priceHT * 100) / 100, ...extra }
}

const estrutura: ProductLine[] = [
  ligne('Sapatas contínuas de betão armado', 12, 'm3', 450, 23, {
    lineDetail: 'Sapatas corridas sob os muros, secção de referência 0,80 x 0,50 m.',
    etapes: [
      { id: 'e1', ordre: 1, designation: 'Abertura dos caboucos' },
      { id: 'e2', ordre: 2, designation: 'Betão de limpeza' },
      { id: 'e3', ordre: 3, designation: 'Betonagem e cura' },
    ],
  }),
  ligne('Muros de betão armado e = 0,18 m', 85.5, 'm2', 98, 23),
]
const estaleiro: ProductLine[] = [
  ligne('Vedação da obra em chapa', 40, 'ml', 33.66, 23),
  ligne('Montagem e desmontagem da grua', 1, 'f', 2500, 23),
]
const todas = [...estrutura, ...estaleiro]
const totalHT = Math.round(todas.reduce((s, l) => s + l.totalHT, 0) * 100) / 100
const iva23 = Math.round(totalHT * 23) / 100
const totalTTC = Math.round((totalHT + iva23) * 100) / 100

function entree(docType: 'devis' | 'facture', surcharge: Partial<PdfV3Input> = {}): PdfV3Input {
  return {
    action: 'fichier',
    locale: 'fr',
    localeFormats: { currencyFormat: (n: number) => `${n} €`, taxLabel: 'TVA' },
    t,
    docType,
    docNumber: docType === 'devis' ? 'DEV-2026-001' : 'FACT-2026-001',
    docTitle: docType === 'devis' ? 'Devis DEV-2026-001' : 'Facture FACT-2026-001',
    docDate: '2026-11-17',
    docValidity: 30,
    prestationDate: '',
    executionDelay: '5 semaines',
    companyStatus: 'sarl',
    companyName: 'Empresa Exemplo - Construções Unipessoal Lda',
    companySiret: '500000000',
    companyAddress: 'RUA DOS EXEMPLOS N 1, PONTE DE LIMA, 4990-000 PONTE DE LIMA',
    companyRCS: 'Alvará IMPIC n.º 000000-PAR',
    companyCapital: '',
    companyPhone: '+351 900 000 000',
    companyEmail: 'geral@example.pt',
    tvaEnabled: true,
    tvaNumber: '',
    insuranceName: 'Seguradora Exemplo',
    insuranceNumber: 'AP-0001',
    insuranceCoverage: 'Portugal continental',
    insuranceType: 'rc_pro',
    decennaleEligibility: 'always',
    mediatorName: '',
    mediatorUrl: '',
    isHorsEtablissement: false,
    clientName: 'Cliente Exemplo, Lda',
    clientEmail: '',
    clientAddress: 'Rua do Cliente 10, 4900-000 Viana do Castelo',
    clientPhone: '',
    clientSiret: '501000000',
    clientType: 'professionnel',
    interventionAddress: 'Lote 7, Lugar do Exemplo, Ponte de Lima',
    interventionBatiment: '',
    interventionEtage: '',
    interventionEspacesCommuns: '',
    interventionExterieur: '',
    companyAPE: '',
    paymentMode: 'Virement bancaire',
    paymentDue: '30 jours',
    paymentCondition: 'Aucun escompte accordé pour paiement anticipé',
    discount: '',
    penaltyRate: '',
    recoveryFee: '',
    iban: 'PT50 0000 0000 0000 0000 0000 0',
    bic: '',
    lines: todas,
    laborLines: estrutura,
    materialLines: [],
    fraisLines: [],
    linesName: 'Estrutura',
    customTables: [{ id: 'ct1', name: 'Estaleiro e equipamentos', lines: estaleiro }],
    subtotalHT: totalHT,
    totalTTC,
    tvaBreakdown: [{ rate: 23, base: totalHT, amount: iva23 }],
    regimeTva: 'classique',
    acomptesEnabled: docType === 'devis',
    acomptes: [
      { id: 'a1', ordre: 1, label: 'Acompte', pourcentage: 50, declencheur: 'Au démarrage' },
      { id: 'a2', ordre: 2, label: 'Situation', pourcentage: 30, declencheur: 'À mi-chantier' },
      { id: 'a3', ordre: 3, label: 'Solde', pourcentage: 20, declencheur: 'À la livraison' },
    ],
    notes: '',
    sourceDevisRef: docType === 'facture' ? 'DEV-2026-001' : null,
    signatureData: null,
    attachedRapport: null,
    selectedPhotos: [],
    artisan: { id: METHOD_SOLUCOES_PROFIL_ID, company_name: 'Empresa Exemplo' },
    modele: 'method-solucoes',
    ptFiscalData: null,
    svgToImageDataUrl: async () => '',
    fetchFreshLogo: async () => null,
    ...surcharge,
  }
}

interface PdfLu {
  octets: Buffer
  pages: Texte[][]
  /** Texte de chaque page dans l'ordre de lecture (lignes de haut en bas, morceaux de gauche à droite). */
  texte: string[]
  /** Même texte sans aucun espace : pdf.js écarte les lettres des titres espacés (« O R Ç A M E N T O »). */
  compact: string[]
  nom: string
}

async function generer(nom: string, input: PdfV3Input): Promise<PdfLu> {
  const resultat = await generateDevisPdfV3(input)
  const octets = Buffer.from(resultat.fichier)
  if (DOSSIER_SORTIE) writeFileSync(join(DOSSIER_SORTIE, `${nom}.pdf`), octets)
  const pages = await lire(octets)
  const texte = pages.map(ordreDeLecture)
  return { octets, pages, texte, compact: texte.map((p) => p.replace(/\s+/g, '')), nom: resultat.filename }
}

const tout = (pdf: PdfLu) => pdf.texte.join(' ')
const toutCompact = (pdf: PdfLu) => pdf.compact.join('')
const compact = (s: string) => s.replace(/\s+/g, '')

/**
 * Aucun texte hors de la zone utile : au-dessus de la marge basse de 46 pt (sauf le pied de page, sous 30 pt),
 * sous le haut de la page, entre les marges gauche et droite de 40 pt.
 */
function sansDebordement(pdf: PdfLu) {
  pdf.pages.forEach((page, i) => {
    const pied = page.filter((m) => m.y < 30).map((m) => m.str).join(' ')
    if (pied) expect(lu(pied)).toMatch(new RegExp(`Página ${i + 1} de ${pdf.pages.length}`))
    for (const m of page) {
      if (m.y >= 30) expect(m.y, `« ${m.str} » sous la marge basse (page ${i + 1})`).toBeGreaterThan(44)
      expect(m.y, `« ${m.str} » hors de la page`).toBeLessThan(842)
      expect(m.x, `« ${m.str} » dans la marge gauche`).toBeGreaterThan(39.5)
      expect(m.x + m.largeur, `« ${m.str} » dans la marge droite`).toBeLessThan(556)
    }
  })
}

describe('Registre des modèles de société', () => {
  it('donne le gabarit Method Soluções à la seule fiche de la société', () => {
    expect(modeleDocumentSociete(METHOD_SOLUCOES_PROFIL_ID)).toBe('method-solucoes')
    expect(modeleDocumentSociete('4397dc9e-d115-47cc-ae6b-cfeedc971eb5')).toBe('provence-pro')
    expect(modeleDocumentSociete('11111111-2222-3333-4444-555555555555')).toBeUndefined()
    expect(modeleDocumentSociete('toString')).toBeUndefined()
    expect(modeleDocumentSociete(null)).toBeUndefined()
    expect(modeleDocumentSociete(undefined)).toBeUndefined()
  })
})

describe('Valeurs du formulaire traduites pour le gabarit', () => {
  it('écrit nombres, montants, pourcentages et dates comme le gabarit', () => {
    expect(nombrePt(245312.6)).toBe(nb('245_312,60'))
    expect(nombrePt(-1234.5)).toBe(nb('-1_234,50'))
    expect(eurosPt(0)).toBe(nb('0,00_€'))
    expect(pourcentPt(23)).toBe('23')
    expect(pourcentPt(5.5)).toBe('5,5')
    expect(pourcentPt(33.33)).toBe('33,33')
    expect(datePt('2026-11-17')).toBe('17/11/2026')
    expect(datePt('')).toBe('')
    // Quantités et prix : deux décimales, davantage seulement quand la valeur saisie en a (total calculé dessus)
    expect(quantitePt(85.5)).toBe('85,50')
    expect(quantitePt(12.345)).toBe('12,345')
    expect(quantitePt(33.6666)).toBe('33,6666')
    expect(quantitePt(2500)).toBe(nb('2_500,00'))
  })

  it('traduit délais, modes, déclencheurs, escomptes et unités du formulaire', () => {
    expect(prazoPagamento('Comptant à réception')).toEqual({ curto: 'A pronto', faturas: 'a pronto pagamento', vencimento: 'pagáveis a pronto, na receção' })
    expect(prazoPagamento('30 jours').faturas).toBe('a 30 dias')
    expect(prazoPagamento('45 jours fin de mois').curto).toBe('45 dias fim do mês')
    expect(modoPagamento('Virement bancaire').curto).toBe('Transferência bancária')
    expect(modoPagamento('Espèces (selon plafond légal applicable)').frase).toBe('em numerário, dentro do limite legal')
    expect(modoPagamento('Prélèvement SEPA').curto).toBe('Débito direto SEPA')
    expect(modoPagamento('').curto).toBe('Transferência bancária')
    expect(quandoPrestacao('À la signature')).toBe('na adjudicação')
    expect(quandoPrestacao('Au démarrage')).toBe('no início dos trabalhos')
    expect(quandoPrestacao('À mi-chantier')).toBe('a meio dos trabalhos')
    expect(quandoPrestacao('À la livraison')).toBe('no final, contra auto de receção provisória')
    expect(quandoPrestacao('60 jours')).toBe('a 60 dias')
    expect(quandoPrestacao('com a betonagem da laje')).toBe('com a betonagem da laje')
    expect(descontoPagamento('Aucun escompte accordé pour paiement anticipé')).toBe('Sem desconto por pagamento antecipado.')
    expect(descontoPagamento('2 % pour paiement comptant')).toBe('Desconto de 2 % para pagamento a pronto.')
    expect(prazoExecucao('5 semaines')).toBe('5 semanas')
    expect(prazoExecucao('1 mois')).toBe('1 mês')
    expect(prazoExecucao('10 jours ouvrés')).toBe('10 dias úteis')
    expect(prazoExecucao('3 jours calendaires')).toBe('3 dias de calendário')
    expect(prazoExecucao('5 meses')).toBe('5 meses')
    expect(unidadePt('u')).toBe('un')
    expect(unidadePt('f')).toBe('vg')
    expect(unidadePt('m2')).toBe('m2')
    expect(unidadePt('autre', 'saco')).toBe('saco')
  })

  it('nomme les capítulos, reconnaît le titre par défaut et lit l\'alvará dans le champ RCS / RM', () => {
    expect(nomeCapitulo("Main d'œuvre", true)).toBe('Trabalhos')
    expect(nomeCapitulo("Main d'œuvre", false)).toBe('Mão de obra')
    expect(nomeCapitulo('Matériaux', false)).toBe('Materiais')
    expect(nomeCapitulo('Frais annexes', false)).toBe('Despesas acessórias')
    expect(nomeCapitulo('Estrutura', true)).toBe('Estrutura')
    expect(nomeCapitulo('', true)).toBe('Trabalhos')
    expect(tituloPersonalizado('Devis DEV-2026-001')).toBe('')
    expect(tituloPersonalizado('Orçamento DEV-2026-001')).toBe('')
    expect(tituloPersonalizado('Fatura')).toBe('')
    expect(tituloPersonalizado('Moradia unifamiliar · estrutura')).toBe('Moradia unifamiliar · estrutura')
    expect(registoEmpresa('Alvará IMPIC n.º 000000-PAR')).toEqual({ rotulo: 'Alvará', valor: 'IMPIC n.º 000000-PAR' })
    expect(registoEmpresa('IMPIC 000000-PAR')).toEqual({ rotulo: 'Alvará', valor: 'IMPIC 000000-PAR' })
    expect(registoEmpresa('Matrícula 500000000')).toEqual({ rotulo: 'Registo', valor: 'Matrícula 500000000' })
    expect(registoEmpresa('')).toBeNull()
  })

  it('complète l\'échéancier par le solde et omet la pénalité de retard par défaut du formulaire', () => {
    // Valeurs par défaut du formulaire BTP : un acompte de 30 % à la signature, « 3 × taux d'intérêt légal en vigueur »
    expect(prestacoesDoDevis([{ id: 'a1', ordre: 1, label: 'Acompte 1', pourcentage: 30, declencheur: 'À la signature' }])).toEqual([
      { pct: 30, quando: 'na adjudicação' },
      { pct: 70, quando: 'de saldo, contra a fatura final' },
    ])
    expect(prestacoesDoDevis([
      { id: 'a1', ordre: 1, label: 'A', pourcentage: 50, declencheur: 'Au démarrage' },
      { id: 'a2', ordre: 2, label: 'B', pourcentage: 50, declencheur: 'À la livraison' },
    ])).toHaveLength(2)
    expect(prestacoesDoDevis([])).toEqual([])
    expect(jurosDeMora("3 × taux d'intérêt légal en vigueur")).toBe('')
    // Valeur par défaut d'un document créé sur /pt (formulaire traduit) : même rendu que la valeur française
    expect(jurosDeMora('Taxa de juro legal em vigor')).toBe('')
    expect(jurosDeMora('Taxa de juro legal em vigor acrescida de 8 pontos')).toBe('Juros de mora: Taxa de juro legal em vigor acrescida de 8 pontos.')
    expect(jurosDeMora('')).toBe('')
    expect(jurosDeMora('8 % ao ano')).toBe('Juros de mora: 8 % ao ano.')
  })

  it('traduit les libellés que Vitfix rédige en français pour les factures d\'acompte et de solde', () => {
    expect(traduireLibellesGeneres('Acompte déjà facturé - facture n° FACT-2026-002 du 20/11/2026, net de l\'avoir n° AV-2026-001 - TVA 20 %'))
      .toBe('Adiantamento já faturado - fatura n.º FACT-2026-002 de 20/11/2026, líquido da nota de crédito n.º AV-2026-001 - IVA 20 %')
    expect(traduireLibellesGeneres('Acompte de 30 % sur travaux soumis à la TVA au taux de 20 %'))
      .toBe('Adiantamento de 30 % por conta dos trabalhos sujeitos a IVA à taxa de 20 %')
    expect(traduireLibellesGeneres('Acompte de 33,33 % sur travaux sous-traités - autoliquidation de la TVA'))
      .toBe('Adiantamento de 33,33 % por conta dos trabalhos - IVA - autoliquidação')
    expect(traduireLibellesGeneres('Devis n° DEV-2026-001 du 17/11/2026\nBase HT à ce taux : 5 287,62 €'))
      .toBe('Orçamento n.º DEV-2026-001 de 17/11/2026\nBase tributável a esta taxa: 5 287,62 €')
    expect(traduireLibellesGeneres('Acompte de 30 % (n° 1 sur 2) sur le devis n° DEV-2026-001 du 17/11/2026. Échéance : À la signature.'))
      .toBe('Adiantamento de 30 % (n.º 1 de 2) por conta do orçamento n.º DEV-2026-001 de 17/11/2026. Vencimento: na adjudicação.')
    expect(traduireLibellesGeneres('Accès par la cour\nRéf. devis : DEV-2026-001')).toBe('Accès par la cour\nRef. orçamento: DEV-2026-001')
    expect(tituloPersonalizado('Acompte n° 1 sur 2 (30 %) - Devis DEV-2026-001')).toBe('')
    expect(tituloPersonalizado('Acompte n° 1 sur 2 (30 %) - Moradia em Ponte de Lima')).toBe('Moradia em Ponte de Lima')
    expect(tituloPersonalizado('Facture de solde - Moradia em Ponte de Lima')).toBe('Saldo · Moradia em Ponte de Lima')
    expect(tituloPersonalizado('Facture de solde')).toBe('Saldo')
  })

  it('calcule l\'échéance d\'une facture sans décalage de fuseau', () => {
    expect(vencimentoFatura('30 jours', '2026-11-17')).toBe('17/12/2026')
    expect(vencimentoFatura('Comptant à réception', '2026-11-17')).toBe('17/11/2026')
    // 17/11 + 45 jours = 01/01/2027, puis fin de ce mois (lib/pdf/payment-due.ts)
    expect(vencimentoFatura('45 jours fin de mois', '2026-11-17')).toBe('31/01/2027')
    expect(vencimentoFatura('2027-01-15', '2026-11-17')).toBe('15/01/2027')
    expect(vencimentoFatura('a combinar com o cliente', '2026-11-17')).toBe('a combinar com o cliente')
  })

  it('garde ensemble montants, unités, IBAN et plan de paiement', () => {
    expect(insecables('Preço de 12 345,60 € para 85,50 m2')).toBe(nb('Preço de 12_345,60_€ para 85,50_m2'))
    expect(insecables('IBAN PT50 0000 0000 0000 0000 0000 0')).toBe(nb('IBAN PT50_0000_0000_0000_0000_0000_0'))
    expect(insecables('Pagamento 50 / 30 / 20')).toBe(nb('Pagamento 50_/_30_/_20'))
  })

  it('nomme le fichier en portugais', () => {
    expect(nomFichierMethodSolucoes({ docType: 'devis', docNumber: 'DEV-2026-001', clientName: 'Cliente Exemplo' })).toBe('Orcamento_DEV-2026-001_Cliente_Exemplo.pdf')
    expect(nomFichierMethodSolucoes({ docType: 'facture', factureSubType: 'avoir', docNumber: 'AV-2026-001', clientName: '' })).toBe('Nota_de_credito_AV-2026-001_Cliente.pdf')
  })
})

describe('Orçamento au gabarit Method Soluções', () => {
  it('reprend le gabarit : en-tête, partes, cases, capítulos, totaux, conditions, prestações, signatures', async () => {
    const pdf = await generer('method-orcamento', entree('devis'))
    expect(pdf.nom).toBe('Orcamento_DEV-2026-001_Cliente_Exemplo_Lda.pdf')
    // Comme le modèle vierge du gabarit : tableau et totaux, conditions et signatures, conditions générales sur deux pages
    expect(pdf.texte).toHaveLength(4)
    const [p1] = pdf.texte
    const [c1] = pdf.compact
    const tous = tout(pdf)
    const tousCompact = toutCompact(pdf)
    // En-tête : ligne légale, type de document, badge du numéro
    expect(c1).toContain(compact('EMPRESA EXEMPLO - CONSTRUÇÕES UNIPESSOAL LDA · ALVARÁ IMPIC N.º 000000-PAR'))
    expect(c1).toContain('ORÇAMENTO')
    expect(c1).toContain(compact('N.º DEV-2026-001 · 17/11/2026'))
    // Empreiteiro / Dono de obra
    expect(c1).toContain('EMPREITEIRO')
    expect(c1).toContain('DONODEOBRA')
    expect(p1).toContain('Method Soluções · Ideias para a sua Empresa')
    expect(p1).toContain('Alvará IMPIC n.º 000000-PAR')
    expect(p1).toContain('Rua dos Exemplos N 1, Ponte de Lima,')
    expect(p1).toContain('PT50 0000 0000 0000 0000 0000 0')
    expect(p1).toContain('Cliente Exemplo, Lda')
    expect(p1).toContain('Lote 7, Lugar do Exemplo, Ponte de Lima')
    // Cases
    expect(c1).toMatch(/DATA.*VALIDADE.*PRAZODEEXECUÇÃO.*PAGAMENTO/)
    expect(p1).toContain('17/11/2026 30 dias 5 semanas 50 / 30 / 20')
    // Tableau : capítulos nommés et numérotés, artigos 1.01…, étapes, sous-totaux
    expect(c1).toContain(compact('ART. DESIGNAÇÃO DOS TRABALHOS UN. QT. P. UNIT. TOTAL'))
    expect(c1).toContain('1ESTRUTURA')
    expect(c1).toContain('2ESTALEIROEEQUIPAMENTOS')
    expect(p1).toContain('1.01 Sapatas contínuas de betão armado m3 12,00 450,00 5 400,00')
    expect(p1).toContain('Sapatas corridas sob os muros, secção de referência 0,80 x 0,50 m.')
    expect(p1).toContain('1. Abertura dos caboucos')
    expect(p1).toContain('3. Betonagem e cura')
    expect(p1).toContain('2.02 Montagem e desmontagem da grua vg 1,00 2 500,00 2 500,00')
    expect(p1).toContain(`Subtotal do capítulo 1 ${lu(nombrePt(5400 + 8379))}`)
    // Totaux, conditions, prestações et signatures
    expect(tous).toContain(`Trabalhos (capítulos 1 a 2) ${lu(eurosPt(totalHT))}`)
    expect(tous).toContain(`Total s/IVA ${lu(eurosPt(totalHT))}`)
    expect(tous).toContain(`IVA 23 % ${lu(eurosPt(iva23))}`)
    expect(tous).toContain(`Total c/IVA ${lu(eurosPt(totalTTC))}`)
    expect(tous).toContain(`Preço de ${lu(eurosPt(totalHT))} acrescido de IVA à taxa legal de 23 %, para a execução dos trabalhos descritos nos artigos, com materiais, mão de obra e equipamentos.`)
    expect(tous).toContain('Pagamento 50 % no início dos trabalhos, 30 % a meio dos trabalhos e 20 % no final, contra auto de receção provisória; faturas a 30 dias.')
    expect(tous).toContain('Prazo 5 semanas a contar da consignação. Validade 30 dias. A assinatura e o carimbo do dono de obra valem adjudicação e aceitação das condições gerais, em duplicado.')
    expect(tous).toContain('Sem desconto por pagamento antecipado.')
    const prestacoes = [...tous.matchAll(/(\d)\.ª prestação ([\d ]+,\d\d) €/g)].map((m) => Number(m[2].replace(/ /g, '').replace(',', '.')))
    expect(prestacoes).toHaveLength(3)
    expect(Math.round(prestacoes.reduce((s, v) => s + v, 0) * 100) / 100).toBe(totalTTC)
    expect(tous).toContain('IBAN PT50 0000 0000 0000 0000 0000 0 · prestações sobre o total c/IVA')
    expect(tousCompact).toMatch(/PELAEMPRESA.*PELODONODEOBRA/)
    expect(tousCompact).toContain('assinaturaecarimbo')
    // Page des conditions
    expect(pdf.compact[2]).toContain('CONDIÇÕESDAPROPOSTA')
    expect(tousCompact).toContain('RESUMODOPREÇOPORCAPÍTULO')
    expect(tous).toContain(`1 · Estrutura ${lu(eurosPt(5400 + 8379))}`)
    expect(tousCompact).toContain('CONDIÇÕESGERAIS')
    expect(tous).toContain('1 · Objeto · Execução, em regime de empreitada (artigos 1207.º e seguintes do Código Civil)')
    expect(tous).toContain('5 · Pagamento · 50 % do total c/IVA no início dos trabalhos; 30 % a meio dos trabalhos; 20 % no final, contra auto de receção provisória. Faturas com vencimento a 30 dias, por transferência bancária para o IBAN indicado.')
    expect(tous).toContain('6 · Prazo · 5 semanas a contar da consignação.')
    expect(tous).toContain('14 · Proteção de dados')
    expect(tous).toContain('IVA à taxa de 23 %; caso o dono de obra seja sujeito passivo de IVA')
    expect(tous).toContain('Seguro de responsabilidade civil profissional: Seguradora Exemplo, apólice n.º AP-0001, cobertura Portugal continental.')
    expect(tous).toMatch(/Documento gerado por Vitfix Pro em \d\d\/\d\d\/\d{4}\./)
    // Pied de chaque page
    pdf.texte.forEach((page, i) => {
      expect(page).toContain(`Página ${i + 1} de 4`)
      expect(page).toContain('Empresa Exemplo - Construções Unipessoal Lda · NIF 500000000 · Alvará IMPIC n.º 000000-PAR · Method Soluções')
    })
    // Rien du formulaire en français
    expect(tous).not.toMatch(/Virement|jours|semaines|Main d|Devis|Acompte|Matériaux|TVA|convenir|BON POUR ACCORD/)
    sansDebordement(pdf)
  })

  it('embarque Liberation Sans et le logo PNG du gabarit, chargés une fois', async () => {
    const pdf = await generer('method-orcamento-ressources', entree('devis'))
    const brut = pdf.octets.toString('latin1')
    expect(brut).toMatch(/\/BaseFont \/LiberationSans/)
    expect(brut).toContain('/FontFile2')
    // Logo et son masque de transparence : deux images, réutilisées par les deux en-têtes
    expect(brut.match(/\/Subtype \/Image/g)?.length).toBe(2)
    expect(fetchRessources.mock.calls.map(([url]) => url).sort()).toEqual([URL_LOGO_METHOD, URL_POLICE_METHOD, URL_POLICE_METHOD_GRAS].sort())
  })

  it('sans police ni logo (hors ligne) : Helvetica et logotype en texte, document complet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const pdf = await generer('method-orcamento-hors-ligne', entree('devis'))
    const brut = pdf.octets.toString('latin1')
    expect(brut).not.toContain('/FontFile2')
    expect(brut).not.toContain('/Subtype /Image')
    expect(pdf.compact[0]).toContain('METHODSOLUÇÕES')
    expect(pdf.compact[0]).toContain('IDEIASPARAASUAEMPRESA')
    expect(toutCompact(pdf)).toContain('CONDIÇÕESGERAIS')
    sansDebordement(pdf)
  })

  it('sans échéancier : mode et délai de paiement, plusieurs taux, remises, notes, titre saisi', async () => {
    const lignes = [
      ligne('Demolição de paredes', 20, 'm2', 30, 23, { remise: { type: 'pourcentage', valeur: 10 }, totalHT: 540 }),
      ligne('Reboco interior', 50, 'm2', 18, 6),
    ]
    // Remise globale de 34,80 € sur 1 440,00 € ; ventilation par taux telle que le formulaire la calcule.
    const ventilation = [{ rate: 23, base: 526.95, amount: 121.2 }, { rate: 6, base: 878.25, amount: 52.7 }]
    const pdf = await generer('method-orcamento-taux-remises', entree('devis', {
      docTitle: 'Remodelação do rés-do-chão',
      laborLines: lignes, lines: lignes, linesName: "Main d'œuvre", customTables: [],
      acomptesEnabled: false, paymentDue: 'Comptant à réception', paymentMode: 'Chèque',
      subtotalHT: 1405.2, totalHTBrut: 1440, remiseGlobale: { montantHT: 34.8, libelle: 'Remise commerciale (2,42 %)' },
      tvaBreakdown: ventilation, totalTTC: 1579.1,
      notes: 'Acesso pelo portão lateral.\nHorário 8h-17h.',
    }))
    const tous = tout(pdf)
    const [p1] = pdf.texte
    expect(p1).toContain('Remodelação do rés-do-chão')
    expect(pdf.compact[0]).toContain('1TRABALHOS')
    expect(pdf.compact[0]).toContain(compact('P. UNIT. DESC. IVA TOTAL'))
    expect(p1).toContain('1.01 Demolição de paredes m2 20,00 30,00 -10 % 23 % 540,00')
    expect(p1).toContain('1.02 Reboco interior m2 50,00 18,00 6 % 900,00')
    expect(p1).toContain('A pronto')
    expect(tous).toContain(`Trabalhos (capítulo 1) ${lu(eurosPt(1440))}`)
    expect(tous).toContain('Desconto comercial (2,42 %) -34,80 €')
    expect(tous).toContain(`Total s/IVA ${lu(eurosPt(1405.2))}`)
    expect(tous).toContain('IVA 23 % s/ 526,95 € 121,20 €')
    expect(tous).toContain('IVA 6 % s/ 878,25 € 52,70 €')
    expect(tous).toContain(`Total c/IVA ${lu(eurosPt(1579.1))}`)
    expect(tous).toContain('acrescido de IVA às taxas legais indicadas nos artigos')
    expect(tous).toContain('Pagamento por cheque; faturas a pronto pagamento.')
    expect(tous).toContain('Notas Acesso pelo portão lateral. Horário 8h-17h.')
    expect(tous).toContain('Pagamento por cheque · faturas a pronto pagamento')
    expect(tous).toContain('5 · Pagamento · Pagamento do total c/IVA contra fatura. Faturas pagáveis a pronto, na receção, por cheque.')
    expect(tous).toContain('IVA às taxas indicadas nos artigos;')
    // Mention de la verba 2.42.1 du gabarit : liée à une option que le formulaire n'a pas, jamais imprimée
    expect(tous).not.toContain('verba 2.42.1')
    expect(tous).not.toContain('prestação')
    sansDebordement(pdf)
  })

  it('particulier hors établissement : page de livre resolução ; signature électronique dans le cachet', async () => {
    const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const pdf = await generer('method-orcamento-particulier', entree('devis', {
      clientType: 'particulier', clientSiret: '', isHorsEtablissement: true, mediatorName: 'Centro de Arbitragem Exemplo',
      signatureData: { svg_data: '<svg/>', signataire: 'Cliente Exemplo', timestamp: '2026-11-18', document_ref: 'DEV-2026-001', hash_sha256: 'a'.repeat(64) },
      svgToImageDataUrl: async () => png1x1,
    }))
    const tous = tout(pdf)
    expect(compact(tous)).toContain('assinaturaeletrónicasimples')
    expect(tous).toContain('18/11/2026')
    expect(tous).toContain('Resolução alternativa de litígios (Lei n.º 144/2015): Centro de Arbitragem Exemplo.')
    const derniere = pdf.texte[pdf.texte.length - 1]
    expect(compact(derniere)).toContain('DIREITODELIVRERESOLUÇÃO')
    expect(derniere).toContain('Artigo 10.º do Decreto-Lei n.º 24/2014')
    expect(compact(derniere)).toContain('FORMULÁRIODELIVRERESOLUÇÃO')
    expect(derniere).toContain('Encomendado em / recebido em:')
    sansDebordement(pdf)
  })

  it('valeurs par défaut du formulaire : acompte de 30 %, pénalité française, TVA à 20 %, date de début sans délai', async () => {
    const lignes = [ligne('Pintura interior', 100, 'm2', 12, 20)]
    const pdf = await generer('method-orcamento-defauts-formulaire', entree('devis', {
      laborLines: lignes, lines: lignes, linesName: "Main d'œuvre", customTables: [],
      subtotalHT: 1200, totalTTC: 1440, tvaBreakdown: [{ rate: 20, base: 1200, amount: 240 }],
      acomptes: [{ id: 'a1', ordre: 1, label: 'Acompte 1', pourcentage: 30, declencheur: 'À la signature' }],
      penaltyRate: "3 × taux d'intérêt légal en vigueur", recoveryFee: '40 € (BtoB uniquement)',
      paymentDue: 'Comptant à réception', executionDelay: '', prestationDate: '2026-12-01',
    }))
    const tous = tout(pdf)
    // Échéancier complété par le solde, prestações justes
    expect(pdf.texte[0]).toContain('17/11/2026 30 dias Início em 01/12/2026 30 / 70')
    expect(tous).toContain('Pagamento 30 % na adjudicação e 70 % de saldo, contra a fatura final; faturas a pronto pagamento.')
    expect(tous).toContain('Pagamento 30 / 70 · 1.ª prestação 432,00 € · 2.ª prestação 1 008,00 €')
    expect(tous).toContain('5 · Pagamento · 30 % do total c/IVA na adjudicação; 70 % de saldo, contra a fatura final.')
    // Date de début sans délai d'exécution
    expect(tous).toContain('Prazo a combinar, com início previsto em 01/12/2026.')
    expect(tous).toContain('6 · Prazo · A combinar, com início previsto em 01/12/2026.')
    // 20 % n'est pas un taux légal portugais : pas de « taxa legal »
    expect(tous).toContain('acrescido de IVA à taxa de 20 %')
    expect(tous).not.toContain('taxa legal')
    // Pénalité française par défaut omise (la clause du DL 62/2013 couvre la mora)
    expect(tous).not.toMatch(/Juros de mora|taux|intérêt|BtoB/)
    sansDebordement(pdf)
  })

  it('capítulo d\'un artigo de presque une page : ni titre seul en bas de page, ni sous-total seul en haut', async () => {
    const presquePage = ligne('Artigo de quase uma página', 1, 'f', 500, 23, {
      lineDetail: Array.from({ length: 67 }, (_, i) => `Linha ${i + 1} da descrição dos trabalhos.`).join('\n'),
    })
    const pdf = await generer('method-orcamento-presque-page', entree('devis', {
      laborLines: [presquePage], lines: [presquePage], customTables: [], subtotalHT: 500, totalTTC: 615,
      tvaBreakdown: [{ rate: 23, base: 500, amount: 115 }],
    }))
    const pageTitre = pdf.compact.findIndex((p) => p.includes('1ESTRUTURA'))
    const pageSousTotal = pdf.texte.findIndex((p) => p.includes('Subtotal do capítulo 1'))
    expect(pageTitre).toBeGreaterThanOrEqual(0)
    expect(pdf.texte[pageTitre]).toContain('1.01 Artigo de quase uma página')
    expect(pdf.texte[pageTitre]).toMatch(/Linha 2 da descrição/)
    expect(pdf.texte[pageSousTotal]).toMatch(/Linha \d+ da descrição dos trabalhos\. Linha \d+ da descrição dos trabalhos\. Subtotal do capítulo 1/)
    expect(tout(pdf)).toContain('Linha 67 da descrição')
    sansDebordement(pdf)
  })

  it('artigo coupé dont la fin remplit une page : le sous-total emporte au moins deux lignes avec lui', async () => {
    // Selon la longueur, la dernière partie de l'artigo s'arrête juste au-dessus du bas de page, sans place pour le
    // sous-total : quelques longueurs autour de ce point, pour ne pas dépendre d'un réglage de mise en page au point près.
    for (const nombre of [95, 96, 97, 98, 99, 100]) {
      const long = ligne('Artigo longo', 1, 'f', 500, 23, {
        lineDetail: Array.from({ length: nombre }, (_, i) => `Linha ${i + 1} da descrição dos trabalhos.`).join('\n'),
      })
      const pdf = await generer(`method-orcamento-fin-de-page-${nombre}`, entree('devis', {
        laborLines: [long], lines: [long], customTables: [], subtotalHT: 500, totalTTC: 615,
        tvaBreakdown: [{ rate: 23, base: 500, amount: 115 }],
      }))
      const page = pdf.texte.find((p) => p.includes('Subtotal do capítulo 1')) ?? ''
      expect(page, `${nombre} lignes`).toMatch(/Linha \d+ da descrição dos trabalhos\. Linha \d+ da descrição dos trabalhos\. Subtotal do capítulo 1/)
      sansDebordement(pdf)
    }
  })

  it('artigo plus haut qu\'une page et devis vide : rien ne déborde, numérotation des pages juste', async () => {
    const long = ligne('Artigo com descrição muito longa', 1, 'f', 1000, 23, {
      lineDetail: Array.from({ length: 140 }, (_, i) => `Parágrafo ${i + 1} da descrição detalhada dos trabalhos a executar em obra.`).join('\n'),
    })
    const pdfLong = await generer('method-orcamento-long', entree('devis', {
      laborLines: [long], lines: [long], customTables: [], subtotalHT: 1000, totalTTC: 1230,
      tvaBreakdown: [{ rate: 23, base: 1000, amount: 230 }],
    }))
    expect(pdfLong.texte.length).toBeGreaterThan(4)
    // Le tableau commence sur la première page (pas de page presque vide) et son en-tête revient sur chaque suite
    expect(pdfLong.compact[0]).toContain(compact('DESIGNAÇÃO DOS TRABALHOS'))
    expect(pdfLong.texte[0]).toContain('1.01 Artigo com descrição muito longa vg 1,00 1 000,00 1 000,00')
    expect(pdfLong.texte[0]).toContain('Parágrafo 1 da descrição')
    expect(pdfLong.compact[1]).toContain(compact('ART. DESIGNAÇÃO DOS TRABALHOS UN. QT. P. UNIT. TOTAL'))
    expect(tout(pdfLong)).toContain('Parágrafo 140 da descrição')
    sansDebordement(pdfLong)

    const vide = await generer('method-orcamento-vide', entree('devis', {
      laborLines: [], lines: [], customTables: [], subtotalHT: 0, totalTTC: 0, tvaBreakdown: [], acomptesEnabled: false,
      clientName: '', clientSiret: '', clientAddress: '',
    }))
    expect(vide.texte[0]).toContain('Sem artigos.')
    expect(vide.texte[0]).toMatch(/Nome \.{10,}/)
    sansDebordement(vide)
  })
})

describe('Faturas au gabarit Method Soluções', () => {
  it('fatura : échéance calculée, mode de paiement, devis d\'origine, ni conditions ni signatures', async () => {
    const pdf = await generer('method-fatura', entree('facture', { prestationDate: '2026-11-10' }))
    expect(pdf.nom).toBe('Fatura_FACT-2026-001_Cliente_Exemplo_Lda.pdf')
    const tous = tout(pdf)
    expect(pdf.compact[0]).toContain('FATURA')
    expect(pdf.compact[0]).toContain(compact('N.º FACT-2026-001 · 17/11/2026'))
    expect(pdf.compact[0]).toMatch(/DATA.*VENCIMENTO.*PAGAMENTO.*DATADOSTRABALHOS/)
    expect(pdf.texte[0]).toContain('17/11/2026 17/12/2026 Transferência bancária 10/11/2026')
    expect(tous).toContain('Pagamento por transferência bancária para o IBAN indicado; vencimento em 17/12/2026.')
    expect(tous).toContain('Fatura relativa ao orçamento n.º DEV-2026-001.')
    expect(tous).toContain('Decreto-Lei n.º 62/2013')
    expect(tous).toContain('IVA à taxa de 23 %.')
    expect(toutCompact(pdf)).not.toMatch(/CONDIÇÕESDAPROPOSTA|PELAEMPRESA|assinaturaecarimbo|prestação/)
    expect(tous).not.toMatch(/Virement|jours|Facture|TVA/)
    sansDebordement(pdf)
  })

  it('sous-types : adiantamento, nota de crédito avec motif, autoliquidação', async () => {
    const acompte = await generer('method-fatura-adiantamento', entree('facture', {
      factureSubType: 'acompte', acompteOrdre: 1, acompteTotal: 3, acomptePourcentage: 50, parentInvoiceNumber: 'DEV-2026-001',
    }))
    expect(acompte.compact[0]).toContain('FATURADEADIANTAMENTO')
    expect(acompte.texte[0]).toContain('Adiantamento n.º 1 de 3 · 50 % · sobre orçamento n.º DEV-2026-001')

    const avoir = await generer('method-nota-de-credito', entree('facture', {
      factureSubType: 'avoir', docNumber: 'AV-2026-001', docTitle: 'Avoir AV-2026-001', parentInvoiceNumber: 'FACT-2026-001',
      avoirMotif: 'Erro na quantidade do artigo 1.02', subtotalHT: -totalHT, totalTTC: -totalTTC,
      tvaBreakdown: [{ rate: 23, base: -totalHT, amount: -iva23 }],
    }))
    expect(avoir.nom).toBe('Nota_de_credito_AV-2026-001_Cliente_Exemplo_Lda.pdf')
    expect(avoir.compact[0]).toContain('NOTADECRÉDITO')
    expect(avoir.texte[0]).toContain('sobre fatura n.º FACT-2026-001')
    expect(avoir.texte[0]).toContain('Motivo: Erro na quantidade do artigo 1.02')
    expect(tout(avoir)).toContain(`Total c/IVA ${lu(eurosPt(-totalTTC))}`)

    const autoliq = await generer('method-fatura-autoliquidacao', entree('facture', {
      regimeTva: 'autoliquidation_btp', autoliquidationBTP: true, totalTTC: totalHT, tvaBreakdown: undefined,
    }))
    const tous = tout(autoliq)
    expect(tous).toContain('IVA - autoliquidação 0,00 €')
    expect(tous).toContain(`Total a pagar ${lu(eurosPt(totalHT))}`)
    expect(tous).toContain('IVA - autoliquidação: IVA devido pelo adquirente nos termos da alínea j) do n.º 1 do artigo 2.º do CIVA.')
    sansDebordement(autoliq)
  })

  it('factures d\'acompte et de solde rédigées en français par Vitfix (interface en français) : texte portugais', async () => {
    const acompteLignes = [ligne('Acompte de 30 % sur travaux soumis à la TVA au taux de 23 %', 1, 'f', 5287.62, 23, {
      lineDetail: 'Devis n° DEV-2026-001 du 17/11/2026\nBase HT à ce taux : 17 625,40 €',
    })]
    const acompte = await generer('method-fatura-adiantamento-fr', entree('facture', {
      factureSubType: 'acompte', acompteOrdre: 1, acompteTotal: 2, acomptePourcentage: 30, parentInvoiceNumber: 'DEV-2026-001',
      docTitle: 'Acompte n° 1 sur 2 (30 %) — Devis DEV-2026-001',
      laborLines: acompteLignes, lines: acompteLignes, linesName: 'Acompte', customTables: [], sourceDevisRef: null,
      notes: 'Acompte de 30 % (n° 1 sur 2) sur le devis n° DEV-2026-001 du 17/11/2026. Échéance : À la signature.',
      subtotalHT: 5287.62, totalTTC: 6503.77, tvaBreakdown: [{ rate: 23, base: 5287.62, amount: 1216.15 }],
    }))
    const tousAcompte = tout(acompte)
    expect(acompte.compact[0]).toContain('1ADIANTAMENTO')
    // Désignation sur deux lignes (« … à taxa de » puis « 23 % »), chiffres de l'artigo sur la première
    expect(tousAcompte).toContain('1.01 Adiantamento de 30 % por conta dos trabalhos sujeitos a IVA à taxa de vg 1,00 5 287,62 5 287,62')
    expect(tousAcompte).toContain('23 % Orçamento n.º DEV-2026-001 de 17/11/2026 Base tributável a esta taxa: 17 625,40 €')
    expect(tousAcompte).toContain('Notas Adiantamento de 30 % (n.º 1 de 2) por conta do orçamento n.º DEV-2026-001 de 17/11/2026. Vencimento: na adjudicação.')
    expect(tousAcompte).not.toMatch(/Acompte|Devis|Base HT|Échéance/)

    const deduction = [ligne('Acompte déjà facturé — facture n° FACT-2026-002 du 20/11/2026 — TVA 23 %', 1, 'f', -5287.62, 23, { horsRemise: true })]
    const solde = await generer('method-fatura-saldo-fr', entree('facture', {
      docTitle: 'Facture de solde — Moradia em Ponte de Lima', sourceDevisRef: null,
      notes: 'Réf. devis : DEV-2026-001',
      customTables: [
        { id: 'ct1', name: 'Estaleiro e equipamentos', lines: estaleiro },
        { id: 'acomptes-deduits', name: 'Acomptes déjà facturés (à déduire)', lines: deduction },
      ],
    }))
    const tousSolde = tout(solde)
    expect(solde.texte[0]).toContain('Saldo · Moradia em Ponte de Lima')
    expect(toutCompact(solde)).toContain(compact('3 ADIANTAMENTOS JÁ FATURADOS (A DEDUZIR)'))
    expect(tousSolde).toContain('3.01 Adiantamento já faturado - fatura n.º FACT-2026-002 de 20/11/2026 - IVA vg 1,00 -5 287,62 -5 287,62 23 %')
    expect(tousSolde).toContain('Fatura relativa ao orçamento n.º DEV-2026-001.')
    expect(tousSolde).not.toMatch(/Ref\. orçamento|Réf\.|Acompte|facture|TVA/)
    sansDebordement(solde)
  })

  it('annexe photos : photo illisible remplacée par un cadre « Fotografia indisponível »', async () => {
    class ImageEnErreur {
      crossOrigin = ''
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_url: string) { setTimeout(() => this.onerror?.(), 0) }
    }
    vi.stubGlobal('Image', ImageEnErreur)
    const pdf = await generer('method-fatura-photos', entree('facture', {
      selectedPhotos: [{ id: 'p1', url: 'https://example.supabase.co/photo.jpg', label: 'Fachada norte', taken_at: '2026-11-10T09:30:00Z', lat: 41.76, lng: -8.58 }],
    }))
    const derniere = pdf.texte[pdf.texte.length - 1]
    expect(compact(derniere)).toContain('ANEXOFOTOGRÁFICO')
    expect(derniere).toContain('Fotografia indisponível')
    expect(derniere).toContain('Fachada norte')
    expect(derniere).toContain('GPS: 41.76000, -8.58000')
    sansDebordement(pdf)
  })
})
