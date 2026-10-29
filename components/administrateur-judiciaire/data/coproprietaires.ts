import type { StatutPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import type { QUALITE_IDENTITE, TYPE_LOT } from '@/lib/data/referentiels-gesteam-judiciaire'

/** Personne derrière le compte (Gestéam, fiche client : grille Identité · Relation · Part). */
export interface PersonneCompteDemo {
  identite: string
  relation: (typeof QUALITE_IDENTITE)['copropriete'][number]
  part: string
}

/** Télécom de la fiche (Gestéam : Télécom · Nature · Préf. · Numéro / adresse). */
export interface TelecomDemo {
  type: 'Courriel' | 'Mobile' | 'Téléphone'
  nature: string
  prefere: boolean
  valeur: string
}

/** Lot du compte, avec son occupation (Gestéam, onglet Informations : Lots · Occup. · Nature). */
export interface LotCompteDemo {
  lot: string
  occupation: 'Résident' | 'Loué' | 'Vacant'
  nature: (typeof TYPE_LOT)[number]
}

/** Tantièmes du compte dans une clé de répartition. */
export interface TantiemesCleDemo {
  cle: string
  tantiemes: string
}

/** Locataire du lot : nom, prénom, téléphone et courriel. */
export interface LocataireDemo {
  nom: string
  prenom: string
  tel: string
  mail: string
}

/**
 * Fiche du compte copropriétaire, sur le modèle de la fiche client de Gestéam (tranche 30 : identité de la position,
 * personnes, télécoms, rattachement ; onglet Informations : lots, clés, diffusion, conseil syndical, extranet).
 * Le téléphone et le courriel principaux restent ceux du copropriétaire (`tel`, `mail`) ; `autresTelecoms` complète.
 */
export interface FicheCompteDemo {
  civilite: string
  /** null pour une personne morale. */
  prenom: string | null
  nomFamille: string
  adresse: string
  codePostal: string
  ville: string
  pays: string
  numeroCompte: string
  statutCompte: StatutPosition
  mandat: string
  situation: string
  formePropriete: string
  personnes: PersonneCompteDemo[]
  autresTelecoms: TelecomDemo[]
  lots: LotCompteDemo[]
  cles: TantiemesCleDemo[]
  /** Voie postale demandée par le copropriétaire (décret n° 2025-1292) ; sinon voie électronique de principe. */
  voiePostaleDemandee: boolean
  copieEnvois: boolean
  conseilSyndical: { membre: boolean; president: boolean; correspondant: boolean }
  extranet: { publie: boolean; acces: boolean; telephoneVisible: boolean }
  notes: string
  /** Avertissement affiché à l'ouverture de la fiche ; null : aucun. */
  avertissement: string | null
}

/**
 * Copropriétaire de démonstration, rattaché à sa copropriété par son nom (`copro`) : le seed résout l'id par le nom.
 * Un solde négatif est une dette. `locataire` : null si le lot n'est pas loué.
 */
export interface CoproprietaireDemo {
  id: string
  nom: string
  copro: string
  lot: string
  tantiemes: string
  solde: number
  statut: string
  pill: 'sage' | 'amber' | 'rust'
  tel: string
  mail: string
  locataire: LocataireDemo | null
  fiche: FicheCompteDemo
}

const MANDAT_DEMO = 'Administration judiciaire'
const SANS_CONSEIL_SYNDICAL = { membre: false, president: false, correspondant: false }
const EXTRANET_PUBLIE = { publie: true, acces: true, telephoneVisible: false }

export const DEMO_COPROPRIETAIRES: CoproprietaireDemo[] = [
  {
    id: 'P1',
    nom: 'Laurent Mercier',
    copro: 'Résidence Le Méridien',
    lot: 'Lot 12 — Apt B3',
    tantiemes: '412/10000',
    solde: 0,
    statut: 'À jour',
    pill: 'sage',
    tel: '06 12 34 56 78',
    mail: 'l.mercier@email.fr',
    locataire: {
      nom: 'Morel',
      prenom: 'Julien',
      tel: '06 45 18 27 93',
      mail: 'j.morel@email.fr',
    },
    fiche: {
      civilite: 'Monsieur',
      prenom: 'Laurent',
      nomFamille: 'Mercier',
      adresse: '8 allée des Platanes',
      codePostal: '13008',
      ville: 'Marseille',
      pays: 'France',
      numeroCompte: '00012',
      statutCompte: 'En place',
      mandat: MANDAT_DEMO,
      situation: 'Bât. B, 3e étage',
      formePropriete: 'Pleine propriété',
      personnes: [{ identite: 'Laurent Mercier', relation: 'Copropriétaire', part: '1/1' }],
      autresTelecoms: [{ type: 'Téléphone', nature: 'Bureau', prefere: false, valeur: '04 91 00 00 00' }],
      lots: [{ lot: 'Lot 12 — Apt B3', occupation: 'Loué', nature: 'Appartement' }],
      cles: [
        { cle: 'Charges générales', tantiemes: '412/10000' },
        { cle: 'Ascenseur bât. B', tantiemes: '58/1000' },
      ],
      voiePostaleDemandee: false,
      copieEnvois: true,
      conseilSyndical: { membre: true, president: false, correspondant: false },
      extranet: EXTRANET_PUBLIE,
      notes: 'Préfère être contacté le matin.',
      avertissement: null,
    },
  },
  {
    id: 'P2',
    nom: 'Sophie Garnier',
    copro: 'Le Clos des Vignes',
    lot: 'Lot 27 — Apt 4G',
    tantiemes: '308/10000',
    solde: -1840,
    statut: 'Impayé',
    pill: 'rust',
    tel: '06 22 11 90 04',
    mail: 'sophie.garnier@email.fr',
    locataire: null,
    fiche: {
      civilite: 'Madame',
      prenom: 'Sophie',
      nomFamille: 'Garnier',
      adresse: '27 chemin des Vignes',
      codePostal: '13090',
      ville: 'Aix-en-Provence',
      pays: 'France',
      numeroCompte: '00027',
      statutCompte: 'En place',
      mandat: MANDAT_DEMO,
      situation: '4e étage',
      formePropriete: 'Pleine propriété',
      personnes: [{ identite: 'Sophie Garnier', relation: 'Copropriétaire', part: '1/1' }],
      autresTelecoms: [],
      lots: [{ lot: 'Lot 27 — Apt 4G', occupation: 'Résident', nature: 'Appartement' }],
      cles: [{ cle: 'Charges générales', tantiemes: '308/10000' }],
      voiePostaleDemandee: false,
      copieEnvois: true,
      conseilSyndical: SANS_CONSEIL_SYNDICAL,
      extranet: EXTRANET_PUBLIE,
      notes: '',
      avertissement: "Plan d'apurement en cours : ne pas relancer avant la prochaine échéance.",
    },
  },
  {
    id: 'P3',
    nom: 'Karim Benali',
    copro: 'Le Clos des Vignes',
    lot: 'Lot 5 — Apt 1B',
    tantiemes: '276/10000',
    solde: -620,
    statut: 'Retard',
    pill: 'amber',
    tel: '07 60 18 22 41',
    mail: 'k.benali@email.fr',
    locataire: {
      nom: 'Petit',
      prenom: 'Camille',
      tel: '07 52 09 36 14',
      mail: 'camille.petit@email.fr',
    },
    fiche: {
      civilite: 'Monsieur',
      prenom: 'Karim',
      nomFamille: 'Benali',
      adresse: '14 rue Paradis',
      codePostal: '13001',
      ville: 'Marseille',
      pays: 'France',
      numeroCompte: '00005',
      statutCompte: 'En place',
      mandat: MANDAT_DEMO,
      situation: '1er étage',
      formePropriete: 'Pleine propriété',
      personnes: [{ identite: 'Karim Benali', relation: 'Copropriétaire', part: '1/1' }],
      autresTelecoms: [{ type: 'Courriel', nature: 'Professionnel', prefere: false, valeur: 'karim.benali@entreprise.fr' }],
      lots: [{ lot: 'Lot 5 — Apt 1B', occupation: 'Loué', nature: 'Appartement' }],
      cles: [{ cle: 'Charges générales', tantiemes: '276/10000' }],
      voiePostaleDemandee: false,
      copieEnvois: true,
      conseilSyndical: SANS_CONSEIL_SYNDICAL,
      extranet: EXTRANET_PUBLIE,
      notes: '',
      avertissement: null,
    },
  },
  {
    id: 'P4',
    nom: 'Inès Lefèvre',
    copro: 'Résidence Le Méridien',
    lot: 'Lot 31 — Apt C2',
    tantiemes: '350/10000',
    solde: 0,
    statut: 'À jour',
    pill: 'sage',
    tel: '06 84 55 12 33',
    mail: 'ines.lefevre@email.fr',
    locataire: null,
    fiche: {
      civilite: 'Madame',
      prenom: 'Inès',
      nomFamille: 'Lefèvre',
      adresse: 'Résidence Le Méridien, bât. C',
      codePostal: '13008',
      ville: 'Marseille',
      pays: 'France',
      numeroCompte: '00031',
      statutCompte: 'En place',
      mandat: MANDAT_DEMO,
      situation: 'Bât. C, 2e étage',
      formePropriete: 'Pleine propriété',
      personnes: [{ identite: 'Inès Lefèvre', relation: 'Copropriétaire', part: '1/1' }],
      autresTelecoms: [],
      lots: [
        { lot: 'Lot 31 — Apt C2', occupation: 'Résident', nature: 'Appartement' },
        { lot: 'Lot 64 — Cave', occupation: 'Résident', nature: 'Cave' },
      ],
      cles: [
        { cle: 'Charges générales', tantiemes: '350/10000' },
        { cle: 'Ascenseur bât. C', tantiemes: '44/1000' },
      ],
      voiePostaleDemandee: false,
      copieEnvois: true,
      conseilSyndical: { membre: true, president: true, correspondant: false },
      extranet: { publie: true, acces: true, telephoneVisible: true },
      notes: 'Présidente du conseil syndical.',
      avertissement: null,
    },
  },
  {
    id: 'P5',
    nom: 'SCI Belvédère',
    copro: 'Copropriété Les Tilleuls',
    lot: 'Lots 8-9 — Local',
    tantiemes: '640/10000',
    solde: -9200,
    statut: 'Contentieux',
    pill: 'rust',
    tel: '01 47 02 88 10',
    mail: 'gestion@sci-belvedere.fr',
    locataire: {
      nom: 'Lambert',
      prenom: 'Nadia',
      tel: '04 91 56 21 70',
      mail: 'n.lambert@email.fr',
    },
    fiche: {
      civilite: 'S.C.I.',
      prenom: null,
      nomFamille: 'SCI Belvédère',
      adresse: '3 boulevard Haussmann',
      codePostal: '75009',
      ville: 'Paris',
      pays: 'France',
      numeroCompte: '00008',
      statutCompte: 'En place',
      mandat: MANDAT_DEMO,
      situation: 'Rez-de-chaussée',
      formePropriete: 'Pleine propriété',
      personnes: [{ identite: 'SCI Belvédère', relation: 'Copropriétaire', part: '1/1' }],
      autresTelecoms: [],
      lots: [
        { lot: 'Lot 8 — Local', occupation: 'Loué', nature: 'Local commercial' },
        { lot: 'Lot 9 — Local', occupation: 'Loué', nature: 'Local commercial' },
      ],
      cles: [{ cle: 'Charges générales', tantiemes: '640/10000' }],
      voiePostaleDemandee: false,
      copieEnvois: false,
      conseilSyndical: SANS_CONSEIL_SYNDICAL,
      extranet: { publie: false, acces: false, telephoneVisible: false },
      notes: '',
      avertissement: "Compte au contentieux : tout échange passe par l'avocat du syndicat.",
    },
  },
  {
    id: 'P6',
    nom: 'Hélène Dubois',
    copro: 'Villa Montaigne',
    lot: 'Lot 4 — Apt 2A',
    tantiemes: '820/10000',
    solde: 0,
    statut: 'À jour',
    pill: 'sage',
    tel: '06 33 77 41 09',
    mail: 'h.dubois@email.fr',
    locataire: null,
    fiche: {
      civilite: 'Madame',
      prenom: 'Hélène',
      nomFamille: 'Dubois',
      adresse: '2 avenue Montaigne',
      codePostal: '13100',
      ville: 'Aix-en-Provence',
      pays: 'France',
      numeroCompte: '00004',
      statutCompte: 'En place',
      mandat: MANDAT_DEMO,
      situation: '2e étage',
      formePropriete: 'Usufruit',
      personnes: [
        { identite: 'Hélène Dubois', relation: 'Usufruitier', part: '1/1' },
        { identite: 'Claire Dubois', relation: 'Nu propriétaire', part: '1/1' },
      ],
      autresTelecoms: [],
      lots: [{ lot: 'Lot 4 — Apt 2A', occupation: 'Résident', nature: 'Appartement' }],
      cles: [{ cle: 'Charges générales', tantiemes: '820/10000' }],
      voiePostaleDemandee: false,
      copieEnvois: true,
      conseilSyndical: { membre: true, president: false, correspondant: true },
      extranet: EXTRANET_PUBLIE,
      notes: '',
      avertissement: null,
    },
  },
  {
    id: 'P7',
    nom: 'Antoine Rousseau',
    copro: 'Copropriété Les Tilleuls',
    lot: 'Lot 14 — Apt 3C',
    tantiemes: '395/10000',
    solde: -2480,
    statut: 'Impayé',
    pill: 'rust',
    tel: '07 81 24 60 55',
    mail: 'a.rousseau@email.fr',
    locataire: {
      nom: 'Girard',
      prenom: 'Thomas',
      tel: '06 71 30 84 52',
      mail: 't.girard@email.fr',
    },
    fiche: {
      civilite: 'Monsieur',
      prenom: 'Antoine',
      nomFamille: 'Rousseau',
      adresse: '9 rue des Tilleuls',
      codePostal: '83000',
      ville: 'Toulon',
      pays: 'France',
      numeroCompte: '00014',
      statutCompte: 'En place',
      mandat: MANDAT_DEMO,
      situation: '3e étage',
      formePropriete: 'Pleine propriété',
      personnes: [{ identite: 'Antoine Rousseau', relation: 'Copropriétaire', part: '1/1' }],
      autresTelecoms: [],
      lots: [{ lot: 'Lot 14 — Apt 3C', occupation: 'Loué', nature: 'Appartement' }],
      cles: [{ cle: 'Charges générales', tantiemes: '395/10000' }],
      voiePostaleDemandee: true,
      copieEnvois: true,
      conseilSyndical: SANS_CONSEIL_SYNDICAL,
      extranet: { publie: true, acces: false, telephoneVisible: false },
      notes: 'A demandé à recevoir les notifications par voie postale.',
      avertissement: null,
    },
  },
  {
    id: 'P8',
    nom: 'Mathilde Faure',
    copro: 'Résidence Le Méridien',
    lot: 'Lot 7 — Apt A1',
    tantiemes: '288/10000',
    solde: 0,
    statut: 'À jour',
    pill: 'sage',
    tel: '06 19 44 72 88',
    mail: 'm.faure@email.fr',
    locataire: null,
    fiche: {
      civilite: 'Indivision',
      prenom: null,
      nomFamille: 'Indivision Faure',
      adresse: 'Résidence Le Méridien, bât. A',
      codePostal: '13008',
      ville: 'Marseille',
      pays: 'France',
      numeroCompte: '00007',
      statutCompte: 'En place',
      mandat: MANDAT_DEMO,
      situation: 'Bât. A, rez-de-chaussée',
      formePropriete: 'Indivision',
      personnes: [
        { identite: 'Mathilde Faure', relation: 'Indivisaire', part: '1/2' },
        { identite: 'Paul Faure', relation: 'Indivisaire', part: '1/2' },
      ],
      autresTelecoms: [{ type: 'Mobile', nature: 'Indivisaire', prefere: false, valeur: '06 58 90 13 27' }],
      lots: [{ lot: 'Lot 7 — Apt A1', occupation: 'Résident', nature: 'Appartement' }],
      cles: [{ cle: 'Charges générales', tantiemes: '288/10000' }],
      voiePostaleDemandee: false,
      copieEnvois: true,
      conseilSyndical: SANS_CONSEIL_SYNDICAL,
      extranet: EXTRANET_PUBLIE,
      notes: 'Mandataire commun des indivisaires : Mathilde Faure.',
      avertissement: null,
    },
  },
]
