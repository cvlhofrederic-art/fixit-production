import {
  ajouterJours,
  ajouterMois,
  estDateIsoValide,
  estJourOuvrable,
  messagePlausibilite,
  plausibiliteDate,
  verifierAujourdhui,
  type PlausibiliteDate,
} from '@/lib/administrateur-judiciaire/domain/dates'
import {
  PHASE_SINISTRE,
  TYPE_SINISTRE,
  type PhaseSinistre,
  type StatutSinistre,
  type TypeSinistre,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Sinistres d'une copropriété (cartographie Gestéam, tranches 20 et 28). Fonctions pures, dates ISO (AAAA-MM-JJ),
 * montants en CENTIMES ENTIERS, sans écran.
 *
 * Gestéam — fiche : dossier, n°, survenance, phase ; immeuble, mandat, bail ; compagnie, courtier, contrat (chacun avec
 * son n°) ; type, parties communes lésées / responsables, origine, lieu, dommages, causes supprimées, réparations faites ;
 * indemnité immédiate et différée (chacune « réglée ») ; parties (entreprises / immeubles, personnes), carnet
 * d'entretien ; suivi : déclaration, expertise (date et heure), rapport, règlement, forclusion, clôture ; notes ;
 * responsable, assistant ; Web. Les champs ajoutés le 06/11/2026 (ChampsFicheGesteamSinistre) sont optionnels à la
 * saisie. Contrôles de cohérence de la fiche entière, suggestion de forclusion : domain/fiche-sinistre.
 * Type, phase et statut : référentiels complets TYPE_SINISTRE, PHASE_SINISTRE et STATUT_SINISTRE (tranche 20). La phase
 * Gestéam est SAISIE (où en est le traitement) ; l'étape de suivi, elle, se déduit des dates : deux axes, à ne pas
 * fusionner.
 *
 * Repères de délais (C. assur.) : INDICATIFS. La déclaration se fait dans le délai du contrat, qui ne peut être
 * inférieur à 5 jours ouvrés (2 pour le vol) depuis la connaissance du sinistre (art. L. 113-2) ; l'action se prescrit
 * par deux ans depuis l'événement (art. L. 114-1), délai interrompu ou reporté selon l'art. L. 114-2. Le contrat et
 * les faits du dossier priment : ces dates ne sont jamais présentées comme des échéances certaines.
 * 🔴 À confirmer sur Légifrance avant d'en faire des échéances au calendrier réglementaire. (L. 114-1 relu sur
 * Légifrance le 06/11/2026, version en vigueur depuis le 30/12/2021 : voir suggestionForclusion.)
 */

export interface AssuranceSinistre {
  compagnie: string | null
  courtier: string | null
  /** N° du contrat (police), recopié du contrat d'assurance choisi ou saisi (gabarits de courrier). */
  contrat: string | null
  /** N° compagnie : référence du sinistre chez l'assureur. */
  numeroSinistre: string | null
  /** Fiche de la compagnie dans l'annuaire ; null ou absent = saisie libre. */
  compagnieId?: string | null
  /** Fiche du courtier dans l'annuaire ; null ou absent = saisie libre. */
  courtierId?: string | null
  /** N° courtier : référence du sinistre chez le courtier. */
  numeroCourtier?: string | null
  /** Contrat d'assurance du mandat choisi dans la liste (« Assurance => , compagnie (n°) ») ; null ou absent = aucun. */
  contratId?: string | null
}

/**
 * Rôle d'une partie (grilles « Entreprises / Imm. » et « Personnes » de la fiche) : « Lésé » 🟢 observé (tranche 43,
 * § 5) ; « Responsable » et « Autre » 🔵 déduits (la fiche distingue lésés et responsables pour les parties communes).
 */
export const ROLES_PARTIE_SINISTRE = ['Lésé', 'Responsable', 'Autre'] as const
export type RolePartieSinistre = (typeof ROLES_PARTIE_SINISTRE)[number]

/** Nature de la partie : entreprise ou immeuble (grille « Entreprises / Imm. »), personne (grille « Personnes »). */
export const NATURES_PARTIE_SINISTRE = ['Entreprise', 'Immeuble', 'Personne'] as const
export type NaturePartieSinistre = (typeof NATURES_PARTIE_SINISTRE)[number]

export interface PartieSinistre {
  role: RolePartieSinistre
  nature: NaturePartieSinistre
  /** Fiche de l'annuaire (prestataire, copropriété, copropriétaire) ; null = saisie libre. */
  refId: string | null
  libelle: string
}

