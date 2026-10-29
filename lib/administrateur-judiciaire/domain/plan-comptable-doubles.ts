import type { PlanComptable } from '@/lib/administrateur-judiciaire/domain/plan-comptable'
import type { SourceComptable } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Clé d'une entrée de plan comptable et doubles à l'import (point 29 du bilan 2). Fonctions pures, sans écran ni table :
 * l'écriture en base, l'index Dexie et la réécriture des références restent à Frédéric.
 *
 * Gestéam — 🟢 tranche 43 § 21 (Syndic → Réglages → 1 - Plan comptable, source Copropriété, ≈ 710 entrées) : six codes
 * apparaissent deux fois sans sous-compte. 45000, 45900, 49200 et 53000 : fiches identiques (type, nature, lien,
 * catégorie, n° compte, sous-compte, pointé), seul le libellé diffère par un « _ » final. 71147 : même paramétrage, mais le
 * second libellé est celui d'une opération, entre parenthèses. 47150 : deux entrées différentes, l'une de type « Compte
 * d'attente » (pointé Inclu, proposée par défaut aux nouveaux mandats), l'autre de type « Bascule gérance copropriété »
 * (pointé Exclu) : c'est le type, et non le code, qui décide de l'usage. 🟢 Tranche 21 § 4.2 : 24 lignes portent un
 * sous-compte (colonne « Compte ») ; le même code y revient avec des sous-comptes différents. 🟢 Tranche 24 § 2 : le
 * référentiel « Type de plan » n'a jamais pu être déroulé (le type reste une chaîne libre).
 *
 * Le droit — 🟢 lu sur Légifrance le 29/10/2026 (versions en vigueur, dernière modification des deux textes le
 * 31/12/2020) : décret n° 2005-240 du 14 mars 2005, art. 11 (renvoi à l'arrêté conjoint pour l'établissement des
 * comptes) ; arrêté du 14 mars 2005 relatif aux comptes du syndicat des copropriétaires, art. 6 (la nomenclature est la
 * liste des comptes « classés, numérotés et définis par une terminologie et des règles de fonctionnement »), art. 7 (sous
 * 47 « Compte d'attente », deux comptes seulement : 471 débiteur et 472 créditeur ; ni 4711 ni 47150 ; en classe 5,
 * seulement 50, 51 et 53), art. 8 (les comptes retenus sont « les seuls utilisables » par le syndic ; « lorsque les
 * comptes prévus par la présente nomenclature ne suffisent pas au syndicat pour enregistrer distinctement toutes ses
 * opérations », il « peut ouvrir toute subdivision nécessaire »), art. 9 (aucune compensation entre comptes à solde
 * débiteur et à solde créditeur), art. 10 (le compte 47 est soldé à la fin de l'exercice ou justifié ligne à ligne).
 * Aucun texte ne parle d'unicité d'un numéro, ni de « type de plan » : c'est une notion du logiciel.
 *
 * 🔵 Déduit (choix de modélisation, ni imposé ni interdit par les textes) :
 * - lecture des codes du logiciel au regard du droit : la plupart des codes à cinq caractères se lisent comme un compte
 *   de l'art. 7 complété à cinq caractères (ainsi 45000 ou 53000) ou comme une subdivision de ce compte (art. 8) ; la
 *   fiche 00000 et la plage 58xxx (tranche 21 § 2) ne se rattachent à aucun compte de l'art. 7 ;
 * - clé = (source, code, sous-compte, type). La source suit l'index Dexie existant [source+code] ; le sous-compte suit la
 *   tranche 21 § 4.2 (sans lui, deux lignes de sous-comptes différents seraient prises pour des doubles, voire fusionnées) ;
 *   un type ou un sous-compte absent, vide ou blanc vaut une valeur de clé à part entière (null) ; pour désigner une
 *   entrée, un critère `null` exige donc l'absence, un critère non renseigné (undefined) ne filtre pas ;
 * - les doubles « _ » identiques sont des doublons de paramétrage venus d'une reprise (tranche 43 § 21) ; le sens du « _ »
 *   n'est pas observé (tranche 21 § 5) : seuls les doubles identiques sur tout le reste sont fusionnés ;
 * - comparaison de deux entrées : tous les champs sauf l'identifiant, l'ordre d'affichage et ceux de la clé ; le libellé
 *   est comparé sans son « _ » final ; les notes comptent ;
 * - aucune fusion partielle : un groupe dont une entrée diffère est entièrement mis en attente ; une entrée sans type à
 *   côté d'une entrée typée met en attente toutes les entrées de ce code, de cette source et de ce sous-compte (les
 *   autres sous-comptes du même code ne sont pas touchés) ;
 * - asymétrie voulue entre sous-compte et type : une entrée sans sous-compte à côté d'entrées à sous-compte du même code
 *   (même source) est importée sans signalement, alors qu'une entrée sans type à côté d'une entrée typée est bloquante
 *   (type_absent). Le sous-compte est une colonne de la liste du plan, et le couple (plan, compte) en est la clé observée
 *   (tranche 21 § 4.2) ; seules 24 lignes sur 710 en portent un (tranche 21 § 1 et § 4.2) : l'absence est la norme, non
 *   l'indice d'un double ; l'entrée sans sous-compte se désigne par `sousCompte: null`. Le type, lui, n'apparaît pas
 *   dans la liste et ne se lit que sur la fiche (tranche 21 § 4.3 et § 7, tranche 43 § 21) : son absence à côté d'un
 *   type ne dit pas si l'entrée est un double ou une autre entrée. Lecture provisoire : voir 🔴 ;
 * - un même code à plusieurs types reste importé (signalement non bloquant, chaque type gardant ses propres règles de
 *   double) : le numéro de compte (formaterNumeroCompte) ne porte que le code, d'où une collision possible dans un même
 *   mandat.
 *
 * 🔴 Non établi (à trancher par Frédéric ou Hugo) :
 * - le type « Bascule gérance copropriété » doit-il recevoir un numéro de subdivision distinct de 47150 (arrêté art. 6
 *   et 8), et son solde peut-il être créditeur alors que 471 est le compte d'attente débiteur (art. 7 et 9) ? Comment
 *   relier un compte à son entrée de plan pour distinguer les deux 47150 (la table des comptes ne porte que le numéro) ?
 * - un même code peut-il porter à la fois une entrée sans sous-compte et des entrées à sous-compte (40100 générique à
 *   côté de 40100/00101) ? La tranche 21 § 4.2 ne l'établit pas. Si oui, l'entrée sans sous-compte est-elle une entrée
 *   distincte (lecture actuelle : importée sans signalement) ou un double à mettre en attente comme `type_absent` ?
 * - le sous-compte « 00000 », observé en tranche 21 § 4.2, vaut-il « sans sous-compte » ? Il est lu aujourd'hui comme un
 *   sous-compte ordinaire : 40100 sans sous-compte et 40100/00000 donnent deux clés, sans signalement.
 */

