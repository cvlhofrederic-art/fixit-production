/**
 * Orçamentos de la société de la marque Vitfix (fiche VITFIX_SOCIETE_PROFIL_ID) au gabarit Vitfix
 * « template_orcamento_vitfix.html » v1.1 du 22/11/2026 (feuille vitfix_pt.css), redessiné avec jsPDF :
 * mêmes mesures en points, mêmes couleurs, même ordre de blocs, mêmes libellés, textes client en PT-PT.
 *
 * Le gabarit s'adapte à Vitfix Pro, pas l'inverse : il reçoit les données du devis BTP (PdfV3Input) et
 * n'ajoute aucun champ au formulaire.
 *  - secções = sections du devis (une seule section non renommée : pas de ligne de section, comme les
 *    orçamentos émis) ; artigos A.1, A.2… = lignes (titre, description, étapes numérotées) ;
 *  - Data de emissão, Validade, Prazo de execução, Pagamento : échéancier des acomptes ramené à 100 % (« 50 / 30 /
 *    20 », reste en dernière prestação « na conclusão », plan coupé à 100 %) ; sans acompte, paiement du total
 *    selon le délai du devis ; IBAN et BIC des réglages, banque déduite du BIC, titulaire = la société (règle 16) ;
 *  - IVA : taux des lignes (une ligne par taux), autoliquidação ou isenção comme le devis ;
 *  - garantie de 5 anos quand un titre du devis, d'une section ou d'un artigo parle d'un telhado ou d'une
 *    cobertura (règle 13), sinon la garantie légale ;
 *  - mise en page de la page 1 comme la fonction ajustar du gabarit : espacements resserrés quand elle déborde de
 *    peu ; annexe à la suite quand la dernière page du devis, lue en vrai A4, reste à moitié vide ;
 *  - tirets longs remplacés à l'entrée, comme limparTudo (règle 4).
 * Ce que Vitfix Pro n'a pas n'apparaît pas : medição, modo de execução, âmbito, condições específicas,
 * révision, nom court de l'entreprise. Ce que le gabarit n'avait pas reçoit une place dans son style :
 * remises (sous l'artigo et dans les totaux), plusieurs taux d'IVA, notes et relatório joint (section
 * Notas), signature électronique (bloc Aceitação), livre resolução d'un particulier (section de l'annexe),
 * registo, capital et assurance (pied légal, art. 171.º du CSC).
 * Les factures restent au modèle BTP par défaut : le gabarit ne couvre que l'orçamento.
 */

