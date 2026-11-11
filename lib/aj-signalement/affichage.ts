// ── Libellés et calculs d'affichage du tableau de bord « AJ Signalement » ─────
//
// Fonctions pures, sans React, partagées par l'espace « AJ Signalement » du super admin (/fr/aj-signalement/)
// et l'e-mail envoyé à l'administrateur. Textes en français : l'administrateur est un outil français ; la
// page publique, elle, est FR / PT (textes.ts).

import {
  numeroSignalementQr, type CoproprieteQr, type LangueSignalementQr, type PrioriteSignalementQr, type QualiteDeclarantQr, type SignalementQr,
  type StatutSignalementQr,
} from '@/lib/aj-signalement/types'
import type { CodeErreurQr } from '@/lib/aj-signalement/api'
import { remplir } from '@/lib/coproprietaire/textes'

/** Migration à appliquer en production pour que les tables existent (message d'erreur « base_absente »). */
export const MIGRATION_QR = 'supabase/migrations/20261104_signalements_qr.sql'

export const LIBELLE_STATUT_QR: Record<StatutSignalementQr, string> = {
  en_attente: 'À traiter',
  acceptee: 'Pris en charge',
  en_cours: 'En cours',
  terminee: 'Résolu',
  annulee: 'Classé sans suite',
}

export const LIBELLE_PRIORITE_QR: Record<PrioriteSignalementQr, string> = {
  urgente: 'Urgent',
  normale: 'Normal',
  planifiee: 'À planifier',
}

/** Teinte de la pastille de statut (socle UI du portail copropriétaire). */
export type TonStatutQr = 'ambre' | 'bleu' | 'vert' | 'gris'
export const TON_STATUT_QR: Record<StatutSignalementQr, TonStatutQr> = {
  en_attente: 'ambre',
  acceptee: 'bleu',
  en_cours: 'bleu',
  terminee: 'vert',
  annulee: 'gris',
}

/** Transitions proposées depuis chaque statut : libellé du bouton et statut cible. */
export const ACTIONS_STATUT_QR: Record<StatutSignalementQr, ReadonlyArray<{ libelle: string; statut: StatutSignalementQr }>> = {
  en_attente: [
    { libelle: 'Prendre en charge', statut: 'acceptee' },
    { libelle: 'Marquer résolu', statut: 'terminee' },
    { libelle: 'Classer sans suite', statut: 'annulee' },
  ],
  acceptee: [
    { libelle: 'Intervention en cours', statut: 'en_cours' },
    { libelle: 'Marquer résolu', statut: 'terminee' },
    { libelle: 'Classer sans suite', statut: 'annulee' },
  ],
  en_cours: [
    { libelle: 'Marquer résolu', statut: 'terminee' },
    { libelle: 'Classer sans suite', statut: 'annulee' },
  ],
  terminee: [{ libelle: 'Rouvrir', statut: 'en_attente' }],
  annulee: [{ libelle: 'Rouvrir', statut: 'en_attente' }],
}

/** « Parties communes — Hall d’entrée » ou « Logement (bât. B, étage 4, lot 12) ». */
export function lieuSignalementQr(s: Pick<SignalementQr, 'estPartieCommune' | 'zoneSignalee' | 'batiment' | 'etage' | 'numLot'>): string {
  if (s.estPartieCommune) return s.zoneSignalee ? `Parties communes — ${s.zoneSignalee}` : 'Parties communes'
  const parties = [
    s.batiment ? `bât. ${s.batiment}` : '',
    s.etage ? `étage ${s.etage}` : '',
    s.numLot ? `lot ${s.numLot}` : '',
  ].filter(Boolean)
  return parties.length > 0 ? `Logement (${parties.join(', ')})` : 'Logement'
}

/** « Prénom Nom ». */
export const nomDeclarantQr = (s: Pick<SignalementQr, 'prenom' | 'nom'>): string => `${s.prenom} ${s.nom}`.trim()

export const LIBELLE_QUALITE_QR: Record<QualiteDeclarantQr, string> = {
  proprietaire: 'Propriétaire',
  locataire: 'Locataire',
}

/** Qualité du déclarant ; « Non indiquée » pour les signalements déposés avant le 06/11/2026. */
export const libelleQualiteQr = (qualite: QualiteDeclarantQr | null): string => (qualite ? LIBELLE_QUALITE_QR[qualite] : 'Non indiquée')

/** « Même problème que le signalement n° 1A2B3C4D » ; '' sans signalement lié. */
export const texteSignalementLieQr = (id: string | null): string =>
  (id ? remplir(TEXTES_TABLEAU_QR.memeProbleme, { numero: numeroSignalementQr(id) }) : '')

/** « bât. B · étage 4 · lot 12 », sans les parties vides. */
export function situationLotQr(s: Pick<SignalementQr, 'batiment' | 'etage' | 'numLot'>): string {
  return [
    s.batiment ? `bât. ${s.batiment}` : '',
    s.etage ? `étage ${s.etage}` : '',
    s.numLot ? `lot ${s.numLot}` : '',
  ].filter(Boolean).join(' · ')
}

