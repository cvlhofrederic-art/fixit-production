// Gabarit de relatório Vitfix (lib/pdf/modele-vitfix-relatorio.ts) : relatórios de la société de la marque Vitfix au
// gabarit « Template Relatório Vitfix » v1 du 26/11/2026, remplis par les champs du module Rapports et rien d'autre.
// jsPDF tourne pour de vrai ; le texte des PDF est relu avec pdf.js, page par page, avec sa position. Police servie
// depuis public/ par un fetch simulé. Données fictives uniquement.
// Avec PDF_SORTIE=<dossier>, les PDF sont aussi écrits sur disque pour un contrôle visuel.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { jsPDF } from 'jspdf'
import { URL_POLICE_GABARIT, URL_POLICE_GABARIT_GRAS } from '@/lib/pdf/mise-en-page-gabarit'
import { METHOD_SOLUCOES_PROFIL_ID, VITFIX_SOCIETE_PROFIL_ID, modeleDocumentSociete, modeleRapportSociete, prefixeNumeroRapport } from '@/lib/pdf/modeles-societes'
import {
  dataEmissaoRelatorio,
  dataHoraFoto,
  estadoRelatorio,
  fotosDoRelatorio,
  horarioRelatorio,
  itensDoTexto,
  localidadeDaMorada,
  materiaisDoRelatorio,
  nomeCurtoEmpresa,
  projetoDoRelatorio,
  rendreRelatorioVitfix,
  rotuloDocumentoAssociado,
  semTracosLongos,
  seguroDoRelatorio,
} from '@/lib/pdf/modele-vitfix-relatorio'
import { generateRapportPDF, type PhotoForPDF, type RapportPDFData } from '@/lib/rapport-pdf'
import { lirePdf, lu, ordreDeLecture, type Texte } from './helpers/lecture-pdf'

/** PDF enregistrés par generateRapportPDF (save de jsPDF intercepté : pas de téléchargement en test). */
const sauvegardes = vi.hoisted(() => [] as Array<{ nom: string; pdf: { output: (type: 'arraybuffer') => ArrayBuffer } }>)

vi.mock('jspdf', async (original) => {
  const m = await original<typeof import('jspdf')>()
  class JsPdfEspion extends m.jsPDF {
    constructor(...args: ConstructorParameters<typeof m.jsPDF>) {
      super(...args)
      this.save = ((nom: string) => {
        sauvegardes.push({ nom, pdf: this })
        return this
      }) as unknown as InstanceType<typeof m.jsPDF>['save']
    }
  }
  return { ...m, jsPDF: JsPdfEspion, default: JsPdfEspion }
})

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
  if (DOSSIER_SORTIE) mkdirSync(DOSSIER_SORTIE, { recursive: true })
})

beforeEach(() => {
  sauvegardes.length = 0
  fetchRessources.mockClear()
  vi.stubGlobal('fetch', fetchRessources)
})

/** Rapport du module tel que le formulaire l'enregistre (exemple du gabarit ramené aux champs du module). */
function rapport(surcharge: Partial<RapportPDFData> = {}): RapportPDFData {
  return {
    rapportNumber: 'RAP-2026-001',
    refDevisFact: 'ORC-2026-004',
    artisanName: 'EMPRESA EXEMPLO CONSTRUÇÕES, LDA',
    artisanAddress: 'Rua dos Exemplos, 1, 2.º Esq., 4630-000 Marco de Canaveses',
    artisanPhone: '900 000 000',
    artisanEmail: 'geral@example.pt',
    artisanSiret: '500000000',
    artisanInsurance: 'Seguradora Exemplo n°123456',
    clientName: 'Cliente Exemplo, Lda',
    clientPhone: '',
    clientEmail: '',
    clientAddress: 'Rua do Cliente, n.º 123, 4000-000 Porto',
    interventionDate: '2026-11-25',
    startTime: '09:00',
    endTime: '17:30',
    siteAddress: '',
    motif: 'Infiltração por fissuração da fachada principal — identificação das causas e reparação.',
    travaux: [
      'Picagem do reboco solto e abertura das fissuras em V.',
      'Selagem das fissuras com argamassa de reparação.',
      'Aplicação de tinta elástica impermeabilizante em duas demãos.',
    ],
    materiaux: ['Argamassa de reparação (4 sacos), rede de fibra de vidro (12 m²)', 'Tinta elástica impermeabilizante - 30 L', 'Fita de proteção'],
    observations: 'Fissuração do reboco ao longo dos cantos dos vãos, com escorrências e manchas de humidade nos panos adjacentes.',
    recommendations: '- Tratamento integral da fachada pelo método descrito.\n- Recolocação do tubo de queda na mesma intervenção.',
    status: 'termine',
    linkedPhotoIds: [],
    ...surcharge,
  }
}

