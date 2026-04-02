'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { MessageSquare, Send, X, Calendar, FileText, Loader2, Mic, Camera } from 'lucide-react'
import { FixyAvatar } from '@/components/common/RobotAvatars'
import ReceiptScanner, { type DevisReceiptLine } from '@/components/common/ReceiptScanner'
import { useLocale } from '@/lib/i18n/context'
import {
  parseDate, parseTime, parseClientName, parseServiceMatch, parseAmount, parseAddress,
  detectIntent, formatDateFr, formatRecordingTime,
  findClientByName, findServiceByVoice,
  type ClientData, type ServiceItem, type Intent,
} from '@/lib/chat-parsers'
import DocumentPreviewCard from './DocumentPreviewCard'
import type { Artisan } from '@/lib/types'

type DocumentPreview = {
  type: 'devis' | 'facture' | 'rapport'
  clientName: string
  address?: string
  time?: string
  service?: string
  amount?: string
  status: string
  data: Record<string, unknown>
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  action?: {
    type: 'create_rdv' | 'create_devis' | 'create_facture' | 'info'
    data?: Record<string, unknown>
    confirmed?: boolean
  }
  actionsExecuted?: Array<{ tool: string; result: string; detail: string }>
  pendingConfirmation?: { tool: string; params: Record<string, unknown>; description: string; confirm_token: string }
  documentPreview?: DocumentPreview
}

type ArtisanProfile = Artisan

interface BookingItem {
  id: string
  booking_date: string
  booking_time: string
  status: string
  client_name?: string
  address?: string
  service_id?: string
  price_ttc?: number
  notes?: string
  services?: { name: string }
  [key: string]: unknown
}

interface AvailabilitySlot {
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
  [key: string]: unknown
}

interface AbsenceItem {
  start_date: string
  end_date: string
  reason?: string
  [key: string]: unknown
}

type AiChatBotProps = {
  artisan: ArtisanProfile
  bookings: BookingItem[]
  services: ServiceItem[]
  availability?: AvailabilitySlot[]
  dayServices?: Record<string, string[]>
  absences?: AbsenceItem[]
  onCreateRdv: (data: { client_name: string; date: string; time: string; service_id?: string; address?: string; notes?: string }) => void
  onCreateDevis: (data: Record<string, unknown>) => void
  onNavigate: (page: string) => void
  onDataRefresh?: () => void
}

// Parser utilities imported from lib/chat-parsers.ts

const ARTISAN_BTN_SIZE = 64
const ARTISAN_BTN_KEY = 'fixy_artisan_btn_pos'

