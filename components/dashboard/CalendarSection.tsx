'use client'

import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { Artisan, Service, Booking } from '@/lib/types'

interface NewRdvForm {
  client_name: string
  service_id: string
  date: string
  time: string
  address: string
  notes: string
  phone: string
  duration: string
}

interface AbsenceForm {
  start_date: string
  end_date: string
  reason: string
  label: string
}

interface CalendarSectionProps {
  artisan: Artisan | null
  bookings: Booking[]
  services: Service[]
  pendingBookings: Booking[]
  completedBookings: Booking[]
  totalRevenue: number
  calendarView: 'day' | 'week' | 'month'
  setCalendarView: (v: 'day' | 'week' | 'month') => void
  selectedDay: string
  setSelectedDay: (v: string) => void
  showNewRdv: boolean
  setShowNewRdv: (v: boolean) => void
  newRdv: NewRdvForm
  setNewRdv: (v: NewRdvForm) => void
  showAbsenceModal: boolean
  setShowAbsenceModal: (v: boolean) => void
  newAbsence: AbsenceForm
  setNewAbsence: (v: AbsenceForm) => void
  showBookingDetail: boolean
  setShowBookingDetail: (v: boolean) => void
  selectedBooking: Booking | null
  setSelectedBooking: (v: Booking | null) => void
  getCalendarTitle: () => string
  navigateCalendar: (direction: number) => void
  getCalendarHours: () => string[]
  getBookingsForDate: (date: Date) => Booking[]
  isDateAbsent: (date: Date) => { absent: boolean; reason: string; label: string; source: string; id: string }
  getWorkingWeekDates: () => Date[]
  getMonthDays: () => { days: Date[]; firstDay: Date; lastDay: Date }
  handleEmptyCellClick: (date: Date, hour: string) => void
  handleBookingClick: (booking: Booking) => void
  createRdvManual: () => void
  createAbsence: () => void
  deleteAbsence: (id: string) => void
  updateBookingStatus: (bookingId: string, newStatus: string) => void
  transformBookingToDevis: (booking: Booking) => void
  openDashMessages: (booking: Booking) => void
  DAY_NAMES: string[]
  DAY_SHORT: string[]
}

