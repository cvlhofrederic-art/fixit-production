import { ajouterMois, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { FICHES_PORTEUSES, creerRattachement, type Rattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
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
 * de 6211 (arrêté du 14 mars 2005, art. 8 ; 🔴 question ci-dessous).
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
 * Questions ouvertes du point 67 :
 * - 🔴 (Frédéric ou Hugo) Administration provisoire : faut-il interdire la qualification « Offert », ou seulement la
 *   tracer hors facture ? La règle 244.1 des règles professionnelles interdit « l'offre ou l'octroi de remises sur
 *   émoluments préalablement à l'arrêté de ceux-ci » (règle placée dans la section sur la concurrence). Choix actuel :
 *   tracée, sans contrôle.
 * - 🔴 (Frédéric ou Hugo) Administration provisoire : preparerFacture doit-il refuser un élément facturable qu'aucune
 *   ordonnance ne couvre (acomptes annuels, D. 1967 art. 61-1-5, II ; ordonnance de fin de mission, III) ? Hors le droit
 *   fixe de 1 500 € HT, que l'AP perçoit dès que la décision de désignation est portée à sa connaissance (61-1-5, I ;
 *   arrêté du 8 octobre 2015, art. 4), et seulement pour une copropriété de moins de 500 lots : à 500 lots et plus,
 *   l'entière rémunération est fixée par le juge, par dérogation aux art. 4 à 15 (arrêté du 8 octobre 2015, art. 3 ;
 *   cadre « remuneration_fixee_par_le_juge » de honoraires-sinistre.ts). Et tenir compte du recours contre l'ordonnance
 *   (C. pr. civ. art. 714 à 718, auxquels renvoie le III) ? Choix actuel : aucun contrôle (l'élément ne porte pas le
 *   régime du mandat).
 * - 🔴 (Frédéric) Un élément offert ou en contrôle des coûts reste-t-il « A facturer », ou sort-il du cycle ? Choix
 *   actuel : statut inchangé.
 * - 🔴 (Frédéric ou Hugo) Gestion syndic : faut-il bloquer « Facturable » pour un élément qui ne relève d'aucun fondement
 *   de facturation ? Fondements lus (D. 1967 annexes 1 et 2 ; L. 1965) : une prestation particulière de la liste
 *   limitative (D. 1967 annexe 2) ; le dépassement des horaires et durées convenus au forfait (contrat type, 7.1.5) ; les
 *   frais d'affranchissement ou d'acheminement, remboursés à part au syndic pour les prestations du forfait comme pour
 *   les prestations particulières (7.1.5 et 7.2.1, alinéas sur l'envoi des documents : natures Timbre, AR, Diffuseur
 *   AR…) ; les frais et honoraires imputables au seul copropriétaire concerné (L. 1965 art. 10-1, a et b ; contrat type,
 *   point 9 : recouvrement, état daté au plus 380 € TTC, opposition sur mutation, délivrance de copies, assemblée
 *   générale tenue à sa demande). Il faudrait une correspondance entre ces fondements et la nature (NATURES_ELEMENT), le
 *   tarif et le destinataire de l'élément. Choix actuel : aucun blocage.
 * - 🔴 (Frédéric ou Hugo) Compte de charge. 🟢 Arrêté du 14 mars 2005, art. 7 (lu sur Légifrance le 30/10/2026, version
 *   en vigueur) : 621 « Rémunérations du syndic sur gestion copropriété » (6211 « Rémunération du syndic », 6212
 *   « Débours », 6213 « Frais postaux »), 622 « Autres honoraires du syndic » (6221 « Honoraires travaux », 6222
 *   « Prestations particulières », 6223 « Autres honoraires »), 623 « Rémunérations de tiers intervenants », 624 « Frais
 *   du conseil syndical ». L'art. 8 permet d'ouvrir « toute subdivision nécessaire » quand ces comptes ne suffisent pas :
 *   62111, compte du cabinet (tranche 27), est une subdivision de 6211. La rémunération de l'AP relève-t-elle de 6211 ou
 *   de 623 « Rémunérations de tiers intervenants » ? Les frais vont-ils en 6213 « Frais postaux » (Timbre, AR, envois…)
 *   ou en 6212 « Débours » (Copie… ; 62120 « DEBOURS » au plan du cabinet, tranche 27), plutôt qu'au compte des
 *   honoraires ? imputerFacture impute aujourd'hui tout le TTC de la facture sur un seul compte (62111 par défaut).
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

