import { citerFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import { refLoi1965 } from '@/lib/administrateur-judiciaire/domain/delais-legaux'

/**
 * Comptes bancaires d'un mandat (décision D-BANQUE du 27/10/2026). Fonctions pures, montants en CENTIMES ENTIERS,
 * sans écran.
 *
 * La décision — la tenue des comptes est un CHOIX DU CABINET, remplaçable MANDAT PAR MANDAT, pour s'adapter au régime
 * qu'il applique comme administrateur judiciaire. VitFix n'impose aucun schéma : il contrôle que les comptes ouverts
 * correspondent au mode retenu.
 *
 * Gestéam — un mandat porte plusieurs sous-comptes 512 (banque, regroupement, avance travaux, fonds travaux,
 * placements, CDC travaux, comptes repris de l'ancien syndic ou de l'ancien AJ) et le cabinet un compte centralisateur
 * `0000.51200…` (tranches 25 et 29). Les comptes en banque et à la Caisse des dépôts coexistent donc.
 *
 * Le droit, seul invariant appliqué ici : le fonds de travaux est déposé sur un compte séparé (L. 1965 art. 18, II, al. 4,
 * lu sur Légifrance le 30/10/2026, version en vigueur depuis le 11/04/2024 : compte séparé rémunéré au nom du syndicat, sans fusion ni compensation), jamais
 * confondu avec la trésorerie courante ; l'art. 14-2-1 fixe l'objet du fonds, pas son compte (voir fonds-travaux.ts, J4).
 *
 * Décisions de Hugo du 03/11/2026 (registre des décisions juridiques, J37 ; question 23 de la liste) :
 * - J37 : dans la pratique du cabinet, le compte de l'administrateur provisoire est un compte à la Caisse des dépôts, pas
 *   un compte centralisateur du cabinet. La pratique est consignée (MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE, mode
 *   « caisse_depots »), sans rien imposer : D-BANQUE n'est pas remise en cause, le réglage du cabinet garde son défaut et
 *   chaque mandat son choix. Le fonds de travaux reste sur un compte distinct (L. 1965 art. 18, II, al. 4, lu sur
 *   Légifrance le 30/10/2026 : compte séparé rémunéré, sans fusion ni compensation) : à la Caisse des dépôts aussi, sans
 *   IBAN propre, il exige son compte de nature « fonds_travaux » (anomalie fonds_travaux_manquant).
 *
 * Décisions de Hugo du 17/11/2026 (registre des décisions juridiques, J67 et J71 ; recommandations validées en bloc) :
 * - J67, R94 : le fondement probable du dépôt à la Caisse des dépôts des fonds de l'administrateur provisoire est C. com.
 *   R. 814-41 (lu sur Légifrance le 17/11/2026, en vigueur depuis le 27/03/2007) : dans les mandats « en matière
 *   civile », les administrateurs judiciaires déposent à la Caisse des dépôts, sur un compte ouvert à leur nom, dès
 *   réception, tous les fonds reçus. Que l'administration provisoire de copropriété soit une mission « en matière
 *   civile » est déduit, à confirmer (C. com. R. 811-28-2 range ces actes dans le stage de la spécialité commerciale
 *   (note du point 72)). L. 1965 art. 29-3, V présuppose ce dépôt (aucune exécution sur ces sommes) : le dépôt n'est
 *   pas présenté comme imposé par la loi de 1965, et la pratique du cabinet (J37) reste un réglage. Aucun changement de
 *   comportement.
 * - J67, R95 : un compte à la Caisse des dépôts ne remplit probablement pas, à la lettre, l'obligation d'un compte séparé
 *   « au nom du syndicat » (L. 1965 art. 18, II, al. 3) : le compte de R. 814-41 est ouvert au nom de l'administrateur.
 *   Rien n'est imposé ni bloqué : une information accompagne les comptes actifs à la Caisse des dépôts
 *   (informationsComptesMandat). Question à poser à un juriste ou au CNAJMJ.
 * - J71 (placement du fonds de travaux) : un compte de placement au nom du syndicat peut être réservé au fonds
 *   (reserveAuFondsTravaux) ; il tient alors le fonds, comme le compte séparé du fonds ou le compte repris qui le tenait
 *   (estCompteDuFondsTravaux, lu par virement-interne.ts et fonds-detenus.ts). Enregistrement de la marque : à brancher.
 *
 * Décision du 22/11/2026 (page « Appels de fonds », point 3, ap-03) : l'avis lit le mode réglé (choix du mandat, à défaut
 * réglage du cabinet) avant toute diffusion, au lieu d'un ordre fixe entre natures. Chaque mode désigne la nature du
 * compte qui reçoit les règlements des copropriétaires (natureEncaissement) ; compteEncaissement retient le seul compte
 * actif de cette nature, ou dit pourquoi aucun ne peut l'être (absent, sans IBAN valide, ambigu, IBAN d'un compte du
 * fonds de travaux, mode illisible), sans repli sur une autre nature. À valider : « compte en banque et Caisse des
 * dépôts » fait recevoir les règlements par le compte en banque (la Caisse des dépôts garde le dépôt) ; seul le compte
 * courant est tenu pour un compte au nom du syndicat (auNomDuSyndicat), le titulaire d'un compte à la Caisse des dépôts
 * (R95 ci-dessus) ou d'un sous-compte du centralisateur n'étant pas établi.
 *
 * 🔴 Non établi : l'articulation entre le compte au nom de l'administrateur (C. com. R. 814-41) et le compte séparé au nom
 *    du syndicat (L. 1965 art. 18, II, al. 3) : aucun texte lu ne dit si l'une cède devant l'autre ; l'intitulé exact des
 *    comptes ouverts par la Caisse des dépôts (au nom de l'administrateur « ès qualités » ?) n'est pas vérifié. D'ici là,
 *    aucun mode n'est présenté comme imposé par la loi.
 */

const FONDEMENT_FONDS_TRAVAUX = citerFondement(refLoi1965('18, II, al. 4'))

/** Nature d'un compte bancaire : décide des contrôles applicables (comme `Compte.nature` chez Gestéam). */
export const NATURES_COMPTE_BANCAIRE = {
  courant: { libelle: 'Compte courant au nom du syndicat' },
  fonds_travaux: { libelle: 'Compte séparé du fonds de travaux' },
  avance_travaux: { libelle: 'Avance de trésorerie pour travaux' },
  placement: { libelle: 'Compte de placement' },
  caisse_depots: { libelle: 'Compte à la Caisse des dépôts' },
  sous_compte_centralisateur: { libelle: 'Sous-compte du compte centralisateur du cabinet' },
  repris_ancien_gestionnaire: { libelle: "Compte repris de l'ancien syndic ou administrateur" },
} as const satisfies Record<string, { libelle: string }>
export type NatureCompteBancaire = keyof typeof NATURES_COMPTE_BANCAIRE

/** Marques d'un compte qui disent s'il tient le fonds de travaux (L. 1965 art. 18, II, al. 4). */
export interface MarquesFondsTravaux {
  nature: NatureCompteBancaire
  /** Compte repris de l'ancien gestionnaire qui tenait le fonds : ses sommes restent au fonds. Réservé à cette nature. */
  tenaitFondsTravaux?: boolean
  /** J71 : compte de placement au nom du syndicat, réservé au fonds de travaux. Réservé à la nature « placement ». */
  reserveAuFondsTravaux?: boolean
}

/** Compte qui tient le fonds de travaux : compte séparé du fonds, compte repris qui le tenait, placement réservé au fonds (J71). */
export const estCompteDuFondsTravaux = (c: MarquesFondsTravaux): boolean =>
  c.nature === 'fonds_travaux' ||
  (c.nature === 'repris_ancien_gestionnaire' && c.tenaitFondsTravaux === true) ||
  (c.nature === 'placement' && c.reserveAuFondsTravaux === true)

/** Refuse une marque du fonds de travaux portée par un compte d'une autre nature ; `nom` désigne le compte. */
export function verifierMarquesFondsTravaux(c: MarquesFondsTravaux, nom: string): void {
  if (c.tenaitFondsTravaux && c.nature !== 'repris_ancien_gestionnaire')
    throw new Error(`${nom} : seul un compte repris de l'ancien gestionnaire porte la mention « tenait le fonds de travaux ».`)
  if (c.reserveAuFondsTravaux && c.nature !== 'placement')
    throw new Error(`${nom} : seul un compte de placement porte la mention « réservé au fonds de travaux » (J71).`)
}

/**
 * Modes de tenue proposés au cabinet ; le fonds de travaux s'ajoute toujours à part, quel que soit le mode.
 * natureEncaissement (ap-03) : nature du compte qui reçoit les règlements des copropriétaires, une des natures requises.
 */
export const MODES_TENUE_COMPTES = {
  compte_separe_syndicat: {
    libelle: 'Compte séparé au nom du syndicat',
    naturesRequises: ['courant'],
    natureEncaissement: 'courant',
  },
  caisse_depots: {
    libelle: 'Compte à la Caisse des dépôts',
    naturesRequises: ['caisse_depots'],
    natureEncaissement: 'caisse_depots',
  },
  banque_et_caisse_depots: {
    libelle: 'Compte en banque et dépôt à la Caisse des dépôts',
    naturesRequises: ['courant', 'caisse_depots'],
    // À valider (ap-03) : le compte en banque reçoit les règlements, la Caisse des dépôts garde le dépôt.
    natureEncaissement: 'courant',
  },
  centralisateur_cabinet: {
    libelle: 'Compte centralisateur du cabinet, sous-compte par mandat',
    naturesRequises: ['sous_compte_centralisateur'],
    natureEncaissement: 'sous_compte_centralisateur',
  },
} as const satisfies Record<string, { libelle: string; naturesRequises: readonly NatureCompteBancaire[]; natureEncaissement: NatureCompteBancaire }>
export type ModeTenueComptes = keyof typeof MODES_TENUE_COMPTES

/**
 * Pratique du cabinet pour le compte de l'administrateur provisoire (décision J37) : un compte à la Caisse des dépôts,
 * pas le compte centralisateur. Proposée, jamais imposée (D-BANQUE) : le fonds de travaux s'y ajoute à part.
 */
export const MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE = 'caisse_depots' as const satisfies ModeTenueComptes

const verifierMode = (mode: string): ModeTenueComptes => {
  if (!Object.hasOwn(MODES_TENUE_COMPTES, mode)) throw new Error(`Mode de tenue inconnu : « ${mode} ».`)
  return mode as ModeTenueComptes
}

/** Réglage du cabinet : mode appliqué aux mandats qui ne choisissent pas le leur. */
export interface ReglagesComptesCabinet {
  modeParDefaut: ModeTenueComptes
}

export function creerReglagesComptesCabinet(saisie: Partial<ReglagesComptesCabinet>): ReglagesComptesCabinet {
  return { modeParDefaut: verifierMode(saisie.modeParDefaut ?? 'compte_separe_syndicat') }
}

export interface ModeResolu {
  mode: ModeTenueComptes
  origine: 'cabinet' | 'mandat'
}

/** Mode applicable à un mandat : son propre choix s'il en a un, sinon celui du cabinet. */
export function resoudreModeComptes(
  cabinet: ReglagesComptesCabinet,
  choixMandat: ModeTenueComptes | null | undefined,
): ModeResolu {
  if (choixMandat == null) return { mode: cabinet.modeParDefaut, origine: 'cabinet' }
  return { mode: verifierMode(choixMandat), origine: 'mandat' }
}

/** Mode lu pour un mandat (ap-03) : résolu, ou l'erreur de lecture gardée comme donnée, jamais un mode par défaut. */
export type ModeComptesLu = { resolu: ModeResolu; erreur: null } | { resolu: null; erreur: string }

/** resoudreModeComptes sans exception : un choix de mandat inconnu donne l'erreur, à porter par l'avis. */
export function lireModeComptes(cabinet: ReglagesComptesCabinet, choixMandat: ModeTenueComptes | null | undefined): ModeComptesLu {
  try {
    return { resolu: resoudreModeComptes(cabinet, choixMandat), erreur: null }
  } catch (erreur) {
    return { resolu: null, erreur: erreur instanceof Error ? erreur.message : String(erreur) }
  }
}

const normaliserIban = (iban: string): string => iban.replace(/\s+/g, '').toUpperCase()

/** Contrôle de format et de clé (ISO 13616, modulo 97). Ne dit rien de l'existence du compte. */
export function validerIban(iban: string): boolean {
  const brut = normaliserIban(iban)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(brut)) return false
  const chiffres = (brut.slice(4) + brut.slice(0, 4)).replace(/[A-Z]/g, (lettre) => String(lettre.charCodeAt(0) - 55))
  let reste = 0
  for (const chiffre of chiffres) reste = (reste * 10 + Number(chiffre)) % 97
  return reste === 1
}

