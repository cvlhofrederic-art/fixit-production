/**
 * Relatórios de obra de la société de la marque Vitfix (fiche VITFIX_SOCIETE_PROFIL_ID) au gabarit Vitfix
 * « Template Relatório Vitfix » v1 du 26/11/2026 (01_Template_Relatorio_Vitfix.html), redessiné avec jsPDF :
 * mesures du gabarit converties en points (1 px = 0,75 pt), mêmes couleurs, même ordre de blocs, textes en PT-PT,
 * pied de page de son bloc @page (émetteur · NIPC, numéro, « Página x / y »).
 *
 * Le gabarit s'adapte au module Rapports, pas l'inverse : il reçoit le rapport tel que le formulaire l'enregistre
 * (RapportPDFData) et n'ajoute aucun champ.
 *  - en-tête : marque « vitfix. », titre « Relatório Técnico » du gabarit (choix de Frédéric du 28/11/2026), sous-titre
 *    « motivo · local » (doc.projeto ; motivo seulement s'il tient sur une ligne courte), numéro du rapport dans le badge
 *    (RT-AAAA-NNN pour les rapports créés depuis, RAP-… pour les plus anciens, inchangés) ;
 *  - Emitente : nom, NIPC, morada, contacto, et l'assurance quand le rapport en a une ; Destinatário : nom, NIF,
 *    morada, contacto ; Local da intervenção : morada de l'obra, à défaut celle du client (comme le formulaire),
 *    tipologia, horário (début, fin, durée) ; NIF et tipologia, absents du module, restent en pointillés à remplir à
 *    la main (règle 2) ;
 *  - bande du gabarit : Data da visita (date de l'intervention), Data de emissão, orçamento ou fatura associé, Estado
 *    (à la place de « Seguradora · processo », que le module n'a pas) ;
 *  - sections numérotées : Objeto (motivo), Observações no local, Trabalhos realizados, Materiais e produtos
 *    (désignation et quantité lue dans « Nome (2 un.) »), Conclusões e recomendações (recomendações) ;
 *  - date d'émission (bande et signature) : création du rapport à l'heure de Lisbonne, jamais avant la visite ni dans
 *    le futur (dataEmissaoRelatorio) ; assinatura : localité du code postal de la société ; signataire en pointillés ;
 *  - Anexo fotográfico : photos liées au rapport, recadrées en 4:3 (object-fit: cover), légende = libellé et date ;
 *  - pied légal du gabarit, mot pour mot ;
 *  - tirets longs remplacés ligne par ligne (règle typographique), sans jamais fusionner deux lignes.
 * Ce que le module n'a pas n'apparaît pas : enquadramento, repères numérotés sur les photos, tableau des anomalies,
 * análise técnica et schémas, phases du método, controlo de qualidade, exclusões e reservas, seguradora · processo,
 * fonction du signataire ; son nom reste en pointillés, à remplir à la main.
 */

import type { PhotoForPDF, RapportPDFData } from '@/lib/rapport-pdf'
import {
  MiseEnPageGabarit,
  TOLERANCE,
  chargerImageJpeg,
  chargerOctetsPolice,
  creerAvertisseur,
  enregistrerPolice,
  ligneDeBase,
  somme,
  type Element,
  type Fragment,
  type Geometrie,
  type LigneComposee,
} from '@/lib/pdf/mise-en-page-gabarit'
import { datePt, insecables, textePdf } from '@/lib/pdf/modele-method-solucoes'
import { MARCA_VITFIX, nifLegivel } from '@/lib/pdf/modele-vitfix-orcamento'

type Pdf = import('jspdf').jsPDF
type ConstructeurPdf = typeof import('jspdf').jsPDF

/** Couleurs du gabarit (:root et règles du bloc <style>). */
const COR = {
  amarelo: '#f5d000',
  tinta: '#111111',
  texto: '#1c1c1c',
  mudo: '#6f6f6f',
  linha: '#e2e2e2',
  caixa: '#f5f5f2',
  nota: '#fffdf1',
  projeto: '#5a5a5a',
  fino: '#8a8a8a',
  pontilhado: '#9a9a9a',
} as const

// Géométrie : A4, @page { margin: 15mm 14mm 19mm }.
const MM = 72 / 25.4
const PAGE_L = 595.28
const PAGE_H = 841.89
const MARGE_HAUT = 15 * MM
const MARGE_COTE = 14 * MM
const MARGE_BAS = 19 * MM
const LARGEUR = PAGE_L - 2 * MARGE_COTE
const GEOMETRIE: Geometrie = { pageL: PAGE_L, pageH: PAGE_H, margeHaut: MARGE_HAUT, margeGauche: MARGE_COTE, largeur: LARGEUR, basPage: PAGE_H - MARGE_BAS }

/** Titre du document (.doc-type du gabarit). */
const TITULO_RELATORIO = 'Relatório Técnico'

/** line-height du corps (body { line-height: 1.45 }). */
const LH = 1.45
/** Corps du texte : 9,4 pt. */
const CORPO = 9.4
const H_CORPO = CORPO * LH
/** .sec { margin-top: 15px } */
const MARGE_SECCAO = 11.25
/** .ph { min-width: 110px } ; dans la bande, 70px ; signataire 140px. */
const PH = 82.5
const PH_META = 52.5
const PH_ASSINATURA = 105
/** .nota : padding 8px, plus la marge de 3px du premier et du dernier point de la liste. */
const PAD_NOTA = 6 + 2.25
/** table.t th, td : padding 5px 7px. */
const PAD_H_TABELA = 3.75
const PAD_L_TABELA = 5.25

const avertir = creerAvertisseur('Vitfix relatório', 'vitfix-relatorio')

// ─── Valeurs du module dans les mots du gabarit ───────────────────────────────

/** Estado du rapport (formulaire du module). */
const ESTADOS: Readonly<Record<string, string>> = {
  termine: 'Concluído',
  en_cours: 'Em curso',
  a_reprendre: 'A retomar',
  sous_garantie: 'Em garantia',
  brouillon: 'Rascunho',
}

