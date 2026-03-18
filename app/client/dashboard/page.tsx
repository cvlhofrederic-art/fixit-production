'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import LocaleLink from '@/components/common/LocaleLink'
import Image from 'next/image'
import { Calendar, Clock, MapPin, Star, LogOut, User, Search, ChevronRight, Pencil, Save, X, Home, Shield, FileText, CheckCircle, AlertTriangle, Copy, Filter, FileSearch, MessageSquare, Send, LayoutDashboard, Wrench, Zap, Paintbrush, Hammer, Snowflake, BrickWall, Calculator } from 'lucide-react'
import FixyChatGeneric from '@/components/chat/FixyChatGeneric'
import SimulateurDevisClient from '@/app/fr/simulateur-devis/SimulateurDevisClient'

type Booking = {
  id: string
  booking_date: string
  booking_time: string
  status: string
  address: string
  notes: string
  price_ttc: number
  duration_minutes: number
  artisan_id?: string
  confirmed_at?: string
  completed_at?: string
  expires_at?: string
  services?: { name: string } | null
  profiles_artisan?: { company_name: string; rating_avg: number; rating_count?: number } | null
}

type CILEntry = {
  id: string
  bookingId: string
  date: string
  artisanName: string
  artisanId?: string
  serviceName: string
  category: 'plomberie' | 'electricite' | 'chauffage' | 'serrurerie' | 'peinture' | 'menuiserie' | 'autre'
  description: string
  address: string
  priceTTC: number
  hasProof: boolean
  proofPhotosCount: number
  hasSignature: boolean
  hasGPS: boolean
  warranty?: { type: string; endDate: string }
  nextMaintenance?: string
  notes?: string
  documents?: { name: string; type: string }[]
}

