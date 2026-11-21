/**
 * Devis et factures de la société de la marque Method Soluções (fiche METHOD_SOLUCOES_PROFIL_ID) : gabarit
 * « Method Soluções » fourni le 17/11/2026 (générateur d'origine de la société : JSON → HTML → PDF),
 * redessiné ici avec jsPDF, mêmes mesures (points) et mêmes couleurs, document en portugais (PT-PT).
 *
 * Le gabarit s'adapte au générateur Vitfix, pas l'inverse : il reçoit les données du modèle BTP par
 * défaut (PdfV3Input) et n'ajoute aucun champ au formulaire.
 *  - capítulos = sections du devis (un devis d'une seule section non renommée : « Trabalhos ») ;
 *    artigos = lignes (titre, description, étapes numérotées, unité, quantité, prix, total), 1.01, 1.02… ;
 *  - Data, Validade, Prazo de execução (et date de début si saisie), Pagamento : échéancier des
 *    acomptes (« 50 / 30 / 20 » et prestações), sinon mode et délai de paiement ; IBAN des réglages ;
 *  - IVA : taux des lignes, autoliquidation ou franchise, comme le devis ;
 *  - Alvará : champ « RCS / RM » de la société (le formulaire n'a pas de champ dédié).
 * Ce que le générateur n'a pas n'apparaît pas : medição, cartões, orçamento provisório, série de preços,
 * méthode de structure du gabarit, medições de referência, método construtivo, lignes Obra et Projeto.
 * Ce que le gabarit n'avait pas reçoit une place dans son style : remises (colonne Desc., ligne de
 * remise), plusieurs taux (colonne IVA), notes, factures et sous-types, page de livre resolução,
 * rapport joint, signature électronique, annexe photos.
 * Les valeurs fixes du formulaire (en français) sont traduites : mode et délai de paiement,
 * déclencheurs d'acompte, escompte, unités, noms de section par défaut, délai d'exécution.
 * Police Liberation Sans (public/fonts) et logo (public/images/modeles-pdf) chargés à la génération ;
 * s'ils manquent : Helvetica et logotype en texte, comme le générateur d'origine sans son logo.
 */

import type { DevisAcompte, ProductLine } from '@/lib/devis-types'
import { titleCaseAddress } from '@/lib/devis-utils'
import { computeAcomptesAmounts, mulMoney, round2, sumMoney } from '@/lib/money'
import { sanitizeForHelvetica, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import { COMPRESSION_PNG, fondBlancAvantJpeg } from '@/lib/pdf/images-pdf'
import { computeEcheanceDate, parsePaymentDelayDays } from '@/lib/pdf/payment-due'
import { texteRemiseLigne } from '@/lib/remise-commerciale'
import { getMentionLegale } from '@/lib/tva-calculator'

type Pdf = import('jspdf').jsPDF
type ConstructeurPdf = typeof import('jspdf').jsPDF

export const MARCA_METHOD = 'Method Soluções'
export const LEMA_METHOD = 'Ideias para a sua Empresa'
/** Logo transparent du gabarit (PNG 813 × 874 px). */
export const URL_LOGO_METHOD = '/images/modeles-pdf/method-solucoes-logo.png'
export const URL_POLICE_METHOD = '/fonts/LiberationSans-Regular.ttf'
export const URL_POLICE_METHOD_GRAS = '/fonts/LiberationSans-Bold.ttf'
const PROPORTION_LOGO = 874 / 813
const POLICE = 'LiberationSans'

/** Couleurs du gabarit (INK, GOLD, CREAM, LINE, GREY) et teintes fixées dans sa feuille de style. */
const COR = {
  encre: '#3e3513',
  or: '#b08d2e',
  creme: '#f6f3ea',
  filet: '#e3ded0',
  gris: '#6b6555',
  texte: '#1e1a0f',
  pointilles: '#a39c8a',
  valeurTotal: '#e9c95a',
  etapes: '#4a4535',
  sousTotal: '#fbfaf5',
  cachet: '#c9c2ad',
  cachetTexte: '#a8a191',
  ligneSignature: '#9c9482',
} as const

// Géométrie en points : A4, marges 40 / 40 / 46 / 40 du gabarit.
const PAGE_L = 595.28
const PAGE_H = 841.89
const MARGE_HAUT = 40
const MARGE_BAS = 46
const MARGE_GAUCHE = 40
const LARGEUR = PAGE_L - 2 * MARGE_GAUCHE
const BAS_PAGE = PAGE_H - MARGE_BAS
/** line-height du corps du gabarit */
const INTERLIGNE = 1.36
const HAUTEUR_ENTETE_TABLEAU = 5 + 7.2 * INTERLIGNE + 5
const PAD_ARTICLE = 4.4
/** Début d'un artigo plus haut qu'une page à garder sous son titre de capítulo : marge et trois lignes. */
const DEBUT_ARTICLE_COUPE = PAD_ARTICLE + 3 * 11.5

/** Espace insécable (U+00A0). */
const ESP = String.fromCharCode(0xa0)
const POINTILLES = '........................................'
const POINTILLES_COURTS = '............'

const TOLERANCE = 0.01

// ─── Nombres, dates et textes ─────────────────────────────────────────────────

const deuxChiffres = (n: number) => String(n).padStart(2, '0')

/** Nombre au format du gabarit : « 1 234,56 » (espace insécable entre les milliers). */
export function nombrePt(valeur: number, decimales = 2): string {
  const v = Number.isFinite(valeur) ? valeur : 0
  const facteur = 10 ** decimales
  const arrondi = Math.round((Math.abs(v) + Number.EPSILON) * facteur) / facteur
  const [entier, fraction] = arrondi.toFixed(decimales).split('.')
  const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESP)
  return (v < 0 && arrondi !== 0 ? '-' : '') + groupes + (fraction ? `,${fraction}` : '')
}

export const eurosPt = (valeur: number) => `${nombrePt(valeur)}${ESP}€`

/**
 * Quantité ou prix unitaire d'un artigo : deux décimales comme le gabarit, jusqu'à quatre quand la valeur
 * saisie en a plus. Le gabarit arrondissait qt et pu avant de calculer ; Vitfix calcule le total de la ligne
 * sur la valeur exacte, qui reste donc lisible à côté.
 */
export function quantitePt(valeur: number): string {
  for (const decimales of [2, 3]) {
    if (Math.abs(valeur * 10 ** decimales - Math.round(valeur * 10 ** decimales)) < 1e-6) return nombrePt(valeur, decimales)
  }
  return nombrePt(valeur, 4)
}

/** Pourcentage du gabarit : « 23 », « 5,5 », « 33,33 ». */
export function pourcentPt(p: number): string {
  if (Number.isInteger(p)) return String(p)
  return nombrePt(p, 2).replace(/0+$/, '').replace(/,$/, '')
}

/** « 2026-11-17 » → « 17/11/2026 », sans passer par le fuseau horaire. */
export function datePt(valeur: string | null | undefined): string {
  if (!valeur) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valeur)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(valeur)
  return Number.isNaN(d.getTime()) ? valeur : d.toLocaleDateString('pt-PT')
}

function dateDuJour(): string {
  const d = new Date()
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Tirets demi-cadratin (U+2013) et cadratin (U+2014), interdits par le gabarit. */
const TIRETS_LONGS = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, 'g')

/** Texte prêt pour le PDF : glyphes absents remplacés, tirets longs remplacés par un trait d'union (règle du gabarit). */
export function textePdf(valeur: string | null | undefined): string {
  return sanitizeForHelvetica(valeur).replace(TIRETS_LONGS, '-')
}

