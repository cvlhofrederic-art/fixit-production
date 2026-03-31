'use client'

import { useState, useCallback } from 'react'
import type { Absence } from '@/lib/types'

export function useAbsences(artisanId: string | undefined, isPt: boolean) {
  const [absences, setAbsences] = useState<any[]>([])
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [newAbsence, setNewAbsence] = useState({
    start_date: '', end_date: '',
    reason: isPt ? 'Férias' : 'Vacances',
    label: '',
  })

  const createAbsence = useCallback(async () => {
    if (!artisanId || !newAbsence.start_date || !newAbsence.end_date) return
    const newAbs = {
      id: crypto.randomUUID(),
      artisan_id: artisanId,
      ...newAbsence,
      created_at: new Date().toISOString(),
    }
    try {
      const res = await fetch('/api/artisan-absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artisan_id: artisanId, ...newAbsence }),
      })
      const json = await res.json()
      if (json.data) {
        setAbsences(prev => [...prev, json.data])
      } else {
        const updated = [...absences, newAbs]
        setAbsences(updated)
        localStorage.setItem(`fixit_absences_${artisanId}`, JSON.stringify(updated))
      }
    } catch {
      const updated = [...absences, newAbs]
      setAbsences(updated)
      localStorage.setItem(`fixit_absences_${artisanId}`, JSON.stringify(updated))
    }
    setShowAbsenceModal(false)
    setNewAbsence({ start_date: '', end_date: '', reason: isPt ? 'Férias' : 'Vacances', label: '' })
  }, [artisanId, newAbsence, absences, isPt])

  const deleteAbsence = useCallback(async (absenceId: string) => {
    const updated = absences.filter((a: Absence) => a.id !== absenceId)
    setAbsences(updated)
    if (artisanId) localStorage.setItem(`fixit_absences_${artisanId}`, JSON.stringify(updated))
    try {
      await fetch(`/api/artisan-absences?id=${absenceId}`, { method: 'DELETE' })
    } catch { /* ignore if API fails */ }
  }, [absences, artisanId])

  const isDateAbsent = useCallback((date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    const match = absences.find((a: Absence) => dateStr >= a.start_date && dateStr <= a.end_date)
    return match
      ? { absent: true, reason: match.reason || '', label: match.label || '', source: match.source || 'manual', id: match.id }
      : { absent: false, reason: '', label: '', source: '', id: '' }
  }, [absences])

  return {
    absences, setAbsences,
    showAbsenceModal, setShowAbsenceModal,
    newAbsence, setNewAbsence,
    createAbsence, deleteAbsence, isDateAbsent,
  }
}
