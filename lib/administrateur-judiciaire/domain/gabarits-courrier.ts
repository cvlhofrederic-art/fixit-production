import { ajouterJours, ajouterMois, dateIsoVersFr, ecartJours, estDateIsoValide, estJourOuvrable } from '@/lib/administrateur-judiciaire/domain/dates'
import type { SuiviEcheancier } from '@/lib/administrateur-judiciaire/domain/decompte-contentieux'
import type { CertitudeRegle } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import type { ResultatDelaiContestation } from '@/lib/administrateur-judiciaire/domain/statut-assemblee'
import {
  FAMILLE_MODELE_COURRIER,
  FORME_ENVOI_COURRIER,
  type FamilleModeleCourrier,
  type FormeEnvoiCourrier,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Gabarits de courrier prioritaires d'un administrateur judiciaire de copropriété (point 62 du bilan 2). Registre pur :
 * famille, objet, contexte de fusion et champs requis, forme imposée par le texte, forme d'envoi par défaut, fondement,
 * délai, mentions attendues. Aucun corps de lettre, aucune table, aucun écran (amorçage des modèles : Frédéric).
 *
 * Gestéam — 🟢 tranche 43 § 22 : modèles « Famille - LIBELLÉ - [contexte] - mode d'envoi » ; le contexte d'édition fixe
 * les champs de fusion ; familles Mutation (certificats art. 20 II), Contentieux (opposition art. 20 « AR », protocole
 * d'apurement et sa caducité), Assemblée (PV de carence « AR », attestation de non-recours, convocation avec vote par
 * correspondance), Sinistre (déclaration, déclaration DO « AR », contestation d'expertise « AR »).
 *
 * Le droit — 🟢 relu sur Légifrance le 29/10/2026 :
 * - L. 1965 art. 20 I : opposition du syndic au versement des fonds « par acte extrajudiciaire », au domicile élu,
 *   dans les quinze jours de la réception de l'avis de mutation ; élection de domicile dans le ressort du tribunal
 *   judiciaire, montant et causes de la créance à peine de nullité, ventilés selon le D. 1967 art. 5-1 ;
 * - L. 1965 art. 20 II : certificat de moins d'un mois délivré au notaire dans le mois de sa notification : aucune des
 *   personnes notifiées (candidat acquéreur, ses mandataires sociaux et associés, leurs conjoints ou partenaires) n'est
 *   copropriétaire (1°), ou, si l'une l'est, elle n'a pas fait l'objet d'une mise en demeure de payer restée infructueuse
 *   depuis plus de quarante-cinq jours (2°) ; sinon le notaire notifie aux parties l'impossibilité de vendre et, si un
 *   avant-contrat est signé, les personnes notifiées disposent de trente jours pour s'acquitter de leur dette ;
 * - L. 1965 art. 29-5 V : l'administrateur provisoire peut conclure des échéanciers individualisés, sans compromettre le
 *   plan d'apurement ; C. civ. art. 2240 (la reconnaissance de dette interrompt la prescription), 1224 et 1225 (la mise
 *   en demeure ne produit effet que si elle mentionne expressément la clause résolutoire) ;
 * - L. 1965 art. 42 al. 2 et D. 1967 art. 18 : délai de deux mois de contestation, par opposant ou défaillant ;
 * - L. 1965 art. 17-1 A, D. 1967 art. 9 (21 jours), 9 bis (formulaire reçu trois jours francs avant), 14-1, 64 à 64-3
 *   (64-3 : convocation valablement remise contre récépissé ou émargement), 64-9 ; arrêté du 2 juillet 2020, art. 1
 *   (le formulaire de vote par correspondance suit le modèle annexé) ;
 * - C. assur. art. L. 113-2 4° (déclaration dans le délai du contrat, au moins cinq jours ouvrés, deux en cas de vol),
 *   L. 114-1 (prescription de deux ans), L. 114-2 (la désignation d'experts et l'envoi recommandé sur le règlement de
 *   l'indemnité l'interrompent), L. 242-1 (prise d'effet après la garantie de parfait achèvement) et annexe II à l'art.
 *   A. 243-1 (dommages-ouvrage : contenu de la déclaration, A 2° ; récusation de l'expert dans les huit jours, B 1° a ;
 *   fin de la garantie dix ans après la réception ; forme écrite contre récépissé ou recommandée imposée seulement aux
 *   notifications des A 1° c, A 3°, B 2° a, B 2° c et B 3° a, qui ne sont pas celles de l'assuré visées ici).
 * Notifications et mises en demeure aux copropriétaires : voie électronique de principe, LRAR sur demande (L. 1965
 * art. 42-1 ; D. 1967 art. 64, 64-1 ; voir voie-notification.ts, PR #592).
 *
 * 🔵 Déduit : formes d'envoi par défaut quand le texte n'en impose pas (« AR » dès qu'un délai court de la réception ou
 * qu'une preuve est nécessaire, reprise de Gestéam quand il en affiche une, « Email » pour une pièce remise à un
 * professionnel) ; champs de fusion (propres à VitFix, Gestéam n'en a pas relevé la liste) ; « plus de quarante-cinq
 * jours » = plus de 45 jours écoulés depuis le point de départ de la mise en demeure ; échéance de l'opposition =
 * réception + 15 jours, avertissement si elle tombe un jour non ouvrable (report non établi) ; attestation de non-recours
 * délivrable sans opposant ni défaillant.
 * 🔴 Non établi : PV de carence et attestation de non-recours n'ont pas de texte propre (pratiques) ; la variante
 * « débiteur » du certificat 2° de Gestéam n'a pas de base (le texte ne prévoit pas de certificat négatif) ; la forme
 * électronique qualifiée (LRE) et la remise contre émargement manquent au référentiel des formes d'envoi : « AR » reste
 * le défaut des notifications ; rubriques du modèle annexé à l'arrêté du 2 juillet 2020 non relevées ; D. 1967 art. 11
 * (pièces jointes à la convocation) non relu ; portée du protocole d'apurement hors administration provisoire de
 * l'art. 29-1 (simple accord de délais) ; l'attestation de non-recours suppose un délai calculé par opposant ou
 * défaillant, alors que finDelaiContestationAg n'en donne qu'un par assemblée.
 * La mise en demeure de l'art. 19-2 reste dans actes/actes-express.ts (générateur existant).
 */

export const FORMES_LEGALES = ['notification_coproprietaire', 'acte_extrajudiciaire', 'libre'] as const
export type FormeLegale = (typeof FORMES_LEGALES)[number]

export const CONTEXTES_FUSION_COURRIER = ['mutation', 'protocole', 'assemblee', 'sinistre'] as const
export type ContexteFusionCourrier = (typeof CONTEXTES_FUSION_COURRIER)[number]

export type TypeChampFusion = 'texte' | 'date' | 'montant' | 'booleen'

export interface ChampFusion {
  cle: string
  libelle: string
  type: TypeChampFusion
}

const champ = (cle: string, libelle: string, type: TypeChampFusion = 'texte'): ChampFusion => ({ cle, libelle, type })

/** Champs communs à tous les contextes : syndicat, mandat judiciaire, destinataire. */
export const CHAMPS_SOCLE: readonly ChampFusion[] = [
  champ('copropriete.nom', 'Nom de la copropriété'),
  champ('copropriete.adresse', "Adresse de l'immeuble"),
  champ('mandat.fondement', 'Fondement de la désignation (signature ès qualités)'),
  champ('mandat.tribunal', 'Tribunal qui a désigné le mandataire'),
  champ('mandat.ordonnance', "Date de l'ordonnance de désignation", 'date'),
  champ('mandat.rg', 'Numéro de répertoire général'),
  champ('destinataire.nom', 'Destinataire'),
  champ('destinataire.adresse', 'Adresse du destinataire'),
]

const SOCLE_REQUIS = [
  'copropriete.nom',
  'copropriete.adresse',
  'mandat.fondement',
  'mandat.tribunal',
  'mandat.ordonnance',
  'mandat.rg',
  'destinataire.nom',
  'destinataire.adresse',
] as const

export const CHAMPS_PAR_CONTEXTE: Readonly<Record<ContexteFusionCourrier, readonly ChampFusion[]>> = {
  mutation: [
    champ('lot.numero', 'Lot(s) vendu(s)'),
    champ('vendeur.nom', 'Vendeur (débiteur du syndicat)'),
    champ('mutation.date', 'Date de la mutation', 'date'),
    champ('personnesNotifiees.noms', 'Personnes notifiées par le notaire (acquéreur, mandataires sociaux, associés, conjoints ou partenaires)'),
    champ('personnesNotifiees.uneEstCoproprietaire', "L'une des personnes notifiées est déjà copropriétaire", 'booleen'),
    champ('notaire.nom', 'Notaire'),
    champ('notaire.domicileElu', "Domicile élu de l'avis de mutation (lieu de l'opposition)"),
    champ('notificationNotaire.dateReception', 'Réception de la notification du notaire', 'date'),
    champ('avisMutation.dateReception', "Réception de l'avis de mutation", 'date'),
    champ('opposition.electionDomicile', 'Élection de domicile du syndicat dans le ressort du tribunal judiciaire'),
    champ('creance.annees1Centimes', "Créances de l'année courante et des deux dernières années échues (D. 1967 art. 5-1, 1°)", 'montant'),
    champ('creance.annees2Centimes', 'Créances des deux années antérieures (2°)', 'montant'),
    champ('creance.hypothequeCentimes', "Créances garanties par l'hypothèque légale, non comprises aux 1° et 2° (3°)", 'montant'),
    champ('creance.autresCentimes', 'Autres créances (4°)', 'montant'),
    champ('creance.causes', 'Causes de la créance'),
  ],
  protocole: [
    champ('debiteur.nom', 'Débiteur'),
    champ('protocole.montantReconnuCentimes', 'Dette reconnue', 'montant'),
    champ('protocole.echeancier', 'Échéancier (dates et montants)'),
    champ('protocole.clauseResolutoire', 'Clause résolutoire'),
    champ('protocole.dateSignature', 'Date de signature', 'date'),
    champ('protocole.impayesCentimes', 'Échéances échues impayées', 'montant'),
    champ('protocole.delaiRegularisation', 'Délai laissé pour régulariser'),
  ],
  assemblee: [
    champ('ag.date', "Date de l'assemblée", 'date'),
    champ('ag.heure', "Heure de l'assemblée"),
    champ('ag.lieu', "Lieu de l'assemblée"),
    champ('ag.ordreDuJour', 'Ordre du jour'),
    champ('ag.consultationPieces', 'Lieu, jours et heures de consultation des pièces (D. 1967 art. 9)'),
    champ('ag.adresseRetourVpc', 'Adresse de retour du formulaire de vote'),
    champ('ag.dateLimiteVpc', 'Date limite de réception du formulaire', 'date'),
    champ('ag.convocation', 'Références de la convocation (date, mode, envois)'),
    champ('ag.resolutions', 'Résolutions visées'),
    champ('ag.notifications', 'Opposants et défaillants, dates de notification et d’expiration'),
  ],
  sinistre: [
    champ('sinistre.nature', 'Nature du sinistre'),
    champ('sinistre.dateSurvenance', 'Date du sinistre', 'date'),
    champ('sinistre.circonstances', 'Circonstances et dommages'),
    champ('assurance.compagnie', 'Assureur'),
    champ('assurance.contrat', 'Numéro de police'),
    champ('assurance.numeroSinistre', 'Référence du sinistre chez l’assureur'),
    champ('do.dateReception', 'Date de réception des travaux (ou de première occupation)', 'date'),
    champ('do.localisation', 'Description et localisation des dommages'),
    champ('do.dateApparition', "Date d'apparition des dommages", 'date'),
    champ('expertise.expert', 'Expert'),
    champ('expertise.dateNotification', "Notification de la désignation ou du rapport de l'expert", 'date'),
    champ('contestation.motifs', 'Motifs de la contestation'),
  ],
}

export interface DelaiGabarit {
  libelle: string
  fondement: string
  certitude: CertitudeRegle
}

export interface GabaritCourrier {
  famille: FamilleModeleCourrier
  objet: string
  /** Libellé du modèle dans Gestéam ; null : pas de modèle correspondant relevé. */
  libelleGesteam: string | null
  contexte: ContexteFusionCourrier
  /** Champs requis du contexte, en plus du socle. */
  champsPropres: readonly string[]
  formeLegale: FormeLegale
  formeEnvoiParDefaut: FormeEnvoiCourrier
  /** Mode d'envoi affiché par Gestéam ; null : non affiché. */
  formeObservee: FormeEnvoiCourrier | null
  fondements: readonly string[]
  /** Document sans texte propre : la pratique qu'il suit ; null s'il a un fondement écrit. */
  sansTexte: string | null
  delai: DelaiGabarit | null
  /** Mentions imposées par le texte ou attendues (🔵) ; le corps du courrier reste à rédiger. */
  mentions: readonly string[]
  /** Remise contre récépissé ou émargement valable (D. 1967 art. 64-3 : convocations). */
  remiseContreEmargementAdmise?: boolean
}

const NOTIFICATION = 'L. 1965 art. 42-1 ; D. 1967 art. 64, 64-1'

export const GABARITS_COURRIER = {
  certificat_art20_ii_1: {
    famille: 'Mutation',
    objet: "Certificat de l'art. 20 II, 1° (aucune personne notifiée n'est copropriétaire)",
    libelleGesteam: 'certificat art. 20 II 1° (acquéreur pas copropriétaire)',
    contexte: 'mutation',
    champsPropres: ['lot.numero', 'notaire.nom', 'notificationNotaire.dateReception', 'personnesNotifiees.noms'],
    formeLegale: 'libre',
    formeEnvoiParDefaut: 'Email',
    formeObservee: null,
    fondements: ['L. 1965 art. 20, II'],
    sansTexte: null,
    delai: { libelle: "Dans le mois de la notification du notaire ; certificat de moins d'un mois", fondement: 'L. 1965 art. 20, II', certitude: 'TEXTE' },
    mentions: ["Aucune des personnes notifiées par le notaire n'est copropriétaire de l'immeuble", 'Date du certificat', 'Signataire ès qualités'],
  },
  certificat_art20_ii_2: {
    famille: 'Mutation',
    objet: "Certificat de l'art. 20 II, 2° (personne notifiée déjà copropriétaire)",
    libelleGesteam: 'certificat art. 20 II 2° (acquéreur déjà copropriétaire à jour)',
    contexte: 'mutation',
    champsPropres: ['lot.numero', 'notaire.nom', 'notificationNotaire.dateReception', 'personnesNotifiees.noms', 'personnesNotifiees.uneEstCoproprietaire'],
    formeLegale: 'libre',
    formeEnvoiParDefaut: 'Email',
    formeObservee: null,
    fondements: ['L. 1965 art. 20, II'],
    sansTexte: null,
    delai: { libelle: "Dans le mois de la notification du notaire ; certificat de moins d'un mois", fondement: 'L. 1965 art. 20, II', certitude: 'TEXTE' },
    mentions: [
      "La personne n'a pas fait l'objet d'une mise en demeure de payer restée infructueuse depuis plus de quarante-cinq jours",
      'Date du certificat',
      'Signataire ès qualités',
    ],
  },
  opposition_art20: {
    famille: 'Contentieux',
    objet: "Opposition de l'art. 20 au versement du prix (instructions au commissaire de justice)",
    libelleGesteam: 'opposition article 20 (AR)',
    contexte: 'mutation',
    champsPropres: [
      'lot.numero',
      'vendeur.nom',
      'mutation.date',
      'notaire.nom',
      'notaire.domicileElu',
      'avisMutation.dateReception',
      'opposition.electionDomicile',
      'creance.annees1Centimes',
      'creance.annees2Centimes',
      'creance.hypothequeCentimes',
      'creance.autresCentimes',
      'creance.causes',
    ],
    formeLegale: 'acte_extrajudiciaire',
    formeEnvoiParDefaut: 'Email',
    formeObservee: 'AR',
    fondements: ['L. 1965 art. 20, I', 'D. 1967 art. 5-1'],
    sansTexte: null,
    delai: { libelle: "Quinze jours à compter de la réception de l'avis de mutation", fondement: 'L. 1965 art. 20, I', certitude: 'TEXTE' },
    mentions: [
      'Élection de domicile dans le ressort du tribunal judiciaire de la situation de l’immeuble',
      'Montant et causes de la créance, à peine de nullité, ventilés selon le D. 1967 art. 5-1 (1° à 4°)',
      'Créances liquides et exigibles à la date de la mutation',
    ],
  },
  protocole_apurement_etablissement: {
    famille: 'Contentieux',
    objet: "Protocole d'apurement (établissement)",
    libelleGesteam: "protocole d'apurement (établissement)",
    contexte: 'protocole',
    champsPropres: ['debiteur.nom', 'protocole.montantReconnuCentimes', 'protocole.echeancier', 'protocole.clauseResolutoire'],
    formeLegale: 'libre',
    formeEnvoiParDefaut: 'Normal',
    formeObservee: null,
    fondements: ['L. 1965 art. 29-5, V', 'C. civ. art. 2240', 'C. civ. art. 1225'],
    sansTexte: null,
    delai: null,
    mentions: [
      'Dette reconnue par le débiteur (C. civ. art. 2240)',
      'Échéancier : dates et montants',
      'Paiement des charges courantes en plus des échéances',
      'Clause résolutoire : engagements visés, mise en demeure requise ou non (C. civ. art. 1225)',
      "S'il existe un plan d'apurement des dettes du syndicat : échéancier compatible avec lui (L. 1965 art. 29-5, V)",
    ],
  },
  protocole_apurement_caducite: {
    famille: 'Contentieux',
    objet: "Protocole d'apurement (mise en demeure et caducité)",
    libelleGesteam: "protocole d'apurement (caducité)",
    contexte: 'protocole',
    champsPropres: ['debiteur.nom', 'protocole.dateSignature', 'protocole.impayesCentimes', 'protocole.clauseResolutoire', 'protocole.delaiRegularisation'],
    formeLegale: 'notification_coproprietaire',
    formeEnvoiParDefaut: 'AR',
    formeObservee: null,
    fondements: ['C. civ. art. 1224, 1225', NOTIFICATION],
    sansTexte: null,
    delai: { libelle: 'Délai fixé par le protocole ou par la mise en demeure', fondement: 'C. civ. art. 1225', certitude: 'TEXTE' },
    mentions: ['Mention expresse de la clause résolutoire (C. civ. art. 1225)', 'Échéances impayées', 'Délai laissé', 'Conséquences : exigibilité du solde, reprise des poursuites'],
  },
  pv_carence: {
    famille: 'Assemblée',
    objet: "Procès-verbal de carence de l'assemblée générale",
    libelleGesteam: 'PV de carence (AR)',
    contexte: 'assemblee',
    champsPropres: ['ag.date', 'ag.heure', 'ag.lieu', 'ag.ordreDuJour', 'ag.convocation'],
    formeLegale: 'libre',
    formeEnvoiParDefaut: 'AR',
    formeObservee: 'AR',
    fondements: ['D. 1967 art. 14 (feuille de présence)', 'D. 1967 art. 17 (registre des procès-verbaux)'],
    sansTexte: 'Pratique : aucun texte ne prévoit un procès-verbal de carence.',
    delai: null,
    mentions: [
      'Références de la convocation',
      'Lieu, date et heure',
      "Constat qu'aucun copropriétaire n'est présent, représenté ni n'a voté par correspondance",
      'Ordre du jour non délibéré',
    ],
  },
  attestation_non_recours: {
    famille: 'Assemblée',
    objet: 'Attestation de non-recours',
    libelleGesteam: 'attestation de non-recours',
    contexte: 'assemblee',
    champsPropres: ['ag.date', 'ag.resolutions', 'ag.notifications'],
    formeLegale: 'libre',
    formeEnvoiParDefaut: 'Email',
    formeObservee: null,
    fondements: ['L. 1965 art. 42, al. 2', 'D. 1967 art. 18'],
    sansTexte: "Pratique : aucun texte ne prévoit l'attestation ; elle constate l'expiration du délai de l'art. 42 al. 2.",
    delai: { libelle: "Après l'expiration du délai de deux mois de chaque opposant ou défaillant", fondement: 'L. 1965 art. 42, al. 2', certitude: 'A_CONFIRMER' },
    mentions: ["Date de l'assemblée et résolutions visées", 'Opposants et défaillants : dates de notification et d’expiration', "Aucune assignation en contestation reçue à la date de l'attestation"],
  },
  convocation_ag_vpc: {
    famille: 'Assemblée',
    objet: 'Convocation avec formulaire de vote par correspondance',
    libelleGesteam: 'convocation-pouvoirs-instructions avec VPC',
    contexte: 'assemblee',
    champsPropres: ['ag.date', 'ag.heure', 'ag.lieu', 'ag.ordreDuJour', 'ag.consultationPieces', 'ag.adresseRetourVpc', 'ag.dateLimiteVpc'],
    formeLegale: 'notification_coproprietaire',
    formeEnvoiParDefaut: 'AR',
    formeObservee: null,
    fondements: [
      'L. 1965 art. 17-1 A',
      'D. 1967 art. 9, 9 bis, 14-1',
      'D. 1967 art. 64, 64-1, 64-2, 64-3, 64-9',
      'arrêté du 2 juillet 2020, art. 1 (formulaire de vote par correspondance)',
    ],
    sansTexte: null,
    remiseContreEmargementAdmise: true,
    delai: { libelle: 'Au moins 21 jours avant la réunion, sauf urgence ou délai plus long du règlement', fondement: 'D. 1967 art. 9', certitude: 'TEXTE' },
    mentions: [
      'Lieu, date et heure ; ordre du jour précisant chaque question',
      'Lieu, jours et heures de consultation des pièces justificatives des charges (D. 1967 art. 9)',
      "Formulaire conforme au modèle de l'arrêté, sans en supprimer aucune mention",
      'Formulaire reçu au plus tard trois jours francs avant la réunion (D. 1967 art. 9 bis)',
      'Possibilité de recevoir notifications et mises en demeure par voie postale (D. 1967 art. 64-2)',
    ],
  },
  declaration_sinistre: {
    famille: 'Sinistre',
    objet: 'Déclaration de sinistre',
    libelleGesteam: 'déclaration',
    contexte: 'sinistre',
    champsPropres: ['assurance.compagnie', 'assurance.contrat', 'sinistre.nature', 'sinistre.dateSurvenance', 'sinistre.circonstances'],
    formeLegale: 'libre',
    formeEnvoiParDefaut: 'AR',
    formeObservee: null,
    fondements: ['C. assur. art. L. 113-2, 4°'],
    sansTexte: null,
    delai: { libelle: 'Délai du contrat, au moins cinq jours ouvrés (deux en cas de vol) depuis la connaissance du sinistre', fondement: 'C. assur. art. L. 113-2, 4°', certitude: 'TEXTE' },
    mentions: ['Numéro de police', 'Date et nature du sinistre', 'Circonstances et dommages'],
  },
  declaration_sinistre_do: {
    famille: 'Sinistre',
    objet: 'Déclaration de sinistre dommages-ouvrage',
    libelleGesteam: 'déclaration sinistre DO (AR)',
    contexte: 'sinistre',
    champsPropres: ['assurance.compagnie', 'assurance.contrat', 'do.dateReception', 'do.dateApparition', 'do.localisation'],
    formeLegale: 'libre',
    formeEnvoiParDefaut: 'AR',
    formeObservee: 'AR',
    fondements: ['C. assur. art. L. 242-1', 'C. assur. annexe II à l’art. A. 243-1, A 2° et durée de la garantie', 'C. assur. art. L. 114-1'],
    sansTexte: null,
    delai: {
      libelle:
        "Pas de délai de déclaration propre ; garantie jusqu'à dix ans après la réception ; prescription de deux ans à compter de la connaissance des dommages",
      fondement: 'C. assur. annexe II à l’art. A. 243-1 (durée de la garantie) ; C. assur. art. L. 114-1',
      certitude: 'TEXTE',
    },
    mentions: [
      'Numéro du contrat et, le cas échéant, de l’avenant',
      'Nom du propriétaire de la construction et adresse de la construction',
      'Date de réception ou, à défaut, de première occupation',
      "Date d'apparition, description et localisation des dommages",
      "Pendant l'année de parfait achèvement : copie de la mise en demeure adressée à l'entrepreneur",
    ],
  },
  contestation_expertise: {
    famille: 'Sinistre',
    objet: "Contestation d'expertise",
    libelleGesteam: 'contestation expertise (AR)',
    contexte: 'sinistre',
    champsPropres: ['assurance.compagnie', 'assurance.numeroSinistre', 'expertise.expert', 'contestation.motifs'],
    formeLegale: 'libre',
    formeEnvoiParDefaut: 'AR',
    formeObservee: 'AR',
    fondements: ['C. assur. art. L. 114-2'],
    sansTexte: null,
    delai: { libelle: 'Délais du contrat ; prescription de deux ans', fondement: 'C. assur. art. L. 114-1', certitude: 'TEXTE' },
    mentions: ['Références du sinistre et de la police', 'Motifs, désaccord chiffré', "Demande d'expertise contradictoire ou de tierce expertise prévue au contrat"],
  },
  contestation_expertise_do: {
    famille: 'Sinistre',
    objet: "Contestation d'expertise dommages-ouvrage",
    libelleGesteam: 'contestation expertise (AR)',
    contexte: 'sinistre',
    champsPropres: ['assurance.compagnie', 'assurance.contrat', 'expertise.expert', 'expertise.dateNotification', 'contestation.motifs'],
    formeLegale: 'libre',
    formeEnvoiParDefaut: 'AR',
    formeObservee: 'AR',
    fondements: ['C. assur. art. L. 242-1', 'C. assur. annexe II à l’art. A. 243-1, B 1° a, B 3° c', 'C. assur. art. L. 114-2'],
    sansTexte: null,
    delai: { libelle: "Récusation de l'expert dans les huit jours de la notification de sa désignation", fondement: 'C. assur. annexe II à l’art. A. 243-1, B 1° a', certitude: 'TEXTE' },
    mentions: ['Références du sinistre et de la police', 'Motif : récusation, désaccord chiffré', "Demande d'avance (trois quarts au moins de l'indemnité notifiée)"],
  },
} as const satisfies Record<string, GabaritCourrier>

export type CleGabaritCourrier = keyof typeof GABARITS_COURRIER
export const CLES_GABARITS_COURRIER = Object.keys(GABARITS_COURRIER) as CleGabaritCourrier[]

export function gabaritCourrier(cle: CleGabaritCourrier): GabaritCourrier {
  const gabarit: GabaritCourrier | undefined = Object.hasOwn(GABARITS_COURRIER, cle) ? GABARITS_COURRIER[cle] : undefined
  if (!gabarit) throw new Error(`Gabarit de courrier inconnu : « ${cle} ».`)
  return gabarit
}

/** Socle commun, puis champs propres au contexte. */
export const champsDuContexte = (contexte: ContexteFusionCourrier): ChampFusion[] => [...CHAMPS_SOCLE, ...CHAMPS_PAR_CONTEXTE[contexte]]

const champsRequis = (gabarit: GabaritCourrier): string[] => [...SOCLE_REQUIS, ...gabarit.champsPropres]

const formeConnue = (forme: string | null): boolean => forme === null || (FORME_ENVOI_COURRIER as readonly string[]).includes(forme)

/** Incohérences d'un gabarit du registre. */
function anomaliesGabarit(cle: CleGabaritCourrier, g: GabaritCourrier): string[] {
  const connus = new Set(champsDuContexte(g.contexte).map((c) => c.cle))
  return [
    ...((FAMILLE_MODELE_COURRIER as readonly string[]).includes(g.famille) ? [] : [`${cle} : famille inconnue.`]),
    ...(formeConnue(g.formeEnvoiParDefaut) && formeConnue(g.formeObservee) ? [] : [`${cle} : forme d'envoi inconnue.`]),
    ...champsRequis(g)
      .filter((requis) => !connus.has(requis))
      .map((requis) => `${cle} : champ « ${requis} » hors du contexte.`),
    ...(g.fondements.length === 0 && g.sansTexte === null ? [`${cle} : ni fondement ni pratique déclarée.`] : []),
    ...(g.formeLegale === 'notification_coproprietaire' && g.formeEnvoiParDefaut !== 'AR' ? [`${cle} : notification sans AR par défaut.`] : []),
  ]
}

/** Invariants du registre (vérifiés en test) : liste vide si tout est cohérent. */
export const verifierRegistreGabarits = (): string[] => CLES_GABARITS_COURRIER.flatMap((cle) => anomaliesGabarit(cle, gabaritCourrier(cle)))

export interface ControleContexteFusion {
  complet: boolean
  manquants: ChampFusion[]
  invalides: { cle: string; motif: string }[]
  /** Champs fournis qui n'appartiennent pas au contexte : signalés, pas refusés. */
  inconnus: string[]
}

function motifInvalidite(type: TypeChampFusion, valeur: unknown): string | null {
  if (type === 'date') return estDateIsoValide(valeur) ? null : 'date AAAA-MM-JJ attendue'
  if (type === 'montant') return Number.isInteger(valeur) && (valeur as number) >= 0 ? null : 'centimes entiers positifs ou nuls attendus'
  if (type === 'booleen') return typeof valeur === 'boolean' ? null : 'oui ou non attendu'
  if (typeof valeur !== 'string') return 'texte attendu'
  return valeur.trim() ? null : 'texte vide'
}

/** Contrôle des valeurs de fusion d'un gabarit : champs requis présents et au bon type. */
export function controlerContexteFusion(cle: CleGabaritCourrier, valeurs: Readonly<Record<string, unknown>>): ControleContexteFusion {
  const gabarit = gabaritCourrier(cle)
  const champs = new Map(champsDuContexte(gabarit.contexte).map((c) => [c.cle, c]))
  const manquants: ChampFusion[] = []
  const invalides: { cle: string; motif: string }[] = []
  for (const requis of champsRequis(gabarit)) {
    const definition = champs.get(requis) as ChampFusion
    if (!Object.hasOwn(valeurs, requis) || valeurs[requis] === null || valeurs[requis] === undefined) {
      manquants.push(definition)
      continue
    }
    const motif = motifInvalidite(definition.type, valeurs[requis])
    if (motif) invalides.push({ cle: requis, motif })
  }
  for (const [cleValeur, valeur] of Object.entries(valeurs)) {
    const definition = champs.get(cleValeur)
    if (!definition) continue
    if (champsRequis(gabarit).includes(cleValeur) || valeur === null || valeur === undefined) continue
    const motif = motifInvalidite(definition.type, valeur)
    if (motif) invalides.push({ cle: cleValeur, motif })
  }
  const inconnus = Object.keys(valeurs).filter((c) => !champs.has(c))
  return { complet: manquants.length === 0 && invalides.length === 0, manquants, invalides, inconnus }
}

/** Modèle de courrier prêt pour la table (ModeleCourrier sans identifiant) : contexte = clé du contexte de fusion. */
export function modeleCourrierDepuisGabarit(cle: CleGabaritCourrier): {
  famille: FamilleModeleCourrier
  libelle: string
  contexte: ContexteFusionCourrier
  formeEnvoi: FormeEnvoiCourrier
} {
  const g = gabaritCourrier(cle)
  return { famille: g.famille, libelle: g.objet, contexte: g.contexte, formeEnvoi: g.formeEnvoiParDefaut }
}

export interface AnomalieFormeEnvoi {
  code: 'acte_extrajudiciaire_requis' | 'lrar_requise' | 'envoi_non_qualifie' | 'lrar_hors_demande' | 'voie_inconnue'
  gravite: 'bloquant' | 'avertissement'
  message: string
}

const ENVOI_NON_QUALIFIE: AnomalieFormeEnvoi = {
  code: 'envoi_non_qualifie',
  gravite: 'bloquant',
  message:
    'Envoi simple : il ne vaut pas notification ; lettre recommandée électronique ou prestataire qualifié (D. 1967 art. 64), LRAR sur demande de voie postale (art. 64-1).',
}

function anomaliesNotification(forme: FormeEnvoiCourrier, voie: 'electronique' | 'postale' | null): AnomalieFormeEnvoi[] {
  if (voie === 'postale')
    return forme === 'AR'
      ? []
      : [{ code: 'lrar_requise', gravite: 'bloquant', message: 'Voie postale demandée : lettre recommandée avec avis de réception (D. 1967 art. 64-1).' }]
  if (voie === 'electronique')
    return forme === 'AR'
      ? [{ code: 'lrar_hors_demande', gravite: 'avertissement', message: "Voie électronique de principe : LRAR sans demande de voie postale, validité à confirmer (L. 1965 art. 42-1)." }]
      : [ENVOI_NON_QUALIFIE]
  return [
    { code: 'voie_inconnue', gravite: 'avertissement', message: 'Voie de notification du destinataire inconnue : la vérifier (demande de voie postale).' },
    ...(forme === 'AR' ? [] : [ENVOI_NON_QUALIFIE]),
  ]
}

/**
 * Contrôle de la forme d'envoi d'un courrier issu d'un gabarit, selon la forme imposée et la voie du destinataire. Une
 * convocation remise contre récépissé ou émargement est valable quelle que soit la voie (D. 1967 art. 64-3) : le
 * référentiel des formes d'envoi n'ayant pas cette valeur, l'appelant le signale par `remiseContreEmargement`.
 */
export function controlerFormeEnvoi(
  cle: CleGabaritCourrier,
  forme: FormeEnvoiCourrier,
  { voie, remiseContreEmargement = false }: { voie: 'electronique' | 'postale' | null; remiseContreEmargement?: boolean },
): AnomalieFormeEnvoi[] {
  const gabarit = gabaritCourrier(cle)
  if (gabarit.formeLegale === 'acte_extrajudiciaire')
    return [{ code: 'acte_extrajudiciaire_requis', gravite: 'avertissement', message: "L'opposition se forme par acte de commissaire de justice au domicile élu ; ce courrier ne la remplace pas (L. 1965 art. 20, I)." }]
  if (gabarit.formeLegale !== 'notification_coproprietaire') return []
  if (remiseContreEmargement && gabarit.remiseContreEmargementAdmise) return []
  return anomaliesNotification(forme, voie)
}

function verifierDate(date: string, libelle: string): void {
  if (!estDateIsoValide(date)) throw new Error(`${libelle} invalide (${date}) : AAAA-MM-JJ attendu.`)
}

/**
 * Certificat de l'art. 20 II à délivrer : 1° si aucune des personnes notifiées par le notaire (candidat acquéreur, ses
 * mandataires sociaux et associés, leurs conjoints ou partenaires) n'est copropriétaire, 2° sinon.
 */
export const choisirCertificatArt20 = (unePersonneNotifieeCoproprietaire: boolean): 'certificat_art20_ii_1' | 'certificat_art20_ii_2' =>
  unePersonneNotifieeCoproprietaire ? 'certificat_art20_ii_2' : 'certificat_art20_ii_1'

/** Seuil de l'art. 20 II, 2° : mise en demeure restée infructueuse depuis plus de 45 jours. */
export const JOURS_MISE_EN_DEMEURE_ART20 = 45

/**
 * Certificat de l'art. 20 II : lequel, s'il peut être délivré, et jusqu'à quand (un mois depuis la réception de la
 * notification du notaire). Si l'une des personnes notifiées est copropriétaire : pas de certificat dès qu'une mise en
 * demeure de payer de l'une d'elles, non réglée à la date, a son point de départ plus de 45 jours avant.
 */
export function controlerCertificatArt20({
  unePersonneNotifieeCoproprietaire,
  misesEnDemeure,
  dateNotificationNotaire,
  aujourdhui,
}: {
  unePersonneNotifieeCoproprietaire: boolean
  /**
   * Mises en demeure de payer des personnes notifiées copropriétaires. Point de départ : lendemain de la première
   * présentation de la LRAR (D. 1967 art. 64-1) ou de la transmission de l'avis électronique (art. 64).
   */
  misesEnDemeure: { pointDeDepart: string; regleeLe: string | null }[]
  dateNotificationNotaire: string
  aujourdhui: string
}): { cle: 'certificat_art20_ii_1' | 'certificat_art20_ii_2'; delivrable: boolean; echeance: string; motif: string } {
  verifierDate(dateNotificationNotaire, 'Date de la notification du notaire')
  verifierDate(aujourdhui, 'Date du jour')
  for (const m of misesEnDemeure) {
    verifierDate(m.pointDeDepart, 'Point de départ de la mise en demeure')
    if (m.regleeLe !== null) verifierDate(m.regleeLe, 'Date de règlement')
  }
  if (!unePersonneNotifieeCoproprietaire && misesEnDemeure.length > 0)
    throw new Error("Mises en demeure fournies alors qu'aucune personne notifiée n'est copropriétaire : données incohérentes.")
  const cle = choisirCertificatArt20(unePersonneNotifieeCoproprietaire)
  const echeance = ajouterMois(dateNotificationNotaire, 1)
  const bloquante = misesEnDemeure.find(
    (m) => (m.regleeLe === null || m.regleeLe > aujourdhui) && ecartJours(m.pointDeDepart, aujourdhui) > JOURS_MISE_EN_DEMEURE_ART20,
  )
  if (bloquante)
    return {
      cle,
      delivrable: false,
      echeance,
      motif: `Mise en demeure (départ le ${dateIsoVersFr(bloquante.pointDeDepart)}) restée infructueuse depuis plus de ${JOURS_MISE_EN_DEMEURE_ART20} jours : pas de certificat ; le notaire notifie aux parties l'impossibilité de conclure la vente. Si un avant-contrat est signé, les personnes notifiées (acquéreur, mandataires sociaux, associés, conjoints ou partenaires) disposent de trente jours à compter de cette notification pour s'acquitter de leur dette : un certificat de règlement sera alors à remettre (L. 1965 art. 20, II).`,
    }
  const motif =
    aujourdhui > echeance
      ? `Délai d'un mois expiré le ${dateIsoVersFr(echeance)} : délivrer le certificat sans attendre (L. 1965 art. 20, II).`
      : `Certificat à délivrer au notaire au plus tard le ${dateIsoVersFr(echeance)} (L. 1965 art. 20, II).`
  return { cle, delivrable: true, echeance, motif }
}

/**
 * Opposition de l'art. 20 I : à former avant l'expiration de quinze jours depuis la réception de l'avis de mutation.
 * Échéance un jour non ouvrable : avertissement, avec le dernier jour ouvrable qui la précède (le report au jour ouvrable
 * suivant n'est pas établi pour ce délai).
 */
export function echeanceOppositionArt20(dateReceptionAvis: string): {
  echeance: string
  dernierJourOuvrable: string
  avertissement: string | null
  fondement: string
  certitude: CertitudeRegle
} {
  verifierDate(dateReceptionAvis, "Date de réception de l'avis de mutation")
  const echeance = ajouterJours(dateReceptionAvis, 15)
  let dernierJourOuvrable = echeance
  while (!estJourOuvrable(dernierJourOuvrable)) dernierJourOuvrable = ajouterJours(dernierJourOuvrable, -1)
  const avertissement =
    dernierJourOuvrable === echeance
      ? null
      : `Échéance le ${dateIsoVersFr(echeance)}, jour non ouvrable : faire signifier l'opposition au plus tard le ${dateIsoVersFr(dernierJourOuvrable)} ; le report au jour ouvrable suivant n'est pas établi.`
  return { echeance, dernierJourOuvrable, avertissement, fondement: 'L. 1965 art. 20, I', certitude: 'A_CONFIRMER' }
}

/**
 * Attestation de non-recours : délivrable le lendemain de la dernière échéance de contestation, sans assignation reçue.
 * Il faut un délai calculé par opposant ou défaillant (`notificationsAttendues` : leur nombre) ; en cas de report au jour
 * ouvrable débattu, la date la plus tardive fait foi. 🔵 Sans opposant ni défaillant, aucune contestation n'est ouverte.
 */
function verifierEntierPositif(nom: string, valeur: number): void {
  if (!Number.isInteger(valeur) || valeur < 0) throw new Error(`${nom} invalide (${valeur}) : entier positif ou nul attendu.`)
}

/** Dernière échéance de contestation (la plus tardive des deux calculs), ou le motif qui empêche de la connaître. */
function derniereEcheance(resultats: ResultatDelaiContestation[]): { echeance: string } | { motif: string } {
  let derniere = ''
  for (const r of resultats) {
    if (r.etat === 'non_notifiee') return { motif: "Procès-verbal non notifié : le délai de l'art. 42 n'a pas couru." }
    if (r.etat === 'refuse') return { motif: r.motif }
    const echeance = r.echeanceAvecReport > r.echeanceSansReport ? r.echeanceAvecReport : r.echeanceSansReport
    if (echeance > derniere) derniere = echeance
  }
  return { echeance: derniere }
}

export function controlerAttestationNonRecours(
  resultats: ResultatDelaiContestation[],
  aujourdhui: string,
  { assignationsRecues, notificationsAttendues }: { assignationsRecues: number; notificationsAttendues: number },
): { delivrable: boolean; motif: string } {
  verifierDate(aujourdhui, 'Date du jour')
  verifierEntierPositif('Assignations reçues', assignationsRecues)
  verifierEntierPositif('Notifications attendues', notificationsAttendues)
  if (resultats.length > notificationsAttendues)
    throw new Error(`${resultats.length} délais fournis pour ${notificationsAttendues} opposant(s) ou défaillant(s) : données incohérentes.`)
  if (assignationsRecues > 0) return { delivrable: false, motif: `${assignationsRecues} assignation(s) en contestation reçue(s) : pas d'attestation.` }
  if (notificationsAttendues === 0)
    return { delivrable: true, motif: "Aucun opposant ni défaillant : aucune contestation n'est ouverte (L. 1965 art. 42, al. 2 ; à confirmer)." }
  if (resultats.length < notificationsAttendues)
    return { delivrable: false, motif: `${notificationsAttendues - resultats.length} notification(s) d'opposant ou de défaillant sans délai calculé.` }
  const resultat = derniereEcheance(resultats)
  if ('motif' in resultat) return { delivrable: false, motif: resultat.motif }
  const derniere = resultat.echeance
  return aujourdhui > derniere
    ? { delivrable: true, motif: `Délai de contestation expiré le ${dateIsoVersFr(derniere)} (L. 1965 art. 42, al. 2).` }
    : { delivrable: false, motif: `Délai de contestation en cours jusqu'au ${dateIsoVersFr(derniere)} inclus (L. 1965 art. 42, al. 2).` }
}

/** Caducité du protocole d'apurement : possible seulement si une échéance échue reste impayée. */
export function controlerCaduciteProtocole(suivi: SuiviEcheancier): { caducitePossible: boolean; impayesCentimes: number; motif: string } {
  if (suivi.respecte || suivi.impayesCentimes <= 0)
    return { caducitePossible: false, impayesCentimes: 0, motif: 'Protocole respecté : aucune échéance échue impayée.' }
  return {
    caducitePossible: true,
    impayesCentimes: suivi.impayesCentimes,
    motif:
      "Échéances échues impayées : mise en demeure à notifier en visant expressément la clause résolutoire (C. civ. art. 1225), sauf résolution de plein droit prévue au protocole.",
  }
}
