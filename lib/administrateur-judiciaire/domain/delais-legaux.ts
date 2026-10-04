import {
  ajouterJours,
  ajouterMois,
  ecartJours,
  estDateIsoValide,
  reporterAuJourOuvrable,
  type OptionsJoursFeries,
} from '@/lib/administrateur-judiciaire/domain/dates'
import { citerFondement, type ReferenceTexte, type Regime } from '@/lib/administrateur-judiciaire/domain/fondements'

/**
 * Moteur des délais légaux des mandats judiciaires (L. 1965, D. 1967, CPC).
 * Toutes les dates sont des chaînes ISO « AAAA-MM-JJ » calculées en UTC (voir dates.ts).
 * Les identifiants de règle servent de clés ailleurs (règles accomplies de démonstration, veille Fixy, services
 * responsables) et les notes juridiques sont reprises au caractère près : ne rien modifier.
 */

export type UniteDelai = 'jours' | 'mois'
export type SensDelai = 'apres' | 'avant'

export interface Delai {
  valeur: number
  unite: UniteDelai
  sens?: SensDelai
}

/**
 * Applique un délai à une date ISO. Le drapeau `lendemain` ne joue que pour les mois : pour les jours,
 * départ + n tombe déjà sur le jour de décompte.
 */
export function appliquerDelai(dateIso: string, delai: Delai, lendemain = false): string {
  if (delai.unite === 'jours') return ajouterJours(dateIso, delai.valeur)
  const depart = lendemain ? ajouterJours(dateIso, 1) : dateIso
  return ajouterMois(depart, delai.valeur)
}

/** Retranche un délai (ex. convocation de l'AG deux mois avant la fin de mission). */
export function retrancherDelai(dateIso: string, delai: Delai): string {
  return delai.unite === 'jours' ? ajouterJours(dateIso, -delai.valeur) : ajouterMois(dateIso, -delai.valeur)
}

export interface DescriptionEvenementDepart {
  libelle: string
  aide: string
}

/** Points de départ des délais. */
export const EVENEMENTS_DEPART = {
  ordonnance: {
    libelle: "le prononcé de l'ordonnance",
    aide: 'Date de la décision de désignation.',
  },
  finMission: {
    libelle: 'la fin de la mission',
    aide: "Date fixée par l'ordonnance, ou date de l'ordonnance + durée.",
  },
  notificationOrdonnance: {
    libelle: "la notification de l'ordonnance",
    aide: "Date de transmission de l'avis électronique (D. 1967 art. 64) ou de première présentation de la lettre recommandée. Le délai court du lendemain.",
  },
  publicationOrdonnance: {
    libelle: "la publication de l'ordonnance (avis au BODACC)",
    aide: "Date de parution de l'avis prévu par D. 1967 art. 62-17.",
  },
  publicationListeCreances: {
    libelle: 'la publication de la liste des créances',
    aide: 'L. 1965 art. 29-4 II.',
  },
  envoiProjetEcheancier: {
    libelle: "l'envoi de la notification du projet d'échéancier",
    aide: "Date d'envoi de la lettre de notification aux créanciers.",
  },
  notificationPlanDefinitif: {
    libelle: "la notification du plan d'apurement définitif",
    aide: 'Notification aux créanciers et au conseil syndical (L. 1965 art. 29-5 II).',
  },
  cessationAncienSyndic: {
    libelle: "la cessation des fonctions de l'ancien syndic",
    aide: "Pour l'art. 29-1, le mandat du syndic en place cesse de plein droit à la désignation.",
  },
} satisfies Record<string, DescriptionEvenementDepart>

export type EvenementDepart = keyof typeof EVENEMENTS_DEPART

export const refLoi1965 = (article: string): ReferenceTexte => ({
  texte: 'L1965',
  article,
})

export const refDecret1967 = (article: string): ReferenceTexte => ({
  texte: 'D1967',
  article,
})