export default function CalendarSection(props: CalendarSectionProps) {
  const {
    artisan, bookings, services, pendingBookings, completedBookings, totalRevenue,
    calendarView, setCalendarView, selectedDay, setSelectedDay,
    showNewRdv, setShowNewRdv, newRdv, setNewRdv,
    showAbsenceModal, setShowAbsenceModal, newAbsence, setNewAbsence,
    showBookingDetail, setShowBookingDetail, selectedBooking, setSelectedBooking,
    getCalendarTitle, navigateCalendar, getCalendarHours, getBookingsForDate,
    isDateAbsent, getWorkingWeekDates, getMonthDays,
    handleEmptyCellClick, handleBookingClick, createRdvManual, createAbsence,
    deleteAbsence, updateBookingStatus, transformBookingToDevis, openDashMessages,
    DAY_NAMES, DAY_SHORT,
  } = props

  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  const reasonLabels: Record<string, string> = {
    'Conge': t('proDash.calendar.conge'),
    'Maladie': t('proDash.calendar.maladie'),
    'Formation': t('proDash.calendar.formation'),
    'Personnel': t('proDash.calendar.personnel'),
    'Ferie': t('proDash.calendar.ferie'),
    'Autre': t('proDash.calendar.autre'),
  }

  const todayBookings = getBookingsForDate(new Date())
  const fillRate = bookings.length > 0
    ? Math.round((bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length / bookings.length) * 100)
    : 0

  return (
    <div>
      {/* Page header */}
      <div className="v22-page-header">
        <div>
          <div className="v22-page-title">{t('proDash.calendar.title')}</div>
          <div className="v22-page-sub">{t('proDash.calendar.subtitle')}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['day', 'week', 'month'] as const).map((v) => (
            <button key={v} onClick={() => setCalendarView(v)}
              className="v22-btn v22-btn-sm"
              style={calendarView === v ? { background: 'var(--v22-yellow)', fontWeight: 600 } : undefined}>
              {v === 'day' ? t('proDash.calendar.jour') : v === 'week' ? t('proDash.calendar.semaine') : t('proDash.calendar.mois')}
            </button>
          ))}
          <button onClick={() => setShowAbsenceModal(true)}
            className="v22-btn v22-btn-sm"
            style={{ background: 'var(--v22-red-light)', color: 'var(--v22-red)', fontWeight: 600 }}>
            {t('proDash.calendar.absence')}
          </button>
          <button onClick={() => setShowNewRdv(true)} className="v22-btn v22-btn-primary v22-btn-sm">
            + {t('proDash.calendar.nouveauRendezVous')}
          </button>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Stats row */}
        <div className="v22-stats" style={{ marginBottom: 16 }}>
          <div className="v22-stat v22-stat-yellow">
            <div className="v22-stat-label">{t('proDash.calendar.rdvAujourdhui')}</div>
            <div className="v22-stat-val">{todayBookings.length}</div>
            <div className="v22-stat-delta" style={{ color: 'var(--v22-green)' }}>
              {todayBookings.filter(b => b.status === 'confirmed').length} {t('proDash.calendar.confirmes')}
            </div>
          </div>
          <div className="v22-stat">
            <div className="v22-stat-label">{t('proDash.calendar.tauxRemplissage')}</div>
            <div className="v22-stat-val">{fillRate}%</div>
            <div className="v22-stat-delta">{t('proDash.calendar.cetteSemaine')}</div>
          </div>
          <div className="v22-stat">
            <div className="v22-stat-label">{t('proDash.calendar.revenusMois')}</div>
            <div className="v22-stat-val">{formatPrice(totalRevenue)}</div>
            <div className="v22-stat-delta" style={{ color: 'var(--v22-green)' }}>
              {completedBookings.length} {t('proDash.home.terminees')}
            </div>
          </div>
          <div className="v22-stat">
            <div className="v22-stat-label">{t('proDash.calendar.noteMoyenne')}</div>
            <div className="v22-stat-val">{artisan?.rating_avg || '5.0'}/5</div>
            <div className="v22-stat-delta" style={{ color: 'var(--v22-amber)' }}>
              {artisan?.rating_count || 0} {t('proDash.home.avis')}
            </div>
          </div>
        </div>

        {/* Calendar card */}
        <div className="v22-card" style={{ marginBottom: 16 }}>
          <div className="v22-card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => navigateCalendar(-1)} className="v22-btn v22-btn-sm">{'◀'}</button>
              <span className="v22-card-title" style={{ textTransform: 'capitalize' }}>{getCalendarTitle()}</span>
              <button onClick={() => navigateCalendar(1)} className="v22-btn v22-btn-sm">{'▶'}</button>
            </div>
          </div>

          {/* DAY VIEW */}
          {calendarView === 'day' && (() => {
            const dayDate = new Date(selectedDay)
            const dayBookings = getBookingsForDate(dayDate)
            const absenceInfo = isDateAbsent(dayDate)
            const isToday = dayDate.toDateString() === new Date().toDateString()
            return (
              <div>
                <div style={{ padding: 10, textAlign: 'center', borderBottom: '1px solid var(--v22-border)', background: 'var(--v22-bg)' }}>
                  <div className="v22-mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: isToday ? 'var(--v22-amber)' : 'var(--v22-text-muted)', fontWeight: isToday ? 700 : 400 }}>
                    {DAY_NAMES[dayDate.getDay()]}
                  </div>
                  <div style={{
                    fontSize: 22, fontWeight: 700, marginTop: 2,
                    ...(isToday ? { background: 'var(--v22-yellow)', color: '#fff', width: 36, height: 36, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : { color: 'var(--v22-text)' })
                  }}>
                    {dayDate.getDate()}
                  </div>
                </div>
                {absenceInfo.absent && (
                  <div style={{
                    padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderLeft: `4px solid var(--v22-red)`,
                    background: absenceInfo.source === 'devis' ? '#fdd' : 'var(--v22-red-light)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--v22-red)' }}>
                        {absenceInfo.source === 'devis' ? `${absenceInfo.label}` : `Absent \u2014 ${absenceInfo.reason}`}
                      </div>
                      {absenceInfo.source === 'devis' && <div style={{ fontSize: 11, color: 'var(--v22-red)' }}>{absenceInfo.reason}</div>}
                    </div>
                    <button onClick={() => deleteAbsence(absenceInfo.id)} className="v22-btn v22-btn-sm" style={{ color: 'var(--v22-red)', fontSize: 11 }}>Supprimer</button>
                  </div>
                )}
                {getCalendarHours().map((hour) => {
                  const hourBookings = dayBookings.filter((b) => b.booking_time?.substring(0, 5) === hour)
                  const isEmpty = hourBookings.length === 0
                  return (
                    <div key={hour} style={{ display: 'grid', gridTemplateColumns: '60px 1fr', borderBottom: '1px solid var(--v22-border)' }}>
                      <div className="v22-mono" style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, color: 'var(--v22-text-muted)', borderRight: '1px solid var(--v22-border)' }}>
                        {hour}
                      </div>
                      <div
                        onClick={() => isEmpty && handleEmptyCellClick(dayDate, hour)}
                        style={{ minHeight: 60, padding: 6, cursor: isEmpty ? 'pointer' : 'default', position: 'relative' }}
                        onMouseEnter={(e) => { if (isEmpty) (e.currentTarget as HTMLElement).style.background = 'var(--v22-yellow-light)' }}
                        onMouseLeave={(e) => { if (isEmpty) (e.currentTarget as HTMLElement).style.background = '' }}
                      >
                        {hourBookings.map((b) => {
                          const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                          const motif = b.services?.name || 'RDV'
                          const borderColor = b.status === 'confirmed' ? 'var(--v22-green)' : b.status === 'pending' ? 'var(--v22-yellow)' : b.status === 'completed' ? 'var(--v22-green)' : 'var(--v22-red)'
                          const bgColor = b.status === 'confirmed' ? 'var(--v22-green-light)' : b.status === 'pending' ? 'var(--v22-yellow-light)' : b.status === 'completed' ? 'var(--v22-green-light)' : 'var(--v22-red-light)'
                          return (
                            <div key={b.id} onClick={() => handleBookingClick(b)}
                              style={{ borderLeft: `3px solid ${borderColor}`, background: bgColor, borderRadius: '0 3px 3px 0', padding: '8px 10px', marginBottom: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="v22-client-name" style={{ fontSize: 12 }}>{clientName}</div>
                                <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{motif}</div>
                              </div>
                              <div className="v22-mono" style={{ fontSize: 11, color: 'var(--v22-text-muted)', textAlign: 'right', flexShrink: 0 }}>
                                <div>{b.booking_time?.substring(0, 5)}</div>
                                {b.duration_minutes && <div>{b.duration_minutes} min</div>}
                              </div>
                              {b.price_ttc && <span className="v22-amount" style={{ flexShrink: 0 }}>{formatPrice(b.price_ttc)}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* WEEK VIEW */}
          {calendarView === 'week' && (() => {
            const weekDates = getWorkingWeekDates()
            const colCount = weekDates.length
            return (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 800 }}>
                  {/* Day headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${colCount}, 1fr)`, borderBottom: '1px solid var(--v22-border)' }}>
                    <div style={{ padding: 8, borderRight: '1px solid var(--v22-border)' }}></div>
                    {weekDates.map((date, i) => {
                      const isToday = date.toDateString() === new Date().toDateString()
                      const absInfo = isDateAbsent(date)
                      return (
                        <div key={i}
                          onClick={() => { setSelectedDay(date.toISOString().split('T')[0]); setCalendarView('day') }}
                          style={{ padding: 10, textAlign: 'center', borderRight: i < colCount - 1 ? '1px solid var(--v22-border)' : 'none', cursor: 'pointer', background: absInfo.absent ? '#FBE4E4' : 'transparent', borderBottom: absInfo.absent ? '3px solid #C0392B' : 'none' }}>
                          <div className="v22-mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: isToday ? 'var(--v22-amber)' : absInfo.absent ? 'var(--v22-red)' : 'var(--v22-text-muted)', fontWeight: isToday || absInfo.absent ? 700 : 400 }}>
                            {DAY_SHORT[date.getDay()]}
                          </div>
                          <div style={{
                            fontSize: 16, fontWeight: 700, marginTop: 2,
                            ...(isToday ? { background: 'var(--v22-yellow)', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : { color: absInfo.absent ? 'var(--v22-red)' : 'var(--v22-text)' })
                          }}>
                            {date.getDate()}
                          </div>
                          {absInfo.absent && (
                            <div style={{ fontSize: 9, color: 'var(--v22-red)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                              {absInfo.source === 'devis' ? absInfo.label : absInfo.reason}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Time grid rows */}
                  {getCalendarHours().map((hour) => (
                    <div key={hour} style={{ display: 'grid', gridTemplateColumns: `60px repeat(${colCount}, 1fr)`, borderBottom: '1px solid var(--v22-border)' }}>
                      <div className="v22-mono" style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, color: 'var(--v22-text-muted)', borderRight: '1px solid var(--v22-border)' }}>
                        {hour}
                      </div>
                      {weekDates.map((date, i) => {
                        const absInfo = isDateAbsent(date)
                        const dayBookings = getBookingsForDate(date)
                        const hourBookings = dayBookings.filter((b) => b.booking_time?.substring(0, 5) === hour)
                        const isEmpty = hourBookings.length === 0
                        if (absInfo.absent) {
                          return (
                            <div key={i} style={{ minHeight: 60, borderRight: i < colCount - 1 ? '1px solid var(--v22-border)' : 'none', padding: 4, background: absInfo.source === 'devis' ? '#FADBD8' : '#FBE4E4' }}>
                              {hour === getCalendarHours()[0] && (
                                <div className="v22-tag v22-tag-red" style={{ fontSize: 9 }}>
                                  {absInfo.source === 'devis' ? absInfo.label : absInfo.reason}
                                </div>
                              )}
                            </div>
                          )
                        }
                        return (
                          <div
                            key={i}
                            onClick={() => isEmpty && handleEmptyCellClick(date, hour)}
                            style={{ minHeight: 60, borderRight: i < colCount - 1 ? '1px solid var(--v22-border)' : 'none', padding: 4, cursor: isEmpty ? 'pointer' : 'default', position: 'relative' }}
                            onMouseEnter={(e) => { if (isEmpty) (e.currentTarget as HTMLElement).style.background = 'var(--v22-yellow-light)' }}
                            onMouseLeave={(e) => { if (isEmpty) (e.currentTarget as HTMLElement).style.background = '' }}
                          >
                            {hourBookings.map((b) => {
                              const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                              const motif = b.services?.name || 'RDV'
                              const borderColor = b.status === 'confirmed' ? 'var(--v22-green)' : b.status === 'pending' ? 'var(--v22-yellow)' : b.status === 'completed' ? 'var(--v22-green)' : 'var(--v22-red)'
                              const bgColor = b.status === 'confirmed' ? 'var(--v22-green-light)' : b.status === 'pending' ? 'var(--v22-yellow-light)' : b.status === 'completed' ? 'var(--v22-green-light)' : 'var(--v22-red-light)'
                              return (
                                <div key={b.id} onClick={(e) => { e.stopPropagation(); handleBookingClick(b) }}
                                  style={{ borderLeft: `3px solid ${borderColor}`, background: bgColor, borderRadius: '0 3px 3px 0', padding: '4px 6px', marginBottom: 3, cursor: 'pointer', overflow: 'hidden', maxHeight: 52 }}>
                                  <div className="v22-client-name" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientName}</div>
                                  <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{motif}</div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* MONTH VIEW */}
          {calendarView === 'month' && (() => {
            const { days, firstDay } = getMonthDays()
            const currentMonth = firstDay.getMonth()
            return (
              <div>
                {/* Day name headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--v22-border)' }}>
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                    <div key={d} className="v22-mono" style={{ padding: 8, textAlign: 'center', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--v22-text-muted)' }}>
                      {d}
                    </div>
                  ))}
                </div>
                {/* Day cells */}
                {Array.from({ length: 6 }, (_, weekIdx) => (
                  <div key={weekIdx} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--v22-border)' }}>
                    {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((date, i) => {
                      const isCurrentMonth = date.getMonth() === currentMonth
                      const isToday = date.toDateString() === new Date().toDateString()
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6
                      const dayBookings = getBookingsForDate(date)
                      const absInfo = isDateAbsent(date)
                      const cellBg = absInfo.absent
                        ? (absInfo.source === 'devis' ? '#FADBD8' : '#FBE4E4')
                        : !isCurrentMonth ? 'var(--v22-bg)' : isWeekend ? '#FAFAFA' : 'var(--v22-surface)'
                      return (
                        <div key={i}
                          onClick={() => { setSelectedDay(date.toISOString().split('T')[0]); setCalendarView('day') }}
                          style={{ minHeight: 80, padding: 6, borderRight: '1px solid var(--v22-border)', cursor: 'pointer', background: cellBg }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 700, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                              ...(isToday ? { background: 'var(--v22-yellow)', color: '#fff' } : absInfo.absent ? { background: 'var(--v22-red)', color: '#fff' } : { color: !isCurrentMonth ? 'var(--v22-border-dark)' : 'var(--v22-text)' })
                            }}>
                              {date.getDate()}
                            </span>
                            {absInfo.absent && isCurrentMonth ? (
                              <span style={{ fontSize: 9, color: 'var(--v22-red)', fontWeight: 700 }}>{absInfo.source === 'devis' ? '\u2699' : '\u2715'}</span>
                            ) : dayBookings.length > 0 && isCurrentMonth ? (
                              <span className="v22-mono" style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{dayBookings.length}</span>
                            ) : null}
                          </div>
                          {absInfo.absent && isCurrentMonth && (
                            <div className="v22-tag v22-tag-red" style={{ fontSize: 9, marginBottom: 2 }}>
                              {absInfo.source === 'devis' ? absInfo.label : absInfo.reason || 'Absent'}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {dayBookings.slice(0, absInfo.absent ? 1 : 3).map((b) => {
                              const dotColor = b.status === 'confirmed' ? 'var(--v22-green)' : b.status === 'pending' ? 'var(--v22-yellow)' : b.status === 'completed' ? 'var(--v22-green)' : 'var(--v22-red)'
                              return (
                                <div key={b.id} onClick={(e) => { e.stopPropagation(); handleBookingClick(b) }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                                  <span style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: !isCurrentMonth ? 'var(--v22-border-dark)' : 'var(--v22-text-muted)' }}>
                                    {b.booking_time?.substring(0, 5)} {b.services?.name || 'RDV'}
                                  </span>
                                </div>
                              )
                            })}
                            {dayBookings.length > (absInfo.absent ? 1 : 3) && (
                              <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', paddingLeft: 9 }}>+{dayBookings.length - (absInfo.absent ? 1 : 3)} de plus</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Pending bookings */}
        {pendingBookings.length > 0 && (
          <div className="v22-card">
            <div className="v22-card-head">
              <span className="v22-card-title">RDV en attente de validation ({pendingBookings.length})</span>
            </div>
            <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingBookings.map((b) => (
                <div key={b.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, background: 'var(--v22-amber-light)', border: '1px solid var(--v22-yellow-border)', borderRadius: 4 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{b.services?.name || 'Service'}</div>
                    <div className="v22-mono" style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{b.booking_date} {t('proDash.calendar.a')} {b.booking_time?.substring(0, 5)}</div>
                    <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{b.address}</div>
                    {b.notes && <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 4 }}>{b.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openDashMessages(b)} className="v22-btn v22-btn-sm">Messages</button>
                    <button onClick={() => updateBookingStatus(b.id, 'confirmed')} className="v22-btn v22-btn-sm" style={{ background: 'var(--v22-green)', color: '#fff' }}>Accepter</button>
                    <button onClick={() => updateBookingStatus(b.id, 'cancelled')} className="v22-btn v22-btn-sm" style={{ background: 'var(--v22-red-light)', color: 'var(--v22-red)' }}>Refuser</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal: New RDV */}
        {showNewRdv && (
          <div className="v22-modal-overlay" onClick={() => setShowNewRdv(false)}>
            <div className="v22-modal" style={{ width: 520, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div className="v22-modal-head">
                <span style={{ fontWeight: 600, fontSize: 14 }}>Nouveau rendez-vous</span>
                <button onClick={() => setShowNewRdv(false)} className="v22-btn v22-btn-sm">&times;</button>
              </div>
              <div className="v22-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="v22-form-group">
                  <label className="v22-form-label">Client</label>
                  <input type="text" value={newRdv.client_name} onChange={(e) => setNewRdv({...newRdv, client_name: e.target.value})} placeholder="Nom du client" className="v22-form-input" />
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">Prestation *</label>
                  <select value={newRdv.service_id} onChange={(e) => setNewRdv({...newRdv, service_id: e.target.value})} className="v22-form-input">
                    <option value="">Choisir une prestation...</option>
                    {services.filter(s => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} \u2014 {formatPrice(s.price_ttc ?? 0)}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div className="v22-form-group">
                    <label className="v22-form-label">Date *</label>
                    <input type="date" value={newRdv.date} onChange={(e) => setNewRdv({...newRdv, date: e.target.value})} min={new Date().toISOString().split('T')[0]} className="v22-form-input" />
                  </div>
                  <div className="v22-form-group">
                    <label className="v22-form-label">Heure *</label>
                    <input type="time" value={newRdv.time} onChange={(e) => setNewRdv({...newRdv, time: e.target.value})} className="v22-form-input" />
                  </div>
                  <div className="v22-form-group">
                    <label className="v22-form-label">Duree</label>
                    <select value={newRdv.duration} onChange={(e) => setNewRdv({...newRdv, duration: e.target.value})} className="v22-form-input">
                      <option value="">Auto</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">1h</option>
                      <option value="90">1h30</option>
                      <option value="120">2h</option>
                      <option value="180">3h</option>
                      <option value="240">Demi-journee</option>
                      <option value="480">Journee</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="v22-form-group">
                    <label className="v22-form-label">Telephone</label>
                    <input type="tel" value={newRdv.phone} onChange={(e) => setNewRdv({...newRdv, phone: e.target.value})} placeholder="06 12 34 56 78" className="v22-form-input" />
                  </div>
                  <div className="v22-form-group">
                    <label className="v22-form-label">Adresse</label>
                    <input type="text" value={newRdv.address} onChange={(e) => setNewRdv({...newRdv, address: e.target.value})} placeholder="Adresse intervention" className="v22-form-input" />
                  </div>
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">Notes</label>
                  <textarea value={newRdv.notes} onChange={(e) => setNewRdv({...newRdv, notes: e.target.value})} rows={2} placeholder="Details, acces, infos utiles..." className="v22-form-input" style={{ resize: 'none' }} />
                </div>
              </div>
              <div className="v22-modal-foot">
                <button onClick={createRdvManual} disabled={!newRdv.service_id || !newRdv.date || !newRdv.time}
                  className="v22-btn v22-btn-primary" style={{ flex: 1, opacity: (!newRdv.service_id || !newRdv.date || !newRdv.time) ? 0.4 : 1, cursor: (!newRdv.service_id || !newRdv.date || !newRdv.time) ? 'not-allowed' : 'pointer' }}>
                  Creer le rendez-vous
                </button>
                <button onClick={() => setShowNewRdv(false)} className="v22-btn">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Absence */}
        {showAbsenceModal && (
          <div className="v22-modal-overlay" onClick={() => setShowAbsenceModal(false)}>
            <div className="v22-modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
              <div className="v22-modal-head">
                <span style={{ fontWeight: 600, fontSize: 14 }}>Ajouter une absence</span>
                <button onClick={() => setShowAbsenceModal(false)} className="v22-btn v22-btn-sm">&times;</button>
              </div>
              <div className="v22-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="v22-form-group">
                  <label className="v22-form-label">Motif</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {['Conge', 'Maladie', 'Formation', 'Personnel', 'Ferie', 'Autre'].map(reason => (
                      <button key={reason} onClick={() => setNewAbsence({...newAbsence, reason})}
                        className="v22-btn v22-btn-sm"
                        style={newAbsence.reason === reason ? { border: '2px solid var(--v22-red)', background: 'var(--v22-red-light)', color: 'var(--v22-red)', fontWeight: 600 } : {}}>
                        {reason === 'Conge' ? 'Conge' : reason === 'Maladie' ? 'Maladie' : reason === 'Formation' ? 'Formation' : reason === 'Personnel' ? 'Personnel' : reason === 'Ferie' ? 'Ferie' : 'Autre'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="v22-form-group">
                    <label className="v22-form-label">Du *</label>
                    <input type="date" value={newAbsence.start_date} onChange={(e) => setNewAbsence({...newAbsence, start_date: e.target.value, end_date: newAbsence.end_date || e.target.value})} className="v22-form-input" />
                  </div>
                  <div className="v22-form-group">
                    <label className="v22-form-label">Au *</label>
                    <input type="date" value={newAbsence.end_date} onChange={(e) => setNewAbsence({...newAbsence, end_date: e.target.value})} min={newAbsence.start_date} className="v22-form-input" />
                  </div>
                </div>
                {newAbsence.start_date && newAbsence.end_date && (
                  <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', background: 'var(--v22-bg)', padding: 10, borderRadius: 4, textAlign: 'center' }}>
                    {(() => {
                      const start = new Date(newAbsence.start_date)
                      const end = new Date(newAbsence.end_date)
                      const daysCount = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
                      return `${daysCount} jour${daysCount > 1 ? 's' : ''} d'absence`
                    })()}
                  </div>
                )}
                <div className="v22-form-group">
                  <label className="v22-form-label">Libelle <span style={{ color: 'var(--v22-text-muted)' }}>(optionnel)</span></label>
                  <input type="text" value={newAbsence.label} onChange={(e) => setNewAbsence({...newAbsence, label: e.target.value})} placeholder="Ex: Vacances d'ete, RDV medical..." className="v22-form-input" />
                </div>
              </div>
              <div className="v22-modal-foot">
                <button onClick={createAbsence} disabled={!newAbsence.start_date || !newAbsence.end_date}
                  className="v22-btn" style={{ flex: 1, background: 'var(--v22-red)', color: '#fff', opacity: (!newAbsence.start_date || !newAbsence.end_date) ? 0.4 : 1, cursor: (!newAbsence.start_date || !newAbsence.end_date) ? 'not-allowed' : 'pointer' }}>
                  Bloquer ces dates
                </button>
                <button onClick={() => setShowAbsenceModal(false)} className="v22-btn">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Booking Detail */}
        {showBookingDetail && selectedBooking && (
          <div className="v22-modal-overlay" onClick={() => { setShowBookingDetail(false); setSelectedBooking(null) }}>
            <div className="v22-modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
              <div className="v22-modal-head">
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Detail du rendez-vous</span>
                  <div style={{ marginTop: 6 }}>
                    <span className={`v22-tag ${
                      selectedBooking.status === 'confirmed' ? 'v22-tag-green' :
                      selectedBooking.status === 'pending' ? 'v22-tag-amber' :
                      selectedBooking.status === 'completed' ? 'v22-tag-green' :
                      'v22-tag-red'
                    }`}>
                      {selectedBooking.status === 'confirmed' ? 'Confirme' :
                       selectedBooking.status === 'pending' ? 'En attente' :
                       selectedBooking.status === 'completed' ? 'Termine' : 'Annule'}
                    </span>
                  </div>
                </div>
                <button onClick={() => { setShowBookingDetail(false); setSelectedBooking(null) }} className="v22-btn v22-btn-sm">&times;</button>
              </div>

              <div className="v22-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Badge auto-accept vs validation requise */}
                {(() => {
                  const isAutoConfirmed = selectedBooking.status === 'confirmed' && selectedBooking.confirmed_at && selectedBooking.created_at &&
                    Math.abs(new Date(selectedBooking.confirmed_at).getTime() - new Date(selectedBooking.created_at).getTime()) < 60000
                  if (isAutoConfirmed) return (
                    <div style={{ padding: '8px 12px', background: '#dcfce7', borderRadius: 6, border: '1px solid #bbf7d0', fontSize: 12, color: '#166534' }}>
                      ✅ RDV automatiquement confirmé — aucune action requise
                    </div>
                  )
                  if (selectedBooking.status === 'pending') return (
                    <div style={{ padding: '8px 12px', background: '#fef9c3', borderRadius: 6, border: '1px solid #fde68a', fontSize: 12, color: '#92400e' }}>
                      ⏳ Validation requise — acceptez ou refusez ce rendez-vous
                    </div>
                  )
                  return null
                })()}

                {/* Infos client structurées */}
                {(() => {
                  const notes = selectedBooking.notes || ''
                  const clientName = notes.match(/Client:\s*([^|.\n]+)/i)?.[1]?.trim() || ''
                  const clientPhone = notes.match(/T[ée]l(?:[ée]phone)?:\s*([^|.\n]+)/i)?.[1]?.trim() || ''
                  const clientEmail = notes.match(/Email:\s*([^|.\n]+)/i)?.[1]?.trim() || ''
                  const cleanNotes = notes.replace(/Client:\s*[^|.\n]+/i, '').replace(/T[ée]l(?:[ée]phone)?:\s*[^|.\n]+/i, '').replace(/Email:\s*[^|.\n]+/i, '').replace(/\|/g, '').trim()
                  return (
                    <>
                      {/* Tableau client */}
                      <div style={{ border: '1px solid var(--v22-border)', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ padding: '6px 10px', background: '#0d0d0d', color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>INFORMATIONS CLIENT</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: 13 }}>
                          {clientName && <><div style={{ padding: '6px 10px', background: 'var(--v22-bg)', fontWeight: 500, borderBottom: '1px solid var(--v22-border)' }}>Client</div><div style={{ padding: '6px 10px', borderBottom: '1px solid var(--v22-border)' }}>{clientName}</div></>}
                          {clientPhone && <><div style={{ padding: '6px 10px', background: 'var(--v22-bg)', fontWeight: 500, borderBottom: '1px solid var(--v22-border)' }}>Téléphone</div><div style={{ padding: '6px 10px', borderBottom: '1px solid var(--v22-border)' }}>{clientPhone}</div></>}
                          {clientEmail && <><div style={{ padding: '6px 10px', background: 'var(--v22-bg)', fontWeight: 500, borderBottom: '1px solid var(--v22-border)' }}>Email</div><div style={{ padding: '6px 10px', borderBottom: '1px solid var(--v22-border)' }}>{clientEmail}</div></>}
                        </div>
                      </div>

                      {/* Tableau intervention */}
                      <div style={{ border: '1px solid var(--v22-border)', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ padding: '6px 10px', background: '#0d0d0d', color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>DÉTAILS INTERVENTION</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: 13 }}>
                          <div style={{ padding: '6px 10px', background: 'var(--v22-bg)', fontWeight: 500, borderBottom: '1px solid var(--v22-border)' }}>Motif</div>
                          <div style={{ padding: '6px 10px', fontWeight: 600, borderBottom: '1px solid var(--v22-border)' }}>{selectedBooking.services?.name || 'Service'}</div>
                          <div style={{ padding: '6px 10px', background: 'var(--v22-bg)', fontWeight: 500, borderBottom: '1px solid var(--v22-border)' }}>Date</div>
                          <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--v22-border)' }}>{new Date(selectedBooking.booking_date || '').toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                          <div style={{ padding: '6px 10px', background: 'var(--v22-bg)', fontWeight: 500, borderBottom: '1px solid var(--v22-border)' }}>Heure</div>
                          <div style={{ padding: '6px 10px', fontFamily: 'monospace', borderBottom: '1px solid var(--v22-border)' }}>{selectedBooking.booking_time?.substring(0, 5) || '—'}</div>
                          {selectedBooking.duration_minutes && <>
                            <div style={{ padding: '6px 10px', background: 'var(--v22-bg)', fontWeight: 500, borderBottom: '1px solid var(--v22-border)' }}>Durée</div>
                            <div style={{ padding: '6px 10px', fontFamily: 'monospace', borderBottom: '1px solid var(--v22-border)' }}>{Math.floor(selectedBooking.duration_minutes / 60)}h{selectedBooking.duration_minutes % 60 > 0 ? String(selectedBooking.duration_minutes % 60).padStart(2, '0') : '00'}</div>
                          </>}
                          <div style={{ padding: '6px 10px', background: 'var(--v22-bg)', fontWeight: 500, borderBottom: '1px solid var(--v22-border)' }}>Adresse</div>
                          <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--v22-border)' }}>{selectedBooking.address || 'Non renseignée'}</div>
                          {selectedBooking.price_ttc && <>
                            <div style={{ padding: '6px 10px', background: 'var(--v22-bg)', fontWeight: 500 }}>Montant</div>
                            <div style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--v22-green)' }}>{formatPrice(selectedBooking.price_ttc)}</div>
                          </>}
                        </div>
                      </div>

                      {/* Notes additionnelles */}
                      {cleanNotes && (
                        <div style={{ padding: 10, background: 'var(--v22-bg)', borderRadius: 6, fontSize: 12, color: 'var(--v22-text-mid)' }}>
                          <div className="v22-form-label" style={{ marginBottom: 4 }}>Notes</div>
                          {cleanNotes}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              <div className="v22-modal-foot" style={{ flexWrap: 'wrap' }}>
                {selectedBooking.status === 'pending' && (
                  <>
                    <button onClick={() => { setShowBookingDetail(false); transformBookingToDevis(selectedBooking) }}
                      className="v22-btn" style={{ width: '100%', background: '#2563EB', color: '#fff', marginBottom: 6 }}>
                      Transformer en devis
                    </button>
                    <button onClick={() => updateBookingStatus(selectedBooking.id, 'confirmed')}
                      className="v22-btn" style={{ flex: 1, background: 'var(--v22-green)', color: '#fff' }}>
                      Confirmer
                    </button>
                    <button onClick={() => updateBookingStatus(selectedBooking.id, 'cancelled')}
                      className="v22-btn" style={{ flex: 1, background: 'var(--v22-red-light)', color: 'var(--v22-red)', border: '1px solid var(--v22-red)' }}>
                      Refuser
                    </button>
                  </>
                )}
                {selectedBooking.status === 'confirmed' && (
                  <>
                    <button onClick={() => { setShowBookingDetail(false); transformBookingToDevis(selectedBooking) }}
                      className="v22-btn" style={{ width: '100%', background: '#2563EB', color: '#fff', marginBottom: 6 }}>
                      Transformer en devis
                    </button>
                    <button onClick={() => updateBookingStatus(selectedBooking.id, 'completed')}
                      className="v22-btn" style={{ flex: 1, background: '#2563EB', color: '#fff' }}>
                      Marquer termine
                    </button>
                    <button onClick={() => { if (confirm('Annuler ce rendez-vous ?')) updateBookingStatus(selectedBooking.id, 'cancelled') }}
                      className="v22-btn" style={{ flex: 1, background: 'var(--v22-red-light)', color: 'var(--v22-red)', border: '1px solid var(--v22-red)' }}>
                      Annuler le RDV
                    </button>
                  </>
                )}
                {selectedBooking.status === 'completed' && (
                  <div style={{ width: '100%', textAlign: 'center', color: 'var(--v22-text-muted)', padding: 6, fontSize: 12 }}>Ce RDV est termine</div>
                )}
                {selectedBooking.status === 'cancelled' && (
                  <button onClick={() => updateBookingStatus(selectedBooking.id, 'pending')}
                    className="v22-btn" style={{ flex: 1, background: 'var(--v22-amber-light)', color: 'var(--v22-amber)', border: '1px solid var(--v22-amber)' }}>
                    Remettre en attente
                  </button>
                )}
                <button onClick={() => { setShowBookingDetail(false); setSelectedBooking(null) }}
                  className="v22-btn" style={{ width: '100%' }}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
