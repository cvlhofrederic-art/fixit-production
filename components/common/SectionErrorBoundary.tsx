'use client'

import React, { Component, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  locale?: 'fr' | 'pt' | 'en'
}

interface State {
  hasError: boolean
  error: Error | null
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
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
