import type { DossierContentieux } from '@/lib/administrateur-judiciaire/domain/contentieux'
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
import { controlerRegime, type Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import {
  MISSIONS_HONORAIRES,
  MODES_CALCUL,
  NATURES_ELEMENT,
  categorieDe,
  creerElement,
  qualificationDe,
  verifierQualificationAdmise,
  type MissionHonoraires,
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
import { ARRET_FRAIS_ET_DEBOURS, SOURCE_FRAIS_ET_DEBOURS } from '@/lib/administrateur-judiciaire/domain/ordonnances-remuneration'
import { normaliserTexteLibre } from '@/lib/administrateur-judiciaire/domain/texte'
import {
  DOSSIER,
  FAMILLE_MODELE_COURRIER,
  type Dossier,
  type FamilleModeleCourrier,
  type TypeContentieux,
} from '@/lib/data/referentiels-gesteam-judiciaire'

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
 *   DEMEURE » à facturer, datée du jour du dossier. Le forfait est facturé au syndicat, puis imputable au seul
 *   copropriétaire en retard (L. 1965 art. 10-1, a ; J67, R7, ci-dessous).
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
 * Décisions du référent métier (registre des décisions juridiques) :
 * - J20 : « Automatique » est réservé aux étapes que le logiciel crée seul ; l'étape née d'un courrier l'est (origine
 *   « automatique », sans créateur), donc visée par la règle des N jours ; l'étape enchaînée reste « manuelle ».
 * - J24 et J41 : « Copie au CS pour info » est un usage du cabinet, INACTIF par défaut : regleCopieAuCsPourInfo n'est
 *   active que si UsagesEtapesCabinet l'active ; les règles propres au cabinet sont, comme elle, désactivées par défaut.
 * - J64 (décision du 17/11/2026 (J64) ; notes du 17/11/2026, section « Suite » : recommandations
 *   validées en bloc, numéro de registre proposé ; suite de J24 et J41) : la Copie au CS NAÎT DU COURRIER
 *   (NAISSANCE_COPIE_AU_CS_PAR_DEFAUT), seulement pour les mises en demeure du contentieux, procédure 19-2 comprise, pas
 *   pour les simples relances (DECLENCHEUR_MISE_EN_DEMEURE, estMiseEnDemeureDuContentieux) ; réglage désactivé par
 *   défaut (J41) ; usage du cabinet, sans obligation légale (J24 ; L. 1965 art. 21). Ferme les questions n° 1 et 2
 *   ci-dessous et l'ancienne question n° 6 de modeles-etapes.ts (courrier ou enchaînement). Les honoraires de la mise en
 *   demeure, que J64 ne vise pas, gardent leur déclencheur (DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE : famille
 *   Contentieux, libellé « mise en demeure »).
 * - J67, R7 (décision du 17/11/2026 ; textes lus sur Légifrance le 17/11/2026 : L. 1965 art. 10-1, a et 29-1,
 *   II ; D. 1967 art. 61-1-5 et annexe 1, 9.1 ; arrêté du 08/10/2015, art. 14) : forfait de mise en demeure en deux
 *   lignes : le cabinet facture le syndicat, qui paie (repartition.payeur ; la ligne du cabinet a donc pour destinataire
 *   DESTINATAIRE_SYNDICAT, tout autre est refusé) ; le syndicat peut ensuite imputer la somme au
 *   seul copropriétaire en retard, comme frais nécessaire (« les frais nécessaires exposés par le syndicat, notamment les
 *   frais de mise en demeure », art. 10-1, a), si la créance est justifiée, si la mise en demeure est partie et si le
 *   coût est nécessaire ; une relance faite avant la mise en demeure n'est pas visée (repartition.imputation ;
 *   enregistrement de la ligne d'imputation : à brancher). Sous l'art. 29-1, le montant fait partie de la rémunération
 *   soumise au juge, à présenter dans le compte provisoire détaillé (D. 1967 art. 61-1-5, II ; arrêté du 08/10/2015,
 *   art. 14) ; sous les art. 46 et 47, aucun contrat type voté et aucun texte. Montant et tarif : réglage du cabinet,
 *   aucun montant par défaut. aConfirmer gardé : l'imputation d'une rémunération d'administrateur provisoire au
 *   copropriétaire n'est confirmée par aucun arrêt lu. Base selon le régime : baseLigneHonorairesCourrier ; imputation
 *   selon le cas du courrier et montant non saisi : J77, ci-dessous. Le régime et la mission (J67, R9) disent le même
 *   fait : un régime donné avec une mission autre que « judiciaire » est refusé (proposerHonorairesDuCourrier).
 * - J72 (décision du 18/11/2026 ; question Q5, conflit R5 / R6 ; textes : L. 1965 art. 10-1, a, version en
 *   vigueur depuis le 01/06/2020, « frais nécessaires exposés par le syndicat, notamment les frais de mise en demeure » ;
 *   C. com. R. 814-27) : frais d'envoi, deux cas (baseLigneHonorairesCourrier, selon le cas du courrier,
 *   casDesFraisDEnvoi, et la mission). (a) mise en demeure et relances d'un copropriétaire en retard : dépense du
 *   syndicat, payée sur son compte avec la pièce du prestataire postal, imputée au seul copropriétaire concerné (L. 1965
 *   art. 10-1, a ; R6), aux conditions du forfait (créance justifiée, mise en demeure partie, coût nécessaire) ; ni
 *   remboursée au cabinet ni facturée par lui (repartition.paiement « piece_du_prestataire_postal ») ; en mission
 *   judiciaire, la ligne du cabinet n'en est que la trace, en Contrôle coûts (point 67), et « Facturable » y est refusé.
 *   (b) autres envois du cabinet (sinistres, gestion, et tout envoi qui n'est pas la mise en demeure ou la relance d'un
 *   copropriétaire en retard) : frais du cabinet, à part de sa rémunération, présentés au juge en annexe « frais et
 *   débours » et payés seulement en vertu de son ordonnance (C. com. R. 814-27 ; R5 : frais et débours arrêtés par
 *   l'ordonnance, Cass. 3e civ., 21/05/2026, n° 24-20.377), signalés « à présenter au juge » (repartition.paiement
 *   « ordonnance_du_juge » ; la facture exige l'ordonnance : preparerFacture, J67, R3). Même base pour les trois
 *   régimes. Au contrat type de syndic (mission « contrat_type_syndic », sans objet pour le cabinet, J67, R14) :
 *   remboursés au syndic sur sa facture (D. 1967 annexe 1, 7.1.5 et 7.2.1 ; repartition.paiement « facture_du_cabinet »),
 *   puis, pour le recouvrement, imputés de même (9.1) ; jamais « à présenter au juge », comme dans
 *   honoraires-sinistre.ts. Enregistrement de la dépense du syndicat et de la ligne d'imputation : à brancher.
 *   🔵 Relecture du 18/11/2026 : le cas suit la nature du courrier et le dossier qu'il poursuit, pas le seul type de
 *   dossier de la règle (le dossier Contentieux compte sept types de contentieux, dont un seul de recouvrement ; une mise
 *   en demeure de la Comptabilité syndic relève aussi du cas a). Mise en demeure ou relance : libellé du modèle qui dit
 *   « mise en demeure », « 19-2 » ou « relance » (mots entiers, toute famille), sauf s'il vise un locataire ; dossier qui
 *   poursuit un copropriétaire en retard : fait lu par l'appelant (recouvrementContreUnCoproprietaire ; contentieux :
 *   estRecouvrementContreUnCoproprietaire, « Recouvrement de charges/loyer » avec un compte débiteur). Si le dossier ne
 *   le dit pas : à confirmer, sans imputation ni refus de « Facturable » ; un frais d'envoi n'est jamais imputé au
 *   copropriétaire par défaut.
 * - J77 (réponse de Frédéric du 17/11/2026 sur sa page de validation, avec la précision du 18/11/2026 ;
 *   registre : J77 ; suite de J67, R7, et de J72, a ; L. 1965 art. 10-1, a) : frais de la mise en demeure imputés au
 *   seul copropriétaire défaillant ; montant fixé par le cabinet ; proposition désactivée tant qu'il n'est pas saisi.
 *   (a) Imputation du forfait : même lecture du cas du courrier que pour les frais d'envoi (casDesFraisDEnvoi, J72). Le
 *   forfait n'est imputé au copropriétaire que pour un recouvrement contre un copropriétaire en retard ; aucune
 *   imputation pour un courrier à un locataire, un autre contentieux ou un envoi qui n'est ni une mise en demeure ni une
 *   relance ; à confirmer, sans imputation, si le dossier ne dit pas qui il poursuit (BASES_FORFAIT ; jamais
 *   d'imputation par défaut). De même sans cas du courrier (baseLigneHonorairesCourrier sans cas,
 *   BASES_LIGNES_HONORAIRES_COURRIER) : cas du courrier non fourni, à confirmer, sans imputation, sans motif supposé. Le
 *   cabinet facture toujours le forfait au syndicat, qui le paie (J67, R7, inchangé) ; les conditions de R7 restent
 *   portées par l'imputation (une relance faite avant la mise en demeure n'est pas visée). Sous l'art. 29-1, la limite
 *   de R7 (seule la somme admise et payée par le syndicat est imputée) et la réserve « aucun arrêt lu » suivent
 *   l'imputation : affirmées pour le recouvrement, au conditionnel quand l'imputation est possible mais non établie
 *   (dossier muet, cas non fourni), absentes quand rien n'est imputable.
 *   (b) Montant : aucun montant par défaut ; 0, null ou absent vaut « non saisi » (prixDeLaLigne). Tant que le montant
 *   d'un forfait n'est pas saisi, la règle ne propose aucune ligne, frais d'envoi compris (Frédéric : « la proposition
 *   de lignes reste désactivée tant que ce montant n'est pas saisi ») : un seul écart (motif montant_non_saisi) dit quoi
 *   saisir et cite les lignes du forfait. L'état « active » de la règle ne change pas : c'est la proposition qui reste
 *   désactivée. Les refus qui ne dépendent pas du montant restent levés : « Offert » en mission judiciaire (J67, R9),
 *   « Facturable » de l'envoi d'un recouvrement (J72, a). creerElement (honoraires-facturation.ts) admet toujours un
 *   prix de 0. Enregistrement de la ligne d'imputation : à brancher.
 *   Décisions du 19/11/2026, à valider par Frédéric avant fusion : (i) le texte de Frédéric est gardé : tant que
 *   le montant du forfait n'est pas saisi, toute la règle attend, frais d'envoi compris ; (ii) un frais d'envoi à 0 reste
 *   proposé (J77 ne parle que du forfait), y compris dans une règle dont le forfait a un montant saisi. Seul le forfait a
 *   donc un prix « non saisi » (prixDeLaLigne) ; l'écart montant_non_saisi ne cite jamais un frais d'envoi.
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
 *   frais) ; frais d'envoi d'une nature de frais seulement (categorieDe) ; calcul « Coût unitaire » par défaut ; forfait
 *   en deux lignes pour le recouvrement contre un copropriétaire, une seule sinon ; règle sans aucune proposition tant
 *   que le montant d'un forfait n'est pas saisi (J67, R7 ; J77, ci-dessus) ; frais d'envoi selon le cas du courrier et
 *   la mission (J72, ci-dessus).
 *
 * 🔴 Non établi — questions :
 * 1. et 2. Fermées par J64 (ci-dessus) : la Copie au CS naît du courrier ; les mises en demeure du contentieux la font
 *    naître, procédure 19-2 comprise, pas les simples relances.
 * 3. Fermée par J67, R7 (ci-dessus).
 * 4. Fermée par J72 (ci-dessus).
 * 5. Frédéric : l'élément à facturer n'a pas de champ « courrier d'origine » : un second déclenchement propose de nouveau
 *    les lignes, sans anti-doublon. Champ et table : Frédéric.
 * 6. Frédéric ou le référent métier : liste de contrôle du contentieux instanciée avec l'usage actif (modeleDuDossier) : la Copie au CS
 *    y figure et doublerait celle du courrier (seul un avertissement le signale au déclenchement). Faut-il toujours
 *    instancier le modèle sans elle (modeleSansEtapesNeesDuCourrier, à appeler par l'écran ou le repository ;
 *    modeleDuDossier reste inchangé) ? Lien avec la question n° 5 de modeles-etapes.ts.
 * 7. Référent métier : autres modes de réalisation de Gestéam (⚪ seul « Courrier » est relevé) ; l'étape « réalisée par courrier »
 *    se réalise-t-elle au dépôt du courrier de copie au conseil syndical ? Non branché.
 *
 * Le droit : aucun texte lu n'impose la copie au conseil syndical d'une mise en demeure (J24 : usage du cabinet) ; ces
 * règles sont des règles de GESTION, sans délai légal. L. 1965 art. 10-1, a (version du 01/06/2020) : lu sur Légifrance
 * le 17/11/2026 pour J67, R7 ; il range parmi les frais imputables au seul copropriétaire concerné « notamment les frais
 * de mise en demeure ». Forfait : J67, R7 et J77 ; frais d'envoi : J72.
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
 * comprise, hors relances (décision du 17/11/2026, J64 : estMiseEnDemeureDuContentieux).
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
 * les simples relances (décision du 17/11/2026, J64 ; estMiseEnDemeureDuContentieux). Le cabinet peut le
 * remplacer par la liste de ses modèles. Les honoraires de la mise en demeure gardent le leur
 * (DECLENCHEUR_HONORAIRES_MISE_EN_DEMEURE) : J64 ne les vise pas.
 */
