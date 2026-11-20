import { ajouterJours, ajouterMois, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Budget, Exercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import type { FamilleTraitement, Mouvement, Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import type { OperationTravaux } from '@/lib/administrateur-judiciaire/domain/travaux-operations'
import { planDuCompte } from '@/lib/administrateur-judiciaire/domain/verrou-saisie'
import { FAMILLE_TRAITEMENT, type StatutTravaux } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Annexes 1 à 5 des comptes du syndicat : documents de synthèse soumis à l'approbation des comptes. Fonctions pures,
 * montants en CENTIMES ENTIERS, dates ISO, sans écran ni édition (aucun PDF) : des structures prêtes à afficher, avec
 * leurs contrôles de concordance. Calculées sur les traitements (traitements.ts), les budgets (exercices-budgets.ts) et
 * les opérations de travaux (travaux-operations.ts).
 *
 * Le droit — 🟢 lu sur Légifrance le 20/11/2026 (versions en vigueur à cette date) :
 * - décret n° 2005-240 du 14 mars 2005, art. 8 : les comptes arrêtés à la clôture font l'objet de documents de synthèse
 *   qui « comprennent nécessairement l'état financier, le compte de gestion général [...] et l'état des travaux de
 *   l'article 14-2 [...] votés non encore clôturés », « conformes aux modèles prévus à titre obligatoire aux annexes
 *   n°s 1, 2, 3, 4 et 5 » ; l'état financier « présente l'état des créances et des dettes », la situation de trésorerie
 *   et « le montant des emprunts restant dus » ; les comptes de l'exercice clos sont présentés « avec le budget voté
 *   correspondant à cet exercice et le comparatif des comptes approuvés de l'exercice précédent » ; art. 10 : double
 *   présentation des charges, par nature (annexe 2) et par catégories de charges (annexes 3 et 4, rubriques « arrêtées en
 *   fonction des clauses du règlement de copropriété ») ; « le total des charges pour opérations courantes de l'annexe
 *   n° 3 doit être égal au total des charges de l'annexe n° 2 et le total des charges pour travaux [...] de l'annexe
 *   n° 4 doit être égal au total des charges de l'annexe n° 2 », et de même pour le vote du budget ; art. 4 : charges de
 *   travaux sur plusieurs exercices « comptabilisés au titre de l'exercice au cours duquel les travaux ou prestations
 *   sont réalisés » ; subventions versées sur plusieurs exercices « à mentionner dans l'état des travaux prévus par
 *   l'annexe 5 [...] dès leur notification » ; art. 5 : exercice de douze mois, premier exercice de dix-huit mois au plus,
 *   date de clôture modifiable par décision motivée de l'assemblée ; art. 3 : produits courants « enregistrés à la date
 *   d'exigibilité ». Annexe 3 : version d'origine ; 1 et 2 : modifiées par le décret n° 2016-1914 du 27/12/2016, art. 2
 *   (en vigueur le 01/01/2017 : 105 « Fonds de travaux » à l'annexe 1 ; 705 « Affectation du fonds de travaux » à
 *   l'annexe 2) et par le décret n° 2020-1229 du 7/10/2020, art. 5 (en vigueur le 31/12/2020 : 106 à l'annexe 1 ; 65,
 *   674 et 706 à l'annexe 2) ; 4 et 5 : modifiées par le décret n° 2016-1914, art. 2 (colonnes « PROVISIONS APPELÉES,
 *   EMPRUNTS ET SUBVENTIONS RECUS, AFFECTATION DU FONDS DE TRAVAUX »). Aucune modification postérieure n'est listée.
 * - Les annexes sont « non reproduites » sur Légifrance : les modèles ont été lus sur le fac-similé du JO n° 65 du
 *   18/03/2005, texte n° 7 (PDF téléchargé depuis Légifrance le 20/11/2026), complétés des modifications ci-dessus :
 *   lignes, colonnes, cases grisées et notes de bas de tableau reprises dans les modèles ci-dessous.
 * - arrêté du 14 mars 2005 relatif aux comptes du syndicat, art. 2 (deux balances en concordance, par comptes et par clés
 *   du règlement), art. 7 (nomenclature, version du 31/12/2020), art. 8 (seuls comptes utilisables, subdivisions
 *   admises), art. 9 (aucune compensation entre soldes débiteurs et créditeurs), art. 10 (version du 01/01/2017 : 102
 *   débité par le 702 au fur et à mesure des travaux ; 105 crédité des cotisations et débité par le 705 ; le 12 « reçoit
 *   le solde des opérations [...] qui ne peuvent pas être clôturées en fin d'exercice », repris à l'ouverture, « Son solde
 *   et son détail apparaissent dans l'annexe n° 5 [...]. Son solde est repris dans l'annexe n° 1 » ; 131 crédité à la
 *   notification de la subvention par le 441 ou le 443, produit 711 au fur et à mesure de la charge ; le 47 « doit être
 *   soldé à la fin de l'exercice ou à défaut justifié ligne à ligne » ; emprunts : flux de trésorerie seulement, « Le
 *   montant des annuités restant dû à la clôture [...] est porté sur l'état financier (annexe n° 1) ») ; art. 11 : codes
 *   comptables reproduits « sauf pour l'établissement des annexes n°s 3 et 4 » (les postes portent ici leur code ; à
 *   l'écran de le montrer ou non).
 * - loi n° 65-557, art. 14-3 (version du 01/06/2020) : comptes présentés « avec comparatif des comptes de l'exercice
 *   précédent approuvé » ; charges et produits enregistrés dès leur engagement juridique ; art. 14-1 (version du
 *   01/01/2023) : provisions égales au quart du budget voté ; art. 14-2-1 (version du 01/01/2023) : fonds de travaux.
 *   Les textes comptables citent encore le « II de l'article 14-2 » pour le fonds de travaux, passé à l'art. 14-2-1 par
 *   la loi n° 2021-1104 : les annexes se lisent avec ce renvoi.
 *
 * 🔵 Déduit (choix de calcul, ni imposé ni interdit par les textes) :
 * - classement d'un compte par le PRÉFIXE de son code de plan (planDuCompte), au plus long : 60200 → 602, 62110 → 621
 *   (subdivision 6211, art. 8) ; un compte qu'aucune ligne du modèle ne reçoit devient une ligne « hors modèle » de sa
 *   rubrique (signalée), jamais une ligne perdue ;
 * - annexe 1 : soldes cumulés à la date de clôture, compte par compte (numéro complet) et sans compensation (art. 9) :
 *   un solde débiteur de classe 4 va aux créances, un solde créditeur aux dettes ; classe 5 en trésorerie avec son signe
 *   (note 1 du modèle : « - » pour un découvert) ; classe 1 en provisions et avances avec son signe (le 12 d'une opération
 *   en insuffisance est négatif) ; « après répartition » : les soldes des classes 6 et 7 doivent être nuls, leur reste
 *   est rendu (resultatNonReparti) et contrôlé ; un compte d'une autre classe n'entre dans aucun total (anomalie) ;
 *   liste individualisée (note 2) : comptes et montants, le nom se lit à l'écran ;
 * - annexes 2 à 4 (gestion de l'exercice) : mouvements des classes 6 et 7 datés de l'exercice, SAUF (a) les traitements
 *   « Répartition de charges » et leur annulation (ils répartissent le résultat : sinon le 701 régularisé effacerait le
 *   solde que l'annexe doit montrer) et (b) les traitements qui mouvementent un compte 12 (passage au 12 en fin
 *   d'exercice et reprise à l'ouverture : la reprise ferait revenir dans l'exercice les travaux réalisés avant lui,
 *   décret art. 4) ; charges = débit − crédit, produits = crédit − débit ;
 * - section : charges 661, 67 et 68 → travaux et opérations exceptionnelles, autres charges → opérations courantes (dont
 *   662, absent du modèle : ligne hors modèle) ; produits 701 → courants ; 711, 713, 714 et 716 → travaux s'ils sont
 *   rattachés à une opération (lien travaux ou compte de sa série), courants sinon (décret art. 3 et 4 : affectation
 *   décidée par l'assemblée) ; autres produits → travaux, comme au modèle du décret, y compris le 7061 et le 703, qui
 *   peuvent financer du courant (anomalie section_a_confirmer, 🔴 g) ;
 * - budget (exercices-budgets.ts) : opérations courantes seulement (L. 1965 art. 14-1, II ; D. 1967 art. 44) ; une
 *   ligne de travaux ou une ligne 701 au budget est écartée et signalée ; provisions budgétées (701) = charges prévues −
 *   produits prévus ; budgets N+1 et N+2 : les deux exercices de douze mois qui suivent la clôture ;
 * - annexe 2, cases grisées du modèle : soldes absents des colonnes de budget, et du comparatif N-1 dans la partie
 *   travaux ; colonne de budget sans budget fourni : null, jamais zéro ; partie travaux : budget voté null (🔴) ;
 * - annexe 3 : catégorie = clé de répartition du mouvement (attributs.cle), libellé fourni par l'appelant (règlement de
 *   copropriété) ; toutes les catégories déclarées sont présentées, puis les autres clés, puis « sans clé » (anomalie :
 *   les deux balances de l'art. 2 ne concorderaient plus) ; « produits affectés » = produits courants autres que le 701
 *   (note 2 du modèle) ; postes = codes de plan ; titre complété de l'exercice N+2, comme l'annexe 2 ;
 * - annexe 4 : par opération (lien travaux, ou compte de sa série), puis par clé (celle du mouvement, à défaut la clé
 *   unique de l'opération ; un produit sans clé d'une opération sur plusieurs clés reste « sans clé », sans ventilation
 *   inventée, et le virement du domaine porte la clé : 🔴 f) ; « dépenses votées » = budget TTC voté de l'opération et
 *   de chaque clé ; colonne « provisions appelées, emprunts et subventions reçus, affectation du fonds de travaux » =
 *   produits de l'exercice rattachés (702, 705, 711, 712…) ; lignes « Produits affectés » de chaque clé = ces mêmes
 *   produits, appels compris, d'où « Net » (charges − produits affectés) = −solde (🔴 h) ; solde = produits − dépenses
 *   (positif : excédent) ; opérations présentées : celles qui ont des mouvements dans l'exercice ou qui y ont été votées ;
 *   mouvements de travaux sans opération → opérations exceptionnelles, par clé ;
 * - annexe 5 : opérations votées au plus tard à la clôture dont le statut à cette date (dernier changement de
 *   l'historique daté au plus tard ce jour-là) n'est ni « Réparti » (clôture définitive, décret art. 8), ni « Rejeté »,
 *   ni « Projet » ; A = budget voté et date de la décision ; B = règlements (débits − crédits des comptes 40 rattachés à
 *   l'opération, traitements de la famille « Règlements ») ; C et D = charges et produits rattachés, CUMULÉS depuis
 *   l'origine (mêmes exclusions qu'en gestion) ; E = D − C ; F = solde débiteur des 441 et 443 rattachés, plus les
 *   sommes à recevoir hors comptabilité que fournit l'appelant (emprunt accordé non versé, subvention pluriannuelle) ;
 *   dates = la plus récente des écritures retenues ; le total de E est rapproché du compte 12 de l'annexe 1 (note 2) ;
 * - contrôles : l'équilibre de l'annexe 1, le résultat réparti et le compte 47 portent sur les soldes des comptes à la
 *   clôture ; le compte 12 de l'annexe 1 (soldes) est rapproché du total E de l'annexe 5 (charges et produits rattachés,
 *   hors passage au 12), deux calculs distincts ; les contrôles de l'art. 10 (annexe3_charges_*,
 *   annexe3_solde_*, annexe4_depenses, annexe4_produits) sont vrais par construction : les annexes 3 et 4 se calculent
 *   sur les mêmes flux et budgets que l'annexe 2, chaque flux tombant dans un groupe (clés, puis « sans clé ») ; ce sont
 *   des garde-fous de non-régression du calcul. Ils ne disent rien de la concordance des deux balances, par comptes et
 *   par clés (arrêté, art. 2) : un mouvement sans clé la rompt, et seule l'anomalie mouvement_sans_cle le révèle.
 *
 * 🔴 Non établi — questions pour Hugo (ce que montre Gestéam) et Frédéric :
 * (a) Colonne « budget voté » de la partie travaux de l'annexe 2 : montant voté des opérations, part prévue sur
 *     l'exercice, ou rien ? (VitFix : null.)
 * (b) Le compte de gestion de l'exercice qui suit un passage au 12 reprend-il les travaux des exercices antérieurs
 *     (reprise à l'ouverture) ? (VitFix : non, décret art. 4.)
 * (c) Colonne D de l'annexe 5 et colonne « provisions appelées » de l'annexe 4 : avec J67, R61, l'appel crédite le 102 et
 *     ne passe au 702 qu'à la réalisation ; l'appelé non consommé reste au 102 et n'entre pas dans E (qui doit égaler le
 *     12). VitFix montre D = produits constatés et, à part, le 102 non consommé de l'opération. Gestéam fait-il de même ?
 * (d) Où présenter le 662 (agios), le 409 (fournisseurs débiteurs) et un 1032 (supprimé de l'art. 7 en 2020 mais
 *     toujours au modèle) ? (VitFix : lignes hors modèle ou ligne du modèle à zéro.)
 * (e) « Exercice précédent approuvé » : l'approbation par l'assemblée n'est pas vérifiée ici (la colonne est calculée sur
 *     les écritures de l'exercice précédent) ; le comparatif d'une reprise d'un autre logiciel suppose ses écritures.
 * (f) Branchements à faire hors de ce module : soldeTravauxEnFinDExercice (travaux-operations.ts, non modifié) ne passe
 *     au 12 que le 702 et le 71147 : un 705 (affectation du fonds de travaux) ou un 712 resterait en classe 7, et le
 *     contrôle « résultat réparti » le signalerait ; aucune écriture d'affectation du fonds (105 → 705) n'existe encore
 *     dans le domaine ; virementProvisionsTravauxALaRealisation (travaux-operations.ts) porte désormais la clé de la
 *     charge, exigée pour une opération sur plusieurs clés : son appelant (écriture des factures, non branché) doit faire
 *     un virement par ligne de facture, avec sa clé ; un 702 repris sans clé d'une opération sur plusieurs clés reste
 *     « sans clé » aux annexes 4 (note 3) et 5 (note 1), avec l'anomalie mouvement_sans_cle ; le montant restant dû des
 *     emprunts et les sommes à recevoir hors comptabilité sont des paramètres (aucune table) ; écran et édition des
 *     annexes : Frédéric.
 * (g) Le 7061 et le 703 qui financent du courant : l'arrêté (art. 7, version du 31/12/2020) subdivise le 706 en « 706-1
 *     Provisions sur opérations courantes » et « 706-2 Provisions sur travaux et opérations exceptionnelles », et crédite
 *     le 703 (art. 10) quand les avances 1031 ou 1033 servent au « règlement de dépenses courantes ou imprévues » ; le
 *     modèle du décret ne place le 703 et le 706 qu'en produits pour travaux. Les présenter selon le modèle (VitFix, avec
 *     l'anomalie section_a_confirmer), ou selon leur nature en opérations courantes ? Selon le modèle, une charge courante
 *     financée par un 7061 laisse une insuffisance courante et un excédent travaux de même montant.
 * (h) Annexe 4 : les lignes « Produits affectés » comprennent-elles les appels (702, 705, 712) ? Le modèle de l'annexe 4
 *     n'a pas la note (2) de l'annexe 3 (« Autres que les appels de provisions »). VitFix : oui, d'où « Net » = −solde ;
 *     à défaut, « Net » = charges − autres produits (711, 713, 714…), les appels restant dans la seule colonne.
 * (i) Annexe 2, ligne 65 : le modèle demande de « préciser la nature de chaque opération concernée » (décret n°
 *     2020-1229, art. 5, 2° a) ; VitFix reprend le libellé sans ce détail (aucune donnée de l'opération du conseil
 *     syndical n'est fixée : libellé de l'écriture, compte complet, analytique ?).
 */

// ─── Entrées ─────────────────────────────────────────────────────────────────────────────────

export type PeriodeExercice = Pick<Exercice, 'ouverture' | 'cloture'>

/** Ce que les annexes lisent d'une opération de travaux (travaux-operations.ts). */
export type OperationAnnexes = Pick<
  OperationTravaux,
  'numero' | 'libelle' | 'decision' | 'budgetTtcCentimes' | 'cles' | 'serieComptes' | 'historiqueStatuts'
>

/** Somme à recevoir que la comptabilité ne porte pas encore (emprunt accordé non versé, subvention pluriannuelle). */
export interface ARecevoirHorsComptabilite {
  operation: string
  nature: 'subvention' | 'emprunt'
  montantCentimes: number
  date: string
}

export interface EntreeAnnexes {
  /** Exercice clos (N). */
  exercice: PeriodeExercice
  /** Exercice précédent (N-1), contigu ; null pour le premier exercice. */
  exercicePrecedent: PeriodeExercice | null
  /** Tous les traitements du syndicat (les dates choisissent l'exercice). */
  traitements: readonly Traitement[]
  /** Budgets prévisionnels : voté de l'exercice clos (N), voté en cours (N+1), à voter (N+2) ; null si absent. */
  budgets: { voteN: Budget | null; voteNPlus1: Budget | null; aVoterNPlus2: Budget | null }
  operations: readonly OperationAnnexes[]
  /** Catégories de charges du règlement de copropriété, dans leur ordre : clé de répartition → libellé. */
  categoriesCharges?: readonly { cle: string; libelle: string }[]
  /** Libellés des comptes du plan (code de 5 caractères) ; à défaut, intitulé de la nomenclature (arrêté, art. 7). */
  libellesComptes?: Readonly<Record<string, string>>
  /** Emprunts : montant restant dû (arrêté, art. 10 : hors comptabilité) ; null si le syndicat n'a pas d'emprunt connu. */
  empruntsRestantDus?: { exercicePrecedentCentimes: number | null; exerciceClosCentimes: number } | null
  aRecevoirHorsComptabilite?: readonly ARecevoirHorsComptabilite[]
}

// ─── Sorties ─────────────────────────────────────────────────────────────────────────────────

/** Annexe 1 : exercice précédent approuvé (null au premier exercice) et exercice clos. */
export interface Montants2 {
  exercicePrecedent: number | null
  exerciceClos: number
}

export interface LigneEtatFinancier {
  code: string
  libelle: string
  montants: Montants2
  detail?: LigneEtatFinancier[]
  horsModele?: true
  /** Texte qui a ajouté la ligne au modèle d'origine. */
  source?: string
}

export interface RubriqueEtatFinancier {
  lignes: LigneEtatFinancier[]
  total: Montants2
}

export interface SoldeIndividuel {
  compte: string
  montantCentimes: number
}

export interface Annexe1 {
  intitule: string
  dateCloture: string
  /** I — trésorerie ; total = « Trésorerie disponible, Total I ». */
  tresorerie: RubriqueEtatFinancier
  /** I — provisions et avances. */
  provisionsEtAvances: RubriqueEtatFinancier
  /** II — créances. */
  creances: RubriqueEtatFinancier
  /** II — dettes. */
  dettes: RubriqueEtatFinancier
  /** Total général (I) + (II), côté trésorerie et créances. */
  totalGeneralGauche: Montants2
  /** Total général (I) + (II), côté provisions et dettes. */
  totalGeneralDroite: Montants2
  empruntsRestantDus: Montants2 | null
  /** Note 2 du modèle : « Liste individualisée (nom et montant) ci-jointe » (exercice clos). */
  listesIndividualisees: {
    coproprietairesDebiteurs: SoldeIndividuel[]
    coproprietairesCrediteurs: SoldeIndividuel[]
    creancesDouteuses: SoldeIndividuel[]
    depreciations: SoldeIndividuel[]
  }
  /** Solde (débit − crédit) des classes 6 et 7 à la clôture : nul après répartition. */
  resultatNonReparti: Montants2
}

/** Colonnes des annexes 2 et 3 ; null : sans objet (case grisée, premier exercice, budget non fourni). */
export interface Colonnes {
  /** N-1 : exercice précédent approuvé. */
  precedentApprouve: number | null
  /** N : exercice clos, budget voté. */
  budgetVote: number | null
  /** N : exercice clos, réalisé à approuver. */
  realise: number
  /** N+1 : budget prévisionnel en cours, voté. */
  budgetEnCours: number | null
  /** N+2 : budget prévisionnel à voter. */
  budgetAVoter: number | null
}

export interface LigneGestion {
  code: string
  libelle: string
  valeurs: Colonnes
  detail?: LigneGestion[]
  horsModele?: true
  source?: string
}

export interface PartieGestion {
  lignes: LigneGestion[]
  sousTotal: Colonnes
  /** Charges : excédent affecté aux copropriétaires ; produits : insuffisance. */
  solde: Colonnes
  total: Colonnes
}

export interface Annexe2 {
  intitule: string
  periodeBudgetEnCours: PeriodeExercice
  periodeBudgetAVoter: PeriodeExercice
  operationsCourantes: { charges: PartieGestion; produits: PartieGestion }
  travauxEtOperationsExceptionnelles: { charges: PartieGestion; produits: PartieGestion }
}

export interface PosteAnnexe {
  compte: string
  libelle: string
  valeurs: Colonnes
}

export interface CategorieAnnexe3 {
  /** Clé de répartition ; null : mouvements sans clé (anomalie). */
  cle: string | null
  libelle: string
  charges: PosteAnnexe[]
  totalCharges: Colonnes
  produitsAffectes: PosteAnnexe[]
  totalProduitsAffectes: Colonnes
  net: Colonnes
}

export interface Annexe3 {
  intitule: string
  categories: CategorieAnnexe3[]
  totalChargesNettes: Colonnes
  /** Grisé en N+1 et N+2. */
  provisionsCoproprietaires: Colonnes
  /** Provisions − charges nettes (positif : excédent) ; grisé en budget N, N+1 et N+2. */
  solde: Colonnes
}

export interface PosteRealise {
  compte: string
  libelle: string
  montantCentimes: number
}

export interface MontantsAnnexe4 {
  /** Exercice clos, dépenses votées ; null : rien de voté (opérations exceptionnelles). */
  depensesVotees: number | null
  depenses: number
  /** Provisions appelées, emprunts et subventions reçus, affectation du fonds de travaux. */
  provisionsEtFinancements: number
  /** Excédent (positif) ou insuffisance (négatif). */
  solde: number
}

export interface GroupeCleAnnexe4 {
  cle: string | null
  libelle: string
  charges: PosteRealise[]
  produitsAffectes: PosteRealise[]
  /** Charges − produits affectés. */
  net: number
  montants: MontantsAnnexe4
}

export interface OperationAnnexe4 {
  numero: string
  libelle: string
  decision: { date: string; resolution: string } | null
  cles: GroupeCleAnnexe4[]
  total: MontantsAnnexe4
}

export interface Annexe4 {
  intitule: string
  travaux: OperationAnnexe4[]
  totalTravaux: MontantsAnnexe4
  operationsExceptionnelles: GroupeCleAnnexe4[]
  totalOperationsExceptionnelles: MontantsAnnexe4
  totalGeneral: MontantsAnnexe4
}

export interface MontantDate {
  montantCentimes: number
  /** Écriture la plus récente retenue ; null si aucune. */
  date: string | null
}

export interface CleAnnexe5 {
  cle: string | null
  libelle: string
  votesCentimes: number | null
  realisesCentimes: number
  provisionsEtFinancementsCentimes: number
  soldeEnAttenteCentimes: number
}

export interface LigneAnnexe5 {
  numero: string
  libelle: string
  /** A — travaux votés (montant et date). */
  votes: MontantDate
  /** B — travaux payés. */
  payes: MontantDate
  /** C — travaux réalisés. */
  realises: MontantDate
  /** D — provisions appelées, emprunts et subventions reçus, affectation du fonds de travaux. */
  provisionsEtFinancements: MontantDate
  /** E = D − C — solde en attente sur travaux. */
  soldeEnAttente: number
  /** F — subventions et emprunts à recevoir. */
  aRecevoir: MontantDate
  /** Note 1 du modèle : détail par clé de répartition. */
  parCle: CleAnnexe5[]
  /** Solde créditeur du compte 12 de l'opération à la clôture. */
  soldeCompte12Centimes: number
  /** Appelé au 102 et pas encore viré au 702 (🔴 c). */
  provisionsNonConsommees102Centimes: number
}

export interface Annexe5 {
  intitule: string
  lignes: LigneAnnexe5[]
  total: { votes: number; payes: number; realises: number; provisionsEtFinancements: number; soldeEnAttente: number; aRecevoir: number }
}

export interface ControleAnnexes {
  code: string
  libelle: string
  fondement: string
  attenduCentimes: number
  constateCentimes: number
  ok: boolean
}

export type CodeAnomalieAnnexes =
  | 'ligne_hors_modele'
  | 'compte_hors_nomenclature'
  | 'mouvement_sans_cle'
  | 'budget_hors_operations_courantes'
  | 'budget_ligne_provisions'
  | 'duree_exercice'
  | 'operation_inconnue'
  | 'section_a_confirmer'

export interface AnomalieAnnexes {
  code: CodeAnomalieAnnexes
  message: string
}

export interface ComptesSyndicatAnnexes {
  exercice: PeriodeExercice
  exercicePrecedent: PeriodeExercice | null
  premierExercice: boolean
  annexe1: Annexe1
  annexe2: Annexe2
  annexe3: Annexe3
  annexe4: Annexe4
  annexe5: Annexe5
  controles: ControleAnnexes[]
  anomalies: AnomalieAnnexes[]
}

// ─── Modèles (JO n° 65 du 18/03/2005, texte n° 7, et modifications) ──────────────────────────

interface ModeleLigne {
  code: string
  libelle: string
  /** Préfixes de code de plan reçus par la ligne (feuille) ; absent pour un groupe. */
  prefixes?: readonly string[]
  detail?: readonly ModeleLigne[]
  source?: string
}

const D_2016 = 'Décret n° 2016-1914, art. 2'
const D_2020 = 'Décret n° 2020-1229, art. 5'

const A1_TRESORERIE: readonly ModeleLigne[] = [
  { code: '50', libelle: 'Fonds placés', prefixes: ['50'] },
  { code: '51', libelle: 'Banques ou fonds disponibles en banque', prefixes: ['51'] },
  { code: '53', libelle: 'Caisse', prefixes: ['53'] },
]

const A1_PROVISIONS: readonly ModeleLigne[] = [
  { code: '102', libelle: 'Provisions pour travaux', prefixes: ['102'] },
  {
    code: '103',
    libelle: 'Avances',
    detail: [
      { code: '1031', libelle: 'Avances de trésorerie', prefixes: ['1031'] },
      { code: '1032', libelle: 'Avances travaux', prefixes: ['1032'] },
      { code: '1033', libelle: 'Autres avances', prefixes: ['1033'] },
    ],
  },
  { code: '105', libelle: 'Fonds de travaux', prefixes: ['105'], source: D_2016 },
  {
    code: '106',
    libelle: 'Provisions pour travaux au titre de la délégation de pouvoirs accordée au conseil syndical',
    prefixes: ['106'],
    source: D_2020,
  },
  { code: '131', libelle: "Subventions en instance d'affectation", prefixes: ['131'] },
  { code: '12', libelle: 'Solde en attente sur travaux ou opérations exceptionnelles', prefixes: ['12'] },
]

const A1_CREANCES: readonly ModeleLigne[] = [
  { code: '45', libelle: 'Copropriétaires - Sommes exigibles restant à recevoir', prefixes: ['45'] },
  { code: '459', libelle: 'Copropriétaires - créances douteuses', prefixes: ['459'] },
  { code: '42-44', libelle: 'Autres créances', prefixes: ['42', '43', '44'] },
  { code: '46', libelle: 'Débiteurs divers', prefixes: ['46'] },
  { code: '47', libelle: "Compte d'attente", prefixes: ['47'] },
  { code: '48', libelle: 'Comptes de régularisation', prefixes: ['48'] },
]

const A1_DETTES: readonly ModeleLigne[] = [
  { code: '45', libelle: 'Copropriétaires - excédents versés', prefixes: ['45'] },
  { code: '40', libelle: 'Fournisseurs', prefixes: ['40'] },
  { code: '42-44', libelle: 'Autres dettes', prefixes: ['42', '43', '44'] },
  { code: '46', libelle: 'Créditeurs divers', prefixes: ['46'] },
  { code: '47', libelle: "Compte d'attente", prefixes: ['47'] },
  { code: '48', libelle: 'Comptes de régularisation', prefixes: ['48'] },
  { code: '49', libelle: 'Dépréciation des comptes de tiers', prefixes: ['49'] },
]

const A2_CHARGES_COURANTES: readonly ModeleLigne[] = [
  {
    code: '60',
    libelle: 'Achats de matières et fournitures',
    detail: [
      { code: '601', libelle: 'Eau (compteur général)', prefixes: ['601'] },
      { code: '602', libelle: 'Electricité', prefixes: ['602'] },
      { code: '603', libelle: 'Chauffage, énergie et combustible', prefixes: ['603'] },
      { code: '60X', libelle: 'Autres', prefixes: ['60'] },
    ],
  },
  {
    code: '61',
    libelle: 'Services extérieurs',
    detail: [
      { code: '611', libelle: 'Nettoyage des locaux', prefixes: ['611'] },
      { code: '612', libelle: 'Locations immobilières', prefixes: ['612'] },
      { code: '613', libelle: 'Locations mobilières', prefixes: ['613'] },
      { code: '614', libelle: 'Contrats de maintenance', prefixes: ['614'] },
      { code: '615', libelle: 'Entretien et petites réparations', prefixes: ['615'] },
      { code: '616', libelle: "Primes d'assurance", prefixes: ['616'] },
    ],
  },
  {
    code: '62',
    libelle: "Frais d'administration",
    detail: [
      { code: '621', libelle: 'Rémunérations du syndic sur gestion copropriété', prefixes: ['621'] },
      { code: '622', libelle: 'Autres honoraires du syndic', prefixes: ['622'] },
      { code: '62…', libelle: 'Autres (autres que 621 et 622)', prefixes: ['62'] },
    ],
  },
  { code: '63', libelle: 'Impôts et taxes', prefixes: ['63'] },
  { code: '64', libelle: 'Frais de personnel', prefixes: ['64'] },
  {
    code: '65',
    libelle: "Montant alloué au conseil syndical pour l'exercice de sa délégation de pouvoirs (préciser la nature de chaque opération concernée)",
    prefixes: ['65'],
    source: D_2020,
  },
]

const A2_PRODUITS_COURANTS: readonly ModeleLigne[] = [
  { code: '701', libelle: 'Provisions copropriétaires', prefixes: ['701'] },
  { code: '711', libelle: 'Subventions sur frais de fonctionnement', prefixes: ['711'] },
  { code: '713', libelle: "Indemnités d'assurances", prefixes: ['713'] },
  { code: '714', libelle: 'Produits divers', prefixes: ['714'] },
  { code: '716', libelle: 'Produits financiers', prefixes: ['716'] },
]

const A2_CHARGES_TRAVAUX: readonly ModeleLigne[] = [
  { code: '661', libelle: "Remboursement d'annuités d'emprunt", prefixes: ['661'] },
  { code: '671-673', libelle: 'Travaux', prefixes: ['671', '672', '673'] },
  {
    code: '674',
    libelle: "Charges au titre de la délégation de pouvoirs accordée au conseil syndical en application de l'article 21-1 de la loi",
    prefixes: ['674'],
    source: D_2020,
  },
  { code: '677', libelle: 'Pertes sur créances irrécouvrables', prefixes: ['677'] },
  { code: '678', libelle: 'Charges exceptionnelles', prefixes: ['678'] },
  { code: '68', libelle: 'Dépréciations sur créances douteuses', prefixes: ['68'] },
]

const A2_PRODUITS_TRAVAUX: readonly ModeleLigne[] = [
  { code: '702', libelle: 'Provisions pour travaux', prefixes: ['702'] },
  { code: '703', libelle: 'Avances versées par les copropriétaires', prefixes: ['703'] },
  { code: '704', libelle: "Remboursement d'annuités d'emprunts", prefixes: ['704'] },
  { code: '705', libelle: 'Affectation du fonds de travaux', prefixes: ['705'], source: D_2016 },
  { code: '706', libelle: 'Provisions au titre de la délégation de pouvoirs accordée au conseil syndical', prefixes: ['706'], source: D_2020 },
  {
    code: 'AUTRES',
    libelle: 'Autres produits',
    detail: [
      { code: '711', libelle: 'Subventions sur travaux', prefixes: ['711'] },
      { code: '712', libelle: 'Emprunts à utiliser sur travaux', prefixes: ['712'] },
      { code: '713', libelle: "Indemnités d'assurances", prefixes: ['713'] },
      { code: '714', libelle: 'Produits divers', prefixes: ['714'] },
      { code: '716', libelle: 'Produits financiers', prefixes: ['716'] },
      { code: '718', libelle: 'Produits exceptionnels', prefixes: ['718'] },
    ],
  },
  { code: '78', libelle: 'Reprises de dépréciation sur créances douteuses', prefixes: ['78'] },
]

/** Intitulés des comptes de gestion (arrêté du 14 mars 2005, art. 7, version du 31/12/2020) : libellés des postes. */
const NOMENCLATURE_GESTION: Readonly<Record<string, string>> = {
  '60': 'Achats de matières et fournitures',
  '601': 'Eau',
  '602': 'Electricité',
  '603': 'Chauffage, énergie et combustibles',
  '604': "Achats produits d'entretien et petits équipements",
  '605': 'Matériel',
  '606': 'Fournitures',
  '61': 'Services extérieurs',
  '611': 'Nettoyage des locaux',
  '612': 'Locations immobilières',
  '613': 'Locations mobilières',
  '614': 'Contrats de maintenance',
  '615': 'Entretien et petites réparations',
  '616': "Primes d'assurances",
  '62': "Frais d'administration et honoraires",
  '621': 'Rémunérations du syndic sur gestion copropriété',
  '6211': 'Rémunération du syndic',
  '6212': 'Débours',
  '6213': 'Frais postaux',
  '622': 'Autres honoraires du syndic',
  '6221': 'Honoraires travaux',
  '6222': 'Prestations particulières',
  '6223': 'Autres honoraires',
  '623': 'Rémunérations de tiers intervenants',
  '624': 'Frais du conseil syndical',
  '63': 'Impôts - taxes et versements assimilés',
  '632': 'Taxe de balayage',
  '633': 'Taxe foncière',
  '634': 'Autres impôts et taxes',
  '64': 'Frais de personnel',
  '641': 'Salaires',
  '642': 'Charges sociales et organismes sociaux',
  '643': 'Taxe sur les salaires',
  '644': 'Autres (médecine du travail, mutuelles, etc.)',
  '65': 'Montant spécifique alloué au conseil syndical pour sa délégation de pouvoirs',
  '66': 'Charges financières des emprunts, agios ou autres',
  '661': "Remboursement d'annuités d'emprunt",
  '662': 'Autres charges financières et agios',
  '67': 'Charges pour travaux et opérations exceptionnelles',
  '671': "Travaux décidés par l'assemblée générale",
  '672': 'Travaux urgents',
  '673': 'Etudes techniques, diagnostic, consultation',
  '674': 'Travaux délégués au conseil syndical',
  '677': 'Pertes sur créances irrécouvrables',
  '678': 'Charges exceptionnelles',
  '68': 'Dotations aux dépréciations sur créances douteuses',
  '70': 'Appels de fonds',
  '701': 'Provisions sur opérations courantes',
  '702': "Provisions sur travaux du I de l'article 14-2 et opérations exceptionnelles",
  '703': 'Avances',
  '704': "Remboursements d'annuités d'emprunts",
  '705': 'Affectation du fonds de travaux',
  '706': 'Provisions au titre de la délégation de pouvoirs accordée au conseil syndical',
  '71': 'Autres produits',
  '711': 'Subventions',
  '712': 'Emprunts',
  '713': "Indemnités d'assurances",
  '714': 'Produits divers (dont intérêts légaux dus par les copropriétaires)',
  '716': 'Produits financiers',
  '718': 'Produits exceptionnels',
  '78': 'Reprises de dépréciations sur créances douteuses',
}

// ─── Outils ─────────────────────────────────────────────────────────────────────────────────

const FAMILLES_REPARTITION: ReadonlySet<FamilleTraitement> = new Set<FamilleTraitement>([
  'Répartition de charges',
  'Annulation répartition de charges',
])
const FAMILLES_REGLEMENT: ReadonlySet<string> = new Set<string>(FAMILLE_TRAITEMENT['Règlements'])
const STATUTS_HORS_ANNEXE5: ReadonlySet<StatutTravaux> = new Set<StatutTravaux>(['Réparti', 'Rejeté', 'Projet'])
const SANS_CLE = 'Sans clé de répartition'

const commencePar = (plan: string, prefixes: readonly string[]) => prefixes.some((p) => plan.startsWith(p))
const signe = (m: Mouvement) => (m.sens === 'debit' ? m.montantCentimes : -m.montantCentimes)
const plusRecente = (a: string | null, b: string | null): string | null => (a === null || (b !== null && b > a) ? b : a)

function feuilles(modele: readonly ModeleLigne[]): ModeleLigne[] {
  return modele.flatMap((l) => (l.detail ? feuilles(l.detail) : [l]))
}

/** Ligne du modèle qui reçoit le code de plan : préfixe le plus long ; null hors modèle. */
function ligneDuPlan(plan: string, modele: readonly ModeleLigne[]): string | null {
  let trouve: { code: string; longueur: number } | null = null
  for (const feuille of feuilles(modele))
    for (const prefixe of feuille.prefixes ?? [])
      if (plan.startsWith(prefixe) && (!trouve || prefixe.length > trouve.longueur)) trouve = { code: feuille.code, longueur: prefixe.length }
  return trouve?.code ?? null
}

function intituleDuPlan(plan: string, libelles: Readonly<Record<string, string>> | undefined): string {
  const fourni = libelles?.[plan]
  if (fourni) return fourni
  for (let longueur = plan.length; longueur > 0; longueur -= 1) {
    const intitule = NOMENCLATURE_GESTION[plan.slice(0, longueur)]
    if (intitule) return intitule
  }
  return `Compte ${plan}`
}

function ajouterA(map: Map<string, number>, cle: string, montant: number): void {
  map.set(cle, (map.get(cle) ?? 0) + montant)
}

function verifierCentimes(valeur: number, objet: string, { strict }: { strict: boolean }): void {
  if (!Number.isInteger(valeur) || valeur < 0 || (strict && valeur === 0))
    throw new Error(`${objet} (${valeur}) : centimes entiers ${strict ? 'strictement positifs' : 'positifs ou nuls'} attendus.`)
}

function verifierPeriode({ ouverture, cloture }: PeriodeExercice, objet: string): void {
  for (const date of [ouverture, cloture])
    if (!estDateIsoValide(date)) throw new Error(`${objet} : date invalide (${date}), AAAA-MM-JJ attendu.`)
  if (cloture <= ouverture) throw new Error(`${objet} : date de clôture (${cloture}) antérieure ou égale à l'ouverture (${ouverture}).`)
}

/** Fin d'une période de `mois` mois ouverte le jour donné. */
const finApres = (ouverture: string, mois: number) => ajouterJours(ajouterMois(ouverture, mois), -1)

function periodeSuivante({ cloture }: PeriodeExercice): PeriodeExercice {
  const ouverture = ajouterJours(cloture, 1)
  return { ouverture, cloture: finApres(ouverture, 12) }
}

// ─── Mouvements de gestion ────────────────────────────────────────────────────────────────────

type Section = 'courant' | 'travaux'

interface Flux {
  plan: string
  montant: number
  date: string
  cle: string | null
  operation: string | null
  classe: '6' | '7'
  section: Section
}

const PRODUITS_PARTAGES = ['711', '713', '714', '716']

function sectionDuPlan(plan: string, rattacheAUneOperation: boolean): Section {
  if (plan.startsWith('6')) return commencePar(plan, ['67', '68', '661']) ? 'travaux' : 'courant'
  if (plan.startsWith('701')) return 'courant'
  if (commencePar(plan, PRODUITS_PARTAGES)) return rattacheAUneOperation ? 'travaux' : 'courant'
  return 'travaux'
}

/** Index (code de plan | auxiliaire) → n° d'opération, sur les séries de comptes des opérations. */
function indexDesSeries(operations: readonly OperationAnnexes[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const op of operations) for (const compte of op.serieComptes) index.set(`${compte.planCode}|${compte.auxiliaire}`, op.numero)
  return index
}

function operationDuMouvement(m: Mouvement, series: Map<string, string>): string | null {
  if (m.liens?.travauxId) return m.liens.travauxId
  const [, plan, auxiliaire] = m.compte.split('.')
  if (plan === undefined || auxiliaire === undefined) return null
  return series.get(`${plan}|${auxiliaire}`) ?? null
}

const touche12 = (t: Traitement) => t.mouvements.some((m) => planDuCompte(m.compte).startsWith('12'))
const estDeGestion = (t: Traitement) => !FAMILLES_REPARTITION.has(t.famille) && !touche12(t)

interface Contexte {
  entree: EntreeAnnexes
  series: Map<string, string>
  operations: Map<string, OperationAnnexes>
  anomalies: AnomalieAnnexes[]
}

function signaler(ctx: Contexte, code: CodeAnomalieAnnexes, message: string): void {
  if (!ctx.anomalies.some((a) => a.code === code && a.message === message)) ctx.anomalies.push({ code, message })
}

/** Clé d'un flux : celle du mouvement, à défaut la clé unique de son opération. */
function cleDuFlux(m: Mouvement, operation: string | null, ctx: Contexte): string | null {
  const cle = m.attributs?.cle?.trim()
  if (cle) return cle
  const op = operation === null ? undefined : ctx.operations.get(operation)
  return op?.cles.length === 1 ? op.cles[0].cleId : null
}

/** Flux de gestion d'un mouvement des classes 6 et 7 (null pour une autre classe) ; l'opération n'est gardée qu'en travaux. */
function fluxDuMouvement(ctx: Contexte, m: Mouvement, date: string): Flux | null {
  const plan = planDuCompte(m.compte)
  const classe = plan[0]
  if (classe !== '6' && classe !== '7') return null
  const rattachement = operationDuMouvement(m, ctx.series)
  const section = sectionDuPlan(plan, rattachement !== null)
  const operation = section === 'travaux' ? rattachement : null
  const montant = classe === '6' ? signe(m) : -signe(m)
  return { plan, montant, date, cle: cleDuFlux(m, operation, ctx), operation, classe, section }
}

/** Traitement de gestion daté de la période (du = null : depuis l'origine), hors répartition et hors passage au 12. */
const estDeGestionDansLaPeriode = (t: Traitement, du: string | null, au: string) => t.date <= au && (du === null || t.date >= du) && estDeGestion(t)

/** Mouvements des classes 6 et 7, hors répartition et hors passage au 12, datés de la période (du = null : depuis l'origine). */
function fluxDeGestion(ctx: Contexte, du: string | null, au: string): Flux[] {
  return ctx.entree.traitements
    .filter((t) => estDeGestionDansLaPeriode(t, du, au))
    .flatMap((t) => t.mouvements.map((m) => fluxDuMouvement(ctx, m, t.date)).filter((f): f is Flux => f !== null))
}

function signalerSansCle(ctx: Contexte, flux: readonly Flux[], au: string): void {
  for (const f of flux)
    if (f.cle === null && !f.plan.startsWith('701'))
      signaler(ctx, 'mouvement_sans_cle', `Compte ${f.plan} sans clé de répartition dans l'exercice clos au ${dateIsoVersFr(au)} : catégorie « ${SANS_CLE} » (arrêté du 14 mars 2005, art. 2).`)
}

/** Produits que le modèle du décret range en travaux, mais que l'arrêté rattache aussi au courant (🔴 g). */
const SECTIONS_A_CONFIRMER: readonly { prefixe: string; nature: string }[] = [
  { prefixe: '7061', nature: '706-1 « Provisions sur opérations courantes », arrêté du 14 mars 2005, art. 7' },
  {
    prefixe: '703',
    nature: "703 « Avances », que l'arrêté du 14 mars 2005, art. 10, crédite aussi quand les avances 1031 ou 1033 servent au règlement de dépenses courantes ou imprévues",
  },
]

function signalerSectionsAConfirmer(ctx: Contexte, flux: readonly Flux[], au: string): void {
  for (const f of flux) {
    const regle = SECTIONS_A_CONFIRMER.find((r) => f.plan.startsWith(r.prefixe))
    if (regle)
      signaler(
        ctx,
        'section_a_confirmer',
        `Compte ${f.plan} (${regle.nature}) présenté en produits pour travaux et opérations exceptionnelles, comme au modèle du décret n° 2005-240 (annexe 2), dans l'exercice clos au ${dateIsoVersFr(au)} : présentation à confirmer.`,
      )
  }
}

// ─── Colonnes ─────────────────────────────────────────────────────────────────────────────────

const COLONNES = ['precedentApprouve', 'budgetVote', 'realise', 'budgetEnCours', 'budgetAVoter'] as const
type NomColonne = (typeof COLONNES)[number]
type Disponibles = Record<NomColonne, boolean>

function colonnesA(dispo: Disponibles, valeur: (colonne: NomColonne) => number): Colonnes {
  const v = (colonne: NomColonne) => (dispo[colonne] ? valeur(colonne) : null)
  return {
    precedentApprouve: v('precedentApprouve'),
    budgetVote: v('budgetVote'),
    realise: valeur('realise'),
    budgetEnCours: v('budgetEnCours'),
    budgetAVoter: v('budgetAVoter'),
  }
}

function combiner(a: Colonnes, b: Colonnes, f: (x: number, y: number) => number): Colonnes {
  const v = (x: number | null, y: number | null) => (x === null || y === null ? null : f(x, y))
  return {
    precedentApprouve: v(a.precedentApprouve, b.precedentApprouve),
    budgetVote: v(a.budgetVote, b.budgetVote),
    realise: f(a.realise, b.realise),
    budgetEnCours: v(a.budgetEnCours, b.budgetEnCours),
    budgetAVoter: v(a.budgetAVoter, b.budgetAVoter),
  }
}

const sommeColonnes = (dispo: Disponibles, liste: readonly Colonnes[]): Colonnes =>
  liste.reduce((s, c) => combiner(s, c, (x, y) => x + y), colonnesA(dispo, () => 0))

/** Montants par code de plan, pour chaque colonne disponible. */
type ParColonne = Partial<Record<NomColonne, Map<string, number>>>

// ─── Annexe 1 ─────────────────────────────────────────────────────────────────────────────────

interface EtatALaDate {
  rubriques: Record<'tresorerie' | 'provisions' | 'creances' | 'dettes', Map<string, number>>
  horsModele: Record<'tresorerie' | 'provisions' | 'creances' | 'dettes', Map<string, number>>
  resultat: number
  horsNomenclature: Map<string, number>
  listes: Annexe1['listesIndividualisees']
  attente47: number
}

function soldesAuxComptes(traitements: readonly Traitement[], date: string): Map<string, number> {
  const soldes = new Map<string, number>()
  for (const t of traitements) if (t.date <= date) for (const m of t.mouvements) ajouterA(soldes, m.compte, signe(m))
  return soldes
}

type RubriqueEtat = keyof EtatALaDate['rubriques']

/** Montant porté sur la ligne du modèle qui reçoit le code de plan, ou sur une ligne hors modèle de la rubrique. */
function rangerDansRubrique(etat: EtatALaDate, rubrique: RubriqueEtat, modele: readonly ModeleLigne[], plan: string, montant: number): void {
  const code = ligneDuPlan(plan, modele)
  if (code === null) ajouterA(etat.horsModele[rubrique], plan, montant)
  else ajouterA(etat.rubriques[rubrique], code, montant)
}

/** Classe 4, sans compensation (arrêté, art. 9) : solde débiteur aux créances, créditeur aux dettes ; listes de la note 2. */
function rangerClasse4(etat: EtatALaDate, compte: string, plan: string, solde: number): void {
  if (solde > 0) rangerDansRubrique(etat, 'creances', A1_CREANCES, plan, solde)
  else rangerDansRubrique(etat, 'dettes', A1_DETTES, plan, -solde)
  if (plan.startsWith('47')) etat.attente47 += Math.abs(solde)
  ranger4(etat.listes, compte, plan, solde)
}

/** Solde d'un compte (débit − crédit) porté dans l'état : résultat (classes 6 et 7), rubrique, ou hors nomenclature. */
function rangerSolde(etat: EtatALaDate, compte: string, solde: number): void {
  const plan = planDuCompte(compte)
  const classe = plan[0]
  if (classe === '6' || classe === '7') etat.resultat += solde
  else if (solde === 0) return
  else if (classe === '5') rangerDansRubrique(etat, 'tresorerie', A1_TRESORERIE, plan, solde)
  else if (classe === '1') rangerDansRubrique(etat, 'provisions', A1_PROVISIONS, plan, -solde)
  else if (classe === '4') rangerClasse4(etat, compte, plan, solde)
  else ajouterA(etat.horsNomenclature, plan, solde)
}

function etatALaDate(traitements: readonly Traitement[], date: string): EtatALaDate {
  const vide = () => ({ tresorerie: new Map<string, number>(), provisions: new Map<string, number>(), creances: new Map<string, number>(), dettes: new Map<string, number>() })
  const etat: EtatALaDate = {
    rubriques: vide(),
    horsModele: vide(),
    resultat: 0,
    horsNomenclature: new Map(),
    listes: { coproprietairesDebiteurs: [], coproprietairesCrediteurs: [], creancesDouteuses: [], depreciations: [] },
    attente47: 0,
  }
  const soldes = [...soldesAuxComptes(traitements, date)].sort(([a], [b]) => a.localeCompare(b))
  for (const [compte, solde] of soldes) rangerSolde(etat, compte, solde)
  return etat
}

function ranger4(listes: Annexe1['listesIndividualisees'], compte: string, plan: string, solde: number): void {
  if (plan.startsWith('459')) {
    if (solde > 0) listes.creancesDouteuses.push({ compte, montantCentimes: solde })
  } else if (plan.startsWith('45')) {
    if (solde > 0) listes.coproprietairesDebiteurs.push({ compte, montantCentimes: solde })
    else listes.coproprietairesCrediteurs.push({ compte, montantCentimes: -solde })
  } else if (plan.startsWith('49') && solde < 0) listes.depreciations.push({ compte, montantCentimes: -solde })
}

function lignesEtat(
  modele: readonly ModeleLigne[],
  precedent: Map<string, number> | null,
  clos: Map<string, number>,
): LigneEtatFinancier[] {
  return modele.map((l): LigneEtatFinancier => {
    const source = l.source ? { source: l.source } : {}
    if (l.detail) {
      const detail = lignesEtat(l.detail, precedent, clos)
      return { code: l.code, libelle: l.libelle, montants: sommeMontants(detail.map((d) => d.montants), precedent !== null), detail, ...source }
    }
    return { code: l.code, libelle: l.libelle, montants: { exercicePrecedent: precedent ? (precedent.get(l.code) ?? 0) : null, exerciceClos: clos.get(l.code) ?? 0 }, ...source }
  })
}

function sommeMontants(liste: readonly Montants2[], avecPrecedent: boolean): Montants2 {
  return {
    exercicePrecedent: avecPrecedent ? liste.reduce((s, m) => s + (m.exercicePrecedent ?? 0), 0) : null,
    exerciceClos: liste.reduce((s, m) => s + m.exerciceClos, 0),
  }
}

function rubriqueEtat(
  ctx: Contexte,
  rubrique: keyof EtatALaDate['rubriques'],
  modele: readonly ModeleLigne[],
  precedent: EtatALaDate | null,
  clos: EtatALaDate,
): RubriqueEtatFinancier {
  const lignes = lignesEtat(modele, precedent?.rubriques[rubrique] ?? null, clos.rubriques[rubrique])
  const plans = [...new Set([...(precedent?.horsModele[rubrique].keys() ?? []), ...clos.horsModele[rubrique].keys()])].sort((a, b) => a.localeCompare(b))
  for (const plan of plans) {
    lignes.push({
      code: plan,
      libelle: ctx.entree.libellesComptes?.[plan] ?? `Compte ${plan}`,
      montants: { exercicePrecedent: precedent ? (precedent.horsModele[rubrique].get(plan) ?? 0) : null, exerciceClos: clos.horsModele[rubrique].get(plan) ?? 0 },
      horsModele: true,
    })
    signaler(ctx, 'ligne_hors_modele', `État financier : compte ${plan} hors des lignes du modèle (annexe 1), présenté sur une ligne à part.`)
  }
  return { lignes, total: sommeMontants(lignes.map((l) => l.montants), precedent !== null) }
}

/** Emprunts restant dus (paramètre, arrêté art. 10) ; colonne de l'exercice précédent sans objet au premier exercice. */
function empruntsAnnexe1(emprunts: EntreeAnnexes['empruntsRestantDus'], avecPrecedent: boolean): Montants2 | null {
  if (!emprunts) return null
  const exercicePrecedent = avecPrecedent ? emprunts.exercicePrecedentCentimes : null
  return { exercicePrecedent, exerciceClos: emprunts.exerciceClosCentimes }
}

function annexe1(ctx: Contexte): { annexe: Annexe1; attente47: number } {
  const { exercice, exercicePrecedent, traitements, empruntsRestantDus } = ctx.entree
  const clos = etatALaDate(traitements, exercice.cloture)
  const precedent = exercicePrecedent ? etatALaDate(traitements, exercicePrecedent.cloture) : null
  for (const etat of [precedent, clos])
    for (const [plan, solde] of etat?.horsNomenclature ?? [])
      signaler(ctx, 'compte_hors_nomenclature', `Compte ${plan} (solde ${solde} centimes) hors des classes 1, 4, 5, 6 et 7 de l'arrêté du 14 mars 2005 (art. 7 et 8) : absent de l'état financier.`)
  const tresorerie = rubriqueEtat(ctx, 'tresorerie', A1_TRESORERIE, precedent, clos)
  const provisionsEtAvances = rubriqueEtat(ctx, 'provisions', A1_PROVISIONS, precedent, clos)
  const creances = rubriqueEtat(ctx, 'creances', A1_CREANCES, precedent, clos)
  const dettes = rubriqueEtat(ctx, 'dettes', A1_DETTES, precedent, clos)
  const avecPrecedent = precedent !== null
  const annexe: Annexe1 = {
    intitule: `État financier après répartition au ${dateIsoVersFr(exercice.cloture)}`,
    dateCloture: exercice.cloture,
    tresorerie,
    provisionsEtAvances,
    creances,
    dettes,
    totalGeneralGauche: sommeMontants([tresorerie.total, creances.total], avecPrecedent),
    totalGeneralDroite: sommeMontants([provisionsEtAvances.total, dettes.total], avecPrecedent),
    empruntsRestantDus: empruntsAnnexe1(empruntsRestantDus, avecPrecedent),
    listesIndividualisees: clos.listes,
    resultatNonReparti: { exercicePrecedent: precedent ? precedent.resultat : null, exerciceClos: clos.resultat },
  }
  return { annexe, attente47: clos.attente47 }
}

// ─── Budgets ──────────────────────────────────────────────────────────────────────────────────

interface BudgetLu {
  charges: { plan: string; cle: string; montant: number }[]
  produits: { plan: string; cle: string; montant: number }[]
  provisions: number
}

function lireBudget(ctx: Contexte, budget: Budget, nom: string): BudgetLu {
  const lu: BudgetLu = { charges: [], produits: [], provisions: 0 }
  for (const l of budget.lignes) {
    const plan = l.compte
    const entree = { plan, cle: l.cle, montant: l.prevuCentimes }
    if (plan.startsWith('701')) {
      signaler(ctx, 'budget_ligne_provisions', `Budget ${nom} : ligne 701 « ${l.rubrique} » écartée ; les provisions se déduisent des charges et produits prévus.`)
      continue
    }
    const classe = plan[0]
    if ((classe === '6' || classe === '7') && sectionDuPlan(plan, false) === 'courant') (classe === '6' ? lu.charges : lu.produits).push(entree)
    else signaler(ctx, 'budget_hors_operations_courantes', `Budget ${nom} : ligne ${plan} « ${l.rubrique} » écartée ; le budget prévisionnel ne porte que les opérations courantes (L. 1965 art. 14-1 ; D. 1967 art. 44).`)
  }
  lu.provisions = lu.charges.reduce((s, x) => s + x.montant, 0) - lu.produits.reduce((s, x) => s + x.montant, 0)
  return lu
}

// ─── Annexe 2 ─────────────────────────────────────────────────────────────────────────────────

interface ClassementGestion {
  parLigne: Map<string, number>
  horsModele: Map<string, number>
}

function classer(entrees: readonly { plan: string; montant: number }[], modele: readonly ModeleLigne[]): ClassementGestion {
  const resultat: ClassementGestion = { parLigne: new Map(), horsModele: new Map() }
  for (const { plan, montant } of entrees) {
    const code = ligneDuPlan(plan, modele)
    if (code === null) ajouterA(resultat.horsModele, plan, montant)
    else ajouterA(resultat.parLigne, code, montant)
  }
  return resultat
}

type ClassementsParColonne = Partial<Record<NomColonne, ClassementGestion>>

function lignesGestion(modele: readonly ModeleLigne[], dispo: Disponibles, classements: ClassementsParColonne): LigneGestion[] {
  return modele.map((l): LigneGestion => {
    const source = l.source ? { source: l.source } : {}
    if (l.detail) {
      const detail = lignesGestion(l.detail, dispo, classements)
      return { code: l.code, libelle: l.libelle, valeurs: sommeColonnes(dispo, detail.map((d) => d.valeurs)), detail, ...source }
    }
    return { code: l.code, libelle: l.libelle, valeurs: colonnesA(dispo, (c) => classements[c]?.parLigne.get(l.code) ?? 0), ...source }
  })
}

function partieGestion(
  ctx: Contexte,
  intitulePartie: string,
  modele: readonly ModeleLigne[],
  dispo: Disponibles,
  classements: ClassementsParColonne,
): Omit<PartieGestion, 'solde' | 'total'> {
  const lignes = lignesGestion(modele, dispo, classements)
  const plans = [...new Set(COLONNES.flatMap((c) => [...(classements[c]?.horsModele.keys() ?? [])]))].sort((a, b) => a.localeCompare(b))
  for (const plan of plans) {
    lignes.push({ code: plan, libelle: intituleDuPlan(plan, ctx.entree.libellesComptes), valeurs: colonnesA(dispo, (c) => classements[c]?.horsModele.get(plan) ?? 0), horsModele: true })
    signaler(ctx, 'ligne_hors_modele', `Compte de gestion général, ${intitulePartie} : compte ${plan} hors des lignes du modèle (annexe 2), présenté sur une ligne à part.`)
  }
  return { lignes, sousTotal: sommeColonnes(dispo, lignes.map((l) => l.valeurs)) }
}

/** Disponibilité des colonnes d'une ligne déjà calculée (null : sans objet). */
const dispoDe = (c: Colonnes): Disponibles => ({
  precedentApprouve: c.precedentApprouve !== null,
  budgetVote: c.budgetVote !== null,
  realise: true,
  budgetEnCours: c.budgetEnCours !== null,
  budgetAVoter: c.budgetAVoter !== null,
})

/**
 * Solde porté d'un côté (excédent côté charges, insuffisance côté produits), seulement dans les colonnes `avecSolde`
 * (ailleurs, case grisée : null) ; total = sous-total + solde.
 */
function soldeEtTotal(
  partie: Omit<PartieGestion, 'solde' | 'total'>,
  autre: Omit<PartieGestion, 'solde' | 'total'>,
  avecSolde: Disponibles,
): PartieGestion {
  const solde = colonnesA(avecSolde, (c) => Math.max((autre.sousTotal[c] ?? 0) - (partie.sousTotal[c] ?? 0), 0))
  const total = colonnesA(dispoDe(partie.sousTotal), (c) => (partie.sousTotal[c] ?? 0) + (solde[c] ?? 0))
  return { ...partie, solde, total }
}

interface DonneesGestion {
  dispo: Disponibles
  courant: { charges: ParColonne; produits: ParColonne }
  travaux: { charges: ParColonne; produits: ParColonne }
  /** Flux par colonne réalisée (N-1, N), pour les annexes 3 et 4. */
  fluxRealise: Flux[]
  fluxPrecedent: Flux[] | null
  budgets: Partial<Record<'budgetVote' | 'budgetEnCours' | 'budgetAVoter', BudgetLu>>
}

function parPlan(entrees: readonly { plan: string; montant: number }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const { plan, montant } of entrees) ajouterA(map, plan, montant)
  return map
}

function donneesGestion(ctx: Contexte): DonneesGestion {
  const { exercice, exercicePrecedent, budgets } = ctx.entree
  const fluxRealise = fluxDeGestion(ctx, exercice.ouverture, exercice.cloture)
  const fluxPrecedent = exercicePrecedent ? fluxDeGestion(ctx, exercicePrecedent.ouverture, exercicePrecedent.cloture) : null
  for (const [flux, au] of [[fluxRealise, exercice.cloture], [fluxPrecedent, exercicePrecedent?.cloture]] as const) {
    if (!flux || !au) continue
    signalerSansCle(ctx, flux, au)
    signalerSectionsAConfirmer(ctx, flux, au)
  }
  const lus: DonneesGestion['budgets'] = {}
  if (budgets.voteN) lus.budgetVote = lireBudget(ctx, budgets.voteN, 'voté de l’exercice clos')
  if (budgets.voteNPlus1) lus.budgetEnCours = lireBudget(ctx, budgets.voteNPlus1, 'en cours')
  if (budgets.aVoterNPlus2) lus.budgetAVoter = lireBudget(ctx, budgets.aVoterNPlus2, 'à voter')
  const dispo: Disponibles = {
    precedentApprouve: fluxPrecedent !== null,
    budgetVote: lus.budgetVote !== undefined,
    realise: true,
    budgetEnCours: lus.budgetEnCours !== undefined,
    budgetAVoter: lus.budgetAVoter !== undefined,
  }
  const filtre = (flux: readonly Flux[], section: Section, classe: '6' | '7') =>
    parPlan(flux.filter((f) => f.section === section && f.classe === classe))
  const donnees: DonneesGestion = {
    dispo,
    courant: { charges: { realise: filtre(fluxRealise, 'courant', '6') }, produits: { realise: filtre(fluxRealise, 'courant', '7') } },
    travaux: { charges: { realise: filtre(fluxRealise, 'travaux', '6') }, produits: { realise: filtre(fluxRealise, 'travaux', '7') } },
    fluxRealise,
    fluxPrecedent,
    budgets: lus,
  }
  if (fluxPrecedent) {
    donnees.courant.charges.precedentApprouve = filtre(fluxPrecedent, 'courant', '6')
    donnees.courant.produits.precedentApprouve = filtre(fluxPrecedent, 'courant', '7')
    donnees.travaux.charges.precedentApprouve = filtre(fluxPrecedent, 'travaux', '6')
    donnees.travaux.produits.precedentApprouve = filtre(fluxPrecedent, 'travaux', '7')
  }
  for (const colonne of ['budgetVote', 'budgetEnCours', 'budgetAVoter'] as const) {
    const lu = lus[colonne]
    if (!lu) continue
    donnees.courant.charges[colonne] = parPlan(lu.charges)
    donnees.courant.produits[colonne] = parPlan([...lu.produits, { plan: '70100', montant: lu.provisions }])
  }
  return donnees
}

function classerColonnes(par: ParColonne, modele: readonly ModeleLigne[]): ClassementsParColonne {
  const resultat: ClassementsParColonne = {}
  for (const colonne of COLONNES) {
    const map = par[colonne]
    if (map) resultat[colonne] = classer([...map].map(([plan, montant]) => ({ plan, montant })), modele)
  }
  return resultat
}

function annexe2(ctx: Contexte, d: DonneesGestion): Annexe2 {
  const { exercice } = ctx.entree
  const enCours = periodeSuivante(exercice)
  const aVoter = periodeSuivante(enCours)
  const dispoTravaux: Disponibles = { precedentApprouve: d.dispo.precedentApprouve, budgetVote: false, realise: true, budgetEnCours: false, budgetAVoter: false }
  const soldeCourant: Disponibles = { precedentApprouve: d.dispo.precedentApprouve, budgetVote: false, realise: true, budgetEnCours: false, budgetAVoter: false }
  const soldeTravaux: Disponibles = { precedentApprouve: false, budgetVote: false, realise: true, budgetEnCours: false, budgetAVoter: false }
  const chargesC = partieGestion(ctx, 'charges pour opérations courantes', A2_CHARGES_COURANTES, d.dispo, classerColonnes(d.courant.charges, A2_CHARGES_COURANTES))
  const produitsC = partieGestion(ctx, 'produits pour opérations courantes', A2_PRODUITS_COURANTS, d.dispo, classerColonnes(d.courant.produits, A2_PRODUITS_COURANTS))
  const chargesT = partieGestion(ctx, 'charges pour travaux et opérations exceptionnelles', A2_CHARGES_TRAVAUX, dispoTravaux, classerColonnes(d.travaux.charges, A2_CHARGES_TRAVAUX))
  const produitsT = partieGestion(ctx, 'produits pour travaux et opérations exceptionnelles', A2_PRODUITS_TRAVAUX, dispoTravaux, classerColonnes(d.travaux.produits, A2_PRODUITS_TRAVAUX))
  return {
    intitule: `Compte de gestion général de l'exercice clos réalisé du ${dateIsoVersFr(exercice.ouverture)} au ${dateIsoVersFr(exercice.cloture)} et budget prévisionnel de l'exercice du ${dateIsoVersFr(aVoter.ouverture)} au ${dateIsoVersFr(aVoter.cloture)}`,
    periodeBudgetEnCours: enCours,
    periodeBudgetAVoter: aVoter,
    operationsCourantes: { charges: soldeEtTotal(chargesC, produitsC, soldeCourant), produits: soldeEtTotal(produitsC, chargesC, soldeCourant) },
    travauxEtOperationsExceptionnelles: { charges: soldeEtTotal(chargesT, produitsT, soldeTravaux), produits: soldeEtTotal(produitsT, chargesT, soldeTravaux) },
  }
}

// ─── Annexe 3 ─────────────────────────────────────────────────────────────────────────────────

/** Catégories déclarées (ordre du règlement), puis les autres clés rencontrées, puis « sans clé ». */
function ordreDesCles(ctx: Contexte, cles: Iterable<string | null>): (string | null)[] {
  const declarees = (ctx.entree.categoriesCharges ?? []).map((k) => k.cle)
  const vues = new Set(cles)
  const autres = [...vues].filter((k): k is string => k !== null && !declarees.includes(k)).sort((a, b) => a.localeCompare(b))
  return [...declarees, ...autres, ...(vues.has(null) ? [null] : [])]
}

function libelleCle(ctx: Contexte, cle: string | null): string {
  if (cle === null) return SANS_CLE
  return ctx.entree.categoriesCharges?.find((k) => k.cle === cle)?.libelle ?? cle
}

interface EntreeCategorie {
  cle: string | null
  plan: string
  montant: number
}

function postes(
  ctx: Contexte,
  dispo: Disponibles,
  parColonne: Partial<Record<NomColonne, EntreeCategorie[]>>,
  cle: string | null,
): PosteAnnexe[] {
  const valeurs = new Map<string, Partial<Record<NomColonne, number>>>()
  for (const colonne of COLONNES)
    for (const e of parColonne[colonne] ?? []) {
      if (e.cle !== cle) continue
      const ligne = valeurs.get(e.plan) ?? {}
      ligne[colonne] = (ligne[colonne] ?? 0) + e.montant
      valeurs.set(e.plan, ligne)
    }
  return [...valeurs.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([plan, v]) => ({ compte: plan, libelle: intituleDuPlan(plan, ctx.entree.libellesComptes), valeurs: colonnesA(dispo, (c) => v[c] ?? 0) }))
}

function annexe3(ctx: Contexte, d: DonneesGestion): Annexe3 {
  const { exercice } = ctx.entree
  const versEntrees = (flux: readonly Flux[], classe: '6' | '7'): EntreeCategorie[] =>
    flux.filter((f) => f.section === 'courant' && f.classe === classe && !f.plan.startsWith('701')).map(({ cle, plan, montant }) => ({ cle, plan, montant }))
  const charges: Partial<Record<NomColonne, EntreeCategorie[]>> = { realise: versEntrees(d.fluxRealise, '6') }
  const produits: Partial<Record<NomColonne, EntreeCategorie[]>> = { realise: versEntrees(d.fluxRealise, '7') }
  if (d.fluxPrecedent) {
    charges.precedentApprouve = versEntrees(d.fluxPrecedent, '6')
    produits.precedentApprouve = versEntrees(d.fluxPrecedent, '7')
  }
  for (const colonne of ['budgetVote', 'budgetEnCours', 'budgetAVoter'] as const) {
    const lu = d.budgets[colonne]
    if (!lu) continue
    charges[colonne] = lu.charges
    produits[colonne] = lu.produits
  }
  const cles = COLONNES.flatMap((c) => [...(charges[c] ?? []), ...(produits[c] ?? [])].map((e) => e.cle))
  const categories = ordreDesCles(ctx, cles).map((cle): CategorieAnnexe3 => {
    const ch = postes(ctx, d.dispo, charges, cle)
    const pr = postes(ctx, d.dispo, produits, cle)
    const totalCharges = sommeColonnes(d.dispo, ch.map((p) => p.valeurs))
    const totalProduitsAffectes = sommeColonnes(d.dispo, pr.map((p) => p.valeurs))
    return { cle, libelle: libelleCle(ctx, cle), charges: ch, totalCharges, produitsAffectes: pr, totalProduitsAffectes, net: combiner(totalCharges, totalProduitsAffectes, (x, y) => x - y) }
  })
  const totalChargesNettes = sommeColonnes(d.dispo, categories.map((k) => k.net))
  const provisions701 = (c: NomColonne): number => {
    if (c === 'realise' || c === 'precedentApprouve')
      return [...(d.courant.produits[c] ?? new Map<string, number>())].filter(([plan]) => plan.startsWith('701')).reduce((s, [, m]) => s + m, 0)
    return d.budgets[c]?.provisions ?? 0
  }
  const dispoProvisions: Disponibles = { ...d.dispo, budgetEnCours: false, budgetAVoter: false }
  const provisionsCoproprietaires = colonnesA(dispoProvisions, provisions701)
  const dispoSolde: Disponibles = { ...dispoProvisions, budgetVote: false }
  const aVoter = periodeSuivante(periodeSuivante(exercice))
  return {
    intitule: `Compte de gestion pour opérations courantes de l'exercice clos réalisé du ${dateIsoVersFr(exercice.ouverture)} au ${dateIsoVersFr(exercice.cloture)} et budget prévisionnel de l'exercice du ${dateIsoVersFr(aVoter.ouverture)} au ${dateIsoVersFr(aVoter.cloture)}`,
    categories,
    totalChargesNettes,
    provisionsCoproprietaires,
    solde: colonnesA(dispoSolde, (c) => provisions701(c) - (totalChargesNettes[c] ?? 0)),
  }
}

// ─── Annexe 4 ─────────────────────────────────────────────────────────────────────────────────

function postesRealises(ctx: Contexte, flux: readonly Flux[]): PosteRealise[] {
  return [...parPlan(flux)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([plan, montant]) => ({ compte: plan, libelle: intituleDuPlan(plan, ctx.entree.libellesComptes), montantCentimes: montant }))
}

function groupe4(ctx: Contexte, cle: string | null, flux: readonly Flux[], depensesVotees: number | null): GroupeCleAnnexe4 {
  const siens = flux.filter((f) => f.cle === cle)
  const charges = postesRealises(ctx, siens.filter((f) => f.classe === '6'))
  const produitsAffectes = postesRealises(ctx, siens.filter((f) => f.classe === '7'))
  const depenses = charges.reduce((s, p) => s + p.montantCentimes, 0)
  const provisionsEtFinancements = produitsAffectes.reduce((s, p) => s + p.montantCentimes, 0)
  return {
    cle,
    libelle: libelleCle(ctx, cle),
    charges,
    produitsAffectes,
    net: depenses - provisionsEtFinancements,
    montants: { depensesVotees, depenses, provisionsEtFinancements, solde: provisionsEtFinancements - depenses },
  }
}

function sommeAnnexe4(liste: readonly MontantsAnnexe4[]): MontantsAnnexe4 {
  const votees = liste.map((m) => m.depensesVotees).filter((v): v is number => v !== null)
  return {
    depensesVotees: votees.length ? votees.reduce((s, v) => s + v, 0) : null,
    depenses: liste.reduce((s, m) => s + m.depenses, 0),
    provisionsEtFinancements: liste.reduce((s, m) => s + m.provisionsEtFinancements, 0),
    solde: liste.reduce((s, m) => s + m.solde, 0),
  }
}

/** Clés présentées pour une opération : celles de l'opération, puis les autres clés de ses flux (« sans clé » en dernier). */
function clesPresentees(ctx: Contexte, clesOperation: readonly string[], siens: readonly Flux[]): (string | null)[] {
  const vues = ordreDesCles(ctx, siens.map((f) => f.cle)).filter((k) => siens.some((f) => f.cle === k))
  return [...new Set<string | null>([...clesOperation, ...vues])]
}

/** Annexe 4, une opération (notes 2 et 3 du modèle) : ses flux de travaux de l'exercice, par clé. */
function operationAnnexe4(ctx: Contexte, numero: string, travaux: readonly Flux[]): OperationAnnexe4 {
  const op = ctx.operations.get(numero)
  if (!op) signaler(ctx, 'operation_inconnue', `Mouvements rattachés à l'opération ${numero}, absente des opérations fournies : dépenses votées inconnues.`)
  const siens = travaux.filter((f) => f.operation === numero)
  const votee = op?.decision ? op : null
  const votesDeLaCle = (cle: string | null) => votee?.cles.find((k) => k.cleId === cle)?.budgetTtcCentimes ?? null
  const groupes = clesPresentees(ctx, op?.cles.map((k) => k.cleId) ?? [], siens).map((cle) => groupe4(ctx, cle, siens, votesDeLaCle(cle)))
  return {
    numero,
    libelle: op?.libelle ?? `Opération ${numero}`,
    decision: votee?.decision ? { date: votee.decision.date, resolution: votee.decision.resolution } : null,
    cles: groupes,
    total: { ...sommeAnnexe4(groupes.map((g) => g.montants)), depensesVotees: votee ? votee.budgetTtcCentimes : null },
  }
}

const voteeDansLExercice = (op: OperationAnnexes, { ouverture, cloture }: PeriodeExercice) =>
  op.decision !== null && op.decision.date >= ouverture && op.decision.date <= cloture

function annexe4(ctx: Contexte, d: DonneesGestion): Annexe4 {
  const { exercice } = ctx.entree
  const travaux = d.fluxRealise.filter((f) => f.section === 'travaux')
  const numeros = new Set(travaux.flatMap((f) => (f.operation === null ? [] : [f.operation])))
  for (const op of ctx.operations.values()) if (voteeDansLExercice(op, exercice)) numeros.add(op.numero)
  const operations = [...numeros].sort((a, b) => a.localeCompare(b)).map((numero) => operationAnnexe4(ctx, numero, travaux))
  const exceptionnels = travaux.filter((f) => f.operation === null)
  const operationsExceptionnelles = ordreDesCles(ctx, exceptionnels.map((f) => f.cle))
    .filter((cle) => exceptionnels.some((f) => f.cle === cle))
    .map((cle) => groupe4(ctx, cle, exceptionnels, null))
  const totalTravaux = sommeAnnexe4(operations.map((o) => o.total))
  const totalOperationsExceptionnelles = sommeAnnexe4(operationsExceptionnelles.map((g) => g.montants))
  return {
    intitule: `Compte de gestion pour travaux de l'article 14-2 et opérations exceptionnelles hors budget prévisionnel de l'exercice clos réalisés du ${dateIsoVersFr(exercice.ouverture)} au ${dateIsoVersFr(exercice.cloture)}`,
    travaux: operations,
    totalTravaux,
    operationsExceptionnelles,
    totalOperationsExceptionnelles,
    totalGeneral: sommeAnnexe4([totalTravaux, totalOperationsExceptionnelles]),
  }
}

// ─── Annexe 5 ─────────────────────────────────────────────────────────────────────────────────

/** Statut à une date : dernier changement de l'historique daté au plus tard ce jour-là (🔵). */
function statutALaDate(op: OperationAnnexes, date: string): StatutTravaux | null {
  let statut: StatutTravaux | null = null
  for (const changement of op.historiqueStatuts) if (changement.le <= date) statut = changement.vers
  if (statut === null && op.historiqueStatuts.length === 0 && op.decision && op.decision.date <= date) return 'Adopté'
  return statut
}

/** Somme signée (débit positif) et date la plus récente des mouvements retenus, jusqu'à la date. */
function cumulRattache(
  ctx: Contexte,
  numero: string,
  au: string,
  retenir: (plan: string, t: Traitement) => boolean,
): MontantDate {
  let montantCentimes = 0
  let date: string | null = null
  for (const t of ctx.entree.traitements) {
    if (t.date > au) continue
    for (const m of t.mouvements) {
      const plan = planDuCompte(m.compte)
      if (operationDuMouvement(m, ctx.series) !== numero || !retenir(plan, t)) continue
      montantCentimes += signe(m)
      date = plusRecente(date, t.date)
    }
  }
  return { montantCentimes, date }
}

function ligneAnnexe5(ctx: Contexte, op: OperationAnnexes, flux: readonly Flux[], au: string): LigneAnnexe5 {
  const siens = flux.filter((f) => f.section === 'travaux' && f.operation === op.numero)
  const cumul = (classe: '6' | '7', cle?: string | null): MontantDate =>
    siens
      .filter((f) => f.classe === classe && (cle === undefined || f.cle === cle))
      .reduce<MontantDate>((s, f) => ({ montantCentimes: s.montantCentimes + f.montant, date: plusRecente(s.date, f.date) }), { montantCentimes: 0, date: null })
  const realises = cumul('6')
  const provisionsEtFinancements = cumul('7')
  const payes = cumulRattache(ctx, op.numero, au, (plan, t) => plan.startsWith('40') && FAMILLES_REGLEMENT.has(t.famille))
  const subventions = cumulRattache(ctx, op.numero, au, (plan) => commencePar(plan, ['441', '443']))
  const horsCompta = (ctx.entree.aRecevoirHorsComptabilite ?? []).filter((x) => x.operation === op.numero && x.date <= au)
  const aRecevoir = horsCompta.reduce<MontantDate>(
    (s, x) => ({ montantCentimes: s.montantCentimes + x.montantCentimes, date: plusRecente(s.date, x.date) }),
    subventions.montantCentimes > 0 ? subventions : { montantCentimes: 0, date: null },
  )
  const cles = [...new Set<string | null>([...op.cles.map((k) => k.cleId), ...ordreDesCles(ctx, siens.map((f) => f.cle)).filter((k) => siens.some((f) => f.cle === k))])]
  return {
    numero: op.numero,
    libelle: op.libelle,
    votes: { montantCentimes: op.budgetTtcCentimes, date: op.decision?.date ?? null },
    payes,
    realises,
    provisionsEtFinancements,
    soldeEnAttente: provisionsEtFinancements.montantCentimes - realises.montantCentimes,
    aRecevoir,
    parCle: cles.map((cle) => {
      const r = cumul('6', cle).montantCentimes
      const p = cumul('7', cle).montantCentimes
      return { cle, libelle: libelleCle(ctx, cle), votesCentimes: op.cles.find((k) => k.cleId === cle)?.budgetTtcCentimes ?? null, realisesCentimes: r, provisionsEtFinancementsCentimes: p, soldeEnAttenteCentimes: p - r }
    }),
    soldeCompte12Centimes: -cumulRattache(ctx, op.numero, au, (plan) => plan.startsWith('12')).montantCentimes,
    provisionsNonConsommees102Centimes: -cumulRattache(ctx, op.numero, au, (plan) => plan.startsWith('102')).montantCentimes,
  }
}

function annexe5(ctx: Contexte): Annexe5 {
  const { exercice } = ctx.entree
  const au = exercice.cloture
  const flux = fluxDeGestion(ctx, null, au)
  const lignes = [...ctx.operations.values()]
    .filter((op) => {
      const statut = statutALaDate(op, au)
      return op.decision !== null && op.decision.date <= au && statut !== null && !STATUTS_HORS_ANNEXE5.has(statut)
    })
    .sort((a, b) => a.numero.localeCompare(b.numero))
    .map((op) => ligneAnnexe5(ctx, op, flux, au))
  const total = (f: (l: LigneAnnexe5) => number) => lignes.reduce((s, l) => s + f(l), 0)
  return {
    intitule: `État des travaux de l'article 14-2 et opérations exceptionnelles votés non encore clôturés à la fin de l'exercice du ${dateIsoVersFr(exercice.ouverture)} au ${dateIsoVersFr(au)}`,
    lignes,
    total: {
      votes: total((l) => l.votes.montantCentimes),
      payes: total((l) => l.payes.montantCentimes),
      realises: total((l) => l.realises.montantCentimes),
      provisionsEtFinancements: total((l) => l.provisionsEtFinancements.montantCentimes),
      soldeEnAttente: total((l) => l.soldeEnAttente),
      aRecevoir: total((l) => l.aRecevoir.montantCentimes),
    },
  }
}

// ─── Contrôles ────────────────────────────────────────────────────────────────────────────────

const FONDEMENT_ETAT = 'Décret n° 2005-240, art. 8 ; arrêté du 14 mars 2005, art. 1er (partie double)'
const FONDEMENT_ART10 = 'Décret n° 2005-240, art. 10'
const LIBELLES_COLONNES: Record<NomColonne, [string, string]> = {
  precedentApprouve: ['precedent', 'exercice précédent approuvé'],
  budgetVote: ['budget_vote', 'budget voté de l’exercice clos'],
  realise: ['realise', 'réalisé de l’exercice clos'],
  budgetEnCours: ['budget_en_cours', 'budget prévisionnel en cours'],
  budgetAVoter: ['budget_a_voter', 'budget prévisionnel à voter'],
}

function controle(code: string, libelle: string, fondement: string, attenduCentimes: number, constateCentimes: number): ControleAnnexes {
  return { code, libelle, fondement, attenduCentimes, constateCentimes, ok: attenduCentimes === constateCentimes }
}

function controles(a1: Annexe1, a2: Annexe2, a3: Annexe3, a4: Annexe4, a5: Annexe5, attente47: number): ControleAnnexes[] {
  const liste: ControleAnnexes[] = [
    controle('annexe1_equilibre', 'État financier : total général (I) + (II) égal des deux côtés', FONDEMENT_ETAT, a1.totalGeneralDroite.exerciceClos, a1.totalGeneralGauche.exerciceClos),
  ]
  const { exercicePrecedent: gauche } = a1.totalGeneralGauche
  const { exercicePrecedent: droite } = a1.totalGeneralDroite
  if (gauche !== null && droite !== null)
    liste.push(controle('annexe1_equilibre_precedent', 'État financier, exercice précédent : total général égal des deux côtés', FONDEMENT_ETAT, droite, gauche))
  liste.push(controle('annexe1_resultat_reparti', 'État financier après répartition : classes 6 et 7 soldées à la clôture', 'Décret n° 2005-240, art. 8 ; arrêté du 14 mars 2005, art. 10 (701 et compte 12)', 0, a1.resultatNonReparti.exerciceClos))
  if (a1.resultatNonReparti.exercicePrecedent !== null)
    liste.push(controle('annexe1_resultat_reparti_precedent', 'Exercice précédent : classes 6 et 7 soldées à la clôture', 'Décret n° 2005-240, art. 8 ; arrêté du 14 mars 2005, art. 10', 0, a1.resultatNonReparti.exercicePrecedent))
  const chargesA2 = a2.operationsCourantes.charges.sousTotal
  const chargesA3 = sommeColonnes(dispoDe(chargesA2), a3.categories.map((k) => k.totalCharges))
  for (const colonne of COLONNES) {
    const attendu = chargesA2[colonne]
    const constate = chargesA3[colonne]
    if (attendu === null || constate === null) continue
    const [suffixe, libelle] = LIBELLES_COLONNES[colonne]
    liste.push(controle(`annexe3_charges_${suffixe}`, `Total des charges courantes de l'annexe 3 égal à celui de l'annexe 2 (${libelle})`, FONDEMENT_ART10, attendu, constate))
  }
  for (const colonne of ['precedentApprouve', 'realise'] as const) {
    const excedent = a2.operationsCourantes.charges.solde[colonne]
    const insuffisance = a2.operationsCourantes.produits.solde[colonne]
    const solde3 = a3.solde[colonne]
    if (excedent === null || insuffisance === null || solde3 === null) continue
    const [suffixe, libelle] = LIBELLES_COLONNES[colonne]
    liste.push(controle(`annexe3_solde_${suffixe}`, `Solde des opérations courantes de l'annexe 3 égal à celui de l'annexe 2 (${libelle})`, 'Décret n° 2005-240, art. 8 et 10', excedent - insuffisance, solde3))
  }
  const travaux = a2.travauxEtOperationsExceptionnelles
  liste.push(
    controle('annexe4_depenses', "Total des charges pour travaux et opérations exceptionnelles de l'annexe 4 égal à celui de l'annexe 2", FONDEMENT_ART10, travaux.charges.sousTotal.realise, a4.totalGeneral.depenses),
    controle('annexe4_produits', "Produits pour travaux et opérations exceptionnelles de l'annexe 4 égaux à ceux de l'annexe 2", 'Décret n° 2005-240, art. 8 et 10', travaux.produits.sousTotal.realise, a4.totalGeneral.provisionsEtFinancements),
  )
  const ligne12 = a1.provisionsEtAvances.lignes.find((l) => l.code === '12')?.montants.exerciceClos ?? 0
  liste.push(
    controle('annexe5_compte12', "Solde en attente sur travaux de l'annexe 5 égal au compte 12 de l'annexe 1", 'Décret n° 2005-240, annexe 5, note 2 ; arrêté du 14 mars 2005, art. 10', ligne12, a5.total.soldeEnAttente),
    controle('compte_attente_47', "Compte d'attente soldé à la clôture (à défaut, justifié ligne à ligne)", 'Arrêté du 14 mars 2005, art. 10', 0, attente47),
  )
  return liste
}

// ─── Validation et point d'entrée ─────────────────────────────────────────────────────────────

/** Exercice clos et exercice précédent : dates, contiguïté, durée (décret n° 2005-240, art. 5). */
function verifierExercices({ exercice, exercicePrecedent }: EntreeAnnexes, anomalies: AnomalieAnnexes[]): void {
  verifierPeriode(exercice, 'Exercice clos')
  if (!exercicePrecedent) {
    if (exercice.cloture > finApres(exercice.ouverture, 18))
      throw new Error(`Premier exercice du ${dateIsoVersFr(exercice.ouverture)} au ${dateIsoVersFr(exercice.cloture)} : dix-huit mois au plus (décret n° 2005-240, art. 5).`)
    return
  }
  verifierPeriode(exercicePrecedent, 'Exercice précédent')
  if (ajouterJours(exercicePrecedent.cloture, 1) !== exercice.ouverture)
    throw new Error(`Exercice précédent non contigu : clôture le ${dateIsoVersFr(exercicePrecedent.cloture)}, exercice clos ouvert le ${dateIsoVersFr(exercice.ouverture)}.`)
  if (exercice.cloture !== finApres(exercice.ouverture, 12))
    anomalies.push({
      code: 'duree_exercice',
      message: `Exercice du ${dateIsoVersFr(exercice.ouverture)} au ${dateIsoVersFr(exercice.cloture)} : douze mois attendus (décret n° 2005-240, art. 5), sauf changement de date de clôture décidé par l'assemblée, à justifier.`,
    })
}

/** Ensemble des valeurs, refusé au premier doublon. */
function sansDoublon(valeurs: readonly string[], doublon: (valeur: string) => string): Set<string> {
  const vues = new Set<string>()
  for (const valeur of valeurs) {
    if (vues.has(valeur)) throw new Error(doublon(valeur))
    vues.add(valeur)
  }
  return vues
}

/** Montants fournis hors comptabilité : emprunts restant dus, sommes à recevoir (opération fournie exigée). */
function verifierMontantsHorsCompta(entree: EntreeAnnexes, numeros: ReadonlySet<string>): void {
  if (entree.empruntsRestantDus) {
    const { exercicePrecedentCentimes, exerciceClosCentimes } = entree.empruntsRestantDus
    verifierCentimes(exerciceClosCentimes, 'Emprunts restant dus à la clôture', { strict: false })
    if (exercicePrecedentCentimes !== null) verifierCentimes(exercicePrecedentCentimes, 'Emprunts restant dus à la clôture précédente', { strict: false })
  }
  for (const x of entree.aRecevoirHorsComptabilite ?? []) {
    if (!numeros.has(x.operation)) throw new Error(`Somme à recevoir pour l'opération ${x.operation}, absente des opérations fournies.`)
    verifierCentimes(x.montantCentimes, `Somme à recevoir (${x.nature}) de l'opération ${x.operation}`, { strict: true })
    if (!estDateIsoValide(x.date)) throw new Error(`Somme à recevoir de l'opération ${x.operation} : date invalide (${x.date}), AAAA-MM-JJ attendu.`)
  }
}

function verifierEntree(entree: EntreeAnnexes, anomalies: AnomalieAnnexes[]): void {
  verifierExercices(entree, anomalies)
  const numeros = sansDoublon(
    entree.operations.map((op) => op.numero),
    (numero) => `Opération ${numero} fournie deux fois.`,
  )
  sansDoublon(
    (entree.categoriesCharges ?? []).map((k) => k.cle),
    (cle) => `Catégorie de charges « ${cle} » déclarée deux fois.`,
  )
  verifierMontantsHorsCompta(entree, numeros)
}

/**
 * Annexes 1 à 5 des comptes du syndicat pour l'exercice clos, avec le comparatif de l'exercice précédent, les budgets
 * voté, en cours et à voter, les contrôles de concordance (décret n° 2005-240, art. 8 et 10 ; arrêté du 14 mars 2005,
 * art. 10) et les anomalies relevées. Refuse un exercice invalide, un exercice précédent non contigu, un premier
 * exercice de plus de dix-huit mois, une opération en double, un montant qui n'est pas en centimes entiers.
 */
export function annexesComptesSyndicat(entree: EntreeAnnexes): ComptesSyndicatAnnexes {
  const anomalies: AnomalieAnnexes[] = []
  verifierEntree(entree, anomalies)
  const ctx: Contexte = { entree, series: indexDesSeries(entree.operations), operations: new Map(entree.operations.map((op) => [op.numero, op])), anomalies }
  const { annexe: a1, attente47 } = annexe1(ctx)
  const d = donneesGestion(ctx)
  const a2 = annexe2(ctx, d)
  const a3 = annexe3(ctx, d)
  const a4 = annexe4(ctx, d)
  const a5 = annexe5(ctx)
  return {
    exercice: entree.exercice,
    exercicePrecedent: entree.exercicePrecedent,
    premierExercice: entree.exercicePrecedent === null,
    annexe1: a1,
    annexe2: a2,
    annexe3: a3,
    annexe4: a4,
    annexe5: a5,
    controles: controles(a1, a2, a3, a4, a5, attente47),
    anomalies,
  }
}
