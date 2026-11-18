import { ajouterMois, composerDateIso, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'

/**
 * Contrôle des entreprises avant un ordre de service et avant un règlement (point 37 du bilan 2). Fonctions pures,
 * montants en CENTIMES ENTIERS, dates ISO, sans écran : complète assurances-entreprises.ts (échéances seules).
 *
 * Le droit — 🟢 textes lus sur Légifrance, décisions lues sur Judilibre, le 29/10/2026 :
 * - Vigilance (C. trav. art. L. 8222-1, R. 8222-1, D. 8222-5) : pour toute opération d'au moins 5 000 € HT, le donneur
 *   d'ordre se fait remettre, à la conclusion du contrat puis tous les six mois jusqu'à la fin de son exécution :
 *   1° une attestation de vigilance (organisme de recouvrement : URSSAF, CGSS ou MSA) de moins de six mois, dont il
 *   vérifie l'authenticité (D. 8222-5, 1° ; CSS art. L. 243-15 et D. 243-15, numéro de sécurité) ;
 *   2° quand l'immatriculation est obligatoire (ou pour une profession réglementée), une pièce d'immatriculation : extrait
 *   K ou K bis, extrait RNE, devis / document publicitaire / correspondance professionnelle portant nom, adresse et n°
 *   d'immatriculation, ou accusé de réception électronique (C. com. art. R. 123-6).
 *   Seule la remise de ces pièces libère le donneur d'ordre (Cass. 2e civ., 11 févr. 2016, n° 14-10.614). Entreprise
 *   établie à l'étranger : pièces de l'art. D. 8222-7, en français ou traduites (L. 8222-4, D. 8222-8). Liste des salariés
 *   étrangers soumis à autorisation de travail : à la conclusion, puis tous les six mois (L. 8254-1, D. 8254-1, D. 8254-2,
 *   D. 8254-4). Sanctions : solidarité financière (L. 8222-2, L. 8222-3), délit de recours au travail dissimulé
 *   (L. 8221-1, L. 8224-1), retenu contre le syndic qui contracte pour le syndicat (Cass. crim., 24 mai 2005,
 *   n° 04-86.813).
 * - Décennale (C. ass. art. L. 241-1, L. 243-2 ; C. civ. art. 1792 et s.) : l'entreprise dont la responsabilité décennale
 *   peut être engagée justifie de son assurance à l'ouverture du chantier ; l'attestation (modèle de l'art. A. 243-3,
 *   signée selon l'art. A. 243-2) porte une période de validité ; la garantie couvre les chantiers OUVERTS pendant cette
 *   période — sans permis de construire, la date du premier ordre de service ; avec permis, la déclaration d'ouverture
 *   (annexe I à l'art. A. 243-1). Une attestation qui expire ensuite ne fait pas perdre la garantie du chantier. Ouvrages
 *   hors assurance obligatoire : art. L. 243-1-1 (ouvrages de génie civil, réseaux, ouvrages existants non incorporés…).
 *
 * 🔵 Déduit :
 * - le syndicat est un donneur d'ordre ordinaire, pas un « particulier » au sens de L. 8222-1, 2° (personnalité civile,
 *   art. 14 de la loi de 1965) : régime complet ; de même l'administrateur provisoire, qui a les pouvoirs du syndic ;
 * - le montant comparé au seuil est celui de l'opération entière : l'appelant additionne les commandes successives de même
 *   objet avec la même entreprise (doctrine URSSAF ; Cass. 2e civ., 18 mars 2021, n° 19-23.611, rejet non motivé) ;
 * - « moins de six mois » s'apprécie à la date du contrôle (ordre de service ou règlement) ; une pièce datée APRÈS le
 *   contrôle ne prouve pas la remise à cette date : elle compte comme absente, avec une alerte de saisie.
 *
 * Recommandations validées par Hugo le 17/11/2026 (J67 ; textes lus sur Légifrance le 17/11/2026) :
 * - J67, R75 (travaux d'urgence) : la vigilance s'applique quand même. L'art. L. 8221-2 exclut les travaux d'urgence
 *   « des interdictions prévues au présent chapitre », le chapitre Ier (travail dissimulé) ; la vigilance est au
 *   chapitre II (L. 8222-1), que l'exclusion ne vise pas ; le donneur d'ordre qui ne vérifie pas reste exposé à la
 *   solidarité financière (L. 8222-2). L'administrateur provisoire doit pourtant faire exécuter d'urgence les travaux de
 *   sauvegarde (L. 1965 art. 18, I) : sous urgence constatée (OperationAControler.urgenceConstatee, J16, J46), les pièces
 *   de vigilance manquantes donnent une alerte forte au lieu d'un blocage ; envoi-ordre-service.ts en tire un élément
 *   « à faire » pour les obtenir. Sans urgence constatée, le blocage reste. La décennale n'est pas visée : elle reste
 *   bloquante ;
 * - J67, R76 (RC professionnelle) : code confirmé. Le code des assurances impose la seule assurance décennale (C. ass.
 *   art. L. 241-1), justifiée par attestation jointe aux devis et factures (L. 243-2) ; aucune obligation générale de RC
 *   professionnelle pour une entreprise de travaux : son échéance reste une alerte de GESTION, sans texte cité. Une
 *   profession soumise à une obligation propre (architecte, maître d'œuvre) se traitera à part, après lecture du texte
 *   (non vérifié) ;
 * - J67, R77 (sous-traitants acceptés) : C. trav. art. L. 8222-1-1, créé par la loi n° 2026-534 du 25/06/2026, art. 95,
 *   « À venir » sur Légifrance au 17/11/2026 : en vigueur à une date fixée par décret, au plus tard six mois après la
 *   promulgation, soit le 26/12/2026 (ENTREE_EN_VIGUEUR_MAX_L8222_1_1). Le maître de l'ouvrage vérifie périodiquement,
 *   jusqu'à la fin du sous-traité d'un montant minimal, que le sous-traitant qu'il accepte (loi n° 75-1334, art. 3)
 *   s'acquitte de ses formalités ; il est réputé l'avoir fait s'il se fait remettre les documents fixés par décret. Le
 *   syndicat n'est pas un « particulier » : il est concerné. Contrôle préparé (controlerSousTraitantsAcceptes,
 *   verificationsSousTraitantsDues), activé à la date du décret ; montant minimal, pièces et période à saisir quand il
 *   paraît (ReglageSousTraitantsAcceptes ; décret non trouvé publié : non vérifié). Avant, une information « nouvelle
 *   obligation au plus tard le 26/12/2026 ». Enregistrement des sous-traitants acceptés : à brancher.
 *
 * 🔴 Non établi :
 * - qualification des travaux soumis à l'assurance décennale (ouvrage au sens de l'art. 1792, hors exclusions de l'art.
 *   L. 243-1-1) : laissée à l'utilisateur (`decennaleObligatoire: null` → alerte à qualifier) ;
 * - avant un règlement, aucun texte n'impose de vérifier : VitFix ALERTE, ne bloque jamais un paiement.
 *
 * Gestéam — fiche entreprise, onglet Informations : RCS, TVA intracommunautaire, bouton « Contrôle déclaratif » ; R.C.
 * décennale et Responsabilité civile du … au, police, n°, compagnie (tranches 34, 37). Le marqueur « nécessaire » n'est
 * posé sur aucune entreprise active et, 🔵, une date vide compte comme « échue » (tranche 43 § 24) : VitFix distingue la
 * pièce ABSENTE de la pièce ÉCHUE. Attestation de vigilance et Kbis : types de document de la GED, sans date suivie.
 */

/** C. trav. art. R. 8222-1 : opération d'un montant au moins égal à 5 000 € hors taxes. */
export const SEUIL_VIGILANCE_HT_CENTIMES = 500_000
/** C. trav. art. D. 8222-5 et D. 8254-4 : attestation de moins de six mois, pièces remises tous les six mois. */
export const VALIDITE_VIGILANCE_MOIS = 6

export const NATURES_IMMATRICULATION = ['kbis', 'extrait_rne', 'document_professionnel', 'accuse_reception_r123_6'] as const
export type NatureImmatriculation = (typeof NATURES_IMMATRICULATION)[number]

const FONDEMENT_VIGILANCE = 'C. trav. art. L. 8222-1, R. 8222-1, D. 8222-5'
const FONDEMENT_AUTHENTICITE = 'C. trav. art. D. 8222-5, 1° ; CSS art. D. 243-15'
const FONDEMENT_ETRANGER = 'C. trav. art. L. 8222-4, D. 8222-7, D. 8222-8'
const FONDEMENT_SALARIES_ETRANGERS = 'C. trav. art. L. 8254-1, D. 8254-1, D. 8254-2, D. 8254-4'
const FONDEMENT_DECENNALE = 'C. ass. art. L. 241-1, L. 243-2'

export interface PeriodeAttestation {
  du: string | null
  au: string | null
  police?: string | null
  compagnie?: string | null
  /** Activités couvertes, telles que l'attestation les énumère. */
  activites?: readonly string[] | null
}

export interface PiecesEntreprise {
  prestataireId: string
  etablieEnFrance: boolean
  /** Date de l'attestation de vigilance remise (URSSAF, CGSS ou MSA). */
  attestationUrssafLe: string | null
  /** Authenticité vérifiée auprès de l'organisme (numéro de sécurité de l'attestation). */
  attestationUrssafVerifiee?: boolean
  /** Immatriculation obligatoire (RCS, RNE) ou profession réglementée ; par défaut, oui (D. 8222-5, 2°). */
  immatriculationObligatoire?: boolean
  immatriculation: { nature: NatureImmatriculation; le: string } | null
  /** Liste des salariés étrangers soumis à autorisation de travail, remise le. */
  listeSalariesEtrangersLe?: string | null
  /** Pièces d'une entreprise établie à l'étranger (art. D. 8222-7), remises le. */
  piecesEtrangerLe?: string | null
  decennale?: PeriodeAttestation | null
  /** RC professionnelle : suivi de gestion. */
  rcp?: PeriodeAttestation | null
}

export type GraviteAnomalieEntreprise = 'bloquant' | 'alerte'

export type CodeAnomalieEntreprise =
  | 'vigilance_urssaf_absente'
  | 'vigilance_urssaf_perimee'
  | 'vigilance_urssaf_non_verifiee'
  | 'immatriculation_absente'
  | 'immatriculation_a_renouveler'
  | 'pieces_etranger_absentes'
  | 'pieces_etranger_a_renouveler'
  | 'liste_salaries_etrangers_absente'
  | 'liste_salaries_etrangers_a_renouveler'
  | 'piece_datee_apres_controle'
  | 'vigilance_jamais_remise'
  | 'vigilance_semestrielle_depassee'
  | 'decennale_absente'
  | 'decennale_periode_incomplete'
  | 'decennale_hors_periode'
  | 'decennale_activite_non_couverte'
  | 'decennale_a_qualifier'
  | 'ouverture_chantier_inconnue'
  | 'rcp_echue'
  | 'sous_traitants_obligation_a_venir'
  | 'sous_traitants_valeurs_decret_a_saisir'
  | 'sous_traitant_piece_a_obtenir'

export interface AnomalieEntreprise {
  code: CodeAnomalieEntreprise
  gravite: GraviteAnomalieEntreprise
  message: string
  /** Texte qui fonde l'anomalie ; null pour une règle de gestion ou une erreur de saisie. */
  fondement: string | null
  aConfirmer: boolean
}

export interface OperationAControler {
  /** Date du contrôle : celle de l'ordre de service. */
  date: string
  /** Montant hors taxes de l'opération entière (commandes successives de même objet additionnées). */
  montantHtCentimes: number
  /**
   * Travaux soumis à l'assurance décennale obligatoire (ouvrage au sens de l'art. 1792, hors exclusions de l'art.
   * L. 243-1-1) ? null : à qualifier.
   */
  decennaleObligatoire: boolean | null
  /** Ouverture du chantier : premier ordre de service, ou déclaration d'ouverture avec permis ; à défaut, `date`. */
  dateOuvertureChantier?: string | null
  /** Activité commandée, à retrouver parmi les activités couvertes par la décennale. */
  activite?: string | null
  /**
   * Urgence constatée par l'administrateur provisoire (J16, J46) : les pièces de vigilance manquantes donnent une alerte
   * forte au lieu d'un blocage (J67, R75 ; C. trav. art. L. 8221-2 et L. 8222-1). La décennale n'est pas visée.
   */
  urgenceConstatee?: boolean
}

export interface ReglementAControler {
  /** Date du règlement. */
  date: string
  /** Montant hors taxes de l'opération entière (et non celui du seul règlement). */
  montantHtCentimes: number
  /** Travaux soumis à la décennale ; null : à qualifier ; absent : pas de contrôle de la décennale. */
  decennaleObligatoire?: boolean | null
  /** Ouverture du chantier : premier ordre de service, ou déclaration d'ouverture avec permis. */
  dateOuvertureChantier?: string | null
}

const verifierDate = (quoi: string, valeur: string | null | undefined): void => {
  if (valeur != null && !estDateIsoValide(valeur)) throw new Error(`Date invalide pour ${quoi} (${valeur}) : AAAA-MM-JJ attendu.`)
}

function verifierSaisie(pieces: PiecesEntreprise, date: string, montantHtCentimes: number): void {
  if (!estDateIsoValide(date)) throw new Error(`Date du contrôle invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (!Number.isInteger(montantHtCentimes) || montantHtCentimes < 0)
    throw new Error(`Montant HT invalide (${montantHtCentimes}) : centimes entiers positifs ou nuls attendus.`)
  verifierDate("l'attestation de vigilance URSSAF", pieces.attestationUrssafLe)
  if (pieces.immatriculation) {
    if (!(NATURES_IMMATRICULATION as readonly string[]).includes(pieces.immatriculation.nature))
      throw new Error(`Pièce d'immatriculation inconnue : « ${pieces.immatriculation.nature} » (une attestation sur l'honneur ne suffit pas).`)
    verifierDate("la pièce d'immatriculation", pieces.immatriculation.le)
  }
  verifierDate('la liste des salariés étrangers', pieces.listeSalariesEtrangersLe)
  verifierDate("les pièces de l'entreprise étrangère", pieces.piecesEtrangerLe)
  for (const [quoi, periode] of [
    ['la décennale', pieces.decennale],
    ['la RC professionnelle', pieces.rcp],
  ] as const) {
    verifierDate(`${quoi} (début)`, periode?.du)
    verifierDate(`${quoi} (fin)`, periode?.au)
    if (periode?.du && periode.au && periode.du > periode.au)
      throw new Error(`Période de ${quoi} inversée : du ${periode.du} au ${periode.au}.`)
  }
}

type EtatPiece = 'absente' | 'datee_apres' | 'perimee' | 'valide'

/** Une pièce « de moins de six mois » à la date du contrôle. */
const etatPiece = (le: string | null | undefined, date: string): EtatPiece => {
  if (!le) return 'absente'
  if (le > date) return 'datee_apres'
  return date < ajouterMois(le, VALIDITE_VIGILANCE_MOIS) ? 'valide' : 'perimee'
}

const anomalie = (
  code: CodeAnomalieEntreprise,
  gravite: GraviteAnomalieEntreprise,
  message: string,
  fondement: string | null,
  aConfirmer = false,
): AnomalieEntreprise => ({ code, gravite, message, fondement, aConfirmer })

const normaliser = (texte: string) =>
  texte
    .replace(/[œŒ]/g, 'oe')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[’‘`´]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

interface PieceControlee {
  le: string | null | undefined
  libelle: string
  absente: CodeAnomalieEntreprise
  aRenouveler: CodeAnomalieEntreprise
  fondement: string
  /** Gravité propre (la liste des salariés étrangers reste une alerte). */
  gravite?: GraviteAnomalieEntreprise
}

/** Pièces de vigilance exigées : attestation, immatriculation (si obligatoire) ou pièces étrangères, liste des salariés étrangers. */
const piecesExigees = (pieces: PiecesEntreprise): PieceControlee[] => [
  ...(pieces.etablieEnFrance
    ? [
        {
          le: pieces.attestationUrssafLe,
          libelle: 'Attestation de vigilance (URSSAF, CGSS ou MSA)',
          absente: 'vigilance_urssaf_absente' as const,
          aRenouveler: 'vigilance_urssaf_perimee' as const,
          fondement: FONDEMENT_VIGILANCE,
        },
        ...(pieces.immatriculationObligatoire === false
          ? []
          : [
              {
                le: pieces.immatriculation?.le,
                libelle: "Pièce d'immatriculation (extrait K ou K bis, extrait RNE, document professionnel, accusé de réception R. 123-6)",
                absente: 'immatriculation_absente' as const,
                aRenouveler: 'immatriculation_a_renouveler' as const,
                fondement: FONDEMENT_VIGILANCE,
              },
            ]),
      ]
    : [
        {
          le: pieces.piecesEtrangerLe,
          libelle: "Pièces de l'entreprise établie à l'étranger (identification, régularité sociale, registre professionnel), en français ou traduites",
          absente: 'pieces_etranger_absentes' as const,
          aRenouveler: 'pieces_etranger_a_renouveler' as const,
          fondement: FONDEMENT_ETRANGER,
        },
      ]),
  {
    le: pieces.listeSalariesEtrangersLe,
    libelle: 'Liste des salariés étrangers soumis à autorisation de travail',
    absente: 'liste_salaries_etrangers_absente',
    aRenouveler: 'liste_salaries_etrangers_a_renouveler',
    fondement: FONDEMENT_SALARIES_ETRANGERS,
    gravite: 'alerte',
  },
]

/** Moment du contrôle : avant l'OS, avant l'OS sous urgence constatée (J67, R75), ou avant un règlement. */
type MomentVigilance = 'ordre' | 'urgence' | 'reglement'

/** Ce qu'il faut faire de la pièce, selon le moment du contrôle. */
const QUAND_PAR_MOMENT: Readonly<Record<MomentVigilance, string>> = {
  ordre: 'avant de commander',
  urgence:
    "dès que possible : urgence constatée, l'ordre de service part sans elle, alerte forte au lieu d'un blocage (J67, R75 ; C. trav. art. L. 8221-2 : l'exclusion des travaux d'urgence ne vise pas la vigilance), élément « à faire » pour l'obtenir",
  reglement: 'pendant l’exécution',
}

/**
 * Vigilance à la date `date`, avec la gravité `gravite` (sauf la liste des salariés étrangers, toujours en alerte). Une
 * pièce datée après le contrôle compte comme absente, avec une alerte de saisie en plus.
 */
function controlerVigilance(
  pieces: PiecesEntreprise,
  date: string,
  gravite: GraviteAnomalieEntreprise,
  moment: MomentVigilance,
): AnomalieEntreprise[] {
  const anomalies: AnomalieEntreprise[] = []
  const quand = QUAND_PAR_MOMENT[moment]
  for (const piece of piecesExigees(pieces)) {
    const etat = etatPiece(piece.le, date)
    const g = piece.gravite ?? gravite
    if (etat === 'datee_apres')
      anomalies.push(
        anomalie(
          'piece_datee_apres_controle',
          'alerte',
          `${piece.libelle} : date du ${dateIsoVersFr(piece.le as string)}, postérieure au contrôle du ${dateIsoVersFr(date)} ; vérifier la saisie.`,
          null,
        ),
      )
    if (etat === 'absente' || etat === 'datee_apres')
      anomalies.push(anomalie(piece.absente, g, `${piece.libelle} : aucune pièce valable à la date du contrôle, à se faire remettre ${quand}.`, piece.fondement))
    else if (etat === 'perimee')
      anomalies.push(
        anomalie(
          piece.aRenouveler,
          g,
          `${piece.libelle} du ${dateIsoVersFr(piece.le as string)} : à renouveler (moins de ${VALIDITE_VIGILANCE_MOIS} mois, à la conclusion puis tous les ${VALIDITE_VIGILANCE_MOIS} mois jusqu'à la fin de l'exécution).`,
          piece.fondement,
        ),
      )
    else if (piece.absente === 'vigilance_urssaf_absente' && pieces.attestationUrssafVerifiee !== true)
      anomalies.push(
        anomalie(
          'vigilance_urssaf_non_verifiee',
          gravite,
          "Authenticité de l'attestation de vigilance non vérifiée : la contrôler avec son numéro de sécurité auprès de l'organisme.",
          FONDEMENT_AUTHENTICITE,
        ),
      )
  }
  return anomalies
}

/** Décennale : attestation dont la période couvre l'ouverture du chantier (`ouverture`). */
function controlerDecennale(
  decennale: PeriodeAttestation | null | undefined,
  ouverture: string,
  gravite: GraviteAnomalieEntreprise,
  activite: string | null | undefined,
): AnomalieEntreprise[] {
  if (!decennale)
    return [anomalie('decennale_absente', gravite, "Travaux soumis à l'assurance décennale : attestation absente.", FONDEMENT_DECENNALE)]
  if (!decennale.du || !decennale.au)
    return [
      anomalie(
        'decennale_periode_incomplete',
        gravite,
        "Attestation décennale sans période de validité complète (du … au) : impossible de vérifier qu'elle couvre l'ouverture du chantier.",
        FONDEMENT_DECENNALE,
      ),
    ]
  if (ouverture < decennale.du || ouverture > decennale.au)
    return [
      anomalie(
        'decennale_hors_periode',
        gravite,
        `Attestation décennale valable du ${dateIsoVersFr(decennale.du)} au ${dateIsoVersFr(decennale.au)} : elle ne couvre pas l'ouverture du chantier du ${dateIsoVersFr(ouverture)}.`,
        FONDEMENT_DECENNALE,
      ),
    ]
  const activites = decennale.activites ?? []
  if (activite?.trim() && activites.length > 0 && !activites.some((a) => normaliser(a) === normaliser(activite)))
    return [
      anomalie(
        'decennale_activite_non_couverte',
        'alerte',
        `Activité « ${activite.trim()} » absente des activités couvertes par l'attestation décennale : vérifier la couverture.`,
        FONDEMENT_DECENNALE,
        true,
      ),
    ]
  return []
}

const decennaleAQualifier = (): AnomalieEntreprise =>
  anomalie(
    'decennale_a_qualifier',
    'alerte',
    "Dire si les travaux sont soumis à l'assurance décennale (ouvrage au sens de l'art. 1792 du code civil, hors exclusions de l'art. L. 243-1-1 du code des assurances).",
    FONDEMENT_DECENNALE,
    true,
  )

/**
 * Contrôle avant l'envoi d'un ordre de service : vigilance (au-delà du seuil) et décennale BLOQUANTES, alertes pour le
 * reste. Lève une erreur sur une saisie invalide ; renvoie les anomalies (vide si tout va bien).
 */
export function controlerAvantOrdreService(pieces: PiecesEntreprise, operation: OperationAControler): AnomalieEntreprise[] {
  verifierSaisie(pieces, operation.date, operation.montantHtCentimes)
  verifierDate("l'ouverture du chantier", operation.dateOuvertureChantier)
  const anomalies: AnomalieEntreprise[] = []
  if (operation.montantHtCentimes >= SEUIL_VIGILANCE_HT_CENTIMES)
    anomalies.push(
      ...(operation.urgenceConstatee === true
        ? controlerVigilance(pieces, operation.date, 'alerte', 'urgence')
        : controlerVigilance(pieces, operation.date, 'bloquant', 'ordre')),
    )
  if (operation.decennaleObligatoire === true)
    anomalies.push(...controlerDecennale(pieces.decennale, operation.dateOuvertureChantier ?? operation.date, 'bloquant', operation.activite))
  else if (operation.decennaleObligatoire === null) anomalies.push(decennaleAQualifier())
  if (pieces.rcp?.au && pieces.rcp.au < operation.date)
    anomalies.push(
      anomalie(
        'rcp_echue',
        'alerte',
        `Responsabilité civile professionnelle échue le ${dateIsoVersFr(pieces.rcp.au)} : garde-fou de gestion du cabinet, à faire renouveler.`,
        null,
      ),
    )
  return anomalies
}

const CODES_VIGILANCE_REGROUPES: ReadonlySet<CodeAnomalieEntreprise> = new Set([
  'vigilance_urssaf_absente',
  'vigilance_urssaf_perimee',
  'immatriculation_absente',
  'immatriculation_a_renouveler',
  'pieces_etranger_absentes',
  'pieces_etranger_a_renouveler',
])
const CODES_ABSENCE: ReadonlySet<CodeAnomalieEntreprise> = new Set(['vigilance_urssaf_absente', 'immatriculation_absente', 'pieces_etranger_absentes'])

/**
 * Pièces de vigilance (attestation, authenticité, immatriculation, pièces étrangères) : sous urgence constatée, leur
 * absence donne une alerte forte et un élément « à faire » (J67, R75 ; envoi-ordre-service.ts).
 */
export const CODES_PIECES_VIGILANCE: ReadonlySet<CodeAnomalieEntreprise> = new Set<CodeAnomalieEntreprise>([
  ...CODES_VIGILANCE_REGROUPES,
  'vigilance_urssaf_non_verifiee',
])

/**
 * Contrôle avant un règlement, pendant l'exécution : ALERTES seulement, aucun texte n'imposant de vérifier à chaque
 * paiement. Au-delà du seuil, pièces de vigilance jamais remises ou de plus de six mois (regroupées), liste des salariés
 * étrangers, saisies incohérentes ; pour des travaux soumis à la décennale, attestation qui ne couvrait pas l'ouverture du
 * chantier.
 */
export function controlerAvantReglement(pieces: PiecesEntreprise, reglement: ReglementAControler): AnomalieEntreprise[] {
  const { date, montantHtCentimes, decennaleObligatoire, dateOuvertureChantier = null } = reglement
  verifierSaisie(pieces, date, montantHtCentimes)
  verifierDate("l'ouverture du chantier", dateOuvertureChantier)
  const anomalies: AnomalieEntreprise[] = []
  if (montantHtCentimes >= SEUIL_VIGILANCE_HT_CENTIMES) {
    const vigilance = controlerVigilance(pieces, date, 'alerte', 'reglement')
    const regroupees = vigilance.filter((a) => CODES_VIGILANCE_REGROUPES.has(a.code))
    if (regroupees.length > 0) {
      const jamais = regroupees.some((a) => CODES_ABSENCE.has(a.code))
      anomalies.push(
        anomalie(
          jamais ? 'vigilance_jamais_remise' : 'vigilance_semestrielle_depassee',
          'alerte',
          `${regroupees.map((a) => a.message).join(' ')} Alerte seulement : aucun texte n'impose de suspendre le paiement.`,
          [...new Set(regroupees.map((a) => a.fondement))].join(' ; '),
        ),
      )
    }
    anomalies.push(...vigilance.filter((a) => !CODES_VIGILANCE_REGROUPES.has(a.code)))
  }
  if (decennaleObligatoire === true) {
    if (dateOuvertureChantier) anomalies.push(...controlerDecennale(pieces.decennale, dateOuvertureChantier, 'alerte', null))
    else
      anomalies.push(
        anomalie(
          'ouverture_chantier_inconnue',
          'alerte',
          "Date d'ouverture du chantier inconnue (premier ordre de service, ou déclaration d'ouverture avec permis) : impossible de vérifier que l'attestation décennale la couvrait.",
          FONDEMENT_DECENNALE,
        ),
      )
  } else if (decennaleObligatoire === null) anomalies.push(decennaleAQualifier())
  return anomalies
}

// ─── Sous-traitants acceptés (C. trav. art. L. 8222-1-1 ; J67, R77) ──────────────────────────

/**
 * C. trav. art. L. 8222-1-1 (loi n° 2026-534 du 25/06/2026, art. 95 ; version « À venir » lue sur Légifrance le
 * 17/11/2026) : en vigueur à une date fixée par décret, et au plus tard six mois après la promulgation, soit le 26/12/2026.
 */
export const ENTREE_EN_VIGUEUR_MAX_L8222_1_1 = composerDateIso(2026, 12, 26)

const FONDEMENT_SOUS_TRAITANTS = 'C. trav. art. L. 8222-1-1'

/** Valeurs du décret d'application (non trouvé publié au 17/11/2026 : non vérifié), à saisir quand il paraît (J67, R77). */
export interface ReglageSousTraitantsAcceptes {
  /** Date d'entrée en vigueur fixée par le décret ; null : non fixée (au plus tard ENTREE_EN_VIGUEUR_MAX_L8222_1_1). */
  entreeEnVigueurLe: string | null
  /** Montant minimal du sous-traité, hors taxes ; null : non publié. */
  montantMinimalHtCentimes: number | null
  /** Documents à se faire remettre (natures) ; null : non publiés. */
  piecesExigees: readonly string[] | null
  /** Période de la vérification, en mois ; null : non publiée. */
  periodiciteMois: number | null
}

/** Rien n'est encore fixé par décret : l'obligation s'active au plus tard le 26/12/2026, ses valeurs restent à saisir. */
export const REGLAGE_SOUS_TRAITANTS_PAR_DEFAUT: ReglageSousTraitantsAcceptes = Object.freeze({
  entreeEnVigueurLe: null,
  montantMinimalHtCentimes: null,
  piecesExigees: null,
  periodiciteMois: null,
})

export interface PieceSousTraitant {
  nature: string
  le: string
}

/** Sous-traitant accepté par le syndicat, maître de l'ouvrage (loi n° 75-1334, art. 3). Enregistrement : à brancher. */
export interface SousTraitantAccepte {
  sousTraitantId: string
  /** Marché principal (demande ou ordre de service) dont relève le sous-traité. */
  marcheId: string
  /** Date de l'acceptation du sous-traitant. */
  accepteLe: string
  /** Montant hors taxes du sous-traité. */
  montantHtCentimes: number
  /** Fin du sous-traité ; null : en cours. */
  finLe: string | null
  /** Documents remis par le sous-traitant. */
  pieces: readonly PieceSousTraitant[]
}

/** Vérification périodique due (élément « à faire »), avec sa justification. */
export interface VerificationSousTraitantDue {
  id: string
  sousTraitantId: string
  marcheId: string
  /** Date à laquelle la vérification est due. */
  date: string
  /** Documents à se faire remettre à cette date. */
  pieces: string[]
  justification: string
}

interface ValeursDecret {
  montantMinimalHtCentimes: number
  piecesExigees: readonly string[]
  periodiciteMois: number
}

interface EcheanceDocument {
  date: string
  justification: string
}

/** Début de l'obligation : la date du décret, jamais après le 26/12/2026 ; à défaut, le 26/12/2026. */
function debutObligation(reglage: ReglageSousTraitantsAcceptes): string {
  const fixee = reglage.entreeEnVigueurLe
  if (fixee === null) return ENTREE_EN_VIGUEUR_MAX_L8222_1_1
  verifierDate("l'entrée en vigueur de l'art. L. 8222-1-1", fixee)
  if (fixee > ENTREE_EN_VIGUEUR_MAX_L8222_1_1)
    throw new Error(
      `Entrée en vigueur de l'art. L. 8222-1-1 le ${dateIsoVersFr(fixee)} : au plus tard le ${dateIsoVersFr(ENTREE_EN_VIGUEUR_MAX_L8222_1_1)} (six mois après la promulgation de la loi n° 2026-534).`,
    )
  return fixee
}

/** Valeurs du décret, toutes saisies ; null s'il en manque une. */
function valeursDecret(reglage: ReglageSousTraitantsAcceptes): ValeursDecret | null {
  const { montantMinimalHtCentimes, piecesExigees, periodiciteMois } = reglage
  if (montantMinimalHtCentimes === null || piecesExigees === null || piecesExigees.length === 0 || periodiciteMois === null) return null
  if (!Number.isInteger(montantMinimalHtCentimes) || montantMinimalHtCentimes < 0 || !Number.isInteger(periodiciteMois) || periodiciteMois < 1)
    throw new Error('Valeurs du décret (art. L. 8222-1-1) invalides : montant en centimes entiers, période en mois entiers à partir de 1.')
  return { montantMinimalHtCentimes, piecesExigees, periodiciteMois }
}

function verifierSousTraitant(st: SousTraitantAccepte): void {
  if (!estDateIsoValide(st.accepteLe))
    throw new Error(`Sous-traitant ${st.sousTraitantId} : date d'acceptation invalide (${st.accepteLe}) : AAAA-MM-JJ attendu.`)
  verifierDate(`la fin du sous-traité ${st.sousTraitantId}`, st.finLe)
  if (!Number.isInteger(st.montantHtCentimes) || st.montantHtCentimes < 0)
    throw new Error(`Sous-traitant ${st.sousTraitantId} : montant HT en centimes entiers positifs attendu.`)
  for (const piece of st.pieces) verifierDate(`le document « ${piece.nature} » du sous-traitant ${st.sousTraitantId}`, piece.le)
}

/**
 * Échéance d'un document : sa dernière remise (au plus tard `jusquau`) plus la période du décret ; jamais remis : dû dès
 * l'acceptation du sous-traitant, ou dès l'entrée en vigueur si elle est postérieure.
 */
function echeanceDocument(st: SousTraitantAccepte, nature: string, valeurs: ValeursDecret, debut: string, jusquau: string | null): EcheanceDocument {
  const remises = st.pieces.filter((p) => p.nature === nature && (jusquau === null || p.le <= jusquau)).map((p) => p.le)
  const derniere = remises.sort((a, b) => a.localeCompare(b)).at(-1)
  if (derniere === undefined) {
    const date = st.accepteLe > debut ? st.accepteLe : debut
    return {
      date,
      justification: `aucun document « ${nature} » remis : dû dès le ${dateIsoVersFr(date)} (acceptation du sous-traitant le ${dateIsoVersFr(st.accepteLe)}, obligation en vigueur le ${dateIsoVersFr(debut)})`,
    }
  }
  const date = ajouterMois(derniere, valeurs.periodiciteMois)
  return {
    date,
    justification: `document « ${nature} » remis le ${dateIsoVersFr(derniere)}, à renouveler tous les ${valeurs.periodiciteMois} mois (période fixée par décret) : dû le ${dateIsoVersFr(date)}`,
  }
}

/** Sous-traité d'au moins le montant minimal, en cours à la date ; sans date : non terminé. */
function sousTraiteConcerne(st: SousTraitantAccepte, valeurs: ValeursDecret, date: string | null): boolean {
  if (st.montantHtCentimes < valeurs.montantMinimalHtCentimes) return false
  if (date === null) return st.finLe === null
  return st.accepteLe <= date && (st.finLe === null || st.finLe >= date)
}

/**
 * Contrôle des sous-traitants acceptés à `date` (J67, R77 ; C. trav. art. L. 8222-1-1) : avant l'entrée en vigueur, une
 * information « nouvelle obligation au plus tard le 26/12/2026 » ; en vigueur sans les valeurs du décret, une alerte à
 * confirmer ; ensuite, pour chaque sous-traité d'au moins le montant minimal en cours à la date, une alerte par document
 * à se faire remettre (jamais remis, ou remis depuis la période du décret). Alertes seulement : le texte organise une
 * vérification, il ne fait pas bloquer le marché.
 */
export function controlerSousTraitantsAcceptes(
  sousTraitants: readonly SousTraitantAccepte[],
  reglage: ReglageSousTraitantsAcceptes,
  date: string,
): AnomalieEntreprise[] {
  if (!estDateIsoValide(date)) throw new Error(`Date du contrôle invalide (${date}) : AAAA-MM-JJ attendu.`)
  sousTraitants.forEach(verifierSousTraitant)
  const debut = debutObligation(reglage)
  if (date < debut)
    return [
      anomalie(
        'sous_traitants_obligation_a_venir',
        'alerte',
        `Nouvelle obligation au plus tard le ${dateIsoVersFr(ENTREE_EN_VIGUEUR_MAX_L8222_1_1)} (loi n° 2026-534 du 25/06/2026) : vérifier périodiquement, jusqu'à la fin du sous-traité, que chaque sous-traitant accepté s'acquitte de ses formalités ; contrôle activé le ${dateIsoVersFr(debut)}${reglage.entreeEnVigueurLe === null ? ' au plus tard (date du décret à saisir)' : ''}.`,
        FONDEMENT_SOUS_TRAITANTS,
      ),
    ]
  const valeurs = valeursDecret(reglage)
  if (valeurs === null)
    return [
      anomalie(
        'sous_traitants_valeurs_decret_a_saisir',
        'alerte',
        `Obligation en vigueur depuis le ${dateIsoVersFr(debut)} : montant minimal du sous-traité, documents et période fixés par décret à saisir ; les sous-traitants acceptés ne peuvent pas encore être contrôlés.`,
        FONDEMENT_SOUS_TRAITANTS,
        true,
      ),
    ]
  return sousTraitants
    .filter((st) => sousTraiteConcerne(st, valeurs, date))
    .flatMap((st) =>
      valeurs.piecesExigees
        .map((nature) => echeanceDocument(st, nature, valeurs, debut, date))
        .filter((echeance) => echeance.date <= date)
        .map((echeance) =>
          anomalie(
            'sous_traitant_piece_a_obtenir',
            'alerte',
            `Sous-traitant ${st.sousTraitantId} (marché ${st.marcheId}) : ${echeance.justification} ; se le faire remettre.`,
            FONDEMENT_SOUS_TRAITANTS,
          ),
        ),
    )
}

/**
 * Prochaine vérification de chaque sous-traité en cours d'au moins le montant minimal (élément « à faire » périodique ;
 * J67, R77) : la plus proche échéance de ses documents, avec ceux qui sont dus ce jour-là et la justification. Aucune
 * sans les valeurs du décret. Branchement au suivi « à faire » : à faire.
 */
export function verificationsSousTraitantsDues(
  sousTraitants: readonly SousTraitantAccepte[],
  reglage: ReglageSousTraitantsAcceptes,
): VerificationSousTraitantDue[] {
  sousTraitants.forEach(verifierSousTraitant)
  const debut = debutObligation(reglage)
  const valeurs = valeursDecret(reglage)
  if (valeurs === null) return []
  return sousTraitants
    .filter((st) => sousTraiteConcerne(st, valeurs, null))
    .map((st): VerificationSousTraitantDue => {
      const echeances = valeurs.piecesExigees.map((nature) => ({ nature, ...echeanceDocument(st, nature, valeurs, debut, null) }))
      const date = echeances.map((e) => e.date).sort((a, b) => a.localeCompare(b))[0]
      const dues = echeances.filter((e) => e.date === date)
      return {
        id: `vigilance:sous_traitant:${st.marcheId}:${st.sousTraitantId}`,
        sousTraitantId: st.sousTraitantId,
        marcheId: st.marcheId,
        date,
        pieces: dues.map((e) => e.nature),
        justification: `${dues.map((e) => e.justification).join(' ; ')} (${FONDEMENT_SOUS_TRAITANTS}).`,
      }
    })
}
