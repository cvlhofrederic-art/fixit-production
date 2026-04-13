'use client'

import React, { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  locale?: 'fr' | 'pt' | 'en'
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary pour les sections de dashboard.
 * Si une section crashe, seule cette section affiche une erreur,
 * le reste du dashboard continue de fonctionner.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SectionErrorBoundary] Crash capturé:', error.message, errorInfo.componentStack)
  }

  render() {
    if (this.state.hasError) {
      const locale = this.props.locale || 'fr'
      const defaultTitle = locale === 'en' ? 'Error in this section'
        : locale === 'pt' ? 'Erro nesta secção'
        : 'Erreur dans cette section'
      const message = locale === 'en' ? 'An unexpected error occurred. The rest of the application is working normally.'
        : locale === 'pt' ? 'Ocorreu um erro inesperado. O resto da aplicação funciona normalmente.'
        : 'Une erreur inattendue est survenue. Le reste de l\u0027application fonctionne normalement.'
      const retryLabel = locale === 'en' ? 'Retry' : locale === 'pt' ? 'Tentar novamente' : 'Réessayer'

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
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-4 p-3 bg-red-100 rounded text-left text-xs text-red-700 overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

export default SectionErrorBoundary