const normaliser = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/œ/g, 'oe').replace(/[’`]/g, "'").toLowerCase().trim()

/** Groupes à ne jamais couper en fin de ligne (« sem_quebra » du gabarit) : montants, unités, IBAN, n.º, plan de paiement. */
const MOTIFS_INSECABLES: RegExp[] = [
  /\b[A-Z]{2}\d{2}(?: [A-Z0-9]{4}){2,7}(?: [A-Z0-9]{1,4})?\b/g,
  /(?<![\d,])\d+(?:,\d+)? \/ \d+(?:,\d+)?(?: \/ \d+(?:,\d+)?)*/g,
  /[Nn]\.º \S+/g,
  /(?<![\d,.])\d{1,3}(?: \d{3})+(?:,\d+)?/g,
  /(?<![\d,.])\d+(?:[.,]\d+)* (?:€\/m2|€\/m3|€\/ml|€|%|m2|m3|m²|m³|ml|cm|mm|kg|m|t|ºC|dias?|meses|mês|semanas?|anos?)(?![\p{L}\d/])/gu,
  /(?<!\d)\d+\.ª prestação/g,
]

export function insecables(texte: string): string {
  let t = texte
  for (const motif of MOTIFS_INSECABLES) t = t.replace(motif, (m) => m.replace(/ /g, ESP))
  return t
}

function juntar(itens: string[]): string {
  const remplis = itens.filter(Boolean)
  if (remplis.length < 2) return remplis.join('')
  return `${remplis.slice(0, -1).join(', ')} e ${remplis[remplis.length - 1]}`
}

const majuscule = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// ─── Valeurs du formulaire BTP (françaises) traduites pour le gabarit ─────────

const REGLES_QUANDO: Array<[RegExp, (m: RegExpExecArray) => string]> = [
  [/^a la (signature|commande)\b/, () => 'na adjudicação'],
  [/^(au )?demarrage\b|^au debut\b/, () => 'no início dos trabalhos'],
  [/^a mi-?chantier\b|^a mi-parcours\b/, () => 'a meio dos trabalhos'],
  [/^a la (livraison|reception|fin)\b|^en fin de chantier\b/, () => 'no final, contra auto de receção provisória'],
  [/^(\d+) jours?\b/, (m) => `a ${m[1]} dias`],
]

/** Déclencheur d'un acompte (« À la signature », « Au démarrage »…) dans les mots du gabarit. */
export function quandoPrestacao(declencheur: string | null | undefined): string {
  const t = textePdf(declencheur).trim()
  const n = normaliser(t)
  for (const [motif, traduction] of REGLES_QUANDO) {
    const m = motif.exec(n)
    if (m) return traduction(m)
  }
  return t
}

export interface ModoPagamento {
  /** Case « Pagamento » : « Transferência bancária » */
  curto: string
  /** Dans une phrase : « por transferência bancária » */
  frase: string
}

const MODES: Array<[RegExp, ModoPagamento]> = [
  [/^virement|^transferencia/, { curto: 'Transferência bancária', frase: 'por transferência bancária' }],
  [/^cheque/, { curto: 'Cheque', frase: 'por cheque' }],
  [/^carte|^cartao/, { curto: 'Cartão bancário', frase: 'por cartão bancário' }],
  [/^especes|^numerario/, { curto: 'Numerário', frase: 'em numerário, dentro do limite legal' }],
  [/^prelevement|^debito direto/, { curto: 'Débito direto SEPA', frase: 'por débito direto SEPA' }],
]

/** Mode de paiement du formulaire (« Virement bancaire »…) ; vide : virement, comme le générateur. */
export function modoPagamento(mode: string | null | undefined): ModoPagamento {
  const t = textePdf(mode).trim()
  const n = normaliser(t)
  if (!n) return MODES[0][1]
  for (const [motif, pt] of MODES) if (motif.test(n)) return pt
  return { curto: t, frase: `por ${t.charAt(0).toLowerCase()}${t.slice(1)}` }
}

export interface PrazoPagamento {
  /** Case « Pagamento » : « 30 dias », « A pronto » */
  curto: string
  /** « faturas a 30 dias » */
  faturas: string
  /** « Faturas com vencimento a 30 dias » */
  vencimento: string
}

/** Délai de paiement du formulaire (« Comptant à réception », « 30 jours », « 45 jours fin de mois »…). */
export function prazoPagamento(delai: string | null | undefined): PrazoPagamento {
  const t = textePdf(delai).trim()
  const n = normaliser(t)
  if (!n || /comptant|reception|pronto|immediat|imediat/.test(n)) {
    return { curto: 'A pronto', faturas: 'a pronto pagamento', vencimento: 'pagáveis a pronto, na receção' }
  }
  const jours = /(?<!\d)(\d+)\s*(?:jours?|dias?)\b/.exec(n)
  if (jours) {
    const fimDoMes = /fin de mois|fim do mes/.test(n) ? ' fim do mês' : ''
    const prazo = `${jours[1]} dias${fimDoMes}`
    return { curto: prazo, faturas: `a ${prazo}`, vencimento: `com vencimento a ${prazo}` }
  }
  return { curto: t, faturas: t, vencimento: `com vencimento ${t}` }
}

/** Escompte du formulaire (« Aucun escompte accordé pour paiement anticipé »…). */
export function descontoPagamento(escompte: string | null | undefined): string {
  const t = textePdf(escompte).trim()
  const n = normaliser(t)
  if (!n) return ''
  if (/^aucun escompte/.test(n)) return 'Sem desconto por pagamento antecipado.'
  const m = /^(\d+(?:[.,]\d+)?)\s*%\s*pour paiement (?:a (\d+) jours|comptant)/.exec(n)
  if (m) return `Desconto de ${m[1].replace('.', ',')} % para pagamento ${m[2] ? `a ${m[2]} dias` : 'a pronto'}.`
  return /[.!?]$/.test(t) ? t : `${t}.`
}

/** Délai d'exécution déjà rédigé par le générateur (« 5 semaines », « 10 jours ouvrés »…). */
export function prazoExecucao(delai: string | null | undefined): string {
  const t = textePdf(delai).trim()
  const m = /^(\d+)\s+(\S.*)$/.exec(t)
  if (!m) return t
  const nombre = Number(m[1])
  const unite = normaliser(m[2])
  const plusieurs = nombre > 1
  if (/^jours? ouvres?$/.test(unite)) return `${nombre} ${plusieurs ? 'dias úteis' : 'dia útil'}`
  // « dias de calendário » (PT-PT) ; « dias corridos » est brésilien, exclu par le gabarit.
  if (/^jours? calendaires?$/.test(unite)) return `${nombre} ${plusieurs ? 'dias de calendário' : 'dia de calendário'}`
  if (/^jours?$/.test(unite)) return `${nombre} ${plusieurs ? 'dias' : 'dia'}`
  if (/^semaines?$/.test(unite)) return `${nombre} ${plusieurs ? 'semanas' : 'semana'}`
  if (unite === 'mois') return `${nombre} ${plusieurs ? 'meses' : 'mês'}`
  return t
}

/** Unités du formulaire (UNITES_TABLEAU) dans l'écriture du gabarit : m2, ml, un, vg… */
const UNIDADES: Readonly<Record<string, string>> = {
  m2: 'm2', 'm²': 'm2', m3: 'm3', 'm³': 'm3', ml: 'ml', m: 'm',
  u: 'un', pce: 'pç', ens: 'cj', lot: 'lote', pt: 'pt',
  kg: 'kg', t: 't', L: 'l', l: 'l',
  sac: 'saco', rl: 'rolo', palette: 'palete', benne: 'contentor', camion: 'camião',
  h: 'h', j: 'dia', jour: 'dia', sem: 'sem', semaine: 'sem', f: 'vg', forfait: 'vg', tonne: 't',
}

export function unidadePt(unite: string | null | undefined, uniteLibre?: string): string {
  const u = unite === 'autre' ? (uniteLibre || 'un') : (unite || 'u')
  return Object.prototype.hasOwnProperty.call(UNIDADES, u) ? UNIDADES[u] : textePdf(u)
}

/**
 * Noms de section posés par le formulaire et par Vitfix : sections par défaut, section d'une facture
 * d'acompte (lib/acompte-par-taux.ts), acomptes déduits d'une facture de solde (lib/facture-depuis-devis.ts).
 */
const NOMS_SECTION: Readonly<Record<string, string>> = {
  "main d'oeuvre": 'Mão de obra',
  'mao de obra': 'Mão de obra',
  materiaux: 'Materiais',
  materiais: 'Materiais',
  'frais annexes': 'Despesas acessórias',
  'despesas acessorias': 'Despesas acessórias',
  section: 'Secção',
  acompte: 'Adiantamento',
  adiantamento: 'Adiantamento',
  'acomptes deja factures (a deduire)': 'Adiantamentos já faturados (a deduzir)',
  'adiantamentos ja faturados (a deduzir)': 'Adiantamentos já faturados (a deduzir)',
}

/**
 * Libellés que Vitfix rédige lui-même en français quand l'interface est en français : lignes et notes
 * des factures d'acompte (lib/acompte-par-taux.ts) et de solde (lib/facture-depuis-devis.ts). Leur
 * version portugaise est celle que ces modules écrivent pour une interface en portugais. Une ligne à la
 * fois, après textePdf (tirets longs devenus « - »).
 */
const LIBELLES_GENERES: Array<[RegExp, (m: RegExpExecArray) => string]> = [
  [/^Acompte déjà facturé - facture n° (.+)$/, (m) => `Adiantamento já faturado - fatura n.º ${suiteDeduction(m[1])}`],
  [/^Acompte de ([\d,.]+) % sur travaux sous-traités - autoliquidation de la TVA$/, (m) => `Adiantamento de ${m[1]} % por conta dos trabalhos - IVA - autoliquidação`],
  [/^Acompte de ([\d,.]+) % sur travaux soumis à la TVA au taux de ([\d,.]+) %$/, (m) => `Adiantamento de ${m[1]} % por conta dos trabalhos sujeitos a IVA à taxa de ${m[2]} %`],
  [/^Acompte de ([\d,.]+) % sur prestations facturées sans TVA$/, (m) => `Adiantamento de ${m[1]} % por conta de operações não sujeitas a IVA`],
  [/^Acompte de ([\d,.]+) % sur travaux$/, (m) => `Adiantamento de ${m[1]} % por conta dos trabalhos`],
  [/^(Devis|Facture) n° (\S+)(?: du (\d{2}\/\d{2}\/\d{4}))?$/, (m) => `${m[1] === 'Devis' ? 'Orçamento' : 'Fatura'} n.º ${m[2]}${m[3] ? ` de ${m[3]}` : ''}`],
  [/^Base HT à ce taux : (.+)$/, (m) => `Base tributável a esta taxa: ${m[1]}`],
  [/^Base HT : (.+)$/, (m) => `Base tributável: ${m[1]}`],
  [/^Montant des travaux : (.+)$/, (m) => `Montante dos trabalhos: ${m[1]}`],
  [
    /^Acompte de ([\d,.]+) % \(n° (\d+) sur (\d+)\) sur (le devis|la facture) n° (\S+)(?: du (\d{2}\/\d{2}\/\d{4}))?\. Échéance : (.+)\.$/,
    (m) => `Adiantamento de ${m[1]} % (n.º ${m[2]} de ${m[3]}) por conta ${m[4] === 'le devis' ? 'do orçamento' : 'da fatura'} n.º ${m[5]}${m[6] ? ` de ${m[6]}` : ''}. Vencimento: ${quandoPrestacao(m[7])}.`,
  ],
  [/^Réf\. devis : (.+)$/, (m) => `Ref. orçamento: ${m[1]}`],
]

/** Fin d'une ligne de déduction d'acompte : « … du 12/10/2026, net de l'avoir n° …  - TVA 20 % ». */
function suiteDeduction(suite: string): string {
  return suite
    .replace(/ du (\d{2}\/\d{2}\/\d{4})/, ' de $1')
    .replace(", net de l'avoir n° ", ', líquido da nota de crédito n.º ')
    .replace(/ - TVA ([\d,.]+) %$/, ' - IVA $1 %')
}

/** Traduit, ligne par ligne, les libellés rédigés en français par Vitfix ; le texte saisi reste tel quel. */
export function traduireLibellesGeneres(texte: string): string {
  return texte.split('\n').map((ligne) => {
    for (const [motif, traduction] of LIBELLES_GENERES) {
      const m = motif.exec(ligne)
      if (m) return traduction(m)
    }
    return ligne
  }).join('\n')
}

/** Ligne « Ref. orçamento: DEV-… » des notes, une fois traduite. */
const REFERENCE_ORCAMENTO = /^Ref\. orçamento: ?(\S.*)$/

/** Taux d'IVA du continent portugais (normal, intermédiaire, réduit). */
const TAXAS_IVA_PT: ReadonlySet<number> = new Set([23, 13, 6])

/**
 * Valeur par défaut du formulaire pour les pénalités de retard : règle française (art. L. 441-10 C. com.), ou celle
 * d'un document créé en portugais (« Taxa de juro legal em vigor », components/DevisFactureFormBTP.tsx).
 */
const PENALITE_PAR_DEFAUT = /^3\s*(?:×|x|fois)\s*(?:le\s+)?taux d'interet legal|^taxa de juro legal em vigor\.?$/

/** « Juros de mora: … » pour une pénalité saisie ; rien pour la valeur par défaut (clause du DL 62/2013). */
export function jurosDeMora(penalite: string | null | undefined): string {
  const t = textePdf(penalite).trim()
  const n = normaliser(t)
  if (!n || PENALITE_PAR_DEFAUT.test(n)) return ''
  return `Juros de mora: ${t}${/[.!?]$/.test(t) ? '' : '.'}`
}

/** Titre d'un capítulo ; une section unique non renommée devient « Trabalhos ». */
export function nomeCapitulo(nom: string | null | undefined, seul: boolean): string {
  const t = textePdf(nom).trim()
  const defaut = NOMS_SECTION[normaliser(t)]
  if (!t || (seul && defaut === 'Mão de obra')) return 'Trabalhos'
  return defaut ?? t
}

/** Assurance déclarée dans le formulaire (RC Pro, décennale, les deux). */
const TIPOS_SEGURO: Readonly<Record<string, string>> = {
  rc_pro: 'Seguro de responsabilidade civil profissional',
  decennale: 'Seguro de garantia decenal',
  both: 'Seguros de responsabilidade civil profissional e de garantia decenal',
}

/** Champ « RCS / RM » de la société : l'alvará d'une société portugaise (« Alvará IMPIC n.º … »). */
export function registoEmpresa(rcs: string | null | undefined): { rotulo: string; valor: string } | null {
  const t = textePdf(rcs).trim()
  if (!t) return null
  if (/^alvar[aá]/i.test(t)) return { rotulo: 'Alvará', valor: t.replace(/^alvar[aá][\s:-]*/i, '').trim() || t }
  if (/impic|alvar[aá]/i.test(t)) return { rotulo: 'Alvará', valor: t }
  return { rotulo: 'Registo', valor: t }
}

type EntreeTitre = Pick<PdfV3Input, 'docType' | 'factureSubType'>

export function tituloDocumento(e: EntreeTitre): string {
  if (e.docType !== 'facture') return 'Orçamento'
  switch (e.factureSubType) {
    case 'acompte': return 'Fatura de adiantamento'
    case 'situation': return 'Fatura de situação'
    case 'avoir': return 'Nota de crédito'
    default: return 'Fatura'
  }
}

/** Titre par défaut d'un document (« Devis », « Orçamento DEV-2026-001 », « Facture n° FACT-… », numéro seul). */
function estTitreParDefaut(titre: string): boolean {
  const n = normaliser(titre)
  return /^(?:devis|orcamento|facture|fatura|avoir|nota de credito)(?:\s+n\.?[°º]?)?(?:\s+[a-z]{2,}-\d[\w-]*)?$/.test(n)
    || /^[a-z]{2,}-\d[\w-]*$/.test(n)
}

/**
 * Ligne du projet sous le titre : le titre saisi pour le document, '' quand c'est un titre par défaut.
 * Titres rédigés par Vitfix : facture d'acompte « Acompte n° 1 sur 3 (30 %) - <titre du devis> » (le
 * gabarit écrit lui-même « Adiantamento n.º 1 de 3 · 30 % ») ; facture de solde « Facture de solde - … »
 * (« Saldo · … »).
 */
export function tituloPersonalizado(docTitle: string | null | undefined): string {
  let t = textePdf(docTitle).trim()
  const acompte = /^(?:acompte n° \d+ sur \d+|adiantamento n\.º \d+ de \d+) \([^)]*\) - /i.exec(t)
  if (acompte) t = t.slice(acompte[0].length).trim()
  const solde = /^(?:facture de solde|fatura de saldo)(?: - |$)/i.exec(t)
  if (solde) t = t.slice(solde[0].length).trim()
  const libre = t && !estTitreParDefaut(t) ? t : ''
  return solde ? ['Saldo', libre].filter(Boolean).join(' · ') : libre
}

/** Date d'échéance d'une facture (« 17/12/2026 ») ou délai en mots quand il n'est pas calculable. */
export function vencimentoFatura(delai: string | null | undefined, docDate: string | null | undefined): string {
  const t = (delai || '').trim()
  if (!t) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return datePt(t)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(docDate || '')
  if (m && (parsePaymentDelayDays(t) !== null || /comptant|r[ée]ception|pronto|imm[ée]diat/i.test(t))) {
    const d = computeEcheanceDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), t)
    return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`
  }
  return prazoPagamento(t).curto
}

/** Adresse tout en majuscules (fiche société) remise en casse, particules portugaises en minuscules. */
function moradaPt(adresse: string | null | undefined): string {
  const t = textePdf(adresse).trim()
  if (!t || t !== t.toUpperCase()) return t
  return titleCaseAddress(t).replace(/(?<=\S\s)(De|Da|Do|Das|Dos|E)(?=\s)/g, (p) => p.toLowerCase())
}

// ─── Données du document ──────────────────────────────────────────────────────

interface Article {
  code: string
  titre: string
  bloc: string
  etapes: string[]
  unite: string
  qt: number
  pu: number
  total: number
  remise: string
  taux: number
}

interface Chapitre {
  numero: number
  titre: string
  articles: Article[]
  sousTotal: number
}

const ligneRemplie = (l: ProductLine | null | undefined): l is ProductLine =>
  !!l && typeof l.description === 'string' && l.description.trim().length > 0

const renseigne = (v: number | null | undefined): v is number => v !== null && v !== undefined

/** Précisions d'une facture d'acompte, de situation ou d'une note de crédito : « Adiantamento n.º 1 de 3 · 30 % · sobre orçamento n.º … ». */
function detalheFatura(e: PdfV3Input): string[] {
  if (e.docType !== 'facture') return []
  const parent = textePdf(e.parentInvoiceNumber).trim()
  const typeParent = /^DEV-/i.test(parent) ? 'orçamento' : 'fatura'
  const surParent = parent ? `sobre ${typeParent} n.º ${parent}` : ''
  switch (e.factureSubType) {
    case 'acompte':
      return [
        e.acompteOrdre && e.acompteTotal ? `Adiantamento n.º ${e.acompteOrdre} de ${e.acompteTotal}` : '',
        renseigne(e.acomptePourcentage) ? `${pourcentPt(e.acomptePourcentage)} %` : '',
        surParent,
      ]
    case 'situation':
      return [
        e.situationNumber ? `Situação n.º ${e.situationNumber}` : '',
        renseigne(e.situationAvancement) ? `avanço de ${pourcentPt(e.situationAvancement)} %` : '',
      ]
    case 'avoir':
      return [surParent]
    default:
      return []
  }
}

/** Régime d'IVA du document, avec les mêmes replis que le modèle par défaut (anciens documents). */
function regimeEffectif(e: PdfV3Input): 'classique' | 'franchise_293b' | 'autoliquidation_btp' {
  if (e.regimeTva) return e.regimeTva
  if (e.autoliquidationBTP) return 'autoliquidation_btp'
  return e.tvaEnabled ? 'classique' : 'franchise_293b'
}

/** Une prestação du plan de paiement : pourcentage du total et moment (« no início dos trabalhos »). */
interface Prestacao {
  pct: number
  quando: string
}

/**
 * Échéancier des acomptes du devis en prestações. Le gabarit exige un plan qui fait 100 % ; le formulaire
 * propose par défaut un seul acompte de 30 % : le reste devient la dernière prestação, le solde.
 */
export function prestacoesDoDevis(acomptes: DevisAcompte[] | null | undefined): Prestacao[] {
  const valides = (acomptes || []).filter((a) => a && Number.isFinite(a.pourcentage) && a.pourcentage > 0)
  const prestacoes = valides.map((a) => ({ pct: a.pourcentage, quando: quandoPrestacao(a.declencheur) }))
  const reste = round2(100 - sumMoney(valides.map((a) => a.pourcentage)))
  if (prestacoes.length > 0 && reste > 0) prestacoes.push({ pct: reste, quando: 'de saldo, contra a fatura final' })
  return prestacoes
}

function articleDeLigne(l: ProductLine, code: string): Article {
  const propre = traduireLibellesGeneres(textePdf(l.description.replace(/\s*\[[^\]]*\]/g, '').trim()))
  const [titre, ...reste] = propre.split('\n')
  let detail = reste.join('\n').trim()
  const etapes = [...(l.etapes || [])]
    .sort((a, b) => a.ordre - b.ordre)
    .map((et) => textePdf(et.designation).trim())
    .filter(Boolean)
  // Anciens devis : étapes recopiées dans la description, jointes par des flèches.
  const jointes = etapes.join(' -> ')
  if (jointes && detail === jointes) detail = ''
  else if (jointes && detail.includes(jointes)) detail = detail.replace(jointes, '').trim()
  const qt = Number(l.qty) || 0
  const pu = Number(l.priceHT) || 0
  return {
    code,
    titre: titre.trim(),
    bloc: [detail, traduireLibellesGeneres(textePdf(l.lineDetail).trim())].filter(Boolean).join('\n'),
    etapes,
    unite: unidadePt(l.unit, l.customUnit),
    qt,
    pu,
    total: Number(l.totalHT) || 0,
    remise: texteRemiseLigne(l.remise, (montant) => nombrePt(montant), mulMoney(qt, pu)),
    taux: Number(l.tvaRate) || 0,
  }
}

