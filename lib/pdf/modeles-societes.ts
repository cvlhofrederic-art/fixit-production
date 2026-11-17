/**
 * Modèles de devis et de factures propres à une société BTP (fiche profiles_artisan).
 *
 * Le générateur V3 (lib/pdf/devis-pdf-v3.ts) reçoit `modele` et garde son modèle BTP par défaut
 * pour toute autre fiche :
 *  - 'provence-pro'    : modèle par défaut + logo vectoriel centré et filet rouge (lib/pdf/modele-provence-pro.ts) ;
 *  - 'method-solucoes' : gabarit « Method Soluções » fourni par la société, document en portugais
 *                        (lib/pdf/modele-method-solucoes.ts).
 */

import { PROVENCE_PRO_PROFIL_ID } from '@/lib/pdf/modele-provence-pro'

/** Fiche profiles_artisan de la société de la marque Method Soluções. */
export const METHOD_SOLUCOES_PROFIL_ID = 'e33dc268-e257-44b0-a0e6-4efe7597512e'

export type ModeleDocument = 'provence-pro' | 'method-solucoes'

const MODELES: Readonly<Record<string, ModeleDocument>> = {
  [PROVENCE_PRO_PROFIL_ID]: 'provence-pro',
  [METHOD_SOLUCOES_PROFIL_ID]: 'method-solucoes',
}

/** Modèle de document propre à une société, ou undefined pour le modèle BTP par défaut. */
export function modeleDocumentSociete(profilId: string | null | undefined): ModeleDocument | undefined {
  if (!profilId) return undefined
  return Object.prototype.hasOwnProperty.call(MODELES, profilId) ? MODELES[profilId] : undefined
}
