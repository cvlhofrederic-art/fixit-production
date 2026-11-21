import { ajouterJours, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { controlerRegime, type Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import { normaliserEspaces } from '@/lib/administrateur-judiciaire/domain/texte'

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
 *
 * Décisions du 17/11/2026 (J67 : recommandations validées en bloc ; textes lus sur Légifrance le 17/11/2026) :
 * - J67, R26 : l'administrateur de l'art. 47 peut demander au juge de prolonger sa mission. Le président du tribunal
 *   judiciaire peut la modifier ou la prolonger à la demande de l'administrateur provisoire, « même si celui-ci n'a été
 *   désigné que pour convoquer l'assemblée générale en vue de désigner un syndic » (L. 1965 art. 29-1, I, al. 3) ; la
 *   mission prend fin à la date de l'ordonnance, sauf si elle a été « judiciairement prorogée ou renouvelée » (Cass. 3e
 *   civ., 14/01/2016, n° 14-24.989, rendu au visa de D. 1967 art. 47). Suite prorogation_mission proposée, à confirmer
 *   (l'arrêt ne cite pas l'art. 29-1) ; l'anomalie mission_trop_courte reprend son libellé.
 * - J67, R27 : aucun texte n'oblige le syndic de l'art. 46 ni l'administrateur de l'art. 47 à informer le juge d'une
 *   carence (D. 1967 art. 46 et 47) ; le compte rendu annuel ne vise que l'administrateur de l'art. 29-1 (D. 1967 art.
 *   62-11). La suite information_juge reste « selon l'ordonnance », à confirmer, avec ce fondement écrit ; conseil de
 *   prudence : si la carence empêche de finir la mission avant son terme, saisir le juge avant ce terme.
 * - J67, R28 : un PV de carence (aucun participant, ordre du jour non délibéré) ne porte aucune décision et n'ouvre pas
 *   le délai de deux mois de l'art. 42 (L. 1965 art. 42, al. 2) : rien n'est calculé. Une assemblée qui s'est tenue et a
 *   voté sans désigner de syndic (motif syndic_non_designe) a un procès-verbal ordinaire, à notifier aux opposants et
 *   défaillants (D. 1967 art. 18) : suite notification_proces_verbal ; le délai se calcule comme d'habitude
 *   (statut-assemblee.ts).
 *
 * - Décision du 20/11/2026 (partie C, F21) : l'assemblée sans aucun participant, ou qui ne peut se tenir, n'est définie
 *   par aucun texte ; les trois motifs sont gardés, avec ces définitions de pratique (MOTIFS_CARENCE_DEFINIS) :
 *   « aucun participant » = aucun copropriétaire présent, représenté ni ayant voté par correspondance (mention du modèle
 *   de PV de carence) ; « réunion non tenue » = motif libre obligatoire (lieu fermé, incident…), refusé vide par
 *   constaterCarence ; « syndic non désigné » = l'assemblée s'est tenue et a voté, ce n'est donc pas une carence au sens
 *   du modèle : procès-verbal ordinaire à notifier (suite notification_proces_verbal, J67, R28) et requête au président
 *   du tribunal judiciaire proposée (suite requete_designation_syndic, L. 1965 art. 17, al. 3 ; D. 1967 art. 46), pour
 *   le syndic de l'art. 46 et l'administrateur de l'art. 47 ; le PV de carence (gabarits-courrier.ts, pv_carence) ne
 *   sert qu'aux deux premiers motifs (modeleProcesVerbalCarence).
 */

export const MOTIFS_CARENCE = ['aucun_participant', 'syndic_non_designe', 'reunion_non_tenue'] as const
export type MotifCarence = (typeof MOTIFS_CARENCE)[number]

/** PV de carence (modèle de pratique, gabarits-courrier.ts), ou procès-verbal ordinaire de l'assemblée qui a voté. */
export type ModeleProcesVerbalCarence = 'pv_carence' | 'proces_verbal_ordinaire'

export interface DefinitionMotifCarence {
  libelle: string
  definition: string
  /** Le constat exige un motif libre (lieu fermé, incident…). */
  motifLibreObligatoire: boolean
  modeleProcesVerbal: ModeleProcesVerbalCarence
}

/** Décision du 20/11/2026 (partie C, F21) : les trois motifs de carence et leur définition de pratique (aucun texte). */
export const MOTIFS_CARENCE_DEFINIS: Readonly<Record<MotifCarence, DefinitionMotifCarence>> = {
  aucun_participant: {
    libelle: 'Aucun participant',
    definition: 'Aucun copropriétaire présent, représenté ni ayant voté par correspondance',
    motifLibreObligatoire: false,
    modeleProcesVerbal: 'pv_carence',
  },
  syndic_non_designe: {
    libelle: 'Syndic non désigné',
    definition:
      "L'assemblée convoquée pour désigner un syndic s'est tenue et a voté : ce n'est pas une carence au sens du modèle ; procès-verbal ordinaire à notifier, requête au président du tribunal judiciaire à proposer",
    motifLibreObligatoire: false,
    modeleProcesVerbal: 'proces_verbal_ordinaire',
  },
  reunion_non_tenue: {
    libelle: 'Réunion non tenue',
    definition: "La réunion n'a pas pu se tenir : motif libre obligatoire (lieu fermé, incident…)",
    motifLibreObligatoire: true,
    modeleProcesVerbal: 'pv_carence',
  },
}

/** Modèle de procès-verbal du motif : PV de carence, sauf pour l'assemblée qui s'est tenue et a voté (F21). */
export const modeleProcesVerbalCarence = (motif: MotifCarence): ModeleProcesVerbalCarence => MOTIFS_CARENCE_DEFINIS[motif].modeleProcesVerbal

/** D. 1967 art. 9 : convocation notifiée au moins 21 jours avant la réunion (sauf délai plus long du règlement). */
export const DELAI_CONVOCATION_JOURS = 21

/** Présentation de la convocation au plus tard 22 jours avant la réunion (21 jours francs, décompte confirmé : décision J5). */
export const JOURS_PRESENTATION_AVANT_REUNION = DELAI_CONVOCATION_JOURS + 1

export interface SaisieCarence {
  agId: string
  /** Date de la réunion qui n'a pas abouti. */
  date: string
  motif: MotifCarence
  /**
   * Motif libre (lieu fermé, incident…) : obligatoire pour « réunion non tenue », facultatif sinon (décision du
   * 20/11/2026, partie C, F21) ; absent ou null : non saisi.
   */
  motifLibre?: string | null
  /** L'assemblée était convoquée pour désigner un syndic (L. 1965 art. 17, al. 3). */
  objetDesignationSyndic: boolean
}

export type CodeSuiteCarence =
  | 'nouvelle_convocation'
  | 'notification_proces_verbal'
  | 'requete_designation_syndic'
  | 'prorogation_mission'
  | 'information_juge'

export interface SuiteCarence {
  code: CodeSuiteCarence
  libelle: string
  /** Texte qui fonde la suite ; pour une suite qui dépend de l'ordonnance, le texte dit qu'aucun ne l'impose (J67, R27). */
  fondement: string
  aConfirmer: boolean
}

export interface CarenceAg extends SaisieCarence {
  /** Motif libre, espaces superflus retirés ; null : non saisi. */
  motifLibre: string | null
  /** PV de carence, ou procès-verbal ordinaire pour l'assemblée qui s'est tenue et a voté (F21). */
  modeleProcesVerbal: ModeleProcesVerbalCarence
  /** Régime du mandat au jour du constat (fondements.ts) ; null : inconnu. */
  regime: Regime | null
  suites: SuiteCarence[]
}

const FONDEMENT_MISSION: Record<Regime, string> = {
  sj: 'D. 1967 art. 46',
  ap47: 'D. 1967 art. 47',
  ap291: 'L. 1965 art. 29-1, I, al. 3',
}

/** J67, R26 : demande de l'administrateur de l'art. 47, reprise par l'anomalie mission_trop_courte. */
const PROROGATION_AP47 = 'au président du tribunal judiciaire, avant le terme, de prolonger ou de modifier la mission'

/** Demande de prorogation selon le régime, quand l'assemblée devait désigner un syndic. */
const PROROGATIONS: Record<Regime, Omit<SuiteCarence, 'code'>> = {
  sj: {
    libelle: 'Demander la prorogation de la mission par requête au président du tribunal judiciaire, avant son terme',
    fondement: FONDEMENT_MISSION.sj,
    aConfirmer: false,
  },
  // J67, R26 : à confirmer, l'arrêt de 2016 ne cite pas l'art. 29-1
  ap47: {
    libelle: `Demander ${PROROGATION_AP47}`,
    fondement: 'L. 1965 art. 29-1, I, al. 3 ; D. 1967 art. 47 ; Cass. 3e civ., 14/01/2016, n° 14-24.989',
    aConfirmer: true,
  },
  ap291: {
    libelle: 'Demander au président du tribunal judiciaire de prolonger ou de modifier la mission, avant son terme',
    fondement: FONDEMENT_MISSION.ap291,
    aConfirmer: false,
  },
}

/** J67, R28 : l'assemblée s'est tenue et a voté ; son procès-verbal ouvre le délai de l'art. 42 (un PV de carence, non). */
const NOTIFICATION_PROCES_VERBAL: SuiteCarence = {
  code: 'notification_proces_verbal',
  libelle:
    "Notifier le procès-verbal ordinaire de l'assemblée (pas un PV de carence) aux copropriétaires opposants ou défaillants : l'assemblée s'est tenue et a voté ; leur délai de deux mois pour contester court de cette notification",
  fondement: 'L. 1965 art. 42, al. 2 ; D. 1967 art. 18',
  aConfirmer: false,
}

/**
 * Suites que le droit prévoit selon le régime du mandat ; régime inconnu : la nouvelle convocation seule, et la
 * notification du procès-verbal quand l'assemblée s'est tenue sans désigner de syndic (`motif`, donné par le constat).
 * Refus : régime hors des trois (controlerRegime), qui donnerait une suite sans libellé ni fondement.
 */
export function suitesProposees({
  regime,
  objetDesignationSyndic,
  motif = null,
}: {
  regime: Regime | null
  objetDesignationSyndic: boolean
  motif?: MotifCarence | null
}): SuiteCarence[] {
  controlerRegime(regime)
  const suites: SuiteCarence[] = [
    {
      code: 'nouvelle_convocation',
      libelle:
        'Nouvelle convocation, notifiée au moins 21 jours avant la réunion (ou dans le délai plus long du règlement de copropriété), sauf urgence',
      fondement: 'D. 1967 art. 9',
      aConfirmer: false,
    },
  ]
  if (motif === 'syndic_non_designe') suites.push(NOTIFICATION_PROCES_VERBAL)
  if (regime === null) return suites
  if (objetDesignationSyndic && (regime === 'ap47' || regime === 'sj'))
    suites.push({
      code: 'requete_designation_syndic',
      libelle:
        "Informer les copropriétaires : à défaut de nomination par l'assemblée convoquée à cet effet, un ou plusieurs copropriétaires, un ou plusieurs membres du conseil syndical, le maire ou le président de l'EPCI peuvent demander au président du tribunal judiciaire de désigner un syndic",
      fondement: 'L. 1965 art. 17, al. 3 ; D. 1967 art. 46',
      aConfirmer: false,
    })
  if (objetDesignationSyndic) suites.push({ code: 'prorogation_mission', ...PROROGATIONS[regime] })
  suites.push(
    regime === 'ap291'
      ? {
          code: 'information_juge',
          libelle: 'Rendre compte de la carence au président du tribunal judiciaire (compte rendu au moins annuel)',
          fondement: 'D. 1967 art. 62-11',
          aConfirmer: false,
        }
      : {
          // J67, R27 : aucun texte ne l'impose ; conseil de prudence avant le terme (R26)
          code: 'information_juge',
          libelle:
            "Informer le président du tribunal judiciaire, selon ce que prévoit l'ordonnance de désignation ; si la carence empêche de finir la mission avant son terme, le saisir avant ce terme",
          fondement: "D. 1967 art. 46 et 47 : aucune obligation d'information du juge ; voir l'ordonnance",
          aConfirmer: true,
        },
  )
  return suites
}

/** Motif libre normalisé ; refus d'un motif libre vide quand le motif l'exige (« réunion non tenue », F21). */
function motifLibreDuConstat(saisie: SaisieCarence): string | null {
  const motifLibre = normaliserEspaces(saisie.motifLibre ?? '')
  if (motifLibre !== '') return motifLibre
  if (MOTIFS_CARENCE_DEFINIS[saisie.motif].motifLibreObligatoire)
    throw new Error('Carence « réunion non tenue » : motif libre obligatoire (lieu fermé, incident…).')
  return null
}

/** Constate la carence d'une assemblée et propose les suites prévues pour le régime du mandat. */
export function constaterCarence(saisie: SaisieCarence, { regime }: { regime: Regime | null }): CarenceAg {
  if (!saisie.agId.trim()) throw new Error('Carence : assemblée attendue (identifiant vide).')
  if (!estDateIsoValide(saisie.date)) throw new Error(`Date de la réunion invalide (${saisie.date}) : AAAA-MM-JJ attendu.`)
  if (!(MOTIFS_CARENCE as readonly string[]).includes(saisie.motif)) throw new Error(`Motif de carence inconnu : « ${saisie.motif} ».`)
  if (saisie.motif === 'syndic_non_designe' && !saisie.objetDesignationSyndic)
    throw new Error("Carence « syndic non désigné » : l'assemblée devait être convoquée pour la désignation d'un syndic.")
  return {
    ...saisie,
    motifLibre: motifLibreDuConstat(saisie),
    modeleProcesVerbal: modeleProcesVerbalCarence(saisie.motif),
    regime,
    suites: suitesProposees({ regime, objetDesignationSyndic: saisie.objetDesignationSyndic, motif: saisie.motif }),
  }
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
 * Refus : régime de la carence hors des trois (donnée lue sans contrôle).
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
  const regime = controlerRegime(carence.regime)
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
        regime === 'ap47' ? `demander d’abord ${PROROGATION_AP47} (à confirmer)` : 'demander d’abord la prorogation de la mission'
      }.`,
      fondement,
      aConfirmer: regime === 'ap47',
    })
  return anomalies
}
