'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'

// ══════════════════════════════════════════════════════════════════════════════
// /rejoindre?ref=CODE — Landing page parrainage
// Lit le code, vérifie auprès de l'API, pose le cookie, affiche la page
// ══════════════════════════════════════════════════════════════════════════════

const COOKIE_NAME = 'vitfix_ref'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 jours en secondes

export default function RejoindreParrainage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const code = searchParams.get('ref')?.toUpperCase().trim() || ''

  const [parrainName, setParrainName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const trackClick = useCallback(async (refCode: string) => {
    try {
      const res = await fetch('/api/referral/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: refCode }),
      })

      if (!res.ok) {
        setError(true)
        setLoading(false)
        return
      }

      const data = await res.json()
      setParrainName(data.parrain_name || 'Un artisan')

      // Poser le cookie
      document.cookie = `${COOKIE_NAME}=${refCode}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax; Secure`
      // Backup localStorage
      try { localStorage.setItem('vtfx_referral_code', refCode) } catch {}

      setLoading(false)
    } catch {
      setError(true)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!code || code.length < 4 || code.length > 12) {
      // Pas de code ou code invalide → redirect inscription sans parrainage
      router.replace('/pro/register')
      return
    }
    trackClick(code)
  }, [code, router, trackClick])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F4EE' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #C9A84C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#4A5E78', fontSize: 15 }}>Vérification du lien...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F4EE' }}>
        <div style={{ textAlign: 'center', maxWidth: 440, padding: '0 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h1 style={{ fontSize: 22, color: '#0D1B2E', marginBottom: 12 }}>Lien invalide ou expiré</h1>
          <p style={{ color: '#4A5E78', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
            Ce lien de parrainage n&apos;est plus valide. Vous pouvez tout de même créer votre compte gratuitement.
          </p>
          <a
            href="/pro/register"
            style={{
              display: 'inline-block', background: '#0D1B2E', color: '#fff', padding: '14px 32px',
              borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 15,
            }}
          >
            Créer mon compte
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4EE' }}>
      {/* Header */}
      <header style={{
        background: '#0D1B2E', padding: '20px 24px', textAlign: 'center',
      }}>
        <span style={{ color: '#C9A84C', fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>VITFIX</span>
      </header>

      {/* Hero */}
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 60px' }}>
        {/* Badge offre */}
        <div style={{
          display: 'inline-block', background: '#FEF5E4', border: '1px solid #F0D78C',
          borderRadius: 20, padding: '6px 16px', marginBottom: 24,
          fontSize: 14, fontWeight: 600, color: '#B8860B',
        }}>
          🎁 2ᵉ mois offert avec ce lien
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0D1B2E', lineHeight: 1.3, marginBottom: 16 }}>
          {parrainName} vous invite à rejoindre VITFIX
        </h1>

        <p style={{ fontSize: 16, color: '#4A5E78', lineHeight: 1.7, marginBottom: 40 }}>
          La plateforme qui simplifie la gestion de votre activité d&apos;artisan.
          Devis, factures, agenda, clients — tout au même endroit.
        </p>

        {/* 3 arguments visuels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
          <FeatureCard
            icon="📄"
            title="Devis & factures en 2 clics"
            description="Créez des devis professionnels, convertissez-les en factures, envoyez par email ou WhatsApp."
          />
          <FeatureCard
            icon="📅"
            title="Agenda & interventions"
            description="Planifiez vos chantiers, recevez des rappels, suivez l'avancement en temps réel."
          />
          <FeatureCard
            icon="🧮"
            title="Comptabilité simplifiée"
            description="Suivi des revenus et dépenses, préparation de la déclaration, assistant IA dédié."
          />
        </div>

        {/* CTA principal */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <a
            href={`/pro/register?ref=${code}`}
            style={{
              display: 'inline-block', background: '#C9A84C', color: '#0D1B2E',
              padding: '16px 40px', borderRadius: 12, textDecoration: 'none',
              fontWeight: 700, fontSize: 17, boxShadow: '0 4px 14px rgba(201,168,76,0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(201,168,76,0.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(201,168,76,0.3)'
            }}
          >
            Créer mon compte — 2ᵉ mois offert
          </a>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#8A9BB0' }}>
          Sans engagement · Annulable à tout moment
        </p>

        {/* Comment ça marche */}
        <div style={{
          marginTop: 48, background: '#fff', borderRadius: 16,
          padding: '28px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0D1B2E', marginBottom: 20, textAlign: 'center' }}>
            Comment ça marche ?
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Step number={1} text="Créez votre compte gratuitement en 2 minutes" />
            <Step number={2} text="Payez votre 1er mois — le 2ᵉ vous est automatiquement offert" />
            <Step number={3} text={`${parrainName || 'Votre parrain'} reçoit aussi 1 mois offert — tout le monde gagne`} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center', padding: '24px', borderTop: '1px solid #E4DDD0',
        fontSize: 12, color: '#8A9BB0',
      }}>
        © {new Date().getFullYear()} VITFIX — Tous droits réservés
      </footer>
    </div>
  )
}

// ── Composants internes ─────────────────────────────────────────────────────

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '20px',
      display: 'flex', gap: 16, alignItems: 'flex-start',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <span style={{ fontSize: 28, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, color: '#0D1B2E', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 14, color: '#4A5E78', lineHeight: 1.5 }}>{description}</div>
      </div>
    </div>
  )
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: '#C9A84C', color: '#0D1B2E',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 15, flexShrink: 0,
      }}>
        {number}
      </div>
      <div style={{ fontSize: 14, color: '#4A5E78', lineHeight: 1.5 }}>{text}</div>
    </div>
  )
}
