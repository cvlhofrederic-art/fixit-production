import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { prevuDemande, motifRefusFacture, type Demande } from '@/lib/administrateur-judiciaire/domain/demandes'
import {
  citesDansLeTexte,
  identifierPrestataire,
  type FactureARapprocher,
  type IdentificationPrestataire,
  type PrestataireIdentifiable,
} from '@/lib/administrateur-judiciaire/domain/facture-contrat'
import type { LigneFacture } from '@/lib/administrateur-judiciaire/domain/facture-ventilee'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  COMPTES_CHARGE_PROPOSES,
  proposerImputation,
  type FactureLue,
  type ImputationProposee,
} from '@/lib/administrateur-judiciaire/domain/imputation-facture'
import { normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'
import type { OrdrePrestataire } from '@/lib/administrateur-judiciaire/ordres-prestataire'
import type { DocumentPrestataire } from '@/lib/syndic/messagerie-pro'

/**
 * Facture d'une demande d'intervention (point 43 du bilan 2, partie domaine) : rapprochement facture ↔ demande, prévu
 * comparé au facturé, imputation depuis la ventilation de la demande, rattachement de la ligne de facture, facture déposée
 * par le prestataire VitFix. Fonctions pures, montants en CENTIMES ENTIERS, sans écran ni table. Calqué sur
 * facture-contrat.ts (point 34), dont identifierPrestataire est réutilisé sans modification et dont la sélection des
 * références citées (citesDansLeTexte) a été extraite, sans changement de comportement, pour servir aussi aux N° d'OS ;
 * facture-ventilee.ts, imputation-facture.ts (hors l'ajout de la certitude « demande ») et ordres-prestataire.ts ne sont
 * pas modifiés.
 *
 * Gestéam — 🟢 tranche 43 § 15 : une demande suit SA facture ; la recherche distingue les OS non facturés de ceux dont la
 * facture est à enregistrer, à traiter ou comptabilisée (rapprochement OS ↔ facture). 🟢 Tranche 34 : prix TTC, devis
 * associé, ventilation (clé, analytique), acompte. 🔵 La facture d'une demande connue se code depuis sa ventilation.
 *
 * Le droit — relevé du 29/10/2026 : les opérations sont enregistrées TTC et tout enregistrement porte un libellé
 * identifiant la pièce (arrêté du 14/03/2005, art. 3 et 4) ; la charge est enregistrée dès l'engagement juridique
 * (L. 1965 art. 14-3 ; D. 2005-240 art. 2). La facture porte le numéro du bon de commande quand l'acheteur en a établi un
 * (C. com. art. L. 441-9) : 🔵 le N° d'OS en tient lieu. Aucun texte ne fixe de tolérance entre le prévu et le facturé.
 *
 * 🔴 Non établi — questions :
 * - Frédéric : C. com. art. L. 441-9 (mentions de la facture, dont le n° du bon de commande) s'applique-t-il au syndicat
 *   acheteur ? Le N° d'OS cité n'est ici qu'un indice de rapprochement, jamais exigé.
 * - Hugo : la tolérance de 5 % entre le prévu et le facturé (reprise des contrats) convient-elle aux demandes, ou faut-il
 *   un réglage propre ?
 *
 * Règles de GESTION (aucun texte) : prestataire retrouvé comme pour un contrat (identifiant saisi, SIRET, SIREN, nom
 * exact) ; demandes candidates : même copropriété, même prestataire, intervention pouvant recevoir une facture (ni devis,
 * ni refusée, ni « Non facturé ») et non terminée ; une référence d'OS donnée (dépôt VitFix) écarte les demandes d'un autre
 * numéro ; si le N° d'OS de la facture — la référence donnée, ou, quand elle ne désigne aucune demande, les N° cités dans
 * le texte (facture papier) — ne désigne que des demandes closes, aucune demande n'est retenue (« demande_os_close »,
 * signalé : doublon ou facture reçue après la clôture ?), la facture n'étant jamais reportée sur une autre demande ; le N°
 * d'une demande de devis n'est pas un N° d'OS (une demande de devis ne se facture pas, quel que soit son état : elle n'est
 * jamais « close » pour la facture) : cité dans le texte, il ne désigne aucune demande ; donné en référence, il ne désigne
 * aucun OS, comme une référence inconnue ; une demande ouverte citée à côté d'une close reste retenue ; si plusieurs
 * demandes portent la référence donnée, « ambigu » entre elles seules ; départage par le N° d'OS (donné ou cité dans le
 * texte, un N° cité seulement à l'intérieur d'un N° plus long cité n'étant pas retenu, comme pour les contrats), puis par
 * le prévu dans la tolérance (5 % par défaut, comme les contrats) entre demandes d'un même prestataire ; sinon rien n'est
 * deviné (« ambigu »). La ventilation de la demande l'emporte sur les mots-clés ; toute divergence (compte, clé, décision
 * d'AG) est signalée, et une décision d'AG évoquée par les mots-clés est reportée sur l'imputation (prudence). 🔵 Montant
 * déposé en euros (DocumentPrestataire) converti en centimes par arrondi au centime.
 */

/** Tolérance d'écart entre le prévu et le facturé (règle de gestion, comme contrats-facturation). */
export const TOLERANCE_PREVU_PCT = 5

export interface ContexteRapprochementDemande {
  coproprieteId: string
  prestataires: PrestataireIdentifiable[]
  demandes: readonly Demande[]
  /** Prestataire déjà choisi par le gestionnaire (ou connu de l'ordre VitFix). */
  prestataireId?: string | null
  tolerancePct?: number
}

/** Facture à rapprocher ; `referenceOs` : N° d'OS connu par ailleurs (facture déposée sur un ordre VitFix). */
export type FactureARapprocherDemande = FactureARapprocher & { referenceOs?: string | null }

export type DepartageDemande = 'unique' | 'reference' | 'prix'

/** Comment la facture désigne sa demande : référence d'OS donnée, ou N° d'OS cité dans son texte. */
export type DesignationOs = 'reference' | 'texte'

export type RapprochementDemande =
  | { statut: 'trouve'; demandeId: string; prestataireId: string; identification: IdentificationPrestataire; departage: DepartageDemande }
  | { statut: 'ambigu'; demandeIds: string[]; prestataireId: string | null; identification: IdentificationPrestataire }
  | {
      statut: 'aucun'
      /** `reference_os_inconnue` : la référence d'OS donnée ne désigne aucune intervention (le N° d'un devis n'en est pas une). */
      motif: 'prestataire_inconnu' | 'prestataire_ambigu' | 'aucune_demande_ouverte' | 'reference_os_inconnue'
      prestataireIds: string[]
    }
  /**
   * Le N° d'OS de la facture ne désigne que des interventions closes (terminées, refusées, « Non facturé ») : la référence
   * d'OS donnée (`reference`, dépôt VitFix), à défaut les N° cités dans le texte (`texte`, facture papier). Le N° d'une
   * demande de devis n'en désigne aucune.
   */
  | { statut: 'aucun'; motif: 'demande_os_close'; designation: DesignationOs; prestataireIds: string[]; demandeIds: string[] }

type RapprochementAucun = Extract<RapprochementDemande, { statut: 'aucun' }>

export interface AnomaliePrevuFacture {
  code: 'prevu_inconnu' | 'facture_au_dessus_prevu' | 'facture_en_dessous_prevu'
  message: string
}

export interface ComparaisonPrevuFacture {
  prevuCentimes: number | null
  factureCentimes: number
  /** Facturé − prévu (positif : facturé au-dessus). */
  ecartCentimes: number | null
  /** Écart rapporté au prévu, en %, au dixième, signé ; null si le prévu est inconnu ou nul. */
  ecartPct: number | null
  anomalies: AnomaliePrevuFacture[]
}

const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)

