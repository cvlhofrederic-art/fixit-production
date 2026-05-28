import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import '@/components/syndic-dashboard/v54/tokens/tokens.css'
import '@/components/syndic-dashboard/v54/tokens/fonts.css'
import { v54FontVariables } from '@/components/syndic-dashboard/v54/tokens/fonts'

/**
 * Dev-only sandbox for the syndic v54 namespace.
 *
 * Wraps every child page in `<div id="syndic-dashboard-v54">` so that the
 * scoped CSS variables (--v54-*) defined in tokens.css become active and the
 * next/font/local bindings (--font-manrope, --font-cormorant,
 * --font-jetbrains-mono) resolve.
 *
 * Gating : bloqué (`notFound()`) UNIQUEMENT sur le domaine de production
 * (vitfix.io et ses sous-domaines). Rendu partout ailleurs — localhost,
 * preview deployments Cloudflare (*.workers.dev), et CI E2E (qui tourne
 * `npm run start` en build prod sur 127.0.0.1).
 *
 * Pourquoi hostname et pas NODE_ENV : la CI E2E build en production
 * (NODE_ENV=production) mais sert sur 127.0.0.1 — un gate NODE_ENV
 * renverrait 404 et rendrait la sandbox non-testable. Le gate hostname
 * fail closed sur le vrai domaine public (objectif sécurité/propreté) tout
 * en restant joignable pour le QA visuel et les tests automatisés.
 */
const PRODUCTION_HOSTS = ['vitfix.io', 'www.vitfix.io']

export default async function SyndicV54DevLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const host = (headersList.get('host') || '').toLowerCase().split(':')[0]
  const isProductionDomain = PRODUCTION_HOSTS.includes(host) || host.endsWith('.vitfix.io')

  if (isProductionDomain) {
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