import { computeAcomptesAmounts, round2, sumMoney } from '@/lib/money'
import type { PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import { COMPRESSION_PNG } from '@/lib/pdf/images-pdf'
import {
  ESP,
  MiseEnPageGabarit,
  TOLERANCE,
  chargerImageJpeg,
  chargerOctetsPolice,
  creerAvertisseur,
  enregistrerPolice,
  ligneDeBase,
  somme,
  type Alignement,
  type Avertir,
  type Element,
  type Fragment,
  type Geometrie,
  type OctetsPolice,
} from '@/lib/pdf/mise-en-page-gabarit'
import {
  chapitresDocument,
  datePt,
  descontoPagamento,
  eurosPt,
  insecables,
  jurosDeMora,
  localObraPt,
  modoPagamento,
  pourcentPt,
  prazoExecucao,
  prazoPagamento,
  quantitePt,
  regimeEffectif,
  registoEmpresa,
  textePdf,
  tituloPersonalizado,
  traduireLibellesGeneres,
  type Article,
} from '@/lib/pdf/modele-method-solucoes'

type Pdf = import('jspdf').jsPDF
type ConstructeurPdf = typeof import('jspdf').jsPDF

/** Wordmark du gabarit (règle 16 : marca « vitfix », suivie du point jaune). */
export const MARCA_VITFIX = 'vitfix'

/** Couleurs de vitfix_pt.css. */
const COR = {
  texte: '#1c1c1c',
  jaune: '#f5d000',
  gris: '#8a8a8a',
  gris5a: '#5a5a5a',
  gris6f: '#6f6f6f',
  gris4a: '#4a4a4a',
  gris3a: '#3a3a3a',
  pointilles: '#b5b5b5',
  bord: '#e2e2e2',
  fond: '#f5f5f2',
  filetTableau: '#ececec',
  sousTotal: '#fbfbf8',
  fondConditions: '#fffdf1',
  ligneSignature: '#cfcfcf',
  fondPhoto: '#fafaf8',
  blanc: '#ffffff',
} as const

// Géométrie en points : A4, @page { margin: 42.52pt 39.69pt 48pt 39.69pt }.
const PAGE_L = 595.28
const PAGE_H = 841.89
const MARGE_HAUT = 42.52
const MARGE_BAS = 48
const MARGE_GAUCHE = 39.69
const LARGEUR = PAGE_L - 2 * MARGE_GAUCHE
const GEOMETRIE: Geometrie = { pageL: PAGE_L, pageH: PAGE_H, margeHaut: MARGE_HAUT, margeGauche: MARGE_GAUCHE, largeur: LARGEUR, basPage: PAGE_H - MARGE_BAS }
/** Hauteur utile d'une page (ALTURA_UTIL_PT du gabarit). */
const ALTURA_UTIL = PAGE_H - MARGE_HAUT - MARGE_BAS
/** Page de mesure, très haute : la page 1 y est dessinée d'un seul tenant, comme le gabarit la mesure à l'écran. */
const HAUTEUR_MESURE = 14400
const GEOMETRIE_MESURE: Geometrie = { ...GEOMETRIE, pageH: HAUTEUR_MESURE, basPage: HAUTEUR_MESURE - MARGE_BAS }

/** line-height « normal » de Liberation Sans ((1854 + 434 + 67) / 2048). */
const NORMAL = 1.15

const pontos = (n: number) => '.'.repeat(n)
const PH_LONGO = pontos(58)
const PH_CURTO = pontos(30)
const PH_META = pontos(16)
const PH_VALOR = pontos(12)
const PH_NUM = pontos(14)
const PH_PROJETO = pontos(80)
const LINHAS_VAZIAS = 6
/** .foto-img { height: 170pt } */
const HAUTEUR_PHOTO = 170

/** Espacements de la page 1 ; `.compacto` les resserre quand elle déborde de peu. */
interface Espacements {
  filetHaut: number
  filetBas: number
  badgeHaut: number
  badgeBas: number
  partiesBas: number
  metaPad: number
  metaBas: number
  cellulePad: number
  /** tr.section td { padding: 4pt } ; .compacto table.items td, plus précis, la ramène à 3,6 pt. */
  seccaoPad: number
  totauxHaut: number
  totalLignePad: number
  conditionsHaut: number
  conditionsPad: number
  piedHaut: number
  piedPad: number
}

const ESPACEMENTS: Espacements = {
  filetHaut: 6, filetBas: 10, badgeHaut: 8, badgeBas: 12, partiesBas: 9, metaPad: 7, metaBas: 11, cellulePad: 4.6, seccaoPad: 4,
  totauxHaut: 9, totalLignePad: 3.5, conditionsHaut: 10, conditionsPad: 9, piedHaut: 8, piedPad: 8,
}
const ESPACEMENTS_COMPACTOS: Espacements = {
  filetHaut: 5, filetBas: 8, badgeHaut: 6, badgeBas: 9, partiesBas: 7, metaPad: 6, metaBas: 8, cellulePad: 3.6, seccaoPad: 3.6,
  totauxHaut: 6, totalLignePad: 2.5, conditionsHaut: 7, conditionsPad: 7, piedHaut: 6, piedPad: 6,
}

const avertir = creerAvertisseur('Vitfix', 'vitfix-orcamento')
/** Documents de mesure : un avertissement viendra du document réel, pas de doublon. */
const sansAvertir: Avertir = () => {
  // Rien à signaler ici : le document réel charge les mêmes ressources et les signale.
}

// ─── Valeurs de Vitfix Pro dans les mots du gabarit ───────────────────────────

const normaliser = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** Unités de l'écriture des orçamentos émis (m², un.) ; les autres comme le gabarit Method. */
const UNIDADES: Readonly<Record<string, string>> = { m2: 'm²', m3: 'm³', un: 'un.' }

const unidade = (u: string) => UNIDADES[u] ?? u

/** Quantité : entière sans décimales (« 60 »), sinon deux décimales et plus si la saisie en a plus. */
export function quantidadeVitfix(qt: number): string {
  return Number.isInteger(qt) ? String(qt) : quantitePt(qt)
}

const REGLES_MOMENTO: Array<[RegExp, (m: RegExpExecArray) => string]> = [
  [/^a la (signature|commande)\b|^na adjudicacao\b/, () => 'na adjudicação'],
  [/^(au )?demarrage\b|^au debut\b|^no inicio\b/, () => 'no início dos trabalhos'],
  [/^a mi-?chantier\b|^a mi-parcours\b|^a meio\b/, () => 'a meio da execução'],
  [/^a la (livraison|reception|fin)\b|^en fin de chantier\b|^na conclusao\b|^no final\b/, () => 'na conclusão'],
  [/^(\d+) jours?\b/, (m) => `a ${m[1]} dias`],
]

/** Déclencheur d'un acompte du formulaire (« À la signature »…) dans les mots du gabarit (« na adjudicação »…). */
export function momentoPrestacao(declencheur: string | null | undefined): string {
  const t = textePdf(declencheur).trim()
  const n = normaliser(t)
  for (const [motif, traduction] of REGLES_MOMENTO) {
    const m = motif.exec(n)
    if (m) return traduction(m)
  }
  return t
}

/** Banques connues par leur BIC (8 premiers caractères) ; Vitfix Pro n'enregistre pas le nom de la banque. */
const BANCOS: Readonly<Record<string, string>> = {
  TRWIBEB1: 'Wise Europe SA',
  BCOMPTPL: 'Millennium bcp',
  CGDIPTPL: 'Caixa Geral de Depósitos',
  BESCPTPL: 'Novo Banco',
  TOTAPTPL: 'Banco Santander Totta',
  BBPIPTPL: 'Banco BPI',
  CCCMPTPL: 'Crédito Agrícola',
  MPIOPTPL: 'Banco Montepio',
  ACTVPTPL: 'ActivoBank',
}

export function bancoDoBic(bic: string | null | undefined): string {
  const code = (bic || '').replace(/\s+/g, '').toUpperCase().slice(0, 8)
  return Object.prototype.hasOwnProperty.call(BANCOS, code) ? BANCOS[code] : ''
}

/** IBAN par groupes de 4 caractères, comme les orçamentos émis (« PT50 0000 0000 0000 0000 0000 0 »). */
export function ibanLegivel(iban: string | null | undefined): string {
  const s = textePdf(iban).replace(/\s+/g, '').toUpperCase()
  return s.replace(/(.{4})(?=.)/g, '$1 ')
}

/** NIF ou NIPC portugais par groupes de 3 chiffres (« 500 000 000 ») ; autre identifiant tel quel. */
export function nifLegivel(nif: string | null | undefined): string {
  const t = textePdf(nif).trim()
  const chiffres = t.replace(/\s+/g, '')
  return /^\d{9}$/.test(chiffres) ? chiffres.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : t
}

/** Chantier de telhado ou de cobertura (« telha » au singulier exclu : c'est presque toujours la couleur). */
const RE_TELHADO = /telhad|cobertur|\btelhas\b|cumeeir|beira[ld]/i
/** « Cobertura » qui n'est pas une toiture : pouvoir couvrant d'une peinture, protection des sols et des meubles. */
const RE_COBERTURA_NAO_TELHADO = /poder\s+de\s+cobertura|cobertura\s+(?:d[aeo]s?|com)\s+(?:prote[cç][aã]o|pl[aá]stico|pavimentos?|m[oó]veis|ch[aã]o)/gi

/**
 * Règle 13 (garantie de 5 anos) : un titre du devis, d'une section ou d'un artigo parle d'une toiture. Les
 * descriptifs et les étapes ne comptent pas (« tinta com elevado poder de cobertura » n'est pas une toiture).
 */
export function obraDeTelhado(titulos: string[]): boolean {
  return titulos.some((t) => RE_TELHADO.test(t.replace(RE_COBERTURA_NAO_TELHADO, ' ')))
}

/** Nom du fichier (règle 8) : « Orcamento_DEV-2026-001_Rua_do_Exemplo_10.pdf ». */
export function nomeFicheiroVitfix(e: Pick<PdfV3Input, 'docNumber' | 'interventionAddress'>): string {
  const slug = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[ºª]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const numero = textePdf(e.docNumber).trim().replace(/[^A-Za-z0-9-]+/g, '_')
  const local = slug(textePdf(e.interventionAddress).split(',').slice(0, 2).join(' '))
  return `${['Orcamento', numero, local].filter(Boolean).join('_')}.pdf`
}

// ─── Données du document ──────────────────────────────────────────────────────

interface Artigo extends Article {
  ref: string
}

interface Seccao {
  codigo: string
  titulo: string
  artigos: Artigo[]
  subtotal: number
}

interface Prestacao {
  pct: number
  momento: string
}

/** Secções A, B… ; une section unique non renommée n'a pas de ligne de titre (orçamentos émis). */
function seccoesDoDevis(e: PdfV3Input): Seccao[] {
  const chapitres = chapitresDocument(e)
  const unica = chapitres.length === 1
  return chapitres.map((ch, i) => {
    const codigo = String.fromCharCode(65 + i)
    return {
      codigo,
      titulo: unica && ch.titre === 'Trabalhos' ? '' : ch.titre,
      artigos: ch.articles.map((a, j) => ({ ...a, ref: `${codigo}.${j + 1}`, unite: unidade(a.unite) })),
      subtotal: ch.sousTotal,
    }
  })
}

/**
 * Échéancier qui fait toujours 100 % (le gabarit refuse un autre plan ; le formulaire accepte une autre somme avec un
 * simple avertissement) : acomptes du devis dans l'ordre, coupés à 100 % ; reste de moins de 1 % (33,33 × 3) ajouté à
 * la dernière prestação, reste plus grand en dernière prestação « na conclusão ». Sans acompte, liste vide : un seul
 * paiement du total selon le délai du devis.
 */
export function prestacoesVitfix(e: Pick<PdfV3Input, 'acomptesEnabled' | 'acomptes'>): Prestacao[] {
  const acomptes = (e.acomptesEnabled ? e.acomptes || [] : []).filter((a) => a && Number.isFinite(a.pourcentage) && a.pourcentage > 0)
  const prestacoes: Prestacao[] = []
  let cumul = 0
  for (const a of acomptes) {
    const pct = round2(Math.min(a.pourcentage, 100 - cumul))
    if (pct <= 0) break
    prestacoes.push({ pct, momento: momentoPrestacao(a.declencheur) })
    cumul = round2(cumul + pct)
  }
  const reste = round2(100 - cumul)
  const derniere = prestacoes[prestacoes.length - 1]
  if (derniere && reste > 0 && reste < 1) derniere.pct = round2(derniere.pct + reste)
  else if (derniere && reste > 0) prestacoes.push({ pct: reste, momento: 'na conclusão' })
  return prestacoes
}

// ─── Mise en page ─────────────────────────────────────────────────────────────

interface Colonne {
  titre: string
  largeur: number
  align: Alignement
  x: number
}

interface Colonnes {
  art: Colonne
  des: Colonne
  un: Colonne
  qt: Colonne
  pu: Colonne
  total: Colonne
}

interface Rangee {
  hauteur: number
  /** À garder sur la même page que la rangée suivante (titre de secção, dernier artigo et sous-total). */
  liee: boolean
  /** Artigo d'un groupe plus haut qu'une page : coupé sur place plutôt que renvoyé à la page suivante. */
  coupable?: boolean
  /** Hauteur de la rangée liée qui suit (sous-total), à garder avec les dernières lignes de l'artigo. */
  reserveApres?: number
  dessiner: () => void
}

/** Ligne d'un bloc à deux colonnes (Emitente, Destinatário) : texte composé ou pointillés à remplir. */
interface LigneBloc {
  rotulo: string
  valeur: string
  gras?: boolean
  pointilles?: string
}

/** Paragraphe d'une boîte du pied de page 1 ou de l'encadré jaune. */
type Paragraphe = Fragment[]

class DocumentVitfix extends MiseEnPageGabarit {
  private readonly esp: Espacements
  private readonly regime: 'classique' | 'franchise_293b' | 'autoliquidation_btp'
  private readonly avecIva: boolean
  private readonly seccoes: Seccao[]
  private readonly varias: boolean
  private readonly vazio: boolean
  /** Taux des artigos, distincts, du plus fort au plus faible */
  private readonly taux: number[]
  /** Échéancier des acomptes (100 % en tout) ; vide quand le devis n'a pas d'acompte. */
  private readonly prestacoes: Prestacao[]
  /** Pas d'acompte : un seul paiement du total selon le délai du devis. */
  private readonly semPlano: boolean
  private readonly garantia: string

  constructor(
    pdf: Pdf,
    police: string,
    private readonly e: PdfV3Input,
    geo: Geometrie,
    compacto: boolean,
    private readonly assinatura: string | null,
  ) {
    super(pdf, police, geo)
    this.esp = compacto ? ESPACEMENTS_COMPACTOS : ESPACEMENTS
    this.regime = regimeEffectif(e)
    this.avecIva = this.regime === 'classique' && e.tvaEnabled
    this.seccoes = seccoesDoDevis(e)
    this.varias = this.seccoes.length > 1
    this.vazio = this.seccoes.every((s) => s.artigos.length === 0)
    this.taux = [...new Set(this.seccoes.flatMap((s) => s.artigos.map((a) => a.taux)))].sort((a, b) => b - a)
    this.prestacoes = prestacoesVitfix(e)
    this.semPlano = this.prestacoes.length === 0
    this.garantia = obraDeTelhado(this.titulosObra()) ? '5 anos' : ''
  }

  /** Hauteur occupée depuis le haut de la première page (document de mesure d'une seule page). */
  hauteurUtilisee(): number {
    const pages = this.pdf.getNumberOfPages()
    return (pages - 1) * (this.geo.basPage - this.geo.margeHaut) + (this.y - this.geo.margeHaut)
  }

  /** Hauteur occupée sur la dernière page. */
  remplissageDernierePage(): number {
    return this.y - this.geo.margeHaut
  }

  /** Page 1 du gabarit (.folha-1). */
  folha1() {
    this.entete()
    this.partes()
    this.meta()
    this.tableau()
    this.totais()
    this.condicoes()
    this.pagamentoAceitacao()
  }

  /** Annexe (.folha-anexo) : à la suite (`continua`) ou sur une nouvelle page ; photos déjà chargées. */
  anexo(continua: boolean, fotos: Array<{ donnees: string; largeur: number; hauteur: number } | null>) {
    if (continua) {
      this.espacer(18)
    } else {
      this.nouvellePage()
      this.y += 18
    }
    const notas = this.notas()
    if (notas.length > 0) {
      this.tituloSeccao('Notas')
      this.lista(notas, 'puces')
    }
    if ((this.e.selectedPhotos || []).length > 0) {
      this.tituloSeccao('Registo fotográfico', HAUTEUR_PHOTO + 3 + 2 * 9.6)
      this.registoFotografico(fotos)
    }
    this.tituloSeccao('Condições gerais')
    this.lista(this.condicoesGerais(), 'numeros')
    if (this.e.isHorsEtablissement && this.e.clientType === 'particulier') {
      this.tituloSeccao('Direito de livre resolução')
      this.livreResolucao()
    }
    this.tituloSeccao('Proteção de dados')
    this.paragrapheSection(this.textoRgpd())
    this.rodape()
  }

  /** Pied de page de chaque page (@page @bottom-right) et propriétés du PDF. */
  finaliser() {
    const total = this.pdf.getNumberOfPages()
    const numero = this.numero()
    const base = PAGE_H - MARGE_BAS / 2 + 0.3465 * 6.9
    for (let p = 1; p <= total; p++) {
      this.pdf.setPage(p)
      const texte = `${numero ? `${numero} · ` : ''}Página ${p} de ${total}`
      this.ecrire(texte, MARGE_GAUCHE, base, { taille: 6.9, couleur: COR.gris, align: 'droite', largeurZone: LARGEUR })
    }
    this.pdf.setProperties({
      title: `Orçamento ${numero}`.trim(),
      author: this.nome(),
      subject: 'Orçamento',
    })
  }

  // ── Identité ──

  private nome(): string {
    return textePdf(this.e.companyName).trim()
  }

  private numero(): string {
    return textePdf(this.e.docNumber).trim()
  }

  private email(): string {
    return textePdf(this.e.companyEmail).trim()
  }

  /** Titres du devis, des sections et des artigos (règle 13). */
  private titulosObra(): string[] {
    return [tituloPersonalizado(this.e.docTitle), ...this.seccoes.flatMap((s) => [s.titulo, ...s.artigos.map((a) => a.titre)])]
  }

  /** Délai d'exécution en PT-PT (règle 10) : « dias corridos », brésilien, devient « dias de calendário ». */
  private prazo(): string {
    return prazoExecucao(this.e.executionDelay).replace(/\bdias corridos\b/g, 'dias de calendário').replace(/\bdia corrido\b/g, 'dia de calendário')
  }

  private validade(): string {
    const v = this.e.docValidity
    if (!v) return ''
    return `${v} ${v > 1 ? 'dias' : 'dia'}`
  }

  // ── Paiement ──

  private virement(): boolean {
    return modoPagamento(this.e.paymentMode).curto === 'Transferência bancária'
  }

  private iban(): string {
    return ibanLegivel(this.e.iban)
  }

  private bic(): string {
    return textePdf(this.e.bic).replace(/\s+/g, '').toUpperCase()
  }

  /** « <banque>, titular <société> » (jeton {{banco_ref}} du gabarit). */
  private bancoRef(): string {
    return [bancoDoBic(this.e.bic), this.nome() ? `titular ${this.nome()}` : ''].filter(Boolean).join(', ')
  }

  /** Remise de l'ancien champ libre `discount` (anciens documents), déduite du total comme le modèle par défaut. */
  private ancienneRemise(): number {
    const parse = Number.parseFloat(String(this.e.discount || '').replace(',', '.').replace(/[^\d.-]/g, ''))
    return Number.isFinite(parse) && parse > 0 ? parse : 0
  }

  private totalAPagar(): number {
    return round2((this.avecIva ? this.e.totalTTC : this.e.subtotalHT) - this.ancienneRemise())
  }

  /** Montants des prestações : même base et même arrondi que l'échéancier du devis (la dernière prend le reste). */
  private montantes(): number[] {
    return computeAcomptesAmounts(this.totalAPagar(), this.prestacoes.map((p) => ({ pourcentage: p.pct })))
  }

  /**
   * « 50 / 30 / 20 » ; « 100 % » pour une seule prestação (plano du gabarit) ; sans acompte, le délai de paiement du
   * devis (« A pronto », « 30 dias »).
   */
  private plano(): string {
    if (this.semPlano) return prazoPagamento(this.e.paymentDue).curto
    if (this.prestacoes.length === 1) return `${pourcentPt(this.prestacoes[0].pct)}${ESP}%`
    return this.prestacoes.map((p) => pourcentPt(p.pct)).join(' / ')
  }

  /** Total à payer, ou pointillés pour un document sans artigo. */
  private fragmentTotal(): Fragment {
    return this.vazio ? this.pointilles(PH_VALOR) : { texte: insecables(eurosPt(this.totalAPagar())) }
  }

  /** « 1 107,00 € · 664,20 € · 442,80 € » ; pointillés pour un document sans artigo. */
  private textoPrestacoes(): Fragment[] {
    if (this.vazio) return this.prestacoes.flatMap((_, i) => [...(i > 0 ? [{ texte: ' · ' }] : []), this.pointilles(PH_VALOR)])
    return [{ texte: insecables(this.montantes().map((m) => eurosPt(m)).join(' · ')) }]
  }

  private pointilles(texte: string): Fragment {
    return { texte, couleur: COR.pointilles }
  }

  /** Valeur ou pointillés (règle 7). */
  private ouPointilles(valeur: string, pointilles = PH_VALOR): Fragment {
    return valeur ? { texte: insecables(valeur) } : this.pointilles(pointilles)
  }

  // ── En-tête : marque, filet jaune, titre, projet, badge du numéro ──

  private entete() {
    const tMarque = 22
    const espacementMarque = -0.35
    const largeurMarque = this.largeur(`${MARCA_VITFIX}.`, tMarque, true, espacementMarque)
    const x = (PAGE_L - largeurMarque) / 2
    const baseMarque = this.y + ligneDeBase(tMarque, tMarque)
    this.ecrire(MARCA_VITFIX, x, baseMarque, { taille: tMarque, gras: true, couleur: COR.texte, espacement: espacementMarque })
    const xPoint = x + this.largeur(MARCA_VITFIX, tMarque, true, espacementMarque) + espacementMarque
    this.ecrire('.', xPoint, baseMarque, { taille: tMarque, gras: true, couleur: COR.jaune })
    this.y += tMarque

    this.y += this.esp.filetHaut
    this.pdf.setFillColor(COR.jaune)
    this.pdf.rect(PAGE_L / 2 - 20.25, this.y, 40.5, 3, 'F')
    this.y += 3 + this.esp.filetBas

    const hTitre = 17 * NORMAL
    for (const ligne of this.couperEspace('ORÇAMENTO', LARGEUR, 17, true, 3.03)) {
      // letter-spacing CSS : un espacement aussi après la dernière lettre, qui décale le centrage d'un demi-espacement.
      this.ecrire(ligne, MARGE_GAUCHE - 3.03 / 2, this.y + ligneDeBase(hTitre, 17), { taille: 17, gras: true, couleur: COR.texte, espacement: 3.03, align: 'centre', largeurZone: LARGEUR })
      this.y += hTitre
    }

    this.y += 6
    const projeto = tituloPersonalizado(this.e.docTitle)
    if (projeto) {
      const lignes = this.composer([{ texte: insecables(projeto) }], 420, 8.6, COR.gris5a)
      this.dessinerLignes(lignes, PAGE_L / 2 - 210, this.y, 11.5, 8.6, 'centre', 420)
      this.y += lignes.length * 11.5
    } else {
      this.ecrire(PH_PROJETO, MARGE_GAUCHE - 0.25, this.y + ligneDeBase(11.5, 8.6), { taille: 8.6, couleur: COR.pointilles, espacement: 0.5, align: 'centre', largeurZone: LARGEUR })
      this.y += 11.5
    }

    this.y += this.esp.badgeHaut
    const badge = `N.º ${this.numero() || PH_NUM}`
    const hBadge = 3 + 9.4 * NORMAL + 3
    const lBadge = this.largeur(badge, 9.4, true, 0.6) + 0.6 + 21
    this.pdf.setFillColor(COR.jaune)
    this.pdf.rect(PAGE_L / 2 - lBadge / 2, this.y, lBadge, hBadge, 'F')
    this.ecrire(badge, PAGE_L / 2 - lBadge / 2 + 10.5, this.y + 3 + ligneDeBase(9.4 * NORMAL, 9.4), { taille: 9.4, gras: true, couleur: COR.texte, espacement: 0.6 })
    this.y += hBadge
    this.finBloc(this.esp.badgeBas)
  }

  // ── Emitente | Destinatário ──

  private linhasEmitente(): LigneBloc[] {
    const e = this.e
    const contacto = [textePdf(e.companyPhone).trim(), this.email()].filter(Boolean).join(' · ')
    return [
      { rotulo: 'Empresa', valeur: this.nome(), gras: true, pointilles: PH_LONGO },
      { rotulo: 'NIPC', valeur: nifLegivel(e.companySiret), pointilles: PH_CURTO },
      { rotulo: 'Sede', valeur: textePdf(e.companyAddress).trim(), pointilles: PH_LONGO },
      { rotulo: 'Contacto', valeur: contacto, pointilles: PH_LONGO },
    ]
  }

  private linhasCliente(): LigneBloc[] {
    const e = this.e
    const contacto = [textePdf(e.clientPhone).trim(), textePdf(e.clientEmail).trim()].filter(Boolean).join(' · ')
    return [
      { rotulo: 'Cliente', valeur: textePdf(e.clientName).trim(), gras: true, pointilles: PH_LONGO },
      { rotulo: 'NIF', valeur: nifLegivel(e.clientSiret), pointilles: PH_CURTO },
      { rotulo: 'Morada', valeur: textePdf(e.clientAddress).trim(), pointilles: PH_LONGO },
      { rotulo: 'Local', valeur: localObraPt(e), pointilles: PH_LONGO },
      { rotulo: 'Contacto', valeur: contacto, pointilles: PH_CURTO },
    ]
  }

  private partes() {
    const ecart = 10
    const largeurBoite = (LARGEUR - ecart) / 2
    const xInterieur = 0.75 + 9.75
    const largeurValeur = largeurBoite - 2 * xInterieur - 46.5
    const hTitre = 7.4 * NORMAL
    const blocs = [
      { titre: 'Emitente', lignes: this.linhasEmitente() },
      { titre: 'Destinatário', lignes: this.linhasCliente() },
    ].map((b) => ({
      titre: b.titre,
      lignes: b.lignes.map((l) => ({
        ...l,
        composees: l.valeur ? this.composer([{ texte: insecables(l.valeur), gras: l.gras }], largeurValeur, 8.2, COR.texte) : null,
      })),
    }))
    const contenu = Math.max(...blocs.map((b) => hTitre + 4 + somme(b.lignes.map((l) => (l.composees?.length ?? 1) * 13.02))))
    const hauteur = 0.75 + 6.41 + contenu + 6.41 + 0.75
    this.placer(0, hauteur)
    blocs.forEach((b, i) => {
      const x = MARGE_GAUCHE + i * (largeurBoite + ecart)
      this.cadre(x, this.y, largeurBoite, hauteur, 6)
      const xi = x + xInterieur
      let haut = this.y + 0.75 + 6.41
      this.ecrire(b.titre.toUpperCase(), xi, haut + ligneDeBase(hTitre, 7.4), { taille: 7.4, gras: true, couleur: COR.gris, espacement: 1.1 })
      haut += hTitre + 4
      for (const l of b.lignes) {
        this.ecrire(l.rotulo, xi, haut + ligneDeBase(13.02, 8.2), { taille: 8.2, couleur: COR.gris })
        if (l.composees) {
          this.dessinerLignes(l.composees, xi + 46.5, haut, 13.02, 8.2)
          haut += l.composees.length * 13.02
        } else {
          this.ecrire(l.pointilles ?? PH_VALOR, xi + 46.5, haut + ligneDeBase(13.02, 8.2), { taille: 8.2, couleur: COR.pointilles, espacement: 0.5 })
          haut += 13.02
        }
      }
    })
    this.y += hauteur
    this.finBloc(this.esp.partiesBas)
  }

  /** Cadre gris clair de 0,75 pt aux coins arrondis (.party, .footer-box, photos). */
  private cadre(x: number, y: number, l: number, h: number, rayon: number) {
    this.pdf.setDrawColor(COR.bord)
    this.pdf.setLineWidth(0.75)
    this.pdf.roundedRect(x + 0.375, y + 0.375, l - 0.75, h - 0.75, rayon - 0.375, rayon - 0.375, 'S')
  }

  // ── Data de emissão / Validade / Prazo de execução / Pagamento ──

  private meta() {
    const e = this.e
    const prazo = this.prazo() || (e.prestationDate ? `Início em ${datePt(e.prestationDate)}` : '')
    const cases: Array<[string, string]> = [
      ['Data de emissão', datePt(e.docDate)],
      ['Validade', this.validade()],
      ['Prazo de execução', prazo],
      ['Pagamento', this.plano()],
    ]
    const ecart = 6
    const largeurCase = (LARGEUR - ecart * 3) / 4
    const pad = this.esp.metaPad
    const hLibelle = 6.8 * NORMAL
    const hValeur = 8.4 * NORMAL
    const valeurs = cases.map(([, v]) => (v ? this.composer([{ texte: insecables(v), gras: true }], largeurCase - 24, 8.4, COR.texte) : null))
    const hauteur = pad + hLibelle + 1.5 + Math.max(...valeurs.map((v) => v?.length ?? 1)) * hValeur + pad
    this.placer(0, hauteur)
    cases.forEach(([libelle], i) => {
      const x = MARGE_GAUCHE + i * (largeurCase + ecart)
      this.pdf.setFillColor(COR.fond)
      this.pdf.roundedRect(x, this.y, largeurCase, hauteur, 4, 4, 'F')
      this.ecrire(libelle.toUpperCase(), x + 12, this.y + pad + ligneDeBase(hLibelle, 6.8), { taille: 6.8, couleur: COR.gris, espacement: 0.9 })
      const haut = this.y + pad + hLibelle + 1.5
      const v = valeurs[i]
      if (v) this.dessinerLignes(v, x + 12, haut, hValeur, 8.4)
      else this.ecrire(PH_META, x + 12, haut + ligneDeBase(hValeur, 8.4), { taille: 8.4, gras: true, couleur: COR.pointilles, espacement: 0.5 })
    })
    this.y += hauteur
    this.finBloc(this.esp.metaBas)
  }

  // ── Tableau Art. | Designação | Un. | Qt. | P. unit. | Total ──

  private colonnes(): Colonnes {
    let x = MARGE_GAUCHE
    const colonne = (titre: string, largeur: number, align: Alignement): Colonne => {
      const c = { titre, largeur, align, x }
      x += largeur
      return c
    }
    const art = colonne('Art.', 26, 'centre')
    const des = colonne('Designação', LARGEUR - (26 + 36 + 30 + 60 + 64), 'gauche')
    const un = colonne('Un.', 36, 'centre')
    const qt = colonne('Qt.', 30, 'centre')
    const pu = colonne('P. unit.', 60, 'droite')
    const total = colonne('Total', 64, 'droite')
    return { art, des, un, qt, pu, total }
  }

  private hauteurEntete(): number {
    return 5.5 + 7.6 * NORMAL + 5.5
  }

  private enteteTableau(cols: Colonnes) {
    const h = this.hauteurEntete()
    this.pdf.setFillColor(COR.jaune)
    this.pdf.rect(MARGE_GAUCHE, this.y, LARGEUR, h, 'F')
    const base = this.y + 5.5 + ligneDeBase(7.6 * NORMAL, 7.6)
    for (const c of [cols.art, cols.des, cols.un, cols.qt, cols.pu, cols.total]) {
      this.ecrire(c.titre.toUpperCase(), c.x + 6, base, { taille: 7.6, gras: true, couleur: COR.texte, espacement: 0.72, align: c.align, largeurZone: c.largeur - 12 })
    }
    this.y += h
  }

  private sautTableau(cols: Colonnes) {
    this.nouvellePage()
    this.enteteTableau(cols)
  }

  /** Valeur d'une colonne, réduite si elle ne tient pas (le tableau HTML élargissait la colonne). */
  private cellule(texte: string, c: Colonne, base: number, o: { taille?: number; gras?: boolean; couleur?: string } = {}) {
    if (!texte) return
    let taille = o.taille ?? 8.5
    while (taille > 6 && this.largeur(texte, taille, o.gras) > c.largeur - 12) taille -= 0.2
    this.ecrire(texte, c.x + 6, base, { taille, gras: o.gras, couleur: o.couleur ?? COR.texte, align: c.align, largeurZone: c.largeur - 12 })
  }

  private rangeeSeccao(s: Seccao, cols: Colonnes): Rangee {
    const hLigne = 8.4 * NORMAL
    const pad = this.esp.seccaoPad
    const lignes = this.couperEspace(`${s.codigo} · ${s.titulo}`.toUpperCase(), LARGEUR - 12, 8.4, true, 1.05)
    const hauteur = pad + lignes.length * hLigne + pad + 0.5
    return {
      hauteur,
      liee: true,
      dessiner: () => {
        if (this.y + hauteur > this.geo.basPage + TOLERANCE) this.sautTableau(cols)
        this.pdf.setFillColor(COR.fond)
        this.pdf.rect(MARGE_GAUCHE, this.y, LARGEUR, hauteur - 0.5, 'F')
        lignes.forEach((l, i) => {
          this.ecrire(l, MARGE_GAUCHE + 6, this.y + pad + i * hLigne + ligneDeBase(hLigne, 8.4), { taille: 8.4, gras: true, couleur: COR.texte, espacement: 1.05 })
        })
        this.y += hauteur
        this.filet(MARGE_GAUCHE, this.y - 0.25, MARGE_GAUCHE + LARGEUR, COR.filetTableau, 0.5)
      },
    }
  }

  /** Lignes d'un artigo (titre, descriptif, étapes numérotées, remise, taux), chacune dessinable seule. */
  private elementsArtigo(a: Artigo, cols: Colonnes): Element[] {
    const x = cols.des.x + 6
    const largeur = cols.des.largeur - 12
    const elements: Element[] = []
    for (const ligne of this.composer([{ texte: insecables(a.titre), gras: true }], largeur, 8.5, COR.texte)) {
      elements.push({ hauteur: 11.43, dessiner: (haut) => this.dessinerLignes([ligne], x, haut, 11.43, 8.5) })
    }
    if (a.bloc) {
      this.composer([{ texte: insecables(a.bloc) }], largeur, 8, COR.gris6f).forEach((ligne, i) => {
        const marge = i === 0 ? 1.5 : 0
        elements.push({ hauteur: 10.5 + marge, dessiner: (haut) => this.dessinerLignes([ligne], x, haut + marge, 10.5, 8) })
      })
    }
    const xEtape = x + 11
    const espace = this.largeur(' ', 7.7)
    a.etapes.forEach((etape, n) => {
      this.composer([{ texte: insecables(etape) }], largeur - 11, 7.7, COR.gris4a).forEach((ligne, i) => {
        const marge = n === 0 && i === 0 ? 3 : 0
        elements.push({
          hauteur: 9.3 + marge,
          dessiner: (haut) => {
            if (i === 0) this.ecrire(`${n + 1}.`, xEtape - espace, haut + marge + ligneDeBase(9.3, 7.7), { taille: 7.7, couleur: COR.gris4a, align: 'droite', largeurZone: 0 })
            this.dessinerLignes([ligne], xEtape, haut + marge, 9.3, 7.7)
          },
        })
      })
    })
    // Ce que Vitfix Pro ajoute à l'artigo, dans le style de la ligne « Medição » du gabarit.
    const complements: Fragment[][] = []
    if (a.remise) {
      const remise = a.remise.includes('%') ? a.remise : `${a.remise}${ESP}€`
      complements.push([{ texte: 'Desconto:', gras: true, couleur: COR.gris5a }, { texte: ` ${insecables(remise)}` }])
    }
    if (this.avecIva && this.taux.length > 1) complements.push([{ texte: 'IVA:', gras: true, couleur: COR.gris5a }, { texte: ` ${pourcentPt(a.taux)}${ESP}%` }])
    complements.forEach((fragments, n) => {
      this.composer(fragments, largeur, 7.4, COR.gris).forEach((ligne, i) => {
        const marge = n === 0 && i === 0 ? 2 : 0
        elements.push({ hauteur: 9.4 + marge, dessiner: (haut) => this.dessinerLignes([ligne], x, haut + marge, 9.4, 7.4) })
      })
    })
    return elements
  }

  private chiffresArtigo(a: Artigo, cols: Colonnes, haut: number) {
    const pad = this.esp.cellulePad
    const base = haut + pad + ligneDeBase(8.5 * NORMAL, 8.5)
    this.cellule(a.ref, cols.art, base)
    this.cellule(a.unite, cols.un, haut + pad + ligneDeBase(7.9 * NORMAL, 7.9), { taille: 7.9, couleur: COR.gris6f })
    this.cellule(quantidadeVitfix(a.qt), cols.qt, base)
    this.cellule(eurosPt(a.pu), cols.pu, base)
    this.cellule(eurosPt(a.total), cols.total, base)
  }

  private rangeeArtigo(a: Artigo, cols: Colonnes, liee: boolean): Rangee {
    const pad = this.esp.cellulePad
    const elements = this.elementsArtigo(a, cols)
    const hauteur = pad + somme(elements.map((el) => el.hauteur)) + pad + 0.5
    const rangee: Rangee = {
      hauteur,
      liee,
      dessiner: () => {
        const capacite = this.geo.basPage - this.geo.margeHaut - this.hauteurEntete()
        // Coupé sur place, l'artigo garde aussi la place de son sous-total sur la page de ses dernières lignes.
        const reserve = rangee.coupable ? (rangee.reserveApres ?? 0) : 0
        if (this.y + hauteur + reserve > this.geo.basPage + TOLERANCE) {
          if (hauteur > capacite || rangee.coupable) {
            this.artigoCortado(a, elements, cols, rangee.reserveApres ?? 0)
            return
          }
          this.sautTableau(cols)
        }
        this.chiffresArtigo(a, cols, this.y)
        let haut = this.y + pad
        for (const el of elements) {
          el.dessiner(haut)
          haut += el.hauteur
        }
        this.y += hauteur
        this.filet(MARGE_GAUCHE, this.y - 0.25, MARGE_GAUCHE + LARGEUR, COR.filetTableau, 0.5)
      },
    }
    return rangee
  }

  /**
   * Artigo coupé entre deux lignes (plus haut qu'une page, ou dans un groupe qui en dépasse une), chiffres sur sa
   * première partie : au moins deux lignes avant la coupure, et la rangée liée qui suit (sous-total) garde sa place
   * sous les dernières lignes.
   */
  private artigoCortado(a: Artigo, elements: Element[], cols: Colonnes, reserveApres: number) {
    const pad = this.esp.cellulePad
    const tiennent = (depuis: number) => {
      let n = 0
      let bas = this.y + pad
      while (depuis + n < elements.length && bas + elements[depuis + n].hauteur + pad <= this.geo.basPage + TOLERANCE) {
        bas += elements[depuis + n].hauteur
        n++
      }
      return n
    }
    if (tiennent(0) < Math.min(2, elements.length)) this.sautTableau(cols)
    this.chiffresArtigo(a, cols, this.y)
    let i = 0
    while (i < elements.length) {
      let n = Math.max(1, tiennent(i))
      if (elements.length - i - n === 1 && n > 2) n -= 1
      const bas = this.y + pad + somme(elements.slice(i, i + n).map((el) => el.hauteur)) + pad + 0.5
      // Dernières lignes : si le sous-total n'a plus la place, une ou deux lignes descendent avec lui.
      if (i + n === elements.length && bas + reserveApres > this.geo.basPage + TOLERANCE && n > 2) n -= Math.min(2, n - 2)
      let haut = this.y + pad
      for (const el of elements.slice(i, i + n)) {
        el.dessiner(haut)
        haut += el.hauteur
      }
      i += n
      if (i < elements.length) this.sautTableau(cols)
      else this.y = haut + pad + 0.5
    }
    this.filet(MARGE_GAUCHE, this.y - 0.25, MARGE_GAUCHE + LARGEUR, COR.filetTableau, 0.5)
  }

  private rangeeSubtotal(s: Seccao, cols: Colonnes): Rangee {
    const pad = this.esp.cellulePad
    const hauteur = pad + 8.2 * NORMAL + pad + 0.5
    return {
      hauteur,
      liee: false,
      dessiner: () => {
        if (this.y + hauteur > this.geo.basPage + TOLERANCE) this.sautTableau(cols)
        this.pdf.setFillColor(COR.sousTotal)
        this.pdf.rect(MARGE_GAUCHE, this.y, LARGEUR, hauteur - 0.5, 'F')
        const base = this.y + pad + ligneDeBase(8.2 * NORMAL, 8.2)
        const largeurLibelle = cols.pu.x + cols.pu.largeur - cols.art.x - 12
        this.ecrire(`Subtotal ${s.codigo}`, cols.art.x + 6, base, { taille: 8.2, gras: true, couleur: COR.texte, espacement: 0.6, align: 'droite', largeurZone: largeurLibelle })
        this.cellule(eurosPt(s.subtotal), cols.total, base, { taille: 8.2, gras: true })
        this.y += hauteur
        this.filet(MARGE_GAUCHE, this.y - 0.25, MARGE_GAUCHE + LARGEUR, COR.filetTableau, 0.5)
      },
    }
  }

  private rangeeVazia(): Rangee {
    const hauteur = 21 + 0.5
    return {
      hauteur,
      liee: false,
      dessiner: () => {
        this.y += hauteur
        this.filet(MARGE_GAUCHE, this.y - 0.25, MARGE_GAUCHE + LARGEUR, COR.filetTableau, 0.5)
      },
    }
  }

  private tableau() {
    const cols = this.colonnes()
    const rangees: Rangee[] = []
    for (const s of this.seccoes) {
      if (s.titulo) rangees.push(this.rangeeSeccao(s, cols))
      s.artigos.forEach((a, i) => rangees.push(this.rangeeArtigo(a, cols, this.varias && i === s.artigos.length - 1)))
      if (this.varias && s.artigos.length > 0) rangees.push(this.rangeeSubtotal(s, cols))
    }
    if (this.vazio) for (let i = 0; i < LINHAS_VAZIAS; i++) rangees.push(this.rangeeVazia())
    // Groupes insécables : titre de secção + premier artigo (break-after: avoid), dernier artigo + sous-total.
    const groupes: Rangee[][] = []
    let groupe: Rangee[] = []
    for (const r of rangees) {
      groupe.push(r)
      if (!r.liee) {
        groupes.push(groupe)
        groupe = []
      }
    }
    if (groupe.length > 0) groupes.push(groupe)
    const capacite = this.geo.basPage - this.geo.margeHaut - this.hauteurEntete()
    // Groupe plus haut qu'une page : ses artigos sont coupés sur place, le titre de secção reste avec leurs premières
    // lignes et le sous-total avec leurs dernières.
    for (const g of groupes) {
      if (somme(g.map((r) => r.hauteur)) > capacite) for (const r of g) r.coupable = true
    }
    rangees.forEach((r, i) => {
      if (r.liee && rangees[i + 1]) r.reserveApres = rangees[i + 1].hauteur
    })
    // Ce qui doit tenir sur la page pour commencer un groupe : le groupe entier ; plus haut qu'une page, son premier
    // élément (titre de secção) et les trois premières lignes de l'artigo.
    const debutCoupe = this.esp.cellulePad + 3 * 11.43
    const debut = (g: Rangee[]) => {
      const h = somme(g.map((r) => r.hauteur))
      if (h <= capacite) return h
      const premiere = g[0]?.hauteur ?? 0
      return premiere <= capacite ? premiere + debutCoupe : debutCoupe
    }
    this.placer(0, this.hauteurEntete() + debut(groupes[0] ?? []))
    this.enteteTableau(cols)
    for (const g of groupes) {
      if (this.y + debut(g) > this.geo.basPage + TOLERANCE) this.sautTableau(cols)
      for (const r of g) r.dessiner()
    }
    this.finBloc(0)
  }

  // ── Totaux ──

  private ventilacao(): Array<{ rate: number; base: number; amount: number }> {
    const fournie = this.e.tvaBreakdown && this.e.tvaBreakdown.length > 0 ? this.e.tvaBreakdown : null
    if (fournie) return fournie.filter((t) => t.rate !== 0)
    return this.taux.filter((t) => t !== 0).map((rate) => {
      const base = sumMoney(this.seccoes.flatMap((s) => s.artigos.filter((a) => a.taux === rate).map((a) => a.total)))
      return { rate, base, amount: round2((base * rate) / 100) }
    })
  }

  private linhasTotais(): Array<[string, string]> {
    const e = this.e
    const linhas: Array<[string, string]> = []
    const remise = e.remiseGlobale && e.remiseGlobale.montantHT !== 0 ? e.remiseGlobale : null
    if (remise) {
      const libelle = textePdf(remise.libelle).replace(/^remise commerciale/i, 'Desconto comercial') || 'Desconto comercial'
      linhas.push(['Total dos trabalhos', eurosPt(e.totalHTBrut ?? e.subtotalHT)], [libelle, eurosPt(-remise.montantHT)])
    }
    linhas.push(['Total sem IVA', eurosPt(e.subtotalHT)])
    if (this.regime === 'autoliquidation_btp') {
      linhas.push(['IVA', 'Autoliquidação'])
    } else if (this.regime === 'franchise_293b') {
      linhas.push(['IVA', 'Isento'])
    } else if (this.avecIva) {
      const ventilacao = this.ventilacao()
      if (ventilacao.length === 0) linhas.push([`IVA ${pourcentPt(this.taux[0] ?? 23)} %`, eurosPt(0)])
      // La base de chaque taux est écrite dès qu'elle n'est pas le total sans IVA (plusieurs taux, lignes à 0 %).
      const avecBase = ventilacao.length > 1 || ventilacao.some((t) => Math.abs(t.base - e.subtotalHT) > 0.005)
      for (const t of ventilacao) {
        linhas.push([`IVA ${pourcentPt(t.rate)} %${avecBase ? ` s/ ${eurosPt(t.base)}` : ''}`, eurosPt(t.amount)])
      }
    }
    if (this.ancienneRemise() > 0) {
      const discount = textePdf(this.e.discount).trim()
      linhas.push(['Desconto', `-${/€|eur|%/i.test(discount) ? discount : `${discount}${ESP}€`}`])
    }
    return linhas
  }

  private noteIva(): string {
    if (this.regime === 'autoliquidation_btp') return 'IVA - autoliquidação (art. 2.º, n.º 1, al. j) do CIVA)'
    if (this.regime === 'franchise_293b') return 'Isento de IVA ao abrigo do art. 53.º do CIVA'
    return ''
  }

  private totais() {
    const linhas = this.linhasTotais()
    const largeurBoite = 202.5
    const x = MARGE_GAUCHE + LARGEUR - largeurBoite
    const pad = this.esp.totalLignePad
    const hLigne = pad + 8.6 * NORMAL + pad
    const hTotal = 7 + 13 * NORMAL + 7
    const note = this.noteIva()
    const lignesNote = note ? this.composer([{ texte: insecables(note) }], largeurBoite - 18, 7, COR.gris) : []
    const hauteur = linhas.length * hLigne + 4 + hTotal + (lignesNote.length > 0 ? 3 + lignesNote.length * 9.4 : 0)
    this.placer(this.esp.totauxHaut, hauteur)
    linhas.forEach(([libelle, valeur], i) => {
      const base = this.y + i * hLigne + pad + ligneDeBase(8.6 * NORMAL, 8.6)
      this.ecrire(libelle, x + 9, base, { taille: 8.6, couleur: COR.gris5a })
      if (this.vazio && /\d/.test(valeur)) {
        this.ecrire(PH_VALOR, x + 9, base, { taille: 8.6, couleur: COR.pointilles, espacement: 0.5, align: 'droite', largeurZone: largeurBoite - 18 })
      } else {
        this.ecrire(insecables(valeur), x + 9, base, { taille: 8.6, couleur: COR.texte, align: 'droite', largeurZone: largeurBoite - 18 })
      }
    })
    const haut = this.y + linhas.length * hLigne + 4
    this.pdf.setFillColor(COR.texte)
    this.pdf.roundedRect(x, haut, largeurBoite, hTotal, 6, 6, 'F')
    const libelle = this.avecIva ? 'Total com IVA' : 'Total'
    this.ecrire(libelle.toUpperCase(), x + 9, haut + hTotal / 2 + 0.3465 * 8.4, { taille: 8.4, couleur: COR.blanc, espacement: 1 })
    const baseTotal = haut + hTotal / 2 + 0.3465 * 13
    const zoneTotal = { align: 'droite' as const, largeurZone: largeurBoite - 18 }
    if (this.vazio) this.ecrire(PH_VALOR, x + 9, baseTotal, { taille: 13, gras: true, couleur: COR.pointilles, espacement: 0.5, ...zoneTotal })
    else this.ecrire(eurosPt(this.totalAPagar()), x + 9, baseTotal, { taille: 13, gras: true, couleur: COR.jaune, ...zoneTotal })
    if (lignesNote.length > 0) this.dessinerLignes(lignesNote, x + 9, haut + hTotal + 3, 9.4, 7, 'droite', largeurBoite - 18)
    this.y += hauteur
    this.finBloc(0)
  }

  // ── Encadré jaune ──

  private paragraphesCondicoes(): Paragraphe[] {
    const paragraphes: Paragraphe[] = [
      [{ texte: 'Preço global e fixo.', gras: true }, { texte: ' Prazo de execução: ' }, this.ouPointilles(this.prazo()), { texte: '.' }],
    ]
    if (this.garantia) paragraphes.push([{ texte: 'Garantia:', gras: true }, { texte: ` ${insecables(this.garantia)} sobre a execução dos trabalhos.` }])
    if (this.semPlano) {
      paragraphes.push([{ texte: 'Pagamento:', gras: true }, { texte: ' ' }, this.fragmentTotal(), { texte: insecables(`, ${prazoPagamento(this.e.paymentDue).faturas}.`) }])
    } else {
      paragraphes.push([{ texte: insecables(`Pagamento ${this.plano()}:`), gras: true }, { texte: ' ' }, ...this.textoPrestacoes(), { texte: '.' }])
    }
    return paragraphes
  }

  private condicoes() {
    const pad = this.esp.conditionsPad
    const largeurTexte = LARGEUR - 3 - 24
    const x = MARGE_GAUCHE + 3 + 12
    const elements: Element[] = []
    const paragraphes = this.paragraphesCondicoes()
    paragraphes.forEach((p, n) => {
      const lignes = this.composer(p, largeurTexte, 8, COR.gris4a)
      lignes.forEach((ligne, i) => {
        const apres = i === lignes.length - 1 && n < paragraphes.length - 1 ? 4 : 0
        elements.push({ hauteur: 11.2 + apres, dessiner: (haut) => this.dessinerLignes([ligne], x, haut, 11.2, 8) })
      })
    })
    this.placerBloc(elements, {
      margeHaut: this.esp.conditionsHaut, margeBas: 0, padHaut: pad, padBas: pad, insecable: true,
      fond: (haut, hauteur) => this.fondConditions(haut, hauteur),
    })
  }

  /** Fond crème arrondi et bord gauche jaune de 3 pt (.conditions). */
  private fondConditions(haut: number, hauteur: number) {
    this.pdf.saveGraphicsState()
    this.pdf.roundedRect(MARGE_GAUCHE, haut, LARGEUR, hauteur, 6, 6, null)
    this.pdf.clip()
    this.pdf.discardPath()
    this.pdf.setFillColor(COR.fondConditions)
    this.pdf.rect(MARGE_GAUCHE, haut, LARGEUR, hauteur, 'F')
    this.pdf.setFillColor(COR.jaune)
    this.pdf.rect(MARGE_GAUCHE, haut, 3, hauteur, 'F')
    this.pdf.restoreGraphicsState()
  }

  // ── Pagamento | Aceitação ──

  private paragraphesPagamento(): Paragraphe[] {
    const paragraphes: Paragraphe[] = []
    if (this.virement()) {
      const banco = bancoDoBic(this.e.bic)
      paragraphes.push(
        [{ texte: insecables(`Transferência bancária${banco ? ` · ${banco}` : ''}`) }],
        [{ texte: 'Titular: ' }, this.ouPointilles(this.nome())],
        [{ texte: 'IBAN ' }, this.ouPointilles(this.iban()), { texte: ' · BIC ' }, this.ouPointilles(this.bic())],
      )
    } else {
      paragraphes.push([{ texte: modoPagamento(this.e.paymentMode).curto }])
    }
    if (this.semPlano) paragraphes.push([{ texte: `${this.plano()}: ` }, this.fragmentTotal()])
    else paragraphes.push([{ texte: insecables(`${this.plano()}: `) }, ...this.textoPrestacoes()])
    return paragraphes
  }

  private pagamentoAceitacao() {
    const ecart = 10
    const largeurBoite = (LARGEUR - ecart) / 2
    const xInterieur = 0.75 + 11
    const largeurTexte = largeurBoite - 2 * xInterieur
    const pad = this.esp.piedPad
    const hTitre = 7.4 * NORMAL
    const pagamento = this.paragraphesPagamento().map((p) => this.composer(p, largeurTexte, 8, COR.texte))
    // .footer-box p { margin: 0 0 3pt 0 } : la marge du dernier paragraphe reste dans la boîte.
    const hPagamento = hTitre + 5 + somme(pagamento.map((l) => l.length * 11 + 3))
    const aceitacao = this.composer([{ texte: 'Aceito o orçamento e as condições gerais.' }], largeurTexte, 8, COR.texte)
    const assinatura = this.e.signatureData
    const hImagem = this.assinatura ? 34 : 0
    const hCampo = 5 + 7 * NORMAL + 12
    const hAceitacao = hTitre + 5 + aceitacao.length * 11 + 3 + 2 * hCampo + hImagem + (assinatura ? 8 : 0)
    const hauteur = 0.75 + pad + Math.max(hPagamento, hAceitacao) + pad + 0.75
    this.placer(this.esp.piedHaut, hauteur)
    const xs = [MARGE_GAUCHE, MARGE_GAUCHE + largeurBoite + ecart]
    xs.forEach((x) => this.cadre(x, this.y, largeurBoite, hauteur, 6))
    const titre = (texte: string, x: number) => this.ecrire(texte.toUpperCase(), x + xInterieur, this.y + 0.75 + pad + ligneDeBase(hTitre, 7.4), { taille: 7.4, gras: true, couleur: COR.gris, espacement: 1.1 })
    // Pagamento
    titre('Pagamento', xs[0])
    let haut = this.y + 0.75 + pad + hTitre + 5
    for (const lignes of pagamento) {
      this.dessinerLignes(lignes, xs[0] + xInterieur, haut, 11, 8)
      haut += lignes.length * 11 + 3
    }
    // Aceitação : une ligne de signature par champ ; signature électronique du client dessinée sur la sienne.
    titre('Aceitação', xs[1])
    const xi = xs[1] + xInterieur
    haut = this.y + 0.75 + pad + hTitre + 5
    this.dessinerLignes(aceitacao, xi, haut, 11, 8)
    haut += aceitacao.length * 11 + 3
    const valeurs = assinatura ? [datePt(textePdf(assinatura.timestamp)), textePdf(assinatura.signataire)] : ['', '']
    const campos = ['Data', 'Nome e assinatura do cliente']
    campos.forEach((campo, i) => {
      haut += 5
      this.ecrire(campo, xi, haut + ligneDeBase(7 * NORMAL, 7), { taille: 7, couleur: COR.gris })
      haut += 7 * NORMAL
      if (i === 1 && this.assinatura) {
        try {
          this.pdf.addImage(this.assinatura, 'PNG', xi, haut, (34 * 400) / 140, 34, undefined, COMPRESSION_PNG)
        } catch (erreur) {
          avertir('signature non dessinée', erreur)
        }
        haut += hImagem
      }
      if (valeurs[i]) this.ecrire(valeurs[i], xi, haut + 9.5, { taille: 8, couleur: COR.texte })
      this.filet(xi, haut + 12 - 0.25, xi + largeurTexte, COR.ligneSignature, 0.5)
      haut += 12
    })
    if (assinatura) {
      const empreinte = textePdf(assinatura.hash_sha256).slice(0, 32)
      this.ecrire(`Assinatura eletrónica simples (art. 25.º, n.º 1, eIDAS)${empreinte ? ` · SHA-256 ${empreinte}...` : ''}`, xi, haut + 6, { taille: 5, couleur: COR.gris })
    }
    this.y += hauteur
    this.finBloc(0)
  }

  // ── Annexe ──

  /**
   * h2.sec : 9,6 pt en capitales, filet jaune de 1,5 pt sur toute la largeur ; jamais seul en bas de page
   * (break-after: avoid) : il garde avec lui `suite`, deux lignes de texte par défaut, la première rangée de photos.
   */
  private tituloSeccao(texte: string, suite = 2 * 12.6) {
    const taille = 9.6
    const hLigne = taille * NORMAL
    const lignes = this.couperEspace(texte.toUpperCase(), LARGEUR, taille, true, 1.2)
    const hauteur = lignes.length * hLigne + 3 + 1.5
    this.placer(0, hauteur + 6 + suite)
    lignes.forEach((l, i) => {
      this.ecrire(l, MARGE_GAUCHE, this.y + i * hLigne + ligneDeBase(hLigne, taille), { taille, gras: true, couleur: COR.texte, espacement: 1.2 })
    })
    this.filet(MARGE_GAUCHE, this.y + hauteur - 0.75, MARGE_GAUCHE + LARGEUR, COR.jaune, 1.5)
    this.y += hauteur
    this.finBloc(6)
  }

  /** Liste de la section (ul ou ol) : 8 pt, interligne 12,6 pt, retrait 12 pt, 2 pt entre les éléments. */
  private lista(itens: Fragment[][], type: 'puces' | 'numeros') {
    const x = MARGE_GAUCHE + 12
    const largeur = LARGEUR - 12
    const espace = this.largeur(' ', 8)
    const elements: Element[] = []
    itens.forEach((fragments, n) => {
      const lignes = this.composer(fragments, largeur, 8, COR.gris3a)
      lignes.forEach((ligne, i) => {
        const apres = i === lignes.length - 1 ? 2 : 0
        elements.push({
          hauteur: 12.6 + apres,
          dessiner: (haut) => {
            if (i === 0) {
              const marque = type === 'numeros' ? `${n + 1}.` : '•'
              this.ecrire(marque, x - espace, haut + ligneDeBase(12.6, 8), { taille: 8, couleur: COR.gris3a, align: 'droite', largeurZone: 0 })
            }
            this.dessinerLignes([ligne], x, haut, 12.6, 8)
          },
        })
      })
    })
    this.placerBloc(elements, { margeHaut: 0, margeBas: 13, padHaut: 0, padBas: 0, insecable: false })
  }

  private paragrapheSection(fragments: Fragment[]) {
    const lignes = this.composer(fragments, LARGEUR, 8, COR.gris3a)
    this.placerBloc(
      lignes.map((ligne) => ({ hauteur: 12.6, dessiner: (haut: number) => this.dessinerLignes([ligne], MARGE_GAUCHE, haut, 12.6, 8) })),
      { margeHaut: 0, margeBas: 13, padHaut: 0, padBas: 0, insecable: false },
    )
  }

  /** Notes du devis (libellés de Vitfix Pro traduits) et relatório joint, une puce par ligne. */
  private notas(): Fragment[][] {
    const itens: Fragment[][] = []
    const r = this.e.attachedRapport
    if (r) {
      const horario = [r.startTime ? `das ${textePdf(r.startTime)}` : '', r.endTime ? `às ${textePdf(r.endTime)}` : ''].filter(Boolean).join(' ')
      const detalhe = [
        r.interventionDate ? `intervenção de ${datePt(r.interventionDate)}${horario ? ` ${horario}` : ''}` : '',
        r.motif ? `motivo: ${textePdf(r.motif)}` : '',
        r.siteAddress ? `local: ${textePdf(r.siteAddress)}` : '',
      ].filter(Boolean).join(' · ')
      itens.push([
        { texte: insecables(`Relatório de intervenção n.º ${textePdf(r.rapportNumber)}`), gras: true, couleur: COR.texte },
        { texte: insecables(` anexo a este orçamento${detalhe ? ` (${detalhe})` : ''}.`) },
      ])
    }
    for (const ligne of traduireLibellesGeneres(textePdf(this.e.notes)).split('\n')) {
      const t = ligne.trim()
      if (t) itens.push([{ texte: insecables(t) }])
    }
    return itens
  }

  private registoFotografico(fotos: Array<{ donnees: string; largeur: number; hauteur: number } | null>) {
    const photos = this.e.selectedPhotos || []
    const ecart = 10
    const largeurPhoto = (LARGEUR - ecart) / 2
    const hauteurPhoto = HAUTEUR_PHOTO
    for (let i = 0; i < photos.length; i += 2) {
      const legendes = [0, 1].filter((c) => i + c < photos.length).map((c) => {
        const p = photos[i + c]
        const legenda = [p.label ? textePdf(p.label) : '', p.taken_at ? datePt(p.taken_at) : ''].filter(Boolean).join(' · ')
        const fragments: Fragment[] = [{ texte: `FOTO ${i + c + 1}`, gras: true, couleur: COR.texte }]
        if (legenda) fragments.push({ texte: ` · ${insecables(legenda)}` })
        return this.composer(fragments, largeurPhoto, 7.4, COR.gris5a)
      })
      const hauteur = hauteurPhoto + 3 + Math.max(...legendes.map((l) => l.length)) * 9.6
      this.placer(i === 0 ? 0 : ecart, hauteur)
      legendes.forEach((legende, c) => {
        const x = MARGE_GAUCHE + c * (largeurPhoto + ecart)
        this.pdf.setFillColor(COR.fondPhoto)
        this.pdf.roundedRect(x, this.y, largeurPhoto, hauteurPhoto, 6, 6, 'F')
        this.cadre(x, this.y, largeurPhoto, hauteurPhoto, 6)
        const image = fotos[i + c]
        if (image) {
          const echelle = Math.min((largeurPhoto - 1.5) / image.largeur, (hauteurPhoto - 1.5) / image.hauteur)
          const l = image.largeur * echelle
          const h = image.hauteur * echelle
          this.pdf.addImage(image.donnees, 'JPEG', x + (largeurPhoto - l) / 2, this.y + (hauteurPhoto - h) / 2, l, h)
        } else {
          this.ecrire('Fotografia indisponível', x, this.y + hauteurPhoto / 2, { taille: 7.4, couleur: COR.gris, align: 'centre', largeurZone: largeurPhoto })
        }
        this.dessinerLignes(legende, x, this.y + hauteurPhoto + 3, 9.6, 7.4)
      })
      this.y += hauteur
    }
    this.finBloc(13)
  }

  // ── Condições gerais ──

  /** Clause Pagamento : échéancier, mode et IBAN (pointillés s'ils manquent), escompte et pénalité saisis. */
  private clausulaPagamento(): Fragment[] {
    const e = this.e
    const meio: Fragment[] = this.virement()
      ? [{ texte: 'por transferência bancária para o IBAN ' }, this.ouPointilles(this.iban()), { texte: ' (' }, this.ouPointilles(this.bancoRef()), { texte: ')' }]
      : [{ texte: modoPagamento(e.paymentMode).frase }]
    const juros = jurosDeMora(e.penaltyRate) || 'Os atrasos de pagamento vencem juros de mora à taxa legal em vigor.'
    const fim = [descontoPagamento(e.paymentCondition), juros].filter(Boolean).join(' ')
    if (this.semPlano) {
      return [{ texte: insecables(`Pagamento de 100 % contra fatura, ${prazoPagamento(e.paymentDue).faturas}, `) }, ...meio, { texte: ': ' }, this.fragmentTotal(), { texte: insecables(`. ${fim}`) }]
    }
    const P = this.prestacoes
    if (P.length === 1) {
      // Une seule prestação : « Pagamento de 100 % na adjudicação… após a receção do pagamento » (gabarit).
      const momento = P[0].momento ? ` ${P[0].momento}` : ''
      return [
        { texte: insecables(`Pagamento de ${pourcentPt(P[0].pct)} %${momento}, `) },
        ...meio,
        { texte: ': ' },
        ...this.textoPrestacoes(),
        { texte: insecables(`. Os trabalhos só são agendados após a receção do pagamento. ${fim}`) },
      ]
    }
    let partes = ''
    P.forEach((p, i) => {
      const s = `${i + 1}.ª prestação de ${pourcentPt(p.pct)} %${p.momento ? ` ${p.momento}` : ''}`
      if (i === 0) partes = s
      else if (i === P.length - 1) partes += `${P[i - 1].momento.includes(',') ? ', e ' : ' e '}${s}`
      else partes += `, ${s}`
    })
    return [
      { texte: insecables(`${partes}, `) },
      ...meio,
      { texte: ': ' },
      ...this.textoPrestacoes(),
      { texte: insecables(`. Os trabalhos só são agendados após a receção da 1.ª prestação. ${fim}`) },
    ]
  }

  private clausulaIva(): Fragment[] {
    if (this.regime === 'autoliquidation_btp') {
      return [{ texte: 'IVA autoliquidado pelo adquirente, nos termos da alínea j) do n.º 1 do artigo 2.º do Código do IVA e do Ofício-Circulado n.º 30101/2007 da AT, por se tratar de serviços de construção civil prestados a sujeito passivo com direito à dedução; a fatura conterá a menção IVA - autoliquidação.' }]
    }
    if (this.regime === 'franchise_293b') return [{ texte: 'Isento de IVA ao abrigo do artigo 53.º do Código do IVA.' }]
    if (this.taux.length > 1) return [{ texte: 'Aos valores indicados acresce IVA às taxas indicadas nos artigos.' }]
    return [{ texte: `Aos valores indicados acresce IVA à taxa de ${pourcentPt(this.taux[0] ?? 23)}${ESP}%.` }]
  }

  private condicoesGerais(): Fragment[][] {
    const garantia = this.garantia
      ? `Garantia de ${this.garantia} sobre a execução dos trabalhos, a contar da data de receção, sem prejuízo das garantias legais imperativas e da garantia do fabricante para os produtos.`
      : 'A execução está coberta pela garantia legal aplicável, a contar da receção dos trabalhos, sem prejuízo da garantia do fabricante para os produtos.'
    const clausulas: Array<[string, Fragment[]]> = [
      ['Preço', [{ texte: 'Preço global e fixo para os trabalhos identificados com o cliente, para o âmbito descrito, firme durante a validade do orçamento (' }, this.ouPointilles(this.validade()), { texte: ').' }]],
      ['IVA', this.clausulaIva()],
      ['Pagamento', this.clausulaPagamento()],
      ['Prazo e condições climatéricas', [this.ouPointilles(this.prazo()), { texte: ', a contar do início dos trabalhos. Os trabalhos exteriores executam-se com tempo seco: com chuva ou condições climatéricas impeditivas, os trabalhos são reagendados e o prazo é prorrogado, sem qualquer penalização.' }]],
      ['Trabalhos adicionais e situações ocultas', [{ texte: 'Qualquer trabalho não previsto no presente orçamento, ou tornado necessário por situações ocultas detetadas durante a execução, é objeto de orçamento complementar escrito e só é executado após aceitação do cliente.' }]],
      ['Garantia', [{ texte: insecables(`${garantia} Excluem-se o desgaste normal, os danos causados por terceiros ou por uso indevido e a falta de manutenção.`) }]],
      ['Danos preexistentes', [{ texte: 'O estado das zonas de intervenção é registado em fotografia antes do início dos trabalhos. Os danos preexistentes não são imputáveis à ' }, this.ouPointilles(this.nome()), { texte: '.' }]],
      ['Acesso e autorizações', [{ texte: 'O cliente garante o acesso à zona de trabalho, um ponto de água e um ponto de eletricidade durante todo o prazo e obtém, se necessário, a autorização do condomínio quando os trabalhos incidirem sobre partes comuns.' }]],
      ['Litígios', [{ texte: insecables(`Lei portuguesa. Em caso de litígio de consumo, o cliente pode recorrer ao CNIACC (www.cniacc.pt) ou à entidade de resolução alternativa de litígios territorialmente competente (Lei n.º 144/2015)${this.entidadeRal()}. Livro de reclamações eletrónico em www.livroreclamacoes.pt.`) }]],
      ['Aceitação', [{ texte: 'A assinatura do presente orçamento vale adjudicação e aceitação integral destas condições gerais.' }]],
    ]
    return clausulas.map(([titre, fragments]) => [{ texte: `${titre}.`, gras: true, couleur: COR.texte }, { texte: ' ' }, ...fragments])
  }

  /** « , nomeadamente <médiateur> (<adresse>) » : entité de résolution des litiges indiquée par la société. */
  private entidadeRal(): string {
    const mediador = textePdf(this.e.mediatorName).trim()
    if (!mediador) return ''
    const url = textePdf(this.e.mediatorUrl).trim()
    return `, nomeadamente ${mediador}${url ? ` (${url})` : ''}`
  }

  /** Livre resolução d'un particulier, contrat hors établissement (Decreto-Lei n.º 24/2014). */
  private livreResolucao() {
    const contacto = [this.email(), textePdf(this.e.companyAddress).trim()].filter(Boolean).join(' ou ')
    const envoi = contacto ? `, enviado para ${contacto}` : ''
    this.paragrapheSection([{ texte: insecables(`O cliente dispõe de um prazo de 14 dias de calendário, a contar da assinatura do presente orçamento, para exercer o direito de livre resolução, sem necessidade de justificação nem de pagamento de penalidades (artigo 10.º do Decreto-Lei n.º 24/2014), por qualquer declaração inequívoca ou pelo formulário abaixo${envoi}. Caso solicite expressamente o início dos trabalhos antes do termo desse prazo e depois exerça esse direito, paga o montante proporcional aos trabalhos já executados até à comunicação da resolução; perde o direito assim que o serviço for integralmente prestado (artigo 17.º, n.º 1, alínea a), do mesmo diploma).`) }])
    this.paragrapheSection([{ texte: insecables(`Formulário: pela presente notifico a resolução do contrato relativo ao orçamento n.º ${this.numero() || PH_NUM}.`) }])
    const campos = ['Encomendado em / recebido em', 'Nome do cliente', 'Morada', 'Data', 'Assinatura']
    const hCampo = 5 + 7 * NORMAL + 12
    this.placer(0, campos.length * hCampo)
    for (const campo of campos) {
      this.y += 5
      this.ecrire(campo, MARGE_GAUCHE, this.y + ligneDeBase(7 * NORMAL, 7), { taille: 7, couleur: COR.gris })
      this.y += 7 * NORMAL
      this.filet(MARGE_GAUCHE, this.y + 12 - 0.25, MARGE_GAUCHE + LARGEUR / 2, COR.ligneSignature, 0.5)
      this.y += 12
    }
    this.finBloc(13)
  }

  private textoRgpd(): Fragment[] {
    return [
      { texte: 'Os dados pessoais do cliente são tratados pela ' },
      this.ouPointilles(this.nome()),
      { texte: ' exclusivamente para a elaboração do orçamento, a execução dos trabalhos e a faturação, com fundamento na execução do contrato e no cumprimento de obrigações legais (RGPD, art. 6.º, n.º 1, alíneas b) e c)). São conservados durante o prazo legal de conservação dos documentos fiscais e não são cedidos a terceiros, salvo obrigação legal. O titular pode exercer os direitos de acesso, retificação, apagamento e oposição através de ' },
      this.ouPointilles(this.email()),
      { texte: '.' },
    ]
  }

  /** Pied légal (.fineprint) : identité de la société, mentions de l'art. 171.º du CSC, assurance, émission. */
  private rodape() {
    const e = this.e
    const registo = registoEmpresa(e.companyRCS)
    const capital = textePdf(e.companyCapital).trim()
    const seguradora = textePdf(e.insuranceName).trim()
    const apolice = textePdf(e.insuranceNumber).trim()
    const telefone = textePdf(e.companyPhone).trim()
    const nif = nifLegivel(e.companySiret)
    let mentionRegisto = ''
    if (registo) mentionRegisto = registo.rotulo === 'Alvará' ? `Alvará ${registo.valor}` : registo.valor
    let mentionCapital = ''
    if (capital) mentionCapital = `Capital social ${/€|eur/i.test(capital) ? capital.replace(/\s*eur(os?)?\b/i, ' €') : `${capital} €`}`
    const texte = [
      this.nome(),
      nif ? `NIPC ${nif}` : '',
      mentionRegisto,
      mentionCapital,
      textePdf(e.companyAddress).trim(),
      telefone ? `Tel. ${telefone}` : '',
      this.email(),
      seguradora ? `Seguro de responsabilidade civil: ${seguradora}${apolice ? `, apólice n.º ${apolice}` : ''}` : '',
      'Documento emitido por processamento informático (Vitfix Pro)',
      this.numero(),
      datePt(e.docDate),
    ].filter(Boolean).join(' · ')
    const lignes = this.composer([{ texte: insecables(texte) }], LARGEUR, 6.9, COR.gris)
    this.placerBloc(
      lignes.map((ligne) => ({ hauteur: 9.5, dessiner: (haut: number) => this.dessinerLignes([ligne], MARGE_GAUCHE, haut, 9.5, 6.9) })),
      { margeHaut: 14, margeBas: 0, padHaut: 0, padBas: 0, insecable: true },
    )
  }
}

// ─── Entrées ──────────────────────────────────────────────────────────────────

/** Signature électronique du client en PNG ; null si elle manque ou ne se lit pas. */
async function imageAssinatura(e: PdfV3Input): Promise<string | null> {
  if (!e.signatureData) return null
  try {
    return await e.svgToImageDataUrl(e.signatureData.svg_data, 400, 140)
  } catch (erreur) {
    avertir('signature illisible', erreur)
    return null
  }
}

/**
 * Page 1 dessinée à blanc : d'un seul tenant sur une page de mesure très haute (la mesure à l'écran du gabarit), ou en
 * vrai A4 (en-tête de tableau répété, blocs insécables repoussés). Rend la hauteur continue, ou le remplissage de la
 * dernière page A4.
 */
function essaiFolha1(JsPdf: ConstructeurPdf, octets: OctetsPolice | null, e: PdfV3Input, assinatura: string | null, o: { compacto: boolean; a4: boolean }): number {
  const pdf = o.a4
    ? new JsPdf({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    : new JsPdf({ orientation: 'portrait', unit: 'pt', format: [PAGE_L, HAUTEUR_MESURE] })
  const documento = new DocumentVitfix(pdf, enregistrerPolice(pdf, octets, sansAvertir), e, o.a4 ? GEOMETRIE : GEOMETRIE_MESURE, o.compacto, assinatura)
  documento.folha1()
  return o.a4 ? documento.remplissageDernierePage() : documento.hauteurUtilisee()
}

/**
 * Mise en page de la page 1 (fonction ajustar du gabarit) : débord léger → espacements resserrés ; débord franc et
 * dernière page du devis à moitié vide → l'annexe enchaîne sur cette page au lieu d'une page presque blanche. Le
 * gabarit estimait ce remplissage sur la hauteur continue ; ici, la vraie pagination A4 le donne.
 */
export function modoPagina1(hauteur: number, mesures: { compacta: () => number; derniereA4: () => number }): 'normal' | 'compacto' | 'continua' | 'quebra' {
  const limite = ALTURA_UTIL - 3
  if (hauteur <= limite) return 'normal'
  if (hauteur - limite <= 60 && mesures.compacta() <= limite) return 'compacto'
  return mesures.derniereA4() < ALTURA_UTIL * 0.5 ? 'continua' : 'quebra'
}

const TRACO_ESPACADO = new RegExp(`\\s+[${String.fromCharCode(0x2012)}-${String.fromCharCode(0x2015)}]\\s+`, 'g')
const TRACO = new RegExp(`[${String.fromCharCode(0x2010)}-${String.fromCharCode(0x2015)}${String.fromCharCode(0x2212)}]`, 'g')
/** Champs à ne jamais réécrire : adresses d'images, signature, empreinte. */
const CHAMPS_INTACTOS: ReadonlySet<string> = new Set(['url', 'svg_data', 'hash_sha256'])

/** Règle 4 : aucun tiret long ni demi-cadratin, nulle part ; « – » entouré d'espaces devient « · », les autres « - ». */
export function limparTracos<T>(valeur: T, cle = ''): T {
  if (typeof valeur === 'string') {
    return (CHAMPS_INTACTOS.has(cle) ? valeur : valeur.replace(TRACO_ESPACADO, ' · ').replace(TRACO, '-')) as T
  }
  if (Array.isArray(valeur)) return valeur.map((v) => limparTracos(v, cle)) as T
  if (valeur && typeof valeur === 'object') {
    return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, limparTracos(v, k)])) as T
  }
  return valeur
}

/** Dessine l'orçamento au gabarit Vitfix ; `entree` est l'entrée déjà nettoyée du générateur V3. */
export async function rendreOrcamentoVitfix(JsPdf: ConstructeurPdf, entree: PdfV3Input): Promise<Pdf> {
  const e = limparTracos(entree)
  const [octets, assinatura, fotos] = await Promise.all([
    chargerOctetsPolice(avertir),
    imageAssinatura(e),
    Promise.all((e.selectedPhotos || []).map((p) => chargerImageJpeg(p.url, avertir))),
  ])
  const modo = modoPagina1(essaiFolha1(JsPdf, octets, e, assinatura, { compacto: false, a4: false }), {
    compacta: () => essaiFolha1(JsPdf, octets, e, assinatura, { compacto: true, a4: false }),
    derniereA4: () => essaiFolha1(JsPdf, octets, e, assinatura, { compacto: false, a4: true }),
  })
  const pdf = new JsPdf({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const documento = new DocumentVitfix(pdf, enregistrerPolice(pdf, octets, avertir), e, GEOMETRIE, modo === 'compacto', assinatura)
  documento.folha1()
  documento.anexo(modo === 'continua', fotos)
  documento.finaliser()
  return pdf
}