/** Clé d'une entrée de plan : (source, code, sous-compte, type), sérialisée. */
export type ClePlanComptable = string

/** Composante facultative de clé : absente, vide ou blanche → null ; espaces de bord retirés. */
function composanteCle(valeur: string | null | undefined): string | null {
  const nette = valeur?.trim()
  if (!nette) return null
  return nette
}

export const clePlanComptable = (entree: Pick<PlanComptable, 'source' | 'code' | 'sousCompte' | 'type'>): ClePlanComptable =>
  JSON.stringify([entree.source, entree.code, composanteCle(entree.sousCompte), composanteCle(entree.type)])

/** Même source, même code, même sous-compte : les entrées qui ne se distinguent plus que par le type. */
const cleFamille = (entree: PlanComptable): string =>
  JSON.stringify([entree.source, entree.code, composanteCle(entree.sousCompte)])

/** Libellé sans les « _ » finaux (ni les espaces qui les entourent) : « COPROPRIETAIRES_ » → « COPROPRIETAIRES ». */
export function libelleSansSuffixeDouble(libelle: string): string {
  let resultat = libelle.trimEnd()
  while (resultat.endsWith('_')) resultat = resultat.slice(0, -1)
  return resultat.trimEnd()
}

// --- Désigner une entrée ------------------------------------------------------------------------------------------