export function estadoRelatorio(status: string | null | undefined): string {
  return status && Object.prototype.hasOwnProperty.call(ESTADOS, status) ? ESTADOS[status] : ''
}

const HHMM = /^(\d{1,2}):(\d{2})/

/** « 09:00 - 11:30 · 2h30 » (durée comme le module) ; une seule heure si l'autre manque. */
export function horarioRelatorio(inicio: string | null | undefined, fim: string | null | undefined): string {
  const i = HHMM.exec(textePdf(inicio).trim())
  const f = HHMM.exec(textePdf(fim).trim())
  const hora = (m: RegExpExecArray) => `${m[1].padStart(2, '0')}:${m[2]}`
  if (i && f) {
    const minutos = (Number(f[1]) * 60 + Number(f[2])) - (Number(i[1]) * 60 + Number(i[2]))
    const duracao = minutos > 0 ? ` · ${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}` : ''
    return `${hora(i)} - ${hora(f)}${duracao}`
  }
  if (i) return `Início ${hora(i)}`
  if (f) return `Fim ${hora(f)}`
  return ''
}

/** Libellé de la case du document lié selon son préfixe (ORC/DEV : orçamento ; FT/FA/FR/FACT : fatura). */
export function rotuloDocumentoAssociado(ref: string | null | undefined): string {
  const r = textePdf(ref).trim()
  if (!r || /^(?:ORC|DEV)\b/i.test(r)) return 'Orçamento associado'
  if (/^(?:FT|FA|FR|FACT)\b/i.test(r)) return 'Fatura associada'
  return 'Documento associado'
}

/** Localité d'une morada portugaise : ce qui suit le code postal (« 4630-204 Marco de Canaveses »). */
export function localidadeDaMorada(morada: string | null | undefined): string {
  const m = /\b\d{4}-\d{3} +([^,\d\s][^,]*)/.exec(textePdf(morada))
  return m ? m[1].trim() : ''
}

const FORMAS_JURIDICAS: ReadonlySet<string> = new Set(['unipessoal', 'lda', 'lda.', 'limitada', 'sa', 's.a', 's.a.'])

/** Nom sans forme juridique finale (« VITFIX CONSTRUÇÕES, LDA » → « VITFIX CONSTRUÇÕES ») : « Pela … » du gabarit. */
export function nomeCurtoEmpresa(nome: string | null | undefined): string {
  let t = textePdf(nome).trim()
  for (;;) {
    const i = Math.max(t.lastIndexOf(' '), t.lastIndexOf(','))
    // Jamais le nom entier : le premier mot reste, même s'il ressemble à une forme juridique.
    if (i <= 0 || !FORMAS_JURIDICAS.has(t.slice(i + 1).toLowerCase())) return t
    t = t.slice(0, i)
    while (t.endsWith(' ') || t.endsWith(',')) t = t.slice(0, -1)
  }
}

/** Assurance enregistrée par le module (« Nom n°123 ») dans les mots du gabarit (« Nom, apólice n.º 123 »). */
export function seguroDoRelatorio(seguro: string | null | undefined): string {
  let t = textePdf(seguro).trim()
  if (t.endsWith('n°')) t = t.slice(0, -2).trimEnd()
  const i = t.indexOf('n°')
  if (i > 0 && (t[i - 1] === ' ' || t[i - 1] === '\t')) return `${t.slice(0, i).trimEnd()}, apólice n.º ${t.slice(i + 2).trimStart()}`
  return t
}

/** Sous-titre du gabarit (doc.projeto, « objet · adresse ») : première ligne du motivo si elle est courte, et le local. */
export function projetoDoRelatorio(motivo: string | null | undefined, local: string): string {
  const primeira = linhasDoTexto(motivo)[0] ?? ''
  const curta = primeira.length <= 80 ? primeira.replace(/[.;:]+$/, '') : ''
  return [curta, local].filter(Boolean).join(' · ')
}

/** Lignes non vides d'un champ libre du module. */
export function linhasDoTexto(texto: string | null | undefined): string[] {
  return textePdf(texto).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
}

/** Points d'une liste saisie en texte libre, sans les puces ou numéros tapés à la main. */
export function itensDoTexto(texto: string | null | undefined): string[] {
  return linhasDoTexto(texto).map((l) => l.replace(/^(?:[-*•·]|\d+[.)])\s+/, '').trim()).filter(Boolean)
}

/** Quantité entre parenthèses : courte et commençant par un nombre (« 4 sacos », « 12 m² »). */
const QUANTIDADE_ENTRE_PARENTESES = /^\d[^()]{0,24}$/
/** Quantité après un séparateur : un nombre et une unité (« 30 L », « 25kg »). */
const QUANTIDADE_APOS_SEPARADOR = /^\d+(?:[.,]\d+)?\s*[^\s\d]\S*$/

function material(s: string): { produto: string; quantidade: string } {
  if (s.endsWith(')')) {
    const i = s.lastIndexOf('(')
    const produto = s.slice(0, Math.max(0, i)).trim()
    const dentro = s.slice(i + 1, -1).trim()
    if (i > 0 && produto && QUANTIDADE_ENTRE_PARENTESES.test(dentro)) return { produto, quantidade: dentro }
  }
  // « Tinta - 30 L » ; « Tinta – 30 L » arrive en « Tinta · 30 L » (tirets longs remplacés à l'entrée).
  for (const separador of [' - ', ' · ']) {
    const i = s.lastIndexOf(separador)
    const resto = i > 0 ? s.slice(i + separador.length).trim() : ''
    if (resto && QUANTIDADE_APOS_SEPARADOR.test(resto)) return { produto: s.slice(0, i).trim(), quantidade: resto }
  }
  return { produto: s, quantidade: '' }
}

/**
 * Matériaux du module (texte libre, « Torneira (1 un.), vedante (2 un.) ») en lignes Produto | Quantidade : une ligne
 * par matériau, quantité lue entre parenthèses finales ou après « - » ; une parenthèse qui ne commence pas par un
 * nombre, ou trop longue pour une quantité, reste au produit.
 */
