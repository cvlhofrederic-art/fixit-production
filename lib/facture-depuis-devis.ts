// Émission directe d'une facture à partir d'un devis (côté BTP Pro uniquement).
//
// « Facturer → Facture totale » transforme le devis en facture sans repasser par le
// formulaire : mêmes champs que la conversion historique (useBookings.convertDevisToFacture),
// mêmes contrôles que la validation du formulaire BTP (client, montant, régime de TVA), et
// déduction automatique des acomptes déjà facturés sur ce devis, taux de TVA par taux — la
// TVA d'un acompte est facturée à son émission, la facture finale ne porte que le reliquat
// et fait référence aux factures d'acompte (BOI-TVA-DECLA-30-20-20-10 §60).
//
// Aucune relecture n'a lieu avant l'attribution du numéro : tout ce qui rendrait le montant
// douteux (devis non validé, facture déjà émise sur ce devis, acomptes qui couvrent tout ou
// ne correspondent plus au devis) fait l'objet d'un refus explicite plutôt que d'une facture
// fausse. Les mêmes garde-fous s'appliquent à l'acompte émis en un clic depuis le devis.

import {
  additionnerBases,
  basesHtParTaux,
  buildAcompteLinesParTaux,
  dateDuJourLocale,
  formaterDateCourte,
  formaterMontantCents,
  formaterNombre,
  recalculerTotauxLignes,
  regimeTvaEffectif,
  totalBasesCents,
  transformerLignes,
  type AcomptesDejaFactures,
  type BaseParTaux,
} from '@/lib/acompte-par-taux'
import { devisLinkFields } from '@/lib/devis-utils'
import { REGIME_ERROR_MESSAGES, validateRegime, type TvaLocale } from '@/lib/tva-calculator'

type DocumentLike = Record<string, unknown>

export type ErreurFactureDepuisDevis =
  | 'devis_non_valide'
  | 'devis_refuse'
  | 'client_manquant'
  | 'montant_nul'
  | 'prestation_future'
  | 'deja_facture'
  | 'situations_emises'
  | 'regime_tva'
  | 'acomptes_couvrent_le_devis'
  | 'acomptes_depassent_le_devis'
  | 'acomptes_incoherents'

export type ResultatFactureDepuisDevis =
  | { ok: true; payload: DocumentLike; acomptesDeduits: DocumentLike[]; totalHtCents: number }
  | { ok: false; erreur: ErreurFactureDepuisDevis; message: string }

export type ErreurAcompteSurDevis =
  | 'devis_non_valide'
  | 'devis_refuse'
  | 'client_manquant'
  | 'regime_tva'
  | 'acompte_deja_facture'
  | 'acompte_depasse_le_devis'
  | 'acompte_incoherent'

export type ResultatControleAcompte = { ok: true } | { ok: false; erreur: ErreurAcompteSurDevis; message: string }

export interface OptionsFactureDepuisDevis {
  /** Factures connues (émises ou non) : repère la facture déjà émise et les acomptes du devis. */
  factures: DocumentLike[]
  locale?: TvaLocale
  /** Date du jour AAAA-MM-JJ (injectable pour les tests). Défaut : aujourd'hui, heure du poste. */
  aujourdHui?: string
}

/** Identifiant de la table des déductions (stable : une seule par facture). */
export const ID_TABLE_ACOMPTES_DEDUITS = 'acomptes-deduits'

const sousType = (doc: DocumentLike): string => String(doc.factureSubType || 'standard')

const estFacture = (doc: DocumentLike): boolean => doc.docType === 'facture' || doc.docType === 'avoir'

/** Numéro définitif : présent, et pas un numéro provisoire de brouillon (« BR-… »). */
export const aNumeroDefinitif = (doc: DocumentLike): boolean => {
  const numero = String(doc.docNumber || '').trim()
  return numero !== '' && !numero.toUpperCase().startsWith('BR-')
}

/**
 * Document réellement émis : numéro définitif, ni brouillon, ni annulé. Un brouillon de facture
 * passé à « envoyé » depuis la liste (sans numéro) n'est pas une facture émise.
 */
const estEmis = (doc: DocumentLike): boolean => {
  const statut = String(doc.status || '')
  return aNumeroDefinitif(doc) && statut !== '' && !['brouillon', 'draft', 'cancelled', 'annule'].includes(statut)
}