/** Compte du syndicat lu pour désigner celui qui reçoit les règlements (champs de la table « banques »). */
export interface CompteCandidatEncaissement {
  id: string
  /** Absent pour un compte écrit avant D-BANQUE : il n'est jamais retenu. */
  nature?: NatureCompteBancaire
  iban?: string | null
  /** Compte clôturé = false ; absent = actif. */
  actif?: boolean
  tenaitFondsTravaux?: boolean
  reserveAuFondsTravaux?: boolean
}

/**
 * Compte qui reçoit les règlements des copropriétaires (ap-03) : désigné, avec son IBAN compact et son titulaire établi
 * ou non comme le syndicat, ou non désigné, avec le motif.
 */
export type CompteEncaissement =
  | { designe: true; banqueId: string; nature: NatureCompteBancaire; libelle: string; iban: string; auNomDuSyndicat: boolean }
  | { designe: false; motif: string }

const nonDesigne = (motif: string): CompteEncaissement => ({ designe: false, motif })

/** Message cité en milieu de phrase (motif d'une anomalie) : minuscule initiale, sans point final. */
export function enMilieuDePhrase(message: string): string {
  const texte = message.trim().replace(/\.$/, '')
  return texte.charAt(0).toLowerCase() + texte.slice(1)
}

/** Compte qui tient le fonds de travaux ; un compte sans nature (écrit avant D-BANQUE) n'en tient pas. */
const tientLeFonds = (c: CompteCandidatEncaissement): boolean => c.nature !== undefined && estCompteDuFondsTravaux({ ...c, nature: c.nature })

