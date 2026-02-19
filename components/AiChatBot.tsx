'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageSquare, Send, X, Calendar, FileText, Loader2, Mic } from 'lucide-react'

// Avatar Fixy : petit robot avec clé à molette
function FixyAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <rect x="25" y="45" width="50" height="35" rx="8" fill="#FFC107"/>
      {/* Head */}
      <rect x="28" y="18" width="44" height="30" rx="10" fill="#FFD54F"/>
      {/* Eyes */}
      <circle cx="40" cy="30" r="5" fill="#1a1a2e"/>
      <circle cx="60" cy="30" r="5" fill="#1a1a2e"/>
      {/* Eye shine */}
      <circle cx="42" cy="28" r="1.5" fill="white"/>
      <circle cx="62" cy="28" r="1.5" fill="white"/>
      {/* Smile */}
      <path d="M42 38 Q50 44 58 38" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      {/* Antenna */}
      <line x1="50" y1="18" x2="50" y2="8" stroke="#FFC107" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="50" cy="6" r="4" fill="#FF9800"/>
      {/* Arms */}
      <rect x="12" y="50" width="13" height="6" rx="3" fill="#FFD54F"/>
      {/* Wrench in right hand */}
      <g transform="translate(72, 42) rotate(30)">
        <rect x="0" y="8" width="5" height="20" rx="2" fill="#78909C"/>
        <circle cx="2.5" cy="6" r="7" fill="none" stroke="#78909C" strokeWidth="4"/>
        <circle cx="2.5" cy="6" r="3" fill="#FFD54F"/>
      </g>
      {/* Legs */}
      <rect x="33" y="80" width="10" height="12" rx="4" fill="#FFD54F"/>
      <rect x="57" y="80" width="10" height="12" rx="4" fill="#FFD54F"/>
      {/* Belt detail */}
      <rect x="30" y="62" width="40" height="4" rx="2" fill="#FF9800"/>
      {/* Chest bolt */}
      <circle cx="50" cy="55" r="3" fill="#FF9800"/>
    </svg>
  )
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  action?: {
    type: 'create_rdv' | 'create_devis' | 'create_facture' | 'info'
    data?: any
    confirmed?: boolean
  }
}

type ClientData = {
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  siret: string
  source: 'auth' | 'booking_notes'
  bookings?: { id: string; date: string; service: string; status: string }[]
}

type AiChatBotProps = {
  artisan: any
  bookings: any[]
  services: any[]
  onCreateRdv: (data: { client_name: string; date: string; time: string; service_id?: string; address?: string; notes?: string }) => void
  onCreateDevis: (data: any) => void
  onNavigate: (page: string) => void
}

// ══════════════ PARSER INTELLIGENT ══════════════

