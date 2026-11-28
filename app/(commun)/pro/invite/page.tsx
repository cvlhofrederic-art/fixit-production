'use client'

// Acceptation d'une invitation d'équipe pro (lien reçu par e-mail), comme dans les grands logiciels (28/11/2026) :
// - adresse sans compte Vitfix : l'invité choisit son mot de passe ;
// - adresse qui a déjà un compte : il tape le mot de passe de CE compte (vérifié par le serveur avant tout rattachement ;
//   une invitation ne change jamais le mot de passe d'un compte), avec « Mot de passe oublié ? » ;
// - adresse d'un autre espace (artisan, client, autre société) : rien n'est demandé, la page explique quoi faire.
// Une fois l'invitation acceptée, la session renvoyée par le serveur est posée et l'invité entre directement dans son
// espace. La page parle la langue de la société qui invite (textes.ts).
//
// Avant ce parcours, la page demandait toujours de « créer » un mot de passe ; pour un compte existant, il n'était pas
// enregistré et l'invité ne pouvait plus se connecter avec ce qu'il venait de taper (27/11/2026).

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { destinationApresConnexion } from '@/lib/auth/destination-par-role'
import { estAppMobile } from '@/lib/app-mobile'
import { ROLE_LABELS, type ProTeamRole } from '@/lib/permissions'
import { defautsMotDePasseNeuf } from '@/lib/equipe/mot-de-passe-invitation'
import { TEXTES, type LangueInvitation, type MotifRefus, type ErreurFormulaire } from './textes'

type EtatCompte = 'aucun' | 'existant' | 'autre_espace' | 'inconnu'

interface Invitation {
  email: string
  full_name: string
  role: string
  company_name: string
  etat_compte: EtatCompte
}

interface SessionRecue {
  access_token: string
  refresh_token: string
}

type Etape = 'chargement' | 'formulaire' | 'autre_espace' | 'refus' | 'ouverture' | 'succes'

const MOTIFS_REFUS: readonly MotifRefus[] = ['invalide', 'deja_utilisee', 'desactivee', 'expiree']
const ERREURS_SERVEUR: readonly ErreurFormulaire[] = ['mot_de_passe_incorrect', 'recharger', 'non_validee', 'erreur']
const ETATS_COMPTE: readonly EtatCompte[] = ['aucun', 'existant', 'autre_espace', 'inconnu']

function langueDeLAdresse(): LangueInvitation {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/pt') ? 'pt' : 'fr'
}

function motifRefus(code: unknown): MotifRefus {
  return MOTIFS_REFUS.includes(code as MotifRefus) ? (code as MotifRefus) : 'invalide'
}

function libelleRole(role: string, langue: LangueInvitation): string {
  return ROLE_LABELS[role as ProTeamRole]?.[langue] ?? role
}

/**
 * Compte existant rattaché sans session ouverte par le serveur, alors qu'une session est déjà ouverte dans ce
 * navigateur : son jeton porte encore l'ancien app_metadata. Le middleware, qui relit le compte, l'enverrait au tableau
 * de bord pro, et le tableau de bord, qui lit la session locale, le renverrait à la connexion. On la renouvelle.
 */
async function renouvelerSessionOuverte(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return
    const { error } = await supabase.auth.refreshSession()
    if (error) console.warn('[pro/invite] session non renouvelée :', error.message)
  } catch (err) {
    console.warn('[pro/invite] session non renouvelée :', err instanceof Error ? err.message : err)
  }
}

/** Pose la session renvoyée par le serveur et rend la page où entrer ; null si la session n'a pas pu être posée. */
async function poserSession(session: SessionRecue, langue: LangueInvitation): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.setSession(session)
    if (error || !data.user) {
      console.warn('[pro/invite] session non posée :', error?.message)
      return null
    }
    const meta = data.user.app_metadata ?? {}
    return destinationApresConnexion(meta.role, langue, { appMobile: estAppMobile(), proTeamRole: meta.pro_team_role })
  } catch (err) {
    console.warn('[pro/invite] session non posée :', err instanceof Error ? err.message : err)
    return null
  }
}

