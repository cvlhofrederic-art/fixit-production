// ── AJ Signalement — diffusion : textes et calculs d'affichage des écrans de l'espace (PR 3, lot 8, BROUILLON) ───────
//
// Cahier PR 3 § 7.1 à 7.4 et § 7.6 ; décisions de Hugo du 11/11/2026 (messages d'exploitation seulement, aucun plafond
// et rappel du nombre de messages du mois ; H1 = C, message d'annonce ; H7, fin de mission ; H11, droit « diffuser »
// d'un gestionnaire sur les copropriétés qui lui sont attribuées nommément, jamais « à tous »). Fonctions pures, sans
// React ; textes en français (tout l'espace l'est). Écrans en BROUILLON, soumis à Frédéric (F1) : aucun texte n'est
// définitif. Aucun texte ne nomme un profil ni une migration à un gestionnaire (« Fonction pas encore activée. »).
// La phrase du droit § 5.6 (« sans risque » 9) est reprise À LA LETTRE (PHRASE_CONFORT_DIFFUSION_QR).

import { remplir } from '@/lib/coproprietaire/textes'
import { MESSAGES_REFUS_TEXTE_DIFFUSION_QR, NOMS_MODELES_DIFFUSION_QR } from '@/lib/aj-signalement/affichage-diffusion'
import type { ConseilTexteDiffusionQr, MotifRefusTexteDiffusionQr } from '@/lib/aj-signalement/diffusion-texte'
import type { ArretEnvoiDiffusionQr } from '@/lib/aj-signalement/diffusion-envoi'
import type { ManqueActivationDiffusionQr } from '@/lib/aj-signalement/diffusion-formes'
import type { CoproprieteQr } from '@/lib/aj-signalement/types'
import type { MoisDiffusionQr, RaisonDiffusionImpossibleQr } from '@/lib/aj-signalement/api'

/**
 * Droit § 5.6 : « À écrire dans l'interface, au-dessus du bouton d'envoi », au mot près. Posée au-dessus du bouton du
 * formulaire ET du bouton qui envoie réellement (« Envoyer à n personnes »), reliée à chacun par aria-describedby.
 */
export const PHRASE_CONFORT_DIFFUSION_QR = 'Ce message est une information de confort. Il ne remplace ni l\'affichage ni la notification que la loi impose.'

/** Protection de la fenêtre : rien à perdre, saisie en cours (confirmation avant de fermer), envoi en cours (pas de fermeture). */
export type GardeDiffusionQr = 'libre' | 'saisie' | 'envoi'

/** Profil qui compose (super admin : instruction écrite exigée, HF4 ; gestionnaire : le cabinet diffuse, H11). */
export type ProfilDiffusionQr = 'super_admin' | 'gestionnaire'

/** Copropriété d'une fenêtre de diffusion : nom affiché, cabinet (nom écrit dans le message d'annonce figé, H1 = C). */
export interface CoproprieteEcranDiffusionQr {
  id: string
  nom: string
  cabinetNom: string | null
}