/** Responsable ou assistant du dossier : collaborateur de l'annuaire, ou saisie libre (id null). */
export interface IntervenantSinistre {
  id: string | null
  nom: string
}

/**
 * Champs de la fiche Gestéam ajoutés le 06/11/2026 (tranches 28, 42, 43) : OPTIONNELS à la saisie (les saisies
 * antérieures restent valides), toujours présents sur la fiche (valeurs par défaut posées par creerSinistre).
 */
export interface ChampsFicheGesteamSinistre {
  /** N° Gestéam : code du mandat + « . » + rang sur 5 chiffres (🔵 proposé par proposerNumeroSinistre, modifiable). */
  numero: string | null
  /** Dossier : date d'ouverture, distincte de la survenance (tranche 42). */
  dateOuverture: string | null
  mandatId: string | null
  /** Bail (gérance, hors périmètre VitFix) : saisie libre. */
  bail: string | null
  /** Heure du rendez-vous d'expertise (HH:MM). */
  heureExpertise: string | null
  /**
   * Forclusion : saisie à la main dans Gestéam, jamais calculée (tranche 43, § 5). VitFix ne la remplit jamais d'office :
   * suggestionForclusion (domain/fiche-sinistre) ne fait qu'une suggestion 🔵 à confirmer.
   */
  dateForclusion: string | null
  parties: PartieSinistre[]
  carnetEntretien: boolean
  /** Web (w-oui / w-non) : fiche publiée sur l'extranet 🔵. */
  publieExtranet: boolean
  notes: string
  responsable: IntervenantSinistre | null
  assistant: IntervenantSinistre | null
}

export interface SaisieSinistre extends Partial<ChampsFicheGesteamSinistre> {
  coproprieteId: string
  type: TypeSinistre
  /** Phase de traitement Gestéam, saisie ; null si non précisée. */
  phase: PhaseSinistre | null
  dateSurvenance: string
  /** Connaissance du sinistre par l'assuré, si postérieure à la survenance ; null = survenance. */
  dateConnaissance: string | null
  dateDeclaration: string | null
  dateExpertise: string | null
  dateRapport: string | null
  dateReglement: string | null
  dateCloture: string | null
  partiesCommunesLesees: boolean
  partiesCommunesResponsables: boolean
  origine: string
  lieu: string
  dommages: string
  assurance: AssuranceSinistre
  indemniteImmediateCentimes: number
  indemniteImmediateReglee: boolean
  indemniteDiffereeCentimes: number
  indemniteDiffereeReglee: boolean
  causesSupprimees: boolean
  reparationsFaites: boolean
}

export interface FicheSinistre
  extends Omit<SaisieSinistre, keyof ChampsFicheGesteamSinistre | 'dateConnaissance' | 'assurance'>,
    ChampsFicheGesteamSinistre {
  dateConnaissance: string
  assurance: Required<AssuranceSinistre>
}

const DATES_SUIVI = ['dateDeclaration', 'dateExpertise', 'dateRapport', 'dateReglement', 'dateCloture'] as const

/** Heure « HH:MM » sur 24 heures. */
const REGEX_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/

const erreurDate = (champ: string, valeur: string | null | undefined): string | null =>
  valeur !== null && valeur !== undefined && !estDateIsoValide(valeur)
    ? `Date invalide pour ${champ} (${valeur}) : AAAA-MM-JJ attendu.`
    : null

const erreurCentimes = (champ: string, montant: number): string | null =>
  !Number.isInteger(montant) || montant < 0
    ? `Montant invalide pour ${champ} (${montant}) : centimes entiers positifs attendus.`
    : null

const nettoyer = (texte: string): string => texte.replace(/\s+/g, ' ').trim()

/** Texte nettoyé, null s'il est vide ou absent. */
const texteOuNull = (texte: string | null | undefined): string | null => (texte ? nettoyer(texte) || null : null)

function erreursPartie(partie: PartieSinistre, rang: number): string[] {
  const erreurs: string[] = []
  if (!(ROLES_PARTIE_SINISTRE as readonly string[]).includes(partie.role))
    erreurs.push(`Rôle de partie inconnu (partie ${rang}) : « ${partie.role} ».`)
  if (!(NATURES_PARTIE_SINISTRE as readonly string[]).includes(partie.nature))
    erreurs.push(`Nature de partie inconnue (partie ${rang}) : « ${partie.nature} ».`)
  if (!nettoyer(partie.libelle ?? '')) erreurs.push(`Partie ${rang} sans nom.`)
  return erreurs
}

