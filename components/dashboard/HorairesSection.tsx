'use client'

import { useTranslation, useLocale } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'
import type { Artisan, Service, Availability } from '@/lib/types'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface HorairesSectionProps {
  artisan: Artisan
  services: Service[]
  availability: Availability[]
  dayServices: Record<string, string[]>
  autoAccept: boolean
  savingAvail: boolean
  toggleAutoAccept: () => void
  toggleDayAvailability: (dayOfWeek: number) => void
  updateAvailabilityTime: (dayOfWeek: number, field: 'start_time' | 'end_time', value: string) => void
  toggleDayService: (dayOfWeek: number, serviceId: string) => void
  DAY_NAMES: string[]
  orgRole?: OrgRole
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
  orgRole,
}: HorairesSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isPt = locale === 'pt'
  void orgRole
  const tv = useThemeVars(true)

  // Mon-Fri défaut actif 08:00-17:30 (affichage tant qu'aucune donnée serveur)
  const getDayDefaults = (day: number) => {
    const isWeekday = day >= 1 && day <= 5
    return {
      is_available: isWeekday,
      start_time: '08:00',
      end_time: '17:30',
    }
  }

  return (
    <div className="v5-fade">
      <style>{`
        .h-tgl { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; cursor: pointer; }
        .h-tgl input { opacity: 0; width: 0; height: 0; position: absolute; }
        .h-tgl .sl { position: absolute; inset: 0; background: #E0E0E0; border-radius: 10px; transition: .3s; }
        .h-tgl .sl::before { content: ''; position: absolute; width: 16px; height: 16px; background: #fff; border-radius: 50%; left: 2px; bottom: 2px; transition: .3s; box-shadow: 0 1px 2px rgba(0,0,0,.15); }
        .h-tgl input:checked + .sl { background: #F57C00; }
        .h-tgl input:checked + .sl::before { left: 18px; }
        .h-row { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border: 1px solid ${tv.border}; border-radius: 8px; background: #fff; }
        .h-row + .h-row { margin-top: 8px; }
        .h-day { width: 90px; font-weight: 600; font-size: 13px; color: ${tv.text}; }
        .h-times { display: flex; align-items: center; gap: 8px; flex: 1; }
        .h-times input[type=time] { font-size: 12px; padding: 5px 8px; border: 1px solid ${tv.border}; border-radius: 6px; background: #fff; color: ${tv.text}; width: 100px; }
        .h-times input[type=time]:disabled { opacity: .4; cursor: not-allowed; }
        .h-closed { font-size: 12px; color: ${tv.textMuted}; font-style: italic; }
        .h-modify { font-size: 12px; color: ${tv.primary}; background: none; border: 1px solid ${tv.border}; border-radius: 6px; padding: 5px 12px; cursor: pointer; font-weight: 500; transition: all .15s; }
        .h-modify:hover { background: ${tv.primaryLight}; border-color: ${tv.primary}; }
      `}</style>

      {/* Page header */}
      <div className="v5-pg-t">
        <h1>{'⏱️'} {isPt ? 'Horários de obra & equipas' : 'Horaires chantier & équipes'}</h1>
        <p>{isPt
          ? 'Defina os horários de intervenção da sua empresa — apresentados no seu perfil e nos concursos'
          : 'Définissez les plages d\u2019intervention de votre entreprise — affichées sur votre profil et dans les appels d\u2019offres'}</p>
      </div>

      {/* Info box */}
      <div className="v5-al" style={{ marginBottom: 16, cursor: 'default' }}>
        <span style={{ fontSize: 12 }}>
          <strong>{'💡'} {isPt ? 'Dica' : 'Conseil'}</strong> {isPt
            ? 'Estes horários aparecem no seu perfil da empresa e são tidos em conta nos concursos. Ative os dias em que as suas equipas intervêm.'
            : 'Ces horaires apparaissent sur votre profil entreprise et sont pris en compte lors des appels d\u2019offres. Activez les jours où vos équipes interviennent.'}
        </span>
      </div>

      {/* Mode validation */}
      <div className="v5-card" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="v5-st">{isPt ? 'Aceitação dos pedidos' : 'Acceptation des demandes'}</div>
            <div className="v22-card-meta">
              {autoAccept
                ? (isPt ? '✅ Aceitação automática dos pedidos de orçamento' : '✅ Acceptation automatique des demandes de devis')
                : (isPt ? '⏳ Validação manual pelo responsável' : '⏳ Validation manuelle par le responsable')}
            </div>
          </div>
          <button
            onClick={toggleAutoAccept}
            className={autoAccept ? 'v5-btn v5-btn-p' : 'v5-btn'}
            style={{ cursor: 'pointer' }}
          >
            {autoAccept ? `🟢 ${t('proDash.horaires.automatique')}` : `🟡 ${t('proDash.horaires.manuel')}`}
          </button>
        </div>
      </div>

      {/* Plages d'ouverture */}
      <div className="v5-card">
        <div className="v22-card-head">
          <span className="v5-st">⏱️ {isPt ? 'Horários de intervenção' : 'Plages d\u2019intervention'}</span>
        </div>
        <div style={{ padding: 14 }}>
          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const availRaw = availability.find((a) => a.day_of_week === day)
            const defaults = getDayDefaults(day)
            const isActive = availRaw ? availRaw.is_available : defaults.is_available
            const startTime = (availRaw?.start_time?.substring(0, 5)) || defaults.start_time
            const endTime = (availRaw?.end_time?.substring(0, 5)) || defaults.end_time
            const dayServiceIds = dayServices[String(day)] || []
            const activeServices = services.filter(s => s.active)

            return (
              <div key={day}>
                <div className="h-row">
                  <span className="h-day">{DAY_NAMES[day]}</span>
                  <div className="h-times">
                    <input
                      type="time"
                      disabled={!isActive}
                      value={startTime}
                      onChange={(e) => updateAvailabilityTime(day, 'start_time', e.target.value)}
                    />
                    <span className="v22-card-meta">{t('proDash.common.a')}</span>
                    <input
                      type="time"
                      disabled={!isActive}
                      value={endTime}
                      onChange={(e) => updateAvailabilityTime(day, 'end_time', e.target.value)}
                    />
                    {!isActive && <span className="h-closed" style={{ marginLeft: 8 }}>{isPt ? 'Fechado' : 'Fermé'}</span>}
                    {isActive && activeServices.length > 0 && (
                      <span className="v22-card-meta" style={{ marginLeft: 8 }}>
                        {dayServiceIds.length > 0 ? `${dayServiceIds.length} ${t('proDash.horaires.motifsLabel')}` : t('proDash.horaires.tousMotifs')}
                      </span>
                    )}
                  </div>
                  <button className="h-modify" onClick={() => updateAvailabilityTime(day, 'start_time', startTime)} type="button" title={isPt ? 'Modificar os horários' : 'Modifier les horaires'}>{isPt ? 'Modificar' : 'Modifier'}</button>
                  <label className="h-tgl" title={isActive ? (isPt ? 'Desativar este dia' : 'Désactiver ce jour') : (isPt ? 'Ativar este dia' : 'Activer ce jour')}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleDayAvailability(day)}
                    />
                    <span className="sl" />
                  </label>
                </div>
                {isActive && activeServices.length > 0 && (
                  <div style={{ margin: '8px 0 12px 104px', paddingLeft: 12, borderLeft: `2px solid ${tv.primary}` }}>
                    <p className="v22-form-label" style={{ marginBottom: 6 }}>{isPt ? 'Serviços disponíveis neste dia' : 'Lots disponibles ce jour'}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {activeServices.map((service) => {
                        const isAssigned = dayServiceIds.includes(service.id)
                        return (
                          <label
                            key={service.id}
                            className="v5-chip"
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => toggleDayService(day, service.id)}
                              style={{ width: 13, height: 13, accentColor: tv.primary }}
                            />
                            <span>{service.name}</span>
                          </label>
                        )
                      })}
                    </div>
                    {dayServiceIds.length === 0 && (
                      <p style={{ fontSize: 11, color: tv.primary, marginTop: 4 }}>{t('proDash.horaires.aucunMotif')}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {savingAvail && (
          <div style={{ padding: '0 14px 14px' }}>
            <p style={{ fontSize: 12, color: tv.primary, fontWeight: 500 }}>{t('proDash.horaires.sauvegarde')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
