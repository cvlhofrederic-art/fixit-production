'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'
import type { Artisan } from '@/lib/types'

// ══════════════════════════════════════════════════════════════════════════════
// ParrainageSection — Module dashboard parrainage artisan
// Lien de partage (WhatsApp, SMS, copie), stats, historique
// ══════════════════════════════════════════════════════════════════════════════

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface ParrainageSectionProps {
  artisan: Artisan
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
  const isSociete = orgRole === 'pro_societe' || orgRole === 'artisan'
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const locale = useLocale()
  const isPt = locale === 'pt'
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
    let text: string
    if (isPt) {
      text = isSociete
        ? `Olá,\nUsamos o VITFIX Pro para gerir as nossas obras, orçamentos e faturas.\nCom este link a sua empresa tem 1 mês gratuito :\n${stats.referral_link}\n(Nós também ganhamos 1 mês se se subscrever 😊)`
        : `Olá! Uso o VITFIX para os meus orçamentos, obras e faturas.\nCom este link tens 1 mês grátis :\n${stats.referral_link}\n(Eu também ganho 1 mês se te subscreveres 😄)`
    } else {
      text = isSociete
        ? `Bonjour,\nNous utilisons VITFIX Pro pour gérer nos chantiers, devis et factures.\nAvec ce lien votre entreprise bénéficie de 1 mois gratuit :\n${stats.referral_link}\n(Nous gagnons aussi 1 mois si vous vous abonnez 😊)`
        : `Salut ! J'utilise VITFIX pour mes devis, chantiers et factures.\nAvec ce lien tu as 1 mois gratuit :\n${stats.referral_link}\n(Je gagne aussi 1 mois si tu t'abonnes 😄)`
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const shareSMS = () => {
    if (!stats?.referral_link) return
    let text: string
    if (isPt) {
      text = isSociete
        ? `Vitfix Pro — gestão de obras & orçamentos para empresas de construção. 1 mês oferecido : ${stats.referral_link}`
        : `Junta-te ao VITFIX com 1 mês grátis : ${stats.referral_link}`
    } else {
      text = isSociete
        ? `Vitfix Pro — gestion chantiers & devis pour entreprises BTP. 1 mois offert : ${stats.referral_link}`
        : `Rejoins VITFIX avec 1 mois gratuit : ${stats.referral_link}`
    }
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_blank')
  }

  if (loading) {
    return (
      <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎁</div>
        <p style={{ color: isV5 ? '#999' : '#8A9BB0' }}>{isPt ? 'A carregar...' : 'Chargement...'}</p>
      </div>
    )
  }

  /* ═══════════════════════════════════════════
     V5 layout — pro_societe only
     ═══════════════════════════════════════════ */
  if (isV5) {
    return (
      <div className="v5-fade" style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="v5-pg-t">
          <h1>{isPt ? 'Referenciação de empresas' : 'Parrainage entreprises'}</h1>
          <p>{isPt ? 'Programa B2B' : 'Programme B2B'}</p>
        </div>

        {/* Referral code box */}
        <div className="v5-card" style={{ marginBottom: '0.75rem', textAlign: 'center', padding: '1.25rem' }}>
          {stats?.referral_code ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', letterSpacing: '.3px', marginBottom: 8 }}>{isPt ? 'O seu código' : 'Votre code'}</div>
              <div style={{
                display: 'inline-block', padding: '10px 28px', borderRadius: 6,
                border: '2px dashed var(--v5-primary-yellow)', background: 'var(--v5-highlight-yellow)',
                fontSize: 18, fontWeight: 700, letterSpacing: 2, color: '#1a1a1a', marginBottom: 12,
              }}>
                {stats.referral_code}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <button onClick={copyLink} className={`v5-btn${copied ? ' v5-btn-s' : ' v5-btn-p'}`}>
                  {copied ? (isPt ? '✅ Copiado' : '✅ Copié') : (isPt ? 'Copiar link' : 'Copier le lien')}
                </button>
                <button onClick={shareWhatsApp} className="v5-btn v5-btn-s">
                  WhatsApp
                </button>
                <button onClick={shareSMS} className="v5-btn">
                  SMS
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: 12 }}>
              <p style={{ color: '#666', marginBottom: 12, fontSize: 12 }}>{isPt ? 'Ainda não tem código de referenciação.' : 'Vous n\'avez pas encore de code de parrainage.'}</p>
              <button onClick={generateCode} disabled={generating} className="v5-btn v5-btn-p" style={{ opacity: generating ? 0.5 : 1 }}>
                {generating ? (isPt ? 'A gerar...' : 'Génération...') : (isPt ? 'Gerar o meu código' : 'Générer mon code')}
              </button>
            </div>
          )}
        </div>

        {/* KPIs 2-col */}
        <div className="v5-kpi-g" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '0.75rem' }}>
          <div className="v5-kpi">
            <div className="v5-kpi-l">{isPt ? 'Empresas referenciadas' : 'Entreprises parrainées'}</div>
            <div className="v5-kpi-v">{stats?.stats.total || 0}</div>
            <div className="v5-kpi-s">{isPt ? 'inscritas' : 'inscrites'}</div>
          </div>
          <div className="v5-kpi hl">
            <div className="v5-kpi-l">{isPt ? 'Bónus acumulado' : 'Bonus cumulé'}</div>
            <div className="v5-kpi-v">{stats?.credit_mois_gratuits || 0} {isPt ? 'meses' : 'mois'}</div>
            <div className="v5-kpi-s">{isPt ? 'em créditos' : 'en crédits'}</div>
          </div>
        </div>

        {/* Additional KPIs */}
        <div className="v5-kpi-g" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '1rem' }}>
          <div className="v5-kpi">
            <div className="v5-kpi-l">{isPt ? 'Validados' : 'Validés'}</div>
            <div className="v5-kpi-v">{stats?.stats.valides || 0}</div>
            <div className="v5-kpi-s">{isPt ? 'subscritores confirmados' : 'abonnés confirmés'}</div>
          </div>
          <div className="v5-kpi">
            <div className="v5-kpi-l">{isPt ? 'Em verificação' : 'En vérification'}</div>
            <div className="v5-kpi-v">{stats?.stats.enVerification || 0}</div>
            <div className="v5-kpi-s">{isPt ? 'pendentes' : 'en attente'}</div>
          </div>
        </div>

        {/* Comment ca marche */}
        <div className="v5-card" style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#1a1a1a', marginBottom: 10, letterSpacing: '.3px' }}>
            {isPt ? 'Como funciona?' : 'Comment ça marche ?'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(isPt ? [
              "Partilhe o seu link com outra empresa de construção",
              "A empresa regista-se e subscreve o VITFIX Pro",
              "Ambos recebem 1 mês oferecido (confirmado após 7 dias)",
            ] : [
              "Partagez votre lien à une autre entreprise BTP",
              "L'entreprise s'inscrit et s'abonne à VITFIX Pro",
              "Vous recevez chacun 1 mois offert (confirmé après 7 jours)",
            ]).map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: 'var(--v5-primary-yellow)', color: '#333',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 12, color: '#666' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* History table */}
        {history.length > 0 && (
          <div className="v5-card" style={{ overflowX: 'auto' }}>
            <table className="v5-dt">
              <thead>
                <tr>
                  <th>{isPt ? 'Empresa' : 'Entreprise'}</th>
                  <th>Date</th>
                  <th>{isPt ? 'Estado' : 'Statut'}</th>
                  <th>{isPt ? 'Bónus' : 'Bonus'}</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.filleul_name}</td>
                    <td>{item.date_inscription ? new Date(item.date_inscription).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR') : '\u2014'}</td>
                    <td>
                      <span className={`v5-badge ${item.statut.color === 'green' ? 'v5-badge-green' : item.statut.color === 'yellow' ? 'v5-badge-yellow' : item.statut.color === 'blue' ? 'v5-badge-blue' : 'v5-badge-gray'}`}>
                        {item.statut.label}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: item.statut.color === 'green' ? '#2E7D32' : '#999' }}>
                      {item.statut.color === 'green' ? `+${item.mois_offerts} ${isPt ? 'meses' : 'mois'}` : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  /* ═══════════════════════════════════════════
     V22 layout — artisan and other roles
     ═══════════════════════════════════════════ */
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: tv.text, marginBottom: 4 }}>
          {isSociete ? (isPt ? '🤝 Referenciação de Empresas' : '🤝 Parrainage Entreprises BTP') : (isPt ? '🎁 Referenciação' : '🎁 Parrainage')}
        </h2>
        <p style={{ fontSize: 14, color: '#8A9BB0' }}>
          {isPt
            ? (isSociete ? 'Recomende o Vitfix a outras empresas de construção e ganhe meses gratuitos' : 'Referencie colegas artesãos e ganhe meses gratuitos')
            : (isSociete ? "Recommandez Vitfix à d'autres entreprises du bâtiment et gagnez des mois gratuits" : 'Parrainez des artisans et gagnez des mois gratuits')}
        </p>
      </div>

      {/* Section lien */}
      <div className="v22-card" style={{ marginBottom: 20 }}>
        <div className="v22-card-head">
          <div className="v22-card-title">{isPt ? 'O meu link de referenciação' : 'Mon lien de parrainage'}</div>
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
                    background: copied ? '#1D9E75' : '#FFD600',
                    color: copied ? '#fff' : '#0D1B2E',
                  }}
                >
                  {copied ? (isPt ? '✅ Copiado' : '✅ Copié') : (isPt ? 'Copiar' : 'Copier')}
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
              <p style={{ color: '#4A5E78', marginBottom: 12 }}>{isPt ? 'Ainda não tem código de referenciação.' : 'Vous n\'avez pas encore de code de parrainage.'}</p>
              <button onClick={generateCode} disabled={generating} style={{
                padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 15, background: '#FFD600', color: '#0D1B2E',
                opacity: generating ? 0.5 : 1,
              }}>
                {generating ? (isPt ? 'A gerar...' : 'Génération...') : (isPt ? 'Gerar o meu código' : 'Générer mon code')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label={isPt ? 'Referenciados' : 'Parrainés'} value={stats?.stats.total || 0} icon="👥" />
        <StatCard label={isPt ? 'Subscritores validados' : 'Abonnés validés'} value={stats?.stats.valides || 0} icon="✅" />
        <StatCard label={isPt ? 'Meses ganhos' : 'Mois gagnés'} value={stats?.total_parrainages_reussis || 0} icon="🎁" />
        <StatCard label={isPt ? 'Meses disponíveis' : 'Mois disponibles'} value={stats?.credit_mois_gratuits || 0} icon="💰" />
      </div>

      {/* Comment ça marche */}
      <div className="v22-card" style={{ marginBottom: 20 }}>
        <div className="v22-card-head">
          <div className="v22-card-title">{isPt ? 'Como funciona?' : 'Comment ça marche ?'}</div>
        </div>
        <div className="v22-card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StepItem n={1} text={isPt ? (isSociete ? "Partilhe o seu link com outra empresa de construção" : "Partilhe o seu link via WhatsApp ou SMS") : (isSociete ? "Partagez votre lien à une autre entreprise BTP" : "Partagez votre lien via WhatsApp ou SMS")} />
            <StepItem n={2} text={isPt ? (isSociete ? "A empresa regista-se e subscreve o VITFIX Pro" : "O seu colega regista-se e subscreve o VITFIX Pro") : (isSociete ? "L'entreprise s'inscrit et s'abonne à VITFIX Pro" : "Votre collègue s'inscrit et s'abonne à VITFIX Pro")} />
            <StepItem n={3} text={isPt ? "Ambos recebem 1 mês oferecido (confirmado após 7 dias)" : "Vous recevez chacun 1 mois offert (confirmé après 7 jours)"} />
          </div>
        </div>
      </div>

      {/* Historique */}
      {history.length > 0 && (
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">{isPt ? 'Histórico de referenciações' : 'Historique des parrainages'}</div>
          </div>
          <div className="v22-card-body" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E4DDD0' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#4A5E78', fontSize: 13 }}>{isPt ? (isSociete ? 'Empresa' : 'Artesão') : (isSociete ? 'Entreprise' : 'Artisan')}</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#4A5E78', fontSize: 13 }}>Date</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#4A5E78', fontSize: 13 }}>{isPt ? 'Estado' : 'Statut'}</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#4A5E78', fontSize: 13 }}>{isPt ? 'Recompensa' : 'Récompense'}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #F0EBE3' }}>
                      <td style={{ padding: '12px 16px', color: '#0D1B2E', fontWeight: 500 }}>{item.filleul_name}</td>
                      <td style={{ padding: '12px 16px', color: '#8A9BB0' }}>
                        {item.date_inscription ? new Date(item.date_inscription).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR') : '-'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <StatusBadge statut={item.statut} />
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: item.statut.color === 'green' ? '#1D9E75' : '#8A9BB0', fontWeight: 600 }}>
                        {item.statut.color === 'green' ? `+${item.mois_offerts} ${isPt ? 'meses' : 'mois'}` : '-'}
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
        width: 28, height: 28, borderRadius: '50%', background: '#FFD600', color: '#0D1B2E',
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
