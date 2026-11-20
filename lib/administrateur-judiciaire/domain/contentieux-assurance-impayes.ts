import {
  ajouterJours,
  ajouterJoursOuvres,
  ajouterMois,
  decomposerDateIso,
  ecartJours,
  estDateIsoValide,
  messagePlausibilite,
  plausibiliteDate,
  verifierAujourdhui,
  type PlausibiliteDate,
} from '@/lib/administrateur-judiciaire/domain/dates'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  controlerDecisionSouscriptionAssurance,
  type CauseAutorisationVente,
  type ContexteAutorisationVente,
  type DecisionDeSouscription,
} from '@/lib/administrateur-judiciaire/domain/contentieux-voies-execution'
import { indemnitesSinistre, type FicheSinistre, type IndemnitesSinistre } from '@/lib/administrateur-judiciaire/domain/sinistres'
import type { TypeContentieux, TypeSinistre } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Assurance des impayés d'un contentieux (point 57 du bilan Gestéam). Fonctions pures, dates ISO (AAAA-MM-JJ), montants
 * en CENTIMES ENTIERS, sans écran ni table : le contentieux n'est pas persisté, la table `sinistres` est inchangée.
 *
 * Gestéam — 🟢 lu :
 * - tranche 42, fiche contentieux réelle, onglet Règlements, bloc Assurance : case « Couverture impayés », « Déclaré le »,
 *   « Indemnités totales (€) », boutons « Historique » (⚪ non ouvert) et « Sinistre » (ouvre une fiche sinistre) ;
 * - tranche 28 : la fiche sinistre porte l'indemnité immédiate et la différée, chacune « Réglée » ; tranche 20 : phase
 *   « Indemnités » ; TYPE_SINISTRE contient « Charges Impayées » et « Loyers Impayés » (sinistres.indemnitesSinistre
 *   totalise les indemnités) ;
 * - tranche 43, § 1 : l'arbre des flux d'un contentieux relu ne contient aucun sinistre (🔵 un contentieux n'a donc pas
 *   forcément de sinistre lié : `sinistreId` est facultatif).
 *
 * Le droit — 🟢 lu sur Légifrance le 29/10/2026 :
 * - aucun texte trouvé ne régit une « assurance des impayés de charges » de copropriété (recherches négatives dans les
 *   codes, la loi n° 65-557 et le décret n° 67-223) : couverture, fait générateur du sinistre, délai de déclaration et
 *   plafond relèvent de la police ;
 * - C. assur. art. L. 113-2, 4° (titre Ier du livre Ier) : déclaration dans le délai du contrat, jamais inférieur à cinq
 *   jours ouvrés ; la déchéance pour déclaration tardive n'est opposable que si le contrat la prévoit et si l'assureur
 *   prouve un préjudice. C. assur. art. L. 121-12 (titre II, « Règles relatives aux assurances de dommages », chapitre
 *   « Dispositions générales ») : subrogation légale de l'assureur qui a payé l'indemnité, contre les tiers responsables ;
 * - C. assur. art. L. 111-1 (lu sur Légifrance le 30/10/2026, version en vigueur au 29/10/2026) : les titres Ier, II et
 *   III du livre Ier ne s'appliquent ni aux contrats du titre VII ni aux « opérations d'assurance crédit », hormis les
 *   articles L. 111-6, L. 112-2, L. 112-4, L. 112-7 et L. 113-4-1. L. 113-2 et L. 121-12 n'en font pas partie : leur
 *   application à une garantie des impayés de charges dépend de sa qualification ; la qualification de la garantie
 *   (opération d'assurance crédit ou non) se fait à la lecture de la police (décisions du 20/11/2026, partie C, F51 et
 *   F52, ci-dessous) ;
 * - C. civ. art. 1346-1 (subrogation conventionnelle), 1346-3 (pas de préjudice au créancier payé en partie, préférence
 *   pour le reste), 1346-4 (transmission de la créance dans la limite du paiement), 1346-5 (opposable au débiteur après
 *   notification ou s'il en a pris acte ; invocable par lui dès qu'il en a connaissance ; opposable aux tiers dès le
 *   paiement).
 *
 * Décisions de Hugo du 03/11/2026 (registre des décisions juridiques, J32 ; question 24 de la liste) :
 * - J32 : le bouton « Historique » du bloc Assurance (tranche 42, non ouvert) trace l'historique du dossier de
 *   contentieux. Le domaine n'expose aucun historique du dossier de contentieux : le contentieux n'est pas persisté, et
 *   fiches-liees.ts ne donne que le Flux des fiches rattachées (point 47), pas les changements du dossier. Rien n'est
 *   relié ici et aucun écran n'est créé : branchement à faire avec la table des contentieux.
 *
 * Décision de Hugo du 17/11/2026 (registre des décisions juridiques, J67, R47 ; question 3, en partie) :
 * - sous administration provisoire, la souscription d'une police impayés au nom du syndicat suit la mission de
 *   l'ordonnance (L. 1965 art. 29-1, I, al. 2, lu sur Légifrance le 17/11/2026, en vigueur depuis le 11/04/2024).
 *   L'administrateur provisoire qui a reçu ce pouvoir de l'AG décide, après avis du conseil syndical sauf urgence
 *   (D. 1967 art. 62-7), et porte la décision à sa date au registre (art. 62-8) ; sinon l'AG vote (art. 24 par défaut,
 *   aucun texte spécial lu ; contrat type de syndic, D. 1967 annexe 1, annexe au contrat, V, 16° : souscription soumise au
 *   vote de l'AG). Une police impayés n'est pas une assurance de responsabilité civile : le secours de l'art. 18, I (le
 *   syndic souscrit si l'AG refuse) ne joue pas. controlerSouscriptionAssuranceImpayes relie le contrat à sa décision,
 *   avec le contrôle des pouvoirs de la saisie (contentieux-voies-execution.controlerDecisionSouscriptionAssurance) : une
 *   alerte non bloquante, jamais un refus ; sans décision liée, « souscription non rattachée à une décision : vérifier les
 *   pouvoirs de l'ordonnance ». Aucun champ du contrat ne porte cette décision : enregistrement : à brancher ; alerte à
 *   produire sur la fiche du contrat (écran : Frédéric).
 *
 * 🔵 Déduit :
 * - la garantie impayés se déclare comme un sinistre « Charges Impayées » ou « Loyers Impayés » : le contentieux porte la
 *   couverture, la date de déclaration et le lien `sinistreId` ; les indemnités se LISENT sur le sinistre
 *   (`vueAssuranceImpayes`) et ne sont stockées nulle part sur le contentieux ;
 * - l'indemnité de l'assureur n'est pas un paiement du copropriétaire (C. civ. art. 1346-3 et 1346-4) : elle s'affiche à
 *   part, n'est ni déduite du solde dû (decompte-contentieux.calculerDecompte) ni imputée comme un règlement ;
 * - la couverture ne vise que le type « Recouvrement de charges/loyer » ; la date « Déclaré le » du contentieux est celle
 *   de la fiche sinistre liée. Les contrôles signalent, ils ne refusent pas.
 *
 * Décision du 20/11/2026 (partie C, F51) : garder le choix actuel, aucun délai de déclaration calculé par défaut. Deux
 *   champs facultatifs sur le contrat d'assurance impayés : « délai de déclaration prévu par la police » (nombre et
 *   unité) et « fait qui déclenche le sinistre » (première échéance impayée, mise en demeure restée sans effet, décision
 *   de justice, seuil de dette, autre) ; une fois remplis, VitFix calcule un repère « selon la police », jamais une
 *   déchéance (repereDeclarationImpayes). Aucun texte ne régit cette assurance (recherche du 29/10/2026) ; C. assur. art.
 *   L. 111-1 écarte L. 113-2 pour une opération d'assurance crédit. Ce que le cabinet lit dans la police : la branche ou
 *   l'objet de la garantie (la branche d'agrément, R. 321-1 : 14 « Crédit », 16 « Pertes pécuniaires diverses », n'est
 *   qu'un indice), la définition du sinistre, le délai et la forme de la déclaration, la sanction d'un retard. Unités
 *   retenues : jours calendaires, jours ouvrés (comptés du lendemain, samedi, dimanche et jours fériés exclus), mois
 *   (même quantième, borné à la fin du mois) ; aucun report. Paramètres explicites : la date du fait qui déclenche le
 *   sinistre est fournie par l'appelant (le contentieux n'est pas persisté, le domaine ne date pas ces faits) ; les deux
 *   champs sont un type du domaine (PoliceAssuranceImpayes), aucun contrat enregistré ne les porte : enregistrement à
 *   brancher.
 * Décision du 20/11/2026 (partie C, F52) : par défaut, garder le choix actuel : l'indemnité s'affiche à part, ni déduite
 *   du solde dû, ni imputée comme un règlement du débiteur. Une fois la police lue (PoliceAssuranceImpayes.lue),
 *   ventilerSoldeImpayes affiche « solde dû par le débiteur » (inchangé : decompte-contentieux.calculerDecompte), « dont
 *   part du syndicat » et « dont part de l'assureur », et met en compte d'attente « à reverser à l'assureur » ce qui est
 *   récupéré au-delà de la part du syndicat, jusqu'à décision. Textes lus le 17/11/2026 : l'assureur subrogé (C. civ. art.
 *   1346-1, ou C. assur. art. L. 121-12 s'il s'applique) reçoit la créance dans la limite de ce qu'il a payé (art.
 *   1346-4) ; le syndicat payé en partie garde la préférence pour le reste (art. 1346-3), d'où l'imputation du récupéré
 *   d'abord sur la part du syndicat. Une subrogation reste non opposable au débiteur tant qu'elle n'est ni notifiée ni
 *   prise en acte par lui, mais il peut l'invoquer dès qu'il la connaît (art. 1346-5, al. 1) et elle est opposable aux
 *   tiers dès le paiement (al. 2). Sans subrogation, la police peut prévoir de reverser à l'assureur les sommes
 *   récupérées. Limite : L. 121-12 vise les tiers « qui, par leur fait, ont causé le dommage » ; son application à un
 *   copropriétaire débiteur n'est pas établie, et elle est écartée si la police est une opération d'assurance crédit
 *   (L. 111-1). Paramètre explicite : les sommes récupérées depuis le paiement de l'indemnité, fournies par l'appelant.
 *
 * 🔴 Non établi (question restante) :
 * 3. (Frédéric ou Hugo) La case « Couverture impayés » découle-t-elle d'un contrat d'assurance du mandat (TYPE_CONTRAT
 *    « Assurance loyer impayé », garantie de la multirisque) à relier, ou est-elle saisie librement ? (Qui décide de la
 *    souscription : tranché par J67, R47, ci-dessus.)
 */

