'use client'

// ── Garde de l'espace « AJ Signalement » côté navigateur ─────────────────────
//
// Indispensable en plus du middleware : le build mobile (export statique) n'a pas de middleware, et la session peut se
// fermer pendant que la page est ouverte. Décision sur une session VALIDÉE par Supabase (getUser, via
// verifierSessionNavigateur), jamais sur la seule session locale, puis decisionAccesEspaceQr(app_metadata) :
// - « chargement » : rien n'est affiché ni chargé ;
// - « autorise » : l'espace peut charger ses données ;
// - « connexion » (aucune session, session refusée, ou compte sans accès) : renvoi vers la page de connexion
//   professionnelle de l'espace (/fr/aj-signalement/connexion/, ancre comprise), qui affiche le message neutre à un
//   compte sans accès ; aucune donnée ;
// - « indisponible » (réseau, verrou d'auth, serveur lent) : message et « Réessayer », sans redirection ni rechargement
//   (boucles du lot 1 Sentry du 28/10/2026).
// Une déconnexion (SIGNED_OUT, depuis un autre onglet compris) ramène à « connexion ». Les droits restent vérifiés par
// le serveur : les routes /api/aj-signalement/* exigent le super admin.

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { verifierSessionNavigateur, type VerificationSession } from '@/lib/auth/session-navigateur'
import { lienPanneauAdmin } from '@/lib/auth/panneau-admin'
import {
  TEXTES_ESPACE_QR, cheminConnexionEspaceQr, decisionAccesEspaceQr, type LangueEspaceQr, type RoleEspaceQr,
} from '@/lib/aj-signalement/acces-espace'

export type EtatAccesQr =
  | { statut: 'chargement' }
  | { statut: 'autorise'; role: RoleEspaceQr; lienAdmin: string | null }
  | { statut: 'connexion' }
  | { statut: 'indisponible' }

/**
 * État de l'espace d'après la vérification de la session (pur). Compte sans accès : « connexion », comme sans session
 * (une seule sortie ; la page de connexion de l'espace ne renvoie jamais un compte sans accès ailleurs : pas de boucle).
 */
export function etatAccesDepuisVerdict(verdict: VerificationSession): EtatAccesQr {
  if (verdict.statut === 'indisponible') return { statut: 'indisponible' }
  if (verdict.statut === 'refusee') return { statut: 'connexion' }
  const decision = decisionAccesEspaceQr(verdict.user)
  if (decision.acces !== 'autorise') return { statut: 'connexion' }
  return { statut: 'autorise', role: decision.role, lienAdmin: lienPanneauAdmin(verdict.user.app_metadata) }
}

/** Langue de l'espace d'après l'adresse affichée (/pt/aj-signalement/ ou, par défaut, /fr/). */
export const langueDeLaPage = (): LangueEspaceQr => (window.location.pathname.startsWith('/pt/') ? 'pt' : 'fr')

export interface AccesEspaceQr {
  etat: EtatAccesQr
  /** Page de connexion professionnelle de l'espace (lien de secours pendant la redirection). */
  connexion: string
  reessayer: () => void
  seDeconnecter: () => Promise<void>
}

export function useAccesEspaceQr(): AccesEspaceQr {
  const [etat, setEtat] = useState<EtatAccesQr>({ statut: 'chargement' })
  const [essai, setEssai] = useState(0)
  const [connexion] = useState(() => cheminConnexionEspaceQr(langueDeLaPage()))
  // Déconnexion demandée ici : la page de connexion est ouverte par seDeconnecter, pas par l'événement SIGNED_OUT.
  const sortieVolontaire = useRef(false)

  useEffect(() => {
    let actif = true
    void verifierSessionNavigateur(supabase.auth).then((verdict) => {
      if (actif) setEtat(etatAccesDepuisVerdict(verdict))
    })
    // Rappel synchrone, sans appel à Supabase (interblocage documenté par Supabase).
    const { data } = supabase.auth.onAuthStateChange((evenement) => {
      if (actif && evenement === 'SIGNED_OUT' && !sortieVolontaire.current) setEtat({ statut: 'connexion' })
    })
    return () => {
      actif = false
      data.subscription.unsubscribe()
    }
  }, [essai])

  // Sans session ou sans accès : page de connexion de l'espace (remplace l'entrée d'historique : « retour » ne ramène
  // pas sur la garde). L'ancre (#signalements du lien de l'e-mail) suit : la page de connexion la reprend à l'arrivée.
  useEffect(() => {
    if (etat.statut === 'connexion') window.location.replace(`${connexion}${window.location.hash}`)
  }, [etat.statut, connexion])

  const reessayer = useCallback(() => {
    setEtat({ statut: 'chargement' })
    setEssai((n) => n + 1)
  }, [])

  const seDeconnecter = useCallback(async () => {
    sortieVolontaire.current = true
    let erreur: unknown = null
    try {
      erreur = (await supabase.auth.signOut()).error
    } catch (e) {
      erreur = e
    }
    if (erreur) {
      sortieVolontaire.current = false
      console.warn('[aj-signalement] déconnexion impossible', erreur)
      toast.error(TEXTES_ESPACE_QR.deconnexionImpossible)
      return
    }
    // Page de connexion de l'espace (pas la page générale) ; remplace l'entrée d'historique : « retour » ne rouvre pas
    // l'espace d'une session fermée.
    window.location.replace(connexion)
  }, [connexion])

  return { etat, connexion, reessayer, seDeconnecter }
}
