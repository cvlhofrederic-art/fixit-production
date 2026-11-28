/**
 * Document BTP portugais au modèle par défaut (lib/pdf/devis-pdf-v3.ts) : valeurs enregistrées en français,
 * traduites avant le rendu.
 *
 * Le formulaire BTP enregistre ses listes en français quelle que soit la langue (mode et délai de paiement,
 * escompte, déclencheur d'acompte, unité… : voir lib/devis-btp-traduction.ts), et les documents créés avant la
 * PR #860 portent aussi les libellés que Vitfix rédigeait en français (titre d'une facture d'acompte ou de solde,
 * lignes d'acompte, sections, remise). Les gabarits Method Soluções et Vitfix les traduisaient déjà ; le modèle par
 * défaut les imprimait tels quels : « Virement bancaire », « Aucun escompte accordé pour paiement anticipé »,
 * « 3 semaines », « Main d'œuvre »… sur une fatura portugaise (constat de Frédéric du 28/11/2026, FA-2026-001).
 *
 * Valeurs des listes du formulaire (mode de paiement, escompte, déclencheur d'acompte) : traduction EXACTE, celle
 * que le formulaire affiche en portugais (lib/devis-btp-traduction-pt.json). Libellés rédigés par Vitfix, sections et
 * délai d'exécution : motifs ancrés du gabarit Method (lib/pdf/modele-method-solucoes.ts). Unités : abrégées pour la
 * colonne étroite du tableau. Un texte saisi librement qui n'est pas exactement une de ces valeurs reste tel quel.
 * Module chargé à la demande, pour les seuls documents portugais.
 */
