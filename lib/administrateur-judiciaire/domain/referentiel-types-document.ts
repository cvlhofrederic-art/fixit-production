/**
 * Référentiel des types de document de la GED, à deux niveaux : catégorie (rôle du tiers émetteur ou destinataire) puis
 * type (point 64 du bilan 2). Données seules ; les fonctions sont dans typologie-documents.ts. Aucune donnée personnelle :
 * des libellés de types, jamais de documents.
 *
 * Module à part, volontairement hors de lib/data/referentiels-gesteam-judiciaire.ts (fichier du point 29) : à signaler
 * dans la PR. TYPE_DOCUMENT_JUDICIAIRE (20 libellés de la tranche 18) y reste inchangé ; typologie-documents.ts le
 * rapproche de ce référentiel.
 *
 * Gestéam :
 * 🟢 Tranche 22 § 6 (Gestion → Documents → Recherche de documents → critère Type) : menu à deux niveaux, 42 catégories ;
 *   chaque catégorie = 7 types génériques communs + ses types propres. Types propres relevés : Base (147 ± 1, § 6.3),
 *   Interne (14 lignes), Tribunal (13), Huissier de justice (5), Cabinet d'avocat (9), Expert judiciaire (1),
 *   Préfecture (2) ; Mandataire judiciaire et Tuteur : génériques seulement.
 * 🟢 Tranche 43 § 19 : Copropriétaire (29 annoncés, 28 libellés listés), Membre du conseil syndical (2), Étude notariale
 *   (8), Compagnie d'assurance (5), Expert d'assurance (3), Mairie (2), Gardien / employé d'immeuble (9) ; Syndicat et
 *   Établissement bancaire : génériques seulement. « Le classement des pièces suit le rôle du tiers ».
 * 🟢 Tranche 40 : référentiel « Association » d'un évènement, 8 groupes NUMÉROTÉS, sans nom.
 * 🔵 Déduit : libellés dépliés quand la cartographie les abrège (« Diagnostic amiante partie commune / partie
 *   privative » → deux types ; les 4 états des lieux ; les 5 bulletins de vote ; les 3 DPE ; les 4 relevés de dépenses ;
 *   les 5 mandats SEPA) ; intitulés des groupes Association (Gestéam ne les nomme pas).
 * 🔴 Non établi (questions pour Hugo, relevé en lecture seule) :
 *   - « ICPE (déclaration, autorisation, enregistrement) » : un type ou trois ? (Base compte 146 types s'il n'y en a
 *     qu'un, 148 sinon : c'est le « ± 1 » du décompte de 147) ; « Notes internes (modification comptable, créance
 *     irrécouvrable, jugement, remboursement copropriétaire) » : un type ou un par variante ? Codés ici comme UN type.
 *   - Copropriétaire : 29 types annoncés, 28 listés. Lequel manque ? (catégorie « partielle » : un type hors relevé y
 *     est accepté et marqué).
 *   - « Mandat de prélèvement SEPA (… mandat UNIQUE) » : libellé exact du cinquième mandat ?
 *   - « Bordereaux de remise de pièces [cabinet] » et « Rapport de visite [cabinet] » : la cartographie remplace le nom
 *     du cabinet par « [cabinet] » ; libellé repris tel quel.
 *   - Types propres des 24 catégories non relevées (Propriétaire, Locataire, Fournisseur, Géomètre…) : ni complétés de
 *     mémoire ni inventés ; un type libre y est accepté et marqué « catégorie non relevée ».
 */

/** Les 42 catégories, dans l'ordre du menu Gestéam (tranche 22 § 6.1). */
export const CATEGORIES_DOCUMENT = [
  'Base',
  'Interne',
  'Copropriétaire',
  'Membre du conseil syndical',
  'Propriétaire',
  'Locataire',
  "Gardien/Employé d'immeuble",
  'Voisin',
  'Occupant',
  'Candidat locataire',
  'Occupant non géré',
  'Contact',
  'Fournisseur',
  'Administrateur de biens',
  'Agence immobilière',
  'Architecte',
  "Cabinet d'avocat",
  'Centre des impôts',
  'Commissariat de police',
  "Compagnie d'assurance",
  'Courtier',
  'Mandataire judiciaire',
  'Établissement bancaire',
  'Étude notariale',
  'Expert comptable',
  "Expert d'assurance",
  'Expert judiciaire',
  'Géomètre',
  'Huissier de justice',
  'Mairie',
  'Préfecture',
  'Propriétaire de salle',
  'Syndicat',
  'Organisme prêteur DG',
  'Trésorerie principale',
  "Caisse d'allocations familiales",
  'Salarié',
  'Organisme social',
  'Client mandant',
  'Centre de traitement TIP',
  'Tribunal',
  'Tuteur',
] as const
export type CategorieDocument = (typeof CATEGORIES_DOCUMENT)[number]

