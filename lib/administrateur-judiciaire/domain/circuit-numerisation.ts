import { dateIsoVersFr, ecartJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { identifierPrestataire, type IdentificationPrestataire } from '@/lib/administrateur-judiciaire/domain/facture-contrat'
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
 *   associée, reportée, en erreur). Les avoirs fournisseurs entrent donc dans le circuit ;
 * - 🟢 même écran : deux autres critères, Statut (En attente · À traiter · Terminé) et Suivi (À voir · À suivre ·
 *   Urgent). Ce sont d'autres champs : ils ne se fondent pas dans le statut OCR (06_PIEGES § 4) et restent hors module ;
 * - 🟢 tranche 40 (menu Outils) : « Voir mes corbeilles » ouvre un dossier réseau par utilisateur ; 🔵 « Relever mes
 *   corbeilles » importerait les pièces dans la GED (action non lancée). 🟢 Tranche 18 : « Corbeille » est un critère de
 *   la recherche de documents ;
 * - ⚪ tranches 33, 37 et 39 : une case ou un bouton « OCR » sur la fiche contrat (onglet Facturation, « lecture des
 *   factures ») et sur la fiche entreprise (onglet Informations) ; tranche 37 (et tranche 20) : « OCR-RAD », critère de
 *   recherche des entreprises et contrôle porté par leur fiche. Valeurs non relevées : rien n'en est modélisé.
 *
 * Sens des statuts (REFERENTIEL_STATUTS_OCR, champ « certitude ») :
 * - 🟢 relevé : Associé (pièce associée à une facture saisie). Qu'il soit le seul statut final est un choix de ce module
 *   (🔵, champ « final ») ;
 * - 🔵 déduit des libellés et du circuit : En erreur, Extrait, Identifié, Traduit, Non associé, Reporté ;
 * - 🔴 non établi : À scanner. Le relevé ne dit pas s'il s'agit d'un papier à numériser ou d'un fichier en attente de
 *   lecture. VitFix n'en retient que « texte pas encore lu ».
 *
 * 🔵 Règles déduites (choix de ce module, à valider par Hugo) :
 * - chemin : À scanner → Extrait → Identifié → (Traduit) → Associé ou Non associé. En erreur et Reporté sont des
 *   branches. En erreur reste possible jusqu'à l'association (relevé : « ou non associée, reportée, en erreur »).
 *   Associé est le seul statut final ;
 * - Extrait : le texte lu passe par lireFacture (imputation-facture.ts). Un texte vide mène à « En erreur ». Le texte vient
 *   d'une couche texte de PDF ou d'un moteur OCR (origine notée, outil en clair), sans dépendance à un moteur ;
 * - Identifié : controlerFacture ne relève aucune absence bloquante. Bloquent : le numéro, la date, le montant TTC, et un
 *   fournisseur non établi (ni SIRET lu, ni fournisseur confirmé). lireFacture prend la première ligne du texte pour le
 *   fournisseur : ce n'est qu'une proposition (« Page 1/2 », « FACTURE »…), que le gestionnaire confirme ou corrige par
 *   corrigerLecture. Les autres anomalies restent « à vérifier » : total incohérent, TVA, montant HT, SIRET absent quand
 *   le fournisseur est confirmé, avoir lu avec un montant positif ;
 * - Traduit : un compte de charge de classe 6 (5 chiffres, comme COMPTES_CHARGE_PROPOSES) est retenu (proposerImputation,
 *   revu par le gestionnaire), depuis Identifié, Non associé, ou Traduit pour changer de compte (changement daté). Une
 *   proposition « à compléter » est refusée. L'écriture elle-même se passe sur la facture saisie (facture-ventilee.ts).
 *   Traduit n'est pas exigé avant l'association ;
 * - correction de la lecture : permise avant l'association ; un champ dont la valeur ne change pas est ignoré, une
 *   correction qui ne change rien est refusée. La pièce revient en « Extrait » : identification à refaire. Montants en
 *   centimes entiers signés : un avoir se passe en négatif (même convention que facture-demande.ts) ;
 * - rattachement : la copropriété de la pièce se corrige avant l'association, avec un motif (rattacherPiece). Une pièce
 *   sans copropriété prend celle de la facture à l'association ;
 * - fournisseur : même règle que facture-contrat.ts (identifierPrestataire), qui est appelée telle quelle : même SIRET,
 *   sinon même SIREN (autre établissement), sinon même nom sans forme juridique ; jamais un nom approché, ni le nom quand
 *   les SIREN se contredisent ;
 * - numéro : comparé sans casse, accents ni espaces superflues, et sans distinguer les séparateurs (« A-12/3 » =
 *   « a 12-3 ») ; leur place compte (« 1-12 » ≠ « 11-2 » : des séries distinctes sont permises, CGI ci-dessous). Mêmes
 *   caractères découpés autrement : « diffère », à justifier ;
 * - association : jamais automatique. proposerFacturesCandidates liste les factures saisies qui concordent au moins sur
 *   le fournisseur, le numéro ou le montant TTC ; la date seule ne suffit pas. Une facture d'une autre copropriété n'est
 *   listée que si fournisseur et numéro concordent, pour signaler un rattachement à revoir. Tri : critères concordants
 *   (le plus d'abord), puis critères discordants (le moins d'abord). Chaque critère est expliqué, avec les refus et les
 *   motifs attendus, tirés du même examen que associerPiece. Comparaison exacte, sans tolérance : montant au centime, date
 *   au jour ;
 * - association refusée : pièce déjà associée ; facture déjà liée à une autre pièce ; facture d'une autre copropriété ;
 *   doublon certain. Exigent un motif : un critère discordant (dont une date saisie invalide) et un doublon probable ;
 * - doublon (une autre pièce porte la même facture) : certain si même SIRET et même numéro ; probable si le fournisseur
 *   n'est rapproché que par le SIREN ou par le nom, ou si les numéros n'ont que les mêmes caractères. detecterDoublons
 *   rend des paires de pièces, dans un ordre qui ne dépend pas de la liste reçue ;
 * - non-association : motif obligatoire. La pièce pourra être associée plus tard (Non associé n'est pas final) ;
 * - report : date de reprise (après le jour du report) ou motif. La reprise ramène au statut d'avant le report ; avant
 *   elle, aucune autre action n'est permise ;
 * - chaque événement est daté (historique), jamais avant le précédent ; une correction ou un rattachement sans changement
 *   de statut y figure aussi.
 *
 * Droit (textes lus sur Légifrance le 17/11/2026) :
 * - CGI, annexe II, art. 242 nonies A, I, 7° (version en vigueur depuis le 01/01/2025) : la facture porte « un numéro
 *   unique basé sur une séquence chronologique et continue » ; des séries distinctes sont permises si l'activité le
 *   justifie. https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050811276 ;
 * - CGI, art. 289 bis (version en vigueur depuis le 21/02/2026, modifiée par la loi n° 2026-103 du 19/02/2026 ; la page
 *   signale son abrogation à compter du 01/01/2027 par l'ordonnance n° 2025-1247 du 17/12/2025) : facture électronique
 *   quand l'émetteur et le destinataire sont des assujettis établis en France.
 *   https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046195635 . 🔴 Non établi : le syndicat, non assujetti à
 *   la TVA (imputation-facture.ts), reçoit-il des factures électroniques par cette voie ? Si oui, leurs données
 *   structurées remplaceraient l'OCR pour ces factures. Aucune règle n'en est tirée ici.
 *
 * 🔴 Questions ouvertes :
 * - Hugo : sens de « À scanner » ; « Non associé » est-il final dans Gestéam ? Une association erronée se défait-elle
 *   (ici : non, Associé est final) ? Faut-il une tolérance sur le montant ou la date ? « Traduit » est-il exigé avant
 *   l'association ? Un avoir se saisit-il bien en négatif ? Sans SIRET lu, faut-il que le gestionnaire confirme le
 *   fournisseur ? Un doublon probable (SIREN ou nom seuls, numéros découpés autrement) peut-il s'associer avec un motif ?
 *   Rôle de la case « OCR » des fiches entreprise et contrat, et du critère « OCR-RAD » des entreprises ?
 * - Frédéric : écrans (corbeille, liste des candidates, association, rattachement) ; rien n'est fait.
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
  /** Lecture VitFix du statut ; sa certitude est celle du champ « certitude ». */
  sens: string
  certitude: CertitudeStatut
  /** Statuts suivants permis (🔵). Pour « Reporté » : seul le statut d'avant le report est permis (reprise). */
  suivants: readonly StatutOcr[]
  /** 🔵 Choix de ce module, non relevé : seul « Associé » est final. */
  final: boolean
}

/** Statuts depuis lesquels une pièce se reporte ou se rattache : tous, sauf Associé (final) et Reporté. */
const STATUTS_REPORTABLES: readonly StatutOcr[] = ['En erreur', 'À scanner', 'Extrait', 'Identifié', 'Traduit', 'Non associé']

export const REFERENTIEL_STATUTS_OCR: Readonly<Record<StatutOcr, DefinitionStatutOcr>> = {
  'En erreur': {
    libelle: 'En erreur',
    sens: "La lecture a échoué (texte vide) ou la pièce est signalée inexploitable, avec un motif, à tout moment avant l'association. Une nouvelle lecture repasse par « À scanner ».",
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
    sens: 'Facture reconnue : numéro, date et montant TTC lus, fournisseur établi (SIRET lu ou fournisseur confirmé) ; controlerFacture sans absence bloquante.',
    certitude: 'deduit',
    suivants: ['Traduit', 'Associé', 'Non associé', 'En erreur', 'Reporté', 'Extrait'],
    final: false,
  },
  Traduit: {
    libelle: 'Traduit',
    sens: "Facture traduite en proposition d'écriture : un compte de charge est retenu (proposerImputation, revu par le gestionnaire).",
    certitude: 'deduit',
    suivants: ['Traduit', 'Associé', 'Non associé', 'En erreur', 'Reporté', 'Extrait'],
    final: false,
  },
  'Non associé': {
    libelle: 'Non associé',
    sens: 'Pièce examinée sans facture saisie à lui associer, avec un motif ; elle pourra être associée plus tard.',
    certitude: 'deduit',
    suivants: ['Traduit', 'Associé', 'En erreur', 'Reporté', 'Extrait'],
    final: false,
  },
  Associé: {
    libelle: 'Associé',
    sens: 'Pièce associée à une facture saisie.',
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

/**
 * Événement daté : changement de statut, ou correction et rattachement sans changement de statut (statut =
 * statutAncien). Le premier, celui du dépôt, a statutAncien null.
 */
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
  /** Copropriété de la pièce si elle est connue ; null : non rattachée. Se corrige par rattacherPiece. */
  coproprieteId: string | null
  statut: StatutOcr
  origineTexte: { origine: OrigineTexteLu; outil: string | null } | null
  /** Champs lus (lireFacture), éventuellement corrigés ; null tant que le texte n'est pas lu. */
  lecture: FactureLue | null
  /** Fournisseur confirmé ou corrigé par le gestionnaire ; false : nom de la première ligne du texte, simple proposition. */
  fournisseurConfirme: boolean
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
const SANS_LECTURE = { origineTexte: null, lecture: null, fournisseurConfirme: false, imputation: null, motifNonAssociation: null } as const

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

/** Enregistre l'événement daté, sans contrôle de transition (correction ou rattachement : statut inchangé). */
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

/**
 * Rattachement de la pièce à une autre copropriété (ou à aucune), daté, avec un motif ; avant l'association, hors report.
 * Le statut ne change pas.
 */
export function rattacherPiece(
  piece: PieceNumerisee,
  { coproprieteId, motif, le }: { coproprieteId: string | null; motif: string; le: string },
): PieceNumerisee {
  if (!STATUTS_REPORTABLES.includes(piece.statut))
    throw new Error(`Pièce ${piece.id} « ${piece.statut} » : rattachement refusé (statuts permis : ${listeStatuts(STATUTS_REPORTABLES)}).`)
  const nouvelle = texteOuNull(coproprieteId)
  if (nouvelle === piece.coproprieteId)
    throw new Error(`Pièce ${piece.id} : ${nouvelle ? `déjà rattachée à la copropriété ${nouvelle}` : 'déjà sans copropriété'}.`)
  const texte = motifRequis(piece, motif, 'du rattachement')
  const libelle = (copropriete: string | null): string => copropriete ?? 'aucune'
  return enregistrer(piece, piece.statut, {
    le,
    motif: `Rattachement : copropriété ${libelle(piece.coproprieteId)} → ${libelle(nouvelle)}. ${texte}`,
    coproprieteId: nouvelle,
  })
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
    fournisseurConfirme: false,
    imputation: null,
  })
}

/** « En erreur » à la main (pièce illisible, pas une facture…), avant l'association, avec un motif ; la lecture est écartée. */
export function signalerErreur(piece: PieceNumerisee, { motif, le }: { motif: string; le: string }): PieceNumerisee {
  verifierTransition(piece, 'En erreur')
  return enregistrer(piece, 'En erreur', { le, motif: motifRequis(piece, motif, "de l'erreur"), ...SANS_LECTURE })
}

/** Après une erreur : retour en « À scanner », pour une nouvelle numérisation ou une nouvelle lecture. */
export function remettreAScanner(piece: PieceNumerisee, { le, motif = null }: { le: string; motif?: string | null }): PieceNumerisee {
  return changer(piece, 'À scanner', { le, motif: texteOuNull(motif), ...SANS_LECTURE })
}

/** Anomalie de controlerFacture, ou propre au circuit (fournisseur à confirmer, avoir au montant positif). */
export interface AnomaliePiece {
  code: AnomalieFacture['code'] | 'fournisseur_non_confirme' | 'avoir_montant_positif'
  message: string
}

/** Absences qui empêchent d'identifier la facture (🔵) ; le SIRET seul ne bloque pas si le fournisseur est confirmé. */
const ABSENCES_BLOQUANTES: ReadonlySet<AnomalieFacture['code']> = new Set(['numero_manquant', 'date_manquante', 'montant_ttc_manquant'])

/** Le texte se présente comme un avoir (ligne qui commence par « Avoir », ou « avoir n° »). */
const TEXTE_AVOIR = /(?:^\s*(?:facture d['’]\s*)?avoir\b)|(?:\bavoir\s*n\s*°)/im

/** Anomalies de la lecture, réparties entre celles qui bloquent l'identification et celles à vérifier. */
export function anomaliesPiece(piece: PieceNumerisee): { bloquantes: AnomaliePiece[]; aVerifier: AnomaliePiece[] } {
  const lecture = lectureRequise(piece)
  const fournisseur = texteOuNull(lecture.fournisseur)
  const fournisseurEtabli = piece.fournisseurConfirme && fournisseur !== null
  const bloquantes: AnomaliePiece[] = []
  const aVerifier: AnomaliePiece[] = []
  for (const anomalie of controlerFacture(lecture)) {
    if (ABSENCES_BLOQUANTES.has(anomalie.code)) bloquantes.push(anomalie)
    else if (anomalie.code !== 'siret_manquant' || fournisseurEtabli) aVerifier.push(anomalie)
    else if (fournisseur)
      bloquantes.push({
        code: 'fournisseur_non_confirme',
        message: `SIRET introuvable, et le fournisseur « ${fournisseur} » (première ligne du texte) n'est pas confirmé : confirmer ou corriger le fournisseur.`,
      })
    else bloquantes.push({ ...anomalie, message: 'Ni fournisseur ni SIRET lus.' })
  }
  if (TEXTE_AVOIR.test(lecture.texte) && lecture.ttcCentimes !== null && lecture.ttcCentimes > 0)
    aVerifier.push({
      code: 'avoir_montant_positif',
      message: 'Le texte se présente comme un avoir, mais le montant TTC lu est positif : un avoir se passe en négatif (corriger les montants).',
    })
  return { bloquantes, aVerifier }
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

/** Centimes entiers signés : un avoir se passe en négatif. */
const centimes = (libelle: string): ControleChamp => ({
  libelle,
  attendu: 'centimes entiers attendus, négatifs pour un avoir',
  lire: (v) => (typeof v === 'number' && Number.isInteger(v) ? v : undefined),
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
 * et motif de non-association sont à refaire. Un champ inchangé est ignoré ; donner le fournisseur déjà lu le confirme.
 * Le motif de l'historique nomme les champs corrigés.
 */
export function corrigerLecture(piece: PieceNumerisee, { champs, le }: { champs: ChampsLecture; le: string }): PieceNumerisee {
  if (!STATUTS_CORRIGEABLES.includes(piece.statut))
    throw new Error(`Pièce ${piece.id} « ${piece.statut} » : correction de la lecture refusée (statuts corrigeables : ${listeStatuts(STATUTS_CORRIGEABLES)}).`)
  const lecture = lectureRequise(piece)
  const corrections: [keyof ChampsLecture, string | number | null][] = []
  let donnes = 0
  let confirmation = false
  for (const [nom, valeur] of Object.entries(champs)) {
    if (valeur === undefined) continue
    if (!estChampLecture(nom)) throw new Error(`Pièce ${piece.id} : champ « ${nom} » inconnu ou non corrigeable.`)
    donnes += 1
    const retenue = valeurCorrigee(piece, nom, valeur)
    if (retenue !== lecture[nom]) corrections.push([nom, retenue])
    else if (nom === 'fournisseur' && retenue !== null && !piece.fournisseurConfirme) confirmation = true
  }
  if (donnes === 0) throw new Error(`Pièce ${piece.id} : aucun champ à corriger.`)
  if (corrections.length === 0 && !confirmation) throw new Error(`Pièce ${piece.id} : aucun changement, les valeurs données sont celles déjà lues.`)
  const fournisseurCorrige = corrections.find(([nom]) => nom === 'fournisseur')
  const motif = [
    corrections.length > 0 ? `Lecture corrigée : ${corrections.map(([nom]) => CONTROLES_CHAMPS[nom].libelle).join(', ')}.` : null,
    confirmation ? 'Fournisseur confirmé.' : null,
  ]
    .filter(Boolean)
    .join(' ')
  const maj: MiseAJour = {
    le,
    motif,
    lecture: { ...lecture, ...Object.fromEntries(corrections) },
    fournisseurConfirme: fournisseurCorrige ? fournisseurCorrige[1] !== null : piece.fournisseurConfirme || confirmation,
    imputation: null,
    motifNonAssociation: null,
  }
  return piece.statut === 'Extrait' ? enregistrer(piece, 'Extrait', maj) : changer(piece, 'Extrait', maj)
}

/** Compte de charge du plan des copropriétés : classe 6, 5 chiffres (comme COMPTES_CHARGE_PROPOSES). */
const COMPTE_DE_CHARGE = /^6\d{4}$/

const memeImputation = (a: ImputationProposee, b: ImputationProposee): boolean =>
  (Object.keys({ ...a, ...b }) as (keyof ImputationProposee)[]).every((cle) => a[cle] === b[cle])

/**
 * « Traduit » : la proposition d'écriture retenue doit porter un compte de charge (classe 6). Depuis « Traduit », elle
 * remplace la précédente (changement daté) ; la même proposition est refusée.
 */
export function traduirePiece(piece: PieceNumerisee, { imputation, le }: { imputation: ImputationProposee; le: string }): PieceNumerisee {
  verifierTransition(piece, 'Traduit')
  const compte = (imputation.comptePlan ?? '').trim()
  if (!compte)
    throw new Error(`Pièce ${piece.id} : traduction refusée, aucun compte de charge retenu (proposition « à compléter » : le gestionnaire choisit le compte).`)
  if (!COMPTE_DE_CHARGE.test(compte))
    throw new Error(`Pièce ${piece.id} : traduction refusée, compte « ${compte} » : compte de charge de classe 6 attendu (5 chiffres, par exemple 61500).`)
  const retenue = { ...imputation, comptePlan: compte }
  const avant = piece.statut === 'Traduit' ? piece.imputation : null
  if (avant && memeImputation(avant, retenue)) throw new Error(`Pièce ${piece.id} : traduction inchangée (même proposition, compte ${compte}).`)
  let motif = `Compte ${compte} retenu.`
  if (avant) motif = avant.comptePlan === compte ? `Proposition d'écriture modifiée (compte ${compte}).` : `Compte changé : ${avant.comptePlan} → ${compte}.`
  return enregistrer(piece, 'Traduit', { le, motif, imputation: retenue, motifNonAssociation: null })
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
  /** Centimes entiers ; négatif pour un avoir. */
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

/** Absence d'une valeur à comparer, d'un côté ou des deux (« numéro non lu », « date ni lue ni saisie »). */
const absence = (lue: boolean, saisie: boolean, libelles: { lu: string; saisi: string; aucun: string }): string => {
  if (!lue && !saisie) return libelles.aucun
  return lue ? libelles.saisi : libelles.lu
}

const siretNormalise = (siret: string | null): string | null => {
  const chiffres = siret?.replaceAll(/\D/g, '') ?? ''
  return chiffres.length === 14 ? chiffres : null
}

type Fournisseur = Pick<FactureLue, 'fournisseur' | 'siret'>
type PreuveFournisseur = Exclude<IdentificationPrestataire, 'saisi'>

/**
 * Même fournisseur, par la règle de facture-contrat.ts (identifierPrestataire, appelée telle quelle) : même SIRET, sinon
 * même SIREN, sinon même nom sans forme juridique ; jamais un nom approché, ni le nom quand les SIREN se contredisent.
 */
function rapprocherFournisseurs(a: Fournisseur, b: Fournisseur): PreuveFournisseur | null {
  const { identification } = identifierPrestataire({ fournisseur: a.fournisseur, siret: a.siret }, [
    { id: 'autre', nom: b.fournisseur ?? '', siret: b.siret },
  ])
  return identification === 'saisi' ? null : identification
}

function comparerFournisseur(lu: Fournisseur, saisi: Fournisseur, nomLuConfirme: boolean): Comparaison {
  const [siretLu, siretSaisi] = [siretNormalise(lu.siret), siretNormalise(saisi.siret)]
  const nonConfirme = nomLuConfirme ? '' : ' ; nom lu en première ligne, non confirmé'
  switch (rapprocherFournisseurs(lu, saisi)) {
    case 'siret':
      return concorde('même SIRET')
    case 'siren':
      return concorde(`même entreprise (SIREN), autre établissement : SIRET ${siretLu} lu, ${siretSaisi} saisi`)
    case 'nom':
      return concorde(`même nom, SIRET non comparé${nonConfirme}`)
    default:
      if (siretLu && siretSaisi) return differe(`SIRET ${siretLu} lu, ${siretSaisi} saisi`)
      if (!normaliserTexte(lu.fournisseur ?? '') || !normaliserTexte(saisi.fournisseur ?? '')) return inconnu('ni SIRET ni nom à comparer')
      return differe(`« ${lu.fournisseur} » lu, « ${saisi.fournisseur} » saisi${nonConfirme}`)
  }
}

/**
 * Numéro comparé sans casse ni accents ; tout séparateur (tiret, barre, espace…) vaut une espace, et sa place compte :
 * « A-12/3 » = « a 12 3 », mais « 1-12 » ≠ « 11-2 ».
 */
const cleNumero = (numero: string | null): string | null => (numero ? normaliserTexte(numero) || null : null)

/** Mêmes caractères, séparateurs retirés : « 1-12 » et « 11-2 » donnent « 112 ». */
const memesCaracteres = (a: string, b: string): boolean => a.replaceAll(' ', '') === b.replaceAll(' ', '')

function comparerNumero(lu: string | null, saisi: string | null): Comparaison {
  const [cleLue, cleSaisie] = [cleNumero(lu), cleNumero(saisi)]
  if (!cleLue || !cleSaisie)
    return inconnu(absence(Boolean(cleLue), Boolean(cleSaisie), { lu: 'numéro non lu', saisi: 'numéro non saisi', aucun: 'numéro ni lu ni saisi' }))
  if (cleLue === cleSaisie) return concorde(`n° ${saisi}`)
  const decoupage = memesCaracteres(cleLue, cleSaisie) ? ' : mêmes caractères, découpage différent' : ''
  return differe(`n° ${lu} lu, n° ${saisi} saisi${decoupage}`)
}

const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)

function comparerMontant(lu: number | null, saisi: number): Comparaison {
  if (lu === null) return inconnu('montant TTC non lu')
  return lu === saisi ? concorde(euros(saisi)) : differe(`${euros(lu)} lu, ${euros(saisi)} saisi`)
}

/** Date : une date absente est « inconnu » ; une date invalide, d'un côté ou de l'autre, est un écart à justifier. */
function comparerDate(dateLue: string | null, dateSaisie: string | null): Comparaison {
  const [lue, saisie] = [dateLue || null, dateSaisie || null]
  if (lue !== null && !estDateIsoValide(lue)) return differe(`date lue « ${lue} » invalide`)
  if (saisie !== null && !estDateIsoValide(saisie)) return differe(`date saisie « ${saisie} » invalide`)
  if (lue === null || saisie === null)
    return inconnu(absence(lue !== null, saisie !== null, { lu: 'date non lue', saisi: 'date non saisie', aucun: 'date ni lue ni saisie' }))
  if (lue === saisie) return concorde(dateIsoVersFr(saisie))
  const jours = Math.abs(ecartJours(lue, saisie))
  return differe(`${dateIsoVersFr(lue)} lue, ${dateIsoVersFr(saisie)} saisie (${jours} ${jours > 1 ? 'jours' : 'jour'} d'écart)`)
}

/** Les quatre critères de l'association, dans l'ordre de CRITERES_ASSOCIATION. */
function comparer(lecture: FactureLue, facture: FactureSaisieAssociable, nomLuConfirme: boolean): ComparaisonCritere[] {
  const resultats: Record<CritereAssociation, Comparaison> = {
    fournisseur: comparerFournisseur(lecture, facture, nomLuConfirme),
    numero: comparerNumero(lecture.numero, facture.numero),
    montant_ttc: comparerMontant(lecture.ttcCentimes, facture.ttcCentimes),
    date: comparerDate(lecture.date, facture.date),
  }
  return CRITERES_ASSOCIATION.map((critere) => ({ critere, ...resultats[critere] }))
}

/** Comparaison de la pièce lue avec une facture saisie, critère par critère. */
export function comparerPieceEtFacture(piece: PieceNumerisee, facture: FactureSaisieAssociable): ComparaisonCritere[] {
  return comparer(lectureRequise(piece), facture, piece.fournisseurConfirme)
}

// ─── Doublons ────────────────────────────────────────────────────────────────────────────────

/** Certain : association refusée. Probable : association permise avec un motif. */
export const NIVEAUX_DOUBLON = ['certain', 'probable'] as const
export type NiveauDoublon = (typeof NIVEAUX_DOUBLON)[number]

const RAISONS_FOURNISSEUR: Readonly<Record<PreuveFournisseur, string>> = {
  siret: 'même SIRET',
  siren: 'même SIREN, autre établissement',
  nom: 'même nom de fournisseur, SIRET non comparé',
}

/**
 * Deux lectures portent-elles la même facture ? Une facture a un numéro unique chez son fournisseur (CGI, annexe II,
 * art. 242 nonies A, I, 7°). Certain : même SIRET et même numéro. Probable : fournisseur rapproché par le SIREN ou par
 * le nom seulement, ou numéros aux mêmes caractères découpés autrement (des séries distinctes sont permises). Sinon null.
 */
function rapprocherLectures(a: FactureLue, b: FactureLue): { niveau: NiveauDoublon; raison: string } | null {
  const [numeroA, numeroB] = [cleNumero(a.numero), cleNumero(b.numero)]
  if (!numeroA || !numeroB || !memesCaracteres(numeroA, numeroB)) return null
  const preuve = rapprocherFournisseurs(a, b)
  if (!preuve) return null
  const memeNumero = numeroA === numeroB
  return {
    niveau: preuve === 'siret' && memeNumero ? 'certain' : 'probable',
    raison: `${RAISONS_FOURNISSEUR[preuve]}, ${memeNumero ? 'même numéro' : 'numéros aux mêmes caractères, découpés autrement'}`,
  }
}

interface DoublonAssocie {
  piece: PieceNumerisee
  niveau: NiveauDoublon
  raison: string
}

/** Autres pièces déjà associées qui portent la même facture que la lecture de la pièce. */
const doublonsAssocies = (piece: PieceNumerisee, lecture: FactureLue, pieces: readonly PieceNumerisee[]): DoublonAssocie[] =>
  pieces.flatMap((autre) => {
    if (autre.id === piece.id || autre.statut !== 'Associé' || !autre.lecture) return []
    const rapprochement = rapprocherLectures(autre.lecture, lecture)
    return rapprochement ? [{ piece: autre, ...rapprochement }] : []
  })

export interface DoublonPieces {
  /** Les deux pièces, dans l'ordre de leurs identifiants. */
  pieceIds: [string, string]
  niveau: NiveauDoublon
  /** Numéros tels que lus sur chaque pièce. */
  numeros: [string, string]
  message: string
}

/**
 * Paires de pièces lues qui portent la même facture (rapprocherLectures). Le résultat ne dépend pas de l'ordre de la
 * liste reçue : pièces triées par identifiant, paires dans cet ordre. Deux SIRET d'entreprises différentes ne forment
 * jamais une paire.
 */
export function detecterDoublons(pieces: readonly PieceNumerisee[]): DoublonPieces[] {
  const lues = pieces
    .flatMap(({ id, lecture }) => (lecture && cleNumero(lecture.numero) ? [{ id, lecture }] : []))
    .sort((a, b) => a.id.localeCompare(b.id))
  return lues.flatMap((a, i) =>
    lues.slice(i + 1).flatMap((b) => {
      const rapprochement = rapprocherLectures(a.lecture, b.lecture)
      if (!rapprochement) return []
      const numeros: [string, string] = [a.lecture.numero ?? '', b.lecture.numero ?? '']
      const cites = numeros[0] === numeros[1] ? numeros[0] : numeros.join(' / ')
      const pieceIds: [string, string] = [a.id, b.id]
      const message =
        rapprochement.niveau === 'certain'
          ? `Doublon : pièces ${a.id} et ${b.id}, ${rapprochement.raison} (${cites}). Une seule peut être associée.`
          : `Doublon probable : pièces ${a.id} et ${b.id}, ${rapprochement.raison} (${cites}). À vérifier : associer l'une après l'autre demandera un motif.`
      return [{ pieceIds, niveau: rapprochement.niveau, numeros, message }]
    }),
  )
}

// ─── Examen d'une association (candidates et associerPiece) ──────────────────────────────────

const pieceLiee = (factureId: string, saufPieceId: string, pieces: readonly PieceNumerisee[]): PieceNumerisee | undefined =>
  pieces.find((p) => p.id !== saufPieceId && p.factureId === factureId)

interface ExamenAssociation {
  criteres: ComparaisonCritere[]
  ecarts: ComparaisonCritere[]
  autreCopropriete: boolean
  dejaLieeA: string | null
  doublons: DoublonAssocie[]
  /** false : refus ferme (autre copropriété, facture déjà liée, doublon certain). */
  associable: boolean
  /** true : motif exigé (critère discordant, doublon probable). */
  motifAttendu: boolean
}

/** Un seul examen pour la liste des candidates et pour associerPiece : ce qui est annoncé est ce qui sera décidé. */
function examinerAssociation(
  piece: PieceNumerisee,
  lecture: FactureLue,
  facture: FactureSaisieAssociable,
  pieces: readonly PieceNumerisee[],
): ExamenAssociation {
  const criteres = comparer(lecture, facture, piece.fournisseurConfirme)
  const ecarts = criteres.filter((c) => c.resultat === 'differe')
  const autreCopropriete = piece.coproprieteId !== null && facture.coproprieteId !== piece.coproprieteId
  const dejaLieeA = pieceLiee(facture.id, piece.id, pieces)?.id ?? null
  const doublons = doublonsAssocies(piece, lecture, pieces)
  return {
    criteres,
    ecarts,
    autreCopropriete,
    dejaLieeA,
    doublons,
    associable: !autreCopropriete && dejaLieeA === null && !doublons.some((d) => d.niveau === 'certain'),
    motifAttendu: ecarts.length > 0 || doublons.some((d) => d.niveau === 'probable'),
  }
}

export interface FactureCandidate {
  factureId: string
  criteres: ComparaisonCritere[]
  concordants: number
  discordants: number
  /** Facture d'une autre copropriété, listée parce que fournisseur et numéro concordent : rattachement à revoir. */
  autreCopropriete: boolean
  /** Pièce à laquelle la facture est déjà liée. */
  dejaLieeA: string | null
  /** Pièces déjà associées qui portent la même facture que la pièce. */
  doublons: { pieceId: string; niveau: NiveauDoublon }[]
  /** false : associerPiece refuserait. */
  associable: boolean
  /** true : associerPiece exigerait un motif. */
  motifAttendu: boolean
  explication: string
}

/** Critères qui suffisent à retenir une facture comme candidate : la date seule ne suffit pas (🔵). */
const CRITERES_SUFFISANTS: ReadonlySet<CritereAssociation> = new Set<CritereAssociation>(['fournisseur', 'numero', 'montant_ttc'])

function candidate(piece: PieceNumerisee, lecture: FactureLue, facture: FactureSaisieAssociable, pieces: readonly PieceNumerisee[]): FactureCandidate {
  const examen = examinerAssociation(piece, lecture, facture, pieces)
  const { criteres, autreCopropriete, dejaLieeA, doublons } = examen
  const alertes = [
    ...(autreCopropriete ? [`autre copropriété (${facture.coproprieteId}) : rattacher d'abord la pièce, association refusée`] : []),
    ...doublons.map((d) =>
      d.niveau === 'certain'
        ? `doublon de la pièce ${d.piece.id} (${d.raison}), associée à la facture ${d.piece.factureId} : association refusée`
        : `doublon probable de la pièce ${d.piece.id} (${d.raison}), associée à la facture ${d.piece.factureId} : motif attendu`,
    ),
    ...(dejaLieeA ? [`déjà liée à la pièce ${dejaLieeA} : association refusée`] : []),
  ]
  return {
    factureId: facture.id,
    criteres,
    concordants: criteres.filter((c) => c.resultat === 'concorde').length,
    discordants: examen.ecarts.length,
    autreCopropriete,
    dejaLieeA,
    doublons: doublons.map((d) => ({ pieceId: d.piece.id, niveau: d.niveau })),
    associable: examen.associable,
    motifAttendu: examen.motifAttendu,
    explication: [...criteres.map((c) => `${LIBELLES_CRITERES[c.critere]} : ${LIBELLES_RESULTATS[c.resultat]} (${c.detail})`), ...alertes].join(' · '),
  }
}

const concordeSur = (c: FactureCandidate, critere: CritereAssociation): boolean =>
  c.criteres.some((k) => k.critere === critere && k.resultat === 'concorde')

/**
 * Factures saisies candidates à l'association, jamais associées d'office. De la copropriété de la pièce (ou de toutes si
 * elle n'est pas rattachée) : au moins le fournisseur, le numéro ou le montant TTC concordant. D'une autre copropriété :
 * seulement si fournisseur et numéro concordent, signalée non associable (rattachement à revoir). Triées par critères
 * concordants (le plus d'abord), puis discordants (le moins d'abord), puis identifiant. Chaque candidate est expliquée.
 */
export function proposerFacturesCandidates(
  piece: PieceNumerisee,
  { factures, pieces }: { factures: readonly FactureSaisieAssociable[]; pieces: readonly PieceNumerisee[] },
): FactureCandidate[] {
  const lecture = lectureRequise(piece)
  if (new Set(factures.map((f) => f.id)).size !== factures.length) throw new Error('Facture saisie en double dans la liste à comparer.')
  return factures
    .map((f) => candidate(piece, lecture, f, pieces))
    .filter((c) =>
      c.autreCopropriete
        ? concordeSur(c, 'fournisseur') && concordeSur(c, 'numero')
        : c.criteres.some((k) => k.resultat === 'concorde' && CRITERES_SUFFISANTS.has(k.critere)),
    )
    .sort((a, b) => b.concordants - a.concordants || a.discordants - b.discordants || a.factureId.localeCompare(b.factureId))
}

// ─── Association, non-association, report ────────────────────────────────────────────────────

/**
 * « Associé » : décision du gestionnaire, depuis « Identifié », « Traduit » ou « Non associé ». Refusée pour une pièce
 * déjà associée, une facture d'une autre copropriété, une facture déjà liée à une autre pièce, ou un doublon certain.
 * Un critère discordant ou un doublon probable exige un motif. Une pièce sans copropriété prend celle de la facture.
 * `pieces` : les autres pièces connues.
 */
export function associerPiece(
  piece: PieceNumerisee,
  { facture, pieces, le, motif = null }: { facture: FactureSaisieAssociable; pieces: readonly PieceNumerisee[]; le: string; motif?: string | null },
): PieceNumerisee {
  if (piece.statut === 'Associé')
    throw new Error(`Pièce ${piece.id} déjà associée à la facture ${piece.factureId} : une pièce ne s'associe qu'une fois.`)
  verifierTransition(piece, 'Associé')
  const lecture = lectureRequise(piece)
  const examen = examinerAssociation(piece, lecture, facture, pieces)
  if (examen.autreCopropriete)
    throw new Error(
      `Pièce ${piece.id} : la facture ${facture.id} relève d'une autre copropriété (${facture.coproprieteId}). Si la pièce est mal classée, la rattacher d'abord.`,
    )
  if (examen.dejaLieeA) throw new Error(`Facture ${facture.id} déjà liée à la pièce ${examen.dejaLieeA} : une facture saisie ne reçoit qu'une pièce.`)
  const certain = examen.doublons.find((d) => d.niveau === 'certain')
  if (certain)
    throw new Error(`Doublon : la pièce ${certain.piece.id} (${certain.raison} ${lecture.numero}) est déjà associée à la facture ${certain.piece.factureId}.`)
  const aJustifier = [
    ...(examen.ecarts.length > 0 ? [`écart (${examen.ecarts.map(libelleEcart).join(' ; ')})`] : []),
    ...examen.doublons.map((d) => `doublon probable de la pièce ${d.piece.id} (${d.raison}), déjà associée à la facture ${d.piece.factureId}`),
  ]
  const texteMotif = texteOuNull(motif)
  if (aJustifier.length > 0 && !texteMotif)
    throw new Error(`Pièce ${piece.id} : association à la facture ${facture.id} avec ${aJustifier.join(' et ')} : motif attendu.`)
  const reprise = piece.coproprieteId === null ? `Copropriété reprise de la facture : ${facture.coproprieteId}.` : null
  return enregistrer(piece, 'Associé', {
    le,
    motif: [texteMotif, reprise].filter(Boolean).join(' ') || null,
    factureId: facture.id,
    coproprieteId: piece.coproprieteId ?? facture.coproprieteId,
    motifNonAssociation: null,
  })
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
