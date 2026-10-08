// =============================================================================
//  VitFix — référentiels issus de Gestéam 5.4.22
// =============================================================================
//  Fichier GÉNÉRÉ depuis code/referentiels/*.json, eux-mêmes relevés en
//  consultation LECTURE SEULE de Gestéam les 07 et 08/10/2026.
//
//  Règles de lecture
//  -----------------
//  @portee copropriete  → à reprendre dans VitFix.
//  @portee gerance      → existe chez Gestéam pour la gérance locative :
//                         hors périmètre VitFix, conservé pour traçabilité.
//  @statut OBSERVE      → valeur lue à l'écran, telle quelle.
//  @statut ECHANTILLON  → liste non exhaustive (relevé par défilement).
//
//  Invariant à ne pas oublier : « Gestéam ne possède pas X » ne veut pas dire
//  « VitFix ne doit pas avoir X ». Ces listes sont une référence, pas une borne.
// =============================================================================

/**
 * Nomenclature des annexes comptables de copropriété (décret du 14 mars 2005).
 * Portée sur PlanComptable.typeSru. C'est la grille qui permet de produire les annexes légales.
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — Syndic > Réglages > 1-Plan comptable, critère Type SRU
 */
export const TYPE_SRU = [
  "Budget - Dépenses",
  "Budget - Provisions",
  "Travaux - Dépenses",
  "Travaux - Provisions",
  "Travaux - Appels",
  "Travaux - Subventions, autres produits",
  "Travaux - Emprunts",
  "Travaux - Bilan",
  "Travaux - Honoraires",
  "Travaux - Subventions, produits à recevoir",
  "Travaux urgents - Dépenses",
  "Travaux urgents - Provisions",
  "Hors budget - Dépenses",
  "Hors budget - Produits",
] as const;
export type TypeSru = (typeof TYPE_SRU)[number];

/**
 * Catégorie d'une entrée de plan comptable. Mélange copropriété et gérance.
 * @portee copropriete + gerance
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — Plan comptable, critère Catégorie
 */
export const CATEGORIE_PLAN_COMPTABLE = [
  "Mandat de syndic",
  "Mandat de gérance",
  "Mandant",
  "Fonds permanents",
  "Fournisseurs & perso.",
  "Locataire",
  "Copropriétaire",
  "Honoraires",
  "Compte d'attente",
  "Autres comptes",
  "Financier",
  "Charges courantes",
  "Travaux",
  "Appels budget",
  "Quittance",
  "Fonds placés",
  "Autres produits",
  "Classe de compte",
] as const;
export type CategoriePlanComptable = (typeof CATEGORIE_PLAN_COMPTABLE)[number];

/**
 * Axe de classement transversal : partagé par demandes, étapes, mémos, analytiques, mouvements, documents.
 * @portee copropriete + gerance
 * @statut OBSERVE — 15 valeurs vérifiées
 * @source Gestéam 5.4.22 — critère Dossier (référentiel transversal)
 */
export const DOSSIER = [
  "Gestion",
  "Contrat",
  "Travaux",
  "Equipement",
  "Mutation",
  "Sinistre",
  "Contentieux",
  "Assemblée",
  "Bail",
  "Communication",
  "Exercice comptable",
  "Comptabilité",
  "Mandat de syndic",
  "Mandat de gérance",
  "Location Transaction",
] as const;
export type Dossier = (typeof DOSSIER)[number];

/**
 * Type d'un journal comptable. Un journal de type Banque porte le compte de contrepartie
 * et la date limite de saisie : c'est là qu'est le verrouillage de période.
 * @portee copropriete
 * @statut OBSERVE — énumération fermée mais OPTIONNELLE : 46 journaux sur 107 n'ont pas de type
 *   (dont tous les journaux d'appel de fonds travaux 40-60) → `Journal.type?: TypeJournal`.
 *   Le code journal n'est PAS une clé : `CB` apparaît 7 fois, distingué par le sous-compte de
 *   sa contrepartie (tranche 21 §8).
 * @source Gestéam 5.4.22 — onglet Syndic > Réglages > 2-Journaux
 */
export const TYPE_JOURNAL = [
  "Quittancement",
  "Opérations",
  "Achats",
  "Banque",
  "Clôture",
] as const;
export type TypeJournal = (typeof TYPE_JOURNAL)[number];

/**
 * Source d'un paramétrage comptable (plan, journaux, analytiques, modèles d'écritures).
 * VitFix n'a besoin que de « Copropriété » et « Commune ».
 * @portee copropriete + gerance
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — critère Source des écrans de paramétrage comptable
 */
export const SOURCE_COMPTABLE = [
  "Commune",
  "Copropriété",
  "Gérance",
  "REAJIR",
  "4 Immeubles confrère",
] as const;
export type SourceComptable = (typeof SOURCE_COMPTABLE)[number];

/**
 * Déclare quel objet métier alimente le 3e segment du numéro de compte auxiliaire.
 * Rappel du format : <Mandat(4)>.<Plan(5)>.<Auxiliaire(5)>.<Repère(1)>.
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam — champ « N° Compte » de l'entrée de plan comptable (tranche 12, reconfirmé tranche 13)
 */
export const REGLE_NUMERO_COMPTE = [
  "A zéro",
  "Libre",
  "Fixe",
  "Série",
  "No d'identité",
  "No d'entreprises",
  "No des travaux",
  "No de lot",
  "No d'indivisaire",
] as const;
export type RegleNumeroCompte = (typeof REGLE_NUMERO_COMPTE)[number];