export function materiaisDoRelatorio(materiais: readonly string[] | null | undefined): Array<{ produto: string; quantidade: string }> {
  return (materiais || [])
    .flatMap((m) => textePdf(m).split(/(?<=\))\s*[,;]\s+/))
    .map((s) => s.trim())
    .filter(Boolean)
    .map(material)
}

/** Date et heure de prise de vue (« 26/11/2026 14:32 »), à l'heure de l'appareil. */
export function dataHoraFoto(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const data = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  return `${data} ${hora}`
}

/** Tirets typographiques (U+2010 à U+2015) et signe moins (U+2212). */
const TRACOS = new RegExp(`[${String.fromCharCode(0x2010)}-${String.fromCharCode(0x2015)}${String.fromCharCode(0x2212)}]`, 'g')
const espacoNaLinha = (c: string | undefined) => c === ' ' || c === '\t'

/**
 * Règle typographique du gabarit : aucun tiret long ni demi-cadratin. Entouré d'espaces sur la même ligne, il devient
 * « · » ; sinon « - ». Un saut de ligne n'est jamais touché : « – Primeiro\n– Segundo » reste deux lignes.
 */
export function semTracosLongos(texto: string): string {
  return texto.replace(TRACOS, (_t: string, i: number, s: string) => (espacoNaLinha(s[i - 1]) && espacoNaLinha(s[i + 1]) ? '·' : '-'))
}

/** Rapport aux tirets remplacés, champ par champ (textes et listes ; identifiants des photos intacts). */
function limparRelatorio(r: RapportPDFData): RapportPDFData {
  const limpar = (v: unknown): unknown => {
    if (typeof v === 'string') return semTracosLongos(v)
    if (Array.isArray(v)) return v.map(limpar)
    return v
  }
  return Object.fromEntries(Object.entries(r).map(([cle, v]) => [cle, cle === 'linkedPhotoIds' ? v : limpar(v)])) as unknown as RapportPDFData
}

/** Photos liées au rapport, dans l'ordre où elles ont été liées ; une photo supprimée depuis est ignorée. */
export function fotosDoRelatorio(r: Pick<RapportPDFData, 'linkedPhotoIds'>, disponiveis: readonly PhotoForPDF[]): PhotoForPDF[] {
  const parId = new Map(disponiveis.map((p) => [p.id, p]))
  return [...new Set(r.linkedPhotoIds || [])].flatMap((id) => {
    const p = parId.get(id)
    return p ? [p] : []
  })
}

type Imagem = { donnees: string; largeur: number; hauteur: number } | null

interface Linha {
  rotulo: string
  valor: string
}

// ─── Document ─────────────────────────────────────────────────────────────────

class DocumentoRelatorio extends MiseEnPageGabarit {
  private numeroSeccao = 0

  constructor(
    pdf: Pdf,
    police: string,
    private readonly r: RapportPDFData,
    private readonly dataEmissao: string,
  ) {
    super(pdf, police, GEOMETRIE)
  }

  compor(fotos: PhotoForPDF[], imagens: Imagem[]) {
    this.cabecalho()
    this.partes()
    this.meta()
    this.seccoes()
    this.assinatura()
    if (fotos.length > 0) this.anexo(fotos, imagens)
    this.rodapeLegal()
  }

  /** Pied de page de chaque page (@bottom-left, @bottom-center, @bottom-right) et propriétés du PDF. */
  finalizar() {
    const total = this.pdf.getNumberOfPages()
    const base = PAGE_H - MARGE_BAS / 2 + 0.3465 * 6.9
    const nif = this.nif()
    const esquerda = [this.nome(), nif ? `NIPC ${nif}` : ''].filter(Boolean).join(' · ')
    for (let p = 1; p <= total; p++) {
      this.pdf.setPage(p)
      if (esquerda) this.ecrire(insecables(esquerda), MARGE_COTE, base, { taille: 6.9, couleur: COR.fino })
      if (this.numero()) this.ecrire(this.numero(), MARGE_COTE, base, { taille: 6.9, gras: true, couleur: COR.fino, align: 'centre', largeurZone: LARGEUR })
      this.ecrire(`Página ${p} / ${total}`, MARGE_COTE, base, { taille: 6.9, couleur: COR.fino, align: 'droite', largeurZone: LARGEUR })
    }
    this.pdf.setProperties({ title: `${TITULO_RELATORIO} ${this.numero()}`.trim(), author: this.nome(), subject: TITULO_RELATORIO })
  }

  // ── Identité ──

  private nome(): string {
    return textePdf(this.r.artisanName).trim()
  }

  private nif(): string {
    return nifLegivel(this.r.artisanSiret)
  }

  private numero(): string {
    return textePdf(this.r.rapportNumber).trim()
  }

  private moradaObra(): string {
    return textePdf(this.r.siteAddress).trim() || textePdf(this.r.clientAddress).trim()
  }

  // ── Dessin ──

  /** .ph : bordure basse pointillée de 1 px, posée sur la ligne de base. */
  private pontilhado(x: number, base: number, largeur: number) {
    this.pdf.setDrawColor(COR.pontilhado)
    this.pdf.setLineWidth(0.75)
    this.pdf.setLineDashPattern([0.75, 0.75], 0)
    this.pdf.line(x, base - 0.375, x + largeur, base - 0.375)
    this.pdf.setLineDashPattern([], 0)
  }

  /** Cadre de 0,75 pt couleur --line (.party). */
  private cadre(x: number, y: number, l: number, h: number, rayon: number) {
    this.pdf.setDrawColor(COR.linha)
    this.pdf.setLineWidth(0.75)
    this.pdf.roundedRect(x + 0.375, y + 0.375, l - 0.75, h - 0.75, rayon - 0.375, rayon - 0.375, 'S')
  }