export default function AiChatBot({ artisan, bookings, services, availability, dayServices, absences, onCreateRdv, onCreateDevis, onNavigate, onDataRefresh }: AiChatBotProps) {
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [pendingAction, setPendingAction] = useState<Message | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Draggable button state ──
  const [btnPos, setBtnPos] = useState<{ x: number; y: number }>({ x: -1, y: -1 })
  const dragRef = useRef<{ startX: number; startY: number; startBtnX: number; startBtnY: number; dragging: boolean; moved: boolean }>({
    startX: 0, startY: 0, startBtnX: 0, startBtnY: 0, dragging: false, moved: false,
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ARTISAN_BTN_KEY)
      if (saved) {
        const pos = JSON.parse(saved)
        const vw = window.innerWidth
        const vh = window.innerHeight
        setBtnPos({ x: Math.min(Math.max(0, pos.x), vw - ARTISAN_BTN_SIZE), y: Math.min(Math.max(0, pos.y), vh - ARTISAN_BTN_SIZE) })
        return
      }
    } catch { /* ignore */ }
    setBtnPos({ x: window.innerWidth - ARTISAN_BTN_SIZE - 24, y: window.innerHeight - ARTISAN_BTN_SIZE - 24 })
  }, [])

  useEffect(() => {
    const onResize = () => {
      setBtnPos(prev => {
        if (prev.x < 0) return prev
        return { x: Math.min(prev.x, window.innerWidth - ARTISAN_BTN_SIZE), y: Math.min(prev.y, window.innerHeight - ARTISAN_BTN_SIZE) }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleArtisanDragStart = (clientX: number, clientY: number) => {
    dragRef.current = { startX: clientX, startY: clientY, startBtnX: btnPos.x, startBtnY: btnPos.y, dragging: true, moved: false }
  }
  const handleArtisanDragMove = (clientX: number, clientY: number) => {
    const d = dragRef.current
    if (!d.dragging) return
    const dx = clientX - d.startX
    const dy = clientY - d.startY
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) d.moved = true
    if (!d.moved) return
    setBtnPos({
      x: Math.min(Math.max(0, d.startBtnX + dx), window.innerWidth - ARTISAN_BTN_SIZE),
      y: Math.min(Math.max(0, d.startBtnY + dy), window.innerHeight - ARTISAN_BTN_SIZE),
    })
  }
  const handleArtisanDragEnd = () => {
    const d = dragRef.current
    d.dragging = false
    if (d.moved) {
      try { localStorage.setItem(ARTISAN_BTN_KEY, JSON.stringify(btnPos)) } catch { /* ignore */ }
    } else {
      setIsOpen(true)
    }
  }
  const onArtisanMouseDown = (e: React.MouseEvent) => { e.preventDefault(); handleArtisanDragStart(e.clientX, e.clientY) }
  const onArtisanTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; handleArtisanDragStart(t.clientX, t.clientY) }

  useEffect(() => {
    const onMM = (e: MouseEvent) => handleArtisanDragMove(e.clientX, e.clientY)
    const onMU = () => { if (dragRef.current.dragging) handleArtisanDragEnd() }
    const onTM = (e: TouchEvent) => { const t = e.touches[0]; handleArtisanDragMove(t.clientX, t.clientY) }
    const onTE = () => { if (dragRef.current.dragging) handleArtisanDragEnd() }
    window.addEventListener('mousemove', onMM)
    window.addEventListener('mouseup', onMU)
    window.addEventListener('touchmove', onTM, { passive: true })
    window.addEventListener('touchend', onTE)
    return () => { window.removeEventListener('mousemove', onMM); window.removeEventListener('mouseup', onMU); window.removeEventListener('touchmove', onTM); window.removeEventListener('touchend', onTE) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [btnPos])

  const getArtisanChatStyle = (): React.CSSProperties => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const chatW = Math.min(400, vw - 32)
    const chatH = Math.min(600, vh - 48)
    const btnCenterX = btnPos.x + ARTISAN_BTN_SIZE / 2
    const btnCenterY = btnPos.y + ARTISAN_BTN_SIZE / 2
    const style: React.CSSProperties = { width: chatW, height: chatH, position: 'fixed', zIndex: 50 }
    if (btnCenterX > vw / 2) { style.right = Math.max(16, vw - btnPos.x - ARTISAN_BTN_SIZE) } else { style.left = Math.max(16, btnPos.x) }
    if (btnCenterY > vh / 2) { style.bottom = Math.max(16, vh - btnPos.y + 8) } else { style.top = Math.max(16, btnPos.y + ARTISAN_BTN_SIZE + 8) }
    return style
  }

  // ─── Client database ───
  const [clients, setClients] = useState<ClientData[]>([])
  const [clientsLoaded, setClientsLoaded] = useState(false)

  // ─── Voice Recording (Push-to-Talk) ───
  const [showReceiptScanner, setShowReceiptScanner] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [recordingDuration, setRecordingDuration] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Web Speech API has no built-in TS types
  const recognitionRef = useRef<ReturnType<typeof Object> | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if Web Speech API is available
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (SpeechRecognition) {
      setVoiceSupported(true)
    }
  }, [])

  // Load artisan's client database
  useEffect(() => {
    if (artisan?.id && !clientsLoaded) {
      fetch(`/api/artisan-clients?artisan_id=${artisan.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.clients) {
            setClients(data.clients)
          }
          setClientsLoaded(true)
        })
        .catch(() => { setClientsLoaded(true); toast.error('Impossible de charger la liste des clients') })
    }
  }, [artisan?.id, clientsLoaded])

  const startVoiceRecording = useCallback(() => {
    const w = window as unknown as Record<string, unknown>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Web Speech API constructor
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition as any
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    let finalTranscript = ''
    let interimTranscript = ''

    recognition.onresult = (event: { results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } } }) => {
      finalTranscript = ''
      interimTranscript = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        } else {
          interimTranscript += event.results[i][0].transcript
        }
      }
      const full = (finalTranscript + interimTranscript).trim()
      setVoiceTranscript(full)
      setInput(full)
    }

    recognition.onerror = (event: { error: string }) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        setVoiceSupported(false)
      }
      setIsRecording(false)
      setRecordingDuration(0)
    }

    recognition.onend = () => {
      // Will be handled by stopVoiceRecording
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setIsRecording(true)
      setVoiceTranscript('')
      setRecordingDuration(0)

      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } catch (e) {
      console.error('Failed to start speech recognition:', e)
    }
  }, [])

  const [voicePendingSend, setVoicePendingSend] = useState(false)

  const stopVoiceRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setIsRecording(false)
    setRecordingDuration(0)

    // Flag that we need to auto-send the transcribed text
    setVoicePendingSend(true)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-send voice transcript when recording stops
  useEffect(() => {
    if (voicePendingSend && !isRecording) {
      setVoicePendingSend(false)
      // Small delay to ensure final transcript is captured
      const timer = setTimeout(() => {
        setInput(prev => {
          if (prev.trim()) {
            processMessage(prev.trim())
            return ''
          }
          return prev
        })
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [voicePendingSend, isRecording])

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: locale === 'pt'
          ? `Olá! Sou o Fixy, o seu assistente pessoal! 🔧\n\nGiro **tudo** na sua conta:\n\n📅 **Marcações** : "Marcação terça 14h Sr. Silva"\n⏰ **Disponibilidades** : "Ativa segunda a sexta 9h-18h"\n🔧 **Motivos** : "Ativa todos os meus motivos"\n📄 **Orçamentos/Faturas** : "Orçamento poda 150€ Silva"\n👥 **Clientes** : "A minha lista de clientes"\n💰 **Receitas** : "Quanto ganhei este mês?"\n📊 **Declaração** : "A minha declaração trimestral"\n💬 **Mensagens** : "Mensagens da marcação de Silva"\n🏢 **Empresa** : "O meu NIF"\n🧭 **Navegação** : "Abre a contabilidade"\n\n💡 Escreva como quiser, mesmo com erros, eu percebo!\n\nO que fazemos?`
          : `Salut ! Moi c'est Fixy, votre assistant personnel ! 🔧\n\nJe gère **tout** votre compte :\n\n📅 **RDV** : "RDV mardi 14h Mme Dupont"\n⏰ **Dispos** : "Active lundi à vendredi 9h-18h"\n🔧 **Motifs** : "Active tous mes motifs"\n📄 **Devis/Factures** : "Devis élagage 150€ Dupont"\n👥 **Clients** : "Ma liste de clients"\n💰 **Revenus** : "Combien j'ai gagné ce mois ?"\n📊 **URSSAF** : "Ma déclaration trimestrielle"\n💬 **Messages** : "Messages du RDV de Dupont"\n🏢 **Entreprise** : "Mon SIRET"\n🧭 **Navigation** : "Ouvre la comptabilité"\n\n💡 Écrivez comme vous voulez, même avec des fautes, je comprends !\n\nQu'est-ce qu'on fait ?\n\n📋 **Pour créer un devis/rapport par commande vocale, suivez cet ordre :**\n👤 1. Nom du client\n📍 2. À [adresse ou résidence]\n🕐 3. À [heure] ← optionnel\n🔧 4. [Type d'intervention]\n💶 5. [Prix]€\n\n✅ **Exemple** : "Devis Dupont à La Sauvagère à 14h ${services[0]?.name || 'élagage'} 850€"\n➕ **Nouveau motif** : "Devis Martin rue des Lilas nettoyage de façade 600€"\n\nJe confirmerai toujours ce que j'ai compris avant d'agir !`
      }])
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const addMessage = (role: 'user' | 'assistant', content: string, action?: Message['action']): Message => {
    const msg: Message = { id: Date.now().toString(), role, content, action }
    setMessages(prev => [...prev, msg])
    return msg
  }

  // ─── Conversation history for AI context (persisted in localStorage) ───
  const conversationHistoryRef = useRef<Array<{ role: string; content: string }>>([])

  // Load conversation history from localStorage on mount
  useEffect(() => {
    if (artisan?.id) {
      try {
        const saved = localStorage.getItem(`fixy_conv_${artisan.id}`)
        if (saved) conversationHistoryRef.current = JSON.parse(saved)
      } catch (e) { console.warn('[AiChatBot] Failed to load conversation history:', e) }
    }
  }, [artisan?.id])

  const saveConversationHistory = () => {
    if (artisan?.id) {
      try {
        // Keep last 20 messages max in storage
        const toSave = conversationHistoryRef.current.slice(-20)
        localStorage.setItem(`fixy_conv_${artisan.id}`, JSON.stringify(toSave))
      } catch (e) { console.warn('[AiChatBot] Failed to save conversation history:', e) }
    }
  }

  // ─── AI-powered message processing (Fixy v2) ───
  const processMessageWithAI = async (text: string): Promise<boolean> => {
    try {
      // Build full context for server-side execution
      const context = {
        artisan_name: artisan?.company_name || 'Artisan',
        services: services.map((s: ServiceItem) => ({
          id: s.id, name: s.name, active: s.active !== false,
          price_ht: s.price_ht, price_ttc: s.price_ttc, duration_minutes: s.duration_minutes,
        })),
        availability: (availability || []).map((a: AvailabilitySlot) => ({
          id: a.id, day_of_week: a.day_of_week, is_available: a.is_available,
          start_time: a.start_time, end_time: a.end_time,
        })),
        dayServices: dayServices || {},
        bookings: bookings.slice(0, 15).map((b: BookingItem) => ({
          id: b.id, booking_date: b.booking_date, booking_time: b.booking_time,
          status: b.status, service_name: b.services?.name || 'Intervention',
          client_name: (b.notes || '').match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client',
        })),
        clients: clients.map(c => ({ name: c.name, email: c.email, phone: c.phone, address: c.address })),
        absences: (absences || []).map((a: AbsenceItem) => ({
          id: a.id, start_date: a.start_date, end_date: a.end_date, reason: a.reason, label: a.label,
        })),
      }

      // Add to conversation history
      conversationHistoryRef.current.push({ role: 'user', content: text })

      // Fetch with 30s timeout
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)

      const res = await fetch('/api/fixy-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          artisan_id: artisan?.id,
          context,
          conversation_history: conversationHistoryRef.current.slice(-12),
          locale,
        }),
      })
      clearTimeout(timeout)

      const data = await res.json()

      // If API not configured or error, fallback to regex
      if (!data.success && !data.response) return false

      const { response, actions_executed, pending_confirmation, client_actions } = data

      // Save assistant response in conversation history
      if (response) {
        conversationHistoryRef.current.push({ role: 'assistant', content: response })
        saveConversationHistory()
      }

      // Handle pending_confirmation (destructive action needing user approval)
      if (pending_confirmation) {
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response || `⚠️ ${pending_confirmation.description}`,
          actionsExecuted: actions_executed?.length ? actions_executed : undefined,
          pendingConfirmation: pending_confirmation,
        }
        setMessages(prev => [...prev, msg])
        setPendingAction(msg)
        return true
      }

      // Handle client_actions (open forms, navigate, refresh)
      let docPreview: DocumentPreview | undefined
      if (client_actions && Array.isArray(client_actions)) {
        for (const ca of client_actions) {
          if (ca.type === 'open_devis_form' || ca.type === 'open_facture_form' || ca.type === 'open_rapport_form') {
            const docType = ca.type === 'open_facture_form' ? 'facture' : ca.type === 'open_rapport_form' ? 'rapport' : 'devis'
            const caData = ca.data || {}
            // Build preview card instead of opening form immediately
            docPreview = {
              type: docType as 'devis' | 'facture' | 'rapport',
              clientName: (caData.clientName as string) || '',
              address: (caData.clientAddress as string) || (caData.address as string) || '',
              time: (caData.interventionDate as string) || '',
              service: (caData.service as string) || (caData.motif as string) || (caData.description as string) || '',
              amount: caData.amount ? `${caData.amount}€` : caData.price ? `${caData.price}€` : '',
              status: 'Brouillon',
              data: { ...caData, docType },
            }
          } else if (ca.type === 'navigate' && ca.page) {
            onNavigate(ca.page)
          } else if (ca.type === 'refresh_data' && onDataRefresh) {
            onDataRefresh()
          }
        }
      }

      // Display response with action badges + document preview card
      const msg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response || 'Action effectuée.',
        actionsExecuted: actions_executed?.length ? actions_executed : undefined,
        documentPreview: docPreview,
      }
      setMessages(prev => [...prev, msg])
      return true
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        addMessage('assistant', locale === 'pt' ? "⏱️ O Fixy está a demorar demasiado. Tente com um pedido mais simples." : "⏱️ Fixy met trop de temps à répondre. Réessayez avec une demande plus simple.")
        return true
      }
      console.error('AI processing error:', err)
      toast.error('Erreur de traitement IA')
      return false
    }
  }

  // ─── Fallback regex-based processing ───
  const processMessageFallback = async (text: string) => {
    const intent = detectIntent(text)

    switch (intent) {
      case 'create_rdv': {
        const date = parseDate(text)
        const time = parseTime(text)
        const clientName = parseClientName(text)
        const service = parseServiceMatch(text, services)
        const address = parseAddress(text)

        if (!date && !time && !clientName) {
          addMessage('assistant', "Je comprends que vous voulez créer un RDV. Pouvez-vous me donner plus de détails ?\n\nExemple : **RDV mardi 15h Mme Dupont**\n\nIl me faut au minimum :\n• Un **jour** (mardi, demain, 17/03...)\n• Une **heure** (14h, 15h30...)\n• Un **nom de client**")
          break
        }

        const missing: string[] = []
        if (!date) missing.push('la **date** (ex: mardi, demain, 15/03)')
        if (!time) missing.push("l'**heure** (ex: 14h, 9h30)")
        if (!clientName) missing.push('le **nom du client** (ex: Mme Dupont)')

        if (missing.length > 0) {
          addMessage('assistant', `Il me manque quelques informations pour créer le RDV :\n\n${missing.map(m => `• ${m}`).join('\n')}\n\nPouvez-vous compléter ?`)
          break
        }

        const rdvData = {
          client_name: clientName!,
          date: date!,
          time: time!,
          service_id: service?.id || '',
          address: address || '',
          notes: '',
        }

        const summary = `Voici le RDV que je vais créer :\n\n📅 **Date** : ${formatDateFr(date!, dateFmtLocale)}\n⏰ **Heure** : ${time}\n👤 **Client** : ${clientName}${service ? `\n🔧 **Service** : ${service.name}` : ''}${address ? `\n📍 **Adresse** : ${address}` : ''}\n\n**Confirmez-vous ?** (oui/non)`

        const msg = addMessage('assistant', summary, { type: 'create_rdv', data: rdvData })
        setPendingAction(msg)
        break
      }

      case 'create_devis':
      case 'create_facture': {
        const clientName = parseClientName(text)
        const service = parseServiceMatch(text, services)
        const amount = parseAmount(text)
        const address = parseAddress(text)
        const isFacture = intent === 'create_facture'
        const docType = isFacture ? 'facture' : 'devis'

        const matchedClient = clientName ? findClientByName(clientName, clients) : null

        const devisData: Record<string, unknown> = {
          docType,
          clientName: matchedClient?.name || clientName || '',
          clientEmail: matchedClient?.email || '',
          clientPhone: matchedClient?.phone || '',
          clientAddress: matchedClient?.address || address || '',
          clientSiret: matchedClient?.siret || '',
          service: service?.name || '',
          amount: amount || service?.price_ttc || 0,
          address: matchedClient?.address || address || '',
          clientFound: !!matchedClient,
        }

        if (amount || service) {
          const desc = service?.name || 'Prestation'
          const priceHT = amount ? (amount / 1.2) : (service?.price_ht || 0)
          devisData.lines = [{
            id: Date.now(),
            description: desc,
            qty: 1,
            unit: 'u',
            priceHT: Math.round(priceHT * 100) / 100,
            tvaRate: 20,
            totalHT: Math.round(priceHT * 100) / 100,
          }]
        }

        let summary = `Je vais préparer ${isFacture ? 'une facture' : 'un devis'} :\n\n`

        if (matchedClient) {
          summary += `👤 **Client** : ${matchedClient.name} ✅ (trouvé dans votre base)\n`
          if (matchedClient.phone) summary += `📞 **Tél** : ${matchedClient.phone}\n`
          if (matchedClient.email) summary += `📧 **Email** : ${matchedClient.email}\n`
          if (matchedClient.address) summary += `📍 **Adresse** : ${matchedClient.address}\n`
        } else if (clientName) {
          summary += `👤 **Client** : ${clientName} (non trouvé dans la base)\n`
        }

        if (service) summary += `🔧 **Service** : ${service.name}\n`
        if (amount) summary += `💰 **Montant TTC** : ${amount.toFixed(2)}€\n`
        else if (service?.price_ttc) summary += `💰 **Montant TTC** : ${service.price_ttc?.toFixed(2)}€\n`
        if (address && !matchedClient?.address) summary += `📍 **Adresse** : ${address}\n`

        if (!clientName && !service && !amount) {
          summary = `Je vais ouvrir le formulaire de ${docType}. Vous pourrez remplir les détails directement.\n\n**Ouvrir le formulaire ?** (oui/non)`
        } else {
          summary += `\n**Ouvrir le formulaire pré-rempli ?** (oui/non)`
        }

        const msg = addMessage('assistant', summary, { type: intent, data: devisData })
        setPendingAction(msg)
        break
      }

      case 'list_rdv': {
        const upcoming = bookings
          .filter(b => b.booking_date >= new Date().toISOString().split('T')[0] && b.status !== 'cancelled')
          .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || (a.booking_time || '').localeCompare(b.booking_time || ''))
          .slice(0, 5)

        if (upcoming.length === 0) {
          addMessage('assistant', "Vous n'avez aucun rendez-vous à venir. Voulez-vous en créer un ?")
        } else {
          let list = '📋 **Vos prochains RDV** :\n\n'
          upcoming.forEach((b, i) => {
            const notes = b.notes || ''
            const clientMatch = notes.match(/Client:\s*([^|]+)/)
            const clientName = clientMatch ? clientMatch[1].trim() : 'Client'
            list += `${i + 1}. **${formatDateFr(b.booking_date, dateFmtLocale)}** à ${b.booking_time?.substring(0, 5) || '?'}\n   ${b.services?.name || 'Intervention'} — ${clientName}\n\n`
          })
          addMessage('assistant', list)
        }
        break
      }

      case 'help': {
        addMessage('assistant', locale === 'pt'
          ? `É o Fixy! Aqui está tudo o que sei fazer 💪\n\n🗓️ **Criar marcação** :\n• "Marcação terça 14h Sr. Silva"\n• "Visita amanhã 10h casa do Sr. Costa"\n\n📄 **Criar orçamento** :\n• "Orçamento poda 150€ para Carlos Silva"\n• "Cria orçamento motivo canalização preço 250€ cliente Ferreira"\n\n🧾 **Criar fatura** :\n• "Fatura intervenção Sra. Santos 180€"\n\n📋 **Ver agenda** :\n• "As minhas próximas marcações"\n• "A minha agenda"\n\n💡 **Base de clientes** : Encontro automaticamente os seus clientes e preencho as informações!\n\nFale comigo naturalmente, percebo tudo!`
          : `C'est Fixy ! Voici tout ce que je sais faire 💪\n\n🗓️ **Créer un RDV** :\n• "RDV mardi 14h Mme Dupont"\n• "Rendez-vous demain 10h chez M. Martin"\n\n📄 **Créer un devis** :\n• "Devis élagage 150€ pour Frédéric Neiva Carvalho"\n• "Crée le devis motif plomberie prix 250€ pour le client Dupont"\n\n🧾 **Créer une facture** :\n• "Facture intervention Mme Legrand 180€"\n\n📋 **Voir le planning** :\n• "Mes prochains RDV"\n• "Mon agenda"\n\n💡 **Base clients** : Je retrouve automatiquement vos clients et pré-remplis leurs infos !\n\nParlez-moi naturellement, je comprends !`)
        break
      }

      default: {
        addMessage('assistant', locale === 'pt'
          ? "Não percebi bem. Pode reformular?\n\nExemplos :\n• **Marcação terça 15h Sr. Silva**\n• **Orçamento canalização 200€ Sr. Costa**\n• **As minhas próximas marcações**\n\nEscreva **ajuda** para ver todos os comandos."
          : "Je n'ai pas bien compris. Pouvez-vous reformuler ?\n\nExemples :\n• **RDV mardi 15h Mme Dupont**\n• **Devis plomberie 200€ M. Martin**\n• **Mes prochains RDV**\n\nDites **aide** pour voir toutes les commandes.")
      }
    }
  }

  const processMessage = async (text: string) => {
    if (!text.trim()) return
    addMessage('user', text)
    setInput('')
    setProcessing(true)

    try {
      // Try AI-powered processing first
      const handled = await processMessageWithAI(text)
      if (!handled) {
        // Fallback to regex-based processing
        await processMessageFallback(text)
      }
    } catch (error) {
      console.error('[AiChatBot] AI processing failed, using fallback:', error instanceof Error ? error.message : error)
      await processMessageFallback(text)
    }

    setProcessing(false)
  }

  const handleConfirmation = async (confirmed: boolean) => {
    if (!pendingAction) return

    // Server-side confirmation (new Fixy v2 flow)
    if (pendingAction.pendingConfirmation) {
      const pc = pendingAction.pendingConfirmation
      if (!confirmed) {
        addMessage('assistant', locale === 'pt' ? "Sem problema, cancelado! O que posso fazer mais?" : "Pas de problème, c'est annulé ! Que puis-je faire d'autre ?")
        setPendingAction(null)
        return
      }

      setProcessing(true)
      try {
        const res = await fetch('/api/fixy-ai', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artisan_id: artisan?.id,
            confirm_token: pc.confirm_token,
            confirmed: true,
            locale,
          }),
        })
        const result = await res.json()
        if (result.success) {
          addMessage('assistant', `✅ **${pc.description}** — ${result.detail || 'Fait !'}`)
          onDataRefresh?.()
        } else {
          addMessage('assistant', `❌ ${result.detail || 'Erreur lors de l\'exécution.'}`)
        }
      } catch (error) {
        console.error('[AiChatBot] Confirmation request failed:', error instanceof Error ? error.message : error)
        addMessage('assistant', locale === 'pt' ? "❌ Erro de ligação. Tente novamente." : "❌ Erreur de connexion. Réessayez.")
      }
      setProcessing(false)
      setPendingAction(null)
      return
    }

    // Legacy client-side confirmation (create_rdv, create_devis from fallback)
    if (!pendingAction.action) return

    if (!confirmed) {
      addMessage('assistant', locale === 'pt' ? "Sem problema, cancelado! O que posso fazer mais?" : "Pas de problème, c'est annulé ! Que puis-je faire d'autre ?")
      setPendingAction(null)
      return
    }

    const { type, data } = pendingAction.action
    const rdvData = data as { client_name: string; date: string; time: string; service_id?: string; address?: string; notes?: string; docType?: string } | undefined

    switch (type) {
      case 'create_rdv': {
        try {
          if (!rdvData) throw new Error('Missing data')
          onCreateRdv(rdvData)
          addMessage('assistant', locale === 'pt'
            ? `✅ **Marcação criada com sucesso!**\n\n${formatDateFr(rdvData.date, dateFmtLocale)} às ${rdvData.time} com ${rdvData.client_name}.\n\nA marcação foi adicionada à sua agenda.`
            : `✅ **RDV créé avec succès !**\n\n${formatDateFr(rdvData.date, dateFmtLocale)} à ${rdvData.time} avec ${rdvData.client_name}.\n\nLe rendez-vous a été ajouté à votre agenda.`)
        } catch (error) {
          console.error('[AiChatBot] RDV creation failed:', error instanceof Error ? error.message : error)
          addMessage('assistant', locale === 'pt' ? "❌ Ocorreu um erro ao criar a marcação. Por favor tente novamente." : "❌ Une erreur est survenue lors de la création du RDV. Veuillez réessayer.")
        }
        break
      }

      case 'create_devis':
      case 'create_facture': {
        onCreateDevis(rdvData || {})
        addMessage('assistant', locale === 'pt'
          ? `✅ **Formulário de ${rdvData?.docType || type} aberto!**\n\nAs informações foram pré-preenchidas. Complete os detalhes e valide.`
          : `✅ **Formulaire de ${rdvData?.docType || type} ouvert !**\n\nLes informations ont été pré-remplies. Complétez les détails et validez.`)
        setTimeout(() => setIsOpen(false), 1500)
        break
      }
    }

    setPendingAction(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || processing) return

    // Check if this is a confirmation response
    if (pendingAction) {
      const lower = input.toLowerCase().trim()
      if (lower === 'oui' || lower === 'o' || lower === 'yes' || lower === 'ok' || lower === 'confirme' || lower === 'confirmer' || lower === 'c\'est bon' || lower === 'go' || lower === 'valide') {
        addMessage('user', input)
        setInput('')
        handleConfirmation(true)
        return
      }
      if (lower === 'non' || lower === 'n' || lower === 'no' || lower === 'annule' || lower === 'annuler') {
        addMessage('user', input)
        setInput('')
        handleConfirmation(false)
        return
      }
      // If not a clear yes/no, treat as a new message
      setPendingAction(null)
    }

    // Check if user is selecting a document to link to a rapport
    const pendingLinkRaw = sessionStorage.getItem('fixit_pending_rapport_link')
    if (pendingLinkRaw) {
      try {
        const pendingLink = JSON.parse(pendingLinkRaw) as { type: 'devis' | 'facture'; rapportMsgId: string; docs: Array<{ id: string; clientName?: string; service?: string; totalTTC?: number; [k: string]: unknown }> }
        const num = parseInt(input.trim(), 10)
        if (num >= 1 && num <= pendingLink.docs.length) {
          const selectedDoc = pendingLink.docs[num - 1]
          addMessage('user', input)
          setInput('')
          sessionStorage.removeItem('fixit_pending_rapport_link')
          // Update the rapport in localStorage with the linked document ID
          const rapportsKey = `fixit_rapports_${artisan.id}`
          try {
            const rapports: Array<{ id: string; linkedDevisId?: string | null; linkedFactureId?: string | null; linkedDevisRef?: string; linkedFactureRef?: string; [k: string]: unknown }> = JSON.parse(localStorage.getItem(rapportsKey) || '[]')
            // Find the most recently added rapport (the one just confirmed)
            const lastRapport = rapports[rapports.length - 1]
            if (lastRapport) {
              const docLabel = selectedDoc.service || selectedDoc.clientName || selectedDoc.id
              if (pendingLink.type === 'devis') {
                lastRapport.linkedDevisId = selectedDoc.id
                lastRapport.linkedDevisRef = `Devis ${docLabel}`
              } else {
                lastRapport.linkedFactureId = selectedDoc.id
                lastRapport.linkedFactureRef = `Facture ${docLabel}`
              }
              localStorage.setItem(rapportsKey, JSON.stringify(rapports))
            }
          } catch { /* ignore localStorage errors */ }
          // Update preview status to Lié
          setMessages(prev => prev.map(m =>
            m.id === pendingLink.rapportMsgId && m.documentPreview
              ? { ...m, documentPreview: { ...m.documentPreview!, status: 'Envoi?' } }
              : m
          ))
          const docTypeLabel = pendingLink.type === 'devis' ? 'devis' : 'facture'
          addMessage('assistant', `${pendingLink.type === 'devis' ? '📋' : '🧾'} **Rapport lié à la ${docTypeLabel} : ${selectedDoc.clientName} — ${selectedDoc.service || 'Service'} — ${selectedDoc.totalTTC ?? '—'}€**\n\nVoulez-vous envoyer ce rapport au client maintenant ?`)
          return
        }
      } catch { /* ignore parse errors */ }
      sessionStorage.removeItem('fixit_pending_rapport_link')
    }

    processMessage(input)
  }

  // Quick action buttons
  const quickActions = [
    { label: 'Nouveau RDV', icon: '📅', prompt: 'Je veux créer un rendez-vous' },
    { label: 'Mes dispos', icon: '⏰', prompt: 'C\'est quoi mes disponibilités ?' },
    { label: 'Faire un devis', icon: '📄', prompt: 'Je veux faire un devis' },
    { label: 'Mon planning', icon: '📋', prompt: 'Mes prochains RDV' },
  ]

  return (
    <>
      {/* Floating draggable button */}
      {!isOpen && btnPos.x >= 0 && (
        <div
          onMouseDown={onArtisanMouseDown}
          onTouchStart={onArtisanTouchStart}
          className="fixed z-50 bg-white hover:bg-amber-50 rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center cursor-grab active:cursor-grabbing select-none border-2 border-[#FFC107]"
          style={{ left: btnPos.x, top: btnPos.y, width: ARTISAN_BTN_SIZE, height: ARTISAN_BTN_SIZE, touchAction: 'none' }}
          title="Fixy — votre assistant"
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(true) }}
        >
          <div className="pointer-events-none">
            <FixyAvatar size={42} />
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white animate-pulse pointer-events-none"></span>
        </div>
      )}

      {/* Chat window — positioned relative to button */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden max-w-[calc(100vw-2rem)]" style={getArtisanChatStyle()}>
          {/* Header */}
          <div className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                <FixyAvatar size={32} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Fixy</h3>
                <p className="text-[11px] text-gray-700 opacity-80">Votre assistant personnel</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition"
            >
              <X className="w-5 h-5 text-gray-900" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 flex-shrink-0 mt-1">
                    <FixyAvatar size={28} />
                  </div>
                )}
                <div className="max-w-[80%]">
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#FFC107] text-gray-900 rounded-br-md'
                        : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                    }`}
                  >
                    {msg.content.split(/(\*\*.*?\*\*)/).map((part, i) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={i}>{part.slice(2, -2)}</strong>
                      }
                      return <span key={i}>{part}</span>
                    })}
                  </div>
                  {/* Action result badges */}
                  {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {msg.actionsExecuted.map((a, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            a.result === 'success'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                          title={a.detail}
                        >
                          {a.result === 'success' ? '✓' : '✗'} {a.tool.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Document preview card */}
                  {msg.documentPreview && (
                    <DocumentPreviewCard
                      msg={msg}
                      artisanId={artisan.id}
                      onCreateDevis={onCreateDevis}
                      onNavigate={onNavigate}
                      setMessages={setMessages}
                      addMessage={addMessage}
                    />
                  )}
                </div>
              </div>
            ))}

            {/* Confirmation buttons when action is pending */}
            {pendingAction && (
              <div className="flex justify-start">
                <div className="flex gap-2 ml-1">
                  <button
                    onClick={() => {
                      addMessage('user', 'Oui')
                      handleConfirmation(true)
                    }}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1.5"
                  >
                    ✓ Confirmer
                  </button>
                  <button
                    onClick={() => {
                      addMessage('user', 'Non')
                      handleConfirmation(false)
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold transition flex items-center gap-1.5"
                  >
                    ✗ Annuler
                  </button>
                </div>
              </div>
            )}

            {processing && (
              <div className="flex justify-start gap-2">
                <div className="w-7 h-7 flex-shrink-0 mt-1">
                  <FixyAvatar size={28} />
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#FFC107]" />
                  <span className="text-sm text-gray-500">Fixy réfléchit...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions (only show at beginning) */}
          {messages.length <= 1 && (
            <div className="px-4 py-2 flex gap-2 border-t border-gray-100 bg-white flex-shrink-0">
              {quickActions.map((qa) => (
                <button
                  key={qa.label}
                  onClick={() => processMessage(qa.prompt)}
                  className="flex-1 py-2 px-2 bg-gray-50 hover:bg-amber-50 hover:border-[#FFC107] border border-gray-200 rounded-lg text-xs font-medium text-gray-700 transition flex items-center justify-center gap-1.5"
                >
                  <span>{qa.icon}</span>
                  {qa.label}
                </button>
              ))}
            </div>
          )}

          {/* Recording overlay */}
          {isRecording && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-red-700 font-medium flex-1">
                  {'🎙️'} Enregistrement en cours... {formatRecordingTime(recordingDuration)}
                </span>
                {voiceTranscript && (
                  <span className="text-xs text-red-500 italic truncate max-w-[150px]">{voiceTranscript}</span>
                )}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isRecording ? '🎙️ Parlez maintenant...' : pendingAction ? 'Répondez oui ou non...' : 'Ex: RDV mardi 14h Mme Dupont...'}
                aria-label="Message pour l'assistant IA"
                className={`flex-1 px-3.5 py-2.5 border-2 rounded-xl focus:outline-none transition text-sm ${
                  isRecording
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-gray-200 focus:border-[#FFC107]'
                }`}
                disabled={processing || isRecording}
              />

              {/* Receipt scanner button */}
              {!processing && !isRecording && (
                <button
                  type="button"
                  onClick={() => setShowReceiptScanner(true)}
                  className="p-2.5 bg-gray-100 hover:bg-amber-100 text-gray-600 hover:text-amber-700 rounded-xl transition flex-shrink-0"
                  title="Scanner un ticket de caisse"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}

              {/* Voice button (toggle: clic = start, reclic = stop & send) */}
              {voiceSupported && !processing && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    if (isRecording) {
                      stopVoiceRecording()
                    } else {
                      startVoiceRecording()
                    }
                  }}
                  className={`p-2.5 rounded-xl transition flex-shrink-0 select-none ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white scale-110 shadow-lg shadow-red-200'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800'
                  }`}
                  title={isRecording ? 'Cliquez pour arrêter' : 'Cliquez pour dicter'}
                >
                  <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
                </button>
              )}

              {/* Send button */}
              <button
                type="submit"
                disabled={processing || !input.trim() || isRecording}
                className="p-2.5 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-xl transition disabled:opacity-40 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {voiceSupported && !isRecording && (
              <p className="text-[10px] text-gray-500 mt-1 text-center">
                {'🎤'} Cliquez sur le micro pour dicter votre message
              </p>
            )}
          </form>
        </div>
      )}
      {/* Receipt Scanner Modal */}
      {showReceiptScanner && (
        <ReceiptScanner
          mode="modal"
          onClose={() => setShowReceiptScanner(false)}
          onInject={(lines: DevisReceiptLine[], storeName?: string) => {
            setShowReceiptScanner(false)
            // Add a message showing what was scanned
            const summary = lines.map(l => `• ${l.description} (x${l.qty}) — ${l.priceHT.toFixed(2)} EUR HT`).join('\n')
            const totalHT = lines.reduce((s, l) => s + l.totalHT, 0)
            setMessages(prev => [
              ...prev,
              {
                id: `scan-${Date.now()}`,
                role: 'assistant',
                content: `📋 **Ticket scanné${storeName ? ` — ${storeName}` : ''}**\n\n${summary}\n\n**Total HT (avec marge) : ${totalHT.toFixed(2)} EUR**\n\nLes ${lines.length} article(s) ont été préparés. Rendez-vous dans l'onglet Devis pour les retrouver.`,
                action: {
                  type: 'create_devis',
                  data: { receiptLines: lines, storeName },
                },
              },
            ])
            // Store in localStorage for DevisFactureForm to pick up
            try {
              const key = `fixit_receipt_pending_${artisan?.id || 'unknown'}`
              const pending = JSON.parse(localStorage.getItem(key) || '[]')
              pending.push({ lines, storeName, scannedAt: new Date().toISOString() })
              localStorage.setItem(key, JSON.stringify(pending))
            } catch { /* ignore */ }
          }}
        />
      )}
    </>
  )
}