import type { DevisAcompte, ProductLine } from '@/lib/devis-types'
import { TEXTES_DEVIS_BTP_PT } from '@/lib/devis-btp-traduction'
import type { PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import { nomeCapitulo, prazoExecucao, textePdf, traduireLibellesGeneres } from '@/lib/pdf/modele-method-solucoes'

/** Valeur d'une liste du formulaire BTP, enregistrée en français → son libellé portugais du formulaire, à l'identique. */
function valeurListePt(valeur: string): string {
  const v = valeur.trim()
  return Object.prototype.hasOwnProperty.call(TEXTES_DEVIS_BTP_PT, v) ? TEXTES_DEVIS_BTP_PT[v] : valeur
}

/** La traduction si elle change le texte (tirets longs et point final mis à part), sinon le texte d'origine. */
function siTraduit(original: string, traduction: string): string {
  const neutre = (s: string) => textePdf(s).trim().replace(/\.$/, '')
  return neutre(traduction) === neutre(original) ? original : traduction
}

/** Unités du formulaire (UNITES_TABLEAU), en abrégé portugais : la colonne du tableau fait 8 % de la largeur. */
const UNIDADES_CURTAS: Readonly<Record<string, string>> = {
  u: 'un', pce: 'pç', ens: 'cj', lot: 'lote', sac: 'saco', rl: 'rolo', palette: 'pal.', benne: 'cont.',
  camion: 'cam.', j: 'dia', jour: 'dia', semaine: 'sem', f: 'vg', forfait: 'vg', tonne: 't', L: 'l',
}

export function unidadeCurta(unite: string): string {
  return Object.prototype.hasOwnProperty.call(UNIDADES_CURTAS, unite) ? UNIDADES_CURTAS[unite] : unite
}

/** Texte de plusieurs lignes (notes, désignation) : chaque libellé rédigé par Vitfix est traduit, le reste gardé. */
export function libellesPt(texte: string): string {
  return texte.split('\n').map((ligne) => siTraduit(ligne, traduireLibellesGeneres(textePdf(ligne)))).join('\n')
}

/** Mode de paiement (MODES_PAIEMENT) : « Virement bancaire » → « Transferência bancária ». */
export const modoPagamentoPt = valeurListePt

/** Escompte (ESCOMPTES) : « Aucun escompte accordé pour paiement anticipé » → « Sem desconto por pagamento antecipado ». */
export const descontoPt = valeurListePt

/**
 * Escompte d'une fatura portugaise, une fois traduit : « aucun » (il répète la phrase par défaut du PDF), « accorde »
 * (un escompte de la liste, que la phrase par défaut « sem desconto » contredirait), null (texte libre).
 */
export function escompteDaLista(escompte: string): 'aucun' | 'accorde' | null {
  const v = escompte.trim()
  if (v === TEXTES_DEVIS_BTP_PT['Aucun escompte accordé pour paiement anticipé']) return 'aucun'
  const accordes = [TEXTES_DEVIS_BTP_PT['1 % pour paiement à 10 jours'], TEXTES_DEVIS_BTP_PT['2 % pour paiement comptant']]
  return accordes.includes(v) ? 'accorde' : null
}

export function prazoExecucaoPt(delai: string): string {
  return delai.trim() ? siTraduit(delai, prazoExecucao(delai)) : delai
}

/** Valeurs par défaut du formulaire français (pénalités, frais de recouvrement) → celles du formulaire portugais. */
const DEFAUTS_PT: Readonly<Record<string, string>> = {
  "3 × taux d'intérêt légal en vigueur": 'Taxa de juro legal em vigor',
  "3 × taux d'intérêt légal": 'Taxa de juro legal em vigor',
  '40 € (BtoB uniquement)': '40 € (apenas B2B)',
}

export function valeurParDefautPt(valeur: string): string {
  const v = valeur.trim()
  return Object.prototype.hasOwnProperty.call(DEFAUTS_PT, v) ? DEFAUTS_PT[v] : valeur
}

/** Nom de section posé par le formulaire ou par Vitfix (« Main d'œuvre », « Acomptes déjà facturés (à déduire) »…). */
export function seccaoPt(nom: string | undefined): string | undefined {
  return nom?.trim() ? siTraduit(nom, nomeCapitulo(nom, false)) : nom
}

/**
 * Déclencheur d'un acompte (DECLENCHEURS_ACOMPTE) : libellé du formulaire, première lettre en minuscule pour la
 * ligne de l'échéancier (« Adiantamento 1 : 30% na adjudicação »). Les libellés du gabarit Method (« no final,
 * contra auto de receção provisória ») sont trop longs pour cette ligne et y ajoutent une condition.
 */
export function quandoPt(declencheur: string): string {
  const traduit = valeurListePt(declencheur)
  return traduit === declencheur ? declencheur : traduit.charAt(0).toLowerCase() + traduit.slice(1)
}

/** Titres que Vitfix rédige (facture d'acompte, de solde) ou titres par défaut, dans la forme portugaise de Vitfix. */
const TITRES: Array<[RegExp, (m: RegExpExecArray) => string]> = [
  [/^Acompte n° (\d+) sur (\d+) \(([^)]*)\)(.*)$/, (m) => `Adiantamento n.º ${m[1]} de ${m[2]} (${m[3]})${m[4]}`],
  [/^Facture de solde(.*)$/, (m) => `Fatura de saldo${m[1]}`],
  [/^Facture d'acompte(.*)$/, (m) => `Fatura de adiantamento${m[1]}`],
  [/^Facture n° (\S+)$/, (m) => `Fatura n.º ${m[1]}`],
  [/^Devis n° (\S+)$/, (m) => `Orçamento n.º ${m[1]}`],
  [/^Avoir n° (\S+)$/, (m) => `Nota de crédito n.º ${m[1]}`],
  // Avoir créé depuis la liste des factures (components/dashboard/FacturesSection.tsx), titre écrit en français
  [/^AVOIR sur facture (\S+)( \(annulation partielle\))?$/, (m) => `Nota de crédito sobre a fatura ${m[1]}${m[2] ? ' (anulação parcial)' : ''}`],
  [/^Situation n° (\d+)(.*)$/, (m) => `Situação n.º ${m[1]}${m[2]}`],
  [/^Facture$/, () => 'Fatura'],
  [/^Devis$/, () => 'Orçamento'],
  [/^Avoir$/, () => 'Nota de crédito'],
]

export function tituloPt(titre: string): string {
  const t = titre.trim()
  for (const [motif, traduction] of TITRES) {
    const m = motif.exec(t)
    if (m) return traduction(m)
  }
  return titre
}

/** Libellé de la remise globale (lib/remise-commerciale.ts) : « Remise commerciale (5 %) » → « Desconto comercial (5 %) ». */
export function remisePt(libelle: string): string {
  return libelle.replace(/^Remise commerciale/, 'Desconto comercial')
}

function lignePt(l: ProductLine): ProductLine {
  return { ...l, description: libellesPt(l.description || ''), unit: l.unit === 'autre' ? l.unit : unidadeCurta(l.unit) }
}

// Une ligne absente (null dans un document abîmé) reste telle quelle : le générateur l'ignore déjà.
const lignesPt = (lignes: ProductLine[] | undefined) => lignes?.map((l) => (l ? lignePt(l) : l))

function acomptePt(a: DevisAcompte): DevisAcompte {
  if (!a) return a
  const label = /^Acompte (\d+)$/.exec(a.label?.trim() || '')
  return { ...a, label: label ? `Adiantamento ${label[1]}` : a.label, declencheur: quandoPt(a.declencheur || '') }
}

/** Entrée du générateur V3 d'un document portugais, valeurs enregistrées en français traduites. */
export function portugaliserEntreeV3(e: PdfV3Input): PdfV3Input {
  return {
    ...e,
    docTitle: tituloPt(e.docTitle),
    paymentMode: modoPagamentoPt(e.paymentMode),
    paymentCondition: descontoPt(e.paymentCondition),
    penaltyRate: valeurParDefautPt(e.penaltyRate),
    recoveryFee: valeurParDefautPt(e.recoveryFee),
    executionDelay: prazoExecucaoPt(e.executionDelay),
    notes: libellesPt(e.notes || ''),
    lines: lignesPt(e.lines) ?? e.lines,
    laborLines: lignesPt(e.laborLines),
    materialLines: lignesPt(e.materialLines),
    fraisLines: lignesPt(e.fraisLines),
    linesName: seccaoPt(e.linesName),
    materialLinesName: seccaoPt(e.materialLinesName),
    fraisLinesName: seccaoPt(e.fraisLinesName),
    customTables: e.customTables?.map((ct) => ({ ...ct, name: seccaoPt(ct.name) ?? ct.name, lines: lignesPt(ct.lines) ?? ct.lines })),
    acomptes: e.acomptes?.map(acomptePt),
    remiseGlobale: e.remiseGlobale ? { ...e.remiseGlobale, libelle: remisePt(e.remiseGlobale.libelle) } : e.remiseGlobale,
  }
}
