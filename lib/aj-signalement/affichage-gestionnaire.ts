// ── Libellés et calculs d'affichage de l'espace d'un cabinet, vu par un gestionnaire (PR 2, lot 5) ─────────────
//
// vitfix.io/<identifiant>/suivi/ (SPEC § 2.8, décisions de Hugo du 11/11/2026) : la même coquille et les mêmes vues que
// l'espace global (Tableau de bord, Copropriétés, Signalements), limitées par le serveur à la portée du gestionnaire.
// Fonctions pures, sans React ; textes en français (tout l'espace est en français). Aucun texte ne parle du super admin
// ni d'une migration : un gestionnaire n'a pas à le savoir (« Fonction pas encore activée. »). Textes d'écran : PR en
// brouillon, à valider par Frédéric.

import type { CodeErreurQr } from '@/lib/aj-signalement/api'
import { messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import { emailCanoniqueQr, emailDansDomainesQr } from '@/lib/aj-signalement/gestionnaires'
import type { AuteurStatutQr, CoproprieteQr } from '@/lib/aj-signalement/types'
import type { VueEspaceQr } from '@/lib/aj-signalement/acces-espace'

export const TEXTES_ESPACE_CABINET_QR = {
  chargement: 'Chargement de votre espace…',
  accesRetire: 'Votre accès a été retiré par le cabinet.',
  indisponible: 'Fonction pas encore activée.',
  reseau: 'Connexion impossible, réessayez.',
  /** Sous-titres des vues (celui des copropriétés ne parle pas des gestionnaires : il ne les voit pas). */
  sousTitres: {
    'tableau-de-bord': 'Vue d’ensemble des signalements de vos copropriétés',
    coproprietes: 'QR codes, affiches et destinataires des e-mails',
    signalements: 'Signalements reçus, détail et suivi',
  } as Partial<Record<VueEspaceQr, string>>,
  emailNonEnvoye: 'E-mail non envoyé.',
  copropriete: {
    creeeParVous: 'Créée par vous',
    commune: 'Commune à tous les gestionnaires',
    communeLectureSeule: 'Commune à tous les gestionnaires : fiche modifiable par le cabinet seulement.',
    lectureSeule: 'Fiche modifiable par le cabinet seulement.',
    desactivee: 'QR code désactivé par le cabinet',
    adressesMasquees: '{n} adresse(s) du cabinet masquée(s)',
    destinataires: 'Destinataires supplémentaires :',
    aucunDestinataire: 'aucun (les gestionnaires de la copropriété reçoivent ses signalements)',
    creee: 'Copropriété créée. Elle vous est attribuée.',
    modifiee: 'Copropriété enregistrée.',
  },
  formulaire: {
    nom: 'Nom de la copropriété',
    adresse: 'Adresse',
    codePostal: 'Code postal',
    ville: 'Ville',
    immatriculation: 'N° d’immatriculation (facultatif)',
    reference: 'Référence du cabinet (facultatif)',
    batiments: 'Bâtiments (facultatif, séparés par des virgules)',
    emails: 'Destinataires supplémentaires (facultatif)',
    emailsAide: 'Adresses du cabinet seulement : {domaines}. Séparées par des virgules ; vous recevez déjà ses signalements par votre attribution.',
    emailsSansDomaine: 'Aucun domaine e-mail n’est déclaré pour votre cabinet : vous ne pouvez pas ajouter d’adresse.',
    champsRequis: 'Renseignez le nom, l’adresse, le code postal et la ville.',
    horsDomaine: 'Adresse(s) hors des domaines du cabinet : {liste}',
    doublonCabinet: 'Cette copropriété existe déjà au cabinet. Demandez son attribution à l’administrateur.',
    doublonVous: 'Elle est déjà dans vos copropriétés : {nom}.',
    doublonProbable: 'Une copropriété semblable existe ailleurs. S’agit-il d’une autre copropriété ?',
    // Relecture du lot 6 (texte à valider par Frédéric) : doublon probable nommé (dans sa portée).
    doublonProbableVous: 'Une copropriété semblable est déjà dans vos copropriétés : {nom}. S’agit-il d’une autre copropriété ?',
    ouiCreer: 'Oui, créer',
    ouiEnregistrer: 'Oui, enregistrer',
    voirDoublon: 'Voir cette copropriété',
    refuse: 'Enregistrement refusé : vérifiez les champs. Les destinataires ajoutés sont des adresses du cabinet, jamais celle d’un gestionnaire.',
  },
  statut: {
    vous: 'Statut modifié par vous',
    collegue: 'Statut modifié par un collègue',
    cabinet: 'Statut modifié par le cabinet',
  } satisfies Record<AuteurStatutQr, string>,
} as const

const E = TEXTES_ESPACE_CABINET_QR

/** Textes propres au gestionnaire ; les autres codes gardent le message commun (messageErreurTableauQr). */
const MESSAGES_GESTIONNAIRE_QR: Partial<Record<CodeErreurQr, string>> = {
  acces_retire: E.accesRetire,
  lecture_seule: E.copropriete.lectureSeule,
  base_absente: E.indisponible,
  reseau: E.reseau,
  non_authentifie: 'Votre session a expiré : reconnectez-vous.',
  interdit: 'Cette action est réservée au cabinet.',
  serveur: 'Le service ne répond pas pour le moment. Réessayez dans un instant.',
  introuvable: 'Élément introuvable : il n’est plus dans vos copropriétés. Mettez à jour la page.',
  doublon: 'Cette copropriété existe déjà au cabinet.',
  invalide: E.formulaire.refuse,
  sans_cabinet: 'Cette action est réservée au cabinet.',
  domaines_a_renseigner: E.formulaire.emailsSansDomaine,
  hors_domaine: 'Cette adresse n’est pas dans les domaines e-mail du cabinet.',
}

/** Message d'un échec pour un gestionnaire connecté (jamais un texte du serveur, du super admin ou d'une migration). */
export function messageErreurGestionnaireQr(code: CodeErreurQr): string {
  return MESSAGES_GESTIONNAIRE_QR[code] ?? messageErreurTableauQr(code)
}

/** Copropriétés du gestionnaire : actives d'abord, désactivées par le cabinet regroupées en bas ; ordre du serveur gardé. */
export function coproprietesGestionnaireOrdonneesQr<T extends Pick<CoproprieteQr, 'actif'>>(coproprietes: readonly T[]): T[] {
  return [...coproprietes.filter((c) => c.actif), ...coproprietes.filter((c) => !c.actif)]
}

/**
 * Destinataires AJOUTÉS (absents des saisies existantes) hors des domaines du cabinet (égalité exacte du domaine) ; sans
 * domaine déclaré, tous les ajouts. Contrôle d'écran avant l'envoi : le serveur refait tout (domaines, adresses de fiches).
 */
export function adressesHorsDomaineQr(emails: readonly string[], existantes: readonly string[], domaines: readonly string[]): string[] {
  const deja = new Set(existantes.map(emailCanoniqueQr).filter((e): e is string => e !== null))
  return emails.filter((email) => {
    const canonique = emailCanoniqueQr(email)
    return canonique !== null && !deja.has(canonique) && !emailDansDomainesQr(canonique, domaines)
  })
}

/** Ancre de la carte d'une copropriété dans la vue d'un gestionnaire (« Voir cette copropriété » d'un doublon). */
export const idCarteCoproprieteQr = (id: string): string => `copropriete-${id}`

/** Mention du dernier changement de statut, sans nom ; null : jamais changé (ou vue du super admin). */
export function texteAuteurStatutQr(auteur: AuteurStatutQr | null | undefined): string | null {
  return auteur ? E.statut[auteur] : null
}