/** Erreurs de format des champs de la fiche Gestéam (optionnels). */
function erreursChampsGesteam(saisie: SaisieSinistre): string[] {
  const erreurs = [erreurDate('dateOuverture', saisie.dateOuverture), erreurDate('dateForclusion', saisie.dateForclusion)]
  const heure = saisie.heureExpertise
  if (heure !== null && heure !== undefined && !REGEX_HEURE.test(heure))
    erreurs.push(`Heure d'expertise invalide (${heure}) : HH:MM attendu.`)
  return [
    ...erreurs.filter((erreur): erreur is string => erreur !== null),
    ...(saisie.parties ?? []).flatMap((partie, index) => erreursPartie(partie, index + 1)),
  ]
}

/**
 * Erreurs de format d'une saisie, dans l'ordre des contrôles (liste vide : saisie valide). Ne lève jamais :
 * creerSinistre lève la première.
 */
export function erreursSaisieSinistre(saisie: SaisieSinistre): string[] {
  const erreurs: (string | null)[] = [
    (TYPE_SINISTRE as readonly string[]).includes(saisie.type) ? null : `Type de sinistre inconnu : « ${saisie.type} ».`,
    saisie.phase !== null && !(PHASE_SINISTRE as readonly string[]).includes(saisie.phase)
      ? `Phase de sinistre inconnue : « ${saisie.phase} ».`
      : null,
    estDateIsoValide(saisie.dateSurvenance)
      ? null
      : `Date de survenance invalide (${saisie.dateSurvenance}) : AAAA-MM-JJ attendu.`,
    erreurDate('dateConnaissance', saisie.dateConnaissance),
    ...DATES_SUIVI.map((champ) => erreurDate(champ, saisie[champ])),
    erreurCentimes('indemniteImmediateCentimes', saisie.indemniteImmediateCentimes),
    erreurCentimes('indemniteDiffereeCentimes', saisie.indemniteDiffereeCentimes),
  ]
  return [...erreurs.filter((erreur): erreur is string => erreur !== null), ...erreursChampsGesteam(saisie)]
}

const intervenantNettoye = (valeur: IntervenantSinistre | null | undefined): IntervenantSinistre | null => {
  const nom = valeur ? nettoyer(valeur.nom ?? '') : ''
  return valeur && nom ? { id: valeur.id ?? null, nom } : null
}

const assuranceComplete = (assurance: AssuranceSinistre): Required<AssuranceSinistre> => ({
  ...assurance,
  compagnieId: assurance.compagnieId ?? null,
  courtierId: assurance.courtierId ?? null,
  numeroCourtier: texteOuNull(assurance.numeroCourtier),
  contratId: assurance.contratId ?? null,
})

/** Champs de la fiche Gestéam nettoyés ; valeurs par défaut pour ceux qui ne sont pas saisis. */
const champsGesteam = (saisie: SaisieSinistre): ChampsFicheGesteamSinistre => ({
  numero: texteOuNull(saisie.numero),
  dateOuverture: saisie.dateOuverture ?? null,
  mandatId: saisie.mandatId ?? null,
  bail: texteOuNull(saisie.bail),
  heureExpertise: saisie.heureExpertise ?? null,
  dateForclusion: saisie.dateForclusion ?? null,
  parties: (saisie.parties ?? []).map((partie) => ({ ...partie, libelle: nettoyer(partie.libelle) })),
  carnetEntretien: saisie.carnetEntretien ?? false,
  publieExtranet: saisie.publieExtranet ?? false,
  notes: (saisie.notes ?? '').trim(),
  responsable: intervenantNettoye(saisie.responsable),
  assistant: intervenantNettoye(saisie.assistant),
})

export function creerSinistre(saisie: SaisieSinistre): FicheSinistre {
  const [premiereErreur] = erreursSaisieSinistre(saisie)
  if (premiereErreur) throw new Error(premiereErreur)
  return {
    ...saisie,
    ...champsGesteam(saisie),
    assurance: assuranceComplete(saisie.assurance),
    dateConnaissance: saisie.dateConnaissance ?? saisie.dateSurvenance,
    origine: nettoyer(saisie.origine),
    lieu: nettoyer(saisie.lieu),
    dommages: nettoyer(saisie.dommages),
  }
}