interface PdfLu {
  pages: Texte[][]
  texte: string[]
  octets: Buffer
}

async function generer(nom: string, r: RapportPDFData, fotos: PhotoForPDF[] = []): Promise<PdfLu> {
  const pdf = await rendreRelatorioVitfix(jsPDF, r, fotos, { dataEmissao: '26/11/2026' })
  const octets = Buffer.from(pdf.output('arraybuffer'))
  if (DOSSIER_SORTIE) writeFileSync(join(DOSSIER_SORTIE, `${nom}.pdf`), octets)
  const pages = await lirePdf(octets)
  return { pages, texte: pages.map(ordreDeLecture), octets }
}

const tout = (pdf: PdfLu) => pdf.texte.join(' ')

/** Texte sans espaces, en forme composée (pdf.js peut rendre « Ó » en deux caractères). */
const compact = (s: string) => s.normalize('NFC').replace(/\s+/g, '')
/**
 * Position d'un texte dans le texte lu, espaces ignorés (pdf.js sépare les lettres des titres très espacés), -1 s'il
 * manque.
 */
const position = (texte: string, attendu: string) => compact(texte).indexOf(compact(attendu))

/** Ligne de base du pied de page (@page, centré dans la marge basse de 19 mm) : y ≈ 24,5 pt depuis le bas. */
const BANDE_PIED = 30

/**
 * Aucun texte hors de la zone utile (@page margin: 15mm 14mm 19mm). Le pied de page est seul dans sa bande, au texte
 * exact ; rien d'autre ne descend dans la marge basse.
 */
function sansDebordement(pdf: PdfLu) {
  const margeBas = (19 * 72) / 25.4
  pdf.pages.forEach((page, i) => {
    const pied = page.filter((m) => m.y < BANDE_PIED).sort((a, b) => a.x - b.x).map((m) => m.str).join(' ')
    expect(lu(pied)).toMatch(new RegExp(` RAP-2026-001 Página ${i + 1} / ${pdf.pages.length}$`))
    for (const m of page) {
      if (m.y < BANDE_PIED) continue
      expect(m.y, `« ${m.str} » dans la marge basse (page ${i + 1})`).toBeGreaterThan(margeBas)
      expect(m.y, `« ${m.str} » dans la marge haute`).toBeLessThan(841.89 - (15 * 72) / 25.4)
      expect(m.x, `« ${m.str} » dans la marge gauche`).toBeGreaterThan((14 * 72) / 25.4 - 0.5)
      expect(m.x + m.largeur, `« ${m.str} » dans la marge droite`).toBeLessThan(595.28 - (14 * 72) / 25.4 + 0.5)
    }
  })
}

describe('Registre des relatórios de société', () => {
  it('la fiche Vitfix reçoit le gabarit de relatório ; les autres fiches gardent le PDF du module', () => {
    expect(modeleRapportSociete(VITFIX_SOCIETE_PROFIL_ID)).toBe('vitfix-relatorio')
    expect(modeleRapportSociete(METHOD_SOLUCOES_PROFIL_ID)).toBeUndefined()
    expect(modeleRapportSociete('fiche-quelconque')).toBeUndefined()
    expect(modeleRapportSociete('')).toBeUndefined()
    expect(modeleRapportSociete(undefined)).toBeUndefined()
    expect(modeleRapportSociete('toString')).toBeUndefined()
    // Le gabarit d'orçamento de la même fiche ne change pas.
    expect(modeleDocumentSociete(VITFIX_SOCIETE_PROFIL_ID)).toBe('vitfix-orcamento')
  })

  it('numéro d’un nouveau rapport : RT (Relatório Técnico) au gabarit Vitfix, RAP sinon', () => {
    expect(prefixeNumeroRapport('vitfix-relatorio')).toBe('RT')
    expect(prefixeNumeroRapport(undefined)).toBe('RAP')
  })
})

