import {
  fichesLiees,
  creerRattachement,
  rattachementsDuCourrier,
  type FicheLiee,
  type OptionsFichesLiees,
  type PageFichesLiees,
  type Rattachement,
} from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import {
  NATURES_REMUNERATION,
  categorieDe,
  corrigerQuantite,
  creerElement,
  estFacturable,
  totalElement,
  type ElementAFacturer,
  type NatureElement,
  type SaisieElement,
} from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import {
  SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE,
  SOURCE_FRAIS_ET_DEBOURS,
  verifierNombreDeLots,
} from '@/lib/administrateur-judiciaire/domain/ordonnances-remuneration'
import { normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'

export { SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE }

/**
 * Honoraires rattachés à une fiche sinistre (point 66 du bilan 2). Fonctions pures, montants en CENTIMES ENTIERS (taux
 * horaire HT en dix-millièmes d'euro, comme honoraires-facturation.ts), sans écran ni table : la table des éléments à
 * facturer viendra avec l'accord de Frédéric.
 *
 * Sources Gestéam :
 * - 🟢 Tranche 42 § Flux : nœud « Honoraires lignes » (« Suivi et gestion MRI », À facturer) rattaché au sinistre dès son
 *   ouverture ; bouton « Honoraires (€) » de la barre d'outils de la fiche.
 * - 🟢 Tranche 42 § Complément (28/10/2026, 00:06) : Dossier = type « Sinistre » + la fiche précise ; nature
 *   « Prestations » ; calcul « Coût Horaire » (horaires début / fin hh:mm, coût horaire HT, Nbre d'heure 1,00 par défaut,
 *   Total HT) ; destinataire « Syndicat des copropriétaires » ; date de l'élément = ouverture du dossier, pas la survenance.
 * - 🟢 Tranche 27 § Catalogue des tarifs : les quatre tarifs « Sinistre - SINISTRE … » des diligences hors forfait, plus
 *   « SINISTRE PRESTATION EN DEHORS JOURS ET HEURES OUVRABLES ». Le même catalogue porte « Gestion - REGLEMENT
 *   COPROPRIETE- ETAT DESCRIPTIF DES DIVISIONS » et « Contentieux - RET - DECLARATION DE LA CREANCE » : ni l'un ni l'autre
 *   n'est une diligence de sinistre.
 *
 * Droit (relevé sur Légifrance le 29/10/2026, texte en vigueur) :
 * - 🟢 Contrat type de syndic (D. 1967 annexe 1) : seules quatre diligences de sinistre sont rémunérées hors forfait
 *   (7.2.4 ; liste limitative de l'annexe 2, III, 6° à 9°), au coût horaire au prorata du temps passé ou au forfait convenu
 *   (7.2.1) ; la déclaration et le règlement des indemnités restent au forfait (7.1.1) ; toute somme versée par l'assureur
 *   au syndic pour ces diligences vient en déduction de la rémunération due au titre du 7.2.4 (dernier alinéa).
 *   🔵 elementAOuvertureSinistre ne crée que l'élément au coût horaire (seul observé, tranche 42) ; un tarif forfaitaire
 *   convenu passe par creerElement (calcul « Coût unitaire », quantité 1), que le contrôle et le solde traitent de même.
 * - 🟢 Administrateur provisoire de l'art. 29-1, copropriété de MOINS de 500 lots : la gestion administrative et
 *   matérielle des sinistres, hors déclaration de sinistre et déduction faite des sommes versées par l'assureur, est un
 *   acte rémunéré hors droits fixes et proportionnels (arrêté du 8 octobre 2015, art. 14, qui ne donne aucune liste de
 *   diligences). Ceci corrige la tranche 42 et la ligne 66 du bilan (« aucune base ») : il y a une base, mais le juge fixe
 *   les acomptes et arrête la rémunération (D. 1967 art. 61-1-5, II et III). 🔵 Donc AUCUN élément « A facturer » au
 *   syndicat : un signalement « à soumettre au juge ». La désignation de l'AP met fin au contrat de syndic (annexe 1,
 *   point 10 ; L. 1965 art. 29-1, I, al. 2) : ni son coût horaire, ni son forfait (7.1.1), ni l'annexe 2 ne s'appliquent.
 * - 🟢 Copropriété de 500 lots et plus : « par dérogation aux articles 4 à 15 », l'entière rémunération de l'AP est
 *   fixée par le juge en fonction des frais engagés et des diligences accomplies (arrêté du 8 octobre 2015, art. 3) :
 *   l'art. 14 et son exclusion de la déclaration ne s'appliquent pas. Cadre « rémunération fixée par le juge ». 🔵 Aucun
 *   élément, aucune diligence refusée ; les frais aussi sont signalés, puisque le juge en tient compte. 🔵 Le seuil se
 *   compare au nombre de lots de la copropriété passé par l'appelant (l'article ne distingue pas les lots).
 * - 🟢 Syndic désigné par le juge (D. 1967 art. 46), AP désigné faute de syndic (art. 47), administrateur ad hoc (art. 49) :
 *   la rémunération est fixée, sur justification de l'accomplissement de la mission, par le président de la juridiction
 *   qui a désigné le cabinet (C. com. R. 814-27, lu le 17/11/2026 ; recours : CPC art. 714 à 718) ; il peut fixer une
 *   provision (R. 814-28). Le mandataire ad hoc des art. 29-1 A à 29-1 C a son propre régime : forfait sous 500 lots
 *   (arrêté du 8 octobre 2015, art. 1), au-delà conditions fixées par l'ordonnance de désignation, et dans les deux cas
 *   une rémunération arrêtée par le président en fin de mission (D. 1967 art. 61-1-4). D'où le cadre « rémunération
 *   fixée par le président » (J67, R1), qui remplace le cadre « non établi » avec le même comportement : aucun élément
 *   « A facturer », un signalement « à soumettre au juge », aucune diligence refusée. Son message ne cite R. 814-27 et
 *   R. 814-28 que pour les art. 46, 47 et 49, et donne à part le régime du mandataire ad hoc. Mission « en matière
 *   civile » : une déduction.
 * - 🔵 Régime null (regimeDepuisFondement : fondement vide ou non reconnu, ou l'un des deux « ad hoc », qu'il ne
 *   distingue pas ; fondements.ts hors de ce lot, J67, R1) : cadre « regime_inconnu », même comportement que le cadre
 *   « fixée par le président », appliqué par défaut. Son message ne présume pas le régime : il demande de le vérifier
 *   sur le fondement du mandat, donne les deux régimes « ad hoc », et rappelle qu'une AP de l'art. 29-1 mal saisie relève
 *   de son tarif (comme CADRE_REGIME_INCONNU de travaux-budget.ts).
 * 🔵 Le cadre « contrat type de syndic » ne se déduit d'aucun régime judiciaire : l'appelant le passe pour un mandat de
 * syndic conventionnel.
 * - 🟢 Frais d'envoi, contrat type : remboursés au syndic à part, pour les prestations du forfait (7.1.5, alinéa sur
 *   l'envoi des documents, que suivent ceux des archives, de l'accès en ligne et du prorata) comme pour les prestations
 *   particulières (7.2.1, al. 2). Ces deux textes ne visent que l'affranchissement et l'acheminement. 🟢 Les frais de
 *   reprographie afférents aux prestations du forfait sont inclus dans le forfait (7.1.1, al. 2), et la déclaration
 *   comme le règlement des indemnités en font partie (7.1.1). 🔵 Une copie dont le tarif nomme l'une ou l'autre en
 *   relève : au contrat type, signalée « diligence_au_forfait » et écartée du solde, ni frais ni honoraires ; son envoi
 *   reste un frais remboursé (7.1.5, alinéa sur l'envoi des documents). 🔵 Natures de la reprographie : Copie et
 *   Diffuseur copie. 🔵 Seules les natures Vacations, Honoraires et Prestations rémunèrent une diligence
 *   (NATURES_REMUNERATION de honoraires-facturation.ts, liste partagée avec le tableau des honoraires) ; les autres
 *   (timbre, AR, copie, envois, diffuseurs) sont des frais : hors contrôle des diligences (sauf cette reprographie) et
 *   hors déduction de l'assureur (un timbre n'est ni une diligence ni un acte de l'art. 14).
 * - 🟢 Contrat type, 7.2.4 : la prestation faite hors jours et heures ouvrables, rendue nécessaire par l'urgence, est
 *   facturée sans majoration ou au coût horaire majoré du pourcentage fixé au contrat (coutHoraireUrgence).
 * 🔵 Le tarif d'urgence hors jours et heures ouvrables est une modalité de l'une des quatre diligences ; la majoration,
 * au centième de point au plus, est calculée en entiers et portée par le coût horaire passé par l'appelant, arrondie au
 * dix-millième d'euro (demi au-dessus).
 * 🔵 « Gestion - Gestion des sinistres, rendez-vous constat » (tranche 27) n'est rattaché à aucune des quatre diligences :
 * diligence non identifiée sous le contrat type, dont l'annexe 2 est limitative ; sans objet hors du contrat type.
 * Point 67 — 🟢 tranche 43 § 13 : « une diligence comprise dans le forfait se trace en offert ou contrôle coûts ».
 * 🔵 Un élément offert ou en contrôle des coûts n'est ni facturé ni présenté comme dû : le contrôle n'y signale que
 * l'absence de fiche (ni diligence au forfait, ni acte hors tarif, ni rémunération à soumettre au juge), et le solde
 * l'ignore (hors base, hors frais, hors écartés). L'élément créé à l'ouverture reste « Facturable » (🟢 tranche 42).
 *
 * Décisions de Hugo du 03/11/2026 (registre des décisions juridiques, J38 ; question 30 de la liste) :
 * - J38 : l'élément d'honoraires créé à l'ouverture d'un sinistre compte 1 heure, comme Gestéam
 *   (HEURES_A_L_OUVERTURE_SINISTRE) ; le temps passé se corrige ensuite (corrigerHeures). Choix actuel confirmé : il
 *   n'est plus « à trancher », et creerElement continue de refuser une quantité nulle.
 *
 * Décisions de Hugo du 17/11/2026 (registre des décisions juridiques, J67 : recommandations validées en bloc ; textes
 * relus sur Légifrance le 17/11/2026 ; lecture des textes, pas un avis d'avocat) :
 * - J67, R1 : cadre « rémunération fixée par le président » (remuneration_fixee_par_le_president, ci-dessus), pour l'AP
 *   de l'art. 47, l'administrateur ad hoc et le syndic judiciaire (C. com. R. 814-27 et R. 814-28) ; le mandataire ad
 *   hoc relève de D. 1967 art. 61-1-4. Régime null : cadre « regime_inconnu », à vérifier (🔵, ci-dessus).
 * - J67, R2 : en administration provisoire, aucun élément « A facturer » au syndicat sans ordonnance d'acompte ou de fin
 *   de mission : un signalement « à soumettre au juge » (choix actuel confirmé). Seul le droit fixe de 1 500 € HT est
 *   perçu dès la désignation, sous 500 lots (D. 1967 art. 61-1-5, I ; arrêté, art. 3 et 4). La règle générale est dans
 *   preparerFacture (honoraires-facturation.ts, J67, R3) : le droit fixe n'y couvre que l'élément qui le facture, et
 *   une diligence de sinistre sans ordonnance y est refusée, comme le signale controlerHonorairesSinistre.
 * - J67, R8 : la somme versée par l'assureur au titre des diligences se déduit de la rémunération due, TTC (choix actuel
 *   confirmé ; contrat type, 7.2.1 et 7.2.4, dernier al. ; arrêté, art. 14). Ce qu'un tiers paie en contrepartie du
 *   service fait partie du prix taxable (directive 2006/112/CE, art. 73) : la somme se lit TVA comprise. L'équivalent HT
 *   est rendu à part (deductionHtEquivalentCentimes, un seul taux de TVA), car le tarif et le juge raisonnent en HT.
 *   Point fiscal à faire confirmer par le comptable du cabinet. Pas de déduction quand l'assureur paie le SYNDICAT : les
 *   deux textes visent la somme versée au syndic ou à l'administrateur provisoire. À 500 lots et plus, l'art. 14 ne
 *   s'applique pas (art. 3) : la déduction est calculée et présentée au juge, sans être imposée (règle professionnelle
 *   810.2 : appliquer le tarif « avec transparence et loyauté à l'égard de la juridiction »).
 * - J67, R14 : sans objet pour le cabinet (C. com. L. 811-10 : un administrateur judiciaire ne peut être syndic désigné
 *   par l'assemblée). Si le cadre du contrat type sert un jour (question F6, Frédéric) : les copies afférentes à l'une
 *   des quatre diligences hors forfait sont comprises dans la rémunération de la prestation particulière, et seul
 *   l'envoi est remboursé à part (7.2.1) ; anomalieDeReprographie devra alors les signaler et le solde les écarter.
 *   Hors contrat type, une copie est un frais (J72, b, ci-dessous).
 *
 * Décision de Hugo du 18/11/2026 (registre des décisions juridiques, J72 ; question Q5, conflit R5 / R6) :
 * - J72 (décision de Hugo du 18/11/2026) : frais d'envoi. (b) Les envois du cabinet pour un dossier sinistre (timbre,
 *   AR, copie, envois, diffuseurs) sont des frais du cabinet, à part de sa rémunération, présentés au juge en annexe
 *   « frais et débours » et payés seulement en vertu de son ordonnance (C. com. R. 814-27 ; R5) : hors contrat type,
 *   chaque frais du dossier Sinistre est signalé « à présenter au juge » (anomalie frais_a_presenter_au_juge, avec la
 *   source propre au cadre : sous 500 lots, les frais et débours que l'ordonnance arrête, Cass. 3e civ., 21/05/2026,
 *   n° 24-20.377, J67, R5 (relecture du 18/11/2026 : D. 1967 art. 61-1-5, II ne vise que les émoluments, son III,
 *   al. 2 les seuls droits proportionnels au-delà du seuil de l'arrêté) ; arrêté du 8 octobre 2015, art. 3 à 500 lots et
 *   plus ; C. com. R. 814-27 pour la rémunération fixée par le président ; régime à vérifier s'il est inconnu), jamais
 *   facturé au syndicat sans l'ordonnance (preparerFacture, J67, R3) ; le solde les garde à part (fraisTtcCentimes). Au
 *   contrat type de syndic, ils restent remboursés au syndic (7.1.5 et 7.2.1) et ne sont pas signalés. (a) La mise en
 *   demeure et les relances d'un copropriétaire en retard sont une dépense du syndicat, imputée au seul copropriétaire
 *   concerné (L. 1965 art. 10-1, a ; R6) : hors des sinistres, traitée dans etapes-courrier.ts. Une seule règle pour les
 *   deux modules.
 *
 * Questions ouvertes :
 * - 🔴 (Frédéric) En administration provisoire (art. 29-1), comment le cabinet chiffre-t-il les actes hors tarif de
 *   l'art. 14 de l'arrêté (sinistres, recouvrement, mutation, réunions d'information) : temps passé × un taux horaire du
 *   cabinet, présenté au juge dans le compte provisoire détaillé des émoluments ? Aucun texte ne fixe le mode de calcul.
 * - 🔴 (Frédéric) Le cabinet gère-t-il dans VitFix des mandats de syndic conventionnels (seul cas où l'élément est créé) ?
 *   Question F6 ; pour le cabinet, C. com. L. 811-10 (J67, R14 et R15).
 * - 🔴 (Frédéric ou Hugo) Quel arrondi pour taux horaire × durée ? Choix actuel : durée en minutes exactes, heures au
 *   centième (comme le « Nbre d'heure » Gestéam), montant arrondi au centime par totalElement.
 * - 🔴 (Frédéric) Taux horaire et taux de TVA par défaut : réglages du cabinet, non relevés (passés par l'appelant).
 * - 🔴 (Frédéric) Administration provisoire de 500 lots et plus : le juge fixe la rémunération « en fonction des frais
 *   engagés et des diligences accomplies » (arrêté du 8 octobre 2015, art. 3). Un élément en contrôle des coûts doit-il
 *   alors être signalé « à soumettre au juge » comme justificatif ? Choix actuel : non (seule l'absence de fiche), il
 *   figure au tableau des honoraires (honoraires-tableau.ts). Et en AP de moins de 500 lots, faut-il créer à l'ouverture
 *   un élément « Contrôle coûts » plutôt que le seul signalement ? Choix actuel : inchangé (signalement).
 */

export const CADRES_REMUNERATION_SINISTRE = [
  'contrat_type_syndic',
  'tarif_administrateur_provisoire',
  'remuneration_fixee_par_le_juge',
  'remuneration_fixee_par_le_president',
  'regime_inconnu',
] as const
export type CadreRemunerationSinistre = (typeof CADRES_REMUNERATION_SINISTRE)[number]
type CadreSansElement = Exclude<CadreRemunerationSinistre, 'contrat_type_syndic'>

/** 🟢 Diligences rémunérées hors forfait (D. 1967 annexe 1, 7.2.4 ; annexe 2, III) et tarifs du catalogue (tranche 27). */
export const DILIGENCES_SINISTRE_HORS_FORFAIT = [
  {
    code: 'deplacement',
    libelle: 'Déplacements sur les lieux',
    rubrique: 'D. 1967 annexe 2, III, 6°',
    tarifGesteam: 'SINISTRE VACATIONS DEPLACEMENT SUR LES LIEUX',
  },
  {
    code: 'mesures_conservatoires',
    libelle: 'Prise de mesures conservatoires',
    rubrique: 'D. 1967 annexe 2, III, 7°',
    tarifGesteam: 'SINISTRE MESURES CONSERVATOIRES',
  },
  {
    code: 'assistance_expertise',
    libelle: "Assistance aux mesures d'expertise",
    rubrique: 'D. 1967 annexe 2, III, 8°',
    tarifGesteam: "SINISTRE ASSISTANCE AUX MESURES D'EXPERTISE",
  },
  {
    code: 'suivi_assureur',
    libelle: "Suivi du dossier auprès de l'assureur",
    rubrique: 'D. 1967 annexe 2, III, 9°',
    tarifGesteam: "SINISTRE SUIVI DU DOSSIER AUPRES DE L'ASSUREUR",
  },
] as const
export type DiligenceSinistreHorsForfait = (typeof DILIGENCES_SINISTRE_HORS_FORFAIT)[number]['code']

/** 🟢 Diligences comprises dans le forfait du contrat type : aucune rémunération supplémentaire. */
export const DILIGENCES_SINISTRE_AU_FORFAIT = [
  {
    code: 'declaration',
    libelle: 'Formalités de déclaration du sinistre',
    rubrique: 'D. 1967 annexe 1, 7.1.1 ; liste annexée au contrat, V-17°',
  },
  {
    code: 'reglement_indemnites',
    libelle: 'Gestion des règlements aux bénéficiaires',
    rubrique: 'D. 1967 annexe 1, 7.1.1 ; liste annexée au contrat, V-18°',
  },
] as const
export type DiligenceSinistreAuForfait = (typeof DILIGENCES_SINISTRE_AU_FORFAIT)[number]['code']

/** Diligence de sinistre : l'une des quatre hors forfait, ou l'une des deux au forfait du contrat type. */
export type DiligenceSinistre = DiligenceSinistreHorsForfait | DiligenceSinistreAuForfait

const DILIGENCES_SINISTRE: readonly { code: DiligenceSinistre; libelle: string }[] = [
  ...DILIGENCES_SINISTRE_HORS_FORFAIT,
  ...DILIGENCES_SINISTRE_AU_FORFAIT,
]

/** 🟢 Tarif d'urgence (7.2.4) : prestation hors jours et heures ouvrables, sans majoration ou au coût horaire majoré. */
export const TARIF_SINISTRE_HORS_HEURES_OUVRABLES = 'SINISTRE PRESTATION EN DEHORS JOURS ET HEURES OUVRABLES'

/** 🔵 Natures qui rémunèrent une diligence (NATURES_REMUNERATION) ; les autres sont des frais (envoi, copie…). */
export const NATURES_REMUNERATION_SINISTRE = NATURES_REMUNERATION

/** 🔵 Natures de la reprographie (copies du cabinet ou du diffuseur), seuls frais visés par le 7.1.1, al. 2. */
export const NATURES_REPROGRAPHIE_SINISTRE = ['Copie', 'Diffuseur copie'] as const satisfies readonly NatureElement[]

const aLaNature =
  (natures: readonly NatureElement[]) =>
  (element: ElementAFacturer): boolean =>
    natures.includes(element.nature)

const estRemuneration = (element: ElementAFacturer): boolean => categorieDe(element) === 'Rémunération'
const estReprographie = aLaNature(NATURES_REPROGRAPHIE_SINISTRE)

/** Pourcentages en centièmes de point (majoration, taux de TVA) ; 100 % en centièmes de point (base des calculs entiers). */
const CENTIEMES_PAR_POINT = 100
const CENT_POUR_CENT = 100 * CENTIEMES_PAR_POINT
/** Écart toléré entre la majoration × 100 et son entier le plus proche (imprécision binaire, pas une décimale de plus). */
const TOLERANCE_CENTIEMES = 1e-6

/**
 * Coût horaire HT d'urgence (7.2.4) : coût horaire du contrat majoré du pourcentage convenu (0 : sans majoration).
 * 🔵 Calcul en entiers (majoration au centième de point au plus), arrondi au dix-millième d'euro, demi au-dessus.
 */
export function coutHoraireUrgence(coutHoraireHtDixMilliemes: number, majorationPct: number): number {
  if (!Number.isInteger(coutHoraireHtDixMilliemes) || coutHoraireHtDixMilliemes < 0)
    throw new Error(`Coût horaire invalide (${coutHoraireHtDixMilliemes}) : dix-millièmes d'euro entiers positifs attendus.`)
  if (!Number.isFinite(majorationPct) || majorationPct < 0) throw new Error(`Majoration invalide (${majorationPct}) : pourcentage positif attendu.`)
  const majorationCentiemes = Math.round(majorationPct * CENTIEMES_PAR_POINT)
  if (Math.abs(majorationPct * CENTIEMES_PAR_POINT - majorationCentiemes) > TOLERANCE_CENTIEMES)
    throw new Error(`Majoration invalide (${majorationPct}) : deux décimales au plus attendues.`)
  const produit = coutHoraireHtDixMilliemes * (CENT_POUR_CENT + majorationCentiemes)
  if (!Number.isSafeInteger(produit)) throw new Error(`Coût horaire trop élevé (${coutHoraireHtDixMilliemes}) pour un calcul exact.`)
  return Math.round(produit / CENT_POUR_CENT)
}

export type DiligenceLueDansTarif = DiligenceSinistre | 'hors_heures_ouvrables'

const FONDEMENTS_PAR_LE_PRESIDENT: readonly string[] = [
  'C. com. R. 814-27 : rémunération fixée sur justification par le président qui a désigné ; recours, CPC art. 714 à 718',
  'C. com. R. 814-28 : provision',
  'D. 1967 art. 46, 47 et 49 : désignations par le président du tribunal judiciaire',
  'D. 1967 art. 61-1-4 : mandataire ad hoc des art. 29-1 A à 29-1 C',
]

export const FONDEMENTS_HONORAIRES_SINISTRE: Readonly<Record<CadreRemunerationSinistre, readonly string[]>> = {
  contrat_type_syndic: [
    'L. 1965 art. 18-1 A, I',
    'D. 1967 art. 29 ; annexe 2, III, 6° à 9°',
    'D. 1967 annexe 1, points 7.1.1, 7.2.1 et 7.2.4',
  ],
  tarif_administrateur_provisoire: ['L. 1965 art. 29-1, II', 'D. 1967 art. 61-1-5, I à III', 'Arrêté du 8 octobre 2015, art. 14'],
  remuneration_fixee_par_le_juge: ['L. 1965 art. 29-1, II', 'D. 1967 art. 61-1-5, II et III', 'Arrêté du 8 octobre 2015, art. 3'],
  remuneration_fixee_par_le_president: FONDEMENTS_PAR_LE_PRESIDENT,
  /** 🔵 Cadre appliqué par défaut, à vérifier sur le fondement du mandat : mêmes textes. */
  regime_inconnu: FONDEMENTS_PAR_LE_PRESIDENT,
}

const SOURCE_TARIF_AP = 'arrêté du 8 octobre 2015, art. 14'
const SOURCE_REMUNERATION_PAR_LE_JUGE = 'arrêté du 8 octobre 2015, art. 3'
const SOURCE_FORFAIT = 'D. 1967 annexe 1, 7.1.1'
const SOURCE_REPROGRAPHIE = 'D. 1967 annexe 1, 7.1.1, al. 2'
const SOURCE_HORS_FORFAIT = 'D. 1967 annexe 2, III, 6° à 9°'
const AP_PAR_LE_JUGE =
  `Administration provisoire (art. 29-1), copropriété de ${SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE} lots et plus : l'entière ` +
  `rémunération est fixée par le juge en fonction des frais engagés et des diligences accomplies`
/** J67, R1 : C. com. R. 814-27 et R. 814-28 pour les art. 46, 47 et 49 seulement. */
const SUR_JUSTIFICATION = 'sur justification des diligences (C. com. R. 814-27 ; provision possible, R. 814-28)'
/** J67, R1 : le mandataire ad hoc a son propre régime (D. 1967 art. 61-1-4 ; arrêté du 8 octobre 2015, art. 1). */
const MANDATAIRE_AD_HOC =
  'Mandataire ad hoc (art. 29-1 A à 29-1 C) : rémunération arrêtée par le président en fin de mission (D. 1967 art. ' +
  "61-1-4 ; forfait de l'arrêté du 8 octobre 2015, art. 1, sous 500 lots ; au-delà, conditions fixées par l'ordonnance " +
  'de désignation)'
/** J67, R1 : syndic judiciaire (art. 46), AP faute de syndic (art. 47), administrateur ad hoc (art. 49) ; mandataire ad hoc à part. */
const PAR_LE_PRESIDENT =
  "Mandat de justice hors du tarif de l'art. 29-1. Syndic judiciaire (art. 46), AP faute de syndic (art. 47) ou " +
  `administrateur ad hoc (art. 49) : rémunération fixée par le président du tribunal qui a désigné le cabinet, ${SUR_JUSTIFICATION}. ` +
  MANDATAIRE_AD_HOC
/**
 * 🔵 Régime null (fondement vide ou non reconnu, ou mandat ad hoc, que fondements.ts ne distingue pas) : cadre « fixée
 * par le président » par défaut, à vérifier ; aucune affirmation sur le régime (comme CADRE_REGIME_INCONNU de
 * travaux-budget.ts).
 */
const REGIME_INCONNU =
  'Régime du mandat non reconnu (fondement vide ou non reconnu, ou mandat ad hoc) : par défaut, rémunération fixée par ' +
  'le président du tribunal qui a désigné le cabinet, à vérifier sur le fondement du mandat. Administrateur ad hoc ' +
  `(art. 49) : ${SUR_JUSTIFICATION}. ${MANDATAIRE_AD_HOC}. Administration provisoire de l'art. 29-1 : corriger le ` +
  "fondement, son tarif s'applique (D. 1967 art. 61-1-5)"

function verifierCadre(cadre: CadreRemunerationSinistre): void {
  if (!(CADRES_REMUNERATION_SINISTRE as readonly string[]).includes(cadre)) throw new Error(`Cadre de rémunération inconnu : « ${cadre} ».`)
}

/**
 * Cadre de rémunération d'un mandat judiciaire : seul l'AP de l'art. 29-1 a un tarif écrit (art. 61-1-5), sauf à 500 lots
 * et plus, où le juge fixe toute la rémunération (arrêté art. 3). Syndic judiciaire et AP de l'art. 47 : rémunération
 * fixée par le président qui a désigné (C. com. R. 814-27 ; J67, R1). Régime null (ad hoc, fondement vide ou non
 * reconnu) : « regime_inconnu », même comportement, message à vérifier (🔵). Le nombre de lots n'est lu que pour l'AP de
 * l'art. 29-1.
 */
export function cadreRemunerationDuRegime(regime: Regime | null, nbLots: number): CadreRemunerationSinistre {
  if (regime === null) return 'regime_inconnu'
  if (regime !== 'ap291') return 'remuneration_fixee_par_le_president'
  verifierNombreDeLots(nbLots)
  return nbLots >= SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE ? 'remuneration_fixee_par_le_juge' : 'tarif_administrateur_provisoire'
}

type LectureTarif = (aLeMot: (racine: string) => boolean, normalise: string) => boolean

/** Le règlement de copropriété (et l'état descriptif de division) n'est pas le règlement d'un sinistre. */
const REGLEMENT_DE_COPROPRIETE = /REGLEMENTS? (DE (LA )?)?COPROPRIETE/

/**
 * Lecture du tarif, dans cet ordre : d'abord les diligences au forfait (une mention de la déclaration ou du règlement
 * l'emporte, par prudence), puis l'urgence, puis les quatre diligences. La déclaration d'une créance n'est pas celle du
 * sinistre ; le règlement suppose les indemnités ou les bénéficiaires, et n'est pas le règlement de copropriété.
 * 🔵 « SUIVI ET GESTION » (tarif de l'élément créé à l'ouverture, tranche 42) = suivi du dossier auprès de l'assureur.
 */
const LECTURES_TARIF: readonly (readonly [LectureTarif, DiligenceLueDansTarif])[] = [
  [(aLeMot) => aLeMot('DECLARATION') && !aLeMot('CREANCE'), 'declaration'],
  [
    (aLeMot, normalise) =>
      aLeMot('REGLEMENT') && (aLeMot('INDEMNIT') || aLeMot('BENEFICIAIR')) && !REGLEMENT_DE_COPROPRIETE.test(normalise),
    'reglement_indemnites',
  ],
  [(aLeMot) => aLeMot('OUVRABLE'), 'hors_heures_ouvrables'],
  [(aLeMot) => aLeMot('DEPLACEMENT'), 'deplacement'],
  [(aLeMot) => aLeMot('EXPERTISE'), 'assistance_expertise'],
  [(aLeMot) => aLeMot('CONSERVATOIRE'), 'mesures_conservatoires'],
  [(aLeMot, normalise) => (aLeMot('SUIVI') && aLeMot('ASSUREUR')) || normalise.includes('SUIVI ET GESTION'), 'suivi_assureur'],
]

export function diligenceDuTarif(tarif: string): DiligenceLueDansTarif | null {
  const normalise = normaliserTexte(tarif)
  const mots = normalise.split(' ')
  const aLeMot = (racine: string) => mots.some((mot) => mot.startsWith(racine))
  return LECTURES_TARIF.find(([lecture]) => lecture(aLeMot, normalise))?.[1] ?? null
}

const estAuForfait = (lue: DiligenceLueDansTarif | null): lue is DiligenceSinistreAuForfait =>
  DILIGENCES_SINISTRE_AU_FORFAIT.some((d) => d.code === lue)

type FicheDiligenceHorsForfait = (typeof DILIGENCES_SINISTRE_HORS_FORFAIT)[number]
type FicheDiligence = (typeof DILIGENCES_SINISTRE)[number]

const diligenceInconnue = (code: string): never => {
  throw new Error(`Diligence de sinistre inconnue : « ${code} ».`)
}

const ficheDiligence = (code: DiligenceSinistre): FicheDiligence =>
  DILIGENCES_SINISTRE.find((d) => d.code === code) ?? diligenceInconnue(code)

/** Contrat type : l'une des quatre diligences hors forfait (7.2.4), jamais une diligence au forfait (7.1.1). */
function diligenceHorsForfait(code: DiligenceSinistre): FicheDiligenceHorsForfait {
  if (estAuForfait(code)) throw new Error(`Diligence « ${code} » : comprise dans le forfait (${SOURCE_FORFAIT}), aucun élément.`)
  return DILIGENCES_SINISTRE_HORS_FORFAIT.find((d) => d.code === code) ?? diligenceInconnue(code)
}

/** Cohérence des données, sans règle de droit : un tarif qui nomme une diligence doit nommer celle de l'élément. */
function verifierTarifCoherent(tarif: string, lue: DiligenceLueDansTarif | null, diligence: FicheDiligence): void {
  if (lue !== null && lue !== 'hors_heures_ouvrables' && lue !== diligence.code)
    throw new Error(`Tarif « ${tarif} » : il vise une autre diligence (${lue}) que « ${diligence.libelle} ».`)
}

/** Contrat type : tarif du catalogue pour la diligence, ou celui de l'appelant s'il vise bien cette diligence. */
function tarifDeLaDiligence(diligence: FicheDiligenceHorsForfait, tarif: string | undefined): string {
  if (tarif === undefined) return `Sinistre - ${diligence.tarifGesteam}`
  const lue = diligenceDuTarif(tarif)
  if (estAuForfait(lue)) throw new Error(`Tarif « ${tarif} » : diligence comprise dans le forfait (${SOURCE_FORFAIT}), aucun élément.`)
  if (lue === null) throw new Error(`Tarif « ${tarif} » : diligence de sinistre non identifiée (${SOURCE_HORS_FORFAIT}).`)
  verifierTarifCoherent(tarif, lue, diligence)
  return tarif
}

/**
 * Hors contrat type, ni le forfait (7.1.1) ni l'annexe 2 : en AP de moins de 500 lots, seule la déclaration est refusée
 * (arrêté art. 14) ; à 500 lots et plus, quand le président fixe la rémunération (R. 814-27) et pour un régime inconnu,
 * rien n'est refusé. La cohérence du tarif reste contrôlée.
 */
function verifierHorsContratType(code: DiligenceSinistre, tarif: string | undefined, cadre: CadreSansElement): void {
  const diligence = ficheDiligence(code)
  const lue = tarif === undefined ? null : diligenceDuTarif(tarif)
  if (cadre === 'tarif_administrateur_provisoire' && (code === 'declaration' || lue === 'declaration'))
    throw new Error(`Déclaration du sinistre : exclue des actes hors tarif (${SOURCE_TARIF_AP}), aucun signalement.`)
  if (tarif !== undefined) verifierTarifCoherent(tarif, lue, diligence)
}

/** Durée de l'élément créé à l'ouverture d'un sinistre : 1 heure, comme Gestéam (🟢 tranche 42 ; décision J38). */
export const HEURES_A_L_OUVERTURE_SINISTRE = 1

export interface OuvertureSinistre {
  elementId: string
  sinistreId: string
  coproprieteId: string
  mandatId: string
  /** Date d'ouverture du dossier dans le logiciel (🟢 pas la survenance). */
  dateOuverture: string
  /** Coût horaire HT du contrat (majoré le cas échéant pour l'urgence), en dix-millièmes d'euro. */
  coutHoraireHtDixMilliemes: number
  soumisTva: boolean
  tauxTvaPct: number
  /**
   * 🔵 Par défaut : suivi du dossier auprès de l'assureur (« Suivi et gestion MRI » de Gestéam). Une diligence au forfait
   * n'est admise que hors contrat type (signalement, sauf la déclaration en AP de moins de 500 lots).
   */
  diligence?: DiligenceSinistre
  /** Par défaut : le tarif du catalogue pour la diligence. */
  tarif?: string
  /** Par défaut : HEURES_A_L_OUVERTURE_SINISTRE (1 heure, J38), à corriger ensuite (corrigerHeures). */
  heures?: number
  /** 🟢 Par défaut : « Syndicat des copropriétaires ». */
  destinataire?: string
}

/** Hors contrat type, la rémunération est toujours soumise au juge (J67, R1 et R2). */
export type MotifSansElement = 'a_soumettre_au_juge'

export type ResultatOuvertureSinistre =
  | { genere: true; element: ElementAFacturer }
  | {
      genere: false
      motif: MotifSansElement
      signalement: string
      fiche: Rattachement
      diligence: DiligenceSinistre
      fondements: readonly string[]
    }

const AUCUN_ELEMENT = "aucun élément « A facturer » n'est créé"

const SANS_ELEMENT: Readonly<Record<CadreSansElement, { motif: MotifSansElement; signalement: string }>> = {
  tarif_administrateur_provisoire: {
    motif: 'a_soumettre_au_juge',
    signalement:
      `Administration provisoire (art. 29-1) : la gestion du sinistre est un acte hors tarif (${SOURCE_TARIF_AP}), à justifier ` +
      `auprès du juge (acompte annuel ou ordonnance de fin de mission, D. 1967 art. 61-1-5, II et III) ; ${AUCUN_ELEMENT}.`,
  },
  remuneration_fixee_par_le_juge: {
    motif: 'a_soumettre_au_juge',
    signalement: `${AP_PAR_LE_JUGE} (${SOURCE_REMUNERATION_PAR_LE_JUGE} ; D. 1967 art. 61-1-5, II et III) ; ${AUCUN_ELEMENT}.`,
  },
  remuneration_fixee_par_le_president: {
    motif: 'a_soumettre_au_juge',
    signalement: `${PAR_LE_PRESIDENT}. À soumettre au président ; ${AUCUN_ELEMENT}.`,
  },
  regime_inconnu: {
    motif: 'a_soumettre_au_juge',
    signalement: `${REGIME_INCONNU}. À soumettre au juge ; ${AUCUN_ELEMENT}.`,
  },
}

/**
 * Élément d'honoraires créé à l'ouverture d'un sinistre. Contrat type de syndic : élément « A facturer » du dossier
 * Sinistre, rattaché à la fiche, au coût horaire ; diligence au forfait (7.1.1) ou hors de l'annexe 2 refusée. Autre
 * cadre : pas d'élément, un signalement, selon les seules règles du cadre (verifierHorsContratType).
 */
export function elementAOuvertureSinistre(ouverture: OuvertureSinistre, cadre: CadreRemunerationSinistre): ResultatOuvertureSinistre {
  verifierCadre(cadre)
  const code = ouverture.diligence ?? 'suivi_assureur'
  if (cadre !== 'contrat_type_syndic') {
    verifierHorsContratType(code, ouverture.tarif, cadre)
    return {
      genere: false,
      ...SANS_ELEMENT[cadre],
      fiche: creerRattachement('Sinistre', ouverture.sinistreId),
      diligence: code,
      fondements: FONDEMENTS_HONORAIRES_SINISTRE[cadre],
    }
  }
  const diligence = diligenceHorsForfait(code)
  const tarif = tarifDeLaDiligence(diligence, ouverture.tarif)
  const saisie: SaisieElement = {
    id: ouverture.elementId,
    coproprieteId: ouverture.coproprieteId,
    mandatId: ouverture.mandatId,
    date: ouverture.dateOuverture,
    dossier: 'Sinistre',
    fiche: creerRattachement('Sinistre', ouverture.sinistreId),
    nature: 'Prestations',
    tarif,
    calcul: 'Coût horaire',
    quantite: ouverture.heures ?? HEURES_A_L_OUVERTURE_SINISTRE,
    prixUnitaireHtDixMilliemes: ouverture.coutHoraireHtDixMilliemes,
    soumisTva: ouverture.soumisTva,
    tauxTvaPct: ouverture.tauxTvaPct,
    destinataire: ouverture.destinataire ?? 'Syndicat des copropriétaires',
  }
  // Seul cadre qui crée l'élément : le contrat type de syndic (J67, R9 : la mission est passée à creerElement).
  const element = creerElement(saisie, 'contrat_type_syndic')
  return { genere: true, element }
}

const HORAIRE = /^([01]\d|2[0-3]):([0-5]\d)$/

function minutesDepuisHoraire(horaire: string): number {
  const morceaux = HORAIRE.exec(horaire)
  if (!morceaux) throw new Error(`Horaire invalide (${horaire}) : hh:mm de 00:00 à 23:59 attendu.`)
  return Number(morceaux[1]) * 60 + Number(morceaux[2])
}

/** Temps passé depuis les horaires début / fin de la fiche élément : minutes exactes, heures au centième (🔵 arrondi). */
export function dureeDepuisHoraires(debut: string, fin: string): { minutes: number; heures: number } {
  const minutes = minutesDepuisHoraire(fin) - minutesDepuisHoraire(debut)
  if (minutes <= 0) throw new Error(`L'horaire de fin (${fin}) doit être après celui de début (${debut}).`)
  return { minutes, heures: Math.round((minutes * 100) / 60) / 100 }
}

/**
 * Corrige le nombre d'heures d'un élément au coût horaire encore « A facturer » ; l'élément reçu n'est pas modifié, sa
 * qualification non plus (corrigerQuantite ; J67, R9).
 */
export function corrigerHeures(element: ElementAFacturer, heures: number): ElementAFacturer {
  if (element.statut !== 'A facturer') throw new Error(`Correction refusée : l'élément ${element.id} est déjà facturé.`)
  if (element.calcul !== 'Coût horaire') throw new Error(`Correction refusée : l'élément ${element.id} n'est pas au coût horaire (${element.calcul}).`)
  if (!Number.isFinite(heures) || heures <= 0) throw new Error(`Nombre d'heures invalide (${heures}) : strictement positif attendu.`)
  return corrigerQuantite(element, heures)
}

export type NatureAnomalieHonorairesSinistre =
  | 'sans_fiche'
  | 'diligence_au_forfait'
  | 'diligence_non_identifiee'
  | 'hors_tarif_ap'
  | 'remuneration_fixee_par_le_juge'
  | 'remuneration_fixee_par_le_president'
  | 'regime_inconnu'
  | 'frais_a_presenter_au_juge'

export interface AnomalieHonorairesSinistre {
  elementId: string
  nature: NatureAnomalieHonorairesSinistre
  message: string
}

/**
 * Diligence non due selon le cadre : contrat type, déclaration et règlement des indemnités (7.1.1), et tarif hors de la
 * liste limitative de l'annexe 2 ; AP de moins de 500 lots, la seule déclaration (arrêté art. 14, sans liste de
 * diligences) ; 500 lots et plus (arrêté art. 3), rémunération fixée par le président (R. 814-27) et régime inconnu :
 * aucune règle.
 */
function anomalieDeDiligence(element: ElementAFacturer, cadre: CadreRemunerationSinistre): AnomalieHonorairesSinistre | null {
  const lue = diligenceDuTarif(element.tarif)
  const base = { elementId: element.id }
  if (cadre === 'tarif_administrateur_provisoire') {
    if (lue !== 'declaration') return null
    return { ...base, nature: 'diligence_au_forfait', message: `Tarif « ${element.tarif} » : la déclaration du sinistre est exclue des actes hors tarif (${SOURCE_TARIF_AP}).` }
  }
  if (cadre !== 'contrat_type_syndic') return null
  if (estAuForfait(lue))
    return {
      ...base,
      nature: 'diligence_au_forfait',
      message: `Tarif « ${element.tarif} » : diligence comprise dans le forfait (${SOURCE_FORFAIT}), aucune rémunération supplémentaire.`,
    }
  if (lue === null)
    return { ...base, nature: 'diligence_non_identifiee', message: `Tarif « ${element.tarif} » : diligence de sinistre non identifiée (${SOURCE_HORS_FORFAIT}).` }
  return null
}

/**
 * Contrat type : la copie d'une diligence au forfait (tarif qui nomme la déclaration ou le règlement des indemnités) est
 * comprise dans le forfait (7.1.1, al. 2). Les autres copies, et tout autre cadre (le contrat a pris fin) : rien (J67,
 * R14 : sans objet pour le cabinet ; règle à coder si le contrat type sert un jour).
 */
function anomalieDeReprographie(element: ElementAFacturer, cadre: CadreRemunerationSinistre): AnomalieHonorairesSinistre | null {
  if (cadre !== 'contrat_type_syndic' || !estReprographie(element) || !estAuForfait(diligenceDuTarif(element.tarif))) return null
  return {
    elementId: element.id,
    nature: 'diligence_au_forfait',
    message:
      `Tarif « ${element.tarif} » : reprographie d'une diligence comprise dans le forfait, incluse dans la rémunération ` +
      `forfaitaire (${SOURCE_REPROGRAPHIE}), aucun remboursement.`,
  }
}

const ANOMALIE_DU_CADRE: Readonly<Record<CadreSansElement, { nature: NatureAnomalieHonorairesSinistre; message: string }>> = {
  tarif_administrateur_provisoire: {
    nature: 'hors_tarif_ap',
    message: `Administration provisoire (art. 29-1) : acte hors tarif (${SOURCE_TARIF_AP}), à justifier auprès du juge, pas à facturer au syndicat.`,
  },
  remuneration_fixee_par_le_juge: {
    nature: 'remuneration_fixee_par_le_juge',
    message: `${AP_PAR_LE_JUGE} (${SOURCE_REMUNERATION_PAR_LE_JUGE}) : à lui soumettre, pas à facturer au syndicat.`,
  },
  remuneration_fixee_par_le_president: {
    nature: 'remuneration_fixee_par_le_president',
    message: `${PAR_LE_PRESIDENT}. À soumettre au président, pas à facturer au syndicat.`,
  },
  regime_inconnu: {
    nature: 'regime_inconnu',
    message: `${REGIME_INCONNU}. À soumettre au juge, pas à facturer au syndicat.`,
  },
}

function anomalieDeCadre(element: ElementAFacturer, cadre: CadreRemunerationSinistre): AnomalieHonorairesSinistre | null {
  if (cadre === 'contrat_type_syndic') return null
  return { elementId: element.id, ...ANOMALIE_DU_CADRE[cadre] }
}

const anomalieSansFiche = (element: ElementAFacturer): AnomalieHonorairesSinistre | null =>
  element.fiche
    ? null
    : { elementId: element.id, nature: 'sans_fiche', message: 'Élément du dossier Sinistre sans fiche : rattacher le sinistre précis (point 47).' }

/**
 * J72 (b) : ce qui fonde la présentation des frais au juge, selon le cadre (hors contrat type). Sous l'art. 29-1, les
 * frais et débours que l'ordonnance arrête (J67, R5 : SOURCE_FRAIS_ET_DEBOURS), pas D. 1967 art. 61-1-5, II (émoluments
 * seuls) ni son III, al. 2 (droits proportionnels au-delà du seuil de l'arrêté) : relecture du 18/11/2026.
 */
const SOURCE_FRAIS_SELON_LE_CADRE: Readonly<Record<CadreSansElement, string>> = {
  tarif_administrateur_provisoire: `administration provisoire de l'art. 29-1 : ${SOURCE_FRAIS_ET_DEBOURS}`,
  remuneration_fixee_par_le_juge: `${SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE} lots et plus : le juge tient compte des frais engagés, ${SOURCE_REMUNERATION_PAR_LE_JUGE}`,
  remuneration_fixee_par_le_president: 'rémunération fixée par le président qui a désigné le cabinet : C. com. R. 814-27',
  regime_inconnu: `régime du mandat à vérifier sur son fondement ; C. com. R. 814-27 ; ${SOURCE_FRAIS_ET_DEBOURS}`,
}

/**
 * J72 (b) : hors contrat type, un frais d'envoi du dossier Sinistre est un frais du cabinet, à présenter au juge en annexe
 * « frais et débours », payé seulement en vertu de son ordonnance ; au contrat type, remboursé au syndic (7.1.5, 7.2.1).
 */
function anomalieDeFrais(element: ElementAFacturer, cadre: CadreRemunerationSinistre): AnomalieHonorairesSinistre | null {
  if (cadre === 'contrat_type_syndic') return null
  return {
    elementId: element.id,
    nature: 'frais_a_presenter_au_juge',
    message:
      `Tarif « ${element.tarif} » (${element.nature}) : frais du cabinet, à part de sa rémunération ; à présenter au juge en annexe ` +
      `« frais et débours », payés seulement en vertu de son ordonnance (${SOURCE_FRAIS_SELON_LE_CADRE[cadre]} ; J72, b) ; pas à facturer au syndicat.`,
  }
}

/**
 * Anomalies d'un élément. Offert ou contrôle des coûts (point 67) : la fiche seule, c'est la trace voulue. Rémunération :
 * fiche, diligence, puis cadre, sauf pour une diligence non due (elle n'est pas un acte hors tarif). Frais : la fiche,
 * puis, hors contrat type, la présentation au juge (J72, b), au contrat type la reprographie d'une diligence au forfait
 * (7.1.1, al. 2).
 */
function anomaliesDeLElement(element: ElementAFacturer, cadre: CadreRemunerationSinistre): (AnomalieHonorairesSinistre | null)[] {
  if (!estFacturable(element)) return [anomalieSansFiche(element)]
  if (!estRemuneration(element))
    return [anomalieSansFiche(element), cadre === 'contrat_type_syndic' ? anomalieDeReprographie(element, cadre) : anomalieDeFrais(element, cadre)]
  const diligence = anomalieDeDiligence(element, cadre)
  const duCadre = diligence?.nature === 'diligence_au_forfait' ? null : anomalieDeCadre(element, cadre)
  return [anomalieSansFiche(element), diligence, duCadre]
}

/**
 * Élément non dû dans le cadre, avec la règle du contrôle (signalé « diligence_au_forfait ») : au contrat type, une
 * diligence au forfait ou sa reprographie ; en AP de moins de 500 lots, la déclaration.
 */
const estNonDu = (element: ElementAFacturer, cadre: CadreRemunerationSinistre): boolean =>
  anomaliesDeLElement(element, cadre).some((anomalie) => anomalie?.nature === 'diligence_au_forfait')

/** Contrôle des éléments du dossier Sinistre : signale, ne refuse pas. Les autres dossiers sont ignorés. */
export function controlerHonorairesSinistre(elements: readonly ElementAFacturer[], cadre: CadreRemunerationSinistre): AnomalieHonorairesSinistre[] {
  verifierCadre(cadre)
  return elements
    .filter((e) => e.dossier === 'Sinistre')
    .flatMap((element) => anomaliesDeLElement(element, cadre).filter((a): a is AnomalieHonorairesSinistre => a !== null))
}

export interface SoldeHonorairesSinistre {
  /** Éléments de rémunération retenus dans la base de la déduction. */
  elementIds: string[]
  /**
   * Éléments non dus dans le cadre (signalés « diligence_au_forfait ») : rémunération d'une diligence au forfait ou, au
   * contrat type, sa reprographie (7.1.1, al. 2). Hors base, hors total, hors frais.
   */
  ecartesIds: string[]
  totalHtCentimes: number
  totalTtcCentimes: number
  versementsCentimes: number
  /** Déduction sur le TTC (J67, R8). */
  deductionCentimes: number
  /**
   * Équivalent HT de la déduction (J67, R8) : déduction ÷ (1 + taux), arrondie au centime, quand les éléments retenus ont
   * un seul taux de TVA (non soumis : 0 %) ; null s'ils en ont plusieurs. Point fiscal à confirmer par le comptable.
   */
  deductionHtEquivalentCentimes: number | null
  resteAChargeTtcCentimes: number
  /** Versements de l'assureur au-delà des honoraires : signalés, jamais un reste négatif. */
  excedentCentimes: number
  /** Frais de la fiche (envoi, copie…) qui ne sont pas écartés : hors honoraires, hors déduction. */
  fraisTtcCentimes: number
}

const sommeTtc = (elements: readonly ElementAFacturer[]): number => elements.reduce((s, e) => s + totalElement(e).ttcCentimes, 0)

const visent = (element: ElementAFacturer, fiche: Rattachement): boolean => element.fiche?.type === fiche.type && element.fiche.id === fiche.id

/** Équivalent HT d'un montant TTC au taux unique des éléments (centièmes de point, non soumis : 0) ; null si plusieurs taux. */
function equivalentHt(ttcCentimes: number, elements: readonly ElementAFacturer[]): number | null {
  const taux = new Set(elements.map((e) => (e.soumisTva ? Math.round(e.tauxTvaPct * CENTIEMES_PAR_POINT) : 0)))
  if (taux.size > 1) return null
  const [tauxCentiemes = 0] = taux
  return Math.round((ttcCentimes * CENT_POUR_CENT) / (CENT_POUR_CENT + tauxCentiemes))
}

/**
 * Honoraires d'un sinistre, déduction faite des sommes versées par l'assureur au titre des diligences. 🟢 La déduction
 * porte sur la rémunération due (7.2.4, dernier alinéa ; arrêté art. 14, hors déclaration) : les éléments non dus dans
 * le cadre en sont écartés, avec la règle du contrôle ; au contrat type, la reprographie d'une diligence au forfait est
 * écartée des frais (7.1.1, al. 2). 🔵 Éléments de rémunération de la fiche, facturés ou non ; une diligence non
 * identifiée reste dans la base (à vérifier, pas déclarée non due) ; les autres frais restent à part ; déduction
 * sur le TTC, plafonnée au total, avec son équivalent HT (J67, R8). Les indemnités versées au SYNDICAT (sinistres.ts)
 * ne sont pas ces sommes : aucune déduction pour elles (J67, R8).
 * 🔵 Point 67 : seuls les éléments facturables comptent ; un élément offert ou en contrôle des coûts est hors base, hors
 * frais et hors écartés (il n'est pas dû).
 */
export function soldeHonorairesSinistre(
  elements: readonly ElementAFacturer[],
  sinistreId: string,
  versementsAssureurCentimes: readonly number[],
  cadre: CadreRemunerationSinistre,
): SoldeHonorairesSinistre {
  verifierCadre(cadre)
  const fiche = creerRattachement('Sinistre', sinistreId)
  for (const versement of versementsAssureurCentimes)
    if (!Number.isInteger(versement) || versement <= 0)
      throw new Error(`Versement de l'assureur invalide (${versement}) : centimes entiers strictement positifs attendus.`)
  const facturables = elements.filter((e) => visent(e, fiche) && estFacturable(e))
  const ecartes = facturables.filter((e) => estNonDu(e, cadre))
  const dus = facturables.filter((e) => !ecartes.includes(e))
  const retenus = dus.filter(estRemuneration)
  const totaux = retenus.map(totalElement)
  const totalHtCentimes = totaux.reduce((s, t) => s + t.htCentimes, 0)
  const totalTtcCentimes = totaux.reduce((s, t) => s + t.ttcCentimes, 0)
  const versementsCentimes = versementsAssureurCentimes.reduce((s, v) => s + v, 0)
  const deductionCentimes = Math.min(versementsCentimes, totalTtcCentimes)
  return {
    elementIds: retenus.map((e) => e.id),
    ecartesIds: ecartes.map((e) => e.id),
    totalHtCentimes,
    totalTtcCentimes,
    versementsCentimes,
    deductionCentimes,
    deductionHtEquivalentCentimes: equivalentHt(deductionCentimes, retenus),
    resteAChargeTtcCentimes: totalTtcCentimes - deductionCentimes,
    excedentCentimes: versementsCentimes - deductionCentimes,
    fraisTtcCentimes: sommeTtc(dus.filter((e) => !estRemuneration(e))),
  }
}

export type FicheElementHonoraires = FicheLiee & { element: ElementAFacturer }

/** Un élément comme fiche liée : sa fiche de dossier, puis la copropriété et le mandat (comme un courrier). */
export function elementCommeFicheLiee(element: ElementAFacturer): FicheElementHonoraires {
  const porteurs = rattachementsDuCourrier({ coproprieteId: element.coproprieteId, mandatId: element.mandatId, personneId: null, entrepriseId: null })
  return {
    id: element.id,
    date: element.date,
    statut: element.statut,
    rattachements: element.fiche ? [element.fiche, ...porteurs] : porteurs,
    element,
  }
}

/** Liste « Honoraires (€) » de la fiche sinistre et nœud « Honoraires lignes » du Flux : éléments rattachés, paginés. */
export function honorairesDuSinistre(
  elements: readonly ElementAFacturer[],
  sinistreId: string,
  options: OptionsFichesLiees = {},
): PageFichesLiees<FicheElementHonoraires> {
  return fichesLiees(elements.map(elementCommeFicheLiee), creerRattachement('Sinistre', sinistreId), options)
}
