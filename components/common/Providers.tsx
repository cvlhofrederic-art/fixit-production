'use client'

import { LanguageProvider } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/config'
import { useEffect, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { hydrateStorageFromServer, installStorageSync, pushAllLocalToServer } from '@/lib/storage-sync'
import { importLocalStorageDocsToSupabase } from '@/lib/document-sync'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

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

    // Pose le miroir localStorage IMMÉDIATEMENT et sans condition. Le patch est
    // idempotent et ne fait QUE mettre les écritures en file d'attente ; le flush
    // no-op tant qu'aucun token n'est disponible (cf. getToken dans storage-sync).
    // Le poser ici garantit qu'aucune écriture fixit_* n'est perdue, même si la
    // session est restaurée via cookies APRÈS le mount.
    // Régression base clients 2026-06-01 : l'install était gardée derrière un
    // getSession() d'un client @supabase/supabase-js ad hoc qui lisait le
    // localStorage (vide → session jamais vue) → patch jamais posé → aucune
    // sauvegarde cloud. On utilise désormais le client partagé (cookies SSR).
    installStorageSync()

    // La session vient de l'événement d'auth : plus aucun getSession() ici (chaque getSession prend le verrou
    // d'auth partagé entre onglets, lot 1 Sentry du 28/10/2026). Un seul bootstrap à la fois.
    let bootstrapEnCours = false

    async function bootstrap(session: Session | null) {
      if (cancelled || !session || bootstrapEnCours) return
      bootstrapEnCours = true
      try {
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

        // 3. Backfill devis/factures legacy : avant le fix sync server-side,
        //    chaque .catch(() => {}) avalait l'erreur silencieusement → 0
        //    inserts EVER en DB. Au premier login post-fix, on importe les
        //    documents accumules en localStorage vers Supabase via le nouvel
        //    endpoint /api/devis/sync. Idempotent : flag par artisan_id.
        try {
          const userId = session.user?.id
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
      finally { bootstrapEnCours = false }
    }

    // Bootstrap sur INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED. INITIAL_SESSION est émis à chaque abonné
    // après l'initialisation du client (session restaurée depuis les cookies) : il couvre aussi le cas « déjà
    // connecté en arrivant sur la page », qui déclenchait auparavant un second bootstrap immédiat (GET
    // /api/user-storage en double). SIGNED_IN couvre le passage par /auth/login (Providers ne se remount pas).
    // Callback synchrone, travail différé : jamais d'appel Supabase attendu dans un callback onAuthStateChange
    // (interblocage documenté par Supabase).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTimeout(() => { void bootstrap(session) }, 0)
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