export const TEXTES_ECRAN_DIFFUSION_QR = {
  carte: {
    diffuser: 'Diffuser un message',
    historique: 'Messages envoyés',
  },
  titres: {
    message: 'Diffuser un message — {copropriete}',
    annonce: 'Annoncer la diffusion — {copropriete}',
    signalement: 'Informer les déclarants de ce signalement',
    historique: 'Messages envoyés — {copropriete}',
  },
  chargement: 'Chargement…',
  fermerFenetre: 'Fermer la fenêtre',
  mois: {
    aucun: 'Ce mois-ci : aucun message envoyé sur cette copropriété.',
    un: 'Ce mois-ci : 1 message envoyé sur cette copropriété (le {date}).',
    plusieurs: 'Ce mois-ci : {n} messages envoyés sur cette copropriété (dernier le {date}).',
  },
  formulaire: {
    modele: 'Modèle',
    objet: 'Objet',
    texte: 'Texte du message',
    aideTexte: 'Texte simple, sur l’immeuble seulement. Ni lien, ni adresse e-mail, ni entreprise à recommander, ni offre, ni nom ou numéro de lot d’un résident. Numéros de téléphone : seulement ceux déclarés par le cabinet.',
    compteur: '{n} / {max} caractères',
    remplacerModele: 'Remplacer l’objet et le texte par ceux du modèle « {modele} » ?',
    remplacer: 'Remplacer',
    garder: 'Garder mon texte',
    objetLongueur: 'L’objet doit compter de 3 à 120 caractères.',
    texteLongueur: 'Le texte doit compter de 10 à 2 000 caractères.',
    corriger: 'Le message n’est pas encore prêt : corrigez les champs signalés.',
  },
  portee: {
    legende: 'À qui',
    copropriete: 'Toute la copropriété',
    batiment: 'Un bâtiment',
    etage: 'Un étage d’un bâtiment',
    signalement: 'Les déclarants de ce signalement',
    signalementAide: 'Les personnes qui ont déposé ce signalement, et celles des signalements liés (« même problème que »).',
    batimentLegende: 'Bâtiment',
    etageLegende: 'Étage',
    rechercher: 'Rechercher un bâtiment',
    rechercherEtage: 'Rechercher un étage',
    regroupe: 'regroupe : {variantes}',
    sansNom: 'Bâtiment sans nom affichable ({n})',
    sansNomEtage: 'Étage sans nom affichable ({n})',
    sansBatiment: '{n} déclarant(s) sans bâtiment renseigné : seulement pour toute la copropriété.',
    sansEtage: '{n} déclarant(s) de ce bâtiment sans étage renseigné : seulement pour tout le bâtiment.',
    aucunBatiment: 'Aucun bâtiment n’est renseigné dans les signalements : le message ne peut viser que toute la copropriété.',
    aucunEtage: 'Aucun étage n’est renseigné pour ce bâtiment.',
    choisirBatiment: 'Choisissez un bâtiment, ou toute la copropriété.',
    choisirEtage: 'Choisissez un étage.',
    nomBatiment: 'Nom du bâtiment dans le message',
    nomEtage: 'Nom de l’étage dans le message',
    nomAide: 'Tel qu’il sera écrit dans l’e-mail (50 caractères au plus).',
    nomRequis: 'Écrivez le nom tel qu’il paraîtra dans le message.',
  },
  nombre: {
    calcul: 'Calcul du nombre de destinataires…',
    partira: 'Ce message partira à {personnes} — {perimetre}.',
    partiraSansLibelle: 'Ce message partira à {personnes}.',
    exclus: '{personnes} ont demandé à ne plus recevoir ces informations.',
    exclusUn: '1 personne a demandé à ne plus recevoir ces informations.',
    personne: 'Personne à informer dans ce périmètre.',
    nonAnnonces: 'Les déclarants qui n’ont pas encore reçu le message d’annonce ne sont pas comptés.',
  },
  instruction: {
    legende: 'Instruction écrite du cabinet',
    aide: 'Le cabinet décide d’envoyer ; gardez son instruction écrite. Par exemple « courriel de la gestionnaire du 12/11/2026 10:02 », sans adresse e-mail.',
    reference: 'Référence de l’instruction',
    date: 'Date de réception',
    referenceRequise: 'Indiquez la référence de l’instruction écrite du cabinet (5 à 200 caractères, sans adresse e-mail).',
    dateRequise: 'Indiquez la date de réception de l’instruction (aujourd’hui au plus tard).',
  },
  boutons: {
    verifier: 'Vérifier et envoyer',
    annuler: 'Annuler',
    envoyer: 'Envoyer à {personnes}',
    fermer: 'Fermer',
    voirHistorique: 'Voir les messages envoyés',
  },
  confirmation: {
    titre: 'Vérifiez avant d’envoyer',
    objet: 'Objet',
    perimetre: 'Périmètre écrit dans l’e-mail',
    destinataires: 'Destinataires',
    perimetreChange: 'Le nombre de destinataires a changé : {personnes}. Vérifiez puis confirmez.',
  },
  envoi: {
    enCours: 'Envoi en cours…',
    progression: '{envoyes} / {total} envoyés',
  },
  fin: {
    // Phrases sans point final : bilanEnvoiDiffusionQr ajoute les adresses refusées, puis le point.
    envoye: 'Message envoyé à {personnes}',
    envoyeOppositions: 'Message envoyé à {personnes}, {k} ayant demandé entre-temps à ne plus recevoir ces informations',
    refuses: ' ; {adresses} par le service d’e-mail',
    rejeu: 'Ce message était déjà parti : voici son état.',
    interrompu: 'Envoi interrompu : {n} en attente.',
    dejaEnvoye: 'Déjà envoyé à {personnes}.',
  },
  arrets: {
    limite_service: 'Le service d’e-mail limite les envois : l’envoi reprendra dans quelques minutes.',
    quota_service: 'Le quota d’envoi du service d’e-mail est atteint : le message ne partira pas avant son rétablissement. Prévenez l’administrateur VitFix.',
    quota_service_gestionnaire: 'Le quota d’envoi du service d’e-mail est atteint : le message ne partira pas avant son rétablissement.',
    rejeu_concurrent: 'Un autre envoi de ce message est en cours : il continue sans cette fenêtre.',
    issue_inconnue: 'L’issue d’une partie de l’envoi est inconnue : ces messages ne seront pas renvoyés.',
    reseau: 'Le service d’e-mail ne répond pas : l’envoi reprendra automatiquement dans quelques minutes.',
    configuration_incomplete: 'Fonction pas encore activée.',
    base: 'L’envoi s’est arrêté : il reprendra automatiquement dans quelques minutes.',
    sans_progres: 'L’envoi reprendra automatiquement dans quelques minutes ; vous pouvez aussi le reprendre depuis « Messages envoyés ».',
  },
  fermeture: {
    question: 'Abandonner ce message ?',
    aide: 'L’objet et le texte saisis seront perdus.',
    abandonner: 'Abandonner',
    continuer: 'Continuer la saisie',
    envoiContinue: 'L’envoi continue ; vous pourrez fermer à la fin.',
  },
  annonce: {
    encadre: '{n} déclarant(s) de cette copropriété n’ont jamais été informés de la diffusion : ils ne recevront les informations que 15 jours après le message d’annonce, s’ils ne l’ont pas refusé.',
    bouton: 'Annoncer la diffusion aux déclarants actuels ({n})',
    intro: 'Message unique, au texte figé : il annonce la diffusion et porte le bouton pour la refuser. Il ne donne aucune information sur l’immeuble.',
    objet: 'Objet (texte figé)',
    texte: 'Texte (texte figé)',
  },
  finMission: {
    info: 'Fin de mission prévue le {date} : à partir de ce jour, plus aucun message ne partira.',
    champ: 'Fin de mission prévue (facultatif)',
    aide: 'À partir de ce jour, plus aucun message d’information ne part aux déclarants de cette copropriété. Désactiver la copropriété coupe aussi la diffusion.',
  },
  raisons: {
    copropriete_inactive: 'Copropriété désactivée : aucun message ne peut partir.',
    sans_cabinet: 'Copropriété sans cabinet : la diffusion n’est possible que pour une copropriété rattachée à un cabinet.',
    diffusion_non_activee: 'Diffusion non activée pour ce cabinet.',
    langue_non_ouverte: 'La diffusion n’est pas encore ouverte dans la langue de ce cabinet.',
    fin_gestion: 'Mission terminée : plus aucun message ne part pour cette copropriété.',
    fin_gestion_date: 'Mission terminée (fin de mission le {date}) : plus aucun message ne part pour cette copropriété.',
    introuvable: 'Diffusion impossible pour cette copropriété.',
  },
  historique: {
    aucun: 'Aucun message envoyé sur cette copropriété.',
    voirPlus: 'Voir plus',
    voirDetail: 'Voir le détail',
    masquerDetail: 'Masquer le détail',
    reprendre: 'Reprendre l’envoi',
    detailTitre: 'Détail du message',
    ligne: '{date} · {auteur} · {perimetre}',
    auteurs: {
      administrateur: 'Administrateur',
      gestionnaire: 'Un gestionnaire',
      vous: 'Vous',
      collegue: 'Un collègue',
      cabinet: 'Le cabinet',
    } as Record<string, string>,
    etats: {
      envoye: 'Envoyé à {n}',
      refuses: '{envoyes} envoyés, {refuses} refusés',
      interrompu: 'Envoi interrompu : {n} en attente',
      annules: '{n} annulé(s)',
      incertains: '{n} d’issue inconnue',
    },
    aConfirmer: 'Ce message a été écrit le {date} : son contenu est-il toujours exact ?',
    confirmerReprise: 'Oui, reprendre l’envoi',
    detail: {
      texte: 'Texte',
      modele: 'Modèle',
      prevus: 'Destinataires prévus',
      exclus: 'Exclus (opposition)',
      envoyes: 'Envoyés',
      refuses: 'Refusés par le service d’e-mail',
      attente: 'En attente',
      annules: 'Annulés',
      annulesDetail: '{n} (dont opposition : {opposes} ; non partis en 24 h : {perimes})',
      incertains: 'Issue inconnue',
      copie: 'Copie au cabinet',
      copieNon: 'non envoyée',
      instruction: 'Instruction écrite du cabinet',
      instructionValeur: '{reference} (reçue le {date})',
    },
  },
  detail: {
    informer: 'Informer les déclarants de ce signalement',
  },
  opposition: {
    bouton: 'Ne plus envoyer d’informations à ce déclarant (à sa demande)',
    aide: 'À utiliser quand le déclarant l’a demandé par écrit au cabinet. La demande vaut pour cette copropriété seulement ; il continuera à recevoir la confirmation de ses propres signalements.',
    date: 'Date de réception de la demande écrite',
    dateRequise: 'Indiquez la date de réception de la demande (aujourd’hui au plus tard).',
    confirmer: 'Enregistrer sa demande',
    annuler: 'Annuler',
    fait: 'C’est enregistré : ce déclarant ne recevra plus les informations sur cet immeuble.',
  },
  reglages: {
    bouton: 'Diffusion d’informations',
    titre: 'Diffusion d’informations — {cabinet}',
    intro: 'Messages d’exploitation de l’immeuble (fuite, coupure, intervention) envoyés par e-mail aux déclarants, au nom du cabinet. Rien ne part tant que la diffusion n’est pas activée.',
    activeeLe: 'Diffusion activée le {date}',
    inactive: 'Diffusion non activée',
    contact: 'Adresse de contact (réponses des résidents)',
    politique: 'Adresse de la politique de confidentialité du cabinet',
    politiqueAide: 'Adresse https de la page du cabinet ; elle est donnée dans chaque message.',
    declaration: 'Cette politique décrit la diffusion (finalité, base légale, durée, droit d’opposition)',
    declareeLe: 'Déclaration faite le {date}.',
    contratReference: 'Référence du contrat de sous-traitance couvrant la diffusion',
    contratDate: 'Date de signature du contrat',
    telephones: 'Numéros de téléphone autorisés dans les messages (astreinte, gardiens ; 10 au plus)',
    telephonesAide: 'Séparés par des virgules. Tout autre numéro sera refusé dans les messages.',
    enregistrer: 'Enregistrer',
    activer: 'Activer la diffusion',
    suspendre: 'Suspendre la diffusion',
    suspendreAide: 'Suspendre : les envois en cours s’arrêtent au lot suivant.',
    manque: 'Activation impossible : il manque {liste}.',
    manques: {
      contact: 'l’adresse de contact',
      politique: 'l’adresse de la politique de confidentialité',
      declaration_politique: 'la déclaration que cette politique décrit la diffusion',
      contrat_reference: 'la référence du contrat de sous-traitance',
      contrat_date: 'la date de signature du contrat',
    } satisfies Record<ManqueActivationDiffusionQr, string>,
    langueNonOuverte: 'La diffusion n’est pas encore ouverte dans la langue de ce cabinet : activation impossible.',
    enregistre: 'Réglages enregistrés.',
    activee: 'Diffusion activée.',
    suspendue: 'Diffusion suspendue.',
    rien: 'Aucun réglage modifié.',
    indisponible: 'Fonction pas encore activée.',
    contactInvalide: 'Adresse de contact non valable.',
    politiqueInvalide: 'Adresse non valable : elle doit commencer par https://.',
    contratInvalide: 'Référence du contrat : 3 à 100 caractères.',
    dateInvalide: 'Date de signature : aujourd’hui au plus tard.',
    telephonesInvalides: '10 numéros au plus, de 6 à 15 chiffres chacun.',
  },
} as const

