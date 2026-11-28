import { fichePortugaise } from '@/lib/numerotation-prefixes'

export type LangueDocumentBtp = 'fr' | 'pt'

/**
 * Langue des documents d'une société BTP — devis, factures, acomptes, avoirs, leurs PDF et leurs mentions légales :
 * celle de sa FICHE, pas celle de l'écran.
 *
 * Avant le 27/11/2026, tout suivait la langue de l'écran. Un gérant qui tient une société française et une société
 * portugaise dans le même navigateur ouvrait le tableau de bord de la société française sur /pt (cookie de langue
 * resté au portugais) : sa facture d'acompte AC-2026-030 sortait en portugais, droit portugais compris (DL 62/2013,
 * Código Civil), sous un numéro de la série française. Constat de Frédéric du 27/11/2026.
 *
 * Critère : celui de la série de numérotation du serveur (next_doc_number, lib/numerotation-prefixes.ts) et de la
 * langue de l'équipe (app/api/pro/team) — fiche en portugais → portugais, toute autre fiche → français. Un NOUVEAU
 * document numéroté FA- est donc rédigé en portugais, un nouveau document AC- en français (un document déjà émis garde
 * le texte enregistré ; sans fiche lue, la langue de l'écran décide, comme avant).
 *
 * Fiche inconnue (pas encore chargée, relecture échouée, identité de repli sans langue) : la langue de l'écran, comme
 * avant. Une fiche lue dont la langue est vide est, elle, celle d'une société française (même règle que le serveur).
 *
 * L'écran garde sa langue : boutons, aides et messages restent ceux de l'utilisateur.
 */
export function langueDocumentsBtp(fiche: unknown, langueEcran: string): LangueDocumentBtp {
  if (fiche === null || typeof fiche !== 'object' || !('language' in fiche)) {
    return langueEcran === 'pt' ? 'pt' : 'fr'
  }
  return fichePortugaise(fiche) ? 'pt' : 'fr'
}
