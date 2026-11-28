'use client'

// ── CRM du secrétariat : bouton « Installer l'application » ─────────────────
// Visible seulement quand Chrome ou Edge proposent l'installation (components/crm/installation.ts) : ni dans
// l'application déjà installée, ni dans un navigateur qui ne sait pas installer.

import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { MonitorDown } from 'lucide-react'
import type { TextesCrm } from '@/lib/crm/libelles'
import { abonnerInstallation, installationPossible, lancerInstallation } from './installation'
import { CLASSE_BOUTON_SECONDAIRE } from './elements'

export function BoutonInstaller({ textes, classe = CLASSE_BOUTON_SECONDAIRE }: Readonly<{ textes: TextesCrm; classe?: string }>) {
  const possible = useSyncExternalStore(abonnerInstallation, installationPossible, () => false)
  if (!possible) return null

  async function installer() {
    try {
      const issue = await lancerInstallation()
      if (issue === 'acceptee') toast.success(textes.installation.reussie)
    } catch (e: unknown) {
      toast.error(textes.installation.impossible)
      console.warn('[crm] installation de l’application', e)
    }
  }

  return (
    <button type="button" onClick={() => void installer()} className={classe} title={textes.installation.aide}>
      <MonitorDown className="h-4 w-4" aria-hidden="true" />
      {textes.installation.bouton}
    </button>
  )
}