function parseDate(text: string): string | null {
  const lower = text.toLowerCase()
  const now = new Date()

  // "aujourd'hui"
  if (lower.includes("aujourd'hui") || lower.includes('ajd') || lower.includes('today')) {
    return now.toISOString().split('T')[0]
  }

  // "demain"
  if (lower.includes('demain')) {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  // "après-demain"
  if (lower.includes('après-demain') || lower.includes('apres-demain') || lower.includes('après demain')) {
    const d = new Date(now)
    d.setDate(d.getDate() + 2)
    return d.toISOString().split('T')[0]
  }

  // Jours de la semaine
  const jours: Record<string, number> = {
    'lundi': 1, 'mardi': 2, 'mercredi': 3, 'jeudi': 4,
    'vendredi': 5, 'samedi': 6, 'dimanche': 0
  }
  for (const [jour, idx] of Object.entries(jours)) {
    if (lower.includes(jour)) {
      const d = new Date(now)
      const currentDay = d.getDay()
      let diff = idx - currentDay
      if (diff <= 0) diff += 7
      d.setDate(d.getDate() + diff)
      return d.toISOString().split('T')[0]
    }
  }

  // Date explicite: "17 mars", "17/03", "17-03-2025"
  const moisNoms: Record<string, number> = {
    'janvier': 0, 'février': 1, 'fevrier': 1, 'mars': 2, 'avril': 3,
    'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7, 'aout': 7,
    'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11, 'decembre': 11
  }

  // "17 mars" or "17 mars 2025"
  const dateTextMatch = lower.match(/(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)(?:\s+(\d{4}))?/)
  if (dateTextMatch) {
    const day = parseInt(dateTextMatch[1])
    const monthStr = dateTextMatch[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const month = moisNoms[monthStr] ?? moisNoms[Object.keys(moisNoms).find(k => k.startsWith(monthStr.slice(0, 3))) || ''] ?? 0
    const year = dateTextMatch[3] ? parseInt(dateTextMatch[3]) : now.getFullYear()
    const d = new Date(year, month, day)
    if (d < now) d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().split('T')[0]
  }

  // "17/03" or "17/03/2025"
  const dateSlashMatch = lower.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/)
  if (dateSlashMatch) {
    const day = parseInt(dateSlashMatch[1])
    const month = parseInt(dateSlashMatch[2]) - 1
    let year = dateSlashMatch[3] ? parseInt(dateSlashMatch[3]) : now.getFullYear()
    if (year < 100) year += 2000
    return new Date(year, month, day).toISOString().split('T')[0]
  }

  return null
}

function parseTime(text: string): string | null {
  const lower = text.toLowerCase()

  // "17h", "17h30", "17H00", "9h", "9h30"
  const hMatch = lower.match(/(\d{1,2})\s*h\s*(\d{0,2})/)
  if (hMatch) {
    const h = parseInt(hMatch[1])
    const m = hMatch[2] ? parseInt(hMatch[2]) : 0
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  // "17:30"
  const colonMatch = lower.match(/(\d{1,2}):(\d{2})/)
  if (colonMatch) {
    const h = parseInt(colonMatch[1])
    const m = parseInt(colonMatch[2])
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  // "midi"
  if (lower.includes('midi')) return '12:00'
  // Approximations
  if (lower.includes('matin')) return '09:00'
  if (lower.includes('après-midi') || lower.includes('aprem')) return '14:00'
  if (lower.includes('soir')) return '18:00'

  return null
}

function parseClientName(text: string): string | null {
  const lower = text.toLowerCase()

  // "Madame X", "Mme X", "Monsieur X", "M. X", "Mr X", "client X", "chez X"
  // Support multi-word names like "Frédéric Neiva Carvalho"
  const patterns = [
    /(?:madame|mme\.?|mme)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
    /(?:monsieur|mr\.?|m\.)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
    /(?:client[e]?|chez)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
    // "pour le client X Y Z" — match name after "client"
    /(?:pour\s+le\s+client|pour\s+la\s+cliente)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
    /(?:pour|avec)\s+([A-ZÀ-Ü][a-zà-ÿ]+(?:\s+[A-ZÀ-Ü][a-zà-ÿ]+)*)/i,
  ]

  // Common words that aren't names (expanded)
  const excluded = [
    'intervention', 'devis', 'facture', 'rendez', 'demain', 'mardi', 'mercredi',
    'jeudi', 'vendredi', 'samedi', 'dimanche', 'lundi', 'plomberie', 'electricite',
    'motif', 'prix', 'montant', 'service', 'prestation', 'travaux',
  ]

  for (const pat of patterns) {
    const match = text.match(pat)
    if (match) {
      let name = match[1].trim()
      // Remove trailing common words that got captured
      const nameWords = name.split(/\s+/)
      const cleanWords: string[] = []
      for (const w of nameWords) {
        if (excluded.some(e => w.toLowerCase().startsWith(e))) break
        cleanWords.push(w)
      }
      name = cleanWords.join(' ')
      if (name && !excluded.some(e => name.toLowerCase().startsWith(e))) {
        return name
      }
    }
  }

  return null
}

function parseServiceMatch(text: string, services: any[]): any | null {
  const lower = text.toLowerCase()

  // First try to extract service from "motif X" pattern
  const motifMatch = lower.match(/motif\s+([a-zà-ÿéèêë\s]+?)(?:\s+prix|\s+pour|\s+client|\s*,|\s*$)/i)
  const motifText = motifMatch ? motifMatch[1].trim() : null

  for (const svc of services) {
    const svcLower = svc.name.toLowerCase()
    // Check if service name or keywords appear in the text
    if (lower.includes(svcLower)) return svc
    // Check if motif matches service
    if (motifText && svcLower.includes(motifText)) return svc
    if (motifText && motifText.includes(svcLower)) return svc
    // Check individual words (at least 4 chars)
    const words = svcLower.split(/\s+/).filter((w: string) => w.length >= 4)
    for (const w of words) {
      if (lower.includes(w)) return svc
      if (motifText && motifText.includes(w)) return svc
    }
  }

  // If motif was found but no matching service, create a virtual service entry
  if (motifText) {
    return { name: motifText.charAt(0).toUpperCase() + motifText.slice(1), price_ht: 0, price_ttc: 0, virtual: true }
  }

  return null
}

function parseAmount(text: string): number | null {
  // "150€", "150 euros", "150,50€"
  const match = text.match(/(\d+(?:[,\.]\d{1,2})?)\s*(?:€|euros?)/i)
  if (match) {
    return parseFloat(match[1].replace(',', '.'))
  }
  return null
}

function parseAddress(text: string): string | null {
  // "au 123 rue X" or "à 123 avenue Y"
  const match = text.match(/(?:au|à|chez|adresse)\s+(\d+.*?)(?:\s*,\s*|\s+(?:à|pour|le|mardi|lundi|mercredi|jeudi|vendredi|samedi|dimanche|demain|aujourd)|\s*$)/i)
  if (match) return match[1].trim()
  return null
}

type Intent = 'create_rdv' | 'create_devis' | 'create_facture' | 'list_rdv' | 'help' | 'unknown'

function detectIntent(text: string): Intent {
  const lower = text.toLowerCase()

  if (
    lower.includes('rdv') || lower.includes('rendez-vous') || lower.includes('rendez vous') ||
    lower.includes('prend') || lower.includes('programme') || lower.includes('ajoute') ||
    lower.includes('planifie') || lower.includes('met') && (lower.includes('rdv') || lower.includes('rendez'))
  ) {
    return 'create_rdv'
  }

  if (lower.includes('devis') || lower.includes('fait un devis') || lower.includes('faire un devis') || lower.includes('créer un devis') || lower.includes('crée un devis') || lower.includes('cree un devis') || lower.includes('crée le devis') || lower.includes('cree le devis')) {
    return 'create_devis'
  }

  if (lower.includes('facture') || lower.includes('fait une facture') || lower.includes('faire une facture') || lower.includes('créer une facture') || lower.includes('crée une facture')) {
    return 'create_facture'
  }

  if (lower.includes('agenda') || lower.includes('planning') || lower.includes('prochain') || lower.includes('liste')) {
    return 'list_rdv'
  }

  if (lower.includes('aide') || lower.includes('help') || lower.includes('quoi') || lower.includes('comment') || lower.includes('bonjour') || lower.includes('salut')) {
    return 'help'
  }

  // If there's a date + time + name, assume it's a RDV
  if (parseDate(text) && parseTime(text) && parseClientName(text)) {
    return 'create_rdv'
  }

  return 'unknown'
}

function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// ══════════════ COMPOSANT ══════════════

// ══════════════ CLIENT MATCHER ══════════════

function normalizeForSearch(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function findClientByName(name: string, clients: ClientData[]): ClientData | null {
  if (!name || clients.length === 0) return null
  const searchName = normalizeForSearch(name)

  // 1. Exact match
  const exact = clients.find(c => normalizeForSearch(c.name) === searchName)
  if (exact) return exact

  // 2. Name contains search (or search contains name)
  const contains = clients.find(c => {
    const cn = normalizeForSearch(c.name)
    return cn.includes(searchName) || searchName.includes(cn)
  })
  if (contains) return contains

  // 3. Partial match — check if all search words appear in client name (or vice versa)
  const searchWords = searchName.split(/\s+/).filter(w => w.length >= 2)
  if (searchWords.length > 0) {
    const partial = clients.find(c => {
      const cn = normalizeForSearch(c.name)
      // All search words found in client name
      return searchWords.every(sw => cn.includes(sw))
    })
    if (partial) return partial

    // 4. At least last name matches (last word)
    const lastName = searchWords[searchWords.length - 1]
    if (lastName.length >= 3) {
      const lastNameMatch = clients.find(c => {
        const cnWords = normalizeForSearch(c.name).split(/\s+/)
        return cnWords.some(w => w === lastName || w.includes(lastName) || lastName.includes(w))
      })
      if (lastNameMatch) return lastNameMatch
    }
  }

  return null
}

export default function AiChatBot({ artisan, bookings, services, onCreateRdv, onCreateDevis, onNavigate }: AiChatBotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [pendingAction, setPendingAction] = useState<Message | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ─── Client database ───
  const [clients, setClients] = useState<ClientData[]>([])
  const [clientsLoaded, setClientsLoaded] = useState(false)

  // ─── Voice Recording (Push-to-Talk) ───
  const [isRecording, setIsRecording] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [recordingDuration, setRecordingDuration] = useState(0)
  const recognitionRef = useRef<any>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if Web Speech API is available
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
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
        .catch(() => setClientsLoaded(true))
    }
  }, [artisan?.id, clientsLoaded])

  const startVoiceRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    let finalTranscript = ''
    let interimTranscript = ''

    recognition.onresult = (event: any) => {
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

    recognition.onerror = (event: any) => {
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

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

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
        content: `Salut ! Moi c'est Fixy, votre assistant personnel ! 🔧\n\nJe suis là pour vous faire gagner du temps :\n\n• **Créer un RDV** : "RDV mardi 14h Mme Dupont"\n• **Faire un devis** : "Devis élagage 150€ pour Frédéric Neiva"\n• **Faire une facture** : "Facture intervention Mme Legrand 180€"\n• **Voir votre planning** : "Mes prochains RDV"\n\n💡 Je connais vos clients ! Si le client existe dans votre base, je pré-remplis automatiquement toutes ses infos.\n\nDites-moi, qu'est-ce qu'on fait ?`
      }])
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const addMessage = (role: 'user' | 'assistant', content: string, action?: Message['action']): Message => {
    const msg: Message = { id: Date.now().toString(), role, content, action }
    setMessages(prev => [...prev, msg])
    return msg
  }

  // ─── AI-powered message processing ───
  const processMessageWithAI = async (text: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/fixy-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          clients: clients.map(c => ({ name: c.name, email: c.email, phone: c.phone, address: c.address, siret: c.siret })),
          services: services.map(s => ({ id: s.id, name: s.name, price_ht: s.price_ht, price_ttc: s.price_ttc, duration_minutes: s.duration_minutes })),
          bookings: bookings.slice(0, 15),
          artisanName: artisan?.company_name || 'Artisan',
        }),
      })

      const data = await res.json()

      // If API not configured or error, fallback to regex
      if (data.fallback || data.error) return false

      const { intent, data: aiData, response, needsConfirmation } = data

      if (!intent) return false

      switch (intent) {
        case 'create_rdv': {
          if (!needsConfirmation || !aiData?.date || !aiData?.time || !aiData?.clientName) {
            addMessage('assistant', response || "Il me manque des informations pour créer le RDV. Précisez la date, l'heure et le nom du client.")
            return true
          }

          const rdvData = {
            client_name: aiData.clientName,
            date: aiData.date,
            time: aiData.time,
            service_id: aiData.service ? services.find((s: any) => s.name.toLowerCase().includes(aiData.service.toLowerCase()))?.id || '' : '',
            address: aiData.address || '',
            notes: '',
          }

          const msg = addMessage('assistant', response || `Je vais créer ce RDV, **confirmez ?**`, { type: 'create_rdv', data: rdvData })
          setPendingAction(msg)
          return true
        }

        case 'create_devis':
        case 'create_facture': {
          const isFacture = intent === 'create_facture'
          const docType = isFacture ? 'facture' : 'devis'

          // Enrichir avec les données client de la base
          let matchedClient: ClientData | null = null
          if (aiData?.clientName) {
            matchedClient = findClientByName(aiData.clientName, clients)
          }

          const devisData: any = {
            docType,
            clientName: matchedClient?.name || aiData?.clientName || '',
            clientEmail: matchedClient?.email || aiData?.clientEmail || '',
            clientPhone: matchedClient?.phone || aiData?.clientPhone || '',
            clientAddress: matchedClient?.address || aiData?.clientAddress || aiData?.address || '',
            clientSiret: matchedClient?.siret || aiData?.clientSiret || '',
            service: aiData?.service || '',
            amount: aiData?.amount || 0,
            address: matchedClient?.address || aiData?.address || '',
            clientFound: !!matchedClient || !!aiData?.clientMatch,
          }

          // Build line items
          if (aiData?.amount || aiData?.service) {
            const desc = aiData.service || aiData.description || 'Prestation'
            const priceHT = aiData.amount ? (aiData.amount / 1.2) : 0
            devisData.lines = [{
              id: Date.now(),
              description: desc,
              qty: 1,
              priceHT: Math.round(priceHT * 100) / 100,
              tvaRate: 20,
              totalHT: Math.round(priceHT * 100) / 100,
            }]
          }

          // Construire un résumé enrichi avec les infos client
          let enrichedResponse = response || `Je prépare le ${docType}.`

          // Si l'IA n'a pas inclus les détails client, les ajouter
          if (matchedClient && !enrichedResponse.includes(matchedClient.phone || '___none___')) {
            enrichedResponse = `Je vais préparer ${isFacture ? 'une facture' : 'un devis'} :\n\n`
            enrichedResponse += `👤 **Client** : ${matchedClient.name} ✅ (trouvé dans votre base)\n`
            if (matchedClient.phone) enrichedResponse += `📞 **Tél** : ${matchedClient.phone}\n`
            if (matchedClient.email) enrichedResponse += `📧 **Email** : ${matchedClient.email}\n`
            if (matchedClient.address) enrichedResponse += `📍 **Adresse** : ${matchedClient.address}\n`
            if (aiData?.service) enrichedResponse += `🔧 **Service** : ${aiData.service}\n`
            if (aiData?.amount) enrichedResponse += `💰 **Montant TTC** : ${aiData.amount.toFixed(2)}€\n`
            enrichedResponse += `\n**Ouvrir le formulaire pré-rempli ?** (oui/non)`
          } else if (!enrichedResponse.includes('oui/non') && !enrichedResponse.includes('Confirmer')) {
            enrichedResponse += `\n\n**Ouvrir le formulaire pré-rempli ?** (oui/non)`
          }

          const msg = addMessage('assistant', enrichedResponse, { type: intent, data: devisData })
          setPendingAction(msg)
          return true
        }

        case 'list_rdv': {
          const upcoming = bookings
            .filter(b => b.booking_date >= new Date().toISOString().split('T')[0] && b.status !== 'cancelled')
            .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || (a.booking_time || '').localeCompare(b.booking_time || ''))
            .slice(0, 5)

          if (upcoming.length === 0) {
            addMessage('assistant', response || "Vous n'avez aucun rendez-vous à venir. Voulez-vous en créer un ?")
          } else {
            let list = response ? response + '\n\n' : '📋 **Vos prochains RDV** :\n\n'
            if (!response) {
              upcoming.forEach((b, i) => {
                const notes = b.notes || ''
                const clientMatch = notes.match(/Client:\s*([^|]+)/)
                const clientName = clientMatch ? clientMatch[1].trim() : 'Client'
                list += `${i + 1}. **${formatDateFr(b.booking_date)}** à ${b.booking_time?.substring(0, 5) || '?'}\n   ${b.services?.name || 'Intervention'} — ${clientName}\n\n`
              })
            }
            addMessage('assistant', list)
          }
          return true
        }

        case 'help': {
          addMessage('assistant', response || `C'est Fixy ! Je peux créer des RDV, des devis et des factures. Parlez-moi naturellement !`)
          return true
        }

        case 'chat':
        default: {
          addMessage('assistant', response || "Je suis là pour vous aider ! Dites-moi ce que vous voulez faire.")
          return true
        }
      }
    } catch (err) {
      console.error('AI processing error:', err)
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

        const summary = `Voici le RDV que je vais créer :\n\n📅 **Date** : ${formatDateFr(date!)}\n⏰ **Heure** : ${time}\n👤 **Client** : ${clientName}${service ? `\n🔧 **Service** : ${service.name}` : ''}${address ? `\n📍 **Adresse** : ${address}` : ''}\n\n**Confirmez-vous ?** (oui/non)`

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

        const devisData: any = {
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
            list += `${i + 1}. **${formatDateFr(b.booking_date)}** à ${b.booking_time?.substring(0, 5) || '?'}\n   ${b.services?.name || 'Intervention'} — ${clientName}\n\n`
          })
          addMessage('assistant', list)
        }
        break
      }

      case 'help': {
        addMessage('assistant', `C'est Fixy ! Voici tout ce que je sais faire 💪\n\n🗓️ **Créer un RDV** :\n• "RDV mardi 14h Mme Dupont"\n• "Rendez-vous demain 10h chez M. Martin"\n\n📄 **Créer un devis** :\n• "Devis élagage 150€ pour Frédéric Neiva Carvalho"\n• "Crée le devis motif plomberie prix 250€ pour le client Dupont"\n\n🧾 **Créer une facture** :\n• "Facture intervention Mme Legrand 180€"\n\n📋 **Voir le planning** :\n• "Mes prochains RDV"\n• "Mon agenda"\n\n💡 **Base clients** : Je retrouve automatiquement vos clients et pré-remplis leurs infos !\n\nParlez-moi naturellement, je comprends !`)
        break
      }

      default: {
        addMessage('assistant', "Je n'ai pas bien compris. Pouvez-vous reformuler ?\n\nExemples :\n• **RDV mardi 15h Mme Dupont**\n• **Devis plomberie 200€ M. Martin**\n• **Mes prochains RDV**\n\nDites **aide** pour voir toutes les commandes.")
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
    } catch {
      // Ultimate fallback
      await processMessageFallback(text)
    }

    setProcessing(false)
  }

  const handleConfirmation = async (confirmed: boolean) => {
    if (!pendingAction?.action) return

    if (!confirmed) {
      addMessage('assistant', "Pas de problème, c'est annulé ! Que puis-je faire d'autre ?")
      setPendingAction(null)
      return
    }

    const { type, data } = pendingAction.action

    switch (type) {
      case 'create_rdv': {
        try {
          onCreateRdv(data)
          addMessage('assistant', `✅ **RDV créé avec succès !**\n\n${formatDateFr(data.date)} à ${data.time} avec ${data.client_name}.\n\nLe rendez-vous a été ajouté à votre agenda.`)
        } catch {
          addMessage('assistant', "❌ Une erreur est survenue lors de la création du RDV. Veuillez réessayer.")
        }
        break
      }

      case 'create_devis':
      case 'create_facture': {
        onCreateDevis(data)
        addMessage('assistant', `✅ **Formulaire de ${data.docType} ouvert !**\n\nLes informations ont été pré-remplies. Complétez les détails et validez.`)
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

    processMessage(input)
  }

  // Quick action buttons
  const quickActions = [
    { label: 'Nouveau RDV', icon: '📅', prompt: 'Je veux créer un rendez-vous' },
    { label: 'Faire un devis', icon: '📄', prompt: 'Je veux faire un devis' },
    { label: 'Mon planning', icon: '📋', prompt: 'Mes prochains RDV' },
  ]

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-white hover:bg-amber-50 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-50 group border-2 border-[#FFC107]"
          title="Fixy — votre assistant"
        >
          <div className="group-hover:scale-110 transition-transform">
            <FixyAvatar size={42} />
          </div>
          {/* Pulse animation */}
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200 overflow-hidden">
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
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
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
                className={`flex-1 px-3.5 py-2.5 border-2 rounded-xl focus:outline-none transition text-sm ${
                  isRecording
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-gray-200 focus:border-[#FFC107]'
                }`}
                disabled={processing || isRecording}
              />

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
              <p className="text-[10px] text-gray-400 mt-1 text-center">
                {'🎤'} Cliquez sur le micro pour dicter votre message
              </p>
            )}
          </form>
        </div>
      )}
    </>
  )
}
