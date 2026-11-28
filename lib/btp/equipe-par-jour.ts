/**
 * Équipe d'une obra, jour par jour (demande de Frédéric du 28/11/2026 : « choisir les employés qui y sont, et pouvoir
 * modifier par JOUR si jamais d'autres y sont », puis « Il faut que je puisse dire quel employé a été sur le chantier
 * quel jour tu comprends pour le calcul »).
 *
 * Deux niveaux, sans rien changer à ce qui existait :
 *   1. l'équipe habituelle du chantier, `membres_ids` (migration 20261116), cochée dans la fiche ; elle travaille les
 *      jours ouvrés, du lundi au vendredi ;
 *   2. `equipe_par_jour` (migration 20261128f) : pour un jour donné, la liste EXACTE des employés présents, qui remplace
 *      l'équipe habituelle ce jour-là. Un samedi travaillé, un jour férié chômé, un renfort d'un jour, un absent.
 * Un jour à venir dont la liste égale l'équipe habituelle disparaît (`simplifierEquipeParJour`). Le passé, lui, ne
 * bouge plus : un jour passé garde sa liste, et quand l'équipe habituelle change, les jours passés sans liste reçoivent
 * l'ancienne équipe (`figerJoursPasses`).
 *
 * Les jours sont des chaînes « AAAA-MM-JJ » (dates de calendrier, sans fuseau) et se calculent en UTC : un jour ne
 * glisse jamais d'une case selon l'heure ou le fuseau du navigateur.
 *
 * Module pur, partagé par l'écran (components/dashboard/ChantiersBTPV2.tsx), la route (/api/btp, contrôle et
 * normalisation de la colonne, passé figé) et le pointage (lib/btp/pointage-regles.ts).
 */

/** Pour chaque jour inscrit (« AAAA-MM-JJ »), les employés présents ce jour-là (identifiants de membres_btp). */
export type EquipeParJour = Record<string, string[]>

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/
const JOUR_MS = 86_400_000

/**
 * Nombre maximal de jours parcourus pour une obra (un peu plus de trois ans). Une date de fin saisie par erreur
 * (2099…) ne doit ni geler l'écran ni produire une liste de 27 000 lignes.
 */
export const JOURS_MAX_PAR_CHANTIER = 1100

/** Nombre maximal d'employés inscrits un même jour (une société BTP réelle en a bien moins). */
export const MEMBRES_MAX_PAR_JOUR = 200

