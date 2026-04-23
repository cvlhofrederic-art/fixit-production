'use client'

import { useState, useEffect } from 'react'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import type { PhrasesActivite } from '@/lib/stats-phrases'

type Periode = 'mois_en_cours' | 'mois_precedent' | 'annee_en_cours'

interface ResumeData {
  resume: {
    mois_en_cours: { label: string }
  }
  phrases: PhrasesActivite
}

export default function ResumeActivite() {
  const [periode, setPeriode] = useState<Periode>('mois_en_cours')
  const [data, setData] = useState<ResumeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/stats/resume?periode=${periode}`)
      .then(r => {
        if (!r.ok) throw new Error('API error')
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [periode])

  const periodes: { key: Periode; label: string }[] = [
    { key: 'mois_en_cours', label: 'Ce mois' },
    { key: 'mois_precedent', label: 'Mois dernier' },
    { key: 'annee_en_cours', label: 'Cette année' },
  ]

  return (
    <div className="v22-card" style={{ marginBottom: '20px' }}>
      <div className="v22-card-head" style={{ alignItems: 'center' }}>
        <div className="v22-card-title">
          {'📊'} Mon activité
          {data && !loading && (
            <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--v22-text-muted)', marginLeft: '8px' }}>
              {data.resume.mois_en_cours.label}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {periodes.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriode(p.key)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: periode === p.key ? 700 : 500,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: periode === p.key ? 'var(--v22-yellow)' : 'var(--v22-bg)',
                color: periode === p.key ? '#000' : 'var(--v22-text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="v22-card-body" style={{ padding: '16px 20px' }}>
        {loading ? (
          <SkeletonLines />
        ) : error ? (
          <p style={{ fontSize: '13px', color: 'var(--v22-text-muted)' }}>
            Impossible de charger les statistiques.
          </p>
        ) : data ? (
          <ResumeContent phrases={data.phrases} />
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--v22-text-muted)' }}>
            Bienvenue sur VITFIX ! Vos statistiques apparaîtront ici dès votre premier chantier terminé.
          </p>
        )}
      </div>
    </div>
  )
}

function ResumeContent({ phrases }: { phrases: PhrasesActivite }) {
  const hasContent =
    phrases.phrase_principale ||
    phrases.alertes.length > 0 ||
    phrases.phrases_details.length > 0

  if (!hasContent) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--v22-text-muted)' }}>
        Bienvenue sur VITFIX ! Vos statistiques apparaîtront ici dès votre premier chantier terminé.
      </p>
    )
  }

  return (
    <div>
      {/* Alertes */}
      {phrases.alertes.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          {phrases.alertes.map((alerte, i) => (
            <div
              key={i}
              style={{
                padding: '8px 12px',
                marginBottom: '6px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                fontSize: '12px',
                color: '#b91c1c',
                fontWeight: 500,
              }}
            >
              {alerte}
            </div>
          ))}
        </div>
      )}

      {/* Phrase principale */}
      <p
        style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--v22-text)',
          margin: '0 0 12px 0',
          lineHeight: '1.5',
        }}
        dangerouslySetInnerHTML={{
          __html: safeMarkdownToHTML(phrases.phrase_principale),
        }}
      />

      {/* Détails */}
      {phrases.phrases_details.length > 0 && (
        <ul style={{ margin: '0 0 12px 0', padding: '0 0 0 16px', listStyle: 'disc' }}>
          {phrases.phrases_details.map((phrase, i) => (
            <li
              key={i}
              style={{
                fontSize: '12px',
                color: 'var(--v22-text-muted)',
                marginBottom: '4px',
                lineHeight: '1.5',
              }}
              dangerouslySetInnerHTML={{
                __html: safeMarkdownToHTML(phrase),
              }}
            />
          ))}
        </ul>
      )}

      {/* Bonne nouvelle */}
      {phrases.bonne_nouvelle && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(34, 197, 94, 0.06)',
            border: '1px solid rgba(34, 197, 94, 0.15)',
            fontSize: '12px',
            color: '#15803d',
            fontWeight: 500,
          }}
        >
          {'🏆'} {phrases.bonne_nouvelle}
        </div>
      )}
    </div>
  )
}

function SkeletonLines() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {[100, 85, 70, 55].map((w, i) => (
        <div
          key={i}
          style={{
            height: '12px',
            width: `${w}%`,
            borderRadius: '4px',
            background: 'var(--v22-bg)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
      <style>{`@keyframes pulse { 0%,100% { opacity:0.4 } 50% { opacity:0.8 } }`}</style>
    </div>
  )
}
