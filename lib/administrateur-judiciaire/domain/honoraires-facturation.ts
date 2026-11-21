import { ajouterMois, dateIsoVersFr, estDateIsoValide, type OptionsJoursFeries } from '@/lib/administrateur-judiciaire/domain/dates'
import { FICHES_PORTEUSES, creerRattachement, type Rattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  couvertureAu,
  droitFixeDu,
  type CouvertureOrdonnances,
  type MandatRemunere,
  type MontantsFixes,
  type OrdonnanceRemuneration,
} from '@/lib/administrateur-judiciaire/domain/ordonnances-remuneration'
import { creerTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { DOSSIER, type Dossier } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Honoraires de l'administrateur : éléments à facturer, factures d'honoraires, scénario de gestion courante
 * (cartographie Gestéam, tranche 27). Fonctions pures, montants en CENTIMES ENTIERS (prix unitaire HT en dix-millièmes
 * d'euro, Gestéam affichant 4 décimales), sans écran.
 *
 * Gestéam — élément : Le · Statut (« A facturer ») · Mandat · Clé · Dossier · Tarif · Nature · Calcul (Coût unitaire ·
 * Coût Horaire · Barème Temps) · Destinataire · Prix Uté HT · Soumis à TVA · Quantité · Total HT. Facture : Type
 * (Facture · Remboursement de frais) · Statut (Préparation · Validée, non imputée · Imputée) · lignes · base et taux de
 * TVA · Total TTC. Scénario « Honoraires de gestion » : montant, fréquence (mois), début, fin, dernière facture,
 * libellé-modèle à variables ; lignes au compte 621xx, clé 001, rubrique 910.
 *
 * D1 — l'imputation passe la facture TTC en charge du SYNDICAT (1er segment du compte = segment du syndicat) et en dette
 * envers le cabinet (compte fournisseur 401 du cabinet).
 * 🔵 « Barème temps » = minutes × taux horaire / 60 : DÉDUIT du libellé, non observé en calcul.
 * 🔵 Compte de charge par défaut 62111 « honoraires administrateur provisoire » (plan observé, tranche 27), subdivision
 * de 6211 (arrêté du 14 mars 2005, art. 8 ; J67, R10 ci-dessous).
 * Point 66 — 🟢 tranche 42 (complément du 28/10/2026, 00:06) : le Dossier d'un élément est un type + la fiche précise
 * (« Sinistre » + tel sinistre) ; d'où le champ facultatif `fiche`, rattachement { type, id } du point 47, dont le type
 * est le dossier de l'élément. 🟢 Tranche 27 : la fiche élément a ses propres champs Entreprise et Personne ; une fiche
 * porteuse (copropriété, identité, entreprise) n'est donc pas une fiche de dossier. Honoraires de sinistre :
 * honoraires-sinistre.ts.
 *
 * Point 67 — qualification de l'élément (le « Traitement » de Gestéam) :
 * - 🟢 Tranche 43 § 13 (Gestion → Honoraires → Liste des éléments de factures) : deux sélecteurs de recherche, Statut
 *   (À facturer · Non facturé · Facturé · Imputé · Non imputé) et Traitement (Facturable · Offert · Contrôle coûts). Un
 *   élément a donc deux axes : son cycle et sa qualification. « Une diligence comprise dans le forfait se trace en
 *   offert ou contrôle coûts. » 🟢 Tranche 27 : bouton « Traitement » de la fiche élément (ex. « Facturable »).
 * - 🟢 Tranche 42 (complément du 28/10/2026, 00:06) : l'élément créé à l'ouverture d'un sinistre porte « Facturable ».
 *   D'où la valeur par défaut : une qualification absente vaut « Facturable » (les éléments existants ne changent pas).
 * - 🔵 « Contrôle coûts » : temps et coûts suivis sans facturation. 🔵 Seuls les facturables entrent dans
 *   preparerFacture ; un offert ou un contrôle des coûts garde son statut « A facturer » et reste dans la liste.
 * - 🔵 Champ nommé `qualification`, pas « traitement » : le Traitement de VitFix est la pièce comptable (traitements.ts).
 * - Rémunération et frais : 🟢 Gestéam les sépare, par le Type de la facture (« Facture » ou « Remboursement de frais »,
 *   tranche 27) et par le plan (62111 ↔ rubrique 901 « HONORAIRES ADMINSTRATEUR PROV », 62120 ↔ 951 « DEBOURS »,
 *   tranche 27). 🔵 Seules les natures Vacations, Honoraires et Prestations rémunèrent une diligence
 *   (NATURES_REMUNERATION, categorieDe) ; les autres (timbre, AR, copie, envois, diffuseurs) sont des frais. Liste
 *   partagée par honoraires-sinistre.ts et honoraires-tableau.ts.
 * - Droit : ces trois qualifications ne figurent dans aucun texte lu (loi 65-557, décret 67-223, arrêté du 8 octobre
 *   2015, C. com. R. 814-1 à R. 814-169, règles professionnelles des AJ approuvées par l'arrêté du 18 juillet 2018) :
 *   ce sont des catégories de gestion. 🟢 Contrat type de syndic (D. 1967 annexe 1, 7.1.1) : la déclaration de sinistre
 *   et la gestion des règlements aux bénéficiaires ne donnent lieu à aucune rémunération supplémentaire ; une telle
 *   diligence se trace, sans être facturable (contrôle : honoraires-sinistre.ts).
 *
 * Décisions du 17/11/2026 (registre des décisions juridiques, J67 : recommandations validées en bloc ; textes
 * relus sur Légifrance le 17/11/2026 ; lecture des textes, pas un avis d'avocat) :
 * - J67, R3 (et R2) : en mission judiciaire, l'administrateur n'est payé qu'en vertu des ordonnances du juge (acomptes
 *   annuels, ordonnance de fin de mission : D. 1967 art. 61-1-5, II et III ; art. 46, 47 et 49 : C. com. R. 814-27 et
 *   R. 814-28), hors le droit fixe de 1 500 € HT, que l'AP de l'art. 29-1 perçoit dès que la décision de désignation est
 *   portée à sa connaissance (61-1-5, I ; arrêté du 8 octobre 2015, art. 4), et seulement pour une copropriété de moins
 *   de 500 lots (à 500 lots et plus, toute la rémunération est fixée par le juge, par dérogation aux art. 4 à 15 :
 *   arrêté, art. 3). preparerFacture reçoit le cadre du mandat (CadreFacturation : régime, nombre de lots, ordonnances,
 *   factures déjà émises) et refuse une facture qui dépasse, par poste, ce que couvrent à sa date le droit fixe et les
 *   ordonnances exécutoires, moins ce qui est déjà facturé. Le droit fixe ne couvre que l'élément qui le facture (champ
 *   droitFixe), une seule fois par mandat, et seulement pour l'AP de moins de 500 lots ; toute autre rémunération, et
 *   tous les frais, attendent une ordonnance exécutoire (J67, R2 : « seulement après une ordonnance, sauf une
 *   exception », le droit fixe). Une fin de mission exécutoire arrête toute la rémunération : le droit fixe déjà facturé
 *   s'impute alors sur elle. L'ordonnance de fin de mission n'est exécutoire qu'après le mois de recours, sans recours
 *   pendant, et si sa notification indique le recours (C. pr. civ. art. 714 à 718 ; Cass. 2e civ., 3 mars 2016,
 *   n° 15-12.129) : ordonnances-remuneration.ts, qui sort le calcul du délai. Contrat type de syndic : aucun contrôle.
 *   Enregistrement des ordonnances : à brancher.
 * - J67, R9 : en mission judiciaire (AP de l'art. 29-1, art. 46, 47 et 49), « Offert » est refusé à la qualification
 *   (qualifierElement et creerElement, qui reçoivent tous deux la mission du mandat ; corrigerQuantite ne change pas la
 *   qualification) : tracer en « Contrôle coûts ». C'est une règle prudente du cabinet, pas une interdiction
 *   certaine : la règle professionnelle 244.1 interdit « l'offre ou l'octroi
 *   de remises sur émoluments préalablement à l'arrêté de ceux-ci », mais elle est rangée dans la section sur la
 *   concurrence ; une diligence couverte par le droit fixe ou par le droit de gestion courante (arrêté, art. 4 et 5) se
 *   trace aussi en « Contrôle coûts ». Un élément déjà « Offert » n'est pas changé : il est signalé
 *   (signalerElementsOfferts). Règles professionnelles lues en version initiale (à jour non vérifié).
 * - J67, R10 : imputerFacture passe un débit par catégorie : la rémunération au 62111, subdivision de 6211
 *   « Rémunération du syndic » (l'AP reçoit tous les pouvoirs du syndic et rétribue sur sa rémunération le tiers qui
 *   l'assiste, L. 1965 art. 29-1, I, al. 2 : pas le 623 « Rémunérations de tiers intervenants ») ; les frais au 62120
 *   « DEBOURS » du plan du cabinet, subdivision de 6212 « Débours » (tranche 27) ; comptes réglables par catégorie
 *   (comptesCharge), par exemple une subdivision de 6213 « Frais postaux » pour les timbres, AR et envois si le plan du
 *   cabinet en a une (à relever dans Gestéam). Crédit unique du compte fournisseur du cabinet ; la facture garde ses
 *   lignes. Les comptes de l'arrêté sont « les seuls utilisables », avec « toute subdivision nécessaire » (arrêté du
 *   14 mars 2005, art. 7 et 8).
 * - J67, R15 : sans objet pour le cabinet (C. com. L. 811-10) : un administrateur judiciaire ne peut être syndic désigné
 *   par l'assemblée, d'où aucun blocage de « Facturable » au contrat type. Si VitFix sert un jour des syndics
 *   professionnels (question F6, Frédéric), il faudra bloquer, car une rémunération complémentaire n'est permise que
 *   pour la liste limitative (L. 1965 art. 18-1 A, I), avec une correspondance entre la nature, le tarif et le
 *   destinataire de l'élément et les fondements lus : une prestation particulière de la liste limitative (D. 1967
 *   annexe 2) ; le dépassement des horaires et durées convenus au forfait (contrat type, 7.1.5) ; les frais
 *   d'affranchissement ou d'acheminement, remboursés à part au syndic (7.1.5 et 7.2.1, alinéas sur l'envoi des
 *   documents) ; les frais et honoraires imputables au seul copropriétaire concerné, qui en est le destinataire (L. 1965
 *   art. 10-1, a et b ; contrat type, point 9 : recouvrement, état daté au plus 380 € TTC, opposition sur mutation,
 *   délivrance de copies, assemblée générale tenue à sa demande).
 *
 * Questions ouvertes :
 * - 🔴 (Frédéric) Un élément offert ou en contrôle des coûts reste-t-il « A facturer », ou sort-il du cycle ? Choix
 *   actuel : statut inchangé.
 * - 🔴 (comptable du cabinet) Le droit proportionnel sur travaux de l'AP (arrêté du 8 octobre 2015, art. 11), présenté
 *   opération par opération (J55), va-t-il en 6221 « Honoraires travaux », rattaché à l'opération de travaux ? Choix
 *   actuel : 62111, comme toute la rémunération (J67, R10).
 */

export const NATURES_ELEMENT = [
  'Timbre',
  'AR',
  'Copie',
  'Vacations',
  'Honoraires',
  'Prestations',
  'Envoi de fax',
  'Envoi de mail',
  'Envoi de SMS',
  'Diffuseur timbre',
  'Diffuseur AR',
  'Diffuseur copie',
  'Diffuseur LRE',
  'Timbre étranger',
  'AR étranger',
] as const
export type NatureElement = (typeof NATURES_ELEMENT)[number]

/** 🔵 Natures qui rémunèrent une diligence ; les autres sont des frais (timbre, AR, copie, envois, diffuseurs). */
export const NATURES_REMUNERATION = ['Vacations', 'Honoraires', 'Prestations'] as const satisfies readonly NatureElement[]

/** Catégorie d'un élément : rémunération (émoluments, honoraires) ou frais (🔵, d'après la nature). */
export const CATEGORIES_ELEMENT = ['Rémunération', 'Frais'] as const
export type CategorieElement = (typeof CATEGORIES_ELEMENT)[number]

const NATURES_DE_REMUNERATION: ReadonlySet<NatureElement> = new Set(NATURES_REMUNERATION)

export const categorieDe = (element: Pick<SaisieElement, 'nature'>): CategorieElement =>
  NATURES_DE_REMUNERATION.has(element.nature) ? 'Rémunération' : 'Frais'

export const MODES_CALCUL = ['Coût unitaire', 'Coût horaire', 'Barème temps'] as const
export type ModeCalcul = (typeof MODES_CALCUL)[number]

/** 🟢 Qualification d'un élément, le « Traitement » de Gestéam (tranche 43 § 13 ; tranche 27). */
export const QUALIFICATIONS_ELEMENT = ['Facturable', 'Offert', 'Contrôle coûts'] as const
export type QualificationElement = (typeof QUALIFICATIONS_ELEMENT)[number]

/** 🟢 « Facturable » : qualification de l'élément créé à l'ouverture d'un sinistre (tranche 42) ; valeur d'un champ absent. */
export const QUALIFICATION_PAR_DEFAUT: QualificationElement = 'Facturable'

const QUALIFICATIONS_CONNUES: ReadonlySet<string> = new Set(QUALIFICATIONS_ELEMENT)

/** Mission du mandat dont on facture les honoraires : judiciaire, ou contrat type de syndic (J67, R3, R9 et R15). */
export const MISSIONS_HONORAIRES = ['judiciaire', 'contrat_type_syndic'] as const
export type MissionHonoraires = (typeof MISSIONS_HONORAIRES)[number]

const MISSIONS_CONNUES: ReadonlySet<string> = new Set(MISSIONS_HONORAIRES)

function verifierMission(mission: MissionHonoraires): void {
  if (!MISSIONS_CONNUES.has(mission)) throw new Error(`Mission inconnue : « ${mission} ».`)
}

/** J67, R9 : règle prudente du cabinet sur « Offert » en mission judiciaire (texte de la recommandation validée). */
const OFFERT_EN_MISSION_JUDICIAIRE =
  'tracer en Contrôle coûts ; une remise sur émoluments avant leur arrêté par le juge est à éviter (règle professionnelle 244.1, lecture prudente)'

/**
 * Règle de la mission (J67, R9) : « Offert » est refusé en mission judiciaire. creerElement l'applique d'abord ; exportée
 * pour une ligne contrôlée sans élément (etapes-courrier.ts : forfait dont le montant n'est pas saisi, J77).
 */
export function verifierQualificationAdmise(qualification: QualificationElement, mission: MissionHonoraires): void {
  verifierMission(mission)
  if (mission === 'judiciaire' && qualification === 'Offert')
    throw new Error(`Qualification « Offert » refusée. Mission judiciaire : ${OFFERT_EN_MISSION_JUDICIAIRE}.`)
}

/** Codes de procédure lus dans les libellés du catalogue de tarifs (contentieux). */
export const CODES_PROCEDURE_TARIF = {
  IP: 'Injonction de payer',
  SI: 'Saisie immobilière',
  SURT: 'Surendettement',
  RET: 'Rétablissement personnel',
  PROT: "Protocole d'accord",
  EXE: 'Exécution (commissaire de justice)',
  FSL: 'Fonds de solidarité logement',
} as const

export interface SaisieElement {
  id: string
  /** D1 : le syndicat qui supporte la charge. */
  coproprieteId: string
  /** Le mandat au titre duquel la prestation est faite. */
  mandatId: string
  date: string
  dossier: Dossier
  /** Fiche précise du dossier (point 66) : son type est `dossier`. Absente ou null : élément rattaché au seul dossier. */
  fiche?: Rattachement | null
  nature: NatureElement
  /** Tarif du catalogue (« <Dossier> - <LIBELLÉ> »). */
  tarif: string
  calcul: ModeCalcul
  /** Unités, heures (coût horaire) ou minutes (barème temps). */
  quantite: number
  /** Prix unitaire (ou taux horaire) HT, en dix-millièmes d'euro. */
  prixUnitaireHtDixMilliemes: number
  soumisTva: boolean
  tauxTvaPct: number
  destinataire: string
  /** Point 67 : facturable, offert ou contrôle des coûts. Absente : « Facturable » (QUALIFICATION_PAR_DEFAUT). */
  qualification?: QualificationElement
  /**
   * J67, R2 et R3 : l'élément facture le droit fixe de l'AP de l'art. 29-1 (D. 1967 art. 61-1-5, I ; arrêté du 8 octobre
   * 2015, art. 4), seule rémunération perçue sans ordonnance. Nature de rémunération exigée. Absent : faux.
   * 🔵 Champ du code : aucun tarif « droit fixe » n'a été relevé dans le catalogue Gestéam (à relever) ; enregistrement :
   * à brancher.
   */
  droitFixe?: boolean
}

export interface ElementAFacturer extends SaisieElement {
  statut: 'A facturer' | 'Facturé'
}

const contient = (liste: readonly string[], valeur: string) => liste.includes(valeur)

/** Fiche visée, revalidée (type connu, identifiant non vide, nettoyé) ; son type doit être le dossier de l'élément. */
function ficheDuDossier(dossier: Dossier, fiche: Rattachement): Rattachement {
  const rattachement = creerRattachement(fiche.type, fiche.id)
  if (contient(FICHES_PORTEUSES, rattachement.type))
    throw new Error(`Fiche « ${rattachement.type} » : une fiche porteuse n'est pas une fiche de dossier (champs propres de l'élément).`)
  if (rattachement.type !== dossier)
    throw new Error(`Fiche « ${rattachement.type} » : son type doit être le dossier de l'élément (« ${dossier} »).`)
  return rattachement
}

/** Qualification de l'élément ; absente, « Facturable ». Lève si elle est inconnue (saisie ou donnée corrompue). */
export function qualificationDe(element: Pick<SaisieElement, 'qualification'>): QualificationElement {
  const qualification = element.qualification ?? QUALIFICATION_PAR_DEFAUT
  if (!QUALIFICATIONS_CONNUES.has(qualification)) throw new Error(`Qualification inconnue : « ${qualification} ».`)
  return qualification
}

/** Seul un élément facturable entre dans une facture (point 67). */
export const estFacturable = (element: Pick<SaisieElement, 'qualification'>): boolean => qualificationDe(element) === 'Facturable'

/** Contrôles de la saisie, hors règle de la mission ; la qualification est contrôlée seule (lève si elle est inconnue). */
function elementControle(saisie: SaisieElement): ElementAFacturer {
  qualificationDe(saisie)
  if (!estDateIsoValide(saisie.date)) throw new Error(`Date invalide (${saisie.date}) : AAAA-MM-JJ attendu.`)
  if (!contient(DOSSIER, saisie.dossier)) throw new Error(`Dossier inconnu : « ${saisie.dossier} ».`)
  if (!contient(NATURES_ELEMENT, saisie.nature)) throw new Error(`Nature d'élément inconnue : « ${saisie.nature} ».`)
  if (!contient(MODES_CALCUL, saisie.calcul)) throw new Error(`Mode de calcul inconnu : « ${saisie.calcul} ».`)
  if (!(saisie.quantite > 0)) throw new Error(`Quantité invalide (${saisie.quantite}) : strictement positive attendue.`)
  if (!Number.isInteger(saisie.prixUnitaireHtDixMilliemes) || saisie.prixUnitaireHtDixMilliemes < 0)
    throw new Error(`Prix unitaire invalide (${saisie.prixUnitaireHtDixMilliemes}) : dix-millièmes d'euro entiers positifs attendus.`)
  if (saisie.droitFixe === true && categorieDe(saisie) !== 'Rémunération')
    throw new Error(`Droit fixe : la nature « ${saisie.nature} » est un frais ; une nature de rémunération est attendue (Vacations, Honoraires, Prestations).`)
  if (saisie.fiche) return { ...saisie, fiche: ficheDuDossier(saisie.dossier, saisie.fiche), statut: 'A facturer' }
  return { ...saisie, statut: 'A facturer' }
}

/**
 * Crée l'élément « A facturer », pour la mission du mandat (obligatoire) : « Offert » est refusé en mission judiciaire
 * (J67, R9). La qualification fournie est recopiée telle quelle.
 */
export function creerElement(saisie: SaisieElement, mission: MissionHonoraires): ElementAFacturer {
  verifierQualificationAdmise(qualificationDe(saisie), mission)
  return elementControle(saisie)
}

/**
 * Change la qualification d'un élément encore « A facturer » ; l'élément reçu n'est pas modifié. En mission judiciaire,
 * « Offert » est refusé : tracer en « Contrôle coûts » (J67, R9).
 */
export function qualifierElement(element: ElementAFacturer, qualification: QualificationElement, mission: MissionHonoraires): ElementAFacturer {
  if (element.statut !== 'A facturer') throw new Error(`Qualification refusée : l'élément ${element.id} est déjà facturé.`)
  return creerElement({ ...element, qualification }, mission)
}

/**
 * Corrige la quantité d'un élément encore « A facturer », sans toucher à sa qualification ; l'élément reçu n'est pas
 * modifié. Un élément déjà « Offert » n'est pas changé (J67, R9) : la règle de la mission ne joue qu'à la création et à
 * la requalification ; signalerElementsOfferts le signale.
 */
export function corrigerQuantite(element: ElementAFacturer, quantite: number): ElementAFacturer {
  if (element.statut !== 'A facturer') throw new Error(`Correction refusée : l'élément ${element.id} est déjà facturé.`)
  return elementControle({ ...element, quantite })
}

export interface SignalementQualification {
  elementId: string
  message: string
}

/** Éléments déjà « Offert » d'une mission judiciaire : signalés, jamais changés (J67, R9). Contrat type : aucun. */
export function signalerElementsOfferts(elements: readonly ElementAFacturer[], mission: MissionHonoraires): SignalementQualification[] {
  verifierMission(mission)
  if (mission !== 'judiciaire') return []
  return elements
    .filter((element) => qualificationDe(element) === 'Offert')
    .map((element) => ({
      elementId: element.id,
      message: `Élément « Offert » en mission judiciaire : ${OFFERT_EN_MISSION_JUDICIAIRE} ; l'élément n'est pas changé.`,
    }))
}

export interface TotauxElement {
  htCentimes: number
  tvaCentimes: number
  ttcCentimes: number
}

export function totalElement(element: ElementAFacturer): TotauxElement {
  const unites = element.calcul === 'Barème temps' ? element.quantite / 60 : element.quantite
  const htCentimes = Math.round((element.prixUnitaireHtDixMilliemes * unites) / 100)
  const tvaCentimes = element.soumisTva ? Math.round((htCentimes * element.tauxTvaPct) / 100) : 0
  return { htCentimes, tvaCentimes, ttcCentimes: htCentimes + tvaCentimes }
}

export type StatutFactureHonoraires = 'Préparation' | 'Validée, non imputée' | 'Imputée'

export interface FactureHonoraires {
  id: string
  numero: string
  type: 'Facture' | 'Remboursement de frais'
  date: string
  statut: StatutFactureHonoraires
  coproprieteId: string
  mandatId: string
  destinataire: string
  /**
   * `tvaCentimes` : TVA de l'élément (totalElement) ; la somme des lignes HT + TVA est le total TTC (J67, R10).
   * `droitFixe` : la ligne facture le droit fixe (élément marqué, J67, R2 et R3) ; absent : faux.
   */
  lignes: {
    elementId: string
    date: string
    nature: NatureElement
    tarif: string
    quantite: number
    htCentimes: number
    tvaCentimes: number
    droitFixe?: boolean
  }[]
  tvaParTaux: { tauxPct: number; baseCentimes: number; tvaCentimes: number }[]
  totalHtCentimes: number
  totalTvaCentimes: number
  totalTtcCentimes: number
}

type LigneFacture = FactureHonoraires['lignes'][number]

/** Cumul d'un montant des lignes, par clé (catégorie, ou poste de la couverture), chaque clé présente. */
const cumulPar = <C extends string>(
  cles: readonly C[],
  lignes: readonly LigneFacture[],
  cle: (ligne: LigneFacture) => C,
  montant: (ligne: LigneFacture) => number,
): Record<C, number> => {
  const cumul = Object.fromEntries(cles.map((c) => [c, 0])) as Record<C, number>
  for (const ligne of lignes) cumul[cle(ligne)] += montant(ligne)
  return cumul
}

const cumulParCategorie = (lignes: readonly LigneFacture[], montant: (ligne: LigneFacture) => number): Record<CategorieElement, number> =>
  cumulPar(CATEGORIES_ELEMENT, lignes, categorieDe, montant)

/** HT des factures, par catégorie de leurs lignes (J67, R3 : déjà facturé ; R4 : perçu). */
export const htParCategorie = (factures: readonly Pick<FactureHonoraires, 'lignes'>[]): Record<CategorieElement, number> =>
  cumulParCategorie(
    factures.flatMap((facture) => facture.lignes),
    (ligne) => ligne.htCentimes,
  )

/**
 * Cadre de la facture (J67, R3) : contrat type de syndic, sans contrôle ; ou mission judiciaire, contrôlée par le droit
 * fixe et les ordonnances du mandat.
 */
export type CadreFacturation =
  | { mission: 'contrat_type_syndic' }
  | {
      mission: 'judiciaire'
      mandat: MandatRemunere
      ordonnances: readonly OrdonnanceRemuneration[]
      /** Factures déjà émises pour le mandat, quel que soit leur statut : leur HT s'impute sur ce que couvrent les ordonnances. */
      factures: readonly FactureHonoraires[]
      /** Jours fériés pour la prorogation du délai de recours (CPC art. 642). */
      joursFeries?: OptionsJoursFeries
    }
type CadreJudiciaire = Extract<CadreFacturation, { mission: 'judiciaire' }>

const fr = dateIsoVersFr
const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)

/** Montant fixé pour une catégorie : les émoluments pour la rémunération, les frais pour les frais (J67, R3 et R4). */
export const montantFixePour = (categorie: CategorieElement, montants: MontantsFixes): number =>
  categorie === 'Rémunération' ? montants.emolumentsHtCentimes : montants.fraisHtCentimes

const FONDEMENT_ORDONNANCES =
  "Mission judiciaire : l'administrateur n'est payé qu'en vertu des ordonnances du juge, hors le droit fixe de " +
  "l'administrateur provisoire de l'art. 29-1 sous 500 lots (D. 1967 art. 61-1-5 ; arrêté du 8 octobre 2015, art. 3 et " +
  '4 ; C. com. R. 814-27 et R. 814-28).'

const FONDEMENT_DROIT_FIXE = "D. 1967 art. 61-1-5, I ; arrêté du 8 octobre 2015, art. 3 et 4 ; J67, R2 et R3"

/**
 * Poste de la couverture d'une ligne (J67, R2 et R3) : le droit fixe ne couvre que la ligne qui le facture ; tant qu'aucune
 * fin de mission exécutoire ne l'absorbe, il reste à part de la rémunération couverte par les ordonnances. Une fin de
 * mission arrête toute la rémunération : la ligne du droit fixe s'impute alors sur elle, comme le reste.
 */
type PosteCouverture = CategorieElement | 'Droit fixe'
const POSTES_COUVERTURE: readonly PosteCouverture[] = ['Droit fixe', ...CATEGORIES_ELEMENT]

const posteDe = (ligne: LigneFacture, couverture: CouvertureOrdonnances): PosteCouverture =>
  ligne.droitFixe === true && couverture.droitFixeHtCentimes > 0 ? 'Droit fixe' : categorieDe(ligne)

/** Ce que couvre un poste : le droit fixe ; pour la rémunération, les seules ordonnances ; les frais des ordonnances. */
function couvertPour(poste: PosteCouverture, couverture: CouvertureOrdonnances): number {
  if (poste === 'Droit fixe') return couverture.droitFixeHtCentimes
  return montantFixePour(poste, couverture) - (poste === 'Rémunération' ? couverture.droitFixeHtCentimes : 0)
}

function refusDeCouverture(poste: PosteCouverture, demande: number, deja: number, couverture: CouvertureOrdonnances): string {
  const couvreur = poste === 'Droit fixe' ? 'couvre le droit fixe' : 'couvrent les ordonnances'
  const seulElement =
    poste === 'Rémunération' && couverture.droitFixeHtCentimes > 0
      ? " Le droit fixe ne couvre que l'élément qui le facture (marqué droit fixe) : toute autre rémunération attend une ordonnance."
      : ''
  const nonExecutoires = couverture.etats.filter((etat) => !etat.executable).map((etat) => ` ${etat.justification}`)
  return (
    `Facture refusée : ${poste.toLowerCase()} de ${euros(demande)} HT au-delà de ce que ${couvreur} ` +
    `(${euros(couvertPour(poste, couverture))} HT couverts au ${fr(couverture.date)} ; ${euros(deja)} HT déjà ` +
    `facturés). ${FONDEMENT_ORDONNANCES}${seulElement}${nonExecutoires.join('')}`
  )
}

const htParPoste = (lignes: readonly LigneFacture[], couverture: CouvertureOrdonnances): Record<PosteCouverture, number> =>
  cumulPar(
    POSTES_COUVERTURE,
    lignes,
    (ligne) => posteDe(ligne, couverture),
    (ligne) => ligne.htCentimes,
  )

/**
 * Le droit fixe est dû une fois, pour l'ensemble de la mission, à la seule AP de l'art. 29-1 de moins de 500 lots
 * (D. 1967 art. 61-1-5, I ; arrêté, art. 3 et 4) : une ligne marquée ailleurs, ou une seconde ligne, est refusée.
 */
function controlerDroitFixe(cadre: CadreJudiciaire, lignes: readonly LigneFacture[], anterieures: readonly FactureHonoraires[]): void {
  const marquees = lignes.filter((ligne) => ligne.droitFixe === true)
  if (marquees.length === 0) return
  if (droitFixeDu(cadre.mandat) === 0)
    throw new Error(
      `Facture refusée : droit fixe non dû pour ce mandat ; il n'est dû qu'à l'administrateur provisoire de l'art. 29-1 ` +
        `d'une copropriété de moins de 500 lots (${FONDEMENT_DROIT_FIXE}).`,
    )
  const deja = anterieures.filter((facture) => facture.lignes.some((ligne) => ligne.droitFixe === true))
  if (marquees.length + deja.length > 1) {
    const ou = deja.length > 0 ? ` (déjà facturé : facture ${deja.map((f) => f.numero).join(', ')})` : ''
    throw new Error(`Facture refusée : le droit fixe se facture une seule fois, pour l'ensemble de la mission${ou} (${FONDEMENT_DROIT_FIXE}).`)
  }
}

/**
 * J67, R3 : par poste (droit fixe, rémunération, frais), le déjà facturé du mandat plus cette facture ne dépasse pas ce
 * que couvrent le droit fixe et les ordonnances exécutoires. Une facture déjà émise sous le même identifiant (facture
 * repréparée) ne compte pas dans le déjà facturé.
 */
function controlerCouverture(cadre: CadreJudiciaire, facture: Pick<FactureHonoraires, 'id' | 'mandatId' | 'date' | 'lignes'>): CouvertureOrdonnances {
  const couverture = couvertureAu(facture.mandatId, cadre.mandat, cadre.ordonnances, facture.date, cadre.joursFeries)
  const anterieures = cadre.factures.filter((f) => f.mandatId === facture.mandatId && f.id !== facture.id)
  controlerDroitFixe(cadre, facture.lignes, anterieures)
  const deja = htParPoste(
    anterieures.flatMap((f) => f.lignes),
    couverture,
  )
  const demande = htParPoste(facture.lignes, couverture)
  for (const poste of POSTES_COUVERTURE)
    if (demande[poste] > 0 && deja[poste] + demande[poste] > couvertPour(poste, couverture))
      throw new Error(refusDeCouverture(poste, demande[poste], deja[poste], couverture))
  return couverture
}

/** Lignes de la facture et TVA par taux (somme des TVA arrondies des éléments). */
function lignesEtTva(retenus: readonly ElementAFacturer[]): Pick<FactureHonoraires, 'lignes' | 'tvaParTaux'> {
  const parTaux = new Map<number, { baseCentimes: number; tvaCentimes: number }>()
  const lignes = retenus.map((e) => {
    const totaux = totalElement(e)
    if (e.soumisTva) {
      const cumul = parTaux.get(e.tauxTvaPct) ?? { baseCentimes: 0, tvaCentimes: 0 }
      parTaux.set(e.tauxTvaPct, { baseCentimes: cumul.baseCentimes + totaux.htCentimes, tvaCentimes: cumul.tvaCentimes + totaux.tvaCentimes })
    }
    const ligne = { elementId: e.id, date: e.date, nature: e.nature, tarif: e.tarif, quantite: e.quantite, htCentimes: totaux.htCentimes, tvaCentimes: totaux.tvaCentimes }
    return e.droitFixe === true ? { ...ligne, droitFixe: true } : ligne
  })
  return { lignes, tvaParTaux: [...parTaux.entries()].sort(([a], [b]) => a - b).map(([tauxPct, t]) => ({ tauxPct, ...t })) }
}

/**
 * Regroupe les éléments facturables « A facturer » d'un mandat et d'un destinataire ; renvoie la facture, les éléments
 * à jour et, en mission judiciaire, ce que couvrent les ordonnances à la date de la facture (avec la justification de
 * chacune : délai de recours, recours pendant…). Les éléments offerts ou en contrôle des coûts n'y entrent pas et gardent
 * leur statut (point 67). Mission judiciaire : refus au-delà de ce que couvrent le droit fixe (pour le seul élément qui
 * le facture) et les ordonnances, moins le déjà facturé (J67, R2 et R3).
 */
export function preparerFacture(
  elements: ElementAFacturer[],
  {
    id,
    numero,
    date,
    mandatId,
    destinataire,
    type = 'Facture',
    cadre,
  }: { id: string; numero: string; date: string; mandatId: string; destinataire: string; type?: FactureHonoraires['type']; cadre: CadreFacturation },
): { facture: FactureHonoraires; elements: ElementAFacturer[]; couverture: CouvertureOrdonnances | null } {
  if (!MISSIONS_CONNUES.has(cadre?.mission)) throw new Error(`Cadre de facturation inconnu : « ${cadre?.mission} ».`)
  if (!estDateIsoValide(date)) throw new Error(`Date de facture invalide (${date}) : AAAA-MM-JJ attendu.`)
  const retenus = elements.filter(
    (e) => e.statut === 'A facturer' && e.mandatId === mandatId && e.destinataire === destinataire && estFacturable(e),
  )
  if (retenus.length === 0) throw new Error('Aucun élément facturable à facturer pour ce mandat et ce destinataire.')
  const { lignes, tvaParTaux } = lignesEtTva(retenus)
  const couverture = cadre.mission === 'judiciaire' ? controlerCouverture(cadre, { id, mandatId, date, lignes }) : null
  const totalHtCentimes = lignes.reduce((s, l) => s + l.htCentimes, 0)
  const totalTvaCentimes = tvaParTaux.reduce((s, t) => s + t.tvaCentimes, 0)
  const ids = new Set(retenus.map((e) => e.id))
  return {
    facture: {
      id,
      numero,
      type,
      date,
      statut: 'Préparation',
      coproprieteId: retenus[0].coproprieteId,
      mandatId,
      destinataire,
      lignes,
      tvaParTaux,
      totalHtCentimes,
      totalTvaCentimes,
      totalTtcCentimes: totalHtCentimes + totalTvaCentimes,
    },
    elements: elements.map((e) => (ids.has(e.id) ? { ...e, statut: 'Facturé' as const } : e)),
    couverture,
  }
}

export function validerFacture(facture: FactureHonoraires): FactureHonoraires {
  if (facture.statut !== 'Préparation') throw new Error(`Validation refusée : la facture n'est pas en Préparation (${facture.statut}).`)
  return { ...facture, statut: 'Validée, non imputée' }
}

/**
 * J67, R10 : comptes de charge par défaut, par catégorie : rémunération au 62111 (subdivision de 6211), frais au 62120
 * « DEBOURS » (subdivision de 6212, plan du cabinet, tranche 27) ; arrêté du 14 mars 2005, art. 7 et 8.
 */
export const COMPTES_CHARGE_PAR_DEFAUT: Readonly<Record<CategorieElement, string>> = { Rémunération: '62111', Frais: '62120' }

/**
 * Imputation (famille « Imputation des honoraires divers ») : un débit TTC par catégorie au compte de charge du
 * syndicat (comptesCharge, défauts COMPTES_CHARGE_PAR_DEFAUT), crédit unique du compte fournisseur du cabinet (J67,
 * R10). Seule une facture validée s'impute ; une facture dont les lignes ne font pas le total TTC n'est pas équilibrée.
 */
export function imputerFacture(
  facture: FactureHonoraires,
  {
    traitementId,
    segmentSyndicat,
    auxiliaireCabinet,
    date,
    comptesCharge = {},
  }: { traitementId: string; segmentSyndicat: string; auxiliaireCabinet: string; date: string; comptesCharge?: Partial<Record<CategorieElement, string>> },
): { facture: FactureHonoraires; traitement: Traitement } {
  if (facture.statut !== 'Validée, non imputée') throw new Error('Imputation refusée : valider la facture d’abord.')
  if (!/^[0-9A-Z]{5}$/.test(auxiliaireCabinet)) throw new Error(`Auxiliaire du cabinet « ${auxiliaireCabinet} » : 5 caractères attendus.`)
  const comptes = { ...COMPTES_CHARGE_PAR_DEFAUT, ...comptesCharge }
  const ttc = cumulParCategorie(facture.lignes, (ligne) => ligne.htCentimes + ligne.tvaCentimes)
  const debits = CATEGORIES_ELEMENT.filter((categorie) => ttc[categorie] > 0).map((categorie) => ({
    compte: `${segmentSyndicat}.${comptes[categorie]}.00000.0`,
    sens: 'debit' as const,
    montantCentimes: ttc[categorie],
  }))
  const traitement = creerTraitement({
    id: traitementId,
    famille: 'Imputation des honoraires divers',
    date,
    mouvements: [...debits, { compte: `${segmentSyndicat}.40100.${auxiliaireCabinet}.0`, sens: 'credit', montantCentimes: facture.totalTtcCentimes }],
  })
  return { facture: { ...facture, statut: 'Imputée' }, traitement }
}

/** Remplace [Trimestre], [Annee] et [Mois] dans un libellé-modèle, pour la date d'échéance donnée. */
export function libelleDepuisModele(modele: string, dateIso: string): string {
  const [annee, mois] = dateIso.split('-')
  return modele
    .replaceAll('[Trimestre]', String(Math.floor((Number(mois) - 1) / 3) + 1))
    .replaceAll('[Annee]', annee)
    .replaceAll('[Mois]', mois)
}

export interface ScenarioHonoraires {
  montantTtcCentimes: number
  frequenceMois: number
  debut: string
  fin: string | null
  derniereFacture: string | null
  libelleModele: string
}

/** Échéances à facturer : après la dernière facture (ou dès le début), jusqu'à `jusqua` et dans la période du scénario. */
export function echeancesScenario(scenario: ScenarioHonoraires, jusqua: string): { date: string; libelle: string; montantTtcCentimes: number }[] {
  if (!Number.isInteger(scenario.frequenceMois) || scenario.frequenceMois < 1)
    throw new Error(`Fréquence invalide (${scenario.frequenceMois}) : nombre de mois entier positif attendu.`)
  const echeances: { date: string; libelle: string; montantTtcCentimes: number }[] = []
  let date = scenario.derniereFacture ? ajouterMois(scenario.derniereFacture, scenario.frequenceMois) : scenario.debut
  while (date <= jusqua && (!scenario.fin || date <= scenario.fin)) {
    if (date >= scenario.debut)
      echeances.push({ date, libelle: libelleDepuisModele(scenario.libelleModele, date), montantTtcCentimes: scenario.montantTtcCentimes })
    date = ajouterMois(date, scenario.frequenceMois)
  }
  return echeances
}