const LOCALE_DATE_QR: Record<LangueSignalementQr, string> = { fr: 'fr-FR', pt: 'pt-PT' }

/**
 * « 4 novembre 2026 à 14:05 » / « 4 de novembro de 2026 às 14:05 », toujours à l'heure de Paris (le serveur
 * Cloudflare est en UTC) ; la chaîne brute si la date est illisible.
 */
export function dateHeureParis(iso: string, langue: LangueSignalementQr = 'fr'): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(LOCALE_DATE_QR[langue], { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' }).format(date)
}

/** Détail du tableau : « Confirmation envoyée au déclarant le … » ou « Confirmation non envoyée au déclarant : … ». */
export function etatConfirmationQr(s: Pick<SignalementQr, 'confirmationEnvoyeeLe' | 'confirmationErreur'>): string {
  const d = TEXTES_TABLEAU_QR.detail
  if (s.confirmationEnvoyeeLe) return remplir(d.confirmationEnvoyee, { date: dateHeureParis(s.confirmationEnvoyeeLe) })
  if (s.confirmationErreur) return remplir(d.confirmationNonEnvoyee, { erreur: s.confirmationErreur })
  // Dépôts antérieurs à la confirmation (colonnes nulles), ou état non enregistré.
  return d.confirmationAbsente
}

export interface CompteursTableauQr {
  total: number
  aTraiter: number
  enCours: number
  resolus: number
}

/** Indicateurs du tableau : reçus, à traiter (reçus non traités), en cours (pris en charge ou en cours), résolus. */
export function compteursTableauQr(signalements: readonly SignalementQr[]): CompteursTableauQr {
  return {
    total: signalements.length,
    aTraiter: signalements.filter((s) => s.statut === 'en_attente').length,
    enCours: signalements.filter((s) => s.statut === 'acceptee' || s.statut === 'en_cours').length,
    resolus: signalements.filter((s) => s.statut === 'terminee').length,
  }
}

/** Signalements d'une copropriété (tous quand aucune n'est choisie), du plus récent au plus ancien. */
export function filtrerSignalementsQr(signalements: readonly SignalementQr[], coproprieteId: string): SignalementQr[] {
  const choisis = coproprieteId ? signalements.filter((s) => s.coproprieteId === coproprieteId) : [...signalements]
  return choisis.sort((a, b) => b.creeLe.localeCompare(a.creeLe))
}

/** « 3 signalements · 1 à traiter », « 1 signalement », « Aucun signalement ». */
export function resumeCompteursQr(c: Pick<CoproprieteQr, 'nbSignalements' | 'nbEnAttente'>): string {
  if (c.nbSignalements === 0) return 'Aucun signalement'
  const total = c.nbSignalements === 1 ? '1 signalement' : `${c.nbSignalements} signalements`
  return c.nbEnAttente > 0 ? `${total} · ${c.nbEnAttente} à traiter` : total
}

/** Destinataires affichés sur la carte d'une copropriété. */
export function destinatairesAffichesQr(c: Pick<CoproprieteQr, 'emailsDestinataires'>): string {
  return c.emailsDestinataires.length > 0 ? c.emailsDestinataires.join(', ') : TEXTES_TABLEAU_QR.destinatairesDefaut
}

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/

/** Adresses saisies (virgules, points-virgules ou espaces), dédoublonnées en minuscules ; les invalides à part. */
export function analyserEmailsQr(saisie: string): { emails: string[]; invalides: string[] } {
  const emails: string[] = []
  const invalides: string[] = []
  for (const brut of saisie.split(/[,;\s]+/)) {
    const propre = brut.trim().toLowerCase()
    if (!propre) continue
    if (EMAIL_VALIDE.test(propre)) {
      if (!emails.includes(propre)) emails.push(propre)
    } else {
      invalides.push(brut.trim())
    }
  }
  return { emails, invalides }
}

/** Message d'une erreur d'appel du tableau de bord. */
export function messageErreurTableauQr(code: CodeErreurQr): string {
  return TEXTES_TABLEAU_QR.erreurs[code]
}

/** Textes du tableau de bord (français). */
export const TEXTES_TABLEAU_QR = {
  titre: 'AJ Signalement',
  intro: 'Chaque copropriété a son QR code. Affiché sur place, il ouvre un formulaire de signalement : la personne laisse ses coordonnées (obligatoires) et décrit le problème ; vous recevez chaque signalement par e-mail et il reste conservé ici. Aucun lien avec le logiciel Syndic.',
  chargement: 'Chargement des signalements…',
  indicateurs: 'Indicateurs',
  reessayer: 'Réessayer',
  mettreAJour: 'Mettre à jour',
  derniereMiseAJour: 'Dernière mise à jour à {heure}',
  kpis: { recus: 'Reçus', aTraiter: 'À traiter', enCours: 'En cours', resolus: 'Résolus' },
  coproprietes: 'Copropriétés et QR codes',
  ajouterCopro: 'Ajouter une copropriété',
  aucuneCopro: 'Aucune copropriété pour le moment : ajoutez-en une pour obtenir son QR code.',
  lien: 'Lien ouvert par le QR code',
  copierLien: 'Copier le lien',
  lienCopie: 'Lien copié',
  destinataires: 'E-mails envoyés à :',
  destinatairesDefaut: 'l’adresse de l’administrateur (par défaut)',
  affichePdf: 'Télécharger l’affiche (PDF)',
  qrPng: 'Télécharger le QR code (PNG)',
  modifier: 'Modifier',
  preparation: 'Préparation…',
  erreurFichier: 'Le fichier n’a pas pu être préparé. Réessayez.',
  libelleQr: 'QR code de la copropriété {nom}',
  qrDesactive: 'QR code désactivé',
  sansAdresse: 'Adresse non renseignée',
  derniereAdresseProposee: 'Dernière adresse proposée d’après la position d’un déclarant ({date}) : {adresse}',
  utiliserAdresse: 'Utiliser cette adresse',
  enregistrementAdresse: 'Enregistrement…',
  adresseEnregistree: 'Adresse enregistrée.',
  erreurAdresse: 'L’adresse n’a pas pu être enregistrée. Réessayez.',
  memeProbleme: 'Même problème que le signalement n° {numero}',
  signalements: 'Signalements reçus',
  aucunSignalement: 'Aucun signalement reçu pour le moment.',
  aucunSignalementFiltre: 'Aucun signalement pour cette copropriété.',
  toutesCopros: 'Toutes les copropriétés',
  filtrerCopro: 'Copropriété',
  voirDetail: 'Voir le détail',
  fermerFenetre: 'Fermer la fenêtre',
  urgent: 'Urgent',
  detail: {
    titre: 'Signalement {numero}',
    declarant: 'Déclarant',
    qualite: 'Qualité',
    signalementLie: 'Signalement lié',
    adresseProposee: 'Adresse proposée (position du déclarant)',
    telephone: 'Téléphone',
    email: 'E-mail',
    lot: 'Lot',
    copropriete: 'Copropriété',
    lieu: 'Lieu du problème',
    type: 'Type de problème',
    urgence: 'Urgence',
    deposeLe: 'Déposé le',
    description: 'Description',
    emailEnvoye: 'E-mail reçu le {date}.',
    emailNonEnvoye: 'E-mail non envoyé : {erreur}.',
    confirmationEnvoyee: 'Confirmation envoyée au déclarant le {date}.',
    confirmationNonEnvoyee: 'Confirmation non envoyée au déclarant : {erreur}.',
    confirmationAbsente: 'Confirmation non envoyée au déclarant.',
    statut: 'Statut',
    fermer: 'Fermer',
    erreurStatut: 'Le statut n’a pas pu être modifié. Réessayez.',
  },
  formulaire: {
    creer: 'Nouvelle copropriété',
    modifier: 'Modifier la copropriété',
    nom: 'Nom de la copropriété',
    adresse: 'Adresse (facultatif)',
    emails: 'E-mails destinataires (facultatif)',
    emailsAide: 'Séparés par des virgules ; vide = adresse de l’administrateur.',
    actif: 'QR code actif (les scans sont acceptés)',
    enregistrer: 'Enregistrer',
    creerBouton: 'Créer et obtenir le QR code',
    annuler: 'Annuler',
    nomRequis: 'Indiquez le nom de la copropriété.',
    emailsInvalides: 'Adresse(s) invalide(s) : {liste}',
    remplacerQr: 'Remplacer le QR code',
    remplacerQrAide: 'L’ancien QR code imprimé ne répondra plus : il faudra réimprimer l’affiche.',
    confirmerRemplacer: 'Oui, remplacer le QR code',
    qrRemplace: 'Nouveau QR code créé : téléchargez la nouvelle affiche.',
    erreur: 'Enregistrement impossible. Réessayez.',
  },
  erreurs: {
    non_authentifie: 'Connectez-vous avec le compte super admin pour voir les signalements.',
    interdit: 'Cet écran est réservé au super admin.',
    base_absente: `La base n’est pas encore prête : exécutez la migration ${MIGRATION_QR} dans Supabase (SQL Editor), puis rechargez cette page.`,
    serveur: 'Impossible de charger les signalements pour le moment. Réessayez.',
    reseau: 'Connexion impossible : vérifiez votre réseau puis réessayez.',
    trop_de_demandes: 'Trop de demandes en peu de temps : patientez une minute.',
    invalide: 'Demande refusée par le serveur : vérifiez la saisie.',
    introuvable: 'Élément introuvable (déjà supprimé ?). Mettez à jour la page.',
  } satisfies Record<CodeErreurQr, string>,
} as const
