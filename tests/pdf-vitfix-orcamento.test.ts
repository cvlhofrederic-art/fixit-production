// Gabarit d'orçamento Vitfix (lib/pdf/modele-vitfix-orcamento.ts) : devis de la société de la marque Vitfix au
// gabarit template_orcamento_vitfix.html v1.1 du 22/11/2026, remplis par les données du générateur BTP.
// Le générateur V3 tourne pour de vrai (jsPDF) ; le texte des PDF est relu avec pdf.js, page par page, avec sa
// position. Police servie depuis public/ par un fetch simulé. Données fictives uniquement.
// Avec PDF_SORTIE=<dossier>, les PDF sont aussi écrits sur disque pour un contrôle visuel.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateDevisPdfV3, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import { URL_POLICE_GABARIT, URL_POLICE_GABARIT_GRAS } from '@/lib/pdf/mise-en-page-gabarit'
import { VITFIX_SOCIETE_PROFIL_ID, modeleDocumentSociete } from '@/lib/pdf/modeles-societes'
import {
  bancoDoBic,
  ibanLegivel,
  limparTracos,
  modoPagina1,
  momentoPrestacao,
  nifLegivel,
  nomeFicheiroVitfix,
  obraDeTelhado,
  prestacoesVitfix,
  quantidadeVitfix,
} from '@/lib/pdf/modele-vitfix-orcamento'
import type { DevisAcompte, ProductLine } from '@/lib/devis-types'
import { entreePdfV3 } from './helpers/entree-pdf-v3'
import { lirePdf, lu, ordreDeLecture, type Texte } from './helpers/lecture-pdf'

const DOSSIER_SORTIE = process.env.PDF_SORTIE
const RACINE = process.cwd()
const RESSOURCES: Record<string, string> = {
  [URL_POLICE_GABARIT]: join(RACINE, 'public/fonts/LiberationSans-Regular.ttf'),
  [URL_POLICE_GABARIT_GRAS]: join(RACINE, 'public/fonts/LiberationSans-Bold.ttf'),
}

/** fetch du navigateur simulé : police lue dans public/, tout le reste en 404. */
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

/** Jeu de contrôle du gabarit (section 6) : 2 artigos vg, 1 × 1 150,00 et 1 × 650,00, IVA 23 %, 50 / 30 / 20. */
const jeuControle: ProductLine[] = [
  ligne('Reparação de fissuras na fachada\nAbertura, tratamento e selagem das fissuras.', 1, 'f', 1150, 23, {
    etapes: [
      { id: 'e1', ordre: 1, designation: 'Abertura das fissuras' },
      { id: 'e2', ordre: 2, designation: 'Selagem e acabamento' },
    ],
  }),
  ligne('Pintura da fachada', 1, 'f', 650, 23),
]

const acompte = (ordre: number, pourcentage: number, declencheur: string): DevisAcompte =>
  ({ id: `a${ordre}`, ordre, label: 'Acompte', pourcentage, declencheur })

