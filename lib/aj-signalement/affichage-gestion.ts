// ── Libellés et calculs d'affichage des écrans du super admin (cabinets, gestionnaires, journal) ──────────────
//
// Demandes de Hugo du 10/11/2026 : cabinets clients (adresse vitfix.io/<identifiant>/, domaines e-mail), fiches des
// gestionnaires et leur page de suivi, journal. Fonctions pures, sans React ; textes en français (outil de
// l'administrateur), apostrophe typographique comme le reste de l'espace. La page publique de confirmation d'adresse
// (vitfix.io/<identifiant>/confirmation-adresse/) a ses textes ici aussi (FR seulement, SPEC § 1.7.4).

import {
  type ActionJournalQr, type AnalyseDomainesQr, type AttributionVueQr, type CoproprieteQr, type DecisionDepartQr, type EtatGestionnaireQr,
  type EvenementJournalQr, type FiltreCoproprietesQr, type GestionnaireQr, type GroupesDepartQr, type OrigineAttributionQr,
} from '@/lib/aj-signalement/types'
import { validerDomaineCabinetQr } from '@/lib/aj-signalement/gestionnaires'

/** Teinte d'une pastille (socle UI du portail copropriétaire). */
export type TonPastilleQr = 'vert' | 'ambre' | 'rouge' | 'gris' | 'bleu' | 'or'

export const LIBELLE_ETAT_GESTIONNAIRE_QR: Record<EtatGestionnaireQr, string> = {
  confirmation_envoyee: 'Confirmation envoyée',
  confirmation_expiree: 'Confirmation expirée',
  adresse_confirmee: 'Adresse confirmée',
  adresse_contestee: 'Adresse contestée par son destinataire',
  desactive: 'Désactivé',
  // PR 2 (accès des gestionnaires à leur page) : libellés posés une fois, comme la liste fermée.
  acces_envoye: 'Accès envoyé',
  acces_ouvert: 'Accès ouvert',
  refus_autre_espace: 'Adresse déjà utilisée par un autre espace',
  effacement_demande: 'Demande d’effacement',
}

export const TON_ETAT_GESTIONNAIRE_QR: Record<EtatGestionnaireQr, TonPastilleQr> = {
  confirmation_envoyee: 'bleu',
  confirmation_expiree: 'ambre',
  adresse_confirmee: 'vert',
  adresse_contestee: 'rouge',
  desactive: 'gris',
  acces_envoye: 'bleu',
  acces_ouvert: 'vert',
  refus_autre_espace: 'rouge',
  effacement_demande: 'ambre',
}

/** Origine d'une attribution, telle que la page profil l'affiche (SPEC § 1.8). */
export const LIBELLE_ORIGINE_ATTRIBUTION_QR: Record<OrigineAttributionQr, string> = {
  super_admin: 'attribuée',
  creation: 'créée par lui',
  import: 'importée',
  reattribution: 'réattribuée',
}

/** Action du journal en clair (liste fermée ACTIONS_JOURNAL_QR). */
export const LIBELLE_ACTION_JOURNAL_QR: Record<ActionJournalQr, string> = {
  'cabinet.cree': 'Cabinet créé',
  'cabinet.modifie': 'Cabinet modifié',
  'cabinet.domaines_modifies': 'Domaines e-mail du cabinet modifiés',
  'copropriete.creee': 'Copropriété créée',
  'copropriete.modifiee': 'Copropriété modifiée',
  'copropriete.desactivee': 'QR code désactivé',
  'copropriete.reactivee': 'QR code réactivé',
  'copropriete.jeton_remplace': 'QR code remplacé',
  'copropriete.supprimee': 'Copropriété supprimée',
  'copropriete.tous_active': 'Attribuée à tous les gestionnaires',
  'copropriete.tous_retire': 'N’est plus attribuée à tous',
  'copropriete.rattachee': 'Copropriété rattachée au cabinet',
  'attribution.ajoutee': 'Copropriété attribuée',
  'attribution.retiree': 'Attribution retirée',
  'gestionnaire.cree': 'Fiche gestionnaire créée',
  'gestionnaire.modifie': 'Fiche gestionnaire modifiée',
  'gestionnaire.confirmation_envoyee': 'Lien de confirmation envoyé',
  'gestionnaire.adresse_confirmee': 'Adresse confirmée',
  'gestionnaire.adresse_contestee': 'Adresse contestée (« Ce n’est pas moi »)',
  'gestionnaire.domaine_force': 'Adresse hors des domaines acceptée',
  'gestionnaire.desactive': 'Départ : fiche désactivée',
  'gestionnaire.reactive': 'Fiche réactivée',
  'gestionnaire.pseudonymise': 'Données de la fiche effacées',
  'gestionnaire.exporte': 'Données de la fiche exportées',
  'gestionnaire.acces_envoye': 'Accès à sa page envoyé',
  'gestionnaire.acces_ouvert': 'Accès à sa page ouvert',
  'gestionnaire.refus_autre_espace': 'Accès refusé : compte d’un autre espace',
  'gestionnaire.connexion_bloquee': 'Connexion bloquée',
  'gestionnaire.effacement_demande': 'Effacement demandé',
  'signalement.statut': 'Statut d’un signalement changé',
  'doublon.refuse': 'Doublon refusé',
  'doublon.force': 'Doublon forcé (« Ce n’est pas un doublon »)',
  'import.realise': 'Import réalisé',
  'journal.purge': 'Purge du journal (plus de 12 mois)',
}

