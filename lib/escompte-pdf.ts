/**
 * Escompte pour paiement anticipé sur le PDF artisan (correction du 13/11/2026).
 *
 * Avant la correction, le texte saisi dans « Escompte si paiement anticipé » n'était jamais
 * imprimé : le PDF disait toujours « Aucun escompte accordé pour paiement anticipé ». Il l'est
 * désormais pour un document marqué `escompteSurPdf`. Un document antérieur garde le PDF qu'il
 * avait (documents existants inchangés), même rouvert et réenregistré, sauf si l'artisan modifie
 * l'escompte.
 */
import { documentExistant } from '@/lib/statut-juridique-btp'

/** Document vu par la règle : identité (identifiant, horodatage, numéro), duplicata, marque. */
export interface DocumentEscompte {
  id?: unknown
  savedAt?: unknown
  docNumber?: string | null
  isDuplicate?: unknown
  escompteSurPdf?: unknown
}

/**
 * Vrai si le formulaire doit imprimer l'escompte dès l'ouverture.
 *   - Marque explicite d'abord : un avoir ou un acompte reprend celle de son parent (`false` pour
 *     le parent d'avant la correction), pour ne pas faire apparaître un escompte absent de la facture.
 *   - Sinon, document nouveau (création, duplicata) : oui ; document déjà enregistré (identifiant,
 *     horodatage ou numéro définitif, même si l'identifiant est vide comme sur les anciens
 *     brouillons) : non.
 */
export function escompteImprimeAuDepart(document: DocumentEscompte | null | undefined): boolean {
  if (typeof document?.escompteSurPdf === 'boolean') return document.escompteSurPdf
  return !documentExistant(document)
}