export interface CritereEntreePlan {
  source: SourceComptable
  code: string
  /**
   * Non renseigné (undefined) : ne filtre pas. Renseigné, il se lit comme la clé : null, vide ou blanc exige l'entrée sans
   * sous-compte (40100 générique à côté de 40100-00101).
   */
  sousCompte?: string | null
  /**
   * Non renseigné (undefined) : ne filtre pas ; plusieurs candidates donnent « ambigue ». Renseigné, il se lit comme la
   * clé : null, vide ou blanc exige l'entrée sans type.
   */
  type?: string | null
}

export type ResolutionEntreePlan =
  | { statut: 'trouvee'; entree: PlanComptable }
  | { statut: 'absente' }
  | { statut: 'ambigue'; candidates: PlanComptable[] }

/** undefined : pas de filtre ; toute autre valeur est comparée comme une composante de clé (null exige l'absence). */
const correspond = (attendu: string | null | undefined, valeur: string | undefined): boolean =>
  attendu === undefined || composanteCle(attendu) === composanteCle(valeur)

/** Entrée de plan désignée par le critère ; jamais « la première trouvée » : plusieurs candidates → « ambigue » (47150). */
export function resoudreEntreePlan(entrees: readonly PlanComptable[], critere: CritereEntreePlan): ResolutionEntreePlan {
  const candidates = entrees.filter(
    (e) =>
      e.source === critere.source &&
      e.code === critere.code &&
      correspond(critere.sousCompte, e.sousCompte) &&
      correspond(critere.type, e.type),
  )
  if (candidates.length === 0) return { statut: 'absente' }
  if (candidates.length === 1) return { statut: 'trouvee', entree: candidates[0] }
  return { statut: 'ambigue', candidates }
}

// --- Import et doubles --------------------------------------------------------------------------------------------

export type MotifSignalementPlan = 'types_distincts' | 'libelle_different' | 'parametrage_different' | 'type_absent'

export interface FusionDoublePlan {
  cle: ClePlanComptable
  code: string
  conserveId: string
  absorbesIds: string[]
}

export interface SignalementDoublePlan {
  motif: MotifSignalementPlan
  code: string
  /** Toutes les entrées concernées, dans l'ordre de l'import. */
  ids: string[]
  /**
   * Champs qui diffèrent entre ces entrées, triés (libellé comparé sans son « _ » final). Pour `types_distincts` et
   * `type_absent`, la liste comprend le type et tous les autres champs qui diffèrent dans la famille.
   */
  champsDifferents: (keyof PlanComptable)[]
  /** Bloquant : les entrées sont dans `enAttente`, à arbitrer avant écriture. */
  bloquant: boolean
  message: string
}

export interface ResultatImportPlanComptable {
  /** Une entrée par clé, dans l'ordre de première occurrence de l'import. */
  entrees: PlanComptable[]
  fusions: FusionDoublePlan[]
  /** Identifiant absorbé → identifiant conservé, pour réécrire les références. */
  remplacements: Record<string, string>
  signalements: SignalementDoublePlan[]
  /** Entrées des groupes bloquants, dans l'ordre de l'import. */
  enAttente: PlanComptable[]
}

/**
 * Hors comparaison : l'identifiant, l'ordre d'affichage et les champs de la clé (égaux par construction du groupe). Dans
 * une famille, seul le type varie parmi eux : champsAvecType l'ajoute.
 */
const CHAMPS_HORS_COMPARAISON: ReadonlySet<string> = new Set<keyof PlanComptable>(['id', 'ordre', 'source', 'code', 'sousCompte', 'type'])

const BLOQUANT: Record<MotifSignalementPlan, boolean> = {
  types_distincts: false,
  libelle_different: true,
  parametrage_different: true,
  type_absent: true,
}

const valeurComparee = (entree: PlanComptable, champ: keyof PlanComptable): unknown =>
  champ === 'libelle' ? libelleSansSuffixeDouble(entree.libelle) : entree[champ]

function champsDifferents(groupe: readonly PlanComptable[]): (keyof PlanComptable)[] {
  const [reference, ...autres] = groupe
  const differents = new Set<keyof PlanComptable>()
  for (const autre of autres) {
    const champs = new Set([...Object.keys(reference), ...Object.keys(autre)]) as Set<keyof PlanComptable>
    for (const champ of champs) {
      if (!CHAMPS_HORS_COMPARAISON.has(champ) && !Object.is(valeurComparee(reference, champ), valeurComparee(autre, champ)))
        differents.add(champ)
    }
  }
  return [...differents].sort((a, b) => a.localeCompare(b))
}