export default function ClientDashboardPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const locale = useLocale()
  const [user, setUser] = useState<any>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upcoming' | 'past' | 'messages' | 'documents' | 'logement' | 'analyse' | 'simulateur' | 'marches' | 'profile'>('dashboard')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileData, setProfileData] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
  })

  // Photo de profil client
  const [clientPhotoFile, setClientPhotoFile] = useState<File | null>(null)
  const [clientPhotoPreview, setClientPhotoPreview] = useState<string>('')
  const [clientPhotoUploading, setClientPhotoUploading] = useState(false)

  // ── Annulation ──
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  // ── Notation ──
  const [ratingModal, setRatingModal] = useState<Booking | null>(null)
  const [ratingVal, setRatingVal] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratings, setRatings] = useState<Record<string, { stars: number; comment: string }>>({})
  // ── GPS Tracking ──
  const [trackingModal, setTrackingModal] = useState<Booking | null>(null)
  const [trackingData, setTrackingData] = useState<Record<string, { lat: number; lng: number; eta: number; active: boolean }>>({})
  // ── Favoris ──
  const [favoris, setFavoris] = useState<string[]>([])

  // ── Messagerie ──
  const [messageModal, setMessageModal] = useState<Booking | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  // ── Conversations list (Messages tab) ──
  const [conversations, setConversations] = useState<{ bookingId: string; lastMessage: string; lastDate: string; unread: number; hasDevis: boolean }[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(false)
  // ── Documents list (Documents tab) ──
  const [documents, setDocuments] = useState<any[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  // ── Messagerie enrichie : photos, voice, devis ──
  const [msgUploading, setMsgUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorderRef, setMediaRecorderRef] = useState<MediaRecorder | null>(null)
  const [signingDevis, setSigningDevis] = useState<string | null>(null) // message_id en cours de signature
  const [signName, setSignName] = useState('')
  const [signConfirm, setSignConfirm] = useState(false)
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null)

  // ── Carnet de Santé Logement ──
  const [cilEntries, setCilEntries] = useState<CILEntry[]>([])
  const [showCilDetail, setShowCilDetail] = useState<CILEntry | null>(null)
  const [cilFilter, setCilFilter] = useState<'all' | 'plomberie' | 'electricite' | 'chauffage' | 'serrurerie' | 'autre'>('all')

  // ── Analyse Devis ──
  const [analyseInput, setAnalyseInput] = useState('')
  const [analyseFilename, setAnalyseFilename] = useState('')
  const [analyseResult, setAnalyseResult] = useState('')
  const [analyseLoading, setAnalyseLoading] = useState(false)
  const [analyseInputMode, setAnalyseInputMode] = useState<'paste' | 'pdf'>('pdf')
  const [analyseExtracting, setAnalyseExtracting] = useState(false)
  const [analysePdfReady, setAnalysePdfReady] = useState(false)
  const [analyseHistory, setAnalyseHistory] = useState<{date: string; filename: string; verdict: string}[]>([])

  useEffect(() => {
    let didLoad = false

    const initAuth = async () => {
      // Always use getUser() — validates JWT with Supabase server (non-forgeable)
      // getSession() reads from localStorage which can be tampered with
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        didLoad = true
        setUser(currentUser)
        await fetchBookings(currentUser.id)
      } else {
        window.location.href = '/auth/login'
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/auth/login'
      }
      if (!didLoad && event === 'INITIAL_SESSION' && session?.user) {
        didLoad = true
        setUser(session.user)
        await fetchBookings(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load conversations/documents when switching to those tabs
  useEffect(() => {
    if (activeTab === 'messages' && conversations.length === 0 && bookings.length > 0) fetchConversations()
    if (activeTab === 'documents' && documents.length === 0 && bookings.length > 0) fetchDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, bookings])

  const fetchBookings = async (userId: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, services(name), profiles_artisan:artisan_id(company_name, rating_avg, rating_count)')
      .eq('client_id', userId)
      .order('booking_date', { ascending: false })

    if (error) {
      console.error('Error fetching bookings:', error)
    }
    setBookings((data as Booking[]) || [])
    // Generate Carnet de Santé entries
    generateCIL((data as Booking[]) || [])
    setLoading(false)
    // Charger les notes depuis localStorage
    try {
      const saved = localStorage.getItem(`fixit_client_ratings_${userId}`)
      if (saved) setRatings(JSON.parse(saved))
      const savedFavoris = localStorage.getItem(`fixit_client_favoris_${userId}`)
      if (savedFavoris) setFavoris(JSON.parse(savedFavoris))
      setAnalyseHistory(JSON.parse(localStorage.getItem('fixit_analyse_history_client') || '[]'))
    } catch {}
  }

  const initProfileData = (userData: any) => {
    const meta = userData?.user_metadata || {}
    setProfileData({
      fullName: meta.full_name || '',
      phone: meta.phone || '',
      address: meta.address || '',
      city: meta.city || '',
      postalCode: meta.postal_code || '',
    })
  }

  const startEditing = () => {
    initProfileData(user)
    setEditingProfile(true)
    setProfileSuccess('')
    setProfileError('')
  }

  const cancelEditing = () => {
    setEditingProfile(false)
    setProfileError('')
  }

  const saveProfile = async () => {
    if (!profileData.fullName.trim()) {
      setProfileError(t('clientDash.errors.nameRequired'))
      return
    }
    if (!profileData.phone || profileData.phone.length < 10) {
      setProfileError(t('clientDash.errors.phoneInvalid'))
      return
    }

    setSavingProfile(true)
    setProfileError('')
    setProfileSuccess('')

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.fullName.trim(),
          phone: profileData.phone.trim(),
          address: profileData.address.trim(),
          city: profileData.city.trim(),
          postal_code: profileData.postalCode.trim(),
        },
      })

      if (error) {
        setProfileError(error.message)
      } else {
        setUser(data.user)
        setEditingProfile(false)
        setProfileSuccess(t('clientDash.errors.profileUpdated'))
        setTimeout(() => setProfileSuccess(''), 3000)
      }
    } catch {
      setProfileError(t('clientDash.errors.saveError'))
    } finally {
      setSavingProfile(false)
    }
  }

  const uploadClientPhoto = async (file: File) => {
    setClientPhotoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', 'profile-photos')
      fd.append('folder', 'clients')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('clientDash.errors.uploadGeneric'))
      // Sauvegarder l'URL dans user_metadata
      await supabase.auth.updateUser({
        data: { profile_photo_url: data.url }
      })
      setUser((prev: any) => ({
        ...prev,
        user_metadata: { ...(prev?.user_metadata || {}), profile_photo_url: data.url }
      }))
      setClientPhotoFile(null)
      setClientPhotoPreview('')
      setProfileSuccess(t('clientDash.errors.photoUpdated'))
      setTimeout(() => setProfileSuccess(''), 3000)
    } catch (err: any) {
      setProfileError(`${t('clientDash.errors.uploadError')}: ${err.message}`)
    } finally {
      setClientPhotoUploading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = `/${locale}/`
  }

  // ── Annuler un RDV ──
  const cancelBooking = async (id: string) => {
    setCancellingId(id)
    try {
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b))
    } catch (e) { console.error(e) }
    setCancellingId(null)
    setCancelConfirm(null)
  }

  // ── Soumettre une notation ──
  const submitRating = async () => {
    if (!ratingModal || !user) return
    setRatingSubmitting(true)
    const newRatings = { ...ratings, [ratingModal.id]: { stars: ratingVal, comment: ratingComment } }
    setRatings(newRatings)
    try { localStorage.setItem(`fixit_client_ratings_${user.id}`, JSON.stringify(newRatings)) } catch {}
    // Update artisan rating_avg in DB
    try {
      const { data: artisanData } = await supabase
        .from('profiles_artisan')
        .select('rating_avg, rating_count')
        .eq('user_id', ratingModal.profiles_artisan ? (ratingModal as any).artisan_id : '')
        .single()
      if (artisanData) {
        const newCount = (artisanData.rating_count || 0) + 1
        const newAvg = ((artisanData.rating_avg || 0) * (artisanData.rating_count || 0) + ratingVal) / newCount
        await supabase.from('profiles_artisan').update({ rating_avg: Math.round(newAvg * 10) / 10, rating_count: newCount }).eq('user_id', (ratingModal as any).artisan_id)
      }
    } catch {}
    setRatingSubmitting(false)
    setRatingModal(null)
    setRatingComment('')
    setRatingVal(5)
  }

  // ── Charger GPS tracking ──
  const loadTracking = async (booking: Booking) => {
    setTrackingModal(booking)
    try {
      const { data } = await supabase
        .from('tracking_sessions')
        .select('*')
        .eq('booking_id', booking.id)
        .eq('status', 'active')
        .single()
      if (data) {
        setTrackingData(prev => ({
          ...prev,
          [booking.id]: { lat: data.lat, lng: data.lng, eta: data.eta_minutes || 0, active: true }
        }))
      }
    } catch {}
  }

  // ── Toggle favori artisan ──
  const toggleFavori = (artisanId: string) => {
    const next = favoris.includes(artisanId)
      ? favoris.filter(f => f !== artisanId)
      : [...favoris, artisanId]
    setFavoris(next)
    try { localStorage.setItem(`fixit_client_favoris_${user?.id}`, JSON.stringify(next)) } catch {}
  }

  // ── Messagerie ──
  const openMessages = async (booking: Booking) => {
    setMessageModal(booking)
    setMessages([])
    setNewMessage('')
    try {
      const res = await fetch(`/api/booking-messages?booking_id=${booking.id}`, {
        headers: { 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` }
      })
      const json = await res.json()
      if (json.data) setMessages(json.data)
      // Clear unread count
      setUnreadCounts(prev => ({ ...prev, [booking.id]: 0 }))
    } catch (e) { console.error('Error fetching messages:', e) }
  }

  const sendMessage = async () => {
    if (!messageModal || !newMessage.trim() || sendingMessage) return
    setSendingMessage(true)
    try {
      const res = await fetch('/api/booking-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ booking_id: messageModal.id, content: newMessage.trim() }),
      })
      const json = await res.json()
      if (json.data) {
        setMessages(prev => [...prev, json.data])
        setNewMessage('')
      }
    } catch (e) { console.error('Error sending message:', e) }
    setSendingMessage(false)
  }

  // ── Messagerie enrichie helpers ──
  const getAuthToken = async () => (await supabase.auth.getSession()).data.session?.access_token || ''

  const uploadMsgAttachment = async (file: File): Promise<string | null> => {
    setMsgUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'booking-attachments')
      formData.append('folder', 'messages')
      const token = await getAuthToken()
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })
      const json = await res.json()
      return json.url || null
    } catch (e) { console.error('Upload error:', e); return null }
    finally { setMsgUploading(false) }
  }

  const sendPhotoMessage = async (file: File) => {
    if (!messageModal) return
    const url = await uploadMsgAttachment(file)
    if (!url) { alert(t('clientDash.messaging.photoUploadError')); return }
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/booking-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ booking_id: messageModal.id, content: '', type: 'photo', attachment_url: url }),
      })
      const json = await res.json()
      if (json.data) setMessages(prev => [...prev, json.data])
    } catch (e) { console.error('Error sending photo:', e) }
  }

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: recorder.mimeType })
        if (blob.size < 1000) return // trop court
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: recorder.mimeType })
        if (!messageModal) return
        const url = await uploadMsgAttachment(file)
        if (!url) { alert(t('clientDash.messaging.voiceUploadError')); return }
        try {
          const token = await getAuthToken()
          const res = await fetch('/api/booking-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ booking_id: messageModal.id, content: '🎤 Message vocal', type: 'voice', attachment_url: url }),
          })
          const json = await res.json()
          if (json.data) setMessages(prev => [...prev, json.data])
        } catch (e) { console.error('Error sending voice:', e) }
      }
      recorder.start()
      setMediaRecorderRef(recorder)
      setIsRecording(true)
    } catch (e) {
      console.error('Microphone error:', e)
      alert(t('clientDash.messaging.microphoneError'))
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorderRef && mediaRecorderRef.state !== 'inactive') {
      mediaRecorderRef.stop()
    }
    setIsRecording(false)
    setMediaRecorderRef(null)
  }

  const handleSignDevis = async (messageId: string) => {
    if (!messageModal || !signName.trim()) return
    setSendingMessage(true)
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/devis-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ booking_id: messageModal.id, message_id: messageId, signer_name: signName.trim() }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        // Rafraîchir les messages pour voir la mise à jour
        setMessages(prev => {
          const updated = prev.map(m => m.id === messageId ? { ...m, metadata: { ...m.metadata, signed: true, signed_at: json.data.metadata?.signed_at, signer_name: signName.trim() } } : m)
          return [...updated, json.data]
        })
        setSigningDevis(null)
        setSignName('')
        setSignConfirm(false)
      } else {
        alert(json.error || t('clientDash.messaging.signError'))
      }
    } catch (e) { console.error('Sign error:', e); alert(t('clientDash.messaging.networkError')) }
    finally { setSendingMessage(false) }
  }

  // ── Charger toutes les conversations (Messages tab) ──
  // Optimisé : requêtes parallèles au lieu de séquentielles (fix N+1)
  const fetchConversations = async () => {
    if (!user || conversationsLoading) return
    setConversationsLoading(true)
    try {
      const token = await getAuthToken()
      const nonCancelled = bookings.filter(b => b.status !== 'cancelled')
      // Lancer toutes les requêtes en parallèle (max 10 concurrent)
      const batchSize = 10
      const results: typeof conversations = []
      for (let i = 0; i < nonCancelled.length; i += batchSize) {
        const batch = nonCancelled.slice(i, i + batchSize)
        const batchResults = await Promise.allSettled(
          batch.map(async (b) => {
            const res = await fetch(`/api/booking-messages?booking_id=${b.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            const msgs = json.data || []
            if (msgs.length > 0) {
              const last = msgs[msgs.length - 1]
              const unread = msgs.filter((m: any) => m.sender_role !== 'client' && !m.read_at).length
              const hasDevis = msgs.some((m: any) => m.type === 'devis_sent')
              return {
                bookingId: b.id,
                lastMessage: last.type === 'photo' ? '📷 Photo' : last.type === 'voice' ? '🎤 Vocal' : last.type === 'devis_sent' ? '📄 Devis envoyé' : (last.content || '').substring(0, 60),
                lastDate: last.created_at,
                unread,
                hasDevis,
              }
            }
            return null
          })
        )
        for (const r of batchResults) {
          if (r.status === 'fulfilled' && r.value) results.push(r.value)
        }
      }
      // Trier par date du dernier message (plus récent en premier)
      results.sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
      setConversations(results)
      // Mettre à jour les compteurs d'unread
      const newUnread: Record<string, number> = {}
      for (const c of results) { if (c.unread > 0) newUnread[c.bookingId] = c.unread }
      setUnreadCounts(prev => ({ ...prev, ...newUnread }))
    } catch (e) { console.error('Error fetching conversations:', e) }
    setConversationsLoading(false)
  }

  // ── Charger les documents (devis/factures reçus) ──
  // Optimisé : requêtes parallèles au lieu de séquentielles (fix N+1)
  const fetchDocuments = async () => {
    if (!user || documentsLoading) return
    setDocumentsLoading(true)
    try {
      const token = await getAuthToken()
      const nonCancelled = bookings.filter(b => b.status !== 'cancelled')
      const allDocs: any[] = []
      const batchSize = 10
      for (let i = 0; i < nonCancelled.length; i += batchSize) {
        const batch = nonCancelled.slice(i, i + batchSize)
        const batchResults = await Promise.allSettled(
          batch.map(async (b) => {
            const res = await fetch(`/api/booking-messages?booking_id=${b.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            const msgs = json.data || []
            return msgs
              .filter((m: any) => m.type === 'devis_sent' || m.type === 'devis_signed')
              .map((m: any) => ({ ...m, booking: b }))
          })
        )
        for (const r of batchResults) {
          if (r.status === 'fulfilled' && r.value) allDocs.push(...r.value)
        }
      }
      allDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setDocuments(allDocs)
    } catch (e) { console.error('Error fetching documents:', e) }
    setDocumentsLoading(false)
  }

  // ── Générer le Carnet de Santé (CIL) depuis les bookings terminés ──
  const generateCIL = (bks: Booking[]) => {
    const proofs = JSON.parse(localStorage.getItem('fixit_proofs') || '[]')
    const entries: CILEntry[] = bks
      .filter(b => b.status === 'completed')
      .map(b => {
        const proof = proofs.find((p: any) => p.bookingId === b.id)
        const serviceName = (b.services?.name || '').toLowerCase()
        let category: CILEntry['category'] = 'autre'
        if (serviceName.match(/plomb|fuite|robinet|wc|sani|eau|tuyau/)) category = 'plomberie'
        else if (serviceName.match(/electr|prise|tableau|disj|câbl|inter/)) category = 'electricite'
        else if (serviceName.match(/chauff|chaudière|radiateur|thermo|clim/)) category = 'chauffage'
        else if (serviceName.match(/serrur|porte|clé|verrou|blind/)) category = 'serrurerie'
        else if (serviceName.match(/peint|mur|plaf|end/)) category = 'peinture'
        else if (serviceName.match(/menuis|bois|parquet|meuble|étagère/)) category = 'menuiserie'

        // Garantie par défaut : 2 ans structurel, 1 an pour le reste
        const warrantyEnd = new Date(b.booking_date)
        const isStructural = ['plomberie', 'electricite', 'chauffage'].includes(category)
        warrantyEnd.setFullYear(warrantyEnd.getFullYear() + (isStructural ? 2 : 1))

        // Prochaine maintenance suggérée à +1 an
        const nextMaint = new Date(b.booking_date)
        nextMaint.setFullYear(nextMaint.getFullYear() + 1)

        return {
          id: `cil-${b.id}`,
          bookingId: b.id,
          date: b.booking_date,
          artisanName: b.profiles_artisan?.company_name || 'Artisan',
          artisanId: b.artisan_id,
          serviceName: b.services?.name || 'Intervention',
          category,
          description: b.notes || '',
          address: b.address || '',
          priceTTC: b.price_ttc || 0,
          hasProof: !!proof,
          proofPhotosCount: proof ? (proof.beforePhotos?.length || 0) + (proof.afterPhotos?.length || 0) : 0,
          hasSignature: !!proof?.signature,
          hasGPS: !!(proof?.gpsLat && proof?.gpsLng),
          warranty: { type: isStructural ? t('clientDash.logement.warrantyBiennial') : t('clientDash.logement.warrantyAnnual'), endDate: warrantyEnd.toISOString().split('T')[0] },
          nextMaintenance: nextMaint.toISOString().split('T')[0],
        }
      })
    setCilEntries(entries)
  }

  // ── Score de santé du logement ──
  const getCILHealthScore = (): number => {
    if (cilEntries.length === 0) return 0
    let score = 0
    let total = 0
    const now = new Date()
    cilEntries.forEach(e => {
      // Proof coverage (+30 points max)
      total += 30
      if (e.hasProof) score += 15
      if (e.hasSignature) score += 10
      if (e.hasGPS) score += 5

      // Warranty status (+40 points max)
      total += 40
      if (e.warranty) {
        const wEnd = new Date(e.warranty.endDate)
        if (wEnd > now) {
          score += 40 // Under warranty
        } else {
          const monthsExpired = (now.getTime() - wEnd.getTime()) / (1000 * 60 * 60 * 24 * 30)
          if (monthsExpired < 6) score += 20 // Recently expired
        }
      }

      // Maintenance (+30 points max)
      total += 30
      if (e.nextMaintenance) {
        const mDate = new Date(e.nextMaintenance)
        if (mDate > now) score += 30
        else {
          const monthsOverdue = (now.getTime() - mDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
          if (monthsOverdue < 3) score += 15
        }
      }
    })
    return total > 0 ? Math.round((score / total) * 100) : 0
  }

  // ── Catégorie label + icône CIL ──
  const getCategoryInfo = (cat: CILEntry['category']): { label: string; icon: string; color: string } => {
    switch (cat) {
      case 'plomberie': return { label: t('clientDash.logement.categoryPlomberie'), icon: '\uD83D\uDEB0', color: 'bg-blue-100 text-blue-700' }
      case 'electricite': return { label: t('clientDash.logement.categoryElectricite'), icon: '\u26A1', color: 'bg-yellow-100 text-yellow-700' }
      case 'chauffage': return { label: t('clientDash.logement.categoryChauffage'), icon: '\uD83D\uDD25', color: 'bg-orange-100 text-orange-700' }
      case 'serrurerie': return { label: t('clientDash.logement.categorySerrurerie'), icon: '\uD83D\uDD11', color: 'bg-purple-100 text-purple-700' }
      case 'peinture': return { label: t('clientDash.logement.categoryPeinture'), icon: '\uD83C\uDFA8', color: 'bg-pink-100 text-pink-700' }
      case 'menuiserie': return { label: t('clientDash.logement.categoryMenuiserie'), icon: '\uD83E\uDE9A', color: 'bg-amber-100 text-amber-700' }
      default: return { label: t('clientDash.logement.categoryAutre'), icon: '\uD83D\uDD27', color: 'bg-warm-gray text-mid' }
    }
  }

  // ── Exporter le CIL en texte formaté ──
  const exportCIL = () => {
    const intlLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
    const lines: string[] = [
      `=== ${t('clientDash.export.title')} ===`,
      `${t('clientDash.export.generatedOn')} ${new Date().toLocaleDateString(intlLocale)}`,
      `${t('clientDash.export.healthScore')} : ${getCILHealthScore()}%`,
      `${t('clientDash.export.interventionsCount')} : ${cilEntries.length}`,
      '',
      `--- ${t('clientDash.export.interventionsSection')} ---`,
      '',
    ]
    cilEntries.forEach((e, i) => {
      const catInfo = getCategoryInfo(e.category)
      lines.push(`${i + 1}. ${e.serviceName}`)
      lines.push(`   ${t('clientDash.export.date')} : ${new Date(e.date).toLocaleDateString(intlLocale)}`)
      lines.push(`   ${t('clientDash.export.category')} : ${catInfo.label}`)
      lines.push(`   ${t('clientDash.export.artisan')} : ${e.artisanName}`)
      lines.push(`   ${t('clientDash.export.address')} : ${e.address || t('clientDash.export.notProvided')}`)
      lines.push(`   ${t('clientDash.export.amountTTC')} : ${formatPrice(e.priceTTC, locale)}`)
      lines.push(`   ${t('clientDash.export.proofOfWork')} : ${e.hasProof ? t('clientDash.export.proofYes') : t('clientDash.export.proofNo')} | ${t('clientDash.export.proofPhotos')} : ${e.proofPhotosCount} | ${t('clientDash.export.proofSignature')} : ${e.hasSignature ? t('clientDash.export.proofYes') : t('clientDash.export.proofNo')} | ${t('clientDash.export.proofGPS')} : ${e.hasGPS ? t('clientDash.export.proofYes') : t('clientDash.export.proofNo')}`)
      if (e.warranty) lines.push(`   ${t('clientDash.export.warranty')} : ${e.warranty.type} (${t('clientDash.export.warrantyUntil')} ${new Date(e.warranty.endDate).toLocaleDateString(intlLocale)})`)
      if (e.nextMaintenance) lines.push(`   ${t('clientDash.export.nextMaintenance')} : ${new Date(e.nextMaintenance).toLocaleDateString(intlLocale)}`)
      lines.push('')
    })
    lines.push(`--- ${t('clientDash.export.endOfNotebook')} ---`)
    navigator.clipboard.writeText(lines.join('\n'))
    alert(t('clientDash.export.copiedToClipboard'))
  }

  const filteredCilEntries = cilFilter === 'all'
    ? cilEntries
    : cilEntries.filter(e => e.category === cilFilter)

  const today = new Date().toISOString().split('T')[0]
  const upcomingBookings = bookings.filter(b => b.booking_date >= today && b.status !== 'cancelled')
  const pastBookings = bookings.filter(b => b.booking_date < today || b.status === 'cancelled')

  // ── Score de ponctualité par artisan (% interventions réalisées vs acceptées) ──
  const getPonctualiteScore = (artisanId: string | undefined): number | null => {
    if (!artisanId) return null
    const artisanBookings = bookings.filter(b => b.artisan_id === artisanId)
    const completed = artisanBookings.filter(b => b.status === 'completed').length
    const total = artisanBookings.filter(b => ['completed', 'confirmed', 'cancelled'].includes(b.status)).length
    if (total < 2) return null
    return Math.round((completed / total) * 100)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">{t('clientDash.status.confirmed')}</span>
      case 'pending':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">{t('clientDash.status.pending')}</span>
      case 'completed':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{t('clientDash.status.completed')}</span>
      case 'cancelled':
        return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">{t('clientDash.status.cancelled')}</span>
      default:
        return <span className="px-2.5 py-1 bg-warm-gray text-mid rounded-full text-xs font-semibold">{status}</span>
    }
  }

  const formatDateLocal = (dateStr: string) => {
    const intlLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString(intlLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const [dashSubTab, setDashSubTab] = useState<'upcoming' | 'history'>('upcoming')

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: '#F2F2F0' }}>
        {/* Skeleton nav bar */}
        <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: '1px solid #E8E8E8', height: 64 }}>
          <div className="flex items-center justify-between h-full px-6">
            <div className="w-20 h-6 bg-gray-200 rounded animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="w-40 h-9 bg-gray-200 rounded-full animate-pulse hidden sm:block" />
              <div className="w-9 h-9 bg-gray-200 rounded-full animate-pulse" />
              <div className="w-24 h-9 bg-gray-200 rounded-full animate-pulse hidden sm:block" />
            </div>
          </div>
        </header>
        <div className="flex">
          {/* Skeleton sidebar */}
          <aside className="hidden md:block w-[240px] flex-shrink-0 bg-white" style={{ borderRight: '1px solid #E8E8E8' }}>
            <div className="p-7 space-y-4">
              <div className="w-20 h-3 bg-gray-200 rounded animate-pulse mb-4" />
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
                  <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </aside>
          {/* Skeleton main */}
          <main className="flex-1 p-8">
            <div className="w-64 h-8 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="w-80 h-4 bg-gray-200 rounded animate-pulse mb-8" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-white p-5 rounded-[16px] animate-pulse" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
                  <div className="w-10 h-10 bg-gray-200 rounded-xl mb-4" />
                  <div className="w-12 h-9 bg-gray-200 rounded mb-2" />
                  <div className="w-24 h-3 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
            <div className="bg-gray-200 rounded-[16px] h-24 animate-pulse mb-8" />
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              <div className="bg-white rounded-[16px] h-64 animate-pulse" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }} />
              <div className="space-y-6">
                <div className="bg-white rounded-[16px] h-40 animate-pulse" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }} />
                <div className="bg-white rounded-[16px] h-40 animate-pulse" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }} />
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Client'
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0)
  const pendingCount = bookings.filter(b => b.status === 'pending').length
  const firstName = userName.split(' ')[0]
  const intlLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const todayFormatted = new Date().toLocaleDateString(intlLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  /* ── Sidebar nav items ── */
  const navItems: { key: typeof activeTab; icon: React.ReactNode; label: string; badge?: number; badgeRed?: boolean; activeKeys?: (typeof activeTab)[] }[] = [
    { key: 'dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" />, label: 'Dashboard' },
    { key: 'upcoming', icon: <Calendar className="w-[18px] h-[18px]" />, label: t('clientDash.stats.reservations'), badge: upcomingBookings.length, activeKeys: ['upcoming', 'past'] },
    { key: 'logement', icon: <Home className="w-[18px] h-[18px]" />, label: t('clientDash.tabs.logement') },
    { key: 'messages', icon: <MessageSquare className="w-[18px] h-[18px]" />, label: locale === 'pt' ? 'Mensagens' : 'Messages', badge: totalUnread > 0 ? totalUnread : undefined, badgeRed: totalUnread > 0 },
    { key: 'documents', icon: <FileText className="w-[18px] h-[18px]" />, label: locale === 'pt' ? 'Documentos' : 'Documents' },
    { key: 'analyse', icon: <FileSearch className="w-[18px] h-[18px]" />, label: t('clientDash.tabs.analyseDevis') },
    { key: 'simulateur', icon: <Calculator className="w-[18px] h-[18px]" />, label: locale === 'pt' ? 'Simulador' : 'Simulateur devis' },
    { key: 'marches', icon: <Hammer className="w-[18px] h-[18px]" />, label: locale === 'pt' ? 'Bolsa de Mercados' : 'Bourse aux Marchés' },
  ]
  const accountItems: { key: typeof activeTab; icon: React.ReactNode; label: string }[] = [
    { key: 'profile', icon: <User className="w-[18px] h-[18px]" />, label: t('clientDash.tabs.profile') },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#F2F2F0' }}>
      {/* ═══════════ NAV BAR ═══════════ */}
      <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: '1px solid #E8E8E8', height: 64 }}>
        <div className="flex items-center justify-between h-full px-4 sm:px-6">
          {/* Left: Logo — identique à la landing page */}
          <LocaleLink href="/" className="font-display font-black text-[1.7rem] text-dark no-underline flex items-center tracking-[-0.03em] uppercase">
            <span className="text-yellow">VIT</span>FIX
          </LocaleLink>

          {/* Right: CTA + user pill */}
          <div className="flex items-center gap-3">
            {/* Bouton CTA "Trouver un artisan" */}
            <LocaleLink
              href="/recherche"
              className="hidden sm:flex items-center gap-2 no-underline px-4 py-2 rounded-full font-semibold text-sm text-dark hover:bg-yellow-light transition-all"
              style={{ background: '#FFC107', fontSize: 14 }}
            >
              <Search className="w-4 h-4" />
              {t('clientDash.findArtisan')}
            </LocaleLink>

            {/* User pill — clique → onglet profil */}
            <div className="flex items-center gap-2" style={{ background: '#F5F5F5', borderRadius: 9999, padding: '4px 12px 4px 4px', cursor: 'pointer' }} onClick={() => setActiveTab('profile')}>
              <div className="flex items-center justify-center overflow-hidden" style={{ width: 32, height: 32, borderRadius: '50%', background: '#FFC107', flexShrink: 0 }}>
                {user?.user_metadata?.profile_photo_url ? (
                  <Image src={user.user_metadata.profile_photo_url} alt="Photo" width={32} height={32} className="w-full h-full object-cover" unoptimized />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{userInitials}</span>
                )}
              </div>
              <span className="hidden sm:block" style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{userName}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex" style={{ minHeight: 'calc(100vh - 64px)' }}>
        {/* ═══════════ SIDEBAR ═══════════ */}
        <aside className="hidden md:flex flex-col flex-shrink-0 bg-white" style={{ width: 240, borderRight: '1px solid #E8E8E8', padding: '28px 16px' }}>
          {/* Navigation section */}
          <div className="mb-6">
            <p style={{ fontSize: 10, letterSpacing: '0.1em', color: '#999999', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12, paddingLeft: 10 }}>Navigation</p>
            <nav className="flex flex-col gap-1">
              {navItems.map(item => {
                const isActive = item.activeKeys ? item.activeKeys.includes(activeTab) : activeTab === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className="flex items-center gap-3 w-full text-left transition-colors"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 400,
                      background: isActive ? '#FFC107' : 'transparent',
                      color: isActive ? '#1A1A1A' : '#444444',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#F5F5F5' }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="flex items-center justify-center" style={{
                        minWidth: 20, height: 20, borderRadius: 9999, fontSize: 11, fontWeight: 700,
                        background: item.badgeRed
                          ? '#EF4444'
                          : isActive ? 'rgba(0,0,0,0.15)' : '#E8E8E8',
                        color: item.badgeRed ? 'white' : isActive ? '#1A1A1A' : '#666666',
                        padding: '0 5px',
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Compte section */}
          <div className="mb-6">
            <p style={{ fontSize: 10, letterSpacing: '0.1em', color: '#999999', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12, paddingLeft: 10 }}>Compte</p>
            <nav className="flex flex-col gap-1">
              {accountItems.map(item => {
                const isActive = activeTab === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className="flex items-center gap-3 w-full text-left transition-colors"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 400,
                      background: isActive ? '#FFC107' : 'transparent',
                      color: isActive ? '#1A1A1A' : '#444444',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#F5F5F5' }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                )
              })}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full text-left transition-colors"
                style={{ padding: '10px 12px', borderRadius: 10, fontSize: 14, color: '#EF4444', border: 'none', cursor: 'pointer', background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
              >
                <LogOut className="w-[18px] h-[18px]" />
                <span>{t('clientDash.header.logout')}</span>
              </button>
            </nav>
          </div>

          {/* CTA bottom */}
          <div className="mt-auto" style={{ background: '#FFC107', borderRadius: 16, padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>Besoin d&#39;aide ?</p>
            <p style={{ fontSize: 12, color: '#444444', marginBottom: 12 }}>Notre équipe est là pour vous.</p>
            <LocaleLink
              href="/contact"
              className="block text-center no-underline"
              style={{ background: '#1A1A1A', color: 'white', borderRadius: 10, padding: '8px 0', fontSize: 13, fontWeight: 600 }}
            >
              Nous contacter
            </LocaleLink>
          </div>
        </aside>

        {/* ═══════════ MAIN CONTENT ═══════════ */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">

          {/* ── DASHBOARD OVERVIEW ── */}
          {activeTab === 'dashboard' && (
            <>
              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-8">
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1A1A1A', lineHeight: 1.2 }}>
                    {t('clientDash.welcome.hello')} {firstName} {'\uD83D\uDC4B'}
                  </h1>
                  <p style={{ fontSize: 14, color: '#999999', marginTop: 4 }}>{t('clientDash.welcome.subtitle')}</p>
                </div>
                <p className="hidden sm:block" style={{ fontSize: 13, color: '#999999', textTransform: 'capitalize' }}>{todayFormatted}</p>
              </div>

              {/* Stats grid - 4 columns */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
                {[
                  { label: t('clientDash.stats.reservations'), value: bookings.length, icon: '\uD83D\uDCCB', barColor: '#3B82F6' },
                  { label: t('clientDash.stats.upcoming'), value: upcomingBookings.length, icon: '\uD83D\uDD50', barColor: '#FFC107' },
                  { label: t('clientDash.stats.completed'), value: pastBookings.filter(b => b.status === 'completed').length, icon: '\u2705', barColor: '#22C55E' },
                  { label: t('clientDash.stats.pending'), value: pendingCount, icon: '\u23F3', barColor: '#F97316' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white relative overflow-hidden" style={{ borderRadius: 16, padding: '20px 20px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>{stat.icon}</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: '#1A1A1A', lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ fontSize: 12, color: '#999999', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, marginTop: 6 }}>{stat.label}</div>
                    <div className="absolute bottom-0 left-0 right-0" style={{ height: 4, background: stat.barColor }} />
                  </div>
                ))}
              </div>

              {/* Promo banner */}
              <LocaleLink
                href="/recherche"
                className="flex items-center justify-between no-underline group mb-8"
                style={{ background: '#FFC107', borderRadius: 16, padding: '24px 28px' }}
              >
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1A', marginBottom: 8 }}>{t('clientDash.quickAction.title')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Plomberie', 'Électricité', 'Serrurerie', 'Peinture'].map(m => (
                      <span key={m} style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>{m}</span>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center justify-center group-hover:translate-x-1 transition-transform" style={{ width: 44, height: 44, borderRadius: '50%', background: '#1A1A1A' }}>
                  <ChevronRight className="w-5 h-5" style={{ color: 'white' }} />
                </div>
              </LocaleLink>

              {/* Bottom grid: reservations panel + actions */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
                {/* Left: Reservations panel */}
                <div className="bg-white" style={{ borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                  {/* Sub-tabs */}
                  <div className="flex" style={{ borderBottom: '1px solid #E8E8E8' }}>
                    <button
                      onClick={() => setDashSubTab('upcoming')}
                      className="flex-1 text-center transition-colors"
                      style={{
                        padding: '14px 0',
                        fontSize: 14,
                        fontWeight: dashSubTab === 'upcoming' ? 700 : 400,
                        color: dashSubTab === 'upcoming' ? '#1A1A1A' : '#999999',
                        borderBottom: dashSubTab === 'upcoming' ? '2px solid #FFC107' : '2px solid transparent',
                        background: 'transparent',
                        border: 'none',
                        borderBottomWidth: 2,
                        borderBottomStyle: 'solid',
                        borderBottomColor: dashSubTab === 'upcoming' ? '#FFC107' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {t('clientDash.tabs.upcoming')} ({upcomingBookings.length})
                    </button>
                    <button
                      onClick={() => setDashSubTab('history')}
                      className="flex-1 text-center transition-colors"
                      style={{
                        padding: '14px 0',
                        fontSize: 14,
                        fontWeight: dashSubTab === 'history' ? 700 : 400,
                        color: dashSubTab === 'history' ? '#1A1A1A' : '#999999',
                        background: 'transparent',
                        border: 'none',
                        borderBottomWidth: 2,
                        borderBottomStyle: 'solid',
                        borderBottomColor: dashSubTab === 'history' ? '#FFC107' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      Historique ({pastBookings.length})
                    </button>
                  </div>

                  {/* Booking cards (max 3) */}
                  <div style={{ padding: 20 }}>
                    {(dashSubTab === 'upcoming' ? upcomingBookings : pastBookings).length === 0 ? (
                      <div className="text-center" style={{ padding: '32px 0' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>{dashSubTab === 'upcoming' ? '\uD83D\uDCC5' : '\u2705'}</div>
                        <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>
                          {dashSubTab === 'upcoming' ? t('clientDash.bookings.noUpcoming') : t('clientDash.bookings.noHistory')}
                        </p>
                        <p style={{ fontSize: 13, color: '#999999' }}>
                          {dashSubTab === 'upcoming' ? t('clientDash.bookings.noUpcomingDesc') : t('clientDash.bookings.noHistoryDesc')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(dashSubTab === 'upcoming' ? upcomingBookings : pastBookings).slice(0, 3).map(booking => (
                          <div
                            key={booking.id}
                            className="flex items-center gap-4 cursor-pointer transition-colors"
                            style={{ padding: '14px 16px', borderRadius: 12, background: '#F5F5F5' }}
                            onClick={() => setActiveTab(dashSubTab === 'upcoming' ? 'upcoming' : 'past')}
                            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#EBEBEB'}
                            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = '#F5F5F5'}
                          >
                            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 42, height: 42, borderRadius: 10, background: 'white' }}>
                              <Calendar className="w-5 h-5" style={{ color: '#FFC107' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                                {booking.services?.name || 'Service'}
                              </p>
                              <p className="truncate" style={{ fontSize: 12, color: '#999999' }}>
                                {booking.profiles_artisan?.company_name || 'Artisan'} &bull; {formatDateLocal(booking.booking_date)}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              {getStatusBadge(booking.status)}
                            </div>
                          </div>
                        ))}

                        {(dashSubTab === 'upcoming' ? upcomingBookings : pastBookings).length > 3 && (
                          <button
                            onClick={() => setActiveTab(dashSubTab === 'upcoming' ? 'upcoming' : 'past')}
                            className="w-full text-center transition-colors"
                            style={{ padding: '10px 0', fontSize: 13, fontWeight: 600, color: '#FFC107', background: 'transparent', border: 'none', cursor: 'pointer' }}
                          >
                            Voir tout ({(dashSubTab === 'upcoming' ? upcomingBookings : pastBookings).length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                  {/* Quick actions */}
                  <div className="bg-white" style={{ borderRadius: 16, padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>{locale === 'pt' ? 'Ações rápidas' : 'Actions rapides'}</p>
                    <div className="space-y-2">
                      {[
                        { label: t('clientDash.findArtisan'), icon: <Search className="w-4 h-4" />, onClick: () => {}, href: '/recherche' },
                        { label: locale === 'pt' ? 'Mensagens' : 'Messages', icon: <MessageSquare className="w-4 h-4" />, onClick: () => setActiveTab('messages'), badge: totalUnread },
                        { label: locale === 'pt' ? 'Documentos' : 'Documents', icon: <FileText className="w-4 h-4" />, onClick: () => setActiveTab('documents') },
                        { label: t('clientDash.tabs.analyseDevis'), icon: <FileSearch className="w-4 h-4" />, onClick: () => setActiveTab('analyse') },
                        { label: locale === 'pt' ? 'Simulador de orçamento' : 'Simulateur de devis', icon: <Calculator className="w-4 h-4" />, onClick: () => setActiveTab('simulateur') },
                      ].map((action, i) => (
                        action.href ? (
                          <LocaleLink
                            key={i}
                            href={action.href}
                            className="flex items-center gap-3 w-full no-underline transition-colors"
                            style={{ padding: '10px 12px', borderRadius: 10, fontSize: 14, color: '#444444', background: '#F5F5F5' }}
                          >
                            <span style={{ color: '#999999' }}>{action.icon}</span>
                            <span className="flex-1">{action.label}</span>
                            <ChevronRight className="w-4 h-4" style={{ color: '#999999' }} />
                          </LocaleLink>
                        ) : (
                          <button
                            key={i}
                            onClick={action.onClick}
                            className="flex items-center gap-3 w-full text-left transition-colors"
                            style={{ padding: '10px 12px', borderRadius: 10, fontSize: 14, color: '#444444', background: '#F5F5F5', border: 'none', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#EBEBEB'}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#F5F5F5'}
                          >
                            <span style={{ color: '#999999' }}>{action.icon}</span>
                            <span className="flex-1">{action.label}</span>
                            {action.badge && action.badge > 0 ? (
                              <span className="flex items-center justify-center" style={{ minWidth: 20, height: 20, borderRadius: 9999, background: '#EF4444', color: 'white', fontSize: 11, fontWeight: 700, padding: '0 5px' }}>{action.badge}</span>
                            ) : (
                              <ChevronRight className="w-4 h-4" style={{ color: '#999999' }} />
                            )}
                          </button>
                        )
                      ))}
                    </div>
                  </div>

                  {/* Métiers populaires */}
                  <div className="bg-white" style={{ borderRadius: 16, padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>Métiers populaires</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Plomberie', icon: <Wrench className="w-4 h-4" />, service: 'plomberie' },
                        { label: 'Électricité', icon: <Zap className="w-4 h-4" />, service: 'electricite' },
                        { label: 'Peinture', icon: <Paintbrush className="w-4 h-4" />, service: 'peinture' },
                        { label: 'Menuiserie', icon: <Hammer className="w-4 h-4" />, service: 'menuiserie' },
                        { label: 'Climatisation', icon: <Snowflake className="w-4 h-4" />, service: 'climatisation' },
                        { label: 'Maçonnerie', icon: <BrickWall className="w-4 h-4" />, service: 'maconnerie' },
                      ].map((m, i) => (
                        <LocaleLink
                          key={i}
                          href={`/recherche?service=${m.service}`}
                          className="flex items-center gap-2 no-underline transition-colors"
                          style={{ padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#444444', background: '#F5F5F5' }}
                        >
                          <span style={{ color: '#FFC107' }}>{m.icon}</span>
                          {m.label}
                        </LocaleLink>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── MESSAGES TAB ── */}
          {activeTab === 'messages' && (
          /* ============== MESSAGES TAB ============== */
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-display font-black tracking-[-0.02em] text-dark flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-600" /> Messagerie
              </h2>
              <button
                onClick={fetchConversations}
                disabled={conversationsLoading}
                className="text-xs text-text-muted hover:text-[#FFC107] transition"
              >
                {conversationsLoading ? (locale === 'pt' ? 'A carregar...' : 'Chargement...') : (locale === 'pt' ? 'Atualizar' : 'Actualiser')}
              </button>
            </div>

            {conversationsLoading && conversations.length === 0 ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] p-5 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-warm-gray rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-12 text-center">
                <div className="text-5xl mb-4">💬</div>
                <h3 className="text-lg font-display font-bold text-dark mb-2">{locale === 'pt' ? 'Nenhuma conversa' : 'Aucune conversation'}</h3>
                <p className="text-text-muted mb-4">{locale === 'pt' ? 'As suas trocas com os profissionais aparecerão aqui.' : 'Vos échanges avec les artisans apparaîtront ici.'}</p>
                <p className="text-sm text-gray-400">{locale === 'pt' ? 'Clique no botão "Mensagens" numa reserva para iniciar uma conversa.' : 'Cliquez sur le bouton "Messages" sur une réservation pour démarrer une conversation.'}</p>
              </div>
            ) : (
              conversations.map(conv => {
                const booking = bookings.find(b => b.id === conv.bookingId)
                if (!booking) return null
                const artisanInitials = (booking.profiles_artisan?.company_name || 'A').substring(0, 2).toUpperCase()
                return (
                  <div
                    key={conv.bookingId}
                    onClick={() => openMessages(booking)}
                    className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-5 hover:shadow-lg transition cursor-pointer border-l-4 border-transparent hover:border-[#FFC107]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-sm flex-shrink-0">
                        {artisanInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-dark truncate">{booking.profiles_artisan?.company_name || 'Artisan'}</h4>
                          <span className="text-[11px] text-gray-400 flex-shrink-0">
                            {new Date(conv.lastDate).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted truncate">{booking.services?.name || 'Service'} — {formatDateLocal(booking.booking_date)}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-sm truncate ${conv.unread > 0 ? 'font-semibold text-dark' : 'text-text-muted'}`}>
                            {conv.lastMessage}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {conv.hasDevis && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">📄 Devis</span>}
                            {conv.unread > 0 && (
                              <span className="bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{conv.unread}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          )}

          {/* ── DOCUMENTS TAB ── */}
          {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-display font-black tracking-[-0.02em] text-dark flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" /> Devis & Factures
              </h2>
              <button
                onClick={fetchDocuments}
                disabled={documentsLoading}
                className="text-xs text-text-muted hover:text-[#FFC107] transition"
              >
                {documentsLoading ? (locale === 'pt' ? 'A carregar...' : 'Chargement...') : (locale === 'pt' ? 'Atualizar' : 'Actualiser')}
              </button>
            </div>

            {documentsLoading && documents.length === 0 ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] p-5 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                        <div className="h-3 bg-warm-gray rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-12 text-center">
                <div className="text-5xl mb-4">📄</div>
                <h3 className="text-lg font-display font-bold text-dark mb-2">{locale === 'pt' ? 'Nenhum documento' : 'Aucun document'}</h3>
                <p className="text-text-muted mb-4">{locale === 'pt' ? 'Os orçamentos e faturas recebidos dos seus profissionais aparecerão aqui.' : 'Les devis et factures reçus de vos artisans apparaîtront ici.'}</p>
                <p className="text-sm text-gray-400">{locale === 'pt' ? 'Quando um profissional lhe envia um orçamento via mensagens, aparecerá aqui.' : 'Quand un artisan vous envoie un devis via la messagerie, il sera listé ici.'}</p>
              </div>
            ) : (
              documents.map((doc: any) => {
                const booking = doc.booking as Booking
                const m = doc.metadata || {}
                const isSigned = m.signed === true
                const isDevisSent = doc.type === 'devis_sent'
                const isDevisSigned = doc.type === 'devis_signed'
                return (
                  <div
                    key={doc.id}
                    className={`bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-5 hover:shadow-lg transition border-l-4 ${
                      isSigned || isDevisSigned ? 'border-green-400' : 'border-amber-400'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                        isSigned || isDevisSigned ? 'bg-green-100' : 'bg-amber-100'
                      }`}>
                        {isSigned || isDevisSigned ? '✅' : '📄'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-dark">
                            {isDevisSigned ? 'Devis signé' : 'Devis'} {m.docNumber ? `N.º${m.docNumber}` : ''}
                          </h4>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            isSigned || isDevisSigned ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isSigned || isDevisSigned ? 'Signé' : 'En attente'}
                          </span>
                        </div>
                        <p className="text-sm text-text-muted mt-1">{booking?.profiles_artisan?.company_name || 'Artisan'} — {booking?.services?.name || 'Service'}</p>
                        {m.totalStr && <p className="text-lg font-bold text-dark mt-2">{m.totalStr}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>Reçu le {new Date(doc.created_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          {m.prestationDate && <span>Prestation : {new Date(m.prestationDate).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short' })}</span>}
                        </div>
                        {isSigned && m.signer_name && (
                          <p className="text-xs text-green-600 font-medium mt-1.5">Signé par {m.signer_name}{m.signed_at ? ` le ${new Date(m.signed_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>
                        )}
                        {isDevisSent && !isSigned && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => openMessages(booking)}
                              className="text-xs font-semibold px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition"
                            >
                              Signer ce devis
                            </button>
                            <button
                              onClick={() => openMessages(booking)}
                              className="text-xs font-semibold px-3 py-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition"
                            >
                              Voir la conversation
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          )}

          {/* ── LOGEMENT TAB ── */}
          {activeTab === 'logement' && (
          <div className="space-y-6">
            {/* Health Score Header */}
            <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                    getCILHealthScore() >= 75 ? 'bg-green-100 text-green-700' :
                    getCILHealthScore() >= 50 ? 'bg-amber-100 text-amber-700' :
                    getCILHealthScore() >= 25 ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {getCILHealthScore()}%
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-black tracking-[-0.02em] text-dark flex items-center gap-2">
                      <Shield className="w-5 h-5 text-[#FFC107]" />
                      {t('clientDash.logement.healthTitle')}
                    </h2>
                    <p className="text-sm text-text-muted mt-0.5">
                      {cilEntries.length} {cilEntries.length > 1 ? t('clientDash.logement.interventionsCountPlural') : t('clientDash.logement.interventionsCount')} {cilEntries.length > 1 ? t('clientDash.logement.registeredPlural') : t('clientDash.logement.registered')}
                      {' '}&bull;{' '}{t('clientDash.logement.legalObligation')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={exportCIL}
                  disabled={cilEntries.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-warm-gray hover:bg-warm-gray/80 text-mid rounded-xl font-semibold text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Copy className="w-4 h-4" />
                  {t('clientDash.logement.exportCIL')}
                </button>
              </div>

              {/* Health score bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                  <span>{t('clientDash.logement.globalHealthScore')}</span>
                  <span className={`font-semibold ${
                    getCILHealthScore() >= 75 ? 'text-green-600' :
                    getCILHealthScore() >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {getCILHealthScore() >= 75 ? t('clientDash.logement.goodCondition') :
                     getCILHealthScore() >= 50 ? t('clientDash.logement.attentionRequired') :
                     getCILHealthScore() >= 25 ? t('clientDash.logement.maintenanceNeeded') : t('clientDash.logement.noData')}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      getCILHealthScore() >= 75 ? 'bg-green-500' :
                      getCILHealthScore() >= 50 ? 'bg-amber-500' :
                      getCILHealthScore() >= 25 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${getCILHealthScore()}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Category filter chips */}
            {cilEntries.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-text-muted" />
                {([
                  { key: 'all' as const, label: t('clientDash.logement.filterAll') },
                  { key: 'plomberie' as const, label: t('clientDash.logement.filterPlomberie') },
                  { key: 'electricite' as const, label: t('clientDash.logement.filterElectricite') },
                  { key: 'chauffage' as const, label: t('clientDash.logement.filterChauffage') },
                  { key: 'serrurerie' as const, label: t('clientDash.logement.filterSerrurerie') },
                  { key: 'autre' as const, label: t('clientDash.logement.filterAutre') },
                ]).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setCilFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      cilFilter === f.key
                        ? 'bg-[#FFC107] text-dark shadow-sm'
                        : 'bg-white text-text-muted hover:bg-warm-gray border border-[#E0E0E0]'
                    }`}
                  >
                    {f.label}
                    {f.key !== 'all' && ` (${cilEntries.filter(e => e.category === f.key).length})`}
                  </button>
                ))}
              </div>
            )}

            {/* Timeline entries */}
            {filteredCilEntries.length === 0 ? (
              <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-12 text-center">
                <div className="text-5xl mb-4">{'\uD83C\uDFE0'}</div>
                <h3 className="text-lg font-display font-bold text-dark mb-2">
                  {cilEntries.length === 0 ? t('clientDash.logement.noInterventions') : t('clientDash.logement.noCategoryInterventions')}
                </h3>
                <p className="text-text-muted mb-4 max-w-md mx-auto">
                  {cilEntries.length === 0
                    ? t('clientDash.logement.autoFillDesc')
                    : t('clientDash.logement.tryOtherFilter')
                  }
                </p>
                {cilEntries.length === 0 && (
                  <LocaleLink
                    href="/recherche"
                    className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-dark px-8 py-3 rounded-lg font-semibold transition"
                  >
                    {t('clientDash.logement.bookIntervention')}
                  </LocaleLink>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCilEntries.map((entry, idx) => {
                  const catInfo = getCategoryInfo(entry.category)
                  const now = new Date()
                  const warrantyActive = entry.warranty ? new Date(entry.warranty.endDate) > now : false
                  const maintenanceOverdue = entry.nextMaintenance ? new Date(entry.nextMaintenance) < now : false

                  return (
                    <button
                      key={entry.id}
                      onClick={() => setShowCilDetail(entry)}
                      className="w-full text-left bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-5 hover:shadow-lg transition group"
                    >
                      <div className="flex items-start gap-4">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${catInfo.color}`}>
                            {catInfo.icon}
                          </div>
                          {idx < filteredCilEntries.length - 1 && (
                            <div className="w-0.5 h-8 bg-gray-200 mt-2" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-dark truncate">{entry.serviceName}</h4>
                            <span className="text-sm font-semibold text-[#FFC107] flex-shrink-0">{formatPrice(entry.priceTTC, locale)}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-text-muted">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(entry.date).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="truncate">{entry.artisanName}</span>
                          </div>

                          {/* Status badges */}
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {/* Proof badge */}
                            {entry.hasProof ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[11px] font-medium border border-green-200">
                                <CheckCircle className="w-3 h-3" /> {t('clientDash.logement.proof')}
                                {entry.proofPhotosCount > 0 && <span>({entry.proofPhotosCount} {t('clientDash.logement.photos')})</span>}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warm-gray text-text-muted rounded-full text-[11px] font-medium border border-[#E0E0E0]">
                                {t('clientDash.logement.noProof')}
                              </span>
                            )}
                            {/* Signature */}
                            {entry.hasSignature && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[11px] font-medium border border-blue-200">
                                {'\u270D\uFE0F'} {t('clientDash.logement.signedBadge')}
                              </span>
                            )}
                            {/* GPS */}
                            {entry.hasGPS && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[11px] font-medium border border-purple-200">
                                <MapPin className="w-3 h-3" /> GPS
                              </span>
                            )}
                            {/* Warranty */}
                            {warrantyActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-medium border border-emerald-200">
                                <Shield className="w-3 h-3" /> {t('clientDash.logement.underWarranty')}
                              </span>
                            ) : entry.warranty ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[11px] font-medium border border-red-200">
                                <AlertTriangle className="w-3 h-3" /> {t('clientDash.logement.warrantyExpired')}
                              </span>
                            ) : null}
                            {/* Maintenance overdue */}
                            {maintenanceOverdue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[11px] font-medium border border-amber-200">
                                <AlertTriangle className="w-3 h-3" /> {t('clientDash.logement.maintenanceOverdue')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#FFC107] transition flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Summary stats */}
            {cilEntries.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] text-center">
                  <div className="text-2xl font-bold text-dark">{cilEntries.length}</div>
                  <div className="text-xs text-text-muted mt-1">{t('clientDash.logement.interventions')}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] text-center">
                  <div className="text-2xl font-bold text-green-600">{cilEntries.filter(e => e.hasProof).length}</div>
                  <div className="text-xs text-text-muted mt-1">{t('clientDash.logement.withProof')}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] text-center">
                  <div className="text-2xl font-bold text-emerald-600">
                    {cilEntries.filter(e => e.warranty && new Date(e.warranty.endDate) > new Date()).length}
                  </div>
                  <div className="text-xs text-text-muted mt-1">{t('clientDash.logement.underWarranty')}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] text-center">
                  <div className="text-2xl font-bold text-[#FFC107]">{formatPrice(cilEntries.reduce((sum, e) => sum + e.priceTTC, 0), locale)}</div>
                  <div className="text-xs text-text-muted mt-1">{t('clientDash.logement.totalSpent')}</div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* ── ANALYSE DEVIS TAB ── */}
          {activeTab === 'analyse' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FFC107] to-[#FFB300] rounded-2xl p-6 text-dark">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white/40 rounded-xl flex items-center justify-center">
                  <FileSearch className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-black tracking-[-0.02em]">{t('clientDash.analyse.title')}</h2>
                  <p className="text-mid text-sm">{t('clientDash.analyse.subtitle')}</p>
                </div>
              </div>
              <div className="flex gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-700" />
                  <span>{t('clientDash.analyse.marketPrice')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-green-700" />
                  <span>{t('clientDash.analyse.costBreakdown')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>{t('clientDash.analyse.scamDetection')}</span>
                </div>
              </div>
            </div>

            {/* PDF upload */}
            {!analyseResult && (
              <div>
                  <div className="space-y-3">
                    {!analysePdfReady ? (
                      <label className="block border-2 border-dashed border-[#E0E0E0] rounded-2xl p-8 text-center cursor-pointer hover:border-[#FFC107] hover:bg-amber-50 transition">
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setAnalyseExtracting(true)
                            setAnalyseFilename(file.name)
                            try {
                              const { data: { session } } = await supabase.auth.getSession()
                              const fd = new FormData()
                              fd.append('file', file)
                              const res = await fetch('/api/client/extract-pdf', {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${session?.access_token}` },
                                body: fd,
                              })
                              const data = await res.json()
                              if (data.success) {
                                setAnalyseInput(data.text)
                                setAnalysePdfReady(true)
                              } else {
                                alert(data.error || t('clientDash.analyse.pdfExtractionError'))
                                // PDF scanné non supporté
                              }
                            } catch { alert(t('clientDash.analyse.networkError')) }
                            finally { setAnalyseExtracting(false) }
                          }}
                        />
                        {analyseExtracting ? (
                          <div>
                            <div className="text-3xl mb-2 animate-pulse">{'\u23F3'}</div>
                            <div className="font-semibold text-mid">{t('clientDash.analyse.extracting')}</div>
                            <div className="text-sm text-text-muted">{t('clientDash.analyse.readingPdf')}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-3xl mb-2">{'\uD83D\uDCC4'}</div>
                            <div className="font-semibold text-mid">{t('clientDash.analyse.clickToImport')}</div>
                            <div className="text-sm text-text-muted mt-1">{t('clientDash.analyse.pdfMaxSize')}</div>
                          </div>
                        )}
                      </label>
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-semibold text-sm">{t('clientDash.analyse.pdfExtracted')} : {analyseFilename}</span>
                        </div>
                        <div className="text-xs text-green-600 mt-1">{analyseInput.length} {t('clientDash.analyse.charactersExtracted')}</div>
                        <button onClick={() => { setAnalysePdfReady(false); setAnalyseInput(''); setAnalyseFilename('') }} className="text-xs text-green-600 underline mt-1">{t('clientDash.analyse.changeFile')}</button>
                      </div>
                    )}
                  </div>

                {/* Analyze button */}
                <button
                  disabled={analyseLoading || analyseInput.trim().length < 20}
                  onClick={async () => {
                    setAnalyseLoading(true)
                    setAnalyseResult('')
                    try {
                      const { data: { session } } = await supabase.auth.getSession()
                      const res = await fetch('/api/client/analyse-devis', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${session?.access_token}`,
                        },
                        body: JSON.stringify({ content: analyseInput, filename: analyseFilename }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        setAnalyseResult(data.analysis)
                        // Save to history
                        const verdict = data.analysis.match(/Verdict.*?:\s*(.+)/)?.[1]?.trim() || ''
                        const hist = [...analyseHistory, { date: new Date().toISOString(), filename: analyseFilename || t('clientDash.analyse.noName'), verdict }].slice(-10)
                        setAnalyseHistory(hist)
                        try { localStorage.setItem('fixit_analyse_history_client', JSON.stringify(hist)) } catch {}
                      } else {
                        alert(data.error || t('clientDash.analyse.analysisError'))
                      }
                    } catch { alert(t('clientDash.analyse.networkError')) }
                    finally { setAnalyseLoading(false) }
                  }}
                  className="w-full bg-[#FFC107] hover:bg-[#FFB300] disabled:opacity-40 text-dark font-bold py-4 rounded-xl text-sm transition flex items-center justify-center gap-2 mt-4"
                >
                  {analyseLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
                      {t('clientDash.analyse.analyzing')}
                    </>
                  ) : (
                    <>
                      <FileSearch className="w-4 h-4" />
                      {t('clientDash.analyse.analyzeButton')}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Results */}
            {analyseResult && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(analyseResult)
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-warm-gray text-mid hover:bg-warm-gray/80 transition flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {t('clientDash.analyse.copy')}
                  </button>
                  <button
                    onClick={() => { setAnalyseResult(''); setAnalyseInput(''); setAnalyseFilename(''); setAnalysePdfReady(false) }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#FFC107] text-dark hover:bg-[#FFB300] transition"
                  >
                    {t('clientDash.analyse.analyzeAnother')}
                  </button>
                </div>

                <div
                  className="bg-white border border-[#E0E0E0] rounded-2xl p-6 prose prose-sm max-w-none
                    [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-dark
                    [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2
                    [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse [&_table]:mt-3 [&_table]:mb-3
                    [&_th]:bg-warm-gray [&_th]:border [&_th]:border-[#E0E0E0] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-mid
                    [&_td]:border [&_td]:border-[#E0E0E0] [&_td]:px-3 [&_td]:py-2
                    [&_hr]:my-4 [&_hr]:border-[#E0E0E0]
                    [&_strong]:font-bold
                    [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:space-y-1
                    [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:space-y-1
                    [&_p]:mb-2 [&_p]:leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(analyseResult) }}
                />
              </div>
            )}

            {/* History */}
            {analyseHistory.length > 0 && !analyseResult && (
              <div>
                <h3 className="text-sm font-bold text-text-muted mb-3">{t('clientDash.analyse.recentAnalyses')}</h3>
                <div className="space-y-2">
                  {analyseHistory.slice().reverse().map((h, i) => (
                    <div key={i} className="bg-white border border-[#E0E0E0] rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-dark">{h.filename}</div>
                        <div className="text-xs text-text-muted">{new Date(h.date).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-warm-gray text-text-muted">{h.verdict.substring(0, 30) || t('clientDash.analyse.analyzed')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trust banner */}
            {!analyseResult && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-amber-800 text-sm">{t('clientDash.analyse.confidential')}</div>
                    <div className="text-xs text-amber-600 mt-0.5">{t('clientDash.analyse.confidentialDesc')}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* ── SIMULATEUR TAB ── */}
          {activeTab === 'simulateur' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-display font-black tracking-[-0.02em] flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                {locale === 'pt' ? 'Simulador de Orçamento' : 'Simulateur de Devis'}
              </h2>
              <p className="text-mid text-sm mt-1">
                {locale === 'pt'
                  ? 'Descreva o seu projeto para obter uma estimativa de preço instantânea.'
                  : 'Décrivez votre projet pour obtenir une estimation de prix instantanée.'}
              </p>
            </div>
            <SimulateurDevisClient initialCity={profileData.city || ''} />
          </div>
          )}

          {/* ── BOURSE AUX MARCHÉS TAB ── */}
          {activeTab === 'marches' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-display font-black tracking-[-0.02em] flex items-center gap-2">
                <Hammer className="w-5 h-5" />
                {locale === 'pt' ? 'Bolsa de Mercados' : 'Bourse aux Marchés'}
              </h2>
              <p className="text-text-muted text-sm mt-1">
                {locale === 'pt'
                  ? 'Publique o seu projeto e receba propostas de artesãos qualificados perto de si.'
                  : 'Publiez votre projet et recevez des propositions d\'artisans qualifiés près de chez vous.'}
              </p>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-[#EFEFEF] p-5 text-center">
                <div className="text-2xl font-bold text-yellow-600">🏛️</div>
                <div className="text-sm text-text-muted mt-1">{locale === 'pt' ? 'Publique um projeto' : 'Publiez un projet'}</div>
              </div>
              <div className="bg-white rounded-2xl border border-[#EFEFEF] p-5 text-center">
                <div className="text-2xl font-bold text-blue-600">📍</div>
                <div className="text-sm text-text-muted mt-1">{locale === 'pt' ? 'Artesãos próximos notificados' : 'Artisans proches notifiés'}</div>
              </div>
              <div className="bg-white rounded-2xl border border-[#EFEFEF] p-5 text-center">
                <div className="text-2xl font-bold text-green-600">✅</div>
                <div className="text-sm text-text-muted mt-1">{locale === 'pt' ? 'Escolha a melhor proposta' : 'Choisissez la meilleure offre'}</div>
              </div>
            </div>

            {/* CTA to publish */}
            <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-6 md:p-8 mb-6">
              <h3 className="font-display font-bold text-lg mb-3">
                {locale === 'pt' ? '📋 Publique o seu projeto' : '📋 Publiez votre projet'}
              </h3>
              <p className="text-text-muted text-sm mb-5">
                {locale === 'pt'
                  ? 'Descreva os trabalhos necessários e receba até 3 propostas de artesãos certificados próximos de si. Gratuito e sem compromisso.'
                  : 'Décrivez les travaux nécessaires et recevez jusqu\'à 3 propositions d\'artisans certifiés proches de chez vous. Gratuit et sans engagement.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={locale === 'pt' ? '/pt/mercados/publicar' : '/marches/publier'}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all"
                  style={{ background: '#FFC107', color: '#1A1A1A', boxShadow: '0 4px 14px rgba(255,214,0,0.3)' }}
                >
                  <Hammer className="w-4 h-4" />
                  {locale === 'pt' ? 'Publicar um apelo a concurso' : 'Publier un appel d\'offres'}
                </a>
              </div>
            </div>

            {/* How it works */}
            <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-6 md:p-8">
              <h3 className="font-display font-bold text-lg mb-4">
                {locale === 'pt' ? '🔄 Como funciona?' : '🔄 Comment ça marche ?'}
              </h3>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: '#FFF8E1', color: '#F9A825' }}>1</div>
                  <div>
                    <p className="font-semibold text-sm">{locale === 'pt' ? 'Descreva o seu projeto' : 'Décrivez votre projet'}</p>
                    <p className="text-text-muted text-xs">{locale === 'pt' ? 'Tipo de trabalho, orçamento, prazo, exigências (RC Pro, RGE...)' : 'Type de travaux, budget, délai, exigences (RC Pro, RGE...)'}</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: '#E3F2FD', color: '#1565C0' }}>2</div>
                  <div>
                    <p className="font-semibold text-sm">{locale === 'pt' ? 'Artesãos próximos são notificados' : 'Les artisans proches sont notifiés'}</p>
                    <p className="text-text-muted text-xs">{locale === 'pt' ? 'Apenas artesãos qualificados e disponíveis na sua zona recebem o pedido' : 'Seuls les artisans qualifiés et disponibles dans votre zone reçoivent la demande'}</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: '#E8F5E9', color: '#2E7D32' }}>3</div>
                  <div>
                    <p className="font-semibold text-sm">{locale === 'pt' ? 'Compare e escolha' : 'Comparez et choisissez'}</p>
                    <p className="text-text-muted text-xs">{locale === 'pt' ? 'Receba até 3 propostas, consulte os perfis, e escolha o melhor artesão' : 'Recevez jusqu\'à 3 propositions, consultez les profils, et choisissez le meilleur artisan'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* ── PROFILE TAB ── */}
          {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-black tracking-[-0.02em] text-xl flex items-center gap-2">
                <User className="w-5 h-5" />
                {t('clientDash.profile.title')}
              </h3>
              {!editingProfile && (
                <button
                  onClick={startEditing}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FFC107] hover:bg-[#FFD54F] text-dark rounded-lg font-semibold transition text-sm"
                >
                  <Pencil className="w-4 h-4" />
                  {t('clientDash.profile.edit')}
                </button>
              )}
            </div>

            {/* Photo de profil */}
            <div className="flex items-center gap-5 mb-6 pb-6 border-b border-[#EFEFEF]">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ border: '3px solid #FFC107', background: '#F5F5F5' }}>
                  {clientPhotoPreview ? (
                    <Image src={clientPhotoPreview} alt={t('clientDash.profile.preview')} width={96} height={96} className="w-full h-full object-cover" unoptimized />
                  ) : user?.user_metadata?.profile_photo_url ? (
                    <Image src={user.user_metadata.profile_photo_url} alt="Photo" width={96} height={96} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <span style={{ fontSize: 32, fontWeight: 700, color: '#999999' }}>{userInitials}</span>
                  )}
                </div>
                {/* Overlay caméra au hover */}
                <label className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setClientPhotoFile(f)
                    const reader = new FileReader()
                    reader.onload = (ev) => setClientPhotoPreview(ev.target?.result as string)
                    reader.readAsDataURL(f)
                  }} />
                </label>
              </div>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>{userName}</p>
                <p style={{ fontSize: 14, color: '#999999', marginBottom: 10 }}>{user?.email}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="cursor-pointer inline-flex items-center gap-2 text-sm font-semibold transition" style={{ background: '#F5F5F5', color: '#444444', padding: '7px 14px', borderRadius: 10 }}
                    onMouseEnter={e => (e.currentTarget as HTMLLabelElement).style.background = '#EAEAEA'}
                    onMouseLeave={e => (e.currentTarget as HTMLLabelElement).style.background = '#F5F5F5'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    {clientPhotoFile ? clientPhotoFile.name : t('clientDash.profile.changePhoto')}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      setClientPhotoFile(f)
                      const reader = new FileReader()
                      reader.onload = (ev) => setClientPhotoPreview(ev.target?.result as string)
                      reader.readAsDataURL(f)
                    }} />
                  </label>
                  {clientPhotoFile && (
                    <button
                      onClick={() => uploadClientPhoto(clientPhotoFile)}
                      disabled={clientPhotoUploading}
                      className="text-sm font-semibold transition disabled:opacity-60"
                      style={{ background: '#FFC107', color: '#1A1A1A', padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer' }}
                    >
                      {clientPhotoUploading ? t('clientDash.profile.uploading') : t('clientDash.profile.uploadPhoto')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {profileSuccess && (
              <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-lg text-sm flex items-center gap-2">
                <span>✓</span> {profileSuccess}
              </div>
            )}
            {profileError && (
              <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {profileError}
              </div>
            )}

            {editingProfile ? (
              /* Mode édition */
              <div className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-mid mb-2">{t('clientDash.profile.fullName')} <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={profileData.fullName}
                      onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                      className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none"
                      placeholder={t('clientDash.profile.namePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-mid mb-2">{t('clientDash.profile.phone')} <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none"
                      placeholder={t('clientDash.profile.phonePlaceholder')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-mid mb-2">{t('clientDash.profile.addressLabel')}</label>
                  <input
                    type="text"
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none"
                    placeholder={t('clientDash.profile.addressPlaceholder')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-mid mb-2">{t('clientDash.profile.postalCode')}</label>
                    <input
                      type="text"
                      value={profileData.postalCode}
                      onChange={(e) => setProfileData({ ...profileData, postalCode: e.target.value })}
                      className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none"
                      placeholder={t('clientDash.profile.postalCodePlaceholder')}
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-mid mb-2">{t('clientDash.profile.city')}</label>
                    <input
                      type="text"
                      value={profileData.city}
                      onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                      className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none"
                      placeholder={t('clientDash.profile.cityPlaceholder')}
                    />
                  </div>
                </div>

                {/* Email non modifiable */}
                <div>
                  <label className="block text-sm font-semibold text-mid mb-2">{t('clientDash.profile.email')}</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-3 border-[1.5px] border-[#EFEFEF] rounded-xl bg-warm-gray text-text-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-text-muted mt-1">{t('clientDash.profile.emailNotEditable')}</p>
                </div>

                {/* Type de client (lecture seule) */}
                {user?.user_metadata?.client_type && (
                  <div>
                    <label className="block text-sm font-semibold text-mid mb-2">{t('clientDash.profile.accountType')}</label>
                    <div className="flex items-center gap-2 px-4 py-3 border-[1.5px] border-[#EFEFEF] rounded-xl bg-warm-gray">
                      <span className="text-xl">{user.user_metadata.client_type === 'entreprise' ? '🏢' : '🏠'}</span>
                      <span className="font-medium text-mid">
                        {user.user_metadata.client_type === 'entreprise' ? t('clientDash.profile.enterprise') : t('clientDash.profile.individual')}
                      </span>
                      {user.user_metadata.company_name && (
                        <span className="text-text-muted">— {user.user_metadata.company_name}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Boutons sauvegarder / annuler */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="flex items-center gap-2 px-6 py-3 bg-[#FFC107] hover:bg-[#FFD54F] text-dark rounded-lg font-semibold transition disabled:opacity-60 text-sm"
                  >
                    {savingProfile ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {t('clientDash.profile.saving')}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {t('clientDash.profile.save')}
                      </>
                    )}
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={savingProfile}
                    className="flex items-center gap-2 px-6 py-3 bg-warm-gray hover:bg-warm-gray/80 text-mid rounded-lg font-semibold transition text-sm"
                  >
                    <X className="w-4 h-4" />
                    {t('clientDash.profile.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              /* Mode lecture */
              <div className="space-y-1">
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="flex items-start gap-3 py-3 border-b border-[#EFEFEF]">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-[#FFC107]" />
                    </div>
                    <div>
                      <p className="text-xs text-text-muted uppercase tracking-wide font-medium">{t('clientDash.profile.fullName')}</p>
                      <p className="font-semibold text-dark">{user?.user_metadata?.full_name || '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 py-3 border-b border-[#EFEFEF]">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-[#FFC107]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted uppercase tracking-wide font-medium">{t('clientDash.profile.email')}</p>
                      <p className="font-semibold text-dark">{user?.email || '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 py-3 border-b border-[#EFEFEF]">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-[#FFC107]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted uppercase tracking-wide font-medium">{t('clientDash.profile.phone')}</p>
                      <p className="font-semibold text-dark">{user?.user_metadata?.phone || '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 py-3 border-b border-[#EFEFEF]">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-[#FFC107]" />
                    </div>
                    <div>
                      <p className="text-xs text-text-muted uppercase tracking-wide font-medium">{t('clientDash.profile.addressLabel')}</p>
                      <p className="font-semibold text-dark">
                        {user?.user_metadata?.address || '—'}
                        {user?.user_metadata?.postal_code || user?.user_metadata?.city ? (
                          <span className="text-text-muted font-normal">
                            {user?.user_metadata?.postal_code ? `, ${user.user_metadata.postal_code}` : ''}
                            {user?.user_metadata?.city ? ` ${user.user_metadata.city}` : ''}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  {user?.user_metadata?.client_type && (
                    <div className="flex items-start gap-3 py-3 border-b border-[#EFEFEF]">
                      <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm">{user.user_metadata.client_type === 'entreprise' ? '🏢' : '🏠'}</span>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wide font-medium">{t('clientDash.profile.accountType')}</p>
                        <p className="font-semibold text-dark">
                          {user.user_metadata.client_type === 'entreprise' ? t('clientDash.profile.enterprise') : t('clientDash.profile.individual')}
                          {user.user_metadata.company_name && (
                            <span className="text-text-muted font-normal"> — {user.user_metadata.company_name}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {user?.user_metadata?.siret && (
                    <div className="flex items-start gap-3 py-3 border-b border-[#EFEFEF]">
                      <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm">📋</span>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wide font-medium">{t('clientDash.profile.siret')}</p>
                        <p className="font-semibold text-dark font-mono">
                          {user.user_metadata.siret}
                          {user.user_metadata.company_verified && (
                            <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-sans">✓ {t('clientDash.profile.verified')}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <p className="text-xs text-text-muted">{t('clientDash.profile.memberSince')} {user?.created_at ? new Date(user.created_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { month: 'long', year: 'numeric' }) : '—'}</p>
                </div>
              </div>
            )}
          </div>
          )}

          {/* ── BOOKINGS TABS (upcoming / past) ── */}
          {(activeTab === 'upcoming' || activeTab === 'past') && (
          <div className="space-y-4">
            {(activeTab === 'upcoming' ? upcomingBookings : pastBookings).length === 0 ? (
              <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-12 text-center">
                <div className="text-5xl mb-4">{activeTab === 'upcoming' ? '\uD83D\uDCC5' : '\u2705'}</div>
                <h3 className="text-lg font-display font-bold text-dark mb-2">
                  {activeTab === 'upcoming' ? t('clientDash.bookings.noUpcoming') : t('clientDash.bookings.noHistory')}
                </h3>
                <p className="text-text-muted mb-6">
                  {activeTab === 'upcoming'
                    ? t('clientDash.bookings.noUpcomingDesc')
                    : t('clientDash.bookings.noHistoryDesc')
                  }
                </p>
                {activeTab === 'upcoming' && (
                  <LocaleLink
                    href="/recherche"
                    className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-dark px-8 py-3 rounded-lg font-semibold transition"
                  >
                    {t('clientDash.bookings.findArtisan')}
                  </LocaleLink>
                )}
              </div>
            ) : (
              (activeTab === 'upcoming' ? upcomingBookings : pastBookings).map((booking) => {
                const myRating = ratings[booking.id]
                const isUpcoming = activeTab === 'upcoming'
                const canCancel = isUpcoming && !['cancelled'].includes(booking.status)
                const canRate = !isUpcoming && booking.status === 'completed' && !myRating && booking.price_ttc > 0
                const artisanId = (booking as any).artisan_id
                const isFavori = favoris.includes(artisanId)
                return (
                <div key={booking.id} className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-6 hover:shadow-lg hover:-translate-y-px transition">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-dark truncate">
                          {booking.services?.name || 'Service'}
                        </h3>
                        {getStatusBadge(booking.status)}
                        {/* Favori */}
                        {artisanId && (
                          <button
                            onClick={() => toggleFavori(artisanId)}
                            className={`text-lg transition-transform hover:scale-110 ${isFavori ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                            title={isFavori ? t('clientDash.bookings.removeFromFavorites') : t('clientDash.bookings.addToFavorites')}
                          >
                            ❤️
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5 text-sm text-text-muted">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{booking.profiles_artisan?.company_name || 'Artisan'}</span>
                          {booking.profiles_artisan?.rating_avg && (
                            <span className="flex items-center gap-0.5 text-amber-500">
                              <Star className="w-3.5 h-3.5 fill-current" />
                              {booking.profiles_artisan.rating_avg}
                            </span>
                          )}
                          {/* Badge assurance live */}
                          {booking.profiles_artisan?.rating_count && booking.profiles_artisan.rating_count > 0 && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">{t('clientDash.bookings.insured')}</span>
                          )}
                          {/* Score ponctualité */}
                          {(() => {
                            const score = getPonctualiteScore(booking.artisan_id)
                            if (score === null) return null
                            return (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
                                score >= 90 ? 'bg-green-100 text-green-700' : score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                              }`}>
                                ⏱️ {score}%
                              </span>
                            )
                          })()}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span>{formatDateLocal(booking.booking_date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 flex-shrink-0" />
                          <span>{booking.booking_time?.substring(0, 5)} &bull; {booking.duration_minutes || 60} min</span>
                        </div>
                        {booking.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{booking.address}</span>
                          </div>
                        )}
                        {/* 48h countdown */}
                        {booking.status === 'pending' && booking.expires_at && (
                          <div className="flex items-center gap-2 mt-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            <span className="text-xs text-amber-600 font-medium">
                              {t('clientDash.bookings.pendingConfirmation')} &bull; {t('clientDash.bookings.expiresOn')} {new Date(booking.expires_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        {/* Confirmed date */}
                        {booking.confirmed_at && (booking.status === 'confirmed' || booking.status === 'completed') && (
                          <div className="flex items-center gap-2 mt-1">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            <span className="text-xs text-green-600 font-medium">
                              Confirmé le {new Date(booking.confirmed_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à {new Date(booking.confirmed_at).toLocaleTimeString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        {/* Completed date */}
                        {booking.completed_at && booking.status === 'completed' && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            <span className="text-xs text-blue-600 font-medium">
                              Terminé le {new Date(booking.completed_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à {new Date(booking.completed_at).toLocaleTimeString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        {/* Notes affichées */}
                        {booking.notes && (
                          <div className="flex items-start gap-2 mt-2 bg-warm-gray rounded-lg px-3 py-2">
                            <span className="text-xs">📝</span>
                            <span className="text-xs text-text-muted">{booking.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xl font-bold text-[#FFC107]">{formatPrice(booking.price_ttc || 0, locale)}</div>
                      <div className="text-xs text-text-muted mt-1">{t('clientDash.bookings.ttc')}</div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#EFEFEF]">
                    {/* Messages */}
                    {booking.status !== 'cancelled' && (
                      <button
                        onClick={() => openMessages(booking)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition relative"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> {t('clientDash.bookings.messages')}
                        {unreadCounts[booking.id] > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{unreadCounts[booking.id]}</span>
                        )}
                      </button>
                    )}
                    {/* Suivre GPS */}
                    {isUpcoming && booking.status === 'confirmed' && (
                      <button
                        onClick={() => loadTracking(booking)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                      >
                        {t('clientDash.bookings.trackArtisan')}
                      </button>
                    )}
                    {/* Annuler */}
                    {canCancel && (
                      <button
                        onClick={() => setCancelConfirm(booking.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition"
                      >
                        {t('clientDash.bookings.cancel')}
                      </button>
                    )}
                    {/* Noter */}
                    {canRate && (
                      <button
                        onClick={() => { setRatingModal(booking); setRatingVal(5); setRatingComment('') }}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition"
                      >
                        {t('clientDash.bookings.leaveReview')}
                      </button>
                    )}
                    {/* Note déjà donnée */}
                    {myRating && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-green-50 text-green-700 border border-green-200">
                        {'⭐'.repeat(myRating.stars)} {t('clientDash.bookings.yourReview')}
                      </div>
                    )}
                    {/* Notation verrouillée (post-facture) */}
                    {!isUpcoming && booking.status === 'completed' && !myRating && !(booking.price_ttc > 0) && (
                      <div className="flex items-center gap-1.5 text-[11px] text-text-muted px-3 py-2">
                        {t('clientDash.bookings.reviewLockedAfterBilling')}
                      </div>
                    )}
                    {/* Re-réserver */}
                    {!isUpcoming && booking.status === 'completed' && (
                      <a
                        href={`/recherche?artisan=${artisanId}`}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#FFC107]/10 text-amber-700 hover:bg-[#FFC107]/20 border border-amber-200 transition"
                      >
                        {t('clientDash.bookings.rebook')}
                      </a>
                    )}
                  </div>
                </div>
                )
              })
            )}
          </div>
          )}

        </main>
      </div>

      {/* ═══════════ MOBILE BOTTOM NAV (< md) ═══════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white flex items-center justify-around" style={{ borderTop: '1px solid #E8E8E8', height: 56, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { key: 'dashboard' as const, icon: <LayoutDashboard className="w-5 h-5" />, label: 'Home' },
          { key: 'upcoming' as const, icon: <Calendar className="w-5 h-5" />, label: t('clientDash.stats.reservations') },
          { key: 'messages' as const, icon: <MessageSquare className="w-5 h-5" />, label: locale === 'pt' ? 'Mensagens' : 'Messages', badge: totalUnread },
          { key: 'logement' as const, icon: <Home className="w-5 h-5" />, label: t('clientDash.tabs.logement') },
          { key: 'marches' as const, icon: <Hammer className="w-5 h-5" />, label: locale === 'pt' ? 'Mercados' : 'Marchés' },
          { key: 'profile' as const, icon: <User className="w-5 h-5" />, label: 'Profil' },
        ].map(item => {
          const isActive = item.key === activeTab || (item.key === 'upcoming' && activeTab === 'past')
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className="relative flex flex-col items-center justify-center gap-0.5"
              style={{ flex: 1, border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 0', color: isActive ? '#FFC107' : '#999999' }}
            >
              {item.icon}
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="absolute flex items-center justify-center" style={{ top: 2, right: '50%', marginRight: -16, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', color: 'white', fontSize: 9, fontWeight: 700 }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Modal Annulation ── */}
      {cancelConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCancelConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-lg font-display font-bold text-dark">{t('clientDash.cancelModal.title')}</h3>
              <p className="text-sm text-text-muted mt-1">{t('clientDash.cancelModal.description')}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelConfirm(null)}
                className="flex-1 border border-[#E0E0E0] text-mid py-3 rounded-xl font-semibold text-sm hover:bg-warm-gray transition"
              >
                {t('clientDash.cancelModal.keep')}
              </button>
              <button
                onClick={() => cancelBooking(cancelConfirm)}
                disabled={!!cancellingId}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white py-3 rounded-xl font-bold text-sm transition"
              >
                {cancellingId ? '...' : t('clientDash.cancelModal.confirmCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Notation ── */}
      {ratingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRatingModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-[#EFEFEF]">
              <h3 className="text-lg font-display font-bold text-dark">{t('clientDash.rating.title')}</h3>
              <p className="text-sm text-text-muted mt-1">{ratingModal.profiles_artisan?.company_name} — {ratingModal.services?.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm font-semibold text-mid mb-2">{t('clientDash.rating.yourRating')}</div>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setRatingVal(n)} className={`text-3xl transition-transform hover:scale-110 ${n <= ratingVal ? 'opacity-100' : 'opacity-25'}`}>⭐</button>
                  ))}
                </div>
                <div className="text-sm text-text-muted mt-1">
                  {ratingVal === 1 ? t('clientDash.rating.veryUnsatisfied') : ratingVal === 2 ? t('clientDash.rating.unsatisfied') : ratingVal === 3 ? t('clientDash.rating.correct') : ratingVal === 4 ? t('clientDash.rating.satisfied') : t('clientDash.rating.verySatisfied')}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-mid block mb-1">{t('clientDash.rating.commentLabel')}</label>
                <textarea
                  value={ratingComment}
                  onChange={e => setRatingComment(e.target.value)}
                  rows={3}
                  placeholder={t('clientDash.rating.commentPlaceholder')}
                  className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107] resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRatingModal(null)} className="flex-1 border border-[#E0E0E0] text-text-muted py-3 rounded-xl text-sm font-medium hover:bg-warm-gray transition">{t('clientDash.rating.cancel')}</button>
                <button onClick={submitRating} disabled={ratingSubmitting} className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] disabled:opacity-60 text-dark py-3 rounded-xl text-sm font-bold transition">
                  {ratingSubmitting ? '...' : t('clientDash.rating.send')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal GPS Tracking ── */}
      {trackingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setTrackingModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-[#EFEFEF] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-display font-bold text-dark">{t('clientDash.tracking.title')}</h3>
                <p className="text-sm text-text-muted mt-0.5">{trackingModal.profiles_artisan?.company_name}</p>
              </div>
              <button onClick={() => setTrackingModal(null)} className="text-text-muted hover:text-text-muted text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {trackingData[trackingModal.id]?.active ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-bold text-blue-800">{t('clientDash.tracking.artisanOnWay')}</span>
                    </div>
                    <div className="text-sm text-blue-700">
                      {t('clientDash.tracking.position')} : {trackingData[trackingModal.id].lat.toFixed(4)}, {trackingData[trackingModal.id].lng.toFixed(4)}
                    </div>
                    {trackingData[trackingModal.id].eta > 0 && (
                      <div className="mt-2 bg-blue-100 rounded-lg px-3 py-2 text-sm font-bold text-blue-800">
                        {t('clientDash.tracking.estimatedArrival')} : ~{trackingData[trackingModal.id].eta} {t('clientDash.tracking.minutes')}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-text-muted text-center">{t('clientDash.tracking.positionUpdatedRealTime')}</div>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">🚗</div>
                  <div className="text-sm font-semibold text-mid mb-1">{t('clientDash.tracking.notOnWayYet')}</div>
                  <div className="text-xs text-text-muted">{t('clientDash.tracking.gpsActivatesWhen')}</div>
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                    {t('clientDash.tracking.appointmentOn')} {trackingModal.booking_date ? new Date(trackingModal.booking_date + 'T00:00:00').toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''} {t('clientDash.tracking.at')} {trackingModal.booking_time?.substring(0,5)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Messagerie ── */}
      {/* ── Fullscreen Image Viewer ── */}
      {fullscreenImg && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setFullscreenImg(null)}>
          <Image src={fullscreenImg} alt="Photo" width={800} height={600} className="max-w-full max-h-full object-contain rounded-lg" unoptimized />
          <button onClick={() => setFullscreenImg(null)} className="absolute top-4 right-4 text-white text-2xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center">✕</button>
        </div>
      )}

      {messageModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setMessageModal(null); setSigningDevis(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-3 border-b border-[#EFEFEF] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-display font-bold text-dark flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-600" /> {t('clientDash.messaging.title')}
                </h3>
                <p className="text-sm text-text-muted mt-0.5">{messageModal.profiles_artisan?.company_name || 'Artisan'} &bull; {messageModal.services?.name || 'Service'}</p>
              </div>
              <button onClick={() => { setMessageModal(null); setSigningDevis(null) }} className="text-text-muted hover:text-text-muted text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-sm text-text-muted">
                  {t('clientDash.messaging.noMessages')}
                </div>
              ) : (
                messages.map((msg: any) => {
                  const isMe = msg.sender_role === 'client'
                  const time = new Date(msg.created_at).toLocaleTimeString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })

                  // ── Photo message ──
                  if (msg.type === 'photo' && msg.attachment_url) {
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl p-1.5 ${isMe ? 'bg-[#FFC107]' : 'bg-warm-gray'}`}>
                          <img
                            src={msg.attachment_url}
                            alt="Photo"
                            className="rounded-xl max-w-[220px] max-h-[220px] object-cover cursor-pointer"
                            onClick={() => setFullscreenImg(msg.attachment_url)}
                          />
                          {msg.content && <p className="text-xs mt-1 px-2">{msg.content}</p>}
                          <p className={`text-[10px] px-2 mt-0.5 ${isMe ? 'text-mid' : 'text-text-muted'}`}>{time}</p>
                        </div>
                      </div>
                    )
                  }

                  // ── Voice message ──
                  if (msg.type === 'voice' && msg.attachment_url) {
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isMe ? 'bg-[#FFC107]' : 'bg-warm-gray'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">🎤</span>
                            <span className="text-xs font-medium">{t('clientDash.messaging.voiceMessage')}</span>
                          </div>
                          <audio controls src={msg.attachment_url} className="max-w-[200px] h-8" style={{ filter: 'sepia(20%) saturate(70%) grayscale(1) contrast(99%) invert(12%)' }} />
                          <p className={`text-[10px] mt-1 ${isMe ? 'text-mid' : 'text-text-muted'}`}>{time}</p>
                        </div>
                      </div>
                    )
                  }

                  // ── Devis sent (carte interactive côté client) ──
                  if (msg.type === 'devis_sent' && msg.metadata) {
                    const m = msg.metadata
                    const isSigned = m.signed === true
                    return (
                      <div key={msg.id} className="flex justify-start">
                        <div className={`max-w-[85%] rounded-2xl border-2 overflow-hidden ${isSigned ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
                          <div className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">{isSigned ? '✅' : '📄'}</span>
                              <span className="font-bold text-sm text-dark">{t('clientDash.devis.quoteNumber')}{m.docNumber}</span>
                            </div>
                            {m.docTitle && <p className="text-xs text-mid mb-1">{m.docTitle}</p>}
                            <p className="text-sm font-semibold text-dark">{t('clientDash.devis.amount')} : {m.totalStr}</p>
                            {m.prestationDate && <p className="text-xs text-text-muted mt-1">{t('clientDash.devis.serviceDate')} : {new Date(m.prestationDate).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</p>}
                            {m.companyName && <p className="text-xs text-text-muted mt-0.5">{t('clientDash.devis.from')} : {m.companyName}</p>}
                            {isSigned && <p className="text-xs text-green-700 mt-1 font-semibold">{t('clientDash.devis.signed')}{m.signer_name ? ` ${t('clientDash.devis.signedBy')} ${m.signer_name}` : ''}{m.signed_at ? ` ${t('clientDash.devis.onDate')} ${new Date(m.signed_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}` : ''}</p>}
                          </div>
                          {!isSigned && (
                            <div className="border-t border-amber-200 px-3 py-2 space-y-1.5">
                              <button
                                onClick={() => { setSigningDevis(msg.id); setSignName(user?.user_metadata?.full_name || ''); setSignConfirm(false) }}
                                className="w-full py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                              >
                                {t('clientDash.devis.signThisQuote')}
                              </button>
                              <button
                                onClick={() => {
                                  const artisanName = messageModal?.profiles_artisan?.company_name || 'Artisan'
                                  const serviceName = messageModal?.services?.name || ''
                                  setMessageModal(null)
                                  setActiveTab('analyse')
                                  setAnalyseFilename(`Devis ${artisanName}${serviceName ? ' - ' + serviceName : ''}`)
                                }}
                                className="w-full py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
                              >
                                {t('clientDash.devis.analyseWithAI')}
                              </button>
                            </div>
                          )}
                          <p className="text-[10px] text-text-muted px-4 pb-2">{time}</p>
                        </div>
                      </div>
                    )
                  }

                  // ── Devis signed ──
                  if (msg.type === 'devis_signed' && msg.metadata) {
                    const m = msg.metadata
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[85%] rounded-2xl border-2 border-green-300 bg-green-50 px-4 py-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">✅</span>
                            <span className="font-bold text-sm text-green-800">{t('clientDash.devis.quoteSigned')}</span>
                          </div>
                          <p className="text-xs text-green-700">N.º{m.docNumber} — {m.totalStr}</p>
                          {m.signer_name && <p className="text-xs text-green-600 mt-0.5">{t('clientDash.devis.signedBy')} {m.signer_name}</p>}
                          {m.signed_at && <p className="text-xs text-green-600">{t('clientDash.devis.onDate')} {new Date(m.signed_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} {t('clientDash.tracking.at')} {new Date(m.signed_at).toLocaleTimeString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>}
                          <p className="text-[10px] text-text-muted mt-1">{time}</p>
                        </div>
                      </div>
                    )
                  }

                  // ── Default text / auto_reply ──
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        isMe
                          ? 'bg-[#FFC107] text-dark'
                          : msg.type === 'auto_reply'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-warm-gray text-dark'
                      }`}>
                        {msg.type === 'auto_reply' && (
                          <div className="text-[10px] font-semibold opacity-70 mb-1">{t('clientDash.messaging.autoReply')}</div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? 'text-mid' : 'text-text-muted'}`}>{time}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* ── Modal signature devis ── */}
            {signingDevis && (
              <div className="px-4 py-3 border-t border-[#E0E0E0] bg-green-50 flex-shrink-0">
                <p className="text-xs font-bold text-green-800 mb-2">{t('clientDash.devis.signatureTitle')}</p>
                <input
                  type="text"
                  value={signName}
                  onChange={e => setSignName(e.target.value)}
                  placeholder={t('clientDash.devis.fullNamePlaceholder')}
                  className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-green-500"
                />
                <label className="flex items-start gap-2 text-xs text-mid mb-2 cursor-pointer">
                  <input type="checkbox" checked={signConfirm} onChange={e => setSignConfirm(e.target.checked)} className="mt-0.5 accent-green-600" />
                  <span>{t('clientDash.devis.signatureConsent')}</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => { setSigningDevis(null); setSignConfirm(false) }} className="flex-1 py-2 rounded-lg border border-[#E0E0E0] text-xs font-semibold text-text-muted hover:bg-warm-gray">
                    {t('clientDash.devis.cancel')}
                  </button>
                  <button
                    onClick={() => handleSignDevis(signingDevis)}
                    disabled={!signName.trim() || !signConfirm || sendingMessage}
                    className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-bold disabled:opacity-50 transition"
                  >
                    {sendingMessage ? t('clientDash.devis.signing') : t('clientDash.devis.sign')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Input bar with photo & voice ── */}
            <div className="px-4 pb-4 pt-2 border-t border-[#EFEFEF] flex-shrink-0 space-y-2">
              {msgUploading && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
                  <span className="animate-spin">⏳</span> {t('clientDash.messaging.uploadInProgress')}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                {/* Photo button */}
                <label className="cursor-pointer p-2 rounded-lg hover:bg-warm-gray transition text-text-muted hover:text-mid flex-shrink-0">
                  <span className="text-lg">📷</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) sendPhotoMessage(f)
                      e.target.value = ''
                    }}
                  />
                </label>
                {/* Voice button */}
                <button
                  onMouseDown={startVoiceRecording}
                  onMouseUp={stopVoiceRecording}
                  onMouseLeave={() => { if (isRecording) stopVoiceRecording() }}
                  onTouchStart={startVoiceRecording}
                  onTouchEnd={stopVoiceRecording}
                  className={`p-2 rounded-lg transition flex-shrink-0 ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-warm-gray text-text-muted hover:text-mid'}`}
                  title={t('clientDash.messaging.holdToRecord')}
                >
                  <span className="text-lg">{isRecording ? '⏹️' : '🎤'}</span>
                </button>
                {/* Text input */}
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={isRecording ? t('clientDash.messaging.recording') : t('clientDash.messaging.placeholder')}
                  disabled={isRecording}
                  className="flex-1 border border-[#E0E0E0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] disabled:bg-warm-gray"
                />
                {/* Send button */}
                <button
                  onClick={sendMessage}
                  disabled={sendingMessage || !newMessage.trim() || isRecording}
                  className="bg-[#FFC107] text-dark p-2.5 rounded-xl disabled:opacity-60 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal CIL Detail ── */}
      {showCilDetail && (() => {
        const entry = showCilDetail
        const catInfo = getCategoryInfo(entry.category)
        const now = new Date()
        const warrantyActive = entry.warranty ? new Date(entry.warranty.endDate) > now : false
        const warrantyDaysLeft = entry.warranty ? Math.ceil((new Date(entry.warranty.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0
        const maintenanceOverdue = entry.nextMaintenance ? new Date(entry.nextMaintenance) < now : false

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCilDetail(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-[#EFEFEF]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${catInfo.color}`}>
                      {catInfo.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-bold text-dark">{entry.serviceName}</h3>
                      <p className="text-sm text-text-muted">{catInfo.label} &bull; {new Date(entry.date).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowCilDetail(null)} className="text-text-muted hover:text-text-muted text-xl p-1">{'\u2715'}</button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Artisan info */}
                <div className="flex items-center gap-3 bg-warm-gray rounded-xl p-4">
                  <div className="w-10 h-10 bg-[#FFC107] rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {entry.artisanName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-dark">{entry.artisanName}</p>
                    <p className="text-sm text-text-muted">{t('clientDash.cilDetail.artisanIntervenant')}</p>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-warm-gray rounded-xl p-3">
                    <p className="text-xs text-text-muted uppercase tracking-wide mb-1">{t('clientDash.cilDetail.amountTTC')}</p>
                    <p className="font-bold text-dark">{formatPrice(entry.priceTTC, locale)}</p>
                  </div>
                  <div className="bg-warm-gray rounded-xl p-3">
                    <p className="text-xs text-text-muted uppercase tracking-wide mb-1">{t('clientDash.cilDetail.address')}</p>
                    <p className="font-semibold text-dark text-sm truncate">{entry.address || t('clientDash.cilDetail.notProvided')}</p>
                  </div>
                </div>

                {/* Description */}
                {entry.description && (
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wide mb-1.5">{t('clientDash.cilDetail.description')}</p>
                    <p className="text-sm text-mid bg-warm-gray rounded-xl p-3">{entry.description}</p>
                  </div>
                )}

                {/* Proof of Work attestation */}
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wide mb-2">{t('clientDash.cilDetail.workAttestation')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`flex items-center gap-2 p-3 rounded-xl border ${entry.hasProof ? 'bg-green-50 border-green-200' : 'bg-warm-gray border-[#E0E0E0]'}`}>
                      <FileText className={`w-4 h-4 ${entry.hasProof ? 'text-green-600' : 'text-text-muted'}`} />
                      <div>
                        <p className={`text-xs font-semibold ${entry.hasProof ? 'text-green-700' : 'text-text-muted'}`}>{t('clientDash.cilDetail.proofLabel')}</p>
                        <p className="text-[11px] text-text-muted">{entry.hasProof ? `${entry.proofPhotosCount} ${t('clientDash.logement.photos')}` : t('clientDash.cilDetail.absent')}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 p-3 rounded-xl border ${entry.hasSignature ? 'bg-blue-50 border-blue-200' : 'bg-warm-gray border-[#E0E0E0]'}`}>
                      <span className="text-sm">{'\u270D\uFE0F'}</span>
                      <div>
                        <p className={`text-xs font-semibold ${entry.hasSignature ? 'text-blue-700' : 'text-text-muted'}`}>{t('clientDash.cilDetail.signatureLabel')}</p>
                        <p className="text-[11px] text-text-muted">{entry.hasSignature ? t('clientDash.cilDetail.clientSigned') : t('clientDash.cilDetail.absent')}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 p-3 rounded-xl border ${entry.hasGPS ? 'bg-purple-50 border-purple-200' : 'bg-warm-gray border-[#E0E0E0]'}`}>
                      <MapPin className={`w-4 h-4 ${entry.hasGPS ? 'text-purple-600' : 'text-text-muted'}`} />
                      <div>
                        <p className={`text-xs font-semibold ${entry.hasGPS ? 'text-purple-700' : 'text-text-muted'}`}>{t('clientDash.cilDetail.geolocation')}</p>
                        <p className="text-[11px] text-text-muted">{entry.hasGPS ? t('clientDash.cilDetail.verified') : t('clientDash.cilDetail.absent')}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 p-3 rounded-xl border ${entry.hasProof && entry.hasSignature && entry.hasGPS ? 'bg-emerald-50 border-emerald-200' : 'bg-warm-gray border-[#E0E0E0]'}`}>
                      <Shield className={`w-4 h-4 ${entry.hasProof && entry.hasSignature && entry.hasGPS ? 'text-emerald-600' : 'text-text-muted'}`} />
                      <div>
                        <p className={`text-xs font-semibold ${entry.hasProof && entry.hasSignature && entry.hasGPS ? 'text-emerald-700' : 'text-text-muted'}`}>{t('clientDash.cilDetail.cilCompliant')}</p>
                        <p className="text-[11px] text-text-muted">{entry.hasProof && entry.hasSignature && entry.hasGPS ? t('clientDash.cilDetail.complete') : t('clientDash.cilDetail.incomplete')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Warranty */}
                {entry.warranty && (
                  <div className={`rounded-xl p-4 border ${warrantyActive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className={`w-5 h-5 ${warrantyActive ? 'text-emerald-600' : 'text-red-500'}`} />
                        <div>
                          <p className={`font-semibold text-sm ${warrantyActive ? 'text-emerald-700' : 'text-red-700'}`}>{entry.warranty.type}</p>
                          <p className={`text-xs ${warrantyActive ? 'text-emerald-600' : 'text-red-600'}`}>
                            {t('clientDash.cilDetail.untilDate')} {new Date(entry.warranty.endDate).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}
                          </p>
                        </div>
                      </div>
                      {warrantyActive ? (
                        <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                          {warrantyDaysLeft}{t('clientDash.cilDetail.daysRemaining')}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold bg-red-100 text-red-600 px-2.5 py-1 rounded-full">
                          {t('clientDash.cilDetail.expired')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Next maintenance */}
                {entry.nextMaintenance && (
                  <div className={`rounded-xl p-4 border ${maintenanceOverdue ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-5 h-5 ${maintenanceOverdue ? 'text-amber-600' : 'text-blue-600'}`} />
                      <div>
                        <p className={`font-semibold text-sm ${maintenanceOverdue ? 'text-amber-700' : 'text-blue-700'}`}>
                          {maintenanceOverdue ? t('clientDash.cilDetail.maintenanceOverdue') : t('clientDash.cilDetail.nextMaintenance')}
                        </p>
                        <p className={`text-xs ${maintenanceOverdue ? 'text-amber-600' : 'text-blue-600'}`}>
                          {new Date(entry.nextMaintenance).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    {maintenanceOverdue && (
                      <LocaleLink
                        href="/recherche"
                        className="mt-3 flex items-center justify-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        {t('clientDash.cilDetail.scheduleMaintenance')}
                      </LocaleLink>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Fixy Chat Assistant ── */}
      <FixyChatGeneric
        role="locataire"
        userName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''}
        getAuthToken={async () => (await supabase.auth.getSession()).data.session?.access_token || null}
      />
    </div>
  )
}