export function creerElement(saisie: SaisieElement): ElementAFacturer {
  qualificationDe(saisie) // contrôle seul : lève sur une qualification inconnue, recopiée telle quelle si elle est fournie
  if (!estDateIsoValide(saisie.date)) throw new Error(`Date invalide (${saisie.date}) : AAAA-MM-JJ attendu.`)
  if (!contient(DOSSIER, saisie.dossier)) throw new Error(`Dossier inconnu : « ${saisie.dossier} ».`)
  if (!contient(NATURES_ELEMENT, saisie.nature)) throw new Error(`Nature d'élément inconnue : « ${saisie.nature} ».`)
  if (!contient(MODES_CALCUL, saisie.calcul)) throw new Error(`Mode de calcul inconnu : « ${saisie.calcul} ».`)
  if (!(saisie.quantite > 0)) throw new Error(`Quantité invalide (${saisie.quantite}) : strictement positive attendue.`)
  if (!Number.isInteger(saisie.prixUnitaireHtDixMilliemes) || saisie.prixUnitaireHtDixMilliemes < 0)
    throw new Error(`Prix unitaire invalide (${saisie.prixUnitaireHtDixMilliemes}) : dix-millièmes d'euro entiers positifs attendus.`)
  if (saisie.fiche) return { ...saisie, fiche: ficheDuDossier(saisie.dossier, saisie.fiche), statut: 'A facturer' }
  return { ...saisie, statut: 'A facturer' }
}

/** Change la qualification d'un élément encore « A facturer » ; l'élément reçu n'est pas modifié. */
export function qualifierElement(element: ElementAFacturer, qualification: QualificationElement): ElementAFacturer {
  if (element.statut !== 'A facturer') throw new Error(`Qualification refusée : l'élément ${element.id} est déjà facturé.`)
  return creerElement({ ...element, qualification })
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
  lignes: { elementId: string; date: string; nature: NatureElement; tarif: string; quantite: number; htCentimes: number }[]
  tvaParTaux: { tauxPct: number; baseCentimes: number; tvaCentimes: number }[]
  totalHtCentimes: number
  totalTvaCentimes: number
  totalTtcCentimes: number
}

/**
 * Regroupe les éléments facturables « A facturer » d'un mandat et d'un destinataire ; renvoie la facture et les éléments
 * à jour. Les éléments offerts ou en contrôle des coûts n'y entrent pas et gardent leur statut (point 67).
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
  }: { id: string; numero: string; date: string; mandatId: string; destinataire: string; type?: FactureHonoraires['type'] },
): { facture: FactureHonoraires; elements: ElementAFacturer[] } {
  if (!estDateIsoValide(date)) throw new Error(`Date de facture invalide (${date}) : AAAA-MM-JJ attendu.`)
  const retenus = elements.filter(
    (e) => e.statut === 'A facturer' && e.mandatId === mandatId && e.destinataire === destinataire && estFacturable(e),
  )
  if (retenus.length === 0) throw new Error('Aucun élément facturable à facturer pour ce mandat et ce destinataire.')
  const parTaux = new Map<number, { baseCentimes: number; tvaCentimes: number }>()
  const lignes = retenus.map((e) => {
    const totaux = totalElement(e)
    if (e.soumisTva) {
      const cumul = parTaux.get(e.tauxTvaPct) ?? { baseCentimes: 0, tvaCentimes: 0 }
      parTaux.set(e.tauxTvaPct, { baseCentimes: cumul.baseCentimes + totaux.htCentimes, tvaCentimes: cumul.tvaCentimes + totaux.tvaCentimes })
    }
    return { elementId: e.id, date: e.date, nature: e.nature, tarif: e.tarif, quantite: e.quantite, htCentimes: totaux.htCentimes }
  })
  const totalHtCentimes = lignes.reduce((s, l) => s + l.htCentimes, 0)
  const tvaParTaux = [...parTaux.entries()].sort(([a], [b]) => a - b).map(([tauxPct, t]) => ({ tauxPct, ...t }))
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
  }
}

export function validerFacture(facture: FactureHonoraires): FactureHonoraires {
  if (facture.statut !== 'Préparation') throw new Error(`Validation refusée : la facture n'est pas en Préparation (${facture.statut}).`)
  return { ...facture, statut: 'Validée, non imputée' }
}

/**
 * Imputation (famille « Imputation des honoraires divers ») : débit du compte de charge du syndicat, crédit du compte
 * fournisseur du cabinet, montant TTC. Seule une facture validée s'impute.
 */
export function imputerFacture(
  facture: FactureHonoraires,
  {
    traitementId,
    segmentSyndicat,
    auxiliaireCabinet,
    date,
    compteCharge = '62111',
  }: { traitementId: string; segmentSyndicat: string; auxiliaireCabinet: string; date: string; compteCharge?: string },
): { facture: FactureHonoraires; traitement: Traitement } {
  if (facture.statut !== 'Validée, non imputée') throw new Error('Imputation refusée : valider la facture d’abord.')
  if (!/^[0-9A-Z]{5}$/.test(auxiliaireCabinet)) throw new Error(`Auxiliaire du cabinet « ${auxiliaireCabinet} » : 5 caractères attendus.`)
  const traitement = creerTraitement({
    id: traitementId,
    famille: 'Imputation des honoraires divers',
    date,
    mouvements: [
      { compte: `${segmentSyndicat}.${compteCharge}.00000.0`, sens: 'debit', montantCentimes: facture.totalTtcCentimes },
      { compte: `${segmentSyndicat}.40100.${auxiliaireCabinet}.0`, sens: 'credit', montantCentimes: facture.totalTtcCentimes },
    ],
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