/** Les 7 types génériques, présents dans chaque catégorie (tranche 22 § 6.2). */
export const TYPES_GENERIQUES_DOCUMENT = [
  'Analyse de facture/avoir',
  'Avis de virement',
  'Contrat, avenant entreprise',
  "Demande d'intervention diffusée défaut",
  'Demande de devis diffusée défaut',
  'Devis fournisseur',
  'Facture/avoir fournisseur',
] as const

/**
 * État du relevé d'une catégorie : `complet` (types propres relevés en entier), `partiel` (moins de libellés que
 * l'effectif annoncé), `generiques_seuls` (aucun type propre, relevé), `non_releve` (types propres jamais ouverts).
 */
export type ReleveCategorie = 'complet' | 'partiel' | 'generiques_seuls' | 'non_releve'

export interface FicheCategorieDocument {
  releve: ReleveCategorie
  /** Types propres relevés, sans les génériques. Vide pour `generiques_seuls` et `non_releve`. */
  typesPropres: readonly string[]
  /** Effectif annoncé par Gestéam quand il diffère du nombre de libellés (Base : 147 ± 1 ; Copropriétaire : 29). */
  typesAnnonces?: number
  /** Tranche de la cartographie ; null pour une catégorie non relevée. */
  source: string | null
}

/** 🟢 Tranche 22 § 6.3 : 147 types ± 1 (décompte par la position du curseur). Libellés dépliés : 🔵. */
const TYPES_BASE = [
  'Accord de réception courrier AR en avis électroniques',
  'Accord sur devis',
  'Accord/Refus de location',
  "Analyse d'activité",
  'Ascenseur contrôle technique quinquennal',
  'Assignation au nom du syndicat',
  'Assistance, copie écran, PJ',
  'Attestation assurance civile professionnelle',
  'Attestation assurance PNO',
  "Attestation d'assurance locataire",
  "Attestation d'assurance responsabilité civile",
  'Attestation de déclaration sociale',
  'Attestation de garantie financière',
  'Attestation de mise à jour au registre des copropriétés',
  'Attestation de ramonage locataire',
  'Attestation garantie financière',
  'Audit de performances énergétiques des parties communes',
  'Autorisation de prélèvement',
  'Autres risques sanitaires',
  'Balance comparée',
  'Bordereau DGFIP',
  'Bordereau hypothèque publié',
  'Bordereau mutuelle',
  'Bordereau prévoyance',
  'Bordereau retraite',
  'Bordereau URSSAF',
  'Bordereaux de remise de pièces [cabinet]',
  'Bordereaux de remise de pièces ancien syndic',
  'Bulletin de salaire',
  "Bulletin de vote d'assemblée",
  "Bulletin de vote d'assemblée à signer",
  "Bulletin de vote d'assemblée formulaire papier retourné",
  "Bulletin de vote d'assemblée formulaire PDF retourné",
  "Bulletin de vote d'assemblée signé",
  'Cadastre — relevé de propriété',
  "Carnet d'entretien",
  'Carte professionnelle',
  'Certificat de travail',
  'Chèque',
  'Comptabilité',
  "Compte rendu d'intervention",
  'Compte rendu de visite',
  'Congé locataire',
  'Constat',
  'Contrat courrier de résiliation',
  'Contrat de syndic',
  "Convocation d'assemblée",
  'Courrier de sécurité',
  'Courrier demande de versement du solde des subventions',
  'Courrier demande aide à la gestion',
  "Déclaration d'insalubrité",
  'Déclaration de taxe',
  "Demande d'acompte",
  "Demande d'information sur éventuelle renonciation à succession",
  'Devis pré-état daté',
  'Diagnostic amiante partie commune',
  'Diagnostic amiante partie privative',
  'Diagnostic de conformité assainissement',
  'Diagnostic de performance énergétique partie privative',
  'Diagnostic de performance énergétique parties communes',
  'Diagnostic de performance énergétique privatif',
  'Diagnostic plomb (CREP)',
  "Diagnostic plomb dans l'eau",
  'Diagnostic surface habitable',
  'Diagnostic technique global',
  'Diagnostic termites',
  'Divers',
  'Document signé électroniquement',
  'Données transmises au registre des copropriétés',
  'Échéancier de prêt collectif',
  'Email direct envoyé',
  'Email envoyé depuis Outlook',
  'Entretien chaudière locataire',
  "État des lieux d'entrée",
  "État des lieux d'entrée (signé)",
  'État des lieux de sortie',
  'État des lieux de sortie (signé)',
  'État des soldes des copropriétaires',
  'État modélisé',
  'Étude énergétique',
  'Facturation diffuseur',
  'Facture/avoir honoraires',
  'Feuille de présence',
  'Fiche synthétique',
  'Fiche synthétique de la copropriété',
  'Fichier des écritures comptables',
  'Formulaire PDF',
  "Fourniture de produit d'entretien",
  // 🔴 un type ou trois (déclaration, autorisation, enregistrement) : question pour Hugo.
  'ICPE (déclaration, autorisation, enregistrement)',
  'Image 2D repérée',
  'Image 360 repérée',
  'Index de consommations',
  'Indexation locataires',
  "Informations complémentaires sur la qualité de l'eau",
  'Injonction de payer — scan des pièces',
  'IRC — attestation de MAJ annuelle',
  'IRC — demande de MAJ annuelle',
  'Journal',
  "Justificatif d'identité",
  'Justificatif de domicile',
  'Justificatif de revenus',
  'Kbis',
  "Modèle d'état",
  "Notification d'octroi de subvention",
  'Ordonnance (autres)',
  'Photographie',
  'Pièce-jointe',
  "Pièce-jointe de convocation d'assemblée",
  'Plan',
  'Plan pluriannuel de travaux (PPT)',
  'Pointage bancaire',
  'Pointe de garantie',
  "Police d'assurance",
  'Pouvoir',
  'Prétirage appels de fonds',
  'Prétirage comptes de gérance',
  "Prétirage d'avis de loyer",
  'Prétirage récapitulatif mandant',
  "Procès-verbal d'assemblée",
  "Procès-verbal d'assemblée signé",
  'Projet de plan pluriannuel de travaux (PPPT)',
  "Proposition d'échéancier",
  'R.C. décennale entreprise',
  "Rapport d'échec d'émission de fax",
  "Rapport d'échec d'émission de SMS",
  'Rapport de visite [cabinet]',
  'Rapprochement bancaire',
  'Récapitulatif indivisaire',
  'Récapitulatif mandant',
  'Régul. de charges locatives',
  'Relance simple',
  'Relevé bancaire',
  'Relevé de compte',
  'Relevé de dépenses édition',
  'Relevé de dépenses individuelles',
  'Relevé de dépenses par lot',
  'Relevé de dépenses réparties',
  'Requête en injonction de payer',
  'Réquisition hypothécaire',
  'Responsabilité civile entreprise',
  'RIB',
  'RIB client',
  'RIB syndicat des copropriétaires',
  'Succession',
  'Tableau des honoraires',
  'Verso chèque encaissé',
] as const