/**
 * Désigne le compte qui reçoit les règlements selon le mode lu (ap-03) : le seul compte actif de la nature que le mode
 * fait recevoir, jamais un compte du fonds de travaux. Aucun repli sur une autre nature. Non désigné, avec le motif :
 * mode illisible (l'erreur citée) ; aucun compte actif de cette nature ; plusieurs IBAN distincts, ou un compte sans
 * IBAN à côté d'un autre (deux fiches d'un même IBAN sont un seul compte, la plus petite référence est retenue) ; IBAN
 * absent ou invalide ; IBAN d'un compte qui tient le fonds de travaux, même clôturé (le fonds reste sur son compte
 * séparé, L. 1965 art. 18, II, al. 4 : les règlements courants n'y sont pas dirigés).
 */
export function compteEncaissement(mode: ModeComptesLu, comptes: readonly CompteCandidatEncaissement[]): CompteEncaissement {
  if (mode.resolu === null) return nonDesigne(enMilieuDePhrase(mode.erreur))
  const { libelle: libelleMode, natureEncaissement } = MODES_TENUE_COMPTES[verifierMode(mode.resolu.mode)]
  const libelle = NATURES_COMPTE_BANCAIRE[natureEncaissement].libelle
  const candidats = comptes
    .filter((c) => c.actif !== false && c.nature === natureEncaissement && !tientLeFonds(c))
    .sort((a, b) => a.id.localeCompare(b.id))
  if (candidats.length === 0) return nonDesigne(`aucun compte actif « ${libelle} », compte qui reçoit les règlements dans le mode « ${libelleMode} »`)
  const ibans = new Set(candidats.map((c) => normaliserIban(c.iban ?? '')))
  if (ibans.size > 1) return nonDesigne(`${ibans.size} comptes actifs « ${libelle} » : un seul doit recevoir les règlements`)
  const [compte] = candidats
  if (!compte.iban || !validerIban(compte.iban)) return nonDesigne(`« ${libelle} » sans IBAN valide`)
  const iban = normaliserIban(compte.iban)
  if (comptes.some((c) => tientLeFonds(c) && normaliserIban(c.iban ?? '') === iban))
    return nonDesigne(`l'IBAN du compte « ${libelle} » est celui d'un compte qui tient le fonds de travaux`)
  return { designe: true, banqueId: compte.id, nature: natureEncaissement, libelle, iban, auNomDuSyndicat: natureEncaissement === 'courant' }
}

