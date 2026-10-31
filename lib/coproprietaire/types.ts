// ── Espace copropriétaire : vues servies au portail ───────────────────────────
//
// Une seule forme de données pour le portail (app/(commun)/coproprietaire/dashboard), qu'elle
// vienne de la base du syndic (GET /api/coproprietaire/espace, lib/coproprietaire/filtrage.ts)
// ou du jeu de démonstration (lib/coproprietaire/demo.ts). Les écrans ne connaissent
// que ces types : aucune colonne Supabase, aucune donnée d'un autre copropriétaire.
//
// Montants en euros (nombre), dates en ISO (AAAA-MM-JJ ou horodatage ISO complet),
// chaînes vides plutôt que null pour les textes absents.

/** Provenance des données affichées. */
export type SourceEspace = 'reel' | 'demo'

/** Lien du compte connecté avec le lot : propriétaire du lot ou son locataire. */
export type RoleOccupant = 'proprietaire' | 'locataire'

/** Statuts partagés par les signalements et les missions (CHECK de syndic_signalements / syndic_missions). */
export type StatutIntervention = 'en_attente' | 'acceptee' | 'en_cours' | 'terminee' | 'annulee'

export type PrioriteIntervention = 'urgente' | 'normale' | 'planifiee'

export interface ProfilCopro {
  /** id de la fiche syndic_coproprios (« demo » pour le jeu de démonstration). */
  id: string
  prenom: string
  nom: string
  email: string
  telephone: string
  role: RoleOccupant
  immeuble: string
  batiment: string
  etage: string
  numLot: string
  /** Tantièmes du lot (0 si le syndic ne les a pas saisis). */
  tantiemes: number
  /** Quote-part en % des tantièmes de l'immeuble (0 si inconnue). */
  quotePart: number
  /** Total des tantièmes de l'immeuble (0 si le syndic n'a pas saisi tous les lots). */
  totalTantiemes: number
  /** Solde du compte tenu par le syndic : négatif = somme due, positif = crédit. */
  solde: number
  /** Le lot est-il occupé (locataire) ? */
  estOccupe: boolean
}

/** Autre lot du même compte (copropriétaire de plusieurs lots) : permet de changer de lot. */
export interface LotCopro {
  id: string
  immeuble: string
  batiment: string
  etage: string
  numLot: string
}

export interface ReglementImmeuble {
  texte: string
  pdfNom: string
  dateMaj: string
  chargesRepartition: string
  majoriteAg: string
  fondsTravaux: boolean
  fondsRoulementPct: number
}

export interface ImmeubleCopro {
  /** id de syndic_immeubles, ou null si le nom de la fiche ne correspond à aucun immeuble. */
  id: string | null
  nom: string
  adresse: string
  ville: string
  codePostal: string
  nbLots: number
  anneeConstruction: number | null
  typeImmeuble: string
  gestionnaire: string
  budgetAnnuel: number
  depensesAnnee: number
  reglement: ReglementImmeuble | null
}

/** Cabinet de syndic, tel qu'il se présente au copropriétaire (syndic_cabinets). */
export interface SyndicCopro {
  nom: string
  adresse: string
  ville: string
  codePostal: string
  telephone: string
  email: string
}

// ── Interventions ─────────────────────────────────────────────────────────────

/** Message du fil d'un signalement (syndic_signalement_messages). */
export interface MessageDemande {
  id: string
  auteur: string
  /** syndic | gestionnaire | technicien | coproprio */
  role: string
  texte: string
  date: string
  /** Écrit par le copropriétaire (rôle coproprio). */
  deMoi: boolean
}

/** Document envoyé par le prestataire dans la messagerie (devis, rapport, facture). */
export interface DocumentPrestataireVue {
  type: 'devis' | 'rapport' | 'facture'
  reference: string
  montantTtc: number | null
  description: string
  date: string
}

/** Compte rendu d'intervention saisi côté syndic (syndic_missions). */
export interface CompteRenduIntervention {
  travailEffectue: string
  materiauxUtilises: string
  problemesConstates: string
  recommandations: string
  dureeIntervention: string
  dateRapport: string
}

