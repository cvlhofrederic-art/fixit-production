'use client'

import { useState, useEffect } from 'react'

const COOKIE_KEY = 'vitfix_cookie_consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY)
    if (!consent) {
      // Petit délai pour ne pas bloquer le rendu initial
      const timer = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  function handleAccept() {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({ accepted: true, date: new Date().toISOString() }))
    setVisible(false)
  }

  function handleRefuse() {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({ accepted: false, date: new Date().toISOString() }))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Consentement cookies"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#1F2937',
        color: '#F9FAFB',
        padding: '16px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '14px',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.2)',
      }}
    >
      <p style={{ margin: 0, flex: '1 1 300px', lineHeight: 1.5 }}>
        Ce site utilise des cookies essentiels au fonctionnement de la plateforme.
        Aucun cookie publicitaire n&apos;est utilis&eacute;.
        En continuant, vous acceptez notre politique de confidentialit&eacute;.
      </p>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={handleRefuse}
          style={{
            padding: '8px 20px',
            borderRadius: '6px',
            border: '1px solid #6B7280',
            backgroundColor: 'transparent',
            color: '#D1D5DB',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Refuser
        </button>
        <button
          onClick={handleAccept}
          style={{
            padding: '8px 20px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#D4A017',
            color: '#1F2937',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          Accepter
        </button>
      </div>
    </div>
  )
}