/** Mêmes sections que le modèle BTP par défaut, dans le même ordre ; une section désactivée ou vide est sautée. */
function chapitresDocument(e: PdfV3Input): Chapitre[] {
  const candidates: Array<{ nom: string | undefined; parDefaut: string; lignes: ProductLine[] | undefined; active: boolean }> = [
    { nom: e.linesName, parDefaut: '', lignes: e.laborLines, active: true },
    { nom: e.materialLinesName, parDefaut: 'Materiais', lignes: e.materialLines, active: e.materialLinesEnabled !== false },
    { nom: e.fraisLinesName, parDefaut: 'Despesas acessórias', lignes: e.fraisLines, active: e.fraisLinesEnabled !== false },
    ...(e.customTables || []).filter(Boolean).map((t) => ({ nom: t.name, parDefaut: 'Secção', lignes: t.lines, active: true })),
  ]
  const sections = candidates
    .filter((c) => c.active && Array.isArray(c.lignes) && c.lignes.some(ligneRemplie))
    .map((c) => ({ nom: c.nom || c.parDefaut, lignes: c.lignes ?? [] }))
  if (sections.length === 0) sections.push({ nom: '', lignes: e.lines || [] })
  const seule = sections.length === 1
  return sections.map((s, i) => {
    const articles = s.lignes.filter(ligneRemplie).map((l, j) => articleDeLigne(l, `${i + 1}.${deuxChiffres(j + 1)}`))
    return { numero: i + 1, titre: nomeCapitulo(s.nom, seule), articles, sousTotal: sumMoney(articles.map((a) => a.total)) }
  })
}

// ─── Mise en page ─────────────────────────────────────────────────────────────

type Alignement = 'gauche' | 'centre' | 'droite'

interface Fragment {
  texte: string
  gras?: boolean
  couleur?: string
}

interface Bout {
  texte: string
  gras: boolean
  couleur: string
  largeur: number
  x: number
  espaceAvant: boolean
}

interface LigneComposee {
  bouts: Bout[]
  largeur: number
}

interface Mot {
  bouts: Array<Omit<Bout, 'x' | 'espaceAvant'>>
  largeur: number
}

/** Élément vertical d'un bloc : sa hauteur et son dessin depuis son bord haut. */
interface Element {
  hauteur: number
  dessiner: (haut: number) => void
}

interface Rangee {
  hauteur: number
  /** À garder sur la même page que la rangée suivante (titre de capítulo, dernier artigo et sous-total). */
  liee: boolean
  /** Artigo d'un groupe plus haut qu'une page : coupé sur place plutôt que renvoyé à la page suivante. */
  coupable?: boolean
  /** Hauteur de la rangée liée qui suit (sous-total), à garder avec les dernières lignes de l'artigo. */
  reserveApres?: number
  dessiner: () => void
}

interface Colonne {
  titre: string
  largeur: number
  align: Alignement
  x: number
}

/** Colonnes du tableau : Desc. seulement si une ligne a une remise, IVA seulement si les lignes ont plusieurs taux. */
interface Colonnes {
  art: Colonne
  des: Colonne
  un: Colonne
  qt: Colonne
  pu: Colonne
  desc?: Colonne
  iva?: Colonne
  total: Colonne
}

interface LigneTotal {
  libelle: string
  valeur: string
  gras?: boolean
  petit?: boolean
}

/** Ligne de base d'un texte de taille `taille` centré dans une ligne de hauteur `hauteur` (Liberation Sans). */
const ligneDeBase = (hauteur: number, taille: number) => hauteur / 2 + 0.3465 * taille

const somme = (valeurs: number[]) => valeurs.reduce((s, v) => s + v, 0)

/**
 * Ressource du gabarit manquante (police, logo, photo, signature) : le PDF sort quand même, dégradé.
 * Remonté à Sentry pour que cela ne passe pas inaperçu en production, comme l'échec de Factur-X du V3.
 */
function avertir(contexte: string, erreur: unknown) {
  if (process.env.NODE_ENV !== 'production') console.warn(`[PDF Method Soluções] ${contexte}`, erreur)
  import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.captureException(erreur instanceof Error ? erreur : new Error(String(erreur)), {
        level: 'warning',
        tags: { pdf_modele: 'method-solucoes' },
        extra: { contexte },
      })
    })
    .catch((echec: unknown) => {
      // Sentry indisponible (bloqueur, hors ligne) : seul le PDF compte ici.
      if (process.env.NODE_ENV !== 'production') console.warn('[PDF Method Soluções] Sentry indisponible', echec)
    })
}

class DocumentMethod {
  private y = MARGE_HAUT
  private margeEnAttente = 0
  private readonly devis: boolean
  private readonly regime: 'classique' | 'franchise_293b' | 'autoliquidation_btp'
  private readonly avecIva: boolean
  private readonly chapitres: Chapitre[]
  /** Taux des artigos, distincts, du plus fort au plus faible */
  private readonly taux: number[]
  /** Échéancier du devis en prestações ; complété par le solde quand les acomptes ne font pas 100 %. */
  private readonly prestacoes: Prestacao[]
  private readonly registo: { rotulo: string; valor: string } | null

  constructor(
    private readonly pdf: Pdf,
    private readonly police: string,
    private logo: Uint8Array | null,
    private readonly e: PdfV3Input,
  ) {
    this.devis = e.docType !== 'facture'
    this.regime = regimeEffectif(e)
    this.avecIva = this.regime === 'classique' && e.tvaEnabled
    this.chapitres = chapitresDocument(e)
    this.taux = [...new Set(this.chapitres.flatMap((c) => c.articles.map((a) => a.taux)))].sort((a, b) => b - a)
    this.prestacoes = prestacoesDoDevis(e.acomptesEnabled ? e.acomptes : [])
    this.registo = registoEmpresa(e.companyRCS)
  }

  async rendre() {
    this.entete(tituloDocumento(this.e), this.ligneProjet(), false)
    this.parties()
    this.meta(this.devis ? this.casesDevis() : this.casesFacture())
    this.tableau()
    this.totaux()
    if (this.devis) {
      this.encadre(this.paragraphesConditions(), true, 12)
      this.encadre(this.lignesBarrePaiement(), false, 10)
      this.rapportJoint()
      await this.signatures(false)
      await this.pageConditions()
      if (this.e.isHorsEtablissement && this.e.clientType === 'particulier') this.pageLivreResolucao()
    } else {
      this.encadre(this.paragraphesPaiementFacture(), true, 12)
      this.rapportJoint()
      this.petitTexte(this.notaFinal(), 10)
    }
    await this.annexePhotos()
    this.piedsDePage()
    const projet = tituloPersonalizado(this.e.docTitle)
    this.pdf.setProperties({
      title: `${tituloDocumento(this.e)} n.º ${textePdf(this.e.docNumber)} · ${projet || MARCA_METHOD}`,
      author: this.nomEmpresa(),
      subject: tituloDocumento(this.e),
    })
  }

  // ── Texte ──

  private fonte(taille: number, gras = false) {
    this.pdf.setFont(this.police, gras ? 'bold' : 'normal')
    this.pdf.setFontSize(taille)
  }

  private largeur(texte: string, taille: number, gras = false, espacement = 0): number {
    this.fonte(taille, gras)
    const espaces = espacement * Math.max(0, Array.from(texte).length - 1)
    if (this.police === POLICE) return this.pdf.getTextWidth(texte) + espaces
    // Helvetica (repli) : les largeurs internes de jsPDF sont arrondies (550 au lieu de 556 pour la
    // plupart des lettres), soit environ 1 % de moins que l'affichage des lecteurs PDF ; l'espace
    // insécable y vaut 530 au lieu de 278, et le crénage est compté mais jamais écrit. Mesure sans
    // crénage, insécable = espace, majorée de 1,5 % pour qu'aucune ligne ne déborde.
    const sansCrenage = { doKerning: false } as unknown as Parameters<Pdf['getStringUnitWidth']>[1]
    return this.pdf.getStringUnitWidth(texte.split(ESP).join(' '), sansCrenage) * taille * 1.015 + espaces
  }

  /** Une ligne de texte, avec l'espacement des lettres du gabarit ; `x` et `largeurZone` bornent l'alignement. */
  private ecrire(texte: string, x: number, base: number, o: { taille: number; gras?: boolean; couleur: string; espacement?: number; align?: Alignement; largeurZone?: number }) {
    const espacement = o.espacement ?? 0
    const l = this.largeur(texte, o.taille, o.gras, espacement)
    let xx = x
    if (o.align === 'centre') xx = x + ((o.largeurZone ?? 0) - l) / 2
    else if (o.align === 'droite') xx = x + (o.largeurZone ?? 0) - l
    this.pdf.setTextColor(o.couleur)
    this.pdf.text(texte, xx, base, espacement ? { charSpace: espacement } : undefined)
  }

  /** Coupe un texte à espacement de lettres (titres en capitales) en lignes de `largeurMax`. */
  private couperEspace(texte: string, largeurMax: number, taille: number, gras: boolean, espacement: number): string[] {
    const lignes: string[] = []
    let courante = ''
    for (const mot of texte.split(' ').filter(Boolean)) {
      const essai = courante ? `${courante} ${mot}` : mot
      if (courante && this.largeur(essai, taille, gras, espacement) > largeurMax) {
        lignes.push(courante)
        courante = mot
      } else {
        courante = essai
      }
    }
    if (courante) lignes.push(courante)
    return lignes.length > 0 ? lignes : ['']
  }

  /** Compose un texte mêlant gras et couleurs en lignes de `largeurMax` (coupure aux espaces, « \n » forcé). */
  private composer(fragments: Fragment[], largeurMax: number, taille: number, couleur: string): LigneComposee[] {
    const espace = this.largeur(' ', taille)
    return this.paragraphesDeMots(fragments, taille, couleur).flatMap((mots) =>
      this.lignesDuParagraphe(mots.flatMap((m) => this.couperMotLong(m, largeurMax, taille)), largeurMax, espace))
  }

  /** Mots de chaque paragraphe ; un mot peut réunir des bouts de styles différents écrits sans espace. */
  private paragraphesDeMots(fragments: Fragment[], taille: number, couleur: string): Mot[][] {
    const paragraphes: Mot[][] = [[]]
    let mot: Mot | null = null
    for (const f of fragments) {
      const gras = !!f.gras
      for (const morceau of f.texte.split(/(\n| +)/)) {
        if (morceau === '') continue
        if (morceau === '\n' || /^ +$/.test(morceau)) {
          // Séparateur : le mot en cours est fini ; « \n » ouvre aussi un nouveau paragraphe.
          if (morceau === '\n') paragraphes.push([])
          mot = null
          continue
        }
        const largeurMorceau = this.largeur(morceau, taille, gras)
        if (!mot) {
          mot = { bouts: [], largeur: 0 }
          paragraphes[paragraphes.length - 1].push(mot)
        }
        mot.bouts.push({ texte: morceau, gras, couleur: f.couleur ?? couleur, largeur: largeurMorceau })
        mot.largeur += largeurMorceau
      }
    }
    return paragraphes
  }

  /** Coupure gloutonne d'un paragraphe en lignes, comme le navigateur du gabarit (texte aligné à gauche). */
  private lignesDuParagraphe(mots: Mot[], largeurMax: number, espace: number): LigneComposee[] {
    const lignes: LigneComposee[] = []
    let ligne: LigneComposee = { bouts: [], largeur: 0 }
    for (const m of mots) {
      if (ligne.bouts.length > 0 && ligne.largeur + espace + m.largeur > largeurMax + TOLERANCE) {
        lignes.push(ligne)
        ligne = { bouts: [], largeur: 0 }
      }
      const avecEspace = ligne.bouts.length > 0
      let x = avecEspace ? ligne.largeur + espace : 0
      for (const [i, b] of m.bouts.entries()) {
        ligne.bouts.push({ ...b, x, espaceAvant: i === 0 && avecEspace })
        x += b.largeur
      }
      ligne.largeur = x
    }
    lignes.push(ligne)
    return lignes
  }

  /** Mot plus large que la ligne (adresse web, référence) : coupé entre deux caractères. */
  private couperMotLong(mot: Mot, largeurMax: number, taille: number): Mot[] {
    if (mot.largeur <= largeurMax) return [mot]
    const morceaux: Mot[] = []
    const ajouter = (b: Mot['bouts'][number], texte: string) => {
      const l = this.largeur(texte, taille, b.gras)
      morceaux.push({ bouts: [{ ...b, texte, largeur: l }], largeur: l })
    }
    for (const b of mot.bouts) {
      let tampon = ''
      for (const c of Array.from(b.texte)) {
        if (tampon && this.largeur(tampon + c, taille, b.gras) > largeurMax) {
          ajouter(b, tampon)
          tampon = c
        } else {
          tampon += c
        }
      }
      if (tampon) ajouter(b, tampon)
    }
    return morceaux
  }

  private dessinerLignes(lignes: LigneComposee[], x: number, haut: number, hauteurLigne: number, taille: number, align: Alignement = 'gauche', largeurZone = 0) {
    lignes.forEach((ligne, i) => {
      const base = haut + i * hauteurLigne + ligneDeBase(hauteurLigne, taille)
      let decalage = 0
      if (align === 'centre') decalage = (largeurZone - ligne.largeur) / 2
      else if (align === 'droite') decalage = largeurZone - ligne.largeur
      // Bouts consécutifs de même style écrits d'un seul tenant.
      let debut: Bout | null = null
      let texte = ''
      const ecrireSegment = () => {
        if (!debut || !texte) return
        this.fonte(taille, debut.gras)
        this.pdf.setTextColor(debut.couleur)
        this.pdf.text(texte, x + decalage + debut.x, base)
      }
      for (const b of ligne.bouts) {
        if (debut && b.gras === debut.gras && b.couleur === debut.couleur) {
          texte += (b.espaceAvant ? ' ' : '') + b.texte
        } else {
          ecrireSegment()
          debut = b
          texte = b.texte
        }
      }
      ecrireSegment()
    })
  }

  // ── Pages et marges ──

  private nouvellePage() {
    this.pdf.addPage()
    this.y = MARGE_HAUT
    this.margeEnAttente = 0
  }

  private enHautDePage() {
    return this.y <= MARGE_HAUT + TOLERANCE
  }

  /** Marge haute d'un bloc, fusionnée avec la marge basse du précédent comme en CSS ; nulle en haut de page. */
  private espacer(margeHaut: number) {
    if (!this.enHautDePage()) this.y += Math.max(margeHaut, this.margeEnAttente)
    this.margeEnAttente = 0
  }

  /** Comme `espacer`, en passant d'abord à la page suivante si `hauteur` ne tient plus. */
  private placer(margeHaut: number, hauteur: number) {
    const marge = this.enHautDePage() ? 0 : Math.max(margeHaut, this.margeEnAttente)
    if (!this.enHautDePage() && this.y + marge + hauteur > BAS_PAGE + TOLERANCE) this.nouvellePage()
    else this.y += marge
    this.margeEnAttente = 0
  }

  private finBloc(margeBas: number) {
    this.margeEnAttente = margeBas
  }