/** Compte bancaire d'un mandat, tel que le contrôle le lit. */
export interface CompteBancaireMandat {
  nature: NatureCompteBancaire
  /** Null pour un compte sans IBAN propre (Caisse des dépôts non renseignée, sous-compte centralisateur). */
  iban: string | null
  actif: boolean
  soldeCentimes: number
}

export interface ContexteComptesMandat {
  mode: ModeTenueComptes
  /** La copropriété est dotée d'un fonds de travaux. */
  fondsTravaux: boolean
  comptes: CompteBancaireMandat[]
}

export type CodeAnomalieComptes =
  | 'nature_manquante'
  | 'fonds_travaux_manquant'
  | 'fonds_travaux_confondu'
  | 'iban_invalide'
  | 'compte_repris_a_solder'

export interface AnomalieComptes {
  code: CodeAnomalieComptes
  /** « bloquant » : règle de droit ou mode du cabinet non respecté ; « alerte » : rappel de gestion. */
  gravite: 'bloquant' | 'alerte'
  message: string
  /** Texte cité, null pour une règle de gestion ou un choix du cabinet. */
  fondement: string | null
}

/**
 * Contrôle les comptes ouverts d'un mandat contre le mode retenu. Seuls les comptes actifs comptent ; l'ordre des
 * anomalies suit celui des contrôles (mode, fonds de travaux, IBAN, comptes repris).
 */
