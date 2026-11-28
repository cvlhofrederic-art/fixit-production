import type { CourrierSuivi } from '@/lib/administrateur-judiciaire/domain/courriers'
import {
  ajouterJours,
  dateIsoVersFr,
  ecartJours,
  estAnneeImprobable,
  estDateIsoValide,
  messagePlausibilite,
  plausibiliteDate,
  reporterAuJourOuvrable,
  verifierAujourdhui,
} from '@/lib/administrateur-judiciaire/domain/dates'
import type { Rattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import { GABARITS_COURRIER, gabaritCourrier, type CleGabaritCourrier } from '@/lib/administrateur-judiciaire/domain/gabarits-courrier'
import {
  anneeImprobableDesReperes,
  controlerChronologieSinistre,
  erreurMandatCourtier,
  etapeSuiviSinistre,
  phaseApresDeclaration,
  RAPPEL_DECLARATION_DES_CONNAISSANCE,
  reperesDelaisSinistre,
  type FicheSinistre,
} from '@/lib/administrateur-judiciaire/domain/sinistres'
import { normaliserTexteLibre } from '@/lib/administrateur-judiciaire/domain/texte'
import type {
  FamilleModeleCourrier,
  FormeEnvoiCourrier,
  PhaseSinistre,
  StatutCourrier,
  TypeEntreprise,
  TypeSinistre,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Date de déclaration d'un sinistre tirée du courrier de déclaration (point 58 du bilan 2). Fonctions pures, dates ISO,
 * sans écran ni table : l'appelant résout le modèle (Courrier.modeleId) et le type du destinataire de chaque courrier.
 * L'enregistrement de la date (table sinistres inscriptible) et le champ de rattachement des courriers (point 47)
 * relèvent de Frédéric.
 *
 * Gestéam —
 * 🟢 Tranche 42 § Sinistre : sur une fiche réelle, l'onglet Courriers porte un courrier « DÉCLARATION » adressé au
 *    courtier, daté du jour d'ouverture du dossier ; la date Déclaration du bloc Suivi est pourtant restée vide : Gestéam
 *    ne reporte pas la date du courrier. § Flux : Sinistre → Courrier (déclaration, Archivé) → Document (copie).
 * 🟢 Tranche 28 : dates de suivi Déclaration, Expertise, Règlement, Forclusion, Rapport, Clos le ; ouverture du dossier
 *    et survenance sont deux dates distinctes.
 * 🟢 Tranche 43 § 5 : les dates de suivi sont presque toujours vides, le suivi passe par la phase (saisie, axe distinct).
 * 🟢 Tranche 43 § 22 et tranche 22 § 1 : la famille Sinistre (15 à 16 modèles) mêle « déclaration », « déclaration
 *    sinistre DO (AR) », « accusé déclaration copro » (courrier au copropriétaire), « relance dossier »…
 * 🟢 Tranche 20 § 4 : la forme d'envoi est portée par le modèle, le courrier est un objet suivi (AR) ; § 2 : compagnie,
 *    courtier et lésé sont trois tiers distincts.
 * 🔵 Le courrier de déclaration se reconnaît à son MODÈLE (famille Sinistre et libellé Gestéam ou objet VitFix des
 *    gabarits declaration_sinistre et declaration_sinistre_do), jamais à l'objet libre ni à la seule famille. Son statut
 *    est sans effet. Le PREMIER courrier déposé fait la date ; les suivants sont des relances ou des compléments. Un
 *    courrier déposé avant la survenance ou la connaissance est écarté (mal rattaché) : la date proposée passe toujours
 *    controlerChronologieSinistre. Un courrier déposé après aujourd'hui est écarté aussi : ce n'est pas encore une
 *    déclaration ; la date du jour est donc obligatoire pour proposer la date comme pour contrôler les courriers (sans
 *    elle, le report d'un dépôt à venir effacerait l'alerte « à déclarer »). Si le report de la date rendait la fiche
 *    incohérente (expertise, règlement ou clôture déjà datés avant le dépôt), la date reste proposée et chacune de ces
 *    étapes est signalée avant le report, même si la fiche était déjà incohérente sur ce champ pour une autre cause. Une
 *    date saisie n'est jamais remplacée : l'écart est signalé ; saisie après aujourd'hui, elle n'est pas comparée au
 *    repère (« à vérifier »).
 * 🔵 Sans date de déclaration, une fiche dont l'expertise, le rapport, le règlement ou la clôture est daté a été déclarée
 *    (étape de suivi, etapeSuiviSinistre) : état « déclaration non datée », jamais « à déclarer », comme depuisSinistres
 *    (suivi-a-faire.ts), qui ne donne alors aucun élément « à déclarer ».
 * 🔵 Sans aucune date de suivi (cas courant, T43 § 5 ; fiche T42 en phase « Accusé réception »), une phase saisie qui suit
 *    la déclaration (sinistres.ts, PHASES_APRES_DECLARATION : Accusé réception, Mission d'expertise, Relances, Complément
 *    de document, Indemnités) donne aussi « déclaration non datée », avec « à vérifier » et le rappel du repère, jamais
 *    « déclarer sans attendre » : indice plus faible qu'une date, les deux axes restent distincts. depuisSinistres garde
 *    alors l'élément « à déclarer » (même critère du réglage), libellé « déclaration non datée (phase …) : à vérifier ».
 *    « Général » (valeur initiale), « Déclaration » (pour elle, voir 🔴) et « Dommages Ouvrages » (un régime, pas une
 *    étape) laissent le sinistre à déclarer.
 *
 * Le droit — relevé sur Légifrance les 29 et 30/10/2026 :
 * 🟢 C. assur. art. L. 113-2, 4° : avis à l'assureur dès la connaissance du sinistre, au plus tard dans le délai du
 *    contrat, qui ne peut être inférieur à cinq jours ouvrés (deux pour le vol) ; aucune forme imposée. Avant-dernier
 *    alinéa : la déchéance pour retard suppose une clause du contrat et un préjudice établi par l'assureur ; elle est
 *    exclue en cas fortuit ou de force majeure. Le contrôle est donc un SIGNAL, jamais une déchéance. Le repère est celui
 *    de reperesDelaisSinistre (sinistres.ts), réutilisé : jours ouvrés comptés à partir du lendemain de la connaissance,
 *    samedi, dimanche et jours fériés exclus ; le repère tombe donc toujours un jour ouvré (décompte confirmé : J67, R50).
 * 🟢 Art. L. 125-2, al. 4 (version en vigueur depuis le 28/05/2026, loi n° 2026-403) : catastrophe naturelle, avis au plus
 *    tard trente jours après la publication de l'arrêté interministériel, sans sanction propre du retard. La phrase de cet
 *    article qui renvoie à un décret en Conseil d'État (modalités, dérogations, conséquences de la méconnaissance) vise
 *    l'emploi de l'indemnité en sécheresse ; ce décret est pris : R. 125-6-1 (décret n° 2024-82 du 05/02/2024, en vigueur
 *    depuis le 07/02/2024). Art. D. 125-6 (décret simple, en vigueur depuis le 01/01/2023) : déclaration « à l'assureur ou
 *    à son représentant local », dans les trente jours suivant la publication ; il ne fixe aucune conséquence du retard.
 *    L'ancienne clause type (annexe I à l'art. A. 125-1) est abrogée. La règle générale de L. 113-2, avant-dernier alinéa,
 *    s'applique donc (J67, R54). La date de publication n'est pas sur la fiche : passée en option, sinon pas de repère.
 *    Décompte : publication + trente jours calendaires, soit le 30e jour compté du lendemain, sans report (J67, R55).
 * 🟢 Annexe II à l'art. A. 243-1 (dommages-ouvrage) : aucun délai de déclaration n'est fixé à l'assuré ; les délais de
 *    l'assureur courent de la réception de la déclaration réputée constituée. Pas de repère (gabarit
 *    declaration_sinistre_do) ; déclarer dès la connaissance (J67, R52 : sinistres.reperesDelaisSinistre et
 *    suivi-a-faire.depuisSinistres datent l'élément « à déclarer » du jour de la connaissance).
 * 🔵 Aucun des textes relus ne dit si l'avis est daté de l'envoi ou de la réception. La date proposée est le DÉPÔT
 *    (ligne 58 du bilan). Si la réception connue (première présentation, à défaut l'accusé de réception) tombe après le
 *    repère alors que le dépôt est dans le délai, l'état est « à vérifier », sans conclure au retard ; le message cite le
 *    texte du délai appliqué. Choix gardé par la décision du 20/11/2026 (partie C, F53, ci-dessous), sauf police
 *    « reçue » ou « parvenue ».
 *
 * Décisions du 17/11/2026 (registre des décisions juridiques, J67 ; textes lus sur Légifrance le 17/11/2026) :
 * - J67, R50 : le décompte de L. 113-2, 4° est confirmé (« jours ouvrés » : lundi à vendredi hors jours fériés ; jour de
 *   la connaissance exclu, CPC art. 641, al. 1, par analogie) ; calcul inchangé. L'avertissement du droit commun rappelle
 *   de déclarer dès la connaissance : le repère n'est que le minimum légal du délai prévu au contrat
 *   (sinistres.RAPPEL_DECLARATION_DES_CONNAISSANCE).
 * - J67, R51 : en principe, le courtier est le mandataire de l'assuré ; il peut, selon les circonstances, être aussi celui
 *   de l'assureur (Cass. 1re civ., 22/10/1996, n° 94-15.613, publié) ; L. 113-2, 4° vise l'avis « à l'assureur » et
 *   D. 125-6 « l'assureur ou son représentant local ». La date du courrier au courtier reste proposée et signalée (un fait
 *   exact). Deux champs facultatifs de l'assurance du sinistre (sinistres.AssuranceSinistre), que l'appelant peut aussi
 *   passer en option (l'option prime) : « transmis à la compagnie le » (transmisCompagnieLe) : connue, cette date se
 *   compare au repère ; « courtier mandaté par l'assureur, mandat vu » (courtierMandateParAssureur) : la date du courrier au
 *   courtier est retenue. Sans l'une ni l'autre, l'état est « à vérifier : mandat du courtier et date de transmission à la
 *   compagnie » (sauf courrier déjà postérieur au repère : tardive). Une transmission datée avant le courrier au courtier
 *   est impossible : « à vérifier », la date du courrier est gardée. Un courrier adressé directement à la compagnie compte
 *   aussi : le premier avis reçu par elle fait la date (sans transmission datée, seulement s'il tombe dans le repère, car la
 *   transmission a pu le précéder). Les deux champs s'enregistrent avec la fiche, sans changement de schéma
 *   (db/sinistres.ts) ; leur saisie à l'écran, et leur reprise par le formulaire à chaque enregistrement : Frédéric.
 * - J67, R52 : dommages-ouvrage, aucun délai dans les clauses types : ce module reste sans repère (inchangé) ; les autres
 *   modules sont alignés (voir ci-dessus).
 * - J67, R53 : « Tempête, Grêles, Neiges » garde le repère de droit commun ; l'avertissement ajoute, par prudence, les
 *   quatre jours de la grêle (C. assur. art. L. 123-1, en vigueur depuis le 08/01/1981, loi n° 81-5 : « envoi » de la
 *   déclaration dans les quatre jours de la survenance), dont l'application à la multirisque n'est pas établie (seul
 *   arrêt lu : Cass. 1re civ., 18/06/1991, n° 89-18.283, vergers).
 * - J67, R54 : catastrophe naturelle, signal, jamais une déchéance : AVERTISSEMENT_DELAI_CATASTROPHE_NATURELLE réécrit
 *   (aucun décret « attendu » ; règle générale de L. 113-2). Aucune marque de veille.
 * - J67, R55 : catastrophe naturelle, le 30e jour n'est pas reporté (ni L. 125-2 ni D. 125-6 ne le prévoient ; CPC art.
 *   642 vise les actes d'une procédure) ; l'alerte suit la date sans report. Si elle tombe un samedi, un dimanche ou un
 *   jour férié, le premier jour ouvrable suivant est donné à titre d'information (declarationAuPlusTardReportee), avec la
 *   mention « report non prévu par le texte ».
 *
 * Décision du 20/11/2026 (partie C, F53) : garder le dépôt comme date proposée, et l'état « à vérifier » quand la
 * réception connue tombe après le repère. Si la police dit « reçue » ou « parvenue », un réglage par contrat
 * (OptionsDelaiDeclaration.receptionSelonPolice) compare au repère la date de réception : première présentation, à
 * défaut accusé de réception ; réception non saisie : « à vérifier », sauf dépôt déjà postérieur au repère (la
 * réception ne peut que le suivre). Le dépôt reste la date proposée (dateRetenue). Le réglage ne joue ni pour une date
 * saisie sans courrier de même date, ni pour une transmission datée par le courtier, ni pour un courrier au courtier à
 * vérifier (J67, R51). Textes lus le 17/11/2026 : L. 113-2, 4° (« donner avis à l'assureur ») ne dit pas si l'avis
 * compte à l'envoi ou à la réception ; L. 123-1 (grêle : « l'envoi de la déclaration de sinistre doit être effectué »)
 * et L. 113-12 (délai de résiliation compté du cachet de la poste ou de l'expédition) s'attachent à l'envoi : un indice,
 * pas une règle pour L. 113-2 ; la police tranche. Paramètre explicite : aucun champ du contrat d'assurance ne porte ce
 * réglage, enregistrement à brancher. À rapprocher de J67, R74 (ordre de service : la première présentation ne vaut pas
 * réception) : la décision F53 retient ici la première présentation, pour la seule déclaration de sinistre sous une
 * police « reçue » ou « parvenue ».
 *
 * 🔴 Questions pour Frédéric ou le référent métier :
 * - Catastrophe naturelle : la date de publication de l'arrêté doit-elle devenir un champ de la fiche sinistre ?
 *   suivi-a-faire.ts applique encore à ce type cinq jours ouvrés depuis la connaissance, date marquée « à confirmer » avec
 *   sa raison (sinistres.REGIMES_A_CONFIRMER : délai compté de la publication de l'arrêté, relecture de J67, R49).
 * - Phase saisie sans date de déclaration : la phase « Accusé réception » suit-elle la déclaration (accusé de l'assureur)
 *   ou la précède-t-elle (accusé au copropriétaire, modèle « accusé déclaration copro » ; la liste Gestéam la place avant
 *   « Déclaration ») ? La phase « Déclaration » vaut-elle déclaration faite ? (Aujourd'hui : « Accusé réception » donne
 *   « déclaration non datée, à vérifier » ; « Déclaration » laisse le sinistre à déclarer.)
 */

export interface ModeleDeCourrier {
  famille: FamilleModeleCourrier
  libelle: string
}

export interface CourrierDeSinistre extends CourrierSuivi {
  id: string
  /** Famille et libellé du modèle (ModeleCourrier), résolus par l'appelant depuis Courrier.modeleId. */
  modele: ModeleDeCourrier
  /** Fiches visées par le courrier ; le sinistre : { type: 'Sinistre', id }. */
  rattachements: readonly Rattachement[]
  /** Sans effet : le courrier de déclaration observé en T42 est « Archivé ». */
  statut?: StatutCourrier
  /** Type d'entreprise du destinataire (Courrier.entrepriseId → fiche entreprise), s'il est connu. */
  typeDestinataire?: TypeEntreprise | null
}

/** Courrier de déclaration dont le dépôt est daté. */
export type CourrierDeclarationDepose = CourrierDeSinistre & { dateDepot: string }

/** FicheSinistre ne porte pas d'identifiant : c'est la table qui le donne. */
export interface SinistreIdentifie {
  id: string
  fiche: FicheSinistre
}

/**
 * Date du jour, obligatoire : elle écarte les courriers déposés après ce jour, si bien qu'une proposition ne porte jamais
 * un dépôt à venir (sans elle, le report d'un tel dépôt effacerait l'alerte « à déclarer »).
 */
export interface OptionsDateDuJour {
  aujourdhui: string
}

export const GABARITS_DECLARATION_SINISTRE = ['declaration_sinistre', 'declaration_sinistre_do'] as const satisfies readonly CleGabaritCourrier[]

const DECLARATION_DROIT_COMMUN = GABARITS_COURRIER.declaration_sinistre
const DECLARATION_DO = GABARITS_COURRIER.declaration_sinistre_do
const CATASTROPHE_NATURELLE: TypeSinistre = 'Catastrophes naturelles'
/** Type Gestéam de la garantie « Tempête, Grêle, Neige » d'une multirisque (J67, R53). */
const TEMPETE_GRELE_NEIGE: TypeSinistre = 'Tempête, Grêles, Neiges'
const FONDEMENTS_DROIT_COMMUN: readonly string[] = [DECLARATION_DROIT_COMMUN.delai.fondement]
/** Délai de la catastrophe naturelle : la loi (L. 125-2, al. 4) et son décret (D. 125-6). */
const FONDEMENTS_CATASTROPHE_NATURELLE: readonly string[] = ['C. assur. art. L. 125-2', 'C. assur. art. D. 125-6']
/** Le gabarit réunit les références du délai dans une chaîne d'affichage : une référence par élément. */
const FONDEMENTS_DO: readonly string[] = DECLARATION_DO.delai.fondement.split(' ; ')
/** Avis au plus tard trente jours après la publication de l'arrêté interministériel (C. assur. art. L. 125-2, al. 4). */
const JOURS_CATASTROPHE_NATURELLE = 30

/** Libellé normalisé (objet VitFix ou libellé Gestéam) → famille du gabarit de déclaration. */
const FAMILLE_PAR_LIBELLE_DECLARATION: ReadonlyMap<string, FamilleModeleCourrier> = new Map(
  GABARITS_DECLARATION_SINISTRE.flatMap((cle) => {
    const { famille, objet, libelleGesteam } = gabaritCourrier(cle)
    return [objet, libelleGesteam]
      .filter((libelle): libelle is string => libelle !== null)
      .map((libelle): [string, FamilleModeleCourrier] => [normaliserTexteLibre(libelle), famille])
  }),
)

/** Modèle de déclaration à l'assureur : famille Sinistre et libellé exact d'un gabarit de déclaration (casse, accents ignorés). */
export function estModeleDeclarationSinistre(modele: ModeleDeCourrier): boolean {
  return FAMILLE_PAR_LIBELLE_DECLARATION.get(normaliserTexteLibre(modele.libelle)) === modele.famille
}

const viseLeSinistre = (courrier: CourrierDeSinistre, sinistreId: string): boolean =>
  courrier.rattachements.some((r) => r.type === 'Sinistre' && r.id === sinistreId)

/** Courriers de déclaration rattachés au sinistre et déposés, par dépôt croissant puis identifiant ; statut ignoré. */
export function courriersDeDeclaration(sinistreId: string, courriers: readonly CourrierDeSinistre[]): CourrierDeclarationDepose[] {
  return courriers
    .filter(
      (c): c is CourrierDeclarationDepose =>
        viseLeSinistre(c, sinistreId) && estModeleDeclarationSinistre(c.modele) && estDateIsoValide(c.dateDepot),
    )
    .sort((a, b) => a.dateDepot.localeCompare(b.dateDepot) || a.id.localeCompare(b.id))
}

/** La date de dépôt, prise comme date de déclaration, passe le contrôle de chronologie de la fiche. */
const respecteLaChronologie = (fiche: FicheSinistre, dateDepot: string): boolean =>
  !controlerChronologieSinistre({ ...fiche, dateDeclaration: dateDepot }).some((a) => a.champ === 'dateDeclaration')

interface CourriersTries {
  /** Courriers retenus, le premier fait la date. */
  admis: CourrierDeclarationDepose[]
  /** Déposés avant la survenance ou la connaissance. */
  ecartes: CourrierDeclarationDepose[]
  /** Déposés après aujourd'hui : pas encore une déclaration. */
  futurs: CourrierDeclarationDepose[]
}

function trierCourriers(sinistre: SinistreIdentifie, courriers: readonly CourrierDeSinistre[], aujourdhui: string): CourriersTries {
  const tries: CourriersTries = { admis: [], ecartes: [], futurs: [] }
  for (const courrier of courriersDeDeclaration(sinistre.id, courriers)) {
    if (courrier.dateDepot > aujourdhui) tries.futurs.push(courrier)
    else if (respecteLaChronologie(sinistre.fiche, courrier.dateDepot)) tries.admis.push(courrier)
    else tries.ecartes.push(courrier)
  }
  return tries
}

export type PropositionDateDeclaration =
  | { nature: 'aucun_courrier'; sinistreId: string }
  | {
      nature: 'a_reporter'
      sinistreId: string
      /** Date de dépôt du premier courrier de déclaration. */
      date: string
      courrierId: string
      formeEnvoi: FormeEnvoiCourrier
      datePremierePresentation: string | null
    }
  | { nature: 'conforme'; sinistreId: string; date: string; courrierId: string }
  | { nature: 'ecart'; sinistreId: string; dateSaisie: string; dateCourrier: string; courrierId: string; message: string }

function propositionDepuis(sinistre: SinistreIdentifie, premier: CourrierDeclarationDepose | undefined): PropositionDateDeclaration {
  const sinistreId = sinistre.id
  if (!premier) return { nature: 'aucun_courrier', sinistreId }
  const saisie = sinistre.fiche.dateDeclaration
  const courrierId = premier.id
  if (saisie === null)
    return {
      nature: 'a_reporter',
      sinistreId,
      date: premier.dateDepot,
      courrierId,
      formeEnvoi: premier.formeEnvoi,
      datePremierePresentation: premier.datePremierePresentation ?? null,
    }
  if (saisie === premier.dateDepot) return { nature: 'conforme', sinistreId, date: saisie, courrierId }
  return {
    nature: 'ecart',
    sinistreId,
    dateSaisie: saisie,
    dateCourrier: premier.dateDepot,
    courrierId,
    message: `Déclaration saisie au ${dateIsoVersFr(saisie)}, courrier de déclaration déposé le ${dateIsoVersFr(premier.dateDepot)} : la date saisie est conservée, à vérifier.`,
  }
}

/**
 * Date de déclaration proposée depuis le dépôt du premier courrier de déclaration ; une date saisie n'est jamais remplacée.
 * La date du jour est obligatoire et contrôlée : un courrier déposé après ce jour n'est pas proposé
 * (controlerCourriersDeclaration le signale).
 */
export function proposerDateDeclaration(
  sinistre: SinistreIdentifie,
  courriers: readonly CourrierDeSinistre[],
  { aujourdhui }: OptionsDateDuJour,
): PropositionDateDeclaration {
  verifierAujourdhui(aujourdhui)
  return propositionDepuis(sinistre, trierCourriers(sinistre, courriers, aujourdhui).admis[0])
}

/**
 * Fiche avec la date proposée, si sa date de déclaration est vide et la proposition « à reporter » ; sinon la fiche reçue,
 * inchangée. L'appelant décide de l'enregistrer, après lecture de controlerCourriersDeclaration. La proposition, faite à
 * la date du jour (obligatoire), ne porte jamais un dépôt daté après ce jour. Une proposition faite pour un autre
 * sinistre est refusée.
 */
export function ficheAvecDateDeclaration(sinistre: SinistreIdentifie, proposition: PropositionDateDeclaration): FicheSinistre {
  if (proposition.sinistreId !== sinistre.id)
    throw new Error(`Proposition de date de déclaration faite pour un autre sinistre (${proposition.sinistreId}, attendu ${sinistre.id}).`)
  if (proposition.nature !== 'a_reporter' || sinistre.fiche.dateDeclaration !== null) return sinistre.fiche
  return { ...sinistre.fiche, dateDeclaration: proposition.date }
}

export type CodeAnomalieDeclaration =
  | 'chronologie'
  | 'depot_improbable'
  | 'destinataire_non_assureur'
  | 'sans_preuve_reception'
  | 'plusieurs_courriers'
  | 'ecart_date_saisie'

export interface AnomalieDeclarationCourrier {
  code: CodeAnomalieDeclaration
  gravite: 'avertissement' | 'information'
  courrierId: string
  message: string
}

const anomalie = (
  code: CodeAnomalieDeclaration,
  gravite: AnomalieDeclarationCourrier['gravite'],
  courrierId: string,
  message: string,
): AnomalieDeclarationCourrier => ({ code, gravite, courrierId, message })

const COMPAGNIE: TypeEntreprise = "Compagnie d'assurance"
const COURTIER: TypeEntreprise = 'Courtier'

/** Question du courtier, posée au regard du texte qui régit l'avis pour ce type de sinistre. */
function messageCourtier(type: TypeSinistre): string {
  const avis =
    type === CATASTROPHE_NATURELLE
      ? "avis « à l'assureur ou à son représentant local » (C. assur. art. D. 125-6, délai de l'art. L. 125-2)"
      : `avis à l'assureur (${DECLARATION_DROIT_COMMUN.delai.fondement})`
  return `Déclaration adressée au courtier : vaut-elle ${avis} ? Cela dépend de son mandat ; vérifier la date de transmission à la compagnie.`
}

function anomalieDestinataire(courrier: CourrierDeclarationDepose, typeSinistre: TypeSinistre): AnomalieDeclarationCourrier | null {
  const type = courrier.typeDestinataire ?? null
  if (type === null || type === COMPAGNIE) return null
  const message =
    type === COURTIER
      ? messageCourtier(typeSinistre)
      : `Déclaration adressée à un destinataire « ${type} », pas à une compagnie d'assurance : destinataire ou modèle à vérifier.`
  return anomalie('destinataire_non_assureur', 'avertissement', courrier.id, message)
}

function anomalieDepot(courrier: CourrierDeclarationDepose, aujourdhui: string): AnomalieDeclarationCourrier | null {
  const nature = plausibiliteDate(courrier.dateDepot, aujourdhui, { futurAdmis: false })
  if (nature === null) return null
  return anomalie('depot_improbable', 'avertissement', courrier.id, messagePlausibilite('Dépôt du courrier de déclaration daté', courrier.dateDepot, nature))
}

/** Courrier déposé après aujourd'hui : écarté de la date de déclaration. */
const messageDepotFutur = (courrier: CourrierDeclarationDepose): string =>
  `${messagePlausibilite('Dépôt du courrier de déclaration daté', courrier.dateDepot, 'future')} Écarté : il ne fait pas la date de déclaration ; date de dépôt à vérifier.`

const anomalieFuture = (courrier: CourrierDeclarationDepose): AnomalieDeclarationCourrier =>
  anomalie('depot_improbable', 'avertissement', courrier.id, messageDepotFutur(courrier))

/** Réception connue du pli : première présentation, à défaut accusé de réception. */
const receptionConnue = (courrier: CourrierSuivi): string | null => courrier.datePremierePresentation ?? courrier.dateAccuseReception ?? null

function anomaliePreuve(courrier: CourrierDeclarationDepose, proposition: PropositionDateDeclaration): AnomalieDeclarationCourrier | null {
  const estAr = courrier.formeEnvoi === 'AR'
  if (estAr && receptionConnue(courrier) !== null) return null
  const motif = estAr ? 'première présentation du pli non saisie' : `envoi en « ${courrier.formeEnvoi} », sans avis de réception`
  // Date saisie différente du dépôt : c'est elle qui est retenue (ecart_date_saisie), pas le dépôt.
  const retenue = proposition.nature === 'ecart' ? '' : ' : la date retenue est celle du dépôt'
  return anomalie('sans_preuve_reception', 'information', courrier.id, `Déclaration sans preuve de réception (${motif})${retenue}.`)
}

const anomalieSuivant = (courrier: CourrierDeclarationDepose, premier: CourrierDeclarationDepose): AnomalieDeclarationCourrier =>
  anomalie(
    'plusieurs_courriers',
    'information',
    courrier.id,
    `Autre courrier de déclaration, déposé le ${dateIsoVersFr(courrier.dateDepot)} : le premier, déposé le ${dateIsoVersFr(premier.dateDepot)}, fait la date.`,
  )

const anomalieEcartee = (courrier: CourrierDeclarationDepose): AnomalieDeclarationCourrier =>
  anomalie(
    'chronologie',
    'avertissement',
    courrier.id,
    `Courrier de déclaration déposé le ${dateIsoVersFr(courrier.dateDepot)}, avant la survenance ou la connaissance du sinistre : écarté, rattachement à vérifier.`,
  )

const estAnomalie = (a: AnomalieDeclarationCourrier | null): a is AnomalieDeclarationCourrier => a !== null

/**
 * Étapes du suivi postérieures à la déclaration, de la moins à la plus avancée (etapeSuiviSinistre). `suitLaDeclaration` :
 * la déclaration est un précédent de l'étape dans controlerChronologieSinistre (le rapport, lui, suit l'expertise).
 */
const ETAPES_POSTERIEURES = [
  { champ: 'dateExpertise', datee: 'Expertise datée', suitLaDeclaration: true },
  { champ: 'dateRapport', datee: 'Rapport daté', suitLaDeclaration: false },
  { champ: 'dateReglement', datee: 'Règlement daté', suitLaDeclaration: true },
  { champ: 'dateCloture', datee: 'Clôture datée', suitLaDeclaration: true },
] as const

interface EtapeDatee {
  datee: string
  date: string
  suitLaDeclaration: boolean
}

const etapesDatees = (fiche: FicheSinistre): EtapeDatee[] =>
  ETAPES_POSTERIEURES.flatMap(({ champ, datee, suitLaDeclaration }) => {
    const date = fiche[champ]
    return date === null ? [] : [{ datee, date, suitLaDeclaration }]
  })

/**
 * Étapes que le report de la date proposée placerait avant la déclaration : comparaison directe de chaque étape à la date,
 * si bien qu'une étape déjà en anomalie pour une autre cause est signalée aussi ; une incohérence sans lien avec la
 * déclaration (rapport avant expertise) n'est pas imputée au courrier.
 */
function anomaliesDuReport(sinistre: SinistreIdentifie, proposition: PropositionDateDeclaration): AnomalieDeclarationCourrier[] {
  if (proposition.nature !== 'a_reporter') return []
  return etapesDatees(sinistre.fiche)
    .filter((etape) => etape.suitLaDeclaration && etape.date < proposition.date)
    .map((etape) =>
      anomalie(
        'chronologie',
        'avertissement',
        proposition.courrierId,
        `Reporter le dépôt du ${dateIsoVersFr(proposition.date)} comme date de déclaration rendrait la fiche incohérente (${etape.datee} du ${dateIsoVersFr(etape.date)}, avant la déclaration) : dates du suivi ou rattachement du courrier à vérifier.`,
      ),
    )
}

/**
 * Anomalies des courriers de déclaration d'un sinistre : courrier écarté (chronologie), dépôt après aujourd'hui (écarté)
 * ou improbable, destinataire autre que la compagnie, absence de preuve de réception du courrier retenu, courriers
 * suivants, incohérence que créerait le report de la date proposée, écart avec la date saisie. Signale, ne refuse pas.
 * La date du jour est obligatoire, comme pour proposerDateDeclaration : les anomalies décrivent la même proposition.
 */
export function controlerCourriersDeclaration(
  sinistre: SinistreIdentifie,
  courriers: readonly CourrierDeSinistre[],
  { aujourdhui }: OptionsDateDuJour,
): AnomalieDeclarationCourrier[] {
  verifierAujourdhui(aujourdhui)
  const { admis, ecartes, futurs } = trierCourriers(sinistre, courriers, aujourdhui)
  const proposition = propositionDepuis(sinistre, admis[0])
  const anomalies = [...ecartes.map((courrier) => anomalieEcartee(courrier)), ...futurs.map((courrier) => anomalieFuture(courrier))]
  for (const [rang, courrier] of admis.entries()) {
    const propre = rang === 0 ? anomaliePreuve(courrier, proposition) : anomalieSuivant(courrier, admis[0])
    anomalies.push(...[anomalieDepot(courrier, aujourdhui), anomalieDestinataire(courrier, sinistre.fiche.type), propre].filter(estAnomalie))
  }
  anomalies.push(...anomaliesDuReport(sinistre, proposition))
  if (proposition.nature === 'ecart') anomalies.push(anomalie('ecart_date_saisie', 'avertissement', proposition.courrierId, proposition.message))
  return anomalies
}

export type EtatDelaiDeclaration =
  | 'a_declarer'
  | 'delai_depasse'
  | 'dans_le_delai'
  | 'a_verifier'
  | 'tardive'
  | 'declaration_non_datee'
  | 'sans_repere'

export interface DelaiDeclaration {
  jours: number
  unite: 'jours_ouvres' | 'jours'
}

export interface OptionsDelaiDeclaration {
  aujourdhui: string
  /** Délai de déclaration du contrat ; retenu s'il dépasse le minimum légal (reperesDelaisSinistre). */
  delaiContratJoursOuvres?: number
  /** Catastrophe naturelle : publication de l'arrêté interministériel (L. 125-2) ; aucun champ de la fiche ne la porte. */
  datePublicationArrete?: string | null
  /**
   * Déclaration adressée au courtier : date de sa transmission à la compagnie, comparée au repère si elle est connue
   * (J67, R51) ; absente ou null : celle de la fiche (assurance.transmisCompagnieLe).
   */
  transmisCompagnieLe?: string | null
  /**
   * Le courtier gère les sinistres pour l'assureur (mandat vu) : la date du courrier au courtier est retenue (J67, R51) ;
   * absent : celui de la fiche (assurance.courtierMandateParAssureur).
   */
  courtierMandateParAssureur?: boolean
  /**
   * Réglage du contrat d'assurance (décision du 20/11/2026, partie C, F53) : la police dit « reçue » ou « parvenue » ; la
   * réception du courrier retenu (première présentation, à défaut accusé de réception) se compare alors au repère.
   * Absent ou faux : le dépôt (choix par défaut). Aucun champ du contrat ne le porte : enregistrement à brancher.
   */
  receptionSelonPolice?: boolean
}

export interface ControleDelaiDeclaration {
  etat: EtatDelaiDeclaration
  /** null : pas de repère (dommages-ouvrage, catastrophe naturelle sans date d'arrêté). */
  declarationAuPlusTard: string | null
  /**
   * Catastrophe naturelle : premier jour ouvrable suivant un repère qui tombe un samedi, un dimanche ou un jour férié,
   * pour information seulement (report non prévu par le texte, J67, R55) ; null sinon.
   */
  declarationAuPlusTardReportee: string | null
  delai: DelaiDeclaration | null
  /**
   * Date saisie, à défaut dépôt du premier courrier de déclaration déposé au plus tard aujourd'hui ; courrier au
   * courtier : le premier avis reçu par la compagnie, sa transmission datée ou un courrier qui lui est adressé (J67, R51).
   */
  dateRetenue: string | null
  source: 'saisie' | 'courrier' | 'transmission' | null
  /**
   * Courrier dont le dépôt fait la date retenue (proposée ou égale à la date saisie) ; source « transmission » : le
   * courrier au courtier transmis à la compagnie (J67, R51).
   */
  courrierId: string | null
  /** Jours calendaires au-delà du repère : déclaration tardive, ou repère dépassé sans déclaration ; 0 sinon. */
  retardJours: number
  /** Une référence de texte par élément. */
  fondements: string[]
  message: string
  avertissement: string
  aConfirmer: true
}

export const AVERTISSEMENT_DELAI_DECLARATION =
  "Signal indicatif, jamais une déchéance : la déchéance pour déclaration tardive suppose une clause du contrat et un préjudice établi par l'assureur ; elle est exclue en cas fortuit ou de force majeure (C. assur. art. L. 113-2, avant-dernier alinéa). Vérifier le contrat et le dossier."

/** J67, R54 : aucun texte propre ne sanctionne le retard ; règle générale de L. 113-2, avant-dernier alinéa. */
export const AVERTISSEMENT_DELAI_CATASTROPHE_NATURELLE =
  "Signal indicatif, jamais une déchéance : ni L. 125-2 ni D. 125-6 ne fixent de sanction du retard ; règle générale de L. 113-2 : déchéance seulement si le contrat la prévoit et si l'assureur prouve un préjudice, jamais en cas fortuit ou de force majeure. Vérifier le contrat et le dossier."

/** J67, R53 : grêle, par prudence ; l'application de C. assur. art. L. 123-1 à la multirisque n'est pas établie. */
export const AVERTISSEMENT_GRELE =
  'En cas de grêle, par prudence, envoyer la déclaration dans les quatre jours de la survenance (C. assur. L. 123-1 ; application à la multirisque à vérifier sur la police).'

/** Droit commun : déclarer dès la connaissance (J67, R50), puis le régime de la déchéance. */
const AVERTISSEMENT_DROIT_COMMUN = `${RAPPEL_DECLARATION_DES_CONNAISSANCE} ${AVERTISSEMENT_DELAI_DECLARATION}`

interface RepereDeclaration {
  date: string | null
  /** Premier jour ouvrable suivant le repère, s'il en diffère (catastrophe naturelle, J67, R55) ; null sinon. */
  dateReportee: string | null
  delai: DelaiDeclaration | null
  fondements: string[]
  avertissement: string
  /** Message de l'état « sans repère ». */
  motifSansRepere: string
}

/**
 * Pas de repère : date de départ d'une année improbable (dates.estAnneeImprobable, faute de frappe). Aucun délai n'en
 * part (depuis 9999, trente jours tombent en l'an 10000, hors du calendrier ISO) ; la date est à corriger.
 */
const motifAnneeImprobable = (message: string | null): string =>
  [message, 'Pas de repère : corriger la date.'].filter((partie) => partie !== null).join(' ')

function repereCatastropheNaturelle(publication: string | null): RepereDeclaration {
  const commun = { fondements: [...FONDEMENTS_CATASTROPHE_NATURELLE], avertissement: AVERTISSEMENT_DELAI_CATASTROPHE_NATURELLE }
  if (publication === null)
    return {
      ...commun,
      date: null,
      dateReportee: null,
      delai: null,
      motifSansRepere:
        "Catastrophe naturelle : le délai de trente jours court de la publication de l'arrêté interministériel, date non renseignée. Pas de repère.",
    }
  if (estAnneeImprobable(publication))
    return {
      ...commun,
      date: null,
      dateReportee: null,
      delai: null,
      motifSansRepere: motifAnneeImprobable(messagePlausibilite("Publication de l'arrêté datée", publication, 'annee_improbable')),
    }
  // Publication + 30 jours calendaires : le 30e jour compté du lendemain ; aucun report (J67, R55).
  const date = ajouterJours(publication, JOURS_CATASTROPHE_NATURELLE)
  const reportee = reporterAuJourOuvrable(date)
  return {
    ...commun,
    date,
    dateReportee: reportee === date ? null : reportee,
    delai: { jours: JOURS_CATASTROPHE_NATURELLE, unite: 'jours' },
    motifSansRepere: '',
  }
}

function repereDeclaration(fiche: FicheSinistre, options: OptionsDelaiDeclaration): RepereDeclaration {
  if (fiche.type === 'Dommages Ouvrage')
    return {
      date: null,
      dateReportee: null,
      delai: null,
      fondements: [...FONDEMENTS_DO],
      avertissement: AVERTISSEMENT_DELAI_DECLARATION,
      motifSansRepere: `Dommages-ouvrage (gabarit « ${DECLARATION_DO.objet} ») : ${DECLARATION_DO.delai.libelle}. Pas de repère, à confirmer.`,
    }
  if (fiche.type === CATASTROPHE_NATURELLE) return repereCatastropheNaturelle(options.datePublicationArrete ?? null)
  const droitCommun = {
    fondements: [...FONDEMENTS_DROIT_COMMUN],
    avertissement: fiche.type === TEMPETE_GRELE_NEIGE ? `${AVERTISSEMENT_DROIT_COMMUN} ${AVERTISSEMENT_GRELE}` : AVERTISSEMENT_DROIT_COMMUN,
  }
  const reperes = reperesDelaisSinistre(fiche, { delaiContratJoursOuvres: options.delaiContratJoursOuvres })
  // Null : survenance ou connaissance d'une année improbable (anneeImprobableDesReperes).
  if (reperes === null)
    return { ...droitCommun, date: null, dateReportee: null, delai: null, motifSansRepere: motifAnneeImprobable(anneeImprobableDesReperes(fiche)) }
  return {
    ...droitCommun,
    date: reperes.declarationAuPlusTard,
    dateReportee: null,
    delai: { jours: reperes.delaiDeclarationJoursOuvres, unite: 'jours_ouvres' },
    motifSansRepere: '',
  }
}

/** Date facultative des options : ISO si elle est renseignée. */
function verifierDateOption(libelle: string, date: string | null | undefined): void {
  if (date !== undefined && date !== null && !estDateIsoValide(date)) throw new Error(`${libelle} invalide (${date}) : AAAA-MM-JJ attendu.`)
}

function verifierOptionsDelai(options: OptionsDelaiDeclaration): void {
  const { aujourdhui, delaiContratJoursOuvres, courtierMandateParAssureur } = options
  verifierAujourdhui(aujourdhui)
  if (delaiContratJoursOuvres !== undefined && (!Number.isInteger(delaiContratJoursOuvres) || delaiContratJoursOuvres < 0))
    throw new Error(`Délai du contrat invalide (${delaiContratJoursOuvres}) : nombre entier de jours ouvrés attendu.`)
  verifierDateOption("Date de publication de l'arrêté", options.datePublicationArrete)
  verifierDateOption('Date de transmission à la compagnie', options.transmisCompagnieLe)
  const mandat = erreurMandatCourtier(courtierMandateParAssureur)
  if (mandat) throw new Error(mandat)
  const { receptionSelonPolice } = options
  if (receptionSelonPolice !== undefined && typeof receptionSelonPolice !== 'boolean')
    throw new Error(`Réglage « réception selon la police » invalide (${String(receptionSelonPolice)}) : oui ou non attendu.`)
}

interface DateRetenue {
  date: string | null
  source: ControleDelaiDeclaration['source']
  /** Courrier qui fait la date ; source « transmission » : le courrier au courtier transmis. */
  courrier: CourrierDeclarationDepose | null
  /** Courrier au courtier, sans mandat de l'assureur vu ni transmission datée : à vérifier (J67, R51). */
  courtierAVerifier?: boolean
  /** Transmission à la compagnie datée avant le courrier au courtier : non retenue, à vérifier (J67, R51). */
  transmissionAnterieure?: string
}

/** Champs du courtier (J67, R51) : l'option de l'appelant, à défaut l'assurance de la fiche. */
interface ChampsCourtier {
  transmisCompagnieLe: string | null | undefined
  mandate: boolean | undefined
}

const champsCourtier = ({ assurance }: FicheSinistre, options: OptionsDelaiDeclaration): ChampsCourtier => ({
  transmisCompagnieLe: options.transmisCompagnieLe ?? assurance.transmisCompagnieLe,
  mandate: options.courtierMandateParAssureur ?? assurance.courtierMandateParAssureur,
})

function dateRetenue(fiche: FicheSinistre, premier: CourrierDeclarationDepose | null): DateRetenue {
  const saisie = fiche.dateDeclaration
  if (saisie !== null) return { date: saisie, source: 'saisie', courrier: premier?.dateDepot === saisie ? premier : null }
  if (premier) return { date: premier.dateDepot, source: 'courrier', courrier: premier }
  return { date: null, source: null, courrier: null }
}

/**
 * J67, R51 : courrier retenu adressé au courtier. Mandat de l'assureur vu : sa date est retenue. Sinon, le premier avis
 * reçu par la compagnie fait la date : la transmission datée par le courtier, ou un courrier adressé directement à la
 * compagnie. Sans transmission datée, ce courrier ne fait la date que s'il tombe dans le repère (la transmission a pu le
 * précéder) ; sinon, à vérifier. Une transmission datée avant le courrier au courtier est impossible : elle n'est pas
 * retenue, à vérifier. Ce courrier a passé le contrôle de chronologie (trierCourriers) : une date qui le précède précède
 * aussi, le cas échéant, la survenance ou la connaissance.
 */
function retenueViaCourtier(
  retenue: DateRetenue,
  admis: readonly CourrierDeclarationDepose[],
  repere: string | null,
  { transmisCompagnieLe, mandate }: ChampsCourtier,
): DateRetenue {
  const auCourtier = retenue.courrier
  if (auCourtier?.typeDestinataire !== COURTIER || mandate === true) return retenue
  if (transmisCompagnieLe && transmisCompagnieLe < auCourtier.dateDepot) return { ...retenue, transmissionAnterieure: transmisCompagnieLe }
  const directe = admis.find((courrier) => courrier.typeDestinataire === COMPAGNIE)
  const parDirecte = (avant: string | null): DateRetenue | null =>
    directe && avant !== null && directe.dateDepot <= avant ? { date: directe.dateDepot, source: 'courrier', courrier: directe } : null
  if (transmisCompagnieLe)
    return parDirecte(transmisCompagnieLe) ?? { date: transmisCompagnieLe, source: 'transmission', courrier: auCourtier }
  return parDirecte(repere) ?? { ...retenue, courtierAVerifier: true }
}

type EtatCalcule = Pick<ControleDelaiDeclaration, 'etat' | 'retardJours' | 'message'>

interface ContexteEtat {
  fiche: FicheSinistre
  aujourdhui: string
  repere: string
  fondements: readonly string[]
  /** Premier courrier de déclaration déposé après aujourd'hui, écarté. */
  futur: CourrierDeclarationDepose | undefined
  /** Police « reçue » ou « parvenue » (F53) : la réception du courrier se compare au repère. */
  receptionSelonPolice: boolean
}

function etatNonDeclare(aujourdhui: string, repere: string): EtatCalcule {
  if (aujourdhui > repere)
    return {
      etat: 'delai_depasse',
      retardJours: ecartJours(repere, aujourdhui),
      message: `Sinistre non déclaré, repère indicatif du ${dateIsoVersFr(repere)} dépassé : déclarer sans attendre.`,
    }
  return { etat: 'a_declarer', retardJours: 0, message: `Sinistre à déclarer, repère indicatif au ${dateIsoVersFr(repere)}.` }
}

/** Déclaration non datée alors qu'une étape postérieure l'est : le sinistre a été déclaré, sa date est à retrouver. */
function etatDeclarationNonDatee(fiche: FicheSinistre): EtatCalcule {
  const etape = etapesDatees(fiche).at(-1)
  const quand = etape ? ` (${etape.datee} du ${dateIsoVersFr(etape.date)})` : ''
  return {
    etat: 'declaration_non_datee',
    retardJours: 0,
    message: `Déclaration non datée alors que le suivi est plus avancé${quand} : date de déclaration à retrouver (courrier de déclaration, compagnie) ; délai non contrôlé.`,
  }
}

/**
 * Aucune date de suivi, mais une phase saisie qui suit la déclaration (phaseApresDeclaration) : indice plus faible qu'une
 * date, d'où « à vérifier » et le rappel du repère, sans injonction.
 */
const etatPhaseSansDate = (phase: PhaseSinistre, repere: string): EtatCalcule => ({
  etat: 'declaration_non_datee',
  retardJours: 0,
  message: `Déclaration non datée alors que la phase saisie est « ${phase} » : vérifier que le sinistre est déclaré et dater la déclaration (courrier de déclaration, compagnie) ; s'il ne l'est pas, repère indicatif au ${dateIsoVersFr(repere)}. Délai non contrôlé.`,
})

/**
 * Ni date saisie ni courrier retenu : à déclarer, sauf si le suivi est déjà plus avancé, par ses dates (même lecture que
 * depuisSinistres) ou, à défaut, par sa phase saisie.
 */
function etatSansDeclaration({ fiche, aujourdhui, repere, futur }: ContexteEtat): EtatCalcule {
  if (etapeSuiviSinistre(fiche) !== 'a_declarer') return etatDeclarationNonDatee(fiche)
  const phase = phaseApresDeclaration(fiche)
  if (phase !== null) return etatPhaseSansDate(phase, repere)
  const etat = etatNonDeclare(aujourdhui, repere)
  return futur ? { ...etat, message: `${etat.message} ${messageDepotFutur(futur)}` } : etat
}

/** Date retenue nommée selon sa source : la transmission à la compagnie cite le courrier au courtier (J67, R51). */
const designation = (date: string, { source, courrier }: DateRetenue): string =>
  source === 'transmission' && courrier
    ? `Transmission à la compagnie du ${dateIsoVersFr(date)} (courrier au courtier du ${dateIsoVersFr(courrier.dateDepot)})`
    : `Déclaration du ${dateIsoVersFr(date)}`

/**
 * Décision du 20/11/2026 (partie C, F53) : police « reçue » ou « parvenue » ; la réception du courrier qui fait la date
 * (première présentation, à défaut accusé de réception) se compare au repère. Réception non saisie : « à vérifier », sauf
 * dépôt déjà postérieur au repère (la réception ne peut que le suivre). Le dépôt reste la date proposée.
 */
function etatSelonReception(date: string, courrier: CourrierDeclarationDepose, repere: string): EtatCalcule {
  const reception = receptionConnue(courrier)
  const depose = `Déclaration déposée le ${dateIsoVersFr(date)}`
  const auRepere = `repère indicatif du ${dateIsoVersFr(repere)}`
  if (reception === null && date > repere)
    return {
      etat: 'tardive',
      retardJours: ecartJours(repere, date),
      message: `${depose}, postérieure au ${auRepere} ; réception non saisie, la police compte la réception (« reçue » ou « parvenue »).`,
    }
  if (reception === null)
    return {
      etat: 'a_verifier',
      retardJours: 0,
      message: `${depose}, dans le ${auRepere}, mais réception non saisie : la police compte la réception (« reçue » ou « parvenue ») ; saisir la première présentation, à défaut l'accusé de réception.`,
    }
  if (reception > repere)
    return {
      etat: 'tardive',
      retardJours: ecartJours(repere, reception),
      message: `${depose}, reçue le ${dateIsoVersFr(reception)}, postérieure au ${auRepere} : la police compte la réception (« reçue » ou « parvenue »).`,
    }
  return {
    etat: 'dans_le_delai',
    retardJours: 0,
    message: `${depose}, reçue le ${dateIsoVersFr(reception)}, dans le ${auRepere} (la police compte la réception).`,
  }
}

function etatDeclare(date: string, retenue: DateRetenue, { repere, fondements, receptionSelonPolice }: ContexteEtat): EtatCalcule {
  const { source, courrier, courtierAVerifier, transmissionAnterieure } = retenue
  if (transmissionAnterieure !== undefined)
    return {
      etat: 'a_verifier',
      retardJours: 0,
      message: `Transmission à la compagnie saisie au ${dateIsoVersFr(transmissionAnterieure)}, avant le courrier au courtier du ${dateIsoVersFr(date)} : date de transmission à vérifier ; délai non contrôlé (repère indicatif du ${dateIsoVersFr(repere)}).`,
    }
  // F53 : ni transmission datée par le courtier, ni courrier au courtier à vérifier (J67, R51).
  if (receptionSelonPolice && courrier && source !== 'transmission' && courtierAVerifier !== true)
    return etatSelonReception(date, courrier, repere)
  if (date > repere)
    return {
      etat: 'tardive',
      retardJours: ecartJours(repere, date),
      message: `${designation(date, retenue)}, postérieure au repère indicatif du ${dateIsoVersFr(repere)}.`,
    }
  if (courtierAVerifier === true)
    return {
      etat: 'a_verifier',
      retardJours: 0,
      message: `Déclaration adressée au courtier le ${dateIsoVersFr(date)}, dans le repère indicatif du ${dateIsoVersFr(repere)} : à vérifier : mandat du courtier et date de transmission à la compagnie.`,
    }
  // Transmission par le courtier : la réception de son courrier ne dit rien de celle de la compagnie.
  const reception = courrier && source !== 'transmission' ? receptionConnue(courrier) : null
  if (reception !== null && reception > repere)
    return {
      etat: 'a_verifier',
      retardJours: 0,
      message: `Courrier déposé le ${dateIsoVersFr(date)}, dans le délai, mais reçu le ${dateIsoVersFr(reception)}, après le repère du ${dateIsoVersFr(repere)} : le texte ne dit pas si l'envoi ou la réception compte (${fondements.join(' ; ')}) ; vérifier le contrat.`,
    }
  return { etat: 'dans_le_delai', retardJours: 0, message: `${designation(date, retenue)}, dans le repère indicatif du ${dateIsoVersFr(repere)}.` }
}

function etatDuDelai(retenue: DateRetenue, contexte: ContexteEtat): EtatCalcule {
  if (retenue.date === null) return etatSansDeclaration(contexte)
  // Seule une date saisie (déclaration, ou transmission à la compagnie) peut suivre aujourd'hui (les courriers déposés
  // après ce jour sont écartés) : jamais remplacée, elle n'est pas comparée au repère.
  if (retenue.date > contexte.aujourdhui)
    return {
      etat: 'a_verifier',
      retardJours: 0,
      message: `${retenue.source === 'transmission' ? 'Transmission à la compagnie saisie' : 'Déclaration saisie'} au ${dateIsoVersFr(retenue.date)}, après aujourd'hui : date saisie à vérifier ; délai non contrôlé.`,
    }
  return etatDeclare(retenue.date, retenue, contexte)
}

/** J67, R55 : repère d'un jour non ouvrable ; le report est donné pour information, l'alerte suit la date sans report. */
const mentionReport = ({ date, dateReportee }: RepereDeclaration): string =>
  date !== null && dateReportee !== null
    ? ` Premier jour ouvrable suivant : ${dateIsoVersFr(dateReportee)} ; report non prévu par le texte : déclarer au plus tard le ${dateIsoVersFr(date)}.`
    : ''

/**
 * Contrôle du délai de déclaration : date saisie, à défaut dépôt du premier courrier de déclaration déposé au plus tard
 * aujourd'hui, comparée au repère (droit commun : reperesDelaisSinistre ; catastrophe naturelle : publication de l'arrêté
 * + 30 jours, sans report ; dommages-ouvrage : aucun). Courrier au courtier : le premier avis reçu par la compagnie (sa
 * transmission datée, ou un courrier qui lui est adressé), ou « à vérifier » sans mandat de l'assureur vu ; transmission
 * datée avant ce courrier : « à vérifier » (J67, R51). Sans date de déclaration, un suivi plus avancé (expertise, rapport,
 * règlement, clôture datés, à défaut phase saisie qui suit la déclaration) donne « déclaration non datée ». Survenance,
 * connaissance ou publication de l'arrêté d'une année improbable (faute de frappe) : « sans repère », date à corriger.
 * Signal indicatif, à confirmer (voir l'en-tête du module).
 */
export function controlerDelaiDeclaration(
  sinistre: SinistreIdentifie,
  courriers: readonly CourrierDeSinistre[],
  options: OptionsDelaiDeclaration,
): ControleDelaiDeclaration {
  verifierOptionsDelai(options)
  const { admis, futurs } = trierCourriers(sinistre, courriers, options.aujourdhui)
  const repere = repereDeclaration(sinistre.fiche, options)
  const retenue = retenueViaCourtier(dateRetenue(sinistre.fiche, admis[0] ?? null), admis, repere.date, champsCourtier(sinistre.fiche, options))
  const commun = {
    declarationAuPlusTard: repere.date,
    declarationAuPlusTardReportee: repere.dateReportee,
    delai: repere.delai,
    dateRetenue: retenue.date,
    source: retenue.source,
    courrierId: retenue.courrier?.id ?? null,
    fondements: repere.fondements,
    avertissement: repere.avertissement,
    aConfirmer: true as const,
  }
  if (repere.date === null) return { ...commun, etat: 'sans_repere', retardJours: 0, message: repere.motifSansRepere }
  const contexte: ContexteEtat = {
    fiche: sinistre.fiche,
    aujourdhui: options.aujourdhui,
    repere: repere.date,
    fondements: repere.fondements,
    futur: futurs[0],
    receptionSelonPolice: options.receptionSelonPolice === true,
  }
  const etat = etatDuDelai(retenue, contexte)
  return { ...commun, ...etat, message: `${etat.message}${mentionReport(repere)}` }
}