  /**
   * Bloc de lignes avec un fond (encadrés) ou sans (clauses, petites lignes). `insecable` : le bloc passe
   * entier à la page suivante s'il ne tient pas ; plus haut qu'une page, il est coupé entre deux lignes.
   */
  private placerBloc(elements: Element[], o: { margeHaut: number; margeBas: number; padHaut: number; padBas: number; insecable: boolean; fond?: (haut: number, hauteur: number) => void }) {
    const total = o.padHaut + somme(elements.map((el) => el.hauteur)) + o.padBas
    if (o.insecable && total <= BAS_PAGE - MARGE_HAUT) this.placer(o.margeHaut, total)
    else this.espacer(o.margeHaut)
    let i = 0
    while (i < elements.length) {
      if (!this.enHautDePage() && this.y + o.padHaut + elements[i].hauteur + o.padBas > BAS_PAGE + TOLERANCE) this.nouvellePage()
      const debut = this.y
      let hauteur = o.padHaut
      let j = i
      while (j < elements.length && debut + hauteur + elements[j].hauteur + o.padBas <= BAS_PAGE + TOLERANCE) {
        hauteur += elements[j].hauteur
        j++
      }
      if (j === i) {
        hauteur += elements[i].hauteur
        j = i + 1
      }
      hauteur += o.padBas
      o.fond?.(debut, hauteur)
      let haut = debut + o.padHaut
      for (let k = i; k < j; k++) {
        elements[k].dessiner(haut)
        haut += elements[k].hauteur
      }
      this.y = debut + hauteur
      i = j
      if (i < elements.length) this.nouvellePage()
    }
    this.finBloc(o.margeBas)
  }

  // ── Formes ──

  /** Encadré du gabarit : filet clair, bord haut épais couleur encre, coins arrondis (Empreiteiro, signatures). */
  private cadreHautFonce(x: number, y: number, l: number, h: number) {
    this.pdf.setDrawColor(COR.filet)
    this.pdf.setLineWidth(0.75)
    this.pdf.roundedRect(x + 0.375, y + 0.375, l - 0.75, h - 0.75, 3.6, 3.6, 'S')
    this.pdf.saveGraphicsState()
    this.pdf.roundedRect(x, y, l, h, 4, 4, null)
    this.pdf.clip()
    this.pdf.discardPath()
    this.pdf.setFillColor(COR.encre)
    this.pdf.rect(x, y, l, 2.2, 'F')
    this.pdf.restoreGraphicsState()
  }

  /** Fond crème arrondi, avec ou sans bord gauche or de 3 pt (bloc des conditions). */
  private fondCreme(x: number, y: number, l: number, h: number, bordOr: boolean) {
    if (!bordOr) {
      this.pdf.setFillColor(COR.creme)
      this.pdf.roundedRect(x, y, l, h, 4, 4, 'F')
      return
    }
    this.pdf.saveGraphicsState()
    this.pdf.roundedRect(x, y, l, h, 4, 4, null)
    this.pdf.clip()
    this.pdf.discardPath()
    this.pdf.setFillColor(COR.creme)
    this.pdf.rect(x, y, l, h, 'F')
    this.pdf.setFillColor(COR.or)
    this.pdf.rect(x, y, 3, h, 'F')
    this.pdf.restoreGraphicsState()
  }

  private filet(x1: number, y: number, x2: number, couleur: string, epaisseur: number) {
    this.pdf.setDrawColor(couleur)
    this.pdf.setLineWidth(epaisseur)
    this.pdf.line(x1, y, x2, y)
  }

  // ── Identité ──

  private nomEmpresa(): string {
    return textePdf(this.e.companyName).trim().replace(/(\S) (Lda\.?)$/i, `$1${ESP}$2`)
  }

  private nif(): string {
    return textePdf(this.e.companySiret).trim()
  }

  /** Sous le logo : la firma et l'alvará (à défaut le NIF), comme « firma · Alvará … » du gabarit. */
  private ligneLegale(): string {
    const nif = this.nif() ? `NIF ${this.nif()}` : ''
    const registo = this.registo ? `${this.registo.rotulo} ${this.registo.valor}` : nif
    return [this.nomEmpresa(), registo].filter(Boolean).join(' · ')
  }

  private textePied(): string {
    return [
      this.nomEmpresa(),
      this.nif() ? `NIF ${this.nif()}` : '',
      this.registo ? `${this.registo.rotulo} ${this.registo.valor}` : '',
      MARCA_METHOD,
    ].filter(Boolean).join(' · ')
  }

  private badge(): string {
    const numero = textePdf(this.e.docNumber).trim() || POINTILLES_COURTS
    return `N.º ${numero} · ${datePt(this.e.docDate) || POINTILLES_COURTS}`
  }

  /** Sous le titre : titre saisi pour le document, précisions des factures d'acompte, de situation et des notes de crédito. */
  private ligneProjet(): string[] {
    const e = this.e
    const premiere = [tituloPersonalizado(e.docTitle), ...detalheFatura(e)].filter(Boolean).join(' · ')
    const motif = e.docType === 'facture' && e.factureSubType === 'avoir' ? textePdf(e.avoirMotif).trim() : ''
    return [premiere, motif ? `Motivo: ${motif}` : ''].filter(Boolean)
  }

  // ── En-tête : logo, ligne légale, filet or, type de document, ligne du projet, badge du numéro ──

  private marque(compact: boolean) {
    const largeurLogo = compact ? 72 : 96
    if (this.logo) {
      const hauteur = largeurLogo * PROPORTION_LOGO
      try {
        this.pdf.addImage(this.logo, 'PNG', (PAGE_L - largeurLogo) / 2, this.y, largeurLogo, hauteur, 'logo-method-solucoes', 'FAST')
        this.y += hauteur + 4
        return
      } catch (erreur) {
        avertir('logo illisible, logotype en texte', erreur)
        this.logo = null
      }
    }
    // Logotype en texte, comme le générateur d'origine sans son fichier de logo.
    const taille = compact ? 15 : 21
    const espacement = compact ? 2.4 : 3.2
    const debut = 'METHOD '
    const fin = 'SOLUÇÕES'
    const total = this.largeur(debut + fin, taille, true, espacement)
    const x = (PAGE_L - total) / 2
    const hauteurLigne = taille * 1.05
    const base = this.y + ligneDeBase(hauteurLigne, taille)
    this.ecrire(debut, x, base, { taille, gras: true, couleur: COR.encre, espacement })
    this.ecrire(fin, x + this.largeur(debut, taille, true) + espacement * Array.from(debut).length, base, { taille, gras: true, couleur: COR.or, espacement })
    this.y += hauteurLigne + 2
    const hauteurLema = 6.8 * INTERLIGNE
    this.ecrire(LEMA_METHOD.toUpperCase(), MARGE_GAUCHE, this.y + ligneDeBase(hauteurLema, 6.8), { taille: 6.8, couleur: COR.or, espacement: 2.2, align: 'centre', largeurZone: LARGEUR })
    this.y += hauteurLema + 5
  }

  private entete(titre: string, projet: string[], compact: boolean) {
    this.marque(compact)
    const hauteurLegale = 7 * INTERLIGNE
    for (const ligne of this.couperEspace(this.ligneLegale().toUpperCase(), LARGEUR, 7, false, 1.4)) {
      this.ecrire(ligne, MARGE_GAUCHE, this.y + ligneDeBase(hauteurLegale, 7), { taille: 7, couleur: COR.gris, espacement: 1.4, align: 'centre', largeurZone: LARGEUR })
      this.y += hauteurLegale
    }
    this.y += 6
    this.pdf.setFillColor(COR.or)
    this.pdf.rect(PAGE_L / 2 - 23, this.y, 46, 2.4, 'F')
    this.y += 2.4 + 7
    const hauteurTitre = 18 * INTERLIGNE
    for (const ligne of this.couperEspace(titre.toUpperCase(), LARGEUR, 18, true, 4)) {
      this.ecrire(ligne, MARGE_GAUCHE, this.y + ligneDeBase(hauteurTitre, 18), { taille: 18, gras: true, couleur: COR.encre, espacement: 4, align: 'centre', largeurZone: LARGEUR })
      this.y += hauteurTitre
    }
    this.y += 4
    if (projet.length > 0) {
      const hauteurProjet = 8.6 * 1.3
      const lignes = this.composer([{ texte: insecables(projet.join('\n')) }], 440, 8.6, COR.gris)
      this.dessinerLignes(lignes, PAGE_L / 2 - 220, this.y, hauteurProjet, 8.6, 'centre', 440)
      this.y += lignes.length * hauteurProjet + 6
    }
    const badge = this.badge()
    const hauteurBadge = 9.2 * INTERLIGNE + 7
    const largeurBadge = this.largeur(badge, 9.2, true, 0.4) + 24
    this.pdf.setFillColor(COR.encre)
    this.pdf.roundedRect(PAGE_L / 2 - largeurBadge / 2, this.y, largeurBadge, hauteurBadge, 3, 3, 'F')
    this.ecrire(badge, PAGE_L / 2 - largeurBadge / 2 + 12, this.y + 3.5 + ligneDeBase(9.2 * INTERLIGNE, 9.2), { taille: 9.2, gras: true, couleur: COR.creme, espacement: 0.4 })
    this.y += hauteurBadge + 2
    this.finBloc(8)
  }

  // ── Empreiteiro / Dono de obra ──

  private lignesEmpresa(): Array<[string, Fragment[]]> {
    const e = this.e
    const simple = (v: string): Fragment[] => [{ texte: insecables(v) }]
    const lignes: Array<[string, Fragment[]]> = [
      ['Empresa', [{ texte: this.nomEmpresa(), gras: true }]],
      ['Marca', simple(`${MARCA_METHOD} · ${LEMA_METHOD}`)],
    ]
    if (this.nif()) lignes.push(['NIF', simple(this.nif())])
    if (this.registo) lignes.push([this.registo.rotulo, simple(this.registo.valor)])
    const capital = textePdf(e.companyCapital).trim()
    if (capital) lignes.push(['Capital', simple(/€|eur/i.test(capital) ? capital.replace(/\s*eur(os?)?\b/i, ' €') : `${capital} €`)])
    const cae = textePdf(e.companyAPE).trim()
    if (cae) lignes.push(['CAE', simple(cae)])
    const iva = textePdf(e.tvaNumber).trim()
    if (iva && iva.replace(/\D/g, '') !== this.nif().replace(/\D/g, '')) lignes.push(['N.º IVA', simple(iva)])
    const morada = moradaPt(e.companyAddress)
    if (morada) lignes.push(['Morada', simple(morada)])
    if (e.companyPhone) lignes.push(['Contacto', simple(textePdf(e.companyPhone))])
    if (e.companyEmail) lignes.push(['E-mail', simple(textePdf(e.companyEmail))])
    if (e.iban) lignes.push(['IBAN', simple(textePdf(e.iban))])
    if (e.bic) lignes.push(['BIC', simple(textePdf(e.bic))])
    return lignes
  }

  private localObra(): string {
    const e = this.e
    return [
      textePdf(e.interventionAddress).trim(),
      e.interventionBatiment ? `Edif. ${textePdf(e.interventionBatiment)}` : '',
      e.interventionEtage ? `Andar ${textePdf(e.interventionEtage)}` : '',
      e.interventionEspacesCommuns ? `Áreas comuns: ${textePdf(e.interventionEspacesCommuns)}` : '',
      e.interventionExterieur ? `Exterior: ${textePdf(e.interventionExterieur)}` : '',
    ].filter(Boolean).join(' · ')
  }

  /** Orçamento : Nome, NIF et Morada toujours présents (pointillés à remplir à la signature) ; fatura : seulement ce qui est saisi. */
  private lignesDono(): Array<[string, Fragment[]]> {
    const e = this.e
    const lignes: Array<[string, Fragment[]]> = []
    const ajouter = (rotulo: string, valeur: string, obligatoire: boolean) => {
      const v = textePdf(valeur).trim()
      if (v) lignes.push([rotulo, [{ texte: insecables(v) }]])
      else if (obligatoire) lignes.push([rotulo, [{ texte: POINTILLES, couleur: COR.pointilles }]])
    }
    ajouter('Nome', e.clientName, this.devis)
    ajouter('NIF', e.clientSiret, this.devis)
    ajouter('Morada', e.clientAddress, this.devis)
    ajouter('Local', this.localObra(), false)
    ajouter('Contacto', e.clientPhone, false)
    ajouter('E-mail', e.clientEmail, false)
    return lignes
  }

  private parties() {
    const ecart = 10
    const largeurBoite = (LARGEUR - ecart) / 2
    const largeurValeur = largeurBoite - 2 * 10.75 - 52
    const hauteurTitre = 7.2 * INTERLIGNE
    const blocs = [
      { titre: 'Empreiteiro', lignes: this.lignesEmpresa() },
      { titre: 'Dono de obra', lignes: this.lignesDono() },
    ].map((b) => ({
      titre: b.titre,
      lignes: b.lignes.map(([rotulo, valeur]) => ({ rotulo, composees: this.composer(valeur, largeurValeur, 8.4, COR.texte) })),
    }))
    const contenu = Math.max(...blocs.map((b) => hauteurTitre + 4 + somme(b.lignes.map((l) => l.composees.length * 12.6))))
    const hauteur = 2.2 + 6.5 + contenu + 6.5 + 0.75
    this.placer(10, hauteur)
    blocs.forEach((b, i) => {
      const x = MARGE_GAUCHE + i * (largeurBoite + ecart)
      this.cadreHautFonce(x, this.y, largeurBoite, hauteur)
      let haut = this.y + 2.2 + 6.5
      this.ecrire(b.titre.toUpperCase(), x + 10.75, haut + ligneDeBase(hauteurTitre, 7.2), { taille: 7.2, gras: true, couleur: COR.or, espacement: 1.2 })
      haut += hauteurTitre + 4
      for (const l of b.lignes) {
        this.ecrire(l.rotulo, x + 10.75, haut + ligneDeBase(12.6, 7.6), { taille: 7.6, couleur: COR.gris })
        this.dessinerLignes(l.composees, x + 10.75 + 52, haut, 12.6, 8.4)
        haut += l.composees.length * 12.6
      }
    })
    this.y += hauteur
    this.finBloc(8)
  }

  // ── Cases Data / Validade / Prazo / Pagamento ──

  private casesDevis(): Array<[string, string]> {
    const e = this.e
    const pagamento = this.prestacoes.length > 0 ? this.planoCurto() : prazoPagamento(e.paymentDue).curto
    // Sans délai, la date de début saisie reste visible (le modèle par défaut l'affiche dans sa propre case).
    const inicio = e.prestationDate ? `Início em ${datePt(e.prestationDate)}` : 'A combinar'
    return [
      ['Data', datePt(e.docDate) || POINTILLES_COURTS],
      ['Validade', this.validite()],
      ['Prazo de execução', prazoExecucao(e.executionDelay) || inicio],
      ['Pagamento', pagamento],
    ]
  }

  private casesFacture(): Array<[string, string]> {
    const e = this.e
    const cases: Array<[string, string]> = [
      ['Data', datePt(e.docDate) || POINTILLES_COURTS],
      ['Vencimento', vencimentoFatura(e.paymentDue, e.docDate) || POINTILLES_COURTS],
      ['Pagamento', modoPagamento(e.paymentMode).curto],
    ]
    if (e.prestationDate) cases.push(['Data dos trabalhos', datePt(e.prestationDate)])
    return cases
  }