/** Auteur d'une ligne du journal : « Administrateur », le nom du gestionnaire (« Ancien gestionnaire » s'il est effacé), « Système ». */
export function auteurJournalQr(e: Pick<EvenementJournalQr, 'acteur'>): string {
  if (e.acteur.profil === 'super_admin') return 'Administrateur'
  if (e.acteur.profil === 'systeme') return 'Système'
  return e.acteur.nom ?? TEXTES_GESTION_QR.fiche.ancien
}

/** « 4 novembre 2026 », à l'heure de Paris ; la chaîne brute si la date est illisible. */
export function dateParisQr(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long' }).format(date)
}

// ── Copropriétés ─────────────────────────────────────────────────────────────

/** Copropriétés retenues par un filtre de la vue Copropriétés ; filtre inconnu : toutes. */
export function filtrerCoproprietesQr(coproprietes: readonly CoproprieteQr[], filtre: FiltreCoproprietesQr): CoproprieteQr[] {
  if (filtre === 'sans_cabinet') return coproprietes.filter((c) => c.cabinet === null)
  if (filtre === 'sans_gestionnaire') return coproprietes.filter((c) => c.gestionnaires.length === 0 && !c.attribueeATous)
  if (filtre === 'a_tous') return coproprietes.filter((c) => c.attribueeATous)
  if (filtre === 'adresses_gestionnaires') return coproprietes.filter((c) => c.adressesDeGestionnaires > 0)
  if (filtre.startsWith('gestionnaire:')) {
    const id = filtre.slice('gestionnaire:'.length)
    return coproprietes.filter((c) => c.gestionnaires.some((g) => g.id === id))
  }
  return [...coproprietes]
}

/**
 * Fiches à qui l'on peut confier une copropriété (attribution, succession) : même cabinet, fiche active et adresse
 * non contestée (une adresse contestée ne reçoit rien) ; `sauf` : la fiche qui part.
 */
export function gestionnairesAttribuablesQr(gestionnaires: readonly GestionnaireQr[], cabinetId: string | null | undefined, sauf?: string): GestionnaireQr[] {
  if (!cabinetId) return []
  return gestionnaires.filter((g) => g.cabinet.id === cabinetId && g.id !== sauf && g.etat !== 'desactive' && g.etat !== 'adresse_contestee')
}

// ── Départ d'un gestionnaire ─────────────────────────────────────────────────

/** Copropriétés attribuées, séparées : il en est le seul gestionnaire (ou la copropriété est inconnue), ou d'autres restent. */
export function groupesDepartQr(ficheId: string, attributions: readonly AttributionVueQr[], coproprietes: readonly CoproprieteQr[]): GroupesDepartQr {
  const parId = new Map(coproprietes.map((c) => [c.id, c]))
  const seul: AttributionVueQr[] = []
  const partages: AttributionVueQr[] = []
  for (const a of attributions) {
    const autres = parId.get(a.coproprieteId)?.gestionnaires.filter((g) => g.id !== ficheId) ?? []
    ;(autres.length > 0 ? partages : seul).push(a)
  }
  return { seul, partages }
}

/** Valeur d'un choix de successeur : '' non choisi, 'sans' : laisser sans gestionnaire, sinon l'id du successeur. */
export const SANS_GESTIONNAIRE_QR = 'sans'

