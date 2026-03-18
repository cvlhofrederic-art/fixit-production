'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslation } from '@/lib/i18n/context'
import { supabase } from '@/lib/supabase'

interface SettingsSectionProps {
  artisan: Record<string, unknown> & { id: string; company_name?: string; phone?: string; email?: string; bio?: string; profile_photo_url?: string }
  initials: string
  settingsTab: 'profil' | 'modules'
  setSettingsTab: (v: 'profil' | 'modules') => void
  settingsForm: {
    company_name: string; email: string; phone: string; bio: string;
    auto_block_duration_minutes: number; auto_reply_message: string; zone_radius_km: number
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSettingsForm: any
  savingSettings: boolean
  saveSettings: () => void
  autoAccept: boolean
  toggleAutoAccept: () => void
  profilePhotoPreview: string
  setProfilePhotoPreview: (v: string) => void
  profilePhotoFile: File | null
  setProfilePhotoFile: (v: File | null) => void
  profilePhotoUploading: boolean
  uploadDocument: (file: File, folder: 'profiles' | 'kbis' | 'insurance', field: 'profile_photo_url' | 'kbis_url' | 'insurance_url', setUploading: (v: boolean) => void) => Promise<void>
  setProfilePhotoUploading: (v: boolean) => void
  uploadMsg: { text: string; type: 'success' | 'error' } | null
  setUploadMsg: (v: { text: string; type: 'success' | 'error' } | null) => void
  // Modules
  ALL_MODULES: { id: string; label: string; icon: string; description: string; category: string; locked?: boolean }[]
  modulesConfig: { id: string; enabled: boolean; order: number }[]
  saveModulesConfig: (config: { id: string; enabled: boolean; order: number }[]) => void
  moveModule: (moduleId: string, direction: 'up' | 'down') => void
}

function PasswordChangeCard() {
  const { t } = useTranslation()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const handleChangePassword = async () => {
    setMsg(null)
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setMsg({ text: t('proDash.settings.pwdTooShort'), type: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMsg({ text: t('proDash.settings.pwdMismatch'), type: 'error' })
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setMsg({ text: error.message, type: 'error' })
      } else {
        setMsg({ text: t('proDash.settings.pwdSuccess'), type: 'success' })
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      setMsg({ text: t('proDash.settings.pwdError'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white p-8 lg:p-10 rounded-2xl shadow-sm max-w-2xl mt-6">
      <h3 className="text-xl font-bold mb-6">{'🔒'} {t('proDash.settings.securityTitle')}</h3>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto text-gray-500 hover:text-gray-600">{'✕'}</button>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="block mb-2 font-semibold text-sm">{t('proDash.settings.newPassword')}</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            className="w-full p-3 border-2 border-gray-200 rounded-lg text-base focus:border-[#FFC107] focus:outline-none"
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold text-sm">{t('proDash.settings.confirmPassword')}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            className="w-full p-3 border-2 border-gray-200 rounded-lg text-base focus:border-[#FFC107] focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">{t('proDash.settings.pwdMinLength')}</p>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleChangePassword}
            disabled={saving || !newPassword || !confirmPassword}
            className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {saving ? `⏳ ${t('proDash.settings.pwdSaving')}` : `🔒 ${t('proDash.settings.pwdUpdate')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsSection({
  artisan, initials, settingsTab, setSettingsTab, settingsForm, setSettingsForm,
  savingSettings, saveSettings, autoAccept, toggleAutoAccept,
  profilePhotoPreview, setProfilePhotoPreview, profilePhotoFile, setProfilePhotoFile,
  profilePhotoUploading, uploadDocument, setProfilePhotoUploading,
  uploadMsg, setUploadMsg,
  ALL_MODULES, modulesConfig, saveModulesConfig, moveModule,
}: SettingsSectionProps) {
  const { t } = useTranslation()

  const isModuleEnabled = (moduleId: string): boolean => {
    if (modulesConfig.length === 0) return true
    const m = modulesConfig.find(x => x.id === moduleId)
    return m ? m.enabled : true
  }

  const toggleModule = (moduleId: string) => {
    const updated = modulesConfig.map(c => c.id === moduleId ? { ...c, enabled: !c.enabled } : c)
    saveModulesConfig(updated)
  }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex items-center">
        <div>
          <h1 className="text-xl font-semibold leading-tight">{settingsTab === 'modules' ? `🧩 ${t('proDash.settings.modulesTitle')}` : `⚙️ ${t('proDash.settings.title')}`}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{settingsTab === 'modules' ? t('proDash.settings.modulesSubtitle') : t('proDash.settings.subtitle')}</p>
        </div>
      </div>

      {/* Profil & Parametres */}
      {settingsTab === 'profil' && (
      <div className="p-6 lg:p-8">
        <div className="bg-white p-8 lg:p-10 rounded-2xl shadow-sm max-w-2xl">
          <h3 className="text-xl font-bold mb-6">{t('proDash.settings.profilProfessionnel')}</h3>

          {/* Message upload */}
          {uploadMsg && (
            <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
              uploadMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {uploadMsg.text}
              <button onClick={() => setUploadMsg(null)} className="ml-auto text-gray-500 hover:text-gray-600">{'✕'}</button>
            </div>
          )}

          <div className="space-y-5">
            {/* Photo de profil */}
            <div>
              <label className="block mb-2 font-semibold text-sm">{t('proDash.settings.photoProfil')}</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0 bg-gray-100 flex items-center justify-center relative">
                  {profilePhotoPreview ? (
                    <Image src={profilePhotoPreview} alt={t('proDash.settings.photoProfil')} fill className="object-cover" unoptimized />
                  ) : (artisan as any)?.profile_photo_url ? (
                    <Image src={(artisan as any).profile_photo_url} alt={t('proDash.settings.photoProfil')} fill className="object-cover" sizes="80px" />
                  ) : (
                    <span className="text-3xl font-bold text-gray-500">{initials}</span>
                  )}
                </div>
                <div className="flex-1">
                  <label className="cursor-pointer inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition">
                    {'📷'} {t('proDash.settings.choisirPhoto')}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      setProfilePhotoFile(f)
                      const reader = new FileReader()
                      reader.onload = (ev) => setProfilePhotoPreview(ev.target?.result as string)
                      reader.readAsDataURL(f)
                    }} />
                  </label>
                  {profilePhotoFile && (
                    <button
                      onClick={() => {
                        uploadDocument(profilePhotoFile, 'profiles', 'profile_photo_url', setProfilePhotoUploading)
                        setProfilePhotoFile(null)
                        setProfilePhotoPreview('')
                      }}
                      disabled={profilePhotoUploading}
                      className="ml-2 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                    >
                      {profilePhotoUploading ? `⏳ ${t('proDash.settings.uploading')}` : `⬆️ ${t('proDash.settings.upload')}`}
                    </button>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{t('proDash.settings.photoFormat')}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block mb-2 font-semibold text-sm">{t('proDash.settings.nomCompletEntreprise')}</label>
              <input type="text" value={settingsForm.company_name} onChange={(e) => setSettingsForm({...settingsForm, company_name: e.target.value})}
                className="w-full p-3 border-2 border-gray-200 rounded-lg text-base focus:border-[#FFC107] focus:outline-none" />
            </div>
            <div>
              <label className="block mb-2 font-semibold text-sm">{t('proDash.settings.emailProfessionnel')}</label>
              <input type="email" value={settingsForm.email} onChange={(e) => setSettingsForm({...settingsForm, email: e.target.value})}
                className="w-full p-3 border-2 border-gray-200 rounded-lg text-base focus:border-[#FFC107] focus:outline-none" />
            </div>
            <div>
              <label className="block mb-2 font-semibold text-sm">{t('proDash.settings.telephoneLabel')}</label>
              <input type="tel" value={settingsForm.phone} onChange={(e) => setSettingsForm({...settingsForm, phone: e.target.value})}
                className="w-full p-3 border-2 border-gray-200 rounded-lg text-base focus:border-[#FFC107] focus:outline-none" />
            </div>
            <div>
              <label className="block mb-2 font-semibold text-sm">{t('proDash.settings.descriptionBio')}</label>
              <textarea value={settingsForm.bio} onChange={(e) => setSettingsForm({...settingsForm, bio: e.target.value})}
                rows={3} placeholder={t('proDash.settings.descriptionPlaceholder')}
                className="w-full p-3 border-2 border-gray-200 rounded-lg text-base focus:border-[#FFC107] focus:outline-none resize-none" />
            </div>
            <div>
              <label className="block mb-2 font-semibold text-sm">{t('proDash.settings.lienReservation')}</label>
              <div className="flex items-center gap-2">
                <input type="text" readOnly value={`${process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'}/artisan/${artisan?.slug || artisan?.id || ''}`}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600" />
                <button onClick={() => { navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'}/artisan/${artisan?.slug || artisan?.id || ''}`); alert(t('proDash.settings.lienCopie')) }}
                  className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-3 rounded-lg font-semibold text-sm transition whitespace-nowrap">
                  {'📋'} {t('proDash.settings.copier')}
                </button>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={saveSettings} disabled={savingSettings}
                className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                {savingSettings ? `⏳ ${t('proDash.settings.sauvegarde')}` : `💾 ${t('proDash.settings.enregistrer')}`}
              </button>
            </div>
          </div>
        </div>

        {/* Agenda settings */}
        <div className="bg-white p-8 lg:p-10 rounded-2xl shadow-sm max-w-2xl mt-6">
          <h3 className="text-xl font-bold mb-6">{'📅'} {t('proDash.settings.parametresAgenda')}</h3>
          <div className="space-y-5">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <div className="font-semibold">{t('proDash.settings.validationAutoRdv')}</div>
                <p className="text-sm text-gray-500">
                  {autoAccept ? t('proDash.settings.autoAcceptOn') : t('proDash.settings.autoAcceptOff')}
                </p>
              </div>
              <button onClick={toggleAutoAccept} className={`w-14 h-7 rounded-full relative transition-colors ${autoAccept ? 'bg-green-400' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${autoAccept ? 'translate-x-7' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {autoAccept && (
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="font-semibold mb-2">{'⚙️'} {t('proDash.settings.optionsAutoAccept')}</div>
                <label className="text-sm text-gray-600 block mb-1">{t('proDash.settings.dureeBlocage')}</label>
                <select
                  value={settingsForm.auto_block_duration_minutes}
                  onChange={e => setSettingsForm({...settingsForm, auto_block_duration_minutes: parseInt(e.target.value)})}
                  className="w-full border border-green-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-green-400"
                >
                  <option value={60}>{t('proDash.settings.heures1')}</option>
                  <option value={120}>{t('proDash.settings.heures2')}</option>
                  <option value={180}>{t('proDash.settings.heures3')}</option>
                  <option value={240}>{t('proDash.settings.heures4')}</option>
                  <option value={360}>{t('proDash.settings.heures6')}</option>
                  <option value={480}>{t('proDash.settings.heures8')}</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">{t('proDash.settings.blocageInfo')}</p>
              </div>
            )}

            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="font-semibold mb-2">{'💬'} {t('proDash.settings.reponseAuto')}</div>
              <p className="text-sm text-gray-500 mb-2">{t('proDash.settings.reponseAutoDesc')}</p>
              <textarea
                value={settingsForm.auto_reply_message}
                onChange={e => setSettingsForm({...settingsForm, auto_reply_message: e.target.value})}
                rows={3}
                placeholder={t('proDash.settings.reponseAutoPlaceholder')}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] resize-none"
              />
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="font-semibold mb-2">{'📍'} {t('proDash.settings.perimetreIntervention')}</div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={settingsForm.zone_radius_km}
                  onChange={e => setSettingsForm({...settingsForm, zone_radius_km: parseInt(e.target.value)})}
                  className="flex-1 accent-[#FFC107]"
                />
                <span className="text-lg font-bold text-gray-900 min-w-[60px] text-right">{settingsForm.zone_radius_km} km</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('proDash.settings.rayonAutour')}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={saveSettings} disabled={savingSettings}
                className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                {savingSettings ? `⏳ ${t('proDash.settings.sauvegarde')}` : `💾 ${t('proDash.settings.enregistrerParametres')}`}
              </button>
            </div>
          </div>
        </div>

        {/* Password change */}
        <PasswordChangeCard />
      </div>
      )}

      {/* Modules */}
      {settingsTab === 'modules' && (
        <div className="p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">🧩 {t('proDash.settings.mesModules')}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('proDash.settings.modulesDesc')}</p>
              </div>
              <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-bold">
                {ALL_MODULES.filter(m => !m.locked && isModuleEnabled(m.id)).length}/{ALL_MODULES.filter(m => !m.locked).length} {t('proDash.settings.actifs')}
              </div>
            </div>

            {/* Module Cards Grid */}
            <div className="space-y-6">
              {[
                { title: `📅 ${t('proDash.settings.activite')}`, keys: ['calendar', 'motifs', 'horaires'] },
                { title: `💬 ${t('proDash.settings.communicationGroup')}`, keys: ['messages', 'clients'] },
                { title: `📄 ${t('proDash.settings.facturationDocs')}`, keys: ['devis', 'factures', 'rapports', 'contrats'] },
                { title: `📊 ${t('proDash.settings.analyseFinances')}`, keys: ['stats', 'revenus', 'comptabilite', 'materiaux'] },
                { title: `🗂️ ${t('proDash.settings.profilProGroup')}`, keys: ['wallet', 'portfolio'] },
              ].map(group => {
                const groupMods = ALL_MODULES.filter(m => group.keys.includes(m.id))
                if (groupMods.length === 0) return null
                return (
                  <div key={group.title}>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">{group.title}</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {groupMods.map(mod => {
                        const enabled = isModuleEnabled(mod.id)
                        return (
                          <div key={mod.id} className={`bg-white rounded-2xl p-4 border-2 transition-all ${enabled ? 'border-amber-300 shadow-sm' : 'border-gray-200 opacity-70'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${enabled ? 'bg-amber-100' : 'bg-gray-100'}`}>
                                {mod.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-gray-900">{mod.label}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{mod.description}</div>
                              </div>
                              <button
                                onClick={() => toggleModule(mod.id)}
                                className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${enabled ? 'bg-[#FFC107]' : 'bg-gray-200'}`}
                              >
                                <div className="w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all" style={{ left: enabled ? '24px' : '4px' }} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Ordre du menu */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">↕️ {t('proDash.settings.ordreMenu')}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{t('proDash.settings.ordreMenuDesc')}</p>
                </div>
                <button
                  onClick={() => saveModulesConfig(ALL_MODULES.map((m, i) => ({ id: m.id, enabled: true, order: i })))}
                  className="text-xs text-gray-500 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
                >
                  ↺ {t('proDash.settings.reinitialiser')}
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {(() => {
                  const enabledMods = modulesConfig
                    .filter(c => c.enabled)
                    .sort((a, b) => a.order - b.order)
                  return enabledMods.map((conf, idx) => {
                    const mod = ALL_MODULES.find(m => m.id === conf.id)
                    if (!mod) return null
                    return (
                      <div key={mod.id} className="flex items-center gap-3 bg-white border-2 rounded-xl px-4 py-3 transition-all group border-amber-200 hover:border-amber-400">
                        <span className="text-gray-300 group-hover:text-gray-500 select-none text-lg leading-none font-mono">⠿</span>
                        <span className="text-xl w-6 text-center">{mod.icon}</span>
                        <span className="flex-1 font-semibold text-sm text-gray-800">{mod.label}</span>
                        <span className="text-xs text-gray-500 font-mono w-5 text-center">{idx + 1}</span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveModule(mod.id, 'up')}
                            disabled={idx === 0}
                            className="w-6 h-5 flex items-center justify-center rounded text-gray-500 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-20 disabled:cursor-not-allowed transition text-xs font-bold"
                          >▲</button>
                          <button
                            onClick={() => moveModule(mod.id, 'down')}
                            disabled={idx === enabledMods.length - 1}
                            className="w-6 h-5 flex items-center justify-center rounded text-gray-500 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-20 disabled:cursor-not-allowed transition text-xs font-bold"
                          >▼</button>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>

            {/* Tip box */}
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">💡</span>
                <div>
                  <div className="font-semibold text-amber-800 text-sm">{t('proDash.settings.astuce')}</div>
                  <div className="text-xs text-amber-600 mt-0.5">{t('proDash.settings.astuceTexte')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
