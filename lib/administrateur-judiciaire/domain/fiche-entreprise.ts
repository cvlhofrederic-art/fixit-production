import { ajouterJours, ajouterMois, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { VALIDITE_VIGILANCE_MOIS } from '@/lib/administrateur-judiciaire/domain/vigilance-entreprises'

/**
 * Fiche d'une entreprise (prestataire), sur le modèle de la fiche Entreprise de Gestéam :
 * - tranche 37 § Entreprises : N°, Type, Nom, Préfixe (forme juridique), Adresse, Référence, contacts (contact, service,
 *   agence · civilité · fonction), télécoms, compétences et interventions pour les mandats (domaines, exclure, notes) ;
 *   onglet Informations : règlement (mode, délai, « 1 virement par », priorité), banque, RCS, TVA intracommunautaire,
 *   attestations RC décennale et RCP, Webteam ;
 * - tranche 39 : onglet Demandes et réglages de relance par service (devis, interventions : délai de relance, nombre
 *   maximum de demandes en cours, seuil d'alerte).
 * Les échéances RC décennale et RCP restent portées par Prestataire (rcDecennaleEcheance, rcpEcheance, tranche 15).
 * 🔵 Seuil d'alerte « échoit bientôt » : choix d'affichage, sans texte.
 */

export interface ContactEntreprise {
  /** Contact, service ou agence. */
  nom: string
  civilite: string | null
  fonction: string
}

export interface TelecomEntreprise {
  type: 'Courriel' | 'Téléphone' | 'Mobile' | 'Site web'
  nature: string
  prefere: boolean
  valeur: string
}

export interface ReglementEntreprise {
  mode: 'Virement' | 'Chèque' | 'Prélèvement'
  /** Délai de paiement, en jours à compter de la date de facture. */
  delaiJours: number
  /** Gestéam « 1 virement par » : une facture ou un mandat. */
  unVirementPar: 'Facture' | 'Mandat'
  /** Gestéam « Priorité » : 1 la plus forte. */
  priorite: number
  iban: string | null
  bic: string | null
}

/** Réglages de relance d'un service (tranche 39). */
export interface RelanceEntreprise {
  delaiRelanceJours: number
  maxDemandesEnCours: number
  alerteAuDela: number
}

/** Demande, devis ou courrier adressé à l'entreprise. */
export interface DemandeEntreprise {
  date: string
  nature: 'Demande' | 'Devis' | 'Courrier'
  copropriete: string
  objet: string
}

export interface FicheEntreprise {
  numero: string
  /** TYPE_ENTREPRISE (Fournisseur, Architecte…). */
  type: string
  statut: 'Active' | 'Inactive'
  formeJuridique: string
  reference: string
  adresse: string
  codePostal: string
  pays: string
  tvaIntracommunautaire: string
  rcs: string
  contacts: ContactEntreprise[]
  telecoms: TelecomEntreprise[]
  /** Attestation de vigilance (URSSAF) remise le ; null : non fournie. */
  vigilanceLe: string | null
  /** Extrait Kbis remis le ; null : non fourni. */
  kbisLe: string | null
  domaines: string[]
  intervientPour: string[]
  exclueDe: string[]
  reglement: ReglementEntreprise
  relances: { devis: RelanceEntreprise; interventions: RelanceEntreprise }
  demandes: DemandeEntreprise[]
  notes: string
  extranet: { publie: boolean; acces: boolean }
}

export interface EtatAttestation {
  etat: 'Non fournie' | 'Échue' | 'Échoit bientôt' | 'À jour' | 'À renouveler'
  /** Dernier jour de validité (assurance) ou date avant laquelle renouveler (vigilance) ; null : non fournie. */
  jusquAu: string | null
}

export const SEUIL_ALERTE_ASSURANCE_JOURS = 30

const verifierDate = (date: string) => {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
}

/** Attestation d'assurance valable jusqu'au `au` inclus, lue à la date `date`. */
export function etatAssurance(au: string | null, date: string): EtatAttestation {
  verifierDate(date)
  if (au === null) return { etat: 'Non fournie', jusquAu: null }
  verifierDate(au)
  if (au < date) return { etat: 'Échue', jusquAu: au }
  if (au <= ajouterJours(date, SEUIL_ALERTE_ASSURANCE_JOURS)) return { etat: 'Échoit bientôt', jusquAu: au }
  return { etat: 'À jour', jusquAu: au }
}

/** Attestation de vigilance remise le `le` : à renouveler à partir de `le` + 6 mois (même règle que vigilance-entreprises). */
export function etatVigilance(le: string | null, date: string): EtatAttestation {
  verifierDate(date)
  if (le === null) return { etat: 'Non fournie', jusquAu: null }
  verifierDate(le)
  const limite = ajouterMois(le, VALIDITE_VIGILANCE_MOIS)
  return { etat: date < limite ? 'À jour' : 'À renouveler', jusquAu: limite }
}

/** Fiche complétée des valeurs par défaut (réglages de relance et de règlement courants, aucune pièce). */
export function nouvelleFicheEntreprise(propre: Partial<FicheEntreprise> = {}): FicheEntreprise {
  return {
    numero: '',
    type: 'Fournisseur',
    statut: 'Active',
    formeJuridique: '',
    reference: '',
    adresse: '',
    codePostal: '',
    pays: 'France',
    tvaIntracommunautaire: '',
    rcs: '',
    contacts: [],
    telecoms: [],
    vigilanceLe: null,
    kbisLe: null,
    domaines: [],
    intervientPour: [],
    exclueDe: [],
    reglement: { mode: 'Virement', delaiJours: 30, unVirementPar: 'Facture', priorite: 2, iban: null, bic: null },
    relances: {
      devis: { delaiRelanceJours: 8, maxDemandesEnCours: 5, alerteAuDela: 4 },
      interventions: { delaiRelanceJours: 3, maxDemandesEnCours: 10, alerteAuDela: 8 },
    },
    demandes: [],
    notes: '',
    extranet: { publie: true, acces: false },
    ...propre,
  }
}

/** Télécom préféré du genre donné (courriel, ou téléphone fixe ou mobile) ; '' si aucun. */
export function telecomPrefere(telecoms: readonly TelecomEntreprise[], genre: 'Courriel' | 'Téléphone'): string {
  const duGenre = (telecom: TelecomEntreprise) => (genre === 'Courriel' ? telecom.type === 'Courriel' : telecom.type === 'Téléphone' || telecom.type === 'Mobile')
  return telecoms.find((telecom) => telecom.prefere && duGenre(telecom))?.valeur ?? ''
}

function typeTelecom(genre: 'Courriel' | 'Téléphone', valeur: string): TelecomEntreprise['type'] {
  if (genre === 'Courriel') return 'Courriel'
  return /^0[67]/.test(valeur) ? 'Mobile' : 'Téléphone'
}

/**
 * Remplace le télécom préféré du genre donné par `valeur` (retiré si vide) ; les autres télécoms sont gardés.
 * Un téléphone 06 / 07 est un mobile.
 */
export function avecTelecomPrefere(
  telecoms: readonly TelecomEntreprise[],
  genre: 'Courriel' | 'Téléphone',
  valeur: string,
): TelecomEntreprise[] {
  const ancienne = telecomPrefere(telecoms, genre)
  const autres = telecoms.filter((telecom) => !(telecom.prefere && telecom.valeur === ancienne && ancienne !== ''))
  const propre = valeur.trim()
  if (propre === '') return autres
  return [{ type: typeTelecom(genre, propre), nature: 'Général', prefere: true, valeur: propre }, ...autres]
}

/** IBAN affiché : quatre premiers et quatre derniers caractères, le reste masqué. */
export function masquerIban(iban: string | null): string {
  if (!iban) return ''
  const compact = iban.replace(/\s+/g, '').toUpperCase()
  if (compact.length <= 8) return '••••'
  return `${compact.slice(0, 4)} •••• •••• •••• ${compact.slice(-4)}`
}