  private meta(cases: Array<[string, string]>) {
    const ecart = 6
    const largeurCase = (LARGEUR - ecart * (cases.length - 1)) / cases.length
    const hauteurLibelle = 6.8 * INTERLIGNE
    const hauteurValeur = 8.6 * INTERLIGNE
    const valeurs = cases.map(([, v]) => this.composer([{ texte: insecables(v), gras: true }], largeurCase - 22, 8.6, COR.encre))
    const hauteur = 6.5 + hauteurLibelle + 2 + Math.max(...valeurs.map((v) => v.length)) * hauteurValeur + 6.5
    this.placer(6, hauteur)
    cases.forEach(([libelle], i) => {
      const x = MARGE_GAUCHE + i * (largeurCase + ecart)
      this.pdf.setFillColor(COR.creme)
      this.pdf.roundedRect(x, this.y, largeurCase, hauteur, 4, 4, 'F')
      this.ecrire(libelle.toUpperCase(), x + 11, this.y + 6.5 + ligneDeBase(hauteurLibelle, 6.8), { taille: 6.8, couleur: COR.gris, espacement: 1 })
      this.dessinerLignes(valeurs[i], x + 11, this.y + 6.5 + hauteurLibelle + 2, hauteurValeur, 8.6)
    })
    this.y += hauteur
    this.finBloc(8)
  }

  // ── Tableau des artigos ──

  private colonnes(): Colonnes {
    const avecRemise = this.chapitres.some((c) => c.articles.some((a) => a.remise))
    const avecTaux = this.avecIva && this.taux.length > 1
    // Largeurs du gabarit (30 / auto / 26 / 46 / 52 / 62 pt) ; la désignation prend le reste.
    const fixe = 30 + 26 + 46 + 52 + 62 + (avecRemise ? 48 : 0) + (avecTaux ? 32 : 0)
    let x = MARGE_GAUCHE
    const colonne = (titre: string, largeur: number, align: Alignement): Colonne => {
      const c = { titre, largeur, align, x }
      x += largeur
      return c
    }
    const art = colonne('Art.', 30, 'centre')
    const des = colonne('Designação dos trabalhos', LARGEUR - fixe, 'gauche')
    const un = colonne('Un.', 26, 'centre')
    const qt = colonne('Qt.', 46, 'droite')
    const pu = colonne('P. unit.', 52, 'droite')
    const desc = avecRemise ? colonne('Desc.', 48, 'droite') : undefined
    const iva = avecTaux ? colonne('IVA', 32, 'centre') : undefined
    const total = colonne('Total', 62, 'droite')
    return { art, des, un, qt, pu, desc, iva, total }
  }

  private listeColonnes(cols: Colonnes): Colonne[] {
    return [cols.art, cols.des, cols.un, cols.qt, cols.pu, cols.desc, cols.iva, cols.total].filter((c): c is Colonne => !!c)
  }

  private enteteTableau(cols: Colonnes) {
    this.pdf.setFillColor(COR.encre)
    this.pdf.rect(MARGE_GAUCHE, this.y, LARGEUR, HAUTEUR_ENTETE_TABLEAU, 'F')
    const base = this.y + 5 + ligneDeBase(7.2 * INTERLIGNE, 7.2)
    for (const c of this.listeColonnes(cols)) {
      this.ecrire(c.titre.toUpperCase(), c.x + 5, base, { taille: 7.2, gras: true, couleur: COR.creme, espacement: 0.9, align: c.align, largeurZone: c.largeur - 10 })
    }
    this.y += HAUTEUR_ENTETE_TABLEAU
  }

  private sautTableau(cols: Colonnes) {
    this.nouvellePage()
    this.enteteTableau(cols)
  }

  /** Valeur d'une colonne chiffrée, réduite si elle ne tient pas (le gabarit HTML élargissait la colonne). */
  private ecrireCellule(texte: string, c: Colonne | undefined, base: number, gras = false, couleur: string = COR.texte) {
    if (!c || !texte) return
    let taille = 8.4
    while (taille > 6 && this.largeur(texte, taille, gras) > c.largeur - 10) taille -= 0.2
    this.ecrire(texte, c.x + 5, base, { taille, gras, couleur, align: c.align, largeurZone: c.largeur - 10 })
  }

  private rangeeChapitre(ch: Chapitre, cols: Colonnes): Rangee {
    const hauteurLigne = 8.2 * INTERLIGNE
    const largeurTitre = cols.total.x + cols.total.largeur - cols.des.x - 10
    const lignes = this.couperEspace(ch.titre.toUpperCase(), largeurTitre, 8.2, true, 1)
    const hauteur = 6 + lignes.length * hauteurLigne + 6 + 1
    return {
      hauteur,
      liee: true,
      dessiner: () => {
        if (this.y + hauteur > BAS_PAGE + TOLERANCE) this.sautTableau(cols)
        this.pdf.setFillColor(COR.creme)
        this.pdf.rect(MARGE_GAUCHE, this.y, LARGEUR, hauteur, 'F')
        this.pdf.setFillColor(COR.or)
        this.pdf.rect(MARGE_GAUCHE, this.y + hauteur - 1, LARGEUR, 1, 'F')
        const base = this.y + 6 + ligneDeBase(hauteurLigne, 8.2)
        this.ecrire(String(ch.numero), cols.art.x + 5, base, { taille: 8.2, gras: true, couleur: COR.encre, espacement: 1, align: 'centre', largeurZone: cols.art.largeur - 10 })
        lignes.forEach((l, i) => {
          this.ecrire(l, cols.des.x + 5, base + i * hauteurLigne, { taille: 8.2, gras: true, couleur: COR.encre, espacement: 1 })
        })
        this.y += hauteur
      },
    }
  }

  /** Lignes de texte d'un artigo (titre, description, étapes numérotées), chacune dessinable seule. */
  private elementsArticle(a: Article, x: number, largeurTexte: number): Element[] {
    const elements: Element[] = []
    const hauteurTitre = 8.4 * INTERLIGNE
    const titre = this.composer([{ texte: insecables(a.titre), gras: true, couleur: COR.encre }], largeurTexte, 8.4, COR.encre)
    for (const ligne of titre) {
      elements.push({ hauteur: hauteurTitre, dessiner: (haut) => this.dessinerLignes([ligne], x, haut, hauteurTitre, 8.4) })
    }
    if (a.bloc) {
      const lignes = this.composer([{ texte: insecables(a.bloc) }], largeurTexte, 7.7, COR.gris)
      lignes.forEach((ligne, i) => {
        const marge = i === 0 ? 1.5 : 0
        elements.push({ hauteur: 10.4 + marge, dessiner: (haut) => this.dessinerLignes([ligne], x, haut + marge, 10.4, 7.7) })
      })
    }
    const xEtape = x + 14
    a.etapes.forEach((etape, n) => {
      const lignes = this.composer([{ texte: insecables(etape) }], largeurTexte - 14, 7.6, COR.etapes)
      lignes.forEach((ligne, i) => {
        const marge = n === 0 && i === 0 ? 2.5 : 0
        elements.push({
          hauteur: 10.2 + marge,
          dessiner: (haut) => {
            if (i === 0) this.ecrire(`${n + 1}.`, xEtape - 3, haut + marge + ligneDeBase(10.2, 7.6), { taille: 7.6, couleur: COR.etapes, align: 'droite', largeurZone: 0 })
            this.dessinerLignes([ligne], xEtape, haut + marge, 10.2, 7.6)
          },
        })
      })
    })
    return elements
  }

  private rangeeArticle(a: Article, cols: Colonnes, liee: boolean): Rangee {
    const elements = this.elementsArticle(a, cols.des.x + 5, cols.des.largeur - 10)
    const hauteur = PAD_ARTICLE + somme(elements.map((el) => el.hauteur)) + PAD_ARTICLE + 0.5
    const chiffres = (haut: number) => {
      const base = haut + PAD_ARTICLE + ligneDeBase(8.4 * INTERLIGNE, 8.4)
      this.ecrireCellule(a.code, cols.art, base)
      this.ecrireCellule(a.unite, cols.un, base)
      this.ecrireCellule(quantitePt(a.qt), cols.qt, base)
      this.ecrireCellule(quantitePt(a.pu), cols.pu, base)
      this.ecrireCellule(insecables(a.remise), cols.desc, base)
      this.ecrireCellule(`${pourcentPt(a.taux)} %`, cols.iva, base)
      this.ecrireCellule(nombrePt(a.total), cols.total, base)
    }
    const rangee: Rangee = {
      hauteur,
      liee,
      dessiner: () => {
        const capacite = BAS_PAGE - MARGE_HAUT - HAUTEUR_ENTETE_TABLEAU
        // Coupé sur place, l'artigo garde aussi la place de son sous-total sur la page de ses dernières lignes.
        const reserve = rangee.coupable ? (rangee.reserveApres ?? 0) : 0
        const besoin = hauteur + reserve
        if (this.y + besoin > BAS_PAGE + TOLERANCE && hauteur <= capacite && !rangee.coupable) this.sautTableau(cols)
        if (this.y + besoin > BAS_PAGE + TOLERANCE) {
          this.dessinerArticleCoupe(elements, cols, chiffres, rangee.reserveApres ?? 0)
          return
        }
        chiffres(this.y)
        let haut = this.y + PAD_ARTICLE
        for (const el of elements) {
          el.dessiner(haut)
          haut += el.hauteur
        }
        this.y += hauteur
        this.filet(MARGE_GAUCHE, this.y - 0.25, MARGE_GAUCHE + LARGEUR, COR.filet, 0.5)
      },
    }
    return rangee
  }

  /** Nombre d'éléments, à partir de `depuis`, qui tiennent sous le bord haut `haut` sans passer le bas de page. */
  private elementsQuiTiennent(elements: Element[], depuis: number, haut: number): number {
    let n = 0
    let bas = haut
    while (depuis + n < elements.length && bas + elements[depuis + n].hauteur <= BAS_PAGE + TOLERANCE) {
      bas += elements[depuis + n].hauteur
      n++
    }
    return n
  }

  /**
   * Artigo coupé entre deux lignes de texte (plus haut qu'une page, ou dans un groupe qui en dépasse une),
   * chiffres sur sa première partie. Comme le gabarit (orphans et widows à 2) : au moins deux lignes de
   * chaque côté d'une coupure, et la rangée liée qui suit (sous-total) reste avec les dernières lignes.
   */
  private dessinerArticleCoupe(elements: Element[], cols: Colonnes, chiffres: (haut: number) => void, reserveApres: number) {
    if (this.elementsQuiTiennent(elements, 0, this.y + PAD_ARTICLE) < Math.min(2, elements.length)) this.sautTableau(cols)
    chiffres(this.y)
    let i = 0
    while (i < elements.length) {
      let n = Math.max(1, this.elementsQuiTiennent(elements, i, this.y + PAD_ARTICLE))
      if (elements.length - i - n === 1 && n > 2) n -= 1
      const derniere = i + n === elements.length
      const bas = this.y + PAD_ARTICLE + somme(elements.slice(i, i + n).map((el) => el.hauteur)) + PAD_ARTICLE + 0.5
      // Dernières lignes : si le sous-total n'a plus la place, une ou deux lignes descendent avec lui.
      if (derniere && bas + reserveApres > BAS_PAGE + TOLERANCE && n > 2) n -= Math.min(2, n - 2)
      let haut = this.y + PAD_ARTICLE
      for (const el of elements.slice(i, i + n)) {
        el.dessiner(haut)
        haut += el.hauteur
      }
      i += n
      if (i < elements.length) this.sautTableau(cols)
      else this.y = haut + PAD_ARTICLE + 0.5
    }
    this.filet(MARGE_GAUCHE, this.y - 0.25, MARGE_GAUCHE + LARGEUR, COR.filet, 0.5)
  }

  /** Rangée « Subtotal do capítulo n » ; sans montant : rangée « Sem artigos. » d'un document vide. */
  private rangeeSousTotal(cols: Colonnes, libelle: string, montant: number | null): Rangee {
    const hauteur = PAD_ARTICLE + 8.4 * INTERLIGNE + PAD_ARTICLE + 0.5
    return {
      hauteur,
      liee: montant === null,
      dessiner: () => {
        if (this.y + hauteur > BAS_PAGE + TOLERANCE) this.sautTableau(cols)
        this.pdf.setFillColor(COR.sousTotal)
        this.pdf.rect(MARGE_GAUCHE, this.y, LARGEUR, hauteur, 'F')
        const base = this.y + PAD_ARTICLE + ligneDeBase(8.4 * INTERLIGNE, 8.4)
        this.ecrire(libelle, cols.des.x + 5, base, { taille: 8.4, gras: montant !== null, couleur: montant === null ? COR.gris : COR.encre })
        if (montant !== null) this.ecrireCellule(nombrePt(montant), cols.total, base, true, COR.encre)
        this.y += hauteur
        this.filet(MARGE_GAUCHE, this.y - 0.25, MARGE_GAUCHE + LARGEUR, COR.filet, 0.5)
      },
    }
  }

  private tableau() {
    const cols = this.colonnes()
    const rangees: Rangee[] = []
    for (const ch of this.chapitres) {
      rangees.push(this.rangeeChapitre(ch, cols))
      ch.articles.forEach((a, i) => rangees.push(this.rangeeArticle(a, cols, i === ch.articles.length - 1)))
      if (ch.articles.length === 0) rangees.push(this.rangeeSousTotal(cols, 'Sem artigos.', null))
      rangees.push(this.rangeeSousTotal(cols, `Subtotal do capítulo ${ch.numero}`, ch.sousTotal))
    }
    // Groupes insécables : titre de capítulo + premier artigo, dernier artigo + sous-total (tbody.grp du gabarit).
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
    const capacite = BAS_PAGE - MARGE_HAUT - HAUTEUR_ENTETE_TABLEAU
    // Groupe plus haut qu'une page : ses artigos sont coupés sur place, le titre du capítulo reste avec leurs
    // premières lignes et le sous-total avec leurs dernières (sinon titre seul en bas de page, sous-total seul en haut).
    for (const g of groupes) {
      if (somme(g.map((r) => r.hauteur)) > capacite) for (const r of g) r.coupable = true
    }
    rangees.forEach((r, i) => {
      if (r.liee && rangees[i + 1]) r.reserveApres = rangees[i + 1].hauteur
    })
    // Ce qui doit tenir sur la page pour commencer un groupe : le groupe entier ; s'il dépasse une page (artigo
    // très long, coupé ensuite entre ses lignes), son titre de capítulo et les premières lignes de l'artigo.
    const debutInsecable = (g: Rangee[]) => {
      const h = somme(g.map((r) => r.hauteur))
      if (h <= capacite) return h
      const premiere = g[0]?.hauteur ?? 0
      return premiere <= capacite ? premiere + DEBUT_ARTICLE_COUPE : DEBUT_ARTICLE_COUPE
    }
    this.placer(0, HAUTEUR_ENTETE_TABLEAU + debutInsecable(groupes[0] ?? []))
    this.enteteTableau(cols)
    for (const g of groupes) {
      if (this.y + debutInsecable(g) > BAS_PAGE + TOLERANCE) this.sautTableau(cols)
      for (const r of g) r.dessiner()
    }
    this.finBloc(0)
  }

  // ── Totaux ──

