'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'

interface OrdreItem {
  id: string // message_id
  conversation_id: string
  sender_id: string
  content: string
  ordre_mission: {
    titre: string
    adresse: string
    date_souhaitee: string
    description: string
    urgence: string
    statut: string
    mission_id?: string
  } | null
  read: boolean
  created_at: string
  conversations: {
    artisan_id: string
    contact_id: string
    contact_type: string
    contact_name: string
  }
}

interface CanalMessage {
  id: string
  conversation_id: string
  sender_id: string
  type: string
  content: string
  read: boolean
  created_at: string
}

export default function OrdresMissionPage({ artisan, userId }: { artisan: import('@/lib/types').Artisan; userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  const [ordres, setOrdres] = useState<OrdreItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrdre, setSelectedOrdre] = useState<OrdreItem | null>(null)
  const [canalMessages, setCanalMessages] = useState<CanalMessage[]>([])
  const [loadingCanal, setLoadingCanal] = useState(false)
  const [newMsg, setNewMsg] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'nouvelles' | 'toutes'>('nouvelles')

  const artisanName = artisan?.company_name || artisan?.nom || 'Artisan'

  const loadOrdres = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/pro/messagerie?artisan_user_id=${userId}&type=ordre_mission`)
      if (!res.ok) return
      const data = await res.json()
      setOrdres(data.ordres || [])
    } catch (e) {
      console.error('[OrdresMissionPage] load error:', e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadOrdres()
    const interval = setInterval(loadOrdres, 10_000)
    return () => clearInterval(interval)
  }, [loadOrdres])

  // Charger les messages du canal quand on sélectionne un ordre
  useEffect(() => {
    if (!selectedOrdre || !userId) { setCanalMessages([]); return }
    const loadCanal = async () => {
      setLoadingCanal(true)
      try {
        const res = await fetch(`/api/pro/messagerie?artisan_user_id=${userId}&conversation_id=${selectedOrdre.conversation_id}`)
        if (!res.ok) return
        const data = await res.json()
        setCanalMessages(data.messages || [])
      } catch (e) {
        console.error('[OrdresMissionPage] canal load error:', e)
      } finally {
        setLoadingCanal(false)
      }
    }
    loadCanal()
    const interval = setInterval(loadCanal, 8_000)
    return () => clearInterval(interval)
  }, [selectedOrdre?.id, userId])

  const confirmerOrdre = async (ordre: OrdreItem) => {
    if (!userId) return
    setConfirmingId(ordre.id)
    try {
      const res = await fetch('/api/pro/messagerie', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: ordre.id,
          action: 'accepte',
          artisan_user_id: userId,
          artisan_name: artisanName,
        }),
      })
      if (res.ok) {
        await loadOrdres()
        // Recharger le canal aussi
        if (selectedOrdre?.id === ordre.id) {
          const res2 = await fetch(`/api/pro/messagerie?artisan_user_id=${userId}&conversation_id=${ordre.conversation_id}`)
          if (res2.ok) { const d = await res2.json(); setCanalMessages(d.messages || []) }
        }
      }
    } catch (e) {
      console.error('[OrdresMissionPage] confirm error:', e)
    } finally {
      setConfirmingId(null)
    }
  }

  const sendMsg = async () => {
    if (!newMsg.trim() || !selectedOrdre || !userId) return
    setSendingMsg(true)
    try {
      const res = await fetch('/api/pro/messagerie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artisan_user_id: userId,
          contact_id: selectedOrdre.conversations.contact_id,
          contact_type: 'pro',
          contact_name: selectedOrdre.conversations.contact_name,
          sender_id: userId,
          content: newMsg.trim(),
          type: 'text',
        }),
      })
      if (res.ok) {
        setNewMsg('')
        const res2 = await fetch(`/api/pro/messagerie?artisan_user_id=${userId}&conversation_id=${selectedOrdre.conversation_id}`)
        if (res2.ok) { const d = await res2.json(); setCanalMessages(d.messages || []) }
      }
    } catch (e) {
      console.error('[OrdresMissionPage] send error:', e)
    } finally {
      setSendingMsg(false)
    }
  }

  const filteredOrdres = tab === 'nouvelles'
    ? ordres.filter(o => !o.ordre_mission?.statut || o.ordre_mission.statut === 'en_attente')
    : ordres

  const prioriteColors: Record<string, string> = {
    urgente: 'bg-red-100 text-red-700 border-red-200',
    haute: 'bg-orange-100 text-orange-700 border-orange-200',
    normale: 'bg-blue-100 text-blue-700 border-blue-200',
  }

  if (loading) {
    return (
      <div className="animate-fadeIn">
        <div className="bg-white px-6 lg:px-5 h-20 border-b border-[#34495E] flex items-center">
          <h1 className="text-lg font-semibold">📋 {t('proDash.ordres.title')}</h1>
        </div>
        <div className="p-5 flex justify-center items-center text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
          <span className="ml-3">Chargement des ordres de mission…</span>
        </div>
      </div>
    )
  }

  if (ordres.length === 0) {
    return (
      <div className="animate-fadeIn">
        <div className="bg-white px-6 lg:px-5 h-20 border-b border-[#34495E] flex items-center">
          <div>
            <h1 className="text-lg font-semibold leading-tight">📋 {t('proDash.ordres.title')}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{t('proDash.ordres.subtitle')}</p>
          </div>
        </div>
        <div className="p-4 lg:p-5">
          <div className="bg-white rounded-md border border-gray-200 text-center py-20">
            <div className="text-2xl mb-3">📋</div>
            <h3 className="text-base font-semibold text-gray-700">{t('proDash.ordres.aucunOrdreMission')}</h3>
            <p className="text-gray-500 mt-2 text-sm">{t('proDash.ordres.ordresApparaitrontIci')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-6 lg:px-5 h-20 border-b border-[#34495E] flex items-center flex-shrink-0">
        <div className="flex items-center justify-between w-full">
          <div>
            <h1 className="text-lg font-semibold">📋 {t('proDash.ordres.titleSyndic')}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {ordres.length} {ordres.length > 1 ? t('proDash.ordres.ordresRecus') : t('proDash.ordres.ordreRecu')}
            </p>
          </div>
          <div className="flex gap-2">
            {([
              ['nouvelles', `${t('proDash.ordres.nouvelles')} (${ordres.filter(o => !o.ordre_mission?.statut || o.ordre_mission.statut === 'en_attente').length})`],
              ['toutes', t('proDash.ordres.toutes')],
            ] as [string, string][]).map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setTab(val as any)}
                className={`text-xs px-3 py-1.5 rounded border transition font-medium ${tab === val ? 'bg-[#FFC107] border-[#FFC107] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Liste ordres */}
        <div className="w-72 flex-shrink-0 border-r border-gray-100 overflow-y-auto bg-gray-50">
          {filteredOrdres.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">{t('proDash.ordres.aucuneMissionCategorie')}</p>
            </div>
          ) : filteredOrdres.map(o => {
            const isSelected = o.id === selectedOrdre?.id
            const statut = o.ordre_mission?.statut || 'en_attente'
            const isConfirme = statut === 'accepte' || statut === 'termine'
            const urgence = o.ordre_mission?.urgence || 'normale'

            return (
              <button
                key={o.id}
                onClick={() => setSelectedOrdre(o)}
                className={`w-full text-left p-4 border-b border-gray-100 transition hover:bg-white ${isSelected ? 'bg-white border-l-2 border-l-[#FFC107]' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-xs font-semibold text-gray-900 truncate">
                        {o.ordre_mission?.titre || t('proDash.ordres.intervention')}
                      </span>
                      {urgence !== 'normale' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${prioriteColors[urgence] || prioriteColors.normale}`}>
                          {urgence === 'urgente' ? '🔴 Urgent' : '🟠 Haute'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 truncate">🏢 {o.ordre_mission?.adresse || '—'}</p>
                    {o.ordre_mission?.date_souhaitee && (
                      <p className="text-xs text-green-600 font-medium mt-0.5">
                        📅 {new Date(o.ordre_mission.date_souhaitee + 'T12:00:00').toLocaleDateString(dateLocale)}
                      </p>
                    )}
                    <p className="text-xs text-purple-600 mt-0.5 truncate">
                      👤 {o.conversations?.contact_name || 'Syndic'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {isConfirme ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✅ {t('proDash.ordres.confirme')}</span>
                    ) : (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold animate-pulse">⏳ {t('proDash.ordres.aConfirmer')}</span>
                    )}
                    {!o.read && <span className="w-2 h-2 rounded-full bg-amber-400 mt-1"></span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Panneau détail */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {!selectedOrdre ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-2xl mb-2">📋</div>
                <p className="font-medium">{t('proDash.ordres.selectionnerOrdre')}</p>
                <p className="text-sm mt-1">{t('proDash.ordres.voirDetailsCanal')}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header mission */}
              <div className="p-4 border-b border-gray-100 bg-white flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900">
                        {selectedOrdre.ordre_mission?.titre || t('proDash.ordres.intervention')}
                      </h2>
                      {selectedOrdre.ordre_mission?.urgence === 'urgente' && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold border border-red-200">🔴 Urgent</span>
                      )}
                      {(selectedOrdre.ordre_mission?.statut === 'accepte' || selectedOrdre.ordre_mission?.statut === 'termine') && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✅ {t('proDash.ordres.confirme')}</span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {selectedOrdre.ordre_mission?.adresse && (
                        <p className="text-sm text-gray-600">🏢 {selectedOrdre.ordre_mission.adresse}</p>
                      )}
                      {selectedOrdre.ordre_mission?.date_souhaitee && (
                        <p className="text-sm font-semibold text-green-600">
                          📅 {new Date(selectedOrdre.ordre_mission.date_souhaitee + 'T12:00:00').toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                      {selectedOrdre.ordre_mission?.description && (
                        <p className="text-sm text-gray-500">🔧 {selectedOrdre.ordre_mission.description}</p>
                      )}
                      <p className="text-xs text-purple-500">👤 {selectedOrdre.conversations?.contact_name || 'Syndic'}</p>
                    </div>
                  </div>
                  {selectedOrdre.ordre_mission?.statut === 'en_attente' && (
                    <button
                      onClick={() => confirmerOrdre(selectedOrdre)}
                      disabled={confirmingId === selectedOrdre.id}
                      className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold text-sm transition disabled:opacity-60"
                    >
                      {confirmingId === selectedOrdre.id ? '…' : `✅ ${t('proDash.ordres.confirmerMission')}`}
                    </button>
                  )}
                </div>
              </div>

              {/* Fil de messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {loadingCanal ? (
                  <div className="flex justify-center pt-8 text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400"></div>
                  </div>
                ) : canalMessages.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-2xl mb-2">💬</div>
                    <p className="text-sm">{t('proDash.ordres.pasMessages')}</p>
                  </div>
                ) : canalMessages.map((msg) => {
                  const isMe = msg.sender_id === userId
                  const isSystem = msg.type === 'system'
                  const isOrdre = msg.type === 'ordre_mission'

                  if (isSystem || isOrdre) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className="bg-white border border-gray-200 rounded-md px-4 py-2 max-w-xl">
                          <p className="text-xs text-gray-500 text-center leading-relaxed whitespace-pre-line">
                            {isOrdre ? `📋 Ordre de mission : ${msg.content}` : msg.content}
                          </p>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isMe ? 'bg-[#FFC107] text-white' : 'bg-purple-100 text-purple-700'}`}>
                        {isMe ? artisanName.charAt(0).toUpperCase() : (selectedOrdre.conversations?.contact_name?.charAt(0).toUpperCase() || 'S')}
                      </div>
                      <div className={`max-w-sm flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                        <p className="text-xs text-gray-500 px-1">
                          {isMe ? artisanName : (selectedOrdre.conversations?.contact_name || 'Gestionnaire')}
                          {' · '}
                          {isMe ? t('proDash.ordres.vous') : t('proDash.ordres.gestionnaire')}
                        </p>
                        <div className={`rounded-md px-4 py-2.5 text-sm whitespace-pre-line ${isMe ? 'bg-[#FFC107] text-white rounded-tr-sm' : 'bg-white text-gray-900 border border-gray-100 rounded-tl-sm'}`}>
                          {msg.content}
                        </div>
                        <p className="text-xs text-gray-300 px-1">
                          {new Date(msg.created_at).toLocaleString(dateLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Saisie message */}
              <div className="border-t border-gray-100 bg-white px-4 pt-3 pb-4 flex-shrink-0">
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {[
                    `✅ ${t('proDash.ordres.missionConfirmeeQuick')}`,
                    `📍 ${t('proDash.ordres.enRoute')}`,
                    `🔍 ${t('proDash.ordres.diagnosticTermine')}`,
                    `⚠️ ${t('proDash.ordres.problemeSupplementaire')}`,
                    `📦 ${t('proDash.ordres.pieceACommander')}`,
                  ].map(txt => (
                    <button
                      key={txt}
                      onClick={() => setNewMsg(txt)}
                      className="text-xs bg-gray-100 hover:bg-amber-50 hover:text-amber-700 px-2 py-1 rounded-full transition"
                    >
                      {txt}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:border-amber-400 outline-none resize-none"
                    placeholder={t('proDash.ordres.repondreGestionnaire')}
                    value={newMsg}
                    rows={2}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMsg())}
                  />
                  <button
                    onClick={sendMsg}
                    disabled={!newMsg.trim() || sendingMsg}
                    className="bg-[#FFC107] text-white px-5 py-2 rounded font-semibold text-sm hover:bg-amber-500 transition disabled:opacity-50 self-end"
                  >
                    {sendingMsg ? '…' : t('proDash.ordres.envoyer')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
