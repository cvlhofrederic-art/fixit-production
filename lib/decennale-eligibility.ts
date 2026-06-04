// ============================================================
// VITFIX — ÉLIGIBILITÉ AUX GARANTIES LÉGALES 1792 (BTP)
// ============================================================
//
// Les garanties de parfait achèvement (art. 1792-6 C. civ., 1 an),
// biennale de bon fonctionnement (art. 1792-3 C. civ., 2 ans) et
// décennale (art. 1792 C. civ., 10 ans) sont attachées à la
// notion d'« ouvrage » au sens de l'art. 1792 — c'est-à-dire un
// ouvrage de construction (gros œuvre, structure, étanchéité,
// installations indissociablement liées à l'immeuble).
//
// Elles ne s'appliquent pas aux prestations d'entretien courant
// (élagage, jardinage, nettoyage, débouchage curatif…) qui
// relèvent de la responsabilité contractuelle de droit commun
// (art. 1231-1 C. civ.).
//
// Référence : Cass. 3e civ., 4 nov. 2010, n° 09-68.949 (élagage =
// entretien, hors champ 1792). Source taxonomique : wallet par
// corps de métier (lib/walletConformite.ts).
//
// Source de vérité : la liste DECENNALE_NEVER_METIERS ci-dessous
// — toute évolution de la nomenclature doit la refléter.

import { categoryToWalletKey } from './walletConformite'

export type DecennaleEligibility = 'always' | 'conditional' | 'never'

// Métiers pour lesquels la décennale est OBLIGATOIRE — les
// garanties 1792 s'appliquent par défaut sur le devis.
const DECENNALE_ALWAYS_METIERS: ReadonlySet<string> = new Set([
  'plomberie',
  'electricite',
  'serrurerie',
  'chauffage',
  'climatisation',
  'peinture',
  'maconnerie',
  'menuiserie',
  'toiture',
  'carrelage',
  'renovation',
  'amenagement_exterieur',
  'vitrerie',
  'ferronnerie',
  'plaquiste',
  'piscine',
  'store_banne',
])

// Métiers pour lesquels la décennale est CONDITIONNELLE — selon
// la nature des travaux (ex : élagage seul ≠ pose de structures).
const DECENNALE_CONDITIONAL_METIERS: ReadonlySet<string> = new Set([
  'espaces_verts',
  'petits_travaux',
  'debouchage',
  'ramonage',
])

// Métiers hors champ 1792 — prestations de service / entretien.
const DECENNALE_NEVER_METIERS: ReadonlySet<string> = new Set([
  'nettoyage',
  'traitement_nuisibles',
  'demenagement',
  'diagnostic',
])

// Convertit un libellé / slug métier en clé wallet puis renvoie
// l'éligibilité aux garanties 1792.
//
// Si le métier n'est pas reconnu → `'always'` par défaut (sûreté
// juridique : on ne sous-mentionne pas). L'artisan peut affiner
// son corps de métier dans son profil pour bénéficier d'une
// mention adaptée à son activité réelle.
export function getDecennaleEligibility(
  metier: string | string[] | null | undefined,
): DecennaleEligibility {
  if (!metier) return 'always'

  const candidates = Array.isArray(metier) ? metier : [metier]
  const keys = candidates
    .map(c => categoryToWalletKey(c))
    .filter((k): k is string => !!k)

  if (keys.length === 0) return 'always'

  // Règle d'agrégation : on prend le plus exigeant des métiers de
  // l'artisan. Si un seul d'entre eux relève du 1792, on garde
  // 'always' — sinon 'conditional', sinon 'never'.
  if (keys.some(k => DECENNALE_ALWAYS_METIERS.has(k))) return 'always'
  if (keys.some(k => DECENNALE_CONDITIONAL_METIERS.has(k))) return 'conditional'
  if (keys.every(k => DECENNALE_NEVER_METIERS.has(k))) return 'never'

  return 'always'
}
