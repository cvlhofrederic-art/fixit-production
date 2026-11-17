// ── AJ Signalement — diffusion : modèles de message, message d'annonce figé, messages de refus (PR 3, lot 2) ──────
//
// Cahier PR 3 § 5.4 (modèles), § 3.8 et décision H1 de Hugo du 11/11/2026 (option C : un message d'annonce unique, à
// texte figé, sans aucune information d'immeuble, avec le bouton de refus à effet immédiat ; la personne n'entre dans
// la diffusion que 15 jours après l'annonce si elle n'a pas refusé), décision H3 (les cinq modèles, plus « ascenseur à
// l'arrêt »). Champs entre crochets à remplacer avant l'envoi (sinon refus a_completer). Aucun nom d'entreprise, aucune
// mention de VitFix. Versions portugaises à relire par Hugo (H4) : sans relecture, aucun cabinet PT n'est activé (H9).
// Textes d'écran (noms des modèles, messages de refus) en français, comme tout l'espace ; PR en brouillon, à valider
// par Frédéric (F1).

import type { Bilingue } from '@/lib/aj-signalement/bilingue'
import { nettoyerLigneDiffusionQr, type MotifRefusTexteDiffusionQr } from '@/lib/aj-signalement/diffusion-texte'
import type { LangueSignalementQr } from '@/lib/aj-signalement/types'

/** Modèles d'une diffusion (colonne signalements_qr_diffusions.modele, liste fermée). */
export const MODELES_DIFFUSION_QR = [
  'libre', 'fuite', 'coupure_eau', 'coupure_electricite', 'intervention', 'fin_incident', 'ascenseur_arret', 'annonce',
] as const
export type ModeleDiffusionQr = (typeof MODELES_DIFFUSION_QR)[number]
/** Modèles qui proposent un objet et un texte à compléter. */
export type ModeleRedigeDiffusionQr = Exclude<ModeleDiffusionQr, 'libre' | 'annonce'>

/** Choix du formulaire, dans l'ordre affiché ; l'annonce n'y est pas (bouton dédié sur la carte de la copropriété). */
export const MODELES_SELECTEUR_DIFFUSION_QR: readonly Exclude<ModeleDiffusionQr, 'annonce'>[] = [
  'fuite', 'coupure_eau', 'coupure_electricite', 'intervention', 'ascenseur_arret', 'fin_incident', 'libre',
]

export const NOMS_MODELES_DIFFUSION_QR: Readonly<Record<ModeleDiffusionQr, string>> = {
  fuite: 'Fuite en cours',
  coupure_eau: 'Coupure d’eau',
  coupure_electricite: 'Coupure d’électricité',
  intervention: 'Intervention programmée',
  ascenseur_arret: 'Ascenseur à l’arrêt',
  fin_incident: 'Fin d’incident',
  libre: 'Message libre',
  annonce: 'Annonce de la diffusion aux déclarants actuels',
}

export interface TexteDiffusionQr {
  objet: string
  texte: string
}

