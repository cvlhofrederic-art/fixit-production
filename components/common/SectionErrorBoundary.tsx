'use client'

import React, { Component, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'
import { isChunkLoadError, hasRecentReload, attemptChunkReload } from '@/lib/chunk-reload'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  locale?: 'fr' | 'pt' | 'en'
}

interface State {
  hasError: boolean
  error: Error | null
  // ChunkLoadError (bundle périmé après déploiement) → un rechargement va se
  // déclencher : on affiche un spinner neutre plutôt que la boîte d'erreur rouge.
  reloading: boolean
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, reloading: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Lecture pure (pas d'effet de bord ici) : on prévoit le reload pour choisir
    // le rendu. L'effet (window.location.reload) est déclenché dans componentDidCatch.
    const reloading = isChunkLoadError(error) && !hasRecentReload()
    return { hasError: true, error, reloading }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Bundle périmé après un déploiement Cloudflare : le chunk n'existe plus sur
    // l'edge (404). On recharge une fois (protégé contre les boucles) pour
    // récupérer le build courant — le « Réessayer » re-demanderait le chunk mort.
    if (attemptChunkReload(error)) return

    // Avant : `console.error` uniquement → aucun signal Sentry, diagnostic
    // aveugle quand la section crashe en prod. On capture maintenant la
    // stack trace + le componentStack + un tag section pour pouvoir filtrer
    // (cf. plan magical-mapping-karp Phase 1).
    const section = this.props.fallbackTitle || 'unknown-section'
    console.error('[SectionErrorBoundary] Crash capturé:', error.message, errorInfo.componentStack)
    Sentry.captureException(error, {
      tags: {
        feature: 'section-error-boundary',
        section,
        locale: this.props.locale || 'fr',
      },
      extra: {
        componentStack: errorInfo.componentStack,
      },
    })
  }

  render() {
    if (this.state.hasError) {
      // Rechargement imminent (chunk périmé) : spinner neutre, identique au
      // loader de section, le temps que window.location.reload prenne la main.
      if (this.state.reloading) {
        return (
          <div className="flex items-center justify-center py-12">
            <div
              className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }}
            />
          </div>
        )
      }
      const locale = this.props.locale || 'fr'
      const defaultTitle = locale === 'en' ? 'Error in this section'
        : locale === 'pt' ? 'Erro nesta secção'
        : 'Erreur dans cette section'
      const message = locale === 'en' ? 'An unexpected error occurred. The rest of the application is working normally.'
        : locale === 'pt' ? 'Ocorreu um erro inesperado. O resto da aplicação funciona normalmente.'
        : "Une erreur inattendue est survenue. Le reste de l'application fonctionne normalement."
      const retryLabel = locale === 'en' ? 'Retry' : locale === 'pt' ? 'Tentar novamente' : 'Réessayer'
      const detailLabel = locale === 'en' ? 'Technical detail' : locale === 'pt' ? 'Detalhe técnico' : 'Détail technique'

      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <h3 className="text-lg font-bold text-red-800 mb-2">
            {this.props.fallbackTitle || defaultTitle}
          </h3>
          <p className="text-sm text-red-600 mb-4">
            {message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
          >
            {retryLabel}
          </button>
          {this.state.error && (
            <details className="mt-4 text-left">
              <summary className="text-xs text-red-700 cursor-pointer select-none">{detailLabel}</summary>
              <pre className="mt-2 p-3 bg-red-100 rounded text-xs text-red-700 overflow-auto max-h-40 whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

export default SectionErrorBoundary
