'use client'

import React from 'react'
import type { Immeuble, Mission, Artisan, Alerte } from '@/components/syndic-dashboard/types'

interface AccueilSectionProps {
  immeubles: Immeuble[]
  missions: Mission[]
  artisans: Artisan[]
  alertes: Alerte[]
  totalBudget: number
  totalDepenses: number
  locale: string
  userName: string
  t: (key: string, fallback?: string) => string
  setPage: (page: string) => void
  setSelectedMission: (m: Mission) => void
  setShowMissionDetails: (show: boolean) => void
}

export default function AccueilSection({
  immeubles,
  missions,
  artisans,
  alertes,
  totalBudget,
  totalDepenses,
  locale,
  userName,
  t,
  setPage,
  setSelectedMission,
  setShowMissionDetails,
}: AccueilSectionProps) {
  const totalLots = immeubles.reduce((a, i) => a + (i.nbLots || 0), 0)
  const missionsActives = missions.filter(m => ['en_cours', 'acceptee'].includes(m.statut)).length
  const missionsEnAttente = missions.filter(m => m.statut === 'en_attente').length
  const artisansActifs = artisans.filter(a => a.statut === 'actif').length
  const artisansCertifies = artisans.filter(a => a.vitfixCertifie).length
  const alertesUrgentes = alertes.filter(a => a.urgence === 'haute')
  const budgetPct = totalBudget > 0 ? Math.min((totalDepenses / totalBudget) * 100, 100) : 0
  const solde = totalBudget - totalDepenses
  const locStr = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const dateLabel = new Date().toLocaleDateString(locStr, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Hero band ── */}
      <div style={{ background: 'var(--sd-navy)', borderRadius: 16, padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        {/* Background decorations */}
        <div style={{ position: 'absolute', top: -50, right: -30, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(201,168,76,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--sd-gold)', fontWeight: 600, marginBottom: 6 }}>
            {dateLabel}
          </div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: '#fff', fontWeight: 400, lineHeight: 1.2 }}>
            {t('syndicDash.accueil.hello') || 'Bonjour,'} <em style={{ fontStyle: 'italic', color: 'var(--sd-gold-light)' }}>{userName}</em>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
            {t('syndicDash.accueil.portfolioStatus') || 'Voici l\'état de votre portefeuille immobilier aujourd\'hui.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 32, position: 'relative' }}>
          {[
            { val: totalLots, lbl: t('syndicDash.accueil.lotsTotal') || 'Fractions gérées' },
            { val: missionsActives, lbl: t('syndicDash.accueil.activeMissions') || 'Missions actives' },
            { val: `${totalBudget.toLocaleString(locStr)} €`, lbl: `${t('syndicDash.accueil.budget') || 'Budget'} ${new Date().getFullYear()}` },
          ].map((s, idx) => (
            <div key={idx} style={{ textAlign: 'right', paddingLeft: 32, borderLeft: idx > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: '#fff', lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4, letterSpacing: '0.3px' }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          {
            ico: '🏢', icoColor: 'rgba(13,27,46,0.07)',
            trend: '+0%', trendType: 'up',
            val: immeubles.length, lbl: t('syndicDash.accueil.managedBuildings') || 'Édifices gérés',
            sub: `${totalLots} ${t('syndicDash.accueil.lotsTotal') || 'fractions'}`
          },
          {
            ico: '🔧', icoColor: 'var(--sd-gold-dim)',
            trend: artisansActifs > 0 ? `${artisansActifs}` : '0', trendType: 'flat',
            val: artisansActifs, lbl: t('syndicDash.accueil.activeArtisans') || 'Professionnels actifs',
            sub: `${artisansCertifies} ${t('syndicDash.accueil.vitfixCertified') || 'certifiés VitFix'}`
          },
          {
            ico: '📋', icoColor: 'var(--sd-teal-soft)',
            trend: missionsEnAttente > 0 ? `${missionsEnAttente} ${t('syndicDash.accueil.pending') || 'en attente'}` : '—', trendType: missionsEnAttente > 0 ? 'warn' : 'flat',
            val: missionsActives, lbl: t('syndicDash.accueil.ongoingMissions') || 'Missions en cours',
            sub: `${missionsEnAttente} ${t('syndicDash.accueil.pending') || 'en attente'}`
          },
          {
            ico: '🔔', icoColor: alertesUrgentes.length > 0 ? 'var(--sd-red-soft)' : 'var(--sd-teal-soft)',
            trend: alertesUrgentes.length > 0 ? `${t('syndicDash.accueil.toWatch') || 'À surveiller'}` : 'OK', trendType: alertesUrgentes.length > 0 ? 'alert' : 'up',
            val: alertes.length, lbl: t('syndicDash.accueil.activeAlerts') || 'Alertes actives',
            sub: `${alertesUrgentes.length} ${t('syndicDash.accueil.urgent') || 'urgentes'}`
          },
        ].map((kpi, idx) => {
          const trendColors: Record<string, { bg: string; color: string }> = {
            up:    { bg: 'var(--sd-teal-soft)',   color: 'var(--sd-teal)' },
            flat:  { bg: 'var(--sd-cream-dark)', color: 'var(--sd-ink-3)' },
            warn:  { bg: 'var(--sd-amber-soft)', color: 'var(--sd-amber)' },
            alert: { bg: 'var(--sd-red-soft)',   color: 'var(--sd-red)' },
          }
          const tc = trendColors[kpi.trendType] || trendColors.flat
          return (
            <div key={idx} style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: kpi.icoColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{kpi.ico}</div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 6, letterSpacing: '0.3px', background: tc.bg, color: tc.color }}>{kpi.trend}</span>
              </div>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 34, color: 'var(--sd-navy)', lineHeight: 1 }}>{kpi.val}</div>
                <div style={{ fontSize: 13, color: 'var(--sd-ink-2)', fontWeight: 400, marginTop: 4 }}>{kpi.lbl}</div>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>{kpi.sub}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Budget section ── */}
      <div style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 14, padding: '26px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 400, color: 'var(--sd-navy)' }}>
              {t('syndicDash.accueil.globalBudget') || 'Budget global'} — {t('syndicDash.accueil.fiscalYear') || 'Exercice'} {new Date().getFullYear()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2, letterSpacing: '0.3px' }}>
              {t('syndicDash.accueil.budgetSubtitle') || 'Suivi des dépenses et solde disponible'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--sd-gold-dim)', border: '1px solid rgba(201,168,76,0.25)', color: '#8A6A20', fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 20, letterSpacing: '0.5px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sd-gold)' }} />
            {t('syndicDash.accueil.inProgress') || 'En cours'}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0, marginBottom: 20 }}>
          {[
            { lbl: t('syndicDash.accueil.totalBudget') || 'Budget total', val: `${totalBudget.toLocaleString(locStr)} €`, note: `${t('syndicDash.accueil.fiscalYear') || 'Exercice'} ${new Date().getFullYear()}`, color: 'var(--sd-navy)' },
            { lbl: t('syndicDash.accueil.spent') || 'Dépensé', val: `${totalDepenses.toLocaleString(locStr)} €`, note: `${Math.round(budgetPct)}% ${t('syndicDash.accueil.consumed') || 'consommé'}`, color: 'var(--sd-amber)' },
            { lbl: t('syndicDash.accueil.remaining') || 'Solde restant', val: `${solde.toLocaleString(locStr)} €`, note: t('syndicDash.accueil.available') || 'Disponible', color: 'var(--sd-teal)' },
          ].map((fig, idx) => (
            <div key={idx} style={{ paddingRight: idx < 2 ? 24 : 0, paddingLeft: idx > 0 ? 24 : 0, borderRight: idx < 2 ? '1px solid var(--sd-border)' : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--sd-ink-3)', marginBottom: 8 }}>{fig.lbl}</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: fig.color, lineHeight: 1 }}>{fig.val}</div>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 5 }}>{fig.note}</div>
            </div>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--sd-ink-3)', marginBottom: 6, letterSpacing: '0.3px' }}>
            <span>{Math.round(budgetPct)}% {t('syndicDash.accueil.consumed') || 'consommé'}</span>
            <span>{t('syndicDash.accueil.available') || 'Budget disponible'}</span>
          </div>
          <div style={{ height: 8, background: 'var(--sd-cream-dark)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg,var(--sd-navy),var(--sd-navy-soft))', borderRadius: 10, width: `${budgetPct}%`, transition: 'width 1.2s cubic-bezier(.4,0,.2,1)' }} />
          </div>
        </div>
      </div>

      {/* ── Bottom grid : alertes + missions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 18 }}>

        {/* Panel alertes urgentes */}
        <div style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--sd-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--sd-red-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🔴</div>
              <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 400, color: 'var(--sd-navy)' }}>{t('syndicDash.accueil.urgentAlerts') || 'Alertes urgentes'}</span>
            </div>
            <button onClick={() => setPage('alertes')} style={{ fontSize: 11, color: 'var(--sd-gold)', textDecoration: 'none', fontWeight: 600, letterSpacing: '0.3px', background: 'none', border: 'none', cursor: 'pointer' }}>
              {t('syndicDash.common.seeAll') || 'Voir tout'} →
            </button>
          </div>
          {alertesUrgentes.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
              <div style={{ color: 'var(--sd-ink-3)', fontSize: 13, lineHeight: 1.5 }}>{t('syndicDash.accueil.noUrgentAlert') || 'Aucune alerte urgente.'}<br />{t('syndicDash.accueil.allUnderControl') || 'Tout est sous contrôle.'}</div>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              {alertesUrgentes.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 20px', borderBottom: '1px solid var(--sd-border)', cursor: 'pointer' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sd-red)', boxShadow: '0 0 0 3px var(--sd-red-soft)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>{a.date}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'var(--sd-red-soft)', color: 'var(--sd-red)', letterSpacing: '0.3px' }}>{t('syndicDash.accueil.urgent') || 'Urgent'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel missions récentes */}
        <div style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--sd-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(13,27,46,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>📋</div>
              <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 400, color: 'var(--sd-navy)' }}>{t('syndicDash.accueil.recentMissions') || 'Missions récentes'}</span>
            </div>
            <button onClick={() => setPage('missions')} style={{ fontSize: 11, color: 'var(--sd-gold)', fontWeight: 600, letterSpacing: '0.3px', background: 'none', border: 'none', cursor: 'pointer' }}>
              {t('syndicDash.accueil.seeAllMissions') || 'Voir tout'} →
            </button>
          </div>
          {missions.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <div style={{ color: 'var(--sd-ink-3)', fontSize: 13 }}>{t('syndicDash.accueil.noMission') || 'Aucune mission en cours.'}</div>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              {missions.slice(0, 4).map(m => {
                const isUrgent = m.priorite === 'urgente'
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 20px', borderBottom: '1px solid var(--sd-border)', cursor: 'pointer' }} onClick={() => { setSelectedMission(m); setShowMissionDetails(true) }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: isUrgent ? 'var(--sd-red)' : 'var(--sd-amber)', boxShadow: isUrgent ? '0 0 0 3px var(--sd-red-soft)' : '0 0 0 3px var(--sd-amber-soft)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.immeuble}</div>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>{m.type} · {m.artisan || t('syndicDash.missions.unassigned') || 'Non assigné'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      {isUrgent && <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'var(--sd-red-soft)', color: 'var(--sd-red)', letterSpacing: '0.3px' }}>{t('syndicDash.accueil.urgent') || 'Urgent'}</span>}
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'var(--sd-amber-soft)', color: 'var(--sd-amber)', letterSpacing: '0.3px' }}>{m.statut === 'en_cours' ? (t('syndicDash.missions.inProgress') || 'En cours') : (t('syndicDash.missions.pending') || 'En attente')}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Immeubles aperçu ── */}
      {immeubles.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 14, padding: '26px 28px' }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 400, color: 'var(--sd-navy)', marginBottom: 20 }}>🏢 {t('syndicDash.accueil.myBuildings') || 'Mes immeubles'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
            {immeubles.map(i => {
              const pct = i.budgetAnnuel > 0 ? Math.min((i.depensesAnnee / i.budgetAnnuel) * 100, 100) : 0
              return (
                <div key={i.id} style={{ border: '1px solid var(--sd-border)', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'border-color 0.15s' }} onClick={() => setPage('immeubles')}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--sd-gold)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--sd-border)'}
                >
                  <div style={{ fontWeight: 500, color: 'var(--sd-navy)', fontSize: 14, marginBottom: 4 }}>{i.nom}</div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginBottom: 12 }}>{i.adresse}{i.ville ? `, ${i.ville}` : ''}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--sd-ink-2)', marginBottom: 8 }}>
                    <span>🏠 {i.nbLots} {t('syndicDash.accueil.lots') || 'lots'}</span>
                    <span>📋 {i.nbInterventions || 0} {t('syndicDash.accueil.interventions') || 'interventions'}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--sd-cream-dark)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(90deg,var(--sd-navy),var(--sd-navy-soft))', borderRadius: 4, width: `${pct}%` }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--sd-ink-3)', marginTop: 4 }}>{t('syndicDash.accueil.budget') || 'Budget'} : {Math.round(pct)}% {t('syndicDash.accueil.consumed') || 'consommé'}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