export const delaiMois = (valeur: number, sens: SensDelai = 'apres'): Delai => ({
  valeur,
  unite: 'mois',
  sens,
})

export const delaiJours = (valeur: number, sens: SensDelai = 'apres'): Delai => ({
  valeur,
  unite: 'jours',
  sens,
})

export const NOTE_REMISE_ANCIEN_SYNDIC =
  "Obligation de l'ancien syndic. Après mise en demeure restée infructueuse, référé devant le président du tribunal judiciaire pour obtenir la remise sous astreinte (L. 1965 art. 18-2). Pour l'administrateur provisoire de l'art. 29-1, le décret rend l'ancien syndic débiteur des mêmes obligations."

export type NatureRegle = 'obligation' | 'fenetre_tiers' | 'repere' | 'effet' | 'obligation_tiers'
export type CertitudeRegle = 'TEXTE' | 'A_CONFIRMER' | 'SOURCE_SECONDAIRE'
/** Délais laissés à l'ordonnance (pas de délai légal par défaut). */
export type CleDelaiOrdonnance = 'remiseDocuments' | 'convocationAG'
export type ReponseCondition = 'oui' | 'non' | 'inconnu'
export type ModeSaisine = 'requete' | 'procedure_acceleree_au_fond'

/** Délai reporté de l'ordonnance : une date précise, ou un délai à compter du point de départ. */
export type DelaiOrdonnance = { date: string } | { delai: Delai }

/** Données d'un mandat nécessaires au calcul des échéances (dates ISO « AAAA-MM-JJ »). */
export interface ContexteMandat {
  regime: Regime
  dateOrdonnance: string
  dureeMissionMois?: number | null
  dateFinMission?: string | null
  evenements?: Partial<Record<EvenementDepart, string | null>>
  delaisOrdonnance?: Partial<Record<CleDelaiOrdonnance, DelaiOrdonnance>>
  /** Durée totale de la suspension d'exigibilité si elle a été prorogée (art. 29-3 II). */
  suspensionProrogeeJusquAMois?: number | null
  rapportMandataireAdHocAnneePrecedente?: boolean | null
  modeSaisine?: ModeSaisine | null
  /** Identifiants des règles déjà accomplies. */
  accomplies?: string[]
}

export interface ConditionRegle {
  libelle: string
  evaluer: (contexte: ContexteMandat) => ReponseCondition
}

export interface RegleDelaiLegal {
  id: string
  regimes: Regime[]
  libelle: string
  nature: NatureRegle
  fondements: ReferenceTexte[]
  depart: EvenementDepart
  delai?: Delai
  delaiOrdonnance?: CleDelaiOrdonnance
  lendemain?: boolean
  certitude: CertitudeRegle
  note: string
  condition?: ConditionRegle
}

