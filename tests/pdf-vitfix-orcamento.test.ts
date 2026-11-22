// Gabarit d'orçamento Vitfix (lib/pdf/modele-vitfix-orcamento.ts) : devis de la société de la marque Vitfix au
// gabarit template_orcamento_vitfix.html v1.1 du 22/11/2026, remplis par les données du générateur BTP.
// Le générateur V3 tourne pour de vrai (jsPDF) ; le texte des PDF est relu avec pdf.js, page par page, avec sa
// position. Police servie depuis public/ par un fetch simulé. Données fictives uniquement.
// Avec PDF_SORTIE=<dossier>, les PDF sont aussi écrits sur disque pour un contrôle visuel.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { generateDevisPdfV3, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import { URL_POLICE_GABARIT, URL_POLICE_GABARIT_GRAS } from '@/lib/pdf/mise-en-page-gabarit'
import { VITFIX_SOCIETE_PROFIL_ID, modeleDocumentSociete } from '@/lib/pdf/modeles-societes'
import {
  bancoDoBic,
  ibanLegivel,
  modoPagina1,
  momentoPrestacao,
  nifLegivel,
  nomeFicheiroVitfix,
  prestacoesVitfix,
  quantidadeVitfix,
} from '@/lib/pdf/modele-vitfix-orcamento'
import type { ProductLine } from '@/lib/devis-types'
import pt from '@/locales/pt.json'

const DOSSIER_SORTIE = process.env.PDF_SORTIE
const RACINE = process.cwd()
const RESSOURCES: Record<string, string> = {
  [URL_POLICE_GABARIT]: join(RACINE, 'public/fonts/LiberationSans-Regular.ttf'),
  [URL_POLICE_GABARIT_GRAS]: join(RACINE, 'public/fonts/LiberationSans-Bold.ttf'),
}

const NB = String.fromCharCode(0xa0)
/** Texte tel qu'il se lit dans le PDF (espaces insécables ramenés à des espaces). */
const lu = (s: string) => s.split(NB).join(' ')

