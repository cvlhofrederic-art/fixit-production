import { joursAvantDateFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { normaliserNomPersonne, sansAccentsMinuscules } from '@/lib/administrateur-judiciaire/domain/texte'
import { MODE_ACTIF, type Mode } from '@/lib/administrateur-judiciaire/mode'

/**
 * Sélecteur de copropriété du haut de page (demande de Hugo du 29/10/2026) : le « Tableau de bord », page d'accueil,
 * reste une vue de tous les mandats ; toute autre page s'affiche selon la copropriété choisie.
 */

/**
 * Routes qui montrent tous les mandats, quelle que soit la copropriété choisie : le tableau de bord, et « cockpit »
 * (ancienne page « Aujourd'hui », retirée du menu et redirigée vers le tableau de bord), qui garde la même portée.
 */
export const ROUTES_TOUS_MANDATS: ReadonlySet<string> = new Set(['cockpit', 'dashboard'])

export const estRouteTousMandats = (route: string): boolean => ROUTES_TOUS_MANDATS.has(route)

/** Pages du cabinet, sans lien avec une copropriété : elles restent globales (décision du 29/10/2026). */
export const ROUTES_CABINET: ReadonlySet<string> = new Set([
  'equipe',
  'portefeuille',
  'charge',
  'pointage',
  'modules',
  'parametres',
  'rgpd',
])

/** « generale » : vue de tous les mandats ou du cabinet ; « copro » : page affichée selon la copropriété choisie. */
export type PorteeRoute = 'generale' | 'copro'

/** Portée d'une page ; toute route hors vues générales et pages du cabinet (inconnue comprise) suit la copropriété. */
export const porteeRoute = (route: string): PorteeRoute =>
  estRouteTousMandats(route) || ROUTES_CABINET.has(route) ? 'generale' : 'copro'

/**
 * Lignes rattachées à la copropriété `code` (ordre conservé) ; toutes les lignes, dans un nouveau tableau, quand aucune
 * copropriété n'est choisie (`code` nul ou vide : comportement d'un écran rendu seul).
 */
export function filtrerParCopro<T>(
  lignes: readonly T[],
  code: string | null | undefined,
  codeDeLigne: (ligne: T) => string | null | undefined,
): T[] {
  if (!code) return [...lignes]
  return lignes.filter((ligne) => codeDeLigne(ligne) === code)
}

/**
 * Noms des copropriétés de démonstration tels qu'ils figurent dans les données des écrans (noms longs et courts),
 * normalisés (minuscules sans accents, espaces réduits), vers leur code.
 */
const CODES_NOMS_DEMO: ReadonlyMap<string, string> = new Map([
  ['residence le meridien', 'LM'],
  ['le meridien', 'LM'],
  ['le clos des vignes', 'CV'],
  ['clos des vignes', 'CV'],
  ['copropriete les tilleuls', 'TL'],
  ['les tilleuls', 'TL'],
  ['villa montaigne', 'VM'],
])

/** Fin du nom dans un libellé composé (« Le Méridien · lot 12 », « Résidence Le Méridien, bât. A », « … (2026) »). */
const SEPARATEUR_LIBELLE = /[·,—(:]/

const cleNomCopro = (nom: string): string => normaliserNomPersonne(nom.split(SEPARATEUR_LIBELLE)[0])

/**
 * Code de la copropriété d'un nom (ou d'un libellé qui commence par ce nom) : d'abord parmi `copros` (base locale),
 * puis, en mode démo seulement, parmi les noms de la démonstration. Correspondance exacte du nom, sans accents ni
 * casse ; null si inconnu. En mode réel, une ligne de démonstration n'est rattachée à aucune copropriété de la base,
 * même quand leurs codes coïncident (« Villa Marine » reçoit VM, comme « Villa Montaigne »).
 */
export function codeDeNomCopro(
  nom: string | null | undefined,
  copros: readonly { code: string; nom: string }[] = [],
  mode: Mode = MODE_ACTIF,
): string | null {
  if (!nom) return null
  const cle = cleNomCopro(nom)
  if (!cle) return null
  const copro = copros.find((candidate) => cleNomCopro(candidate.nom) === cle)
  if (copro) return copro.code
  return mode === 'demo' ? (CODES_NOMS_DEMO.get(cle) ?? null) : null
}

/**
 * Code de copropriété d'une ligne de démonstration (champ code des données de démo) : son code en mode démo ; null en
 * mode réel, où aucune ligne de démonstration n'appartient à une copropriété de la base (voir codeDeNomCopro).
 */
export const codeLigneDemo = (code: string | null | undefined, mode: Mode = MODE_ACTIF): string | null =>
  mode === 'demo' ? (code ?? null) : null

/** Lots et copropriétaires lus pour rattacher une personne à une copropriété. */
export interface DonneesRattachementPersonne {
  lots: readonly { id: string; coproprieteId: string }[]
  coproprietaires: readonly { id: string; lotId: string }[]
}

/** Vrai si le lot du copropriétaire appartient à la copropriété ; faux pour une personne ou un lot introuvable. */
export function personneDeLaCopro(
  coproprietaireId: string,
  coproprieteId: string,
  donnees: DonneesRattachementPersonne,
): boolean {
  const personne = donnees.coproprietaires.find((candidat) => candidat.id === coproprietaireId)
  if (!personne) return false
  return donnees.lots.some((lot) => lot.id === personne.lotId && lot.coproprieteId === coproprieteId)
}

/** Champs lus par le sélecteur (vue copropriété ou copropriété de démonstration). */
export interface CoproSelectionnable {
  code: string
  nom: string
  fondement: string
  /** Fin de mission « JJ/MM/AAAA » (vide si inconnue). */
  echeance: string
}

/** Copropriétés dont le nom ou le code contient la recherche (sans accents ni casse) ; toutes si la recherche est vide. */
export function filtrerCopros<T extends CoproSelectionnable>(copros: readonly T[], recherche: string): T[] {
  const cherche = sansAccentsMinuscules(recherche.trim())
  if (!cherche) return [...copros]
  return copros.filter(
    (copro) => sansAccentsMinuscules(copro.nom).includes(cherche) || sansAccentsMinuscules(copro.code).includes(cherche),
  )
}

/**
 * Copropriété à afficher : le code choisi s'il existe encore, sinon le code mémorisé, sinon la première copropriété ;
 * null s'il n'y en a aucune. Seuls les codes sont lus.
 */
export function coproParDefaut(
  copros: readonly Pick<CoproSelectionnable, 'code'>[],
  choisi: string | null,
  memorise: string | null,
): string | null {
  const existe = (code: string | null) => !!code && copros.some((copro) => copro.code === code)
  if (existe(choisi)) return choisi
  if (existe(memorise)) return memorise
  return copros[0]?.code ?? null
}

const ARTICLE_CITE = /\bart\.?\s*(\d+(?:-\d+)?)/i

/** Fondement abrégé pour une pastille : l'article cité (« art. 46 », « art. 29-1 ») ; à défaut, le libellé entier. */
export function fondementCourt(fondement: string): string {
  const article = ARTICLE_CITE.exec(fondement)
  return article ? `art. ${article[1]}` : fondement.trim()
}

/** Rappel de la fin de mission : « J-48 », « Aujourd'hui », « Retard 30 j », ou vide si la date est inconnue. */
export function rappelFinMission(echeance: string, dateReferenceIso?: string): { texte: string; retard: boolean } {
  const jours = joursAvantDateFr(echeance, dateReferenceIso)
  if (jours === null) return { texte: '', retard: false }
  if (jours < 0) return { texte: `Retard ${-jours} j`, retard: true }
  if (jours === 0) return { texte: "Aujourd'hui", retard: false }
  return { texte: `J-${jours}`, retard: false }
}
