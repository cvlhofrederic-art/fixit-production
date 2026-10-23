/**
 * Chemin d'objet Supabase Storage lu en base (storage_path, pdf_url…), vérifié avant tout appel
 * download / createSignedUrl / remove fait en service role.
 *
 * Le client Storage place le chemin tel quel dans l'URL de l'API (/object/{bucket}/{chemin}) : un
 * segment « .. » (ou « %2e%2e », que l'analyseur d'URL traite pareil) remonterait hors du bucket
 * visé, et « ? » ou « # » couperaient le chemin pour viser un autre objet. Les chemins écrits par
 * le serveur ({cabinet}/{uuid}.pdf…) passent tous.
 */
export function cheminStockageSur(chemin: unknown): chemin is string {
  if (typeof chemin !== 'string' || chemin.length === 0 || chemin.length > 1024) return false
  if (chemin.startsWith('/') || /[\\?#]/.test(chemin)) return false
  // Caractères de contrôle (dont retour à la ligne et NUL)
  if (/[\u0000-\u001f\u007f]/.test(chemin)) return false
  return chemin.split('/').every((segment) => segment !== '' && !/^(\.|%2e){1,2}$/i.test(segment))
}
