'use client'

// ── Chargement de l'espace copropriétaire (navigateur) ────────────────────────
//
// Une machine d'états explicite, lisible par les écrans :
//   chargement → pret (données réelles ou démonstration) | non_authentifie | role_interdit |
//   non_active (vrai compte sans fiche activée : AUCUNE donnée de démonstration) | erreur.
// Règles :
//   - visiteur sans session → démonstration (bandeau permanent) ;
//   - super admin (démo) → sa fiche de démonstration (e-mail du profil local), sinon démonstration ;
//   - compte copropriétaire / locataire : jamais de démonstration ; 401 → reconnexion ; 403/404 → écran
//     « espace non activé » ; réseau / 5xx / 429 → écran d'erreur, ou données précédentes conservées
//     avec la mention « mise à jour impossible » lors d'un rafraîchissement.
// Les données réelles restent en mémoire : rien n'est écrit dans localStorage (poste partagé).

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PROFILE_DEMO } from '@/lib/copro-demo-data'
import { espaceDemo } from '@/lib/coproprietaire/demo'
import { chargerEspace, definirContexteApi, type CodeErreurApi } from '@/lib/coproprietaire/api'
import type { EspaceCopro } from '@/lib/coproprietaire/types'

export type CodeNonActive = 'acces_non_active' | 'fiche_introuvable' | 'email_non_confirme'

export type EtatEspace =
  | { statut: 'chargement' }
  | { statut: 'pret'; espace: EspaceCopro; jeton: string | null; miseAJourLe: Date; miseAJourImpossible: boolean }
  | { statut: 'non_authentifie' }
  | { statut: 'role_interdit' }
  | { statut: 'non_active'; code: CodeNonActive; email: string }
  | { statut: 'erreur'; code: 'reseau' | 'serveur' | 'trop_de_demandes' }

interface Compte {
  id: string
  email: string
  role: string
  superAdmin: boolean
}

/** Rôle et marque super admin, lus dans app_metadata (posé par le serveur, non forgeable côté client). */
function lireCompte(user: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null): Compte | null {
  if (!user) return null
  const meta = user.app_metadata || {}
  const role = typeof meta.role === 'string' ? meta.role : ''
  return { id: user.id, email: user.email || '', role, superAdmin: role === 'super_admin' || meta._original_role === 'super_admin' }
}

/** E-mail du profil de démonstration local (super admin), sinon celui de PROFILE_DEMO. */
function emailProfilLocal(uid: string): string {
  try {
    const brut = localStorage.getItem(`fixit_copro_profile_${uid}`)
    const profil = brut ? (JSON.parse(brut) as { email?: unknown }) : null
    return typeof profil?.email === 'string' && profil.email.includes('@') ? profil.email : PROFILE_DEMO.email
  } catch {
    return PROFILE_DEMO.email
  }
}

const CLE_LOT = 'fixit_copro_lot'

export interface EspaceCoproHook {
  etat: EtatEspace
  /** Recharge l'espace ; en cas d'échec, les données affichées restent avec la mention « mise à jour impossible ». */
  rafraichir: () => Promise<void>
  /** Affiche un autre lot du même compte. */
  changerLot: (id: string) => Promise<void>
  /** Jeton de session pour les actions (vote, message, documents), null en démonstration. */
  jeton: string | null
  /** app_metadata du compte connecté (lien « Panneau admin »), null sans session. */
  metadonnees: Record<string, unknown> | null
}