export const DECLENCHEUR_MISE_EN_DEMEURE: Readonly<DeclencheurControle> = Object.freeze({ par: 'mise_en_demeure_contentieux' })

/**
 * 🔵 Déclencheur par défaut des honoraires de la mise en demeure (regleHonorairesMiseEnDemeure), inchangé depuis le
 * point 50 : un modèle de la famille Contentieux dont le libellé dit « mise en demeure » (mots entiers et dans l'ordre).
 * J64 ne vise que la Copie au CS : ni la procédure 19-2 ni l'exclusion des relances ne s'appliquent ici (J67, R7 et
 * J72, ci-dessus : l'envoi d'une relance est, comme celui de la mise en demeure, une dépense du syndicat).
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
 * Mise en demeure du contentieux (décision du 17/11/2026, J64) : modèle de la famille Contentieux dont le libellé
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

/** Comme Gestéam (tranche 43 § 1) : la Copie au CS naît du courrier (décision du 17/11/2026, J64). */
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

/** Ligne d'imputation liée (J67, R7) : au seul copropriétaire en retard, aux conditions de l'art. 10-1, a. */
export interface ImputationLigneCourrier {
  a: 'coproprietaire_en_retard'
  fondement: string
  conditions: readonly string[]
}

/**
 * Pièce sur laquelle le syndicat paie : la facture du cabinet (forfait, J67, R7 ; au contrat type de syndic, frais
 * d'envoi remboursés au syndic, 7.1.5 et 7.2.1), la pièce du prestataire postal (dépense du syndicat, J72, a) ou
 * l'ordonnance du juge qui couvre les frais du cabinet (J72, b).
 */