/** Écart signé en %, au dixième (arrondi de la valeur absolue). */
const pourcentageSigne = (ecart: number, base: number): number => Math.sign(ecart) * (Math.round((Math.abs(ecart) / base) * 1000) / 10)

/**
 * Prévu de la demande (devis associé, à défaut prix TTC) comparé au total des factures (acompte et solde additionnés ;
 * un avoir se passe en négatif). Écart au-delà de la tolérance : alerte, au-dessus ou en dessous.
 */
export function comparerPrevuFacture(
  d: Demande,
  facturesTtcCentimes: readonly number[],
  { tolerancePct = TOLERANCE_PREVU_PCT }: { tolerancePct?: number } = {},
): ComparaisonPrevuFacture {
  if (facturesTtcCentimes.some((m) => !Number.isInteger(m))) throw new Error('Montants des factures : centimes entiers attendus.')
  if (!Number.isFinite(tolerancePct) || tolerancePct < 0) throw new Error(`Tolérance invalide (${tolerancePct}) : pourcentage positif attendu.`)
  const factureCentimes = facturesTtcCentimes.reduce((total, m) => total + m, 0)
  const prevuCentimes = prevuDemande(d)
  if (prevuCentimes === null)
    return {
      prevuCentimes,
      factureCentimes,
      ecartCentimes: null,
      ecartPct: null,
      anomalies: [{ code: 'prevu_inconnu', message: 'Prévu inconnu (ni devis associé ni prix) : le facturé ne peut pas être comparé.' }],
    }
  const ecartCentimes = factureCentimes - prevuCentimes
  const ecartPct = prevuCentimes > 0 ? pourcentageSigne(ecartCentimes, prevuCentimes) : null
  const horsTolerance = ecartPct === null ? ecartCentimes !== 0 : Math.abs(ecartPct) > tolerancePct
  const anomalies: AnomaliePrevuFacture[] = []
  const detail = `facturé ${euros(factureCentimes)}, prévu ${euros(prevuCentimes)} (tolérance ${tolerancePct} %)`
  if (horsTolerance && ecartCentimes > 0) anomalies.push({ code: 'facture_au_dessus_prevu', message: `Facture au-dessus du prévu : ${detail}.` })
  if (horsTolerance && ecartCentimes < 0)
    anomalies.push({ code: 'facture_en_dessous_prevu', message: `Facture en dessous du prévu (facture partielle ou acompte ?) : ${detail}.` })
  return { prevuCentimes, factureCentimes, ecartCentimes, ecartPct, anomalies }
}

