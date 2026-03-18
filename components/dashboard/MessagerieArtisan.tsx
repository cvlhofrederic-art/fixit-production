'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useLocale } from '@/lib/i18n/context'

const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token || ''
const authHeader = async (): Promise<Record<string, string>> => {
  const t = await getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// ═══ TYPES ═══

type Conversation = {
  id: string
  artisan_id: string
  contact_id: string
  contact_type: 'particulier' | 'pro'
  contact_name: string
  contact_avatar: string
  last_message_at: string
  last_message_preview: string
  unread_count: number
  created_at: string
}

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  type: 'text' | 'ordre_mission' | 'photo' | 'voice' | 'system'
  content: string
  ordre_mission?: {
    titre: string
    adresse: string
    date_souhaitee: string
    description: string
    urgence: 'basse' | 'normale' | 'haute' | 'urgente'
    statut: 'en_attente' | 'accepte' | 'refuse' | 'en_cours' | 'termine'
    mission_id?: string
    arrival_time?: string
  }
  metadata: Record<string, unknown>
  read: boolean
  created_at: string
}

type Props = {
  artisan: { id: string; user_id: string; company_name?: string }
  onProposerDevis?: (missionData: { titre: string; description: string; adresse: string; date_souhaitee: string; contactName: string }) => void
}

// ═══ CONFIG ═══

const getUrgenceConfig = (isPt: boolean): Record<string, { bg: string; text: string; label: string; dot: string }> => ({
  basse:   { bg: 'bg-gray-100',   text: 'text-gray-600',   label: isPt ? 'Baixa' : 'Basse',     dot: 'bg-gray-400' },
  normale: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: isPt ? 'Normal' : 'Normale',   dot: 'bg-blue-500' },
  haute:   { bg: 'bg-orange-100', text: 'text-orange-700', label: isPt ? 'Alta' : 'Haute',       dot: 'bg-orange-500' },
  urgente: { bg: 'bg-red-100',    text: 'text-red-700',    label: isPt ? 'Urgente' : 'Urgente',  dot: 'bg-red-500' },
})

const getStatutConfig = (isPt: boolean): Record<string, { bg: string; text: string; label: string }> => ({
  en_attente: { bg: 'bg-amber-100',   text: 'text-amber-800',   label: isPt ? 'Pendente' : 'En attente' },
  accepte:    { bg: 'bg-green-100',   text: 'text-green-800',   label: isPt ? 'Aceite' : 'Accept\u00e9' },
  refuse:     { bg: 'bg-red-100',     text: 'text-red-800',     label: isPt ? 'Recusado' : 'Refus\u00e9' },
  en_cours:   { bg: 'bg-blue-100',    text: 'text-blue-800',    label: isPt ? 'Em curso' : 'En cours' },
  termine:    { bg: 'bg-emerald-100', text: 'text-emerald-800', label: isPt ? 'Terminado' : 'Termin\u00e9' },
})

// ═══ COMPOSANT PRINCIPAL ═══