/** Une succession par copropriété : exigée pour chacune dont il est le seul gestionnaire ; les autres partent sans successeur. */
export function successionsDepartQr(groupes: GroupesDepartQr, choix: Readonly<Record<string, string>>): DecisionDepartQr {
  const manquantes = groupes.seul.filter((a) => !choix[a.coproprieteId]).map((a) => a.coproprieteId)
  if (manquantes.length > 0) return { ok: false, manquantes }
  return {
    ok: true,
    successions: [
      ...groupes.seul.map((a) => ({ coproprieteId: a.coproprieteId, versGestionnaireId: choix[a.coproprieteId] === SANS_GESTIONNAIRE_QR ? null : choix[a.coproprieteId] })),
      ...groupes.partages.map((a) => ({ coproprieteId: a.coproprieteId, versGestionnaireId: null })),
    ],
  }
}

// ── Cabinets ─────────────────────────────────────────────────────────────────

/** Domaines saisis (virgules, points-virgules ou espaces) : rognés, minuscules, sans doublon ; refusés à part. */
export function analyserDomainesQr(texte: string): AnalyseDomainesQr {
  const domaines: string[] = []
  const invalides: string[] = []
  for (const brut of texte.split(/[\s,;]+/)) {
    const d = brut.trim().toLowerCase()
    if (!d) continue
    if (!validerDomaineCabinetQr(d).ok) invalides.push(brut.trim())
    else if (!domaines.includes(d)) domaines.push(d)
  }
  return { domaines, invalides }
}

/** Aperçu de l'adresse des QR codes d'un cabinet. */
export const apercuCheminCabinetQr = (identifiant: string): string => `vitfix.io/${identifiant || '<identifiant>'}/signalement/…`

// ── Textes ───────────────────────────────────────────────────────────────────

