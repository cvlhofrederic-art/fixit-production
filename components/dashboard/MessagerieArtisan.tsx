'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { subscribeWithReconnect } from '@/lib/realtime-reconnect'
import { useLocale } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'

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
  orgRole?: string
  onConversationRead?: () => void
  onProposerDevis?: (missionData: { titre: string; description: string; adresse: string; date_souhaitee: string; contactName: string }) => void
}

// ═══ CONFIG ═══

const getUrgenceConfig = (isPt: boolean): Record<string, { label: string; tagClass: string }> => ({
  basse:   { label: isPt ? 'Baixa' : 'Basse',     tagClass: 'v22-tag v22-tag-gray' },
  normale: { label: isPt ? 'Normal' : 'Normale',   tagClass: 'v22-tag' },
  haute:   { label: isPt ? 'Alta' : 'Haute',       tagClass: 'v22-tag v22-tag-amber' },
  urgente: { label: isPt ? 'Urgente' : 'Urgente',  tagClass: 'v22-tag v22-tag-red' },
})

const getStatutConfig = (isPt: boolean): Record<string, { label: string; tagClass: string }> => ({
  en_attente: { label: isPt ? 'Pendente' : 'En attente', tagClass: 'v22-tag v22-tag-amber' },
  accepte:    { label: isPt ? 'Aceite' : 'Accepté',      tagClass: 'v22-tag v22-tag-green' },
  refuse:     { label: isPt ? 'Recusado' : 'Refusé',     tagClass: 'v22-tag v22-tag-red' },
  en_cours:   { label: isPt ? 'Em curso' : 'En cours',   tagClass: 'v22-tag v22-tag-yellow' },
  termine:    { label: isPt ? 'Terminado' : 'Terminé',    tagClass: 'v22-tag v22-tag-green' },
})

// ═══ TYPES CLIENT ═══

const TYPES_CLIENT: Record<string, { badge: string; couleur: string }> = {
  particulier:            { badge: 'Particulier',    couleur: 'gris' },
  particulier_bailleur:   { badge: 'Bailleur',       couleur: 'gris' },
  particulier_secondaire: { badge: 'Résid. sec.',    couleur: 'gris' },
  professionnel:          { badge: 'Pro',             couleur: 'bleu' },
  societe:                { badge: 'Société',         couleur: 'bleu' },
  artisan_sous_traitant:  { badge: 'Sous-traitant',  couleur: 'bleu' },
  syndic:                 { badge: 'Syndic',          couleur: 'violet' },
  conciergerie:           { badge: 'Conciergerie',    couleur: 'violet' },
  agence_immobiliere:     { badge: 'Agence immo',     couleur: 'violet' },
  promoteur:              { badge: 'Promoteur',       couleur: 'orange' },
  architecte:             { badge: 'Architecte',      couleur: 'orange' },
  collectivite:           { badge: 'Collectivité',    couleur: 'vert' },
  association:            { badge: 'Association',     couleur: 'vert' },
  pro:                    { badge: 'Pro',             couleur: 'bleu' },
}

const AVATAR_COLORS = [
  { bg: '#FFF3E0', color: '#E65100' },
  { bg: '#E8EAF6', color: '#283593' },
  { bg: '#E0F2F1', color: '#00695C' },
  { bg: '#FCE4EC', color: '#AD1457' },
  { bg: '#F3E5F5', color: '#6A1B9A' },
  { bg: '#E1F5FE', color: '#01579B' },
  { bg: '#FFF8E1', color: '#F57F17' },
  { bg: '#EFEBE9', color: '#4E342E' },
]

