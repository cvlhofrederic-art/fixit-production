import type { FacturationContrat } from '@/lib/administrateur-judiciaire/domain/contrats-facturation'
import { ajouterJours, ajouterMois, dateIsoVersFr, decomposerDateIso, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { contratMarqueAResilier, type ElementAFaire } from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import type { StatutContrat, TypeContrat } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Marque « À résilier » d'un contrat (point 34 du bilan 2). Fonctions pures, dates ISO, sans écran ni table. S'appuie
 * sur suivi-a-faire.ts : nature « a_resilier », ContratSuivi.aResilier et contratMarqueAResilier, le prédicat partagé qui
 * retire la limite générique d'un contrat marqué (un réglage qui suit la limite générique suit aussi « à résilier »).
 *
 * Gestéam — 🟢 tranche 33 : fiche contrat, Reconduction (Préavis, Limite, Tacite, Suivante), case « À résilier », bouton
 * Résilier + date (sens exact non observé : VitFix y lit la date d'envoi de la résiliation).
 *
 * Le droit — 🟢 relu sur Légifrance le 29/10/2026 :
 * - C. consom. art. L. 215-1 (contrats de prestation de services reconductibles) : le prestataire informe par écrit
 *   (lettre nominative ou courrier électronique dédiés), « au plus tôt trois mois et au plus tard un mois avant le terme
 *   de la période autorisant le rejet de la reconduction », de la date limite de non-reconduction ; à défaut, le client
 *   « peut mettre gratuitement un terme au contrat, à tout moment à compter de la date de reconduction » ; L. 215-2 :
 *   exclut les services d'eau potable et d'assainissement ; L. 215-3 : applicable aux non-professionnels ; L. 215-5 : les
 *   assurances relèvent du code des assurances ;
 * - C. assur. art. L. 113-12 : durée fixée par la police ; al. 2 : l'assuré peut résilier à l'expiration d'un délai d'un
 *   an, par notification au moins deux mois avant l'échéance ; al. 5 : dérogation possible pour les risques autres que
 *   ceux des particuliers ; L. 113-15 al. 2 : « la durée de la tacite reconduction ne peut en aucun cas être supérieure à
 *   une année » (d'ordre public, L. 111-2) ;
 * - C. civ. art. 1211 (contrat à durée indéterminée : résiliation avec le préavis du contrat ou un délai raisonnable),
 *   1212 (contrat à durée déterminée exécuté jusqu'à son terme), 1214 et 1215 (exécution poursuivie après le terme :
 *   tacite reconduction en contrat à durée indéterminée).
 * 🟢 Jurisprudence : le syndicat des copropriétaires est un non-professionnel (Cass. 3e civ., 10 oct. 2024, n° 23-13.870) ;
 * sous l'ancien art. L. 136-1, il bénéficiait de l'information sur la reconduction, même représenté par un syndic
 * professionnel (Cass. 1re civ., 25 nov. 2015, n° 14-20.760, publié). Cass. com., 24 sept. 2025, n° 24-13.898, dit
 * l'information due au seul consommateur, pour une société commerciale, sans examiner L. 215-3.
 * 🔵 Déduit : application de L. 215-1 au syndicat par L. 215-3 (aucun arrêt sur la numérotation actuelle) — d'où
 * `aConfirmer` sur toute alerte qui s'en sert ; L. 215-1 réservé aux types de prestation de services (Prestation,
 * Maintenance, États des lieux et diagnostics, Autres abonnements ; type absent : appliqué sous réserve) ; date limite
 * = terme − préavis du contrat ; pour une assurance, limite légale deux mois avant l'échéance (le préavis de la police
 * avance seulement le rappel), échéances annuelles jusqu'au terme fixé par la police puis reconductions d'un an au plus ;
 * une résiliation envoyée après la limite vaut pour le premier terme dont la limite n'était pas passée ; contrat
 * poursuivi après son terme : résiliation au terme du préavis du contrat ; anticipation de l'alerte (30 jours par défaut) :
 * règle de gestion.
 * 🔴 Non établi : résiliation de l'assurance dommages-ouvrage (annexe II à l'art. A. 243-1 : garantie précisée aux
 * conditions particulières, prenant fin dix ans après la réception : pas d'échéance annuelle à attendre, à vérifier sur la
 * police) ; contrat d'eau ou d'assainissement (exclu de L. 215-1 par L. 215-2) non identifiable par son type.
 */

