'use client'

import { LanguageProvider } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/config'
import { useEffect, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { hydrateStorageFromServer, installStorageSync, pushAllLocalToServer } from '@/lib/storage-sync'
import { importLocalStorageDocsToSupabase } from '@/lib/document-sync'
import { createClient } from '@supabase/supabase-js'

interface ProvidersProps {
  children: ReactNode
  locale: Locale
}

// Mirror localStorage <-> table user_storage pour rendre les donnees
// applicatives portables entre appareils, navigateurs et apres nettoyage
// du site. Tourne au mount ET a chaque SIGNED_IN (necessaire car Providers
// est mount avant l'authentification quand l'utilisateur passe par
// /auth/login — sans ce hook on aurait jamais bootstrap apres le login).
// Idempotent grace au flag interne `installed` de installStorageSync.
function useStorageSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function bootstrap() {
      if (cancelled) return
      try {
        const { data } = await supabase.auth.getSession()
        if (cancelled || !data.session) return

        // 1. Hydrate le localStorage depuis la DB (avant d'installer le
        //    patch sinon cycle de re-mirroir des ecritures d'hydratation).
        const hydrated = await hydrateStorageFromServer()

        // 2. Migration one-shot : si la DB est vide mais le localStorage
        //    a des entrees (1re connexion apres deploy), on push tout. On
        //    ne pose le flag QUE si le push a effectivement reussi (count > 0)
        //    sinon retry au prochain mount/login.
        if (hydrated.count === 0) {
          const flagKey = 'fixit_user_storage_migrated_v1'
          try {
            if (!localStorage.getItem(flagKey)) {
              const pushed = await pushAllLocalToServer()
              if (pushed.count > 0) {
                localStorage.setItem(flagKey, new Date().toISOString())
              }
            }
          } catch { /* retry au prochain bootstrap */ }
        }

        // 3. Installe le miroir (idempotent — pas de double install).
        installStorageSync()

        // 4. Backfill devis/factures legacy : avant le fix sync server-side,
        //    chaque .catch(() => {}) avalait l'erreur silencieusement → 0
        //    inserts EVER en DB. Au premier login post-fix, on importe les
        //    documents accumules en localStorage vers Supabase via le nouvel
        //    endpoint /api/devis/sync. Idempotent : flag par artisan_id.
        try {
          const userId = data.session.user?.id
          if (userId) {
            const flagKey = `fixit_devis_synced_v1_${userId}`
            if (!localStorage.getItem(flagKey)) {
              // L'artisanId est stocke en localStorage par le dashboard apres
              // resolution du profil. Si pas encore present, on retentera au
              // prochain bootstrap (pas de flag pose).
              const artisanId = localStorage.getItem(`fixit_artisan_id_${userId}`) || userId
              const count = await importLocalStorageDocsToSupabase(artisanId)
              if (count >= 0) {
                localStorage.setItem(flagKey, new Date().toISOString())
              }
            }
          }
        } catch { /* tolerant : retry au prochain bootstrap */ }
      } catch { /* tolerant : le localStorage reste fonctionnel */ }
    }

    // Bootstrap immediat (cas : deja connecte en arrivant sur la page).
    bootstrap()

    // Bootstrap a chaque SIGNED_IN / TOKEN_REFRESHED (cas : utilisateur
    // arrive sur /auth/login puis se connecte ; Providers ne se remount
    // pas, le useEffect [] ne se re-trigger pas).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        bootstrap()
      }
    })

    return () => {
      cancelled = true
      sub?.subscription?.unsubscribe?.()
    }
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