  private ventilation(): Array<{ rate: number; base: number; amount: number }> {
    const fournie = this.e.tvaBreakdown && this.e.tvaBreakdown.length > 0 ? this.e.tvaBreakdown : null
    if (fournie) return fournie.filter((t) => t.rate !== 0)
    return this.taux.filter((t) => t !== 0).map((rate) => {
      const base = sumMoney(this.chapitres.flatMap((c) => c.articles.filter((a) => a.taux === rate).map((a) => a.total)))
      return { rate, base, amount: round2((base * rate) / 100) }
    })
  }

  private remiseGlobale(): { libelle: string; montant: number; mentionBase: string } | null {
    const r = this.e.remiseGlobale
    if (!r || r.montantHT === 0) return null
    const libelle = textePdf(r.libelle).replace(/^remise commerciale/i, 'Desconto comercial') || 'Desconto comercial'
    const brut = this.e.totalHTBrut ?? this.e.subtotalHT
    const mentionBase = r.base !== undefined && r.base !== brut
      ? `sobre ${eurosPt(Math.abs(r.base))} de trabalhos, antes dos adiantamentos`
      : ''
    return { libelle, montant: r.montantHT, mentionBase }
  }

  /** Remise de l'ancien champ libre `discount` (anciens documents), déduite du total comme le modèle par défaut. */
  private ancienneRemise(): number {
    const parse = Number.parseFloat(String(this.e.discount || '').replace(',', '.').replace(/[^\d.-]/g, ''))
    return Number.isFinite(parse) && parse > 0 ? parse : 0
  }

  private libelleTotal(): string {
    if (this.regime !== 'classique') return 'Total a pagar'
    return this.avecIva ? 'Total c/IVA' : 'Total'
  }

  private totalAPayer(): number {
    return round2((this.avecIva ? this.e.totalTTC : this.e.subtotalHT) - this.ancienneRemise())
  }

  /** Lignes après les capítulos : remise, Total s/IVA, IVA (par taux), ancienne remise. */
  private lignesTotaux(): LigneTotal[] {
    const lignes: LigneTotal[] = []
    const remise = this.remiseGlobale()
    if (remise) {
      lignes.push({ libelle: remise.libelle, valeur: eurosPt(-remise.montant) })
      if (remise.mentionBase) lignes.push({ libelle: remise.mentionBase, valeur: '', petit: true })
    }
    lignes.push({ libelle: 'Total s/IVA', valeur: eurosPt(this.e.subtotalHT), gras: true })
    if (this.regime === 'autoliquidation_btp') {
      lignes.push({ libelle: 'IVA - autoliquidação', valeur: eurosPt(0) })
    } else if (this.regime === 'franchise_293b') {
      lignes.push({ libelle: 'IVA não aplicável (art. 53.º do CIVA)', valeur: eurosPt(0) })
    } else if (this.avecIva) {
      const ventilation = this.ventilation()
      for (const t of ventilation) {
        const libelle = ventilation.length > 1 ? `IVA ${pourcentPt(t.rate)} % s/ ${eurosPt(t.base)}` : `IVA ${pourcentPt(t.rate)} %`
        lignes.push({ libelle, valeur: eurosPt(t.amount) })
      }
    }
    if (this.ancienneRemise() > 0) lignes.push({ libelle: 'Desconto', valeur: `-${textePdf(this.e.discount)}` })
    return lignes
  }

  private totaux() {
    const n = this.chapitres.length
    const brut = this.remiseGlobale() ? (this.e.totalHTBrut ?? this.e.subtotalHT) : this.e.subtotalHT
    const lignes: LigneTotal[] = [
      { libelle: `Trabalhos (${n === 1 ? 'capítulo 1' : `capítulos 1 a ${n}`})`, valeur: eurosPt(brut) },
      ...this.lignesTotaux(),
    ]
    const largeurBoite = 236
    const x = MARGE_GAUCHE + LARGEUR - largeurBoite
    const hauteurLigne = 3 + 8.6 * INTERLIGNE + 3
    const hauteurTotal = 7 + 13.5 * INTERLIGNE + 7
    const hauteur = lignes.length * hauteurLigne + 4 + hauteurTotal
    this.placer(10, hauteur)
    lignes.forEach((l, i) => {
      const base = this.y + i * hauteurLigne + 3 + ligneDeBase(8.6 * INTERLIGNE, 8.6)
      this.ecrire(l.libelle, x + 9, base, { taille: l.petit ? 7 : 8.6, gras: l.gras, couleur: l.petit ? COR.gris : COR.texte })
      if (l.valeur) this.ecrire(insecables(l.valeur), x + 9, base, { taille: 8.6, gras: l.gras, couleur: COR.texte, align: 'droite', largeurZone: largeurBoite - 18 })
    })
    const haut = this.y + lignes.length * hauteurLigne + 4
    this.pdf.setFillColor(COR.encre)
    this.pdf.roundedRect(x, haut, largeurBoite, hauteurTotal, 4, 4, 'F')
    const hauteurInterieure = 13.5 * INTERLIGNE
    const baseLibelle = haut + 7 + (hauteurInterieure - 8.4 * INTERLIGNE) / 2 + ligneDeBase(8.4 * INTERLIGNE, 8.4)
    this.ecrire(this.libelleTotal(), x + 10, baseLibelle, { taille: 8.4, gras: true, couleur: COR.creme })
    this.ecrire(eurosPt(this.totalAPayer()), x + 10, haut + 7 + ligneDeBase(hauteurInterieure, 13.5), { taille: 13.5, gras: true, couleur: COR.valeurTotal, align: 'droite', largeurZone: largeurBoite - 20 })
    this.y = haut + hauteurTotal
    this.finBloc(0)
  }

  // ── Conditions, paiement ──

  private baseIvaPrestacoes(): string {
    return this.avecIva ? 'total c/IVA' : 'total'
  }

  /**
   * « acrescido de IVA à taxa legal de 23 % » : « legal » seulement pour les taux du continent portugais
   * (23, 13, 6 %). Le formulaire BTP les propose sur /pt depuis le 20/11/2026 ; un document d'avant peut porter
   * 20 %, qui n'est pas un taux légal portugais.
   */
  private texteIvaPrix(): string {
    if (this.regime === 'autoliquidation_btp') return 'com IVA em regime de autoliquidação'
    if (this.regime === 'franchise_293b') return 'sem IVA (artigo 53.º do CIVA)'
    if (!this.avecIva) return ''
    const legais = this.taux.length > 0 && this.taux.every((t) => TAXAS_IVA_PT.has(t))
    if (this.taux.length > 1) return `acrescido de IVA às taxas${legais ? ' legais' : ''} indicadas nos artigos`
    return `acrescido de IVA à taxa${legais ? ' legal' : ''} de ${pourcentPt(this.taux[0] ?? 0)} %`
  }

  /** « 5 semanas a contar da consignação », « a combinar, com início previsto em 01/12/2026 », ou ''. */
  private prazoComInicio(): string {
    const prazo = prazoExecucao(this.e.executionDelay)
    const inicio = this.e.prestationDate ? datePt(this.e.prestationDate) : ''
    if (prazo) return `${prazo} ${inicio ? `a contar de ${inicio}` : 'a contar da consignação'}`
    return inicio ? `a combinar, com início previsto em ${inicio}` : ''
  }

  /** « 50 / 30 / 20 » */
  private planoCurto(): string {
    return this.prestacoes.map((p) => pourcentPt(p.pct)).join(' / ')
  }

  private validite(): string {
    const v = this.e.docValidity
    return v ? `${v} ${v > 1 ? 'dias' : 'dia'}` : POINTILLES_COURTS
  }

  private modoComIban(): string {
    const modo = modoPagamento(this.e.paymentMode)
    return modo.curto === 'Transferência bancária' && this.e.iban ? 'por transferência bancária para o IBAN indicado' : modo.frase
  }

  /** Notes du document, libellés de Vitfix traduits ; sans la référence du devis quand elle est reprise à part. */
  private notes(sansReferenceDevis = false): Fragment[] | null {
    let notes = traduireLibellesGeneres(textePdf(this.e.notes)).trim()
    if (sansReferenceDevis) notes = notes.split('\n').filter((l) => !REFERENCE_ORCAMENTO.test(l)).join('\n').trim()
    return notes ? [{ texte: 'Notas', gras: true }, { texte: ` ${insecables(notes)}` }] : null
  }

  /** Bloc « Preço / Pagamento / Prazo / Validade » de la première page du devis. */
  private paragraphesConditions(): Fragment[][] {
    const e = this.e
    const iva = this.texteIvaPrix()
    const plano = this.prestacoes.length > 0
      ? juntar(this.prestacoes.map((p) => `${pourcentPt(p.pct)} % ${p.quando}`))
      : modoPagamento(e.paymentMode).frase
    const prazo = this.prazoComInicio()
    const paragraphes: Fragment[][] = [
      [
        { texte: 'Preço', gras: true },
        { texte: insecables(` de ${eurosPt(e.subtotalHT)}${iva ? ` ${iva}` : ''}, para a execução dos trabalhos descritos nos artigos, com materiais, mão de obra e equipamentos.`) },
      ],
      [
        { texte: 'Pagamento', gras: true },
        { texte: insecables(` ${plano}; faturas ${prazoPagamento(e.paymentDue).faturas}. `) },
        { texte: 'Prazo', gras: true },
        { texte: insecables(` ${prazo || 'a combinar'}. `) },
        { texte: 'Validade', gras: true },
        { texte: insecables(` ${this.validite()}. A assinatura e o carimbo do dono de obra valem adjudicação e aceitação das condições gerais, em duplicado.`) },
      ],
    ]
    const complements = [descontoPagamento(e.paymentCondition), jurosDeMora(e.penaltyRate)].filter(Boolean)
    if (complements.length > 0) paragraphes.push([{ texte: insecables(complements.join(' ')) }])
    const notes = this.notes()
    if (notes) paragraphes.push(notes)
    return paragraphes
  }

  /** Barre « Pagamento 50 / 30 / 20 · 1.ª prestação … » et IBAN. */
  private lignesBarrePaiement(): Fragment[][] {
    const e = this.e
    const iban = textePdf(e.iban).trim()
    const bic = textePdf(e.bic).trim()
    if (this.prestacoes.length > 0) {
      // Même base et même arrondi que l'échéancier du modèle par défaut : la dernière prestação prend le reste.
      const base = this.avecIva ? e.totalTTC : e.subtotalHT
      const montants = computeAcomptesAmounts(base, this.prestacoes.map((p) => ({ pourcentage: p.pct })))
      const prestacoes = montants.map((m, i) => `${i + 1}.ª prestação ${eurosPt(m)}`.replace(/ /g, ESP)).join(' · ')
      return [
        [{ texte: insecables(`Pagamento ${this.planoCurto()}`), gras: true }, { texte: ` · ${prestacoes}` }],
        [{ texte: insecables(iban ? `IBAN ${iban} · prestações sobre o ${this.baseIvaPrestacoes()}` : `Prestações sobre o ${this.baseIvaPrestacoes()}`) }],
      ]
    }
    const lignes: Fragment[][] = [
      [{ texte: 'Pagamento', gras: true }, { texte: insecables(` ${modoPagamento(e.paymentMode).frase} · faturas ${prazoPagamento(e.paymentDue).faturas}`) }],
    ]
    if (iban) lignes.push([{ texte: insecables(`IBAN ${iban}${bic ? ` · BIC ${bic}` : ''}`) }])
    return lignes
  }

  /** Bloc de paiement d'une facture : mode, échéance, IBAN, retard, devis d'origine, notes. */
  private paragraphesPaiementFacture(): Fragment[][] {
    const e = this.e
    const vencimento = vencimentoFatura(e.paymentDue, e.docDate)
    const echeance = /^\d/.test(vencimento) ? `vencimento em ${vencimento}` : `vencimento ${vencimento.toLowerCase() || 'a combinar'}`
    const paragraphes: Fragment[][] = [
      [{ texte: 'Pagamento', gras: true }, { texte: insecables(` ${this.modoComIban()}; ${echeance}.`) }],
    ]
    const iban = textePdf(e.iban).trim()
    const bic = textePdf(e.bic).trim()
    if (iban) paragraphes.push([{ texte: 'IBAN', gras: true }, { texte: insecables(` ${iban}${bic ? ` · BIC ${bic}` : ''}`) }])
    paragraphes.push([{
      texte: insecables([
        descontoPagamento(e.paymentCondition),
        'Em caso de mora aplicam-se os juros legais e, sendo o adquirente empresa ou profissional, a indemnização de custos de cobrança do Decreto-Lei n.º 62/2013.',
        jurosDeMora(e.penaltyRate),
      ].filter(Boolean).join(' ')),
    }])
    // Devis d'origine : champ du document, sinon la référence que Vitfix écrit dans les notes d'une facture
    // émise depuis un devis signé (« Réf. devis : … », « Ref. orçamento: … »).
    const notes = traduireLibellesGeneres(textePdf(e.notes))
    const reference = notes.split('\n').map((l) => REFERENCE_ORCAMENTO.exec(l)?.[1]?.trim()).find(Boolean)
    const origine = textePdf(e.sourceDevisRef).trim() || reference || ''
    if (origine) paragraphes.push([{ texte: insecables(`Fatura relativa ao orçamento n.º ${origine}.`) }])
    const blocNotes = this.notes(!!origine)
    if (blocNotes) paragraphes.push(blocNotes)
    return paragraphes
  }

  /** Encadré crème du gabarit : `bordOr` = bloc des conditions (.cond), sinon barre de paiement (.paybar). */
  private encadre(paragraphes: Fragment[][], bordOr: boolean, margeHaut: number) {
    if (paragraphes.length === 0) return
    const taille = 8
    const hauteurLigne = taille * INTERLIGNE
    const gauche = MARGE_GAUCHE + 11 + (bordOr ? 3 : 0)
    const largeurTexte = LARGEUR - 22 - (bordOr ? 3 : 0)
    const elements: Element[] = []
    paragraphes.forEach((p) => {
      const lignes = this.composer(p, largeurTexte, taille, COR.texte)
      lignes.forEach((ligne, i) => {
        // .cond p { margin-bottom: 3pt } ; la barre de paiement n'a que des retours à la ligne.
        const apres = bordOr && i === lignes.length - 1 ? 3 : 0
        elements.push({ hauteur: hauteurLigne + apres, dessiner: (haut) => this.dessinerLignes([ligne], gauche, haut, hauteurLigne, taille) })
      })
    })
    const pad = bordOr ? 8 : 6
    this.placerBloc(elements, {
      margeHaut, margeBas: 0, padHaut: pad, padBas: pad, insecable: true,
      fond: (haut, hauteur) => this.fondCreme(MARGE_GAUCHE, haut, LARGEUR, hauteur, bordOr),
    })
  }