export type EtapeSuiviSinistre = 'a_declarer' | 'declare' | 'expertise' | 'rapport' | 'regle' | 'clos'

/** Étape de suivi lue sur la date la plus avancée renseignée (distincte de la phase Gestéam saisie). */
export function etapeSuiviSinistre(sinistre: FicheSinistre): EtapeSuiviSinistre {
  if (sinistre.dateCloture) return 'clos'
  if (sinistre.dateReglement) return 'regle'
  if (sinistre.dateRapport) return 'rapport'
  if (sinistre.dateExpertise) return 'expertise'
  if (sinistre.dateDeclaration) return 'declare'
  return 'a_declarer'
}

/**
 * Phases Gestéam saisies qui suivent la déclaration à l'assureur. 🔵 Déduit de la chaîne « déclaration → expertise →
 * relances → indemnités » portée par la phase (tranche 20) ; « Accusé réception » : accusé de l'assureur, 🔴 à confirmer
 * (le type de document « Accusé réception de sinistre » figure dans la catégorie Assurances, tranche 18, mais aussi dans
 * la catégorie Copropriétaire, tranche 43 § 19, et la liste des phases le place avant « Déclaration »). « Général »
 * (valeur initiale), « Déclaration » (l'étape elle-même) et « Dommages Ouvrages » (un régime, pas une étape) n'en
 * disent rien. Axe saisi, distinct de etapeSuiviSinistre (dates) : il ne la remplace pas.
 */
export const PHASES_APRES_DECLARATION: readonly PhaseSinistre[] = [
  'Accusé réception',
  "Mission d'expertise",
  'Relances',
  'Complément de document',
  'Indemnités',
]

/** Phase saisie qui suit la déclaration (PHASES_APRES_DECLARATION), sinon null. */
export const phaseApresDeclaration = (sinistre: FicheSinistre): PhaseSinistre | null =>
  sinistre.phase !== null && PHASES_APRES_DECLARATION.includes(sinistre.phase) ? sinistre.phase : null

/**
 * Statut Gestéam (STATUT_SINISTRE) : « Terminé » dès que la clôture est datée. Seule source du statut, qui n'est jamais
 * stocké ; lit aussi une ligne partielle de la base (fiche 360).
 */
export const statutSinistre = (sinistre: { dateCloture?: string | null }): StatutSinistre =>
  sinistre.dateCloture ? 'Terminé' : 'En cours'

/** Dates du sinistre dans l'ordre de la fiche ; seul le rendez-vous d'expertise se fixe à l'avance. */
const DATES_PLAUSIBILITE = [
  { champ: 'dateSurvenance', datee: 'Survenance datée', futurAdmis: false },
  { champ: 'dateConnaissance', datee: 'Connaissance datée', futurAdmis: false },
  { champ: 'dateDeclaration', datee: 'Déclaration datée', futurAdmis: false },
  { champ: 'dateExpertise', datee: 'Expertise datée', futurAdmis: true },
  { champ: 'dateRapport', datee: 'Rapport daté', futurAdmis: false },
  { champ: 'dateReglement', datee: 'Règlement daté', futurAdmis: false },
  { champ: 'dateCloture', datee: 'Clôture datée', futurAdmis: false },
] as const

type ChampDateSinistre = (typeof DATES_PLAUSIBILITE)[number]['champ']

/** Libellé accordé de chaque date, pour les messages (« Rapport daté », « Clôture datée »). */
const DATEE = Object.fromEntries(DATES_PLAUSIBILITE.map((d) => [d.champ, d.datee])) as Record<ChampDateSinistre, string>

export interface AnomalieChronologie {
  champ: Exclude<ChampDateSinistre, 'dateSurvenance'>
  message: string
}

/** La connaissance suit la survenance ; chaque date de suivi suit la survenance, la connaissance et les étapes qui la précèdent. */
export function controlerChronologieSinistre(sinistre: FicheSinistre): AnomalieChronologie[] {
  const precedents: Record<AnomalieChronologie['champ'], (string | null)[]> = {
    dateConnaissance: [sinistre.dateSurvenance],
    dateDeclaration: [sinistre.dateSurvenance, sinistre.dateConnaissance],
    dateExpertise: [sinistre.dateSurvenance, sinistre.dateDeclaration],
    dateRapport: [sinistre.dateSurvenance, sinistre.dateExpertise],
    dateReglement: [sinistre.dateSurvenance, sinistre.dateDeclaration],
    dateCloture: [sinistre.dateSurvenance, sinistre.dateDeclaration, sinistre.dateExpertise, sinistre.dateRapport, sinistre.dateReglement],
  }
  const anomalies: AnomalieChronologie[] = []
  for (const champ of ['dateConnaissance', ...DATES_SUIVI] as const) {
    const date = sinistre[champ]
    if (date && precedents[champ].some((avant) => avant !== null && date < avant))
      anomalies.push({ champ, message: `${DATEE[champ]} avant une étape qui doit la précéder.` })
  }
  return anomalies
}

