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
 * Le droit, seul invariant appliqué ici : le fonds de travaux est déposé sur un compte séparé (L. 1965 art. 14-2-1),
 * jamais confondu avec la trésorerie courante (voir fonds-travaux.ts, J4).
 *
 * 🔴 Non établi : les textes du régime des AJ sur le dépôt des fonds (C. com., livre VIII) et la portée de l'obligation
 *    de compte séparé (L. 1965 art. 18) quand le mandataire est un administrateur judiciaire — à confirmer sur
 *    Légifrance avant d'en faire une règle. D'ici là, aucun mode n'est présenté comme imposé par la loi.
 */

const FONDEMENT_FONDS_TRAVAUX = citerFondement(refLoi1965('14-2-1'))

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

/** Modes de tenue proposés au cabinet ; le fonds de travaux s'ajoute toujours à part, quel que soit le mode. */
export const MODES_TENUE_COMPTES = {
  compte_separe_syndicat: {
    libelle: 'Compte séparé au nom du syndicat',
    naturesRequises: ['courant'],
  },
  caisse_depots: {
    libelle: 'Compte à la Caisse des dépôts',
    naturesRequises: ['caisse_depots'],
  },
  banque_et_caisse_depots: {
    libelle: 'Compte en banque et dépôt à la Caisse des dépôts',
    naturesRequises: ['courant', 'caisse_depots'],
  },
  centralisateur_cabinet: {
    libelle: 'Compte centralisateur du cabinet, sous-compte par mandat',
    naturesRequises: ['sous_compte_centralisateur'],
  },
} as const satisfies Record<string, { libelle: string; naturesRequises: readonly NatureCompteBancaire[] }>
export type ModeTenueComptes = keyof typeof MODES_TENUE_COMPTES

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