/** Types de sinistre de la garantie impayés (référentiel Gestéam TYPE_SINISTRE). */
export const TYPES_SINISTRE_IMPAYES = ['Charges Impayées', 'Loyers Impayés'] as const satisfies readonly TypeSinistre[]
export type TypeSinistreImpayes = (typeof TYPES_SINISTRE_IMPAYES)[number]

const TYPE_RECOUVREMENT = 'Recouvrement de charges/loyer' satisfies TypeContentieux

export interface AssuranceImpayesContentieux {
  /** Case « Couverture impayés ». */
  couverture: boolean
  /** « Déclaré le » : déclaration de l'impayé à l'assureur ; null si non déclaré. */
  declareLe: string | null
  /** Fiche sinistre liée (bouton « Sinistre »), qui porte les indemnités ; null sans lien. */
  sinistreId: string | null
}

export interface SaisieAssuranceImpayes {
  couverture: boolean
  declareLe?: string | null
  sinistreId?: string | null
}

export const SANS_ASSURANCE_IMPAYES: Readonly<AssuranceImpayesContentieux> = Object.freeze({
  couverture: false,
  declareLe: null,
  sinistreId: null,
})

/** Normalise la saisie : lien rogné (vide → null), date absente → null. Refuse une date non ISO. */
export function creerAssuranceImpayes(saisie: SaisieAssuranceImpayes): AssuranceImpayesContentieux {
  if (typeof saisie.couverture !== 'boolean')
    throw new Error(`Couverture impayés invalide (${String(saisie.couverture)}) : oui ou non attendu.`)
  const declareLe = saisie.declareLe ?? null
  if (declareLe !== null && !estDateIsoValide(declareLe))
    throw new Error(`Date de déclaration à l'assureur invalide (${declareLe}) : AAAA-MM-JJ attendu.`)
  const lien = saisie.sinistreId?.trim() ?? ''
  return { couverture: saisie.couverture, declareLe, sinistreId: lien === '' ? null : lien }
}

