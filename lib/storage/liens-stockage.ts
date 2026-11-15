import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { originesSupabase } from '@/lib/security/safe-url'
import { StoragePathError, assertStoragePath } from '@/lib/security/storage-path'

// Liens vers les fichiers des seaux Supabase Storage (serveur uniquement : client service role).
//
// La base garde le CHEMIN du fichier dans le seau ; le lien signé se crée au moment de la lecture, pour qui a le
// droit de voir (le titulaire, l'administration). Un lien signé enregistré cesse de s'ouvrir à la fin de sa durée
// et, tant qu'il est valable, ouvre le fichier à quiconque lit la ligne.
//
// Les valeurs déjà enregistrées ne sont jamais réécrites : cheminStockage retrouve le chemin dans une ancienne
// valeur (lien signé valable ou expiré, lien signé dont le jeton a été retiré, lien public) pour la signer de
// nouveau à la demande.

export const SEAU_DOCUMENTS = 'artisan-documents'

/** Durée des liens que l'application affiche, joint à un devis ou envoie : celle des liens signés d'avant. */
export const DUREE_LIEN_7_JOURS_S = 60 * 60 * 24 * 7

// Formes des URL du stockage Supabase : {projet}/storage/v1/{forme}/{seau}/{chemin}[?token=…]
const FORMES_URL = [
  'object/sign',
  'object/public',
  'object/authenticated',
  'render/image/sign',
  'render/image/public',
  'render/image/authenticated',
]
const RACINE_API_STOCKAGE = '/storage/v1/'

/**
 * Chemin d'un fichier du seau `seau` retrouvé dans une valeur enregistrée : chemin nu (valeurs écrites depuis ce
 * correctif), ou URL du stockage du projet (NEXT_PUBLIC_SUPABASE_URL) pointant dans ce seau, avec ou sans jeton.
 * Null pour toute autre valeur (vide, autre site, autre seau). Le chemin rendu n'est pas encore contrôlé :
 * signerValeurs le passe à assertStoragePath avant toute signature.
 */
export function cheminStockage(valeur: unknown, seau: string): string | null {
  if (typeof valeur !== 'string') return null
  const brute = valeur.trim()
  if (!brute) return null
  if (!/^[a-z][a-z0-9+.-]*:/i.test(brute)) return brute // chemin nu : pas de schéma
  let url: URL
  try {
    url = new URL(brute)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !originesSupabase().includes(url.origin)) return null
  const debutApi = url.pathname.indexOf(RACINE_API_STOCKAGE)
  if (debutApi === -1) return null
  const suite = url.pathname.slice(debutApi + RACINE_API_STOCKAGE.length)
  for (const forme of FORMES_URL) {
    const prefixe = `${forme}/${seau}/`
    if (!suite.startsWith(prefixe)) continue
    try {
      return decodeURIComponent(suite.slice(prefixe.length)) || null
    } catch {
      return null
    }
  }
  return null
}

export type OptionsSignature = {
  /** Dossiers où le chemin doit se trouver (titulaire), ou 'tout-le-seau' pour l'administration. */
  dossiers: ReadonlyArray<string | null | undefined> | 'tout-le-seau'
  dureeS: number
  /** Préfixe des traces (« [admin/kyc] »…). */
  origine: string
}

/**
 * Liens signés frais pour des valeurs enregistrées, dans l'ordre reçu. Null pour une valeur dont le chemin est
 * introuvable, hors des dossiers autorisés, ou dont la signature a échoué (échec journalisé, sans le chemin).
 * Une seule requête au stockage pour toutes les valeurs.
 */
export async function signerValeurs(
  seau: string,
  valeurs: ReadonlyArray<unknown>,
  options: OptionsSignature,
): Promise<Array<string | null>> {
  const chemins = valeurs.map((valeur) => {
    const chemin = cheminStockage(valeur, seau)
    if (!chemin) return null
    try {
      return options.dossiers === 'tout-le-seau'
        ? assertStoragePath(chemin)
        : assertStoragePath(chemin, options.dossiers)
    } catch (erreur) {
      if (!(erreur instanceof StoragePathError)) throw erreur
      logger.warn(`${options.origine} chemin de stockage refusé`, { raison: erreur.message })
      return null
    }
  })
  const aSigner = [...new Set(chemins.filter((c): c is string => c !== null))]
  if (aSigner.length === 0) return chemins.map(() => null)

  const { data, error } = await supabaseAdmin.storage.from(seau).createSignedUrls(aSigner, options.dureeS)
  if (error || !data) {
    logger.warn(`${options.origine} signature des liens en échec`, { message: error?.message })
    return chemins.map(() => null)
  }
  const liens = new Map<string, string>()
  for (const ligne of data) {
    if (ligne.path && ligne.signedUrl && !ligne.error) liens.set(ligne.path, ligne.signedUrl)
  }
  const manquants = aSigner.filter((c) => !liens.has(c)).length
  if (manquants > 0) logger.warn(`${options.origine} liens non signés`, { nombre: manquants })
  return chemins.map((c) => (c ? liens.get(c) ?? null : null))
}
