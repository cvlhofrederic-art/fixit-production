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
  | 'aucun_droit_fiche'
  | 'aucun_droit_liaison'
  | 'aucun_droit_paiement'
  | 'formulaire_perime'
  | 'lecture_impossible'
  | 'reseau_indisponible'
  | 'session_expiree'
  | 'trop_de_requetes'

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
  // « Mon profil », logo, modes de paiement d'un compte invité : la fiche est celle de la société (lib/btp/fiche-societe.ts).
  aucun_droit_fiche: {
    fr: "Votre rôle dans l'entreprise ne permet pas de modifier la fiche de la société.",
    pt: 'A sua função na empresa não permite alterar a ficha da empresa.',
  },
  // Lecture des modes de paiement (IBAN) : réservée à qui les modifie ou imprime des documents.
  aucun_droit_paiement: {
    fr: "Votre rôle dans l'entreprise ne donne pas accès aux modes de paiement de la société.",
    pt: 'A sua função na empresa não dá acesso aos modos de pagamento da empresa.',
  },
  // Mon profil d'un compte invité ouvert avant sa correction : un formulaire vide qui effacerait la fiche de la société.
  formulaire_perime: {
    fr: "Le formulaire n'est plus à jour : rechargez la page, puis enregistrez de nouveau.",
    pt: 'O formulário já não está atualizado: recarregue a página e guarde novamente.',
  },
  // « Lier un devis » de l'écran Chantiers : il faut écrire les devis et les chantiers (app/api/pro/documents/chantiers).
  aucun_droit_liaison: {
    fr: "Votre rôle dans l'entreprise ne permet pas de lier un devis à un chantier.",
    pt: 'A sua função na empresa não permite associar um orçamento a uma obra.',
  },
  lecture_impossible: {
    fr: 'Les documents de la société sont momentanément illisibles. Réessayez dans un instant.',
    pt: 'Os documentos da empresa estão momentaneamente indisponíveis. Tente novamente dentro de instantes.',
  },
  // Échecs vus du navigateur (lib/documents/societe-client.ts) : aucune réponse lisible du serveur, session expirée.
  reseau_indisponible: {
    fr: 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.',
    pt: 'Não foi possível ligar ao servidor. Verifique a sua ligação à rede e tente novamente.',
  },
  session_expiree: {
    fr: 'Session expirée. Reconnectez-vous.',
    pt: 'A sessão expirou. Inicie sessão novamente.',
  },
  // Limite de débit d'une route (429) : le texte de rateLimitResponse est en anglais, et sans code.
  trop_de_requetes: {
    fr: 'Trop de demandes en peu de temps. Patientez une minute, puis réessayez.',
    pt: 'Demasiados pedidos em pouco tempo. Aguarde um minuto e tente novamente.',
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
