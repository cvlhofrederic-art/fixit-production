'use client'

import { useTranslation } from '@/lib/i18n/context'

interface HorairesSectionProps {
  artisan: any
  services: any[]
  availability: any[]
  dayServices: Record<string, string[]>
  autoAccept: boolean
  savingAvail: boolean
  toggleAutoAccept: () => void
  toggleDayAvailability: (dayOfWeek: number) => void
  updateAvailabilityTime: (dayOfWeek: number, field: 'start_time' | 'end_time', value: string) => void
  toggleDayService: (dayOfWeek: number, serviceId: string) => void
  DAY_NAMES: string[]
}

export default function HorairesSection({
  services,
  availability,
  dayServices,
  autoAccept,
  savingAvail,
  toggleAutoAccept,
  toggleDayAvailability,
  updateAvailabilityTime,
  toggleDayService,
  DAY_NAMES,
}: HorairesSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold leading-tight">{'🕐'} {t('proDash.horaires.title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('proDash.horaires.subtitle')}</p>
        </div>
        <div />
      </div>
      <div className="p-6 lg:p-8">

        {/* Mode validation */}
        <div className="bg-white p-4 rounded-2xl shadow-sm mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">{t('proDash.horaires.modeValidation')}</h3>
            <p className="text-sm text-gray-500">
              {autoAccept ? `✅ ${t('proDash.horaires.autoConfirm')}` : `⏳ ${t('proDash.horaires.manualConfirm')}`}
            </p>
          </div>
          <button onClick={toggleAutoAccept} className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${autoAccept ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
            {autoAccept ? `🟢 ${t('proDash.horaires.automatique')}` : `🟡 ${t('proDash.horaires.manuel')}`}
          </button>
        </div>

        {/* Plages d'ouverture */}
        <div className="bg-white p-6 rounded-2xl shadow-sm mb-6">
          <h3 className="font-bold text-lg mb-4">{'🕐'} {t('proDash.horaires.plagesOuverture')}</h3>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const avail = availability.find((a) => a.day_of_week === day)
              const dayServiceIds = dayServices[String(day)] || []
              const activeServices = services.filter(s => s.active)
              return (
                <div key={day} className="p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="w-24 font-semibold">{DAY_NAMES[day]}</div>
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        onClick={() => toggleDayAvailability(day)}
                        className={`w-12 h-6 rounded-full relative transition-colors ${avail?.is_available ? 'bg-green-400' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${avail?.is_available ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                      {avail?.is_available ? (
                        <div className="flex items-center gap-2">
                          <input type="time" value={avail.start_time?.substring(0, 5) || '08:00'}
                            onChange={(e) => updateAvailabilityTime(day, 'start_time', e.target.value)}
                            className="px-2 py-1 border-2 border-gray-200 rounded-lg text-sm focus:border-[#FFC107] focus:outline-none" />
                          <span className="text-gray-500">{t('proDash.common.a')}</span>
                          <input type="time" value={avail.end_time?.substring(0, 5) || '17:00'}
                            onChange={(e) => updateAvailabilityTime(day, 'end_time', e.target.value)}
                            className="px-2 py-1 border-2 border-gray-200 rounded-lg text-sm focus:border-[#FFC107] focus:outline-none" />
                          <span className="text-xs text-gray-500 ml-2">
                            {dayServiceIds.length > 0 ? `${dayServiceIds.length} ${t('proDash.horaires.motifsLabel')}` : t('proDash.horaires.tousMotifs')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">{t('proDash.horaires.ferme')}</span>
                      )}
                    </div>
                  </div>
                  {avail?.is_available && activeServices.length > 0 && (
                    <div className="mt-3 ml-0 sm:ml-24 pl-4 border-l-2 border-[#FFC107]">
                      <p className="text-xs text-gray-500 mb-2 font-semibold">{t('proDash.horaires.motifsDisponibles')}</p>
                      <div className="flex flex-wrap gap-2">
                        {activeServices.map((service) => {
                          const isAssigned = dayServiceIds.includes(service.id)
                          return (
                            <label
                              key={service.id}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition text-sm ${
                                isAssigned
                                  ? 'bg-[#FFC107]/20 border border-[#FFC107] text-gray-900'
                                  : 'bg-white border border-gray-200 text-gray-600 hover:border-[#FFC107]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => toggleDayService(day, service.id)}
                                className="w-3.5 h-3.5 accent-[#FFC107] rounded"
                              />
                              <span>{service.name}</span>
                            </label>
                          )
                        })}
                      </div>
                      {dayServiceIds.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">{t('proDash.horaires.aucunMotif')}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {savingAvail && <p className="text-sm text-[#FFC107] mt-2 font-medium">{t('proDash.horaires.sauvegarde')}</p>}
        </div>

      </div>
    </div>
  )
}
