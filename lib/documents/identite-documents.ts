// Deux identifiants, et il ne faut pas les confondre.
//
// Pour un artisan, pour le gérant d'une société BTP, pour un super_admin, l'objet `artisan` du tableau de bord EST
// sa ligne `profiles_artisan` : `id` désigne à la fois la fiche et le rangement de ses documents. Les deux notions
// se confondent, et tout le code les a écrites de la même façon depuis l'origine.
//
// Pour un salarié invité, elles se séparent :
//   - `artisan.id` reste SON compte. C'est ce qui fait les clés `fixit_documents_<id>` et `fixit_drafts_<id>` de son
//     navigateur. Les laisser à lui est une protection, pas un détail : si son écran écrivait la clé de la société,
//     un poste de bureau partagé ferait relire au gérant une liste tronquée par elle, et ses brouillons — qui
//     n'existent nulle part ailleurs qu'en local — seraient perdus.
//   - `artisan.fiche_societe_id` porte la fiche de SA société. C'est elle qu'il faut partout où le document tient
//     son identité de l'entreprise : gabarit propre à la société, relecture de la fiche au téléchargement du PDF,
//     propriétaire enregistré en base par /api/devis/sync.
//
// D'où ces deux fonctions, à employer au lieu de `artisan.id` dès qu'il s'agit de l'entreprise et non du cache.

import type { Artisan } from '@/lib/types'

/** Ce qu'un écran connaît de l'identité : l'objet complet, ou juste les deux identifiants. */
type PorteurIdentite = Pick<Artisan, 'id' | 'fiche_societe_id'> | null | undefined

/**
 * Fiche `profiles_artisan` qui porte l'identité légale des documents : celle de la société pour un salarié invité,
 * la sienne pour tous les autres. Jamais une chaîne vide : rend `undefined` si l'identité n'est pas encore chargée.
 */
export function idFicheDocuments(artisan: PorteurIdentite): string | undefined {
  if (!artisan) return undefined
  const fiche = artisan.fiche_societe_id
  if (typeof fiche === 'string' && fiche !== '') return fiche
  return typeof artisan.id === 'string' && artisan.id !== '' ? artisan.id : undefined
}

/**
 * Vrai quand l'identité affichée est celle d'une société dont ce compte n'est pas le titulaire : ses documents sont
 * ceux de l'entreprise, lus et écrits par le serveur, et son cache de navigateur reste à lui.
 */
export function estSousCompteSociete(artisan: PorteurIdentite): boolean {
  const fiche = artisan?.fiche_societe_id
  return typeof fiche === 'string' && fiche !== '' && fiche !== artisan?.id
}