export function controlerComptesMandat(contexte: ContexteComptesMandat): AnomalieComptes[] {
  const { libelle: libelleMode, naturesRequises } = MODES_TENUE_COMPTES[verifierMode(contexte.mode)]
  const actifs = contexte.comptes.filter((c) => c.actif)
  const anomalies: AnomalieComptes[] = []

  for (const nature of naturesRequises)
    if (!actifs.some((c) => c.nature === nature))
      anomalies.push({
        code: 'nature_manquante',
        gravite: 'bloquant',
        message: `${NATURES_COMPTE_BANCAIRE[nature].libelle} : compte à ouvrir, requis par le mode retenu (${libelleMode}).`,
        fondement: null,
      })

  const fonds = actifs.filter((c) => c.nature === 'fonds_travaux')
  if (contexte.fondsTravaux && fonds.length === 0)
    anomalies.push({
      code: 'fonds_travaux_manquant',
      gravite: 'bloquant',
      message: 'Fonds de travaux : ouvrir un compte séparé, distinct de la trésorerie courante.',
      fondement: FONDEMENT_FONDS_TRAVAUX,
    })
  const ibansAutres = new Set(
    actifs.filter((c) => c.nature !== 'fonds_travaux' && c.iban).map((c) => normaliserIban(c.iban as string)),
  )
  if (fonds.some((c) => c.iban && ibansAutres.has(normaliserIban(c.iban))))
    anomalies.push({
      code: 'fonds_travaux_confondu',
      gravite: 'bloquant',
      message: "Fonds de travaux : même IBAN qu'un autre compte du mandat. Le fonds doit être déposé sur un compte séparé.",
      fondement: FONDEMENT_FONDS_TRAVAUX,
    })

  for (const c of actifs)
    if (c.iban && !validerIban(c.iban))
      anomalies.push({
        code: 'iban_invalide',
        gravite: 'bloquant',
        message: `${NATURES_COMPTE_BANCAIRE[c.nature].libelle} : IBAN invalide (format ou clé).`,
        fondement: null,
      })

  for (const c of actifs)
    if (c.nature === 'repris_ancien_gestionnaire' && c.soldeCentimes !== 0)
      anomalies.push({
        code: 'compte_repris_a_solder',
        gravite: 'alerte',
        message: "Compte repris de l'ancien gestionnaire non soldé : virer le solde sur le compte du mandat puis le clôturer.",
        fondement: null,
      })

  return anomalies
}

/** Information sans blocage sur les comptes d'un mandat (J67, R95). */
export interface InformationComptes {
  code: 'caisse_depots_articulation_non_etablie'
  message: string
  fondement: string
}

/**
 * J67, R95 — informations, jamais bloquantes, sur les comptes actifs d'un mandat : une seule, dès qu'un compte actif est
 * à la Caisse des dépôts, ouvert au nom de l'administrateur (C. com. R. 814-41), alors que la loi demande un compte séparé
 * au nom du syndicat (L. 1965 art. 18, II, al. 3) ; aucun texte lu ne règle cette articulation.
 */
export function informationsComptesMandat(comptes: readonly Pick<CompteBancaireMandat, 'nature' | 'actif'>[]): InformationComptes[] {
  if (!comptes.some((c) => c.actif && c.nature === 'caisse_depots')) return []
  return [
    {
      code: 'caisse_depots_articulation_non_etablie',
      message:
        "Compte à la Caisse des dépôts : compte au nom de l'administrateur (C. com. R. 814-41) ; compte séparé au nom du syndicat (L. 1965 art. 18, II, al. 3) : articulation non établie. Information seulement, à faire préciser par un juriste ou le CNAJMJ.",
      fondement: 'C. com. R. 814-41 ; L. 1965 art. 18, II, al. 3',
    },
  ]
}
