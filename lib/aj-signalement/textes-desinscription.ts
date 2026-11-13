// ── AJ Signalement — diffusion : textes de la page publique de désinscription (PR 3, lot 6) ─────────────────────────
//
// Cahier PR 3 § 7.5 ; note juridique § 5.4 (phrases exactes à mettre sur la page, avant le clic : ce qu'on quitte, ce
// qu'on garde) et § 5.5 (informer, ne pas retenir : ni « êtes-vous sûr ? », ni question ; retour en arrière proposé).
// La page s'affiche dans la langue DE LA DIFFUSION (celle du message reçu). Versions portugaises proposées, à relire par
// Hugo (H4) : sans relecture, aucun cabinet PT n'est activé (H9). Écran nouveau, brouillon soumis à Frédéric (F1).
// Aucune date, aucune mention de VitFix (droit § 4.1 : VitFix n'est pas l'auteur des messages).

import { parLangue, type TableBilingue } from '@/lib/aj-signalement/bilingue'

export interface TextesDesinscriptionQr {
  /** Titre de l'onglet et de la page (un seul h1). */
  titre: string
  verification: string
  /** « {copropriete} — informations envoyées par {cabinet} à {email} » (jeton de page). */
  presentation: string
  /** Même ligne sans l'adresse (jeton un clic, ou adresse illisible). */
  presentationSansEmail: string
  /** Droit § 5.4, phrase 1 : ce qu'on quitte (exacte). */
  quitter: string
  /** Droit § 5.4, phrase 2 : ce qu'on garde (exacte). */
  garder: string
  /** Libellé du bouton (droit § 5.4, identique au bouton de l'e-mail). */
  boutonOpposer: string
  opposeFait: string
  /** « Recevoir à nouveau ces informations » (droit § 5.5). */
  boutonReprendre: string
  dejaOppose: string
  reprisFait: string
  nonLevable: string
  /** Lien expiré : « {copropriete} ». */
  expireIntro: string
  champEmail: string
  emailInvalide: string
  expireFait: string
  /** Ancien lien : « {cabinet} », « {contact} ». */
  ancien: string
  ancienSansContact: string
  /** Lien non valable : « {contact} ». */
  inconnu: string
  inconnuSansContact: string
  /** Pied : « {cabinet} ». */
  politique: string
  enCours: string
  reseau: string
  indisponible: string
  limite: string
  reessayer: string
}