export const PAIEMENTS_LIGNE_COURRIER = ['facture_du_cabinet', 'piece_du_prestataire_postal', 'ordonnance_du_juge'] as const
export type PaiementLigneCourrier = (typeof PAIEMENTS_LIGNE_COURRIER)[number]

/** Qui paie la ligne, sur quelle pièce, et la ligne d'imputation liée (J67, R7 ; J72). */
export interface RepartitionLigneCourrier {
  /** C'est toujours le syndicat qui paie. */
  payeur: 'syndicat'
  paiement: PaiementLigneCourrier
  /** null : rien à imputer à un copropriétaire (frais du cabinet, J72, b). */
  imputation: Readonly<ImputationLigneCourrier> | null
}

export interface BaseLigneHonorairesCourrier {
  /** Base juridique non confirmée : la proposition le dit avant toute saisie. */
  aConfirmer: boolean
  fondements: readonly string[]
  observation: string
  repartition: Readonly<RepartitionLigneCourrier>
}

/**
 * Destinataire de l'élément qui désigne le syndicat : 🟢 valeur de la liste « Destinataire » de Gestéam (tranche 27). Le
 * forfait de mise en demeure n'en admet pas d'autre : le cabinet facture le syndicat, qui paie (J67, R7).
 */
export const DESTINATAIRE_SYNDICAT = 'Syndicat des copropriétaires'

/** J67, R7 et J72 (a) : imputation au seul copropriétaire en retard, aux conditions de l'art. 10-1, a. */
const IMPUTATION_AU_COPROPRIETAIRE: Readonly<ImputationLigneCourrier> = Object.freeze({
  a: 'coproprietaire_en_retard',
  fondement: 'L. 1965 art. 10-1, a',
  conditions: Object.freeze(['créance justifiée', 'mise en demeure partie (une relance faite avant elle n’est pas visée)', 'coût nécessaire']),
})

// ── Cas du courrier : frais d'envoi (J72) et forfait (J77) ───────────────────────────────────

/**
 * J72 : cas des frais d'envoi d'un courrier (casDesFraisDEnvoi). « recouvrement » : mise en demeure ou relance d'un
 * copropriétaire en retard (J72, a) ; « autre_envoi » : tout autre envoi du cabinet (J72, b) ; « non_etabli » : mise en
 * demeure ou relance dont le dossier ne dit pas s'il poursuit un copropriétaire en retard (à confirmer). J77 : le même
 * cas décide de l'imputation du forfait de mise en demeure (BASES_FORFAIT).
 */
export const CAS_FRAIS_ENVOI = ['recouvrement', 'autre_envoi', 'non_etabli'] as const
export type CasFraisEnvoi = (typeof CAS_FRAIS_ENVOI)[number]

/** Le seul type de contentieux qui recouvre une créance du syndicat (référentiel TYPE_CONTENTIEUX, Gestéam 5.4.22). */
const TYPE_CONTENTIEUX_DU_RECOUVREMENT: TypeContentieux = 'Recouvrement de charges/loyer'

/**
 * J72 (a) : le contentieux poursuit-il un copropriétaire en retard ? Oui pour « Recouvrement de charges/loyer » avec un
 * compte copropriétaire débiteur (D2) ; non pour les six autres types (garantie décennale, litiges, contestation
 * d'assemblée) ; null (non établi) pour un recouvrement sans compte débiteur, dont le débiteur peut être un locataire.
 */
export function estRecouvrementContreUnCoproprietaire(contentieux: Pick<DossierContentieux, 'type' | 'compteId'>): boolean | null {
  if (contentieux.type !== TYPE_CONTENTIEUX_DU_RECOUVREMENT) return false
  return contentieux.compteId?.trim() ? true : null
}

/** Un modèle adressé à un locataire n'est pas la relance d'un copropriétaire (« Mise en demeure de payer - locataire »). */
const MOTS_LOCATAIRE = ['locataire', 'locataires'] as const

/**
 * J72 : cas des frais d'envoi. Le courrier est une mise en demeure ou une relance si le libellé de son modèle dit « mise
 * en demeure », « 19-2 » ou « relance » (mots entiers ; casse, accents et ponctuation ignorés ; toute famille, la
 * Comptabilité syndic comprise), sauf s'il vise un locataire ; tout autre courrier est un autre envoi (J72, b). Mise en
 * demeure ou relance : recouvrement si le dossier poursuit un copropriétaire en retard (true), autre envoi sinon
 * (false), non établi si le dossier ne le dit pas (null). Sert aussi au forfait de mise en demeure (J77).
 */
export function casDesFraisDEnvoi(modele: ModeleDeCourrier, recouvrementContreUnCoproprietaire: boolean | null): CasFraisEnvoi {
  const libelle = ` ${normaliserTexteLibre(modele.libelle)} `
  const relance = premierePosition(libelle, [...MOTS_MISE_EN_DEMEURE, ...MOTS_RELANCE]) !== null
  if (!relance || premierePosition(libelle, MOTS_LOCATAIRE) !== null) return 'autre_envoi'
  if (recouvrementContreUnCoproprietaire === null) return 'non_etabli'
  return recouvrementContreUnCoproprietaire ? 'recouvrement' : 'autre_envoi'
}