  /** Lignes justifiées (text-align: justify) : la dernière ligne du paragraphe reste à gauche. */
  private ligneJustifiee(ligne: LigneComposee, x: number, haut: number, hl: number, taille: number, largeurZone: number, derniere: boolean) {
    const vides = ligne.bouts.filter((b) => b.espaceAvant).length
    if (derniere || vides === 0) {
      this.dessinerLignes([ligne], x, haut, hl, taille)
      return
    }
    const extra = (largeurZone - ligne.largeur) / vides
    const base = haut + ligneDeBase(hl, taille)
    let n = 0
    for (const b of ligne.bouts) {
      if (b.espaceAvant) n++
      this.fonte(taille, b.gras)
      this.pdf.setTextColor(b.couleur)
      this.pdf.text(b.texte, x + b.x + n * extra, base)
    }
  }

  /** Éléments d'un paragraphe justifié, une ligne par élément. */
  private linhasJustificadas(fragments: Fragment[], x: number, largeur: number, taille: number, hl: number, couleur: string): Element[] {
    const lignes = this.composer(fragments, largeur, taille, couleur)
    return lignes.map((ligne, i) => ({
      hauteur: hl,
      dessiner: (haut: number) => this.ligneJustifiee(ligne, x, haut, hl, taille, largeur, i === lignes.length - 1),
    }))
  }

  // ── En-tête centré ──

  private cabecalho() {
    // .wordmark : 22 pt gras, letter-spacing -0,35 pt, line-height 1,1, point final jaune.
    const tMarca = 22
    const espMarca = -0.35
    const hMarca = tMarca * 1.1
    const x = (PAGE_L - this.largeur(`${MARCA_VITFIX}.`, tMarca, true, espMarca)) / 2
    const baseMarca = this.y + ligneDeBase(hMarca, tMarca)
    this.ecrire(MARCA_VITFIX, x, baseMarca, { taille: tMarca, gras: true, couleur: COR.tinta, espacement: espMarca })
    const xPonto = x + this.largeur(MARCA_VITFIX, tMarca, true, espMarca) + espMarca
    this.ecrire('.', xPonto, baseMarca, { taille: tMarca, gras: true, couleur: COR.amarelo })
    this.y += hMarca

    // .yellow-rule : 54 × 3 px, margin 7px auto 9px.
    this.y += 5.25
    this.pdf.setFillColor(COR.amarelo)
    this.pdf.rect(PAGE_L / 2 - 20.25, this.y, 40.5, 2.25, 'F')
    this.y += 2.25 + 6.75

    // .doc-type : 17 pt gras en capitales, letter-spacing .18em, line-height 1,2.
    const tTipo = 17
    const espTipo = 0.18 * tTipo
    const hTipo = tTipo * 1.2
    for (const ligne of this.couperEspace(TITULO_RELATORIO.toUpperCase(), LARGEUR, tTipo, true, espTipo)) {
      // letter-spacing CSS : un espacement aussi après la dernière lettre, qui décale le centrage d'un demi-espacement.
      this.ecrire(ligne, MARGE_COTE - espTipo / 2, this.y + ligneDeBase(hTipo, tTipo), { taille: tTipo, gras: true, couleur: COR.tinta, espacement: espTipo, align: 'centre', largeurZone: LARGEUR })
      this.y += hTipo
    }

    // .project : 8,6 pt, largeur 420 pt au plus, centré, margin-top 5px.
    this.y += 3.75
    const hProjeto = 8.6 * LH
    const projeto = projetoDoRelatorio(this.r.motif, this.moradaObra())
    if (projeto) {
      const lignes = this.composer([{ texte: insecables(projeto) }], 420, 8.6, COR.projeto)
      this.dessinerLignes(lignes, PAGE_L / 2 - 210, this.y, hProjeto, 8.6, 'centre', 420)
      this.y += lignes.length * hProjeto
    } else {
      this.pontilhado(PAGE_L / 2 - PH / 2, this.y + ligneDeBase(hProjeto, 8.6), PH)
      this.y += hProjeto
    }

    // .badge : margin-top 8px, padding 3px 11px, 9,4 pt gras, letter-spacing .04em, fond jaune.
    this.y += 6
    const espBadge = 0.04 * CORPO
    const hBadge = 2.25 + H_CORPO + 2.25
    const numero = this.numero()
    const lTexto = numero ? this.largeur(numero, CORPO, true, espBadge) + espBadge : PH
    const lBadge = lTexto + 16.5
    const xBadge = PAGE_L / 2 - lBadge / 2
    this.pdf.setFillColor(COR.amarelo)
    this.pdf.roundedRect(xBadge, this.y, lBadge, hBadge, 2.25, 2.25, 'F')
    const baseBadge = this.y + 2.25 + ligneDeBase(H_CORPO, CORPO)
    if (numero) this.ecrire(numero, xBadge + 8.25, baseBadge, { taille: CORPO, gras: true, couleur: COR.tinta, espacement: espBadge })
    else this.pontilhado(xBadge + 8.25, baseBadge, PH)
    this.y += hBadge
    this.finBloc(10.5)
  }

  // ── Partes : Emitente | Destinatário, puis Local da intervenção ──

  private linhasEmitente(): Linha[] {
    const r = this.r
    const contacto = [textePdf(r.artisanPhone).trim(), textePdf(r.artisanEmail).trim()].filter(Boolean).join(' · ')
    const linhas: Linha[] = [
      { rotulo: 'Nome', valor: this.nome() },
      { rotulo: 'NIPC', valor: this.nif() },
      { rotulo: 'Morada', valor: textePdf(r.artisanAddress).trim() },
      { rotulo: 'Contacto', valor: contacto },
    ]
    const seguro = seguroDoRelatorio(r.artisanInsurance)
    if (seguro) linhas.push({ rotulo: 'Seguro', valor: seguro })
    return linhas
  }

  private linhasDestinatario(): Linha[] {
    const r = this.r
    const contacto = [textePdf(r.clientPhone).trim(), textePdf(r.clientEmail).trim()].filter(Boolean).join(' · ')
    // NIF : le module ne le demande pas ; la ligne reste en pointillés, à remplir à la main (règle 2 du gabarit).
    return [
      { rotulo: 'Nome', valor: textePdf(r.clientName).trim() },
      { rotulo: 'NIF', valor: '' },
      { rotulo: 'Morada', valor: textePdf(r.clientAddress).trim() },
      { rotulo: 'Contacto', valor: contacto },
    ]
  }

