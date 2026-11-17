import { dateIsoVersFr, ecartJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  controlerFacture,
  lireFacture,
  type AnomalieFacture,
  type FactureLue,
  type ImputationProposee,
} from '@/lib/administrateur-judiciaire/domain/imputation-facture'
import { normaliserEspaces, normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Circuit de numérisation des factures fournisseurs : statut OCR de la pièce numérisée, lecture, identification,
 * association à une facture saisie, non-association, report. Point 41 du bilan 2 des écarts Gestéam → VitFix
 * (« Factures : dématérialisation (OCR) »), partie métier seulement. Fonctions pures, montants en CENTIMES ENTIERS, dates
 * ISO (AAAA-MM-JJ). Aucun appel réseau, aucune IA, aucun moteur de lecture : le module reçoit un « texte lu » déjà
 * produit. C'est l'amont de facture-ventilee.ts (ventilation, écriture) et de statuts-facture.ts (règlement).
 *
 * Sources Gestéam (consultation en lecture seule, aucune pièce ouverte) :
 * - 🟢 tranche 43 § 20 (28/10/2026, version 5.4.23) : « Factures → 2.2 CONSULTER les DOCUMENTS des factures » ouvre la
 *   recherche de documents préfiltrée sur le type « Facture / avoir fournisseur » et sur la corbeille de numérisation de
 *   l'utilisateur. Le critère « Statut OCR » a huit valeurs, dans cet ordre : En erreur · À scanner · Extrait ·
 *   Identifié · Traduit · Non associé · Associé · Reporté. Le relevé décrit le circuit : pièce numérisée dans une
 *   corbeille, puis OCR (extraite, identifiée, traduite en écriture), puis associée à une facture saisie (ou non
 *   associée, reportée, en erreur) ;
 * - 🟢 même écran : deux autres critères, Statut (En attente · À traiter · Terminé) et Suivi (À voir · À suivre ·
 *   Urgent). Ce sont d'autres champs : ils ne se fondent pas dans le statut OCR (06_PIEGES § 4) et restent hors module ;
 * - 🟢 tranche 40 (menu Outils) : « Voir mes corbeilles » ouvre un dossier réseau par utilisateur ; 🔵 « Relever mes
 *   corbeilles » importerait les pièces dans la GED (action non lancée). 🟢 Tranche 18 : « Corbeille » est un critère de
 *   la recherche de documents ;
 * - ⚪ tranches 33, 37 et 39 : une case ou un bouton « OCR » sur la fiche contrat (onglet Facturation, « lecture des
 *   factures ») et sur la fiche entreprise (onglet Informations). Valeurs non relevées : rien n'en est modélisé.
 *
 * Sens des statuts (REFERENTIEL_STATUTS_OCR, champ « certitude ») :
 * - 🟢 relevé : Associé (pièce associée à une facture saisie) ;
 * - 🔵 déduit des libellés et du circuit : En erreur, Extrait, Identifié, Traduit, Non associé, Reporté ;
 * - 🔴 non établi : À scanner. Le relevé ne dit pas s'il s'agit d'un papier à numériser ou d'un fichier en attente de
 *   lecture. VitFix n'en retient que « texte pas encore lu ».
 *
 * 🔵 Règles déduites (choix de ce module, à valider par Hugo) :
 * - chemin : À scanner → Extrait → Identifié → (Traduit) → Associé ou Non associé. En erreur et Reporté sont des
 *   branches. Associé est le seul statut final (« suivants » de REFERENTIEL_STATUTS_OCR) ;
 * - Extrait : le texte lu passe par lireFacture (imputation-facture.ts). Un texte vide mène à « En erreur ». Le texte vient
 *   d'une couche texte de PDF ou d'un moteur OCR (origine notée, outil en clair), sans dépendance à un moteur ;
 * - Identifié : controlerFacture ne relève aucune absence bloquante. Bloquent : le numéro, la date, le montant TTC, et
 *   l'absence à la fois du fournisseur et du SIRET. Les autres anomalies (total incohérent, TVA, montant HT, SIRET seul)
 *   restent « à vérifier » ;
 * - Traduit : un compte de charge est retenu (proposerImputation, revu par le gestionnaire). Une proposition « à
 *   compléter » est refusée. L'écriture elle-même se passe sur la facture saisie (facture-ventilee.ts). Traduit n'est pas
 *   exigé avant l'association ;
 * - correction de la lecture : permise avant l'association. La pièce revient en « Extrait » : identification à refaire ;
 * - association : jamais automatique. proposerFacturesCandidates liste les factures saisies qui concordent au moins sur
 *   le fournisseur (SIRET, sinon nom), le numéro ou le montant TTC ; la date seule ne suffit pas. Tri : critères
 *   concordants (le plus d'abord), puis critères discordants (le moins d'abord). Chaque critère est expliqué.
 *   Comparaison exacte, sans tolérance : montant au centime, date au jour, numéro sans casse, accents, espaces ni
 *   séparateurs ;
 * - association refusée : pièce déjà associée ; facture déjà liée à une autre pièce ; facture d'une autre copropriété ;
 *   doublon (une autre pièce, même fournisseur et même numéro, est déjà associée). Un critère discordant exige un motif ;
 * - non-association : motif obligatoire. La pièce pourra être associée plus tard (Non associé n'est pas final) ;
 * - report : date de reprise (après le jour du report) ou motif. La reprise ramène au statut d'avant le report ; avant
 *   elle, aucune autre action n'est permise ;
 * - doublon : même fournisseur et même numéro (fondement ci-dessous) ;
 * - chaque changement est daté (historique), jamais avant le changement précédent.
 *
 * Droit (textes lus sur Légifrance le 17/11/2026) :
 * - CGI, annexe II, art. 242 nonies A, I, 7° (version en vigueur depuis le 01/01/2025) : la facture porte « un numéro
 *   unique basé sur une séquence chronologique et continue » ; des séries distinctes sont permises si l'activité le
 *   justifie. https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050811276 ;
 * - CGI, art. 289 bis (version en vigueur depuis le 21/02/2026, modifiée par la loi n° 2026-103 du 19/02/2026, art. 123 ;
 *   la page signale son abrogation par l'ordonnance n° 2025-1247 du 17/12/2025, art. 9) : facture électronique quand
 *   l'émetteur et le destinataire sont des assujettis établis en France.
 *   https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046195635 . 🔴 Non établi : le syndicat, non assujetti à
 *   la TVA (imputation-facture.ts), reçoit-il des factures électroniques par cette voie ? Si oui, leurs données
 *   structurées remplaceraient l'OCR pour ces factures. Aucune règle n'en est tirée ici.
 *
 * 🔴 Questions ouvertes :
 * - Hugo : sens de « À scanner » ; « Non associé » est-il final dans Gestéam ? Une association erronée se défait-elle
 *   (ici : non, Associé est final) ? Faut-il une tolérance sur le montant ou la date ? « Traduit » est-il exigé avant
 *   l'association ? Rôle de la case « OCR » des fiches entreprise et contrat ?
 * - Frédéric : écrans (corbeille, liste des candidates, association) ; rien n'est fait.
 *
 * Hors périmètre : moteur OCR (prestataire à choisir ; aucun n'est branché) ; écrans (Frédéric) ; enregistrement en base
 * (aucune table, aucune version Dexie, aucune migration ; DocumentLocal et Facture de db/schema.ts inchangés) ; écriture
 * comptable (facture-ventilee.ts) ; statuts de saisie et de règlement de la facture (statuts-facture.ts).
 */

// ─── Statuts OCR (Gestéam, tranche 43 § 20) ──────────────────────────────────────────────────

/** Critère « Statut OCR » de Gestéam : huit valeurs, dans l'ordre du relevé (🟢 tranche 43 § 20). */
export const STATUTS_OCR = ['En erreur', 'À scanner', 'Extrait', 'Identifié', 'Traduit', 'Non associé', 'Associé', 'Reporté'] as const
export type StatutOcr = (typeof STATUTS_OCR)[number]

/** Certitude du sens retenu : 🟢 relevé, 🔵 déduit, 🔴 non établi. */
export const CERTITUDES_STATUT = ['releve', 'deduit', 'non_etabli'] as const
export type CertitudeStatut = (typeof CERTITUDES_STATUT)[number]

export interface DefinitionStatutOcr {
  /** Libellé Gestéam, affiché tel quel. */
  libelle: StatutOcr
  /** Lecture VitFix du statut. */
  sens: string
  certitude: CertitudeStatut
  /** Statuts suivants permis (🔵). Pour « Reporté » : seul le statut d'avant le report est permis (reprise). */
  suivants: readonly StatutOcr[]
  final: boolean
}

/** Statuts depuis lesquels une pièce se reporte : tous, sauf Associé (final) et Reporté. */
const STATUTS_REPORTABLES: readonly StatutOcr[] = ['En erreur', 'À scanner', 'Extrait', 'Identifié', 'Traduit', 'Non associé']

export const REFERENTIEL_STATUTS_OCR: Readonly<Record<StatutOcr, DefinitionStatutOcr>> = {
  'En erreur': {
    libelle: 'En erreur',
    sens: 'La lecture a échoué (texte vide) ou la pièce est signalée inexploitable, avec un motif. Une nouvelle lecture repasse par « À scanner ».',
    certitude: 'deduit',
    suivants: ['À scanner', 'Reporté'],
    final: false,
  },
  'À scanner': {
    libelle: 'À scanner',
    sens: 'Pièce enregistrée dans la corbeille, texte pas encore lu. Papier à numériser ou fichier en attente de lecture : non établi.',
    certitude: 'non_etabli',
    suivants: ['Extrait', 'En erreur', 'Reporté'],
    final: false,
  },
  Extrait: {
    libelle: 'Extrait',
    sens: 'Texte lu (couche texte du PDF ou moteur OCR) ; fournisseur, SIRET, numéro, date et montants relevés par lireFacture.',
    certitude: 'deduit',
    suivants: ['Identifié', 'En erreur', 'Reporté'],
    final: false,
  },
  Identifié: {
    libelle: 'Identifié',
    sens: 'Facture reconnue : fournisseur ou SIRET, numéro, date et montant TTC lus (controlerFacture sans absence bloquante).',
    certitude: 'deduit',
    suivants: ['Traduit', 'Associé', 'Non associé', 'Reporté', 'Extrait'],
    final: false,
  },
  Traduit: {
    libelle: 'Traduit',
    sens: "Facture traduite en proposition d'écriture : un compte de charge est retenu (proposerImputation, revu par le gestionnaire).",
    certitude: 'deduit',
    suivants: ['Associé', 'Non associé', 'Reporté', 'Extrait'],
    final: false,
  },
  'Non associé': {
    libelle: 'Non associé',
    sens: 'Pièce examinée sans facture saisie à lui associer, avec un motif ; elle pourra être associée plus tard.',
    certitude: 'deduit',
    suivants: ['Associé', 'Reporté', 'Extrait'],
    final: false,
  },
  Associé: {
    libelle: 'Associé',
    sens: 'Pièce associée à une facture saisie : fin du circuit.',
    certitude: 'releve',
    suivants: [],
    final: true,
  },
  Reporté: {
    libelle: 'Reporté',
    sens: "Traitement remis à plus tard, avec une date de reprise ou un motif ; la reprise ramène au statut d'avant le report.",
    certitude: 'deduit',
    suivants: STATUTS_REPORTABLES,
    final: false,
  },
}

// ─── Pièce numérisée ─────────────────────────────────────────────────────────────────────────

/** D'où vient le texte lu : couche texte d'un PDF, ou moteur OCR (aucun n'est choisi). */
export const ORIGINES_TEXTE_LU = ['couche_texte_pdf', 'moteur_ocr'] as const
export type OrigineTexteLu = (typeof ORIGINES_TEXTE_LU)[number]

/** Entrée neutre : un texte déjà lu, quel que soit l'outil qui l'a produit. */
export interface TexteLu {
  texte: string
  origine: OrigineTexteLu
  /** Outil qui a produit le texte, en clair ; absent ou null : non précisé. */
  outil?: string | null
}

/** Changement de statut daté ; le premier, celui du dépôt, a statutAncien null. */
export interface EvenementPiece {
  statut: StatutOcr
  statutAncien: StatutOcr | null
  le: string
  motif: string | null
}

export interface ReportPiece {
  le: string
  dateReprise: string | null
  motif: string | null
  statutAvantReport: StatutOcr
}

export interface PieceNumerisee {
  id: string
  /** Corbeille de numérisation (Gestéam : une par utilisateur). */
  corbeille: string
  nomFichier: string
  /** Copropriété de la pièce si elle est connue ; null : non rattachée. */
  coproprieteId: string | null
  statut: StatutOcr
  origineTexte: { origine: OrigineTexteLu; outil: string | null } | null
  /** Champs lus (lireFacture), éventuellement corrigés ; null tant que le texte n'est pas lu. */
  lecture: FactureLue | null
  /** Proposition d'écriture retenue au passage en « Traduit ». */
  imputation: ImputationProposee | null
  /** Facture saisie associée ; null tant que la pièce n'est pas « Associé ». */
  factureId: string | null
  motifNonAssociation: string | null
  report: ReportPiece | null
  historique: EvenementPiece[]
}

type MiseAJour = { le: string; motif?: string | null } & Partial<Omit<PieceNumerisee, 'id' | 'statut' | 'historique'>>

/** Champs remis à zéro quand la lecture n'est pas (ou plus) exploitable. */
const SANS_LECTURE = { origineTexte: null, lecture: null, imputation: null, motifNonAssociation: null } as const

const texteOuNull = (valeur: string | null | undefined): string | null =>
  typeof valeur === 'string' ? normaliserEspaces(valeur) || null : null

const listeStatuts = (statuts: readonly StatutOcr[]): string => statuts.map((s) => `« ${s} »`).join(', ')

function verifierDate(id: string, le: string, derniere: string | undefined): void {
  if (!estDateIsoValide(le)) throw new Error(`Pièce ${id} : date « ${String(le)} » invalide (AAAA-MM-JJ attendu).`)
  if (derniere !== undefined && le < derniere)
    throw new Error(`Pièce ${id} : changement daté du ${dateIsoVersFr(le)}, avant le changement précédent (${dateIsoVersFr(derniere)}).`)
}

function motifRequis(piece: PieceNumerisee, motif: string | null | undefined, quoi: string): string {
  const texte = texteOuNull(motif)
  if (!texte) throw new Error(`Pièce ${piece.id} : motif ${quoi} attendu.`)
  return texte
}

function lectureRequise(piece: PieceNumerisee): FactureLue {
  if (!piece.lecture) throw new Error(`Pièce ${piece.id} « ${piece.statut} » : texte pas encore lu.`)
  return piece.lecture
}

/** Statuts permis depuis le statut de la pièce ; « Reporté » ne permet que le statut d'avant le report. */
export function transitionsPermises(piece: Pick<PieceNumerisee, 'id' | 'statut' | 'report'>): StatutOcr[] {
  if (!(STATUTS_OCR as readonly string[]).includes(piece.statut))
    throw new Error(`Pièce ${piece.id} : statut OCR « ${String(piece.statut)} » inconnu (statuts Gestéam : ${STATUTS_OCR.join(', ')}).`)
  if (piece.statut !== 'Reporté') return [...REFERENTIEL_STATUTS_OCR[piece.statut].suivants]
  if (!piece.report) throw new Error(`Pièce ${piece.id} reportée sans report enregistré : donnée incohérente.`)
  return [piece.report.statutAvantReport]
}

/** Contrôle d'une action sur la pièce ; une pièce reportée se reprend d'abord (reprendrePiece), rien d'autre. */
function verifierTransition(piece: PieceNumerisee, vers: StatutOcr): void {
  const permises = transitionsPermises(piece)
  if (piece.statut === 'Reporté')
    throw new Error(`Pièce ${piece.id} reportée : la reprendre d'abord (retour en « ${permises[0]} »).`)
  if (permises.includes(vers)) return
  const suite = permises.length > 0 ? `statuts permis : ${listeStatuts(permises)}` : `« ${piece.statut} » est un statut final`
  throw new Error(`Pièce ${piece.id} : passage de « ${piece.statut} » à « ${vers} » refusé (${suite}).`)
}

/** Enregistre le changement daté, sans contrôle de transition (la correction reste en « Extrait »). */
function enregistrer(piece: PieceNumerisee, vers: StatutOcr, { le, motif = null, ...maj }: MiseAJour): PieceNumerisee {
  verifierDate(piece.id, le, piece.historique.at(-1)?.le)
  return { ...piece, ...maj, statut: vers, historique: [...piece.historique, { statut: vers, statutAncien: piece.statut, le, motif }] }
}

function changer(piece: PieceNumerisee, vers: StatutOcr, maj: MiseAJour): PieceNumerisee {
  verifierTransition(piece, vers)
  return enregistrer(piece, vers, maj)
}

/** Pièce déposée dans une corbeille de numérisation : statut « À scanner », texte pas encore lu. */
export function deposerPiece({
  id,
  corbeille,
  nomFichier,
  le,
  coproprieteId = null,
}: {
  id: string
  corbeille: string
  nomFichier: string
  le: string
  coproprieteId?: string | null
}): PieceNumerisee {
  const identifiant = texteOuNull(id)
  if (!identifiant) throw new Error('Pièce numérisée : identifiant attendu.')
  verifierDate(identifiant, le, undefined)
  const corbeilleLue = texteOuNull(corbeille)
  if (!corbeilleLue) throw new Error(`Pièce ${identifiant} : corbeille de numérisation attendue.`)
  const fichier = texteOuNull(nomFichier)
  if (!fichier) throw new Error(`Pièce ${identifiant} : nom du fichier attendu.`)
  return {
    id: identifiant,
    corbeille: corbeilleLue,
    nomFichier: fichier,
    coproprieteId: texteOuNull(coproprieteId),
    statut: 'À scanner',
    ...SANS_LECTURE,
    factureId: null,
    report: null,
    historique: [{ statut: 'À scanner', statutAncien: null, le, motif: null }],
  }
}

// ─── Lecture, erreur, identification, correction, traduction ─────────────────────────────────

/**
 * « Extrait » : le texte lu passe par lireFacture. Un texte vide mène à « En erreur ». Seule une pièce « À scanner » se
 * lit : après une erreur, remettreAScanner ; pour changer un champ lu, corrigerLecture.
 */
export function extrairePiece(piece: PieceNumerisee, { texteLu, le }: { texteLu: TexteLu; le: string }): PieceNumerisee {
  if (piece.statut !== 'À scanner')
    throw new Error(`Pièce ${piece.id} « ${piece.statut} » : la lecture du texte se fait depuis « À scanner » seulement.`)
  if (!(ORIGINES_TEXTE_LU as readonly string[]).includes(texteLu.origine))
    throw new Error(`Pièce ${piece.id} : origine du texte « ${String(texteLu.origine)} » inconnue (${ORIGINES_TEXTE_LU.join(' ou ')} attendue).`)
  if (typeof texteLu.texte !== 'string' || !texteLu.texte.trim())
    return changer(piece, 'En erreur', { le, motif: 'Texte lu vide : rien à extraire.', ...SANS_LECTURE })
  return changer(piece, 'Extrait', {
    le,
    origineTexte: { origine: texteLu.origine, outil: texteOuNull(texteLu.outil) },
    lecture: lireFacture(texteLu.texte),
    imputation: null,
  })
}

/** « En erreur » à la main (pièce illisible, pas une facture…), avec un motif ; la lecture est écartée. */
export function signalerErreur(piece: PieceNumerisee, { motif, le }: { motif: string; le: string }): PieceNumerisee {
  verifierTransition(piece, 'En erreur')
  return enregistrer(piece, 'En erreur', { le, motif: motifRequis(piece, motif, "de l'erreur"), ...SANS_LECTURE })
}

/** Après une erreur : retour en « À scanner », pour une nouvelle numérisation ou une nouvelle lecture. */
export function remettreAScanner(piece: PieceNumerisee, { le, motif = null }: { le: string; motif?: string | null }): PieceNumerisee {
  return changer(piece, 'À scanner', { le, motif: texteOuNull(motif), ...SANS_LECTURE })
}

/** Absences qui empêchent d'identifier la facture (🔵) ; le SIRET seul ne bloque pas si le fournisseur est lu. */
const ABSENCES_BLOQUANTES: ReadonlySet<AnomalieFacture['code']> = new Set(['numero_manquant', 'date_manquante', 'montant_ttc_manquant'])

/** Anomalies de controlerFacture, réparties entre celles qui bloquent l'identification et celles à vérifier. */
export function anomaliesPiece(piece: PieceNumerisee): { bloquantes: AnomalieFacture[]; aVerifier: AnomalieFacture[] } {
  const lecture = lectureRequise(piece)
  const sansFournisseur = !texteOuNull(lecture.fournisseur) && !lecture.siret
  const bloquante = (a: AnomalieFacture): boolean => ABSENCES_BLOQUANTES.has(a.code) || (sansFournisseur && a.code === 'siret_manquant')
  const anomalies = controlerFacture(lecture)
  return {
    bloquantes: anomalies
      .filter(bloquante)
      .map((a) => (a.code === 'siret_manquant' ? { ...a, message: 'Ni fournisseur ni SIRET lus.' } : a)),
    aVerifier: anomalies.filter((a) => !bloquante(a)),
  }
}

/** « Identifié » : refusé tant qu'une absence bloquante demeure (anomaliesPiece). */
export function identifierPiece(piece: PieceNumerisee, { le }: { le: string }): PieceNumerisee {
  verifierTransition(piece, 'Identifié')
  const { bloquantes } = anomaliesPiece(piece)
  if (bloquantes.length > 0)
    throw new Error(`Pièce ${piece.id} : identification refusée. ${bloquantes.map((a) => a.message).join(' ')} Corriger la lecture ou relire la pièce.`)
  return enregistrer(piece, 'Identifié', { le })
}

/** Champs de la lecture que le gestionnaire peut corriger (le texte lu, lui, ne change pas). */
export type ChampsLecture = Partial<Omit<FactureLue, 'texte'>>

/** Contrôle d'un champ corrigé : `lire` rend la valeur retenue, ou undefined si elle est refusée. */
interface ControleChamp {
  libelle: string
  attendu: string
  lire: (valeur: unknown) => string | number | null | undefined
}

const texteLibre = (libelle: string): ControleChamp => ({
  libelle,
  attendu: 'texte attendu',
  lire: (v) => (typeof v === 'string' ? texteOuNull(v) : undefined),
})

const centimes = (libelle: string): ControleChamp => ({
  libelle,
  attendu: 'centimes entiers positifs attendus',
  lire: (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined),
})

const siretLu = (v: unknown): string | undefined => {
  const chiffres = typeof v === 'string' ? v.replaceAll(/\s/g, '') : ''
  return /^\d{14}$/.test(chiffres) ? chiffres : undefined
}

const CONTROLES_CHAMPS: Readonly<Record<keyof ChampsLecture, ControleChamp>> = {
  fournisseur: texteLibre('fournisseur'),
  siret: { libelle: 'SIRET', attendu: '14 chiffres attendus', lire: siretLu },
  numero: texteLibre('numéro'),
  date: { libelle: 'date', attendu: 'date AAAA-MM-JJ attendue', lire: (v) => (estDateIsoValide(v) ? v : undefined) },
  htCentimes: centimes('montant HT'),
  tauxTva: {
    libelle: 'taux de TVA',
    attendu: 'pourcentage positif attendu',
    lire: (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined),
  },
  tvaCentimes: centimes('TVA'),
  ttcCentimes: centimes('montant TTC'),
}

const estChampLecture = (nom: string): nom is keyof ChampsLecture => Object.keys(CONTROLES_CHAMPS).includes(nom)

/** Valeur corrigée contrôlée (CONTROLES_CHAMPS) ; null efface le champ. */
function valeurCorrigee(piece: PieceNumerisee, nom: keyof ChampsLecture, valeur: unknown): string | number | null {
  if (valeur === null) return null
  const { libelle, attendu, lire } = CONTROLES_CHAMPS[nom]
  const lue = lire(valeur)
  if (lue === undefined) throw new Error(`Pièce ${piece.id} : correction du champ « ${libelle} » refusée (${attendu}).`)
  return lue
}

const STATUTS_CORRIGEABLES: readonly StatutOcr[] = ['Extrait', 'Identifié', 'Traduit', 'Non associé']

/**
 * Correction de champs lus, avant l'association : la pièce revient (ou reste) en « Extrait » ; identification, traduction
 * et motif de non-association sont à refaire. Le motif de l'historique nomme les champs corrigés.
 */
export function corrigerLecture(piece: PieceNumerisee, { champs, le }: { champs: ChampsLecture; le: string }): PieceNumerisee {
  if (!STATUTS_CORRIGEABLES.includes(piece.statut))
    throw new Error(`Pièce ${piece.id} « ${piece.statut} » : correction de la lecture refusée (statuts corrigeables : ${listeStatuts(STATUTS_CORRIGEABLES)}).`)
  const lecture = lectureRequise(piece)
  const corrections: [keyof ChampsLecture, string | number | null][] = []
  for (const [nom, valeur] of Object.entries(champs)) {
    if (valeur === undefined) continue
    if (!estChampLecture(nom)) throw new Error(`Pièce ${piece.id} : champ « ${nom} » inconnu ou non corrigeable.`)
    corrections.push([nom, valeurCorrigee(piece, nom, valeur)])
  }
  if (corrections.length === 0) throw new Error(`Pièce ${piece.id} : aucun champ à corriger.`)
  const maj: MiseAJour = {
    le,
    motif: `Lecture corrigée : ${corrections.map(([nom]) => CONTROLES_CHAMPS[nom].libelle).join(', ')}.`,
    lecture: { ...lecture, ...Object.fromEntries(corrections) },
    imputation: null,
    motifNonAssociation: null,
  }
  return piece.statut === 'Extrait' ? enregistrer(piece, 'Extrait', maj) : changer(piece, 'Extrait', maj)
}

/** « Traduit » : la proposition d'écriture retenue doit porter un compte de charge. */
export function traduirePiece(piece: PieceNumerisee, { imputation, le }: { imputation: ImputationProposee; le: string }): PieceNumerisee {
  verifierTransition(piece, 'Traduit')
  if (!imputation.comptePlan)
    throw new Error(`Pièce ${piece.id} : traduction refusée, aucun compte de charge retenu (proposition « à compléter » : le gestionnaire choisit le compte).`)
  return enregistrer(piece, 'Traduit', { le, imputation })
}

// ─── Comparaison avec les factures saisies ───────────────────────────────────────────────────

/** Facture déjà saisie (amont de facture-ventilee.ts et statuts-facture.ts), telle que l'association la compare. */
export interface FactureSaisieAssociable {
  id: string
  coproprieteId: string
  /** Fournisseur : même nom de champ que la table `factures` du schéma. */
  prestataireId: string
  /** Nom du fournisseur tel que saisi. */
  fournisseur: string
  siret: string | null
  numero: string | null
  date: string | null
  ttcCentimes: number
}

export const CRITERES_ASSOCIATION = ['fournisseur', 'numero', 'montant_ttc', 'date'] as const
export type CritereAssociation = (typeof CRITERES_ASSOCIATION)[number]
export type ResultatCritere = 'concorde' | 'differe' | 'inconnu'

export interface ComparaisonCritere {
  critere: CritereAssociation
  resultat: ResultatCritere
  /** Ce qui a été comparé, en clair. */
  detail: string
}

const LIBELLES_CRITERES: Readonly<Record<CritereAssociation, string>> = {
  fournisseur: 'Fournisseur',
  numero: 'Numéro',
  montant_ttc: 'Montant TTC',
  date: 'Date',
}

const LIBELLES_RESULTATS: Readonly<Record<ResultatCritere, string>> = { concorde: 'concorde', differe: 'diffère', inconnu: 'inconnu' }

/** « Montant TTC : 300,00 € lu, 301,00 € saisi » : un critère discordant, en clair. */
const libelleEcart = (c: ComparaisonCritere): string => `${LIBELLES_CRITERES[c.critere]} : ${c.detail}`

type Comparaison = Omit<ComparaisonCritere, 'critere'>
const concorde = (detail: string): Comparaison => ({ resultat: 'concorde', detail })
const differe = (detail: string): Comparaison => ({ resultat: 'differe', detail })
const inconnu = (detail: string): Comparaison => ({ resultat: 'inconnu', detail })

const siretNormalise = (siret: string | null): string | null => {
  const chiffres = siret?.replaceAll(/\D/g, '') ?? ''
  return chiffres.length === 14 ? chiffres : null
}

/** Numéro comparé sans casse, accents, espaces ni séparateurs (« A-12/3 » = « a123 »). */
const cleNumero = (numero: string | null): string | null => (numero ? normaliserTexte(numero).replaceAll(' ', '') || null : null)

/** Le nom court figure, en mots entiers, dans le nom long (« ALPHA ASCENSEURS » dans « ENTREPRISE ALPHA ASCENSEURS »). */
const contientMots = (long: string, court: string): boolean => ` ${long} `.includes(` ${court} `)

/** Même fournisseur : SIRET égaux s'ils sont lus des deux côtés, sinon noms concordants en mots entiers. */
function comparerFournisseur(a: Pick<FactureLue, 'fournisseur' | 'siret'>, b: Pick<FactureLue, 'fournisseur' | 'siret'>): Comparaison {
  const [siretA, siretB] = [siretNormalise(a.siret), siretNormalise(b.siret)]
  if (siretA && siretB) return siretA === siretB ? concorde('même SIRET') : differe(`SIRET ${siretA} lu, ${siretB} saisi`)
  const [nomA, nomB] = [normaliserTexte(a.fournisseur ?? ''), normaliserTexte(b.fournisseur ?? '')]
  if (!nomA || !nomB) return inconnu('ni SIRET ni nom des deux côtés')
  if (contientMots(nomA, nomB) || contientMots(nomB, nomA)) return concorde('même nom, SIRET non comparé')
  return differe(`« ${a.fournisseur} » lu, « ${b.fournisseur} » saisi`)
}

function comparerNumero(lu: string | null, saisi: string | null): Comparaison {
  const [cleLue, cleSaisie] = [cleNumero(lu), cleNumero(saisi)]
  if (!cleLue || !cleSaisie) return inconnu('numéro absent')
  return cleLue === cleSaisie ? concorde(`n° ${saisi}`) : differe(`n° ${lu} lu, n° ${saisi} saisi`)
}

const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)

function comparerMontant(lu: number | null, saisi: number): Comparaison {
  if (lu === null) return inconnu('montant TTC non lu')
  return lu === saisi ? concorde(euros(saisi)) : differe(`${euros(lu)} lu, ${euros(saisi)} saisi`)
}

function comparerDate(lue: string | null, saisie: string | null): Comparaison {
  if (!lue || !saisie || !estDateIsoValide(saisie)) return inconnu('date absente')
  if (lue === saisie) return concorde(dateIsoVersFr(saisie))
  return differe(`${dateIsoVersFr(lue)} lue, ${dateIsoVersFr(saisie)} saisie (${Math.abs(ecartJours(lue, saisie))} jours d'écart)`)
}

/** Les quatre critères de l'association, dans l'ordre de CRITERES_ASSOCIATION. */
function comparer(lecture: FactureLue, facture: FactureSaisieAssociable): ComparaisonCritere[] {
  const resultats: Record<CritereAssociation, Comparaison> = {
    fournisseur: comparerFournisseur(lecture, facture),
    numero: comparerNumero(lecture.numero, facture.numero),
    montant_ttc: comparerMontant(lecture.ttcCentimes, facture.ttcCentimes),
    date: comparerDate(lecture.date, facture.date),
  }
  return CRITERES_ASSOCIATION.map((critere) => ({ critere, ...resultats[critere] }))
}

/** Comparaison de la pièce lue avec une facture saisie, critère par critère. */
export function comparerPieceEtFacture(piece: PieceNumerisee, facture: FactureSaisieAssociable): ComparaisonCritere[] {
  return comparer(lectureRequise(piece), facture)
}

/** Même facture : même fournisseur et même numéro (numéro unique du fournisseur, CGI annexe II art. 242 nonies A, I, 7°). */
function memeFacture(a: FactureLue, b: FactureLue): boolean {
  const numero = cleNumero(a.numero)
  return numero !== null && numero === cleNumero(b.numero) && comparerFournisseur(a, b).resultat === 'concorde'
}

const pieceLiee = (factureId: string, saufPieceId: string, pieces: readonly PieceNumerisee[]): PieceNumerisee | undefined =>
  pieces.find((p) => p.id !== saufPieceId && p.factureId === factureId)

export interface FactureCandidate {
  factureId: string
  criteres: ComparaisonCritere[]
  concordants: number
  discordants: number
  /** Pièce à laquelle la facture est déjà liée : listée pour signaler un doublon probable, mais non associable. */
  dejaLieeA: string | null
  explication: string
}

/** Critères qui suffisent à retenir une facture comme candidate : la date seule ne suffit pas (🔵). */
const CRITERES_SUFFISANTS: ReadonlySet<CritereAssociation> = new Set<CritereAssociation>(['fournisseur', 'numero', 'montant_ttc'])

function candidate(piece: PieceNumerisee, lecture: FactureLue, facture: FactureSaisieAssociable, pieces: readonly PieceNumerisee[]): FactureCandidate {
  const criteres = comparer(lecture, facture)
  const dejaLieeA = pieceLiee(facture.id, piece.id, pieces)?.id ?? null
  const explication = [
    ...criteres.map((c) => `${LIBELLES_CRITERES[c.critere]} : ${LIBELLES_RESULTATS[c.resultat]} (${c.detail})`),
    ...(dejaLieeA ? [`déjà liée à la pièce ${dejaLieeA} : doublon probable, association refusée`] : []),
  ].join(' · ')
  return {
    factureId: facture.id,
    criteres,
    concordants: criteres.filter((c) => c.resultat === 'concorde').length,
    discordants: criteres.filter((c) => c.resultat === 'differe').length,
    dejaLieeA,
    explication,
  }
}

/**
 * Factures saisies candidates à l'association, jamais associées d'office : même copropriété que la pièce (si elle est
 * connue), au moins le fournisseur, le numéro ou le montant TTC concordant ; triées par critères concordants (le plus
 * d'abord), puis discordants (le moins d'abord), puis identifiant. Chaque candidate est expliquée critère par critère.
 */
export function proposerFacturesCandidates(
  piece: PieceNumerisee,
  { factures, pieces }: { factures: readonly FactureSaisieAssociable[]; pieces: readonly PieceNumerisee[] },
): FactureCandidate[] {
  const lecture = lectureRequise(piece)
  if (new Set(factures.map((f) => f.id)).size !== factures.length) throw new Error('Facture saisie en double dans la liste à comparer.')
  return factures
    .filter((f) => !piece.coproprieteId || f.coproprieteId === piece.coproprieteId)
    .map((f) => candidate(piece, lecture, f, pieces))
    .filter((c) => c.criteres.some((k) => k.resultat === 'concorde' && CRITERES_SUFFISANTS.has(k.critere)))
    .sort((a, b) => b.concordants - a.concordants || a.discordants - b.discordants || a.factureId.localeCompare(b.factureId))
}

// ─── Association, non-association, report ────────────────────────────────────────────────────

/**
 * « Associé » : décision du gestionnaire, depuis « Identifié », « Traduit » ou « Non associé ». Refusée pour une pièce
 * déjà associée, une facture déjà liée à une autre pièce, une facture d'une autre copropriété, ou un doublon (autre pièce
 * associée, même fournisseur et même numéro). Un critère discordant exige un motif. `pieces` : les autres pièces connues.
 */
export function associerPiece(
  piece: PieceNumerisee,
  { facture, pieces, le, motif = null }: { facture: FactureSaisieAssociable; pieces: readonly PieceNumerisee[]; le: string; motif?: string | null },
): PieceNumerisee {
  if (piece.statut === 'Associé')
    throw new Error(`Pièce ${piece.id} déjà associée à la facture ${piece.factureId} : une pièce ne s'associe qu'une fois.`)
  verifierTransition(piece, 'Associé')
  const lecture = lectureRequise(piece)
  if (piece.coproprieteId && facture.coproprieteId !== piece.coproprieteId)
    throw new Error(`Pièce ${piece.id} : la facture ${facture.id} relève d'une autre copropriété.`)
  const liee = pieceLiee(facture.id, piece.id, pieces)
  if (liee) throw new Error(`Facture ${facture.id} déjà liée à la pièce ${liee.id} : une facture saisie ne reçoit qu'une pièce.`)
  const doublon = pieces.find((p) => p.id !== piece.id && p.statut === 'Associé' && p.lecture !== null && memeFacture(p.lecture, lecture))
  if (doublon)
    throw new Error(
      `Doublon : la pièce ${doublon.id} (même fournisseur, même numéro ${lecture.numero}) est déjà associée à la facture ${doublon.factureId}.`,
    )
  const ecarts = comparer(lecture, facture).filter((c) => c.resultat === 'differe')
  const texteMotif = texteOuNull(motif)
  if (ecarts.length > 0 && !texteMotif)
    throw new Error(
      `Pièce ${piece.id} : association à la facture ${facture.id} avec écart (${ecarts.map(libelleEcart).join(' ; ')}) : motif attendu.`,
    )
  return enregistrer(piece, 'Associé', { le, motif: texteMotif, factureId: facture.id, motifNonAssociation: null })
}

/** « Non associé » : aucune facture saisie ne correspond, motif obligatoire ; la pièce pourra être associée plus tard. */
export function nePasAssocier(piece: PieceNumerisee, { motif, le }: { motif: string; le: string }): PieceNumerisee {
  verifierTransition(piece, 'Non associé')
  const texte = motifRequis(piece, motif, 'de la non-association')
  return enregistrer(piece, 'Non associé', { le, motif: texte, motifNonAssociation: texte })
}

/** « Reporté » : date de reprise (après le jour du report) ou motif ; le statut d'avant le report est gardé. */
export function reporterPiece(
  piece: PieceNumerisee,
  { le, dateReprise = null, motif = null }: { le: string; dateReprise?: string | null; motif?: string | null },
): PieceNumerisee {
  verifierTransition(piece, 'Reporté')
  verifierDate(piece.id, le, piece.historique.at(-1)?.le)
  const texteMotif = texteOuNull(motif)
  if (dateReprise === null && !texteMotif) throw new Error(`Pièce ${piece.id} : report refusé, date de reprise ou motif attendu.`)
  if (dateReprise !== null && !(estDateIsoValide(dateReprise) && dateReprise > le))
    throw new Error(`Pièce ${piece.id} : date de reprise « ${String(dateReprise)} » refusée (AAAA-MM-JJ, après le jour du report).`)
  return enregistrer(piece, 'Reporté', {
    le,
    motif: texteMotif ?? (dateReprise ? `Reprise prévue le ${dateIsoVersFr(dateReprise)}.` : null),
    report: { le, dateReprise, motif: texteMotif, statutAvantReport: piece.statut },
  })
}

/** Reprise d'une pièce reportée : retour au statut d'avant le report, avant ou après la date de reprise. */
export function reprendrePiece(piece: PieceNumerisee, { le }: { le: string }): PieceNumerisee {
  if (piece.statut !== 'Reporté') throw new Error(`Pièce ${piece.id} « ${piece.statut} » : seule une pièce reportée se reprend.`)
  const [statutAvantReport] = transitionsPermises(piece)
  return enregistrer(piece, statutAvantReport, { le, motif: 'Reprise après report.', report: null })
}

/** Pièces reportées dont la date de reprise est atteinte au jour donné, de la plus ancienne reprise à la plus récente. */
export function piecesAReprendre(pieces: readonly PieceNumerisee[], date: string): PieceNumerisee[] {
  if (!estDateIsoValide(date)) throw new Error(`Date « ${String(date)} » invalide (AAAA-MM-JJ attendu).`)
  const reprise = (p: PieceNumerisee): string => p.report?.dateReprise ?? ''
  return pieces
    .filter((p) => p.statut === 'Reporté' && reprise(p) !== '' && reprise(p) <= date)
    .sort((a, b) => reprise(a).localeCompare(reprise(b)) || a.id.localeCompare(b.id))
}

// ─── Doublons ────────────────────────────────────────────────────────────────────────────────

export interface DoublonPieces {
  /** Numéro tel que lu sur la première pièce du groupe. */
  numero: string
  pieceIds: string[]
  message: string
}

/**
 * Pièces lues qui portent la même facture : même fournisseur (SIRET, sinon nom) et même numéro. Une facture a un numéro
 * unique (CGI, annexe II, art. 242 nonies A, I, 7°) : deux pièces ainsi rapprochées sont un doublon probable.
 */
export function detecterDoublons(pieces: readonly PieceNumerisee[]): DoublonPieces[] {
  const groupes: { id: string; lecture: FactureLue }[][] = []
  for (const { id, lecture } of pieces) {
    if (!lecture || cleNumero(lecture.numero) === null) continue
    const groupe = groupes.find((g) => g.some((autre) => memeFacture(autre.lecture, lecture)))
    if (groupe) groupe.push({ id, lecture })
    else groupes.push([{ id, lecture }])
  }
  return groupes
    .filter((g) => g.length > 1)
    .map((g) => {
      const numero = g[0].lecture.numero ?? ''
      const pieceIds = g.map((p) => p.id)
      return {
        numero,
        pieceIds,
        message: `Doublon probable : pièces ${pieceIds.join(', ')}, même fournisseur et même numéro (${numero}). Une seule peut être associée.`,
      }
    })
}
