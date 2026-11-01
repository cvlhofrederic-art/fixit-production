import { ajouterJours, ecartJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  creerTraitement,
  estPourcentage,
  type LiensMouvement,
  type Traitement,
} from '@/lib/administrateur-judiciaire/domain/traitements'

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
  /** Base de calcul des honoraires (Gestéam « Base »), en centimes ; absente : aucune. */
  baseHonorairesCentimes?: number | null
  /** Taux d'honoraires appliqué à la base (Gestéam « Honoraires taux % »). */
  tauxHonorairesPct?: number | null
}

export interface AnomalieVentilation {
  code: 'sans_ligne' | 'ecart_total' | 'compte_invalide' | 'montant_invalide' | 'recuperable_invalide' | 'honoraires_invalide'
  message: string
}

const basesHonorairesValides = (l: LigneFacture): boolean =>
  (l.baseHonorairesCentimes == null || (Number.isInteger(l.baseHonorairesCentimes) && l.baseHonorairesCentimes >= 0)) &&
  (l.tauxHonorairesPct == null || estPourcentage(l.tauxHonorairesPct))

export function controlerVentilation(totalTtcCentimes: number, lignes: LigneFacture[]): AnomalieVentilation[] {
  if (lignes.length === 0) return [{ code: 'sans_ligne', message: 'Facture sans ligne de ventilation.' }]
  const anomalies: AnomalieVentilation[] = []
  for (const l of lignes) {
    if (!/^[0-9A-Z]{5}$/.test(l.comptePlan)) anomalies.push({ code: 'compte_invalide', message: `Compte « ${l.comptePlan} » : 5 caractères attendus.` })
    if (!Number.isInteger(l.montantTtcCentimes) || l.montantTtcCentimes === 0)
      anomalies.push({ code: 'montant_invalide', message: 'Ligne sans montant (centimes entiers non nuls attendus).' })
    if (!estPourcentage(l.recupLocatairePct))
      anomalies.push({ code: 'recuperable_invalide', message: `Part récupérable de ${l.recupLocatairePct} % : entre 0 et 100 attendue.` })
    if (!basesHonorairesValides(l))
      anomalies.push({
        code: 'honoraires_invalide',
        message: `Honoraires : base de ${l.baseHonorairesCentimes} centimes (entier positif ou nul attendu), taux de ${l.tauxHonorairesPct} % (entre 0 et 100 attendu).`,
      })
  }
  const somme = lignes.reduce((s, l) => s + l.montantTtcCentimes, 0)
  if (somme !== totalTtcCentimes)
    anomalies.push({ code: 'ecart_total', message: `Lignes ventilées : ${somme} centimes pour une facture de ${totalTtcCentimes} centimes.` })
  return anomalies
}

/** Total récupérable sur les locataires (arrondi au centime par ligne). */
export const partRecuperable = (lignes: LigneFacture[]): number =>
  lignes.reduce((s, l) => s + Math.round((l.montantTtcCentimes * l.recupLocatairePct) / 100), 0)

/** Lien du mouvement selon le rattachement de la ligne de facture. */
const LIEN_PAR_RATTACHEMENT = {
  travaux: 'travauxId',
  contentieux: 'contentieuxId',
  sinistre: 'sinistreId',
} as const satisfies Record<NonNullable<LigneFacture['rattachement']>['type'], keyof LiensMouvement>

/** Liens d'une ligne de charge : fournisseur, lot, rattachement ; undefined si aucun. */
function liensLigne(l: LigneFacture, fournisseurId: string | null): LiensMouvement | undefined {
  const liens: LiensMouvement = {
    ...(fournisseurId ? { fournisseurId } : {}),
    ...(l.lotId ? { lotId: l.lotId } : {}),
    ...(l.rattachement ? { [LIEN_PAR_RATTACHEMENT[l.rattachement.type]]: l.rattachement.id } : {}),
  }
  return Object.keys(liens).length > 0 ? liens : undefined
}

/**
 * Écriture « Saisie de factures » : un débit par ligne, un crédit au compte fournisseur ; refusée si mal ventilée. Chaque
 * ligne de charge porte ses attributs (clé, analytique, rubrique, code fiscal, part récupérable, base et taux
 * d'honoraires, « à répartir ») et ses liens (fournisseur, lot, travaux, contentieux, sinistre) ; le crédit porte le
 * fournisseur. Une ligne sans lien n'a pas de clé `liens`.
 */
export function ecritureFactureVentilee({
  id,
  date,
  segmentSyndicat,
  auxiliaireFournisseur,
  fournisseurId = null,
  totalTtcCentimes,
  lignes,
}: {
  id: string
  date: string
  segmentSyndicat: string
  auxiliaireFournisseur: string
  /** Fournisseur (prestataire) de la facture, porté en lien sur chaque mouvement ; absent : aucun lien. */
  fournisseurId?: string | null
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
      ...lignes.map((l) => {
        const liens = liensLigne(l, fournisseurId)
        return {
          compte: `${segmentSyndicat}.${l.comptePlan}.${l.rattachement?.type === 'travaux' ? l.rattachement.id : '00000'}.0`,
          sens: 'debit' as const,
          montantCentimes: l.montantTtcCentimes,
          attributs: {
            cle: l.cleRepartition,
            analytique: l.analytique,
            rubrique: l.rubrique,
            codeFiscal: l.codeFiscal,
            recupLocatairePct: l.recupLocatairePct,
            baseHonorairesCentimes: l.baseHonorairesCentimes ?? null,
            tauxHonorairesPct: l.tauxHonorairesPct ?? null,
            etatRepartition: 'a_repartir' as const,
          },
          ...(liens ? { liens } : {}),
        }
      }),
      {
        compte: `${segmentSyndicat}.40100.${auxiliaireFournisseur}.0`,
        sens: 'credit' as const,
        montantCentimes: totalTtcCentimes,
        ...(fournisseurId ? { liens: { fournisseurId } } : {}),
      },
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
