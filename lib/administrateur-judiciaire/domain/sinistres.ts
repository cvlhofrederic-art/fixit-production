import {
  ajouterJoursOuvres,
  ajouterMois,
  dateIsoVersFr,
  estAnneeImprobable,
  estDateIsoValide,
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
 * Délais du code des assurances (DELAIS_ASSURANCE_SINISTRE). La déclaration se fait dès la connaissance du sinistre et
 * au plus tard dans le délai du contrat, qui ne peut être inférieur à 5 jours ouvrés (2 pour le vol) ; le contrat peut
 * seulement l'allonger (art. L. 113-2, 4°). L'action se prescrit par deux ans depuis l'événement (art. L. 114-1) ; la
 * prescription peut être interrompue (art. L. 114-2), mais le contrat ne peut pas en modifier la durée (art. L. 114-3).
 * 🟢 L. 113-2, L. 114-1 et L. 114-2 relus sur Légifrance le 17/11/2026 (L. 113-2 et L. 114-2 en vigueur depuis le
 * 01/04/2018, ordonnance n° 2017-1433 ; L. 114-1 depuis le 30/12/2021, loi n° 2021-1837 ; voir suggestionForclusion).
 * 🟢 L. 114-3 relu sur Légifrance le 17/11/2026 (en vigueur depuis le 19/06/2008, loi n° 2008-561) : les parties ne
 * peuvent, même d'un commun accord, modifier la durée de la prescription.
 * Décision J67, R49 de Hugo (17/11/2026) : ces dates deviennent des échéances du suivi « à faire ». Déclaration « au
 * plus tard » : connaissance + minimum légal ou délai du contrat s'il est plus long (déclarer avant est toujours dans les
 * temps) ; « Vandalisme » et « Bris de glace » restent à confirmer, un vol ayant pu y être rangé (volPossible : 2 jours
 * ouvrés s'il y a eu vol). Prescription « au plus tôt » : survenance + deux ans (son départ ne peut qu'être plus tard et
 * une interruption la repousse : agir avant est toujours sûr). Jours ouvrés lus du lundi au vendredi, hors jours
 * fériés (le texte ne les définit pas) ; leur ajout au calendrier réglementaire est un choix de Frédéric.
 * Relecture de R49 (sa contre-vérification n'a vu que le vol) : la garantie impayés (assurance crédit possible,
 * L. 111-1) et « Catastrophes naturelles » (délai propre) gardent un repère à confirmer, avec sa raison
 * (REGIMES_A_CONFIRMER) ; « Dommages Ouvrage » suit sa règle propre (J67, R52, ci-dessous) ; chaque date rend sa
 * justification (départ, durée, texte, date retenue).
 * Décisions de Hugo du 17/11/2026 (registre des décisions juridiques, J67) :
 * - J67, R50 : le décompte est confirmé : jours ouvrés comptés du lendemain de la connaissance, sans samedi, dimanche ni
 *   jour férié (L. 113-2, 4° dit « jours ouvrés » ; jour de départ exclu, CPC art. 641, al. 1, par analogie). Le
 *   rappel de R50 : RAPPEL_DECLARATION_DES_CONNAISSANCE (lu par declaration-sinistre.ts) : déclarer dès la connaissance,
 *   le repère étant le minimum légal du délai prévu au contrat, ou ce délai. Dans ce module, l'avertissement de
 *   reperesDelaisSinistre prend le texte de J67, R49, qui garde ce rappel : R49 fait de ces dates des échéances du suivi,
 *   plus des repères indicatifs.
 * - J67, R52 : dommages-ouvrage, aucun minimum de cinq jours ouvrés. Les clauses types (annexe II à l'art. A. 243-1, lue
 *   le 17/11/2026, en vigueur depuis le 01/04/2018) ne fixent aucun délai à l'assuré ; L. 242-1 ne fixe que ceux de
 *   l'assureur. Repère = jour de la connaissance (déclarer dès la connaissance, L. 113-2, 4°), sauf délai fixé par la
 *   police (delaiContratJoursOuvres) ; prescription de deux ans inchangée (L. 114-1). Sans délai, rien à dépasser : la
 *   déclaration n'est jamais « tardive » au regard du repère. suivi-a-faire.depuisSinistres suit.
 * - Année improbable (dates.estAnneeImprobable : avant 1900 ou après 2100, faute de frappe) : aucun repère ne se calcule
 *   depuis une survenance ou une connaissance ainsi datée (reperesDelaisSinistre rend null ; anneeImprobableDesReperes
 *   en donne le message). Depuis 9998, deux ans de prescription tombaient en l'an 10000, hors du calendrier ISO, et le
 *   formatage de la date levait pendant le rendu de la fiche.
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
  /**
   * Déclaration adressée au courtier : date de sa transmission à la compagnie (J67, R51), comparée au repère de
   * déclaration (declaration-sinistre.controlerDelaiDeclaration) ; null ou absent = inconnue.
   */
  transmisCompagnieLe?: string | null
  /** Le courtier gère les sinistres pour l'assureur, mandat vu (J67, R51) ; absent = non. */
  courtierMandateParAssureur?: boolean
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

