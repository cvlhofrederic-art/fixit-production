// ── « Continuer avec Google » dans l'appli Vitfix Pro ───────────────────────
// Google refuse l'authentification dans une WebView intégrée (politique « Use secure browsers »,
// erreur 403 disallowed_useragent) : une appli doit ouvrir une fenêtre du navigateur du système —
// onglet personnalisé Chrome sur Android, SFSafariViewController sur iPhone — puis récupérer la main
// par un lien profond. Sans cela, la page Google partait dans le navigateur du téléphone et la session
// s'y créait, pendant que l'appli restait sur le formulaire (impasse constatée le 12/11/2026).
//
// Déroulé :
//   1. signInWithOAuth(skipBrowserRedirect) dans la WebView : renvoie l'URL d'autorisation et écrit le
//      vérificateur PKCE dans les cookies de vitfix.io, c'est-à-dire ceux de la WebView.
//   2. Browser.open() affiche Google dans la fenêtre du système.
//   3. Supabase renvoie vers io.vitfix.pro://auth/callback?code=… : Android (intent-filter) et iOS
//      (CFBundleURLTypes) rendent la main à l'appli, jamais au navigateur.
//   4. La WebView va sur /{langue}/auth/callback?code=…&app=1 : la route serveur échange le code contre
//      la session — le vérificateur est dans les cookies qu'elle envoie — et pose les cookies de session.
//
// Le schéma io.vitfix.pro:// est ouvert à toute autre application du téléphone, mais un code forgé ne
// vaut rien sans le vérificateur de CETTE WebView : l'échange échoue et l'utilisateur revient à la
// connexion. Rien de sensible ne transite par le lien profond. Une application qui déclarerait le même
// schéma pourrait intercepter le retour (RFC 8252 § 8.1) : gêne, pas vol de session ; la parade est un
// lien « https://vitfix.io/… » vérifié par assetlinks.json, à voir quand l'appli sera signée.
//
// Côté Supabase, l'URL de retour doit figurer dans les « Redirect URLs » du projet, sinon Supabase
// retombe sur la Site URL et l'appli ne reçoit jamais la main (voir MOBILE_GUIDE.md).

import { estAppMobile } from '@/lib/app-mobile'

/** Identifiant de l'appli, qui sert aussi de schéma de lien profond (capacitor.config.ts : appId). */
export const SCHEMA_APP_MOBILE = 'io.vitfix.pro'

/** URL de retour demandée à Supabase, à déclarer à l'identique dans les Redirect URLs du projet. */
export const RETOUR_GOOGLE_APP_MOBILE = `${SCHEMA_APP_MOBILE}://auth/callback`

interface AuthOAuth {
  signInWithOAuth(identifiants: {
    provider: 'google'
    options: { redirectTo: string; skipBrowserRedirect: boolean }
  }): Promise<{ data: { url: string | null }; error: { message: string } | null }>
}

interface PluginNavigateur {
  open(options: { url: string }): Promise<void>
  close(): Promise<void>
}

interface PluginApp {
  addListener(
    evenement: 'appUrlOpen',
    ecouteur: (donnees: { url: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

/**
 * Chemin du site où envoyer la WebView au retour de Google, ou null si ce lien profond ne nous concerne pas
 * (une autre application peut ouvrir l'appli avec ce schéma). Fonction pure : tout le reste est du câblage.
 *
 * La langue est ramenée à fr ou pt : l'espace mobile et cette route n'existent pas sous /en/, /nl/ ni /es/
 * (next.config.ts ne les réécrit pas vers app/(commun)), et le retour y tomberait sur une 404.
 */
export function cheminRetourGoogle(url: string, locale: string): string | null {
  let adresse: URL
  try {
    adresse = new URL(url)
  } catch {
    return null
  }
  if (adresse.protocol !== `${SCHEMA_APP_MOBILE}:`) return null
  // Comparaison sur l'adresse complète sans paramètres : « auth » est l'hôte du lien, « /callback » son chemin.
  if (`${adresse.host}${adresse.pathname}`.replace(/\/$/, '') !== 'auth/callback') return null

  const langue = locale === 'pt' ? 'pt' : 'fr'
  const code = adresse.searchParams.get('code')
  // Barre finale : le site est en trailingSlash, et un 308 de plus au retour de Google serait un aller-retour
  // réseau au moment le plus fragile du circuit.
  // Connexion refusée ou abandonnée : retour au formulaire, sans message inventé.
  if (!code) return `/${langue}/auth/login/`
  return `/${langue}/auth/callback/?code=${encodeURIComponent(code)}&app=1`
}

/**
 * Ouvre Google dans la fenêtre du navigateur du système. À n'appeler que dans l'appli (estAppMobile()).
 * Lève si Supabase ne rend pas d'adresse exploitable : l'appelant affiche son message d'erreur habituel.
 */
export async function ouvrirConnexionGoogleAppMobile(auth: AuthOAuth): Promise<void> {
  const { data, error } = await auth.signInWithOAuth({
    provider: 'google',
    // redirectTo : sans lui, Supabase renvoie vers la Site URL et la session se crée dans le navigateur
    // du téléphone, pas dans l'appli. skipBrowserRedirect : c'est nous qui ouvrons la fenêtre.
    options: { redirectTo: RETOUR_GOOGLE_APP_MOBILE, skipBrowserRedirect: true },
  })
  if (error || !data?.url) throw new Error(error?.message ?? 'URL d’autorisation Google absente')
  // Garde de version : aujourd'hui signInWithOAuth rend une adresse http(s) que la fenêtre suit jusqu'à
  // Google. Si une version future rendait autre chose (du JSON, par exemple), mieux vaut l'erreur
  // générique de la page de connexion qu'une fenêtre ouverte sur du charabia.
  if (!/^https?:\/\//.test(data.url)) throw new Error('adresse d’autorisation Google inattendue')

  const { Browser } = (await import('@capacitor/browser')) as unknown as { Browser: PluginNavigateur }
  await Browser.open({ url: data.url })
}

/**
 * Écoute le retour de Google et renvoie une fonction de désinstallation. Ne fait rien hors de l'appli.
 * `naviguer` reçoit un chemin du site : la route serveur termine la connexion et redirige selon le rôle.
 */
export async function installerRetourGoogleAppMobile(
  locale: string,
  naviguer: (chemin: string) => void,
): Promise<() => void> {
  if (!estAppMobile()) return () => {}

  // Les deux plugins sont chargés maintenant : au retour, le document est sur le point d'être quitté et
  // un import tardif pourrait ne jamais aboutir, laissant la fenêtre du navigateur ouverte par-dessus.
  const [{ App }, { Browser }] = (await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/browser'),
  ])) as unknown as [{ App: PluginApp }, { Browser: PluginNavigateur }]

  const abonnement = await App.addListener('appUrlOpen', ({ url }) => {
    const chemin = cheminRetourGoogle(url, locale)
    if (!chemin) return
    void (async () => {
      // Refermer d'abord : sans cela la fenêtre reste au-dessus de l'appli après la connexion.
      try {
        await Browser.close()
      } catch (erreur) {
        console.warn('[google-app-mobile] fermeture de la fenêtre impossible :', erreur)
      }
      naviguer(chemin)
    })()
  })

  return () => { void abonnement.remove() }
}