const MONTANT_DU_CABINET = 'Montant : réglage du cabinet, aucun montant par défaut.'
/** J67, R7 : conditions de l'imputation au copropriétaire (L. 1965 art. 10-1, a). */
const CONDITIONS_DE_L_IMPUTATION =
  "si la créance est justifiée, si la mise en demeure est partie et si le coût est nécessaire ; une relance faite avant la mise en demeure n'est pas visée"
/** J72 (b) ; J67, R5 : frais du cabinet présentés au juge, payés en vertu de son ordonnance. */
const FONDEMENTS_FRAIS_DU_CABINET = ['C. com. R. 814-27', ARRET_FRAIS_ET_DEBOURS] as const
const SANS_ORDONNANCE = "rien n'est facturé au syndicat sans l'ordonnance (preparerFacture, J67, R3)"
/** Contrat type de syndic, sans objet pour le cabinet (C. com. L. 811-10 ; J67, R14). */
const AU_CONTRAT_TYPE =
  "Contrat type de syndic (sans objet pour le cabinet, J67, R14) : l'envoi est remboursé au syndic, sur sa facture (D. 1967 annexe 1, 7.1.5 et 7.2.1)"
const FONDEMENT_CONTRAT_TYPE = 'D. 1967 annexe 1, 7.1.5 et 7.2.1'

/** Base gelée (frais d'envoi, forfait) : c'est toujours le syndicat qui paie. */
const baseDeFrais = (
  aConfirmer: boolean,
  fondements: readonly string[],
  observation: string,
  paiement: PaiementLigneCourrier,
  imputation: Readonly<ImputationLigneCourrier> | null,
): Readonly<BaseLigneHonorairesCourrier> =>
  Object.freeze({ aConfirmer, fondements: Object.freeze([...fondements]), observation, repartition: Object.freeze({ payeur: 'syndicat', paiement, imputation }) })

/**
 * Bases des frais d'envoi, par mission et par cas (J72). Mission judiciaire : (a) dépense du syndicat, payée sur la pièce
 * du prestataire postal, imputée au seul copropriétaire concerné (L. 1965 art. 10-1, a ; R6) ; (b) frais du cabinet, à
 * présenter au juge en annexe « frais et débours », payés seulement en vertu de son ordonnance (C. com. R. 814-27 ; R5) ;
 * non établi : à confirmer, comme (b) d'ici là, rien n'est imputé. Contrat type de syndic : remboursés au syndic sur sa
 * facture (7.1.5, 7.2.1), imputés au copropriétaire pour le recouvrement (9.1), jamais présentés au juge.
 */
const BASES_FRAIS_ENVOI: Readonly<Record<MissionHonoraires, Readonly<Record<CasFraisEnvoi, Readonly<BaseLigneHonorairesCourrier>>>>> = Object.freeze({
  judiciaire: Object.freeze({
    recouvrement: baseDeFrais(
      false,
      ['L. 1965 art. 10-1, a'],
      `Dépense du syndicat (J72, a) : l'envoi de la mise en demeure ou de la relance d'un copropriétaire en retard se paie sur le compte du syndicat, avec la pièce du prestataire postal ; cette dépense n'est ni remboursée au cabinet ni facturée par lui. Le syndicat l'impute au seul copropriétaire concerné, comme frais nécessaire (L. 1965 art. 10-1, a : « notamment les frais de mise en demeure »), ${CONDITIONS_DE_L_IMPUTATION}. En mission judiciaire, la ligne du cabinet n'en est que la trace (Contrôle coûts). ${MONTANT_DU_CABINET}`,
      'piece_du_prestataire_postal',
      IMPUTATION_AU_COPROPRIETAIRE,
    ),
    autre_envoi: baseDeFrais(
      false,
      FONDEMENTS_FRAIS_DU_CABINET,
      `À présenter au juge (J72, b) : frais du cabinet, à part de sa rémunération, présentés au juge en annexe « frais et débours » et payés seulement en vertu de son ordonnance (C. com. R. 814-27 ; ${SOURCE_FRAIS_ET_DEBOURS}) ; ${SANS_ORDONNANCE}. ${MONTANT_DU_CABINET}`,
      'ordonnance_du_juge',
      null,
    ),
    non_etabli: baseDeFrais(
      true,
      FONDEMENTS_FRAIS_DU_CABINET,
      `À confirmer (J72) : mise en demeure ou relance dont le dossier ne dit pas s'il poursuit un copropriétaire en retard (type du contentieux ou compte débiteur non renseigné). S'il en poursuit un, l'envoi est une dépense du syndicat, payée avec la pièce du prestataire postal et imputée à ce copropriétaire (J72, a ; L. 1965 art. 10-1, a) ; sinon, un frais du cabinet à présenter au juge (J72, b). D'ici là, rien n'est imputé à un copropriétaire et ${SANS_ORDONNANCE}. ${MONTANT_DU_CABINET}`,
      'ordonnance_du_juge',
      null,
    ),
  }),
  contrat_type_syndic: Object.freeze({
    recouvrement: baseDeFrais(
      false,
      [FONDEMENT_CONTRAT_TYPE, 'L. 1965 art. 10-1, a', 'D. 1967 annexe 1, 9.1'],
      `${AU_CONTRAT_TYPE} ; pour la mise en demeure ou la relance d'un copropriétaire en retard, le syndicat l'impute ensuite au seul copropriétaire concerné (L. 1965 art. 10-1, a ; contrat type, 9.1 ; J72, a), ${CONDITIONS_DE_L_IMPUTATION}. ${MONTANT_DU_CABINET}`,
      'facture_du_cabinet',
      IMPUTATION_AU_COPROPRIETAIRE,
    ),
    autre_envoi: baseDeFrais(false, [FONDEMENT_CONTRAT_TYPE], `${AU_CONTRAT_TYPE} ; rien n'est imputé à un copropriétaire. ${MONTANT_DU_CABINET}`, 'facture_du_cabinet', null),
    non_etabli: baseDeFrais(
      true,
      [FONDEMENT_CONTRAT_TYPE],
      `${AU_CONTRAT_TYPE} ; à confirmer (J72) : imputable au seul copropriétaire en retard s'il s'agit de sa mise en demeure ou de sa relance (L. 1965 art. 10-1, a ; contrat type, 9.1), ce que le dossier ne dit pas ; rien n'est imputé d'ici là. ${MONTANT_DU_CABINET}`,
      'facture_du_cabinet',
      null,
    ),
  }),
})

const MONTANT_DU_FORFAIT = 'Montant et tarif : réglage du cabinet, aucun montant par défaut.'

/**
 * Bases du forfait de mise en demeure, par cas du courrier (J77 : même lecture que les frais d'envoi, casDesFraisDEnvoi).
 * Le cabinet facture toujours le forfait au syndicat, qui le paie, sur sa facture (J67, R7). Recouvrement contre un
 * copropriétaire en retard : deux lignes, le syndicat peut ensuite imputer le forfait à ce seul copropriétaire (L. 1965
 * art. 10-1, a), aux conditions de R7. Autre envoi (locataire, autre contentieux, envoi qui n'est ni une mise en demeure
 * ni une relance) : rien n'est imputé à un copropriétaire. Non établi : à confirmer, rien n'est imputé d'ici là.
 * aConfirmer reste vrai pour le forfait (J67, R7 : base d'imputation non confirmée par un arrêt lu ; art. 46 et 47 sans
 * texte).
 */