  private rapportJoint() {
    const r = this.e.attachedRapport
    if (!r) return
    const horaire = [r.startTime ? `das ${textePdf(r.startTime)}` : '', r.endTime ? `às ${textePdf(r.endTime)}` : ''].filter(Boolean).join(' ')
    const lignes: Fragment[][] = [[{ texte: insecables(`Relatório de intervenção n.º ${textePdf(r.rapportNumber)} anexo a este documento`), gras: true }]]
    if (r.interventionDate) lignes.push([{ texte: `Intervenção de ${datePt(r.interventionDate)}${horaire ? ` ${horaire}` : ''}` }])
    if (r.motif) lignes.push([{ texte: `Motivo: ${textePdf(r.motif)}` }])
    if (r.siteAddress) lignes.push([{ texte: `Local: ${textePdf(r.siteAddress)}` }])
    this.encadre(lignes, false, 10)
  }

  // ── Signatures ──

  private async signatures(grand: boolean) {
    const ecart = 12
    const largeurBoite = (LARGEUR - ecart) / 2
    const interieur = largeurBoite - 22 - 1.5
    const hauteurTitre = 7.2 * INTERLIGNE
    const hauteurNom = 8.1 * INTERLIGNE
    const nomDono = textePdf(this.e.clientName).trim()
    const noms = [
      [...this.composer([{ texte: this.nomEmpresa(), gras: true }], interieur, 8.1, COR.texte), ...this.composer([{ texte: MARCA_METHOD }], interieur, 8.1, COR.texte)],
      this.composer([nomDono ? { texte: nomDono } : { texte: POINTILLES, couleur: COR.pointilles }], interieur, 8.1, COR.texte),
    ]
    const lignesNom = Math.max(2, ...noms.map((n) => n.length))
    const hauteurCachet = (grand ? 84 : 46) + 6.8 * INTERLIGNE + 3 + 1.4
    const hauteurTrait = 13 + 0.7 + 2 + 6.9 * INTERLIGNE
    const hauteurTraits = grand ? 2 * hauteurTrait + 7 : hauteurTrait
    const hauteur = 2.2 + 7 + hauteurTitre + 2 + lignesNom * hauteurNom + 6 + hauteurCachet + 5 + hauteurTraits + 9 + 0.75
    // Signature électronique du client (petite variante, première page) : dans le cachet du dono de obra.
    const signature = grand ? null : this.e.signatureData
    let imageSignature: string | null = null
    if (signature) {
      try {
        imageSignature = await this.e.svgToImageDataUrl(signature.svg_data, 400, 140)
      } catch (erreur) {
        avertir('signature illisible', erreur)
        imageSignature = null
      }
    }
    this.placer(8, hauteur)
    const titres = ['Pela empresa', 'Pelo dono de obra']
    const libellesNom = ['Nome do representante', 'Nome']
    for (let i = 0; i < 2; i++) {
      const x = MARGE_GAUCHE + i * (largeurBoite + ecart)
      const xi = x + 11.75
      this.cadreHautFonce(x, this.y, largeurBoite, hauteur)
      let haut = this.y + 2.2 + 7
      this.ecrire(titres[i].toUpperCase(), xi, haut + ligneDeBase(hauteurTitre, 7.2), { taille: 7.2, gras: true, couleur: COR.or, espacement: 1.2 })
      haut += hauteurTitre + 2
      this.dessinerLignes(noms[i], xi, haut, hauteurNom, 8.1)
      haut += lignesNom * hauteurNom + 6
      const signatureDono = i === 1 ? signature : null
      this.cachet(xi, haut, interieur, hauteurCachet, signatureDono ? imageSignature : null, !!signatureDono)
      haut += hauteurCachet + 5
      if (grand) {
        this.traitSignature(xi, interieur, libellesNom[i], '', haut)
        this.traitSignature(xi, interieur, 'Data', '', haut + hauteurTrait + 7)
      } else {
        this.traitSignature(xi, interieur - 10 - 74, libellesNom[i], signatureDono ? textePdf(signatureDono.signataire) : '', haut)
        this.traitSignature(xi + interieur - 74, 74, 'Data', signatureDono ? datePt(textePdf(signatureDono.timestamp)) : '', haut)
      }
      if (signatureDono?.hash_sha256) {
        this.ecrire(`SHA-256 ${textePdf(signatureDono.hash_sha256).slice(0, 32)}...`, xi, haut + hauteurTraits + 6.5, { taille: 4.5, couleur: COR.cachetTexte })
      }
    }
    this.y += hauteur
    this.finBloc(0)
  }

  /** Cadre en pointillés « assinatura e carimbo » ; avec une signature électronique, son image et sa mention. */
  private cachet(x: number, haut: number, largeur: number, hauteur: number, image: string | null, electronique: boolean) {
    this.pdf.setDrawColor(COR.cachet)
    this.pdf.setLineWidth(0.7)
    this.pdf.setLineDashPattern([2.1, 2.1], 0)
    this.pdf.roundedRect(x + 0.35, haut + 0.35, largeur - 0.7, hauteur - 0.7, 4, 4, 'S')
    this.pdf.setLineDashPattern([], 0)
    const hauteurLegende = 6.8 * INTERLIGNE
    if (image) {
      const hImage = Math.min(hauteur - hauteurLegende - 8, ((largeur - 20) * 140) / 400)
      const lImage = (hImage * 400) / 140
      try {
        this.pdf.addImage(image, 'PNG', x + (largeur - lImage) / 2, haut + 4, lImage, hImage, undefined, COMPRESSION_PNG)
      } catch (erreur) {
        avertir('signature non dessinée', erreur)
      }
    }
    const legende = electronique ? 'assinatura eletrónica simples (art. 25.º, n.º 1, eIDAS)' : 'assinatura e carimbo'
    this.ecrire(legende, x, haut + hauteur - 0.7 - 3 - hauteurLegende + ligneDeBase(hauteurLegende, 6.8), {
      taille: electronique ? 6 : 6.8, couleur: COR.cachetTexte, espacement: 0.6, align: 'centre', largeurZone: largeur,
    })
  }

  /** Trait à remplir à la main (« Nome », « Data »), avec la valeur déjà connue au-dessus. */
  private traitSignature(x: number, largeur: number, libelle: string, valeur: string, haut: number) {
    if (valeur) this.ecrire(valeur, x, haut + 10, { taille: 8.1, couleur: COR.texte })
    this.filet(x, haut + 13.35, x + largeur, COR.ligneSignature, 0.7)
    this.ecrire(libelle, x, haut + 13.7 + 2 + ligneDeBase(6.9 * INTERLIGNE, 6.9), { taille: 6.9, couleur: COR.gris })
  }

  // ── Page des conditions (orçamento) ──

  private titreSection(texte: string, garderAvecSuite = 32) {
    const taille = 9.8
    const hauteurLigne = taille * INTERLIGNE
    const lignes = this.couperEspace(texte.toUpperCase(), LARGEUR, taille, true, 1.6)
    const hauteur = lignes.length * hauteurLigne + 2 + 1.6
    this.placer(13, hauteur + garderAvecSuite)
    let largeurMax = 0
    lignes.forEach((l, i) => {
      this.ecrire(l, MARGE_GAUCHE, this.y + i * hauteurLigne + ligneDeBase(hauteurLigne, taille), { taille, gras: true, couleur: COR.encre, espacement: 1.6 })
      largeurMax = Math.max(largeurMax, this.largeur(l, taille, true, 1.6))
    })
    this.pdf.setFillColor(COR.or)
    this.pdf.rect(MARGE_GAUCHE, this.y + lignes.length * hauteurLigne + 2, largeurMax, 1.6, 'F')
    this.y += hauteur
    this.finBloc(6)
  }

  private tableauResume() {
    const rangees: Array<{ libelle: string; valeur: string; total?: boolean }> = this.chapitres.map((c) => ({
      libelle: `${c.numero} · ${c.titre}`,
      valeur: eurosPt(c.sousTotal),
    }))
    for (const l of this.lignesTotaux()) {
      if (!l.petit) rangees.push({ libelle: l.libelle, valeur: l.valeur, total: l.libelle === 'Total s/IVA' })
    }
    rangees.push({ libelle: this.libelleTotal(), valeur: eurosPt(this.totalAPayer()), total: true })
    this.espacer(4)
    const hauteurLigne = 8 * INTERLIGNE
    for (const r of rangees) {
      const valeur = insecables(r.valeur)
      const largeurValeur = this.largeur(valeur, 8, r.total)
      const lignes = this.composer([{ texte: insecables(r.libelle), gras: r.total, couleur: r.total ? COR.encre : COR.texte }], LARGEUR - 20 - largeurValeur, 8, COR.texte)
      const hauteur = 3 + lignes.length * hauteurLigne + 3 + 0.5
      if (!this.enHautDePage() && this.y + hauteur > BAS_PAGE + TOLERANCE) this.nouvellePage()
      if (r.total) {
        this.pdf.setFillColor(COR.creme)
        this.pdf.rect(MARGE_GAUCHE, this.y, LARGEUR, hauteur, 'F')
      }
      this.dessinerLignes(lignes, MARGE_GAUCHE + 5, this.y + 3, hauteurLigne, 8)
      this.ecrire(valeur, MARGE_GAUCHE + 5, this.y + 3 + ligneDeBase(hauteurLigne, 8), { taille: 8, gras: r.total, couleur: r.total ? COR.encre : COR.texte, align: 'droite', largeurZone: LARGEUR - 10 })
      this.y += hauteur
      this.filet(MARGE_GAUCHE, this.y - 0.25, MARGE_GAUCHE + LARGEUR, COR.filet, 0.5)
    }
    this.finBloc(6)
  }

  /** Clause « Pagamento » des conditions générales, avec l'échéancier, le délai et le mode du devis. */
  private clausePagamento(): string {
    const e = this.e
    const doTotal = this.avecIva ? 'do total c/IVA' : 'do total'
    const plano = this.prestacoes.length > 0
      ? `${this.prestacoes.map((p, i) => `${pourcentPt(p.pct)} %${i === 0 ? ` ${doTotal}` : ''} ${p.quando}`).join('; ')}.`
      : `Pagamento ${doTotal} contra fatura.`
    return majuscule(`${plano} Faturas ${prazoPagamento(e.paymentDue).vencimento}, ${this.modoComIban()}. Em caso de mora aplicam-se os juros legais e, sendo o dono de obra empresa ou profissional, a indemnização de custos de cobrança do Decreto-Lei n.º 62/2013. O empreiteiro pode suspender os trabalhos após 15 dias de atraso no pagamento, sem prejuízo do prazo.`)
  }

  private clauses(): Array<[string, string]> {
    const prazo = this.prazoComInicio()
    return [
      ['Objeto', 'Execução, em regime de empreitada (artigos 1207.º e seguintes do Código Civil), dos trabalhos descritos nos artigos deste orçamento, na obra identificada na página 1, para o dono de obra identificado na página 1, de acordo com os artigos e as condições deste orçamento.'],
      ['Inclui', 'Fornecimento de todos os materiais, mão de obra, equipamentos, ferramentas e consumíveis necessários aos trabalhos descritos nos artigos; deslocações e transportes; proteção das zonas contíguas; limpeza do local de trabalho e remoção dos resíduos de construção com guia de acompanhamento.'],
      ['Não inclui', 'Trabalhos de outras especialidades; licenças, taxas e seguros do dono de obra; projetos e honorários técnicos; ligações provisórias de água e eletricidade e respetivos consumos; tudo o que não esteja escrito nos artigos.'],
      ['Preço e medição', 'Os preços unitários e o valor deste orçamento são fixos para os trabalhos e as quantidades descritos nos artigos. Os trabalhos a mais ou a menos, pedidos por escrito, são medidos em obra e valorizados pelos mesmos preços unitários; trabalhos de outra natureza ou imprevistos são orçamentados e aprovados por escrito antes da execução. Os preços não são revisíveis durante o prazo contratual.'],
      ['Pagamento', this.clausePagamento()],
      ['Prazo', majuscule(`${prazo || 'A combinar entre as partes antes do início dos trabalhos'}. Não contam para o prazo os dias de intempérie que impeçam os trabalhos, as paragens ordenadas pelo dono de obra e os atrasos em fornecimentos ou decisões a cargo do dono de obra.`)],
      ['Execução e qualidade', 'Trabalhos executados segundo as regras da arte, a regulamentação aplicável e as instruções dos fabricantes dos materiais. As dúvidas e incoerências do projeto ou do pedido são esclarecidas por escrito antes da execução do trabalho em causa.'],
      ['Alterações', 'Qualquer alteração aos trabalhos descritos só é executada com acordo escrito do dono de obra, com o preço e o efeito no prazo previamente aceites.'],
      ['Obrigações do dono de obra', 'Assegurar o acesso ao local e o espaço necessário aos trabalhos, entregar as licenças e autorizações exigíveis, disponibilizar água e energia no local e pagar pontualmente as prestações.'],
      ['Segurança', 'O empreiteiro cumpre o Decreto-Lei n.º 273/2003 e a Lei n.º 41/2015, mantém em obra a documentação dos trabalhadores e subempreiteiros (seguro de acidentes de trabalho, declarações da Autoridade Tributária e da Segurança Social) e é responsável pela segurança dos seus meios.'],
      ['Garantia', 'Garantia legal sobre os trabalhos executados, a contar da receção provisória, nos termos do artigo 1225.º do Código Civil e, sendo o dono de obra consumidor, do Decreto-Lei n.º 84/2021. Ficam excluídos os defeitos resultantes de alterações ou intervenções posteriores de terceiros, de uso inadequado, de falta de manutenção e de materiais fornecidos pelo dono de obra.'],
      ['Receção', 'Concluídos os trabalhos, o dono de obra convoca a vistoria no prazo de 8 dias; lavra-se o auto de receção provisória. A falta de comparência ou de resposta no prazo vale receção sem reservas. A receção definitiva ocorre no fim do prazo de garantia.'],
      ['Resolução e litígios', 'Cada parte pode resolver o contrato por incumprimento grave da outra, após interpelação escrita com prazo de 15 dias para cumprir. Em caso de resolução, os trabalhos executados são medidos e pagos, bem como os materiais encomendados para a obra. Lei aplicável: portuguesa. Foro: comarca da situação da obra, com renúncia a qualquer outro, sem prejuízo das regras imperativas aplicáveis a consumidores.'],
      ['Proteção de dados', 'Os dados pessoais recolhidos destinam-se exclusivamente à gestão da empreitada e à faturação, nos termos do Regulamento (UE) 2016/679 e da Lei n.º 58/2019, e são conservados pelo prazo legal.'],
    ]
  }

  private conditionsGenerales() {
    const taille = 8
    const hauteurLigne = taille * 1.33
    this.espacer(2)
    this.clauses().forEach(([titre, texte], i) => {
      const lignes = this.composer(
        [{ texte: `${i + 1} · ${titre}`, gras: true, couleur: COR.encre }, { texte: ` · ${insecables(texte)}` }],
        LARGEUR, taille, COR.texte,
      )
      // Coupure de page comme le gabarit (orphans et widows à 2) : jamais une ligne seule en bas ou en haut de page.
      let tiennent = Math.max(0, Math.floor((BAS_PAGE + TOLERANCE - this.y) / hauteurLigne))
      if (tiennent < lignes.length) {
        if (lignes.length - tiennent < 2) tiennent = lignes.length - 2
        if (tiennent < 2 && !this.enHautDePage()) {
          this.nouvellePage()
          tiennent = Math.floor((BAS_PAGE + TOLERANCE - this.y) / hauteurLigne)
        }
      }
      lignes.forEach((ligne, n) => {
        const deborde = this.y + hauteurLigne > BAS_PAGE + TOLERANCE
        if ((n === tiennent || deborde) && !this.enHautDePage()) this.nouvellePage()
        this.dessinerLignes([ligne], MARGE_GAUCHE, this.y, hauteurLigne, taille)
        this.y += hauteurLigne
      })
      this.y += 4
    })
    this.finBloc(4)
  }

