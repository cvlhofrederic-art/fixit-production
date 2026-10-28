import { ajouterJours, ecartJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { creerTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Facture fournisseur ventilée en lignes (cartographie Gestéam, tranche 36 : fiche facture et onglet Détail). Fonctions
 * pures, montants en CENTIMES ENTIERS, sans écran. Complète imputation-facture.ts (lecture et proposition d'une imputation
 * unique) pour les factures qui touchent plusieurs comptes, clés ou opérations.
 *
 * Gestéam — par ligne : Client, Lot, Travaux, Contentieux, Sinistre, Domaine, Compte, Analytique, Libellé, Montant TTC,
 * T.V.A., Clé, Rubrique, Code fiscal, Consommation, Récup. locataire %, Base, Honoraires taux % ; en-tête : Échéance (N jours
 * à date de facture), Acompte, Solde, Priorité, Statut, Journal.
 * D1 — comptes au segment du syndicat ; une ligne de travaux porte le n° d'opération en auxiliaire (tranches 24 et 32).
 * Le syndicat n'étant pas assujetti à la TVA, la charge est passée TTC.
 */

export interface LigneFacture {
  /** Code du plan, 5 caractères. */
  comptePlan: string
  analytique: string | null
  cleRepartition: string
  rubrique: string | null
  codeFiscal: string | null
  montantTtcCentimes: number
  /** Part récupérable sur le locataire, en %. */
  recupLocatairePct: number
  lotId: string | null
  rattachement: { type: 'travaux' | 'contentieux' | 'sinistre'; id: string } | null
}

export interface AnomalieVentilation {
  code: 'sans_ligne' | 'ecart_total' | 'compte_invalide' | 'montant_invalide' | 'recuperable_invalide'
  message: string
}

export function controlerVentilation(totalTtcCentimes: number, lignes: LigneFacture[]): AnomalieVentilation[] {
  if (lignes.length === 0) return [{ code: 'sans_ligne', message: 'Facture sans ligne de ventilation.' }]
  const anomalies: AnomalieVentilation[] = []
  for (const l of lignes) {
    if (!/^[0-9A-Z]{5}$/.test(l.comptePlan)) anomalies.push({ code: 'compte_invalide', message: `Compte « ${l.comptePlan} » : 5 caractères attendus.` })
    if (!Number.isInteger(l.montantTtcCentimes) || l.montantTtcCentimes === 0)
      anomalies.push({ code: 'montant_invalide', message: 'Ligne sans montant (centimes entiers non nuls attendus).' })
    if (l.recupLocatairePct < 0 || l.recupLocatairePct > 100)
      anomalies.push({ code: 'recuperable_invalide', message: `Part récupérable de ${l.recupLocatairePct} % : entre 0 et 100 attendue.` })
  }
  const somme = lignes.reduce((s, l) => s + l.montantTtcCentimes, 0)
  if (somme !== totalTtcCentimes)
    anomalies.push({ code: 'ecart_total', message: `Lignes ventilées : ${somme} centimes pour une facture de ${totalTtcCentimes} centimes.` })
  return anomalies
}

/** Total récupérable sur les locataires (arrondi au centime par ligne). */
export const partRecuperable = (lignes: LigneFacture[]): number =>
  lignes.reduce((s, l) => s + Math.round((l.montantTtcCentimes * l.recupLocatairePct) / 100), 0)

/** Écriture « Saisie de factures » : un débit par ligne, un crédit au compte fournisseur ; refusée si mal ventilée. */
export function ecritureFactureVentilee({
  id,
  date,
  segmentSyndicat,
  auxiliaireFournisseur,
  totalTtcCentimes,
  lignes,
}: {
  id: string
  date: string
  segmentSyndicat: string
  auxiliaireFournisseur: string
  totalTtcCentimes: number
  lignes: LigneFacture[]
}): Traitement {
  const anomalies = controlerVentilation(totalTtcCentimes, lignes)
  if (anomalies.length) throw new Error(`Écriture refusée, ventilation à corriger : ${anomalies.map((a) => a.message).join(' ')}`)
  return creerTraitement({
    id,
    famille: 'Saisie de factures',
    date,
    mouvements: [
      ...lignes.map((l) => ({
        compte: `${segmentSyndicat}.${l.comptePlan}.${l.rattachement?.type === 'travaux' ? l.rattachement.id : '00000'}.0`,
        sens: 'debit' as const,
        montantCentimes: l.montantTtcCentimes,
      })),
      { compte: `${segmentSyndicat}.40100.${auxiliaireFournisseur}.0`, sens: 'credit' as const, montantCentimes: totalTtcCentimes },
    ],
  })
}

/** Échéance de règlement (date de facture + N jours), reste dû après acomptes, retard au jour donné. */
export function echeanceReglement(
  {
    dateFacture,
    joursEcheance,
    totalTtcCentimes,
    acomptesCentimes,
  }: { dateFacture: string; joursEcheance: number; totalTtcCentimes: number; acomptesCentimes: number },
  aujourdhui: string,
): { echeance: string; resteDuCentimes: number; enRetard: boolean; joursRetard: number } {
  if (!estDateIsoValide(dateFacture)) throw new Error(`Date de facture invalide (${dateFacture}) : AAAA-MM-JJ attendu.`)
  const echeance = ajouterJours(dateFacture, Math.max(0, joursEcheance))
  const resteDuCentimes = Math.max(0, totalTtcCentimes - acomptesCentimes)
  const joursRetard = resteDuCentimes > 0 ? Math.max(0, ecartJours(echeance, aujourdhui)) : 0
  return { echeance, resteDuCentimes, enRetard: joursRetard > 0, joursRetard }
}
