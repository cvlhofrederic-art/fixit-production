'use client'

import { LanguageProvider } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/config'
import { useEffect, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { hydrateStorageFromServer, installStorageSync, pushAllLocalToServer } from '@/lib/storage-sync'
import { createClient } from '@supabase/supabase-js'

interface ProvidersProps {
  children: ReactNode
  locale: Locale
}

// Mirror localStorage <-> table user_storage pour rendre les donnees
// applicatives portables entre appareils, navigateurs et apres nettoyage
// du site. Tourne une seule fois par session, sur le 1er rendu apres
// authentification. Idempotent et tolerant aux erreurs reseau.
function useStorageSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    ;(async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data } = await supabase.auth.getSession()
        if (cancelled || !data.session) return

        // 1. Hydrate le localStorage depuis la DB (avant d'installer le patch
        //    pour ne pas re-mirroir les ecritures d'hydratation).
        const hydrated = await hydrateStorageFromServer()

        // 2. Migration one-shot : si la DB etait vide pour ce user mais qu'il
        //    a deja des donnees en localStorage (ex: 1ere connexion apres
        //    deploy), on push tout vers la DB pour bootstraper la sync.
        if (hydrated.count === 0) {
          try {
            const flagKey = 'fixit_user_storage_migrated_v1'
            if (!localStorage.getItem(flagKey)) {
              await pushAllLocalToServer()
              localStorage.setItem(flagKey, new Date().toISOString())
            }
          } catch { /* ignore */ }
        }

        // 3. Installe le miroir sur les ecritures futures.
        installStorageSync()
      } catch { /* tolerant aux erreurs : le localStorage reste fonctionnel */ }
    })()

    return () => { cancelled = true }
  }, [])
}

function StorageSyncBoot() {
  useStorageSync()
  return null
}

export default function Providers({ children, locale }: ProvidersProps) {
  return (
    <LanguageProvider initialLocale={locale}>
      <StorageSyncBoot />
      {children}
      <Toaster position="top-right" richColors closeButton duration={5000} />
    </LanguageProvider>
  )
}