const estAvoir = (doc: DocumentLike): boolean => sousType(doc) === 'avoir' || doc.docType === 'avoir'

const estLieAuDevis = (facture: DocumentLike, devis: DocumentLike): boolean =>
  (!!devis.docNumber && facture.sourceDevisNumber === devis.docNumber) ||
  (!!devis.id && facture.sourceDevisId === devis.id)

const avoirsEmisSur = (facture: DocumentLike, factures: DocumentLike[]): DocumentLike[] =>
  facture.docNumber ? factures.filter((f) => estAvoir(f) && estEmis(f) && f.parentInvoiceNumber === facture.docNumber) : []

/**
 * Bases restant facturées sur une facture, taux par taux, après ses avoirs émis (un avoir
 * porte des lignes négatives). Un avoir partiel ne retire que sa part.
 */
export function basesNettesApresAvoirs(facture: DocumentLike, factures: DocumentLike[]): BaseParTaux[] {
  return additionnerBases(basesHtParTaux(facture), ...avoirsEmisSur(facture, factures).map(basesHtParTaux))
}

/**
 * Une facture entièrement créditée ne compte plus (ni « déjà facturé », ni acompte à déduire).
 * Sans avoir, elle compte toujours — même si ses lignes ne sont pas connues (document résumé).
 */
const resteFacturee = (facture: DocumentLike, factures: DocumentLike[]): boolean =>
  avoirsEmisSur(facture, factures).length === 0 || totalBasesCents(basesNettesApresAvoirs(facture, factures)) > 0

const estAcompteDuDevis = (facture: DocumentLike, devis: DocumentLike): boolean =>
  sousType(facture) === 'acompte' &&
  // Acompte émis depuis le devis (parentInvoiceNumber) ou depuis le formulaire (lien devis seul).
  ((!!devis.docNumber && facture.parentInvoiceNumber === devis.docNumber) || estLieAuDevis(facture, devis))

/**
 * Factures émises sur ce devis autrement qu'en acompte (facture totale, facture de situation)
 * et encore facturées après avoirs : une nouvelle facture totale ferait double emploi.
 */
export function facturesEmisesPourDevis(devis: DocumentLike, factures: DocumentLike[]): DocumentLike[] {
  return factures.filter(
    (f) =>
      estFacture(f) &&
      !estAvoir(f) &&
      sousType(f) !== 'acompte' &&
      estEmis(f) &&
      estLieAuDevis(f, devis) &&
      resteFacturee(f, factures),
  )
}

/** Factures d'acompte émises sur ce devis et encore facturées après avoirs, dans l'ordre d'émission. */
export function acomptesEmisPourDevis(devis: DocumentLike, factures: DocumentLike[]): DocumentLike[] {
  return factures
    .filter((f) => estFacture(f) && !estAvoir(f) && estEmis(f) && estAcompteDuDevis(f, devis) && resteFacturee(f, factures))
    .sort((a, b) => String(a.docNumber || '').localeCompare(String(b.docNumber || '')))
}

/** Cumul des acomptes déjà facturés sur un devis (pour solder la dernière échéance au centime). */
export function acomptesDejaFacturesPourDevis(devis: DocumentLike, factures: DocumentLike[]): AcomptesDejaFactures {
  const acomptes = acomptesEmisPourDevis(devis, factures)
  return {
    pourcentageCumule: acomptes.reduce((somme, a) => somme + (Number(a.acomptePourcentage) || 0), 0),
    basesParTaux: additionnerBases(...acomptes.map((a) => basesNettesApresAvoirs(a, factures))),
    nombre: acomptes.length,
  }
}

const numerosDe = (docs: DocumentLike[]): string => docs.map((d) => String(d.docNumber || '')).filter(Boolean).join(', ')

