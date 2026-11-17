// Fiche chantier BTP (components/dashboard/ChantiersBTPV2.tsx) : ce que l'enregistrement d'une fiche modifiée envoie,
// et ce que devient la position GPS du chantier quand on corrige son adresse (demande de Frédéric du 17/11/2026).
//
// Avant : la fiche renvoyait tout son formulaire, lu à son ouverture. Une fiche ouverte au bureau, puis enregistrée
// après que le gérant eut placé le chantier sur place (« Placer à ma position actuelle », onglet Affectations du
// pointage) ou changé son rayon ou ses employés, remettait les anciennes valeurs ; et corriger l'adresse effaçait
// tout de suite la position, même posée sur place.
// Maintenant : seuls les champs modifiés depuis l'ouverture partent. La position enregistrée du chantier reste pendant
// qu'on corrige l'adresse, et l'enregistrement demande s'il faut la garder. Une position calculée pendant la saisie
// (bouton GPS, devis importé) suit toujours l'adresse : elle part dès que l'adresse change.
// Tests : tests/lib/btp-fiche-chantier.test.ts et tests/components/btp-fiche-chantier-gps.test.tsx.

import { coordonneesValides } from '@/lib/btp/pointage-geo'

export interface PositionFiche {
  latitude?: number | null
  longitude?: number | null
}

export interface AdresseFiche {
  adresse?: string | null
  codePostal?: string | null
  ville?: string | null
}

/** Deux valeurs de champ égales : absent et null se valent ; listes comparées sans tenir compte de l'ordre. */
function memeValeur(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const trier = (v: unknown) => (Array.isArray(v) ? v.map(String).sort((x, y) => x.localeCompare(y)) : [])
    return JSON.stringify(trier(a)) === JSON.stringify(trier(b))
  }
  return (a ?? null) === (b ?? null)
}

/** Champs modifiés depuis l'ouverture de la fiche : seuls ceux-là partent à l'enregistrement. */
export function champsModifies<T extends object>(ouverte: T, actuelle: T): Partial<T> {
  const modifies: Partial<T> = {}
  for (const cle of Object.keys(actuelle) as Array<keyof T>) {
    if (!memeValeur(ouverte[cle], actuelle[cle])) modifies[cle] = actuelle[cle]
  }
  return modifies
}

const normaliser = (valeur: string | null | undefined) => (valeur ?? '').trim().replaceAll(/\s+/g, ' ').toLowerCase()

/** L'adresse (rue, code postal, ville) a changé depuis l'ouverture, espaces et majuscules mis à part. */
export function adresseModifiee(ouverte: AdresseFiche, actuelle: AdresseFiche): boolean {
  return normaliser(ouverte.adresse) !== normaliser(actuelle.adresse)
    || normaliser(ouverte.codePostal) !== normaliser(actuelle.codePostal)
    || normaliser(ouverte.ville) !== normaliser(actuelle.ville)
}

/** Même position, ou toutes deux absentes. */
export function memePosition(a: PositionFiche, b: PositionFiche): boolean {
  return (a.latitude ?? null) === (b.latitude ?? null) && (a.longitude ?? null) === (b.longitude ?? null)
}

/**
 * La fiche porte encore la position enregistrée du chantier : valable à l'ouverture et inchangée depuis. Sans fiche
 * ouverte (nouveau chantier), jamais.
 */
export function porteLaPositionEnregistree(ouverte: PositionFiche | null, actuelle: PositionFiche): boolean {
  return ouverte !== null && coordonneesValides(ouverte.latitude, ouverte.longitude) && memePosition(ouverte, actuelle)
}

/** À l'enregistrement : l'adresse a changé alors que la fiche porte encore la position enregistrée. */
export function questionPositionNecessaire(
  ouverte: (AdresseFiche & PositionFiche) | null,
  actuelle: AdresseFiche & PositionFiche,
): boolean {
  return ouverte !== null && porteLaPositionEnregistree(ouverte, actuelle) && adresseModifiee(ouverte, actuelle)
}

/** Question posée à l'enregistrement d'une fiche dont l'adresse a changé (OK : garder la position). */
export function questionGarderPosition(titre: string, isPt: boolean): string {
  if (isPt) {
    return `A morada da obra « ${titre} » mudou.\n\n`
      + 'Manter a posição GPS atual? Pode ter sido colocada na obra para a marcação automática.\n\n'
      + 'OK: manter a posição (morada corrigida).\n'
      + 'Cancelar: retirar a posição (a obra mudou de sítio); volte a calculá-la com o botão GPS ou com « Colocar na minha posição atual ».'
  }
  return `L’adresse du chantier « ${titre} » a changé.\n\n`
    + 'Garder sa position GPS actuelle ? Elle a peut-être été placée sur le chantier pour le pointage automatique.\n\n'
    + 'OK : garder la position (adresse corrigée).\n'
    + 'Annuler : retirer la position (le chantier a changé d’endroit) ; recalculez-la ensuite avec le bouton GPS ou « Placer à ma position actuelle ».'
}
