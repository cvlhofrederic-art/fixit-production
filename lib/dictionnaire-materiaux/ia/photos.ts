// Photos jointes à une description (mode « langage naturel » du dictionnaire) : limites communes au
// navigateur, qui prépare les photos, et à la route, qui les contrôle avant le modèle.
//
// Les photos ne sont jamais enregistrées : elles vont du navigateur au modèle, le temps de l'analyse.

/** Nombre de photos par message. */
export const PHOTOS_MAX = 4

/** Plus grand côté envoyé (pixels) : assez pour lire une fissure ou une tache, léger sur le réseau d'un chantier. */
export const COTE_MAX_PHOTO = 1568

export const QUALITE_JPEG_PHOTO = 0.82

/** Longueur maximale d'une data: URL de photo (caractères), soit environ 1,5 Mo d'image. */
export const TAILLE_MAX_PHOTO = 2_000_000

const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type TypePhoto = (typeof TYPES_ACCEPTES)[number]

export type VerificationPhoto = { ok: true; type: TypePhoto } | { ok: false; raison: 'format' | 'taille' }

/**
 * Une data: URL d'image JPEG, PNG ou WebP en base64, dans la limite de taille. L'en-tête doit être en minuscules,
 * comme le produit le navigateur : lib/claude ne reconnaît pas une autre écriture, et l'image partirait sans bruit.
 */
export function verifierPhoto(dataUrl: string): VerificationPhoto {
  if (dataUrl.length > TAILLE_MAX_PHOTO) return { ok: false, raison: 'taille' }
  const virgule = dataUrl.indexOf(',')
  if (virgule < 0) return { ok: false, raison: 'format' }
  const entete = dataUrl.slice(0, virgule)
  const type = TYPES_ACCEPTES.find((t) => entete === `data:${t};base64`)
  if (!type) return { ok: false, raison: 'format' }
  const donnees = dataUrl.slice(virgule + 1)
  if (donnees.length < 16 || !/^[A-Za-z0-9+/]+={0,2}$/.test(donnees)) return { ok: false, raison: 'format' }
  return { ok: true, type }
}