/** Lignes négatives de déduction d'un acompte : une par taux de TVA resté facturé sur cet acompte. */
function lignesDeductionAcompte(acompte: DocumentLike, factures: DocumentLike[], premierId: number, locale: TvaLocale) {
  const numero = String(acompte.docNumber || '')
  const date = formaterDateCourte(acompte.docDate)
  // Un avoir partiel a réduit l'acompte : la ligne cite l'avoir, pour que le client rapproche le net.
  const avoirs = numerosDe(avoirsEmisSur(acompte, factures))
  const net = avoirs ? (locale === 'pt' ? `, líquido da nota de crédito n.º ${avoirs}` : `, net de l'avoir n° ${avoirs}`) : ''
  return basesNettesApresAvoirs(acompte, factures).map((base, index) => {
    const taux = base.taux > 0 ? (locale === 'pt' ? ` — IVA ${formaterNombre(base.taux)} %` : ` — TVA ${formaterNombre(base.taux)} %`) : ''
    const description = locale === 'pt'
      ? `Adiantamento já faturado — fatura n.º ${numero}${date ? ` de ${date}` : ''}${net}${taux}`
      : `Acompte déjà facturé — facture n° ${numero}${date ? ` du ${date}` : ''}${net}${taux}`
    const montant = -base.baseCents / 100
    return { id: premierId + index, description, qty: 1, unit: 'f', priceHT: montant, tvaRate: base.taux, totalHT: montant, source: 'manual' as const }
  })
}

type CleMessage = Exclude<ErreurFactureDepuisDevis | ErreurAcompteSurDevis, 'regime_tva'>

const MESSAGES: Record<TvaLocale, Record<CleMessage, (detail: string, montant?: string) => string>> = {
  fr: {
    devis_non_valide: () => 'Ce devis est encore en brouillon : validez-le avant de le facturer.',
    devis_refuse: () => 'Ce devis a été refusé : il ne peut pas être facturé.',
    client_manquant: () => 'Renseignez le nom du client sur le devis avant de le facturer.',
    montant_nul: () => 'Ce devis n\'a aucun montant à facturer. Ouvrez-le pour le compléter.',
    prestation_future: (date) => `La prestation est prévue le ${date} : avant cette date, émettez une facture d'acompte.`,
    deja_facture: (numeros) => `Ce devis a déjà été facturé (${numeros}). Émettez un avoir sur cette facture avant de refacturer.`,
    situations_emises: (numeros) => `Des factures de situation ont déjà été émises sur ce devis (${numeros}) : établissez la facture de solde depuis l'écran Factures.`,
    acomptes_couvrent_le_devis: (numeros) => `Les acomptes déjà facturés (${numeros}) couvrent la totalité du devis : il ne reste rien à facturer.`,
    acomptes_depassent_le_devis: (numeros, montant) => `Les acomptes déjà facturés (${numeros}) dépassent le montant du devis de ${montant} € HT : émettez un avoir avant de facturer.`,
    acomptes_incoherents: (numeros) => `Les acomptes déjà facturés (${numeros}) ne correspondent plus au devis (taux de TVA ou montants modifiés) : émettez un avoir sur ces acomptes avant de facturer le solde.`,
    acompte_deja_facture: (numeros) => `Ce devis a déjà été facturé (${numeros}) : un acompte ferait double emploi.`,
    acompte_depasse_le_devis: (deja, total) => `Avec cet acompte, les acomptes dépasseraient le montant du devis (déjà facturé : ${deja} € HT sur ${total} € HT).`,
    acompte_incoherent: (numeros) => `Les acomptes déjà facturés (${numeros}) ne correspondent plus au devis (taux de TVA ou montants modifiés) : émettez un avoir sur ces acomptes avant d'émettre un nouvel acompte.`,
  },
  pt: {
    devis_non_valide: () => 'Este orçamento ainda é um rascunho: valide-o antes de o faturar.',
    devis_refuse: () => 'Este orçamento foi recusado: não pode ser faturado.',
    client_manquant: () => 'Indique o nome do cliente no orçamento antes de o faturar.',
    montant_nul: () => 'Este orçamento não tem nenhum montante a faturar. Abra-o para o completar.',
    prestation_future: (date) => `A prestação está prevista para ${date}: antes dessa data, emita uma fatura de adiantamento.`,
    deja_facture: (numeros) => `Este orçamento já foi faturado (${numeros}). Emita uma nota de crédito sobre essa fatura antes de voltar a faturar.`,
    situations_emises: (numeros) => `Já foram emitidas faturas de situação sobre este orçamento (${numeros}): emita a fatura de saldo a partir do ecrã Faturas.`,
    acomptes_couvrent_le_devis: (numeros) => `Os adiantamentos já faturados (${numeros}) cobrem a totalidade do orçamento: não resta nada a faturar.`,
    acomptes_depassent_le_devis: (numeros, montant) => `Os adiantamentos já faturados (${numeros}) excedem o montante do orçamento em ${montant} € sem IVA: emita uma nota de crédito antes de faturar.`,
    acomptes_incoherents: (numeros) => `Os adiantamentos já faturados (${numeros}) já não correspondem ao orçamento (taxas de IVA ou montantes alterados): emita uma nota de crédito sobre esses adiantamentos antes de faturar o saldo.`,
    acompte_deja_facture: (numeros) => `Este orçamento já foi faturado (${numeros}): um adiantamento seria uma duplicação.`,
    acompte_depasse_le_devis: (deja, total) => `Com este adiantamento, os adiantamentos excederiam o montante do orçamento (já faturado: ${deja} € sem IVA de ${total} € sem IVA).`,
    acompte_incoherent: (numeros) => `Os adiantamentos já faturados (${numeros}) já não correspondem ao orçamento (taxas de IVA ou montantes alterados): emita uma nota de crédito sobre esses adiantamentos antes de emitir um novo adiantamento.`,
  },
}

