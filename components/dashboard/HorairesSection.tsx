'use client'

import { useMemo, useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
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

// Mon-Fri actif par défaut tant qu'aucune donnée serveur n'existe
function getDayDefaults(day: number) {
  const isWeekday = day >= 1 && day <= 5
  return { is_available: isWeekday, start_time: '08:00', end_time: '17:30' }
}

// Calcul "Xh YY" depuis minutes totaux
function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h${m.toString().padStart(2, '0')}`
}

// Différence entre deux HH:MM en minutes (>= 0)
function diffMinutes(start: string, end: string): number {
  const [sH, sM] = start.split(':').map(Number)
  const [eH, eM] = end.split(':').map(Number)
  return Math.max(0, (eH * 60 + eM) - (sH * 60 + sM))
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
  const locale = useLocale()
  const isPt = locale === 'pt'
  const isArtisan = orgRole === 'artisan'

  // ─── Vocabulaire métier (FR/PT × artisan/BTP) ────────────────────────────
  const L = {
    // Header
    title: isPt ? 'Horários de obra & equipas' : 'Horaires chantier & équipes',
    subtitle: isPt
      ? 'Defina os horários de intervenção da sua empresa — apresentados no seu perfil e nos concursos.'
      : 'Définissez les plages d’intervention de votre entreprise — affichées sur votre profil et dans les appels d’offres.',
    // Tip
    tipLabel: isPt ? 'Dica' : 'Conseil',
    tipBody: isPt
      ? 'Estes horários aparecem no seu perfil de empresa e são tidos em conta nos concursos. Ative os dias em que as suas equipas intervêm.'
      : 'Ces horaires apparaissent sur votre profil entreprise et sont pris en compte lors des appels d’offres. Activez les jours où vos équipes interviennent.',
    // Acceptance
    acceptLabel: isPt ? 'Aceitação dos pedidos' : 'Acceptation des demandes',
    acceptManual: isPt ? 'Validação manual pelo responsável' : 'Validation manuelle par le responsable',
    acceptAuto: isPt ? 'Aceitação automática dos pedidos de orçamento' : 'Acceptation automatique des demandes de devis',
    optManual: isPt ? '● Manual' : '● Manuel',
    optAuto: isPt ? '⚡ Automático' : '⚡ Automatique',
    // Section
    sectionTitle: isPt ? 'Horários de intervenção' : 'Plages d’intervention',
    daysActive: isPt ? 'dias ativos' : 'jours actifs',
    // Day labels
    closedLabel: isPt ? 'Fechado' : 'Fermé',
    activate: isPt ? 'Ativar este dia' : 'Activer ce jour',
    deactivate: isPt ? 'Desativar este dia' : 'Désactiver ce jour',
    // Prestations / Lots (terminologie selon orgRole)
    prestationsAll: isArtisan
      ? (isPt ? 'Todas as prestações' : 'Toutes les prestations')
      : (isPt ? 'Todos os lotes' : 'Tous les lots'),
    prestationSingular: isArtisan
      ? (isPt ? 'prestação selecionada' : 'prestation sélectionnée')
      : (isPt ? 'lote selecionado' : 'lot sélectionné'),
    prestationPlural: isArtisan
      ? (isPt ? 'prestações selecionadas' : 'prestations sélectionnées')
      : (isPt ? 'lotes selecionados' : 'lots sélectionnés'),
    prestPanelTitle: isArtisan
      ? (isPt ? 'Prestações disponíveis neste dia' : 'Prestations disponibles ce jour')
      : (isPt ? 'Lotes disponíveis neste dia' : 'Lots disponibles ce jour'),
    prestHint: isArtisan
      ? (isPt ? 'Nenhuma prestação selecionada = todas estão disponíveis' : 'Aucune prestation cochée = toutes sont disponibles')
      : (isPt ? 'Nenhum lote selecionado = todos estão disponíveis' : 'Aucun lot coché = tous sont disponibles'),
    // Footer
    perWeek: isPt ? '/ semana' : '/ semaine',
    autoSaved: isPt ? 'Guardado automaticamente' : 'Sauvegardé automatiquement',
    saving: isPt ? 'A guardar…' : 'Sauvegarde…',
    applyToAll: isPt ? 'Aplicar a todos' : 'Appliquer à tous',
    applyConfirm: isPt
      ? 'Aplicar os horários de Segunda a todos os dias ativos ?'
      : 'Appliquer les horaires de Lundi à tous les jours actifs ?',
  }

  // Ordre d'affichage : Lundi → Dimanche
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

  // ─── État local : panneaux prestations dépliés (par jour) ────────────────
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())
  const togglePanel = (day: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  // ─── Stats : nombre de jours actifs + total heures/semaine ───────────────
  const stats = useMemo(() => {
    let activeDays = 0
    let totalMinutes = 0
    for (const d of DAY_ORDER) {
      const r = availability.find(a => a.day_of_week === d)
      const def = getDayDefaults(d)
      const isActive = r ? r.is_available : def.is_available
      if (!isActive) continue
      activeDays += 1
      const s = r?.start_time?.substring(0, 5) || def.start_time
      const e = r?.end_time?.substring(0, 5) || def.end_time
      totalMinutes += diffMinutes(s, e)
    }
    return { activeDays, total: formatHoursMinutes(totalMinutes) }
  }, [availability])

  // ─── Action "Appliquer à tous" : copie Lundi (ou 1er jour actif) sur tous les jours actifs ─
  const applyToAll = () => {
    const ordered = [1, 2, 3, 4, 5, 6, 0]
    let refStart = '08:00'
    let refEnd = '17:30'
    // Trouver le 1er jour actif comme référence (priorité Lundi)
    for (const d of ordered) {
      const r = availability.find(a => a.day_of_week === d)
      const def = getDayDefaults(d)
      const isActive = r ? r.is_available : def.is_available
      if (isActive) {
        refStart = r?.start_time?.substring(0, 5) || def.start_time
        refEnd = r?.end_time?.substring(0, 5) || def.end_time
        break
      }
    }
    if (typeof window !== 'undefined' && !window.confirm(L.applyConfirm)) return
    for (const d of ordered) {
      const r = availability.find(a => a.day_of_week === d)
      const def = getDayDefaults(d)
      const isActive = r ? r.is_available : def.is_available
      if (!isActive) continue
      updateAvailabilityTime(d, 'start_time', refStart)
      updateAvailabilityTime(d, 'end_time', refEnd)
    }
  }

  // ─── Acceptance dropdown handler (select natif) ──────────────────────────
  const handleAcceptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const desired = e.target.value === 'auto'
    if (desired !== autoAccept) toggleAutoAccept()
  }

  return (
    <div className="v5-fade">
      <style>{`
        /* ============================================================
           HORAIRES — design refondu (mockup vitfix_horaires_redesign)
           Toutes les classes sont scoped avec préfixe .h2- pour éviter
           toute collision avec le reste du dashboard.
           ============================================================ */
        .h2-card { background: #FFFFFF; border: 1px solid #E8E8E8; border-radius: 6px; padding: 1.25rem; transition: all .2s; }
        .h2-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.04); border-color: #D8D8D8; }

        /* Tip box */
        .h2-tip { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: #F8F9FA; border: 1px solid #ECECEC; border-radius: 6px; margin-bottom: 1rem; font-size: 11px; color: #666; line-height: 1.5; }
        .h2-tip-icon { flex-shrink: 0; font-size: 13px; margin-top: 1px; }
        .h2-tip strong { color: #1a1a1a; font-weight: 600; }

        /* Acceptance bar */
        .h2-accept { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: linear-gradient(to right, #FFF8E1 0%, #FFFDF5 100%); border: 1px solid #F5C741; border-radius: 6px; margin-bottom: 1rem; gap: 12px; flex-wrap: wrap; }
        .h2-accept-l { display: flex; align-items: center; gap: 12px; }
        .h2-accept-icon { width: 36px; height: 36px; border-radius: 8px; background: #fff; border: 1px solid #F5C741; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
        .h2-accept-text { display: flex; flex-direction: column; gap: 2px; }
        .h2-accept-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #8B6F00; letter-spacing: .4px; }
        .h2-accept-value { font-size: 13px; color: #1a1a1a; font-weight: 500; }
        .h2-accept-select { background: #fff; border: 1px solid #F5C741; border-radius: 4px; padding: 6px 12px; font-size: 12px; color: #1a1a1a; font-weight: 600; cursor: pointer; font-family: inherit; outline: none; }
        .h2-accept-select:hover { border-color: #FFA000; }

        /* Section header inside card */
        .h2-sec { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: .75rem; border-bottom: 1px solid #F0F0F0; gap: 12px; flex-wrap: wrap; }
        .h2-sec-l { display: flex; align-items: center; gap: .5rem; }
        .h2-sec-t { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #666; letter-spacing: .4px; }
        .h2-sec-icon { color: #FFA000; font-size: 13px; }
        .h2-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; letter-spacing: .2px; background: #E8F5E9; color: #2E7D32; border: 1px solid #A5D6A7; }
        .h2-badge-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; background: #2E7D32; }

        /* Days */
        .h2-days { display: flex; flex-direction: column; gap: 8px; }
        .h2-day { background: #fff; border: 1px solid #EAEAEA; border-radius: 6px; transition: all .15s; overflow: hidden; }
        .h2-day:hover { border-color: #D5D5D5; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
        .h2-day.active { border-left: 3px solid #FFC107; }
        .h2-day.inactive { background: #FAFAFA; opacity: .7; }
        .h2-day.inactive:hover { opacity: 1; }

        .h2-day-main { display: grid; grid-template-columns: 130px 1fr auto auto; align-items: center; gap: 16px; padding: 12px 16px; }
        .h2-day-name { display: flex; align-items: center; gap: 8px; }
        .h2-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .h2-dot.on { background: #FFC107; box-shadow: 0 0 0 3px rgba(255, 193, 7, .18); }
        .h2-dot.off { background: #D0D0D0; }
        .h2-day-label { font-size: 13px; font-weight: 600; color: #1a1a1a; }
        .h2-day.inactive .h2-day-label { color: #999; font-weight: 500; }

        .h2-times { display: flex; align-items: center; gap: 8px; }
        .h2-time { width: 78px; height: 30px; border: 1px solid #E0E0E0; border-radius: 4px; padding: 0 8px; font-size: 12px; font-family: inherit; color: #1a1a1a; background: #fff; outline: none; transition: border-color .15s; }
        .h2-time:hover { border-color: #C5C5C5; }
        .h2-time:focus { border-color: #FFC107; box-shadow: 0 0 0 2px rgba(255, 193, 7, .18); }
        .h2-time:disabled { background: #F5F5F5; color: #BBB; cursor: not-allowed; }
        .h2-time-arrow { color: #BBB; font-size: 11px; }

        .h2-prest-chip { font-size: 12px; color: #666; display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: #F8F8F8; border: 1px solid #ECECEC; border-radius: 14px; white-space: nowrap; cursor: pointer; transition: all .15s; user-select: none; font-family: inherit; }
        .h2-prest-chip:hover { background: #FFF8E1; border-color: #F5C741; color: #8B6F00; }
        .h2-prest-chip .h2-chev { font-size: 9px; color: #BBB; margin-left: 2px; }
        .h2-prest-chip.has-filter { background: #FFF8E1; border-color: #F5C741; color: #8B6F00; font-weight: 600; }
        .h2-prest-chip.disabled { opacity: .4; pointer-events: none; }

        /* Toggle */
        .h2-tgl { position: relative; width: 36px; height: 20px; display: inline-block; flex-shrink: 0; cursor: pointer; }
        .h2-tgl input { opacity: 0; width: 0; height: 0; position: absolute; }
        .h2-tgl .sl { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #E0E0E0; border-radius: 10px; cursor: pointer; transition: .3s; }
        .h2-tgl .sl::before { content: ''; position: absolute; width: 16px; height: 16px; left: 2px; bottom: 2px; background: #fff; border-radius: 50%; transition: .3s; box-shadow: 0 1px 2px rgba(0, 0, 0, .15); }
        .h2-tgl input:checked + .sl { background: #FFC107; }
        .h2-tgl input:checked + .sl::before { transform: translateX(16px); }

        /* Expanded prestations panel */
        .h2-panel { padding: 12px 16px 14px; background: #FCFCFC; border-top: 1px dashed #ECECEC; }
        .h2-panel-t { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #999; letter-spacing: .3px; margin-bottom: 8px; }
        .h2-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .h2-item { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; background: #fff; border: 1px solid #E0E0E0; border-radius: 4px; font-size: 11px; color: #555; cursor: pointer; transition: all .15s; user-select: none; }
        .h2-item:hover { border-color: #FFC107; color: #1a1a1a; }
        .h2-item input { width: 12px; height: 12px; accent-color: #FFA000; cursor: pointer; }
        .h2-item.checked { background: #FFF8E1; border-color: #F5C741; color: #1a1a1a; font-weight: 500; }
        .h2-hint { font-size: 10px; color: #AAA; font-style: italic; margin-top: 6px; }

        /* Footer summary */
        .h2-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 1rem; padding-top: .75rem; border-top: 1px solid #F0F0F0; gap: 12px; flex-wrap: wrap; }
        .h2-foot-l { display: flex; align-items: center; gap: 14px; font-size: 11px; color: #888; flex-wrap: wrap; }
        .h2-foot-l strong { color: #1a1a1a; font-weight: 600; }
        .h2-foot-l .h2-sep { width: 3px; height: 3px; border-radius: 50%; background: #D5D5D5; }
        .h2-foot-r { display: flex; gap: 6px; flex-wrap: wrap; }
        .h2-saved { display: inline-flex; align-items: center; gap: 4px; color: #2E7D32; font-weight: 500; }

        /* Buttons (alignés sur le pattern .v5-btn déjà partagé) */
        .h2-btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 4px; border: 1px solid #E0E0E0; font-size: 11px; font-weight: 500; cursor: pointer; transition: all .2s; background: #fff; color: #555; font-family: inherit; }
        .h2-btn:hover { border-color: #CCC; background: #FAFAFA; }
        .h2-btn-sm { padding: 3px 8px; font-size: 10px; }
        .h2-btn-ghost { background: transparent; border: 1px dashed #DADADA; color: #888; }
        .h2-btn-ghost:hover { border-color: #FFC107; color: #FFA000; background: #FFF8E1; }

        /* Responsive */
        @media (max-width: 768px) {
          .h2-day-main { grid-template-columns: 1fr; gap: 10px; }
          .h2-prest-chip { width: 100%; justify-content: center; }
        }
      `}</style>

      {/* Page header */}
      <div className="v5-pg-t">
        <h1>{'⏱️'} {L.title}</h1>
        <p>{L.subtitle}</p>
      </div>

      <div className="h2-card">
        {/* Tip / conseil */}
        <div className="h2-tip">
          <span className="h2-tip-icon">💡</span>
          <div><strong>{L.tipLabel}</strong> — {L.tipBody}</div>
        </div>

        {/* Acceptance bar — sélecteur Manuel/Automatique */}
        <div className="h2-accept">
          <div className="h2-accept-l">
            <div className="h2-accept-icon">{autoAccept ? '⚡' : '⏳'}</div>
            <div className="h2-accept-text">
              <span className="h2-accept-label">{L.acceptLabel}</span>
              <span className="h2-accept-value">{autoAccept ? L.acceptAuto : L.acceptManual}</span>
            </div>
          </div>
          <select
            className="h2-accept-select"
            value={autoAccept ? 'auto' : 'manual'}
            onChange={handleAcceptChange}
          >
            <option value="manual">{L.optManual}</option>
            <option value="auto">{L.optAuto}</option>
          </select>
        </div>

        {/* Section header */}
        <div className="h2-sec">
          <div className="h2-sec-l">
            <span className="h2-sec-icon">📅</span>
            <span className="h2-sec-t">{L.sectionTitle}</span>
          </div>
          <span className="h2-badge">
            <span className="h2-badge-dot" />
            {stats.activeDays} {L.daysActive}
          </span>
        </div>

        {/* Days list */}
        <div className="h2-days">
          {DAY_ORDER.map((day) => {
            const availRaw = availability.find((a) => a.day_of_week === day)
            const defaults = getDayDefaults(day)
            const isActive = availRaw ? availRaw.is_available : defaults.is_available
            const startTime = availRaw?.start_time?.substring(0, 5) || defaults.start_time
            const endTime = availRaw?.end_time?.substring(0, 5) || defaults.end_time
            const dayServiceIds = dayServices[String(day)] || []
            const activeServices = services.filter(s => s.active)
            const hasFilter = dayServiceIds.length > 0
            const isOpen = expandedDays.has(day)
            const canExpand = isActive && activeServices.length > 0

            return (
              <div key={day} className={`h2-day ${isActive ? 'active' : 'inactive'}`}>
                <div className="h2-day-main">
                  <div className="h2-day-name">
                    <span className={`h2-dot ${isActive ? 'on' : 'off'}`} />
                    <span className="h2-day-label">{DAY_NAMES[day]}</span>
                  </div>

                  <div className="h2-times">
                    <input
                      type="time"
                      className="h2-time"
                      value={startTime}
                      disabled={!isActive}
                      onChange={(e) => updateAvailabilityTime(day, 'start_time', e.target.value)}
                    />
                    <span className="h2-time-arrow">→</span>
                    <input
                      type="time"
                      className="h2-time"
                      value={endTime}
                      disabled={!isActive}
                      onChange={(e) => updateAvailabilityTime(day, 'end_time', e.target.value)}
                    />
                  </div>

                  {canExpand ? (
                    <button
                      type="button"
                      className={`h2-prest-chip${hasFilter ? ' has-filter' : ''}`}
                      onClick={() => togglePanel(day)}
                    >
                      {hasFilter ? (
                        <>
                          <span>★</span>
                          {dayServiceIds.length}{' '}
                          {dayServiceIds.length > 1 ? L.prestationPlural : L.prestationSingular}
                        </>
                      ) : (
                        <>
                          <span style={{ color: '#2E7D32' }}>✓</span>
                          {L.prestationsAll}
                        </>
                      )}
                      <span className="h2-chev">{isOpen ? '▲' : '▼'}</span>
                    </button>
                  ) : (
                    <span className="h2-prest-chip disabled">{L.closedLabel}</span>
                  )}

                  <label className="h2-tgl" title={isActive ? L.deactivate : L.activate}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleDayAvailability(day)}
                    />
                    <span className="sl" />
                  </label>
                </div>

                {/* Panel prestations dépliable */}
                {canExpand && isOpen && (
                  <div className="h2-panel">
                    <div className="h2-panel-t">{L.prestPanelTitle}</div>
                    <div className="h2-list">
                      {activeServices.map((service) => {
                        const isAssigned = dayServiceIds.includes(service.id)
                        return (
                          <label key={service.id} className={`h2-item${isAssigned ? ' checked' : ''}`}>
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
                    <div className="h2-hint">{L.prestHint}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer récap : stats + actions */}
        <div className="h2-foot">
          <div className="h2-foot-l">
            <span><strong>{stats.activeDays}</strong> {L.daysActive}</span>
            <span className="h2-sep" />
            <span><strong>{stats.total}</strong> {L.perWeek}</span>
            <span className="h2-sep" />
            {savingAvail ? (
              <span style={{ color: '#FFA000' }}>⏱️ {L.saving}</span>
            ) : (
              <span className="h2-saved">✓ {L.autoSaved}</span>
            )}
          </div>
          <div className="h2-foot-r">
            <button
              type="button"
              className="h2-btn h2-btn-sm h2-btn-ghost"
              onClick={applyToAll}
              disabled={savingAvail}
              title={L.applyToAll}
            >
              ⎘ {L.applyToAll}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