/** Fiche sinistre lue avec son identifiant d'enregistrement. */
export interface SinistreLie {
  id: string
  fiche: FicheSinistre
}

export type CodeAnomalieAssuranceImpayes =
  | 'declaration_sans_couverture'
  | 'sinistre_sans_couverture'
  | 'couverture_hors_recouvrement'
  | 'sinistre_introuvable'
  | 'sinistre_hors_impayes'
  | 'sinistre_autre_copropriete'
  | 'declaration_divergente'
  | 'declaration_non_plausible'

export interface AnomalieAssuranceImpayes {
  code: CodeAnomalieAssuranceImpayes
  message: string
  /** Nature de l'anomalie de date (`declaration_non_plausible` seulement). */
  nature?: PlausibiliteDate
}

/** La fiche fournie doit être celle du lien : une autre fiche est une erreur d'appel, pas une anomalie de saisie. */
function verifierFicheDuLien(assurance: AssuranceImpayesContentieux, sinistre: SinistreLie | null): void {
  if (sinistre === null || sinistre.id === assurance.sinistreId) return
  const lien = assurance.sinistreId === null ? 'à aucun sinistre' : `au sinistre « ${assurance.sinistreId} »`
  throw new Error(`Fiche sinistre « ${sinistre.id} » fournie, mais le contentieux est lié ${lien}.`)
}