/** Objet et texte proposés par chaque modèle, dans la langue du cabinet (celle de la diffusion). */
export const TEXTES_MODELES_DIFFUSION_QR: Readonly<Record<ModeleRedigeDiffusionQr, Bilingue<TexteDiffusionQr>>> = {
  fuite: {
    fr: {
      objet: 'Fuite en cours — [lieu]',
      texte: 'Une fuite d’eau est en cours [lieu : bâtiment, étage, parties communes]. Une intervention est organisée. '
        + '[Consigne : merci de ne pas utiliser…, de laisser l’accès…]. Nous vous informerons de la fin de l’incident.',
    },
    pt: {
      objet: 'Fuga de água em curso — [local]',
      texte: 'Está em curso uma fuga de água [local: bloco, piso, partes comuns]. Está a ser organizada uma intervenção. '
        + '[Indicação: agradecemos que não utilize…, que deixe o acesso…]. Informaremos quando o incidente terminar.',
    },
  },
  coupure_eau: {
    fr: {
      objet: 'Coupure d’eau le [date] de [heure] à [heure]',
      texte: 'L’eau sera coupée le [date], de [heure de début] à [heure de fin], [périmètre], pour [motif]. '
        + 'Pensez à faire une réserve d’eau et à fermer vos robinets pendant la coupure.',
    },
    pt: {
      objet: 'Corte de água a [data] das [hora] às [hora]',
      texte: 'A água será cortada a [data], das [hora de início] às [hora de fim], [perímetro], para [motivo]. '
        + 'Faça uma reserva de água e mantenha as torneiras fechadas durante o corte.',
    },
  },
  coupure_electricite: {
    fr: {
      objet: 'Coupure d’électricité le [date] de [heure] à [heure]',
      texte: 'L’électricité sera coupée le [date], de [heure de début] à [heure de fin], [périmètre], pour [motif]. '
        + 'L’ascenseur et l’éclairage des parties communes ne fonctionneront pas pendant la coupure.',
    },
    pt: {
      objet: 'Corte de eletricidade a [data] das [hora] às [hora]',
      texte: 'A eletricidade será cortada a [data], das [hora de início] às [hora de fim], [perímetro], para [motivo]. '
        + 'O elevador e a iluminação das partes comuns não funcionarão durante o corte.',
    },
  },
  intervention: {
    fr: {
      objet: 'Intervention le [date] — [objet de l’intervention]',
      texte: 'Une intervention [objet : entretien de l’ascenseur, ramonage…] aura lieu le [date], de [heure de début] à '
        + '[heure de fin], [lieu]. [Consigne : accès aux logements nécessaire / aucune démarche de votre part.]',
    },
    pt: {
      objet: 'Intervenção a [data] — [objeto da intervenção]',
      texte: 'Terá lugar uma intervenção [objeto: manutenção do elevador, limpeza de chaminés…] a [data], '
        + 'das [hora de início] às [hora de fim], [local]. [Indicação: acesso às frações necessário / nenhuma ação da sua parte.]',
    },
  },
  fin_incident: {
    fr: {
      objet: 'Fin de l’incident — [objet]',
      texte: 'L’incident [objet] est terminé. [Précision éventuelle.] Merci de votre patience.',
    },
    pt: {
      objet: 'Fim do incidente — [objeto]',
      texte: 'O incidente [objeto] terminou. [Informação adicional.] Obrigado pela sua paciência.',
    },
  },
  // Décision H3 (Hugo, 11/11/2026) : modèle ajouté aux cinq du cahier.
  ascenseur_arret: {
    fr: {
      objet: 'Ascenseur à l’arrêt — [bâtiment]',
      texte: 'L’ascenseur [bâtiment] est à l’arrêt depuis le [date] [motif : panne, intervention en cours…]. Une '
        + 'intervention est demandée. [Consigne : merci d’utiliser l’escalier…]. Nous vous informerons de sa remise en service.',
    },
    pt: {
      objet: 'Elevador parado — [bloco]',
      texte: 'O elevador [bloco] está parado desde [data] [motivo: avaria, intervenção em curso…]. Foi pedida uma '
        + 'intervenção. [Indicação: agradecemos que utilize as escadas…]. Informaremos quando voltar a funcionar.',
    },
  },
}

// ── Message d'annonce (H1, option C) ──

/** Délai entre le message d'annonce et l'entrée dans la diffusion, fixé par Hugo le 11/11/2026 (droit, H1). */
export const DELAI_ANNONCE_DIFFUSION_JOURS = 15