  /** Petites lignes finales : mentions d'IVA, assurance, médiation, origine du document. */
  private notaFinal(): string {
    return [
      this.mentionIva(),
      this.mentionSeguro(),
      this.mentionMediacao(),
      `Documento gerado por Vitfix Pro em ${dateDuJour()}.`,
    ].filter(Boolean).join(' ')
  }

  /**
   * Mention d'IVA du gabarit. La mention conditionnelle de la verba 2.42.1 (IVA 6 %) dépend d'une option que le
   * formulaire n'a pas (construction destinée à l'habitation) : elle n'est pas reprise.
   */
  private mentionIva(): string {
    const autoliquidacao = '«IVA - autoliquidação»'
    const alinea = 'alínea j) do n.º 1 do artigo 2.º do CIVA'
    if (this.regime === 'autoliquidation_btp') {
      return this.devis
        ? `IVA devido pelo adquirente nos termos da ${alinea}; a fatura é emitida com a menção ${autoliquidacao}.`
        : `IVA - autoliquidação: IVA devido pelo adquirente nos termos da ${alinea}.`
    }
    if (this.regime === 'franchise_293b') return getMentionLegale('franchise_293b', 'pt') ?? ''
    if (!this.avecIva) return ''
    const taux = this.taux.length > 1 ? 'IVA às taxas indicadas nos artigos' : `IVA à taxa de ${pourcentPt(this.taux[0] ?? 0)} %`
    if (!this.devis) return `${taux}.`
    return `${taux}; caso o dono de obra seja sujeito passivo de IVA nas condições da ${alinea}, aplica-se a inversão do sujeito passivo e a fatura é emitida com a menção ${autoliquidacao}.`
  }

  private mentionSeguro(): string {
    const e = this.e
    const seguradora = textePdf(e.insuranceName).trim()
    if (!seguradora) return ''
    const tipo = TIPOS_SEGURO[e.insuranceType] ?? TIPOS_SEGURO.rc_pro
    const apolice = textePdf(e.insuranceNumber).trim()
    const cobertura = textePdf(e.insuranceCoverage).trim()
    return `${tipo}: ${seguradora}${apolice ? `, apólice n.º ${apolice}` : ''}${cobertura ? `, cobertura ${cobertura}` : ''}.`
  }

  /** Médiation de la consommation, pour un particulier seulement (comme le modèle par défaut). */
  private mentionMediacao(): string {
    const mediador = textePdf(this.e.mediatorName).trim()
    if (this.e.clientType !== 'particulier' || !mediador) return ''
    const url = textePdf(this.e.mediatorUrl).trim()
    return `Resolução alternativa de litígios (Lei n.º 144/2015): ${mediador}${url ? `, ${url}` : ''}.`
  }

  private petitTexte(texte: string, margeHaut: number) {
    const taille = 6.9
    const lignes = this.composer([{ texte: insecables(texte) }], LARGEUR, taille, COR.gris)
    this.placerBloc(
      lignes.map((ligne) => ({ hauteur: 9.4, dessiner: (haut: number) => this.dessinerLignes([ligne], MARGE_GAUCHE, haut, 9.4, taille) })),
      { margeHaut, margeBas: 0, padHaut: 0, padBas: 0, insecable: true },
    )
  }

  private async pageConditions() {
    this.nouvellePage()
    this.entete('Condições da proposta', this.ligneProjet(), true)
    this.titreSection('Resumo do preço por capítulo')
    this.tableauResume()
    this.titreSection('Condições gerais')
    this.conditionsGenerales()
    // Grande variante : cachet et traits à remplir à la main.
    await this.signatures(true)
    this.petitTexte(this.notaFinal(), 10)
  }

  // ── Livre resolução (particulier, contrat hors établissement) ──

  private paragraphes(paragraphes: Fragment[][], margeHaut: number) {
    const taille = 8.4
    const hauteurLigne = taille * INTERLIGNE
    const elements: Element[] = []
    paragraphes.forEach((p) => {
      const lignes = this.composer(p, LARGEUR, taille, COR.texte)
      lignes.forEach((ligne, i) => elements.push({
        hauteur: hauteurLigne + (i === lignes.length - 1 ? 4 : 0),
        dessiner: (haut) => this.dessinerLignes([ligne], MARGE_GAUCHE, haut, hauteurLigne, taille),
      }))
    })
    this.placerBloc(elements, { margeHaut, margeBas: 0, padHaut: 0, padBas: 0, insecable: false })
  }

  private pageLivreResolucao() {
    const e = this.e
    this.nouvellePage()
    this.entete('Direito de livre resolução', ['Artigo 10.º do Decreto-Lei n.º 24/2014'], true)
    this.paragraphes([
      [{ texte: 'O cliente dispõe de um prazo de 14 dias de calendário, a contar da assinatura do presente orçamento, para exercer o seu direito de livre resolução, sem necessidade de justificação nem de pagamento de penalidades.' }],
      [{ texte: 'Para exercer este direito, o cliente pode utilizar o formulário abaixo ou enviar qualquer declaração inequívoca em que manifeste a sua vontade de resolver o contrato.' }],
      [{ texte: 'Nenhum pagamento pode ser exigido antes do termo do prazo de 7 dias a contar da assinatura, salvo trabalhos urgentes expressamente solicitados pelo cliente.' }],
    ], 10)
    this.titreSection('Renúncia ao prazo de livre resolução')
    this.paragraphes([[{ texte: 'Caso o cliente solicite expressamente o início dos trabalhos antes do termo do prazo de 14 dias de livre resolução, declara reconhecer que perderá esse direito assim que o serviço for integralmente prestado (artigo 17.º, n.º 1, alínea a), do Decreto-Lei n.º 24/2014).' }]], 0)
    for (const choix of ['Sim, solicito o início imediato dos trabalhos e renuncio ao prazo de livre resolução.', 'Não.']) {
      this.placer(4, 14)
      this.pdf.setDrawColor(COR.encre)
      this.pdf.setLineWidth(0.7)
      this.pdf.rect(MARGE_GAUCHE, this.y + 2, 8, 8, 'S')
      this.ecrire(choix, MARGE_GAUCHE + 14, this.y + ligneDeBase(12, 8.4), { taille: 8.4, couleur: COR.texte })
      this.y += 14
    }
    this.titreSection('Formulário de livre resolução')
    const atencao = [
      [this.nomEmpresa(), moradaPt(e.companyAddress)].filter(Boolean).join(', '),
      e.companyPhone ? `Tel.${ESP}${textePdf(e.companyPhone)}` : '',
      e.companyEmail ? textePdf(e.companyEmail) : '',
    ].filter(Boolean).join(' · ')
    this.paragraphes([
      [{ texte: 'À atenção de:', gras: true }, { texte: ` ${insecables(atencao)}` }],
      [{ texte: 'Pela presente notifico a minha resolução do contrato relativo à prestação de serviços supra.' }],
    ], 0)
    for (const champ of ['Encomendado em / recebido em', 'Nome do cliente', 'Morada', 'Data', 'Assinatura']) {
      this.placer(6, 20)
      const libelle = `${champ}:`
      this.ecrire(libelle, MARGE_GAUCHE, this.y + 14, { taille: 8.4, couleur: COR.texte })
      this.filet(MARGE_GAUCHE + this.largeur(libelle, 8.4) + 6, this.y + 15, MARGE_GAUCHE + LARGEUR, COR.ligneSignature, 0.7)
      this.y += 20
    }
    this.finBloc(0)
  }

  // ── Annexe photos ──

  private async annexePhotos() {
    const photos = this.e.selectedPhotos || []
    if (photos.length === 0) return
    const images = await Promise.all(photos.map((p) => chargerImageJpeg(p.url)))
    this.nouvellePage()
    this.entete('Anexo fotográfico', [`${photos.length} ${photos.length > 1 ? 'fotografias' : 'fotografia'} da obra`], true)
    const ecart = 12
    const largeurPhoto = (LARGEUR - ecart) / 2
    const hauteurPhoto = 170
    const hauteurLegende = 3 * 6.8 * INTERLIGNE + 4
    for (let i = 0; i < photos.length; i += 2) {
      this.placer(i === 0 ? 10 : 12, hauteurPhoto + hauteurLegende)
      for (let c = 0; c < 2 && i + c < photos.length; c++) {
        const photo = photos[i + c]
        const image = images[i + c]
        const x = MARGE_GAUCHE + c * (largeurPhoto + ecart)
        this.pdf.setDrawColor(COR.filet)
        this.pdf.setLineWidth(0.75)
        this.pdf.roundedRect(x, this.y, largeurPhoto, hauteurPhoto, 4, 4, 'S')
        if (image) {
          const echelle = Math.min((largeurPhoto - 8) / image.largeur, (hauteurPhoto - 8) / image.hauteur)
          const l = image.largeur * echelle
          const h = image.hauteur * echelle
          this.pdf.addImage(image.donnees, 'JPEG', x + (largeurPhoto - l) / 2, this.y + (hauteurPhoto - h) / 2, l, h)
        } else {
          this.ecrire('Fotografia indisponível', x, this.y + hauteurPhoto / 2, { taille: 7.4, couleur: COR.gris, align: 'centre', largeurZone: largeurPhoto })
        }
        const legende = [
          photo.label ? textePdf(photo.label) : '',
          photo.taken_at ? `Data: ${new Date(photo.taken_at).toLocaleString('pt-PT')}` : '',
          photo.lat && photo.lng ? `GPS: ${Number(photo.lat).toFixed(5)}, ${Number(photo.lng).toFixed(5)}` : '',
        ].filter(Boolean)
        legende.forEach((texte, n) => {
          this.ecrire(texte, x + 2, this.y + hauteurPhoto + 4 + n * 6.8 * INTERLIGNE + ligneDeBase(6.8 * INTERLIGNE, 6.8), { taille: 6.8, gras: n === 0 && !!photo.label, couleur: COR.gris })
        })
      }
      this.y += hauteurPhoto + hauteurLegende
    }
    this.finBloc(0)
  }

  // ── Pieds de page : identité de la société à gauche, « Página X de Y » à droite ──

  private piedsDePage() {
    const total = this.pdf.getNumberOfPages()
    const gauche = this.textePied()
    const base = PAGE_H - MARGE_BAS / 2 + 0.3465 * 6.8
    for (let p = 1; p <= total; p++) {
      this.pdf.setPage(p)
      const droite = `Página ${p} de ${total}`
      const largeurDroite = this.largeur(droite, 6.8)
      let taille = 6.8
      while (taille > 5 && this.largeur(gauche, taille) > LARGEUR - largeurDroite - 16) taille -= 0.2
      this.ecrire(gauche, MARGE_GAUCHE, base, { taille, couleur: COR.gris })
      this.ecrire(droite, MARGE_GAUCHE, base, { taille: 6.8, couleur: COR.gris, align: 'droite', largeurZone: LARGEUR })
    }
  }
}

// ─── Ressources ───────────────────────────────────────────────────────────────

async function chargerOctets(url: string): Promise<Uint8Array | null> {
  try {
    const reponse = await fetch(url)
    if (!reponse.ok) {
      avertir(`ressource absente : ${url}`, new Error(`HTTP ${reponse.status}`))
      return null
    }
    return new Uint8Array(await reponse.arrayBuffer())
  } catch (erreur) {
    avertir(`ressource absente : ${url}`, erreur)
    return null
  }
}

function enBase64(octets: Uint8Array): string {
  let binaire = ''
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000))
  }
  return btoa(binaire)
}

/** Liberation Sans (Unicode, police du gabarit) ; Helvetica si elle ne se charge pas. */
async function chargerPolice(pdf: Pdf): Promise<string> {
  const [normale, grasse] = await Promise.all([chargerOctets(URL_POLICE_METHOD), chargerOctets(URL_POLICE_METHOD_GRAS)])
  if (!normale || !grasse) return 'helvetica'
  try {
    pdf.addFileToVFS('LiberationSans-Regular.ttf', enBase64(normale))
    pdf.addFont('LiberationSans-Regular.ttf', POLICE, 'normal')
    pdf.addFileToVFS('LiberationSans-Bold.ttf', enBase64(grasse))
    pdf.addFont('LiberationSans-Bold.ttf', POLICE, 'bold')
    return POLICE
  } catch (erreur) {
    avertir('police illisible, Helvetica', erreur)
    return 'helvetica'
  }
}

/** Photo du chantier en JPEG (navigateur seulement) ; null si elle ne se charge pas en 20 s. */
async function chargerImageJpeg(url: string): Promise<{ donnees: string; largeur: number; hauteur: number } | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      const minuterie = setTimeout(() => reject(new Error('délai dépassé')), 20000)
      img.onload = () => { clearTimeout(minuterie); resolve(img) }
      img.onerror = () => { clearTimeout(minuterie); reject(new Error('image illisible')) }
      img.src = url
    })
    const echelle = Math.min(1, 2000 / Math.max(image.width, image.height, 1))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * echelle))
    canvas.height = Math.max(1, Math.round(image.height * echelle))
    const contexte = canvas.getContext('2d')
    if (!contexte) return null
    fondBlancAvantJpeg(contexte, canvas.width, canvas.height)
    contexte.drawImage(image, 0, 0, canvas.width, canvas.height)
    return { donnees: canvas.toDataURL('image/jpeg', 0.9), largeur: canvas.width, hauteur: canvas.height }
  } catch (erreur) {
    avertir('photo non chargée', erreur)
    return null
  }
}

// ─── Entrées ──────────────────────────────────────────────────────────────────

/** Dessine le devis ou la facture au gabarit Method Soluções ; `e` est l'entrée déjà nettoyée du générateur V3. */
export async function rendreDocumentMethodSolucoes(JsPdf: ConstructeurPdf, e: PdfV3Input): Promise<Pdf> {
  const pdf = new JsPdf({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const [police, logo] = await Promise.all([chargerPolice(pdf), chargerOctets(URL_LOGO_METHOD)])
  await new DocumentMethod(pdf, police, logo, e).rendre()
  return pdf
}

/** « Orcamento_DEV-2026-001_Nome_do_cliente.pdf », « Fatura_… », « Nota_de_credito_… ». */
export function nomFichierMethodSolucoes(e: Pick<PdfV3Input, 'docType' | 'factureSubType' | 'docNumber' | 'clientName'>): string {
  const libelleFacture = e.factureSubType === 'avoir' ? 'Nota_de_credito' : 'Fatura'
  const libelle = e.docType === 'facture' ? libelleFacture : 'Orcamento'
  const client = (e.clientName || '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_À-ÿ]/g, '') || 'Cliente'
  return `${libelle}_${e.docNumber}_${client}.pdf`
}
