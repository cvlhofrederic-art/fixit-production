/**
 * Recherche d'un module dans la barre latérale du tableau de bord BTP pro (pro_societe).
 *
 * Logique pure, sans React : la barre latérale passe la liste de ce qu'elle affiche déjà (modules visibles,
 * dans l'ordre du menu) et reçoit les modules à garder ainsi que celui que la touche Entrée ouvre.
 * La recherche ne décide donc jamais de ce qu'un compte a le droit de voir : elle filtre l'existant.
 *
 * Trois passes, la première qui trouve quelque chose l'emporte (résultats précis d'abord) :
 *   1. le nom du module (« fact » → Factures) ;
 *   2. le nom de la rubrique (« finances » → les modules de la rubrique Finances) ;
 *   3. la description du module (« tva » → Comptabilité).
 * Sans tenir compte des accents, de la casse ni de la ponctuation ; plusieurs mots = tous présents.
 */

import { normalizeForSearch } from '@/lib/fuzzy-match'

export interface ModuleCherchable {
  /** Identifiant du module (clé de navigation). */
  id: string
  /** Nom affiché dans le menu. */
  libelle: string
  /** Nom de la rubrique affichée au-dessus du module. */
  rubrique: string
  /** Description courte du module ; n'est lue qu'en dernier recours. */
  description?: string
}

export interface ResultatRecherche {
  /** Vrai si la saisie contient au moins un caractère utile (lettre ou chiffre). */
  active: boolean
  /** Identifiants retenus, dans l'ordre du menu. */
  ids: string[]
  /** Module ouvert par la touche Entrée : la meilleure correspondance, ou null s'il n'y en a aucune. */
  meilleur: string | null
}

const AUCUNE_RECHERCHE: ResultatRecherche = { active: false, ids: [], meilleur: null }

/** Forme comparable d'un texte : minuscules, sans accents, ponctuation ramenée à des espaces. */
export function cleDeRecherche(texte: string): string {
  return normalizeForSearch(texte)
    .replaceAll('œ', 'oe')
    .replaceAll('æ', 'ae')
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim()
}

function contientTousLesMots(cle: string, mots: string[]): boolean {
  return mots.every(mot => cle.includes(mot))
}

/**
 * Qualité d'une correspondance sur le nom : 0 = nom exact, 1 = le nom commence par la saisie,
 * 2 = un mot du nom commence par le premier mot saisi, 3 = la saisie est ailleurs dans le nom.
 */
function rangSurLeNom(cleLibelle: string, cleRequete: string, premierMot: string): number {
  if (cleLibelle === cleRequete) return 0
  if (cleLibelle.startsWith(cleRequete)) return 1
  if (cleLibelle.split(' ').some(mot => mot.startsWith(premierMot))) return 2
  return 3
}

export function rechercherModules(requete: string, modules: readonly ModuleCherchable[]): ResultatRecherche {
  const cleRequete = cleDeRecherche(requete)
  if (!cleRequete) return AUCUNE_RECHERCHE
  const mots = cleRequete.split(' ')

  const fiches = modules.map(entree => {
    const libelle = cleDeRecherche(entree.libelle)
    const rubrique = cleDeRecherche(entree.rubrique)
    const description = cleDeRecherche(entree.description ?? '')
    return { id: entree.id, libelle, avecRubrique: `${libelle} ${rubrique}`, tout: `${libelle} ${rubrique} ${description}` }
  })

  // Passe 1 — le nom du module. La meilleure correspondance est celle de plus petit rang ; à rang égal,
  // la première dans l'ordre du menu.
  const parNom = fiches.filter(fiche => contientTousLesMots(fiche.libelle, mots))
  if (parNom.length > 0) {
    let meilleur = parNom[0]
    let meilleurRang = rangSurLeNom(meilleur.libelle, cleRequete, mots[0])
    for (const fiche of parNom.slice(1)) {
      const rang = rangSurLeNom(fiche.libelle, cleRequete, mots[0])
      if (rang < meilleurRang) { meilleur = fiche; meilleurRang = rang }
    }
    return { active: true, ids: parNom.map(fiche => fiche.id), meilleur: meilleur.id }
  }

  // Passe 2 — le nom de la rubrique ; passe 3 — la description. Entrée ouvre le premier du menu.
  const parRubrique = fiches.filter(fiche => contientTousLesMots(fiche.avecRubrique, mots))
  const retenus = parRubrique.length > 0 ? parRubrique : fiches.filter(fiche => contientTousLesMots(fiche.tout, mots))
  return { active: true, ids: retenus.map(fiche => fiche.id), meilleur: retenus[0]?.id ?? null }
}
