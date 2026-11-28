/**
 * Modèles de devis et de factures propres à une société BTP (fiche profiles_artisan).
 *
 * Le générateur V3 (lib/pdf/devis-pdf-v3.ts) reçoit `modele` et garde son modèle BTP par défaut
 * pour toute autre fiche :
 *  - 'provence-pro'    : modèle par défaut + logo vectoriel centré et filet rouge (lib/pdf/modele-provence-pro.ts) ;
 *  - 'method-solucoes' : gabarit « Method Soluções » fourni par la société, document en portugais
 *                        (lib/pdf/modele-method-solucoes.ts) ;
 *  - 'vitfix-orcamento' : gabarit d'orçamento Vitfix (template_orcamento_vitfix.html v1.1), orçamentos
 *                        seulement, en portugais (lib/pdf/modele-vitfix-orcamento.ts) ; ses factures gardent
 *                        le modèle BTP par défaut.
 */

import { PROVENCE_PRO_PROFIL_ID } from '@/lib/pdf/modele-provence-pro'

/** Fiche profiles_artisan de la société de la marque Method Soluções. */
export const METHOD_SOLUCOES_PROFIL_ID = 'e33dc268-e257-44b0-a0e6-4efe7597512e'

/** Fiche profiles_artisan de la société de la marque Vitfix. */
export const VITFIX_SOCIETE_PROFIL_ID = '7cfb1e10-efd7-468b-8493-0a7ad37e0fe6'

export type ModeleDocument = 'provence-pro' | 'method-solucoes' | 'vitfix-orcamento'

const MODELES: Readonly<Record<string, ModeleDocument>> = {
  [PROVENCE_PRO_PROFIL_ID]: 'provence-pro',
  [METHOD_SOLUCOES_PROFIL_ID]: 'method-solucoes',
  [VITFIX_SOCIETE_PROFIL_ID]: 'vitfix-orcamento',
}

/** Modèle de document propre à une société, ou undefined pour le modèle BTP par défaut. */
export function modeleDocumentSociete(profilId: string | null | undefined): ModeleDocument | undefined {
  if (!profilId) return undefined
  return Object.prototype.hasOwnProperty.call(MODELES, profilId) ? MODELES[profilId] : undefined
}

/**
 * Modèles de relatório (module Rapports, lib/rapport-pdf.ts) propres à une société BTP :
 *  - 'vitfix-relatorio' : gabarit « Template Relatório Vitfix » v1 du 26/11/2026, en portugais
 *                         (lib/pdf/modele-vitfix-relatorio.ts).
 * Toute autre fiche garde le PDF des rapports du module.
 */
export type ModeleRapport = 'vitfix-relatorio'

const MODELES_RAPPORT: Readonly<Record<string, ModeleRapport>> = {
  [VITFIX_SOCIETE_PROFIL_ID]: 'vitfix-relatorio',
}

/** Modèle de relatório propre à une société, ou undefined pour le PDF des rapports du module. */
export function modeleRapportSociete(profilId: string | null | undefined): ModeleRapport | undefined {
  if (!profilId) return undefined
  return Object.prototype.hasOwnProperty.call(MODELES_RAPPORT, profilId) ? MODELES_RAPPORT[profilId] : undefined
}
