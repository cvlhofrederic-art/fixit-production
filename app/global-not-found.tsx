import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import CoquilleRacine from '@/components/common/CoquilleRacine'
import PageIntrouvable from '@/components/common/PageIntrouvable'
import type { Locale } from '@/lib/i18n/config'
import { metadonneesRacine } from '@/lib/seo/metadonnees-racine'

// 404 de toute URL qui ne correspond à aucune route (experimental.globalNotFound, next.config.ts). Il y a plusieurs
// layouts racine (app/{pt,fr,en,nl,es}/layout.tsx, app/(commun)/layout.tsx) : pour la route /_not-found, Next rend ce
// fichier seul, sans aucun layout. Même rendu que l'ancien app/layout.tsx + app/not-found.tsx : coquille commune dans
// la langue de la requête (en-tête x-locale du middleware, puis cookie), texte et métadonnées selon le cookie, noindex.
// Seule /_not-found utilise ce fichier : ses cookies()/headers() ne rendent aucune autre route dynamique. Un notFound()
// levé par une page reste rendu par le not-found.tsx de son dossier (app/{pt,fr,en,nl,es}, app/(commun)).
// Ne jamais remplacer ceci par une route fourre-tout : une page qui lève notFound() ne rend côté serveur qu'une coquille
// <html id="__next_error__"> vide, le contenu n'apparaissant qu'après le JavaScript.

const ROBOTS_404: Metadata['robots'] = { index: false, follow: false, googleBot: { index: false, follow: false } }

// MOBILE_BUILD (export Capacitor) : ni cookies() ni headers(), repli sur fr, comme app/(commun)/layout.tsx.
const estBuildMobile = () => process.env.MOBILE_BUILD === 'true'

export async function generateMetadata(): Promise<Metadata> {
  const locale = (estBuildMobile() ? 'fr' : (await cookies()).get('locale')?.value || 'fr') as Locale
  return { ...metadonneesRacine(locale), robots: ROBOTS_404 }
}

export default async function GlobalNotFound() {
  let locale: Locale = 'fr'
  let localeTexte = 'fr'
  if (!estBuildMobile()) {
    const cookieStore = await cookies()
    const headerStore = await headers()
    localeTexte = cookieStore.get('locale')?.value || 'fr'
    locale = (headerStore.get('x-locale') || localeTexte) as Locale
  }

  return (
    <CoquilleRacine locale={locale}>
      <PageIntrouvable locale={localeTexte} />
    </CoquilleRacine>
  )
}