const estTypeImpayes = (type: TypeSinistre): boolean => (TYPES_SINISTRE_IMPAYES as readonly TypeSinistre[]).includes(type)

/** « JJ/MM/AAAA » avec l'année sur 4 chiffres (« 10/03/0026 »), comme dates.messagePlausibilite : la faute de frappe se voit. */
function dateFrAnneeComplete(dateIso: string): string {
  const { a, m, j } = decomposerDateIso(dateIso)
  return `${String(j).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(a).padStart(4, '0')}`
}

const dateOuAbsence = (date: string | null): string => (date === null ? 'non renseignée' : `le ${dateFrAnneeComplete(date)}`)

function anomaliesCouverture(type: TypeContentieux, assurance: AssuranceImpayesContentieux): AnomalieAssuranceImpayes[] {
  const anomalies: AnomalieAssuranceImpayes[] = []
  if (assurance.couverture) {
    if (type !== TYPE_RECOUVREMENT)
      anomalies.push({
        code: 'couverture_hors_recouvrement',
        message: `Couverture impayés sur un contentieux « ${type} » : elle ne vise que le recouvrement de charges ou de loyers.`,
      })
    return anomalies
  }
  if (assurance.declareLe !== null)
    anomalies.push({ code: 'declaration_sans_couverture', message: "Déclaration à l'assureur datée sans la case « Couverture impayés »." })
  if (assurance.sinistreId !== null)
    anomalies.push({ code: 'sinistre_sans_couverture', message: 'Sinistre lié sans la case « Couverture impayés ».' })
  return anomalies
}

function anomaliesSinistre(
  coproprieteId: string,
  assurance: AssuranceImpayesContentieux,
  sinistre: SinistreLie | null,
): AnomalieAssuranceImpayes[] {
  if (assurance.sinistreId === null) return []
  if (sinistre === null)
    return [{ code: 'sinistre_introuvable', message: `Sinistre lié « ${assurance.sinistreId} » introuvable.` }]
  const { fiche } = sinistre
  const anomalies: AnomalieAssuranceImpayes[] = []
  if (!estTypeImpayes(fiche.type))
    anomalies.push({
      code: 'sinistre_hors_impayes',
      message: `Sinistre lié de type « ${fiche.type} » : « ${TYPES_SINISTRE_IMPAYES.join(' » ou « ')} » attendu.`,
    })
  if (fiche.coproprieteId !== coproprieteId)
    anomalies.push({ code: 'sinistre_autre_copropriete', message: "Sinistre lié d'une autre copropriété que le contentieux." })
  if (fiche.dateDeclaration !== assurance.declareLe)
    anomalies.push({
      code: 'declaration_divergente',
      message: `Déclaration à l'assureur ${dateOuAbsence(assurance.declareLe)} sur le contentieux, ${dateOuAbsence(fiche.dateDeclaration)} sur le sinistre lié.`,
    })
  return anomalies
}

/** Déclaration datée après aujourd'hui ou d'une année improbable (tranche 42 : Gestéam accepte une date en 2525). */
function anomaliesDateDeclaration(declareLe: string | null, aujourdhui: string): AnomalieAssuranceImpayes[] {
  const nature = declareLe === null ? null : plausibiliteDate(declareLe, aujourdhui, { futurAdmis: false })
  if (declareLe === null || nature === null) return []
  return [{ code: 'declaration_non_plausible', nature, message: messagePlausibilite('Déclaration datée', declareLe, nature) }]
}

/**
 * Cohérence de l'assurance impayés d'un dossier : couverture, sinistre lié (type, copropriété, date de déclaration) et
 * plausibilité de la date. Le dossier est typé par sa structure (pas de dépendance à contentieux.ts). Signale, ne refuse
 * pas ; lève une erreur si la fiche fournie n'est pas celle du lien, ou si `aujourdhui` est invalide.
 */
export function controlerAssuranceImpayes(
  dossier: { coproprieteId: string; type: TypeContentieux },
  assurance: AssuranceImpayesContentieux,
  sinistre: SinistreLie | null,
  aujourdhui: string,
): AnomalieAssuranceImpayes[] {
  verifierAujourdhui(aujourdhui)
  verifierFicheDuLien(assurance, sinistre)
  return [
    ...anomaliesCouverture(dossier.type, assurance),
    ...anomaliesSinistre(dossier.coproprieteId, assurance, sinistre),
    ...anomaliesDateDeclaration(assurance.declareLe, aujourdhui),
  ]
}