const BASES_FORFAIT: Readonly<Record<CasFraisEnvoi, Readonly<BaseLigneHonorairesCourrier>>> = Object.freeze({
  recouvrement: baseDeFrais(
    true,
    ['L. 1965 art. 10-1, a'],
    `Deux lignes (J67, R7) : le cabinet facture le forfait au syndicat, qui le paie ; le syndicat peut ensuite l'imputer au seul copropriétaire en retard, comme frais nécessaire (L. 1965 art. 10-1, a), ${CONDITIONS_DE_L_IMPUTATION}. ${MONTANT_DU_FORFAIT}`,
    'facture_du_cabinet',
    IMPUTATION_AU_COPROPRIETAIRE,
  ),
  autre_envoi: baseDeFrais(
    true,
    [],
    `Une ligne (J67, R7 ; J77) : le cabinet facture le forfait au syndicat, qui le paie ; rien n'est imputé à un copropriétaire, car le courrier ne poursuit pas un copropriétaire en retard (courrier à un locataire, autre contentieux, ou envoi qui n'est ni une mise en demeure ni une relance). ${MONTANT_DU_FORFAIT}`,
    'facture_du_cabinet',
    null,
  ),
  non_etabli: baseDeFrais(
    true,
    [],
    `À confirmer (J77) : mise en demeure ou relance dont le dossier ne dit pas s'il poursuit un copropriétaire en retard (type du contentieux ou compte débiteur non renseigné). Le cabinet facture le forfait au syndicat, qui le paie (J67, R7). S'il en poursuit un, le syndicat peut ensuite imputer le forfait à ce seul copropriétaire, comme frais nécessaire (L. 1965 art. 10-1, a), aux conditions de J67, R7 ; sinon, rien n'est imputé. D'ici là, rien n'est imputé à un copropriétaire. ${MONTANT_DU_FORFAIT}`,
    'facture_du_cabinet',
    null,
  ),
})

/**
 * J77 : forfait sans cas du courrier (baseLigneHonorairesCourrier sans cas). Rien ne dit qui le courrier poursuit : à
 * confirmer, rien n'est imputé, et aucun motif n'est supposé (Référent métier : « à confirmer » si le dossier ne le dit pas).
 */
const BASE_FORFAIT_CAS_NON_FOURNI: Readonly<BaseLigneHonorairesCourrier> = baseDeFrais(
  true,
  [],
  `À confirmer (J77) : cas du courrier non fourni ; rien ne dit s'il poursuit un copropriétaire en retard. Le cabinet facture le forfait au syndicat, qui le paie (J67, R7). Le forfait n'est imputable qu'au copropriétaire en retard que poursuit un recouvrement, comme frais nécessaire (L. 1965 art. 10-1, a), aux conditions de J67, R7 ; tant que le cas n'est pas établi, rien n'est imputé à un copropriétaire. ${MONTANT_DU_FORFAIT}`,
  'facture_du_cabinet',
  null,
)

/**
 * Ce que la proposition dit de chaque objet, régime du mandat inconnu et cas non fourni (sources : tranches 27 et 43 § 1 ;
 * J67, R7 ; J72 ; J77). Frais d'envoi : la base des autres envois du cabinet en mission judiciaire (J72, b). Forfait : cas
 * du courrier non fourni, à confirmer, sans imputation (J77). baseLigneHonorairesCourrier rend celle du cas et de la
 * mission (BASES_FRAIS_ENVOI, BASES_FORFAIT).
 */
export const BASES_LIGNES_HONORAIRES_COURRIER: Readonly<Record<ObjetLigneHonorairesCourrier, Readonly<BaseLigneHonorairesCourrier>>> = Object.freeze({
  frais_envoi: BASES_FRAIS_ENVOI.judiciaire.autre_envoi,
  forfait_mise_en_demeure: BASE_FORFAIT_CAS_NON_FOURNI,
})

/**
 * J77 : imputation du forfait au copropriétaire. « imputee » : recouvrement contre un copropriétaire en retard ;
 * « a_confirmer » : possible, mais le dossier ne dit pas qui il poursuit, ou le cas n'est pas fourni ; « aucune » : rien
 * n'est imputable (autre envoi).
 */
type ImputationDuForfait = 'imputee' | 'a_confirmer' | 'aucune'

const IMPUTATION_DU_FORFAIT: Readonly<Record<CasFraisEnvoi, ImputationDuForfait>> = Object.freeze({
  recouvrement: 'imputee',
  autre_envoi: 'aucune',
  non_etabli: 'a_confirmer',
})

/** Complément de l'observation du forfait selon le régime et l'imputation du forfait (J77). */
type ComplementForfait = (imputation: ImputationDuForfait) => string

/** J67, R7 : sous les art. 46 et 47, aucun contrat type voté et aucun texte (D. 1967 art. 46 et 47, muets). */
const FORFAIT_SANS_TEXTE_46_47: { fondements: readonly string[]; complement: ComplementForfait } = {
  fondements: [],
  complement: () =>
    "Syndic de l'art. 46 ou administrateur de l'art. 47 : aucun contrat type voté ; les art. 46 et 47 du décret ne disent rien de ce forfait : à confirmer.",
}

/** J67, R7 : sous l'art. 29-1, le forfait fait partie de la rémunération soumise au juge. */
const REMUNERATION_SOUMISE_AU_JUGE =
  'Administration provisoire (art. 29-1) : ce montant fait partie de la rémunération soumise au juge, à présenter au juge dans le compte provisoire détaillé (D. 1967 art. 61-1-5, II ; arrêté du 08/10/2015, art. 14)'

/** J67, R7 : réserve sur l'imputation d'une rémunération d'administrateur provisoire. */
const RESERVE_IMPUTATION_AP =
  "Cette imputation d'une rémunération d'administrateur provisoire n'est confirmée par aucun arrêt lu : à confirmer."

/** J67, R7, sous l'art. 29-1, selon l'imputation du forfait (J77) : limite affirmée, au conditionnel, ou sans objet. */
const COMPLEMENT_AP291: Readonly<Record<ImputationDuForfait, string>> = Object.freeze({
  imputee: `${REMUNERATION_SOUMISE_AU_JUGE} ; seule la somme admise et payée par le syndicat est imputée au copropriétaire. ${RESERVE_IMPUTATION_AP}`,
  a_confirmer: `${REMUNERATION_SOUMISE_AU_JUGE} ; s'il est imputé au copropriétaire, seule la somme admise et payée par le syndicat l'est. ${RESERVE_IMPUTATION_AP}`,
  aucune: `${REMUNERATION_SOUMISE_AU_JUGE}.`,
})