/** J67, R51 : le mandat du courtier, s'il est donné, est oui ou non (champ de la fiche, option du contrôle du délai). */
export const erreurMandatCourtier = (valeur: unknown): string | null =>
  valeur !== undefined && typeof valeur !== 'boolean' ? `Mandat du courtier invalide (${String(valeur)}) : oui ou non attendu.` : null

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
    erreurDate('transmisCompagnieLe', saisie.assurance.transmisCompagnieLe),
    erreurMandatCourtier(saisie.assurance.courtierMandateParAssureur),
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
  transmisCompagnieLe: assurance.transmisCompagnieLe ?? null,
  courtierMandateParAssureur: assurance.courtierMandateParAssureur ?? false,
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

/**
 * Message de la première date de départ des repères (survenance, puis connaissance) d'une année improbable
 * (dates.estAnneeImprobable), ou null : les repères ne se calculent pas depuis une faute de frappe.
 */
export function anneeImprobableDesReperes(sinistre: Pick<FicheSinistre, 'dateSurvenance' | 'dateConnaissance'>): string | null {
  for (const champ of ['dateSurvenance', 'dateConnaissance'] as const)
    if (estAnneeImprobable(sinistre[champ])) return messagePlausibilite(DATEE[champ], sinistre[champ], 'annee_improbable')
  return null
}

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

/** Délais du code des assurances (relus le 17/11/2026). */
export const DELAIS_ASSURANCE_SINISTRE = {
  /** L. 113-2, 4° : le délai du contrat « ne peut être inférieur à cinq jours ouvrés ». */
  declarationMinimumJoursOuvres: 5,
  /** L. 113-2, 4° : délai ramené à deux jours ouvrés en cas de vol. */
  declarationVolJoursOuvres: 2,
  /** L. 114-1 : prescription par deux ans à compter de l'événement (L. 114-3 : durée non modifiable par contrat). */
  prescriptionMois: 24,
} as const

/**
 * Prescription des actions dérivant du contrat d'assurance : deux ans (C. assur. art. L. 114-1, al. 1). Seule durée du
 * domaine : le repère du suivi « à faire » (reperesDelaisSinistre) et la suggestion de forclusion (fiche-sinistre.ts) la
 * lisent ici (DELAIS_ASSURANCE_SINISTRE).
 */
export const PRESCRIPTION_MOIS = DELAIS_ASSURANCE_SINISTRE.prescriptionMois

/** Dommages-ouvrage : les clauses types ne fixent aucun délai de déclaration à l'assuré (J67, R52). */
const DOMMAGES_OUVRAGE: TypeSinistre = 'Dommages Ouvrage'

/**
 * Minimum du délai de déclaration prévu au contrat, en jours ouvrés (C. assur. art. L. 113-2, 4° : cinq, deux pour le
 * vol) ; dommages-ouvrage : aucun (J67, R52).
 */
const delaiMinimumJoursOuvres = (type: TypeSinistre): number => {
  if (type === DOMMAGES_OUVRAGE) return 0
  return type === 'Vol' ? DELAIS_ASSURANCE_SINISTRE.declarationVolJoursOuvres : DELAIS_ASSURANCE_SINISTRE.declarationMinimumJoursOuvres
}

/** Rappel du droit commun de la déclaration (J67, R50), repris par declaration-sinistre.ts. */
export const RAPPEL_DECLARATION_DES_CONNAISSANCE =
  "Déclarer dès la connaissance du sinistre ; le repère est le minimum légal du délai prévu au contrat (C. assur. art. L. 113-2, 4°), ou ce délai, s'il est saisi et plus long."

/**
 * Prescription « au plus tôt » (J67, R49), commune au droit commun et aux dommages-ouvrage (J67, R52 : même prescription
 * de deux ans) ; durée tirée de PRESCRIPTION_MOIS.
 */
const PHRASE_PRESCRIPTION = `Prescription au plus tôt ${PRESCRIPTION_MOIS} mois après l'événement (art. L. 114-1) : une interruption peut la repousser (art. L. 114-2) ; le contrat ne peut pas en changer la durée (art. L. 114-3).`