function getAvatarColor(name: string) {
  const idx = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function getClientTypeBadge(contactType: string) {
  const config = TYPES_CLIENT[contactType] || TYPES_CLIENT.particulier
  return config
}

// ═══ COMPOSANT PRINCIPAL ═══

export default function MessagerieArtisan({ artisan, orgRole, onConversationRead, onProposerDevis }: Props) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const dateFmtLocale = isPt ? 'pt-PT' : 'fr-FR'
  const URGENCE_CONFIG = getUrgenceConfig(isPt)
  const STATUT_CONFIG = getStatutConfig(isPt)
  const CONV_CACHE_KEY = `fixit_messagerie_convs_${artisan.id}`
  const MSG_CACHE_KEY_PREFIX = `fixit_messagerie_msgs_${artisan.id}_`

  const [tab, setTab] = useState<'all' | 'clients' | 'donneurs'>('all')
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
  const inputRef = useRef<HTMLInputElement>(null)
  const pollConvRef = useRef<NodeJS.Timeout | null>(null)
  const pollMsgRef = useRef<NodeJS.Timeout | null>(null)

  // ── Popup heure d'arrivée + durée ──
  const [showTimePickerForMsg, setShowTimePickerForMsg] = useState<string | null>(null)
  const [arrivalTime, setArrivalTime] = useState('09:00')
  const [durationHours, setDurationHours] = useState(2)

  // ── Charger les conversations (toutes : particulier + pro) ──
  const loadConversations = useCallback(async () => {
    try {
      const h = await authHeader()
      const [clientsRes, proRes] = await Promise.all([
        fetch(`/api/pro/messagerie?artisan_user_id=${artisan.user_id}&contact_type=particulier`, { headers: h }),
        fetch(`/api/pro/messagerie?artisan_user_id=${artisan.user_id}&contact_type=pro`, { headers: h }),
      ])
      const [clientsData, proData] = await Promise.all([clientsRes.json(), proRes.json()])
      const allConvs = [...(clientsData.conversations || []), ...(proData.conversations || [])]
        .sort((a: Conversation, b: Conversation) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
      setConversations(allConvs)
      try { localStorage.setItem(CONV_CACHE_KEY, JSON.stringify(allConvs)) } catch { /* quota */ }
    } catch (e) {
      console.error('[messagerie] load conversations error:', e)
      try {
        const cached = localStorage.getItem(CONV_CACHE_KEY)
        if (cached) setConversations(JSON.parse(cached))
      } catch { /* ignore */ }
    }
  }, [artisan.user_id, CONV_CACHE_KEY])

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
        try { localStorage.setItem(MSG_CACHE_KEY_PREFIX + convId, JSON.stringify(data.messages)) } catch { /* quota */ }
        loadUnreadCounts()
        loadConversations()
        onConversationRead?.()
      }
    } catch (e) {
      console.error('[messagerie] load messages error:', e)
      try {
        const cached = localStorage.getItem(MSG_CACHE_KEY_PREFIX + convId)
        if (cached) setMessages(JSON.parse(cached))
      } catch { /* ignore */ }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [artisan.user_id, loadUnreadCounts, loadConversations, onConversationRead, MSG_CACHE_KEY_PREFIX])

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

  // ── Polling conversations toutes les 8s ──
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
    try {
      const cached = localStorage.getItem(MSG_CACHE_KEY_PREFIX + activeConv.id)
      if (cached) setMessages(JSON.parse(cached))
    } catch { /* ignore */ }
    loadMessages(activeConv.id)
    pollMsgRef.current = setInterval(() => {
      loadMessages(activeConv.id, true)
    }, 5000)
    return () => { if (pollMsgRef.current) clearInterval(pollMsgRef.current) }
  }, [activeConv?.id, loadMessages, MSG_CACHE_KEY_PREFIX])

  // ── Supabase Realtime ──
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

    subscribeWithReconnect(channel, (status, err) => {
      console.error(`[MessagerieArtisan] Realtime ${status}:`, err)
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

  // ── Filtered conversations (par onglet + recherche) ──
  const filteredConversations = conversations.filter(conv => {
    const matchSearch = !search.trim() ||
      (conv.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (conv.last_message_preview || '').toLowerCase().includes(search.toLowerCase())
    const matchTab = tab === 'all' ||
      (tab === 'clients' && conv.contact_type === 'particulier') ||
      (tab === 'donneurs' && conv.contact_type === 'pro')
    return matchSearch && matchTab
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ═══ Page Header ═══ */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.1rem', flexShrink: 0 }}>
        <div className="v5-pg-t" style={{ marginBottom: 0 }}>
          <h1>Messagerie</h1>
          <p>Vos conversations</p>
        </div>
        <button className="v5-btn v5-btn-p" style={{ borderRadius: 20, flexShrink: 0, marginTop: 2 }}>✏️ Nouvelle conversation</button>
      </div>

      {/* ═══ LAYOUT v7 — Grille 2 colonnes ═══ */}
      <div className="v7-msg-layout" style={{ flex: 1, minHeight: 0 }}>

      {/* ═══ PANNEAU GAUCHE — Liste conversations ═══ */}
      <div className={`v7-msg-left ${activeConv ? 'v7-hidden-mobile' : ''}`}>

        {/* ── Recherche ── */}
        <div className="v7-msg-search">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une conversation…"
          />
        </div>

        {/* ── Onglets filtre Tous / Particulier / Pro ── */}
        <div className="v7-msg-tabs">
          {(['all', 'clients', 'donneurs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t as typeof tab)}
              className={`v7-msg-tab ${tab === t ? 'active' : ''}`}
            >
              {t === 'all' ? 'Tous' : t === 'clients' ? 'Particulier' : 'Pro'}
              {t === 'clients' && unreadClients > 0 && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700 }}>{unreadClients}</span>}
              {t === 'donneurs' && unreadPro > 0 && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700 }}>{unreadPro}</span>}
            </button>
          ))}
        </div>

        {/* ── Liste des conversations ── */}
        <div className="v7-msg-list">
          {filteredConversations.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '.4rem', padding: '2rem 1rem', color: '#CCC' }}>
              <span style={{ fontSize: 28, opacity: 0.5 }}>{'\uD83D\uDCAC'}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#CCC' }}>{search.trim() ? 'Aucun résultat' : 'Aucune conversation'}</span>
              <span style={{ fontSize: 11, color: '#DDD', textAlign: 'center', lineHeight: 1.5 }}>
                {search.trim() ? 'Essayez un autre terme' : 'Vos échanges avec vos clients et partenaires apparaîtront ici'}
              </span>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = activeConv?.id === conv.id
              const avatarCol = getAvatarColor(conv.contact_name || '')
              const typeBadge = getClientTypeBadge(conv.contact_type)
              const initials = (conv.contact_name || '?').split(' ').map(w => w.charAt(0).toUpperCase()).slice(0, 2).join('')

              return (
                <div
                  key={conv.id}
                  onClick={() => { setActiveConv(conv); loadMessages(conv.id) }}
                  className={`v7-msg-item ${isSelected ? 'active' : ''}`}
                >
                  <div className="v7-msg-av" style={{ background: avatarCol.bg, color: avatarCol.color }}>
                    {initials}
                  </div>
                  <div className="v7-msg-body">
                    <div className="v7-msg-name">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {conv.contact_name || 'Contact'}
                        <span className={`badge badge-${typeBadge.couleur === 'bleu' ? 'blue' : typeBadge.couleur === 'violet' ? 'purple' : typeBadge.couleur === 'orange' ? 'orange' : typeBadge.couleur === 'vert' ? 'green' : 'gray'}`} style={{ fontSize: 8, padding: '1px 5px' }}>{typeBadge.badge}</span>
                      </span>
                      <span className="v7-msg-time">{formatDate(conv.last_message_at)}</span>
                    </div>
                    <div className="v7-msg-preview">
                      {conv.last_message_preview || 'Nouvelle conversation'}
                    </div>
                  </div>
                  {conv.unread_count > 0 && <div className="v7-msg-dot" />}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ═══ PANNEAU DROITE — Thread conversation ═══ */}
      <div className={`v7-msg-right ${!activeConv ? '' : 'v7-hidden-mobile-reverse'}`} style={{ background: '#fff', display: 'flex', flexDirection: 'column' }}>
        {!activeConv ? (
          <>
            {/* spacers invisibles = même hauteur que search + tabs gauche */}
            <div style={{ height: 38, flexShrink: 0, borderBottom: '1px solid transparent' }} />
            <div style={{ height: 33, flexShrink: 0, borderBottom: '1px solid transparent' }} />
            {/* empty state centré, identique à gauche */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '.65rem', padding: '2rem', color: '#CCC' }}>
              <span style={{ fontSize: 28, opacity: 0.5 }}>{'\uD83D\uDCAC'}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#BBB' }}>Aucun message</span>
              <span style={{ fontSize: 11, color: '#CCC', textAlign: 'center', maxWidth: 220, lineHeight: 1.6 }}>Sélectionnez une conversation ou démarrez-en une nouvelle</span>
            </div>
          </>
        ) : (
          <>
            {/* ── Header conversation ── */}
            <div className="v7-msg-header">
              <button onClick={() => setActiveConv(null)} className="v7-msg-back">{'\u2190'}</button>
              <div className={isV5 ? 'v5-msg-av' : 'v22-msg-header-avatar'} style={{ background: getAvatarColor(activeConv.contact_name || '').bg, color: getAvatarColor(activeConv.contact_name || '').color, border: 'none' }}>
                {(activeConv.contact_name || '?').split(' ').map(w => w.charAt(0).toUpperCase()).slice(0, 2).join('')}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className={isV5 ? 'v5-msg-nm' : 'v22-msg-header-name'}>{activeConv.contact_name || 'Contact'}</span>
                  <span className={`badge badge-${getClientTypeBadge(activeConv.contact_type).couleur === 'bleu' ? 'blue' : getClientTypeBadge(activeConv.contact_type).couleur === 'violet' ? 'purple' : getClientTypeBadge(activeConv.contact_type).couleur === 'orange' ? 'orange' : getClientTypeBadge(activeConv.contact_type).couleur === 'vert' ? 'green' : 'gray'}`} style={{ fontSize: 9, padding: '1px 6px' }}>
                    {getClientTypeBadge(activeConv.contact_type).badge}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="v7-msg-messages">
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                  <div style={{ width: 24, height: 24, border: `2px solid ${tv.border}`, borderTopColor: tv.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : messages.length === 0 ? (
                <div className={isV5 ? 'v5-card' : 'v22-msg-empty'} style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>{activeConv.contact_type === 'pro' ? '\uD83C\uDFE2' : '\uD83C\uDFE0'}</div>
                  <div>Conversation ouverte</div>
                  <div style={{ marginTop: 4, fontSize: 11 }}>Aucun message pour le moment. Envoyez un message pour démarrer.</div>
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
                    isV5={isV5}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Zone saisie ── */}
            <div>
              {/* Quick templates */}
              <div style={{ display: 'flex', gap: 4, padding: '4px 12px', flexWrap: 'wrap' }}>
                {quickTemplates.map(txt => (
                  <button key={txt} onClick={() => setInputValue(txt)} className="btn btn-sm" style={{ fontSize: 9 }}>
                    {txt}
                  </button>
                ))}
              </div>
              {/* Input bar */}
              <div className="v7-msg-input-bar">
                <button style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer' }}>📎</button>
                <input
                  ref={inputRef}
                  className="v7-msg-input"
                  placeholder={`Écrire un message…`}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || sending}
                  className="v7-msg-send"
                >
                  {sending ? '…' : '➤'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Close v7-msg-layout wrapper */}
      </div>

      {/* ── Popup choix heure d'arrivée ── */}
      {showTimePickerForMsg && (
        <div className="v22-modal-overlay">
          <div className={isV5 ? 'v5-card' : 'v22-modal'} style={{ maxWidth: 380, ...(isV5 ? { padding: 0 } : {}) }}>
            <div className={isV5 ? '' : 'v22-modal-head'} style={isV5 ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0' } : {}}>
              <div className={isV5 ? '' : 'v22-modal-title'}>{'\uD83D\uDD50'} Accepter la mission</div>
              <button onClick={() => setShowTimePickerForMsg(null)} className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-modal-close'}>{'\u2715'}</button>
            </div>
            <div className={isV5 ? '' : 'v22-modal-body'} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
              <div style={{ fontSize: 11, color: tv.textMuted }}>
                Indiquez votre heure d&apos;arrivée et la durée estimée
              </div>

              {/* Heure d'arrivée */}
              <div>
                <div className={isV5 ? '' : 'v22-form-label'} style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 11, fontWeight: 600 }}>
                  Heure d&apos;arrivée
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <input
                    type="time"
                    value={arrivalTime}
                    onChange={e => setArrivalTime(e.target.value)}
                    className={isV5 ? 'v5-search-in' : 'v22-form-input'}
                    style={{ fontSize: 22, fontWeight: 600, textAlign: 'center', padding: '8px 16px', width: 'auto' }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                  {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'].map(t => (
                    <button
                      key={t}
                      onClick={() => setArrivalTime(t)}
                      className={isV5
                        ? `v5-btn v5-btn-sm ${arrivalTime === t ? 'v5-btn-p' : ''}`
                        : `v22-btn v22-btn-sm ${arrivalTime === t ? 'v22-btn-primary' : ''}`
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Durée estimée */}
              <div>
                <div className={isV5 ? '' : 'v22-form-label'} style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 11, fontWeight: 600 }}>
                  Durée estimée
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
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
                      className={isV5
                        ? `v5-btn v5-btn-sm ${durationHours === opt.value ? 'v5-btn-p' : ''}`
                        : `v22-btn v22-btn-sm ${durationHours === opt.value ? 'v22-btn-primary' : ''}`
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {/* Résumé */}
                <div style={{
                  marginTop: 8,
                  textAlign: 'center',
                  fontSize: 11,
                  color: tv.textMid,
                  background: tv.primaryLight,
                  borderRadius: 3,
                  padding: '6px 0',
                  border: `1px solid ${tv.primaryBorder}`,
                }}>
                  {'📅'} Créneau bloqué : {arrivalTime} {'→'}{' '}
                  {(() => {
                    const [h, m] = arrivalTime.split(':').map(Number)
                    const totalMin = h * 60 + m + Math.round(durationHours * 60)
                    return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
                  })()}
                </div>
              </div>
            </div>
            <div className={isV5 ? '' : 'v22-modal-foot'} style={{ display: 'flex', gap: 8, padding: 16 }}>
              <button onClick={() => setShowTimePickerForMsg(null)} className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ flex: 1 }}>
                Annuler
              </button>
              <button onClick={confirmAcceptWithTime} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-green'} style={{ flex: 1 }}>
                {'\u2713'} Confirmer &amp; bloquer agenda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ COMPOSANTS INTERNES ═══

function MessageBubble({ msg, isOwn, contactName, contactType, artisanName, onOrdreMissionAction, onProposerDevis, isV5 = false }: {
  msg: Message
  isOwn: boolean
  contactName: string
  contactType: 'particulier' | 'pro'
  artisanName: string
  onOrdreMissionAction: (messageId: string, action: string, extraData?: Record<string, string>) => void
  onProposerDevis?: (data: { titre: string; description: string; adresse: string; date_souhaitee: string; contactName: string }) => void
  isV5?: boolean
}) {
  const locale = useLocale()
  const tv = useThemeVars(isV5)
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const time = new Date(msg.created_at).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })

  // Message système
  if (msg.type === 'system') {
    return (
      <div className={isV5 ? '' : 'v22-msg-system'} style={isV5 ? { textAlign: 'center', padding: '8px 0' } : {}}>
        <span className={isV5 ? 'v5-msg-tx' : 'v22-msg-system-text'} style={isV5 ? { fontSize: 11, color: 'var(--text-muted)' } : {}}>
          {msg.content}
          <br />
          <span style={{ fontSize: 9, color: tv.textMuted }}>{time}</span>
        </span>
      </div>
    )
  }

  // Ordre de mission
  if (msg.type === 'ordre_mission' && msg.ordre_mission) {
    return <OrdreMissionCard msg={msg} isOwn={isOwn} onAction={onOrdreMissionAction} onProposerDevis={onProposerDevis} contactName={contactName} isV5={isV5} />
  }

  // Message texte / photo / voice
  const senderLabel = isOwn ? artisanName : contactName
  const avatarLetter = senderLabel.charAt(0).toUpperCase()

  if (isV5) {
    return (
      <div className={`v5-msg-cb ${isOwn ? 'own' : ''}`}>
        <div className="v5-msg-av" style={{ width: 28, height: 28, fontSize: 11 }}>
          {avatarLetter}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="v5-msg-snd">
            {senderLabel} {isOwn ? '· Artisan' : contactType === 'pro' ? "· Donneur d'ordres" : '· Client'}
          </span>
          <div className="v5-msg-tx">
            {msg.type === 'photo' && msg.metadata?.url ? (
              <Image src={String(msg.metadata.url)} alt="" width={400} height={300} style={{ borderRadius: 3, marginBottom: 6, maxWidth: '100%', height: 'auto' }} unoptimized />
            ) : null}
            {msg.content}
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {time}
            {isOwn && msg.read && ' \u2713\u2713'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`v22-msg-bubble-row ${isOwn ? 'own' : ''}`}>
      <div className={`v22-msg-bubble-avatar ${isOwn ? 'own' : ''}`}>
        {avatarLetter}
      </div>
      <div className="v22-msg-bubble-col">
        <span className="v22-msg-bubble-sender">
          {senderLabel} {isOwn ? '· Artisan' : contactType === 'pro' ? "· Donneur d'ordres" : '· Client'}
        </span>
        <div className={`v22-msg-bubble ${isOwn ? 'own' : ''}`}>
          {msg.type === 'photo' && msg.metadata?.url ? (
            <Image src={String(msg.metadata.url)} alt="" width={400} height={300} style={{ borderRadius: 3, marginBottom: 6, maxWidth: '100%', height: 'auto' }} unoptimized />
          ) : null}
          {msg.content}
        </div>
        <span className="v22-msg-bubble-time">
          {time}
          {isOwn && msg.read && ' \u2713\u2713'}
        </span>
      </div>
    </div>
  )
}

function OrdreMissionCard({ msg, isOwn, onAction, onProposerDevis, contactName, isV5 = false }: {
  msg: Message
  isOwn: boolean
  onAction: (messageId: string, action: string, extraData?: Record<string, string>) => void
  onProposerDevis?: (data: { titre: string; description: string; adresse: string; date_souhaitee: string; contactName: string }) => void
  contactName?: string
  isV5?: boolean
}) {
  const locale = useLocale()
  const tv = useThemeVars(isV5)
  const isPt = locale === 'pt'
  const dateFmtLocale = isPt ? 'pt-PT' : 'fr-FR'
  const URGENCE_CONFIG = getUrgenceConfig(isPt)
  const STATUT_CONFIG = getStatutConfig(isPt)
  const om = msg.ordre_mission!
  const urgence = URGENCE_CONFIG[om.urgence] || URGENCE_CONFIG.normale
  const statut = STATUT_CONFIG[om.statut] || STATUT_CONFIG.en_attente

  return (
    <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
      <div className={isV5 ? 'v5-card' : 'v22-card v22-msg-mission'} style={isV5 ? { maxWidth: 400, width: '100%' } : {}}>
        {/* Header */}
        <div className={isV5 ? '' : 'v22-msg-mission-head'} style={isV5 ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px 0' } : {}}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{'\uD83D\uDCCB'}</span>
            <span style={{ fontWeight: 600, fontSize: 12 }}>Ordre de mission</span>
          </div>
          <span className={isV5 ? `v5-badge v5-badge-${om.urgence === 'urgente' ? 'red' : om.urgence === 'haute' ? 'orange' : om.urgence === 'basse' ? 'gray' : 'blue'}` : urgence.tagClass}>{urgence.label}</span>
        </div>

        {/* Body */}
        <div className={isV5 ? '' : 'v22-msg-mission-body'} style={isV5 ? { padding: '8px 14px 12px' } : {}}>
          <div className={isV5 ? '' : 'v22-msg-mission-title'} style={isV5 ? { fontWeight: 600, fontSize: 13, marginBottom: 6 } : {}}>{om.titre || 'Mission'}</div>

          {om.adresse && (
            <div className={isV5 ? '' : 'v22-msg-mission-row'} style={isV5 ? { display: 'flex', gap: 6, fontSize: 12, marginBottom: 4 } : {}}>
              <span>{'📍'}</span>
              <span>{om.adresse}</span>
            </div>
          )}

          {om.date_souhaitee && (
            <div className={isV5 ? '' : 'v22-msg-mission-row'} style={isV5 ? { display: 'flex', gap: 6, fontSize: 12, marginBottom: 4 } : {}}>
              <span>{'📅'}</span>
              <span>{new Date(om.date_souhaitee + 'T12:00:00').toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
          )}

          {om.arrival_time && (om.statut === 'accepte' || om.statut === 'en_cours' || om.statut === 'termine') && (
            <div className={isV5 ? '' : 'v22-msg-arrival-info'} style={isV5 ? { display: 'flex', gap: 6, fontSize: 12, marginBottom: 4, color: 'var(--text-muted)' } : {}}>
              <span>{'\uD83D\uDD50'}</span>
              <span>Arrivée prévue \u00E0 {om.arrival_time}</span>
            </div>
          )}

          {om.description && (
            <div className={isV5 ? 'v5-msg-tx' : 'v22-msg-mission-desc'} style={isV5 ? { fontSize: 12, marginBottom: 6 } : {}}>{om.description}</div>
          )}

          {/* Statut */}
          <span className={isV5 ? `v5-badge v5-badge-${om.statut === 'refuse' ? 'red' : om.statut === 'en_attente' ? 'orange' : 'green'}` : statut.tagClass}>{statut.label}</span>
        </div>

        {/* Actions (seulement si en_attente et c'est l'artisan qui voit) */}
        {om.statut === 'en_attente' && !isOwn && (
          <div className={isV5 ? '' : 'v22-msg-mission-foot'} style={isV5 ? { display: 'flex', gap: 8, padding: '0 14px 12px' } : {}}>
            <button onClick={() => onAction(msg.id, 'accepte')} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-green'}>
              {'\u2713'} Accepter
            </button>
            <button onClick={() => onAction(msg.id, 'refuse')} className={isV5 ? 'v5-btn' : 'v22-btn v22-btn-red-outline'}>
              {'\u2715'} Refuser
            </button>
          </div>
        )}

        {om.statut === 'accepte' && !isOwn && (
          <div className={isV5 ? '' : 'v22-msg-mission-foot'} style={isV5 ? { display: 'flex', gap: 8, padding: '0 14px 12px' } : {}}>
            <button onClick={() => onAction(msg.id, 'en_cours')} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-blue'} style={{ flex: 1 }}>
              {'🔧'} Démarrer l&apos;intervention
            </button>
          </div>
        )}

        {om.statut === 'en_cours' && !isOwn && (
          <div className={isV5 ? '' : 'v22-msg-mission-foot'} style={isV5 ? { display: 'flex', gap: 8, padding: '0 14px 12px' } : {}}>
            <button onClick={() => onAction(msg.id, 'termine')} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-green'} style={{ flex: 1 }}>
              {'✅'} Marquer comme terminé
            </button>
          </div>
        )}

        {/* Bouton Proposer un devis */}
        {(om.statut === 'accepte' || om.statut === 'en_cours' || om.statut === 'termine') && !isOwn && onProposerDevis && (
          <div className={isV5 ? '' : 'v22-msg-mission-foot'} style={isV5 ? { display: 'flex', gap: 8, padding: '0 14px 12px' } : {}}>
            <button
              onClick={() => onProposerDevis({
                titre: om.titre || '',
                description: om.description || '',
                adresse: om.adresse || '',
                date_souhaitee: om.date_souhaitee || '',
                contactName: contactName || '',
              })}
              className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'}
              style={{ flex: 1 }}
            >
              {'📄'} Proposer un devis
            </button>
          </div>
        )}

        {/* Timestamp */}
        <div style={{ padding: '0 14px 8px', textAlign: 'right' }}>
          <span style={{ fontSize: 10, color: tv.textMuted }}>
            {new Date(msg.created_at).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  )
}
