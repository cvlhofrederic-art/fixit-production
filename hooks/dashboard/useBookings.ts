'use client'

import { useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { parseServiceRange } from '@/lib/service-utils'
import type { Booking, Service } from '@/lib/types'

export function useBookings(
  artisan: any,
  services: any[],
  isPt: boolean,
) {
  const [bookings, setBookings] = useState<any[]>([])
  const [showNewRdv, setShowNewRdv] = useState(false)
  const [newRdv, setNewRdv] = useState({ client_name: '', service_id: '', date: '', time: '', address: '', notes: '', phone: '', duration: '' })
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [showBookingDetail, setShowBookingDetail] = useState(false)
  const [convertingDevis, setConvertingDevis] = useState<any>(null)
  const [showDevisForm, setShowDevisForm] = useState(false)
  const [showFactureForm, setShowFactureForm] = useState(false)
  const [savedDocuments, setSavedDocuments] = useState<any[]>([])

  const completedBookings = useMemo(() => bookings.filter((b) => b.status === 'completed'), [bookings])
  const pendingBookings = useMemo(() => bookings.filter((b) => b.status === 'pending'), [bookings])
  const totalRevenue = useMemo(() => completedBookings.reduce((sum, b) => sum + (b.price_ttc || 0), 0), [completedBookings])

  const autoAddClientFromBooking = useCallback((booking: any) => {
    if (!artisan?.id || !booking) return
    const storageKey = `fixit_manual_clients_${artisan.id}`
    let existing: any[] = []
    try { existing = JSON.parse(localStorage.getItem(storageKey) || '[]') } catch {}

    const notes = booking.notes || ''
    const clientName = notes.match(/Client:\s*([^|.\n]+)/i)?.[1]?.trim() || booking.client_name || ''
    const clientPhone = notes.match(/T[ée]l(?:[ée]phone)?:\s*([^|.\n]+)/i)?.[1]?.trim() || ''
    const clientEmail = notes.match(/Email:\s*([^|.\n]+)/i)?.[1]?.trim() || ''
    const clientSiret = notes.match(/SIRET:\s*([^|.\n]+)/i)?.[1]?.trim() || ''
    const clientType = notes.match(/Type:\s*([^|.\n]+)/i)?.[1]?.trim() || ''

    if (!clientName) return

    const alreadyExists = existing.some((c: any) =>
      (c.name && c.name.toLowerCase() === clientName.toLowerCase()) ||
      (c.email && clientEmail && c.email.toLowerCase() === clientEmail.toLowerCase())
    )
    if (alreadyExists) {
      if (booking.address) {
        const updated = existing.map((c: any) => {
          if ((c.name && c.name.toLowerCase() === clientName.toLowerCase()) || (c.email && clientEmail && c.email.toLowerCase() === clientEmail.toLowerCase())) {
            const addrs = c.interventionAddresses || []
            const addrExists = addrs.some((a: any) => a.address === booking.address)
            if (!addrExists && booking.address) {
              return { ...c, interventionAddresses: [...addrs, { id: `addr_${Date.now()}`, label: booking.services?.name || 'Intervention', address: booking.address }] }
            }
          }
          return c
        })
        localStorage.setItem(storageKey, JSON.stringify(updated))
      }
      return
    }

    const newClient = {
      id: `auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: clientName,
      email: clientEmail || undefined,
      phone: clientPhone || undefined,
      type: clientType || (clientSiret ? 'professionnel' : 'particulier'),
      siret: clientSiret || undefined,
      mainAddress: booking.address || undefined,
      mainAddressLabel: clientSiret ? 'Siège social' : 'Domicile',
      interventionAddresses: booking.address ? [{ id: `addr_${Date.now()}`, label: booking.services?.name || 'Intervention', address: booking.address }] : [],
      notes: `Ajouté automatiquement depuis réservation du ${booking.booking_date || new Date().toISOString().split('T')[0]}`,
      source: 'auto' as const,
    }
    const updated = [newClient, ...existing]
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }, [artisan])

  const createRdvManual = useCallback(async () => {
    if (!artisan || !newRdv.date || !newRdv.time || !newRdv.service_id) return
    const service = services.find((s) => s.id === newRdv.service_id)
    const status = 'confirmed'
    const durationMap: Record<string, number> = {
      '30': 30, '45': 45, '60': 60, '90': 90, '120': 120, '180': 180, '240': 240, '480': 480,
    }
    const manualDuration = newRdv.duration ? durationMap[newRdv.duration] : null
    const durationMinutes = manualDuration || service?.duration_minutes || 60
    let notesStr = ''
    if (newRdv.client_name) notesStr += `Client: ${newRdv.client_name}`
    if (newRdv.phone) notesStr += ` | Tél: ${newRdv.phone}`
    if (newRdv.notes) notesStr += notesStr ? ` | ${newRdv.notes}` : newRdv.notes
    const { data, error } = await supabase.from('bookings').insert({
      artisan_id: artisan.id,
      service_id: newRdv.service_id,
      status,
      confirmed_at: new Date().toISOString(),
      booking_date: newRdv.date,
      booking_time: newRdv.time,
      duration_minutes: durationMinutes,
      address: newRdv.address || 'A definir',
      notes: notesStr,
      price_ht: service?.price_ht,
      price_ttc: service?.price_ttc,
    }).select('*, services(name)').single()
    if (!error && data) {
      setBookings(prev => [data, ...prev])
      setShowNewRdv(false)
      setNewRdv({ client_name: '', service_id: '', date: '', time: '', address: '', notes: '', phone: '', duration: '' })
    }
  }, [artisan, newRdv, services])

  const updateBookingStatus = useCallback(async (bookingId: string, newStatus: string) => {
    const updates: any = { status: newStatus }
    if (newStatus === 'confirmed') updates.confirmed_at = new Date().toISOString()
    if (newStatus === 'cancelled') updates.cancelled_at = new Date().toISOString()
    if (newStatus === 'completed') updates.completed_at = new Date().toISOString()
    await supabase.from('bookings').update(updates).eq('id', bookingId)
    setBookings(prev => {
      const updated = prev.map(b => b.id === bookingId ? { ...b, ...updates } : b)
      if (newStatus === 'confirmed') {
        const booking = updated.find(b => b.id === bookingId)
        if (booking) autoAddClientFromBooking(booking)
      }
      return updated
    })
    setShowBookingDetail(false)
    setSelectedBooking(null)
  }, [autoAddClientFromBooking])

  const handleEmptyCellClick = useCallback((date: Date, hour: string) => {
    const dateStr = date.toISOString().split('T')[0]
    setNewRdv({ client_name: '', service_id: '', date: dateStr, time: hour, address: '', notes: '', phone: '', duration: '' })
    setShowNewRdv(true)
  }, [])

  const handleBookingClick = useCallback((booking: Booking) => {
    setSelectedBooking(booking)
    setShowBookingDetail(true)
  }, [])

  const transformBookingToDevis = useCallback((booking: Booking) => {
    const serviceName = booking.services?.name || (isPt ? 'Serviço' : 'Prestation')
    const priceHT = booking.price_ht || 0
    const notesStr = booking.notes || ''
    const clientName = notesStr.match(/Client:\s*([^|.\n]+)/i)?.[1]?.trim() || ''
    const clientPhone = notesStr.match(/T[ée]l(?:[ée]phone)?:\s*([^|.\n]+)/i)?.[1]?.trim() || ''
    const clientEmail = notesStr.match(/Email:\s*([^|.\n]+)/i)?.[1]?.trim() || ''
    const cleanNotes = notesStr.replace(/Client:\s*[^|.\n]+/i, '').replace(/T[ée]l(?:[ée]phone)?:\s*[^|.\n]+/i, '').replace(/Email:\s*[^|.\n]+/i, '').replace(/\|/g, '').trim()

    const linkedService = services.find(s => s.id === booking.service_id)
    let lineUnit = 'u'
    if (linkedService) {
      const { unit: svcUnit } = parseServiceRange(linkedService)
      const unitMap: Record<string, string> = {
        'm2': 'm²', 'ml': 'ml', 'm3': 'm³', 'heure': 'h',
        'forfait': 'forfait', 'unite': 'u', 'arbre': 'u',
        'tonne': 'kg', 'kg': 'kg', 'lot': 'lot',
      }
      lineUnit = unitMap[svcUnit] || 'u'
    }

    const defaultTvaRate = isPt ? 23 : 10
    const lines = priceHT > 0
      ? [{ id: 1, description: serviceName, qty: 1, unit: lineUnit, priceHT, tvaRate: defaultTvaRate, totalHT: priceHT }]
      : [{ id: 1, description: serviceName, qty: 1, unit: lineUnit, priceHT: 0, tvaRate: defaultTvaRate, totalHT: 0 }]

    const devisData = {
      docType: 'devis' as const,
      docTitle: serviceName,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress: booking.address || '',
      interventionAddress: booking.address || '',
      prestationDate: booking.booking_date || '',
      lines,
      notes: [
        `Demande du ${booking.booking_date || ''}${booking.booking_time ? ' à ' + booking.booking_time.substring(0, 5) : ''}`,
        cleanNotes || '',
      ].filter(Boolean).join(' — '),
    }
    setConvertingDevis(devisData)
    setShowDevisForm(true)
    return devisData
  }, [services, isPt])

  const convertDevisToFacture = useCallback((devis: Record<string, unknown>) => {
    const {
      id: _id,
      docNumber: _dn,
      docType: _dt,
      status: _st,
      savedAt: _sa,
      sentAt: _se,
      signatureData: _sig,
      ...rest
    } = devis as Record<string, unknown>
    setConvertingDevis({ ...rest, docType: 'facture' })
    setShowFactureForm(true)
  }, [])

  return {
    bookings, setBookings,
    showNewRdv, setShowNewRdv,
    newRdv, setNewRdv,
    selectedBooking, setSelectedBooking,
    showBookingDetail, setShowBookingDetail,
    convertingDevis, setConvertingDevis,
    showDevisForm, setShowDevisForm,
    showFactureForm, setShowFactureForm,
    savedDocuments, setSavedDocuments,
    completedBookings, pendingBookings, totalRevenue,
    autoAddClientFromBooking,
    createRdvManual, updateBookingStatus,
    handleEmptyCellClick, handleBookingClick,
    transformBookingToDevis, convertDevisToFacture,
  }
}
