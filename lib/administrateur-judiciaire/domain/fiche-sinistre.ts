import {
  ajouterMois,
  dateIsoVersFr,
  estDateIsoValide,
  messagePlausibilite,
  plausibiliteDate,
} from '@/lib/administrateur-judiciaire/domain/dates'
import { parserMontant } from '@/lib/administrateur-judiciaire/domain/import/csv'
import {
  controlerChronologieSinistre,
  controlerPlausibiliteDatesSinistre,
  creerSinistre,
  erreursSaisieSinistre,
  statutSinistre,
  type AssuranceSinistre,
  type FicheSinistre,
  type SaisieSinistre,
} from '@/lib/administrateur-judiciaire/domain/sinistres'
import type { PhaseSinistre, StatutSinistre, TypeSinistre } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Fiche sinistre complète sur le modèle de Gestéam (tranches 20, 28, 42, 43 ; constat du 06/11/2026 sur la « Liste des
 * Sinistres » de Gestéam 5.4.23). Fonctions pures, dates ISO (AAAA-MM-JJ), montants en CENTIMES ENTIERS.
 *
 * - Contrôles de la fiche entière (controlerFicheSinistre) : ils COMPOSENT la chronologie et la plausibilité de
 *   domain/sinistres (contrats inchangés) et y ajoutent l'ouverture du dossier, la forclusion, l'heure d'expertise, le
 *   statut ⇔ « Clos le », les indemnités réglées et le numéro unique. Niveau « bloquant » : la fiche ne s'enregistre
 *   pas ; « alerte » : signalée, enregistrable.
 * - Statut : une seule source de vérité, la date « Clos le » (statutSinistre) ; le statut choisi à l'écran (bouton
 *   En cours / Terminé de Gestéam) n'est que contrôlé, jamais stocké. La phase, saisie, ne se déduit jamais des dates.
 * - Forclusion : Gestéam ne la calcule pas (tranche 43, § 5). VitFix ne l'invente pas : suggestionForclusion propose
 *   une date 🔵 À CONFIRMER, que l'utilisateur reprend ou non ; elle n'est jamais recopiée d'office.
 *   C. assur. art. L. 114-1 relu sur Légifrance le 06/11/2026 (version en vigueur depuis le 30/12/2021, loi
 *   n° 2021-1837, art. 4) : deux ans à compter de l'événement qui donne naissance à l'action ; en cas de sinistre, du
 *   jour où les intéressés en ont eu connaissance s'ils prouvent l'avoir ignoré jusque-là (2°) ; recours d'un tiers :
 *   du jour où le tiers a agi en justice contre l'assuré ou a été indemnisé par lui ; cinq ans pour les dommages des
 *   mouvements de terrain consécutifs à la sécheresse-réhydratation des sols reconnus catastrophe naturelle (L. 125-1).
 *   Interruption : art. L. 114-2 (causes ordinaires, désignation d'experts, lettre recommandée).
 *   🔴 À confirmer avec Hugo : « Forclusion », au cabinet, désigne-t-il cette prescription biennale (hypothèse retenue)
 *   ou la limite de déclaration de l'art. L. 113-2 ?
 */

export type NiveauAnomalieFiche = 'bloquant' | 'alerte'

/** Champ visé par une anomalie : un champ de la fiche, ou le statut choisi à l'écran. */
export type ChampAnomalieFiche = keyof FicheSinistre | 'statut'

export interface AnomalieFiche {
  champ: ChampAnomalieFiche
  niveau: NiveauAnomalieFiche
  message: string
}

/** Contrat d'assurance choisi dans la liste « Contrat » : compagnie et n° de police qu'il porte. */
export interface ContratChoisiFiche {
  compagnie: string | null
  numeroPolice: string | null
}

export interface ContexteControleFiche {
  /** Jour courant (AAAA-MM-JJ) : plausibilité des dates. */
  aujourdhui: string
  /** Statut choisi à l'écran (bouton En cours / Terminé) ; absent : rien à contrôler, le statut se lit sur « Clos le ». */
  statutSaisi?: StatutSinistre | null
  /**
   * Numéros des AUTRES fiches (doublon refusé) ; celui de la fiche contrôlée en est exclu par l'appelant
   * (numerosAttribues). Une valeur qui n'est pas un texte est ignorée.
   */
  numerosExistants?: readonly (string | null | undefined)[]
  /** Contrat choisi (assurance.contratId) : compagnie ou police saisies différentes signalées ; absent : rien à contrôler. */
  contratChoisi?: ContratChoisiFiche | null
  /**
   * Fiches de la copropriété de la fiche (l'immeuble et ses copropriétaires) : une partie « Immeuble » ou « Personne »
   * rattachée à une autre fiche (ancienne copropriété, fiche supprimée) est signalée ; absent : rien à contrôler.
   */
  refsCopropriete?: readonly string[] | null
}

const bloquant = (champ: ChampAnomalieFiche, message: string): AnomalieFiche => ({ champ, niveau: 'bloquant', message })
const alerte = (champ: ChampAnomalieFiche, message: string): AnomalieFiche => ({ champ, niveau: 'alerte', message })

/**
 * Numéro lu tel quel s'il est un texte ; vide sinon. Les numéros viennent aussi de lignes de la base écrites hors de
 * l'application (reprise, import), dont le n° peut être un nombre ou un objet : ignorés, jamais d'exception.
 */
const texteNumero = (numero: unknown): string => (typeof numero === 'string' ? numero : '')

const cleNumero = (numero: unknown): string => texteNumero(numero).replace(/\s+/g, '').toUpperCase()

/** Texte comparé sans tenir compte de la casse ni des espaces répétés. */
const cleTexte = (texte: string): string => texte.replace(/\s+/g, ' ').trim().toLocaleUpperCase('fr-FR')

/** Vrai si les deux textes sont renseignés et diffèrent (casse et espaces ignorés). */
const differents = (saisi: string | null, attendu: string | null): boolean =>
  !!saisi?.trim() && !!attendu?.trim() && cleTexte(saisi) !== cleTexte(attendu)

/**
 * Forclusion plausible au plus 10 ans après la survenance : au-delà, faute de frappe probable. 10 ans couvre le plus
 * long délai de l'art. L. 114-1 (assurance sur la vie, bénéficiaire distinct du souscripteur) et les cinq ans de la
 * sécheresse-réhydratation (catastrophe naturelle) ; ANNEES_A_VENIR_MAX (3 ans) n'est pas repris pour cette raison.
 */
const FORCLUSION_ANNEES_MAX = 10

/** Dates propres à la fiche Gestéam : ouverture après la survenance, clôture après l'ouverture, forclusion après la survenance. */
function anomaliesDatesGesteam(fiche: FicheSinistre, aujourdhui: string): AnomalieFiche[] {
  const anomalies: AnomalieFiche[] = []
  const { dateOuverture, dateCloture, dateForclusion, dateSurvenance } = fiche
  if (dateOuverture && dateOuverture < dateSurvenance)
    anomalies.push(bloquant('dateOuverture', "Ouverture du dossier datée avant la survenance du sinistre."))
  if (dateOuverture && dateCloture && dateCloture < dateOuverture)
    anomalies.push(bloquant('dateCloture', "« Clos le » daté avant l'ouverture du dossier."))
  if (dateForclusion && dateForclusion < dateSurvenance)
    anomalies.push(bloquant('dateForclusion', 'Forclusion datée avant la survenance du sinistre.'))
  if (fiche.heureExpertise && !fiche.dateExpertise)
    anomalies.push(bloquant('heureExpertise', "Heure d'expertise saisie sans date d'expertise."))
  return [...anomalies, ...plausibiliteOuverture(dateOuverture, aujourdhui), ...plausibiliteForclusion(fiche, aujourdhui)]
}

/**
 * Forclusion saisie : année improbable, ou plus de FORCLUSION_ANNEES_MAX ans après la survenance (faute de frappe sur
 * l'année, « 2208 » pour « 2028 ») : alerte, la date reste celle saisie.
 */
function plausibiliteForclusion(fiche: FicheSinistre, aujourdhui: string): AnomalieFiche[] {
  const { dateForclusion, dateSurvenance } = fiche
  if (!dateForclusion) return []
  if (plausibiliteDate(dateForclusion, aujourdhui, { futurAdmis: true }) === 'annee_improbable')
    return [alerte('dateForclusion', messagePlausibilite('Forclusion datée', dateForclusion, 'annee_improbable'))]
  if (dateForclusion <= ajouterMois(dateSurvenance, 12 * FORCLUSION_ANNEES_MAX)) return []
  return [
    alerte(
      'dateForclusion',
      `Forclusion datée du ${dateIsoVersFr(dateForclusion)} : plus de ${FORCLUSION_ANNEES_MAX} ans après la survenance, date improbable (faute de frappe ?).`,
    ),
  ]
}

/** Compagnie ou n° de police saisis différents de ceux du contrat choisi (courrier de déclaration) : alertes. */
function anomaliesContrat(fiche: FicheSinistre, contrat: ContratChoisiFiche | null | undefined): AnomalieFiche[] {
  const { assurance } = fiche
  if (!contrat || !assurance.contratId) return []
  const anomalies: AnomalieFiche[] = []
  if (differents(assurance.compagnie, contrat.compagnie))
    anomalies.push(
      alerte(
        'assurance',
        `Compagnie « ${assurance.compagnie} » différente de celle du contrat choisi (« ${contrat.compagnie} ») : vérifier l'assureur avant la déclaration.`,
      ),
    )
  if (differents(assurance.contrat, contrat.numeroPolice))
    anomalies.push(
      alerte(
        'assurance',
        `N° du contrat « ${assurance.contrat} » différent de la police du contrat choisi (« ${contrat.numeroPolice} »).`,
      ),
    )
  return anomalies
}

/** Parties « Immeuble » ou « Personne » rattachées à une fiche absente de la copropriété de la fiche : alertes. */
function anomaliesParties(fiche: FicheSinistre, refs: readonly string[] | null | undefined): AnomalieFiche[] {
  if (!refs) return []
  return fiche.parties
    .filter((partie) => partie.nature !== 'Entreprise' && partie.refId !== null && !refs.includes(partie.refId))
    .map((partie) =>
      alerte(
        'parties',
        `Partie « ${partie.libelle} » (${partie.nature}) rattachée à une fiche d'une autre copropriété : la retirer ou la ressaisir.`,
      ),
    )
}

/** Ouverture du dossier : un fait accompli, jamais daté après aujourd'hui (année improbable : bloquant). */
function plausibiliteOuverture(dateOuverture: string | null, aujourdhui: string): AnomalieFiche[] {
  const nature = dateOuverture ? plausibiliteDate(dateOuverture, aujourdhui, { futurAdmis: false }) : null
  if (!dateOuverture || !nature) return []
  const message = messagePlausibilite('Ouverture datée', dateOuverture, nature)
  return [nature === 'annee_improbable' ? bloquant('dateOuverture', message) : alerte('dateOuverture', message)]
}

/** Statut choisi à l'écran ⇔ « Clos le » (bloquant dans les deux sens). */
function anomaliesStatut(fiche: FicheSinistre, statutSaisi: StatutSinistre | null | undefined): AnomalieFiche[] {
  if (!statutSaisi || statutSaisi === statutSinistre(fiche)) return []
  return [
    bloquant(
      'statut',
      statutSaisi === 'Terminé'
        ? 'Statut « Terminé » sans date « Clos le » : dater la clôture, ou laisser le dossier « En cours ».'
        : 'Statut « En cours » alors que « Clos le » est daté : effacer la date de clôture, ou passer le dossier « Terminé ».',
    ),
  ]
}

const INDEMNITES = [
  { libelle: 'immédiate', montant: 'indemniteImmediateCentimes', reglee: 'indemniteImmediateReglee' },
  { libelle: 'différée', montant: 'indemniteDiffereeCentimes', reglee: 'indemniteDiffereeReglee' },
] as const

/** Indemnités : « réglée » sans montant ou sans date de règlement ; dossier clos avec une indemnité non réglée. */
function anomaliesIndemnites(fiche: FicheSinistre): AnomalieFiche[] {
  const anomalies: AnomalieFiche[] = []
  for (const { libelle, montant, reglee } of INDEMNITES) {
    if (fiche[reglee] && fiche[montant] === 0) anomalies.push(alerte(reglee, `Indemnité ${libelle} cochée « réglée » sans montant.`))
    if (fiche.dateCloture && !fiche[reglee] && fiche[montant] > 0)
      anomalies.push(alerte(reglee, `Dossier clos avec une indemnité ${libelle} non réglée.`))
  }
  const reglees = INDEMNITES.some(({ montant, reglee }) => fiche[reglee] && fiche[montant] > 0)
  if (reglees && !fiche.dateReglement) anomalies.push(alerte('dateReglement', 'Indemnité réglée sans date de règlement.'))
  return anomalies
}

/** Chronologie (bloquante) et plausibilité (alerte ; une année improbable, faute de frappe, est bloquante). */
function anomaliesDatesExistantes(fiche: FicheSinistre, aujourdhui: string): AnomalieFiche[] {
  return [
    ...controlerChronologieSinistre(fiche).map((anomalie) => bloquant(anomalie.champ, anomalie.message)),
    ...controlerPlausibiliteDatesSinistre(fiche, aujourdhui).map(
      (anomalie): AnomalieFiche => ({
        champ: anomalie.champ,
        niveau: anomalie.nature === 'annee_improbable' ? 'bloquant' : 'alerte',
        message: anomalie.message,
      }),
    ),
  ]
}

/**
 * Anomalies de la fiche entière, dans l'ordre de la fiche. La déclaration n'est pas comparée à l'ouverture du dossier :
 * leur ordre n'est pas établi dans Gestéam (le courrier de déclaration peut être daté du jour d'ouverture, tranche 42).
 */
export function controlerFicheSinistre(fiche: FicheSinistre, contexte: ContexteControleFiche): AnomalieFiche[] {
  const anomalies: AnomalieFiche[] = []
  if (!fiche.coproprieteId.trim()) anomalies.push(bloquant('coproprieteId', 'Rattacher le sinistre à une copropriété.'))
  const numero = cleNumero(fiche.numero)
  if (numero && (contexte.numerosExistants ?? []).some((autre) => cleNumero(autre) === numero))
    anomalies.push(bloquant('numero', `Numéro ${fiche.numero} déjà attribué à un autre sinistre.`))
  return [
    ...anomalies,
    ...anomaliesDatesExistantes(fiche, contexte.aujourdhui),
    ...anomaliesDatesGesteam(fiche, contexte.aujourdhui),
    ...anomaliesStatut(fiche, contexte.statutSaisi),
    ...anomaliesContrat(fiche, contexte.contratChoisi),
    ...anomaliesIndemnites(fiche),
    ...anomaliesParties(fiche, contexte.refsCopropriete),
  ]
}

// ─── Montants saisis en euros ───────────────────────────────────────────────────────────────────────────────────

/**
 * Montant saisi en euros (« 1 240,50 », « 1240.5 », « 1 234,56 € ») → centimes entiers ; vide → 0 ; négatif, plus de
 * deux décimales ou illisible → null.
 */
export function saisieEurosVersCentimes(texte: string): number | null {
  if (!texte.trim()) return 0
  const euros = parserMontant(texte)
  if (euros === null || euros < 0) return null
  const centimes = Math.round(euros * 100)
  return Math.abs(euros * 100 - centimes) < 1e-6 ? centimes : null
}

/** Centimes → saisie en euros à virgule (« 1240,50 ») ; vide pour zéro. */
export const centimesVersSaisieEuros = (centimes: number): string =>
  centimes ? `${Math.trunc(centimes / 100)},${String(centimes % 100).padStart(2, '0')}` : ''

// ─── Forclusion : suggestion 🔵, jamais inventée ────────────────────────────────────────────────────────────────

export const FONDEMENT_FORCLUSION = 'C. assur. art. L. 114-1'

/** Prescription biennale (L. 114-1, al. 1). */
const DUREE_PRESCRIPTION_MOIS = 24

/** Types dont l'action peut avoir pour cause le recours d'un tiers (point de départ reporté, L. 114-1). */
const TYPES_RECOURS_TIERS: readonly TypeSinistre[] = ['Responsabilités civiles', 'Défense - Recours']

export interface SuggestionForclusion {
  /** Survenance + 24 mois : point de départ le plus précoce, donc la date la plus prudente. */
  date: string
  dureeMois: number
  base: 'survenance'
  /** Date si l'assuré prouve avoir ignoré le sinistre jusqu'à sa connaissance (L. 114-1, 2°) ; null sinon. */
  dateSiConnaissanceTardive: string | null
  marqueur: '🔵'
  aConfirmer: true
  fondement: typeof FONDEMENT_FORCLUSION
  avertissements: string[]
}

/** Données lues par la suggestion : une fiche, ou une saisie en cours (type pas encore choisi, connaissance vide). */
export interface BaseSuggestionForclusion {
  dateSurvenance: string
  dateConnaissance?: string | null
  type?: TypeSinistre | null
}

/**
 * Suggestion de date de forclusion, à confirmer : jamais recopiée dans la fiche (dateForclusion reste celle saisie).
 * Hypothèse 🔴 à confirmer avec Hugo : la « Forclusion » de Gestéam vise la prescription biennale de l'art. L. 114-1.
 */
export function suggestionForclusion(fiche: BaseSuggestionForclusion): SuggestionForclusion {
  const connaissance = fiche.dateConnaissance ?? fiche.dateSurvenance
  const dateSiConnaissanceTardive =
    connaissance > fiche.dateSurvenance ? ajouterMois(connaissance, DUREE_PRESCRIPTION_MOIS) : null
  const avertissements = [
    "Suggestion à confirmer : prescription biennale des actions dérivant du contrat d'assurance (C. assur. art. L. 114-1), interrompue notamment par la désignation d'un expert ou une lettre recommandée (art. L. 114-2). Vérifier le contrat et le dossier.",
  ]
  if (dateSiConnaissanceTardive)
    avertissements.push(
      `Si l'assuré prouve avoir ignoré le sinistre jusqu'au ${dateIsoVersFr(connaissance)}, le délai court de cette date (L. 114-1, 2°) : ${dateIsoVersFr(dateSiConnaissanceTardive)}.`,
    )
  if (fiche.type && TYPES_RECOURS_TIERS.includes(fiche.type))
    avertissements.push(
      "Recours d'un tiers : le délai ne court que du jour où le tiers a agi en justice contre l'assuré ou a été indemnisé par lui (L. 114-1).",
    )
  if (fiche.type === 'Catastrophes naturelles')
    avertissements.push(
      'Mouvements de terrain consécutifs à la sécheresse-réhydratation des sols reconnus catastrophe naturelle : prescription de cinq ans (L. 114-1, loi n° 2021-1837) 🔴 à vérifier selon la date du contrat.',
    )
  return {
    date: ajouterMois(fiche.dateSurvenance, DUREE_PRESCRIPTION_MOIS),
    dureeMois: DUREE_PRESCRIPTION_MOIS,
    base: 'survenance',
    dateSiConnaissanceTardive,
    marqueur: '🔵',
    aConfirmer: true,
    fondement: FONDEMENT_FORCLUSION,
    avertissements,
  }
}

// ─── Numéro, colonne « Lésés / situation », filtres ─────────────────────────────────────────────────────────────

/**
 * Numéro proposé 🔵 : code + « . » + rang sur 5 chiffres, rang suivant le plus grand rang déjà attribué sous ce code
 * (Gestéam : code du MANDAT ; le mandat VitFix n'a pas de code, celui de la copropriété le remplace). Modifiable ;
 * l'unicité est contrôlée par controlerFicheSinistre. Null sans code.
 */
export function proposerNumeroSinistre(
  code: string | null | undefined,
  existants: readonly (string | null | undefined)[],
): string | null {
  const prefixe = (code ?? '').trim().toUpperCase()
  if (!prefixe) return null
  const rangs = existants
    .map((numero) => /^(.+)\.(\d{5})$/.exec(texteNumero(numero).trim().toUpperCase()))
    .filter((trouve): trouve is RegExpExecArray => trouve !== null && trouve[1] === prefixe)
    .map((trouve) => Number(trouve[2]))
  return `${prefixe}.${String(Math.max(0, ...rangs) + 1).padStart(5, '0')}`
}

/** Ligne de la table « sinistres » (ou fiche de démonstration) vue par son seul numéro, de type non garanti. */
export interface LigneNumerotee {
  id: string
  numero?: unknown
}

/**
 * Numéros déjà attribués : ceux des lignes de la base AUTRES que la fiche `saufId` (null : déclaration), lignes
 * illisibles comprises (leur n° reste réservé, même si la fiche n'est pas affichée) ; un n° qui n'est pas un texte
 * (nombre, objet d'une reprise ou d'un import) est ignoré. Même liste pour la proposition et le contrôle d'unicité, à
 * l'écran comme à l'enregistrement.
 */
export function numerosAttribues(lignes: readonly LigneNumerotee[], saufId: string | null): string[] {
  return lignes.flatMap((ligne) => (ligne.id !== saufId && typeof ligne.numero === 'string' ? [ligne.numero] : []))
}

/** Colonne « Lésés / situation » de la liste Gestéam : parties communes et parties lésées, puis le lieu. */
export function lesesSituation(fiche: FicheSinistre): string {
  const leses = [
    ...(fiche.partiesCommunesLesees ? ['Parties communes'] : []),
    ...fiche.parties.filter((partie) => partie.role === 'Lésé').map((partie) => partie.libelle),
  ]
  return [leses.join(', '), fiche.lieu].filter(Boolean).join(' / ')
}

export interface FiltresSinistres {
  statut?: StatutSinistre | null
  type?: TypeSinistre | null
  phase?: PhaseSinistre | null
  coproprieteId?: string | null
}

/** Lignes qui satisfont tous les filtres renseignés (ordre conservé) ; un filtre vide est ignoré. */
export function filtrerSinistres<T extends FicheSinistre>(lignes: readonly T[], filtres: FiltresSinistres): T[] {
  return lignes.filter(
    (ligne) =>
      (!filtres.statut || statutSinistre(ligne) === filtres.statut) &&
      (!filtres.type || ligne.type === filtres.type) &&
      (!filtres.phase || ligne.phase === filtres.phase) &&
      (!filtres.coproprieteId || ligne.coproprieteId === filtres.coproprieteId),
  )
}

// ─── Relecture d'une ligne de la base ───────────────────────────────────────────────────────────────────────────

/**
 * Ligne de la table « sinistres » : tous les champs de la fiche optionnels, sauf la copropriété ; les champs de suivi de
 * la base (identifiant, horodatages) sont admis et ignorés.
 */
export interface EnregistrementSinistre extends Partial<Omit<FicheSinistre, 'coproprieteId' | 'assurance'>> {
  coproprieteId: string
  assurance?: Partial<AssuranceSinistre>
  id?: string
  createdAt?: string
  updatedAt?: string
  createdBy?: string | null
  updatedBy?: string | null
}

/** Champs de la fiche lus dans une ligne de la table ; les champs de suivi de la base, absents de la liste, sont écartés. */
const CHAMPS_FICHE_RELUS = [
  'phase',
  'dateConnaissance',
  'dateDeclaration',
  'dateExpertise',
  'dateRapport',
  'dateReglement',
  'dateCloture',
  'partiesCommunesLesees',
  'partiesCommunesResponsables',
  'origine',
  'lieu',
  'dommages',
  'indemniteImmediateCentimes',
  'indemniteImmediateReglee',
  'indemniteDiffereeCentimes',
  'indemniteDiffereeReglee',
  'causesSupprimees',
  'reparationsFaites',
  'numero',
  'dateOuverture',
  'mandatId',
  'bail',
  'heureExpertise',
  'dateForclusion',
  'parties',
  'carnetEntretien',
  'publieExtranet',
  'notes',
  'responsable',
  'assistant',
] as const satisfies readonly (keyof SaisieSinistre)[]

const CHAMPS_ASSURANCE = [
  'compagnie',
  'courtier',
  'contrat',
  'numeroSinistre',
  'compagnieId',
  'courtierId',
  'numeroCourtier',
  'contratId',
] as const satisfies readonly (keyof AssuranceSinistre)[]

/** Valeur par défaut des champs absents d'une ligne (ceux d'une saisie vide). */
const SAISIE_PAR_DEFAUT: Pick<SaisieSinistre, (typeof CHAMPS_FICHE_RELUS)[number]> = {
  phase: null,
  dateConnaissance: null,
  dateDeclaration: null,
  dateExpertise: null,
  dateRapport: null,
  dateReglement: null,
  dateCloture: null,
  partiesCommunesLesees: false,
  partiesCommunesResponsables: false,
  origine: '',
  lieu: '',
  dommages: '',
  indemniteImmediateCentimes: 0,
  indemniteImmediateReglee: false,
  indemniteDiffereeCentimes: 0,
  indemniteDiffereeReglee: false,
  causesSupprimees: false,
  reparationsFaites: false,
  numero: null,
  dateOuverture: null,
  mandatId: null,
  bail: null,
  heureExpertise: null,
  dateForclusion: null,
  parties: [],
  carnetEntretien: false,
  publieExtranet: false,
  notes: '',
  responsable: null,
  assistant: null,
}

const ASSURANCE_VIDE: Required<AssuranceSinistre> = {
  compagnie: null,
  courtier: null,
  contrat: null,
  numeroSinistre: null,
  compagnieId: null,
  courtierId: null,
  numeroCourtier: null,
  contratId: null,
}

/**
 * Saisie complète à partir de l'essentiel (copropriété, type, survenance) et des champs fournis ; tous les autres à
 * leur valeur par défaut, celle d'une saisie vide (données de démonstration, relecture d'une ligne).
 */
export function saisieSinistreParDefaut(
  essentiel: Pick<SaisieSinistre, 'coproprieteId' | 'type' | 'dateSurvenance'> & Partial<SaisieSinistre>,
): SaisieSinistre {
  return { ...SAISIE_PAR_DEFAUT, assurance: ASSURANCE_VIDE, ...essentiel }
}

/** Valeurs définies (ni absentes ni undefined) de `objet` pour les clés données. */
function valeursDefinies<T extends object, K extends keyof T>(objet: T, cles: readonly K[]): Partial<Pick<T, K>> {
  const definies: Partial<Pick<T, K>> = {}
  for (const cle of cles) if (objet[cle] !== undefined) definies[cle] = objet[cle]
  return definies
}

/** Saisie reconstituée depuis une ligne : champs absents à leur valeur par défaut, champs de suivi de la base écartés. */
function saisieRelue(ligne: EnregistrementSinistre, type: TypeSinistre, dateSurvenance: string): SaisieSinistre {
  return saisieSinistreParDefaut({
    ...valeursDefinies(ligne, CHAMPS_FICHE_RELUS),
    coproprieteId: ligne.coproprieteId,
    type,
    dateSurvenance,
    assurance: { ...ASSURANCE_VIDE, ...valeursDefinies(ligne.assurance ?? {}, CHAMPS_ASSURANCE) },
  })
}

// Format des champs d'une ligne venue d'ailleurs (reprise, import) : la ligne est relue telle quelle, sans garantie
// de type. Un champ absent (undefined) prend sa valeur par défaut ; un champ présent doit avoir le type de la fiche.

const estTexte = (valeur: unknown): boolean => typeof valeur === 'string'
const estTexteOuNull = (valeur: unknown): boolean => valeur === null || typeof valeur === 'string'
const estObjet = (valeur: unknown): valeur is Record<string, unknown> => typeof valeur === 'object' && valeur !== null

/** Champs texte de la fiche, jamais null. */
const CHAMPS_TEXTE = ['origine', 'lieu', 'dommages', 'notes'] as const
/** Champs texte (dates et heure comprises) ou null. */
const CHAMPS_TEXTE_OU_NULL = [
  'phase',
  'dateConnaissance',
  'dateDeclaration',
  'dateExpertise',
  'dateRapport',
  'dateReglement',
  'dateCloture',
  'numero',
  'dateOuverture',
  'mandatId',
  'bail',
  'heureExpertise',
  'dateForclusion',
] as const
const CHAMPS_BOOLEENS = [
  'partiesCommunesLesees',
  'partiesCommunesResponsables',
  'indemniteImmediateReglee',
  'indemniteDiffereeReglee',
  'causesSupprimees',
  'reparationsFaites',
  'carnetEntretien',
  'publieExtranet',
] as const

/** Chaque champ présent (non undefined) de `objet` satisfait `test`. */
const champsPresentsValides = (objet: Record<string, unknown>, cles: readonly string[], test: (valeur: unknown) => boolean) =>
  cles.every((cle) => objet[cle] === undefined || test(objet[cle]))

const partieLisible = (partie: unknown): boolean =>
  estObjet(partie) &&
  estTexte(partie.role) &&
  estTexte(partie.nature) &&
  estTexte(partie.libelle) &&
  estTexteOuNull(partie.refId)

const intervenantLisible = (intervenant: unknown): boolean =>
  intervenant === null ||
  (estObjet(intervenant) && estTexte(intervenant.nom) && (intervenant.id === undefined || estTexteOuNull(intervenant.id)))

const assuranceLisible = (assurance: unknown): boolean =>
  assurance === undefined || (estObjet(assurance) && champsPresentsValides(assurance, CHAMPS_ASSURANCE, estTexteOuNull))

/** Vrai si chaque champ présent de la ligne a le type de la fiche (sinon la relecture lèverait : ligne illisible). */
function formatLigneLisible(ligne: EnregistrementSinistre): boolean {
  const champs = ligne as unknown as Record<string, unknown>
  const { parties } = champs
  return (
    estTexte(champs.coproprieteId) &&
    champsPresentsValides(champs, CHAMPS_TEXTE, estTexte) &&
    champsPresentsValides(champs, CHAMPS_TEXTE_OU_NULL, estTexteOuNull) &&
    champsPresentsValides(champs, CHAMPS_BOOLEENS, (valeur) => typeof valeur === 'boolean') &&
    champsPresentsValides(champs, ['responsable', 'assistant'], intervenantLisible) &&
    assuranceLisible(champs.assurance) &&
    (parties === undefined || (Array.isArray(parties) && parties.every(partieLisible)))
  )
}

/**
 * Fiche relue depuis une ligne de la table (champs de suivi de la base écartés, champs absents à leur valeur par
 * défaut) ; null si la ligne est illisible (sans type ni survenance, champ d'un type inattendu, ou un format invalide) :
 * jamais d'exception, l'écran compte la ligne parmi les illisibles.
 */
export function ficheDepuisEnregistrement(ligne: EnregistrementSinistre): FicheSinistre | null {
  if (!ligne.type || !ligne.dateSurvenance || !estDateIsoValide(ligne.dateSurvenance)) return null
  if (!formatLigneLisible(ligne)) return null
  const saisie = saisieRelue(ligne, ligne.type, ligne.dateSurvenance)
  return erreursSaisieSinistre(saisie).length === 0 ? creerSinistre(saisie) : null
}

