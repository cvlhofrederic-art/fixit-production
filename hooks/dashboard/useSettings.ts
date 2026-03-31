'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface SettingsForm {
  company_name: string
  email: string
  phone: string
  bio: string
  auto_reply_message: string
  auto_block_duration_minutes: number
  zone_radius_km: number
}

const DEFAULT_SETTINGS: SettingsForm = {
  company_name: '', email: '', phone: '', bio: '',
  auto_reply_message: '', auto_block_duration_minutes: 240, zone_radius_km: 30,
}

export function useSettings(
  artisan: any,
  setArtisan: (a: any) => void,
  dayServices: Record<string, string[]>,
  isPt: boolean,
  t: (key: string) => string,
) {
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(DEFAULT_SETTINGS)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'profil' | 'modules' | 'parrainage'>('profil')
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('')
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const saveSettings = useCallback(async () => {
    if (!artisan) return
    setSavingSettings(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { alert(t('proDash.alerts.sessionExpired')); setSavingSettings(false); return }

      const res = await fetch('/api/artisan-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          company_name: settingsForm.company_name,
          bio: settingsForm.bio,
          phone: settingsForm.phone,
          email: settingsForm.email,
          auto_reply_message: settingsForm.auto_reply_message,
          auto_block_duration_minutes: settingsForm.auto_block_duration_minutes,
          zone_radius_km: settingsForm.zone_radius_km,
        }),
      })
      const json = await res.json()
      if (!res.ok) { alert(`\u274c ${t('proDash.alerts.error')}: ${json.error || t('proDash.alerts.cantSave')}`); setSavingSettings(false); return }

      setArtisan({
        ...artisan,
        company_name: settingsForm.company_name,
        bio: settingsForm.bio,
        phone: settingsForm.phone,
        email: settingsForm.email,
        auto_reply_message: settingsForm.auto_reply_message,
        auto_block_duration_minutes: settingsForm.auto_block_duration_minutes,
        zone_radius_km: settingsForm.zone_radius_km,
        ...(json.slug ? { slug: json.slug } : {}),
      })
      // Re-save dayServices marker after bio update
      if (Object.values(dayServices).some(arr => arr.length > 0)) {
        try {
          await fetch('/api/availability-services', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({ artisan_id: artisan.id, dayServices }),
          })
        } catch {}
      }
      if (json.partial && json.warning) {
        alert(`\u26a0\ufe0f ${t('proDash.alerts.partialSave')}: ${json.warning}`)
      } else {
        alert(t('proDash.alerts.profileUpdated'))
      }
    } catch {
      alert(t('proDash.alerts.networkError'))
    } finally {
      setSavingSettings(false)
    }
  }, [artisan, settingsForm, dayServices, setArtisan, t])

  const uploadDocument = useCallback(async (
    file: File,
    folder: 'profiles' | 'kbis' | 'insurance' | 'logos',
    field: 'profile_photo_url' | 'kbis_url' | 'insurance_url' | 'logo_url',
    setUploading: (v: boolean) => void,
  ) => {
    if (!artisan) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const bucketMap: Record<string, string> = { profiles: 'profile-photos', logos: 'profile-photos' }
      fd.append('bucket', bucketMap[folder] || 'artisan-documents')
      fd.append('folder', folder)
      fd.append('artisan_id', artisan.id)
      fd.append('field', field)
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur upload')
      setArtisan({ ...artisan, [field]: data.url })
      setUploadMsg({ type: 'success', text: isPt ? '\u2705 Documento atualizado com sucesso!' : '\u2705 Document mis \u00e0 jour avec succ\u00e8s !' })
    } catch (err: any) {
      setUploadMsg({ type: 'error', text: `\u274c ${err.message}` })
    } finally {
      setUploading(false)
    }
  }, [artisan, setArtisan, isPt])

  /** Initialize settings form from artisan data (called once on load) */
  const initSettingsForm = useCallback((artisanData: any, userEmail: string) => {
    const cleanBio = (artisanData.bio || '').replace(/\s*<!--DS:[\s\S]*?-->/, '').trim()
    setSettingsForm({
      company_name: artisanData.company_name || '',
      email: userEmail || '',
      phone: artisanData.phone || '06 51 46 66 98',
      bio: cleanBio,
      auto_reply_message: artisanData.auto_reply_message || '',
      auto_block_duration_minutes: artisanData.auto_block_duration_minutes || 240,
      zone_radius_km: artisanData.zone_radius_km || 30,
    })
  }, [])

  return {
    settingsForm, setSettingsForm,
    savingSettings, settingsTab, setSettingsTab,
    profilePhotoFile, setProfilePhotoFile,
    profilePhotoPreview, setProfilePhotoPreview,
    profilePhotoUploading, setProfilePhotoUploading,
    uploadMsg, setUploadMsg,
    saveSettings, uploadDocument, initSettingsForm,
  }
}