/**
 * Forfait selon le régime du mandat (J67, R7) : textes ajoutés et complément de l'observation. Sous l'art. 29-1, la
 * limite de R7 (somme admise et payée) et sa réserve suivent l'imputation du forfait (J77) : affirmées s'il est imputé,
 * au conditionnel si l'imputation est possible mais non établie, absentes si rien n'est imputable.
 */
const FORFAIT_SELON_REGIME: Readonly<Record<Regime, { fondements: readonly string[]; complement: ComplementForfait }>> = Object.freeze({
  ap291: {
    fondements: ['L. 1965 art. 29-1, II', 'D. 1967 art. 61-1-5, II', 'arrêté du 08/10/2015, art. 14'],
    complement: (imputation: ImputationDuForfait) => COMPLEMENT_AP291[imputation],
  },
  sj: FORFAIT_SANS_TEXTE_46_47,
  ap47: FORFAIT_SANS_TEXTE_46_47,
})

/** Ce dont dépend la base d'une ligne : régime du mandat (J67, R7), mission et cas du courrier (J72, J77). */
export interface OptionsBaseLigneCourrier {
  /** Absent ou null : régime inconnu. */
  regime?: Regime | null
  /** Absente : « judiciaire », celle du cabinet (le contrat type de syndic est sans objet pour lui, J67, R14). */
  mission?: MissionHonoraires
  /**
   * Cas du courrier (casDesFraisDEnvoi), pour les frais d'envoi (J72) et le forfait (J77). Absent : frais d'envoi
   * « autre_envoi » (J72, b) ; forfait « cas du courrier non fourni », à confirmer, sans imputation (J77). Jamais
   * d'imputation au copropriétaire par défaut.
   */
  cas?: CasFraisEnvoi
}

/**
 * Base d'une ligne selon son objet : forfait selon le cas du courrier (J77 : imputé au copropriétaire pour le seul
 * recouvrement contre un copropriétaire en retard, BASES_FORFAIT ; sans cas, à confirmer, sans imputation), complété
 * pour le régime du mandat (J67, R7) ; frais d'envoi selon la mission et le cas du courrier, quel que soit le régime
 * (J72 : BASES_FRAIS_ENVOI ; sans cas, autre envoi). Refus : régime, mission ou cas hors liste, et régime de justice avec
 * une mission autre que « judiciaire » (controlerAccordRegimeMission).
 */
export function baseLigneHonorairesCourrier(
  objet: ObjetLigneHonorairesCourrier,
  { regime = null, mission = 'judiciaire', cas }: OptionsBaseLigneCourrier = {},
): Readonly<BaseLigneHonorairesCourrier> {
  if (!(MISSIONS_HONORAIRES as readonly string[]).includes(mission))
    throw new Error(`Base de la ligne du courrier : mission inconnue « ${mission} » (judiciaire ou contrat_type_syndic attendue).`)
  if (cas !== undefined && !(CAS_FRAIS_ENVOI as readonly string[]).includes(cas))
    throw new Error(`Base de la ligne du courrier : cas des frais d’envoi inconnu « ${cas} » (recouvrement, autre_envoi ou non_etabli attendu, J72).`)
  const controle = controlerRegime(regime)
  controlerAccordRegimeMission(controle, mission)
  if (objet === 'frais_envoi') return BASES_FRAIS_ENVOI[mission][cas ?? 'autre_envoi']
  const base = cas === undefined ? BASE_FORFAIT_CAS_NON_FOURNI : BASES_FORFAIT[cas]
  if (controle === null) return base
  const { fondements, complement } = FORFAIT_SELON_REGIME[controle]
  return {
    ...base,
    fondements: [...base.fondements, ...fondements],
    observation: `${base.observation} ${complement(cas === undefined ? 'a_confirmer' : IMPUTATION_DU_FORFAIT[cas])}`,
  }
}

/** Ligne paramétrée par le cabinet : aucun montant par défaut. */
export interface LigneHonorairesCourrier {
  objet: ObjetLigneHonorairesCourrier
  nature: NatureElement
  /** Tarif du catalogue (« <Dossier> - <LIBELLÉ> », tranche 27). */
  tarif: string
  /** Absent : « Coût unitaire ». */
  calcul?: ModeCalcul
  quantite: number
  /**
   * Prix unitaire HT en dix-millièmes d'euro (honoraires-facturation.ts). Forfait de mise en demeure : 0, null ou absent
   * vaut « non saisi » (J77) ; la règle ne propose aucune ligne tant qu'il n'est pas saisi. Frais d'envoi : nombre
   * entier, positif ou nul, obligatoire ; 0 reste proposé (décision du 19/11/2026, à valider par Frédéric).
   */
  prixUnitaireHtDixMilliemes: number | null
  soumisTva: boolean
  tauxTvaPct: number
  destinataire: string
  /** Point 67 ; absente : « Facturable » (creerElement). */
  qualification?: QualificationElement
}

/** Ligne contrôlée : calcul fixé ; prix null pour un forfait de mise en demeure dont le montant n'est pas saisi (J77). */
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

/**
 * Prix de la ligne contrôlé. J77 : pour le forfait de mise en demeure, 0, null ou absent vaut « non saisi » (null). Un
 * frais d'envoi à 0 reste un prix saisi, proposé (décision du 19/11/2026, à valider par Frédéric : J77 ne parle
 * que du forfait). Refus : prix non entier ou négatif ; frais d'envoi sans prix (seul le forfait est visé par J77).
 */
function prixDeLaLigne(ligne: LigneHonorairesCourrier, ou: string): number | null {
  // Lu comme inconnu : une règle relue d'un stockage peut ne pas porter le champ.
  const prix: unknown = ligne.prixUnitaireHtDixMilliemes
  const forfait = ligne.objet === 'forfait_mise_en_demeure'
  if (forfait && (prix === undefined || prix === null || prix === 0)) return null
  if (typeof prix !== 'number' || !Number.isInteger(prix) || prix < 0)
    throw new Error(
      forfait
        ? `${ou} : prix unitaire invalide (${String(prix)}) : dix-millièmes d’euro entiers et positifs attendus ; 0 ou vide : montant non saisi (J77).`
        : `${ou} : prix unitaire invalide (${String(prix)}) : dix-millièmes d’euro entiers, positifs ou nuls, attendus (réglage du cabinet).`,
    )
  return prix
}

function controlerMontantsLigne(ligne: LigneHonorairesCourrier, ou: string): number | null {
  if (!Number.isFinite(ligne.quantite) || ligne.quantite <= 0)
    throw new Error(`${ou} : quantité invalide (${ligne.quantite}) : strictement positive attendue.`)
  const prix = prixDeLaLigne(ligne, ou)
  if (typeof ligne.soumisTva !== 'boolean') throw new Error(`${ou} : « soumis à TVA » attendu (oui ou non).`)
  if (!Number.isFinite(ligne.tauxTvaPct) || ligne.tauxTvaPct < 0)
    throw new Error(`${ou} : taux de TVA invalide (${ligne.tauxTvaPct}) : pourcentage positif ou nul attendu.`)
  return prix
}