/**
 * Catalogue des opérations qui génèrent des écritures — énumération de référence de Traitement.famille.
 * « Répartition de charges » y figure avec son annulation symétrique : c'est un traitement
 * historisé et annulable, pas un calcul à la volée.
 * Blocs purement gérance exclus de cette constante : Quittancement (gérance), Mandant (gérance) (voir le JSON source).
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — Syndic > Traitements, critère Famille
 */
export const FAMILLE_TRAITEMENT = {
  "Copropriété": [
    "Appel de fonds",
    "Annulation d'appel de fonds",
    "Répartition de charges",
    "Annulation répartition de charges",
  ],
  "Encaissement": [
    "Encaissement",
    "Prélèvement",
    "Fichier TIP",
    "Fichier Virement reçus",
    "Fichier carte bancaire",
    "Relances",
    "Annulation d'encaissement",
    "Encaissement des RNA",
  ],
  "Factures": [
    "Saisie de factures",
    "Facture, Bon à payer",
    "Import de factures",
    "Conversion de mouvement en bascule",
  ],
  "Règlements": [
    "Règlement de factures",
    "Règlement de soldes de compte",
    "Règlement bascule Gérance/Copro.",
    "Règlement de bascule créditrice",
    "Règlement de banque à banque",
    "Ajustement bancaire fonds travaux",
    "Annulation de règlements",
  ],
  "Mouvements": [
    "Saisie de mouvements",
    "Correction de mouvements",
    "Report de soldes comptables",
    "Import de mouvements",
    "Delta récupérable lots vacants",
    "Delta récupérable locataires sortis",
    "Migration",
  ],
  "Rapprochement": [
    "(Rapprochement Manuel)",
    "(Rapprochement Automatique)",
    "Rapprochement bancaire",
    "Import de relevé de banque",
  ],
  "Honoraires": [
    "Calcul des honoraires de gestion",
    "Calcul des honoraires divers",
    "Calcul des honoraires d'abonnement",
    "Calcul des honoraires de diffusion",
    "Calcul des honoraires de location",
    "Imputation des honoraires divers",
    "Centralisation des honoraires",
    "Provisions honoraires de gérance",
    "Importer des details d'honoraires",
  ],
  "Mandat": [
    "Mutation",
    "Intégration de mandat",
    "Clôture de mandat",
  ],
  "Utilitaires": [
    "Transfert de mandat",
    "Import de données diverses",
    "Export de données diverses",
  ],
  "Divers": [
    "Etat paramétré",
    "Liste de controles",
    "Traitement de données",
  ],
} as const satisfies Record<string, readonly string[]>;
export type BlocTraitement = keyof typeof FAMILLE_TRAITEMENT;

/**
 * Suit la demande administrative. Axe distinct du stade d'intervention.
 * @portee copropriete
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — module Demandes
 */
export const STATUT_DEMANDE = [
  "En cours",
  "Terminé",
  "Accepté",
  "Refusé",
  "Accusé demandé",
  "Rapport demandé",
] as const;
export type StatutDemande = (typeof STATUT_DEMANDE)[number];

/**
 * Suit l'intervention sur le terrain. « Proposition résident » et « Contestée » montrent
 * que le circuit intègre le résident, pas seulement l'entreprise.
 * @portee copropriete
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — module Demandes
 */
export const STADE_INTERVENTION = [
  "Acceptée",
  "Refusée",
  "Proposition en cours",
  "Proposition résident",
  "Programmée",
  "Réalisée",
  "Contestée",
  "Validée",
] as const;
export type StadeIntervention = (typeof STADE_INTERVENTION)[number];

/**
 * Statut d'une étape de check-list.
 * @portee copropriete
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — module Etapes
 */
export const STATUT_ETAPE = [
  "En attente",
  "A faire",
  "A valider",
  "Terminée",
] as const;
export type StatutEtape = (typeof STATUT_ETAPE)[number];

/**
 * Types d'événement, par famille. Les « Liste de contrôle » sont des check-lists déclenchées
 * par un événement — dont « Nouveau mandat de syndic », l'équivalent Gestéam de la prise de fonction.
 * Les entrées entre crochets viennent de l'extranet (Webteam) ou du mobile (AppTeam).
 * @portee copropriete + gerance
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — module Etapes
 */
export const PROCESSUS = {
  "Autres": [
    "Conseil syndical",
    "Dépannage",
    "Réunion d'expertise",
    "Réunion de chantier",
    "Visite d'immeuble",
    "[Changement d'adresse]",
    "[Changer mon adresse]",
    "[Modification de mot de passe]",
  ],
  "Gérance": [
    "Congé locataire",
  ],
  "Liste de contrôle - Bail": [
    "Départ locataire",
    "Nouveau bail",
  ],
  "Liste de contrôle - Mandat": [
    "Nouveau mandat de gérance",
    "Nouveau mandat de syndic",
  ],
  "Mobile - AppTeam": [
    "A Traiter",
    "Conseil syndical",
    "Dépannage",
    "Inventaire d'Immeuble",
    "Visite d'immeuble",
    "Visite de chantier",
  ],
  "Syndic": [
    "Communication à ND",
  ],
  "Webteam - Formulaire": [
    "[Activer les AR électroniques]",
    "[Ajouter ou remplacer mon mandataire]",
    "[Ajouter une coordonnée]",
    "[Changer de mode de règlement]",
  ],
} as const satisfies Record<string, readonly string[]>;
export type FamilleProcessus = keyof typeof PROCESSUS;

/**
 * Arbre des domaines techniques, utilisé par les contrats, demandes, travaux et entreprises.
 * La branche SERVICES/ETUDES contient déjà Administrateur judiciaire, Mandataire judiciaire,
 * Huissier, Avocat, Notaire — mais comme spécialité de prestataire, jamais comme type de mandat.
 * @portee copropriete + gerance
 * @statut ECHANTILLON — 13 racines complètes, feuilles relevées par déploiement
 * @source Gestéam 5.4.22 — référentiel Domaine (arbre déployé)
 */