/** Devis d'une société portugaise au gabarit Vitfix (base commune des tests V3, champs portugais par-dessus). */
function entree(surcharge: Partial<PdfV3Input> = {}): PdfV3Input {
  const lignes = surcharge.laborLines ?? jeuControle
  const totalHT = Math.round(lignes.reduce((s, l) => s + l.totalHT, 0) * 100) / 100
  const iva = Math.round(totalHT * 23) / 100
  return entreePdfV3({
    locale: 'pt', localeFormats: { currencyFormat: (n: number) => `${n} €`, taxLabel: 'IVA' },
    docNumber: 'DEV-2026-001', docTitle: 'Reparação e pintura de fachada · Rua do Exemplo 10', docDate: '2026-11-22',
    executionDelay: '5 jours ouvrés', companyStatus: 'lda', companyName: 'Empresa Exemplo, Lda', companySiret: '500000000',
    companyAddress: 'Rua dos Exemplos 1, 4000-000 Porto', companyRCS: 'CRC do Porto, matrícula n.º 500000000',
    companyCapital: '5.000,00', companyPhone: '+351 900 000 000', companyEmail: 'geral@example.pt', insuranceCoverage: 'Portugal',
    clientName: 'Cliente Exemplo', clientAddress: 'Rua do Cliente 20, 4400-000 Vila Nova de Gaia', clientPhone: '+351 910 000 000',
    clientSiret: '200000000', interventionAddress: 'Rua do Exemplo 10, Canidelo, Vila Nova de Gaia', companyAPE: '41000-R4',
    paymentCondition: 'Aucun escompte accordé pour paiement anticipé', recoveryFee: '',
    iban: 'PT50000000000000000000000', bic: 'TRWIBEB1XXX',
    lines: lignes, laborLines: lignes, linesName: "Main d'oeuvre",
    subtotalHT: totalHT, totalTTC: Math.round((totalHT + iva) * 100) / 100, tvaBreakdown: [{ rate: 23, base: totalHT, amount: iva }],
    acomptesEnabled: true, acomptes: [acompte(1, 50, 'À la signature'), acompte(2, 30, 'À mi-chantier')],
    artisan: { id: VITFIX_SOCIETE_PROFIL_ID, company_name: 'Empresa Exemplo, Lda' }, modele: 'vitfix-orcamento',
    ...surcharge,
  })
}

interface PdfLu {
  pages: Texte[][]
  texte: string[]
  compact: string[]
  nom: string
}

async function generer(nom: string, input: PdfV3Input): Promise<PdfLu> {
  const resultat = await generateDevisPdfV3(input)
  const octets = Buffer.from(resultat.fichier)
  if (DOSSIER_SORTIE) writeFileSync(join(DOSSIER_SORTIE, `${nom}.pdf`), octets)
  const pages = await lirePdf(octets)
  const texte = pages.map(ordreDeLecture)
  return { pages, texte, compact: texte.map((p) => p.replace(/\s+/g, '')), nom: resultat.filename }
}

const tout = (pdf: PdfLu) => pdf.texte.join(' ')
const toutCompact = (pdf: PdfLu) => pdf.compact.join('')
const compact = (s: string) => s.replace(/\s+/g, '')

/**
 * Aucun texte hors de la zone utile (marges 42,52 / 39,69 / 48 / 39,69 pt) ; seul le pied « … Página x de y »
 * est dans la marge basse.
 */
function sansDebordement(pdf: PdfLu) {
  pdf.pages.forEach((page, i) => {
    const pied = page.filter((m) => m.y < 47).map((m) => m.str).join(' ')
    expect(lu(pied)).toMatch(new RegExp(`Página ${i + 1} de ${pdf.pages.length}$`))
    for (const m of page) {
      if (m.y >= 47) expect(m.y, `« ${m.str} » sous la marge basse (page ${i + 1})`).toBeGreaterThan(48)
      expect(m.y, `« ${m.str} » dans la marge haute`).toBeLessThan(841.89 - 42.52)
      // Numéros de liste à deux chiffres (« 10. ») : ils débordent de 1 à 2 pt dans la marge, comme ol { padding-left: 12pt } du gabarit.
      expect(m.x, `« ${m.str} » dans la marge gauche`).toBeGreaterThan(/^[1-9]\d\. /.test(m.str) ? 37.5 : 39.5)
      expect(m.x + m.largeur, `« ${m.str} » dans la marge droite`).toBeLessThan(595.28 - 39.5)
    }
  })
}

describe('Registre des modèles de société', () => {
  it('la fiche de la société Vitfix reçoit le gabarit d\'orçamento Vitfix, les autres non', () => {
    expect(modeleDocumentSociete(VITFIX_SOCIETE_PROFIL_ID)).toBe('vitfix-orcamento')
    expect(modeleDocumentSociete('11111111-2222-3333-4444-555555555555')).toBeUndefined()
  })
})