export interface ContratAResilier {
  id: string
  mandatId: string
  libelle: string
  /** Absent : en cours (comme contrats.ts). */
  statut?: StatutContrat
  type?: TypeContrat
  /** Case « À résilier » de Gestéam. */
  aResilier?: boolean
  /** Envoi de la résiliation ; null : pas encore résilié. */
  resiliationNotifieeLe?: string | null
  /** Informations écrites reçues du prestataire sur la date limite (C. consom. L. 215-1) ; null ou absent : non renseigné. */
  informationsRecues?: string[] | null
  facturation?: FacturationContrat
}

export const ETATS_A_RESILIER = [
  'avant_limite',
  'limite_depassee',
  'resiliable_a_tout_moment',
  'resiliation_envoyee',
  'resiliation_par_faculte',
  'resiliation_tardive',
  'fin_au_terme',
  'terme_depasse',
  'non_resiliable',
  'dates_a_completer',
] as const
export type EtatAResilier = (typeof ETATS_A_RESILIER)[number]

export interface AlerteAResilier {
  contratId: string
  mandatId: string
  libelle: string
  etat: EtatAResilier
  /** Date à laquelle agir (date de l'élément de suivi). */
  aAgirLe: string
  dateLimite: string | null
  terme: string | null
  /** Limite atteignable suivante, une fois la limite en cours dépassée. */
  prochaineLimite: string | null
  /** Repose sur une règle à confirmer (🔵) : à afficher comme telle. */
  aConfirmer: boolean
  fondement: string | null
  message: string
}

type Regime = 'prestation' | 'assurance' | 'autre'

const TYPES_PRESTATION: ReadonlySet<string> = new Set(['Prestation', 'Maintenance', 'Etat des lieux, diagnostic', 'Autres abonnements'])
const TYPES_ASSURANCE: ReadonlySet<string> = new Set(['Assurance', 'Assurance loyer impayé', 'Garantie vacance locative'])
const PREAVIS_LEGAL_ASSURANCE_MOIS = 2
const RECONDUCTION_MAX_ASSURANCE_MOIS = 12
const FONDEMENT_L215 = 'C. consom. art. L. 215-1, L. 215-3'
const FONDEMENT_ASSURANCE = 'C. assur. art. L. 113-12, L. 113-15'

/** Régime d'un type de contrat ; un type absent est traité comme une prestation de services, sous réserve. */
const regimeDe = (type: TypeContrat | undefined): Regime => {
  if (type === undefined || TYPES_PRESTATION.has(type)) return 'prestation'
  return TYPES_ASSURANCE.has(type) ? 'assurance' : 'autre'
}

function verifierDate(date: string, libelle: string): void {
  if (!estDateIsoValide(date)) throw new Error(`${libelle} invalide (${date}) : AAAA-MM-JJ attendu.`)
}

function verifierFacturation(f: FacturationContrat): void {
  if (!estDateIsoValide(f.dateEffet)) throw new Error(`Date d'effet invalide (${f.dateEffet}) : AAAA-MM-JJ attendu.`)
  if (!Number.isInteger(f.dureeMois) || f.dureeMois < 1) throw new Error(`Durée invalide (${f.dureeMois} mois).`)
}

const fr = dateIsoVersFr