/** Demande pouvant recevoir une facture : intervention non terminée, ni refusée ni « Non facturé » (motifRefusFacture). */
const peutRecevoirFacture = (d: Demande): boolean => motifRefusFacture(d) === null

const numeroComparable = (numero: string | null | undefined): string => normaliserTexte(numero ?? '')

/** Demandes dont le N° (4 caractères au moins) est cité dans le texte de la facture, hors N° contenu dans un N° plus long. */
const parNumeroCite = (candidates: readonly Demande[], texte: string | undefined): Demande[] =>
  citesDansLeTexte(candidates, (d) => numeroComparable(d.numero), texte)

/** Demande dont le prévu (strictement positif) colle au TTC de la facture. */
function auPrevu(d: Demande, ttcCentimes: number | null | undefined, tolerancePct: number | undefined): boolean {
  if (ttcCentimes == null || ttcCentimes <= 0) return false
  const comparaison = comparerPrevuFacture(d, [ttcCentimes], { tolerancePct })
  return comparaison.prevuCentimes !== null && comparaison.prevuCentimes > 0 && comparaison.anomalies.length === 0
}

type Departage = { demande: Demande; departage: DepartageDemande } | { ambigues: Demande[] }

/** Départage des candidates : référence d'OS donnée, unique, N° cité, puis prévu (même prestataire seulement). */
function departager(candidates: Demande[], facture: FactureARapprocherDemande, tolerancePct: number | undefined): Departage {
  const reference = numeroComparable(facture.referenceOs)
  const parReferenceDonnee = reference ? candidates.filter((d) => numeroComparable(d.numero) === reference) : []
  if (parReferenceDonnee.length === 1) return { demande: parReferenceDonnee[0], departage: 'reference' }
  // Plusieurs demandes portent la référence donnée : rien n'est deviné, et aucune demande sans numéro n'est repêchée.
  if (parReferenceDonnee.length > 1) return { ambigues: parReferenceDonnee }
  if (candidates.length === 1) return { demande: candidates[0], departage: 'unique' }
  const citees = parNumeroCite(candidates, facture.texte)
  if (citees.length === 1) return { demande: citees[0], departage: 'reference' }
  const restantes = citees.length > 1 ? citees : candidates
  const memePrestataire = new Set(restantes.map((d) => d.prestataireId)).size === 1
  const auPrix = memePrestataire ? restantes.filter((d) => auPrevu(d, facture.ttcCentimes, tolerancePct)) : []
  if (auPrix.length === 1) return { demande: auPrix[0], departage: 'prix' }
  return { ambigues: restantes }
}