  /**
   * .party : cadre de 0,75 pt, rayon 6px, padding 7px 10px ; titre 7,4 pt gras en capitales ; lignes en grille
   * 58px | 1fr (écart 6px), libellé 8 pt gris, valeur 8,6 pt, line-height 1,5 ; valeur absente = pointillés.
   */
  private caixasPartes(caixas: Array<{ titulo: string; linhas: Linha[] }>, largeurBoite: number) {
    const interieur = 0.75 + 7.5
    const xValeur = 43.5 + 4.5
    const largeurValeur = largeurBoite - 2 * interieur - xValeur
    const hTitulo = 7.4 * LH
    const hLinha = 8.6 * 1.5
    const composees = caixas.map((c) => c.linhas.map((l) => (l.valor ? this.composer([{ texte: insecables(l.valor) }], largeurValeur, 8.6, COR.texto) : null)))
    const conteudo = Math.max(...composees.map((linhas) => hTitulo + 3 + somme(linhas.map((l) => Math.max(8 * 1.5, (l?.length ?? 1) * hLinha)))))
    const hauteur = 0.75 + 5.25 + conteudo + 5.25 + 0.75
    this.placer(0, hauteur)
    caixas.forEach((c, i) => {
      const x = MARGE_COTE + i * (largeurBoite + 6.75)
      this.cadre(x, this.y, largeurBoite, hauteur, 4.5)
      const xi = x + interieur
      let haut = this.y + 0.75 + 5.25
      this.ecrire(c.titulo.toUpperCase(), xi, haut + ligneDeBase(hTitulo, 7.4), { taille: 7.4, gras: true, couleur: COR.mudo, espacement: 0.12 * 7.4 })
      haut += hTitulo + 3
      c.linhas.forEach((l, j) => {
        this.ecrire(l.rotulo, xi, haut + ligneDeBase(8 * 1.5, 8), { taille: 8, couleur: COR.mudo })
        const valeur = composees[i][j]
        if (valeur) {
          this.dessinerLignes(valeur, xi + xValeur, haut, hLinha, 8.6)
          haut += Math.max(8 * 1.5, valeur.length * hLinha)
        } else {
          this.pontilhado(xi + xValeur, haut + ligneDeBase(hLinha, 8.6), PH)
          haut += hLinha
        }
      })
    })
    this.y += hauteur
  }

  private partes() {
    this.espacer(10.5)
    this.caixasPartes(
      [{ titulo: 'Emitente', linhas: this.linhasEmitente() }, { titulo: 'Destinatário', linhas: this.linhasDestinatario() }],
      (LARGEUR - 6.75) / 2,
    )
    this.y += 6.75
    // Tipologia : absente du module, en pointillés comme le NIF. Horário de l'intervention (début, fin, durée) : ici,
    // la bande gardant les cases du gabarit (Data da visita, Data de emissão).
    this.caixasPartes([{
      titulo: 'Local da intervenção',
      linhas: [
        { rotulo: 'Morada', valor: this.moradaObra() },
        { rotulo: 'Tipologia', valor: '' },
        { rotulo: 'Horário', valor: horarioRelatorio(this.r.startTime, this.r.endTime) },
      ],
    }], LARGEUR)
    this.finBloc(6.75)
  }

  // ── Banda meta : quatre cases sur fond --box ──

  private meta() {
    const r = this.r
    const ref = textePdf(r.refDevisFact).trim()
    const casas: Array<[string, string]> = [
      ['Data da visita', datePt(r.interventionDate)],
      ['Data de emissão', this.dataEmissao],
      [rotuloDocumentoAssociado(ref), ref],
      ['Estado', estadoRelatorio(r.status)],
    ]
    const largeurCase = LARGEUR / 4
    const hRotulo = 6.9 * LH
    const hValor = 9 * LH
    const valeurs = casas.map(([, v]) => (v ? this.composer([{ texte: insecables(v), gras: true }], largeurCase - 18, 9, COR.tinta) : null))
    const hauteur = 5.25 + hRotulo + 0.75 + Math.max(...valeurs.map((v) => v?.length ?? 1)) * hValor + 5.25
    this.placer(6.75, hauteur)
    this.pdf.setFillColor(COR.caixa)
    this.pdf.roundedRect(MARGE_COTE, this.y, LARGEUR, hauteur, 4.5, 4.5, 'F')
    casas.forEach(([rotulo], i) => {
      const x = MARGE_COTE + i * largeurCase + 9
      this.ecrire(rotulo.toUpperCase(), x, this.y + 5.25 + ligneDeBase(hRotulo, 6.9), { taille: 6.9, gras: true, couleur: COR.mudo, espacement: 0.69 })
      const haut = this.y + 5.25 + hRotulo + 0.75
      const v = valeurs[i]
      if (v) this.dessinerLignes(v, x, haut, hValor, 9)
      else this.pontilhado(x, haut + ligneDeBase(hValor, 9), PH_META)
    })
    this.y += hauteur
    this.finBloc(0)
  }

  // ── Secções ──

