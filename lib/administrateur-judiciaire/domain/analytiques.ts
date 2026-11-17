import { ajouterMois, dateIsoVersFr, decomposerDateIso, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  realiseBudget,
  type Budget,
  type Exercice,
  type LigneBudget,
  type MouvementBudget,
} from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import type { LigneFacture } from '@/lib/administrateur-judiciaire/domain/facture-ventilee'
import { estPourcentage, type FamilleTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Fiche analytique et alertes de dépense (point 28 du bilan Gestéam → VitFix). Fonctions pures, montants en CENTIMES
 * ENTIERS, dates ISO, sans écran ni table (db/schema.ts inchangé).
 *
 * Sources Gestéam (cartographie) :
 * 🟢 T43 § 14 et T13 § 4.1 — fiche « Réglages → 3 - Analytiques » (≈ 450 codes) : Compte plan, Rubrique, Code fiscal,
 *    T.V.A. (+ « Libre »), Unité, Clé, « Non soumis honoraires », Récupérable %, « Non déductible », Taux hono. %, Libellé
 *    (modèle), Dossier, Groupe dépenses, Domaine. « Alerte contrat » : « si par rapport à la facture précédente le
 *    dépassement atteint n % ». « Alerte budget » : « si le rythme de dépenses dépasse le budget progressif de l'exercice
 *    de n % », avec une répartition mensuelle J F M A M J J A S O N D en %. La ligne porte l'analytique, l'analytique
 *    porte la clé.
 * 🟢 T21 § 9.1 — code de 3 caractères alphanumériques (série X01 à X0H) ; un même code porte parfois deux analytiques :
 *    identifiant propre, code non unique.
 * 🟢 T24 § 5 — fiche 010 : compte 64100, rubrique 010, TVA « Libre », récupérable 75 %, clé VIDE au paramétrage.
 * 🟢 T43 § 9 — budget ventilé par clé, rubrique et prévu ; exercice décalé possible. T43 § 7 — l'écriture porte ses liens
 *    (contrat, fournisseur, lot…).
 * ⚪ Non modélisés (sens non observé) : Montant, Consommation, « Contrôle non pertinent », onglets Mouvements et A imputer ;
 *    contenu des référentiels Rubrique, Code fiscal, TVA et Unité (chaînes libres ici).
 *
 * Droit (relevé Légifrance du 29/10/2026) — les deux alertes sont des règles de GESTION : aucun texte ne prévoit d'alerte
 * de hausse, de budget « progressif », de saisonnalité mensuelle ni de seuil en %. Textes qui bornent les choix :
 * - arrêté du 14/03/2005 relatif aux comptes du syndicat, art. 3 : opérations enregistrées toutes taxes comprises, montant
 *   et taux de TVA indiqués si un copropriétaire s'est déclaré assujetti → montants TTC ; la TVA de la fiche est un code,
 *   jamais un taux inventé ;
 * - loi n° 65-557, art. 14-3 al. 2 : charges enregistrées dès leur engagement juridique, indépendamment de leur règlement
 *   → le réalisé du budget progressif se lit à la date de l'écriture de charge, pas à celle du paiement ;
 * - décret n° 2005-240, art. 5 : exercice de douze mois, premier exercice de dix-huit mois au plus → la saisonnalité suit
 *   les mois réels de l'exercice, qui ne commence pas forcément en janvier ;
 * - arrêté du 8/10/2015 (rémunération de l'administrateur provisoire), art. 10 : droit proportionnel calculé sur le
 *   montant HORS TAXE des dépenses courantes → la base d'honoraires d'une ligne est le HT fourni, jamais le TTC. Le taux
 *   n'est pas unique : art. 10, 3,5 % si le budget prévisionnel n'excède pas 15 000 €, 3 % au-delà ; art. 11, barème
 *   dégressif sur le HT des travaux de l'art. 44 du décret n° 67-223 et des travaux urgents, hors administration
 *   provisoire renforcée ; art. 3, rémunération entière fixée par le juge à partir de 500 lots → le taux de la fiche
 *   n'est ici qu'une saisie, jamais déduit ni contrôlé contre ces barèmes ;
 * - arrêté du 14/03/2005, art. 2 : deux balances en concordance, l'une par comptes, l'autre par clés du règlement de
 *   copropriété → toute ligne imputée porte un compte ET une clé : sans clé, pas de ligne ;
 * - arrêté du 14/03/2005, art. 8 : seuls les comptes de l'arrêté et leurs subdivisions sont utilisables → la fiche ne
 *   contrôle ici que la forme du code (5 caractères) ; l'appartenance au plan relève de plan-comptable.ts (point 29, non
 *   modifié), à brancher une fois ce point fusionné ;
 * - arrêté du 14/03/2005, art. 4 : chaque écriture identifie sa pièce (date et numéro de facture) → le libellé modèle de
 *   la fiche ne dispense pas de ces références ;
 * - décret n° 67-223, art. 44 : les travaux qu'il énumère sont hors budget prévisionnel → une analytique de travaux n'a pas
 *   de ligne au budget (statut « hors budget ») ; son suivi se fait par opération, pas au budget progressif ;
 * - loi n° 89-462, art. 23 (dernier alinéa) : le coût récupérable d'un contrat d'entreprise est la dépense TTC → la part
 *   récupérable s'applique au TTC. Aucun texte de la copropriété n'impose de la calculer : information de gestion pour
 *   les copropriétaires bailleurs, sans effet sur la répartition entre copropriétaires.
 *
 * 🔵 Choix déduits :
 * - la clé du syndicat l'emporte sur celle de la fiche (T24 : vide au paramétrage) ; sans l'une ni l'autre, pas de ligne ;
 * - la ligne de facture porte l'identifiant de la fiche (le code n'est pas unique), sa marque « non déductible » et, s'il
 *   est fourni (proposerImputationFacture), le contrat, reporté en lien contratId de l'écriture (T43 § 7) : sans ce lien,
 *   une facture de contrat serait contrôlée deux fois (prix attendu et facture précédente) ;
 * - montant d'une ligne : centimes entiers strictement positifs, comme creerTraitement (seul chemin d'écriture) ; un
 *   avoir ne s'impute pas par une ligne négative, que l'écriture refuserait ;
 * - honoraires : « Non soumis honoraires » ou taux absent → ni base ni taux ; sinon taux de la fiche et base = HT fourni,
 *   à compléter (null) sans HT ; un taux non nul sur une fiche « non soumise » est incohérent ;
 * - facture précédente : même analytique, hors contrat, date strictement antérieure, montant positif, la plus récente
 *   (départage par identifiant). Une facture est un traitement « Saisie de factures », « Facture, Bon à payer » ou
 *   « Import de factures », hors traitement annulé ou d'annulation (R6) ; son montant par analytique et par contrat =
 *   débits − crédits : une facture qui mêle, sur une analytique, des lignes sous contrat et hors contrat donne une
 *   dépense par contrat et une hors contrat, contrôlée et utilisable comme précédente ;
 * - une facture rattachée à un contrat relève de controlerFactureContrat (prix attendu) : pas de double alerte ;
 * - « dépassement atteint n % » : hausse ≥ n % (≥), calcul entier exact ; une baisse ou un montant identique n'alerte
 *   jamais ; le pourcentage affiché est en centièmes, arrondi par défaut : il atteint le seuil si et seulement si
 *   l'alerte est levée (un arrondi au plus proche afficherait « 10 % » pour 9,96 %, sous un seuil de 10 %) ;
 * - montants des dépenses et des mouvements : centimes entiers (strictement positifs pour un mouvement, comme
 *   creerTraitement), refusés sinon par une erreur explicite ;
 * - budget progressif : périodes d'un mois à partir de l'ouverture (un exercice ouvert le 15 juillet compte douze
 *   périodes, pas treize mois) ; chaque période pèse le poids de son mois civil de début ; le mois en cours compte
 *   entier ; saisonnalité absente, ou nulle sur tous les mois de l'exercice → parts égales ;
 * - réalisé = débits − crédits de la ligne de budget (clé, compte, rubrique) de l'ouverture à la date d'arrêté
 *   (realiseBudget) : deux analytiques sur la même ligne partagent le même réalisé ; budget progressif nul et dépense
 *   engagée → alerte ; une analytique sans ligne au budget (travaux, notamment) est « hors budget » ; les traitements
 *   « Répartition de charges » et leur annulation sont écartés du réalisé (ils répartissent la dépense, ils ne
 *   l'engagent pas).
 *
 * 🔴 Non établi — questions pour Hugo (ce que montre Gestéam) :
 * (a) Gestéam impose-t-il un total de 100 % aux douze pondérations du budget progressif ? (VitFix l'exige.)
 * (b) Le budget progressif compte-t-il le mois en cours entier, ou au prorata des jours écoulés ? (VitFix : entier.)
 * (c) Pour un exercice décalé (juillet → juin), la case « J » vaut-elle janvier, mois civil ? (VitFix : oui.)
 * (d) La « facture précédente » est-elle la dernière de la même analytique tous fournisseurs confondus, ou du même
 *     fournisseur ? (VitFix : tous fournisseurs.)
 * (e) L'« Alerte contrat » s'applique-t-elle aussi aux factures rattachées à un contrat ? Une facture qui mêle des lignes
 *     sous contrat et hors contrat sur la même analytique est-elle comparée en entier ou pour sa seule part hors
 *     contrat ? (VitFix : non ; part hors contrat seule.)
 * (f) La « Base » d'honoraires d'une ligne est-elle le HT, le TTC ou la « Consommation » ? Le « Taux hono. % » de la fiche
 *     sert-il à l'administrateur provisoire, dont le taux est fixé par l'arrêté du 8/10/2015 (art. 10 : 3,5 % si le
 *     budget prévisionnel n'excède pas 15 000 €, 3 % au-delà ; art. 11 : barème dégressif pour les travaux ; art. 3 :
 *     fixé par le juge à partir de 500 lots) ?
 * (g) Le champ T.V.A. est-il un taux ou un code, et que change « Libre » ?
 * (h) Que signifient Montant, Consommation, « Contrôle non pertinent » et « Non déductible » (TVA d'un copropriétaire
 *     assujetti, revenus fonciers, autre) ?
 * (i) Part récupérable : la limiter aux pourcentages du décret n° 87-713 pour le personnel (75, 40, 100, 10 %) ou la
 *     laisser libre ? (VitFix : libre, de 0 à 100 %.)
 * (j) Une « Répartition de charges » passe-t-elle des écritures sur les comptes de charges (classe 6) avec clé et
 *     rubrique ? (VitFix : elle est de toute façon écartée du réalisé du budget progressif.)
 * 🔴 Questions pour Frédéric :
 * (k) La clé est-elle portée par la fiche du cabinet ou par le syndicat ? Une ligne de facture peut-elle remplacer la clé
 *     ou le compte de son analytique ?
 * (l) Seuils par défaut (aucun ici : sans seuil, aucune alerte) ; comparaison des factures en TTC (retenu) ou en HT ?
 * (m) Quel budget de référence tant que le budget de l'exercice n'est pas voté ?
 */

export const MOIS_PAR_AN = 12

/** 100 % exprimé en centièmes de % : unité entière des pondérations et des seuils. */
const CENTIEMES_100_PCT = 10_000

/** Pondération mensuelle du budget progressif, de janvier à décembre, en % (deux décimales au plus, total 100 %). */
export type Saisonnalite = readonly [number, number, number, number, number, number, number, number, number, number, number, number]

export interface FicheAnalytique {
  /** Identifiant propre : le code n'est pas unique (T21 § 9.1). */
  id: string
  /** 3 caractères, chiffres ou majuscules (« 010 », « X0H »). */
  code: string
  libelle: string
  horsService: boolean
  /** Code du plan, 5 caractères (compte de charge de l'analytique). */
  comptePlan: string
  rubrique: string | null
  codeFiscal: string | null
  /** Code du référentiel TVA (non relevé), jamais un taux. */
  tva: string | null
  tvaLibre: boolean
  unite: string | null
  /** Code de la clé de répartition ; vide au paramétrage (T24 § 5). */
  cle: string | null
  /** Part récupérable sur le locataire, en %. */
  recuperablePct: number
  nonSoumisHonoraires: boolean
  nonDeductible: boolean
  tauxHonorairesPct: number | null
  /** Libellé d'écriture proposé ; ne dispense pas des références de la pièce (date et numéro de facture). */
  libelleEcriture: string | null
  dossier: string | null
  groupeDepenses: string | null
  domaine: string | null
  /** Gestéam « Alerte contrat » : hausse par rapport à la facture précédente, en %. */
  alerteHaussePct: number | null
  /** Gestéam « Alerte budget » : dépassement du budget progressif, en %. */
  alerteBudgetPct: number | null
  saisonnalite: Saisonnalite | null
}

/** Champs texte facultatifs de la fiche : nettoyés à la création, vide → null. */
const CHAMPS_FACULTATIFS = [
  'rubrique',
  'codeFiscal',
  'tva',
  'unite',
  'cle',
  'libelleEcriture',
  'dossier',
  'groupeDepenses',
  'domaine',
] as const satisfies readonly (keyof FicheAnalytique)[]

/** Champs facultatifs de la saisie : textes, taux d'honoraires, seuils et saisonnalité (absent → null). */
type ChampFacultatif = (typeof CHAMPS_FACULTATIFS)[number] | 'tauxHonorairesPct' | 'alerteHaussePct' | 'alerteBudgetPct' | 'saisonnalite'

/** Saisie d'une fiche : les champs facultatifs peuvent être omis. */
export type SaisieFicheAnalytique = Omit<FicheAnalytique, ChampFacultatif> & Partial<Pick<FicheAnalytique, ChampFacultatif>>

export interface AnomalieAnalytique {
  code:
    | 'code_invalide'
    | 'compte_invalide'
    | 'recuperable_invalide'
    | 'honoraires_invalide'
    | 'honoraires_incoherents'
    | 'seuil_invalide'
    | 'saisonnalite_invalide'
  message: string
}

/** Valeur en % → centièmes de % entiers ; null si ce n'est pas un nombre fini à deux décimales au plus. */
function enCentiemes(valeur: unknown): number | null {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return null
  const centiemes = Math.round(valeur * 100)
  return Math.abs(valeur * 100 - centiemes) < 1e-6 ? centiemes : null
}

const seuilValide = (seuil: number | null): boolean => {
  if (seuil === null) return true
  const centiemes = enCentiemes(seuil)
  return centiemes !== null && centiemes >= 0
}

/** Saisonnalité en centièmes de % (12 valeurs de 0 à 100 %, total exactement 100 %) ; null si invalide. */
function centiemesSaisonnalite(saisonnalite: readonly number[]): number[] | null {
  if (!Array.isArray(saisonnalite) || saisonnalite.length !== MOIS_PAR_AN) return null
  const centiemes: number[] = []
  for (const valeur of saisonnalite) {
    const c = enCentiemes(valeur)
    if (c === null || c < 0 || c > CENTIEMES_100_PCT) return null
    centiemes.push(c)
  }
  return centiemes.reduce((s, c) => s + c, 0) === CENTIEMES_100_PCT ? centiemes : null
}

const MESSAGE_SAISONNALITE = 'Saisonnalité : 12 valeurs de 0 à 100 %, deux décimales au plus, total exactement 100 %.'

const REGLES_FICHE: readonly {
  code: AnomalieAnalytique['code']
  valide: (f: FicheAnalytique) => boolean
  message: (f: FicheAnalytique) => string
}[] = [
  {
    code: 'code_invalide',
    valide: (f) => /^[0-9A-Z]{3}$/.test(f.code),
    message: (f) => `Code analytique « ${f.code} » : 3 caractères (chiffres ou majuscules) attendus.`,
  },
  {
    code: 'compte_invalide',
    valide: (f) => /^[0-9A-Z]{5}$/.test(f.comptePlan),
    message: (f) => `Compte « ${f.comptePlan} » : code du plan sur 5 caractères attendu.`,
  },
  {
    code: 'recuperable_invalide',
    valide: (f) => estPourcentage(f.recuperablePct),
    message: (f) => `Part récupérable de ${f.recuperablePct} % : entre 0 et 100 attendue.`,
  },
  {
    code: 'honoraires_invalide',
    valide: (f) => f.tauxHonorairesPct === null || estPourcentage(f.tauxHonorairesPct),
    message: (f) => `Taux d'honoraires de ${f.tauxHonorairesPct} % : entre 0 et 100 attendu.`,
  },
  {
    code: 'honoraires_incoherents',
    valide: (f) => !f.nonSoumisHonoraires || !f.tauxHonorairesPct,
    message: (f) => `Analytique « non soumise honoraires » avec un taux de ${f.tauxHonorairesPct} % : retirer l'un ou l'autre.`,
  },
  {
    code: 'seuil_invalide',
    valide: (f) => seuilValide(f.alerteHaussePct) && seuilValide(f.alerteBudgetPct),
    message: (f) =>
      `Seuils d'alerte (hausse ${f.alerteHaussePct} %, budget ${f.alerteBudgetPct} %) : nombres positifs ou nuls, deux décimales au plus.`,
  },
  {
    code: 'saisonnalite_invalide',
    valide: (f) => f.saisonnalite === null || centiemesSaisonnalite(f.saisonnalite) !== null,
    message: () => MESSAGE_SAISONNALITE,
  },
]

export const controlerFicheAnalytique = (fiche: FicheAnalytique): AnomalieAnalytique[] =>
  REGLES_FICHE.filter((regle) => !regle.valide(fiche)).map((regle) => ({ code: regle.code, message: regle.message(fiche) }))

function exigerFicheValide(fiche: FicheAnalytique): void {
  const [premiere] = controlerFicheAnalytique(fiche)
  if (premiere) throw new Error(`Fiche analytique refusée : ${premiere.message}`)
}

/** Texte facultatif : espaces retirés, vide → null. */
const texte = (valeur: string | null | undefined): string | null => {
  const nettoye = valeur?.trim() ?? ''
  return nettoye === '' ? null : nettoye
}

/** Crée la fiche : textes nettoyés (vide → null), champs omis → null ; lève une erreur sur la première anomalie. */
export function creerFicheAnalytique(saisie: SaisieFicheAnalytique): FicheAnalytique {
  const id = texte(saisie.id)
  if (!id) throw new Error('Fiche analytique sans identifiant : le code n’est pas unique, un identifiant propre est requis.')
  const facultatifs = Object.fromEntries(CHAMPS_FACULTATIFS.map((champ) => [champ, texte(saisie[champ])])) as Pick<
    FicheAnalytique,
    (typeof CHAMPS_FACULTATIFS)[number]
  >
  const fiche: FicheAnalytique = {
    ...saisie,
    ...facultatifs,
    id,
    code: saisie.code.trim(),
    libelle: saisie.libelle.trim(),
    comptePlan: saisie.comptePlan.trim(),
    tauxHonorairesPct: saisie.tauxHonorairesPct ?? null,
    alerteHaussePct: saisie.alerteHaussePct ?? null,
    alerteBudgetPct: saisie.alerteBudgetPct ?? null,
    saisonnalite: saisie.saisonnalite ?? null,
  }
  exigerFicheValide(fiche)
  return fiche
}

/** Clé de répartition retenue : celle du syndicat, à défaut celle de la fiche ; null sans l'une ni l'autre. */
export const cleEffective = (fiche: FicheAnalytique, cleSyndicat?: string | null): string | null =>
  texte(cleSyndicat) ?? texte(fiche.cle)

export interface ImputationAnalytique {
  montantTtcCentimes: number
  /** Montant hors taxe de la ligne : base des honoraires ; absent, la base reste à compléter. */
  montantHtCentimes?: number | null
  /** Clé fixée par le syndicat ; l'emporte sur celle de la fiche. */
  cleSyndicat?: string | null
  lotId?: string | null
  rattachement?: LigneFacture['rattachement']
  /** Contrat au titre duquel la facture est reçue. */
  contratId?: string | null
}

function honorairesLigne(
  fiche: FicheAnalytique,
  montantTtcCentimes: number,
  montantHtCentimes: number | null,
): Pick<LigneFacture, 'baseHonorairesCentimes' | 'tauxHonorairesPct'> {
  if (montantHtCentimes !== null && (!Number.isSafeInteger(montantHtCentimes) || montantHtCentimes < 0 || montantHtCentimes > montantTtcCentimes))
    throw new Error(
      `Montant hors taxe de ${montantHtCentimes} centimes : centimes entiers entre 0 et le montant TTC (${montantTtcCentimes}) attendus.`,
    )
  if (fiche.nonSoumisHonoraires || fiche.tauxHonorairesPct === null) return { baseHonorairesCentimes: null, tauxHonorairesPct: null }
  return { baseHonorairesCentimes: montantHtCentimes, tauxHonorairesPct: fiche.tauxHonorairesPct }
}

/** Vrai pour des centimes entiers strictement positifs (règle de creerTraitement). */
const estCentimesPositifs = (montant: number): boolean => Number.isSafeInteger(montant) && montant > 0

/**
 * Ligne de facture imputée sur une analytique : compte, rubrique, code fiscal, part récupérable et marque « non
 * déductible » de la fiche ; clé du syndicat, à défaut de la fiche ; honoraires selon la fiche (base = HT fourni).
 * Refuse une fiche invalide ou hors service, un montant nul, négatif ou non entier (creerTraitement le refuserait à
 * l'écriture), une ligne sans clé.
 */
export function ligneDepuisAnalytique(fiche: FicheAnalytique, saisie: ImputationAnalytique): LigneFacture {
  exigerFicheValide(fiche)
  if (fiche.horsService) throw new Error(`Analytique ${fiche.code} hors service : imputation refusée.`)
  const { montantTtcCentimes } = saisie
  if (!estCentimesPositifs(montantTtcCentimes))
    throw new Error(`Montant invalide (${montantTtcCentimes}) : centimes entiers strictement positifs attendus.`)
  const cle = cleEffective(fiche, saisie.cleSyndicat)
  if (!cle) throw new Error(`Analytique ${fiche.code} sans clé : choisir la clé du syndicat.`)
  return {
    comptePlan: fiche.comptePlan,
    analytique: fiche.id,
    cleRepartition: cle,
    rubrique: fiche.rubrique,
    codeFiscal: fiche.codeFiscal,
    montantTtcCentimes,
    recupLocatairePct: fiche.recuperablePct,
    nonDeductible: fiche.nonDeductible,
    lotId: saisie.lotId ?? null,
    rattachement: saisie.rattachement ?? null,
    ...honorairesLigne(fiche, montantTtcCentimes, saisie.montantHtCentimes ?? null),
    ...(saisie.contratId ? { contratId: saisie.contratId } : {}),
  }
}

// ---------------------------------------------------------------------------
// Alerte de hausse par rapport à la facture précédente (hors contrat)
// ---------------------------------------------------------------------------

/** Dépense d'une facture sur une analytique (montant TTC net de la facture pour cette analytique). */
export interface DepenseAnalytique {
  /** Traitement de la facture. */
  id: string
  date: string
  /** Identifiant de la fiche analytique. */
  analytique: string
  montantTtcCentimes: number
  contratId: string | null
}

/** Familles de traitement qui enregistrent une facture (référentiel FAMILLE_TRAITEMENT, bloc Factures). */
const FAMILLES_FACTURE: ReadonlySet<FamilleTraitement> = new Set<FamilleTraitement>([
  'Saisie de factures',
  'Facture, Bon à payer',
  'Import de factures',
])

/** Une dépense par (analytique, contrat) : la part hors contrat d'une facture mixte reste à part. */
function depensesDuTraitement(traitement: Traitement): DepenseAnalytique[] {
  const parAnalytiqueEtContrat = new Map<string, DepenseAnalytique>()
  for (const m of traitement.mouvements) {
    const analytique = m.attributs?.analytique
    if (!analytique) continue
    const contratId = m.liens?.contratId ?? null
    const cle = `${analytique}|${contratId ?? ''}`
    const depense = parAnalytiqueEtContrat.get(cle) ?? { id: traitement.id, date: traitement.date, analytique, montantTtcCentimes: 0, contratId }
    depense.montantTtcCentimes += m.sens === 'debit' ? m.montantCentimes : -m.montantCentimes
    parAnalytiqueEtContrat.set(cle, depense)
  }
  return [...parAnalytiqueEtContrat.values()]
}

/**
 * Dépenses par facture, par analytique et par contrat, tirées des traitements d'UN syndicat : factures seulement, sans
 * les factures annulées ni les annulations (R6) ; montant = débits − crédits de l'analytique pour ce contrat (ou hors
 * contrat).
 */
export function depensesDepuisTraitements(traitements: Traitement[]): DepenseAnalytique[] {
  const annules = new Set(traitements.flatMap((t) => (t.annule ? [t.annule] : [])))
  return traitements.filter((t) => FAMILLES_FACTURE.has(t.famille) && !t.annule && !annules.has(t.id)).flatMap(depensesDuTraitement)
}

/** Seuil en % → centièmes de % entiers ; lève une erreur s'il est négatif ou a plus de deux décimales. */
function seuilEnCentiemes(seuilPct: number): number {
  const centiemes = enCentiemes(seuilPct)
  if (centiemes === null || centiemes < 0)
    throw new Error(`Seuil d'alerte de ${seuilPct} % : nombre positif ou nul, deux décimales au plus, attendu.`)
  return centiemes
}

/** Vrai si `montant` dépasse `reference` d'au moins `seuilCentiemes` centièmes de % (entiers exacts). */
function depasseDe(montant: number, reference: number, seuilCentiemes: number): boolean {
  if (montant <= reference) return false
  return (BigInt(montant) - BigInt(reference)) * BigInt(CENTIEMES_100_PCT) >= BigInt(seuilCentiemes) * BigInt(reference)
}

/**
 * Écart relatif en %, en centièmes arrondis par défaut (vers −∞), calcul entier exact ; null si la référence n'est pas
 * positive. Le seuil étant un nombre entier de centièmes, l'écart affiché l'atteint si et seulement si l'écart exact
 * l'atteint : le pourcentage lu ne contredit jamais le statut.
 */
function ecartPct(montant: number, reference: number): number | null {
  if (reference <= 0) return null
  const numerateur = (BigInt(montant) - BigInt(reference)) * BigInt(CENTIEMES_100_PCT)
  const diviseur = BigInt(reference)
  const quotient = numerateur / diviseur
  const parDefaut = numerateur % diviseur < BigInt(0) ? quotient - BigInt(1) : quotient
  return Number(parDefaut) / 100
}

const pourcentFr = (valeur: number): string => String(valeur).replace('.', ',')

/** Lève une erreur si le montant n'est pas en centimes entiers. */
function exigerCentimesEntiers(montant: number, quoi: string): void {
  if (!Number.isSafeInteger(montant)) throw new Error(`${quoi} invalide (${montant}) : centimes entiers attendus.`)
}

function precedenteHorsContrat(courante: DepenseAnalytique, historique: DepenseAnalytique[]): DepenseAnalytique | null {
  let retenue: DepenseAnalytique | null = null
  for (const d of historique) {
    if (d.analytique !== courante.analytique) continue
    exigerCentimesEntiers(d.montantTtcCentimes, `Montant de la facture ${d.id}`)
    const eligible = !d.contratId && d.date < courante.date && d.montantTtcCentimes > 0
    if (eligible && (!retenue || d.date > retenue.date || (d.date === retenue.date && d.id > retenue.id))) retenue = d
  }
  return retenue
}

export type StatutHausse = 'sans_seuil' | 'sous_contrat' | 'sans_precedente' | 'conforme' | 'alerte'

export interface ControleHausse {
  statut: StatutHausse
  precedente: DepenseAnalytique | null
  /** Hausse par rapport à la précédente, en %, centièmes arrondis par défaut (négative pour une baisse). */
  haussePct: number | null
  seuilPct: number | null
  message: string
}

/** Message d'un contrôle de hausse ayant une précédente ; un montant identique n'est pas « sous le seuil » de 0 %. */
function messageHausse(alerte: boolean, courante: DepenseAnalytique, precedente: DepenseAnalytique, haussePct: number, seuilPct: number): string {
  const quand = `la facture du ${dateIsoVersFr(precedente.date)}`
  if (alerte) return `Hausse de ${pourcentFr(haussePct)} % par rapport à ${quand} (seuil ${pourcentFr(seuilPct)} %).`
  if (courante.montantTtcCentimes === precedente.montantTtcCentimes) return `Montant identique à ${quand} : aucune hausse.`
  return `Écart de ${pourcentFr(haussePct)} % avec ${quand}, sous le seuil de ${pourcentFr(seuilPct)} %.`
}

/**
 * Gestéam « Alerte contrat » : alerte si, par rapport à la facture précédente de la même analytique, la hausse atteint
 * le seuil (≥). Hors contrat : une facture rattachée à un contrat relève de controlerFactureContrat. `historique` : les
 * dépenses du même syndicat (depensesDepuisTraitements), la facture contrôlée peut y figurer. Refuse un montant qui
 * n'est pas en centimes entiers (facture contrôlée ou dépense de la même analytique).
 */
export function controlerHausseFacture(courante: DepenseAnalytique, historique: DepenseAnalytique[], seuilPct: number | null): ControleHausse {
  const vide = { precedente: null, haussePct: null, seuilPct }
  if (seuilPct === null) return { ...vide, statut: 'sans_seuil', message: 'Aucun seuil d’alerte de hausse sur cette analytique.' }
  const seuil = seuilEnCentiemes(seuilPct)
  if (!estDateIsoValide(courante.date)) throw new Error(`Date de facture invalide (${courante.date}) : AAAA-MM-JJ attendu.`)
  exigerCentimesEntiers(courante.montantTtcCentimes, `Montant de la facture ${courante.id}`)
  if (courante.contratId)
    return { ...vide, statut: 'sous_contrat', message: 'Facture au titre d’un contrat : contrôlée sur le prix attendu du contrat.' }
  const precedente = precedenteHorsContrat(courante, historique)
  if (!precedente)
    return { ...vide, statut: 'sans_precedente', message: 'Aucune facture précédente hors contrat sur cette analytique.' }
  const haussePct = ecartPct(courante.montantTtcCentimes, precedente.montantTtcCentimes) ?? 0
  const alerte = depasseDe(courante.montantTtcCentimes, precedente.montantTtcCentimes, seuil)
  return {
    precedente,
    haussePct,
    seuilPct,
    statut: alerte ? 'alerte' : 'conforme',
    message: messageHausse(alerte, courante, precedente, haussePct, seuilPct),
  }
}

// ---------------------------------------------------------------------------
// Budget progressif
// ---------------------------------------------------------------------------

type PeriodeExercice = Pick<Exercice, 'ouverture' | 'cloture'>

function verifierPeriode({ ouverture, cloture }: PeriodeExercice, dateArrete: string): void {
  if (!estDateIsoValide(ouverture)) throw new Error(`Date d'ouverture invalide (${ouverture}) : AAAA-MM-JJ attendu.`)
  if (!estDateIsoValide(cloture)) throw new Error(`Date de clôture invalide (${cloture}) : AAAA-MM-JJ attendu.`)
  if (cloture <= ouverture) throw new Error('Date de clôture antérieure ou égale à l’ouverture.')
  if (!estDateIsoValide(dateArrete)) throw new Error(`Date d'arrêté invalide (${dateArrete}) : AAAA-MM-JJ attendu.`)
}

/** Débuts des périodes d'un mois de l'exercice : ouverture + k mois, tant qu'ils ne dépassent pas la clôture. */
function debutsDePeriodes({ ouverture, cloture }: PeriodeExercice): string[] {
  const debuts: string[] = []
  let debut = ouverture
  while (debut <= cloture) {
    debuts.push(debut)
    debut = ajouterMois(ouverture, debuts.length)
  }
  return debuts
}

/** Poids de chaque période : celui de son mois civil de début ; parts égales sans saisonnalité ou si tout pèse 0. */
function poidsDesPeriodes(saisonnalite: Saisonnalite | null, debuts: string[]): number[] {
  const egaux = debuts.map(() => 1)
  if (saisonnalite === null) return egaux
  const centiemes = centiemesSaisonnalite(saisonnalite)
  if (!centiemes) throw new Error(MESSAGE_SAISONNALITE)
  const poids = debuts.map((debut) => centiemes[decomposerDateIso(debut).m - 1])
  return poids.some((p) => p > 0) ? poids : egaux
}

/**
 * Poids écoulés et poids total de l'exercice à la date d'arrêté (entiers : centièmes de % de la saisonnalité, ou un par
 * mois à parts égales). Une période est écoulée dès que son début est atteint (le mois en cours compte entier) ; rien
 * avant l'ouverture, tout après la clôture.
 */
export function poidsEcoules(saisonnalite: Saisonnalite | null, exercice: PeriodeExercice, dateArrete: string): { ecoules: number; total: number } {
  verifierPeriode(exercice, dateArrete)
  const debuts = debutsDePeriodes(exercice)
  const poids = poidsDesPeriodes(saisonnalite, debuts)
  let ecoules = 0
  let total = 0
  debuts.forEach((debut, rang) => {
    total += poids[rang]
    if (debut <= dateArrete) ecoules += poids[rang]
  })
  return { ecoules, total }
}

/** Budget progressif à la date d'arrêté : prévu × poids écoulés / poids total, arrondi au centime le plus proche. */
export function budgetProgressif(prevuCentimes: number, saisonnalite: Saisonnalite | null, exercice: PeriodeExercice, dateArrete: string): number {
  if (!Number.isSafeInteger(prevuCentimes) || prevuCentimes < 0)
    throw new Error(`Montant prévu invalide (${prevuCentimes}) : centimes entiers positifs ou nuls attendus.`)
  const { ecoules, total } = poidsEcoules(saisonnalite, exercice, dateArrete)
  const deux = BigInt(2)
  return Number((deux * BigInt(prevuCentimes) * BigInt(ecoules) + BigInt(total)) / (deux * BigInt(total)))
}

/** Mouvement de budget daté (date du traitement), pour borner le réalisé à la date d'arrêté. */
export interface MouvementBudgetDate extends MouvementBudget {
  date: string
}

/** Familles qui répartissent la dépense entre copropriétaires sans l'engager : hors réalisé du budget progressif. */
const FAMILLES_REPARTITION: ReadonlySet<FamilleTraitement> = new Set<FamilleTraitement>([
  'Répartition de charges',
  'Annulation répartition de charges',
])

/**
 * Mouvements portant une clé et une rubrique, datés de leur traitement ; les annulations se compensent (débits −
 * crédits). Les répartitions de charges (et leurs annulations) ne sont pas des dépenses : écartées.
 */
export function mouvementsBudgetDepuisTraitements(traitements: Traitement[]): MouvementBudgetDate[] {
  return traitements.filter((t) => !FAMILLES_REPARTITION.has(t.famille)).flatMap((t) =>
    t.mouvements.flatMap((m) => {
      const cle = m.attributs?.cle
      const rubrique = m.attributs?.rubrique
      if (!cle || !rubrique) return []
      return [{ date: t.date, compte: m.compte, cle, rubrique, sens: m.sens, montantCentimes: m.montantCentimes }]
    }),
  )
}

type CibleBudget = Pick<LigneBudget, 'cle' | 'compte' | 'rubrique'>

const cleCible = (l: CibleBudget): string => `${l.cle}|${l.compte}|${l.rubrique}`

interface ContexteBudget {
  budget: Budget
  exercice: PeriodeExercice
  dateArrete: string
  /** Réalisé de l'ouverture à l'arrêté, par (clé, compte, rubrique), lignes du budget et hors budget. */
  realise: Map<string, number>
}

function contexteBudget(budget: Budget, mouvements: MouvementBudgetDate[], exercice: PeriodeExercice, dateArrete: string): ContexteBudget {
  verifierPeriode(exercice, dateArrete)
  const invalide = mouvements.find((m) => !estCentimesPositifs(m.montantCentimes))
  if (invalide)
    throw new Error(
      `Mouvement de budget invalide (${invalide.montantCentimes}, ${invalide.compte} du ${invalide.date}) : centimes entiers strictement positifs attendus.`,
    )
  const fenetre = mouvements.filter((m) => m.date >= exercice.ouverture && m.date <= dateArrete && m.date <= exercice.cloture)
  const { lignes, horsBudget } = realiseBudget(budget, fenetre)
  const realise = new Map([...lignes, ...horsBudget].map((l): [string, number] => [cleCible(l), l.realiseCentimes]))
  return { budget, exercice, dateArrete, realise }
}

export type StatutBudgetProgressif = 'sans_seuil' | 'hors_budget' | 'conforme' | 'alerte'

export interface ControleBudgetProgressif {
  analytiqueId: string
  ligne: CibleBudget | null
  prevuCentimes: number | null
  budgetProgressifCentimes: number | null
  realiseCentimes: number | null
  /** (Réalisé − progressif) / progressif en %, centièmes arrondis par défaut ; null si le progressif est nul ou hors budget. */
  depassementPct: number | null
  seuilPct: number | null
  statut: StatutBudgetProgressif
  message: string
}

function controleHorsBudget(fiche: FicheAnalytique, cible: CibleBudget | null, ctx: ContexteBudget): ControleBudgetProgressif {
  const commun = {
    analytiqueId: fiche.id,
    ligne: null,
    prevuCentimes: null,
    budgetProgressifCentimes: null,
    depassementPct: null,
    seuilPct: fiche.alerteBudgetPct,
    statut: 'hors_budget' as const,
  }
  if (!cible) return { ...commun, realiseCentimes: null, message: 'Analytique sans clé ou sans rubrique : aucune ligne de budget à suivre.' }
  return {
    ...commun,
    realiseCentimes: ctx.realise.get(cleCible(cible)) ?? 0,
    message: `Aucune ligne de budget ${cible.cle} · ${cible.compte} · ${cible.rubrique} : dépense hors budget.`,
  }
}

function messageBudget(alerte: boolean, depassementPct: number | null, seuilPct: number, dateArrete: string): string {
  const au = `au ${dateIsoVersFr(dateArrete)}`
  if (!alerte) return `Dépenses dans le rythme du budget progressif ${au} (seuil ${pourcentFr(seuilPct)} %).`
  if (depassementPct === null) return `Dépenses engagées alors que le budget progressif est nul ${au}.`
  return `Dépenses de ${pourcentFr(depassementPct)} % au-dessus du budget progressif ${au} (seuil ${pourcentFr(seuilPct)} %).`
}

function controlerDansContexte(fiche: FicheAnalytique, cleSyndicat: string | null, ctx: ContexteBudget): ControleBudgetProgressif {
  exigerFicheValide(fiche)
  const cle = cleEffective(fiche, cleSyndicat)
  const cible = cle && fiche.rubrique ? { cle, compte: fiche.comptePlan, rubrique: fiche.rubrique } : null
  const ligne = cible ? ctx.budget.lignes.find((l) => cleCible(l) === cleCible(cible)) : undefined
  if (!ligne) return controleHorsBudget(fiche, cible, ctx)
  const progressif = budgetProgressif(ligne.prevuCentimes, fiche.saisonnalite, ctx.exercice, ctx.dateArrete)
  const realiseCentimes = ctx.realise.get(cleCible(ligne)) ?? 0
  const seuilPct = fiche.alerteBudgetPct
  const commun = {
    analytiqueId: fiche.id,
    ligne: { cle: ligne.cle, compte: ligne.compte, rubrique: ligne.rubrique },
    prevuCentimes: ligne.prevuCentimes,
    budgetProgressifCentimes: progressif,
    realiseCentimes,
    depassementPct: ecartPct(realiseCentimes, progressif),
    seuilPct,
  }
  if (seuilPct === null) return { ...commun, statut: 'sans_seuil', message: 'Aucun seuil d’alerte budgétaire sur cette analytique.' }
  const alerte = depasseDe(realiseCentimes, progressif, seuilEnCentiemes(seuilPct))
  return { ...commun, statut: alerte ? 'alerte' : 'conforme', message: messageBudget(alerte, commun.depassementPct, seuilPct, ctx.dateArrete) }
}

export interface ParametresBudgetProgressif {
  budget: Budget
  /** Mouvements datés du syndicat (mouvementsBudgetDepuisTraitements). */
  mouvements: MouvementBudgetDate[]
  exercice: PeriodeExercice
  dateArrete: string
}

/**
 * Gestéam « Alerte budget » : réalisé de la ligne de budget (clé effective, compte, rubrique de la fiche) de l'ouverture
 * à la date d'arrêté, contre le budget progressif ; alerte si le réalisé dépasse le progressif d'au moins le seuil (≥).
 */
export function controlerBudgetProgressif({
  fiche,
  cleSyndicat = null,
  budget,
  mouvements,
  exercice,
  dateArrete,
}: ParametresBudgetProgressif & { fiche: FicheAnalytique; cleSyndicat?: string | null }): ControleBudgetProgressif {
  return controlerDansContexte(fiche, cleSyndicat, contexteBudget(budget, mouvements, exercice, dateArrete))
}

/** Alertes de l'exercice : fiches en service ayant un seuil, en dépassement à la date d'arrêté. Clés du syndicat par fiche. */
export function alertesBudgetProgressif(
  fiches: FicheAnalytique[],
  { clesSyndicat = {}, budget, mouvements, exercice, dateArrete }: ParametresBudgetProgressif & { clesSyndicat?: Readonly<Record<string, string>> },
): ControleBudgetProgressif[] {
  const ctx = contexteBudget(budget, mouvements, exercice, dateArrete)
  return fiches
    .filter((f) => !f.horsService && f.alerteBudgetPct !== null)
    .map((f) => controlerDansContexte(f, Object.hasOwn(clesSyndicat, f.id) ? clesSyndicat[f.id] : null, ctx))
    .filter((controle) => controle.statut === 'alerte')
}