type Refus<E extends string> = { ok: false; erreur: E; message: string }

const refuser = <E extends CleMessage>(locale: TvaLocale, erreur: E, detail = '', montant?: string): Refus<E> =>
  ({ ok: false, erreur, message: MESSAGES[locale][erreur](detail, montant) })

/**
 * Un devis sans numéro ou en brouillon n'a pas été validé : le document émis n'aurait aucune
 * référence de devis, et son numéro définitif serait consommé sans relecture.
 */
function refusStatutOuClient(devis: DocumentLike, locale: TvaLocale): Refus<'devis_non_valide' | 'devis_refuse' | 'client_manquant'> | null {
  const statut = String(devis.status || '')
  if (!aNumeroDefinitif(devis) || ['', 'brouillon', 'draft'].includes(statut)) return refuser(locale, 'devis_non_valide')
  if (['refuse', 'rejected'].includes(statut)) return refuser(locale, 'devis_refuse')
  if (!String(devis.clientName || '').trim()) return refuser(locale, 'client_manquant')
  return null
}

/** Même contrôle du régime de TVA que la validation du formulaire BTP. */
function refusRegime(devis: DocumentLike): Refus<'regime_tva'> | null {
  const erreurs = validateRegime({
    regime: regimeTvaEffectif(devis),
    issuerRegime: 'assujetti_normal',
    clientType: devis.clientType as 'particulier' | 'professionnel' | undefined,
    clientSiren: String(devis.clientSiret || '').replace(/\s/g, '').slice(0, 9),
    emitterTvaIntra: devis.tvaNumber as string | undefined,
  })
  return erreurs.length > 0
    ? { ok: false, erreur: 'regime_tva', message: erreurs.map((e) => REGIME_ERROR_MESSAGES[e]).join(' ') }
    : null
}

/**
 * Titre de la facture : celui du devis, sans le mot « Devis » en tête. « Devis cuisine » devient
 * « Facture cuisine » ; un numéro de devis en tête (« Devis n° 12 — cuisine ») est retiré avec
 * le mot, pour ne pas passer pour un numéro de facture.
 */
function titreFacture(titreDevis: string, solde: boolean, locale: TvaLocale): string {
  const motDevis = /^\s*(devis|orçamento|orcamento)(?![A-Za-zÀ-ÿ0-9])/i
  const numeroDevis = /^\s*(?:devis|orçamento|orcamento)\s*(?:n\s*[°º.]\s*\d[\w/.-]*|[A-Z]{2,}-\d[\w-]*)/i
  const separateurs = /^[\s:—–-]+/
  const mot = motDevis.exec(titreDevis)?.[1]
  const libelleSolde = locale === 'pt' ? 'Fatura de saldo' : 'Facture de solde'
  if (!mot) return solde ? (titreDevis.trim() ? `${libelleSolde} — ${titreDevis.trim()}` : libelleSolde) : titreDevis
  const avecNumero = numeroDevis.test(titreDevis)
  const reste = titreDevis.replace(avecNumero ? numeroDevis : motDevis, '').replace(separateurs, '').trim()
  if (solde) return reste ? `${libelleSolde} — ${reste}` : libelleSolde
  if (avecNumero) return reste
  // Même langue et même casse que le mot remplacé.
  const facture = /^devis$/i.test(mot) ? 'Facture' : 'Fatura'
  return titreDevis.replace(motDevis, mot === mot.toUpperCase() ? facture.toUpperCase() : facture)
}