describe('Valeurs de Vitfix Pro dans les mots du gabarit', () => {
  it('déclencheurs d\'acompte, banque, IBAN, NIF, quantités', () => {
    expect(momentoPrestacao('À la signature')).toBe('na adjudicação')
    expect(momentoPrestacao('Au démarrage')).toBe('no início dos trabalhos')
    expect(momentoPrestacao('À mi-chantier')).toBe('a meio da execução')
    expect(momentoPrestacao('À la livraison')).toBe('na conclusão')
    expect(momentoPrestacao('30 jours')).toBe('a 30 dias')
    expect(momentoPrestacao('Após a vistoria')).toBe('Após a vistoria')
    expect(bancoDoBic('TRWIBEB1XXX')).toBe('Wise Europe SA')
    expect(bancoDoBic('bcom ptpl')).toBe('Millennium bcp')
    expect(bancoDoBic('XXXXXXXX')).toBe('')
    expect(ibanLegivel('pt50000000000000000000000')).toBe('PT50 0000 0000 0000 0000 0000 0')
    expect(nifLegivel('500000000')).toBe('500 000 000')
    expect(nifLegivel('FR12345678901')).toBe('FR12345678901')
    expect(quantidadeVitfix(60)).toBe('60')
    expect(quantidadeVitfix(85.5)).toBe('85,50')
  })

  it('échéancier toujours à 100 % : reste en dernière prestação, plan coupé à 100 %, reste de moins de 1 % absorbé', () => {
    expect(prestacoesVitfix(entree())).toEqual([
      { pct: 50, momento: 'na adjudicação' },
      { pct: 30, momento: 'a meio da execução' },
      { pct: 20, momento: 'na conclusão' },
    ])
    expect(prestacoesVitfix(entree({ acomptesEnabled: false }))).toEqual([])
    expect(prestacoesVitfix(entree({ acomptes: [acompte(1, 60, 'À la signature'), acompte(2, 60, 'À mi-chantier')] })).map((p) => p.pct)).toEqual([60, 40])
    expect(prestacoesVitfix(entree({ acomptes: [1, 2, 3].map((n) => acompte(n, 33.33, 'À la signature')) })).map((p) => p.pct)).toEqual([33.33, 33.33, 33.34])
    expect(prestacoesVitfix(entree({ acomptes: [acompte(1, 100, 'À la signature')] }))).toEqual([{ pct: 100, momento: 'na adjudicação' }])
  })

  it('garantie de 5 anos (règle 13) : une toiture dans un titre, jamais « poder de cobertura » ni la protection des sols', () => {
    expect(obraDeTelhado(['Impermeabilização da cobertura em fibrocimento'])).toBe(true)
    expect(obraDeTelhado(['Substituição de telhas partidas'])).toBe(true)
    expect(obraDeTelhado(['Pintura com tinta de elevado poder de cobertura'])).toBe(false)
    expect(obraDeTelhado(['Cobertura de proteção dos pavimentos e móveis'])).toBe(false)
    expect(obraDeTelhado(['Telha cor telha no muro'])).toBe(false)
  })

  it('règle 4 : tirets longs remplacés partout, sauf images et signature', () => {
    const tiret = String.fromCharCode(0x2013)
    const signe = String.fromCharCode(0x2212)
    expect(limparTracos({ a: `Fachada ${tiret} Rua 10`, b: [`2${signe}3`], url: `data:${tiret}`, n: 4 }))
      .toEqual({ a: 'Fachada · Rua 10', b: ['2-3'], url: `data:${tiret}`, n: 4 })
  })

  it('nom du fichier (règle 8) : numéro et lieu du chantier', () => {
    expect(nomeFicheiroVitfix({ docNumber: 'DEV-2026-001', interventionAddress: 'Travessa do Pinheiral 71, Canidelo, Gaia' }))
      .toBe('Orcamento_DEV-2026-001_Travessa_do_Pinheiral_71_Canidelo.pdf')
    expect(nomeFicheiroVitfix({ docNumber: 'DEV-2026-001', interventionAddress: '' })).toBe('Orcamento_DEV-2026-001.pdf')
  })

  it('mise en page de la page 1 comme la fonction ajustar du gabarit, dernière page lue en vrai A4', () => {
    const utile = 841.89 - 42.52 - 48
    const mesures = (compacta: number, derniereA4: number) => ({ compacta: () => compacta, derniereA4: () => derniereA4 })
    expect(modoPagina1(700, mesures(0, 0))).toBe('normal')
    expect(modoPagina1(utile + 20, mesures(utile - 10, 0))).toBe('compacto')
    expect(modoPagina1(utile + 20, mesures(utile + 1, 120))).toBe('continua')
    expect(modoPagina1(utile + 500, mesures(0, 120))).toBe('continua')
    expect(modoPagina1(utile + 500, mesures(0, 600))).toBe('quebra')
  })
})