/** Calendrier des termes d'un contrat et règles qui s'y appliquent. */
interface Calendrier {
  f: FacturationContrat
  regime: Regime
  /** Terme fixé par le contrat : date d'effet + durée. */
  termeInitial: string
  /** Assurance : nombre d'échéances annuelles avant le terme initial ; 0 sinon. */
  anniversaires: number
  /** Écart entre deux termes après le terme initial (assurance : un an au plus). */
  periodeMois: number
  /** Préavis du contrat (assurance : deux mois au moins, par prudence). */
  preavisMois: number
  /** Préavis du rappel (assurance : celui de la police s'il est plus long). */
  preavisRappelMois: number
  /** Informations du prestataire, seulement pour une prestation de services ; null : non renseignées ou sans objet. */
  informations: string[] | null
  /** Réserves à ajouter aux messages (règle d'assurance ou type à confirmer) ; vide sinon. */
  reserve: string
}

function calendrier(c: ContratAResilier, f: FacturationContrat): Calendrier {
  verifierFacturation(f)
  const regime = regimeDe(c.type)
  const assurance = regime === 'assurance'
  const termeInitial = ajouterMois(f.dateEffet, f.dureeMois)
  let anniversaires = 0
  while (assurance && ajouterMois(f.dateEffet, 12 * (anniversaires + 1)) < termeInitial) anniversaires += 1
  const preavisPolice = Math.max(0, f.preavisMois)
  const reserves = [
    assurance && preavisPolice < PREAVIS_LEGAL_ASSURANCE_MOIS
      ? ` La police prévoit un préavis de ${preavisPolice} mois : calcul prudent à deux mois (L. 113-12), à vérifier.`
      : '',
    assurance && preavisPolice > PREAVIS_LEGAL_ASSURANCE_MOIS
      ? ` La police prévoit ${preavisPolice} mois : la loi permet de dénoncer jusqu'à deux mois avant l'échéance annuelle, sauf dérogation de la police pour un risque autre que celui d'un particulier (à vérifier).`
      : '',
    assurance && f.dureeMois > RECONDUCTION_MAX_ASSURANCE_MOIS
      ? ` Durée de ${f.dureeMois} mois : échéances annuelles retenues (L. 113-12), sauf dérogation de la police (à vérifier).`
      : '',
    c.type === undefined ? ' Type du contrat à renseigner : règles des prestations de services appliquées sous réserve.' : '',
  ]
  return {
    f,
    regime,
    termeInitial,
    anniversaires,
    periodeMois: assurance ? Math.min(f.dureeMois, RECONDUCTION_MAX_ASSURANCE_MOIS) : f.dureeMois,
    preavisMois: assurance ? Math.max(preavisPolice, PREAVIS_LEGAL_ASSURANCE_MOIS) : preavisPolice,
    preavisRappelMois: assurance ? Math.max(preavisPolice, PREAVIS_LEGAL_ASSURANCE_MOIS) : preavisPolice,
    informations: regime === 'prestation' ? (c.informationsRecues ?? null) : null,
    reserve: reserves.join(''),
  }
}

/** Terme n° k (k ≥ 1), au même quantième que la date d'effet ou le terme initial. */
function termeNumero(cal: Calendrier, k: number): string {
  if (k <= cal.anniversaires) return ajouterMois(cal.f.dateEffet, 12 * k)
  if (cal.anniversaires > 0 || cal.regime === 'assurance') return ajouterMois(cal.termeInitial, cal.periodeMois * (k - cal.anniversaires - 1))
  return ajouterMois(cal.f.dateEffet, cal.periodeMois * k)
}

/** Le terme tombe-t-il à l'expiration d'une année depuis la date d'effet (date d'effet + 12 n) ? */
function estAnniversaire(cal: Calendrier, terme: string): boolean {
  const debut = decomposerDateIso(cal.f.dateEffet)
  const fin = decomposerDateIso(terme)
  const mois = (fin.a - debut.a) * 12 + (fin.m - debut.m)
  return mois > 0 && mois % 12 === 0 && ajouterMois(cal.f.dateEffet, mois) === terme
}

