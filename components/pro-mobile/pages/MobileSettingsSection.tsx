'use client'

import React from 'react'
import type { Artisan } from '@/lib/types'

interface SettingsForm {
  company_name: string
  phone: string
  bio: string
  auto_reply_message: string
  auto_block_duration_minutes: number
  zone_radius_km: number
}

const ARTISAN_MODULES = [
  { key: 'ponctualite',     label: 'Score de ponctualité',           labelKey: 'mob.modules.ponctualite',     icon: '⏱️', description: 'Affiche votre taux de réalisation sur l\'accueil',    descriptionKey: 'mob.modules.ponctualiteDesc',     default: true  },
  { key: 'revenus',         label: 'Dashboard revenus',              labelKey: 'mob.modules.revenus',         icon: '💰', description: 'Suivi mensuel du CA et top services',                 descriptionKey: 'mob.modules.revenusDesc',         default: true  },
  { key: 'devis_rapide',    label: 'Devis rapide',                   labelKey: 'mob.modules.devisRapide',     icon: '📝', description: 'Générer et envoyer des devis en 30 secondes',          descriptionKey: 'mob.modules.devisRapideDesc',     default: true  },
  { key: 'export_fec',      label: 'Export FEC comptable',           labelKey: 'mob.modules.exportFec',       icon: '📊', description: 'Export des écritures au format fiscal',                descriptionKey: 'mob.modules.exportFecDesc',       default: false },
  { key: 'compliance_wallet', label: 'Compliance Wallet',            labelKey: 'mob.modules.complianceWallet', icon: '🪪', description: 'Portefeuille de documents professionnels',           descriptionKey: 'mob.modules.complianceWalletDesc', default: true },
  { key: 'proof_of_work',   label: 'Proof of Work',                  labelKey: 'mob.modules.proofOfWork',     icon: '📸', description: 'Photos avant/après + signature client',               descriptionKey: 'mob.modules.proofOfWorkDesc',     default: true  },
  { key: 'gps_tracking',    label: 'GPS Tracking',                   labelKey: 'mob.modules.gpsTracking',     icon: '📍', description: 'Partagez votre position en temps réel',               descriptionKey: 'mob.modules.gpsTrackingDesc',     default: false },
  { key: 'rapport_pdf',     label: 'Rapport PDF fin de chantier',    labelKey: 'mob.modules.rapportPdf',      icon: '📄', description: 'Générer un rapport PDF probatoire',                   descriptionKey: 'mob.modules.rapportPdfDesc',      default: false },
  { key: 'notifications',   label: 'Notifications syndic',           labelKey: 'mob.modules.notifications',   icon: '📣', description: 'Recevoir les notifications du syndic',                descriptionKey: 'mob.modules.notificationsDesc',   default: true  },
] as const

interface MobileSettingsSectionProps {
  artisan: Artisan
  initials: string
  locale: string
  dateFmtLocale: string
  t: (key: string, fallback?: string) => string
  settingsForm: SettingsForm
  setSettingsForm: React.Dispatch<React.SetStateAction<SettingsForm>>
  savingSettings: boolean
  saveSettings: () => void
  autoAccept: boolean
  toggleAutoAccept: () => void
  availability: Array<{ day_of_week: number }>
  toggleDayAvailability: (day: number) => void
  enabledModules: Record<string, boolean>
  isModuleEnabled: (key: string) => boolean
  toggleModule: (key: string) => void
  handleLogout: () => void
  DAY_NAMES: string[]
  MobilePasswordChange: React.ComponentType<Record<string, never>>
}