describe('Orçamento au gabarit Vitfix', () => {
  it('jeu de contrôle : 1 800,00 € + 414,00 € = 2 214,00 €, prestações 1 107,00 · 664,20 · 442,80, deux pages', async () => {
    const pdf = await generer('vitfix-controle', entree())
    expect(pdf.pages).toHaveLength(2)
    expect(pdf.nom).toBe('Orcamento_DEV-2026-001_Rua_do_Exemplo_10_Canidelo.pdf')
    const p1 = pdf.texte[0]
    expect(pdf.compact[0]).toContain('vitfix.')
    expect(pdf.compact[0]).toContain('ORÇAMENTO')
    expect(p1).toContain('Reparação e pintura de fachada · Rua do Exemplo 10')
    expect(pdf.compact[0]).toContain('N.ºDEV-2026-001')
    expect(pdf.compact[0]).toContain(compact('EMITENTE DESTINATÁRIO'))
    expect(p1).toContain('Empresa Empresa Exemplo, Lda')
    expect(p1).toContain('NIPC 500 000 000')
    expect(p1).toContain('Cliente Cliente Exemplo')
    expect(p1).toContain('Local Rua do Exemplo 10, Canidelo, Vila Nova de Gaia')
    expect(pdf.compact[0]).toContain(compact('DATA DE EMISSÃO VALIDADE PRAZO DE EXECUÇÃO PAGAMENTO'))
    expect(p1).toContain('22/11/2026 30 dias 5 dias úteis 50 / 30 / 20')
    expect(pdf.compact[0]).toContain(compact('ART. DESIGNAÇÃO UN. QT. P. UNIT. TOTAL'))
    // Chiffres et titre d'un artigo : lignes de base distinctes (8,5 et 7,9 pt contre un interligne de 11,43 pt), comme le HTML.
    expect(p1).toContain('A.1 vg 1 1 150,00 € 1 150,00 € Reparação de fissuras na fachada')
    expect(p1).toContain('Abertura, tratamento e selagem das fissuras.')
    expect(p1).toContain('1. Abertura das fissuras')
    expect(p1).toContain('A.2 vg 1 650,00 € 650,00 € Pintura da fachada')
    expect(p1).toContain('Total sem IVA 1 800,00 €')
    expect(p1).toContain('IVA 23 % 414,00 €')
    expect(pdf.compact[0]).toContain(compact('TOTAL COM IVA 2 214,00 €'))
    expect(p1).toContain('Preço global e fixo. Prazo de execução: 5 dias úteis.')
    expect(p1).toContain('Pagamento 50 / 30 / 20: 1 107,00 € · 664,20 € · 442,80 €.')
    expect(p1).toContain('Transferência bancária · Wise Europe SA')
    expect(p1).toContain('Titular: Empresa Exemplo, Lda')
    expect(p1).toContain('IBAN PT50 0000 0000 0000 0000 0000 0 · BIC TRWIBEB1XXX')
    expect(p1).toContain('Aceito o orçamento e as condições gerais.')
    expect(p1).toContain('Nome e assinatura do cliente')
    // Pas de ligne de section pour une section unique non renommée (orçamentos émis).
    expect(pdf.compact[0]).not.toContain(compact('A · TRABALHOS'))
    const p2 = pdf.texte[1]
    expect(pdf.compact[1]).toContain('CONDIÇÕESGERAIS')
    expect(p2).toContain('1. Preço. Preço global e fixo para os trabalhos identificados com o cliente, para o âmbito descrito, firme durante a validade do orçamento (30 dias).')
    expect(p2).toContain('2. IVA. Aos valores indicados acresce IVA à taxa de 23 %.')
    expect(p2).toContain('1.ª prestação de 50 % na adjudicação, 2.ª prestação de 30 % a meio da execução e 3.ª prestação de 20 % na conclusão, por transferência bancária para o IBAN PT50 0000 0000 0000 0000 0000 0 (Wise Europe SA, titular Empresa Exemplo, Lda): 1 107,00 € · 664,20 € · 442,80 €.')
    expect(p2).toContain('Sem desconto por pagamento antecipado.')
    expect(p2).toContain('A execução está coberta pela garantia legal aplicável')
    expect(pdf.compact[1]).toContain('PROTEÇÃODEDADOS')
    expect(p2).toContain('através de geral@example.pt.')
    expect(p2).toContain('CRC do Porto, matrícula n.º 500000000 · Capital social 5.000,00 €')
    expect(p2).toContain('Documento emitido por processamento informático (Vitfix Pro) · DEV-2026-001 · 22/11/2026')
    // Règle 4 : aucun tiret long ; règle 11 : aucune ligne deslocações.
    expect(tout(pdf)).not.toMatch(/[\u2012-\u2015]/)
    expect(tout(pdf)).not.toMatch(/deslocaç/i)
    sansDebordement(pdf)
  })

  it('modèle vierge : pointillés, tableau à lignes vides, deux pages', async () => {
    const pdf = await generer('vitfix-vierge', entree({
      laborLines: [], lines: [], subtotalHT: 0, totalTTC: 0, tvaBreakdown: [], docTitle: '', docNumber: '',
      clientName: '', clientSiret: '', clientAddress: '', clientPhone: '', interventionAddress: '', executionDelay: '',
    }))
    expect(pdf.pages).toHaveLength(2)
    expect(pdf.texte[0]).toMatch(/Cliente \.{20,}/)
    expect(pdf.texte[0]).toMatch(/N\.º \.{14}/)
    expect(pdf.texte[0]).not.toContain('€')
    expect(pdf.texte[1]).toMatch(/Página 2 de 2$/)
    sansDebordement(pdf)
  })

  it('sections, remises, deux taux et toiture : lignes de section, sous-totaux, IVA par taux, garantie de 5 anos', async () => {
    const cobertura = [
      ligne('Impermeabilização da cobertura em fibrocimento', 60, 'm2', 30, 23, { remise: { type: 'pourcentage', valeur: 10 }, totalHT: 1620 } as Partial<ProductLine>),
    ]
    const interior = [ligne('Pintura interior da habitação', 85.5, 'm2', 10, 6)]
    const base23 = 1620
    const base6 = 855
    const pdf = await generer('vitfix-seccoes', entree({
      laborLines: cobertura,
      lines: [...cobertura, ...interior],
      linesName: 'Cobertura',
      customTables: [{ id: 'ct1', name: 'Interior', lines: interior }],
      subtotalHT: base23 + base6,
      totalTTC: Math.round((base23 * 1.23 + base6 * 1.06) * 100) / 100,
      tvaBreakdown: [{ rate: 23, base: base23, amount: 372.6 }, { rate: 6, base: base6, amount: 51.3 }],
    }))
    const p1 = pdf.texte[0]
    expect(pdf.compact[0]).toContain(compact('A · COBERTURA'))
    expect(pdf.compact[0]).toContain(compact('B · INTERIOR'))
    expect(p1).toContain('A.1 m² 60 30,00 € 1 620,00 € Impermeabilização da cobertura em fibrocimento')
    expect(p1).toContain('Desconto: -10 %')
    expect(p1).toContain('IVA: 6 %')
    expect(p1).toContain('B.1 m² 85,50 10,00 € 855,00 € Pintura interior da habitação')
    expect(p1).toContain('Subtotal A 1 620,00 €')
    expect(p1).toMatch(/Subtotal A/)
    expect(p1).toContain('IVA 23 % s/ 1 620,00 € 372,60 €')
    expect(p1).toContain('IVA 6 % s/ 855,00 € 51,30 €')
    expect(p1).toContain('Garantia: 5 anos sobre a execução dos trabalhos.')
    expect(tout(pdf)).toContain('Aos valores indicados acresce IVA às taxas indicadas nos artigos.')
    expect(tout(pdf)).toContain('Garantia de 5 anos sobre a execução dos trabalhos')
    sansDebordement(pdf)
  })

  it('autoliquidação et isenção : mentions du gabarit, total sans IVA', async () => {
    const auto = await generer('vitfix-autoliquidacao', entree({ regimeTva: 'autoliquidation_btp', totalTTC: 1800, clientType: 'professionnel' }))
    expect(auto.texte[0]).toContain('IVA Autoliquidação')
    expect(auto.compact[0]).toContain(compact('TOTAL 1 800,00 €'))
    expect(auto.texte[0]).toContain('IVA - autoliquidação (art. 2.º, n.º 1, al. j) do CIVA)')
    expect(tout(auto)).toContain('IVA autoliquidado pelo adquirente')
    const isento = await generer('vitfix-isento', entree({ regimeTva: 'franchise_293b', totalTTC: 1800 }))
    expect(isento.texte[0]).toContain('IVA Isento')
    expect(isento.texte[0]).toContain('Isento de IVA ao abrigo do art. 53.º do CIVA')
  })

  it('sans acompte : un seul paiement selon le délai du devis', async () => {
    const pdf = await generer('vitfix-sem-prestacoes', entree({ acomptesEnabled: false, paymentDue: 'Comptant à réception' }))
    expect(pdf.texte[0]).toContain('22/11/2026 30 dias 5 dias úteis A pronto')
    expect(pdf.texte[0]).toContain('Pagamento: 2 214,00 €, a pronto pagamento.')
    expect(pdf.texte[0]).toContain('A pronto: 2 214,00 €')
    expect(tout(pdf)).toContain('Pagamento de 100 % contra fatura, a pronto pagamento, por transferência bancária')
  })

  it('signature électronique du client dans le bloc Aceitação ; notes et livre resolução dans l\'annexe', async () => {
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    const pdf = await generer('vitfix-assinado', entree({
      signatureData: { svg_data: '<svg/>', signataire: 'Cliente Exemplo', timestamp: '2026-11-23T10:00:00Z', document_ref: 'DEV-2026-001', hash_sha256: 'a'.repeat(64) },
      svgToImageDataUrl: async () => pixel,
      notes: 'Acesso pela garagem.\nTrabalhos ao sábado de manhã.',
      isHorsEtablissement: true,
    }))
    expect(pdf.texte[0]).toContain('23/11/2026')
    expect(pdf.texte[0]).toContain('Cliente Exemplo')
    expect(pdf.texte[0]).toContain('Assinatura eletrónica simples (art. 25.º, n.º 1, eIDAS)')
    const anexo = pdf.texte.slice(1).join(' ')
    expect(anexo).toContain('• Acesso pela garagem.')
    expect(pdf.compact.slice(1).join('')).toContain('DIREITODELIVRERESOLUÇÃO')
    expect(anexo).toContain('14 dias de calendário')
    sansDebordement(pdf)
  })

  it('long orçamento : en-tête du tableau répété, pied de page sur chaque page, rien hors des marges', async () => {
    const lignes = Array.from({ length: 28 }, (_, i) => ligne(`Artigo de teste n.º ${i + 1}\nDescrição detalhada do trabalho, com materiais e mão de obra incluídos, medida em obra.`, i + 1, 'm2', 12.5, 23, {
      etapes: [{ id: `e${i}`, ordre: 1, designation: 'Preparação do suporte' }, { id: `f${i}`, ordre: 2, designation: 'Aplicação do produto' }],
    }))
    const totalHT = Math.round(lignes.reduce((s, l) => s + l.totalHT, 0) * 100) / 100
    const iva = Math.round(totalHT * 23) / 100
    const pdf = await generer('vitfix-longo', entree({ laborLines: lignes, lines: lignes, subtotalHT: totalHT, totalTTC: Math.round((totalHT + iva) * 100) / 100, tvaBreakdown: [{ rate: 23, base: totalHT, amount: iva }] }))
    expect(pdf.pages.length).toBeGreaterThan(2)
    expect(pdf.compact[1]).toContain(compact('ART. DESIGNAÇÃO UN. QT. P. UNIT. TOTAL'))
    expect(toutCompact(pdf)).toContain('A.28m²2812,50€350,00€Artigodetesten.º28')
    sansDebordement(pdf)
  })

  it('un seul acompte de 100 % : « Pagamento 100 % », clause « após a receção do pagamento » (gabarit)', async () => {
    const pdf = await generer('vitfix-100', entree({ acomptes: [acompte(1, 100, 'À la signature')] }))
    expect(pdf.texte[0]).toContain('22/11/2026 30 dias 5 dias úteis 100 %')
    expect(pdf.texte[0]).toContain('Pagamento 100 %: 2 214,00 €.')
    expect(tout(pdf)).toContain('Pagamento de 100 % na adjudicação, por transferência bancária')
    expect(tout(pdf)).toContain('Os trabalhos só são agendados após a receção do pagamento.')
    expect(tout(pdf)).not.toContain('1.ª prestação')
  })

  it('peinture « de elevado poder de cobertura » : garantie légale, pas de 5 anos', async () => {
    const pintura = [ligne('Pintura de paredes interiores\nTinta acrílica mate com elevado poder de cobertura.', 120, 'm2', 9, 23)]
    const pdf = await generer('vitfix-pintura', entree({ laborLines: pintura, docTitle: 'Pintura interior' }))
    expect(tout(pdf)).not.toContain('5 anos')
    expect(tout(pdf)).toContain('A execução está coberta pela garantia legal aplicável')
  })

  /** Artigo de `n` étapes, assez haut pour être coupé entre deux pages. */
  const artigoLongo = (titre: string, n: number) => ligne(titre, 1, 'f', 500, 23, {
    etapes: Array.from({ length: n }, (_, i) => ({ id: `${titre}-${i}`, ordre: i + 1, designation: `Etapa ${i + 1} do trabalho, executada conforme a ficha técnica do fabricante` })),
  })

  it('artigo coupé suivi du sous-total de sa section : rien dans la marge basse, titre de section jamais seul', async () => {
    for (const n of [40, 67, 135]) {
      const a = [ligne('Preparação', 1, 'f', 100, 23), artigoLongo('Reabilitação da fachada', n)]
      const b = [ligne('Limpeza final', 1, 'f', 80, 23)]
      const pdf = await generer(`vitfix-coupe-${n}`, entree({ laborLines: a, lines: [...a, ...b], linesName: 'Fachada', customTables: [{ id: 'b', name: 'Limpeza', lines: b }] }))
      expect(toutCompact(pdf)).toContain('SubtotalA')
      sansDebordement(pdf)
      pdf.compact.forEach((page) => {
        if (page.endsWith('A·FACHADA') || /B·LIMPEZA(?:DEV-2026-001·Página\d+de\d+)?$/.test(page)) throw new Error('titre de section seul en bas de page')
      })
    }
  })

  it('dernière page du devis presque vide : l\'annexe enchaîne sur cette page (pas de page presque blanche)', async () => {
    const seccoes = [1, 2, 3, 4].map((s) => Array.from({ length: 5 }, (_, i) => ligne(`Trabalho ${s}.${i + 1}`, 1, 'f', 100, 23, {
      etapes: [1, 2, 3].map((k) => ({ id: `${s}-${i}-${k}`, ordre: k, designation: `Etapa ${k}` })),
    })))
    const [a, ...outras] = seccoes
    const pdf = await generer('vitfix-continua', entree({
      laborLines: a, lines: seccoes.flat(), linesName: 'Secção 1',
      customTables: outras.map((lignes, i) => ({ id: `s${i}`, name: `Secção ${i + 2}`, lines: lignes })),
    }))
    const pageAceitacao = pdf.compact.findIndex((p) => p.includes('Aceitooorçamentoeascondiçõesgerais.'))
    const pageCondicoes = pdf.compact.findIndex((p) => p.includes('CONDIÇÕESGERAIS'))
    const remplissage = Math.max(...pdf.pages[pageAceitacao].filter((m) => m.y > 48).map((m) => 841.89 - m.y))
    if (remplissage < (841.89 - 42.52 - 48) / 2) expect(pageCondicoes).toBe(pageAceitacao)
    sansDebordement(pdf)
  })

  it('titre « Registo fotográfico » jamais seul en bas de page, quelle que soit la longueur des notes', async () => {
    vi.stubGlobal('Image', undefined)
    try {
      const fotos = [{ id: 'f1', url: 'https://example.test/1.jpg', label: 'Cobertura' }, { id: 'f2', url: 'https://example.test/2.jpg', label: 'Claraboia' }]
      for (let n = 1; n <= 46; n += 3) {
        const notes = Array.from({ length: n }, (_, i) => `Nota ${i + 1} sobre a obra.`).join('\n')
        const pdf = await generer(`vitfix-fotos-${n}`, entree({ selectedPhotos: fotos, notes }))
        const page = pdf.compact.findIndex((p) => p.includes('REGISTOFOTOGRÁFICO'))
        expect(pdf.compact[page], `${n} notes`).toContain('FOTO1')
      }
    } finally {
      vi.unstubAllGlobals()
      vi.stubGlobal('fetch', fetchRessources)
      vi.stubGlobal('open', vi.fn())
    }
  })
})

describe('Factures de la société Vitfix', () => {
  it('restent au modèle BTP par défaut (le gabarit ne couvre que l\'orçamento)', async () => {
    const pdf = await generer('vitfix-fatura-defaut', entree({ docType: 'facture', docNumber: 'FACT-2026-001', acomptesEnabled: false }))
    expect(tout(pdf)).not.toContain('Documento emitido por processamento informático (Vitfix Pro)')
    expect(pdf.nom).not.toMatch(/^Orcamento_/)
  })

  it('numérotation portugaise : une fatura de adiantamento FA- rattachée à un orçamento ORC- le dit « sobre orçamento »', async () => {
    const pdf = await generer('vitfix-fatura-adiantamento', entree({
      docType: 'facture', factureSubType: 'acompte', docNumber: 'FA-2026-001', parentInvoiceNumber: 'ORC-2026-007',
      acompteOrdre: 1, acompteTotal: 2, acomptePourcentage: 50, acomptesEnabled: false,
    }))
    expect(compact(tout(pdf))).toContain(compact('(sobre orçamento ORC-2026-007)'))
    expect(tout(pdf)).toContain('FA-2026-001')
  })
})
