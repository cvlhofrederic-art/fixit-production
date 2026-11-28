import type { Metadata } from 'next'
import CoquilleRacine from '@/components/common/CoquilleRacine'
import { metadonneesRacine } from '@/lib/seo/metadonnees-racine'

// Layout racine des pages /es/ (pages investisseurs, chacune avec ses propres métadonnées) : locale fixée par le
// dossier, sans cookies() ni headers(), coquille commune (components/common/CoquilleRacine.tsx), métadonnées de
// l'ancien layout racine (lib/seo/metadonnees-racine.ts).
export const metadata: Metadata = metadonneesRacine('es')

export default function EsLayout({ children }: { children: React.ReactNode }) {
  return <CoquilleRacine locale="es">{children}</CoquilleRacine>
}
