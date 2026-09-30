import { DEMO_REGLES_ACCOMPLIES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { dateVersIso, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  calculerEcheancesLegales,
  calculerEtatEcheance,
  controlerContexteMandat,
  type AnomalieContexte,
  type ContexteMandat,
  type EcheanceCalculee,
} from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { regimeDepuisFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'

/**
 * Échéances légales d'un mandat enregistré : passage de la vue copropriété (dates en objets Date) au contexte
 * du moteur de délais (dates ISO), puis calcul, et listes du portefeuille.
 */

/** Champs d'une copropriété lus pour construire le contexte du moteur. */
export interface MandatPourContexte {
  fondement: string
  /** Objet Date (base locale) ; toute autre valeur est ignorée. */
  ordonnance?: unknown
  dureeMois: number
  echeance?: unknown
}

/**
 * Date locale → ISO comme dateVersIso, mais une Date hors du calendrier ISO « AAAA-MM-JJ » (année au-delà de 9999,
 * par exemple une échéance enregistrée en 10000 pour une ordonnance de 9999) est écartée comme une Date invalide :
 * le moteur ne sait pas la lire. Sans effet sur les années 0 à 9999.
 */
const dateVersIsoMoteur = (valeur: unknown): string | null => {
  const iso = dateVersIso(valeur)
  return estDateIsoValide(iso) ? iso : null
}

/**
 * Contexte du moteur à partir d'un mandat : les Date sont converties en ISO LOCAL (année, mois, jour locaux).
 * Fondement non reconnu ou ordonnance absente → null ; durée ≤ 0 → durée inconnue.
 */
export function construireContexteMandat(mandat: MandatPourContexte): ContexteMandat | null {
  const regime = regimeDepuisFondement(mandat.fondement),
    dateOrdonnance = dateVersIsoMoteur(mandat.ordonnance ?? null)
  return !regime || !dateOrdonnance
    ? null
    : {
        regime,
        dateOrdonnance,
        dureeMissionMois: mandat.dureeMois && mandat.dureeMois > 0 ? mandat.dureeMois : null,
        dateFinMission: dateVersIsoMoteur(mandat.echeance ?? null),
      }
}

/** Erreur levée par dates.ts sur une date qui n'est pas une date ISO valide (année au-delà de 9999…). */
const estErreurDateIso = (erreur: unknown): boolean =>
  erreur instanceof Error && erreur.message.startsWith('Date ISO invalide')

/**
 * Échéances du moteur, ou null quand le calcul sort du calendrier ISO (année au-delà de 9999) : le moteur lève
 * alors une erreur (fin de mission hors calendrier) ou renvoie des dates « 10000-… » que les écrans ne savent ni
 * afficher ni comparer. Sans effet tant que toutes les dates restent dans le calendrier.
 */
function calculerEcheancesDansCalendrier(contexte: ContexteMandat): EcheanceCalculee[] | null {
  let echeances: EcheanceCalculee[]
  try {
    echeances = calculerEcheancesLegales(contexte)
  } catch (erreur) {
    // Seul un débordement du calendrier est converti en « hors périmètre » ; toute autre erreur remonte.
    if (!estErreurDateIso(erreur)) throw erreur
    return null
  }
  const horsCalendrier = (date: string | null): boolean => date !== null && !estDateIsoValide(date)
  return echeances.some((echeance) =>
    [echeance.dateLegale, echeance.dateProrogee, echeance.dateRetenue, echeance.depart.date].some(horsCalendrier),
  )
    ? null
    : echeances
}

/** Règles réputées accomplies quand la notification de l'ordonnance est « Effectuée ». */
export const REGLES_NOTIFICATION_ORDONNANCE = ['notification-ordonnance-46-47', 'information-coproprietaires-ap291']

export type EtatMoteur = 'chargement' | 'indisponible' | 'introuvable' | 'ordonnance_manquante' | 'hors_perimetre' | 'ok'

/** Copropriété attendue par le moteur (vue copropriété ou toute structure qui en reprend ces champs). */
export type CoproprieteMoteur = Pick<CoproprieteVue, 'code' | 'fondement' | 'dureeMois' | 'notifOrdonnance'> & {
  ordonnance?: unknown
  echeance?: unknown
}

export interface ResultatEcheancesMandat<C = CoproprieteVue> {
  etat: EtatMoteur
  copro: C | null
  contexte: ContexteMandat | null
  echeances: EcheanceCalculee[]
  anomalies: AnomalieContexte[]
}

export const resultatEcheancesVide = <C = CoproprieteVue>(
  etat: EtatMoteur,
  copro: C | null = null,
): ResultatEcheancesMandat<C> => ({
  etat,
  copro,
  contexte: null,
  echeances: [],
  anomalies: [],
})

/**
 * Échéances légales d'une copropriété. Règles accomplies : notification de l'ordonnance si elle est « Effectuée »,
 * plus les règles accomplies de DÉMONSTRATION indexées par code (LM, CV, TL, VM), quel que soit le mode.
 * Une ordonnance hors du calendrier ISO est traitée comme une ordonnance invalide ; un calcul qui en sort
 * (ordonnance de fin 9999, fin de mission en 10000…) donne « hors_perimetre » au lieu de lever pendant le rendu.
 */
export function calculerEcheancesCopropriete<C extends CoproprieteMoteur>(
  copro: C | null | undefined,
): ResultatEcheancesMandat<C> {
  if (!copro) return resultatEcheancesVide<C>('introuvable')
  if (!dateVersIsoMoteur(copro.ordonnance)) return resultatEcheancesVide('ordonnance_manquante', copro)
  const contexteMandat = construireContexteMandat({
    fondement: copro.fondement,
    ordonnance: copro.ordonnance,
    dureeMois: copro.dureeMois,
    echeance: copro.echeance,
  })
  if (!contexteMandat) return resultatEcheancesVide('hors_perimetre', copro)
  const contexte: ContexteMandat = {
    ...contexteMandat,
    accomplies: [
      ...(copro.notifOrdonnance === 'Effectuée' ? REGLES_NOTIFICATION_ORDONNANCE : []),
      ...(DEMO_REGLES_ACCOMPLIES[copro.code] ?? []),
    ],
  }
  const echeances = calculerEcheancesDansCalendrier(contexte)
  if (!echeances) return resultatEcheancesVide('hors_perimetre', copro)
  return {
    etat: 'ok',
    copro,
    contexte,
    echeances,
    anomalies: controlerContexteMandat(contexte),
  }
}

export interface EcheancePortefeuille<C = CoproprieteVue> {
  copro: C
  echeance: EcheanceCalculee
}

/** Toutes les échéances du portefeuille, triées par date retenue (sans date en dernier). */
export function listerEcheancesPortefeuille<C extends CoproprieteMoteur>(copros: C[]): EcheancePortefeuille<C>[] {
  return copros
    .flatMap((copro) =>
      calculerEcheancesCopropriete(copro).echeances.map((echeance) => ({
        copro,
        echeance,
      })),
    )
    .sort((a, b) => {
      const dateA = a.echeance.dateRetenue,
        dateB = b.echeance.dateRetenue
      return dateA && dateB ? (dateA < dateB ? -1 : dateA > dateB ? 1 : 0) : dateA ? -1 : dateB ? 1 : 0
    })
}

/** Messages affichés selon l'état du moteur. */
export const MESSAGES_ETAT_ECHEANCES: Record<EtatMoteur, string> = {
  chargement: 'Chargement du mandat…',
  indisponible: 'Base locale indisponible dans ce navigateur : échéances non calculées.',
  introuvable: 'Copropriété introuvable dans la base locale.',
  ordonnance_manquante: "Date d'ordonnance absente : échéances non calculées.",
  hors_perimetre: 'Mandat hors du périmètre du moteur de délais (mandat ad hoc ou fondement non reconnu).',
  ok: 'Aucune échéance légale calculée.',
}

/** Retire les échéances accomplies et les fenêtres des tiers déjà closes. */
export function filtrerEcheancesAAfficher<T extends { echeance: EcheanceCalculee }>(items: T[], referenceIso: string): T[] {
  return items.filter(({ echeance }) => {
    const etat = calculerEtatEcheance(echeance, referenceIso)
    return etat !== 'accomplie' && !(echeance.nature === 'fenetre_tiers' && etat === 'depassee')
  })
}

/** Obligations non accomplies : celles du cabinet, et celles des tiers dont la date est connue. */
export function filtrerObligationsEnCours<T extends { echeance: EcheanceCalculee }>(items: T[]): T[] {
  return items.filter(
    ({ echeance }) =>
      !echeance.accomplie &&
      (echeance.nature === 'obligation' || (echeance.nature === 'obligation_tiers' && echeance.dateRetenue !== null)),
  )
}
