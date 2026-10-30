import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import CoquilleRacine from "@/components/common/CoquilleRacine";
import type { Locale } from "@/lib/i18n/config";
import { metadonneesRacine } from "@/lib/seo/metadonnees-racine";

// Layout racine des pages communes à toutes les langues (auth, pro, client, syndic, admin, contact, …), servies par
// réécriture depuis /fr/… et /pt/… (next.config.ts) : la langue n'est pas dans le chemin vu par Next, elle arrive par
// l'en-tête x-locale posé par middleware.ts, d'où cookies()/headers() et un rendu dynamique à chaque requête.
// Les pages publiques par langue ont chacune leur layout racine statique (app/{pt,fr,en,nl,es}/layout.tsx) : plus
// aucune API dynamique dans leur chaîne de layouts, les pages SEO sont pré-rendues au build. La coquille HTML
// (<head>, JSON-LD, entité unique #business, <body>) est la même partout : components/common/CoquilleRacine.tsx.
// Les URL sans route ne passent pas par ce layout : app/global-not-found.tsx les rend seul (experimental.globalNotFound).

export async function generateMetadata(): Promise<Metadata> {
  // MOBILE_BUILD : en mode export statique Capacitor, cookies() / headers() ne
  // sont pas disponibles (pas de runtime Node). Fallback à 'fr' — l'app mobile
  // pré-release sert d'abord le marché FR ; la locale peut être switchée
  // dynamiquement côté client après hydratation.
  const isMobileBuild = process.env.MOBILE_BUILD === 'true'
  const locale = (isMobileBuild
    ? 'fr'
    : (await cookies()).get('locale')?.value || 'fr') as Locale

  return metadonneesRacine(locale)
}

export default async function LayoutCommun({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read locale: x-locale header (set by middleware from URL path) takes priority
  // over cookie, which may be stale when middleware updates it in the response.
  // En mode MOBILE_BUILD (export Capacitor), cookies()/headers() ne sont pas
  // disponibles — fallback 'fr' qui peut être surchargé côté client.
  const isMobileBuild = process.env.MOBILE_BUILD === 'true'
  let locale: Locale = 'fr'
  if (!isMobileBuild) {
    const cookieStore = await cookies()
    const headerStore = await headers()
    locale = (headerStore.get('x-locale') || cookieStore.get('locale')?.value || 'fr') as Locale
  }

  return <CoquilleRacine locale={locale}>{children}</CoquilleRacine>;
}
