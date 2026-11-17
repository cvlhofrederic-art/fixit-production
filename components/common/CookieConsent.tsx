'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { safeRemove, safeSet } from '@/lib/safe-storage'
import { getCookieConsent, memoriserConsentement, type ConsentState } from '@/lib/consentement-cookies'

// Lecture du consentement : partagée avec la mesure d'audience et lib/analytics (lib/consentement-cookies.ts).
export { getCookieConsent, isAnalyticsAllowed } from '@/lib/consentement-cookies'

// Cookie patterns per category
const ANALYTICS_PATTERNS = ['_ga', '_gid', '_gat', '_gcl_', 'mp_', 'ajs_', '_hjid', '_hjSessionUser']
const MARKETING_PATTERNS = ['_fbp', '_fbc', '__hssc', '__hssrc', '__hstc', 'hubspotutk']
const PERSONALIZATION_PATTERNS = ['_intercom', '_drift']

function removeCookiesByPatterns(patterns: string[]) {
  // Cookies bloqués ou document isolé : la lecture ou l'écriture de document.cookie peut lever ; rien à nettoyer alors.
  let allCookies: string[]
  try {
    allCookies = document.cookie.split(';')
  } catch {
    return
  }
  for (const cookie of allCookies) {
    const name = cookie.split('=')[0].trim()
    const isMatch = patterns.some(p => name.startsWith(p) || name.includes(p))
    if (isMatch) {
      const domains = [window.location.hostname, '.' + window.location.hostname, '']
      const paths = ['/', '']
      for (const domain of domains) {
        for (const path of paths) {
          try {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}${domain ? `;domain=${domain}` : ''}`
          } catch {
            return
          }
        }
      }
    }
  }
}

function enforceConsent(consent: ConsentState) {
  // Performance / analytics
  if (!consent.performance) {
    removeCookiesByPatterns(ANALYTICS_PATTERNS)
    safeSet('va_disable', '1')
    safeSet('si_disable', '1')
  } else {
    safeRemove('va_disable')
    safeRemove('si_disable')
  }

  // Advertising / marketing
  if (!consent.advertising) {
    removeCookiesByPatterns(MARKETING_PATTERNS)
  }

  // Personalization
  if (!consent.personalization) {
    removeCookiesByPatterns(PERSONALIZATION_PATTERNS)
  }

  // Periodic cleanup for declined categories
  const patternsToClean = [
    ...(!consent.performance ? ANALYTICS_PATTERNS : []),
    ...(!consent.advertising ? MARKETING_PATTERNS : []),
    ...(!consent.personalization ? PERSONALIZATION_PATTERNS : []),
  ]
  if (patternsToClean.length > 0) {
    const interval = setInterval(() => removeCookiesByPatterns(patternsToClean), 5000)
    window.addEventListener('beforeunload', () => clearInterval(interval), { once: true })
  }
}

function saveConsent(consent: ConsentState) {
  // Ne lève jamais. Stockage bloqué par le navigateur (SecurityError) ou plein : le choix est gardé en mémoire pour
  // la visite en cours (bandeau fermé, mesure d'audience activée si acceptée), et le bandeau reviendra au prochain
  // chargement complet. Sans ce garde, le clic levait une erreur et le bandeau ne se fermait plus (Sentry T).
  if (!memoriserConsentement(consent)) {
    console.warn('[cookie-consent] stockage inaccessible : choix gardé en mémoire pour cette visite seulement')
  }
  enforceConsent(consent)
}

export default function CookieConsent() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [prefs, setPrefs] = useState({ performance: false, personalization: false, advertising: false })

  useEffect(() => {
    const consent = getCookieConsent()
    if (consent === null) {
      const timer = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(timer)
    }
    enforceConsent(consent)
  }, [])

  const handleAcceptAll = useCallback(() => {
    const consent: ConsentState = { performance: true, personalization: true, advertising: true, date: new Date().toISOString() }
    saveConsent(consent)
    setVisible(false)
  }, [])

  const handleRefuseAll = useCallback(() => {
    const consent: ConsentState = { performance: false, personalization: false, advertising: false, date: new Date().toISOString() }
    saveConsent(consent)
    setVisible(false)
  }, [])

  const handleSavePrefs = useCallback(() => {
    const consent: ConsentState = { ...prefs, date: new Date().toISOString() }
    saveConsent(consent)
    setVisible(false)
  }, [prefs])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label={t('cookie.consentLabel')}
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        backgroundColor: '#1F2937', color: '#F9FAFB',
        padding: '20px 24px',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
        fontSize: '14px',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>
          {t('cookie.fullMessage')}
        </p>

        {showDetails && (
          <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Necessary — always on */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.6 }}>
              <input type="checkbox" checked disabled style={{ accentColor: '#FFC107', width: '18px', height: '18px' }} />
              <span><strong>{t('cookie.necessary')}</strong> — {t('cookie.necessaryDesc')}</span>
            </label>

            {/* Performance */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={prefs.performance} onChange={e => setPrefs(p => ({ ...p, performance: e.target.checked }))}
                style={{ accentColor: '#FFC107', width: '18px', height: '18px' }} />
              <span><strong>{t('cookie.performanceLabel')}</strong> — {t('cookie.performanceDesc')}</span>
            </label>

            {/* Personalization */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={prefs.personalization} onChange={e => setPrefs(p => ({ ...p, personalization: e.target.checked }))}
                style={{ accentColor: '#FFC107', width: '18px', height: '18px' }} />
              <span><strong>{t('cookie.personalizationLabel')}</strong> — {t('cookie.personalizationDesc')}</span>
            </label>

            {/* Advertising */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={prefs.advertising} onChange={e => setPrefs(p => ({ ...p, advertising: e.target.checked }))}
                style={{ accentColor: '#FFC107', width: '18px', height: '18px' }} />
              <span><strong>{t('cookie.advertisingLabel')}</strong> — {t('cookie.advertisingDesc')}</span>
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleRefuseAll}
            style={{
              padding: '8px 20px', borderRadius: '6px', border: '1px solid #6B7280',
              backgroundColor: 'transparent', color: '#D1D5DB', cursor: 'pointer', fontSize: '14px',
            }}
          >
            {t('cookie.decline')}
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              padding: '8px 20px', borderRadius: '6px', border: '1px solid #6B7280',
              backgroundColor: 'transparent', color: '#D1D5DB', cursor: 'pointer', fontSize: '14px',
            }}
          >
            {showDetails ? t('cookie.hideDetails') : t('cookie.customize')}
          </button>
          {showDetails ? (
            <button
              onClick={handleSavePrefs}
              style={{
                padding: '8px 20px', borderRadius: '6px', border: 'none',
                backgroundColor: '#FFC107', color: '#111110', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              }}
            >
              {t('cookie.savePrefs')}
            </button>
          ) : (
            <button
              onClick={handleAcceptAll}
              style={{
                padding: '8px 20px', borderRadius: '6px', border: 'none',
                backgroundColor: '#FFC107', color: '#111110', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              }}
            >
              {t('cookie.accept')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
