/**
 * Photo de profil et logo d'un artisan (profiles_artisan.profile_photo_url / logo_url) dans Supabase Storage.
 *
 * Depuis mars 2026, /api/save-logo enregistrait l'image en data: URL base64 dans la colonne : environ
 * 370 Ko de texte relus par tout ce qui lit la fiche (la page publique d'un artisan pesait 3 Mo de HTML).
 * L'image part maintenant dans le bucket public « profile-photos », celui que /api/upload utilise pour ces
 * deux champs (même schéma de chemin : profiles/ pour la photo, logos/ pour le logo, puis
 * {horodatage}_{suffixe}.{extension}), et la colonne reçoit l'URL https publique.
 *
 * Utilisé par app/api/save-logo/route.ts et par la migration des lignes existantes
 * (lib/storage/migrer-images-artisan.ts, scripts/migrer-images-artisans-storage.ts) : aucun alias « @/ »
 * ni dépendance à Next, le script tourne sous tsx.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** Bucket public des photos de profil et logos (sondé le 23/10/2026 : il existe et il est public). */
export const BUCKET_IMAGES_ARTISAN = 'profile-photos'

export type ChampImageArtisan = 'profile_photo_url' | 'logo_url'

/** Dossier du bucket, le même que celui que useSettings.uploadDocument envoie à /api/upload. */
export const DOSSIER_IMAGE_ARTISAN: Record<ChampImageArtisan, string> = {
  profile_photo_url: 'profiles',
  logo_url: 'logos',
}

const EXTENSION_PAR_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const

export type TypeImageArtisan = keyof typeof EXTENSION_PAR_TYPE

export interface ImageArtisan {
  octets: Uint8Array
  /** Type réel, lu dans les premiers octets : le type annoncé par le navigateur n'est pas une preuve. */
  type: TypeImageArtisan
  extension: string
}

function typeReel(octets: Uint8Array): TypeImageArtisan | null {
  const commencePar = (...signature: number[]) => signature.every((octet, i) => octets[i] === octet)
  if (commencePar(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (commencePar(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (commencePar(0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  // WebP : « RIFF » puis « WEBP » aux octets 8 à 11
  if (octets.length >= 12 && commencePar(0x52, 0x49, 0x46, 0x46)
    && octets[8] === 0x57 && octets[9] === 0x45 && octets[10] === 0x42 && octets[11] === 0x50) {
    return 'image/webp'
  }
  return null
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

/**
 * Lit une data: URL d'image (« data:image/png;base64,… ») envoyée par le dashboard ou déjà enregistrée en base.
 * Renvoie null si ce n'est pas une data: URL base64 ou si le contenu n'est pas réellement un JPEG, PNG, WebP ou
 * GIF (un SVG, qui peut contenir du script, est donc refusé). Le type annoncé est ignoré : un navigateur donne
 * « application/octet-stream » pour une image sans extension, et une fausse annonce ne trompe pas ce contrôle.
 */
export function lireImageDataUrl(valeur: string): ImageArtisan | null {
  if (!valeur.startsWith('data:')) return null
  const virgule = valeur.indexOf(',')
  if (virgule < 0) return null
  // En-tête : type, paramètres facultatifs, « base64 » en dernier
  const entete = valeur.slice(5, virgule).split(';')
  if (entete[entete.length - 1].trim().toLowerCase() !== 'base64') return null

  const donnees = valeur.slice(virgule + 1)
  // Alphabet, longueur multiple de 4 et « = » seulement à la fin : atob ne peut plus lever d'erreur.
  if (donnees.length === 0 || donnees.length % 4 !== 0 || !BASE64.test(donnees)) return null
  const binaire = atob(donnees)
  const octets = new Uint8Array(binaire.length)
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i)

  const type = typeReel(octets)
  if (!type) return null
  return { octets, type, extension: EXTENSION_PAR_TYPE[type] }
}

/**
 * URL d'image publiable : seulement une URL https absolue (Storage public). Une data: URL, un blob:, du http ou
 * toute autre valeur donne null : og:image, twitter:image et le JSON-LD exigent une URL absolue, et une data: URL
 * de plusieurs centaines de Ko y portait la fiche artisan à 3 Mo de HTML (Sentry V et W). L'appelant met alors
 * l'image Open Graph par défaut du site.
 */
export function urlImagePublique(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null
  const texte = valeur.trim()
  if (!/^https:\/\//i.test(texte)) return null
  try {
    const url = new URL(texte)
    return url.protocol === 'https:' && url.hostname ? url.href : null
  } catch {
    return null
  }
}

export type ResultatEnvoiImage =
  | { ok: true; url: string; chemin: string }
  | { ok: false; etape: 'envoi' | 'lecture'; message: string }

type ClientStockage = Pick<SupabaseClient, 'storage'>

function suffixeAleatoire(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8)
}

/**
 * Vérifie que l'URL publique se lit vraiment. Un bucket privé accepte l'envoi mais son URL publique répond 400 :
 * l'image disparaîtrait de la fiche, des devis et des factures. Renvoie null si l'URL répond, sinon la raison.
 */
async function raisonUrlIllisible(url: string): Promise<string | null> {
  if (!url.startsWith('https://')) return `URL publique non https : ${url.slice(0, 80)}`
  try {
    const reponse = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    return reponse.ok ? null : `URL publique illisible (HTTP ${reponse.status})`
  } catch (e) {
    return `URL publique injoignable : ${e instanceof Error ? e.message : String(e)}`
  }
}

/** Supprime un objet du bucket. Renvoie null si c'est fait, sinon la raison de l'échec. */
export async function supprimerImageArtisan(client: ClientStockage, chemin: string): Promise<string | null> {
  try {
    const { error } = await client.storage.from(BUCKET_IMAGES_ARTISAN).remove([chemin])
    return error ? error.message : null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

/**
 * Envoie l'image dans le bucket et renvoie son URL https publique, vérifiée. En cas d'échec, rien ne reste dans
 * le bucket (sauf si la suppression échoue elle aussi, ce que le message indique) et l'appelant garde la
 * data: URL.
 */
export async function envoyerImageArtisan(
  client: ClientStockage,
  champ: ChampImageArtisan,
  image: ImageArtisan,
): Promise<ResultatEnvoiImage> {
  const fichiers = client.storage.from(BUCKET_IMAGES_ARTISAN)
  const chemin = `${DOSSIER_IMAGE_ARTISAN[champ]}/${Date.now()}_${suffixeAleatoire()}.${image.extension}`
  let cheminEnvoye: string
  try {
    const { data, error } = await fichiers.upload(chemin, image.octets, {
      contentType: image.type,
      upsert: false,
      // Chemin unique à chaque envoi : le fichier ne change jamais, il peut rester en cache.
      cacheControl: '31536000',
    })
    if (error || !data) return { ok: false, etape: 'envoi', message: error?.message ?? 'réponse vide du Storage' }
    cheminEnvoye = data.path
  } catch (e) {
    return { ok: false, etape: 'envoi', message: e instanceof Error ? e.message : String(e) }
  }

  const url = fichiers.getPublicUrl(cheminEnvoye).data.publicUrl
  const raison = await raisonUrlIllisible(url)
  if (raison) {
    const echecSuppression = await supprimerImageArtisan(client, cheminEnvoye)
    const message = echecSuppression
      ? `${raison} ; objet ${cheminEnvoye} non supprimé : ${echecSuppression}`
      : raison
    return { ok: false, etape: 'lecture', message }
  }
  return { ok: true, url, chemin: cheminEnvoye }
}