/**
 * Préavis qui fixe la limite d'un terme : celui du contrat ; pour une assurance, deux mois aux échéances annuelles
 * (L. 113-12 al. 2), le préavis de la police (deux mois au moins) aux autres échéances (al. 1).
 */
const preavisPour = (cal: Calendrier, terme: string): number =>
  cal.regime === 'assurance' && estAnniversaire(cal, terme) ? PREAVIS_LEGAL_ASSURANCE_MOIS : cal.preavisMois

const limiteDe = (cal: Calendrier, terme: string): string => ajouterMois(terme, -preavisPour(cal, terme))
const limiteRappelDe = (cal: Calendrier, terme: string): string => ajouterMois(terme, -cal.preavisRappelMois)

/** Dernier terme passé à une date (null pendant la période initiale) et terme suivant. */
function termesA(cal: Calendrier, date: string): { dernier: string | null; suivant: string } {
  let k = 1
  let dernier: string | null = null
  while (termeNumero(cal, k) <= date) {
    dernier = termeNumero(cal, k)
    k += 1
  }
  return { dernier, suivant: termeNumero(cal, k) }
}

/** Premier terme à venir dont la limite n'est pas encore passée à la date. */
function termeAtteignable(cal: Calendrier, date: string): string {
  let k = 1
  while (termeNumero(cal, k) <= date || limiteDe(cal, termeNumero(cal, k)) < date) k += 1
  return termeNumero(cal, k)
}

/** Information conforme pour une date limite : reçue entre trois mois et un mois avant elle (L. 215-1). */
const informationConforme = (informations: string[], limite: string): boolean =>
  informations.some((d) => ajouterMois(limite, -3) <= d && d <= ajouterMois(limite, -1))

/** Faculté de L. 215-1 ouverte à une date : contrat déjà reconduit, sans information conforme pour cette reconduction. */
function faculteOuverte(cal: Calendrier, date: string): boolean {
  if (cal.informations === null) return false
  const { dernier } = termesA(cal, date)
  return dernier !== null && !informationConforme(cal.informations, limiteDe(cal, dernier))
}

/** Reconduction à venir faite sans information conforme : la faculté s'ouvrira à ce terme. */
const faculteAVenir = (cal: Calendrier, limite: string): boolean => cal.informations !== null && !informationConforme(cal.informations, limite)

const fondementDe = (cal: Calendrier): string | null => (cal.regime === 'assurance' ? FONDEMENT_ASSURANCE : null)

type Base = Pick<AlerteAResilier, 'contratId' | 'mandatId' | 'libelle'>

function alerteResiliationEnvoyee(base: Base, cal: Calendrier, envoi: string, aujourdhui: string): AlerteAResilier {
  const { suivant } = termesA(cal, envoi)
  const effet = termeAtteignable(cal, envoi)
  const limite = limiteDe(cal, suivant)
  const commun = { ...base, dateLimite: limite, terme: effet, prochaineLimite: null }
  if (faculteOuverte(cal, envoi))
    return {
      ...commun,
      etat: 'resiliation_par_faculte',
      aAgirLe: aujourdhui,
      aConfirmer: true,
      fondement: FONDEMENT_L215,
      message: `Résiliation envoyée le ${fr(envoi)}, contrat déjà reconduit sans information conforme : valable dès sa réception si la faculté de L. 215-1 s'applique au syndicat (à confirmer) ; sinon effet le ${fr(effet)}.${cal.reserve}`,
    }
  // Préavis au moins égal à la période : la résiliation vaut toujours pour le premier terme atteignable.
  if (effet === suivant || cal.preavisMois >= cal.periodeMois)
    return {
      ...commun,
      dateLimite: limiteDe(cal, effet),
      etat: 'resiliation_envoyee',
      aAgirLe: effet < aujourdhui ? aujourdhui : effet,
      aConfirmer: cal.reserve !== '',
      fondement: fondementDe(cal),
      message: `Résiliation envoyée le ${fr(envoi)}, avant la limite : le contrat prend fin le ${fr(effet)} ; mettre son statut à jour.${cal.reserve}`,
    }
  if (faculteAVenir(cal, limite))
    return {
      ...commun,
      etat: 'resiliation_tardive',
      aAgirLe: suivant,
      aConfirmer: true,
      fondement: FONDEMENT_L215,
      message: `Résiliation envoyée le ${fr(envoi)}, après la limite du ${fr(limite)} : effet le ${fr(effet)} ; sans information conforme du prestataire, résiliation gratuite possible dès la reconduction du ${fr(suivant)} (à confirmer) : la renouveler à cette date.${cal.reserve}`,
    }
  return {
    ...commun,
    etat: 'resiliation_tardive',
    aAgirLe: aujourdhui,
    aConfirmer: cal.reserve !== '',
    fondement: fondementDe(cal),
    message: `Résiliation envoyée le ${fr(envoi)}, après la limite du ${fr(limite)} : effet au terme suivant, le ${fr(effet)}, sauf accord du cocontractant.${cal.reserve}`,
  }
}

