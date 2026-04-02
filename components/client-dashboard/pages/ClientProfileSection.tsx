'use client'

import React, { useState } from 'react'
import { User, Pencil, Save, X, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

interface ClientProfileSectionProps {
  user: any
  locale: string
  t: (key: string) => string
  userName: string
  userInitials: string
  setUser: (updater: any) => void
}

export default function ClientProfileSection(props: ClientProfileSectionProps) {
  const { user, locale, t, userName, userInitials, setUser } = props

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
  const [clientPhotoFile, setClientPhotoFile] = useState<File | null>(null)
  const [clientPhotoPreview, setClientPhotoPreview] = useState('')
  const [clientPhotoUploading, setClientPhotoUploading] = useState(false)

  const initProfileData = (userData: any) => {
    const meta = userData?.user_metadata || {} as Record<string, string>
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
      setUser((prev: any) => prev ? ({
        ...prev,
        user_metadata: { ...(prev.user_metadata || {}), profile_photo_url: data.url }
      }) : prev)
      setClientPhotoFile(null)
      setClientPhotoPreview('')
      setProfileSuccess(t('clientDash.errors.photoUpdated'))
      setTimeout(() => setProfileSuccess(''), 3000)
    } catch (err: unknown) {
      setProfileError(`${t('clientDash.errors.uploadError')}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setClientPhotoUploading(false)
    }
  }

  return (
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
  )
}