export interface AnomalieDateSinistre {
  champ: ChampDateSinistre
  nature: PlausibiliteDate
  message: string
}

/**
 * Plausibilité des dates par rapport à `aujourdhui` (tranche 42) : un fait accompli n'est jamais daté après aujourd'hui,
 * une expertise pas au-delà de ANNEES_A_VENIR_MAX ans. Complète `controlerChronologieSinistre` (ordre). Signale, ne
 * refuse pas.
 */
export function controlerPlausibiliteDatesSinistre(sinistre: FicheSinistre, aujourdhui: string): AnomalieDateSinistre[] {
  verifierAujourdhui(aujourdhui)
  const anomalies: AnomalieDateSinistre[] = []
  for (const { champ, datee, futurAdmis } of DATES_PLAUSIBILITE) {
    const date = sinistre[champ]
    // Connaissance non saisie : creerSinistre la recopie depuis la survenance, déjà contrôlée.
    if (champ === 'dateConnaissance' && date === sinistre.dateSurvenance) continue
    const nature = date ? plausibiliteDate(date, aujourdhui, { futurAdmis }) : null
    if (date && nature) anomalies.push({ champ, nature, message: messagePlausibilite(datee, date, nature) })
  }
  return anomalies
}

export interface IndemnitesSinistre {
  totalCentimes: number
  regleCentimes: number
  resteCentimes: number
}

export function indemnitesSinistre(sinistre: FicheSinistre): IndemnitesSinistre {
  const totalCentimes = sinistre.indemniteImmediateCentimes + sinistre.indemniteDiffereeCentimes
  const regleCentimes =
    (sinistre.indemniteImmediateReglee ? sinistre.indemniteImmediateCentimes : 0) +
    (sinistre.indemniteDiffereeReglee ? sinistre.indemniteDiffereeCentimes : 0)
  return { totalCentimes, regleCentimes, resteCentimes: totalCentimes - regleCentimes }
}

/** Ajoute des jours ouvrés (ni samedi, ni dimanche, ni jour férié). */
const ajouterJoursOuvres = (dateIso: string, jours: number): string => {
  let date = dateIso
  for (let compte = 0; compte < jours; ) {
    date = ajouterJours(date, 1)
    if (estJourOuvrable(date)) compte++
  }
  return date
}

export interface ReperesDelaisSinistre {
  delaiDeclarationJoursOuvres: number
  declarationAuPlusTard: string
  /** Déclaration faite après le repère ; false si non encore déclarée. */
  declarationTardive: boolean
  prescription: string
  fondements: string[]
  avertissement: string
}

/** Repères indicatifs de déclaration et de prescription (voir l'en-tête du module). */
export function reperesDelaisSinistre(
  sinistre: FicheSinistre,
  { delaiContratJoursOuvres }: { delaiContratJoursOuvres?: number } = {},
): ReperesDelaisSinistre {
  const minimumLegal = sinistre.type === 'Vol' ? 2 : 5
  const delaiDeclarationJoursOuvres = Math.max(minimumLegal, delaiContratJoursOuvres ?? 0)
  const declarationAuPlusTard = ajouterJoursOuvres(sinistre.dateConnaissance, delaiDeclarationJoursOuvres)
  return {
    delaiDeclarationJoursOuvres,
    declarationAuPlusTard,
    declarationTardive: sinistre.dateDeclaration !== null && sinistre.dateDeclaration > declarationAuPlusTard,
    prescription: ajouterMois(sinistre.dateSurvenance, 24),
    fondements: ['C. assur. art. L. 113-2', 'C. assur. art. L. 114-1'],
    avertissement:
      "Repère indicatif : le contrat fixe le délai de déclaration et la prescription peut être interrompue (C. assur. art. L. 114-2). Vérifier le contrat et le dossier.",
  }
}