const NON_RENSEIGNEE = ' Information du prestataire non renseignée (C. consom. L. 215-1).'

function alerteAvantLimite(base: Base, cal: Calendrier, terme: string, anticipationJours: number, suffixe: string): AlerteAResilier {
  const limite = limiteDe(cal, terme)
  return {
    ...base,
    etat: 'avant_limite',
    aAgirLe: ajouterJours(limiteRappelDe(cal, terme), -anticipationJours),
    dateLimite: limite,
    terme,
    prochaineLimite: null,
    aConfirmer: cal.reserve !== '',
    fondement: fondementDe(cal),
    message: `Dénoncer au plus tard le ${fr(limite)} (préavis de ${preavisPour(cal, terme)} mois avant le terme du ${fr(terme)}).${suffixe}`,
  }
}

function alerteReconduction(base: Base, cal: Calendrier, aujourdhui: string, anticipationJours: number): AlerteAResilier {
  const { suivant: terme } = termesA(cal, aujourdhui)
  const limite = limiteDe(cal, terme)
  const nonRenseignee = cal.regime === 'prestation' && cal.informations === null ? NON_RENSEIGNEE : ''
  const suffixe = cal.reserve + nonRenseignee
  if (faculteOuverte(cal, aujourdhui))
    return {
      ...base,
      etat: 'resiliable_a_tout_moment',
      aAgirLe: aujourdhui,
      dateLimite: limite,
      terme,
      prochaineLimite: null,
      aConfirmer: true,
      fondement: FONDEMENT_L215,
      message: `Contrat reconduit sans information conforme du prestataire : résiliation gratuite possible à tout moment, sans attendre le ${fr(limite)} (à confirmer pour un syndicat).${cal.reserve}`,
    }
  const atteignable = termeAtteignable(cal, aujourdhui)
  // Préavis au moins égal à la période : une limite est toujours passée ; seule compte la prochaine atteignable.
  if (aujourdhui <= limite || cal.preavisMois >= cal.periodeMois) return alerteAvantLimite(base, cal, atteignable, anticipationJours, suffixe)
  const prochaineLimite = limiteDe(cal, atteignable)
  if (faculteAVenir(cal, limite))
    return {
      ...base,
      etat: 'limite_depassee',
      aAgirLe: terme,
      dateLimite: limite,
      terme,
      prochaineLimite,
      aConfirmer: true,
      fondement: FONDEMENT_L215,
      message: `Limite du ${fr(limite)} dépassée, sans information conforme du prestataire : résiliation gratuite possible à tout moment dès la reconduction du ${fr(terme)} (à confirmer pour un syndicat) ; sinon prochaine limite le ${fr(prochaineLimite)}.${cal.reserve}`,
    }
  return {
    ...base,
    etat: 'limite_depassee',
    aAgirLe: ajouterJours(limiteRappelDe(cal, atteignable), -anticipationJours),
    dateLimite: limite,
    terme,
    prochaineLimite,
    aConfirmer: cal.reserve !== '',
    fondement: fondementDe(cal),
    message: `Limite du ${fr(limite)} dépassée : reconduction au ${fr(terme)} ; prochaine limite le ${fr(prochaineLimite)}.${suffixe}`,
  }
}