export const TEXTES_GESTION_QR = {
  chargement: 'Chargement…',
  reessayer: 'Réessayer',
  fermer: 'Fermer la fenêtre',
  annuler: 'Annuler',
  enregistrer: 'Enregistrer',
  cabinets: {
    intro: 'Chaque cabinet client a son adresse vitfix.io/<identifiant>/ (QR codes de ses copropriétés, confirmation des adresses de ses gestionnaires) et ses domaines e-mail : un gestionnaire n’est accepté que sur un domaine de son cabinet.',
    nouveau: 'Nouveau cabinet',
    titreCreation: 'Nouveau cabinet client',
    titreModification: 'Modifier le cabinet',
    modifier: 'Modifier',
    aucun: 'Aucun cabinet client pour le moment : créez-en un pour lui rattacher des copropriétés et des gestionnaires.',
    nom: 'Nom du cabinet',
    nomRequis: 'Indiquez le nom du cabinet.',
    identifiant: 'Identifiant de l’adresse',
    identifiantAide: 'Adresse des QR codes : {apercu}',
    identifiantFige: 'Identifiant figé : le cabinet a déjà des copropriétés ou des gestionnaires (QR codes et liens en circulation).',
    identifiantReserve: 'Cet identifiant est réservé par le site : choisissez-en un autre.',
    identifiantFormat: 'Identifiant : 3 à 40 caractères, minuscules, chiffres et tirets simples, commençant par une lettre.',
    langue: 'Langue de la page de signalement',
    langues: { fr: 'Français', pt: 'Portugais' },
    domaines: 'Domaines e-mail des gestionnaires',
    domainesAide: 'Séparés par des virgules (exemple : cabinet.fr), 20 au plus. Seules ces adresses peuvent devenir des gestionnaires ; les destinataires hors de ces domaines demandent une confirmation.',
    domainesInvalides: 'Domaine(s) refusé(s) (format, ou messagerie publique) : {liste}.',
    domainesTrop: 'Vingt domaines au plus.',
    creer: 'Créer le cabinet',
    cree: 'Cabinet créé.',
    modifie: 'Cabinet enregistré.',
    fichesHorsDomaines: 'Ces fiches ne sont plus dans les domaines du cabinet (elles restent actives, à vérifier) : {noms}.',
    adresse: 'vitfix.io/{identifiant}/',
    langueLigne: 'Langue de la page : {langue}',
    domainesLigne: 'Domaines : {domaines}',
    aucunDomaine: 'aucun (à renseigner avant d’ajouter des gestionnaires)',
    compteurs: '{copros} copropriété(s) · {gestionnaires} gestionnaire(s)',
    fige: 'Identifiant figé',
    sansCabinet: 'Copropriétés sans cabinet ({n})',
    sansCabinetAide: 'Elles gardent l’ancienne adresse vitfix.io/fr/signalement/… et n’ont aucun gestionnaire. Rattachez-les à leur cabinet.',
    choisirCopros: 'Copropriétés à rattacher',
    rattacherA: 'Cabinet de rattachement',
    choisirCabinet: 'Choisir…',
    rattacher: 'Rattacher…',
    rattachementAvertissement: 'L’adresse du QR code deviendra vitfix.io/{identifiant}/signalement/… ; les affiches déjà imprimées restent valables. Rattachement définitif.',
    confirmerRattachement: 'Oui, rattacher définitivement',
    choisirAuMoinsUne: 'Choisissez au moins une copropriété et le cabinet.',
    rattachees: '{n} copropriété(s) rattachée(s).',
    voirJournal: 'Voir le journal',
  },
  gestionnaires: {
    liste: 'Gestionnaires',
    intro: 'Chaque gestionnaire reçoit par e-mail les signalements de ses copropriétés, une fois son adresse confirmée.',
    ajouter: 'Ajouter un gestionnaire',
    aucun: 'Aucun gestionnaire pour le moment.',
    titreCreation: 'Nouveau gestionnaire',
    nom: 'Nom et prénom',
    email: 'E-mail professionnel',
    cabinet: 'Cabinet',
    choisirCabinet: 'Choisir…',
    coproprietes: 'Copropriétés à attribuer (facultatif)',
    aide: 'Une adresse nominative par personne, jamais une boîte partagée. Un e-mail de confirmation lui est envoyé ; il ne recevra les signalements qu’après avoir confirmé.',
    nomRequis: 'Indiquez le nom.',
    emailInvalide: 'Adresse e-mail invalide.',
    cabinetRequis: 'Choisissez le cabinet.',
    horsDomaine: 'Cette adresse n’est pas dans les domaines du cabinet ({domaines}). Vérifiez-la : la personne qui confirmera recevra les coordonnées des déclarants.',
    corriger: 'Corriger',
    creerQuandMeme: 'Créer quand même',
    creer: 'Créer et envoyer la confirmation',
    domainesARenseigner: 'Ce cabinet n’a encore aucun domaine e-mail : renseignez-les d’abord.',
    versCabinets: 'Domaines du cabinet',
    ouvrirFiche: 'Ouvrir la fiche',
    cree: 'Fiche créée : un e-mail de confirmation est parti vers {email}.',
    creeSansEmail: 'Fiche créée, mais l’e-mail de confirmation n’est pas parti : utilisez « Renvoyer la confirmation ».',
    dejaDestinataire: 'Elle reçoit déjà les signalements de {n} copropriété(s) comme destinataire saisi : attribuez-lui ces copropriétés puis retirez l’adresse saisie.',
    ouvrir: 'Ouvrir',
    renvoyer: 'Renvoyer la confirmation',
    renvoye: 'Confirmation renvoyée à {email}.',
    renvoiSansEmail: 'L’e-mail de confirmation n’est pas parti. Réessayez plus tard.',
    reactiver: 'Réactiver',
    reactive: 'Fiche réactivée.',
    domaineForce: 'Hors des domaines du cabinet (forcé)',
    compteurs: '{copros} copropriété(s) · {ouverts} ouvert(s) · {urgents} urgent(s)',
    ajouteLe: 'Ajouté le {date}',
    confirmeeLe: 'Adresse confirmée le {date}',
    filtreCabinet: 'Cabinet',
    tousCabinets: 'Tous les cabinets',
  },
  fiche: {
    retour: 'Retour à la liste',
    ancien: 'Ancien gestionnaire',
    cabinet: 'Cabinet : {nom}',
    modifierNom: 'Modifier le nom',
    nouveauNom: 'Nom et prénom',
    nomEnregistre: 'Nom enregistré.',
    envois: 'Envois',
    aucunEnvoi: 'Aucun envoi.',
    objets: { confirmation_adresse: 'Confirmation d’adresse', acces: 'Accès à sa page' },
    envoiDemande: 'demandé le {date}',
    envoiParti: 'parti le {date}',
    envoiNonParti: 'e-mail non parti',
    envoiConfirme: 'confirmé le {date}',
    envoiRefuse: 'réponse : « Ce n’est pas moi »',
    suivi: 'Sa page de suivi',
    suiviAide: 'Ses copropriétés et leurs signalements, tels qu’il les verra.',
    attribuees: 'Copropriétés attribuées ({n})',
    aucuneAttribuee: 'Aucune copropriété attribuée.',
    attribueeLe: '{origine} le {date}',
    retirer: 'Retirer',
    ajouterCopros: 'Ajouter des copropriétés',
    attribuer: 'Attribuer',
    choisirCopros: 'Copropriétés de son cabinet',
    attributionsEnregistrees: 'Attributions enregistrées.',
    adressesRetirees: '{n} adresse(s) saisie(s) retirée(s), remplacée(s) par l’attribution.',
    communes: 'Communes à tous les gestionnaires ({n})',
    communesAide: 'Copropriétés « attribuées à tous » de son cabinet : lecture, statuts et e-mails, sans modification de la fiche.',
    creations: 'Créations ({n})',
    activite: 'Activité',
    aucuneActivite: 'Aucune action enregistrée.',
    exporter: 'Exporter ses données (RGPD)',
    exportPret: 'Export téléchargé.',
    depart: 'Départ…',
    effacer: 'Effacer ses données',
    effacerAvertissement: 'Le nom et l’adresse seront effacés définitivement ; l’historique reste, sans nom.',
    confirmerEffacer: 'Oui, effacer définitivement',
    efface: 'Données effacées.',
  },
  suivi: {
    aucune: 'Aucune copropriété dans sa portée.',
    compteurs: '{ouverts} ouvert(s) · {urgents} urgent(s) · {attente} en attente depuis plus de 48 h',
    dernier: 'Dernier signalement : {date}',
    aTous: 'Commune à tous',
    voir: 'Voir les signalements',
    masquer: 'Masquer les signalements',
    filtre: 'Signalements',
    ouverts: 'Ouverts',
    tous: 'Tous',
    aucunSignalement: 'Aucun signalement.',
    voirPlus: 'Voir plus',
    voirDetail: 'Détail',
  },
  depart: {
    titre: 'Départ de {nom}',
    seul: 'Il en est le seul gestionnaire ({n})',
    partages: 'D’autres gestionnaires restent ({n})',
    partagesAide: 'Ces copropriétés lui sont simplement retirées.',
    aucune: 'Aucune copropriété attribuée : la fiche sera désactivée.',
    successeur: 'Successeur pour {nom}',
    choisir: 'Choisir…',
    sansGestionnaire: 'Laisser sans gestionnaire',
    memePourToutes: 'Le même pour toutes',
    avertissement: 'Sans gestionnaire, ces copropriétés n’envoient plus qu’aux adresses saisies, ou à l’administrateur.',
    manquantes: 'Choisissez un successeur, ou « Laisser sans gestionnaire », pour : {noms}.',
    confirmer: 'Confirmer le départ',
    fait: 'Départ enregistré : fiche désactivée, {deplacees} copropriété(s) confiée(s), {sans} laissée(s) sans gestionnaire.',
  },
  journal: {
    liste: 'Journal des actions',
    filtreAction: 'Action',
    toutesActions: 'Toutes les actions',
    filtreCopro: 'Copropriété',
    toutesCopros: 'Toutes',
    filtreGestionnaire: 'Gestionnaire',
    tousGestionnaires: 'Tous',
    aucun: 'Aucune action enregistrée pour ces filtres.',
    voirPlus: 'Voir plus',
    champs: 'Champs : {champs}',
    conservation: 'Conservation : 12 mois.',
  },
  copropriete: {
    cabinet: 'Cabinet',
    sansCabinet: 'Sans cabinet (ancienne adresse /fr/signalement/…)',
    cabinetActuel: 'Cabinet : {nom}',
    sansCabinetModif: 'Sans cabinet : le rattachement se fait depuis la vue Cabinets.',
    codePostal: 'Code postal (facultatif)',
    ville: 'Ville (facultatif)',
    immatriculation: 'N° d’immatriculation (facultatif)',
    reference: 'Référence du cabinet (facultatif)',
    batiments: 'Bâtiments (facultatif, séparés par des virgules)',
    gestionnaires: 'Gestionnaires',
    aucunGestionnaire: 'Aucun gestionnaire actif dans ce cabinet.',
    aTous: 'Attribuer à tous les gestionnaires du cabinet',
    aTousRappel: 'Copropriété de test : tous les gestionnaires actifs du cabinet la voient, changent le statut de ses signalements et reçoivent ses e-mails ; seule une attribution nominative permet de modifier la fiche.',
    doublon: 'Une copropriété semblable existe : {nom}, {ville}.',
    ouvrirDoublon: 'Ouvrir',
    pasDoublon: 'Ce n’est pas un doublon, créer',
    creerQuandMeme: 'Créer quand même',
    doublonBloquant: 'Même immatriculation ou même référence : ce doublon ne peut pas être forcé.',
    horsDomaine: 'Une adresse saisie n’est pas dans les domaines du cabinet : elle recevra les coordonnées des déclarants. Confirmer ?',
    confirmerHorsDomaine: 'Oui, confirmer ces adresses',
    adresseGestionnaire: 'C’est l’adresse d’un gestionnaire : attribuez-lui la copropriété ({liste}).',
    supprimer: 'Supprimer la copropriété',
    supprimerAide: 'Saisissez le nom de la copropriété pour confirmer la suppression (seulement sans signalement).',
    nomConfirmation: 'Nom à ressaisir pour confirmer',
    confirmerSupprimer: 'Supprimer définitivement',
    supprimee: 'Copropriété supprimée.',
    attributionsNonEnregistrees: 'La fiche est enregistrée, mais pas ses gestionnaires : {erreur}',
    // Carte
    cabinetLigne: 'Cabinet : {nom}',
    tousGestionnaires: 'Tous les gestionnaires',
    gestionnairesLigne: 'Gestionnaires : {noms}',
    sansGestionnaire: 'Aucun gestionnaire',
    creeeParAdmin: 'Créée par l’administrateur',
    creeePar: 'Créée par {nom}',
    localisation: '{codePostal} {ville}',
    immatriculationLigne: 'Immatriculation : {numero}',
    adressesGestionnaires: '{n} adresse(s) saisie(s) appartiennent à un gestionnaire : attribuez-lui la copropriété, puis retirez l’adresse.',
    // Filtre de la liste
    filtre: 'Afficher',
    filtres: {
      '': 'Toutes les copropriétés',
      sans_cabinet: 'Sans cabinet',
      sans_gestionnaire: 'Sans gestionnaire',
      a_tous: 'Attribuées à tous',
      adresses_gestionnaires: 'Adresses de gestionnaires dans les destinataires',
    },
    filtreGestionnaire: 'Gestionnaire : {nom}',
    aucuneFiltre: 'Aucune copropriété pour ce filtre.',
  },
  choix: {
    rechercher: 'Rechercher',
    selection: '{n} sélectionnée(s)',
    aucun: 'Aucun choix possible.',
  },
} as const