export const REGLES_DELAIS_LEGAUX: RegleDelaiLegal[] = [
  {
    id: 'notification-ordonnance-46-47',
    regimes: ['sj', 'ap47'],
    libelle: "Notifier l'ordonnance à tous les copropriétaires",
    nature: 'obligation',
    fondements: [refDecret1967('59, dernier al.')],
    depart: 'ordonnance',
    delai: delaiMois(1),
    certitude: 'TEXTE',
    note: "Dans le mois du prononcé, par le syndic ou l'administrateur provisoire désigné (cas des art. 46 à 48). Forme : voie électronique par principe, lettre recommandée AR par exception (D. 1967 art. 64 et s., réécrits par le décret n° 2025-1292 du 22 décembre 2025). L'art. 64 régit la forme, pas le délai.",
  },
  {
    id: 'refere-coproprietaires-46-47',
    regimes: ['sj', 'ap47'],
    libelle: 'Fin du délai ouvert aux copropriétaires pour en référer au président du tribunal judiciaire',
    nature: 'fenetre_tiers',
    fondements: [refDecret1967('59, dernier al.')],
    depart: 'notificationOrdonnance',
    delai: delaiJours(15),
    lendemain: true,
    certitude: 'TEXTE',
    note: 'Quinze jours à compter de la notification. Report au premier jour ouvrable (CPC art. 642).',
  },
  {
    id: 'compte-separe-sj',
    regimes: ['sj'],
    libelle: 'Ouvrir le compte bancaire séparé au nom du syndicat',
    nature: 'obligation',
    fondements: [refLoi1965('18, II'), refDecret1967('46')],
    depart: 'ordonnance',
    delai: delaiMois(3),
    certitude: 'A_CONFIRMER',
    note: "Sanction : nullité de plein droit du mandat à l'expiration du délai de trois mois suivant la désignation (L. 1965 art. 18 II). Application au syndic désigné en justice déduite du renvoi de l'art. 46 aux art. 18 à 18-2 ; point de départ (prononcé ou notification) à confirmer.",
  },
  {
    id: 'convocation-ag-sj',
    regimes: ['sj'],
    libelle: "Convoquer l'assemblée générale en vue de la désignation d'un syndic",
    nature: 'obligation',
    fondements: [refDecret1967('46')],
    depart: 'finMission',
    delai: delaiMois(2, 'avant'),
    certitude: 'TEXTE',
    note: "« Il doit notamment convoquer l'assemblée générale en vue de la désignation d'un syndic deux mois avant la fin de ses fonctions. » La mission cesse de plein droit à l'acceptation de son mandat par le syndic désigné par l'assemblée. Convocation notifiée au moins 21 jours avant la réunion, sauf urgence (D. 1967 art. 9).",
  },
  {
    id: 'fin-mission-sj',
    regimes: ['sj'],
    libelle: "Fin de la mission fixée par l'ordonnance",
    nature: 'repere',
    fondements: [refDecret1967('46')],
    depart: 'finMission',
    delai: delaiJours(0),
    certitude: 'TEXTE',
    note: "Durée fixée par l'ordonnance ; elle peut être prorogée, et il peut être mis fin à la mission, suivant la même procédure (requête).",
  },
  {
    id: 'remise-documents-ap47',
    regimes: ['ap47'],
    libelle:
      'Se faire remettre les références des comptes bancaires, les coordonnées de la banque, les documents et archives du syndicat',
    nature: 'obligation',
    fondements: [refDecret1967('47')],
    depart: 'ordonnance',
    delaiOrdonnance: 'remiseDocuments',
    certitude: 'TEXTE',
    note: "« Dans les délais fixés par l'ordonnance » : pas de délai légal par défaut. Reporter le délai de l'ordonnance.",
  },
  {
    id: 'convocation-ag-ap47',
    regimes: ['ap47'],
    libelle: "Convoquer l'assemblée en vue de la désignation d'un syndic",
    nature: 'obligation',
    fondements: [refDecret1967('47'), refDecret1967('9')],
    depart: 'ordonnance',
    delaiOrdonnance: 'convocationAG',
    certitude: 'TEXTE',
    note: "Délai fixé par l'ordonnance, convocation dans les conditions de l'art. 9. Les fonctions cessent de plein droit à l'acceptation de son mandat par le syndic désigné par l'assemblée.",
  },
  {
    id: 'fin-mission-ap47',
    regimes: ['ap47'],
    libelle: "Fin de la mission fixée par l'ordonnance",
    nature: 'repere',
    fondements: [refDecret1967('47')],
    depart: 'finMission',
    delai: delaiJours(0),
    certitude: 'TEXTE',
    note: "La mission prend fin à la date prévue par l'ordonnance : pas de prorogation de fait (Cass. 3e civ., 14 janv. 2016, n° 14-24.989).",
  },
  {
    id: 'information-coproprietaires-ap291',
    regimes: ['ap291'],
    libelle: 'Porter la décision de désignation à la connaissance des copropriétaires',
    nature: 'obligation',
    fondements: [refDecret1967('62-5')],
    depart: 'ordonnance',
    delai: delaiMois(1),
    certitude: 'TEXTE',
    note: "Dans le mois du prononcé, à l'initiative de l'administrateur provisoire : remise contre émargement, lettre recommandée AR ou voie électronique. Pour une ordonnance sur requête, la communication indique que tout intéressé peut en référer au juge dans les deux mois de la publication (Cass. 3e civ., 7 déc. 2022, n° 21-20.264).",
  },
  {
    id: 'publicite-creanciers-ap291',
    regimes: ['ap291'],
    libelle: "Procéder aux mesures de publicité à l'égard des créanciers (avis au BODACC)",
    nature: 'obligation',
    fondements: [refLoi1965('29-4, I'), refDecret1967('62-17')],
    depart: 'ordonnance',
    delai: delaiMois(2),
    certitude: 'SOURCE_SECONDAIRE',
    note: "« Dans un délai de deux mois à compter de sa nomination » (texte cité en jurisprudence ; version consolidée à relire). L'avis indique le délai de déclaration des créances et la durée de la suspension d'exigibilité ; les créanciers connus sont informés par tout moyen.",
  },
  {
    id: 'rapport-intermediaire-ap291',
    regimes: ['ap291'],
    libelle: 'Rendre le rapport intermédiaire (mesures de redressement financier)',
    nature: 'obligation',
    fondements: [refLoi1965('29-1, I')],
    depart: 'ordonnance',
    delai: delaiMois(6),
    certitude: 'TEXTE',
    note: "« Au plus tard à l'issue des six premiers mois de sa mission ». Le fondement est l'art. 29-1 : l'art. 29-1 B, cité par la maquette, concerne le rapport du mandataire ad hoc.",
    condition: {
      libelle: "Dû si aucun rapport de mandataire ad hoc (art. 29-1 B) n'a été établi au cours de l'année précédente",
      evaluer: (contexte) =>
        contexte.rapportMandataireAdHocAnneePrecedente === true
          ? 'non'
          : contexte.rapportMandataireAdHocAnneePrecedente === false
            ? 'oui'
            : 'inconnu',
    },
  },
  {
    id: 'fin-suspension-exigibilite-ap291',
    regimes: ['ap291'],
    libelle: "Fin de la suspension de l'exigibilité des créances antérieures",
    nature: 'effet',
    fondements: [refLoi1965('29-3, I et II')],
    depart: 'ordonnance',
    delai: delaiMois(12),
    certitude: 'TEXTE',
    note: "Créances autres que publiques et sociales, nées avant la décision. Prorogation possible jusqu'à trente mois à la demande de l'administrateur provisoire (art. 29-3 II), avec la même publicité. Maintien tant que le plan d'apurement homologué est respecté (art. 29-5 III).",
  },
  {
    id: 'fin-mission-ap291',
    regimes: ['ap291'],
    libelle: 'Fin de la mission fixée par la décision',
    nature: 'repere',
    fondements: [refLoi1965('29-1, I')],
    depart: 'finMission',
    delai: delaiJours(0),
    certitude: 'TEXTE',
    note: 'Durée qui ne peut être inférieure à douze mois. Le président du tribunal judiciaire peut à tout moment modifier la mission, la prolonger ou y mettre fin.',
  },
  {
    id: 'refere-ordonnance-requete-ap291',
    regimes: ['ap291'],
    libelle: "Fin du délai pour en référer au juge ayant rendu l'ordonnance sur requête",
    nature: 'fenetre_tiers',
    fondements: [refDecret1967('62-5')],
    depart: 'publicationOrdonnance',
    delai: delaiMois(2),
    certitude: 'TEXTE',
    note: "Ouvert à tout intéressé. Si la décision est un jugement rendu selon la procédure accélérée au fond, ce délai ne s'applique pas (CPC art. 481-1).",
    condition: {
      libelle: "Applicable si la désignation résulte d'une ordonnance sur requête",
      evaluer: (contexte) =>
        contexte.modeSaisine === 'requete'
          ? 'oui'
          : contexte.modeSaisine === 'procedure_acceleree_au_fond'
            ? 'non'
            : 'inconnu',
    },
  },
  {
    id: 'declaration-creances-ap291',
    regimes: ['ap291'],
    libelle: 'Fin du délai de déclaration des créances',
    nature: 'fenetre_tiers',
    fondements: [refLoi1965('29-4, II'), refDecret1967('62-18')],
    depart: 'publicationOrdonnance',
    delai: delaiMois(3),
    certitude: 'TEXTE',
    note: "Trois mois à compter de la publication prévue à l'art. 62-17. Créances non déclarées dans le délai : inopposables à la procédure (L. 1965 art. 29-4 III).",
  },
  {
    id: 'releve-forclusion-ap291',
    regimes: ['ap291'],
    libelle: "Fin du délai de l'action en relevé de forclusion",
    nature: 'fenetre_tiers',
    fondements: [refLoi1965('29-4, III'), refDecret1967('62-18-1')],
    depart: 'publicationOrdonnance',
    delai: delaiMois(6),
    certitude: 'SOURCE_SECONDAIRE',
    note: "Ouverte au créancier qui établit que sa défaillance n'est pas due à son fait ; six mois à compter de l'avis de publication (décret n° 2018-11 du 8 janvier 2018).",
  },
  {
    id: 'contestation-liste-creances-ap291',
    regimes: ['ap291'],
    libelle: 'Fin du délai de contestation de la liste des créances',
    nature: 'fenetre_tiers',
    fondements: [refLoi1965('29-4, II')],
    depart: 'publicationListeCreances',
    delai: delaiMois(2),
    certitude: 'TEXTE',
    note: 'Contestation portée devant le président du tribunal judiciaire.',
  },
  {
    id: 'observations-echeancier-ap291',
    regimes: ['ap291'],
    libelle: "Fin du délai d'observations des créanciers sur le projet d'échéancier",
    nature: 'fenetre_tiers',
    fondements: [refLoi1965('29-5, II')],
    depart: 'envoiProjetEcheancier',
    delai: delaiMois(2),
    certitude: 'TEXTE',
    note: "Le délai court de la date d'envoi de la lettre de notification (décret de 1967, procédure d'apurement des dettes). Les créanciers peuvent proposer des remises de dettes. Plan d'une durée maximale de cinq ans (art. 29-5 I).",
  },
  {
    id: 'contestation-plan-ap291',
    regimes: ['ap291'],
    libelle: "Fin du délai de contestation du plan d'apurement définitif",
    nature: 'fenetre_tiers',
    fondements: [refLoi1965('29-5, II')],
    depart: 'notificationPlanDefinitif',
    delai: delaiMois(2),
    lendemain: true,
    certitude: 'A_CONFIRMER',
    note: "À défaut de contestation dans ce délai, le juge homologue le plan à la demande de l'administrateur provisoire. Point de départ retenu : lendemain de la notification (D. 1967 art. 64), lecture prudente à confirmer.",
  },
  {
    id: 'ancien-syndic-tresorerie',
    regimes: ['sj', 'ap47', 'ap291'],
    libelle:
      "Remise par l'ancien syndic de la situation de trésorerie, des références des comptes et des coordonnées de la banque",
    nature: 'obligation_tiers',
    fondements: [refLoi1965('18-2')],
    depart: 'cessationAncienSyndic',
    delai: delaiJours(15),
    certitude: 'TEXTE',
    note: NOTE_REMISE_ANCIEN_SYNDIC,
  },
  {
    id: 'ancien-syndic-archives',
    regimes: ['sj', 'ap47', 'ap291'],
    libelle: "Remise par l'ancien syndic des documents et archives du syndicat",
    nature: 'obligation_tiers',
    fondements: [refLoi1965('18-2')],
    depart: 'cessationAncienSyndic',
    delai: delaiMois(1),
    certitude: 'TEXTE',
    note: `Y compris les documents dématérialisés, dans un format téléchargeable et imprimable. ${NOTE_REMISE_ANCIEN_SYNDIC}`,
  },
  {
    id: 'ancien-syndic-etat-comptes',
    regimes: ['sj', 'ap47', 'ap291'],
    libelle:
      "Fourniture par l'ancien syndic de l'état des comptes des copropriétaires et du syndicat, après apurement et clôture",
    nature: 'obligation_tiers',
    fondements: [refLoi1965('18-2')],
    depart: 'cessationAncienSyndic',
    delai: delaiMois(3),
    certitude: 'A_CONFIRMER',
    note: "« Dans le délai de deux mois suivant l'expiration du délai mentionné ci-dessus » : calculé à partir du délai d'un mois (cessation + 3 mois). Lecture alternative à partir du délai de quinze jours : à trancher.",
  },
]