/** Référence de devis lisible par le PDF dans les notes (même expression que lib/pdf/devis-pdf-v3.ts). */
const REFERENCE_DEVIS_DANS_NOTES = /(?:Réf\. devis|Ref\. orçamento)\s*:\s*[^\n]+/

/**
 * Notes de la facture : celles du devis, plus la référence du devis signé — le PDF en tire la
 * mention « Facture établie conformément au devis signé n° … ».
 */
function notesFacture(devis: DocumentLike, locale: TvaLocale): string {
  const notes = String(devis.notes || '').trim()
  const signe = ['signe', 'signed', 'accepte', 'accepted'].includes(String(devis.status || ''))
  if (!signe || REFERENCE_DEVIS_DANS_NOTES.test(notes)) return notes
  const reference = locale === 'pt' ? `Ref. orçamento: ${String(devis.docNumber)}` : `Réf. devis : ${String(devis.docNumber)}`
  return notes ? `${notes}\n${reference}` : reference
}

/**
 * Construit la facture à émettre directement depuis un devis, ou explique pourquoi elle ne
 * peut pas l'être. Ne tire aucun numéro et n'écrit rien : l'émission reste à emitDocument.
 */
export function buildFactureDepuisDevis(devis: DocumentLike, options: OptionsFactureDepuisDevis): ResultatFactureDepuisDevis {
  const locale = options.locale ?? 'fr'
  const aujourdHui = options.aujourdHui || dateDuJourLocale()

  const refusDevis = refusStatutOuClient(devis, locale)
  if (refusDevis) return refusDevis

  // Montants du devis tels que le formulaire les affiche (quantité × prix unitaire).
  const devisRecalcule = recalculerTotauxLignes(devis)
  const basesDevis = basesHtParTaux(devis)
  const totalDevisCents = totalBasesCents(basesDevis)
  if (!(totalDevisCents > 0)) return refuser(locale, 'montant_nul')

  // Avant le contrôle de la date de prestation : celui-ci renvoie vers l'acompte, qui serait
  // refusé à son tour sur un devis déjà facturé.
  const dejaEmises = facturesEmisesPourDevis(devis, options.factures)
  if (dejaEmises.length > 0) {
    // Une situation de travaux ne s'annule pas : le solde s'établit depuis l'écran Factures.
    const situations = dejaEmises.filter((f) => sousType(f) === 'situation')
    return situations.length === dejaEmises.length
      ? refuser(locale, 'situations_emises', numerosDe(situations))
      : refuser(locale, 'deja_facture', numerosDe(dejaEmises))
  }

  const prestation = String(devis.prestationDate || '').slice(0, 10)
  if (prestation && prestation > aujourdHui) return refuser(locale, 'prestation_future', formaterDateCourte(prestation))

  const regime = regimeTvaEffectif(devis)
  const refusTva = refusRegime(devis)
  if (refusTva) return refusTva

  const acomptes = acomptesEmisPourDevis(devis, options.factures)
  const lignesDeduction = acomptes.flatMap((acompte, index) => lignesDeductionAcompte(acompte, options.factures, (index + 1) * 100 + 1, locale))
  const basesDeduites = lignesDeduction.map((l) => ({ taux: l.tvaRate, baseCents: Math.round(l.totalHT * 100) }))
  const totalHtCents = totalDevisCents + totalBasesCents(basesDeduites)
  if (acomptes.length > 0) {
    if (totalHtCents === 0) return refuser(locale, 'acomptes_couvrent_le_devis', numerosDe(acomptes))
    if (totalHtCents < 0) return refuser(locale, 'acomptes_depassent_le_devis', numerosDe(acomptes), formaterMontantCents(-totalHtCents))
    // Devis modifié depuis un acompte : une base négative sur un taux ferait une TVA négative.
    if (additionnerBases(basesDevis, basesDeduites).some((b) => b.baseCents < 0)) {
      return refuser(locale, 'acomptes_incoherents', numerosDe(acomptes))
    }
  }

  // Désignation toujours en texte : le PDF appelle .trim() sur chaque ligne (devis hérité ou importé).
  const devisNormalise = transformerLignes(devisRecalcule, (l) =>
    typeof l.description === 'string' ? l : { ...l, description: l.description == null ? '' : String(l.description) })
  const {
    id: _id, docNumber: _docNumber, docType: _docType, status: _status,
    savedAt: _savedAt, sentAt: _sentAt, signatureData: _signatureData, docDate: _docDate,
    ...reste
  } = devisNormalise
  const tablesDevis = Array.isArray(reste.customTables)
    ? (reste.customTables as unknown[]).filter((t) => t !== null && typeof t === 'object')
    : []
  const avecDeduction = lignesDeduction.length > 0

  const payload: DocumentLike = {
    ...reste,
    docType: 'facture',
    // Antidatage interdit : la facture est datée du jour de son émission, jamais du devis.
    docDate: aujourdHui,
    // Travaux réalisés : à défaut de date de prestation sur le devis, celle de la facture.
    prestationDate: prestation || aujourdHui,
    ...devisLinkFields(devis as { id?: unknown; docNumber?: unknown }),
    factureSubType: 'standard',
    // Régime explicite : la synchronisation retombe sinon sur « classique » pour un ancien devis.
    regimeTva: regime,
    docTitle: titreFacture(String(devis.docTitle || ''), avecDeduction, locale),
    notes: notesFacture(devis, locale),
    // La facture finale ne porte pas l'échéancier du devis : « → Acompte » y proposerait sinon
    // d'émettre en un clic un acompte sur un solde déjà facturé.
    acomptesEnabled: false,
    acomptes: [],
    customTables: avecDeduction
      ? [
          ...tablesDevis,
          {
            id: ID_TABLE_ACOMPTES_DEDUITS,
            name: locale === 'pt' ? 'Adiantamentos já faturados (a deduzir)' : 'Acomptes déjà facturés (à déduire)',
            lines: lignesDeduction,
          },
        ]
      : tablesDevis,
  }
  return { ok: true, payload, acomptesDeduits: acomptes, totalHtCents }
}