describe('Date d’émission du relatório', () => {
  const hoje = new Date(2026, 10, 30, 10, 0)
  it('jour de création du rapport, à l’heure de l’appareil : la même à chaque téléchargement', () => {
    expect(dataEmissaoRelatorio('2026-11-26T10:00:00', '2026-11-25', hoje)).toBe('26/11/2026')
    expect(dataEmissaoRelatorio(new Date(2026, 10, 26, 23, 30).toISOString(), '2026-11-25', hoje)).toBe('26/11/2026')
  })
  it('jamais avant la visite : un rapport préparé à l’avance est émis le jour de la visite', () => {
    expect(dataEmissaoRelatorio('2026-11-20T09:00:00', '2026-11-25', hoje)).toBe('25/11/2026')
  })
  it('sans date de création lisible : le jour de la génération', () => {
    expect(dataEmissaoRelatorio(undefined, '2026-11-25', hoje)).toBe('30/11/2026')
    expect(dataEmissaoRelatorio('pas une date', '', hoje)).toBe('30/11/2026')
  })
})

describe('Champs du module dans les mots du gabarit', () => {
  it('horário : début, fin et durée comme le module ; une seule heure si l’autre manque', () => {
    expect(horarioRelatorio('09:00', '17:30')).toBe('09:00 - 17:30 · 8h30')
    expect(horarioRelatorio('9:05', '10:05')).toBe('09:05 - 10:05 · 1h00')
    expect(horarioRelatorio('11:00', '10:00')).toBe('11:00 - 10:00')
    expect(horarioRelatorio('09:00', '')).toBe('Início 09:00')
    expect(horarioRelatorio('', '12:00')).toBe('Fim 12:00')
    expect(horarioRelatorio('', '')).toBe('')
  })

  it('document lié : orçamento ou fatura selon le préfixe', () => {
    expect(rotuloDocumentoAssociado('ORC-2026-004')).toBe('Orçamento associado')
    expect(rotuloDocumentoAssociado('DEV-2026-001')).toBe('Orçamento associado')
    expect(rotuloDocumentoAssociado('FT-2026-002')).toBe('Fatura associada')
    expect(rotuloDocumentoAssociado('FACT-2026-002')).toBe('Fatura associada')
    expect(rotuloDocumentoAssociado('Contrato 12')).toBe('Documento associado')
    expect(rotuloDocumentoAssociado('')).toBe('Orçamento associado')
  })

  it('estado du formulaire en PT-PT', () => {
    expect(estadoRelatorio('termine')).toBe('Concluído')
    expect(estadoRelatorio('en_cours')).toBe('Em curso')
    expect(estadoRelatorio('a_reprendre')).toBe('A retomar')
    expect(estadoRelatorio('sous_garantie')).toBe('Em garantia')
    expect(estadoRelatorio('inconnu')).toBe('')
    expect(estadoRelatorio('constructor')).toBe('')
  })

  it('localité de la société, nom court, assurance', () => {
    expect(localidadeDaMorada('Rua dos Exemplos, 1, 2.º Esq., 4630-000 Marco de Canaveses')).toBe('Marco de Canaveses')
    expect(localidadeDaMorada('Rua A, 4000-000 Porto, Portugal')).toBe('Porto')
    expect(localidadeDaMorada('Rua sem código postal')).toBe('')
    expect(nomeCurtoEmpresa('EMPRESA EXEMPLO CONSTRUÇÕES, LDA')).toBe('EMPRESA EXEMPLO CONSTRUÇÕES')
    expect(nomeCurtoEmpresa('Exemplo - Construções, Unipessoal, Lda.')).toBe('Exemplo - Construções')
    expect(nomeCurtoEmpresa('Casa Exemplo S.A.')).toBe('Casa Exemplo')
    expect(nomeCurtoEmpresa('Mesa Exemplo')).toBe('Mesa Exemplo')
    expect(seguroDoRelatorio('Seguradora Exemplo n°123456')).toBe('Seguradora Exemplo, apólice n.º 123456')
    expect(seguroDoRelatorio('Seguradora Exemplo n°')).toBe('Seguradora Exemplo')
    expect(seguroDoRelatorio('')).toBe('')
  })

  it('matériaux : un matériau par ligne, quantité entre parenthèses ou après « - »', () => {
    expect(materiaisDoRelatorio(['Argamassa (4 sacos), rede de fibra (12 m²)', 'Tinta - 30 L', 'Rede (cantos dos vãos)', 'Tinta (branca) (2 L)', ' '])).toEqual([
      { produto: 'Argamassa', quantidade: '4 sacos' },
      { produto: 'rede de fibra', quantidade: '12 m²' },
      { produto: 'Tinta', quantidade: '30 L' },
      { produto: 'Rede (cantos dos vãos)', quantidade: '' },
      { produto: 'Tinta (branca)', quantidade: '2 L' },
    ])
    expect(materiaisDoRelatorio(undefined)).toEqual([])
  })

  it('matériaux : une parenthèse qui n’est pas une quantité reste au produit ; « – » de saisie accepté', () => {
    const longue = 'Tinta (aplicada em 2 demãos na fachada norte e na fachada sul do edifício)'
    expect(materiaisDoRelatorio([longue, '(3 un.)', 'Cimento - cinzento'])).toEqual([
      { produto: longue, quantidade: '' },
      { produto: '(3 un.)', quantidade: '' },
      { produto: 'Cimento - cinzento', quantidade: '' },
    ])
    // Tiret demi-cadratin saisi : remplacé par « · » à l'entrée du gabarit, la quantité est toujours lue.
    expect(materiaisDoRelatorio([semTracosLongos(`Tinta ${String.fromCharCode(0x2013)} 30 L`)])).toEqual([{ produto: 'Tinta', quantidade: '30 L' }])
  })

  it('tirets longs : « · » entre deux espaces, « - » ailleurs, jamais à travers un saut de ligne', () => {
    const tiret = String.fromCharCode(0x2013)
    const cadratin = String.fromCharCode(0x2014)
    expect(semTracosLongos(`Fachada ${cadratin} norte`)).toBe('Fachada · norte')
    expect(semTracosLongos(`2015${tiret}2016`)).toBe('2015-2016')
    expect(semTracosLongos(`${tiret} Primeiro\n${tiret} Segundo\n${cadratin} Terceiro`)).toBe('- Primeiro\n- Segundo\n- Terceiro')
    expect(itensDoTexto(semTracosLongos(`${tiret} Primeiro\n${tiret} Segundo`))).toEqual(['Primeiro', 'Segundo'])
  })

  it('sous-titre : « motivo · local » ; motivo trop long ou absent : le local seul', () => {
    expect(projetoDoRelatorio('Infiltração na fachada.\nDetalhe', 'Rua A, 4000-000 Porto')).toBe('Infiltração na fachada · Rua A, 4000-000 Porto')
    expect(projetoDoRelatorio('x'.repeat(81), 'Rua A')).toBe('Rua A')
    expect(projetoDoRelatorio('', 'Rua A')).toBe('Rua A')
    expect(projetoDoRelatorio('Infiltração', '')).toBe('Infiltração')
  })

  it('nom court et assurance : temps linéaire sur une saisie pathologique', () => {
    const debut = Date.now()
    nomeCurtoEmpresa(`A${' '.repeat(50000)}`)
    seguroDoRelatorio(`A${' '.repeat(50000)}x`)
    materiaisDoRelatorio([`(${' '.repeat(50000)}`])
    expect(Date.now() - debut).toBeLessThan(500)
  })

  it('recomendações : un point par ligne, sans les puces tapées à la main', () => {
    expect(itensDoTexto('- Primeiro\n\n• Segundo\n3. Terceiro\nQuarto')).toEqual(['Primeiro', 'Segundo', 'Terceiro', 'Quarto'])
  })

  it('photos liées : dans l’ordre du rapport, sans doublon, une photo supprimée est ignorée', () => {
    const disponiveis: PhotoForPDF[] = [{ id: 'a', url: 'a.jpg' }, { id: 'b', url: 'b.jpg' }, { id: 'c', url: 'c.jpg' }]
    expect(fotosDoRelatorio({ linkedPhotoIds: ['c', 'x', 'a', 'c'] }, disponiveis).map((p) => p.id)).toEqual(['c', 'a'])
    expect(fotosDoRelatorio({}, disponiveis)).toEqual([])
    expect(dataHoraFoto('pas une date')).toBe('')
    expect(dataHoraFoto('2026-11-25T10:32:00')).toMatch(/^25\/11\/2026 10:32$/)
  })
})

