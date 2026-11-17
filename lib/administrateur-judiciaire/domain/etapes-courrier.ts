import { dateIsoVersFr, estDateIsoValide, messagePlausibilite, plausibiliteDate, verifierAujourdhui } from '@/lib/administrateur-judiciaire/domain/dates'
import type { ModeleDeCourrier } from '@/lib/administrateur-judiciaire/domain/declaration-sinistre'
import { etatEtape, type EtapeTypeProcessus } from '@/lib/administrateur-judiciaire/domain/etapes'
import {
  MODES_REALISATION_ETAPE,
  TITRE_COPIE_AU_CS_POUR_INFO,
  USAGES_ETAPES_CABINET_PAR_DEFAUT,
  creerEtapeDossier,
  enchainerEtapeDossier,
  rattachementsUniques,
  type EtapeDossier,
  type ModeRealisationEtape,
  type NatureDemandeurEtape,
  type UsagesEtapesCabinet,
} from '@/lib/administrateur-judiciaire/domain/etapes-dossier'
import { memeRattachement, type Rattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import {
  MODES_CALCUL,
  NATURES_ELEMENT,
  categorieDe,
  creerElement,
  qualificationDe,
  type ModeCalcul,
  type NatureElement,
  type QualificationElement,
  type SaisieElement,
} from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import {
  ETAPE_TYPE_COPIE_AU_CS_POUR_INFO,
  creerModeleListeControle,
  type ModeleListeControle,
} from '@/lib/administrateur-judiciaire/domain/modeles-etapes'
import { normaliserTexteLibre } from '@/lib/administrateur-judiciaire/domain/texte'
import { DOSSIER, FAMILLE_MODELE_COURRIER, type Dossier, type FamilleModeleCourrier } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Étapes déclenchées par un courrier (point 50 du bilan 2) : règles « courrier (modèle ou famille) → étape type »,
 * paramétrées par le cabinet, et proposition des lignes d'honoraires du courrier. Fonctions pures, dates AAAA-MM-JJ,
 * montants en dix-millièmes d'euro (comme honoraires-facturation.ts), sans écran, table ni version Dexie : l'écran des
 * règles, leur stockage, le branchement à l'enregistrement du dépôt (db/courriers.ts, enregistrerDepot) et la table des
 * étapes relèvent de Frédéric. Distinct de l'enchaînement (etapes.enchainer, etapes-dossier.enchainerEtapeDossier), qui
 * ne part que d'une étape réalisée.
 *
 * Gestéam (cartographie, tranches lues) :
 * 🟢 Tranche 42 § Étapes du contentieux : « Copie au CS pour info », créée « Automatique » à la date et à l'heure de la
 *   mise en demeure, étape type n° 3, rattachement « Contentieux », réalisation par Courrier ; l'envoi de la mise en
 *   demeure génère automatiquement cette étape (🔵 pratique du cabinet). Complément du 28/10/2026 : processus Ouverture →
 *   Mise en demeure → Copie au conseil syndical. Apports, point 10 : une fonction distincte de enchainer (déclencheur =
 *   courrier d'un modèle ou d'une famille donnés), avec courrier d'origine et mode de réalisation.
 * 🟢 Tranche 43 § 1 (Flux d'un contentieux) : l'étape, jamais réalisée ; le courrier « Mise en demeure de payer »
 *   (Archivé) ; deux lignes d'honoraires générées par le courrier (frais d'envoi : copies, AR) ; une ligne « MISE EN
 *   DEMEURE » à facturer, datée du jour du dossier. 🔵 Le forfait vise les frais de recouvrement imputables au
 *   copropriétaire défaillant (L. 1965 art. 10-1, a) ; 🔴 à confirmer avec le cabinet.
 * 🟢 Tranche 22 § 1 et § 3, tranche 43 § 22 : 13 familles de modèles, libellés « Famille - LIBELLÉ - [contexte] - mode
 *   d'envoi » ; famille Contentieux, phase « Mise en demeure » : mise en demeure de payer (simple, avec décompte,
 *   locataire, adresse « relance »), procédure 19-2, procédure accélérée au fond (libellés exacts de ces deux derniers
 *   non relevés) ; « mise en demeure » et « RAR mise en demeure » en famille Comptabilité syndic. Liste des modèles
 *   échantillonnée, pas complète (06_PIEGES § 7) : aucun identifiant ni libellé de modèle n'est inventé ici.
 * 🟢 Tranche 27 : natures des éléments (Timbre, AR, Copie…) et catalogue des tarifs (« Contentieux - MISE EN DEMEURE »,
 *   « Comptabilité syndic - MISE EN DEMEURE », « Gestion - RAR », « Gestion - COPIE ») ; 🔵 un envoi de courrier génère
 *   ses éléments (copies, AR, timbres, diffuseur).
 *
 * Existant réutilisé, sans le refaire : etapes-dossier.ts (point 48 : creerEtapeDossier, enchainerEtapeDossier,
 * rattachementsUniques, UsagesEtapesCabinet, TITRE_COPIE_AU_CS_POUR_INFO ; EtapeDossier y reçoit deux champs
 * facultatifs, courrierOrigineId et modeRealisation, et MODES_REALISATION_ETAPE ; etapeCopieAuCsPourInfo, inchangée,
 * devient le premier cas d'une règle : regleCopieAuCsPourInfo crée la même étape, plus ces deux champs) ;
 * modeles-etapes.ts (point 49 : ETAPE_TYPE_COPIE_AU_CS_POUR_INFO, processusDuDossier, creerModeleListeControle) ;
 * fiches-liees.ts (point 47 : Rattachement) ;
 * declaration-sinistre.ts (ModeleDeCourrier : famille et libellé résolus par l'appelant depuis Courrier.modeleId) ;
 * honoraires-facturation.ts (point 66 : élément rattaché à une fiche, creerElement ; point 67 : qualification,
 * categorieDe) ; texte.ts (normaliserTexteLibre) ; dates.ts (plausibiliteDate).
 *
 * Décisions de Hugo (registre des décisions juridiques) :
 * - J20 : « Automatique » est réservé aux étapes que le logiciel crée seul ; l'étape née d'un courrier l'est (origine
 *   « automatique », sans créateur), donc visée par la règle des N jours ; l'étape enchaînée reste « manuelle ».
 * - J24 et J41 : « Copie au CS pour info » est un usage du cabinet, INACTIF par défaut : regleCopieAuCsPourInfo n'est
 *   active que si UsagesEtapesCabinet l'active ; les règles propres au cabinet sont, comme elle, désactivées par défaut.
 * - J64 (décision de Hugo du 17/11/2026 (J64) ; notes du 17/11/2026, section « Suite » : recommandations
 *   validées en bloc, numéro de registre proposé ; suite de J24 et J41) : la Copie au CS NAÎT DU COURRIER
 *   (NAISSANCE_COPIE_AU_CS_PAR_DEFAUT), seulement pour les mises en demeure du contentieux, procédure 19-2 comprise, pas
 *   pour les simples relances (DECLENCHEUR_MISE_EN_DEMEURE, estMiseEnDemeureDuContentieux) ; réglage désactivé par
 *   défaut (J41) ; usage du cabinet, sans obligation légale (J24 ; L. 1965 art. 21). Ferme les questions n° 1 et 2
 *   ci-dessous et la question n° 6 de modeles-etapes.ts. Les honoraires de la mise en demeure, que J64 ne vise pas,
 *   gardent leur déclencheur (DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE : famille Contentieux, libellé « mise en demeure »).
 * - 🔵 Rappel de J1 et J50 (délai de l'art. 42, aucune décision sur les étapes) : un délai ouvert par une notification
 *   part de la première présentation ou de la transmission de l'avis électronique, lues sur le courrier (courriers.ts),
 *   jamais du dépôt ; la date de dépôt, ici date de création de l'étape, ne fait donc courir aucun délai, et l'étape née
 *   du courrier n'a pas de limite.
 *
 * 🔵 Choix VitFix :
 * - Naissance de la Copie au CS : du courrier, comme Gestéam (tranche 43 § 1), décidé par J64 (valeur par défaut de
 *   NAISSANCE_COPIE_AU_CS_PAR_DEFAUT) ; « enchainement » reste un réglage possible du cabinet, qui désactive la règle et
 *   rend la main à l'enchaînement. Règle active, l'enchaînement ne crée pas le type d'étape qu'elle fait naître dans
 *   ce dossier, que le courrier soit déjà parti ou non (enchainerEtapeDossierSansDoublon) : sinon l'ordre des gestes
 *   donnerait deux étapes. Une règle désactivée en cours de dossier ne protège plus de ce doublon. Même choix pour une
 *   liste de contrôle (point 49) : modeleSansEtapesNeesDuCourrier retire du modèle les types nés du courrier avant
 *   l'instanciation (question n° 6, sans effet sur modeleDuDossier) ;
 * - déclencheur par défaut de la Copie au CS (J64 : DECLENCHEUR_MISE_EN_DEMEURE, estMiseEnDemeureDuContentieux) : modèle
 *   de la famille Contentieux dont le libellé dit « mise en demeure » ou cite la procédure « 19-2 » (mots entiers et dans
 *   l'ordre ; casse, accents et ponctuation ignorés), sauf une relance (le mot « relance » placé avant ces mots :
 *   « Relance mise en demeure ») ; « adresse relance » placé après ne retire rien. Libellés exacts des modèles
 *   « procédure 19-2 » et « procédure accélérée au fond » non relevés : le second n'est visé que si son libellé dit
 *   « mise en demeure » ou « 19-2 », sinon le cabinet le liste par modèle ; les mises en demeure de la Comptabilité
 *   syndic ne sont pas visées (« du contentieux » lu comme la famille Contentieux). Le cabinet peut remplacer ce
 *   déclencheur par la liste de ses modèles, ou par une famille et un libellé (un libellé sans lettre ni chiffre est
 *   refusé) ;
 * - date de création = date de dépôt du courrier (sa date d'envoi), au plus tard aujourd'hui (plausibiliteDate) ;
 *   Gestéam note aussi l'heure, VitFix ne garde que la date ; courrier non déposé : refus (l'étape naît de l'envoi) ;
 * - étape rattachée au seul dossier du type de la règle (🟢 « rattachement Contentieux »), une par dossier si le courrier
 *   en vise plusieurs (rattachements du courrier sans doublon : un même dossier cité deux fois n'en fait qu'un) ;
 *   acteurs (demandeur, réalisateur) fournis par l'appelant, comme pour etapeCopieAuCsPourInfo ;
 *   identifiants fournis par l'appelant (idEtape), refusés s'ils sont déjà pris ;
 * - anti-doublon : par dossier, type d'étape et courrier d'origine. Un second déclenchement du même courrier, ou deux
 *   règles du même type, ne recréent rien (l'étape déjà née est citée) ; une autre mise en demeure crée sa propre
 *   étape ; une étape du même type encore à faire sans courrier d'origine (saisie, liste) donne un avertissement, non
 *   bloquant ;
 * - honoraires : une PROPOSITION de saisies d'éléments (SaisieElement contrôlées par creerElement), jamais écrites ;
 *   règles désactivées par défaut, aucune ligne ni aucun montant par défaut (réglage du cabinet) ; date = dépôt du
 *   courrier (🟢 le forfait observé était daté du jour du dossier) ; un seul dossier visé (un envoi, une série de
 *   frais) ; frais d'envoi d'une nature de frais seulement (categorieDe) ; calcul « Coût unitaire » par défaut ; base à
 *   confirmer (🔴) pour le forfait ET pour les frais d'envoi (questions n° 3 et 4).
 *
 * 🔴 Non établi — questions :
 * 1. et 2. Fermées par J64 (ci-dessus) : la Copie au CS naît du courrier ; les mises en demeure du contentieux la font
 *    naître, procédure 19-2 comprise, pas les simples relances.
 * 3. Cabinet (Frédéric ou Hugo) : le forfait de mise en demeure est-il imputé au copropriétaire défaillant (frais de
 *    recouvrement, L. 1965 art. 10-1, a) ou facturé au syndicat ? Montant, tarif, destinataire ; en administration
 *    provisoire, sur quelle base ?
 * 4. Frédéric : frais d'envoi de la mise en demeure : remboursés à part au syndic (contrat type, D. 1967 annexe 1, 7.1.5
 *    et 7.2.1), ou imputés au copropriétaire comme frais de mise en demeure (L. 1965 art. 10-1, a) ? Hors contrat type
 *    de syndic (administration provisoire) : remboursés à part, sur quel texte ? (question ouverte de
 *    honoraires-sinistre.ts).
 * 5. Frédéric : l'élément à facturer n'a pas de champ « courrier d'origine » : un second déclenchement propose de nouveau
 *    les lignes, sans anti-doublon. Champ et table : Frédéric.
 * 6. Frédéric ou Hugo : liste de contrôle du contentieux instanciée avec l'usage actif (modeleDuDossier) : la Copie au CS
 *    y figure et doublerait celle du courrier (seul un avertissement le signale au déclenchement). Faut-il toujours
 *    instancier le modèle sans elle (modeleSansEtapesNeesDuCourrier, à appeler par l'écran ou le repository ;
 *    modeleDuDossier reste inchangé) ? Lien avec la question n° 5 de modeles-etapes.ts.
 * 7. Hugo : autres modes de réalisation de Gestéam (⚪ seul « Courrier » est relevé) ; l'étape « réalisée par courrier »
 *    se réalise-t-elle au dépôt du courrier de copie au conseil syndical ? Non branché.
 *
 * Le droit : aucun texte lu n'impose la copie au conseil syndical d'une mise en demeure (J24 : usage du cabinet) ; ces
 * règles sont des règles de GESTION, sans délai légal. L. 1965 art. 10-1, a : cité d'après la tranche 43 § 1 et la
 * lecture de honoraires-facturation.ts (point 67) ; non relu pour ce module (Légifrance : erreur 404 le 16/11/2026). Sa
 * citation par un jugement de 2025 (TJ Bobigny) y range « notamment les frais de mise en demeure » : l'imputation du
 * forfait ET des frais d'envoi de la mise en demeure reste 🔴, à confirmer avec le cabinet sur le texte en vigueur.
 */

// ─── Contrôles communs ──────────────────────────────────────────────────────────────────────

const texteRequis = (valeur: string | null | undefined, message: string): string => {
  const brut = valeur?.trim() ?? ''
  if (!brut) throw new Error(message)
  return brut
}

const MODES_REALISATION_ADMIS: ReadonlySet<string> = new Set(MODES_REALISATION_ETAPE)

function verifierFamille(famille: string, quoi: string): void {
  if (!(FAMILLE_MODELE_COURRIER as readonly string[]).includes(famille))
    throw new Error(`${quoi} : famille de modèle inconnue « ${famille} » (référentiel FAMILLE_MODELE_COURRIER attendu).`)
}

function verifierDossier(dossier: string, quoi: string): void {
  if (!(DOSSIER as readonly string[]).includes(dossier))
    throw new Error(`${quoi} : type de dossier inconnu « ${dossier} » (référentiel DOSSIER attendu).`)
}

function sansIdentifiantEnDouble<R extends { id: string }>(regles: R[]): R[] {
  const vus = new Set<string>()
  for (const regle of regles) {
    if (vus.has(regle.id)) throw new Error(`Règle « ${regle.id} » en double dans le réglage du cabinet.`)
    vus.add(regle.id)
  }
  return regles
}

// ─── Déclencheur : un modèle ou une famille de courrier ─────────────────────────────────────

/**
 * Par modèle : les identifiants des modèles du cabinet (Courrier.modeleId) ; par famille : la famille, et au besoin un
 * libellé ; mises en demeure du contentieux : les modèles de mise en demeure de la famille Contentieux, procédure 19-2
 * comprise, hors relances (décision de Hugo du 17/11/2026, J64 : estMiseEnDemeureDuContentieux).
 */
export type DeclencheurEtapeCourrier =
  | { par: 'modele'; modeleIds: readonly string[] }
  | { par: 'famille'; famille: FamilleModeleCourrier; libelleContient?: string | null }
  | { par: 'mise_en_demeure_contentieux' }

/**
 * Déclencheur contrôlé : identifiants sans espaces ni doublon ; libellé vide ou blanc = aucun filtre (null) ; un libellé
 * sans lettre ni chiffre est refusé (normalisé, il viserait toute la famille).
 */
export type DeclencheurControle =
  | { par: 'modele'; modeleIds: string[] }
  | { par: 'famille'; famille: FamilleModeleCourrier; libelleContient: string | null }
  | { par: 'mise_en_demeure_contentieux' }

function controlerLibelleContient(libelle: string | null | undefined, quoi: string): string | null {
  const brut = libelle?.trim() || null
  if (brut !== null && normaliserTexteLibre(brut) === '')
    throw new Error(`${quoi} : libellé du modèle « ${brut} » sans lettre ni chiffre ; il viserait tous les modèles de la famille.`)
  return brut
}

function controlerDeclencheur(declencheur: DeclencheurEtapeCourrier, quoi: string): DeclencheurControle {
  if (declencheur.par === 'modele') {
    const modeleIds = [...new Set(declencheur.modeleIds.map((id) => id.trim()).filter(Boolean))]
    if (modeleIds.length === 0) throw new Error(`${quoi} : au moins un modèle de courrier attendu (identifiant du modèle).`)
    return { par: 'modele', modeleIds }
  }
  if (declencheur.par === 'famille') {
    verifierFamille(declencheur.famille, quoi)
    return { par: 'famille', famille: declencheur.famille, libelleContient: controlerLibelleContient(declencheur.libelleContient, quoi) }
  }
  if (declencheur.par === 'mise_en_demeure_contentieux') return { par: 'mise_en_demeure_contentieux' }
  const inconnu: unknown = (declencheur as { par?: unknown }).par
  throw new Error(`${quoi} : déclencheur inconnu « ${String(inconnu)} » (par modèle, par famille ou mises en demeure du contentieux attendu).`)
}

/**
 * Déclencheur par défaut de la Copie au CS : les mises en demeure de la famille Contentieux, procédure 19-2 comprise, pas
 * les simples relances (décision de Hugo du 17/11/2026, J64 ; estMiseEnDemeureDuContentieux). Le cabinet peut le
 * remplacer par la liste de ses modèles. Les honoraires de la mise en demeure gardent le leur
 * (DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE) : J64 ne les vise pas.
 */
export const DECLENCHEUR_MISE_EN_DEMEURE: Readonly<DeclencheurControle> = Object.freeze({ par: 'mise_en_demeure_contentieux' })

/**
 * 🔵 Déclencheur par défaut des honoraires de la mise en demeure (regleHonorairesMiseEnDemeure), inchangé depuis le
 * point 50 : un modèle de la famille Contentieux dont le libellé dit « mise en demeure » (mots entiers et dans l'ordre).
 * J64 ne vise que la Copie au CS : ni la procédure 19-2 ni l'exclusion des relances ne s'appliquent ici (questions n° 3
 * et 4, ci-dessus).
 */
export const DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE: Readonly<DeclencheurControle> = Object.freeze({
  par: 'famille',
  famille: 'Contentieux',
  libelleContient: 'mise en demeure',
})

/**
 * Mots qui font d'un modèle du contentieux une mise en demeure (J64) : « mise en demeure », ou la procédure de l'art. 19-2
 * (« 19-2 » : son libellé exact n'est pas relevé, tranches 22 et 43 § 22).
 */
const MOTS_MISE_EN_DEMEURE = ['mise en demeure', '19-2'] as const
/** Une relance cite parfois la mise en demeure (« Relance mise en demeure ») : ce mot placé avant en fait une relance (J64). */
const MOTS_RELANCE = ['relance', 'relances'] as const

/** Le courrier, tel que l'appelant le lit : son modèle (famille et libellé) est résolu depuis Courrier.modeleId. */
export interface CourrierDeclencheur {
  id: string
  /** Courrier.modeleId. */
  modeleId: string
  modele: ModeleDeCourrier
  /** Courrier.dateDepot : la date d'envoi ; null tant que le courrier n'est pas déposé. */
  dateDepot: string | null
  /** Fiches visées par le courrier (point 47) ; le dossier : { type: 'Contentieux', id }. */
  rattachements: readonly Rattachement[]
  /** Pour les lignes d'honoraires : le syndicat qui supporte la charge et le mandat (Courrier.coproprieteId, mandatId). */
  coproprieteId?: string | null
  mandatId?: string | null
}

/** Mots entiers : « ar » ne se trouve pas dans « garant », ni « mise en demeure » dans « remise en demeure ». */
const contientLesMots = (libelle: string, mots: string): boolean => ` ${normaliserTexteLibre(libelle)} `.includes(` ${normaliserTexteLibre(mots)} `)

/** Première position des mots (entiers, normalisés) dans le libellé normalisé encadré d'espaces ; null s'ils n'y sont pas. */
function premierePosition(libelleEncadre: string, mots: readonly string[]): number | null {
  const positions = mots.map((m) => libelleEncadre.indexOf(` ${normaliserTexteLibre(m)} `)).filter((i) => i >= 0)
  return positions.length === 0 ? null : Math.min(...positions)
}

/**
 * Mise en demeure du contentieux (décision de Hugo du 17/11/2026, J64) : modèle de la famille Contentieux dont le libellé
 * dit « mise en demeure » ou cite la procédure « 19-2 » (mots entiers, dans l'ordre ; casse, accents et ponctuation
 * ignorés), sauf une relance : le mot « relance » placé avant (« Relance mise en demeure ») ; placé après, il ne retire
 * rien (« Mise en demeure de payer - adresse relance », tranche 22 § 3). Hors famille Contentieux (« RAR mise en demeure »
 * de la Comptabilité syndic) : non.
 */
export function estMiseEnDemeureDuContentieux(modele: ModeleDeCourrier): boolean {
  if (modele.famille !== 'Contentieux') return false
  const libelle = ` ${normaliserTexteLibre(modele.libelle)} `
  const miseEnDemeure = premierePosition(libelle, MOTS_MISE_EN_DEMEURE)
  if (miseEnDemeure === null) return false
  const relance = premierePosition(libelle, MOTS_RELANCE)
  return relance === null || relance > miseEnDemeure
}

const declenche = (courrier: Pick<CourrierDeclencheur, 'modeleId' | 'modele'>, declencheur: DeclencheurControle): boolean => {
  if (declencheur.par === 'modele') return declencheur.modeleIds.includes(courrier.modeleId.trim())
  if (declencheur.par === 'mise_en_demeure_contentieux') return estMiseEnDemeureDuContentieux(courrier.modele)
  if (courrier.modele.famille !== declencheur.famille) return false
  return declencheur.libelleContient === null || contientLesMots(courrier.modele.libelle, declencheur.libelleContient)
}

/**
 * Le courrier relève-t-il du déclencheur ? Par modèle : son identifiant de modèle est listé (famille et libellé
 * ignorés). Par famille : même famille et, si un libellé est donné, libellé du modèle qui en contient les mots, entiers
 * et dans l'ordre (casse, accents et ponctuation ignorés). Mises en demeure du contentieux : estMiseEnDemeureDuContentieux
 * (J64). Refus : déclencheur invalide.
 */
export function courrierDeclenche(courrier: Pick<CourrierDeclencheur, 'modeleId' | 'modele'>, declencheur: DeclencheurEtapeCourrier): boolean {
  return declenche(courrier, controlerDeclencheur(declencheur, 'Déclencheur'))
}

interface CourrierEnvoye {
  id: string
  modeleId: string
  modele: ModeleDeCourrier
  dateDepot: string
  rattachements: Rattachement[]
  coproprieteId: string | null
  mandatId: string | null
}

/**
 * Courrier contrôlé : identifiants, famille du modèle, dépôt daté (AAAA-MM-JJ), au plus tard aujourd'hui et d'une année
 * plausible, rattachements du référentiel. Les étapes et les lignes naissent de l'envoi : un courrier non déposé est
 * refusé.
 */
function controlerCourrier(courrier: CourrierDeclencheur, aujourdhui: string): CourrierEnvoye {
  verifierAujourdhui(aujourdhui)
  const id = texteRequis(courrier.id, 'Déclenchement refusé : identifiant du courrier attendu.')
  const modeleId = texteRequis(courrier.modeleId, `Déclenchement refusé : modèle du courrier ${id} attendu (Courrier.modeleId).`)
  verifierFamille(courrier.modele.famille, `Courrier ${id}`)
  const { dateDepot } = courrier
  if (dateDepot === null || dateDepot === undefined)
    throw new Error(
      `Déclenchement refusé : le courrier ${id} n’est pas envoyé (date de dépôt absente) ; étapes et lignes d’honoraires naissent de l’envoi.`,
    )
  if (!estDateIsoValide(dateDepot)) throw new Error(`Date de dépôt du courrier ${id} invalide (${dateDepot}) : AAAA-MM-JJ attendu.`)
  const plausibilite = plausibiliteDate(dateDepot, aujourdhui, { futurAdmis: false })
  if (plausibilite !== null) throw new Error(`Déclenchement refusé, courrier ${id} : ${messagePlausibilite('Dépôt daté', dateDepot, plausibilite)}`)
  return {
    id,
    modeleId,
    modele: courrier.modele,
    dateDepot,
    // Sans doublon : un même dossier rattaché deux fois (espaces compris) n'est qu'un dossier ; sinon il ferait écarter
    // les honoraires comme « ambigus » et compter une étape « déjà créée » (relecture).
    rattachements: rattachementsUniques(courrier.rattachements),
    coproprieteId: courrier.coproprieteId?.trim() || null,
    mandatId: courrier.mandatId?.trim() || null,
  }
}

// ─── Règles « courrier → étape type » ───────────────────────────────────────────────────────

export interface SaisieRegleEtapeCourrier {
  id: string
  libelle: string
  declencheur: DeclencheurEtapeCourrier
  /** Type du dossier du courrier auquel l'étape se rattache (référentiel DOSSIER, point 47). */
  dossier: Dossier
  /** Étape type créée (code, comme EtapeTypeProcessus.etapeType ; point 49). */
  etapeType: string
  titre: string
  /** Absent : null (non précisé). */
  modeRealisation?: ModeRealisationEtape | null
  /** Réglage du cabinet ; absent : désactivée (J41 pour la Copie au CS, même règle pour les autres). */
  active?: boolean
}

export interface RegleEtapeCourrier {
  id: string
  libelle: string
  declencheur: DeclencheurControle
  dossier: Dossier
  etapeType: string
  titre: string
  modeRealisation: ModeRealisationEtape | null
  active: boolean
}

/**
 * Règle contrôlée. Refus : identifiant, libellé, type d'étape ou titre vides ; déclencheur invalide (aucun modèle,
 * famille inconnue) ; type de dossier hors référentiel DOSSIER ; mode de réalisation inconnu. Désactivée sans réglage.
 * Sert aussi à recontrôler une règle relue d'un stockage.
 */
export function creerRegleEtapeCourrier(saisie: SaisieRegleEtapeCourrier): RegleEtapeCourrier {
  const id = texteRequis(saisie.id, 'Règle « courrier → étape » : identifiant de la règle attendu.')
  const libelle = texteRequis(saisie.libelle, `Règle « ${id} » : libellé attendu.`)
  const quoi = `Règle « ${libelle} »`
  const declencheur = controlerDeclencheur(saisie.declencheur, quoi)
  verifierDossier(saisie.dossier, quoi)
  const etapeType = texteRequis(saisie.etapeType, `${quoi} : type d’étape attendu.`)
  const titre = texteRequis(saisie.titre, `${quoi} : titre de l’étape attendu.`)
  const modeRealisation = saisie.modeRealisation ?? null
  if (modeRealisation !== null && !MODES_REALISATION_ADMIS.has(modeRealisation))
    throw new Error(`${quoi} : mode de réalisation inconnu « ${modeRealisation} » (« courrier » attendu, ou aucun).`)
  return { id, libelle, declencheur, dossier: saisie.dossier, etapeType, titre, modeRealisation, active: saisie.active === true }
}

/** Règles du cabinet contrôlées (creerRegleEtapeCourrier) ; refus : deux règles de même identifiant. */
export function verifierReglesEtapesCourrier(regles: readonly SaisieRegleEtapeCourrier[]): RegleEtapeCourrier[] {
  return sansIdentifiantEnDouble(regles.map((regle) => creerRegleEtapeCourrier(regle)))
}

// ─── Premier cas : « Copie au CS pour info » (tranches 42 et 43 § 1 ; J24, J41) ──────────────

export const ID_REGLE_COPIE_AU_CS_POUR_INFO = 'copie-au-cs-pour-info'

/** Origine de la Copie au CS, usage activé : le courrier (par défaut, J64) ou l'enchaînement (réglage du cabinet). */
export const NAISSANCES_COPIE_AU_CS = ['courrier', 'enchainement'] as const
export type NaissanceCopieAuCs = (typeof NAISSANCES_COPIE_AU_CS)[number]
const NAISSANCES_ADMISES: ReadonlySet<string> = new Set(NAISSANCES_COPIE_AU_CS)

/** Comme Gestéam (tranche 43 § 1) : la Copie au CS naît du courrier (décision de Hugo du 17/11/2026, J64). */
export const NAISSANCE_COPIE_AU_CS_PAR_DEFAUT: NaissanceCopieAuCs = 'courrier'

/**
 * La règle « mise en demeure → Copie au CS pour info » : dossier Contentieux, étape type n° 3
 * (ETAPE_TYPE_COPIE_AU_CS_POUR_INFO), réalisation par courrier (🟢 tranche 42). Active seulement si l'usage du cabinet
 * l'est (J24, J41 : inactif par défaut) et que la naissance retenue est le courrier ; avec « enchainement », elle reste
 * inactive et l'enchaînement crée l'étape (processusDuDossier). Déclencheur par défaut : les mises en demeure du
 * contentieux, 19-2 comprise, pas les relances (J64). Refus : naissance inconnue, déclencheur invalide.
 */
export function regleCopieAuCsPourInfo({
  usages = USAGES_ETAPES_CABINET_PAR_DEFAUT,
  naissance = NAISSANCE_COPIE_AU_CS_PAR_DEFAUT,
  declencheur = DECLENCHEUR_MISE_EN_DEMEURE,
}: { usages?: UsagesEtapesCabinet; naissance?: NaissanceCopieAuCs; declencheur?: DeclencheurEtapeCourrier } = {}): RegleEtapeCourrier {
  if (!NAISSANCES_ADMISES.has(naissance))
    throw new Error(`Copie au CS pour info : naissance inconnue « ${naissance} » (« courrier » ou « enchainement » attendu).`)
  return creerRegleEtapeCourrier({
    id: ID_REGLE_COPIE_AU_CS_POUR_INFO,
    libelle: 'Copie au CS pour info à la mise en demeure',
    declencheur,
    dossier: 'Contentieux',
    etapeType: ETAPE_TYPE_COPIE_AU_CS_POUR_INFO,
    titre: TITRE_COPIE_AU_CS_POUR_INFO,
    modeRealisation: 'courrier',
    active: usages.copieAuCsPourInfo && naissance === 'courrier',
  })
}

/** Règle gelée en profondeur (déclencheur et liste des modèles compris) : un réglage partagé ne se modifie pas par mégarde. */
function regleGelee(regle: RegleEtapeCourrier): Readonly<RegleEtapeCourrier> {
  if (regle.declencheur.par === 'modele') Object.freeze(regle.declencheur.modeleIds)
  Object.freeze(regle.declencheur)
  return Object.freeze(regle)
}

/** Réglage par défaut : la seule règle de la Copie au CS, inactive (J41). */
export const REGLES_ETAPES_COURRIER_PAR_DEFAUT: readonly RegleEtapeCourrier[] = Object.freeze([regleGelee(regleCopieAuCsPourInfo())])

/** Types d'étapes que les règles actives font naître d'un courrier dans un type de dossier (l'enchaînement ne les crée pas). */
export function typesEtapesNeesDuCourrier(regles: readonly SaisieRegleEtapeCourrier[], dossier: Dossier): string[] {
  return [
    ...new Set(
      verifierReglesEtapesCourrier(regles)
        .filter((r) => r.active && r.dossier === dossier)
        .map((r) => r.etapeType),
    ),
  ]
}

/**
 * Le modèle de liste de contrôle sans les types d'étapes que les règles actives font naître d'un courrier dans son type de
 * dossier (point 49) : suite de J64 (naissance par le courrier), appliquée à l'instanciation comme à l'enchaînement (avec
 * l'usage actif, la liste du contentieux contient la Copie au CS ; instanciée telle quelle, le courrier en créerait une
 * seconde). À l'appelant de s'en servir avant instancierModele (question n° 6). Règles inactives : le modèle contrôlé, tel
 * quel. Le modèle reçu n'est pas modifié. Refus : modèle ou règles invalides ; toutes les étapes du modèle naissent d'un
 * courrier (une liste de contrôle n'est jamais vide).
 */
export function modeleSansEtapesNeesDuCourrier(
  modele: ModeleListeControle,
  regles: readonly SaisieRegleEtapeCourrier[],
): ModeleListeControle {
  const controle = creerModeleListeControle(modele)
  const neesDuCourrier = new Set(typesEtapesNeesDuCourrier(regles, controle.dossier))
  const etapes = controle.etapes.filter((etape) => !neesDuCourrier.has(etape.etapeType))
  if (etapes.length === controle.etapes.length) return controle
  if (etapes.length === 0)
    throw new Error(`Modèle « ${controle.titre} » : toutes ses étapes naissent d’un courrier (règles actives du cabinet) ; rien à instancier.`)
  return creerModeleListeControle({ ...controle, etapes })
}

// ─── Lecture des deux champs de l'étape ─────────────────────────────────────────────────────

/** Courrier d'origine de l'étape ; absent, vide ou null : null (étape saisie, enchaînée ou instanciée). */
export const courrierOrigineDe = (etape: EtapeDossier): string | null => etape.courrierOrigineId?.trim() || null

/** Mode de réalisation ; absent : null. Lève sur une valeur inconnue (donnée corrompue). */
export function modeRealisationDe(etape: EtapeDossier): ModeRealisationEtape | null {
  const mode = etape.modeRealisation ?? null
  if (mode !== null && !MODES_REALISATION_ADMIS.has(mode)) throw new Error(`Étape ${etape.id} : mode de réalisation inconnu « ${mode} ».`)
  return mode
}

const dansLeDossier = (etape: EtapeDossier, dossier: Rattachement): boolean => etape.rattachements.some((r) => memeRattachement(r, dossier))

// ─── Déclenchement ──────────────────────────────────────────────────────────────────────────

export interface CibleEtapeCourrier {
  regle: RegleEtapeCourrier
  dossier: Rattachement
}

export interface ContexteDeclenchementEtapes {
  aujourdhui: string
  /** Identifiant de chaque étape à créer (une par règle retenue et par dossier), fourni par l'appelant. */
  idEtape: (cible: CibleEtapeCourrier) => string
  /** Acteurs de l'étape, fournis par l'appelant (non observés), comme pour etapeCopieAuCsPourInfo. */
  demandeurId: string
  demandeurNature: NatureDemandeurEtape
  realisateurId?: string | null
  /** Étapes déjà enregistrées (au moins celles des dossiers du courrier) : anti-doublon et identifiants pris. */
  etapesExistantes: readonly EtapeDossier[]
}

export const MOTIFS_REGLE_ECARTEE = ['inactive', 'dossier_absent', 'deja_creee'] as const
export type MotifRegleEcartee = (typeof MOTIFS_REGLE_ECARTEE)[number]

/** Règle qui vise le courrier sans créer d'étape. */
export interface RegleEcartee {
  regleId: string
  motif: MotifRegleEcartee
  /** Dossier visé (deja_creee) ; null pour une règle inactive ou sans dossier du type. */
  dossier: Rattachement | null
  /** Étape déjà née de ce courrier dans ce dossier (deja_creee) ; null sinon. */
  etapeId: string | null
  message: string
}

export interface ResultatDeclenchementEtapes {
  courrierId: string
  /** Étapes créées, dans l'ordre des règles puis des dossiers du courrier. */
  etapes: EtapeDossier[]
  ecartees: RegleEcartee[]
  /** Avertissements non bloquants (étape du même type déjà ouverte sans courrier d'origine). */
  avertissements: string[]
}

interface Declenchement {
  courrier: CourrierEnvoye
  contexte: ContexteDeclenchementEtapes
  idsPris: Set<string>
  resultat: ResultatDeclenchementEtapes
}

/** L'étape automatique née du courrier : creerEtapeDossier (mêmes contrôles), puis courrier d'origine et mode. */
function etapeNeeDuCourrier(d: Declenchement, regle: RegleEtapeCourrier, dossier: Rattachement): EtapeDossier {
  const etape = creerEtapeDossier({
    id: d.contexte.idEtape({ regle, dossier }),
    titre: regle.titre,
    etapeType: regle.etapeType,
    creeeLe: d.courrier.dateDepot,
    origine: 'automatique',
    creeeParId: null,
    demandeurId: d.contexte.demandeurId,
    demandeurNature: d.contexte.demandeurNature,
    realisateurId: d.contexte.realisateurId ?? null,
    rattachements: [dossier],
  })
  if (d.idsPris.has(etape.id)) throw new Error(`Déclenchement refusé : identifiant d’étape « ${etape.id} » déjà pris.`)
  d.idsPris.add(etape.id)
  return { ...etape, courrierOrigineId: d.courrier.id, modeRealisation: regle.modeRealisation }
}

/** Étapes du même type encore à faire dans le dossier, sans courrier d'origine : doublon possible, signalé. */
function avertissementsDoublon(d: Declenchement, etape: EtapeDossier, dossier: Rattachement): string[] {
  return d.contexte.etapesExistantes
    .filter(
      (e) =>
        e.etapeType === etape.etapeType &&
        courrierOrigineDe(e) === null &&
        dansLeDossier(e, dossier) &&
        etatEtape(e, d.contexte.aujourdhui).statut === 'a_faire',
    )
    .map(
      (e) =>
        `Dossier ${dossier.type} ${dossier.id} : l’étape « ${e.titre} » ${e.id} est déjà ouverte sans courrier d’origine (saisie, enchaînement ou liste de contrôle) : vérifier le doublon.`,
    )
}

function appliquerAuDossier(d: Declenchement, regle: RegleEtapeCourrier, dossier: Rattachement): void {
  const deja = [...d.contexte.etapesExistantes, ...d.resultat.etapes].find(
    (e) => e.etapeType === regle.etapeType && courrierOrigineDe(e) === d.courrier.id && dansLeDossier(e, dossier),
  )
  if (deja) {
    d.resultat.ecartees.push({
      regleId: regle.id,
      motif: 'deja_creee',
      dossier,
      etapeId: deja.id,
      message: `Règle « ${regle.libelle} » : l’étape « ${regle.titre} » est déjà née du courrier ${d.courrier.id} dans le dossier ${dossier.type} ${dossier.id} (étape ${deja.id}).`,
    })
    return
  }
  const etape = etapeNeeDuCourrier(d, regle, dossier)
  d.resultat.avertissements.push(...avertissementsDoublon(d, etape, dossier))
  d.resultat.etapes.push(etape)
}

function appliquerRegle(d: Declenchement, regle: RegleEtapeCourrier): void {
  if (!regle.active) {
    d.resultat.ecartees.push({
      regleId: regle.id,
      motif: 'inactive',
      dossier: null,
      etapeId: null,
      message: `Règle « ${regle.libelle} » inactive : réglage du cabinet, désactivée par défaut ; aucune étape créée.`,
    })
    return
  }
  const dossiers = d.courrier.rattachements.filter((r) => r.type === regle.dossier)
  if (dossiers.length === 0) {
    d.resultat.ecartees.push({
      regleId: regle.id,
      motif: 'dossier_absent',
      dossier: null,
      etapeId: null,
      message: `Règle « ${regle.libelle} » : le courrier ${d.courrier.id} n’est rattaché à aucun dossier « ${regle.dossier} » ; aucune étape créée.`,
    })
    return
  }
  for (const dossier of dossiers) appliquerAuDossier(d, regle, dossier)
}

/**
 * Étapes nées de l'envoi d'un courrier (distinct de l'enchaînement) : pour chaque règle qui vise le courrier (modèle ou
 * famille), active, une étape « Automatique » de l'étape type de la règle, créée à la date de dépôt du courrier,
 * rattachée à son dossier du type de la règle, avec courrierOrigineId et modeRealisation ; une règle qui ne vise pas le
 * courrier est ignorée. Anti-doublon par dossier, type d'étape et courrier d'origine (l'étape déjà née est citée).
 * Refus : courrier invalide ou non déposé, dépôt postérieur à aujourd'hui ou d'une année improbable, règles invalides ou
 * en double, identifiant d'étape déjà pris, et les refus de creerEtapeDossier (demandeur, nature).
 */
export function declencherEtapesDuCourrier(
  courrier: CourrierDeclencheur,
  regles: readonly SaisieRegleEtapeCourrier[],
  contexte: ContexteDeclenchementEtapes,
): ResultatDeclenchementEtapes {
  const envoye = controlerCourrier(courrier, contexte.aujourdhui)
  const d: Declenchement = {
    courrier: envoye,
    contexte,
    idsPris: new Set(contexte.etapesExistantes.map((e) => e.id)),
    resultat: { courrierId: envoye.id, etapes: [], ecartees: [], avertissements: [] },
  }
  for (const regle of verifierReglesEtapesCourrier(regles)) if (declenche(envoye, regle.declencheur)) appliquerRegle(d, regle)
  return d.resultat
}

// ─── Enchaînement sans doublon ──────────────────────────────────────────────────────────────

export const MOTIFS_SANS_ENCHAINEMENT = ['fin_de_processus', 'nee_du_courrier'] as const
export type MotifSansEnchainement = (typeof MOTIFS_SANS_ENCHAINEMENT)[number]

export interface ResultatEnchainementSansDoublon {
  /** L'étape enchaînée (enchainerEtapeDossier) ; null en fin de processus ou pour un type né du courrier. */
  etape: EtapeDossier | null
  motif: MotifSansEnchainement | null
  message: string | null
  /** Étapes de ce type déjà nées d'un courrier dans le dossier (nee_du_courrier) ; vide sinon. */
  etapesDuCourrier: EtapeDossier[]
}

function messageNeeDuCourrier(regle: RegleEtapeCourrier, etapesDuCourrier: readonly EtapeDossier[]): string {
  const debut = `« ${regle.titre} » naît du courrier (règle « ${regle.libelle} », choix par défaut, réversible)`
  if (etapesDuCourrier.length === 0)
    return `${debut} : l’enchaînement ne la crée pas ; aucune n’est encore née d’un courrier dans ce dossier : elle naîtra de l’envoi d’un courrier visé par la règle (vérifier que le courrier envoyé relève de son modèle ou de sa famille).`
  const deja = etapesDuCourrier.map((e) => `${e.id} (courrier ${courrierOrigineDe(e)}, le ${dateIsoVersFr(e.creeeLe)})`).join(', ')
  return `${debut} : l’enchaînement ne la recrée pas ; déjà créée : ${deja}.`
}

/**
 * enchainerEtapeDossier (mêmes refus, J20 compris), sauf pour un type d'étape qu'une règle active fait naître d'un
 * courrier dans le dossier de l'étape (J64 : elle naît du courrier) : aucune création, que le courrier soit déjà parti
 * ou non ; les étapes déjà nées d'un courrier dans ce dossier sont citées. Règles inactives (par défaut, ou naissance
 * « enchainement ») : l'enchaînement est inchangé.
 */
export function enchainerEtapeDossierSansDoublon(
  etape: EtapeDossier,
  processus: EtapeTypeProcessus[],
  saisie: { id: string; date: string; creeeParId: string },
  { regles, etapesExistantes }: { regles: readonly SaisieRegleEtapeCourrier[]; etapesExistantes: readonly EtapeDossier[] },
): ResultatEnchainementSansDoublon {
  const controlees = verifierReglesEtapesCourrier(regles)
  const suivante = enchainerEtapeDossier(etape, processus, saisie)
  if (!suivante) return { etape: null, motif: 'fin_de_processus', message: null, etapesDuCourrier: [] }
  const regle = controlees.find(
    (r) => r.active && r.etapeType === suivante.etapeType && suivante.rattachements.some((dossier) => dossier.type === r.dossier),
  )
  if (!regle) return { etape: suivante, motif: null, message: null, etapesDuCourrier: [] }
  const dossiers = suivante.rattachements.filter((dossier) => dossier.type === regle.dossier)
  const etapesDuCourrier = etapesExistantes.filter(
    (e) => e.etapeType === regle.etapeType && courrierOrigineDe(e) !== null && dossiers.some((dossier) => dansLeDossier(e, dossier)),
  )
  return { etape: null, motif: 'nee_du_courrier', message: messageNeeDuCourrier(regle, etapesDuCourrier), etapesDuCourrier }
}

// ─── Lignes d'honoraires du courrier : proposition, désactivée par défaut ──────────────────

export const OBJETS_LIGNE_HONORAIRES_COURRIER = ['frais_envoi', 'forfait_mise_en_demeure'] as const
export type ObjetLigneHonorairesCourrier = (typeof OBJETS_LIGNE_HONORAIRES_COURRIER)[number]
const OBJETS_ADMIS: ReadonlySet<string> = new Set(OBJETS_LIGNE_HONORAIRES_COURRIER)

export const LIBELLES_OBJETS_LIGNE_HONORAIRES_COURRIER: Record<ObjetLigneHonorairesCourrier, string> = {
  frais_envoi: 'Frais d’envoi',
  forfait_mise_en_demeure: 'Forfait de mise en demeure',
}

export interface BaseLigneHonorairesCourrier {
  /** Base juridique non confirmée : la proposition le dit avant toute saisie. */
  aConfirmer: boolean
  fondements: readonly string[]
  observation: string
}

/** Ce que la proposition dit de chaque objet (sources : tranches 27 et 43 § 1 ; honoraires-facturation.ts, honoraires-sinistre.ts). */
export const BASES_LIGNES_HONORAIRES_COURRIER: Readonly<Record<ObjetLigneHonorairesCourrier, Readonly<BaseLigneHonorairesCourrier>>> = Object.freeze({
  frais_envoi: Object.freeze({
    aConfirmer: true,
    fondements: Object.freeze(['D. 1967 annexe 1, 7.1.5', 'D. 1967 annexe 1, 7.2.1', 'L. 1965 art. 10-1, a']),
    observation:
      "À confirmer avec le cabinet : frais d'affranchissement ou d'acheminement de la mise en demeure remboursés à part au syndic, au contrat type de syndic (D. 1967 annexe 1, 7.1.5 et 7.2.1, lus pour honoraires-sinistre.ts), ou frais de recouvrement imputables au seul copropriétaire concerné (L. 1965 art. 10-1, a, qui vise aussi les frais de mise en demeure, d'après sa citation par un jugement ; texte non relu) ? En administration provisoire, base non établie (question ouverte de honoraires-sinistre.ts). Montant et destinataire : réglage du cabinet.",
  }),
  forfait_mise_en_demeure: Object.freeze({
    aConfirmer: true,
    fondements: Object.freeze(['L. 1965 art. 10-1, a']),
    observation:
      'À confirmer avec le cabinet : forfait de mise en demeure imputé au seul copropriétaire concerné au titre des frais de recouvrement (L. 1965 art. 10-1, a), ou honoraires facturés au syndicat ? Montant, tarif et destinataire : réglage du cabinet.',
  }),
})

/** Ligne paramétrée par le cabinet : aucun montant par défaut. */
export interface LigneHonorairesCourrier {
  objet: ObjetLigneHonorairesCourrier
  nature: NatureElement
  /** Tarif du catalogue (« <Dossier> - <LIBELLÉ> », tranche 27). */
  tarif: string
  /** Absent : « Coût unitaire ». */
  calcul?: ModeCalcul
  quantite: number
  /** Prix unitaire HT en dix-millièmes d'euro (honoraires-facturation.ts). */
  prixUnitaireHtDixMilliemes: number
  soumisTva: boolean
  tauxTvaPct: number
  destinataire: string
  /** Point 67 ; absente : « Facturable » (creerElement). */
  qualification?: QualificationElement
}

export type LigneHonorairesCourrierControlee = Omit<LigneHonorairesCourrier, 'calcul'> & { calcul: ModeCalcul }

function controlerNatureLigne(ligne: LigneHonorairesCourrier, ou: string): void {
  if (!OBJETS_ADMIS.has(ligne.objet))
    throw new Error(`${ou} : objet de ligne inconnu « ${ligne.objet} » (frais_envoi ou forfait_mise_en_demeure attendu).`)
  if (!(NATURES_ELEMENT as readonly string[]).includes(ligne.nature)) throw new Error(`${ou} : nature d’élément inconnue « ${ligne.nature} ».`)
  if (ligne.objet === 'frais_envoi' && categorieDe(ligne) !== 'Frais')
    throw new Error(
      `${ou} (frais d’envoi) : la nature « ${ligne.nature} » rémunère une diligence ; une nature de frais est attendue (timbre, AR, copie, envois, diffuseurs).`,
    )
  if (ligne.qualification !== undefined) qualificationDe(ligne)
}

function controlerMontantsLigne(ligne: LigneHonorairesCourrier, ou: string): void {
  if (!Number.isFinite(ligne.quantite) || ligne.quantite <= 0)
    throw new Error(`${ou} : quantité invalide (${ligne.quantite}) : strictement positive attendue.`)
  if (!Number.isInteger(ligne.prixUnitaireHtDixMilliemes) || ligne.prixUnitaireHtDixMilliemes < 0)
    throw new Error(
      `${ou} : prix unitaire invalide (${ligne.prixUnitaireHtDixMilliemes}) : dix-millièmes d’euro entiers, positifs ou nuls, attendus (réglage du cabinet).`,
    )
  if (typeof ligne.soumisTva !== 'boolean') throw new Error(`${ou} : « soumis à TVA » attendu (oui ou non).`)
  if (!Number.isFinite(ligne.tauxTvaPct) || ligne.tauxTvaPct < 0)
    throw new Error(`${ou} : taux de TVA invalide (${ligne.tauxTvaPct}) : pourcentage positif ou nul attendu.`)
}

function controlerLigne(ligne: LigneHonorairesCourrier, rang: number, quoi: string): LigneHonorairesCourrierControlee {
  const ou = `${quoi}, ligne ${rang}`
  controlerNatureLigne(ligne, ou)
  const calcul = ligne.calcul ?? 'Coût unitaire'
  if (!(MODES_CALCUL as readonly string[]).includes(calcul)) throw new Error(`${ou} : mode de calcul inconnu « ${calcul} ».`)
  const tarif = texteRequis(ligne.tarif, `${ou} : tarif du catalogue attendu.`)
  const destinataire = texteRequis(ligne.destinataire, `${ou} : destinataire attendu.`)
  controlerMontantsLigne(ligne, ou)
  return { ...ligne, calcul, tarif, destinataire }
}

export interface SaisieRegleHonorairesCourrier {
  id: string
  libelle: string
  declencheur: DeclencheurEtapeCourrier
  /** Dossier de l'élément ; la fiche est le dossier du courrier de ce type (point 66). */
  dossier: Dossier
  lignes: readonly LigneHonorairesCourrier[]
  /** Réglage du cabinet ; absent : désactivée. */
  active?: boolean
}

export interface RegleHonorairesCourrier {
  id: string
  libelle: string
  declencheur: DeclencheurControle
  dossier: Dossier
  lignes: LigneHonorairesCourrierControlee[]
  active: boolean
}

/**
 * Règle contrôlée. Refus : identifiant ou libellé vides, déclencheur ou dossier invalides, aucune ligne, ligne invalide
 * (objet, nature, frais d'envoi d'une nature de rémunération, calcul, tarif, destinataire, quantité, prix, TVA,
 * qualification). Désactivée sans réglage.
 */
export function creerRegleHonorairesCourrier(saisie: SaisieRegleHonorairesCourrier): RegleHonorairesCourrier {
  const id = texteRequis(saisie.id, 'Règle « courrier → honoraires » : identifiant de la règle attendu.')
  const libelle = texteRequis(saisie.libelle, `Règle « ${id} » : libellé attendu.`)
  const quoi = `Règle « ${libelle} »`
  const declencheur = controlerDeclencheur(saisie.declencheur, quoi)
  verifierDossier(saisie.dossier, quoi)
  if (saisie.lignes.length === 0) throw new Error(`${quoi} : au moins une ligne d’honoraires attendue (montants : réglage du cabinet).`)
  const lignes = saisie.lignes.map((ligne, i) => controlerLigne(ligne, i + 1, quoi))
  return { id, libelle, declencheur, dossier: saisie.dossier, lignes, active: saisie.active === true }
}

export const ID_REGLE_HONORAIRES_MISE_EN_DEMEURE = 'honoraires-mise-en-demeure'

/**
 * Lignes de la mise en demeure (🟢 tranche 43 § 1 : frais d'envoi et forfait), dossier Contentieux : les lignes, montants
 * compris, viennent du cabinet ; inactive sans réglage. Déclencheur par défaut : DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE
 * (famille Contentieux, libellé « mise en demeure »), inchangé : J64 ne vise que la Copie au CS.
 */
export function regleHonorairesMiseEnDemeure({
  lignes,
  active = false,
  declencheur = DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE,
}: {
  lignes: readonly LigneHonorairesCourrier[]
  active?: boolean
  declencheur?: DeclencheurEtapeCourrier
}): RegleHonorairesCourrier {
  return creerRegleHonorairesCourrier({
    id: ID_REGLE_HONORAIRES_MISE_EN_DEMEURE,
    libelle: 'Honoraires de la mise en demeure (frais d’envoi, forfait)',
    declencheur,
    dossier: 'Contentieux',
    lignes,
    active,
  })
}

/** Par défaut : aucune règle, donc aucune ligne proposée (montants et activation : réglage du cabinet). */
export const REGLES_HONORAIRES_COURRIER_PAR_DEFAUT: readonly RegleHonorairesCourrier[] = Object.freeze([])

export interface CibleLigneHonoraires {
  regle: RegleHonorairesCourrier
  ligne: LigneHonorairesCourrierControlee
  /** Rang de la ligne dans la règle, à partir de 1. */
  rang: number
  dossier: Rattachement
}

export interface ContexteHonorairesCourrier {
  aujourdhui: string
  /** Identifiant de chaque élément proposé, fourni par l'appelant. */
  idElement: (cible: CibleLigneHonoraires) => string
}

/** Une saisie d'élément prête pour creerElement, que l'appelant enregistre ou non : rien n'est écrit ici. */
export interface PropositionLigneHonoraires extends BaseLigneHonorairesCourrier {
  regleId: string
  objet: ObjetLigneHonorairesCourrier
  saisie: SaisieElement
}

export const MOTIFS_HONORAIRES_ECARTES = ['inactive', 'dossier_absent', 'dossier_ambigu', 'rattachement_incomplet'] as const
export type MotifHonorairesEcartes = (typeof MOTIFS_HONORAIRES_ECARTES)[number]

export interface RegleHonorairesEcartee {
  regleId: string
  motif: MotifHonorairesEcartes
  message: string
}

export interface ResultatHonorairesCourrier {
  courrierId: string
  propositions: PropositionLigneHonoraires[]
  ecartees: RegleHonorairesEcartee[]
}

/** Ce que portent les éléments proposés : la fiche du dossier visé (point 66), le syndicat et le mandat. */
interface CibleHonoraires {
  dossier: Rattachement
  coproprieteId: string
  mandatId: string
}

/** Raison d'écarter la règle pour ce courrier, ou la cible des éléments. */
function cibleDesHonoraires(courrier: CourrierEnvoye, regle: RegleHonorairesCourrier): RegleHonorairesEcartee | CibleHonoraires {
  const ecartee = (motif: MotifHonorairesEcartes, message: string): RegleHonorairesEcartee => ({ regleId: regle.id, motif, message })
  if (!regle.active) return ecartee('inactive', `Règle « ${regle.libelle} » inactive : réglage du cabinet, désactivée par défaut ; aucune ligne proposée.`)
  const dossiers = courrier.rattachements.filter((r) => r.type === regle.dossier)
  if (dossiers.length === 0)
    return ecartee('dossier_absent', `Règle « ${regle.libelle} » : le courrier ${courrier.id} n’est rattaché à aucun dossier « ${regle.dossier} ».`)
  if (dossiers.length > 1)
    return ecartee(
      'dossier_ambigu',
      `Règle « ${regle.libelle} » : le courrier ${courrier.id} vise ${dossiers.length} dossiers « ${regle.dossier} » ; un envoi ne porte qu’une série de frais : rattacher le courrier à un seul dossier.`,
    )
  const { coproprieteId, mandatId } = courrier
  if (coproprieteId === null || mandatId === null)
    return ecartee(
      'rattachement_incomplet',
      `Règle « ${regle.libelle} » : copropriété ou mandat du courrier ${courrier.id} manquant (le syndicat qui supporte la charge et le mandat de la prestation).`,
    )
  return { dossier: dossiers[0], coproprieteId, mandatId }
}

function propositionsDeLaRegle(
  courrier: CourrierEnvoye,
  regle: RegleHonorairesCourrier,
  { dossier, coproprieteId, mandatId }: CibleHonoraires,
  contexte: ContexteHonorairesCourrier,
  ids: Set<string>,
): PropositionLigneHonoraires[] {
  return regle.lignes.map((ligne, i) => {
    const id = texteRequis(
      contexte.idElement({ regle, ligne, rang: i + 1, dossier }),
      `Règle « ${regle.libelle} », ligne ${i + 1} : identifiant d’élément attendu.`,
    )
    if (ids.has(id)) throw new Error(`Proposition refusée : identifiant d’élément « ${id} » en double.`)
    ids.add(id)
    const saisie: SaisieElement = {
      id,
      coproprieteId,
      mandatId,
      date: courrier.dateDepot,
      dossier: regle.dossier,
      fiche: dossier,
      nature: ligne.nature,
      tarif: ligne.tarif,
      calcul: ligne.calcul,
      quantite: ligne.quantite,
      prixUnitaireHtDixMilliemes: ligne.prixUnitaireHtDixMilliemes,
      soumisTva: ligne.soumisTva,
      tauxTvaPct: ligne.tauxTvaPct,
      destinataire: ligne.destinataire,
      ...(ligne.qualification === undefined ? {} : { qualification: ligne.qualification }),
    }
    creerElement(saisie) // contrôle seul : la saisie proposée passe les règles de l'élément (point 66), rien n'est écrit
    return { regleId: regle.id, objet: ligne.objet, saisie, ...BASES_LIGNES_HONORAIRES_COURRIER[ligne.objet] }
  })
}

/**
 * Lignes d'honoraires proposées pour l'envoi d'un courrier : pour chaque règle active qui le vise, une saisie d'élément
 * par ligne du cabinet (dossier et fiche du dossier visé, point 66 ; date de dépôt ; copropriété et mandat du
 * courrier), contrôlée par creerElement, avec sa base (BASES_LIGNES_HONORAIRES_COURRIER : forfait de mise en demeure à
 * confirmer, 🔴). Rien n'est écrit. Règles écartées : inactive, dossier absent ou ambigu, copropriété ou mandat
 * manquants. Refus : courrier invalide ou non déposé, dépôt postérieur à aujourd'hui, règles invalides ou en double,
 * identifiant d'élément vide ou en double.
 */
export function proposerHonorairesDuCourrier(
  courrier: CourrierDeclencheur,
  regles: readonly SaisieRegleHonorairesCourrier[],
  contexte: ContexteHonorairesCourrier,
): ResultatHonorairesCourrier {
  const envoye = controlerCourrier(courrier, contexte.aujourdhui)
  const controlees = sansIdentifiantEnDouble(regles.map((regle) => creerRegleHonorairesCourrier(regle)))
  const resultat: ResultatHonorairesCourrier = { courrierId: envoye.id, propositions: [], ecartees: [] }
  const ids = new Set<string>()
  for (const regle of controlees.filter((r) => declenche(envoye, r.declencheur))) {
    const cible = cibleDesHonoraires(envoye, regle)
    if ('motif' in cible) resultat.ecartees.push(cible)
    else resultat.propositions.push(...propositionsDeLaRegle(envoye, regle, cible, contexte, ids))
  }
  return resultat
}