/** Date de fin de mission : date saisie si valide, sinon ordonnance + durée (en mois), sinon null. */
export function calculerDateFinMission(contexte: ContexteMandat): string | null {
  return contexte.dateFinMission && estDateIsoValide(contexte.dateFinMission)
    ? contexte.dateFinMission
    : contexte.dureeMissionMois && contexte.dureeMissionMois > 0
      ? ajouterMois(contexte.dateOrdonnance, contexte.dureeMissionMois)
      : null
}

export interface DateDepart {
  date: string | null
  parDefaut: boolean
}

/**
 * Date d'un point de départ. Cas particulier : sans date de cessation de l'ancien syndic en régime art. 29-1,
 * la date de l'ordonnance est retenue par défaut (le mandat du syndic cesse de plein droit à la désignation).
 */
export function resoudreDateDepart(contexte: ContexteMandat, evenement: EvenementDepart): DateDepart {
  if (evenement === 'ordonnance')
    return {
      date: contexte.dateOrdonnance,
      parDefaut: false,
    }
  if (evenement === 'finMission')
    return {
      date: calculerDateFinMission(contexte),
      parDefaut: false,
    }
  const date = contexte.evenements?.[evenement] ?? null
  return date && estDateIsoValide(date)
    ? {
        date,
        parDefaut: false,
      }
    : evenement === 'cessationAncienSyndic' && contexte.regime === 'ap291'
      ? {
          date: contexte.dateOrdonnance,
          parDefaut: true,
        }
      : {
          date: null,
          parDefaut: false,
        }
}

