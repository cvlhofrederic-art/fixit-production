/**
 * Libellés des devis et factures BTP (formulaire DevisFactureFormBTP, aperçu à
 * l'écran, PDF généré depuis le formulaire ou depuis la liste) : une seule règle
 * par libellé, pour que l'aperçu et le téléchargement disent la même chose.
 */

import { isValidSiret } from '@/lib/validation'

type LocaleDoc = 'fr' | 'pt' | string

/**
 * Délai d'exécution saisi dans le formulaire BTP (nombre + unité du menu :
 * 'ouvres' | 'calendaires' | 'semaines' | 'mois'). Avant : « 5 jours semaines »
 * à l'aperçu et « 5 jours ouvrés » au téléchargement pour 5 semaines.
 */
export function formatDelaiExecution(nombre: number, type: string | null | undefined, locale: LocaleDoc): string {
  const pluriel = nombre > 1
  if (locale === 'pt') {
    switch (type) {
      case 'calendaires': return `${nombre} ${pluriel ? 'dias corridos' : 'dia corrido'}`
      case 'semaines': return `${nombre} ${pluriel ? 'semanas' : 'semana'}`
      case 'mois': return `${nombre} ${pluriel ? 'meses' : 'mês'}`
      default: return `${nombre} ${pluriel ? 'dias úteis' : 'dia útil'}`
    }
  }
  switch (type) {
    case 'calendaires': return `${nombre} ${pluriel ? 'jours calendaires' : 'jour calendaire'}`
    case 'semaines': return `${nombre} ${pluriel ? 'semaines' : 'semaine'}`
    case 'mois': return `${nombre} mois`
    default: return `${nombre} ${pluriel ? 'jours ouvrés' : 'jour ouvré'}`
  }
}

/**
 * Titre d'un devis ou d'une facture qui n'en a pas (avant : « Devis FACT-… » à
 * l'aperçu d'une facture, « Facture AV-… » pour un avoir).
 */
export function titreDocumentParDefaut(
  docType: 'devis' | 'facture' | string | null | undefined,
  docNumber: string | null | undefined,
  locale: LocaleDoc,
  factureSubType?: string | null,
): string {
  const type = docType === 'facture'
    ? (factureSubType === 'avoir'
      ? (locale === 'pt' ? 'Nota de crédito' : 'Avoir')
      : (locale === 'pt' ? 'Fatura' : 'Facture'))
    : (locale === 'pt' ? 'Orçamento' : 'Devis')
  return docNumber ? `${type} ${docNumber}` : type
}

/**
 * Type de client retenu pour le document : un SIRET valide (Luhn) fait un client
 * professionnel, même déclaré particulier (pas de rétractation hors établissement).
 * Avant, seul l'aperçu du formulaire appliquait cette règle, pas le téléchargement
 * depuis la liste.
 */
export function typeClientDetecte(
  clientType: string | null | undefined,
  clientSiret: string | null | undefined,
): 'particulier' | 'professionnel' {
  if (isValidSiret(clientSiret || '')) return 'professionnel'
  return clientType === 'professionnel' ? 'professionnel' : 'particulier'
}

export interface ChampsDocumentBtpEntree {
  locale: LocaleDoc
  docType?: string | null
  docNumber?: string | null
  docTitle?: string | null
  factureSubType?: string | null
  /** Délai déjà rédigé (anciens devis) : prioritaire sur nombre + unité */
  executionDelay?: string | null
  executionDelayDays?: number | null
  executionDelayType?: string | null
  clientType?: string | null
  clientSiret?: string | null
  /** Valeur enregistrée avec le document (absente sur les anciens devis) */
  isHorsEtablissement?: boolean | null
}

export interface ChampsDocumentBtp {
  /** '' sans délai : le PDF affiche alors lui-même « À convenir » / « A combinar » */
  executionDelay: string
  docTitle: string
  clientType: 'particulier' | 'professionnel'
  isHorsEtablissement: boolean
}

/**
 * Champs du PDF BTP calculés de la même façon depuis le formulaire (aperçu,
 * téléchargement) et depuis la liste (« Télécharger »).
 * Rétractation hors établissement : jamais pour un client professionnel (déclaré
 * ou SIRET valide) ; sinon la valeur enregistrée, et à défaut (anciens devis) le
 * type déclaré — un devis sans type de client ne reçoit pas la rétractation.
 */
export function champsDocumentBtp(e: ChampsDocumentBtpEntree): ChampsDocumentBtp {
  const nombre = e.executionDelayDays ?? 0
  const clientType = typeClientDetecte(e.clientType, e.clientSiret)
  return {
    executionDelay: e.executionDelay || (nombre > 0 ? formatDelaiExecution(nombre, e.executionDelayType, e.locale) : ''),
    docTitle: e.docTitle || titreDocumentParDefaut(e.docType, e.docNumber, e.locale, e.factureSubType),
    clientType,
    isHorsEtablissement: clientType === 'particulier' && (e.isHorsEtablissement ?? e.clientType === 'particulier'),
  }
}
