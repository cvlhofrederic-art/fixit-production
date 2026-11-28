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
 * Les traductions sont celles du gabarit Method (lib/pdf/modele-method-solucoes.ts), sauf les unités, abrégées pour
 * la colonne étroite du tableau. Un texte saisi librement qui ne correspond à aucune valeur connue reste tel quel.
 * Module chargé à la demande, pour les seuls documents portugais.
 */
import type { DevisAcompte, ProductLine } from '@/lib/devis-types'
import type { PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import {
  descontoPagamento,
  modoPagamento,
  nomeCapitulo,
  prazoExecucao,
  quandoPrestacao,
  textePdf,
  traduireLibellesGeneres,
} from '@/lib/pdf/modele-method-solucoes'

const sansAccents = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/œ/g, 'oe').replace(/[’`]/g, "'").toLowerCase().trim()

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

export function modoPagamentoPt(mode: string): string {
  return mode.trim() ? siTraduit(mode, modoPagamento(mode).curto) : mode
}

export function descontoPt(escompte: string): string {
  return escompte.trim() ? siTraduit(escompte, descontoPagamento(escompte)) : escompte
}

export function prazoExecucaoPt(delai: string): string {
  return delai.trim() ? siTraduit(delai, prazoExecucao(delai)) : delai
}

/** Pénalités de retard par défaut du formulaire français → valeur par défaut du formulaire portugais. */
export function penalidadePt(penalite: string): string {
  return /^3\s*(?:×|x|fois)\s*(?:le\s+)?taux d'interet legal/.test(sansAccents(penalite)) ? 'Taxa de juro legal em vigor' : penalite
}

/** Nom de section posé par le formulaire ou par Vitfix (« Main d'œuvre », « Acomptes déjà facturés (à déduire) »…). */
export function seccaoPt(nom: string | undefined): string | undefined {
  return nom?.trim() ? siTraduit(nom, nomeCapitulo(nom, false)) : nom
}

/** Déclencheur d'un acompte (« À la signature »…) : « na adjudicação »… */
export function quandoPt(declencheur: string): string {
  return declencheur.trim() ? siTraduit(declencheur, quandoPrestacao(declencheur)) : declencheur
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

const lignesPt = (lignes: ProductLine[] | undefined) => lignes?.map(lignePt)

function acomptePt(a: DevisAcompte): DevisAcompte {
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
    penaltyRate: penalidadePt(e.penaltyRate),
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