function InvitePageContent() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') || ''

  const [langue, setLangue] = useState<LangueInvitation>(langueDeLAdresse)
  const [etape, setEtape] = useState<Etape>('chargement')
  const [refus, setRefus] = useState<MotifRefus>('invalide')
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [erreurs, setErreurs] = useState<string[]>([])
  const [envoi, setEnvoi] = useState(false)
  // Compte existant rattaché (réponse du serveur), pour le texte de l'écran de fin quand la session n'a pas été ouverte.
  const [rattache, setRattache] = useState(false)
  const t = TEXTES[langue]

  useEffect(() => {
    if (!token) {
      setRefus('invalide')
      setEtape('refus')
      return
    }

    const lireInvitation = async () => {
      try {
        const res = await fetch(`/api/pro/invite?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (data.langue === 'pt' || data.langue === 'fr') setLangue(data.langue)

        if (res.ok && data.valid) {
          const etat: EtatCompte = ETATS_COMPTE.includes(data.etat_compte) ? data.etat_compte : 'inconnu'
          setInvitation({ ...data, etat_compte: etat })
          setEtape(etat === 'autre_espace' ? 'autre_espace' : 'formulaire')
        } else {
          setRefus(motifRefus(data.code))
          setEtape('refus')
        }
      } catch {
        setRefus('reseau')
        setEtape('refus')
      }
    }

    void lireInvitation()
  }, [token])

  const etatCompte = invitation?.etat_compte ?? 'inconnu'
  const compteExistant = etatCompte === 'existant'

  /** Contrôles avant l'envoi : la règle du mot de passe neuf ne vaut que pour une adresse sans compte. */
  const controlerAvantEnvoi = (): string[] => {
    if (compteExistant) return []
    const messages: string[] = etatCompte === 'aucun' ? defautsMotDePasseNeuf(password).map(d => t.defauts[d]) : []
    if (password !== confirmPassword) messages.push(t.erreurs.differents)
    return messages
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const avantEnvoi = controlerAvantEnvoi()
    if (avantEnvoi.length > 0) {
      setErreurs(avantEnvoi)
      return
    }

    setEnvoi(true)
    setErreurs([])
    try {
      const res = await fetch('/api/pro/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setRattache(data.compte_existant === true)
        if (data.session) {
          const destination = await poserSession(data.session, langue)
          if (destination) {
            setEtape('ouverture')
            window.location.assign(destination)
            return
          }
        }
        if (data.compte_existant === true) await renouvelerSessionOuverte()
        setEtape('succes')
        return
      }

      if (res.status === 429) setErreurs([t.erreurs.trop])
      else if (data.code === 'autre_espace') setEtape('autre_espace')
      else if (MOTIFS_REFUS.includes(data.code)) {
        setRefus(data.code)
        setEtape('refus')
      } else if (data.code === 'mot_de_passe_faible' && Array.isArray(data.defauts)) {
        setErreurs((data.defauts as string[]).filter(d => d in t.defauts).map(d => t.defauts[d as keyof typeof t.defauts]))
      } else {
        setErreurs([t.erreurs[ERREURS_SERVEUR.includes(data.code) ? (data.code as ErreurFormulaire) : 'erreur']])
      }
    } catch {
      setErreurs([t.erreurs.reseau])
    } finally {
      setEnvoi(false)
    }
  }

  const lienConnexion = `/${langue}/auth/login/`
  const lienOubli = `/${langue}/auth/reset-password/`
  const boutonJaune = { background: '#FFC107', color: '#1a1a1a' }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FA' }}>
      <div className="w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-2xl font-bold mb-1">
            <span style={{ color: '#FFD600' }}>VIT</span><span style={{ color: '#1a1a1a' }}>FIX</span>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm" style={{ background: '#FFC107', color: '#333' }}>{t.badge}</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {(etape === 'chargement' || etape === 'ouverture') && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-sm">{etape === 'chargement' ? t.verification : t.ouverture}</div>
            </div>
          )}

          {etape === 'refus' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">{refus === 'deja_utilisee' ? '✅' : '❌'}</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">{t.refus[refus].titre}</h2>
              <p className="text-sm text-gray-500 mb-6">{t.refus[refus].texte}</p>
              <a href={lienConnexion} className="inline-block px-6 py-3 rounded-lg font-bold text-sm" style={boutonJaune}>
                {t.seConnecter} →
              </a>
              {refus === 'deja_utilisee' && (
                <div className="mt-4">
                  <a href={lienOubli} className="text-sm font-semibold underline" style={{ color: '#1a1a1a' }}>{t.oublie}</a>
                </div>
              )}
            </div>
          )}

          {etape === 'autre_espace' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">⚠️</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">{t.autreEspace.titre}</h2>
              <p className="text-sm text-gray-500">{t.autreEspace.texte}</p>
            </div>
          )}

          {etape === 'formulaire' && invitation && (
            <>
              <div className="text-center mb-6">
                <div className="text-3xl mb-3">👷</div>
                <h2 className="text-lg font-bold text-gray-900">{t.titre}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {t.invitation(invitation.company_name, libelleRole(invitation.role, langue))}
                </p>
              </div>

              <div className="mb-4 p-3 rounded-lg" style={{ background: '#FFF8E1' }}>
                <div className="text-xs text-gray-600">
                  <strong>{t.compte} :</strong> {invitation.email}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  <strong>{t.nom} :</strong> {invitation.full_name}
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-4">
                {compteExistant ? t.introExistant : etatCompte === 'aucun' ? t.introNouveau : t.introInconnu}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="invite-mot-de-passe" className="block text-xs font-semibold text-gray-700 mb-1">
                    {compteExistant ? t.motDePasseDuCompte : t.motDePasse}
                  </label>
                  <input
                    id="invite-mot-de-passe"
                    type="password"
                    autoComplete={compteExistant ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErreurs([]) }}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-yellow-400"
                    placeholder={etatCompte === 'aucun' ? t.aideNouveau : undefined}
                    required
                  />
                </div>

                {!compteExistant && (
                  <div>
                    <label htmlFor="invite-confirmation" className="block text-xs font-semibold text-gray-700 mb-1">{t.confirmer}</label>
                    <input
                      id="invite-confirmation"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setErreurs([]) }}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-yellow-400"
                      required
                    />
                  </div>
                )}

                {erreurs.length > 0 && (
                  <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200">
                    {erreurs.map(message => (
                      <div key={message} className="text-xs text-red-600">{message}</div>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={envoi}
                  className="w-full py-3 rounded-lg font-bold text-sm transition"
                  style={boutonJaune}
                >
                  {envoi ? t.enCours : compteExistant ? t.boutonRejoindre : t.boutonCreer}
                </button>

                {etatCompte !== 'aucun' && (
                  <div className="text-center">
                    <a href={lienOubli} className="text-sm font-semibold underline" style={{ color: '#1a1a1a' }}>{t.oublie}</a>
                  </div>
                )}
              </form>
            </>
          )}

          {etape === 'succes' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">{t.succes.titre}</h2>
              <p className="text-sm text-gray-500 mb-6">{rattache ? t.succes.texteExistant : t.succes.texteNouveau}</p>
              <a href={lienConnexion} className="inline-block px-6 py-3 rounded-lg font-bold text-sm" style={boutonJaune}>
                {t.seConnecter} →
              </a>
              {rattache && (
                <div className="mt-4">
                  <a href={lienOubli} className="text-sm font-semibold underline" style={{ color: '#1a1a1a' }}>{t.oublie}</a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FA' }}>
        <div className="text-gray-400 text-sm">…</div>
      </div>
    }>
      <InvitePageContent />
    </Suspense>
  )
}
