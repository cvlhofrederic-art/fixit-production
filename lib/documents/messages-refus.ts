// Messages des refus d'accès aux documents d'une société, en français et en portugais européen.
//
// Un seul endroit pour les deux côtés : le serveur rend un `code` stable accompagné du texte français (une route
// n'a pas de langue), et le navigateur affiche la langue de l'écran — un salarié d'une société portugaise doit
// lire le sien, sur le modèle de `messageFicheSocieteAbsente`.
//
// Ce fichier n'importe rien : il est lu par une route serveur comme par du code du navigateur.

export type CodeRefusDocuments =
  | 'societe_non_resolue'
  | 'fiche_societe_absente'
  | 'fiche_societe_multiple'
  | 'aucun_droit'
  | 'aucun_droit_comptabilite'
  | 'lecture_impossible'

export const MESSAGES_REFUS_DOCUMENTS: Record<CodeRefusDocuments, { fr: string; pt: string }> = {
  societe_non_resolue: {
    fr: "Votre compte n'est rattaché à aucune société active. Demandez au gérant de vérifier votre accès.",
    pt: 'A sua conta não está associada a nenhuma empresa ativa. Peça ao gerente para verificar o seu acesso.',
  },
  fiche_societe_absente: {
    fr: 'La fiche de la société est introuvable. Le gérant doit la compléter avant que vous puissiez accéder aux documents.',
    pt: 'A ficha da empresa não foi encontrada. O gerente tem de a preencher antes de poder acessar os documentos.',
  },
  fiche_societe_multiple: {
    fr: "Plusieurs fiches existent pour cette société. Le gérant doit n'en garder qu'une avant que les documents soient accessibles.",
    pt: 'Existem várias fichas para esta empresa. O gerente tem de manter apenas uma antes de os documentos ficarem acessíveis.',
  },
  aucun_droit: {
    fr: "Votre rôle dans l'entreprise ne donne pas accès aux devis et aux factures.",
    pt: 'A sua função na empresa não dá acesso a orçamentos e faturas.',
  },
  // Distinct d'`aucun_droit` : celui-ci parle des devis et des factures, et afficherait le mauvais motif sur
  // l'écran du Comptable IA.
  aucun_droit_comptabilite: {
    fr: "Votre rôle dans l'entreprise ne donne pas accès à la comptabilité.",
    pt: 'A sua função na empresa não dá acesso à contabilidade.',
  },
  lecture_impossible: {
    fr: 'Les documents de la société sont momentanément illisibles. Réessayez dans un instant.',
    pt: 'Os documentos da empresa estão momentaneamente indisponíveis. Tente novamente dentro de instantes.',
  },
}

/** Texte français d'un refus : ce que les routes renvoient à côté du code. */
export function messageRefusFr(code: CodeRefusDocuments): string {
  return MESSAGES_REFUS_DOCUMENTS[code].fr
}

/**
 * Message à afficher : traduit si le code est connu, sinon le texte rendu par le serveur (une route plus récente
 * que ce fichier doit rester lisible).
 */
export function messageRefusDocuments(refus: { message: string; code?: string }, estPt: boolean): string {
  const connu = refus.code ? MESSAGES_REFUS_DOCUMENTS[refus.code as CodeRefusDocuments] : undefined
  if (!connu) return refus.message
  return estPt ? connu.pt : connu.fr
}