  /**
   * Sections dans l'ordre du gabarit. Chaque bloc est mesuré avant son titre : le titre part à la page suivante avec
   * ce qui doit le suivre (deux lignes d'un paragraphe ou d'une liste, l'en-tête et la première rangée du tableau,
   * l'encadré insécable entier).
   */
  private seccoes() {
    const r = this.r
    const objeto = linhasDoTexto(r.motif)
    if (objeto.length > 0) {
      this.titulo('Objeto', this.debut(this.linhasJustificadas([{ texte: insecables(objeto[0]) }], MARGE_COTE, LARGEUR, CORPO, H_CORPO, COR.texto)))
      for (const p of objeto) this.paragrafo(p)
    }
    const observacoes = linhasDoTexto(r.observations)
    if (observacoes.length > 0) {
      this.titulo('Observações no local', this.debut(this.linhasJustificadas([{ texte: insecables(observacoes[0]) }], MARGE_COTE, LARGEUR, CORPO, H_CORPO, COR.texto)))
      for (const p of observacoes) this.paragrafo(p)
    }
    const trabalhos = (r.travaux || []).map((t) => textePdf(t).trim()).filter(Boolean)
    if (trabalhos.length > 0) {
      const elements = this.elementosLista(trabalhos, MARGE_COTE, LARGEUR)
      this.titulo('Trabalhos realizados', this.debut(elements))
      this.placerBloc(elements, { margeHaut: 3.75, margeBas: 3.75, padHaut: 0, padBas: 0, insecable: false })
    }
    const materiais = materiaisDoRelatorio(r.materiaux)
    if (materiais.length > 0) {
      const tabela = this.prepararTabela(materiais)
      this.titulo('Materiais e produtos', tabela.hCab + tabela.rangees[0].hauteur)
      this.tabelaMateriais(tabela)
    }
    const conclusoes = itensDoTexto(r.recommendations)
    if (conclusoes.length > 0) {
      const elements = this.elementosLista(conclusoes, MARGE_COTE + 2.25 + 9, LARGEUR - 2.25 - 18)
      const total = PAD_NOTA + somme(elements.map((e) => e.hauteur)) + PAD_NOTA
      // Encadré insécable : réservé entier sous son titre, sauf s'il est plus haut qu'une page (il sera coupé).
      const utile = this.geo.basPage - this.geo.margeHaut
      this.titulo('Conclusões e recomendações', total <= utile - 40 ? total : PAD_NOTA + this.debut(elements))
      this.nota(elements)
    }
  }

  /** Hauteur des deux premières lignes d'un bloc (orphans: 2), ou de sa seule ligne. */
  private debut(elements: Element[]): number {
    return somme(elements.slice(0, 2).map((e) => e.hauteur))
  }

  /**
   * .sec h2 : 9,6 pt gras en capitales, letter-spacing .07em, filet jaune de 1,5 pt, numéro automatique sauf pour
   * l'anexo ; jamais seul en bas de page (break-after: avoid) : il garde avec lui `suite`, la hauteur de ce qui le suit
   * (la marge entre les deux est la sienne, 6px, qui absorbe celle du bloc suivant).
   */
  private titulo(texto: string, suite: number, numerado = true) {
    const taille = 9.6
    const hl = taille * LH
    const esp = 0.07 * taille
    const libelle = `${numerado ? `${++this.numeroSeccao}. ` : ''}${texto}`.toUpperCase()
    const lignes = this.couperEspace(libelle, LARGEUR, taille, true, esp)
    const hauteur = lignes.length * hl + 2.25 + 1.5
    this.placer(MARGE_SECCAO, hauteur + 4.5 + suite)
    lignes.forEach((l, i) => {
      this.ecrire(l, MARGE_COTE, this.y + i * hl + ligneDeBase(hl, taille), { taille, gras: true, couleur: COR.tinta, espacement: esp })
    })
    this.filet(MARGE_COTE, this.y + hauteur - 0.75, MARGE_COTE + LARGEUR, COR.amarelo, 1.5)
    this.y += hauteur
    this.finBloc(4.5)
  }

  /** .sec p : margin 5px 0, justifié. */
  private paragrafo(texto: string) {
    this.placerBloc(this.linhasJustificadas([{ texte: insecables(texto) }], MARGE_COTE, LARGEUR, CORPO, H_CORPO, COR.texto), {
      margeHaut: 3.75, margeBas: 3.75, padHaut: 0, padBas: 0, insecable: false,
    })
  }

  /** Éléments d'une liste .sec ul : retrait 14px, puce carrée jaune cerclée d'encre, 3px entre les points. */
  private elementosLista(itens: string[], x: number, largeur: number): Element[] {
    const xTexto = x + 10.5
    const largeurTexto = largeur - 10.5
    return itens.flatMap((item, n) => {
      const lignes = this.linhasJustificadas([{ texte: insecables(item) }], xTexto, largeurTexto, CORPO, H_CORPO, COR.texto)
      return lignes.map((ligne, i) => ({
        hauteur: ligne.hauteur + (i === lignes.length - 1 && n < itens.length - 1 ? 2.25 : 0),
        dessiner: (haut: number) => {
          if (i === 0) {
            // li::before : 5 × 5 px à left 2px, top .5em, fond jaune, bordure de 0,75 pt couleur encre.
            this.pdf.setFillColor(COR.amarelo)
            this.pdf.setDrawColor(COR.tinta)
            this.pdf.setLineWidth(0.75)
            this.pdf.rect(x + 1.5 + 0.375, haut + 0.5 * CORPO + 0.375, 3, 3, 'FD')
          }
          ligne.dessiner(haut)
        },
      }))
    })
  }

  /** .nota : fond --cond, bordure gauche jaune de 3px, rayon 6px, padding 8px 12px, insécable. */
  private nota(elements: Element[]) {
    this.placerBloc(elements, {
      margeHaut: 4.5, margeBas: 4.5, padHaut: PAD_NOTA, padBas: PAD_NOTA, insecable: true,
      fond: (haut, hauteur) => {
        this.pdf.setFillColor(COR.amarelo)
        this.pdf.roundedRect(MARGE_COTE, haut, LARGEUR, hauteur, 4.5, 4.5, 'F')
        this.pdf.setFillColor(COR.nota)
        this.pdf.roundedRect(MARGE_COTE + 2.25, haut, LARGEUR - 2.25, hauteur, 4.5, 4.5, 'F')
      },
    })
  }