export const DOMAINE = {
  "ACCES": [
    "Ascenseur",
    "Badges",
    "Barrière automatique",
    "Caméra",
    "Contrôle d'accès",
    "Digicode",
    "Emetteur/récepteur",
    "Ferme porte",
    "Frein de porte",
    "Gâche électrique",
    "Interphone",
    "Lecteur de cartes/badges",
    "Monte charge",
    "Monte poubelle",
    "Monte voiture",
    "Portail",
    "Porte automatique",
    "Porte basculante",
    "Porte de parking",
    "Serrurerie",
    "Vidéophone",
  ],
  "BATIMENT": [
    "Carrelage",
    "Charpente",
    "Cheneaux et Gouttieres",
    "Couverture",
    "Décoration",
    "Etanchéité",
    "Maçonnerie",
    "Menuiserie",
    "Miroiterie",
    "Moquette",
    "Parquet",
    "Peinture",
    "Ravalement",
    "Rénovation",
    "Revêtements de sols",
    "Stores",
    "Structure",
    "Tapis d'escalier, tapis",
    "Terrasse, étanchéité",
    "Toiture",
    "Traitement des sols",
    "Vitrerie",
    "Volets",
    "Zinguerie",
  ],
  "CHAUFFAGE/CIRCUIT D'EAU": [
    "Chauffage",
    "Climatisation",
    "Entretien compteur",
    "Fourniture d'eau",
    "Fourniture de fioul",
    "Fourniture de Gaz",
    "Location compteur individuel",
    "Plomberie",
    "Pompe de Relevage",
    "Relevage compteur",
  ],
  "ASSURANCES": [
    "Canalisations enterrées",
    "Bris de glace",
    "Dégât des eaux",
    "Tempête, Grêles, Neiges",
    "Vol",
  ],
  "AUTRES ABONNEMENTS CONTRACTUELS": [

  ],
  "ELECTRICITE": [

  ],
  "EQUIPEMENTS": [
    "Plieuse",
    "Ventilation cuisine",
    "VMC",
  ],
  "ESPACES VERTS": [
    "Entretien espaces verts",
    "Fournitures de jardin",
    "Paysagiste",
    "Plantations",
  ],
  "COMMUNICATION": [
    "Annonceur",
    "Antenne relais telecom",
    "Antenniste",
    "Boites aux lettres",
    "Câble numérique",
    "Communication téléphonique",
    "Enseigne",
    "Réception télévision",
    "Tableau nominatif, étiquettes BAL",
  ],
  "NETTOYAGE/HYGIENE": [
    "Diagnostics > Amiante",
    "Containers",
    "Habillement de travail",
    "Monobrosse",
    "Nettoyeur haute pession",
    "Produits d'entretien",
    "Vide-ordures",
    "Nettoyage > Cristallisation",
    "Nettoyage > Enlèvement d'ordures menagères",
    "Nettoyage > Nettoyage des vitres",
    "Nettoyage > Nettoyage immeuble",
    "Nettoyage > Nettoyage parking",
    "Nettoyage > Nettoyage terrasse",
  ],
  "SECURITE": [
    "Alarme",
    "Audit de sécurité",
    "Blocs de secours",
    "Colonnes sèches",
    "Desenfumage",
    "Evaluation Risques Professionnels",
    "Extincteurs",
  ],
  "SERVICES/ETUDES": [
    "Administrateur Judiciaire",
    "Architecte",
    "Archives",
    "Avocat",
    "Bureau d'études",
    "Comptabilité",
    "Coordinateur SPS",
    "Fourrière",
    "Géomètre",
    "Hébergement",
    "Huissier",
    "Informatique",
    "Location de salle",
    "Mandataire Judiciaire",
    "Notaire",
    "Restauration",
    "Traducteur assermenté",
  ],
  "V.R.D.": [
    "Canalisations",
    "Terrassements",
  ],
} as const satisfies Record<string, readonly string[]>;
export type RacineDomaine = keyof typeof DOMAINE;

/**
 * @portee copropriete + gerance
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — modules Mandats, Mouvements, Documents
 */
export const TYPE_GESTION_MANDAT = [
  "Copropriété gérée",
  "Lot isolé",
  "Totale",
  "Lot individuel",
] as const;
export type TypeGestionMandat = (typeof TYPE_GESTION_MANDAT)[number];

/**
 * « En gestion, en clôture » est un statut composite : un mandat peut être simultanément
 * actif et en cours de clôture. C'est une transition, pas un état exclusif.
 * @portee copropriete
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — modules Mandats, Mouvements, Documents
 */
export const STATUT_MANDAT = [
  "Prospect",
  "En gestion",
  "En clôture",
  "En gestion, en clôture",
  "Archivé",
] as const;
export type StatutMandat = (typeof STATUT_MANDAT)[number];

/**
 * « Mission administrateur » est la façon dont le cabinet marque aujourd'hui un mandat judiciaire,
 * faute de type de mandat dédié. Les « No … » sont les identifiants du syndicat employeur
 * (SIRET, URSSAF, caisse de retraite, mutuelle, prévoyance, ICS pour les prélèvements SEPA).
 * @portee copropriete
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — modules Mandats, Mouvements, Documents
 */
export const PARTICULARITE_MANDAT = [
  "Accepte les AG en visio",
  "Refuse les AG en visio",
  "No Siret",
  "No Caisse Retraite",
  "No Immatriculation",
  "No Mutuelle",
  "No Prevoyance",
  "No Registre",
  "No Taxe Salaire",
  "No URSSAF",
  "No ICS",
  "Mission administrateur",
  "Adhérent à un contrat de prestation",
  "Non adhérent à un contrat de prestation",
] as const;
export type ParticulariteMandat = (typeof PARTICULARITE_MANDAT)[number];

