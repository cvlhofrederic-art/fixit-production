import { repartirAuxPlusFortsRestes } from '@/lib/administrateur-judiciaire/domain/arrondis'
import { ajouterJours, composerDateIso, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  AFFECTATION_FONDS_TRAVAUX,
  controlerAffectationFondsTravaux,
  ENTREE_EN_VIGUEUR_FONDS_TRAVAUX,
  type DecaissementFondsTravaux,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import { estQualiteCopropriete, positionsEnPlace, type Position } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { soldePoste, type Encaissement, type PosteDette, type ResultatImputation } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import type { CleRepartition } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { etatPartFondsTravaux, type OperationTravaux } from '@/lib/administrateur-judiciaire/domain/travaux-operations'

/**
 * Part du fonds de travaux rattachée à chaque lot (point 20 du bilan 2). Fonctions pures, montants en CENTIMES ENTIERS,
 * dates ISO, sans écran ni table.
 *
 * Gestéam — 🟢 tranche 37 § Lots : fiche lot, onglet Charges et équipements, « Fonds travaux non remboursables € » (bouton
 * Détail jamais ouvert : calcul non observé) ; tranche 43 § 23 : appels « Fonds travaux non remb. », compte 10500.
 *
 * Le droit — 🟢 relu sur Légifrance le 29/10/2026 :
 * - L. 1965 art. 14-2-1, III : « Les sommes versées au titre du fonds de travaux sont attachées aux lots et entrent
 *   définitivement, dès leur versement, dans le patrimoine du syndicat » ; pas de remboursement par le syndicat à la
 *   cession ; « L'acquéreur peut consentir à verser au vendeur un montant équivalent à ces sommes en sus du prix » ;
 * - art. 14-2-1, I, al. 6 : « Ce fonds de travaux est alimenté par une cotisation annuelle obligatoire » ; chaque
 *   copropriétaire contribue au fonds « selon les mêmes modalités » que les provisions du budget prévisionnel ; I, al. 7 :
 *   affectation du fonds par l'assemblée aux dépenses des 1° à 4°, en tenant compte des parties communes spéciales et des
 *   clés de répartition ; art. 29-14 : usage autorisé par le juge en administration provisoire ;
 * - entrée en vigueur de l'art. 14-2-1 (loi n° 2021-1104, art. 171, VI) : 01/01/2023 au-delà de 200 lots à usage de
 *   logements, de bureaux ou de commerces, 01/01/2024 de 51 à 200, 01/01/2025 jusqu'à 50. Avant, l'ancien art. 14-2, II
 *   (rédaction en vigueur du 25/11/2018 au 01/01/2023) : sommes « attachées aux lots et définitivement acquises au
 *   syndicat », sans remboursement à la cession, SANS la phrase sur l'acquéreur ;
 * - D. 1967 art. 6-2 : à la mutation, la provision exigible du budget incombe au vendeur (1°) ; les provisions hors budget
 *   à celui qui est copropriétaire au moment de l'exigibilité (2°) ; art. 5-1 : pour l'opposition (L. 1965 art. 20), les
 *   créances « effectivement liquides et exigibles à la date de la mutation » ;
 * - CCH art. L. 721-2 (rédaction en vigueur depuis le 01/01/2024, « modifié par » la loi n° 2021-1104, art. 171, avec
 *   renvoi aux dates du VII de cet article), II, 2°, d) : l'acquéreur reçoit, « au plus tard à la date de signature de la
 *   promesse », « le montant de la part du fonds de travaux rattachée au lot principal vendu et le montant de la dernière
 *   cotisation au fonds versée par le copropriétaire vendeur au titre de son lot » ; alinéa suivant : « Les informations
 *   mentionnées aux a, c et d du présent 2° sont à jour des informations soumises à l'assemblée générale annuelle chargée
 *   d'approuver les comptes précédant la signature de la promesse de vente » ; III : sans promesse, le d) n'est pas exigé.
 *   La loi n° 2021-1104, art. 171, II, 4° ne modifie ni le d) ni l'alinéa qui le suit : elle insère les 6° et 7° du II et
 *   remplace des renvois dans les dix-septième et dix-huitième alinéas du II, au III et au IV. Art. 171, VII : « Par
 *   exception au VI, le 4° du II entre en vigueur » le 01/01/2024 au-delà de 200 lots à usage de logements, de bureaux ou
 *   de commerces, le 01/01/2025 de 51 à 200, le 01/01/2026 jusqu'à 50. Rédaction antérieure, relue (Légifrance, version
 *   au 31/12/2023 : « En vigueur du 29 août 2015 au 01 janv. 2024 », « Modifié par ORDONNANCE n°2015-1075 du 27 août
 *   2015 - art. 1 ») : le d) et l'alinéa qui le suit y sont mot pour mot les mêmes, « d) Lorsque le syndicat des
 *   copropriétaires dispose d'un fonds de travaux, le montant de la part du fonds de travaux rattachée au lot principal
 *   vendu et le montant de la dernière cotisation au fonds versée par le copropriétaire vendeur au titre de son lot. » ;
 *   même chapeau du II et même III. Le décret n° 2019-502, art. 2, 3° (extranet) dit de même la part « arrêté après
 *   approbation des comptes du syndicat par l'assemblée générale annuelle ». Le décret de 1967, art. 5 (état daté), ne
 *   mentionne pas le fonds de travaux.
 *
 * 🔵 Déduit :
 * - la part d'un lot cumule ce qui est ENCAISSÉ et imputé sur les appels du fonds (pas l'appelé), plus la part reprise du
 *   syndic précédent ; un emploi admis se déduit des lots de sa clé au prorata de leur part disponible à sa date (jamais
 *   en dessous de zéro), ou, sur option, au tantième de la clé ; le même jour, les versements passent avant les emplois,
 *   et les emplois entre eux dans l'ordre de leur identifiant (résultat indépendant de l'ordre reçu) ;
 * - tout emploi daté au plus tard à la date sort du fonds (solde du fonds), même s'il n'est pas déduit des parts (part
 *   non couverte, emploi refusé ou antérieur à sa décision : signalés) ;
 * - plusieurs emplois d'une même opération sont admis (prélèvements échelonnés, chacun pour une partie de la part du
 *   fonds de l'opération : emploiDepuisOperation, montant facultatif) ; seul un identifiant d'emploi en double est
 *   refusé ; chaque emploi d'une opération porte la part du fonds de celle-ci (partOperationCentimes) : ce que la somme
 *   de ses emplois, pris dans l'ordre des événements et refusés compris (sortis du fonds), dépasse de cette part est
 *   signalé et n'est pas déduit des parts des lots (pas de décision d'affectation au-delà), mais sort du fonds ;
 * - informations L. 721-2 : le vendeur est le copropriétaire en place à la date de la promesse ; la date d'arrêté est la
 *   clôture de l'exercice approuvé par la dernière AG annuelle avant la promesse, fournie par l'appelant ; la rédaction
 *   applicable suit les dates du VII selon le nombre de lots (inconnu entre 2024 et 2025 : l'une ou l'autre) ; le d) et
 *   l'alinéa qui le suit étant les mêmes dans les rédactions de 2015 et de 2021, ils fondent l'information pour toute
 *   promesse à compter du 29/08/2015 ;
 * - présence continue du vendeur sur le lot : positions de copropriété successives de son compte, remontées sans un jour
 *   d'interruption (sortie et entrée le même jour : continu ; réorganisation d'indivision sous le même compte comprise),
 *   depuis la veille de la mutation, ou depuis la promesse pour l'information à l'acquéreur ; un séjour antérieur du même
 *   compte, séparé par une interruption, n'est pas repris. Elle borne, de la même façon, « versé par le vendeur » (ses
 *   encaissements sur le lot pendant cette présence jusqu'à la mutation incluse, hors reprise) et sa dernière cotisation ;
 * - mutation : le vendeur est le compte des positions de copropriété en place la veille ; un appel du fonds exigible au
 *   plus tard le jour de la mutation et porté à son compte reste dû par lui (par analogie avec l'art. 6-2, 1°, l'art.
 *   14-2-1, I, al. 6 renvoyant aux modalités des provisions) ; reste dû à la mutation = appelé − réglé + versements de ce
 *   poste datés après la mutation : le réglé du poste fait foi, y compris la part réglée avant la prise de fonction et
 *   reprise sans versement ; l'appelant fournit postes et versements issus de la même imputation : un total des
 *   versements d'un poste (avant et après la mutation) supérieur à son réglé est une incohérence signalée, pour les
 *   postes échus comme pour ceux à réattribuer (reste alors plafonné à l'appelé) ; un total inférieur n'est pas
 *   décelable (part réglée avant la prise de fonction) ;
 * - un appel du fonds exigible APRÈS la mutation mais encore porté au compte vendeur (appel émis avant l'enregistrement
 *   de la mutation) n'est pas dû par lui (même analogie) : il est listé à réattribuer, avec ce qu'il y a déjà réglé ;
 * - ancien art. 14-2, II appliqué jusqu'à l'entrée en vigueur fixée par le VI ;
 * - annulation d'un encaissement : on réimpute sans lui (imputerEncaissements), ce n'est pas le traitement symétrique
 *   de R6 (traitements.ts), qui ne refait pas les imputations suivantes.
 * 🔴 Non établi :
 * - « dernière cotisation versée » (L. 721-2, II, 2°, d) — à trancher par Frédéric ou Hugo : le texte ne connaît que la
 *   cotisation ANNUELLE (art. 14-2-1, I, al. 6), alors que le fonds est appelé par échéances. Deux lectures, toutes deux
 *   rendues, aucune choisie : (1) le dernier appel du fonds entièrement versé (exigibilité la plus récente, puis poste),
 *   pour le montant appelé, daté du versement qui l'a soldé ; (2) la cotisation annuelle de l'exercice de cet appel,
 *   somme des appels de cet exercice entièrement versés (exercices fournis par l'appelant). Une reprise n'est jamais une
 *   cotisation ; dernière cotisation antérieure à la prise de fonction (connue du seul syndic précédent) : non reprise ;
 * - méthode de déduction d'un emploi (aucun texte : prorata des parts par défaut, tantièmes sur option) ; part d'un lot
 *   annexe vendu seul (L. 721-2 ne vise que le lot principal) ; intérêts du compte séparé (acquis au syndicat, sans règle
 *   de répartition entre les lots) ; division ou réunion de lots ; part du fonds de Gestéam (net ou brut des emplois) ;
 * - rédactions de L. 721-2 antérieures au 29/08/2015 et de l'ancien art. 14-2 antérieures au 25/11/2018 non relues
 *   (promesse ou mutation antérieure : fondement « à établir ») ;
 * - date d'une décision d'AG saisie en texte libre et date d'une autorisation du juge : non contrôlées face à la date de
 *   l'emploi ; avisDAppel (positions semi-ouvertes) porte au compte de l'acquéreur un appel exigible le jour de la
 *   mutation, en tension avec l'art. 6-2, 1° : non traité ici, seuls les postes portés au compte vendeur sont lus.
 */

/** Cotisation (appel du fonds de travaux pour un lot) que règle un versement. */
export interface CotisationAppelee {
  /** Poste de l'appel pour ce lot (postesDepuisAvis : « appel:lot »). */
  posteId: string
  exigibilite: string
  /** Montant appelé pour ce lot : la cotisation. */
  appeleCentimes: number
}

export interface VersementFondsTravaux {
  id: string
  lotId: string
  /**
   * Compte copropriétaire payeur (le vendeur, puis l'acquéreur : la part suit le lot). Pour une reprise : compte en place
   * à la prise de fonction, à titre d'information, jamais compté comme versé par ce compte.
   */
  compteId: string
  /** Date de l'encaissement (ou de la reprise). */
  date: string
  montantCentimes: number
  appelId: string | null
  /** Code de la clé de l'appel. */
  cle: string | null
  source: 'encaissement' | 'reprise'
  /** Cotisation réglée par ce versement ; null pour une reprise. */
  cotisation: CotisationAppelee | null
}

export interface AnomalieFondsTravauxLots {
  code:
    | 'versement_sans_lot'
    | 'emploi_non_autorise'
    | 'emploi_avant_decision'
    | 'cle_emploi_inconnue'
    | 'emploi_excede_parts_cle'
    | 'part_negative'
    | 'versements_poste_incoherents'
    | 'emplois_operation_excedent'
  refId: string
  message: string
  nonCouvertCentimes?: number
  /** Part d'un emploi au-delà de la part du fonds de son opération (emplois_operation_excedent) : non déduite des parts. */
  excedentCentimes?: number
}

const comparer = (a: string, b: string): number => (a < b ? -1 : Number(a > b))

const somme = (versements: VersementFondsTravaux[]): number => versements.reduce((s, v) => s + v.montantCentimes, 0)

function verifierDate(date: string, libelle: string): void {
  if (!estDateIsoValide(date)) throw new Error(`${libelle} invalide (${date}) : AAAA-MM-JJ attendu.`)
}

function verifierMontant(montant: number, libelle: string): void {
  if (!Number.isInteger(montant) || montant <= 0) throw new Error(`${libelle} invalide (${montant}) : centimes entiers strictement positifs attendus.`)
}

/** Refuse un identifiant présent deux fois : un versement ou un emploi ne se compte qu'une fois. */
function verifierUnicite(ids: string[], message: (id: string) => string): void {
  const vus = new Set<string>()
  for (const id of ids) {
    if (vus.has(id)) throw new Error(message(id))
    vus.add(id)
  }
}

/** Versements au fonds d'un résultat d'imputation : un par poste « Fonds travaux » (lignes d'un même poste additionnées). */
function versementsDUnResultat(resultat: ResultatImputation, encaissement: Encaissement): { versements: VersementFondsTravaux[]; anomalies: AnomalieFondsTravauxLots[] } {
  const parPoste = new Map<string, number>()
  for (const ligne of resultat.lignes) parPoste.set(ligne.posteId, (parPoste.get(ligne.posteId) ?? 0) + ligne.montantCentimes)
  const versements: VersementFondsTravaux[] = []
  const anomalies: AnomalieFondsTravauxLots[] = []
  for (const [posteId, montantCentimes] of parPoste) {
    const poste = resultat.postes.find((p) => p.id === posteId)
    if (poste?.typeAppel !== 'Fonds travaux') continue
    const id = `${encaissement.id}:${poste.id}`
    if (!poste.lotId) {
      anomalies.push({ code: 'versement_sans_lot', refId: id, message: `Versement au fonds de travaux sans lot (poste ${poste.id}) : rattacher le poste à son lot.` })
      continue
    }
    versements.push({
      id,
      lotId: poste.lotId,
      compteId: poste.compteId,
      date: encaissement.date,
      montantCentimes,
      appelId: poste.appelId,
      cle: poste.cle ?? null,
      source: 'encaissement',
      cotisation: { posteId: poste.id, exigibilite: poste.exigibilite, appeleCentimes: poste.montantCentimes },
    })
  }
  return { versements, anomalies }
}

/**
 * Versements au fonds de travaux, lus dans les résultats d'imputation : seules les lignes imputées sur un poste
 * « Fonds travaux » comptent, au lot du poste et à la date de l'encaissement. Le reliquat « à imputer » n'est jamais un
 * versement au fonds. Un encaissement présent deux fois est refusé.
 *
 * Encaissement annulé (chèque rejeté…) : réimputer avec imputerEncaissements SANS lui, puis passer ici les nouveaux
 * résultats (et, à la mutation, les postes de cette même imputation). Écarter seulement son résultat laisserait les
 * imputations suivantes calculées comme s'il avait payé : il n'y a donc pas d'option d'exclusion.
 */
export function versementsFondsTravauxDepuisImputations(
  resultats: ResultatImputation[],
  encaissements: Encaissement[],
): { versements: VersementFondsTravaux[]; anomalies: AnomalieFondsTravauxLots[] } {
  verifierUnicite(
    resultats.map((r) => r.encaissementId),
    (id) => `Encaissement « ${id} » compté deux fois dans les résultats d'imputation.`,
  )
  const versements: VersementFondsTravaux[] = []
  const anomalies: AnomalieFondsTravauxLots[] = []
  for (const resultat of resultats) {
    const encaissement = encaissements.find((e) => e.id === resultat.encaissementId)
    if (!encaissement) throw new Error(`Encaissement introuvable pour le résultat d'imputation « ${resultat.encaissementId} ».`)
    const lus = versementsDUnResultat(resultat, encaissement)
    versements.push(...lus.versements)
    anomalies.push(...lus.anomalies)
  }
  return { versements, anomalies }
}

/** Part d'un lot reprise du syndic précédent à la prise de fonction : un cumul, jamais une cotisation. */
export function creerVersementReprise(saisie: { id: string; lotId: string; compteId: string; date: string; montantCentimes: number }): VersementFondsTravaux {
  if (!saisie.lotId.trim()) throw new Error('Reprise du fonds de travaux : lot attendu.')
  verifierDate(saisie.date, 'Date de reprise')
  verifierMontant(saisie.montantCentimes, 'Montant repris')
  return { ...saisie, lotId: saisie.lotId.trim(), appelId: null, cle: null, source: 'reprise', cotisation: null }
}

export interface EmploiFondsTravaux {
  id: string
  /** Date du prélèvement sur le fonds. */
  date: string
  montantCentimes: number
  /** Clé de la dépense financée : l'emploi se déduit des parts des lots de cette clé. */
  cleId: string
  decaissement: DecaissementFondsTravaux
  operationNumero: string | null
  /**
   * Part du fonds de travaux de l'opération (financementFondsTravauxCentimes), la même pour tous ses emplois : la somme
   * des emplois de l'opération y est rapprochée. Renseignée si et seulement si operationNumero l'est.
   */
  partOperationCentimes: number | null
  /**
   * Date de la décision d'AG qui affecte le fonds, quand elle est connue (résolution de l'opération qui en tient lieu) :
   * un emploi antérieur n'est pas déduit. null : décision saisie en texte libre ou autorisation du juge (🔴 non contrôlée).
   */
  dateDecision: string | null
}

/** Montant d'un emploi tiré de la part du fonds d'une opération : toute la part par défaut, ou une tranche de celle-ci. */
function montantDeLEmploi(operation: OperationTravaux, id: string, montantCentimes: number | undefined): number {
  const part = operation.financementFondsTravauxCentimes
  if (montantCentimes === undefined) return part
  verifierMontant(montantCentimes, `Montant de l'emploi ${id}`)
  if (montantCentimes > part)
    throw new Error(`Opération ${operation.numero} : emploi ${id} de ${montantCentimes} centimes supérieur à la part du fonds de travaux de l'opération (${part} centimes).`)
  return montantCentimes
}

/**
 * Emploi du fonds pour la part d'une opération de travaux, ou pour une tranche de celle-ci (prélèvements échelonnés :
 * un emploi par tranche, chacun avec son identifiant) ; refusé sans affectation admise, au-delà de la part du fonds de
 * l'opération, ou daté avant la résolution de l'opération quand celle-ci tient lieu de décision d'affectation (art.
 * 14-2-1, I, al. 7). L'emploi porte la part du fonds de l'opération : partsFondsTravauxParLot signale, sans le déduire,
 * ce que la somme des emplois de l'opération dépasse de cette part.
 */
export function emploiDepuisOperation(
  operation: OperationTravaux,
  { id, date, montantCentimes }: { id: string; date: string; montantCentimes?: number },
): EmploiFondsTravaux {
  verifierDate(date, "Date de l'emploi")
  const etat = etatPartFondsTravaux(operation)
  if (!etat) throw new Error(`Opération ${operation.numero} sans part du fonds de travaux.`)
  if (!etat.autorise) throw new Error(`Opération ${operation.numero} : ${etat.motif}`)
  const montant = montantDeLEmploi(operation, id, montantCentimes)
  const affectation = operation.affectationFonds as NonNullable<OperationTravaux['affectationFonds']>
  const { decision } = operation
  const decisionDistincte = affectation.decisionAg?.trim()
  const parResolution = !decisionDistincte && AFFECTATION_FONDS_TRAVAUX[affectation.objet].base === 'affectation_ag' ? decision : null
  if (parResolution && date < parResolution.date)
    throw new Error(
      `Opération ${operation.numero} : emploi du ${dateIsoVersFr(date)} antérieur à la résolution du ${dateIsoVersFr(parResolution.date)} qui affecte le fonds ; dater l'emploi au plus tôt de cette décision.`,
    )
  const decisionAg = decisionDistincte || (decision ? `${decision.resolution} (AG du ${dateIsoVersFr(decision.date)})` : null)
  return {
    id,
    date,
    montantCentimes: montant,
    cleId: operation.cleId,
    decaissement: { objet: affectation.objet, montantCentimes: montant, decisionAg, autorisationJuge: affectation.autorisationJuge ?? null },
    operationNumero: operation.numero,
    partOperationCentimes: operation.financementFondsTravauxCentimes,
    dateDecision: parResolution?.date ?? null,
  }
}

/**
 * Dernière cotisation entièrement versée, lecture « dernier appel soldé » (🔴, à trancher) : l'appel du fonds du lot,
 * pour son montant appelé.
 */
export interface DerniereCotisation {
  posteId: string
  appelId: string | null
  exigibilite: string
  /** Montant appelé pour le lot (la cotisation), et non le dernier encaissement. */
  montantCentimes: number
  /** Date du versement qui a soldé la cotisation. */
  date: string
  compteId: string
}

/** La cotisation d'un poste, si ses versements (déjà bornés à la date) l'ont entièrement réglée ; sinon null. */
function cotisationSoldee(versements: VersementFondsTravaux[]): DerniereCotisation | null {
  const tries = [...versements].sort((a, b) => comparer(a.date, b.date) || comparer(a.id, b.id))
  const { posteId, exigibilite, appeleCentimes } = tries[0].cotisation as CotisationAppelee
  let cumul = 0
  for (const v of tries) {
    if (v.cotisation?.appeleCentimes !== appeleCentimes || v.cotisation.exigibilite !== exigibilite)
      throw new Error(`Versements incohérents sur le poste ${posteId} : montant appelé ou exigibilité différents.`)
    cumul += v.montantCentimes
    if (cumul >= appeleCentimes) return { posteId, appelId: v.appelId, exigibilite, montantCentimes: appeleCentimes, date: v.date, compteId: v.compteId }
  }
  return null
}

const plusRecente = (a: DerniereCotisation, b: DerniereCotisation): boolean =>
  a.exigibilite > b.exigibilite || (a.exigibilite === b.exigibilite && a.posteId < b.posteId)

/**
 * Appels du fonds entièrement versés parmi `versements` (déjà filtrés par lot, et par compte s'il le faut) à `date`
 * incluse. Une reprise (sans cotisation) n'en est jamais un.
 */
function cotisationsSoldees(versements: VersementFondsTravaux[], date: string): DerniereCotisation[] {
  const parPoste = new Map<string, VersementFondsTravaux[]>()
  for (const v of versements) {
    if (!v.cotisation || v.date > date) continue
    parPoste.set(v.cotisation.posteId, [...(parPoste.get(v.cotisation.posteId) ?? []), v])
  }
  return [...parPoste.values()].flatMap((liste) => cotisationSoldee(liste) ?? [])
}

/** L'appel soldé à l'exigibilité la plus récente, à exigibilité égale le premier poste ; null si aucun. */
function plusRecenteDes(soldees: DerniereCotisation[]): DerniereCotisation | null {
  let retenue: DerniereCotisation | null = null
  for (const soldee of soldees) if (!retenue || plusRecente(soldee, retenue)) retenue = soldee
  return retenue
}

/** Dernière cotisation versée (lecture « dernier appel soldé ») parmi `versements` à `date` incluse ; null si aucune. */
const derniereCotisationSoldee = (versements: VersementFondsTravaux[], date: string): DerniereCotisation | null =>
  plusRecenteDes(cotisationsSoldees(versements, date))

/** Exercice du syndicat, bornes incluses (Exercice : ouverture, clôture). */
export interface ExerciceSyndicat {
  ouverture: string
  cloture: string
}

/** Cotisation annuelle versée, lecture « cotisation annuelle » (🔴, à trancher) : art. 14-2-1, I, al. 6. */
export interface CotisationAnnuelleVersee {
  /** Exercice qui contient l'exigibilité du dernier appel soldé. */
  ouverture: string
  cloture: string
  /** Somme des appels de cet exercice entièrement versés (montants appelés) ; un appel non soldé n'y entre pas. */
  montantCentimes: number
  posteIds: string[]
}

/** Exercices aux dates valides, clôture après ouverture, sans chevauchement. */
function verifierExercices(exercices: ExerciceSyndicat[]): void {
  for (const { ouverture, cloture } of exercices) {
    verifierDate(ouverture, "Date d'ouverture de l'exercice")
    verifierDate(cloture, "Date de clôture de l'exercice")
    if (cloture <= ouverture) throw new Error(`Exercice du ${dateIsoVersFr(ouverture)} au ${dateIsoVersFr(cloture)} : clôture antérieure ou égale à l'ouverture.`)
  }
  const tries = [...exercices].sort((a, b) => comparer(a.ouverture, b.ouverture))
  for (let i = 1; i < tries.length; i++)
    if (tries[i].ouverture <= tries[i - 1].cloture)
      throw new Error(`Exercices qui se chevauchent : ${dateIsoVersFr(tries[i - 1].ouverture)}–${dateIsoVersFr(tries[i - 1].cloture)} et ${dateIsoVersFr(tries[i].ouverture)}–${dateIsoVersFr(tries[i].cloture)}.`)
}

const dansExercice = (exercice: ExerciceSyndicat, date: string): boolean => exercice.ouverture <= date && date <= exercice.cloture

/** Cotisation annuelle de l'exercice du dernier appel soldé : null sans appel soldé ou sans exercice qui le contienne. */
function cotisationAnnuelleSoldee(soldees: DerniereCotisation[], derniere: DerniereCotisation | null, exercices: ExerciceSyndicat[]): CotisationAnnuelleVersee | null {
  const exercice = derniere && exercices.find((e) => dansExercice(e, derniere.exigibilite))
  if (!exercice) return null
  const appels = soldees.filter((c) => dansExercice(exercice, c.exigibilite)).sort((a, b) => comparer(a.exigibilite, b.exigibilite) || comparer(a.posteId, b.posteId))
  return {
    ouverture: exercice.ouverture,
    cloture: exercice.cloture,
    montantCentimes: appels.reduce((s, c) => s + c.montantCentimes, 0),
    posteIds: appels.map((c) => c.posteId),
  }
}

export interface PartFondsTravauxLot {
  lotId: string
  /** Encaissé imputé sur les appels du fonds, plus la part reprise. */
  verseCentimes: number
  /** Part reprise du syndic précédent (cumul des propriétaires antérieurs) : jamais un versement d'un compte. */
  repriseCentimes: number
  /** Emplois déduits de ce lot. */
  employeCentimes: number
  partCentimes: number
  /** Encaissements par compte payeur, hors reprise. */
  verseParCompte: { compteId: string; verseCentimes: number }[]
  /** Dernier appel du fonds du lot soldé à la date, tous comptes confondus (lecture « dernier appel soldé », 🔴). */
  derniereCotisation: DerniereCotisation | null
}

export interface EtatFondsTravauxParLot {
  date: string
  parts: PartFondsTravauxLot[]
  totalVerseCentimes: number
  /** Emplois déduits des parts des lots : la somme des parts vaut toujours versé moins déduit. */
  totalDeduitDesPartsCentimes: number
  /**
   * Tous les emplois datés au plus tard à la date, déduits ou non (part non couverte, emploi refusé, excédent sur la part
   * du fonds de l'opération) : sortis du fonds.
   */
  totalPreleveCentimes: number
  /**
   * Versé moins prélevé : le fonds encaissé restant, quel que soit le mode de déduction (le compte 10500 suit, lui,
   * l'appelé). Il diffère de la somme des parts du montant prélevé sans être déduit, signalé dans les anomalies.
   */
  soldeFondsCentimes: number
  anomalies: AnomalieFondsTravauxLots[]
  aConfirmer: true
  fondement: string
}

type ModeEmploi = 'prorata' | 'tantiemes'

interface Cumul {
  verse: number
  reprise: number
  employe: number
  parCompte: Map<string, number>
}

function cumulDe(cumuls: Map<string, Cumul>, lotId: string): Cumul {
  const existant = cumuls.get(lotId)
  if (existant) return existant
  const cumul: Cumul = { verse: 0, reprise: 0, employe: 0, parCompte: new Map() }
  cumuls.set(lotId, cumul)
  return cumul
}

function ajouterVersement(cumuls: Map<string, Cumul>, v: VersementFondsTravaux): void {
  const cumul = cumulDe(cumuls, v.lotId)
  cumul.verse += v.montantCentimes
  if (v.source === 'reprise') cumul.reprise += v.montantCentimes
  else cumul.parCompte.set(v.compteId, (cumul.parCompte.get(v.compteId) ?? 0) + v.montantCentimes)
}

/** Déduit un emploi admis des lots de sa clé ; renvoie le montant non couvert par leurs parts (mode prorata). */
function deduireEmploi(cumuls: Map<string, Cumul>, cle: CleRepartition, montant: number, mode: ModeEmploi): number {
  const lots = cle.lots.map((l) => l.lotId)
  if (mode === 'tantiemes') {
    repartirAuxPlusFortsRestes(montant, cle.lots.map((l) => l.tantiemes)).forEach((part, i) => {
      cumulDe(cumuls, lots[i]).employe += part
    })
    return 0
  }
  const disponibles = lots.map((lotId) => Math.max(0, (cumuls.get(lotId)?.verse ?? 0) - (cumuls.get(lotId)?.employe ?? 0)))
  const total = disponibles.reduce((s, d) => s + d, 0)
  const couvert = Math.min(montant, total)
  if (couvert > 0)
    repartirAuxPlusFortsRestes(couvert, disponibles).forEach((part, i) => {
      cumulDe(cumuls, lots[i]).employe += part
    })
  return montant - couvert
}

type Evenement =
  | { rang: 0; date: string; id: string; versement: VersementFondsTravaux }
  | { rang: 1; date: string; id: string; emploi: EmploiFondsTravaux }

/** Événements datés au plus tard à `date`, par date, versements avant emplois, puis par identifiant. */
function evenementsJusquA(versements: VersementFondsTravaux[], emplois: EmploiFondsTravaux[], date: string): Evenement[] {
  const evenements: Evenement[] = [
    ...versements.filter((v) => v.date <= date).map((versement) => ({ rang: 0 as const, date: versement.date, id: versement.id, versement })),
    ...emplois.filter((e) => e.date <= date).map((emploi) => ({ rang: 1 as const, date: emploi.date, id: emploi.id, emploi })),
  ]
  return evenements.sort((a, b) => comparer(a.date, b.date) || a.rang - b.rang || comparer(a.id, b.id))
}

/** Anomalie d'un emploi qui ne peut pas être déduit (non autorisé, antérieur à sa décision, clé inconnue) ; null sinon. */
function emploiNonDeductible(emploi: EmploiFondsTravaux, cle: CleRepartition | undefined): AnomalieFondsTravauxLots | null {
  const controle = controlerAffectationFondsTravaux(emploi.decaissement)
  if (!controle.autorise) return { code: 'emploi_non_autorise', refId: emploi.id, message: `Emploi ${emploi.id} non déduit : ${controle.motif}` }
  if (emploi.dateDecision !== null && emploi.date < emploi.dateDecision)
    return {
      code: 'emploi_avant_decision',
      refId: emploi.id,
      message: `Emploi ${emploi.id} non déduit : daté du ${dateIsoVersFr(emploi.date)}, avant la décision d'affectation du ${dateIsoVersFr(emploi.dateDecision)}.`,
    }
  if (!cle) return { code: 'cle_emploi_inconnue', refId: emploi.id, message: `Emploi ${emploi.id} non déduit : clé « ${emploi.cleId} » inconnue.` }
  return null
}

/**
 * Part d'un emploi au-delà de la part du fonds de son opération, compte tenu des emplois de l'opération déjà passés
 * (ordre des événements : date, puis identifiant ; emplois refusés compris, car sortis du fonds) ; met à jour le cumul de
 * l'opération. 0 pour un emploi hors opération.
 */
function excedentOperation(emploi: EmploiFondsTravaux, cumulsOperations: Map<string, number>): number {
  const { operationNumero, partOperationCentimes, montantCentimes } = emploi
  if (operationNumero === null || partOperationCentimes === null) return 0
  const avant = cumulsOperations.get(operationNumero) ?? 0
  cumulsOperations.set(operationNumero, avant + montantCentimes)
  return Math.min(montantCentimes, Math.max(0, avant + montantCentimes - partOperationCentimes))
}

/**
 * Applique un emploi aux cumuls ; renvoie les anomalies qu'il produit. L'excédent sur la part du fonds de l'opération
 * n'est jamais déduit des parts des lots.
 */
function appliquerEmploi(
  cumuls: Map<string, Cumul>,
  emploi: EmploiFondsTravaux,
  cles: CleRepartition[],
  mode: ModeEmploi,
  cumulsOperations: Map<string, number>,
): AnomalieFondsTravauxLots[] {
  const anomalies: AnomalieFondsTravauxLots[] = []
  const excedent = excedentOperation(emploi, cumulsOperations)
  if (excedent > 0)
    anomalies.push({
      code: 'emplois_operation_excedent',
      refId: emploi.id,
      excedentCentimes: excedent,
      message: `Emploi ${emploi.id} : ${excedent} centimes au-delà de la part du fonds de travaux de l'opération ${emploi.operationNumero} (${emploi.partOperationCentimes} centimes), compte tenu de ses autres emplois ; excédent sorti du fonds, non déduit des parts des lots.`,
    })
  const cle = cles.find((c) => c.id === emploi.cleId)
  const refus = emploiNonDeductible(emploi, cle)
  if (refus) return [...anomalies, refus]
  const aDeduire = emploi.montantCentimes - excedent
  if (aDeduire === 0) return anomalies
  const nonCouvert = deduireEmploi(cumuls, cle as CleRepartition, aDeduire, mode)
  if (nonCouvert > 0)
    anomalies.push({
      code: 'emploi_excede_parts_cle',
      refId: emploi.id,
      nonCouvertCentimes: nonCouvert,
      message: `Emploi ${emploi.id} : ${nonCouvert} centimes au-delà des parts des lots de la clé « ${emploi.cleId} » ; vérifier la clé de l'affectation (parties communes spéciales).`,
    })
  return anomalies
}

/** Un emploi tiré d'une opération porte la part du fonds de celle-ci, la même pour tous les emplois de l'opération. */
function verifierPartsOperations(emplois: EmploiFondsTravaux[]): void {
  const parts = new Map<string, number>()
  for (const e of emplois) {
    if ((e.operationNumero === null) !== (e.partOperationCentimes === null))
      throw new Error(`Emploi ${e.id} : numéro d'opération et part du fonds de travaux de l'opération vont ensemble (tous deux renseignés ou tous deux null).`)
    if (e.operationNumero === null || e.partOperationCentimes === null) continue
    verifierMontant(e.partOperationCentimes, `Part du fonds de travaux de l'opération ${e.operationNumero} (emploi ${e.id})`)
    const connue = parts.get(e.operationNumero)
    if (connue !== undefined && connue !== e.partOperationCentimes)
      throw new Error(`Opération ${e.operationNumero} : part du fonds de travaux différente d'un emploi à l'autre (${connue} et ${e.partOperationCentimes} centimes).`)
    parts.set(e.operationNumero, e.partOperationCentimes)
  }
}

/**
 * Contrôles d'entrée : identifiants uniques, montant, date de décision et part du fonds de l'opération. Plusieurs emplois
 * d'une même opération (prélèvements échelonnés) sont admis, chacun sous son identifiant ; ce qui dépasse la part de
 * l'opération est signalé au calcul.
 */
function verifierEntrees(versements: VersementFondsTravaux[], emplois: EmploiFondsTravaux[]): void {
  verifierUnicite(
    versements.map((v) => v.id),
    (id) => `Versement au fonds de travaux « ${id} » compté deux fois.`,
  )
  verifierUnicite(
    emplois.map((e) => e.id),
    (id) => `Emploi du fonds de travaux « ${id} » compté deux fois.`,
  )
  for (const e of emplois) {
    if (e.montantCentimes !== e.decaissement.montantCentimes) throw new Error(`Emploi ${e.id} : montant différent de celui de son décaissement.`)
    if (e.dateDecision !== null) verifierDate(e.dateDecision, `Date de décision de l'emploi ${e.id}`)
  }
  verifierPartsOperations(emplois)
}

function partDuLot(lotId: string, c: Cumul, versementsDuLot: VersementFondsTravaux[], date: string): PartFondsTravauxLot {
  return {
    lotId,
    verseCentimes: c.verse,
    repriseCentimes: c.reprise,
    employeCentimes: c.employe,
    partCentimes: c.verse - c.employe,
    verseParCompte: [...c.parCompte.entries()].map(([compteId, verseCentimes]) => ({ compteId, verseCentimes })),
    derniereCotisation: derniereCotisationSoldee(versementsDuLot, date),
  }
}

/**
 * Part du fonds de travaux de chaque lot à une date (bornes incluses) : versements cumulés, emplois admis déduits des lots
 * de leur clé. Les emplois non autorisés, antérieurs à leur décision, sur une clé inconnue, ou au-delà des parts des lots
 * de la clé, sont signalés ; de même ce que la somme des emplois d'une opération dépasse de la part du fonds de cette
 * opération (excédent non déduit). Un versement ou un emploi en double est refusé.
 */
export function partsFondsTravauxParLot({
  versements,
  emplois,
  cles,
  date,
  mode = 'prorata',
}: {
  versements: VersementFondsTravaux[]
  emplois: EmploiFondsTravaux[]
  cles: CleRepartition[]
  date: string
  mode?: ModeEmploi
}): EtatFondsTravauxParLot {
  verifierDate(date, 'Date')
  verifierEntrees(versements, emplois)
  const cumuls = new Map<string, Cumul>()
  const cumulsOperations = new Map<string, number>()
  const anomalies: AnomalieFondsTravauxLots[] = []
  let totalPreleveCentimes = 0
  for (const evenement of evenementsJusquA(versements, emplois, date)) {
    if (evenement.rang === 0) {
      ajouterVersement(cumuls, evenement.versement)
      continue
    }
    totalPreleveCentimes += evenement.emploi.montantCentimes
    anomalies.push(...appliquerEmploi(cumuls, evenement.emploi, cles, mode, cumulsOperations))
  }
  const parts = [...cumuls.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr', { numeric: true }))
    .map(([lotId, c]) => partDuLot(lotId, c, versements.filter((v) => v.lotId === lotId), date))
  for (const p of parts)
    if (p.partCentimes < 0)
      anomalies.push({ code: 'part_negative', refId: p.lotId, message: `Part du lot ${p.lotId} négative (${p.partCentimes} centimes) : emploi supérieur aux sommes versées pour ce lot.` })
  const totalVerseCentimes = parts.reduce((s, p) => s + p.verseCentimes, 0)
  return {
    date,
    parts,
    totalVerseCentimes,
    totalDeduitDesPartsCentimes: parts.reduce((s, p) => s + p.employeCentimes, 0),
    totalPreleveCentimes,
    soldeFondsCentimes: totalVerseCentimes - totalPreleveCentimes,
    anomalies,
    aConfirmer: true,
    fondement: "L. 1965 art. 14-2-1, III ; avant l'entrée en vigueur fixée par la loi n° 2021-1104, art. 171, VI : ancien art. 14-2, II",
  }
}

/** Anomalies qui concernent un lot : sa part négative, et les emplois sur une clé qui le contient ou sur une clé inconnue. */
function anomaliesDuLot(anomalies: AnomalieFondsTravauxLots[], emplois: EmploiFondsTravaux[], cles: CleRepartition[], lotId: string): AnomalieFondsTravauxLots[] {
  return anomalies.filter((a) => {
    if (a.code === 'part_negative') return a.refId === lotId
    const emploi = emplois.find((e) => e.id === a.refId)
    const cle = cles.find((c) => c.id === emploi?.cleId)
    return !cle || cle.lots.some((l) => l.lotId === lotId)
  })
}

/** La position (semi-ouverte : sortie le jour de sa sortie) couvre la veille de `jour`. */
const couvreLaVeille = (p: Position, jour: string): boolean => p.dateEntree < jour && (p.dateSortie === null || p.dateSortie >= jour)

/**
 * Début de la présence continue du compte sur le lot, remontée depuis `entree` : positions de copropriété successives
 * de ce compte sans un jour d'interruption (une sortie et une entrée le même jour se suivent ; réorganisation d'une
 * indivision par muterLot sous le même compte comprise). Un séjour antérieur, séparé par une interruption, n'est pas
 * repris.
 */
function presenceContinueDepuis(positions: Position[], lotId: string, compteId: string, entree: string): string {
  const duCompte = positions.filter((p) => p.lotId === lotId && p.compteId === compteId && p.statut !== 'Futur' && estQualiteCopropriete(p.qualite))
  const precedentes = (jour: string): Position[] => duCompte.filter((p) => couvreLaVeille(p, jour))
  let depuis = entree
  let avant = precedentes(depuis)
  while (avant.length > 0) {
    depuis = avant.map((p) => p.dateEntree).sort(comparer)[0]
    avant = precedentes(depuis)
  }
  return depuis
}

/**
 * Compte copropriétaire unique des positions de copropriété en place sur le lot à `date` (D2), et le début de sa
 * présence continue sur le lot.
 */
function vendeurEnPlace(positions: Position[], lotId: string, date: string, message: string): { compteId: string; depuis: string } {
  const enPlace = positionsEnPlace(positions, lotId, date).filter((p) => estQualiteCopropriete(p.qualite) && p.compteId)
  const comptes = new Set(enPlace.map((p) => p.compteId as string))
  if (comptes.size !== 1) throw new Error(message)
  const [compteId] = comptes
  const entree = enPlace.map((p) => p.dateEntree).sort(comparer)[0]
  return { compteId, depuis: presenceContinueDepuis(positions, lotId, compteId, entree) }
}

const FONDEMENT_VI = 'Loi n° 2021-1104 du 22 août 2021, art. 171, VI'
const PREMIERE_ENTREE = composerDateIso(ENTREE_EN_VIGUEUR_FONDS_TRAVAUX[0].annee, 1, 1)
const DERNIERE_ENTREE = composerDateIso(ENTREE_EN_VIGUEUR_FONDS_TRAVAUX[2].annee, 1, 1)
/** Début de la rédaction de l'ancien art. 14-2 relue (Légifrance : en vigueur du 25/11/2018 au 01/01/2023). */
const DEBUT_ANCIEN_14_2_RELU = composerDateIso(2018, 11, 25)

type RegimeCession = 'actuel' | 'ancien' | 'lots_inconnus' | 'non_relu'

function regimeCession(date: string, nbLots: number | null): RegimeCession {
  if (date >= DERNIERE_ENTREE) return 'actuel'
  if (date < DEBUT_ANCIEN_14_2_RELU) return 'non_relu'
  if (date < PREMIERE_ENTREE) return 'ancien'
  if (nbLots === null) return 'lots_inconnus'
  const palier = ENTREE_EN_VIGUEUR_FONDS_TRAVAUX.find((e) => nbLots >= e.lotsAuMoins) ?? ENTREE_EN_VIGUEUR_FONDS_TRAVAUX[2]
  return date >= composerDateIso(palier.annee, 1, 1) ? 'actuel' : 'ancien'
}

const CESSION: Record<RegimeCession, { mention: string; fondements: string[] }> = {
  actuel: {
    mention:
      "Sommes versées au fonds de travaux attachées au lot et entrées définitivement dans le patrimoine du syndicat dès leur versement : aucun remboursement au vendeur, la part suit le lot ; l'acquéreur peut consentir à verser au vendeur un montant équivalent, en sus du prix.",
    fondements: ['L. 1965 art. 14-2-1, III', FONDEMENT_VI],
  },
  ancien: {
    mention: 'Sommes versées au fonds de travaux attachées au lot et définitivement acquises au syndicat : aucun remboursement par le syndicat à la cession, la part suit le lot.',
    fondements: ['L. 1965 art. 14-2, II (rédaction antérieure à la loi n° 2021-1104)', FONDEMENT_VI],
  },
  lots_inconnus: {
    mention:
      "Régime du fonds de travaux à la date de mutation à établir : renseigner le nombre de lots à usage de logements, de bureaux ou de commerces (art. 14-2-1 entré en vigueur entre le 01/01/2023 et le 01/01/2025 selon ce nombre).",
    fondements: [FONDEMENT_VI],
  },
  non_relu: {
    mention: "Régime du fonds de travaux à la date de mutation à établir : rédaction de l'ancien art. 14-2 antérieure au 25/11/2018 non relue.",
    fondements: [FONDEMENT_VI],
  },
}

export interface CotisationImpayeeVendeur {
  posteId: string
  exigibilite: string
  /**
   * Reste dû à la date de mutation : appelé − réglé + versements de ce poste datés après la mutation (le réglé du poste
   * fait foi, part réglée avant la prise de fonction comprise) ; plafonné à l'appelé.
   */
  resteCentimes: number
  /** Versé par le vendeur sur ce poste après la mutation (opposition sur le prix…) : à déduire pour le reste dû actuel. */
  regleDepuisCentimes: number
}

/** Appel du fonds exigible après la mutation mais encore porté au compte vendeur : à réattribuer, non dû par le vendeur. */
export interface PosteAReattribuer {
  posteId: string
  exigibilite: string
  montantCentimes: number
  /** Déjà réglé sur ce poste depuis le compte vendeur : à reprendre avec la réattribution. */
  regleCentimes: number
}

/** Reste dû à la mutation sur un poste échu : appelé − réglé + versements du poste datés après la mutation, plafonné à l'appelé. */
function resteDuALaMutation(p: PosteDette, versements: VersementFondsTravaux[], date: string): CotisationImpayeeVendeur {
  const regleDepuisCentimes = somme(versements.filter((v) => v.cotisation?.posteId === p.id && v.date > date))
  return { posteId: p.id, exigibilite: p.exigibilite, resteCentimes: Math.min(p.montantCentimes, soldePoste(p) + regleDepuisCentimes), regleDepuisCentimes }
}

/**
 * Versements d'un poste (avant et après la mutation) supérieurs à son réglé : postes et versements ne viennent pas de la
 * même imputation. Le réglé fait foi ; un total inférieur au réglé est admis (part réglée avant la prise de fonction).
 */
function incoherenceDuPoste(p: PosteDette, versements: VersementFondsTravaux[], date: string): AnomalieFondsTravauxLots | null {
  const duPoste = versements.filter((v) => v.cotisation?.posteId === p.id)
  const totalCentimes = somme(duPoste)
  if (totalCentimes <= p.regleCentimes) return null
  const apresCentimes = somme(duPoste.filter((v) => v.date > date))
  return {
    code: 'versements_poste_incoherents',
    refId: p.id,
    message: `Poste ${p.id} : ${totalCentimes} centimes de versements, dont ${apresCentimes} après la mutation du ${dateIsoVersFr(date)}, pour ${p.regleCentimes} centimes réglés ; le réglé fait foi : fournir postes et versements issus de la même imputation (reste dû à la mutation plafonné à l'appelé).`,
  }
}

/**
 * Appels du fonds du lot portés au compte vendeur : ceux exigibles au plus tard le jour de la mutation et non soldés à
 * cette date (dus par le vendeur) ; ceux exigibles après (à réattribuer, jamais imputés au vendeur) ; pour tous, les
 * versements incohérents avec le réglé.
 */
function cotisationsALaMutation(
  postes: PosteDette[],
  versements: VersementFondsTravaux[],
  lotId: string,
  compteId: string,
  date: string,
): { impayees: CotisationImpayeeVendeur[]; aReattribuer: PosteAReattribuer[]; anomalies: AnomalieFondsTravauxLots[] } {
  const duVendeur = postes.filter((p) => p.typeAppel === 'Fonds travaux' && p.lotId === lotId && p.compteId === compteId)
  const impayees = duVendeur
    .filter((p) => p.exigibilite <= date)
    .map((p) => resteDuALaMutation(p, versements, date))
    .filter((c) => c.resteCentimes > 0)
  const anomalies = duVendeur.flatMap((p) => incoherenceDuPoste(p, versements, date) ?? [])
  const aReattribuer = duVendeur
    .filter((p) => p.exigibilite > date)
    .map((p) => ({ posteId: p.id, exigibilite: p.exigibilite, montantCentimes: p.montantCentimes, regleCentimes: p.regleCentimes }))
  return { impayees, aReattribuer, anomalies }
}

function verifierNbLots(nbLots: number | null): void {
  if (nbLots !== null && (!Number.isInteger(nbLots) || nbLots < 0))
    throw new Error(`Nombre de lots invalide (${nbLots}) : entier positif ou nul attendu.`)
}

export interface FondsTravauxMutation {
  lotId: string
  date: string
  compteVendeurId: string
  /** Part rattachée au lot au jour de la mutation : inchangée par la mutation, elle suit le lot. */
  partRattacheeCentimes: number
  /** Encaissements du compte vendeur sur le lot pendant sa présence continue, jusqu'à la mutation incluse, hors reprise. */
  verseParLeVendeurCentimes: number
  /** Part reprise du syndic précédent, comprise dans la part rattachée : elle n'est pas un versement du vendeur. */
  partRepriseCentimes: number
  /** Appels du fonds dus par le vendeur et impayés à la mutation : dettes du vendeur, distinctes de la part du lot. */
  cotisationsImpayeesVendeur: CotisationImpayeeVendeur[]
  /** Appels du fonds exigibles après la mutation mais encore au compte vendeur : à réattribuer, non dus par le vendeur. */
  postesAReattribuer: PosteAReattribuer[]
  /**
   * Anomalies de l'état par lot qui touchent ce lot (part négative, emploi non déduit, non couvert ou en excédent sur sa
   * clé), et postes du vendeur dont les versements dépassent le réglé.
   */
  anomalies: AnomalieFondsTravauxLots[]
  mention: string
  fondements: string[]
  aConfirmer: true
}

/**
 * Effet de la mutation d'un lot sur le fonds de travaux (à appeler à côté de muterLot, sans le modifier) : la part reste
 * au lot, sans remboursement au vendeur ni écriture ; appels du fonds restés impayés par le vendeur à la date ; appels
 * exigibles après la mutation restés à son compte, à réattribuer. Le fondement dépend de la date et du nombre de lots
 * principaux (null : inconnu). Les informations dues à l'acquéreur (CCH L. 721-2) sont arrêtées à une autre date : voir
 * informationsFondsTravauxAcquereur.
 *
 * `postes` et `versements` doivent être issus de la même imputation (imputerEncaissements, puis
 * versementsFondsTravauxDepuisImputations sur ses résultats) : le réglé du poste fait foi pour le reste dû, et un poste
 * dont le total des versements dépasse le réglé est signalé (versements_poste_incoherents).
 */
export function fondsTravauxALaMutation({
  positions,
  lotId,
  date,
  nbLotsPrincipaux,
  versements,
  emplois,
  cles,
  postes,
  mode = 'prorata',
}: {
  positions: Position[]
  lotId: string
  date: string
  nbLotsPrincipaux: number | null
  versements: VersementFondsTravaux[]
  emplois: EmploiFondsTravaux[]
  cles: CleRepartition[]
  postes: PosteDette[]
  mode?: ModeEmploi
}): FondsTravauxMutation {
  verifierDate(date, 'Date de mutation')
  verifierNbLots(nbLotsPrincipaux)
  const vendeur = vendeurEnPlace(positions, lotId, ajouterJours(date, -1), `Mutation du lot ${lotId} : compte vendeur introuvable ou multiple la veille du ${dateIsoVersFr(date)}.`)
  const etat = partsFondsTravauxParLot({ versements, emplois, cles, date, mode })
  const duLot = versements.filter((v) => v.lotId === lotId && v.date <= date)
  const cession = CESSION[regimeCession(date, nbLotsPrincipaux)]
  const cotisations = cotisationsALaMutation(postes, versements, lotId, vendeur.compteId, date)
  return {
    lotId,
    date,
    compteVendeurId: vendeur.compteId,
    partRattacheeCentimes: etat.parts.find((p) => p.lotId === lotId)?.partCentimes ?? 0,
    verseParLeVendeurCentimes: somme(duLot.filter((v) => v.source === 'encaissement' && v.compteId === vendeur.compteId && v.date >= vendeur.depuis)),
    partRepriseCentimes: somme(duLot.filter((v) => v.source === 'reprise')),
    cotisationsImpayeesVendeur: cotisations.impayees,
    postesAReattribuer: cotisations.aReattribuer,
    anomalies: [...anomaliesDuLot(etat.anomalies, emplois, cles, lotId), ...cotisations.anomalies],
    mention: cession.mention,
    fondements: [...cession.fondements],
    aConfirmer: true,
  }
}

export interface InformationsFondsTravauxAcquereur {
  lotId: string
  datePromesse: string
  /** Clôture de l'exercice dont les comptes ont été soumis à la dernière AG annuelle d'approbation avant la promesse. */
  dateArrete: string
  compteVendeurId: string
  /** Part rattachée au lot à la date d'arrêté. */
  partRattacheeCentimes: number
  /**
   * 🔴 Lecture « dernier appel soldé » : dernier appel du fonds entièrement versé par le vendeur, pendant sa présence
   * continue sur le lot, à la date d'arrêté ; null si aucun.
   */
  derniereCotisationVendeur: DerniereCotisation | null
  /**
   * 🔴 Lecture « cotisation annuelle » (art. 14-2-1, I, al. 6) : appels entièrement versés par le vendeur dans l'exercice
   * de ce dernier appel ; null sans appel soldé ou sans exercice fourni qui le contienne.
   */
  cotisationAnnuelleVendeur: CotisationAnnuelleVersee | null
  anomalies: AnomalieFondsTravauxLots[]
  mention: string
  fondements: string[]
  aConfirmer: true
}

const DERNIERE_COTISATION_A_TRANCHER =
  "« Dernière cotisation versée » : dernier appel soldé ou cotisation annuelle de son exercice (art. 14-2-1, I, al. 6), lecture à trancher avant remise."

/**
 * Entrée en vigueur de la loi n° 2021-1104, art. 171, II, 4° (modification de CCH art. L. 721-2), selon le nombre de
 * lots à usage de logements, de bureaux ou de commerces : art. 171, VII, « Par exception au VI ».
 */
const ENTREE_EN_VIGUEUR_INFORMATION_ACQUEREUR = [
  { lotsAuMoins: 201, annee: 2024 },
  { lotsAuMoins: 51, annee: 2025 },
  { lotsAuMoins: 0, annee: 2026 },
] as const
const PREMIERE_ENTREE_INFORMATION = composerDateIso(ENTREE_EN_VIGUEUR_INFORMATION_ACQUEREUR[0].annee, 1, 1)
const DERNIERE_ENTREE_INFORMATION = composerDateIso(ENTREE_EN_VIGUEUR_INFORMATION_ACQUEREUR[2].annee, 1, 1)
/**
 * Début de la rédaction de CCH art. L. 721-2 issue de l'ordonnance n° 2015-1075, relue (Légifrance : « En vigueur du
 * 29 août 2015 au 01 janv. 2024 ») : d) et alinéa suivant mot pour mot ceux de la rédaction issue de la loi n° 2021-1104.
 */
const DEBUT_L721_2_ORDONNANCE_2015 = composerDateIso(2015, 8, 29)

type RedactionInformation = 'loi_2021' | 'ordonnance_2015' | 'selon_lots' | 'non_relue'

/** Rédaction de CCH art. L. 721-2 applicable à la promesse, selon sa date et le nombre de lots (null : inconnu). */
function redactionInformation(datePromesse: string, nbLots: number | null): RedactionInformation {
  if (datePromesse >= DERNIERE_ENTREE_INFORMATION) return 'loi_2021'
  if (datePromesse < DEBUT_L721_2_ORDONNANCE_2015) return 'non_relue'
  if (datePromesse < PREMIERE_ENTREE_INFORMATION) return 'ordonnance_2015'
  if (nbLots === null) return 'selon_lots'
  const palier = ENTREE_EN_VIGUEUR_INFORMATION_ACQUEREUR.find((e) => nbLots >= e.lotsAuMoins) ?? ENTREE_EN_VIGUEUR_INFORMATION_ACQUEREUR[2]
  return datePromesse >= composerDateIso(palier.annee, 1, 1) ? 'loi_2021' : 'ordonnance_2015'
}

const D_ET_ALINEA_SUIVANT = 'CCH art. L. 721-2, II, 2°, d) et alinéa suivant'
const DEBUT_2015_FR = dateIsoVersFr(DEBUT_L721_2_ORDONNANCE_2015)
const REDACTIONS_RELUES: Record<Exclude<RedactionInformation, 'non_relue'>, string> = {
  loi_2021: 'Rédaction issue de la loi n° 2021-1104, art. 171, II, 4° (entrée en vigueur : art. 171, VII)',
  ordonnance_2015: `Rédaction issue de l'ordonnance n° 2015-1075, en vigueur depuis le ${DEBUT_2015_FR} jusqu'à l'entrée en vigueur fixée par la loi n° 2021-1104, art. 171, VII : d) et alinéa suivant identiques à ceux de la rédaction issue de cette loi`,
  selon_lots:
    "Rédaction issue de l'ordonnance n° 2015-1075 ou de la loi n° 2021-1104 selon le nombre de lots (art. 171, VII) : d) et alinéa suivant identiques dans les deux",
}

/** Fondement et mention de l'information selon la date de la promesse et le nombre de lots : rédaction relue, ou à établir. */
function fondementInformation(datePromesse: string, dateArrete: string, nbLots: number | null): { mention: string; fondements: string[] } {
  const arrete = `Montants arrêtés au ${dateIsoVersFr(dateArrete)}, à jour des comptes soumis à l'assemblée générale annuelle précédant la promesse ; à remettre au plus tard à la signature de la promesse. ${DERNIERE_COTISATION_A_TRANCHER}`
  const redaction = redactionInformation(datePromesse, nbLots)
  if (redaction !== 'non_relue') return { mention: arrete, fondements: [D_ET_ALINEA_SUIVANT, REDACTIONS_RELUES[redaction]] }
  return {
    mention: `Fondement à établir : promesse antérieure au ${DEBUT_2015_FR}, rédaction de CCH art. L. 721-2 alors applicable non relue. ${arrete}`,
    fondements: [`CCH art. L. 721-2 : rédaction antérieure au ${DEBUT_2015_FR} à établir (non relue)`],
  }
}

/**
 * Informations sur le fonds de travaux dues à l'acquéreur d'un lot principal en cas de promesse (CCH L. 721-2, II, 2°,
 * d) : part rattachée au lot et dernière cotisation versée par le vendeur, à jour des comptes soumis à l'AG annuelle
 * qui précède la promesse, donc calculées à `dateArrete` (clôture de cet exercice, antérieure à la promesse). La
 * dernière cotisation est rendue sous ses deux lectures (🔴), sur les versements du vendeur pendant sa présence continue
 * sur le lot ; `exercices` : exercices du syndicat, pour la lecture « cotisation annuelle ». `nbLotsPrincipaux` (null :
 * inconnu) désigne la rédaction de L. 721-2 applicable (loi n° 2021-1104, art. 171, VII) ; le d) et l'alinéa suivant
 * étant identiques dans les rédactions de 2015 et de 2021, seule une promesse antérieure au 29/08/2015 laisse le fondement
 * à établir. Sans promesse, ces informations ne sont pas exigées (III) : ne pas appeler.
 */
export function informationsFondsTravauxAcquereur({
  positions,
  lotId,
  datePromesse,
  dateArrete,
  nbLotsPrincipaux,
  versements,
  emplois,
  cles,
  exercices,
  mode = 'prorata',
}: {
  positions: Position[]
  lotId: string
  datePromesse: string
  dateArrete: string
  nbLotsPrincipaux: number | null
  versements: VersementFondsTravaux[]
  emplois: EmploiFondsTravaux[]
  cles: CleRepartition[]
  exercices: ExerciceSyndicat[]
  mode?: ModeEmploi
}): InformationsFondsTravauxAcquereur {
  verifierDate(datePromesse, 'Date de la promesse')
  verifierDate(dateArrete, "Date d'arrêté des comptes")
  verifierNbLots(nbLotsPrincipaux)
  if (dateArrete >= datePromesse)
    throw new Error(
      `Arrêté des comptes du ${dateIsoVersFr(dateArrete)} : il doit précéder la promesse du ${dateIsoVersFr(datePromesse)} (clôture de l'exercice approuvé par la dernière AG annuelle avant la promesse).`,
    )
  verifierExercices(exercices)
  const vendeur = vendeurEnPlace(positions, lotId, datePromesse, `Promesse sur le lot ${lotId} : compte vendeur introuvable ou multiple le ${dateIsoVersFr(datePromesse)}.`)
  const etat = partsFondsTravauxParLot({ versements, emplois, cles, date: dateArrete, mode })
  const soldees = cotisationsSoldees(
    versements.filter((v) => v.lotId === lotId && v.compteId === vendeur.compteId && v.date >= vendeur.depuis),
    dateArrete,
  )
  const derniere = plusRecenteDes(soldees)
  return {
    lotId,
    datePromesse,
    dateArrete,
    compteVendeurId: vendeur.compteId,
    partRattacheeCentimes: etat.parts.find((p) => p.lotId === lotId)?.partCentimes ?? 0,
    derniereCotisationVendeur: derniere,
    cotisationAnnuelleVendeur: cotisationAnnuelleSoldee(soldees, derniere, exercices),
    anomalies: anomaliesDuLot(etat.anomalies, emplois, cles, lotId),
    ...fondementInformation(datePromesse, dateArrete, nbLotsPrincipaux),
    aConfirmer: true,
  }
}
