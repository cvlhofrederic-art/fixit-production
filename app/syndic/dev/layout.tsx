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
 * Production access is blocked by `notFound()`. The route is never linked from
 * the public app — it lives under /syndic/dev for visual QA of the V5.4
 * design system (étape a tokens, étape b primitives, étape c shell, …).
 */
export default function SyndicV54DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
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