/**
 * @portee copropriete
 * @statut OBSERVE — confirmé deux fois (M5 puis tranche 18)
 * @source Gestéam 5.4.22 — modules Mandats, Mouvements, Documents
 */
export const STATUT_MOUVEMENT = [
  "En saisie",
  "Imputé",
  "Archivé",
  "Extra-Comptable",
  "Incorrect",
] as const;
export type StatutMouvement = (typeof STATUT_MOUVEMENT)[number];

/**
 * Un mouvement sait s'il est lié à un appel de fonds, et à quel type d'appel.
 * Le chaînage appel → écriture est donc porté par le mouvement lui-même.
 * @portee copropriete
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — modules Mandats, Mouvements, Documents
 */
export const TYPE_APPEL_LIE_AU_MOUVEMENT = [
  "Budget",
  "Travaux",
  "Avance permanente",
  "Fonds de prévoyance",
  "Fonds de réserve",
  "Fonds de solidarité",
  "Travaux urgents",
  "Fonds travaux",
  "Emprunt",
] as const;
export type TypeAppelLieAuMouvement = (typeof TYPE_APPEL_LIE_AU_MOUVEMENT)[number];

/**
 * Ventilation de l'état « Position des mandants » (garantie financière).
 * @portee copropriete + gerance
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — modules Mandats, Mouvements, Documents
 */
export const POSITION_DES_MANDANTS = [
  "Fonds permanent",
  "Fournisseur et personnel",
  "Client",
  "Honoraires",
  "Compte attente",
  "Autre",
  "CRG/Charges",
  "Travaux",
  "Quit/Prov",
  "Prop/Ind./50 bloqué",
  "Prod. divers",
] as const;
export type PositionDesMandants = (typeof POSITION_DES_MANDANTS)[number];

/**
 * Extrait judiciaire du référentiel des types de document (plusieurs centaines d'entrées au total).
 * Gestéam connaît donc le vocabulaire — ordonnances, requêtes, PV de l'AJ — mais uniquement
 * comme étiquettes de classement : aucune entité, aucun délai, aucune taxation.
 * @portee copropriete
 * @statut ECHANTILLON — famille judiciaire relevée en entier
 * @source Gestéam 5.4.22 — modules Mandats, Mouvements, Documents
 */
export const TYPE_DOCUMENT_JUDICIAIRE = [
  "Ordonnance de désignation",
  "Ordonnance de prolongation de mission",
  "Ordonnance de fin de mission",
  "Ordonnance de taxe",
  "Ordonnance d'Expropriation",
  "Ordonnance (autres)",
  "Procès-Verbal de prise de décisions par l'AJ",
  "Requete au Tribunal",
  "Requête en injonction de payer",
  "Assignation au nom du syndicat",
  "Correspondance avec Tribunal",
  "Conclusions / avocats",
  "Signification de jugement",
  "Commandement de payer (huissier)",
  "Commandement de Saisie",
  "Protocole d'accord de recouvrement",
  "Aide juridictionnelle (demande/décision)",
  "Procuration main-levée Hypothèque",
  "Réquisition hypothécaire",
  "Police charges impayées",
] as const;
export type TypeDocumentJudiciaire = (typeof TYPE_DOCUMENT_JUDICIAIRE)[number];

/**
 * Le même référentiel sert aux lots privatifs et aux locaux communs.
 * « Jouissance Parcelle » et « Palier privatif » montrent qu'il couvre aussi les droits
 * de jouissance exclusive.
 * @portee copropriete
 * @statut OBSERVE — liste complète relevée
 * @source Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées
 */
export const TYPE_LOT = [
  "Appartement",
  "Appartement + cave",
  "Appartement professionnel",
  "Atelier",
  "Boutique",
  "Boutique et arrière boutique",
  "Bureau",
  "Bureau + Wc",
  "Chambre",
  "Entrepôt",
  "Immeuble",
  "Local à usage d'habitation",
  "Local à usage d'habitation + grenier",
  "Local commercial",
  "Loft",
  "Loge concierge avec chambre",
  "Logement",
  "Magasin",
  "Magasin + cave",
  "Maison / Villa",
  "Pavillon",
  "Pièce",
  "Salle café avec arrière-boutique",
  "Studio",
  "Local technique",
  "Aire de jeu",
  "Box",
  "Box double",
  "Buanderie",
  "Cave",
  "Cellier",
  "Chaufferie",
  "Comble",
  "Couloir",
  "Cour",
  "Cuisine",
  "Débarras",
  "Dégagement",
  "Divers",
  "Entrée + local + paliers et cage d'escalier",
  "Escalier",
  "Garage",
  "Grenier",
  "Jardin",
  "Jouissance Parcelle",
  "Local",
  "Local poubelles",
  "Local poussettes",
  "Local vélo",
  "Palier et escalier privatif",
  "Palier privatif",
  "Parking",
  "Parking double",
  "Parking extérieur",
  "Parking sous-sol",
  "Passage",
  "Remise",
  "Remise Cellier",
  "Réserve",
  "Salle d'eau",
  "Salle de jeux",
  "Séchoir",
  "Station d'épuration",
  "Terrain",
  "Terrasse",
  "Toit Terrasse",
  "Voirie",
] as const;
export type TypeLot = (typeof TYPE_LOT)[number];

/**
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées
 */