export default function MessagerieArtisan({ artisan, onProposerDevis }: Props) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const dateFmtLocale = isPt ? 'pt-PT' : 'fr-FR'
  const URGENCE_CONFIG = getUrgenceConfig(isPt)
  const STATUT_CONFIG = getStatutConfig(isPt)
  const CONV_CACHE_KEY = `fixit_messagerie_convs_${artisan.id}`
  const MSG_CACHE_KEY_PREFIX = `fixit_messagerie_msgs_${artisan.id}_`

  const [tab, setTab] = useState<'clients' | 'donneurs'>('clients')
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try { return JSON.parse(localStorage.getItem(CONV_CACHE_KEY) || '[]') } catch { return [] }
  })
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [unreadClients, setUnreadClients] = useState(0)
  const [unreadPro, setUnreadPro] = useState(0)
  const [search, setSearch] = useState('')
  const [filterUnread, setFilterUnread] = useState<'all' | 'unread'>('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pollConvRef = useRef<NodeJS.Timeout | null>(null)
  const pollMsgRef = useRef<NodeJS.Timeout | null>(null)

  // ── Popup heure d'arrivée + durée ──
  const [showTimePickerForMsg, setShowTimePickerForMsg] = useState<string | null>(null)
  const [arrivalTime, setArrivalTime] = useState('09:00')
  const [durationHours, setDurationHours] = useState(2)

  // ── Charger les conversations ──
  const loadConversations = useCallback(async () => {
    const contactType = tab === 'clients' ? 'particulier' : 'pro'
    try {
      const res = await fetch(`/api/pro/messagerie?artisan_user_id=${artisan.user_id}&contact_type=${contactType}`, { headers: await authHeader() })
      const data = await res.json()
      if (data.conversations) {
        setConversations(data.conversations)
        // Cache en localStorage pour persistance
        try { localStorage.setItem(CONV_CACHE_KEY, JSON.stringify(data.conversations)) } catch { /* quota */ }
      }
    } catch (e) {
      console.error('[messagerie] load conversations error:', e)
      // Fallback localStorage
      try {
        const cached = localStorage.getItem(CONV_CACHE_KEY)
        if (cached) setConversations(JSON.parse(cached))
      } catch { /* ignore */ }
    }
  }, [artisan.user_id, tab, CONV_CACHE_KEY])

  // ── Charger les compteurs non-lus ──
  const loadUnreadCounts = useCallback(async () => {
    try {
      const h = await authHeader()
      const [clientsRes, proRes] = await Promise.all([
        fetch(`/api/pro/messagerie?artisan_user_id=${artisan.user_id}&contact_type=particulier`, { headers: h }),
        fetch(`/api/pro/messagerie?artisan_user_id=${artisan.user_id}&contact_type=pro`, { headers: h }),
      ])
      const [clientsData, proData] = await Promise.all([clientsRes.json(), proRes.json()])
      setUnreadClients((clientsData.conversations || []).reduce((sum: number, c: Conversation) => sum + (c.unread_count || 0), 0))
      setUnreadPro((proData.conversations || []).reduce((sum: number, c: Conversation) => sum + (c.unread_count || 0), 0))
    } catch (e) {
      console.error('[messagerie] unread counts error:', e)
    }
  }, [artisan.user_id])

  // ── Charger les messages d'une conversation ──
  const loadMessages = useCallback(async (convId: string, silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/pro/messagerie?artisan_user_id=${artisan.user_id}&conversation_id=${convId}`, { headers: await authHeader() })
      const data = await res.json()
      if (data.messages) {
        setMessages(data.messages)
        // Cache messages en localStorage
        try { localStorage.setItem(MSG_CACHE_KEY_PREFIX + convId, JSON.stringify(data.messages)) } catch { /* quota */ }
        loadUnreadCounts()
        loadConversations()
      }
    } catch (e) {
      console.error('[messagerie] load messages error:', e)
      // Fallback localStorage
      try {
        const cached = localStorage.getItem(MSG_CACHE_KEY_PREFIX + convId)
        if (cached) setMessages(JSON.parse(cached))
      } catch { /* ignore */ }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [artisan.user_id, loadUnreadCounts, loadConversations, MSG_CACHE_KEY_PREFIX])

  // ── Envoyer un message texte ──
  const sendMessage = async () => {
    if (!inputValue.trim() || !activeConv || sending) return
    setSending(true)
    const content = inputValue.trim()
    setInputValue('')

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConv.id,
      sender_id: artisan.user_id,
      type: 'text',
      content,
      metadata: {},
      read: true,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const h = await authHeader()
      await fetch('/api/pro/messagerie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({
          artisan_user_id: artisan.user_id,
          contact_id: activeConv.contact_id,
          sender_id: artisan.user_id,
          contact_type: activeConv.contact_type,
          contact_name: artisan.company_name || 'Artisan',
          content,
          type: 'text',
        }),
      })
      await loadMessages(activeConv.id)
    } catch (e) {
      console.error('[messagerie] send error:', e)
    } finally {
      setSending(false)
    }
  }

  // ── Action ordre de mission ──
  const handleOrdreMissionAction = async (messageId: string, action: string, extraData?: Record<string, string>) => {
    // Si "accepte" sans heure → ouvrir le popup de choix d'heure
    if (action === 'accepte' && !extraData?.arrival_time) {
      setShowTimePickerForMsg(messageId)
      setArrivalTime('09:00')
      return
    }

    try {
      const h = await authHeader()
      const res = await fetch('/api/pro/messagerie', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({
          message_id: messageId,
          action,
          artisan_user_id: artisan.user_id,
          artisan_name: artisan.company_name || 'Artisan',
          ...(extraData || {}),
        }),
      })
      if (res.ok && activeConv) {
        await loadMessages(activeConv.id)
      }
    } catch (e) {
      console.error('[messagerie] ordre action error:', e)
    }
  }

  // ── Confirmer acceptation avec heure d'arrivée + durée ──
  const confirmAcceptWithTime = async () => {
    if (!showTimePickerForMsg) return
    await handleOrdreMissionAction(showTimePickerForMsg, 'accepte', {
      arrival_time: arrivalTime,
      duration_hours: String(durationHours),
    })
    setShowTimePickerForMsg(null)
  }

  // ── Effects ──
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Polling conversations toutes les 8s (fiable, pas dépendant du Realtime) ──
  useEffect(() => {
    loadConversations()
    loadUnreadCounts()
    pollConvRef.current = setInterval(() => {
      loadConversations()
      loadUnreadCounts()
    }, 8000)
    return () => { if (pollConvRef.current) clearInterval(pollConvRef.current) }
  }, [loadConversations, loadUnreadCounts])

  // ── Polling messages de la conversation active toutes les 5s ──
  useEffect(() => {
    if (!activeConv) return
    // Charger depuis le cache localStorage immédiatement
    try {
      const cached = localStorage.getItem(MSG_CACHE_KEY_PREFIX + activeConv.id)
      if (cached) setMessages(JSON.parse(cached))
    } catch { /* ignore */ }
    // Puis charger depuis le serveur
    loadMessages(activeConv.id)
    pollMsgRef.current = setInterval(() => {
      loadMessages(activeConv.id, true)
    }, 5000)
    return () => { if (pollMsgRef.current) clearInterval(pollMsgRef.current) }
  }, [activeConv?.id, loadMessages, MSG_CACHE_KEY_PREFIX])

  // ── Supabase Realtime (en complément du polling pour l'instantanéité) ──
  useEffect(() => {
    const channel = supabase
      .channel(`messagerie_${artisan.user_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_messages',
      }, (payload) => {
        const newMsg = payload.new as Message
        if (activeConv && newMsg.conversation_id === activeConv.id && newMsg.sender_id !== artisan.user_id) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
        loadUnreadCounts()
        loadConversations()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_messages',
      }, () => {
        if (activeConv) loadMessages(activeConv.id, true)
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[MessagerieArtisan] Realtime channel error:', err?.message)
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [artisan.user_id, activeConv, loadUnreadCounts, loadConversations, loadMessages])

  // ── Format helpers ──
  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "À l'instant"
    if (diffMin < 60) return `Il y a ${diffMin}min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `Il y a ${diffH}h`
    return d.toLocaleDateString(dateFmtLocale, { day: '2-digit', month: 'short' })
  }

  // ── Filtered conversations ──
  const filteredConversations = conversations.filter(conv => {
    const matchSearch = !search.trim() ||
      (conv.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (conv.last_message_preview || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filterUnread === 'all' || conv.unread_count > 0
    return matchSearch && matchFilter
  })

  // Quick templates
  const quickTemplates = tab === 'clients'
    ? isPt
      ? ['📍 A caminho', '✅ Terminado', '⚠️ Problema encontrado', '🔑 Acesso necessário']
      : ['📍 En route', '✅ Terminé', '⚠️ Problème rencontré', '🔑 Accès requis']
    : isPt
      ? ['📍 A caminho', '✅ Terminado', '📄 Orçamento enviado', '📸 Fotos enviadas']
      : ['📍 En route', '✅ Terminé', '📄 Devis envoyé', '📸 Photos envoyées']

  // ═══ RENDER ═══
  return (
    <div className="flex gap-0 h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ═══ PANNEAU GAUCHE — Liste conversations ═════════════ */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className={`${activeConv ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 flex-shrink-0 border-r border-gray-100`}>

        {/* ── Switcher Particuliers / Professionnels ── */}
        <div className="p-3 border-b border-gray-100 bg-gray-50">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
            {/* PARTICULIERS */}
            <button
              onClick={() => { setTab('clients'); setActiveConv(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition ${
                tab === 'clients' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span>{'\uD83C\uDFE0'}</span>
              <span>Particuliers</span>
              {unreadClients > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  tab === 'clients' ? 'bg-white text-amber-600' : 'bg-amber-100 text-amber-700'
                }`}>
                  {unreadClients > 9 ? '9+' : unreadClients}
                </span>
              )}
            </button>
            {/* PROFESSIONNELS */}
            <button
              onClick={() => { setTab('donneurs'); setActiveConv(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition border-l border-gray-200 ${
                tab === 'donneurs' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span>{'\uD83C\uDFE2'}</span>
              <span>Professionnels</span>
              {unreadPro > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  tab === 'donneurs' ? 'bg-white text-indigo-600' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {unreadPro > 9 ? '9+' : unreadPro}
                </span>
              )}
            </button>
          </div>
          {/* Sous-titre */}
          <p className="text-xs text-gray-500 text-center mt-1.5">
            {tab === 'clients'
              ? `${filteredConversations.length} conversation${filteredConversations.length > 1 ? 's' : ''} client${filteredConversations.length > 1 ? 's' : ''}`
              : `${filteredConversations.length} conversation${filteredConversations.length > 1 ? 's' : ''} pro`}
          </p>
        </div>

        {/* ── Recherche + filtres ── */}
        <div className="px-3 py-2 border-b border-gray-100">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'clients' ? 'Rechercher un client\u2026' : 'Rechercher un professionnel\u2026'}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none"
          />
          <div className="flex gap-1 mt-1.5 flex-wrap">
            <button
              onClick={() => setFilterUnread('all')}
              className={`text-xs px-2 py-1 rounded-lg border transition ${filterUnread === 'all'
                ? tab === 'clients' ? 'border-amber-400 bg-amber-50 text-amber-700 font-semibold' : 'border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              Toutes
            </button>
            <button
              onClick={() => setFilterUnread('unread')}
              className={`text-xs px-2 py-1 rounded-lg border transition ${filterUnread === 'unread'
                ? tab === 'clients' ? 'border-amber-400 bg-amber-50 text-amber-700 font-semibold' : 'border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              {'\u2709\uFE0F'} Non lues
            </button>
          </div>
        </div>

        {/* ── Liste des conversations ── */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="text-3xl mb-2">{tab === 'clients' ? '\uD83C\uDFE0' : '\uD83C\uDFE2'}</div>
              <p className="text-xs text-gray-500">
                {search.trim()
                  ? 'Aucun résultat'
                  : tab === 'clients' ? 'Aucune conversation client' : 'Aucune conversation pro'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {search.trim()
                  ? 'Essayez un autre terme'
                  : tab === 'clients'
                    ? 'Les conversations avec vos clients particuliers apparaîtront ici'
                    : "Les conversations avec les syndics et donneurs d'ordres apparaîtront ici"}
              </p>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = activeConv?.id === conv.id
              const isPro = conv.contact_type === 'pro'

              return (
                <button
                  key={conv.id}
                  onClick={() => { setActiveConv(conv); loadMessages(conv.id) }}
                  className={`w-full text-left px-4 py-3.5 border-b border-gray-50 transition ${
                    isPro ? 'hover:bg-indigo-50/50' : 'hover:bg-amber-50/50'
                  } ${isSelected
                    ? isPro ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'bg-amber-50 border-l-4 border-l-amber-500'
                    : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border-2 ${
                          isPro
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          {conv.contact_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{conv.contact_name || 'Contact'}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {isPro ? "Donneur d'ordres" : 'Client particulier'}
                          </p>
                        </div>
                      </div>
                      {/* Preview */}
                      {conv.last_message_preview ? (
                        <p className="text-xs text-gray-500 mt-0.5 ml-11 truncate italic">
                          {conv.last_message_preview}
                        </p>
                      ) : (
                        <p className={`text-xs mt-0.5 ml-11 italic ${isPro ? 'text-indigo-300' : 'text-amber-300'}`}>
                          Nouvelle conversation
                        </p>
                      )}
                    </div>
                    {/* Time + Badge */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-gray-400">{formatDate(conv.last_message_at)}</span>
                      {conv.unread_count > 0 && (
                        <span className={`text-white text-xs px-1.5 py-0.5 rounded-full font-bold min-w-[1.2rem] text-center ${
                          isPro ? 'bg-indigo-600' : 'bg-amber-500'
                        }`}>
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ═══ PANNEAU DROITE — Thread conversation ═════════════ */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className={`${activeConv ? 'flex' : 'hidden lg:flex'} flex-col flex-1 min-w-0`}>
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">{'\uD83D\uDCAC'}</div>
              <h3 className="text-lg font-bold text-gray-700">Sélectionnez une conversation</h3>
              <p className="text-sm text-gray-500 mt-2">Choisissez un contact dans la liste pour voir les messages</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Header conversation ── */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Bouton retour mobile */}
                  <button
                    onClick={() => setActiveConv(null)}
                    className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
                  >
                    {'\u2190'}
                  </button>
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                    activeConv.contact_type === 'pro'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {activeConv.contact_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm">{activeConv.contact_name || 'Contact'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        activeConv.contact_type === 'pro'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {activeConv.contact_type === 'pro' ? 'Professionnel' : 'Particulier'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {activeConv.contact_type === 'pro' ? "Donneur d'ordres" : 'Client particulier'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-gray-200 border-t-amber-500 rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-5xl mb-3">{activeConv.contact_type === 'pro' ? '\uD83C\uDFE2' : '\uD83C\uDFE0'}</div>
                  <p className="text-gray-500 font-medium">Conversation ouverte</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Aucun message pour le moment.{'\n'}Envoyez un message pour démarrer la conversation.
                  </p>
                </div>
              ) : (
                messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isOwn={msg.sender_id === artisan.user_id}
                    contactName={activeConv.contact_name || 'Contact'}
                    contactType={activeConv.contact_type}
                    artisanName={artisan.company_name || 'Moi'}
                    onOrdreMissionAction={handleOrdreMissionAction}
                    onProposerDevis={onProposerDevis}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Zone saisie ── */}
            <div className="border-t border-gray-100 bg-white px-4 pt-3">
              {/* Quick templates */}
              <div className="flex gap-1.5 flex-wrap mb-2">
                {quickTemplates.map(txt => (
                  <button
                    key={txt}
                    onClick={() => setInputValue(txt)}
                    className={`text-xs px-2.5 py-1 rounded-full transition ${
                      activeConv.contact_type === 'pro'
                        ? 'bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700'
                        : 'bg-gray-100 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    {txt}
                  </button>
                ))}
              </div>
              {/* Textarea + Send */}
              <div className="flex gap-2 pb-4">
                <textarea
                  ref={inputRef}
                  className={`flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none resize-none ${
                    activeConv.contact_type === 'pro' ? 'focus:border-indigo-400' : 'focus:border-amber-400'
                  }`}
                  placeholder={`Message à ${activeConv.contact_name || 'votre contact'}\u2026`}
                  value={inputValue}
                  rows={2}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || sending}
                  className={`px-5 py-2 rounded-xl font-semibold text-sm transition disabled:opacity-60 self-end text-white ${
                    activeConv.contact_type === 'pro'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  {sending ? '\u2026' : 'Envoyer'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Popup choix heure d'arrivée ── */}
      {showTimePickerForMsg && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fadeIn">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-4">
              <h3 className="text-white font-bold text-lg">{'\uD83D\uDD50'} Accepter la mission</h3>
              <p className="text-white/80 text-sm mt-1">Indiquez votre heure d&apos;arrivée et la durée estimée</p>
            </div>
            <div className="p-6 space-y-5">
              {/* Heure d'arrivée */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Heure d&apos;arrivée</p>
                <div className="flex items-center justify-center mb-2">
                  <input
                    type="time"
                    value={arrivalTime}
                    onChange={e => setArrivalTime(e.target.value)}
                    className="text-3xl font-bold text-center border-2 border-indigo-200 rounded-xl px-6 py-3 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'].map(t => (
                    <button
                      key={t}
                      onClick={() => setArrivalTime(t)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        arrivalTime === t
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Durée estimée */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Durée estimée de la mission</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '30 min', value: 0.5 },
                    { label: '1 h', value: 1 },
                    { label: '1 h 30', value: 1.5 },
                    { label: '2 h', value: 2 },
                    { label: '3 h', value: 3 },
                    { label: '4 h', value: 4 },
                    { label: '½ journée', value: 4 },
                    { label: 'Journée', value: 8 },
                    { label: '2 jours', value: 16 },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => setDurationHours(opt.value)}
                      className={`py-2 rounded-xl text-sm font-semibold transition border-2 ${
                        durationHours === opt.value
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-green-300 hover:bg-green-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {/* Résumé */}
                <div className="mt-2 text-center text-xs text-indigo-600 font-medium bg-indigo-50 rounded-lg py-1.5">
                  {'\uD83D\uDCC5'} Créneau bloqué : {arrivalTime} →{' '}
                  {(() => {
                    const [h, m] = arrivalTime.split(':').map(Number)
                    const totalMin = h * 60 + m + Math.round(durationHours * 60)
                    return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
                  })()}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTimePickerForMsg(null)}
                  className="flex-1 border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmAcceptWithTime}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold text-sm transition"
                >
                  {'\u2713'} Confirmer &amp; bloquer agenda
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ COMPOSANTS INTERNES ═══

function MessageBubble({ msg, isOwn, contactName, contactType, artisanName, onOrdreMissionAction, onProposerDevis }: {
  msg: Message
  isOwn: boolean
  contactName: string
  contactType: 'particulier' | 'pro'
  artisanName: string
  onOrdreMissionAction: (messageId: string, action: string, extraData?: Record<string, string>) => void
  onProposerDevis?: (data: { titre: string; description: string; adresse: string; date_souhaitee: string; contactName: string }) => void
}) {
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const time = new Date(msg.created_at).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })

  // Message système
  if (msg.type === 'system') {
    return (
      <div className="flex justify-center">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 max-w-xl">
          <p className="text-xs text-gray-500 text-center leading-relaxed whitespace-pre-line">{msg.content}</p>
          <p className="text-xs text-gray-300 text-center mt-1">{time}</p>
        </div>
      </div>
    )
  }

  // Ordre de mission
  if (msg.type === 'ordre_mission' && msg.ordre_mission) {
    return <OrdreMissionCard msg={msg} isOwn={isOwn} onAction={onOrdreMissionAction} onProposerDevis={onProposerDevis} contactName={contactName} />
  }

  // Message texte / photo / voice
  const senderLabel = isOwn ? artisanName : contactName
  const avatarLetter = senderLabel.charAt(0).toUpperCase()
  const isPro = contactType === 'pro'

  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
        isOwn
          ? 'bg-amber-100 text-amber-700'
          : isPro
            ? 'bg-indigo-100 text-indigo-700'
            : 'bg-gray-100 text-gray-600'
      }`}>
        {avatarLetter}
      </div>
      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <p className="text-xs text-gray-500 px-1">
          {senderLabel} {isOwn ? '· Artisan' : isPro ? "· Donneur d'ordres" : '· Client'}
        </p>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line shadow-sm ${
          isOwn
            ? 'bg-amber-500 text-white rounded-tr-sm'
            : isPro
              ? 'bg-indigo-50 text-gray-900 border border-indigo-100 rounded-tl-sm'
              : 'bg-white text-gray-900 border border-gray-100 rounded-tl-sm'
        }`}>
          {msg.type === 'photo' && msg.metadata?.url ? (
            <Image src={String(msg.metadata.url)} alt="" width={400} height={300} className="rounded-lg mb-2 max-w-full" unoptimized />
          ) : null}
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        </div>
        <p className="text-xs text-gray-300 px-1">
          {time}
          {isOwn && msg.read && <span className="ml-1">{'\u2713\u2713'}</span>}
        </p>
      </div>
    </div>
  )
}

function OrdreMissionCard({ msg, isOwn, onAction, onProposerDevis, contactName }: {
  msg: Message
  isOwn: boolean
  onAction: (messageId: string, action: string, extraData?: Record<string, string>) => void
  onProposerDevis?: (data: { titre: string; description: string; adresse: string; date_souhaitee: string; contactName: string }) => void
  contactName?: string
}) {
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const om = msg.ordre_mission!
  const urgence = URGENCE_CONFIG[om.urgence] || URGENCE_CONFIG.normale
  const statut = STATUT_CONFIG[om.statut] || STATUT_CONFIG.en_attente

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className="w-full max-w-md bg-white border-2 border-indigo-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{'\uD83D\uDCCB'}</span>
            <span className="text-white font-bold text-sm">Ordre de mission</span>
          </div>
          <span className={`${urgence.bg} ${urgence.text} text-xs font-bold px-2.5 py-1 rounded-full`}>
            {urgence.label}
          </span>
        </div>

        {/* Body */}
        <div className="p-4 space-y-2.5">
          <h4 className="font-bold text-gray-900">{om.titre || 'Mission'}</h4>

          {om.adresse && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <span className="flex-shrink-0">{'\uD83D\uDCCD'}</span>
              <span>{om.adresse}</span>
            </div>
          )}

          {om.date_souhaitee && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{'\uD83D\uDCC5'}</span>
              <span>{new Date(om.date_souhaitee + 'T12:00:00').toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
          )}

          {om.arrival_time && (om.statut === 'accepte' || om.statut === 'en_cours' || om.statut === 'termine') && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
              <span>{'\uD83D\uDD50'}</span>
              <span className="font-semibold">Arrivée prévue à {om.arrival_time}</span>
            </div>
          )}

          {om.description && (
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{om.description}</p>
          )}

          {/* Statut */}
          <div className="flex items-center gap-2">
            <span className={`${statut.bg} ${statut.text} text-xs font-bold px-3 py-1 rounded-full`}>
              {statut.label}
            </span>
          </div>
        </div>

        {/* Actions (seulement si en_attente et c'est l'artisan qui voit) */}
        {om.statut === 'en_attente' && !isOwn && (
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <button
              onClick={() => onAction(msg.id, 'accepte')}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm transition"
            >
              {'\u2713'} Accepter
            </button>
            <button
              onClick={() => onAction(msg.id, 'refuse')}
              className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-2.5 rounded-xl font-bold text-sm transition"
            >
              {'\u2715'} Refuser
            </button>
          </div>
        )}

        {om.statut === 'accepte' && !isOwn && (
          <div className="border-t border-gray-100 p-3">
            <button
              onClick={() => onAction(msg.id, 'en_cours')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm transition"
            >
              {'\uD83D\uDD27'} Démarrer l&apos;intervention
            </button>
          </div>
        )}

        {om.statut === 'en_cours' && !isOwn && (
          <div className="border-t border-gray-100 p-3">
            <button
              onClick={() => onAction(msg.id, 'termine')}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-sm transition"
            >
              {'\u2705'} Marquer comme terminé
            </button>
          </div>
        )}

        {/* Bouton Proposer un devis — disponible dès que la mission est acceptée */}
        {(om.statut === 'accepte' || om.statut === 'en_cours' || om.statut === 'termine') && !isOwn && onProposerDevis && (
          <div className="border-t border-gray-100 p-3">
            <button
              onClick={() => onProposerDevis({
                titre: om.titre || '',
                description: om.description || '',
                adresse: om.adresse || '',
                date_souhaitee: om.date_souhaitee || '',
                contactName: contactName || '',
              })}
              className="w-full bg-gradient-to-r from-[#FFC107] to-[#FFD54F] hover:from-[#FFB300] hover:to-[#FFC107] text-gray-900 py-2.5 rounded-xl font-bold text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              {'\uD83D\uDCC4'} Proposer un devis
            </button>
          </div>
        )}

        {/* Timestamp */}
        <div className="px-4 pb-2 text-right">
          <span className="text-[10px] text-gray-400">
            {new Date(msg.created_at).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  )
}