export function useEspaceCopro(): EspaceCoproHook {
  const [etat, setEtat] = useState<EtatEspace>({ statut: 'chargement' })
  const [metadonnees, setMetadonnees] = useState<Record<string, unknown> | null>(null)
  const [jetonCourant, setJetonCourant] = useState<string | null>(null)
  const compteRef = useRef<Compte | null>(null)
  const jetonRef = useRef<string | null>(null)
  const lotRef = useRef<string | null>(null)
  const espaceRef = useRef<EspaceCopro | null>(null)

  const charger = useCallback(async (mode: 'initial' | 'rafraichissement') => {
    let jeton: string | null = null
    let compte: Compte | null = null
    try {
      const { data } = await supabase.auth.getSession()
      jeton = data.session?.access_token ?? null
      compte = lireCompte(data.session?.user ?? null)
      setMetadonnees((data.session?.user?.app_metadata as Record<string, unknown> | undefined) ?? null)
    } catch (e) {
      console.warn('[copro] session illisible', e)
    }
    const compteConnu = compteRef.current
    jetonRef.current = jeton
    setJetonCourant(jeton)
    compteRef.current = compte

    if (!jeton || !compte) {
      // Session disparue depuis le chargement (déconnexion dans un autre onglet, jeton révoqué) :
      // jamais de démonstration à la place des vraies données.
      if (mode === 'rafraichissement' && compteConnu) {
        setEtat({ statut: 'non_authentifie' })
        return
      }
      // Visiteur : démonstration.
      definirContexteApi({})
      const espace = espaceDemo()
      espaceRef.current = espace
      setEtat({ statut: 'pret', espace, jeton: null, miseAJourLe: new Date(), miseAJourImpossible: false })
      return
    }

    const emailDemo = compte.superAdmin ? emailProfilLocal(compte.id) : null
    const resultat = await chargerEspace(jeton, { lot: lotRef.current, email: emailDemo })

    if (resultat.ok) {
      // Les actions (document, message, vote, assistant) visent la même fiche que l'espace chargé.
      definirContexteApi({ lot: resultat.espace.profil.id, email: emailDemo })
      espaceRef.current = resultat.espace
      setEtat({ statut: 'pret', espace: resultat.espace, jeton, miseAJourLe: new Date(), miseAJourImpossible: false })
      return
    }

    const code: CodeErreurApi = resultat.code
    // Super admin sans fiche dans son cabinet : démonstration, signalée comme telle.
    if (compte.superAdmin && (code === 'fiche_introuvable' || code === 'acces_non_active' || code === 'role_interdit')) {
      definirContexteApi({ email: emailDemo })
      const espace = { ...espaceDemo(), vueSuperAdmin: true }
      espaceRef.current = espace
      setEtat({ statut: 'pret', espace, jeton, miseAJourLe: new Date(), miseAJourImpossible: false })
      return
    }
    if (code === 'non_authentifie') { setEtat({ statut: 'non_authentifie' }); return }
    if (code === 'role_interdit') { setEtat({ statut: 'role_interdit' }); return }
    if (code === 'acces_non_active' || code === 'fiche_introuvable' || code === 'email_non_confirme') {
      setEtat({ statut: 'non_active', code, email: compte.email })
      return
    }
    // Réseau, serveur, limite de débit : garder ce qui était affiché, sinon écran d'erreur.
    const precedent = espaceRef.current
    if (mode === 'rafraichissement' && precedent) {
      setEtat(e => (e.statut === 'pret' ? { ...e, miseAJourImpossible: true } : { statut: 'pret', espace: precedent, jeton, miseAJourLe: new Date(), miseAJourImpossible: true }))
      return
    }
    setEtat({ statut: 'erreur', code: code === 'trop_de_demandes' ? 'trop_de_demandes' : code === 'reseau' ? 'reseau' : 'serveur' })
  }, [])

  useEffect(() => {
    try { lotRef.current = sessionStorage.getItem(CLE_LOT) } catch { lotRef.current = null }
    void charger('initial')
    // Jeton rafraîchi en arrière-plan par Supabase : les actions l'utilisent ; déconnexion → écran dédié.
    const { data: abonnement } = supabase.auth.onAuthStateChange((evenement, session) => {
      if (evenement === 'TOKEN_REFRESHED' && session?.access_token) {
        jetonRef.current = session.access_token
        setJetonCourant(session.access_token)
        setEtat(e => (e.statut === 'pret' && e.jeton ? { ...e, jeton: session.access_token } : e))
      } else if (evenement === 'SIGNED_OUT' && compteRef.current) {
        compteRef.current = null
        jetonRef.current = null
        setJetonCourant(null)
        setEtat({ statut: 'non_authentifie' })
      }
    })
    return () => abonnement.subscription.unsubscribe()
  }, [charger])

  const rafraichir = useCallback(async () => { await charger('rafraichissement') }, [charger])

  const changerLot = useCallback(async (id: string) => {
    lotRef.current = id
    try { sessionStorage.setItem(CLE_LOT, id) } catch (e) { console.warn('[copro] lot non mémorisé', e) }
    setEtat({ statut: 'chargement' })
    await charger('initial')
  }, [charger])

  return { etat, rafraichir, changerLot, jeton: jetonCourant, metadonnees }
}

/** Déconnexion puis retour à l'accueil du site. */
export async function seDeconnecter(): Promise<void> {
  try {
    await supabase.auth.signOut()
  } catch (e) {
    console.warn('[copro] déconnexion', e)
  }
  window.location.href = '/'
}
