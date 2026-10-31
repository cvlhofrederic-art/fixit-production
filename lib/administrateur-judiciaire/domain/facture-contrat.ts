import {
  controlerFactureContrat,
  imputationDepuisContrat,
  prixAttendu,
  type AnomalieFactureContrat,
  type FacturationContrat,
} from '@/lib/administrateur-judiciaire/domain/contrats-facturation'
import {
  COMPTES_CHARGE_PROPOSES,
  proposerImputation,
  type FactureLue,
  type ImputationProposee,
} from '@/lib/administrateur-judiciaire/domain/imputation-facture'
import { normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'
import type { StatutContrat, TypeContrat } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Imputation d'une facture fournisseur depuis son contrat (point 34 du bilan 2). Fonctions pures, montants en CENTIMES
 * ENTIERS, sans écran ni table : compose contrats-facturation.ts et imputation-facture.ts sans les modifier.
 *
 * Gestéam — 🟢 tranche 33 : la fiche contrat rattache l'immeuble, le mandat et l'entreprise ; l'onglet Facturation porte
 * la ventilation (clé, analytique, libellé), le prix, l'indice et le montant d'alerte. 🔵 La facture d'un contrat connu
 * se code depuis le contrat, sans mots-clés.
 *
 * Règles de GESTION (aucun texte) : le prestataire est retrouvé, dans l'ordre, par l'identifiant déjà saisi, le SIRET,
 * le SIREN (autre établissement de la même entreprise), puis le nom exact sans forme juridique — jamais par un nom
 * approché, ni par le nom quand le SIRET de la facture contredit celui du prestataire ; le contrat retenu est un contrat
 * en cours du prestataire dans la copropriété ; plusieurs contrats d'un même prestataire se départagent par la référence
 * citée dans la facture, puis par le prix attendu ; des contrats de prestataires différents ne se départagent que par la
 * référence ; sinon rien n'est deviné (« ambigu »). La codification du contrat l'emporte sur les mots-clés quand la
 * facture lui correspond ; une facture au prix éloigné du contrat (travaux hors contrat probables) reprend les mots-clés,
 * et toute divergence (compte, décision d'AG) est signalée.
 */

export interface PrestataireIdentifiable {
  id: string
  nom: string
  siret: string | null
}

export interface ContratRapprochable {
  id: string
  prestataireId: string
  coproprieteId: string
  /** Absent : en cours (comme contrats.ts). */
  statut?: StatutContrat
  type?: TypeContrat
  /** N° du contrat chez l'entreprise ou référence de facturation (Gestéam « N° », « Référence »). */
  reference?: string | null
  facturation?: FacturationContrat
}

export type FactureARapprocher = Pick<FactureLue, 'fournisseur' | 'siret'> & { texte?: string; ttcCentimes?: number | null }

export interface ContexteRapprochement {
  coproprieteId: string
  prestataires: PrestataireIdentifiable[]
  contrats: ContratRapprochable[]
  /** Prestataire déjà choisi par le gestionnaire. */
  prestataireId?: string | null
  /** Tolérance d'écart de prix (contrats-facturation, 5 % par défaut). */
  tolerancePct?: number
}

export type IdentificationPrestataire = 'saisi' | 'siret' | 'siren' | 'nom'

const FORMES_JURIDIQUES = new Set(['SARL', 'SAS', 'SASU', 'SA', 'EURL', 'SNC', 'SCI', 'ETS', 'ETABLISSEMENTS'])

/** Nom comparable : majuscules sans accents ni points, sans forme juridique. */
const nomComparable = (nom: string): string =>
  normaliserTexte(nom.replace(/\./g, ''))
    .split(' ')
    .filter((mot) => mot && !FORMES_JURIDIQUES.has(mot))
    .join(' ')

const chiffres = (texte: string | null): string => (texte ?? '').replace(/\D/g, '')

/** Prestataire de la facture : premier critère qui retrouve au moins un prestataire. */
export function identifierPrestataire(
  facture: FactureARapprocher,
  prestataires: PrestataireIdentifiable[],
  prestataireId: string | null = null,
): { prestataireIds: string[]; identification: IdentificationPrestataire | null } {
  const ids = (liste: PrestataireIdentifiable[]) => liste.map((p) => p.id)
  if (prestataireId && prestataires.some((p) => p.id === prestataireId)) return { prestataireIds: [prestataireId], identification: 'saisi' }
  const siret = chiffres(facture.siret)
  if (siret.length === 14) {
    const exacts = prestataires.filter((p) => chiffres(p.siret) === siret)
    if (exacts.length > 0) return { prestataireIds: ids(exacts), identification: 'siret' }
    const memeSiren = prestataires.filter((p) => chiffres(p.siret).length === 14 && chiffres(p.siret).slice(0, 9) === siret.slice(0, 9))
    if (memeSiren.length > 0) return { prestataireIds: ids(memeSiren), identification: 'siren' }
  }
  const nom = facture.fournisseur ? nomComparable(facture.fournisseur) : ''
  // Un SIRET de facture valide écarte, au niveau du nom, les prestataires dont le SIRET connu désigne une autre entreprise.
  const siretContredit = (p: PrestataireIdentifiable) =>
    siret.length === 14 && chiffres(p.siret).length === 14 && chiffres(p.siret).slice(0, 9) !== siret.slice(0, 9)
  const memeNom = nom ? prestataires.filter((p) => nomComparable(p.nom) === nom && !siretContredit(p)) : []
  if (memeNom.length > 0) return { prestataireIds: ids(memeNom), identification: 'nom' }
  return { prestataireIds: [], identification: null }
}

export type RapprochementContrat =
  | { statut: 'trouve'; contratId: string; prestataireId: string; identification: IdentificationPrestataire; departage: 'unique' | 'reference' | 'prix' }
  | { statut: 'ambigu'; contratIds: string[]; prestataireId: string | null; identification: IdentificationPrestataire }
  | { statut: 'aucun'; motif: 'prestataire_inconnu' | 'prestataire_ambigu' | 'aucun_contrat_en_cours'; prestataireIds: string[] }

const enCours = (c: ContratRapprochable): boolean => (c.statut ?? 'En cours') === 'En cours'

const referenceDe = (c: ContratRapprochable): string => normaliserTexte(c.reference ?? '')

const contient = (corps: string, reference: string): boolean => corps.includes(` ${reference} `)

/**
 * Contrats dont la référence (4 caractères au moins) est citée dans le texte de la facture. Une référence citée seulement
 * à l'intérieur d'une référence plus longue (« MAINT 4471 » dans « MAINT 4471 B ») est écartée ; citée aussi à part, elle
 * reste candidate.
 */
function parReference(candidats: ContratRapprochable[], texte: string | undefined): ContratRapprochable[] {
  const corps = ` ${normaliserTexte(texte ?? '')} `
  const cites = candidats.filter((c) => referenceDe(c).replace(/ /g, '').length >= 4 && contient(corps, referenceDe(c)))
  return cites.filter((c) => {
    const reference = referenceDe(c)
    const plusLongues = cites.map(referenceDe).filter((autre) => autre.length > reference.length && contient(` ${autre} `, reference))
    let reste = corps
    // Remplacement une à une : deux occurrences côte à côte partagent l'espace qui les sépare.
    for (const autre of plusLongues) while (contient(reste, autre)) reste = reste.replace(` ${autre} `, ' # ')
    return contient(reste, reference)
  })
}

/** Prix attendu connu et strictement positif. */
const prixPositif = (f: FacturationContrat): boolean => (prixAttendu(f) ?? 0) > 0

/** Facture et prix du contrat : au prix, en écart, montant de la facture illisible (ou avoir), prix du contrat inconnu. */
type CorrespondancePrix = 'au_prix' | 'ecart' | 'ttc_inconnu' | 'prix_inconnu'

function correspondancePrix(f: FacturationContrat, ttcCentimes: number | null | undefined, tolerancePct: number | undefined): CorrespondancePrix {
  if (ttcCentimes == null || ttcCentimes <= 0) return 'ttc_inconnu'
  if (!prixPositif(f)) return 'prix_inconnu'
  return controlerFactureContrat(ttcCentimes, f, { tolerancePct }).some((a) => a.code === 'ecart_prix_attendu') ? 'ecart' : 'au_prix'
}

/** Contrats dont le prix attendu (strictement positif) colle au TTC de la facture. */
const parPrix = (candidats: ContratRapprochable[], ttcCentimes: number | null | undefined, tolerancePct: number | undefined): ContratRapprochable[] =>
  candidats.filter((c) => c.facturation !== undefined && correspondancePrix(c.facturation, ttcCentimes, tolerancePct) === 'au_prix')

/** Entreprise d'un prestataire : son SIREN quand son SIRET est connu (plusieurs établissements), sinon le prestataire. */
function entrepriseDe(prestataireId: string, prestataires: PrestataireIdentifiable[]): string {
  const siret = chiffres(prestataires.find((p) => p.id === prestataireId)?.siret ?? null)
  return siret.length === 14 ? `siren:${siret.slice(0, 9)}` : `prestataire:${prestataireId}`
}

/** Contrat de la facture : en cours, du prestataire, dans la copropriété ; départagé par la référence puis le prix. */
export function rapprocherFactureContrat(facture: FactureARapprocher, contexte: ContexteRapprochement): RapprochementContrat {
  const { prestataireIds, identification } = identifierPrestataire(facture, contexte.prestataires, contexte.prestataireId ?? null)
  if (identification === null) return { statut: 'aucun', motif: 'prestataire_inconnu', prestataireIds: [] }
  const candidats = contexte.contrats.filter((c) => prestataireIds.includes(c.prestataireId) && c.coproprieteId === contexte.coproprieteId && enCours(c))
  if (candidats.length === 0)
    return { statut: 'aucun', motif: prestataireIds.length > 1 ? 'prestataire_ambigu' : 'aucun_contrat_en_cours', prestataireIds }
  const trouve = (c: ContratRapprochable, departage: 'unique' | 'reference' | 'prix'): RapprochementContrat => ({
    statut: 'trouve',
    contratId: c.id,
    prestataireId: c.prestataireId,
    identification,
    departage,
  })
  if (candidats.length === 1) return trouve(candidats[0], 'unique')
  const references = parReference(candidats, facture.texte)
  if (references.length === 1) return trouve(references[0], 'reference')
  const restants = references.length > 1 ? references : candidats
  const prestatairesCandidats = new Set(restants.map((c) => c.prestataireId))
  const entreprises = new Set(restants.map((c) => entrepriseDe(c.prestataireId, contexte.prestataires)))
  // Le prix ne départage que les contrats d'une même entreprise (même SIREN), jamais deux entreprises distinctes.
  const prix = entreprises.size === 1 ? parPrix(restants, facture.ttcCentimes, contexte.tolerancePct) : []
  if (prix.length === 1) return trouve(prix[0], 'prix')
  return {
    statut: 'ambigu',
    contratIds: restants.map((c) => c.id),
    prestataireId: prestatairesCandidats.size === 1 ? restants[0].prestataireId : null,
    identification,
  }
}

export interface AlerteImputationContrat {
  code: 'codification_absente' | 'cle_contrat_inconnue' | 'contrat_ambigu' | 'facture_hors_contrat_possible' | 'mots_cles_divergents' | 'decision_ag_possible'
  message: string
}

export interface ImputationFactureContrat {
  imputation: ImputationProposee
  rapprochement: RapprochementContrat
  contratId: string | null
  /** Contrôles du contrat (montant d'alerte, prix attendu) sur la facture rapprochée. */
  anomaliesContrat: AnomalieFactureContrat[]
  alertes: AlerteImputationContrat[]
}

/** Codification du contrat, complétée de la famille analytique et de la décision d'AG du compte quand il est connu. */
function imputationDuContrat(facturation: FacturationContrat): ImputationProposee | null {
  const imputation = imputationDepuisContrat(facturation)
  if (!imputation) return null
  const compte = COMPTES_CHARGE_PROPOSES.find((c) => c.comptePlan === imputation.comptePlan)
  return compte ? { ...imputation, familleAnalytique: imputation.familleAnalytique ?? compte.familleAnalytique, decisionAgRequise: compte.decisionAgRequise } : imputation
}

const ALERTE_DECISION_AG: AlerteImputationContrat = {
  code: 'decision_ag_possible',
  message: "Les mots de la facture évoquent des travaux décidés par l'assemblée générale : vérifier qu'elle relève bien du contrat.",
}

const CAUSE_PRIX_NON_COMPARE: Record<'ttc_inconnu' | 'prix_inconnu', string> = {
  ttc_inconnu: 'Montant TTC de la facture illisible (ou avoir)',
  prix_inconnu: 'Prix du contrat inconnu',
}

/**
 * Imputation du contrat retenue, avec les divergences des mots-clés signalées quand le prix ne permet pas de confirmer que
 * la facture relève du contrat ; une facture au prix garde la décision d'AG du compte du contrat.
 */
function imputationContratRetenue(
  duContrat: ImputationProposee,
  motsCles: ImputationProposee,
  clesDisponibles: string[],
  prix: CorrespondancePrix,
): { imputation: ImputationProposee; alertes: AlerteImputationContrat[] } {
  const alertes: AlerteImputationContrat[] = []
  if (duContrat.cleRepartition !== null && clesDisponibles.length > 0 && !clesDisponibles.includes(duContrat.cleRepartition))
    alertes.push({ code: 'cle_contrat_inconnue', message: `Clé « ${duContrat.cleRepartition} » du contrat absente des clés de la copropriété : à vérifier.` })
  if (prix === 'au_prix') return { imputation: duContrat, alertes }
  if ((prix === 'ttc_inconnu' || prix === 'prix_inconnu') && motsCles.comptePlan !== null && motsCles.comptePlan !== duContrat.comptePlan)
    alertes.push({
      code: 'mots_cles_divergents',
      message: `${CAUSE_PRIX_NON_COMPARE[prix]} et mots de la facture orientés vers le compte ${motsCles.comptePlan} : vérifier que la facture relève du contrat.`,
    })
  if (motsCles.decisionAgRequise) alertes.push(ALERTE_DECISION_AG)
  return { imputation: { ...duContrat, decisionAgRequise: duContrat.decisionAgRequise || motsCles.decisionAgRequise }, alertes }
}

/**
 * Imputation proposée : celle du contrat rapproché s'il est codifié, sauf facture éloignée de son prix dont les mots-clés
 * désignent un autre compte (travaux hors contrat probables) ; celle des mots-clés (inchangée) sinon, avec l'alerte qui
 * explique pourquoi.
 */
export function proposerImputationFacture(facture: FactureLue, clesDisponibles: string[], contexte: ContexteRapprochement): ImputationFactureContrat {
  const rapprochement = rapprocherFactureContrat(facture, contexte)
  const motsCles = proposerImputation(facture, clesDisponibles)
  if (rapprochement.statut === 'ambigu')
    return {
      imputation: motsCles,
      rapprochement,
      contratId: null,
      anomaliesContrat: [],
      alertes: [{ code: 'contrat_ambigu', message: 'Plusieurs contrats possibles pour cette facture : choisir le contrat.' }],
    }
  if (rapprochement.statut === 'aucun') return { imputation: motsCles, rapprochement, contratId: null, anomaliesContrat: [], alertes: [] }
  const contrat = contexte.contrats.find((c) => c.id === rapprochement.contratId) as ContratRapprochable
  const f = contrat.facturation
  const anomaliesContrat = f && facture.ttcCentimes !== null ? controlerFactureContrat(facture.ttcCentimes, f, { tolerancePct: contexte.tolerancePct }) : []
  const duContrat = f ? imputationDuContrat(f) : null
  const base = { rapprochement, contratId: contrat.id, anomaliesContrat }
  if (!duContrat)
    return { ...base, imputation: motsCles, alertes: [{ code: 'codification_absente', message: 'Contrat sans ventilation : imputation par mots-clés, à vérifier.' }] }
  const prix = correspondancePrix(f as FacturationContrat, facture.ttcCentimes, contexte.tolerancePct)
  const autreCompte = motsCles.comptePlan !== null && motsCles.comptePlan !== duContrat.comptePlan
  if (prix === 'ecart' && autreCompte)
    return {
      ...base,
      imputation: motsCles,
      alertes: [
        {
          code: 'facture_hors_contrat_possible',
          message: `Facture éloignée du prix du contrat et mots orientés vers le compte ${motsCles.comptePlan} : travaux hors contrat probables, imputation par mots-clés à vérifier.`,
        },
        ...(motsCles.decisionAgRequise ? [ALERTE_DECISION_AG] : []),
      ],
    }
  const retenue = imputationContratRetenue(duContrat, motsCles, clesDisponibles, prix)
  if (prix === 'ecart')
    retenue.alertes.unshift({
      code: 'facture_hors_contrat_possible',
      message: "Facture éloignée du prix du contrat (révision d'indice non saisie, prestation supplémentaire ?) : imputation du contrat gardée, à vérifier.",
    })
  return { ...base, ...retenue }
}