/** Mission du syndic vue par le copropriétaire (jamais de coordonnées du prestataire ni d'un autre lot). */
export interface InterventionVue {
  id: string
  type: string
  description: string
  /** Nom de l'entreprise prestataire (syndic_missions.artisan), vide tant qu'aucune n'est désignée. */
  prestataire: string
  statut: StatutIntervention
  priorite: PrioriteIntervention
  dateCreation: string
  datePrevue: string
  partieCommune: boolean
  zone: string
  batiment: string
  etage: string
  numLot: string
  /** Montants en € TTC ; null quand inconnus ou non communicables. */
  montantDevis: number | null
  montantFacture: number | null
  compteRendu: CompteRenduIntervention | null
  documents: DocumentPrestataireVue[]
  /** Mission issue d'un signalement de ce copropriétaire. */
  estLaMienne: boolean
  /** id du signalement d'origine, s'il y en a un. */
  signalementId: string | null
}

/** Signalement déposé par le copropriétaire, avec son suivi par le syndic. */
export interface DemandeCopro {
  id: string
  type: string
  description: string
  priorite: PrioriteIntervention
  statut: StatutIntervention
  partieCommune: boolean
  zone: string
  batiment: string
  etage: string
  numLot: string
  /** Prestataire désigné par le syndic (syndic_signalements.artisan_assigne). */
  prestataire: string
  creeLe: string
  misAJourLe: string
  /**
   * Provenance : 'portail' = déposée depuis ce compte (identité prise sur la fiche) ; 'public' = déposée
   * sans connexion (formulaire public, QR code) avec cet e-mail, donc signalée comme telle ; null = inconnue.
   */
  origine: 'portail' | 'public' | null
  messages: MessageDemande[]
  /** Mission créée par le syndic pour cette demande, s'il y en a une. */
  intervention: InterventionVue | null
}

// ── Charges et factures ───────────────────────────────────────────────────────

export type StatutAppel = 'a_payer' | 'partiellement_paye' | 'solde' | 'en_retard' | 'annule'

export interface AppelDeCharges {
  id: string
  /** Libellé de l'exercice tel que saisi par le syndic (ex. « 2026-T2 »). */
  exercice: string
  periodeDebut: string
  periodeFin: string
  montantTotal: number
  montantPaye: number
  resteAPayer: number
  statut: StatutAppel
  echeance: string
  iban: string
  referencePaiement: string
}

export type StatutFacture = 'a_regler' | 'partiellement_regle' | 'reglee' | 'contestee' | 'annulee'

export interface FactureCopro {
  id: string
  numero: string
  emiseLe: string
  echeance: string
  montantHt: number
  tvaTaux: number
  montantTtc: number
  description: string
  statut: StatutFacture
  /** Un PDF est archivé par le syndic : lien signé demandé à l'ouverture (jamais d'URL servie dans la liste). */
  pdfDisponible: boolean
}

export type NatureImpaye = 'charges_courantes' | 'travaux' | 'fonds_reserve' | 'interets_retard' | 'frais_relance' | 'autre'
export type StatutImpaye = 'ouvert' | 'en_recouvrement' | 'solde' | 'passe_perte'

export interface ImpayeCopro {
  id: string
  montant: number
  nature: NatureImpaye
  depuis: string
  nbRelances: number
  derniereRelanceLe: string
  statut: StatutImpaye
}

export interface FinancesCopro {
  /** Solde du compte (négatif = somme due). */
  solde: number
  appels: AppelDeCharges[]
  factures: FactureCopro[]
  impayes: ImpayeCopro[]
}

// ── Documents ─────────────────────────────────────────────────────────────────

/** Types de syndic_documents consultables par un copropriétaire (une fois publiés par le syndic). */
export type TypeDocumentImmeuble = 'pv_assemblee' | 'ata_ag' | 'contrat' | 'devis' | 'autre'

/** Rubriques de l'extranet (décret du 17 mars 1967, art. 33-1-1), choisies par le syndic à la publication. */
export type CategorieExtranet =
  | 'reglement' | 'edd' | 'fiche_synthetique' | 'carnet_entretien' | 'diagnostic' | 'assurance'
  | 'contrat_marche' | 'contrat_entretien' | 'pv_ag' | 'devis_approuve' | 'contrat_syndic'
  | 'convocation' | 'budget' | 'compte_individuel' | 'appel_fonds' | 'autre'