/**
 * Une demande de devis ne se facture pas, quel que soit son état : son N° n'est pas un N° d'OS et ne désigne jamais la
 * demande de la facture (ni ouverte, ni close).
 */
const estIntervention = (d: Demande): boolean => d.type !== 'devis'

/**
 * Interventions du prestataire (ouvertes ou closes) que la facture désigne : celles de la référence d'OS donnée ; si elle
 * n'en désigne aucune, celles dont le N° est cité dans le texte (facture papier, même règle de citation que le départage).
 * Les N° des demandes de devis restent lus pour la citation : un N° d'OS cité seulement à l'intérieur de l'un d'eux ne
 * compte pas.
 */
function demandesDesignees(duPrestataire: readonly Demande[], reference: string, texte: string | undefined): { par: DesignationOs; demandes: Demande[] } {
  const parReference = reference ? duPrestataire.filter((d) => estIntervention(d) && numeroComparable(d.numero) === reference) : []
  if (parReference.length > 0) return { par: 'reference', demandes: parReference }
  return { par: 'texte', demandes: parNumeroCite(duPrestataire, texte).filter(estIntervention) }
}

/**
 * Candidates parmi les demandes du prestataire dans la copropriété, ou la raison de n'en retenir aucune. Un N° d'OS
 * (référence donnée, à défaut cité dans le texte) qui ne désigne que des demandes closes arrête tout : la facture n'est
 * pas reportée sur une autre demande.
 */
function candidatesDeLaFacture(duPrestataire: readonly Demande[], facture: FactureARapprocherDemande, prestataireIds: string[]): Demande[] | RapprochementAucun {
  const reference = numeroComparable(facture.referenceOs)
  const designees = demandesDesignees(duPrestataire, reference, facture.texte)
  if (designees.demandes.length > 0 && !designees.demandes.some(peutRecevoirFacture))
    return { statut: 'aucun', motif: 'demande_os_close', designation: designees.par, prestataireIds, demandeIds: designees.demandes.map((d) => d.id) }
  const ouvertes = duPrestataire.filter(peutRecevoirFacture)
  if (ouvertes.length === 0) return { statut: 'aucun', motif: prestataireIds.length > 1 ? 'prestataire_ambigu' : 'aucune_demande_ouverte', prestataireIds }
  // Une référence d'OS donnée écarte les demandes qui portent un AUTRE numéro ; celles sans numéro restent candidates.
  const candidates = reference ? ouvertes.filter((d) => d.numero === null || numeroComparable(d.numero) === reference) : ouvertes
  return candidates.length > 0 ? candidates : { statut: 'aucun', motif: 'reference_os_inconnue', prestataireIds }
}

/** Demande de la facture : ouverte, du prestataire, dans la copropriété ; départagée par le N° d'OS puis le prévu. */
export function rapprocherFactureDemande(facture: FactureARapprocherDemande, contexte: ContexteRapprochementDemande): RapprochementDemande {
  const { prestataireIds, identification } = identifierPrestataire(facture, contexte.prestataires, contexte.prestataireId ?? null)
  if (identification === null) return { statut: 'aucun', motif: 'prestataire_inconnu', prestataireIds: [] }
  const duPrestataire = contexte.demandes.filter(
    (d) => d.prestataireId !== null && prestataireIds.includes(d.prestataireId) && d.coproprieteId === contexte.coproprieteId,
  )
  const candidates = candidatesDeLaFacture(duPrestataire, facture, prestataireIds)
  if (!Array.isArray(candidates)) return candidates
  const resultat = departager(candidates, facture, contexte.tolerancePct)
  if ('demande' in resultat)
    return {
      statut: 'trouve',
      demandeId: resultat.demande.id,
      prestataireId: resultat.demande.prestataireId as string,
      identification,
      departage: resultat.departage,
    }
  const prestataires = new Set(resultat.ambigues.map((d) => d.prestataireId))
  return {
    statut: 'ambigu',
    demandeIds: resultat.ambigues.map((d) => d.id),
    prestataireId: prestataires.size === 1 ? resultat.ambigues[0].prestataireId : null,
    identification,
  }
}