function controlerLigne(ligne: LigneHonorairesCourrier, rang: number, quoi: string): LigneHonorairesCourrierControlee {
  const ou = `${quoi}, ligne ${rang}`
  controlerNatureLigne(ligne, ou)
  const calcul = ligne.calcul ?? 'Coût unitaire'
  if (!(MODES_CALCUL as readonly string[]).includes(calcul)) throw new Error(`${ou} : mode de calcul inconnu « ${calcul} ».`)
  const tarif = texteRequis(ligne.tarif, `${ou} : tarif du catalogue attendu.`)
  const destinataire = texteRequis(ligne.destinataire, `${ou} : destinataire attendu.`)
  if (ligne.objet === 'forfait_mise_en_demeure' && destinataire !== DESTINATAIRE_SYNDICAT)
    throw new Error(
      `${ou} (forfait de mise en demeure) : destinataire « ${destinataire} » refusé : le cabinet facture le forfait au syndicat, qui le paie, puis le syndicat peut l’imputer au copropriétaire en retard (J67, R7). Destinataire attendu : « ${DESTINATAIRE_SYNDICAT} ».`,
    )
  const prixUnitaireHtDixMilliemes = controlerMontantsLigne(ligne, ou)
  return { ...ligne, calcul, tarif, destinataire, prixUnitaireHtDixMilliemes }
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
 * (objet, nature, frais d'envoi d'une nature de rémunération, calcul, tarif, destinataire, forfait de mise en demeure
 * adressé à un autre que le syndicat (J67, R7), quantité, prix, TVA, qualification). Désactivée sans réglage. Forfait
 * sans montant (0, null ou absent) : admis, prix null (« non saisi », J77) ; tant qu'il n'est pas saisi, la règle ne
 * propose aucune ligne (proposerHonorairesDuCourrier). L'état « active » reste celui du réglage.
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
  /** Mission du mandat du courrier, passée à creerElement : « Offert » refusé en mission judiciaire (J67, R9). */
  mission: MissionHonoraires
  aujourdhui: string
  /** Identifiant de chaque élément proposé, fourni par l'appelant. */
  idElement: (cible: CibleLigneHonoraires) => string
  /**
   * Régime du mandat du courrier (baseLigneHonorairesCourrier, J67, R7) ; absent ou null : inconnu. Les trois régimes
   * sont des mandats de justice : un régime donné exige la mission « judiciaire » (controlerAccordRegimeMission).
   */
  regime?: Regime | null
  /**
   * J72 : le dossier visé par le courrier poursuit-il un copropriétaire en retard pour une créance du syndicat ? Fait lu
   * par l'appelant sur la fiche (contentieux : estRecouvrementContreUnCoproprietaire ; comptabilité : compte du
   * copropriétaire relancé). Absent ou null : non établi (casDesFraisDEnvoi : à confirmer pour une mise en demeure ou
   * une relance ; jamais d'imputation au copropriétaire par défaut). Le même fait décide de l'imputation du forfait (J77).
   */
  recouvrementContreUnCoproprietaire?: boolean | null
}

/** Le fait du recouvrement, contrôlé (J72) : oui, non, ou non établi (null). */
function controlerRecouvrement(valeur: unknown): boolean | null {
  if (valeur === undefined || valeur === null) return null
  if (typeof valeur !== 'boolean')
    throw new Error(`Contexte : recouvrement contre un copropriétaire : oui, non ou non établi attendu (J72), reçu « ${String(valeur)} ».`)
  return valeur
}

/**
 * Régime et mission disent le même fait : sj, ap47 et ap291 sont des mandats de justice (D. 1967 art. 46 et 47 ; L. 1965
 * art. 29-1). Un régime donné avec une autre mission que « judiciaire » est refusé : sinon une ligne « Offert » passerait
 * creerElement (J67, R9) alors que la base du forfait la dit soumise au juge (J67, R7). Régime inconnu : la mission seule.
 */
function controlerAccordRegimeMission(regime: Regime | null, mission: MissionHonoraires): void {
  if (regime !== null && mission !== 'judiciaire')
    throw new Error(
      `Contexte incohérent : régime « ${regime} » (mandat de justice) et mission « ${mission} » ; un mandat de justice a la mission « judiciaire » (J67, R7 et R9).`,
    )
}

/** Une saisie d'élément prête pour creerElement, que l'appelant enregistre ou non : rien n'est écrit ici. */
export interface PropositionLigneHonoraires extends BaseLigneHonorairesCourrier {
  regleId: string
  objet: ObjetLigneHonorairesCourrier
  saisie: SaisieElement
}

/**
 * Raisons d'écarter une règle entière : inactive, dossier absent ou ambigu, rattachement incomplet, ou montant d'un
 * forfait non saisi (montant_non_saisi, J77 : la règle ne propose aucune ligne, frais d'envoi compris).
 */
export const MOTIFS_HONORAIRES_ECARTES = ['inactive', 'dossier_absent', 'dossier_ambigu', 'rattachement_incomplet', 'montant_non_saisi'] as const
export type MotifHonorairesEcartes = (typeof MOTIFS_HONORAIRES_ECARTES)[number]

