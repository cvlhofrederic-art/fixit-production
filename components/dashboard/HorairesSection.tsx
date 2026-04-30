'use client'

import { useTranslation, useLocale } from '@/lib/i18n/context'
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
        /* Layout-only — pas de couleurs custom : on réutilise les primitives v5 (.v5-tgl, .v5-chip) du design system */
        .h-day-block + .h-day-block { margin-top: 8px; }
        .h-row { display: flex; align-items: center; gap: 14px; padding: 10px 12px; border: 1px solid #E8E8E8; border-radius: 6px; background: #fff; }
        .h-row.is-off { background: #FAFAFA; }
        .h-day { width: 88px; font-weight: 600; font-size: 13px; color: #1a1a1a; }
        .h-row.is-off .h-day { color: #999; }
        .h-times { display: flex; align-items: center; gap: 8px; flex: 1; flex-wrap: wrap; }
        .h-times input[type=time] { font-size: 12px; padding: 5px 8px; border: 1px solid #E0E0E0; border-radius: 4px; background: #fff; color: #1a1a1a; width: 100px; }
        .h-times input[type=time]:disabled { opacity: .4; cursor: not-allowed; }
        .h-times input[type=time]:focus { outline: none; border-color: #FFC107; }
        .h-closed { font-size: 12px; color: #BBB; font-style: italic; }
        .h-svc-panel { margin: 6px 0 10px 100px; padding: 8px 12px; }
        .h-svc-lbl { font-size: 10px; font-weight: 700; color: #999; letter-spacing: .3px; text-transform: uppercase; margin-bottom: 6px; }
        .h-svc-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
        .h-svc-chips label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
        .h-svc-chips input[type=checkbox] { width: 13px; height: 13px; accent-color: #FFC107; cursor: pointer; }
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
                      <span className="v22-card-meta" style={{ marginLeft: 8 }}>
                        {dayServiceIds.length > 0 ? `${dayServiceIds.length} ${t('proDash.horaires.motifsLabel')}` : t('proDash.horaires.tousMotifs')}
                      </span>
                    )}
                  </div>
                  <label className="v5-tgl" title={isActive ? (isPt ? 'Desativar este dia' : 'Désactiver ce jour') : (isPt ? 'Ativar este dia' : 'Activer ce jour')}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleDayAvailability(day)}
                    />
                    <span className="sl" />
                  </label>
                </div>
                {isActive && activeServices.length > 0 && (
                  <div className="h-svc-panel">
                    <div className="h-svc-lbl">{isPt ? 'Serviços disponíveis neste dia' : 'Lots disponibles ce jour'}</div>
                    <div className="h-svc-chips">
                      {activeServices.map((service) => {
                        const isAssigned = dayServiceIds.includes(service.id)
                        return (
                          <label key={service.id}>
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => toggleDayService(day, service.id)}
                            />
                            <span className="v5-chip" style={{ background: isAssigned ? '#FFF8E1' : '#F5F5F5', color: isAssigned ? '#F57F17' : '#666' }}>{service.name}</span>
                          </label>
                        )
                      })}
                    </div>
                    {dayServiceIds.length === 0 && (
                      <p style={{ fontSize: 11, color: '#999', marginTop: 6, fontStyle: 'italic' }}>{t('proDash.horaires.aucunMotif')}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {savingAvail && (
          <div style={{ padding: '0 14px 14px' }}>
            <p style={{ fontSize: 12, color: '#F57C00', fontWeight: 500 }}>{t('proDash.horaires.sauvegarde')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