export interface VueAssuranceImpayes extends AssuranceImpayesContentieux {
  /**
   * Indemnités lues sur le sinistre lié (indemnitesSinistre) ; null sans fiche. Jamais déduites du solde dû (décision du
   * 20/11/2026, partie C, F52 : à part par défaut ; ventilation une fois la police lue, ventilerSoldeImpayes).
   */
  indemnites: IndemnitesSinistre | null
}

/**
 * Contrat d'assurance impayés et décision qui l'a souscrit (J67, R47). Aucun champ du contrat ne porte cette décision :
 * enregistrement : à brancher.
 */
export interface SouscriptionAssuranceImpayes extends DecisionDeSouscription {
  contratId: string
}

export interface ControleSouscriptionAssuranceImpayes {
  cause: CauseAutorisationVente
  /** Avertissement à afficher : décision absente, non admise ou à vérifier. */
  aSignaler: boolean
  /** Jamais un refus (J67, R47). */
  bloquant: false
  message: string
  fondement: string
  /** Points non contrôlés ici (avis du conseil syndical, mode de financement : D. 1967 art. 62-7). */
  rappels: string[]
}

/**
 * Décision de souscription d'une police impayés au nom du syndicat (J67, R47) : contrôle des pouvoirs de la saisie en
 * vue de la vente, sans date (contentieux-voies-execution.controlerDecisionSouscriptionAssurance) ; à signaler dès que la
 * décision manque, n'est pas admise ou reste à vérifier. Signale, ne refuse pas ; lève une erreur d'appel si la
 * résolution ou l'assemblée fournie n'est pas celle du lien.
 */
export function controlerSouscriptionAssuranceImpayes(
  souscription: SouscriptionAssuranceImpayes,
  contexte: ContexteAutorisationVente = {},
): ControleSouscriptionAssuranceImpayes {
  const { autorise, aConfirmer, cause, motif, fondement, rappels } = controlerDecisionSouscriptionAssurance(souscription, contexte)
  return { cause, aSignaler: !autorise || aConfirmer, bloquant: false, message: motif, fondement, rappels }
}

/** Bloc Assurance de la fiche : la saisie du contentieux et les « Indemnités totales » lues sur le sinistre lié. */
export function vueAssuranceImpayes(assurance: AssuranceImpayesContentieux, sinistre: SinistreLie | null): VueAssuranceImpayes {
  verifierFicheDuLien(assurance, sinistre)
  return {
    couverture: assurance.couverture,
    declareLe: assurance.declareLe,
    sinistreId: assurance.sinistreId,
    indemnites: sinistre === null ? null : indemnitesSinistre(sinistre.fiche),
  }
}

// ─── Police impayés (décisions du 20/11/2026, partie C, F51 et F52) ─────────────────────────

/** « Fait qui déclenche le sinistre » selon la police (F51), dans l'ordre de la décision. */
export const FAITS_GENERATEURS_IMPAYES = [
  'premiere_echeance_impayee',
  'mise_en_demeure_sans_effet',
  'decision_de_justice',
  'seuil_de_dette',
  'autre',
] as const
export type FaitGenerateurImpayes = (typeof FAITS_GENERATEURS_IMPAYES)[number]

export const LIBELLES_FAITS_GENERATEURS_IMPAYES: Readonly<Record<FaitGenerateurImpayes, string>> = {
  premiere_echeance_impayee: 'Première échéance impayée',
  mise_en_demeure_sans_effet: 'Mise en demeure restée sans effet',
  decision_de_justice: 'Décision de justice',
  seuil_de_dette: 'Seuil de dette',
  autre: 'Autre',
}

/** Unités du « délai de déclaration prévu par la police » (F51 : nombre et unité). */
export const UNITES_DELAI_POLICE_IMPAYES = ['jours', 'jours_ouvres', 'mois'] as const
export type UniteDelaiPoliceImpayes = (typeof UNITES_DELAI_POLICE_IMPAYES)[number]

const LIBELLES_UNITES_DELAI: Readonly<Record<UniteDelaiPoliceImpayes, string>> = { jours: 'jours', jours_ouvres: 'jours ouvrés', mois: 'mois' }

export interface DelaiPoliceImpayes {
  nombre: number
  unite: UniteDelaiPoliceImpayes
}

