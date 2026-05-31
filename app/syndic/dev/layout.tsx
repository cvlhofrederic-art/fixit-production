import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import '@/components/syndic-dashboard/v54/tokens/tokens.css'
import '@/components/syndic-dashboard/v54/tokens/fonts.css'
import '@/components/syndic-dashboard/v54/modules/canal.css'
import { v54FontVariables } from '@/components/syndic-dashboard/v54/tokens/fonts'

/**
 * Dev-only sandbox for the syndic v54 namespace.
 *
 * Wraps every child page in `<div id="syndic-dashboard-v54">` so that the
 * scoped CSS variables (--v54-*) defined in tokens.css become active and the
 * next/font/local bindings (--font-manrope, --font-cormorant,
 * --font-jetbrains-mono) resolve.
 *
 * GATING — allowlist fail-closed.
 * On ne REND la sandbox QUE sur des hôtes de développement explicites :
 * localhost, 127.0.0.1, 0.0.0.0 et *.localhost. Tout le reste renvoie 404 :
 *   - production custom domain (vitfix.io, *.vitfix.io)
 *   - production worker brut (vitfix.<account>.workers.dev — workers_dev=true
 *     par défaut dans wrangler.toml, donc potentiellement joignable)
 *   - preview deployments Cloudflare (*.workers.dev)
 *
 * Pourquoi allowlist et pas blocklist : on ne connaît pas avec certitude le
 * hostname .workers.dev exact du worker prod. Un blocklist sur vitfix.io
 * seul laisserait une porte ouverte si la prod est aussi servie en
 * .workers.dev. L'allowlist fail-closed élimine ce risque : worst case, la
 * sandbox ne s'affiche pas là où on voudrait — jamais l'inverse (exposée en
 * prod). La CI E2E sert sur 127.0.0.1 et reste donc couverte.
 *
 * Note : le gate est UNIQUEMENT sur cette route /syndic/dev/*. Les vraies
 * pages dashboard (app/syndic/dashboard/...) n'ont PAS ce gate — elles sont
 * la prod légitime.
 */
const DEV_SANDBOX_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

// Empêche toute indexation même si une URL preview/dev fuite (ceinture en
// plus du 404 prod). Le X-Robots-Tag HTTP est posé en complément via
// next.config headers() pour /syndic/dev/:path*.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export default async function SyndicV54DevLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const host = (headersList.get('host') || '').toLowerCase().split(':')[0]
  const isLocalDevHost = DEV_SANDBOX_HOSTS.has(host) || host.endsWith('.localhost')

  if (!isLocalDevHost) {
    notFound()
  }

  return (
    <div
      id="syndic-dashboard-v54"
      className={v54FontVariables}
      style={{
        minHeight: '100vh',
        background: 'var(--v54-paper)',
        color: 'var(--v54-ink)',
        fontFamily: 'var(--v54-font-sans)',
        padding: '32px',
      }}
    >
      {children}
    </div>
  )
}
