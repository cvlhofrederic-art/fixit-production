import { ajouterMois, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'

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
 * 🔴 Non établi :
 * - qualification des travaux soumis à l'assurance décennale (ouvrage au sens de l'art. 1792, hors exclusions de l'art.
 *   L. 243-1-1) : laissée à l'utilisateur (`decennaleObligatoire: null` → alerte à qualifier) ;
 * - travaux d'urgence : l'art. L. 8221-2 les exclut des interdictions du chapitre I, sans dire si la vigilance du
 *   chapitre II s'efface ; VitFix contrôle quand même ;
 * - avant un règlement, aucun texte n'impose de vérifier : VitFix ALERTE, ne bloque jamais un paiement ;
 * - RC professionnelle : aucune obligation légale générale relevée ; son échéance est une alerte de GESTION ;
 * - art. L. 8222-1-1 (vigilance sur les sous-traitants acceptés), loi n° 2026-534, en vigueur au plus tard le 26/12/2026,
 *   décret des pièces non publié : à intégrer à son entrée en vigueur.
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

/**
 * Vigilance à la date `date`, avec la gravité `gravite` (sauf la liste des salariés étrangers, toujours en alerte). Une
 * pièce datée après le contrôle compte comme absente, avec une alerte de saisie en plus.
 */
function controlerVigilance(
  pieces: PiecesEntreprise,
  date: string,
  gravite: GraviteAnomalieEntreprise,
  moment: 'ordre' | 'reglement',
): AnomalieEntreprise[] {
  const anomalies: AnomalieEntreprise[] = []
  const quand = moment === 'ordre' ? 'avant de commander' : 'pendant l’exécution'
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
  if (operation.montantHtCentimes >= SEUIL_VIGILANCE_HT_CENTIMES) anomalies.push(...controlerVigilance(pieces, operation.date, 'bloquant', 'ordre'))
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
