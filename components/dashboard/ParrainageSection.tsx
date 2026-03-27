'use client'

import { useState, useEffect, useCallback } from 'react'

// ══════════════════════════════════════════════════════════════════════════════
// ParrainageSection — Module dashboard parrainage artisan
// Lien de partage (WhatsApp, SMS, copie), stats, historique
// ══════════════════════════════════════════════════════════════════════════════

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface ParrainageSectionProps {
  artisan: Record<string, unknown> & { id: string }
  orgRole?: OrgRole
}

interface ReferralStats {
  referral_code: string | null
  referral_link: string | null
  credit_mois_gratuits: number
  total_parrainages_reussis: number
  stats: { total: number; inscrits: number; enVerification: number; valides: number }
}

interface HistoryItem {
  id: string
  filleul_name: string
  date_inscription: string | null
  date_recompense: string | null
  statut: { label: string; color: string; detail?: string }
  mois_offerts: number
}

export default function ParrainageSection({ artisan, orgRole }: ParrainageSectionProps) {
  const isSociete = orgRole === 'pro_societe'
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        fetch('/api/referral/stats'),
        fetch('/api/referral/history'),
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (historyRes.ok) {
        const data = await historyRes.json()
        setHistory(data.history || [])
      }
    } catch (err) {
      console.error('[parrainage] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const generateCode = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/referral/generate-code', { method: 'POST' })
      if (res.ok) await fetchData()
    } catch {}
    setGenerating(false)
  }

  const copyLink = () => {
    if (!stats?.referral_link) return
    navigator.clipboard.writeText(stats.referral_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = () => {
    if (!stats?.referral_link) return
    const text = isSociete
      ? `Bonjour,\nNous utilisons VITFIX Pro pour gérer nos chantiers, devis et factures.\nAvec ce lien votre entreprise bénéficie de 1 mois gratuit :\n${stats.referral_link}\n(Nous gagnons aussi 1 mois si vous vous abonnez 😊)`
      : `Salut ! J'utilise VITFIX pour mes devis, chantiers et factures.\nAvec ce lien tu as 1 mois gratuit :\n${stats.referral_link}\n(Je gagne aussi 1 mois si tu t'abonnes 😄)`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const shareSMS = () => {
    if (!stats?.referral_link) return
    const text = isSociete
      ? `Vitfix Pro — gestion chantiers & devis pour entreprises BTP. 1 mois offert : ${stats.referral_link}`
      : `Rejoins VITFIX avec 1 mois gratuit : ${stats.referral_link}`
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_blank')
  }

  if (loading) {
    return (
      <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎁</div>
        <p style={{ color: '#8A9BB0' }}>Chargement...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--v22-text, #0D1B2E)', marginBottom: 4 }}>
          {isSociete ? '🤝 Parrainage Entreprises BTP' : '🎁 Parrainage'}
        </h2>
        <p style={{ fontSize: 14, color: '#8A9BB0' }}>
          {isSociete
            ? "Recommandez Vitfix à d'autres entreprises du bâtiment et gagnez des mois gratuits"
            : 'Parrainez des artisans et gagnez des mois gratuits'}
        </p>
      </div>

      {/* Section lien */}
      <div className="v22-card" style={{ marginBottom: 20 }}>
        <div className="v22-card-head">
          <div className="v22-card-title">Mon lien de parrainage</div>
        </div>
        <div className="v22-card-body">
          {stats?.referral_code ? (
            <>
              <div style={{
                display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
                background: '#F7F4EE', borderRadius: 10, padding: '10px 14px',
              }}>
                <input
                  readOnly
                  value={stats.referral_link || ''}
                  style={{
                    flex: 1, border: 'none', background: 'transparent', fontSize: 14,
                    color: '#0D1B2E', fontFamily: 'monospace', outline: 'none',
                  }}
                />
                <button
                  onClick={copyLink}
                  style={{
                    padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
                    background: copied ? '#1D9E75' : '#C9A84C',
                    color: copied ? '#fff' : '#0D1B2E',
                  }}
                >
                  {copied ? '✅ Copié' : 'Copier'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={shareWhatsApp} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                  borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                  background: '#25D366', color: '#fff',
                }}>
                  <span>📱</span> WhatsApp
                </button>
                <button onClick={shareSMS} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                  borderRadius: 10, border: '1px solid #E4DDD0', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                  background: '#fff', color: '#0D1B2E',
                }}>
                  <span>💬</span> SMS
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <p style={{ color: '#4A5E78', marginBottom: 12 }}>Vous n&apos;avez pas encore de code de parrainage.</p>
              <button onClick={generateCode} disabled={generating} style={{
                padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 15, background: '#C9A84C', color: '#0D1B2E',
                opacity: generating ? 0.5 : 1,
              }}>
                {generating ? 'Génération...' : 'Générer mon code'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Parrainés" value={stats?.stats.total || 0} icon="👥" />
        <StatCard label="Abonnés validés" value={stats?.stats.valides || 0} icon="✅" />
        <StatCard label="Mois gagnés" value={stats?.total_parrainages_reussis || 0} icon="🎁" />
        <StatCard label="Mois disponibles" value={stats?.credit_mois_gratuits || 0} icon="💰" />
      </div>

      {/* Comment ça marche */}
      <div className="v22-card" style={{ marginBottom: 20 }}>
        <div className="v22-card-head">
          <div className="v22-card-title">Comment ça marche ?</div>
        </div>
        <div className="v22-card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StepItem n={1} text={isSociete ? "Partagez votre lien à une autre entreprise BTP" : "Partagez votre lien via WhatsApp ou SMS"} />
            <StepItem n={2} text={isSociete ? "L'entreprise s'inscrit et s'abonne à VITFIX Pro" : "Votre collègue s'inscrit et s'abonne à VITFIX Pro"} />
            <StepItem n={3} text="Vous recevez chacun 1 mois offert (confirmé après 7 jours)" />
          </div>
        </div>
      </div>

      {/* Historique */}
      {history.length > 0 && (
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">Historique des parrainages</div>
          </div>
          <div className="v22-card-body" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E4DDD0' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#4A5E78', fontSize: 13 }}>{isSociete ? 'Entreprise' : 'Artisan'}</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#4A5E78', fontSize: 13 }}>Date</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#4A5E78', fontSize: 13 }}>Statut</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#4A5E78', fontSize: 13 }}>Récompense</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #F0EBE3' }}>
                      <td style={{ padding: '12px 16px', color: '#0D1B2E', fontWeight: 500 }}>{item.filleul_name}</td>
                      <td style={{ padding: '12px 16px', color: '#8A9BB0' }}>
                        {item.date_inscription ? new Date(item.date_inscription).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <StatusBadge statut={item.statut} />
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: item.statut.color === 'green' ? '#1D9E75' : '#8A9BB0', fontWeight: 600 }}>
                        {item.statut.color === 'green' ? `+${item.mois_offerts} mois` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Composants internes ─────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="v22-card" style={{ padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#0D1B2E' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#8A9BB0', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function StepItem({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: '#C9A84C', color: '#0D1B2E',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 13, flexShrink: 0,
      }}>
        {n}
      </div>
      <span style={{ fontSize: 14, color: '#4A5E78' }}>{text}</span>
    </div>
  )
}

function StatusBadge({ statut }: { statut: { label: string; color: string; detail?: string } }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    yellow: { bg: '#FEF5E4', text: '#B8860B' },
    blue: { bg: '#E8F4FD', text: '#1A6FB5' },
    green: { bg: '#E6F4F2', text: '#1A7A6E' },
    gray: { bg: '#F0EBE3', text: '#8A9BB0' },
  }

  const c = colorMap[statut.color] || colorMap.gray

  return (
    <div>
      <span style={{
        display: 'inline-block', padding: '3px 10px', borderRadius: 6,
        fontSize: 12, fontWeight: 600, background: c.bg, color: c.text,
      }}>
        {statut.label}
      </span>
      {statut.detail && (
        <div style={{ fontSize: 11, color: '#8A9BB0', marginTop: 2 }}>{statut.detail}</div>
      )}
    </div>
  )
}