/** 🟢 Tranche 22 § 6.2 : 14 lignes ; « Notes internes (…) » gardé comme un seul type (🔴, voir l'en-tête). */
const TYPES_INTERNE = [
  'Accord sur contrat',
  'Cabinet',
  'Convocation expertise',
  'Courrier administratif',
  'Courrier contentieux',
  'Formulaire publication (BODACC / annonce)',
  'Grand livre',
  'Notes internes (modification comptable, créance irrécouvrable, jugement, remboursement copropriétaire)',
  'Police charges impayées',
  'Police dommages-ouvrage',
  'Rapport (interne)',
  'Rejet de virement',
  'Relance mise en demeure',
  'Administratif — assurance fournisseur',
] as const

/** 🟢 Tranche 22 § 6.2 : le cycle judiciaire (requête → désignation → notification → prolongation → taxe → fin → rapport). */
const TYPES_TRIBUNAL = [
  'Aide juridictionnelle (demande/décision)',
  'Commission de surendettement — correspondance',
  'Correspondance avec tribunal',
  'Jugement',
  'Notification ordonnance',
  "Ordonnance d'expropriation",
  'Ordonnance de désignation',
  'Ordonnance de fin de mission',
  'Ordonnance de prolongation de mission',
  'Ordonnance de taxe',
  'Rapport de mission',
  'Requête au tribunal',
  'Rétablissement personnel — correspondances',
] as const

