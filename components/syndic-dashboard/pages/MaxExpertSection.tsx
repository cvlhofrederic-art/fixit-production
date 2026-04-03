'use client'

import React from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { MaxAvatar } from '@/components/common/RobotAvatars'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import type { Immeuble } from '@/components/syndic-dashboard/types'

interface ConformiteCheck {
  id: string
  label: string
  detail: string
  status: 'ok' | 'warning' | 'error' | 'info'
  action?: boolean
}

interface DocPDFData {
  title?: string
  type?: string
  objet?: string
  destinataire?: {
    nom?: string
    prenom?: string
    immeuble?: string
    [key: string]: unknown
  }
  corps?: string[]
  references?: string[]
  formule_politesse?: string
  [key: string]: unknown
}

interface MaxMessage {
  role: 'user' | 'assistant'
  content: string
}

interface MaxExpertSectionProps {
  maxMessages: MaxMessage[]
  maxInput: string
  setMaxInput: (v: string) => void
  maxLoading: boolean
  maxTab: 'chat' | 'conformite' | 'documents'
  setMaxTab: (tab: 'chat' | 'conformite' | 'documents') => void
  maxFavorites: string[]
  setMaxFavorites: (favs: string[]) => void
  maxSelectedImmeuble: string
  setMaxSelectedImmeuble: (v: string) => void
  maxEndRef: React.RefObject<HTMLDivElement>
  sendMaxMessage: (msg?: string) => void
  setFixyPanelOpen: (open: boolean) => void
  setMaxMessages: (msgs: MaxMessage[]) => void
  immeubles: Immeuble[]
  userId?: string
  parseDocPDF: (content: string) => { text: string; docData: DocPDFData | null }
  buildSyndicContext: () => {
    artisans: { rcProValide: boolean }[]
    missions: { priorite: string; statut: string }[]
    immeubles: { nom: string; budgetAnnuel: number; depensesAnnee: number }[]
    alertes: { urgence: string }[]
    [key: string]: unknown
  }
  buildConformiteChecklist: () => ConformiteCheck[]
  setPendingDocData: (data: DocPDFData) => void
  setPdfObjet: (v: string) => void
  setPdfSelectedImmeuble: (v: string) => void
  setPdfSelectedCopro: (v: null) => void
  setShowPdfModal: (v: boolean) => void
}

