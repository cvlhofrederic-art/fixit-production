import { ajouterJours, ecartJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  creerTraitement,
  estPourcentage,
  type LiensMouvement,
  type LigneMouvement,
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
 *
 * Point 32 du bilan — avancement et retenue de garantie de la facture (Gestéam, tranche 36, en-tête de la fiche facture :
 * « Travaux (opération) ; Avancement %, Retenue de garantie € » ; tranche 32 : garantie par marché). Le suivi par marché,
 * la libération et la part déductible sont dans travaux-retenue-garantie.ts.
 * 🟢 Lu sur Légifrance le 04/11/2026 (versions en vigueur au 03/11/2026) :
 * - loi n° 71-584 du 16 juillet 1971, art. 1er, al. 1 : les paiements des acomptes des marchés de travaux privés
 *   « peuvent être amputés d'une retenue égale au plus à 5 p. 100 de leur montant » ;
 * - arrêté du 14 mars 2005, art. 10 : « Le compte 401 est crédité du montant des factures, mémoires, situations, parvenus
 *   avant la clôture de l'exercice, par le débit des comptes de charges concernés » ; art. 7 : 47 « Compte d'attente » :
 *   471 « Compte en attente d'imputation débiteur », 472 « Compte en attente d'imputation créditeur » ; aucun compte de
 *   retenue de garantie dans la nomenclature.
 * 🔵 Déduit : la facture crédite le 401 de son montant entier (art. 10), puis la retenue passe du 401 au 47200 (472,
 * créditeur : somme due au fournisseur, retenue en attente de sa libération), au même auxiliaire que le fournisseur, avec
 * les liens fournisseur et travaux ; le reste dû est net des acomptes et de la retenue ; le plafond de 5 % se compare au
 * TTC de la facture (le syndicat, non assujetti, enregistre TTC : arrêté, art. 3), le plafond arrondi au centime
 * inférieur et la retenue au taux du marché au centime le plus proche, le demi-centime au-dessus, bornée au plafond
 * (retenueAuTaux, en calcul entier exact : taux en centièmes de point ; à 5 %, l'arrondi ne dépasse jamais le plafond,
 * même quand le vingtième du TTC tombe à un demi-centime ou plus) ; taux et avancement ont deux décimales au plus (le
 * calcul entier l'exige) ; une retenue garantit les travaux d'une opération dont relève au moins une ligne de la facture
 * (rattachement « travaux » au même n°) ; l'avancement est un pourcentage (0 à 100), contrôlé par marché dans
 * travaux-retenue-garantie.ts.
 * 🔴 Non établi (question pour Frédéric ou Hugo) : « Gestéam porte-t-il la retenue de garantie sur un compte d'attente
 * (472xx, ou le 47150 "Compte d'attente_"), sur une subdivision du 401 (arrêté, art. 8), ou la laisse-t-il au 401 du
 * fournisseur ? » (VitFix : 47200, au compte du fournisseur).
 */

/** Plafond légal de la retenue de garantie, en % du paiement (loi n° 71-584 du 16 juillet 1971, art. 1er, al. 1). */
export const TAUX_MAXIMAL_RETENUE_GARANTIE_PCT = 5

/** Compte d'attente qui reçoit la retenue (arrêté du 14 mars 2005, art. 7 : compte 472). */
export const COMPTE_ATTENTE_RETENUE_GARANTIE = { planCode: '47200', intitule: "Compte en attente d'imputation créditeur" } as const

/** Retenue de garantie de la facture (Gestéam « Retenue de garantie € », fiche facture). */
export interface RetenueGarantieFacture {
  montantCentimes: number
  /** N° de l'opération de travaux (5 caractères) dont le marché est garanti. */
  travauxId: string
  /** Marché garanti (travaux-retenue-garantie.ts) ; absent : non rattaché à un marché. */
  marcheId?: string | null
}

/** En-tête « travaux » de la facture : Avancement % et Retenue de garantie € (Gestéam, tranche 36). */
export interface EnTeteFactureTravaux {
  /** Avancement cumulé du marché déclaré par la facture (situation de travaux), en %. */
  avancementPct?: number | null
  retenueGarantie?: RetenueGarantieFacture | null
}

/** Plafond de la retenue d'un paiement : 5 % du TTC, au centime inférieur (art. 1er, al. 1 : « au plus »). */
export const plafondRetenueGarantie = (totalTtcCentimes: number): number => Math.floor((totalTtcCentimes * TAUX_MAXIMAL_RETENUE_GARANTIE_PCT) / 100)

/** Écart admis entre un pourcentage et son centième de point : le bruit du calcul flottant (4,1 × 100 = 409,999…). */
const BRUIT_CENTIEME = 1e-9

/** Pourcentage à deux décimales au plus (taux de retenue, avancement) : condition du calcul entier en centièmes de point. */
export const estAuCentieme = (pourcentage: number): boolean =>
  Number.isFinite(pourcentage) && Math.abs(pourcentage * 100 - Math.round(pourcentage * 100)) < BRUIT_CENTIEME

/**
 * Retenue au taux stipulé, au centime le plus proche (le demi-centime au-dessus), bornée au plafond, en calcul entier
 * exact : taux en centièmes de point, deux décimales au plus (à 5 %, l'arrondi ne dépasse jamais le plafond).
 */
export function retenueAuTaux(totalTtcCentimes: number, tauxPct: number): number {
  if (!estAuCentieme(tauxPct)) throw new Error(`Taux de retenue de ${tauxPct} % : deux décimales au plus.`)
  const centiemes = Math.round(tauxPct * 100)
  return Math.min(Math.floor((totalTtcCentimes * centiemes + 5_000) / 10_000), plafondRetenueGarantie(totalTtcCentimes))
}

/** Facturé au-delà de l'avancement déclaré (montant × avancement), en calcul entier exact (avancement au centième). */
export const factureAuDelaDeLAvancement = (factureCentimes: number, montantCentimes: number, avancementPct: number): boolean =>
  factureCentimes * 10_000 > montantCentimes * Math.round(avancementPct * 100)

/** Retenue au-delà de 5 % du TTC de la facture (art. 1er, al. 1), en calcul entier exact. */
export const retenueAuDelaDuPlafond = (totalTtcCentimes: number, retenueCentimes: number): boolean =>
  retenueCentimes * 100 > totalTtcCentimes * TAUX_MAXIMAL_RETENUE_GARANTIE_PCT

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
  /** Marque « Non déductible » reprise de la fiche analytique (point 28) ; absente : non reportée sur le mouvement. */
  nonDeductible?: boolean
  /** Contrat au titre duquel la facture est reçue (lien du mouvement, T43 § 7) ; absent : aucun lien. */
  contratId?: string | null
}

export interface AnomalieVentilation {
  code:
    | 'sans_ligne'
    | 'ecart_total'
    | 'compte_invalide'
    | 'montant_invalide'
    | 'recuperable_invalide'
    | 'honoraires_invalide'
    | 'avancement_invalide'
    | 'retenue_invalide'
    | 'retenue_plafond'
    | 'retenue_sans_travaux'
  message: string
}

/** Retenue : centimes entiers positifs ou nuls, au plus le TTC, n° d'opération de 5 caractères. */
function anomalieRetenue(totalTtcCentimes: number, { montantCentimes, travauxId }: RetenueGarantieFacture): AnomalieVentilation | null {
  if (!Number.isInteger(montantCentimes) || montantCentimes < 0 || montantCentimes > totalTtcCentimes)
    return { code: 'retenue_invalide', message: `Retenue de garantie de ${montantCentimes} centimes : entier positif ou nul, au plus le TTC de la facture.` }
  if (!/^[0-9A-Z]{5}$/.test(travauxId))
    return { code: 'retenue_invalide', message: `Retenue de garantie sans opération de travaux (n° « ${travauxId} », 5 caractères attendus).` }
  if (retenueAuDelaDuPlafond(totalTtcCentimes, montantCentimes))
    return {
      code: 'retenue_plafond',
      message: `Retenue de garantie de ${montantCentimes} centimes sur ${totalTtcCentimes} : ${TAUX_MAXIMAL_RETENUE_GARANTIE_PCT} % au plus du paiement (loi n° 71-584 du 16 juillet 1971, art. 1er).`,
    }
  return null
}

/** Retenue d'une opération dont relève au moins une ligne de la facture (rattachement « travaux » au même n°). */
function anomalieRattachementRetenue(lignes: readonly LigneFacture[], { montantCentimes, travauxId }: RetenueGarantieFacture): AnomalieVentilation | null {
  if (montantCentimes === 0 || lignes.some((l) => l.rattachement?.type === 'travaux' && l.rattachement.id === travauxId)) return null
  return {
    code: 'retenue_sans_travaux',
    message: `Retenue de garantie sur l'opération ${travauxId} : aucune ligne de la facture n'est rattachée à cette opération de travaux.`,
  }
}

/**
 * Contrôle de l'en-tête « travaux » de la facture : avancement entre 0 et 100 % (deux décimales au plus), retenue au plus 5 % du TTC ; lignes
 * données : au moins une ligne rattachée à l'opération de la retenue.
 */
export function controlerEnTeteFactureTravaux(
  totalTtcCentimes: number,
  { avancementPct, retenueGarantie }: EnTeteFactureTravaux,
  lignes: readonly LigneFacture[] | null = null,
): AnomalieVentilation[] {
  const anomalies: AnomalieVentilation[] = []
  if (avancementPct != null && !(estPourcentage(avancementPct) && estAuCentieme(avancementPct)))
    anomalies.push({ code: 'avancement_invalide', message: `Avancement de ${avancementPct} % : entre 0 et 100, deux décimales au plus, attendu.` })
  if (!retenueGarantie) return anomalies
  const retenue = anomalieRetenue(totalTtcCentimes, retenueGarantie) ?? (lignes ? anomalieRattachementRetenue(lignes, retenueGarantie) : null)
  if (retenue) anomalies.push(retenue)
  return anomalies
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

/** Liens d'une ligne de charge : fournisseur, lot, contrat, rattachement ; undefined si aucun. */
function liensLigne(l: LigneFacture, fournisseurId: string | null): LiensMouvement | undefined {
  const liens: LiensMouvement = {
    ...(fournisseurId ? { fournisseurId } : {}),
    ...(l.lotId ? { lotId: l.lotId } : {}),
    ...(l.contratId ? { contratId: l.contratId } : {}),
    ...(l.rattachement ? { [LIEN_PAR_RATTACHEMENT[l.rattachement.type]]: l.rattachement.id } : {}),
  }
  return Object.keys(liens).length > 0 ? liens : undefined
}

/**
 * Retenue de garantie sortie du 401 vers le compte d'attente 47200, au même auxiliaire que le fournisseur, avec les
 * liens fournisseur et travaux ; aucune ligne pour une retenue nulle ou absente.
 */
function mouvementsRetenue(
  retenue: RetenueGarantieFacture | null | undefined,
  { segmentSyndicat, auxiliaireFournisseur, fournisseurId }: { segmentSyndicat: string; auxiliaireFournisseur: string; fournisseurId: string | null },
): LigneMouvement[] {
  if (!retenue || retenue.montantCentimes === 0) return []
  const liens: LiensMouvement = { ...(fournisseurId ? { fournisseurId } : {}), travauxId: retenue.travauxId }
  const montantCentimes = retenue.montantCentimes
  return [
    { compte: `${segmentSyndicat}.40100.${auxiliaireFournisseur}.0`, sens: 'debit', montantCentimes, liens },
    { compte: `${segmentSyndicat}.${COMPTE_ATTENTE_RETENUE_GARANTIE.planCode}.${auxiliaireFournisseur}.0`, sens: 'credit', montantCentimes, liens },
  ]
}

/**
 * Écriture « Saisie de factures » : un débit par ligne, un crédit au compte fournisseur ; refusée si mal ventilée. Chaque
 * ligne de charge porte ses attributs (clé, analytique, rubrique, code fiscal, part récupérable, marque « non
 * déductible » si la ligne la porte, base et taux d'honoraires, « à répartir ») et ses liens (fournisseur, lot, contrat,
 * travaux, contentieux, sinistre) ; le crédit porte le fournisseur. Une ligne sans lien n'a pas de clé `liens`.
 * Point 32 : l'en-tête « travaux » (avancement, retenue de garantie sur une opération dont relève une ligne) est contrôlé ;
 * le 401 est crédité du montant entier de la facture (arrêté du 14 mars 2005, art. 10), puis la retenue passe du 401 au
 * compte d'attente 47200.
 */
export function ecritureFactureVentilee({
  id,
  date,
  segmentSyndicat,
  auxiliaireFournisseur,
  fournisseurId = null,
  totalTtcCentimes,
  lignes,
  avancementPct = null,
  retenueGarantie = null,
}: {
  id: string
  date: string
  segmentSyndicat: string
  auxiliaireFournisseur: string
  /** Fournisseur (prestataire) de la facture, porté en lien sur chaque mouvement ; absent : aucun lien. */
  fournisseurId?: string | null
  totalTtcCentimes: number
  lignes: LigneFacture[]
} & EnTeteFactureTravaux): Traitement {
  const anomalies = [...controlerVentilation(totalTtcCentimes, lignes), ...controlerEnTeteFactureTravaux(totalTtcCentimes, { avancementPct, retenueGarantie }, lignes)]
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
            ...(l.nonDeductible === undefined ? {} : { nonDeductible: l.nonDeductible }),
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
      ...mouvementsRetenue(retenueGarantie, { segmentSyndicat, auxiliaireFournisseur, fournisseurId }),
    ],
  })
}