/** 🟢 Tranche 43 § 19 : 28 libellés pour 29 annoncés ; les 5 mandats SEPA sont dépliés (🔵). */
const TYPES_COPROPRIETAIRE = [
  'Accusé réception de sinistre',
  'Acte de décès',
  'Appel de fonds',
  'Chèque encaissé',
  'Correspondances de clients',
  'Courrier contentieux',
  'Courrier copropriétaire',
  'Déclaration de sinistre',
  'État civil (autres que décès)',
  'État daté',
  'État daté mutation',
  'Extrait de compte',
  'Fiche de renseignement copropriétaire',
  'Lettre de désistement',
  'LRAR reçu',
  'Mandat de prélèvement SEPA à signer',
  'Mandat de prélèvement SEPA non signé',
  'Mandat de prélèvement SEPA non signé P',
  'Mandat de prélèvement SEPA signé',
  'Mandat de prélèvement SEPA mandat UNIQUE',
  'Mise en demeure',
  'Notification de vente',
  "Protocole d'accord de recouvrement",
  "Protocole d'apurement signé",
  'Relevé individuel eau froide',
  'Répartition de charges',
  'Requête injonction de payer',
  'Réquisitions',
] as const

const releve = (typesPropres: readonly string[], source: string): FicheCategorieDocument => ({ releve: 'complet', typesPropres, source })
const generiquesSeuls = (source: string): FicheCategorieDocument => ({ releve: 'generiques_seuls', typesPropres: [], source })
const NON_RELEVE: FicheCategorieDocument = { releve: 'non_releve', typesPropres: [], source: null }

const T22 = 'Gestéam tranche 22 § 6'
const T43 = 'Gestéam tranche 43 § 19'

