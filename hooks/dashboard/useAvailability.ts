'use client'

import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export function useAvailability(
  artisan: any,
  setArtisan: (a: any) => void,
) {
  const [availability, setAvailability] = useState<any[]>([])
  const [dayServices, setDayServices] = useState<Record<string, string[]>>({})
  const [autoAccept, setAutoAccept] = useState(false)
  const [savingAvail, setSavingAvail] = useState(false)
  const calendarDataLoadedRef = useRef(false)

  const toggleAutoAccept = useCallback(async () => {
    const newVal = !autoAccept
    setAutoAccept(newVal)
    if (artisan) {
      await supabase.from('profiles_artisan').update({ auto_accept: newVal }).eq('id', artisan.id)
    }
  }, [autoAccept, artisan])

  const toggleDayAvailability = useCallback(async (dayOfWeek: number) => {
    if (!artisan) return
    setSavingAvail(true)
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artisan_id: artisan.id, day_of_week: dayOfWeek }),
      })
      const result = await res.json()
      if (result.error) {
        console.error('Toggle error:', result.error)
        setSavingAvail(false)
        return
      }
      const res2 = await fetch(`/api/availability?artisan_id=${artisan.id}`)
      const { data } = await res2.json()
      setAvailability(data || [])
    } catch (e) {
      console.error('Network error:', e)
    }
    setSavingAvail(false)
  }, [artisan])

  const updateAvailabilityTime = useCallback(async (dayOfWeek: number, field: 'start_time' | 'end_time', value: string) => {
    if (!artisan) return
    const existing = availability.find((a) => a.day_of_week === dayOfWeek)
    if (existing) {
      setAvailability(prev => prev.map(a => a.id === existing.id ? { ...a, [field]: value } : a))
      try {
        await fetch('/api/availability', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ availability_id: existing.id, field, value }),
        })
      } catch (e) {
        console.error('Time update error:', e)
      }
    }
  }, [artisan, availability])

  const toggleDayService = useCallback(async (dayOfWeek: number, serviceId: string) => {
    const key = String(dayOfWeek)
    const current = dayServices[key] || []
    const updated = current.includes(serviceId)
      ? current.filter(id => id !== serviceId)
      : [...current, serviceId]
    const newDayServices = { ...dayServices, [key]: updated }
    setDayServices(newDayServices)
    if (artisan) {
      localStorage.setItem(`fixit_availability_services_${artisan.id}`, JSON.stringify(newDayServices))
      try {
        const res = await fetch('/api/availability-services', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ artisan_id: artisan.id, dayServices: newDayServices }),
        })
        const result = await res.json()
        if (result.bio) setArtisan({ ...artisan, bio: result.bio })
      } catch (e) {
        console.error('DayService save error:', e)
      }
    }
  }, [artisan, dayServices, setArtisan])

  const loadCalendarData = useCallback(async (aid: string) => {
    if (calendarDataLoadedRef.current) return
    calendarDataLoadedRef.current = true
    const [availRes, absRes, dsRes] = await Promise.all([
      fetch(`/api/availability?artisan_id=${aid}`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/artisan-absences?artisan_id=${aid}`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/availability-services?artisan_id=${aid}`).then(r => r.json()).catch(() => ({ data: null })),
    ])
    setAvailability(availRes.data || [])
    const apiAbsences = absRes.data || []
    if (dsRes.data) setDayServices(dsRes.data)
    return apiAbsences // Return absences so caller can update absences hook
  }, [])

  const getCalendarHours = useCallback((): string[] => {
    const activeSlots = availability.filter((a) => a.is_available)
    if (activeSlots.length === 0) {
      return ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
    }
    let minHour = 23
    let maxHour = 0
    for (const slot of activeSlots) {
      const startH = parseInt((slot.start_time || '08:00').substring(0, 2))
      const endH = parseInt((slot.end_time || '17:00').substring(0, 2))
      const endM = parseInt((slot.end_time || '17:00').substring(3, 5))
      if (startH < minHour) minHour = startH
      const effectiveEnd = endM > 0 ? endH + 1 : endH
      if (effectiveEnd > maxHour) maxHour = effectiveEnd
    }
    minHour = Math.max(0, minHour - 1)
    maxHour = Math.min(23, maxHour + 1)
    const hours: string[] = []
    for (let h = minHour; h < maxHour; h++) {
      hours.push(`${String(h).padStart(2, '0')}:00`)
    }
    return hours.length > 0 ? hours : ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
  }, [availability])

  return {
    availability, setAvailability,
    dayServices, setDayServices,
    autoAccept, setAutoAccept,
    savingAvail,
    toggleAutoAccept, toggleDayAvailability,
    updateAvailabilityTime, toggleDayService,
    loadCalendarData, getCalendarHours,
  }
}
