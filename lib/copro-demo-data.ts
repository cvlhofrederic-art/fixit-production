// ─── Copro Demo Data ──────────────────────────────────────────────────────────
// Centralized demo data for the coproprietaire dashboard.
// Imported by page.tsx and extracted section components.

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
  immeuble: 'Résidence Les Acacias',
  batiment: 'D',
  etage: '4',
  numLot: '12',
  tantiemes: 450,
  quotePart: 4.5,
}

export const CHARGES_DEMO: ChargesMensuelles[] = [
  { id: '1', mois: '2026-02', montant: 285.00, statut: 'payee', datePaiement: '2026-02-05', dateEcheance: '2026-02-10' },
  { id: '2', mois: '2026-01', montant: 285.00, statut: 'payee', datePaiement: '2026-01-08', dateEcheance: '2026-01-10' },
  { id: '3', mois: '2026-03', montant: 285.00, statut: 'en_attente', dateEcheance: '2026-03-10' },
  { id: '4', mois: '2025-12', montant: 285.00, statut: 'payee', datePaiement: '2025-12-09', dateEcheance: '2025-12-10' },
  { id: '5', mois: '2025-11', montant: 285.00, statut: 'payee', datePaiement: '2025-11-10', dateEcheance: '2025-11-10' },
  { id: '6', mois: '2025-10', montant: 285.00, statut: 'payee', datePaiement: '2025-10-07', dateEcheance: '2025-10-10' },
]

export const PAIEMENTS_DEMO: Paiement[] = [
  { id: '1', type: 'charges_trimestrielles', description: 'Charges T1 2026', montant: 855.00, dateEcheance: '2026-01-15', datePaiement: '2026-01-12', statut: 'payee', trimestre: 'T1 2026', reference: 'PAY-2026-001' },
  { id: '2', type: 'charges_trimestrielles', description: 'Charges T2 2026', montant: 855.00, dateEcheance: '2026-04-15', statut: 'en_attente', trimestre: 'T2 2026', reference: 'PAY-2026-002' },
  { id: '3', type: 'appel_fonds', description: 'Fonds de travaux art. 14-2', montant: 220.00, dateEcheance: '2026-03-01', statut: 'en_attente', reference: 'FDT-2026-001' },
  { id: '4', type: 'travaux', description: 'Ravalement façade (quote-part)', montant: 1450.00, dateEcheance: '2026-06-01', statut: 'en_attente', reference: 'TRX-2026-001' },
  { id: '5', type: 'charges_trimestrielles', description: 'Charges T4 2025', montant: 830.00, dateEcheance: '2025-10-15', datePaiement: '2025-10-13', statut: 'payee', trimestre: 'T4 2025', reference: 'PAY-2025-004' },
  { id: '6', type: 'regularisation', description: 'Régularisation charges 2025', montant: -125.00, dateEcheance: '2026-03-30', datePaiement: '2026-02-28', statut: 'payee', reference: 'REG-2025-001' },
]

export const DOCUMENTS_DEMO: DocumentCopro[] = [
  { id: '1', nom: 'PV AG Ordinaire 2025', type: 'pv_ag', dateUpload: '2025-06-20', taille: '2.4 Mo', annee: 2025, public: true, consulte: true, dateConsultation: '2025-07-01' },
  { id: '2', nom: 'Comptes annuels 2025', type: 'compte_annuel', dateUpload: '2026-01-15', taille: '1.8 Mo', annee: 2025, public: true, consulte: false },
  { id: '3', nom: 'Budget prévisionnel 2026', type: 'budget', dateUpload: '2025-11-20', taille: '980 Ko', annee: 2026, public: true, consulte: true, dateConsultation: '2025-12-01' },
  { id: '4', nom: 'Règlement de copropriété', type: 'reglement', dateUpload: '2020-03-10', taille: '5.2 Mo', annee: 2020, public: true, consulte: true, dateConsultation: '2024-06-15' },
  { id: '5', nom: 'Contrat assurance immeuble 2026', type: 'contrat', dateUpload: '2026-01-02', taille: '3.1 Mo', annee: 2026, public: true, consulte: false },
  { id: '6', nom: 'Appel de charges T1 2026', type: 'appel_charges', dateUpload: '2026-01-05', taille: '450 Ko', annee: 2026, public: false, consulte: true, dateConsultation: '2026-01-06' },
  { id: '7', nom: 'PV AG Extraordinaire Toiture 2025', type: 'pv_ag', dateUpload: '2025-10-01', taille: '1.6 Mo', annee: 2025, public: true, consulte: true, dateConsultation: '2025-10-05' },
  { id: '8', nom: 'Contrat gardiennage 2026', type: 'contrat', dateUpload: '2026-02-01', taille: '2.0 Mo', annee: 2026, public: true, consulte: false },
]