// Texte figé : qui écrit (le cabinet), pourquoi la personne le reçoit, ce qu'elle recevra, quand, comment refuser
// (conditions 1 à 5 de la note juridique, « Complément du 11/11 ») ; aucune information d'exploitation. Le bouton
// de refus, la raison de l'envoi et le pied (copropriété, politique, contact) viennent du gabarit de diffusion.
const ANNONCE: Bilingue<TexteDiffusionQr> = {
  fr: {
    objet: 'Informations sur votre immeuble par e-mail',
    texte: 'Vous avez signalé un problème dans cette copropriété. Désormais, {cabinet} pourra vous informer par e-mail '
      + 'des incidents qui concernent votre immeuble : fuite, coupure, intervention. Aucune de ces informations ne vous '
      + `sera envoyée pendant les ${DELAI_ANNONCE_DIFFUSION_JOURS} jours qui suivent ce message.\n\n`
      + 'Si vous ne souhaitez pas les recevoir, utilisez le bouton ci-dessous : votre choix prend effet immédiatement. '
      + 'Vous continuerez à recevoir la confirmation de vos propres signalements.',
  },
  pt: {
    objet: 'Informações sobre o seu prédio por e-mail',
    texte: 'Comunicou um problema neste condomínio. A partir de agora, {cabinet} poderá enviar-lhe por e-mail '
      + 'informações sobre os incidentes que dizem respeito ao seu prédio: fuga, corte, intervenção. Nenhuma destas '
      + `informações lhe será enviada nos ${DELAI_ANNONCE_DIFFUSION_JOURS} dias seguintes a esta mensagem.\n\n`
      + 'Se não pretender recebê-las, utilize o botão abaixo: a sua escolha produz efeito imediato. '
      + 'Continuará a receber a confirmação das suas próprias ocorrências.',
  },
}

/** Désignation de repli si le nom du cabinet est vide une fois nettoyé (garde : le nom est obligatoire en base). */
const CABINET_PAR_DEFAUT: Bilingue<string> = { fr: 'le cabinet qui gère cette copropriété', pt: 'a administração deste condomínio' }

/** Objet et texte exacts du message d'annonce, au nom du cabinet (nom nettoyé : retours et invisibles retirés). */
export function annonceDiffusionQr(langue: LangueSignalementQr, cabinet: string): TexteDiffusionQr {
  const nom = nettoyerLigneDiffusionQr(cabinet) || CABINET_PAR_DEFAUT[langue]
  const { objet, texte } = ANNONCE[langue]
  // Remplacement par fonction : un « $ » dans le nom du cabinet reste un caractère.
  return { objet, texte: texte.replace('{cabinet}', () => nom) }
}

const formeComparee = (texte: string): string => texte.replace(/\r\n?/g, '\n').normalize('NFC').trim()

/** L'objet et le texte reçus sont-ils exactement ceux du message d'annonce (route : 400 sinon, cahier § 5.4) ? */
export function estAnnonceFigeeQr(langue: LangueSignalementQr, cabinet: string, saisie: TexteDiffusionQr): boolean {
  const attendu = annonceDiffusionQr(langue, cabinet)
  return formeComparee(saisie.objet) === attendu.objet && formeComparee(saisie.texte) === attendu.texte
}

// ── Messages de refus du texte (affichés sous le champ, Encadre « alert ») ──

export const MESSAGES_REFUS_TEXTE_DIFFUSION_QR: Readonly<Record<MotifRefusTexteDiffusionQr, string>> & { readonly conseilEspaceApresPoint: string } = {
  lien: 'Le message ne peut contenir aucun lien ni adresse de site (http, www, nom de domaine).',
  adresse_email: 'Le message ne peut contenir aucune adresse e-mail : pour écrire au cabinet, les personnes répondent au message.',
  caractere: 'Le message contient un caractère non autorisé (caractère invisible ou de contrôle, ou symbole dans un nom de bâtiment ou d’étage).',
  a_completer: 'Complétez ou retirez les champs du modèle écrits entre crochets.',
  telephone: 'Seuls les numéros de téléphone déclarés par le cabinet (astreinte, gardien) peuvent figurer dans le message.',
  terme_commercial: 'Le message porte sur l’immeuble seulement : ni offre, ni devis, ni prix, ni entreprise à recommander.',
  longueur: 'Longueur non permise : objet de 3 à 120 caractères, texte de 10 à 2 000 caractères, nom de bâtiment ou d’étage de 50 caractères au plus.',
  lignes: 'Le texte ne peut pas dépasser 30 lignes.',
  conseilEspaceApresPoint: 'Si ce point sépare deux phrases, ajoutez une espace après le point.',
}