/**
 * Libellé du délai d'une règle : « 1 mois après le prononcé de l'ordonnance », « à la fin de la mission »,
 * « délai fixé par l'ordonnance, à compter de … ». « mois » est invariable ; « jour(s) » s'accorde.
 */
export function libelleDelaiRegle(regle: RegleDelaiLegal, contexte: ContexteMandat): string {
  const depart = EVENEMENTS_DEPART[regle.depart].libelle
  if (!regle.delai) return `délai fixé par l'ordonnance, à compter de ${depart}`
  const valeur =
    regle.id === 'fin-suspension-exigibilite-ap291' && contexte.suspensionProrogeeJusquAMois
      ? contexte.suspensionProrogeeJusquAMois
      : regle.delai.valeur
  if (valeur === 0) return `à ${depart}`
  const unite = regle.delai.unite === 'mois' ? 'mois' : valeur > 1 ? 'jours' : 'jour'
  return `${valeur} ${unite} ${regle.delai.sens === 'avant' ? 'avant' : 'après'} ${depart}`
}

/** Échéance d'un délai laissé à l'ordonnance : date saisie (si valide) ou délai appliqué au point de départ. */
export function appliquerDelaiOrdonnance(dateDepart: string, delai: DelaiOrdonnance | null | undefined): string | null {
  return delai ? ('date' in delai ? (estDateIsoValide(delai.date) ? delai.date : null) : appliquerDelai(dateDepart, delai.delai)) : null
}

