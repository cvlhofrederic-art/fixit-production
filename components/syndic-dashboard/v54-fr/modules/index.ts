// Registre des modules FR — miroir du `BESPOKE` du mockup v8 (route id → composant).
// Rempli au lot Intégration, une fois les lots de modules A→G2 livrés. Tant qu'une
// route n'est pas enregistrée, la racine rend le Placeholder FR.

import type { ComponentType } from 'react'

export interface ModuleProps {
  /** Navigation interne du dashboard (remplace le hash-routing du mockup). */
  onNavigate?: (id: string) => void
}

export const MODULES_FR: Record<string, ComponentType<ModuleProps>> = {}
