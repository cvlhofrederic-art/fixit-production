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

export default function MessagerieArtisan({ artisan, onConversationRead, onProposerDevis }: Props) {
  const locale = useLocale()
  const isPt = locale === 'pt'
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
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
    if (diffMin < 1) return "\u00C0 l'instant"
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
      ? ['\uD83D\uDCCD A caminho', '\u2705 Terminado', '\u26A0\uFE0F Problema encontrado', '\uD83D\uDD11 Acesso necess\u00E1rio']
      : ['\uD83D\uDCCD En route', '\u2705 Termin\u00E9', '\u26A0\uFE0F Probl\u00E8me rencontr\u00E9', '\uD83D\uDD11 Acc\u00E8s requis']
    : isPt
      ? ['\uD83D\uDCCD A caminho', '\u2705 Terminado', '\uD83D\uDCC4 Or\u00E7amento enviado', '\uD83D\uDCF8 Fotos enviadas']
      : ['\uD83D\uDCCD En route', '\u2705 Termin\u00E9', '\uD83D\uDCC4 Devis envoy\u00E9', '\uD83D\uDCF8 Photos envoy\u00E9es']

  // ═══ RENDER ═══
  return (
    <div className="v22-msg-wrap" style={{ height: '100%' }}>

      {/* ═══ PANNEAU GAUCHE — Liste conversations ═══ */}
      <div className={`v22-msg-left ${activeConv ? 'v22-msg-left-hidden' : 'v22-msg-left-full'}`}>

        {/* ── Header avec compteur non lus ── */}
        <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--v22-text)' }}>Messagerie</span>
          {(unreadClients + unreadPro) > 0 && (
            <span style={{ fontSize: 12, color: 'var(--v22-text-muted)' }}>{unreadClients + unreadPro} non lu{(unreadClients + unreadPro) > 1 ? 's' : ''}</span>
          )}
        </div>

        {/* ── Onglets filtre Tous / Particuliers / Pro ── */}
        <div style={{ display: 'flex', gap: 4, padding: '0 16px 8px' }}>
          {(['all', 'clients', 'donneurs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t as typeof tab)}
              style={{
                flex: 1, padding: '5px 0', fontSize: 11, fontWeight: tab === t ? 700 : 500,
                background: tab === t ? 'var(--v22-yellow)' : 'transparent',
                color: tab === t ? '#1a1a2e' : 'var(--v22-text-muted)',
                border: tab === t ? 'none' : '1px solid var(--v22-border)',
                borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {t === 'all' ? 'Tous' : t === 'clients' ? 'Particuliers' : 'Pro'}
              {t === 'clients' && unreadClients > 0 && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700 }}>{unreadClients}</span>}
              {t === 'donneurs' && unreadPro > 0 && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700 }}>{unreadPro}</span>}
            </button>
          ))}
        </div>

        {/* ── Recherche ── */}
        <div style={{ padding: '0 16px 8px' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="v22-form-input"
            style={{ width: '100%', fontSize: 12 }}
          />
        </div>

        {/* ── Liste des conversations ── */}
        <div className="v22-msg-list">
          {filteredConversations.length === 0 ? (
            <div className="v22-msg-empty">
              <div style={{ fontSize: 28, marginBottom: 8 }}>{'\uD83D\uDCAC'}</div>
              <div>{search.trim() ? 'Aucun résultat' : 'Aucune conversation'}</div>
              <div style={{ marginTop: 4, color: 'var(--v22-text-muted)', fontSize: 11 }}>
                {search.trim() ? 'Essayez un autre terme' : 'Vos conversations apparaîtront ici'}
              </div>
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
                  className={`v22-msg-item ${isSelected ? 'active' : ''} ${conv.unread_count > 0 ? 'unread' : ''}`}
                >
                  {/* Avatar */}
                  <div className="v22-msg-avatar" style={{ background: avatarCol.bg, color: avatarCol.color, border: 'none', width: 36, height: 36, fontSize: 13 }}>
                    {initials}
                  </div>
                  {/* Body */}
                  <div className="v22-msg-body">
                    <div className="v22-msg-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {conv.contact_name || 'Contact'}
                      <span className={`v22-msg-type-badge type-${typeBadge.couleur}`}>{typeBadge.badge}</span>
                    </div>
                    <div className="v22-msg-preview">
                      {conv.last_message_preview || 'Nouvelle conversation'}
                    </div>
                  </div>
                  {/* Meta */}
                  <div className="v22-msg-meta">
                    <span className="v22-msg-time">{formatDate(conv.last_message_at)}</span>
                    {conv.unread_count > 0 && <div className="v22-msg-unread-badge">{conv.unread_count > 99 ? '99+' : conv.unread_count}</div>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ═══ PANNEAU DROITE — Thread conversation ═══ */}
      <div className={`v22-msg-right ${activeConv ? 'v22-msg-right-full' : 'v22-msg-right-hidden'}`}>
        {!activeConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{'\uD83D\uDCAC'}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v22-text)' }}>Sélectionnez une conversation</div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginTop: 6 }}>Choisissez un contact dans la liste pour voir les messages</div>
            </div>
          </div>
        ) : (
          <>
            {/* ── Header conversation ── */}
            <div className="v22-msg-header">
              <button onClick={() => setActiveConv(null)} className="v22-msg-back">{'\u2190'}</button>
              <div className="v22-msg-header-avatar" style={{ background: getAvatarColor(activeConv.contact_name || '').bg, color: getAvatarColor(activeConv.contact_name || '').color, border: 'none' }}>
                {(activeConv.contact_name || '?').split(' ').map(w => w.charAt(0).toUpperCase()).slice(0, 2).join('')}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="v22-msg-header-name">{activeConv.contact_name || 'Contact'}</span>
                  <span className={`v22-msg-type-badge type-${getClientTypeBadge(activeConv.contact_type).couleur}`} style={{ fontSize: 10 }}>
                    {getClientTypeBadge(activeConv.contact_type).badge}
                  </span>
                </div>
                <div className="v22-msg-header-sub">
                  {activeConv.contact_type === 'pro' ? "Donneur d'ordres" : 'Client particulier'}
                </div>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="v22-msg-thread">
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                  <div style={{ width: 24, height: 24, border: '2px solid var(--v22-border)', borderTopColor: 'var(--v22-yellow)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : messages.length === 0 ? (
                <div className="v22-msg-empty">
                  <div style={{ fontSize: 40, marginBottom: 8 }}>{activeConv.contact_type === 'pro' ? '\uD83C\uDFE2' : '\uD83C\uDFE0'}</div>
                  <div>Conversation ouverte</div>
                  <div style={{ marginTop: 4, fontSize: 11 }}>Aucun message pour le moment. Envoyez un message pour d\u00E9marrer.</div>
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
            <div className="v22-msg-input-area">
              {/* Quick templates */}
              <div className="v22-msg-templates">
                {quickTemplates.map(txt => (
                  <button key={txt} onClick={() => setInputValue(txt)} className="v22-msg-tpl">
                    {txt}
                  </button>
                ))}
              </div>
              {/* Textarea + Send */}
              <div className="v22-msg-compose">
                <textarea
                  ref={inputRef}
                  className="v22-msg-textarea"
                  placeholder={`Message \u00E0 ${activeConv.contact_name || 'votre contact'}\u2026`}
                  value={inputValue}
                  rows={2}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || sending}
                  className="v22-msg-send"
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
        <div className="v22-modal-overlay">
          <div className="v22-modal" style={{ maxWidth: 380 }}>
            <div className="v22-modal-head">
              <div className="v22-modal-title">{'\uD83D\uDD50'} Accepter la mission</div>
              <button onClick={() => setShowTimePickerForMsg(null)} className="v22-modal-close">{'\u2715'}</button>
            </div>
            <div className="v22-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>
                Indiquez votre heure d&apos;arriv\u00E9e et la dur\u00E9e estim\u00E9e
              </div>

              {/* Heure d'arrivée */}
              <div>
                <div className="v22-form-label" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Heure d&apos;arriv\u00E9e
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <input
                    type="time"
                    value={arrivalTime}
                    onChange={e => setArrivalTime(e.target.value)}
                    className="v22-form-input"
                    style={{ fontSize: 22, fontWeight: 600, textAlign: 'center', padding: '8px 16px', width: 'auto' }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                  {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'].map(t => (
                    <button
                      key={t}
                      onClick={() => setArrivalTime(t)}
                      className={`v22-btn v22-btn-sm ${arrivalTime === t ? 'v22-btn-primary' : ''}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Durée estimée */}
              <div>
                <div className="v22-form-label" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Dur\u00E9e estim\u00E9e
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    { label: '30 min', value: 0.5 },
                    { label: '1 h', value: 1 },
                    { label: '1 h 30', value: 1.5 },
                    { label: '2 h', value: 2 },
                    { label: '3 h', value: 3 },
                    { label: '4 h', value: 4 },
                    { label: '\u00BD journ\u00E9e', value: 4 },
                    { label: 'Journ\u00E9e', value: 8 },
                    { label: '2 jours', value: 16 },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => setDurationHours(opt.value)}
                      className={`v22-btn v22-btn-sm ${durationHours === opt.value ? 'v22-btn-primary' : ''}`}
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
                  color: 'var(--v22-text-mid)',
                  background: 'var(--v22-yellow-light)',
                  borderRadius: 3,
                  padding: '6px 0',
                  border: '1px solid var(--v22-yellow-border)',
                }}>
                  {'\uD83D\uDCC5'} Cr\u00E9neau bloqu\u00E9 : {arrivalTime} {'\u2192'}{' '}
                  {(() => {
                    const [h, m] = arrivalTime.split(':').map(Number)
                    const totalMin = h * 60 + m + Math.round(durationHours * 60)
                    return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
                  })()}
                </div>
              </div>
            </div>
            <div className="v22-modal-foot" style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowTimePickerForMsg(null)} className="v22-btn" style={{ flex: 1 }}>
                Annuler
              </button>
              <button onClick={confirmAcceptWithTime} className="v22-btn v22-btn-green" style={{ flex: 1 }}>
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
      <div className="v22-msg-system">
        <span className="v22-msg-system-text">
          {msg.content}
          <br />
          <span style={{ fontSize: 9, color: 'var(--v22-text-muted)' }}>{time}</span>
        </span>
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

  return (
    <div className={`v22-msg-bubble-row ${isOwn ? 'own' : ''}`}>
      <div className={`v22-msg-bubble-avatar ${isOwn ? 'own' : ''}`}>
        {avatarLetter}
      </div>
      <div className="v22-msg-bubble-col">
        <span className="v22-msg-bubble-sender">
          {senderLabel} {isOwn ? '\u00B7 Artisan' : contactType === 'pro' ? "\u00B7 Donneur d'ordres" : '\u00B7 Client'}
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

function OrdreMissionCard({ msg, isOwn, onAction, onProposerDevis, contactName }: {
  msg: Message
  isOwn: boolean
  onAction: (messageId: string, action: string, extraData?: Record<string, string>) => void
  onProposerDevis?: (data: { titre: string; description: string; adresse: string; date_souhaitee: string; contactName: string }) => void
  contactName?: string
}) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const dateFmtLocale = isPt ? 'pt-PT' : 'fr-FR'
  const URGENCE_CONFIG = getUrgenceConfig(isPt)
  const STATUT_CONFIG = getStatutConfig(isPt)
  const om = msg.ordre_mission!
  const urgence = URGENCE_CONFIG[om.urgence] || URGENCE_CONFIG.normale
  const statut = STATUT_CONFIG[om.statut] || STATUT_CONFIG.en_attente

  return (
    <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
      <div className="v22-card v22-msg-mission">
        {/* Header */}
        <div className="v22-msg-mission-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{'\uD83D\uDCCB'}</span>
            <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--v22-text)' }}>Ordre de mission</span>
          </div>
          <span className={urgence.tagClass}>{urgence.label}</span>
        </div>

        {/* Body */}
        <div className="v22-msg-mission-body">
          <div className="v22-msg-mission-title">{om.titre || 'Mission'}</div>

          {om.adresse && (
            <div className="v22-msg-mission-row">
              <span>{'\uD83D\uDCCD'}</span>
              <span>{om.adresse}</span>
            </div>
          )}

          {om.date_souhaitee && (
            <div className="v22-msg-mission-row">
              <span>{'\uD83D\uDCC5'}</span>
              <span>{new Date(om.date_souhaitee + 'T12:00:00').toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
          )}

          {om.arrival_time && (om.statut === 'accepte' || om.statut === 'en_cours' || om.statut === 'termine') && (
            <div className="v22-msg-arrival-info">
              <span>{'\uD83D\uDD50'}</span>
              <span>Arriv\u00E9e pr\u00E9vue \u00E0 {om.arrival_time}</span>
            </div>
          )}

          {om.description && (
            <div className="v22-msg-mission-desc">{om.description}</div>
          )}

          {/* Statut */}
          <span className={statut.tagClass}>{statut.label}</span>
        </div>

        {/* Actions (seulement si en_attente et c'est l'artisan qui voit) */}
        {om.statut === 'en_attente' && !isOwn && (
          <div className="v22-msg-mission-foot">
            <button onClick={() => onAction(msg.id, 'accepte')} className="v22-btn v22-btn-green">
              {'\u2713'} Accepter
            </button>
            <button onClick={() => onAction(msg.id, 'refuse')} className="v22-btn v22-btn-red-outline">
              {'\u2715'} Refuser
            </button>
          </div>
        )}

        {om.statut === 'accepte' && !isOwn && (
          <div className="v22-msg-mission-foot">
            <button onClick={() => onAction(msg.id, 'en_cours')} className="v22-btn v22-btn-blue" style={{ flex: 1 }}>
              {'\uD83D\uDD27'} D\u00E9marrer l&apos;intervention
            </button>
          </div>
        )}

        {om.statut === 'en_cours' && !isOwn && (
          <div className="v22-msg-mission-foot">
            <button onClick={() => onAction(msg.id, 'termine')} className="v22-btn v22-btn-green" style={{ flex: 1 }}>
              {'\u2705'} Marquer comme termin\u00E9
            </button>
          </div>
        )}

        {/* Bouton Proposer un devis */}
        {(om.statut === 'accepte' || om.statut === 'en_cours' || om.statut === 'termine') && !isOwn && onProposerDevis && (
          <div className="v22-msg-mission-foot">
            <button
              onClick={() => onProposerDevis({
                titre: om.titre || '',
                description: om.description || '',
                adresse: om.adresse || '',
                date_souhaitee: om.date_souhaitee || '',
                contactName: contactName || '',
              })}
              className="v22-btn v22-btn-primary"
              style={{ flex: 1 }}
            >
              {'\uD83D\uDCC4'} Proposer un devis
            </button>
          </div>
        )}

        {/* Timestamp */}
        <div style={{ padding: '0 14px 8px', textAlign: 'right' }}>
          <span className="v22-mono" style={{ fontSize: 10, color: 'var(--v22-text-muted)' }}>
            {new Date(msg.created_at).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  )
}