/** Droit commun (J67, R49) : déclarer dès la connaissance, au plus tard à la date retenue ; prescription au plus tôt. */
const AVERTISSEMENT_REPERES =
  "Déclarer dès la connaissance du sinistre. Déclaration au plus tard à la date retenue : délai du contrat s'il est saisi, sinon minimum légal (C. assur. art. L. 113-2, 4°), que le contrat peut seulement allonger. " +
  PHRASE_PRESCRIPTION

const AVERTISSEMENT_REPERES_DOMMAGES_OUVRAGE = `Dommages-ouvrage : déclarer dès la connaissance du sinistre (C. assur. art. L. 113-2, 4°) ; aucun délai dans les clauses types (C. assur. annexe II à l'art. A. 243-1), sauf délai fixé par la police. ${PHRASE_PRESCRIPTION}`

/** Types Gestéam sous lesquels un vol a pu être rangé (effraction, bris) : 2 jours ouvrés s'il y a eu vol (J67, R49). */
const TYPES_VOL_POSSIBLE: ReadonlySet<TypeSinistre> = new Set<TypeSinistre>(['Vandalisme', 'Bris de glace'])

/** Raison pour laquelle le code des assurances ne fixe pas sûrement la date ; null : il la fixe. */
interface RegimeAConfirmer {
  declaration: string
  prescription: string | null
}

/**
 * Garantie impayés (« Charges Impayées », « Loyers Impayés » : contentieux-assurance-impayes.TYPES_SINISTRE_IMPAYES) : une
 * opération d'assurance crédit échappe aux titres I à III du livre I (L. 111-1), donc à L. 113-2 et à L. 114-1 ; seule
 * la police fixe alors la déclaration et la prescription. Décision du 20/11/2026 (partie C, F51) : la police se lit ;
 * une fois remplis le délai qu'elle prévoit et le fait qui déclenche le sinistre, son repère, jamais une déchéance, est
 * contentieux-assurance-impayes.repereDeclarationImpayes. Le repère `aConfirmer` ci-dessous est gardé (choix actuel).
 */
const ASSURANCE_CREDIT_POSSIBLE: RegimeAConfirmer = {
  declaration: 'assurance-crédit possible : seule la police fixe alors le délai (C. assur. L. 111-1)',
  prescription: "assurance-crédit possible : L. 114-1 ne s'applique alors pas, voir la police (C. assur. L. 111-1)",
}

/**
 * Relecture de J67, R49 : sa contre-vérification n'a vu que le vol. Pour ces types, le minimum de L. 113-2, 4° n'est pas
 * sûrement le délai : la date calculée reste un repère `aConfirmer`, avec sa raison, en attendant la règle propre du type.
 * - garantie impayés : ASSURANCE_CREDIT_POSSIBLE ;
 * - « Catastrophes naturelles » : délai compté de la publication de l'arrêté (L. 125-2 ; declaration-sinistre.ts), date que
 *   la fiche ne porte pas.
 * « Tempête, Grêles, Neiges » n'y est pas : J67, R53 garde le repère de droit commun. « Dommages Ouvrage » n'y est plus :
 * sa règle propre, attendue ici, est appliquée (J67, R52 : aucun minimum, à déclarer dès la connaissance, sauf délai de
 * la police ; delaiMinimumJoursOuvres).
 */
const REGIMES_A_CONFIRMER: Readonly<Partial<Record<TypeSinistre, RegimeAConfirmer>>> = {
  'Charges Impayées': ASSURANCE_CREDIT_POSSIBLE,
  'Loyers Impayés': ASSURANCE_CREDIT_POSSIBLE,
  'Catastrophes naturelles': {
    declaration: "catastrophe naturelle : délai compté de la publication de l'arrêté (C. assur. L. 125-2)",
    prescription: null,
  },
}

export interface ReperesDelaisSinistre {
  /** Minimum légal de l'art. L. 113-2, 4° pour ce type (vol : 2 jours ouvrés ; dommages-ouvrage : aucun, J67, R52). */
  minimumLegalJoursOuvres: number
  delaiDeclarationJoursOuvres: number
  /** Le délai du contrat, saisi et au moins égal au minimum légal, est retenu. */
  delaiDuContrat: boolean
  /** Un vol a pu être rangé sous ce type : la date suppose qu'il n'y en a pas eu (J67, R49). */
  volPossible: boolean
  /** Le minimum de L. 113-2, 4° n'est pas sûrement le délai de ce type : raison (REGIMES_A_CONFIRMER) ; null : il l'est. */
  declarationAConfirmer: string | null
  declarationAuPlusTard: string
  /** Aucun délai (dommages-ouvrage sans délai de la police) : à déclarer dès la connaissance (J67, R52). */
  desLaConnaissance: boolean
  /** Départ, durée, texte et date retenue pour la déclaration. */
  justificationDeclaration: string
  /** Déclaration faite après le repère ; false si non encore déclarée, ou sans délai à dépasser. */
  declarationTardive: boolean
  /** Date la plus tôt possible de la prescription (L. 114-1). */
  prescription: string
  /** L. 114-1 ne s'applique peut-être pas à ce type : raison (REGIMES_A_CONFIRMER) ; null : il s'applique. */
  prescriptionAConfirmer: string | null
  /** Départ, durée, texte et date retenue pour la prescription. */
  justificationPrescription: string
  fondements: string[]
  avertissement: string
}

