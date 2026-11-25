import { genererId } from '@/lib/administrateur-judiciaire/db/ids'
import { journaliserActivite, type OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import {
  ajDb,
  type CleRepartitionEnregistree,
  type CompteCoproprietaireEnregistre,
  type Copropriete,
  type EcheanceAppelEnregistree,
  type EncaissementCoproprietaireEnregistre,
  type PieceTraitementEnregistree,
  type PositionEnregistree,
} from '@/lib/administrateur-judiciaire/db/schema'
import { enregistrerPieceTraitement, marquerPieceEncaissementsAnnulee } from '@/lib/administrateur-judiciaire/db/traitements'
import { dateIsoVersFr, estAnneeImprobable, messagePlausibilite, plausibiliteDate, verifierAujourdhui } from '@/lib/administrateur-judiciaire/domain/dates'
import { bornesDesExercices, exerciceDe } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import {
  annulerEncaissement,
  annulerPieceEncaissements,
  enregistrerEncaissement,
  FAMILLES_ENCAISSEMENT,
  MOTIFS_ERREUR_DE_SAISIE,
  traitementEncaissements,
  type EncaissementAContrePasser,
  type EncaissementEnregistre,
  type FamilleEncaissement,
  type JournalEncaissement,
  type MotifErreurDeSaisie,
  type ReclassementEcrit,
  type SaisiePieceEncaissement,
} from '@/lib/administrateur-judiciaire/domain/encaissements-pieces'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { numeroCompteCoproprietaire } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import type { CleRapprochement } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import {
  imputerEncaissements,
  type Encaissement,
  type PosteDette,
  type ResultatImputation,
} from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { CYCLES_PIECE, segmentComptableSyndicat, STATUT_PIECE_ANNULEE } from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import {
  imputationDOrigine,
  lignesEcrites,
  postesDeLImputation,
  postesDesComptes,
  soldesDesComptes,
  type DonneesPostes,
  type EcartCompte,
  type ImputationEcrite,
  type ReimputationEcrite,
  type SoldeCompte,
} from '@/lib/administrateur-judiciaire/domain/postes-comptes'
import {
  mentionReimputation,
  mouvementsReclassement,
  ordreDesEncaissements,
  postesSansSuffixe,
  rejouerSuffixe,
  traitementReclassement,
  verifierRejeuABlanc,
  type EncaissementARejouer,
  type Rejeu,
} from '@/lib/administrateur-judiciaire/domain/reimputation-encaissements'
import type { LigneMouvement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { DATE_DU_JOUR_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Imputation des encaissements aux comptes copropriétaires D2 : lecture des postes d'un compte, écriture d'un encaissement
 * imputé, réimputation dans l'ordre des dates d'un encaissement saisi en retard, annulation (rejet de la banque, erreur de
 * saisie). Couche données seulement, sans écran ni hook (réponses du référent métier du 22/11/2026 sur l'écran « Appels de
 * fonds », points ap-h02 et ap-02 : première PR de suite, avant toute diffusion d'avis). L'écran d'où viendront les
 * encaissements (Trésorerie, import du relevé) se branchera ensuite ; l'ancien circuit
 * (donnees-store.imputerEncaissement : ancienne fiche copropriétaire et table `impayes`) reste en place jusque-là.
 *
 * CONCEPTION
 * 1. D'où viennent les postes d'un compte : ils ne sont PAS dans une table. Le dû se relit de l'échéancier appelé
 *    (échéances « Appelé » par une pièce « Appel de fonds », réparties de nouveau sur leur clé, au compte redevable à
 *    l'exigibilité), recoupé appel par appel et compte par compte avec les débits 450 de la pièce d'appel ; le réglé est
 *    la somme des lignes d'imputation des encaissements non annulés (domain/postes-comptes.ts). Pourquoi pas une table des
 *    postes : le dû est déjà dans la pièce d'appel et le réglé dans les encaissements ; une table les recopierait, et un
 *    réglé tenu à jour à chaque encaissement et à chaque annulation pourrait s'écarter de ce qui est écrit. Le prix : une
 *    clé ou des positions modifiées après un appel rendent la répartition relue différente de l'écriture ; le recoupement
 *    le voit et met les SEULS comptes touchés en écart (EtatDesComptes.ecarts : série, appel, échéances, lots) : leurs
 *    postes ne sont pas rendus et leurs encaissements sont refusés ; les autres comptes du syndicat continuent.
 * 2. Ce qui est enregistré, dans UNE transaction (une erreur n'écrit rien) : la pièce du journal des traitements
 *    (enregistrerPieceTraitement : numéro de la séquence du cabinet, syndicat et mandat, D1) et, pour chaque encaissement,
 *    une ligne de la table `encaissements` (version 4) : l'encaissement du domaine (pièce, journal de banque, statut,
 *    traitement : encaissements-pieces.EncaissementEnregistre), son syndicat, son rang dans le lot et son imputation
 *    (lignes par poste, reliquat, signalements). La pièce de traitement ne peut pas porter ces données : elle ne dit ni le
 *    lot d'un poste (deux lots d'un même compte sur une même échéance), ni la pièce de banque, ni le statut « Rapproché »,
 *    ni l'annulation.
 * 3. Comment un encaissement est enregistré puis imputé (ecrireEncaissements) : contrôles (syndicat, compte du syndicat
 *    sans écart, compte bancaire du syndicat, solde repris, date), enregistrerEncaissement (pièce et journal), imputation
 *    sur les postes relus dans la transaction (imputation-encaissements.imputerEncaissements : désignation du débiteur,
 *    puis dettes échues de la plus ancienne à la plus récente, au prorata à ancienneté égale, C. civ. art. 1342-10 ;
 *    reliquat « à imputer » ; fonds de travaux non échu jamais servi d'office), chaque encaissement d'un même lot partant
 *    des soldes laissés par le précédent, puis écriture R7 et R8 (traitementEncaissements : débit du 512, crédit du 450,
 *    l'appel d'origine sur chaque crédit). Deux écritures successives s'enchaînent de la même façon : la seconde relit le
 *    réglé.
 * 4. Quel compte 450 est crédité : pour chaque poste, celui que SON appel a débité (PosteDette.planCompte, relu de la
 *    pièce d'appel) : le 45000, ou le 450-1 du budget si l'appel a été écrit avec les sous-comptes (J67, R104). Aucun
 *    réglage n'est passé ici : un 450-1 créé en cours d'année laisse les appels antérieurs au 45000, et un même
 *    encaissement peut créditer les deux sans compensation (arrêté du 14/03/2005, art. 9). Le reliquat va au 45000.
 * 5. Comment il est annulé : DEUX circuits, et eux seuls (l'annulation générique des pièces, db/traitements.ts, refuse les
 *    familles d'encaissement ; une pièce d'origine déjà « Annulé » interdit toute seconde écriture contraire).
 *    a. Rejet de la banque (annulerEncaissementEcrit, F110) : écriture contraire des seules lignes de l'encaissement,
 *       prises dans la pièce d'origine (encaissements-pieces.annulerEncaissement), d'après les lignes gardées sur
 *       l'encaissement (poste, montant, appel d'origine, compte crédité), SANS relire les postes : un chèque impayé
 *       s'annule même si le compte est en écart (la banque l'a déjà rejeté ; le compte reste en écart). Elle est
 *       enregistrée comme une pièce « Annulation d'encaissement », datée du débit de la banque ; l'encaissement passe
 *       « Annulé » et garde son imputation pour mémoire ; ses lignes ne comptent plus dans le réglé : les postes
 *       redeviennent dus à leur exigibilité d'origine. La pièce d'origine ne change pas (elle peut porter d'autres
 *       encaissements). Pour un encaissement réimputé : deux écritures, point 6.
 *    b. Erreur de saisie (annulerPieceEncaissementsPourErreur) : point 7.
 * 6. Réimputation dans l'ordre des dates (ecrireEncaissements avec `reimputerDansLOrdreDesDates` ; fonctions pures et
 *    détail du rejeu : domain/reimputation-encaissements.ts).
 *    - Ce qui est stocké. `imputation` porte TOUJOURS l'imputation COURANTE de l'encaissement : les lecteurs (réglé,
 *      soldes, postes d'une annulation) ne changent pas de sens. Chaque réimputation s'AJOUTE à `reimputations` : pièce de
 *      reclassement, date, cause (le ou les paiements en retard et leur pièce), imputation d'avant copiée, lignes de cet
 *      encaissement dans la pièce de reclassement, mention. Le paiement en retard garde `reclassementIds`. Propriétés non
 *      indexées : aucune version de la base. Le journal d'activité garde un « update » (avant, après) par encaissement
 *      réimputé. Aucune pièce comptable n'est jamais réécrite (arrêté du 14/03/2005, art. 5) : l'imputation gardée sur
 *      l'encaissement est une information d'affectation (lettrage), mise à jour avec son historique complet, ajouté,
 *      jamais effacé. `imputationDOrigine` ne sert qu'à retrouver les lignes dans la pièce d'origine.
 *    - Ordre des encaissements d'un compte : date, numéro de la pièce d'origine, rang dans le lot, identifiant ; jamais
 *      l'horodatage (deux lots du même jour peuvent s'écrire dans la même milliseconde).
 *    - Déclenchement : sur demande de l'appelant, jamais d'office. Sans la demande, le refus d'origine (verifierOrdreDesDates).
 *      Demandée sans encaissement postérieur : circuit ordinaire. Aucune fonction « réimputer un compte » : elle
 *      rouvrirait la réimputation du reliquat (F105), non décidée.
 *    - Périmètre : par compte crédité par le lot. Sont rejoués les encaissements NON annulés du compte, de date
 *      STRICTEMENT postérieure à celle du lot (le même jour, ils restent avant : l'ordre de saisie fait foi). Plusieurs
 *      paiements en retard d'un même compte dans le lot : imputés dans l'ordre reçu, puis les postérieurs rejoués une fois.
 *    - Garde du rejeu à blanc, vrai rejeu, garde de la désignation du débiteur : voir le domaine. Tout refus n'écrit rien.
 *    - Pièce de reclassement : une par compte réimputé, aucune si rien ne change ; famille « Correction de mouvements »,
 *      statut « Enregistré », sans renvoi d'annulation ; débit du 450 avec l'origine perdue, crédit avec l'origine gagnée,
 *      le compte copropriétaire en lien, AUCUNE ligne 512. Datée du jour du traitement (`aujourdhui`), jamais du jour du
 *      paiement en retard : une erreur se corrige par une écriture datée dans la période ouverte (décision du 17/11/2026 :
 *      J67, R121 à R123, domain/verrou-saisie.ts). Refus si ce jour est hors des exercices du syndicat ouverts dans VitFix
 *      (même règle que la question 6 bis), ou antérieur à l'une des pièces qu'elle corrige (pièce d'origine de chaque
 *      encaissement rejoué, ses pièces de reclassement antérieures).
 *    - Pièce justificative (arrêté, art. 4 ; décret n° 2005-240, art. 6) : la « mention », gardée sur chaque encaissement
 *      réimputé. Le journal des traitements n'a AUCUN champ de libellé : l'art. 4 n'est satisfait que par cette mention ;
 *      le libellé d'écriture reste à brancher (état préexistant, le même que pour F110).
 *    - Le paiement en retard : pièce « Encaissement » ordinaire, à sa date, débit du 512 et crédit du 450 sur son
 *      imputation chronologique. La numérotation suit l'ordre de SAISIE (arrêté, art. 2 : journal chronologique) : un
 *      paiement en retard porte un numéro postérieur à celui de pièces datées après lui.
 *    - Pièce de reclassement absente ou « Annulé » : le compte passe en écart (postes-comptes.ts).
 *    - Rejet de la banque d'un encaissement réimputé : DEUX pièces. (a) « Annulation d'encaissement », datée du débit de
 *      la banque, qui contre-passe exactement ses lignes d'ORIGINE (512 et crédits d'origine) ; (b) « Correction de
 *      mouvements », datée du jour de la saisie de l'annulation, qui contre-passe le net de ses lignes de reclassement,
 *      retrouvées dans leurs pièces. Refus si (b) précéderait la dernière pièce de reclassement, si son jour est hors des
 *      exercices ouverts, si une pièce de reclassement est absente ou annulée, ou si lignes d'origine et nets des
 *      reclassements ne redonnent pas l'imputation courante. Le net par appel d'origine est juste ; entre le reclassement
 *      et la correction (b), le grand livre garde un décalage par appel d'origine : c'est la réalité de la saisie.
 * 7. Annulation d'une pièce pour erreur de saisie (annulerPieceEncaissementsPourErreur), à part du rejet de la banque :
 *    pour les vraies erreurs seulement (montant, compte, doublon), JAMAIS pour remettre dans l'ordre un encaissement saisi
 *    dans le désordre des dates (c'est le point 6). Écriture contraire de TOUTE la pièce, 512 compris, « Annulation
 *    d'encaissement », datée du jour de la correction, jamais avant la pièce, dans un exercice ouvert ; la pièce d'origine
 *    passe « Annulé » (db/traitements.marquerPieceEncaissementsAnnulee) ; chaque encaissement passe « Annulé », `nature:
 *    'erreur-saisie'` : il n'a jamais été reçu, le rapprochement ne le pointe jamais. Les encaissements réimputés de la
 *    pièce : une « Correction de mouvements » du même jour contre-passe leurs reclassements (comme au point 6). Refusée
 *    tant qu'un encaissement non annulé postérieur existe sur un compte de la pièce. La ressaisie passe par
 *    ecrireEncaissements, sous de nouveaux identifiants ; si sa date précède le dernier encaissement du compte : point 6.
 *
 * DÉCIDÉ
 * - Décision du 24/11/2026 (question 6 de la page de validation, options 3 et 4, recommandation acceptée par le
 *   responsable du projet puis par le référent métier) : « refuser pour l'instant (codé) ; plus tard, la réimputation
 *   dans l'ordre des dates pour ce cas [par un reclassement interne au compte 450, sans toucher à la banque], et une
 *   annulation pour erreur de saisie, à part, pour les vraies erreurs (montant, compte, doublon) [écriture contraire de
 *   toute la pièce, puis ressaisie] ». Points 6 et 7.
 * - Décision du 24/11/2026 (question 6 bis) : un encaissement daté hors des exercices du syndicat ouverts dans VitFix est
 *   REFUSÉ (verifierDateDansUnExercice), comme la date comptable d'un appel (J67, R96). La même règle vaut ici pour le
 *   jour d'une pièce de reclassement ou de correction.
 * - Décision du 17/11/2026 (J67, R121 à R123) : une erreur trouvée après coup se corrige par une écriture contraire datée
 *   dans la période ouverte ; la contre-passation est contrôlée sur SA date.
 *
 * SOURCES (vérifiées le 25/11/2026)
 * - C. civ. art. 1342-10 : imputation des paiements ; l'indication du débiteur prime.
 * - Arrêté du 14/03/2005 : art. 1 (partie double), art. 2 (journal chronologique, numéroté et daté), art. 4 (libellé qui
 *   identifie la pièce justificative), art. 5 (documents sans altération ; écriture erronée annulée par une écriture
 *   contraire), art. 9 (aucune compensation ; versements affectés, à défaut d'indication contraire, à la dette la plus
 *   ancienne, conformément à l'art. 1342-10), art. 10 (compte 450 et sous-comptes).
 * - Décret n° 2005-240 : art. 5 (exercice, comptes arrêtés à la clôture), art. 6 (pièces justificatives), art. 7
 *   (ventilation des sommes exigibles par rubrique).
 * - Décret du 17/03/1967, art. 45-1 : l'approbation des comptes du syndicat ne vaut pas approbation du compte individuel
 *   de chaque copropriétaire.
 * - PCG, art. 122-6 et 1031-4 (numérotation 2026), « par analogie » seulement : le PCG ne s'applique pas directement au
 *   syndicat.
 * 🔵 Déduit, à ne pas présenter comme sûr : le moment où s'apprécie le caractère échu des dettes (le jour du paiement) ;
 * toute jurisprudence sur ces points n'a été lue que dans des sources secondaires.
 *
 * NOTES
 * - Les débits 450 des pièces « Correction de mouvements » et « Annulation d'encaissement » ne sont jamais de
 *   l'« appelé » : les annexes à venir ne doivent pas les compter comme tels.
 * - Part du fonds de travaux à virer (F112) : elle se lit sur l'imputation courante ; une réimputation peut la déplacer
 *   d'un encaissement à un autre. F112 n'est pas branché en base.
 * - Intérêts avant le capital (C. civ. art. 1343-1) : hors périmètre, non gérés (avec le contentieux).
 *
 * Hors de ce fichier, à brancher plus tard : écran et hooks ; remise de chèques (rattacherRemise) ; statut « Rapproché »
 * (rapprocherEncaissements, avec les arrêtés de rapprochement) ; part du fonds de travaux à virer (F112) ; recettes hors
 * copropriétaires ; verrou de saisie du syndicat (aucun n'est encore enregistré) ; réimputation du reliquat (F105) ;
 * contentieux porté par le compte D2 (ap-06) ; libellé d'écriture au journal des traitements (arrêté, art. 4) ;
 * ouverture d'un exercice hors de l'écriture d'un appel : « Ouvrir l'exercice » (écran « Appels de fonds ») n'est proposé
 * que pour une échéance exigible hors des exercices, et la décision du 24/11/2026 (question 6 bis) suppose que « tout
 * exercice concerné » soit ouvert dans VitFix : à prévoir avec l'écran des encaissements (modification d'écran, à l'accord
 * du référent métier).
 *
 * À VALIDER (référent métier ; solutions prudentes codées ici) — réimputation et annulation pour erreur de saisie :
 *  1. Déclenchement de la réimputation : sur demande de l'appelant (codé) ou d'office. Recommandation : sur demande, tant
 *     qu'aucun écran ne montre l'avant et l'après.
 *  2. Reclassement sur un même compte 450 : écriture débit 450 / crédit 450 par appel d'origine (codé : le modèle porte
 *     l'appel d'origine sur chaque crédit, et le rejet de la banque contre-passe par origine) ou simple pièce sans
 *     mouvement au grand livre. Aucun texte ne règle le lettrage (🔴 non établi) ; l'écriture gonfle les mouvements sans
 *     changer le solde. Recommandation : garder l'écriture.
 *  3. Famille de la pièce de reclassement : « Correction de mouvements » (codé, déjà au référentiel ; 🔵 usage dans
 *     Gestéam non observé), « Saisie de mouvements », ou une famille nouvelle. Recommandation : « Correction de
 *     mouvements ».
 *  4. Garde du rejeu à blanc : refuser quand le rejeu ne redonne pas l'imputation écrite (codé) ; ou rejouer sur les
 *     postes d'aujourd'hui, ce qui réimpute aussi les reliquats (F105) ; variante : ne rejouer chaque encaissement que sur
 *     les postes dont la pièce d'appel porte un numéro inférieur au sien (fidèle à ce qui a été fait, sans faux refus
 *     après un appel écrit après coup). Aujourd'hui, le vrai rejeu peut imputer l'argent libéré par le paiement en retard
 *     sur un poste appelé après un encaissement rejoué mais exigible avant sa date (ordre légal). Recommandation :
 *     garder le refus jusqu'à la décision F105.
 *  5. Désignation du débiteur devenue sans objet (poste désigné soldé ou entamé par le paiement en retard) : refus
 *     (codé) ; reliquat « à imputer » ; ou imputation légale sur les autres dettes échues. 🔴 Non établi par les textes.
 *     Recommandation du rapport de droit : reliquat « à imputer ».
 *  6. Date des pièces de correction (reclassement, correction d'un reclassement, annulation pour erreur) : le jour du
 *     traitement (codé ; conforme à J67, R121 à R123) ou la date de l'écriture d'origine quand sa période est ouverte. Ce
 *     qui reste ouvert : seulement l'acte qui pose la borne de la période close et l'exercice approuvé, non détectables
 *     aujourd'hui. Recommandation : le jour du traitement.
 *  7. Encaissement réimputé, ou pièce annulée, appartenant à un exercice arrêté ou approuvé (décret du 17/03/1967,
 *     art. 45-1) : non détectable aujourd'hui (🔴 aucun statut « clos » enregistré) ; la correction est écrite dans
 *     l'exercice ouvert (codé), ou refusée. Recommandation : écrire dans l'exercice ouvert, avec la mention des dates.
 *  8. Annulation pour erreur de saisie quand des encaissements postérieurs existent sur un compte de la pièce : refus
 *     (codé : l'annulation n'est donc possible que tant qu'aucun encaissement postérieur n'existe sur ces comptes) ;
 *     réimputation d'office de ces encaissements, avec le cœur du point 6 et une cause « annulation pour erreur » ; ou les
 *     laisser tels quels. Recommandation : la réimputation d'office.
 *  9. Rejet de la banque (F110) d'un encaissement suivi d'autres : les suivants ne sont pas réimputés (codé, comme
 *     avant) ; la garde du rejeu à blanc refuse ensuite toute réimputation de ce compte. Ou les réimputer d'office.
 *     Recommandation : les réimputer, même raisonnement qu'au n° 8.
 * 10. Rejet de la banque du paiement en retard qui a CAUSÉ une réimputation : les encaissements réimputés gardent leur
 *     réimputation, le résultat les signale (`reimputationsCausees`) (codé : la décision F110 du 20/11/2026 couvre la
 *     désimputation du chèque, pas l'annulation de la réimputation qu'il a causée) ; ou défaire la réimputation causée
 *     (contre-passation du reclassement, imputation précédente rétablie). Recommandation : la défaire.
 * 11. Part du fonds de travaux à virer (F112) déplacée par une réimputation entre encaissements reçus sur des comptes
 *     bancaires différents, alors qu'un virement au compte du fonds a pu être fait : rien n'est codé. À trancher avec le
 *     branchement de F112.
 * 12. Famille de l'annulation pour erreur de saisie : « Annulation d'encaissement » avec la nature « erreur de saisie »
 *     (codé ; 🔵 seule paire d'annulation du référentiel), « Correction de mouvements », ou une famille propre (le
 *     journal la distinguerait d'un rejet de la banque). Recommandation : une famille propre, à l'accord du référent
 *     métier sur le référentiel.
 * 13. Pièce dont un encaissement a déjà été rejeté par la banque : annulation pour erreur refusée (codé) ou
 *     contre-passation des seuls encaissements restants. Et : annuler pour erreur un seul encaissement d'un lot, au lieu
 *     de toute la pièce ? Recommandation : garder le refus et la pièce entière (texte de l'option 4).
 * 14. Encaissement pointé au rapprochement : annulation pour erreur refusée (codé) ou admise avec un avertissement.
 *     Recommandation : le refus (un mouvement pointé existe en banque).
 * 15. Erreur de compte avec un montant bancaire exact : contre-passation totale puis ressaisie (codé, option 4) ou
 *     virement de 450 à 450 sans toucher au 512. Recommandation : la contre-passation totale.
 * 16. Autres motifs (erreur de date, de mode de règlement) : refusés (codé : la décision nomme montant, compte, doublon).
 * 17. Tiers (état daté délivré, mutation, recouvrement ouvert sur le compte) : aucun garde-fou codé ; aucun texte
 *     n'interdit la réimputation (🔴 non établi). Recommandation : un avertissement tracé, avec l'écran.
 * 18. Réimputation qui ne déplace que des centimes entre deux lots d'un même appel, sans rien changer par appel d'origine
 *     pour tout le compte : il n'y a alors aucune ligne à écrire, donc aucune pièce de reclassement à laquelle rattacher
 *     la réimputation : REFUS (codé, écart à la spécification, qui ne prévoit pas ce cas) ; ou mise à jour de
 *     l'imputation gardée sans pièce. Recommandation : la mise à jour sans pièce, tracée au journal d'activité.
 *
 * À VALIDER (référent métier ; solutions prudentes codées ici) — points antérieurs :
 * - compte repris d'une ancienne fiche avec un solde dû : l'encaissement est REFUSÉ tant que ce solde n'a aucune écriture
 *   (verifierSoldeRepris) ;
 * - une date d'une année improbable ou postérieure au jour de la saisie est refusée, pour l'encaissement comme pour le
 *   débit de la banque qui l'annule (verifierDate) ;
 * - débit de la banque (annulation) daté hors des exercices du syndicat : non contrôlé (la décision du 24/11/2026 ne vise
 *   que la date de l'encaissement) ;
 * - numéro du compte 512 de chaque compte bancaire : donné par l'appelant (journal.compteEncaissement), aucun n'est
 *   attribué ici ;
 * - la pièce « Encaissement » reste « Enregistré » : son passage à « Imputé » n'est pas écrit.
 */

// ─── Lecture ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Solde de l'ancienne fiche relevé à la migration, sans écriture : rendu à part, jamais ajouté aux soldes des postes. */
export interface SoldeRepris {
  compteId: string
  /** Positif : dû. */
  soldeDuCentimes: number
  releveLe: string
}

export interface EtatDesComptes {
  /** Postes imputables des comptes sans écart, réglé à jour, dans l'ordre des séries puis des exigibilités. */
  postes: PosteDette[]
  /** Encaissements du syndicat, annulés compris, par date, numéro de la pièce d'origine, puis rang dans le lot. */
  encaissements: EncaissementCoproprietaireEnregistre[]
  /** Soldes des comptes sans écart. */
  soldes: SoldeCompte[]
  /** Comptes repris d'une ancienne fiche, dans l'ordre des séries (à valider : voir l'en-tête). */
  soldesRepris: SoldeRepris[]
  /** Comptes dont les postes ne se recoupent plus avec ce qui est écrit : ni postes, ni solde, ni encaissement. */
  ecarts: EcartCompte[]
}

interface DonneesSyndicat extends DonneesPostes {
  copropriete: Copropriete
  positions: PositionEnregistree[]
  comptes: CompteCoproprietaireEnregistre[]
  cles: CleRepartitionEnregistree[]
  echeances: EcheanceAppelEnregistree[]
  pieces: PieceTraitementEnregistree[]
  encaissements: EncaissementCoproprietaireEnregistre[]
}

const tablesLues = () => [
  ajDb.coproprietes,
  ajDb.lots,
  ajDb.positions,
  ajDb.comptesCoproprietaires,
  ajDb.clesRepartition,
  ajDb.echeancesAppel,
  ajDb.traitements,
  ajDb.encaissements,
]
const tablesEcrites = () => [...tablesLues(), ajDb.banques, ajDb.mandats, ajDb.exercices, ajDb.activityLog]

/** Tables D2 du syndicat, ses pièces et ses encaissements. À appeler dans une transaction. */
async function lireDonnees(coproprieteId: string): Promise<DonneesSyndicat> {
  const copropriete = await ajDb.coproprietes.get(coproprieteId)
  if (!copropriete) throw new Error(`Copropriété introuvable (id=${coproprieteId}).`)
  const lotIds = (await ajDb.lots.where('coproprieteId').equals(coproprieteId).toArray()).map((l) => l.id)
  const [positions, comptes, cles, echeances, pieces, encaissements] = await Promise.all([
    lotIds.length > 0 ? ajDb.positions.where('lotId').anyOf(lotIds).toArray() : Promise.resolve([]),
    ajDb.comptesCoproprietaires.where('coproprieteId').equals(coproprieteId).toArray(),
    ajDb.clesRepartition.where('coproprieteId').equals(coproprieteId).toArray(),
    ajDb.echeancesAppel.where('coproprieteId').equals(coproprieteId).toArray(),
    ajDb.traitements.where('coproprieteId').equals(coproprieteId).toArray(),
    ajDb.encaissements.where('coproprieteId').equals(coproprieteId).toArray(),
  ])
  return { copropriete, positions, comptes, cles, echeances, pieces, encaissements }
}

/**
 * Ordre des encaissements du syndicat : date, numéro de la pièce d'origine (séquence unique du cabinet), rang dans le lot,
 * identifiant (reimputation-encaissements.ordreDesEncaissements). Jamais l'horodatage : deux lots du même jour peuvent
 * s'écrire dans la même milliseconde.
 */
const ordreDe = ({ pieces }: Pick<DonneesSyndicat, 'pieces'>) => ordreDesEncaissements(new Map(pieces.map((p) => [p.id, p.numero])))

function etatDe(donnees: DonneesSyndicat, { horsAppels = [] }: { horsAppels?: readonly string[] } = {}): EtatDesComptes {
  const { postes, ecarts } = postesDesComptes(donnees)
  return {
    postes,
    encaissements: [...donnees.encaissements].sort(ordreDe(donnees)),
    soldes: soldesDesComptes(postes, donnees, { horsAppels, comptesEnEcart: new Set(ecarts.map((e) => e.compteId)) }),
    soldesRepris: [...donnees.comptes]
      .sort((a, b) => a.serie.localeCompare(b.serie))
      .flatMap((c) => (c.reprise ? [{ compteId: c.id, soldeDuCentimes: c.reprise.soldeDuCentimes, releveLe: c.reprise.releveLe }] : [])),
    ecarts,
  }
}

/** Refuse un compte en écart : ses postes ne se recoupent plus avec ce qui est écrit (le message dit quoi). */
function verifierSansEcart(compteId: string, ecarts: readonly EcartCompte[]): void {
  const ecart = ecarts.find((e) => e.compteId === compteId)
  if (ecart) throw new Error(ecart.message)
}

/** État des comptes copropriétaires du syndicat : postes imputables, encaissements, soldes, comptes en écart. */
export function lireEtatDesComptes(coproprieteId: string): Promise<EtatDesComptes> {
  return ajDb.transaction('r', tablesLues(), async () => etatDe(await lireDonnees(coproprieteId)))
}

/**
 * Soldes antérieurs des comptes pour un avis d'appel (repartition-appels.avisDAppel, `soldesAnterieurs` : centimes par
 * compte, négatif pour un crédit) : le solde de chaque compte sur ses postes appelés, sans les échéances de l'avis
 * (`horsAppels`, quand elles sont déjà appelées). Un compte en écart n'a PAS de solde : `ecarts` les nomme, l'avis ne doit
 * pas leur afficher 0. Lecture seule ; l'avis ne la lit pas encore (branchement de l'écran « Appels de fonds » : PR de
 * suite, avant toute diffusion d'avis — point ap-02).
 * À valider (référent métier) : voir postes-comptes.soldesDesComptes (postes non échus comptés, solde repris non compté).
 */
export function lireSoldesAnterieurs(
  coproprieteId: string,
  options: { horsAppels?: readonly string[] } = {},
): Promise<{ soldes: Record<string, number>; ecarts: EcartCompte[] }> {
  return ajDb.transaction('r', tablesLues(), async () => {
    const { soldes, ecarts } = etatDe(await lireDonnees(coproprieteId), options)
    return { soldes: Object.fromEntries(soldes.map((s) => [s.compteId, s.soldeCentimes])), ecarts }
  })
}

/** D1 : le compte existe et appartient au syndicat. */
async function compteDuSyndicat(compteId: string, coproprieteId: string, objet: string): Promise<CompteCoproprietaireEnregistre> {
  const compte = await ajDb.comptesCoproprietaires.get(compteId)
  if (!compte) throw new Error(`Compte copropriétaire « ${compteId} » introuvable.`)
  if (compte.coproprieteId !== coproprieteId)
    throw new Error(`Compte copropriétaire « ${compteId} » d'un autre syndicat (${compte.coproprieteId}) que ${coproprieteId} : ${objet} (D1).`)
  return compte
}

/** Postes imputables d'un compte du syndicat, réglé à jour, par exigibilité. Refuse un compte en écart. */
export function lirePostesDuCompte(coproprieteId: string, compteId: string): Promise<PosteDette[]> {
  return ajDb.transaction('r', tablesLues(), async () => {
    await compteDuSyndicat(compteId, coproprieteId, 'ses postes ne se lisent que dans son syndicat')
    const { postes, ecarts } = etatDe(await lireDonnees(coproprieteId))
    verifierSansEcart(compteId, ecarts)
    return postes.filter((p) => p.compteId === compteId)
  })
}

// ─── Écriture d'encaissements imputés ─────────────────────────────────────────────────────────────────────────────

export interface SaisieEncaissement {
  /** Identifiant de l'encaissement ; absent : tiré au hasard. */
  id?: string
  /** Compte copropriétaire (450) crédité, du syndicat. */
  compteId: string
  montantCentimes: number
  /** Pièce de banque : mode, n° (exigé pour un chèque), banque émettrice, libellé. */
  piece: SaisiePieceEncaissement
  /** Postes que le débiteur désigne en payant, dans l'ordre (C. civ. art. 1342-10, al. 1). Seul le débiteur désigne. */
  postesDesignes?: string[]
  /** Le gestionnaire accepte une désignation qui ne solde pas les postes désignés (C. civ. art. 1342-4, al. 1). */
  designationPartielleAcceptee?: boolean
  /** Le débiteur demande l'imputation du reliquat sur ses appels à venir ; jamais un fonds de travaux non échu. */
  imputerSurAVenir?: boolean
  /** Payeur lu sur la pièce (il peut être un tiers). */
  payeur?: string | null
  /** Clé de rapprochement retenue à l'import du relevé. */
  cleRapprochement?: CleRapprochement | null
  /** Date de valeur du relevé : pour le rapprochement seulement (F111). */
  dateValeur?: string | null
}

export interface OptionsEncaissements {
  /** Jour de l'opération sur le relevé (F111), le même pour tous les encaissements de la pièce (C. com. R. 123-174). */
  date: string
  /** Mandat auteur de la pièce (D1), sur ce syndicat. */
  mandatId: string
  /** Journal de banque : compte bancaire du syndicat (D-BANQUE) et compte 512 débité, dans son segment (D1). */
  journal: JournalEncaissement
  /** Famille de la pièce ; « Encaissement » par défaut (tout mode). */
  famille?: FamilleEncaissement
  /**
   * Jour de la saisie (AAAA-MM-JJ), pour refuser une date à venir ; par défaut le jour courant de l'application. C'est
   * aussi la date d'une pièce de reclassement (réimputation dans l'ordre des dates).
   */
  aujourdhui?: string
  /**
   * Décision du 24/11/2026 (question 6, option 3) — encaissement daté avant le dernier encaissement non annulé de son
   * compte : faux ou absent, il est refusé ; vrai, il est écrit et les encaissements postérieurs du compte sont réimputés
   * dans l'ordre des dates, par un reclassement interne au compte 450, dans la même transaction (conception, point 6).
   * Sans encaissement postérieur, l'option ne change rien. À valider : sur demande (codé) ou d'office.
   */
  reimputerDansLOrdreDesDates?: boolean
}

/** Réimputation d'un compte : sa pièce de reclassement et les encaissements réimputés, dans l'ordre du compte. */
export interface ReimputationDuCompte {
  compteId: string
  /** Pièce « Correction de mouvements ». */
  piece: PieceTraitementEnregistree
  /** Encaissements dont l'imputation a changé, après la réimputation. */
  encaissements: EncaissementCoproprietaireEnregistre[]
}

export interface ResultatEncaissements {
  piece: PieceTraitementEnregistree
  /** Encaissements écrits, dans l'ordre reçu, chacun avec son imputation. */
  encaissements: EncaissementCoproprietaireEnregistre[]
  /** Postes imputables du syndicat après l'écriture, réimputation comprise. */
  postes: PosteDette[]
  /** Comptes réimputés dans l'ordre des dates (décision du 24/11/2026, question 6) ; vide sans réimputation. */
  reimputations: ReimputationDuCompte[]
}

/** D-BANQUE et D1 : le compte bancaire du journal existe, appartient au syndicat et n'est pas clôturé. */
async function verifierCompteBancaire(banqueId: string, coproprieteId: string): Promise<void> {
  const banque = await ajDb.banques.get(banqueId)
  if (!banque) throw new Error(`Compte bancaire « ${banqueId} » introuvable.`)
  if (banque.coproprieteId !== coproprieteId)
    throw new Error(`Compte bancaire « ${banqueId} » d'un autre syndicat (${banque.coproprieteId}) que ${coproprieteId} : un encaissement entre sur un compte de son syndicat (D1, D-BANQUE).`)
  if (banque.actif === false) throw new Error(`Compte bancaire « ${banqueId} » clôturé : aucun encaissement ne s'y enregistre.`)
}

/** Identifiants des encaissements du lot : donnés ou tirés, sans doublon, pas encore enregistrés. */
async function identifiants(saisies: readonly SaisieEncaissement[]): Promise<string[]> {
  const ids = saisies.map((s) => s.id?.trim() || `enc-${genererId()}`)
  const double = ids.find((id, i) => ids.indexOf(id) !== i)
  if (double) throw new Error(`Encaissement ${double} en double dans le lot.`)
  const pris = (await ajDb.encaissements.bulkGet(ids)).find((e) => e !== undefined)
  if (pris) throw new Error(`Encaissement ${pris.id} déjà enregistré (traitement ${pris.traitementId}).`)
  return ids
}

/**
 * À valider (référent métier) — date d'un fait accompli (encaissement, débit de la banque qui l'annule) : refusée si elle
 * n'est pas une date, si son année est improbable (faute de frappe : dates.estAnneeImprobable) ou si elle est postérieure
 * au jour de la saisie. `datee` porte l'accord du message (« Encaissement daté », « Débit de la banque daté »). Contrôlé
 * à part pour l'encaissement seul : une date hors des exercices du syndicat (verifierDateDansUnExercice). Non contrôlé :
 * une date antérieure à l'écriture de l'appel.
 */
function verifierDate(datee: string, date: string, aujourdhui: string, refus: string): void {
  const anomalie = plausibiliteDate(date, aujourdhui, { futurAdmis: false })
  if (anomalie) throw new Error(`${messagePlausibilite(datee, date, anomalie)} ${refus} : corriger la date.`)
}

/** Ce qu'une date hors des exercices refuse : le début du message, le refus, et le remède qui précède l'ouverture de l'exercice. */
interface ObjetDate {
  /** « Encaissement daté du 31/12/2025 ». */
  datee: string
  /** « Encaissement refusé ». */
  refus: string
  /** Avant « l'exercice qui la comprend doit d'abord être ouvert » : « corriger la date ; si elle est juste, », ou rien. */
  remede: string
}

const encaissementDate = (date: string): ObjetDate => ({ datee: `Encaissement daté du ${dateIsoVersFr(date)}`, refus: 'Encaissement refusé', remede: 'corriger la date ; si elle est juste, ' })

/**
 * Décision du 24/11/2026 (question 6 bis) — encaissement daté hors des exercices du syndicat ouverts dans VitFix : refusé,
 * avec la même règle que la date comptable d'un appel (echeancier-appels : bornesDesExercices, exerciceDe ; J67, R96).
 * Sans ce refus, un encaissement ancien mais plausible partait en crédit « à imputer », ou sur des postes à venir à la
 * demande du débiteur, hors de tout exercice. Un exercice compte dès qu'il existe dans VitFix avec ses bornes (nom,
 * ouverture, clôture), bornes comprises ; ceux d'un autre syndicat ne comptent pas (D1). Le message ne renvoie à aucun
 * écran : « Ouvrir l'exercice » (écran « Appels de fonds ») n'est proposé que pour une échéance exigible hors des
 * exercices (voir l'en-tête, « à brancher »). La même règle vaut pour le jour d'une pièce de reclassement ou de correction
 * (`objet` : son libellé propre ; par défaut celui de l'encaissement). À appeler dans une transaction qui comprend la
 * table des exercices.
 */
async function verifierDateDansUnExercice(date: string, coproprieteId: string, { datee, refus, remede }: ObjetDate = encaissementDate(date)): Promise<void> {
  const exercices = bornesDesExercices(await ajDb.exercices.where('coproprieteId').equals(coproprieteId).toArray()).sort((a, b) =>
    a.ouverture.localeCompare(b.ouverture),
  )
  if (exerciceDe(exercices, date)) return
  if (exercices.length === 0)
    throw new Error(`${datee} : aucun exercice du syndicat n'est ouvert dans VitFix. ${refus} : l'exercice qui comprend cette date doit d'abord être ouvert dans VitFix.`)
  const liste = exercices.map((x) => `${x.nom} (${dateIsoVersFr(x.ouverture)} – ${dateIsoVersFr(x.cloture)})`).join(', ')
  throw new Error(
    `${datee} : hors des exercices du syndicat ouverts dans VitFix : ${liste}. ${refus} : ${remede}l'exercice qui la comprend doit d'abord être ouvert dans VitFix.`,
  )
}

/**
 * Ordre des paiements d'un compte, refus par défaut : l'imputation se fait le jour du paiement, sur les dettes échues ce
 * jour-là (C. civ. art. 1342-10 ; arrêté du 14/03/2005, art. 9), et chaque encaissement part du réglé laissé par les
 * précédents. Un encaissement daté AVANT le dernier encaissement non annulé du même compte s'imputerait sur ce que les
 * paiements postérieurs ont laissé (un chèque de décembre saisi après un virement de janvier partirait en reliquat,
 * l'appel de janvier restant dû). Décision du 24/11/2026 (question 6) : il ne s'enregistre qu'avec la réimputation des
 * encaissements postérieurs dans l'ordre des dates, demandée à l'écriture (`reimputerDansLOrdreDesDates`) ; sans elle,
 * refus. Le message ne propose jamais d'annuler les encaissements postérieurs : l'annulation est celle d'un rejet de la
 * banque (un crédit du 512 absent du relevé fausserait le rapprochement) ou d'une vraie erreur de saisie (montant, compte,
 * doublon), jamais un moyen de remettre dans l'ordre un encaissement saisi dans le désordre des dates. Le même jour que le
 * dernier : admis, dans l'ordre de saisie.
 */
function verifierOrdreDesDates(compteId: string, date: string, donnees: Pick<DonneesSyndicat, 'encaissements' | 'pieces'>): void {
  const dernier = donnees.encaissements.filter((e) => e.compteId === compteId && !e.annulation).sort(ordreDe(donnees)).at(-1)
  if (dernier && date < dernier.date)
    throw new Error(
      `Encaissement du ${dateIsoVersFr(date)} sur le compte « ${compteId} » : antérieur au dernier encaissement de ce compte (${dernier.id} du ${dateIsoVersFr(dernier.date)}), déjà imputé ; l'imputation suit l'ordre des paiements (C. civ. art. 1342-10 ; arrêté du 14/03/2005, art. 9). Encaissement refusé tel quel : il ne s'enregistre qu'avec la réimputation, dans l'ordre des dates, des encaissements postérieurs de ce compte, par un reclassement interne au compte 450, sans mouvement de banque, demandée à l'écriture ; signaler cet encaissement pour qu'il soit traité ; ne pas annuler les encaissements postérieurs : l'annulation est réservée à un rejet de la banque ou à une vraie erreur de saisie (montant, compte, doublon).`,
    )
}

/**
 * À valider (référent métier) — compte repris d'une ancienne fiche avec un solde dû (migration-d2.RepriseSoldeCompte :
 * relevé « sans aucune écriture comptable ») : ce solde est une dette plus ancienne que les postes D2, que l'imputation ne
 * voit pas ; servir d'abord un appel récent irait contre l'ordre de l'art. 1342-10 du code civil. Solution prudente :
 * refuser, jusqu'à ce que la reprise des soldes ait son écriture (ou qu'il soit décidé de ne pas en tenir compte).
 */
function verifierSoldeRepris(compte: CompteCoproprietaireEnregistre): void {
  const du = compte.reprise?.soldeDuCentimes ?? 0
  if (du > 0)
    throw new Error(
      `Compte copropriétaire « ${compte.id} » : solde repris de ${formatEurosCentimes(du / 100)} dû sur l'ancienne fiche (relevé du ${compte.reprise?.releveLe}), sans aucune écriture au compte ; un encaissement s'imputerait sur des appels plus récents que cette dette (C. civ. art. 1342-10). Encaissement refusé tant que le solde repris n'est pas écrit.`,
    )
}

/** Encaissement du domaine tiré de la saisie : seuls les champs renseignés sont posés. */
function encaissementSaisi(id: string, saisie: SaisieEncaissement, date: string): Encaissement {
  return {
    id,
    compteId: saisie.compteId,
    date,
    montantCentimes: saisie.montantCentimes,
    ...(saisie.postesDesignes?.length ? { postesDesignes: [...saisie.postesDesignes] } : {}),
    ...(saisie.designationPartielleAcceptee ? { designationPartielleAcceptee: true } : {}),
    ...(saisie.payeur?.trim() ? { payeur: saisie.payeur.trim() } : {}),
    ...(saisie.cleRapprochement ? { cleRapprochement: saisie.cleRapprochement } : {}),
  }
}

/** Contrôles du compte crédité : du syndicat (D1), sans écart, sans solde repris dû. L'ordre des dates : à part. */
async function verifierCompteCredite(compteId: string, coproprieteId: string, ecarts: readonly EcartCompte[]): Promise<void> {
  const compte = await compteDuSyndicat(compteId, coproprieteId, 'un encaissement ne crédite que les comptes de son syndicat')
  verifierSansEcart(compteId, ecarts)
  verifierSoldeRepris(compte)
}

type LigneEncaissement = EncaissementCoproprietaireEnregistre
type EncaissementImputeALEcriture = { encaissement: EncaissementEnregistre; resultat: ResultatImputation; imputerSurAVenir: boolean }

const aRejouer = (e: LigneEncaissement): EncaissementARejouer => ({ encaissement: e, courante: e.imputation })
const SUITE_REFUS_REIMPUTATION = "Réimputation refusée, rien n'est écrit"

/**
 * Encaissements à rejouer, par compte crédité par le lot (conception, point 6) : les encaissements NON annulés du compte,
 * de date STRICTEMENT postérieure à celle du lot, dans l'ordre du compte. Les comptes sans encaissement postérieur n'y
 * sont pas.
 */
function suffixesDesComptes(saisies: readonly SaisieEncaissement[], date: string, donnees: DonneesSyndicat): Map<string, LigneEncaissement[]> {
  const ordre = ordreDe(donnees)
  const suffixes = new Map<string, LigneEncaissement[]>()
  for (const compteId of new Set(saisies.map((s) => s.compteId))) {
    const suffixe = donnees.encaissements.filter((e) => e.compteId === compteId && !e.annulation && e.date > date).sort(ordre)
    if (suffixe.length > 0) suffixes.set(compteId, suffixe)
  }
  return suffixes
}

/** Pièces qu'un reclassement corrige pour un encaissement : sa pièce d'origine, puis ses pièces de reclassement antérieures. */
const piecesCorrigees = (e: LigneEncaissement): string[] => [...(e.traitementId === null ? [] : [e.traitementId]), ...(e.reimputations ?? []).map((r) => r.traitementId)]

/**
 * Date de la pièce de reclassement : le jour du traitement, jamais celui du paiement en retard (décision du 17/11/2026 :
 * J67, R121 à R123 : une erreur se corrige par une écriture datée dans la période ouverte). Refus : ce jour hors des
 * exercices du syndicat ouverts dans VitFix (même règle que la question 6 bis), ou antérieur à l'une des pièces que le
 * reclassement corrige ; pièce corrigée introuvable.
 */
async function verifierDateDuReclassement(aujourdhui: string, coproprieteId: string, rejoues: readonly LigneEncaissement[], pieces: readonly PieceTraitementEnregistree[]): Promise<void> {
  const datee = `Pièce de reclassement datée du ${dateIsoVersFr(aujourdhui)}, jour du traitement`
  await verifierDateDansUnExercice(aujourdhui, coproprieteId, { datee, refus: 'Réimputation refusée', remede: '' })
  for (const e of rejoues)
    for (const pieceId of piecesCorrigees(e)) {
      const piece = pieces.find((p) => p.id === pieceId)
      if (!piece)
        throw new Error(`Encaissement ${e.id} : pièce ${pieceId} introuvable au journal des traitements du syndicat ; la réimputation ne corrige que des pièces qu'elle retrouve. ${SUITE_REFUS_REIMPUTATION}.`)
      if (aujourdhui < piece.date)
        throw new Error(
          `${datee} : antérieure à la pièce n° ${piece.numero} du ${dateIsoVersFr(piece.date)} (encaissement ${e.id}) qu'elle corrige ; une correction ne précède pas l'écriture qu'elle corrige (décision du 17/11/2026 : J67, R121 et R122). ${SUITE_REFUS_REIMPUTATION}.`,
        )
    }
}

/**
 * Enregistre (pièce, journal) et impute les saisies du lot, dans l'ordre reçu, depuis `postes` : un encaissement à la
 * fois, chacun sur les soldes laissés par le précédent, avec sa propre demande d'imputation à venir.
 */
function imputerLesSaisies(
  saisies: readonly SaisieEncaissement[],
  ids: readonly string[],
  { date, journal, segmentSyndicat }: { date: string; journal: JournalEncaissement; segmentSyndicat: string },
  postes: PosteDette[],
): { imputes: EncaissementImputeALEcriture[]; postes: PosteDette[] } {
  let courants = postes
  const imputes = saisies.map((saisie, i): EncaissementImputeALEcriture => {
    const encaissement = enregistrerEncaissement(encaissementSaisi(ids[i], saisie, date), { piece: saisie.piece, journal, segmentSyndicat, dateValeur: saisie.dateValeur })
    const imputerSurAVenir = saisie.imputerSurAVenir === true
    const { resultats, postes: apres } = imputerEncaissements([encaissement], courants, { imputerSurAVenir })
    courants = apres
    return { encaissement, resultat: resultats[0], imputerSurAVenir }
  })
  return { imputes, postes: courants }
}

/** Imputation à garder sur l'encaissement : celle du résultat, avec l'appel et le compte 450 de chaque ligne. */
const imputationEcrite = ({ resultat, imputerSurAVenir }: EncaissementImputeALEcriture): ImputationEcrite => ({
  lignes: lignesEcrites(resultat.lignes, resultat.postes),
  resteAImputerCentimes: resultat.resteAImputerCentimes,
  designationsIgnorees: resultat.designationsIgnorees,
  designationPartielleRefusee: resultat.designationPartielleRefusee,
  imputerSurAVenir,
})

/** Le lot en retard, tel que la pièce de reclassement le cite : sa pièce, sa date, ses encaissements par compte. */
interface LotEnRetard {
  piece: PieceTraitementEnregistree
  date: string
  /** Jour de la saisie : la date des pièces de reclassement. */
  saisiLe: string
  /** Encaissements du lot sur chaque compte, dans l'ordre reçu. */
  idsParCompte: ReadonlyMap<string, string[]>
}

interface ContexteReclassement {
  donnees: DonneesSyndicat
  coproprieteId: string
  mandatId: string
  segmentSyndicat: string
  lot: LotEnRetard
  actor: string | null
}

/**
 * Écrit la réimputation d'un compte (conception, point 6) : la pièce « Correction de mouvements », puis, pour chaque
 * encaissement dont l'imputation change, sa nouvelle imputation courante et la réimputation ajoutée à son historique.
 * Null : le rejeu ne change rien pour ce compte, rien n'est écrit. À valider (n° 18) : un rejeu qui ne déplace que des
 * centimes entre deux lots d'un même appel, sans aucune ligne à écrire pour le compte, est refusé.
 */
async function ecrireReclassement(compteId: string, suffixe: readonly LigneEncaissement[], rejeux: readonly Rejeu[], contexte: ContexteReclassement): Promise<ReimputationDuCompte | null> {
  const { donnees, coproprieteId, mandatId, segmentSyndicat, lot, actor } = contexte
  const changes = rejeux.filter((r) => r.change)
  if (changes.length === 0) return null
  const compte = donnees.comptes.find((c) => c.id === compteId)
  if (!compte) throw new Error(`Compte copropriétaire « ${compteId} » introuvable.`)
  const comptes450 = {
    compteId,
    compteCoproprietaire: numeroCompteCoproprietaire(compte, segmentSyndicat),
    compteDuPlan: (planCode: string) => numeroCompteCoproprietaire(compte, segmentSyndicat, planCode),
  }
  const lignes = changes.map((rejeu): LigneMouvement[] => mouvementsReclassement({ ...comptes450, avant: rejeu.avant, apres: rejeu.apres }))
  if (lignes.every((l) => l.length === 0))
    throw new Error(
      `Compte « ${compteId} » : le paiement saisi en retard ne déplace l'imputation de ses encaissements postérieurs qu'entre les lots d'un même appel, sans aucune ligne à écrire au compte 450 ; aucune pièce de reclassement ne porterait cette réimputation (cas à valider). ${SUITE_REFUS_REIMPUTATION} ; signaler cet encaissement pour qu'il soit traité.`,
    )
  const traitement = traitementReclassement(lignes.flat(), { id: `reclassement-${genererId()}`, date: lot.saisiLe })
  const piece = await enregistrerPieceTraitement({ traitement, coproprieteId, mandatId }, { actor })
  const maintenant = new Date().toISOString()
  const enRetard = { ids: lot.idsParCompte.get(compteId) ?? [], date: lot.date, numeroPiece: lot.piece.numero }
  const encaissements: LigneEncaissement[] = []
  for (const [i, rejeu] of changes.entries()) {
    const avant = suffixe.find((e) => e.id === rejeu.encaissementId)
    if (!avant) throw new Error(`Encaissement ${rejeu.encaissementId} : rejoué sans être du compte « ${compteId} ».`)
    const reimputation: ReimputationEcrite = {
      traitementId: piece.id,
      le: lot.saisiLe,
      cause: { type: 'encaissement-en-retard', encaissementIds: [...enRetard.ids], traitementId: lot.piece.id, date: lot.date },
      avant: rejeu.avant,
      mouvements: lignes[i],
      mention: mentionReimputation({
        serie: compte.serie,
        enRetard,
        saisiLe: lot.saisiLe,
        reimpute: { id: avant.id, date: avant.date, numeroPiece: donnees.pieces.find((p) => p.id === avant.traitementId)?.numero ?? null },
      }),
    }
    const apres: LigneEncaissement = { ...avant, imputation: rejeu.apres, reimputations: [...(avant.reimputations ?? []), reimputation], updatedAt: maintenant, updatedBy: actor }
    await ajDb.encaissements.put(apres)
    await journaliserActivite({ entite: 'encaissements', entiteId: apres.id, action: 'update', qui: actor, avant, apres })
    encaissements.push(apres)
  }
  return { compteId, piece, encaissements }
}

/** Vrai rejeu, compte par compte : les encaissements postérieurs de chaque compte, après les paiements en retard du lot. */
function rejouerLesSuffixes(suffixes: ReadonlyMap<string, LigneEncaissement[]>, apresLeLot: PosteDette[]): { rejeuxParCompte: Map<string, Rejeu[]>; postes: PosteDette[] } {
  let postes = apresLeLot
  const rejeuxParCompte = new Map<string, Rejeu[]>()
  for (const [compteId, suffixe] of suffixes) {
    const rejeu = rejouerSuffixe(suffixe.map(aRejouer), postes)
    rejeuxParCompte.set(compteId, rejeu.rejeux)
    postes = rejeu.postes
  }
  return { rejeuxParCompte, postes }
}

/** Encaissements du lot sur chaque compte, dans l'ordre reçu. */
function idsDuLotParCompte(saisies: readonly SaisieEncaissement[], ids: readonly string[]): Map<string, string[]> {
  const idsParCompte = new Map<string, string[]>()
  for (const [i, saisie] of saisies.entries()) idsParCompte.set(saisie.compteId, [...(idsParCompte.get(saisie.compteId) ?? []), ids[i]])
  return idsParCompte
}

/** Une pièce de reclassement par compte dont le rejeu change une imputation ; aucune pour les autres. */
async function ecrireLesReclassements(suffixes: ReadonlyMap<string, LigneEncaissement[]>, rejeuxParCompte: ReadonlyMap<string, Rejeu[]>, contexte: ContexteReclassement): Promise<ReimputationDuCompte[]> {
  const reimputations: ReimputationDuCompte[] = []
  for (const [compteId, suffixe] of suffixes) {
    const reimputation = await ecrireReclassement(compteId, suffixe, rejeuxParCompte.get(compteId) ?? [], contexte)
    if (reimputation) reimputations.push(reimputation)
  }
  return reimputations
}

/** Sur un paiement saisi en retard : la pièce de reclassement que son compte a reçue, s'il en a reçu une. */
function renvoiAuReclassement(compteId: string, reimputations: readonly ReimputationDuCompte[]): { reclassementIds?: string[] } {
  const reclassement = reimputations.find((r) => r.compteId === compteId)
  return reclassement ? { reclassementIds: [reclassement.piece.id] } : {}
}

/**
 * Enregistre, impute et écrit des encaissements de copropriétaires d'un même jour, dans une seule pièce et une seule
 * transaction qui relit les postes : voir la conception en tête. Chaque poste est crédité au compte 450 que son appel a
 * débité. Décision du 24/11/2026 (question 6, option 3) : avec `reimputerDansLOrdreDesDates`, un encaissement daté avant
 * le dernier encaissement non annulé de son compte est écrit, et les encaissements postérieurs de ce compte sont
 * réimputés dans l'ordre des dates (une pièce « Correction de mouvements » par compte réimputé, `reimputations`).
 * Refus, rien n'est écrit (un seul encaissement refusé refuse tout le lot) : syndicat, compte ou compte bancaire
 * introuvable ou d'un autre syndicat (D1), compte bancaire clôturé, mandat d'un autre syndicat, compte en écart avec
 * l'écriture de ses appels, compte repris avec un solde dû (à valider), date invalide, d'une année improbable, à venir,
 * hors des exercices du syndicat ouverts dans VitFix (décision du 24/11/2026, question 6 bis), ou antérieure au dernier
 * encaissement non annulé du compte sans la réimputation demandée, aucun encaissement, identifiant en double ou déjà
 * pris, montant qui n'est pas un nombre entier de centimes positif, pièce ou journal refusés par le domaine (chèque sans
 * numéro, espèces, 512 d'un autre syndicat, mode étranger à la famille), poste désigné inconnu ou d'un autre compte ;
 * avec la réimputation : jour du traitement hors des exercices ouverts ou antérieur à une pièce corrigée, imputation
 * d'un encaissement postérieur qui ne se rejoue pas à l'identique (garde du rejeu à blanc), désignation du débiteur qui
 * serait déplacée.
 */
export function ecrireEncaissements(
  coproprieteId: string,
  saisies: readonly SaisieEncaissement[],
  { date, mandatId, journal, famille = 'Encaissement', aujourdhui = DATE_DU_JOUR_ISO, reimputerDansLOrdreDesDates = false }: OptionsEncaissements,
  { actor = null }: OptionsEcriture = {},
): Promise<ResultatEncaissements> {
  return ajDb.transaction('rw', tablesEcrites(), async () => {
    const donnees = await lireDonnees(coproprieteId)
    if (saisies.length === 0) throw new Error('Aucun encaissement à écrire.')
    verifierDate('Encaissement daté', date, aujourdhui, 'Encaissement refusé')
    await verifierDateDansUnExercice(date, coproprieteId)
    await verifierCompteBancaire(journal.banqueId, coproprieteId)
    const ids = await identifiants(saisies)
    const segmentSyndicat = segmentComptableSyndicat(donnees.copropriete.code)
    const etat = etatDe(donnees)
    for (const saisie of saisies) {
      await verifierCompteCredite(saisie.compteId, coproprieteId, etat.ecarts)
      if (!reimputerDansLOrdreDesDates) verifierOrdreDesDates(saisie.compteId, date, donnees)
    }

    // Réimputation dans l'ordre des dates : les encaissements postérieurs de chaque compte du lot sont retirés des postes,
    // rejoués à blanc (garde), puis rejoués après les paiements en retard. Sans encaissement postérieur : circuit ordinaire.
    const suffixes = suffixesDesComptes(saisies, date, donnees)
    const rejoues = [...suffixes.values()].flat()
    if (rejoues.length > 0) await verifierDateDuReclassement(aujourdhui, coproprieteId, rejoues, donnees.pieces)
    const sansSuffixe = postesSansSuffixe(rejoues.map(aRejouer), etat.postes)
    for (const suffixe of suffixes.values()) verifierRejeuABlanc(suffixe.map(aRejouer), sansSuffixe)
    const { imputes, postes: apresLeLot } = imputerLesSaisies(saisies, ids, { date, journal, segmentSyndicat }, sansSuffixe)
    const { rejeuxParCompte, postes } = rejouerLesSuffixes(suffixes, apresLeLot)

    // Aucun réglage des sous-comptes : chaque poste porte le compte que son appel a débité (planCompte).
    const ecrit = traitementEncaissements({ encaissements: imputes }, { id: `encaissement-${genererId()}`, date, famille, segmentSyndicat, comptes: donnees.comptes })
    const piece = await enregistrerPieceTraitement({ traitement: ecrit.traitement, coproprieteId, mandatId }, { actor })

    const lot: LotEnRetard = { piece, date, saisiLe: aujourdhui, idsParCompte: idsDuLotParCompte(saisies, ids) }
    const reimputations = await ecrireLesReclassements(suffixes, rejeuxParCompte, { donnees, coproprieteId, mandatId, segmentSyndicat, lot, actor })

    const maintenant = new Date().toISOString()
    const lignes = ecrit.encaissements.map((encaissement, i): LigneEncaissement => {
      return {
        ...encaissement,
        coproprieteId,
        imputation: imputationEcrite(imputes[i]),
        rang: i,
        ...renvoiAuReclassement(encaissement.compteId, reimputations),
        createdAt: maintenant,
        updatedAt: maintenant,
        createdBy: actor,
        updatedBy: actor,
      }
    })
    await ajDb.encaissements.bulkAdd(lignes)
    for (const ligne of lignes) await journaliserActivite({ entite: 'encaissements', entiteId: ligne.id, action: 'create', qui: actor, avant: null, apres: ligne })
    return { piece, encaissements: lignes, postes, reimputations }
  })
}

// ─── Annulation : rejet de la banque (F110) ───────────────────────────────────────────────────────────────────────

/** Débit de la banque qui annule l'encaissement : chèque impayé, virement reçu retourné. */
export interface SaisieAnnulationEncaissementEcrit {
  /** Jour où la banque débite le compte (AAAA-MM-JJ). */
  date: string
  /** Motif donné par la banque. */
  motif: string
  /** Référence de l'avis de la banque (arrêté du 14 mars 2005, art. 4). */
  piece: string
  /** Mandat qui annule (D1), sur le même syndicat ; par défaut celui de la pièce d'origine. */
  mandatId?: string
  /**
   * Jour de la saisie (AAAA-MM-JJ), pour refuser un débit à venir ; par défaut le jour courant de l'application. C'est
   * aussi la date de la pièce qui contre-passe les reclassements d'un encaissement réimputé.
   */
  aujourdhui?: string
}

export interface ResultatAnnulationEncaissement {
  /** Pièce « Annulation d'encaissement » : l'écriture contraire des lignes d'origine. */
  piece: PieceTraitementEnregistree
  /**
   * Encaissement réimputé dans l'ordre des dates : pièce « Correction de mouvements » qui contre-passe ses lignes de
   * reclassement, datée du jour de la saisie ; null sinon (ou si ses reclassements se compensent).
   */
  correction: PieceTraitementEnregistree | null
  encaissement: EncaissementCoproprietaireEnregistre
  /**
   * Postes imputables du syndicat après l'annulation : ceux que l'encaissement avait réglés sont de nouveau dus. Ceux d'un
   * compte en écart ne sont pas rendus (l'annulation ne lève pas l'écart).
   */
  postes: PosteDette[]
  /**
   * À valider (n° 10) — l'encaissement annulé était un paiement saisi en retard qui a CAUSÉ une réimputation : identifiants
   * des encaissements non annulés qu'elle a réimputés, et qui gardent cette réimputation. Absent s'il n'en a causé aucune.
   */
  reimputationsCausees?: string[]
}

/** Pièce d'origine de l'encaissement : présente au journal du syndicat, et jamais annulée par un autre circuit. */
function pieceDOrigine(encaissement: EncaissementCoproprietaireEnregistre, pieces: readonly PieceTraitementEnregistree[]): PieceTraitementEnregistree {
  const origine = pieces.find((p) => p.id === encaissement.traitementId)
  if (!origine) throw new Error(`Encaissement ${encaissement.id} : pièce d'origine ${encaissement.traitementId} introuvable au journal des traitements du syndicat.`)
  if (origine.statut === STATUT_PIECE_ANNULEE || origine.annuleePar !== undefined)
    throw new Error(
      `Encaissement ${encaissement.id} : sa pièce n° ${origine.numero} est déjà annulée (écriture contraire ${origine.annuleePar ?? 'inconnue'}) ; aucune seconde écriture contraire n'est passée.`,
    )
  return origine
}

/**
 * Résultat d'imputation d'un encaissement pour l'une de ses imputations gardées (courante ou d'origine) : ses lignes, et
 * les postes tels que ces lignes les décrivent (postes-comptes.postesDeLImputation), sans relire l'échéancier : un compte
 * en écart s'annule aussi.
 */
function resultatGarde(encaissement: LigneEncaissement, imputation: ImputationEcrite): ResultatImputation {
  return {
    encaissementId: encaissement.id,
    lignes: imputation.lignes.map(({ posteId, montantCentimes }) => ({ posteId, montantCentimes })),
    resteAImputerCentimes: imputation.resteAImputerCentimes,
    designationsIgnorees: imputation.designationsIgnorees,
    designationPartielleRefusee: imputation.designationPartielleRefusee,
    postes: postesDeLImputation({ ...encaissement, imputation }),
  }
}

/** Pièces de reclassement d'un encaissement réimputé, lues au journal du syndicat : présentes, et jamais annulées. */
function piecesDeReclassement(encaissement: LigneEncaissement, pieces: readonly PieceTraitementEnregistree[]): PieceTraitementEnregistree[] {
  return (encaissement.reimputations ?? []).map((reimputation) => {
    const piece = pieces.find((p) => p.id === reimputation.traitementId)
    if (!piece)
      throw new Error(
        `Encaissement ${encaissement.id} : sa pièce de reclassement ${reimputation.traitementId} est introuvable au journal des traitements du syndicat ; l'écriture contraire ne contre-passe que ce qui a été écrit.`,
      )
    if (piece.statut === STATUT_PIECE_ANNULEE)
      throw new Error(`Encaissement ${encaissement.id} : sa pièce de reclassement n° ${piece.numero} est annulée, hors du circuit des encaissements ; l'écriture contraire ne contre-passe que ce qui a été écrit.`)
    return piece
  })
}

/**
 * Ce qu'il faut au domaine pour contre-passer un encaissement (rejet de la banque, erreur de saisie) : son imputation
 * d'origine, et, s'il a été réimputé, son imputation courante et ses reclassements, lus dans leurs pièces.
 */
function aContrePasser(encaissement: LigneEncaissement, pieces: readonly PieceTraitementEnregistree[]): EncaissementAContrePasser & { piecesDeReclassement: PieceTraitementEnregistree[] } {
  const resultat = resultatGarde(encaissement, imputationDOrigine(encaissement))
  const lues = piecesDeReclassement(encaissement, pieces)
  if (lues.length === 0) return { encaissement, resultat, piecesDeReclassement: [] }
  const reclassements = (encaissement.reimputations ?? []).map((reimputation, i): ReclassementEcrit => ({ ecriture: lues[i].traitement, mouvements: reimputation.mouvements }))
  return { encaissement, resultat, reimputation: { courante: resultatGarde(encaissement, encaissement.imputation), reclassements }, piecesDeReclassement: lues }
}

/**
 * Date de la pièce qui contre-passe des reclassements : le jour de la saisie. Refus : hors des exercices du syndicat
 * ouverts dans VitFix, ou antérieure à l'une des pièces de reclassement qu'elle contre-passe (décision du 17/11/2026 :
 * J67, R121 et R122).
 */
async function verifierDateDeCorrection(datee: string, aujourdhui: string, coproprieteId: string, reclassements: readonly PieceTraitementEnregistree[]): Promise<void> {
  await verifierDateDansUnExercice(aujourdhui, coproprieteId, { datee: `${datee}, jour de la saisie`, refus: 'Annulation refusée', remede: '' })
  const posterieure = reclassements.find((p) => aujourdhui < p.date)
  if (posterieure)
    throw new Error(
      `${datee}, jour de la saisie : antérieure à la pièce de reclassement n° ${posterieure.numero} du ${dateIsoVersFr(posterieure.date)} qu'elle contre-passe ; l'écriture contraire annule une écriture passée, elle ne la précède pas. Annulation refusée.`,
    )
}

/**
 * Annule un encaissement écrit (décision du 20/11/2026, partie C, F110) : voir la conception en tête, point 5. Un compte
 * en écart n'empêche pas l'annulation : la banque a déjà rejeté le paiement, et l'écriture contraire se lit dans les
 * lignes gardées sur l'encaissement. Encaissement réimputé dans l'ordre des dates (décision du 24/11/2026, question 6) :
 * deux pièces, l'annulation de ses lignes d'origine au jour du débit et la correction de ses reclassements au jour de la
 * saisie (conception, point 6). Refus, rien n'est écrit : encaissement introuvable ou d'un autre syndicat (D1), déjà
 * annulé, pièce d'origine absente ou déjà annulée par un autre circuit, débit de la banque antérieur à l'écriture, d'une
 * année improbable ou postérieur au jour de la saisie (à valider), sans motif ou sans pièce, date invalide, mandat d'un
 * autre syndicat, écriture d'origine qui ne porte pas ses lignes ; pour un encaissement réimputé : pièce de reclassement
 * absente ou annulée, jour de la saisie hors des exercices ouverts ou antérieur à une pièce de reclassement, pièces qui
 * ne redonnent pas l'imputation courante.
 */
export function annulerEncaissementEcrit(
  coproprieteId: string,
  encaissementId: string,
  { date, motif, piece: avis, mandatId, aujourdhui = DATE_DU_JOUR_ISO }: SaisieAnnulationEncaissementEcrit,
  { actor = null }: OptionsEcriture = {},
): Promise<ResultatAnnulationEncaissement> {
  return ajDb.transaction('rw', tablesEcrites(), async () => {
    verifierDate('Débit de la banque daté', date, aujourdhui, 'Annulation refusée')
    const avant = await ajDb.encaissements.get(encaissementId)
    if (!avant) throw new Error(`Encaissement introuvable (id=${encaissementId}).`)
    if (avant.coproprieteId !== coproprieteId)
      throw new Error(`Encaissement ${encaissementId} d'un autre syndicat (${avant.coproprieteId}) que ${coproprieteId} (D1).`)
    const donnees = await lireDonnees(coproprieteId)
    const origine = pieceDOrigine(avant, donnees.pieces)
    // Les postes de l'écriture contraire se lisent dans les lignes gardées sur l'encaissement, pas dans l'échéancier relu :
    // un compte en écart s'annule aussi.
    const { resultat, reimputation, piecesDeReclassement: reclassements } = aContrePasser(avant, donnees.pieces)
    if (reimputation && !avant.annulation) await verifierDateDeCorrection(`Correction du reclassement datée du ${dateIsoVersFr(aujourdhui)}`, aujourdhui, coproprieteId, reclassements)
    const annule = annulerEncaissement(
      avant,
      {
        ecriture: origine.traitement,
        resultat,
        postes: (reimputation?.courante ?? resultat).postes,
        comptes: donnees.comptes,
        segmentSyndicat: segmentComptableSyndicat(donnees.copropriete.code),
        ...(reimputation ? { reimputation: { ...reimputation, correction: { id: `correction-${genererId()}`, date: aujourdhui } } } : {}),
      },
      { id: `annulation-encaissement-${genererId()}`, date, motif, piece: avis },
    )
    const mandat = mandatId ?? origine.mandatId
    const piece = await enregistrerPieceTraitement({ traitement: annule.traitement, coproprieteId, mandatId: mandat }, { actor })
    const correction = annule.correction ? await enregistrerPieceTraitement({ traitement: annule.correction, coproprieteId, mandatId: mandat }, { actor }) : null
    const apres: EncaissementCoproprietaireEnregistre = {
      ...avant,
      statut: annule.encaissement.statut,
      annulation: annule.encaissement.annulation,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    }
    await ajDb.encaissements.put(apres)
    await journaliserActivite({ entite: 'encaissements', entiteId: apres.id, action: 'update', qui: actor, avant, apres })
    const encaissements = donnees.encaissements.map((e) => (e.id === apres.id ? apres : e))
    const causees = encaissements.filter((e) => !e.annulation && (e.reimputations ?? []).some((r) => r.cause.encaissementIds.includes(apres.id))).map((e) => e.id)
    return { piece, correction, encaissement: apres, postes: etatDe({ ...donnees, encaissements }).postes, ...(causees.length > 0 ? { reimputationsCausees: causees } : {}) }
  })
}

// ─── Annulation : erreur de saisie (décision du 24/11/2026, question 6, option 4) ─────────────────────────────────

export { MOTIFS_ERREUR_DE_SAISIE }

/** Correction d'une pièce d'encaissement saisie par erreur. */
export interface SaisieAnnulationPourErreur {
  /** Nature de l'erreur : montant, compte ou doublon (décision du 24/11/2026), rien d'autre. */
  motif: MotifErreurDeSaisie
  /** Ce qui est faux, en clair : elle fait la note de correction (arrêté du 14 mars 2005, art. 4). */
  explication: string
  /** Mandat qui annule (D1), sur le même syndicat ; par défaut celui de la pièce d'origine. */
  mandatId?: string
  /** Jour de la correction (AAAA-MM-JJ) : date des écritures contraires ; par défaut le jour courant de l'application. */
  aujourdhui?: string
}

export interface ResultatAnnulationPourErreur {
  /** Pièce d'origine, passée « Annulé ». */
  piece: PieceTraitementEnregistree
  /** Pièce « Annulation d'encaissement » : l'écriture contraire de toute la pièce. */
  annulation: PieceTraitementEnregistree
  /** Pièce « Correction de mouvements » qui contre-passe les reclassements des encaissements réimputés de la pièce ; null sinon. */
  correction: PieceTraitementEnregistree | null
  /** Encaissements de la pièce, tous « Annulé », dans l'ordre du lot. */
  encaissements: EncaissementCoproprietaireEnregistre[]
  /** Postes imputables du syndicat après l'annulation. */
  postes: PosteDette[]
}

/** Pièce à annuler pour erreur de saisie : du syndicat (D1), d'une famille d'encaissement, « Enregistré ». */
async function pieceAAnnulerPourErreur(pieceId: string, coproprieteId: string): Promise<PieceTraitementEnregistree> {
  const piece = await ajDb.traitements.get(pieceId)
  if (!piece) throw new Error(`Pièce introuvable (id=${pieceId}).`)
  if (piece.coproprieteId !== coproprieteId) throw new Error(`Pièce n° ${piece.numero} d'un autre syndicat (${piece.coproprieteId}) que ${coproprieteId} (D1).`)
  if (!(FAMILLES_ENCAISSEMENT as readonly string[]).includes(piece.famille))
    throw new Error(`Pièce n° ${piece.numero} (« ${piece.famille} ») : seule une pièce d'encaissement s'annule pour erreur de saisie.`)
  if (piece.statut === STATUT_PIECE_ANNULEE || piece.annuleePar !== undefined)
    throw new Error(`Pièce n° ${piece.numero} déjà annulée (écriture contraire ${piece.annuleePar ?? 'inconnue'}) ; aucune seconde écriture contraire n'est passée.`)
  if (piece.statut !== CYCLES_PIECE.comptable[0])
    throw new Error(`Pièce n° ${piece.numero} au statut « ${piece.statut} » : seule une pièce « ${CYCLES_PIECE.comptable[0]} » s'annule (une pièce imputée ne s'annule plus).`)
  return piece
}

/** Jour de la correction : une date, d'une année plausible, dans un exercice ouvert, jamais avant la pièce qu'elle annule. */
async function verifierJourDeLaCorrection(aujourdhui: string, origine: PieceTraitementEnregistree, coproprieteId: string): Promise<void> {
  verifierAujourdhui(aujourdhui)
  if (estAnneeImprobable(aujourdhui)) throw new Error(`${messagePlausibilite('Correction datée', aujourdhui, 'annee_improbable')} Annulation refusée.`)
  const datee = `Correction datée du ${dateIsoVersFr(aujourdhui)}`
  await verifierDateDansUnExercice(aujourdhui, coproprieteId, { datee: `${datee}, jour de la saisie`, refus: 'Annulation refusée', remede: '' })
  if (aujourdhui < origine.date)
    throw new Error(
      `${datee}, antérieure à la pièce n° ${origine.numero} du ${dateIsoVersFr(origine.date)} : l'écriture contraire annule une écriture passée, elle ne la précède pas. Annulation refusée.`,
    )
}

/**
 * À valider (n° 8) — encaissement NON annulé postérieur, hors de la pièce, sur un compte de la pièce : il a été imputé sur
 * les soldes qu'elle a laissés ; l'annuler sans le réimputer fausserait l'ordre des paiements. Solution prudente : refus,
 * qui le nomme et, pour un doublon, dit quelle pièce annuler (la plus récente).
 */
function verifierSansEncaissementPosterieur(origine: PieceTraitementEnregistree, duLot: readonly LigneEncaissement[], donnees: DonneesSyndicat, motif: string): void {
  const ordre = ordreDe(donnees)
  const nomDeLaPiece = (e: LigneEncaissement): string => {
    const numero = donnees.pieces.find((p) => p.id === e.traitementId)?.numero
    return numero === undefined ? 'pièce introuvable' : `pièce n° ${numero}`
  }
  for (const e of duLot) {
    const posterieurs = donnees.encaissements.filter((x) => x.compteId === e.compteId && !x.annulation && x.traitementId !== origine.id && ordre(x, e) > 0).sort(ordre)
    const [premier] = posterieurs
    const dernier = posterieurs.at(-1)
    if (!premier || !dernier) continue
    const pourUnDoublon = motif === 'doublon' ? ` Pour un doublon, c'est la pièce la plus récente (${nomDeLaPiece(dernier).replace('pièce ', '')}) qui s'annule.` : ''
    throw new Error(
      `Pièce n° ${origine.numero} : l'encaissement ${premier.id} du ${dateIsoVersFr(premier.date)} (${nomDeLaPiece(premier)}), postérieur sur le compte « ${e.compteId} », a été imputé sur les soldes qu'elle a laissés ; l'annuler sans réimputer cet encaissement fausserait l'ordre des paiements (C. civ. art. 1342-10). Annulation refusée, rien n'est écrit : une pièce ne s'annule pour erreur de saisie que tant qu'aucun encaissement postérieur n'existe sur ses comptes (à valider) ; signaler cette pièce pour qu'elle soit traitée.${pourUnDoublon}`,
    )
  }
}

/**
 * Annule une pièce d'encaissement saisie par erreur (décision du 24/11/2026, question 6, option 4) : voir la conception en
 * tête, point 7. Pour les vraies erreurs seulement (montant, compte, doublon) ; jamais pour remettre dans l'ordre un
 * encaissement saisi dans le désordre des dates (ecrireEncaissements, `reimputerDansLOrdreDesDates`). Un compte en écart
 * n'empêche pas l'annulation. Refus, rien n'est écrit : pièce introuvable, d'un autre syndicat (D1), d'une autre famille
 * que celles des encaissements, déjà « Annulé », « Imputé » ; un encaissement de la pièce déjà annulé par un rejet de la
 * banque (à valider), pointé au rapprochement (à valider), ou chèque d'une remise ; motif hors liste ; explication vide ;
 * jour de la correction invalide, d'une année improbable, hors des exercices ouverts, antérieur à la pièce d'origine ou à
 * une pièce de reclassement à contre-passer ; mandat d'un autre syndicat ; un encaissement non annulé postérieur, hors de
 * la pièce, sur un compte de la pièce (à valider) ; une pièce qui porte autre chose que ses encaissements.
 */
export function annulerPieceEncaissementsPourErreur(
  coproprieteId: string,
  pieceId: string,
  { motif, explication, mandatId, aujourdhui = DATE_DU_JOUR_ISO }: SaisieAnnulationPourErreur,
  { actor = null }: OptionsEcriture = {},
): Promise<ResultatAnnulationPourErreur> {
  return ajDb.transaction('rw', tablesEcrites(), async () => {
    const donnees = await lireDonnees(coproprieteId)
    const origine = await pieceAAnnulerPourErreur(pieceId, coproprieteId)
    await verifierJourDeLaCorrection(aujourdhui, origine, coproprieteId)
    const duLot = donnees.encaissements.filter((e) => e.traitementId === origine.id).sort((a, b) => a.rang - b.rang)
    verifierSansEncaissementPosterieur(origine, duLot, donnees, motif)
    // Un encaissement déjà annulé est refusé par le domaine, avant toute lecture de ses pièces de reclassement.
    const entrees = duLot.map((e) => (e.annulation ? { encaissement: e, resultat: resultatGarde(e, imputationDOrigine(e)), piecesDeReclassement: [] } : aContrePasser(e, donnees.pieces)))
    const reclassements = entrees.flatMap((entree) => entree.piecesDeReclassement)
    if (reclassements.length > 0) await verifierDateDeCorrection(`Correction datée du ${dateIsoVersFr(aujourdhui)}`, aujourdhui, coproprieteId, reclassements)
    const annule = annulerPieceEncaissements(
      entrees,
      { ecriture: origine.traitement, comptes: donnees.comptes, segmentSyndicat: segmentComptableSyndicat(donnees.copropriete.code) },
      { id: `annulation-encaissement-${genererId()}`, date: aujourdhui, motif, explication, numeroPiece: origine.numero, correctionId: `correction-${genererId()}` },
    )
    const mandat = mandatId ?? origine.mandatId
    const annulation = await enregistrerPieceTraitement({ traitement: annule.traitement, coproprieteId, mandatId: mandat }, { actor })
    const correction = annule.correction ? await enregistrerPieceTraitement({ traitement: annule.correction, coproprieteId, mandatId: mandat }, { actor }) : null
    const piece = await marquerPieceEncaissementsAnnulee(origine.id, annulation.id, { actor })
    const maintenant = new Date().toISOString()
    const annules: LigneEncaissement[] = []
    for (const [i, avant] of duLot.entries()) {
      const apres: LigneEncaissement = { ...avant, statut: annule.encaissements[i].statut, annulation: annule.encaissements[i].annulation, updatedAt: maintenant, updatedBy: actor }
      await ajDb.encaissements.put(apres)
      await journaliserActivite({ entite: 'encaissements', entiteId: apres.id, action: 'update', qui: actor, avant, apres })
      annules.push(apres)
    }
    const encaissements = donnees.encaissements.map((e) => annules.find((a) => a.id === e.id) ?? e)
    const pieces = donnees.pieces.map((p) => (p.id === piece.id ? piece : p))
    return { piece, annulation, correction, encaissements: annules, postes: etatDe({ ...donnees, pieces, encaissements }).postes }
  })
}
