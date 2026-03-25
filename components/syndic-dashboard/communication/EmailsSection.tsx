'use client'

import { useState, useEffect } from 'react'
import type { EmailAnalysed } from '../types'
import { TYPE_EMAIL_CONFIG } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function EmailsSection({ syndicId, onNavigateParams }: { syndicId: string; onNavigateParams: () => void }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const [emails, setEmails] = useState<EmailAnalysed[]>([])
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [filterUrgence, setFilterUrgence] = useState<'' | 'haute' | 'moyenne' | 'basse'>('')
  const [filterType, setFilterType] = useState('')
  const [filterStatut, setFilterStatut] = useState<'' | 'nouveau' | 'traite' | 'archive'>('')
  const [selectedEmail, setSelectedEmail] = useState<EmailAnalysed | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'liste' | 'rapport'>('liste')
  // Response validation state
  const [draftResponse, setDraftResponse] = useState('')
  const [sendingResponse, setSendingResponse] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState('')

  const loadEmails = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ syndic_id: syndicId, limit: '100' })
      if (filterUrgence) params.set('urgence', filterUrgence)
      if (filterStatut) params.set('statut', filterStatut)
      const res = await fetch(`/api/email-agent/poll?${params}`)
      const data = await res.json()
      setEmails(data.emails || [])
    } catch {
      // Table probablement pas encore créée — afficher état vide
      setEmails([])
    }
    setLoading(false)
  }

  useEffect(() => { loadEmails() }, [filterUrgence, filterStatut])

  const handlePoll = async () => {
    setPolling(true)
    try {
      await fetch('/api/email-agent/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syndic_id: syndicId }),
      })
      await loadEmails()
    } catch {}
    setPolling(false)
  }

  const handleAction = async (emailId: string, action: string, note?: string) => {
    await fetch('/api/email-agent/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_id: emailId, syndic_id: syndicId, action, note }),
    })
    setSelectedEmail(null)
    await loadEmails()
  }

  const handleSendResponse = async () => {
    if (!selectedEmail || !draftResponse.trim() || sendingResponse) return
    setSendingResponse(true)
    setSendError('')
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const res = await fetch('/api/email-agent/send-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          email_id: selectedEmail.id,
          response_text: draftResponse.trim(),
          syndic_id: syndicId,
        }),
      })
      if (res.ok) {
        setSendSuccess(true)
        setTimeout(() => {
          setSendSuccess(false)
          setSelectedEmail(null)
          setDraftResponse('')
          loadEmails()
        }, 2000)
      } else {
        const data = await res.json().catch(() => ({}))
        setSendError(data.error || 'Erreur lors de l\'envoi')
      }
    } catch {
      setSendError('Erreur réseau')
    } finally {
      setSendingResponse(false)
    }
  }

  const filtered = emails.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !search || [e.subject, e.from_email, e.from_name, e.resume_ia, e.immeuble_detecte || '', e.locataire_detecte || ''].some(v => v.toLowerCase().includes(q))
    const matchType = !filterType || e.type_demande === filterType
    return matchSearch && matchType
  })

  // Stats pour le rapport
  const stats = {
    total: emails.length,
    nouveaux: emails.filter(e => e.statut === 'nouveau').length,
    urgents: emails.filter(e => e.urgence === 'haute' && e.statut === 'nouveau').length,
    traites: emails.filter(e => e.statut === 'traite').length,
    byType: Object.keys(TYPE_EMAIL_CONFIG).map(type => ({
      type, count: emails.filter(e => e.type_demande === type).length,
      ...TYPE_EMAIL_CONFIG[type]
    })).filter(t => t.count > 0),
  }

  const URGENCE_CONFIG = {
    haute:   { emoji: '🔴', label: 'Urgente',  color: 'bg-red-100 text-red-700 border-red-200' },
    moyenne: { emoji: '🟡', label: 'Moyenne',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
    basse:   { emoji: '🟢', label: 'Basse',    color: 'bg-green-100 text-green-700 border-green-200' },
  }

  const STATUT_CONFIG = {
    nouveau:      { label: 'Nouveau',      color: 'bg-blue-100 text-blue-700' },
    traite:       { label: 'Traité',       color: 'bg-green-100 text-green-700' },
    archive:      { label: 'Archivé',      color: 'bg-[#F7F4EE] text-gray-500' },
    mission_cree: { label: 'Mission créée', color: 'bg-[#F7F4EE] text-[#C9A84C]' },
    repondu:      { label: 'Répondu',      color: 'bg-emerald-100 text-emerald-700' },
  } as Record<string, { label: string; color: string }>

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-gray-500 text-sm">
            Analyse IA de votre boîte email · <span className="font-semibold text-gray-700">{stats.total} emails</span>
            {stats.urgents > 0 && <span className="ml-2 font-bold text-red-600">· {stats.urgents} urgent{stats.urgents > 1 ? 's' : ''} non traité{stats.urgents > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#F7F4EE] rounded-lg p-1 gap-1">
            <button onClick={() => setActiveTab('liste')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'liste' ? 'bg-white shadow text-[#0D1B2E]' : 'text-gray-500 hover:text-gray-700'}`}>
              📋 Liste
            </button>
            <button onClick={() => setActiveTab('rapport')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'rapport' ? 'bg-white shadow text-[#0D1B2E]' : 'text-gray-500 hover:text-gray-700'}`}>
              📊 Rapport
            </button>
          </div>
          <button onClick={handlePoll} disabled={polling}
            className="flex items-center gap-2 bg-[#0D1B2E] hover:bg-[#152338] text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60">
            {polling ? <span className="animate-spin">⟳</span> : '⟳'} Analyser maintenant
          </button>
        </div>
      </div>

      {/* ── Bandeau si Gmail non connecté ── */}
      {!loading && emails.length === 0 && (
        <div className="bg-gradient-to-r from-[#F7F4EE] to-[#F7F4EE] border-2 border-[#E4DDD0] rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">📧</div>
          <h3 className="text-lg font-bold text-[#0D1B2E] mb-2">Connectez votre boîte Gmail</h3>
          <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto">
            Fixy analysera automatiquement tous vos emails entrants — urgences, types de demandes, suggestions d'actions et brouillons de réponse.
          </p>
          <button onClick={onNavigateParams}
            className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-6 py-2.5 rounded-lg font-semibold transition inline-flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="white" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
            </svg>
            Connecter Gmail dans les Paramètres
          </button>
        </div>
      )}

      {activeTab === 'liste' && (
        <>
          {/* ── Stats rapides ── */}
          {emails.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Non traités', nb: stats.nouveaux, emoji: '📬', color: 'bg-blue-50 border-blue-200' },
                { label: 'Urgents',     nb: stats.urgents,  emoji: '🔴', color: stats.urgents > 0 ? 'bg-red-50 border-red-300' : 'bg-[#F7F4EE] border-gray-200' },
                { label: 'Traités',     nb: stats.traites,  emoji: '✅', color: 'bg-green-50 border-green-200' },
                { label: 'Total',       nb: stats.total,    emoji: '📧', color: 'bg-[#F7F4EE] border-[#E4DDD0]' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border-2 p-3 ${s.color}`}>
                  <div className="text-xl mb-0.5">{s.emoji}</div>
                  <div className="text-xl font-bold text-[#0D1B2E]">{s.nb}</div>
                  <div className="text-xs text-gray-600">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Filtres ── */}
          {emails.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex flex-wrap gap-3">
                {/* Recherche */}
                <div className="relative flex-1 min-w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher dans les emails..."
                    className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
                {/* Urgence */}
                <select value={filterUrgence} onChange={e => setFilterUrgence(e.target.value as any)}
                  className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                  <option value="">Toutes urgences</option>
                  <option value="haute">🔴 Urgente</option>
                  <option value="moyenne">🟡 Moyenne</option>
                  <option value="basse">🟢 Basse</option>
                </select>
                {/* Type */}
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                  <option value="">Tous types</option>
                  {Object.entries(TYPE_EMAIL_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.emoji} {v.label}</option>
                  ))}
                </select>
                {/* Statut */}
                <select value={filterStatut} onChange={e => setFilterStatut(e.target.value as any)}
                  className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                  <option value="">Tous statuts</option>
                  <option value="nouveau">📬 Nouveaux</option>
                  <option value="traite">✅ Traités</option>
                  <option value="repondu">📧 Répondus</option>
                  <option value="archive">📦 Archivés</option>
                </select>
                {/* Compteur */}
                <div className="flex items-center text-sm text-gray-500 ml-auto">
                  <span className="font-semibold text-[#C9A84C]">{filtered.length}</span>&nbsp;email{filtered.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}

          {/* ── Liste emails ── */}
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="text-4xl mb-3 animate-pulse">📧</div>
              <p className="text-gray-500">Chargement des emails...</p>
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map(email => {
                const urg = URGENCE_CONFIG[email.urgence]
                const typeCfg = TYPE_EMAIL_CONFIG[email.type_demande] || TYPE_EMAIL_CONFIG.autre
                const statutCfg = STATUT_CONFIG[email.statut] || STATUT_CONFIG.nouveau
                const isNew = email.statut === 'nouveau'

                return (
                  <div key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`bg-white rounded-xl shadow-sm border-2 p-4 cursor-pointer hover:border-[#C9A84C] transition ${
                      email.urgence === 'haute' && isNew ? 'border-red-200 bg-red-50/30' : isNew ? 'border-blue-100' : 'border-gray-100'
                    }`}>
                    <div className="flex items-start justify-between gap-3">
                      {/* Gauche */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Badge urgence */}
                        <div className={`flex-shrink-0 mt-0.5 text-lg`}>{urg.emoji}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${urg.color}`}>{urg.label}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeCfg.color}`}>{typeCfg.emoji} {typeCfg.label}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statutCfg.color}`}>{statutCfg.label}</span>
                          </div>
                          <p className={`text-sm font-semibold text-[#0D1B2E] truncate ${isNew ? '' : 'opacity-70'}`}>{email.subject}</p>
                          <p className="text-xs text-[#C9A84C] font-medium mt-0.5 truncate">💡 {email.resume_ia || 'Analyse en cours...'}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>✉️ {email.from_name || email.from_email}</span>
                            {email.immeuble_detecte && <span>🏢 {email.immeuble_detecte}</span>}
                            {email.locataire_detecte && <span>👤 {email.locataire_detecte}</span>}
                          </div>
                        </div>
                      </div>
                      {/* Date */}
                      <div className="text-xs text-gray-500 flex-shrink-0 mt-1 text-right">
                        <p>{new Date(email.received_at).toLocaleDateString(dateFmtLocale, { day: '2-digit', month: 'short' })}</p>
                        <p>{new Date(email.received_at).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    {/* Actions rapides */}
                    {isNew && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                        {email.urgence === 'haute' && (
                          <button onClick={() => handleAction(email.id, 'creer_mission')}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium transition">
                            🚨 Créer mission urgente
                          </button>
                        )}
                        <button onClick={() => handleAction(email.id, 'marquer_traite')}
                          className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg font-medium transition">
                          ✅ Marquer traité
                        </button>
                        <button onClick={() => handleAction(email.id, 'archiver')}
                          className="text-xs bg-[#F7F4EE] hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium transition">
                          📦 Archiver
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : emails.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
              <div className="text-4xl mb-3">🔍</div>
              <p>Aucun email ne correspond aux filtres</p>
            </div>
          ) : null}
        </>
      )}

      {activeTab === 'rapport' && (
        <div className="space-y-4">
          {emails.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
              <div className="text-4xl mb-3">📊</div>
              <p>Aucune donnée — connectez Gmail pour générer des rapports</p>
            </div>
          ) : (
            <>
              {/* Rapport synthèse */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total analysés',  nb: stats.total,    emoji: '📧', color: 'bg-[#F7F4EE] border-[#E4DDD0]' },
                  { label: 'Non traités',      nb: stats.nouveaux, emoji: '📬', color: 'bg-blue-50 border-blue-200' },
                  { label: '🔴 Urgents',        nb: stats.urgents,  emoji: '🔴', color: stats.urgents > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200' },
                  { label: 'Traités',          nb: stats.traites,  emoji: '✅', color: 'bg-green-50 border-green-200' },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl border-2 p-5 ${s.color}`}>
                    <div className="text-3xl mb-2">{s.emoji}</div>
                    <div className="text-3xl font-bold text-[#0D1B2E]">{s.nb}</div>
                    <div className="text-sm text-gray-600 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Répartition par type */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-[#0D1B2E] mb-4">Répartition par type de demande</h3>
                <div className="space-y-2">
                  {stats.byType.sort((a, b) => b.count - a.count).map(t => (
                    <div key={t.type} className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full w-40 text-center ${t.color}`}>
                        {t.emoji} {t.label}
                      </span>
                      <div className="flex-1 bg-[#F7F4EE] rounded-full h-3">
                        <div className="bg-[#F7F4EE]0 h-3 rounded-full transition-all"
                          style={{ width: `${stats.total > 0 ? (t.count / stats.total) * 100 : 0}%` }} />
                      </div>
                      <span className="text-sm font-bold text-gray-700 w-8 text-right">{t.count}</span>
                      <span className="text-xs text-gray-500 w-10">({stats.total > 0 ? Math.round((t.count / stats.total) * 100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Emails urgents non traités */}
              {emails.filter(e => e.urgence === 'haute' && e.statut === 'nouveau').length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border-2 border-red-200 p-6">
                  <h3 className="font-bold text-red-700 mb-4">🚨 Emails urgents à traiter en priorité</h3>
                  <div className="space-y-2">
                    {emails.filter(e => e.urgence === 'haute' && e.statut === 'nouveau').map(email => (
                      <div key={email.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100"
                        onClick={() => setSelectedEmail(email)}>
                        <div className="flex-1 min-w-0 cursor-pointer">
                          <p className="text-sm font-semibold text-[#0D1B2E] truncate">{email.subject}</p>
                          <p className="text-xs text-red-600">💡 {email.resume_ia}</p>
                          <p className="text-xs text-gray-500">{email.from_name || email.from_email} · {new Date(email.received_at).toLocaleDateString(dateFmtLocale)}</p>
                        </div>
                        <div className="flex gap-2 ml-3">
                          <button onClick={e => { e.stopPropagation(); handleAction(email.id, 'marquer_traite') }}
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700 transition">✅</button>
                          <button onClick={e => { e.stopPropagation(); handleAction(email.id, 'archiver') }}
                            className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-300 transition">📦</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modal détail email ── */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEmail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header modal */}
            <div className={`p-5 rounded-t-2xl ${
              selectedEmail.urgence === 'haute' ? 'bg-red-50 border-b-2 border-red-200' :
              selectedEmail.urgence === 'moyenne' ? 'bg-amber-50 border-b-2 border-amber-200' :
              'bg-[#F7F4EE] border-b-2 border-gray-200'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{URGENCE_CONFIG[selectedEmail.urgence].emoji}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${URGENCE_CONFIG[selectedEmail.urgence].color}`}>
                        {URGENCE_CONFIG[selectedEmail.urgence].label}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${(TYPE_EMAIL_CONFIG[selectedEmail.type_demande] || TYPE_EMAIL_CONFIG.autre).color}`}>
                        {(TYPE_EMAIL_CONFIG[selectedEmail.type_demande] || TYPE_EMAIL_CONFIG.autre).emoji} {(TYPE_EMAIL_CONFIG[selectedEmail.type_demande] || TYPE_EMAIL_CONFIG.autre).label}
                      </span>
                    </div>
                    <h3 className="font-bold text-[#0D1B2E]">{selectedEmail.subject}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ✉️ {selectedEmail.from_name || selectedEmail.from_email} · {new Date(selectedEmail.received_at).toLocaleString(dateFmtLocale)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedEmail(null)} className="text-gray-500 hover:text-gray-600 text-xl ml-3">✕</button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Résumé IA */}
              <div className="bg-[#F7F4EE] border border-[#E4DDD0] rounded-xl p-4">
                <p className="text-xs font-bold text-[#C9A84C] mb-1">🤖 Analyse de Fixy</p>
                <p className="text-sm text-[#0D1B2E] font-medium">{selectedEmail.resume_ia}</p>
                {selectedEmail.immeuble_detecte && <p className="text-xs text-[#C9A84C] mt-1">🏢 Immeuble : {selectedEmail.immeuble_detecte}</p>}
                {selectedEmail.locataire_detecte && <p className="text-xs text-[#C9A84C]">👤 Résident : {selectedEmail.locataire_detecte}</p>}
              </div>

              {/* Corps de l'email */}
              {selectedEmail.body_preview && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">CONTENU DE L'EMAIL</p>
                  <div className="bg-[#F7F4EE] rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100 max-h-40 overflow-y-auto">
                    {selectedEmail.body_preview}
                  </div>
                </div>
              )}

              {/* Réponse suggérée — validation et envoi */}
              {selectedEmail.reponse_suggeree && selectedEmail.statut !== 'repondu' && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">✉️ BROUILLON DE RÉPONSE (généré par Fixy)</p>
                  <div className="bg-blue-50 rounded-xl p-4 text-sm border border-blue-100">
                    <textarea
                      value={draftResponse || selectedEmail.reponse_suggeree}
                      onChange={e => setDraftResponse(e.target.value)}
                      onFocus={() => { if (!draftResponse) setDraftResponse(selectedEmail.reponse_suggeree || '') }}
                      rows={6}
                      className="w-full bg-white border border-blue-200 rounded-lg p-3 text-sm text-gray-700 resize-y focus:outline-none focus:border-blue-400"
                      placeholder="Modifiez le brouillon si nécessaire..."
                    />
                    <p className="text-[11px] text-gray-400 mt-1 mb-3">
                      Destinataire : {selectedEmail.from_email} · Objet : Re: {selectedEmail.subject}
                    </p>
                    {sendError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3 text-xs text-red-600">
                        {sendError}
                      </div>
                    )}
                    {sendSuccess && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-3 text-xs text-green-700 font-medium">
                        ✅ Réponse envoyée avec succès !
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSendResponse}
                        disabled={sendingResponse || sendSuccess}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-bold transition"
                      >
                        {sendingResponse ? '⏳ Envoi en cours...' : '✅ Approuver et envoyer'}
                      </button>
                      <button
                        onClick={() => { setDraftResponse(''); setSendError('') }}
                        className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-semibold transition"
                      >
                        Réinitialiser
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {selectedEmail.statut === 'repondu' && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">✅ RÉPONSE ENVOYÉE</p>
                  <div className="bg-green-50 rounded-xl p-4 text-sm text-green-800 border border-green-200">
                    <p className="whitespace-pre-wrap">{(selectedEmail as any).response_sent || selectedEmail.reponse_suggeree}</p>
                    <p className="text-xs text-green-600 mt-2">
                      Envoyé le {(selectedEmail as any).response_sent_at ? new Date((selectedEmail as any).response_sent_at).toLocaleString(dateFmtLocale) : '-'}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions suggérées */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">ACTIONS SUGGÉRÉES PAR MAX</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(selectedEmail.actions_suggerees) ? selectedEmail.actions_suggerees : []).map(action => (
                    <span key={action} className="text-xs bg-[#F7F4EE] text-[#C9A84C] border border-[#E4DDD0] px-3 py-1.5 rounded-full">
                      ⚡ {action}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions manuelles */}
              <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-100">
                {selectedEmail.statut === 'nouveau' && (
                  <>
                    {selectedEmail.urgence === 'haute' && (
                      <button onClick={() => handleAction(selectedEmail.id, 'creer_mission')}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-bold transition">
                        🚨 Créer mission urgente
                      </button>
                    )}
                    <button onClick={() => handleAction(selectedEmail.id, 'marquer_traite')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold transition">
                      ✅ Marquer traité
                    </button>
                    <button onClick={() => handleAction(selectedEmail.id, 'archiver')}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-semibold transition">
                      📦 Archiver
                    </button>
                  </>
                )}
                {selectedEmail.statut !== 'nouveau' && (
                  <div className="w-full text-center py-2 text-sm text-gray-500">
                    Email {STATUT_CONFIG[selectedEmail.statut]?.label.toLowerCase() || 'traité'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
