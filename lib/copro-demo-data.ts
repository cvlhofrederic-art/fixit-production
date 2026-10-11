// ─── Copro Demo Data ──────────────────────────────────────────────────────────
// Centralized demo data for the coproprietaire dashboard.
// Imported by page.tsx and extracted section components.
//
// Également lu côté serveur par l'assistant Fixy (lib/copro-ia-contexte.ts,
// app/api/copro-ai) : ce module ne doit dépendre ni du navigateur ni de React.
//
// Dates fixes, cohérentes autour de la démo du lundi 12 octobre 2026 :
// historique jusqu'à début octobre, échéances d'octobre à décembre 2026,
// prochaine AG le 19 novembre 2026. Pas de dates calculées à partir du jour :
// les écrans figent certaines années (« Total payé 2025 », année 2026 par
// défaut dans Mes Charges et Quittances) et le texte des annonces cite des dates.

export interface CoproProfile {
  id: string
  nom: string
  prenom: string
  email: string
  telephone: string
  immeuble: string
  batiment: string
  etage: string
  numLot: string
  tantiemes: number
  quotePart: number
}

export interface ChargesMensuelles {
  id: string
  mois: string
  montant: number
  statut: 'payee' | 'en_attente' | 'en_retard'
  datePaiement?: string
  dateEcheance: string
}

export interface Paiement {
  id: string
  type: 'charges_trimestrielles' | 'appel_fonds' | 'travaux' | 'regularisation'
  description: string
  montant: number
  dateEcheance: string
  datePaiement?: string
  statut: 'payee' | 'en_attente' | 'en_retard'
  trimestre?: string
  reference: string
}

export interface DocumentCopro {
  id: string
  nom: string
  type: 'pv_ag' | 'compte_annuel' | 'budget' | 'contrat' | 'reglement' | 'appel_charges' | 'autre'
  dateUpload: string
  taille: string
  annee: number
  public: boolean
  consulte: boolean
  dateConsultation?: string
}

export interface Annonce {
  id: string
  titre: string
  contenu: string
  date: string
  auteur: string
  importance: 'info' | 'important' | 'urgent'
  lu: boolean
}

export interface ResolutionVote {
  id: string
  titre: string
  description: string
  majorite: 'art24' | 'art25' | 'art26' | 'unanimite'
  monVote?: 'pour' | 'contre' | 'abstention'
  votePour: number
  voteContre: number
  voteAbstention: number
  statut: 'ouverte' | 'cloturee'
  resultat?: 'adoptée' | 'rejetée'
}

export interface AssembleeGenerale {
  id: string
  titre: string
  date: string
  lieu: string
  type: 'ordinaire' | 'extraordinaire'
  statut: 'planifiee' | 'convoquee' | 'en_cours' | 'cloturee'
  ordreDuJour: string[]
  resolutions: ResolutionVote[]
  lienVisio?: string
}

export interface Echeance {
  id: string
  type: 'paiement' | 'assemblee' | 'maintenance' | 'document'
  titre: string
  date: string
  description: string
  urgent: boolean
}

export interface CoproNotification {
  id: string
  type: 'rappel' | 'alerte' | 'document' | 'message' | 'vote'
  titre: string
  message: string
  date: string
  lu: boolean
}

export interface HistoriqueEntry {
  id: string
  type: 'paiement' | 'vote' | 'document' | 'signalement' | 'message'
  titre: string
  description: string
  date: string
  montant?: number
}

export interface ParamConfidentialite {
  notifEmail: boolean
  notifPush: boolean
  mailingAG: boolean
  alertesPaiement: boolean
  alertesTravaux: boolean
  resumeHebdo: boolean
}

export interface SuiviIntervention {
  id: string
  type: string
  description: string
  artisan: string
  artisanPhone: string
  statut: 'planifie' | 'en_route' | 'sur_place' | 'termine' | 'annule'
  dateRdv: string
  heureRdv: string
  progression: number
  note?: number
  commentaire?: string
  gpsLat?: number
  gpsLng?: number
  gpsEta?: number
  preuve?: { avantPhotos: number; apresPhotos: number; signee: boolean }
}

export interface PosteCharge {
  label: string
  emoji: string
  montantAnnuel: number
  budget: number
  couleur: string
}