export const TYPE_CONTRAT = [
  "Prestation",
  "Maintenance",
  "Assurance",
  "Dommages Ouvrages",
  "Fourniture de consommable",
  "Contrat de travail",
  "Assurance loyer impayé",
  "Garantie vacance locative",
  "Etat des lieux, diagnostic",
  "Autres abonnements",
] as const;
export type TypeContrat = (typeof TYPE_CONTRAT)[number];

/**
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées
 */
export const STATUT_CONTRAT = [
  "En cours",
  "Résilié",
  "Plus géré",
] as const;
export type StatutContrat = (typeof STATUT_CONTRAT)[number];

/**
 * Cycle de vie complet, de la décision à la répartition comptable :
 * projet → adopté (voté en AG) → commandé → commencé → terminé → à clôturer → réparti.
 * Le dernier état est comptable : les dépenses ont été réparties entre les copropriétaires.
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées
 */
export const STATUT_TRAVAUX = [
  "Projet",
  "Adopté",
  "Commandé",
  "Commencé",
  "Terminé",
  "A clôturer",
  "Réparti",
  "En cours",
  "Rejeté",
] as const;
export type StatutTravaux = (typeof STATUT_TRAVAUX)[number];

/**
 * Cinq types relèvent de la copropriété en difficulté et non du registre technique :
 * Plan de Sauvegarde, Réhabilitation, Procédures, Créances douteuses, Conservation de l'immeuble
 * (article 18 de la loi de 1965). Le cabinet suit donc déjà ses opérations d'administration
 * provisoire à travers le module Travaux.
 * @portee copropriete
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées
 */
export const TYPE_TRAVAUX = [
  "Anti pigeons",
  "Architecte Etude",
  "Ascenseur",
  "Assurance DO",
  "Audit Toiture",
  "Boites aux lettres",
  "Chaufferie",
  "Circuit d'eau / Chauffage",
  "Climatisation",
  "Conservation de l'immeuble",
  "Couverture",
  "Créances douteuses",
  "Dallage",
  "Diagnostic",
  "Eclairage",
  "Electricité",
  "Entretien et sécurisation",
  "Espaces verts",
  "Etablissement d'un Règlement de Copropriété",
  "Etanchéité",
  "Etudes",
  "Expertise",
  "Gardiens / Employés d'immeuble",
  "Gaz",
  "Hygiène / Nettoyage",
  "Loge",
  "Maçonnerie",
  "Maîtrise d'oeuvre",
  "Menuiserie",
  "Peinture",
  "Plan de Sauvegarde",
  "Plomberie",
  "Pose de compteurs",
  "Procédures",
  "Ravalement",
  "Réfection cage d'escaliers",
  "Réhabilitation",
  "Sécurité",
  "Serrurerie",
  "Travaux",
  "Travaux Chauffage",
  "Vide ordures",
] as const;
export type TypeTravaux = (typeof TYPE_TRAVAUX)[number];

/**
 * La nature « Judiciaire » existe chez Gestéam — troisième endroit où le judiciaire est étiqueté,
 * avec la particularité de mandat et les types de document.
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées
 */
export const NATURE_ASSEMBLEE = [
  "Annuelle",
  "Spéciale",
  "Judiciaire",
] as const;
export type NatureAssemblee = (typeof NATURE_ASSEMBLEE)[number];

/**
 * Suit le cycle légal : projet → convoquée → PV signé → notifiée.
 * C'est de la notification que part le délai de contestation de l'article 42 — donc le moteur
 * de délais de VitFix doit s'accrocher à ce quatrième état.
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées
 */
export const STATUT_ASSEMBLEE = [
  "Projet",
  "Convoquée",
  "PV signé",
  "Notifiée",
] as const;
export type StatutAssemblee = (typeof STATUT_ASSEMBLEE)[number];

/**
 * Libellés du menu des états comptables. ⚠ Le CONTENU et les COLONNES de ces états n'ont pas été
 * relevés : il faudrait lancer une édition, ce que la consigne de lecture seule interdit.
 * @portee copropriete
 * @statut OBSERVE (libellés seulement) — aucune édition déclenchée
 * @source Gestéam 5.4.22 — onglet Syndic > Analyses > Etats comptables
 */
export const ETAT_COMPTABLE = [
  "1 — Position des mandants",
  "2 — Pointe de garantie",
  "3 — Grand livre",
  "4 — Balance",
  "5 — Journaux",
  "6.1 — Etat des honoraires de gestion syndic",
  "6.2 — Tableau des honoraires",
  "6.3 — Evolution des honoraires",
  "7 — Récapitulatif de caisse de garantie",
] as const;
export type EtatComptable = (typeof ETAT_COMPTABLE)[number];