/** Imputation reprise de la ventilation de la demande, complétée du compte proposé quand il est connu ; null sans compte. */
export function imputationDepuisDemande(d: Demande): ImputationProposee | null {
  const ventilation = d.ventilation
  if (!ventilation?.comptePlan) return null
  const compte = COMPTES_CHARGE_PROPOSES.find((c) => c.comptePlan === ventilation.comptePlan)
  return {
    comptePlan: ventilation.comptePlan,
    libelleCompte: compte?.libelleCompte ?? null,
    familleAnalytique: compte?.familleAnalytique ?? null,
    rubriqueAnalytique: ventilation.analytique,
    cleRepartition: ventilation.cleRepartition,
    decisionAgRequise: compte?.decisionAgRequise ?? false,
    certitude: 'demande',
  }
}

export interface AlerteImputationDemande {
  code: 'demande_ambigue' | 'demande_os_close' | 'ventilation_absente' | 'cle_demande_inconnue' | 'mots_cles_divergents' | 'decision_ag_possible'
  message: string
}

const SOURCE_DESIGNATION: Readonly<Record<DesignationOs, string>> = {
  reference: "La référence d'OS donnée",
  texte: "Le N° d'OS cité dans le texte de la facture",
}

/** Alerte d'une facture sans demande retenue : seul un N° d'OS (donné ou cité) qui désigne une demande close est signalé. */
function alertesSansDemande(rapprochement: RapprochementAucun, demandes: readonly Demande[]): AlerteImputationDemande[] {
  if (rapprochement.motif !== 'demande_os_close') return []
  const closes = demandes
    .filter((d) => rapprochement.demandeIds.includes(d.id))
    .map((d) => `${d.numero ?? ''}, demande ${d.id} : ${motifRefusFacture(d) ?? 'close'}`)
  return [
    {
      code: 'demande_os_close',
      message: `${SOURCE_DESIGNATION[rapprochement.designation]} désigne une demande close (${closes.join(' ; ')}) : la facture n'est rattachée à aucune autre demande ; vérifier un doublon ou une facture reçue après la clôture.`,
    },
  ]
}

export interface ImputationFactureDemande {
  imputation: ImputationProposee
  rapprochement: RapprochementDemande
  demandeId: string | null
  /** Prévu de la demande comparé à CETTE facture ; null sans demande rapprochée ou sans TTC lisible. */
  comparaison: ComparaisonPrevuFacture | null
  alertes: AlerteImputationDemande[]
}

/** Imputation de la demande, avec les divergences des mots-clés et de la clé signalées. */
function imputationDemandeRetenue(
  deLaDemande: ImputationProposee,
  motsCles: ImputationProposee,
  clesDisponibles: string[],
): { imputation: ImputationProposee; alertes: AlerteImputationDemande[] } {
  const alertes: AlerteImputationDemande[] = []
  const cle = deLaDemande.cleRepartition
  if (cle !== null && clesDisponibles.length > 0 && !clesDisponibles.includes(cle))
    alertes.push({ code: 'cle_demande_inconnue', message: `Clé « ${cle} » de la demande absente des clés de la copropriété : à vérifier.` })
  if (motsCles.comptePlan !== null && motsCles.comptePlan !== deLaDemande.comptePlan)
    alertes.push({
      code: 'mots_cles_divergents',
      message: `Mots de la facture orientés vers le compte ${motsCles.comptePlan} : vérifier que la facture relève bien de la demande.`,
    })
  if (motsCles.decisionAgRequise && !deLaDemande.decisionAgRequise)
    alertes.push({
      code: 'decision_ag_possible',
      message: "Les mots de la facture évoquent des travaux décidés par l'assemblée générale : vérifier la décision qui fonde la dépense.",
    })
  return { imputation: { ...deLaDemande, decisionAgRequise: deLaDemande.decisionAgRequise || motsCles.decisionAgRequise }, alertes }
}