/** Contrat poursuivi après son terme (durée indéterminée), résilié après lui : effet au terme du préavis (C. civ. 1211). */
function alerteApresTerme(base: Base, cal: Calendrier, envoi: string, aujourdhui: string): AlerteAResilier {
  const effet = cal.preavisMois > 0 ? ajouterMois(envoi, cal.preavisMois) : null
  const finDuPreavis = effet ? `effet le ${fr(effet)} (préavis du contrat)` : 'effet après un délai raisonnable, à apprécier (aucun préavis au contrat)'
  return {
    ...base,
    dateLimite: null,
    prochaineLimite: null,
    terme: effet,
    etat: 'resiliation_envoyee',
    aAgirLe: effet !== null && effet > aujourdhui ? effet : aujourdhui,
    aConfirmer: true,
    fondement: 'C. civ. art. 1211',
    message: `Contrat poursuivi après son terme du ${fr(cal.termeInitial)} : résiliation envoyée le ${fr(envoi)}, ${finDuPreavis} ; mettre son statut à jour à cette date.`,
  }
}

/**
 * Contrat sans reconduction tacite : fin au terme ; terme dépassé avec exécution poursuivie : durée indéterminée
 * (C. civ.) ou reconduction d'un an au plus (assurance, L. 113-15) ; résiliation envoyée : effet au terme du préavis.
 */
function alerteSansReconduction(base: Base, cal: Calendrier, aujourdhui: string, envoi: string | null): AlerteAResilier {
  const terme = cal.termeInitial
  const commun = { ...base, dateLimite: null, terme, prochaineLimite: null }
  const assurance = cal.regime === 'assurance'
  if (terme >= aujourdhui)
    return {
      ...commun,
      etat: 'fin_au_terme',
      aAgirLe: terme,
      aConfirmer: false,
      fondement: 'C. civ. art. 1212',
      message: `Contrat sans reconduction tacite : il prend fin le ${fr(terme)} ; mettre son statut à jour à cette date.`,
    }
  if (envoi && envoi <= terme)
    return {
      ...commun,
      etat: 'resiliation_envoyee',
      aAgirLe: aujourdhui,
      aConfirmer: false,
      fondement: 'C. civ. art. 1212',
      message: `Résiliation envoyée le ${fr(envoi)}, avant le terme : le contrat a pris fin le ${fr(terme)} ; mettre son statut à jour.`,
    }
  if (envoi && !assurance) return alerteApresTerme(base, cal, envoi, aujourdhui)
  return {
    ...commun,
    etat: 'terme_depasse',
    aAgirLe: aujourdhui,
    aConfirmer: true,
    fondement: assurance ? 'C. assur. art. L. 113-15' : 'C. civ. art. 1211, 1214, 1215',
    message: assurance
      ? `Police sans reconduction tacite, terme du ${fr(terme)} dépassé : si elle se poursuit, elle ne peut être reconduite que pour un an au plus ; vérifier la police, sinon mettre son statut à jour.`
      : `Contrat sans reconduction tacite, terme du ${fr(terme)} dépassé : s'il a continué d'être exécuté, il est reconduit pour une durée indéterminée ; le résilier avec le préavis du contrat ou un délai raisonnable, sinon mettre son statut à jour.`,
  }
}

function verifierDatesContrat(c: ContratAResilier): void {
  if (c.resiliationNotifieeLe) verifierDate(c.resiliationNotifieeLe, `Date de résiliation du contrat ${c.id}`)
  for (const d of c.informationsRecues ?? []) verifierDate(d, `Information du prestataire (contrat ${c.id})`)
}