/** « AAAA-MM-JJ » d'une vraie date du calendrier (pas de 31 février). */
export function jourValide(jour: unknown): jour is string {
  if (typeof jour !== 'string' || !FORMAT_JOUR.test(jour)) return false
  const date = new Date(`${jour}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === jour
}

const versDate = (jour: string) => new Date(`${jour}T00:00:00Z`)
const versJour = (date: Date) => date.toISOString().slice(0, 10)

/** Jour suivant (« AAAA-MM-JJ »). */
export function jourSuivant(jour: string): string {
  return versJour(new Date(versDate(jour).getTime() + JOUR_MS))
}

/** Jour précédent (« AAAA-MM-JJ »). */
export function jourPrecedent(jour: string): string {
  return versJour(new Date(versDate(jour).getTime() - JOUR_MS))
}

/** Jour ouvré : du lundi au vendredi. Le samedi et le dimanche n'ont personne, sauf s'ils sont retouchés. */
export function estJourOuvre(jour: string): boolean {
  const jourSemaine = versDate(jour).getUTCDay()
  return jourSemaine !== 0 && jourSemaine !== 6
}

/**
 * Calendrier des jours travaillés par l'équipe habituelle. Par défaut du lundi au vendredi ; l'écran et la route y
 * retirent les fériés nationaux de l'obra (jourOuvreDans, lib/btp/jours-feries.ts).
 */
export type JourOuvre = (jour: string) => boolean

/**
 * Jours de `debut` à `fin`, les deux inclus, au plus JOURS_MAX_PAR_CHANTIER. Liste vide si une des dates manque, est
 * invalide, ou si la fin précède le début.
 */
export function joursEntre(debut: string | null | undefined, fin: string | null | undefined): string[] {
  if (!jourValide(debut) || !jourValide(fin) || fin < debut) return []
  const jours: string[] = []
  for (let jour = debut; jour <= fin && jours.length < JOURS_MAX_PAR_CHANTIER; jour = jourSuivant(jour)) jours.push(jour)
  return jours
}

/** La période dépasse JOURS_MAX_PAR_CHANTIER : joursEntre n'en rend que le début. */
export function periodeTronquee(debut: string | null | undefined, fin: string | null | undefined): boolean {
  const jours = joursEntre(debut, fin)
  return jours.length === JOURS_MAX_PAR_CHANTIER && (jours.at(-1) as string) < (fin as string)
}

/**
 * Identifiants non vides, en minuscules (la base rend les uuid en minuscules ; jsonb ne les normalise pas, à la
 * différence de uuid[]), sans doublon, dans l'ordre reçu.
 */
function identifiants(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return []
  return [...new Set(valeur.filter((id): id is string => typeof id === 'string' && id.length > 0).map(id => id.toLowerCase()))]
}

const parDate = (a: string, b: string) => a.localeCompare(b)

/**
 * Lecture tolérante de la colonne : un objet dont les clés sont des jours valides et les valeurs des listes
 * d'identifiants. Tout le reste (colonne absente, null, texte, clé mal formée, « __proto__ ») est ignoré : jamais
 * d'erreur à l'écran. Sert aussi de forme normalisée à l'écriture (/api/btp) : clés triées, identifiants en minuscules.
 */
export function lireEquipeParJour(valeur: unknown): EquipeParJour {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) return {}
  const lue: EquipeParJour = {}
  for (const [jour, membres] of Object.entries(valeur as Record<string, unknown>).sort(([a], [b]) => parDate(a, b))) {
    if (jourValide(jour) && Array.isArray(membres)) lue[jour] = identifiants(membres)
  }
  return lue
}

/**
 * Forme exacte attendue par /api/btp : un objet dont CHAQUE clé est un vrai jour et chaque valeur une liste d'au plus
 * MEMBRES_MAX_PAR_JOUR identifiants au format donné, au plus JOURS_MAX_PAR_CHANTIER jours. Contrôle fait sur l'objet
 * reçu lui-même : une clé « __proto__ », qu'un schéma zod de dictionnaire ignorerait sans la contrôler, est refusée.
 */
export function formeEquipeParJourValide(valeur: unknown, formatId: RegExp): boolean {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) return false
  const entrees = Object.entries(valeur as Record<string, unknown>)
  return entrees.length <= JOURS_MAX_PAR_CHANTIER && entrees.every(([jour, membres]) =>
    jourValide(jour) && Array.isArray(membres) && membres.length <= MEMBRES_MAX_PAR_JOUR
    && membres.every(id => typeof id === 'string' && formatId.test(id)))
}

/** Équipe habituelle d'un jour : celle de la fiche les jours travaillés, personne le week-end (ni un jour férié). */
export function equipeHabituelleDuJour(jour: string, membresIds: readonly string[], ouvre: JourOuvre = estJourOuvre): string[] {
  return ouvre(jour) ? identifiants(membresIds) : []
}

/** Le jour a une liste à lui (retouchée, ou figée par un changement de l'équipe habituelle). */
export function jourInscrit(equipeParJour: EquipeParJour, jour: string): boolean {
  return Object.prototype.hasOwnProperty.call(equipeParJour, jour)
}

/** Employés présents ce jour-là : la liste du jour s'il en a une, sinon l'équipe habituelle du jour. */
export function equipeDuJour(
  jour: string, membresIds: readonly string[], equipeParJour: EquipeParJour, ouvre: JourOuvre = estJourOuvre,
): string[] {
  return jourInscrit(equipeParJour, jour) ? identifiants(equipeParJour[jour]) : equipeHabituelleDuJour(jour, membresIds, ouvre)
}

function memeEnsemble(a: readonly string[], b: readonly string[]): boolean {
  const ea = new Set(identifiants(a))
  const eb = new Set(identifiants(b))
  return ea.size === eb.size && [...ea].every(id => eb.has(id))
}

/** Le jour a été retouché (sa liste diffère de l'équipe habituelle de ce jour). */
export function jourRetouche(
  jour: string, membresIds: readonly string[], equipeParJour: EquipeParJour, ouvre: JourOuvre = estJourOuvre,
): boolean {
  return jourInscrit(equipeParJour, jour) && !memeEnsemble(equipeParJour[jour], equipeHabituelleDuJour(jour, membresIds, ouvre))
}

/**
 * Ce qui s'enregistre, clés triées (deux enregistrements de la même équipe donnent le même objet). Un jour à venir
 * (à partir de `aujourdhui`) dont la liste est celle de l'équipe habituelle disparaît. Un jour PASSÉ garde sa liste
 * même si elle égale l'équipe habituelle du moment : c'est ce qui s'est passé ce jour-là, et l'équipe habituelle peut
 * encore changer (relecture adverse du 28/11/2026). Sans `aujourdhui`, tous les jours sont traités comme à venir.
 */
export function simplifierEquipeParJour(
  equipeParJour: EquipeParJour, membresIds: readonly string[], aujourdhui?: string, ouvre: JourOuvre = estJourOuvre,
): EquipeParJour {
  const simplifiee: EquipeParJour = {}
  for (const jour of Object.keys(equipeParJour).filter(jourValide).sort(parDate)) {
    const membres = identifiants(equipeParJour[jour])
    const passe = aujourdhui !== undefined && jour < aujourdhui
    if (passe || !memeEnsemble(membres, equipeHabituelleDuJour(jour, membresIds, ouvre))) simplifiee[jour] = membres
  }
  return simplifiee
}

/** Retouche d'un jour : la liste donnée devient l'équipe de ce jour (puis simplifiée). */
export function retoucherJour(
  equipeParJour: EquipeParJour, membresIds: readonly string[], jour: string, membres: readonly string[],
  aujourdhui?: string, ouvre: JourOuvre = estJourOuvre,
): EquipeParJour {
  return simplifierEquipeParJour({ ...equipeParJour, [jour]: identifiants(membres) }, membresIds, aujourdhui, ouvre)
}

/** Le jour reprend l'équipe habituelle. */
export function reprendreEquipeHabituelle(equipeParJour: EquipeParJour, jour: string): EquipeParJour {
  const reste = { ...equipeParJour }
  delete reste[jour]
  return reste
}

/**
 * L'équipe habituelle change (cases « Employés assignés », onglet Affectations du pointage) : les jours PASSÉS de
 * l'obra qui n'avaient pas de liste à eux gardent l'ancienne équipe habituelle, inscrite pour eux. Sinon changer
 * l'équipe réécrirait le passé : la main-d'œuvre déjà dépensée bougerait, et un renfort retiré plus tard disparaîtrait
 * des jours où il était là. Seuls les jours de `debut` à la veille d'`aujourdhui` sont figés ; aujourd'hui et la suite
 * prennent la nouvelle équipe.
 */
export function figerJoursPasses(p: {
  debut: string | null | undefined
  aujourdhui: string
  ancienneEquipe: readonly string[]
  nouvelleEquipe: readonly string[]
  equipeParJour: EquipeParJour
  ouvre?: JourOuvre
}): EquipeParJour {
  const ouvre = p.ouvre ?? estJourOuvre
  const resultat: EquipeParJour = { ...p.equipeParJour }
  if (!jourValide(p.aujourdhui) || memeEnsemble(p.ancienneEquipe, p.nouvelleEquipe)) return resultat
  for (const jour of joursEntre(p.debut, jourPrecedent(p.aujourdhui))) {
    if (jourInscrit(resultat, jour)) continue
    const avant = equipeHabituelleDuJour(jour, p.ancienneEquipe, ouvre)
    if (!memeEnsemble(avant, equipeHabituelleDuJour(jour, p.nouvelleEquipe, ouvre))) resultat[jour] = avant
  }
  return Object.fromEntries(Object.entries(resultat).sort(([a], [b]) => parDate(a, b)))
}

/** Tous les employés désignés par la colonne (pour vérifier qu'ils appartiennent au compte). */
export function membresDesignes(equipeParJour: EquipeParJour): string[] {
  return identifiants(Object.values(equipeParJour).flat())
}

/**
 * Le membre est inscrit à ce chantier pour ce jour précis (liste du jour). Sert au pointage : un renfort d'un jour
 * doit pouvoir pointer sur l'obra où il a été envoyé. L'inverse n'est pas vrai : un membre de l'équipe habituelle
 * retiré d'un jour garde le droit de pointer (le pointage enregistre ce qui s'est réellement passé).
 */
export function ajouteCeJour(membreId: string, jour: string, equipeParJour: unknown): boolean {
  if (!jourValide(jour)) return false
  return (lireEquipeParJour(equipeParJour)[jour] ?? []).includes(membreId.toLowerCase())
}