/** Champs qui diffèrent dans une famille d'entrées de types différents (ou typées et non typées) : le type compris. */
const champsAvecType = (famille: readonly PlanComptable[]): (keyof PlanComptable)[] =>
  [...champsDifferents(famille), 'type' as const].sort((a, b) => a.localeCompare(b))

function grouper(entrees: readonly PlanComptable[], cle: (entree: PlanComptable) => string): PlanComptable[][] {
  const groupes = new Map<string, PlanComptable[]>()
  for (const entree of entrees) {
    const valeur = cle(entree)
    const groupe = groupes.get(valeur)
    if (groupe) groupe.push(entree)
    else groupes.set(valeur, [entree])
  }
  return [...groupes.values()]
}

function rangsParId(entrees: readonly PlanComptable[]): Map<string, number> {
  const rangs = new Map<string, number>()
  for (const [rang, entree] of entrees.entries()) {
    if (rangs.has(entree.id)) throw new Error(`Import du plan comptable : l'identifiant « ${entree.id} » figure deux fois.`)
    rangs.set(entree.id, rang)
  }
  return rangs
}

function designation(entree: PlanComptable, avecType: boolean): string {
  const sousCompte = composanteCle(entree.sousCompte)
  const type = composanteCle(entree.type)
  let texte = `Code ${entree.code} (${entree.source})`
  if (sousCompte) texte += `, sous-compte ${sousCompte}`
  if (avecType && type) texte += `, type « ${type} »`
  return texte
}

const guillemets = (valeurs: readonly (string | null)[]): string =>
  [...new Set(valeurs)].map((v) => `« ${v ?? ''} »`).join(' / ')

function signalement(
  motif: MotifSignalementPlan,
  entrees: readonly PlanComptable[],
  champs: (keyof PlanComptable)[],
  message: string,
): SignalementDoublePlan {
  return { motif, code: entrees[0].code, ids: entrees.map((e) => e.id), champsDifferents: champs, bloquant: BLOQUANT[motif], message }
}

interface Accumulateur {
  rangs: Map<string, number>
  conservees: { entree: PlanComptable; rang: number }[]
  fusions: FusionDoublePlan[]
  signalements: SignalementDoublePlan[]
  idsEnAttente: Set<string>
}

function mettreEnAttente(entrees: readonly PlanComptable[], acc: Accumulateur): void {
  for (const entree of entrees) acc.idsEnAttente.add(entree.id)
}

const finitParSuffixeDouble = (libelle: string): boolean => libelle.trimEnd().endsWith('_')

function fusionner(groupe: readonly PlanComptable[], rang: number, acc: Accumulateur): void {
  const conservee = groupe.find((e) => !finitParSuffixeDouble(e.libelle)) ?? groupe[0]
  acc.conservees.push({ entree: conservee, rang })
  acc.fusions.push({
    cle: clePlanComptable(conservee),
    code: conservee.code,
    conserveId: conservee.id,
    absorbesIds: groupe.filter((e) => e !== conservee).map((e) => e.id),
  })
}

/** Un groupe = les entrées d'une même clé. Seule : conservée ; identiques : fusionnées ; sinon : en attente. */
function traiterGroupe(groupe: readonly PlanComptable[], acc: Accumulateur): void {
  const rang = acc.rangs.get(groupe[0].id) ?? 0
  if (groupe.length === 1) {
    acc.conservees.push({ entree: groupe[0], rang })
    return
  }
  const champs = champsDifferents(groupe)
  if (champs.length === 0) {
    fusionner(groupe, rang, acc)
    return
  }
  mettreEnAttente(groupe, acc)
  const nom = designation(groupe[0], true)
  if (champs.length === 1 && champs[0] === 'libelle') {
    const libelles = guillemets(groupe.map((e) => e.libelle))
    const message =
      `${nom} : même paramétrage, libellés différents (${libelles}) ; ` +
      'entrées mises en attente : choisir le libellé à conserver.'
    acc.signalements.push(signalement('libelle_different', groupe, champs, message))
    return
  }
  const message = `${nom} : paramétrage différent (${champs.join(', ')}) ; entrées mises en attente, aucune fusion.`
  acc.signalements.push(signalement('parametrage_different', groupe, champs, message))
}