export interface DocumentImmeuble {
  id: string
  nom: string
  type: TypeDocumentImmeuble
  /** Rubrique choisie par le syndic, null s'il n'en a pas indiqué. */
  categorie: CategorieExtranet | null
  /** Document de l'espace personnel (adressé à ce seul copropriétaire). */
  personnel: boolean
  mimeType: string
  tailleOctets: number
  ajouteLe: string
  tags: string[]
}

export interface ContratImmeuble {
  id: string
  fournisseur: string
  /** limpezas | elevadores | seguranca | jardinagem | outros (valeurs de la table). */
  categorie: string
  coutMensuel: number
  coutAnnuel: number
  debut: string
  fin: string
  /** ativo | expirado | renovacao */
  statut: string
}

export interface AssuranceImmeuble {
  id: string
  assureur: string
  /** multirriscos | responsabilidade_civil | incendio | outros */
  type: string
  police: string
  primeAnnuelle: number
  capital: number
  debut: string
  fin: string
  /** ativa | expirada | renovacao */
  statut: string
}

export interface DocumentsCopro {
  fichiers: DocumentImmeuble[]
  contrats: ContratImmeuble[]
  assurances: AssuranceImmeuble[]
}

// ── Assemblées ────────────────────────────────────────────────────────────────

export type MajoriteResolution = 'art24' | 'art25' | 'art26' | 'unanimite'
export type ChoixVote = 'pour' | 'contre' | 'abstention'
/** Statuts de syndic_assemblees sans le brouillon (jamais montré) ni les accents. */
export type StatutAssemblee = 'convoquee' | 'en_cours' | 'cloturee' | 'annulee'

export interface ResolutionCopro {
  id: string
  numero: number
  titre: string
  description: string
  majorite: MajoriteResolution
  votePour: number
  voteContre: number
  voteAbstention: number
  /** en_cours | adoptee | rejetee */
  statut: 'en_cours' | 'adoptee' | 'rejetee'
  /** Vote par correspondance enregistré pour ce lot, ou null. */
  monVote: ChoixVote | null
  /** Date (AAAA-MM-JJ) de réception de ce vote, vide sans vote. */
  monVoteLe: string
}

export interface AssembleeCopro {
  id: string
  titre: string
  /** Horodatage ISO de la séance. */
  date: string
  lieu: string
  type: 'ordinaire' | 'extraordinaire'
  statut: StatutAssemblee
  ordreDuJour: string[]
  resolutions: ResolutionCopro[]
  totalTantiemes: number
  /** Procès-verbal (texte), vide tant qu'il n'est pas rédigé. */
  pv: string
  convocationEnvoyeeLe: string
}

// ── Annonces ──────────────────────────────────────────────────────────────────

export type CategorieAnnonce = 'manutencao' | 'assembleia' | 'financeiro' | 'seguranca' | 'social' | 'outro'
export type PrioriteAnnonce = 'normal' | 'importante' | 'urgente'

export interface AnnonceCopro {
  id: string
  titre: string
  contenu: string
  categorie: CategorieAnnonce
  priorite: PrioriteAnnonce
  epinglee: boolean
  date: string
  /** Immeuble visé, vide = tous les immeubles du cabinet. */
  immeuble: string
}

// ── Espace complet ────────────────────────────────────────────────────────────

export interface EspaceCopro {
  source: SourceEspace
  /** Super admin de démonstration qui consulte la fiche d'un copropriétaire de son cabinet. */
  vueSuperAdmin: boolean
  /** Horodatage ISO du chargement. */
  chargeLe: string
  profil: ProfilCopro
  /** Autres lots du même compte, hors celui affiché. */
  autresLots: LotCopro[]
  immeuble: ImmeubleCopro
  syndic: SyndicCopro
  interventions: {
    mesDemandes: DemandeCopro[]
    /** Missions sur les parties communes de l'immeuble (et celles du lot), les miennes comprises. */
    immeuble: InterventionVue[]
  }
  finances: FinancesCopro
  documents: DocumentsCopro
  assemblees: AssembleeCopro[]
  annonces: AnnonceCopro[]
}