export type StatutEcheance = 'CALCULEE' | 'NON_APPLICABLE' | 'EN_ATTENTE_EVENEMENT' | 'DELAI_A_SAISIR'

export interface DepartEcheance {
  evenement: EvenementDepart
  libelle: string
  date: string | null
  parDefaut: boolean
}

/** Échéance calculée par le moteur pour une règle. */
export interface EcheanceCalculee {
  regleId: string
  libelle: string
  nature: NatureRegle
  fondements: string[]
  certitude: CertitudeRegle
  statut: StatutEcheance
  depart: DepartEcheance
  delaiLibelle: string
  /** Date issue du seul calcul du délai. */
  dateLegale: string | null
  /** Date reportée au premier jour ouvrable (fenêtres des tiers), seulement si elle diffère de la date légale. */
  dateProrogee: string | null
  dateRetenue: string | null
  note: string
  aVerifier: string[]
  accomplie: boolean
}

/** Autre nom employé par les écrans. */
export type EcheanceLegale = EcheanceCalculee

export interface OptionsCalculEcheances extends OptionsJoursFeries {
  inclureNonApplicables?: boolean
}

/**
 * Calcule les échéances légales d'un mandat, triées par date retenue (les échéances sans date en dernier).
 * Lève une erreur si la date d'ordonnance est invalide. Seules les fenêtres ouvertes aux tiers sont reportées
 * au premier jour ouvrable (CPC art. 642).
 */
