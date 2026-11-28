/**
 * Version du rendu et des totaux d'un document artisan (correction du 13/11/2026).
 *
 * Avant la correction, le PDF artisan (V2) n'imprimait ni les matériaux ni les frais annexes et son
 * total les oubliait ; téléchargé depuis la liste ou dans un ZIP, il perdait aussi les tableaux
 * personnalisés et le détail de la TVA ; ses en-têtes annonçaient « TTC » sur des montants hors taxe ;
 * ses lignes de TVA chevauchaient leur montant. La liste des factures, la messagerie et la base ne
 * comptaient ni les matériaux ni les frais (TVA des frais annexes ignorée en base).
 *
 * Un document marqué `versionRendu: 2` a le rendu et les totaux corrigés partout. Un document enregistré
 * avant la correction (brouillon compris : son PDF a pu partir chez un client) n'a pas de marque et se
 * réimprime à l'identique, même rouvert et réenregistré. Un document tiré d'un autre (facture d'un devis,
 * acompte, avoir) suit son document d'origine ; un duplicata est un document nouveau.
 *
 * Portugal hors champ : en portugais, le formulaire ne pose pas la marque (il garde celle du document).
 */
import { documentExistant } from '@/lib/statut-juridique-btp'

/** Rendu et totaux corrigés : matériaux, frais annexes, tables et TVA comptés partout. */
export const VERSION_RENDU_COMPLET = 2
/** Rendu d'avant la correction (document sans marque). */
export const VERSION_RENDU_ORIGINE = 1

/** Ce que la règle lit d'un document : identité, duplicata, marque et liens vers un document d'origine. */
export interface DocumentVersionRendu {
  id?: unknown
  savedAt?: unknown
  docNumber?: string | null
  isDuplicate?: unknown
  versionRendu?: unknown
  sourceDevisId?: unknown
  sourceDevisNumber?: unknown
  acompteDeFactureId?: unknown
  avoirDeFactureId?: unknown
  parentInvoiceNumber?: unknown
}

const renseigne = (v: unknown): boolean => (typeof v === 'string' ? v.trim() !== '' : v != null && v !== false)

/** Le document a le rendu et les totaux corrigés. */
export function renduComplet(document: object | null | undefined): boolean {
  const version = (document as DocumentVersionRendu | null | undefined)?.versionRendu
  return typeof version === 'number' && version >= VERSION_RENDU_COMPLET
}

/**
 * Document tiré d'un autre (facture d'un devis, acompte, avoir) : il recopie le document d'origine,
 * marque comprise. Sans marque, son document d'origine est antérieur à la correction.
 */
function tireDUnDocument(document: DocumentVersionRendu): boolean {
  return renseigne(document.sourceDevisId) || renseigne(document.sourceDevisNumber)
    || renseigne(document.acompteDeFactureId) || renseigne(document.avoirDeFactureId)
    || renseigne(document.parentInvoiceNumber)
}

/**
 * Version du document à l'ouverture du formulaire artisan (France) :
 *   - duplicata : document nouveau, rendu complet (même si l'original suit un ancien document) ;
 *   - marque présente : elle est gardée ;
 *   - document déjà enregistré (identifiant, horodatage ou numéro définitif) : rendu d'origine ;
 *   - document nouveau tiré d'un document sans marque : rendu de son document d'origine ;
 *   - sinon (création) : rendu complet.
 */
export function versionRenduAuDepart(source: object | null | undefined): number {
  const document = source as DocumentVersionRendu | null | undefined
  if (!document) return VERSION_RENDU_COMPLET
  if (document.isDuplicate) return VERSION_RENDU_COMPLET
  if (typeof document.versionRendu === 'number') return document.versionRendu
  if (documentExistant(document)) return VERSION_RENDU_ORIGINE
  if (tireDUnDocument(document)) return VERSION_RENDU_ORIGINE
  return VERSION_RENDU_COMPLET
}

/**
 * Valeur enregistrée dans le document : la marque d'un document au rendu complet, ou celle que le
 * document portait déjà. Rien pour un document d'avant la correction : ses données restent inchangées.
 */
export function champVersionRendu(document: object | null | undefined, version: number): number | undefined {
  const marque = (document as DocumentVersionRendu | null | undefined)?.versionRendu
  if (version >= VERSION_RENDU_COMPLET || typeof marque === 'number') return version
  return undefined
}