describe('Relatório au gabarit Vitfix', () => {
  it('en-tête, partes, bande et sections dans l’ordre du gabarit, numérotées de 1 à 5', async () => {
    const pdf = await generer('relatorio-complet', rapport())
    const t = tout(pdf)
    const ordre = [
      'vitfix', 'RELATÓRIO TÉCNICO', 'Rua do Cliente, n.º 123, 4000-000 Porto', 'RAP-2026-001',
      'EMITENTE', 'DESTINATÁRIO', 'Nome EMPRESA EXEMPLO CONSTRUÇÕES, LDA', 'Nome Cliente Exemplo, Lda',
      'NIPC 500 000 000', 'LOCAL DA INTERVENÇÃO',
      'DATA DA VISITA', 'HORÁRIO', 'ORÇAMENTO ASSOCIADO', 'ESTADO', '25/11/2026', '09:00 - 17:30 · 8h30', 'ORC-2026-004', 'Concluído',
      '1. OBJETO', 'Infiltração por fissuração da fachada principal · identificação',
      '2. OBSERVAÇÕES NO LOCAL', 'Fissuração do reboco',
      '3. TRABALHOS REALIZADOS', 'Picagem do reboco solto',
      '4. MATERIAIS E PRODUTOS', 'PRODUTO QUANTIDADE', 'Argamassa de reparação 4 sacos', 'rede de fibra de vidro 12 m²', 'Tinta elástica impermeabilizante 30 L', 'Fita de proteção',
      '5. CONCLUSÕES E RECOMENDAÇÕES', 'Tratamento integral da fachada', 'Recolocação do tubo de queda',
      'LOCAL E DATA', 'PELA EMPRESA EXEMPLO CONSTRUÇÕES', 'Marco de Canaveses, 26/11/2026',
      // Pied légal du gabarit, mot pour mot.
      'Este relatório baseia-se na inspeção realizada na data da visita, nas condições de acesso e visibilidade então existentes, e destina-se exclusivamente ao destinatário identificado.',
      'tratados por EMPRESA EXEMPLO CONSTRUÇÕES, LDA', 'contacte geral@example.pt.',
    ]
    let avant = -1
    for (const attendu of ordre) {
      const ici = position(t, attendu)
      expect(ici, `« ${attendu} » absent ou hors de l’ordre du gabarit`).toBeGreaterThan(avant)
      avant = ici
    }
    // Emitente : contacto et assurance du rapport. NIF du destinataire et tipologia : absents du module, libellé et
    // pointillés à remplir à la main (aucun texte à leur place).
    expect(t).toContain('Contacto 900 000 000 · geral@example.pt')
    expect(t).toContain('Seguro Seguradora Exemplo, apólice n.º 123456')
    expect(t).toContain('NIPC 500 000 000 NIF Morada')
    expect(t).toMatch(/Tipologia DATA DA VISITA/)
    // Ce que le module n'a pas n'apparaît pas ; aucun « N/D », aucun tiret long.
    expect(t).not.toMatch(/ENQUADRAMENTO|ANOMALIAS|ANÁLISE|MÉTODO|CONTROLO|RESERVAS|SEGURADORA · PROCESSO|ANEXO FOTOGRÁFICO|Figura/)
    expect(t).not.toMatch(/N\/D|a definir/i)
    expect(t).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
    sansDebordement(pdf)
  })

  it('pied de page du gabarit sur chaque page : émetteur · NIPC, numéro, Página x / y', async () => {
    const longs = Array.from({ length: 40 }, (_, i) => `Trabalho n.º ${i + 1}: execução de reparações localizadas no pano ${i + 1} da fachada, com limpeza final da zona.`)
    const pdf = await generer('relatorio-long', rapport({ travaux: longs }))
    expect(pdf.pages.length).toBeGreaterThan(1)
    pdf.pages.forEach((page, i) => {
      const pied = lu(page.filter((m) => m.y < 40).sort((a, b) => a.x - b.x).map((m) => m.str).join(' '))
      expect(pied).toBe(`EMPRESA EXEMPLO CONSTRUÇÕES, LDA · NIPC 500 000 000 RAP-2026-001 Página ${i + 1} / ${pdf.pages.length}`)
    })
    sansDebordement(pdf)
    // Tous les travaux, dans l'ordre, sur plusieurs pages.
    const t = tout(pdf)
    let avant = -1
    for (let i = 1; i <= 40; i++) {
      const ici = t.indexOf(`Trabalho n.º ${i}:`)
      expect(ici).toBeGreaterThan(avant)
      avant = ici
    }
  })

  it('sections absentes masquées, numérotation sans trou ; champs vides en pointillés, jamais de texte de remplacement', async () => {
    const pdf = await generer('relatorio-minimo', rapport({
      refDevisFact: '', observations: '', travaux: [], materiaux: [], recommendations: '', startTime: '', endTime: '',
      clientAddress: '', siteAddress: '', artisanInsurance: '', status: '',
    }))
    const t = tout(pdf)
    expect(t).toContain('1. OBJETO')
    expect(t).not.toMatch(/2\. |OBSERVAÇÕES|TRABALHOS|MATERIAIS|CONCLUSÕES/)
    // Cases vides : le libellé reste, la valeur est une ligne en pointillés (aucun texte).
    expect(t).toContain('DATA DA VISITA HORÁRIO ORÇAMENTO ASSOCIADO ESTADO 25/11/2026')
    expect(t).not.toContain('Seguro')
    expect(t).not.toMatch(/N\/D|a definir|undefined|null/i)
    sansDebordement(pdf)
  })

  it('tableau de matériaux coupé entre deux pages : l’en-tête se répète', async () => {
    const materiaux = Array.from({ length: 70 }, (_, i) => `Material de exemplo n.º ${i + 1} (${i + 1} un.)`)
    const pdf = await generer('relatorio-materiais', rapport({ materiaux }))
    const pagesAvecTableau = pdf.texte.filter((p) => p.includes('Material de exemplo'))
    expect(pagesAvecTableau.length).toBeGreaterThan(1)
    for (const p of pagesAvecTableau) expect(p).toContain('PRODUTO QUANTIDADE')
    sansDebordement(pdf)
  })

  it('anexo fotográfico : photos liées seulement, recadrées en 4:3, légende « Foto n · libellé · date », photo absente signalée', async () => {
    // Chargement des photos simulé (Image et canvas du navigateur) : 4000 × 1000 px, sauf une adresse illisible.
    const jpeg = `data:image/jpeg;base64,${readFileSync(join(RACINE, 'public/images/administrateur-judiciaire/canal/fuite-colonne.jpg')).toString('base64')}`
    const dessins: unknown[][] = []
    class ImageSimulee {
      width = 4000
      height = 1000
      crossOrigin = ''
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(url: string) { setTimeout(() => (url.includes('absente') ? this.onerror?.() : this.onload?.()), 0) }
    }
    vi.stubGlobal('Image', ImageSimulee)
    const creer = document.createElement.bind(document)
    const canvas = vi.spyOn(document, 'createElement').mockImplementation(((balise: string) => {
      if (balise !== 'canvas') return creer(balise)
      return { width: 0, height: 0, toDataURL: () => jpeg, getContext: () => ({ fillStyle: '', fillRect() {}, drawImage: (...a: unknown[]) => { dessins.push(a) } }) }
    }) as typeof document.createElement)
    try {
      const fotos: PhotoForPDF[] = [
        { id: 'p1', url: 'https://example.test/p1.jpg', label: 'Pormenor da fissura', taken_at: '2026-11-25T10:32:00' },
        { id: 'p2', url: 'https://example.test/p2.jpg', taken_at: '2026-11-25T11:05:00' },
        { id: 'p3', url: 'https://example.test/p3.jpg', label: 'Não ligada' },
        { id: 'p4', url: 'https://example.test/absente.jpg', label: 'Apagada' },
      ]
      const debut = Date.now()
      const pdf = await generer('relatorio-fotos', rapport({ linkedPhotoIds: ['p2', 'p1', 'p4'] }), fotos)
      expect(Date.now() - debut, 'aucune attente du délai de 20 s').toBeLessThan(10000)
      // Recadrage au centre (object-fit: cover) : 1333 × 1000 px pris au milieu de l'image, sans agrandissement.
      expect(dessins).toHaveLength(2)
      for (const [, sx, sy, sl, sh, , , l, h] of dessins as number[][]) {
        expect(sx).toBeCloseTo(4000 / 3, 1)
        expect(sy).toBe(0)
        expect(sl / sh).toBeCloseTo(4 / 3, 5)
        expect(l / h).toBeCloseTo(4 / 3, 2)
      }
      const brut = pdf.octets.toString('latin1')
      // Deux photos placées (jsPDF ne garde qu'un objet pour deux images identiques : on compte les placements).
      expect(brut.match(/\/I\d+\s+Do\b/g)?.length).toBe(2)
      // Image découpée aux coins arrondis de son cadre (chemin de découpe W n).
      expect(brut).toMatch(/\bW\s+n\b/)
      const t = tout(pdf)
      expect(t).toContain('ANEXO FOTOGRÁFICO')
      expect(t).not.toMatch(/\d\. ANEXO/)
      expect(t).toMatch(/Foto 1 · 25\/11\/2026 11:05/)
      expect(t).toMatch(/Foto 2 · Pormenor da fissura · 25\/11\/2026 10:32/)
      expect(t).toMatch(/Foto 3 · Apagada/)
      expect(t).not.toContain('Não ligada')
      expect(t.match(/Fotografia indisponível/g)).toHaveLength(1)
      // L'anexo vient après la signature et avant le pied légal.
      expect(position(t, 'LOCAL E DATA')).toBeLessThan(position(t, 'ANEXO FOTOGRÁFICO'))
      expect(position(t, 'ANEXO FOTOGRÁFICO')).toBeLessThan(position(t, 'Este relatório baseia-se'))
      sansDebordement(pdf)
    } finally {
      canvas.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('un titre de section n’est jamais seul en bas de page (encadré, tableau, liste)', async () => {
    const recomendacoes = Array.from({ length: 6 }, (_, i) => `Recomendação n.º ${i + 1}: manter a vigilância das fissuras tratadas e repetir a inspeção visual.`).join('\n')
    const materiaux = ['Argamassa de reparação de alta resistência para fachadas expostas, com fibras, aplicada em camada fina sobre o suporte limpo e humedecido (4 sacos)', 'Tinta (30 L)']
    const estTitre = (s: string) => /^(?:\d+\.\S+|ANEXOFOTOGRÁFICO|PRODUTO|QUANTIDADE)$/.test(compact(s)) && s === s.toUpperCase()
    // Cas trouvés par balayage de n = 5 à 80 sur l'ancienne réserve (deux lignes sous le titre) : avec elle, le titre de
    // l'encadré restait seul pour n = 5 à 8 et 51 à 54, celui du tableau (première rangée de trois lignes) pour n = 61.
    const cas: Array<[number, string]> = [[6, recomendacoes], [7, recomendacoes], [52, recomendacoes], [53, recomendacoes], [61, ''], [62, '']]
    const echecs: string[] = []
    for (const [n, recommendations] of cas) {
      const travaux = Array.from({ length: n }, (_, i) => `Trabalho n.º ${i + 1} na fachada.`)
      const pdf = await generer(`relatorio-orfaos-${n}`, rapport({ travaux, materiaux, recommendations }))
      pdf.pages.forEach((page, i) => {
        const corps = page.filter((m) => m.y >= BANDE_PIED)
        const basse = Math.min(...corps.map((m) => m.y))
        const derniere = corps.filter((m) => m.y - basse <= 1).sort((a, b) => a.x - b.x).map((m) => lu(m.str)).join(' ')
        if (estTitre(derniere)) echecs.push(`n=${n} p${i + 1} ${derniere}`)
      })
      sansDebordement(pdf)
    }
    expect(echecs).toEqual([])
  })

  it('quantité trop longue : la colonne reste dans la page et le produit lisible', async () => {
    const pdf = await generer('relatorio-quantidade-longa', rapport({
      materiaux: ['Tinta (aplicada em 2 demãos na fachada norte e na fachada sul do edifício)', 'Argamassa (12 sacos de 25 kg cada)'],
    }))
    expect(tout(pdf)).toContain('Tinta (aplicada em 2 demãos')
    sansDebordement(pdf)
  })

  it('signature : la date d’émission vient du rapport, pas du jour du téléchargement', async () => {
    const pdf = await rendreRelatorioVitfix(jsPDF, rapport({ createdAt: '2026-11-26T10:00:00', interventionDate: '2026-11-25' }), [])
    const t = (await lirePdf(new Uint8Array(pdf.output('arraybuffer')))).map(ordreDeLecture).join(' ')
    expect(t).toContain('Marco de Canaveses, 26/11/2026')
  })

  it('Liberation Sans incorporée, propriétés du document', async () => {
    const pdf = await generer('relatorio-proprietes', rapport())
    const brut = pdf.octets.toString('latin1')
    expect(brut).toContain('LiberationSans')
    expect(brut).toContain('/Title (Relat')
    expect(fetchRessources).toHaveBeenCalledWith(URL_POLICE_GABARIT)
  })
})

describe('Générateur des rapports du module', () => {
  it('avec le modèle « vitfix-relatorio », le PDF est le gabarit, nommé d’après le numéro du rapport', async () => {
    await generateRapportPDF(rapport(), [], 'pt-PT', 'pro_societe', 'vitfix-relatorio')
    expect(sauvegardes.map((s) => s.nom)).toEqual(['RAP-2026-001.pdf'])
    const texte = (await lirePdf(new Uint8Array(sauvegardes[0].pdf.output('arraybuffer')))).map(ordreDeLecture).join(' ')
    expect(compact(texte)).toContain('RELATÓRIOTÉCNICO')
    expect(compact(texte)).not.toContain('RELATÓRIODEOBRA')
    expect(texte).toContain('1. OBJETO')
    expect(compact(texte)).toContain('EMITENTE')
  })

  it('sans modèle, le PDF du module ne change pas (pas de gabarit Vitfix)', async () => {
    await generateRapportPDF(rapport(), [], 'pt-PT', 'pro_societe')
    expect(sauvegardes.map((s) => s.nom)).toEqual(['RAP-2026-001.pdf'])
    const texte = (await lirePdf(new Uint8Array(sauvegardes[0].pdf.output('arraybuffer')))).map(ordreDeLecture).join(' ')
    expect(texte).toContain('Relatório de obra')
    expect(texte).toContain('PRESTADOR')
    expect(compact(texte)).not.toContain('EMITENTE')
    expect(fetchRessources).not.toHaveBeenCalled()
  })
})