/**
 * Champs facultatifs du contrat d'assurance impayés (F51, F52). Type du domaine : aucun contrat enregistré ne les porte,
 * enregistrement à brancher.
 */
export interface PoliceAssuranceImpayes {
  /** « Délai de déclaration prévu par la police » ; null : non renseigné. */
  delaiDeclaration: DelaiPoliceImpayes | null
  /** « Fait qui déclenche le sinistre » ; null : non renseigné. */
  faitGenerateur: FaitGenerateurImpayes | null
  /** Police lue (F52) : l'indemnité se ventile entre part du syndicat et part de l'assureur ; faux par défaut. */
  lue: boolean
}

export interface SaisiePoliceAssuranceImpayes {
  delaiDeclaration?: DelaiPoliceImpayes | null
  faitGenerateur?: FaitGenerateurImpayes | null
  lue?: boolean
}

/** Police non lue, champs vides : le choix par défaut (aucun délai calculé, indemnité à part). */
export const POLICE_IMPAYES_NON_RENSEIGNEE: Readonly<PoliceAssuranceImpayes> = Object.freeze({
  delaiDeclaration: null,
  faitGenerateur: null,
  lue: false,
})

function verifierDelaiPolice({ nombre, unite }: DelaiPoliceImpayes): void {
  if (!(UNITES_DELAI_POLICE_IMPAYES as readonly string[]).includes(unite))
    throw new Error(`Unité du délai de la police inconnue (« ${String(unite)} ») : ${UNITES_DELAI_POLICE_IMPAYES.join(', ')} attendu.`)
  if (!Number.isInteger(nombre) || nombre < 1)
    throw new Error(`Délai de déclaration de la police invalide (${nombre}) : nombre entier ≥ 1 attendu.`)
}

/** Normalise la saisie : champ absent → null, police non lue par défaut. Refuse un délai, un fait ou une lecture mal formés. */
export function creerPoliceAssuranceImpayes(saisie: SaisiePoliceAssuranceImpayes): PoliceAssuranceImpayes {
  const delai = saisie.delaiDeclaration ?? null
  if (delai !== null) verifierDelaiPolice(delai)
  const faitGenerateur = saisie.faitGenerateur ?? null
  if (faitGenerateur !== null && !(FAITS_GENERATEURS_IMPAYES as readonly string[]).includes(faitGenerateur))
    throw new Error(`Fait qui déclenche le sinistre inconnu (« ${String(faitGenerateur)} ») : ${FAITS_GENERATEURS_IMPAYES.join(', ')} attendu.`)
  const lue = saisie.lue ?? false
  if (typeof lue !== 'boolean') throw new Error(`Police lue invalide (${String(lue)}) : oui ou non attendu.`)
  return { delaiDeclaration: delai === null ? null : { nombre: delai.nombre, unite: delai.unite }, faitGenerateur, lue }
}

export type EtatRepereImpayes = 'sans_repere' | 'a_declarer' | 'repere_depasse' | 'dans_le_repere' | 'apres_le_repere'

export interface RepereDeclarationImpayes {
  etat: EtatRepereImpayes
  /** Repère « selon la police » ; null : aucun délai calculé. */
  date: string | null
  /** Le repère vient de la police, jamais d'un texte (F51). */
  selonLaPolice: true
  faitGenerateur: FaitGenerateurImpayes | null
  delai: DelaiPoliceImpayes | null
  /** Jours calendaires au-delà du repère (déclaration après lui, ou repère dépassé sans déclaration) ; 0 sinon. */
  retardJours: number
  message: string
  avertissement: string
}

export const AVERTISSEMENT_REPERE_POLICE_IMPAYES =
  "Repère selon la police, jamais une déchéance : aucun texte ne fixe ce délai ; la forme de la déclaration et la sanction d'un retard se lisent dans la police (C. assur. art. L. 113-2 ne s'applique pas à une opération d'assurance crédit, art. L. 111-1)."

export interface DatesRepereImpayes {
  /** Date du fait qui déclenche le sinistre, fournie par l'appelant (le domaine ne la porte pas) ; null : inconnue. */
  dateFaitGenerateur: string | null
  /** « Déclaré le » du contentieux ; null : non déclaré. */
  declareLe: string | null
  aujourdhui: string
}

function verifierDatesRepere({ dateFaitGenerateur, declareLe, aujourdhui }: DatesRepereImpayes): void {
  verifierAujourdhui(aujourdhui)
  if (dateFaitGenerateur !== null && !estDateIsoValide(dateFaitGenerateur))
    throw new Error(`Date du fait qui déclenche le sinistre invalide (${dateFaitGenerateur}) : AAAA-MM-JJ attendu.`)
  if (declareLe !== null && !estDateIsoValide(declareLe))
    throw new Error(`Date de déclaration à l'assureur invalide (${declareLe}) : AAAA-MM-JJ attendu.`)
}

