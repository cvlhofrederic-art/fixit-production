import { ajouterJours, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'

/**
 * Carence d'une assemblée générale : constat et suites à donner (point 23 du bilan 2 ; cartographie Gestéam : bouton
 * « Carence » de la fiche AG, nature « Judiciaire », modèle de courrier « PV de carence » — tranches 22 et 31). Fonctions
 * pures, dates ISO, sans écran ni table (la marque sur la table Ag attend l'accord de Frédéric).
 *
 * À ne pas confondre avec l'ordonnance de carence du MANDAT (art. 47), que porte mandat-judiciaire.ts : ici, c'est une
 * réunion d'assemblée qui n'aboutit pas.
 *
 * Le droit — 🟢 textes relus sur Légifrance le 29/10/2026 :
 * - « carence » n'est pas un terme légal pour une assemblée ; il n'existe pas de quorum en copropriété. La loi vise
 *   l'assemblée « convoquée à cet effet » qui ne nomme pas de syndic : le président du tribunal judiciaire désigne alors
 *   un syndic, à la requête d'un ou plusieurs copropriétaires, du maire ou du président de l'EPCI compétent en matière
 *   d'habitat (L. 1965 art. 17, al. 3), ou d'un ou plusieurs membres du conseil syndical (D. 1967 art. 46) ;
 * - syndic désigné par le juge (art. 46) : l'ordonnance fixe la durée de sa mission, qui peut être prorogée suivant la
 *   même procédure ; il convoque l'assemblée en vue de désigner un syndic ;
 * - administrateur de l'art. 47 : il convoque l'assemblée pour désigner un syndic dans les délais de l'ordonnance ;
 * - administrateur provisoire (art. 29-1) : le président du tribunal judiciaire peut modifier, prolonger sa mission ou y
 *   mettre fin (L. 1965 art. 29-1, I, al. 3) ; il rend compte par écrit au juge au moins une fois par an et en fin de
 *   mission (D. 1967 art. 62-11) ;
 * - convocation notifiée au moins 21 jours avant la réunion, ou dans le délai plus long prévu par le règlement de
 *   copropriété, sauf urgence (D. 1967 art. 9).
 * Repris de delais-legaux.ts (règles fin-mission-ap47 et convocation-ag-sj, non relues ici) : la mission de
 * l'administrateur de l'art. 47 prend fin à la date prévue, sans prorogation de fait (Cass. 3e civ., 14 janv. 2016,
 * n° 14-24.989) ; les fonctions cessent de plein droit à l'acceptation de son mandat par le syndic désigné.
 *
 * 🔵 Déduit : la présentation de la convocation au plus tard (délai + 1) jours avant la réunion (21 jours francs, décompte
 * de votes-ag.ts et suivi-a-faire.ts, confirmé par la décision J5 du 30/10/2026) ; la réunion la plus proche possible se compte depuis le jour du
 * contrôle ; une réunion tenue après la fin de la mission l'a été sans pouvoirs.
 * 🔴 Non établi : l'assemblée sans aucun participant, ou qui ne peut se tenir, n'est définie par aucun texte ; la
 * prorogation de la mission de l'administrateur de l'art. 47 par l'art. 29-1, I, al. 3 (« même si celui-ci n'a été
 * désigné que pour convoquer l'assemblée générale ») n'est pas proposée tant que son application à l'art. 47 n'est pas
 * confirmée ; l'information du juge par le syndic de l'art. 46 ou l'administrateur de l'art. 47 dépend de l'ordonnance ;
 * un PV de carence notifié ouvre-t-il le délai de contestation de l'art. 42 ? Question laissée à Hugo.
 */

export const MOTIFS_CARENCE = ['aucun_participant', 'syndic_non_designe', 'reunion_non_tenue'] as const
export type MotifCarence = (typeof MOTIFS_CARENCE)[number]

/** D. 1967 art. 9 : convocation notifiée au moins 21 jours avant la réunion (sauf délai plus long du règlement). */
export const DELAI_CONVOCATION_JOURS = 21

/** Présentation de la convocation au plus tard 22 jours avant la réunion (21 jours francs, décompte confirmé : décision J5). */
export const JOURS_PRESENTATION_AVANT_REUNION = DELAI_CONVOCATION_JOURS + 1

export interface SaisieCarence {
  agId: string
  /** Date de la réunion qui n'a pas abouti. */
  date: string
  motif: MotifCarence
  /** L'assemblée était convoquée pour désigner un syndic (L. 1965 art. 17, al. 3). */
  objetDesignationSyndic: boolean
}

export type CodeSuiteCarence = 'nouvelle_convocation' | 'requete_designation_syndic' | 'prorogation_mission' | 'information_juge'

export interface SuiteCarence {
  code: CodeSuiteCarence
  libelle: string
  /** Texte qui fonde la suite ; null quand elle dépend de l'ordonnance. */
  fondement: string | null
  aConfirmer: boolean
}

export interface CarenceAg extends SaisieCarence {
  /** Régime du mandat au jour du constat (fondements.ts) ; null : inconnu. */
  regime: Regime | null
  suites: SuiteCarence[]
}

const FONDEMENT_MISSION: Record<Regime, string> = {
  sj: 'D. 1967 art. 46',
  ap47: 'D. 1967 art. 47',
  ap291: 'L. 1965 art. 29-1, I, al. 3',
}

/** Suites que le droit prévoit selon le régime du mandat ; régime inconnu : la nouvelle convocation seule. */
export function suitesProposees({
  regime,
  objetDesignationSyndic,
}: {
  regime: Regime | null
  objetDesignationSyndic: boolean
}): SuiteCarence[] {
  const suites: SuiteCarence[] = [
    {
      code: 'nouvelle_convocation',
      libelle:
        'Nouvelle convocation, notifiée au moins 21 jours avant la réunion (ou dans le délai plus long du règlement de copropriété), sauf urgence',
      fondement: 'D. 1967 art. 9',
      aConfirmer: false,
    },
  ]
  if (regime === null) return suites
  if (objetDesignationSyndic && (regime === 'ap47' || regime === 'sj'))
    suites.push({
      code: 'requete_designation_syndic',
      libelle:
        "Informer les copropriétaires : à défaut de nomination par l'assemblée convoquée à cet effet, un ou plusieurs copropriétaires, un ou plusieurs membres du conseil syndical, le maire ou le président de l'EPCI peuvent demander au président du tribunal judiciaire de désigner un syndic",
      fondement: 'L. 1965 art. 17, al. 3 ; D. 1967 art. 46',
      aConfirmer: false,
    })
  if (objetDesignationSyndic && regime === 'sj')
    suites.push({
      code: 'prorogation_mission',
      libelle: 'Demander la prorogation de la mission par requête au président du tribunal judiciaire, avant son terme',
      fondement: FONDEMENT_MISSION.sj,
      aConfirmer: false,
    })
  if (objetDesignationSyndic && regime === 'ap291')
    suites.push({
      code: 'prorogation_mission',
      libelle: 'Demander au président du tribunal judiciaire de prolonger ou de modifier la mission, avant son terme',
      fondement: FONDEMENT_MISSION.ap291,
      aConfirmer: false,
    })
  suites.push(
    regime === 'ap291'
      ? {
          code: 'information_juge',
          libelle: 'Rendre compte de la carence au président du tribunal judiciaire (compte rendu au moins annuel)',
          fondement: 'D. 1967 art. 62-11',
          aConfirmer: false,
        }
      : {
          code: 'information_juge',
          libelle: "Informer le président du tribunal judiciaire, selon ce que prévoit l'ordonnance de désignation",
          fondement: null,
          aConfirmer: true,
        },
  )
  return suites
}

/** Constate la carence d'une assemblée et propose les suites prévues pour le régime du mandat. */
export function constaterCarence(saisie: SaisieCarence, { regime }: { regime: Regime | null }): CarenceAg {
  if (!saisie.agId.trim()) throw new Error('Carence : assemblée attendue (identifiant vide).')
  if (!estDateIsoValide(saisie.date)) throw new Error(`Date de la réunion invalide (${saisie.date}) : AAAA-MM-JJ attendu.`)
  if (!(MOTIFS_CARENCE as readonly string[]).includes(saisie.motif)) throw new Error(`Motif de carence inconnu : « ${saisie.motif} ».`)
  if (saisie.motif === 'syndic_non_designe' && !saisie.objetDesignationSyndic)
    throw new Error("Carence « syndic non désigné » : l'assemblée devait être convoquée pour la désignation d'un syndic.")
  return { ...saisie, regime, suites: suitesProposees({ regime, objetDesignationSyndic: saisie.objetDesignationSyndic }) }
}

export type CodeAnomalieCarence = 'mission_expiree' | 'mission_trop_courte' | 'fin_mission_inconnue' | 'reunion_apres_fin_mission'

export interface AnomalieCarence {
  code: CodeAnomalieCarence
  message: string
  fondement: string
  aConfirmer: boolean
}

/**
 * Contrôle des suites d'une carence au regard de la mission de son régime (syndic de l'art. 46, administrateurs des art.
 * 47 et 29-1) : réunion tenue après la fin de la mission, mission expirée, ou trop courte pour réunir une nouvelle
 * assemblée, ou fin de mission inconnue. `delaiConvocationJours` : délai du règlement s'il est plus long que 21 jours.
 */
export function controlerSuitesCarence(
  carence: CarenceAg,
  { dateFinMission, delaiConvocationJours = DELAI_CONVOCATION_JOURS }: { dateFinMission: string | null; delaiConvocationJours?: number },
  aujourdhui: string,
): AnomalieCarence[] {
  if (!estDateIsoValide(aujourdhui)) throw new Error(`Date du jour invalide (${aujourdhui}) : AAAA-MM-JJ attendu.`)
  if (aujourdhui < carence.date)
    throw new Error(`Carence datée du ${dateIsoVersFr(carence.date)}, après le jour du contrôle : une réunion à venir ne peut pas être constatée.`)
  if (dateFinMission !== null && !estDateIsoValide(dateFinMission))
    throw new Error(`Date de fin de mission invalide (${dateFinMission}) : AAAA-MM-JJ attendu.`)
  if (!Number.isInteger(delaiConvocationJours) || delaiConvocationJours < DELAI_CONVOCATION_JOURS)
    throw new Error(`Délai de convocation invalide (${delaiConvocationJours}) : au moins ${DELAI_CONVOCATION_JOURS} jours.`)
  const { regime } = carence
  if (regime === null) return []
  const fondement = FONDEMENT_MISSION[regime]
  if (dateFinMission === null)
    return [
      {
        code: 'fin_mission_inconnue',
        message: "Date de fin de mission à renseigner (fixée par l'ordonnance) : elle borne la nouvelle convocation.",
        fondement,
        aConfirmer: true,
      },
    ]
  const anomalies: AnomalieCarence[] = []
  if (carence.date > dateFinMission)
    anomalies.push({
      code: 'reunion_apres_fin_mission',
      message: `Réunion du ${dateIsoVersFr(carence.date)} tenue après la fin de la mission (${dateIsoVersFr(dateFinMission)}) : sans pouvoirs à cette date.`,
      fondement,
      aConfirmer: false,
    })
  if (dateFinMission < aujourdhui) {
    anomalies.push({
      code: 'mission_expiree',
      message:
        regime === 'ap47'
          ? `Mission expirée le ${dateIsoVersFr(dateFinMission)} : pas de prorogation de fait (Cass. 3e civ., 14 janv. 2016, n° 14-24.989) ; une nouvelle désignation par le juge est nécessaire.`
          : `Mission expirée le ${dateIsoVersFr(dateFinMission)} : demander au président du tribunal judiciaire une nouvelle désignation.`,
      fondement,
      aConfirmer: false,
    })
    return anomalies
  }
  const reunionAuPlusTot = ajouterJours(aujourdhui, delaiConvocationJours + 1)
  if (dateFinMission < reunionAuPlusTot)
    anomalies.push({
      code: 'mission_trop_courte',
      message: `La mission s'achève le ${dateIsoVersFr(dateFinMission)}, avant la réunion la plus proche possible (${dateIsoVersFr(reunionAuPlusTot)}) : ${
        regime === 'ap47' ? 'saisir d’abord le juge (modification de la mission, à confirmer)' : 'demander d’abord la prorogation de la mission'
      }.`,
      fondement,
      aConfirmer: regime === 'ap47',
    })
  return anomalies
}
