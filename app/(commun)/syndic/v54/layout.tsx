import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { SYNDIC_V54_CLASSIQUE_FR_LIVE, SYNDIC_V54_LIVE } from '@/lib/syndic/v54-flag'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n/context'
import { v54LocaleDepuisPrefixe, type V54Locale } from '@/lib/syndic/v54/i18n/locale'
import { v54FontVariables } from '@/components/syndic-dashboard/v54/tokens/fonts'
import '@/components/syndic-dashboard/v54/tokens/tokens.css'
import '@/components/syndic-dashboard/v54/tokens/fonts.css'
import '@/components/syndic-dashboard/v54/modules/canal.css'
import '@/components/syndic-dashboard/v54/modules/planeamento.css'
import '@/components/syndic-dashboard/v54/modules/reservaesp.css'

/**
 * Route LIVE (production) du dashboard syndic v54 — /syndic/v54.
 *
 * Contrairement à /syndic/dev/* (gated localhost → 404 en prod), cette route est
 * servie en production, contrôlée par le feature flag SYNDIC_V54_LIVE :
 *   - true  → rend le dashboard v54 (design system, données mock).
 *   - false → notFound() → rollback (la route disparaît de la prod).
 *
 * L'ancien dashboard /syndic/dashboard (vraies données, agents IA réels) n'est PAS
 * touché : cette route vit à côté. Wrap dans #syndic-dashboard-v54 pour activer
 * les variables --v54-* et les fonts next/font, comme la sandbox dev.
 *
 * noindex : on n'indexe pas une preview en données mock.
 *
 * Langue : /pt/syndic/v54 et /fr/syndic/v54 mènent ici (réécritures de
 * next.config.ts). Le préfixe d'URL arrive dans l'en-tête x-locale posé par le
 * middleware : « fr » donne la version française si SYNDIC_V54_CLASSIQUE_FR_LIVE,
 * tout le reste garde le portugais, inchangé.
 */
const ROBOTS: Metadata['robots'] = { index: false, follow: false, nocache: true }

async function localeDeLaRequete(): Promise<V54Locale> {
  return v54LocaleDepuisPrefixe((await headers()).get('x-locale'), SYNDIC_V54_CLASSIQUE_FR_LIVE)
}

export async function generateMetadata(): Promise<Metadata> {
  if ((await localeDeLaRequete()) === 'fr-FR') {
    return { robots: ROBOTS, title: 'Vitfix Pro — Gestion de copropriété' }
  }
  return { robots: ROBOTS }
}

export default async function SyndicV54LiveLayout({ children }: { children: React.ReactNode }) {
  if (!SYNDIC_V54_LIVE) {
    notFound()
  }
  const locale = await localeDeLaRequete()
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
      <V54LocaleProvider locale={locale}>{children}</V54LocaleProvider>
    </div>
  )
}