export default function MaxExpertSection({
  maxMessages,
  maxInput,
  setMaxInput,
  maxLoading,
  maxTab,
  setMaxTab,
  maxFavorites,
  setMaxFavorites,
  maxSelectedImmeuble,
  setMaxSelectedImmeuble,
  maxEndRef,
  sendMaxMessage,
  setFixyPanelOpen,
  setMaxMessages,
  immeubles,
  userId,
  parseDocPDF,
  buildSyndicContext,
  buildConformiteChecklist,
  setPendingDocData,
  setPdfObjet,
  setPdfSelectedImmeuble,
  setPdfSelectedCopro,
  setShowPdfModal,
}: MaxExpertSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()

  return (
    <div className="sd-mx-zone">
      <div className="sd-mx-inner">

        {/* ── Identity Banner ── */}
        <div className="sd-mx-banner">
          <div className="sd-mx-id-left">
            <div className="sd-mx-monogram" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <MaxAvatar size={54} />
            </div>
            <div>
              <div className="sd-mx-title-row">
                <div className="sd-mx-title">{t('syndicDash.ai.maxTitleFull')}</div>
                <span className="sd-mx-ia-chip">IA</span>
              </div>
              <div className="sd-mx-expertise">
                {locale === 'pt' ? (
                  <>
                    <span className="sd-mx-exp-tag">Condomínio</span>
                    <span className="sd-mx-exp-tag">Legislação PT</span>
                    <span className="sd-mx-exp-tag">Regulamentação</span>
                    <span className="sd-mx-exp-tag">Contabilidade</span>
                    <span className="sd-mx-exp-tag">Contencioso</span>
                  </>
                ) : (
                  <>
                    <span className="sd-mx-exp-tag">Copropriété</span>
                    <span className="sd-mx-exp-tag">Droit ALUR / ELAN</span>
                    <span className="sd-mx-exp-tag">Réglementation</span>
                    <span className="sd-mx-exp-tag">Comptabilité</span>
                    <span className="sd-mx-exp-tag">Contentieux</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="sd-mx-banner-right">
            <div className="sd-mx-stat">
              <div className="sd-mx-stat-num">{maxMessages.length}</div>
              <div className="sd-mx-stat-lbl">Messages</div>
            </div>
            <div className="sd-mx-stat">
              <div className="sd-mx-stat-num">∞</div>
              <div className="sd-mx-stat-lbl">{locale === 'pt' ? 'Disponível' : 'Disponible'}</div>
            </div>
            <button
              className="sd-mx-clear"
              onClick={() => { const cleared = [{ role: 'assistant' as const, content: t('syndicDash.ai.cleared') }]; setMaxMessages(cleared); try { localStorage.setItem(`fixit_max_history_${userId}`, JSON.stringify(cleared)) } catch {} }}
              title={locale === 'pt' ? 'Nova conversa' : 'Nouvelle conversation'}
              aria-label={locale === 'pt' ? 'Nova conversa' : 'Nouvelle conversation'}
            >✕</button>
          </div>
        </div>

        {/* ── Tab Bar (Chat / Conformité / Documents) ── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--sd-border)', marginBottom: 0, background: '#fff' }}>
          {([
            { id: 'chat' as const, icon: '💬', label: locale === 'pt' ? 'Consultor' : 'Consultant' },
            { id: 'conformite' as const, icon: '✅', label: locale === 'pt' ? 'Conformidade' : 'Conformité' },
            { id: 'documents' as const, icon: '📄', label: locale === 'pt' ? 'Documentos' : 'Documents' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setMaxTab(tab.id)}
              style={{
                flex: 1, padding: '12px 8px', fontSize: 13, fontWeight: maxTab === tab.id ? 600 : 400,
                color: maxTab === tab.id ? 'var(--sd-gold)' : 'var(--sd-ink-3)',
                borderBottom: maxTab === tab.id ? '2px solid var(--sd-gold)' : '2px solid transparent',
                background: 'transparent', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════
            TAB: CHAT (Consultant)
        ═══════════════════════════════════════════════════════ */}
        {maxTab === 'chat' && (
          <>
            {/* ── Sélecteur immeuble contextuel ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderBottom: '1px solid var(--sd-border)', background: 'var(--sd-cream)' }}>
              <span style={{ fontSize: 11, color: 'var(--sd-ink-3)', fontWeight: 500 }}>🏢 {locale === 'pt' ? 'Contexto' : 'Contexte'} :</span>
              <select
                value={maxSelectedImmeuble}
                onChange={e => setMaxSelectedImmeuble(e.target.value)}
                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--sd-border)', background: '#fff', color: 'var(--sd-navy)', fontFamily: "var(--font-outfit), 'Outfit', sans-serif", cursor: 'pointer' }}
              >
                <option value="all">{locale === 'pt' ? 'Todos os edifícios' : 'Tous les immeubles'}</option>
                {immeubles.map(i => <option key={i.nom} value={i.nom}>{i.nom}</option>)}
              </select>
            </div>

            {/* ── Messages Area ── */}
            <div className="sd-mx-messages">
              {maxMessages.map((msg, i) => (
                msg.role === 'assistant' ? (() => {
                  const { text: msgText, docData } = parseDocPDF(msg.content)
                  return (
                  <div key={i} className="sd-mx-msg-max">
                    <div className="sd-mx-msg-av"><MaxAvatar size={34} /></div>
                    <div className="sd-mx-msg-inner">
                      <div className="sd-mx-msg-label">Max <span></span> {locale === 'pt' ? 'Consultor Especialista IA' : 'Expert-Conseil IA'}</div>
                      <div className="sd-mx-msg-bubble" suppressHydrationWarning>
                        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(msgText) }} />
                      </div>
                      {/* ── Copy + Fixy + PDF action buttons ── */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => { navigator.clipboard.writeText(msgText); }}
                          style={{ fontSize: 11, color: 'var(--sd-ink-3)', background: 'transparent', border: '1px solid var(--sd-border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', transition: 'all 0.15s' }}
                          title={locale === 'pt' ? 'Copiar' : 'Copier'}
                        >📋 {locale === 'pt' ? 'Copiar' : 'Copier'}</button>
                        <button
                          onClick={() => { setFixyPanelOpen(true); }}
                          style={{ fontSize: 11, color: 'var(--sd-gold)', background: 'transparent', border: '1px solid var(--sd-gold)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', transition: 'all 0.15s' }}
                          title={locale === 'pt' ? 'Enviar ao Fixy para executar' : 'Envoyer à Fixy pour exécuter'}
                        >🤖 {locale === 'pt' ? 'Fixy →' : 'Fixy →'}</button>
                        {docData && (
                          <button
                            onClick={() => {
                              setPendingDocData(docData as DocPDFData)
                              setPdfObjet(docData.objet || '')
                              if (docData.destinataire?.immeuble) {
                                const match = immeubles.find(im => im.nom.toLowerCase().includes((docData.destinataire!.immeuble as string).toLowerCase()))
                                setPdfSelectedImmeuble(match ? match.nom : '')
                              } else {
                                setPdfSelectedImmeuble(immeubles.length === 1 ? immeubles[0].nom : '')
                              }
                              setPdfSelectedCopro(null)
                              setShowPdfModal(true)
                            }}
                            style={{ fontSize: 11, color: '#ffffff', background: '#0D1B2E', border: '1px solid #0D1B2E', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600 }}
                            title={locale === 'pt' ? 'Descarregar PDF oficial' : 'Télécharger le PDF officiel'}
                          >📄 {locale === 'pt' ? 'Descarregar PDF' : 'Télécharger PDF'}</button>
                        )}
                      </div>
                    </div>
                  </div>
                  )
                })() : (
                  <div key={i} className="sd-mx-msg-user">
                    <div className="sd-mx-msg-user-inner">
                      <div className="sd-mx-msg-user-bubble">{msg.content}</div>
                      <button
                        onClick={() => {
                          if (!maxFavorites.includes(msg.content)) {
                            const newFavs = [...maxFavorites, msg.content]
                            setMaxFavorites(newFavs)
                            try { localStorage.setItem(`fixit_max_favorites_${userId}`, JSON.stringify(newFavs)) } catch {}
                          }
                        }}
                        style={{ fontSize: 10, color: maxFavorites.includes(msg.content) ? 'var(--sd-gold)' : 'var(--sd-ink-3)', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0, textAlign: 'right' as const, width: '100%' }}
                        title={locale === 'pt' ? 'Guardar como favorito' : 'Enregistrer en favori'}
                      >{maxFavorites.includes(msg.content) ? '⭐' : '☆'} {locale === 'pt' ? 'Favorito' : 'Favori'}</button>
                    </div>
                  </div>
                )
              ))}

              {maxLoading && (
                <div className="sd-mx-typing">
                  <div className="sd-mx-msg-av"><MaxAvatar size={34} /></div>
                  <div className="sd-mx-typing-bubble">
                    <div className="sd-mx-tdot" />
                    <div className="sd-mx-tdot" />
                    <div className="sd-mx-tdot" />
                    <span style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginLeft: 8 }}>{locale === 'pt' ? 'Max a analisar...' : 'Max analyse...'}</span>
                  </div>
                </div>
              )}
              <div ref={maxEndRef} />
            </div>

            {/* ── Ornamental Separator ── */}
            <div className="sd-mx-orn">
              <div className="sd-mx-orn-line" />
              <div className="sd-mx-orn-diamond">◆ ◆ ◆</div>
              <div className="sd-mx-orn-line" />
            </div>

            {/* ── Dynamic + Static Pills ── */}
            <div className="sd-mx-pills">
              {/* Dynamic context pills based on real data */}
              {(() => {
                const ctx = buildSyndicContext()
                const dynamicPills: { icon: string; text: string; priority: boolean }[] = []
                const rcExpired = ctx.artisans.filter(a => !a.rcProValide)
                if (rcExpired.length > 0) dynamicPills.push({ icon: '🔴', text: locale === 'pt' ? `${rcExpired.length} RC Pro expirado(s) — que fazer?` : `${rcExpired.length} RC Pro expirée(s) — que faire ?`, priority: true })
                const urgentMissions = ctx.missions.filter(m => m.priorite === 'urgente' && m.statut !== 'terminee')
                if (urgentMissions.length > 0) dynamicPills.push({ icon: '⚡', text: locale === 'pt' ? `${urgentMissions.length} missão(ões) urgente(s) — prioridades?` : `${urgentMissions.length} mission(s) urgente(s) — priorités ?`, priority: true })
                const overBudget = ctx.immeubles.filter(i => i.budgetAnnuel > 0 && i.depensesAnnee / i.budgetAnnuel > 0.85)
                if (overBudget.length > 0) dynamicPills.push({ icon: '💸', text: locale === 'pt' ? `Orçamento ${overBudget[0].nom} a ${Math.round(overBudget[0].depensesAnnee / overBudget[0].budgetAnnuel * 100)}%` : `Budget ${overBudget[0].nom} à ${Math.round(overBudget[0].depensesAnnee / overBudget[0].budgetAnnuel * 100)}%`, priority: true })
                const highAlerts = ctx.alertes.filter(a => a.urgence === 'haute')
                if (highAlerts.length > 0) dynamicPills.push({ icon: '🚨', text: locale === 'pt' ? `${highAlerts.length} alerta(s) urgente(s) — análise` : `${highAlerts.length} alerte(s) urgente(s) — analyse`, priority: true })
                return dynamicPills.map(p => (
                  <button key={p.text} className="sd-mx-qpill" style={{ border: '1px solid var(--sd-red)', color: 'var(--sd-red)', background: 'var(--sd-red-soft)' }} onClick={() => sendMaxMessage(p.text)}>
                    <span>{p.icon}</span> {p.text}
                  </button>
                ))
              })()}
              {/* Favorites pills */}
              {maxFavorites.map(fav => (
                <button key={fav} className="sd-mx-qpill" style={{ border: '1px solid var(--sd-gold)', background: 'var(--sd-gold-dim)' }} onClick={() => sendMaxMessage(fav)}>
                  <span>⭐</span> {fav}
                </button>
              ))}
              {/* Static pills */}
              {[
                { icon: '⚖️', text: t('syndicDash.ai.pillAG') },
                { icon: '🏗', text: t('syndicDash.ai.pillDPE') },
                { icon: '💶', text: t('syndicDash.ai.pillCharges') },
                { icon: '🔧', text: t('syndicDash.ai.pillElevator') },
                { icon: '📋', text: t('syndicDash.ai.pillFormalNotice') },
                { icon: '📜', text: t('syndicDash.ai.pillALUR') },
                { icon: '⚔️', text: t('syndicDash.ai.pillRecovery') },
              ].map(s => (
                <button
                  key={s.text}
                  className="sd-mx-qpill"
                  onClick={() => sendMaxMessage(s.text)}
                >
                  <span>{s.icon}</span> {s.text}
                </button>
              ))}
            </div>

            {/* ── Compose ── */}
            <div className="sd-mx-compose">
              <div className="sd-mx-compose-box">
                <textarea
                  id="max-input"
                  className="sd-mx-compose-input"
                  value={maxInput}
                  onChange={e => setMaxInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && !maxLoading) { e.preventDefault(); sendMaxMessage() }
                  }}
                  placeholder={locale === 'pt' ? 'Faça uma pergunta jurídica, técnica ou contabilística ao Max…' : 'Posez une question juridique, technique ou comptable à Max…'}
                  rows={1}
                  disabled={maxLoading}
                  onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 150) + 'px'; }}
                />
                <button
                  className="sd-mx-compose-send"
                  onClick={() => sendMaxMessage()}
                  disabled={maxLoading || !maxInput.trim()}
                >
                  {maxLoading ? (
                    <span style={{ width: 16, height: 16, border: '2px solid var(--sd-navy)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  ) : '↑'}
                </button>
              </div>
              <div className="sd-mx-compose-foot">
                <span className="sd-mx-compose-hint">{t('syndicDash.ai.maxHint')} <strong>Fixy</strong></span>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB: CONFORMITÉ (Checklist)
        ═══════════════════════════════════════════════════════ */}
        {maxTab === 'conformite' && (
          <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy)', margin: 0 }}>
                  {locale === 'pt' ? '✅ Checklist de Conformidade' : '✅ Checklist de Conformité'}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--sd-ink-3)', marginTop: 4 }}>
                  {locale === 'pt' ? 'Análise automática do estado do gabinete' : 'Analyse automatique de l\'état du cabinet'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(() => {
                  const checks = buildConformiteChecklist()
                  const ok = checks.filter(c => c.status === 'ok').length
                  const warn = checks.filter(c => c.status === 'warning').length
                  const err = checks.filter(c => c.status === 'error').length
                  return (
                    <>
                      <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--sd-teal-soft)', color: 'var(--sd-teal)', fontWeight: 600 }}>✅ {ok}</span>
                      {warn > 0 && <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--sd-amber-soft)', color: 'var(--sd-amber)', fontWeight: 600 }}>⚠️ {warn}</span>}
                      {err > 0 && <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--sd-red-soft)', color: 'var(--sd-red)', fontWeight: 600 }}>❌ {err}</span>}
                    </>
                  )
                })()}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {buildConformiteChecklist().map(check => (
                <div
                  key={check.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                    background: '#fff', borderRadius: 10, border: `1px solid ${check.status === 'error' ? 'var(--sd-red)' : check.status === 'warning' ? 'var(--sd-amber)' : 'var(--sd-border)'}`,
                    boxShadow: check.status === 'error' ? '0 0 0 1px rgba(192,57,43,0.1)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                    {check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️' : check.status === 'error' ? '❌' : 'ℹ️'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy)' }}>{check.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-2)', marginTop: 2 }}>{check.detail}</div>
                    {check.action && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button
                          onClick={() => { setMaxTab('chat'); sendMaxMessage(locale === 'pt' ? `Analisa o problema: ${check.label}. ${check.detail}` : `Analyse le problème : ${check.label}. ${check.detail}`) }}
                          style={{ fontSize: 11, color: 'var(--sd-navy)', background: 'var(--sd-cream)', border: '1px solid var(--sd-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}
                        >🎓 {locale === 'pt' ? 'Perguntar ao Max' : 'Demander à Max'}</button>
                        <button
                          onClick={() => setFixyPanelOpen(true)}
                          style={{ fontSize: 11, color: 'var(--sd-gold)', background: 'var(--sd-gold-dim)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}
                        >🤖 {locale === 'pt' ? 'Fixy → ação' : 'Fixy → action'}</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Score global */}
            <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--sd-navy)', borderRadius: 12, color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>
                    {locale === 'pt' ? 'Pontuação de conformidade' : 'Score de conformité'}
                  </div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, fontWeight: 400, color: 'var(--sd-gold)', marginTop: 4 }}>
                    {(() => {
                      const checks = buildConformiteChecklist()
                      const scored = checks.filter(c => c.status !== 'info')
                      const ok = scored.filter(c => c.status === 'ok').length
                      return scored.length > 0 ? Math.round(ok / scored.length * 100) : 100
                    })()}%
                  </div>
                </div>
                <button
                  onClick={() => { setMaxTab('chat'); sendMaxMessage(locale === 'pt' ? 'Faz uma análise completa da conformidade do meu gabinete e recomendações prioritárias' : 'Fais une analyse complète de la conformité de mon cabinet et recommandations prioritaires') }}
                  style={{ fontSize: 12, color: 'var(--sd-navy)', background: 'var(--sd-gold)', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontWeight: 600, fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
                >🎓 {locale === 'pt' ? 'Análise detalhada Max' : 'Analyse détaillée Max'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB: DOCUMENTS (Générateur)
        ═══════════════════════════════════════════════════════ */}
        {maxTab === 'documents' && (
          <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy)', margin: 0 }}>
                {locale === 'pt' ? '📄 Gerador de Documentos' : '📄 Générateur de Documents'}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--sd-ink-3)', marginTop: 4 }}>
                {locale === 'pt' ? 'Max gera modelos prontos a usar adaptados à legislação portuguesa' : 'Max génère des modèles prêts à l\'emploi adaptés à la législation française'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              {(locale === 'pt' ? [
                { icon: '📩', title: 'Convocatória AG', desc: 'Art.º 1432.º CC — convocatória assembleia geral', prompt: 'Gera um modelo completo de convocatória para Assembleia Geral de condomínio, com todos os elementos obrigatórios segundo o Art.º 1432.º do Código Civil e Lei 8/2022' },
                { icon: '📝', title: 'Ata de AG', desc: 'Modelo de ata assembleia geral', prompt: 'Gera um modelo completo de ata de Assembleia Geral de condomínio, incluindo deliberações, votações por maioria (Art.º 1432.º/1433.º CC)' },
                { icon: '⚠️', title: 'Notificação formal', desc: 'Cobrança de quotas em atraso', prompt: 'Gera um modelo de notificação formal para cobrança de quotas de condomínio em atraso, com prazo e referência legal (Art.º 310.º CC prescrição 5 anos)' },
                { icon: '📋', title: 'Contrato manutenção', desc: 'Elevador, limpeza, jardim', prompt: 'Gera um modelo de contrato de manutenção para condomínio (elevador/limpeza/jardim), com cláusulas obrigatórias, SLA e penalizações' },
                { icon: '📊', title: 'Declaração de encargos', desc: 'Lei 8/2022 — obrigatória', prompt: 'Gera um modelo de declaração anual de encargos de condomínio conforme exigido pela Lei 8/2022 (regime do condomínio)' },
                { icon: '📜', title: 'Regulamento condomínio', desc: 'Modelo de regulamento interno', prompt: 'Gera um modelo de regulamento interno de condomínio conforme a Lei 8/2022 e Código Civil' },
                { icon: '🔧', title: 'Ordem de serviço', desc: 'Para artesão/prestador', prompt: 'Gera um modelo de ordem de serviço para artesão/prestador de serviços em condomínio, com escopo, prazo, valor e condições' },
                { icon: '💰', title: 'Orçamento previsional', desc: 'Modelo para AG aprovação', prompt: 'Gera um modelo de orçamento previsional para condomínio, com rubricas obrigatórias, fundo de reserva (≥10% DL 268/94), e formato para aprovação em AG' },
              ] : [
                { icon: '📩', title: 'Convocation AG', desc: 'Art. 9-1 décret 17/03/1967 — délai 21 jours minimum', prompt: 'Génère un modèle complet de convocation d\'Assemblée Générale de copropriété conforme au droit français. Mentions obligatoires : lieu, date, heure, ordre du jour détaillé (art. 9 et 9-1 décret n°67-223 du 17/03/1967), délai d\'envoi 21 jours minimum (art. 9 al. 2 modifié par loi ALUR 2014), notification par LRAR ou remise contre émargement (art. 64 décret 1967), joindre documents annexes obligatoires (art. 11 décret 1967 : comptes, budget prévisionnel, devis travaux). Prévoir les pouvoirs/mandats de représentation (art. 22 loi 10/07/1965). Indiquer les règles de majorité applicables (art. 24/25/25-1/26 loi 1965).' },
                { icon: '📝', title: 'PV d\'Assemblée', desc: 'Art. 17 décret 1967 — procès-verbal AG', prompt: 'Génère un modèle complet de procès-verbal d\'Assemblée Générale de copropriété conforme au droit français. Éléments obligatoires : date, lieu, feuille de présence (art. 14 décret 1967), constat du quorum, désignation président de séance/scrutateurs/secrétaire (art. 15 décret 1967), résumé des délibérations, texte exact de chaque résolution et résultat du vote avec majorité appliquée (art. 24 majorité simple, art. 25 majorité absolue, art. 25-1 passerelle, art. 26 double majorité, unanimité — loi 10/07/1965). Mentionner les noms et tantièmes des opposants et abstentionnistes (art. 17 décret 1967). Signature du président, scrutateurs et secrétaire. Notification aux absents et opposants dans le mois (art. 42 al. 2 loi 1965, délai contestation 2 mois).' },
                { icon: '⚠️', title: 'Mise en demeure', desc: 'Art. 19 loi 1965 — recouvrement charges impayées', prompt: 'Génère un modèle de mise en demeure pour charges de copropriété impayées conforme au droit français. Référencer : art. 19 loi n°65-557 du 10/07/1965 (solidarité des charges, privilège immobilier spécial du syndicat), art. 19-1 loi 1965 (les frais de recouvrement sont à la charge du débiteur), art. 19-2 loi 1965 (hypothèque légale du syndicat). Mentionner : détail des charges dues (provisionnelles et arrêtées), période concernée, montant total, délai de régularisation (8 à 15 jours), intérêts de retard (taux légal), conséquences en cas de non-paiement (procédure d\'injonction de payer tribunal judiciaire, art. 1405 CPC, ou saisie immobilière). Envoyer par LRAR.' },
                { icon: '📋', title: 'Contrat maintenance', desc: 'Art. 18 loi 1965 — obligation du syndic', prompt: 'Génère un modèle de contrat de maintenance pour copropriété (ascenseur/nettoyage/espaces verts) conforme au droit français. Le syndic est tenu d\'assurer la conservation de l\'immeuble (art. 18 loi 10/07/1965). Inclure : objet et périmètre de la prestation, durée et conditions de renouvellement, obligations de résultat/moyens, SLA et délais d\'intervention, pénalités de retard, montant et révision de prix (indexation), assurances du prestataire (RC Pro, décennale si applicable), clause de résiliation. Pour les ascenseurs spécifiquement : référencer le décret n°2004-964 du 09/09/2004 (contrôle technique quinquennal obligatoire), décret n°2012-674 (entretien). Mise en concurrence obligatoire si > seuil fixé en AG (art. 21 loi 1965, art. 19-2 décret 1967).' },
                { icon: '📊', title: 'Budget prévisionnel', desc: 'Art. 14-1 loi 1965 + fonds travaux ALUR', prompt: 'Génère un modèle de budget prévisionnel de copropriété conforme au droit français. Budget voté en AG (art. 14-1 loi 10/07/1965, majorité art. 24). Postes obligatoires : charges générales (entretien parties communes, assurance MRI, honoraires syndic, frais bancaires) et charges spéciales (ascenseur, chauffage collectif — art. 10 al. 1 et 2 loi 1965, répartition selon utilité). Fonds de travaux obligatoire : cotisation ≥5% du budget prévisionnel (art. 14-2 loi 1965 modifié par loi ALUR 2014, obligatoire copros >10 lots). Appels de fonds trimestriels : provisions exigibles au 1er jour de chaque trimestre (art. 14-1 al. 2). Prévoir comparatif N-1/N, écart budget/réalisé. Régularisation annuelle des charges (art. 18-2 loi 1965).' },
                { icon: '📜', title: 'Règlement copropriété', desc: 'Art. 8 loi 1965 — loi ELAN/ALUR', prompt: 'Génère un modèle de règlement intérieur de copropriété conforme au droit français. Fondement : art. 8 loi n°65-557 du 10/07/1965 (le règlement de copropriété détermine la destination des parties privatives et communes, les conditions de leur jouissance). Inclure : description de l\'immeuble et répartition lots/tantièmes (état descriptif de division), distinction parties communes générales/spéciales (art. 3 et 6-2 loi 1965 modifié par loi ELAN 2018), destination de l\'immeuble (habitation/mixte/commercial), règles de jouissance des parties privatives et communes, répartition des charges (art. 10 loi 1965), clause d\'habitation bourgeoise si applicable. Mise en conformité obligatoire avec loi ELAN avant le 23/11/2021 (art. 209 II loi ELAN — actualisation de la répartition des tantièmes).' },
                { icon: '🔧', title: 'Ordre de mission', desc: 'Art. 18 loi 1965 — travaux urgents', prompt: 'Génère un modèle d\'ordre de mission/bon de commande pour artisan ou prestataire intervenant en copropriété, conforme au droit français. Le syndic peut engager des travaux urgents nécessaires à la sauvegarde de l\'immeuble sans vote AG (art. 18 al. 2 loi 10/07/1965). Au-delà du seuil voté en AG, mise en concurrence obligatoire (art. 21 loi 1965, art. 19-2 décret 1967). Inclure : identification des parties (syndicat des copropriétaires / prestataire), description précise des travaux, localisation dans l\'immeuble, délai d\'exécution, montant HT et TTC (TVA 10% travaux rénovation ou 20% standard, art. 279-0 bis CGI), conditions de paiement, garanties (décennale, biennale — art. 1792 et 1792-3 Code civil, loi Spinetta 04/01/1978), réception des travaux (art. 1792-6 Code civil).' },
                { icon: '💰', title: 'Appel de charges', desc: 'Art. 14-1 loi 1965 — appel trimestriel', prompt: 'Génère un modèle d\'appel de charges trimestriel pour copropriété conforme au droit français. Fondement : les provisions sont exigibles le 1er jour de chaque trimestre (art. 14-1 al. 2 loi 10/07/1965). Détailler : charges générales (quote-part selon tantièmes généraux, art. 10 al. 1 loi 1965), charges spéciales (répartition selon utilité, art. 10 al. 2), cotisation fonds de travaux (art. 14-2 loi ALUR, ≥5% du budget prévisionnel). Mentionner le budget voté en AG (date et n° résolution), le montant annuel total du copropriétaire, le 1/4 trimestriel, l\'éventuel solde créditeur/débiteur de la régularisation N-1 (art. 18-2 loi 1965). Inclure RIB du syndicat et date limite de paiement. Rappeler que les intérêts de retard courent sans mise en demeure préalable si le règlement le prévoit (art. 36 décret 1967).' },
              ]).map(doc => (
                <button
                  key={doc.title}
                  onClick={() => { setMaxTab('chat'); sendMaxMessage(doc.prompt) }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', textAlign: 'left' as const,
                    background: '#fff', borderRadius: 10, border: '1px solid var(--sd-border)', cursor: 'pointer',
                    transition: 'all 0.15s', fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--sd-gold)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(201,168,76,0.15)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--sd-border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{doc.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy)' }}>{doc.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>{doc.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
