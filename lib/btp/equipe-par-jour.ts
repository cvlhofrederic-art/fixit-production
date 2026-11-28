/**
 * Équipe d'une obra, jour par jour (demande de Frédéric du 28/11/2026 : « choisir les employés qui y sont, et pouvoir
 * modifier par JOUR si jamais d'autres y sont »).
 *
 * Deux niveaux, sans rien changer à ce qui existait :
 *   1. l'équipe habituelle du chantier, `membres_ids` (migration 20261116), cochée dans la fiche ; elle travaille les
 *      jours ouvrés, du lundi au vendredi ;
 *   2. `equipe_par_jour` (migration 20261128c) : pour un jour donné, la liste EXACTE des employés présents, qui remplace
 *      l'équipe habituelle ce jour-là. Un samedi travaillé, un jour férié chômé, un renfort d'un jour, un absent.
 * Seuls les jours qui diffèrent de l'équipe habituelle sont gardés (`simplifierEquipeParJour`) : changer l'équipe
 * habituelle change donc tous les jours qui n'ont pas été retouchés.
 *
 * Les jours sont des chaînes « AAAA-MM-JJ » (dates de calendrier, sans fuseau) et se calculent en UTC : un jour ne
 * glisse jamais d'une case selon l'heure ou le fuseau du navigateur.
 *
 * Module pur, partagé par l'écran (components/dashboard/ChantiersBTPV2.tsx), la route (/api/btp, contrôle des
 * employés désignés) et le pointage (lib/btp/pointage-regles.ts).
 */

/** Pour chaque jour retouché (« AAAA-MM-JJ »), les employés présents ce jour-là (identifiants de membres_btp). */
export type EquipeParJour = Record<string, string[]>

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/
const JOUR_MS = 86_400_000

/**
 * Nombre maximal de jours parcourus pour une obra (un peu plus de trois ans). Une date de fin saisie par erreur
 * (2099…) ne doit ni geler l'écran ni produire une liste de 27 000 lignes.
 */
export const JOURS_MAX_PAR_CHANTIER = 1100

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

/** Jour ouvré : du lundi au vendredi. Le samedi et le dimanche n'ont personne, sauf s'ils sont retouchés. */
export function estJourOuvre(jour: string): boolean {
  const jourSemaine = versDate(jour).getUTCDay()
  return jourSemaine !== 0 && jourSemaine !== 6
}

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

/** Identifiants non vides, sans doublon, dans l'ordre reçu. */
function identifiants(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return []
  return [...new Set(valeur.filter((id): id is string => typeof id === 'string' && id.length > 0))]
}

/**
 * Lecture tolérante de la colonne : un objet dont les clés sont des jours valides et les valeurs des listes
 * d'identifiants. Tout le reste (colonne absente, null, texte, clé mal formée) est ignoré : jamais d'erreur à l'écran.
 */
export function lireEquipeParJour(valeur: unknown): EquipeParJour {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) return {}
  const lue: EquipeParJour = {}
  for (const [jour, membres] of Object.entries(valeur as Record<string, unknown>)) {
    if (jourValide(jour) && Array.isArray(membres)) lue[jour] = identifiants(membres)
  }
  return lue
}

/** Équipe habituelle d'un jour : celle de la fiche les jours ouvrés, personne le week-end. */
export function equipeHabituelleDuJour(jour: string, membresIds: readonly string[]): string[] {
  return estJourOuvre(jour) ? identifiants(membresIds) : []
}

/** Employés présents ce jour-là : la liste retouchée s'il y en a une, sinon l'équipe habituelle du jour. */
export function equipeDuJour(jour: string, membresIds: readonly string[], equipeParJour: EquipeParJour): string[] {
  return Object.prototype.hasOwnProperty.call(equipeParJour, jour)
    ? identifiants(equipeParJour[jour])
    : equipeHabituelleDuJour(jour, membresIds)
}

/** Le jour a été retouché (sa liste diffère de l'équipe habituelle de ce jour). */
export function jourRetouche(jour: string, membresIds: readonly string[], equipeParJour: EquipeParJour): boolean {
  if (!Object.prototype.hasOwnProperty.call(equipeParJour, jour)) return false
  return !memeEnsemble(equipeParJour[jour], equipeHabituelleDuJour(jour, membresIds))
}

function memeEnsemble(a: readonly string[], b: readonly string[]): boolean {
  const ea = new Set(identifiants(a))
  const eb = new Set(identifiants(b))
  return ea.size === eb.size && [...ea].every(id => eb.has(id))
}

/**
 * Ce qui s'enregistre : seulement les jours valides dont la liste diffère de l'équipe habituelle, triés par date
 * (deux enregistrements de la même équipe donnent le même objet, donc aucune modification fantôme).
 */
export function simplifierEquipeParJour(equipeParJour: EquipeParJour, membresIds: readonly string[]): EquipeParJour {
  const simplifiee: EquipeParJour = {}
  for (const jour of Object.keys(equipeParJour).filter(jourValide).sort()) {
    const membres = identifiants(equipeParJour[jour])
    if (!memeEnsemble(membres, equipeHabituelleDuJour(jour, membresIds))) simplifiee[jour] = membres
  }
  return simplifiee
}

/** Retouche d'un jour : la liste donnée devient l'équipe de ce jour (puis simplifiée). */
export function retoucherJour(
  equipeParJour: EquipeParJour, membresIds: readonly string[], jour: string, membres: readonly string[],
): EquipeParJour {
  return simplifierEquipeParJour({ ...equipeParJour, [jour]: identifiants(membres) }, membresIds)
}

/** Le jour reprend l'équipe habituelle. */
export function reprendreEquipeHabituelle(equipeParJour: EquipeParJour, jour: string): EquipeParJour {
  const reste = { ...equipeParJour }
  delete reste[jour]
  return reste
}

/** Tous les employés désignés par la colonne (pour vérifier qu'ils appartiennent au compte). */
export function membresDesignes(equipeParJour: EquipeParJour): string[] {
  return identifiants(Object.values(equipeParJour).flat())
}

/**
 * Le membre est ajouté à ce chantier pour ce jour précis (retouche du jour). Sert au pointage : un renfort d'un jour
 * doit pouvoir pointer sur l'obra où il a été envoyé. L'inverse n'est pas vrai : un membre de l'équipe habituelle
 * retiré d'un jour garde le droit de pointer (le pointage enregistre ce qui s'est réellement passé).
 */
export function ajouteCeJour(membreId: string, jour: string, equipeParJour: unknown): boolean {
  if (!jourValide(jour)) return false
  const lue = lireEquipeParJour(equipeParJour)
  return (lue[jour] ?? []).includes(membreId)
}