const TABLE: TableBilingue<TextesDesinscriptionQr> = {
  titre: { fr: 'Informations sur votre immeuble', pt: 'Informações sobre o seu prédio' },
  verification: { fr: 'Vérification du lien…', pt: 'A verificar a ligação…' },
  presentation: {
    fr: '{copropriete} — informations envoyées par {cabinet} à {email}',
    pt: '{copropriete} — informações enviadas por {cabinet} para {email}',
  },
  presentationSansEmail: {
    fr: '{copropriete} — informations envoyées par {cabinet}',
    pt: '{copropriete} — informações enviadas por {cabinet}',
  },
  quitter: {
    fr: 'Vous ne recevrez plus les informations sur les incidents de cet immeuble : coupures d’eau, fuites, interventions.',
    pt: 'Deixará de receber as informações sobre os incidentes deste prédio: cortes de água, fugas, intervenções.',
  },
  garder: {
    fr: 'Vous continuerez à recevoir la confirmation de vos propres signalements.',
    pt: 'Continuará a receber a confirmação das suas próprias ocorrências.',
  },
  boutonOpposer: { fr: 'Ne plus recevoir les informations sur cet immeuble', pt: 'Deixar de receber as informações sobre este prédio' },
  opposeFait: {
    fr: 'C’est enregistré : vous ne recevrez plus les informations sur cet immeuble.',
    pt: 'Ficou registado: deixará de receber as informações sobre este prédio.',
  },
  boutonReprendre: { fr: 'Recevoir à nouveau ces informations', pt: 'Voltar a receber estas informações' },
  dejaOppose: {
    fr: 'Vous ne recevez plus les informations sur cet immeuble.',
    pt: 'Já não recebe as informações sobre este prédio.',
  },
  reprisFait: {
    fr: 'C’est enregistré : vous recevrez de nouveau les informations sur cet immeuble.',
    pt: 'Ficou registado: voltará a receber as informações sobre este prédio.',
  },
  nonLevable: {
    fr: 'Ce lien ne permet plus de revenir sur ce choix.',
    pt: 'Esta ligação já não permite voltar atrás nesta escolha.',
  },
  expireIntro: {
    fr: 'Ce lien a plus d’un an. Pour ne plus recevoir les informations sur {copropriete}, indiquez l’adresse e-mail à laquelle vous les receviez.',
    pt: 'Esta ligação tem mais de um ano. Para deixar de receber as informações sobre {copropriete}, indique o endereço de e-mail em que as recebia.',
  },
  champEmail: { fr: 'Adresse e-mail', pt: 'Endereço de e-mail' },
  emailInvalide: {
    fr: 'Indiquez une adresse e-mail complète (exemple : nom@domaine.fr).',
    pt: 'Indique um endereço de e-mail completo (exemplo: nome@dominio.pt).',
  },
  expireFait: {
    fr: 'C’est noté. Si cette adresse est celle à laquelle ce message a été envoyé, elle ne recevra plus les informations sur cet immeuble.',
    pt: 'Ficou registado. Se este endereço for aquele para o qual esta mensagem foi enviada, deixará de receber as informações sobre este prédio.',
  },
  ancien: {
    fr: 'Ce lien est trop ancien. Pour ne plus recevoir les informations sur cet immeuble, utilisez le bouton d’un message plus récent, ou écrivez à {cabinet} : {contact}.',
    pt: 'Esta ligação é demasiado antiga. Para deixar de receber as informações sobre este prédio, utilize o botão de uma mensagem mais recente ou escreva a {cabinet}: {contact}.',
  },
  ancienSansContact: {
    fr: 'Ce lien est trop ancien. Pour ne plus recevoir les informations sur cet immeuble, utilisez le bouton d’un message plus récent, ou écrivez au cabinet qui gère votre immeuble.',
    pt: 'Esta ligação é demasiado antiga. Para deixar de receber as informações sobre este prédio, utilize o botão de uma mensagem mais recente ou escreva ao administrador do seu prédio.',
  },
  inconnu: {
    fr: 'Ce lien n’est pas valable. Utilisez le bouton d’un message plus récent, ou écrivez au cabinet : {contact}.',
    pt: 'Esta ligação não é válida. Utilize o botão de uma mensagem mais recente ou escreva ao administrador: {contact}.',
  },
  inconnuSansContact: {
    fr: 'Ce lien n’est pas valable. Utilisez le bouton d’un message plus récent, ou écrivez au cabinet.',
    pt: 'Esta ligação não é válida. Utilize o botão de uma mensagem mais recente ou escreva ao administrador.',
  },
  politique: { fr: 'Politique de confidentialité de {cabinet}', pt: 'Política de privacidade de {cabinet}' },
  enCours: { fr: 'Enregistrement…', pt: 'A registar…' },
  reseau: {
    fr: 'Connexion impossible. Vérifiez votre connexion à internet, puis réessayez.',
    pt: 'Ligação impossível. Verifique a sua ligação à internet e tente novamente.',
  },
  indisponible: {
    fr: 'Le service est momentanément indisponible. Réessayez dans quelques instants.',
    pt: 'O serviço está temporariamente indisponível. Tente novamente dentro de instantes.',
  },
  limite: {
    fr: 'Trop de demandes en peu de temps. Réessayez dans quelques minutes.',
    pt: 'Demasiados pedidos em pouco tempo. Tente novamente dentro de alguns minutos.',
  },
  reessayer: { fr: 'Réessayer', pt: 'Tentar novamente' },
}

/** Textes de la page, par langue de la diffusion. */
export const TEXTES_DESINSCRIPTION_QR = parLangue(TABLE)

/** Remplace « {cle} » par sa valeur (aucun HTML : React échappe le texte). */
export function remplirDesinscriptionQr(modele: string, valeurs: Readonly<Record<string, string>>): string {
  return modele.replace(/\{(\w+)\}/g, (tout, cle: string) => (cle in valeurs ? valeurs[cle] : tout))
}
