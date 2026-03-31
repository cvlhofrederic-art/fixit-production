'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { parseServiceRange } from '@/lib/service-utils'
import type { Service } from '@/lib/types'

interface MotifForm {
  name: string
  description: string
  duration_minutes: number | ''
  price_min: number | ''
  price_max: number | ''
  pricing_unit: string
  validation_auto: boolean
  delai_minimum_heures: number
}

const EMPTY_MOTIF_FORM: MotifForm = {
  name: '', description: '', duration_minutes: '', price_min: '', price_max: '',
  pricing_unit: 'forfait', validation_auto: false, delai_minimum_heures: 0,
}

export function useServices(artisanId: string | undefined, t: (key: string) => string) {
  const [services, setServices] = useState<any[]>([])
  const [showMotifModal, setShowMotifModal] = useState(false)
  const [editingMotif, setEditingMotif] = useState<any>(null)
  const [motifForm, setMotifForm] = useState<MotifForm>(EMPTY_MOTIF_FORM)
  const [savingMotif, setSavingMotif] = useState(false)

  const openNewMotif = useCallback(() => {
    setEditingMotif(null)
    setMotifForm(EMPTY_MOTIF_FORM)
    setShowMotifModal(true)
  }, [])

  const openEditMotif = useCallback((service: Service) => {
    const { min, max, unit } = parseServiceRange(service)
    const cleanDesc = (service.description || '')
      .replace(/\s*\[unit:[^\]]+\]\s*/g, '')
      .replace(/\s*\[(m²|heure|unité|forfait|ml)\]\s*/g, '')
      .trim()
    setEditingMotif(service)
    setMotifForm({
      name: service.name || '',
      description: cleanDesc,
      duration_minutes: service.duration_minutes || '',
      price_min: min || '',
      price_max: max || '',
      pricing_unit: unit,
      validation_auto: service.validation_auto || false,
      delai_minimum_heures: service.delai_minimum_heures || 0,
    })
    setShowMotifModal(true)
  }, [])

  const saveMotif = useCallback(async () => {
    if (!artisanId || !motifForm.name) return
    setSavingMotif(true)

    const priceMin = motifForm.price_min === '' ? 0 : Number(motifForm.price_min)
    const priceMax = motifForm.price_max === '' ? 0 : Number(motifForm.price_max)
    const durationMins = motifForm.duration_minutes === '' ? null : Number(motifForm.duration_minutes)
    const rangeTag = `[unit:${motifForm.pricing_unit}|min:${priceMin}|max:${priceMax}]`
    const description = `${motifForm.description || ''} ${rangeTag}`.trim()

    const payload = {
      artisan_id: artisanId,
      name: motifForm.name,
      description,
      duration_minutes: durationMins,
      price_ht: priceMin,
      price_ttc: priceMax,
      active: true,
      validation_auto: motifForm.validation_auto,
      delai_minimum_heures: motifForm.delai_minimum_heures,
    }

    if (editingMotif) {
      const { data } = await supabase.from('services').update(payload).eq('id', editingMotif.id).select().single()
      if (data) setServices(prev => prev.map(s => s.id === editingMotif.id ? data : s))
    } else {
      const { data } = await supabase.from('services').insert(payload).select().single()
      if (data) setServices(prev => [...prev, data])
    }

    setShowMotifModal(false)
    setSavingMotif(false)
  }, [artisanId, motifForm, editingMotif])

  const toggleMotifActive = useCallback(async (serviceId: string, currentActive: boolean) => {
    await supabase.from('services').update({ active: !currentActive }).eq('id', serviceId)
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, active: !currentActive } : s))
  }, [])

  const deleteMotif = useCallback(async (serviceId: string) => {
    if (!confirm(t('proDash.alerts.confirmDeleteMotif'))) return
    await supabase.from('services').delete().eq('id', serviceId)
    setServices(prev => prev.filter(s => s.id !== serviceId))
  }, [t])

  return {
    services, setServices,
    showMotifModal, setShowMotifModal,
    editingMotif, motifForm, setMotifForm,
    savingMotif,
    openNewMotif, openEditMotif, saveMotif,
    toggleMotifActive, deleteMotif,
  }
}