/** Fait + délai de la police : jours calendaires ou jours ouvrés comptés du lendemain, mois au même quantième ; sans report. */
function dateRepereImpayes(fait: string, { nombre, unite }: DelaiPoliceImpayes): string {
  if (unite === 'mois') return ajouterMois(fait, nombre)
  return unite === 'jours_ouvres' ? ajouterJoursOuvres(fait, nombre) : ajouterJours(fait, nombre)
}

type EtatRepereCalcule = Pick<RepereDeclarationImpayes, 'etat' | 'retardJours' | 'message'>

function etatRepereImpayes(repere: string, declareLe: string | null, aujourdhui: string): EtatRepereCalcule {
  const le = dateFrAnneeComplete(repere)
  if (declareLe === null && aujourdhui > repere)
    return {
      etat: 'repere_depasse',
      retardJours: ecartJours(repere, aujourdhui),
      message: `Impayé non déclaré, repère selon la police du ${le} dépassé : déclarer sans attendre et vérifier la police.`,
    }
  if (declareLe === null) return { etat: 'a_declarer', retardJours: 0, message: `Impayé à déclarer, repère selon la police au ${le}.` }
  if (declareLe > repere)
    return {
      etat: 'apres_le_repere',
      retardJours: ecartJours(repere, declareLe),
      message: `Déclaration du ${dateFrAnneeComplete(declareLe)}, après le repère selon la police du ${le} : vérifier la police.`,
    }
  return { etat: 'dans_le_repere', retardJours: 0, message: `Déclaration du ${dateFrAnneeComplete(declareLe)}, dans le repère selon la police du ${le}.` }
}

/**
 * Repère de déclaration « selon la police » d'un impayé (F51) : date du fait qui déclenche le sinistre, plus le délai
 * prévu par la police. Sans l'un des deux champs, ou sans la date du fait, aucun délai n'est calculé (choix gardé).
 * Signal, jamais une déchéance. Lève une erreur si une date fournie n'est pas AAAA-MM-JJ.
 */
export function repereDeclarationImpayes(police: PoliceAssuranceImpayes, dates: DatesRepereImpayes): RepereDeclarationImpayes {
  verifierDatesRepere(dates)
  const { delaiDeclaration: delai, faitGenerateur } = police
  const commun = { selonLaPolice: true as const, faitGenerateur, delai, avertissement: AVERTISSEMENT_REPERE_POLICE_IMPAYES }
  const sansRepere = (message: string): RepereDeclarationImpayes => ({ ...commun, etat: 'sans_repere', date: null, retardJours: 0, message })
  if (delai === null || faitGenerateur === null)
    return sansRepere(
      'Aucun délai de déclaration calculé : « délai de déclaration prévu par la police » et « fait qui déclenche le sinistre » à renseigner sur le contrat, après lecture de la police.',
    )
  const fait = LIBELLES_FAITS_GENERATEURS_IMPAYES[faitGenerateur]
  if (dates.dateFaitGenerateur === null)
    return sansRepere(`Aucun délai de déclaration calculé : date du fait « ${fait} » non renseignée.`)
  const date = dateRepereImpayes(dates.dateFaitGenerateur, delai)
  const etat = etatRepereImpayes(date, dates.declareLe, dates.aujourdhui)
  const base = `${delai.nombre} ${LIBELLES_UNITES_DELAI[delai.unite]} après « ${fait} » du ${dateFrAnneeComplete(dates.dateFaitGenerateur)}`
  return { ...commun, date, ...etat, message: `${etat.message} Repère : ${base}.` }
}

/** Compte d'attente des sommes récupérées au-delà de la part du syndicat (F52), jusqu'à décision. */
export const LIBELLE_COMPTE_ATTENTE_ASSUREUR = "À reverser à l'assureur"

const FONDEMENT_VENTILATION_IMPAYES = 'C. civ. art. 1346-3 et 1346-4'

export interface SaisieVentilationImpayes {
  /** « Solde dû par le débiteur » (decompte-contentieux.calculerDecompte, soldeDuCentimes), inchangé. */
  soldeDuCentimes: number
  /** Indemnité réglée par l'assureur (sinistres.indemnitesSinistre, regleCentimes). */
  indemniteRegleeCentimes: number
  /** Sommes récupérées auprès du débiteur depuis le paiement de l'indemnité, fournies par l'appelant. */
  recupereDepuisIndemniteCentimes: number
}