export interface RegleHonorairesEcartee {
  regleId: string
  motif: MotifHonorairesEcartes
  /** montant_non_saisi : rangs des lignes du forfait sans montant, à partir de 1 ; absent pour les autres motifs. */
  rangs?: readonly number[]
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

/**
 * J72 (a) : en mission judiciaire, l'envoi de la mise en demeure ou de la relance d'un copropriétaire en retard (cas
 * « recouvrement ») est une dépense du syndicat ; la ligne du cabinet n'en est que la trace, en Contrôle coûts (point 67),
 * jamais « Facturable ». Ailleurs, cas non établi compris : la qualification de la ligne du cabinet, inchangée.
 */
function qualificationDeLaLigne(
  ligne: LigneHonorairesCourrierControlee,
  regle: RegleHonorairesCourrier,
  { mission, cas }: { mission: MissionHonoraires; cas: CasFraisEnvoi },
  rang: number,
): QualificationElement | undefined {
  const depenseDuSyndicat = ligne.objet === 'frais_envoi' && cas === 'recouvrement' && mission === 'judiciaire'
  if (!depenseDuSyndicat) return ligne.qualification
  if (ligne.qualification === 'Facturable')
    throw new Error(
      `Règle « ${regle.libelle} », ligne ${rang} (frais d’envoi) : « Facturable » refusé. L’envoi d’une mise en demeure ou d’une relance est une dépense du syndicat, payée sur son compte avec la pièce du prestataire postal, puis imputée au copropriétaire en retard (L. 1965 art. 10-1, a ; J72, a) : tracer la ligne en Contrôle coûts.`,
    )
  return ligne.qualification ?? 'Contrôle coûts'
}

/** « ligne 2 » ; « lignes 1 et 3 » ; « lignes 1, 2 et 4 ». */
const lignesCitees = (rangs: readonly number[]): string =>
  rangs.length === 1 ? `ligne ${rangs[0]}` : `lignes ${rangs.slice(0, -1).join(', ')} et ${rangs.at(-1)}`

/** J77 : règle dont le montant d'un forfait n'est pas saisi : aucune ligne proposée ; l'écart dit quoi saisir. */
function ecartMontantNonSaisi(regle: RegleHonorairesCourrier, rangs: readonly number[]): RegleHonorairesEcartee {
  const tarifs = [...new Set(rangs.map((rang) => regle.lignes[rang - 1].tarif))].map((tarif) => `« ${tarif} »`)
  return {
    regleId: regle.id,
    motif: 'montant_non_saisi',
    rangs,
    message: `Règle « ${regle.libelle} » : montant du forfait de mise en demeure non saisi (0 ou vide), ${lignesCitees(rangs)} ; aucune ligne de la règle proposée, frais d’envoi compris. Saisir le prix unitaire HT du forfait (${tarifs.length === 1 ? 'tarif' : 'tarifs'} ${tarifs.join(', ')}) dans le réglage du cabinet : aucun montant par défaut.`,
  }
}

type LigneSaisie = LigneHonorairesCourrierControlee & { prixUnitaireHtDixMilliemes: number }

/**
 * Lignes proposées par la règle, ou l'écart montant_non_saisi (J77) : tant que le montant d'un forfait n'est pas saisi,
 * la règle ne propose aucune ligne. Les refus qui ne dépendent pas du montant restent levés d'abord : « Facturable » de
 * l'envoi d'un recouvrement (J72, a), « Offert » en mission judiciaire (J67, R9, la règle que creerElement applique).
 */
function propositionsDeLaRegle(
  courrier: CourrierEnvoye,
  regle: RegleHonorairesCourrier,
  { dossier, coproprieteId, mandatId }: CibleHonoraires,
  contexte: ContexteHonorairesCourrier,
  ids: Set<string>,
): PropositionLigneHonoraires[] | RegleHonorairesEcartee {
  const cas = casDesFraisDEnvoi(courrier.modele, contexte.recouvrementContreUnCoproprietaire ?? null)
  const regime = contexte.regime ?? null
  // Seul un forfait sans montant saisi a un prix null (controlerLigne).
  const saisies = regle.lignes.filter((ligne): ligne is LigneSaisie => ligne.prixUnitaireHtDixMilliemes !== null)
  if (saisies.length < regle.lignes.length) {
    for (const [i, ligne] of regle.lignes.entries()) {
      const qualification = qualificationDeLaLigne(ligne, regle, { mission: contexte.mission, cas }, i + 1)
      verifierQualificationAdmise(qualificationDe({ qualification }), contexte.mission)
    }
    return ecartMontantNonSaisi(
      regle,
      regle.lignes.flatMap((ligne, i) => (ligne.prixUnitaireHtDixMilliemes === null ? [i + 1] : [])),
    )
  }
  return saisies.map((ligne, i) => {
    const rang = i + 1
    const id = texteRequis(
      contexte.idElement({ regle, ligne, rang, dossier }),
      `Règle « ${regle.libelle} », ligne ${rang} : identifiant d’élément attendu.`,
    )
    if (ids.has(id)) throw new Error(`Proposition refusée : identifiant d’élément « ${id} » en double.`)
    ids.add(id)
    const qualification = qualificationDeLaLigne(ligne, regle, { mission: contexte.mission, cas }, rang)
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
      ...(qualification === undefined ? {} : { qualification }),
    }
    // Contrôle seul : la saisie passe les règles de l'élément (point 66 ; J67, R9 pour la mission), rien n'est écrit.
    creerElement(saisie, contexte.mission)
    return { regleId: regle.id, objet: ligne.objet, saisie, ...baseLigneHonorairesCourrier(ligne.objet, { regime, mission: contexte.mission, cas }) }
  })
}

/**
 * Lignes d'honoraires proposées pour l'envoi d'un courrier : pour chaque règle active qui le vise, une saisie d'élément
 * par ligne du cabinet (dossier et fiche du dossier visé, point 66 ; date de dépôt ; copropriété et mandat du
 * courrier), contrôlée par creerElement, avec sa base selon le régime et la mission du mandat et le cas du courrier
 * (baseLigneHonorairesCourrier : forfait en deux lignes, J67, R7, imputé au copropriétaire pour le seul recouvrement
 * contre un copropriétaire en retard, J77 ; frais d'envoi, J72, casDesFraisDEnvoi : dépense du syndicat pour la mise en
 * demeure ou la relance d'un copropriétaire en retard, tracée en Contrôle coûts en mission judiciaire ; frais du cabinet
 * à présenter au juge pour les autres envois ; à confirmer si le dossier ne dit pas qui il poursuit). Rien n'est écrit.
 * Règles écartées : inactive, dossier absent ou ambigu, copropriété ou mandat manquants, montant d'un forfait non saisi
 * (J77 : montant_non_saisi, avec ce qu'il faut saisir ; aucune ligne de la règle proposée, frais d'envoi compris).
 * Refus : courrier invalide ou non déposé, dépôt postérieur à aujourd'hui, régime hors liste, régime de justice avec une
 * mission autre que « judiciaire », fait du recouvrement qui n'est ni oui, ni non, ni non établi, règles invalides ou en
 * double, identifiant d'élément vide ou en double, ligne d'envoi du recouvrement « Facturable » en mission judiciaire
 * (J72, a), ligne « Offert » en mission judiciaire (J67, R9), montant saisi ou non.
 */
export function proposerHonorairesDuCourrier(
  courrier: CourrierDeclencheur,
  regles: readonly SaisieRegleHonorairesCourrier[],
  contexte: ContexteHonorairesCourrier,
): ResultatHonorairesCourrier {
  const envoye = controlerCourrier(courrier, contexte.aujourdhui)
  controlerAccordRegimeMission(controlerRegime(contexte.regime ?? null), contexte.mission)
  controlerRecouvrement(contexte.recouvrementContreUnCoproprietaire)
  const controlees = sansIdentifiantEnDouble(regles.map((regle) => creerRegleHonorairesCourrier(regle)))
  const resultat: ResultatHonorairesCourrier = { courrierId: envoye.id, propositions: [], ecartees: [] }
  const ids = new Set<string>()
  for (const regle of controlees.filter((r) => declenche(envoye, r.declencheur))) {
    const cible = cibleDesHonoraires(envoye, regle)
    const issue = 'motif' in cible ? cible : propositionsDeLaRegle(envoye, regle, cible, contexte, ids)
    if (Array.isArray(issue)) resultat.propositions.push(...issue)
    else resultat.ecartees.push(issue)
  }
  return resultat
}
