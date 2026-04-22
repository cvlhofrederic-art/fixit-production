'use client'

import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import LocaleLink from '@/components/common/LocaleLink'

type Espace = 'particulier' | 'artisan' | 'syndic'

const SPACES = [
  { id: 'particulier' as Espace, emoji: '🏠', labelKey: 'auth.espaceParticulier', descKey: 'auth.espaceParticulierDesc', registerHref: '/auth/register' },
  { id: 'artisan' as Espace, emoji: '🔧', labelKey: 'auth.espaceArtisan', descKey: 'auth.espaceArtisanDesc', registerHref: '/pro/register' },
  { id: 'syndic' as Espace, emoji: '🏢', labelKey: 'auth.espacePro', descKey: 'auth.espaceProDesc', registerHref: '/pro/register' },
]

export default function LoginPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const [step, setStep] = useState<'select' | 'form'>('select')
  const [espace, setEspace] = useState<Espace | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const role = session.user.user_metadata?.role
        if (role === 'artisan') window.location.href = `/${locale}/artisan/dashboard`
        else if (['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'].includes(role)) window.location.href = `/${locale}/pro/dashboard`
        else if (role === 'syndic' || role?.startsWith('syndic')) window.location.href = `/${locale}/syndic/dashboard`
        else window.location.href = `/${locale}/client/dashboard`
      }
    }
    checkAuth()
  }, [locale])

  const selectSpace = (space: Espace) => {
    setEspace(space)
    setError('')
    setTimeout(() => {
      setStep('form')
      setTimeout(() => emailRef.current?.focus(), 100)
    }, 200)
  }

  const goBack = () => {
    setStep('select')
    setError('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError(t('auth.emailOrPasswordIncorrect')); setLoading(false); return }
      const role = data.user?.user_metadata?.role
      if (role === 'artisan') window.location.href = `/${locale}/artisan/dashboard`
      else if (['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'].includes(role)) window.location.href = `/${locale}/pro/dashboard`
      else if (role === 'syndic' || role?.startsWith('syndic')) window.location.href = `/${locale}/syndic/dashboard`
      else window.location.href = `/${locale}/client/dashboard`
    } catch {
      // Anti-phishing : toute erreur de login affiche le même message
      // (évite de divulguer si l'email existe ou si c'est une erreur réseau).
      setError(t('auth.emailOrPasswordIncorrect'))
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/${locale}/client/dashboard`,
        },
      })
    } catch {
      setError(t('auth.genericError'))
    }
  }

  const espaceActif = SPACES.find(s => s.id === espace)

  return (
    <div className="min-h-screen flex flex-col font-display" style={{ background: '#F0EFE9', fontFamily: "'Montserrat', sans-serif" }}>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes loginFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        background: '#fff',
        borderBottom: '1px solid #E8E8E8',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }} className="px-4 md:px-12">
        <LocaleLink href="/" style={{
          fontWeight: 900,
          fontSize: '22px',
          letterSpacing: '-1px',
          color: '#1A1A1A',
          textDecoration: 'none',
          fontFamily: "'Montserrat', sans-serif",
        }}>
          <span style={{ color: '#FFD600' }}>VIT</span>FIX
        </LocaleLink>
        <LocaleLink href="/" style={{
          background: 'transparent',
          border: '1.5px solid #DCDCDC',
          color: '#1A1A1A',
          padding: '8px 20px',
          borderRadius: '50px',
          fontSize: '13.5px',
          fontWeight: 600,
          textDecoration: 'none',
          fontFamily: "'Montserrat', sans-serif",
          transition: 'all 0.2s',
        }}>
          ← {t('confirmation.backHome')}
        </LocaleLink>
      </nav>

      {/* ── PAGE BODY ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background decorations */}
        <div style={{
          position: 'absolute', top: '-120px', left: '-120px',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,196,0,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-80px', right: '-80px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,196,0,0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* ── LOGIN CARD ── */}
        <div style={{
          background: '#fff',
          borderRadius: '24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
          padding: 'clamp(24px, 5vw, 48px) clamp(20px, 4vw, 40px) clamp(20px, 4vw, 40px)',
          width: '100%',
          maxWidth: '560px',
          position: 'relative',
          zIndex: 1,
          animation: 'loginFadeUp 0.45s ease both',
        }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <div style={{
              fontSize: '32px',
              fontWeight: 900,
              letterSpacing: '-1.5px',
              color: '#1A1A1A',
              lineHeight: 1,
              fontFamily: "'Montserrat', sans-serif",
            }}>
              <span style={{ color: '#FFD600' }}>VIT</span>FIX
            </div>
          </div>
          <p style={{
            textAlign: 'center',
            fontSize: '14px',
            color: '#999',
            marginTop: '10px',
            marginBottom: '32px',
            fontWeight: 500,
          }}>
            {t('auth.chooseSpace')}
          </p>

          {/* ── STEP 1: Space Selector ── */}
          {step === 'select' && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
                {SPACES.map((space) => {
                  const sel = espace === space.id
                  return (
                    <button
                      key={space.id}
                      onClick={() => selectSpace(space.id)}
                      style={{
                        border: `2px solid ${sel ? '#FFC107' : '#EBEBEB'}`,
                        borderRadius: '16px',
                        padding: '22px 12px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: sel ? '#FFF9D6' : '#FAFAFA',
                        position: 'relative',
                        textAlign: 'center',
                        fontFamily: "'Montserrat', sans-serif",
                        boxShadow: sel ? '0 8px 24px rgba(245,196,0,0.2)' : 'none',
                        transform: sel ? 'translateY(-2px)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!sel) {
                          const t = e.currentTarget
                          t.style.borderColor = '#FFC107'
                          t.style.background = '#FFF9D6'
                          t.style.transform = 'translateY(-2px)'
                          t.style.boxShadow = '0 8px 24px rgba(245,196,0,0.2)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!sel) {
                          const t = e.currentTarget
                          t.style.borderColor = '#EBEBEB'
                          t.style.background = '#FAFAFA'
                          t.style.transform = 'none'
                          t.style.boxShadow = 'none'
                        }
                      }}
                    >
                      {/* Check mark */}
                      <div style={{
                        position: 'absolute',
                        top: '10px', right: '10px',
                        width: '20px', height: '20px',
                        background: '#FFC107',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 800,
                        opacity: sel ? 1 : 0,
                        transition: 'opacity 0.2s',
                        color: '#1A1A1A',
                      }}>
                        ✓
                      </div>

                      {/* Icon box */}
                      <div style={{
                        width: '52px', height: '52px',
                        borderRadius: '14px',
                        background: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '26px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                        transition: 'transform 0.2s',
                        transform: sel ? 'scale(1.08)' : 'scale(1)',
                      }}>
                        {space.emoji}
                      </div>

                      {/* Name */}
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#1A1A1A',
                      }}>
                        {t(space.labelKey)}
                      </div>

                      {/* Description */}
                      <div style={{
                        fontSize: '11.5px',
                        color: '#999',
                        lineHeight: 1.4,
                      }}>
                        {t(space.descKey)}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p style={{
                textAlign: 'center',
                fontSize: '13px',
                color: '#999',
                fontWeight: 500,
              }}>
                {t('auth.selectSpaceAbove')}
              </p>
            </div>
          )}

          {/* ── STEP 2: Login Form ── */}
          {step === 'form' && espace && espaceActif && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              animation: 'loginFadeUp 0.3s ease both',
            }}>
              {/* Form Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <button
                  onClick={goBack}
                  style={{
                    width: '32px', height: '32px',
                    borderRadius: '50%',
                    background: '#F5F5F5',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0,
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  ←
                </button>
                <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>{t('auth.connectionDash')}</h2>
                <span style={{
                  marginLeft: 'auto',
                  background: '#FFF9D6',
                  color: '#D4A900',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: '50px',
                }}>
                  {t(espaceActif.labelKey)}
                </span>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: '#FEF2F2', color: '#DC2626',
                  padding: '12px 16px', borderRadius: '10px',
                  fontSize: '14px', border: '1px solid #FECACA',
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="login-email" style={{
                  fontSize: '11.5px', fontWeight: 700, color: '#444',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Adresse email
                </label>
                <input
                  id="login-email"
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1.5px solid #E0E0E0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontFamily: "'Montserrat', sans-serif",
                    background: '#FAFAFA',
                    color: '#1A1A1A',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#FFC107'
                    e.target.style.boxShadow = '0 0 0 3px rgba(245,196,0,0.15)'
                    e.target.style.background = '#fff'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#E0E0E0'
                    e.target.style.boxShadow = 'none'
                    e.target.style.background = '#FAFAFA'
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="login-password" style={{
                  fontSize: '11.5px', fontWeight: 700, color: '#444',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '12px 44px 12px 16px',
                      border: '1.5px solid #E0E0E0',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontFamily: "'Montserrat', sans-serif",
                      background: '#FAFAFA',
                      color: '#1A1A1A',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#FFC107'
                      e.target.style.boxShadow = '0 0 0 3px rgba(245,196,0,0.15)'
                      e.target.style.background = '#fff'
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#E0E0E0'
                      e.target.style.boxShadow = 'none'
                      e.target.style.background = '#FAFAFA'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#999', padding: '4px', display: 'flex', alignItems: 'center',
                    }}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember me + Forgot password */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, color: '#444' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#FFC107', cursor: 'pointer' }}
                  />
                  Se souvenir de moi
                </label>
                <LocaleLink href="/auth/reset-password" style={{
                  color: '#999', textDecoration: 'none', fontWeight: 600,
                  fontSize: '12.5px', transition: 'color 0.2s',
                }}>
                  {t('auth.forgotPassword')}
                </LocaleLink>
              </div>

              {/* Login button */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: '#FFC107',
                    color: '#1A1A1A',
                    padding: '14px',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: "'Montserrat', sans-serif",
                    transition: 'filter 0.2s, transform 0.2s',
                    marginTop: '4px',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? t('auth.connecting') : `${t('auth.loginButton')} · ${t(espaceActif.labelKey)}`}
                </button>
              </form>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#999', fontSize: '12px', fontWeight: 500 }}>
                <div style={{ flex: 1, height: '1px', background: '#EBEBEB' }} />
                ou
                <div style={{ flex: 1, height: '1px', background: '#EBEBEB' }} />
              </div>

              {/* Google button */}
              <button
                onClick={handleGoogleLogin}
                type="button"
                style={{
                  width: '100%',
                  background: '#fff',
                  color: '#1A1A1A',
                  padding: '12px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: '1.5px solid #DCDCDC',
                  cursor: 'pointer',
                  fontFamily: "'Montserrat', sans-serif",
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuer avec Google
              </button>

              {/* Sign up link */}
              <p style={{ textAlign: 'center', fontSize: '13px', color: '#999', marginTop: '4px' }}>
                {t('auth.noAccount')}{' '}
                <LocaleLink href={espaceActif.registerHref} style={{
                  color: '#1A1A1A', fontWeight: 700, textDecoration: 'none',
                  borderBottom: '1.5px solid #FFC107',
                }}>
                  {t('auth.createAccountFor')}
                </LocaleLink>
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: '#999' }}>
        © 2026 VITFIX ·{' '}
        <LocaleLink href="/mentions-legales" style={{ color: '#999', textDecoration: 'none' }}>{locale === 'pt' ? 'Avisos legais' : 'Mentions légales'}</LocaleLink>
        {' '}·{' '}
        <LocaleLink href="/confidentialite" style={{ color: '#999', textDecoration: 'none' }}>{locale === 'pt' ? 'Privacidade' : 'Confidentialité'}</LocaleLink>
        {' '}·{' '}
        <LocaleLink href="/contact" style={{ color: '#999', textDecoration: 'none' }}>Contact</LocaleLink>
      </footer>
    </div>
  )
}
