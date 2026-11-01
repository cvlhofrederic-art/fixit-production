import { ajouterMois, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
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
 * 🔵 Compte de charge par défaut 62111 « honoraires administrateur provisoire » (plan observé, tranche 27).
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

export const MODES_CALCUL = ['Coût unitaire', 'Coût horaire', 'Barème temps'] as const
export type ModeCalcul = (typeof MODES_CALCUL)[number]

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
}

export interface ElementAFacturer extends SaisieElement {
  statut: 'A facturer' | 'Facturé'
}

const contient = (liste: readonly string[], valeur: string) => liste.includes(valeur)

export function creerElement(saisie: SaisieElement): ElementAFacturer {
  if (!estDateIsoValide(saisie.date)) throw new Error(`Date invalide (${saisie.date}) : AAAA-MM-JJ attendu.`)
  if (!contient(DOSSIER, saisie.dossier)) throw new Error(`Dossier inconnu : « ${saisie.dossier} ».`)
  if (!contient(NATURES_ELEMENT, saisie.nature)) throw new Error(`Nature d'élément inconnue : « ${saisie.nature} ».`)
  if (!contient(MODES_CALCUL, saisie.calcul)) throw new Error(`Mode de calcul inconnu : « ${saisie.calcul} ».`)
  if (!(saisie.quantite > 0)) throw new Error(`Quantité invalide (${saisie.quantite}) : strictement positive attendue.`)
  if (!Number.isInteger(saisie.prixUnitaireHtDixMilliemes) || saisie.prixUnitaireHtDixMilliemes < 0)
    throw new Error(`Prix unitaire invalide (${saisie.prixUnitaireHtDixMilliemes}) : dix-millièmes d'euro entiers positifs attendus.`)
  return { ...saisie, statut: 'A facturer' }
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

/** Regroupe les éléments « A facturer » d'un mandat et d'un destinataire ; renvoie la facture et les éléments à jour. */
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
  const retenus = elements.filter((e) => e.statut === 'A facturer' && e.mandatId === mandatId && e.destinataire === destinataire)
  if (retenus.length === 0) throw new Error('Aucun élément à facturer pour ce mandat et ce destinataire.')
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
