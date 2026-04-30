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
        /* Toggle vert sémantique "disponible" — plus lisible que l'orange brand */
        .h-tgl { position: relative; display: inline-block; width: 38px; height: 22px; flex-shrink: 0; cursor: pointer; }
        .h-tgl input { opacity: 0; width: 0; height: 0; position: absolute; }
        .h-tgl .sl { position: absolute; inset: 0; background: #d1d5db; border-radius: 11px; transition: background .25s ease; }
        .h-tgl .sl::before { content: ''; position: absolute; width: 18px; height: 18px; background: #fff; border-radius: 50%; left: 2px; top: 2px; transition: transform .25s ease; box-shadow: 0 1px 3px rgba(0,0,0,.18); }
        .h-tgl input:checked + .sl { background: ${tv.green}; }
        .h-tgl input:checked + .sl::before { transform: translateX(16px); }
        .h-tgl:hover .sl { box-shadow: 0 0 0 4px rgba(76,175,80,.10); }

        /* Ligne jour : carte avec hover subtil */
        .h-row { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border: 1px solid ${tv.border}; border-radius: 10px; background: #fff; transition: border-color .15s, box-shadow .15s; }
        .h-row + .h-row, .h-day-block + .h-day-block { margin-top: 8px; }
        .h-row:hover { border-color: #cbd5e1; box-shadow: 0 1px 4px rgba(0,0,0,.04); }
        .h-row.is-off { background: #fafafa; }
        .h-row.is-off .h-day { color: ${tv.textMid}; }
        .h-day { width: 90px; font-weight: 600; font-size: 13px; color: ${tv.text}; }
        .h-times { display: flex; align-items: center; gap: 8px; flex: 1; flex-wrap: wrap; }
        .h-times input[type=time] { font-size: 12px; padding: 6px 8px; border: 1px solid ${tv.border}; border-radius: 6px; background: #fff; color: ${tv.text}; width: 100px; transition: border-color .15s, box-shadow .15s; }
        .h-times input[type=time]:not(:disabled):hover { border-color: #94a3b8; }
        .h-times input[type=time]:focus { outline: none; border-color: ${tv.primary}; box-shadow: 0 0 0 3px ${tv.primaryLight}; }
        .h-times input[type=time]:disabled { opacity: .4; cursor: not-allowed; }
        .h-closed { font-size: 12px; color: ${tv.textMuted}; font-style: italic; }
        .h-services-count { font-size: 11px; color: ${tv.textMid}; padding: 3px 8px; background: #f3f4f6; border-radius: 999px; font-weight: 500; }

        /* Section services avec accent neutre (au lieu de l'orange criard) */
        .h-services-panel { margin: 6px 0 12px 104px; padding: 10px 12px; background: #fafafa; border-left: 2px solid #e5e7eb; border-radius: 0 6px 6px 0; }
        .h-services-label { font-size: 11px; font-weight: 600; color: ${tv.textSecondary}; letter-spacing: .3px; text-transform: uppercase; margin-bottom: 8px; }
        .h-services-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .h-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; font-size: 12px; color: ${tv.text}; background: #fff; border: 1px solid ${tv.border}; border-radius: 999px; cursor: pointer; transition: all .15s; }
        .h-chip:hover { border-color: #94a3b8; }
        .h-chip.is-on { background: ${tv.greenLight}; border-color: ${tv.green}; color: #14532d; }
        .h-chip input { width: 13px; height: 13px; accent-color: ${tv.green}; cursor: pointer; }
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
              <div key={day} className="h-day-block">
                <div className={`h-row${isActive ? '' : ' is-off'}`}>
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
                      <span className="h-services-count">
                        {dayServiceIds.length > 0 ? `${dayServiceIds.length} ${t('proDash.horaires.motifsLabel')}` : t('proDash.horaires.tousMotifs')}
                      </span>
                    )}
                  </div>
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
                  <div className="h-services-panel">
                    <div className="h-services-label">{isPt ? 'Serviços disponíveis neste dia' : 'Lots disponibles ce jour'}</div>
                    <div className="h-services-chips">
                      {activeServices.map((service) => {
                        const isAssigned = dayServiceIds.includes(service.id)
                        return (
                          <label key={service.id} className={`h-chip${isAssigned ? ' is-on' : ''}`}>
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => toggleDayService(day, service.id)}
                            />
                            <span>{service.name}</span>
                          </label>
                        )
                      })}
                    </div>
                    {dayServiceIds.length === 0 && (
                      <p style={{ fontSize: 11, color: tv.textMid, marginTop: 6 }}>{t('proDash.horaires.aucunMotif')}</p>
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
