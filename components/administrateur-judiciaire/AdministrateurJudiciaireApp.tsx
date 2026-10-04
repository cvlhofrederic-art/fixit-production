'use client'

import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { Shell } from '@/components/administrateur-judiciaire/shell/Shell'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'

/**
 * Racine de la succursale Administrateur Judiciaire (chargée côté client uniquement par ChargeurApplication).
 * Comme la maquette : la base locale est initialisée (démonstration si nécessaire), puis l'application est rendue,
 * même si l'initialisation échoue (simple avertissement en console).
 */

/** Démarrage mémorisé au niveau du module : un seul lancement, même avec le double effet du StrictMode. */
let demarrage: Promise<void> | null = null

/** Initialise la base locale une seule fois ; la promesse est toujours tenue (l'échec est seulement signalé). */
export function demarrerApplication(): Promise<void> {
  if (!demarrage)
    demarrage = initialiserBaseDemo().catch((erreur: unknown) => {
      console.warn('VitFix · base locale indisponible :', erreur)
    })
  return demarrage
}

interface ErrorBoundaryState {
  erreur: Error | null
}

/**
 * Garde d'erreur de rendu (absente de la maquette) : transparente tant qu'aucune erreur ne survient (aucun nœud DOM
 * ajouté) ; sinon, un message remplace l'application, là où la maquette laissait une page vide.
 */
class ErrorBoundary extends Component<{ children?: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { erreur: null }

  static getDerivedStateFromError(erreur: Error): ErrorBoundaryState {
    return { erreur }
  }

  componentDidCatch(erreur: Error, info: ErrorInfo): void {
    console.error("VitFix · erreur d'affichage :", erreur, info.componentStack)
  }

  render() {
    if (this.state.erreur)
      return (
        <div className="alert warn" role="alert">
          <Icon name="alert" />
          <div>
            <b>Une erreur est survenue</b>
            <p>L&apos;application n&apos;a pas pu s&apos;afficher. Rechargez la page pour reprendre.</p>
          </div>
        </div>
      )
    return this.props.children
  }
}

export default function AdministrateurJudiciaireApp() {
  // Rien n'est rendu avant la fin de l'initialisation (le #root de la maquette restait vide jusque-là).
  const [prete, setPrete] = useState(false)

  useEffect(() => {
    let monte = true
    void demarrerApplication().finally(() => {
      if (monte) setPrete(true)
    })
    return () => {
      monte = false
    }
  }, [])

  if (!prete) return null
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </ErrorBoundary>
  )
}
