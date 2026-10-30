// GET /indexnow-key.txt — fichier de vérification IndexNow (Bing, Yandex, Naver, Seznam).
// La clé vit dans l'environnement (INDEXNOW_KEY : `wrangler secret put INDEXNOW_KEY`, jamais dans
// le dépôt — lot 1 Aikido, 28/10/2026) ; les moteurs la relisent à keyLocation =
// https://vitfix.io/indexnow-key.txt (lib/seo/indexnow.ts et les workflows post-deploy).
// Chemin en .txt : exclu du matcher du middleware, donc aucune redirection de langue.
// Clé absente → 404 : l'ancien fichier statique public/{clé}.txt n'existe plus, aucun ping ne
// peut être validé tant que le secret n'est pas posé (SEO best-effort, rien d'autre n'est cassé).

import { getSecret } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  // .trim() : même normalisation que lib/seo/indexnow.ts — le corps servi doit être identique au
  // champ key des pings (un saut de ligne final posé avec le secret ferait échouer la vérification).
  const key = (await getSecret('INDEXNOW_KEY')).trim()
  if (!key) return new Response('Not found', { status: 404 })
  return new Response(key, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  })
}
