'use client'

// app/auth/confirmed/page.tsx
//
// Page de confirmation d'email pro UX. Pattern SaaS (Linear/Stripe/Vercel) :
// 1. L'user clique le lien dans l'email Supabase de confirmation
// 2. Supabase verify le token, génère une session, redirige vers Site URL
// 3. Notre useEffect dans app/page.tsx détecte #access_token + type=signup
//    et redirige ici
// 4. Cette page :
//    - Confirme visuellement "✅ Email confirmé"
//    - Récupère le user + son role via Supabase
//    - Affiche un CTA contextualisé vers le bon dashboard
//    - Auto-redirige après 3s (UX rassurante, pas de "click jacking" surprise)

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTranslation, useLocale } from '@/lib/i18n/context'

type DashboardTarget = {
  href: string
  label: string
}

function dashboardForRole(role: string | undefined, locale: string): DashboardTarget {
  const isPt = locale === 'pt'
  if (role === 'artisan') {
    return {
      href: `/${locale}/artisan/dashboard`,
      label: isPt ? 'Aceder ao meu painel artesão' : 'Aller à mon tableau de bord artisan',
    }
  }
  if (role === 'pro_societe' || role === 'pro_conciergerie' || role === 'pro_gestionnaire') {
    return {
      href: `/${locale}/pro/dashboard`,
      label: isPt ? 'Aceder ao meu painel BTP' : 'Aller à mon tableau de bord BTP',
    }
  }
  return {
    href: `/${locale}/client/dashboard`,
    label: isPt ? 'Aceder ao meu painel cliente' : 'Aller à mon tableau de bord client',
  }
}

export default function AuthConfirmedPage() {
  const router = useRouter()
  const locale = useLocale()
  const { t: _t } = useTranslation() // keep for potential future i18n keys
  void _t

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [target, setTarget] = useState<DashboardTarget | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Détecte la session après que le SDK ait consommé le hash. Le SDK fait ça
  // en async sur les premiers ms, donc on attend un tick avant getSession.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (cancelled) return
        if (error || !data.session?.user) {
          // Si pas de session, le lien est probablement expiré ou déjà consommé.
          setErrorMsg(error?.message ?? null)
          setStatus('error')
          return
        }
        const u = data.session.user
        const role = (u.app_metadata?.role || u.user_metadata?.role) as string | undefined
        setUserEmail(u.email ?? null)
        setTarget(dashboardForRole(role, locale))
        setStatus('success')
      } catch (e) {
        if (cancelled) return
        setErrorMsg(e instanceof Error ? e.message : 'Erreur inconnue')
        setStatus('error')
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [locale])

  // Auto-redirect après 3s si succès — l'user a le temps de lire le message
  // et peut cliquer le CTA pour skip le délai.
  useEffect(() => {
    if (status !== 'success' || !target) return
    const timer = setTimeout(() => router.push(target.href), 3000)
    return () => clearTimeout(timer)
  }, [status, target, router])

  const isPt = locale === 'pt'

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 via-white to-yellow-50 px-4"
      role="main"
      aria-live="polite"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <div
              className="mx-auto h-12 w-12 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin"
              role="status"
              aria-label={isPt ? 'A confirmar' : 'Confirmation en cours'}
            />
            <h1 className="mt-6 text-xl font-semibold text-gray-900">
              {isPt ? 'A validar a tua conta…' : 'Validation de ton compte…'}
            </h1>
          </>
        )}

        {status === 'success' && target && (
          <>
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-9 w-9 text-green-600"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="mt-6 text-2xl font-bold text-gray-900">
              {isPt ? 'E-mail confirmado !' : 'Email confirmé !'}
            </h1>
            {userEmail && (
              <p className="mt-2 text-sm text-gray-600 break-all">{userEmail}</p>
            )}
            <p className="mt-4 text-gray-600">
              {isPt
                ? 'A tua conta está activa. Vamos redireccionar-te dentro de instantes…'
                : 'Ton compte est actif. Tu vas être redirigé dans quelques secondes…'}
            </p>
            <Link
              href={target.href}
              className="mt-6 inline-block w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold py-3 px-6 rounded-xl transition"
            >
              {target.label}
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-9 w-9 text-red-600"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 className="mt-6 text-xl font-bold text-gray-900">
              {isPt ? 'Lien expirado ou inválido' : 'Lien expiré ou invalide'}
            </h1>
            <p className="mt-3 text-gray-600 text-sm">
              {isPt
                ? 'Pode acontecer se o lien já foi usado, ou se passou demasiado tempo. Reenvia um lien de confirmação a partir do login.'
                : 'Cela peut arriver si le lien a déjà été utilisé, ou si trop de temps s\'est écoulé. Demande un nouveau lien de confirmation depuis la page de connexion.'}
            </p>
            {errorMsg && (
              <p className="mt-2 text-xs text-gray-400 italic">{errorMsg}</p>
            )}
            <Link
              href={`/${locale}/auth/login`}
              className="mt-6 inline-block w-full bg-gray-900 hover:bg-black text-white font-semibold py-3 px-6 rounded-xl transition"
            >
              {isPt ? 'Ir para o login' : 'Aller à la connexion'}
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