/**
 * Imputation proposée : celle de la demande rapprochée si elle est ventilée (divergences signalées) ; celle des mots-clés
 * (inchangée) sinon, avec l'alerte qui explique pourquoi.
 */
export function proposerImputationFactureDemande(
  facture: FactureLue & { referenceOs?: string | null },
  clesDisponibles: string[],
  contexte: ContexteRapprochementDemande,
): ImputationFactureDemande {
  const rapprochement = rapprocherFactureDemande(facture, contexte)
  const motsCles = proposerImputation(facture, clesDisponibles)
  const sansDemande = { imputation: motsCles, rapprochement, demandeId: null, comparaison: null }
  if (rapprochement.statut === 'ambigu')
    return { ...sansDemande, alertes: [{ code: 'demande_ambigue', message: 'Plusieurs demandes possibles pour cette facture : choisir la demande.' }] }
  if (rapprochement.statut === 'aucun') return { ...sansDemande, alertes: alertesSansDemande(rapprochement, contexte.demandes) }
  const demande = contexte.demandes.find((d) => d.id === rapprochement.demandeId) as Demande
  const comparaison = facture.ttcCentimes === null ? null : comparerPrevuFacture(demande, [facture.ttcCentimes], { tolerancePct: contexte.tolerancePct })
  const base = { rapprochement, demandeId: demande.id, comparaison }
  const deLaDemande = imputationDepuisDemande(demande)
  if (!deLaDemande)
    return { ...base, imputation: motsCles, alertes: [{ code: 'ventilation_absente', message: 'Demande sans ventilation : imputation par mots-clés, à vérifier.' }] }
  return { ...base, ...imputationDemandeRetenue(deLaDemande, motsCles, clesDisponibles) }
}

/** Dossier de la demande → rattachement d'une ligne de facture ventilée (facture-ventilee.ts, non modifié). */
const RATTACHEMENT_LIGNE_PAR_DOSSIER: ReadonlyMap<string, NonNullable<LigneFacture['rattachement']>['type']> = new Map([
  ['Travaux', 'travaux'],
  ['Contentieux', 'contentieux'],
  ['Sinistre', 'sinistre'],
])

/** Rattachement de la ligne de facture tiré du dossier de la demande ; null pour un autre dossier ou sans dossier. */
export function rattachementLigneDepuisDemande(d: Demande): LigneFacture['rattachement'] {
  const type = d.dossier ? RATTACHEMENT_LIGNE_PAR_DOSSIER.get(d.dossier.type) : undefined
  return type && d.dossier ? { type, id: d.dossier.id } : null
}

/**
 * Facture déposée par le prestataire sur un ordre VitFix : une facture lue (HT et TVA inconnus, seul le TTC est déposé)
 * avec la référence de l'OS, prête pour rapprocherFactureDemande et proposerImputationFactureDemande.
 */
export interface FactureDeposee extends FactureLue {
  referenceOs: string | null
}

const texteOuNull = (valeur: string): string | null => {
  const texte = valeur.trim()
  return texte === '' ? null : texte
}

/**
 * Facture déposée dans la conversation de l'ordre (DocumentPrestataire, montant en euros) → facture à rapprocher et à
 * imputer, avec la référence de l'OS (referenceAj). Un devis ou un rapport ne s'impute pas.
 */
export function factureDeposeeDepuisOrdre(document: DocumentPrestataire, ordre: Pick<OrdrePrestataire, 'referenceAj' | 'prestataire'>): FactureDeposee {
  if (document.type !== 'facture') throw new Error(`Document « ${document.type} » : seule une facture s'impute à une demande.`)
  return {
    fournisseur: texteOuNull(ordre.prestataire.nom),
    siret: null,
    numero: texteOuNull(document.reference),
    date: estDateIsoValide(document.date) ? document.date : null,
    htCentimes: null,
    tauxTva: null,
    tvaCentimes: null,
    ttcCentimes: document.montant_ttc === undefined ? null : Math.round(document.montant_ttc * 100),
    referenceOs: texteOuNull(ordre.referenceAj),
    texte: document.description,
  }
}