export default function MobileSettingsSection({
  artisan,
  initials,
  t,
  settingsForm,
  setSettingsForm,
  savingSettings,
  saveSettings,
  autoAccept,
  toggleAutoAccept,
  availability,
  toggleDayAvailability,
  isModuleEnabled,
  toggleModule,
  handleLogout,
  DAY_NAMES,
  MobilePasswordChange,
}: MobileSettingsSectionProps) {
  return (
        <div>
          <div className="bg-white px-4 pt-12 pb-6 safe-area-pt border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-2xl font-black text-gray-900 shadow-lg">
                {initials}
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{artisan?.company_name}</div>
                <div className="text-xs text-gray-500">{artisan?.category || 'Artisan'}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-amber-400 text-sm">⭐</span>
                  <span className="text-xs font-semibold text-gray-600">{artisan?.rating_avg || '5.0'}/5</span>
                  <span className="text-xs text-gray-500">({artisan?.rating_count || 0} avis)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Auto-accept toggle */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-gray-900">{t('mob.autoAccept')}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t('mob.autoAcceptDesc')}</div>
                </div>
                <button
                  onClick={toggleAutoAccept}
                  className={`w-12 h-7 rounded-full transition-all relative ${autoAccept ? 'bg-[#FFC107]' : 'bg-gray-200'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all ${autoAccept ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {/* Auto-accept sub-settings */}
            {autoAccept && (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-3">
                <div className="text-xs font-semibold text-amber-700">⚙️ {t('mob.autoAcceptOptions')}</div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Durée de blocage par RDV</label>
                  <select
                    value={settingsForm.auto_block_duration_minutes}
                    onChange={e => setSettingsForm((p: SettingsForm) => ({ ...p, auto_block_duration_minutes: parseInt(e.target.value) }))}
                    className="w-full border border-amber-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-[#FFC107]"
                  >
                    <option value={60}>1 heure</option>
                    <option value={120}>2 heures</option>
                    <option value={180}>3 heures</option>
                    <option value={240}>4 heures (défaut)</option>
                    <option value={360}>6 heures</option>
                    <option value={480}>8 heures (journée)</option>
                  </select>
                  <p className="text-[10px] text-gray-500 mt-1">Chaque RDV confirmé bloquera ce créneau dans votre agenda</p>
                </div>
              </div>
            )}

            {/* Auto-reply message */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="font-semibold text-sm text-gray-900 mb-1">💬 {t('mob.autoReply')}</div>
              <p className="text-[10px] text-gray-500 mb-3">{t('mob.autoReplyDesc')}</p>
              <textarea
                value={settingsForm.auto_reply_message}
                onChange={e => setSettingsForm((p: SettingsForm) => ({ ...p, auto_reply_message: e.target.value }))}
                rows={3}
                placeholder="Ex: Bonjour, merci pour votre réservation ! Pouvez-vous m'envoyer des photos du lieu et les infos d'accès (code porte, étage) ?"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107] resize-none"
              />
            </div>

            {/* Zone radius */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="font-semibold text-sm text-gray-900 mb-1">📍 {t('mob.interventionRadius')}</div>
              <p className="text-[10px] text-gray-500 mb-3">{t('mob.radiusDesc')}</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={settingsForm.zone_radius_km}
                  onChange={e => setSettingsForm((p: SettingsForm) => ({ ...p, zone_radius_km: parseInt(e.target.value) }))}
                  className="flex-1 accent-[#FFC107]"
                />
                <span className="text-sm font-bold text-gray-900 min-w-[50px] text-right">{settingsForm.zone_radius_km} km</span>
              </div>
            </div>

            {/* Modules personnalisables */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-sm text-gray-900">🧩 {t('mob.myModules')}</div>
                <span className="text-[10px] text-gray-500">{ARTISAN_MODULES.filter(m => isModuleEnabled(m.key)).length}/{ARTISAN_MODULES.length} {t('mob.modules.active', 'actifs')}</span>
              </div>
              <p className="text-[11px] text-gray-500 mb-4">{t('mob.modulesDesc')}</p>
              <div className="space-y-2">
                {ARTISAN_MODULES.map(mod => {
                  const enabled = isModuleEnabled(mod.key)
                  return (
                    <div key={mod.key} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${enabled ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                      <span className="text-xl flex-shrink-0">{mod.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800">{t(mod.labelKey, mod.label)}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{t(mod.descriptionKey, mod.description)}</div>
                      </div>
                      <button
                        onClick={() => toggleModule(mod.key)}
                        className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${enabled ? 'bg-[#FFC107]' : 'bg-gray-200'}`}
                      >
                        <div className="bg-white rounded-full shadow absolute transition-all" style={{ width: '18px', height: '18px', left: enabled ? '22px' : '2px', top: '3px' }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Availability */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="font-semibold text-sm text-gray-900 mb-3">🕐 {t('mob.workingDays')}</div>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 0].map(day => {
                  const isActive = availability.some(a => a.day_of_week === day)
                  return (
                    <button key={day} onClick={() => toggleDayAvailability(day)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive ? 'bg-[#FFC107] text-gray-900' : 'bg-gray-100 text-gray-500'
                      }`}>
                      {DAY_NAMES[day]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Profile form */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="font-semibold text-sm text-gray-900 mb-3">⚙️ {t('mob.information')}</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{t('mob.companyName')}</label>
                  <input value={settingsForm.company_name} onChange={e => setSettingsForm((p: SettingsForm) => ({ ...p, company_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{t('mob.phone')}</label>
                  <input value={settingsForm.phone} onChange={e => setSettingsForm((p: SettingsForm) => ({ ...p, phone: e.target.value }))}
                    type="tel" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{t('mob.bio')}</label>
                  <textarea value={settingsForm.bio} onChange={e => setSettingsForm((p: SettingsForm) => ({ ...p, bio: e.target.value }))}
                    rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107] resize-none" />
                </div>
                <button disabled={savingSettings} onClick={saveSettings}
                  className="w-full bg-[#FFC107] text-gray-900 py-3 rounded-xl font-bold text-sm disabled:opacity-50">
                  {savingSettings ? t('mob.saving') : t('mob.save')}
                </button>
              </div>
            </div>

            {/* Password change */}
            <MobilePasswordChange />

            {/* Logout */}
            <button onClick={handleLogout}
              className="w-full border border-red-200 text-red-500 py-3 rounded-2xl font-semibold text-sm bg-red-50">
              🚪 {t('mob.logout')}
            </button>

            <div className="text-center text-[10px] text-gray-300 pb-2">
              Vitfix Pro v1.0 · {artisan?.siret && `SIRET ${artisan.siret}`}
            </div>
          </div>
        </div>
  )
}
