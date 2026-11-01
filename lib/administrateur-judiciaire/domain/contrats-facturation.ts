import { ajouterMois, ecartJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { ImputationProposee } from '@/lib/administrateur-judiciaire/domain/imputation-facture'

/**
 * Contrats — reconduction et facturation (cartographie Gestéam, tranche 33 : fiche contrat et onglet Facturation).
 * Fonctions pures, montants en CENTIMES ENTIERS, dates ISO, sans écran. Complète contrats.ts (fenêtres de reconduction et
 * de mise en concurrence, lot 1).
 *
 * Gestéam — fiche : Date d'effet, Durée, Terme, Reconduction (Préavis, Limite, Tacite, Suivante), À résilier ;
 * onglet Facturation : Prix € TTC (Dernier, Origine, Montant d'alerte), Indice (Valeur, Origine, Révision), Factures
 * (Dernière, Périodicité), Règlement, Ventilation (Clé, Analytique, Libellé).
 * Règles de GESTION (aucun texte cité) : la tolérance d'écart de prix est un réglage (5 % par défaut).
 * 🔵 Révision = prix d'origine × valeur actuelle de l'indice / valeur d'origine (formule simple, sans part fixe).
 */

export interface CodificationContrat {
  cleRepartition: string
  comptePlan: string
  analytique: string
  libelle: string
}

export interface FacturationContrat {
  dateEffet: string
  dureeMois: number
  tacite: boolean
  preavisMois: number
  prixOrigineTtcCentimes: number | null
  prixDernierTtcCentimes: number | null
  montantAlerteCentimes: number | null
  indice: { origine: number; actuel: number } | null
  periodiciteFacturesMois: number | null
  derniereFacture: string | null
  /** Tolérance « facture en retard N jours ». */
  retardFactureJours: number | null
  codification: CodificationContrat | null
}

/** Terme en cours : premier terme après `aujourdhui` si reconduction tacite, sinon le terme initial. */
export function prochainTerme(contrat: FacturationContrat, aujourdhui: string): string {
  if (!estDateIsoValide(contrat.dateEffet)) throw new Error(`Date d'effet invalide (${contrat.dateEffet}) : AAAA-MM-JJ attendu.`)
  if (!Number.isInteger(contrat.dureeMois) || contrat.dureeMois < 1) throw new Error(`Durée invalide (${contrat.dureeMois} mois).`)
  let terme = ajouterMois(contrat.dateEffet, contrat.dureeMois)
  if (!contrat.tacite) return terme
  while (terme <= aujourdhui) terme = ajouterMois(terme, contrat.dureeMois)
  return terme
}

/** Date limite pour résilier avant le terme en cours : terme − préavis. */
export const dateLimiteResiliation = (contrat: FacturationContrat, aujourdhui: string): string =>
  ajouterMois(prochainTerme(contrat, aujourdhui), -Math.max(0, contrat.preavisMois))

/** Prix attendu de la facture : prix d'origine révisé par l'indice, à défaut le dernier prix (null si inconnu). */
export function prixAttendu(contrat: FacturationContrat): number | null {
  if (contrat.indice && contrat.prixOrigineTtcCentimes !== null && contrat.indice.origine > 0)
    return Math.round((contrat.prixOrigineTtcCentimes * contrat.indice.actuel) / contrat.indice.origine)
  return contrat.prixDernierTtcCentimes
}

export interface AnomalieFactureContrat {
  code: 'au_dessus_montant_alerte' | 'ecart_prix_attendu'
  message: string
}

/** Contrôle d'une facture reçue au titre du contrat (règles de gestion). */
export function controlerFactureContrat(
  montantTtcCentimes: number,
  contrat: FacturationContrat,
  { tolerancePct = 5 }: { tolerancePct?: number } = {},
): AnomalieFactureContrat[] {
  const anomalies: AnomalieFactureContrat[] = []
  if (contrat.montantAlerteCentimes !== null && montantTtcCentimes > contrat.montantAlerteCentimes)
    anomalies.push({ code: 'au_dessus_montant_alerte', message: 'Facture au-dessus du montant d’alerte fixé au contrat.' })
  const attendu = prixAttendu(contrat)
  if (attendu) {
    const ecartPct = Math.round((Math.abs(montantTtcCentimes - attendu) / attendu) * 1000) / 10
    if (ecartPct > tolerancePct)
      anomalies.push({ code: 'ecart_prix_attendu', message: `Écart de ${ecartPct} % avec le prix attendu du contrat (tolérance ${tolerancePct} %).` })
  }
  return anomalies
}

/** Facture attendue (dernière + périodicité) et retard au jour donné ; null si rien ne permet de l'attendre. */
export function factureEnRetard(contrat: FacturationContrat, aujourdhui: string): { attendueLe: string; joursRetard: number; enRetard: boolean } | null {
  if (!contrat.derniereFacture || !contrat.periodiciteFacturesMois) return null
  const attendueLe = ajouterMois(contrat.derniereFacture, contrat.periodiciteFacturesMois)
  const joursRetard = Math.max(0, ecartJours(attendueLe, aujourdhui))
  return { attendueLe, joursRetard, enRetard: joursRetard > (contrat.retardFactureJours ?? 0) }
}

/** Codification proposée d'après le contrat ; null sans codification (repli sur les mots-clés d'imputation-facture). */
export function imputationDepuisContrat(contrat: FacturationContrat): ImputationProposee | null {
  if (!contrat.codification) return null
  const { comptePlan, libelle, analytique, cleRepartition } = contrat.codification
  return {
    comptePlan,
    libelleCompte: libelle,
    familleAnalytique: null,
    rubriqueAnalytique: analytique,
    cleRepartition,
    decisionAgRequise: false,
    certitude: 'contrat',
  }
}