export const ANNONCES_DEMO: Annonce[] = [
  { id: '1', titre: 'Travaux ravalement façade', contenu: 'Les travaux de ravalement commenceront le 15 mars 2026. Un échafaudage sera installé côté rue. Merci de ne pas stationner devant l\'immeuble durant cette période. Durée estimée : 3 mois.', date: '2026-02-20', auteur: 'Cabinet Dupont', importance: 'important', lu: false },
  { id: '2', titre: 'Coupure eau froide — 28 février', contenu: 'Une coupure d\'eau froide est prévue le 28/02 de 9h à 12h pour remplacement d\'une vanne dans le local technique. Merci de prévoir vos réserves.', date: '2026-02-24', auteur: 'Cabinet Dupont', importance: 'urgent', lu: false },
  { id: '3', titre: 'Nouvelle gardienne', contenu: 'Nous avons le plaisir de vous informer que Mme Sophie Bernard prendra ses fonctions de gardienne à compter du 1er mars 2026. Elle sera joignable au 01 23 45 67 89.', date: '2026-02-15', auteur: 'Cabinet Dupont', importance: 'info', lu: true },
  { id: '4', titre: 'Rappel — AG Ordinaire le 15 avril', contenu: 'L\'assemblée générale ordinaire se tiendra le 15 avril 2026 à 18h00 à la salle polyvalente. Merci de confirmer votre présence ou de donner pouvoir.', date: '2026-02-10', auteur: 'Cabinet Dupont', importance: 'important', lu: true },
]