  /**
   * table.t : en-tête jaune (7,4 pt gras en capitales, letter-spacing .09em, padding 5px 7px), cellules 8,4 pt,
   * filet bas --line. Colonne Quantidade à la largeur de son contenu, 30 % de la table au plus (le texte s'y coupe).
   */
  private prepararTabela(linhas: Array<{ produto: string; quantidade: string }>) {
    const tCel = 8.4
    const tCab = 7.4
    const espCab = 0.09 * tCab
    const hCab = PAD_H_TABELA + tCab * LH + PAD_H_TABELA
    const comQuantidade = linhas.some((l) => l.quantidade)
    const largeurQt = comQuantidade
      ? Math.min(
        0.3 * LARGEUR,
        Math.max(this.largeur('QUANTIDADE', tCab, true, espCab) + espCab, ...linhas.map((l) => this.largeur(insecables(l.quantidade), tCel))) + 2 * PAD_L_TABELA,
      )
      : 0
    const colonnes = [
      { titulo: 'Produto', x: MARGE_COTE, largeur: LARGEUR - largeurQt },
      ...(comQuantidade ? [{ titulo: 'Quantidade', x: MARGE_COTE + LARGEUR - largeurQt, largeur: largeurQt }] : []),
    ]
    const rangees = linhas.map((l) => {
      const cellules = [l.produto, l.quantidade].slice(0, colonnes.length).map((v, i) =>
        (v ? this.composer([{ texte: insecables(v) }], colonnes[i].largeur - 2 * PAD_L_TABELA, tCel, COR.texto) : []))
      return { cellules, hauteur: PAD_H_TABELA + Math.max(1, ...cellules.map((c) => c.length)) * tCel * LH + PAD_H_TABELA + 0.75 }
    })
    return { colonnes, rangees, hCab, tCel, tCab, espCab }
  }

  /** Une rangée ne se coupe pas (tr { break-inside: avoid }) ; l'en-tête se répète à chaque page. */
  private tabelaMateriais(t: ReturnType<DocumentoRelatorio['prepararTabela']>) {
    const { colonnes, rangees, hCab, tCel, tCab, espCab } = t
    const padH = PAD_H_TABELA
    const padL = PAD_L_TABELA
    const hCel = tCel * LH
    const cabecalho = () => {
      this.pdf.setFillColor(COR.amarelo)
      this.pdf.rect(MARGE_COTE, this.y, LARGEUR, hCab, 'F')
      for (const c of colonnes) {
        this.ecrire(c.titulo.toUpperCase(), c.x + padL, this.y + padH + ligneDeBase(tCab * LH, tCab), { taille: tCab, gras: true, couleur: COR.tinta, espacement: espCab })
      }
      this.y += hCab
    }
    this.placer(4.5, hCab + rangees[0].hauteur)
    cabecalho()
    for (const rg of rangees) {
      if (this.y + rg.hauteur > this.geo.basPage + TOLERANCE) {
        this.nouvellePage()
        cabecalho()
      }
      rg.cellules.forEach((lignes, i) => this.dessinerLignes(lignes, colonnes[i].x + padL, this.y + padH, hCel, tCel))
      this.filet(MARGE_COTE, this.y + rg.hauteur - 0.375, MARGE_COTE + LARGEUR, COR.linha, 0.75)
      this.y += rg.hauteur
    }
    this.finBloc(4.5)
  }

  // ── Assinatura ──

  /** .sign : deux colonnes (écart 26px), margin-top 20px, insécable ; ligne de signature de 36px. */
  private assinatura() {
    const ecart = 19.5
    const largeurCol = (LARGEUR - ecart) / 2
    const tRotulo = 7.4
    const hRotulo = tRotulo * LH
    const hNome = 8.6 * LH
    const curto = nomeCurtoEmpresa(this.r.artisanName) || MARCA_VITFIX.toUpperCase()
    const colunas = [`Local e data`, `Pela ${curto}`].map((t) => this.couperEspace(t.toUpperCase(), largeurCol, tRotulo, true, 0.12 * tRotulo))
    const hRotulos = Math.max(...colunas.map((c) => c.length)) * hRotulo
    const hauteur = hRotulos + 27 + 2.25 + hNome
    this.placer(15, hauteur)
    colunas.forEach((lignes, i) => {
      const x = MARGE_COTE + i * (largeurCol + ecart)
      lignes.forEach((l, j) => {
        this.ecrire(l, x, this.y + j * hRotulo + ligneDeBase(hRotulo, tRotulo), { taille: tRotulo, gras: true, couleur: COR.mudo, espacement: 0.12 * tRotulo })
      })
      const yTrait = this.y + hRotulos + 27
      this.filet(x, yTrait - 0.375, x + largeurCol, COR.tinta, 0.75)
      const base = yTrait + 2.25 + ligneDeBase(hNome, 8.6)
      if (i === 0) this.localEData(x, base)
      else this.pontilhado(x, base, PH_ASSINATURA)
    })
    this.y += hauteur
    this.finBloc(0)
  }

  /** « Marco de Canaveses, 26/11/2026 » : localité de la société et date d'émission ; pointillés pour ce qui manque. */
  private localEData(x: number, base: number) {
    const local = localidadeDaMorada(this.r.artisanAddress)
    let xx = x
    if (local) {
      this.ecrire(local, xx, base, { taille: 8.6, gras: true, couleur: COR.texto })
      xx += this.largeur(local, 8.6, true)
    } else {
      this.pontilhado(xx, base, PH)
      xx += PH
    }
    this.ecrire(`, ${this.dataEmissao}`, xx, base, { taille: 8.6, gras: true, couleur: COR.texto })
  }

  // ── Anexo fotográfico ──

