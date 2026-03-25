'use client'

import { useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { toast } from 'sonner'
import type { Booking, ChatMessage } from '@/lib/types'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface UseDashboardMessagingOptions {
  artisan: { id: string } | null
  isPt: boolean
  dateFmtLocale: string
}

export function useDashboardMessaging({ artisan, isPt, dateFmtLocale }: UseDashboardMessagingOptions) {
  const [dashMsgModal, setDashMsgModal] = useState<Booking | null>(null)
  const [dashMsgList, setDashMsgList] = useState<ChatMessage[]>([])
  const [dashMsgText, setDashMsgText] = useState('')
  const [dashMsgSending, setDashMsgSending] = useState(false)
  const [dashMsgUploading, setDashMsgUploading] = useState(false)
  const [dashMsgRecording, setDashMsgRecording] = useState(false)
  const [dashMsgRecorderRef, setDashMsgRecorderRef] = useState<MediaRecorder | null>(null)
  const [dashMsgBlockingAgenda, setDashMsgBlockingAgenda] = useState<string | null>(null)
  const [dashMsgFullscreenImg, setDashMsgFullscreenImg] = useState<string | null>(null)

  const getDashAuthToken = useCallback(async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) return session.access_token
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/pro/login'; return '' }
    const { data: { session: s2 } } = await supabase.auth.getSession()
    return s2?.access_token || ''
  }, [])

  const openDashMessages = useCallback(async (booking: Booking) => {
    setDashMsgModal(booking)
    setDashMsgList([])
    setDashMsgText('')
    try {
      const res = await fetch(`/api/booking-messages?booking_id=${booking.id}`, {
        headers: { 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` }
      })
      const json = await res.json()
      if (json.data) setDashMsgList(json.data)
    } catch (e) {
      console.error('Error fetching messages:', e)
      toast.error(isPt ? 'Erro ao carregar mensagens' : 'Erreur chargement des messages')
    }
  }, [isPt])

  const sendDashMessage = useCallback(async () => {
    if (!dashMsgModal || !dashMsgText.trim() || dashMsgSending) return
    setDashMsgSending(true)
    try {
      const res = await fetch('/api/booking-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ booking_id: dashMsgModal.id, content: dashMsgText.trim() }),
      })
      const json = await res.json()
      if (json.data) {
        setDashMsgList(prev => [...prev, json.data])
        setDashMsgText('')
      }
    } catch (e) {
      console.error('Error sending message:', e)
      toast.error(isPt ? 'Erro ao enviar mensagem' : 'Erreur envoi du message')
    }
    setDashMsgSending(false)
  }, [dashMsgModal, dashMsgText, dashMsgSending, isPt])

  const uploadDashAttachment = useCallback(async (file: File): Promise<string | null> => {
    setDashMsgUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'booking-attachments')
      formData.append('folder', 'messages')
      const token = await getDashAuthToken()
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })
      const json = await res.json()
      return json.url || null
    } catch (e) {
      console.error('Upload error:', e)
      return null
    } finally {
      setDashMsgUploading(false)
    }
  }, [getDashAuthToken])

  const sendDashPhotoMessage = useCallback(async (file: File) => {
    if (!dashMsgModal) return
    const url = await uploadDashAttachment(file)
    if (!url) { toast.error(isPt ? '❌ Erro ao enviar foto' : '❌ Erreur upload photo'); return }
    try {
      const token = await getDashAuthToken()
      const res = await fetch('/api/booking-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ booking_id: dashMsgModal.id, content: '', type: 'photo', attachment_url: url }),
      })
      const json = await res.json()
      if (json.data) setDashMsgList(prev => [...prev, json.data])
    } catch (e) {
      console.error('Error sending photo:', e)
      toast.error(isPt ? 'Erro ao enviar foto' : 'Erreur envoi photo')
    }
  }, [dashMsgModal, uploadDashAttachment, getDashAuthToken, isPt])

  const startDashVoiceRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: recorder.mimeType })
        if (blob.size < 1000) return
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: recorder.mimeType })
        if (!dashMsgModal) return
        const url = await uploadDashAttachment(file)
        if (!url) { toast.error(isPt ? '❌ Erro ao enviar áudio' : '❌ Erreur upload vocal'); return }
        try {
          const token = await getDashAuthToken()
          const res = await fetch('/api/booking-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ booking_id: dashMsgModal.id, content: '🎤 Message vocal', type: 'voice', attachment_url: url }),
          })
          const json = await res.json()
          if (json.data) setDashMsgList(prev => [...prev, json.data])
        } catch (e) { console.error('Error sending voice:', e) }
      }
      recorder.start()
      setDashMsgRecorderRef(recorder)
      setDashMsgRecording(true)
    } catch (e) {
      console.error('Microphone error:', e)
      toast.error(isPt ? 'Erro acesso ao microfone' : 'Erreur accès microphone')
    }
  }, [dashMsgModal, uploadDashAttachment, getDashAuthToken, isPt])

  const stopDashVoiceRecording = useCallback(() => {
    if (dashMsgRecorderRef && dashMsgRecorderRef.state !== 'inactive') {
      dashMsgRecorderRef.stop()
    }
    setDashMsgRecording(false)
    setDashMsgRecorderRef(null)
  }, [dashMsgRecorderRef])

  const handleBlockAgendaFromDevis = useCallback(async (msg: ChatMessage) => {
    if (!msg.metadata || !artisan) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m: any = msg.metadata
    setDashMsgBlockingAgenda(msg.id)
    try {
      const prDate = m.prestationDate
      if (!prDate) {
        toast.error(isPt ? '⚠️ Sem data de prestação indicada neste orçamento' : '⚠️ Pas de date de prestation renseignée sur ce devis')
        setDashMsgBlockingAgenda(null)
        return
      }
      let endDate = prDate
      const delayDays = m.executionDelayDays || 0
      if (delayDays > 0) {
        const start = new Date(prDate)
        if (m.executionDelayType === 'calendaires') {
          const end = new Date(start)
          end.setDate(end.getDate() + delayDays - 1)
          endDate = end.toISOString().split('T')[0]
        } else {
          let count = 0
          const current = new Date(start)
          while (count < delayDays - 1) {
            current.setDate(current.getDate() + 1)
            const dow = current.getDay()
            if (dow >= 1 && dow <= 5) count++
          }
          endDate = current.toISOString().split('T')[0]
        }
      }
      const label = `${m.signer_name || 'Client'}${m.docTitle ? ' - ' + m.docTitle : ''}`
      const token = await getDashAuthToken()
      const res = await fetch('/api/artisan-absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          artisan_id: artisan.id,
          start_date: prDate,
          end_date: endDate,
          reason: isPt ? 'Intervenção do orçamento' : 'Intervention devis',
          label,
          source: 'devis',
        }),
      })
      if (!res.ok) throw new Error('Erreur création absence')
      toast.success(isPt
        ? `✅ Agenda bloqueado de ${new Date(prDate).toLocaleDateString(dateFmtLocale)} a ${new Date(endDate).toLocaleDateString(dateFmtLocale)}`
        : `✅ Agenda bloqué du ${new Date(prDate).toLocaleDateString(dateFmtLocale)} au ${new Date(endDate).toLocaleDateString(dateFmtLocale)}`)
    } catch (err) {
      console.error('Erreur blocage agenda:', err)
      toast.error(isPt ? '❌ Erro ao bloquear a agenda' : '❌ Erreur lors du blocage de l\'agenda')
    } finally {
      setDashMsgBlockingAgenda(null)
    }
  }, [artisan, isPt, dateFmtLocale, getDashAuthToken])

  return {
    // State
    dashMsgModal, setDashMsgModal,
    dashMsgList, setDashMsgList,
    dashMsgText, setDashMsgText,
    dashMsgSending,
    dashMsgUploading,
    dashMsgRecording,
    dashMsgBlockingAgenda,
    dashMsgFullscreenImg, setDashMsgFullscreenImg,
    // Actions
    openDashMessages,
    sendDashMessage,
    sendDashPhotoMessage,
    startDashVoiceRecording,
    stopDashVoiceRecording,
    handleBlockAgendaFromDevis,
    uploadDashAttachment,
    getDashAuthToken,
  }
}