export function calculerEcheancesLegales(contexte: ContexteMandat, options: OptionsCalculEcheances = {}): EcheanceCalculee[] {
  if (!estDateIsoValide(contexte.dateOrdonnance))
    throw new Error(`Date d'ordonnance invalide : « ${contexte.dateOrdonnance} »`)
  const echeances: EcheanceCalculee[] = []
  for (const regle of REGLES_DELAIS_LEGAUX) {
    if (!regle.regimes.includes(contexte.regime)) continue
    const aVerifier: string[] = [],
      applicable = regle.condition ? regle.condition.evaluer(contexte) : 'oui'
    if (applicable === 'non' && !options.inclureNonApplicables) continue
    if (applicable === 'inconnu' && regle.condition) aVerifier.push(regle.condition.libelle)
    const { date: dateDepart, parDefaut } = resoudreDateDepart(contexte, regle.depart)
    if (parDefaut)
      aVerifier.push(`Point de départ par défaut : ${EVENEMENTS_DEPART[regle.depart].libelle} = date de l'ordonnance.`)
    let statut: StatutEcheance = applicable === 'non' ? 'NON_APPLICABLE' : 'CALCULEE',
      dateLegale: string | null = null
    if (statut === 'CALCULEE') {
      if (!dateDepart) statut = 'EN_ATTENTE_EVENEMENT'
      else if (regle.delaiOrdonnance) {
        dateLegale = appliquerDelaiOrdonnance(dateDepart, contexte.delaisOrdonnance?.[regle.delaiOrdonnance])
        if (!dateLegale) statut = 'DELAI_A_SAISIR'
      } else if (regle.delai) {
        const delai: Delai = {
          valeur:
            regle.id === 'fin-suspension-exigibilite-ap291' && contexte.suspensionProrogeeJusquAMois
              ? contexte.suspensionProrogeeJusquAMois
              : regle.delai.valeur,
          unite: regle.delai.unite,
        }
        dateLegale =
          regle.delai.sens === 'avant' ? retrancherDelai(dateDepart, delai) : appliquerDelai(dateDepart, delai, regle.lendemain)
      }
    }
    let dateProrogee: string | null = null,
      dateRetenue = dateLegale
    if (dateLegale && regle.nature === 'fenetre_tiers') {
      const dateOuvrable = reporterAuJourOuvrable(dateLegale, options)
      if (dateOuvrable !== dateLegale) dateProrogee = dateOuvrable
      dateRetenue = dateOuvrable
    }
    echeances.push({
      regleId: regle.id,
      libelle: regle.libelle,
      nature: regle.nature,
      fondements: regle.fondements.map(citerFondement),
      certitude: regle.certitude,
      statut,
      depart: {
        evenement: regle.depart,
        libelle: EVENEMENTS_DEPART[regle.depart].libelle,
        date: dateDepart,
        parDefaut,
      },
      delaiLibelle: libelleDelaiRegle(regle, contexte),
      dateLegale,
      dateProrogee,
      dateRetenue,
      note: regle.note,
      aVerifier,
      accomplie: !!contexte.accomplies?.includes(regle.id),
    })
  }
  return echeances.sort((a, b) =>
    a.dateRetenue && b.dateRetenue
      ? a.dateRetenue < b.dateRetenue
        ? -1
        : a.dateRetenue > b.dateRetenue
          ? 1
          : 0
      : a.dateRetenue
        ? -1
        : b.dateRetenue
          ? 1
          : 0,
  )
}