export const AG_DEMO: AssembleeGenerale[] = [
  {
    id: '1',
    titre: 'AG Ordinaire 2026',
    date: '2026-04-15T18:00:00',
    lieu: 'Salle polyvalente, 12 rue des Acacias, Paris 8e',
    type: 'ordinaire',
    statut: 'convoquee',
    ordreDuJour: [
      'Approbation des comptes de l\'exercice 2025',
      'Vote du budget prévisionnel 2026',
      'Travaux de ravalement façade — devis et financement',
      'Remplacement chaudière collective — devis et vote',
      'Désignation du syndic pour la période 2026-2029',
      'Questions diverses',
    ],
    resolutions: [
      { id: 'r1', titre: 'Approbation des comptes 2025', description: 'Approbation des comptes de l\'exercice clos au 31/12/2025, présentant un total de charges de 42 800 € et un solde positif de 2 200 €.', majorite: 'art24', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
      { id: 'r2', titre: 'Budget prévisionnel 2026', description: 'Vote du budget prévisionnel pour l\'exercice 2026 d\'un montant total de 45 000 €, soit une augmentation de 5,1% par rapport à 2025.', majorite: 'art24', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
      { id: 'r3', titre: 'Ravalement façade', description: 'Approbation des travaux de ravalement de la façade côté rue pour un montant de 85 000 € TTC (entreprise Renov\'Bat, devis du 12/01/2026). Financement : fonds travaux + appel exceptionnel.', majorite: 'art25', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
      { id: 'r4', titre: 'Remplacement chaudière collective', description: 'Approbation du remplacement de la chaudière collective vétuste (installée en 1998) par une chaudière à condensation, montant 32 000 € TTC.', majorite: 'art25', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
      { id: 'r5', titre: 'Désignation du syndic', description: 'Renouvellement du mandat du Cabinet Dupont en qualité de syndic de la copropriété pour une durée de 3 ans (2026-2029), aux conditions du contrat joint.', majorite: 'art25', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
    ],
    lienVisio: '',
  },
  {
    id: '2',
    titre: 'AG Extraordinaire — Toiture',
    date: '2025-09-20T18:00:00',
    lieu: 'Salle polyvalente, 12 rue des Acacias, Paris 8e',
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
  { id: '1', type: 'paiement', titre: 'Fonds de travaux art. 14-2', date: '2026-03-01', description: '220,00 € — Appel de fonds annuel', urgent: true },
  { id: '2', type: 'maintenance', titre: 'Coupure eau froide', date: '2026-02-28', description: '9h-12h — Remplacement vanne local technique', urgent: true },
  { id: '3', type: 'document', titre: 'Comptes annuels 2025 à consulter', date: '2026-03-15', description: 'Nouveau document disponible', urgent: false },
  { id: '4', type: 'assemblee', titre: 'AG Ordinaire 2026', date: '2026-04-15', description: '18h00 — Salle polyvalente', urgent: false },
  { id: '5', type: 'paiement', titre: 'Charges T2 2026', date: '2026-04-15', description: '855,00 € — Charges trimestrielles', urgent: false },
]

export const NOTIFICATIONS_DEMO: CoproNotification[] = [
  { id: '1', type: 'alerte', titre: 'Coupure eau froide demain', message: 'Coupure prévue le 28/02 de 9h à 12h pour remplacement vanne', date: '2026-02-27T10:00:00', lu: false },
  { id: '2', type: 'document', titre: 'Nouveau document disponible', message: 'Les comptes annuels 2025 sont consultables dans vos documents', date: '2026-01-15T14:00:00', lu: false },
  { id: '3', type: 'rappel', titre: 'Échéance fonds de travaux', message: 'Échéance le 01/03 — 220,00 € à régler', date: '2026-02-20T09:00:00', lu: true },
  { id: '4', type: 'vote', titre: 'Vote par correspondance ouvert', message: 'AG du 15/04 : vous pouvez voter en ligne avant le 10/04', date: '2026-02-25T08:00:00', lu: false },
  { id: '5', type: 'message', titre: 'Réponse du syndic', message: 'Votre signalement de fuite palier 4ème a été traité', date: '2026-02-22T16:30:00', lu: true },
]

export const HISTORIQUE_DEMO: HistoriqueEntry[] = [
  { id: '1', type: 'paiement', titre: 'Charges T1 2026 réglées', description: 'Paiement de 855,00 € reçu', date: '2026-01-12', montant: 855.00 },
  { id: '2', type: 'vote', titre: 'Vote AG Extraordinaire — Toiture', description: 'Vous avez voté POUR la réfection toiture bât. D', date: '2025-09-20' },
  { id: '3', type: 'document', titre: 'PV AG Ordinaire 2025 consulté', description: 'Document téléchargé', date: '2025-07-01' },
  { id: '4', type: 'signalement', titre: 'Signalement fuite palier 4ème', description: 'Signalement créé et traité — intervention Marc Fontaine', date: '2025-08-15' },
  { id: '5', type: 'paiement', titre: 'Charges T4 2025 réglées', description: 'Paiement de 830,00 € reçu', date: '2025-10-13', montant: 830.00 },
  { id: '6', type: 'paiement', titre: 'Régularisation charges 2025', description: 'Trop-perçu remboursé', date: '2026-02-28', montant: -125.00 },
  { id: '7', type: 'document', titre: 'Budget prévisionnel 2026 consulté', description: 'Document consulté', date: '2025-12-01' },
  { id: '8', type: 'vote', titre: 'Vote AG Extraordinaire — Emprunt', description: 'Vous avez voté CONTRE l\'emprunt collectif', date: '2025-09-20' },
  { id: '9', type: 'paiement', titre: 'Charges T3 2025 réglées', description: 'Paiement de 830,00 € reçu', date: '2025-07-14', montant: 830.00 },
  { id: '10', type: 'signalement', titre: 'Signalement bruit ascenseur', description: 'Signalement créé — en attente intervention', date: '2025-06-20' },
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
    dateRdv: '2026-02-26',
    heureRdv: '14:00',
    progression: 35,
    gpsLat: 48.8566,
    gpsLng: 2.3522,
    gpsEta: 12,
  },
  {
    id: 'int-2',
    type: 'Électricité',
    description: 'Remplacement tableau électrique',
    artisan: 'Paul Martin — Électro Services',
    artisanPhone: '06 12 78 45 90',
    statut: 'termine',
    dateRdv: '2026-02-20',
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
    dateRdv: '2026-03-05',
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
    dateRdv: '2026-02-25',
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
  { label: 'Fonds travaux art.14-2', emoji: '🏗️', montantAnnuel: 880, budget: 880, couleur: '#ef4444' },
]

export const QUITTANCES_DEMO: Quittance[] = [
  { id: 'q1', mois: '2026-02', montant: 1250, statut: 'emise',         dateEmission: '2026-02-01', reference: 'QUI-2026-02' },
  { id: 'q2', mois: '2026-01', montant: 1250, statut: 'tele_chargee', dateEmission: '2026-01-01', reference: 'QUI-2026-01' },
  { id: 'q3', mois: '2025-12', montant: 1250, statut: 'tele_chargee', dateEmission: '2025-12-01', reference: 'QUI-2025-12' },
  { id: 'q4', mois: '2025-11', montant: 1250, statut: 'tele_chargee', dateEmission: '2025-11-01', reference: 'QUI-2025-11' },
  { id: 'q5', mois: '2025-10', montant: 1210, statut: 'tele_chargee', dateEmission: '2025-10-01', reference: 'QUI-2025-10' },
  { id: 'q6', mois: '2025-09', montant: 1210, statut: 'tele_chargee', dateEmission: '2025-09-01', reference: 'QUI-2025-09' },
  { id: 'q7', mois: '2025-08', montant: 1210, statut: 'tele_chargee', dateEmission: '2025-08-01', reference: 'QUI-2025-08' },
  { id: 'q8', mois: '2025-07', montant: 1210, statut: 'tele_chargee', dateEmission: '2025-07-01', reference: 'QUI-2025-07' },
  { id: 'q9', mois: '2025-06', montant: 1180, statut: 'tele_chargee', dateEmission: '2025-06-01', reference: 'QUI-2025-06' },
  { id: 'q10', mois: '2025-05', montant: 1180, statut: 'tele_chargee', dateEmission: '2025-05-01', reference: 'QUI-2025-05' },
  { id: 'q11', mois: '2025-04', montant: 1180, statut: 'tele_chargee', dateEmission: '2025-04-01', reference: 'QUI-2025-04' },
  { id: 'q12', mois: '2025-03', montant: 1180, statut: 'tele_chargee', dateEmission: '2025-03-01', reference: 'QUI-2025-03' },
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
  derniereRevision: '2025-03-01',
  prochaineRevision: '2026-03-01',
  indiceRef: 136.27,
  indiceActuel: 140.38,
  bailleur: 'SCI Les Acacias',
  bailleurAdresse: '45 avenue Victor Hugo, 75016 Paris',
  bailleurPhone: '01 45 67 89 00',
  agence: 'Cabinet Dupont Immobilier',
  logement: 'Appartement T3, 3ème étage, Bâtiment D',
  surface: 68,
  numLot: '12',
  preavis: 3,
}
