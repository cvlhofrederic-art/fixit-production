'use client'

import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/api-client'

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
      // Calcul de l'état courant (BDD ou défaut Mon-Fri actif) → on envoie l'inverse
      const existing = availability.find(a => a.day_of_week === dayOfWeek)
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
      const currentlyActive = existing ? existing.is_available : isWeekday
      const desired = !currentlyActive

      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) {
        console.error('Toggle: no auth token')
        setSavingAvail(false)
        return
      }
      const res = await authFetch('/api/availability', token, {
        method: 'POST',
        body: JSON.stringify({ artisan_id: artisan.id, day_of_week: dayOfWeek, is_available: desired }),
      })
      const result = await res.json()
      if (result.error) {
        console.error('Toggle error:', result.error)
        setSavingAvail(false)
        return
      }
      // Bypass browser cache (API renvoie max-age=10) — sinon refetch sert l'état pré-toggle
      const res2 = await fetch(`/api/availability?artisan_id=${artisan.id}`, { cache: 'no-store' })
      const { data } = await res2.json()
      setAvailability(data || [])
    } catch (e) {
      console.error('Network error:', e)
    }
    setSavingAvail(false)
  }, [artisan, availability])

  const updateAvailabilityTime = useCallback(async (dayOfWeek: number, field: 'start_time' | 'end_time', value: string) => {
    if (!artisan) return
    const token = (await supabase.auth.getSession()).data.session?.access_token
    if (!token) {
      console.error('UpdateTime: no auth token')
      return
    }
    const existing = availability.find((a) => a.day_of_week === dayOfWeek)
    if (existing) {
      setAvailability(prev => prev.map(a => a.id === existing.id ? { ...a, [field]: value } : a))
      try {
        await authFetch('/api/availability', token, {
          method: 'PUT',
          body: JSON.stringify({ availability_id: existing.id, field, value }),
        })
      } catch (e) {
        console.error('Time update error:', e)
      }
    } else {
      // Pas de ligne en BDD : la créer via POST avec l'heure modifiée + is_available basé sur défaut
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
      const body = {
        artisan_id: artisan.id,
        day_of_week: dayOfWeek,
        is_available: isWeekday,
        start_time: field === 'start_time' ? value : '08:00',
        end_time: field === 'end_time' ? value : '17:00',
      }
      try {
        const res = await authFetch('/api/availability', token, {
          method: 'POST',
          body: JSON.stringify(body),
        })
        const result = await res.json()
        if (result.data) {
          setAvailability(prev => [...prev.filter(a => a.day_of_week !== dayOfWeek), result.data])
        }
      } catch (e) {
        console.error('Time create error:', e)
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
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (token) {
          const res = await authFetch('/api/availability-services', token, {
            method: 'POST',
            body: JSON.stringify({ artisan_id: artisan.id, dayServices: newDayServices }),
          })
          // Ne pas absorber silencieusement les erreurs HTTP : les remonter pour observabilité
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
            console.error('DayService save failed:', res.status, errorData)
            // Rollback du state local — la BDD ne reflète pas notre changement
            setDayServices(dayServices)
            localStorage.setItem(`fixit_availability_services_${artisan.id}`, JSON.stringify(dayServices))
            return
          }
          const result = await res.json()
          if (result.bio) setArtisan({ ...artisan, bio: result.bio })
        }
      } catch (e) {
        console.error('DayService save error:', e)
      }
    }
  }, [artisan, dayServices, setArtisan])

  // Force-save de l'état dayServices courant (utilisé par bouton "Sauvegarder")
  const saveAllDayServices = useCallback(async () => {
    if (!artisan) return false
    setSavingAvail(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) {
        console.error('SaveAll: no auth token')
        setSavingAvail(false)
        return false
      }
      const res = await authFetch('/api/availability-services', token, {
        method: 'POST',
        body: JSON.stringify({ artisan_id: artisan.id, dayServices }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        console.error('SaveAll error:', res.status, err)
        setSavingAvail(false)
        return false
      }
      const result = await res.json().catch(() => ({}))
      if (result.bio) setArtisan({ ...artisan, bio: result.bio })
    } catch (e) {
      console.error('SaveAll error:', e)
      setSavingAvail(false)
      return false
    }
    setSavingAvail(false)
    return true
  }, [artisan, dayServices, setArtisan])

  const loadCalendarData = useCallback(async (aid: string) => {
    if (calendarDataLoadedRef.current) return
    calendarDataLoadedRef.current = true
    const [availRes, absRes, dsRes] = await Promise.all([
      fetch(`/api/availability?artisan_id=${aid}`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/artisan-absences?artisan_id=${aid}`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/availability-services?artisan_id=${aid}`).then(r => r.json()).catch(() => ({ data: null })),
    ])
    let availData = availRes.data || []

    // Seed BDD si vide : aligne ce que l'UI affiche par défaut (Mon-Fri actifs 08:00-17:30)
    // avec ce que lit le parcours client. Sinon le toggle 1er clic inverse au lieu d'activer.
    if (availData.length === 0) {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (token) {
        await Promise.all([0, 1, 2, 3, 4, 5, 6].map(dow =>
          authFetch('/api/availability', token, {
            method: 'POST',
            body: JSON.stringify({
              artisan_id: aid,
              day_of_week: dow,
              is_available: dow >= 1 && dow <= 5,
              start_time: '08:00',
              end_time: '17:30',
            }),
          }).catch(() => null)
        ))
        const reFetch = await fetch(`/api/availability?artisan_id=${aid}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ data: [] }))
        availData = reFetch.data || []
      }
    }

    setAvailability(availData)
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
    updateAvailabilityTime, toggleDayService, saveAllDayServices,
    loadCalendarData, getCalendarHours,
  }
}