export interface VentilationSoldeImpayes {
  /** Police lue : ventilation faite ; faux : indemnité à part (choix par défaut). */
  ventilee: boolean
  /** Toujours le solde du décompte, jamais diminué de l'indemnité. */
  soldeDuParLeDebiteurCentimes: number
  /** « dont part du syndicat » ; null tant que la police n'est pas lue. */
  dontPartSyndicatCentimes: number | null
  /** « dont part de l'assureur » ; null tant que la police n'est pas lue. */
  dontPartAssureurCentimes: number | null
  /** Compte d'attente LIBELLE_COMPTE_ATTENTE_ASSUREUR, jusqu'à décision ; 0 tant que la police n'est pas lue. */
  aReverserAssureurCentimes: number
  /** Indemnité réglée, affichée à part. */
  indemniteRegleeCentimes: number
  message: string
  fondement: string
}

const eurosImpayes = (centimes: number): string => formatEurosCentimes(centimes / 100)

function verifierVentilation({ soldeDuCentimes, indemniteRegleeCentimes, recupereDepuisIndemniteCentimes }: SaisieVentilationImpayes): void {
  if (!Number.isInteger(soldeDuCentimes)) throw new Error(`Solde dû invalide (${soldeDuCentimes}) : centimes entiers attendus.`)
  const montants: [string, number][] = [
    ["Indemnité réglée par l'assureur", indemniteRegleeCentimes],
    ['Sommes récupérées depuis l’indemnité', recupereDepuisIndemniteCentimes],
  ]
  for (const [libelle, montant] of montants)
    if (!Number.isInteger(montant) || montant < 0) throw new Error(`${libelle} invalide (${montant}) : centimes entiers positifs attendus.`)
}

/**
 * Indemnité de l'assureur impayés et solde du débiteur (F52). Par défaut (police non lue), l'indemnité reste à part : le
 * solde est celui du décompte, rien n'est ventilé. Police lue : la créance au paiement de l'indemnité (solde d'aujourd'hui
 * plus ce qui a été récupéré depuis) se partage entre l'assureur, dans la limite de son paiement (C. civ. art. 1346-4), et
 * le syndicat pour le reste ; le récupéré s'impute d'abord sur la part du syndicat (art. 1346-3), l'excédent va au compte
 * d'attente « à reverser à l'assureur », jusqu'à décision. Un excédent du débiteur (solde négatif) n'est pas à l'assureur.
 */
export function ventilerSoldeImpayes(police: Pick<PoliceAssuranceImpayes, 'lue'>, saisie: SaisieVentilationImpayes): VentilationSoldeImpayes {
  verifierVentilation(saisie)
  const { soldeDuCentimes, indemniteRegleeCentimes: indemnite, recupereDepuisIndemniteCentimes: recupere } = saisie
  const commun = { soldeDuParLeDebiteurCentimes: soldeDuCentimes, indemniteRegleeCentimes: indemnite, fondement: FONDEMENT_VENTILATION_IMPAYES }
  if (!police.lue)
    return {
      ...commun,
      ventilee: false,
      dontPartSyndicatCentimes: null,
      dontPartAssureurCentimes: null,
      aReverserAssureurCentimes: 0,
      message: `Indemnité de l'assureur (${eurosImpayes(indemnite)} réglés) affichée à part : ni déduite du solde dû, ni imputée comme un règlement du débiteur ; ventilation une fois la police lue.`,
    }
  const creance = Math.max(soldeDuCentimes + recupere, 0)
  const partAssureur = Math.min(indemnite, creance)
  const partSyndicat = creance - partAssureur
  const auSyndicat = Math.min(recupere, partSyndicat)
  const aReverser = Math.min(recupere - auSyndicat, partAssureur)
  const dontSyndicat = partSyndicat - auSyndicat
  const dontAssureur = partAssureur - aReverser
  const attente =
    aReverser > 0
      ? ` ${eurosImpayes(aReverser)} récupérés au-delà de la part du syndicat : compte d'attente « à reverser à l'assureur », jusqu'à décision.`
      : ''
  return {
    ...commun,
    ventilee: true,
    dontPartSyndicatCentimes: dontSyndicat,
    dontPartAssureurCentimes: dontAssureur,
    aReverserAssureurCentimes: aReverser,
    message: `Solde dû par le débiteur : ${eurosImpayes(soldeDuCentimes)}, dont part du syndicat ${eurosImpayes(dontSyndicat)} et dont part de l'assureur ${eurosImpayes(dontAssureur)}.${attente}`,
  }
}