/**
 * Échéance de règlement (date de facture + N jours), reste dû après acomptes et retenue de garantie (point 32 : la
 * retenue n'est due qu'à sa libération, travaux-retenue-garantie.ts), retard au jour donné.
 */
export function echeanceReglement(
  {
    dateFacture,
    joursEcheance,
    totalTtcCentimes,
    acomptesCentimes,
    retenueGarantieCentimes = 0,
  }: {
    dateFacture: string
    joursEcheance: number
    totalTtcCentimes: number
    acomptesCentimes: number
    /** Retenue de garantie de la facture (Gestéam « Retenue de garantie € ») ; absente : aucune. */
    retenueGarantieCentimes?: number
  },
  aujourdhui: string,
): { echeance: string; resteDuCentimes: number; enRetard: boolean; joursRetard: number } {
  if (!estDateIsoValide(dateFacture)) throw new Error(`Date de facture invalide (${dateFacture}) : AAAA-MM-JJ attendu.`)
  const echeance = ajouterJours(dateFacture, Math.max(0, joursEcheance))
  const resteDuCentimes = Math.max(0, totalTtcCentimes - acomptesCentimes - retenueGarantieCentimes)
  const joursRetard = resteDuCentimes > 0 ? Math.max(0, ecartJours(echeance, aujourdhui)) : 0
  return { echeance, resteDuCentimes, enRetard: joursRetard > 0, joursRetard }
}
