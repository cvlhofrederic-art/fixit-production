'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import LocaleLink from '@/components/common/LocaleLink'
import Image from 'next/image'
import { Calendar, MapPin, LogOut, User, Search, Home, Shield, FileText, FileSearch, MessageSquare, Send, LayoutDashboard, Hammer, Calculator, CreditCard } from 'lucide-react'
import FixyChatGeneric from '@/components/chat/FixyChatGeneric'
import dynamic from 'next/dynamic'
import type { ChatMessage as SharedChatMessage } from '@/lib/types'
import { type CILEntry, generateCILEntries, getCILHealthScore, getCategoryInfo as getCategoryInfoBase, getPonctualiteScore as getPonctualiteScoreBase } from '@/lib/cil-utils'
import { useSignatureCanvas } from '@/hooks/useSignatureCanvas'
import type { User as SupabaseAuthUser } from '@supabase/supabase-js'

// Dynamic imports for extracted page sections
const d = (loader: () => Promise<any>) => dynamic(loader, { ssr: false }) as React.ComponentType<any> // eslint-disable-line @typescript-eslint/no-explicit-any
const ClientDashboardOverview = d(() => import('@/components/client-dashboard/pages/ClientDashboardOverview'))
const ClientMessagesSection = d(() => import('@/components/client-dashboard/pages/ClientMessagesSection'))
const ClientDocumentsSection = d(() => import('@/components/client-dashboard/pages/ClientDocumentsSection'))
const ClientLogementSection = d(() => import('@/components/client-dashboard/pages/ClientLogementSection'))
const ClientAnalyseSection = d(() => import('@/components/client-dashboard/pages/ClientAnalyseSection'))
const ClientSimulateurSection = d(() => import('@/components/client-dashboard/pages/ClientSimulateurSection'))
const ClientMarchesSection = d(() => import('@/components/client-dashboard/pages/ClientMarchesSection'))
const ClientPaiementsSection = d(() => import('@/components/client-dashboard/pages/ClientPaiementsSection'))
const ClientProfileSection = d(() => import('@/components/client-dashboard/pages/ClientProfileSection'))
const ClientBookingsSection = d(() => import('@/components/client-dashboard/pages/ClientBookingsSection'))

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

type SupabaseUser = SupabaseAuthUser

