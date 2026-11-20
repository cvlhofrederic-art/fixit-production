import {
  ANNEE_PLANCHER,
  composerDateIso,
  dateIsoVersFr,
  estDateIsoValide,
  joursDansMois,
  verifierAujourdhui,
} from '@/lib/administrateur-judiciaire/domain/dates'
import { balance } from '@/lib/administrateur-judiciaire/domain/etats-comptables'
import type { LigneFacture } from '@/lib/administrateur-judiciaire/domain/facture-ventilee'
import { REPARTITION_FICHE_MANDAT_GESTEAM } from '@/lib/administrateur-judiciaire/domain/mandat-judiciaire'
import { formaterNumeroCompte } from '@/lib/administrateur-judiciaire/domain/plan-comptable'
import {
  creerTraitement,
  type AttributsMouvement,
  type FamilleTraitement,
  type LigneMouvement,
  type SensMouvement,
  type Traitement,
} from '@/lib/administrateur-judiciaire/domain/traitements'
import { MODE_REGLEMENT, QUALITE_IDENTITE, type ModeReglement, type TypeEntreprise } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Personnel du syndicat : constatation et règlement de la paie (point 42 du bilan, vague 7). Fonctions pures, montants
 * en CENTIMES ENTIERS, dates ISO, sans écran ni table, sans donnée personnelle (identifiants seulement). Les échéances
 * de l'employeur (DSN, santé au travail, DUERP, salaire, taxe sur les salaires) sont dans echeances-employeur.ts.
 *
 * Gestéam —
 * - 🟢 tranche 43 § 10 : les salaires du personnel du syndicat (gardien, employé d'immeuble) sont réglés comme des
 *   factures, sur un compte fournisseur 401 au nom du salarié et un contrat « Prestation » ; la tranche conclut que VitFix
 *   ne doit pas traiter un salaire comme une facture ordinaire ;
 * - 🟢 tranche 43 § 19 : rôle GED « Gardien / employé d'immeuble », 9 types propres (dont Déclaration DSN, DUERP, Salaire
 *   et charges sociales) ; tranche 18 § 4 : famille de documents « Employeur », 7 types relevés (échantillon non
 *   exhaustif : « La liste complète n'a pas été relevée ligne à ligne »), et « No … » des particularités = identifiants du
 *   syndicat employeur ; tranche 25 : identifiants de la fiche mandat (URSSAF, Taxe salaire, Caisse retraite) ;
 * - 🟢 tranche 13 : plage 42000 à 42150 (Personnel, Rémunérations dues, Acomptes, Avances sur salaires), analytiques 010
 *   à 056 du personnel ; tranche 21 : 8 entrées 42xxx-43xxx et 13 entrées 64xxx ; tranche 24 § 5 : analytique 010
 *   « salaires gardien », compte plan 64100, rubrique 010, récupérable 75 %.
 *
 * Le droit — 🟢 lu sur Légifrance le 30/10/2026 :
 * - arrêté du 14 mars 2005 (version en vigueur depuis le 31/12/2020), art. 7 : « 42 Personnel : 421 Rémunérations
 *   dues » ; « 431 Sécurité sociale », « 432 Autres organismes sociaux » ; « 442 Etat - impôts et versements
 *   assimilés » ; « 64 Frais de personnel : 641 Salaires, 642 Charges sociales et organismes sociaux, 643 Taxe sur les
 *   salaires, 644 Autres (médecine du travail, mutuelles, etc.) » ; art. 3 : les opérations sont enregistrées « dans les
 *   comptes dont l'intitulé correspond à leur nature » ; art. 4 : tout enregistrement identifie sa pièce, « date et
 *   référence du paiement » ; art. 8 : ces comptes sont les seuls utilisables, le syndicat « peut ouvrir toute subdivision
 *   nécessaire », les règles du plan comptable général ne peuvent pas détailler ces comptes ; art. 10 : le 401 enregistre
 *   « les factures et mémoires d'achats de biens et services » ; l'art. 10 ne donne AUCUNE règle de fonctionnement
 *   (débit, crédit, contrepartie) pour les comptes 42, 43, 442 et 64 (dans la classe 44, il ne fait fonctionner que les
 *   441 et 443, débités en contrepartie du 131 à la notification d'une subvention) ;
 * - décret n° 67-223, art. 31 : le syndic engage et congédie le personnel ; « L'assemblée générale a seule qualité pour
 *   fixer le nombre et la catégorie des emplois » ; annexe 1 (contrat type), VI-22° « Paiement du salaire, tenue du livre
 *   des salaires, édition des bulletins de paies » et VI-23° « Déclarations et paiement aux organismes fiscaux et
 *   sociaux » : prestations du forfait ;
 * - convention collective IDCC 1043, art. 1er (« En vigueur étendu ») : en copropriété, « l'employeur est le syndicat des
 *   copropriétaires », le syndic signe le contrat de travail en mandataire ; art. 22, 1 : pour la catégorie B (gardien
 *   logé), la rémunération inclut le salaire en nature du logement de fonction ;
 * - C. trav. L7211-3, 6° : sont applicables aux salariés définis à l'art. L7211-2 les dispositions relatives « Au mode de
 *   paiement des salaires prévu par les articles L. 3241-1 et suivants » (L3241-1 relu le 03/11/2026 : voir J25).
 *
 * Décisions de Hugo du 03/11/2026 (registre des décisions juridiques, J25 ; question 16 de la liste) :
 * - J25 : aucun paiement en espèces, ni des salaires ni des fournisseurs ; le compte 53 « Caisse » n'est pas tenu. Le
 *   refus des espèces (anomalie « especes », bloquante) devient une décision du cabinet, et non plus un choix provisoire
 *   de VitFix ; son fondement reste vide, car c'est la décision, et non un texte, qui fonde le refus. Pour un salaire, le
 *   texte applicable ne fonde pas un refus sans réserve : C. trav. L3241-1, applicable au gardien par L7211-3, 6°, relu
 *   sur Légifrance le 03/11/2026 (bandeau « En vigueur au 03/11/2026 » ; version en vigueur depuis le 27/12/2022,
 *   modifiée par la loi n° 2021-1774 du 24 décembre 2021, art. 1), dispose : « En dessous d'un montant mensuel
 *   déterminé par décret, le salaire est payé en espèces au salarié qui le demande. » et « Au-delà d'un montant mensuel
 *   déterminé par décret, le salaire est payé par chèque barré ou par virement à un compte bancaire ou postal dont le
 *   salarié est le titulaire ou le cotitulaire. » Au-delà du seuil, le refus suit donc la loi ; en deçà, il contredit la
 *   demande du salarié : tranché par J40 (ci-dessous). Le refus pour un fournisseur n'est pas visé par L3241-1. Hors de
 *   ce module : la remise d'espèces REÇUES (ordres de banque, types-ordres-banque.ts, inchangé), tranchée à part (J29 du
 *   registre : refusée) ; reglements-fournisseurs.ts applique aussi J25 : le mode « Espèces » y est refusé par décision.
 *
 * Décisions de Hugo du 06/11/2026 (registre des décisions juridiques, J40 ; PR #642, ancienne question 🔴 n° 10) :
 * - J40 : aucun paiement en espèces, même pour un salarié payé sous le seuil de C. trav. L3241-1 qui le demande : choix
 *   du cabinet, plus strict que la loi. L'anomalie « especes » reste bloquante, sans réserve ouverte ; son message dit
 *   le choix et le texte qu'il écarte. Risque : C. trav. L3241-1 donne ce droit au salarié qui le demande, sous le
 *   montant mensuel fixé par décret (« En dessous d'un montant mensuel déterminé par décret, le salaire est payé en
 *   espèces au salarié qui le demande. », relu le 03/11/2026, ci-dessus) ; le refus opposé à cette demande contredit ce
 *   droit. Le décret qui fixe ce montant n'a pas été lu : la règle n'en dépend plus, le refus valant quel que soit le
 *   salaire.
 *
 * Décisions de Hugo du 17/11/2026 (J67 du registre des décisions juridiques ; textes relus sur Légifrance le 17/11/2026) :
 * - J67, R38 : la part récupérable sur le locataire d'un logement est celle du décret n° 87-713, art. 2 (version du
 *   01/01/2009) : gardien ou concierge qui assure, d'après son contrat, l'entretien des parties communes et
 *   l'élimination des rejets, 75 % de sa rémunération et des charges sociales et fiscales (c), 40 % s'il n'assure qu'une
 *   des deux tâches ; employé d'immeuble qui assure l'une ou l'autre, 100 % (d) ; encadrement technique en régie, 10 %.
 *   Ne sont jamais récupérables : le salaire en nature, l'intéressement et la participation, les indemnités et primes de
 *   départ à la retraite, les indemnités de licenciement, la cotisation patronale à une mutuelle, la participation au
 *   comité d'entreprise et à l'effort de construction, la cotisation à la médecine du travail. La fonction est la
 *   qualité du salarié (Gardien, Employé d'immeuble) ; ses tâches sont saisies (tachesContrat) et donnent le taux
 *   (categorieRecuperable). Le taux repris de l'analytique est gardé, mais contrôlé (controlerRecuperablePaie : écart, ou
 *   « à confirmer » sans tâches saisies) ; les éléments exclus sont mis à 0 % selon la nature de la ligne, quelle que
 *   soit l'analytique : la ligne 644 de la paie (mutuelle, médecine du travail ; le compte entier, J67, R39), la ligne
 *   d'une facture imputée sur une analytique du 644 (ligneDepuisAnalytique d'analytiques.ts) et la part du brut faite du
 *   salaire en nature et des éléments exclus (une seconde ligne au 641). La taxe sur les
 *   salaires, charge fiscale de la rémunération, reste dans la base. Ce n'est pas le syndicat qui récupère, mais le
 *   copropriétaire bailleur : le module donne seulement la part récupérable.
 * - J67, R39 : part patronale de la prévoyance au 642 par défaut, réglable cotisation par cotisation (comptePatronal) :
 *   chaque opération va au compte de sa nature (arrêté du 14 mars 2005, art. 3), et la prévoyance est une charge sociale
 *   versée à un organisme social (art. 7 : « 642 Charges sociales et organismes sociaux »). Le décret n° 87-713 (art. 2,
 *   c) exclut la mutuelle et la médecine du travail, pas la prévoyance : le 644 reste entièrement non récupérable. Si le
 *   contrat réunit mutuelle et prévoyance dans une seule cotisation, la scinder : la mutuelle va au 644. Aucun texte ne
 *   tranche mot pour mot : c'est une interprétation, à vérifier dans Gestéam (question 3 ci-dessous).
 *
 * 🔵 Déduit :
 * - un salaire n'est ni une facture ni un achat (art. 3 et 10) : le net à payer est crédité au 421 du salarié (sous-compte
 *   par salarié, art. 8), jamais au 401 ; débit 641 du brut ; débit 642 des cotisations patronales, sauf la part
 *   patronale d'une mutuelle, débitée au 644 (art. 7 : « 644 Autres (médecine du travail, mutuelles, etc.) » ; art. 3 :
 *   compte de même nature) : compte choisi cotisation par cotisation (comptePatronal, 642 par défaut, jamais 644 pour la
 *   sécurité sociale) ; crédit 431 / 432 des cotisations salariales et patronales, par organisme (sous-compte), crédit
 *   442 du prélèvement à la source (CGI art. 204 A et suivants non lus) ; écriture équilibrée par construction ; taxe sur
 *   les salaires : débit 643 / crédit 442 ;
 * - D1 : le salarié, l'employeur et le règlement de paie sont rattachés au syndicat (coproprieteId), employeur (CCN art.
 *   1er) et propriétaire des comptes ; le règlement garde mandatId, la mission qui règle ; un nouveau mandat reprend donc
 *   la paie du même syndicat ;
 * - VitFix NE CALCULE PAS la paie (salaire conventionnel, unités de valeur, 13e mois, avantage en nature) : il enregistre
 *   le bulletin établi par le prestataire de paie et contrôle sa cohérence (net = brut − cotisations salariales −
 *   avantages en nature − prélèvement à la source) ; un bulletin d'un mois fini avant l'entrée du salarié est refusé ;
 * - règlement de la paie : catégorie distincte du règlement fournisseur (reglements-fournisseurs.ts) : aucun 401, aucune
 *   facture, aucun cycle de statuts repris ; plan de paie vérifié comme à la constatation ; débit du compte de paie soldé
 *   (421 du salarié, 431, 432, 442) / crédit d'un compte de banque du syndicat, au format complet
 *   <syndicat>.51xxx.<auxiliaire>.<repère> et du segment du syndicat (D1, comme la contrepartie 512 des fournisseurs) ;
 *   montant borné au plus petit de deux soldes créditeurs du compte payé : à la date du règlement (rien avant la
 *   constatation) et tous mouvements confondus (un règlement antidaté ne paie pas deux fois) ; salaire net : bulletin
 *   réglé exigé, fourni, du salarié payé et constaté à la date du règlement (rien n'est dû sur un bulletin avant sa
 *   constatation, même si le 421 porte le solde d'un autre bulletin) : le bulletin constaté garde l'identifiant du
 *   traitement de sa constatation (BulletinPaieConstate), qui doit figurer au grand livre, daté au plus tard du jour du
 *   règlement, sans annulation ; montant borné aussi au restant dû de ce bulletin (l'échéance de salaire se solde par les
 *   règlements rattachés au bulletin) ; famille « Règlement de soldes de compte » (comme le remboursement
 *   d'un 450), annulable par « Annulation de règlements » ; le règlement écrit garde l'identifiant de son traitement
 *   (ReglementPaieEcrit) : il n'est « en vigueur » que si ce traitement figure au grand livre sans annulation, seul état
 *   que lisent le restant dû du bulletin et l'échéance de salaire (un virement rejeté puis annulé ne solde plus rien) ;
 * - le 644 (médecine du travail, mutuelles) peut aussi venir d'une vraie facture (service de santé au travail) : seuls
 *   641, 642 et 643 sont refusés en facture, et un tiers « Salarié » comme fournisseur ;
 * - codes à 5 caractères 42100, 43100, 43200, 44200, 64200, 64300, 64400 : seul 64100 est lu (tranche 24 § 5) ; réglables
 *   (verifierPlanPaie : une subdivision du compte de l'arrêté) ; sous-comptes « 00000 » hors 421 et organismes ;
 * - les 64x, en classe 6, remontent dans mouvementsARepartir (charges à répartir) ; les attributs (analytique, rubrique,
 *   récupérable) sont repris de l'analytique fournie, jamais calculés, sauf la part récupérable des éléments exclus,
 *   mise à 0 % (J67, R38) ; sans analytique fournie, rien n'est forcé : une seule ligne au 641 ;
 * - tout le 644 est tenu pour jamais récupérable, par son compte, faute de nature saisie sur la cotisation (J67, R39 : « le
 *   644 reste entièrement non récupérable ») : une prévoyance que le cabinet y passerait (comptePatronal) perdrait sa part
 *   récupérable ; c'est la lecture prudente pour le locataire, et Hugo choisira si Gestéam la met au 644 (question 3) ;
 * - SIRET attendu dès qu'un salarié est en poste (la DSN porte le numéro d'identité de l'employeur : CSS art. R133-14, V,
 *   1°, a) ; les autres identifiants employeur : alerte de gestion, jamais bloquante.
 *
 * 🔴 Non établi (questions exactes pour Frédéric ou Hugo ; les n° 7 et 10 sont tranchés : J25 et J40, et les n° 6 et 8 :
 *   J67, R38 et R39, ci-dessus) :
 * 1. Frédéric : la pratique Gestéam (salaire réglé comme une facture, 401 au nom du salarié, contrat « Prestation »)
 *    contredit l'arrêté. À la reprise d'un dossier, faut-il reclasser les soldes 401 « salarié » en 421, ou seulement les
 *    signaler ? Les contreparties 641/421, 642/431-432 et 643/442 sont déduites, pas lues : les confirmez-vous ?
 * 2. Constatation de la paie passée en « Saisie de mouvements » : FAMILLE_TRAITEMENT n'a pas de famille « Paie », et
 *    annulerTraitement refuse « Saisie de mouvements » (correction par écriture contraire). Faut-il une famille « Paie »
 *    dédiée ?
 * 3. Quels sont, dans Gestéam, les codes à 5 caractères des comptes 421, 431, 432, 442, 642, 643 et 644 ? Et sous quel
 *    code est l'entrée « prévoyance » des 64xxx (642xx ou 644xx ; relevé L3-12) ? Un 644xx voudrait dire que le cabinet
 *    suit l'autre lecture que J67, R39 : Hugo choisira.
 * 4. Avantage en nature compris dans le brut (logement du gardien, catégorie B) : quel compte crédite-t-on ? L'arrêté n'en
 *    dit rien et son art. 8 exclut les comptes du plan comptable général ; VitFix exige un compte fourni par le cabinet,
 *    sans valeur par défaut.
 * 5. Autres éléments du bulletin (acompte, saisie sur salaire, frais remboursés, indemnité non soumise) : non pris en
 *    charge (net incohérent) ; C. trav. L3242-1 et R3243-1 et suivants non lus. Faut-il les traiter, et sur quels comptes ?
 * 9. Bulletin d'un mois postérieur à la sortie du salarié (rappel de salaire, régularisation) : admis sans alerte. Faut-il
 *    une alerte, ou le limiter au mois du paiement ?
 * 11. Hugo (J67, R38, points restés ouverts) : la participation au comité d'entreprise et à l'effort de construction,
 *    jamais récupérable (décret n° 87-713, art. 2, c), n'est pas modélisée ; passée en cotisation au 642, elle garde le
 *    taux de l'analytique. Pour la mettre à 0 %, il faudrait la nature de chaque cotisation sur le bulletin (donnée du
 *    prestataire de paie). Le décret de la part récupérable dans les logements sociaux n'a pas été lu : le module ne vaut
 *    que pour les baux de la loi du 6 juillet 1989 ; il faudrait le lire, avec la loi n° 89-462, art. 23, avant de
 *    l'étendre.
 *
 * Branchements à faire plus tard (fichiers sous PR, non modifiés ici) : facture-ventilee.ts (controlerVentilation),
 * statuts-facture.ts et imputation-facture.ts : appeler controlerFactureHorsPaie ; reglements-fournisseurs.ts : refuser un
 * fournisseur de type « Salarié » ; ordres-banque.ts et rapprochement-pieces.ts : accepter un ReglementPaie dans un ordre
 * de virement et propager « Rapproché » ; traitements.ts et référentiels : famille « Paie » si elle est décidée (🔴 2).
 * Tables (Frédéric) : conserver chaque bulletin constaté avec le traitementId de sa constatation (BulletinPaieConstate),
 * relu avec le grand livre par controlerReglementPaie, et chaque règlement écrit avec son traitementId
 * (ReglementPaieEcrit), relu avec le grand livre par controlerReglementPaie et par le suivi employeur. Enregistrement à
 * brancher (J67, R38) : tâches du contrat du salarié (tachesContrat) et éléments non récupérables du bulletin.
 */

// ─── Référentiels ───────────────────────────────────────────────────────────────────────────

export const QUALITES_PERSONNEL = QUALITE_IDENTITE.personnel
export type QualitePersonnel = (typeof QUALITES_PERSONNEL)[number]
const QUALITES_PERSONNEL_ADMISES: ReadonlySet<string> = new Set(QUALITES_PERSONNEL)
export const estQualitePersonnel = (qualite: string): qualite is QualitePersonnel => QUALITES_PERSONNEL_ADMISES.has(qualite)

/** Arrêté du 14 mars 2005, art. 7 : comptes de la paie et leurs intitulés. */
export const COMPTES_NOMENCLATURE_PAIE = {
  remunerations: { compte: '421', libelle: 'Rémunérations dues' },
  securiteSociale: { compte: '431', libelle: 'Sécurité sociale' },
  autresOrganismes: { compte: '432', libelle: 'Autres organismes sociaux' },
  etatImpots: { compte: '442', libelle: 'Etat - impôts et versements assimilés' },
  salaires: { compte: '641', libelle: 'Salaires' },
  chargesSociales: { compte: '642', libelle: 'Charges sociales et organismes sociaux' },
  taxeSalaires: { compte: '643', libelle: 'Taxe sur les salaires' },
  autresFrais: { compte: '644', libelle: 'Autres (médecine du travail, mutuelles, etc.)' },
} as const
export type CleComptePaie = keyof typeof COMPTES_NOMENCLATURE_PAIE
/** Code du plan (5 caractères) retenu pour chaque compte de la paie. */
export type PlanPaie = Record<CleComptePaie, string>

const CLES_COMPTES_PAIE = Object.keys(COMPTES_NOMENCLATURE_PAIE) as CleComptePaie[]

/** 64100 lu (tranche 24 § 5) ; les autres codes sont déduits (🔴 3). */
export const PLAN_PAIE_PAR_DEFAUT: Readonly<PlanPaie> = {
  remunerations: '42100',
  securiteSociale: '43100',
  autresOrganismes: '43200',
  etatImpots: '44200',
  salaires: '64100',
  chargesSociales: '64200',
  taxeSalaires: '64300',
  autresFrais: '64400',
}

const CODE_CINQ_CARACTERES = /^[0-9A-Z]{5}$/
const AUXILIAIRE_ZERO = '00000'

/** Chaque code a 5 caractères et n'est qu'une subdivision de son compte de l'arrêté (art. 8). */
export function verifierPlanPaie(plan: Readonly<PlanPaie>): Readonly<PlanPaie> {
  for (const cle of CLES_COMPTES_PAIE) {
    const code = plan[cle]
    const { compte, libelle } = COMPTES_NOMENCLATURE_PAIE[cle]
    if (typeof code !== 'string' || !CODE_CINQ_CARACTERES.test(code))
      throw new Error(`Compte « ${libelle} » : code de 5 caractères attendu (« ${String(code)} »).`)
    if (!code.startsWith(compte))
      throw new Error(`Compte « ${libelle} » : « ${code} » n'est pas une subdivision du ${compte} (arrêté du 14 mars 2005, art. 7 et 8).`)
  }
  return plan
}

export const ORGANISMES_SOCIAUX = ['securite_sociale', 'autre_organisme'] as const
export type OrganismeSocial = (typeof ORGANISMES_SOCIAUX)[number]
const ORGANISMES_ADMIS: ReadonlySet<string> = new Set(ORGANISMES_SOCIAUX)
const COMPTE_ORGANISME: Record<OrganismeSocial, CleComptePaie> = {
  securite_sociale: 'securiteSociale',
  autre_organisme: 'autresOrganismes',
}

/** Compte de charge de la part patronale d'une cotisation : 642 (par défaut, prévoyance comprise : J67, R39) ou 644 (mutuelle : art. 7). */
export const COMPTES_CHARGE_PATRONALE = ['chargesSociales', 'autresFrais'] as const
export type CompteChargePatronale = (typeof COMPTES_CHARGE_PATRONALE)[number]
const COMPTES_CHARGE_ADMIS: ReadonlySet<string> = new Set(COMPTES_CHARGE_PATRONALE)

/** Obligations du syndicat employeur suivies par echeances-employeur.ts. */
export const OBLIGATIONS_EMPLOYEUR = [
  'dsn',
  /** J67, R35 : signalement en DSN de la fin du contrat et d'un arrêt de travail (CSS R133-14, II). */
  'signalement_dsn',
  'versement_cotisations',
  'adhesion_sante_travail',
  'medecine_travail',
  'visite_reprise',
  'duerp',
  'salaire',
  'taxe_salaires',
] as const
export type ObligationEmployeur = (typeof OBLIGATIONS_EMPLOYEUR)[number]

export type SourceDocumentEmployeur = 'tranche 43 § 19' | 'tranche 18'

/**
 * Types de document du dossier employeur : union des 9 types du rôle « Gardien / employé d'immeuble » (tranche 43 § 19)
 * et des 7 types relevés dans la famille « Employeur » de la tranche 18 (échantillon non exhaustif, § 4), sans doublon
 * (« Attestation Employeur Pôle Emploi » de la tranche 18 = « Attestation employeur Pôle emploi » de la tranche 43). Liste
 * ouverte, à compléter par la GED (point 64 du bilan).
 */
export const TYPES_DOCUMENT_EMPLOYEUR: readonly {
  libelle: string
  sources: readonly SourceDocumentEmployeur[]
  obligation: ObligationEmployeur | null
}[] = [
  { libelle: 'Arrêt maladie', sources: ['tranche 43 § 19', 'tranche 18'], obligation: 'visite_reprise' },
  { libelle: 'Attestation de suivi médecine du travail', sources: ['tranche 43 § 19', 'tranche 18'], obligation: 'medecine_travail' },
  { libelle: 'Attestation employeur Pôle emploi', sources: ['tranche 43 § 19', 'tranche 18'], obligation: null },
  { libelle: 'Déclaration DSN', sources: ['tranche 43 § 19'], obligation: 'dsn' },
  { libelle: 'Demande de congés', sources: ['tranche 43 § 19'], obligation: null },
  { libelle: "Document unique d'évaluation des risques (DUERP)", sources: ['tranche 43 § 19'], obligation: 'duerp' },
  { libelle: 'Fiche de poste', sources: ['tranche 43 § 19'], obligation: null },
  { libelle: "Relevé d'heures", sources: ['tranche 43 § 19'], obligation: null },
  { libelle: 'Salaire et charges sociales', sources: ['tranche 43 § 19', 'tranche 18'], obligation: 'salaire' },
  { libelle: 'Contrat de travail', sources: ['tranche 18'], obligation: null },
  { libelle: 'Certificat de travail', sources: ['tranche 18'], obligation: null },
  { libelle: 'Attestation de déclaration sociale', sources: ['tranche 18'], obligation: 'dsn' },
]

type ChampFicheSyndicat = (typeof REPARTITION_FICHE_MANDAT_GESTEAM.syndicat)[number]
const NOMS_IDENTIFIANTS_EMPLOYEUR = [
  'SIRET',
  'URSSAF',
  'Taxe salaire',
  'Caisse retraite',
  'No de mutuelle',
  'No de prévoyance',
] as const satisfies readonly ChampFicheSyndicat[]
export type IdentifiantEmployeur = (typeof NOMS_IDENTIFIANTS_EMPLOYEUR)[number]
const IDENTIFIANTS_RETENUS: ReadonlySet<string> = new Set(NOMS_IDENTIFIANTS_EMPLOYEUR)

/** Identifiants du syndicat employeur, pris sur la fiche mandat (D1, côté syndicat), dans son ordre. */
export const IDENTIFIANTS_EMPLOYEUR: readonly IdentifiantEmployeur[] = REPARTITION_FICHE_MANDAT_GESTEAM.syndicat.filter(
  (champ): champ is IdentifiantEmployeur => IDENTIFIANTS_RETENUS.has(champ),
)

const FONDEMENT_IDENTIFIANT: Partial<Record<IdentifiantEmployeur, string>> = {
  SIRET: 'CSS art. R133-14, V, 1°, a (DSN)',
}

// ─── Part récupérable sur le locataire (J67, R38) ───────────────────────────────────────────

/** Tâches du contrat de travail qui fixent la part récupérable (décret n° 87-713, art. 2, c et d). */
export const TACHES_CONTRAT = ['entretien', 'rejets', 'entretien_et_rejets'] as const
export type TacheContrat = (typeof TACHES_CONTRAT)[number]
const TACHES_ADMISES: ReadonlySet<string> = new Set(TACHES_CONTRAT)

export type CategorieRecuperable = 'gardien_entretien_et_rejets' | 'gardien_une_tache' | 'employe_immeuble' | 'encadrement_technique_regie'

/**
 * Décret n° 87-713 du 26/08/1987, art. 2 (version du 01/01/2009) : part récupérable sur le locataire d'un logement, en %
 * de la rémunération et des charges sociales et fiscales : gardien ou concierge (c), employé d'immeuble (d),
 * encadrement technique en régie.
 */
export const PARTS_RECUPERABLES_DECRET_87_713: Readonly<Record<CategorieRecuperable, number>> = {
  gardien_entretien_et_rejets: 75,
  gardien_une_tache: 40,
  employe_immeuble: 100,
  encadrement_technique_regie: 10,
}

const FONDEMENT_CATEGORIE: Record<CategorieRecuperable, string> = {
  gardien_entretien_et_rejets: 'Décret n° 87-713, art. 2, c',
  gardien_une_tache: 'Décret n° 87-713, art. 2, c',
  employe_immeuble: 'Décret n° 87-713, art. 2, d',
  encadrement_technique_regie: 'Décret n° 87-713, art. 2',
}

/** Éléments du brut jamais récupérables (décret n° 87-713, art. 2, c), hors salaire en nature (avantagesEnNatureCentimes). */
export const ELEMENTS_NON_RECUPERABLES = ['indemnite_licenciement', 'depart_retraite', 'interessement_participation'] as const
export type ElementNonRecuperable = (typeof ELEMENTS_NON_RECUPERABLES)[number]
const ELEMENTS_ADMIS: ReadonlySet<string> = new Set(ELEMENTS_NON_RECUPERABLES)

export type CodeAnomaliePaie =
  | 'periode_invalide'
  | 'montant_invalide'
  | 'organisme_inconnu'
  | 'compte_charge_invalide'
  | 'auxiliaire_invalide'
  | 'net_incoherent'
  | 'bulletin_avant_entree'
  | 'nature_inconnue'
  | 'date_invalide'
  | 'mode_invalide'
  | 'especes'
  | 'reference_absente'
  | 'rattachement_absent'
  | 'compte_banque_invalide'
  | 'compte_banque_autre_syndicat'
  | 'salarie_requis'
  | 'salarie_inattendu'
  | 'salarie_incoherent'
  | 'salarie_autre_syndicat'
  | 'bulletin_requis'
  | 'bulletin_introuvable'
  | 'bulletin_incoherent'
  | 'bulletin_autre_salarie'
  | 'bulletin_non_constate'
  | 'reglement_superieur_au_du'
  | 'salaire_en_facture'
  | 'tiers_salarie_en_fournisseur'
  | 'identifiant_employeur_absent'
  | 'recuperable_ecart'
  | 'recuperable_a_confirmer'
  | 'recuperable_exclu_force'

export interface AnomaliePaie {
  code: CodeAnomaliePaie
  message: string
  /** Texte cité ; null pour une règle de gestion ou un choix de VitFix. */
  fondement: string | null
}

const anomalie = (code: CodeAnomaliePaie, message: string, fondement: string | null = null): AnomaliePaie => ({ code, message, fondement })
const texteRenseigne = (valeur: unknown): boolean => typeof valeur === 'string' && valeur.trim() !== ''

// ─── Salarié ────────────────────────────────────────────────────────────────────────────────

export interface SalarieSyndicat {
  id: string
  /** D1 : le syndicat employeur (CCN IDCC 1043, art. 1er), propriétaire de son 421 ; pas le mandat. */
  coproprieteId: string
  /** Identité du salarié (identites-positions.ts) : aucune donnée personnelle ici. */
  identiteId: string
  qualite: QualitePersonnel
  /** Segment auxiliaire de son sous-compte 421 (art. 8), 5 caractères. */
  auxiliaire421: string
  entreeLe: string
  /** Jour de sortie : il n'est plus en poste ce jour-là (période semi-ouverte) ; null : en poste. */
  sortieLe: string | null
  /**
   * J67, R38 — tâches du contrat de travail : entretien des parties communes, élimination des rejets, ou les deux ;
   * absentes ou null : non saisies (le taux repris de l'analytique reste « à confirmer »).
   */
  tachesContrat?: TacheContrat | null
}

export function creerSalarieSyndicat(saisie: SalarieSyndicat): SalarieSyndicat {
  if (!texteRenseigne(saisie.id) || !texteRenseigne(saisie.coproprieteId) || !texteRenseigne(saisie.identiteId))
    throw new Error('Salarié : identifiant, syndicat employeur (D1) et identité attendus.')
  if (!estQualitePersonnel(saisie.qualite))
    throw new Error(`Qualité « ${saisie.qualite} » : Gardien ou Employé d'immeuble attendu (QUALITE_IDENTITE.personnel).`)
  if (!CODE_CINQ_CARACTERES.test(saisie.auxiliaire421))
    throw new Error(`Sous-compte 421 « ${saisie.auxiliaire421} » : 5 caractères attendus.`)
  if (!estDateIsoValide(saisie.entreeLe)) throw new Error(`Date d'entrée invalide (${saisie.entreeLe}) : AAAA-MM-JJ attendu.`)
  if (saisie.sortieLe !== null && (!estDateIsoValide(saisie.sortieLe) || saisie.sortieLe < saisie.entreeLe))
    throw new Error(`Date de sortie invalide (${saisie.sortieLe}) : AAAA-MM-JJ, au plus tôt le jour d'entrée.`)
  const taches = saisie.tachesContrat ?? null
  if (taches !== null && !TACHES_ADMISES.has(taches))
    throw new Error(`Tâches du contrat « ${String(taches)} » : ${TACHES_CONTRAT.join(', ')} attendu (décret n° 87-713, art. 2).`)
  return { ...saisie }
}

/** J67, R38 — catégorie du décret n° 87-713, art. 2, d'après la qualité et les tâches du contrat ; null : tâches non saisies. */
export function categorieRecuperable(salarie: Pick<SalarieSyndicat, 'qualite' | 'tachesContrat'>): CategorieRecuperable | null {
  const taches = salarie.tachesContrat ?? null
  if (taches === null) return null
  if (salarie.qualite === "Employé d'immeuble") return 'employe_immeuble'
  return taches === 'entretien_et_rejets' ? 'gardien_entretien_et_rejets' : 'gardien_une_tache'
}

/** En poste à une date : entré, pas encore sorti (sorti le jour de sa sortie, comme les positions de D2). */
export const estEnPoste = (salarie: Pick<SalarieSyndicat, 'entreeLe' | 'sortieLe'>, date: string): boolean =>
  salarie.entreeLe <= date && (salarie.sortieLe === null || date < salarie.sortieLe)

// ─── Constatation de la paie ────────────────────────────────────────────────────────────────

export interface CotisationBulletin {
  organisme: OrganismeSocial
  /** Sous-compte de l'organisme (431 ou 432, art. 8), 5 caractères ; « 00000 » par défaut. */
  auxiliaire?: string
  /** Compte de charge de la part patronale : 642 par défaut ; 644 pour une mutuelle (art. 7). */
  comptePatronal?: CompteChargePatronale
  salarialeCentimes: number
  patronaleCentimes: number
}

/** Bulletin établi par le prestataire de paie : VitFix l'enregistre, il ne le calcule pas. */
export interface BulletinPaie {
  id: string
  salarieId: string
  annee: number
  mois: number
  brutCentimes: number
  /** Avantages en nature compris dans le brut et non versés (logement du gardien, catégorie B : CCN art. 22, 1). */
  avantagesEnNatureCentimes?: number
  /** J67, R38 — éléments compris dans le brut et jamais récupérables (décret n° 87-713, art. 2, c), par nature. */
  elementsNonRecuperablesCentimes?: Partial<Record<ElementNonRecuperable, number>>
  cotisations: CotisationBulletin[]
  prelevementSourceCentimes: number
  netAPayerCentimes: number
}

export interface ContextePaie {
  /** Segment du syndicat dans le numéro de compte (4 caractères, D1). */
  segmentSyndicat: string
  plan: Readonly<PlanPaie>
  /** Code du plan (5 caractères) crédité des avantages en nature : choisi par le cabinet (🔴 4), sans défaut. */
  compteAvantagesEnNature?: string | null
  /** Sous-comptes du 442 ; « 00000 » par défaut. */
  auxiliairePrelevementSource?: string
  auxiliaireTaxeSalaires?: string
  /** Attributs des lignes de charges, repris de l'analytique (010 : salaires gardien…). */
  attributs?: {
    salaires?: AttributsMouvement
    chargesSociales?: AttributsMouvement
    autresFrais?: AttributsMouvement
    taxeSalaires?: AttributsMouvement
  }
}

const estCentimes = (valeur: number): boolean => Number.isInteger(valeur) && valeur >= 0
const somme = (valeurs: number[]): number => valeurs.reduce((total, valeur) => total + valeur, 0)
/** Année sur 4 chiffres au plus. */
const ANNEE_PLAFOND = 9999
/** Période de paie : mois de 1 à 12, année entière de ANNEE_PLANCHER à 9999. */
export const estPeriodeValide = (annee: number, mois: number): boolean =>
  Number.isInteger(annee) && annee >= ANNEE_PLANCHER && annee <= ANNEE_PLAFOND && Number.isInteger(mois) && mois >= 1 && mois <= 12
export const libellePeriode = (annee: number, mois: number): string => `${String(mois).padStart(2, '0')}/${annee}`

function anomaliesComptePatronal(cotisation: CotisationBulletin): AnomaliePaie[] {
  const { comptePatronal } = cotisation
  if (comptePatronal === undefined) return []
  if (!COMPTES_CHARGE_ADMIS.has(comptePatronal))
    return [anomalie('compte_charge_invalide', `Compte de charge « ${comptePatronal} » : 642 (charges sociales) ou 644 (mutuelle) attendu.`)]
  if (cotisation.organisme === 'securite_sociale' && comptePatronal === 'autresFrais')
    return [anomalie('compte_charge_invalide', 'Cotisation de sécurité sociale : part patronale au 642, pas au 644.', 'Arrêté du 14 mars 2005, art. 3 et 7')]
  return []
}

function anomaliesCotisation(cotisation: CotisationBulletin): AnomaliePaie[] {
  const anomalies: AnomaliePaie[] = []
  if (!ORGANISMES_ADMIS.has(cotisation.organisme))
    anomalies.push(anomalie('organisme_inconnu', `Organisme « ${cotisation.organisme} » : sécurité sociale ou autre organisme social attendu.`))
  if (cotisation.auxiliaire !== undefined && !CODE_CINQ_CARACTERES.test(cotisation.auxiliaire))
    anomalies.push(anomalie('auxiliaire_invalide', `Sous-compte « ${cotisation.auxiliaire} » : 5 caractères attendus.`))
  anomalies.push(...anomaliesComptePatronal(cotisation))
  return anomalies
}

const montantsBulletin = (b: BulletinPaie): number[] => [
  b.brutCentimes,
  b.avantagesEnNatureCentimes ?? 0,
  ...Object.values(b.elementsNonRecuperablesCentimes ?? {}),
  b.prelevementSourceCentimes,
  b.netAPayerCentimes,
  ...b.cotisations.flatMap((c) => [c.salarialeCentimes, c.patronaleCentimes]),
]

/** J67, R38 — part du brut jamais récupérable : salaire en nature et éléments exclus (décret n° 87-713, art. 2, c). */
const brutNonRecuperable = (b: BulletinPaie): number => (b.avantagesEnNatureCentimes ?? 0) + somme(Object.values(b.elementsNonRecuperablesCentimes ?? {}))

/**
 * Contrôle de forme et de cohérence : net = brut − cotisations salariales − avantages en nature − prélèvement à la
 * source ; éléments non récupérables de nature connue, jamais plus que le brut avec le salaire en nature (J67, R38).
 */
export function controlerBulletin(b: BulletinPaie): AnomaliePaie[] {
  const anomalies: AnomaliePaie[] = []
  if (!estPeriodeValide(b.annee, b.mois))
    anomalies.push(anomalie('periode_invalide', `Période ${b.mois}/${b.annee} : mois de 1 à 12 et année sur 4 chiffres attendus.`))
  if (!montantsBulletin(b).every(estCentimes))
    anomalies.push(anomalie('montant_invalide', `Bulletin ${b.id} : montants en centimes entiers, positifs ou nuls, attendus.`))
  const inconnu = Object.keys(b.elementsNonRecuperablesCentimes ?? {}).find((nature) => !ELEMENTS_ADMIS.has(nature))
  if (inconnu !== undefined)
    anomalies.push(anomalie('nature_inconnue', `Élément non récupérable « ${inconnu} » : ${ELEMENTS_NON_RECUPERABLES.join(', ')} attendu.`))
  anomalies.push(...b.cotisations.flatMap(anomaliesCotisation))
  if (anomalies.length > 0) return anomalies
  if (brutNonRecuperable(b) > b.brutCentimes)
    return [
      anomalie(
        'montant_invalide',
        `Bulletin ${b.id} : salaire en nature et éléments non récupérables (${brutNonRecuperable(b)} centimes) pour plus que le brut (${b.brutCentimes} centimes).`,
      ),
    ]
  const attendu = b.brutCentimes - somme(b.cotisations.map((c) => c.salarialeCentimes)) - (b.avantagesEnNatureCentimes ?? 0) - b.prelevementSourceCentimes
  if (attendu !== b.netAPayerCentimes)
    anomalies.push(
      anomalie('net_incoherent', `Bulletin ${b.id} : net à payer de ${b.netAPayerCentimes} centimes pour ${attendu} centimes attendus.`),
    )
  return anomalies
}

/**
 * Bulletin rapporté au salarié : le sien, cohérent (controlerBulletin), d'un mois qui ne finit pas avant son entrée. Un
 * mois postérieur à la sortie reste admis (rappel de salaire, régularisation : 🔴 9).
 */
export function controlerBulletinSalarie(b: BulletinPaie, salarie: SalarieSyndicat): AnomaliePaie[] {
  if (b.salarieId !== salarie.id)
    return [anomalie('salarie_incoherent', `Bulletin ${b.id} du salarié ${b.salarieId}, fiche fournie : ${salarie.id}.`)]
  const anomalies = controlerBulletin(b)
  if (anomalies.length > 0) return anomalies
  if (composerDateIso(b.annee, b.mois, joursDansMois(b.annee, b.mois)) >= salarie.entreeLe) return []
  return [
    anomalie(
      'bulletin_avant_entree',
      `Bulletin ${b.id} de ${libellePeriode(b.annee, b.mois)} : mois fini avant l'entrée du salarié ${salarie.id} (${dateIsoVersFr(salarie.entreeLe)}).`,
    ),
  ]
}

const compte = (ctx: ContextePaie, cle: CleComptePaie, auxiliaire: string = AUXILIAIRE_ZERO): string =>
  formaterNumeroCompte({ mandat: ctx.segmentSyndicat, planCode: ctx.plan[cle], auxiliaire })

const ligne = (numero: string, sens: SensMouvement, montantCentimes: number, attributs?: AttributsMouvement): LigneMouvement => ({
  compte: numero,
  sens,
  montantCentimes,
  ...(attributs ? { attributs: { ...attributs } } : {}),
})

function lignesOrganismes(cotisations: CotisationBulletin[], ctx: ContextePaie): LigneMouvement[] {
  const parCompte = new Map<string, number>()
  for (const c of cotisations) {
    const numero = compte(ctx, COMPTE_ORGANISME[c.organisme], c.auxiliaire ?? AUXILIAIRE_ZERO)
    parCompte.set(numero, (parCompte.get(numero) ?? 0) + c.salarialeCentimes + c.patronaleCentimes)
  }
  return [...parCompte].map(([numero, montant]) => ligne(numero, 'credit', montant))
}

/** Parts patronales débitées au compte de charge donné (642 par défaut). */
const partsPatronales = (cotisations: CotisationBulletin[], cle: CompteChargePatronale): number =>
  somme(cotisations.filter((c) => (c.comptePatronal ?? 'chargesSociales') === cle).map((c) => c.patronaleCentimes))

function lignesAvantagesEnNature(montantCentimes: number, ctx: ContextePaie): LigneMouvement[] {
  if (montantCentimes === 0) return []
  const code = ctx.compteAvantagesEnNature
  if (!code)
    throw new Error("Bulletin avec avantage en nature : compte de contrepartie non établi (🔴 4), à fournir par le cabinet.")
  if (!CODE_CINQ_CARACTERES.test(code)) throw new Error(`Compte des avantages en nature « ${code} » : 5 caractères attendus.`)
  return [ligne(formaterNumeroCompte({ mandat: ctx.segmentSyndicat, planCode: code, auxiliaire: AUXILIAIRE_ZERO }), 'credit', montantCentimes)]
}

/** J67, R38 — attributs d'une ligne jamais récupérable : ceux de l'analytique, part récupérable mise à 0 %. */
const nonRecuperable = (attributs: AttributsMouvement | undefined): AttributsMouvement | undefined =>
  attributs === undefined ? undefined : { ...attributs, recupLocatairePct: 0 }

/**
 * Débit du 641 : le brut ; avec une analytique, la part faite du salaire en nature et des éléments exclus passe sur une
 * seconde ligne, à 0 % récupérable, selon sa nature et quel que soit le taux de l'analytique (J67, R38).
 */
function lignesSalaires(b: BulletinPaie, ctx: ContextePaie): LigneMouvement[] {
  const numero = compte(ctx, 'salaires')
  const attributs = ctx.attributs?.salaires
  const exclu = brutNonRecuperable(b)
  if (attributs === undefined || exclu === 0) return [ligne(numero, 'debit', b.brutCentimes, attributs)]
  return [ligne(numero, 'debit', b.brutCentimes - exclu, attributs), ligne(numero, 'debit', exclu, nonRecuperable(attributs))]
}

/**
 * Écriture de la paie d'un bulletin (🔵 contreparties déduites) : débit 641 (brut), 642 et 644 (cotisations patronales,
 * selon le compte de charge de chaque cotisation) ; crédit 421 du salarié (net), 431 / 432 par organisme (cotisations
 * salariales et patronales), 442 (prélèvement à la source) et, s'il y en a, compte des avantages en nature. Lignes à zéro
 * omises. Part récupérable à 0 % sur la ligne 644 (mutuelle, médecine du travail : le compte entier) et sur la part non
 * récupérable du brut (J67, R38 et R39). Lève une erreur sur un bulletin incohérent, d'un autre salarié ou d'avant son entrée.
 */
export function ecrituresConstatationPaie(b: BulletinPaie, salarie: SalarieSyndicat, ctx: ContextePaie): LigneMouvement[] {
  verifierPlanPaie(ctx.plan)
  const anomalies = controlerBulletinSalarie(b, salarie)
  if (anomalies.length > 0) throw new Error(anomalies.map((a) => a.message).join(' '))
  const lignes = [
    ...lignesSalaires(b, ctx),
    ligne(compte(ctx, 'chargesSociales'), 'debit', partsPatronales(b.cotisations, 'chargesSociales'), ctx.attributs?.chargesSociales),
    ligne(compte(ctx, 'autresFrais'), 'debit', partsPatronales(b.cotisations, 'autresFrais'), nonRecuperable(ctx.attributs?.autresFrais)),
    ligne(compte(ctx, 'remunerations', salarie.auxiliaire421), 'credit', b.netAPayerCentimes),
    ...lignesOrganismes(b.cotisations, ctx),
    ligne(compte(ctx, 'etatImpots', ctx.auxiliairePrelevementSource ?? AUXILIAIRE_ZERO), 'credit', b.prelevementSourceCentimes),
    ...lignesAvantagesEnNature(b.avantagesEnNatureCentimes ?? 0, ctx),
  ]
  return lignes.filter((l) => l.montantCentimes > 0)
}

/** 🔴 2 — aucune famille « Paie » dans FAMILLE_TRAITEMENT. */
export const FAMILLE_CONSTATATION_PAIE: FamilleTraitement = 'Saisie de mouvements'
/** 🔵 — comme le remboursement d'un solde de copropriétaire ; annulable (« Annulation de règlements »). */
export const FAMILLE_REGLEMENT_PAIE: FamilleTraitement = 'Règlement de soldes de compte'

/** Bulletin constaté au grand livre : il garde l'identifiant du traitement de sa constatation (traitementConstatationPaie). */
export interface BulletinPaieConstate extends BulletinPaie {
  traitementId: string
}

/**
 * Traitement de la paie d'un bulletin, avec le libellé de sa pièce (art. 4), et le bulletin constaté, relié à ce
 * traitement (à conserver : c'est lui que lit le contrôle du règlement du net, rien n'étant dû avant la constatation).
 */
export function traitementConstatationPaie(
  { id, date }: { id: string; date: string },
  b: BulletinPaie,
  salarie: SalarieSyndicat,
  ctx: ContextePaie,
): { traitement: Traitement; libelle: string; bulletin: BulletinPaieConstate } {
  const traitement = creerTraitement({ id, famille: FAMILLE_CONSTATATION_PAIE, date, mouvements: ecrituresConstatationPaie(b, salarie, ctx) })
  return { traitement, libelle: `Paie ${libellePeriode(b.annee, b.mois)}, bulletin ${b.id}`, bulletin: { ...b, traitementId: traitement.id } }
}

/** Taxe sur les salaires constatée (montant fourni, jamais calculé ici) : débit 643 / crédit 442. */
export function ecrituresTaxeSalaires(montantCentimes: number, ctx: ContextePaie): LigneMouvement[] {
  verifierPlanPaie(ctx.plan)
  if (!Number.isInteger(montantCentimes) || montantCentimes <= 0)
    throw new Error(`Taxe sur les salaires de ${montantCentimes} : centimes entiers strictement positifs attendus.`)
  return [
    ligne(compte(ctx, 'taxeSalaires'), 'debit', montantCentimes, ctx.attributs?.taxeSalaires),
    ligne(compte(ctx, 'etatImpots', ctx.auxiliaireTaxeSalaires ?? AUXILIAIRE_ZERO), 'credit', montantCentimes),
  ]
}

/** Rémunération, charges sociales et charges fiscales (taxe sur les salaires comprise) : même part (décret n° 87-713, art. 2, c). */
const LIGNES_REMUNERATION = ['salaires', 'chargesSociales', 'taxeSalaires'] as const satisfies readonly CleComptePaie[]

const libelleComptePaie = (cle: CleComptePaie): string => `Compte ${COMPTES_NOMENCLATURE_PAIE[cle].compte} « ${COMPTES_NOMENCLATURE_PAIE[cle].libelle} »`

/**
 * J67, R38 et R39 — le 644 et ses subdivisions (médecine du travail, mutuelle) ne sont jamais récupérables (décret
 * n° 87-713, art. 2, c) : vrai pour un code du plan qui commence par 644.
 */
export const estCompteJamaisRecuperable = (comptePlan: string): boolean => comptePlan.startsWith(COMPTES_NOMENCLATURE_PAIE.autresFrais.compte)

export const FONDEMENT_COMPTE_JAMAIS_RECUPERABLE = 'Décret n° 87-713, art. 2, c ; J67, R38 et R39'

/** Message commun à la paie et aux analytiques, sans point final : 0 % appliqué au 644 au lieu du taux repris (mis en forme). */
export const messageCompteJamaisRecuperable = (reprisPct: string): string =>
  `${libelleComptePaie('autresFrais')} : jamais récupérable, 0 % appliqué au lieu des ${reprisPct} % de l'analytique`

/**
 * J67, R38 — part récupérable reprise de l'analytique, contrôlée sans bloquer : écart avec le taux de la fonction et des
 * tâches du contrat ; « à confirmer » sans tâches saisies ; compte 644 (mutuelle, médecine du travail) mis à 0 % malgré
 * l'analytique. Le taux repris n'est jamais remplacé, sauf sur les éléments exclus (ecrituresConstatationPaie).
 */
export function controlerRecuperablePaie(salarie: SalarieSyndicat, ctx: Pick<ContextePaie, 'attributs'>): AnomaliePaie[] {
  const categorie = categorieRecuperable(salarie)
  const anomalies: AnomaliePaie[] = []
  for (const cle of LIGNES_REMUNERATION) {
    const repris = ctx.attributs?.[cle]?.recupLocatairePct
    if (repris === undefined) continue
    const tete = `${libelleComptePaie(cle)} : part récupérable de ${repris} % reprise de l'analytique`
    if (categorie === null)
      anomalies.push(
        anomalie('recuperable_a_confirmer', `${tete}, à confirmer : tâches du contrat du salarié ${salarie.id} non saisies.`, 'Décret n° 87-713, art. 2, c et d ; J67, R38'),
      )
    else if (repris !== PARTS_RECUPERABLES_DECRET_87_713[categorie])
      anomalies.push(
        anomalie(
          'recuperable_ecart',
          `${tete} ; ${PARTS_RECUPERABLES_DECRET_87_713[categorie]} % selon la fonction et les tâches du contrat du salarié ${salarie.id}.`,
          `${FONDEMENT_CATEGORIE[categorie]} ; J67, R38`,
        ),
      )
  }
  const autresFrais = ctx.attributs?.autresFrais?.recupLocatairePct
  if (autresFrais !== undefined && autresFrais > 0)
    anomalies.push(anomalie('recuperable_exclu_force', `${messageCompteJamaisRecuperable(String(autresFrais))}.`, FONDEMENT_COMPTE_JAMAIS_RECUPERABLE))
  return anomalies
}

// ─── Règlement de la paie ───────────────────────────────────────────────────────────────────

export const NATURES_REGLEMENT_PAIE = [
  'salaire_net',
  'cotisations_securite_sociale',
  'cotisations_autres_organismes',
  'prelevement_source',
  'taxe_salaires',
] as const
export type NatureReglementPaie = (typeof NATURES_REGLEMENT_PAIE)[number]
const NATURES_ADMISES: ReadonlySet<string> = new Set(NATURES_REGLEMENT_PAIE)

export const LIBELLES_NATURE_REGLEMENT_PAIE: Record<NatureReglementPaie, string> = {
  salaire_net: 'Salaire net',
  cotisations_securite_sociale: 'Cotisations de sécurité sociale',
  cotisations_autres_organismes: 'Cotisations des autres organismes sociaux',
  prelevement_source: 'Prélèvement à la source',
  taxe_salaires: 'Taxe sur les salaires',
}

const COMPTE_NATURE: Record<NatureReglementPaie, CleComptePaie> = {
  salaire_net: 'remunerations',
  cotisations_securite_sociale: 'securiteSociale',
  cotisations_autres_organismes: 'autresOrganismes',
  prelevement_source: 'etatImpots',
  taxe_salaires: 'etatImpots',
}

/**
 * Modes admis : ni « Pas de règlement », ni « Espèces » (décision J25 : aucun paiement en espèces, compte 53 non tenu ;
 * décision J40 : pas davantage pour un salarié payé sous le seuil de C. trav. L3241-1 qui le demande).
 */
export type ModeReglementPaie = Exclude<ModeReglement, 'Pas de règlement' | 'Espèces'>
const MODES_ADMIS: ReadonlySet<string> = new Set(MODE_REGLEMENT.filter((mode) => mode !== 'Pas de règlement' && mode !== 'Espèces'))

export interface ReglementPaie {
  id: string
  /** D1 : le syndicat, employeur et propriétaire des comptes de paie. */
  coproprieteId: string
  /** D1 : la mission qui règle (auteur de l'opération). */
  mandatId: string
  nature: NatureReglementPaie
  /** Salarié payé : exigé pour le salaire net, absent sinon. */
  salarieId: string | null
  /** Bulletin réglé : exigé pour le salaire net ; null : règlement sans bulletin (organismes, État). */
  bulletinId: string | null
  /** Sous-compte de l'organisme (431, 432), 5 caractères ; « 00000 » par défaut. */
  auxiliaire?: string
  montantCentimes: number
  mode: ModeReglement
  /** Compte de banque du syndicat crédité : <syndicat>.51xxx.<auxiliaire>.<repère>, segment du syndicat (D1). */
  compteBanque: string
  le: string
  /** Référence du paiement : n° de chèque, identifiant du virement ou du prélèvement (art. 4). */
  reference: string
}

/** Compte de banque complet (comme la contrepartie 512 de reglements-fournisseurs.ts, élargie au 51). */
const COMPTE_BANQUE = /^([^.]{4})\.51[0-9A-Z]{3}\.[0-9A-Z]{5}\.[0-9A-Z]$/

function anomaliesMode(mode: ModeReglement): AnomaliePaie[] {
  if (mode === 'Espèces')
    return [
      anomalie(
        'especes',
        'Espèces : paiement refusé, aucun salaire ni fournisseur n’est payé en espèces (décision J25 du cabinet) ; compte 53 « Caisse » non tenu. ' +
          'Même sous le montant mensuel fixé par décret, en dessous duquel le salaire est payé en espèces au salarié qui le demande (C. trav. L3241-1), le refus est maintenu (décision J40 du cabinet, plus strict que la loi).',
      ),
    ]
  return MODES_ADMIS.has(mode) ? [] : [anomalie('mode_invalide', `Mode « ${mode} » : chèque, virement, prélèvement ou TIP attendu.`)]
}

function anomaliesBanque(compteBanque: string, segmentSyndicat: string): AnomaliePaie[] {
  const lu = COMPTE_BANQUE.exec(compteBanque)
  if (!lu)
    return [
      anomalie('compte_banque_invalide', `Compte « ${compteBanque} » : compte de banque du syndicat (51) au format <syndicat>.51xxx.<auxiliaire>.<repère> attendu.`),
    ]
  if (lu[1] !== segmentSyndicat)
    return [anomalie('compte_banque_autre_syndicat', `Compte « ${compteBanque} » : banque d'un autre syndicat (segment « ${segmentSyndicat} » attendu, D1).`)]
  return []
}

function anomaliesFormeReglement(r: ReglementPaie, segmentSyndicat: string): AnomaliePaie[] {
  const anomalies: AnomaliePaie[] = []
  if (!NATURES_ADMISES.has(r.nature)) anomalies.push(anomalie('nature_inconnue', `Nature de règlement inconnue : « ${r.nature} ».`))
  if (!texteRenseigne(r.coproprieteId) || !texteRenseigne(r.mandatId))
    anomalies.push(anomalie('rattachement_absent', 'Règlement sans syndicat ou sans mandat (D1 : le syndicat paie, le mandat règle).'))
  if (!Number.isInteger(r.montantCentimes) || r.montantCentimes <= 0)
    anomalies.push(anomalie('montant_invalide', `Montant de ${r.montantCentimes} : centimes entiers strictement positifs attendus.`))
  if (!estDateIsoValide(r.le)) anomalies.push(anomalie('date_invalide', `Date de règlement invalide (${r.le}) : AAAA-MM-JJ attendu.`))
  anomalies.push(...anomaliesMode(r.mode))
  if (!texteRenseigne(r.reference))
    anomalies.push(anomalie('reference_absente', 'Référence du paiement absente (n° de chèque, identifiant du virement).', 'Arrêté du 14 mars 2005, art. 4'))
  anomalies.push(...anomaliesBanque(r.compteBanque, segmentSyndicat))
  if (r.auxiliaire !== undefined && !CODE_CINQ_CARACTERES.test(r.auxiliaire))
    anomalies.push(anomalie('auxiliaire_invalide', `Sous-compte « ${r.auxiliaire} » : 5 caractères attendus.`))
  return anomalies
}

/**
 * Constatation du bulletin réglé, en vigueur à la date du règlement : son traitement (traitementId) figure au grand livre
 * fourni, sans annulation, daté au plus tard du jour du règlement. Sans ce contrôle, un règlement imputé à un bulletin pas
 * encore constaté passait sur le solde du 421 laissé par un autre bulletin, qui restait « à payer », 421 soldé.
 */
function anomaliesConstatation(r: ReglementPaie, bulletin: BulletinPaieConstate, traitements: readonly Traitement[]): AnomaliePaie[] {
  if (!estDateIsoValide(r.le)) return []
  const constatation = traitements.find((t) => t.id === bulletin.traitementId)
  if (constatation === undefined)
    return [
      anomalie(
        'bulletin_non_constate',
        `Bulletin ${bulletin.id} : constatation ${bulletin.traitementId} absente du grand livre fourni ; rien n'est dû avant la constatation.`,
      ),
    ]
  if (traitements.some((t) => t.annule === constatation.id))
    return [anomalie('bulletin_non_constate', `Bulletin ${bulletin.id} : constatation ${constatation.id} annulée ; rien n'est dû sur ce bulletin.`)]
  if (constatation.date <= r.le) return []
  return [
    anomalie(
      'bulletin_non_constate',
      `Bulletin ${bulletin.id} constaté le ${dateIsoVersFr(constatation.date)}, après le règlement du ${dateIsoVersFr(r.le)} : rien n'est dû avant la constatation.`,
    ),
  ]
}

/**
 * Bulletin que le règlement du net dit régler : désigné (bulletinId), fourni, du salarié payé, cohérent et constaté à la
 * date du règlement. Sans ce contrôle, un règlement imputé au bulletin d'un autre salarié était écrit, puis bloquait tout
 * le suivi employeur.
 */
function anomaliesBulletinRegle(
  r: ReglementPaie,
  salarie: SalarieSyndicat,
  { bulletin, traitements }: Pick<ContexteReglementPaie, 'bulletin' | 'traitements'>,
): AnomaliePaie[] {
  if (r.bulletinId === null)
    return [anomalie('bulletin_requis', 'Salaire net : bulletin réglé attendu (l’échéance de salaire se solde par les règlements rattachés au bulletin).')]
  if (bulletin === null) return [anomalie('bulletin_introuvable', `Bulletin ${r.bulletinId} réglé : bulletin à fournir pour contrôler le règlement.`)]
  if (bulletin.id !== r.bulletinId)
    return [anomalie('bulletin_incoherent', `Règlement imputé au bulletin ${r.bulletinId}, bulletin fourni : ${bulletin.id}.`)]
  if (bulletin.salarieId !== salarie.id)
    return [
      anomalie('bulletin_autre_salarie', `Règlement du salarié ${salarie.id} imputé au bulletin ${bulletin.id} du salarié ${bulletin.salarieId}.`),
    ]
  const anomalies = controlerBulletinSalarie(bulletin, salarie)
  return anomalies.length > 0 ? anomalies : anomaliesConstatation(r, bulletin, traitements)
}

function anomaliesSalarieReglement(r: ReglementPaie, { salarie, ...autres }: ContexteReglementPaie): AnomaliePaie[] {
  if (r.nature !== 'salaire_net')
    return r.salarieId === null ? [] : [anomalie('salarie_inattendu', `${LIBELLES_NATURE_REGLEMENT_PAIE[r.nature]} : aucun salarié attendu.`)]
  if (!r.salarieId || !salarie) return [anomalie('salarie_requis', 'Salaire net : salarié payé attendu.')]
  if (salarie.id !== r.salarieId) return [anomalie('salarie_incoherent', `Règlement du salarié ${r.salarieId}, fiche fournie : ${salarie.id}.`)]
  if (salarie.coproprieteId !== r.coproprieteId)
    return [anomalie('salarie_autre_syndicat', `Salarié ${salarie.id} du syndicat ${salarie.coproprieteId}, règlement pour le syndicat ${r.coproprieteId} (D1).`)]
  return anomaliesBulletinRegle(r, salarie, autres)
}

function auxiliaireReglement(r: ReglementPaie, salarie: SalarieSyndicat | null, ctx: ContextePaie): string {
  if (r.nature === 'salaire_net') {
    if (!salarie) throw new Error(`Règlement ${r.id} : salarié attendu pour un salaire net.`)
    return salarie.auxiliaire421
  }
  if (r.nature === 'prelevement_source') return ctx.auxiliairePrelevementSource ?? AUXILIAIRE_ZERO
  if (r.nature === 'taxe_salaires') return ctx.auxiliaireTaxeSalaires ?? AUXILIAIRE_ZERO
  return r.auxiliaire ?? AUXILIAIRE_ZERO
}

/** Compte de paie débité : 421 du salarié, 431, 432 (sous-compte de l'organisme) ou 442 ; plan vérifié (art. 7 et 8). */
export function compteDebiteReglementPaie(r: ReglementPaie, salarie: SalarieSyndicat | null, ctx: ContextePaie): string {
  verifierPlanPaie(ctx.plan)
  return compte(ctx, COMPTE_NATURE[r.nature], auxiliaireReglement(r, salarie, ctx))
}

/** Solde créditeur d'un compte, à une date ou (sans date) tous mouvements confondus. */
const soldeCrediteur = (traitements: Traitement[], numero: string, au?: string): number =>
  balance(traitements, { compteDu: numero, compteAu: numero, ...(au === undefined ? {} : { au }) }).lignes[0]?.soldeCrediteurCentimes ?? 0

/** Règlement de paie écrit au grand livre : il garde l'identifiant du traitement qui l'a écrit (traitementReglementPaie). */
export interface ReglementPaieEcrit extends ReglementPaie {
  traitementId: string
}

/**
 * Règlements en vigueur : ceux dont le traitement figure au grand livre sans avoir été annulé (« Annulation de
 * règlements » : annulerTraitement, dont le traitement porte `annule`). Un virement rejeté puis annulé ne solde donc plus
 * rien. Lève une erreur sur un règlement dont le traitement manque au grand livre fourni (jamais compté en silence).
 */
export function reglementsEnVigueur<R extends ReglementPaieEcrit>(
  reglements: readonly R[],
  traitements: readonly Pick<Traitement, 'id' | 'annule'>[],
): R[] {
  const ecrits: ReadonlySet<string> = new Set(traitements.map((t) => t.id))
  const absent = reglements.find((r) => !ecrits.has(r.traitementId))
  if (absent) throw new Error(`Règlement ${absent.id} : traitement ${absent.traitementId} absent du grand livre fourni.`)
  const annules: ReadonlySet<string> = new Set(traitements.flatMap((t) => (t.annule === undefined ? [] : [t.annule])))
  return reglements.filter((r) => !annules.has(r.traitementId))
}

/** Net réglé par bulletin : règlements du salaire net cumulés par bulletin réglé (les autres natures sont ignorées). */
export function netRegleParBulletin(reglements: readonly ReglementPaie[]): Map<string, number> {
  const regle = new Map<string, number>()
  for (const r of reglements)
    if (r.nature === 'salaire_net' && r.bulletinId !== null) regle.set(r.bulletinId, (regle.get(r.bulletinId) ?? 0) + r.montantCentimes)
  return regle
}

export interface ContexteReglementPaie {
  salarie: SalarieSyndicat | null
  /** Bulletin constaté que le règlement du net dit régler (bulletinId) ; null pour les autres natures. */
  bulletin: BulletinPaieConstate | null
  contexte: ContextePaie
  /**
   * Traitements du syndicat : les soldes du compte de paie bornent le montant ; la constatation du bulletin réglé doit y
   * figurer ; les annulations écartent un règlement.
   */
  traitements: Traitement[]
  /** Règlements de paie déjà écrits du syndicat (annulés compris) : ils bornent le restant dû du bulletin réglé. */
  reglements: readonly ReglementPaieEcrit[]
}

interface BorneReglement {
  centimes: number
  motif: string
}

/**
 * Bornes du montant : soldes créditeurs du compte payé à la date du règlement et tous mouvements confondus ; pour le
 * net, restant dû du bulletin réglé, constaté à cette date (anomaliesConstatation) : net à payer moins les règlements en
 * vigueur qui lui sont imputés.
 */
function bornesReglement(r: ReglementPaie, numero: string, { bulletin, traitements, reglements }: ContexteReglementPaie): BorneReglement[] {
  const bornes = [
    { centimes: soldeCrediteur(traitements, numero, r.le), motif: `au ${dateIsoVersFr(r.le)}` },
    { centimes: soldeCrediteur(traitements, numero), motif: 'tous règlements comptés' },
  ]
  if (r.nature !== 'salaire_net' || bulletin === null) return bornes
  const regle = netRegleParBulletin(reglementsEnVigueur(reglements, traitements)).get(bulletin.id) ?? 0
  return [...bornes, { centimes: bulletin.netAPayerCentimes - regle, motif: `restant dû sur le bulletin ${bulletin.id}` }]
}

/**
 * Anomalies d'un règlement de paie. Le montant est borné au plus petit de deux soldes créditeurs du compte payé : à la
 * date du règlement (aucun paiement avant la constatation) et tous mouvements confondus (un règlement antidaté ne paie
 * pas une seconde fois) ; le net, en outre, au restant dû du bulletin réglé (un virement de deux mois imputé à un seul
 * bulletin laisserait l'autre « à payer », 421 soldé), bulletin constaté au plus tard le jour du règlement (sinon le
 * solde du 421 laissé par un autre bulletin paierait celui-ci). Lève une erreur sur un plan de paie invalide, ou sur un
 * règlement déjà écrit dont le traitement manque aux traitements fournis.
 */
export function controlerReglementPaie(r: ReglementPaie, contexteReglement: ContexteReglementPaie): AnomaliePaie[] {
  const { salarie, contexte } = contexteReglement
  verifierPlanPaie(contexte.plan)
  const anomalies = [...anomaliesFormeReglement(r, contexte.segmentSyndicat), ...anomaliesSalarieReglement(r, contexteReglement)]
  if (anomalies.length > 0) return anomalies
  const bornes = bornesReglement(r, compteDebiteReglementPaie(r, salarie, contexte), contexteReglement)
  const du = Math.min(...bornes.map((b) => b.centimes))
  if (r.montantCentimes <= du) return []
  return [
    anomalie(
      'reglement_superieur_au_du',
      `Règlement de ${r.montantCentimes} centimes supérieur au dû (${du} centimes : ${bornes.map((b) => `${b.centimes} ${b.motif}`).join(', ')}).`,
    ),
  ]
}

/** Débit du compte de paie / crédit de la banque. */
export function ecrituresReglementPaie(r: ReglementPaie, salarie: SalarieSyndicat | null, ctx: ContextePaie): LigneMouvement[] {
  return [
    ligne(compteDebiteReglementPaie(r, salarie, ctx), 'debit', r.montantCentimes),
    ligne(r.compteBanque, 'credit', r.montantCentimes),
  ]
}

/**
 * Traitement d'un règlement de paie contrôlé, avec le libellé de sa pièce (art. 4), et le règlement écrit, relié à ce
 * traitement (à conserver : c'est lui que lisent le restant dû des bulletins et l'échéance de salaire). Lève une erreur
 * sur une anomalie.
 */
export function traitementReglementPaie(
  id: string,
  r: ReglementPaie,
  contexte: ContexteReglementPaie,
): { traitement: Traitement; libelle: string; reglement: ReglementPaieEcrit } {
  const anomalies = controlerReglementPaie(r, contexte)
  if (anomalies.length > 0) throw new Error(`Règlement ${r.id} refusé : ${anomalies.map((a) => a.message).join(' ')}`)
  const traitement = creerTraitement({
    id,
    famille: FAMILLE_REGLEMENT_PAIE,
    date: r.le,
    mouvements: ecrituresReglementPaie(r, contexte.salarie, contexte.contexte),
  })
  return {
    traitement,
    libelle: `${LIBELLES_NATURE_REGLEMENT_PAIE[r.nature]} : règlement réf. ${r.reference.trim()} du ${dateIsoVersFr(r.le)}`,
    reglement: { ...r, traitementId: traitement.id },
  }
}

// ─── Garde contre le circuit Gestéam rejeté ─────────────────────────────────────────────────

const COMPTES_HORS_FACTURE: ReadonlySet<string> = new Set([
  COMPTES_NOMENCLATURE_PAIE.salaires.compte,
  COMPTES_NOMENCLATURE_PAIE.chargesSociales.compte,
  COMPTES_NOMENCLATURE_PAIE.taxeSalaires.compte,
])

/**
 * Une facture ne porte ni salaire (641), ni charges sociales (642), ni taxe sur les salaires (643), et un salarié n'est
 * pas un fournisseur (tranche 43 § 10, pratique rejetée). Le 644 reste admis (service de santé au travail, mutuelle).
 */
export function controlerFactureHorsPaie(lignes: readonly Pick<LigneFacture, 'comptePlan'>[], typeTiers: TypeEntreprise | null): AnomaliePaie[] {
  const anomalies = lignes
    .filter((l) => COMPTES_HORS_FACTURE.has(l.comptePlan.slice(0, 3)))
    .map((l) =>
      anomalie(
        'salaire_en_facture',
        `Compte ${l.comptePlan} (frais de personnel) : salaire, charges sociales et taxe sur les salaires ne passent pas par une facture ; paie constatée au 421.`,
        'Arrêté du 14 mars 2005, art. 3 et 10',
      ),
    )
  if (typeTiers === 'Salarié')
    anomalies.push(
      anomalie('tiers_salarie_en_fournisseur', 'Tiers « Salarié » : un salarié du syndicat n’est pas un fournisseur ; son salaire se règle au 421.', 'Arrêté du 14 mars 2005, art. 10'),
    )
  return anomalies
}

// ─── Identifiants du syndicat employeur ─────────────────────────────────────────────────────

/** Alerte de gestion (jamais bloquante) par identifiant employeur absent, dès qu'un salarié est en poste. */
export function controlerIdentifiantsEmployeur(
  salaries: readonly SalarieSyndicat[],
  aujourdhui: string,
  identifiants: Partial<Record<IdentifiantEmployeur, string | null>>,
): AnomaliePaie[] {
  verifierAujourdhui(aujourdhui)
  if (!salaries.some((s) => estEnPoste(s, aujourdhui))) return []
  return IDENTIFIANTS_EMPLOYEUR.filter((nom) => !identifiants[nom]?.trim()).map((nom) =>
    anomalie('identifiant_employeur_absent', `Identifiant employeur « ${nom} » absent alors qu'un salarié est en poste.`, FONDEMENT_IDENTIFIANT[nom] ?? null),
  )
}