/**
 * « Charges Impayées » et « Protection Juridique » montrent que le module couvre aussi
 * les garanties financières, pas seulement les dommages.
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const TYPE_SINISTRE = [
  "Canalisations enterrées",
  "Dégât des eaux",
  "Incendie",
  "Tempête, Grêles, Neiges",
  "Vol",
  "Vandalisme",
  "Bris de glace",
  "Catastrophes naturelles",
  "Choc de véhicule",
  "Responsabilités civiles",
  "Recherche de fuite",
  "Défense - Recours",
  "Déménagement",
  "Protection Juridique",
  "Dommages Ouvrage",
  "Charges Impayées",
  "Loyers Impayés",
  "Effondrement",
  "Perte de Loyer",
] as const;
export type TypeSinistre = (typeof TYPE_SINISTRE)[number];

/**
 * Axe distinct du statut : le statut dit si le dossier est ouvert, la phase dit où en est
 * le traitement — déclaration → expertise → relances → indemnités.
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const PHASE_SINISTRE = [
  "Général",
  "Accusé réception",
  "Déclaration",
  "Mission d'expertise",
  "Relances",
  "Complément de document",
  "Indemnités",
  "Dommages Ouvrages",
] as const;
export type PhaseSinistre = (typeof PHASE_SINISTRE)[number];

/**
 * @portee copropriete
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const STATUT_SINISTRE = [
  "En cours",
  "Terminé",
] as const;
export type StatutSinistre = (typeof STATUT_SINISTRE)[number];

/**
 * « Contestation d'assemblée » est le recours de l'article 42 : c'est le contentieux dont
 * VitFix doit calculer le délai à partir de la notification du procès-verbal.
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const TYPE_CONTENTIEUX = [
  "Recouvrement de charges/loyer",
  "Garantie décennale",
  "Litige entreprise",
  "Litige Personne",
  "Litige sur un bail",
  "Litige autre syndicat",
  "Contestation d'assemblée",
] as const;
export type TypeContentieux = (typeof TYPE_CONTENTIEUX)[number];

/**
 * Le cycle complet du recouvrement, de l'ouverture à l'exécution du jugement.
 * VitFix n'a aujourd'hui qu'un statut binaire sur ses impayés.
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const PHASE_CONTENTIEUX = [
  "Ouverture",
  "Mise en demeure",
  "Règlement amiable",
  "Transmis à l'huissier",
  "Transmis à l'avocat",
  "Déclaration Assurance",
  "Procédure Judiciaire",
  "Exécution en cours",
  "Clos",
] as const;
export type PhaseContentieux = (typeof PHASE_CONTENTIEUX)[number];

/**
 * Distingue le débiteur qui a signé un plan d'apurement de celui qui n'en a pas.
 * @portee copropriete
 * @statut OBSERVE
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const PARTICULARITE_CONTENTIEUX = [
  "Contentieux avec échéancier",
  "Contentieux sans échéancier",
] as const;
export type ParticulariteContentieux = (typeof PARTICULARITE_CONTENTIEUX)[number];

/**
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const STATUT_COURRIER = [
  "Préparation",
  "A Suivre",
  "Terminé",
  "Non terminé",
  "Terminé/Archivé",
  "Archivé",
] as const;
export type StatutCourrier = (typeof STATUT_COURRIER)[number];

/**
 * La forme d'envoi est portée par le MODÈLE, pas par le courrier. « AR » est la lettre
 * recommandée avec accusé de réception — celle qui fait courir un délai.
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const FORME_ENVOI_COURRIER = [
  "Normal",
  "AR",
  "Email",
  "Email direct",
  "Fichier",
  "SMS",
  "Economique",
] as const;
export type FormeEnvoiCourrier = (typeof FORME_ENVOI_COURRIER)[number];

/**
 * Les 13 familles de modèles de courrier. Elles recoupent presque exactement le
 * référentiel DOSSIER : c'est le même axe de classement, vu depuis la sortie papier.
 * @portee copropriete + gerance
 * @statut OBSERVE (familles complètes) — les modèles eux-mêmes sont échantillonnés
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const FAMILLE_MODELE_COURRIER = [
  "Modèle de base",
  "Gestion",
  "Contrat",
  "Travaux",
  "Sinistre",
  "Contentieux",
  "Mutation",
  "Assemblée",
  "Bail",
  "Comptabilité syndic",
  "Comptabilité gerance",
  "Location Transaction",
  "Comptabilité",
] as const;
export type FamilleModeleCourrier = (typeof FAMILLE_MODELE_COURRIER)[number];

/**
 * Le rôle relationnel de l'identité vis-à-vis du cabinet — à ne pas confondre avec sa
 * qualité, qui est son lien de droit avec un lot (voir QUALITE_IDENTITE).
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const GROUPE_IDENTITE = [
  "Interlocuteur",
  "Candidat acquéreur",
  "Candidat locataire",
  "Copie CS",
  "Voisin",
  "Prospects",
] as const;
export type GroupeIdentite = (typeof GROUPE_IDENTITE)[number];

/**
 * LA RÉPONSE À LA DÉCISION D2. Le champ « Compte client » de Gestéam : le lien de droit
 * entre une identité et un lot, groupé en cinq blocs.
 * Le démembrement (nu propriétaire / usufruitier) et l'indivision (indivisaire / associé)
 * sont des qualités distinctes, pas des cas particuliers du copropriétaire.
 * Pour VitFix, seuls les blocs copropriete, location et personnel sont dans le périmètre.
 * @portee copropriete + gerance
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const QUALITE_IDENTITE = {
  "copropriete": [
    "Copropriétaire",
    "Indivisaire",
    "Associé(e)",
    "Nu propriétaire",
    "Usufruitier",
  ],
  "location": [
    "Locataire",
    "Colocataire",
    "Garant",
  ],
  "proprietaireGerance": [
    "Propriétaire",
    "Indivisaire",
    "Associé(e)",
    "Nu propriétaire",
    "Usufruitier",
  ],
  "personnel": [
    "Gardien",
    "Employé d'immeuble",
  ],
  "autre": [
    "Autre",
  ],
} as const satisfies Record<string, readonly string[]>;
export type BlocQualiteIdentite = keyof typeof QUALITE_IDENTITE;

/**
 * Le référentiel ne contient pas que des fournisseurs : tribunal, expert judiciaire,
 * mandataire judiciaire, huissier, cabinet d'avocat, étude notariale et tuteur y figurent.
 * @portee copropriete + gerance
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const TYPE_ENTREPRISE = [
  "Fournisseur",
  "Administrateur de biens",
  "Agence Immobilière",
  "Architecte",
  "Cabinet d'avocat",
  "Centre des Impots",
  "Commissariat de police",
  "Compagnie d'assurance",
  "Courtier",
  "Mandataire judiciaire",
  "Etablissement bancaire",
  "Etude Notariale",
  "Expert comptable",
  "Expert d'assurance",
  "Expert Judiciaire",
  "Géomètre",
  "Huissier de justice",
  "Mairie",
  "Préfecture",
  "Propriétaire de Salle",
  "Syndicat",
  "Organisme prêteur DG",
  "Tresorerie principale",
  "Caisse allocations familiales",
  "Salarié",
  "Organisme social",
  "Client mandant",
  "Centre de traitement TIP",
  "Tribunal",
  "Tuteur",
] as const;
export type TypeEntreprise = (typeof TYPE_ENTREPRISE)[number];

/**
 * Les quatre services du cabinet. Seul « Copropriété » est dans le périmètre VitFix.
 * @portee copropriete + gerance
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const SERVICE_CABINET = [
  "Copropriété",
  "Gérance",
  "Direction",
  "Transaction",
] as const;
export type ServiceCabinet = (typeof SERVICE_CABINET)[number];

/**
 * @portee copropriete
 * @statut OBSERVE — liste complète
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const MODE_REGLEMENT = [
  "Chèque",
  "Virement",
  "Prélèvement",
  "TIP",
  "Espèces",
  "Pas de règlement",
] as const;
export type ModeReglement = (typeof MODE_REGLEMENT)[number];

/**
 * Les quatre dernières familles (électroménager, linge, literie, ustensiles) relèvent de
 * la location meublée et sont hors périmètre VitFix.
 * L'équipement porte une date de « prochain constat » : c'est le moteur du carnet
 * d'entretien et des contrôles périodiques réglementaires.
 * @portee copropriete + gerance
 * @statut OBSERVE — racines complètes
 * @source Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements
 */