type BookingDocument = SharedChatMessage & {
  booking: Booking
  metadata?: Record<string, unknown>
  totalStr?: string
  prestationDate?: string
  signer_name?: string
  signed_at?: string
  docNumber?: string
  docTitle?: string
  companyName?: string
  signature_svg?: string
  signature_hash?: string
  lines?: Array<{ designation: string; quantite: number; prix_unitaire: number; total: number }>
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

// CILEntry type imported from lib/cil-utils.ts

export default function ClientDashboardPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upcoming' | 'past' | 'messages' | 'documents' | 'logement' | 'analyse' | 'simulateur' | 'marches' | 'paiements' | 'profile'>('dashboard')
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
  const [messages, setMessages] = useState<SharedChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  // ── Conversations list (Messages tab) ──
  const [conversations, setConversations] = useState<{ bookingId: string; lastMessage: string; lastDate: string; unread: number; hasDevis: boolean }[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(false)
  // ── Documents list (Documents tab) ──
  const [documents, setDocuments] = useState<BookingDocument[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  // ── Messagerie enrichie : photos, voice, devis ──
  const [msgUploading, setMsgUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorderRef, setMediaRecorderRef] = useState<MediaRecorder | null>(null)
  const [signingDevis, setSigningDevis] = useState<string | null>(null) // message_id en cours de signature
  const [signName, setSignName] = useState('')
  const [signConfirm, setSignConfirm] = useState(false)
  // ── Signature canvas (hook custom) ──
  const sigCanvasRef = useRef<HTMLCanvasElement>(null)
  const { sigStartDraw, sigDraw, sigEndDraw, sigClearCanvas, sigBuildSVG, sigPoints, hasSignature: hasSigPoints } = useSignatureCanvas(sigCanvasRef)
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null)

  // ── Carnet de Santé Logement ──
  const [cilEntries, setCilEntries] = useState<CILEntry[]>([])
  const [showCilDetail, setShowCilDetail] = useState<CILEntry | null>(null)

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
      toast.error('Erreur de chargement des réservations')
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
    } catch (e) {
      console.warn('[client/dashboard] localStorage parse failed:', e)
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
    } catch (e) { console.error(e); toast.error('Erreur lors de l\'annulation') }
    setCancellingId(null)
    setCancelConfirm(null)
  }

  // ── Soumettre une notation via API ──
  const submitRating = async () => {
    if (!ratingModal || !user) return
    setRatingSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          booking_id: ratingModal.id,
          rating: ratingVal,
          comment: ratingComment.trim() || '',
        }),
      })
      if (res.ok) {
        // Cache local pour éviter de re-afficher le bouton
        const newRatings = { ...ratings, [ratingModal.id]: { stars: ratingVal, comment: ratingComment } }
        setRatings(newRatings)
        try { localStorage.setItem(`fixit_client_ratings_${user.id}`, JSON.stringify(newRatings)) } catch (e) { console.warn('[client/dashboard] ratings localStorage write failed:', e) }
      }
    } catch (e) {
      console.warn('[client/dashboard] submitRating failed:', e)
      toast.error('Impossible d\'envoyer la notation. Veuillez réessayer.')
    }
    setRatingSubmitting(false)
    setRatingModal(null)
    setRatingComment('')
    setRatingVal(5)
  }

  // ── Télécharger devis en PDF ──
  const downloadDevisPdf = async (doc: BookingDocument) => {
    try {
      const { default: jsPDF } = await import('jspdf')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const w = 210
      let y = 20

      // Header
      pdf.setFontSize(20)
      pdf.setTextColor(26, 26, 26)
      pdf.text(doc.companyName || 'Artisan', 14, y)
      y += 10

      pdf.setFontSize(12)
      pdf.setTextColor(100)
      pdf.text(`Devis N.${doc.docNumber || '---'}`, 14, y)
      if (doc.prestationDate) pdf.text(`Date : ${doc.prestationDate}`, w - 14, y, { align: 'right' })
      y += 8

      if (doc.docTitle) {
        pdf.setFontSize(14)
        pdf.setTextColor(26, 26, 26)
        pdf.text(doc.docTitle, 14, y)
        y += 10
      }

      // Separator
      pdf.setDrawColor(200)
      pdf.line(14, y, w - 14, y)
      y += 8

      // Lines table
      const lines = doc.lines || []
      if (lines.length > 0) {
        pdf.setFontSize(10)
        pdf.setTextColor(100)
        pdf.text('Désignation', 14, y)
        pdf.text('Qté', 120, y)
        pdf.text('P.U.', 140, y)
        pdf.text('Total', w - 14, y, { align: 'right' })
        y += 2
        pdf.line(14, y, w - 14, y)
        y += 6

        pdf.setTextColor(26, 26, 26)
        for (const line of lines) {
          if (y > 270) { pdf.addPage(); y = 20 }
          pdf.text(String(line.designation || ''), 14, y, { maxWidth: 100 })
          pdf.text(String(line.quantite || 1), 120, y)
          pdf.text(`${(line.prix_unitaire || 0).toFixed(2)}€`, 140, y)
          pdf.text(`${(line.total || 0).toFixed(2)}€`, w - 14, y, { align: 'right' })
          y += 7
        }

        y += 4
        pdf.line(14, y, w - 14, y)
        y += 8
      }

      // Total
      pdf.setFontSize(14)
      pdf.setTextColor(26, 26, 26)
      pdf.text(`Total : ${doc.totalStr || '---'}`, w - 14, y, { align: 'right' })
      y += 12

      // Signature if signed
      if (doc.signer_name) {
        pdf.setFontSize(10)
        pdf.setTextColor(100)
        pdf.text(`Signé par : ${doc.signer_name}`, 14, y)
        if (doc.signed_at) pdf.text(`Le : ${new Date(doc.signed_at).toLocaleDateString('fr-FR')}`, 14, y + 5)
        if (doc.signature_hash) pdf.text(`Hash : ${doc.signature_hash.substring(0, 16)}...`, 14, y + 10)
      }

      // Footer
      pdf.setFontSize(8)
      pdf.setTextColor(150)
      pdf.text('Document généré par Vitfix.io', w / 2, 290, { align: 'center' })

      pdf.save(`devis-${doc.docNumber || 'vitfix'}.pdf`)
    } catch (e) {
      console.error('[downloadDevisPdf] Error:', e)
      toast.error('Erreur de génération du PDF')
    }
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
    } catch (e) {
      console.warn('[client/dashboard] loadTracking failed:', e)
    }
  }

  // ── Toggle favori artisan ──
  const toggleFavori = (artisanId: string) => {
    const next = favoris.includes(artisanId)
      ? favoris.filter(f => f !== artisanId)
      : [...favoris, artisanId]
    setFavoris(next)
    try { localStorage.setItem(`fixit_client_favoris_${user?.id}`, JSON.stringify(next)) } catch (e) { console.warn('[client/dashboard] favoris localStorage write failed:', e) }
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
    } catch (e) { console.error('Error fetching messages:', e); toast.error('Erreur de chargement des messages') }
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
    } catch (e) { console.error('Error sending message:', e); toast.error('Erreur d\'envoi du message') }
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
    } catch (e) { console.error('Upload error:', e); toast.error('Erreur d\'envoi du fichier'); return null }
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
    } catch (e) { console.error('Error sending photo:', e); toast.error('Erreur d\'envoi de la photo') }
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
        } catch (e) { console.error('Error sending voice:', e); toast.error('Erreur d\'envoi du message vocal') }
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

  // ── Signature Canvas — extracted to useSignatureCanvas hook ──

  const handleSignDevis = async (messageId: string) => {
    if (!messageModal || !signName.trim() || !hasSigPoints) return
    setSendingMessage(true)
    try {
      // Build SVG + SHA-256 hash
      const svg = sigBuildSVG()
      let hash = ''
      try {
        const payload = `${signName.trim()}|${new Date().toISOString()}|${messageId}|${svg.length}`
        const data = new TextEncoder().encode(payload)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
      } catch { hash = 'hash_error' }

      const token = await getAuthToken()
      const res = await fetch('/api/devis-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          booking_id: messageModal.id,
          message_id: messageId,
          signer_name: signName.trim(),
          signature_svg: svg,
          signature_hash: hash,
        }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        setMessages(prev => {
          const updated = prev.map(m => m.id === messageId ? { ...m, metadata: { ...m.metadata, signed: true, signed_at: json.data.metadata?.signed_at, signer_name: signName.trim(), signature_svg: svg } } : m)
          return [...updated, json.data]
        })
        setSigningDevis(null)
        setSignName('')
        setSignConfirm(false)
        sigClearCanvas()
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
              const unread = msgs.filter((m: Record<string, unknown>) => m.sender_role !== 'client' && !m.read_at).length
              const hasDevis = msgs.some((m: Record<string, unknown>) => m.type === 'devis_sent')
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
    } catch (e) { console.error('Error fetching conversations:', e); toast.error('Erreur de chargement des conversations') }
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
      const allDocs: BookingDocument[] = []
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
              .filter((m: Record<string, unknown>) => m.type === 'devis_sent' || m.type === 'devis_signed')
              .map((m: Record<string, unknown>) => ({ ...m, booking: b } as BookingDocument))
          })
        )
        for (const r of batchResults) {
          if (r.status === 'fulfilled' && r.value) allDocs.push(...r.value)
        }
      }
      allDocs.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      setDocuments(allDocs)
    } catch (e) { console.error('Error fetching documents:', e); toast.error('Erreur de chargement des documents') }
    setDocumentsLoading(false)
  }

  // ── Générer le Carnet de Santé (CIL) — logic extracted to lib/cil-utils.ts ──
  const generateCIL = (bks: Booking[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- local Booking type compatible with lib/types.Booking
    const entries = generateCILEntries(bks as any, {
      warrantyBiennial: t('clientDash.logement.warrantyBiennial'),
      warrantyAnnual: t('clientDash.logement.warrantyAnnual'),
    })
    setCilEntries(entries)
  }

  // ── Score de santé — extracted to lib/cil-utils.ts ──
  const cilHealthScore = getCILHealthScore(cilEntries)

  // ── Catégorie label + icône — extracted to lib/cil-utils.ts ──
  const categoryLabels: Record<CILEntry['category'], string> = {
    plomberie: t('clientDash.logement.categoryPlomberie'),
    electricite: t('clientDash.logement.categoryElectricite'),
    chauffage: t('clientDash.logement.categoryChauffage'),
    serrurerie: t('clientDash.logement.categorySerrurerie'),
    peinture: t('clientDash.logement.categoryPeinture'),
    menuiserie: t('clientDash.logement.categoryMenuiserie'),
    autre: t('clientDash.logement.categoryAutre'),
  }
  const getCategoryInfo = (cat: CILEntry['category']) => getCategoryInfoBase(cat, categoryLabels)

  // ── Exporter le CIL en texte formaté ──
  const exportCIL = () => {
    const intlLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
    const lines: string[] = [
      `=== ${t('clientDash.export.title')} ===`,
      `${t('clientDash.export.generatedOn')} ${new Date().toLocaleDateString(intlLocale)}`,
      `${t('clientDash.export.healthScore')} : ${cilHealthScore}%`,
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

  const today = new Date().toISOString().split('T')[0]
  const upcomingBookings = bookings.filter(b => b.booking_date >= today && b.status !== 'cancelled')
  const pastBookings = bookings.filter(b => b.booking_date < today || b.status === 'cancelled')

  // ── Score de ponctualité — extracted to lib/cil-utils.ts ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- local Booking type compatible with lib/types.Booking
  const getPonctualiteScore = (artisanId: string | undefined) => getPonctualiteScoreBase(bookings as any, artisanId)

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
    { key: 'paiements', icon: <CreditCard className="w-[18px] h-[18px]" />, label: locale === 'pt' ? 'Pagamentos' : 'Mes paiements' },
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
            <ClientDashboardOverview
              bookings={bookings}
              upcomingBookings={upcomingBookings}
              pastBookings={pastBookings}
              pendingCount={pendingCount}
              totalUnread={totalUnread}
              firstName={firstName}
              todayFormatted={todayFormatted}
              locale={locale}
              t={t}
              setActiveTab={setActiveTab}
              formatDateLocal={formatDateLocal}
              getStatusBadge={getStatusBadge}
              formatPrice={formatPrice}
            />
          )}

          {/* ── MESSAGES TAB ── */}
          {activeTab === 'messages' && (
            <ClientMessagesSection
              conversations={conversations}
              conversationsLoading={conversationsLoading}
              bookings={bookings}
              locale={locale}
              t={t}
              fetchConversations={fetchConversations}
              openMessages={openMessages}
              formatDateLocal={formatDateLocal}
            />
          )}

          {/* ── DOCUMENTS TAB ── */}
          {activeTab === 'documents' && (
            <ClientDocumentsSection
              documents={documents}
              documentsLoading={documentsLoading}
              bookings={bookings}
              locale={locale}
              t={t}
              fetchDocuments={fetchDocuments}
              openMessages={openMessages}
              downloadDevisPdf={downloadDevisPdf}
              setActiveTab={setActiveTab}
              formatDateLocal={formatDateLocal}
            />
          )}

          {/* ── LOGEMENT TAB ── */}
          {activeTab === 'logement' && (
            <ClientLogementSection
              cilEntries={cilEntries}
              cilHealthScore={cilHealthScore}
              locale={locale}
              t={t}
              exportCIL={exportCIL}
              getCategoryInfo={getCategoryInfo}
              formatPrice={formatPrice}
            />
          )}

          {/* ── ANALYSE DEVIS TAB ── */}
          {activeTab === 'analyse' && (
            <ClientAnalyseSection user={user} locale={locale} t={t} />
          )}

          {/* ── SIMULATEUR TAB ── */}
          {activeTab === 'simulateur' && (
            <ClientSimulateurSection userId={user?.id} locale={locale} setActiveTab={setActiveTab} />
          )}

          {/* ── BOURSE AUX MARCHÉS TAB ── */}
          {activeTab === 'marches' && (
            <ClientMarchesSection userId={user?.id} locale={locale} />
          )}

          {/* ── PAIEMENTS TAB ── */}
          {activeTab === 'paiements' && (
            <ClientPaiementsSection bookings={bookings} locale={locale} />
          )}

          {/* ── PROFILE TAB ── */}
          {activeTab === 'profile' && (
            <ClientProfileSection
              user={user}
              locale={locale}
              t={t}
              userName={userName}
              userInitials={userInitials}
              setUser={setUser}
            />
          )}

          {/* ── BOOKINGS TABS (upcoming / past) ── */}
          {(activeTab === 'upcoming' || activeTab === 'past') && (
            <ClientBookingsSection
              activeTab={activeTab as 'upcoming' | 'past'}
              upcomingBookings={upcomingBookings}
              pastBookings={pastBookings}
              ratings={ratings}
              favoris={favoris}
              unreadCounts={unreadCounts}
              locale={locale}
              t={t}
              setActiveTab={setActiveTab}
              openMessages={openMessages}
              toggleFavori={toggleFavori}
              loadTracking={loadTracking}
              setCancelConfirm={setCancelConfirm}
              setRatingModal={setRatingModal}
              getStatusBadge={getStatusBadge}
              formatPrice={formatPrice}
              formatDateLocal={formatDateLocal}
              getPonctualiteScore={getPonctualiteScore}
            />
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
                messages.map((msg) => {
                  const isMe = msg.sender_role === 'client'
                  const time = new Date(msg.created_at || '').toLocaleTimeString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })

                  // ── Photo message ──
                  if (msg.type === 'photo' && msg.attachment_url) {
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl p-1.5 ${isMe ? 'bg-[#FFC107]' : 'bg-warm-gray'}`}>
                          <img
                            src={msg.attachment_url}
                            alt="Photo"
                            className="rounded-xl max-w-[220px] max-h-[220px] object-cover cursor-pointer"
                            onClick={() => setFullscreenImg(msg.attachment_url ?? null)}
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
                    const m: any = msg.metadata // eslint-disable-line @typescript-eslint/no-explicit-any
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
                            {isSigned && m.signature_svg && (
                              <div className="mt-2 border border-green-200 rounded-lg p-2 bg-white" dangerouslySetInnerHTML={{ __html: m.signature_svg }} style={{ maxHeight: 60, overflow: 'hidden' }} />
                            )}
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
                                  setMessageModal(null)
                                  setActiveTab('analyse')
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
                    const m: any = msg.metadata // eslint-disable-line @typescript-eslint/no-explicit-any
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
                          {m.signature_svg && (
                            <div className="mt-2 border border-green-200 rounded-lg p-1.5 bg-white" dangerouslySetInnerHTML={{ __html: m.signature_svg }} style={{ maxHeight: 50, overflow: 'hidden' }} />
                          )}
                          {m.signature_hash && <p className="text-[8px] text-gray-400 mt-1 font-mono">SHA-256: {m.signature_hash.substring(0, 20)}...</p>}
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

            {/* ── Modal signature devis avec canvas ── */}
            {signingDevis && (
              <div className="px-4 py-3 border-t border-green-200 bg-green-50 flex-shrink-0">
                <p className="text-xs font-bold text-green-800 mb-2">{t('clientDash.devis.signatureTitle')}</p>
                <input
                  type="text"
                  value={signName}
                  onChange={e => setSignName(e.target.value)}
                  placeholder={t('clientDash.devis.fullNamePlaceholder')}
                  className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-green-500"
                />
                {/* Canvas signature */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-green-700">
                      {locale === 'pt' ? 'Assine aqui' : 'Signez ici'}
                    </span>
                    <button onClick={sigClearCanvas} className="text-[10px] text-red-500 hover:text-red-700">
                      {locale === 'pt' ? 'Limpar' : 'Effacer'}
                    </button>
                  </div>
                  <canvas
                    ref={sigCanvasRef}
                    width={400}
                    height={140}
                    style={{
                      width: '100%',
                      height: 100,
                      border: `2px ${hasSigPoints ? 'solid #22c55e' : 'dashed #d1d5db'}`,
                      borderRadius: 8,
                      cursor: 'crosshair',
                      touchAction: 'none',
                      background: hasSigPoints ? '#fff' : '#f9fafb',
                    }}
                    onMouseDown={sigStartDraw} onMouseMove={sigDraw} onMouseUp={sigEndDraw} onMouseLeave={sigEndDraw}
                    onTouchStart={sigStartDraw} onTouchMove={sigDraw} onTouchEnd={sigEndDraw}
                  />
                  {!hasSigPoints && (
                    <p className="text-[9px] text-gray-400 text-center mt-0.5">
                      {locale === 'pt' ? 'Desenhe a sua assinatura com o rato ou o dedo' : 'Dessinez votre signature avec la souris ou le doigt'}
                    </p>
                  )}
                </div>
                <label className="flex items-start gap-2 text-xs text-mid mb-2 cursor-pointer">
                  <input type="checkbox" checked={signConfirm} onChange={e => setSignConfirm(e.target.checked)} className="mt-0.5 accent-green-600" />
                  <span>{t('clientDash.devis.signatureConsent')}</span>
                </label>
                <div className="text-[9px] text-gray-400 mb-2">
                  SHA-256 · {locale === 'pt' ? 'Assinatura eletrónica simples — art. 25.1 eIDAS' : 'Signature électronique simple — art. 25.1 eIDAS'}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setSigningDevis(null); setSignConfirm(false); sigClearCanvas() }} className="flex-1 py-2 rounded-lg border border-[#E0E0E0] text-xs font-semibold text-text-muted hover:bg-warm-gray">
                    {t('clientDash.devis.cancel')}
                  </button>
                  <button
                    onClick={() => handleSignDevis(signingDevis)}
                    disabled={!signName.trim() || !signConfirm || !hasSigPoints || sendingMessage}
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
