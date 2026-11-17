// ── Dictionnaire matériaux : formes des données ──────────────────────────────
//
// Le dictionnaire répond à une question d'artisan : « dans telle situation, quels matériaux
// utiliser ? ». Deux entrées : les SITUATIONS (« infiltração em fachada ») et le CATALOGUE des
// matériaux, rangé par familles et sous-familles (silicones, espátulas…).
//
// Règle de contenu : uniquement des types de produits faciles à trouver dans le pays, vendus par
// les enseignes de bricolage du dictionnaire (Portugal : Leroy Merlin et Maxmat). Un matériau est
// un TYPE générique, jamais une marque ni une référence ; aucun prix, aucune quantité.
//
// Un dictionnaire par pays, sans mélange : mêmes principes que `lib/estimation-materiaux`.

export type Pays = 'PT' | 'FR'

export type IdEnseigne = 'leroy-merlin' | 'maxmat'

export interface Enseigne {
  id: IdEnseigne
  nom: string
  /** Adresse de la recherche du magasin pour un terme générique (lien « voir en magasin »). */
  lienRecherche: (terme: string) => string
}

export interface SousFamille {
  id: string
  nom: string
  description: string
}

export interface FamilleMateriaux {
  id: string
  nom: string
  description: string
  icone: string
  sousFamilles: SousFamille[]
}

export interface Materiau {
  id: string
  /** Id de la famille. */
  famille: string
  /** Id d'une sous-famille de cette famille. */
  sousFamille: string
  nom: string
  /** Autres noms qu'un artisan taperait (synonymes, noms d'usage), affichés sur la fiche. */
  aussiAppele: string[]
  /** Noms de marque devenus noms d'usage (« sikaflex », « cola UHU ») : cherchés, jamais affichés. */
  aussiCherche?: string[]
  /** À quoi il sert et où on l'emploie. */
  usage: string
  /** La limite ou la précaution qui évite l'erreur classique. */
  aSavoir?: string
  /** Conditionnement courant en magasin. */
  conditionnement?: string
  /** Terme générique passé à la recherche des magasins. */
  recherche: string
  /** Terme propre à une enseigne, quand le terme général n'y ramène aucun produit (une enseigne nomme autrement). */
  rechercheEnseigne?: Partial<Record<IdEnseigne, string>>
  /** Enseignes où ce type de produit a été trouvé (preuves datées dans `donnees/<pays>/preuves.json`). */
  enseignes: IdEnseigne[]
}

export interface MateriauDeSituation {
  /** Id d'un matériau du catalogue du même pays. */
  id: string
  /** Pourquoi ou comment, dans cette situation. */
  note?: string
  /** Utile seulement dans certains cas : la note dit lesquels. */
  optionnel?: boolean
}

export interface EtapeSituation {
  titre: string
  materiaux: MateriauDeSituation[]
}

export interface DomaineSituations {
  id: string
  nom: string
  icone: string
}

export interface Situation {
  id: string
  /** Id du domaine. */
  domaine: string
  titre: string
  /** Formulations et mots qu'un artisan taperait pour cette situation. */
  motsCles: string[]
  description: string
  /** Ce qu'il faut constater sur place avant d'acheter. */
  aVerifier: string[]
  /** Les matériaux, dans l'ordre du travail. */
  etapes: EtapeSituation[]
  /** Limites, risques, cas où il faut un spécialiste. */
  attention: string[]
}

export interface Dictionnaire {
  pays: Pays
  langue: 'pt' | 'fr'
  /** Date (AAAA-MM-JJ) de la vérification des matériaux sur les sites des enseignes. */
  verifieLe: string
  enseignes: Enseigne[]
  familles: FamilleMateriaux[]
  materiaux: Materiau[]
  domaines: DomaineSituations[]
  situations: Situation[]
}