/** Une assurance sans reconduction tacite garde ses échéances annuelles jusqu'au terme de la police (L. 113-12, d'ordre public). */
const echeanceAnnuelleAvantTerme = (cal: Calendrier, date: string): boolean =>
  cal.regime === 'assurance' && date < cal.termeInitial && termeAtteignable(cal, date) < cal.termeInitial

function alerteContrat(c: ContratAResilier, aujourdhui: string, anticipationJours: number): AlerteAResilier {
  const base: Base = { contratId: c.id, mandatId: c.mandatId, libelle: c.libelle }
  const vide = { dateLimite: null, terme: null, prochaineLimite: null }
  if (c.type === 'Dommages Ouvrages')
    return {
      ...base,
      ...vide,
      etat: 'non_resiliable',
      aAgirLe: aujourdhui,
      aConfirmer: true,
      fondement: 'C. assur. annexe II à l’art. A. 243-1 (point de départ et durée de la garantie)',
      message:
        "Assurance dommages-ouvrage : garantie précisée aux conditions particulières, prenant fin dix ans après la réception, à effet au plus tôt à la fin de la garantie de parfait achèvement (sauf défaillance de l'entrepreneur) ; pas d'échéance annuelle à attendre a priori : vérifier la police avant toute résiliation.",
    }
  const f = c.facturation
  if (!f)
    return { ...base, ...vide, etat: 'dates_a_completer', aAgirLe: aujourdhui, aConfirmer: false, fondement: null, message: "Dates du contrat à compléter (date d'effet, durée, préavis) pour calculer la limite de résiliation." }
  const cal = calendrier(c, f)
  const envoi = c.resiliationNotifieeLe ?? null
  if (!f.tacite && !echeanceAnnuelleAvantTerme(cal, envoi ?? aujourdhui)) return alerteSansReconduction(base, cal, aujourdhui, envoi)
  return envoi ? alerteResiliationEnvoyee(base, cal, envoi, aujourdhui) : alerteReconduction(base, cal, aujourdhui, anticipationJours)
}

/** Alertes des contrats marqués « à résilier » : en cours, hors contrat de travail (un licenciement, pas une résiliation). */
export function alertesAResilier(
  contrats: ContratAResilier[],
  aujourdhui: string,
  { anticipationJours = 30 }: { anticipationJours?: number } = {},
): AlerteAResilier[] {
  verifierDate(aujourdhui, 'Date du jour')
  return contrats.filter(contratMarqueAResilier).map((c) => {
    verifierDatesContrat(c)
    return alerteContrat(c, aujourdhui, anticipationJours)
  })
}

/** Éléments du suivi « à faire » : famille contrats, nature « à résilier » (réglable à part de la limite générique). */
export const elementsSuiviAResilier = (alertes: AlerteAResilier[]): ElementAFaire[] =>
  alertes.map((a) => ({
    id: `contrats:${a.contratId}:a_resilier`,
    famille: 'contrats',
    nature: 'a_resilier',
    libelle: `À résilier — ${a.libelle} : ${a.message}`,
    date: a.aAgirLe,
    mandatId: a.mandatId,
    objetId: a.contratId,
    assigneId: null,
    aConfirmer: a.aConfirmer,
  }))

/**
 * Éléments de suivi des contrats marqués « à résilier », substitués à la limite générique de depuisContrats, quel que
 * soit l'horizon de chacun (utile quand les contrats passés à depuisContrats ne portent pas `aResilier`) ; les autres
 * éléments sont gardés tels quels.
 */
export function fusionnerSuiviAResilier(alertes: AlerteAResilier[], elements: ElementAFaire[]): ElementAFaire[] {
  const generiques = new Set(alertes.map((a) => `contrats:${a.contratId}:limite_resiliation`))
  return [...elementsSuiviAResilier(alertes), ...elements.filter((e) => !generiques.has(e.id))]
}