/** « 1 personne », « 23 personnes ». */
export const personnesQr = (n: number): string => (n === 1 ? '1 personne' : `${n} personnes`)
/** « 1 adresse refusée », « 2 adresses refusées ». */
const adressesRefuseesQr = (n: number): string => (n === 1 ? '1 adresse refusée' : `${n} adresses refusées`)

const JOUR_SEUL_QR = /^\d{4}-\d{2}-\d{2}$/

/** « 08/11/2026 », jour de Paris ; la chaîne brute si la date est illisible. */
export function jourCourtParisQr(iso: string): string {
  const date = new Date(JOUR_SEUL_QR.test(iso) ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

/** « 1 novembre 2026 », jour de Paris (date seule ou horodatage) ; la chaîne brute si la date est illisible. */
export function jourLongParisQr(iso: string): string {
  const date = new Date(JOUR_SEUL_QR.test(iso) ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long' }).format(date)
}

/** Jour civil de Paris (AAAA-MM-JJ) : une date reçue (instruction, demande écrite, contrat) ne peut pas le dépasser. */
export function aujourdhuiParisEcranQr(maintenant: Date = new Date()): string {
  const parties = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(maintenant)
  const partie = (type: Intl.DateTimeFormatPartTypes) => parties.find((p) => p.type === type)?.value ?? ''
  return `${partie('year')}-${partie('month')}-${partie('day')}`
}

/** Date saisie (AAAA-MM-JJ) valable et non future (jour de Paris). */
export const dateNonFutureQr = (jour: string, maintenant: Date = new Date()): boolean =>
  JOUR_SEUL_QR.test(jour) && !Number.isNaN(Date.parse(`${jour}T00:00:00Z`)) && jour <= aujourdhuiParisEcranQr(maintenant)

/** Rappel du mois (décision de Hugo : aucun plafond, l'écran rappelle combien de messages sont partis ce mois-ci). */
export function rappelMoisDiffusionQr(mois: MoisDiffusionQr): string {
  const t = TEXTES_ECRAN_DIFFUSION_QR.mois
  if (mois.nb <= 0) return t.aucun
  const date = mois.dernierLe ? jourCourtParisQr(mois.dernierLe) : '—'
  return mois.nb === 1 ? remplir(t.un, { date }) : remplir(t.plusieurs, { n: mois.nb, date })
}

/** Raison d'une diffusion impossible, en mots (fin de mission : avec sa date quand elle est connue). */
export function raisonDiffusionImpossibleQr(raison: RaisonDiffusionImpossibleQr | null, finMissionLe: string | null = null): string {
  const t = TEXTES_ECRAN_DIFFUSION_QR.raisons
  if (raison === 'fin_gestion') return finMissionLe ? remplir(t.fin_gestion_date, { date: jourCourtParisQr(finMissionLe) }) : t.fin_gestion
  return raison ? t[raison] : t.introuvable
}

/** Motif d'un texte refusé (et le conseil d'espace après un point, pour un nom de domaine). */
export function messageRefusTexteDiffusionQr(motif: MotifRefusTexteDiffusionQr, conseil?: ConseilTexteDiffusionQr): string {
  const base = MESSAGES_REFUS_TEXTE_DIFFUSION_QR[motif]
  return conseil === 'espace_apres_point' ? `${base} ${MESSAGES_REFUS_TEXTE_DIFFUSION_QR.conseilEspaceApresPoint}` : base
}

/** Message d'un arrêt de l'envoi (le reste partira par le filet de reprise, ou depuis l'historique). */
export function messageArretEnvoiQr(arret: ArretEnvoiDiffusionQr | 'sans_progres', profil: ProfilDiffusionQr): string {
  const t = TEXTES_ECRAN_DIFFUSION_QR.arrets
  if (arret === 'quota_service' && profil === 'gestionnaire') return t.quota_service_gestionnaire
  return t[arret]
}

/** Bilan d'un envoi terminé (reste 0) : envoyés, oppositions arrivées depuis l'aperçu, adresses refusées. */
export function bilanEnvoiDiffusionQr(b: { envoyes: number; refuses: number; ecartOppositions: number }): string {
  const t = TEXTES_ECRAN_DIFFUSION_QR.fin
  const tete = b.ecartOppositions > 0
    ? remplir(t.envoyeOppositions, { personnes: personnesQr(b.envoyes), k: b.ecartOppositions })
    : remplir(t.envoye, { personnes: personnesQr(b.envoyes) })
  const refus = b.refuses > 0 ? remplir(t.refuses, { adresses: adressesRefuseesQr(b.refuses) }) : ''
  return `${tete}${refus}.`
}

/** État d'une ligne de l'historique : « Envoyé à 23 », « 21 envoyés, 2 refusés », « Envoi interrompu : 300 en attente ». */
export function etatDiffusionHistoriqueQr(n: { envoyes: number; refuses: number; attente: number; annules: number; incertains: number }): string {
  const t = TEXTES_ECRAN_DIFFUSION_QR.historique.etats
  const parties: string[] = []
  if (n.attente > 0) {
    if (n.envoyes > 0 || n.refuses > 0) parties.push(n.refuses > 0 ? remplir(t.refuses, { envoyes: n.envoyes, refuses: n.refuses }) : remplir(t.envoye, { n: n.envoyes }))
    parties.push(remplir(t.interrompu, { n: n.attente }))
  } else if (n.refuses > 0) {
    parties.push(remplir(t.refuses, { envoyes: n.envoyes, refuses: n.refuses }))
  } else {
    parties.push(remplir(t.envoye, { n: n.envoyes }))
  }
  if (n.annules > 0) parties.push(remplir(t.annules, { n: n.annules }))
  if (n.incertains > 0) parties.push(remplir(t.incertains, { n: n.incertains }))
  return parties.join(' · ')
}

/** Auteur d'une diffusion en mots (jamais un nom) ; inconnu : « Le cabinet ». */
export const auteurDiffusionTexteQr = (auteur: string): string =>
  TEXTES_ECRAN_DIFFUSION_QR.historique.auteurs[auteur] ?? TEXTES_ECRAN_DIFFUSION_QR.historique.auteurs.cabinet

/** Nom d'un modèle (« Coupure d’eau ») ; inconnu : le modèle libre. */
export const nomModeleDiffusionQr = (modele: string): string =>
  (NOMS_MODELES_DIFFUSION_QR as Record<string, string>)[modele] ?? NOMS_MODELES_DIFFUSION_QR.libre

/**
 * Droit « diffuser » vu par l'écran (H11) : le super admin, toujours (l'écran explique ensuite pourquoi une copropriété
 * ne peut pas diffuser) ; un gestionnaire, seulement sur une copropriété active qui lui est attribuée NOMMÉMENT
 * (`modifiable`, rendu par le serveur) et jamais « attribuée à tous ». Le serveur refait la règle à chaque appel.
 */
export function peutDiffuserCoproprieteQr(c: Pick<CoproprieteQr, 'modifiable' | 'attribueeATous'>, vueGestionnaire: boolean): boolean {
  if (!vueGestionnaire) return true
  return c.modifiable === true && !c.attribueeATous
}

/** « l’adresse de contact, la date de signature du contrat » : ce qui manque à l'activation. */
export const listeManquesActivationQr = (manque: readonly ManqueActivationDiffusionQr[]): string =>
  manque.map((m) => TEXTES_ECRAN_DIFFUSION_QR.reglages.manques[m]).join(', ')

/** Numéros saisis (séparés par des virgules, points-virgules ou retours) : tels quels, rognés, sans doublon ni vide. */
export const telephonesDepuisSaisieQr = (texte: string): string[] =>
  [...new Set(texte.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean))]