export interface Quittance {
  id: string
  mois: string
  montant: number
  statut: 'emise' | 'tele_chargee'
  dateEmission: string
  reference: string
}

export interface Bail {
  id: string
  dateDebut: string
  dateFin: string | null
  duree: number
  loyerBase: number
  charges: number
  depot: number
  indexation: 'irl' | 'icc'
  derniereRevision: string
  prochaineRevision: string
  indiceRef: number
  indiceActuel: number
  bailleur: string
  bailleurAdresse: string
  bailleurPhone: string
  agence?: string
  logement: string
  surface: number
  numLot?: string
  preavis: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PROFILE_DEMO: CoproProfile = {
  id: 'copro-demo-1',
  nom: 'Xavier',
  prenom: 'Géraldine',
  email: 'geraldine.xavier@email.com',
  telephone: '06 12 34 56 78',
  immeuble: 'Résidence Le Prado',
  batiment: 'D',
  etage: '4',
  numLot: '12',
  tantiemes: 450,
  quotePart: 4.5,
}

// Syndic de l'immeuble (auteur des annonces, interlocuteur de Fixy).
export const SYNDIC_DEMO = 'Cabinet Dupont'

// Suivi mensuel : décomposition des appels trimestriels (855 € = 3 × 285 €).
// Chaque mois reprend l'échéance et la date de règlement de son trimestre.
export const CHARGES_DEMO: ChargesMensuelles[] = [
  { id: '1', mois: '2026-10', montant: 285.00, statut: 'en_attente', dateEcheance: '2026-10-15' },
  { id: '2', mois: '2026-09', montant: 285.00, statut: 'payee', datePaiement: '2026-07-10', dateEcheance: '2026-07-15' },
  { id: '3', mois: '2026-08', montant: 285.00, statut: 'payee', datePaiement: '2026-07-10', dateEcheance: '2026-07-15' },
  { id: '4', mois: '2026-07', montant: 285.00, statut: 'payee', datePaiement: '2026-07-10', dateEcheance: '2026-07-15' },
  { id: '5', mois: '2026-06', montant: 285.00, statut: 'payee', datePaiement: '2026-04-11', dateEcheance: '2026-04-15' },
  { id: '6', mois: '2026-05', montant: 285.00, statut: 'payee', datePaiement: '2026-04-11', dateEcheance: '2026-04-15' },
  { id: '7', mois: '2026-04', montant: 285.00, statut: 'payee', datePaiement: '2026-04-11', dateEcheance: '2026-04-15' },
  { id: '8', mois: '2026-03', montant: 285.00, statut: 'payee', datePaiement: '2026-01-12', dateEcheance: '2026-01-15' },
  { id: '9', mois: '2026-02', montant: 285.00, statut: 'payee', datePaiement: '2026-01-12', dateEcheance: '2026-01-15' },
  { id: '10', mois: '2026-01', montant: 285.00, statut: 'payee', datePaiement: '2026-01-12', dateEcheance: '2026-01-15' },
]

export const PAIEMENTS_DEMO: Paiement[] = [
  { id: '1', type: 'charges_trimestrielles', description: 'Charges T4 2026', montant: 855.00, dateEcheance: '2026-10-15', statut: 'en_attente', trimestre: 'T4 2026', reference: 'PAY-2026-004' },
  { id: '2', type: 'appel_fonds', description: 'Fonds de travaux art. 14-2-1', montant: 220.00, dateEcheance: '2026-11-05', statut: 'en_attente', reference: 'FDT-2026-001' },
  { id: '3', type: 'travaux', description: 'Ravalement façade — 1er appel de fonds (quote-part)', montant: 1462.50, dateEcheance: '2026-12-01', statut: 'en_attente', reference: 'TRX-2026-001' },
  { id: '4', type: 'charges_trimestrielles', description: 'Charges T3 2026', montant: 855.00, dateEcheance: '2026-07-15', datePaiement: '2026-07-10', statut: 'payee', trimestre: 'T3 2026', reference: 'PAY-2026-003' },
  { id: '5', type: 'regularisation', description: 'Régularisation charges 2025', montant: -125.00, dateEcheance: '2026-07-15', datePaiement: '2026-07-08', statut: 'payee', reference: 'REG-2025-001' },
  { id: '6', type: 'charges_trimestrielles', description: 'Charges T2 2026', montant: 855.00, dateEcheance: '2026-04-15', datePaiement: '2026-04-11', statut: 'payee', trimestre: 'T2 2026', reference: 'PAY-2026-002' },
  { id: '7', type: 'charges_trimestrielles', description: 'Charges T1 2026', montant: 855.00, dateEcheance: '2026-01-15', datePaiement: '2026-01-12', statut: 'payee', trimestre: 'T1 2026', reference: 'PAY-2026-001' },
  { id: '8', type: 'charges_trimestrielles', description: 'Charges T4 2025', montant: 830.00, dateEcheance: '2025-10-15', datePaiement: '2025-10-13', statut: 'payee', trimestre: 'T4 2025', reference: 'PAY-2025-004' },
]

export const DOCUMENTS_DEMO: DocumentCopro[] = [
  { id: '1', nom: 'Convocation AG Extraordinaire du 19 novembre 2026', type: 'autre', dateUpload: '2026-10-05', taille: '1.2 Mo', annee: 2026, public: true, consulte: false },
  { id: '2', nom: 'Devis chaudière à condensation — Thermo Services', type: 'autre', dateUpload: '2026-10-05', taille: '760 Ko', annee: 2026, public: true, consulte: false },
  { id: '3', nom: 'Appel de charges T4 2026', type: 'appel_charges', dateUpload: '2026-09-25', taille: '450 Ko', annee: 2026, public: false, consulte: true, dateConsultation: '2026-09-26' },
  { id: '4', nom: 'PV AG Ordinaire du 11 juin 2026', type: 'pv_ag', dateUpload: '2026-06-25', taille: '2.4 Mo', annee: 2026, public: true, consulte: true, dateConsultation: '2026-06-28' },
  { id: '5', nom: 'Comptes annuels 2025', type: 'compte_annuel', dateUpload: '2026-05-12', taille: '1.8 Mo', annee: 2025, public: true, consulte: true, dateConsultation: '2026-05-20' },
  { id: '6', nom: 'Budget prévisionnel 2027', type: 'budget', dateUpload: '2026-05-12', taille: '980 Ko', annee: 2027, public: true, consulte: true, dateConsultation: '2026-05-20' },
  { id: '7', nom: 'Contrat gardiennage 2026', type: 'contrat', dateUpload: '2026-08-20', taille: '2.0 Mo', annee: 2026, public: true, consulte: false },
  { id: '8', nom: 'Contrat assurance immeuble 2026', type: 'contrat', dateUpload: '2026-01-02', taille: '3.1 Mo', annee: 2026, public: true, consulte: false },
  { id: '9', nom: 'PV AG Extraordinaire Toiture 2025', type: 'pv_ag', dateUpload: '2025-10-01', taille: '1.6 Mo', annee: 2025, public: true, consulte: true, dateConsultation: '2025-10-05' },
  { id: '10', nom: 'Règlement de copropriété', type: 'reglement', dateUpload: '2020-03-10', taille: '5.2 Mo', annee: 2020, public: true, consulte: true, dateConsultation: '2024-06-15' },
]

export const ANNONCES_DEMO: Annonce[] = [
  { id: '1', titre: 'Coupure eau froide — 20 octobre', contenu: 'Une coupure d\'eau froide est prévue le mardi 20 octobre 2026 de 9h à 12h pour le remplacement d\'une vanne dans le local technique. Merci de prévoir vos réserves.', date: '2026-10-08', auteur: SYNDIC_DEMO, importance: 'urgent', lu: false },
  { id: '2', titre: 'Convocation — AG extraordinaire du 19 novembre', contenu: 'L\'assemblée générale extraordinaire se tiendra le jeudi 19 novembre 2026 à 18h00 à la salle polyvalente. Ordre du jour : remplacement de la chaudière collective, financement des travaux, DPE collectif. Vote par correspondance possible en ligne jusqu\'au 15 novembre 2026.', date: '2026-10-05', auteur: SYNDIC_DEMO, importance: 'important', lu: false },
  { id: '3', titre: 'Ravalement façade : calendrier des travaux', contenu: 'Les travaux de ravalement votés lors de l\'AG du 11 juin 2026 débuteront le lundi 1er mars 2027, pour une durée estimée de 3 mois. Un échafaudage sera installé côté rue. Le premier appel de fonds (50 % de votre quote-part) est fixé au 1er décembre 2026.', date: '2026-09-28', auteur: SYNDIC_DEMO, importance: 'important', lu: false },
  { id: '4', titre: 'Nouvelle gardienne', contenu: 'Nous avons le plaisir de vous informer que Mme Sophie Bernard a pris ses fonctions de gardienne le 1er septembre 2026. Elle est joignable au 01 23 45 67 89.', date: '2026-08-25', auteur: SYNDIC_DEMO, importance: 'info', lu: true },
]

export const AG_DEMO: AssembleeGenerale[] = [
  {
    id: '1',
    titre: 'AG Extraordinaire — Chaudière collective',
    date: '2026-11-19T18:00:00',
    lieu: 'Salle polyvalente, 182 avenue du Prado, 13008 Marseille',
    type: 'extraordinaire',
    statut: 'convoquee',
    ordreDuJour: [
      'Remplacement de la chaudière collective — choix de l\'entreprise et vote des travaux',
      'Financement des travaux de chaudière — appels de fonds exceptionnels',
      'Réalisation du diagnostic de performance énergétique (DPE) collectif',
      'Questions diverses',
    ],
    resolutions: [
      { id: 'r1', titre: 'Remplacement de la chaudière collective', description: 'Remplacement de la chaudière collective vétuste (installée en 1998) par une chaudière gaz à condensation, pour un montant de 32 000 € TTC (entreprise Thermo Services, devis du 08/09/2026).', majorite: 'art25', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
      { id: 'r2', titre: 'Financement de la chaudière', description: 'Financement par deux appels de fonds exceptionnels de 16 000 € chacun, exigibles le 01/02/2027 et le 01/05/2027, répartis selon les tantièmes généraux.', majorite: 'art24', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
      { id: 'r3', titre: 'DPE collectif', description: 'Réalisation du diagnostic de performance énergétique collectif de l\'immeuble pour un montant de 3 600 € TTC, imputé sur le budget de l\'exercice 2027.', majorite: 'art24', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
    ],
    lienVisio: '',
  },
  {
    id: '3',
    titre: 'AG Ordinaire 2026',
    date: '2026-06-11T18:00:00',
    lieu: 'Salle polyvalente, 182 avenue du Prado, 13008 Marseille',
    type: 'ordinaire',
    statut: 'cloturee',
    ordreDuJour: [
      'Approbation des comptes de l\'exercice 2025',
      'Vote du budget prévisionnel 2027',
      'Travaux de ravalement façade — devis et financement',
      'Désignation du syndic pour la période 2026-2029',
      'Questions diverses',
    ],
    resolutions: [
      { id: 'r8', titre: 'Approbation des comptes 2025', description: 'Approbation des comptes de l\'exercice clos au 31/12/2025, présentant un total de charges de 42 800 € et un solde positif de 2 200 €.', majorite: 'art24', monVote: 'pour', votePour: 7150, voteContre: 450, voteAbstention: 600, statut: 'cloturee', resultat: 'adoptée' },
      { id: 'r9', titre: 'Budget prévisionnel 2027', description: 'Vote du budget prévisionnel de l\'exercice 2027 d\'un montant total de 46 500 €, soit une hausse de 3,3 % par rapport au budget 2026 (45 000 €).', majorite: 'art24', monVote: 'pour', votePour: 6800, voteContre: 900, voteAbstention: 500, statut: 'cloturee', resultat: 'adoptée' },
      { id: 'r10', titre: 'Ravalement façade', description: 'Travaux de ravalement de la façade côté rue pour 85 000 € TTC (entreprise Renov\'Bat, devis du 12/01/2026). Financement : 20 000 € pris sur le fonds de travaux, le solde en deux appels de fonds exceptionnels (01/12/2026 et 01/03/2027). Début des travaux le 01/03/2027.', majorite: 'art25', monVote: 'pour', votePour: 6100, voteContre: 1650, voteAbstention: 450, statut: 'cloturee', resultat: 'adoptée' },
      { id: 'r11', titre: 'Désignation du syndic', description: 'Renouvellement du mandat du Cabinet Dupont en qualité de syndic de la copropriété pour une durée de 3 ans (2026-2029), aux conditions du contrat joint.', majorite: 'art25', monVote: 'abstention', votePour: 5600, voteContre: 1900, voteAbstention: 700, statut: 'cloturee', resultat: 'adoptée' },
    ],
  },
  {
    id: '2',
    titre: 'AG Extraordinaire — Toiture',
    date: '2025-09-20T18:00:00',
    lieu: 'Salle polyvalente, 182 avenue du Prado, 13008 Marseille',
    type: 'extraordinaire',
    statut: 'cloturee',
    ordreDuJour: [
      'Réfection urgente de la toiture bâtiment D',
      'Modalités de financement des travaux',
    ],
    resolutions: [
      { id: 'r6', titre: 'Réfection toiture bât. D', description: 'Approbation des travaux urgents de réfection de la toiture du bâtiment D suite aux infiltrations constatées, montant 52 000 € TTC.', majorite: 'art25', monVote: 'pour', votePour: 6200, voteContre: 1800, voteAbstention: 500, statut: 'cloturee', resultat: 'adoptée' },
      { id: 'r7', titre: 'Emprunt collectif', description: 'Autorisation de contracter un emprunt collectif de 45 000 € sur 5 ans auprès de la Banque Postale pour financer les travaux de toiture.', majorite: 'art26', monVote: 'contre', votePour: 5500, voteContre: 3000, voteAbstention: 1000, statut: 'cloturee', resultat: 'rejetée' },
    ],
  },
]

export const ECHEANCES_DEMO: Echeance[] = [
  { id: '1', type: 'paiement', titre: 'Charges T4 2026', date: '2026-10-15', description: '855,00 € — Appel de charges trimestriel', urgent: true },
  { id: '2', type: 'maintenance', titre: 'Coupure eau froide', date: '2026-10-20', description: '9h-12h — Remplacement vanne local technique', urgent: true },
  { id: '3', type: 'paiement', titre: 'Fonds de travaux art. 14-2-1', date: '2026-11-05', description: '220,00 € — Cotisation annuelle', urgent: false },
  { id: '4', type: 'assemblee', titre: 'Fin du vote par correspondance', date: '2026-11-15', description: 'AG du 19/11 — formulaire en ligne, onglet Assemblées & Votes', urgent: false },
  { id: '5', type: 'assemblee', titre: 'AG Extraordinaire — Chaudière', date: '2026-11-19', description: '18h00 — Salle polyvalente', urgent: false },
  { id: '6', type: 'paiement', titre: 'Ravalement façade — 1er appel de fonds', date: '2026-12-01', description: '1 462,50 € — Quote-part travaux', urgent: false },
]

export const NOTIFICATIONS_DEMO: CoproNotification[] = [
  { id: '1', type: 'alerte', titre: 'Coupure eau froide le 20 octobre', message: 'Coupure prévue le 20/10 de 9h à 12h pour remplacement d\'une vanne', date: '2026-10-08T10:00:00', lu: false },
  { id: '2', type: 'document', titre: 'Convocation AG disponible', message: 'La convocation à l\'AG du 19/11 et le devis chaudière sont dans vos documents', date: '2026-10-05T14:00:00', lu: false },
  { id: '3', type: 'rappel', titre: 'Échéance charges T4 2026', message: 'Échéance le 15/10 — 855,00 € à régler', date: '2026-10-09T09:00:00', lu: true },
  { id: '4', type: 'vote', titre: 'Vote par correspondance ouvert', message: 'AG du 19/11 : vous pouvez voter en ligne jusqu\'au 15/11', date: '2026-10-06T08:00:00', lu: false },
  { id: '5', type: 'message', titre: 'Réponse du syndic', message: 'Votre signalement de fuite palier 4ème a été traité', date: '2026-09-22T16:30:00', lu: true },
]

export const HISTORIQUE_DEMO: HistoriqueEntry[] = [
  { id: '1', type: 'signalement', titre: 'Signalement bruit ascenseur', description: 'Signalement créé — en attente intervention', date: '2026-09-29' },
  { id: '2', type: 'signalement', titre: 'Signalement fuite palier 4ème', description: 'Signalement créé et traité — intervention Marc Fontaine', date: '2026-09-15' },
  { id: '3', type: 'paiement', titre: 'Charges T3 2026 réglées', description: 'Paiement de 855,00 € reçu', date: '2026-07-10', montant: 855.00 },
  { id: '4', type: 'paiement', titre: 'Régularisation charges 2025', description: 'Trop-perçu remboursé', date: '2026-07-08', montant: -125.00 },
  { id: '5', type: 'document', titre: 'PV AG Ordinaire 2026 consulté', description: 'Document téléchargé', date: '2026-06-28' },
  { id: '6', type: 'vote', titre: 'Vote AG Ordinaire 2026', description: 'Vous avez voté POUR le ravalement de la façade', date: '2026-06-11' },
  { id: '7', type: 'document', titre: 'Budget prévisionnel 2027 consulté', description: 'Document consulté', date: '2026-05-20' },
  { id: '8', type: 'paiement', titre: 'Charges T2 2026 réglées', description: 'Paiement de 855,00 € reçu', date: '2026-04-11', montant: 855.00 },
  { id: '9', type: 'paiement', titre: 'Charges T1 2026 réglées', description: 'Paiement de 855,00 € reçu', date: '2026-01-12', montant: 855.00 },
  { id: '10', type: 'paiement', titre: 'Charges T4 2025 réglées', description: 'Paiement de 830,00 € reçu', date: '2025-10-13', montant: 830.00 },
  { id: '11', type: 'vote', titre: 'Vote AG Extraordinaire — Toiture', description: 'Vous avez voté POUR la réfection toiture bât. D', date: '2025-09-20' },
  { id: '12', type: 'vote', titre: 'Vote AG Extraordinaire — Emprunt', description: 'Vous avez voté CONTRE l\'emprunt collectif', date: '2025-09-20' },
  { id: '13', type: 'paiement', titre: 'Charges T3 2025 réglées', description: 'Paiement de 830,00 € reçu', date: '2025-07-14', montant: 830.00 },
]

export const PARAMS_DEMO: ParamConfidentialite = {
  notifEmail: true,
  notifPush: true,
  mailingAG: true,
  alertesPaiement: true,
  alertesTravaux: true,
  resumeHebdo: false,
}

export const INTERVENTIONS_DEMO: SuiviIntervention[] = [
  {
    id: 'int-1',
    type: 'Plomberie',
    description: 'Fuite robinet salle de bain',
    artisan: 'Mohamed Ait — Plomberie Express',
    artisanPhone: '06 89 34 56 12',
    statut: 'en_route',
    dateRdv: '2026-10-12',
    heureRdv: '14:00',
    progression: 35,
    gpsLat: 43.2781,
    gpsLng: 5.3902,
    gpsEta: 12,
  },
  {
    id: 'int-2',
    type: 'Électricité',
    description: 'Remplacement tableau électrique',
    artisan: 'Paul Martin — Électro Services',
    artisanPhone: '06 12 78 45 90',
    statut: 'termine',
    dateRdv: '2026-10-02',
    heureRdv: '09:00',
    progression: 100,
    note: 5,
    commentaire: 'Travail très propre, artisan ponctuel',
    preuve: { avantPhotos: 3, apresPhotos: 4, signee: true },
  },
  {
    id: 'int-3',
    type: 'Serrurerie',
    description: 'Remplacement serrure porte palière',
    artisan: 'Jean Dupont — Serrurerie Dupont',
    artisanPhone: '06 55 43 21 98',
    statut: 'planifie',
    dateRdv: '2026-10-22',
    heureRdv: '10:30',
    progression: 0,
  },
  {
    id: 'int-4',
    type: 'Peinture',
    description: 'Reprise peinture couloir',
    artisan: 'Sophie Renard — Déco & Co',
    artisanPhone: '06 34 12 98 76',
    statut: 'sur_place',
    dateRdv: '2026-10-09',
    heureRdv: '08:00',
    progression: 65,
    preuve: { avantPhotos: 2, apresPhotos: 0, signee: false },
  },
]

export const POSTES_CHARGES: PosteCharge[] = [
  { label: 'Gardiennage', emoji: '🔑', montantAnnuel: 1200, budget: 1300, couleur: '#6366f1' },
  { label: 'Assurance', emoji: '🛡️', montantAnnuel: 480, budget: 500, couleur: '#10b981' },
  { label: 'Entretien espaces verts', emoji: '🌿', montantAnnuel: 360, budget: 400, couleur: '#22c55e' },
  { label: 'Eau froide parties communes', emoji: '💧', montantAnnuel: 220, budget: 250, couleur: '#3b82f6' },
  { label: 'Électricité communes', emoji: '⚡', montantAnnuel: 310, budget: 320, couleur: '#f59e0b' },
  { label: 'Ascenseur (maintenance)', emoji: '🏢', montantAnnuel: 540, budget: 600, couleur: '#8b5cf6' },
  { label: 'Nettoyage', emoji: '🧹', montantAnnuel: 260, budget: 280, couleur: '#ec4899' },
  { label: 'Fonds travaux art. 14-2-1', emoji: '🏗️', montantAnnuel: 880, budget: 880, couleur: '#ef4444' },
]

// Loyer révisé (IRL) le 1er mars 2026 : 1 210 € puis 1 250 € par mois, charges comprises.
export const QUITTANCES_DEMO: Quittance[] = [
  { id: 'q1', mois: '2026-10', montant: 1250, statut: 'emise',         dateEmission: '2026-10-01', reference: 'QUI-2026-10' },
  { id: 'q2', mois: '2026-09', montant: 1250, statut: 'tele_chargee', dateEmission: '2026-09-01', reference: 'QUI-2026-09' },
  { id: 'q3', mois: '2026-08', montant: 1250, statut: 'tele_chargee', dateEmission: '2026-08-01', reference: 'QUI-2026-08' },
  { id: 'q4', mois: '2026-07', montant: 1250, statut: 'tele_chargee', dateEmission: '2026-07-01', reference: 'QUI-2026-07' },
  { id: 'q5', mois: '2026-06', montant: 1250, statut: 'tele_chargee', dateEmission: '2026-06-01', reference: 'QUI-2026-06' },
  { id: 'q6', mois: '2026-05', montant: 1250, statut: 'tele_chargee', dateEmission: '2026-05-01', reference: 'QUI-2026-05' },
  { id: 'q7', mois: '2026-04', montant: 1250, statut: 'tele_chargee', dateEmission: '2026-04-01', reference: 'QUI-2026-04' },
  { id: 'q8', mois: '2026-03', montant: 1250, statut: 'tele_chargee', dateEmission: '2026-03-01', reference: 'QUI-2026-03' },
  { id: 'q9', mois: '2026-02', montant: 1210, statut: 'tele_chargee', dateEmission: '2026-02-01', reference: 'QUI-2026-02' },
  { id: 'q10', mois: '2026-01', montant: 1210, statut: 'tele_chargee', dateEmission: '2026-01-01', reference: 'QUI-2026-01' },
  { id: 'q11', mois: '2025-12', montant: 1210, statut: 'tele_chargee', dateEmission: '2025-12-01', reference: 'QUI-2025-12' },
  { id: 'q12', mois: '2025-11', montant: 1210, statut: 'tele_chargee', dateEmission: '2025-11-01', reference: 'QUI-2025-11' },
]

export const BAIL_DEMO: Bail = {
  id: 'bail-1',
  dateDebut: '2022-03-01',
  dateFin: null,
  duree: 36,
  loyerBase: 1100,
  charges: 150,
  depot: 2200,
  indexation: 'irl',
  derniereRevision: '2026-03-01',
  prochaineRevision: '2027-03-01',
  indiceRef: 136.27,
  indiceActuel: 140.38,
  bailleur: 'SCI Les Acacias',
  bailleurAdresse: '45 avenue du Prado, 13008 Marseille',
  bailleurPhone: '01 45 67 89 00',
  agence: 'Cabinet Dupont Immobilier',
  logement: 'Appartement T3, 4ème étage, Bâtiment D',
  surface: 68,
  numLot: '12',
  preavis: 3,
}