  /** .grid2 : deux colonnes (écart 10px 12px), photo 4:3 au cadre --line de rayon 4px, légende 8,2 pt. */
  private anexo(fotos: PhotoForPDF[], imagens: Imagem[]) {
    const ecartCol = 9
    const ecartLigne = 7.5
    const largeurFoto = (LARGEUR - ecartCol) / 2
    const hauteurFoto = (largeurFoto * 3) / 4
    const tLegenda = 8.2
    const hLegenda = tLegenda * 1.35
    const legendas = fotos.map((p, i) => {
      const legenda = [textePdf(semTracosLongos(typeof p.label === 'string' ? p.label : '')).trim(), dataHoraFoto(p.taken_at)].filter(Boolean).join(' · ')
      const fragments: Fragment[] = [{ texte: `Foto ${i + 1}`, gras: true, couleur: COR.tinta }]
      if (legenda) fragments.push({ texte: ` · ${insecables(legenda)}` })
      return this.composer(fragments, largeurFoto, tLegenda, COR.texto)
    })
    const hRangee = (i: number) => hauteurFoto + 3 + Math.max(legendas[i].length, legendas[i + 1]?.length ?? 0) * hLegenda
    this.titulo('Anexo fotográfico', hRangee(0), false)
    for (let i = 0; i < fotos.length; i += 2) {
      const hauteur = hRangee(i)
      this.placer(i === 0 ? 4.5 : ecartLigne, hauteur)
      for (const c of [0, 1]) {
        if (i + c >= fotos.length) continue
        const x = MARGE_COTE + c * (largeurFoto + ecartCol)
        const imagem = imagens[i + c]
        if (imagem) {
          // .photo img { border-radius: 4px } : l'image est découpée aux coins arrondis de son cadre.
          this.pdf.saveGraphicsState()
          this.pdf.roundedRect(x, this.y, largeurFoto, hauteurFoto, 3, 3, null)
          this.pdf.clip()
          this.pdf.discardPath()
          this.pdf.addImage(imagem.donnees, 'JPEG', x, this.y, largeurFoto, hauteurFoto)
          this.pdf.restoreGraphicsState()
        } else {
          this.pdf.setFillColor(COR.caixa)
          this.pdf.roundedRect(x, this.y, largeurFoto, hauteurFoto, 3, 3, 'F')
          this.ecrire('Fotografia indisponível', x, this.y + hauteurFoto / 2, { taille: tLegenda, couleur: COR.mudo, align: 'centre', largeurZone: largeurFoto })
        }
        this.cadre(x, this.y, largeurFoto, hauteurFoto, 3)
        this.dessinerLignes(legendas[i + c], x, this.y + hauteurFoto + 3, hLegenda, tLegenda)
      }
      this.y += hauteur
    }
    this.finBloc(0)
  }

  // ── Rodapé legal ──

  /** .fine : margin-top 16px, filet haut --line, 6,9 pt gris justifié. */
  private rodapeLegal() {
    const contacto = textePdf(this.r.artisanEmail).trim() || textePdf(this.r.artisanPhone).trim()
    const pontos = { texte: '.'.repeat(24), couleur: COR.pontilhado }
    const fragments: Fragment[] = [
      { texte: 'Este relatório baseia-se na inspeção realizada na data da visita, nas condições de acesso e visibilidade então existentes, e destina-se exclusivamente ao destinatário identificado. Proteção de dados: os dados pessoais constantes deste documento são tratados por ' },
      this.nome() ? { texte: insecables(this.nome()) } : pontos,
      { texte: ' para efeitos de prestação do serviço e cumprimento de obrigações legais, nos termos do Regulamento (UE) 2016/679 (RGPD). Para exercer os seus direitos, contacte ' },
      contacto ? { texte: insecables(contacto) } : pontos,
      { texte: '.' },
    ]
    const elements = this.linhasJustificadas(fragments, MARGE_COTE, LARGEUR, 6.9, 6.9 * 1.4, COR.fino)
    this.placerBloc(elements, {
      margeHaut: 12, margeBas: 0, padHaut: 4.5 + 0.75, padBas: 0, insecable: true,
      fond: (haut) => this.filet(MARGE_COTE, haut + 0.375, MARGE_COTE + LARGEUR, COR.linha, 0.75),
    })
  }
}

// ─── Entrée ───────────────────────────────────────────────────────────────────

/** Jour (aaaa-mm-jj) d'un instant à l'heure de Lisbonne : le même quel que soit le fuseau de l'appareil. */
const JOUR_LISBONNE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' })
const jourLisbonne = (d: Date) => JOUR_LISBONNE.format(d)

/**
 * Date d'émission du relatório (« Data de emissão » et « Local e data »), en jj/mm/aaaa : le jour de création du
 * rapport, à l'heure de Lisbonne (le gabarit est portugais), jamais avant la visite (un rapport préparé à l'avance est
 * émis le jour de la visite) ni après le jour du téléchargement. Une fois la visite passée, elle ne change plus d'un
 * téléchargement à l'autre pour un même numéro. Sans date de création lisible, le jour du téléchargement.
 */
export function dataEmissaoRelatorio(criadoEm: string | null | undefined, dataVisita: string | null | undefined, hoje = new Date()): string {
  const aujourdhui = jourLisbonne(hoje)
  const criacao = criadoEm ? new Date(criadoEm) : null
  let jour = criacao && !Number.isNaN(criacao.getTime()) ? jourLisbonne(criacao) : aujourdhui
  const visita = /^\d{4}-\d{2}-\d{2}$/.test(dataVisita ?? '') ? (dataVisita as string) : ''
  // Comparaison de chaînes aaaa-mm-jj : max(création, min(visite, aujourd'hui)).
  const plancher = visita && visita < aujourdhui ? visita : aujourdhui
  if (visita && plancher > jour) jour = plancher
  if (jour > aujourdhui) jour = aujourdhui
  return datePt(jour)
}

/**
 * Dessine le relatório au gabarit Vitfix. `fotosDisponiveis` : photos de chantier connues de l'écran (le rapport n'en
 * garde que les identifiants). Tirets longs remplacés à l'entrée (règle typographique du gabarit).
 */
export async function rendreRelatorioVitfix(
  JsPdf: ConstructeurPdf,
  rapport: RapportPDFData,
  fotosDisponiveis: readonly PhotoForPDF[],
  o: { dataEmissao?: string } = {},
): Promise<Pdf> {
  const r = limparRelatorio(rapport)
  const fotos = fotosDoRelatorio(r, fotosDisponiveis)
  const [octets, imagens] = await Promise.all([
    chargerOctetsPolice(avertir),
    Promise.all(fotos.map((p) => (p.url ? chargerImageJpeg(p.url, avertir, 4 / 3) : Promise.resolve(null)))),
  ])
  const pdf = new JsPdf({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const documento = new DocumentoRelatorio(pdf, enregistrerPolice(pdf, octets, avertir), r, o.dataEmissao ?? dataEmissaoRelatorio(r.createdAt, r.interventionDate))
  documento.compor(fotos, imagens)
  documento.finalizar()
  return pdf
}
