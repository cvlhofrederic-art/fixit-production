'use client'

import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/api-client'

interface SettingsForm {
  company_name: string
  email: string
  phone: string
  bio: string
  auto_reply_message: string
  auto_block_duration_minutes: number
  zone_radius_km: number
  // BTP — champs légaux (issus du Kbis, saisie manuelle pour l'instant)
  rcs_number: string
  ape_code: string
  share_capital: string
  tva_intra: string
  // BTP — Assurance & Médiateur
  insurance_name: string
  insurance_number: string
  insurance_coverage: string
  insurance_type: string
  insurance_expiry: string
  mediator_name: string
  mediator_url: string
}

const DEFAULT_SETTINGS: SettingsForm = {
  company_name: '', email: '', phone: '', bio: '',
  auto_reply_message: '', auto_block_duration_minutes: 240, zone_radius_km: 30,
  rcs_number: '', ape_code: '', share_capital: '', tva_intra: '',
  insurance_name: '', insurance_number: '', insurance_coverage: '', insurance_type: '', insurance_expiry: '',
  mediator_name: '', mediator_url: '',
}

/** Champs dont la valeur diffère de la référence (fiche telle que chargée, puis dernier enregistrement). */
function champsModifies(champs: SettingsForm, reference: SettingsForm): Partial<SettingsForm> {
  return Object.fromEntries(
    (Object.keys(champs) as Array<keyof SettingsForm>)
      .filter((cle) => champs[cle] !== reference[cle])
      .map((cle) => [cle, champs[cle]]),
  ) as Partial<SettingsForm>
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
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('')
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // Société BTP (pro_societe), que sa fiche soit en français ou en portugais : valeurs de la fiche au chargement, puis
  // après chaque enregistrement. Seuls les champs changés depuis partent : un formulaire chargé une fois ne réécrit plus
  // ce qui a été enregistré entre-temps (assurance d'une attestation déposée dans Conformité), ni l'e-mail des devis par
  // celui de connexion.
  // null (artisan) : les 18 champs partent à chaque enregistrement, comme avant.
  const valeursEnregistrees = useRef<SettingsForm | null>(null)

  const saveSettings = useCallback(async () => {
    if (!artisan) return
    setSavingSettings(true)
    try {
      const champs: SettingsForm = {
        company_name: settingsForm.company_name,
        bio: settingsForm.bio,
        phone: settingsForm.phone,
        email: settingsForm.email,
        auto_reply_message: settingsForm.auto_reply_message,
        auto_block_duration_minutes: settingsForm.auto_block_duration_minutes,
        zone_radius_km: settingsForm.zone_radius_km,
        rcs_number: settingsForm.rcs_number,
        ape_code: settingsForm.ape_code,
        share_capital: settingsForm.share_capital,
        tva_intra: settingsForm.tva_intra,
        insurance_name: settingsForm.insurance_name,
        insurance_number: settingsForm.insurance_number,
        insurance_coverage: settingsForm.insurance_coverage,
        insurance_type: settingsForm.insurance_type,
        insurance_expiry: settingsForm.insurance_expiry,
        mediator_name: settingsForm.mediator_name,
        mediator_url: settingsForm.mediator_url,
      }
      const reference = valeursEnregistrees.current
      const aEnregistrer = reference ? champsModifies(champs, reference) : champs
      if (reference && Object.keys(aEnregistrer).length === 0) {
        // Société BTP, rien de changé : la fiche est déjà à jour
        toast.success(t('proDash.alerts.profileUpdated'))
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { alert(t('proDash.alerts.sessionExpired')); setSavingSettings(false); return }

      const res = await authFetch('/api/artisan-settings', token, {
        method: 'POST',
        body: JSON.stringify(aEnregistrer),
      })
      const json = await res.json()
      if (!res.ok) { alert(`\u274c ${t('proDash.alerts.error')}: ${json.error || t('proDash.alerts.cantSave')}`); setSavingSettings(false); return }

      if (reference) valeursEnregistrees.current = { ...reference, ...aEnregistrer }
      setArtisan({
        ...artisan,
        ...aEnregistrer,
        ...(json.slug ? { slug: json.slug } : {}),
      })
      // Re-save dayServices marker after bio update
      if (Object.values(dayServices).some(arr => arr.length > 0)) {
        try {
          const token2 = (await supabase.auth.getSession()).data.session?.access_token
          if (token2) {
            await authFetch('/api/availability-services', token2, {
              method: 'POST',
              body: JSON.stringify({ artisan_id: artisan.id, dayServices }),
            })
          }
        } catch {}
      }
      // Toast Sonner (UX pro) au lieu de window.alert() natif (look 90s, bloquant,
      // non automatable). Pattern SaaS pro 2026 (Stripe, Vercel, Linear).
      if (json.partial && json.warning) {
        toast.warning(`${t('proDash.alerts.partialSave')}: ${json.warning}`)
      } else {
        toast.success(t('proDash.alerts.profileUpdated'))
      }
    } catch {
      toast.error(t('proDash.alerts.networkError'))
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

  /** Initialize settings form from artisan data (called once on load). `orgRole` : rôle du compte connecté. */
  const initSettingsForm = useCallback((artisanData: any, userEmail: string, orgRole?: string) => {
    const cleanBio = (artisanData.bio || '').replace(/\s*<!--DS:[\s\S]*?-->/, '').trim()
    const formulaire: SettingsForm = {
      company_name: artisanData.company_name || '',
      // L'e-mail professionnel enregistré dans le profil d'abord : partir de l'adresse de connexion le remplaçait à
      // chaque enregistrement des réglages (devis, factures, fiche publique). L'adresse de connexion ne sert que de
      // valeur de départ pour un profil sans e-mail.
      email: artisanData.email || userEmail || '',
      // Jamais de numéro par défaut : un profil sans téléphone garde un champ vide. Un numéro de repli serait
      // écrit dans profiles_artisan au premier enregistrement des réglages, puis repris sur les devis, les
      // factures et la fiche publique.
      phone: artisanData.phone || '',
      bio: cleanBio,
      auto_reply_message: artisanData.auto_reply_message || '',
      auto_block_duration_minutes: artisanData.auto_block_duration_minutes || 240,
      zone_radius_km: artisanData.zone_radius_km || 30,
      rcs_number: artisanData.rcs_number || '',
      ape_code: artisanData.ape_code || '',
      share_capital: artisanData.share_capital || '',
      tva_intra: artisanData.tva_intra || '',
      insurance_name: artisanData.insurance_name || '',
      insurance_number: artisanData.insurance_number || '',
      insurance_coverage: artisanData.insurance_coverage || '',
      insurance_type: artisanData.insurance_type || '',
      insurance_expiry: artisanData.insurance_expiry || '',
      mediator_name: artisanData.mediator_name || '',
      mediator_url: artisanData.mediator_url || '',
    }
    if (orgRole === 'pro_societe') {
      // Société BTP, quelle que soit la langue de sa fiche : la référence garde l'e-mail de la fiche, celui des devis et
      // factures. Une fiche sans e-mail affiche celui de connexion, qui est alors enregistré au premier clic, comme avant
      // (la référence garde l'e-mail vide de la fiche).
      valeursEnregistrees.current = { ...formulaire, email: artisanData.email || '' }
    } else {
      valeursEnregistrees.current = null
    }
    setSettingsForm(formulaire)
  }, [])

  return {
    settingsForm, setSettingsForm,
    savingSettings,
    profilePhotoFile, setProfilePhotoFile,
    profilePhotoPreview, setProfilePhotoPreview,
    profilePhotoUploading, setProfilePhotoUploading,
    uploadMsg, setUploadMsg,
    saveSettings, uploadDocument, initSettingsForm,
  }
}