const fr = dateIsoVersFr

/** Texte retenu pour le délai de déclaration : délai du contrat, ou minimum légal (au lieu d'un délai du contrat plus court). */
function texteDelaiDeclaration(delaiDuContrat: boolean, delaiContratJoursOuvres: number | undefined): string {
  if (delaiDuContrat) return 'délai du contrat ; C. assur. L. 113-2, 4°'
  if (delaiContratJoursOuvres === undefined) return 'minimum légal, C. assur. L. 113-2, 4°'
  return `minimum légal, C. assur. L. 113-2, 4°, retenu au lieu des ${delaiContratJoursOuvres} jours ouvrés du contrat`
}

/**
 * Déclaration « au plus tard » et prescription « au plus tôt » (voir l'en-tête du module ; J67, R49). Null quand la
 * survenance ou la connaissance est d'une année improbable (anneeImprobableDesReperes) : aucun repère n'en part.
 */
export function reperesDelaisSinistre(
  sinistre: FicheSinistre,
  { delaiContratJoursOuvres }: { delaiContratJoursOuvres?: number } = {},
): ReperesDelaisSinistre | null {
  if (anneeImprobableDesReperes(sinistre) !== null) return null
  const dommagesOuvrage = sinistre.type === DOMMAGES_OUVRAGE
  const minimumLegalJoursOuvres = delaiMinimumJoursOuvres(sinistre.type)
  const delaiDeclarationJoursOuvres = Math.max(minimumLegalJoursOuvres, delaiContratJoursOuvres ?? 0)
  const delaiDuContrat = delaiContratJoursOuvres !== undefined && delaiContratJoursOuvres >= minimumLegalJoursOuvres
  const declarationAuPlusTard = ajouterJoursOuvres(sinistre.dateConnaissance, delaiDeclarationJoursOuvres)
  const desLaConnaissance = delaiDeclarationJoursOuvres === 0
  const prescription = ajouterMois(sinistre.dateSurvenance, PRESCRIPTION_MOIS)
  const regime = REGIMES_A_CONFIRMER[sinistre.type]
  return {
    minimumLegalJoursOuvres,
    delaiDeclarationJoursOuvres,
    delaiDuContrat,
    volPossible: TYPES_VOL_POSSIBLE.has(sinistre.type),
    declarationAConfirmer: regime?.declaration ?? null,
    declarationAuPlusTard,
    desLaConnaissance,
    justificationDeclaration: desLaConnaissance
      ? `Connaissance du ${fr(sinistre.dateConnaissance)}, sans délai (clauses types, C. assur. annexe II à l'art. A. 243-1 ; J67, R52) : à déclarer dès la connaissance (C. assur. L. 113-2, 4°).`
      : `Connaissance du ${fr(sinistre.dateConnaissance)} + ${delaiDeclarationJoursOuvres} jours ouvrés, comptés du lendemain hors samedis, dimanches et jours fériés ` +
        `(${texteDelaiDeclaration(delaiDuContrat, delaiContratJoursOuvres)}) : au plus tard le ${fr(declarationAuPlusTard)}.`,
    declarationTardive: !desLaConnaissance && sinistre.dateDeclaration !== null && sinistre.dateDeclaration > declarationAuPlusTard,
    prescription,
    prescriptionAConfirmer: regime?.prescription ?? null,
    justificationPrescription: `Survenance du ${fr(sinistre.dateSurvenance)} + ${PRESCRIPTION_MOIS} mois (C. assur. L. 114-1) : au plus tôt le ${fr(prescription)}.`,
    fondements: dommagesOuvrage
      ? ['C. assur. art. L. 113-2', 'C. assur. annexe II à l’art. A. 243-1', 'C. assur. art. L. 114-1']
      : ['C. assur. art. L. 113-2', 'C. assur. art. L. 114-1'],
    avertissement: dommagesOuvrage ? AVERTISSEMENT_REPERES_DOMMAGES_OUVRAGE : AVERTISSEMENT_REPERES,
  }
}
