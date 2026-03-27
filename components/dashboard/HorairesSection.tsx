'use client'

import { useTranslation } from '@/lib/i18n/context'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

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
  const isSociete = orgRole === 'pro_societe'

  return (
    <div>
      {/* Page header */}
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title">
            {isSociete ? '⏱️ Horaires chantier & équipes' : `${'🕐'} ${t('proDash.horaires.title')}`}
          </h1>
          <p className="v22-page-sub">
            {isSociete
              ? "Définissez les plages d'intervention de votre entreprise — affichées sur votre profil et dans les appels d'offres"
              : t('proDash.horaires.subtitle')}
          </p>
        </div>
        <div />
      </div>

      <div style={{ padding: '24px' }}>

        {/* Info box société */}
        {isSociete && (
          <div className="v22-alert v22-alert-amber" style={{ marginBottom: 16, cursor: 'default' }}>
            <span style={{ fontSize: 12 }}>
              <strong>{'💡'} Conseil</strong> Ces horaires apparaissent sur votre profil entreprise et sont pris en compte lors des appels d&apos;offres. Activez les jours où vos équipes interviennent.
            </span>
          </div>
        )}

        {/* Mode validation */}
        <div className="v22-card" style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="v22-card-title">
                {isSociete ? 'Acceptation des demandes' : t('proDash.horaires.modeValidation')}
              </div>
              <div className="v22-card-meta">
                {autoAccept
                  ? `✅ ${isSociete ? 'Acceptation automatique des demandes de devis' : t('proDash.horaires.autoConfirm')}`
                  : `⏳ ${isSociete ? 'Validation manuelle par le responsable' : t('proDash.horaires.manualConfirm')}`}
              </div>
            </div>
            <button
              onClick={toggleAutoAccept}
              className={autoAccept ? 'v22-btn v22-btn-sm v22-tag v22-tag-green' : 'v22-btn v22-btn-sm v22-tag v22-tag-amber'}
              style={{ cursor: 'pointer' }}
            >
              {autoAccept ? `🟢 ${t('proDash.horaires.automatique')}` : `🟡 ${t('proDash.horaires.manuel')}`}
            </button>
          </div>
        </div>

        {/* Plages d'ouverture */}
        <div className="v22-card">
          <div className="v22-card-head">
            <span className="v22-card-title">
              {isSociete ? "⏱️ Plages d'intervention" : `${'🕐'} ${t('proDash.horaires.plagesOuverture')}`}
            </span>
          </div>
          <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const avail = availability.find((a) => a.day_of_week === day)
              const dayServiceIds = dayServices[String(day)] || []
              const activeServices = services.filter(s => s.active)
              return (
                <div key={day} style={{ padding: 10, borderRadius: 6, background: 'var(--v22-bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <span style={{ width: 90, fontWeight: 600, fontSize: 13 }}>{DAY_NAMES[day]}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      {/* Toggle switch */}
                      <button
                        onClick={() => toggleDayAvailability(day)}
                        style={{
                          width: 38,
                          height: 20,
                          borderRadius: 10,
                          position: 'relative',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'background .2s',
                          background: avail?.is_available ? 'var(--v22-green)' : 'var(--v22-border-dark)',
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: 2,
                          width: 16,
                          height: 16,
                          background: '#fff',
                          borderRadius: '50%',
                          boxShadow: '0 1px 2px rgba(0,0,0,.15)',
                          transition: 'transform .2s',
                          transform: avail?.is_available ? 'translateX(19px)' : 'translateX(2px)',
                        }} />
                      </button>
                      {avail?.is_available ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="time"
                            value={avail.start_time?.substring(0, 5) || '08:00'}
                            onChange={(e) => updateAvailabilityTime(day, 'start_time', e.target.value)}
                            className="v22-form-input"
                            style={{ width: 100, padding: '4px 8px' }}
                          />
                          <span className="v22-card-meta">{t('proDash.common.a')}</span>
                          <input
                            type="time"
                            value={avail.end_time?.substring(0, 5) || '17:00'}
                            onChange={(e) => updateAvailabilityTime(day, 'end_time', e.target.value)}
                            className="v22-form-input"
                            style={{ width: 100, padding: '4px 8px' }}
                          />
                          <span className="v22-card-meta" style={{ marginLeft: 4 }}>
                            {dayServiceIds.length > 0 ? `${dayServiceIds.length} ${t('proDash.horaires.motifsLabel')}` : t('proDash.horaires.tousMotifs')}
                          </span>
                        </div>
                      ) : (
                        <span className="v22-card-meta">{t('proDash.horaires.ferme')}</span>
                      )}
                    </div>
                  </div>
                  {avail?.is_available && activeServices.length > 0 && (
                    <div style={{ marginTop: 10, marginLeft: 100, paddingLeft: 12, borderLeft: '2px solid var(--v22-yellow)' }}>
                      <p className="v22-form-label" style={{ marginBottom: 6 }}>
                      {isSociete ? 'Lots disponibles ce jour' : t('proDash.horaires.motifsDisponibles')}
                    </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {activeServices.map((service) => {
                          const isAssigned = dayServiceIds.includes(service.id)
                          return (
                            <label
                              key={service.id}
                              className={isAssigned ? 'v22-tag v22-tag-yellow' : 'v22-tag v22-tag-gray'}
                              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => toggleDayService(day, service.id)}
                                style={{ width: 13, height: 13, accentColor: 'var(--v22-yellow)' }}
                              />
                              <span>{service.name}</span>
                            </label>
                          )
                        })}
                      </div>
                      {dayServiceIds.length === 0 && (
                        <p style={{ fontSize: 11, color: 'var(--v22-amber)', marginTop: 4 }}>{t('proDash.horaires.aucunMotif')}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {savingAvail && (
            <div style={{ padding: '0 14px 14px' }}>
              <p style={{ fontSize: 12, color: 'var(--v22-yellow)', fontWeight: 500 }}>{t('proDash.horaires.sauvegarde')}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