const t = (cle: string): string => {
  const valeur = cle.split('.').reduce<unknown>((noeud, part) => (noeud as Record<string, unknown> | undefined)?.[part], pt)
  return typeof valeur === 'string' ? valeur : cle
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

function entree(surcharge: Partial<PdfV3Input> = {}): PdfV3Input {
  const lignes = surcharge.laborLines ?? jeuControle
  const totalHT = Math.round(lignes.reduce((s, l) => s + l.totalHT, 0) * 100) / 100
  const iva = Math.round(totalHT * 23) / 100
  return {
    action: 'fichier',
    locale: 'pt',
    localeFormats: { currencyFormat: (n: number) => `${n} €`, taxLabel: 'IVA' },
    t,
    docType: 'devis',
    docNumber: 'DEV-2026-001',
    docTitle: 'Reparação e pintura de fachada · Rua do Exemplo 10',
    docDate: '2026-11-22',
    docValidity: 30,
    prestationDate: '',
    executionDelay: '5 jours ouvrés',
    companyStatus: 'lda',
    companyName: 'Empresa Exemplo, Lda',
    companySiret: '500000000',
    companyAddress: 'Rua dos Exemplos 1, 4000-000 Porto',
    companyRCS: 'CRC do Porto, matrícula n.º 500000000',
    companyCapital: '5.000,00',
    companyPhone: '+351 900 000 000',
    companyEmail: 'geral@example.pt',
    tvaEnabled: true,
    tvaNumber: '',
    insuranceName: '',
    insuranceNumber: '',
    insuranceCoverage: 'Portugal',
    insuranceType: 'rc_pro',
    decennaleEligibility: 'always',
    mediatorName: '',
    mediatorUrl: '',
    isHorsEtablissement: false,
    clientName: 'Cliente Exemplo',
    clientEmail: '',
    clientAddress: 'Rua do Cliente 20, 4400-000 Vila Nova de Gaia',
    clientPhone: '+351 910 000 000',
    clientSiret: '200000000',
    clientType: 'particulier',
    interventionAddress: 'Rua do Exemplo 10, Canidelo, Vila Nova de Gaia',
    interventionBatiment: '',
    interventionEtage: '',
    interventionEspacesCommuns: '',
    interventionExterieur: '',
    companyAPE: '41000-R4',
    paymentMode: 'Virement bancaire',
    paymentDue: '30 jours',
    paymentCondition: 'Aucun escompte accordé pour paiement anticipé',
    discount: '',
    penaltyRate: '',
    recoveryFee: '',
    iban: 'PT50000000000000000000000',
    bic: 'TRWIBEB1XXX',
    lines: lignes,
    laborLines: lignes,
    materialLines: [],
    fraisLines: [],
    linesName: "Main d'oeuvre",
    subtotalHT: totalHT,
    totalTTC: Math.round((totalHT + iva) * 100) / 100,
    tvaBreakdown: [{ rate: 23, base: totalHT, amount: iva }],
    regimeTva: 'classique',
    acomptesEnabled: true,
    acomptes: [
      { id: 'a1', ordre: 1, label: 'Acompte', pourcentage: 50, declencheur: 'À la signature' },
      { id: 'a2', ordre: 2, label: 'Situation', pourcentage: 30, declencheur: 'À mi-chantier' },
    ],
    notes: '',
    sourceDevisRef: null,
    signatureData: null,
    attachedRapport: null,
    selectedPhotos: [],
    artisan: { id: VITFIX_SOCIETE_PROFIL_ID, company_name: 'Empresa Exemplo, Lda' },
    modele: 'vitfix-orcamento',
    ptFiscalData: null,
    svgToImageDataUrl: async () => '',
    fetchFreshLogo: async () => null,
    ...surcharge,
  }
}

interface Texte { str: string; x: number; y: number; largeur: number }
interface PdfLu {
  pages: Texte[][]
  texte: string[]
  compact: string[]
  nom: string
}

let pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null = null

async function lire(octets: Uint8Array): Promise<Texte[][]> {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(join(RACINE, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href
  }
  const standardFontDataUrl = `${join(RACINE, 'node_modules/pdfjs-dist/standard_fonts').split('\\').join('/')}/`
  const chargement = pdfjs.getDocument({ data: new Uint8Array(octets), useSystemFonts: false, standardFontDataUrl })
  const doc = await chargement.promise
  const pages: Texte[][] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const contenu = await (await doc.getPage(n)).getTextContent()
    pages.push(contenu.items.flatMap((item) => ('str' in item && item.str.trim()
      ? [{ str: item.str, x: item.transform[4], y: item.transform[5], largeur: item.width }]
      : [])))
  }
  await chargement.destroy()
  return pages
}

/** Ordre de lecture : morceaux regroupés par ligne de base (à 1 pt près), de haut en bas, puis de gauche à droite. */
function ordreDeLecture(page: Texte[]): string {
  const lignes: Texte[][] = []
  for (const m of [...page].sort((a, b) => b.y - a.y)) {
    const ligneTrouvee = lignes.find((l) => Math.abs(l[0].y - m.y) <= 1)
    if (ligneTrouvee) ligneTrouvee.push(m)
    else lignes.push([m])
  }
  return lu(lignes.map((l) => l.sort((a, b) => a.x - b.x).map((m) => m.str).join(' ')).join(' ')).replace(/ +/g, ' ')
}

async function generer(nom: string, input: PdfV3Input): Promise<PdfLu> {
  const resultat = await generateDevisPdfV3(input)
  const octets = Buffer.from(resultat.fichier)
  if (DOSSIER_SORTIE) writeFileSync(join(DOSSIER_SORTIE, `${nom}.pdf`), octets)
  const pages = await lire(octets)
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

  it('échéancier : le reste devient la dernière prestação « na conclusão » ; sans acompte, un seul paiement', () => {
    expect(prestacoesVitfix(entree())).toEqual([
      { pct: 50, momento: 'na adjudicação' },
      { pct: 30, momento: 'a meio da execução' },
      { pct: 20, momento: 'na conclusão' },
    ])
    expect(prestacoesVitfix(entree({ acomptesEnabled: false }))).toEqual([{ pct: 100, momento: '' }])
  })

  it('nom du fichier (règle 8) : numéro et lieu du chantier', () => {
    expect(nomeFicheiroVitfix({ docNumber: 'DEV-2026-001', interventionAddress: 'Travessa do Pinheiral 71, Canidelo, Gaia' }))
      .toBe('Orcamento_DEV-2026-001_Travessa_do_Pinheiral_71_Canidelo.pdf')
    expect(nomeFicheiroVitfix({ docNumber: 'DEV-2026-001', interventionAddress: '' })).toBe('Orcamento_DEV-2026-001.pdf')
  })

  it('mise en page de la page 1 comme la fonction ajustar du gabarit', () => {
    const utile = 841.89 - 42.52 - 48
    expect(modoPagina1(700, () => 0)).toBe('normal')
    expect(modoPagina1(utile + 20, () => utile - 10)).toBe('compacto')
    expect(modoPagina1(utile + 20, () => utile + 1)).toBe('continua')
    expect(modoPagina1(utile + 500, () => 0)).toBe('quebra')
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
})

describe('Factures de la société Vitfix', () => {
  it('restent au modèle BTP par défaut (le gabarit ne couvre que l\'orçamento)', async () => {
    const pdf = await generer('vitfix-fatura-defaut', entree({ docType: 'facture', docNumber: 'FACT-2026-001', acomptesEnabled: false }))
    expect(tout(pdf)).not.toContain('Documento emitido por processamento informático (Vitfix Pro)')
    expect(pdf.nom).not.toMatch(/^Orcamento_/)
  })
})
