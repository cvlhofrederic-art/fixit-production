'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/** Chemin du panneau d'administration (sélecteur de tableaux de bord du super_admin). */
export const PANNEAU_ADMIN = '/admin/dashboard'
/** Sortie du mode « vue en tant que » : rend le rôle super_admin puis ouvre le panneau. */
export const SORTIE_IMPERSONATION = '/admin/exit'

/**
 * Lien « Panneau admin » affiché dans les tableaux de bord pendant une démonstration du super_admin.
 *
 * Lecture de `app_metadata` UNIQUEMENT (écrit côté serveur, non modifiable depuis le navigateur),
 * jamais de `user_metadata` : c'est cette faille qui avait fait retirer l'ancien bouton « Retour admin ».
 * Le lien n'ouvre aucun droit : /admin/exit (POST /api/admin/impersonate) et /admin/dashboard
 * revérifient le rôle côté serveur.
 * - session « vue en tant que » ouverte par un super_admin (`_original_role`) → /admin/exit ;
 * - super_admin → /admin/dashboard ;
 * - tout autre compte (ou pas de session) → null : aucun lien.
 */
export function lienPanneauAdmin(appMetadata: Record<string, unknown> | null | undefined): string | null {
  if (!appMetadata) return null
  if (appMetadata.role === 'super_admin') return PANNEAU_ADMIN
  if (appMetadata._original_role === 'super_admin') return SORTIE_IMPERSONATION
  return null
}

/** Session Supabase du navigateur, tenue à jour (connexion, déconnexion, rafraîchissement du jeton). */
export function useSessionNavigateur(): Session | null {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    let actif = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (actif) setSession(data.session)
      })
      .catch((erreur: unknown) => {
        // Lecture impossible (stockage bloqué…) : le tableau de bord reste utilisable, sans lien admin.
        console.warn('[panneau-admin] session illisible', erreur)
      })
    const { data: abonnement } = supabase.auth.onAuthStateChange((_evenement, nouvelle) => {
      if (actif) setSession(nouvelle)
    })
    return () => {
      actif = false
      abonnement.subscription.unsubscribe()
    }
  }, [])

  return session
}

/** Lien « Panneau admin » de la session courante (null : lien masqué). */
export function useLienPanneauAdmin(): string | null {
  const session = useSessionNavigateur()
  return lienPanneauAdmin(session?.user?.app_metadata)
}