export const FAMILLE_EQUIPEMENT = [
  "Accès",
  "Bâtiment",
  "Chauffage",
  "Circuits d'eau",
  "Communication",
  "Electricité",
  "Equipement de loisir",
  "Espaces verts",
  "Extérieur",
  "Mobilier, accessoire, équipement",
  "Nettoyage, hygiène",
  "Sécurité",
  "Electroménager",
  "Linge de maison",
  "Literie",
  "Ustensiles de cuisine",
] as const;
export type FamilleEquipement = (typeof FAMILLE_EQUIPEMENT)[number];

/**
 * Traçabilité : pour chaque référentiel, sa source Gestéam, la date de relevé,
 * le statut d'observation et le nombre de valeurs. À citer en cas de doute sur une valeur.
 */
export const REFERENTIELS_TRACABILITE = [
  {
    nom: "TYPE_SRU",
    source: "Gestéam 5.4.22 — Syndic > Réglages > 1-Plan comptable, critère Type SRU",
    dateReleve: "2026-10-08",
    statut: "OBSERVE — liste complète",
    nbValeurs: 14,
  },
  {
    nom: "CATEGORIE_PLAN_COMPTABLE",
    source: "Gestéam 5.4.22 — Plan comptable, critère Catégorie",
    dateReleve: "2026-10-08",
    statut: "OBSERVE — liste complète",
    nbValeurs: 18,
  },
  {
    nom: "DOSSIER",
    source: "Gestéam 5.4.22 — critère Dossier (référentiel transversal)",
    dateReleve: "2026-10-08",
    statut: "OBSERVE — les 15 valeurs annoncées en M5, vérifiées",
    nbValeurs: 15,
  },
  {
    nom: "TYPE_JOURNAL",
    source: "Gestéam 5.4.22 — onglet Syndic > Réglages > 2-Journaux",
    dateReleve: "2026-10-07",
    statut: "OBSERVE",
    nbValeurs: 5,
  },
  {
    nom: "SOURCE_COMPTABLE",
    source: "Gestéam 5.4.22 — critère Source des écrans de paramétrage comptable",
    dateReleve: "2026-10-07",
    statut: "OBSERVE",
    nbValeurs: 5,
  },
  {
    nom: "REGLE_NUMERO_COMPTE",
    source: "Gestéam — champ « N° Compte » de l'entrée de plan comptable (tranche 12, reconfirmé tranche 13)",
    dateReleve: "2026-10-07",
    statut: "OBSERVE — liste complète",
    nbValeurs: 9,
  },
  {
    nom: "FAMILLE_TRAITEMENT",
    source: "Gestéam 5.4.22 — Syndic > Traitements, critère Famille",
    dateReleve: "2026-10-08",
    statut: "OBSERVE — liste complète",
    nbValeurs: 52,
  },
  {
    nom: "STATUT_DEMANDE",
    source: "Gestéam 5.4.22 — module Demandes",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 6,
  },
  {
    nom: "STADE_INTERVENTION",
    source: "Gestéam 5.4.22 — module Demandes",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 8,
  },
  {
    nom: "STATUT_ETAPE",
    source: "Gestéam 5.4.22 — module Etapes",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 4,
  },
  {
    nom: "PROCESSUS",
    source: "Gestéam 5.4.22 — module Etapes",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 24,
  },
  {
    nom: "DOMAINE",
    source: "Gestéam 5.4.22 — référentiel Domaine (arbre déployé)",
    dateReleve: "2026-10-08",
    statut: "OBSERVE — 13 racines complètes, feuilles relevées par échantillonnage du déploiement",
    nbValeurs: 115,
  },
  {
    nom: "TYPE_GESTION_MANDAT",
    source: "Gestéam 5.4.22 — modules Mandats, Mouvements, Documents",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 4,
  },
  {
    nom: "STATUT_MANDAT",
    source: "Gestéam 5.4.22 — modules Mandats, Mouvements, Documents",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 5,
  },
  {
    nom: "PARTICULARITE_MANDAT",
    source: "Gestéam 5.4.22 — modules Mandats, Mouvements, Documents",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 14,
  },
  {
    nom: "STATUT_MOUVEMENT",
    source: "Gestéam 5.4.22 — modules Mandats, Mouvements, Documents",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 5,
  },
  {
    nom: "TYPE_APPEL_LIE_AU_MOUVEMENT",
    source: "Gestéam 5.4.22 — modules Mandats, Mouvements, Documents",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 9,
  },
  {
    nom: "POSITION_DES_MANDANTS",
    source: "Gestéam 5.4.22 — modules Mandats, Mouvements, Documents",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 11,
  },
  {
    nom: "TYPE_DOCUMENT_JUDICIAIRE",
    source: "Gestéam 5.4.22 — modules Mandats, Mouvements, Documents",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 20,
  },
  {
    nom: "TYPE_LOT",
    source: "Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 67,
  },
  {
    nom: "TYPE_CONTRAT",
    source: "Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 10,
  },
  {
    nom: "STATUT_CONTRAT",
    source: "Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 3,
  },
  {
    nom: "STATUT_TRAVAUX",
    source: "Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 9,
  },
  {
    nom: "TYPE_TRAVAUX",
    source: "Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 42,
  },
  {
    nom: "NATURE_ASSEMBLEE",
    source: "Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 3,
  },
  {
    nom: "STATUT_ASSEMBLEE",
    source: "Gestéam 5.4.22 — modules Lots, Contrats, Travaux, Assemblées",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 4,
  },
  {
    nom: "ETAT_COMPTABLE",
    source: "Gestéam 5.4.22 — onglet Syndic > Analyses > Etats comptables",
    dateReleve: "2026-10-07",
    statut: "OBSERVE (libellés du menu) — aucune édition déclenchée",
    nbValeurs: 9,
  },
  {
    nom: "TYPE_SINISTRE",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 19,
  },
  {
    nom: "PHASE_SINISTRE",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 8,
  },
  {
    nom: "STATUT_SINISTRE",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 2,
  },
  {
    nom: "TYPE_CONTENTIEUX",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 7,
  },
  {
    nom: "PHASE_CONTENTIEUX",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 9,
  },
  {
    nom: "PARTICULARITE_CONTENTIEUX",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 2,
  },
  {
    nom: "STATUT_COURRIER",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 6,
  },
  {
    nom: "FORME_ENVOI_COURRIER",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 7,
  },
  {
    nom: "FAMILLE_MODELE_COURRIER",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 13,
  },
  {
    nom: "GROUPE_IDENTITE",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 6,
  },
  {
    nom: "QUALITE_IDENTITE",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 16,
  },
  {
    nom: "TYPE_ENTREPRISE",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 30,
  },
  {
    nom: "SERVICE_CABINET",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 4,
  },
  {
    nom: "MODE_REGLEMENT",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 6,
  },
  {
    nom: "FAMILLE_EQUIPEMENT",
    source: "Gestéam 5.4.22 — modules Sinistres, Contentieux, Courriers, Immeubles, Identités, Entreprises, Equipements",
    dateReleve: "2026-10-08",
    statut: "OBSERVE",
    nbValeurs: 16,
  },
] as const;