/** Types propres de chaque catégorie, tels que relevés ; rien n'est complété de mémoire. */
export const TYPES_DOCUMENT_PAR_CATEGORIE: Readonly<Record<CategorieDocument, FicheCategorieDocument>> = {
  Base: { releve: 'complet', typesPropres: TYPES_BASE, typesAnnonces: 147, source: 'Gestéam tranche 22 § 6.3' },
  Interne: releve(TYPES_INTERNE, T22),
  Copropriétaire: { releve: 'partiel', typesPropres: TYPES_COPROPRIETAIRE, typesAnnonces: 29, source: T43 },
  'Membre du conseil syndical': releve(['Accord sur contrat', 'Générale - Courrier conseil syndical'], T43),
  Propriétaire: NON_RELEVE,
  Locataire: NON_RELEVE,
  "Gardien/Employé d'immeuble": releve(
    [
      'Arrêt maladie',
      'Attestation de suivi médecine du travail',
      'Attestation employeur Pôle emploi',
      'Déclaration DSN',
      'Demande de congés',
      "Document unique d'évaluation des risques (DUERP)",
      'Fiche de poste',
      "Relevé d'heures",
      'Salaire et charges sociales',
    ],
    T43,
  ),
  Voisin: NON_RELEVE,
  Occupant: NON_RELEVE,
  'Candidat locataire': NON_RELEVE,
  'Occupant non géré': NON_RELEVE,
  Contact: NON_RELEVE,
  Fournisseur: NON_RELEVE,
  'Administrateur de biens': NON_RELEVE,
  'Agence immobilière': NON_RELEVE,
  Architecte: NON_RELEVE,
  "Cabinet d'avocat": releve(
    [
      'Assignation',
      'Avis de mutation art. 20',
      'Commandement de saisie',
      'Conclusions / avocats',
      'Courrier contentieux',
      "Décision d'aide juridictionnelle",
      'Jugement',
      'Notification de vente article 6',
      'Projet de RCP',
    ],
    T22,
  ),
  'Centre des impôts': NON_RELEVE,
  'Commissariat de police': NON_RELEVE,
  "Compagnie d'assurance": releve(
    ['BCT', "Compte rendu d'expertise", 'Courrier demande sinistralité immeuble', 'Déclaration de sinistre', 'Relevé sinistralité'],
    T43,
  ),
  Courtier: NON_RELEVE,
  'Mandataire judiciaire': generiquesSeuls(T22),
  'Établissement bancaire': generiquesSeuls(T43),
  'Étude notariale': releve(
    [
      'Acte indemnité expropriation',
      'Attestation de vente',
      'Avis de mutation art. 20',
      'Certificat article 20-2',
      'Demande pré-état daté / état daté',
      'Notification de vente',
      'Procuration main-levée hypothèque',
      'Règlement de copropriété (règlement, modificatifs)',
    ],
    T43,
  ),
  'Expert comptable': NON_RELEVE,
  "Expert d'assurance": releve(["Compte rendu d'expertise", 'Convocation expertise', 'État des pertes'], T43),
  'Expert judiciaire': releve(["Compte rendu d'expertise"], T22),
  Géomètre: NON_RELEVE,
  'Huissier de justice': releve(
    [
      'Assignation',
      'Commandement de payer (huissier)',
      'Courrier contentieux',
      "Opposition article 20 (acte d'huissier)",
      'Signification de jugement',
    ],
    T22,
  ),
  Mairie: releve(['Arrêté de péril', 'Injonction de travaux'], T43),
  Préfecture: releve(['Courrier', 'Décision de déconsignation'], T22),
  'Propriétaire de salle': NON_RELEVE,
  Syndicat: generiquesSeuls(T43),
  'Organisme prêteur DG': NON_RELEVE,
  'Trésorerie principale': NON_RELEVE,
  "Caisse d'allocations familiales": NON_RELEVE,
  Salarié: NON_RELEVE,
  'Organisme social': NON_RELEVE,
  'Client mandant': NON_RELEVE,
  'Centre de traitement TIP': NON_RELEVE,
  Tribunal: releve(TYPES_TRIBUNAL, T22),
  Tuteur: generiquesSeuls(T22),
}

export interface GroupeAssociation {
  numero: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  /** 🔵 Intitulé VitFix : Gestéam ne nomme pas les groupes. */
  intitule: string
  /** 🟢 Éléments relevés (tranche 40). */
  elements: readonly string[]
}

/** 🟢 Tranche 40 : référentiel « Association » d'un évènement (document ou information associés), 8 groupes numérotés. */
export const GROUPES_ASSOCIATION: readonly GroupeAssociation[] = [
  {
    numero: 1,
    intitule: "Informations et diagnostics de l'immeuble",
    elements: [
      'Information Procédure',
      'Décision Assemblée',
      'Règlement de copropriété',
      'Amiante partie commune',
      'Amiante partie privative',
      'Termites',
      'Plomb',
      "Plomb dans l'eau",
      'Diagnostic de performance énergétique',
      'Autres risques sanitaires',
      'DUER',
      'Certificat de surface habitable',
      'Ascenseur contrôle technique quinquennal',
    ],
  },
  {
    numero: 2,
    intitule: 'Vie du syndicat',
    elements: ['Informations facultatives AG', "Carnet d'entretien", 'État daté', "Procès-verbal d'assemblée", "Convocation d'assemblée"],
  },
  { numero: 3, intitule: 'Locataire', elements: ['Assurance locataire', 'Entretien chaudière locataire', 'État des lieux'] },
  { numero: 4, intitule: 'Entreprise', elements: ['R.C. décennale entreprise', 'Responsabilité civile entreprise', 'Contrat entreprise'] },
  { numero: 5, intitule: 'Photographie', elements: ['Photographie'] },
  { numero: 6, intitule: 'Formats de reporting', elements: ['Fond de page', 'Format de reporting compilé', 'Format de reporting source'] },
  { numero: 7, intitule: 'Rapport de fax', elements: ['Rapport émission de fax'] },
  { numero: 8, intitule: 'Devis, facture, pièce comptable', elements: ['Devis', 'Facture', 'Pièce comptable'] },
]