export interface AnomalieContexte {
  niveau: 'erreur' | 'alerte'
  message: string
}

/** Contrôle de cohérence des données du mandat. Une ordonnance invalide donne une seule erreur. */
export function controlerContexteMandat(contexte: ContexteMandat): AnomalieContexte[] {
  const anomalies: AnomalieContexte[] = []
  if (!estDateIsoValide(contexte.dateOrdonnance)) {
    anomalies.push({
      niveau: 'erreur',
      message: "Date d'ordonnance absente ou invalide.",
    })
    return anomalies
  }
  if (contexte.regime === 'ap291' && contexte.dureeMissionMois != null && contexte.dureeMissionMois < 12)
    anomalies.push({
      niveau: 'erreur',
      message: 'Durée de mission inférieure au minimum légal de douze mois (L. 1965 art. 29-1).',
    })
  if (contexte.dateFinMission && contexte.dureeMissionMois) {
    const finCalculee = ajouterMois(contexte.dateOrdonnance, contexte.dureeMissionMois)
    if (finCalculee !== contexte.dateFinMission)
      anomalies.push({
        niveau: 'alerte',
        message: `Fin de mission saisie (${contexte.dateFinMission}) différente de ordonnance + durée (${finCalculee}) : la date saisie est retenue.`,
      })
  }
  if (!calculerDateFinMission(contexte))
    anomalies.push({
      niveau: 'alerte',
      message: 'Durée de mission inconnue : les échéances liées à la fin de mission ne sont pas calculées.',
    })
  const suspension = contexte.suspensionProrogeeJusquAMois
  if (suspension != null && (suspension < 12 || suspension > 30))
    anomalies.push({
      niveau: 'erreur',
      message: "Suspension de l'exigibilité : durée totale entre 12 et 30 mois (L. 1965 art. 29-3).",
    })
  return anomalies
}

export type EtatEcheance = 'accomplie' | 'sans_date' | 'depassee' | 'aujourdhui' | 'imminente' | 'a_venir'

/** État d'une échéance à une date de référence ; « imminente » jusqu'à `horizonJours` jours (15 par défaut). */
export function calculerEtatEcheance(
  echeance: Pick<EcheanceCalculee, 'accomplie' | 'dateRetenue'>,
  referenceIso: string,
  horizonJours = 15,
): EtatEcheance {
  if (echeance.accomplie) return 'accomplie'
  if (!echeance.dateRetenue) return 'sans_date'
  const jours = ecartJours(referenceIso, echeance.dateRetenue)
  return jours < 0 ? 'depassee' : jours === 0 ? 'aujourdhui' : jours <= horizonJours ? 'imminente' : 'a_venir'
}