/**
 * Ce que ces référentiels ne couvrent PAS, et pourquoi.
 * Chaque point exige soit une édition, soit un traitement, soit l'ouverture d'une fiche réelle —
 * tous interdits par la consigne de lecture seule sans accord explicite.
 */
export const REFERENTIELS_MANQUANTS = [
  { objet: "Contenu et colonnes des 9 états comptables", bloqueur: "exige de lancer une édition" },
  { objet: "Déroulé du traitement « Répartition de charges »", bloqueur: "exige de lancer un traitement" },
  { objet: "Référentiels Type de plan, Rubrique, Code fiscal", bloqueur: "les loupes n'ouvrent rien sans fiche chargée" },
  { objet: "Libellés des 710 plans et 435 analytiques", bloqueur: "listes parcourues en entier le 08/10/2026 (tranche 21) ; structure, plages et familles relevées ; libellés NON reproduits car beaucoup sont propres à des dossiers réels (noms, adresses, comptes)" },
  { objet: "Classification de chaque entrée de plan (Type, Nature, Catégorie, Type SRU, règle de n° de compte)", bloqueur: "exige de sélectionner une ligne — la fiche porte un bouton Enregistrer" },
  { objet: "Sens des libellés terminés par « _ » et des libellés entre parenthèses dans le plan", bloqueur: "non déductible de la liste ; contradiction avec le filtre « En service » à lever" },
  { objet: "Types propres de 30 des 42 catégories de types de document", bloqueur: "non relevés (non nécessaires au judiciaire) — structure à deux niveaux, catégorie Base (147 types) et catégories judiciaires (Tribunal, Huissier, Avocat, Expert judiciaire, Préfecture, Interne) relevées en entier le 08/10/2026, tranche 22 §6" },
  { objet: "Champs « trésorerie mini » (fonds travaux) et « conservation du RUM » (SEPA), annoncés en 5.4.20", bloqueur: "exige d'ouvrir une fiche réelle" },
  { objet: "Texte et champs de fusion des modèles de courrier", bloqueur: "exige d'ouvrir un modèle en édition — la LISTE (≈ 225 modèles, 13 familles) a été parcourue en entier le 08/10/2026, tranche 22, avec l'inventaire des actes de mission 29-1 / art. 47" },
  { objet: "Onglets Juridique et Techn. de la fiche immeuble", bloqueur: "supposent une fiche chargée" },
] as const;