/** Une entrée sans type à côté d'une entrée typée : toute la famille (même source, code et sous-compte) en attente. */
function signalerTypeAbsent(famille: readonly PlanComptable[], acc: Accumulateur): void {
  mettreEnAttente(famille, acc)
  const portee = composanteCle(famille[0].sousCompte) === null ? 'de ce code sans sous-compte' : 'de ce code et de ce sous-compte'
  const message =
    `${designation(famille[0], false)} : une entrée sans type côtoie une entrée typée ; double ou entrée distincte, ` +
    `impossible à dire : toutes les entrées ${portee} (même source) sont mises en attente.`
  acc.signalements.push(signalement('type_absent', famille, champsAvecType(famille), message))
}

const accorder = (nombre: number, participe: string): string => `${nombre} ${participe}${nombre > 1 ? 's' : ''}`

/** Sort des entrées d'une famille une fois ses groupes traités : « toutes conservées » seulement si c'est le cas. */
function bilanFamille(famille: readonly PlanComptable[], acc: Accumulateur): string {
  const absorbes = new Set(acc.fusions.flatMap((f) => f.absorbesIds))
  const enAttente = famille.filter((e) => acc.idsEnAttente.has(e.id)).length
  const absorbees = famille.filter((e) => absorbes.has(e.id)).length
  if (enAttente === 0 && absorbees === 0) return 'toutes conservées'
  const conservees = famille.length - enAttente - absorbees
  return `${accorder(conservees, 'conservée')}, ${accorder(absorbees, 'absorbée')} par fusion, ${enAttente} en attente`
}

function signalementTypesDistincts(
  famille: readonly PlanComptable[],
  groupes: readonly PlanComptable[][],
  acc: Accumulateur,
): SignalementDoublePlan {
  const types = guillemets(groupes.map((g) => composanteCle(g[0].type)))
  const message =
    `${designation(famille[0], false)} : ${famille.length} entrées de ${groupes.length} types distincts (${types}), ` +
    `${bilanFamille(famille, acc)}. Le numéro de compte ne porte que le code du plan : désigner l'entrée par son type, ` +
    'jamais par le code seul ; dans un même mandat, la même règle de numérotation donnerait le même numéro.'
  return signalement('types_distincts', famille, champsAvecType(famille), message)
}

/** Une famille = les entrées de même source, code et sous-compte : elles ne diffèrent que par le type. */
function traiterFamille(famille: readonly PlanComptable[], acc: Accumulateur): void {
  const typees = famille.filter((e) => composanteCle(e.type) !== null).length
  if (typees > 0 && typees < famille.length) {
    signalerTypeAbsent(famille, acc)
    return
  }
  const groupes = grouper(famille, clePlanComptable)
  const position = acc.signalements.length
  for (const groupe of groupes) traiterGroupe(groupe, acc)
  // Le signalement de famille est rédigé après le traitement des groupes (son bilan en dépend), mais placé avant les leurs.
  if (groupes.length > 1) acc.signalements.splice(position, 0, signalementTypesDistincts(famille, groupes, acc))
}

/**
 * Import du plan comptable Gestéam : une entrée par clé (source, code, sous-compte, type). Les doubles identiques au « _ »
 * final près sont fusionnés (l'entrée sans « _ » est conservée, sinon la première) ; les autres doubles sont signalés et
 * mis en attente ; un même code à plusieurs types est conservé et signalé sans blocage. Garantie : chaque entrée de l'import
 * se retrouve une seule fois, conservée, absorbée ou en attente. Un identifiant en double est refusé.
 */
export function importerPlanComptable(entrees: readonly PlanComptable[]): ResultatImportPlanComptable {
  const acc: Accumulateur = { rangs: rangsParId(entrees), conservees: [], fusions: [], signalements: [], idsEnAttente: new Set() }
  for (const famille of grouper(entrees, cleFamille)) traiterFamille(famille, acc)
  return {
    entrees: [...acc.conservees].sort((a, b) => a.rang - b.rang).map((c) => c.entree),
    fusions: acc.fusions,
    remplacements: Object.fromEntries(acc.fusions.flatMap((f) => f.absorbesIds.map((id) => [id, f.conserveId]))),
    signalements: acc.signalements,
    enAttente: entrees.filter((e) => acc.idsEnAttente.has(e.id)),
  }
}