/** Page publique de confirmation d'adresse d'un gestionnaire (SPEC § 1.7.4, français seulement). */
export const TEXTES_CONFIRMATION_QR = {
  titre: 'Confirmation de votre adresse',
  verification: 'Vérification du lien…',
  presentation: '{nomCourt}, gestionnaire chez {cabinet} — adresse {email}',
  explication: 'Si c’est bien vous, confirmez votre adresse : vous recevrez les signalements de vos copropriétés (ils contiennent les coordonnées des résidents qui les déposent).',
  cestMoi: 'C’est moi : confirmer l’adresse',
  pasMoi: 'Ce n’est pas moi',
  pasMoiAvertissement: 'Vous ne recevrez aucun signalement et le cabinet sera prévenu.',
  confirmerPasMoi: 'Confirmer : ce n’est pas moi',
  annuler: 'Annuler',
  confirmee: 'Adresse confirmée. Vous recevrez désormais les signalements de vos copropriétés.',
  contestee: 'C’est noté : vous ne recevrez rien, le cabinet est prévenu.',
  invalide: 'Ce lien n’est pas valable.',
  dejaConfirmee: 'Adresse déjà confirmée.',
  expire: 'Ce lien a expiré. Demandez un nouvel envoi au cabinet.',
  reseau: 'Connexion impossible : vérifiez votre réseau puis réessayez.',
  indisponible: 'Le service ne répond pas pour le moment. Réessayez dans un instant.',
  reessayer: 'Réessayer',
} as const