/**
 * Garde-fous avant l'émission directe d'un acompte depuis un devis : mêmes refus que la
 * facture totale (devis validé, non refusé, client, régime de TVA), plus le double emploi
 * (devis déjà facturé) et le dépassement (acomptes cumulés au-delà du devis).
 */
export function controlerAcompteSurDevis(
  devis: DocumentLike,
  pourcentage: number,
  options: Pick<OptionsFactureDepuisDevis, 'factures' | 'locale'>,
): ResultatControleAcompte {
  const locale = options.locale ?? 'fr'
  const refusDevis = refusStatutOuClient(devis, locale) ?? refusRegime(devis)
  if (refusDevis) return refusDevis

  const dejaEmises = facturesEmisesPourDevis(devis, options.factures)
  if (dejaEmises.length > 0) return refuser(locale, 'acompte_deja_facture', numerosDe(dejaEmises))

  const basesDevis = basesHtParTaux(devis)
  const totalDevisCents = totalBasesCents(basesDevis)
  const deja = acomptesDejaFacturesPourDevis(devis, options.factures)
  const dejaCents = totalBasesCents(deja.basesParTaux)
  if (!(totalDevisCents > 0) || dejaCents === 0) return { ok: true }

  // Ce que l'émission produirait réellement : la dernière échéance est soldée par différence.
  const cetAcompte = buildAcompteLinesParTaux(devis, pourcentage, { locale, dejaFacture: deja })
    .map((l) => ({ taux: l.tvaRate, baseCents: Math.round(l.totalHT * 100) }))
  // Tolérance : un centime d'arrondi par acompte.
  const toleranceCents = (deja.nombre ?? 0) + 1
  if (dejaCents + totalBasesCents(cetAcompte) > totalDevisCents + toleranceCents) {
    return refuser(locale, 'acompte_depasse_le_devis', formaterMontantCents(dejaCents), formaterMontantCents(totalDevisCents))
  }
  // Devis modifié depuis un acompte : sur un taux, les acomptes dépasseraient les travaux
  // (la facture de solde serait ensuite refusée pour la même raison).
  const resteParTaux = additionnerBases(basesDevis, ...[deja.basesParTaux, cetAcompte].map((bases) => bases.map((b) => ({ taux: b.taux, baseCents: -b.baseCents }))))
  if (resteParTaux.some((b) => b.baseCents < -toleranceCents)) {
    return refuser(locale, 'acompte_incoherent', numerosDe(acomptesEmisPourDevis(devis, options.factures)))
  }
  return { ok: true }
}
